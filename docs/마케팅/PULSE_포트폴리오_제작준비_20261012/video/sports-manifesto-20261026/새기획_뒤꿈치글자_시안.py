# 5번 새 기획(11-05 밤) 뒤꿈치 프린트를 끝 로고와 같은 글자로 — 글자를 지운 판 N10p에 불투명 회색 열전사로 찍는다(곱하기 합성은 니트 구멍에 끊겨 「SAPPEUM」처럼 읽혔다).
# 최종은 N10_본판(곧은 기하 대문자, 새기획_워드마크.py classic)이고, 정지컷_916/N10.png로 복사한다. 설계도 D00의 뒤꿈치 글자도 같은 글자로 바꾼다(모델에 넣는 참고 그림이라).
#   python -X utf8 새기획_뒤꿈치글자_시안.py   → 콘티/p5n/정지컷_916/N10_{소문자,대문자,본판}.png · N10.png · 정지컷/D00_신발설계도.png
import sys
from pathlib import Path
import numpy as np, cv2
from PIL import Image
from shapely.ops import unary_union
sys.path.insert(0, str(Path(__file__).resolve().parent))
import 새기획_워드마크 as WM

P = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p5n/정지컷_916")
base = np.asarray(Image.open(P / "N10p.png").convert("RGB")).astype(np.float32)
H, W = base.shape[:2]
TINT = np.array((0.50, 0.52, 0.56), np.float32)


def stamp(geom, width, cx, cy, rot, name):
    x0, y0, x1, y1 = geom.bounds; sx = width * W / (x1 - x0)
    ox = cx * W - (x0 + x1) / 2 * sx; oy = cy * H + (y0 + y1) / 2 * sx
    m = WM.raster(geom, W, H, sx, ox, oy).astype(np.float32) / 255
    M = cv2.getRotationMatrix2D((cx * W, cy * H), rot, 1.0); M[1] *= 0.94; M[1, 2] += cy * H * 0.06
    m = cv2.GaussianBlur(cv2.warpAffine(m, M, (W, H), flags=cv2.INTER_LINEAR), (0, 0), 0.6)
    lum = base.mean(2); low = cv2.GaussianBlur(lum, (0, 0), 7); relief = (lum - low) * 0.18
    ink = low[..., None] * TINT[None, None, :] + relief[..., None]
    a = 0.95 * m[..., None]
    out = np.clip(base * (1 - a) + ink * a, 0, 255).astype(np.uint8)
    Image.fromarray(out).save(P / f"N10_{name}.png"); return out


lo = WM.lower(); low_g = unary_union([b.difference(unary_union([WM.circle(*c) for c in hs])) if hs else b for _, b, hs in lo])
a = stamp(low_g, 0.38, 0.715, 0.505, 7, "소문자")
b = stamp(unary_union(WM.upper(s=19.0, h=120.0)), 0.33, 0.715, 0.505, 7, "대문자")
# 본판: 끝 로고와 같은 곧은 기하 대문자. 작게 찍히니 줄기를 조금 굵게(13.5 → 16.5)
d = stamp(WM.solid(WM.classic(v=16.5, track=17.0)), 0.36, 0.70, 0.505, 7, "본판")
c = np.hstack([cv2.resize(a, (540, 960)), cv2.resize(b, (540, 960)), cv2.resize(d, (540, 960))])
Image.fromarray(c).save(P.parent / "로고시안/뒤꿈치_시안.jpg", quality=92)
print("ok", W, H)

# 최종을 콘티 칸에 넣는다
Image.fromarray(d).save(P / "N10.png")
# 설계도 D00: 한글 자리(1672×941 판의 x 1186~1231 · y 523~551)를 바로 왼쪽 니트로 메우고 같은 글자를 작게 찍는다. 한글판은 정지컷/_한글판_20261105/
src = P.parent / "정지컷/_한글판_20261105/D00_신발설계도.png"
dz = np.asarray(Image.open(src).convert("RGB")).copy(); x0, y0, x1, y1 = 1186, 523, 1231, 551; sh = 46
fill = dz.copy(); fill[y0 - 6:y1 + 6, x0 - 6:x1 + 6] = dz[y0 - 6:y1 + 6, x0 - 6 - sh:x1 + 6 - sh]
hole = np.zeros(dz.shape[:2], np.float32); hole[y0:y1, x0:x1] = 1; hole = cv2.GaussianBlur(hole, (0, 0), 2.5)[..., None]
dz = (dz * (1 - hole) + fill * hole).astype(np.float32)
g = WM.solid(WM.classic(v=18.0, track=18.0)); bx = g.bounds; sx = 62.0 / (bx[2] - bx[0])
m = cv2.GaussianBlur(WM.raster(g, dz.shape[1], dz.shape[0], sx, 1197 - (bx[0] + bx[2]) / 2 * sx, 537 + 50 * sx).astype(np.float32) / 255, (0, 0), 0.4)[..., None]
lw = cv2.GaussianBlur(dz.mean(2), (0, 0), 4)[..., None]
Image.fromarray(np.clip(dz * (1 - 0.95 * m) + lw * TINT[None, None, :] * 0.95 * m, 0, 255).astype(np.uint8)).save(P.parent / "정지컷/D00_신발설계도.png")
print("D00 · N10 최종")
