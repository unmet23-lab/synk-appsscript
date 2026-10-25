# 시즌 1 · 「옆집의 크리스마스」 — 유호님께 먼저 보여 드릴 이야기 한 장(그림판, 2026-10-26)
#   python 이야기한장.py  →  <밖>/옆집의크리스마스_이야기한장.jpg   (<밖> = Documents/synk-vendor/pulse-season4-20261025/콘티/xmas-neighbors)
# 그림은 이야기 흐름 스케치(GPT 이미지 2.5 연필 스케치 판 셋 — 구도는 뼈대 원본이 오면 바뀜)와 캐스팅북 사진.
# 글은 이야기.md에서 옮긴다(바꾸면 둘 다). SUIT에는 긴 줄표 글자가 없어 쓰지 않는다.
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont

밖 = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-season4-20261025", "콘티", "xmas-neighbors")
스케치 = os.path.join(밖, "이야기스케치")
CAST = "C:/Users/q1212/Documents/SYNK-appsscript/docs/마케팅/PULSE_AI모델_캐스팅_20260930/site/img/"
SUIT = "C:/Users/q1212/Documents/SYNK-appsscript/docs/브랜드_폰트/SUIT/"
F = lambda w, s: ImageFont.truetype(SUIT + f"SUIT-{w}.otf", s)
W = 2400
BG = (20, 22, 30)
INK = (238, 234, 224)
SUB = (168, 166, 158)
AMBER = (232, 176, 96)
M = 60


def panels(sheet):
    im = Image.open(os.path.join(스케치, sheet)).convert("RGB")
    a = np.asarray(im).astype(np.int16)
    white = a.min(axis=2) > 235

    def runs(frac):
        idx = np.where(frac > 0.97)[0]
        groups, cur = [], []
        for i in idx:
            if cur and i != cur[-1] + 1:
                groups.append(cur)
                cur = []
            cur.append(i)
        if cur:
            groups.append(cur)
        return groups

    def cuts(groups, n):
        inner = [g for g in groups if g[0] > 5 and g[-1] < n - 5]
        edges = [0] + [x for g in inner for x in (g[0], g[-1] + 1)] + [n]
        return [(edges[i], edges[i + 1]) for i in range(0, len(edges), 2)]

    xs = cuts(runs(white.mean(axis=0)), im.width)
    ys = cuts(runs(white.mean(axis=1)), im.height)
    return [im.crop((x0 + 4, y0 + 4, x1 - 4, y1 - 4)) for (y0, y1) in ys for (x0, x1) in xs]


# 판1 · 판2 · 판3은 3×3(0~26), 판4 · 판5는 3 · 4판에서 바뀐 장면 2×2(27~30 · 31~34), 판6은 4.2판 장면 3×3(35~43)
P = panels("판1.png") + panels("판2.png") + panels("판3.png") + panels("판4.png") + panels("판5.png") + panels("판6.png")
# 15박(4.2판) — 9번(멈춤 · 켬)과 13번(불 · 라이터)을 두 칸씩, 11 · 12번을 한 칸으로 보여 16칸: (칸, 초, 보이는 것, 들리는 것)
BEATS = [
    (35, "0~3.5", "캄캄한 아파트, 나란히 켜진 두 창만", "민재 엄마(전화) 「크리스마스인데… 혼자 있는 거 아니지?」"),
    (31, "3.5~8", "벽 단면: 거짓말하는 민재 · 벽 너머로 듣는 하린", "민재 「아니야, 친구들이랑 있어.」"),
    (2, "8~10.5", "하린의 초 · 라이터가 안 켜진다", "딸깍, 딸깍, 딸깍"),
    (20, "10.5~12", "벽 너머 전자레인지", "「띵」(단음)"),
    (36, "12~15", "손도 안 댄 1+1 상자 하나(초 1개 동봉)", "펜 소리"),
    (5, "15~19.5", "민재 문고리에 케이크 · 버저 · 달아남", "옛 버저 「삐」 · 양말 발소리"),
    (24, "19.5~24.5", "민재가 쪽지를 읽는다(4초)", "「밤마다 전자레인지 소리가 들려서요. 오늘은 케이크 드세요. (초는… 라이터가 고장이라ㅠ)」"),
    (7, "24.5~28", "슬리퍼로 눈길을 뛰어 편의점으로", "편의점 문 멜로디 차임 · 라이터 하나"),
    (37, "28~29.5", "라이터를 쥐고 현관문 앞에서 멈춘다", "하린 문에 가지 않는 것이 그의 선택"),
    (38, "29.5~31", "공유벽 곁에 앉아 받은 케이크의 초에 불", "초 봉지 뜯는 소리 · 「착」(벽 너머로 가는 답장)"),
    (39, "31~37", "다시 벽 단면 · 하린이 먼저 벽을 두드린다", "똑똑 / 똑똑 · 징글벨 박자 반쪽씩 → 음악"),
    (41, "37~42.5", "하린이 초 못 켠 케이크를 들고 민재 문을 두드린다", "똑똑(불을 빌리러)"),
    (42, "42.5~44.3", "문턱 안의 민재 · 하린 어깨 너머로 한 사람씩", "반 초 멈춤 · 작은 목례 · 입 다문 미소"),
    (43, "44.3~48", "하린의 초에 불 → 그 라이터를 하린 손에", "「착」 · 작은 웃음"),
    (34, "48~53", "다시 엄마 전화", "「진짜 혼자 아니지?」 「응. 혼자 아니야. …옆집이랑.」"),
    (30, "53~60", "두 문간에 앉은 두 사람 · 두 조각과 촛불", "엄마 「…옆집?」 · 「똑똑, 메리 크리스마스」(이 그림 위) · 늘켬 편의점 「1+1의 하나는, 옆집에」"),
]

H = 6400
board = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(board)
y = 60
d.text((M, y), "시즌 1 · 「옆집의 크리스마스」 60초 가로 · 이야기 한 장", font=F("ExtraBold", 58), fill=INK)
y += 86
d.text((M, y), "뼈대 원본은 고르는 중이라 컷 · 초 · 구도는 원본 샷표가 오면 1:1로 맞춘다 · 그림은 이야기 순서만 보는 연필 스케치",
       font=F("Medium", 28), fill=SUB)
y += 80
d.text((M, y), "소리로만 알던 옆집 두 사람이,", font=F("ExtraBold", 72), fill=AMBER)
y += 92
d.text((M, y), "1+1 케이크 한 조각으로 처음 같이 크리스마스를 보낸다.", font=F("ExtraBold", 72), fill=AMBER)
y += 130

# 두 사람
cw = 300
for i, (code, name, lines) in enumerate([
    ("F02", "하린 · 504호 · 24", ["서울 첫 직장 2년 차, 연말 마감에 올해는 못 내려간다", "혼자 먹으려고 산 조각 케이크가 1+1이라 두 개(초도 하나씩)",
                              "초는 꽂았는데 라이터가 고장", "옆집을 아는 법: 밤마다 전자레인지 「띵」, 오늘은 거짓말까지"]),
    ("M04", "민재 · 503호 · 28", ["자취 3년 차 회사원(명세 콘셉트 「옆집 자취생」)", "밤 11시에 들어와 편의점 도시락을 데워 먹는다",
                              "엄마에겐 「친구들이랑 있어」 · 패딩도 못 벗은 채", "옆집을 아는 법: 모른다 · 문고리의 쪽지로 처음 안다"]),
]):
    x = M + i * (W - 2 * M) // 2
    ph = Image.open(CAST + f"{code}/hero.webp").convert("RGB")
    ph = ph.resize((cw, round(ph.height * cw / ph.width)), Image.LANCZOS).crop((0, 0, cw, 360))
    board.paste(ph, (x, y))
    d.text((x + cw + 34, y + 6), name, font=F("ExtraBold", 40), fill=INK)
    for k, ln in enumerate(lines):
        d.text((x + cw + 34, y + 70 + k * 50), ln, font=F("Regular", 28), fill=INK if k < 3 else AMBER)
y += 360 + 30
d.text((M, y), "두 사람은 2년 동안 얼굴을 몰랐다 · 하린은 아침 7시에 나가 저녁 7시에, 민재는 10시에 나가 밤 11시에 들어온다", font=F("Regular", 28), fill=SUB)
y += 80

# 16박
d.text((M, y), "60초 흐름(15박)", font=F("ExtraBold", 42), fill=INK)
d.text((M + 360, y + 10), "1막 혼자인 두 집 0~15 · 2막 문고리 하나, 벽 하나 15~40 · 3막 처음 마주침 40~60", font=F("Medium", 28), fill=SUB)
y += 70
cols = 4
gap = 22
tw = (W - 2 * M - (cols - 1) * gap) // cols
th = round(tw * 9 / 16)
for n, (pi, sec, see, hear) in enumerate(BEATS):
    r, c = divmod(n, cols)
    x = M + c * (tw + gap)
    yy = y + r * (th + 150)
    im = P[pi]
    s = max(tw / im.width, th / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    ox, oy = (im.width - tw) // 2, (im.height - th) // 2
    board.paste(im.crop((ox, oy, ox + tw, oy + th)), (x, yy))
    d.rectangle((x, yy, x + 120, yy + 44), fill=(0, 0, 0))
    d.text((x + 12, yy + 6), f"{n + 1}  {sec}", font=F("SemiBold", 24), fill=AMBER)
    d.text((x, yy + th + 10), see, font=F("SemiBold", 27), fill=INK)
    # 들리는 것은 두 줄까지
    words, line, lines = hear.split(" "), "", []
    for wd in words:
        t = (line + " " + wd).strip()
        if d.textlength(t, font=F("Regular", 23)) > tw:
            lines.append(line)
            line = wd
        else:
            line = t
    lines.append(line)
    for k, ln in enumerate(lines[:3]):
        d.text((x, yy + th + 50 + k * 30), ln, font=F("Regular", 23), fill=SUB)
y += 4 * (th + 150) + 30

# 친절 넷 · 끝 · 브랜드 · 역풍
blocks = [
    ("오가는 작은 친절 넷 · 다가가는 걸음 · 두드림 · 문은 늘 하린이 먼저", [
        "1  하린 → 민재  1+1 케이크의 손도 안 댄 하나(초 1개 동봉 · 문고리 · 버저 누르고 도망) · 쪽지에 「초는… 라이터가 고장이라ㅠ」",
        "2  민재 → 하린  눈길을 뛰어 라이터를 사 와도 하린 문 앞까지 가지 않고 공유벽 곁에서 초를 켠다 · 그 「착」이 벽 너머 답장",
        "3  둘이 같이  「착」을 들은 하린이 먼저 벽을 두드리고 민재가 받는다 · 징글벨 박자 반쪽씩",
        "4  민재 → 하린  불을 빌리러 온 하린의 초에 문턱 안에서 불을 붙이고, 그 라이터를 하린 손에 쥐여 준다 · 케이크는 하린이, 불은 민재가",
    ]),
    ("끝 · 같은 말이 거짓말에서 참말로", [
        "2번(벽 단면) 엄마 「혼자 있는 거 아니지?」 → 민재 「아니야, 친구들이랑 있어.」 · 벽 너머 하린이 그 거짓말을 듣는다",
        "14번 엄마 「진짜 혼자 아니지?」 → 민재(하린을 보며 반 박자 쉬고) 「응. 혼자 아니야. …옆집이랑.」 · 이번엔 하린이 바로 앞에서 듣는다",
        "15번 엄마의 어리둥절한 「…옆집?」이 마지막 웃음 · 하린은 끝까지 한 마디도 하지 않는다(케이크 · 쪽지 · 노크 · 먼저 여는 문)",
    ]),
    ("브랜드 · 동네 편의점(가칭 늘켬)", [
        "1인 가구의 크리스마스이브를 실제로 받쳐 주는 곳: 1인분 케이크, 밤 11시에도 켜진 불, 그리고 1+1",
        "하린의 1+1 케이크와 민재가 뛰어가 산 라이터가 모두 그 가게에서 · 끝에서 두 조각이 한 불로 켜진다",
        "끝 화면: 마지막 넓은 그림 위에 끝 문구 3.5초 → 「늘켬 편의점」 로고 판 3초(1+1 케이크 상자 + 「1+1의 하나는, 옆집에」)",
        "이름(추천): 늘켬 · 늘 켜 둔 불 · 편의점 35류 · 배달 39류 · 모든 류에 같은 이름 없음(KIPRIS 10-26) · 간판은 호박빛 바탕 흰 글자",
    ]),
    ("AI 연말 광고 역풍(표정)을 피하는 법", [
        "처음 42초는 얼굴 없이 손 · 뒷모습 · 머리카락 · 소품 · 소리로만",
        "얼굴은 한 번에 한 사람, 어깨 너머로 작게 · 입 다문 미소까지 · 감정은 말 한 줄(「…옆집이랑.」)과 손 접사 둘(두 손 · 불 하나, 건너가는 라이터)에",
    ]),
    ("검수와 시험", [
        "낯선 사람 이해 시험 여섯 차례(연필 스케치 60초 애니매틱) · 광고 시청자는 모두 끝까지 · 4점 · Fable 검수 두 차례(2차: 새 P0 · P1 없음) · 이 판은 그 반영판",
        "혼자 사는 20대 여성 눈 시험 네 차례: 3판 「내 문에 온 남자」 → 4.1판 22초에 넘김 → 4.2판 처음 끝까지 · 남은 것 「현실이면 겁나 낭만으로만은 못 본다」",
    ]),
    ("고르실 것", [
        "1  끝 문구: 추천 「똑똑, 메리 크리스마스」(마지막 노크와 붙음) · 다른 안 「가장 가까운 이웃은, 벽 하나 너머에 있었다」",
        "2  편의점 이름: 추천 「늘켬」(늘 켜 둔 불 · 35 · 39류와 모든 류에 같은 이름 없음) · 다른 안 켜둠 · 코앞 · 들름",
        "3  두 사람: A 지금대로 민재 · 하린 / B 같은 성별 두 사람(불편의 뿌리를 없앰) / C 노년 이웃과 청년(1위 원본 Woodie's 짜임)",
        "뼈대 원본(레퍼런스 세션 후보 A Woodie's · B Hobby Lobby · C Telekom)을 고르시면 그 샷표의 컷 · 초 · 구도에 1:1로 얹는다",
    ]),
]
for title, lines in blocks:
    d.text((M, y), title, font=F("ExtraBold", 38), fill=AMBER)
    y += 58
    for ln in lines:
        d.text((M + 10, y), ln, font=F("Regular", 29), fill=INK)
        y += 46
    y += 34
board = board.crop((0, 0, W, y + 20))
out = os.path.join(밖, "옆집의크리스마스_이야기한장.jpg")
board.save(out, quality=90)
print(out, board.size)
