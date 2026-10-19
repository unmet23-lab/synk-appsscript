"""LAB 유튜브 배너·페이스북 커버 원고(배너.html)를 짓는다 · 2026-10-19.

    python -I 바탕짓기.py      # 구운 몽글 사진 → bg_yt.png · bg_fb.png
    python -I 배너_짓기.py
    node ../../../../tools/SNS키트굽기.js 배너.html --sheet --out out

10-02 클로드판(../../프로필_클로드판_20261002/배너/LAB해외_짓기.py)과 같은 글 배치·안전 영역이다.
바뀐 것: 바탕이 GPT 이미지 2.5로 장면째 구운 몽글 사진 한 장이다(10-14 「정본 누끼를 얹지 않는다」).
까몽·마린 누끼와 흰 테두리 그림자는 뺐다. 제목 글은 10-02 문구를 쓰고, 고친 나라만 ../문안.json 「banners」로 덮는다.
"""
import html
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OLD = os.path.join(HERE, '..', '..', '프로필_클로드판_20261002', '계정별_문구_LAB해외.json')
NEW = os.path.join(HERE, '..', '문안.json')
OUT = os.path.join(HERE, '배너.html')
A = '../../../디자인'

FONT = {
    'ja': ("'LAB JP'", 84, 1.2),
    'zh-Hant': ("'LAB TC'", 84, 1.2),
    'my': ("'LAB MY'", 68, 1.6),
    'th': ("'LAB TH'", 80, 1.4),
    'km': ("'LAB TH'", 60, 1.55),
    'hi': ("'LAB IN'", 80, 1.35),
    'ne': ("'LAB IN'", 58, 1.4),
    'si': ("'LAB IN'", 74, 1.45),
}
LATIN = (None, 86, 1.08)
FB_SIZE = {'ne': 62, 'km': 58, 'si': 60}

# 유튜브 배너 순서(파일 이름 앞 번호). 키 → (나라 표시, 언어)
YT = [
    ('lab-us-youtube', 'en'), ('lab-au-youtube', 'en'), ('lab-nz-youtube', 'en'), ('lab-ca-youtube', 'en'),
    ('lab-ph-youtube', 'fil'), ('lab-py-youtube', 'es'), ('lab-mx-youtube', 'es'), ('lab-br-youtube', 'pt'),
    ('lab-tw-youtube', 'zh-Hant'), ('lab-th-youtube', 'th'), ('lab-id-youtube', 'id'), ('lab-my-youtube', 'ms'),
    ('lab-in-youtube', 'hi'), ('lab-kg-youtube', 'ky'), ('lab-lk-youtube', 'si'), ('lab-mm-youtube', 'my'),
    ('lab-jp-youtube', 'ja'), ('lab-vn-youtube', 'vi'), ('lab-youtube-en', 'en'), ('lab-mn', 'mn'),
]
FB = [('lab-np-facebook', 'ne'), ('lab-kh-facebook', 'km'), ('lab-lk-facebook', 'si'), ('lab-mn', 'mn')]

HEAD = f"""<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>SYNK LAB 배너·커버 · 2026-10-19</title>
<!-- 배너_짓기.py가 지은 파일이다. 고칠 때는 ../문안.json·짓기 스크립트를 고친다. -->
<link rel="stylesheet" href="{A}/SNS키트/kit.css">
<style>
  @font-face{{font-family:'LAB JP';font-weight:700 900;src:local('Noto Sans JP Bold'),local('NotoSansJP-Bold'),local('Yu Gothic Bold'),local('YuGothic-Bold')}}
  @font-face{{font-family:'LAB TC';font-weight:700 900;src:local('Microsoft JhengHei UI Bold'),local('Microsoft JhengHei Bold'),local('MicrosoftJhengHeiUIBold'),local('MicrosoftJhengHeiBold')}}
  @font-face{{font-family:'LAB MY';font-weight:700 900;src:local('Myanmar Text Bold'),local('MyanmarText-Bold')}}
  @font-face{{font-family:'LAB TH';font-weight:700 900;src:local('Leelawadee UI Bold'),local('LeelawadeeUI-Bold')}}
  @font-face{{font-family:'LAB IN';font-weight:700 900;src:local('Nirmala UI Bold'),local('NirmalaUI-Bold')}}
  body{{margin:0;background:#d9dbe0;display:flex;flex-direction:column;gap:40px;padding:40px;align-items:flex-start}}
  .k-slide{{font-family:var(--k-sans);color:#14110f}}
  .bg-yt{{background:url("bg_yt.png") center/100% 100% no-repeat,#f3ebdf}}
  .bg-fb{{background:url("bg_fb.png") center/100% 100% no-repeat,#f3ebdf}}
  .abs{{position:absolute}}
  .label{{margin:0;font:600 var(--ls,30px)/1.1 var(--k-mono);letter-spacing:.08em;color:#ae322a}}
  .title{{margin:0;font-weight:900;letter-spacing:-.03em}}
  .title .ln{{display:block;white-space:nowrap}}
  .title.script{{letter-spacing:0}}
  .sub{{margin:0;font-weight:600;line-height:1.25;letter-spacing:-.02em;opacity:.88}}
  .hl-ink{{background:linear-gradient(transparent 62%,rgba(255,224,122,.95) 62% 92%,transparent 92%)}}
  /* Myanmar Text는 글꼴 아래 여백이 커서 62~92% 띠가 글자 밑에 뜬다(10-19 Fable 검수) */
  [lang="my"] .hl-ink{{background:linear-gradient(transparent 40%,rgba(255,224,122,.95) 40% 66%,transparent 66%)}}
</style>
<script>
  // 제목 한 줄이 칸보다 길면 넘치지 않을 때까지 글자를 줄인다(줄바꿈으로 세 줄이 되지 않게)
  document.fonts.ready.then(() => document.querySelectorAll('.fit').forEach((el) => {{
    let fs = parseFloat(getComputedStyle(el).fontSize);
    const over = () => [...el.querySelectorAll('.ln')].some((l) => l.scrollWidth > el.clientWidth + 1);
    while (over() && fs > 40) {{ fs -= 2; el.style.fontSize = fs + 'px'; }}
  }}));
</script>
</head>
<body>
"""


def title_html(lines, hl):
    out, done = [], False
    for ln in lines:
        s, h = html.escape(ln), html.escape(hl or '')
        if h and not done and h in s:
            s = s.replace(h, f'<span class="hl-ink">{h}</span>', 1)
            done = True
        out.append(f'<span class="ln">{s}</span>')
    return ''.join(out)


def font_style(locale, scale=1.0):
    fam, size, lh = FONT.get(locale, LATIN)
    cls = 'title fit' + (' script' if fam else ' k-latin')
    style = f'font-size:{round(size * scale)}px;line-height:{lh}'
    if fam:
        style += f';font-family:{fam},var(--k-sans)'
    return cls, style


def youtube(key, locale, b, korean, n):
    cls, style = font_style(locale)
    return f"""
<!-- {key} · 2560×1440 · 가운데 1546×423(x507~2053, y508~931)이 모든 기기에서 보인다. 몽글은 바탕 사진 안(x1645~1956, y570~870) -->
<section class="k-slide bg-yt" lang="{locale}" data-fmt="yt-banner" data-name="{key}" data-acc="lab"
  style="--w:2560px;--h:1440px;--safe-t:508px;--safe-b:508px;--safe-l:507px;--safe-r:507px">
  <div class="abs" style="left:560px;top:528px;width:1040px">
    <p class="label" style="--ls:44px">{html.escape(b['label'])}</p>
    <h1 class="{cls}" style="margin-top:12px;{style}">{title_html(b['title'], b.get('hl'))}</h1>
    <p class="sub" lang="ko" style="margin-top:16px;font-size:46px">{html.escape(korean)}</p>
  </div>
</section>
"""


def facebook(key, locale, b, korean, n):
    base = FONT.get(locale, LATIN)[1]
    cls, style = font_style(locale, scale=FB_SIZE.get(locale, 64) / base)
    return f"""
<!-- {key} · 페이스북 1640×596 · 휴대폰은 좌우를 잘라 가운데 1061px만 보인다. 몽글은 바탕 사진 안(x1101~1318) -->
<section class="k-slide bg-fb" lang="{locale}" data-fmt="fb-cover" data-name="{key}" data-acc="lab"
  style="--w:1640px;--h:596px;--safe-t:50px;--safe-b:50px;--safe-l:290px;--safe-r:290px">
  <div class="abs" style="left:340px;top:140px;width:720px">
    <p class="label" style="--ls:24px">{html.escape(b['label'])}</p>
    <h1 class="{cls}" style="margin-top:16px;{style}">{title_html(b['title'], b.get('hl'))}</h1>
    <p class="sub" lang="ko" style="margin-top:16px;font-size:30px">{html.escape(korean)}</p>
  </div>
</section>
"""


if __name__ == '__main__':
    old = json.load(open(OLD, encoding='utf-8'))
    new = json.load(open(NEW, encoding='utf-8'))['banners']
    korean = new.get('_korean', old['korean']['slogan'])
    banners = {a['id']: a['banner'] for a in old['accounts'] if a.get('banner')}
    for k, v in new.items():
        if not k.startswith('_'):
            banners[k] = {**banners.get(k, {}), **v}
    parts, n = [HEAD], 0
    for key, loc in YT:
        n += 1
        b = banners[key]
        parts.append(youtube(key, loc, b, b.get('korean', korean), n))
    for key, loc in FB:
        n += 1
        b = dict(banners[key])
        b['label'] = b['label']
        parts.append(facebook(key, loc, b, b.get('korean', korean), n))
    parts.append('\n</body>\n</html>\n')
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write(''.join(parts))
    print(OUT, n, '장')
