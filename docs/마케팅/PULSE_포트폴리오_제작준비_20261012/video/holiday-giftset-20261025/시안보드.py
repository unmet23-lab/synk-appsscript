# 시즌 2 · 홀리데이 기프트 세트 — 제품 · 룩 시안 보드(블렌더 시험 렌더 모음, 2026-10-26)
#   python 시안보드.py  →  <밖>/기프트세트_제품룩시안.jpg   (<밖> = Documents/synk-vendor/pulse-season4-20261025/콘티/holiday-giftset)
# 렌더는 블렌더/선물상자.py(--shot · --u · --look), 포장 원고는 라벨/포장.py.
import os

from PIL import Image, ImageDraw, ImageFont

밖 = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-season4-20261025", "콘티", "holiday-giftset")
렌더 = os.path.join(밖, "렌더")
SUIT = "C:/Users/q1212/Documents/SYNK-appsscript/docs/브랜드_폰트/SUIT/"
F = lambda w, s: ImageFont.truetype(SUIT + f"SUIT-{w}.otf", s)
W = 2400
BG = (18, 20, 28)
INK = (236, 232, 222)
SUB = (170, 168, 160)
GOLD = (214, 172, 104)


def tile(name, w):
    im = Image.open(os.path.join(렌더, name)).convert("RGB")
    h = round(im.height * w / im.width)
    return im.resize((w, h), Image.LANCZOS)


def caption(d, xy, title, body=None):
    d.text(xy, title, font=F("ExtraBold", 30), fill=INK)
    if body:
        d.text((xy[0], xy[1] + 40), body, font=F("Regular", 24), fill=SUB)


rows = []
# 1줄: 룩 셋
looks = [("hero_A_u0.00.png", "A 첫눈 새벽", "옅은 청백 눈밭 · 뒤에서 금빛 역광"),
         ("hero_B_u0.00.png", "B 금빛 밤 (추천)", "남색 밤 · 금빛 보케 · 바닥의 눈 결정"),
         ("hero_C_u0.00.png", "C 얼음 유리", "얼음판 위 · 은청 · 유리 굴절")]
gap = 24
lw = (W - 2 * 60 - 2 * gap) // 3
canvas_h = 4200
board = Image.new("RGB", (W, canvas_h), BG)
d = ImageDraw.Draw(board)
y = 60
d.text((60, y), "시즌 2 · 홀리데이 기프트 세트 · 제품 · 룩 시안 3.1판", font=F("ExtraBold", 56), fill=INK)
y += 80
d.text((60, y), "블렌더 시험 렌더(크레딧 0) · 가칭 브랜드 「유리결 YURIGYEOL」 · 홀리데이 에디션 「서리꽃 SEORIKKOT」 · 화장품 03류에 같은 이름 없음(KIPRIS 10-26)",
       font=F("Medium", 28), fill=GOLD)
y += 70
x = 60
for name, t, b in looks:
    im = tile(name, lw)
    board.paste(im, (x, y))
    caption(d, (x, y + im.height + 14), t, b)
    x += lw + gap
y += tile(looks[0][0], lw).height + 110

# 2줄: 리본이 풀리는 다섯 단계(B)
d.text((60, y), "리본이 풀린다 · 진행값 하나(u)로 움직이는 블렌더 장면(B판)", font=F("ExtraBold", 34), fill=INK)
y += 56
steps = [("hero_B_u0.00.png", "0 묶인 나비 · 긴 꼬리"), ("hero_B_u0.20.png", "0.2 고리 · 꼬리가 매듭으로"),
         ("hero_B_u0.40.png", "0.4 갈래가 휘며 일어섬"), ("hero_B_u0.65.png", "0.65 끝이 말리며 쓰러짐"),
         ("hero_B_u0.90.png", "0.9 앞부터 들리며 금빛 김")]  # 3판: 넓은 컷만 김, 위로 갈수록 옅게
sw = (W - 2 * 60 - 4 * 16) // 5
x = 60
for name, t in steps:
    im = tile(name, sw)
    board.paste(im, (x, y))
    d.text((x, y + im.height + 12), t, font=F("SemiBold", 24), fill=INK)
    x += sw + 16
y += tile(steps[0][0], sw).height + 70

# 2줄 0.45 칸은 두 갈래가 나란히 곧게 서는 순간(2차 「손잡이」 그림)이라 3.1판에서 0.4로(Fable 3차 P3-1 — 0.52는 다 선 때)
# 3줄: 제품이 떠오름 · 제품 접사 · 위에서 · 매듭 접사(B) — 3판: 위에서 내려다본 열린 상자는 유리 옆면이 반사만 보여
#   단지가 금 콤팩트로 읽혔다(Fable 2차 P2-1) → 원본 1위의 「병이 떠오름」 박을 눈높이로
four = [("open_B_u1.00_r1.00.png", "제품이 떠오름", "단지 → 앰플 차례로 · 유리 벽과 흰 크림"),
        ("product_B_u1.00.png", "제품 접사", "두꺼운 유리 단지 · 금 목 고리 · 스포이드"),
        ("top_B_u0.00.png", "위에서", "낮고 넓은 나비 · 비틀린 긴 꼬리 · 한 공단"),
        ("macro_B_u0.00.png", "매듭 접사", "샴페인 금 공단 · 실결 · 길이 방향 광택")]
fw = (W - 2 * 60 - 3 * gap) // 4
x = 60
for name, t, b in four:
    im = tile(name, fw)
    board.paste(im, (x, y))
    caption(d, (x, y + im.height + 14), t, b)
    x += fw + gap
y += tile(four[0][0], fw).height + 110

# 4줄: 세로 9:16 둘 + 구성
d.text((60, y), "세로 9:16(15초 · 6초 세로판)", font=F("ExtraBold", 34), fill=INK)
y += 56
vw = 470
x = 60
for name in ("hero_B_u0.00_세로.png", "open_B_u1.00_r1.00_세로.png"):
    im = tile(name, vw)
    board.paste(im, (x, y))
    x += vw + gap
tx = x + 30
spec = [
    ("구성(가칭)", GOLD),
    ("상자 18 × 18 × 10 cm · 진주빛 흰 판지 · 뚜껑 1.5 mm 크게(틈)", INK),
    ("뚜껑 윗면 서리꽃 엠보 · 앞 옆띠에 짙은 금박 이름(리본 띠를 비켜)", INK),
    ("리본 3.6 cm 샴페인 금 공단 · 낮고 넓은 나비 + 비틀린 긴 꼬리(V)", INK),
    ("속: 금박 벽 + 샴페인 벨벳 인서트(얕은 제품 홈 둘)", INK),
    ("① 글래스 앰플 30 ml : 벽 3 mm · 금빛 액 70 % · 실리콘 스포이드", INK),
    ("② 글래스 크림 50 ml : 벽 5 mm 유리 단지 · 금 목 고리 · 금 뚜껑", INK),
    ("Fable 2 · 3차 반영: 나비 · 꼬리 · 한 공단 · 크림이 보이게 · 금 뚜껑", SUB),
    ("", INK),
    ("이 판에서 정할 것", GOLD),
    ("· 룩: A 첫눈 새벽 / B 금빛 밤(추천) / C 얼음 유리", INK),
    ("· 이름: 유리결 · 서리꽃(추천) / 다른 안 눈결(03류 없음)", INK),
    ("· 리본 풀림: 스스로 풀리는 CG(지금) / 손이 끝을 당겨 시작", INK),
    ("· 제품: 상자에서 떠오름(원본 1위 박) / 손이 꺼냄(B · C 원본)", INK),
    ("", INK),
    ("컷 · 초 · 카메라는 뼈대 원본 샷표가 오면 그 틀로 맞춘다", SUB),
    ("글자 · 로고는 렌더 위에 그리지 않고 포장 원고를 재질로 씀", SUB),
]
ty = y + 10
for line, col in spec:
    d.text((tx, ty), line, font=F("SemiBold" if col == GOLD else "Regular", 30 if col == GOLD else 27), fill=col)
    ty += 50 if line else 26
y += tile("hero_B_u0.00_세로.png", vw).height + 60
board = board.crop((0, 0, W, y))
out = os.path.join(밖, "기프트세트_제품룩시안.jpg")
board.save(out, quality=90)
print(out, board.size)
