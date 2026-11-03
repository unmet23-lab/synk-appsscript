"""환승 러시 A안(실사 깊이 판) — 사진 한 장의 깊이 지도를 로컬에서 잰다(2026-11-04).

Depth Anything V2 Small(ONNX, onnx-community/depth-anything-v2-small)을 onnxruntime CPU로 돌린다 — 돈 0, 망 0(모델은 저장소 밖에 한 번 받아 둠).
모델 출력은 상대 역깊이(가까울수록 큼)이고, 0~1로 펴서 가까움 = 흰색인 8비트 회색 PNG로 낸다(셰이더가 그대로 읽는다).

  python -I -X utf8 깊이.py <그림…>   → 같은 폴더에 <이름>.depth.png
"""
import sys
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageFilter

MODEL = Path.home() / 'Documents' / 'synk-vendor' / 'depth' / 'onnx' / 'model.onnx'
MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


def run(session, path: Path) -> Path:
    im = Image.open(path).convert('RGB')
    w, h = im.size
    # 짧은 변 518, 긴 변은 비율대로 — 두 변 모두 14의 배수(ViT 조각 크기)
    scale = 518 / min(w, h)
    tw, th = (max(14, round(w * scale / 14) * 14), max(14, round(h * scale / 14) * 14))
    x = (np.asarray(im.resize((tw, th), Image.BICUBIC), dtype=np.float32) / 255 - MEAN) / STD
    x = x.transpose(2, 0, 1)[None]
    name = session.get_inputs()[0].name
    d = session.run(None, {name: x})[0].reshape(th, tw)
    lo, hi = np.percentile(d, 1), np.percentile(d, 99.5)
    d = np.clip((d - lo) / max(1e-6, hi - lo), 0, 1)
    out = Image.fromarray((d * 255).astype(np.uint8), 'L').resize((w, h), Image.BICUBIC)
    # 가장자리 계단을 조금 눅여 셰이더가 늘인 자리에 찢김이 덜 보이게
    out = out.filter(ImageFilter.GaussianBlur(radius=max(1, w // 400)))
    dest = path.with_name(path.stem + '.depth.png')
    out.save(dest)
    return dest


def main(argv):
    if not argv:
        print(__doc__)
        return 2
    session = ort.InferenceSession(str(MODEL), providers=['CPUExecutionProvider'])
    for a in argv:
        print(run(session, Path(a)))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
