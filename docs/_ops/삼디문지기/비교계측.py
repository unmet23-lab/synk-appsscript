"""기존 PNG 두 장을 읽어 비교 화면의 좌표와 수치를 얻는다. 이미지/기존 판정은 쓰지 않는다."""
import hashlib
import importlib.util
import json
from pathlib import Path
import numpy as np

root = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location('gate', root / 'tools/삼디실루엣대조.py')
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)
images, masks = [], []
for path in (gate.정본, gate.렌더판):
    mask, im = gate.알파(path)
    ys, xs = np.where(mask)
    images.append({
        'path': str(path), 'size': list(im.size),
        'bbox': [int(xs.min()), int(ys.min()), int(xs.max()+1), int(ys.max()+1)],
        'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
        'bottomEdgeOpaquePixels': int(mask[-1].sum()),
    })
    masks.append(gate.상자맞춤(mask))
intersection = int(np.logical_and(*masks).sum())
union = int(np.logical_or(*masks).sum())
print(json.dumps({'images': images, 'intersection': intersection, 'union': union,
                  'iou': intersection/union, 'threshold': gate.통과선}, ensure_ascii=False))
