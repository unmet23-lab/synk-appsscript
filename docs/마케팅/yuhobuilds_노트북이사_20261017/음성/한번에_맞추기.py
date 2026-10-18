# 한 번에 읽힌 테이크를 로컬 받아쓰기(faster-whisper, 낱말 시각)로 듣고 대본 낱말에 시각을 붙인다.
# 대본 글자와 들린 글자를 difflib로 맞춰 들린 글자의 시각을 대본 글자로 옮기고, 못 맞춘 글자는 앞뒤로 메운다.
# 대사(화면 단위) 시작·끝은 근처의 쉼(소리 크기)으로 다듬는다. 넣기.cjs가 <wav>.align.json을 읽는다.
# 실행(음성 폴더에서): HF_HUB_OFFLINE=1 STT_MODEL=small python 한번에_맞추기.py 후보/*.wav  [--segs c1,c2,c3]
# STT_MODEL=large-v3-turbo(10-04부터 HF 캐시에 있음)가 small보다 정확하다. 낱말 시각은 둘 다 쓸 만하다.
import json, os, re, sys, difflib
import numpy as np
from scipy.io import wavfile
from faster_whisper import WhisperModel

sys.stdout.reconfigure(encoding='utf-8')
here = os.path.dirname(os.path.abspath(__file__))
plan = json.load(open(os.path.join(here, 'voice-plan.json'), encoding='utf-8'))
THR = -40.0            # 말소리로 보는 크기(dBFS, 10ms 창)
MIN_GAP = 0.06         # 이보다 긴 조용한 구간을 쉼으로 본다
norm = lambda s: re.sub(r'[^가-힣A-Za-z0-9]', '', s)

def levels(x, sr):
    win = int(0.01 * sr); n = len(x) // win
    e = (x[:n * win].reshape(n, win) ** 2).mean(1)
    return 10 * np.log10(e + 1e-12)

def silences(lv):
    out, k = [], 0
    while k < len(lv):
        if lv[k] <= THR:
            j = k
            while j < len(lv) and lv[j] <= THR: j += 1
            if (j - k) / 100 >= MIN_GAP: out.append((k / 100, j / 100))
            k = j
        else: k += 1
    return out

def f0_track(x, sr):
    fr, hop, vals = int(0.04 * sr), int(0.02 * sr), []
    lo, hi = int(sr / 350), int(sr / 65)
    for i in range(0, len(x) - fr, hop):
        seg = x[i:i + fr]; seg = seg - seg.mean()
        if 10 * np.log10((seg ** 2).mean() + 1e-12) < THR + 12: continue
        ac = np.correlate(seg, seg, 'full')[fr - 1:]
        if ac[0] <= 0: continue
        k = lo + int(np.argmax(ac[lo:hi]))
        if ac[k] / ac[0] > 0.5: vals.append(sr / k)
    return np.array(vals)

# --segs c1,c2: 끝 문단만 따로 읽힌 테이크(한번에_생성.cjs --segs)는 그 대사들하고만 맞춘다
SEGS = sys.argv[sys.argv.index('--segs') + 1].split(',') if '--segs' in sys.argv else None
if SEGS: plan['segments'] = [s for s in plan['segments'] if s['id'] in SEGS]

# 대본 글자 표: (대사 번호, 낱말 번호)
S, owner = [], []
for si, s in enumerate(plan['segments']):
    for ti, tk in enumerate(s['text'].split()):
        for ch in norm(tk): S.append(ch); owner.append((si, ti))

model = WhisperModel(os.environ.get('STT_MODEL', 'small'), device='cpu', compute_type='int8', cpu_threads=8)
files = [a for i, a in enumerate(sys.argv[1:], 1) if not a.startswith('--') and sys.argv[i - 1] != '--segs']
rows = []
for wav in files:
    sr, x = wavfile.read(wav); x = x.astype(np.float32) / 32768
    if x.ndim > 1: x = x.mean(1)
    dur = len(x) / sr
    lv = levels(x, sr)
    voiced = np.where(lv > THR)[0]
    on, off = voiced[0] / 100, (voiced[-1] + 1) / 100
    sil = [g for g in silences(lv) if g[0] > on and g[1] < off]
    segs, _ = model.transcribe(wav, language='ko', beam_size=5, vad_filter=False, word_timestamps=True, condition_on_previous_text=False)
    R, rt0, rt1, heard = [], [], [], []
    for sg in segs:
        heard.append(sg.text)
        for w in (sg.words or []):
            cs = norm(w.word)
            for i, ch in enumerate(cs):
                R.append(ch); rt0.append(w.start + (w.end - w.start) * i / len(cs)); rt1.append(w.start + (w.end - w.start) * (i + 1) / len(cs))
    heard = ''.join(heard).strip()
    sm = difflib.SequenceMatcher(None, S, R, autojunk=False)
    t0 = [None] * len(S); t1 = [None] * len(S); ridx = [None] * len(S)
    for a, b, n in sm.get_matching_blocks():
        for k in range(n): t0[a + k] = rt0[b + k]; t1[a + k] = rt1[b + k]; ridx[a + k] = b + k
    known = [i for i in range(len(S)) if t0[i] is not None]
    def fill(arr):
        for i in range(len(S)):
            if arr[i] is not None: continue
            prev = max([k for k in known if k < i], default=None); nxt = min([k for k in known if k > i], default=None)
            if prev is None and nxt is None: arr[i] = on
            elif prev is None: arr[i] = arr[nxt]
            elif nxt is None: arr[i] = arr[prev]
            else: arr[i] = arr[prev] + (arr[nxt] - arr[prev]) * (i - prev) / (nxt - prev)
    fill(t0); fill(t1)
    out = {}
    for si, s in enumerate(plan['segments']):
        idx = [i for i in range(len(S)) if owner[i][0] == si]
        toks = []
        for ti in range(len(s['text'].split())):
            first = next(i for i in idx if owner[i][1] == ti); toks.append(t0[first])
        a, b = t0[idx[0]], t1[idx[-1]]
        # 시작: 바로 앞(−0.3~+0.12초)에 쉼이 있으면 그 쉼이 끝나는 곳, 끝: 바로 뒤(−0.15~+0.35초)에 쉼이 있으면 쉼이 시작하는 곳
        pre = [g for g in sil if a - 0.3 <= g[1] <= a + 0.12]
        if pre: a = pre[-1][1]
        if si == 0: a = on
        post = [g for g in sil if b - 0.15 <= g[0] <= b + 0.35]
        if post: b = post[0][0]
        if si == len(plan['segments']) - 1: b = off
        toks[0] = a
        toks = [max(t, a) for t in toks]
        rs = [ridx[i] for i in idx if ridx[i] is not None]
        got = ''.join(R[min(rs):max(rs) + 1]) if rs else ''
        out[s['id']] = {'start': round(a, 3), 'end': round(b, 3), 'tokens': [round(t, 3) for t in toks],
                        'match': round(difflib.SequenceMatcher(None, norm(s['text']), got, autojunk=False).ratio(), 3), 'heard': got}
    ids = [s['id'] for s in plan['segments']]
    gaps = {ids[i + 1]: round(out[ids[i + 1]]['start'] - out[ids[i]]['end'], 3) for i in range(len(ids) - 1)}
    pause_total = sum(g[1] - g[0] for g in sil)
    syl = sum(len(re.findall(r'[가-힣]', s['text'])) + 2 * len(re.findall(r'[A-Za-z]+', s['text'])) for s in plan['segments'])
    f0 = f0_track(x, sr); f0 = f0[(f0 > 60) & (f0 < 320)]
    st = 12 * np.log2(f0 / np.median(f0)) if len(f0) else np.array([0.0])
    res = {'file': os.path.basename(wav), 'seconds': round(dur, 2), 'lead': round(on, 2), 'tail': round(dur - off, 2), 'speech': round(off - on, 2),
           'match': round(sm.ratio(), 3), 'syl_per_s': round(syl / (off - on), 2), 'artic_per_s': round(syl / max(0.1, off - on - pause_total), 2),
           'pauses': len(sil), 'pause_total': round(pause_total, 2), 'longest_pause': round(max([g[1] - g[0] for g in sil], default=0), 2),
           'f0_median': round(float(np.median(f0)), 1) if len(f0) else 0, 'f0_st_sd': round(float(np.std(st)), 2),
           'gaps': gaps, 'segs': out, 'heard': heard, 'stt': os.environ.get('STT_MODEL', 'small')}
    json.dump(res, open(wav[:-4] + '.align.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    rows.append(res)
    worst = sorted(out.items(), key=lambda kv: kv[1]['match'])[:2]
    print(f"{res['file']:<34} {dur:5.1f}초 말 {res['speech']:5.1f} 일치 {res['match']:.3f} 초당 {res['syl_per_s']:.1f}(발화 {res['artic_per_s']:.1f}) 쉼 {res['pauses']}개 {res['pause_total']:.1f}초 최장 {res['longest_pause']:.2f} F0 {res['f0_median']:.0f}Hz ±{res['f0_st_sd']:.1f}반음 | 약한 곳 " + ', '.join(f"{k} {v['match']:.2f}" for k, v in worst), flush=True)
