# E64 「서비스」 v8 — 계산서 넷째 줄을 「더 주세요~!」 말풍선으로 바꾼 샷 b2(유호님 11-27 「마지막에 이해가 잘 안가」 → 「응, 고쳐」).
# 판 둘(제작 절차 #lab-two-takes): 「python 영상칸/_v8계획쓰기.py a」 → 굽기 b2, 「python 영상칸/_v8계획쓰기.py b」 → 굽기 b2(받음/b2_b.mp4).
# 둘째 판은 뜻이 같고 낱말만 바꾼 글과 새 key다. 움직임은 v7 b1 a판(손끝 두 번 두드림)과 같다.
import io
import json
import os
import sys

here = os.path.dirname(os.path.abspath(__file__))
판 = sys.argv[1] if len(sys.argv) > 1 else 'a'

글 = {
    'a': ('taps twice on the table right beside the circled price',
          """Very close top-down view of the cream felt bill from the start frame, lying flat on the walnut felt table. MONGLE is not in this shot. ACTION: The bill lies perfectly flat and still the whole time; it never moves, bends or slides. Everything sewn and embroidered on it stays exactly as in the start frame: the three "₩0" prices, the little felt speech bubble with the embroidered Korean words "더 주세요~!", the circled "₩8,000", and the tiny felt food items — no letter or number changes shape. From 0 to 0.8 s nothing moves except the soft lantern light. From 0.8 to 1.6 s the owner's felt fingertip at the right edge taps twice on the table right beside the circled price, small and light, without touching the bill. From 1.6 to 3.0 s the fingertip rests still, pointing at the circled price."""),
    'b': ('gives two small soft knocks on the table next to the ringed price',
          """Very close view from straight above of the cream felt bill from the start frame, resting flat on the walnut felt table. MONGLE is not in this shot. ACTION: The bill stays completely flat and motionless from the first frame to the last; it never shifts, curls or slides. Every stitched detail keeps exactly the look of the start frame: the three "₩0" prices, the small felt speech bubble embroidered with the Korean words "더 주세요~!", the ringed "₩8,000", and the little felt dishes — no letter or digit warps. From 0 to 0.8 s only the warm lantern light breathes softly. From 0.8 to 1.6 s the owner's felt fingertip at the right edge gives two small soft knocks on the table next to the ringed price, never touching the bill. From 1.6 to 3.0 s the fingertip stays still, pointing at the ringed price."""),
}
key, prompt = 글[판]

p = os.path.join(here, '계획.json')
plan = json.load(io.open(p, encoding='utf-8'))
plan['b2'] = {'model': 'Omni 1.2 Flash', 'n': 1, 'cost': '9', 'dur': '3초', 'proj': 'omni', 'start': 'b2', 'key': key}
plan['_v8'] = 'b2는 b1의 넷째 줄을 「더 주세요~!」 말풍선으로 바꾼 계산서 칸 — 판 a · b(_v8계획쓰기.py a | b)를 굽고 고른다(11-27 유호님 「응, 고쳐」)'
io.open(p, 'w', encoding='utf-8', newline='\n').write(json.dumps(plan, ensure_ascii=False, indent=2) + '\n')

q = os.path.join(here, '지시문.json')
d = json.load(io.open(q, encoding='utf-8'))
old = {c['id']: c for c in d['클립']}
if 'b2' in old:
    old['b2']['prompt'] = prompt
else:
    d['클립'].append({'id': 'b2', 'prompt': prompt})
io.open(q, 'w', encoding='utf-8', newline='\n').write(json.dumps(d, ensure_ascii=False, indent=2) + '\n')
print('ok b2', 판, key)
