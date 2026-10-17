# check.mjs --shots 캡처를 PC 앱 화면과 나란히 놓은 비교 사진으로 묶는다.
# 사용: python -X utf8 compose.py <캡처 폴더> docs/디자인/플랫폼_시그널/화면  (qa 아래 그림은 저장소 규칙상 커밋하지 않는다)
import sys, os
from PIL import Image, ImageDraw, ImageFont

shots, out = sys.argv[1], sys.argv[2]
root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../..'))
pc = os.path.join(root, 'docs/디자인/플랫폼_시그널/화면/회원혜택포스터-전후.jpg')
font = ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf', 26)
small = ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf', 20)
BG = (12, 13, 16)

def shot(name, scale):
    im = Image.open(os.path.join(shots, name)).convert('RGB')
    return im, scale

def crop_css(name, scale, box, width=None):
    im, s = shot(name, scale)
    part = im.crop(tuple(round(v * s) for v in box))
    if width: part = part.resize((width, round(part.height * width / part.width)), Image.LANCZOS)
    return part

def board(cells, cols, gap=16, title_h=44, labels=None, pad=20):
    w = max(c.width for c in cells); h = max(c.height for c in cells); rows = (len(cells) + cols - 1) // cols
    sheet = Image.new('RGB', (pad * 2 + cols * w + (cols - 1) * gap, pad * 2 + rows * (h + title_h) + (rows - 1) * gap), BG)
    d = ImageDraw.Draw(sheet)
    for i, c in enumerate(cells):
        x = pad + (i % cols) * (w + gap); y = pad + (i // cols) * (h + title_h + gap)
        if labels: d.text((x, y + 6), labels[i], font=small, fill=(250, 250, 249))
        sheet.paste(c, (x, y + title_h))
    return sheet

# 1) PC 앱(10-17 이후 절반)과 웹 1440 밤 개요를 같은 폭으로 나란히
pc_im = Image.open(pc).convert('RGB'); half = pc_im.crop((pc_im.width // 2, 0, pc_im.width, pc_im.height))
web_w = 1404 - 244; web = crop_css('night-1440-benefits.png', 2, (244, 96, 1404, 96 + web_w * half.height / half.width), half.width)
side = board([half, web], 2, labels=['PC 앱 · 10-17(부모 세션 캡처)', '웹 플랫폼 · 10-17 · 1440 밤'])
side.save(os.path.join(out, '웹회원혜택-PC나란히.jpg'), quality=84, optimize=True)

# 2) 소개 머리 여섯(1440 밤) — PC 「소개머리」 사진과 같은 배열
details = ['insight', 'subscriptions', 'care', 'fortune', 'rehearsal', 'family-album']
heads = [crop_css(f'night-1440-benefits_{d}.png', 2, (244, 84, 1404, 640), 700) for d in details]
board(heads, 2, labels=[f'1440 밤 · #benefits/{d}' for d in details]).save(os.path.join(out, '웹회원혜택-소개머리.jpg'), quality=84, optimize=True)

# 3) 밤·낮 개요(1440) 위쪽
tops = [crop_css(f'{t}-1440-benefits.png', 2, (0, 0, 1440, 1700), 700) for t in ('night', 'day')]
board(tops, 2, labels=['1440 밤 · 회원 혜택', '1440 낮 · 회원 혜택']).save(os.path.join(out, '웹회원혜택-밤낮.jpg'), quality=84, optimize=True)

# 4) 휴대폰 390: 밤·낮 개요(첫머리 + 카드 두 장)와 소개 머리 넷
phone = [crop_css(f'{t}-390-benefits.png', 3, (0, 0, 390, 1500), 360) for t in ('night', 'day')]
phone += [crop_css(f'night-390-benefits_{d}.png', 3, (0, 0, 390, 844), 360) for d in ('insight', 'subscriptions', 'care', 'family-album')]
phone_labels = ['390 밤 · 개요', '390 낮 · 개요', '390 밤 · 성향', '390 밤 · 구독', '390 밤 · 플레저', '390 밤 · 앨범']
board(phone, 6, labels=phone_labels).save(os.path.join(out, '웹회원혜택-휴대폰.jpg'), quality=84, optimize=True)

# 5) 혜택을 담았을 때: 홈 바로가기(최근·즐겨찾기)와 내 라이브러리 카드(1440 밤, check.mjs의 「담음」 판)
saved = [crop_css('night-saved-1440-home.png', 2, (244, 480, 1404, 1700), 700), crop_css('night-saved-1440-library.png', 2, (244, 84, 1404, 900), 700)]
board(saved, 2, labels=['1440 밤 · 홈(혜택 넷을 최근·즐겨찾기에 담음)', '1440 밤 · 내 라이브러리']).save(os.path.join(out, '웹회원혜택-담음.jpg'), quality=84, optimize=True)
print('ok')
