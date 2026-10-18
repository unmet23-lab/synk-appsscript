# -*- coding: utf-8 -*-
"""흰 바탕에서 오린 펠트 조각의 가장자리에 남은 흰 털 띠·흰 바탕 조각을 걷는다(2026-10-17).

펠트판_칸오리기.py로 오린 조각을 파랑·검정 바탕에 얹으면, 검정·살구 펠트의 보풀 가장자리가 흰 바탕과
섞인 밝은 픽셀로 남아 흰 테가 보이고(아령·얇은 귀), 조각 사이에 갇힌 흰 바탕이 남기도 한다.
옛 clean_cut.py·fix_edges.py는 저장소 밖(synk-vendor)에 있다가 노트북을 옮기며 빠져서 여기 다시 둔다.

원리: 가장자리 띠(투명에서 band 픽셀 안)의 픽셀 I는 펠트 색 F와 흰 바탕의 섞임 I = a·F + (1−a)·255 로 본다.
F는 띠 안쪽의 가장 가까운 불투명 펠트 색으로 잡고, 가장 어두운 채널로 a를 구해 알파에 곱하고 색에서 흰빛을 뺀다.
흰 바탕과 같은 색이면 a = 0이라 사라지고, 펠트 색 그대로면 a = 1이라 남는다.

python -X utf8 tools/펠트조각_흰테걷기.py <조각.webp> [<조각.webp> ...] [--띠 6] [--속 3] [--흰펠트없음] [--흰조각 N] [--덮어쓰기 | --낼폴더 <폴더>]

--흰조각 N: 거의 흰 덩어리 가운데 N픽셀보다 작은 것을 지운다(조각 사이에 갇힌 흰 바탕).
--흰펠트없음: 흰·회백 펠트 부품이 없는 조각(검정 아령·살구 귀 등)에 준다. 두꺼운 흰 털 띠와 조각 사이에 갇힌 흰 바탕까지 걷는다.

주의: 띠 안의 얇은 흰·크림 부품(몽글 밑단의 크림 실땀처럼 band보다 얇은 것)은 안쪽 색을 펠트 색으로 잘못 잡아 사라진다.
그런 조각(몽글 표정 등)에는 쓰지 않는다. 두꺼운 흰 펠트(구름·바람 줄기)는 안쪽이 흰색이라 남는다.
결과는 놓일 바탕색에 2배로 얹어 확인한다.
"""
import sys, pathlib
import numpy as np
from PIL import Image
from scipy import ndimage as ndi


def 걷기(rgba, 띠=6, 속=3, 흰펠트없음=False, 흰조각=0):
    im = rgba.astype(np.float32)
    rgb, A = im[..., :3], im[..., 3] / 255.0
    보임 = A > 0
    단단 = A > 0.98
    if 흰펠트없음:
        # 흰·회백 털 띠가 두꺼우면 불투명이라 「속」으로 잡혀 남는다. 흰 펠트가 없는 조각은 흰빛을 속에서 뺀다.
        흰빛 = (rgb.min(axis=2) > 215) & (rgb.max(axis=2) - rgb.min(axis=2) < 30)
        단단 = 단단 & ~흰빛
    핵 = ndi.binary_erosion(단단, iterations=속)
    if not 핵.any():
        return rgba
    # 가장 가까운 핵 픽셀의 색 = 그 자리 펠트 색
    _, (iy, ix) = ndi.distance_transform_edt(~핵, return_indices=True)
    F = rgb[iy, ix]
    # 칸오리기 결과는 바깥에 거의 투명한 픽셀(알파 0.25 밑)이 넓게 깔려 있어, 그걸 「보임」으로 재면 흰 테가 띠 밖으로 밀린다.
    바깥거리 = ndi.distance_transform_edt(A > 0.3)
    가장자리 = 보임 & ~핵 & (바깥거리 <= 띠)
    I_min = rgb.min(axis=2)
    F_min = F.min(axis=2)
    a = np.clip((255.0 - I_min) / np.maximum(255.0 - F_min, 1.0), 0.0, 1.0)
    a = np.where(가장자리, a, 1.0)
    # 흰빛을 뺀 색. a가 작으면 계산이 흔들리니 펠트 색으로 둔다.
    C = (rgb - (1.0 - a[..., None]) * 255.0) / np.maximum(a[..., None], 1e-3)
    C = np.clip(C, 0, 255)
    C = np.where((a < 0.5)[..., None], F, C)
    새색 = np.where(가장자리[..., None], C, rgb)
    새알파 = A * a
    # 너무 옅게 남은 점은 지운다
    새알파 = np.where(새알파 < 0.06, 0.0, 새알파)
    if 흰조각:
        # 조각 사이에 갇힌 흰 바탕(띠보다 안쪽이라 위에서 안 걸림): 작은 흰 덩어리만 지운다. 큰 흰 면(화면 속 크림 등)은 둔다.
        거의흰 = (rgb.min(axis=2) > 232) & (rgb.max(axis=2) - rgb.min(axis=2) < 25) & (새알파 > 0)
        라벨, n = ndi.label(거의흰)
        if n:
            크기 = ndi.sum(거의흰, 라벨, index=np.arange(1, n + 1))
            작은 = np.isin(라벨, np.flatnonzero(크기 < 흰조각) + 1)
            새알파 = np.where(작은, 0.0, 새알파)
    out = np.dstack([새색, 새알파 * 255.0])
    return np.clip(out + 0.5, 0, 255).astype(np.uint8)


def main(argv):
    띠, 속, 덮어, 흰없음, 흰조각 = 6, 3, False, False, 0
    낼 = None
    파일 = []
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == '--흰펠트없음': 흰없음 = True; i += 1; continue
        if a == '--흰조각': 흰조각 = int(argv[i + 1]); i += 2; continue
        if a == '--띠': 띠 = int(argv[i + 1]); i += 2; continue
        if a == '--속': 속 = int(argv[i + 1]); i += 2; continue
        if a == '--덮어쓰기': 덮어 = True; i += 1; continue
        if a == '--낼폴더': 낼 = pathlib.Path(argv[i + 1]); i += 2; continue
        파일.append(pathlib.Path(a)); i += 1
    if not 파일 or (not 덮어 and 낼 is None):
        print(__doc__); return 2
    for p in 파일:
        src = np.asarray(Image.open(p).convert('RGBA'))
        res = 걷기(src, 띠, 속, 흰없음, 흰조각)
        dst = p if 덮어 else 낼 / p.name
        dst.parent.mkdir(parents=True, exist_ok=True)
        Image.fromarray(res, 'RGBA').save(dst, lossless=True) if dst.suffix.lower() == '.webp' else Image.fromarray(res, 'RGBA').save(dst)
        전, 후 = (src[..., 3] > 0).sum(), (res[..., 3] > 0).sum()
        print(f'{p.name}: 보이는 픽셀 {전} → {후} ({(전 - 후) / max(전, 1):.1%} 걷음)')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
