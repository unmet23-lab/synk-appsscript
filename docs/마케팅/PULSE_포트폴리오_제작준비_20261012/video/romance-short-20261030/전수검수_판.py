# 11-07 밤 유호님 「사람이 자꾸 바뀐다」 뒤 전수 검수에 쓴 판 만들기(Claude) — 결과 · 보고는 git 밖 콘티/romance/검수/전수_20261107/, 요지는 02_콘티 10절.
# 다시 만든 판을 볼 때도 같은 셋을 돌린다: 전수검수_판.py(원본 나란히 · 8장 움직임 띠) → 전수검수_얼굴.py(배역별 얼굴 조각, 자리로 나눔) → 전수검수_얼굴판.py <배역> [무리.json].
# 70컷 전수 검수판 — (가) 원본 · 우리 나란히(각 25 · 50 · 75%), (나) 우리 움직임 8장. 우리 화면은 자막 없는 화면.mp4
import os, re, sys, subprocess
import numpy as np, cv2
sys.path.insert(0, "C:/Users/q1212/Documents/SYNK-appsscript/docs/마케팅/PULSE_포트폴리오_제작준비_20261012/video/romance-short-20261030")
import 최종편집 as E
OUT = sys.argv[1] if len(sys.argv) > 1 else "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/romance/검수/전수_20261107/판"; os.makedirs(OUT, exist_ok=True)
ORIG = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/레퍼런스/romance/원본영상/hq_2Keexvlh2JQ/hq_2Keexvlh2JQ_h264.mp4"
OURS = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/rs/화면.mp4"
CONTI = "C:/Users/q1212/Documents/SYNK-appsscript/docs/마케팅/PULSE_포트폴리오_제작준비_20261012/video/romance-short-20261030/02_콘티.md"
OS = {}
for ln in open(CONTI, encoding="utf-8"):
    m = re.match(r"\| C(\d\d)[^|]*\| \d+ \((\d+\.\d+)–(\d+\.\d+)\)", ln)
    if m: OS[int(m.group(1))] = (float(m.group(2)), float(m.group(3)))
def stream(path, w, h):
    pr = subprocess.Popen(["ffmpeg", "-v", "error", "-i", path, "-vf", f"scale={w}:{h}", "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], stdout=subprocess.PIPE)
    k = 0
    while True:
        b = pr.stdout.read(w * h * 3)
        if len(b) < w * h * 3: break
        yield k, np.frombuffer(b, np.uint8).reshape(h, w, 3)
        k += 1
    pr.wait()
TW, TH = 320, 180
# 우리: 컷마다 25/50/75% + 8장
need = {}
for i, name in enumerate(E.NAMES):
    a, b = E.F[i], E.F[i + 1] - 1
    for q in (0.25, 0.5, 0.75): need.setdefault(int(a + (b - a) * q), []).append((name, "c", q))
    for k in range(8): need.setdefault(int(a + (b - a) * (k + 0.5) / 8), []).append((name, "m", k))
ours = {}
for k, img in stream(OURS, TW, TH):
    if k in need:
        for (name, kind, q) in need[k]: ours[(name, kind, q)] = img.copy()
# 원본: 컷마다 25/50/75% (원본 시각 24장 단위 아님 — fps로 계산)
fps = 23.976
oneed = {}
for i, name in enumerate(E.NAMES):
    c = i + 1
    if c not in OS: continue
    s, e = OS[c]
    for q in (0.25, 0.5, 0.75): oneed.setdefault(int(round((s + (e - s) * q) * fps)), []).append((name, q))
orig = {}
for k, img in stream(ORIG, TW, TH):
    if k in oneed:
        for (name, q) in oneed[k]: orig[(name, q)] = img.copy()
def lab(img, s, col=(255, 255, 255)):
    img = img.copy(); cv2.putText(img, s, (5, 16), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 0), 3); cv2.putText(img, s, (5, 16), cv2.FONT_HERSHEY_SIMPLEX, 0.45, col, 1); return img
blank = np.zeros((TH, TW, 3), np.uint8)
rows_c, rows_m = [], []
for i, name in enumerate(E.NAMES):
    pid, off = E.CUTS[name]
    t0 = E.F[i] / 24
    r = [lab(orig.get((name, q), blank), f"orig {name} {int(q*100)}%", (120, 220, 255)) for q in (0.25, 0.5, 0.75)]
    r += [lab(ours.get((name, "c", q), blank), f"ours {name} {int(q*100)}% {t0 + (E.F[i+1]-E.F[i])/24*q:.1f}s") for q in (0.25, 0.5, 0.75)]
    rows_c.append(np.hstack(r))
    m = [lab(ours.get((name, "m", k), blank), f"{name} {k+1}/8") for k in range(8)]
    rows_m.append(np.hstack([cv2.resize(x, (240, 135)) for x in m]))
for k in range(0, 70, 10):
    cv2.imencode(".jpg", np.vstack(rows_c[k:k + 10]), [cv2.IMWRITE_JPEG_QUALITY, 85])[1].tofile(os.path.join(OUT, f"대조_{k // 10 + 1}.jpg"))
    cv2.imencode(".jpg", np.vstack(rows_m[k:k + 10]), [cv2.IMWRITE_JPEG_QUALITY, 85])[1].tofile(os.path.join(OUT, f"움직임_{k // 10 + 1}.jpg"))
print("ok", len(ours), len(orig))
