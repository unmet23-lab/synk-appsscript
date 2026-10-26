# 블프 세일 이미지 콘티 — 고른 판을 정지컷(1080×1920)으로 옮긴다(2026-10-26). 고른 까닭과 자르기는 표에 함께 적는다.
#   python -X utf8 이미지콘티_정지컷.py → git 밖 콘티/bf-sale/정지컷/<컷>.png (그 뒤 이미지콘티_합성.py · 콘티_가편집.py · 콘티보드.py)
# 자르기는 원본 첫 프레임의 얼굴 크기 · 자리에 맞춘다(YuNet 얼굴 폭 비율). Gemini 판이 1536×2752라 1080 폭 근처로 잘라도 거의 원래 해상도다.
# 색 · 얼굴 손질은 하지 않는다(만족 사례 장부 — 후보정 최대한 안 함). 자리만 옮긴다.
import os
from PIL import Image

B = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "pulse-season4-20261025", "콘티", "bf-sale")
W, H = 1080, 1920
NAVY = (27, 20, 70)

# 컷: (고른 판, 자르기 (x0, y0, x1, y1) 또는 None, 아래로 내리기 px(1080×1920 기준), 까닭)
PICK = {
    "R1":  ("받음/R1_190245.jpg", None, 0, "빈 스튜디오 기준 그림(1차 한 판)"),
    "C01": ("받음/C01_203313.jpg", (92, 0, 1416, 2354), 0, "닮음 0.545 · 얼굴 폭 0.083 → 원본 0.096에 맞춰 1.16배"),
    "C03": ("gpt/판/C03d_212458.png", None, 0, "GPT 4판째 — 1판은 방 · 화면이 보이고, 2판(C03b)은 바퀴가 없고(Fable P2), 3판(C03c)은 바퀴가 화면 반을 채웠다. 원본처럼 왼쪽 위 가장자리 바퀴 조각 · 빛줄 · 빛 고리 · 먼 두루마리"),
    "C04": ("받음/C04d_222553.jpg", (215, 0, 1536, 2367), 0, "4판째 0.47 · 1.16배로 잘라 얼굴 x 0.36(원본 0.37 — Fable 2차) — 1판 0.312 · C04b 0.334는 얼굴이 길고 오른쪽 · 작아 Fable P1. C04b를 1.43배 키워 얼굴을 왼쪽 1/3에 둔 머리 흐린 구도 참고로(C04c는 그림 안 나옴). 헤드셋은 참고를 따라 오른쪽 귀"),
    "C06": ("받음/C06_203639.jpg", (229, 341, 1304, 2252), 0, "닮음 0.464 · 얼굴 폭 0.054 → 원본 0.077에 맞춰 1.43배, 두루마리는 아래 1/5에 남음"),
    "C07": ("gpt/판/C07_192526_2.png", None, 0, "GPT 두 판 가운데 사람이 크고 빛 문이 바로 뒤에 있는 쪽(원본 ⑦)"),
    "C08": ("받음/C08c_005449.jpg", None, 0, "5차 a 줄 두 판 가운데 원본 크기(머리 0.32 · 바닥 0.83, 원본 0.30 · 0.80) — 옆얼굴 0.35(Fable 4차: 옆 정본 0.48 · ⑫와 0.62로 같은 사람). 1판 C08_191753은 1.8배(Fable P1), C08b는 1.3배. 채원 자리는 원본보다 조금 오른쪽"),
    "C10": ("받음/C10b_202939.jpg", None, 0, "머리 흐린 구도 참고 판 0.474(1판 0.371). 네온 공간 배경으로 다시 구운 C10c는 0.087 · 배경 그대로라 버림"),
    "C12": ("받음/C12_204006.jpg", None, 0, "닮음 0.464 · 뒤 상자 · 앞 핸들 흐림"),
    "C13": ("받음/C13_204414.jpg", None, 522, "닮음 0.571 — 얼굴(높이 0.35)이 끝 카드(위 0.43)에 가려져 원본 남자 손님 자리(0.62)로 내림"),
}


def fit(im):
    r = im.width / im.height
    if abs(r - W / H) > 0.002:
        if r > W / H:
            nw = int(im.height * W / H); im = im.crop(((im.width - nw) // 2, 0, (im.width - nw) // 2 + nw, im.height))
        else:
            nh = int(im.width * H / W); im = im.crop((0, (im.height - nh) // 2, im.width, (im.height - nh) // 2 + nh))
    return im.resize((W, H), Image.LANCZOS)


for cut, (src, box, down, why) in PICK.items():
    im = Image.open(os.path.join(B, src)).convert("RGB")
    if box:
        im = im.crop(box)
    im = fit(im)
    if down:
        c = Image.new("RGB", (W, H), NAVY)
        c.paste(im, (0, down))
        im = c
    im.save(os.path.join(B, "정지컷", cut + ".png"))
    print(cut, "←", src, box or "", f"↓{down}" if down else "", "·", why)
