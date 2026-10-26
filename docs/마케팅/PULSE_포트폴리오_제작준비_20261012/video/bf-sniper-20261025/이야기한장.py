# 시즌 4 · 「블프 스나이퍼」 — 유호님께 레퍼런스 보드와 함께 보여 드릴 이야기 한 장(그림판, 2026-10-26)
#   python 이야기한장.py  →  <밖>/블프스나이퍼_이야기한장.jpg   (<밖> = Documents/synk-vendor/pulse-season4-20261025/콘티/bf-sniper)
# 그림은 이야기 흐름 스케치(GPT 이미지 2.5 연필 스케치 판 셋 — 구도는 뼈대 원본이 오면 바뀜)와 캐스팅북 대표 사진.
# 글은 이야기.md 1.2판에서 옮긴다(바꾸면 둘 다). SUIT에는 긴 줄표 글자가 없어 쓰지 않는다.
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont

밖 = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-season4-20261025", "콘티", "bf-sniper")
스케치 = os.path.join(밖, "이야기스케치")
CAST = "C:/SYNK-LoRA/casting/wave1_20261019/M05_h1.jpg"
SUIT = "C:/Users/q1212/Documents/SYNK-appsscript/docs/브랜드_폰트/SUIT/"
F = lambda w, s: ImageFont.truetype(SUIT + f"SUIT-{w}.otf", s)
W = 2400
BG = (18, 20, 28)
INK = (238, 234, 224)
SUB = (168, 166, 158)
CYAN = (120, 220, 240)
AMBER = (232, 150, 70)
M = 60


def panels(sheet):
    """흰 홈으로 칸을 가른다 — 줄을 먼저, 줄 안에서 칸을(줄마다 칸 너비가 다를 수 있다)."""
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
    out = []
    for (y0, y1) in cuts(runs(white.mean(axis=1)), im.height):
        xs = cuts(runs(white[y0:y1].mean(axis=0)), im.width)
        out += [im.crop((x0 + 4, y0 + 4, x1 - 4, y1 - 4)) for (x0, x1) in xs]
    return out


P = panels("판1.png") + panels("판2.png") + panels("판3.png") + panels("판4.png")
assert len(P) == 21, len(P)
# 판4(Fable 보드 1차 · 이야기 반영 확인의 그림판 세 칸): 17 조준경 속 시점 · 18 쪽지 없는 00:00 · 19 화면 꺼진 아침 · 20 휴대폰이 앞인 알림

# (칸, 초, 막, 보이는 것, 들리는 것) — 이야기.md 1.2판 표
BEATS = [
    (16, "0.0", "1막", "첫 그림 · 담요를 쓰고 엎드린 저격 자세, 화면 셋, 23:57", "속삭임 「작전명… 블프.」"),
    (8, "2.5", "1막", "쇼핑몰 화면 · 75인치 TV 블프 반값(작게 · 일주일 내내 · 선착순 없음)", "속삭임 「목표… 75인치 TV, 반값.」"),
    (1, "4.3", "1막", "알람 셋 · 모두 00:00(삼중 보험)", "삑 · 삑 · 삑"),
    (3, "6.1", "1막", "손가락 스트레칭(역광 · 그림 시험 뒤 정함)", "우두둑"),
    (17, "7.4", "1막", "휴지심 조준경 속 시점 · 「반값」", "속삭임 「조준 완료.」"),
    (2, "9.0", "1막", "화면빛 아래 진지한 얼굴(3/4)", "북이 빨라짐"),
    (6, "10.0", "1막", "마우스 위 검지(줄일 순서 맨 앞)", ""),
    (7, "11.0", "1막", "눈을 감고 저격수 호흡", "「들이쉬고…」"),
    (1, "12.5", "2막", "내 폰 타이머 3 · 2 · 1 ↔ 감은 눈", "「반 내쉬고…」(3) · 「멈추고…」(1)"),
    (18, "15.5", "2막", "00:00 · 알람 셋 동시", "알람 셋"),
    (10, "17.0", "2막", "반전 · 잠들었다, 검지는 그대로", "음악 뚝 → 멈춘 숨이 「드르렁…」"),
    (20, "19.5", "3막", "앱 알림 · 주무세요. 선착순 없어요.", "가게 목소리 같은 말"),
    (19, "22.5", "3막", "다음 날 아침 7:42 · 깨어 앉음(화면 셋은 꺼짐)", "새소리 · 하품"),
    (14, "25.0", "3막", "엄지 톡 · 결제 완료 · 반값 그대로", "톡"),
    (15, "26.5", "3막", "끝 화면 · 블프, 자고 일어나서. 느지막", "가게 목소리 · 코골이 한 번"),
]

COLS = 5
cw = (W - 2 * M - (COLS - 1) * 24) // COLS
ch = round(cw * 9 / 16)
rows = (len(BEATS) + COLS - 1) // COLS
row_h = ch + 175
H = 470 + rows * (row_h + 24) + 260
img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)
d.text((M, 50), "시즌 4 · 블프 B급 코미디 「블프 스나이퍼」 30초 · 이야기 한 장(1.3판)", font=F("ExtraBold", 54), fill=INK)
d.text((M, 130), "한 문장  자정 세일을 저격수처럼 준비한 아빠가 00:00에 잠들었다. 괜찮다, 이 가게 블프는 선착순이 없다.",
       font=F("ExtraBold", 38), fill=CYAN)
d.text((M, 190), "배역  준호(38 · 믿음직한 생활형, 아빠 · 아이는 화면에 없음)    가상 브랜드  느지막(가전 · 생활 온라인몰 · 선착순 없음 · 블프 가격 일주일 내내)",
       font=F("Medium", 30), fill=SUB)
d.text((M, 240), "그림은 이야기 흐름 스케치다. 구도 · 컷 길이 · 카메라는 고르신 뼈대 원본의 것으로 바뀐다.", font=F("Medium", 28), fill=SUB)
cast = Image.open(CAST).convert("RGB")
cast.thumbnail((200, 200))
img.paste(cast, (W - M - cast.width, 40))
d.text((M, 300), "웃음은 표정이 아니라 상황 · 소품 · 소리에서 난다 — 준호는 끝까지 진지한 무표정, 반전은 잠든 얼굴.",
       font=F("SemiBold", 32), fill=AMBER)
d.text((M, 350), "낯선 사람 이해 시험 4차 통과(끝까지 · 4점): 「블프 TV 반값을 자정에 잡으려고 밤새 벼르던 남자가 알람 앞에서 그냥 잠들었는데,",
       font=F("Medium", 28), fill=INK)
d.text((M, 390), "선착순이 아니라서 아침에 일어나 똑같은 가격에 샀다는 느지막 광고」 · 40대 아빠 역할 「놀림보다 공감」 · Fable 1차 반영",
       font=F("Medium", 28), fill=INK)

y0 = 460
for i, (pi, t, act, see, hear) in enumerate(BEATS):
    r, c = divmod(i, COLS)
    x = M + c * (cw + 24)
    y = y0 + r * (row_h + 24)
    p = P[pi].copy()
    s = max(cw / p.width, ch / p.height)
    p = p.resize((round(p.width * s), round(p.height * s)), Image.LANCZOS)
    p = p.crop(((p.width - cw) // 2, (p.height - ch) // 2, (p.width - cw) // 2 + cw, (p.height - ch) // 2 + ch))
    img.paste(p, (x, y))
    col = AMBER if pi in (10,) else CYAN
    d.rounded_rectangle((x + 8, y + 8, x + 150, y + 52), radius=10, fill=(0, 0, 0))
    d.text((x + 18, y + 12), f"{t}초", font=F("ExtraBold", 30), fill=col)
    d.text((x + cw - 90, y + 14), act, font=F("ExtraBold", 26), fill=(255, 255, 255), stroke_width=3, stroke_fill=(0, 0, 0))
    lines, cur = [], ""
    for ch_ in see:
        if d.textlength(cur + ch_, font=F("SemiBold", 25)) > cw:
            lines.append(cur)
            cur = ch_
        else:
            cur += ch_
    lines.append(cur)
    for k, ln in enumerate(lines[:2]):
        d.text((x, y + ch + 10 + k * 34), ln, font=F("SemiBold", 25), fill=INK)
    if hear:
        d.text((x, y + ch + 10 + 2 * 34 + 4), hear, font=F("Medium", 24), fill=SUB)

y = y0 + rows * (row_h + 24) + 10
for line in [
    "말은 여섯 줄, 입이 보이지 않는다 · 준호 속삭임 넷(담요 그늘 · 화면 컷 · 조준경 속 · 3/4 옆얼굴) + 가게 목소리 둘(화면 밖).",
    "화면 · 알림 · 결제 완료 · 끝 화면 글은 모두 후반 합성(넓은 컷 화면은 빈 빛). 음악은 작전물 느낌의 새 곡(기존 영화 음악은 쓰지 않는다).",
    "총 · 사람을 겨누는 장면은 없다 · 「저격」은 화면 속 가격을 노리는 비유뿐(미국 풍자 「블프 저격수」와 겹치지 않게).",
    "브랜드 이름 「느지막」 · KIPRIS 35류 · 모든 류 0건(느긋 · 늦장 · 느루는 같은 뜻 · 같은 소리 상표가 있어 뺐다).",
]:
    d.text((M, y), line, font=F("Medium", 30), fill=INK)
    y += 50
out = os.path.join(밖, "블프스나이퍼_이야기한장.jpg")
img.save(out, quality=90)
print(out, img.size)
