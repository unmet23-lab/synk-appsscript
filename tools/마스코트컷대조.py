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

try:                                     # 투구 축에만 쓴다 — 없으면 그 축만 「안 쟀다」로 빠진다
    from scipy.ndimage import binary_closing, binary_fill_holes
    _채움있음 = True
except ImportError:                      # pragma: no cover
    _채움있음 = False

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
# ── 투구 축 (마린만) ──────────────────────────────────────────────────────────
# 🔴 09-08 에 이 축이 «없어서» 트랙이 여덟 시간 동안 틀린 숫자를 들고 있었다.
#    인사 컷을 「투구 상자 높이 ÷ 몸 상자 높이」로 재니 본체 0.605 → 인사 0.672 = +11.0% 가 나왔고,
#    그것이 「투구가 커졌다」로 읽혀 유호님께 갈래 셋이 올라가 있었다. 실제로는 «30도 숙인 것»이다 —
#    기울이면 상자는 원래 커진다(대각선이 상자를 밀어낸다).
#    ⇒ 가르는 자는 «겉넓이»다. 기울여도 넓이는 안 변하고, 진짜 커지면 넓이가 같이 큰다.
#    구멍(노란 렌즈)은 반드시 메운다 — 표정마다 렌즈가 달라 안 메우면 넓이가 ±8% 흔들린다.
투구자 = {
    '마린': lambda r, g, b, l: (b - r > 25) & (b > 45) & (b < 190),      # 남색 펠트 투구
}


def 투구재기(name, m, r, g, b, lum):
    """투구의 «겉넓이»와 «상자»를 함께 낸다 — 둘이 갈리면 커진 게 아니라 기울어진 것이다."""
    if name not in 투구자 or not _채움있음:
        return None
    h = m & 투구자[name](r, g, b, lum)
    if not h.any():
        return None
    h = binary_fill_holes(binary_closing(h, np.ones((15, 15))))
    ys, xs = np.where(h)
    return dict(넓이=int(h.sum()),
                상자=[int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)],
                아래끝=int(ys.max()))


# 몸이 달라지는 게 «맞는» 컷은 흔들림 판정에서 뺀다 — 옆으로 돈 것과 «몸짓» 컷.
# 🔴 09-08 에 인사를 더했다. 인사는 숙이는 동작이라 몸 높이가 본체보다 짧은 게 정상인데,
#    정면 무리에 섞여 있어서 마린 흔들림이 2.0% 로 잡혔다(다른 컷은 전부 0.0%).
비스듬 = {'좌34', '우34', '인사'}


def 재기(name, cut):
    a = np.asarray(Image.open(os.path.join(SRC, f'{name}_{cut}.png')).convert('RGBA'))
    m = a[..., 3] > 128
    r, g, b = (a[..., i].astype(int) for i in range(3))
    lum = .2126 * r + .7152 * g + .0722 * b
    ys, xs = np.where(m)
    x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())
    bw, bh = x1 - x0 + 1, y1 - y0 + 1
    rec = dict(컷=cut, 몸=[bw, bh], 가로세로비=round(bw / bh, 3))
    투 = 투구재기(name, m, r, g, b, lum)
    if 투:
        rec['투구'] = 투

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

        # 투구 — 「넓이」와 「상자」를 나란히 낸다. 넓이는 그대로인데 상자만 크면 «기울었다»는 뜻이다.
        투구축 = None
        if '투구' in base:
            잰것 = [x for x in recs if '투구' in x]
            def 투구줄(x):
                넓 = 100 * (x['투구']['넓이'] / base['투구']['넓이'] - 1)
                상자비 = x['투구']['상자'][1] / x['몸'][1]
                기준비 = base['투구']['상자'][1] / base['몸'][1]
                return dict(컷=x['컷'], 넓이_본체대비=round(넓, 1),
                            상자높이_몸높이대비=round(상자비, 4),
                            그_본체대비=round(100 * (상자비 / 기준비 - 1), 1))
            줄들 = [투구줄(x) for x in 잰것]
            투구축 = dict(
                본체넓이=base['투구']['넓이'],
                넓이_본체대비=dict(최소=min(x['넓이_본체대비'] for x in 줄들),
                              최대=max(x['넓이_본체대비'] for x in 줄들)),
                컷별=줄들,
                읽는법='넓이는 그대로인데 상자만 커진 컷 = «커진» 것이 아니라 «기울어진» 것이다')

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
            투구=투구축,
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
        print(f"   따로 보는 컷: " + ' · '.join(f"{x['컷']} 정면의 {x['정면대비']}배" for x in v['옆으로돈컷']))
        if v.get('투구'):
            t = v['투구']
            print(f"   투구 — 겉넓이가 본체와 {t['넓이_본체대비']['최소']}~{t['넓이_본체대비']['최대']}% 차이")
            튀 = [x for x in t['컷별'] if abs(x['그_본체대비']) >= 3 or abs(x['넓이_본체대비']) >= 3]
            for x in 튀:
                상, 넓 = x['그_본체대비'], x['넓이_본체대비']
                if abs(상) >= 3 and abs(넓) < abs(상) / 1.5:
                    말 = '기울었다 — 상자만 커졌고 겉넓이는 따라오지 않았다'
                elif abs(넓) >= 3 and abs(상) < 3:
                    말 = ('돌아서 좁아졌다' if 넓 < 0 else '상자는 그대로인데 넓이만 늘었다')
                else:
                    말 = '둘이 같이 움직였다 — 투구 크기가 진짜 다르다'
                print(f"      {x['컷']:<6} 상자 {상:+.1f}% · 겉넓이 {넓:+.1f}%  → {말}")
            if not 튀:
                print("      전부 본체와 3% 안 — 투구는 갈리지 않았다")
        if v['눈못잰컷']:
            print(f"   눈 못 잰 컷: {' · '.join(v['눈못잰컷'])}")
