# E57 「목 · 손목 · 발목」 판 지시문 — 머리(공통) + 판마다 장면 + 꼬리(공통)를 합쳐 판/<이름>.txt로 쓴다.
# 쓰는 법: python -I -X utf8 _지시문만들기.py <판 폴더>
import sys
from pathlib import Path

HEAD = """Use your image generation tool to create exactly ONE image. Do not write code, do not edit files, do not run shell commands. After the image is generated, reply with one short line describing it.

IMAGE BRIEF — one panel of a vertical comedy short: a needle-felt miniature diorama photo, portrait 2:3, soft warm dusk light, shallow depth of field, cosy handmade felt-and-wool textures everywhere (copy only the craft style, light and scale of the felt reference photo — NOT its café, NOT its barista).

WORLD (same in every panel): a tiny snowy felt street at dusk — soft white felt snow on the ground, little felt houses with warm glowing windows, a felt pine tree and an old felt street lamp, a dusky blue-violet sky. No snowflakes in the air.
CHARACTERS (same in every panel):
- THE FRIEND: a Korean felt doll young man with short neat black felt hair, a round friendly face, small black bead eyes, rosy cheeks. He wears a dark sage-green felt duffel coat whose sleeves are a little too short (his bare wrists show), brown felt trousers cropped above the ankle (his bare ankles show above short white socks), and small brown felt shoes. His three winter pieces are all the SAME mustard-yellow chunky hand-knit wool: one long scarf, two wrist warmers, and two long knee socks.
- MONGLE: a small coral-pink felt blob mascot — use the mascot reference ONLY for its body shape, coral wool colour, fuzzy texture, scalloped bottom hem with a cream running stitch and glossy black bead eyes (no white sclera; closed eyes are two short curved dark stitched lines). Mongle has NO arms, NO legs, NO hands and NO neck, ever — its head and body are one soft dome. It moves by tilting, squashing and bouncing its whole body.
"""

TAIL = """
Exactly ONE friend and exactly ONE Mongle, nobody else. Absolutely no text, letters, numbers, symbols, question marks or watermarks anywhere. No real brand, no logos."""

PANELS = {
    's1': ("Attached images in order: (1) mascot reference, (2) felt craft-style reference.",
           """CAMERA: WIDE, eye level, straight-on, fixed. This is the BASE panel of the street.
- The TOP 24% of the image is plain dusky blue-violet sky with nothing in it (no lamp, no roof, no tree tops) — keep it empty for titles.
- THE FRIEND stands on the snow, full body, centred at 36% of the image width; his head is at about 30–38% of the image height and his shoes at about 86%. He is SHIVERING: shoulders hunched up, knees together, teeth clenched in a wobbly grimace, eyebrows up. He holds the long mustard scarf bunched in both hands in front of his chest — it is NOT on him yet. His neck is bare (coat collar open), his bare wrists show below the short sleeves, his bare ankles show between the cropped trousers and the short white socks. He wears no wrist warmers and no long socks yet.
- MONGLE sits on the snow to his right, centred at 72% of the width, its bottom hem on the snow at about 86% of the height, about 22% of the image width wide, looking up at the friend with worried round eyes.
- Keep both characters between 10% and 90% of the image width."""),
    's2': ("Attached images in order: (1) the base street panel — THE FRIEND must look exactly like the man in it (same face, hair, coat), (2) mascot reference.",
           """CAMERA: CHEST-UP CLOSE on the friend, slightly low angle, a little from his left — his head and shoulders fill the middle of the frame; the snowy street with warm windows is a soft blur behind him. The TOP 22% of the image is soft blurred dusky sky with nothing in it.
- He is in the middle of WRAPPING the long mustard scarf around his bare neck: one loop is already around his neck and his right hand is swinging the long end over his left shoulder, the end flying in the air. His eyes are squeezed shut in relief, a big cosy smile, cheeks very rosy, a little puff of warm breath.
- Mongle is NOT in this panel."""),
    's2b': ("Attached images in order: (1) the previous close panel — reproduce it EXACTLY (same camera, framing, light, blur, same man), (2) the base street panel for the friend's face and coat.",
            """Same chest-up close camera as the first attached image, a split second later: the mustard scarf is now wrapped snugly twice around his neck, both ends hanging down his chest. He tucks his chin into the scarf, eyes open and happy, patting the scarf with one mitten-less hand, his bare wrist showing below the short sleeve.
- Mongle is NOT in this panel."""),
    's3a': ("Attached images in order: (1) the base street panel — the friend's coat, sleeves and the mustard knit must match it, (2) the chest-up panel with the scarf on.",
            """CAMERA: CLOSE-UP from ABOVE, as if looking down from the friend's own eyes at his two hands in front of his tummy — his felt forearms, the too-short green coat sleeves, and his two bare felt wrists fill the middle of the frame; the snow on the ground is a soft blur far below. The top edge of the frame shows the bottom of the mustard scarf hanging. The TOP 22% of the image must be soft out-of-focus coat and snow with nothing sharp in it.
- His RIGHT hand is pulling a chunky mustard-yellow knitted WRIST WARMER onto his LEFT wrist — it is halfway on, stretched over the back of the hand. The other wrist warmer hangs from his right thumb. His bare wrists are clearly visible.
- Mongle is NOT in this panel."""),
    's3b': ("Attached images in order: (1) the previous close panel — same hands, sleeves, light and blur, (2) the base street panel.",
            """CAMERA: CLOSE-UP, eye level, straight-on at his two raised hands: both hands are held up side by side in front of his chest, palms facing the camera, fingers spread happily, and BOTH wrists now wear the chunky mustard-yellow knitted wrist warmers, snug around the wrists just below the short green sleeves. The bottom of the mustard scarf and his smiling chin are just visible at the top edge. The TOP 22% of the image is soft blurred dusk with nothing sharp in it; the hands and warmers sit between 35% and 75% of the image height.
- Mongle is NOT in this panel."""),
    's4a': ("Attached images in order: (1) the base street panel — his trousers, short white socks and brown shoes must match it.",
            """CAMERA: LOW ANGLE CLOSE-UP right down on the snow at ankle height: the friend's two lower legs and brown felt shoes stand on the snow in the middle of the frame; the cropped brown trouser hems and his bare ankles are clearly visible. The TOP 22% of the image is the soft blurred green coat hem and dusky street with nothing sharp in it.
- He is bending down: both his hands reach in from the top of the frame and are pulling a pair of long mustard-yellow knitted KNEE SOCKS up over his feet — the socks are halfway, bunched around the ankles, the bare ankle skin of one leg still showing.
- Mongle is NOT in this panel."""),
    's4b': ("Attached images in order: (1) the previous low close panel — same camera height, snow, light, legs and shoes.",
            """Same LOW ANGLE CLOSE-UP at ankle height as the attached image, a moment later: the long mustard-yellow knitted socks are now pulled all the way up to the knees, snug around both ANKLES; the friend's hands are gone. He lifts one foot on tiptoe, heel up, in a proud little pose, a few felt snow crumbs flicking up. The ankles in the mustard socks sit between 45% and 75% of the image height. The TOP 22% of the image is soft blurred coat hem and street with nothing sharp in it.
- Mongle is NOT in this panel."""),
    's5': ("Attached images in order: (1) the base street panel — the same friend, coat and street, (2) mascot reference.",
           """CAMERA: LOW ANGLE from Mongle's eye level on the snow, looking UP at the friend — Mongle's soft coral back and the top of its dome are a blurred shape in the lower-right corner foreground (about 25% of the width, cut by the frame edge). The friend stands full body in the centre, a little bigger than in the base panel, towering, his head at about 30–36% of the image height and his shoes at about 88%.
- He is now FULLY BUNDLED: the long mustard scarf wrapped around his NECK, the two mustard wrist warmers on his WRISTS, and the long mustard knee socks over his ANKLES — the three mustard pieces stand out clearly against the green coat and brown trousers. He spreads both arms wide and out to the sides at shoulder height (wrists clearly visible, away from his body), chest out, a big proud grin.
- The TOP 22% of the image is plain dusky sky with nothing in it. Keep the friend between 15% and 85% of the width."""),
    's6': ("Attached images in order: (1) mascot reference, (2) the base street panel for the snow and light.",
           """CAMERA: CLOSE-UP on MONGLE's face at its own eye level — Mongle's coral dome fills the middle and lower part of the frame (about 60% of the width), sitting on the snow; behind it, out of focus, the friend's legs in mustard knee socks and the warm windows are a soft blur. The TOP 25% of the image is soft blurred dusk with nothing sharp in it.
- Mongle is STUNNED: its bead eyes are very wide and round, a tiny round "o" mouth, one small felt sweat drop on its side, its whole body squashed a little backwards as if it just saw something impossible. It is looking up and slightly to the left (toward the friend)."""),
    's7': ("Attached images in order: (1) the base street panel — same friend and street, (2) mascot reference.",
           """CAMERA: MEDIUM SIDE SHOT at knee height: the friend (fully bundled — mustard scarf on his neck, mustard wrist warmers, mustard knee socks) KNEELS on the snow on the left, facing right; Mongle sits on the snow on the right, centred at 66% of the width, its bottom hem at about 80% of the image height. The TOP 24% of the image is plain dusky sky.
- The friend gently holds a SMALL MINT-GREEN knitted scarf with both hands and loops it over the TOP of Mongle's round dome like a halo, smiling kindly. Mongle looks up at the mint scarf above its eyes, hopeful, cheeks rosy."""),
    's8a': ("Attached images in order: (1) the previous side panel — same Mongle, same mint scarf, same snow and light, (2) mascot reference.",
            """CAMERA: CLOSE-UP on Mongle, a little from above: Mongle fills the middle of the frame. The small MINT-GREEN knitted scarf is SLIDING DOWN Mongle's smooth round body — crooked and loose, already halfway down, one end flopping — because Mongle has no neck to hold it. Mongle squints and tilts sideways in alarm. The friend's two hands in mustard wrist warmers are open at the left edge of the frame in surprise. The TOP 24% of the image is soft blurred dusk with nothing sharp in it."""),
    's8b': ("Attached images in order: (1) the previous close panel — same Mongle, same mint scarf, same snow and light.",
            """CAMERA: HIGH ANGLE, looking DOWN at Mongle on the snow from above: the small MINT-GREEN scarf has slid all the way down and lies in a loose ring on the snow around Mongle's scalloped bottom hem, like a little skirt that fell off. Mongle tips its whole body forward to look down at the scarf ring, puzzled, one small felt sweat drop. The tips of the friend's brown shoes and mustard socks are at the bottom-left edge. Mongle sits between 35% and 80% of the image height; the TOP 22% of the image is soft out-of-focus snow with nothing in it."""),
    's9': ("Attached images in order: (1) the base street panel — same friend and street, (2) the kneeling side panel for the mint-green scarf and the fully bundled friend, (3) mascot reference.",
           """CAMERA: MEDIUM, eye level, a little from the right: the friend (fully bundled in his mustard scarf, wrist warmers and knee socks) kneels on the snow and is WINDING the long mint-green scarf round and round Mongle's body — two loops already go around Mongle's middle, the free end is in his hand mid-swing, a little motion blur on the scarf end. Mongle tilts and spins with it, eyes squeezed shut, giggling. The friend laughs. Both are between 20% and 85% of the width; the TOP 24% of the image is plain dusky sky."""),
    's10': ("Attached images in order: (1) the base street panel — reproduce its camera, framing, street, light and the friend's face EXACTLY, (2) the kneeling side panel for the mint-green scarf and the fully bundled friend, (3) mascot reference.",
            """CAMERA: exactly the same WIDE, eye-level, straight-on camera as the base street panel; same empty dusky sky in the TOP 24%.
- THE FRIEND stands full body at 36% of the width, FULLY BUNDLED — the long mustard scarf around his NECK, the mustard wrist warmers on both WRISTS, the long mustard knee socks over both ANKLES — laughing happily with both arms spread wide and out to the sides (wrists clearly visible away from his body).
- MONGLE sits on the snow at 72% of the width, the same size as in the base panel, now completely wrapped from its bottom hem to the top of its dome in many snug loops of the MINT-GREEN knitted scarf, like a cosy round cocoon — only a narrow gap shows its two happy closed eyes (short curved stitched lines) and rosy cheeks; the scarf's little fringed end sticks out at the side. Mongle leans happily toward the friend."""),
}

out = Path(sys.argv[1])
for name, (refs, body) in PANELS.items():
    (out / f'{name}.txt').write_text(HEAD + '\n' + refs + '\n\n' + body + '\n' + TAIL + '\n', encoding='utf-8')
    print(name)
