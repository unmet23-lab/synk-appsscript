# E64 「서비스」 v7 — 끝 반전을 그림으로: 계산서를 가까이 잡은 샷 b1을 더한다(유호님 11-27 「고친 뒤 바꿔」).
# 판 둘(제작 절차 #lab-two-takes): 「python 영상칸/_v7계획쓰기.py a」 → 굽기 b1, 「python 영상칸/_v7계획쓰기.py b」 → 굽기 b1(받음/b1_b.mp4).
# 둘째 판은 뜻이 같고 낱말만 바꾼 글과 새 key다. 공통 글은 지금의 영상 공통 글(지시문.json 「공통」)을 그대로 쓴다.
import io
import json
import os
import sys

here = os.path.dirname(os.path.abspath(__file__))
판 = sys.argv[1] if len(sys.argv) > 1 else 'a'

글 = {
    'a': ('taps twice on the table beside the circled price',
          """Very close top-down view of the cream felt bill from the start frame, lying flat on the walnut felt table. MONGLE is not in this shot. ACTION: The bill lies perfectly flat and still the whole time; it never moves, bends or slides, and the four embroidered prices "₩0", "₩0", "₩0" and the circled "₩8,000" and the tiny felt food items on it stay exactly as in the start frame. From 0 to 0.8 s nothing moves except the soft lantern light. From 0.8 to 1.6 s the owner's felt fingertip at the right edge taps twice on the table beside the circled price, small and light, without touching the bill. From 1.6 to 3.0 s the fingertip rests still, pointing at the circled price."""),
    'b': ('gives two small light knocks on the table next to the ringed price',
          """Very close view from straight above of the cream felt bill from the start frame, resting flat on the walnut felt table. MONGLE is not in this shot. ACTION: The bill stays completely flat and motionless from the first frame to the last; it never shifts, curls or slides, and the embroidered prices "₩0", "₩0", "₩0" and the ringed "₩8,000" and the little felt dishes sewn on it keep exactly the look of the start frame. From 0 to 0.8 s only the warm lantern light breathes softly. From 0.8 to 1.6 s the owner's felt fingertip at the right edge gives two small light knocks on the table next to the ringed price, never touching the bill. From 1.6 to 3.0 s the fingertip stays still, pointing at the ringed price."""),
}
key, prompt = 글[판]

p = os.path.join(here, '계획.json')
plan = json.load(io.open(p, encoding='utf-8'))
plan['b1'] = {'model': 'Omni 1.2 Flash', 'n': 1, 'cost': '9', 'dur': '3초', 'proj': 'omni', 'start': 'b1', 'key': key}
plan['_v7'] = 'b1은 끝 반전 칸(계산서 가까이) — 판 a · b(_v7계획쓰기.py a | b)를 굽고 고른다(11-27 유호님 「고친 뒤 바꿔」)'
io.open(p, 'w', encoding='utf-8', newline='\n').write(json.dumps(plan, ensure_ascii=False, indent=2) + '\n')

q = os.path.join(here, '지시문.json')
d = json.load(io.open(q, encoding='utf-8'))
old = {c['id']: c for c in d['클립']}
if 'b1' in old:
    old['b1']['prompt'] = prompt
else:
    d['클립'].append({'id': 'b1', 'prompt': prompt})
io.open(q, 'w', encoding='utf-8', newline='\n').write(json.dumps(d, ensure_ascii=False, indent=2) + '\n')
print('ok b1', 판, key)
