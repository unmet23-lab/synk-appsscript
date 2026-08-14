# -*- coding: utf-8 -*-
"""
마스코트 비율안 — 확정 렌더를 «재생성하지 않고» 세로 비율만 바꾼다 (2026-08-14).

왜 재생성이 아닌가 (유호 판정 08-14):
  「표정 다양하게 나온 버전은 너무 AI티가 나서 별로다 — 우린 명품 학원이 목표다.」
  생성 모델에 다시 넣으면 확정 렌더의 질감이 «다시 그려지고», 그게 AI티로 읽힌다.
  그래서 여기서는 원본 픽셀을 그대로 두고 **세로 좌표만 다시 매핑**한다(색 연산 0).

왜 «눈 아래»만 누르나 (실측 08-14):
  본체 몸통 689×841 · 세로/가로 1.221 · 눈 라인이 위에서 30.7% → **몸의 69.2%가 눈 밑**이다.
  전체를 균등하게 누르면 ①눈이 타원이 되고 ②상단 검은 유리 밴드(유호 채택분)가 찌그러진다.
  눈 아래만 누르면 세로가 줄면서 **눈이 상대적으로 중앙으로 내려온다** — 베이비 스키마에서
  귀여움을 만드는 것이 정확히 그 두 가지(둥근 실루엣 + 얼굴 아래쪽 눈)라 한 번에 잡힌다.

이음매를 안 만드는 법:
  경계에서 배율이 1.0 → smin 으로 «급히» 바뀌면 그 줄에 눌린 자국이 남는다.
  smoothstep 으로 배율을 부드럽게 떨어뜨리고, 그 배율을 «누적»해서 좌표를 만든다.
"""
import argparse
import os

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
누끼 = os.path.join(ROOT, "docs", "캐릭터", "마스코트_누끼")


def 몸측정(im):
    a = np.array(im)
    ys, xs = np.where(a[..., 3] > 8)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    rgb = a[..., :3].astype(int)
    lum = 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]
    h = y1 - y0 + 1
    띠 = np.zeros_like(a[..., 3], bool)
    띠[int(y0 + h * 0.22):int(y0 + h * 0.55), :] = True     # 상단 유리 밴드를 피한다
    ey, _ = np.where((a[..., 3] > 200) & (lum < 40) & 띠)
    return dict(x0=x0, x1=x1, y0=y0, y1=y1, w=x1 - x0 + 1, h=h, 눈y=float(ey.mean()))


def 세로재매핑(im, 배율):
    """배율[y] = 그 줄의 세로 배율(1.0=그대로). 알파를 «미리 곱해» 보간해야 테두리 헤일로가 안 생긴다."""
    a = np.array(im).astype(np.float64)
    al = a[..., 3:4] / 255.0
    pm = np.concatenate([a[..., :3] * al, a[..., 3:4]], axis=2)   # premultiplied

    누적 = np.concatenate([[0.0], np.cumsum(배율)])               # src y → dst y
    H2 = int(round(누적[-1]))
    src = np.interp(np.arange(H2) + 0.5, 누적, np.arange(len(누적)))  # dst y → src y

    i0 = np.clip(np.floor(src).astype(int), 0, a.shape[0] - 1)
    i1 = np.clip(i0 + 1, 0, a.shape[0] - 1)
    t = (src - i0)[:, None, None]
    out = pm[i0] * (1 - t) + pm[i1] * t

    al2 = out[..., 3:4] / 255.0
    rgb = np.divide(out[..., :3], np.maximum(al2, 1e-6))          # unpremultiply
    return Image.fromarray(np.clip(np.concatenate([rgb, out[..., 3:4]], 2), 0, 255).astype(np.uint8), "RGBA")


def 밑단압축(im, m, smin):
    """눈 «아래»만 누른다. 눈·유리 밴드는 배율 1.0 이라 원본 픽셀 그대로다."""
    H = im.height
    y시작 = m["눈y"] + m["h"] * 0.11        # 눈 아래턱을 지난 자리에서 시작
    y끝 = m["눈y"] + m["h"] * 0.30          # 여기서부터 완전히 smin
    u = np.clip((np.arange(H) - y시작) / (y끝 - y시작), 0, 1)
    return 세로재매핑(im, 1.0 - (1.0 - smin) * (u * u * (3 - 2 * u)))


def 균등압축(im, s):
    """대조군 — 전체를 똑같이 누른다. 눈이 타원이 되는 것을 «보이기 위해» 만든다."""
    return 세로재매핑(im, np.full(im.height, s))


def 다듬기(im):
    a = np.array(im)
    ys, xs = np.where(a[..., 3] > 8)
    return im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--컷", default="본체.png")
    ap.add_argument("--나가는곳", default=os.path.join(ROOT, "docs", "캐릭터", "비율안_0814"))
    a = ap.parse_args()
    os.makedirs(a.나가는곳, exist_ok=True)

    원본 = Image.open(os.path.join(누끼, a.컷)).convert("RGBA")
    m = 몸측정(원본)
    print(f"원본  {m['w']}x{m['h']} · 세로/가로 {m['h']/m['w']:.3f} · "
          f"눈 위에서 {(m['눈y']-m['y0'])/m['h']*100:.1f}%\n")

    표 = []
    def 담기(이름, img, 설명):
        c = 다듬기(img)
        mm = 몸측정(c)
        경로 = os.path.join(a.나가는곳, f"{이름}.png")
        c.save(경로)
        표.append(dict(이름=이름, 설명=설명, w=mm["w"], h=mm["h"],
                       비=mm["h"] / mm["w"], 눈=(mm["눈y"] - mm["y0"]) / mm["h"] * 100))
        print(f"{이름:14s} {mm['w']}x{mm['h']}  세로/가로 {mm['h']/mm['w']:.3f}  "
              f"눈 {(mm['눈y']-mm['y0'])/mm['h']*100:.1f}%   {설명}")

    담기("0_원본", 다듬기(원본), "지금 확정본")
    담기("1_약", 밑단압축(원본, m, 0.80), "밑단 -20%")
    담기("2_중", 밑단압축(원본, m, 0.65), "밑단 -35%")
    담기("3_강", 밑단압축(원본, m, 0.50), "밑단 -50%")
    담기("X_균등", 균등압축(원본, 0.76), "대조군 — 전체를 균등하게 눌렀다(눈이 타원이 된다)")

    print("\n※ 색 연산 0 — 세로 좌표만 다시 매핑했다. 눈·유리 밴드 구간은 배율 1.0 이라 원본 픽셀 그대로다.")


if __name__ == "__main__":
    main()
