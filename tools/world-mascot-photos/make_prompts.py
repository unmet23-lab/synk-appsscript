# 튜터 표정 판(3×2, 같은 장면 · 얼굴만 다름) 지시문 만들기.
# 사용: python make_prompts.py → p_<상황>_<튜터>.txt
import os

ROOT = os.path.dirname(os.path.abspath(__file__))

# 칸 순서와 얼굴(표정표 칸 번호는 make_refs.py 순서: 1 기본 2 눈감음 3 눈웃음 4 놀람 5 민망 6 윙크/몰래기쁨 7 으쓱/집중 8 졸림)
FACES = {
    'mongle': [
        ('기본', 'calm default - two black glass bead eyes (chart cell 1)'),
        ('잔잔감음', 'eyes closed in a soft blink - two short curved stitched lines with tiny lashes (chart cell 2)'),
        ('놀람', 'surprised - the two black bead eyes slightly bigger and set a little wider apart (chart cell 4)'),
        ('기쁨', 'very happy - stitched upward arc eyes like chart cell 3, plus two small round rosy-pink felt blush dots under the eyes'),
        ('눈웃음', 'gentle smiling eyes - stitched upward arcs exactly like chart cell 3, no blush'),
        ('민망', 'a little embarrassed - copy chart cell 5 (one bead eye and one squeezed eye), plus one tiny light-blue felt sweat drop on the side of the dome'),
    ],
    'kkamong': [
        ('기본', 'calm default - two big round glossy green eyes (chart cell 1)'),
        ('잔잔감음', 'eyes closed in a soft blink - two short light-green stitched lines (chart cell 2)'),
        ('놀람', 'surprised - the green eyes opened a little wider and rounder (chart cell 4)'),
        ('기쁨', 'very happy - light-green stitched upward arc eyes like chart cell 3, plus a tiny puff of white felt steam from the nose'),
        ('으쓱', 'smug and proud - light-green stitched arcs like chart cell 7, chin slightly up'),
        ('민망', 'a little embarrassed - small half-closed light-green eyes like chart cell 5, plus one tiny light-blue felt sweat drop on the side of the head'),
    ],
    'marin': [
        ('기본', 'calm default - two round butter-yellow felt lens eyes (chart cell 1)'),
        ('잔잔감음', 'lenses switched off in a blink - both lenses dark navy (chart cell 2)'),
        ('놀람', 'surprised - both yellow lenses bigger, brighter and slightly oval (chart cell 4)'),
        ('기쁨', 'secretly happy - both lenses glowing a warmer brighter yellow (chart cell 6)'),
        ('집중', 'focused - each lens with a bright horizontal glowing band across the middle (chart cell 7)'),
        ('민망', 'a little embarrassed - one lens normal and one lens smaller and dimmer (chart cell 5)'),
    ],
}
NAMES = {'mongle': 'Mongle', 'kkamong': 'Kkamong', 'marin': 'Marin'}
POS = ['top-left', 'top-middle', 'top-right', 'bottom-left', 'bottom-middle', 'bottom-right']

HEAD = '''Image to generate: a stop-motion contact sheet. Landscape 3:2 image made of exactly SIX equal square frames in a precise 3 x 2 grid (3 columns, 2 rows), separated by thin straight pure-white gutter lines about 12 pixels wide. No outer border, no labels, no numbers, no text anywhere.

All six frames are the SAME locked-off camera shot of the SAME miniature set, like six consecutive frames of a stop-motion film where the animator only swaps {N}'s felt face pieces. The set, the camera position, the lighting, the props and {N}'s body position, size, pose and shadow must be identical in all six frames. Only the face (and the tiny extra noted for a frame) changes.
'''

FRAMING = {
    # 튜터 고르기: 온몸, 위쪽 38%는 말풍선 자리
    'stage': 'Framing inside each frame: {N} is centred slightly left, standing or sitting on the surface with its lowest point at about 88 percent of the frame height and the top of its head at about 42 percent of the frame height. The upper 38 percent of each frame is calm, empty background (a speech bubble will be placed there later). Nothing is cropped.',
    # 작은 동그라미·대화 상자: 머리와 어깨가 칸을 채움
    'close': 'Framing inside each frame: a friendly close-up portrait. {N}\'s head is centred horizontally, the eyes sit at about 45 percent of the frame height, and the head and upper body fill about 70 percent of the frame width, so the face still reads clearly when the frame is shown as a small circle. The bottom of the frame cuts through the body; the top of the head is fully visible with a little space above it.',
}

SCENES = {
    ('onb', 'mongle'): None,  # 시험판(p_onb_mongle.txt)을 그대로 쓴다
    ('onb', 'kkamong'): ('stage', 'Kkamong (see MASCOTS) stands proudly on top of a small stack of three felt books (dusty blue, mustard and cream covers, no titles) on a warm honey-coloured oak floor in the sunny corner of a small handmade felt room. Kkamong believes it is the coolest dragon in the world: chest puffed out, both short fluffy arms on its hips, its long tail with the coral felt paddle curled proudly around the side of the books. It faces the camera. Background: a soft cream plaster wall with a faint felt texture, a bit of a window frame at the far left edge with warm afternoon sunlight from the upper left, gentle bounce light, soft real contact shadows. Eye-level camera, 50mm lens look, shallow depth of field.'),
    ('onb', 'marin'): ('stage', 'Marin (see MASCOTS) stands very upright next to a tiny open felt notebook with neat dotted lines and a small pencil on a warm honey-coloured oak floor in the sunny corner of a small handmade felt room; beside the notebook a single white felt daisy stands in a thimble used as a vase. Marin is serious and precise but secretly kind: it stands straight like on duty, one tiny arm holding the strap of its cross-body pouch, facing the camera. Background: a soft cream plaster wall with a faint felt texture, a bit of a window frame at the far left edge with warm afternoon sunlight from the upper left, gentle bounce light, soft real contact shadows. Eye-level camera, 50mm lens look, shallow depth of field.'),
}

LIGHT_ROOM = 'warm late-afternoon light from a window on the left, cosy and soft, gentle bounce light, shallow depth of field so the background melts into soft bokeh'
CLOSE = {
    # 홈: 방 안 소파 위 동그란 말풍선 친구
    'home': {
        'mongle': f'Mongle sits on a mustard-yellow felt floor cushion in the living room of a small handmade felt house. Behind it, out of focus: a wooden shelf with a sage-green potted plant and the warm glow of a window. {LIGHT_ROOM}.',
        'kkamong': f'Kkamong sits on a mustard-yellow felt floor cushion in the living room of a small handmade felt house, its long tail with the coral felt paddle curled around the cushion. Behind it, out of focus: a wooden shelf with a sage-green potted plant and the warm glow of a window. {LIGHT_ROOM}.',
        'marin': f'Marin sits upright on a mustard-yellow felt floor cushion in the living room of a small handmade felt house. Behind it, out of focus: a wooden shelf with a sage-green potted plant and the warm glow of a window. {LIGHT_ROOM}.',
    },
    # 배우기: 생활 한국어 — 창가 책상에서 함께 공부
    'life': {
        'mongle': 'Mongle sits at a small wooden study desk by a big window; in front of it lies an open felt notebook with dotted lines and a short yellow pencil. Through the window, softly out of focus, a cheerful Seoul street made of felt: a corner shop with a striped awning, a green bus stop sign shape without letters. Bright clear midday daylight from the window on the right, soft and even.',
        'kkamong': 'Kkamong sits at a small wooden study desk by a big window, one fluffy arm resting on an open felt notebook with dotted lines, a short yellow pencil next to it. Through the window, softly out of focus, a cheerful Seoul street made of felt: a corner shop with a striped awning, a green bus stop sign shape without letters. Bright clear midday daylight from the window on the right, soft and even.',
        'marin': 'Marin sits at a small wooden study desk by a big window, one tiny arm on an open felt notebook with neat dotted lines, a short yellow pencil lined up perfectly straight beside it. Through the window, softly out of focus, a cheerful Seoul street made of felt: a corner shop with a striped awning, a green bus stop sign shape without letters. Bright clear midday daylight from the window on the right, soft and even.',
    },
}
GAME = {
    # 바람길: WORLD 스킨은 한강 해 질 녘 하늘 + 어두운 펠트 길에 코랄 차선 하나
    'runner': 'stands at the edge of a dark charcoal felt running road with one coral felt lane stripe, beside the Han river at dusk: behind it, softly out of focus, the river, a long bridge and warm city lights as round bokeh, a deep blue evening sky with a last band of peach light. A warm low rim light from behind on the right outlines its felt fibres, a soft cool fill from the front.',
    # 말의 리듬: 작은 무대 · 박자
    'rhythm': 'stands on a small round wooden stage under one warm spotlight from above; behind it, out of focus, a deep navy felt curtain with a string of tiny warm bulbs as round bokeh, and a small brown felt metronome stands at the edge of the stage. Soft warm key light from the upper front, the background falls into darkness.',
    # 한글 무대: 한지 · 붓 · 벼루
    'hangul': 'sits at a low wooden writing desk with a sheet of cream hanji paper, a small brush resting on a black felt ink stone, and a few blank paper cards; behind it, out of focus, a hanok sliding door with cream paper panels glowing in soft daylight. Calm, soft, even daylight from the left.',
    # 첫 문장 놀이: 문장 카드 세 장을 맞히면 목도리 선물
    'first': 'sits at a small round table covered with a cream felt cloth; in front of it lie three blank paper sentence cards in a row and a small gift box wrapped in coral felt with a cream ribbon (the prize). Behind it, out of focus, a bright playroom with a wooden shelf and a soft green plant. Bright, cheerful, soft morning light from the right.',
}
for sit, scene in GAME.items():
    for tid in ('mongle', 'kkamong', 'marin'):
        SCENES[(sit, tid)] = ('close', f'{NAMES[tid]} {scene}' + (' Its long tail with the coral felt paddle curls around its side.' if tid == 'kkamong' else ''))
for sit, per in CLOSE.items():
    for tid, scene in per.items():
        SCENES[(sit, tid)] = ('close', scene)

# 튜터 고르기 까몽 다시: 정본의 공중 자세를 따라 떠 보였고 놀람·으쓱 칸이 기본과 같았다 → 앉은 자세를 못 박고 얼굴 차이를 키운다
SCENES[('onb', 'kkamong')] = ('stage', 'Kkamong (see MASCOTS) SITS firmly on top of a small stack of three felt books (dusty blue, mustard and cream covers, no titles) on a warm honey-coloured oak floor in the sunny corner of a small handmade felt room. Its round fluffy bottom presses down into the top book (the cover dents slightly), both short arms rest on its round belly, and its long tail with the coral felt paddle hangs down over the side of the books and touches the floor. It is NOT floating and its arms are NOT raised. Kkamong believes it is the coolest dragon in the world, so it sits proudly with its chest out, facing the camera. Background: a soft cream plaster wall with a faint felt texture, a bit of a window frame at the far left edge with warm afternoon sunlight from the upper left, gentle bounce light, soft real contact shadows. Eye-level camera, 50mm lens look, shallow depth of field.')

# 게임·홈·배우기의 마린은 성공 때 눈웃음(꽃 렌즈)을 쓴다 → 잔잔감음 대신 눈웃음
MARIN_PLAY = [
    ('기본', 'calm default - two round butter-yellow felt lens eyes (chart cell 1)'),
    ('눈웃음', 'smiling - each lens is replaced by a small yellow felt daisy flower (chart cell 3)'),
    ('놀람', 'surprised - both yellow lenses bigger, brighter and slightly oval (chart cell 4)'),
    ('기쁨', 'secretly happy - both lenses glowing a warmer brighter yellow (chart cell 6)'),
    ('집중', 'focused - each lens with a bright horizontal glowing band across the middle (chart cell 7)'),
    ('민망', 'a little embarrassed - one lens normal and one lens smaller and dimmer (chart cell 5)'),
]
FACE_OVERRIDE = {(s, 'marin'): MARIN_PLAY for s in ('runner', 'rhythm', 'hangul', 'first')}
# 까몽은 얼굴 차이가 작게 나와 「눈에 띄게」를 덧붙인다
KK_BOOST = ' Make every frame\'s eyes clearly different from frame 1 so the expression change is obvious even at small size.'

BASE_REFS = {t: [f'ref/본체_{t}.jpg', f'ref/표정표_{t}.jpg'] for t in FACES}


def faces_of(sit, tid):
    return FACE_OVERRIDE.get((sit, tid), FACES[tid])


def write(sit, tid, framing, scene):
    n = NAMES[tid]
    faces = '\n'.join(f'{i + 1}. {POS[i]}: {d}.' for i, (_, d) in enumerate(faces_of(sit, tid)))
    if tid == 'kkamong':
        faces += KK_BOOST
    text = (HEAD.format(N=n) + '\nThe shot (same in every frame): ' + scene + '\n' + FRAMING[framing].format(N=n) +
            f'\n\n{n}\'s face in each frame (REFERENCE 2 is an expression chart of the real {n} toy in 4 x 2 cells; copy the exact face pieces from the named chart cell):\n' +
            faces + '\n\n{{MASCOTS}}\n' + f'Only {n} appears in this image. REFERENCE 1 shows {n}\'s body; REFERENCE 2 shows its faces.\n')
    path = os.path.join(ROOT, f'p_{sit}_{tid}.txt')
    open(path, 'w', encoding='utf-8').write(text)
    return path


if __name__ == '__main__':
    import json
    jobs = []
    for (sit, tid), v in SCENES.items():
        if v is None:
            continue
        write(sit, tid, *v)
        jobs.append({'name': f'{sit}_{tid}', 'prompt': f'p_{sit}_{tid}.txt', 'refs': BASE_REFS[tid],
                     'faces': [f for f, _ in faces_of(sit, tid)]})
    json.dump(jobs, open(os.path.join(ROOT, 'jobs_tutor.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(len(jobs), 'jobs')
