# 5번 새 기획(11-05) 이미지 콘티의 배치도 — 뼈대 원본 A(Jona Daniel Columbia 본편)의 컷 첫 프레임에서 구도만 남긴다.
# 원본 신발의 디자인(밑창 무늬 · 니트 결 · 색 · 상표)이 옮겨 오지 않게 신발은 rembg로 잡아 어두운 실루엣으로, 나머지는 밝기만 남긴
# 회색으로 크게 흐린다. 매크로처럼 신발이 화면 대부분을 채운 컷은 실루엣 대신 흐린 밝기 결만 남긴다(빛 방향 · 가장자리 자리만).
#   python -X utf8 새기획_배치도.py        → 콘티/p5n/원본첫프레임/<컷>.png · 배치/<컷>.png(1152×2048) · 배치/_확인/<컷>.jpg
# 원본 프레임 · 배치도는 git 밖(synk-vendor/pulse-portfolio12-20261024/콘티/p5n/)에만 둔다.
from pathlib import Path
import numpy as np, cv2
from PIL import Image

V = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024")
SRC = V / "레퍼런스/p5_새기획_20261105/원본영상/hq_3NUYEl-8j5Q/hq_3NUYEl-8j5Q_h264.mp4"
F, OUT = V / "콘티/p5n/원본첫프레임", V / "콘티/p5n/배치"
W, H = 1152, 2048
# 우리 컷 번호: (원본 시각 초 — 컷 시작 + 0.1, 원본 컷 번호). 원본 3(글자) · 12(둘째 신발) · 14(끝 글)은 쓰지 않는다.
CUTS = {"N01": 22.40, "N02": 24.03, "N03": 26.47, "N04": 26.87, "N05": 27.27, "N06": 28.03,
        "N07": 29.53, "N08": 30.50, "N09": 32.30, "N10": 33.47, "N11": 37.73, "N11b": 39.80}
# 실루엣으로 둘 컷(rembg가 신발 · 발을 바로 잡는 컷). 나머지 매크로 컷은 rembg가 엉뚱한 것(상표 글자 등)을 잡아 흐림만 쓴다.
SIL = {"N01", "N02", "N04", "N05", "N06"}
from rembg import remove, new_session
sess = new_session("isnet-general-use")
cap = cv2.VideoCapture(str(SRC)); fps = cap.get(cv2.CAP_PROP_FPS)
(OUT / "_확인").mkdir(parents=True, exist_ok=True); F.mkdir(parents=True, exist_ok=True)
for name, t in CUTS.items():
    cap.set(cv2.CAP_PROP_POS_FRAMES, int(round(t * fps))); ok, fr = cap.read()
    rgb = cv2.cvtColor(fr, cv2.COLOR_BGR2RGB)
    rgb = cv2.resize(rgb, (W, H), interpolation=cv2.INTER_AREA)
    Image.fromarray(rgb).save(F / f"{name}.png")
    lum = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
    bg = cv2.GaussianBlur(lum, (0, 0), 38)
    m = np.array(remove(Image.fromarray(rgb), session=sess, only_mask=True)).astype(np.float32) / 255.0
    m = cv2.GaussianBlur(m, (0, 0), 6)
    share = float((m > 0.5).mean())
    if name in SIL:   # 신발이 화면 일부(떠 있는 신발 · 딛는 발) — 어두운 실루엣
        out = bg * (1 - m) + 18 * m
    else:             # 매크로 — 흐린 밝기 결만(니트 결 · 밑창 무늬 · 상표가 비치지 않게 세게)
        out = cv2.GaussianBlur(lum, (0, 0), 48)
    out = np.clip(out, 0, 255).astype(np.uint8)
    Image.fromarray(out).convert("RGB").save(OUT / f"{name}.png")
    chk = (rgb.astype(np.float32) * 0.45 + np.dstack([out] * 3) * 0.55).astype(np.uint8)
    Image.fromarray(chk).resize((W // 3, H // 3)).save(OUT / "_확인" / f"{name}.jpg", quality=85)
    print(name, f"{t:.2f}s", f"신발 {share*100:.0f}%", "실루엣" if name in SIL else "흐림만")
