# E50 「눈 = eye · snow」 판 지시문 — 머리(공통) + 판마다 장면 + 꼬리(공통)를 합쳐 판/<이름>.txt로 쓴다(M65 _지시문만들기.py를 본떴다).
# 쓰는 법: python -I -X utf8 _지시문만들기.py <판 폴더> [이름…]
# 무대: 첫눈이 내리기 시작한 초저녁 서울 주택가 골목(같은 계정 지난 편은 분식집 · 기차역 · 눈 내린 저녁 길 · 냉장고).
# 친구는 M65 「추울 때」의 친구 뿌리 그림을 얼굴 참고로 쓴다(같은 LAB 세계의 한국 친구).
# 지킬 것: 고리 · 구멍 · 빽빽한 점 무늬 없음(눈송이는 크고 드문드문 — 유호님 11-20), 몽글은 정본 그대로(입 · 팔 · 다리 · 볼 없음), 컷마다 샷 크기 · 높이 · 방향을 바꾼다(영상 기준 #50).
import sys
from pathlib import Path

HEAD = """Use your image generation tool to create exactly ONE image. Do not write code, do not edit files, do not run shell commands. After the image is generated, reply with one short line describing it.

IMAGE BRIEF — one panel of a vertical comedy short: a needle-felt miniature diorama photographed with a macro lens, portrait 9:16, gentle depth of field, cosy handmade felt-and-wool textures everywhere, cute but not babyish (for young adults learning Korean).

WORLD (same in every panel): a quiet Seoul residential alley at early evening, deep-blue dusk sky, the very FIRST snow of the year has just started — the ground is still dark felt cobblestones with only a thin smooth dusting of white at the edges (no thick piles yet). A FEW LARGE soft white felt snowflakes drift in the air, few and far apart — each one a clear chunky six-armed felt snowflake, never a dense dot pattern, never tiny specks. Warm streetlamp glow, warm windows of low houses (windows show only blurred abstract felt shapes, no text). No cherry blossoms, no green leaves.
CHARACTERS (keep identical in every panel they appear in):
- THE FRIEND: the needle-felted Korean young man in the friend reference image — keep his face, short straight black wool hair, black bead eyes, straight dark eyebrows, small nose, rosy cheeks, long charcoal-grey padded coat, mustard-yellow knit beanie, thick cream knit scarf and dark-brown felt boots EXACTLY. He has real little felt arms and hands. His face must stay clearly visible.
- MONGLE: the coral needle-felted wool ghost-shaped mascot in the mascot reference image(s) — use them ONLY for its body shape, coral wool colour, fine short smooth felted fuzz, scalloped bottom hem with one thin continuous cream running stitch, and glossy black bead eyes with NO whites (a squeezed-shut eye is one short curved dark stitched line). Mongle has NO mouth, NO cheeks, NO arms, NO legs, NO hands, ever — it floats a little above the ground with a soft shadow under it. Mongle is about as tall as the friend's chest.
LAYOUT: keep the TOP 22% of the image calm and plain (soft out-of-focus dusk sky or wall) — titles will be added there later.
"""

TAIL = """
Only the characters named in this panel, nobody else. Everything is needle-felt and wool craft, no glossy realistic surfaces. Absolutely no text, letters, numbers, symbols, question marks, speech bubbles or watermarks anywhere. No real brand, no logos. No rings, holes or dense dot patterns anywhere (no polka dots, no speckled snow, no tiny snow specks, no bubbles). Keep Mongle's eyes plain glossy black beads with no whites."""

FR = "(1) the friend reference — his face, hair, outfit and build"
MG = "the mascot reference (body shape, wool, hem stitch and bead eyes only)"

PANELS = {
    'e_open': ("Attached images in order: " + FR + ", (2) " + MG + ".",
               """WIDE shot at eye level in the alley: on the RIGHT, MONGLE floats with its whole dome body tilted back, looking UP at the falling snowflakes, both bead eyes wide open and shining with delight. On the LEFT, THE FRIEND stands facing the camera at three-quarter view, pointing with one index finger at his OWN eye (finger close beside the eye, not touching), head tilted, eyebrows raised, puzzled. The two are about one step apart, both fully visible from head to toe, a few big felt snowflakes between them."""),
    'e_eye': ("Attached images in order: " + FR + ".",
              """MEDIUM CLOSE-UP, eye level, frontal on THE FRIEND (chest up, centre-left): he points with his index finger right beside his own left eye (finger not touching the eye), eyebrows raised, a clear friendly teaching smile, looking at the camera. One big felt snowflake drifts past near his shoulder. The upper-right part of the frame beside his head is plain softly blurred dusk alley. No Mongle."""),
    'e_up': ("Attached images in order: (1) " + MG + ".",
             """CLOSE-UP of MONGLE from slightly below (low angle): its dome body fills the lower 60% of the frame, tilted back as it looks UP at the sky, both glossy bead eyes wide open, shining, delighted. Above it in the deep-blue dusk sky, four or five big chunky white felt snowflakes drift down, the nearest one large and right above its face. Warm streetlamp glow at one side."""),
    'e_splat': ("Attached images in order: (1) the previous close-up of Mongle looking up — keep EXACTLY its camera, framing, sky, streetlamp, Mongle's size, position and tilt, (2) " + MG + ".",
                """The very next instant, same framing: one big chunky white needle-felted snowflake (about as wide as a third of Mongle's face) has landed and is stuck flat on Mongle's LEFT eye (the eye on the viewer's left), completely covering that eye. Mongle's other eye is wide open in surprise. Mongle's whole body has flinched — squashed a little lower and wider, tilted slightly to one side. A few small soft puffs of felt snow scatter around the impact (three or four, not dots)."""),
    'e_laugh': ("Attached images in order: " + FR + ".",
                """MEDIUM SHOT from a slightly LOW angle on THE FRIEND (waist up, centre): he bursts out laughing — eyes squeezed into happy curves, mouth open wide, one hand on his belly, the other hand pointing toward the right edge of the frame (toward Mongle, off-screen). His beanie and scarf as in the reference, a few big felt snowflakes around. No Mongle."""),
    'e_two': ("Attached images in order: " + FR + ", (2) the snowflake-on-the-eye close-up of Mongle — keep that same white felt snowflake stuck on Mongle's LEFT eye, (3) " + MG + ".",
              """MEDIUM TWO-SHOT from the side at the friend's shoulder height: THE FRIEND on the LEFT bends down a little toward Mongle, smiling warmly, and points gently with one finger at the white felt snowflake stuck on Mongle's eye (finger not touching). MONGLE floats on the RIGHT with that big snowflake still covering its LEFT eye, its other eye open, looking up at the friend. A few big felt snowflakes drift in the dusk air between them."""),
    'e_both': ("Attached images in order: (1) the snowflake-on-the-eye close-up of Mongle — keep the same camera, framing, sky and Mongle, (2) " + MG + ".",
               """Same close framing a moment later: now TWO big chunky white needle-felted snowflakes are stuck flat on Mongle's face, one covering EACH eye, so both eyes are hidden. Mongle wobbles, tilted to the other side as if it cannot see where it is going; a thin smooth layer of fresh felt snow sits on top of its dome. Two or three more big snowflakes drift down toward it."""),
    'e_flake': ("No attached images.",
                """ONE single big chunky needle-felted snowflake alone, centred on a plain pure-white background, seen flat from the front: six thick rounded felt arms with small felt side branches, soft white wool with cream-white fibres, a gentle soft shadow only directly under it. It fills about 70% of the image width. Nothing else in the picture."""),
}


def main():
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent
    names = sys.argv[2:] or list(PANELS)
    for n in names:
        refs, scene = PANELS[n]
        head = HEAD if n != 'e_flake' else HEAD.split('WORLD (same in every panel)')[0]
        text = head + "\n" + refs + "\n\nSCENE:\n" + scene + "\n" + TAIL + "\n"
        (out / f"{n}.txt").write_text(text, encoding="utf-8")
        print(n)


if __name__ == "__main__":
    main()
