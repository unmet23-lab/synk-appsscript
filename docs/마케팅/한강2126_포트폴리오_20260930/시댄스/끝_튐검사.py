"""끝을 채운 판(_끝.mp4)의 마지막 1.5초에서 이웃보다 튀는 프레임 차이를 찾는다(11-07). 섞은 8장 · 채운 장 이음새 확인용.
  python -X utf8 끝_튐검사.py <_목록 json>
"""
import json
import os
import subprocess
import sys

import numpy as np

for e in json.load(open(sys.argv[1], encoding='utf-8')):
    if not e['up'].endswith('_끝.mp4'):
        continue
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-sseof', '-1.5', '-i', e['up'], '-vf', 'scale=270:480,format=gray', '-f', 'rawvideo', '-'],
                         capture_output=True).stdout
    a = np.frombuffer(raw, np.uint8).reshape(-1, 480, 270).astype(float)
    d = np.abs(np.diff(a, axis=0)).mean(axis=(1, 2))
    med = np.median(d) + 1e-6
    jumps = [(i - len(d), round(float(x / med), 1)) for i, x in enumerate(d) if x > 2.5 * med and x > 2.0]
    print(os.path.basename(e['up'])[:44], '끝 1.5초 튐(끝에서, 배):', jumps)
