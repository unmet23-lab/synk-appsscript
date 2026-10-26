# 12번 이미지 콘티 배치도(2026-10-26) — Gemini에 원본 프레임 대신 넣는 그림. 8번 이미지콘티_배치도.py · 장부 S31과 같은 방식:
# 원본 사람의 얼굴 · 몸 · 옷과 원본 장소(이집트 휴양지)가 옮겨 오지 않게 사람은 실루엣, 장소는 밝은 회색 바탕만 둔다.
# 「그 사람」(우리 판의 유호님)은 검정(18), 동행 · 둘레 사람은 진회색(95)으로 가른다 — 지시문이 어느 실루엣이 그 사람인지 말한다.
# 기준 프레임은 컷 첫 프레임이 아니라 그 사람이 이쪽을 보는 순간(원본은 카메라가 돌아야 그가 보여서) — 콘티/p12/원본대표프레임/C??.png.
#   python -X utf8 이미지콘티_배치도.py [컷 번호…]  → 배치/C01.png …(1080×1920) · 배치/_확인/C01.jpg(원본 위에 실루엣을 겹친 확인판)
import sys
from pathlib import Path
import numpy as np, cv2
from PIL import Image

P = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p12")
F = P / "원본대표프레임"
OUT = P / "배치"
BG, HIM, OTHER = 205, 18, 95

# 컷마다 사람 덩어리 가운데 「그 사람」을 고르는 점(그 사람 몸 위의 한 점, 1080×1920 기준) — 10-26 대표 프레임을 보고 정함.
HIM_PT = {1: (300, 900), 2: (620, 1060), 3: (590, 830), 4: (760, 700), 5: (500, 950), 6: (520, 1000), 7: (560, 1050), 8: (720, 900), 9: (720, 820), 16: (790, 900)}
# 사람 분할이 붙여 버린 곳 가르기(10-26 격자로 잼): OTHER_POLY 안은 다른 사람, DROP 상자는 사람이 아님(헬멧), HIM_ADD는 분할이 놓친 그 사람(작은 수영장 컷)
OTHER_POLY = {
    1: [[(760, 430), (1080, 430), (1080, 1920), (860, 1920), (840, 1250), (790, 900)]],                 # 옆 좌석 여자
    9: [[(0, 1330), (300, 1260), (520, 1330), (560, 1920), (0, 1920)]],                                   # 모래 놀이 하는 아이
    16: [[(0, 720), (330, 700), (520, 860), (640, 1080), (700, 1300), (720, 1920), (0, 1920)]],          # 맞은편 동행
}
DROP = {7: [(200, 1100, 740, 1380)]}                                                                     # ATV 앞 헬멧 둘
HIM_ADD = {3: {"poly": [[(600, 740), (990, 800), (990, 900), (620, 900)]], "ell": [(780, 765, 48, 48)]}}  # 튜브를 낀 남자


def segment(img):
    from rembg import remove, new_session
    global _SESS
    try:
        _SESS
    except NameError:
        _SESS = new_session("u2net_human_seg")
    rgba = remove(Image.fromarray(img), session=_SESS)
    return (np.array(rgba)[:, :, 3] > 128).astype(np.uint8)


def build(n):
    src = F / f"C{n:02d}.png"
    img = np.array(Image.open(src).convert("RGB"))
    h, w = img.shape[:2]
    m = segment(img)
    k, lab = cv2.connectedComponents(m)
    him = np.zeros_like(m)
    x, y = HIM_PT[n]
    hid = lab[min(y, h - 1), min(x, w - 1)]
    if hid == 0:  # 점이 덩어리 밖이면 가장 가까운 덩어리
        ys, xs = np.nonzero(m)
        i = int(np.argmin((xs - x) ** 2 + (ys - y) ** 2))
        hid = lab[ys[i], xs[i]]
    him[lab == hid] = 1
    for x0, y0, x1, y1 in DROP.get(n, []):
        m[y0:y1, x0:x1] = 0
        him[y0:y1, x0:x1] = 0
    for poly in OTHER_POLY.get(n, []):
        pm = np.zeros_like(m)
        cv2.fillPoly(pm, [np.array(poly, np.int32)], 1)
        him[pm == 1] = 0
    add = HIM_ADD.get(n, {})
    for poly in add.get("poly", []):
        cv2.fillPoly(him, [np.array(poly, np.int32)], 1)
    for cx, cy, rx, ry in add.get("ell", []):
        cv2.ellipse(him, (cx, cy), (rx, ry), 0, 0, 360, 1, -1)
    m = np.maximum(m, him)
    other = (m == 1) & (him == 0)
    out = np.full((h, w), BG, np.uint8)
    out[other] = OTHER
    out[him == 1] = HIM
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "_확인").mkdir(exist_ok=True)
    Image.fromarray(out).convert("RGB").save(OUT / f"C{n:02d}.png")
    chk = img.copy()
    chk[him == 1] = (chk[him == 1] * 0.3 + np.array([255, 40, 40]) * 0.7).astype(np.uint8)
    chk[other] = (chk[other] * 0.4 + np.array([60, 120, 255]) * 0.6).astype(np.uint8)
    Image.fromarray(chk).resize((w // 3, h // 3)).save(OUT / "_확인" / f"C{n:02d}.jpg", quality=85)
    print(n, "그 사람", int(him.sum()), "px · 다른 사람", int(other.sum()), "px")


if __name__ == "__main__":
    ns = [int(a) for a in sys.argv[1:]] or sorted(HIM_PT)
    for n in ns:
        build(n)
