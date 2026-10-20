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
    # 컷 7 다시(10-19, 사람 작게 · 왼쪽): GPU 틈이 짧아 124프레임을 모두 먼저 키우고(7b전체), 구간은 영상을 본 뒤 7b에 적는다
    "7b": ("컷7b_s42_끝고정.mp4", 48, 72),
    "7b전체": ("컷7b_s42_끝고정.mp4", 0, 124),
    "C": ("훅C_s42.mp4", 24, 48),  # 1.0초부터: 수건을 댄 채 내려다봄 → 1.75초 깜빡 → 2.0초부터 렌즈를 봄, 손·수건 거의 그대로
}
NAMES = {"1": "컷1", "3": "컷3", "4": "컷4", "5": "컷5", "7": "컷7", "7b": "컷7b", "7b전체": "컷7b_전체", "C": "훅C"}
# 세트 2(10-19, 새 욕실로 전체 다시): 처음 구간은 v3c와 같은 자리로 두고, 뽑은 영상을 본 뒤 고친다
# 7s2(10-19 영상 봄): 화면 밀림 1.2px 이하, 0.5초 깜빡 → 1.0초부터 입 다문 반달 눈웃음 → 3.25초 깜빡 → 3.5초부터 옅은 미소.
#   이는 한 번도 안 보임. 엔드카드(구간 2.0초)에 웃음이 머물고 3.25초 깜빡임 전에 끝나는 0~72
# 4s2: 0.75~2.0초에 시작 그림에 없던 올리브 가지가 오른쪽에 자라나듯 생긴다(H3가 지어냄, 화면은 안 밀림) → 다 생긴 뒤 48~95
#   (눈은 이미 내린 채 머문다). 「새로 생기는 것 없음」 지시문 + 시드 7(10-20)도 1.0~2.25초에 같은 자리에 가지 · 흰 꽃병을 지어내
#   → 시드 42 48~95를 키운 뒤 컷4_가지지우기.py로 그 자리만 0번 프레임(가지 전) 벽 · 수건으로 덮었다(원본은 업/컷4_세트2/원본_가지있음)
# 5s2: 0.75~0.83초 깜빡 → 1.0초에 눈이 다 뜬다. 1.0~3.0초 턱이 아주 조금 들리는 들숨, 입은 내내 다묾, 튀는 프레임 없음 → 24~71 그대로
# Cs2: 0~0.75초 수건을 댄 채 내려다봄(0~0.7초는 거의 정지) → 0.83~1.0초 천천히 눈 감음 → 1.25초 뜨며 렌즈 → 1.5초부터 렌즈를 본 채
#   머문다(3.0초부터 고개가 살짝 기울기 시작). 손 · 수건 그대로, 입 다묾. 24부터면 첫 프레임이 감은 눈이라
#   12~59: 첫 0.2초만 정지 → 내려다봄 → 0.5초 감음 → 0.8초 렌즈 → 1.2초 동안 눈 맞춤(훅 글자 읽는 동안)
# 3s2: 0~1.7초에 화면이 51px(6.7%) 옆으로 밀리고(차츰 느려짐) 멈춘다 — 끝 창 그대로. 솜 · 수건 · 올리브 · 창 빛 그대로 → 0~47
for _c, (_start, _n) in {"1": (6, 48), "3": (0, 48), "4": (48, 48), "5": (24, 48), "7": (0, 72), "C": (12, 48)}.items():
    NAMES[_c + "s2"] = NAMES[_c] + "_세트2"
    WINDOWS[_c + "s2"] = (f"{NAMES[_c]}_세트2_s42{'_끝고정' if _c == '7' else ''}.mp4", _start, _n)


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


# 손에 든 병(10-20, 영상_H3.py 7hs2 · H3_LAST=1). 시드 42는 0.75~2.75초에 머리가 움직이고 한쪽 눈을 감으며 이를 보이고 웃었고
# (「입 다문 미소」 어김), 72~77번은 손 · 병이 제자리로 돌아오는 중이다(병 자리 앞뒤 차 1.5~3.7). 78번부터는 가만하다(0.01~0.7).
# → 76~123번 48장(12.0~14.0초) + 마지막 장(끝 고정 = 시작 그림)을 24번 되풀이(14.0~15.0초, 로고가 떠오를 때 멈춘 화면).
# 실제로는 아래 7hs2전체(124장)를 키운 폴더에서 synk-vendor/…/영상_H3/손_사슬_이어.py가 72장으로 옮겼다. 이 칸만 다시 돌리면
# 48장이라 편집 · 마스크(프레임 i ↔ 마스크 i, 72장)가 48번째에서 멈춘다 — 다시 뽑을 땐 손_사슬_이어.py처럼 72장을 채운다
NAMES["7hs2"] = "컷7손_세트2"
WINDOWS["7hs2"] = ("컷7손_세트2_s42_끝고정.mp4", 76, 48)
# GPU 틈(다른 세션 LoRA 학습 사이)이 짧아 124장을 모두 키워 두고, 구간은 영상을 본 뒤 그 폴더에서 72장을 골라 옮긴다
NAMES["7hs2전체"] = "컷7손_세트2_전체"
WINDOWS["7hs2전체"] = ("컷7손_세트2_s42_끝고정.mp4", 0, 124)

ASCII = r"C:\SYNK-LoRA\work\jiyu_up"  # SeedVR2(cv2.imwrite)는 한글 경로에 PNG를 못 쓴다 — 「저장함」이라고만 남기고 0장(10-19)
ASCII_NAME = {"1": "cut1", "3": "cut3", "4": "cut4", "5": "cut5", "7": "cut7", "7b": "cut7b", "7b전체": "cut7b_all", "C": "hookC",
              "1s2": "cut1_s2", "3s2": "cut3_s2", "4s2": "cut4_s2", "5s2": "cut5_s2", "7s2": "cut7_s2", "Cs2": "hookC_s2",
              "7hs2": "cut7h_s2", "7hs2전체": "cut7h_s2_all"}


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
