# 4번 패션 필름 「결채 — 한 벌」 최종 편집(2026-11-07, Claude) — 02_콘티 2절 35컷 + 끝 화면을 원본(Yeio 「MARAH (SS25)」) 시각 그대로 하드컷으로 잇는다.
#   python -X utf8 최종편집.py [화면] [소리] [판]   → git 밖 pulse-portfolio12-20261024/최종/p4/결채_16x9.mp4 · _16x9_폰.mp4 · _반초.jpg
#   python -X utf8 최종편집.py 낱장 <초> [<초> …]     → 최종/p4/_낱장/t<초>.png(번쩍 · 로고까지 얹은 화면 확인)
# 후보정 없음(결정 10-24): 받은 판의 색 · 밝기 · 떨림 · 속도를 건드리지 않고 시작 장부터 잘라 잇기만 한다. 쓰는 판 · 시작 장은 CUTS 한 곳이다.
# 원본 전환 셋(결정 10-26 「살린다」) 가운데 흰 빛 번쩍(10 · 17a · 31)만 여기서 만든다 — 원본처럼 나가는 장면이 하얗게 타고(1장), 아래쪽에 따뜻한 가로 빛줄이
#   지나가는 흰 장(1~2장)으로. 유리 겹침(12 · 14 · 20 · 24)과 어두워졌다 떠오름(8 · 32)은 그림 · 판 안에 있다.
# 판 고르기 · 시작 장의 근거(편집전점검.py · 겹친장.py · 원본 대조표 · 장 확대)는 02_콘티 8절 표.
import os
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import 최종편집공통 as C

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024"
STILL = os.path.join(ROOT, "콘티", "p4", "컷")
OUT = os.path.join(ROOT, "최종", "p4")
NAME = "결채_16x9"
FPS, W, H = 24, 1920, 1080

# 컷 경계(초) — 01_샷표_원본 2절 · 02_콘티 2절 그대로(35컷 + 끝 화면 · 30.00초)
T = [0.00, 0.25, 2.13, 2.25, 2.34, 2.46, 2.63, 3.42, 4.59, 5.09, 5.21, 6.55, 6.71, 6.88, 7.09, 7.92, 8.68, 9.59, 9.68, 10.22, 11.26,
     12.18, 13.35, 15.10, 15.43, 16.14, 17.02, 18.85, 19.94, 21.56, 22.61, 24.32, 24.40, 24.94, 25.27, 26.28, 30.00]
NAMES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "17a", "18", "19", "20",
         "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31", "32", "33", "34", "끝"]
F = [round(t * FPS) for t in T]   # 장 경계 — 끝 720장
TF = [f / FPS for f in F]         # 화면이 실제로 자르는 시각 — 소리 · 로고는 이 값으로 놓는다

# 컷 → ("판", 그 판에서 시작하는 장) · ("그림", 파일) · ("검정",) · ("번쩍", 앞 컷 이름, 뒤 컷 이름)
CUTS = {
    "1": ("검정",),
    "2": ("판", "p4-02b", 0),         # 아이보리 개버딘 능직 극접사 — 어둠에서 밝아지며 고르게 다가감. 다시 낸 판(받은 p4-02는 올리브 트윌 — 입은 옷의 색이 아님, Fable 1차).
                                      #   원본(L 11 → 42)보다 밝지만(43 → 95), 노출을 내린 그림으로 다시 낸 02d는 밝아지며 결이 얼룩처럼 뭉개져 깨끗한 02b를 씀
    "3": ("그림", "C03.png"),          # 번쩍 묶음: 버클 · 뿔 단추 · 억새밭 와이드 · 가방 옆면(정지 그림, 02_콘티 4절 2)
    "4": ("그림", "C04.png"),
    "5": ("그림", "C05.png"),
    "6": ("그림", "C06.png"),
    "7": ("판", "p4-07", 0),          # 밤 감나무 실루엣 — 다가감
    "8": ("판", "p4-08m", 0),         # 흙담 대문간의 유나 — 다시 낸 판(m2v). 빛이 0.33초에 가장 밝고 0.88초에 가라앉는 맥박(원본 0.42 · 1.13초).
                                      #   받은 p4-08은 1.25초에야 가장 밝고(L 43) 3.5초에 걸쳐 가라앉았다
    "9": ("판", "p4-09", 0),          # 앵클부츠 접사 — 다가감
    "10": ("번쩍", "9", "11"),
    "11": ("판", "p4-11", 0),         # 얼굴 극접사 · 눈 내리깖
    "12": ("그림", "C12.png"),         # 유리 겹침 얼굴(눈 감음) · 팔짱 3/4 · 흐린 겹상(정지 그림)
    "13": ("그림", "C13.png"),
    "14": ("그림", "C14.png"),
    "15": ("판", "p4-15", 0),         # 얼굴 극접사로 돌아옴 — 물러남
    "16": ("판", "p4-16", 0),         # 크림 니트 올(붉은빛) — 아래로 흐름
    "17": ("판", "p4-17m__2", 51),    # 억새밭 바람 · 낮은 앵글 — 다시 낸 판(m2v) 둘째 벌. 판 57장에 눈을 뜨기 시작해 컷 0.25초에 눈을 뜨고 바람 쪽 앞을 본다(결정 11-01).
                                      #   받은 p4-17은 끝까지 눈을 감았고 4장마다 같은 장, 첫 벌 17m은 렌즈를 정면으로 봐 「맹한 정면」이라 둘째 벌
    "17a": ("번쩍", "17", "18"),
    "18": ("판", "p4-18", 0),         # 억새 씨앗 역광 접사
    "19": ("판", "p4-19", 0),         # 가방을 위에서 — 다가감
    "20": ("판", "p4-20m", 63),       # 유리 겹상이 밀려들어 얼굴이 흐린 겹상으로 — 다시 낸 판(m2v). 판 안에서 2.9~3.5초에 일어나 2.625초부터(원본은 컷 0.33~0.83초).
                                      #   받은 p4-20은 같은 자리에 4장마다 같은 장
    "21": ("판", "p4-21p__2", 62),    # 억새밭을 걷는 유나 — 셋째로 다시 낸 판(m2v, 시작 그림 + 얼굴을 F01 세트로 40° 돌린 끝 그림 C21e_b 참고). 허리에서 올라가
                                      #   끝에 3/4 얼굴이 들어온다(닮음 0.40). 받은 p4-21은 4장마다 같은 장, 21n은 끝 얼굴이 다른 사람(0.36 · Fable 1차), 21p 첫 벌은 2.5초에 화면이 튐
    "22": ("판", "p4-22", 0),         # 흙담 빈 창틀 앞 실루엣 — 물러남
    "23": ("판", "p4-23b", 20),       # 복숭아빛 얼굴 · 목에 댄 손(0.33초) — 다시 낸 판(시작 그림 C23_c: 이마에서 잘린 틀 · 왼쪽 강한 빛 · 렌즈를 올려다봄).
                                      #   받은 p4-23은 가운데 정면 · 평평한 빛 · 힘 뺀 표정(Fable 1차 · 11-05 조건 셋). 0.83초부터 눈이 렌즈에 머문다(닮음 0.45)
    "24": ("판", "p4-24m", 40),       # 허리에 손 · 유리 겹상이 걷힘 — 다시 낸 판(m2v, 몸 · 자세 낱말 없는 지시문). 겹상이 1.67~2.4초에 걷히는 자리.
                                      #   원문 지시문은 코드 20114로 여섯 번 실패(02_콘티 8절)
    "25": ("판", "p4-25", 0),         # 밤 붉은 흙담 · 긴 그림자 — 아래로(판 1초 뒤 큰 회전은 쓰지 않음)
    "26": ("판", "p4-26", 0),         # 빈 창틀 역광 실루엣 · 두 팔
    "27": ("판", "p4-27", 33),        # 흙길 부츠 — 판 앞 1.2초는 한 발이 서 있기만 해, 다른 발이 들어와 딛는 1.375초부터
    "28": ("판", "p4-28", 0),         # 가방을 든 손 — 다가감
    "29": ("판", "p4-29b", 61),       # 코트의 아이보리 개버딘 주름 — 다시 낸 판(광택 새틴이 「입은 옷에 없는 소재 · 스톡 렌더」, Fable 1차). 다가감 끝에 줌 흐림, 2.54초부터
    "30": ("판", "p4-30b__2", 46),    # 밤 붉은 아치 · 팔을 벌려 흔듦 — 다시 낸 판(한 단계 가까운 무릎 위 틀의 C30_b). 받은 p4-30은 얼굴이 다른 사람(0.34 · Fable 1차).
                                      #   1.92초부터 얼굴이 끝까지 화면 안(닮음 0.39~0.41). 첫 벌 30b는 1초 뒤 얼굴이 화면 위로 나감
    "31": ("번쩍", "30", "32"),
    "32": ("판", "p4-32m", 50),       # 마른 덤불 속 유나가 어둠으로 — 다시 낸 판(m2v, 시작 그림을 원본 밝기로 고친 C32b). 받은 p4-32는 처음부터 L 2~3(거의 검정)
    "33": ("판", "p4-33-34", 0),      # 붉은 어둠 속 옆얼굴 — 두 샷 판의 첫 샷
    "34": ("판", "p4-33-34", 29),     # 흙담에 기댄 전신 — 판 안 하드컷 #29부터
    "끝": ("판", "p4-endb", 0),       # 아이보리 울 개버딘 결 극접사(잔털 · 사광) + 직접 그린 「결채」 — 다시 낸 판(시작 그림 CEND_b). 받은 판은 황갈색 트윌이라
                                      #   「코트 천이 아니고 렌더처럼 밋밋」(Fable 1차). 둘째 벌은 다가감이 1.33배로 빨라 첫 벌
}

# ---------- 끝 로고(원본 끝 화면: 워드마크가 컷 0.08초 뒤 바로 서고, 2.08초 뒤 작은 줄이 0.8초에 걸쳐 떠오름, 마지막 0.5초 어둡게)
LOGO_H = 176          # 「결채」 글자 칸 높이(px) — 첫 판 132px(폭 14%)는 원본 MARÁH(폭 39%) 존재감의 40% 남짓이라 「소심」, 시안 A · B · C 맹검에서 B(Fable 11-07)
LINE_H = None         # 작은 줄 GYEOLCHAE는 뺀다 — 그린 세리프가 기성 세리프로 읽혀 한글 마크와 짝이 안 맞았다(Fable), 콘티 1절도 「결채」 한 줄
LOGO_CY = 0.465       # 워드마크 세로 가운데(화면 높이 몫)
LOGO_IN = 2 / FPS     # 끝 컷 시작에서 워드마크가 서는 때(원본 65.10 − 65.02)
LINE_IN = (2.08, 2.88)
FADE_OUT = 0.5        # 마지막 0.5초 어둡게(02_콘티 1절)


def ease(x):
    x = min(1.0, max(0.0, x))
    return 3 * x * x - 2 * x * x * x


def logo_parts():
    import 결채_로고
    word, line, gap = 결채_로고.render(LOGO_H, LINE_H)
    return word.astype(np.float32), (None if line is None else line.astype(np.float32)), gap


def put(frame, img, x, y, alpha=1.0):
    if alpha <= 0:
        return
    x, y = int(round(x)), int(round(y))
    h, w = img.shape[:2]
    x0, y0, x1, y1 = max(0, x), max(0, y), min(frame.shape[1], x + w), min(frame.shape[0], y + h)
    sub = img[y0 - y:y1 - y, x0 - x:x1 - x]
    a = sub[..., 3:4] / 255.0 * alpha
    frame[y0:y1, x0:x1] = frame[y0:y1, x0:x1] * (1 - a) + sub[..., :3] * a


def draw_logo(frame, t, parts):
    """t = 끝 컷 안 초"""
    word, line, gap = parts
    if t >= LOGO_IN:
        cy = H * LOGO_CY
        put(frame, word, (W - word.shape[1]) / 2, cy - word.shape[0] / 2)
        if line is not None:
            a = ease((t - LINE_IN[0]) / (LINE_IN[1] - LINE_IN[0]))
            put(frame, line, (W - line.shape[1]) / 2, cy + word.shape[0] / 2 + int(LOGO_H * 0.20) - 12, alpha=a)   # 원본처럼 워드마크 바로 밑


# ---------- 흰 빛 번쩍
def leak(seed, y0, y1, strength):
    """아래쪽 가로 빛줄(필름 번쩍의 따뜻한 띠) — (H, W, 3) 색과 (H, W, 1) 몫.
    띠는 세로로 부드럽고(가우스), 가로로 진하기가 고르지 않다 — 화면 폭 전체에 고른 곧은 줄은 디지털 화면 깨짐처럼 보였다(첫 판)"""
    r = np.random.default_rng(seed)
    ys = (np.arange(H) / H)[:, None]
    xs = (np.arange(W) / W)[None, :]
    c0, sig = (y0 + y1) / 2, (y1 - y0) / 3.2
    band = np.exp(-0.5 * ((ys - c0) / sig) ** 2)
    xm = 0.5 + 0.5 * np.sin(2 * np.pi * (xs * r.uniform(0.6, 1.1) + r.uniform(0, 1)))
    xm = 0.25 + 0.75 * (0.6 * xm + 0.4 * (0.5 + 0.5 * np.sin(2 * np.pi * (xs * r.uniform(1.8, 2.6) + r.uniform(0, 1)))))
    lines = np.ones((H, W))
    for _ in range(2):   # 띠 안의 옅은 줄 둘 — 가로로도 진하기가 바뀐다
        c, w = r.uniform(c0 - sig, c0 + sig), r.uniform(0.006, 0.014)
        lines *= 1 - 0.35 * np.exp(-((ys - c) / w) ** 2) * (0.4 + 0.6 * xm)
    k = (band * xm * strength)[..., None]
    # 띠 가운데는 주황, 위아래 가장자리는 옅은 시안 — 원본 필름 광누출의 색번짐(첫 판의 단색 띠는 Fable 「블러 바」)
    edge = np.clip(np.abs(ys - c0) / (2.2 * sig), 0, 1)[..., None]
    amber, cyan = np.array([255, 168, 96], np.float32), np.array([150, 222, 236], np.float32)
    tint = (amber * (1 - edge) + cyan * edge) * lines[..., None]
    return tint, k


def sink(fr, from_frame, floor=0.12):
    """컷 끝에서 빛이 꺼지듯 어둠으로 — 원본 32(0.3초부터 꺼짐 → 33 옆얼굴). 받은 판은 4초에 걸쳐 천천히 어두워져 컷 0.54초 안에서는 거의 그대로였다(Fable 11-07).
    10번 31 → 32 밝기 램프와 같은 전환(결정 10-26 「어두워졌다 떠오름」 살림) — 색 · 대비는 그대로 두고 밝기만 내린다"""
    out = list(fr)
    n = len(out) - from_frame
    for i in range(n):
        g = 1 - (1 - floor) * ((i + 1) / n) ** 1.3
        out[from_frame + i] = np.clip(out[from_frame + i].astype(np.float32) * g + 0.5, 0, 255).astype(np.uint8)
    return out


def flash_frames(prev, nxt, n):
    """번쩍 컷 n장 — prev는 나가는 판의 다음 장들(번쩍 동안 이어지는 그림), nxt는 들어오는 컷 첫 장"""
    out = []
    white = np.full((H, W, 3), 255.0, np.float32)
    specs = {3: [(0.42, None), (0.88, (0.60, 0.80, 0.55)), (0.97, (0.89, 0.93, 0.35))],
             2: [(0.88, (0.60, 0.80, 0.55)), (0.97, (0.89, 0.93, 0.35))]}[n]
    for i, (k, band) in enumerate(specs):
        base = prev[min(i, len(prev) - 1)].astype(np.float32)
        f = base * (1 - k) + white * k
        if i == 0 and n == 3:
            f = f * np.array([0.96, 0.99, 1.04], np.float32)   # 원본 5.09초처럼 첫 장은 살짝 푸르게 타오름
        if band:
            tint, a = leak(17 + i, *band)
            f = f * (1 - a) + (base * 0.45 + tint * 0.55) * a
        out.append(np.clip(f, 0, 255))
    return out


def prewash(fr, k=0.38):
    """번쩍 바로 앞 장 — 원본 9.54 · 24.28초처럼 나가는 장면의 끝 한 장이 먼저 하얗게 탄다"""
    tint, a = leak(5, 0.62, 0.78, 0.35)
    f = fr.astype(np.float32) * (1 - k) + 255 * k
    return np.clip(f * (1 - a) + (fr * 0.5 + tint * 0.5) * a, 0, 255)


# ---------- 화면
def decode(src, a, k):
    """판의 a장부터 k장을 W×H RGB(uint8)로 — 판 → bt709 크기 바꿈(드리미나 파일 머리 60fps와 상관없이 실제 장 순서)"""
    vf = (f"select='between(n,{a},{a + k - 1})',setpts=N/{FPS}/TB,scale={W}:{H}:flags=lanczos:out_color_matrix=bt709,format=yuv420p,"
          "scale=in_color_matrix=bt709:in_range=tv,format=rgb24")
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-an", "-fps_mode", "passthrough", "-vf", vf, "-frames:v", str(k), "-f", "rawvideo", "-"],
                         capture_output=True, check=True).stdout
    fr = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)
    if len(fr) != k:
        raise SystemExit(f"{src}: {a}장부터 {k}장이 필요한데 {len(fr)}장")
    return fr


def still(name):
    from PIL import Image
    im = Image.open(os.path.join(STILL, name)).convert("RGB").resize((W, H), Image.LANCZOS)
    return np.asarray(im)


def cut_frames(i, parts):
    """i번째 컷의 장들(uint8 또는 float) — 번쩍 앞뒤 장 손질은 picture()가 한다"""
    name, k = NAMES[i], F[i + 1] - F[i]
    spec = CUTS[name]
    if spec[0] == "검정":
        return [np.zeros((H, W, 3), np.uint8)] * k
    if spec[0] == "그림":
        return [still(spec[1])] * k
    if spec[0] == "판":
        _, pid, a = spec
        have = C.frames_of(C.clip(pid))
        if a + k > have:
            raise SystemExit(f"#{name} {pid}: {a}장부터 {k}장이 필요한데 {have}장뿐")
        fr = decode(C.clip(pid), a, k)
        if name == "끝":
            def ending():   # 장마다 float로 바꿔 얹는다 — 89장을 한꺼번에 float로 두면 2GB가 넘는다
                for j in range(k):
                    f = fr[j].astype(np.float32)
                    draw_logo(f, j / FPS, parts)
                    left = (k - j) / FPS
                    if left <= FADE_OUT:
                        f *= max(0.0, (left - 1 / FPS) / FADE_OUT)
                    yield f
            return ending()
        return list(fr)
    if spec[0] == "번쩍":
        prev = CUTS[spec[1]]
        if prev[0] == "판":
            pk = F[NAMES.index(spec[1]) + 1] - F[NAMES.index(spec[1])]
            nxt_from = prev[2] + pk
            have = C.frames_of(C.clip(prev[1]))
            cont = decode(C.clip(prev[1]), min(nxt_from, have - k), k)
        else:
            cont = [still(prev[1])] * k
        return flash_frames(list(cont), None, k)
    raise ValueError(spec)


def picture():
    os.makedirs(OUT, exist_ok=True)
    parts = logo_parts()
    out = os.path.join(OUT, "화면.mp4")
    p = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                          "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p", "-c:v", "libx264", "-crf", "12", "-preset", "medium", "-r", str(FPS),
                          "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", out], stdin=subprocess.PIPE)
    total = 0
    for i in range(len(NAMES)):
        fr = cut_frames(i, parts)
        name = NAMES[i]
        nxt = NAMES[i + 1] if i + 1 < len(NAMES) else None
        if nxt and CUTS[nxt][0] == "번쩍" and name in ("17", "30"):
            fr = list(fr)
            fr[-1] = prewash(fr[-1])   # 원본 9.54 · 24.28초 — 번쩍 앞 장이 먼저 탄다(10은 원본도 번쩍 컷 안에서 탄다)
        if name == "32":
            fr = sink(fr, 7, floor=0.5)   # 컷 0.29초(7장)부터 빛이 꺼진다(원본 0.3초). 0.12배는 끝 두 장이 완전 검정(L 0.6), 0.3배도 L 0.8 — 원본처럼 L 3 안팎에서 33으로(Fable 2차)
        n = 0
        for f in fr:
            p.stdin.write(f.tobytes() if f.dtype == np.uint8 else np.clip(f + 0.5, 0, 255).astype(np.uint8).tobytes())
            n += 1
        total += n
        if n != F[i + 1] - F[i]:
            raise SystemExit(f"#{name}: {n}장 — {F[i + 1] - F[i]}장이어야 한다")
        spec = CUTS[name]
        src = f"{spec[1]} {spec[2]}장({spec[2] / FPS:.2f}초)부터" if spec[0] == "판" else spec[0] + (f" {spec[1]}" if spec[0] == "그림" else "")
        print(f"#{name:>3} {src:32s} {n:3d}장 → 화면 {TF[i]:.2f}–{TF[i + 1]:.2f}초")
    p.stdin.close()
    if p.wait():
        raise SystemExit("인코딩 실패")
    n = C.frames_of(out)
    if n != F[-1]:
        raise SystemExit(f"화면 {n}장 — {F[-1]}장이어야 한다")
    print("화면", n, "장", out)


def sound():
    import 최종소리
    최종소리.build(os.path.join(OUT, "소리.wav"), TF)


def render():
    out, raw = os.path.join(OUT, NAME + ".mp4"), os.path.join(OUT, "_렌더.mp4")
    C.run("ffmpeg", "-y", "-v", "error", "-i", os.path.join(OUT, "화면.mp4"), "-i", os.path.join(OUT, "소리.wav"), "-map", "0:v", "-map", "1:a",
          "-c:v", "copy", "-c:a", "aac", "-b:a", "384k", "-ar", "48000", "-t", f"{TF[-1]:.3f}", "-movflags", "+faststart", raw)
    C.run("node", os.path.join(C.REPO, "tools", "음량마감.mjs"), raw, out, "--목표", "-14", "--덮어쓰기")
    C.run("ffmpeg", "-y", "-v", "error", "-i", out, "-vf", "scale=1280:-2", "-c:v", "libx264", "-crf", "23", "-preset", "medium", "-c:a", "aac", "-b:a", "160k",
          "-movflags", "+faststart", os.path.join(OUT, NAME + "_폰.mp4"))
    C.run("ffmpeg", "-y", "-v", "error", "-i", out, "-vf", "fps=2,scale=240:-2,tile=12x5:padding=3", "-frames:v", "1", "-q:v", "4", os.path.join(OUT, "_반초.jpg"))
    print(out)


def stills(*secs):
    d = os.path.join(OUT, "_낱장")
    os.makedirs(d, exist_ok=True)
    src = os.path.join(OUT, NAME + ".mp4")
    if not os.path.exists(src):
        src = os.path.join(OUT, "화면.mp4")
    for s in secs:
        n = int(round(float(s) * FPS))
        C.run("ffmpeg", "-y", "-v", "error", "-i", src, "-vf", f"select=eq(n\\,{n})", "-frames:v", "1", os.path.join(d, f"t{float(s):05.2f}.png"))
    print(d)


if __name__ == "__main__":
    what = sys.argv[1:] or ["화면", "소리", "판"]
    if what[0] == "낱장":
        stills(*what[1:])
        raise SystemExit
    os.makedirs(OUT, exist_ok=True)
    for w in what:
        {"화면": picture, "소리": sound, "판": render}[w]()
