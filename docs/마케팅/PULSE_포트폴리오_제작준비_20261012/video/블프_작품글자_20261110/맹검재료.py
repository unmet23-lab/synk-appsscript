# 블프 두 편 글자 시안 맹검 재료(2026-11-10, Claude) — 폰트 정본 §10-4 2: 휴대폰 크기(가로 360px) 낱장 + 실제 놓일 자리.
# 파일 이름은 판을 드러내지 않게 x · y · z 같은 꼬리만(미학맹검.js가 다시 화면01…로 바꿔 보낸다).
#   python -X utf8 맹검재료.py  → git 밖 글자다시_1110/맹검/<묶음>/
import os
from PIL import Image

R = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/글자다시_1110"
M = f"{R}/맹검"
# 판 → 꼬리(맹검에서 판을 숨김). 결과를 읽을 때 이 표로 되돌린다.
TAG = {"now": "x", "A": "y", "B": "z"}


def phone(src, dst, w=360):
    im = Image.open(src).convert("RGB")
    im.resize((w, round(im.height * w / im.width)), Image.LANCZOS).save(dst, quality=92)


def main():
    sets = {
        "세일_카드": [("s3", g, 46) for g in ("now", "A", "B")],
        "세일_끝": [("s3", g, 324) for g in ("now", "A", "B")],
        "세일_벽": [("s3", g, f) for f in (105, 12) for g in ("now", "A")],
        "스나_끝검정": [("s4", g, 782) for g in ("now", "A", "B")],
        "스나_끝장면": [("s4", g, 749) for g in ("now", "A", "B")],
    }
    for name, items in sets.items():
        os.makedirs(f"{M}/{name}", exist_ok=True)
        for piece, g, f in items:
            src = f"{R}/{piece}/{g}_{f:03d}.png"
            w = 360 if piece == "s3" else 720   # 16:9 끝 화면은 휴대폰을 눕혀 볼 때의 폭
            phone(src, f"{M}/{name}/{f:03d}{TAG[g]}.jpg", w)
    # 전단 원고 — 옛 원고(전단판.py) · A · B를 같은 360px 낱장으로
    os.makedirs(f"{M}/전단_원고", exist_ok=True)
    phone("C:/Users/q1212/Documents/synk-vendor/pulse-season4-20261025/콘티/bf-sniper/달력판/전단.png", f"{M}/전단_원고/전단x.jpg")
    phone(f"{R}/전단/전단_A.png", f"{M}/전단_원고/전단y.jpg")
    phone(f"{R}/전단/전단_B.png", f"{M}/전단_원고/전단z.jpg")
    # ② 카드 고친 A(11-10 맹검 1차 뒤 — 5×7 점 숫자 · 굵은 첫 줄 · 왼쪽 당김)
    os.makedirs(f"{M}/세일_카드2", exist_ok=True)
    phone(f"{R}/s3/A_046.png", f"{M}/세일_카드2/046y2.jpg")
    # 전단을 장면에 구운 판(영상 시작 그림) — 전단 둘레를 잘라 720px
    import glob
    B = "C:/Users/q1212/Documents/synk-vendor/pulse-season4-20261025/콘티/bf-sniper/글자1110"
    picks = {"x": f"{B}/refs/S07.jpg", "y": sorted(glob.glob(f"{B}/받음/F07A2_*.jpg"))[-1],
             "z": (sorted(glob.glob(f"{B}/받음/F07B3_*.jpg")) or sorted(glob.glob(f"{B}/받음/F07B2_*.jpg")))[-1]}
    os.makedirs(f"{M}/전단_장면", exist_ok=True)
    for k, src in picks.items():
        im = Image.open(src).convert("RGB")
        im = im.resize((2752, 1536), Image.LANCZOS) if im.size != (2752, 1536) else im
        im.crop((1150, 820, 2150, 1536)).resize((720, 515), Image.LANCZOS).save(f"{M}/전단_장면/장면{k}.jpg", quality=92)
        print("전단_장면", k, os.path.basename(src))
    print(M)


if __name__ == "__main__":
    main()
