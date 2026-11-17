# sweep.cjs 결과로 단추 첫 화면 안 · 글끼리 겹침 · 가로 넘침 · 제목 세 줄 · 제목 크기 전후를 센다(견줄 결과를 주면 제목 크기 차이도)
import json, sys, collections
def boxes(r):
    out = []
    for k, v in r['parts'].items():
        for b in v: out.append((k, b))
    return out
def check(path, base=None):
    R = json.load(open(path)); B = {}
    if base:
        for r in json.load(open(base)): B[(tuple(r['vp']), r['page'])] = r
    bad = collections.Counter(); ex = collections.defaultdict(list); shrink = []
    for r in R:
        key = (tuple(r['vp']), r['page']); w, h = r['vp']
        cta = r['parts']['cta']
        if cta and cta[0]['y'] + cta[0]['h'] > r['innerH'] + 0.5 and r['innerH'] < r['hall']['h'] + 1:
            bad['단추 첫 화면 밖'] += 1; ex['단추 첫 화면 밖'].append(key)
        if r['scrollW'] > r['innerW']: bad['가로 넘침'] += 1; ex['가로 넘침'].append(key)
        if r['titleLines'] != 3: bad['제목 세 줄 아님'] += 1; ex['제목 세 줄 아님'].append((key, r['titleLines']))
        # 글끼리(다른 부분) 겹침 — 첫 화면 안
        bx = [(k, b) for k, b in boxes(r) if b['y'] < r['innerH']]
        for i in range(len(bx)):
            for j in range(i + 1, len(bx)):
                (k1, a), (k2, b) = bx[i], bx[j]
                if k1 == k2: continue
                ix = min(a['x'] + a['w'], b['x'] + b['w']) - max(a['x'], b['x']); iy = min(a['y'] + a['h'], b['y'] + b['h']) - max(a['y'], b['y'])
                if ix > 1 and iy > 1 and not ({k1, k2} <= {'label', 'title'} and iy < 12):
                    bad['글끼리 겹침'] += 1; ex['글끼리 겹침'].append((key, k1, k2, round(ix), round(iy))); break
        if key in B: shrink.append((round(r['h1px'] - B[key]['h1px'], 1), key, round(B[key]['h1px'], 1), round(r['h1px'], 1)))
    print(path, len(R), dict(bad))
    for k, v in ex.items(): print('  ', k, v[:8])
    if shrink:
        sh = sorted(shrink)
        d = [x[0] for x in sh]
        print('   제목 크기 변화: 준 크기', sum(1 for x in d if x < -0.5), '/ 는 크기', sum(1 for x in d if x > 0.5), '/ 그대로', sum(1 for x in d if abs(x) <= 0.5))
        print('   가장 많이 준 것', sh[:6])
        print('   가장 많이 는 것', sh[-4:])
if __name__ == '__main__':
    # python -X utf8 tools/pulse-hall-faces/checks.py <sweep 결과.json> [<견줄 sweep 결과.json>]
    check(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
