# 9번 게임 트레일러 이미지 콘티 지시문(2026-10-26) — 공통 머리말 + 컷별 본문을 지시문/S??.txt로 쓴다.
# 참고 그림 순서(굽기 때 이 순서로 -i): 1 배치도(원본 첫 프레임을 크게 흐린 판 — 구도만) · 2 하린 방 기준 그림(R0) ·
# 3 펠트 친구가 든 장면(우리 동네 펠트 사진) · 4 세 친구 정본 한 장(생김새만). 컷마다 쓰지 않는 참고는 REFS에서 뺀다.
#   python -X utf8 이미지콘티_지시문.py   → 지시문/S02a.txt … 와 지시문/_참고.json(컷마다 참고 그림 목록)
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
V = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p9"

HEAD = """Create ONE photograph (landscape 3:2). Use the image generation tool once and output only that image.

STYLE
A photoreal still from a cosy Korean TV commercial for a video game, shot on a cinema camera on a December night in a young woman's small studio apartment in Seoul. Warm tungsten practical light, string-light bokeh, shallow depth of field, gentle film grain. The room, its furniture and its colours are exactly the room in reference image 2.

COMPOSITION — follow reference image 1
Reference 1 is a heavily blurred frame that only shows the camera position, framing, the layout of big shapes, where the light is and where the focus falls. Copy those. Do not copy any person, character, logo or screen picture from it. The grey bands at the top and bottom of reference 1 are crop margins: keep everything important inside the middle band.
"""

FRIENDS = """
THE FELT FRIENDS (only where this shot asks for them)
Palm-sized handmade needle-felted wool toys that are alive: soft fuzzy fibres, tiny visible stitches, real weight and real contact shadows, lit by the same lamps as the room. Keep their faces, shapes and colours exactly as in references 3 and 4 (4 is only a design sheet — do not paste it):
- KKAMONG: dark-brown, very fluffy round kitten-like body, two small pointed ears, bright green glass eyes, stubby arms, a long tail ending in a little coral-pink and dark-brown felt paddle with cream stitches.
- MONGLE: a coral-red felted ghost-like dome with two black bead eyes and a wavy scalloped hem edged with cream running stitches; no arms, no legs; it can float.
- MARIN: a tiny cream felt doll wearing a big round navy felt helmet with two round yellow felt eye-lenses; short arms and legs; a little cross-body bag holding a white daisy.
They are about 8-10 cm tall next to real household objects. Never make them photoreal animals, plastic or clay.
"""

TAIL = """
DO NOT
No letters, words, numbers, logos or brand marks anywhere. No extra characters beyond those named.
"""

SHOTS = {
    "S02a": dict(layout="S02", friends=False, body="""
THIS SHOT (first frame of a 4.3-second shot)
The camera is low behind the sofa, at the height of a small wooden side table that stands right behind the sofa; the table's near edge runs across the bottom of the frame, soft and out of focus. The woman from reference 2 sits on the sofa, seen from behind (three-quarter back view, left of centre, no face), playing on the big screen at the back of the room, which shows the cosy felt miniature village game (soft and bright, no readable letters). Focus is on her and the screen. The table top is still empty except a blurred mug at the left edge.
"""),
    "S02b": dict(layout="S02_끝", friends=True, body="""
THIS SHOT (last frame of the same 4.3-second shot — the camera has drifted slightly back and down)
Same place as the first frame: low behind the sofa at the height of the small wooden side table. Now the focus has moved to the table edge in the foreground: KKAMONG, MONGLE and MARIN have just climbed up onto the table edge (left of centre) and stand in a little row looking toward the woman and the screen, sharp and in focus. A slice of strawberry shortcake on a small plate fills the right foreground (soft), a mug of cocoa at the left edge. Behind them, out of focus, the woman from reference 2 on the sofa (back view, no face) and the glowing screen with the felt village game.
"""),
    "S03": dict(layout="S03", friends=True, body="""
THIS SHOT (2.3 seconds, locked-off close shot)
At table-top height, very close: KKAMONG, MONGLE and MARIN stand side by side on the wooden side table next to the slice of strawberry shortcake (cake at the left edge), facing slightly left. MARIN has just pulled the tiny white daisy out of its bag and holds it up high with both arms. Warm string-light bokeh in the dark background (upper right). The three are sharp, everything else melts into bokeh.
"""),
    "S04": dict(layout="S04", friends=True, body="""
THIS SHOT (1.7 seconds, floor level)
Camera on the floor. A red wrapped gift box with a big gold ribbon bow stands in the centre on the dark wooden floor (same gift boxes as in reference 2). All three friends are small at the foot of the box, trying together to lift it: MONGLE at the lower left pushing with its body, KKAMONG in the middle squeezed under the bottom edge with both arms up, MARIN at the lower right pulling at the corner. Dark chair and table legs blur in the background. Keep it as dark as a real night-time floor shot: a dark floor and a mostly dark background with only a few warm bokeh dots — no bright tree, lamp or window visible behind.
"""),
    "S05": dict(layout="S05", friends=False, body="""
THIS SHOT (1.8 seconds, slow push-in on the screen)
The big screen on the low wooden console fills most of the frame, seen slightly from the left. It shows the cosy game exactly like reference 5: a needle-felted wool miniature Korean village (navy tiled roofs, a tea house, a little coral ghost character walking on a stone courtyard), bright soft daylight inside the game. Around the screen in the dark room: warm fairy lights on the wall at the left, a vase of dried branches with tiny lights at the right. No readable letters on the screen.
"""),
    "S06": dict(layout="S06", friends=True, body="""
THIS SHOT (1.2 seconds, close-up, slightly tilted camera)
Very close, with the camera right down at MONGLE's eye level on the floor (the floor is only a thin dark strip at the very bottom): MONGLE leans out from behind the LEFT edge of a red wrapped gift box (the red box fills the right half of the frame); its coral head fills about a quarter of the frame and BOTH bead eyes are visible, worried, looking toward the right. Big round yellow bokeh behind on the left.
"""),
    "S08a": dict(layout="S08", friends=True, body="""
THIS SHOT (first frame of a 4.3-second locked-off shot, floor level)
The red gift box with the gold ribbon bow stands in the centre on the wooden floor, warm window and pillar bokeh behind. A loud thunderclap just came from the game on the screen: the three friends at the foot of the box have frozen in fright — MONGLE at the lower left, KKAMONG and MARIN at the lower right corner, all small, leaning away, about to dash behind the box. No comic marks or symbols. Keep it as dark as a real night-time floor shot: a dark floor and a mostly dark background with only a few warm bokeh dots — no bright tree, lamp or window visible behind.
"""),
    "S08b": dict(layout="S08_끝", friends=True, body="""
THIS SHOT (last frame of the same locked-off shot, 4 seconds later)
Same framing: the red gift box with the gold ribbon bow in the centre, warm bokeh behind. The friends have hidden behind the box: only MONGLE's coral head with one bead eye peeks out at the lower left edge of the box, and MARIN's navy helmet with one yellow eye-lens peeks out at the lower right edge, both curious and careful. Keep it as dark as a real night-time floor shot: a dark floor and a mostly dark background with only a few warm bokeh dots — no bright tree, lamp or window visible behind.
"""),
    "S09": dict(layout="S09", friends=True, body="""
THIS SHOT (1.5 seconds, mid-air)
In the warm dark room full of round bokeh, MONGLE floats through the air toward the camera carrying KKAMONG, who hangs below it holding on with both arms. They are TINY and far away, as if the camera is across the room: the pair together is only about one eighth of the image height, placed at the upper right (about three quarters across, a third down). The room is almost BLACK — only one big white bokeh ball at the lower left and two or three faint warm dots; no visible tree or lamps.
"""),
    "S10": dict(layout="S10", friends=True, body="""
THIS SHOT (first frame of a 1.7-second medium shot of the Christmas tree)
A medium shot of the MIDDLE of the small Christmas tree from reference 2 — the tree's middle section fills the left two thirds (no top, no floor), multicolour string lights glowing, the sheer white curtain at the right. At this first moment MONGLE carrying KKAMONG whooshes past VERY close to the camera in the UPPER LEFT foreground — huge, cut by the frame edge and strongly out of focus (soft coral and dark-brown blur with motion), on their way into the tree. The camera is slightly tilted (about 5 degrees), as if still settling after following them.
"""),
    "S11a": dict(layout="S11", friends=True, body="""
THIS SHOT (3.3 seconds, extreme close-up inside the Christmas tree — first moment)
It is DARK: the string lights are switched OFF and the background deep inside the tree is almost black. Only a faint warm glow from the room catches the dark green pine needles, the clear unlit glass bulbs on their wire, a dark red glass ornament ball in the lower centre and a pale snowflake ornament at the upper right. KKAMONG has just landed on top of the red ornament ball and is reaching out with one paw toward the unlit string of bulbs. Overall very low-key, like a night shot before the lights come on.
"""),
    "S11b": dict(layout="S11_끝", friends=True, body="""
THIS SHOT (the same extreme close-up, 3 seconds later — the magic moment)
Same framing inside the Christmas tree. KKAMONG touched the light string and the magic spread: every bulb on the string has turned into a round needle-felted wool pom-pom bulb that glows warm white and gold from inside, and the felt is spreading along the ornaments — the red glass ball under KKAMONG is now half red felt with stitched seams. A few sparkly wool fibres float in the air. KKAMONG sits on top of the felt ball, delighted. Warm glow, much brighter than before.
"""),
    "S12": dict(layout="S12", friends=True, body="""
THIS SHOT (first frame of a 2.8-second locked-off shot — worm's-eye view)
The camera lies on the floor and points steeply UP at the tree (about 35 degrees upward, strong low-angle perspective: the tree tapers toward a star at the top centre, the ceiling corner and the top of the curtained window are visible behind it). The whole small Christmas tree has turned into a handmade needle-felted wool tree: felt branches, glowing felt pom-pom lights, felt ornaments, a felt star. Only the very bottom edge of the frame shows the floor, now soft green felt grass. At this first moment the friends have not risen into view yet: just the soft out-of-focus tip of MONGLE's coral head peeks in at the far left edge and the top of MARIN's navy helmet at the bottom centre edge.
"""),
    "S13": dict(layout="S13", friends=True, body="""
THIS SHOT (2.7 seconds, top-down, looking straight down at the floor)
Seen from above: the wooden floor between the wrapped gift boxes (corners of boxes at the edges of the frame) has turned into green felt grass with a path of round grey felt stepping stones. On the stones nine small felt characters stand in a loose line looking up at the camera: KKAMONG, MONGLE, MARIN, the PROFESSOR (lavender egg with round glasses and white moustache), the TEA-HOUSE OWNER (dark hair, sage apron), and four more little felt townspeople in soft colours. A warm pink light washes over the scene from the right.
"""),
    "S14": dict(layout="S14", friends=True, extra_felt=True, body="""
THIS SHOT (2.8 seconds, the title shot — the same high wide camera as reference 2)
Exactly the room and the camera of reference 2, but the whole room has now become an obviously HANDMADE NEEDLE-FELTED WOOL MINIATURE — it should look like the felt diorama of reference 5 at room size, so that anyone sees at once that the room turned into felt: fuzzy wool fibres and visible stitches on every surface, chunky rounded shapes, soft toy-like proportions. The walls are cream felt panels with stitched seams; the curtains are thick mustard felt; the ladder shelf has become a small white felt Korean house with a curved navy felt tile roof (giwa, white felt dots at the eaves) and a glowing round lattice window; the low table in the foreground has become a honey-coloured felt tea-house deck with tiny felt teacups and a teapot; the Christmas tree is a chunky felt tree with glowing felt pom-pom lights and felt blossoms; the floor is green felt grass with a winding path of grey felt stepping stones and a tiny felt pond; the sofa and the throw are chunky felt; the gift boxes are felt. The screen on the console still glows with the felt village game. ONLY the woman is still a REAL photographed person, unchanged (back view, long dark hair, cream knit cardigan, no face), sitting on the felt sofa with the controller. KKAMONG, MONGLE and MARIN sit on the felt sofa arm and on the felt grass near her, small. Leave the lower right quarter calm (a title will be placed there later).
"""),
}

if __name__ == "__main__":
    out = HERE / "지시문"
    out.mkdir(exist_ok=True)
    refs = {}
    for name, s in SHOTS.items():
        text = HEAD + (FRIENDS if s["friends"] else "") + s["body"]
        r = [f"{V}/배치/{s['layout']}_배치.jpg", f"{V}/받음/R0.png"]
        if s["friends"]:
            r += [f"{V}/참고/펠트동네_우리동네.jpg", f"{V}/참고/정본_세친구.jpg"]
        if name in ("S05", "S14"):
            r.append(f"{V}/참고/펠트동네_찻집골목.jpg")  # S14는 참고 5, S05는 친구 참고가 없어 참고 3
        if name == "S05":
            text = text.replace("exactly like reference 5", "exactly like reference 3")
        (out / f"{name}.txt").write_text(text + TAIL, encoding="utf-8")
        refs[name] = r
    (out / "_참고.json").write_text(json.dumps(refs, ensure_ascii=False, indent=1), encoding="utf-8")
    print(len(SHOTS), "지시문")
