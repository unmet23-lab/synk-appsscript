# M54 「빨리빨리」 그림 지시문 — python -I -X utf8 _지시문만들기.py [이름…]
# 지킬 것: 몽글은 정본 그대로(쉴 때 코 · 입 없음, 팔 · 다리 · 손 · 목 없음, 흰자 없는 검은 구슬 눈 — 버튼 · 문은 몸 옆구리로 민다),
# 고리 · 구멍 · 빽빽한 점 무늬 없음(유호님 11-20), 칸마다 샷 크기 · 높이 · 방향을 바꾼다, 그림 속 글자 · 숫자 없음(표시창 숫자는 Remotion이 얹는다).
# 무대는 대학 기숙사 엘리베이터 앞과 공용 부엌 두 곳뿐. 새로 온 친구는 뿌리 그림 한 장(nc_root)을 모든 칸 얼굴 참고로.
import sys
from pathlib import Path

HEAD = """Use your image generation tool to create exactly ONE image. Do not write code, do not edit files, do not run shell commands. After the image is generated, reply with one short line describing it.

IMAGE BRIEF — one panel of a vertical comedy short: a needle-felt miniature diorama photographed with a macro lens, portrait 9:16, gentle depth of field, cosy handmade felt-and-wool textures everywhere, cute but not babyish (for young adults learning Korean).
"""
WORLD_E = """WORLD (same in every elevator panel): the ground-floor elevator lobby of a Korean university dormitory, made of felt and wool: one elevator with two brushed-silver felt sliding doors in a warm beige felt wall, a slim vertical button panel beside the doors with plain round felt buttons (no symbols, no numbers), a plain dark strip above the doors (no digits), a grey felt tiled floor, soft warm ceiling light. No signs, no posters, no plants, no windows.
"""
WORLD_K = """WORLD (same in every kitchen panel): the shared kitchen of a Korean university dormitory, made of felt and wool: a light-wood felt counter, a white felt microwave oven with a dark glass-like felt window in its door and, on its right-hand control strip, ONE plain blank dark rectangular display window (no digits, no symbols) plus two plain round felt knobs; a plain mint felt tiled wall behind. Inside the microwave a small white felt bowl of rice. No steam, no smoke, no other appliances, no windows.
"""
MONGLE = """- MONGLE: the coral needle-felted wool ghost-shaped mascot in the mascot reference image — use it ONLY for its body shape (a soft round dome about as wide as it is tall), coral wool colour, fine short smooth felted fuzz, scalloped bottom hem with one thin continuous cream running stitch, and glossy black bead eyes with NO whites. At rest Mongle has NO nose and NO mouth. Mongle has NO arms, NO legs, NO hands, NO fingers and NO neck, ever — its sides are always smooth and round; it presses buttons and doors only by leaning the side of its whole dome body against them.
"""
NEWCOMER = """- THE NEWCOMER: the needle-felted young Mongolian man in the newcomer reference image — keep his round rosy face, small black bead eyes, small felt nose, short straight black wool hair with one little cowlick on top EXACTLY. He has real little felt arms and hands. His face must stay clearly visible.
"""
SALARY = """- THE OFFICE WORKER: a needle-felted Korean office worker in his thirties, short neat black wool hair, black bead eyes, small felt nose, a navy felt suit with a plain white shirt and plain dark tie, a small brown felt briefcase. He has real little felt arms and hands. He looks busy and in a hurry, not angry.
"""
LAYOUT = """LAYOUT: keep the TOP 22% of the image calm and plain (soft out-of-focus wall or ceiling) — titles will be added there later.
"""
TAIL = """
Only the characters named in this panel, nobody else. Everything is needle-felt and wool craft, no glossy realistic surfaces. Absolutely no text, letters, numbers, digits, symbols, arrows, question marks, speech bubbles, emoji or watermarks anywhere (no writing on buttons, display windows, doors or walls). No real brand, no logos. No rings, holes or dense dot patterns anywhere (no polka dots, no speckles, no perforated grilles, no tapioca pearls, no bubbles). Keep open bead eyes plain glossy black with no whites. Mongle never has arms, hands or legs."""

MG = "the mascot reference (body shape, wool, hem stitch and bead eyes only)"
NC = "the newcomer reference (his face, hair and build)"
LB = "the earlier lobby panel (keep the same lobby exactly: silver doors, beige walls, grey floor, button panel and light; ignore the people in it)"

PANELS = {
  "nc_root": ("", "", "No attached images.",
    """ROOT PORTRAIT of THE NEWCOMER alone: a needle-felted young Mongolian man doll, about twenty, medium close-up from the chest up, facing the camera straight on at eye level, face big and sharp in the centre. Round rosy felt face, small black bead eyes, a small felt nose, a calm gentle closed-lip smile; short straight black wool hair with one little cowlick on top; a thick mustard-yellow padded felt winter jacket with a plain navy backpack strap over one shoulder. Plain soft butter-yellow felt wall behind him. Nobody else."""),
  "e_wide": (WORLD_E, MONGLE + SALARY, f"Attached images in order: (1) {MG}.",
    """WIDE shot at EYE LEVEL from the lobby, the whole elevator in view: the two sliding doors are only HALF open (still opening), and INSIDE the elevator THE OFFICE WORKER already stabs one round button on the inner panel with his index finger, leaning forward, eyebrows tight, in a rush. OUTSIDE in the lobby, a little to the left of the doors, MONGLE sits calmly on the floor facing the doors, completely relaxed, eyes softly closed into two gentle happy curved stitched lines, a faint rosy blush, no mouth. Mongle is about knee height of the office worker."""),
  "e_shut": (WORLD_E, MONGLE, f"Attached images in order: (1) {MG}, (2) {LB}.",
    """CLOSE shot from SLIGHTLY ABOVE: MONGLE fills the lower middle of the frame, sitting right in front of the elevator doors which are now FULLY CLOSED behind it (the seam of the two silver doors runs down behind Mongle). Mongle is perfectly content and unbothered, eyes closed into two gentle happy curved stitched lines, a soft rosy blush, no mouth, a tiny relaxed tilt. Nobody else."""),
  "e_jab": (WORLD_E, MONGLE, f"Attached images in order: (1) {MG}, (2) {LB}.",
    """MEDIUM shot from a LOW angle at the SIDE of the doors: MONGLE leans the side of its whole dome hard against the round call button on the slim panel beside the closed elevator doors (pressing it with its body, no arms), its dome squashed a little against the panel, the button glowing warm. Mongle is impatient: eyes narrowed into two flat half-closed lines, one small pale-blue felt sweat drop on its forehead, a small tight wavy felt mouth. Nobody else."""),
  "m_wait": (WORLD_K, MONGLE, f"Attached images in order: (1) {MG}.",
    """EXTREME CLOSE-UP at COUNTER LEVEL: the right half of the frame is the white felt microwave's control strip with its plain blank dark rectangular display window large and sharp in focus (about a quarter of the frame width, empty, no digits); MONGLE's face fills the left half, pressed close to the microwave, staring hard at the display window, both bead eyes very wide and round, no mouth, one tiny sweat drop. Nobody else."""),
  "m_open": (WORLD_K, MONGLE, f"Attached images in order: (1) {MG}.",
    """MEDIUM shot from the FRONT-LEFT at counter level: the white felt microwave on the counter, its door FLUNG wide open to the left, the small bowl of rice visible inside; the blank dark display window on the right control strip is clearly visible (no digits). MONGLE stands on the counter right beside the open door, having just bumped it open with the side of its dome (no arms), leaning forward in a hurry, eyes fierce and determined (two short slanted brows of darker coral wool), a small open shouting felt mouth. Nobody else."""),
  "m_kick": (WORLD_K, MONGLE, f"Attached images in order: (1) {MG}, (2) the earlier kitchen panel (keep the same camera angle, counter, microwave, wall and light exactly).",
    """MEDIUM shot from the FRONT-LEFT at counter level, exactly the same camera as the earlier kitchen panel: the microwave door is caught HALFWAY open, swinging out to the left at about forty-five degrees; MONGLE has just slammed the side of its whole dome into the door edge (no arms), its body squashed and tilted hard against the door, eyes squeezed shut into two tight straight lines with effort, cheeks puffed. The blank dark display window on the right control strip is clearly visible (no digits). Nobody else."""),
  "m_smug": (WORLD_K, MONGLE, f"Attached images in order: (1) {MG}, (2) the earlier kitchen panel (keep the same counter, microwave, wall and light).",
    """CLOSE-UP from slightly BELOW: MONGLE fills the LEFT half of the frame (its dome top at about 45% from the top of the image), turned toward the camera, very pleased with itself: eyes relaxed into two smug half-closed curved lines, a small closed satisfied smile, rosy blush. Behind it on the right, soft and out of focus, the open microwave with the bowl of rice. Nobody else."""),
  "e_rev": (WORLD_E, MONGLE + NEWCOMER, f"Attached images in order: (1) {MG}, (2) {NC}, (3) {LB}.",
    """WIDE shot at EYE LEVEL from the lobby, the whole elevator in view (the same camera as the first panel): the two sliding doors are only HALF open (still opening). Now MONGLE is INSIDE the elevator, leaning the side of its dome hard against the inner button panel (pressing a button with its body, no arms), eyes narrowed into flat impatient lines, a small tight felt mouth. OUTSIDE in the lobby, a little to the left of the doors, THE NEWCOMER stands calmly in his mustard-yellow padded jacket and navy backpack, holding a plain paper cup of milk tea in one hand, a relaxed gentle smile, eyes calm. Nobody else."""),
  "m_shock": (WORLD_E, MONGLE, f"Attached images in order: (1) {MG}, (2) {LB}.",
    """EXTREME CLOSE-UP of MONGLE from slightly BELOW, inside the elevator (silver felt wall and the edge of the button panel soft behind): Mongle is frozen in shock — both bead eyes huge and round, one large pale-blue felt sweat drop on its side, a small round open felt mouth, its coral wool a little paler. Nobody else."""),
  "e_open": (WORLD_E, MONGLE + NEWCOMER, f"Attached images in order: (1) {MG}, (2) {NC}, (3) {LB}.",
    """MEDIUM shot from INSIDE the elevator looking OUT through the doors, which are sliding open wide again: MONGLE (right foreground, inside) bows its whole dome forward shyly toward the lobby, eyes curved into embarrassed happy arcs, a strong rosy blush, no mouth. THE NEWCOMER (left, in the doorway) steps in with a friendly smile, his milk tea cup in one hand, mustard-yellow jacket and navy backpack. Nobody else."""),
  "n_open": (WORLD_K, MONGLE + NEWCOMER.replace("EXACTLY.", "EXACTLY; one year later he wears a plain heather-grey felt hoodie indoors."), f"Attached images in order: (1) {NC}, (2) {MG}, (3) the earlier kitchen panel (keep the same counter, microwave, wall and light exactly).",
    """MEDIUM shot at a slightly HIGH angle in the dormitory kitchen: THE NEWCOMER (left) yanks the microwave door wide open with one hand in a hurry, leaning in, eyes fierce, an eager open-mouth grin; the blank dark display window on the right control strip is clearly visible (no digits). MONGLE sits on the counter right beside the microwave, laughing hard: eyes curved into happy arcs, a big open smiling felt mouth, rosy blush. Nobody else."""),
}

def main():
    out = Path(__file__).parent
    names = sys.argv[1:] or list(PANELS)
    for n in names:
        world, chars, refs, scene = PANELS[n]
        body = HEAD + "\n"
        if world:
            body += world + "CHARACTERS (keep identical in every panel they appear in):\n" + chars + LAYOUT
        body += "\n" + refs + "\n\nSCENE:\n" + scene + "\n" + TAIL + "\n"
        (out / f"{n}.txt").write_text(body, encoding="utf-8")
        print("썼음", n)

if __name__ == "__main__":
    main()
