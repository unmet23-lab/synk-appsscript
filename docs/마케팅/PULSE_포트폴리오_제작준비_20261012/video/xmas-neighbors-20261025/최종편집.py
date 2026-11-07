# 시즌 1 「옆집의 크리스마스」 최종 편집(2026-11-07, Claude) — 02_콘티 2절 36컷을 그 초 그대로 하드컷으로 잇고, 후반 글자(간판 · 1+1 · 배터리 · 봉투)를
# 장면에 붙이고, 소리(목소리 · 효과음 · 바탕 · 곡)를 놓고, 자막 · 끝 글은 Remotion(자막시안_20261103/remotion의 s1)으로 굽는다. 후보정 없음(결정 10-24).
#   python -X utf8 최종편집.py [화면] [소리] [판] [반초]   → git 밖 pulse-portfolio12-20261024/최종/s1/옆집의크리스마스_16x9.mp4 · _폰.mp4 · _반초.jpg
# 판(받은 영상)은 git 밖 pulse-seedance-day-20261028/받음. 컷마다 쓸 판 · 그 판의 시작 장은 아래 CUTS(장 번호는 그 판의 실제 장 — 드리미나 판은 머리가 60이라
# 실제 장으로 센다). 15 · 34는 첫 · 끝 프레임 판 세 벌이 모두 4장마다 같은 장을 되풀이해(초당 6번 걸림) 옴니 참고로 다시 낸 판(s1-15m · s1-34m)을 쓴다.
import os
import shutil
import subprocess
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, HERE)
import 최종편집공통 as C   # noqa: E402
import 후반글자 as G   # noqa: E402

ROOT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024"
OUT = os.path.join(ROOT, "최종", "s1")
PUB = os.path.join(ROOT, "최종", "자막시안_public", "s1")
CAP = os.path.join(HERE, "..", "자막시안_20261103")
NAME = "옆집의크리스마스_16x9"
FPS, W, H = 24, 1920, 1080
# 컷 경계(02_콘티 2절) — 60.04초 · 36컷
T = [0.00, 3.56, 4.52, 5.88, 7.04, 8.64, 10.08, 11.88, 13.28, 15.00, 15.96, 17.40, 18.80, 20.00, 21.44, 22.76, 24.12, 24.60, 25.88, 28.44,
     30.76, 32.00, 33.36, 34.48, 35.92, 37.48, 38.88, 40.12, 42.88, 44.04, 46.44, 47.60, 49.68, 50.84, 53.84, 57.08, 60.04]
F = [round(t * FPS) for t in T]   # 컷 첫 장(화면 장 번호) — 마지막은 끝

# 컷 번호 → (판, 그 판에서 쓰기 시작하는 장, 후반 글자)
CUTS = {
    1: ("s1-01", 16, "간판"),      # 문간에서 긁다가 3.6~4.0초(판)에 열쇠 꾸러미가 떨어짐 — 화면 3.3초에 바닥(「응, 들어왔어」 뒤)
    2: ("s1-02", 35, None),        # 몇 달째 꺼진 등(나방이 든 채 식은 유리) — 판 37~41장에 한 번 번쩍. 컷 첫머리(0.08초)에 번쩍하고 0.5초에 식어 가운데 장부터는 꺼진 유리
                                   # (11-07 맹검 · 볼 이유 심사 두 번 「켜진 등으로 보임」 — 27장부터는 번쩍이 컷 가운데, 33장부터도 가운데 장이 식는 중)
    3: ("s1-03-04", 1, None),      # 폰을 보는 민재 · 복도 끝에서 리스를 걸다 돌아보며 웃는 502 할머니
    4: ("s1-03-04", 54, None),     # 샷 2(판 2.21초 컷) — 밤하늘 앞 옆 실루엣이 고개를 숙여 목례
    5: ("s1-05", 1, "봉투5"),      # 무릎을 굽혀 봉투를 내려놓음 · 카메라가 아래로
    6: ("s1-06", 2, None),         # 열쇠 끝이 구멍을 비껴 긁음
    7: ("s1-07-08", 1, None),      # 샷 1(판 1.84초 컷까지 꽉) — 어깨 너머 504 문간의 역광 셋
    8: ("s1-07-08", 46, None),     # 샷 2 — 504 문간 하린 · 친구 둘(뒷모습)
    9: ("s1-09-10", 1, None),      # 샷 1 — 고개를 젖혀 웃는 하린 역광 실루엣
    10: ("s1-09-10", 48, None),    # 샷 2 — 쏟아진 신발 · 스피커에 손(판 2.4초에 불빛이 바뀜 = 볼륨)
    11: ("s1-11", 1, None),        # 밤하늘 앞 검은 옆 실루엣
    12: ("s1-12", 12, "간판"),     # 반쯤 연 철문 틈으로 들어감(판 0.5초에 문이 열림)
    13: ("s1-13-14", 31, None),    # 샷 1 — 불 끈 부엌, 판 2.0초에 전자레인지 문을 엶
    14: ("s1-13-14", 63, "간판14"),  # 샷 2(판 2.55초 컷) — 창가 혼자 먹는 저녁 · 길 건너 늘켬
    15: ("s1-15m", 3, "상자15"),   # 옴니 판 — 첫 장이 그림과 달라 둘째 장 뒤부터 · 손에 든 전구 상자의 빨간 점에 1+1
    16: ("s1-16", 2, "봉투16"),
    17: ("s1-17", 1, "배터리"),
    18: ("s1-18", 1, None),
    19: ("s1-19", 1, None),
    20: ("s1-20", 1, "간판"),      # 화분 트리를 든 이웃 둘이 지나감
    21: ("s1-21", 38, "봉투21"),   # 봉투가 손목에서 미끄러지는 판 2.3~2.7초가 컷 안에
    22: ("s1-22", 36, None),       # 판 1.4초까지는 위 끝에 아랫입술 · 턱이 걸려 그 뒤부터(정한 것 ①)
    23: ("s1-23", 1, "봉투23"),    # 첫눈을 밟는 걸음 · 흔들리는 봉투
    24: ("s1-24", 1, None),
    25: ("s1-25", 1, None),
    26: ("s1-26", 1, "간판"),
    27: ("s1-27", 27, None),       # 판 2.0초에 폰 손전등이 켜짐 — 컷 끝 0.3초 앞
    28: ("s1-28", 1, "봉투28"),
    29: ("s1-29", 1, None),
    30: ("s1-30", 22, None),       # 아크로 바탕이 흐르며 올려다보다 입 다문 웃음(판 2.2초부터)
    31: ("s1-31", 44, None),       # 새 등 아래 폰을 귀에 댄 민재가 문을 엶(판 1.8~2.8초)
    32: ("s1-32", 7, "상자32"),    # 나방 붙은 옛 전구 · 1+1 상자 — 판 0.9초 손이 들어와 2.2초 옛 전구를 집음 · 모서리에 걸친 빨간 점의 앞면에 1+1
    33: ("s1-33", 37, "1+1봉투"),  # 끼운 전구가 판 64장째 켜짐 — 컷 마지막 장
    34: ("s1-34m", 6, None),       # 옴니 판 — 미소 · 눈 감음 · 1.3초부터 창 쪽으로 돎, 2.4초 뒤 입이 안 보임
    35: ("s1-35", 1, "간판"),      # 두 등 · 503 문이 닫힘
    36: ("s1-36", 1, "간판36"),    # 눈 오는 밤 거리 · 물러남
}


def frames_in(src, a, k):
    """판의 a장부터 k장을 1920×1080으로(lanczos — 색은 그대로)."""
    vf = f"select='between(n,{a},{a + k - 1})',scale={W}:{H}:flags=lanczos"
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-an", "-vf", vf, "-fps_mode", "passthrough", "-f", "rawvideo", "-pix_fmt", "bgr24", "-"],
                       capture_output=True, check=True)
    arr = np.frombuffer(r.stdout, np.uint8)
    n = arr.size // (W * H * 3)
    if n != k:
        raise SystemExit(f"{src}: {a}장부터 {k}장이어야 하는데 {n}장")
    return [arr[i * W * H * 3:(i + 1) * W * H * 3].reshape(H, W, 3).copy() for i in range(n)]


def frames_out(frames, out):
    p = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                          "-vf", "scale=out_color_matrix=bt709,format=yuv420p", "-c:v", "libx264", "-crf", "12", "-preset", "medium", "-r", str(FPS),
                          "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", out], stdin=subprocess.PIPE)
    for f in frames:
        p.stdin.write(f.tobytes())
    p.stdin.close()
    if p.wait():
        raise SystemExit(f"인코딩 실패 {out}")


def overlay(kind, frs):
    s = 1.5   # 판(1280) 좌표 → 화면(1920)
    if kind == "간판":
        return G.sign_fixed(frs)[0]
    if kind == "간판14":
        # 창 너머 얕은 초점 — 글자가 간판 테두리보다 또렷하면 붙인 티(11-07 Fable 「붙인 스티커」) → 테두리만큼 흐리고 빛 번짐을 넓힘
        return G.sign_moving(frs, near=(900, 220, 1900, 560), height_frac=0.56, blur=4.6, glow_sigma=12.0, glow=0.42)[0]
    if kind == "간판36":
        # 비스듬한 상자 간판의 앞면(판 좌표 TL 918,189 · TR 1229,133 · BR 1229,211 · BL 918,260) — 위아래 가장자리가 오른쪽으로 오른다(기울기 −0.17)
        cx, cy = 1073.5 * s, 199 * s
        out, info = G.sign_moving(frs, near=(1250, 120, 1920, 460), mode="sim", shear=-0.17, center=(cx, cy), height=40 * s, blur=1.4, glow_sigma=7.0)
        return out
    if kind == "배터리":
        return G.battery(frs, center=(686 * s, 318 * s), angle=11.5, width=54 * s)
    if kind.startswith("봉투"):
        # 봉투의 빈 호박빛 동그라미 — 33과 같은 흰 워드마크(11-07 Fable 맹검 「봉투 표식이 50.3초에만」)
        guess = {"봉투5": (675, 1000), "봉투16": (1025, 575), "봉투21": (620, 958), "봉투23": (1302, 300), "봉투28": (810, 792)}[kind]
        return G.bag_tracked(frs, guess, search=360 if kind == "봉투5" else 240, spin=(kind == "봉투23"))
    if kind == "상자15":
        return G.sticker(frs, guess=(1246, 450), r=70)
    if kind == "상자32":
        return G.sticker(frs, guess=(1389, 611), r=90)
    if kind == "1+1봉투":
        frs = G.sticker(frs, guess=(869 * s, 471 * s), r=70)
        return G.bag_mark(frs, center=(1000 * s, 487 * s), radius=50 * s)
    raise ValueError(kind)


def picture(only=None):
    d = os.path.join(OUT, "_컷")
    os.makedirs(d, exist_ok=True)
    paths = []
    for n in range(1, 37):
        pid, a, kind = CUTS[n]
        k = F[n] - F[n - 1]
        src = C.clip(pid)
        have = C.frames_of(src)
        if a + k > have:
            raise SystemExit(f"#{n} {pid}: {a}장부터 {k}장이 필요한데 {have}장뿐")
        out = os.path.join(d, f"{n:02d}.mp4")
        paths.append(out)
        if only and n not in only and os.path.exists(out):
            continue
        if kind:
            frames_out(overlay(kind, frames_in(src, a, k)), out)
        else:
            C.cut_video(src, a, k, W, H, FPS, out)
        if C.frames_of(out) != k:
            raise SystemExit(f"{out}: {k}장이어야 하는데 {C.frames_of(out)}장")
        print(f"#{n:02d} {pid} {a}장부터 {k}장" + (f" + {kind}" if kind else ""), flush=True)
    C.join_videos(paths, os.path.join(OUT, "화면.mp4"))
    print("화면", C.frames_of(os.path.join(OUT, "화면.mp4")), "장")


def sound():
    C.run(sys.executable, "-X", "utf8", os.path.join(HERE, "소리.py"))


def render(name=NAME, jobs=2):
    os.makedirs(PUB, exist_ok=True)
    # 끝 로고 판 — 로고 D(호박빛 바탕 · 흰 그린 글자, 결정 10-29). 글자 높이의 0.42배 · 0.34배 여백, 모서리는 반듯하게(라벨 미리보기와 같은 결)
    from PIL import Image
    txt = G.WM.raster(G.WM.wordmark(), 192, pad=0.0, color=(255, 252, 244))
    px, py = int(192 * 0.42), int(192 * 0.34)
    box = Image.new("RGBA", (txt.width + 2 * px, txt.height + 2 * py), (246, 176, 62, 255))
    box.paste(txt, (px, py), txt)
    box.save(os.path.join(PUB, "logo_box.png"))
    for src, to in ((os.path.join(OUT, "화면.mp4"), "picture.mp4"), (os.path.join(OUT, "소리.wav"), "sound.wav")):
        if not os.path.exists(os.path.join(PUB, to)) or C.md5(src) != C.md5(os.path.join(PUB, to)):
            shutil.copyfile(src, os.path.join(PUB, to))
    out, raw = os.path.join(OUT, name + ".mp4"), os.path.join(OUT, "_렌더.mp4")
    C.run(shutil.which("npx"), "remotion", "render", "src/index.ts", "s1", raw, f"--concurrency={jobs}", "--log=error", cwd=os.path.join(CAP, "remotion"))
    C.run("node", os.path.join(C.REPO, "tools", "음량마감.mjs"), raw, out, "--목표", "-14", "--덮어쓰기")   # 소리 AAC 320k 이상(영상사전검사)
    C.run("ffmpeg", "-y", "-v", "error", "-i", out, "-vf", "scale=1280:-2", "-c:v", "libx264", "-crf", "23", "-preset", "medium", "-c:a", "aac", "-b:a", "128k",
          "-movflags", "+faststart", os.path.join(OUT, name + "_폰.mp4"))
    C.run("ffmpeg", "-y", "-v", "error", "-i", out, "-vf", "fps=2,scale=200:-2,tile=12x10:padding=3", "-frames:v", "1", "-q:v", "4", os.path.join(OUT, "_반초.jpg"))
    print(out)


if __name__ == "__main__":
    what = sys.argv[1:] or ["화면", "소리", "판"]
    only = {int(x) for x in what if x.isdigit()}
    for w in [x for x in what if not x.isdigit()]:
        {"화면": lambda: picture(only or None), "소리": sound, "판": render}[w]()
