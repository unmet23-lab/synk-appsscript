# 5번 스포츠 매니페스토 「가쁨」 가편집(2026-11-05, Claude) — 02_콘티 3절 21행을 원본 시각 그대로 하드컷으로 잇는다. 11-05 유호님 「응, 가편집」(빈 칸은 정지컷으로).
#   python -X utf8 가편집.py [화면] [소리] [판]   → git 밖 pulse-portfolio12-20261024/최종/p5/가쁨_가편집_16x9.mp4 · _폰.mp4 · _반초.jpg
# 쓸 판 · 시작점은 02_콘티 8절. 18 · 19행은 판이 없어 시작 그림을 카메라 움직임만 넣어 세운다. 6행은 정지컷에 눈 뜨는 순간이 없어 받은 판을 임시로 쓴다(다시 낼 판).
# 판이 들어오면 SEG의 그 줄만 ("판", id, 시작 초)로 바꾼다. 받은 판의 색 · 빛은 손대지 않는다(결정 10-24). 번쩍 조각 · 숫자 · 로고는 그래픽조각.py 판.
import os
import subprocess
import sys

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import 최종편집공통 as C

ROOT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024"
OUT = os.path.join(ROOT, "최종", "p5")
V = os.path.join(ROOT, "콘티", "p5")
FPS, W, H = 24, 1920, 1080
END = 30.03
ENC = ["-c:v", "libx264", "-crf", "12", "-preset", "medium", "-r", str(FPS), "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709"]

# (시작 초, 종류, 이름, 값) — 판: 받은 판과 그 시작 초 · 조각: 그림과 움직임(없으면 그대로)
SEG = [
    (0.00, "판", "p5-01", 0.0),        # 1  유리창 너머 한결 — 「숨.」
    (3.13, "판", "p5-02", 1.75),       # 2  앞 1.67초는 시작 그림에 없는 손잡이 막대가 보인다
    (4.63, "판", "p5-03", 0.0),        # 3  밤 트랙 다리 — 「땀.」
    (5.42, "판", "p5-04", 0.85),       # 4  첫 눈맞춤 — 앞 0.85초는 느려서 뒤의 빠른 다가감을 쓴다(0.85~1.56초 1.62배, 지시 1.8)
    # 5  번쩍 몽타주 — 원본 조각 자리 그대로(콘티_가편집.py)
    (6.13, "조각", "F4", None), (6.21, "조각", "F1", None), (6.26, "조각", "F2", None), (6.34, "조각", "F1", None), (6.38, "조각", "F4", None),
    (6.55, "조각", "G_빛줄기", None), (6.59, "조각", "F3", "옆얼굴"), (6.88, "조각", "F2", None), (7.09, "조각", "G_회색판", None), (7.13, "조각", "R1", None),
    (7.17, "조각", "F4", None), (7.30, "조각", "G_번쩍", None), (7.38, "조각", "G_빛줄기", None), (7.47, "조각", "F2", None), (7.55, "조각", "G_빛줄기", None),
    (7.67, "조각", "G_판", "흐름"), (8.05, "조각", "G_숫자_흐림", None), (8.09, "조각", "G_숫자_172", None), (8.22, "조각", "G_빛줄기_20", None), (8.26, "조각", "G_번쩍", None),
    (8.34, "조각", "G_회색판", None), (8.43, "조각", "F2", None), (8.55, "조각", "G_회색판", None),
    (8.76, "판", "p5-06", 0.0),        # 6  임시 — 눈 뜸은 원본 자리(2.44초)와 맞지만 1.64배로 다가오고 빛이 덜 꺼진다. 다시 낼 판
    (11.55, "조각", "G_숫자_흐림", "흐름"),  # 7
    (11.80, "판", "p5-08", 1.75),      # 8  딛고 밀어냄 — 뒤꿈치가 2.67초부터 들려 뒤쪽을 쓴다
    (14.06, "판", "p5-09", 0.0),       # 9  거꾸로 얼굴
    (16.60, "판", "p5-10", 0.0),       # 10 러닝머신 다리
    (18.89, "판", "p5-11", 0.0),       # 11 고개 듦 — 1초쯤부터 들어 「숨이,」(20.02)와 만난다
    (21.02, "조각", "G_심박", "흐름"),   # 12
    (21.19, "판", "p5-12a-12b", 0.5),  # 12a 마스크 옆얼굴(샷 1, 컷 1.29초)
    (21.48, "조각", "G_숫자_흐림", "흐름"),
    (21.73, "판", "p5-12a-12b", 1.5),  # 12b 러닝머신 신발(샷 2)
    (22.02, "조각", "G_심박", "흐름"),
    (22.15, "판", "p5-13", 0.0),       # 13
    (22.81, "조각", "G_판", "흐름"), (23.19, "조각", "G_숫자_172", None),  # 14
    (23.27, "판", "p5-15", 0.65),      # 15 고개가 0.67~1.33초에 돈다(지시 0.5초)
    (23.77, "조각", "G_빛줄기", None), (23.85, "조각", "G_숫자_172", None),
    (23.94, "모니터", "p5-16", 0.0),    # 16 초록 화면에 심박 숫자(프레임마다 초록 자리를 찾아 얹음)
    (24.36, "판", "p5-17", 0.0),       # 17
    (24.94, "조각", "S18", "바람"),     # 18 판 없음 — 시작 그림 + 좌우 흔들림
    (25.23, "조각", "G_막대", "막대"),
    (25.40, "조각", "S19", "정점"),     # 19 판 없음 — 시작 그림 + 위로 15% · 흔들림 · 2% 다가감
    (26.48, "조각", "G_빛줄기_20", "흐름"),  # 20
    (26.65, "끝", "p5-21", 0.0),       # 21 로고 28.49 켜짐 · 28.53 꺼짐 · 28.57 다시 켜짐
]
LOGO_ON, LOGO_OFF, LOGO_BACK = 28.49, 28.53, 28.57


def f(t):
    return round(t * FPS)


def still(name):
    for d in ("정지컷", "그래픽"):
        p = os.path.join(V, d, name + ".png")
        if os.path.exists(p):
            return np.asarray(Image.open(p).convert("RGB"))
    raise SystemExit("그림이 없다: " + name)


def view(img, z=1.0, ox=0.0, oy=0.0):
    # 그림을 화면에 꽉 채운 뒤 z배 · 화면 폭(높이) 비율만큼 옮긴 한 장
    h, w = img.shape[:2]
    s = max(W / w, H / h) * z
    m = np.float32([[s, 0, W / 2 - s * w / 2 + ox * W], [0, s, H / 2 - s * h / 2 + oy * H]])
    return cv2.warpAffine(img, m, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)


def writer(out):
    return subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-vf", "scale=out_color_matrix=bt709:flags=lanczos,format=yuv420p", *ENC, out],
                            stdin=subprocess.PIPE)


def decode(src, a, k, fit=None):
    # cut_video와 같은 색 길로 판을 읽는다(공통 scale → bt709 → RGB)
    size, crop = fit or (f"scale={W}:{H}:flags=lanczos", "null")
    vf = f"select='between(n,{a},{a + k - 1})',setpts=N/{FPS}/TB,{size}:out_color_matrix=bt709,{crop},format=yuv420p,scale=in_color_matrix=bt709:flags=lanczos,format=rgb24"
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-an", "-vf", vf, "-frames:v", str(k), "-f", "rawvideo", "-"], capture_output=True, check=True)
    return np.frombuffer(r.stdout, np.uint8).reshape(-1, H, W, 3)


def piece(name, move, k, out):
    # 번쩍 조각 · 판 없는 칸 — 움직임은 원본 그 행의 카메라(콘티 3절)
    img = still(name)
    rng = np.random.default_rng(sum(map(ord, name)))
    shake = rng.normal(0, 1, (k + 8, 2))
    p = writer(out)
    for i in range(k):
        u = i / max(1, k - 1)
        if move == "옆얼굴":      # 5행 F3 — 0.3초에 8.5% 다가가며 왼쪽으로 3%
            a = view(img, 1 + 0.085 * u, -0.03 * u)
        elif move == "흐름":      # 그래픽 판이 가로로 흐른다
            a = view(img, 1.22, 0.09 - 0.18 * u)
        elif move == "막대":      # 18행 그래픽 — 원본처럼 초점 밖 화면을 아주 가까이(또렷한 막대 그래프는 값싸 보였다, Fable 1차)
            a = cv2.GaussianBlur(view(img, 1.7, 0.06 - 0.12 * u, 0.0), (0, 0), 16)
            a = np.clip(a.astype(np.float32) * 1.5, 0, 255).astype(np.uint8)
        elif move == "바람":      # 18행 — 제자리에서 좌우로 4% 안팎
            a = view(img, 1.08, 0.022 * np.sin(u * 9.0) + 0.004 * shake[i, 0], 0.004 * shake[i, 1])
        elif move == "정점":      # 19행 — 첫 0.3초에 위로 15% 뒤 거의 멈춤 · 2% 다가감 · 큰 흔들림
            rise = min(1.0, i / (0.3 * FPS))
            rise = 1 - (1 - rise) ** 2
            a = view(img, 1.2 * (1 + 0.02 * u), 0.008 * np.sin(i * 1.7) + 0.003 * shake[i, 0], 0.075 - 0.15 * rise + 0.006 * np.sin(i * 2.3) + 0.003 * shake[i, 1])
        else:
            a = view(img)
        p.stdin.write(a.tobytes())
    p.stdin.close()
    p.wait()


def corners(key):
    # 초록 자리의 네 모서리(왼위 · 오른위 · 오른아래 · 왼아래)
    c, _ = cv2.findContours(key.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    c = max(c, key=cv2.contourArea)
    pts = cv2.approxPolyDP(c, 0.02 * cv2.arcLength(c, True), True).reshape(-1, 2).astype(np.float32)
    if len(pts) != 4:
        pts = cv2.boxPoints(cv2.minAreaRect(c)).astype(np.float32)
    s, d = pts.sum(1), pts[:, 0] - pts[:, 1]
    return np.float32([pts[s.argmin()], pts[d.argmax()], pts[s.argmax()], pts[d.argmin()]])


def screen_panel():
    # 16행 화면 — 심박 선 · 172 · BPM만(아래 작은 줄은 0.42초에 못 읽는다, Fable 1차). 켜진 화면이라 검정을 조금 띄운다
    scr = np.asarray(Image.open(os.path.join(V, "그래픽", "G_모니터.png")).convert("RGB")).astype(np.float32)[:800]
    h, w = 1240, 1600
    panel = np.zeros((h, w, 3), np.float32) + scr[4, 4]
    panel[(h - 800) // 2:(h - 800) // 2 + 800] = scr
    panel = cv2.GaussianBlur(panel, (0, 0), 1.6)
    return np.clip(panel * 1.0 + np.array([12, 20, 22], np.float32), 0, 255)


def monitor(pid, start, k, out):
    # 16행 초록 화면 — 프레임마다 네 모서리를 재고 시간에 맞춰 곧게 편 뒤 원근으로 얹는다. 손 · 테두리는 초록이 아니라 안 덮인다
    fr = decode(C.clip(pid), f(start), k)
    keys, quads = [], []
    for a in fr:
        a = a.astype(np.int16)
        key = (a[..., 1] > 70) & (a[..., 1] > a[..., 0] + 28) & (a[..., 1] > a[..., 2] + 28)
        key = cv2.morphologyEx(key.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
        keys.append(key)
        quads.append(corners(key))
    t = np.arange(k, dtype=np.float32)
    q = np.stack(quads)
    fit = np.stack([[np.polyval(np.polyfit(t, q[:, i, j], 1), t) for j in range(2)] for i in range(4)]).transpose(2, 0, 1).astype(np.float32)
    panel = screen_panel()
    ph, pw = panel.shape[:2]
    src = np.float32([[0, 0], [pw, 0], [pw, ph], [0, ph]])
    p = writer(out)
    for a, key, c in zip(fr, keys, fit):
        M = cv2.getPerspectiveTransform(src, c)
        scr = cv2.warpPerspective(panel, M, (W, H), flags=cv2.INTER_AREA)
        poly = np.zeros((H, W), np.uint8)
        cv2.fillConvexPoly(poly, np.int32(np.round(c)), 255, cv2.LINE_AA)
        hold = cv2.dilate(key, np.ones((5, 5), np.uint8)) * 255        # 초록이 아닌 것(손)은 덮지 않는다
        al = cv2.GaussianBlur(cv2.min(cv2.dilate(poly, np.ones((5, 5), np.uint8)), hold).astype(np.float32) / 255, (0, 0), 1.1)[..., None]
        base = a.astype(np.float32)
        near = cv2.dilate(hold, np.ones((13, 13), np.uint8))[..., None] > 0   # 테두리에 번진 초록을 뺀다
        g = base[..., 1:2]
        lim = np.maximum(base[..., 0:1], base[..., 2:3])
        base[..., 1:2] = np.where(near, np.minimum(g, lim * 1.02), g)
        glow = cv2.GaussianBlur(scr * (poly[..., None] / 255), (0, 0), 22) * 0.16    # 화면 빛이 테두리에 조금 번진다
        o = base * (1 - al) + scr * al + glow * (1 - al)
        p.stdin.write(np.clip(o, 0, 255).astype(np.uint8).tobytes())
    p.stdin.close()
    p.wait()


def logo_layer():
    # 로고를 빛 기둥과 달리는 채원 사이 위쪽에 둔다 — 채원이 3.4초 동안 왼쪽으로 와도 글자와 안 겹치게(원본도 기둥과 러너 사이)
    lg = Image.open(os.path.join(V, "그래픽", "로고_가쁨.png"))
    w = round(W * LOGO_W)
    lg = lg.resize((w, round(lg.height * w / lg.width)), Image.LANCZOS)
    a = np.zeros((H, W, 4), np.float32)
    x, y = round(W * LOGO_X), round(H * LOGO_Y)
    a[y:y + lg.height, x:x + lg.width] = np.asarray(lg, np.float32) / 255
    return a


LOGO_W, LOGO_X, LOGO_Y = 0.22, 0.375, 0.24


def ending(pid, start, k, t0, out):
    fr = decode(C.clip(pid), f(start), k, fit=(f"scale=-2:{H}:flags=lanczos", f"crop={W}:{H}"))
    lg = logo_layer()
    on, off, back, last = f(LOGO_ON), f(LOGO_OFF), f(LOGO_BACK), f(END)
    p = writer(out)
    base = f(t0)
    for i, a in enumerate(fr):
        n = base + i
        lit = 0.0
        if on <= n < off:
            lit = 0.75
        elif n >= back:
            lit = 0.78 + 0.22 * (n - back) / max(1, last - back)   # 끝까지 조금씩 밝아짐
        if lit:
            al = lg[..., 3:] * lit
            a = (a.astype(np.float32) * (1 - al) + lg[..., :3] * 255 * al).astype(np.uint8)
        p.stdin.write(a.tobytes())
    p.stdin.close()
    p.wait()


def picture():
    d = os.path.join(OUT, "_컷")
    os.makedirs(d, exist_ok=True)
    paths = []
    for j, (t, kind, name, val) in enumerate(SEG):
        t1 = SEG[j + 1][0] if j + 1 < len(SEG) else END
        k = f(t1) - f(t)
        out = os.path.join(d, f"{j:02d}.mp4")
        if kind == "판":
            a = f(val)
            have = C.frames_of(C.clip(name))
            assert a + k <= have, f"{name} {val}초부터 {k}장 — {have}장뿐"
            C.cut_video(C.clip(name), a, k, W, H, FPS, out)
        elif kind == "조각":
            piece(name, val, k, out)
        elif kind == "모니터":
            monitor(name, val, k, out)
        elif kind == "끝":
            ending(name, val, k, t, out)
        print(f"{t:6.2f} {kind} {name} {val if val is not None else ''} {k}장", flush=True)
        paths.append(out)
    C.join_videos(paths, os.path.join(OUT, "화면.mp4"))


FAIR = "C:/Users/q1212/Documents/synk-vendor/sound-library/fairlight/Media Files/"
SON = "C:/Users/q1212/Documents/synk-vendor/sound-library/sonniss_gdc2026/풀림/"
VOICE_DIR = os.path.join(ROOT, "소리", "p5", "내레이션후보_20261105")   # 일레븐 v4 Jian.K(음높이 중앙값 177Hz — 원본 180Hz). 앞은 차분한 판 1, 뒤 넷은 끝으로 갈수록 힘이 붙는 판 2(아르곤 1차 「후반이 평탄」)
SONG = os.path.join(ROOT, "최종", "음악", "p5_일레븐", "곡_1.mp4")   # 일레븐 음악 v2.5 「Run Signal」 — Suno 내려받기가 11-11까지 0이라 임시. 곡이 평평해 크기 모양은 아래 곡선으로 만든다
# (판, 원고 안 시작, 끝, 화면 자리, 낱말) — 02_콘티 2절 자리. 끝 문장은 「진짜」 바로 뒤에 로고가 켜지게 조금 앞으로 · 「숨이,」는 끝 떨림을 잘랐다(아르곤 1차)
LINES = [("JianK_1", 0.00, 0.58, 1.65, "숨."), ("JianK_1", 0.98, 1.44, 4.91, "땀."), ("JianK_1", 1.79, 2.42, 9.41, "한 번 더."), ("JianK_1", 2.76, 3.60, 11.65, "한 바퀴 더."), ("JianK_1", 3.93, 5.02, 18.74, "어제보다 더."),
         ("JianK_1", 5.55, 6.02, 20.02, "숨이,"), ("JianK_2", 7.34, 8.71, 21.62, "턱 끝까지 차오른,"), ("JianK_2", 8.77, 9.63, 23.35, "그 자리에서,"), ("JianK_2", 9.75, 10.32, 25.75, "너는,"), ("JianK_2", 10.56, 12.05, 28.08, "진짜 너를 만난다.")]
# 곡 크기 곡선(초, dB) — 02_콘티 4절 · 원본 0.25초 크기. 전체 곡과 저역만 남긴 곡을 나눠 움직인다(침묵 구간에도 박동이 남게)
MUSIC_TRIM = -8
FULL = [(0, -12), (0.9, -12), (1.1, -18), (1.55, -18), (1.7, -12), (3.9, -12), (4.05, -19), (4.75, -19), (4.85, -11), (5.8, -11), (6.13, -4), (8.9, -3), (9.02, -26), (9.45, -26), (9.7, -15), (11.4, -14), (11.6, -6), (12.6, -5), (13.2, -15), (18.4, -15), (18.55, -32), (19.0, -32), (19.15, -20), (19.7, -20),
        (19.8, -48), (20.3, -48), (20.75, -30), (21.3, 0), (26.4, 0), (26.9, 9), (29.25, 9), (30.03, -24)]
LOW = [(0, -6), (6, -6), (6.13, -10), (8.9, -10), (9.02, -30), (9.45, -30), (9.7, -3), (11.4, -3), (11.6, -6), (12.6, -6), (13.2, -2), (18.4, -2), (18.55, -24), (19.0, -24), (19.15, -8), (19.7, -8),
       (19.8, -36), (20.3, -36), (20.75, -20), (21.45, -20), (26.4, -20), (29.25, -24), (30.03, -50)]


def part(path, start=0.0, dur=None, af=None, stereo=False):
    a = ["ffmpeg", "-v", "error", "-ss", str(start)] + (["-t", str(dur)] if dur else []) + ["-i", path] + (["-af", af] if af else []) + ["-ac", "2" if stereo else "1", "-ar", str(C.RATE), "-f", "f32le", "-"]
    x = np.frombuffer(subprocess.run(a, capture_output=True, check=True).stdout, np.float32).copy()
    return x.reshape(-1, 2) if stereo else x


def gain_curve(points, n):
    xs, ys = zip(*points)
    return 10 ** (np.interp(np.arange(n) / C.RATE, xs, ys) / 20).astype(np.float32)


def heart(t_gap=0.26):
    # 9행 심장 박동 — 낮은 두 번 쿵(녹음 모음에 쓸 만한 것이 없어 만든다)
    n = int(1.0 * C.RATE)
    t = np.arange(n) / C.RATE
    def th(t0, amp):
        u = np.clip(t - t0, 0, None)
        return amp * np.sin(2 * np.pi * (46 + 26 * np.exp(-u * 30)) * u) * np.exp(-u * 13) * (t >= t0)
    return (th(0, 1.0) + th(t_gap, 0.62)).astype(np.float32)


def sound():
    m = C.Mix(END)
    n = int(END * C.RATE)
    # 곡
    dry = part(SONG, stereo=True)[:n]
    low = part(SONG, af="lowpass=f=280,lowpass=f=280", stereo=True)[:n]
    k = len(dry)
    bed = dry * gain_curve(FULL, k)[:, None] + low * gain_curve(LOW, k)[:, None]
    # 말
    takes = {n: part(os.path.join(VOICE_DIR, n + ".mp3")) for n in {l[0] for l in LINES}}
    duck = np.zeros(k, np.float32)
    for take, a, b, t, word in LINES:
        x = takes[take][int(a * C.RATE):int(b * C.RATE)]
        rms = float(np.sqrt(np.mean(x[np.abs(x) > 0.01] ** 2)))
        g = np.clip(-19 - 20 * np.log10(rms), -3, 6) * 0.7   # 낱말마다 크기를 반쯤 고른다 — 「땀.」 · 「숨이,」가 작게 나온 판
        m.put(t, x, g - 2 + (-5 if word == "숨이," else 0) + (-2.5 if take == "JianK_2" else 0), fade=0.012, fade_out=0.08)   # 「숨이,」는 소리가 가장 가라앉은 자리에서 혼자 — 원본도 작다
        i, j = int((t - 0.05) * C.RATE), int((t + (b - a) + 0.12) * C.RATE)
        duck[max(0, i):min(k, j)] = 1
    w = int(0.12 * C.RATE)
    duck = np.convolve(duck, np.ones(w, np.float32) / w, "same")
    bed = bed * (10 ** (-5.0 * duck / 20))[:, None]
    m.put(0, bed, MUSIC_TRIM, fade=0.002)

    # 효과음 — 임시(녹음 모음). 화면 사건은 다음 판에서 영상에 맞춰 뽑는다
    resp = SON + "344 Audio - Haunting Ambiences Vol. 5/HMNBrth_Respirator, Specimen Breathing, Mad Scientist Lab_344 Audio_Haunting Ambiences Vol 5.wav"
    run = FAIR + "FS run dirt.M.wav"
    hum = SON + "344 Audio - East Coast America Vol. 1/AMBSubn_Electricity Hum, Lightbulb,  Coil Pickup 01_344 Audio_East Coast America.wav"
    click = SON + "InMotionAudio - USA Hotel/MECHClik_USALightSwitch_On05_InMotionAudio_USAHotel.wav"
    boom = SON + "Federico Soler - Effective Trailer Booms Vol. 2/EffectiveTrailer_Booms_Vol2_011.wav"
    # 숨 — 1 유리 너머 · 2 가까이 · 12a · 19 정점 · 11 들릴락 말락
    m.put(0.0, part(resp, 12, 3.13, "lowpass=f=900"), -22, fade=0.1)
    m.put(3.13, part(resp, 30, 1.5, "lowpass=f=3200"), -9, fade=0.03)
    m.put(21.19, part(resp, 34, 0.29, "lowpass=f=3200"), -9, fade=0.01)
    m.put(21.38, part(boom, 0, 1.2, "lowpass=f=200"), -12, fade=0.004, fade_out=0.4)   # 21.5초 가장 큰 자리
    m.put(25.40, part(resp, 44, 1.08, "lowpass=f=2600"), -9, fade=0.03)   # 아르곤 1차 「치이익 · 가스 누출」 — 바람 소리를 빼고 숨 · 심장으로
    for t in (25.44, 26.10):
        m.put(t, heart(), -7, fade=0.003)
    m.put(19.2, part(resp, 52, 1.7, "lowpass=f=2600,highpass=f=200"), -20, fade=0.15, fade_out=0.3)
    m.put(5.42, part(resp, 58, 0.7, "highpass=f=300"), -22, fade=0.05)
    # 발 — 1 유리 너머 · 3 · 8 느리고 무겁게 · 10 벨트 위
    m.put(0.0, part(run, 2, 3.13, "lowpass=f=700"), -24, fade=0.1)
    m.put(4.80, part(run, 4.0, 0.62, "asetrate=48000*0.62,aresample=48000,lowpass=f=420"), -4, fade=0.01, fade_out=0.1)
    m.put(12.40, part(run, 4.0, 0.9, "asetrate=48000*0.55,aresample=48000,lowpass=f=340"), 2, fade=0.005, fade_out=0.2)
    m.put(12.42, part(boom, 0, 1.5, "lowpass=f=160"), -12, fade=0.005, fade_out=0.5)
    m.put(13.96, part(boom, 0, 1.8, "lowpass=f=120"), -18, fade=0.03, fade_out=1.2)   # 8 → 9 슬로로 넘어갈 때 소리가 뚝 끊기지 않게(아르곤 1차)
    m.put(16.60, part(run, 8, 2.29, "highpass=f=90,lowpass=f=1000"), -14, fade=0.03)
    m.put(21.73, part(run, 12, 0.29, "lowpass=f=1000"), -12, fade=0.005)
    # 9 — 물방울 · 심장
    m.put(14.06, part(FAIR + "Water Drips Drops.M.wav", 1.0, 2.54), -18, fade=0.1, fade_out=0.3)
    for t in (14.28, 15.18, 16.06):
        m.put(t, heart(), -8, fade=0.003)
    # 번쩍 조각 — 전기음 · 휙
    for t, d, db in [(6.13, 0.08, -18), (6.26, 0.08, -18), (6.38, 0.17, -20), (6.59, 0.29, -22), (6.88, 0.2, -22), (7.17, 0.13, -20), (7.47, 0.08, -18), (8.05, 0.17, -16), (8.43, 0.12, -20), (11.55, 0.25, -14), (21.02, 0.17, -14), (22.02, 0.13, -14), (23.19, 0.08, -14), (23.85, 0.09, -14), (25.23, 0.17, -14)]:
        m.put(t, part(hum, 3 + t % 5, d, "highpass=f=400"), db, fade=0.004)
    whoosh = FAIR + "Whooshes Quick Succession, Twirling Fast.M.wav"
    for t, st, d, db in [(7.30, 0.2, 0.25, -14), (7.67, 0.8, 0.38, -16), (8.26, 1.4, 0.2, -14), (22.81, 2.0, 0.38, -14), (23.77, 2.6, 0.1, -14)]:
        m.put(t, part(whoosh, st, d), db, fade=0.005, fade_out=0.05)
    m.put(23.98, part(click), -14, fade=0.002)
    # 20 금빛 빛줄기
    m.put(26.40, part(FAIR + "Sparkler Fast Whoosh.M.wav", 0, 0.5), -14, fade=0.01, fade_out=0.15)
    # 21 — 빛 기둥의 낮은 웅 · 로고 네온 딸깍 · 한 방 · 끝까지 작은 공간 소리
    m.put(26.65, part(hum, 8, END - 26.65 + 0.2, "lowpass=f=1800"), -26, fade=0.25)
    for t in (LOGO_ON, LOGO_BACK):
        m.put(t, part(click), -10, fade=0.002)
    m.put(26.65, part(SONG, 12.25, END - 26.65, "lowpass=f=1100", stereo=True), MUSIC_TRIM - 3, fade=0.12, fade_out=0.78)   # 곡 낙하 뒤가 비어 끝 3초가 힘이 없다(아르곤 1차) — 같은 박 자리의 앞 구간을 낮게 이어 29.25초부터 빠진다
    m.put(LOGO_ON - 0.01, part(boom, 0, 1.6, "lowpass=f=220"), -8, fade=0.004, fade_out=0.6)
    m.finish(os.path.join(OUT, "소리.wav"), boost_db=1.0)


def render():
    pic, snd = os.path.join(OUT, "화면.mp4"), os.path.join(OUT, "소리.wav")
    out = os.path.join(OUT, "가쁨_가편집_16x9.새판.mp4")
    a = ["-i", snd] if os.path.exists(snd) else []
    # -r를 주면 첫 장이 겹치고 끝 장이 빠져 한 프레임 밀린다(로고 깜빡임 · 번쩍 조각이 어긋남) — 프레임을 그대로 옮긴다
    C.run("ffmpeg", "-y", "-v", "error", "-i", pic, *a, "-fps_mode", "passthrough", "-c:v", "libx264", "-crf", "16", "-preset", "slow", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", *(["-c:a", "aac", "-b:a", "256k"] if a else []), "-movflags", "+faststart", out)
    final = os.path.join(OUT, "가쁨_가편집_16x9.mp4")
    os.replace(out, final)
    out = final
    C.run("ffmpeg", "-y", "-v", "error", "-i", out, "-vf", "scale=1280:-2", "-c:v", "libx264", "-crf", "23", "-preset", "medium", *(["-c:a", "aac", "-b:a", "128k"] if a else []), "-movflags", "+faststart", os.path.join(OUT, "가쁨_가편집_16x9_폰.mp4"))
    C.run("ffmpeg", "-y", "-v", "error", "-i", out, "-vf", "fps=2,scale=240:-2,tile=10x6:padding=3", "-frames:v", "1", "-q:v", "4", os.path.join(OUT, "_반초.jpg"))
    print(out)


if __name__ == "__main__":
    assert all(a[0] < b[0] for a, b in zip(SEG, SEG[1:])), "시각이 차례대로가 아니다"
    jobs = {"화면": picture, "소리": sound, "판": render}
    for w in sys.argv[1:] or ["화면", "소리", "판"]:
        jobs[w]()
