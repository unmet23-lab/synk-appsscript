# synkbrief B72 「공부하기」 화면 재료 — 2026-11-24 ChatGPT에서 실제로 받은 화면(밝은 화면으로 찍음)을 조각으로 자른다.
# 원본 화면은 git 밖 %USERPROFILE%/ego/synkbrief-studymode-20261124/light/ 에 있다(실험 E11~E17, 입력 칸 C2 · C6).
# 조각마다 대강의 상자를 주고, 그 안에서 바탕(#FCFCFC)과 다른 화소의 테두리로 다시 맞춘 뒤 여백을 붙인다.
# 사용: python -I -X utf8 scripts/재료.py   (remotion 폴더에서) → public/img/<이름>.png · src/sizes.json
import json, os, sys
from PIL import Image, ImageChops

SRC = os.path.join(os.path.expanduser("~"), "ego", "synkbrief-studymode-20261124", "light")
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, "public", "img")  # 영상용 사본(git 밖) — 정본은 편 폴더 그림/
KEEP = os.path.join(os.path.dirname(HERE), "그림")
os.makedirs(OUT, exist_ok=True)
os.makedirs(KEEP, exist_ok=True)
BG = (252, 252, 252)

# 이름: (원본 파일, x0, y0, x1, y1, 맞춤 여부)
CUTS = {
    # 공부하기만 켜고 보낸 채팅(E11 · E12) — 「그냥 답만 알려 줘」에 바로 답
    "u_bubble0": ("E11_전체.png", 400, 425, 1050, 555, True),   # 공부하기 이 문제 풀어 줘(첫 말)
    "u_eq": ("E11_전체.png", 200, 1520, 900, 1615, True),       # 3x − ? = x + 8
    "u_ask": ("E11_전체.png", 20, 1675, 1000, 1755, True),      # 빈칸에 어떤 숫자가 들어갈까?
    "u_bubble": ("E11_전체.png", 600, 1875, 1050, 2010, True),  # 그냥 답만 알려 줘
    "u_answer": ("E11_전체.png", 20, 2090, 600, 2175, True),    # 정답: x = 7
    # 공부하기 + 한 줄을 붙여 보낸 채팅(E13~E17)
    "g_bubble": ("E13_전체.png", 320, 420, 1050, 685, True),    # 공부하기 이 문제 풀어 줘. 내가 답만 알려 달라고 해도 … 힌트로 다시 물어봐 줘.
    "g_ack": ("E13_전체.png", 20, 770, 1060, 910, True),        # 좋아! 답만 알려 달라고 해도 정답을 바로 말하지 않고, …
    "g_eq0": ("E13_전체.png", 200, 1535, 900, 1630, True),      # 3(x − 2) = 3x − ?
    "g_ask0": ("E13_전체.png", 20, 1690, 1000, 1765, True),     # 빈칸에 들어갈 숫자는 무엇일까?
    "g_bubble2": ("E13_전체.png", 600, 1890, 1050, 2025, True), # 그냥 답만 알려 줘
    "g_refuse": ("E13_전체.png", 20, 2110, 1000, 2190, True),   # 아까 약속한 대로 정답 대신 힌트를 줄게! 😊
    "g_eq1": ("E13_전체.png", 200, 2350, 900, 2445, True),      # 3(x − 2) = 3x−?
    "g_hint": ("E13_전체.png", 20, 2500, 1000, 2578, True),     # 힌트: 3과 2를 곱하면 얼마일까?
    "g_b6": ("E13_전체.png", 880, 2705, 1050, 2840, True),      # 6
    "g_ok6": ("E13_전체.png", 20, 2918, 1000, 3000, True),      # 맞아! 잘했어. 😊
    "g_f6": ("E13_전체.png", 200, 3052, 900, 3145, True),       # 3x − 6 = x + 8
    "g_move": ("E13_전체.png", 200, 3505, 900, 3615, True),     # 3x − x = 8 + 6(2단계 이항 — 이해 시험 3회 o 「3x−6에서 2x=?로 건너뜀」)
    "g_eq2": ("E13_전체.png", 200, 3795, 900, 3905, True),      # 2x = ?
    "g_ask2": ("E13_전체.png", 20, 3965, 1000, 4060, True),     # 빈칸에 들어갈 숫자는 얼마일까?
    "g_b14": ("E13_전체.png", 880, 4155, 1050, 4295, True),     # 14
    "g_ok14": ("E13_전체.png", 20, 4378, 1000, 4455, True),     # 정확해! 😊
    "g_f14": ("E13_전체.png", 200, 4518, 900, 4595, True),      # 2x = 14
    "g_eq3": ("E13_전체.png", 200, 4900, 900, 5040, True),      # x = 14/2
    "g_ask3": ("E13_전체.png", 20, 5095, 1060, 5172, True),     # 자, 이제 마지막 단계야. 14를 2로 나누면 얼마일까?
    "g_b7": ("E13_전체.png", 880, 5292, 1050, 5428, True),      # 7
    "g_ok7a": ("E13_전체.png", 20, 5510, 290, 5590, True),      # 정답이야! 🎉
    "g_ok7b": ("E13_전체.png", 290, 5510, 1000, 5590, True),    # 스스로 문제를 잘 풀었어.
    "g_check": ("E13_전체.png", 200, 5815, 900, 5905, True),    # 3(7 − 2) = 7 + 8
    "g_check_ask": ("E13_전체.png", 20, 5962, 1060, 6040, True), # 왼쪽과 오른쪽을 각각 계산하면 얼마가 나올까?
    "composer": ("E13_전체.png", 0, 7380, 1075, 7735, True),    # 아래 입력 칸(「ChatGPT는 실수할 수 있습니다」 줄 포함)
    # 입력 칸 — + 메뉴(C1), 「공부」를 친 메뉴(C2), 사진 · 공부하기 · 한 줄(C6)
    "c1": ("C1_플러스메뉴.png", 0, 1560, 1075, 2290, False),     # + 를 누른 메뉴(아래쪽)와 입력 칸
    "c2": ("C2_공부검색.png", 30, 1890, 1045, 2290, True),
    "c6": ("C6_한줄붙임.png", 30, 1580, 1045, 2290, True),
}

def fit(im, pad=12):
    diff = ImageChops.difference(im.convert("RGB"), Image.new("RGB", im.size, BG)).convert("L").point(lambda v: 255 if v > 14 else 0)
    box = diff.getbbox()
    if not box:
        return im
    x0, y0, x1, y1 = box
    return im.crop((max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad)))

sizes = {}
for name, (f, x0, y0, x1, y1, trim) in CUTS.items():
    src = Image.open(os.path.join(SRC, f)).convert("RGB")
    im = src.crop((x0, y0, x1, y1))
    if trim:
        im = fit(im)
    im.save(os.path.join(OUT, f"{name}.png"))
    im.save(os.path.join(KEEP, f"{name}.png"))
    sizes[name] = [im.width, im.height]
    print(name, im.size)

# 숙제 사진 — 우리가 만든 문제를 손글씨 서체로 그린 공책 그림(실험에서 실제로 올린 파일 그대로, 그림/숙제4번.jpg)
ph = Image.open(os.path.join(KEEP, "숙제4번.jpg")).convert("RGB")
ph.save(os.path.join(OUT, "photo.png"))
sizes["photo"] = [ph.width, ph.height]
print("photo", ph.size)
# 채팅에 붙은 사진 자리 — 찍은 화면에서는 미리보기가 「실패」로 떠서, 실제로 올린 같은 그림의 문제 줄(식 · x = ?)을 잘라 그 자리에 둔다
# (이해 시험 3회 s · h · o 「정답 x = 7이 무슨 문제의 답인지 모름」)
pq = ph.crop((165, 410, 1010, 775))
pq.save(os.path.join(OUT, "photo_q.png"))
pq.save(os.path.join(KEEP, "photo_q.png"))
sizes["photo_q"] = [pq.width, pq.height]
print("photo_q", pq.size)

json.dump(sizes, open(os.path.join(HERE, "src", "sizes.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("sizes.json", len(sizes))
