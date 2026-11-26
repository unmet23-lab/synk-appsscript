# E64 「서비스」 v6 — 새 샷 아홉(a3~a11)의 Omni 계획과 지시문을 영상칸/계획.json · 지시문.json에 더한다(11-26 「다시 만들어」).
# s1 · s2는 v1에서 받은 판을 그대로 쓰고 다시 굽지 않는다. 공통 글은 지금의 영상 공통 글(LAB_하루두편_설계_20261110/영상_공통글.txt)이다.
import io
import json
import os

here = os.path.dirname(os.path.abspath(__file__))
root = os.path.abspath(os.path.join(here, '..', '..', '..', '..'))
공통 = io.open(os.path.join(root, 'docs', '마케팅', 'LAB_하루두편_설계_20261110', '영상_공통글.txt'), encoding='utf-8').read().strip()

SHOTS = {
    'a3': (4, 'gives one small proud nod', """Medium shot of the owner across the table from the start frame, Mongle at the right edge. ACTION: From 0 to 1.2 s the owner lowers the white felt plate of sweet-and-sour pork the last finger's width and sets it down on the table next to the dumplings. From 1.2 to 2.4 s he straightens up, beaming proudly, and gives one small proud nod. From 2.4 to 4.0 s he opens one hand toward the new plate, palm up, smiling at Mongle. At 1.0 s Mongle leans back a little more in surprise, then stays leaning back. The wallet stays flat where it is; nothing moves unless a hand touches it."""),
    'a4': (3, 'three more small gold felt coins slide out', """Very close on Mongle from the start frame, the open yellow felt wallet and a few gold felt coins on the table on the left. ACTION: From 0 to 1.0 s Mongle's bead eyes dart left, then right, its two pale-blue felt sweat beads staying on its side. From 1.0 to 2.2 s Mongle squashes forward and nudges the open wallet with the front of its scalloped hem, and three more small gold felt coins slide out of the wallet along the table to the left; the coins slide flat on the table and never fly. From 2.2 to 3.0 s Mongle settles back, its small wavy felt mouth wobbling."""),
    'a5': (4, 'onto the last free spot of the table', """Wide high view of the whole crowded table from the start frame. ACTION: From 0 to 1.5 s the owner lowers the big white felt bowl of red jjamppong with both hands the last bit onto the last free spot of the table. From 1.5 to 2.5 s he lets go and steps back half a step with both hands open, beaming at the full table. From 2.5 to 4.0 s small Mongle between the bowls slowly sinks lower, squashing down, its bead eyes getting wider. No dish moves unless the owner's hands touch it."""),
    'a6': (3, 'in three short pushes', """Very close on Mongle from the start frame, eyes squeezed shut, the small heap of gold felt coins and the empty open wallet in front of it. ACTION: From 0 to 2.2 s Mongle squashes forward with its whole body and shoves the heap of gold felt coins and the wallet to the left in three short pushes; the coins slide along the table and never fly up. Mongle's eyes stay squeezed shut into two short felt arcs and its small open felt mouth stays in a panicked 'O'. From 2.2 to 3.0 s Mongle stays squashed forward, breathing hard, its body rising and falling a little."""),
    'a7': (4, "waves palm-out in a friendly 'no, no' twice", """Medium close on the owner from the start frame, Mongle at the right edge. ACTION: From 0 to 1.2 s the owner bursts into a warm laugh, shoulders bouncing, eyes squeezed into happy curves. From 1.2 to 3.0 s his raised right hand waves palm-out in a friendly 'no, no' twice while his left hand slowly sweeps the heap of gold felt coins and the yellow wallet back across the table toward Mongle on the right. From 3.0 to 4.0 s he smiles and nods once at Mongle. Mongle looks up at him with round bead eyes and tilts its dome a little at 2.0 s."""),
    'a8': (3, 'lets out a long relieved breath', """Close on Mongle from the start frame with its sparkling felt star eyes. ACTION: From 0 to 1.5 s Mongle lets out a long relieved breath: its dome slowly flattens and widens a little, its rosy cheeks glowing, its small happy open felt mouth widening. From 1.5 to 3.0 s it gives one small happy bounce and settles. The closed yellow wallet and the coins in front of it do not move."""),
    'a9': (4, 'tilts the plate on its head toward the owner', """Medium shot from the start frame: Mongle with one empty white felt plate balanced on its head, empty felt bowls on the table, the owner at the left edge. ACTION: From 0 to 1.5 s Mongle stretches tall and tilts the plate on its head toward the owner on the left, offering it, its happy curved eyes and cheeky smile staying. From 1.5 to 3.0 s it bounces twice, small and happy; the plate stays balanced on its head the whole time and never falls. From 3.0 to 4.0 s it holds the plate tilted toward the owner. The owner keeps smiling and looks at Mongle, his hands resting on the table."""),
    'a10': (3, 'slides the small cream paper slip forward', """Very close on the owner from the start frame, holding a small plain cream felt paper slip. ACTION: From 0 to 0.8 s his smile goes stiff and frozen, and he blinks once slowly; the felt sweat bead stays at his temple. From 0.8 to 2.2 s his right hand slides the small cream paper slip forward toward the camera. From 2.2 to 3.0 s he holds it there with an awkward fixed grin, eyebrows a little raised."""),
    'a11': (3, 'the empty plate on its head slowly slides', """Close on Mongle from the start frame: pale Mongle with an empty white felt plate on its head, the small cream paper slip and the yellow wallet on the table in front of it. ACTION: From 0 to 0.6 s Mongle's bead eyes grow a little bigger. From 0.6 to 1.8 s the empty plate on its head slowly slides a little to one side and stops, still on its head. From 1.8 to 3.0 s Mongle's colour turns a shade paler and one small pale-blue felt sweat bead appears on its side; its tiny straight felt mouth stays."""),
}

p = os.path.join(here, '계획.json')
plan = json.load(io.open(p, encoding='utf-8'))
for k, (sec, key, _) in SHOTS.items():
    plan[k] = {'model': 'Omni 1.2 Flash', 'n': 1, 'cost': str(sec * 3), 'dur': f'{sec}초', 'proj': 'omni', 'start': k, 'key': key}
plan['_배우는말'] = [{'말': '서비스', '한글': '서비스는 공짜야~!', '뜻': '서비스 = FREE! 🎁', '초': 3.6, '칸': ['a7'], '음성': ['o6', 'm4']}]
plan['_v6'] = 's1 · s2는 v1 판을 그대로 쓴다. 이번 굽기는 a3~a11(첫 계획 96크레딧)'
io.open(p, 'w', encoding='utf-8', newline='\n').write(json.dumps(plan, ensure_ascii=False, indent=2) + '\n')

q = os.path.join(here, '지시문.json')
d = json.load(io.open(q, encoding='utf-8'))
old = {c['id']: c for c in d['클립']}
for c in d['클립']:
    c.setdefault('공통', d['공통'])  # v1 샷은 그때 쓴 공통 글을 제 칸에 남긴다
d['공통'] = 공통
for k, (_, _, prompt) in SHOTS.items():
    if k in old:
        old[k]['prompt'] = prompt
    else:
        d['클립'].append({'id': k, 'prompt': prompt})
d['모델'] = d.get('모델', '') + ' · v6(11-26): a3~a11은 지금의 영상 공통 글을 쓴다'
io.open(q, 'w', encoding='utf-8', newline='\n').write(json.dumps(d, ensure_ascii=False, indent=2) + '\n')
print('ok', list(SHOTS), sum(s for s, _, _ in SHOTS.values()) * 3)
