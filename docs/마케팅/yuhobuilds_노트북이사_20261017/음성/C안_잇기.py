# 훅 C(유튜브)용 목소리: A 테이크(take/take.wav)의 첫 대사 h1 자리에 같은 목소리로 따로 읽힌 h1c를 끼운다.
# 둘째 대사 s1부터는 A와 한 표본도 다르지 않게 둔다 → 영상의 모든 장면·자막 시각을 A·C가 같이 쓴다(h1 자막만 VO.variants.h1c).
# h1c가 h1보다 짧으면 s1 앞 쉼이 그만큼 길어진다(훅 뒤 한 박자). 길면 멈춘다.
# 실행(음성 폴더에서): python C안_잇기.py 후보/3.8-flash__Achird_h1c_2.wav   → take/take_C.wav·take_C.json
import json, os, subprocess, sys
import numpy as np
from scipy.io import wavfile
from scipy.signal import resample_poly

sys.stdout.reconfigure(encoding='utf-8')
here = os.path.dirname(os.path.abspath(__file__))
src = sys.argv[1]
A = json.load(open(os.path.join(here, 'take', 'take.json'), encoding='utf-8'))
sr, a = wavfile.read(os.path.join(here, 'take', 'take.wav'))
a = a.astype(np.float32)
al = json.load(open(src[:-4] + '.align.json', encoding='utf-8'))
g = al['segs']['h1c']
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

# 크기: h1 말소리 구간의 RMS에 맞춘다(같은 목소리·같은 다듬기라 LUFS 대신 RMS로 충분)
rms = lambda x: float(np.sqrt(np.mean(x ** 2) + 1e-12))
ref = a[int(h1['start'] * sr):int(h1['end'] * sr)]
piece *= rms(ref) / rms(piece[f:-f])
peak = float(np.abs(piece).max())
if peak > 32000: piece *= 32000 / peak

place = h1['start'] - (g['start'] - cut0)   # 첫 말소리를 A의 첫 말소리 자리에
room = s1['start'] - 0.05                    # s1 첫 말소리 0.05초 앞까지는 C의 자리
if place + len(piece) / sr > room:
    raise SystemExit(f'h1c가 h1 자리보다 길다: {place + len(piece) / sr:.2f} > {room:.2f}')
c = a.copy()
c[:int(room * sr)] = 0
i0 = int(place * sr)
c[i0:i0 + len(piece)] = piece
wavfile.write(os.path.join(here, 'take', 'take_C.wav'), sr, np.clip(c, -32768, 32767).astype(np.int16))
off = place - cut0
info = {'source': os.path.basename(src), 'replaces': 'h1', 'seconds': round(len(c) / sr, 3),
        'segs': {'h1c': {'start': round(g['start'] + off, 3), 'end': round(g['end'] + off, 3), 'tokens': [round(t + off, 3) for t in g['tokens']]}},
        'gap_before_s1': round(s1['start'] - (g['end'] + off), 3)}
json.dump(info, open(os.path.join(here, 'take', 'take_C.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f"take/take_C.wav {info['seconds']}초 · h1c {info['segs']['h1c']['start']}~{info['segs']['h1c']['end']} · s1 앞 쉼 {info['gap_before_s1']}초")
