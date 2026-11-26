"""시안 쪽과 질문 자료에 든 글자만 담은 글꼴을 굽는다."""
import glob, json, os, sys
from fontTools import subset
from fontTools.ttLib import TTFont
sys.stdout.reconfigure(encoding='utf-8')
R = 'C:/Users/q1212/Documents/SYNK-appsscript/docs/브랜드_폰트'
P = os.path.dirname(os.path.abspath(__file__))
txt = ''.join(open(f, encoding='utf8').read() for f in glob.glob(P + '/*.html') + glob.glob(P + '/*.js') + glob.glob(P + '/*.css') if 'knowledge-engine' not in f)
k = json.load(open(P + '/data.json', encoding='utf8'))
txt += json.dumps(k, ensure_ascii=False)
ch = set(txt) | set('0123456789:.,-·—…「」『』()%+×→←↑↓↗~?!')


def sub(src, out, keep=None, name=None):
    o = subset.Options(); o.flavor = 'woff2'; o.layout_features = ['*']; o.name_IDs = ['*']; o.notdef_outline = True
    f = subset.load_font(src, o); s = subset.Subsetter(o)
    s.populate(unicodes=[ord(c) for c in (keep or ch)]); s.subset(f)
    if name:
        for r in f['name'].names:
            if r.nameID in (1, 3, 4, 6, 16, 25): r.string = name.replace(' ', '') if r.nameID in (6, 25) else name
    subset.save_font(f, out, o)
    cm = TTFont(out).getBestCmap()
    miss = [c for c in (keep or ch) if ord(c) not in cm and c.strip() and ord(c) > 127]
    print(os.path.basename(out), os.path.getsize(out), '없는 글자', ''.join(sorted(miss))[:60])


sub(R + '/SUIT/SUIT-Variable.woff2', P + '/f/sans.woff2', name='SYNK Sans Draft')
sub(R + '/DM_Mono/DMMono-Medium.ttf', P + '/f/mono.woff2', keep=set('0123456789:.,-+/·→←↗ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz '))
sub(R + '/InterTight/InterTight-Medium.ttf', P + '/f/latin.woff2', keep=set(chr(c) for c in range(32, 127)) | set('’“”—–…·→←↗›−↵↑↓'))
