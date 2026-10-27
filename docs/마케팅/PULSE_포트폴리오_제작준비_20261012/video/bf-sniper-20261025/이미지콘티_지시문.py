# 블프 스나이퍼 이미지 콘티 지시문(2026-10-26) → git 밖 콘티/bf-sniper/ego/jobs.json (실행기 gen.mjs가 id로 읽는다)
# 나노바나나 2.1(Gemini Ultra 웹 77yuhbs · 4 Argon · 사고 수준 높음), 대화마다 새로. 장부 S31(실루엣 배치도 + 배역 참조 + 방 기준 그림) ·
# S33(고정 얼굴 세트 · 무표정 · 생김새는 짧게) 그대로. 원본 프레임은 넣지 않고 배치도(이미지콘티_배치도.py)만 넣는다.
# 방 기준 그림(R1 · H · B · N)을 먼저 굽고, 고른 판을 정지컷/_고른판.json에 적으면 컷 지시문의 「방:R1」이 그 그림으로 바뀐다.
# 10-26 Fable 원본 대조 1차 반영: S03 카메라 1m 수평 85mm · S14 무릎 높이 로우앵글 가운데 · S10 · S12 가슴 높이에서 내려다봄 · S07 전단은 가슴(원본 실루엣대로)
# · S09 어두운 욕실 · S11 정면 · S04 · S17 링 라이트는 실루엣 배치도 + 크기 숫자 · S06 알람 둘 + 빈자리(16번이 채움) · S18 손글씨 둘레 동그라미 · 19 알람은 책상 위.
#   python -X utf8 이미지콘티_지시문.py
import json
from pathlib import Path

V = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-season4-20261025/콘티/bf-sniper")
REF = lambda n: str(V / "ego" / "refs" / n).replace("/", "\\")
LAY = lambda n: str(V / "배치" / n).replace("/", "\\")
PICKED = V / "정지컷" / "_고른판.json"
picked = json.loads(PICKED.read_text(encoding="utf-8")) if PICKED.exists() else {}
ROOM = lambda r: str(V / "받음" / picked[r]).replace("/", "\\") if r in picked else f"(방 {r} 아직)"
FACE4 = [REF("M05_hero.jpg"), REF("M05_angle-front.jpg"), REF("M05_angle-left.jpg"), REF("M05_angle-right.jpg")]

START = "Create one still photograph. A cinematic film still from a Korean deadpan comedy TV commercial, 16:9 frame."
FILM = ("Photorealistic, natural skin texture (not airbrushed, no beauty filter), realistic lens perspective, slight film grain. "
        "No text, no letters, no logos, no watermarks anywhere.")
FILM_NUM = ("Photorealistic, realistic lens perspective, slight film grain. Apart from the printed calendar numbers and the handwritten "
            "marks described, no text, no letters, no logos, no watermarks anywhere.")
DAY = ("Light: bright, clean, high-key commercial lighting — soft daylight from a large window plus warm practical lamps, cheerful and "
       "glossy like a big-brand holiday commercial. Colors: warm whites, light oak wood, soft greys, with warm amber-orange accents. "
       "No red or pink light, no colored gels, no neon.")
NIGHT = ("Light: midnight with all room lights off. The room is dark; the only light is the cold blue-white glow of the screens and the small "
         "lit displays of the phones and the clock, falling across the floor and the blanket. Deep blue-black shadows, no warm lamps.")
JUNHO = ("Images 1 to 4 are identity references of one Korean man aged 38 — keep his face exactly the same person in every detail: "
         "short black hair neatly side-parted, broad forehead, clean-shaven with a smooth jaw (no beard shadow, no stubble). "
         "Ignore the backgrounds, clothing and lighting of the reference photos. Do not add moles, marks or glasses that are not described.")
WEAR = ("He wears a plain heather-grey crewneck sweatshirt and navy track pants with no stripes, no logos, no prints; grey socks, no shoes "
        "(he is at home).")
DEADPAN = ("EXPRESSION: completely serious, focused and deadpan, like a soldier on a mission — calm neutral face, lips closed, steady eyes. "
           "No smile, no grin, no comic face-pulling.")
HAND = ("The hands belong to a Korean man in his late thirties: average male hands with short clean nails, no rings, no watch; the cuff "
        "of a heather-grey sweatshirt sleeve shows at the wrist. Only the hands and a little of the forearms are in the frame — no face.")
LAY_SIL = ("Image {n} is a layout guide: the black silhouette shows only where he is in the frame, how big and in what pose — match that "
           "placement, size and pose. It has no face, clothes or colors to copy.")
LAY_FRAME = ("Image {n} is a heavily blurred layout guide of this shot with a black silhouette where he stands: match its camera position, "
             "height and lens, where the large foreground shapes sit in the frame, and the silhouette's placement, size and pose — but "
             "ignore its blur, its colors and what the blurred objects are; they become the objects described here.")
LAY_BLUR = ("Image {n} is a heavily blurred layout guide of this shot: match its camera position, camera height, tilt and lens, and where "
            "the large shapes (the calendar grid, the hand and the pen) sit in the frame — but ignore its blur, its colors and its writing.")
ROOM_R1 = ("Location: the same Korean apartment living room as in Image {n} — light oak floor, white walls, the light-grey fabric sofa, the "
           "low oak coffee table used as an 'operation desk', the big wall calendar and the blank wall marked with a masking-tape rectangle. "
           "Use Image {n} for the room, the set dressing and the light.")
CAL = ("A large white paper wall calendar for November 2026 hangs on a white wall: a clean grid of big square day boxes with large black "
       "printed day numbers in the top-left corner of each box (the month starts on a Sunday: 1 is a Sunday, 27 is a Friday; Sunday numbers "
       "are printed in red). The day numbers run in order with no number skipped or repeated: row 1 is 1–7, row 2 is 8–14, row 3 is 15–21, "
       "row 4 is 22–28, row 5 is 29–30. The weekday header and the month title may be blank. Every day listed below as crossed out — "
       "Saturdays and Sundays too — has its own big hand-drawn red marker X across its whole box; every other box stays clean. In the box "
       "for the 27th, '00:00' is handwritten large in red marker.")


def job(id_, refs, *paras, ratio="16:9", 메모=""):
    return id_, {"ratio": ratio, "refs": refs, "prompt": " ".join(p for p in paras if p), "메모": 메모}


J = dict([
    # ── 방 기준 그림 ──
    job("R1", [],
        START,
        "Location: a bright, ordinary Korean apartment living room in the late afternoon, seen as a wide shot at standing eye level, 24mm lens. "
        "Light oak floor, white walls. On the left wall, where a big TV would go, there is NO TV: instead a large empty rectangle about "
        "170 cm wide is outlined on the wall with blue masking tape, a printed photo of a big flat-screen TV taped in its center, and next "
        "to it a child's crayon drawing taped to the wall (a huge TV with a smiling family of stick figures). In front of that wall, a low "
        "light-grey fabric sofa faces it. In the middle of the floor, a low oak coffee table set up like an 'operation desk': an open laptop, a "
        "tablet on a stand and a phone on a stand in a neat row, all three screens dark, a wired mouse, a mug. On the right wall, a big "
        "white paper wall calendar. A tall ring light on a tripod stands in the right corner, switched off. A round robot vacuum sits by "
        "the wall. A large window with sheer white curtains on the far right. Nobody is in the room.",
        DAY, FILM, 메모="거실 기준 그림 — 3 · 4 · 6 · 8 · 11 · 12 · 14 · 16 · 17의 방 참조"),
    job("H", [],
        START,
        "Location: the entrance hall (hyeongwan) of an ordinary Korean apartment, eye-level medium-wide shot from inside the flat looking toward "
        "the front door, 35mm lens. A grey steel front door with a digital door lock, the small sunken tiled floor area for shoes one step "
        "below the light oak floor, a tall white built-in shoe cabinet on the left with a few pairs of shoes and slippers neatly lined up in "
        "front, a small round mirror and a key bowl on the cabinet top, a warm ceiling light. Nobody is in the frame.",
        DAY, FILM, 메모="현관 기준 그림 — 7번 전단 컷"),
    job("B", [],
        START,
        "Location: a small, clean Korean apartment bathroom: a white sink with a chrome faucet, above it a large round frameless mirror on "
        "light-grey tiles, a toothbrush cup and a soap dispenser, a white towel on a ring. Warm bright vanity light from above the mirror. "
        "Eye-level shot facing the mirror at an angle so the camera itself is not reflected. Nobody is in the room.",
        DAY, FILM, 메모="욕실 기준 그림 — 9번 거울 컷"),
    job("N", ["방:R1"],
        START,
        "Image 1 is the same living room in the daytime. Show this exact living room at midnight, a low camera just above the floor looking "
        "across the floor, 24mm lens: all room lights are off and the window behind the sheer curtains is dark blue night. On the operation "
        "desk the laptop, the tablet and the phone on their stands are all switched ON and glowing bright blue-white; in front of them on "
        "the same desk, in a neat row like trophies, two more phones on stands and an old-fashioned twin-bell alarm clock are lit up and "
        "ringing. A grey fleece blanket lies crumpled on the floor beside the desk. Nobody is in the frame.",
        NIGHT, FILM, 메모="밤 거실 기준 그림 — 19번(00:00) 팬"),

    # ── 컷 ──
    job("S02", [LAY("S02_흐림.png")],
        START, LAY_BLUR.format(n=1),
        "Close-up of a wall calendar, shot straight on from a little to the left, 50mm lens: the whole month fills the frame. " + CAL +
        " Crossed out: every day from the 1st to the 19th — 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18 and 19 (each its "
        "own X). A man's right hand comes in from the lower left holding an uncapped red marker, its tip on the box for the 20th, halfway "
        "through drawing a red X; the 21st to the 30th are clean apart from '00:00' in the 27th.",
        HAND, DAY, FILM_NUM, 메모="2 · 1.00–2.68 달력 정면 — 20일에 X, 27일 「00:00」(글 「블프 00:00 · 75인치 TV 반값」 · 「D-7」은 합성)"),
    job("S03", FACE4 + ["방:R1", LAY("S03_실루엣.png")],
        START, JUNHO, ROOM_R1.format(n=5), LAY_SIL.format(n=6),
        "Medium close shot, camera about 1 m above the floor, level, placed two meters beyond his feet, 85mm lens: he is doing sit-ups on "
        "the living-room floor, arms crossed flat over his chest, and he is at the top of a sit-up — his head and shoulders fill the middle "
        "of the frame, about two-thirds of the frame height; the floor and his knees are below the frame and not visible. Behind him, out "
        "of focus, the blank wall with the blue masking-tape rectangle where the new TV will go (its edge and the printed TV photo partly "
        "visible behind his head) and the child's crayon drawing taped beside it.",
        WEAR, "EXPRESSION: straining but completely serious — eyes wide open and fixed straight ahead just above the camera, lips pressed "
        "closed, jaw tight. No smile, no grimace, no comic face-pulling.",
        DAY, FILM, 메모="3 · 2.68–5.27 바닥 윗몸일으키기 — 원본 팔짱 · 올라오는 얼굴, 등 뒤 TV 자리 벽 · 꼬리표 「훈련 · 체력」(합성)"),
    job("S04", FACE4 + ["방:R1", LAY("S04_실루엣.png")],
        START, JUNHO, ROOM_R1.format(n=5), LAY_SIL.format(n=6),
        "Wide shot framed through a big ring light: a large switched-on LED ring light stands right in front of the camera, out of focus — "
        "its thin glowing white ring is centered, about half the frame width and nearly the full frame height, its tripod stand at the "
        "bottom; outside the ring the rest of the living room shows, blurred. Through the ring, small in the middle of the living room, he "
        "stands with his feet apart and curls two smartphones in his hands like dumbbells, thumbs tapping the screens. In the lower "
        "foreground a round robot vacuum glides past, blurred with motion.",
        WEAR, DEADPAN, DAY, FILM, 메모="4 · 5.27–7.61 링 라이트 원 너머 휴대폰 아령 · 로봇 청소기 · 꼬리표 「훈련 · 엄지」(합성)"),
    job("S05", [LAY("S05_흐림.png")],
        START, LAY_BLUR.format(n=1),
        "Tight close-up of a wall calendar, 85mm lens, slightly from below: about three rows of day boxes fill the frame, from the 15th to "
        "the 30th. " + CAL + " Crossed out: every day up to the 23rd — in this view 15, 16, 17, 18, 19, 20, 21, 22 and 23, each its own X. "
        "A man's hand comes in from the lower left with an uncapped red marker, drawing the first stroke of an X across the box for the 24th; "
        "25 to 30 are clean apart from '00:00' in the 27th.",
        HAND, DAY, FILM_NUM, 메모="5 · 7.61–8.61 달력 — 24일 X · 「D-3」(합성, 원본 간격 D-7 · D-3 · D-2 · D-1 · D — Fable 1차)"),
    job("S06", FACE4 + ["방:R1", LAY("S06_틀.png")],
        START, JUNHO, ROOM_R1.format(n=5), LAY_FRAME.format(n=6),
        "Wide shot from low, the lens just above the near edge of the operation desk, 28mm lens: in the near foreground, very close to the "
        "lens, three 'trophies' in a row on the desk — a phone on a stand, a second phone on a stand, and a third empty wooden stand waiting "
        "for one more — so big that together they fill the lower half of the frame, each about a third of the frame height, slightly out "
        "of focus, evenly spaced like the three snow globes of a shop window (10-26: the first take made them small at the bottom edge). "
        "Behind them, sharp in the background at the far side of the desk and in the CENTER of the frame, he stands bent over and lines up "
        "the laptop, the tablet and a phone in a precise row, checking their alignment.",
        WEAR, DEADPAN, DAY, FILM, 메모="6 · 8.61–10.45 작전 책상 와이드 · 꼬리표 「훈련 · 장비 점검」(합성)"),
    job("S07", FACE4 + [LAY("S07_실루엣.png"), "방:H"],
        START, JUNHO, LAY_SIL.format(n=5),
        "Location: the apartment entrance hall shown in Image 6 — use Image 6 ONLY for how the place looks (the grey front door, the white "
        "shoe cabinet, the warm ceiling light); do NOT copy its wide camera position (10-26: copying it gave a small full-body figure).",
        "MEDIUM SHOT, camera about 1.2 m in front of him at chest height, 50mm lens: he fills the right half of the frame from the top of his "
        "head, near the top edge, down to his waist at the bottom edge — no legs, no feet, no floor; the front door and shoe cabinet behind "
        "him are out of focus. He holds an open glossy shopping flyer in both hands at chest height, reading it; his whole face is visible "
        "above it. The flyer faces the camera: a big photo of a "
        "huge flat-screen TV, bold amber-orange price blocks and badges, no readable words. Thin black reading glasses have slid down to "
        "the tip of his nose and his eyes look over them at the price.",
        WEAR, "EXPRESSION: frozen, deadly serious, eyes slightly narrowed in disbelief at the price, lips closed — not smiling, not shouting.",
        DAY, FILM, 메모="7 · 10.45–13.80 현관 전단(원본처럼 가슴 높이) · 안경 코끝(벗는 동작은 영상에서) · 속마음 「반값…」(전단 글은 합성)"),
    job("S08", FACE4 + ["방:R1", LAY("S08_실루엣.png")],
        START, JUNHO, ROOM_R1.format(n=5), LAY_SIL.format(n=6),
        "A fast whip-pan frame: the camera is swinging hard to the left, so everything except him is smeared into long horizontal motion "
        "streaks — in the left two thirds, a living-room shelf rushes past, lined with rows of plain unbranded drink cans in solid colors "
        "(no logos, no brand names, no printed words — 10-26: real energy-drink logos appeared), small white eye-drop bottles and black "
        "wrist braces, all smeared sideways so their shapes are only readable as streaks. At the right edge he rushes into the frame, sharper, "
        "wearing a black gaming headset with a microphone, glancing at the shelf as he runs past it to the left.",
        WEAR, DEADPAN, DAY, FILM, 메모="8 · 13.80–15.09 휙 팬 · 헤드셋 · 꼬리표 「훈련 · 보급」(합성)"),
    job("S09", FACE4 + ["방:B", LAY("S09_실루엣.png")],
        START, JUNHO,
        "Location: the same small bathroom as in Image 5 — use it for the room and the round mirror, but not for the light.", LAY_SIL.format(n=6),
        "Over-the-shoulder shot into the round mirror, 50mm lens. LEFT and RIGHT as seen in the picture, exactly as in Image 6 and not "
        "mirrored: the round mirror is in the LEFT half of the frame and his reflection in it is left of center, facing the camera, sharp, "
        "from the chest up; the back of his head and his shoulder are at the RIGHT edge of the frame, filling the right third, out of focus. "
        "No other reflections of him anywhere else (no second face in glass or tiles). Two thick "
        "black camouflage stripes are painted across each cheek like a soldier's face paint, and he holds a black face-paint stick near his "
        "cheek.",
        WEAR, "EXPRESSION: grim and determined, jaw set, lips firmly closed, a single small nod — no smile.",
        "Light: late evening, the bathroom's main light is off; only a small warm bulb beside the mirror lights his face and the mirror, the "
        "rest of the room falls into soft warm-brown darkness — dim and moody but his face and the black stripes stay clearly visible.",
        FILM, 메모="9 · 15.09–16.72 욕실 거울 위장 줄 · 속마음 「이번엔… 이긴다.」(입 다문 채)"),
    job("S10", [LAY("S10_흐림.png")],
        START, LAY_BLUR.format(n=1).replace("the calendar grid, the hand and the pen", "the torso, the hands and the desk"),
        "Close-up from his chest height looking down at the desk at about 30 degrees, 50mm lens: on the light oak operation desk, his left hand holds a smartphone showing a large stopwatch "
        "with its thumb hovering right above the start button, and his right hand rests on a wired mouse. Above, at the top of the frame, "
        "only his heather-grey sweatshirt chest — no face. Behind, out of focus, the living room.",
        HAND, DAY, FILM.replace("no letters, ", ""), 메모="10 · 16.72–17.23 초시계 엄지 · 꼬리표 「훈련 · 반응 속도」(합성)"),
    job("S11", FACE4 + ["방:R1", LAY("S11_실루엣.png")],
        START, JUNHO, ROOM_R1.format(n=5), LAY_SIL.format(n=6),
        "Medium close-up at his eye level, 50mm lens: he sits at the operation desk facing the camera, his head and shoulders fill the "
        "middle of the frame; his head is slightly bowed and his eyes look down at his hands on the mouse and keyboard just below the "
        "frame; the cool glow of the screens lights his face from below. Behind him, out of focus: the white wall and the sheer curtains.",
        WEAR, "EXPRESSION: total concentration — eyes fixed down on his hands, unblinking, lips closed, deadpan. No smile.",
        DAY, FILM, 메모="11 · 17.23–17.90 얼굴 · 꼬리표 「훈련 · 반응 속도」(합성)"),
    job("S12", [LAY("S12_흐림.png")],
        START, LAY_BLUR.format(n=1).replace("the calendar grid, the hand and the pen", "the torso, the hands and the desk"),
        "Close-up from his chest height looking down at the desk at about 30 degrees, 50mm lens, strong motion blur: his two hands hammer a wired mouse and a keyboard on the oak operation desk "
        "so fast that the fingers smear into a blur; his heather-grey sweatshirt fills the top of the frame — no face.",
        HAND, DAY, FILM, 메모="12 · 17.90–18.94 광클 번짐 · 꼬리표 「훈련 · 광클」(합성)"),
    job("S13", [LAY("S13_흐림.png")],
        START, LAY_BLUR.format(n=1),
        "Tight close-up of a wall calendar from a low angle, 85mm lens: the boxes from the 23rd to the 27th fill the frame. " + CAL +
        " Crossed out: 23 and 24 (and every earlier day). A man's hand comes in from the lower left with a red marker, starting an X on the "
        "25th; 26 and 27 are clean apart from '00:00' in the 27th.",
        HAND, DAY, FILM_NUM, 메모="13 · 18.94–19.40 달력 25일 · 「D-2」(합성)"),
    job("S14", FACE4 + ["방:R1"],
        START, JUNHO, ROOM_R1.format(n=5),
        "Wide shot from a low camera about 40 cm above the floor, level, 24mm lens, from the side: in the center of the frame he lies flat "
        "on his stomach on the floor like a sniper in position, propped on his elbows, a grey fleece blanket draped over his back and head "
        "as camouflage, only his face and two hands sticking out — one hand on a mouse on the floor — his face toward the operation desk at "
        "camera-right, eyes level with the three screens on it. The ceiling and the upper wall show above him; the rest of the living room "
        "is calm and empty.",
        WEAR, DEADPAN, DAY, FILM, 메모="14 · 19.40–20.70 담요 저격 자세 — 원본처럼 무릎 높이 로우앵글 · 가운데(공 윗몸일으키기와 자세가 달라 실루엣 없이 글로) · 꼬리표 「훈련 · 저격 자세」(합성)"),
    job("S15", [LAY("S15_흐림.png")],
        START, LAY_BLUR.format(n=1),
        "Tight close-up of a wall calendar, 85mm lens: the boxes from the 23rd to the 27th fill the frame. " + CAL +
        " Crossed out: 23, 24 and 25 (and every earlier day). A man's hand from the lower left finishes the second stroke of a red X on the "
        "26th with a red marker; the 27th is clean apart from its '00:00'.",
        HAND, DAY, FILM_NUM, 메모="15 · 20.70–21.37 달력 26일 · 「D-1」(합성)"),
    job("S16", FACE4 + ["방:R1", LAY("S16_실루엣.png")],
        START, JUNHO, ROOM_R1.format(n=5), LAY_SIL.format(n=6),
        "Medium shot at eye level, 35mm lens: he stands behind the operation desk in the middle of the frame. With a precise, ceremonial "
        "gesture he sets an old-fashioned twin-bell alarm clock down on the last empty place at the end of a neat row of two phones on "
        "stands — completing the row of three 'trophies' — and lifts his head toward the camera.",
        WEAR, DEADPAN, DAY, FILM, 메모="16 · 21.37–23.04 탁상시계 탁 · 「들이쉬고…」 · 꼬리표 「훈련 · 호흡」(합성)"),
    job("S17", FACE4 + ["방:R1", LAY("S17_실루엣.png")],
        START, JUNHO, ROOM_R1.format(n=5), LAY_SIL.format(n=6),
        "Wide shot framed through the big switched-on LED ring light standing right in front of the camera, out of focus — its thin glowing "
        "white ring centered, about half the frame width and nearly the full frame height, the rest of the living room blurred outside it: "
        "inside the ring, in the middle of the living room, he stands tall with his feet apart and both arms spread wide, a smartphone in each hand, like a finished "
        "warrior. In the lower right foreground a round robot vacuum glides past, blurred with motion. Nobody else is there.",
        WEAR, DEADPAN, DAY, FILM, 메모="17 · 23.04–25.30 링 라이트 원 팔 벌림 · 「반 내쉬고…」 · 꼬리표 「훈련 · 호흡」(합성)"),
    job("S18", [LAY("S18_흐림.png")],
        START, LAY_BLUR.format(n=1),
        "Tight close-up of a wall calendar, 85mm lens: the 25th, 26th and 27th boxes fill the frame, the 27th in the center. " + CAL +
        " The 25th and 26th are crossed out. A man's hand from the lower left has just drawn a red circle, twice around, tightly around the "
        "handwritten '00:00' inside the box for the 27th (the printed 27 stays outside the circle), the red marker still touching the paper.",
        HAND, DAY, FILM_NUM, 메모="18 · 25.30–26.17 달력 27일 동그라미 · 「D-DAY」(합성) · 「멈추고…」"),
    job("S19a", ["방:N", "방:R1"],
        START,
        "Images 1 and 2 show this same living room at midnight and in the daytime — use Image 1 for the light and Image 2 for the room. "
        "Low tracking shot just above the floor, 24mm lens: at midnight, all lights off, the laptop, the tablet and the phone on the operation "
        "desk flash on bright blue-white at the same moment, and in front of them on the desk two phones on stands and a twin-bell alarm "
        "clock in a row are ringing and lit up. In the far left edge of the frame, the edge of a grey fleece blanket on the floor. Nobody is visible yet.",
        NIGHT, FILM, 메모="19 · 26.17 팬 시작 — 화면 셋 번쩍 · 알람 셋(「블프 OPEN」 화면 글은 합성)"),
    job("S19b", FACE4 + ["방:N"],
        START, JUNHO,
        "Location: the same living room at midnight as in Image 5 — use it for the room and the light.",
        "Low shot just above the floor, 35mm lens, end of a sideways tracking move: he lies on his side on the floor in front of the operation "
        "desk, wrapped in the grey fleece blanket, FAST ASLEEP — eyes closed, mouth slightly open, head resting on his arm, his index finger "
        "still lying on a wireless mouse on the floor beside him. His face is in the left-center of the frame, three-quarter view, lit cold blue by the glowing screens just "
        "above him. A phone lies lit up right next to his ear. Black camouflage stripes are still faintly on his cheeks.",
        WEAR, "EXPRESSION: deeply asleep, relaxed slack face, eyes fully closed, mouth slightly open — peaceful, not smiling.",
        NIGHT, FILM, 메모="19 · 팬 끝 — 잠든 준호 · 알림 「주무세요. 선착순 없어요.」 · 끝 카드(합성)"),
])

# ── 달력 컷 다시(10-27) — Gemini가 그린 달력은 다섯 번 모두 글자가 틀려, 코드로 정확히 그린 판(달력판.py)에 손과 펜만 더한다 ──
CAL_PLATE = lambda k: str(V / "달력판" / f"{k}.png").replace("/", "\\")
CAL_EDIT = ("Edit Image 1. Image 1 is a photo of a paper wall calendar — keep the calendar EXACTLY as it is: every printed number, every red "
            "X, the half-drawn red stroke and the handwritten red '00:00' must stay exactly where they are and look the same; do not add, "
            "remove, redraw or move any number, letter or mark, and keep the framing and perspective. Only add, in front of the paper: ")
CAL_LOOK = ("Make the whole picture look like a real photograph of paper on a wall: soft daylight from the left, fine paper texture, natural "
            "lens falloff, the hand slightly out of focus where it is closest to the lens. No other changes.")
for k, where in {
    "C02": "a man's right hand coming in from the BOTTOM edge of the frame, just below the box for the 20th, holding an uncapped red marker whose tip touches the lower-right end of the half-drawn red stroke in the box for the 20th, as if it has just drawn that stroke. The hand is SMALL in the frame — only the fingers, the marker and a little of the grey sleeve show, below and around the box for the 20th; it must NOT cover the boxes for the 1st to the 19th, nor the 27th with its '00:00' (10-27: a big hand covering the 11th-19th made viewers think the pen was on the 15th)",
    "C05": "a man's right hand coming in from the lower left of the frame, holding an uncapped red marker whose tip touches the lower-right end of the half-drawn red stroke in the box for the 24th, as if it has just drawn that stroke",
    "C13": "a man's right hand coming in from the lower left of the frame, holding an uncapped red marker whose tip touches the lower-right end of the half-drawn red stroke in the box for the 25th, as if it has just drawn that stroke",
    "C15": "a man's right hand coming in from the lower left of the frame, holding an uncapped marker with a RED body (the same red marker as in the other calendar shots) whose tip touches the upper-right corner area INSIDE the box for the 26th — left of the vertical line between the 26th and the 27th, never inside the box for the 27th — about to draw the second stroke of the X. The half-drawn stroke already in the box for the 26th must stay exactly as it is, in the same direction (10-27: the stroke was redrawn the other way and the pen tip landed in the 27th)",
    "C18": "a man's right hand coming in from the lower left of the frame, holding an uncapped red marker whose tip touches the red circle around '00:00' in the box for the 27th, as if it has just finished drawing the circle",
}.items():
    J[k] = {"ratio": "16:9", "refs": [CAL_PLATE(k)], "prompt": " ".join([CAL_EDIT + where + ".", HAND, CAL_LOOK]),
            "메모": f"{k[1:]} 달력 — 판은 달력판.py(숫자 · X · 00:00 정확), Gemini는 손 · 펜만"}

# ── 10-27 Fable 이미지 콘티 1차 다시(상 4 · 중) — 같은 id로 덮어쓴다 ──
FLYER = str(V / "달력판" / "전단.png").replace("/", "\\")
NO_LOGO = (" His sweatshirt and pants have no emblem, patch or logo anywhere. Every laptop, tablet and phone is a plain unbranded device "
           "— no logo or mark on any back or lid (10-27: a real brand logo appeared on a tablet back).")
# 10-27 Opus 확인: 원본 K04 · K17 실측은 원 가운데 x≈52% · 바깥 지름이 화면 폭의 48~50%(1차의 「40% · 42%」는 틀린 목표였다)
RING = ("a large switched-on LED ring light stands very close in front of the camera, out of focus — its thin glowing white ring is a "
        "circle centered in the frame (center about 52% from the left edge), its OUTER diameter about HALF the frame width (about 90% of "
        "the frame height), so a strip of the room shows on both sides of the ring; outside the ring the rest of the living room shows, "
        "blurred; ")
J.update(dict([
    job("S04", FACE4 + ["방:R1", LAY("S04_실루엣.png")],
        START, JUNHO, ROOM_R1.format(n=5), LAY_SIL.format(n=6),
        "Wide shot framed through a big ring light: " + RING + "through the ring, in the middle of the living room and in the CENTER "
        "of the ring, he stands with his feet apart, about 60% of the ring's height, and curls two smartphones in his hands like dumbbells, "
        "the phones clearly visible, thumbs tapping the screens. In the lower foreground a round robot vacuum glides past, blurred with motion.",
        WEAR + NO_LOGO, DEADPAN, DAY, FILM, 메모="4 다시(Fable 1차 중) — 링 자리 · 크기를 원본 원(실측 가운데 x≈52% · 바깥 지름 화면 폭의 약 50%)과 17번에 맞춤 · 바지 엠블럼 없앰"),
    job("S17", FACE4 + ["방:R1", LAY("S17_실루엣.png")],
        START, JUNHO, ROOM_R1.format(n=5), LAY_SIL.format(n=6),
        "Wide shot framed through the big ring light, exactly the same camera and ring as the previous ring shot: " + RING + "inside "
        "the ring, in the middle of the living room and in the CENTER of the ring, he stands tall with his feet apart, about 60% of the "
        "ring's height, ARMS DOWN at his sides with a smartphone in each hand — the moment before he spreads them. In the lower right "
        "foreground a round robot vacuum glides past, blurred with motion. Nobody else is there. The room is exactly as in Image 5: on "
        "the wall behind him the blue masking-tape rectangle WITH the printed TV photo taped inside it and the child's crayon drawing "
        "outside it; to the right of him, inside the ring, the low oak operation desk with the laptop, the tablet and a phone on stands "
        "and a mouse; no floor lamp or side table that is not in Image 5 (10-27: the room lost the TV photo and the desk).",
        WEAR + NO_LOGO, DEADPAN, DAY, FILM, 메모="17 다시(Fable 1차 중) — 원본 23.04~23.8 시작 자세는 팔 내림(벌림은 영상 안에서) · 링 자리 4번과 같게"),
    job("S06", FACE4 + ["방:R1", LAY("S06_틀.png")],
        START, JUNHO, ROOM_R1.format(n=5), LAY_FRAME.format(n=6),
        "Wide shot from very low: the lens sits just above the top of the operation desk, hidden behind three 'trophies' in a row on the "
        "desk right in front of it — a phone on a wooden stand, a second phone on a wooden stand, and a third EMPTY wooden stand waiting for "
        "one more — so close and big that together they fill the lower 60% of the frame, slightly out of focus, evenly spaced like the "
        "three snow globes of a shop window. Above and between them, sharp in the background at the far side of the desk and in the CENTER "
        "of the frame, he stands bent over and lines up the laptop, the tablet and a phone in a precise row. On the wall behind, the blue "
        "masking-tape rectangle has the printed TV photo taped INSIDE it and the child's crayon drawing OUTSIDE it, to its right.",
        WEAR + NO_LOGO, DEADPAN, DAY, FILM, 메모="6 다시(Fable 1차 중) — 붐 업 시작 자리(탁자 윗면 높이 · 트로피가 아래 60%) · 빈 받침 · 테이프 안 TV 사진"),
    job("S08", FACE4 + ["방:R1", LAY("S08_실루엣.png")],
        START, JUNHO, ROOM_R1.format(n=5), LAY_SIL.format(n=6),
        "A fast whip-pan frame: the camera is swinging hard to the left, so everything is smeared into long horizontal motion streaks — "
        "almost the whole frame is a living-room shelf rushing past, lined with rows of plain unbranded drink cans in solid colors (no logos, "
        "no brand names, no printed words), small white eye-drop bottles and black wrist braces, all smeared sideways so their shapes are only "
        "readable as streaks. At the very RIGHT EDGE of the frame he is just entering — only his shoulder and half of his head with a black "
        "gaming headset are inside the frame, the rest of him still outside the edge.",
        WEAR + NO_LOGO, DEADPAN, DAY, FILM, 메모="8 다시(Fable 1차 중) — 원본 첫 프레임엔 사람이 없고 14.8초쯤 들어옴 → 오른쪽 끝에 반만 · 상표 없는 캔"),
    job("S07", FACE4 + [LAY("S07_실루엣.png"), "방:H", FLYER],
        START, JUNHO, LAY_SIL.format(n=5),
        "Location: the apartment entrance hall shown in Image 6 — use Image 6 ONLY for how the place looks (the grey front door, the white "
        "shoe cabinet, the warm ceiling light); do NOT copy its wide camera position.",
        "MEDIUM CLOSE SHOT, camera about 1 m in front of him at his FACE height, level (not looking down), 50mm lens: his face is right of "
        "center and about 15% of the frame width across; the top of his head is near the top edge; the open flyer he holds in both hands at "
        "chest height fills the lower half of the frame, facing the camera. THE FLYER IS PRINTED EXACTLY WITH THE DESIGN OF IMAGE 7 — the same "
        "orange header with the word 느지막, the TV picture, the same Korean words and numbers in the same places (198만 원 crossed out, 99만 원, "
        "블프 반값, the red band) — glossy paper, slightly curved in his hands; do not invent any other text, prices or pictures on it. Thin "
        "black reading glasses have slid down to the tip of his nose and his eyes look over them at the price.",
        WEAR + NO_LOGO, "EXPRESSION: frozen, deadly serious, eyes slightly narrowed in disbelief at the price, lips closed — not smiling.",
        DAY, FILM.replace("No text, no letters, no logos", "Apart from the flyer of Image 7, no text, no letters, no logos"),
        메모="7 다시(Fable 1차 상) — 전단 면을 느지막 전단(전단판.py)으로 · 얼굴 폭 15% · 얼굴 높이 수평"),
    job("S10", ["방:R1", LAY("S10_흐림.png")],
        START, LAY_BLUR.format(n=2).replace("the calendar grid, the hand and the pen", "the torso, the hands and the desk"),
        "Close-up from his chest height looking down at the desk at about 30 degrees, 50mm lens, in the same living room as Image 1 (its "
        "white wall and grey sofa far behind, out of focus): he sits facing the camera, only his heather-grey sweatshirt chest at the top of "
        "the frame — no face. His RIGHT hand — on the LEFT side of the picture, because he faces the camera — rests on a wired mouse; his "
        "LEFT hand — on the RIGHT side of the picture — holds a smartphone with a large stopwatch on its screen, the screen facing up toward "
        "the camera, its thumb hovering right above the start button.",
        HAND, DAY, FILM.replace("no letters, ", ""), 메모="10 다시(Fable 1차 상) — 마우스는 오른손(그림 왼쪽) · 배경 R1 거실 · 초시계 화면이 카메라 쪽"),
    job("S12", ["방:R1", LAY("S12_흐림.png")],
        START, LAY_BLUR.format(n=2).replace("the calendar grid, the hand and the pen", "the torso, the hands and the desk"),
        "Close-up from his chest height looking down at the desk at about 30 degrees, 50mm lens, strong motion blur, in the same living room "
        "as Image 1 (its white wall and grey sofa far behind, out of focus — no bookshelves, no study): he sits facing the camera, his "
        "heather-grey sweatshirt fills the top of the frame — no face. His RIGHT hand — on the LEFT side of the picture — hammers a wired mouse, "
        "and his LEFT hand — on the RIGHT side of the picture — hammers a keyboard, so fast that the fingers smear into a blur.",
        HAND, DAY, FILM, 메모="12 다시(Fable 1차 상) — 마우스는 오른손(그림 왼쪽, 11 · 14 · 19와 같게) · 배경 R1 거실"),
    job("S14", FACE4 + ["방:R1"],
        START, JUNHO, ROOM_R1.format(n=5),
        "Wide shot from a low camera about 40 cm above the floor, level, 24mm lens, from the side: in the CENTER of the frame he lies flat on "
        "his stomach on the floor like a sniper in position, propped on his elbows, a thick blue-grey fleece blanket draped over his back and "
        "head as camouflage, only his face and two hands sticking out — his RIGHT hand on a mouse on the floor — his face toward the operation "
        "desk at camera-right, eyes level with the three screens on it. On the wall behind: the blue masking-tape rectangle with the printed "
        "TV photo INSIDE it, the child's crayon drawing OUTSIDE it to its right, and the big white paper wall calendar exactly as in Image 5 "
        "(no readable letters or numbers). The rest of the living room is calm and empty.",
        WEAR + NO_LOGO, DEADPAN, DAY, FILM, 메모="14 다시(Fable 1차 상) — 테이프 안 TV 사진 · 그림 밖 · 영문 달력 없앰 · 담요 19와 같은 플리스 · 가운데"),
    job("S16", FACE4 + ["방:R1", LAY("S16_실루엣.png")],
        START, JUNHO, ROOM_R1.format(n=5), LAY_SIL.format(n=6),
        "MEDIUM SHOT at eye level, 40mm lens: he stands behind the operation desk in the middle of the frame, seen from the top of his head "
        "to his waist, the near edge of the desk at the bottom of the frame. On the desk, at the back, the laptop, the tablet and a phone on "
        "stands stand in a row; in front of them a row of 'trophies' — two phones on wooden stands and a third empty wooden stand at the end. "
        "With a precise, ceremonial gesture he sets an old-fashioned twin-bell alarm clock down onto that empty wooden stand, completing the "
        "row of three, and lifts his head toward the camera.",
        WEAR + NO_LOGO, DEADPAN, DAY, FILM, 메모="16 다시(Fable 1차 상) — 6번과 짝(빈 받침에 시계) · 화면 셋 그대로 · 미디엄 · 바지 엠블럼 없앰"),
]))

# 방 기준 그림 고른 판으로 「방:X」 바꾸기 — 아직이면 괄호로 남겨 실행기가 막는다
for j in J.values():
    j["refs"] = [ROOM(r[2:]) if r.startswith("방:") else r for r in j["refs"]]

out = V / "ego" / "jobs.json"
out.write_text(json.dumps(J, ensure_ascii=False, indent=1), encoding="utf-8")
print(len(J), "작업 →", out)
for k, j in J.items():
    print(k, len(j["refs"]), "참조", len(j["prompt"]), "자", "· 방 아직" if any(r.startswith("(") for r in j["refs"]) else "")
