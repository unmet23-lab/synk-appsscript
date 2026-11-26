"""참고 화면과 시안을 나란히 놓은 그림 네 장. python -I compare.py <셋째판 폴더> <출력 폴더>"""
import os, sys
from PIL import Image, ImageDraw, ImageFont
B, O = sys.argv[1], sys.argv[2]
R = "C:/Users/q1212/Documents/SYNK-보관함/조사/디자인참고_20261106/질문창_셋째_20261126/ask"; S = B + "/shots"
os.makedirs(O, exist_ok=True)
fb = ImageFont.truetype("C:/Windows/Fonts/malgunbd.ttf", 34); fr = ImageFont.truetype("C:/Windows/Fonts/malgun.ttf", 24); fs = ImageFont.truetype("C:/Windows/Fonts/malgunbd.ttf", 22)
W, H, G = 960, 600, 24


def bar(w, t, s, h=118):
    im = Image.new("RGB", (w, h), (17, 17, 17)); d = ImageDraw.Draw(im)
    d.text((32, 14), t, font=fb, fill=(255, 255, 255)); d.text((32, 66), s, font=fr, fill=(185, 185, 190)); return im


def cell(path, label, ref):
    im = Image.open(path).convert("RGB"); im = im.resize((W, int(im.height * W / im.width))).crop((0, 0, W, H))
    c = Image.new("RGB", (W, H + 40), (17, 17, 17)); d = ImageDraw.Draw(c)
    d.text((2, 6), label, font=fs, fill=(249, 104, 89) if ref else (255, 255, 255)); c.paste(im, (0, 40)); return c


sets = [
    ("1-가_흰입력창", "가 흰 입력창 — 참고: ChatGPT · Perplexity · Claude", "제목은 굵게가 아니라 크고 가늘게(48px · 300). 입력 판 하나, 판 안에서 사업 고르기. 물으면 대화처럼 쌓입니다.",
     [(R + "/chatgpt-1440-0.jpg", "참고 · ChatGPT 첫 화면", 1), (S + "/a-1440-1열림.png", "시안 가 · 연 모습", 0), (R + "/perplexity-1440-2typed.jpg", "참고 · Perplexity 입력 판(판 안 갈래 단추)", 1), (S + "/a-1440-3답.png", "시안 가 · 답한 모습", 0)]),
    ("2-나_유리검색", "나 유리 검색 — 참고: apple.com 검색", "홈이 흐려지고 위에서 판이 내려옵니다. 상자 없는 큰 입력 글자(30px · 600), 줄마다 답 첫머리. 답은 판이 늘어나며 나옵니다.",
     [(R + "/apple-kr-1440-1open.jpg", "참고 · apple.com/kr 검색을 연 모습", 1), (S + "/b-1440-2적는중.png", "시안 나 · 적는 동안 맞는 질문", 0), (R + "/apple-kr-1440-2typed.jpg", "참고 · 한국어를 적은 모습", 1), (S + "/b-1440-3답.png", "시안 나 · 답한 모습", 0)]),
    ("3-다_검정무대", "다 검정 무대 — 참고: Fin · Linear, PULSE 캐스팅 복도", "검정 바탕에 명조 300 큰 질문 줄, 아래에 떠 있는 입력 알약(Fin). 명조 300은 유호님이 고르신 캐스팅 복도의 글자입니다.",
     [(R + "/fin-1440-0.jpg", "참고 · fin.ai(세리프 100px · 300, 아래 입력 알약)", 1), (S + "/c-1440-1열림.png", "시안 다 · 연 모습", 0), (R + "/linear-1440-0.jpg", "참고 · Linear(검정 #08090a)", 1), (S + "/c-1440-3답.png", "시안 다 · 답한 모습", 0)]),
]
for name, t, s, cells in sets:
    top = bar(W * 2 + G * 3, t, s); cs = [cell(*c) for c in cells]
    out = Image.new("RGB", (W * 2 + G * 3, top.height + 2 * (H + 40) + G * 3), (17, 17, 17)); out.paste(top, (0, 0))
    for i, c in enumerate(cs): out.paste(c, (G + (i % 2) * (W + G), top.height + G + (i // 2) * (H + 40 + G)))
    out.save(os.path.join(O, name + ".jpg"), quality=86)
ph = [("가 흰 입력창", S + "/a-390-3답.png"), ("나 유리 검색", S + "/b-390-3답.png"), ("다 검정 무대", S + "/c-390-3답.png")]
Wp = 390; top = bar(Wp * 3 + 40 * 4, "휴대폰에서 — 같은 질문의 답", "왼쪽부터 가 · 나 · 다")
out = Image.new("RGB", (Wp * 3 + 40 * 4, top.height + 844 + 80), (17, 17, 17)); out.paste(top, (0, 0)); d = ImageDraw.Draw(out)
for k, (lab, f) in enumerate(ph):
    x = 40 + k * (Wp + 40); d.text((x, top.height + 18), lab, font=fs, fill=(255, 255, 255)); out.paste(Image.open(f).convert("RGB").resize((390, 844)), (x, top.height + 64))
out.save(os.path.join(O, "4-휴대폰_가나다.jpg"), quality=88)
print('ok')
