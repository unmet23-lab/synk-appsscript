# -*- coding: utf-8 -*-
"""마스코트 그림 안에서 «몸이 차지하는 자리»를 잰다 — 지면이 앉힐 때 쓰는 값.

  왜 있나 (2026-09-08): 화면용 그림은 1024² 정사각인데 몸은 아이마다 다른 크기로 그 안에 있다.
    몽글 0.767 · 까몽 0.790 · **마린 0.490** (몸 폭 ÷ 캔버스). 세로로 긴 아이라 그렇다(치수 정본 §1).
    그래서 지면이 «폭 46%»처럼 캔버스로 맞추면 마린만 눈에 띄게 작아진다.
    아래 여백도 갈린다(몽글 0.148 · 까몽 0.111 · 마린 0.047) — 바닥에 그냥 붙이면 발선이 어긋난다.
  ⇒ 이 자가 값을 내고, 지면 생성기가 그 값으로 «몸 높이»와 «발선»을 맞춘다.
    값을 지면에 손으로 적지 않는다 — 그림이 바뀌면 갈린다(기억 constant-known-in-two-places).

  쓰기: python tools/마스코트몸재기.py <파일…>      → JSON 한 덩이
"""
import io
import json
import os
import sys

import numpy as np
from PIL import Image

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
Image.MAX_IMAGE_PIXELS = None

낸것 = {}
for p in sys.argv[1:]:
    if not os.path.exists(p):
        낸것[os.path.basename(p)] = None
        continue
    a = np.array(Image.open(p).convert('RGBA'))
    m = a[..., 3] > 128
    ys, xs = np.nonzero(m)
    if len(ys) == 0:
        낸것[os.path.basename(p)] = None
        continue
    h, w = a.shape[0], a.shape[1]
    낸것[os.path.basename(p)] = {
        '몸폭비': round(float(xs.max() - xs.min() + 1) / w, 4),
        '몸높이비': round(float(ys.max() - ys.min() + 1) / h, 4),
        '아래여백비': round(float(h - ys.max() - 1) / h, 4),
        '왼여백비': round(float(xs.min()) / w, 4),
    }
print(json.dumps(낸것, ensure_ascii=False))
