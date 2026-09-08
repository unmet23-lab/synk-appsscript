# -*- coding: utf-8 -*-
"""마스코트 가장자리 수리 — 배경을 걷을 때 테두리에 남은 «검은 부스러기»를 지운다.

  왜 있나 (유호 지적 2026-09-08):
    「마린 여기가 좀 달라. 여기가 좀 깨지고 꽃도 좀 깨졌어.」
    확대해 보니 크림색 팔·다리의 테두리에 어두운 점이 촘촘히 박혀 있었다.

  🔴 무엇이 남은 것인가
    옛 뒤처리(`흰배경걷기.py`)는 **색으로** 배경을 갈랐다. 크림은 흰 바탕과 색이 가까워서
    물건의 밝은 쪽이 배경으로 읽히고, 그 자리에 **바탕과 몸이 섞인 어두운 화소**가 남는다.
    알파는 살아 있으니 «구멍»이 아니라 «때»다 — 그래서 걷어내는 게 아니라 **색을 고친다.**

  어떻게
    ① 속살 = 알파가 꽉 찬(≥250) 자리를 안쪽으로 `--깎기` 만큼 깎은 것.
    ② 테두리 띠(알파는 있는데 속살이 아닌 자리)의 «색»을 속살 색으로 밀어 넣는다.
    ②-b 속살 안에 남은 «반투명 얼룩»은 꽉 채운다(통짜 물건의 안은 뚫려 있을 수 없다).
    ③ 바깥 테두리의 알파는 **한 화소도 안 건드린다** — 실루엣과 보풀의 부드러움이 그대로 남는다.
       고치는 것은 «테두리의 색»과 «속살의 반투명»뿐이라, 형태는 그대로고 «때»만 빠진다.

  쓰는 법
    python tools/마스코트가장자리수리.py <파일> [--출력 <파일>] [--깎기 3] [--번짐 10]
    python tools/마스코트가장자리수리.py --전량 docs/캐릭터/정본_4K   ← 폴더 통째로(제자리)
"""
import argparse, os, sys
import numpy as np
from PIL import Image


def 수리(a, 깎기=3, 번짐=10):
    """a = RGBA numpy 배열. 색만 고쳐 돌려준다(알파 그대로)."""
    al = a[..., 3]
    있 = al > 0
    if not 있.any():
        return a, 0
    ys, xs = np.where(있)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    pad = 번짐 + 깎기 + 2
    y0, x0 = max(0, y0 - pad), max(0, x0 - pad)
    y1, x1 = min(a.shape[0], y1 + pad), min(a.shape[1], x1 + pad)
    sub = a[y0:y1, x0:x1]
    A = sub[..., 3]
    꽉 = A >= 250

    # ① 속살 = 꽉 찬 자리를 깎기만큼 안으로 깎는다(4방향 침식을 깎기 번)
    속 = 꽉.copy()
    for _ in range(깎기):
        t = 속.copy()
        t[1:, :] &= 속[:-1, :]
        t[:-1, :] &= 속[1:, :]
        t[:, 1:] &= 속[:, :-1]
        t[:, :-1] &= 속[:, 1:]
        속 = t

    # ② 속살 색을 테두리 띠로 밀어 넣는다
    col = sub[..., :3].astype(np.float32)
    안다 = 속.copy()
    바꿈 = 0
    for _ in range(번짐):
        갈곳 = (A > 0) & (~안다)
        if not 갈곳.any():
            break
        합 = np.zeros_like(col)
        수 = np.zeros(col.shape[:2], np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            src = np.roll(안다, (dy, dx), (0, 1))
            csrc = np.roll(col, (dy, dx), (0, 1))
            합 += csrc * src[..., None]
            수 += src
        칠 = 갈곳 & (수 > 0)
        if not 칠.any():
            break
        col[칠] = 합[칠] / 수[칠][:, None]
        안다 |= 칠
        바꿈 += int(칠.sum())

    # ③ 속살에 남은 «반투명 얼룩»을 메운다 — 통짜 물건의 «안»은 꽉 차 있어야 한다.
    #    09-08 실측: 마린 좌34·우34 의 크림 몸 안쪽에 알파가 안 꽉 찬 자리가 1.0~1.1% 였고
    #    (본체는 0.19%), 그 자리가 어두운 바탕을 비쳐 «숭숭 뚫린» 것처럼 보였다.
    메움 = int(((A > 0) & 속 & (A < 255)).sum())
    A2 = A.copy()
    A2[속 & (A > 0)] = 255

    out = a.copy()
    out[y0:y1, x0:x1, :3] = np.clip(col, 0, 255).astype(np.uint8)
    out[y0:y1, x0:x1, 3] = A2
    return out, 바꿈 + 메움


def 어두운점(a, 문턱=130):
    """몸 안에서 «어두운데 둘레는 밝은» 화소 수 — 수리 전후를 견주는 자."""
    al = a[..., 3]
    m = al > 128
    r, g, b = (a[..., i].astype(int) for i in range(3))
    lum = .2126 * r + .7152 * g + .0722 * b
    밝은몸 = m & (r > 150)
    if not 밝은몸.any():
        return 0
    ys, xs = np.where(밝은몸)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    구역 = np.zeros_like(m)
    구역[y0:y1, x0:x1] = True
    return int((m & 구역 & (lum < 문턱)).sum())


def 한장(길, 낼곳=None, 깎기=3, 번짐=10):
    a = np.asarray(Image.open(길).convert('RGBA'))
    전 = 어두운점(a)
    b, 바꿈 = 수리(a, 깎기, 번짐)
    후 = 어두운점(b)
    Image.fromarray(b).save(낼곳 or 길)
    이름 = os.path.basename(길)
    print(f'  ✅ {이름:<22} 테두리 화소 {바꿈:,} 고침 · 어두운 점 {전:,} → {후:,} ({100*(전-후)/max(전,1):.1f}% 줄었다)')
    return 전, 후


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('파일', nargs='?')
    p.add_argument('--출력')
    p.add_argument('--전량')
    p.add_argument('--깎기', type=int, default=3)
    p.add_argument('--번짐', type=int, default=10)
    n = p.parse_args()
    if n.전량:
        fs = sorted(f for f in os.listdir(n.전량) if f.endswith('.png'))
        print(f'■ 가장자리 수리 {len(fs)}장 — {n.전량}')
        tot = [0, 0]
        for f in fs:
            a, b = 한장(os.path.join(n.전량, f), None, n.깎기, n.번짐)
            tot[0] += a; tot[1] += b
        print(f'\n[수리] 어두운 점 합계 {tot[0]:,} → {tot[1]:,} ({100*(tot[0]-tot[1])/max(tot[0],1):.1f}% 줄었다)')
    elif n.파일:
        한장(n.파일, n.출력, n.깎기, n.번짐)
    else:
        sys.exit('파일이나 --전량 <폴더> 를 준다')
