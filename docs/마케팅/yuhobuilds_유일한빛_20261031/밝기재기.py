# 받은 그림의 밝기를 잰다: python 밝기재기.py  → 자료/밝기.json
# 실화 창고의 셈과 같다 — 그림을 작게 줄여 회색으로 바꾼 뒤 중앙값(0~255). 평균 · 95분위도 함께 적는다.
import json, os, sys
from PIL import Image
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
PAN = os.path.join(HERE, '판')
장면 = {
    '인물': ['시작_인물_154359.png', '인물_어둡게.png', '인물_그냥어둡게.png', '인물_밤처럼.png', '인물_빛.png'],
    '거실': ['시작_거실_154359.png', '거실_어둡게.png', '거실_밤처럼.png', '거실_빛.png'],
    '카페': ['시작_카페_154359_1.png', '카페_어둡게.png', '카페_빛.png'],
    '텐트': ['시작_텐트_171006.png', '텐트_빛.png'],
    '자동차': ['시작_자동차_171006.png', '자동차_밤처럼.png', '자동차_빛.png'],
    '꽃집': ['시작_꽃집_171006.png', '꽃집_빛.png'],
}
out = {}
for 이름, 판들 in 장면.items():
    out[이름] = {}
    for f in 판들:
        p = os.path.join(PAN, f)
        if not os.path.exists(p) or os.path.getsize(p) < 100000:
            continue
        a = np.asarray(Image.open(p).convert('L').resize((540, 960)), dtype=float)
        out[이름][f] = {'중앙값': round(float(np.median(a))), '평균': round(float(a.mean())), '95분위': round(float(np.percentile(a, 95)))}
json.dump(out, open(os.path.join(HERE, '자료', '밝기.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
sys.stdout.reconfigure(encoding='utf-8')
print(json.dumps(out, ensure_ascii=False))
