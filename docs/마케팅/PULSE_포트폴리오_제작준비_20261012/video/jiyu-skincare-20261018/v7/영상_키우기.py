# 지유 광고 v7 · 생성 영상(Flow Omni 720×1280 · 24fps)에서 프레임 구간을 잘라 로컬 SeedVR2-3B fp16으로 1080×1920까지 키운다.
# 방법 · 설정은 v6 미소 판(../영상_다듬기.py upscale)과 같다: batch 33 · 균일 배치 · 시간 겹침 3 · VAE 타일, 시드 42.
#   python 영상_키우기.py <입력 mp4> <시작 프레임> <프레임 수> <이름> [배치 크기, 기본 33]
#   배치가 프레임 수보다 작으면 배치 이음새(33장 · 겹침 3이면 30~32번)에서 한 장이 흐려진다(10-21 Fable: 컷 7 10.46초) —
#   컷에 쓸 구간만 프레임 수 이상인 4n+1 배치 하나로 키운다(36장이면 37).
#   → Documents/synk-vendor/jiyu-skincare-20261018/v7/영상/업/<이름>/<이름>_000000.png …  (가편집.py가 컷 이름으로 읽는다)
# SeedVR2(cv2.imwrite)는 한글 경로에 PNG를 못 써서(현장 노트) 영문 작업 폴더에서 돌리고 옮긴다.
import glob
import os
import shutil
import subprocess
import sys
import time

sys.stdout.reconfigure(encoding="utf-8")
V = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "jiyu-skincare-20261018", "v7", "영상")
UP = os.path.join(V, "업")
COMFY_DIR = r"C:\SYNK-LoRA\tools\ComfyUI"
WORK = r"C:\SYNK-LoRA\work\jiyu_v7_up"
FPS = 24


def main():
    src, start, n, name = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
    batch = int(sys.argv[5]) if len(sys.argv) > 5 else 33
    os.makedirs(WORK, exist_ok=True)
    tag = "clip_" + time.strftime("%H%M%S")
    a_src = os.path.join(WORK, f"{tag}.mp4")
    subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", src,
                    "-vf", f"select='between(n\\,{start}\\,{start + n - 1})',setpts=N/{FPS}/TB",
                    "-an", "-r", str(FPS), "-c:v", "libx264", "-crf", "10", "-pix_fmt", "yuv420p", a_src],
                   check=True, stdin=subprocess.DEVNULL)
    a_out = os.path.join(WORK, tag)
    env = {**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONPATH": r"C:\SYNK-LoRA\tools\seedvr2-extra"}
    t0 = time.time()
    os.makedirs(UP, exist_ok=True)
    with open(os.path.join(UP, f"{name}.log"), "w", encoding="utf-8") as log:
        r = subprocess.run([os.path.join(COMFY_DIR, "venv", "Scripts", "python.exe"), "-X", "utf8",
                            "custom_nodes/ComfyUI-SeedVR2_VideoUpscaler/inference_cli.py", a_src.replace("\\", "/"),
                            "--output", a_out.replace("\\", "/"), "--output_format", "png",
                            "--dit_model", "seedvr2_ema_3b_fp16.safetensors", "--resolution", "1080",
                            "--batch_size", str(batch), "--seed", "42", "--attention_mode", "sdpa", "--uniform_batch_size",
                            "--temporal_overlap", "3", "--vae_encode_tiled", "--vae_decode_tiled"],
                           cwd=COMFY_DIR, env=env, stdout=log, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL)
    frames = sorted(glob.glob(os.path.join(a_out, "**", "*.png"), recursive=True))
    out = os.path.join(UP, name)
    if os.path.isdir(out):   # 같은 이름으로 다시 키우면 앞 판은 지우지 않고 이름을 바꿔 둔다(섞이지 않게)
        os.rename(out, f"{out}_옛_{time.strftime('%H%M%S')}")
    os.makedirs(out)
    for i, f in enumerate(frames):
        shutil.move(f, os.path.join(out, f"{name}_{i:06d}.png"))
    print(f"{name} 업스케일 rc={r.returncode} {time.time() - t0:.0f}초 · {len(frames)}장 → {out}", flush=True)
    sys.exit(0 if r.returncode == 0 and frames else 1)


if __name__ == "__main__":
    main()
