# M69 「써요」 판 지시문 — 머리(공통) + 판마다 장면 + 꼬리(공통)를 합쳐 판/<이름>.txt로 쓴다(E58 · E57 _지시문만들기.py를 본떴다).
# 쓰는 법: python -I -X utf8 _지시문만들기.py <판 폴더> [이름…]
import sys
from pathlib import Path

HEAD = """Use your image generation tool to create exactly ONE image. Do not write code, do not edit files, do not run shell commands. After the image is generated, reply with one short line describing it.

IMAGE BRIEF — one panel of a vertical comedy short: a needle-felt miniature diorama photo, portrait 2:3, soft warm afternoon light from a shop window, shallow depth of field, cosy handmade felt-and-wool textures everywhere (copy only the craft style, light and scale of the felt reference photo — NOT its café, NOT its barista).

WORLD (same in every panel): a tiny felt neighbourhood accessory shop seen across its wooden counter — FIXED CAMERA at counter height, straight-on. On the counter: a small felt hat stand with a few soft berets, a little felt mirror on a stand, a tray of round felt eyeglasses, a tiny felt espresso machine on the right, and a small wooden coin tray. Behind: soft felt shelves with folded scarves and hats, a warm window. The TOP 24% of the image is a plain soft cream felt wall with nothing on it (no shelves, no signs) — keep it empty for titles. The front face of the counter (bottom 25% of the image) is plain warm wood.
CHARACTERS (keep identical in every panel they appear in):
- THE CLERK: a cheerful Korean felt doll young man with short black felt hair, a round friendly face, small black bead eyes, rosy cheeks, wearing a cream knitted sweater and a forest-green felt apron. He stands behind the counter on the RIGHT side of the frame. He does NOT wear glasses.
- MONGLE: a small coral-pink felt blob mascot — use the mascot reference ONLY for its body shape, coral wool colour, fuzzy texture, scalloped bottom hem with a cream running stitch and glossy black bead eyes (no white sclera; closed eyes are two short curved dark stitched lines). Mongle has NO arms, NO legs, NO hands and NO neck, ever — its head and body are one soft dome. It moves by tilting, squashing and bouncing its whole body. Mongle sits ON the counter on the LEFT-CENTRE of the frame, its bottom hem on the counter top at about 78% of the image height, about 30% of the image width wide. A small coral felt coin purse sits on the counter next to Mongle.
"""

TAIL = """
Only the characters named in this panel, nobody else. Absolutely no text, letters, numbers, prices, symbols, question marks or watermarks anywhere — not on signs, not on tags, not on the coins, not on the cup. No real brand, no logos."""

PANELS = {
    'h1': ("Attached images in order: (1) mascot reference, (2) felt craft-style reference.",
           """This is the BASE panel. MONGLE sits on the counter looking up with shining eyes at a soft mustard-yellow felt BERET on the little hat stand next to it. THE CLERK stands behind the counter on the right, smiling, one hand gesturing toward the beret. The small coral coin purse sits closed and plump next to Mongle."""),
    'h2': ("Attached images in order: (1) the base shop panel — reproduce its camera, framing, shop, clerk and Mongle EXACTLY, (2) mascot reference.",
           """Same fixed camera. THE CLERK leans over the counter and gently places the mustard-yellow felt BERET on top of MONGLE's round dome with both hands. Mongle looks up at the beret, delighted, cheeks rosy."""),
    'h3': ("Attached images in order: (1) the base shop panel — same camera, framing, shop, clerk and Mongle, (2) mascot reference.",
           """Same fixed camera. MONGLE wears the mustard-yellow BERET tilted stylishly on its dome and admires itself in the little felt mirror on the counter (Mongle's reflection with the beret visible in the mirror), eyes closed happily. THE CLERK claps once behind the counter, smiling."""),
    'h4': ("Attached images in order: (1) the previous beret panel — same camera, framing, Mongle, beret and clerk.",
           """Same fixed camera, a moment later: the mustard-yellow BERET has SLID DOWN over MONGLE's eyes because Mongle has no ears or neck to hold it — the beret now covers the top half of Mongle including both eyes, Mongle tilted sideways in a startled wobble, one felt sweat drop. THE CLERK covers a laugh with his hand."""),
    'h5': ("Attached images in order: (1) the base shop panel — same camera, framing, shop, clerk and Mongle, (2) mascot reference.",
           """Same fixed camera. The beret is back on the hat stand. MONGLE now wears a pair of big ROUND tortoiseshell felt EYEGLASSES resting on its face over its two bead eyes (the glasses simply sit on the dome), looking amazed and blinking. THE CLERK leans in from the right holding a small hand mirror up to Mongle, grinning."""),
    'h6': ("Attached images in order: (1) the base shop panel — same camera, framing, shop, clerk and Mongle, (2) the glasses panel — the same round glasses on Mongle.",
           """Same fixed camera. MONGLE, wearing the round glasses and with the mustard beret back on its dome, has tipped its open coral coin purse over with its whole body: ALL its felt coins pour out across the counter into the wooden coin tray. Mongle leans forward over the coins with determination. THE CLERK holds a small paper shopping bag with the beret's box, smiling widely."""),
    'h7': ("Attached images in order: (1) the previous paying panel — same camera, framing, Mongle with beret and glasses, clerk and counter.",
           """Same fixed camera, a moment later: the coin tray and all the coins are gone to the clerk's side. MONGLE stares down at its coin purse lying flat and EMPTY on the counter — one tiny felt moth flutters out of the empty purse. Mongle's eyes are teary, the beret a little crooked, the round glasses slipping. THE CLERK, behind the counter, holds the paper shopping bag and gives a small awkward smile."""),
    'h8': ("Attached images in order: (1) the base shop panel — same camera, framing, shop, clerk and Mongle, (2) the paying panel — the same Mongle with beret and round glasses.",
           """Same fixed camera. THE CLERK, feeling sorry, slides a small white felt cup of hot black AMERICANO coffee across the counter toward MONGLE with a kind smile, a little curl of steam rising. MONGLE (beret and round glasses on) brightens up and leans toward the cup, eyes sparkling."""),
    # 장면 심사 v1 첫 컷 다른 눈 「한 모금 마시는 동작이 안 보인다」 → h9를 다시: 컵이 기울어 몸 앞에 닿은 꼴로
    'h9': ("Attached images in order: (1) the americano panel — same camera, framing, Mongle with beret and glasses, cup and clerk, (2) mascot reference.",
           """Same fixed camera. MONGLE DRINKS: it has tipped its whole dome body forward and down over the white felt cup so the cup rim is pressed against the front of its body just below its two bead eyes, and the cup is clearly TILTED toward Mongle with a little dark coffee showing at the rim; Mongle's eyes are squeezed shut in a happy gulp; a curl of steam rises. The cup sits on the counter in the same spot as in the attached panel. THE CLERK leans on the counter with his chin on his hand, watching with a hopeful smile."""),
    # 맛이 닿는 순간 — 원본 13.5초 가까이 칸 자리에 새 표정(첫 컷 다른 눈 「당겨도 새 행동이 없다」)
    'h9b': ("Attached images in order: (1) the drinking panel — same camera, framing, Mongle with beret and glasses, cup and clerk.",
            """Same fixed camera, one second later: MONGLE has pulled back upright from the cup and FROZEN stiff mid-gulp — both glossy bead eyes now WIDE OPEN in shock behind the round glasses, its whole body stiff and straight, the round glasses jolted up a little, one tiny drop of dark coffee on its front. The cup stands back on the counter in the same spot, a thin wisp of steam. THE CLERK's hopeful smile freezes, eyebrows raised."""),
    'h10': ("Attached images in order: (1) the sipping panel — same camera, framing, Mongle, cup and clerk.",
            """Same fixed camera, a moment later: a big soft cloud of white felt STEAM puffs up from the cup and covers MONGLE completely — only the round glasses' rims and the beret tip poke out of the cloud. THE CLERK leans back a little in surprise."""),
    'h11': ("Attached images in order: (1) the base shop panel — same camera, framing, shop and clerk, (2) the sipping panel — the same Mongle, beret, glasses and cup, (3) mascot reference.",
            """Same fixed camera. The steam is gone. MONGLE's whole face is SCRUNCHED UP from the bitter taste — eyes squeezed into two tight crossed stitched lines, its whole body crumpled and wrinkled like a squeezed felt ball, shivering with a few short wobbly felt lines around it; the beret has POPPED OFF into the air above it and the round glasses hang crooked. A tiny felt tongue sticks out. THE CLERK's eyes are wide with surprise."""),
    'h11b': ("Attached images in order: (1) the previous bitter-face panel — same camera, framing, Mongle, clerk and counter.",
             """Same fixed camera, a moment later: MONGLE shakes its whole body side to side as if shaking off the bitter taste (light motion blur), the round glasses slid down crooked, the beret landing back on its head upside down. THE CLERK holds back a laugh."""),
    # 도리도리 둘째 꼴 — h11b와 번갈아 붙여 몸을 좌우로 흔드는 움직임으로(첫 컷 다른 눈 「좌우로 흔드는 동작이 안 보인다」)
    'h11c': ("Attached images in order: (1) the shaking panel — same camera, framing, Mongle, clerk, cup and counter.",
             """Same fixed camera, the very next instant: MONGLE is mid-shake leaning hard to the RIGHT side — the opposite direction from the attached panel — with light motion blur on its body edges, the round glasses swinging the other way, the upside-down beret still on its head. Everything else (the clerk holding back a laugh, the cup, the counter, the shop) stays exactly as in the attached panel."""),
    'h12': ("Attached images in order: (1) the base shop panel — same camera, framing, shop and clerk, (2) the bitter-face panel — same Mongle with beret and glasses.",
            """Same fixed camera. THE CLERK holds out a small felt SUGAR jar with a tiny spoon toward MONGLE, smiling politely, and with his other hand points at the small coin tray (meaning: it costs a little). MONGLE, still a bit wrinkled from the bitterness, looks down at its EMPTY flat coin purse with a frozen, hopeless face, one felt sweat drop."""),
}

out = Path(sys.argv[1])
only = set(sys.argv[2:])
for name, (refs, body) in PANELS.items():
    if only and name not in only:
        continue
    (out / f'{name}.txt').write_text(HEAD + '\n' + refs + '\n\n' + body + '\n' + TAIL + '\n', encoding='utf-8')
    print(name)
