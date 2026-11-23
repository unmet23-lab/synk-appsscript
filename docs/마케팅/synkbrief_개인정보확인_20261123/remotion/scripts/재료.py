# 재료 옮기기 — 2026-11-23 ChatGPT 실험 E06(임시 채팅 · 휴대폰 화면 크기 430×932 · 배율 2.5)에서 찍은 실제 화면을
# 잘라 영상용 사본 public/img(git 밖)과 기록용 JPEG 그림/(git 안)에 둔다.
#   python -I -X utf8 remotion/scripts/재료.py            (편 폴더에서)
# 원본 화면은 git 밖 ~/ego/synkbrief-privacy-20261123/runs/E06/(s_00~s_05.png · rec/f_*.jpg)에 받은 그대로 있다.
# 가림: 이름 · SNS 아이디 말고 답에 나온 다른 정보(학교 · 다녔던 곳)와, 이름이 같은 다른 사람으로 본 자료 목록은
# 이 단계에서 흐리게 지운다(결정 2026-11-23 「개인정보 편은 유호님 이름과 아이디로」). 영상과 그림/에는 가린 판만 들어간다.
import os
from PIL import Image, ImageFilter, ImageDraw

EP = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.expanduser('~/ego/synkbrief-privacy-20261123/runs/E06')
PUB = os.path.join(EP, 'remotion', 'public', 'img')
REC = os.path.join(EP, '그림')
os.makedirs(PUB, exist_ok=True)
os.makedirs(REC, exist_ok=True)


def blur(im, box, r=22):
    """box 안을 흐리게 하고 살짝 어둡게 — 글자 모양이 남지 않을 만큼."""
    reg = im.crop(box).filter(ImageFilter.GaussianBlur(r)).filter(ImageFilter.GaussianBlur(r))
    dark = Image.new('RGB', reg.size, (13, 13, 13))
    reg = Image.blend(reg, dark, 0.35)
    im.paste(reg, box[:2])
    return im


def load(name):
    return Image.open(os.path.join(SRC, name)).convert('RGB')


def save(im, name, rec=True):
    im.save(os.path.join(PUB, name + '.jpg'), quality=93)
    if rec:
        im.save(os.path.join(REC, name + '.jpg'), quality=85)
    print(name, im.size)


# 표의 둘째 줄(창업자 소개 쪽) 「외부에서 볼 수 있는 정보」 칸 — 다녔던 곳 · 학교가 적힌 칸
ROW2_S01 = (335, 778, 905, 940)
ROW2_REC = (300, 1928, 1062, 2072)  # 녹화 중에는 글이 겹쳐 그려져 칸 밖으로 번진다(rec3) — 판단 칸까지 넓게

# 1. 보낸 요청문 말풍선(s_00)
save(load('s_00.png').crop((330, 195, 1050, 1185)), 'bubble')
# 말풍선 끝 네 줄(「3. 지우고 싶을 때 …」 · 「이름이 같은 다른 사람으로 보이는 정보는 빼 줘.」)
save(load('s_00.png').crop((330, 880, 1050, 1190)), 'bubble_end')

# 2. 답이 써지는 녹화(rec f0~f5) — 화면 전체, 표 둘째 줄 칸은 가림
recs = sorted(f for f in os.listdir(os.path.join(SRC, 'rec')) if f.endswith('.jpg'))[:6]
for i, f in enumerate(recs):
    im = Image.open(os.path.join(SRC, 'rec', f)).convert('RGB')
    if i >= 3:
        blur(im, ROW2_REC)
    save(im, f'rec{i}', rec=(i in (0, 2)))  # 영상에 쓰는 장(rec0 · rec2)만 기록

# 3. 민감정보 발견 현황 카드(s_02 위) — 통째로, 그리고 줄마다 이름 · 판정 조각
s02 = load('s_02.png')
save(s02.crop((36, 146, 1040, 718)), 'badges')
ROWS = [(168, 252), (315, 399), (462, 546), (609, 693)]
import json
def trim(im, pad=10):
    # 카드 바탕색(왼쪽 위 화소)과 다른 화소의 가로 범위로 자른다 — 글자 · 판정 알약만 남긴다
    bg = im.getpixel((2, 2))
    px = im.load(); w, h = im.size
    xs = [x for x in range(w) for y in range(0, h, 2) if sum(abs(a - b) for a, b in zip(px[x, y], bg)) > 60]
    if not xs: return im
    return im.crop((max(0, min(xs) - pad), 0, min(w, max(xs) + pad), h))
sizes = {}
for k, (y0, y1) in enumerate(ROWS, 1):
    a = trim(s02.crop((66, y0, 760, y1))); save(a, f'badge_label{k}', rec=False); sizes[f'badge_label{k}'] = a.size
    b = trim(s02.crop((760, y0, 1020, y1)), pad=4); save(b, f'badge_mark{k}', rec=False); sizes[f'badge_mark{k}'] = b.size
json.dump(sizes, open(os.path.join(EP, 'remotion', 'src', 'badgeSizes.json'), 'w'), indent=1)

# 4. 위험도순 표(s_01) — 둘째 줄 정보 칸 가림
s01 = load('s_01.png')
blur(s01, ROW2_S01)
save(s01.crop((30, 380, 1050, 1640)), 'table')

# 5. 지우는 차례 문단과 창구 줄(s_02 아래 · s_03 위)
s03 = load('s_03.png')
save(s03.crop((30, 625, 1050, 905)), 'order')
save(s02.crop((30, 1240, 1050, 1440)), 'del_head')
save(s02.crop((30, 1440, 1050, 2010)), 'del_rows1')
save(s03.crop((30, 150, 1050, 580)), 'del_rows2')

# 6. 이름이 같은 다른 사람으로 본 자료(s_03) — 제목만 남기고 목록과 설명은 가림
ex = s03.crop((30, 960, 1050, 1900))
blur(ex, (20, 225, 1020, 940), r=26)
save(ex, 'excluded')
