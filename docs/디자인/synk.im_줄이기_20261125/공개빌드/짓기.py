"""synk.im 홈(한국어 · 영어)을 공개 꼴로 짓는다.

쓰임: python 짓기.py <공개본 폴더> <시안 폴더> <출력 폴더>
  공개본 폴더: index.html · en.html (지금 공개본. 질문창 · 소식 · PC 앱 받기 조각을 여기서 옮긴다)
  시안 폴더: a/town-port.webp · a/hall-front-port.webp · a/dodam-port.mp4 · a/dodam-port.webp · f/mono.woff2
  출력 폴더: index.html · en/index.html · assets/v12/…  (og 그림은 og.mjs가 뒤에 넣고 다시 짓는다)
"""
import hashlib, re, shutil, sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
LIVE, DRAFT, OUT = map(Path, sys.argv[1:4])
HERE = Path(__file__).parent
V = OUT / 'assets/v12'
(V / 'home').mkdir(parents=True, exist_ok=True)
(V / 'og').mkdir(exist_ok=True)
(OUT / 'en').mkdir(exist_ok=True)


def sha(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()[:12]


def put(src, rel):
    shutil.copyfile(src, V / rel)
    return f'/assets/v12/{rel}?v={sha(V / rel)}'


TOWN = put(DRAFT / 'a/town-port.webp', 'home/town.webp')
HALL = put(DRAFT / 'a/hall-front-port.webp', 'home/hall.webp')
FILM = put(DRAFT / 'a/dodam-port.mp4', 'home/drama.mp4')
POSTER = put(DRAFT / 'a/dodam-port.webp', 'home/drama.webp')
MONO = put(DRAFT / 'f/mono.woff2', 'dm-mono-500.woff2')
css = (HERE / 'home.css').read_text('utf8').replace('url(/assets/v12/dm-mono-500.woff2)', f'url({MONO})')
(V / 'home.css').write_text(css, 'utf8', newline='\n')
(V / 'home.js').write_text((HERE / 'home.js').read_text('utf8'), 'utf8', newline='\n')
CSS, JS = f'/assets/v12/home.css?v={sha(V / "home.css")}', f'/assets/v12/home.js?v={sha(V / "home.js")}'


def one(t, pat):
    m = re.findall(pat, t, re.S)
    assert len(m) == 1, (pat, len(m))
    return m[0]


L = {
    'ko': dict(
        src='index.html', url='https://synk.im/', base='', html='<html lang="ko">', home='SYNK 홈', langs='언어',
        lang='<b aria-current="true">한글</b><a href="/en/" hreflang="en" lang="en">ENG</a><a href="/mn/" hreflang="mn" lang="mn">MN</a>',
        title='SYNK — 한국 유학, AI 강의, 광고',
        desc='끝까지 책임지는 한국 유학, 실전 AI 활용 강의, 브랜드를 드라마로 만드는 광고. SYNK가 하는 세 가지 일입니다.',
        og='세 칸으로 나뉜 첫 화면. 「끝까지 책임지는 한국 유학」 마을, 「실전 AI 활용 강의」 강의장, 「브랜드를 드라마로 만드는 광고」 장면 — SYNK 홈페이지 첫 화면',
        h1='SYNK — 끝까지 책임지는 한국 유학, 실전 AI 활용 강의, 브랜드를 드라마로 만드는 광고',
        a=('끝까지 책임지는', '한국 유학'), b=('실전', 'AI 활용 강의'), c=('브랜드를 드라마로 만드는', '광고'),
        town='집, 교실, 대학 정문, 회사, 카페가 한 길로 이어진 마을', hall='강사가 청중을 보며 큰 화면을 가리키는 강의장. 화면 글은 「synk는 지금도 일합니다. 이렇게 30여 가지가 사람 없이 돕니다」',
        film='도담중공업 홍보영상의 장면', pins='한국 유학의 다섯 가지 일',
        pin=('한국어', '교실', '유학', '취업', '모임'),
        scr=('synk는 지금도 일합니다', '서울 지금', '이렇게 30여 가지가 사람 없이 돕니다'),
        quick='바로 가기', askgo='무엇이든 물어보세요', reserve='한국 유학 사전예약', solio='솔리오 받기', news='새 소식', me='내 홈',
        foot='바닥 메뉴', founder='회사', atlas='아틀라스', privacy='개인정보처리방침', terms='이용약관', delete='데이터 삭제',
        biz=('사업자등록번호를 알려주세요.', '사업자 정보'), close='닫기',
        pf=('한국어 연습과 솔리오를 계정 하나로 씁니다.', '혼자 일하는 사람의 AI 업무 앱 솔리오와 한국어 연습이 이 앱에 들어 있습니다.'),
        ask=('묻기', '무엇이든<br>물어보세요'), now=('소식', '최근에<br>새로 연 것'),
    ),
    'en': dict(
        src='en.html', url='https://synk.im/en/', base='/en', html='<html lang="en">', home='SYNK home', langs='Language',
        lang='<a href="/" hreflang="ko" lang="ko">한글</a><b aria-current="true">ENG</b><a href="/mn/" hreflang="mn" lang="mn">MN</a>',
        title='SYNK — Study in Korea, AI training, advertising',
        desc='Study in Korea with us all the way, hands-on AI training, and advertising that turns brands into drama. These are the three things SYNK does.',
        og='A first screen in three panels: a town for “Study in Korea”, a lecture hall for “AI training”, and a film scene for “Advertising” — the first screen of the SYNK homepage',
        h1='SYNK — With you all the way: study in Korea. Hands-on AI training. Advertising that turns brands into drama.',
        a=('With you all the way', 'Study in Korea'), b=('Hands-on', 'AI training'), c=('Turning brands into drama', 'Advertising'),
        town='A town where a home, a classroom, a university gate, an office and a café stand along one road', hall='A lecture hall where the speaker faces the audience and points to a large screen that reads “synk is working right now. 30-plus jobs run like this on their own”',
        film='A scene from a Dodam Heavy Industries film', pins='Five parts of studying in Korea',
        pin=('Korean', 'Class', 'University', 'Job', 'Community'),
        scr=('synk is working right now', 'Seoul time', '30-plus jobs run like this on their own'),
        quick='Quick links', askgo='Ask us anything', reserve='Study in Korea pre-registration', solio='Get SOLIO', news='What’s new', me='My home (Korean)',
        foot='Footer menu', founder='Company', atlas='Atlas', privacy='Privacy policy', terms='Terms', delete='Data deletion',
        biz=('What is your business registration number?', 'Business information'), close='Close',
        pf=('Korean practice and SOLIO on one account.', 'SOLIO, the AI work app for people who work alone, and Korean practice are both in this app.'),
        ask=('Ask', 'Ask us<br>anything'), now=('News', 'What’s<br>new'),
    ),
}
PINS = [(19.5, 59.4, 'korean'), (32.1, 44.7, 'classroom'), (63.5, 41.2, 'study-abroad'), (86, 51.4, 'job'), (75.6, 62.9, 'community')]
anchors = lambda ids: ''.join(f'<span id="{i}" class="anchor" aria-hidden="true"></span>' for i in ids.split())


def page(k):
    s = L[k]
    t = (LIVE / s['src']).read_text('utf8')
    u = s['base']
    head = t[:t.index('</head>')]
    verify = re.findall(r'<meta name="google-site-verification"[^>]*>', head)
    icons = one(head, r'<link rel="icon" type="image/png" sizes="16x16".*?sizes="48x48"[^>]*>')
    alt = one(head, r'<link rel="alternate" hreflang="ko".*?hreflang="x-default"[^>]*>')
    face = one(head, r"<style>@font-face\{font-family:'SYNK Sans'.*?</style>")
    count = one(head, r'<script type="module" src="/assets/v10/visit-count\.js\?v=[0-9a-f]+"></script>')
    social = one(head, r'<script type="module" src="/social-conversion\.js\?v=[0-9a-f]+"></script>')
    moved = one(head, r"<script>\(\(\)=>\{const a=document\.documentElement\.lang.*?</script>")
    # 열린 창 안은 home.js가 맨 위에 맞춘다. 주소 자리 맞추기가 창 안을 다시 끌어올리지 않게 한다
    assert moved.count('if(el)el.scrollIntoView') == 1
    moved = moved.replace('if(el)el.scrollIntoView', "if(el&&!el.closest('dialog'))el.scrollIntoView")
    site = one(head, r'<script type="module" src="/assets/v10/site\.js\?v=[0-9a-f]+"></script>')
    links = one(t, r'<div class="ask-links">.*?</div>')
    lead = one(t, r'<h2 id="ask-t">.*?</h2>\s*<p>(.*?)</p>')
    main = one(t, r'<div class="ask-main" id="questions".*?\n    </div>')
    news = one(t, r'<div class="news" id="now">.*?</details>\s*</div>')
    # 10월 22일 공모전 출품 줄은 홈 작품에서 내린 작품이라 뺀다
    news, n = re.subn(r'<li><a href="[^"]*"><time datetime="2026-10-22">2026\.10\.22</time><span class="who">[^<]*</span><b>[^<]*(?:1억 년의 빛|100 Million Years|Hwaseong)[^<]*</b><span class="arr" aria-hidden="true">→</span></a></li>', '', news)
    assert n == 1, ('화성 줄', n)
    past = news[news.index('<details>'):].count('<li>')
    news, n = re.subn(r'(<summary>[^<]*<span>)\d+(</span></summary>)', rf'\g<1>{past}\g<2>', news)
    assert n == 1, ('지난 소식 수', n)
    pf = one(t, r'<section class="pf" id="platform".*?</section>')
    # 창의 이름은 dialog가 말한다. 안쪽 구역에 같은 이름을 또 붙이지 않는다
    pf = pf.replace(' aria-labelledby="pf-t"', '', 1)
    assert pf.count(s['pf'][0]) == 1, '솔리오 안내 줄'
    pf = pf.replace(*s['pf'])
    doc = one(t, r'<dialog class="doc-dialog" id="doc-dialog".*?</dialog>')
    toast = one(t, r'<div class="toast" id="toast"[^>]*></div>')
    client = one(t, r'<script defer src="/desktop/releases/client\.js\?v=[0-9a-f]+"></script>')
    bottom = one(t, r'<div class="foot-bottom">.*?</div>')
    og = V / f'og/home-{k}.jpg'
    ogurl = f'https://synk.im/assets/v12/og/home-{k}.jpg' + (f'?v={sha(og)}' if og.exists() else '')
    x = f'<p class="sheet-x"><button type="button" data-close aria-label="{s["close"]}"></button></p>'
    pins = ''.join(f'<a class="pin" style="left:{l}%;top:{p}%" href="{u}/{d}/">{n}</a>' for (l, p, d), n in zip(PINS, s['pin']))
    title = lambda x2: f'<small>{x2[0]}</small> <b>{x2[1]}</b>'
    reserve = one(t, r'<a [^>]*href="(/reserve/\?from=synk-(?:en-)?home&amp;lang=(?:ko|en))"')
    nl = '\n'
    return f'''<!doctype html>
{s['html']}
<head>
{''.join(v + nl for v in verify)}<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{s['title']}</title>
<meta name="description" content="{s['desc']}">
<link rel="canonical" href="{s['url']}">
{alt}
<meta property="og:type" content="website"><meta property="og:url" content="{s['url']}"><meta property="og:title" content="{s['title']}"><meta property="og:description" content="{s['desc']}">
<meta property="og:image" content="{ogurl}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="{s['og']}"><meta name="twitter:card" content="summary_large_image">
{icons}
<link rel="preload" href="/assets/v11/synk-sans-v11.woff2" as="font" type="font/woff2" crossorigin>
{face}
<link rel="stylesheet" href="{CSS}">
{count}
{social}
{moved}
{site}
<script type="module" src="{JS}"></script>
</head>
<body>
<header class="nav"><a class="logo" href="#top" aria-label="{s['home']}">synk</a><nav class="lang" aria-label="{s['langs']}">{s['lang']}</nav></header>

<main id="main">{anchors('top gate glance why business products')}
<h1 class="vh">{s['h1']}</h1>
<div class="tri">
  <article class="pn k1" id="road">{anchors('lab path worlds world learner try')}
    <div class="sc"><div class="m town"><img src="{TOWN}" width="1040" height="1604" alt="{s['town']}" fetchpriority="high"></div></div>
    <h2><a href="{u}/study-abroad/">{title(s['a'])}</a></h2>
    <nav class="pins" aria-label="{s['pins']}"><div class="town">{pins}</div></nav>
  </article>
  <article class="pn k2" id="shift">
    <div class="sc"><div class="m hall"><img src="{HALL}" width="1024" height="1536" alt="{s['hall']}"><div class="scr" aria-hidden="true"><p class="hd">{s['scr'][0]}</p><div class="ck"><b><span class="now">00:00</span><i class="sec">00</i></b><span class="wh">{s['scr'][1]}</span></div><div class="pg"><i></i></div><ol class="jb"></ol><p class="ft">{s['scr'][2]}</p></div></div></div>
    <h2><a href="{u}/ai/">{title(s['b'])}</a></h2>
  </article>
  <article class="pn k3" id="pulse">{anchors('showroom')}
    <div class="sc"><video src="{FILM}" poster="{POSTER}" width="720" height="900" muted loop playsinline preload="none" aria-label="{s['film']}"></video></div>
    <h2><a href="{u}/pulse/">{title(s['c'])}</a></h2>
  </article>
</div>

<section class="end">
  <p class="ask"><button type="button" data-sheet="ask" aria-haspopup="dialog">{s['askgo']}</button> <a href="mailto:hello@synk.im">hello@synk.im</a></p>
  <nav aria-label="{s['quick']}"><a href="{reserve}">{s['reserve']}</a><button type="button" data-sheet="platform" aria-haspopup="dialog">{s['solio']}</button><button type="button" data-sheet="now" aria-haspopup="dialog">{s['news']}</button><a href="/account/platform.html#home">{s['me']}</a></nav>
</section>
</main>

<footer class="foot">
  <nav aria-label="{s['foot']}"><a href="{u}/founder/">{s['founder']}</a><a href="{u}/atlas/">{s['atlas']}</a><a href="/privacy/">{s['privacy']}</a><a href="/terms/">{s['terms']}</a><a href="/data-deletion/">{s['delete']}</a><button type="button" data-ask-q="{s['biz'][0]}">{s['biz'][1]}</button><span>© 2026 SYNK</span></nav>
  {bottom}
</footer>
<div class="wm" aria-hidden="true"><span>synk</span></div>

<dialog class="sheet" id="sheet-ask" aria-labelledby="ask-t">{x}
  <div class="sheet-in">
    <div class="head">
      <p class="tag">{s['ask'][0]}</p>
      <h2 id="ask-t">{s['ask'][1]}</h2>
      <p>{lead}</p>
      {links}
    </div>
    {main}
  </div>
  {toast}
</dialog>

<dialog class="sheet" id="sheet-now" aria-labelledby="news-t">{x}
  <section class="sheet-in" id="news">
    <div class="head">
      <p class="tag">{s['now'][0]}</p>
      <h2 id="news-t">{s['now'][1]}</h2>
    </div>
    {news}
  </section>
</dialog>

<dialog class="sheet" id="sheet-platform" aria-labelledby="pf-t">{x}
  {pf}
</dialog>

{doc}
{client}
</body>
</html>
'''


for k, rel in (('ko', 'index.html'), ('en', 'en/index.html')):
    h = page(k)
    (OUT / rel).write_text(h, 'utf8', newline='\n')
    print(rel, len(h.encode()), 'id 겹침', [i for i in set(re.findall(r'\sid="([^"]+)"', h)) if len(re.findall(rf'\sid="{i}"', h)) > 1])
for p in sorted(V.rglob('*')):
    if p.is_file():
        print(p.relative_to(OUT).as_posix(), p.stat().st_size)
