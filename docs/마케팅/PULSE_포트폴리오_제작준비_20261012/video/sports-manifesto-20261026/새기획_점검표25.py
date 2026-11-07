# 5번 새 기획 · 11-07 슬롭 점검표 25번 고침(05_콘티_15초 10 · 11절) — 신발 숨(N08s) · 바닥 연기(N11 · N11e) 대신 실제 물리 판으로 가편집을 다시 잇기 전 준비.
#   ① 옛 가편집 · 끝 로고 판을 가편집/_1107전/ · 정지컷_916/_1107전/에 남기고
#   ② 새 정지컷 넷(N08b 역광 니트 · N08h 채원 숨 · N11n · N11en — 지시문_새기획/굽기_1107.sh)을 정지컷맞춤.py와 같은 방법으로 1080×1920에 채워 자른다.
# 그 뒤: python -X utf8 새기획_끝타이포.py 정지 → 새기획_콘티가편집.py → 새기획_끝타이포.py 영상 E → 새기획_끝타이포.py 영상6 E
#   python -X utf8 새기획_점검표25.py
import shutil
from pathlib import Path
import numpy as np, cv2
from PIL import Image

V = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p5n")
W, H = 1080, 1920
NEW = ("N02n", "N08b", "N08h", "N11n", "N11en")   # N02n은 Fable 확인(11-07)이 짚은 밑창 밑 연기 구름을 뺀 판


def cover(img, cx=0.5):
    h, w = img.shape[:2]
    s = max(W / w, H / h)
    img = cv2.resize(img, (int(w * s + 0.5), int(h * s + 0.5)), interpolation=cv2.INTER_LANCZOS4)
    x = int(round((img.shape[1] - W) * cx)); y = (img.shape[0] - H) // 2
    return img[y:y + H, x:x + W]


for d, names in ((V / "가편집", ("p5n_콘티가편집_15초.mp4", "p5n_콘티가편집_6초.mp4", "p5n_끝타이포_E_글자만.mp4", "p5n_끝타이포_E_글자만_6초.mp4")),
                 (V / "정지컷_916", ("N11_로고.png",))):
    keep = d / "_1107전"; keep.mkdir(exist_ok=True)
    for n in names:
        if (d / n).exists() and not (keep / n).exists():
            shutil.copy2(d / n, keep / n); print("남김", keep / n)
for n in NEW:
    a = np.asarray(Image.open(V / "정지컷" / f"{n}.png").convert("RGB"))
    Image.fromarray(cover(a)).save(V / "정지컷_916" / f"{n}.png"); print("맞춤", n, a.shape[1], "x", a.shape[0])
