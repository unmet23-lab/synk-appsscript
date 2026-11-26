# E64 「서비스」 v7 — 끝 반전을 글이 아니라 그림으로(유호님 11-27 「고친 뒤 바꿔」).
# 이해 시험 v6-2 · v6-3에서 시험관 둘과 볼 이유 심사관이 「반전이 작은 글씨에만 있다」를 짚었다.
# 칸 10(사장님이 계산서를 내밂)과 칸 11(놀란 몽글) 사이에 계산서를 가까이 잡은 칸 하나를 더한다:
# 공짜로 받은 세 접시는 ₩0, 「서비스 더 주세요~!」로 조른 빈 접시 한 줄에만 ₩8,000이 수놓여 있다.
# 숫자는 이 세계의 재질대로 펠트 종이에 수놓은 글자로 그림과 한 장에 굽는다(영상 원칙 6 「글자는 디자인이다」).
# 굽기: node tools/그림굽기.js docs/마케팅/LAB_서비스_20261125 판/b1.txt b1 영상칸/시작/s1n.jpg 영상칸/시작/a10.jpg 판/참고/결_미안n3.jpg
# 구운 2:3 판은 판/_시작맞추기.py가 9:16(1080×1920)으로 맞춰 영상칸/시작/b1.jpg로 둔다.
import io
import os

HEAD = """Use your image generation tool to create exactly ONE image. Do not write code, do not edit files, do not run shell commands. After the image is generated, reply with one short line describing it.

IMAGE BRIEF — one panel of a vertical comedy short: a needle-felt miniature diorama photo, portrait 2:3, warm evening light from a red felt lantern just out of frame, shallow depth of field, cosy handmade texture, slightly playful.
"""

WORLD = """WORLD (same as the attached images — the same restaurant table and the same bill): a tiny felt Korean-Chinese neighbourhood restaurant in the evening. The table top is dark walnut-brown felt. The bill is the same small plain cream felt paper slip that the owner holds out in the second attached image.
MATERIAL RULE: everything is needle-felted wool or stitched felt. The writing on the bill is EMBROIDERED in thick dark-brown wool thread, chunky and hand-stitched, like a child's felt craft — not printed, not a font.
"""

REF = "Attached images in order: (1) the same restaurant table — match its walnut felt colour and light, (2) the same cream felt bill slip held by the owner — match its colour and shape, (3) felt craft-style reference."

CAM = """CAMERA: VERY CLOSE, looking straight down at the table from above (top-down), fixed.
- The cream felt bill lies FLAT on the walnut felt table, perfectly square to the frame, centred, filling 12% to 88% of the width and 26% to 84% of the height. The TOP 22% of the image is plain walnut felt table, slightly out of focus — keep it empty.
- The bill has FOUR rows, separated by three thin stitched dark-brown thread lines. Each row has, on the LEFT, one tiny needle-felted food item sewn onto the slip, and on the RIGHT, the price embroidered in big chunky dark-brown thread:
  - Row 1: three tiny golden-brown felt pan-fried dumplings — price "₩0"
  - Row 2: a tiny white felt plate of orange-gold felt sweet-and-sour pork chunks — price "₩0"
  - Row 3: a tiny white felt bowl of red jjamppong noodle soup — price "₩0"
  - Row 4: one tiny EMPTY plain white felt plate — price "₩8,000", and a hand-stitched dark-brown thread circle drawn around "₩8,000".
- The three "₩0" prices are the same size and line up in one column; "₩8,000" sits in the same column and is the same height, only longer, inside its stitched circle.
- At the RIGHT edge of the frame, just outside the bill next to row 4, the tip of the owner's felt hand with the white felt cuff of his chef's jacket rests on the table, pointing at the circled price, not covering it.
Nobody's face in this panel. MONGLE is not in this panel."""

TAIL = """
The ONLY writing anywhere in the image is exactly these four embroidered prices: "₩0", "₩0", "₩0", "₩8,000" — spelled exactly like that, with the won sign. No other letters, words, numbers, totals, dates or logos anywhere — not on the bill, not on the table. No real brand. No dense dotted or ring patterns anywhere. Keep every food icon and price fully inside the bill, nothing cut off by the frame.
"""

here = os.path.dirname(os.path.abspath(__file__))
with io.open(os.path.join(here, 'b1.txt'), 'w', encoding='utf-8', newline='\n') as f:
    f.write(HEAD + '\n' + WORLD + '\n' + REF + '\n\n' + CAM + '\n' + TAIL)
print('ok b1')
