"""라디오 DJ 부스 그림을 다듬는다 (2026-09-08 · 0원).

■ 왜 있나
  부스 그림(docs/Loom_자산/라디오소품/부스.webp)의 왼쪽에 **흰 종이 잔재**가 남아 있었다.
  부스를 「장면」 규격(종이 위 정물)으로 구워서 받침 종이가 같이 나왔고, 받침을 «행 폭»으로 잘라 냈지만
  왼쪽 아래 구석의 종이 보풀은 몸통과 이어져 있지 않아 그대로 남았다. 화면에서는 그것이 부스 옆에
  «삐져나온 것»으로 보였다(유호 지적 09-08 「부스 옆에 뭐가 삐져나와있어」).

■ 무엇을 하나
  ① 남색 몸통(어둡고 파란 기운)을 찾아 가장 큰 덩이 하나만 남긴다 — 구멍(단추·자·노란 창)은 채운다.
  ② 그 덩이를 몇 칸 부풀려 가장자리 펠트 보풀은 살리고, 그 밖은 전부 투명으로 한다.
  ③ 남은 것의 네모로 잘라 캔버스를 몸통에 딱 맞춘다 — 그래야 CSS 의 폭(vw)이 «부스 폭»을 뜻한다.
  ④ 턴테이블 자리(가장 어두운 둥근 덩이 둘)의 중심·지름을 다시 재서 CSS 값으로 찍는다.
     (캔버스가 바뀌면 백분율이 전부 달라진다 — 눈대중으로 고치지 않는다.)

쓰는 법: python tools/부스다듬기.py            (제자리에 덮어쓴다 · 보존은 git)
"""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

루트 = Path(__file__).resolve().parent.parent
파일 = 루트 / 'docs/Loom_자산/라디오소품/부스.webp'


def main():
    im = Image.open(파일).convert('RGBA')
    A = np.array(im).astype(int)
    R, G, B, a = A[:, :, 0], A[:, :, 1], A[:, :, 2], A[:, :, 3]
    lum = (R + G + B) / 3
    # ① 남색 몸통 — 어둡고(lum<120) 파란 기운(B ≥ R) 이며 불투명한 자리
    남색 = (a > 128) & (lum < 120) & (B >= R)
    lab, n = ndimage.label(남색)
    if not n:
        raise SystemExit('남색 몸통을 못 찾았다')
    크기 = ndimage.sum(남색, lab, range(1, n + 1))
    몸통 = lab == (int(np.argmax(크기)) + 1)
    몸통 = ndimage.binary_fill_holes(몸통)
    # ② 가장자리 보풀 몫으로 4칸 부풀리고 2칸은 서서히 여리게
    안 = ndimage.binary_dilation(몸통, iterations=4)
    밖 = ndimage.binary_dilation(안, iterations=3)
    거리 = ndimage.distance_transform_edt(~안)          # 안 밖으로 몇 칸인가
    페이드 = np.clip(1 - 거리 / 3.0, 0, 1)
    페이드[안] = 1.0
    페이드[~밖] = 0.0
    새a = np.clip(np.round(a * 페이드), 0, 255).astype(np.uint8)
    걷은 = int(((a > 16) & (새a <= 16)).sum())
    out = A.copy().astype(np.uint8)
    out[:, :, 3] = 새a
    # ③ 네모로 자른다
    ys, xs = np.where(새a > 16)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    out = out[y0:y1, x0:x1]
    H, W = out.shape[:2]
    print(f'걷은 칸 {걷은:,}개 · 네모 {x0},{y0} → {x1},{y1} · 새 캔버스 {W}×{H} (H/W {H / W:.3f})')
    # ④ 턴테이블 자리 — 몸통 안에서 가장 어두운 12% 를 덩이로 묶어 큰 둥근 것 둘
    lum2 = out[:, :, :3].astype(int).mean(axis=2)
    몸2 = 몸통[y0:y1, x0:x1]
    문턱 = np.percentile(lum2[몸2], 12)
    어둠 = 몸2 & (lum2 < 문턱)
    어둠 = ndimage.binary_opening(어둠, iterations=3)
    lab2, n2 = ndimage.label(어둠)
    후보 = []
    for i in range(1, n2 + 1):
        yy, xx = np.where(lab2 == i)
        if len(yy) < 400:
            continue
        w, h = xx.max() - xx.min() + 1, yy.max() - yy.min() + 1
        둥글 = len(yy) / (np.pi * (w / 2) * (h / 2))     # 타원 넓이 대비 = 1 이면 꽉 찬 원
        if 0.55 < w / h < 1.8 and 둥글 > 0.5:
            후보.append((len(yy), xx.mean(), yy.mean(), w, h))
    후보.sort(reverse=True)
    if len(후보) < 2:
        raise SystemExit(f'턴테이블 자리를 둘 못 찾았다 (찾은 것 {len(후보)})')
    둘 = sorted(후보[:2], key=lambda t: t[1])
    for 이름, (_, cx, cy, w, h) in zip(('왼', '오'), 둘):
        지름 = (w + h) / 2
        print(f'  턴테이블 {이름}: 중심 x {cx / W:.3%} y {cy / H:.3%} · 지름 {지름 / W:.2%}(가로 기준)')
    # 디스크 폭 17%(가로) 를 중심에 맞출 때의 CSS — 왼쪽은 left, 오른쪽은 right, top 은 높이 기준
    디스크 = 0.17
    (_, lx, ly, _, _), (_, rx, ry, _, _) = 둘
    print('  CSS →')
    print(f'    .디스크.왼 {{ left: {(lx / W - 디스크 / 2) * 100:.1f}%; top: {(ly / H - 디스크 * W / H / 2) * 100:.1f}%; }}')
    print(f'    .디스크.오 {{ right: {(1 - rx / W - 디스크 / 2) * 100:.1f}%; top: {(ry / H - 디스크 * W / H / 2) * 100:.1f}%; }}')
    print(f'    부스 H/W = {H / W:.3f}')
    Image.fromarray(out, 'RGBA').save(파일, 'WEBP', quality=92, method=6)
    print(f'✅ {파일.relative_to(루트)} 덮어썼다')


if __name__ == '__main__':
    main()
