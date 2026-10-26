# 9번 게임 트레일러 이미지 콘티 배치도(2026-10-26) — GPT 이미지 2.5에 원본 프레임 대신 넣는 그림.
# 원본의 캐릭터 · 사람 · 게임 화면이 옮겨 오지 않게 원본 첫 프레임을 크게 흐려 구도 · 빛 덩어리만 남기고,
# GPT 그림 판(3:2, 1536×1024) 가운데 16:9 띠(1536×864)에 얹는다 — 위아래 80px 회색 띠는 잘라 낼 자리.
# 만족 사례 장부 S31(「매진 임박」 v4 배치도)과 같은 길. 원본 프레임 · 배치도는 git 밖(synk-vendor/…/콘티/p9/)에만 둔다.
#   python -X utf8 이미지콘티_배치도.py [S02 S02_끝 …]   (생략하면 원본첫프레임 전부)
import sys
from pathlib import Path
import numpy as np, cv2

V = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p9")
F = V / "원본첫프레임"
OUT = V / "배치"
W, H, BAND = 1536, 1024, 864
SIGMA = 14  # 1536 폭에서 — 캐릭터는 색 덩어리로만 남고 얼굴 · 무늬 · 글자는 읽히지 않는다


def imread(p):  # cv2.imread는 한글 경로를 못 읽는다
    return cv2.imdecode(np.fromfile(str(p), np.uint8), cv2.IMREAD_COLOR)


def imwrite(p, img):
    ok, buf = cv2.imencode(Path(p).suffix, img, [cv2.IMWRITE_JPEG_QUALITY, 90])
    buf.tofile(str(p))


def layout(name):
    src = imread(F / f"{name}.jpg")
    band = cv2.resize(src, (W, BAND), interpolation=cv2.INTER_AREA)
    band = cv2.GaussianBlur(band, (0, 0), SIGMA)
    canvas = np.full((H, W, 3), 128, np.uint8)
    top = (H - BAND) // 2
    canvas[top:top + BAND] = band
    imwrite(OUT / f"{name}_배치.jpg", canvas)
    return OUT / f"{name}_배치.jpg"


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    names = sys.argv[1:] or sorted(p.stem for p in F.glob("S*.jpg"))
    for n in names:
        print(layout(n))
