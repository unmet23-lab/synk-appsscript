#!/usr/bin/env python3
"""게시판 해독 — 구운 사진(공용 작업본 .tmp/board-decode-20261104, git 밖)을 게임에 쓰는 WebP로 바꾼다.

    python -I experiences/board-decode/qa/웹판.py <worktree 뿌리> <공용 작업본 뿌리>

이름마다 가장 나중에 구운 판을 쓴다. 게시판 배경은 폭 1100(넓은 화면), 장면은 폭 780. 카드는 폭 640.
"""
import glob
import os
import sys

from PIL import Image

root, shared = sys.argv[1], sys.argv[2]
game = os.path.join(root, 'experiences', 'board-decode', 'assets', 'photo')
card = os.path.join(root, 'experiences', 'brand-opening', 'assets', 'world-play', 'board-decode.webp')
src = os.path.join(shared, '.tmp', 'board-decode-20261104')
os.makedirs(game, exist_ok=True)


def latest(name):
    hits = sorted(glob.glob(os.path.join(src, 'mvp', '판', name + '_*.png')) + glob.glob(os.path.join(src, 'sian', '판', name + '_*.png')), key=os.path.getmtime)
    return hits[-1] if hits else None


def bake(name, out, width, quality):
    path = latest(name)
    if not path:
        print('없음', name)
        return
    im = Image.open(path).convert('RGB')
    im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(out, 'WEBP', quality=quality, method=6)
    print(os.path.basename(out), im.size, os.path.getsize(out) // 1024, 'KB')


BOARDS = {'board-bg': 'board-dorm', 'board-festival': 'board-festival', 'board-dept': 'board-dept'}
SCENES = ['scene-tape', 'scene-drum', 'scene-office', 'scene-towel', 'scene-trash', 'scene-new', 'scene-busy', 'scene-pot', 'scene-rope', 'scene-council', 'scene-rain', 'scene-concert', 'scene-wait', 'scene-win2', 'scene-winter', 'scene-gown', 'scene-laptop', 'scene-winter-win']
for name, out in BOARDS.items():
    bake(name, os.path.join(game, out + '.webp'), 1100, 70)
for name in SCENES:
    bake(name, os.path.join(game, name + '.webp'), 780, 72)
bake('card-board', card, 640, 82)
