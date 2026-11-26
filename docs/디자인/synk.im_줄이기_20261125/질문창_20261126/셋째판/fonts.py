"""셋째 판 시안 글꼴: SUIT(본문 · 입력). KS X 1001 한글 2,350자 + 질문 자료 글자 + 라틴.
다 판의 명조는 PULSE 고객 앱의 승인 글꼴 NotoSerifKR-300.woff2(KS X 1001)를 그대로 f/serif.woff2로 복사한다.
쓰는 법: python -I fonts.py <시안 폴더(data.json이 있는 곳)>"""
import json, os, sys
from fontTools import subset
from fontTools.ttLib import TTFont
import shutil
sys.stdout.reconfigure(encoding='utf-8')
P = sys.argv[1]
R = 'C:/Users/q1212/Documents/SYNK-appsscript/docs/브랜드_폰트'
ks = set()
for a in range(0xB0, 0xC9):
    for b in range(0xA1, 0xFF):
        try: ks.add(bytes([a, b]).decode('euc-kr'))
        except Exception: pass
k = json.load(open(P + '/data.json', encoding='utf8'))
ch = ks | set(json.dumps(k, ensure_ascii=False)) | set(chr(c) for c in range(32, 127)) | set('·—–…「」『』“”‘’→←↑↓↗↵⌘×✕')

def sub(f, out, keep, name=None):
    o = subset.Options(); o.flavor = 'woff2'; o.layout_features = ['*']; o.name_IDs = ['*']; o.notdef_outline = True
    s = subset.Subsetter(o); s.populate(unicodes=[ord(c) for c in keep]); s.subset(f)
    if name:
        for r in f['name'].names:
            if r.nameID in (1, 3, 4, 6, 16, 25): r.string = name.replace(' ', '') if r.nameID in (6, 25) else name
    subset.save_font(f, out, o); print(os.path.basename(out), os.path.getsize(out))

o = subset.Options()
sub(subset.load_font(R + '/SUIT/SUIT-Variable.woff2', o), P + '/f/sans.woff2', ch, 'SYNK Sans Draft')
shutil.copy('C:/Users/q1212/Documents/SYNK-appsscript/docs/마케팅/온라인마케팅지도/engagement/company/public/pulse-app/assets/NotoSerifKR-300.woff2', P + '/f/serif.woff2')
