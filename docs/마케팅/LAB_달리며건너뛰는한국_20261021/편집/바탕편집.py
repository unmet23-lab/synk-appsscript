# 「달리며 건너뛰는 한국」 바탕 영상(2026-11-07, Claude) — 드리미나 울트라로 받은 판을 콘티 v2 박표(120 BPM · 30.0초 · 24 fps)대로 장 번호로 잘라 하드컷으로 잇는다.
#   글자 · 소리는 remotion/(Film.tsx)이 이 바탕 위에 얹는다. 후보정 없음(결정 10-24): 색 · 밝기 · 떨림 · 속도를 건드리지 않고, 크기만 720×1280 → 1080×1920(lanczos).
#   python -X utf8 편집/바탕편집.py            → git 밖 synk-vendor/korea-run-montage-20261021/최종/바탕.mp4 · _반초.jpg, remotion/public/clips/base.mp4
#   python -X utf8 편집/바탕편집.py 낱장 <초> …  → 최종/_낱장/t<초>.png
# 쓰는 판 · 시작 장은 CUTS 한 곳이다. 고른 까닭(받기_드리미나.py 검수판 · 얼굴 띠 · 카메라 실측)은 굽기 시트 「드리미나 울트라로 굽기(11-07)」 표.
import os
import shutil
import subprocess
import sys

VENDOR = "C:/Users/q1212/Documents/synk-vendor/korea-run-montage-20261021"
GOT = os.path.join(VENDOR, "영상", "받음_드리미나")
OUT = os.path.join(VENDOR, "최종")
HERE = os.path.dirname(os.path.abspath(__file__))
PUBLIC = os.path.join(HERE, "..", "remotion", "public", "clips")
FPS, W, H = 24, 1080, 1920

# (단위, 판, 판 안 시작 장, 장 수) — 편집 시각은 앞 칸들의 장 수를 더한 자리. 합 720장 = 30.0초
CUTS = [
    ("V01", "kr-V01", 0, 72),          # 0.0–3.0  걸어옴 · 도는 카메라(첫 벌 — 둘째 벌은 1.5초부터 카메라가 반대로 돎). 얼굴 0.46~0.52
    ("V02", "kr-V02", 0, 36),          # 3.0–4.5  창에 폰 · 테이프(처음 1초 다가감 4%/초)
    ("V03", "kr-V03", 12, 36),         # 4.5–6.0  폰 시점 — 누름 0.5초 → 1.0초부터 물러남 → 섬. 얼굴 0.48~0.52
    ("V04", "kr-V04이음", 5, 95),      # 6.0–9.96 출발 → 걷기 → 질주(V03 48장에서 이은 판 — 처음 5장은 서 있는 그대로라 건너뜀). 렌즈를 보는 3/4 얼굴 0.36~0.52
    ("V04기둥", "kr-V04이음__2", 101, 1),  # 9.96–10.0 승강장 기둥이 화면을 다 덮은 한 장(둘째 벌 100~101장) — 기둥이 덮은 자리에서 진해로
    ("V05", "kr-V05", 0, 48),          # 10.0–12.0 진해(처음 0.5초 왼쪽으로 휘청 → 오른쪽 팬, 원본 카메라와 같음) · 2.0초 무렵 도약으로 몽타주에 이음
    # 몽타주: 판마다 0~0.5초 움직임이 크고 멈춘 장 · 4장 무늬가 없는 쪽(받기_드리미나.py 「움직임 0~0.5초」, _몽타주판)
    ("V06", "kr-V06", 0, 12), ("V07", "kr-V07", 0, 12), ("V08", "kr-V08__2", 0, 12), ("V09", "kr-V09__2", 0, 12), ("V10", "kr-V10__2", 0, 12),
    ("V11", "kr-V11__2", 0, 12), ("V12", "kr-V12", 0, 12), ("V13", "kr-V13__2", 0, 12), ("V14", "kr-V14__2", 0, 12), ("V15", "kr-V15", 0, 12),
    # v4(Fable 맹검 v2 P1 「20.0초 하드컷 — 맑은 유채 → 흐린 다리, 빛 · 크기 · 자리가 튐 · 카드가 다리를 가림」): 원본(30.6~34.1초 한 샷)처럼
    #   다이빙 판을 끝(6.0초)까지 쓰고 그 끝 장(144)에서 이어 구운 다리 판으로 — S19 시작 그림의 V17(흐린 빛 · 가까운 다리)은 쓰지 않는다
    ("V16", "kr-V16우", 0, 144),       # 17.0–23.0 유채 달리기 → 18.85 오른쪽 다이빙 → 다리 흔들기(방향을 못 박아 다시 낸 판)
    ("V17", "kr-V17이음__2", 0, 168),  # 23.0–30.0 같은 샷을 이어 다리 흔들기 → 27.3~28.0초 꽃 속으로 쓰러짐 → 빈 유채밭(둘째 벌 — 두 벌 다 4장 무늬, 걸린 창 움직임이 0.46~0.60으로 덜 보이는 쪽)
]


def run(*a):
    subprocess.run(a, check=True)


def frames_of(p):
    r = subprocess.run(["ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", p],
                       capture_output=True, text=True)
    return int(r.stdout.strip().split(",")[0])


def cut(src, a, k, out):
    # 드리미나 파일은 머리 60 fps · 실제 24 — select의 n은 실제 장 순서다
    vf = f"select='between(n,{a},{a + k - 1})',setpts=N/{FPS}/TB,scale={W}:{H}:flags=lanczos:out_color_matrix=bt709,format=yuv420p"
    run("ffmpeg", "-y", "-v", "error", "-i", src, "-an", "-vf", vf, "-frames:v", str(k), "-c:v", "libx264", "-crf", "12", "-preset", "medium", "-r", str(FPS),
        "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", out)


def starts():
    t, out = 0, []
    for c in CUTS:
        out.append(t)
        t += c[3]
    return out, t


START = {"V06": "S08_다랭이마을", "V07": "S09_우도", "V08": "S10_보성", "V09": "S11_하늘공원", "V10": "S12_퍼플섬", "V11": "S13_첨성대",
         "V12": "S14_내장산", "V13": "S15_순천만", "V14": "S16_정동진", "V15": "S17_한라산", "V16": "S18_유채달리기", "V17": "S19_다이빙"}


def still_cut(png, k, out):
    """시험용 — 아직 안 받은 판 자리를 시작 그림 멈춘 화면으로(최종본에는 쓰지 않는다)."""
    run("ffmpeg", "-y", "-v", "error", "-loop", "1", "-framerate", str(FPS), "-i", png, "-vf", f"scale={W}:{H}:flags=lanczos:out_color_matrix=bt709,format=yuv420p",
        "-frames:v", str(k), "-c:v", "libx264", "-crf", "12", "-preset", "medium", "-r", str(FPS), "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", out)


def build(trial=False):
    os.makedirs(os.path.join(OUT, "_컷"), exist_ok=True)
    at, total = starts()
    assert total == 30 * FPS, total
    parts = []
    for (uid, pid, a, k), f0 in zip(CUTS, at):
        src = os.path.join(GOT, pid + ".mp4")
        p = os.path.join(OUT, "_컷", f"{f0:03d}_{uid}.mp4")
        if not os.path.exists(src) and trial and uid in START:
            still_cut(os.path.join(VENDOR, "영상_시작그림", START[uid] + ".png"), k, p)
            parts.append(p)
            print(f"{f0 / FPS:5.2f}~{(f0 + k) / FPS:5.2f}초  {uid:4s} (시험: 시작 그림 멈춤)", flush=True)
            continue
        have = frames_of(src)
        if a + k > have:
            raise SystemExit(f"{uid} {pid}: {a}장부터 {k}장이 필요한데 {have}장뿐")
        cut(src, a, k, p)
        got = frames_of(p)
        assert got == k, (uid, got, k)
        parts.append(p)
        print(f"{f0 / FPS:5.2f}~{(f0 + k) / FPS:5.2f}초  {uid:4s} {pid} {a}장부터 {k}장", flush=True)
    lst = os.path.join(OUT, "_컷", "_목록.txt")
    with open(lst, "w", encoding="utf-8") as f:
        f.writelines(f"file '{p}'\n" for p in parts)
    base = os.path.join(OUT, "바탕.mp4")
    run("ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", base)
    n = frames_of(base)
    assert n == total, (n, total)
    os.makedirs(PUBLIC, exist_ok=True)
    shutil.copy2(base, os.path.join(PUBLIC, "base.mp4"))
    sheet(base, os.path.join(OUT, "_반초.jpg"))
    thumbs(base)
    print("바탕", base, n, "장")


# 답 카드의 장소 작은 그림(11-07 이해 시험 v1 — 시험관 셋이 「이름과 풍경을 짝지을 수 없다」): 그 장소가 화면에 나온 순간을 정사각으로 잘라 둔다.
# (화면 초, 자를 정사각의 위 끝 y — 1080×1920 기준)
THUMBS = [(10.9, 560), (12.25, 380), (12.75, 380), (13.25, 380), (13.75, 380), (14.25, 380), (14.75, 300), (15.25, 380), (15.75, 380), (16.25, 380),
          (16.75, 360), (17.3, 300)]


def thumbs(base):
    d = os.path.join(PUBLIC, "thumbs")
    os.makedirs(d, exist_ok=True)
    for i, (t, y) in enumerate(THUMBS, 1):
        run("ffmpeg", "-y", "-v", "error", "-ss", f"{t:.3f}", "-i", base, "-frames:v", "1", "-vf", f"crop=1080:1080:0:{y},scale=168:168:flags=lanczos",
            "-q:v", "2", os.path.join(d, f"t{i:02d}.jpg"))
    print("작은 그림", d, len(THUMBS))


def sheet(src, out):
    run("ffmpeg", "-y", "-v", "error", "-i", src, "-vf", "fps=2,scale=216:384,tile=12x5:padding=4:color=0x111111", "-frames:v", "1", out)


def still(ts):
    d = os.path.join(OUT, "_낱장")
    os.makedirs(d, exist_ok=True)
    base = os.path.join(OUT, "바탕.mp4")
    for t in ts:
        run("ffmpeg", "-y", "-v", "error", "-ss", f"{float(t):.3f}", "-i", base, "-frames:v", "1", os.path.join(d, f"t{float(t):05.2f}.png"))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    if len(sys.argv) > 1 and sys.argv[1] == "낱장":
        still(sys.argv[2:])
    elif len(sys.argv) > 1 and sys.argv[1] == "작은그림":
        thumbs(os.path.join(OUT, "바탕.mp4"))
    else:
        build(trial="--시험" in sys.argv)
