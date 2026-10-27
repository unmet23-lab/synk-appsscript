# 녹화 원본(저장소 밖 C:/Users/q1212/ego/synkbrief-b10-20261027/)에서 영상에 쓸 프레임만 잘라 이 폴더에 둔다.
#   python -X utf8 화면/고르기.py
# G = ChatGPT(U1 라운드, 1080×5526 휴대폰 폭 화면): 입력 칸(아래쪽) · 생성 중(위쪽) · 다 쓴 답(위쪽 2700px).
# X = 엑셀(X3 라운드, 창 1600×1560): 수식 줄 아래 격자만(창 위 리본 · 알림 줄 · 계정 자리는 잘라 낸다) → 가로 1080.
import json
from pathlib import Path
from PIL import Image

SRC = Path('C:/Users/q1212/ego/synkbrief-b10-20261027')
HERE = Path(__file__).resolve().parent
G_TYPE = (0, 4700, 1080, 5526)  # 입력 칸 + 아래 「사본을 최대 30일간 보관」 줄
G_GEN = (0, 0, 1080, 1500)  # 보낸 말풍선 + 답 앞부분(빨리 감기)
G_ALL = (0, 0, 1080, 3300)  # 다 쓴 답: 말풍선 ~ D2 수식 칸 ~ 「호환성: Excel 2007 …」 줄
X_BOX = (12, 328, 1530, 1394)  # 이름 칸 · 수식 줄 · 열 머리 · 1~9행

def save(im, path, q=92):
    path.parent.mkdir(parents=True, exist_ok=True)
    im.convert('RGB').save(path, quality=q)

meta = {'G': {'rows': []}, 'X': {'rows': []}}
log = json.loads((SRC / 'U1/log.json').read_text(encoding='utf-8'))['log']
gen_i = 0
for r in log:
    f = r.get('f')
    if not f:
        meta['G']['rows'].append({'tag': r['tag'], 'ms': r['ms']})
        continue
    im = Image.open(SRC / 'U1' / f)
    if r['tag'] in ('empty', 'type', 'typed'):
        out = f't{r["n"]:03d}.jpg'
        save(im.crop(G_TYPE), HERE / 'G' / out)
    elif r['tag'] == 'gen':
        gen_i += 1
        if gen_i % 2 == 0 and gen_i < 18:
            continue  # 빨리 감기에는 두 장에 하나면 된다(끝 둘은 남김)
        out = f'g{r["n"]:03d}.jpg'
        save(im.crop(G_GEN), HERE / 'G' / out)
    elif r['tag'] == 'final':
        out = '전체.jpg'
        save(im.crop(G_ALL), HERE / 'G' / out, 93)
    else:
        continue
    meta['G']['rows'].append({'f': out, 'ms': r['ms'], 'tag': r['tag']})

xs = json.loads((SRC / 'X3/log.json').read_text(encoding='utf-8-sig'))
for r in xs:
    im = Image.open(SRC / 'X3' / r['f']).crop(X_BOX)
    w, h = im.size
    im = im.resize((1080, round(h * 1080 / w)), Image.LANCZOS)
    out = f'x{r["n"]:02d}.jpg'
    save(im, HERE / 'X' / out, 93)
    meta['X']['rows'].append({'f': out, 'tag': r['tag']})
    meta['X']['size'] = list(im.size)
meta['G']['crop'] = {'type': G_TYPE, 'gen': G_GEN, 'all': G_ALL}
meta['X']['crop'] = X_BOX
(HERE / '프레임.json').write_text(json.dumps(meta, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
print({k: len(v['rows']) for k, v in meta.items()}, meta['X'].get('size'))
