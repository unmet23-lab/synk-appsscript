# E64 「서비스」 v6 — 「더 먹어」 짜임으로 다시(유호님 11-26 「다시 만들어」). 새 샷 아홉의 시작 그림 지시문.
# 세계 · 인물 글은 v1(_지시문만들기.py)과 같고, 몽글 줄만 11-25 「몽글 표정」 규칙(기본은 코 · 입 없음, 감정이 바뀌면 입까지)으로 바꿨다.
# 굽기: node tools/그림굽기.js docs/마케팅/LAB_서비스_20261125 판/<샷>.txt <샷> 영상칸/시작/s1n.jpg 판/참고/몽글_정본_본체.jpg [판/참고/<표정>.jpg] 판/참고/결_미안n3.jpg
#   첫 참고 s1n.jpg는 같은 가게 · 같은 사장님 · 같은 지갑을 잇는 그림이다.
# 구운 2:3 판은 판/_시작맞추기.py가 9:16(1080×1920)으로 맞춰 영상칸/시작/<샷>.jpg로 둔다.
import io
import os

HEAD = """Use your image generation tool to create exactly ONE image. Do not write code, do not edit files, do not run shell commands. After the image is generated, reply with one short line describing it.

IMAGE BRIEF — one panel of a vertical comedy short: a needle-felt miniature diorama photo, portrait 2:3, warm evening light from two low hanging red felt lanterns inside the scene, shallow depth of field, cosy handmade texture, slightly playful.
"""

WORLD = """WORLD (same in every panel — match the first attached image exactly: the same restaurant, the same owner, the same table, the same wallet): a tiny felt Korean-Chinese neighbourhood restaurant (jungguk-jip) in the evening — walls of plain warm brick-red felt, two round plain red felt lanterns hanging low (no tassels with many threads, no characters on them), a dark walnut-brown felt round table with a plain cream felt top. MONGLE'S WALLET is a small flat plain mustard-yellow felt wallet with one stitched flap (no button, no pattern, no logo).
MATERIAL RULE: every food in this world is needle-felted wool — pan-fried dumplings (gun-mandu) are matte golden-brown felt pouches with stitched pleats; sweet-and-sour pork (tangsuyuk) is a white felt plate of matte orange-gold felt chunks under a lumpy translucent-looking but MATTE amber felt sauce with a few felt carrot and cucumber slices; jjajangmyeon is a white felt bowl of thick cream wool-felt noodles under lumpy dark-brown wool-felt sauce; jjamppong is a big white felt bowl of matte red wool-felt soup with felt mussels and felt vegetables. NO oil shine, NO wet gloss, nothing looks like real food. Coins are small matte gold felt discs. Tears and sweat are tiny matte felt beads, never transparent.
CHARACTERS (keep them identical to the first attached image):
- THE OWNER: the restaurant owner, a Korean felt doll man in his fifties with a round friendly face, short salt-and-pepper felt hair, a small neat dark felt moustache, small black bead eyes and rosy cheeks, a white felt chef's jacket with two cloth-covered buttons, a plain tomato-red felt apron, a short white felt chef's cap, two felt hands.
- MONGLE: a small coral-pink felt blob mascot — use the mascot reference for its body shape, coral wool colour, fuzzy texture, scalloped bottom hem with a cream running stitch and glossy black bead eyes (no white sclera). Mongle has NO arms, NO legs, NO hands and NO neck — its head and body are one soft dome, and it moves by tilting, squashing, stretching and bouncing its whole body. At rest Mongle has no nose and no mouth; when its feeling changes it may show the expression asked for below (eye shape, cheeks, felt sweat or tear beads, a small felt mouth). Mongle sits ON the table top.
"""

TAIL = """
Keep every character between 10% and 90% of the image width. Absolutely no text, letters, numbers, symbols, question marks or watermarks anywhere — not on the walls, not on the lanterns, not on the apron, not on the wallet, not on the paper slip. No real brand, no logos. No dense dotted or ring patterns anywhere. Mongle's eyes stay glossy black beads with no white sclera unless the panel asks for another eye shape.
"""

REF = "Attached images in order: (1) the same restaurant, owner, table and wallet — match it, (2) mascot reference — Mongle's shape and colour, {extra}(last) felt craft-style reference."

PANELS = {
    # c3 — 첫 쌓임: 사장님이 탕수육 한 접시를 더 얹는다
    'a3': ('', """CAMERA: MEDIUM on the owner across the table, eye level, fixed.
- The TOP 20% of the image is plain brick-red felt wall with one lantern — keep it otherwise empty for titles.
- THE OWNER stands behind the table, centred at 42% of the width, seen from the waist up, his head at about 24–36% of the height, beaming proudly with his eyes half-closed in a big grin; with both felt hands he is just setting down a white felt plate of sweet-and-sour pork (tangsuyuk) on the table next to the dumpling plate, the plate still a finger's width above the table.
- On the table: the white felt plate of six golden-brown felt dumplings at 34% of the width, 66% of the height; MONGLE'S WALLET lies flat at the front, centred at 58% of the width, 78% of the height, pushed toward the owner.
- MONGLE sits on the table at the RIGHT edge, centred at 82% of the width, its bottom hem at about 86% of the height, about 20% of the image width wide, seen a little from behind and the side, its body leaning back in surprise.
Only the owner and Mongle in this panel, nobody else."""),
    # c4 — 진땀: 몽글이 지갑을 열어 동전을 쏟아 민다(아주 가깝게)
    'a4': ('(3) mascot reference — Mongle\'s worried teary eyes, ', """CAMERA: VERY CLOSE on Mongle at table level, eye level with Mongle, fixed — Mongle fills the right half of the frame.
- The TOP 20% of the image is the plain brick-red felt wall, softly out of focus — keep it empty for titles.
- MONGLE is centred at 62% of the width, its bottom hem at about 84% of the height, about 52% of the image width wide, flushed bright pink, two matte pale-blue felt sweat beads on its side, bead eyes wide and wobbly with worry, a tiny wavy felt mouth.
- MONGLE'S WALLET lies open on the table in front of Mongle's hem on the LEFT (centred at 30% of the width, 80% of the height), its flap open, and five small matte gold felt coins have slid out of it toward the left edge, as if Mongle just pushed them out.
- At the far left edge, blurred, the corner of the tangsuyuk plate.
Only Mongle in this panel, nobody else."""),
    # c5 — 셋째 쌓임: 짬뽕 큰 그릇까지 — 상이 가득 차고 몽글은 그릇들 사이에 작게(넓게)
    'a5': ('', """CAMERA: WIDE and a little high, looking down onto the whole table, fixed.
- The TOP 18% of the image is plain brick-red felt wall with the two lanterns — keep it otherwise empty for titles.
- THE OWNER stands behind the table on the LEFT, centred at 30% of the width, his head at about 24–34% of the height, grinning, lowering a BIG white felt bowl of red jjamppong soup with both hands onto the last free spot of the table.
- The cream felt table top fills the lower 55% of the image and is now CROWDED: the dumpling plate, the tangsuyuk plate, the half-eaten jjajangmyeon bowl, a small felt dish of yellow pickled radish, and the big jjamppong bowl arriving — dishes touching each other, no empty space left.
- MONGLE sits squeezed between the bowls at the front RIGHT, centred at 68% of the width, its bottom hem at about 84% of the height, only about 14% of the image width wide, looking tiny, its bead eyes wide; its open wallet and a small pile of gold felt coins lie in front of it.
Only the owner and Mongle in this panel, nobody else."""),
    # c6 — 절정: 몽글 눈이 핑글 · 동전 더미를 온몸으로 민다(아주 가깝게)
    'a6': ('(3) mascot reference — Mongle\'s tightly shut eyes, ', """CAMERA: VERY CLOSE on Mongle, a little low, fixed — Mongle fills the middle of the frame.
- The TOP 20% of the image is the plain brick-red felt wall, softly out of focus — keep it empty for titles.
- MONGLE is centred at 52% of the width, its bottom hem at about 84% of the height, about 56% of the image width wide, squashed forward as it pushes with its whole body, eyes squeezed shut into two short felt arcs, three matte pale-blue felt sweat beads flying off its sides, a small open felt mouth in a panicked 'O'.
- In front of Mongle's hem: a small heap of about twelve matte gold felt coins and the empty open yellow wallet, being shoved forward toward the left.
- Behind Mongle, blurred: the edges of the crowded bowls.
Only Mongle in this panel, nobody else."""),
    # c7 — 반전: 사장님이 크게 웃으며 손사래 · 동전과 지갑을 몽글 쪽으로 되민다(가깝게)
    'a7': ('', """CAMERA: MEDIUM CLOSE on the owner, eye level, fixed.
- The TOP 20% of the image is plain brick-red felt wall with one lantern — keep it otherwise empty for titles.
- THE OWNER is centred at 40% of the width, seen from the chest up, his head at about 22–40% of the height, laughing warmly with his eyes squeezed into happy curves and his mouth open in a laugh; his raised right felt hand is palm-out in a friendly 'no, no' wave and his left felt hand is gently sweeping the heap of gold felt coins and the yellow wallet back across the crowded table toward the right.
- The crowded table edge fills the lower 30%: the jjamppong bowl and tangsuyuk plate partly in frame.
- MONGLE is seen at the far RIGHT edge, centred at 86% of the width, its bottom hem at about 92% of the height, only its upper half in frame, looking up at the owner, bead eyes round.
Only the owner and Mongle in this panel, nobody else."""),
    # c8 — 풀림: 몽글 별눈 · 안도로 바람 빠지듯 납작(가깝게)
    'a8': ('(3) mascot reference — Mongle\'s sparkling star eyes, ', """CAMERA: CLOSE on Mongle at table level, fixed.
- The TOP 20% of the image is the plain brick-red felt wall, softly out of focus — keep it empty for titles.
- MONGLE is centred at 55% of the width, its bottom hem at about 82% of the height, about 44% of the image width wide, its body slightly flattened and relaxed as if it just let out a big breath, cheeks rosy, its eyes two sparkling felt star shapes, a small happy open felt mouth.
- The yellow wallet lies closed again right in front of Mongle, the gold felt coins tucked back beside it.
- Behind Mongle, softly blurred: the crowded dishes and one lantern glow.
Only Mongle in this panel, nobody else."""),
    # c9 — 끝 새 사건: 다 먹은 빈 그릇들 사이에서 몽글이 빈 접시를 머리에 얹어 내민다(가깝게 · 중간)
    'a9': ('(3) mascot reference — Mongle\'s happy smiling eyes, ', """CAMERA: MEDIUM on the table from Mongle's side, eye level, fixed.
- The TOP 20% of the image is plain brick-red felt wall with one lantern — keep it otherwise empty for titles.
- The table is now full of EMPTY white felt plates and bowls stacked in two short leaning piles — every dish finished, only a few felt crumbs left.
- MONGLE sits in front, centred at 58% of the width, its bottom hem at about 84% of the height, about 30% of the image width wide, stretched tall and bouncy, balancing ONE empty white felt plate on top of its head and tilting it toward the left as if offering it up, eyes happy upward curves, cheeks rosy, a small cheeky smiling felt mouth.
- THE OWNER is seen at the LEFT edge from the waist up, centred at 14% of the width, his head at about 26–38% of the height, still smiling, looking at Mongle.
Only the owner and Mongle in this panel, nobody else."""),
    # c10 — 사장님 웃음이 굳고 계산서 종이를 내민다(아주 가깝게)
    'a10': ('', """CAMERA: VERY CLOSE on the owner's face and hand, eye level, fixed.
- The TOP 16% of the image is plain brick-red felt wall — keep it empty for titles.
- THE OWNER's face is centred at 46% of the width, his head at about 20–50% of the height, his smile frozen stiff in an awkward fixed grin, one matte felt sweat bead at his temple, eyebrows slightly raised.
- In the lower part of the frame his right felt hand holds out, toward the camera, a small plain cream felt paper slip (the bill) with three short stitched lines on it — no letters, no numbers.
Only the owner in this panel, nobody else."""),
    # c11 — 끝: 계산서 앞에서 굳은 몽글(가깝게)
    'a11': ('(3) mascot reference — Mongle\'s worried teary eyes, ', """CAMERA: CLOSE on Mongle, eye level, fixed.
- The TOP 20% of the image is the plain brick-red felt wall, softly out of focus — keep it empty for titles.
- MONGLE is centred at 56% of the width, its bottom hem at about 84% of the height, about 42% of the image width wide, frozen stiff and pale, the empty plate still on its head, bead eyes huge, a tiny shocked straight felt mouth.
- On the table right in front of Mongle lies the small plain cream felt paper slip with three short stitched lines (the bill), no letters, no numbers.
- Behind, softly blurred: the stacks of empty plates.
Only Mongle in this panel, nobody else."""),
}

here = os.path.dirname(os.path.abspath(__file__))
for k, (extra, cam) in PANELS.items():
    with io.open(os.path.join(here, f'{k}.txt'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(HEAD + '\n' + WORLD + '\n' + REF.format(extra=extra) + '\n\n' + cam + '\n' + TAIL)
print('ok', list(PANELS))
