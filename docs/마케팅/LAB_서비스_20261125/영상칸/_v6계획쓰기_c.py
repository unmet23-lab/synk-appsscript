# E64 「서비스」 v6 a11 다시 굽기(11-27) — 이해 시험 v6-1에서 시험관 셋 모두 끝 24~26.5초를 짚었다(누가 왜 곤란한지 · 무엇을 청구하는지).
# 볼 이유 심사관도 「몽글은 무표정에 땀 한 방울뿐」을 가장 약한 자리로 짚었다. 굳은 무표정 대신 계산서를 내려다보고 크게 놀라는 얼굴로 두 판(c · d)을 굽는다.
# 쓰는 법: python -I 영상칸/_v6계획쓰기_c.py c|d — 그 판의 글과 key를 a11에 쓴다.
import io
import json
import os
import sys

here = os.path.dirname(os.path.abspath(__file__))
SHOTS = {
    'c': ('drops open into a big round shocked', """Close on Mongle from the start frame: pale Mongle with an empty white felt plate resting on its head, the small cream paper bill and the yellow wallet on the table in front of it. ACTION: From 0 to 0.5 s Mongle looks down at the paper bill. From 0.5 to 1.3 s Mongle's two eyes grow big and round in shock, staying solid glossy black beads with no white around them, and its tiny straight felt mouth drops open into a big round shocked 'O'; its whole dome jolts up a little. From 1.3 to 2.2 s the empty plate on its head slides slowly a little to one side and stops, still resting on its head. From 2.2 to 3.0 s Mongle turns one shade paler and one small pale-blue felt sweat drop appears on its side; its mouth stays open in shock. Nothing sticks out of Mongle's body."""),
    'd': ('its small mouth falls open into a wide shocked', """Close on Mongle from the start frame: pale Mongle balancing an empty white felt plate on its head, with the small cream paper bill and the yellow wallet lying on the table before it. ACTION: From 0 to 0.5 s Mongle glances down at the paper bill. From 0.5 to 1.3 s its bead eyes widen into big round glossy black beads, with no white around them, its small mouth falls open into a wide shocked round 'O', and its whole dome gives one small startled jump in place. From 1.3 to 2.2 s the empty plate on its head slowly slips a little to one side and stops, never leaving its head. From 2.2 to 3.0 s Mongle goes a shade paler and a single small pale-blue felt sweat drop appears on its side; the shocked open mouth stays. Nothing ever grows out of Mongle's body."""),
}
v = sys.argv[1]
key, prompt = SHOTS[v]
assert prompt.count(key) == 1
p = os.path.join(here, '계획.json')
plan = json.load(io.open(p, encoding='utf-8'))
plan['a11']['key'] = key
io.open(p, 'w', encoding='utf-8', newline='\n').write(json.dumps(plan, ensure_ascii=False, indent=2) + '\n')
q = os.path.join(here, '지시문.json')
d = json.load(io.open(q, encoding='utf-8'))
for c in d['클립']:
    if c['id'] == 'a11':
        c['prompt'] = prompt
io.open(q, 'w', encoding='utf-8', newline='\n').write(json.dumps(d, ensure_ascii=False, indent=2) + '\n')
print('ok a11', v)
