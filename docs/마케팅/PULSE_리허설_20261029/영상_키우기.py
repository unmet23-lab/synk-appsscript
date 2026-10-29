# 리허설(10-29) · Flow Omni 720×1280 판에서 컷에 쓸 구간만 잘라 로컬 SeedVR2-3B fp16으로 1080×1920까지 키운다(크레딧 0).
# 지유 v7 영상_키우기.py와 같은 설정(4n+1 배치 하나 · 균일 배치 · 시간 겹침 3 · VAE 타일 · 시드 42)을 옮겼다.
# Flow 줄의 「다운로드」는 메뉴 없이 720p 원본만 주고(10-29 r_round-03 — 받은 「1080p」가 720p와 바이트까지 같음), 상세 화면의
# 「1080p 업스케일링됨」도 720p가 떨어진 적이 있어(현장노트 10-19) 지유 v7처럼 로컬로 키운다.
# 10-29: 61장 배치 하나는 24GB를 다 채워 DiT 단계에서 죽었다(rc 0xC0000409). 지유가 쓴 37장 배치로 조각을 내고,
#        조각끼리 OV장을 겹쳐 그 구간을 선형으로 섞는다(배치 이음새 한 장 흐림을 피하려 한 실행 안에서 배치를 나누지 않는다).
#   python -X utf8 영상_키우기.py <id> <시작 초> <장 수>   → 작업 폴더 영상/받음/<id>_up.mp4(24fps, CRF 10, 그 구간만)
import glob
import os
import shutil
import subprocess
import sys
import time

import numpy as np
from PIL import Image

sys.stdout.reconfigure(encoding="utf-8")
작업 = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-rehearsal-20261029", "영상", "받음")
COMFY = r"C:\SYNK-LoRA\tools\ComfyUI"
WORK = r"C:\SYNK-LoRA\work\pulse_rehearsal_up"  # SeedVR2(cv2.imwrite)는 한글 경로에 못 쓴다(현장 노트)
FPS, CH, OV = 24, 37, 8


def run(cid, k, src, start, n):
    clip = os.path.join(WORK, f"{cid}_{k}.mp4")
    subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", src,
                    "-vf", f"select='between(n\\,{start}\\,{start + n - 1})',setpts=N/{FPS}/TB", "-an", "-r", str(FPS),
                    "-c:v", "libx264", "-crf", "10", "-pix_fmt", "yuv420p", clip], check=True, stdin=subprocess.DEVNULL)
    out = os.path.join(WORK, f"{cid}_{k}")
    if os.path.isdir(out):
        shutil.rmtree(out)
    env = {**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONPATH": r"C:\SYNK-LoRA\tools\seedvr2-extra"}
    with open(os.path.join(WORK, f"{cid}_{k}.log"), "w", encoding="utf-8") as log:
        r = subprocess.run([os.path.join(COMFY, "venv", "Scripts", "python.exe"), "-X", "utf8",
                            "custom_nodes/ComfyUI-SeedVR2_VideoUpscaler/inference_cli.py", clip.replace("\\", "/"),
                            "--output", out.replace("\\", "/"), "--output_format", "png",
                            "--dit_model", "seedvr2_ema_3b_fp16.safetensors", "--resolution", "1080",
                            "--batch_size", str(n + (4 - (n - 1) % 4) % 4), "--seed", "42", "--attention_mode", "sdpa",
                            "--uniform_batch_size", "--temporal_overlap", "3", "--vae_encode_tiled", "--vae_decode_tiled"],
                           cwd=COMFY, env=env, stdout=log, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL)
    frames = sorted(glob.glob(os.path.join(out, "**", "*.png"), recursive=True))
    if r.returncode or len(frames) < n:
        raise SystemExit(f"{cid} 조각 {k} 실패 rc={r.returncode} {len(frames)}/{n}장 — {WORK}\\{cid}_{k}.log")
    return frames[:n]


def main():
    cid, t0, n = sys.argv[1], float(sys.argv[2]), int(sys.argv[3])
    start = round(t0 * FPS)
    os.makedirs(WORK, exist_ok=True)
    src = os.path.join(작업, f"{cid}_a.mp4")
    # 조각: [0, CH) · 그다음은 앞 조각과 OV장 겹치게, 마지막 조각은 끝에 맞춘다
    starts, s = [0], 0
    while s + CH < n:
        s = min(s + CH - OV, n - CH)
        starts.append(s)
    t = time.time()
    parts = [(a, run(cid, k, src, start + a, min(CH, n - a))) for k, a in enumerate(starts)]
    acc = np.zeros((n, 1920, 1080, 3), np.float32)
    wsum = np.zeros((n, 1, 1, 1), np.float32)
    for k, (a, frames) in enumerate(parts):
        m = len(frames)
        w = np.ones(m, np.float32)
        if k > 0:
            w[:OV] = np.linspace(0, 1, OV + 2)[1:-1]  # 앞 조각과 겹친 자리는 0 → 1
        if k < len(parts) - 1:
            nxt = parts[k + 1][0]
            ov = a + m - nxt
            w[m - ov:] = np.minimum(w[m - ov:], np.linspace(1, 0, ov + 2)[1:-1])
        for i, f in enumerate(frames):
            im = np.asarray(Image.open(f).convert("RGB").resize((1080, 1920), Image.LANCZOS), np.float32)
            acc[a + i] += im * w[i]
            wsum[a + i] += w[i]
    vid = (acc / np.maximum(wsum, 1e-6)).clip(0, 255).astype(np.uint8)
    dest = os.path.join(작업, f"{cid}_up.mp4")
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", "1080x1920", "-r", str(FPS),
                            "-i", "-", "-c:v", "libx264", "-crf", "10", "-pix_fmt", "yuv420p", dest], stdin=subprocess.PIPE)
    enc.stdin.write(vid.tobytes())
    enc.stdin.close()
    enc.wait()
    print(f"{cid} 키움 {time.time() - t:.0f}초 · 조각 {len(parts)}개({starts}) · {n}장 → {dest}", flush=True)


if __name__ == "__main__":
    main()
