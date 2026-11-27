"""synk.im 광고(/studio/ · /en/studio/) 하늘 판 짓기 — 2026-11-27.

  python -X utf8 짓기.py <후보 폴더> <공개본 사본 폴더> <그림 폴더>

<공개본 사본 폴더>에는 공개본의 studio/index.html과 en/studio/index.html이 있어야 한다.
두 쪽의 머리(메타 · 글꼴 · 방문 집계) · 메뉴 · 바닥은 그대로 두고 <article>만 이 폴더의 본문으로 바꾼다.
겉은 하늘 판(유호님 11-27 「하늘로 가기」)이다. 앞 시안(노랑 · 솔리오)은 11-27 밤에 짓는 길을 걷었다.
작품은 도담중공업과 「다리가 기억하는 것」 둘이다(유호님 11-27 「예시프로젝트는 다리가 기억하는것, 도담중공업 이것만 남겨줘」).
앱 단락은 최신 PULSE 고객 앱 화면 여섯 장(입장 · 의뢰서 세 막 · 방 둘)을 젤리 탭으로 넘긴다(같은 날 「pulse 앱 프론트가 다 예전버전이야」).
쪽 전용 파일: /assets/v11/pulse-y.css(바탕 짜임) · pulse-s.css(하늘 겉) · pulse-y.js · pulse-y-serif.woff2 · pulse-y-sans.woff2 · 그림.
SYNK Sans v11은 줄인 글꼴이라 빠진 글자는 SUIT에서 덧 글꼴로 뽑고, 그래도 없으면 멈춘다(그림 폴더에 공개본 synk-sans-v11.woff2를 둔다).
"""
import html
import os
import re
import shutil
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

sys.stdout.reconfigure(encoding='utf-8')
OUT, LIVE, IMG = sys.argv[1:4]
DAY = '20261127'
TOUR = ('entry', 'pick', 'files', 'date', 'model', 'scenes')
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
FONTS = os.path.join(REPO, 'docs/마케팅/온라인마케팅지도/engagement/company/public/pulse-app/assets')
V11 = os.path.join(OUT, 'assets', 'v11')


def rd(p):
    with open(p, encoding='utf-8', newline='') as f:
        return f.read()


def once(s, a, b, name):
    n = s.count(a)
    assert n == 1, f'{name}: {n}번'
    return s.replace(a, b)


META = {
    'ko': ('광고 — 브랜드를 드라마로 만드는 광고 · SYNK', '이야기가 끝나면 제품 이름이 남습니다. 한국 엔터테인먼트 산업 현장에서 10년 일한 사람이 AI 모델을 연출합니다.'),
    'en': ('Ads — Turning brands into drama · SYNK', 'When the story ends, the product name stays. Someone with ten years in Korea’s entertainment industry directs the AI models.'),
}


def build(lang):
    page = rd(os.path.join(LIVE, 'studio' if lang == 'ko' else 'en/studio', 'index.html'))
    body = rd(os.path.join(HERE, f'본문_{lang}.html'))
    # 하늘 판은 솔리오 구를 두지 않는다
    body = re.sub(r'\n    <div class="y-orb".*?</div>', '', body, count=1, flags=re.S)
    title, desc = META[lang]
    page = re.sub(r'<title>[^<]*</title>', f'<title>{title}</title>', page, count=1)
    for pat, val in ((r'(<meta name="description" content=")[^"]*(")', desc), (r'(<meta property="og:title" content=")[^"]*(")', title), (r'(<meta property="og:description" content=")[^"]*(")', desc)):
        page = re.sub(pat, lambda m: m.group(1) + val + m.group(2), page, count=1)
    a = page.index('<article id="ad"')
    b = page.index('</article>', a) + len('</article>')
    page = page[:a] + body.strip() + page[b:]
    page = once(page, '<body data-tone="light">', '<body class="y s" data-tone="light">', 'body')
    # 바닥의 방문 집계 한 줄은 뺀다(유호님 11-27 밤 「이 내용도 삭제해」). 집계 스크립트와 개인정보처리방침 설명은 그대로다
    page, n = re.subn(r'<span class="foot-note">[^<]*<a href="/privacy/#visitor-stats(?:-en)?">[^<]*</a></span>', '', page)
    assert n == 1, f'foot-note {n}번'
    css = re.search(r'<link rel="stylesheet" href="/assets/v11/detail\.css\?v=[0-9a-f]+">', page).group(0)
    page = once(page, css, css + '\n<link rel="stylesheet" href="/assets/v11/pulse-y.css?v=000000000000">'
                + '\n<link rel="stylesheet" href="/assets/v11/pulse-s.css?v=000000000000">', 'css')
    # 공개본의 쪽 스크립트(여러 상세 쪽 공용)는 이 쪽의 부품이 없어 걷고, 이 쪽 스크립트를 둔다
    s0 = page.index('<script>(() => {', page.index('</footer>'))
    s1 = page.index('</script>', s0) + len('</script>')
    page = page[:s0] + '<script src="/assets/v11/pulse-y.js?v=000000000000" defer></script>' + page[s1:]
    out = os.path.join(OUT, 'studio' if lang == 'ko' else 'en/studio', 'index.html')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'w', encoding='utf-8', newline='') as f:
        f.write(page)
    return html.unescape(re.sub(r'<[^>]+>', ' ', re.sub(r'<script.*?</script>|<style.*?</style>', ' ', page[page.index('<body'):], flags=re.S)))


os.makedirs(V11, exist_ok=True)
text = build('ko') + build('en')
for src, dst in (('광고.css', 'pulse-y.css'), ('광고.js', 'pulse-y.js'), ('광고_하늘.css', 'pulse-s.css')):
    shutil.copyfile(os.path.join(HERE, src), os.path.join(V11, dst))
for n in ('pulse-sky.webp', 'pulse-night.webp', 'pulse-card-dodam-y.webp', 'pulse-card-bridge-y.webp'):
    shutil.copyfile(os.path.join(IMG, n), os.path.join(V11, n))
# 앱 화면은 날짜를 붙여 둔다(바뀌면 이름이 바뀌어 옛 그림이 캐시에 남지 않는다)
for k in TOUR:
    for m in ('', '-m'):
        shutil.copyfile(os.path.join(IMG, f'pulse-tour-{k}{m}.webp'), os.path.join(V11, f'pulse-tour-{k}{m}-{DAY}.webp'))

# 글자: 화면 글(두 쪽)과 스크립트 속 작품 글(주석 밖의 따옴표 글)
js = re.sub(r'/\*.*?\*/|//[^\n]*', ' ', rd(os.path.join(HERE, '광고.js')), flags=re.S)
text += ' '.join(re.findall(r"'([^'\n]*)'", js))
sans = TTFont(os.path.join(IMG, 'synk-sans-v11.woff2')).getBestCmap()
miss = sorted({c for c in text if ord(c) > 0x7E and ord(c) not in sans and not c.isspace()})
print('SYNK Sans v11에 없는 글자:', ''.join(miss) or '없음')

# 빠진 글자만 SUIT에서 골라 덧 글꼴로 둔다(SUIT는 OFL · 예약 이름 「SUIT」라 이름 칸을 SYNK Sans Y로 바꾼다 — 새로짓기 글꼴줄이기.py와 같은 규칙)
suit = TTFont(os.path.join(FONTS, 'SUIT.woff2'))
keep = sorted(ord(c) for c in miss if ord(c) in suit.getBestCmap())
o2 = subset.Options(); o2.flavor = 'woff2'; o2.layout_features = ['*']; o2.name_IDs = ['*']; o2.name_languages = ['*']; o2.name_legacy = True; o2.notdef_outline = True; o2.hinting = False
s2 = subset.Subsetter(o2); s2.populate(unicodes=keep or [0x20]); s2.subset(suit)
for rec in suit['name'].names:
    if rec.nameID in {0, 7, 8, 9, 10, 11, 12, 13, 14}:
        continue
    t = rec.toUnicode()
    if 'SUIT' in t:
        rec.string = t.replace('SUIT Variable', 'SYNK Sans Y').replace('SUITVariable', 'SYNKSansY').replace('SUIT', 'SYNK Sans Y')
suit.flavor = 'woff2'
sans_out = os.path.join(V11, 'pulse-y-sans.woff2')
suit.save(sans_out)
left = [c for c in miss if ord(c) not in TTFont(sans_out).getBestCmap()]
print('덧 글꼴', os.path.getsize(sans_out), '바이트, 그래도 없는 글자:', ''.join(left) or '없음')

# 명조: 두 쪽의 모든 글자로 줄인다(작품 고르기 글이 스크립트에서 바뀌므로)
chars = ''.join(sorted(set(text) | set(' 0123456789PULSE.,!?「」·—')))
opt = subset.Options(); opt.flavor = 'woff2'; opt.layout_features = ['*']; opt.name_IDs = ['*']; opt.notdef_outline = True
font = TTFont(os.path.join(FONTS, 'NotoSerifKR-300.woff2'))
sub = subset.Subsetter(opt); sub.populate(text=chars); sub.subset(font)
out_font = os.path.join(V11, 'pulse-y-serif.woff2')
font.flavor = 'woff2'
font.save(out_font)
serif = TTFont(out_font).getBestCmap()
miss_s = sorted({c for c in chars if ord(c) > 0x2FF and ord(c) not in serif and not c.isspace()})
print('명조 줄인 판', os.path.getsize(out_font), '바이트, 빠진 글자:', ''.join(miss_s) or '없음')
assert not left, '새 글자가 SYNK Sans v11에도 SUIT에도 없다'
print('ok', OUT)
