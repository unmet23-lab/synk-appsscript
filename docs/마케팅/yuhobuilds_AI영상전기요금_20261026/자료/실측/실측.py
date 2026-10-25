# 로컬 AI 영상 한 편(글 한 줄 → 5초 영상 + 소리, MiniMax H3 공개판)을 이 노트북에서 만드는 동안 전력을 1초마다 잰다.
#   GPU: nvidia-smi power.draw(그래픽카드 보드 전체) · CPU: 윈도우 Energy Meter(RAPL 패키지) — 화면 · 메모리 · 저장장치 · 팬 ·
#   충전기 손실은 재지 않는다. 다른 세션이 CPU를 쓰면 CPU 값에 섞인다(GPU는 compute 프로세스 목록으로 확인).
#   설정은 h3_로컬.py(synk-vendor/harin-iced-coffee-h3-20261017/비교)와 같다 — res_multistep · simple · BasicGuider, 20단계,
#   768×1344, 124프레임(5.17초) · 24fps, 터보 LoRA 없음. 시작 그림 없이 글만 넣는다(t2va).
# 사용: ComfyUI를 8190에 띄운 뒤  python -X utf8 실측.py <cat|coffee|dog>   → 기록_<이름>.csv · 요약_<이름>.json · <이름>.mp4
import csv
import ctypes
import json
import os
import shutil
import subprocess
import sys
import threading
import time
import urllib.request
import uuid

HERE = os.path.dirname(os.path.abspath(__file__))
COMFY = "http://127.0.0.1:8190"
COMFY_DIR = r"C:\SYNK-LoRA\tools\ComfyUI"
STEPS, SEED, FRAMES, W, H = 20, 42, 124, 768, 1344
IDLE_BEFORE, IDLE_AFTER = 60, 30
PROMPTS = {
    "cat": (
        "A fluffy orange tabby cat sits on a wooden windowsill on a rainy afternoon. "
        "The cat slowly opens its mouth in a big yawn, then stretches its front paws forward and blinks sleepily. "
        "Raindrops run down the window glass behind it, soft warm indoor lamp light, cozy room, shallow depth of field. "
        "Static camera, vertical framing. Sound: gentle rain tapping on the glass and a soft purr."
    ),
    # 같은 숫자가 되풀이되는지 보는 둘째 판(10-26) — 다른 장면 · 같은 설정
    "coffee": (
        "Close-up of a white ceramic cup of hot coffee on a wooden cafe table by a sunny window in the morning. "
        "A barista's hand slowly pours steamed milk into the coffee, drawing a heart of latte art, then pulls away. "
        "Soft steam rises, warm sunlight, shallow depth of field. "
        "Static camera, vertical framing. Sound: quiet cafe ambience and the soft pour of milk."
    ),
    # 가져갈 요청문 시험(10-26) — 새 하위 에이전트가 요청문대로 재는 동안 같은 설정으로 하나 더
    "dog": (
        "A small white puppy sits on a soft rug in a sunny living room, tilts its head curiously, "
        "then wags its tail and trots one step toward the camera. Warm afternoon light, shallow depth of field. "
        "Static camera, vertical framing. Sound: a happy little bark and soft paws on the rug."
    ),
}
PROMPT = PROMPTS["cat"]

samples = {"gpu": [], "cpu": [], "apps": []}
stop = threading.Event()


def gpu_reader():
    p = subprocess.Popen(["nvidia-smi", "--query-gpu=power.draw,utilization.gpu,memory.used,clocks.gr",
                          "--format=csv,noheader,nounits", "-lms", "1000"],
                         stdout=subprocess.PIPE, text=True, bufsize=1)
    for line in p.stdout:
        if stop.is_set():
            break
        parts = [x.strip() for x in line.split(",")]
        try:
            samples["gpu"].append((time.time(), float(parts[0]), float(parts[1]), float(parts[2]), float(parts[3])))
        except (ValueError, IndexError):
            pass
    p.kill()


def cpu_reader():
    p = subprocess.Popen(["typeperf", r"\Energy Meter(rapl_package0_pkg)\Power", "-si", "1"],
                         stdout=subprocess.PIPE, text=True, bufsize=1, encoding="cp949", errors="replace")
    for line in p.stdout:
        if stop.is_set():
            break
        parts = [x.strip().strip('"') for x in line.split('","')]
        if len(parts) == 2:
            try:
                samples["cpu"].append((time.time(), float(parts[1].rstrip('"')) / 1000.0))  # mW → W
            except ValueError:
                pass
    p.kill()


def apps_reader():
    while not stop.is_set():
        out = subprocess.run(["nvidia-smi", "--query-compute-apps=pid,process_name,used_memory", "--format=csv,noheader"],
                             capture_output=True, text=True).stdout.strip()
        samples["apps"].append((time.time(), out))
        stop.wait(30)


def post(path, data):
    req = urllib.request.Request(COMFY + path, data=json.dumps(data).encode("utf-8"), headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=60))


def get(path):
    return json.load(urllib.request.urlopen(COMFY + path, timeout=60))


def graph(name):
    return {
        "1": {"class_type": "UNETLoader", "inputs": {"unet_name": "minimax_h3_fl2va_pruned_int8_convrot.safetensors", "weight_dtype": "default"}},
        "2": {"class_type": "CLIPLoader", "inputs": {"clip_name": "qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors", "type": "minimax", "device": "default"}},
        "3": {"class_type": "VAELoader", "inputs": {"vae_name": "minimax_h3_video_vae_int8_convrot.safetensors"}},
        "4": {"class_type": "VAELoader", "inputs": {"vae_name": "minimax_h3_audio_vae_fp32.safetensors"}},
        "6": {"class_type": "MiniMaxH3ImageToVideo", "inputs": {"clip": ["2", 0], "vae": ["3", 0], "prompt": PROMPT,
                                                                 "width": W, "height": H, "length": FRAMES}},
        "7": {"class_type": "RandomNoise", "inputs": {"noise_seed": SEED}},
        "8": {"class_type": "KSamplerSelect", "inputs": {"sampler_name": "res_multistep"}},
        "9": {"class_type": "BasicScheduler", "inputs": {"model": ["1", 0], "scheduler": "simple", "steps": STEPS, "denoise": 1.0}},
        "10": {"class_type": "BasicGuider", "inputs": {"model": ["1", 0], "conditioning": ["6", 0]}},
        "11": {"class_type": "SamplerCustomAdvanced", "inputs": {"noise": ["7", 0], "guider": ["10", 0], "sampler": ["8", 0],
                                                                  "sigmas": ["9", 0], "latent_image": ["6", 1]}},
        "12": {"class_type": "VAEDecode", "inputs": {"samples": ["11", 0], "vae": ["3", 0]}},
        "13": {"class_type": "VAEDecodeAudio", "inputs": {"samples": ["11", 0], "vae": ["4", 0]}},
        "14": {"class_type": "CreateVideo", "inputs": {"images": ["12", 0], "audio": ["13", 0], "fps": 24}},
        "15": {"class_type": "SaveVideo", "inputs": {"video": ["14", 0], "filename_prefix": f"y7/{name}", "format": "auto", "codec": "auto"}},
    }


def energy_wh(series, t0, t1, idx=1):
    pts = [(t, s[idx]) for s in series for t in [s[0]] if t0 <= t <= t1]
    wh = 0.0
    for (ta, pa), (tb, pb) in zip(pts, pts[1:]):
        wh += (pa + pb) / 2 * (tb - ta) / 3600.0
    avg = sum(p for _, p in pts) / len(pts) if pts else 0
    peak = max((p for _, p in pts), default=0)
    return {"Wh": round(wh, 3), "평균W": round(avg, 1), "최대W": round(peak, 1), "표본": len(pts)}


def log(msg):
    print(f"{time.strftime('%H:%M:%S')} {msg}", flush=True)


def main():
    global PROMPT
    name = sys.argv[1] if len(sys.argv) > 1 else "cat"
    PROMPT = PROMPTS[name]
    ctypes.windll.kernel32.SetThreadExecutionState(0x80000000 | 0x00000001)  # 재는 동안 잠자기 막기(이 프로세스만)
    for fn in (gpu_reader, cpu_reader, apps_reader):
        threading.Thread(target=fn, daemon=True).start()
    log(f"쉬는 {IDLE_BEFORE}초")
    time.sleep(IDLE_BEFORE)
    t_idle0, t_start = time.time() - IDLE_BEFORE + 2, time.time()
    pid = post("/prompt", {"prompt": graph(name), "client_id": str(uuid.uuid4())})["prompt_id"]
    log(f"넣음 {pid}")
    out_file = None
    while True:
        time.sleep(2)
        h = get(f"/history/{pid}")
        if pid not in h:
            continue
        st = h[pid].get("status", {})
        if st.get("status_str") == "error":
            log("오류 " + json.dumps(st.get("messages"), ensure_ascii=False)[:2000])
            break
        files = [f for o in h[pid].get("outputs", {}).values() for k in ("images", "videos", "gifs") for f in o.get(k, [])]
        if files:
            f = files[0]
            out_file = os.path.join(COMFY_DIR, "output", f.get("subfolder", ""), f["filename"])
            break
    t_end = time.time()
    log(f"끝 {t_end - t_start:.0f}초")
    time.sleep(IDLE_AFTER)
    stop.set()
    time.sleep(2)
    if out_file:
        shutil.copyfile(out_file, os.path.join(HERE, f"{name}.mp4"))
    with open(os.path.join(HERE, f"기록_{name}.csv"), "w", newline="", encoding="utf-8") as fp:
        w = csv.writer(fp)
        w.writerow(["시각", "구분", "W", "GPU사용률", "VRAM_MiB", "클럭MHz"])
        for s in samples["gpu"]:
            w.writerow([round(s[0] - t_start, 2), "gpu", s[1], s[2], s[3], s[4]])
        for s in samples["cpu"]:
            w.writerow([round(s[0] - t_start, 2), "cpu", round(s[1], 2), "", "", ""])
    summary = {
        "이름": name, "지시문": PROMPT, "설정": {"steps": STEPS, "seed": SEED, "frames": FRAMES, "size": f"{W}x{H}", "fps": 24},
        "시작": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(t_start)),
        "걸린초": round(t_end - t_start, 1),
        "만드는동안": {"gpu": energy_wh(samples["gpu"], t_start, t_end), "cpu": energy_wh(samples["cpu"], t_start, t_end)},
        "쉴때": {"gpu": energy_wh(samples["gpu"], t_idle0, t_start), "cpu": energy_wh(samples["cpu"], t_idle0, t_start)},
        "GPU프로세스": [a for a in samples["apps"] if a[1]],
        "결과": out_file,
    }
    with open(os.path.join(HERE, f"요약_{name}.json"), "w", encoding="utf-8") as fp:
        json.dump(summary, fp, ensure_ascii=False, indent=2)
    log(json.dumps(summary["만드는동안"], ensure_ascii=False))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
