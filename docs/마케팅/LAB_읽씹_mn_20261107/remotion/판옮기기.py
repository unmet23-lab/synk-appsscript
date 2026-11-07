"""LAB 몽골 M26 「읽씹」 — 구운 2×2 판(판/몽글읽씹_*.png)을 칸 넷으로 잘라 public/img에 둔다.
쓰는 법: python -I 판옮기기.py <판.png>
칸 사이 어두운 틈을 피해 칸마다 안쪽으로 8px 들여 자른다."""
import sys, os
from PIL import Image

src = sys.argv[1]
here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, 'public', 'img')
os.makedirs(out, exist_ok=True)
im = Image.open(src).convert('RGB')
W, H = im.size
half_w, half_h = W // 2, H // 2
names = ['night', 'read', 'dawn', 'flat']
for k, name in enumerate(names):
    cx, cy = k % 2, k // 2
    box = (cx * half_w + 8, cy * half_h + 8, (cx + 1) * half_w - 8, (cy + 1) * half_h - 8)
    cell = im.crop(box)
    cell.save(os.path.join(out, f'room_{name}.jpg'), quality=92)
    print(name, cell.size)
