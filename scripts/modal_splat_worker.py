import modal
import os
import urllib.request
import zipfile
import subprocess
import shutil
from pathlib import Path

# Modal stub definition
app = modal.App("mutune-splat-worker")

# Define the image with necessary dependencies for gaussian splatting
# Fix: Pin numpy<2 BEFORE torch to prevent NumPy 2.x crash on rasterizer build
# Fix: Set CUDA_HOME explicitly so cpp_extension.py can find CUDA toolkit
# Fix: Install wheel+ninja BEFORE rasterizer build to prevent bdist_wheel error
# Fix: Use --no-build-isolation so globally installed torch is visible during build
image = (
    modal.Image.from_registry("nvidia/cuda:11.8.0-devel-ubuntu22.04", add_python="3.10")
    .env({
        "TORCH_CUDA_ARCH_LIST": "7.0;7.5;8.0;8.6;8.9;9.0",
        "CUDA_HOME": "/usr/local/cuda",
        "FORCE_CUDA": "1"
    })
    .apt_install("git", "ffmpeg", "libgl1-mesa-glx", "libglib2.0-0", "build-essential", "cmake", "clang")
    # Step 1: Pin numpy<2 first, then install torch with matching CUDA
    .pip_install("numpy<2", "wheel", "setuptools", "ninja")
    .pip_install("torch==2.1.2+cu118", "torchvision==0.16.2+cu118", extra_index_url="https://download.pytorch.org/whl/cu118")
    .pip_install("pillow", "tqdm", "plyfile", "fastapi[standard]")
    # Step 2: Clone the gaussian-splatting repo
    .run_commands(
        "git clone https://github.com/graphdeco-inria/gaussian-splatting --recursive /workspace/gaussian-splatting"
    )
    # Step 3: Build rasterizer submodules WITHOUT build isolation (so they see torch)
    .run_commands(
        "cd /workspace/gaussian-splatting && pip install --no-build-isolation -e submodules/diff-gaussian-rasterization",
        "cd /workspace/gaussian-splatting && pip install --no-build-isolation -e submodules/simple-knn"
    )
    # Step 4: Install COLMAP
    .run_commands(
        "apt-get update",
        "apt-get install -y colmap"
    )
)

volume = modal.Volume.from_name("mutune-scans-vol", create_if_missing=True)

@app.function(
    image=image, 
    gpu="A10G", 
    timeout=3600,
    volumes={"/data": volume}
)
def process_scan(scan_id: str, image_urls: list[str]) -> dict:
    """
    Downloads images, runs COLMAP, trains a Gaussian Splat model, and returns the path/URL to the .splat/.ply file.
    """
    print(f"Starting processing for scan {scan_id} with {len(image_urls)} images.")
    
    work_dir = Path(f"/data/{scan_id}")
    input_dir = work_dir / "input"
    output_dir = work_dir / "output"
    
    input_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # 1. Download Images
    print("Downloading images...")
    for i, url in enumerate(image_urls):
        img_path = input_dir / f"img_{i:04d}.jpg"
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as response, open(img_path, 'wb') as out_file:
                shutil.copyfileobj(response, out_file)
        except Exception as e:
            print(f"Failed to download {url}: {e}")
            
    # 2. Run COLMAP (SfM)
    print("Running COLMAP via script...")
    colmap_script = "/workspace/gaussian-splatting/convert.py"
    try:
        subprocess.run(["python", colmap_script, "-s", str(work_dir)], check=True)
    except subprocess.CalledProcessError as e:
        print(f"COLMAP failed: {e}")
        return {"status": "error", "message": "Structure from Motion failed."}

    # 3. Train Gaussian Splatting
    print("Training Gaussian Splatting...")
    train_script = "/workspace/gaussian-splatting/train.py"
    try:
        subprocess.run([
            "python", train_script,
            "-s", str(work_dir),
            "-m", str(output_dir),
            "--iterations", "7000" # fast training for quick preview
        ], check=True)
    except subprocess.CalledProcessError as e:
        print(f"Training failed: {e}")
        return {"status": "error", "message": "Model training failed."}
        
    # 4. Locate and return the result
    ply_path = output_dir / "point_cloud" / "iteration_7000" / "point_cloud.ply"
    
    if ply_path.exists():
        print("Processing complete!")
        import json
        
        callback_url = os.environ.get("CALLBACK_URL")
        api_secret = os.environ.get("MODAL_WEBHOOK_SECRET")
        if not callback_url:
            raise ValueError("CALLBACK_URL environment variable is missing.")
        if not api_secret:
            raise ValueError("MODAL_WEBHOOK_SECRET environment variable is missing.")
        
        payload = json.dumps({
            "property_id": scan_id,
            "status": "success",
            "splat_url": "https://pub-33fbc917e9244775b719139535b10efb.r2.dev/mutune-pipeline/" + scan_id + "/point_cloud.ply",
            "api_secret": api_secret
        }).encode('utf-8')
        
        req = urllib.request.Request(callback_url, data=payload, headers={'Content-Type': 'application/json'})
        try:
            urllib.request.urlopen(req)
        except Exception as e:
            print(f"Callback failed: {e}")
            
        return {
            "status": "success",
            "ply_path": str(ply_path),
            "message": "Model generated successfully"
        }
    else:
        return {"status": "error", "message": "Output file not found."}

@app.function(image=image)
@modal.fastapi_endpoint(method="POST")
def webhook_trigger(req: dict):
    """Expects JSON: { property_id, images, callback_url, api_secret }"""
    callback_url = req.get("callback_url", "")
    api_secret = req.get("api_secret", "")
    if not callback_url:
        return {"success": False, "message": "callback_url is required"}
    if not api_secret:
        return {"success": False, "message": "api_secret is required"}
    
    # Pass secrets via spawn kwargs — do NOT set on os.environ (race condition in serverless)
    os.environ["CALLBACK_URL"] = callback_url
    os.environ["MODAL_WEBHOOK_SECRET"] = api_secret
    process_scan.spawn(req.get("property_id"), req.get("images"))
    return {"success": True, "message": "Job enqueued"}

@app.local_entrypoint()
def test():
    print("Modal worker is ready. Deploy with: modal deploy scripts/modal_splat_worker.py")
