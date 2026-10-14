# 나눈 사진을 작업본 자산으로 옮기고(크기·WebP) 자료 모듈을 만든다.
# 사용: python install.py <작업본 루트>   예) C:/Users/q1212/Documents/SYNK-world-mascots
import hashlib, json, os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
REPO = sys.argv[1]
OPEN = os.path.join(REPO, 'experiences/brand-opening')
DEST = os.path.join(OPEN, 'assets/tutor-photos')
TUTORS = ['mongle', 'kkamong', 'marin']
PLACES = {'onb': 512, 'home': 288, 'life': 288, 'runner': 288, 'rhythm': 288, 'hangul': 288, 'first': 288}
STORIES = ['greetings', 'cafe', 'store', 'directions', 'transit', 'plans']
log = {'missing': []}


def save(src, dest, size, quality=82):
    if not os.path.exists(src):
        log['missing'].append(os.path.relpath(src, ROOT))
        return None
    im = Image.open(src).convert('RGB')
    if max(im.size) > size:
        im.thumbnail((size, size), Image.LANCZOS)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    im.save(dest, 'WEBP', quality=quality, method=6)
    data = open(dest, 'rb').read()
    rel = os.path.relpath(dest, DEST).replace('\\', '/')
    return f'{rel}?v={hashlib.sha256(data).hexdigest()[:12]}'


tutor = {}
for place, size in PLACES.items():
    for tid in TUTORS:
        d = os.path.join(ROOT, 'cut', f'{place}_{tid}')
        if not os.path.isdir(d):
            log['missing'].append(f'cut/{place}_{tid}')
            continue
        for f in sorted(os.listdir(d)):
            if f.endswith('.png') and not f.startswith('_'):
                emo = f[:-4]
                v = save(os.path.join(d, f), os.path.join(DEST, place, f'{tid}-{emo}.webp'), size)
                if v:
                    tutor.setdefault(place, {}).setdefault(tid, {})[emo] = v

profile = {}
# 몽글 계정 사진은 3D 방의 몽글과 같은 구슬 눈 칸(10-14 유호님 「계정 사진 몽글은 구슬 눈으로」)
for key, cell in [('mongle', 'mongle-기본'), ('kkamong', 'kkamong'), ('marin', 'marin'), ('default', 'mongle-기본')]:
    v = save(os.path.join(ROOT, 'cut/profile', cell + '.png'), os.path.join(DEST, 'profile', key + '.webp'), 256)
    if v:
        profile[key] = v

life = {'story': {}, 'cafe': {}, 'welcome': None}
for s in STORIES:
    for sp in ['narrator', 'mongle', 'kkamong', 'marine']:
        v = save(os.path.join(ROOT, f'cut/story_{s}', sp + '.png'), os.path.join(DEST, 'story', f'{s}-{sp}.webp'), 768)
        if v:
            life['story'].setdefault(s, {})[sp] = v
for kind in ['counter', 'window', 'garden']:
    v = save(os.path.join(ROOT, 'boards', f'cafe_{kind}.png'), os.path.join(DEST, 'cafe', kind + '.webp'), 1200)
    if v:
        life['cafe'][kind] = v
life['welcome'] = save(os.path.join(ROOT, 'boards', 'welcome.png'), os.path.join(DEST, 'welcome', 'friends.webp'), 512)

# 한글 무대 「몽글에게 가르쳐 주기」
teach = {}
for face in ['curious', 'smile']:
    src = os.path.join(ROOT, 'cut/teach_mongle', face + '.png')
    dest = os.path.join(REPO, 'experiences/hangul-stage/assets/brand', f'teach-{face}.webp')
    if os.path.exists(src):
        im = Image.open(src).convert('RGB'); im.thumbnail((320, 320), Image.LANCZOS); im.save(dest, 'WEBP', quality=82, method=6)
        teach[face] = os.path.basename(dest)
    else:
        log['missing'].append(f'cut/teach_mongle/{face}.png')

js = ('// 자료: tools/world-mascot-photos/install.py가 만든다(손으로 고치지 않는다).\n'
      '// 경로는 brand-opening/assets/tutor-photos/ 기준, ?v=는 파일 sha256 앞 12자리.\n'
      f'export const TUTOR_PHOTOS={json.dumps(tutor, ensure_ascii=False, separators=(",", ":"))};\n'
      f'export const PROFILE_PHOTOS={json.dumps(profile, ensure_ascii=False, separators=(",", ":"))};\n'
      f'export const LIFE_PHOTOS={json.dumps(life, ensure_ascii=False, separators=(",", ":"))};\n')
open(os.path.join(OPEN, 'tutor-photos-data.mjs'), 'w', encoding='utf-8', newline='\n').write(js)
total = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(DEST) for f in fs)
print('tutor places', {p: {t: len(v) for t, v in d.items()} for p, d in tutor.items()})
print('profile', list(profile), 'story', {k: len(v) for k, v in life['story'].items()}, 'cafe', list(life['cafe']), 'welcome', bool(life['welcome']), 'teach', teach)
print('size MB %.2f' % (total / 1048576), 'missing', log['missing'])
