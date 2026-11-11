"""PULSE 고객 앱(시사실 판) 글꼴을 글자 조각으로 나눈다 — 첫 방문이 받는 글꼴 줄이기(2026-11-11).
실행: python -X utf8 tools/build-pulse-fonts.py

지금까지 고객 앱은 SUIT Variable 전체(610KB)와 Noto Serif KR 300(292KB)을 첫 화면에서 미리 받았다(index.html preload).
느린 연결(지연 400ms · 50KB/s)에서는 이 두 파일이 film.css · 화면 모듈과 대역을 나눠 써서 의뢰서가 34초 뒤에 떴다.
글자 모양 · 굵기 축 · 자간은 원본 그대로 두고, 화면에 나온 글자가 든 조각만 받게 나눈다.

- SYNK Sans(SUIT Variable 원본): 넷으로 나눈다. CSS는 뒤에 선언한 면을 먼저 본다(CSS Fonts 4 §4.5).
  · latin — 한글 음절이 아닌 모든 글자(라틴 · 숫자 · 문장부호 · 기호 · 자모). SUIT의 자간(kern)은 라틴 63자에만 있어
    라틴을 한 조각에 모으면 조각 경계에서 자간이 달라지는 일이 없다(한글 음절에는 자간 표가 없다).
  · first — 언어를 정하기 전 첫 그리기의 글(첫 HTML · 머리 단추 · 불러오는 글)과 언어 메뉴 「한국어」의 음절. 영어 화면은 latin과 이 조각만 받는다.
  · ui — 고객 앱 화면 원문(pulse-app 모듈의 문자열 · 템플릿 글, 주석 제외)에 나오는 나머지 음절.
  · rest — 그 밖의 음절. 손님이 쓴 글처럼 화면 원문에 없는 글자가 나올 때, 또는 한국어 화면에서 손님이 글 칸에 처음 들어올 때 받는다(app.mjs focusin — 보기만 하는 손님은 받지 않는다).
- Noto Serif KR 300(앱 제목 · 준제목, 원본은 이미 KS X 1001 2,350자로 줄인 파일): 셋으로 나눈다.
  · sym — 한글 음절이 아닌 글자, · ui — 화면 원문의 음절, · rest — 나머지 음절.
- 범위가 겹치면 앞 조각을 받는 동안 크롬이 뒤 조각까지 받는다(플랫폼 도구 build-platform-fonts.py와 같은 실측).
  그래서 rest 범위에는 ui · first 글자를 넣지 않고, ui 범위는 한글 음절 칸을 통째로(first 글자만 빼고) 잡아 목록을 짧게 한다 —
  ui에 없는 음절은 ui에서 글자를 못 찾고 rest로 넘어간다.
- SUIT의 OFL은 예약 이름(Reserved Font Name) SUIT가 있어 줄인 수정본의 글꼴 이름을 SYNK Sans로 바꾼다(저작권 · 라이선스 항목 그대로).
  Noto Serif KR의 OFL에는 예약 이름이 없다(지금 판도 줄인 수정본이 같은 이름이다).

결과: public/pulse-app/assets/SYNKSans-pulse-*.woff2 · NotoSerifKR-300-*.woff2, 기록 docs/브랜드_폰트/PULSE_웹/fonts.json.
film.css의 글꼴 선언 · 범위도 도구가 맞춘다. 같은 입력이면 같은 바이트다.
**고객 앱 화면 글(pulse-app 모듈)을 바꾸면 다시 돌린다.** 안 돌리면 새 글자 때문에 rest(약 400KB)까지 받는다(글자는 같은 글꼴로 나온다).
회사 폴더 시험 pulse-first-load.test.mjs가 화면 원문 음절이 rest 범위에 들어가면 알린다.
"""
import io, json, os, pathlib, re, subprocess, time
from fontTools import subset
from fontTools.ttLib import TTFont

REPO = pathlib.Path(__file__).resolve().parents[1]
APP = REPO / 'docs/마케팅/온라인마케팅지도/engagement/company/public/pulse-app'
ASSETS = APP / 'assets'
OUT = REPO / 'docs/브랜드_폰트/PULSE_웹'
SUIT = REPO / 'docs/브랜드_폰트/SUIT/SUIT-Variable.woff2'
NOTO = ASSETS / 'NotoSerifKR-300.woff2'
CSS = APP / 'film.css'
BLOCK = set(range(0xAC00, 0xD7A4))


def ranges(points):
    points = sorted(points)
    out, start, prev = [], None, None
    for p in points:
        if start is None:
            start = prev = p
        elif p == prev + 1:
            prev = p
        else:
            out.append((start, prev)); start = prev = p
    if start is not None:
        out.append((start, prev))
    return ','.join(f'U+{a:X}' if a == b else f'U+{a:X}-{b:X}' for a, b in out)


# 화면 원문: pulse-app의 모듈 · 서비스 워커의 문자열과 템플릿 글(주석은 빼고) + 첫 HTML의 글.
# 훑개는 회사 폴더의 pulse-ui-text.mjs 하나다 — 회사 시험(pulse-first-load.test.mjs)이 같은 훑개로 같은 글자를 센다.
# 회사 이미지에는 npm 패키지가 없어 그 훑개는 node 기본만 쓴다. acorn과 같은 글을 내는지는 tests/pulse-ui-text.test.mjs가 대조한다.
probe = r"""
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');const [dir,helper]=process.argv.slice(1);
import(pathToFileURL(helper).href).then(({literalTexts,SKIP_DIRS})=>{
  const files=[];const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory()){if(!SKIP_DIRS.includes(e.name))walk(p);}else if(/\.(mjs|js)$/.test(e.name))files.push(p);}};walk(dir);
  let text='';for(const file of files.sort())for(const t of literalTexts(fs.readFileSync(file,'utf8')))text+=t+'\n';
  process.stdout.write(JSON.stringify({files:files.map(f=>path.relative(dir,f).split(path.sep).join('/')),text}));
});
"""
HELPER = APP.parents[1] / 'pulse-ui-text.mjs'
probed = json.loads(subprocess.run(['node', '-e', probe, str(APP), str(HELPER)], capture_output=True, check=True).stdout.decode('utf-8'))
assert 'request-flow.mjs' in probed['files'] and 'film-home.mjs' in probed['files'] and 'i18n/en.mjs' in probed['files'], 'pulse-app 모듈 목록이 이상하다'
html = (APP / 'index.html').read_text(encoding='utf-8')
body = re.sub(r'<[^>]+>', ' ', html.split('<body>', 1)[1])
ui_text = {ord(ch) for ch in probed['text'] + html}
# 첫 조각: 언어를 정하기 전에 그려지는 한국어와 영어 화면에 남는 한국어 — 첫 HTML의 글(본문으로 건너뛰기 · 불러오는 글 · 끊김 알림),
# 서버 응답(언어 결정) 전 첫 render()의 머리 단추(views.mjs header — 「앱 설치」 · 「제작자 공간 ↗」)와 불러오는 글(app.mjs loadingView),
# 언어 메뉴의 「한국어」(판 6 점검 E에서 영어 화면에 보이는 한글은 이것뿐). 영어 화면은 latin과 이 조각만 받는다.
BOOT = ['앱 설치', '제작자 공간 ↗', '프로젝트를 확인하고 있어요.', '한국어']
for text in BOOT:
    assert text in probed['text'], f'첫 그리기 글 「{text}」이 화면 원문에 없다 — BOOT 목록을 맞춘다'
first_text = {ord(ch) for ch in body + ''.join(BOOT)}

suit = TTFont(SUIT)
suit_cmap = set(suit.getBestCmap())
s_latin = suit_cmap - BLOCK
s_first = first_text & suit_cmap & BLOCK
s_ui = (ui_text & suit_cmap & BLOCK) - s_first
s_rest = (suit_cmap & BLOCK) - s_ui - s_first
s_first_range = s_first
s_ui_range = BLOCK - s_first                 # 음절 칸 통째로(첫 조각 글자만 뺀다)
# 원본에 없는 드문 음절까지 이어 붙여 범위를 짧게 하되, 화면 원문 음절은 원본에 없어도 뺀다(그 글자 때문에 rest를 받아도 글자가 없다)
s_rest_range = BLOCK - s_ui - s_first - ui_text
assert not (s_rest_range & (s_ui | s_first)) and not (s_ui_range & s_first)

noto = TTFont(NOTO)
noto_cmap = set(noto.getBestCmap())
n_sym = noto_cmap - BLOCK
n_ui = ui_text & noto_cmap & BLOCK
n_rest = (noto_cmap & BLOCK) - n_ui
n_ui_range = BLOCK
n_rest_range = BLOCK - n_ui - ui_text   # 「웻」처럼 KS X 1001 밖 화면 음절도 rest를 부르지 않게
assert not (n_rest_range & n_ui)


def subset_font(source, points, *, rename=False):
    font = TTFont(source, recalcTimestamp=False)  # 같은 입력이면 같은 바이트
    options = subset.Options()
    options.flavor = 'woff2'
    options.layout_features = ['*']
    options.hinting = False
    options.name_IDs = ['*']
    options.notdef_outline = True
    options.glyph_names = False
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=sorted(points))
    subsetter.subset(font)
    if rename:
        names = font['name']
        for record in names.names:
            value = record.toUnicode()
            if 'SUIT' in value:  # 글꼴 이름만 바뀐다(저작권 · 라이선스 항목에는 SUIT가 없다). PostScript 계열은 공백 없이.
                names.setName(value.replace('SUITVariable', 'SYNKSansVariable').replace('SUIT Variable', 'SYNK Sans').replace('SUIT', 'SYNK Sans'), record.nameID, record.platformID, record.platEncID, record.langID)
    buffer = io.BytesIO(); font.flavor = 'woff2'; font.save(buffer)
    return buffer.getvalue()


built = {
    'SYNKSans-pulse-latin.woff2': subset_font(SUIT, s_latin, rename=True),
    'SYNKSans-pulse-first.woff2': subset_font(SUIT, s_first, rename=True),
    'SYNKSans-pulse-ui.woff2': subset_font(SUIT, s_ui, rename=True),
    'SYNKSans-pulse-rest.woff2': subset_font(SUIT, s_rest, rename=True),
    'NotoSerifKR-300-sym.woff2': subset_font(NOTO, n_sym),
    'NotoSerifKR-300-ui.woff2': subset_font(NOTO, n_ui),
    'NotoSerifKR-300-rest.woff2': subset_font(NOTO, n_rest),
}


def replace_file(path, data):
    temporary = path.with_name(path.name + '.tmp-fonts')
    temporary.write_bytes(data)
    for _ in range(20):  # 윈도에서 파일 검사가 잠깐 잡고 있을 때가 있다
        try:
            os.replace(temporary, path); return
        except OSError:
            time.sleep(0.5)
    raise SystemExit(f'{path.name} 교체 실패')


for name, data in built.items():
    replace_file(ASSETS / name, data)
latin_range = ranges(s_latin)
meta = {
    'source': {'SYNK Sans': 'docs/브랜드_폰트/SUIT/SUIT-Variable.woff2', 'Noto Serif KR 300': 'docs/마케팅/온라인마케팅지도/engagement/company/public/pulse-app/assets/NotoSerifKR-300.woff2 (KS X 1001 줄인 판, 원문 Windows NotoSerifKR-VF.ttf)'},
    'license': 'SIL OFL 1.1. SUIT: Reserved Font Name SUIT → 수정본 글꼴 이름 SYNK Sans(저작권 Sun 유지). Noto Serif KR: 예약 이름 없음.',
    'uiSources': probed['files'] + ['index.html'],
    'faces': {
        'SYNKSans-pulse-latin.woff2': {'codepoints': len(s_latin), 'unicodeRange': latin_range},
        'SYNKSans-pulse-first.woff2': {'codepoints': len(s_first), 'unicodeRange': ranges(s_first_range)},
        'SYNKSans-pulse-ui.woff2': {'codepoints': len(s_ui), 'unicodeRange': ranges(s_ui_range)},
        'SYNKSans-pulse-rest.woff2': {'codepoints': len(s_rest), 'unicodeRange': ranges(s_rest_range)},
        'NotoSerifKR-300-sym.woff2': {'codepoints': len(n_sym), 'unicodeRange': ranges(n_sym)},
        'NotoSerifKR-300-ui.woff2': {'codepoints': len(n_ui), 'unicodeRange': ranges(n_ui_range)},
        'NotoSerifKR-300-rest.woff2': {'codepoints': len(n_rest), 'unicodeRange': ranges(n_rest_range)},
    },
    'files': {name: len(data) for name, data in built.items()},
}
OUT.mkdir(parents=True, exist_ok=True)
(OUT / 'fonts.json').write_text(json.dumps(meta, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')

# film.css 글꼴 선언: 처음에는 SUIT · Noto 한 파일 선언을 조각 선언으로 바꾸고, 다음부터는 조각 줄을 통째로 다시 쓴다.
# 뒤에 선언한 면을 먼저 보므로 rest → ui → first → latin 차례로 쓴다.
css = CSS.read_bytes().decode('utf-8')
crlf = '\r\n' in css
css = css.replace('\r\n', '\n')
f = meta['faces']
face = lambda family, file, weight: f"@font-face{{font-family:{family};src:url('./assets/{file}') format('woff2');font-weight:{weight};font-display:swap;unicode-range:{f[file]['unicodeRange']}}}"
sans = '\n'.join(face("'SYNK Sans'", name, '100 900') for name in ('SYNKSans-pulse-rest.woff2', 'SYNKSans-pulse-ui.woff2', 'SYNKSans-pulse-first.woff2', 'SYNKSans-pulse-latin.woff2'))
serif = '\n'.join(face("'Noto Serif KR'", name, '300') for name in ('NotoSerifKR-300-rest.woff2', 'NotoSerifKR-300-ui.woff2', 'NotoSerifKR-300-sym.woff2'))
START, END = '/* 글꼴 조각 시작 — tools/build-pulse-fonts.py가 쓴다. 손으로 고치지 않는다. */', '/* 글꼴 조각 끝 */'
block = f'{START}\n{sans}\n{serif}\n{END}'
if START in css:
    css = re.sub(re.escape(START) + r'.*?' + re.escape(END), lambda m: block, css, count=1, flags=re.S)
else:
    old_suit = "@font-face{font-family:SUIT;src:url('./assets/SUIT.woff2') format('woff2');font-weight:100 900;font-display:swap}"
    old_noto = "@font-face{font-family:'Noto Serif KR';src:url('./assets/NotoSerifKR-300.woff2') format('woff2');font-weight:300;font-display:swap}"
    assert css.count(old_suit) == 1 and css.count(old_noto) == 1, '처음 바꿀 SUIT · Noto 선언을 못 찾았다'
    css = css.replace(old_suit, block).replace(old_noto + '\n', '').replace(old_noto, '')
# 라틴 면(SX Latin · SX Latin Wide)은 같은 라틴 조각을 가리킨다(범위는 그대로).
css = css.replace("font-family:'SX Latin';src:url('./assets/SUIT.woff2')", "font-family:'SX Latin';src:url('./assets/SYNKSans-pulse-latin.woff2')")
css = css.replace("font-family:'SX Latin Wide';src:url('./assets/SUIT.woff2')", "font-family:'SX Latin Wide';src:url('./assets/SYNKSans-pulse-latin.woff2')")
css = css.replace("--sx-sans:SUIT,", "--sx-sans:'SYNK Sans',").replace("--sx-mono:'DM Mono',SUIT,", "--sx-mono:'DM Mono','SYNK Sans',")
for needle in ("font-family:'SX Latin';src:url('./assets/SYNKSans-pulse-latin.woff2')", "font-family:'SX Latin Wide';src:url('./assets/SYNKSans-pulse-latin.woff2')", "--sx-sans:'SYNK Sans',", "--sx-mono:'DM Mono','SYNK Sans',", START, END):
    assert needle in css, needle
code = re.sub(r'/\*.*?\*/', '', css, flags=re.S)  # 주석의 「SUIT」(글꼴 내력)는 그대로 둔다
assert 'SUIT.woff2' not in code and "NotoSerifKR-300.woff2'" not in code and re.search(r'\bSUIT\b', code) is None, 'film.css에 옛 글꼴 선언이 남았다'
# SX Latin · SX Latin Wide 범위가 라틴 조각 안에 있는지(조각에 없는 글자를 그 면이 맡지 않게).
for family in ('SX Latin', 'SX Latin Wide'):
    m = re.search(r"font-family:'" + re.escape(family) + r"';src:url\('\./assets/SYNKSans-pulse-latin\.woff2'\)[^}]*unicode-range:([^;}]+)", css)
    assert m, family
    covered = set()
    for part in m.group(1).split(','):
        a, _, b = part.strip()[2:].partition('-')
        covered.update(range(int(a, 16), int(b or a, 16) + 1))
    missing = covered & suit_cmap - s_latin
    assert not missing, (family, sorted(missing)[:5])
if crlf:
    css = css.replace('\n', '\r\n')
replace_file(CSS, css.encode('utf-8'))
print(json.dumps({'files': meta['files'], 'codepoints': {k: v['codepoints'] for k, v in f.items()}, 'rangeChars': {k: len(v['unicodeRange']) for k, v in f.items()}}, ensure_ascii=False, indent=1))
