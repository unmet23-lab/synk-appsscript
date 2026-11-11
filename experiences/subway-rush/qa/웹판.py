"""환승 러시 그림 웹판(2026-11-04): 구운 판(공용 작업본 .tmp/subway-rush-20261104/판)의 가장 새 것을 assets/world/<이름>.webp로, 깊이 지도도 함께.
문 열린 판은 닫힌 판의 깊이 지도를 같이 쓴다(같은 구도). 반응 판 · 평면 판은 깊이가 필요 없다. 다 돌리면 assets.json에 있는 판 목록을 쓴다 — 게임은 이 목록으로 칸 · 사람을 고른다.
  python -I -X utf8 experiences/subway-rush/qa/웹판.py
"""
import json
import re
import sys
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageFilter

GAME = Path(__file__).resolve().parents[1]
ROOT = Path.home() / 'Documents' / 'SYNK-appsscript' / '.tmp' / 'subway-rush-20261104' / '판'
OUT = GAME / 'assets' / 'world'
OUT.mkdir(parents=True, exist_ok=True)
MODEL = Path.home() / 'Documents' / 'synk-vendor' / 'depth' / 'onnx' / 'model.onnx'
MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)

# 게임 이름 ← 판 이름. 깊이가 필요한 판만 depth True.
TABLE = {
    'gate': ('gate', True), 'platform': ('platform', True), 'platform-1': ('platform-1', True),
    'car-calm': ('train', True), 'car-calm-right': ('train-open', False), 'car-calm-left': ('train-open-left', False),
    'car-rush': ('car-rush', True), 'car-rush-right': ('car-rush-open-right', False), 'car-rush-left': ('car-rush-open-left', False),
    'car-concert': ('car-concert', True), 'car-concert-right': ('car-concert-open-right', False), 'car-concert-left': ('car-concert-open-left', False),
    'car-hike': ('car-hike', True), 'car-hike-right': ('car-hike-open-right', False), 'car-hike-left': ('car-hike-open-left', False),
    'fork': ('fork', True), 'exit-fork': ('exit-fork', True), 'detour': ('detour', True), 'gate-out': ('gate-out', True), 'stairs-sun': ('stairs-sun', True), 'bus-stop': ('bus-stop', False),
    'person-fan': ('person-fan', True), 'person-fan-react': ('person-fan-react', False), 'person-worker': ('person-worker', True), 'person-worker-react': ('person-worker-react', False),
    'person-traveler': ('person-traveler', True), 'person-traveler-react': ('person-traveler-react', False), 'person-grandma': ('person-grandma', True), 'person-grandma-react': ('person-grandma-react', False),
    'person-hiker': ('person-hiker', True), 'person-hiker-react': ('person-hiker-react', False), 'person-freshman': ('person-freshman', True), 'person-freshman-react': ('person-freshman-react', False),
}


# 깊이 경계가 가파른 판(매단 표지 · 가는 기둥 · 앞사람) — depth_map(soft=True)
SOFT_DEPTH = {'fork', 'exit-fork', 'car-calm', 'car-rush', 'car-concert', 'car-hike'}


def newest(name):
    # 판 이름의 시각은 시분초뿐이라 자정을 넘겨 구운 판이 이름순으로 밀린다(현장 노트 그림 굽기 「자정을 넘겨」) — 파일 수정 시각으로 고른다.
    files = sorted((f for f in ROOT.iterdir() if re.fullmatch(re.escape(name) + r'_\d{6}(_\d)?\.png', f.name)), key=lambda f: f.stat().st_mtime)
    return files[-1] if files else None


def fit23(img):
    """게임은 2:3 판을 전제한다. 가끔 3:4로 구워지면 가운데를 2:3으로 잘라 1024×1536에 맞춘다."""
    w, h = img.size
    if abs(w / h - 2 / 3) < 0.005:
        return img
    if w / h > 2 / 3:
        cw = round(h * 2 / 3)
        img = img.crop(((w - cw) // 2, 0, (w - cw) // 2 + cw, h))
    else:
        ch = round(w * 3 / 2)
        img = img.crop((0, (h - ch) // 2, w, (h - ch) // 2 + ch))
    return img.resize((1024, 1536), Image.LANCZOS)


def fit_plate(img):
    """9:16로 구운 판(11-11 나노바나나 — 칸 · 통로 · 출구)은 그 비율 그대로 1024×1820으로 둔다(셰이더가 판마다 제 비율을 쓴다 — 2:3로 자르면 폰 화면 위아래를 거울로 이어 그린다). 그 밖은 2:3."""
    w, h = img.size
    if abs(w / h - 9 / 16) < 0.01:
        return img.resize((1024, round(1024 * h / w)), Image.LANCZOS)
    return fit23(img)


# 사진 속 표지 칸(그림 좌표 x0, y0, x1, y1): 깊이를 둘레 배경과 같게 편다 — 표지가 배경과 함께 다가와 테두리가 휘지 않는다
# (11-11 맹검 「간판 테두리가 녹은 플라스틱처럼 울퉁불퉁」 · 「노선 배지 · 한글 획 가장자리 일그러짐」 — 고르는 순간 카메라가 다가가며 가까운 표지와 먼 천장을 다르게 밀었다)
# 칸은 간판 · 매단 막대에 꼭 맞게 잡는다(넓게 잡으면 천장 기울기가 끊겨 그 둘레가 휜다). 11-11 판(9:16)을 잰 값.
SIGN_FLAT = {
    'exit-fork': [(0.235, 0.228, 0.78, 0.305), (0.32, 0.02, 0.35, 0.235), (0.655, 0.02, 0.685, 0.235)],
    'fork': [(0.04, 0.372, 0.965, 0.437)],
}


def flatten_signs(dep, boxes):
    """깊이 지도(L, 절반 크기)의 표지 칸을 둘레 깊이로 메운다(cv2.inpaint) — 칸 둘레와 이어져 기울기가 끊기지 않는다."""
    import cv2
    d = np.asarray(dep, dtype=np.uint8).copy()
    h, w = d.shape
    mask = np.zeros_like(d)
    for x0, y0, x1, y1 in boxes:
        mask[int(y0 * h):int(y1 * h) + 1, int(x0 * w):int(x1 * w) + 1] = 255
    mask = cv2.dilate(mask, np.ones((5, 5), np.uint8))
    return Image.fromarray(cv2.inpaint(d, mask, 9, cv2.INPAINT_TELEA), 'L')


def depth_map(session, img, soft=False):
    w, h = img.size
    scale = 518 / min(w, h)
    tw, th = (max(14, round(w * scale / 14) * 14), max(14, round(h * scale / 14) * 14))
    x = (np.asarray(img.resize((tw, th), Image.BICUBIC), dtype=np.float32) / 255 - MEAN) / STD
    d = session.run(None, {session.get_inputs()[0].name: x.transpose(2, 0, 1)[None]})[0].reshape(th, tw)
    lo, hi = np.percentile(d, 1), np.percentile(d, 99.5)
    d = np.clip((d - lo) / max(1e-6, hi - lo), 0, 1)
    out = Image.fromarray((d * 255).astype(np.uint8), 'L').resize((w // 2, h // 2), Image.BICUBIC)
    # soft: 매단 표지 · 가는 막대처럼 깊이가 갑자기 바뀌는 판은 다가갈 때 경계 화소가 톱니로 찢어졌다(11-11 출구 맹검) — 더 흐려 늘어남으로 바꾼다
    return out.filter(ImageFilter.GaussianBlur(radius=max(6, w // 160) if soft else max(1, w // 800)))


def main():
    session = ort.InferenceSession(str(MODEL), providers=['CPUExecutionProvider'])
    have = {}
    for name, (src, want_depth) in TABLE.items():
        f = newest(src)
        if not f:
            continue
        dest = OUT / f'{name}.webp'
        img = fit_plate(Image.open(f).convert('RGB'))
        if not dest.exists() or dest.stat().st_mtime < f.stat().st_mtime:
            img.save(dest, quality=84, method=6)
        if want_depth:
            dp = OUT / f'{name}.depth.png'
            if not dp.exists() or dp.stat().st_mtime < f.stat().st_mtime:
                dm = depth_map(session, img, soft=name in SOFT_DEPTH)
                (flatten_signs(dm, SIGN_FLAT[name]) if name in SIGN_FLAT else dm).save(dp, optimize=True)
        have[name] = True
    (GAME / 'assets' / 'assets.json').write_text(json.dumps(sorted(have), ensure_ascii=False) + '\n', encoding='utf-8')
    print(len(have), '장', sum(p.stat().st_size for p in OUT.iterdir()) // 1024 // 1024, 'MB')


if __name__ == '__main__':
    sys.exit(main())
