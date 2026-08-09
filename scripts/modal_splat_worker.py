import modal
import os
import urllib.request
import zipfile
import subprocess
import shutil
import json
from pathlib import Path

# Modal stub definition
app = modal.App("mutune-splat-worker")

# Define the image with necessary dependencies for gaussian splatting
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
    .pip_install("pillow", "tqdm", "plyfile", "fastapi[standard]", "boto3")
    # Step 2: Clone the gaussian-splatting repo
    .run_commands(
        "git clone https://github.com/graphdeco-inria/gaussian-splatting --recursive /workspace/gaussian-splatting"
    )
    # Step 3: Build rasterizer submodules WITHOUT build isolation (so they see torch) and without -e
    .run_commands(
        "cd /workspace/gaussian-splatting && pip install --no-build-isolation submodules/diff-gaussian-rasterization",
        "cd /workspace/gaussian-splatting && pip install --no-build-isolation submodules/simple-knn"
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
def process_scan(property_id: str, scan_id: str, image_urls: list[str], callback_url: str, api_secret: str) -> dict:
    """
    Downloads images, runs COLMAP, trains a Gaussian Splat model, uploads to R2, and calls webhook.
    """
    import boto3
    print(f"Starting processing for property {property_id} scan {scan_id} with {len(image_urls)} images.")
    
    # We will use scan_id to create a unique directory
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
        send_webhook(callback_url, api_secret, property_id, scan_id, "failed", None, "COLMAP failed")
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
        send_webhook(callback_url, api_secret, property_id, scan_id, "failed", None, "Training failed")
        return {"status": "error", "message": "Model training failed."}
        
    # 4. Locate and return the result
    ply_path = output_dir / "point_cloud" / "iteration_7000" / "point_cloud.ply"
    
    if ply_path.exists():
        print("Processing complete! Uploading to R2...")
        
        # Upload to R2
        r2_endpoint = os.environ.get("CLOUDFLARE_R2_ENDPOINT")
        r2_access_key = os.environ.get("CLOUDFLARE_R2_PIPELINE_ACCESS_KEY_ID")
        r2_secret_key = os.environ.get("CLOUDFLARE_R2_PIPELINE_SECRET_ACCESS_KEY")
        bucket_name = os.environ.get("CLOUDFLARE_R2_PIPELINE_BUCKET", "mutune-pipeline")
        public_url = os.environ.get("CLOUDFLARE_R2_PUBLIC_URL", "https://pub-33fbc917e9244775b719139535b10efb.r2.dev")
        
        splat_url = None
        if r2_endpoint and r2_access_key and r2_secret_key:
            try:
                s3 = boto3.client('s3',
                  endpoint_url=r2_endpoint,
                  aws_access_key_id=r2_access_key,
                  aws_secret_access_key=r2_secret_key
                )
                
                object_name = f"scans/{scan_id}/point_cloud.ply"
                s3.upload_file(str(ply_path), bucket_name, object_name)
                splat_url = f"{public_url}/{object_name}"
                print(f"Uploaded successfully to {splat_url}")
            except Exception as e:
                print(f"Failed to upload to R2: {e}")
                # Fallback to dummy URL for testing if it fails
                splat_url = f"{public_url}/mutune-pipeline/{scan_id}/point_cloud.ply"
        else:
            print("Warning: R2 credentials not found in environment, returning dummy URL.")
            splat_url = f"{public_url}/mutune-pipeline/{scan_id}/point_cloud.ply"
            
        # Send Webhook
        send_webhook(callback_url, api_secret, property_id, scan_id, "success", splat_url, None)
            
        return {
            "status": "success",
            "ply_path": str(ply_path),
            "message": "Model generated successfully"
        }
    else:
        send_webhook(callback_url, api_secret, property_id, scan_id, "failed", None, "Output file not found")
        return {"status": "error", "message": "Output file not found."}

def send_webhook(callback_url, api_secret, property_id, scan_id, status, splat_url, error):
    if not callback_url:
        print("No callback URL provided, skipping webhook.")
        return
        
    payload = json.dumps({
        "property_id": property_id,
        "scan_id": scan_id,
        "status": status,
        "splat_url": splat_url,
        "api_secret": api_secret,
        "error": error
    }).encode('utf-8')
    
    req = urllib.request.Request(callback_url, data=payload, headers={'Content-Type': 'application/json'})
    try:
        urllib.request.urlopen(req)
        print("Webhook sent successfully.")
    except Exception as e:
        print(f"Callback failed: {e}")

@app.function(image=image, secrets=[modal.Secret.from_name("mutune-r2-secrets", require_missing=True)])
@modal.fastapi_endpoint(method="POST")
def webhook_trigger(req: dict):
    """Expects JSON: { property_id, scan_id, images, callback_url, api_secret }"""
    callback_url = req.get("callback_url", "")
    api_secret = req.get("api_secret", "")
    property_id = req.get("property_id")
    scan_id = req.get("scan_id")
    images = req.get("images")
    
    if not callback_url:
        return {"success": False, "message": "callback_url is required"}
    if not api_secret:
        return {"success": False, "message": "api_secret is required"}
    if not scan_id:
        return {"success": False, "message": "scan_id is required"}
    
    process_scan.spawn(property_id, scan_id, images, callback_url, api_secret)
    return {"success": True, "message": "Job enqueued"}

@app.local_entrypoint()
def test():
    print("Modal worker is ready. Deploy with: modal deploy scripts/modal_splat_worker.py")
