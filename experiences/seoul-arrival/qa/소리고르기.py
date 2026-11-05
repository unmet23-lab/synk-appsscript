# 네 판 가운데 승인 판(15판 시안의 소리, 공개하지 않는다)과 결이 가장 가까운 판을 수치로 고른다. 귀 대신 재는 값이라 마지막 확인은 듣기 검수로 한다.
#   python -I -X utf8 experiences/seoul-arrival/qa/소리고르기.py [--적기]   → 표 + 고른 판(소리다듬기.py 인자)
# 재는 값: ① 평균 멜 스펙트럼의 코사인 닮음(승인 판과) ② 짧은 구간 세기의 흔들림 dB(배경은 낮을수록 고르다) ③ 앞뒤 무음 비율 ④ 고리: 끝과 처음의 스펙트럼 닮음.
import json, os, subprocess, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
RAW = os.path.join(ROOT, '.tmp', 'seoul-sound', 'raw')
REF = os.path.join(os.path.expanduser('~'), 'Documents', 'SYNK-appsscript', '.tmp', 'dream-path-20261102', '소리', '웹')
AMB = ['room', 'clock', 'dawn', 'cabin', 'train', 'campus', 'airport', 'hall', 'canteen']
ONE = ['crowd', 'applause', 'zip', 'walk', 'print', 'stamp']
SR = 22050
def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()
def mel_filters(n_fft=1024, n=48):
    f = np.linspace(0, SR / 2, n_fft // 2 + 1)
    mel = lambda x: 2595 * np.log10(1 + x / 700)
    pts = 700 * (10 ** (np.linspace(mel(60), mel(SR / 2), n + 2) / 2595) - 1)
    fb = np.zeros((n, f.size))
    for i in range(n):
        a, b, c = pts[i:i + 3]
        fb[i] = np.clip(np.minimum((f - a) / (b - a), (c - f) / (c - b)), 0, None)
    return fb
FB = mel_filters()
def spec(x, n_fft=1024, hop=512):
    if len(x) < n_fft:
        x = np.pad(x, (0, n_fft - len(x)))
    win = np.hanning(n_fft)
    frames = np.stack([x[i:i + n_fft] * win for i in range(0, len(x) - n_fft + 1, hop)])
    mag = np.abs(np.fft.rfft(frames, axis=1)) ** 2
    return np.log10(FB @ mag.T + 1e-9).T
def cos(a, b):
    a, b = a - a.mean(), b - b.mean()
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9))
def measures(x, ref, name):
    s = spec(x)
    r = 10 * np.log10(np.mean(np.lib.stride_tricks.sliding_window_view(x ** 2, int(.4 * SR))[::int(.2 * SR)], axis=1) + 1e-10)
    active = r > (r.max() - 40)
    out = {'닮음': round(cos(s.mean(axis=0), spec(ref).mean(axis=0)), 3), '흔들림': round(float(np.std(r[active])), 1), '무음': round(float(1 - active.mean()), 2), '길이': round(len(x) / SR, 1)}
    if name in AMB:
        n = s.shape[0]
        k = max(4, n // 12)
        out['고리'] = round(cos(s[:k].mean(axis=0), s[-k:].mean(axis=0)), 3)
    return out
picks = {}
rows = {}
for name in AMB + ONE:
    pre = 'amb_' if name in AMB else 'sfx_'
    ref_path = os.path.join(REF, pre + name + '.mp3')
    ref = load(ref_path) if os.path.exists(ref_path) else None
    best = None
    rows[name] = {}
    for t in '1234':
        p = os.path.join(RAW, f'{name}_{t}.mp3')
        if not os.path.exists(p):
            continue
        x = load(p)
        m = measures(x, ref if ref is not None else x, name)
        # 점수: 승인 판과의 닮음을 먼저, 배경은 고르고 고리가 잘 맞을수록, 한 번 나는 소리는 닮음만
        score = m['닮음'] - (0.012 * m['흔들림'] if name in AMB else 0) + (0.05 * m.get('고리', 0))
        if name == 'clock':
            # 초침은 결보다 박: 1초 간격이 고른 판을 고른다
            w = int(.004 * SR)
            env = np.sqrt(np.convolve(x ** 2, np.ones(w) / w, 'same'))
            thr = max(np.percentile(env, 99) * .35, np.percentile(env, 50) * 3)
            pk, last = [], -SR
            for i in np.flatnonzero(env > thr):
                if i - last > .5 * SR:
                    pk.append(i)
                    last = i
            d = np.diff(pk) / SR if len(pk) > 2 else np.array([9.0])
            m['똑딱'] = len(pk)
            m['간격'] = round(float(d.mean()), 2)
            m['고르기'] = round(float(d.std()), 3)
            score = 1 - 5 * m['고르기'] - abs(m['간격'] - 1) - (0.5 if len(pk) < 6 else 0)
        m['점수'] = round(score, 3)
        rows[name][t] = m
        if best is None or score > best[0]:
            best = (score, t)
    if best:
        picks[name] = best[1]
for name, r in rows.items():
    print(name, json.dumps(r, ensure_ascii=False))
print('고른 판:', ' '.join(f'{k}={v}' for k, v in picks.items()))
if '--적기' in sys.argv:
    json.dump({'picks': picks, 'rows': rows}, open(os.path.join(ROOT, '.tmp', 'seoul-sound', '고른판.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
