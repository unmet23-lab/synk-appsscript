# 지유 스킨케어 광고 · H3 영상(768×1344, 124프레임)에서 컷 길이만큼 구간을 골라 9:16(756×1344)로 자르고
# 로컬 SeedVR2-3B fp16으로 1080×1920까지 키운다(브리프 1절 업스케일).
#   python 영상_다듬기.py 1 4 ...      → Documents/synk-vendor/jiyu-skincare-20261018/영상_H3/업/<컷>/0001.png …
#   python 영상_다듬기.py --자르기만 1  → 구간만 잘라 영상_H3/구간/<컷>.mp4 (업스케일 전 확인용)
# SeedVR2는 ComfyUI 노드의 CLI를 따로 돌린다(현장 노트 영상_ffmpeg_자막.md 「ComfyUI 노드 패키지를 남이 쓰는 ComfyUI 환경에 깔지 않고」).
# 설정은 10-18 다른 세션이 1080p 영상에 쓴 것과 같다: batch 33 · 균일 배치 · 시간 겹침 3 · VAE 타일.
import os
import subprocess
import sys
import time

V = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "jiyu-skincare-20261018")
SRC = os.path.join(V, "영상_H3")
CUTDIR = os.path.join(SRC, "구간")
UP = os.path.join(SRC, "업")
COMFY_DIR = r"C:\SYNK-LoRA\tools\ComfyUI"
FPS = 24

# 컷: (H3 영상 이름, 시작 프레임, 프레임 수) — 시작 프레임은 뽑은 영상을 보고 고른다(동작이 콘티 2초 안에 들어오게)
WINDOWS = {
    "1": ("컷1_s42.mp4", 0, 48),
    "3": ("컷3_s42.mp4", 0, 48),   # 끝 창을 48프레임에 못 박았으므로 0부터
    "4": ("컷4_s42.mp4", 0, 48),
    "5": ("컷5_s42.mp4", 0, 48),
    "7": ("컷7_s42.mp4", 0, 72),   # 엔드카드 3초
    "C": ("훅C_s42.mp4", 0, 48),
}
NAMES = {"1": "컷1", "3": "컷3", "4": "컷4", "5": "컷5", "7": "컷7", "C": "훅C"}


def cut(c):
    """구간을 잘라 가운데 756×1344(9:16)로 — 손실이 거의 없게 crf 10."""
    name, start, n = WINDOWS[c]
    os.makedirs(CUTDIR, exist_ok=True)
    out = os.path.join(CUTDIR, f"{NAMES[c]}.mp4")
    subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", os.path.join(SRC, name),
                    "-vf", f"select='between(n\\,{start}\\,{start + n - 1})',setpts=N/{FPS}/TB,crop=756:1344",
                    "-an", "-r", str(FPS), "-c:v", "libx264", "-crf", "10", "-pix_fmt", "yuv420p", out],
                   check=True, stdin=subprocess.DEVNULL)
    return out


def upscale(c, src):
    out = os.path.join(UP, NAMES[c])
    os.makedirs(UP, exist_ok=True)
    env = {**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONPATH": r"C:\SYNK-LoRA\tools\seedvr2-extra"}
    t0 = time.time()
    with open(os.path.join(UP, f"{NAMES[c]}.log"), "w", encoding="utf-8") as log:
        r = subprocess.run([os.path.join(COMFY_DIR, "venv", "Scripts", "python.exe"), "-X", "utf8",
                            "custom_nodes/ComfyUI-SeedVR2_VideoUpscaler/inference_cli.py", src.replace("\\", "/"),
                            "--output", out.replace("\\", "/"), "--output_format", "png",
                            "--dit_model", "seedvr2_ema_3b_fp16.safetensors", "--resolution", "1080",
                            "--batch_size", "33", "--seed", "42", "--attention_mode", "sdpa", "--uniform_batch_size",
                            "--temporal_overlap", "3", "--vae_encode_tiled", "--vae_decode_tiled"],
                           cwd=COMFY_DIR, env=env, stdout=log, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL)
    print(f"{NAMES[c]} 업스케일 rc={r.returncode} {time.time() - t0:.0f}초 → {out}", flush=True)
    return r.returncode == 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    args = sys.argv[1:]
    only_cut = "--자르기만" in args
    for c in [a for a in args if not a.startswith("--")]:
        src = cut(c)
        print(f"{NAMES[c]} 구간 → {src}", flush=True)
        if not only_cut:
            upscale(c, src)
