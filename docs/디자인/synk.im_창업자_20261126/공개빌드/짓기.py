"""synk.im 창업자 쪽(/founder/ · /en/founder/)을 시안 첫 판으로 짓는다 — 2026-11-27.

  python -X utf8 짓기.py <출력 폴더> <공개본 사본 폴더>

<공개본 사본 폴더>에는 지금 공개본의 다음 파일이 있어야 한다.
  ai/index.html · en/ai/index.html  — 다른 상세 쪽(v11)의 메뉴 · 바닥 · 방문 집계 줄을 여기서 옮긴다
  assets/yuho-founder-20260919.png  — 사원증의 대표 사진(잘라 줄인다)
  assets/v11/synk-sans-v11.woff2    — 다른 쪽과 함께 쓰는 SUIT 줄인 판(본문 글꼴). 쪽 글자가 모두 들었는지 본다
출력: founder/index.html · en/founder/index.html · assets/founder-v1/…
공유 그림은 og.mjs로 찍어 이 폴더 og/에 두고, 짓기를 한 번 더 돌리면 싣는다(없으면 og 줄 없이 짓는다).
"""
import hashlib
import html
import os
import re
import shutil
import sys

from fontTools import subset
from fontTools.ttLib import TTFont
from PIL import Image

sys.stdout.reconfigure(encoding='utf-8')
OUT, LIVE = sys.argv[1:3]
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
PULSE_FONTS = os.path.join(REPO, 'docs/마케팅/온라인마케팅지도/engagement/company/public/pulse-app/assets')
BRAND = os.path.join(REPO, 'docs/브랜드_폰트')
A = os.path.join(OUT, 'assets', 'founder-v1')
WEB = '/assets/founder-v1/'
os.makedirs(os.path.join(A, 'og'), exist_ok=True)


def rd(p):
    with open(p, encoding='utf-8', newline='') as f:
        return f.read()


def wr(p, s):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w', encoding='utf-8', newline='\n') as f:
        f.write(s)


def sha(p):
    with open(p, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()[:12]


def url(name):
    return f'{WEB}{name}?v={sha(os.path.join(A, name))}'


def one(s, pat):
    m = re.findall(pat, s, re.S)
    assert len(m) == 1, (pat, len(m))
    return m[0]


# ── 그림: 시안이 보이는 자리만 잘라 줄인다 ─────────────────────────────
def webp(img, name, q=80):
    img.save(os.path.join(A, name), 'WEBP', quality=q, method=6)


photo = Image.open(os.path.join(LIVE, 'assets/yuho-founder-20260919.png')).convert('RGB')
w, h = photo.size  # 800×800. 사원증 칸(104×128, cover)은 가운데 650×800을 보인다
cw = round(h * 104 / 128)
webp(photo.crop(((w - cw) // 2, 0, (w - cw) // 2 + cw, h)).resize((312, 384), Image.LANCZOS), 'face.webp', 82)
orb = Image.open(os.path.join(REPO, 'docs/디자인/PULSE고객앱_다시짓기_20261124/그림/솔리오_hello_노랑.webp')).convert('RGB')
s = orb.size[0]  # 시안: 칸 250, 그림 cover, scale(1.55) · 원점 28% 62% → 보이는 곳은 x .0994~.7445, y .22~.8652
x0, y0 = .28 - .28 / 1.55, .62 - .62 / 1.55
webp(orb.crop((round(x0 * s), round(y0 * s), round((x0 + 1 / 1.55) * s), round((y0 + 1 / 1.55) * s))).resize((500, 500), Image.LANCZOS), 'orb.webp', 84)
webp(Image.open(os.path.join(REPO, 'docs/디자인/PULSE고객앱_다시짓기_20261124/assets/cut-05.webp')).convert('RGB'), 'card-pulse.webp', 80)
for src, dst in (('cover-lab-gyeseyo.jpg', 'card-lab-1.webp'), ('cover-lab-deopda.jpg', 'card-lab-2.webp')):
    im = Image.open(os.path.join(REPO, 'docs/디자인/워크스페이스_다시짓기_20261124/시안/img', src)).convert('RGB')
    webp(im.resize((600, round(im.height * 600 / im.width)), Image.LANCZOS), dst, 78)

# ── 쪽 글 ─────────────────────────────────────────────────────────────
js = rd(os.path.join(HERE, 'founder.js'))
js_text = ' '.join(re.findall(r"'([^'\n]*)'", re.sub(r'/\*.*?\*/|^\s*//[^\n]*', ' ', js, flags=re.S | re.M)))
js_text += ' '.join(re.findall(r'`([^`]*)`', js))
BODY = {k: rd(os.path.join(HERE, f'본문_{k}.html')) for k in ('ko', 'en')}
META = {
    'ko': dict(
        title='창업자 · SYNK가 일하는 방식 — SYNK',
        desc='SYNK는 콘텐츠 제작과 게시, 검수, 백업, 고장 고치기까지 AI 시스템이 맡는 회사입니다. 창업자 양유호가 설계한 SYNK의 하루와 직원 앱을 소개합니다.',
        og='노란 바탕에 걸린 목걸이 사원증(양유호 · 창업자 · 시스템 설계)과 제목 「사업의 모든 일을 기술로 바꿉니다」 — SYNK 창업자 쪽 첫 화면',
        url='https://synk.im/founder/', other='/en/founder/', other_lang='en', other_label='EN'),
    'en': dict(
        title='Founder · How SYNK works — SYNK',
        desc='At SYNK, AI systems handle content production and posting, reviews, backups and fixes. See a day at SYNK and the staff app built by founder Yuho Yang.',
        og='A staff ID badge on a lanyard (Yuho Yang · Founder · Systems design) on a yellow background, with the headline “Rebuilding every job with technology” — the first screen of the SYNK founder page',
        url='https://synk.im/en/founder/', other='/founder/', other_lang='ko', other_label='KR'),
}


def text_of(s):
    return html.unescape(re.sub(r'<[^>]+>', ' ', re.sub(r'<script.*?</script>|<style.*?</style>', ' ', s, flags=re.S)))


# 다른 상세 쪽(v11)의 메뉴 · 바닥 · 방문 집계 줄
FRAME = {}
for k, p in (('ko', 'ai/index.html'), ('en', 'en/ai/index.html')):
    pg = rd(os.path.join(LIVE, p))
    nav = one(pg, r'(<nav class="nav".*?</nav>)')
    nav = re.sub(r'<a class="lang" href="[^"]*" hreflang="[a-z]+">', f'<a class="lang" href="{META[k]["other"]}" hreflang="{META[k]["other_lang"]}">', nav, count=1)
    assert nav.count('data-g="co"') == 1
    nav = nav.replace('data-g="co" ', 'data-g="co" aria-current="true" ', 1)
    foot = one(pg, r'(<footer class="foot">.*?</footer>)')
    me = META[k]['url'].replace('https://synk.im', '')
    assert foot.count(f'<a href="{me}">') == 1, foot
    foot = foot.replace(f'<a href="{me}">', f'<a href="{me}" aria-current="page">', 1)
    scripts = re.findall(r'<script type="module" src="(?:/assets/v10/visit-count\.js|/social-conversion\.js)\?v=[0-9a-f]+"></script>', pg)
    assert len(scripts) == 2, scripts
    sans_face = one(pg, r"(<style>@font-face\{font-family:'SYNK Sans';src:url\(/assets/v11/synk-sans-v11\.woff2\)[^<]*</style>)")
    FRAME[k] = dict(nav=nav, foot=foot, scripts='\n'.join(scripts), sans_face=sans_face)

page_text = {k: text_of(BODY[k] + FRAME[k]['nav'] + FRAME[k]['foot']) + META[k]['title'] + META[k]['desc'] for k in BODY}
all_text = page_text['ko'] + page_text['en'] + js_text


# ── 글꼴 ──────────────────────────────────────────────────────────────
def subset_font(src, chars, out, rename=None, keep_names=False):
    font = TTFont(src, recalcTimestamp=False)
    cmap = font.getBestCmap()
    keep = sorted({ord(c) for c in chars} & set(cmap))
    o = subset.Options()
    o.flavor = 'woff2'
    o.layout_features = ['*']
    o.name_IDs = ['*']
    o.name_languages = ['*']
    o.name_legacy = True
    o.notdef_outline = True
    o.hinting = False
    sub = subset.Subsetter(o)
    sub.populate(unicodes=keep or [0x20])
    sub.subset(font)
    if rename:
        a, b = rename
        for rec in font['name'].names:
            if rec.nameID in {0, 7, 8, 9, 10, 11, 12, 13, 14}:
                continue
            t = rec.toUnicode()
            if a in t:
                rec.string = t.replace(a + ' Variable', b).replace(a.replace(' ', '') + 'Variable', b.replace(' ', '')).replace(a, b)
    font.flavor = 'woff2'
    font.save(out)
    return TTFont(out).getBestCmap()


v11 = TTFont(os.path.join(LIVE, 'assets/v11/synk-sans-v11.woff2')).getBestCmap()
suit = TTFont(os.path.join(BRAND, 'SUIT/SUIT-Variable.woff2')).getBestCmap()
miss = sorted({c for c in all_text if ord(c) > 0x7E and not c.isspace() and ord(c) not in v11})
print(f'SYNK Sans v11에 없는 글자: {"".join(miss) or "없음"} (SUIT에도 없어 기기 글꼴로 보인다)')
# 본문 글꼴은 다른 쪽과 함께 쓰는 SYNK Sans v11 하나다. SUIT에는 있는데 v11에 없는 글자가 생기면 덧 글꼴을 다시 둔다
assert not [c for c in miss if ord(c) in suit], ('SUIT에 있는데 SYNK Sans v11에 없는 글자', [c for c in miss if ord(c) in suit])
ko_serif = subset_font(os.path.join(PULSE_FONTS, 'NotoSerifKR-300.woff2'), page_text['ko'] + js_text + '0123456789:.,·「」!?~ ', os.path.join(A, 'serif-ko.woff2'))
ms = sorted({c for c in page_text['ko'] + js_text if '가' <= c <= '힣' and ord(c) not in ko_serif})
print(f'명조(한) {os.path.getsize(os.path.join(A, "serif-ko.woff2"))}바이트, 빠진 한글: {"".join(ms) or "없음"}')
assert not ms
en_serif = subset_font(os.path.join(BRAND, 'NotoSerifDisplay/NotoSerifDisplay-Light-latin.woff2'), page_text['en'] + js_text + ''.join(chr(c) for c in range(0x20, 0x7F)) + '“”‘’–—…·', os.path.join(A, 'serif-latin.woff2'))
print(f'명조(영) {os.path.getsize(os.path.join(A, "serif-latin.woff2"))}바이트')
num = subset_font(os.path.join(PULSE_FONTS, 'InterTight.woff2'), all_text + ''.join(chr(c) for c in range(0x20, 0x7F)), os.path.join(A, 'num.woff2'))
print(f'숫자 {os.path.getsize(os.path.join(A, "num.woff2"))}바이트')
shutil.copyfile(os.path.join(HERE, 'OFL.txt'), os.path.join(A, 'OFL.txt'))

# ── 스타일 · 스크립트 ─────────────────────────────────────────────────
css = rd(os.path.join(HERE, 'founder.css'))
for n in ('serif-ko.woff2', 'serif-latin.woff2', 'num.woff2'):
    a = f'url({WEB}{n})'
    assert css.count(a) == 1, a
    css = css.replace(a, f'url({url(n)})')
css = re.sub(r'/\*.*?\*/\n?', '', css, flags=re.S)
wr(os.path.join(A, 'founder.css'), css)
wr(os.path.join(A, 'founder.js'), re.sub(r'^\s*//[^\n]*\n', '', js, flags=re.M))
CSS, JS = url('founder.css'), url('founder.js')


def build(k):
    m, f = META[k], FRAME[k]
    body = BODY[k].replace('@@face@@', url('face.webp')).replace('@@orb@@', url('orb.webp'))
    assert '@@' not in body
    og_src = os.path.join(HERE, 'og', f'founder-{k}.jpg')
    og = ''
    if os.path.exists(og_src):
        shutil.copyfile(og_src, os.path.join(A, 'og', f'founder-{k}.jpg'))
        og = (f'\n<meta property="og:image" content="https://synk.im{url("og/founder-" + k + ".jpg")}"><meta property="og:image:width" content="1200">'
              f'<meta property="og:image:height" content="630"><meta property="og:image:alt" content="{html.escape(m["og"])}"><meta name="twitter:card" content="summary_large_image">')
    alt = ''.join(f'<link rel="alternate" hreflang="{l}" href="https://synk.im{p}">' for l, p in (('ko', '/founder/'), ('en', '/en/founder/'), ('x-default', '/founder/')))
    serif = 'serif-ko.woff2' if k == 'ko' else 'serif-latin.woff2'
    page = f'''<!doctype html>
<html lang="{k}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#FED027">
<title>{html.escape(m["title"])}</title>
<meta name="description" content="{html.escape(m["desc"])}">
<link rel="canonical" href="{m["url"]}">
{alt}
<meta property="og:type" content="website"><meta property="og:url" content="{m["url"]}"><meta property="og:title" content="{html.escape(m["title"])}"><meta property="og:description" content="{html.escape(m["desc"])}">{og}
<link rel="icon" type="image/png" sizes="16x16" href="/assets/favicon-synk-20260919-16.png"><link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-synk-20260919-32.png"><link rel="icon" type="image/png" sizes="48x48" href="/assets/favicon-synk-20260919-48.png">
<link rel="preload" href="/assets/v11/synk-sans-v11.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="{url(serif)}" as="font" type="font/woff2" crossorigin>
{f["sans_face"]}
{f["scripts"]}
<link rel="stylesheet" href="{CSS}">
</head>
<body data-tone="light">
{f["nav"]}
{body.strip()}
{f["foot"]}
<script src="{JS}" defer></script>
</body>
</html>
'''
    out = os.path.join(OUT, 'founder' if k == 'ko' else 'en/founder', 'index.html')
    wr(out, page)
    return page


for k in ('ko', 'en'):
    p = build(k)
    for bad in ('시안', 'localhost', 'noindex', '../', 'docs/', '@@'):
        assert bad not in p, (k, bad)
print('ok', OUT)
for root, _, files in os.walk(A):
    for n in sorted(files):
        print(f'  {os.path.relpath(os.path.join(root, n), OUT)}  {os.path.getsize(os.path.join(root, n))}')
