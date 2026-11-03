# 빨간 펜 판(판/빨간펜_*.png — GPT 이미지 2.5)에서 「아니요」 셋 · 취소선 · 동그라미를 오려 public/img에 둔다(흰 바탕을 빨강 정도로 알파로 바꿈).
import numpy as np
from PIL import Image
src = Image.open('판/빨간펜_073426_1.png').convert('RGB')
print(src.size)
a = np.asarray(src).astype(np.float32)
alpha = np.clip((245 - a[..., 1]) / (245 - 70), 0, 1)
rgba = np.zeros(a.shape[:2] + (4,), np.uint8)
rgba[..., 0], rgba[..., 1], rgba[..., 2] = 229, 50, 45
rgba[..., 3] = (alpha * 255).astype(np.uint8)
칸 = {'no1': (50, 130, 500, 320), 'no2': (560, 130, 1000, 320), 'no3': (1060, 130, 1510, 320), 'strike': (90, 830, 745, 895), 'oval': (870, 750, 1445, 975)}
for 이름, b in 칸.items():
    Image.fromarray(rgba[b[1]:b[3], b[0]:b[2]]).save(f'remotion/public/img/pen_{이름}.png')
    print(이름, b[2] - b[0], b[3] - b[1])
