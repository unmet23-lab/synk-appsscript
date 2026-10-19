# 훅 E(유튜브)용 목소리: A 테이크(take/take.wav)의 첫 대사 h1을 같은 목소리로 따로 읽힌 h1e로 바꾼다.
# 노트북 이사 편 C안_잇기.py와 달리 h1e가 h1보다 길다 → h1e를 h1 자리에 놓고, s1부터는 A를 그대로 붙이되 그 차이(shift)만큼 뒤로 민다.
# h1e 끝과 s1 사이 쉼은 A의 h1 끝과 s1 사이 쉼과 같게 둔다. s1부터의 장면·자막 시각은 A 시각 + shift.
# 크기는 A의 h1 말소리 구간 RMS에 맞춘다(같은 목소리·같은 다듬기 뒤라 LUFS 대신 RMS로 충분).
# 실행(음성 폴더에서): python E안_잇기.py 후보/3.8-flash__Achird_h1e_3.wav   → take/take_E.wav·take_E.json
import json, os, sys
import numpy as np
from scipy.io import wavfile
from scipy.signal import resample_poly

sys.stdout.reconfigure(encoding='utf-8')
here = os.path.dirname(os.path.abspath(__file__))
src = sys.argv[1]
A = json.load(open(os.path.join(here, 'take', 'take.json'), encoding='utf-8'))
sr, a = wavfile.read(os.path.join(here, 'take', 'take.wav'))
a = a.astype(np.float32)
if a.ndim > 1: a = a.mean(1)
al = json.load(open(src[:-4] + '.align.json', encoding='utf-8'))
g = al['segs']['h1e']
r0, b = wavfile.read(src)
b = b.astype(np.float32)
if b.ndim > 1: b = b.mean(1)
if r0 != sr:
    b = resample_poly(b, sr, r0).astype(np.float32)

h1, s1 = A['segs']['h1'], A['segs']['s1']
cut0, cut1 = max(0.0, g['start'] - 0.04), g['end'] + 0.06
piece = b[int(cut0 * sr):int(cut1 * sr)].copy()
f = int(0.008 * sr)
piece[:f] *= np.linspace(0, 1, f)
piece[-f:] *= np.linspace(1, 0, f)

rms = lambda x: float(np.sqrt(np.mean(x ** 2) + 1e-12))
ref = a[int(h1['start'] * sr):int(h1['end'] * sr)]
piece *= rms(ref) / rms(piece[f:-f])
peak = float(np.abs(piece).max())
if peak > 32000: piece *= 32000 / peak

gap = s1['start'] - h1['end']                       # A의 h1 끝 → s1 첫 말소리 쉼
dur_e = g['end'] - g['start']
shift = dur_e - (h1['end'] - h1['start'])           # s1부터 뒤로 미는 양(초)
place = h1['start'] - (g['start'] - cut0)           # h1e 첫 말소리를 A의 h1 첫 말소리 자리에
cont_from = s1['start'] - 0.05                      # A에서 이어 붙일 곳(s1 첫 말소리 0.05초 앞)
cont_at = h1['start'] + dur_e + gap - 0.05          # E에서 그 부분이 놓일 곳
piece_end = place + len(piece) / sr
if cont_at < piece_end:
    raise SystemExit(f'h1e 뒤 쉼이 모자란다: 이어 붙일 곳 {cont_at:.2f} < h1e 끝 {piece_end:.2f}')

head = a[:int(place * sr)].copy()
head[int(h1['start'] * sr) - int(0.06 * sr):] = 0   # A의 h1 말소리가 새지 않게
silence = np.zeros(int(cont_at * sr) - int(place * sr) - len(piece), dtype=np.float32)
tail = a[int(cont_from * sr):]
e = np.concatenate([head, piece, silence, tail])
wavfile.write(os.path.join(here, 'take', 'take_E.wav'), sr, np.clip(e, -32768, 32767).astype(np.int16))
off = place - cut0
info = {'source': os.path.basename(src), 'replaces': 'h1', 'seconds': round(len(e) / sr, 3), 'shift_from_s1': round(shift, 3),
        'segs': {'h1e': {'start': round(g['start'] + off, 3), 'end': round(g['end'] + off, 3), 'tokens': [round(t + off, 3) for t in g.get('tokens', [])]}},
        'gap_before_s1': round(gap, 3)}
json.dump(info, open(os.path.join(here, 'take', 'take_E.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f"take/take_E.wav {info['seconds']}초 · h1e {info['segs']['h1e']['start']}~{info['segs']['h1e']['end']} · s1부터 {info['shift_from_s1']:+.3f}초 · h1e 뒤 쉼 {info['gap_before_s1']}초")
