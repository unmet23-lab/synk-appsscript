# E64 「서비스」 v8 — 계산서 넷째 줄의 빈 접시를 「더 주세요~!」 말풍선으로(유호님 11-27 「마지막에 이해가 잘 안가」 → 「응, 고쳐」).
# v7 계산서는 더 달라고 한 한 접시를 빈 접시로 그려 「빈 접시 값이 8,000원」으로 읽혔다.
# 몽글이 칸 9에서 한 말(「서비스 더 주세요~!」)을 펠트 말풍선에 수놓아, 「달라고 한 것」에 값이 붙은 것을 그림으로 보인다.
# v7 판(b1_053147.png)을 첫 참고로 주고 넷째 줄 왼쪽만 바꾼다 — 나머지(세 줄 · 숫자 · 동그라미 · 손끝 · 빛)는 그대로.
# 굽기: node tools/그림굽기.js docs/마케팅/LAB_서비스_20261125 판/b2.txt b2 판/b1_053147.png 판/참고/결_미안n3.jpg
# 구운 2:3 판은 판/_시작맞추기.py가 9:16(1080×1920)으로 맞춰 영상칸/시작/b2.jpg로 둔다.
import io
import os

T = """Use your image generation tool to create exactly ONE image. Do not write code, do not edit files, do not run shell commands. After the image is generated, reply with one short line describing it.

EDIT THE FIRST ATTACHED IMAGE. It is one panel of a vertical comedy short: a needle-felt miniature diorama photo, portrait 2:3, looking straight down at a cream felt restaurant bill on a walnut felt table. Keep the whole image the same — same framing, camera, light, table, bill shape and colour, the three stitched divider lines, rows 1 to 3 (dumplings "₩0", sweet-and-sour pork "₩0", jjamppong "₩0"), the stitched circle with "₩8,000" in row 4, and the owner's felt fingertip at the right edge next to row 4.

CHANGE ONLY ONE THING — the item on the LEFT of row 4:
- Remove the empty white felt plate.
- In its place, sew on a small cream-white felt SPEECH BUBBLE (a rounded rectangle with a short pointed tail at its lower-left corner), outlined with a stitched dark-brown thread edge, the same size as the jjamppong bowl above it.
- Inside the bubble, embroider these Korean words in the same thick chunky dark-brown wool thread as the prices, on ONE line, large enough to fill the bubble: 더 주세요~!
  Spell it exactly: 더 주세요~! — the syllables 더 · 주 · 세 · 요, then a tilde and an exclamation mark. Hand-stitched, like a child's felt craft, not a printed font.
- The speech bubble sits fully inside the bill, left of the circled "₩8,000", not touching the circle.

The second attached image is only a felt craft-style reference.

The ONLY writing anywhere in the image is exactly: "₩0", "₩0", "₩0", "더 주세요~!" and "₩8,000". No other letters, words, numbers, totals or logos. No real brand. No dense dotted or ring patterns anywhere. Keep every item and price fully inside the bill and inside the frame. The top 22% of the image stays plain walnut felt table, as in the first image.
"""

here = os.path.dirname(os.path.abspath(__file__))
with io.open(os.path.join(here, 'b2.txt'), 'w', encoding='utf-8', newline='\n') as f:
    f.write(T)
print('ok b2')
