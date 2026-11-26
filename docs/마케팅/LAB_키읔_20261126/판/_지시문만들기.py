# E52 「ㅋㅋㅋ」 그림 지시문 — python -I -X utf8 _지시문만들기.py [이름…]
# 지킬 것: 몽글은 정본 그대로(쉴 때 코 · 입 없음, 팔 · 다리 · 손 없음, 흰자 없는 검은 구슬 눈),
# 고리 · 구멍 · 빽빽한 점 무늬 없음(유호님 11-20), 컷마다 샷 크기 · 높이 · 방향을 바꾼다(영상 기준 #50),
# 그림 속 글자 없음 — 휴대폰 화면은 맨 빛만(채팅 글은 Remotion이 얹는다).
import sys
from pathlib import Path

HEAD = """Use your image generation tool to create exactly ONE image. Do not write code, do not edit files, do not run shell commands. After the image is generated, reply with one short line describing it.

IMAGE BRIEF — one panel of a vertical comedy short: a needle-felt miniature diorama photographed with a macro lens, portrait 9:16, gentle depth of field, cosy handmade felt-and-wool textures everywhere, cute but not babyish (for young adults learning Korean).
"""
WORLD = """WORLD: late evening at home, two different small rooms that are texting each other.
- MONGLE'S ROOM: a tiny cosy bedroom with warm PEACH felt walls, a low bed with a puffy mint-green quilt, a small wooden desk lamp giving warm yellow light, a felt bookshelf far behind. Night outside a small window (deep blue, no stars, no dots).
- THE FRIEND'S ROOM: a different small room with SAGE-GREEN felt walls, a round grey floor cushion on a warm wooden floor, a low bed with a navy quilt behind, a warm floor lamp.
- THE PHONE: a chunky felt smartphone with a dark-grey felt case. Its screen is a plain softly glowing pale-blue rectangle with NOTHING on it — no text, no icons, no bubbles. Chat text will be added later.
CHARACTERS (keep identical in every panel they appear in):
- THE FRIEND: the needle-felted Korean young man in the friend reference image — keep his face, short straight black wool hair with soft bangs, black bead eyes, straight dark eyebrows, small nose and rosy cheeks EXACTLY. At home he wears a soft heather-grey felt hoodie and dark-navy felt sweatpants, no hat. He has real little felt arms and hands. His face must stay clearly visible.
- MONGLE: the coral needle-felted wool ghost-shaped mascot in the mascot reference image — use it ONLY for its body shape, coral wool colour, fine short smooth felted fuzz, scalloped bottom hem with one thin continuous cream running stitch, and glossy black bead eyes with NO whites. At rest Mongle has NO nose and NO mouth. Mongle has NO arms, NO legs, NO hands and NO neck, ever. Mongle is about the size of a big pillow.
LAYOUT: keep the TOP 22% of the image calm and plain (soft out-of-focus wall) — titles will be added there later.
"""
TAIL = """
Only the characters named in this panel, nobody else. Everything is needle-felt and wool craft, no glossy realistic surfaces. Absolutely no text, letters, numbers, symbols, question marks, speech bubbles, emoji or watermarks anywhere, and the phone screen stays a plain glow. No real brand, no logos. No rings, holes or dense dot patterns anywhere (no polka dots, no speckles, no bubbles). Keep open bead eyes plain glossy black with no whites."""
FR = "the friend reference (his face, hair and build — he now wears the home hoodie, no hat)"
FR2 = "the friend at-home reference (his face, hair, hoodie and build)"
MG = "the mascot reference (body shape, wool, hem stitch and bead eyes only)"

PANELS = {
  "k_friendroot": (f"Attached images in order: (1) {FR}.",
    """ROOT PORTRAIT of THE FRIEND alone in his sage-green room: medium close-up from the chest up, facing the camera straight on at eye level, face big and sharp in the centre, a calm friendly closed-lip smile, both eyes open. No phone in this panel. No Mongle."""),
  "k_letter": ("No attached images.",
    """A SINGLE chunky needle-felted Korean letter ㅋ (kieuk) standing upright, photographed straight from the front on a PURE WHITE seamless background, centred, filling about 70% of the frame height, soft even studio light, a very soft shadow below. The letter is made of thick cream-white felted wool with a thin coral running stitch along its outline. Its exact shape: one long horizontal bar across the top; from the right end of that bar, one thick vertical bar goes straight down to the bottom; one shorter horizontal bar sticks out to the LEFT from the middle of the vertical bar. Nothing else in the image — no other letters, no characters, no props."""),
  "k_bed": (f"Attached images in order: (1) {MG}.",
    """MEDIUM WIDE shot from slightly ABOVE in MONGLE'S ROOM: MONGLE sits on the mint-green quilt of its bed, its whole dome body leaning toward THE PHONE that lies face-up on the quilt in front of it, the glowing screen lighting the underside of its face. Both bead eyes are wide and round, puzzled, its face at rest (no mouth). The phone is big enough to see clearly, in the lower middle of the image. No friend in this panel."""),
  "k_friend": (f"Attached images in order: (1) {FR2}.",
    """MEDIUM shot at EYE LEVEL in THE FRIEND'S ROOM: THE FRIEND sits cross-legged on the round grey floor cushion, facing the camera at a slight three-quarter angle, holding THE PHONE in both hands at chest height and looking down at it with a small amused closed-lip smile. The phone's glowing screen faces him (we see the back of the dark-grey case). Whole upper body and crossed legs visible. No Mongle."""),
  "k_tap": (f"Attached images in order: (1) {MG}.",
    """CLOSE LOW-ANGLE shot on the mint-green quilt in MONGLE'S ROOM: THE PHONE lies face-up in the near foreground, its plain screen glowing; MONGLE is right behind it, big in frame, its dome tilted slightly forward over the phone, eyes curved into two happy dark stitched arcs (delighted), a tiny simple open smiling felt mouth. Warm lamp light from the side. No friend in this panel."""),
  "k_cold": (f"Attached images in order: (1) {FR2}.",
    """CLOSE-UP from slightly BELOW of THE FRIEND in his sage-green room, from the chest up, holding THE PHONE up in one hand near his face (back of the dark-grey case toward us, screen glow lighting his face), looking at the screen with a bright expectant smile, eyebrows raised. His face is large and clear. No Mongle."""),
  "k_panic": (f"Attached images in order: (1) {MG}.",
    """MEDIUM shot from a LOW SIDE angle (from the right) in MONGLE'S ROOM: MONGLE on the mint-green quilt right next to THE PHONE, its dome squashed down onto the phone's edge as if pressing it, both bead eyes very wide and round, one small pale-blue felt sweat drop on the side of its head, a small open wobbly felt mouth (panicking). The desk lamp glows behind. No friend in this panel."""),
  "k_roll": (f"Attached images in order: (1) {FR2}.",
    """WIDE LOW shot from floor level in THE FRIEND'S ROOM: THE FRIEND lies on his back on the warm wooden floor beside the round grey cushion, laughing hard with his eyes squeezed into happy curves and his mouth wide open, both hands on his belly, knees bent up. THE PHONE lies face-up on the floor near his shoulder, screen glowing. His whole body is visible across the lower half of the image; the upper part of the image is calm sage-green wall. No Mongle."""),
}
# 11-26 짜임 「더 먹어」(칸 9~12개 · 넓게 · 가깝게 · 아주 가깝게)에 맞춰 더한 칸
PANELS["k_puzzle"] = (f"Attached images in order: (1) {MG}.",
    """EXTREME CLOSE-UP of MONGLE's face from a LOW angle, the glowing phone screen just below the bottom edge of the frame lighting Mongle's face pale blue from below: Mongle's dome is tilted to one side, both bead eyes round, puzzled, face at rest (no mouth). The peach wall and warm lamp are soft and blurred behind. No friend.""")
PANELS["k_laugh"] = (f"Attached images in order: (1) {FR2}.",
    """CLOSE shot from a HIGH angle (looking down at him) of THE FRIEND on his round grey floor cushion, bent forward laughing hard at THE PHONE in his hands, eyes squeezed into happy curves, mouth wide open, shoulders up. The phone screen faces him. His face is large and clear. No Mongle.""")
# k_coldx(끝 그림)는 k_cold 판을 첫 참고로 넣어 얼굴만 바꾼다.
PANELS["k_coldx"] = ("Attached images in order: (1) the previous panel to edit — keep everything in it, (2) the friend at-home reference (face only).",
    """Recreate the FIRST attached image exactly — same angle, framing, light, hoodie, hand and phone — and change ONLY THE FRIEND's face: it has gone completely flat and cold. Half-closed heavy eyelids over his bead eyes, a straight flat closed mouth, eyebrows flat and level, no smile at all, a deadpan unimpressed stare at the screen. No Mongle.""")

def main():
    out = Path(__file__).parent
    names = sys.argv[1:] or list(PANELS)
    for n in names:
        refs, scene = PANELS[n]
        world = "" if n == "k_letter" else WORLD
        text = HEAD + "\n" + world + "\n" + refs + "\n\nSCENE:\n" + scene + "\n" + TAIL + "\n"
        (out / f"{n}.txt").write_text(text, encoding="utf-8")
        print("썼음", n)

if __name__ == "__main__":
    main()
