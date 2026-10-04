# 타입캐스트 퀵 클로닝(5~150초)용 유호님 목소리 파일 만들기 — 2026-10-03
# 유호님 요청: 「바탕화면에 있는 이 두 개를 사용하면 될 거야」(음성 260922_230839.m4a · 음성 260923_231130.m4a),
#              「ㅅ 발음이 약간 씹히는 특성이 있는데 음색만 내 음색이면 되고 발음은 좋아졌으면 좋겠어」.
# 그래서: 두 녹음에서 유호님 혼자 길게 말한 깨끗한 문장을 고르되, ㅅ·ㅆ 소리(첫소리, 받침의 연음)가 적은 문장을 앞에 둔다.
# 퀵 클로닝은 음색과 말투를 배우므로, ㅅ이 많은 문장을 빼면 ㅅ 발음은 타입캐스트 기본 발음 쪽에 가깝게 남는다.
# 실행(이 폴더에서): python 학습파일_만들기.py  →  학습/yuho_typecast_train.wav(48kHz 모노) + 학습/yuho_typecast_train.json
import json, os, subprocess, sys, tempfile
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt
from faster_whisper import WhisperModel

sys.stdout.reconfigure(encoding='utf-8')
DESK = 'C:/Users/q1212/OneDrive/Desktop'
SRCS = {'0922': f'{DESK}/음성 260922_230839.m4a', '0923': f'{DESK}/음성 260923_231130.m4a'}
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '학습')
TARGET = 132.0          # 초(말소리만). 문장 사이 0.35초까지 더해 147초 안 — 퀵 클로닝 상한 150초
MIN_SHARE = 0.35        # 두 녹음이 각각 이만큼은 들어가게
F0_RANGE = (92, 180)    # 유호님 말소리 높이(실제 녹음 중앙 약 134Hz). 다른 사람 목소리를 거른다
os.makedirs(OUT_DIR, exist_ok=True)
tmp = tempfile.mkdtemp(prefix='yuho_voice_')

def to16k(src, name):
    out = os.path.join(tmp, name + '.wav')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-ac', '1', '-ar', '16000', out], check=True)
    sr, x = wavfile.read(out)
    return sr, x.astype(np.float32) / 32768

def f0_of(seg, sr):
    seg = seg - seg.mean(); ac = np.correlate(seg, seg, 'full')[len(seg) - 1:]
    lo, hi = int(sr / 350), int(sr / 70)
    if ac[0] <= 0: return 0.0
    k = lo + int(np.argmax(ac[lo:hi])); return sr / k if ac[k] / ac[0] > 0.45 else 0.0

def scan(x, sr):
    xf = sosfilt(butter(4, 70, 'hp', fs=sr, output='sos'), x)
    hop, win = int(0.02 * sr), int(0.04 * sr)
    n = (len(xf) - win) // hop
    fr = np.lib.stride_tricks.sliding_window_view(xf, win)[::hop][:n]
    db = 20 * np.log10(np.sqrt((fr ** 2).mean(1) + 1e-12))
    W = int(30 / 0.02); rows = []
    for i in range(0, n - W, W):
        d = db[i:i + W]; floor = np.percentile(d, 10); speech = d > floor + 15
        rows.append({'t': i * 0.02, 'speech': float(speech.mean()), 'floor': float(floor), 'snr': float(np.percentile(d, 90) - floor)})
    return rows

# ㅅ·ㅆ가 소리 나는 자리: 첫소리 ㅅ(9)·ㅆ(10), 받침 ㅅ(19)·ㅆ(20) 뒤에 ㅇ(11)으로 시작하는 글자가 오면 연음돼 소리 난다.
# ㅈ·ㅉ·ㅊ(12·13·14)도 같은 혀 자리라 반만 센다
def sibilance(text):
    syl = [c for c in text if 0xAC00 <= ord(c) <= 0xD7A3]
    if not syl: return 1.0
    score = 0.0
    for i, c in enumerate(syl):
        k = ord(c) - 0xAC00; ini, fin = k // 588, k % 28
        if ini in (9, 10): score += 1
        elif ini in (12, 13, 14): score += 0.5
        if fin in (19, 20) and i + 1 < len(syl) and (ord(syl[i + 1]) - 0xAC00) // 588 == 11: score += 1
    return score / len(syl)

model = WhisperModel('small', device='cpu', compute_type='int8')
cands = []
for tag, src in SRCS.items():
    sr, x = to16k(src, tag)
    rows = scan(x, sr)
    good = sorted([r for r in rows if r['speech'] >= 0.45 and r['snr'] >= 24], key=lambda r: -(r['snr'] + 30 * r['speech']))[:22]
    print(tag, f'{len(x) / sr / 60:.1f}분', '깨끗한 창', len(good), '잡음바닥 중앙', round(float(np.median([r['floor'] for r in rows])), 1), 'dB')
    for r in good:
        t0 = max(0.0, r['t'] - 3); seg = x[int(t0 * sr):int((t0 + 36) * sr)]
        segs, _ = model.transcribe(seg, language='ko', vad_filter=True, beam_size=1)
        for s in segs:
            dur = s.end - s.start
            if s.start < 0.4 or s.end > 35.6 or dur < 1.8 or dur > 12 or s.avg_logprob < -0.7 or s.no_speech_prob > 0.35: continue
            piece = seg[int(s.start * sr):int(s.end * sr)]
            hop = int(0.04 * sr); f0s = [f0_of(piece[j:j + int(0.04 * sr)], sr) for j in range(0, len(piece) - hop, hop * 3)]
            f0s = [v for v in f0s if v > 0]
            f0m = float(np.median(f0s)) if f0s else 0.0
            if not (F0_RANGE[0] <= f0m <= F0_RANGE[1]): continue
            text = s.text.strip()
            cands.append({'src': tag, 'start': round(t0 + s.start - 0.08, 3), 'end': round(t0 + s.end + 0.15, 3), 'text': text,
                          'sib': round(sibilance(text), 3), 'logp': round(s.avg_logprob, 3), 'snr': round(r['snr'], 1), 'f0': round(f0m)})

# 중복 제거(같은 녹음에서 겹치는 구간)
cands.sort(key=lambda c: (c['sib'], -c['logp']))
picked = []
def overlaps(c): return any(p['src'] == c['src'] and not (c['end'] <= p['start'] or c['start'] >= p['end']) for p in picked)
total = lambda src=None: sum(p['end'] - p['start'] for p in picked if src in (None, p['src']))
fits = lambda c: total() + 0.35 * (len(picked) + 1) + (c['end'] - c['start']) <= 147
# 1) 두 녹음에서 각각 MIN_SHARE만큼 ㅅ이 적은 문장부터
for tag in SRCS:
    for c in [c for c in cands if c['src'] == tag]:
        if total(tag) >= TARGET * MIN_SHARE: break
        if not overlaps(c) and fits(c): picked.append(c)
# 2) 나머지는 어느 녹음이든 ㅅ이 적은 순서로
for c in cands:
    if total() >= TARGET: break
    if not overlaps(c) and fits(c): picked.append(c)
picked.sort(key=lambda p: (p['src'], p['start']))
print('고른 문장', len(picked), '합계', round(total(), 1), '초', {t: round(total(t), 1) for t in SRCS},
      'ㅅ 비율 평균', round(float(np.mean([p['sib'] for p in picked])), 3), '(후보 전체', round(float(np.mean([c['sib'] for c in cands])), 3), ')')
for p in picked: print(f"  {p['src']} {int(p['start'] // 60):02d}:{p['start'] % 60:05.2f} {p['end'] - p['start']:4.1f}s ㅅ{p['sib']:.2f} F0 {p['f0']}  {p['text'][:50]}")

# 원본에서 잘라 이어 붙이기(48kHz 모노). 문장 사이 0.35초, 70Hz 아래 소음 컷, 음량 −18 LUFS
inputs, parts, chain = [], [], []
order = list(SRCS)
for tag in order: inputs += ['-i', SRCS[tag]]
for i, p in enumerate(picked):
    a, b = p['start'], p['end']; ii = order.index(p['src'])
    parts.append(f'[{ii}:a]atrim={a:.3f}:{b:.3f},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=mono,afade=t=in:d=0.02,afade=t=out:st={b - a - 0.03:.3f}:d=0.03[s{i}]')
    parts.append(f'anullsrc=r=48000:cl=mono,atrim=0:0.35[g{i}]')
    chain.append(f'[s{i}][g{i}]')
fc = ';'.join(parts) + f";{''.join(chain)}concat=n={2 * len(picked)}:v=0:a=1,highpass=f=70,loudnorm=I=-18:TP=-1.5:LRA=11[out]"
out = os.path.join(OUT_DIR, 'yuho_typecast_train.wav')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *inputs, '-filter_complex', fc, '-map', '[out]', '-ac', '1', '-ar', '48000', '-c:a', 'pcm_s16le', out], check=True)
json.dump({'made': '2026-10-03', 'sources': SRCS, 'target_s': TARGET, 'sentences': picked}, open(os.path.join(OUT_DIR, 'yuho_typecast_train.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('ok', out)
