# 로맨스 단편 「다 비침」 최종 편집(2026-11-07, Claude) — 02_콘티 4절 70컷을 우리 초대로 하드컷으로 잇고(검은 화면 C65 포함), 화면 처리(회상 띠 · 김 서린 유리 손글씨 ·
# C01 앞 가림 · 제목 카드 뿌연 판 · C51 휴대폰 사진 · C66 페이드)를 화면 단계에서 굽는다. 소리는 최종소리.py, 화면 글(말자막 · 제목 · 로고 · 끝)은
# 자막시안_20261103/remotion의 rs(src/rs/RS.tsx)가 얹는다.
#   python -X utf8 최종편집.py [화면] [소리] [판]        → git 밖 pulse-portfolio12-20261024/최종/rs/다비침_16x9.mp4 · _16x9_폰.mp4 · _반초.jpg
#   python -X utf8 최종편집.py 컷 C23 C54             → 그 컷만 다시 굽고 화면.mp4를 다시 잇는다
# 후보정 없음(결정 10-24): 받은 판의 색 · 밝기 · 떨림 · 속도는 건드리지 않고 시작점부터 잘라 잇는다. 화면 처리는 02_콘티 3절 「후반 합성」 몫만.
# 쓰는 판 · 시작점은 CUTS 한 곳이다(git 밖 받음/_검수/로맨스_쓸판_20261107.json을 따르고, 11-07 이 세션이 다시 낸 판으로 바꾼 컷은 머리말에 적음):
#   손 인서트 C15 · C30 · C56 · C67 — 시작 그림의 손만 태준 손에 맞춰 고친 rs-C15h · rs-C30h · rs-C56h · rs-C67m(겹침이면 rs-C67h)
#   C64 — 꽂힌 우산이 멈춰 있던 판 대신 떨어지기 직전 그림에서 m2v로 낸 rs-C64m
#   첫 편집본 맹검(Fable 「고치고 통과」 · Gemini 둘) 뒤: C32 분홍 반짝이 물보라 → 닿기 직전 그림에서 낸 rs-C32m__4(다섯 벌 중 자연스러운 낮은 물 튐 · 4장 겹침 없음),
#     C28 손잡이 위로 솟은 검은 대 → 우산만 고친 시작 그림의 rs-C28n, C48 술상 뒤에 선 우산 → 부스 벽에 기댄 rs-C48n__2(목소리는 옛 rs-C48 — 아래 최종소리.py)
#   둘째 판 맹검(Fable 「고치고 통과」 · Gemini 둘) 뒤: C64 떠서 내려앉음 → 무게로 떨어지는 글의 rs-C64g__2, C20 판 안 1초 이중 노출 → 끝 그림 없이 낸 rs-C20n
import os
import shutil
import subprocess
import sys

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
import 최종편집공통 as C  # noqa: E402

ROOT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024"
OUT = os.path.join(ROOT, "최종", "rs")
CONTI = os.path.join(ROOT, "콘티", "romance")
CAP = os.path.join(HERE, "..", "자막시안_20261103")
PUB = os.path.join(ROOT, "최종", "자막시안_public", "rs")
PEN = os.path.join(OUT, "서체", "NanumPenScript-Regular.ttf")   # 나눔손글씨 펜(OFL) — 김 서린 유리에 손가락으로 쓴 글
FPS, W, H = 24, 1920, 1080
BAR = 240   # 회상 좌우 띠(그림 4:3 = 1440×1080)

NAMES = [f"C{i:02d}" for i in range(1, 71)]
# 컷 길이(장) — 02_콘티 4절 우리 초를 24장/초로(합 6596장 = 274.83초). C55 · C56만 받은 두 샷 판의 컷 자리(2.66초)에 맞춰 64 · 27로 옮겼다(합은 그대로)
#   C20 · C21은 다시 낸 rs-C20n이 169장이라 170 · 102 → 169 · 103(C21은 시작점을 한 장 앞으로 — 합 · 뒤 컷 자리는 그대로)
LEN = [64, 79, 47, 86, 96, 84, 72, 127, 23, 23, 109, 100, 73, 182, 23, 42, 83, 148, 183, 169, 103, 105, 191, 66, 72, 42, 158, 79, 71, 59, 19, 67, 98, 84,
       80, 36, 54, 110, 97, 72, 106, 98, 142, 85, 75, 81, 117, 109, 152, 158, 101, 54, 346, 170, 64, 27, 109, 97, 44, 166, 37, 152, 107, 56, 35, 82, 48, 58, 108, 136]
assert len(LEN) == 70 and sum(LEN) == 6596
F = [0]
for n in LEN:
    F.append(F[-1] + n)
FLASH = set([f"C{i:02d}" for i in range(7, 24)] + [f"C{i:02d}" for i in range(41, 55)])   # 회상 — 좌우 띠

# 컷 → (판, 시작 장). 장은 실제 24장/초 차례(드리미나 파일 머리 60fps와 상관없음). m2v 판(이름 끝 m)은 첫 장이 그림과 조금 달라 3장 넘게 뒤에서.
# 말 자리는 뗀 목소리의 소리 덩어리(봉우리 −26 dB 위)로 잼 — 말이 컷 0.4초 뒤쯤 들어와 컷 끝 0.2초 앞에 끝나게(입 보이는 줄은 판 그대로 맞춤)
CUTS = {
    "C01": ("rs-C01", 6),
    "C02": ("rs-C02", 11),        # 「저 좋아하죠?」 판 1.06–1.80 → 컷 0.60초
    "C03": ("rs-C03", 24),        # 말문이 막혀 입술이 열렸다 닫힘(판 1.5–2.5)
    "C04": ("rs-C04", 35),        # 「좋아하냐고요.」 판 3.64–4.44 → 컷 2.18초(판 끝까지)
    "C05": ("rs-C05m2", 4),
    "C06": ("rs-C06", 0),
    "C07": ("rs-C07m", 10),       # 민재 판 1.30–3.28 → 컷 0.88–2.86
    "C08": ("rs-C08", 0),         # 「뭐, 아직은….」 1.56 · 유나가 앞을 지남 3.2–4.4(원본 3.1–4.3)
    "C09": ("rs-C09-10", 50),     # 두 샷 판 — 컷 자리 72→73장(3.04초), C09는 그 앞 23장(50–72)
    "C10": ("rs-C09-10", 73),
    "C11": ("rs-C11", 8),         # 첫 0.25초 화면이 3% 뒤로 튐 — 그 뒤부터
    "C12": ("rs-C12m__2", 14),    # 「고맙습니다」 판 2.16–3.34 → 컷 1.58초(판 0–1.56 웅얼거림은 소리에서 뺌)
    "C13": ("rs-C13", 12),
    "C14": ("rs-C14m", 3),        # 민재 1.10 · 태준 5.16(판). 5.17→5.25초에 와이드 → 미디엄으로 한 번 뜀(원본은 이어진 다가감) — 손짓이 이어져 동작에 맞춘 컷으로 둠
    "C15": ("rs-C15h", 12),       # 하트가 뛰다 다른 손이 덮음(판 0.5–1.46)
    "C16": ("rs-C15-16", 66),     # 두 샷 판 둘째 샷(2.65초부터)
    "C17": ("rs-C17", 6),
    "C18": ("rs-C18m", 3),
    "C19": ("rs-C19m", 6),
    "C20": ("rs-C20n", 0),       # 끝 그림 없이 다시 낸 판 — 옛 rs-C20은 판 안 3.7~4.5초에 두 구도가 1초 겹침(이중 노출). 말 2.52–6.02 · 초점 이동 판 4.4–5.4
    "C21": ("rs-C21m", 42),       # 쓸판 「쓰는 구간 1.83~6.08」 — 말 4.52–5.70 · C20이 한 장 짧아져 한 장 앞부터(판 145장 끝까지)
    "C22": ("rs-C22", 40),        # 말 2.66–4.98 → 컷 0.99–3.31
    "C23": ("rs-C23", 1),
    "C24": ("rs-C24", 31),        # 말 2.48–3.24 → 컷 1.19
    "C25": ("rs-C25", 25),        # 「아니, 뭐….」 2.48–3.22 → 컷 1.44(Demucs로 뗌 — 허깅페이스 떼기는 바탕으로 넘김)
    "C26": ("rs-C26m", 6),
    "C27": ("rs-C27", 29),        # 말 3.30–7.60 → 컷 2.09–6.39
    "C28": ("rs-C28n", 8),        # 젖빛 마개가 손잡이 끝(옛 rs-C28-29 첫 샷은 손 위로 검은 대가 솟음) — 「다 보여요,」는 옛 판 소리를 컷 끝 0.4초 앞으로(J컷)
    "C29": ("rs-C28-29", 122),    # 둘째 샷(91장부터) — 「…과장님.」 판 7.12 → 컷 2.04
    "C30": ("rs-C30h", 24),       # 그녀 손이 들어와 그의 손가락이 감김(판 1.0–3.46)
    "C31": ("rs-C30-31", 80),     # 옛 두 샷 판 둘째 샷(3.25초부터) — 놀라 내려다봄
    "C32": ("rs-C32m__4", 8),     # 떨어지는 끝(판 0.33)부터 — 0.78 닿음 · 1.0–1.6 잔 물방울이 튀고 가라앉음(__2는 왕관 물보라였지만 4장 겹침 6/6)
    "C33": ("rs-C33", 10),
    "C34": ("rs-C34m", 12),
    "C35": ("rs-C35", 10),
    "C36": ("rs-C36-37", 12),     # 「넌 그대로다.」 판 0.84–1.60 → 컷 0.34
    "C37": ("rs-C36-37", 60),     # 둘째 샷(2.25초부터)
    "C38": ("rs-C38", 20),        # 「여전히 다 보여.」 4.12–4.96 → 컷 3.29. 판 5.45초 뒤 오른쪽 위에 자홍 빛이 들어와(24장부터면 끝 장에 걸림) 컷을 5.41초에서 끝냄
    "C39": ("rs-C39", 12),
    "C40": ("rs-C40", 0),
    "C41": ("rs-C41", 5),         # 민재 0.26–2.48. 태준 「아…」(판 4.92 한숨)는 소리에서 컷 안으로
    "C42": ("rs-C42", 0),
    "C43": ("rs-C43m2__2", 3),    # 「잠깐만요.」 1.02 · 유나가 탐 2.5 — 끝(6.5초 뒤) 유나가 그를 보는 자리는 컷 밖
    "C44": ("rs-C44", 36),        # 손이 헤드폰으로(판 3.5–5.0)
    "C45": ("rs-C45", 0),
    "C46": ("rs-C46", 39),        # 그의 손이 다가가(판 2.0–3.25) 그녀 손이 비켜나는 끝(3.5–5.0)까지 — 24장부터면 비켜남이 컷 끝에 걸려 덜 보였다
    "C47": ("rs-C47", 15),        # 민재 0.74 · 「아니요.」 4.94 → 컷 4.32
    "C48": ("rs-C48n__2", 0),     # 우산이 부스 벽에 기댐 · 따르고 말하고 병을 놓고 왼쪽(유나)을 봄 — 소리는 옛 rs-C48(새 두 벌은 「잔이나 피워」로 받아써짐)
    "C49": ("rs-C49m", 6),
    "C50": ("rs-C50", 12),        # 「뭐 봐?」 4.56 → 컷 4.06
    "C51": ("rs-C51", 22),        # 「응? 아무것도 아냐.」 2.80–4.36 → 컷 1.88 · 휴대폰 초록 화면에 C18e 사진(아래 phone)
    "C52": ("rs-C52m", 43),       # 쓸판 「쓰는 구간 1.8~4.05」 — 「이거,」 3.56
    "C53": ("rs-C53a", 0),        # + rs-C53b-이음 1장부터(앞 토막 끝 장에서 이어 구운 판) — 아래 picture()
    "C54": ("rs-C54", 6),
    "C55": ("rs-C55-56", 0),      # 두 샷 판 첫 샷 0–2.66(64장) — 「검은 거 말고 이거 써.」 1.46
    "C56": ("rs-C56h", 18),       # 손 인서트(그 손이 우산을 내밈) — 「너 투명한 거 좋아하잖아」는 rs-C55-56 판 소리를 이 컷에
    "C57": ("rs-C57", 35),        # 말 2.00–5.98 → 컷 0.54–4.52
    "C58": ("rs-C58", 24),        # 말 2.22–4.00 → 컷 1.22–3.00
    "C59": ("rs-C59f", 30),       # 감았던 눈이 뜨이며 그를 봄(판 1.25–3.1)
    "C60": ("rs-C60m", 6),
    "C61": ("rs-C61", 17),        # 「…잘 지내.」 1.14 → 컷 0.43
    "C62": ("rs-C62m", 3),
    "C63": ("rs-C63", 24),        # 따라가는 눈 → 판 5.0초 접은 우산으로 떨어지는 눈
    "C64": ("rs-C64g__2", 26),    # 파란 우산이 판 1.33(32장)에 먼저 닿고 맑은 우산이 1.6에 그 위로 엇갈려 떨어짐 — 공중 장은 0.25초만(둘째 · 셋째 맹검 Fable). 옛 rs-C64m은 2초 떠서 내려앉음
    "C65": (None, 0),             # 검은 화면
    "C66": ("rs-C66", 39),        # 「어, 비 그쳤네.」 3.82–5.00 → 컷 2.20–3.38(판 끝까지) · 검은 화면에서 0.95초 밝아짐
    "C67": ("rs-C67m", 6),
    "C68": ("rs-C67-68", 56),     # 두 샷 판 둘째 샷(2.2초부터) — 눈을 감고 볕을 받음
    "C69": ("rs-C69", 0),         # 구두가 2.0초에 들어옴(원본 2.4)
    "C70": ("rs-C70", 33),        # 옅게 웃으며 다가와 왼쪽으로 빠짐 — 판 끝까지
}
C53B = ("rs-C53b-이음", 1)
C53A_N = 193   # rs-C53a 장 수 — 끝 장이 이음 판의 첫 장


def ease_in_out(x):
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


def ease_in(x):
    x = min(1.0, max(0.0, x))
    return x * x


# ---------- 화면 처리(프레임마다) ----------
def bars(img, w=BAR):
    if w > 0:
        w = int(round(w))
        img[:, :w] = 0
        img[:, W - w:] = 0
    return img


_PEN_CACHE = {}


def _field(seed, h, w, cell=64):
    """부드러운 흔들림 장(−1~1 언저리) — 낮은 주파수 잡음을 키운다."""
    r = np.random.default_rng(seed).normal(0, 1, (h // cell + 3, w // cell + 3)).astype(np.float32)
    r = cv2.GaussianBlur(r, (0, 0), 0.9)
    return cv2.resize(r, (w, h), interpolation=cv2.INTER_CUBIC)


def pen_mask(text, cx, cy, size=150):
    """손가락으로 쓴 글. 둘째 판(첫 편집본 맹검 「붓글씨 폰트 + 흐림 필터」 뒤): 펜 글꼴은 획 자리만 빌린다 — 글꼴의 뼈대(가운데 선)만 뽑아 부드러운 흔들림으로
    비틀고, 손가락 폭 한 굵기(누르는 힘만큼 ±15%)의 둥근 끝 획으로 다시 그린다. 글꼴의 굵고 가는 차 · 붓끝이 사라져 손가락이 지나간 자국이 된다.
    돌려주는 값: (획 마스크 0~1, 물줄기 목록[(x, y, 길이, 폭)], 글 x 시작 · 끝)"""
    key = (text, cx, cy, size)
    if key in _PEN_CACHE:
        return _PEN_CACHE[key]
    from PIL import Image, ImageDraw, ImageFont
    from skimage.morphology import skeletonize
    S = 2
    Hs, Ws = H * S, W * S
    im = Image.new("L", (Ws, Hs), 0)
    d = ImageDraw.Draw(im)
    font = ImageFont.truetype(PEN, size * S)
    l, t, r, b = d.textbbox((0, 0), text, font=font, stroke_width=3 * S)
    x0, y0 = cx * S - (r - l) // 2 - l, cy * S - (b - t) // 2 - t
    d.text((x0, y0), text, font=font, fill=255, stroke_width=3 * S, stroke_fill=255)   # 조금 굵혀 뼈대가 끊기지 않게
    sk = skeletonize(np.asarray(im, np.uint8) > 127)
    ys, xs = np.nonzero(sk)
    amp = 3.2 * S                                             # 흔들림 폭(1배 화면 3.2px) — 줄이 손으로 그은 듯 조금씩 휜다
    fx, fy = _field(21, Hs, Ws, 90), _field(22, Hs, Ws, 90)
    xs2 = np.clip(np.round(xs + fx[ys, xs] * amp), 0, Ws - 1).astype(np.int32)
    ys2 = np.clip(np.round(ys + fy[ys, xs] * amp), 0, Hs - 1).astype(np.int32)
    skel = np.zeros((Hs, Ws), np.uint8)
    skel[ys2, xs2] = 255
    skel = cv2.dilate(skel, np.ones((3, 3), np.uint8))
    dist = cv2.distanceTransform(255 - skel, cv2.DIST_L2, 5)
    rad = (size / 185 * 8.2 * S) * (1 + 0.15 * _field(23, Hs, Ws, 120))   # 손가락 폭 반지름(1배 8.2px — 글 높이의 약 1/9)
    m = np.clip((rad - dist) / (1.6 * S) + 0.5, 0, 1).astype(np.float32)   # 가장자리 1.6px 무름(물기가 번진 경계)
    m = cv2.resize(m, (W, H), interpolation=cv2.INTER_AREA)
    # 물줄기 — 획의 아래 끝 몇 곳(가장 낮게 내려온 자리)에서 흘러내릴 자리를 고른다(그리기는 fog가 시간에 따라)
    rng = np.random.default_rng(7)
    yy, xx = np.nonzero(m > 0.7)
    drips = []
    if len(xx):
        lo, hi = xx.min(), xx.max()
        for k in range(4):
            band = (xx >= lo + (hi - lo) * k / 4) & (xx < lo + (hi - lo) * (k + 1) / 4)
            if not band.any():
                continue
            i = np.argmax(np.where(band, yy, -1))
            drips.append((int(xx[i]), int(yy[i]) - 2, float(rng.uniform(34, 78)), float(rng.uniform(2.2, 3.2))))
    out = (m, drips, (x0 / S + l / S, x0 / S + r / S))
    _PEN_CACHE[key] = out
    return out


_GRAIN = None


def grain():
    # 김 서림의 잔 물방울 결 — 한 번 만들어 둔다(고정)
    global _GRAIN
    if _GRAIN is None:
        rng = np.random.default_rng(11)
        g = rng.normal(0, 1, (H // 2, W // 2)).astype(np.float32)
        g = cv2.GaussianBlur(g, (0, 0), 1.2)
        g = cv2.resize(g, (W, H), interpolation=cv2.INTER_LINEAR)
        dots = np.zeros((H, W), np.float32)
        for _ in range(900):   # 작은 물방울(밝은 점 + 어두운 테)
            x, y, r = int(rng.uniform(0, W)), int(rng.uniform(0, H)), rng.uniform(1.5, 4.5)
            cv2.circle(dots, (x, y), int(r), 1.0, -1, cv2.LINE_AA)
        dots = cv2.GaussianBlur(dots, (0, 0), 0.8)
        # 둘째 판: 원본 김 서린 유리처럼 큰 물방울 몇십 개와 위에서 흘러내린 물자국 몇 줄 — 물자국 자리는 김이 걷혀 장면이 비친다(고정)
        beads = np.zeros((H, W), np.float32)
        for _ in range(70):
            x, y, r = int(rng.uniform(0, W)), int(rng.uniform(0, H)), rng.uniform(3.0, 6.5)
            cv2.circle(beads, (x, y), int(r), 1.0, -1, cv2.LINE_AA)
        beads = cv2.GaussianBlur(beads, (0, 0), 1.0)
        runs = np.zeros((H, W), np.float32)
        for _ in range(4):   # 첫 시험(9줄 · 진하게)은 머리카락 · 금처럼, 둘째(6줄 · 곧게)도 「가는 검은 금」으로 읽혀 넷 · 크게 굽이 · 옅게(아래 섞음)
            x, y = rng.uniform(80, W - 80), rng.uniform(-120, H * 0.55)
            L, wd, ph = rng.uniform(140, 380), rng.uniform(2.0, 3.2), rng.uniform(0, 6.3)
            pts = np.array([[x + 7.0 * np.sin(k / 53.0 + ph) + 2.2 * np.sin(k / 17.0 + 2 * ph), y + k] for k in range(int(L))], np.int32)
            cv2.polylines(runs, [pts], False, 1.0, max(1, int(round(wd))), cv2.LINE_AA)
            cv2.circle(runs, tuple(pts[-1]), int(round(wd * 1.4)), 1.0, -1, cv2.LINE_AA)
        runs = cv2.GaussianBlur(runs, (0, 0), 0.8)
        _GRAIN = (g, dots, beads, runs)
    return _GRAIN


def fog(img, t, cfg):
    """김 서린 유리 — 장면이 흐려지고 뿌옇게 밝아지며(겹쳐 들어옴 cfg['in']), 손가락으로 쓴 글 자리만 맑게 비친다(쓰는 동안 왼쪽부터 드러남 cfg['write'])."""
    a0, a1 = cfg["in"]
    a = ease_in_out((t - a0) / (a1 - a0))
    if a <= 0:
        return img
    src = img.astype(np.float32)
    # 둘째 판: 원본처럼 김 너머 사람 · 색이 비치게 덜 뿌옇게(흐림 26 → 18 · 김 빛 48% → 40%), 김 빛은 장면마다(밤 가게 청록 · 낮비 회청)
    blur = cv2.GaussianBlur(src, (0, 0), 18)
    g, dots, beads, runs = grain()
    tint = np.array(cfg.get("tint", (196, 204, 206)), np.float32)   # BGR
    fogged = blur * 0.60 + tint * 0.40
    fogged += (g * 5.0)[..., None]
    fogged = fogged * (1 - 0.10 * dots[..., None]) + 255 * 0.06 * dots[..., None]
    # 큰 물방울 — 위쪽은 빛, 아래 테는 그늘(물방울 렌즈)
    up = np.roll(beads, -2, axis=0)
    fogged = fogged + (np.clip(beads - np.roll(beads, 2, axis=0), 0, 1) * 34 - np.clip(beads - up, 0, 1) * 22)[..., None]
    # 흘러내린 물자국 — 김이 걷힌 줄(장면이 비침) + 가장자리 옅은 빛
    fogged = fogged * (1 - runs[..., None] * 0.38) + (src * 0.97 + 8) * runs[..., None] * 0.38
    m, drips, (tx0, tx1) = pen_mask(cfg["text"], cfg["cx"], cfg["cy"], cfg.get("size", 150))
    w0, w1 = cfg["write"]
    p = (t - w0) / (w1 - w0)
    edge = tx0 - 40 if p <= 0 else tx0 + (tx1 - tx0 + 40) * min(1.0, p)
    xs = np.arange(W, dtype=np.float32)
    reveal = np.clip((edge - xs) / 40.0, 0, 1)
    mm = m * reveal[None, :]
    # 물줄기 — 손가락이 그 자리를 지나고 0.25초 뒤부터 1.3초 동안 아래로 자란다(끝에 물방울 하나). 물이 지나간 자리도 김이 걷혀 맑다
    dm = np.zeros((H, W), np.float32)
    beads = []
    for (x, y, L, wd) in drips:
        if x >= edge - 20:
            continue
        t_pass = w0 + (x - tx0) / max(1.0, tx1 - tx0 + 40) * (w1 - w0)
        g = ease_in_out((t - t_pass - 0.25) / 1.3)
        if g <= 0:
            continue
        n = max(2, int(L * g))
        # 둘째 판: 곧은 세로 줄은 「기계적」(11-07 Fable 둘째 맹검) — 두 겹 굽이 · 살짝 비스듬히 흐르고, 위는 굵고 아래로 가늘어진다
        ph = (x * 0.37) % 6.28
        pts = [(x + 2.6 * np.sin(k / 13.0 + ph) + 1.1 * np.sin(k / 4.7 + 2 * ph) + 0.05 * k * np.sin(ph), y + k) for k in range(n)]
        for k in range(0, n - 1, 3):
            wk = wd * (1.15 - 0.55 * k / max(1, L))
            cv2.line(dm, (int(pts[k][0]), int(pts[k][1])), (int(pts[min(n - 1, k + 3)][0]), int(pts[min(n - 1, k + 3)][1])), 1.0,
                     max(1, int(round(wk))), cv2.LINE_AA)
        beads.append((int(pts[-1][0]), int(pts[-1][1]), wd * 1.35))
    for (bx, by, br) in beads:
        cv2.circle(dm, (bx, by), int(round(br)), 1.0, -1, cv2.LINE_AA)
    mm = np.maximum(mm, cv2.GaussianBlur(dm, (0, 0), 0.7))
    # 닦인 자리 — 맑게 닦인 유리 너머 장면이 또렷이 비친다(제 색 그대로, 물막만큼 아주 조금 어둡게). 둘째 판: 첫 판의 「색을 뺀 짙은 먹색」은 맹검에서
    #   글꼴을 얹은 꼴로 읽혀(11-07 Fable) 뺐다 — 김 서린 뿌연 판보다 어둡고 또렷한 것은 닦인 자리가 원래 그렇기 때문(뒤 장면이 밤이라)
    #   밝은 장면(흰 셔츠 · 살갗) 뒤에서는 제 색 그대로면 분홍 · 갈색 물감처럼 읽혀(11-07 둘째 시험) 원본 글처럼 조금 어둡게 · 색을 덜(70%)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)[..., None]
    clear = (src * 0.78 + gray * 0.22) * 0.70
    # 둘째 판: 획 안이 어디서나 같은 평평한 톤이라 유리 위에 「얹힌」 느낌(11-07 Fable 둘째 맹검) — 손가락이 덜 닦은 자리에 김이 결로 조금 남고(10~30%),
    #   닦인 자리에도 잔 물방울이 맺혀(빛 · 그늘) 유리에 붙어 보이게
    resid = np.clip(0.10 + 0.20 * (0.5 + 0.5 * _field(31, H, W, 18)), 0, 1)[..., None]
    clear = clear * (1 - resid) + fogged * resid
    g_, dots_, beads_, runs_ = grain()
    up_ = np.roll(beads_, -2, axis=0)
    clear = clear + ((np.clip(beads_ - np.roll(beads_, 2, axis=0), 0, 1) * 30 - np.clip(beads_ - up_, 0, 1) * 18) + dots_ * 10)[..., None]
    # 닦인 경계 바깥에 밀려 모인 김 · 물기 — 아주 얇고 옅은 밝은 테(획 · 물줄기 둘레)
    ridge = np.clip(cv2.GaussianBlur(cv2.dilate(mm, np.ones((5, 5), np.uint8)) - mm, (0, 0), 1.1) * 1.2, 0, 1)
    out = fogged * (1 - mm[..., None]) + clear * mm[..., None]
    out = out + ridge[..., None] * 16
    for (bx, by, br) in beads:   # 물방울 머리 — 위쪽 가장자리에 작은 빛 한 점
        cv2.circle(out, (bx - 1, by - 1), max(1, int(br * 0.45)), (255, 255, 255), -1, cv2.LINE_AA)
    out = src * (1 - a) + out * a
    return np.clip(out, 0, 255).astype(np.uint8)


def occluder(img, t, dur):
    """C01 앞 가림 — 화면 오른쪽을 덮은 크게 흐린 어두운 기둥이 오른쪽으로 비켜남(폭 48% → 29%, 갈수록 빨라짐 — 원본 실측)."""
    width = 0.48 - 0.19 * ease_in(t / dur)
    edge = W * (1 - width)
    xs = np.arange(W, dtype=np.float32)
    k = np.clip((xs - edge) / 150.0 + 0.5, 0, 1)   # 무른 가장자리(흐린 앞 물체)
    k = k[None, :, None]
    dark = np.array((22, 16, 24), np.float32)       # BGR — 분홍 · 청록 네온이 아주 조금 묻은 검정
    glow = np.exp(-((xs - edge) / 60.0) ** 2)[None, :, None] * np.array((60, 30, 70), np.float32) * 0.35   # 가장자리에 번진 네온
    src = img.astype(np.float32)
    out = src * (1 - k) + (dark + glow) * k
    return np.clip(out, 0, 255).astype(np.uint8)


def haze(img, t, a0, a1):
    """제목 카드 — 들어온 뒤 a0~a1초에 뿌연 밝은 판이 가라앉으며 우산이 또렷해짐(원본 6 · 40 실측)."""
    k = 1 - ease_in_out((t - a0) / (a1 - a0))
    if k <= 0:
        return img
    src = img.astype(np.float32)
    blur = cv2.GaussianBlur(src, (0, 0), 18)
    milky = blur * 0.45 + np.array((222, 226, 228), np.float32) * 0.55
    out = src * (1 - k * 0.85) + milky * (k * 0.85)
    return np.clip(out, 0, 255).astype(np.uint8)


def fade(img, t, a0, a1):
    k = ease_in_out((t - a0) / (a1 - a0))
    return np.clip(img.astype(np.float32) * k, 0, 255).astype(np.uint8)


_PHOTO = None


def phone(img, t):
    """C51 휴대폰 화면(초록) 자리에 C18e(그 밤 「비침」 하나 아래 두 사람) — 초록 자리의 네 귀퉁이로 원근을 맞춰 넣고 화면 빛처럼 조금 밝게."""
    global _PHOTO
    if _PHOTO is None:
        _PHOTO = cv2.imdecode(np.fromfile(os.path.join(CONTI, "선버스트", "정지컷", "C18e.jpg"), np.uint8), cv2.IMREAD_COLOR)   # 한글 경로 — imread는 못 읽음
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    # 채도 · 밝기를 좁혀 휴대폰 초록만(첫 판 (40, 90, 60) 범위는 뒤 나무 잎까지 잡아 검은 얼룩이 생겼다 — 11-07)
    green = cv2.inRange(hsv, (45, 150, 120), (80, 255, 255))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(green, 8)
    if n <= 1:
        return img
    k = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    if stats[k, cv2.CC_STAT_AREA] < 900:
        return img
    # 손가락이 화면을 가로질러 아래 조각이 떨어져 나온다(셋째 낱장의 초록 한 줄) — 큰 덩어리 둘레 60px 안의 조각을 한 화면으로 묶는다
    x, y, w, h = stats[k, 0], stats[k, 1], stats[k, 2], stats[k, 3]
    keep = [i for i in range(1, n) if stats[i, cv2.CC_STAT_AREA] >= 20 and stats[i, 0] >= x - 60 and stats[i, 1] >= y - 60
            and stats[i, 0] + stats[i, 2] <= x + w + 60 and stats[i, 1] + stats[i, 3] <= y + h + 60]
    blob = np.isin(lab, keep).astype(np.uint8) * 255
    blob = cv2.morphologyEx(blob, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    # 가장자리 초록 번짐까지 — 덩어리 둘레 안의 옅은 초록(채도 60 위)도 갈아 끼운다(둘째 낱장에서 아래 가장자리에 초록 한 줄)
    soft = cv2.inRange(hsv, (40, 60, 60), (85, 255, 255))
    green = cv2.bitwise_and(cv2.bitwise_or(green, soft), cv2.dilate(blob, np.ones((9, 9), np.uint8)))
    cs, _ = cv2.findContours(blob, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    hull = cv2.convexHull(np.vstack(cs))
    # 네 귀퉁이 — 모든 초록 조각을 덮는 회전 사각형(다각형 근사는 손가락 아래 조각을 빼 검은 톱니가 남았다 — 넷째 낱장)
    quad = cv2.boxPoints(cv2.minAreaRect(hull)).astype(np.float32)
    c = quad.mean(axis=0)
    ang = np.arctan2(quad[:, 1] - c[1], quad[:, 0] - c[0])
    quad = quad[np.argsort(ang)]                      # 시계 방향(화면 좌표)
    s0 = int(np.argmin(quad[:, 0] + quad[:, 1]))      # 왼쪽 위부터
    quad = np.roll(quad, -s0, axis=0)
    # 휴대폰은 세로 — 긴 변이 세로가 되게(왼위 → 오위 변이 짧은 변)
    if np.linalg.norm(quad[1] - quad[0]) > np.linalg.norm(quad[3] - quad[0]):
        quad = np.roll(quad, 1, axis=0)
    dst = quad
    ph = _PHOTO
    hh, ww = ph.shape[:2]
    side_w = np.linalg.norm(dst[1] - dst[0])
    side_h = np.linalg.norm(dst[3] - dst[0])
    aspect = side_w / max(side_h, 1)
    cw = int(min(ww, hh * aspect))
    cx0 = (ww - cw) // 2 + int(ww * 0.06)   # 두 사람이 가운데 오게 조금 오른쪽
    cx0 = max(0, min(ww - cw, cx0))
    crop = ph[:, cx0:cx0 + cw]
    src = np.float32([[0, 0], [cw, 0], [cw, hh], [0, hh]])
    M = cv2.getPerspectiveTransform(src, dst)
    warped = cv2.warpPerspective(crop, M, (W, H), flags=cv2.INTER_AREA)
    warped = np.clip(warped.astype(np.float32) * 1.08 + 6, 0, 255)
    mask = cv2.GaussianBlur(green.astype(np.float32) / 255.0, (0, 0), 0.9)
    mask = cv2.erode(mask, np.ones((2, 2), np.uint8))
    mask = np.clip(mask * 1.15, 0, 1)[..., None]
    # 초록 번짐 — 테두리 근처의 초록 기운을 덜어 냄
    out = img.astype(np.float32) * (1 - mask) + warped * mask
    ring = cv2.dilate(green, np.ones((11, 11), np.uint8)) > 0
    o = out[ring]
    gch = o[:, 1]
    o[:, 1] = np.minimum(gch, (o[:, 0] + o[:, 2]) / 2 + 8)
    out[ring] = o
    return np.clip(out, 0, 255).astype(np.uint8)


# 컷마다 화면 처리 — (t는 컷 안 초)
FOG = {
    # C23 태준 속말 「…다 보이고 있었다는 걸」 — 원본 섞음 88.30–89.34초(컷 2.13–3.17), 띠 열림 92.22–93.97(컷 6.05–7.80)
    "C23": {"in": (2.13, 3.17), "write": (3.95, 5.55), "text": "다 보이고 있었다", "cx": 960, "cy": 520, "size": 185, "bars": (6.05, 7.80), "tint": (206, 202, 182)},
    # C54 유나 속말 「우리, 한때는 서로가 다 보였다」 — 원본 섞음 220.39–221.43(컷 2.13–3.17), 띠 열림 222.81–225.10(컷 4.55–6.84)
    "C54": {"in": (2.13, 3.17), "write": (3.10, 4.40), "text": "서로가 다 보였다", "cx": 960, "cy": 520, "size": 185, "bars": (4.55, 6.84), "tint": (206, 202, 192)},
}


def process(name):
    """그 컷에 화면 처리가 있으면 프레임마다 굽는다(없으면 None)."""
    if name in FOG:
        cfg = FOG[name]
        b0, b1 = cfg["bars"]

        def f(img, t):
            img = fog(img, t, cfg)
            return bars(img, BAR * (1 - ease_in_out((t - b0) / (b1 - b0))))
        return f
    # C01 앞 가림(occluder)은 11-07 첫 판에서 납작한 보라 판으로 읽혀(슬롭 점검표 1번 결) 뺐다 — 태준이 오른쪽에서 걸어 들어오는 깨끗한 판으로 시작
    if name == "C06":
        return lambda img, t: haze(img, t, 0.8, 2.1)
    if name == "C40":
        return lambda img, t: haze(img, t, 0.5, 2.1)
    if name == "C51":
        return lambda img, t: bars(phone(img, t))
    if name == "C66":
        return lambda img, t: fade(img, t, 0.0, 0.95)
    if name in FLASH:
        return lambda img, t: bars(img)
    return None


def apply(path, f):
    tmp = path + ".처리.mp4"
    r = subprocess.Popen(["ffmpeg", "-v", "error", "-i", path, "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], stdout=subprocess.PIPE)
    w = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                          "-c:v", "libx264", "-crf", "12", "-preset", "medium", "-pix_fmt", "yuv420p",
                          "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", tmp], stdin=subprocess.PIPE)
    n = 0
    while True:
        buf = r.stdout.read(W * H * 3)
        if len(buf) < W * H * 3:
            break
        img = np.frombuffer(buf, np.uint8).reshape(H, W, 3).copy()
        w.stdin.write(f(img, n / FPS).tobytes())
        n += 1
    w.stdin.close()
    w.wait()
    r.wait()
    os.replace(tmp, path)
    return n


def one(name, d):
    i = NAMES.index(name)
    k = LEN[i]
    out = os.path.join(d, f"{name}.mp4")
    pid, a = CUTS[name]
    if pid is None:
        C.run("ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"color=c=black:s={W}x{H}:r={FPS}", "-frames:v", str(k), "-vf", "format=yuv420p",
              "-c:v", "libx264", "-crf", "12", "-preset", "medium", "-r", str(FPS), "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", out)
        print(f"{name} 검은 화면 {k}장")
    elif name == "C53":
        pa = os.path.join(d, "C53a.mp4")
        pb = os.path.join(d, "C53b.mp4")
        C.cut_video(C.clip(pid), a, C53A_N, W, H, FPS, pa)
        bid, ba = C53B
        C.cut_video(C.clip(bid), ba, k - C53A_N, W, H, FPS, pb)
        C.join_videos([pa, pb], out)
        print(f"{name} {pid} 0–{C53A_N} + {bid} {ba}장부터 {k - C53A_N}장")
    else:
        have = C.frames_of(C.clip(pid))
        if a + k > have:
            raise SystemExit(f"{name} {pid}: {a}장부터 {k}장이 필요한데 {have}장뿐")
        C.cut_video(C.clip(pid), a, k, W, H, FPS, out)
        print(f"{name} {pid} {a}장({a / FPS:.2f}초)부터 {k}장 → 화면 {F[i] / FPS:.2f}–{F[i + 1] / FPS:.2f}초")
    f = process(name)
    if f:
        n = apply(out, f)
        print(f"   화면 처리 {n}장")
    got = C.frames_of(out)
    if got != k:
        raise SystemExit(f"{out}: {k}장이어야 하는데 {got}장")
    return out


def picture(only=None):
    d = os.path.join(OUT, "_컷")
    os.makedirs(d, exist_ok=True)
    for name in NAMES:
        p = os.path.join(d, f"{name}.mp4")
        if only is None or name in only or not os.path.exists(p):
            one(name, d)
    C.join_videos([os.path.join(d, f"{n}.mp4") for n in NAMES], os.path.join(OUT, "화면.mp4"))
    print("화면", C.frames_of(os.path.join(OUT, "화면.mp4")), "장")


TF = [f / FPS for f in F]   # 화면이 실제로 자르는 장 경계(초) — 소리 · 자막은 이 값으로 놓는다
TIMING = os.path.join(CAP, "remotion", "src", "rs", "timing.json")


def sound():
    import 최종소리
    os.makedirs(os.path.dirname(TIMING), exist_ok=True)
    lines = 최종소리.build(os.path.join(OUT, "소리.wav"), TIMING, TF, dict(zip(NAMES, range(70))), CUTS)
    for l in lines:
        print(f"  {l['a']:7.2f}–{l['b']:7.2f} {l['who']} {l['s']}")


def publish():
    import 비침_로고
    from PIL import Image
    os.makedirs(PUB, exist_ok=True)
    for src, to in ((os.path.join(OUT, "화면.mp4"), "picture.mp4"), (os.path.join(OUT, "소리.wav"), "sound.wav")):
        dst = os.path.join(PUB, to)
        if not os.path.exists(dst) or C.md5(src) != C.md5(dst):
            shutil.copyfile(src, dst)
    for name, im in 비침_로고.renders().items():
        Image.fromarray(im).save(os.path.join(PUB, f"{name}.png"))
    add, mul = pack()
    add.save(os.path.join(PUB, "pack_add.png"))
    mul.save(os.path.join(PUB, "pack_mul.png"))


PACK = os.path.join(CONTI, "손다시_20261107", "PACK3.png")   # 펼친 두 우산(맑은 · 새 색) — 고른 중간 회색 바탕 스튜디오 사진(Codex GPT 2.5 구독, 다시_1107 작업.json)


def pack():
    """끝 카드 팩샷 두 층 — 회색 바탕 사진 한 장에서 바탕보다 밝아진 몫(살 · 테 · 마개의 빛 → RS.tsx가 screen으로)과 어두워진 몫 · 덮개 색 기운
    (뒤 장면을 조금 어둡게 · 옅은 푸른빛으로 물들임 → multiply)을 따로 낸다. 같은 사진에서 나와 두 층이 딱 맞는다.
    둘째 판: 검은 바탕 사진을 밝기로만 투명하게 한 첫 판은 윤곽 · 빛만 남아 「선 그림 · 워터마크」, 새 색이 맑은 쪽과 안 갈렸다(11-07 Fable 둘째 맹검)."""
    from PIL import Image
    im = np.asarray(Image.open(PACK).convert("RGB"), np.float32) / 255.0
    border = np.concatenate([im[:30].reshape(-1, 3), im[-30:].reshape(-1, 3), im[:, :30].reshape(-1, 3), im[:, -30:].reshape(-1, 3)])
    bg = np.median(border, axis=0)
    obj = np.abs(im - bg).max(axis=2) > 0.035
    fill = im.copy()
    fill[obj] = bg
    bgf = cv2.GaussianBlur(fill, (0, 0), 40)                      # 바탕이 조금 기울어도 맞게 — 물체 자리는 바탕 값으로 메운 큰 흐림
    D = im - bgf
    add = np.clip(D * 1.25, 0, 1)
    rel = (im + 1e-3) / (im.mean(axis=2, keepdims=True) + 1e-3)
    relbg = (bgf + 1e-3) / (bgf.mean(axis=2, keepdims=True) + 1e-3)
    r = rel / relbg
    # 새 색의 푸른 기운 — 곱하기만 하면 뒤 나무 초록과 섞여 청록 · 청회색으로 읽혀(셋째 맹검) 파랑이 앞선 만큼 하늘색 빛을 스크린 층에 더하고 곱하기는 덜
    add = np.clip(add + np.clip((r[..., 2] - np.maximum(r[..., 0], r[..., 1])) * 4.0, 0, 1)[..., None] * np.array([0.55, 0.75, 1.0]), 0, 1)
    tint = 1 - (1 - r / r.max(axis=2, keepdims=True)) * 1.8
    dark = np.clip(1 + np.minimum(D.mean(axis=2), 0)[..., None] / bgf.mean(axis=2, keepdims=True) * 1.3, 0.25, 1)
    mul = np.clip(tint * dark, 0, 1)
    keep = cv2.dilate((np.abs(D).max(axis=2) > 0.02).astype(np.uint8), np.ones((9, 9), np.uint8)) > 0
    add[~keep] = 0
    mul[~keep] = 1
    ys, xs = np.nonzero(keep)
    y0, y1, x0, x1 = max(0, ys.min() - 8), min(im.shape[0], ys.max() + 8), max(0, xs.min() - 8), min(im.shape[1], xs.max() + 8)
    return (Image.fromarray((add[y0:y1, x0:x1] * 255).astype(np.uint8)), Image.fromarray((mul[y0:y1, x0:x1] * 255).astype(np.uint8)))


def stills(*frames):
    publish()
    d = os.path.join(OUT, "_낱장")
    os.makedirs(d, exist_ok=True)
    for f in frames:
        C.run(shutil.which("npx"), "remotion", "still", "src/index.ts", "rs", os.path.join(d, f"f{int(f):04d}.png"), f"--frame={int(f)}", "--log=error",
              cwd=os.path.join(CAP, "remotion"))
    print(d)


def render(name="다비침_16x9", jobs=3):
    publish()
    out, raw = os.path.join(OUT, name + ".mp4"), os.path.join(OUT, "_렌더.mp4")
    C.run(shutil.which("npx"), "remotion", "render", "src/index.ts", "rs", raw, f"--concurrency={jobs}", "--log=error", cwd=os.path.join(CAP, "remotion"))
    C.run("node", os.path.join(C.REPO, "tools", "음량마감.mjs"), raw, out, "--목표", "-14", "--리미터", "0.74", "--덮어쓰기")   # 0.84는 AAC 뒤 봉우리 +0.6 dBFS로 미통과(11-07) — 현장노트 「기본 리미터 0.84는 …」
    C.run("ffmpeg", "-y", "-v", "error", "-i", out, "-vf", "scale=1280:-2", "-c:v", "libx264", "-crf", "26", "-preset", "medium", "-c:a", "aac", "-b:a", "160k",
          "-movflags", "+faststart", os.path.join(OUT, name + "_폰.mp4"))
    C.run("ffmpeg", "-y", "-v", "error", "-i", out, "-vf", "fps=1,scale=240:-2,tile=15x19:padding=3", "-frames:v", "1", "-q:v", "4", os.path.join(OUT, "_일초.jpg"))
    print(out)


def resound(name="다비침_16x9"):
    # 소리만 고쳤을 때 — 마지막 Remotion 렌더(_렌더.mp4)의 화면에 새 소리.wav를 PCM으로 담아(.mov) 음량 마감만 다시(화면은 다시 굽지 않는다)
    raw, mov, out = os.path.join(OUT, "_렌더.mp4"), os.path.join(OUT, "_렌더_새소리.mov"), os.path.join(OUT, name + ".mp4")
    C.run("ffmpeg", "-y", "-v", "error", "-i", raw, "-i", os.path.join(OUT, "소리.wav"), "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "pcm_s16le",
          "-shortest", mov)
    C.run("node", os.path.join(C.REPO, "tools", "음량마감.mjs"), mov, out, "--목표", "-14", "--리미터", "0.74", "--덮어쓰기")   # 0.84는 AAC 뒤 봉우리 +0.6 dBFS로 미통과(11-07) — 현장노트 「기본 리미터 0.84는 …」
    C.run("ffmpeg", "-y", "-v", "error", "-i", out, "-vf", "scale=1280:-2", "-c:v", "libx264", "-crf", "26", "-preset", "medium", "-c:a", "aac", "-b:a", "160k",
          "-movflags", "+faststart", os.path.join(OUT, name + "_폰.mp4"))
    print(out)


if __name__ == "__main__":
    what = sys.argv[1:] or ["화면", "소리", "판"]
    if what[0] == "소리판":
        sound()
        resound()
        raise SystemExit
    if what[0] == "낱장":
        stills(*what[1:])
        raise SystemExit
    if what[0] == "컷":
        picture(set(what[1:]))
        raise SystemExit
    for w in what:
        {"화면": picture, "소리": sound, "판": render}[w]()
