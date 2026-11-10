"""환승 러시 사진 다시 굽기(11-11) 시안 작업표 → nb/jobs.json. 나노바나나 2.1(Gemini Ultra 웹), 9:16로 구워 게임의 2:3으로 가운데를 자른다.
  python -I -X utf8 작업표.py
"""
import json
from pathlib import Path
from PIL import Image

W = Path.home() / 'Documents' / 'SYNK-appsscript' / '.tmp' / 'subway-rush-20261111'   # 공용 작업본(git 밖) — nb/ · refs/ · 맞춤/
REFS = W / 'refs'
PLATE = Path.home() / 'Documents' / 'SYNK-appsscript' / '.tmp' / 'subway-rush-20261104' / '판'
for src, name in [('train_024121.png', 'layout-car.jpg'), ('fork_024316.png', 'layout-fork.jpg'), ('exit-fork_060218.png', 'layout-exit.jpg')]:
    Image.open(PLATE / src).convert('RGB').save(REFS / name, quality=93)

REAL = ("A REAL candid photograph by a documentary photographer, never an illustration, never a 3D render, never a game screenshot. "
        "Full-frame camera, 24 mm lens, f/4, ISO 3200, real LED light with a faint cool cast, natural sensor noise, true-to-life color, "
        "the small imperfections of a busy public place (scuffed steel, grime in tile grout, worn floor near doors and stairs). "
        "Real Korean people of mixed ages, heights and body types, each busy with their own thing, placed unevenly - no symmetry, no two people in the same pose, no repeated faces or outfits. "
        "Nobody looks at the camera and no face is large and sharp toward us; faces are small, natural and anatomically correct, hands natural and relaxed. "
        "No logos, no brand names, no advertisements with words.")

CAR_HEAD = ("Create one photograph, vertical 9:16.\n"
            "Image 1 is a LAYOUT REFERENCE ONLY: keep its camera position (standing in the middle of the aisle of a Seoul subway car, eye height 1.55 m), its lens and one-point perspective straight down the car, "
            "and above all the exact size and position of the two nearest double sliding doors that frame the far LEFT and far RIGHT edges of Image 1 (both closed). Re-photograph everything else for real; do not copy its people.\n"
            "THE CAR: a modern Seoul subway line 2 car on a spring weekday morning: brushed stainless-steel walls, long bench seats with blue-grey cushions, one plain pink priority seat at the near end of the right bench (no lettering), "
            "stainless poles and rows of white hand straps, overhead luggage racks. CEILING: flat white panels with two continuous straight LED light strips and, down the middle, a straight air duct with evenly spaced rectangular vent grilles - "
            "every ceiling line perfectly straight and converging to the same vanishing point, nothing bent, warped or melted. Above each door a narrow LCD screen showing only a simple green route line with small dots (no words). "
            "Windows above the seats show the dark tunnel with soft streaks of passing tunnel lamps; the train is moving.\n")
CAR_FOOT = "The floor right in front of the two nearest doors stays clear.\n" + REAL

CARS = {
    'car-calm': ("THE PEOPLE (8:40, a calm car, about nine people, many seats empty, spread unevenly):\n"
                 "- left bench, nearest: a woman of about 70 with short permed grey hair and a quilted plum vest, a cloth shopping bag on her lap, hands folded, looking calmly across the car.\n"
                 "- left bench, middle: a man in his late 40s in a navy suit and glasses, reading a paperback held low with its cover turned away.\n"
                 "- left bench, far: a high-school boy in a navy school blazer with a wired earphone, asleep with his head resting on the glass partition.\n"
                 "- right bench, nearest: a woman in her 30s in a camel coat holding a takeaway coffee cup in both hands and looking down at it, a tote bag at her feet.\n"
                 "- right bench, middle: a university student with a big backpack on her lap, looking at her phone (the only person on a phone).\n"
                 "- right side, far: a man in his 50s in a padded work vest standing by the far door, one hand on a pole, looking out of the window.\n"
                 "- farther down the car, small: two or three more commuters.\n"),
    'car-rush': ("THE PEOPLE (8:40 rush hour, about thirty people): every seat is taken. Down the middle of the aisle people stand in two loose rows holding the hand straps, most of them facing the seated passengers so we see them from the side and back, "
                 "shoulder to shoulder, the crowd getting denser toward the far end. Mixed: office workers aged 30 to 55 in dark coats and suits, a few university students with backpacks, a middle-aged woman with a handbag, an older man in a flat cap. "
                 "Each does something different: a tired man dozing on his feet holding a strap, a woman reading a paper book, a man with eyes closed and wireless earbuds, two colleagues talking quietly, a young woman looking up at the screen above a door, a man checking his wristwatch; only a few look at phones. "
                 "The nearest standing people are about two meters ahead with their backs to us.\n"),
}

FORK = ("Create one photograph, vertical 9:16.\n"
        "Image 1 is a LAYOUT REFERENCE ONLY: keep its camera (eye height 1.6 m, looking straight ahead along an underground transfer concourse of a Seoul subway station), its lens and perspective, and the three ways ahead at the same places, about eight meters away: "
        "on the LEFT third a wide staircase going UP, in the CENTER third a long straight passage, on the RIGHT third a wide staircase going DOWN, separated by square tiled pillars. Re-photograph everything else for real; do not copy its people.\n"
        "THE SIGN: there are NO hanging sign boxes over the three ways. Instead, mounted flat on the wall face above all three ways and running across their full width is ONE long backlit station-name sign. "
        "Image 2 is the exact print artwork of its face: copy every Korean and Latin character, both numbered line circles and their colors exactly as in Image 2 - nothing added, dropped, merged or changed. "
        "It is a real lit sign box with a thin aluminum frame and even inner light, seen in perspective and sharp. There is no other writing anywhere in the photo.\n"
        "Other real details: yellow tactile paving running from the bottom center and splitting toward the three ways; a red fire-hose cabinet on one pillar (no text); a small CCTV dome on the ceiling; "
        "a thin green and a thin blue stripe running along the side walls at waist height; worn polished granite floor with soft reflections; white ceiling panels with long LED lines.\n"
        "THE PEOPLE (8:45 on a weekday, about eight, unevenly spread, all seen from behind or the side, small, at different distances): an older man with a cane walking slowly toward the left stairs; "
        "a mother holding a small child's hand walking into the center passage; two university students talking as they walk toward the right stairs; a man in a suit hurrying past on the right, slightly motion-blurred; "
        "a station cleaner in a grey uniform with a mop cart by the left wall; one or two more far down the center passage. Keep clear walking space in the middle of the floor.\n" + REAL)

EXIT = ("Create one photograph, vertical 9:16.\n"
        "A real photograph inside the exit concourse of a Seoul subway station just after the ticket gates, eye height 1.6 m, looking straight ahead while walking. Early spring weekday morning, 8:50.\n"
        "LAYOUT: about eight meters ahead the concourse splits into three exits, each clearly different from the others: on the LEFT third, a corridor turning left with the foot of an up-escalator visible at its end; "
        "in the CENTER third, a wide staircase climbing straight up toward a bright opening of soft morning daylight and budding trees; on the RIGHT third, a narrower staircase with a stainless handrail climbing toward daylight where the side of a city bus and a shop awning are softly visible. "
        "Square tiled pillars separate them.\n"
        "THE SIGN: one real hanging sign above the middle of the concourse about five meters ahead, facing us, hung by two steel rods from the ceiling. Image 1 is the exact print artwork of its face: "
        "copy every Korean and Latin character and the arrow exactly as in Image 1 - nothing added, dropped, merged or changed, and no numbers anywhere. It is a real lit sign box with a thin aluminum frame. There is no other writing anywhere in the photo.\n"
        "Other real details: polished light-grey granite floor, worn near the stairs; pale ceramic wall tiles; long LED lines on the white ceiling; yellow tactile paving; a fire-extinguisher box on a pillar (no text).\n"
        "THE PEOPLE (about seven, unevenly spread, all seen from behind or the side, at different distances): a delivery courier pulling a hand trolley of boxes toward the left corridor; "
        "an older woman holding the handrail and slowly climbing the right stairs; a student running up the center stairs two steps at a time, slightly motion-blurred; a man in a trench coat walking toward the center; "
        "a woman with a stroller waiting at the escalator. Keep clear walking space in the middle of the floor.\n" + REAL)

# 2차(01:57): 칸은 문 · 창 자리가 셰이더(문 열림 rect · 창 빛 띠 glassMask)에 묶여 있어 지금 판을 Image 1로 「차는 그대로, 사람 · 천장만」 편집한다.
EDIT_HEAD = ("Create one photograph, vertical 9:16, by EDITING Image 1, a photo taken inside a Seoul subway car.\n"
             "KEEP the car exactly as it is in Image 1: the camera position, lens and framing; the two nearest double sliding doors at the far LEFT and far RIGHT edges with their door windows; "
             "the side windows, poles, hand straps, luggage racks, bench seats, floor and the light — every one at the same place and the same size. Extend the frame a little at the top (more ceiling) and at the bottom (more floor) to fill 9:16, without moving anything.\n"
             "CHANGE ONLY THREE THINGS:\n"
             "1) THE CEILING: the air-vent panels down the middle of the ceiling in Image 1 are bent and uneven. Replace them with one straight air duct with evenly spaced rectangular grilles, every line perfectly straight and converging to the same vanishing point as the rest of the car.\n"
             "2) THE PEOPLE: remove every passenger of Image 1 and seat or stand these real people instead.\n")
EDIT_FOOT = ("3) MAKE IT A REAL PHOTOGRAPH: the whole car gets the look of a real camera photo - natural sensor noise, true-to-life brushed steel and plastic with small scuffs and fingerprints, slightly worn floor near the doors, "
             "LCD screens above the doors showing only a simple green route line with dots (no words), windows showing the dark tunnel with soft streaks of passing lamps.\n"
             "Keep the floor right in front of the two nearest doors clear. " + REAL)
EDIT_PEOPLE = {
    'car-calm-e': ("- left bench, nearest: a woman of about 70 with short permed grey hair and a quilted plum vest, a cloth shopping bag on her lap, hands folded, looking calmly across the car.\n"
                   "- left bench, a little farther: a man in his late 40s in a navy suit and glasses, reading a paperback held low with its cover turned away.\n"
                   "- left bench, far: a high-school boy in a navy school blazer, asleep with his head on the glass partition.\n"
                   "- right bench, nearest: a woman in her 30s in a camel coat holding a takeaway coffee cup in both hands and looking down at it, a tote bag at her feet.\n"
                   "- right bench, middle: a university student with a big backpack on her lap, looking at her phone (the only phone in the car).\n"
                   "- right side, far: a man in his 50s in a padded work vest standing, one hand on a pole, looking out of the window.\n"
                   "- far down the car, small: two or three more commuters. Many seats stay empty.\n"),
    'car-rush-e': ("8:40 rush hour, about thirty people: every seat is taken, and down the middle of the aisle people stand in two loose rows holding the hand straps, facing the seated passengers so we see them from the side and back, "
                   "the crowd getting denser toward the far end; the nearest standing people are about two meters ahead with their backs to us. Office workers aged 30 to 55 in dark coats and suits, a few university students with backpacks, "
                   "a middle-aged woman with a handbag, an older man in a flat cap. Each does something different: a tired man dozing on his feet holding a strap, a woman reading a paper book, a man with eyes closed and wireless earbuds, "
                   "two colleagues talking quietly, a young woman looking up at the screen above a door, a man checking his wristwatch; only a few look at phones.\n"),
}
# 3차(02:3x): Image 1을 9:16로 맞춰 둔 판(위아래 흐린 띠) — 가로 짜임을 그대로 두게.
PAD_HEAD = EDIT_HEAD.replace("Extend the frame a little at the top (more ceiling) and at the bottom (more floor) to fill 9:16, without moving anything.",
                             "Image 1 is already 9:16: its top and bottom bands are only blurred placeholders - continue the real ceiling and floor there naturally. Do not zoom, crop or re-frame.")
FORK_B = FORK.replace("on the RIGHT third a wide staircase going DOWN,", "on the RIGHT third a wide staircase going DOWN (we see its top steps dropping away from us, the handrail sloping down and the lower floor below),") \
             .replace("a red fire-hose cabinet on one pillar (no text); ", "") \
             .replace("THE PEOPLE (8:45", "Clothes are plain, without printed letters. THE PEOPLE (8:45")

# 4차(11-11 03:2x, 유호님 「A로」): 고른 칸 A(한산 = car-calm_1, 붐빔 = car-rush-e_1)를 바탕으로 같은 9:16 편집 — 콘서트 · 등산객 칸(한산 판의 사람만 바꿈)과 칸마다 문 열린 판 둘.
for src, name in [('car-calm_1.png', 'base-calm.jpg'), ('car-rush-e_1.png', 'base-rush.jpg')]:
    Image.open(W / 'nb' / 'out' / src).convert('RGB').save(REFS / name, quality=95)
KEEP = ("Create one photograph, vertical 9:16, by EDITING Image 1, a real photo taken inside a Seoul subway car. "
        "Keep the car exactly as it is in Image 1 - the camera, framing, doors at the far left and far right edges, windows, poles, hand straps, luggage racks, seats, ceiling, floor and light, every one at the same place and size. Do not zoom, crop or re-frame.\n")
SWAP = ("CHANGE ONLY THE PEOPLE: remove every passenger of Image 1 and seat or stand these real people instead, spread unevenly along both benches and the aisle:\n")
SWAP_PEOPLE = {
    'car-concert': ("- a group of four K-pop fans aged 17 to 25 in soft pastel cardigans and jeans, sitting close together on the left bench, chatting and laughing; two of them hold plain round white light sticks with no logos or letters.\n"
                    "- a mother in her 40s and her teenage daughter on the right bench sharing one pair of wired earphones, a plain light stick sticking out of the daughter's tote bag.\n"
                    "- a young man standing by a pole with a rolled-up plain fan banner under his arm, smiling at his phone.\n"
                    "- ordinary commuters too: an older man dozing with his arms crossed, an office woman reading a paperback. Many seats stay empty; the floor in front of the two nearest doors stays clear.\n"),
    'car-hike': ("- a friendly group of six Korean hikers in their 50s and 60s, men and women, in bright outdoor jackets (orange, red, teal, purple), sun visors and caps, trekking backpacks with folded poles strapped on; "
                 "two sit on the left bench, three on the right bench, one stands holding a strap; one pours barley tea from a thermos lid into a small cup, the others laugh.\n"
                 "- a young office worker in a grey suit squeezed between two hikers on the right bench, looking amused.\n"
                 "- a university student with earbuds standing far down the aisle. The floor in front of the two nearest doors stays clear.\n"),
}
OPEN = ("Create one photograph, vertical 9:16, by EDITING Image 1, a real photo taken inside a Seoul subway car. Keep EVERYTHING exactly as in Image 1 - the same people in the same poses and clothes, the same car, camera, framing and light. Do not zoom, crop or re-frame.\n"
        "The train has now stopped at a station. Change only this: the nearest double sliding door at the far {SIDE} edge of the photo is now fully OPEN, both panels slid apart, and through that doorway we see the bright station platform - light-grey granite floor, the edge of an open glass platform screen door, a pale tiled wall and white LED ceiling light beyond, slightly warmer and brighter than the car, with a soft glow of platform light spilling onto the car floor just inside that door. "
        "The door at the far {OTHER} edge stays closed. The side windows above the seats now show the still, bright platform wall instead of the dark tunnel. No readable text anywhere.\n" + REAL)

out = W / 'nb' / 'out'
fwd = lambda p: str(p).replace('\\', '/')
jobs = []
for name, people in CARS.items():
    jobs.append({'id': name, 'ratio': '9:16', 'refs': [fwd(REFS / 'layout-car.jpg')], 'prompt': CAR_HEAD + people + CAR_FOOT, 'out': fwd(out / f'{name}_{{n}}.png')})
jobs.append({'id': 'fork', 'ratio': '9:16', 'refs': [fwd(REFS / 'layout-fork.jpg'), fwd(REFS / 'sign-station.jpg')], 'prompt': FORK, 'out': fwd(out / 'fork_{n}.png')})
jobs.append({'id': 'exit', 'ratio': '9:16', 'refs': [fwd(REFS / 'sign-exit.jpg')], 'prompt': EXIT, 'out': fwd(out / 'exit_{n}.png')})
for name, people in EDIT_PEOPLE.items():
    jobs.append({'id': name, 'ratio': '9:16', 'refs': [fwd(REFS / 'layout-car.jpg')], 'prompt': EDIT_HEAD + people + EDIT_FOOT, 'out': fwd(out / f'{name}_{{n}}.png')})
jobs.append({'id': 'car-calm-p', 'ratio': '9:16', 'refs': [fwd(REFS / 'layout-car-916.jpg')], 'prompt': PAD_HEAD + EDIT_PEOPLE['car-calm-e'] + EDIT_FOOT, 'out': fwd(out / 'car-calm-p_{n}.png')})
jobs.append({'id': 'car-rush-p', 'ratio': '9:16', 'refs': [fwd(REFS / 'layout-car-916.jpg')], 'prompt': PAD_HEAD + EDIT_PEOPLE['car-rush-e'] + EDIT_FOOT, 'out': fwd(out / 'car-rush-p_{n}.png')})
jobs.append({'id': 'fork-b','ratio': '9:16', 'refs': [fwd(REFS / 'layout-fork.jpg'), fwd(REFS / 'sign-station.jpg')], 'prompt': FORK_B, 'out': fwd(out / 'fork-b_{n}.png')})
for name, people in SWAP_PEOPLE.items():
    jobs.append({'id': name + '-a', 'ratio': '9:16', 'refs': [fwd(REFS / 'base-calm.jpg')], 'prompt': KEEP + SWAP + people + REAL, 'out': fwd(out / f'{name}-a_{{n}}.png')})
# 문 열린 판: 칸마다 그 칸 판을 Image 1로(콘서트 · 등산객은 고른 판이 생기면 refs/base-<칸>.jpg로 넣는다)
for car in ['calm', 'rush', 'concert', 'hike']:
    for side, other in [('LEFT', 'RIGHT'), ('RIGHT', 'LEFT')]:
        jobs.append({'id': f'open-{car}-{side.lower()}', 'ratio': '9:16', 'refs': [fwd(REFS / f'base-{car}.jpg')], 'prompt': OPEN.replace('{SIDE}', side).replace('{OTHER}', other), 'out': fwd(out / f'open-{car}-{side.lower()}_{{n}}.png')})
for j in jobs:
    assert len(j['prompt']) < 4300, (j['id'], len(j['prompt']))
    print(j['id'], len(j['prompt']))
(W / 'nb' / 'jobs.json').write_text(json.dumps(jobs, ensure_ascii=False, indent=1), encoding='utf-8')
