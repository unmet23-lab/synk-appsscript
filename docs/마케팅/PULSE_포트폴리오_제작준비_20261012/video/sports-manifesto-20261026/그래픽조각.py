# 5번 스포츠 매니페스토의 그래픽 조각(2026-10-26) — 원본의 번쩍 몽타주 · 그래픽 행(5 · 7 · 12 · 14 · 18 · 20)과 끝 로고(21)를 코드로 그린다.
# 원본은 측정 모니터를 아주 가까이서 흐리게 찍은 조각들이다(청록 숫자 · 심박 선 · 러닝머신 판 · 금빛 빛줄기). 모양 · 색 · 흐림의 결만 따르고,
# 숫자 · 글자 · 로고는 우리 것(심박 172 · 페이스 4'05" · 가쁨 GAPPEUM)으로 바꾼다. 화면 위에 얹는 글자 · 로고는 AI로 그리지 않는다(제작 규칙).
#   python -X utf8 그래픽조각.py            → synk-vendor/pulse-portfolio12-20261024/콘티/p5/그래픽/G_*.png(1920×1080) · 로고_가쁨.png(투명)
#   python -X utf8 그래픽조각.py 숫자 로고   → 그 조각만
# 영상 단계에서는 같은 함수에 시간(t)을 넣어 움직이는 판으로 뽑는다 — 지금은 이미지 콘티용 정지 한 장씩.
import sys, math
from pathlib import Path
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont

OUT = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p5/그래픽")
FONT = Path(__file__).resolve().parents[4] / "브랜드_폰트"
W, H = 1920, 1080
TEAL = np.array([150, 236, 222], np.float32) / 255   # 모니터 숫자 · 선(원본 프레임에서 잰 청록 — RGB)
SLAT = np.array([38, 128, 142], np.float32) / 255
GOLD = np.array([255, 178, 96], np.float32) / 255
rng = np.random.default_rng(5)


def font(name, size):
    return ImageFont.truetype(str(FONT / name), size)


def mask_text(txt, fnt, xy, size=(W, H), anchor="lt"):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).text(xy, txt, font=fnt, fill=255, anchor=anchor)
    return np.asarray(m, np.float32) / 255


def blur(a, r):
    k = int(r) * 2 + 1
    return cv2.GaussianBlur(a, (k, k), r / 2) if r > 0 else a


def scanlines(a, pitch=7, depth=0.55, vertical=True):
    # LCD 화소 결 — 모니터를 아주 가까이서 찍으면 보이는 가는 줄
    idx = np.arange(a.shape[1] if vertical else a.shape[0])
    line = 1 - depth * (np.sin(idx / pitch * 2 * math.pi) * 0.5 + 0.5)
    return a * (line[None, :] if vertical else line[:, None])


def grain(img, s=0.018):
    return img + rng.normal(0, s, img.shape[:2])[..., None].astype(np.float32)


def vignette(img, k=0.55):
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.sqrt(((x - W / 2) / (W / 2)) ** 2 + ((y - H / 2) / (H / 2)) ** 2)
    return img * (1 - k * np.clip(d - 0.35, 0, 1))[..., None]


def tint(m, col, floor=0.012):
    return floor + m[..., None] * col[None, None, :]


def save(name, img):
    img = np.clip(grain(img), 0, 1)
    OUT.mkdir(parents=True, exist_ok=True)
    Image.fromarray((img * 255).astype(np.uint8)).save(OUT / f"{name}.png")
    return name


def screen(m, sharp, pitch=6):
    # 모니터 화면을 렌즈 가까이서: 화소 결 → 초점 흐림 → 번짐(밝은 곳이 둘레로 퍼진다)
    m = blur(scanlines(m, pitch, 0.65), sharp)
    return np.clip(m * 0.9 + blur(m, max(18, sharp * 3)) * 0.55, 0, 1)


def 숫자():
    # 5 · 14행: 심박 「172」를 화면보다 크게, 화소 결 · 살짝 흐림 · 번짐(원본 0.08 · 0.33초 조각)
    m = mask_text("172", font("InterTight/InterTight-SemiBold.ttf", 1500), (-300, -330))
    a = save("G_숫자_172", vignette(tint(screen(m, 9), TEAL), 0.35))
    # 7 · 12행: 페이스 숫자의 「0」을 초점 밖으로 — 둥근 고리 덩어리
    m = mask_text("0", font("InterTight/InterTight-SemiBold.ttf", 1900), (760, -520))
    m = np.clip(blur(scanlines(m, 6, 0.5), 110) * 1.6, 0, 1)
    b = save("G_숫자_흐림", vignette(tint(m, TEAL * 0.85), 0.45))
    return a, b


def 심박():
    # 12 · 18행: 청록 심박 선을 아주 가까이 — 뾰족한 한 박만 화면을 가로지르는 굵은 토막
    m = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(m)
    S = 2.6
    beat = [(-400, 0), (60, 0), (90, -40), (120, 0), (170, 0), (195, 60), (225, -330), (260, 200), (290, 0), (360, -30), (420, 0), (900, 0)]
    pts = [(260 + bx * S, H * 0.58 + by * S * 0.9) for bx, by in beat]
    d.line(pts, fill=255, width=46, joint="curve")
    a = np.asarray(m, np.float32) / 255
    near, far = screen(a, 10), screen(a, 46)
    w = np.clip(np.abs(np.arange(W) - W * 0.52) / (W * 0.38), 0, 1)[None, :]
    return save("G_심박", vignette(tint(near * (1 - w) + far * w, TEAL), 0.5))


def 막대():
    # 12 · 18행: 어두운 초록 막대 그래프(호흡 가스 분석 화면을 가까이)
    a = np.zeros((H, W), np.float32)
    for i in range(46):
        x0 = 120 + i * 38
        h = int(120 + 380 * abs(math.sin(i * 0.37) * math.cos(i * 0.11)) + rng.integers(0, 90))
        a[H - 140 - h:H - 140, x0:x0 + 16] = 0.55
    a = blur(scanlines(a, 5, 0.4), 18)
    return save("G_막대", vignette(tint(a, np.array([60, 200, 110], np.float32) / 255), 0.6))


def 판():
    # 5 · 14행: 러닝머신 판(청록 덩어리)이 비스듬히 줄지어 선 접사 — 윗면이 밝고 앞면은 어둡다, 가운데 줄만 초점
    a = np.zeros((H, W), np.float32)
    for row, (y0, s, br) in enumerate([(600, 1.0, 1.0), (760, 1.35, 0.7)]):
        for i in range(-2, 11):
            x = i * 250 * s + row * 120
            top = [(x, y0), (x + 170 * s, y0), (x + 215 * s, y0 - 55 * s), (x + 45 * s, y0 - 55 * s)]
            front = [(x, y0), (x + 170 * s, y0), (x + 170 * s, y0 + 34 * s), (x, y0 + 34 * s)]
            m = Image.new("L", (W, H), 0)
            ImageDraw.Draw(m).polygon(front, fill=int(110 * br))
            ImageDraw.Draw(m).polygon(top, fill=int(255 * br))
            a = np.maximum(a, np.asarray(m, np.float32) / 255)
    near, far = blur(a, 12), blur(a, 38)
    w = np.clip(np.abs(np.arange(H) - 600) / 300, 0, 1)[:, None]
    return save("G_판", vignette(tint((near * (1 - w) + far * w) * 0.8, SLAT), 0.55))


def 빛줄기(name="G_빛줄기", seed=0, curl=1.0):
    # 5 · 15 · 20행: 따뜻한 금빛 곡선 빛줄기(긴 노출로 끌린 전구 빛) — 굵게 번진 띠 서넛, 속은 거의 흰빛, 오른쪽 꼬리는 사라짐
    r = np.random.default_rng(seed)
    a = np.zeros((H, W), np.float32)
    for k in range(4):
        y0 = 300 + k * 120 + r.integers(-30, 30)
        bend = curl * (120 + 70 * k)
        t = np.linspace(0, 1, 400)
        xs = -120 + t * (W * 0.7 + r.integers(-80, 80))
        ys = y0 - bend * np.sin(t * math.pi * 0.85) * (1 - t * 0.6)
        m = Image.new("L", (W, H), 0)
        ImageDraw.Draw(m).line(list(zip(xs, ys)), fill=255, width=int(40 + r.integers(0, 70)), joint="curve")
        a += np.asarray(m, np.float32) / 255 * (0.5 + 0.5 * r.random())
    k = np.zeros((1, 81), np.float32); k[0, :] = 1 / 81
    a = cv2.filter2D(a, -1, k)   # 옆으로 끌린 결
    core = np.clip(blur(a, 8) * 1.3, 0, 1) ** 1.6
    glow = blur(a, 60)
    img = tint(np.clip(glow, 0, 1), GOLD * np.array([1, 0.8, 0.55])) + tint(np.clip(blur(a, 14), 0, 1), GOLD, 0) * 0.8 + core[..., None] * np.array([1, 0.9, 0.74])
    fade = np.clip(1.35 - np.arange(W) / (W * 0.66), 0, 1)[None, :, None]
    return save(name, vignette(img * fade, 0.35))


def 번쩍():
    # 5행: 흰 번쩍(렌즈를 정면으로 친 빛) — 위는 흰빛, 아래 가장자리에 어두운 둥근 그늘
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    edge = H * 0.72 + 90 * ((x - W / 2) / (W / 2)) ** 2
    a = np.clip((edge - y) / 30, 0, 1)
    img = a[..., None] * np.array([0.97, 0.96, 0.92]) + (1 - a[..., None]) * np.array([0.05, 0.05, 0.06])
    return save("G_번쩍", img)


def 회색판():
    # 5행: 초점 밖 러닝머신 벨트 — 비스듬한 회청색 빛 띠
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    d = (x * 0.55 - y + 120) / 260
    a = np.exp(-d ** 2) * 0.8 + 0.08
    img = tint(a.astype(np.float32), np.array([0.62, 0.66, 0.70], np.float32))
    return save("G_회색판", vignette(img, 0.6))


def 로고():
    # 21행 끝(28.49 켜짐 · 28.53 꺼짐 · 28.57 다시 켜짐): 「가쁨」 흰 네온 + 작은 GAPPEUM RUNNING — 투명 판 하나, 빛 기둥 옆에 얹는다
    LW, LH = 900, 520
    m = mask_text("가쁨", font("SUIT/SUIT-ExtraBold.otf", 300), (LW // 2, 230), (LW, LH), "mm")
    m += mask_text("GAPPEUM  RUNNING", font("InterTight/InterTight-SemiBold.ttf", 50), (LW // 2, 430), (LW, LH), "mm")   # 10-27 낯선 사람 시험 「가쁨이 앱인지 브랜드인지 모른다」 — 러닝 브랜드임을 작은 줄로
    m = np.clip(m, 0, 1)
    core = blur(m, 1.2)
    halo = blur(m, 14) * 0.9 + blur(m, 48) * 0.6
    col = core[..., None] * np.array([1, 1, 1]) + halo[..., None] * np.array([1.0, 0.92, 0.82])
    alpha = np.clip(core + halo, 0, 1)
    rgb = np.clip(col / np.maximum(alpha[..., None], 1e-3), 0, 1)
    OUT.mkdir(parents=True, exist_ok=True)
    Image.fromarray((np.dstack([rgb, alpha]) * 255).astype(np.uint8), "RGBA").save(OUT / "로고_가쁨.png")
    bg = Image.new("RGB", (LW, LH), (6, 6, 8))
    bg.paste(Image.open(OUT / "로고_가쁨.png"), (0, 0), Image.open(OUT / "로고_가쁨.png"))
    bg.save(OUT / "로고_가쁨_검은바탕.png")
    return "로고_가쁨"



def 모니터():
    # 16행: 측정 기계 모니터 화면 한 장(초록 화면 자리에 얹는다) — 위에 청록 심박 선, 가운데 큰 172 · BPM, 아래 페이스 4'05" /km · VO2 52.4
    MW, MH = 1600, 1000
    img = np.zeros((MH, MW, 3), np.float32) + np.array([0.02, 0.035, 0.04], np.float32)
    m = Image.new("L", (MW, MH), 0)
    d = ImageDraw.Draw(m)
    beat = [(0, 0), (40, 0), (60, -25), (80, 0), (110, 0), (125, 35), (145, -170), (168, 110), (186, 0), (230, -18), (270, 0)]
    pts, x = [], 40
    while x < MW - 40:
        pts += [(x + bx, 190 + by) for bx, by in beat if x + bx < MW - 40]
        x += 300
    d.line(pts, fill=255, width=7, joint="curve")
    d.text((90, 330), "172", font=font("InterTight/InterTight-SemiBold.ttf", 420), fill=255)
    d.text((930, 620), "BPM", font=font("InterTight/InterTight-SemiBold.ttf", 90), fill=200)
    d.text((90, 840), "PACE 4'05\" /km", font=font("DM_Mono/DMMono-Medium.ttf", 64), fill=170)
    d.text((960, 840), "VO2 52.4", font=font("DM_Mono/DMMono-Medium.ttf", 64), fill=170)
    a = np.asarray(m, np.float32) / 255
    a = np.clip(blur(a, 1.2) + blur(a, 16) * 0.45, 0, 1)
    img = img + a[..., None] * TEAL[None, None, :]
    img = np.clip(grain(img, 0.01), 0, 1)
    OUT.mkdir(parents=True, exist_ok=True)
    Image.fromarray((img * 255).astype(np.uint8)).save(OUT / "G_모니터.png")
    return "G_모니터"

ALL = {"숫자": 숫자, "심박": 심박, "막대": 막대, "판": 판, "빛줄기": lambda: (빛줄기(), 빛줄기("G_빛줄기_20", 3, 1.6)),
       "번쩍": 번쩍, "회색판": 회색판, "로고": 로고, "모니터": 모니터}

if __name__ == "__main__":
    for k in sys.argv[1:] or list(ALL):
        print(k, ALL[k](), flush=True)
