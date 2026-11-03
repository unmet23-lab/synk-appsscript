"""「haha → 하하」 칠판판 소리 -> mix.wav (48 kHz 스테레오, DUR초).
v7과 같은 목소리 파일(vo/) · 같은 배경음(bgm.wav)을 같은 비율(목소리 1 : 배경음 0.11)로 깔고, 연필 대신 분필 녹음 조각
(CC0 두 개, foley/lib)을 획마다 하나씩 놓는다. 실행: LIB 루트에서
    node core/render/events.mjs films/haha-chalk
    .venv/Scripts/python.exe films/haha-chalk/audio.py"""
import sys, os, json
HERE = os.path.dirname(os.path.abspath(__file__)); LIB = os.path.abspath(os.path.join(HERE, '../..'))
sys.path.insert(0, LIB)
import numpy as np, soundfile as sf, soxr
from core.audio.sfx import SR, add, limit, hp, lp, brown

rng = np.random.default_rng(7)
EV = json.load(open(os.path.join(HERE, 'events.json'), encoding='utf-8'))
DUR = EV['dur']; ev = EV['ev']; N = int(round(DUR * SR))
voice, fx, mus = (np.zeros((N, 2), np.float32) for _ in range(3))

def load(path):
    x, sr = sf.read(path, dtype='float32')
    if x.ndim > 1: x = x.mean(1)
    return soxr.resample(x, sr, SR) if sr != SR else x
def fade(x, a=.004, b=.03):
    n = len(x); a, b = min(int(a * SR), n // 2), min(int(b * SR), n // 2)
    x = x.copy(); x[:a] *= np.linspace(0, 1, a); x[n - b:] *= np.linspace(1, 0, b); return x

# 목소리: 파일 크기 그대로(나레이션굽기가 −17 LUFS로 맞춘 것), v7의 MASTER 0.8과 같은 값
for e in ev:
    if e['type'] == 'vo': add(voice, load(os.path.join(HERE, 'vo', e['id'] + '.wav')) * .8, e['t'], 1.0, 0)

# 분필: 녹음 조각을 획 길이만큼 이어 붙이고, 주황은 조금 둔하게
IDX = json.load(open(os.path.join(HERE, 'foley/lib/index.json'), encoding='utf-8'))
strokes = [g for g in IDX if g['kind'] == 'stroke']; taps = [g for g in IDX if g['kind'] == 'tap']
cache = {}
def grain(g):
    if g['file'] not in cache:
        x = load(os.path.join(HERE, 'foley/lib', g['file'])); cache[g['file']] = x / (np.abs(x).max() + 1e-9)
    return cache[g['file']]
def chalk(d, v, dull=False):
    out = np.zeros(int((d + .06) * SR), np.float32); pos = 0
    while pos < len(out) - int(.03 * SR):
        g = grain(strokes[rng.integers(len(strokes))]); n = min(len(g), len(out) - pos)
        out[pos:pos + n] += fade(g[:n], .006, .02); pos += max(int(.6 * n), int(.04 * SR))
    env = np.ones(len(out)); a = int(.012 * SR); env[:a] = np.linspace(.3, 1, a); env[-int(.05 * SR):] *= np.linspace(1, 0, int(.05 * SR))
    out = out * env
    out = lp(out, 3800) if dull else hp(out, 500)
    return (out * v).astype(np.float32)
for e in ev:
    if e['type'] != 'chalk': continue
    d = max(.04, e['d']); size = min(1.0, e['len'] / 700)
    v = (.10 + .26 * size) * (1.2 if e['big'] else .85)
    add(fx, chalk(d, v, e['color'] != 'white'), e['t'], 1.0, e['pan'])
    if d > .12 and rng.random() < .55:
        add(fx, fade(grain(taps[rng.integers(len(taps))]), .002, .03) * .3 * v, e['t'] - .005, 1.0, e['pan'])
room = lp(brown(DUR), 900) * .005; fx[:, 0] += room[:N]; fx[:, 1] += np.roll(room, 997)[:N]

# 배경음: v7과 같은 곡 · 같은 크기(0.11 × 0.8), 끝 1초에 줄임
b, sr = sf.read(os.path.join(HERE, 'bgm.wav'), dtype='float32')
if b.ndim == 1: b = np.stack([b, b], 1)
if sr != SR: b = soxr.resample(b, sr, SR)
b = b[:N]; mus[:len(b)] += b * .11 * .8
k = int(1.0 * SR); mus[N - k:] *= np.linspace(1, 0, k)[:, None]

mix = voice + fx * .9 + mus
mix = limit(mix, .95)
sf.write(os.path.join(HERE, 'mix.wav'), mix.astype(np.float32), SR, subtype='PCM_24')
print('mix.wav', DUR, 's  peak', float(np.abs(mix).max()))
