# M65 「추울 때 네 마디」 판 지시문 — 머리(공통) + 판마다 장면 + 꼬리(공통)를 합쳐 판/<이름>.txt로 쓴다(M48 _지시문만들기.py를 본떴다).
# 쓰는 법: python -I -X utf8 _지시문만들기.py <판 폴더> [이름…]
# 무대: 눈 오는 밤 서울 주택가 편의점 앞 · 버스 정류장 → 친구의 원룸(새 무대 — 같은 계정 지난 편은 찜질방 · 집 밥상 · 교무실 · 모자 가게 · 회식).
# 컷마다 샷 크기 · 높이 · 방향을 바꾼다(영상 기준 #50 — 같은 구도를 잇달아 붙이지 않는다).
# 지킬 것: 고리 · 구멍 · 빽빽한 점 무늬 없음(눈송이는 크고 드문드문, 눈 쌓임은 매끈한 덩어리 — 유호님 11-20), 몽글은 정본 그대로(입 · 팔 · 다리 · 볼 없음). · 손은 극접으로 굽지 않는다(영상 기준 #23 11-24 — 펠트 손 극접에서 손가락 마디가 생김)
import sys
from pathlib import Path

HEAD = """Use your image generation tool to create exactly ONE image. Do not write code, do not edit files, do not run shell commands. After the image is generated, reply with one short line describing it.

IMAGE BRIEF — one panel of a vertical comedy short: a needle-felt miniature diorama photographed with a macro lens, portrait 9:16, gentle depth of field, cosy handmade felt-and-wool textures everywhere, cute but not babyish (for university students and young workers in Korea).

WORLD (same in every outdoor panel): a quiet Seoul residential street on a cold night in early December. Fresh snow lies on the ground as smooth soft white felt mounds (never dotted, never speckled). A few LARGE soft felt snowflakes drift in the air — few and far apart, never a dense dot pattern. Warm streetlamp light, cold blue night shadows. A small felt convenience store with a glowing warm window (the window shows only blurred abstract felt shapes, no text), a felt bus-stop shelter with a plain wooden bench, bare winter trees. No cherry blossoms, no green leaves.
WORLD (indoor panels): the friend's small one-room apartment at night — a low wooden bed with thick plain quilts (cream, mustard, sky blue, soft pink — solid colours, no patterns), a window with frost on the glass and the snowy night outside, a warm small lamp.
CHARACTERS (keep identical in every panel they appear in):
- THE FRIEND: the needle-felted Korean young man in the friend reference image — keep his face, short straight black wool hair, black bead eyes, straight dark eyebrows, small nose and rosy cheeks EXACTLY; he wears a long charcoal-grey padded winter coat (a Korean knee-length "long padding" coat with horizontal quilted baffles, zipped up), a mustard-yellow knit beanie, a thick cream knit scarf and dark-brown felt boots. He has real little felt arms and hands. His face must stay clearly visible (never hidden by the scarf, hands or objects) unless the scene below says otherwise.
- MONGLE: the coral needle-felted wool ghost-shaped mascot in the mascot reference image(s) — use them ONLY for its body shape, coral wool colour, fine short smooth felted fuzz, scalloped bottom hem with one thin continuous cream running stitch, and glossy black bead eyes with NO whites (happy eyes are two short upward-curved dark stitched arcs). Mongle has NO mouth, NO cheeks, NO arms, NO legs, NO hands, ever — it floats a little above the ground with a soft shadow under it. Its ice-cream cone (a felt waffle cone with one round vanilla-cream felt scoop with a small bite missing) always rests against the side of its body or floats right next to it — never held by hands. Mongle is about as tall as the friend's chest. Mongle never shivers and never wears clothes.
LAYOUT: keep the TOP 22% of the image calm and plain (soft out-of-focus night sky, wall or ceiling) and the LEFT 15% free of important things — titles and a gauge will be added there later.
"""

TAIL = """
Only the characters named in this panel, nobody else. Everything is needle-felt and wool craft: no real food, no glossy realistic surfaces. Absolutely no text, letters, numbers, symbols, question marks, speech bubbles or watermarks anywhere (signs, windows and the phone screen stay blank or show only abstract glowing felt shapes). No real brand, no logos. No rings, holes or dense dot patterns anywhere (no polka dots, no speckled snow, no perforated panels, no woven baskets, no bubbles). Keep Mongle's eyes plain glossy black beads with no whites."""

FR = "(1) the friend reference — his face, hair and build"
MG = "the mascot reference (body shape, wool, hem stitch and bead eyes only)"
MGH = "the happy-eyes mascot reference (two short upward-curved stitched arcs, no mouth)"

PANELS = {
    # 친구 뿌리 그림 — 모든 친구 칸의 얼굴 참고(제작 절차 「사람이 나오는 그림」)
    '친구뿌리': ("Attached images in order: (1) a felt craft-style reference — copy only its needle-felt craft look, NOT its characters or place.",
              """ROOT PORTRAIT of THE FRIEND only (no Mongle): a needle-felted Korean young man of about 21, standing alone, seen from the front at eye level from his knees up, looking straight at the camera with a friendly calm smile, both bead eyes clearly visible. Design him freshly: round soft felt face, short straight black wool hair with a little fringe peeking under the beanie, black bead eyes, straight dark eyebrows, small nose, rosy cheeks; he wears the long charcoal-grey padded coat, the mustard-yellow knit beanie, the thick cream knit scarf loosely around his neck (not covering his chin) and dark-brown felt boots, as described above. Background: the snowy night street, softly out of focus."""),
    # ── 한 장면(끝 22.5~30.4초) — 먼저 굽는다 ──
    'mongle': ("Attached images in order: (1) the happy-eyes mascot reference, (2) the plain mascot reference, (3) the quilt-mountain room panel — keep the same room, window, lamp and quilt colours.",
               """CLOSE-UP on MONGLE at eye level inside the friend's room, beside the frosted window (snowy night outside, softly blurred). Mongle floats in the CENTRE-RIGHT, big — about 45% of the image width — relaxed and proud, its eyes two happy upward-curved stitched arcs, the ice-cream cone resting against the right side of its body (one vanilla scoop with a small bite missing). Behind it on the LEFT, softly out of focus, the bed with a thick cream quilt rolled up like a burrito. The upper middle of the frame above Mongle's head is plain softly blurred wall (space for a speech line)."""),
    'pop': ("Attached images in order: " + FR + ", (2) the quilt-mountain room panel — keep the same room, bed, window, lamp and quilt colours.",
            """CLOSE-UP from the side of the bed at mattress height: THE FRIEND is rolled tightly in a thick cream quilt like a burrito on the bed; his HEAD has just popped OUT of the top of the quilt in total disbelief — bead eyes wide open and round, eyebrows shot up high, mouth wide open in an O of shock, the mustard beanie pushed crooked, his black hair standing up a little. His face fills the CENTRE-LEFT of the frame, big and clearly visible. On the right edge, slightly out of focus, a little of Mongle's coral body and the ice-cream cone. Warm lamp light; the frosted window behind."""),
    # 11-24 첫 컷 검사 「다시」(친구가 3초 굳음 · 이불 산이 쌓는 칸 없이 나타남)로 더한 판 — 머리 내밂과 이불 산 사이에서 친구가 이불을 끌어 덮는다
    'pull': ("Attached images in order: " + FR + ", (2) the head-popping-out close-up — keep the same room, bed, cream quilt, lamp and window, (3) the quilt-mountain panel — keep its quilt colours, (4) " + MGH + ".",
             """The very next moment, MEDIUM SHOT from slightly ABOVE (high angle), looking down at the bed from the foot of the bed: THE FRIEND, still rolled in the thick cream quilt, ducks back DOWN in panic and with both felt hands yanks a thick mustard quilt and a sky-blue quilt up over his head — only his wide frightened bead eyes, raised eyebrows and the crooked mustard beanie still peek out between the quilt edges. His hands are simple soft rounded felt hands (smooth mitten-like shapes, fingers pressed together, no separate finger joints) gripping the quilt edges. A soft-pink quilt and another cream quilt are sliding down onto the pile from the top of the frame, mid-fall, as he buries himself. MONGLE floats calmly at the right edge, small, eyes two happy upward-curved stitched arcs, its ice-cream cone resting against its side. Warm lamp light; the frosted window behind."""),
    'mountain': ("Attached images in order: " + FR + " (only the mustard beanie matters here), (2) " + MGH + ".",
                 """WIDE shot of the room, a little low angle: the bed is now buried under a huge towering MOUNTAIN of thick quilts and blankets piled up almost to the ceiling — cream, mustard, sky-blue and soft-pink quilts in smooth plain colours, stacked and tumbling, the friend completely hidden inside (only the tip of the mustard beanie pokes out near the bottom). On the very TOP of the quilt mountain floats MONGLE, small and happy, eyes two upward-curved stitched arcs, its ice-cream cone resting against its side. The frosted window with snowy night outside on the right."""),
    # ── 편 칸 ──
    'open': ("Attached images in order: " + FR + ", (2) " + MGH + ".",
             """WIDE shot at eye level, in front of the glowing convenience store at night, light snow: THE FRIEND stands on the LEFT-CENTRE, hunched, shoulders up to his ears, hugging himself and shivering, teeth clenched, face clearly visible and pinched from the cold, a small soft puff of white breath. Behind him on the far left a felt thermometer is fixed to a lamppost with its red line sunk very low (no numbers on it). MONGLE floats on the RIGHT, calm and happy, eyes two upward-curved stitched arcs, its ice-cream cone resting against its side, completely unbothered by the cold."""),
    'gust': ("Attached images in order: " + FR + ", (2) " + MG + ".",
             """LOW ANGLE from the snowy ground looking up: a strong gust of snowy wind sweeps across the street from the right. THE FRIEND (left-centre, seen from the waist up, big) turns his face half away from the wind with eyes squeezed shut, his cream scarf and the hem of his long coat blown sideways, a few large snowflakes streaking past. Behind him, smaller, MONGLE floats calmly on the right, not moved by the wind at all, its ice-cream cone still resting against its side."""),
    'hug': ("Attached images in order: " + FR + ", (2) " + MG + ".",
            """MEDIUM CLOSE-UP, eye level, frontal on THE FRIEND (chest up, centre-left): he hugs himself tightly with both arms, shoulders pulled up to his ears, shivering, eyebrows pulled together, teeth chattering, a small soft white puff of breath, a few big snowflakes on his beanie. His face is big and clearly visible. At the far right edge, small and out of focus, a bit of Mongle's coral body and the cone. The upper right of the frame (beside his head) is plain blurred night street."""),
    'busstop': ("Attached images in order: " + FR + ", (2) " + MG + ".",
                """HIGH ANGLE from above (looking down at about 45 degrees), wide: the felt bus-stop shelter with a plain wooden bench under fresh snow. THE FRIEND stands beside the bench looking down at his smartphone (the screen is a plain glowing rectangle, no text) held in his stiff bare felt hands, his fingertips red. MONGLE floats next to him on the right with its ice-cream cone, looking up at the falling snow, happy. Empty snowy road beside the shelter. MONGLE has NO mouth and NO cheeks — its face is only the two glossy black bead eyes on plain coral wool (11-24 first bake drew a small smiling mouth)."""),
    'hands': ("Attached images in order: " + FR + ".",
              """CLOSE-UP of THE FRIEND at eye level in three-quarter view (turned a little to the right), head and shoulders, centre-left: he holds his two bare felt hands cupped together just below his chin and blows into them, a soft white puff of warm breath rising between them; his whole face is clearly visible — eyes squinting painfully, eyebrows tilted up in misery, cheeks and nose flushed. His hands are simple soft rounded felt hands (smooth mitten-like shapes with the fingers pressed together, no separate finger joints, no knuckles, no wrinkles), their tips flushed bright red from the cold. Big soft bokeh of streetlamp light behind. No Mongle."""),
    'snowpile': ("Attached images in order: " + FR + ", (2) " + MGH + ".",
                 """SIDE VIEW, wide, at the bus stop thirty minutes later: snow has piled up in thick smooth white felt mounds on THE FRIEND's beanie and shoulders; he stands stiff as a post, staring down the empty road where no bus comes, face clearly visible in profile-three-quarter, miserable. MONGLE floats beside him on the right, happy, eyes two upward-curved stitched arcs, with a NEW ice-cream cone (a strawberry-pink felt scoop) resting against its side. Snowy empty road."""),
    'frozen': ("Attached images in order: " + FR + ", (2) " + MG + ".",
               """LOW-ANGLE MEDIUM SHOT looking up at THE FRIEND (waist up, centre): he is frozen stiff like an ice statue — pale icy-blue felt frost on his eyebrows and on the edge of his beanie, three or four smooth clear-white felt icicles (smooth long cones) hanging from the beanie brim and one from the tip of his nose, white frost patches on the shoulders of his coat; his bead eyes are wide in despair and his mouth is open as if shouting to the sky. His face is big and clearly visible. Snowy night sky behind; Mongle not in this panel."""),
    'room': ("Attached images in order: " + FR + ", (2) " + MGH + ", (3) the quilt-mountain room panel — keep the same room, bed, window, lamp and quilt colours (here the quilts are NOT piled up yet — just a normal bed with two thick quilts).",
             """WIDE shot inside the friend's small one-room apartment at night, eye level: THE FRIEND has just dived head-first onto the low bed into the thick quilts — only his legs in dark-brown socks and the lower part of his long coat stick out of the quilts, kicking. On the LEFT, by the open front door (snowy night visible outside the door), MONGLE floats cheerfully with its ice-cream cone resting against its side, eyes two happy upward-curved stitched arcs, as if inviting him to go out again."""),
    'burrito': ("Attached images in order: (1) the friend reference — his face, hair and build, (2) the quilt-mountain room panel — keep the same quilt colours.",
                """TOP-DOWN close shot from above the bed: THE FRIEND is rolled tightly in a thick cream quilt like a burrito, lying on the bed, only his round face poking out at the top (the mustard beanie still on), cheeks flushed, eyes half-closed in cosy bliss with a stubborn little smile — he is not going anywhere. His face is in the CENTRE, big and clearly visible. The rest of the frame is the soft mustard and sky-blue quilts around him."""),
}


def main():
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent
    names = sys.argv[2:] or list(PANELS)
    for n in names:
        refs, scene = PANELS[n]
        text = HEAD + "\n" + refs + "\n\nSCENE:\n" + scene + "\n" + TAIL + "\n"
        (out / f"{n}.txt").write_text(text, encoding="utf-8")
        print(n)


if __name__ == "__main__":
    main()
