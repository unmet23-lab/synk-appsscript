# 지유 스킨케어 광고 · H3 영상(768×1344, 124프레임)에서 컷 길이만큼 구간을 골라 9:16(756×1344)로 자르고
# 로컬 SeedVR2-3B fp16으로 1080×1920까지 키운다(브리프 1절 업스케일).
#   python 영상_다듬기.py 1 4 ...      → Documents/synk-vendor/jiyu-skincare-20261018/영상_H3/업/<컷>/<컷>/<컷>_000000.png …
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
    # 시드 42는 1.5~2.75초에 입술이 벌어져 윗니가 보였다(내레이션과 겹쳐 말하는 입) → 시드 7: 0.5~1.0초에 시선을 들고 입은 다문 채
    # 10-19 Fable: 첫 12프레임(0.5초)이 완전 정지 → 6프레임 뒤에서 시작
    "1": ("컷1_s7.mp4", 6, 48),
    "3": ("컷3_s42.mp4", 0, 48),   # 끝 창을 48프레임에 못 박았으므로 0부터
    "4": ("컷4_s42.mp4", 30, 48),  # 손·솜은 끝까지 그대로, 뜬 눈이 2.0~2.5초에 내려감 → 1.25초부터(뜬 눈 0.75초 → 내림 → 내린 눈)
    "5": ("컷5_s42.mp4", 24, 48),  # 0.67초 깜빡임 뒤부터: 1.0~2.0초 턱이 살짝 들리는 들숨 → 2.7초부터 내려앉음, 입·코 그대로
    # 엔드카드 3초. 시드 42는 「locked-off」에도 0~1.5초에 화면이 밀려 병·글자 자리가 줄었다 → 끝 프레임에도 시작 그림을 넣은
    # 고정판(H3_LAST=1): 틀은 ±3% 안. 1.25초에 이가 보이게 웃고 1.5~1.75초에 입이 벌어져, 입 다문 미소로 머무는 2.0~5.0초를 쓴다
    "7": ("컷7_s42_끝고정.mp4", 48, 72),
    "C": ("훅C_s42.mp4", 24, 48),  # 1.0초부터: 수건을 댄 채 내려다봄 → 1.75초 깜빡 → 2.0초부터 렌즈를 봄, 손·수건 거의 그대로
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


ASCII = r"C:\SYNK-LoRA\work\jiyu_up"  # SeedVR2(cv2.imwrite)는 한글 경로에 PNG를 못 쓴다 — 「저장함」이라고만 남기고 0장(10-19)
ASCII_NAME = {"1": "cut1", "3": "cut3", "4": "cut4", "5": "cut5", "7": "cut7", "C": "hookC"}


def upscale(c, src):
    """영문 경로에서 돌리고(입력도 영문 이름으로 복사) 결과 PNG를 업/<컷>/<컷>/<컷>_000000.png로 옮긴다."""
    import glob
    import shutil
    an = ASCII_NAME[c]
    os.makedirs(ASCII, exist_ok=True)
    a_src = os.path.join(ASCII, f"{an}.mp4")
    shutil.copyfile(src, a_src)
    a_out = os.path.join(ASCII, an)
    env = {**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONPATH": r"C:\SYNK-LoRA\tools\seedvr2-extra"}
    t0 = time.time()
    os.makedirs(UP, exist_ok=True)
    with open(os.path.join(UP, f"{NAMES[c]}.log"), "w", encoding="utf-8") as log:
        r = subprocess.run([os.path.join(COMFY_DIR, "venv", "Scripts", "python.exe"), "-X", "utf8",
                            "custom_nodes/ComfyUI-SeedVR2_VideoUpscaler/inference_cli.py", a_src.replace("\\", "/"),
                            "--output", a_out.replace("\\", "/"), "--output_format", "png",
                            "--dit_model", "seedvr2_ema_3b_fp16.safetensors", "--resolution", "1080",
                            "--batch_size", "33", "--seed", "42", "--attention_mode", "sdpa", "--uniform_batch_size",
                            "--temporal_overlap", "3", "--vae_encode_tiled", "--vae_decode_tiled"],
                           cwd=COMFY_DIR, env=env, stdout=log, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL)
    frames = sorted(glob.glob(os.path.join(a_out, "**", "*.png"), recursive=True))
    out = os.path.join(UP, NAMES[c], NAMES[c])
    os.makedirs(out, exist_ok=True)
    for i, f in enumerate(frames):
        shutil.move(f, os.path.join(out, f"{NAMES[c]}_{i:06d}.png"))
    print(f"{NAMES[c]} 업스케일 rc={r.returncode} {time.time() - t0:.0f}초 · {len(frames)}장 → {out}", flush=True)
    return r.returncode == 0 and len(frames) > 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    args = sys.argv[1:]
    only_cut = "--자르기만" in args
    for c in [a for a in args if not a.startswith("--")]:
        src = cut(c)
        print(f"{NAMES[c]} 구간 → {src}", flush=True)
        if not only_cut:
            upscale(c, src)
