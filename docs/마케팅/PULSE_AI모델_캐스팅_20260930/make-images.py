# 사용: python make-images.py 목록.json   목록: [[원본, 저장경로, 긴변px, 품질], ...]
# 원본 PNG를 웹용 WebP로 줄인다.
# 같은 저장경로에 다른 원본을 넣는 경우(대표 사진 교체)가 있어서, 날짜 비교만으로 건너뛰지 않는다.
# 저장경로마다 원본 경로·크기·수정 시각·설정을 기록해 두고, 하나라도 다르면 다시 만든다.
import json, os, sys
from PIL import Image

jobs = json.load(open(sys.argv[1], encoding='utf-8'))
manifest_path = os.path.join(os.path.dirname(os.path.abspath(sys.argv[1])), '_img-manifest.json')
try:
    manifest = json.load(open(manifest_path, encoding='utf-8'))
except (OSError, ValueError):
    manifest = {}

made = 0
for src, dst, side, q in jobs:
    st = os.stat(src)
    key = [os.path.abspath(src), st.st_size, int(st.st_mtime), side, q]
    if os.path.exists(dst) and manifest.get(os.path.abspath(dst)) == key:
        continue
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    im = Image.open(src).convert('RGB')
    im.thumbnail((side, side), Image.LANCZOS)
    im.save(dst, 'WEBP', quality=q, method=6)
    manifest[os.path.abspath(dst)] = key
    made += 1

json.dump(manifest, open(manifest_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print('ok', made, 'made')
