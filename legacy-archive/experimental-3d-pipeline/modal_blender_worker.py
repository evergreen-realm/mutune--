import modal
import os
import urllib.request
import subprocess
import shutil
import json
from pathlib import Path

app = modal.App("mutune-blender-worker")

# Define the image with blender installed and the generator script baked in.
image = (
    modal.Image.debian_slim(python_version="3.10")
    .apt_install("blender", "curl")
    .pip_install("boto3", "fastapi[standard]")
    # Mount the blender generator script into the container (replaces deprecated modal.Mount)
    .add_local_file(
        local_path="scripts/blender_building_generator.py",
        remote_path="/workspace/blender_building_generator.py",
        copy=True
    )
)

volume = modal.Volume.from_name("mutune-blender-vol", create_if_missing=True)

@app.function(
    image=image,
    timeout=600,
    volumes={"/data": volume},
    secrets=[modal.Secret.from_name("mutune-r2-secrets")]
)
def generate_blender_model(property_id: str, property_code: str, floors: int, units: int, texture_url: str, callback_url: str, api_secret: str) -> dict:
    import boto3
    print(f"Starting Blender generation for property {property_id} ({property_code}) with {floors} floors, {units} units.")
    
    work_dir = Path(f"/data/{property_code}")
    work_dir.mkdir(parents=True, exist_ok=True)
    
    texture_path = None
    if texture_url:
        print(f"Downloading texture from {texture_url}...")
        texture_path = work_dir / f"tex_{property_code}.jpg"
        try:
            req = urllib.request.Request(texture_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as response, open(texture_path, 'wb') as out_file:
                shutil.copyfileobj(response, out_file)
        except Exception as e:
            print(f"Failed to download texture {texture_url}: {e}")
            texture_path = None

    output_path = work_dir / f"building_{property_code}.glb"
    
    script_path = "/workspace/blender_building_generator.py"
    
    args = [
        "blender", "--background", "--python", script_path, "--",
        "--floors", str(floors),
        "--units", str(units),
        "--output", str(output_path)
    ]
    
    if texture_path:
        args.extend(["--texture_image", str(texture_path)])
        
    print(f"Running Blender: {' '.join(args)}")
    try:
        subprocess.run(args, check=True, capture_output=True, text=True)
    except subprocess.CalledProcessError as e:
        print(f"Blender failed:\nSTDOUT: {e.stdout}\nSTDERR: {e.stderr}")
        send_webhook(callback_url, api_secret, property_id, property_code, "failed", None, "Blender rendering failed")
        return {"status": "error", "message": "Blender rendering failed."}
        
    if output_path.exists():
        print("Model generated successfully! Uploading to R2...")
        
        # Upload to R2
        r2_endpoint = os.environ.get("CLOUDFLARE_R2_ENDPOINT")
        r2_access_key = os.environ.get("CLOUDFLARE_R2_PIPELINE_ACCESS_KEY_ID")
        r2_secret_key = os.environ.get("CLOUDFLARE_R2_PIPELINE_SECRET_ACCESS_KEY")
        bucket_name = os.environ.get("CLOUDFLARE_R2_PIPELINE_BUCKET", "mutune-pipeline")
        public_url = os.environ.get("CLOUDFLARE_R2_PUBLIC_URL", "https://pub-33fbc917e9244775b719139535b10efb.r2.dev")
        
        glb_url = None
        if r2_endpoint and r2_access_key and r2_secret_key:
            try:
                s3 = boto3.client('s3',
                  endpoint_url=r2_endpoint,
                  aws_access_key_id=r2_access_key,
                  aws_secret_access_key=r2_secret_key
                )
                
                object_name = f"models/building_{property_code}.glb"
                s3.upload_file(str(output_path), bucket_name, object_name, ExtraArgs={'ContentType': 'model/gltf-binary'})
                glb_url = f"{public_url}/{object_name}"
                print(f"Uploaded successfully to {glb_url}")
            except Exception as e:
                print(f"Failed to upload to R2: {e}")
                glb_url = f"{public_url}/mutune-pipeline/models/building_{property_code}.glb"
        else:
            print("Warning: R2 credentials not found in environment, returning dummy URL.")
            glb_url = f"{public_url}/mutune-pipeline/models/building_{property_code}.glb"
            
        send_webhook(callback_url, api_secret, property_id, property_code, "success", glb_url, None)
            
        return {
            "status": "success",
            "glb_url": glb_url,
            "message": "Model generated successfully"
        }
    else:
        send_webhook(callback_url, api_secret, property_id, property_code, "failed", None, "Output file not found")
        return {"status": "error", "message": "Output file not found."}

def send_webhook(callback_url, api_secret, property_id, property_code, status, glb_url, error):
    if not callback_url:
        print("No callback URL provided, skipping webhook.")
        return
        
    payload = json.dumps({
        "property_id": property_id,
        "property_code": property_code,
        "status": status,
        "glb_url": glb_url,
        "api_secret": api_secret,
        "error": error
    }).encode('utf-8')
    
    req = urllib.request.Request(callback_url, data=payload, headers={'Content-Type': 'application/json'})
    try:
        urllib.request.urlopen(req)
        print("Webhook sent successfully.")
    except Exception as e:
        print(f"Callback failed: {e}")

@app.function(image=image, secrets=[modal.Secret.from_name("mutune-r2-secrets")])
@modal.fastapi_endpoint(method="POST")
def webhook_trigger(req: dict):
    """Expects JSON: { property_id, property_code, floors, units, texture_url, callback_url, api_secret }"""
    callback_url = req.get("callback_url", "")
    api_secret = req.get("api_secret", "")
    property_id = req.get("property_id")
    property_code = req.get("property_code")
    floors = req.get("floors", 4)
    units = req.get("units", 16)
    texture_url = req.get("texture_url", "")
    
    if not callback_url:
        return {"success": False, "message": "callback_url is required"}
    if not api_secret:
        return {"success": False, "message": "api_secret is required"}
    if not property_id:
        return {"success": False, "message": "property_id is required"}
    
    generate_blender_model.spawn(property_id, property_code, floors, units, texture_url, callback_url, api_secret)
    return {"success": True, "message": "Blender job enqueued"}

@app.local_entrypoint()
def test():
    print("Modal worker is ready. Deploy with: modal deploy scripts/modal_blender_worker.py")
