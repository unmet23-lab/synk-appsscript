# E62 「아까워」 판 지시문 — 머리(공통) + 판마다 장면 + 꼬리(공통)를 합쳐 판/<이름>.txt로 쓴다(E58 _지시문만들기.py를 본떴다).
# 쓰는 법: python -I -X utf8 _지시문만들기.py <판 폴더> [이름…]
# 핵심 장면(한 장면 먼저 v1): 아주머니가 철판을 치우려 들어 올림(p1 · p2) → 몽글이 뛰어올라 철판 가장자리에 매달림(p3) → 몽글 아주 가까이 「아까워!」(p4)
# → 아주머니 가까이 — 굳음(p5) → 웃음이 번짐(p6). 몽글을 움직일 판(p1 · p2 · p3 · p4)은 몽글만 지운 빈 판(_plate)을 같은 엔진으로 굽고 tools/층나누기.py로 층을 나눈다.
# v1 판은 철판 · 볶음밥이 실사처럼 구워져(그림 검사 「실사 섞임」 6장) 재질.txt(철판 · 볶음밥 · 그릇을 펠트로)로 고쳐 구웠고(p1m~p6m),
# p1 눈물 · p5 · p6 볶음밥은 눈물결.txt · 밥결.txt로 한 번 더 고쳤다(p1n · p5n · p6n). 빈 판은 고친 판에서 구웠다. 아래 WORLD는 그 뒤 처음부터 펠트로 굽게 고친 글이다.
import sys
from pathlib import Path

HEAD = """Use your image generation tool to create exactly ONE image. Do not write code, do not edit files, do not run shell commands. After the image is generated, reply with one short line describing it.

IMAGE BRIEF — one panel of a vertical comedy short: a needle-felt miniature diorama photo, portrait 2:3, warm evening light from a low hanging lamp, shallow depth of field, cosy handmade felt-and-wool textures everywhere (copy only the craft style, light and scale of the felt reference photo — NOT its café, NOT its barista).

WORLD (real panels): a tiny felt Korean snack restaurant (bunsik-jip) in the evening — walls of plain soft mint-green felt tiles (large tiles, no pattern on them), a light honey-wood felt table, a small counter far behind with a felt water jug and a short stack of plain cream felt bowls, one warm felt pendant lamp. In the middle of the table sits a RECTANGULAR GRIDDLE TRAY made of needle-felted dark charcoal-grey wool (a flat tray with a low, thick, rounded rim and one short loop handle on its left end and one on its right end — matte fuzzy wool, NO metal, NO shine, NO scratches). The griddle has been scraped almost clean: only ONE small mound — a single spoonful — of golden egg-and-vegetable fried rice is left near its centre, made of fuzzy matte felted wool (pale golden wool with a few felted green peas, orange carrot cubes and yellow egg bits, NO meat at all, NO gloss), with a few small flat brown felt flakes (scorched rice) beside it.
CHARACTERS (keep them identical in every panel they appear in):
- THE AJUMMA: the restaurant owner, a Korean felt doll woman in her fifties with short wavy dark-brown felt hair under a plain solid tomato-red felt headscarf tied at the back, a round kind face, small black bead eyes, rosy cheeks and soft smile lines. She wears a mustard-yellow felt apron over a sage-green knit sweater, and thick quilted cream felt oven mitts on BOTH hands (she always holds the hot griddle by its two loop handles with the mitts).
- MONGLE: a small coral-pink felt blob mascot — use the mascot reference ONLY for its body shape, coral wool colour, fuzzy texture, scalloped bottom hem with a cream running stitch and glossy black bead eyes (no white sclera). Mongle has NO arms, NO legs, NO hands, NO neck and NO mouth, ever — its head and body are one soft dome. It moves by tilting, squashing, stretching and bouncing its whole body. Mongle is about as tall as the griddle is deep from front to back.
"""

FRIEND = """- THE FRIEND: a Korean felt doll young man in his twenties with short messy black felt hair, a round face and small black bead eyes, wearing a navy felt duffel coat over a cream knit sweater."""

TAIL = """
Only the characters named in this panel, nobody else (no other customers). Absolutely no text, letters, numbers, symbols, question marks or watermarks anywhere — not on the walls, not on the menu, not on the counter, not on the apron. No real brand, no logos. No dense dotted or ring patterns anywhere."""

PLATE = """Edit the attached photograph. Return the SAME photograph with exactly one thing removed: {what}.

Where it was, show what was behind it: {behind}.

Keep everything else exactly as it is: the same tall 2:3 framing and size, the same camera position, the same lighting, colors, wool fibers and depth of field. Every remaining object and person stays in exactly the same place, pose and size. Do not add any new object, character, text, letter or symbol. The result must look like the same photograph with that one thing simply not there."""

PANELS = {
    'p1': ("Attached images in order: (1) mascot reference — Mongle's shape and colour, (2) mascot reference — Mongle's teary longing bead eyes, (3) felt craft-style reference.",
           FRIEND + """

CAMERA: MEDIUM, eye level just above the table top, a little from the right, fixed. This is the BASE panel of the restaurant.
- The TOP 24% of the image is plain mint-green felt tile wall with nothing in it — keep it empty for titles.
- THE AJUMMA stands behind the table, centred at 40% of the image width, her head at about 28–38% of the image height, bending forward with a busy friendly smile; her two oven-mitted hands are just closing around the griddle's left and right loop handles, about to lift it away.
- The table top fills the lower half. The griddle sits on it centred at 44% of the width, between 58% and 70% of the image height, seen a little from above so the last spoonful of fried rice on it is clearly visible.
- MONGLE sits on the table top to the right of the griddle, centred at 76% of the width, its bottom hem at about 82% of the height, about 22% of the image width wide, leaning toward the griddle and staring at the last spoonful of fried rice with big round longing teary bead eyes (one tiny felt tear at the corner of an eye).
- THE FRIEND stands in the soft-focus background at the right, behind Mongle, seen from the waist up, pushing one arm into the sleeve of his navy coat — ready to leave.
- Keep every character between 12% and 88% of the image width."""),
    'p1_plate': ("", PLATE.format(what="the small coral-pink needle-felted ghost-shaped blob (Mongle) sitting on the right side of the table top", behind="the same felt table top continuing naturally where it sat, and the same soft-focus background (the friend in his navy coat, the counter, the mint-green tiles) continuing behind it")),
    'p2': ("Attached images in order: (1) the base restaurant panel — reproduce its camera, framing, table, griddle, light, the ajumma, the friend and Mongle EXACTLY, (2) mascot reference.",
           FRIEND + """

CAMERA: the same MEDIUM, eye-level camera as the first attached image, half a second later:
- THE AJUMMA has LIFTED the griddle a full hand-width above the table with both oven mitts, tilting it slightly toward herself, still smiling and busy. The last spoonful of fried rice has slid a little toward the near rim.
- MONGLE, at the same spot on the right (centred at 76% of the width), is SQUASHED low and wide like a spring about to jump — its dome pressed down, leaning hard toward the lifted griddle, its bead eyes wide and fixed on the fried rice.
- THE FRIEND in the soft-focus background has his coat on now and looks over his shoulder.
- The TOP 24% of the image is plain mint-green felt tile wall with nothing in it."""),
    'p2_plate': ("", PLATE.format(what="the small coral-pink needle-felted ghost-shaped blob (Mongle) squashed low on the right side of the table top", behind="the same felt table top continuing naturally where it sat, and the same soft-focus background (the friend in his navy coat, the mint-green tiles) continuing behind it")),
    'p3': ("Attached images in order: (1) the lifted-griddle panel — the same restaurant, light, ajumma, griddle and fried rice, (2) mascot reference — Mongle's shape and colour, (3) mascot reference — Mongle's eyes squeezed shut as two stitched > < lines.",
           """CAMERA: MEDIUM-CLOSE, low angle from just above table height at the front-right corner of the table, looking a little UP, fixed:
- THE AJUMMA, waist-up, in the left half of the frame (her face centred at about 36% of the width and 30–38% of the height), holds the griddle up in front of her chest with both oven mitts by its two loop handles. She is STARTLED and leaning back: eyebrows up, eyes round, lips in a small surprised "o".
- The griddle is tilted toward the camera so its dark surface and the last spoonful of fried rice are visible.
- MONGLE CLINGS TO THE NEAR RIM of the griddle, on the right side of the griddle (centred at 62% of the width): Mongle keeps its plump round dome shape (NOT flat, NOT like a towel or a cloth). The dark iron rim crosses Mongle's body a little BELOW its eyes — the top of its dome, with its face, leans over the rim onto the griddle side and presses down on it, as if hugging the rim with its chin, while its round plump lower body bulges and hangs in the empty air outside the rim, its scalloped hem swinging. Its eyes are squeezed tightly shut as two short dark stitched > < lines (fierce, desperate determination), one small felt tear at the corner of an eye. Mongle is clearly NOT touching the table — there is empty air under it, and the ajumma's mitts stay on the two handles.
- The TOP 24% of the image is plain mint-green felt tile wall with nothing in it."""),
    'p3_plate': ("", PLATE.format(what="the small coral-pink needle-felted ghost-shaped blob (Mongle) clinging to the near rim of the griddle, its face over the rim and its round body hanging below", behind="the same thick charcoal-grey felt rim of the griddle continuing straight and unbroken where Mongle was clinging to it, the same griddle surface and fried rice, and the same soft background (mint-green tiles, the mustard apron) continuing below the griddle where Mongle's body was")),
    'p4': ("Attached images in order: (1) the clinging panel — the same griddle rim, the same Mongle clinging pose and the same restaurant light, (2) mascot reference — Mongle's shape and colour, (3) mascot reference — Mongle's eyes squeezed shut as two stitched > < lines.",
           """CAMERA: EXTREME CLOSE-UP on MONGLE's face, LOW ANGLE from slightly below and a little from the right (a different, much closer camera than the first attached image):
- The dark black iron rim of the griddle runs across the frame slightly diagonally at about 50–56% of the image height (lower on the left).
- MONGLE clings to it exactly like in the first attached image, keeping its plump round dome shape (NOT flat, NOT like a towel or a cloth): its face and the top of its round dome are ABOVE the rim, pressing its chin down on the rim, and its round plump lower body bulges and hangs in the air BELOW the rim. Mongle fills the middle of the frame — about 64% of the image width, centred at 52% of the width, its eyes at about 42% of the height.
- Its eyes are squeezed tightly shut as two short dark stitched > < lines, two small felt tear drops at the corners of its eyes, its whole body tense and quivering, pleading — please don't take it away.
- Just behind Mongle's face, on the griddle surface, the last spoonful of golden egg-and-vegetable fried rice sits slightly out of focus.
- Behind, a soft warm blur of the mint-green tiles, the warm pendant lamp glow and the ajumma's mustard apron out of focus at the left edge.
- The TOP 24% of the image is soft warm blur with nothing sharp in it."""),
    'p4_plate': ("", PLATE.format(what="the coral-pink needle-felted ghost-shaped blob (Mongle) clinging to the griddle rim and filling the middle of the frame", behind="the same thick charcoal-grey felt rim of the griddle continuing straight and unbroken across the frame where Mongle was clinging to it, the same out-of-focus spoonful of fried rice on the griddle surface, and the same soft warm blur (mint-green tiles, warm lamp glow, the out-of-focus mustard apron) continuing above and below it where Mongle's body was")),
    'p5': ("Attached images in order: (1) the base restaurant panel — the ajumma must look exactly like in it (same face, red headscarf, mustard apron, sage sweater, cream oven mitts), (2) the hanging panel — the same griddle held up the same way.",
           """CAMERA: CLOSE-UP on THE AJUMMA, chest-up, at her eye level, from the LEFT side in a three-quarter view (a different side from the hanging panel):
- Her face fills the upper-middle of the frame (centred at about 46% of the width, between 26% and 52% of the height). She is FROZEN in surprise, looking down toward the lower right: eyebrows raised high, bead eyes wide, lips pressed into a tiny "o". Her shoulders are stiff.
- At the bottom of the frame her two oven mitts hold the griddle's rim, and at the bottom-right edge the soft out-of-focus top of Mongle's coral dome is draped over the griddle rim.
- Behind her, soft blurred mint-green tiles and the warm pendant lamp glow.
- The TOP 24% of the image is soft blurred mint-green wall with nothing sharp in it."""),
    'p6': ("Attached images in order: (1) the ajumma close-up panel — reproduce its camera, framing, light, griddle and the ajumma EXACTLY.",
           """Same camera as the attached image, one second later: THE AJUMMA's frozen surprise MELTS into a warm, amused, touched smile — her eyes crinkle into happy curved lines, her cheeks get rosier, her head tilts a little to one side, and her shoulders relax. Everything else (framing, griddle, mitts, the blurred coral dome of Mongle at the bottom-right edge, background) stays the same. The TOP 24% of the image is soft blurred mint-green wall with nothing sharp in it."""),
}

BR = chr(10)
out = Path(sys.argv[1])
only = set(sys.argv[2:])
for name, (refs, body) in PANELS.items():
    if only and name not in only:
        continue
    if name.endswith('_plate'):
        text = HEAD.split(BR + BR)[0] + BR + BR + body + BR
    else:
        text = HEAD + BR + refs + BR + BR + body + BR + TAIL + BR
    (out / f'{name}.txt').write_text(text, encoding='utf-8')
    print(name)
