# 6번 「연말 빈방」 이미지 콘티 지시문(2026-10-25) — Gemini Ultra(나노바나나 2.1, 4 Argon · 사고 수준 높음)에 보낼 작업 목록을 만든다.
#   python -X utf8 이미지콘티_지시문.py   → synk-vendor/…/콘티/p6/ego/jobs_p6.json(실행기 gen.mjs가 읽음) · 같은 폴더의 지시문/이미지콘티.json(저장소 사본)
# 길은 「매진 임박」 v4 이미지 콘티(만족 사례 장부 S31)와 같다: 거실 기준 그림은 원본 프레임에서 사람을 지우고 크게 흐린 배치도로,
# 사람 컷은 우리 거실 판 위 원본 자리에 검은 실루엣을 둔 배치도 + 은정 · 지유 참조로 굽는다. 빛 · 계절은 지시문에 쓰고 받은 색을 그대로 쓴다(장부 공통 원칙 3).
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
V = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p6")
R = V / "ego" / "refs"
B = R / "배치"
ref = lambda name: str(R / name)

STILL = "Create one still photograph. A cinematic film still from a quiet, tender Korean family drama, 16:9 frame."
FINISH = ("Photorealistic film still with natural textures, slight film grain and natural lens falloff, shot on a cinema camera "
          "on a tripod. True-to-life colors. No text, no letters, no logos, no watermarks.")
CAM = ("Camera: fixed on a tripod across the living room at the eye level of a standing adult, about 28mm lens, perfectly level and "
       "square to the back wall, the closed bedroom door exactly in the center of the frame; a wide shot of the whole room, people "
       "small and full-length. Exposure: low-key and soft like a quiet Korean film — slightly underexposed, the white walls read as "
       "soft grey, never bright white.")   # 10-25: 1~4차 넓은 컷이 원본보다 한 스톱쯤 밝았다(밝기 중앙값 원본 65~89 · 우리 110~136)

ROOM1 = ("the living room of an ordinary, lived-in Korean apartment in the early 2010s. Exactly in the center of the back wall is the "
         "closed door of the daughter's bedroom — a plain light-oak wooden door with two tall recessed panels and a round brass knob, "
         "in a simple wooden frame, reaching from the floor to about four-fifths of the frame height; on the wall just right of the "
         "door, a small white light switch and a small white thermostat panel. Left of the door against the back wall: a dark walnut "
         "upright piano with a closed lid and a padded piano bench in front of it; on top of the piano a neat row of small framed "
         "family photos, a black metronome and a small potted fern; at the right end of the piano a young rubber plant in a white pot, "
         "about waist height. Right of the door: a small square light-wood side table with a linen-shaded table lamp and a white "
         "cordless phone; then a soft oatmeal-beige fabric two-seat sofa with a cream knitted throw over its arm, its right part cut "
         "off by the right edge of the frame; above the sofa on the right wall, a framed wedding photograph of a young couple, hung "
         "high. In the lower-left foreground, close to the camera and cut off by the frame, the backrest of a light-wood dining "
         "chair. Warm honey-colored wooden floor, off-white walls, a crown molding at the top, a pale woven rug at the bottom right.")

# 은정(F06) — 명세 · LoRA 주의(in her mid-forties · soft thin natural eyebrows · muted rose lips · small single pearl stud earrings · petite 160 cm)
EUN40 = ("a Korean woman in her mid-forties — a soft oval face with visible cheekbones, fine smile lines at the corners of her eyes and "
         "the beginning of nasolabial folds, dark brown eyes, soft thin natural eyebrows, muted rose lips, warm-toned skin; dark-brown "
         "shoulder-length wavy hair swept to one side; small single pearl stud earrings; petite, 160 cm, average build")
EUN50 = ("the same Korean woman about ten years older, in her mid-fifties — the same face with a few more fine lines and a few strands "
         "of grey; her dark-brown hair is now a sleek straight chin-length bob; small single pearl stud earrings; petite, 160 cm, "
         "average build")
EUN40_REFS = [ref("F06_hero.jpg"), ref("F06_angle-left.jpg"), ref("F06_full-back.jpg"), ref("F06_fullbody.jpg")]
# 50대 은정은 컷마다 나이를 따로 그리면 18 · 19 · 21 · 22가 서로 달라질 수 있어, 50대 얼굴 한 장(E50)을 먼저 굽고 기준으로 같이 넣는다
EUN50_REFS = [str(R / "E50.jpg"), ref("F06_hair-3.jpg"), ref("F06_angle-left.jpg"), ref("F06_full-back.jpg")]
JIYU = ("a slim Korean girl, 166 cm, with long straight jet-black hair with a center part falling well below her shoulders")
JIYU_REFS = [ref("F04_full-back.jpg"), ref("F04_fullbody.jpg"), ref("F04_hero.jpg")]
IDREF = "are identity references only — ignore their backgrounds, clothes and lighting."

BLANKET = ("THE NEW WINTER BLANKET: a thick quilted winter duvet in warm oatmeal-cream cotton with fine diamond quilting and a thin "
           "terracotta piped edge; its top is folded back neatly, showing a soft brick-red reverse side; a matching oatmeal pillow. "
           "No labels, no text.")


def scale(silhouette):
    """실루엣 크기를 숫자로(S03 1판이 실루엣보다 카메라 쪽으로 나와 17% 크게 나왔다) — 배치/_실루엣상자.json(원본 첫 프레임 사람 자리, %)"""
    box = json.loads((V / "배치" / "_실루엣상자.json").read_text(encoding="utf-8")).get(str(int(silhouette[1:3])))
    if not box:
        return ""
    feet = "is cut off by the bottom edge of the frame" if box["bottom"] >= 99 else f"is at about {box['bottom']}% of the frame height from the top"
    return (f"Keep the silhouette's scale and depth exactly — do not bring the person closer to the camera: the top of the head is at "
            f"about {box['top']}% of the frame height from the top, the lowest point of the body {feet}, and the figure spans about "
            f"{box['left']}%–{box['right']}% of the frame width.")


def wide(silhouette, who, refs, body, light, extra=""):
    """넓은 컷: 우리 거실 판 위 검은 실루엣(Image 1)을 사람으로 바꾼다 — 카메라 · 가구는 그대로, 빛만 그 장면으로"""
    n = len(refs)
    return {"refs": [str(B / silhouette)] + refs, "prompt": " ".join([
        STILL,
        "Image 1 is this film's living room with a solid black silhouette placeholder in it. Keep Image 1's camera position, framing and "
        "lens exactly, and keep every wall, the door and every piece of furniture where it is; the walls are clean, with no stains or "
        "marks. Paint the person described below exactly inside the black silhouette's outline, in its pose: the head, body and feet "
        "fill the outline and do not extend beyond it, so the person is exactly as large and as far from the camera as the "
        "silhouette — nothing of the silhouette remains. Outside the outline, change only the lighting described below.",
        scale(silhouette),
        f"Images 2 to {n + 1} {IDREF} The person is {who}.",
        body, extra, f"Light and time: {light}", CAM, FINISH])}


def jobs():
    J = {}
    # ── 방 판 셋 ──
    J["R1"] = {"refs": [str(B / "R1_배치.jpg")], "prompt": " ".join([
        STILL, "Location:", ROOM1, "Nobody is in the room.",
        "Image 1 is a heavily blurred layout guide of this exact shot: match its camera position, camera height, lens and framing, and "
        "where the large shapes sit in the frame — the door in the middle, the tall dark furniture on the left, the lamp table and the "
        "sofa on the right, the framed picture high on the right wall — but ignore its blur, its colors and its exact furniture.",
        CAM, "Light: soft, even, neutral daylight from a window outside the frame on the left; gentle shadows.", FINISH])}
    J["R2"] = {"refs": [str(V / "ego/refs/R1.jpg"), str(B / "R2_배치.jpg")], "prompt": " ".join([
        STILL,
        "Image 1 is this film's living room. Show the same room a few years later: keep Image 1's camera, framing, walls, door, floor, "
        "side table, lamp, sofa and the framed picture's place exactly. Change only these things: the upright piano and its bench are "
        "gone — in their place against the back wall stands a long, low mid-century light-oak sideboard on slim tapered legs, with a "
        "small framed graduation photo of a young woman in a cap and gown, a small vintage radio and a glass jar on top, and a woven "
        "basket underneath; a round wooden wall clock hangs on the wall above the sideboard; the rubber plant has grown to shoulder "
        "height; a pendant lamp with a dark drum shade hangs into the top-left corner of the frame; the sofa now has a soft grey "
        "knitted blanket; the framed picture on the right wall is now a formal family portrait of a couple and their grown daughter. "
        "Image 2 is a heavily blurred layout guide for the new furniture's places — ignore its blur and colors.",
        "Nobody is in the room.", CAM, "Light: soft, even, neutral daylight from a window outside the frame on the left.", FINISH])}
    J["R3"] = {"refs": [str(V / "ego/refs/R2.jpg"), str(B / "R3_배치.jpg")], "prompt": " ".join([
        STILL,
        "Image 1 is this film's living room. Show the same room many years later, in late December: keep Image 1's camera, framing, "
        "walls, door and floor exactly. Change only these things: the sideboard is replaced by a lighter, simple Scandinavian-style "
        "oak storage cabinet with a few small framed photos on top; on the wall above it hangs a large framed family photograph of a "
        "mother with her grown-up daughter on a graduation day, both smiling (not a wedding photo); a red poinsettia in a ceramic pot "
        "stands on the cabinet — the only year-end decoration in the room; the rubber plant is now tall, almost touching the ceiling; "
        "a light grey modern sofa replaces the old one, with the same small side table and lamp beside it; the corner of a wooden "
        "dining table with one chair appears in the lower-left foreground; the pendant lamp is gone. Image 2 is a heavily blurred "
        "layout guide for the new furniture's places — ignore its blur and colors.",
        "Nobody is in the room.", CAM, "Light: soft, cool overcast winter daylight from the left, calm and quiet.", FINISH])}

    # ── 거실 판 2판(Fable 1차 P2): 앞쪽 왼쪽 식탁이 원본보다 크고(원본 1 · 3은 왼쪽 끝 0~12%에 의자 등받이 하나, 14는 없음,
    #    16 · 18은 식탁 모서리 + 의자가 왼쪽 18% 안) 낮 장면이 한 스톱 밝았다 → 지금 판을 「편집」해 설계는 그대로 두고 둘만 고친다
    LOWKEY = ("Exposure: make the whole picture about one stop darker and low-key like a quiet Korean film — slightly underexposed, "
              "the white walls read as soft grey, never bright white; keep the colors natural.")
    KEEP = ("Keep everything else exactly as in Image 1 — the camera, framing and lens, the walls, the door and its frame, every "
            "piece of furniture, every frame, plant and object in the same place, size and design. Nobody is in the room.")
    J["R1v2"] = {"refs": [str(V / "ego/refs/R1.jpg")], "prompt": " ".join([
        "Edit this photograph (Image 1). Make only two changes. 1) The lower-left foreground: remove the dining table top and the "
        "second chair completely; only the top of the backrest of ONE light-wood dining chair remains at the far-left edge, cut off "
        "by the frame, within the left 12% of the frame width and the lower half of the frame — no table top visible. 2) " + LOWKEY,
        KEEP, "No text, no logos, no watermarks."])}
    J["R2v2"] = {"refs": [str(V / "ego/refs/R2.jpg")], "prompt": " ".join([
        "Edit this photograph (Image 1). Make only two changes. 1) The lower-left foreground: remove the dining table and both "
        "chairs; leave only a small corner of a wooden dining table with ONE chair at the far lower-left, cut off by the frame, "
        "within the left 15% of the frame width and the lowest third of the frame. 2) " + LOWKEY, KEEP,
        "No text, no logos, no watermarks."])}
    J["R3v2"] = {"refs": [str(V / "ego/refs/R3.jpg")], "prompt": " ".join([
        "Edit this photograph (Image 1). Make only these changes. 1) The lower-left foreground: the dining table and chair shrink to "
        "a small table corner with ONE chair at the far lower-left, cut off by the frame, within the left 18% of the frame width. "
        "2) The tall rubber plant stays tall but slim — its leaves do not overlap the door frame. 3) In the large framed photo on the "
        "left wall, only the daughter wears the graduation cap and gown; the mother beside her wears a plain dark dress. 4) " + LOWKEY,
        KEEP + " The red poinsettia stays on the cabinet.", "No text, no logos, no watermarks."])}

    # ── 50대 은정 기준 한 장 ──
    J["E50"] = {"refs": [ref("F06_hair-3.jpg"), ref("F06_hero.jpg"), ref("F06_angle-left.jpg"), ref("F06_angle-right.jpg")], "prompt": " ".join([
        "Create one photograph. A natural portrait photo, 16:9 frame. Images 1 to 4 are identity references of one Korean woman in "
        "her mid-forties — keep her face exactly the same person: the soft oval face with visible cheekbones, her dark brown eyes, "
        "the shape of her nose and mouth, soft thin natural eyebrows, muted rose lips, warm-toned skin. Show HER about ten years "
        "later, in her mid-fifties: the same face with a few more fine lines around the eyes and mouth, slightly softer skin, a few "
        "strands of grey in her dark-brown hair — not older than fifty-seven, not made younger. Her hair is a sleek straight "
        "chin-length bob, the same dark-brown color (as in Image 1, a little shorter, ending at the jawline). Small single pearl "
        "stud earrings. She wears a soft oat-beige knit cardigan over a pale blue shirt. Head-and-shoulders, three-quarter view "
        "turned slightly to the left, calm and gentle expression with closed lips, a hint of warmth in her eyes. Plain soft grey "
        "background, soft warm window light from the left. Photorealistic, natural skin texture, slight film grain. No text, no "
        "logos, no watermarks."])}

    # ── 넓은 컷 ── (실루엣 배치도 = 우리 거실 판 + 원본 첫 프레임 자리)
    J["S01"] = wide("S01_배치.jpg", JIYU, JIYU_REFS,
        "She is a seventeen-year-old high-school student walking away from the camera toward the bedroom door, mid-stride, seen from "
        "behind — she is close to the camera, left of center: her head near the top of the frame and her legs cut off at the knees by "
        "the bottom edge. She wears a navy Korean school blazer, a grey plaid pleated skirt and white socks, and carries a "
        "mustard-yellow backpack on her back. Her face is not visible. She is mid-stride with one foot lifted, still two big steps "
        "away from the door, her hands down at her sides — her hand is NOT on the door knob yet.",
        "early morning before sunrise: cool blue-grey light, dim and quiet, all lamps off; overall the room is dark-ish and bluish.",
        "A small felt bear hangs on the bedroom door as a door sign (no letters).")
    J["S03"] = wide("S03_배치.jpg", EUN40, EUN40_REFS,
        "She is vacuuming the floor right in front of the closed bedroom door, seen from behind and slightly from her right side, "
        "bending a little forward, holding the vacuum wand with both hands; the canister vacuum cleaner sits on the floor just right "
        "of her feet. She wears a navy-and-white striped long-sleeve top and loose grey wide-leg trousers. Her face is not visible.",
        "morning: soft, clear, slightly cool daylight from the left, neutral-cool white balance, all lamps off.",
        "A poster of a fictional indie band (four blurry figures, no readable letters) is taped to the middle of the bedroom door.")
    J["S04"] = {"refs": [str(V / "ego/refs/R1.jpg")], "prompt": " ".join([
        STILL,
        "Image 1 is this film's living room. Keep its camera, framing, walls, door and every piece of furniture exactly. Nobody is in "
        "the room. A poster of a fictional indie band (four blurry figures, no readable letters) is taped to the middle of the bedroom "
        "door. Light and time: early evening — warm amber low sunlight streams in from the right side of the frame and lays long "
        "golden streaks across the floor and the lower part of the door; the table lamp on the side table is switched on and glows "
        "warm; the rest of the room falls into soft warm shadow.", CAM, FINISH])}
    J["S07"] = wide("S07_배치.jpg", EUN40, EUN40_REFS,
        "She sits slumped on the floor to the RIGHT of the closed bedroom door, in front of the small side table, legs folded to one "
        "side, leaning back on one hand, her back three-quarters to the camera and her face turned left toward the door as she shouts "
        "at it in exasperation. "
        "She wears a loose white sleeveless linen top and khaki shorts. A white electric fan on a stand turns beside her at the right; "
        "a bamboo summer mat lies on the floor near the sofa, and a round paper hand fan lies on the floor.",
        "a hot summer midday: bright white daylight from the left, bright but soft and not blown out — the brightest scene of the "
        "film, still with gentle film exposure; pale warm-neutral tones.",
        "A small stack of exam workbooks sits on the floor at the right edge of the door, no readable covers; the poster on the door is "
        "gone.")
    sil11 = "S11_배치.jpg"
    body11 = ("Two people stand at the open bedroom door, both full-length and small in the frame: on the left of the doorway THE "
              "MOTHER stands with her back to the camera, slightly turned toward her daughter; in the doorway on the right THE "
              "DAUGHTER faces her mother, upset, her right hand raised as she points back into her room. THE MOTHER is " + EUN40 +
              " (Images 2 to 5), wearing a mustard knit vest over a white shirt and light trousers. THE DAUGHTER is a young Korean "
              "woman in her early twenties (Images 6 to 8) with long straight jet-black hair tied in a low ponytail, wearing an "
              "interview outfit: a white blouse and black slacks. A dark suit jacket in a dry-cleaner's clear plastic cover hangs on "
              "a hanger hooked over the top of the open door. Each keeps her own face; do not mix their faces.")
    body11 += (" Keep the silhouettes' scale and depth exactly — do not bring them closer to the camera: their heads are at about 29% "
               "of the frame height from the top, their feet at about 82%, and the two figures together span only about 45%–60% of "
               "the frame width, standing right at the door.")
    light11 = "an overcast afternoon: soft diffused daylight with a faint pink-lavender tint, gentle shadows, lamps off."
    J["S11a"] = {"refs": [str(B / sil11)] + EUN40_REFS + JIYU_REFS, "prompt": " ".join([
        STILL,
        "Image 1 is this film's living room with two solid black silhouette placeholders in it. Keep Image 1's camera position, "
        "framing and lens exactly, and keep every wall, the door and every piece of furniture where it is. Paint the two people "
        "described below exactly inside the two black silhouettes' outlines, in their poses: each person fills her outline and does "
        "not extend beyond it, so both are exactly as large and as far from the camera as the silhouettes — nothing of the "
        "silhouettes remains. Outside the outlines, change only the lighting described below. The bedroom door is open inward.",
        "Images 2 to 8 " + IDREF, body11, f"Light and time: {light11}", CAM, FINISH])}
    J["S11c"] = J["S11a"]   # 1판(S11a)은 「같은 자리 · 크기」만 써서 두 사람이 원본보다 카메라 쪽으로 나왔다 — 테두리 안에 그리라는 판
    # 3번 1판은 실루엣보다 17% 크고, 문의 포스터가 4번 판과 다른 그림이었다(Fable 1차 P2) — 테두리 지시문 + 4번 2판(S04b)의 포스터를 참조로
    J["S03c"] = {"refs": J["S03"]["refs"] + [str(V / "ego/refs/S04.jpg")], "prompt": J["S03"]["prompt"].replace(
        "A poster of a fictional indie band (four blurry figures, no readable letters) is taped to the middle of the bedroom door.",
        "Image 6 shows the same door in the evening: the poster taped to the middle of the bedroom door must be exactly that poster "
        "— copy it as it is, with no caption line under the figures.")}
    J["S11b"] = {"refs": [str(B / "S11_실루엣만.jpg")] + EUN40_REFS + JIYU_REFS, "prompt": " ".join([
        STILL,
        "Image 1 is a layout guide: the black silhouettes on the plain grey background show only where the two people are in the "
        "frame, how big and in what pose — match that placement, size and pose. The silhouettes have no faces, clothes or colors to "
        "copy. Location: " + ROOM1 + " The bedroom door in the center is open inward.", "Images 2 to 8 " + IDREF, body11,
        f"Light and time: {light11}", CAM, FINISH])}
    J["S12"] = wide("S12_배치.jpg", EUN40, EUN40_REFS,
        "She sits on the piano bench in front of the piano at the left, turned toward the closed bedroom door, hands resting on her "
        "knees, speaking softly toward the door; seen from the front-left, small in the frame, her face in shadow. She wears a "
        "burgundy cardigan over a dark top and dark trousers. Her face is in shadow, not readable.",
        "late at night, very low-key: the lamp is the only light, the walls and the piano fall to near-black; only the small table lamp on the side table at the right glows warm amber; the rest of the "
        "room sinks into deep blue-grey darkness, with faint cool moonlight from the left.")
    J["S14"] = wide("S14_배치.jpg", EUN40, EUN40_REFS,
        "She walks toward the closed bedroom door from the left, seen from behind and a little from her left side, carrying a white "
        "gift box tied with a red ribbon in both arms in front of her, barefoot. She wears a loose sage-green blouse and black cropped "
        "trousers.",
        "a bright, clear day: crisp white daylight with soft shadows, slightly cool, lamps off.")
    # 14번 원본은 엄마 왼쪽 다리에 흰 보조기 · 조금 절뚝임(51.4–53.2초 — 아르곤 시험이 찾음) — 1판(S14)에 없어 보조기 판
    J["S14b"] = wide("S14_배치.jpg", EUN40, EUN40_REFS,
        "She walks toward the closed bedroom door from the left, seen from behind and a little from her left side, carrying a white "
        "gift box tied with a red ribbon in both arms in front of her, barefoot, limping slightly: her LEFT lower leg is in a white "
        "orthopedic walking brace (a short white plastic boot brace with velcro straps over the calf and foot), her right foot bare. "
        "She wears a loose sage-green blouse and black cropped trousers. She keeps the back of her head to the camera; her face is not "
        "visible.",
        "a bright, clear day: crisp white daylight with soft shadows, slightly cool, lamps off.")
    J["S16"] = wide("S16_배치.jpg", EUN40, EUN40_REFS,
        "She stands perfectly still close to the closed bedroom door, facing it, her back to the camera, her arms hanging down — as if "
        "she wanted to knock but did not. She wears a deep plum cardigan and a long dark skirt. A thin warm line of light glows under "
        "the bedroom door: someone is inside.",
        "deep night: the room is very dark, in purple-blue darkness, lit only by faint cool light from a window outside the frame at "
        "the left; no lamps on in the living room.")
    J["S18"] = wide("S18_배치.jpg", EUN50, EUN50_REFS,
        "She is vacuuming the floor in front of the closed bedroom door, seen from behind and slightly from her right side, holding "
        "the vacuum wand; the canister vacuum sits on the floor at the lower right, at about 72–80% of the frame width, its hose running "
        "from her right hand; the red poinsettia stays on the cabinet. She wears a soft oat-beige knit cardigan "
        "over a pale blue shirt and a long dark-beige skirt. Her face is not visible.",
        "an overcast winter day: soft, cool blue-grey daylight from the left, calm and quiet, lamps off.")

    # ── 끝 넷(새 카메라 자리) ── 배치도 = 사람을 지우고 크게 흐린 원본 + 검은 실루엣
    J["S20"] = {"refs": [str(B / "K20_배치.jpg")], "prompt": " ".join([
        STILL,
        "Location: the empty bedroom of a grown daughter who has moved out, in a Korean apartment, kept neat as she left it — late "
        "December, an overcast snowy day. Image 1 is a heavily blurred layout guide of this exact shot: match its camera position, "
        "height, lens and framing, and where the large shapes sit — the desk and chair at the left, the bed at the right, the window "
        "at the top right — but ignore its blur, colors and exact objects. On the left: a light-wood desk with a simple chair pushed "
        "in, a small bookshelf of old schoolbooks, a round tabletop mirror on a small round side table between the desk and the bed. "
        "On the right: a single bed with a light-oak slatted headboard against the wall, neatly made with THE NEW WINTER BLANKET. "
        + BLANKET + " At the top right, a window with sheer white curtains; outside, big soft snowflakes fall and the neighboring "
        "apartment buildings are faint grey shapes behind the snow. A small framed pressed-flower print hangs on the wall. Nobody is "
        "in the room. Camera: a medium-wide shot from just inside the doorway at standing eye level, about 35mm lens, moving slowly "
        "sideways (film still from that move). Light: soft, cool blue-grey winter daylight from the window, with the warm blanket the "
        "warmest color in the room.", FINISH])}
    # S20 1판은 침대가 화면 가운데(헤드보드 44~63%)로 오고 거울이 네모였다 — 원본 첫 프레임 자리를 숫자로 못 박은 2판
    J["S20b"] = {"refs": [str(B / "K20_배치.jpg")], "prompt": " ".join([
        STILL,
        "Location: the empty bedroom of a grown daughter who has moved out, in a Korean apartment, kept neat as she left it — late "
        "December, an overcast snowy day. Image 1 is a heavily blurred layout guide of this exact shot: match its camera position, "
        "height, lens and framing, and where the large shapes sit — but ignore its blur, colors and exact objects. Exact placement "
        "(measured from the left edge of the frame): a light-wood desk runs along the bottom-left, from the left edge to about 45% of "
        "the width, with a simple wooden chair pushed in at about 10%–35%, its seat near the bottom edge; two stacked pale storage "
        "boxes stand at about 42%–52% just right of the desk; a small round side table at about 58%–70% holds a ROUND tabletop mirror "
        "with a thin light-wood frame on a stand; the single bed is in the RIGHT third of the frame — its light-oak slatted headboard "
        "against the back wall at about 66%–84% of the width and its foot running off the right edge — neatly made with THE NEW "
        "WINTER BLANKET. " + BLANKET + " Only a narrow strip of the window shows at the very top-right corner, with sheer white "
        "curtains; through it, big soft snowflakes fall in front of faint grey apartment buildings. A small framed "
        "pressed-flower print hangs on the wall above the storage boxes. Nobody is in the room. Camera: a medium-wide shot from just "
        "inside the doorway at standing eye level, about 35mm lens, square to the back wall, moving slowly sideways (a still from "
        "that move). Light: soft, cool blue-grey winter daylight from the window, the warm blanket the warmest color in the room.",
        FINISH])}
    J["S19"] = {"refs": [str(B / "S19_배치.jpg")] + EUN50_REFS, "prompt": " ".join([
        STILL,
        "Image 1 is a layout guide: the black silhouette shows only where the woman is in the frame, how big and in what pose — match "
        "that placement, size and pose, and the place of the door and its frame behind the blur. The silhouette has no face, clothes "
        "or colors to copy. Images 2 to 5 " + IDREF + " The woman is " + EUN50 + ".",
        "MEDIUM SHOT FROM BEHIND, over her shoulder: she stands right at the closed light-oak door of her daughter's bedroom with her "
        "back to the camera, her head and shoulders filling the right-center of the frame; her right hand rests on the edge of the "
        "door as she slowly pushes it open a crack. Her face is not visible — only the back of her head and at most the edge of her "
        "right cheek. She wears a soft oat-beige knit cardigan over a pale blue shirt. The door with "
        "its two recessed panels fills the background; a small white light switch on the wall at the far left.",
        "Camera: handheld-free, slow push-in, 50mm lens, at her shoulder height. Light: soft, cool overcast winter daylight from the "
        "left, calm.", FINISH])}
    J["S21"] = {"refs": [str(B / "S21_배치.jpg")] + EUN50_REFS + [str(V / "ego/refs/S20.jpg")], "prompt": " ".join([
        STILL,
        "Image 1 is a layout guide: the black silhouette shows only where the woman's head and shoulders are in the frame, how big "
        "and at what angle — match that placement, size and angle. It has no face, clothes or colors to copy. Images 2 to 5 " + IDREF
        + " The woman is " + EUN50 + ". Image 6 shows the room she is looking at — use it only for the soft, out-of-focus background.",
        "CLOSE-UP IN PROFILE: her face in left profile, turned to the left, fills the center-right of the frame from the top of her "
        "head (cut off by the top edge) to her shoulders (cut off by the bottom edge); she looks quietly into her daughter's empty "
        "room. Her lips are closed and relaxed; her eyes are open, looking slightly down into the room, calm and a little moist (no "
        "tears running); a tender, wistful expression — not a smile, "
        "not blank. She wears a soft oat-beige knit cardigan over a pale blue shirt. Behind her, far out of focus: the pale room and "
        "a bright window.",
        "Camera: almost still, 85mm lens, at her eye level, shallow depth of field. Light: soft window daylight on her face with a "
        "touch of warmth on her skin; the background stays cool blue-grey.", FINISH])}
    J["S22"] = {"refs": [str(B / "S22_배치.jpg")] + EUN50_REFS + [str(V / "ego/refs/S20.jpg")], "prompt": " ".join([
        STILL,
        "Image 1 is a layout guide: the black silhouette shows only where the woman is in the frame, how big and in what pose — match "
        "that placement, size and pose, and the place of the door frame on the left and the half-open door on the right. It has no "
        "face, clothes or colors to copy. Images 2 to 5 " + IDREF + " The woman is " + EUN50 + ". Image 6 is her daughter's bedroom "
        "seen from inside — the bed, the round mirror on the small side table and THE NEW WINTER BLANKET must look the same.",
        "SHOT THROUGH THE GAP OF THE HALF-OPEN BEDROOM DOOR from the hallway: the dark wooden door frame on the left and the edge of the "
        "half-open door on the right frame a narrow view into the room. Inside, she is just sitting down on the edge of the single bed "
        "with the light-oak slatted headboard, bending forward slightly as she lowers herself, one hand reaching to the bed; she is "
        "seen from the side, her face mostly hidden by her hair. THE NEW WINTER BLANKET is on the bed beside her. " + BLANKET +
        " The folded top of the blanket shows the brick-red reverse exactly as in Image 6. A round tabletop mirror on a small round "
        "side table at the left of the bed. A small wall switch panel on the hallway wall at the right, with no readable text. She "
        "wears a soft oat-beige knit cardigan over a pale blue shirt and a long dark-beige skirt.",
        "Camera: fixed, 50mm lens, at standing eye level from the hallway. Light: soft, cool overcast winter daylight from the "
        "bedroom window; the hallway side is a little darker. Exposure: low-key and soft like a quiet Korean film — slightly "
        "underexposed, the white walls read as soft grey, never bright white.", FINISH])}
    # S22 1판(10-26 02:24)은 방 · 이불 · 거울이 20번과 맞지만 엄마가 이미 다 앉아 있고(원본 첫 프레임은 앉는 중 — 허리를 숙여 머리가 앞으로)
    # 원본보다 한 스톱 어두웠다(중앙값 42 ↔ 81, 노출 줄 탓) — 앉는 중 · 자리 숫자 · 노출 줄 대신 고른 빛으로
    J["S22b"] = {"refs": J["S22"]["refs"], "prompt": J["S22"]["prompt"].replace(
        "Inside, she is just sitting down on the edge of the single bed with the light-oak slatted headboard, bending forward slightly "
        "as she lowers herself, one hand reaching to the bed; she is seen from the side, her face mostly hidden by her hair.",
        "Inside, she is caught in the middle of sitting down on the edge of the single bed with the light-oak slatted headboard — NOT "
        "yet seated: knees bent, her body bent forward at the hips, her head bowed low so her chin-length hair falls forward and hides "
        "her face, one hand reaching down toward the blanket. She is seen from the side; her figure spans about 32%–62% of the frame "
        "width with the top of her head at about 12% of the frame height, her head near the headboard. The edge of the half-open door "
        "is at about 62%–80% of the frame width, the hallway wall beyond it at the far right.").replace(
        " Exposure: low-key and soft like a quiet Korean film — slightly underexposed, the white walls read as soft grey, never bright "
        "white.", " The room is evenly lit, neither dark nor bright; the hallway walls are a soft mid grey.")}
    # S19 1판은 문이 가로 칸 셋의 다른 문이었다 — 거실 컷의 그 문(세로로 긴 칸 둘 · 둥근 놋쇠 손잡이)을 참조로, 원본 첫 프레임처럼 아직 닫힌 채
    J["S19b"] = {"refs": J["S19"]["refs"] + [str(V / "ego/refs/R3.jpg")], "prompt": J["S19"]["prompt"].replace(
        "her right hand rests on the edge of the door as she slowly pushes it open a crack.",
        "her right hand rests on the round brass knob at the right edge of the door, about to open it — the door is still closed. The "
        "door is exactly the bedroom door in Image 6: plain light oak with two tall recessed panels and a round brass knob, in a "
        "simple wooden frame (Image 6 is only for the door's design).")}
    # S19b는 문 · 자리는 맞았지만 18 · 20 · 21번 사이에서 혼자 따뜻하고 밝았다(중앙값 130, 원본 62) — 그 판을 편집해 빛만 우리 18번 컷처럼 차갑게
    J["S19c"] = {"refs": [str(V / "ego/refs/S19b.jpg"), str(V / "ego/refs/S18.jpg")], "prompt": " ".join([
        "Edit this photograph (Image 1). Keep the woman exactly as she is — her face, hair, clothes, pose and her right hand on the "
        "brass knob — and keep the door, the small panel on the left wall, the camera and the framing exactly as they are. Change "
        "only the light and colour, to match Image 2 — the same overcast winter afternoon a moment earlier, in the living room just "
        "outside this door: soft, cool blue-grey daylight, all lamps off, no warm light anywhere. The light-oak door becomes a "
        "muted, cool greyish brown in soft shade; the wall becomes a cool pale blue-grey; her oat-beige cardigan looks greyish beige "
        "in this cool light. Make the whole frame about one stop darker than Image 1 — gently underexposed, quiet and still. Use "
        "Image 2 only for its light and colour, not for its room or people. Turn her head a little further toward the door, so "
        "only the back of her head, her right ear and the faint edge of her cheek show.",
        "Photorealistic film still with the same slight film grain. No text, no letters, no logos, no watermarks."])}
    # Fable 2차 P1(10-26): S01c는 손은 뗐지만 딸이 문의 반대쪽(54~75% ↔ 원본 38~61%)에 다리를 나란히 하고 서 있었고(발목까지 보임),
    # S07은 엄마가 문 오른쪽 반에 등을 기대고 문 반대쪽을 보며 소리쳤다(46~71% ↔ 66~88%, 키 1.35배) — 자리를 문 기준으로 못 박아 다시
    J["S01d"] = {"refs": J["S01"]["refs"], "prompt": J["S01"]["prompt"].replace(
        "her hand is NOT on the door knob yet.",
        "her hand is NOT on the door knob yet. PLACEMENT MATTERS MOST: her body covers the LEFT half of the bedroom door and the wall "
        "left of it — her spine at about 48% of the frame width, the right half of the door and its brass knob visible to her RIGHT; "
        "she spans about 38%–61% of the frame width. She is very close to the camera: the top of her head at about 10% of the frame "
        "height, and her legs are cut off just below the knees by the bottom edge — her feet are NOT in the frame. Do not keep the "
        "whole figure inside the frame. One leg is a step ahead of the other, mid-walk.")}
    J["S07b"] = {"refs": J["S07"]["refs"], "prompt": J["S07"]["prompt"].replace(
        "She sits slumped on the floor to the RIGHT of the closed bedroom door, in front of the small side table, legs folded to one "
        "side, leaning back on one hand, her back three-quarters to the camera and her face turned left toward the door as she shouts "
        "at it in exasperation. ",
        "She sits on the floor entirely to the RIGHT of the door frame — the door is at her LEFT and the small side table directly "
        "behind her; her figure spans only about 66%–88% of the frame width. She is slumped low on the floor: the top of her head at "
        "about 60% of the frame height, lower than the door knob; her legs stretched out to the right toward the fan, leaning back on "
        "one hand. Her face is in profile turned LEFT toward the door, mouth open, shouting at the door in exasperation. She does NOT "
        "lean on the door and does NOT look away from it. ")}
    # 위 두 판이 또 안 먹으면(사람 상자가 원본 ±5점 밖) 고른 판을 편집으로 옮긴다 — Fable 2차 「안 먹으면 편집으로」
    EDIT_KEEP = "Photorealistic film still with the same slight film grain. No text, no letters, no logos, no watermarks."
    # S01d(10-26 02:31)는 가로 자리가 맞았고(41~60% ↔ 38~61%) 아직 작다(머리 20% ↔ 10%) — 그 판을 편집해 크기만 키운다
    J["S01e"] = {"refs": [str(V / "ego/refs/S01d.jpg")], "prompt": " ".join([
        "Edit this photograph (Image 1). Change only the girl's size: make her bigger, as if she were about one step closer to the "
        "camera — the top of her head at about 10% of the frame height, and her legs cut off just below the knees by the bottom edge "
        "of the frame, so her calves and feet are NOT in the frame. Keep her horizontal place (her body between about 38% and 61% of "
        "the frame width, covering the left half of the bedroom door), her walking pose toward the door, her clothes, hair and "
        "backpack, and keep everything else exactly — the room, the door and the light.", EDIT_KEEP])}
    J["S07c"] = {"refs": [str(V / "ego/refs/S07.jpg")], "prompt": " ".join([
        "Edit this photograph (Image 1). Change only the woman's place, size and head: move her to the RIGHT so that she sits on the "
        "floor entirely to the right of the door frame, in front of the small side table — her figure between about 66% and 88% of "
        "the frame width — and a little smaller, as she is farther from the camera: the top of her head at about 60% of the frame "
        "height, lower than the door knob; her legs stretched out to the right toward the fan. Turn her head so her face is in "
        "profile toward the door at her left, mouth open, shouting at the door. Where she was, show the door and the floor as they "
        "are. Keep everything else exactly — the room, the light, her clothes, the electric fan, the bamboo mat and the paper fan.",
        EDIT_KEEP])}
    # Fable 2차 P2: 21번 얼굴이 원본보다 오른쪽(코끝 53% ↔ 40%) — 「center-right」가 실루엣(38~95%)과 어긋나 모델이 글을 따랐다.
    # 보드는 S21 그대로 두고, 영상 시작 그림(480p 시험 전)은 이 판으로 굽는다
    J["S21b"] = {"refs": J["S21"]["refs"], "prompt": J["S21"]["prompt"].replace(
        "fills the center-right of the frame from the top of her head",
        "is placed with the tip of her nose at about 40% of the frame width and the back of her head reaching about 95% (near the "
        "right edge); it fills the frame from the top of her head")}
    # S21b(10-26 21:17)도 똑바른 옆얼굴이라 얼굴이 그대로 오른쪽(55~96% ↔ 원본 38~95%)이었다 — 원본 21번은 엄마의 왼쪽 어깨 뒤에서 비스듬히 본
    # 돌아선 옆얼굴(머리 뒤 · 머리칼이 크게 보이고 얼굴은 가장자리만)이라 코끝이 40%에 온다. 잘라 맞추면 머리가 원본보다 커져(턱 83% ↔ 60%대) 새로 굽는다
    J["S21c"] = {"refs": J["S21"]["refs"], "prompt": J["S21"]["prompt"].replace(
        "CLOSE-UP IN PROFILE: her face in left profile, turned to the left, fills the center-right of the frame from the top of her "
        "head (cut off by the top edge) to her shoulders (cut off by the bottom edge); she looks quietly into her daughter's empty "
        "room.",
        "CLOSE-UP FROM BEHIND HER LEFT SHOULDER, THREE-QUARTER BACK VIEW (a lost profile), exactly like the black silhouette in "
        "Image 1: she faces the left side of the frame and her head is turned away from the camera, so we mostly see the back of "
        "her head and her dark chin-length bob, with only the edge of her left cheek, nose and lips at the left side of her head — the tip of her nose at about "
        "40% of the frame width, the back of her hair reaching about 80%. Her head fills the frame from the top edge (cut off) down "
        "to about 62% of the frame height; her neck and shoulders fill the lower part of the frame. She looks down to the left into "
        "her daughter's empty room.")}
    # S21c(10-26 23:37)는 코끝 41%로 자리가 맞았고 머리가 원본보다 작아 가운데를 잘라 맞춘다(80.6%, 사람 40~95% ↔ 38~95%) —
    # 다만 밝기가 150으로 원본(97)과 앞뒤(20번 127 · 22번 81)보다 튄다. 원본은 20 → 21 → 22로 차츰 어두워지니 빛만 편집으로 2/3스톱 낮춘다
    J["S21d"] = {"refs": [str(V / "ego/refs/S21c.jpg")], "prompt": " ".join([
        "Edit this photograph (Image 1). Change only the light: make the whole picture about two-thirds of a stop darker and softer, "
        "like a dim overcast late afternoon in winter with every lamp in the room off — the window light behind her is weaker and "
        "greyer, the white wall falls to a soft mid-grey, and her face and hair are in gentle low light, still readable but no longer "
        "bright. Keep her, her pose, her head turned down to the left, her hair, her cardigan, the camera, the framing and every object "
        "in the room exactly as they are.", EDIT_KEEP])}
    # Fable 2차 P2: 밤 둘(12 · 16)이 원본의 두 배 밝고 12는 얼굴이 읽힌다 — 고른 판을 편집으로 한 번 더 어둡게(목표 중앙값 26~43)
    NIGHT_KEEP = ("Keep her pose, clothes and place, the camera and the framing exactly. Photorealistic film still with the same slight "
                  "film grain. No text, no letters, no logos, no watermarks.")
    J["S12v2"] = {"refs": [str(V / "ego/refs/S12.jpg")], "prompt": " ".join([
        "Edit this photograph (Image 1). Make this a true night, about one stop darker: the small table lamp on the side table at the "
        "right is the ONLY light — more than two meters from it everything sinks to near-black; the walls, the piano, the sofa and the "
        "plant are barely visible dark shapes; the woman's face falls into shadow, not readable.", NIGHT_KEEP])}
    J["S16v2"] = {"refs": [str(V / "ego/refs/S16b.jpg")], "prompt": " ".join([
        "Edit this photograph (Image 1). Make this a true night, about one stop darker: the thin warm line of light under the bedroom "
        "door and a faint cool glow from a window at the left are the ONLY lights — everything else sinks to near-black; the walls, "
        "the low sideboard, the sofa and the plant are barely visible dark shapes; the woman is a dark figure seen from behind. Keep "
        "the thin line of light under the door exactly.", NIGHT_KEEP])}
    # 원본 12번은 첫 · 끝 프레임 모두 문 밑으로 따뜻한 불빛이 가늘게 샌다(딸이 안에 있다 — 10-26 확대로 찾음) — 밤 편집 판(S12v2)에 그 빛줄만 더한다
    J["S12v3"] = {"refs": [str(V / "ego/refs/S12v2.jpg")], "prompt": " ".join([
        "Edit this photograph (Image 1). Add only one thing: a thin warm line of light glowing under the closed bedroom door, along the "
        "gap between the bottom of the door and the floor — someone is inside the room with the light on. Keep everything else exactly "
        "as it is — the darkness, the table lamp, the woman, her pose and place, the camera and the framing.", NIGHT_KEEP])}
    # 11번 두 단계(10-25 저녁): 두 사람을 한 장에 시키면 S11a · S11b · S11c 모두 원본보다 크게 · 가깝게 나왔다(얼굴을 보이려 당김).
    # 한 명씩 테두리 지시는 14 · 16번에서 크기가 맞았으니 — ① 엄마만(S11m) ② 그 판에 딸을 더함(S11d, 배치도 = S11m 결과 + 딸 실루엣)
    J["S11m"] = {"refs": [str(B / "S11m_배치.jpg")] + EUN40_REFS, "prompt": " ".join([
        STILL,
        "Image 1 is this film's living room with one solid black silhouette placeholder in it, at the left side of the open bedroom "
        "door. Keep Image 1's camera, framing and lens exactly, and every wall, the door and every piece of furniture where it is. "
        "Paint THE MOTHER exactly inside the silhouette's outline, in its pose — she fills the outline and does not extend beyond it: "
        "the top of her head at about 29% of the frame height from the top, her feet at about 81%, and she spans only about 45%–54% "
        "of the frame width; she is small, full-length, standing right at the door. Outside the outline, change only the lighting "
        "described below. The bedroom door is open inward; the doorway to the right of her is EMPTY (nobody stands in it yet). A "
        "dark suit jacket in a dry-cleaner's clear plastic cover hangs on a hanger hooked over the top of the open door.",
        "Images 2 to 5 " + IDREF + " THE MOTHER is " + EUN40 + ". She stands with her back to the camera, slightly turned to the "
        "right toward the doorway, wearing a mustard knit vest over a white shirt and light trousers. Her face is not visible.",
        "Light and time: an overcast afternoon: soft diffused daylight with a faint pink-lavender tint, gentle shadows, lamps off.",
        CAM, FINISH])}
    J["S11d"] = {"refs": [str(B / "S11d_배치.jpg")] + JIYU_REFS, "prompt": " ".join([
        "Edit this photograph (Image 1). It is a film still of a Korean living room with a mother standing at the left side of an "
        "open bedroom door and a solid black silhouette placeholder in the doorway. Paint THE DAUGHTER exactly inside the black "
        "silhouette's outline, in its pose — she fills the outline and does not extend beyond it: the top of her head at about 31% "
        "of the frame height from the top, her feet at about 82%, and she spans only about 54%–60% of the frame width. Keep "
        "everything else exactly as in Image 1 — the camera, framing, light, the room, the door, the hanging jacket and the mother.",
        "Images 2 to 4 " + IDREF + " THE DAUGHTER is a young Korean woman in her early twenties with long straight jet-black hair "
        "tied in a low ponytail, wearing an interview outfit: a white blouse and black slacks. She faces her mother, upset, her "
        "right hand raised as she points back into her room. Photorealistic, same film grain and light as Image 1. No text, no "
        "logos, no watermarks."])}
    # S11d(10-26 03:03)는 딸을 문간에 맞게 그렸지만 엄마까지 피아노 앞(29~36%)으로 옮기고 키웠다 — 「실루엣 밖은 그대로 · 엄마는 움직이지 않음」을 못 박고,
    # 딸 몸짓을 작게(가리키는 팔이 자리를 넓혔다)
    J["S11e"] = {"refs": J["S11d"]["refs"], "prompt": " ".join([
        "Edit this photograph (Image 1). Paint THE DAUGHTER only inside the solid black silhouette standing in the open doorway: she "
        "fills that outline exactly and does not extend beyond it — the top of her head at about 31% of the frame height, her feet at "
        "about 82%, within about 54%–60% of the frame width. Every pixel outside the black silhouette stays exactly as it is in Image "
        "1 — in particular THE MOTHER at the left side of the doorway stays exactly where she is, the same size and the same pose, "
        "with her back to the camera; do not move, resize or turn her. Do not change the camera, the framing, the light, the room, "
        "the door or the hanging jacket.",
        "Images 2 to 4 " + IDREF + " THE DAUGHTER is a young Korean woman in her early twenties with long straight jet-black hair "
        "tied in a low ponytail, wearing an interview outfit: a white blouse and black slacks. She faces her mother, upset, one hand "
        "slightly raised at her side. Photorealistic, same film grain and light as Image 1. No text, no logos, no watermarks."])}
    # Fable 2차-b P2(10-26) — 보드는 그대로 두고 영상 시작 그림 단계(끝 넷 480p 시험 전)에 굽는다:
    # 19번은 엄마가 원본보다 13점 왼쪽(31~79% ↔ 46~87%, 오른쪽이 문짝으로 참), 22번은 문틈이 넓고(방 5~60% ↔ 27~62%) 카메라가 낮아 엄마가 7~9점 아래
    J["S19d"] = {"refs": [str(V / "ego/refs/S19c.jpg")], "prompt": " ".join([
        "Edit this photograph (Image 1). Change only the framing: the camera moves to the left, so the woman now stands between about "
        "46% and 87% of the frame width, the center of her head at about 57%. The left part of the frame (0–45%) shows the wall, the "
        "small panel on it and the door frame; a narrow strip of the pale wall remains at the far right edge (85–100%). Keep her height "
        "in the frame (the top of her head at about 6%, cut off at the bottom edge), her pose with her right hand on the brass knob, "
        "her clothes, the door and the cool winter light exactly.", EDIT_KEEP])}
    J["S22c"] = {"refs": J["S22b"]["refs"], "prompt": J["S22b"]["prompt"].replace(
        "her figure spans about 32%–62% of the frame width with the top of her head at about 12% of the frame height, her head near "
        "the headboard. The edge of the half-open door is at about 62%–80% of the frame width, the hallway wall beyond it at the far "
        "right.",
        "her figure spans about 31%–62% of the frame width with the top of her head at about 14% of the frame height, her head near "
        "the headboard. The room is seen only through a NARROW gap between about 27% and 62% of the frame width: the hallway wall "
        "with a small white panel fills the left 0–27%, and the edge of the half-open door is at about 62%–80%, the hallway wall "
        "beyond it at the far right. The camera is at a standing adult's eye level, looking slightly down into the room, so the top "
        "of the mattress is at about 80% of the frame height.")}
    # Fable 3차 P2(10-27): S22c는 문틈은 맞았지만 카메라가 여전히 낮다 — 원본 머리판 윗선 47% · 매트리스 80% · 거울 65~80% · 엄마 머리 14%
    # ↔ 우리 33% · 62~65% · 48~60% · 29%. 「매트리스 80%」를 글로 시킨 S22c도 안 따랐으니 11번처럼 두 단계로 —
    # ① K22: 사람을 지우고 크게 흐린 원본(배치/S22_흐림) 위에 빈 방 판(거실 판 · K20이 원본 카메라 높이를 지킨 길) ② S22e: 그 판에 엄마 실루엣만 그려 넣음.
    # 같은 차례에 숫자를 더 박은 한 번에 판(S22d — Fable 3차 고칠 말)도 견준다
    J["K22"] = {"refs": [str(B / "K22_배치.jpg"), str(V / "ego/refs/S20.jpg")], "prompt": " ".join([
        STILL,
        "Image 1 is a heavily blurred layout photo of this exact shot: from a hallway we look through the gap of a half-open bedroom "
        "door into the bedroom. Keep Image 1's camera position, height, angle, framing and lens EXACTLY, and put every big shape "
        "exactly where it is in Image 1: the pale hallway wall on the left (about 0–22% of the frame width) with a small framed wall "
        "switch panel on it, the dark wooden door frame (about 22–25%), the narrow view into the bedroom between about 25% and 62%, "
        "the dark wooden edge of the half-open door between about 62% and 80%, and the pale hallway wall with a small switch panel at "
        "the far right. The camera is at a standing adult's eye level and looks slightly DOWN into the room.",
        "Inside the room, seen through the gap: the single bed with the light-oak slatted headboard against the back wall — the top of "
        "the headboard at about 47% of the frame height and the top of the mattress at about 80%; a round tabletop mirror on a small "
        "round side table at the left of the bed — the mirror between about 65% and 80% of the frame height; pale walls. Image 2 is "
        "this same bedroom seen from inside — the bed, the headboard, the round mirror, the side table and THE NEW WINTER BLANKET must "
        "look exactly the same. " + BLANKET + " The folded top of the blanket shows the brick-red reverse exactly as in Image 2. The "
        "room is EMPTY — nobody is in it.",
        "Camera: fixed, 50mm lens. Light: soft, cool overcast winter daylight from the bedroom window; the hallway side is a little "
        "darker; the room is evenly lit, neither dark nor bright; the hallway walls are a soft mid grey. The switch panels have no "
        "readable text.", FINISH])}
    J["S22e"] = {"refs": [str(B / "S22e_배치.jpg")] + EUN50_REFS, "prompt": " ".join([
        "Edit this photograph (Image 1). Paint THE MOTHER only inside the solid black silhouette seen through the door gap: she fills "
        "that outline exactly and does not extend beyond it — the top of her head at about 14% of the frame height, her figure within "
        "about 31%–62% of the frame width. Every pixel outside the black silhouette stays exactly as it is in Image 1 — the camera, the "
        "framing, the light, the hallway walls, the door frame, the half-open door, the bed, the blanket, the headboard and the mirror.",
        "Images 2 to 5 " + IDREF + " THE MOTHER is " + EUN50 + ". She is only beginning to sit down on the edge of the bed — still "
        "standing beside it, bent forward at the hips, her head bowed so her chin-length hair falls forward and hides her face, one "
        "hand reaching down toward the blanket. She wears a soft oat-beige knit cardigan over a pale blue shirt and a long dark-beige "
        "skirt. Photorealistic, the same film grain and light as Image 1. No text, no logos, no watermarks."])}
    J["S22d"] = {"refs": J["S22c"]["refs"], "prompt": J["S22c"]["prompt"].replace(
        "caught in the middle of sitting down on the edge of the single bed with the light-oak slatted headboard — NOT yet seated: "
        "knees bent, her body bent forward at the hips, her head bowed low so her chin-length hair falls forward and hides her face, "
        "one hand reaching down toward the blanket.",
        "only beginning to sit down on the edge of the single bed with the light-oak slatted headboard — still standing beside it, her "
        "hips above the mattress, her back bent forward at about 45°, her head bowed so her chin-length hair falls forward and hides "
        "her face, one hand reaching down toward the blanket; the top of her head at about 14% of the frame height and her knees at "
        "about 86%.").replace(
        "The camera is at a standing adult's eye level, looking slightly down into the room, so the top of the mattress is at about 80% "
        "of the frame height.",
        "The camera is at a standing adult's eye level, tilted slightly DOWN into the room: the top of the mattress at about 80% of the "
        "frame height, the top of the slatted headboard at about 47%, and the round mirror between about 65% and 80% of the height — "
        "the headboard is far below her bowed head.")}
    # 2판 이름(거실 판 2판 위에서 다시 굽는 컷) — 지시문은 위 그대로, 배치도는 2판 거실 위 실루엣(이미지콘티_배치도.py 합성)
    J["S01c"] = J["S01"]
    J["S04b"] = J["S04"]
    J["S16b"] = J["S16"]
    return J


if __name__ == "__main__":
    J = jobs()
    out = V / "ego" / "jobs_p6.json"
    out.write_text(json.dumps(J, ensure_ascii=False, indent=1), encoding="utf-8")
    (HERE / "지시문").mkdir(exist_ok=True)
    copy = {k: {"refs": [Path(r).name for r in v["refs"]], "prompt": v["prompt"]} for k, v in J.items()}
    (HERE / "지시문" / "이미지콘티.json").write_text(json.dumps(copy, ensure_ascii=False, indent=1), encoding="utf-8")
    for k, v in J.items():
        print(k, len(v["prompt"]), "자", len(v["refs"]), "장")
