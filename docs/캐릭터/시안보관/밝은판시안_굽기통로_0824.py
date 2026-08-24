# -*- coding: utf-8 -*-
# 밝은 화면 시안 — 유호 요청 08-24 밤 「화면 배경을 밝은 버전으로 임의로 한번 만들어봐줘」.
# 요소굽기.py 정본을 «런타임 치환»으로 빌린다(NPC세트굽기.py 의 그 수법 · 베끼기 0).
# 바꾸는 것은 화면 천 셋뿐: 배경천 Ink Deep→Oat · 카드천 Ink→Paper · 할일칸 Ink→Paper.
# ⚠본문 글자(덧씌움 층)는 어두운 판 전제(밝은 잉크)라 이 시안은 «그릇만»이다 — 방향이 서면 잉크 반전까지.
import sys, os

REPO = r'C:\Users\q1212\Documents\SYNK-appsscript'
원문 = open(os.path.join(REPO, 'tools', '요소굽기.py'), encoding='utf-8').read()

치환들 = [
    ("매끈재질('배경천', 색['Ink Deep']", "매끈재질('배경천', 색['Oat']"),
    ("카드천 = 뜻색(뜻) if 뜻 else 색['Ink']", "카드천 = 뜻색(뜻) if 뜻 else 색['Paper']"),
    ("매끈재질('할일칸', 색['Ink']", "매끈재질('할일칸', 색['Paper']"),
]
for 옛, 새 in 치환들:
    assert 원문.count(옛) >= 1, '앵커가 없다: ' + 옛
    원문 = 원문.replace(옛, 새)

exec(compile(원문, os.path.join(REPO, 'tools', '요소굽기.py'), 'exec'), {'__name__': '__main__'})
