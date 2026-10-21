# 고른 시안 사람 사진(896×1184)을 같은 LoRA로 1.5배(1344×1776) 키운다 — 렌초스로 늘린 뒤 같은 지시문 img2img(기본 0.32).
#   캔 글자가 캔 폭 100화소 남짓에서는 뭉개져서, 사람 사진을 먼저 키우고 그 위에 캔을 얹는다(2026-10-21).
#   다른 업스케일러(SeedVR2 등)는 주근깨 · 눈매를 지어내 얼굴 게이트를 흐리므로 같은 LoRA로만 키운다.
#   쓰기: <ComfyUI venv python> -X utf8 시안_키우기.py <작업.json> <이름…> [--denoise 0.32] [--원본 mock]
#        작업.json은 시안_작업.py가 만든 것(이름 = <코드>_<장면>_s<시드>), 결과는 ComfyUI output\pulse_gate\up\<이름>_00001_.png
#        --원본: 사람 사진을 찾는 output\pulse_gate\ 아래 폴더(게이트 뒤 다시 뽑은 후보는 fix)
import json
import os
import shutil
import sys
import time
import urllib.request
import uuid

COMFY = r"C:\SYNK-LoRA\tools\ComfyUI"
HOST = "http://127.0.0.1:8188"
W, H = 1344, 1776


def call(path, payload=None):
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(HOST + path, data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def graph(job, src_name, denoise):
    return {
        "unet": {"class_type": "UNETLoader", "inputs": {"unet_name": "z_image_turbo_bf16.safetensors", "weight_dtype": "default"}},
        "clip": {"class_type": "CLIPLoader", "inputs": {"clip_name": "qwen_3_4b.safetensors", "type": "lumina2", "device": "default"}},
        "vae": {"class_type": "VAELoader", "inputs": {"vae_name": "ae.safetensors"}},
        "lora": {"class_type": "LoraLoaderModelOnly", "inputs": {"model": ["unet", 0], "lora_name": job["lora"], "strength_model": job.get("lora_strength", 1.0)}},
        "shift": {"class_type": "ModelSamplingAuraFlow", "inputs": {"model": ["lora", 0], "shift": 3}},
        "pos": {"class_type": "CLIPTextEncode", "inputs": {"text": job["prompt"], "clip": ["clip", 0]}},
        "neg": {"class_type": "CLIPTextEncode", "inputs": {"text": "low quality", "clip": ["clip", 0]}},
        "load": {"class_type": "LoadImage", "inputs": {"image": src_name}},
        "scale": {"class_type": "ImageScale", "inputs": {"image": ["load", 0], "upscale_method": "lanczos", "width": W, "height": H, "crop": "disabled"}},
        "enc": {"class_type": "VAEEncode", "inputs": {"pixels": ["scale", 0], "vae": ["vae", 0]}},
        "sampler": {"class_type": "KSampler", "inputs": {"seed": job["seed"], "steps": 8, "cfg": 1, "sampler_name": "res_multistep",
                                                         "scheduler": "simple", "denoise": denoise, "model": ["shift", 0],
                                                         "positive": ["pos", 0], "negative": ["neg", 0], "latent_image": ["enc", 0]}},
        "dec": {"class_type": "VAEDecode", "inputs": {"samples": ["sampler", 0], "vae": ["vae", 0]}},
        "save": {"class_type": "SaveImage", "inputs": {"filename_prefix": f"pulse_gate/up/{job['name']}", "images": ["dec", 0]}},
    }


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    args = sys.argv[1:]
    denoise = 0.32
    if "--denoise" in args:
        i = args.index("--denoise")
        denoise = float(args[i + 1])
        del args[i:i + 2]
    folder = "mock"
    if "--원본" in args:
        i = args.index("--원본")
        folder = args[i + 1]
        del args[i:i + 2]
    spec = json.load(open(args[0], encoding="utf-8"))
    names = args[1:]
    jobs = {j["name"]: j for j in spec["jobs"]}
    os.makedirs(os.path.join(COMFY, "input", "pulse_gate"), exist_ok=True)
    pend = {}
    for n in names:
        src = os.path.join(COMFY, "output", "pulse_gate", folder, f"{n}_00001_.png")
        dst_name = f"pulse_gate/up_{n}.png"
        shutil.copyfile(src, os.path.join(COMFY, "input", dst_name))
        pid = call("/prompt", {"prompt": graph(jobs[n], dst_name, denoise), "client_id": str(uuid.uuid4())})["prompt_id"]
        pend[pid] = n
    print(f"{len(pend)}개 넣음 (denoise {denoise})", flush=True)
    t0 = time.time()
    while pend:
        time.sleep(3)
        for pid in list(pend):
            h = call(f"/history/{pid}")
            if pid in h:
                if h[pid].get("status", {}).get("status_str") == "error":
                    print("오류", pend.pop(pid), flush=True)
                    continue
                imgs = [i for o in h[pid].get("outputs", {}).values() for i in o.get("images", [])]
                if imgs:
                    print(f"{pend.pop(pid)} {time.time() - t0:.0f}초 -> {imgs[0]['subfolder']}/{imgs[0]['filename']}", flush=True)
