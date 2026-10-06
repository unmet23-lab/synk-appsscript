# 따로 읽힌 테이크 여러 개를 문단 경계의 쉼에서 이어 하나로 만든다.
# 10-05 끝 문단, 10-06 첫 문단을 새로 쓰면서 유호님이 「다 좋은데」라고 한 가운데(1번 목소리 테이크)는 그대로 두려고 만들었다.
# 조각마다 「다듬은 테이크 폴더:첫 대사-끝 대사」. 모두 테이크_다듬기.py를 거친 판(48kHz, 같은 크기)이어야 한다.
# 쉼은 앞 조각의 말끝부터 뒤 조각의 첫 말소리까지 --pause초(기본 0.45), 경계마다 --pause-at s0=0.59처럼 바꾼다.
# 실행(음성 폴더에서):
#   python 테이크_잇기.py 후보/다듬기/Charon_open_1:h1-p2 후보/다듬기/Charon:s0-i2 후보/다듬기/Charon_end_1:c1-c5 --pause-at s0=0.59  → take/take.wav·take.json
import json, os, sys
import numpy as np
from scipy.io import wavfile

sys.stdout.reconfigure(encoding='utf-8')
here = os.path.dirname(os.path.abspath(__file__))
plan = json.load(open(os.path.join(here, 'voice-plan.json'), encoding='utf-8'))
argv = sys.argv[1:]
opt = lambda k, d=None: argv[argv.index(k) + 1] if k in argv else d
PAUSE = float(opt('--pause', 0.45))
pause_at = dict((kv.split('=')[0], float(kv.split('=')[1])) for kv in (opt('--pause-at', '') or '').split(',') if kv)
specs = [a for i, a in enumerate(argv) if ':' in a and (i == 0 or argv[i - 1] not in ('--pause', '--pause-at'))]
ids = [s['id'] for s in plan['segments']]

parts = []
for spec in specs:
    d, rng = spec.rsplit(':', 1)
    first, last = rng.split('-')
    T = json.load(open(os.path.join(here, d, 'take.json'), encoding='utf-8'))
    sr, x = wavfile.read(os.path.join(here, d, 'take.wav'))
    span = ids[ids.index(first):ids.index(last) + 1]
    miss = [i for i in span if i not in T['segs']]
    if miss: raise SystemExit(f'{d}에 없는 대사: {",".join(miss)}')
    parts.append({'dir': d, 'take': T, 'sr': sr, 'x': x.astype(np.float32), 'span': span})
covered = [i for p in parts for i in p['span']]
if covered != ids: raise SystemExit('조각들이 대본 대사를 순서대로 빠짐없이 덮지 않는다: ' + ','.join(covered))
if len({p['sr'] for p in parts}) != 1: raise SystemExit('조각의 표본율이 다르다 — 모두 테이크_다듬기.py를 거친다')
sr = parts[0]['sr']

out, segs, joins = np.zeros(0, np.float32), {}, []
for k, p in enumerate(parts):
    S = p['take']['segs']
    start = 0.0 if k == 0 else max(0.0, S[p['span'][0]]['start'] - 0.05)           # 첫 말소리 0.05초 앞(조용한 곳)
    end = len(p['x']) / sr if k == len(parts) - 1 else S[p['span'][-1]]['end'] + 0.04  # 말끝 0.04초 뒤
    piece = p['x'][int(start * sr):int(end * sr)].copy()
    f = int(0.01 * sr)
    if k > 0: piece[:f // 2] *= np.linspace(0, 1, f // 2)
    if k < len(parts) - 1: piece[-f:] *= np.linspace(1, 0, f)
    if k > 0:
        want = pause_at.get(p['span'][0], PAUSE)
        gap = max(0.0, want - 0.04 - 0.05)
        out = np.concatenate([out, np.zeros(int(gap * sr), np.float32)])
        joins.append({'before': p['span'][0], 'pause_s': want})
    offset = len(out) / sr - start
    out = np.concatenate([out, piece])
    for i in p['span']:
        g = S[i]
        segs[i] = {'start': round(g['start'] + offset, 3), 'end': round(g['end'] + offset, 3), 'tokens': [round(t + offset, 3) for t in g['tokens']]}

os.makedirs(os.path.join(here, 'take'), exist_ok=True)
wavfile.write(os.path.join(here, 'take', 'take.wav'), sr, np.clip(out, -32768, 32767).astype(np.int16))
A = parts[0]['take']
info = {k: A[k] for k in ('engine', 'model', 'voice') if k in A}
info.update({'seconds': round(len(out) / sr, 3), 'rate': sr,
             'joined': [{'source': p['take'].get('source'), 'dir': p['dir'], 'from': p['span'][0], 'to': p['span'][-1], 'loudness': p['take'].get('loudness')} for p in parts],
             'pauses': joins, 'segs': segs})
json.dump(info, open(os.path.join(here, 'take', 'take.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f"take/take.wav {info['seconds']}초 = " + ' + '.join(f"{p['take'].get('source')} {p['span'][0]}~{p['span'][-1]}" for p in parts) + ' · 쉼 ' + ', '.join(f"{j['before']} 앞 {j['pause_s']}초" for j in joins))
