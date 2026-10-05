# 앞 테이크의 대사 ~<upto>와, 같은 목소리로 따로 읽힌 끝 문단을 문단 경계의 쉼에서 잇는다.
# 10-05 끝 문단을 새로 쓰면서, 유호님이 「다 좋은데」라고 한 앞부분(1번 목소리 테이크)은 그대로 두려고 만들었다.
# 둘 다 테이크_다듬기.py를 거친 판(48kHz, 같은 크기)이어야 한다. 쉼은 앞 말끝부터 뒤 첫 말소리까지 --pause초.
# 실행(음성 폴더에서): python 테이크_잇기.py 후보/다듬기/Charon 후보/다듬기/Charon_end_1 --upto i2 [--pause 0.45]  → take/take.wav·take.json
import json, os, sys
import numpy as np
from scipy.io import wavfile

sys.stdout.reconfigure(encoding='utf-8')
here = os.path.dirname(os.path.abspath(__file__))
plan = json.load(open(os.path.join(here, 'voice-plan.json'), encoding='utf-8'))
arg = lambda k, d=None: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
a_dir, b_dir = os.path.join(here, sys.argv[1]), os.path.join(here, sys.argv[2])
upto, PAUSE = arg('--upto'), float(arg('--pause', 0.45))
A = json.load(open(os.path.join(a_dir, 'take.json'), encoding='utf-8'))
B = json.load(open(os.path.join(b_dir, 'take.json'), encoding='utf-8'))
sr, xa = wavfile.read(os.path.join(a_dir, 'take.wav'))
srb, xb = wavfile.read(os.path.join(b_dir, 'take.wav'))
if sr != srb or xa.dtype != xb.dtype: raise SystemExit('두 테이크의 표본율·형식이 다르다 — 둘 다 테이크_다듬기.py를 거친다')

ids = [s['id'] for s in plan['segments']]
first, rest = ids[:ids.index(upto) + 1], ids[ids.index(upto) + 1:]
missing = [i for i in first if i not in A['segs']] + [i for i in rest if i not in B['segs']]
if missing: raise SystemExit('테이크에 없는 대사: ' + ','.join(missing))

cut = A['segs'][upto]['end'] + 0.04                      # 앞 말끝 바로 뒤(조용한 곳)에서 자른다
head = xa[:int(cut * sr)].astype(np.float32)
fade = int(0.01 * sr); head[-fade:] *= np.linspace(1, 0, fade)
gap = max(0.0, PAUSE - 0.04 - B['segs'][rest[0]]['start'])  # 끝 테이크 앞 무음까지 쳐서 모자란 쉼만 채운다
out = np.concatenate([head, np.zeros(int(gap * sr), np.float32), xb.astype(np.float32)])
offset = cut + gap

segs = {i: A['segs'][i] for i in first}
for i in rest:
    g = B['segs'][i]
    segs[i] = {'start': round(g['start'] + offset, 3), 'end': round(g['end'] + offset, 3), 'tokens': [round(t + offset, 3) for t in g['tokens']]}
os.makedirs(os.path.join(here, 'take'), exist_ok=True)
wavfile.write(os.path.join(here, 'take', 'take.wav'), sr, np.clip(out, -32768, 32767).astype(np.int16))
info = {k: A[k] for k in ('engine', 'model', 'voice') if k in A}
info.update({'seconds': round(len(out) / sr, 3), 'rate': sr,
             'joined': {'front': {'source': A.get('source'), 'upto': upto, 'cut_s': round(cut, 3), 'loudness': A.get('loudness')},
                        'end': {'source': B.get('source'), 'from': rest[0], 'offset_s': round(offset, 3), 'loudness': B.get('loudness')},
                        'pause_s': PAUSE},
             'segs': segs})
json.dump(info, open(os.path.join(here, 'take', 'take.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f"take/take.wav {info['seconds']}초 = 앞 {A.get('source')} ~{upto}({cut:.2f}초) + 쉼 {PAUSE}초 + 끝 {B.get('source')} {rest[0]}~{rest[-1]}")
