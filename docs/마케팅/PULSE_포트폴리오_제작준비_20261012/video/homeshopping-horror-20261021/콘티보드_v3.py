# 「매진 임박」 이미지 콘티 v3.1 보드(2026-10-22, 03_콘티_v3.md): 30칸을 시간 순서로 놓고 칸마다 컷 · 초 · 샷/앵글 · 화면 · 소리 · 대사를 적는다.
# 칸 그림은 가편집(Remotion Film-3)에서 그 컷의 가운데 프레임을 찍은 것이라 그래픽 · 자막 · 크롭이 실제 그대로다.
#   python -X utf8 콘티보드_v3.py [--찍기]   (--찍기: remotion/out/v3보드/<컷>.png를 다시 찍는다 — npx remotion still)
#   → synk-vendor/homeshopping-horror-20261021/콘티/매진임박_이미지콘티_v3.jpg
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
RM = os.path.join(HERE, "remotion")
SHOTS = os.path.join(RM, "out", "v3보드")
V = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "homeshopping-horror-20261021")
FB, FR = "C:/Windows/Fonts/malgunbd.ttf", "C:/Windows/Fonts/malgun.ttf"
# (컷, 시작 초, 끝 초, 샷 · 앵글, 화면, 소리 · 대사) — 홈쇼핑 칸은 컷 이름이 H · E로 시작
CELLS = [
    ("C01a", 0.0, 1.0, "W · 로우", "빈 거실, 0.3초에 칼 그림자가 쓸려 들어옴 · TV 켜짐", "울림 · 심장 박동 · 삐걱"),
    ("C01b", 1.0, 1.6, "ECU 크롭", "칼 그림자 접사", "칼날 스치는 소리"),
    ("C02v3", 1.6, 3.4, "MCU · 로우 15°", "강도(유호님) 등장, 렌즈를 내려다봄", "말 없음"),
    ("C03v3", 3.4, 4.9, "CU · 강도 시점 하이", "리4가 렌즈를 올려다보며 흐느낌", "강도(화면 밖) 「가진 거… 다 내놔.」"),
    ("C04", 4.9, 7.5, "MCU · 고정", "지유, 입 가리고 울며 무언가를 내밂", "지유 「이, 이거… 한정판이에요…」 → 정적"),
    ("H1a", 7.5, 8.5, "MCU · 하이키", "홈쇼핑 1 — 하린 업무용 미소 · 자막 띠", "성준 「방송 끝나면, 이 가격 다시 없습니다!」"),
    ("H1b", 8.5, 9.8, "회전 받침", "꽉 3종 · 9만원대!(99,000원) · 한정 수량", "글자마다 효과음"),
    ("C05v3", 9.8, 11.1, "ECU · 기울기", "강도가 갸웃 — 무엇을 들은 건지 모르는 눈", "정적 0.6초 → 울림"),
    ("C06", 11.1, 12.4, "W 벽", "칼 그림자가 들린다", "강도 「…장난해?」"),
    ("C07v3", 12.4, 15.2, "MCU · 강도 시점 하이", "통2가 렌즈를 올려다보며 손 모아 빎", "통2 「이것도요! 구성 추가… 무이자 십 개월…!」"),
    ("H2a", 15.2, 16.2, "가격판", "홈쇼핑 2 — 99만원대! · 6종 세트 · 무이자 10개월 · 주문 폭주 띠", "성준 「구성 추가! 무이자, 십 개월!…」 · 환호"),
    ("H2b", 16.2, 17.2, "ECU 블렌더", "뚜껑 날개가 「꽉」 · 진공 단추", "「꽉!」"),
    ("H2c", 17.2, 18.2, "MCU", "하린이 렌즈를 가리킴 · 지금 바로 전화!", "환호 도중 하드컷"),
    ("C08", 18.2, 19.5, "ECU · 급줌", "리4 비명, 두 손을 볼에", "정적 → 비명"),
    ("C09v3", 19.5, 21.1, "MCU · 살짝 하이", "강도가 탁자 위를 내려다봄 — 진짜 궁금한 얼굴", "강도 「…이게, 얼만데.」"),
    ("C09b", 21.1, 21.9, "ECU 블렌더", "붉은 빛 속 탁자 위 꽉 용기", "정적"),
    ("H3a", 21.9, 23.3, "가격판", "홈쇼핑 3 — 평생 세트 990만원대! · 무이자 360개월 · 월 27,500원", "혜수 「오늘 단 하루!」"),
    ("H3b", 23.3, 24.2, "가격판 · 쾅", "도장 「특별 할인」", "도장 쾅 · 성준 「특별 할인!」"),
    ("H3c", 24.2, 25.9, "회전 받침", "뚜껑만 1개 · 9천원대!(9,900원) · ※ 본체 별매", "혜수 「뚜껑만! 구천구백 원!」"),
    ("H3d", 25.9, 26.5, "MCU", "하린 굳은 미소 · 엄지", "말 없이 환호만"),
    ("C10", 26.5, 28.3, "W 벽", "칼 그림자가 내려간다", "정적 · 「탁」"),
    ("C11b", 28.3, 28.9, "ECU", "장갑 낀 엄지가 번호를 누름", "누름 · 연결음"),
    ("C11", 28.9, 31.2, "MCU", "전환점 — 강도가 폰 빛 받은 얼굴로 공손하게", "강도 「…네. 방송 보고 전화했는데요.」"),
    ("C12", 31.2, 31.8, "MCU", "통2 멍", "ARS 「주문 수량을…」"),
    ("C12b", 31.8, 32.4, "MCU", "리4 멍", "「…말씀해 주세요.」"),
    ("C13", 32.4, 33.0, "MCU 크롭", "지유 멍", "(전화 소리)"),
    ("C14", 33.0, 34.3, "CU", "강도, 폰을 귀에 댄 채 무표정", "강도 「…두 개요.」"),
    ("E1", 34.3, 35.2, "방송 화면", "주문 1,247 → 1,249(+2) · 주문 완료", "도장 쾅 · 환호"),
    ("E2", 35.2, 37.6, "MCU · 렌즈 직시", "하린이 렌즈(= 강도)를 보며 인사", "혜수 「후드 쓰신 고객님~ 주문 감사합니다!」"),
    ("E3", 37.6, 39.2, "W · 로우(첫 컷 구도)", "택배 상자 그림자 · TV에 주문 완료 · PULSE", "「딩동」"),
]
TW, TH, CAP, COLS, GAP = 480, 270, 132, 6, 12


def shoot():
    os.makedirs(SHOTS, exist_ok=True)
    for cid, a, b, *_ in CELLS:
        fr = round((a + b) / 2 * 24)
        out = os.path.join(SHOTS, f"{cid}.png")
        subprocess.run(["npx", "remotion", "still", "src/index.ts", "Film-3", out, f"--frame={fr}", "--log=error"], cwd=RM, check=True, shell=True)
        print("찍음", cid, fr)


def wrap(d, text, font, width, n):
    lines, cur = [], ""
    for ch in text.split(" "):
        t = (cur + " " + ch).strip()
        if d.textlength(t, font=font) > width and cur:
            lines.append(cur)
            cur = ch
        else:
            cur = t
    lines.append(cur)
    return lines[:n]


def main():
    if "--찍기" in sys.argv:
        shoot()
    rows = (len(CELLS) + COLS - 1) // COLS
    W = COLS * (TW + GAP) + GAP
    board = Image.new("RGB", (W, 150 + rows * (TH + CAP + GAP) + 10), (18, 18, 20))
    d = ImageDraw.Draw(board)
    d.text((GAP + 4, 18), "「매진 임박」 공포 코미디 × 홈쇼핑 — 이미지 콘티 v3.1(39.2초 · 16:9 · 30컷 · 반응 조사 반영 · 영상 생성 전)", font=ImageFont.truetype(FB, 34), fill=(240, 240, 240))
    d.text((GAP + 4, 68), "바뀐 것: 쇼호스트 하린(미소를 안 푼다) · 값은 「9만원대 → 99만원대 → 990만원대 → 9천원대」 · 무이자 360개월 · 뚜껑만 1개 · 강도 시점 하이로 피해자 · 번호 누름 → 통화 → ARS → 「…두 개요」 · 쇼호스트가 강도에게 말 걸기 · 첫 컷으로 돌아오는 고리",
           font=ImageFont.truetype(FR, 21), fill=(170, 170, 170))
    d.text((GAP + 4, 102), "지킨 것: 세 번 끼어들기 · 값 무너짐 · 「방송 보고 전화했는데요」 · 주문 완료 · 배역(강도 유호님 · 통2 · 리4 · 지유) · 한 화면 한 사람 · 칼은 그림자로만 · 가상 브랜드 · 제품은 블렌더",
           font=ImageFont.truetype(FR, 21), fill=(170, 170, 170))
    fb, fr = ImageFont.truetype(FB, 21), ImageFont.truetype(FR, 19)
    for k, (cid, a, b, shot, what, sound) in enumerate(CELLS):
        x = GAP + (k % COLS) * (TW + GAP)
        y = 150 + (k // COLS) * (TH + CAP + GAP)
        p = os.path.join(SHOTS, f"{cid}.png")
        if os.path.exists(p):
            board.paste(Image.open(p).convert("RGB").resize((TW, TH), Image.LANCZOS), (x, y))
        hs = cid[0] in "HE" and cid != "E3"
        d.rectangle([x, y + TH, x + TW, y + TH + CAP], fill=(52, 30, 8) if hs else (34, 20, 22))
        d.text((x + 10, y + TH + 8), f"{cid} · {a:.1f}–{b:.1f}초 · {shot}", font=fb, fill=(255, 214, 90) if hs else (240, 120, 120))
        for j, line in enumerate(wrap(d, what, fr, TW - 20, 2)):
            d.text((x + 10, y + TH + 38 + j * 23), line, font=fr, fill=(235, 235, 235))
        for j, line in enumerate(wrap(d, sound, fr, TW - 20, 2)):
            d.text((x + 10, y + TH + 86 + j * 22), line, font=fr, fill=(160, 160, 160))
    out = os.path.join(V, "콘티", "매진임박_이미지콘티_v3.jpg")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    board.save(out, quality=90)
    print(out, board.size)


if __name__ == "__main__":
    main()
