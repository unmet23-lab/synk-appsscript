# E64 「서비스」 v6 둘째 판 — 샷마다 두 판을 굽고 고른다(제작 절차 lab-two-takes · 유호님 11-26 「크레딧 아끼지 마」).
# 첫 판(_v6계획쓰기.py)과 뜻은 같고 낱말만 바꾼 글과 새 key를 영상칸/지시문.json · 계획.json의 a3~a11에 쓴다.
# 첫 판에서 본 흠도 같은 글에서 막는다(아래 SHOTS 주석). 첫 판 굽기가 다 끝난 뒤에만 돌린다(굽는 동안 지시문을 바꾸지 않는다).
# 쓰는 법: python -I 영상칸/_v6계획쓰기_b.py [칸…] — 칸을 주면 그 칸만 쓴다(다시 굽기).
import io
import json
import os
import sys

here = os.path.dirname(os.path.abspath(__file__))

SHOTS = {
    # 첫 판 a: 3초 무렵 몽글이 눈을 감고 웃는 입이 생김 → 걱정한 구슬 눈을 끝까지 둔다
    'a3': ('dips his head in a single proud nod', """Medium shot of the restaurant owner on the far side of the table from the start frame, Mongle at the right edge. ACTION: From 0 to 1.2 s the owner sets the white felt plate of sweet-and-sour pork down the last finger's width onto the table beside the dumplings. From 1.2 to 2.4 s he stands up straight, beaming with pride, and dips his head in a single proud nod. From 2.4 to 4.0 s he holds one open palm toward the new plate, smiling at Mongle. At 1.0 s Mongle tips back a little further in surprise and stays tipped back, its two round glossy bead eyes wide open and worried until the last frame; Mongle never smiles and never closes its eyes in this shot. The wallet stays flat in place; nothing moves unless a hand touches it."""),
    # 첫 판 a: 0.5~1.25초 눈을 굴릴 때 흰자가 생김 · 끝에 웃는 입 → 몸을 기울여 불안을 보이고 눈은 구슬 그대로
    'a4': ('leans a little to the left, then a little to the right', """Very close on Mongle from the start frame, the open yellow felt wallet and a few gold felt coins on the table at the left. ACTION: From 0 to 1.0 s Mongle's whole soft dome leans a little to the left, then a little to the right, nervously; its two eyes stay small solid glossy black beads the whole time, with no white around them, and its two pale-blue felt sweat drops stay on its side. From 1.0 to 2.2 s Mongle squashes forward and bumps the open wallet with the front of its scalloped hem, and three more small gold felt coins spill out of the wallet and slide flat along the table to the left; the coins stay flat on the table and never jump or fly. From 2.2 to 3.0 s Mongle sinks back, its small wavy felt mouth staying wavy and worried; Mongle does not smile."""),
    'a5': ('into the only empty space left on the table', """Wide high view of the whole crowded table from the start frame. ACTION: From 0 to 1.5 s the owner, holding the big white felt bowl of red jjamppong in both hands, lowers it the last little bit into the only empty space left on the table. From 1.5 to 2.5 s he lets go and takes half a step back, both hands open, beaming at the full table. From 2.5 to 4.0 s little Mongle between the bowls slowly sinks lower and squashes down, its bead eyes growing wider. No dish moves unless the owner's hands touch it."""),
    # 첫 판 a: 0.5초부터 몸에서 팔 같은 분홍 돌기가 나와 동전을 밂 → 몸 전체가 앞으로 쏠리고 밑단만 닿는다고 쓴다
    'a6': ('lurches forward three times in short bursts', """Very close on Mongle from the start frame, its eyes squeezed shut, the small heap of gold felt coins and the empty open wallet in front of it. ACTION: From 0 to 2.2 s Mongle's whole soft dome lurches forward three times in short bursts, and each time the front edge of its scalloped hem bumps the coin heap and the wallet a little further to the left; the coins slide flat along the table and never lift. Nothing ever sticks out of Mongle's body: no arm, no hand, no flap, no tongue; only the scalloped hem touches the coins. Mongle's eyes stay squeezed shut as two short felt arcs and its small open felt mouth stays a panicked round 'O'. From 2.2 to 3.0 s Mongle stays squashed forward, panting, its body gently rising and falling."""),
    # 첫 판 a: 동전과 지갑을 몽글 쪽으로 거의 되밀지 않음 · 2.5초부터 웃는 입 → 밑단에 닿을 때까지 밀고, 몽글은 놀라 눈만 커진다
    'a7': ('until they rest against the front of Mongle', """Medium close on the owner from the start frame, Mongle at the right edge. ACTION: From 0 to 1.2 s the owner breaks into a warm laugh, his shoulders bouncing, his eyes squeezed into happy curves. From 1.2 to 3.0 s his raised right hand waves palm-out twice in a friendly 'no, no' while his left hand, flat on the yellow wallet, slowly slides the wallet and the heap of gold felt coins to the right across the table until they rest against the front of Mongle's scalloped hem; the coins slide flat and stay together under his hand. From 3.0 to 4.0 s he lifts his hand away, smiles and gives Mongle one nod. Mongle gazes up at him with round bead eyes and no mouth, tips its dome slightly at 2.0 s, and from 3.0 s its bead eyes grow bigger and rounder in surprise."""),
    'a8': ('breathes out one long relieved sigh', """Close on Mongle from the start frame with its sparkling felt star eyes. ACTION: From 0 to 1.5 s Mongle breathes out one long relieved sigh: its dome slowly sinks flatter and a little wider, its rosy cheeks glowing, its small happy open felt mouth growing wider. From 1.5 to 3.0 s it does one small happy bounce and settles. The closed yellow wallet and the coins in front of it stay still."""),
    # 첫 판 a: 0.7초부터 몸에서 분홍 팔이 나와 접시를 머리에서 들어 내밂 → 몸 전체를 기울이고 접시는 머리 위에만
    'a9': ('leans its whole dome toward the owner', """Medium shot from the start frame: Mongle with one empty white felt plate resting flat on top of its head, empty felt bowls on the table, the owner at the left edge. ACTION: From 0 to 1.5 s Mongle stretches up a little taller and leans its whole dome toward the owner on the left, so the plate resting on its head tips toward him like an offering; Mongle keeps its happy curved eyes and cheeky smile. From 1.5 to 3.0 s it bounces twice, small and happy, without leaving the table. From 3.0 to 4.0 s it stays leaning toward the owner. The plate never leaves the top of Mongle's head and nothing holds it: nothing ever sticks out of Mongle's body, no arm, no hand, no flap. The owner keeps smiling at Mongle, his hands resting on the table."""),
    'a10': ('pushes the small cream paper slip forward', """Very close on the owner from the start frame, holding a small plain cream felt paper slip. ACTION: From 0 to 0.8 s his smile turns stiff and frozen and he blinks once, slowly; the felt sweat drop stays at his temple. From 0.8 to 2.2 s his right hand pushes the small cream paper slip forward toward the camera. From 2.2 to 3.0 s he holds it out with an awkward fixed grin, eyebrows slightly raised."""),
    'a11': ('slides slowly a little to one side', """Close on Mongle from the start frame: pale Mongle with an empty white felt plate on its head, the small cream paper slip and the yellow wallet on the table in front of it. ACTION: From 0 to 0.6 s Mongle's bead eyes get a little bigger. From 0.6 to 1.8 s the empty plate on its head slides slowly a little to one side and stops, still resting on its head. From 1.8 to 3.0 s Mongle turns one shade paler and a single small pale-blue felt sweat drop appears on its side; its tiny straight felt mouth stays."""),
}

ids = sys.argv[1:] or list(SHOTS)
for k in ids:
    key, prompt = SHOTS[k]
    if prompt.count(key) != 1:
        sys.exit(f'{k}: key가 글에 한 번만 나와야 한다 — {key}')

p = os.path.join(here, '계획.json')
plan = json.load(io.open(p, encoding='utf-8'))
q = os.path.join(here, '지시문.json')
d = json.load(io.open(q, encoding='utf-8'))
clips = {c['id']: c for c in d['클립']}
for k in ids:
    key, prompt = SHOTS[k]
    plan[k]['key'] = key
    clips[k]['prompt'] = prompt
plan['_v6'] = 's1 · s2는 v1 판을 그대로 쓴다. a3~a11은 샷마다 두 판(첫 판 _v6계획쓰기.py · 둘째 판 _v6계획쓰기_b.py)을 굽고 고른다'
io.open(p, 'w', encoding='utf-8', newline='\n').write(json.dumps(plan, ensure_ascii=False, indent=2) + '\n')
io.open(q, 'w', encoding='utf-8', newline='\n').write(json.dumps(d, ensure_ascii=False, indent=2) + '\n')
print('ok', ids)
