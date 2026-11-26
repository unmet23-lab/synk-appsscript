# M82 「드세요」 그림 지시문 — python -I -X utf8 _지시문만들기.py [이름…]
# 지킬 것: 몽글은 정본 그대로(쉴 때 코 · 입 없음, 팔 · 다리 · 손 없음, 흰자 없는 검은 구슬 눈),
# 고리 · 구멍 · 빽빽한 점 무늬 없음(유호님 11-20), 칸마다 샷 크기 · 높이 · 방향을 바꾼다(영상 기준 #50 · 짜임 「더 먹어」 11-26),
# 할머니는 생신(M50)의 할머니와 다른 새 인물(뽀글 파마 · 꽃무늬 조끼) — 뿌리 그림 한 장을 모든 칸 얼굴 참고로.
# 11-26 07시: 처음 짠 저녁상 판(d_wide · d_push · d_whisper · d_bow · d_pile · d_eat)은 「더 먹어」(M49 — 친구 집 저녁상 · 귓속말 · 잘 먹었습니다)와
# 무대 · 말 순서가 같아 버리고, 겨울밤 호떡 노점(h_*)으로 다시 짰다. 버린 판은 판/ 에 그대로 둔다(그림 검사 기록용).
import sys
from pathlib import Path

HEAD = """Use your image generation tool to create exactly ONE image. Do not write code, do not edit files, do not run shell commands. After the image is generated, reply with one short line describing it.

IMAGE BRIEF — one panel of a vertical comedy short: a needle-felt miniature diorama photographed with a macro lens, portrait 9:16, gentle depth of field, cosy handmade felt-and-wool textures everywhere, cute but not babyish (for young adults learning Korean).
"""
WORLD = """WORLD (same in every panel): a winter night on a Korean neighbourhood street. A small felt street-food cart selling hotteok (sweet Korean pancakes): a wooden counter, a round flat black griddle with a few golden-brown hotteok on it, one warm hanging light bulb, a striped red-and-cream felt awning. Behind, a blurred dark-blue night street with soft warm shop-window glows (no readable signs). Each hotteok is a round golden-brown felt pancake folded in half inside a small plain white paper cup (no print on the cup). No steam, no smoke.
CHARACTERS (keep identical in every panel they appear in):
- GRANDMA (the customer): the needle-felted Korean grandmother in the grandma reference image — keep her round rosy face, black bead eyes, crinkly smile lines, short tight curly silver-grey perm hair and burgundy flower-quilted vest over a cream turtleneck EXACTLY; for the cold night she wears a long open plum-purple padded coat over the vest. No glasses. She has real little felt arms and hands. Her face must stay clearly visible.
- THE FRIEND (works at the cart): the needle-felted Korean young man in the friend reference image — keep his face, short straight black wool hair with soft bangs, black bead eyes, straight dark eyebrows, small nose, rosy cheeks and heather-grey felt hoodie EXACTLY, plus a plain mustard felt apron, no hat. He has real little felt arms and hands.
- MONGLE (works at the cart): the coral needle-felted wool ghost-shaped mascot in the mascot reference image — use it ONLY for its body shape, coral wool colour, fine short smooth felted fuzz, scalloped bottom hem with one thin continuous cream running stitch, and glossy black bead eyes with NO whites. At rest Mongle has NO nose and NO mouth. Mongle has NO arms, NO legs, NO hands and NO neck, ever — it moves cups only by nudging them with its whole dome body. It stands on a felt crate behind the counter so its whole dome rises above the countertop.
LAYOUT: keep the TOP 22% of the image calm and plain (soft out-of-focus night sky or awning) — titles will be added there later.
"""
TAIL = """
Only the characters named in this panel, nobody else. Everything is needle-felt and wool craft, no glossy realistic surfaces. Absolutely no text, letters, numbers, symbols, question marks, speech bubbles, emoji or watermarks anywhere (no writing on cups, awning or signs). No real brand, no logos. No rings, holes or dense dot patterns anywhere (no polka dots, no speckles, no sesame seeds, no snow specks, no bubbles). Keep open bead eyes plain glossy black with no whites."""
GR = "the grandma reference (her face, hair, vest and build)"
FR = "the friend reference (his face, hair, hoodie and build)"
MG = "the mascot reference (body shape, wool, hem stitch and bead eyes only)"

PANELS = {
  "d_grandroot": ("No attached images.",
    """ROOT PORTRAIT of GRANDMA alone: a needle-felted Korean grandmother doll, medium close-up from the chest up, facing the camera straight on at eye level, face big and sharp in the centre. Round rosy felt face with soft crinkly smile lines, small black bead eyes, a small felt nose, a warm closed-lip smile; short tight curly silver-grey perm hair made of tiny felted wool curls (a classic Korean grandma perm), NO glasses; a burgundy flower-quilted felt vest over a cream knit turtleneck. Plain soft butter-yellow felt wall behind her. Nobody else."""),
  "h_wide": (f"Attached images in order: (1) {GR}, (2) {FR}, (3) {MG}.",
    """WIDE shot at EYE LEVEL from the street side, the whole cart in view: behind the counter MONGLE (middle) and THE FRIEND (right, holding a felt spatula over the griddle); in front of the counter on the LEFT, GRANDMA has just walked up, seen in three-quarter view, smiling politely, her hands together. On the counter right in front of Mongle stands ONE hotteok in its paper cup, and Mongle leans its dome forward, nudging that cup toward Grandma. Mongle's face at rest, round bead eyes."""),
  "h_grand": (f"Attached images in order: (1) {GR}.",
    """EXTREME CLOSE-UP from a slightly LOW angle of GRANDMA's face and shoulders, filling most of the frame, warm bulb light on her face, the striped awning blurred behind: she looks down toward the counter (toward the camera's lower right) with a polite little smile and slightly raised eyebrows. Nobody else visible."""),
  "h_two": (f"Attached images in order: (1) {GR}, (2) {MG}.",
    """MEDIUM shot from the SIDE of the counter (from the right end of the cart), looking along the counter: MONGLE (right, near the camera) leans its dome hard against TWO paper cups of hotteok, pushing them across the counter toward GRANDMA (left, further away); Mongle's eyes are round and eager. GRANDMA stands with her arms crossed over her coat, chin up, looking away to one side, unimpressed. The friend is out of frame."""),
  "h_tower": (f"Attached images in order: (1) {MG}, (2) {GR}.",
    """CLOSE LOW-ANGLE shot from counter level: in the near foreground a TALL wobbly tower of FIVE paper cups of hotteok stacked on top of each other leans toward the left; MONGLE right behind it presses its dome against the bottom cup, both bead eyes very wide, one small pale-blue felt sweat drop on its side, a small open wobbly felt mouth (desperate). In the soft background on the left, GRANDMA has turned her back, seen from behind with her curly perm and plum coat."""),
  "h_whisper": (f"Attached images in order: (1) {FR}, (2) {MG}.",
    """EXTREME CLOSE two-shot behind the counter: THE FRIEND leans in from the right, one hand cupped beside his mouth right next to MONGLE's side, whispering, eyebrows raised, a hint of a smile. MONGLE fills the left half of the frame, both bead eyes wide and round, listening, face at rest (no mouth). The warm bulb glows above."""),
  "h_bow": (f"Attached images in order: (1) {GR}, (2) {MG}.",
    """MEDIUM shot from BEHIND GRANDMA's SHOULDER (her curly perm and plum coat soft in the left foreground), looking across the counter at MONGLE: Mongle bows its whole dome deeply forward toward Grandma, eyes squeezed shut into two short curved dark stitched lines (polite and sincere), the tower of five hotteok cups standing beside it on the counter."""),
  "h_offer": (f"Attached images in order: (1) {GR}, (2) {MG}, (3) the earlier panel from this same camera (keep its camera angle, counter, griddle, light bulb, awning and Grandma's shoulder in the left foreground exactly).",
    """MEDIUM shot from BEHIND GRANDMA's SHOULDER (her curly perm and plum coat soft in the left foreground, the side of her face just visible), looking across the counter at MONGLE, exactly the same camera as the earlier panel: Mongle sits UPRIGHT on its crate behind the counter, facing Grandma — keep the mascot reference's squat proportions exactly: a soft round dome about as wide as it is tall (not a tall bell), both glossy bead eyes open and round, face at rest (no mouth). On the counter right in front of Mongle stands ONE hotteok in its plain white paper cup, between Mongle and Grandma; the tower of five hotteok cups stands beside Mongle. The scalloped hem of Mongle rests flat on the crate, nothing showing under it."""),
  "h_beam": (f"Attached images in order: (1) {GR}.",
    """EXTREME CLOSE-UP of GRANDMA's face from slightly ABOVE and to the side (a different angle from the earlier face close-up), warm bulb light: she beams with delight, eyes squeezed into happy crescent curves, a big warm open smile, rosy cheeks glowing, one hand pressed to her chest. Nobody else visible."""),
  "h_give": (f"Attached images in order: (1) {GR}, (2) {MG}, (3) {FR}.",
    """MEDIUM WIDE shot at a slightly HIGH angle across the counter: GRANDMA (left) happily holds the tower of hotteok cups in the crook of one arm and, with her other hand, holds ONE hotteok cup out across the counter toward MONGLE, smiling like a grandmother to a grandchild. MONGLE (middle, behind the counter) looks at the offered cup with sparkling joy, eyes curved into happy dark stitched arcs, rosy blush, a small open smiling felt mouth. THE FRIEND (right) grins, spatula in hand."""),
}

def main():
    out = Path(__file__).parent
    names = sys.argv[1:] or list(PANELS)
    for n in names:
        refs, scene = PANELS[n]
        world = "" if n == "d_grandroot" else WORLD
        text = HEAD + "\n" + world + "\n" + refs + "\n\nSCENE:\n" + scene + "\n" + TAIL + "\n"
        (out / f"{n}.txt").write_text(text, encoding="utf-8")
        print("썼음", n)

if __name__ == "__main__":
    main()
