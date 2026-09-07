# -*- coding: utf-8 -*-
"""마스코트 컷 대조 — 표정 컷 «전량»이 본체와 같은 몸·같은 눈을 지키는가.

  왜 있나  : 치수 정본(docs/캐릭터/마스코트_치수_정본_v1.md)은 «본체» 컷 하나에서 나왔다.
             표정이 바뀌어도 몸과 눈이 그대로여야 같은 아이인데, 그것은 «재봐야» 안다.
  쓰는 법  : python tools/마스코트컷대조.py           → 표 (사람이 읽는 꼴)
             python tools/마스코트컷대조.py --json    → 숫자 (기계가 읽는 꼴)

  자       : 몸 = 투명도 128 초과 · 눈 = 치수재기와 «같은 자»(tools/마스코트치수재기.py 의 EYE_KEY).
             눈은 «가장 큰 덩어리 둘»로 잡는다(8배 줄여 훑는다). 🔴 좌우로만 가르면 흩어진 화소 몇 개에
             가운데가 밀려 한쪽이 통째로 사라진다(09-08 에 이 파일에서 밟았다).
  🔴 눈을 감은 컷(눈감음·눈웃음·윙크 …)은 눈이 안 보이거나 하나만 보인다. 「못 잼」으로 적지 «0» 으로 적지 않는다.
"""
import importlib.util, io, json, os, sys
import numpy as np
from PIL import Image

# 눈을 찾는 자와 «덩어리 묶기»는 치수재기 것을 그대로 빌린다 — 두 곳이 다른 자를 쓰면 값이 갈린다
_spec = importlib.util.spec_from_file_location(
    '치수재기', os.path.join(os.path.dirname(os.path.abspath(__file__)), '마스코트치수재기.py'))
_치수재기 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_치수재기)
_blobs = _치수재기._blobs
SRC = os.path.join('docs', '캐릭터', '정본_4K')
NAMES = ['몽글', '까몽', '마린']
EYE_KEY = {
    '몽글': lambda r, g, b, l: (l < 70) & ((r - g) < 40),
    '까몽': lambda r, g, b, l: (g > r) & (g > b) & (l > 30),
    '마린': lambda r, g, b, l: (r > 150) & (g > 120) & ((r - b) > 70),
}
# 옆으로 돌아선 컷은 몸 폭이 달라지는 게 «맞다» — 흔들림 판정에서 뺀다
비스듬 = {'좌34', '우34'}


def 재기(name, cut):
    a = np.asarray(Image.open(os.path.join(SRC, f'{name}_{cut}.png')).convert('RGBA'))
    m = a[..., 3] > 128
    r, g, b = (a[..., i].astype(int) for i in range(3))
    lum = .2126 * r + .7152 * g + .0722 * b
    ys, xs = np.where(m)
    x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())
    bw, bh = x1 - x0 + 1, y1 - y0 + 1
    rec = dict(컷=cut, 몸=[bw, bh], 가로세로비=round(bw / bh, 3))

    key = m & EYE_KEY[name](r, g, b, lum)
    key[y0 + int(bh * .7):] = False
    cs = _blobs(key[::8, ::8], 40)[:2]      # 🔴 좌우로만 가르면 흩어진 화소에 중심이 밀린다
    if len(cs) < 2:
        rec['눈'] = '못 잼' if not cs else '한쪽만 보인다'
        return rec
    for c in cs:
        for k in ('x0', 'x1', 'y0', 'y1'):
            c[k] *= 8
        c['cx'] *= 8
        c['cy'] *= 8
    L, R = sorted(cs, key=lambda d: d['cx'])
    wL, wR = L['x1'] - L['x0'] + 1, R['x1'] - R['x0'] + 1
    ew = (wL + wR) / 2
    span = R['cx'] - L['cx']
    rec['눈'] = dict(폭_몸폭대비=round(ew / bw, 3),
                    사이_몸폭대비=round(span / bw, 3),
                    틈_눈폭배수=round((R['x0'] - L['x1']) / ew, 2),
                    눈높이_위에서=round(((L['cy'] + R['cy']) / 2 - y0) / bh, 3),
                    좌우_폭차이=round(100 * abs(wL - wR) / max(wL, wR), 1))
    return rec


def main():
    컷들 = {}
    for f in sorted(os.listdir(SRC)):
        if not f.endswith('.png'):
            continue
        n, cut = f[:-4].split('_', 1)
        컷들.setdefault(n, []).append(cut)

    rep = {}
    for name in NAMES:
        base = 재기(name, '본체')
        recs = [재기(name, c) for c in 컷들[name]]
        정면 = [x for x in recs if x['컷'] not in 비스듬]
        폭 = [x['몸'][0] for x in 정면]
        높 = [x['몸'][1] for x in 정면]
        눈있 = [x for x in 정면 if isinstance(x['눈'], dict)]
        def 폭차(키):
            v = [x['눈'][키] for x in 눈있]
            return dict(최소=min(v), 최대=max(v), 본체=base['눈'][키] if isinstance(base['눈'], dict) else None,
                        흔들림=round(100 * (max(v) - min(v)) / max(abs(max(v)), 1e-9), 1))
        옆 = [x for x in recs if x['컷'] in 비스듬]
        rep[name] = dict(
            컷수=len(recs), 정면컷수=len(정면), 눈잰컷수=len(눈있),
            몸폭=dict(최소=min(폭), 최대=max(폭), 흔들림=round(100 * (max(폭) - min(폭)) / max(폭), 2)),
            몸높이=dict(최소=min(높), 최대=max(높), 흔들림=round(100 * (max(높) - min(높)) / max(높), 2)),
            눈폭_몸폭대비=폭차('폭_몸폭대비'),
            눈사이_몸폭대비=폭차('사이_몸폭대비'),
            눈높이_위에서=폭차('눈높이_위에서'),
            좌우_폭차이_최대=max(x['눈']['좌우_폭차이'] for x in 눈있),
            옆으로돈컷=[dict(컷=x['컷'], 몸폭=x['몸'][0],
                        정면대비=round(x['몸'][0] / base['몸'][0], 3)) for x in 옆],
            눈못잰컷=[x['컷'] for x in recs if not isinstance(x['눈'], dict)],
            컷별=recs)
    return rep


if __name__ == '__main__':
    rep = main()
    if '--json' in sys.argv:
        sys.stdout.write(json.dumps(rep, ensure_ascii=False, indent=1))
        raise SystemExit
    for n, v in rep.items():
        print(f"\n■ {n} — 컷 {v['컷수']}벌(정면 {v['정면컷수']} · 눈 잰 것 {v['눈잰컷수']})")
        print(f"   몸 폭   {v['몸폭']['최소']}~{v['몸폭']['최대']} 화소 · 흔들림 {v['몸폭']['흔들림']}%")
        print(f"   몸 높이 {v['몸높이']['최소']}~{v['몸높이']['최대']} 화소 · 흔들림 {v['몸높이']['흔들림']}%")
        for 키 in ('눈폭_몸폭대비', '눈사이_몸폭대비', '눈높이_위에서'):
            d = v[키]
            print(f"   {키:<16} {d['최소']}~{d['최대']} (본체 {d['본체']}) · 흔들림 {d['흔들림']}%")
        print(f"   좌우 폭차이 가장 큰 컷 {v['좌우_폭차이_최대']}%")
        print(f"   옆으로 돈 컷: " + ' · '.join(f"{x['컷']} 정면의 {x['정면대비']}배" for x in v['옆으로돈컷']))
        if v['눈못잰컷']:
            print(f"   눈 못 잰 컷: {' · '.join(v['눈못잰컷'])}")
