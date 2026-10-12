"""웹 플랫폼(account/platform.html) 글꼴을 가볍게 만든다. 실행: python -X utf8 tools/build-platform-fonts.py

- SYNK Sans 화면판·나머지판: SUIT Variable을 플랫폼 원문(html·css·src)에 나오는 글자 + 기본 라틴·문장부호
  조각과 그 밖의 글자 조각으로 나눈다. 나머지판은 사용자 이름·작품 제목처럼 화면판에 없는 글자가 나올 때만 받는다.
  SUIT는 OFL 「Reserved Font Name SUIT」라 줄인 수정본의 글꼴 이름을 SYNK Sans로 바꾼다(저작권·라이선스 항목은 그대로).
- SYNK Arrow: 화살표 네 글자(U+2190-2193)만 쓰는 면이 Inter Tight Medium TTF 전체를 받던 것을 그 네 글자로 줄인다.
- Inter Tight 400·500, DM Mono 500: TTF를 같은 글자 그대로 WOFF2로 바꾼다(DM Mono는 CSS 범위만 남김).
  Inter Tight·DM Mono의 OFL에는 예약 이름이 없다.
결과는 docs/브랜드_폰트/플랫폼_웹/에 쓰고, tools/build-synk-account.js가 experiences/synk-account/assets/로 복사한다.
지금 작업본에도 같은 바이트를 바로 넣고 platform.css의 글꼴 선언·범위를 맞춘다.
플랫폼 화면 글(src·html)을 바꾸면 다시 돌린다.
"""
import io, json, os, pathlib, re, time
from fontTools import subset
from fontTools.ttLib import TTFont

REPO = pathlib.Path(__file__).resolve().parents[1]
ACCOUNT = REPO / 'experiences/synk-account'
OUT = REPO / 'docs/브랜드_폰트/플랫폼_웹'
SUIT = REPO / 'experiences/learning-hub/assets/SUIT-Variable.woff2'
INTER_REGULAR = REPO / 'docs/브랜드_폰트/InterTight/InterTight-Regular.ttf'
INTER_MEDIUM = REPO / 'docs/브랜드_폰트/InterTight/InterTight-Medium.ttf'
DM_MONO = REPO / 'docs/브랜드_폰트/DM_Mono/DMMono-Medium.ttf'
CSS = ACCOUNT / 'platform.css'

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

def parse_range(text):
    points = set()
    for part in text.split(','):
        a, _, b = part.strip()[2:].partition('-')
        points.update(range(int(a, 16), int(b or a, 16) + 1))
    return points

# 플랫폼에서 보이는 글: 페이지·스타일·화면 코드(시험·QA·node_modules·빌드 결과 제외)
text = set()
sources = [ACCOUNT / name for name in ('platform.html', 'index.html', 'client.html', 'teacher.html', 'local-world.html', 'platform.css', 'benefits.css', 'style.css', 'teacher.css', 'wardrobe.css', 'world-classroom.css', 'theme.js', 'platform.webmanifest', 'world.webmanifest')]
sources += sorted((ACCOUNT / 'src').rglob('*.mjs')) + sorted((ACCOUNT / 'src').rglob('*.cjs'))
# 번들은 src 밖 모듈(데스크톱 앱과 함께 쓰는 회원 혜택 글 desktop/renderer/benefits.mjs 등)도 묶는다.
# 빌드 도구와 같은 진입점으로 esbuild의 입력 목록을 뽑아 그 파일들의 글자를 읽는다(node_modules 제외).
import subprocess
probe = r"""
const path=require('node:path');const dir=process.argv[1];
const esbuild=require(require.resolve('esbuild',{paths:[dir]}));
const files=new Set();
for(const name of ['app','client','preview','platform','local-world','teacher']){
  const r=esbuild.buildSync({absWorkingDir:dir,entryPoints:[`src/${name}.mjs`],bundle:true,write:false,metafile:true,platform:'browser',format:'iife',target:['es2022'],logLevel:'silent'});
  for(const input of Object.keys(r.metafile.inputs)) if(!input.includes('node_modules')) files.add(path.resolve(dir,input));
}
process.stdout.write(JSON.stringify([...files]));
"""
inputs = json.loads(subprocess.run(['node', '-e', probe, str(ACCOUNT)], capture_output=True, check=True).stdout)
assert any(i.replace('\\', '/').endswith('desktop/renderer/benefits.mjs') for i in inputs), 'bundle inputs look incomplete'
sources += [pathlib.Path(i) for i in sorted(inputs)]
# 이 CSS는 지금 공개된 번들과도 함께 쓰인다. 옆 저장소 synk-policy가 있으면 공개 account/의 번들·페이지 글자도 읽는다.
published_text = set()
policy = REPO.parent / 'synk-policy'
if (policy / '.git').exists():
    listed = subprocess.run(['git', '-C', str(policy), 'ls-tree', '-r', '--name-only', 'origin/main', '--', 'account/'], capture_output=True, check=True).stdout.decode('utf-8').split('\n')
    for name in listed:
        if re.search(r'^account/(dist/[^/]+\.js|[^/]+\.(html|css|webmanifest))$', name):
            data = subprocess.run(['git', '-C', str(policy), 'show', f'origin/main:{name}'], capture_output=True, check=True).stdout
            published_text.update(ord(ch) for ch in data.decode('utf-8', errors='ignore'))
else:
    print('경고: ../synk-policy가 없어 공개 번들 글자를 읽지 못했다.')
for path in sources:
    if path.is_file():
        text.update(ord(ch) for ch in path.read_text(encoding='utf-8', errors='ignore'))
text |= published_text
basic = set(range(0x20, 0x7F)) | set(range(0xA0, 0x100)) | set(range(0x2010, 0x2070)) | set(range(0x3000, 0x3040)) | {0x2190, 0x2191, 0x2192, 0x2193, 0x2197, 0x00B7, 0x00D7, 0x2026}

suit = TTFont(SUIT)
cmap = set(suit.getBestCmap())
ui = (text | basic) & cmap
rest = cmap - ui
# 나머지판 범위에는 화면판 글자를 넣지 않는다(겹치면 화면판을 받는 동안 크롬이 나머지판까지 받는다).
# 한글 음절 칸에서는 원본에 없는 드문 음절까지 이어 붙여 범위를 짧게 한다.
rest_range = rest | (set(range(0xAC00, 0xD7A4)) - ui - text)
# 화면판 범위는 한글 음절 칸을 통째로: 화면판에 없는 음절은 화면판에서 글자를 못 찾고 나머지판으로 넘어간다.
ui_range = ui | set(range(0xAC00, 0xD7A4))
assert not (rest_range & ui)

def subset_font(source, points, *, rename=False, keep_all=False, hinting=True):
    font = TTFont(source, recalcTimestamp=False)  # 같은 입력이면 같은 바이트
    if keep_all:  # 형식만 바꾼다(글자·힌팅·이름 그대로)
        buffer = io.BytesIO(); font.flavor = 'woff2'; font.save(buffer)
        return buffer.getvalue()
    options = subset.Options()
    options.flavor = 'woff2'
    options.layout_features = ['*']
    options.hinting = hinting
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
            if 'SUIT' in value:  # 글꼴 이름만 바뀐다(저작권·라이선스 항목에는 SUIT가 없다). PostScript 계열은 공백 없이.
                names.setName(value.replace('SUITVariable', 'SYNKSansVariable').replace('SUIT Variable', 'SYNK Sans').replace('SUIT', 'SYNK Sans'), record.nameID, record.platformID, record.platEncID, record.langID)
    buffer = io.BytesIO(); font.flavor = 'woff2'; font.save(buffer)
    return buffer.getvalue()

OUT.mkdir(parents=True, exist_ok=True)
DM_RANGE = 'U+0021-007E,U+00A0-00FF,U+2010-2027,U+2190-21FF'
built = {
    'SYNKSans-ui.woff2': subset_font(SUIT, ui, rename=True, hinting=False),
    'SYNKSans-rest.woff2': subset_font(SUIT, rest, rename=True, hinting=False),
    'SYNKArrow.woff2': subset_font(INTER_MEDIUM, set(range(0x2190, 0x2194))),
    'InterTight-Regular.woff2': subset_font(INTER_REGULAR, None, keep_all=True),
    'InterTight-Medium.woff2': subset_font(INTER_MEDIUM, None, keep_all=True),
    'DMMono-Medium.woff2': subset_font(DM_MONO, parse_range(DM_RANGE) & set(TTFont(DM_MONO).getBestCmap())),
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
    replace_file(OUT / name, data)
    replace_file(ACCOUNT / 'assets' / name, data)  # 빌드 도구가 복사할 바이트를 작업본에도 그대로
meta = {
    'source': {'SYNK Sans': 'experiences/learning-hub/assets/SUIT-Variable.woff2', 'SYNK Arrow': 'docs/브랜드_폰트/InterTight/InterTight-Medium.ttf (U+2190-2193)', 'Inter Tight': 'docs/브랜드_폰트/InterTight/*.ttf → WOFF2', 'DM Mono': 'docs/브랜드_폰트/DM_Mono/DMMono-Medium.ttf → WOFF2 (' + DM_RANGE + ')'},
    'license': 'SIL OFL 1.1. SUIT: Reserved Font Name SUIT → 수정본 글꼴 이름 SYNK Sans(저작권 Sun 유지). Inter Tight·DM Mono: 예약 이름 없음.',
    'ui': {'codepoints': len(ui), 'bytes': len(built['SYNKSans-ui.woff2']), 'unicodeRange': ranges(ui_range)},
    'rest': {'codepoints': len(rest), 'bytes': len(built['SYNKSans-rest.woff2']), 'unicodeRange': ranges(rest_range)},
    'files': {name: len(data) for name, data in built.items()},
}
(OUT / 'fonts.json').write_text(json.dumps(meta, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')

# platform.css 글꼴 선언을 맞춘다(처음 한 번은 SUIT·TTF 선언을 바꾸고, 다음부터는 범위만 다시 쓴다).
css = CSS.read_bytes().decode('utf-8')
crlf = '\r\n' in css
css = css.replace('\r\n', '\n')
face = lambda name, file, extra: f"@font-face{{font-family:'{name}';src:url('./assets/{file}') format('woff2');font-weight:100 900;font-display:swap{extra}}}"
sans_faces = face('SYNK Sans', 'SYNKSans-rest.woff2', ';unicode-range:' + meta['rest']['unicodeRange']) + '\n' + face('SYNK Sans', 'SYNKSans-ui.woff2', ';unicode-range:' + meta['ui']['unicodeRange'])
pairs = [
    (r"@font-face\{font-family:SUIT;src:url\('\./assets/SUIT-Variable\.woff2'\) format\('woff2'\);font-weight:100 900;font-display:swap\}", sans_faces),
    (r"@font-face\{font-family:'SYNK Sans';src:url\('\./assets/SYNKSans-rest\.woff2'\)[^}]*\}\n@font-face\{font-family:'SYNK Sans';src:url\('\./assets/SYNKSans-ui\.woff2'\)[^}]*\}", sans_faces),
    (r"url\('\./assets/InterTight-Regular\.ttf'\) format\('truetype'\)", "url('./assets/InterTight-Regular.woff2') format('woff2')"),
    (r"(@font-face\{font-family:'Inter Tight';)src:url\('\./assets/InterTight-Medium\.ttf'\) format\('truetype'\)", r"\1src:url('./assets/InterTight-Medium.woff2') format('woff2')"),
    (r"url\('\./assets/DMMono-Medium\.ttf'\) format\('truetype'\)", "url('./assets/DMMono-Medium.woff2') format('woff2')"),
    (r"(@font-face\{font-family:'SYNK Arrow';)src:url\('\./assets/InterTight-Medium\.ttf'\) format\('truetype'\)", r"\1src:url('./assets/SYNKArrow.woff2') format('woff2')"),
    (r"--sans:'SYNK Arrow',SUIT,'Inter Tight',system-ui,sans-serif;--mono:'DM Mono',SUIT,ui-monospace,monospace;", "--sans:'SYNK Arrow','SYNK Sans','Inter Tight',system-ui,sans-serif;--mono:'DM Mono','SYNK Sans',ui-monospace,monospace;"),
]
for pattern, replacement in pairs:
    css = re.sub(pattern, lambda m: m.expand(replacement) if '\\1' in replacement else replacement, css)
for needle in ("SYNKSans-ui.woff2", "SYNKSans-rest.woff2", "SYNKArrow.woff2", "InterTight-Regular.woff2", "InterTight-Medium.woff2') format('woff2');font-weight:500", "DMMono-Medium.woff2", "--sans:'SYNK Arrow','SYNK Sans'"):
    assert needle in css, needle
assert 'SUIT-Variable.woff2' not in css and '.ttf' not in css
if crlf:
    css = css.replace('\n', '\r\n')
replace_file(CSS, css.encode('utf-8'))
print(json.dumps({k: v for k, v in meta.items() if k in ('ui', 'rest', 'files')} | {'ui': {'codepoints': meta['ui']['codepoints'], 'bytes': meta['ui']['bytes'], 'rangeChars': len(meta['ui']['unicodeRange'])}, 'rest': {'codepoints': meta['rest']['codepoints'], 'bytes': meta['rest']['bytes'], 'rangeChars': len(meta['rest']['unicodeRange'])}}, ensure_ascii=False, indent=1))
