# 지유 스킨케어 컷 3(화장솜 옆 밀기): 시작 그림 한 장에서 가로로 어긋난 두 창을 잘라 시작·끝 그림을 만든다.
#   python 컷3_옆밀기_창.py <원본.jpg>   → 키프레임_A/컷3_시작_창.jpg, 컷3_끝_창.jpg (각 1440×2560, 9:16)
# 10-18 Fable 검수: 따로 다시 뽑은 끝 그림은 카메라가 거의 안 움직이고 솜·대리석 결만 바뀌어, 영상 모델이 옆 밀기 대신 표면을 녹이듯 바꾼다.
# 같은 그림에서 자른 두 창은 순수한 평행 이동이라 「끝에서 멈춤」을 못 박는다(가까운 것과 먼 것의 시차는 없다 — 2초 아주 느린 밀기라 눈에 띄지 않는 정도).
import os
import sys

from PIL import Image

sys.stdout.reconfigure(encoding="utf-8")
K = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "jiyu-skincare-20261018", "키프레임_A")
src = sys.argv[1]
im = Image.open(src).convert("RGB")
w, h = im.size
cw = round(w * 0.9375)          # 1536 → 1440
ch = round(cw * 16 / 9)         # 9:16 → 2560
top = (h - ch) // 2
shift = w - cw                  # 96px = 6.25%
im.crop((0, top, cw, top + ch)).save(os.path.join(K, "컷3_시작_창.jpg"), quality=95)
im.crop((shift, top, shift + cw, top + ch)).save(os.path.join(K, "컷3_끝_창.jpg"), quality=95)
print(f"{w}x{h} → 창 {cw}x{ch}, 옆으로 {shift}px({shift / w:.1%})")
