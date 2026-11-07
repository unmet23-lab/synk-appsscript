"""키운 판(1080p)이 원본(480p를 lanczos로 1080에 늘린 것)보다 장마다 얼마나 또렷한지 재서, 이웃보다 갑자기 흐려진 장을 찾는다(11-07).
원본에도 있는 흐림(초점 이동 · 빠른 움직임)은 빼고 키우기가 만든 흐림만 잡으려고, 결(라플라시안 분산)을 원본 결로 나눈 비를 본다.
  python -X utf8 키운판_흐림검사.py <_목록.json> [이름 일부…]
"""
import json
import os
import subprocess
import sys

import cv2
import numpy as np


def frames(path, vf):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-vf', vf, '-f', 'rawvideo', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, 960, 540)


def check(e):
    up = frames(e['up'], 'scale=540:960,format=gray')
    f0, n = e['first'], e['nf']
    sel = "select='between(n\\," + str(f0) + "\\," + str(f0 + n - 1) + ")'"
    src = frames(e['src'], sel + ',scale=1080:1920:flags=lanczos,scale=540:960,format=gray')
    m = min(len(up), len(src))
    # 흐림이 화면 한쪽에만 생길 때가 있어(11-07 S1 10~12번 장은 위쪽 절반만) 4×2 칸마다 잰다
    def tiles(x):
        return [x[r * 240:(r + 1) * 240, c * 270:(c + 1) * 270] for r in range(4) for c in range(2)]
    lu = np.array([[cv2.Laplacian(t, cv2.CV_64F).var() for t in tiles(x)] for x in up[:m]])
    ls = np.array([[cv2.Laplacian(t, cv2.CV_64F).var() for t in tiles(x)] for x in src[:m]]) + 1.0
    q = lu / ls
    med = np.array([np.median(q[max(0, i - 4):i + 5], axis=0) for i in range(m)])
    rr = (q / np.maximum(med, 1e-6)).min(axis=1)
    bad = [(i, round(float(rr[i]), 2)) for i in range(m) if rr[i] < 0.6]
    return m, float(np.median(q)), bad


def main():
    idx = json.load(open(sys.argv[1], encoding='utf-8'))
    pick = sys.argv[2:]
    for e in idx:
        if pick and not any(p in e['up'] for p in pick):
            continue
        m, mq, bad = check(e)
        print(os.path.basename(e['up']), f'{m}장 / 키운 결 ÷ 원본 결 중앙 {mq:.2f} / 흐린 장', bad, flush=True)


if __name__ == '__main__':
    main()
