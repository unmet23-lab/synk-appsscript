#!/usr/bin/env python3
# 장면 캡처(experiences/synk-world-app/qa/site-learner-scene.mjs 출력)를 시안 그림으로 옮긴다.
# 쓰기: python -X utf8 그림.py <캡처 폴더/언어> [img 폴더]
import os, sys
from PIL import Image
src = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'img')
os.makedirs(out, exist_ok=True)
for f in os.listdir(out):
    if f.endswith('.webp'):
        os.remove(os.path.join(out, f))
# 시안 이름 → 캡처 이름(앞의 것이 있으면 그것을 쓴다)
MAP = {
    'home-reason': ['30-day8-home', '20-day2-home'],
    'home-review': ['63-day2-home-review'],
    'lesson-first': ['02a-lesson-first'],
    'lesson-wrong': ['02-lesson-wrong'],
    'review-scene': ['05-review-new-scene'],
    'review-list': ['04-review-summary'],
    'review-list-right': ['62-review-summary'],
    'review-done': ['07-review-done'],
    'followups': ['20-day2-followups-checked'],
    'followups-d7': ['30-day8-followups-open'],
    'followups-d30': ['40-day31-followups-open'],
    'evidence': ['17-evidence-ko.reading.vocabulary'],
    'game': ['13-game-pick'],
    'card-d1': ['20-day2-card-checked.crop'],
    'card-d7': ['30-day8-card-checked.crop'],
    'card-d30': ['40-day31-card-checked.crop'],
}
for name, cands in MAP.items():
    for c in cands:
        p = os.path.join(src, c + '.png')
        if os.path.exists(p):
            im = Image.open(p).convert('RGB')
            q = 86 if c.endswith('.crop') else 84
            im.save(os.path.join(out, name + '.webp'), 'WEBP', quality=q, method=6)
            print(name, '<-', c, im.size, os.path.getsize(os.path.join(out, name + '.webp')) // 1024, 'KB')
            break
    else:
        print(name, '없음')
