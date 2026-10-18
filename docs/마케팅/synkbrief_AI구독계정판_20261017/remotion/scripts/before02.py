# 02 「전」 장면의 실제 claude.ai 캡처를 영상용으로 자른다(원본은 git 밖 .tmp/synkbrief-subs-20261017/cap-before/).
#   python -I scripts/before02.py
# - 계정 메뉴: 왼쪽 아래 이름 줄은 잘라 내고, 맨 위 메일 줄(「synk.yuh@···」)은 메뉴 바탕색으로 덮는다.
#   같은 영상의 04·07에 synk.yuh의 11:45 숫자가 나와서, 16:3x에 찍은 이 화면이 같은 계정으로 읽히지 않게(Fable 10-18 P2②).
# - 사용량 화면: 위에서 880px(제목·경고·막대 셋·제한 초기화)까지.
# 둘 다 카드(836×592)의 1.5배인 1254×888로 맞춘다.
import os
import sys
from PIL import Image, ImageDraw

here = os.path.dirname(os.path.abspath(__file__))
root = os.path.abspath(os.path.join(here, '..', '..', '..', '..', '..'))
src = os.path.join(root, '.tmp', 'synkbrief-subs-20261017', 'cap-before')
out = os.path.join(here, '..', 'public', 'before')
os.makedirs(out, exist_ok=True)
W, H = 1254, 888

menu = Image.open(os.path.join(src, 'claude-menu-logout-wide.png')).convert('RGB').crop((0, 82, 760, 620)).resize((W, H), Image.LANCZOS)
bg = menu.getpixel((400, 40))
ImageDraw.Draw(menu).rectangle((56, 22, 300, 70), fill=bg)
menu.save(os.path.join(out, 'claude-menu.png'))

usage = Image.open(os.path.join(src, 'claude-usage.png')).convert('RGB').crop((0, 0, 1243, 880)).resize((W, H), Image.LANCZOS)
usage.save(os.path.join(out, 'claude-usage.png'))
print('저장', out, '메뉴 바탕', bg, file=sys.stderr)
