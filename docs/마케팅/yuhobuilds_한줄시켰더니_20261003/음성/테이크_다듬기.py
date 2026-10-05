# 고른 테이크를 영상용으로 다듬는다: 잘린 꼭대기를 되살리고(adeclip), 긴 쉼만 줄이고(말은 손대지 않는다), 48kHz로 올리고,
# 큰 소리만 리미터로 눌러 −15 LUFS(10-03 판 목소리와 같은 크기)에 맞춘다.
# 낱말 시각(<후보>.align.json, 한번에_맞추기.py가 만든다)도 줄인 만큼 당겨서 take/take.json에 적는다.
# 쉼 상한: voice-plan.json take.breaks에 든 대사 앞(화제가 바뀌는 곳)은 0.6초, 나머지는 0.42초. 앞 무음 0.05초, 뒤 0.35초.
# 실행(음성 폴더에서): python 테이크_다듬기.py 후보/3.8-flash__Charon_r2.wav [--out 후보/다듬기/Charon]   (기본 take/)
import json, os, re, subprocess, sys
import numpy as np
from scipy.io import wavfile
from scipy.signal import resample_poly

sys.stdout.reconfigure(encoding='utf-8')
here = os.path.dirname(os.path.abspath(__file__))
plan = json.load(open(os.path.join(here, 'voice-plan.json'), encoding='utf-8'))
src = sys.argv[1]
out_dir = os.path.join(here, sys.argv[sys.argv.index('--out') + 1]) if '--out' in sys.argv else os.path.join(here, 'take')
al = json.load(open(src[:-4] + '.align.json', encoding='utf-8'))
meta = json.load(open(src[:-4] + '.json', encoding='utf-8'))
THR, MIN_GAP, CAP, CAP_BREAK, LEAD, TAIL, XF, TARGET = -40.0, 0.06, 0.42, 0.6, 0.05, 0.35, 0.012, -15.0

sr, x = wavfile.read(src)
clipped = int((np.abs(x.astype(np.int32)) >= 32700).sum())
if clipped:   # Gemini 테이크는 큰 소리 몇 곳이 잘려(평평한 꼭대기) 나온다 → adeclip으로 되살린다
    os.makedirs(out_dir, exist_ok=True)
    fixed = os.path.join(out_dir, '_declip.wav')
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', src, '-af', 'adeclip', '-c:a', 'pcm_f32le', fixed], check=True)
    sr, x = wavfile.read(fixed); os.remove(fixed)
x = x.astype(np.float32) / (32768 if x.dtype == np.int16 else 1)
if x.ndim > 1: x = x.mean(1)
if sr != 48000: x = resample_poly(x, 48000, sr).astype(np.float32); sr = 48000
win = int(0.01 * sr); n = len(x) // win
lv = 10 * np.log10((x[:n * win].reshape(n, win) ** 2).mean(1) + 1e-12)
voiced = np.where(lv > THR)[0]
on, off = voiced[0] / 100, (voiced[-1] + 1) / 100
sil, k = [], 0
while k < n:
    if lv[k] <= THR:
        j = k
        while j < n and lv[j] <= THR: j += 1
        if (j - k) / 100 >= MIN_GAP and k / 100 > on and j / 100 < off: sil.append((k / 100, j / 100))
        k = j
    else: k += 1

ids = [s['id'] for s in plan['segments'] if s['id'] in al['segs']]   # 끝 문단만 읽힌 테이크(--segs)면 그 대사들만
breaks = [al['segs'][i]['start'] for i in plan['take']['breaks'] if i in ids[1:]]
# 잘라 낼 구간: [앞 무음], 긴 쉼의 가운데, [뒤 무음]
cuts = [(0.0, max(0.0, on - LEAD))]
for a, b in sil:
    cap = CAP_BREAK if any(a - 0.2 <= t <= b + 0.2 for t in breaks) else CAP
    if b - a > cap:
        keep_head = cap * 0.45; keep_tail = cap - keep_head
        cuts.append((a + keep_head, b - keep_tail))
cuts.append((min(len(x) / sr, off + TAIL), len(x) / sr))
cuts = [(a, b) for a, b in cuts if b - a > 0.005]

# 시각 지도(원래 → 새) 와 잘라 붙이기(이음매 12ms 교차)
def remap(t):
    shift = 0.0
    for a, b in cuts:
        if t >= b: shift += b - a
        elif t > a: shift += t - a
    return t - shift
pieces, last = [], 0.0
for a, b in cuts:
    if a > last: pieces.append((last, a))
    last = max(last, b)
if last < len(x) / sr: pieces.append((last, len(x) / sr))
xf = int(XF * sr)
out = x[int(pieces[0][0] * sr):int(pieces[0][1] * sr)].copy()
for a, b in pieces[1:]:
    seg = x[int(a * sr):int(b * sr)]
    if len(out) > xf and len(seg) > xf:
        ramp = np.linspace(0, 1, xf, dtype=np.float32)
        out[-xf:] = out[-xf:] * (1 - ramp) + seg[:xf] * ramp
        out = np.concatenate([out, seg[xf:]])
    else: out = np.concatenate([out, seg])
# 이음매 교차 때문에 생긴 오차(조각마다 12ms)를 시각 지도에 반영
def remap2(t):
    m = remap(t); joins = sum(1 for a, _ in pieces[1:] if remap(a) <= m + 1e-9 and a > pieces[0][0])
    return max(0.0, m - joins * XF)

os.makedirs(out_dir, exist_ok=True)
tmp = os.path.join(out_dir, '_tmp.wav')
wavfile.write(tmp, sr, out.astype(np.float32))   # 32비트 실수: 되살린 꼭대기가 1을 넘어도 여기서 자르지 않는다
def measure(path):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True, encoding='utf-8', errors='replace')
    return float(re.findall(r'I:\s+(-?[0-9.]+) LUFS', r.stderr)[-1]), float(re.findall(r'Peak:\s+(-?[0-9.]+) dBFS', r.stderr)[-1])
I, peak = measure(tmp)
gain = TARGET - I
# 말소리는 꼭대기가 높아(평균보다 18dB 이상) 그냥 키우면 넘친다 → 큰 소리만 리미터로 눌러 목표 크기를 맞춘다
af = f'volume={gain:.2f}dB' + (f',alimiter=limit={10 ** (-1.5 / 20):.4f}:attack=3:release=60:level=0:latency=1' if peak + gain > -1.5 else '')
dst = os.path.join(out_dir, 'take.wav')
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', tmp, '-af', af, '-ar', str(sr), '-ac', '1', '-c:a', 'pcm_s16le', dst], check=True)
os.remove(tmp)
I2, peak2 = measure(dst)
out = wavfile.read(dst)[1]

segs = {}
for i in ids:
    s = al['segs'][i]
    segs[i] = {'start': round(remap2(s['start']), 3), 'end': round(remap2(s['end']), 3), 'tokens': [round(remap2(t), 3) for t in s['tokens']]}
for a, b in zip(ids, ids[1:]):   # 대사 경계가 겹치면 뒤 대사 시작에 맞춘다
    if segs[a]['end'] > segs[b]['start']: segs[a]['end'] = segs[b]['start']
info = {'source': os.path.basename(src), 'engine': meta['engine'], 'model': meta['model'], 'voice': meta['voice'], 'made': meta['made'],
        'seconds': round(len(out) / sr, 3), 'rate': sr, 'declipped_samples': clipped, 'loudness_before': I, 'gain_db': round(gain, 2),
        'limiter': 'alimiter' in af, 'target_lufs': TARGET, 'loudness': I2, 'peak_dbfs': peak2,
        'cuts': [[round(a, 3), round(b, 3)] for a, b in cuts], 'removed_s': round(sum(b - a for a, b in cuts), 2),
        'match': al['match'], 'stt': al.get('stt'), 'segs': segs}
json.dump(info, open(os.path.join(out_dir, 'take.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f"{info['source']} → {os.path.relpath(dst, here)} {info['seconds']}초(원래 {len(x) / sr:.2f}초, 쉼 {len(cuts) - 2}곳에서 {info['removed_s']}초 줄임) · 되살린 잘림 {clipped}표본 · {I:.1f} → {I2:.1f} LUFS, 꼭대기 {peak2:.1f}dBFS")
