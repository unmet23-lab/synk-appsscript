# 8번 앱 소개 30초 「캐스팅북」 최종 편집(2026-11-07, Claude) — 02_콘티 2절 21컷을 원본 컷 시각대로 하드컷으로 잇고(24fps · 1920×1080),
# 폰 화면 컷 여섯은 폰입히기.py가 지금 캐스팅북을 손가락 자취에 맞춰 다시 찍어 입힌 판, 4 · 17번은 원본 디지털 줌 곡선(콘티 2-1절)을 후반에서 건다.
# 소리는 최종소리.py, 글자 1 · 2 · 제목 · 끝 화면은 자막시안_20261103/remotion의 p8(src/p8/P8.tsx)이 굽는다.
#   python -X utf8 최종편집.py [화면] [소리] [판]   → git 밖 pulse-portfolio12-20261024/최종/p8/캐스팅북_16x9.mp4 · _16x9_폰.mp4 · _반초.jpg
# 후보정 없음(결정 10-24): 받은 판의 색 · 밝기 · 떨림 · 속도는 그대로 — 잘라 잇고(1280 → 1920 키움), 폰 초록 자리에만 녹화를 붙이고, 원본에 있는 디지털 줌만 건다.
import json
import os
import shutil
import subprocess
import sys

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
import 최종편집공통 as C

ROOT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024"
OUT = os.path.join(ROOT, "최종", "p8")
CUTD = os.path.join(OUT, "_컷")
CAP = os.path.join(HERE, "..", "자막시안_20261103")
PUB = os.path.join(ROOT, "최종", "자막시안_public", "p8")
FPS, W, H = 24, 1920, 1080

# 컷 경계 — 원본(29.97fps) 컷 첫 장을 24fps 장으로(콘티_가편집.py START), 끝은 30.00초에 뚝(콘티 21번)
START = [0, 43, 72, 123, 178, 223, 264, 338, 363, 425, 455, 475, 500, 525, 568, 602, 629, 670, 708, 800, 852]
F = [round(s / 29.97 * FPS) for s in START] + [720]
PHONE = {3, 6, 10, 12, 15, 17}   # 폰입히기.py가 만든 _컷/<n>_입힘.mp4

# 컷 → (판, 그 판에서 시작하는 장)
CUTS = {
    1: ("p8-01c", 29),     # 다시 낸 판(뒤가 어두운 나무 바닥 · 의자 등받이) — 판 1.7초 숨이 컷 0.5초(콘티 1절)
    2: ("p8-02b", 12),     # v4 다시 낸 판 — 의자는 바닥에 선 채 등받이 위로 머리만 젖힘(v3 Fable 「60도 넘게 넘어간 자세 — 마네킹을 넘어뜨린 것처럼」)
    4: ("p8-04c", 0),      # 다시 낸 판 — 눈이 폰 한 곳에 멎음. 다가감은 아래 ZOOM
    5: ("p8-05c", 2),      # v4 다시 낸 판 — 가방이 걷는 사람 다리 옆에 붙어 천천히 지나가고(v3 Fable 「가방이 다리에서 반 화면 떨어져 따라잡음」), 앞면은 카드와 같은 웃음 사진, 창 너머 소연은 등받이 위로 머리만 젖힘
    # 7번 — 앉음은 p8-07d(왼쪽 창빛 한 방향, 눈을 뜬 채 폰을 보며 판 0.33~0.75초에 바로 앉음 → 컷 0.25~0.67초, 원본 0.8초) 2~36장,
    #   앉은 뒤는 그 36장을 첫 장으로 다시 낸 p8-07f(11-11)의 30~54장 — 연기가 약 1초 늦게 시작해 1.25초부터: 눈썹이 오르고 몸이 앞으로 기울며
    #   폰을 턱 아래로 올림. 이음 얼굴 둘레 차 3.43(07d 이웃 장 0.75~1.44, 24장부터는 눈 감은 장이 이음 뒤라 뺌) · 25장 사람 0.176(콘티 10절)
    7: [("p8-07d", 2, 35), ("p8-07f", 30, 25)],
    8: ("p8-08", 12),
    9: ("p8-09", 12),
    11: ("p8-11c", 0),     # v4 다시 낸 판 — 유리문 바깥에 붙은 손바닥만 한 스티커(v3 Fable 「냉장고 안 액자」). 판 0.7초부터 반사 줄이 얼굴로 와 그 앞 0~0.67초
    13: ("p8-13", 12),
    14: ("p8-14", 8),      # 입이 살짝 벌어지는 0.33~1.79초 — 1.9초부터 입을 크게 벌리고 눈을 키운다(콘티 「14번 표정이 과하면」)
    16: ("p8-16", 24),
    18: ("p8-18", 0),
    19: ("p8-19b", 0),     # 다시 낸 판(4장 무늬 없음) — 건넴 0~1.0초, 손님 말 판 1.6~2.7초(소리는 최종소리.py가 놓음)
    20: ("p8-20c", 12),    # v4 다시 낸 판 — 창 옆 벽의 하린 포스터를 화면 높이 약 30%로(v3 Fable 「포스터가 손톱만 함」), 제목 덩이 오른쪽 밖
    21: ("p8-20c", 53),    # 끝 장면 — 20번을 이어 둔다(v4 기본은 이 장면 안 바닥에 로고 · 주소, 견줄 판 p8-card는 흰 끝 화면이 덮는다)
}

CAM = os.path.join(ROOT, "레퍼런스", "원본실측", "p8_네이버", "카메라", "곡선.json")
ZOOM_AXES = {4: ("배율", "옆", "위아래", "돎"), 17: ("배율",)}   # 콘티 2-1절 — 17번은 배율만(원 곡선의 옆 · 위아래에는 원본 엄지가 섞여 있다)


def curves():
    return {int(r["id"]): r["곡선"] for r in json.load(open(CAM, encoding="utf-8"))["컷"] if r["id"] in ("4", "17")}


def push(fr, c, axes, t):
    """원본 곡선대로 2D 카메라 — 그 시각의 배율 · 옆 · 위아래 · 돎(원 곡선, 뚝 멈춤을 둥글리지 않는다)을 화면 가운데 기준으로."""
    tt = np.array(c["t"])
    z, x, y, r = (float(np.interp(t, tt, np.array(c[k]))) if k in axes else 0.0 for k in ("배율", "옆", "위아래", "돎"))
    s, th = 1 + z / 100, np.radians(r)
    A = np.array([[s * np.cos(th), -s * np.sin(th)], [s * np.sin(th), s * np.cos(th)]])
    c0 = np.array([W / 2, H / 2])
    M = np.hstack([A, (c0 + [x / 100 * W, y / 100 * H] - A @ c0)[:, None]])
    return cv2.warpAffine(fr, M, (W, H), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REPLICATE)


FROM_YUV = "zscale=matrixin=709:rangein=limited:range=full,format=gbrp"
TO_YUV = "zscale=matrix=709:range=limited:rangein=full,format=yuv420p"


def read_frames(path):
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", FROM_YUV, "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], capture_output=True, check=True)
    return list(np.frombuffer(r.stdout, np.uint8).reshape(-1, H, W, 3).copy())


def write_frames(frames, path):
    p = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                          "-vf", TO_YUV, "-c:v", "libx264", "-crf", "12", "-preset", "medium", "-r", str(FPS),
                          "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", path], stdin=subprocess.PIPE)
    for f in frames:
        p.stdin.write(np.ascontiguousarray(f).tobytes())
    p.stdin.close()
    if p.wait():
        raise SystemExit("ffmpeg 실패")


def picture():
    os.makedirs(CUTD, exist_ok=True)
    cv = curves()
    paths = []
    for n in range(1, 22):
        k = F[n] - F[n - 1]
        out = os.path.join(CUTD, f"{n:02d}.mp4")
        if n in PHONE:
            src = os.path.join(CUTD, f"{n:02d}_입힘.mp4")
            if C.frames_of(src) != k:
                raise SystemExit(f"#{n} 입힌 판이 {C.frames_of(src)}장 — {k}장이어야 한다(폰입히기.py CUTS와 경계가 어긋남)")
            shutil.copyfile(src, out)
        else:
            # 한 컷을 두 판으로 이을 수 있다(11-09 7번 — 앉는 동작은 앞 판, 앉은 뒤는 그 마지막 장을 첫 장으로 다시 낸 판): [(판, 시작 장, 장 수), …]
            segs = CUTS[n] if isinstance(CUTS[n], list) else [(CUTS[n][0], CUTS[n][1], k)]
            if sum(s[2] for s in segs) != k:
                raise SystemExit(f"#{n}: 토막 장 수 합 {sum(s[2] for s in segs)} — {k}장이어야 한다")
            parts = []
            for j, (pid, a, kk) in enumerate(segs):
                src = C.clip(pid)
                have = C.frames_of(src)
                if a + kk > have:
                    raise SystemExit(f"#{n} {pid}: {a}장부터 {kk}장이 필요한데 {have}장뿐")
                part = out if len(segs) == 1 else out.replace(".mp4", f"_{j}.mp4")
                C.cut_video(src, a, kk, W, H, FPS, part)
                parts.append(part)
            if len(parts) > 1:
                C.join_videos(parts, out)
        if n in ZOOM_AXES:
            fr = read_frames(out)
            write_frames([push(f, cv[n], ZOOM_AXES[n], i / FPS) for i, f in enumerate(fr)], out)
        if C.frames_of(out) != k:
            raise SystemExit(f"{out}: {k}장이어야 하는데 {C.frames_of(out)}장")
        paths.append(out)
        what = "폰 입힘" if n in PHONE else (" + ".join(f"{p_} {a_}장부터 {k_}장" for p_, a_, k_ in CUTS[n]) if isinstance(CUTS[n], list) else CUTS[n][0] + f" {CUTS[n][1]}장부터")
        print(f"#{n} {what} {k}장 → {F[n - 1] / FPS:.2f}–{F[n] / FPS:.2f}초" + (" · 줌" if n in ZOOM_AXES else ""))
    C.join_videos(paths, os.path.join(OUT, "화면.mp4"))
    print("화면", C.frames_of(os.path.join(OUT, "화면.mp4")), "장")


TF = [f / FPS for f in F]   # 소리 · 글자는 화면이 실제로 자르는 장 경계(초)에 놓는다


def sound():
    import 최종소리
    os.makedirs(os.path.join(CAP, "remotion", "src", "p8"), exist_ok=True)
    최종소리.build(os.path.join(OUT, "소리.wav"), os.path.join(CAP, "remotion", "src", "p8", "timing.json"), TF)


LOGO = os.path.join(ROOT, "콘티", "p8", "_brand-pulse.png")   # 승인 로고(site/assets/brand-pulse.webp — 펠트 synk + 실땀 PULSE)를 PNG로 푼 것(10-25)


def publish():
    os.makedirs(PUB, exist_ok=True)
    for src, to in ((os.path.join(OUT, "화면.mp4"), "picture.mp4"), (os.path.join(OUT, "소리.wav"), "sound.wav"), (LOGO, "brand-pulse.png")):
        dst = os.path.join(PUB, to)
        if os.path.exists(src) and (not os.path.exists(dst) or C.md5(src) != C.md5(dst)):
            shutil.copyfile(src, dst)


def stills(*frames, comp="p8"):
    publish()
    d = os.path.join(OUT, "_낱장")
    os.makedirs(d, exist_ok=True)
    for f in frames:
        C.run(shutil.which("npx"), "remotion", "still", "src/index.ts", comp, os.path.join(d, f"{comp}_f{int(f):04d}.png"), f"--frame={int(f)}", "--log=error", cwd=os.path.join(CAP, "remotion"))
    print(d)


def render(name="캐스팅북_16x9", comp="p8", jobs=3, props=None):
    publish()
    raw = os.path.join(OUT, "_렌더_" + comp + ("_" + name if props else "") + ".mp4")
    extra = [f"--props={json.dumps(props, ensure_ascii=False)}"] if props else []
    C.run(shutil.which("npx"), "remotion", "render", "src/index.ts", comp, raw, f"--concurrency={jobs}", "--log=error", *extra, cwd=os.path.join(CAP, "remotion"))
    finish(raw, name, comp)


def finish(raw, name="캐스팅북_16x9", comp="p8"):
    # 리미터 0.74 — 기본 0.84는 폰 누름 「톡」 · 잔 · 곡 치기 어택이 AAC에서 솟아 봉우리 −0.5 dBFS로 미통과(11-07), 0.74에서 −14.2 LUFS · −1.4 dBFS · AAC 327k 통과
    out = os.path.join(OUT, name + ".mp4")
    C.run("node", os.path.join(C.REPO, "tools", "음량마감.mjs"), raw, out, "--목표", "-14", "--리미터", "0.74", "--덮어쓰기")
    C.run("ffmpeg", "-y", "-v", "error", "-i", out, "-vf", "scale=1280:-2", "-c:v", "libx264", "-crf", "23", "-preset", "medium", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", os.path.join(OUT, name + "_폰.mp4"))
    C.run("ffmpeg", "-y", "-v", "error", "-i", out, "-vf", "fps=2,scale=240:-2,tile=10x6:padding=3", "-frames:v", "1", "-q:v", "4", os.path.join(OUT, f"_반초_{comp}.jpg"))
    print(out)


def label_font():
    """ffmpeg drawtext용 글꼴 경로 — 경로에 한글(「브랜드_폰트」)이 있으면 ffmpeg가 Fontconfig 오류 뒤 세그폴트로 죽는다(11-07, 현장노트 영상).
    임시 폴더(ASCII)로 복사해 그 경로를 drawtext 꼴(콜론 이스케이프)로 돌려준다. 글자(text=)는 한글이어도 된다."""
    import tempfile
    dst = os.path.join(tempfile.gettempdir(), "SUIT-SemiBold.otf")
    if not os.path.exists(dst):
        shutil.copyfile(os.path.join(C.REPO, "docs", "브랜드_폰트", "SUIT", "SUIT-SemiBold.otf"), dst)
    assert dst.isascii(), dst
    return dst.replace("\\", "/").replace(":", "\\:")


def compare(a=600):
    """고르기 판(v4) — 최종본(장면 안 끝 · 그린 제목)과 견줄 판 둘을 25초(600장)부터 끝까지만 굽고 최종본의 같은 자리 소리를 붙인다(콘티 8-3).
    끝_AB.mp4 = A 최종본 → B 흰 끝 화면(p8-card, 10-26 확정 판) · 제목_AB.mp4 = A 최종본 → B 글꼴로 친 제목(p8-type). 오른쪽 위에 이름표."""
    publish()
    d = os.path.join(OUT, "_시안")
    os.makedirs(d, exist_ok=True)
    final = os.path.join(OUT, "캐스팅북_16x9.mp4")
    font = label_font()

    def tagged(src, ss, tag, p):
        C.run("ffmpeg", "-y", "-v", "error", "-ss", f"{ss}", "-i", src, "-vf",
              f"drawbox=x=1130:y=30:w=760:h=64:color=black@0.55:t=fill,drawtext=fontfile='{font}':text='{tag}':x=1148:y=44:fontsize=34:fontcolor=white",
              "-c:v", "libx264", "-crf", "20", "-preset", "medium", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", p)
        return p

    for comp, name, ta, tb in (("p8-card", "끝", "A · 장면 안 끝(추천)", "B · 흰 끝 화면(10-26 확정)"),
                               ("p8-type", "제목", "A · 오린 종이 글자(추천)", "B · 글꼴로 친 글자")):
        raw = os.path.join(d, f"_{name}B_화면.mp4")
        C.run(shutil.which("npx"), "remotion", "render", "src/index.ts", comp, raw, f"--frames={a}-{F[-1] - 1}", "--log=error", cwd=os.path.join(CAP, "remotion"))
        b = os.path.join(d, f"{name}B.mp4")
        C.run("ffmpeg", "-y", "-v", "error", "-i", raw, "-ss", f"{a / FPS}", "-i", final, "-map", "0:v", "-map", "1:a", "-shortest",
              "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", b)
        parts = [tagged(final, a / FPS, ta, os.path.join(d, f"_{name}_A.mp4")), tagged(b, 0, tb, os.path.join(d, f"_{name}_B.mp4"))]
        lst = os.path.join(d, f"_{name}.txt")
        open(lst, "w", encoding="utf-8").write("".join(f"file '{p}'\n" for p in parts))
        C.run("ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", "-movflags", "+faststart", os.path.join(d, f"{name}_AB.mp4"))
        print(os.path.join(d, f"{name}_AB.mp4"))


if __name__ == "__main__":
    what = sys.argv[1:] or ["화면", "소리", "판"]
    if what[0] == "낱장":
        stills(*what[1:])
        raise SystemExit
    if what[0] == "견줌":
        compare()
        raise SystemExit
    for w in what:
        {"화면": picture, "소리": sound, "판": render}[w]()
