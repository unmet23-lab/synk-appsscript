# 「모델 벽」 시안 빌드(11-04) — site/proto-wall.html과 자료를 만든다(site/는 git 밖, 공개 안 됨).
# 사용: python -X utf8 build_proto3.py   → http://localhost:8791/proto-wall.html
import json, os, re, shutil, subprocess
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
BOOK = os.path.abspath(os.path.join(HERE, '..', '..'))
SITE = os.path.join(BOOK, 'site')
RAW = os.path.expanduser('~/ego/pulse-casting-reel-20261104/flow/받기/')
OUT = os.path.join(SITE, 'video', 'wall'); os.makedirs(OUT, exist_ok=True)
html = open(os.path.join(SITE, 'index.html'), encoding='utf8').read()
D = json.loads(re.search(r'<script type="application/json" id="data">(.*?)</script>', html, re.S).group(1))
by = {m['code']: m for m in D['models']}
WALK = {'M07': ['m07walkV'], 'F02': ['f02walkV'], 'F10': ['f10walk'], 'F08': ['f08walk']}  # 새봄 댄스(Veo Fast)는 손이 번지고 옷이 바뀌어, 지온 점프(Omni)는 넘어질 듯해 뺐다
LABEL = {'m07walkV': '워킹', 'f02walkV': '워킹', 'f10walk': '워킹', 'f10danceF': '댄스', 'f08walk': '워킹', 'm10jump': '무브'}
# 벽은 사람마다 다른 세계로 — 옆 칸과 색 · 장소가 겹치지 않게 손으로 줄 세운다. 첫 화면은 하린(양옆도 걷는다)
ORDER = ['F05', 'M02', 'F11', 'M05', 'F06', 'M04', 'F04', 'M03', 'F07', 'M07', 'F02', 'F08', 'F10', 'M10', 'F09', 'M08', 'F01', 'M06', 'F03', 'M09', 'M01']
codes = [c for c in ORDER if c in by] + [m['code'] for m in D['models'] if m['code'] not in ORDER]
def tall(src):
    with Image.open(os.path.join(SITE, src)) as im:
        return im.height / im.width >= 1.25
def fit(m, n=3):
    return ', '.join(x.split('(')[0].strip() for x in (m.get('fits') or [])[:n])
items = []
for code in codes:
    m = by[code]
    reel = []
    poster = None
    for name in WALK.get(code, []):
        src = RAW + name + '_a.mp4'
        if not os.path.exists(src):
            continue
        dst = os.path.join(OUT, name + '.mp4'); first = os.path.join(OUT, name + '.webp')
        if not os.path.exists(dst):
            subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', src, '-an', '-c:v', 'libx264', '-crf', '21', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', dst], check=True)
        if not os.path.exists(first) or name == 'm10jump':  # 지온은 점프 중간에 멈춰 보이지 않게 끝 자세를 세운다
            pos = ['-sseof', '-0.2'] if name == 'm10jump' else []
            subprocess.run(['ffmpeg', '-y', '-v', 'error', *pos, '-i', src, '-frames:v', '1', '-q:v', '82', first], check=True)
        reel.append({'kind': 'video', 'label': LABEL[name], 'src': f'video/wall/{name}.mp4', 'hold': 500})
        poster = poster or f'video/wall/{name}.webp'
    scenes = m.get('scenes') or []
    ad = [s for s in scenes if not s.get('concept') and not re.search('근접|위에서|침실|욕실', s['label'] + s['place'])]
    pick = next((s for s in scenes if not s.get('concept') and tall(s['l'])), None)  # 벽에 세우는 그림: 그 사람의 세로 장면 → 없으면 광고 상황 컷
    if poster is None:
        poster = (pick or {}).get('l') or m['shots']['context']['l']
        reel.append({'kind': 'image', 'label': '장면', 'src': poster, 'dur': 2600})  # 칸이 열리면 벽에 있던 그 그림에서 시작한다
    if m.get('loop'):
        reel.append({'kind': 'video', 'label': '표정', 'src': m['loop']['src'], 'hold': 200})
    shot = next((s['l'] for s in ad if s['l'] != poster), None)
    if not shot:
        shot = (m['shots'].get('look-2') or m['shots'].get('look-1') or m['hero'])['l'] if m['shots']['context']['l'] == poster else m['shots']['context']['l']
    reel.append({'kind': 'image', 'label': '광고 장면', 'src': shot, 'dur': 3200})
    meta = [' · '.join(x for x in [m.get('height') and f"{m['height']}cm", m.get('age') or m.get('ageBand'), m.get('concept')] if x)]
    if fit(m):
        meta.append(fit(m))
    items.append({'code': code, 'name': m['name'], 'poster': poster, 'reel': reel, 'meta': meta})
page = open(os.path.join(HERE, 'proto3.html'), encoding='utf8').read().replace('@@DATA@@', json.dumps(items, ensure_ascii=False).replace('<', '\\u003c'))
open(os.path.join(SITE, 'proto-wall.html'), 'w', encoding='utf8').write(page)
print('모델', len(items), '영상', sum(1 for m in items if any('wall' in r.get('src', '') for r in m['reel'])))
for m in items:
    print(m['code'], m['name'], [r['label'] for r in m['reel']], m['poster'][-32:])
