# M76 「놀랐을 때 네 마디」 시작 그림 지시문 — 샷마다 같은 세계 · 같은 인물 글을 붙인다(11-25 07시 회차).
# 굽기: node tools/그림굽기.js docs/마케팅/LAB_놀랐을때_mn_20261125 판/<샷>.txt <샷> 판/참고/몽글_정본_본체.jpg [표정] 판/참고/결_미안n3.jpg
# 구운 2:3 판은 판/_시작맞추기.py가 9:16(1080×1920)으로 맞춰 영상칸/시작/<샷>.jpg로 둔다.
import io, os

HEAD = """Use your image generation tool to create exactly ONE image. Do not write code, do not edit files, do not run shell commands. After the image is generated, reply with one short line describing it.

IMAGE BRIEF — one panel of a vertical comedy short: a needle-felt miniature diorama photo, portrait 2:3, shallow depth of field, cosy handmade felt-and-wool textures everywhere (copy only the craft style and scale of the felt reference photo — NOT its room, NOT its people).
"""

WORLD = """WORLD (same in every panel): the inside of a cute, bright-ish amusement-park HAUNTED HOUSE made entirely of needle felt — walls of plain deep plum-purple felt, a floor of dark teal felt, soft warm light from small round amber felt lanterns inside the scene plus a gentle mint-green glow, playful rather than truly scary. Every prop is matte wool felt (no shine, nothing realistic).
MATERIAL RULE: everything is needle-felted wool, completely matte; nothing looks like real plastic, bone or fur. No blood, no gore, nothing grotesque.
MONGLE: a small coral-pink felt blob mascot — use the mascot reference ONLY for its body shape, coral wool colour, fuzzy texture, scalloped bottom hem with a cream running stitch and glossy black bead eyes (no white sclera). Mongle has NO arms, NO legs, NO hands, NO neck and NO mouth, ever — its head and body are one soft dome. It moves by tilting, squashing, stretching and bouncing its whole body. Mongle sits on the teal felt floor.
"""

TAIL = """
Keep every character between 12% and 88% of the image width. Absolutely no text, letters, numbers, symbols, question marks or watermarks anywhere — no signs with writing. No real brand, no logos. No dense dotted or ring patterns anywhere. Mongle's eyes stay plain glossy black beads with no white sclera.
"""

PANELS = {
    'h1': ("Attached images in order: (1) mascot reference — Mongle's shape and colour, (2) felt craft-style reference.",
"""ROOM 1 — CAMERA: MEDIUM, at Mongle's eye level, fixed.
- The TOP 22% of the image is plain plum-purple felt wall — keep it empty for titles.
- In the centre-left of the floor (centred at 38% of the width, its base at about 78% of the height) stands a big closed felt jack-in-the-box: a cube of mustard-yellow felt with a plain teal lid and a small crank on its side.
- MONGLE sits on the floor to the RIGHT of the box, centred at 68% of the width, its bottom hem at about 82% of the height, about 22% of the image width wide, leaning a little toward the box, curious, bead eyes round.
- One small amber felt lantern hangs at the upper right.
Only Mongle and the box in this panel, nobody else."""),
    'h2': ("Attached images in order: (1) mascot reference — Mongle's shape and colour, (2) felt craft-style reference.",
"""ROOM 2 — CAMERA: MEDIUM, at Mongle's eye level, fixed — the next room of the same haunted house.
- The TOP 22% of the image is plain plum-purple felt wall — keep it empty for titles.
- On the LEFT (centred at 34% of the width) a cute felt HOUSE GHOST — a white wool-felt sheet ghost with two round black bead eyes and a small round 'o' mouth, no arms showing except two soft rounded felt sleeve tips — sits on a little felt stool, completely relaxed, holding a white felt bowl of cream wool-felt noodles in front of it with a pair of plain light-brown felt chopsticks (wrapped in matte wool, no wood grain, no shine), slurping noodles. It is not scary at all, just eating its snack on break.
- MONGLE sits on the floor on the RIGHT, centred at 70% of the width, its bottom hem at about 82% of the height, about 22% of the image width wide, staring at the snacking ghost completely deadpan ('no way…'): its body sits perfectly still with exactly the mascot reference proportions, and its two plain round glossy black bead eyes look straight at the ghost, unblinking — the eyes stay fully round and uncovered, no eyelids, no felt flaps over them.
- A small amber felt lantern glows on the wall between them.
Only Mongle and the house ghost in this panel, nobody else."""),
    'h3': ("Attached images in order: (1) mascot reference — Mongle's shape and colour, (2) mascot reference — Mongle's eyes squeezed shut, (3) felt craft-style reference.",
"""ROOM 3 — CAMERA: MEDIUM CLOSE on Mongle, at its eye level, fixed — the next room of the same haunted house.
- The TOP 20% of the image is plain plum-purple felt wall — keep it empty for titles.
- MONGLE sits on the floor in the centre, centred at 52% of the width, its bottom hem at about 84% of the height, about 34% of the image width wide, eyes squeezed shut into two short dark stitched lines, its coral wool flushing red, trembling.
- Right in front of Mongle's face, slightly to the left (centred at 36% of the width, at about 52% of the height), a big round fuzzy charcoal-grey felt SPIDER hangs upside-down on a single thin wool thread from the ceiling: a round fluffy body, eight short bendy felt legs, two simple glossy black bead eyes. Cute-creepy, not realistic.
Only Mongle and the felt spider in this panel, nobody else."""),
    'h4': ("Attached images in order: (1) mascot reference — Mongle's shape and colour, (2) mascot reference — Mongle's teary worried eyes, (3) felt craft-style reference.",
"""ROOM 4 — CAMERA: MEDIUM, at Mongle's eye level, fixed — the last room of the same haunted house, now very dark.
- The TOP 22% of the image is plain dark plum-purple felt wall — keep it empty for titles.
- The lights are almost out: only one small amber felt lantern glows faintly at the upper left; everything else is deep shadowy plum and teal.
- On the LEFT side stands a tall dark-brown felt DOOR (centred at 30% of the width, from 30% to 85% of the height) with a round brass-coloured felt knob, firmly shut — a small soft green glow leaks from its bottom edge.
- MONGLE sits on the floor on the RIGHT, centred at 66% of the width, its bottom hem at about 84% of the height, about 24% of the image width wide, turned toward the shut door, bead eyes big, round and worried, with one small matte pale-blue felt teardrop bead at the corner of an eye (wool, not transparent), lit softly by the lantern.
Only Mongle in this panel, nobody else."""),
    'h5': ("Attached images in order: (1) mascot reference — Mongle's shape and colour, (2) felt craft-style reference.",
"""END — CAMERA: MEDIUM-WIDE, at about chest height of a person, fixed — a dark corner of the same haunted house by the exit.
- The TOP 18% of the image is plain dark plum-purple felt wall — keep it empty for titles.
- THE STAFF MEMBER: a Korean felt doll young man in his twenties dressed in a white felt sheet-ghost costume with the hood pushed back off his head, so his round face, short black felt hair and small black bead eyes are clearly visible, and a mint-green felt staff lanyard card hanging on his chest (the card is plain, with no writing). He stands on the LEFT, centred at 34% of the width, seen from the knees up, his head at about 26–38% of the height, crouching a little and peeking around the corner of the wall, ready to jump out and scare visitors.
- MONGLE sits on the floor on the RIGHT, centred at 70% of the width, its bottom hem at about 84% of the height, about 22% of the image width wide and a little WIDER than it is tall (a low, soft dome exactly like the mascot reference proportions), coming around the same corner from the other side, its coral wool glowing softly in the dark, bead eyes round and innocent.
- One small amber felt lantern glows above them; a soft green glow comes from the exit on the far right.
Only the staff member and Mongle in this panel, nobody else."""),
}

here = os.path.dirname(os.path.abspath(__file__))
for k, (refs, cam) in PANELS.items():
    with io.open(os.path.join(here, f'{k}.txt'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(HEAD + '\n' + WORLD + '\n' + refs + '\n\n' + cam + '\n' + TAIL)
print('ok', list(PANELS))
