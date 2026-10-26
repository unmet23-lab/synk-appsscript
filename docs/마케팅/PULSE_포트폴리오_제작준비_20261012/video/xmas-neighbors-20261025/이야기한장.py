# 시즌 1 · 「옆집의 크리스마스」 — 유호님께 보여 드릴 이야기 한 장 5.6판(그림판, 2026-10-26)
#   python 이야기한장.py  →  <밖>/옆집의크리스마스_이야기한장.jpg   (<밖> = Documents/synk-vendor/pulse-season4-20261025/콘티/xmas-neighbors)
# 그림은 이야기 흐름 스케치(GPT 이미지 2.5 연필 스케치 판7~판20 — 원본 Woodie's 36컷 순서)와 캐스팅북 사진.
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
            if cur and i > cur[-1] + 4:  # 홈이 1~3픽셀 틈으로 갈려도 한 홈(판19)
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


# 판7 0~8 · 판8 9~17 · 판9 18~26 · 판10 27~35 · 판11 36~44 · 판12 45~53 · 판13 54~57 · 판14 58~66 · 판15 67~75 · 판16 76~81 · 판17 82~87
# · 판18 88~91 · 판19 92~100 · 판20 101~102 (애니매틱_13.py와 같은 번호)
P = (panels("판7.png") + panels("판8.png") + panels("판9.png") + panels("판10.png") + panels("판11.png") + panels("판12.png")
     + panels("판13.png") + panels("판14.png") + panels("판15.png") + panels("판16.png") + panels("판17.png")
     + panels("판18.png") + panels("판19.png") + panels("판20.png"))
# 원본 36컷 가운데 16칸: (칸, 원본 컷 · 초, 보이는 것, 들리는 것)
BEATS = [
    (92, "1 · 0~3.6", "늦가을 밤 · 503호 문간만 깜깜하다", "(전화) 「아들, 집엔 들어갔어?」 「응, 들어왔어.」 · 어둠 속 열쇠 꾸러미가 떨어짐 「짤그랑」"),
    (68, "2 · 3.6~4.5", "그의 문 바로 위, 몇 달째 꺼진 센서등", "지직 · 툭"),
    (94, "6 · 8.6~10", "긁힌 자국투성이 열쇠 구멍 · 폰 불빛", "긁 · 긁 · 한숨"),
    (70, "8 · 11.9~13.3", "바로 옆 504호 · 빨간 리본의 하린(경계)", "웃음 · 음악"),
    (88, "9 · 13.3~15", "하린의 역광 실루엣 접사(얼굴 없이)", "웃음"),
    (65, "11 · 16~17.4", "시끄러운 옆집에 등을 돌리는 민재", "웃음이 멀어짐"),
    (44, "13 · 18.8~20", "혼자 먹는 저녁 · 벽 너머 음악", "띵 · 먹먹한 음악"),
    (84, "15 · 21.4~22.8", "늘켬에서 1+1 전구 상자를 사는 하린(복선)", "피아노"),
    (95, "17 · 24.1~24.6", "흐려지는 폰 불빛 · 배터리 부족", "배터리 부족 알림음"),
    (96, "18 · 24.6~25.9", "핼러윈 · 하린 일행의 발밑을 비춰 주는 민재", "웃음소리 · 발소리"),
    (87, "20 · 28.4~30.8", "같은 자리 와이드 · 옆집만 밝아지고 503호는 깜깜", "폭우"),
    (74, "25 · 35.9~37.5", "크리스마스이브 · 창가에서 내다보는 하린", "숨을 고르고 현악"),
    (78, "26 · 37.5~38.9", "같은 자리 · 503호만 깜깜, 민재가 온다", "피아노 · 현악"),
    (100, "28 · 40.1~42.9", "머리 위 등이 딸깍 · 열쇠가 한 번에", "딸깍 · 한 번에 철컥"),
    (24, "30 · 44~46.4", "민재 얼굴(처음) · 알아차림", "1차 고조"),
    (101, "31 · 46.4~47.6", "창 너머로 하린이 듣는 그의 전화", "「응, 엄마. 들어왔어.」 이번엔 참말"),
    (81, "32 · 47.6~49.7", "하린 신발장 위 · 나방 붙은 옛 전구 · 1+1 상자", "집는 소리 · 비닐봉지"),
    (56, "33 · 49.7~50.8", "남은 전구 하나는 자기 스탠드에", "스탠드 딸깍"),
    (80, "34 · 50.8~53.8", "하린 얼굴(정체)", "「메리 크리스마스, 옆집.」(고개를 돌리며)"),
    (41, "35~36 · 53.8~60", "나란히 켜진 두 현관 등", "「1+1의 하나는, 옆집에」 → 「늘켬 편의점 · 옆집까지 늘 켜 둡니다」"),
]

H = 7400
board = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(board)
y = 60
d.text((M, y), "시즌 1 · 「옆집의 크리스마스」 60초 가로 · 이야기 한 장 5.6판", font=F("ExtraBold", 58), fill=INK)
y += 86
d.text((M, y), "뼈대 원본 Woodie's 「Happy Christmas Mrs Higgins」 36컷의 순서 · 초 · 구실에 1:1로 얹었다 · 그림은 이야기 순서만 보는 연필 스케치",
       font=F("Medium", 28), fill=SUB)
y += 80
d.text((M, y), "몇 달째 꺼진 현관 등 아래서 헤매던 옆집에게,", font=F("ExtraBold", 72), fill=AMBER)
y += 92
d.text((M, y), "크리스마스이브엔 불이 켜진다. 1+1 전구의 하나로.", font=F("ExtraBold", 72), fill=AMBER)
y += 130

# 두 사람
cw = 300
for i, (code, name, lines) in enumerate([
    ("M04", "민재 · 503호 · 28 · 원본 노부인 자리", ["밤 11시 퇴근, 늘켬 도시락을 데워 먹는다", "현관 센서등이 몇 달째 꺼져 어둠 속 열쇠 구멍을 더듬는다",
                                          "엄마 전화엔 「응, 들어왔어」 · 그래도 시끄러운 옆집 발밑은 비춰 주는 사람", "누가 고쳤는지 끝까지 모른다"]),
    ("F02", "하린 · 504호 · 24 · 원본 길 건너 소년 자리", ["바로 옆집, 자기 문 위 등은 켜진다 · 표지는 빨간 머리 리본", "친구들과 떠들고 밤엔 음악이 새는 「시끄러운 옆집」",
                                             "핼러윈에 받은 불빛을, 크리스마스이브에 1+1 전구 하나로 갚는다", "남은 하나는 자기 스탠드에"]),
]):
    x = M + i * (W - 2 * M) // 2
    ph = Image.open(CAST + f"{code}/hero.webp").convert("RGB")
    ph = ph.resize((cw, round(ph.height * cw / ph.width)), Image.LANCZOS).crop((0, 0, cw, 360))
    board.paste(ph, (x, y))
    d.text((x + cw + 34, y + 6), name, font=F("ExtraBold", 36), fill=INK)
    for k, ln in enumerate(lines):
        d.text((x + cw + 34, y + 70 + k * 50), ln, font=F("Regular", 27), fill=INK if k < 3 else AMBER)
y += 360 + 30
d.text((M, y), "원본의 감정 장치 「경계하던 그 사람이 몰래 고친 사람이었다」 · 우리 판은 「시끄럽다고 등을 돌렸던 옆집이 꺼진 등을 갈아 끼운 사람이었다」",
       font=F("Regular", 28), fill=SUB)
y += 80

# 16칸
d.text((M, y), f"60초 흐름(원본 36컷 가운데 {len(BEATS)}칸)", font=F("ExtraBold", 42), fill=INK)
d.text((M + 720, y + 10), "① 혼자의 고생 · ② 경계 · ③ 되풀이(가을 · 비 · 눈) · ④ 지켜봄 → 반전 · ⑤ 정체 · ⑥ 끝", font=F("Medium", 28), fill=SUB)
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
    lab = F("SemiBold", 24)
    d.rectangle((x, yy, x + d.textlength(sec, font=lab) + 24, yy + 44), fill=(0, 0, 0))
    d.text((x + 12, yy + 6), sec, font=lab, fill=AMBER)
    fs = 27
    while d.textlength(see, font=F("SemiBold", fs)) > tw and fs > 20:
        fs -= 1
    d.text((x, yy + th + 10), see, font=F("SemiBold", fs), fill=INK)
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
y += -(-len(BEATS) // cols) * (th + 150) + 30

blocks = [
    ("원본에서 바뀐 것 · 원본 구실은 그대로", [
        "대문 → 현관 센서등 · 노끈 → 꺼진 전구 · 새 경첩 → 새 전구 · 길 건너 10대 소년 → 옆집 하린 · 우디스 봉투 → 늘켬 봉투",
        "고장 소리(대문 덜컹) → 어둠 속 열쇠가 구멍을 긁는 「짤랑 · 긁」 되풀이 · 바닥 마모 자국 → 열쇠 구멍 둘레의 긁힌 자국 · 반전의 딸깍 → 센서등 「딸깍」과 한 번에 「철컥」",
        "몰래 고치는 사람을 하린으로 · 민재는 하린에게 다가가지 않는다(「남자가 밤에 여자 집 문에서 몰래」를 피함, 결정 10-26)",
        "처음 거짓말 「응, 들어왔어.」는 31에서 엄마 전화를 다시 받으며 참말이 되고, 벽 너머로 날마다 듣던 하린이 그 말을 듣는다",
    ]),
    ("정해진 원본과 다르게 할 것 셋(유호님 10-26 「모두 추천안으로」)", [
        "1  얼굴은 30(민재 · 알아차림) · 34(하린 · 정체)에서만 · 나머지 얼굴 접사 자리는 뒷모습 · 옆 실루엣 · 손",
        "2  개 자리는 늘켬 봉투 · 발 · 이웃 인사는 말 없는 목례 · 손 흔들기(입 맞춘 대사 없음)",
        "3  끝 글판 둘: 마지막 넓은 그림 위 「1+1의 하나는, 옆집에」(약 3초) → 로고 판 「늘켬 편의점」(2.96초)",
    ]),
    ("브랜드 · 늘켬(늘 켜 둔 불)", [
        "밤새 켜진 길 건너 가게의 불빛이, 몇 달 꺼져 있던 옆집 현관까지 옮겨 간다 · 1+1 전구 하나는 옆집 현관, 하나는 내 스탠드",
        "화면에는 소품으로만: 민재의 늘켬 봉투 · 창 너머 늘켬의 하린(복선) · 신발장 위 1+1 상자와 늘켬 봉투 · 끝 밤 거리의 간판과 로고",
    ]),
    ("검수와 시험", [
        "낯선 사람 시험 8~14차(광고 시청자 · 혼자 사는 20대 여성, 14차는 두 명씩) · 답 1은 일곱 차례 모두 한 문장과 같은 뜻",
        "14차(이 판): 여성 하나 끝까지 · 점수 3 · 3 · 4 · 4 · 넘긴 곳은 5초 하나, 나머지는 가운데 되풀이(22~40초, 원본 ③ 덩이)",
        "Fable 5.1 · 5.3판 지적 모두 반영(21 얼굴 칸 · 9 접사 · 소리표 등) · 빨간 리본은 어리게 안 읽히고 같은 자리 와이드 넷은 지루하지 않다",
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
