# 렌더 장마다 빛 번짐(컴포지터 글레어와 같은 몫) — 밝은 자리만 골라 가깝게 · 넓게 두 번 번지게 더한다(스크린 섞기라 하얗게 타지 않는다).
# Fable 10-30 P1-2: 「반짝임 · 블룸이 없어 결정이 스스로 빛을 내지 않는다」. 블렌더 5.2 컴포지터는 노드 그룹 방식으로 바뀌어
# 파이썬으로 짜는 길이 흔들려, 같은 일을 장 파일에 한다. 색 · 얼굴 손질이 아니라 렌더의 빛 퍼짐이다.
#   python -I -X utf8 빛번짐.py <장 폴더> <내보낼 폴더> [문턱 0.72] [세기 0.32]
import glob
import os
import sys

import numpy as np
from PIL import Image, ImageFilter


def bloom(img, thr=0.72, k=0.32):
    a = np.asarray(img.convert("RGB"), np.float32) / 255
    lum = a.max(axis=2, keepdims=True)
    hi = a * np.clip((lum - thr) / (1 - thr), 0, 1) ** 1.5
    him = Image.fromarray((hi * 255).astype(np.uint8))
    s = img.width / 1080
    near = np.asarray(him.filter(ImageFilter.GaussianBlur(10 * s)), np.float32) / 255
    wide = np.asarray(him.filter(ImageFilter.GaussianBlur(42 * s)), np.float32) / 255
    b = np.clip(k * near + k * 0.55 * wide, 0, 1)
    out = 1 - (1 - a) * (1 - b)
    return Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8))


def main():
    src, dst = sys.argv[1], sys.argv[2]
    thr = float(sys.argv[3]) if len(sys.argv) > 3 else 0.72
    k = float(sys.argv[4]) if len(sys.argv) > 4 else 0.32
    os.makedirs(dst, exist_ok=True)
    fs = sorted(glob.glob(os.path.join(src, "*.png")))
    for f in fs:
        bloom(Image.open(f), thr, k).save(os.path.join(dst, os.path.basename(f)))
    print("빛 번짐", len(fs), "장 →", dst)


if __name__ == "__main__":
    main()
