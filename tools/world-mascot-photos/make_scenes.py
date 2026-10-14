# 장면 그림 지시문(프로필·환영·카페·이야기·한글 무대 가르치기) → p_*.txt, jobs_scene.json
import json, os

ROOT = os.path.dirname(os.path.abspath(__file__))
REF3 = ['ref/본체_mongle.jpg', 'ref/본체_kkamong.jpg', 'ref/본체_marin.jpg']
REFNOTE = 'REFERENCE 1 is the real Mongle toy, REFERENCE 2 the real Kkamong toy, REFERENCE 3 the real Marin toy.'
NOTEXT = 'Absolutely no letters, numbers, words, logos or symbols anywhere in the image (signs, books, tags and labels are blank).'
STYLE = 'It is a real photograph of a handmade needle-felt miniature set (felt, wool, wood, paper), shot with a 50mm lens look, natural soft light, shallow depth of field, gentle film grain. Warm, calm, slightly muted colours.'
jobs = []


def job(name, text, refs=REF3, faces=None, grid=None, split=None):
    open(os.path.join(ROOT, f'p_{name}.txt'), 'w', encoding='utf-8').write(text)
    j = {'name': name, 'prompt': f'p_{name}.txt', 'refs': refs}
    if faces:
        j.update(faces=faces, grid=grid, split=split or [])
    jobs.append(j)


# 프로필: 계정 사진처럼(동그라미로 잘린다)
job('profile', f'''Image to generate: a square image made of exactly FOUR equal square photos in a precise 2 x 2 grid, separated by thin straight pure-white gutter lines about 12 pixels wide. No outer border, no text.
Each photo is a friendly ID-card portrait of one felt mascot: head and upper body centred, the face in the middle of the frame (the eyes at about 45 percent of the height), the head filling about 70 percent of the frame width so it still reads as a small circle avatar. Plain backdrop of soft warm-grey felt with a gentle light falloff, soft even studio light from the front-left, a tiny soft shadow.
1. top-left: Mongle with gentle smiling eyes stitched as two upward arcs in dark-brown thread.
2. top-right: Kkamong with happy light-green stitched upward-arc eyes.
3. bottom-left: Marin whose two lenses are small yellow felt daisy flowers (its smiling face).
4. bottom-right: Mongle with calm black glass bead eyes.
{STYLE} {NOTEXT}

{{{{MASCOTS}}}}
{REFNOTE}
''', faces=['mongle', 'kkamong', 'marin', 'mongle-기본'], grid=[2, 2], split=['--free', '--size=384'])

# 첫 환영(계정 만들기 전 「SYNK WORLD 시작하기」)
job('welcome', f'''Image to generate: one square photograph.
The three felt friends welcome a new visitor at the open round wooden door of their small felt house: Kkamong stands on the left waving one short fluffy arm, Mongle stands in the middle slightly in front with gentle smiling stitched-arc eyes, Marin stands on the right raising one tiny arm in a hello, its lenses glowing warm yellow. They stand on a little cream felt doormat on a stone step, warm light spills from inside the house behind them, a small potted sage plant beside the door. Morning daylight from the left, soft real contact shadows. The group is centred and fills about 70 percent of the frame width, their feet at about 86 percent of the height, nothing cropped.
{STYLE} {NOTEXT}

{{{{MASCOTS}}}}
{REFNOTE}
''')

# 카페 「구름 한 잔」 — 장면 상자는 넓고 낮다(약 2:1). 쟁반(음료)이 빈 쪽에 얹힌다.
CAFE = 'a cosy felt neighbourhood cafe called "Cloud" (but no visible text): warm wood, cream walls, small hanging lamps, a felt espresso machine and cups in the background.'
for name, place, side in [
    ('cafe_counter', f'The three friends stand side by side in front of the wooden order counter of {CAFE} They look up toward the counter, ready to order.', 'left'),
    ('cafe_window', f'The three friends sit around a small round wooden table by a big sunny window inside {CAFE} Mongle sits on a cushion on the chair, Kkamong and Marin on their chairs, all relaxed and chatting.', 'left'),
    ('cafe_garden', f'The three friends sit around a small wooden table on the garden terrace of {CAFE}, surrounded by felt potted plants and a little hedge, dappled daylight.', 'right'),
]:
    other = 'right' if side == 'left' else 'left'
    job(name, f'''Image to generate: one landscape 3:2 photograph.
{place}
Composition: the friends are grouped in the {side} half of the frame, occupying about 40 percent of the frame width, their bodies between 30 and 82 percent of the frame height. The {other} half shows an empty part of the wooden table/counter top at the same height (drinks will be placed there later) with the softly blurred cafe behind. Keep the important parts inside the middle band from 22 to 84 percent of the height because the image will be shown as a wide, short strip.
{STYLE} {NOTEXT}

{{{{MASCOTS}}}}
{REFNOTE}
''')

# 생활 한국어 이야기 6편: 같은 장면 2×2 — 해설(모두 차분) · 몽글 · 까몽 · 마린이 말하는 순간
STORIES = {
    'story_greetings': 'the three friends meet for the first time in a sunny little felt community hall; on a low table in front of them lie three blank felt name tags with ribbons.',
    'story_cafe': 'the three friends stand at the counter of a cosy felt cafe; on the counter is a cup topped with a big fluffy whipped-cream cloud that looks like a real little cloud.',
    'story_store': 'the three friends stand in the aisle of a small bright felt convenience store, shelves of small felt water bottles and snacks behind them, a little felt shopping basket on the floor next to Kkamong.',
    'story_directions': 'the three friends stand on a quiet felt street corner beside a wooden signpost with blank arrow boards; a big felt map lies open on the pavement in front of them, upside down.',
    'story_transit': 'the three friends sit side by side on the seat of a green felt city bus; through the bus window behind them, out of focus, a road lined with flowering trees; a small red stop button on the pole beside them.',
    'story_plans': 'the three friends stand in front of the steps of a small felt library building with a big round clock above the door showing three o\'clock (hands only, no numbers).',
}
for name, scene in STORIES.items():
    job(name, f'''Image to generate: a stop-motion contact sheet. Landscape 3:2 image made of exactly FOUR equal frames in a precise 2 x 2 grid, separated by thin straight pure-white gutter lines about 12 pixels wide. No outer border, no text.
All four frames are the SAME locked-off camera shot of the SAME miniature set: {scene} The friends stand left to right: Mongle, Kkamong, Marin, at the same positions and sizes in every frame, their bodies between 30 and 86 percent of the frame height, together about 60 percent of the frame width, nothing cropped. Only who is talking changes:
1. top-left: nobody talks - all three calm with default faces (Mongle black bead eyes, Kkamong round green eyes, Marin round yellow lenses), looking at the scene.
2. top-right: Mongle talks - Mongle has lively smiling stitched-arc eyes and leans a tiny bit forward; the other two turn their heads slightly toward Mongle.
3. bottom-left: Kkamong talks - Kkamong has proud happy green stitched-arc eyes and lifts one short arm; the other two turn slightly toward Kkamong.
4. bottom-right: Marin talks - Marin's lenses glow brighter with a bright horizontal band (focused, explaining) and it raises one tiny arm; the other two turn slightly toward Marin.
Light and set are identical in all frames. {STYLE} {NOTEXT}

{{{{MASCOTS}}}}
{REFNOTE}
''', faces=['narrator', 'mongle', 'kkamong', 'marine'], grid=[2, 2], split=['--size=768', '--thr=24'])

# 한글 무대 「몽글에게 가르쳐 주기」: 몽글이 빈 카드를 보며 갸웃 → 알았다
job('teach_mongle', f'''Image to generate: a stop-motion contact sheet. Landscape 3:2 image made of exactly TWO equal portrait frames side by side, separated by one thin straight pure-white gutter line about 12 pixels wide. No outer border, no text.
Both frames are the SAME locked-off camera shot: Mongle sits on a low wooden writing desk next to a blank cream paper card standing on a tiny wooden easel, a brush on a black felt ink stone beside it; behind, out of focus, a hanok sliding door with glowing cream paper panels. Calm soft daylight from the left. Close framing: Mongle fills about 60 percent of the frame width, its eyes at about 42 percent of the height, the card at its side.
1. left: Mongle tilts its whole body about 10 degrees toward the card, puzzled - black bead eyes glancing up to one side, a tiny pink felt blush.
2. right: the same pose, but Mongle has understood - happy stitched upward-arc eyes and rosy blush.
{STYLE} {NOTEXT}

{{{{MASCOTS}}}}
Only Mongle appears. REFERENCE 1 is the real Mongle toy.
''', refs=['ref/본체_mongle.jpg'], faces=['curious', 'smile'], grid=[2, 1], split=['--size=512'])

json.dump(jobs, open(os.path.join(ROOT, 'jobs_scene.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(jobs), [j['name'] for j in jobs])
