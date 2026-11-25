# E64 「서비스」 시작 그림 지시문 — 샷마다 같은 세계 · 같은 인물 글을 붙인다(11-25 07시 회차).
# 굽기: node tools/그림굽기.js docs/마케팅/LAB_서비스_20261125 판/<샷>.txt <샷> 판/참고/몽글_정본_본체.jpg 판/참고/<표정>.jpg 판/참고/결_미안n3.jpg
# 구운 2:3 판은 판/_시작맞추기.py가 9:16(1080×1920)으로 잘라 영상칸/시작/<샷>.jpg로 둔다.
import io, os

HEAD = """Use your image generation tool to create exactly ONE image. Do not write code, do not edit files, do not run shell commands. After the image is generated, reply with one short line describing it.

IMAGE BRIEF — one panel of a vertical comedy short: a needle-felt miniature diorama photo, portrait 2:3, warm evening light from two low hanging red felt lanterns inside the scene, shallow depth of field, cosy handmade felt-and-wool textures everywhere (copy only the craft style, light and scale of the felt reference photo — NOT its room, NOT its people).
"""

WORLD = """WORLD (same in every panel): a tiny felt Korean-Chinese neighbourhood restaurant (jungguk-jip) in the evening — walls of plain warm brick-red felt, two round plain red felt lanterns hanging low (no tassels with many threads, no characters on them), a dark walnut-brown felt round table with a plain cream felt top, a plain wooden felt chair edge here and there. On the table in front of Mongle: a white felt bowl of jjajangmyeon (thick cream wool-felt noodles under a lumpy dark-brown WOOL FELT black-bean sauce with a few thin green felt cucumber strips on top, half eaten — the sauce is fuzzy needle-felted wool, completely matte, NO gloss, NO wet shine, NO oil), a pair of plain wooden felt chopsticks, and MONGLE'S WALLET — a small flat plain mustard-yellow felt wallet with one stitched flap (no button, no pattern, no logo).
MATERIAL RULE: every food in this world is needle-felted wool — the pan-fried dumplings (gun-mandu) are matte golden-brown felt pouches with stitched pleats and a slightly darker felt crust, NO oil shine, NO glossy highlights, they must not look like real food. Liquids and tears are tiny matte felt beads, never transparent.
CHARACTERS (keep them identical in every panel they appear in):
- THE OWNER: the restaurant owner, a Korean felt doll man in his fifties with a round friendly face, short salt-and-pepper felt hair, a small neat dark felt moustache, small black bead eyes and rosy cheeks. He wears a white felt chef's jacket with two cloth-covered buttons, a plain tomato-red felt apron, and a short white felt chef's cap. He has two felt hands.
- MONGLE: a small coral-pink felt blob mascot — use the mascot reference ONLY for its body shape, coral wool colour, fuzzy texture, scalloped bottom hem with a cream running stitch and glossy black bead eyes (no white sclera). Mongle has NO arms, NO legs, NO hands, NO neck and NO mouth, ever — its head and body are one soft dome. It moves by tilting, squashing, stretching and bouncing its whole body. Mongle sits ON the table top, about as tall as the jjajangmyeon bowl is wide.
"""

TAIL = """
Keep every character between 12% and 88% of the image width. Absolutely no text, letters, numbers, symbols, question marks or watermarks anywhere — not on the walls, not on the lanterns, not on the apron, not on the wallet. No real brand, no logos. No dense dotted or ring patterns anywhere. Mongle's eyes stay plain glossy black beads with no white sclera.
"""

PANELS = {
    's1': ("Attached images in order: (1) mascot reference — Mongle's shape and colour, (2) felt craft-style reference.",
"""CAMERA: MEDIUM-WIDE, eye level just above the table top, fixed. This is the BASE panel of the restaurant.
- The TOP 22% of the image is plain brick-red felt wall with only the two lanterns at its lower edge — keep it otherwise empty for titles.
- THE OWNER stands behind the table on the LEFT, centred at 32% of the image width, his head at about 26–36% of the image height, leaning forward with a big warm proud grin; with both felt hands he is just setting down a white felt plate of six matte golden-brown felt pan-fried dumplings (gun-mandu, stitched pleats, no shine) on the BACK half of the table, centred at 44% of the width, at about 62% of the height.
- The table top fills the lower half (from about 55% of the height down).
- MONGLE sits on the table top on the RIGHT, centred at 70% of the width, its bottom hem at about 74% of the height, about 22% of the image width wide, looking at the dumpling plate with round bead eyes, surprised and a little puzzled, its body tilted slightly toward the owner.
- The half-eaten jjajangmyeon bowl is on the table just right of Mongle (centred at 86% of the width, a little behind it). MONGLE'S WALLET lies flat on the FRONT of the table just LEFT of Mongle's hem, almost touching it (centred at 54% of the width, at about 80% of the height), on an empty stretch of cream felt table between Mongle and the owner, clearly visible — the dumpling plate is further back, not between the wallet and the owner.
Only the owner and Mongle in this panel, nobody else."""),
    's2': ("Attached images in order: (1) mascot reference — Mongle's shape and colour, (2) mascot reference — Mongle's teary worried eyes, (3) felt craft-style reference.",
"""CAMERA: MEDIUM CLOSE on the table, eye level with Mongle, fixed — the same restaurant and the same moment as the base panel, a step closer.
- The TOP 20% of the image is plain brick-red felt wall (one lantern's lower edge may show) — keep it empty for titles.
- THE OWNER is seen only from the chest down on the LEFT edge (his white chef's jacket and plain tomato-red apron), between 0% and 22% of the image width — he is clearly standing right there. His right felt hand rests flat on the table top, palm down, at about 20% of the width and 74% of the height.
- The white felt plate of six matte golden-brown felt pan-fried dumplings sits FURTHER BACK on the table, centred at 44% of the width, at about 60% of the height — it is NOT between Mongle and the owner's hand.
- MONGLE'S WALLET lies flat on the front of the table, centred at 50% of the width, at about 78% of the height — on a clear, empty stretch of cream felt table that runs straight from Mongle to the owner's resting hand.
- MONGLE sits on the table top on the right, centred at 72% of the width, its bottom hem at about 82% of the height, about 28% of the image width wide, its hem almost touching the right edge of the wallet, a little flushed, bead eyes wide and worried, one small matte pale-blue felt sweat bead on its side (wool, not transparent).
- The half-eaten jjajangmyeon bowl is behind Mongle on the right (centred at 88% of the width, at about 62% of the height), partly cut off.
Only the owner's torso and hand and Mongle in this panel, nobody else."""),
    's3': ("Attached images in order: (1) mascot reference — Mongle's shape and colour, (2) felt craft-style reference.",
"""CAMERA: MEDIUM on the owner across the table, eye level, fixed — the same restaurant and the same table.
- The TOP 20% of the image is plain brick-red felt wall with one lantern — keep it otherwise empty for titles.
- THE OWNER stands behind the table, centred at 40% of the image width, seen from the waist up, his head at about 24–36% of the image height, laughing warmly with his eyes squeezed into happy curves; one felt hand is raised palm-out in a friendly 'no, no' wave and the other hand rests on MONGLE'S WALLET on the table, gently sliding it back toward Mongle.
- The white felt plate of six golden-brown felt pan-fried dumplings sits on the table centred at 44% of the width, at about 64% of the height.
- MONGLE'S WALLET lies on the table under the owner's hand, centred at 58% of the width, at about 70% of the height.
- MONGLE sits on the table top at the RIGHT, centred at 80% of the width, its bottom hem at about 84% of the height, about 20% of the image width wide, looking up at the owner, puzzled, bead eyes round.
Only the owner and Mongle in this panel, nobody else."""),
    's4': ("Attached images in order: (1) mascot reference — Mongle's shape and colour, (2) felt craft-style reference.",
"""CAMERA: WIDE across the little restaurant, eye level a little above the tables, fixed — the same restaurant, a few minutes later.
- The TOP 18% of the image is plain brick-red felt wall with the two lanterns — keep it otherwise empty for titles.
- BACKGROUND, upper-middle: a second dark walnut-brown felt round table with a plain cream felt top, centred at 36% of the width, its top at about 46% of the height. At it sits A NEW CUSTOMER — a felt doll young man in his twenties, a tourist with short light-brown felt hair, a round face, small black bead eyes, a sky-blue felt hoodie and a small orange felt backpack on the chair beside him — seen from the waist up, centred at 30% of the width, his head at about 32–40% of the height. On his table in front of him: a white felt bowl of jjajangmyeon and his own small flat plain green felt wallet. THE OWNER stands beside that table on its right (centred at 50% of the width, his head at about 28–37% of the height), just setting down a white felt plate of golden-brown felt pan-fried dumplings in front of the tourist with the same proud grin.
- FOREGROUND, lower right: Mongle's own table top (the cream felt top fills the bottom 30% of the image). MONGLE sits on it centred at 70% of the width, its bottom hem at about 86% of the height, about 24% of the image width wide, turned a little toward the tourist's table, calm knowing glossy black bead eyes (no white sclera), a little flushed; in front of it the white felt plate with only two golden-brown felt dumplings left, and MONGLE'S WALLET lying flat beside the plate.
Only the owner, the tourist and Mongle in this panel, nobody else."""),
}

here = os.path.dirname(os.path.abspath(__file__))
for k, (refs, cam) in PANELS.items():
    with io.open(os.path.join(here, f'{k}.txt'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(HEAD + '\n' + WORLD + '\n' + refs + '\n\n' + cam + '\n' + TAIL)
print('ok', list(PANELS))
