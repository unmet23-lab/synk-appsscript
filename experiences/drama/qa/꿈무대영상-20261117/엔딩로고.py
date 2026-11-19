"""
꿈 무대 엔딩(2026-11-20) — 제작 SYNK PULSE 마크의 평면 판을 만든다.
11-18 도담 영어 판 끝 화면에서 유호님이 고르신 평면 판(「평면으로 바꿔」, 로고 정본 용도별 원천 표의 예외 행)과 같은 방법이다.
승인 파일(브랜드킷 배치용 SYNK-PULSE-Paper.png)의 외곽선(알파)을 그대로 두고 synk는 크림 한 색, PULSE는 베리 몸통 색 한 색으로 채운다.
이 엔딩으로 넓힌 것은 유호님 11-20 「나머지는 전부 … 자율주행으로 엔딩 마무리」에 따른 Claude 판단이다(결정 11-20).

    python -I -X utf8 엔딩로고.py <밖.png>
"""
import os
import sys

import numpy as np
from PIL import Image

뿌리 = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
원본 = os.path.join(뿌리, "docs", "홍보물", "마케팅실행_20260909", "브랜드킷", "배치용", "SYNK-PULSE-Paper.png")


def 평면(밖):
    im = Image.open(원본).convert("RGBA")
    im = im.crop(im.getchannel("A").getbbox())
    a = np.asarray(im).astype(np.float32)
    A = a[..., 3]
    col = (A > 128).sum(axis=0)
    w = len(col)
    gap = [x for x in np.where(col == 0)[0] if w * 0.4 < x < w * 0.75]  # synk와 PULSE 사이 빈 기둥
    cut = int(np.median(gap))
    px = a[:, cut:, :3][A[:, cut:] > 200]
    berry = np.median(px[(px.max(1) - px.min(1)) > 60], axis=0)  # 흰 실땀을 뺀 베리 몸통 색
    out = np.zeros_like(a)
    out[..., 3] = A
    out[:, :cut, :3] = (239, 230, 216)
    out[:, cut:, :3] = berry
    Image.fromarray(out.astype(np.uint8)).save(밖)
    print("평면 로고", 밖, im.size, "베리", berry.round().tolist())


if __name__ == "__main__":
    평면(sys.argv[1])
