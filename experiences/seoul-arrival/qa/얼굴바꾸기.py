# 실존 대조를 다시 통과한 판을 앱 그림으로 바꾼다: 원판 PNG → assets/img/*.webp, 얼굴 자리(얼굴 가운데 · 폭)를 재서 data.mjs LOOK_FACES를 고친다.
#   python -I -X utf8 experiences/seoul-arrival/qa/얼굴바꾸기.py mn_m=<판.png> [uz_f=…] [--판 booth=<판.png>]
# 시안의 얼굴재기.py와 같은 값(YuNet · webp 품질 84 · method 6)으로 맞춘다. 재는 모델은 저장소 밖 ~/.rembg/models/yunet.
import json, os, re, sys
import cv2, numpy as np
from PIL import Image
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
IMG = os.path.join(ROOT, 'assets', 'img')
DATA = os.path.join(ROOT, 'data.mjs')
M = os.path.join(os.environ['USERPROFILE'], '.rembg', 'models', 'yunet', 'face_detection_yunet_2023mar.onnx')
args = sys.argv[1:]
plates = [args[i + 1] for i, a in enumerate(args) if a == '--판']
faces = [a for i, a in enumerate(args) if '=' in a and a not in plates]
text = open(DATA, encoding='utf-8', newline='').read()
m = re.search(r'export const LOOK_FACES=(\{.*?\}\});?', text)
if not m:
    sys.exit('data.mjs의 LOOK_FACES 줄을 못 찾음')
table = json.loads(m.group(1))
for pair in faces:
    key, path = pair.split('=', 1)
    if key not in table:
        sys.exit(f'모르는 얼굴: {key}')
    src = Image.open(path).convert('RGB')
    W, H = src.size
    d = cv2.FaceDetectorYN.create(M, '', (W, H), 0.6, 0.3, 5000)
    _, found = d.detect(cv2.cvtColor(np.array(src), cv2.COLOR_RGB2BGR))
    if found is None or len(found) != 1:
        sys.exit(f'얼굴 수 이상: {path} ({0 if found is None else len(found)})')
    x, y, w, _h = found[0][:4]
    table[key] = {'w': W, 'h': H, 'fx': round(float((x + w / 2) / W), 4), 'fy': round(float((y + _h / 2) / H), 4), 'fw': round(float(w / W), 4)}
    out = os.path.join(IMG, 'look-' + key.replace('_', '-') + '.webp')
    src.save(out, quality=84, method=6)
    print(key, W, H, table[key]['fx'], table[key]['fy'], table[key]['fw'], os.path.getsize(out) // 1024, 'KB')
for pair in plates:
    name, path = pair.split('=', 1)
    out = os.path.join(IMG, name + '.webp')
    if not os.path.exists(out):
        sys.exit(f'없는 판: {name}')
    Image.open(path).convert('RGB').save(out, quality=80, method=6)
    print(name, os.path.getsize(out) // 1024, 'KB')
new = text[:m.start(1)] + json.dumps(table, separators=(',', ':'), ensure_ascii=False) + text[m.end(1):]
open(DATA, 'w', encoding='utf-8', newline='').write(new)
