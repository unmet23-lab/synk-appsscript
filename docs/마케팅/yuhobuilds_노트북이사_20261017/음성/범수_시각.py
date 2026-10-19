# 범수 판 테이크와 낱말 시각을 Typecast가 준 낱말 시각으로 만든다(받아쓰기 정렬 대신).
# 10-17: 받아쓰기(faster-whisper small) 정렬이 숫자가 많은 문장 경계(p1→p2, f1→f2, f2→k1)에서 실제 무음 자리와 0.3~0.7초 어긋났다.
# 범수_굽기.mjs는 대사마다 굽고 앞뒤 무음만 다듬어(silenceremove) 0.3초 무음 + 대사 + 쉼(0.35, breaks 앞 0.5)으로 이었다.
# 그래서 대사마다 시작 자리는 계산으로 알고, 그 안의 낱말 시각은 Typecast 응답(범수/<id>.json words)을 대사 파일의 첫 소리에 맞춰 옮긴다.
# 결과: take/take.wav(후보/범수_A.wav의 앞 무음을 0.05초로 줄이고 −15.4 LUFS) · take/take.json(테이크_다듬기.py와 같은 모양)
# 실행(음성 폴더에서): python 범수_시각.py
import json, os, subprocess, sys
import numpy as np
from scipy.io import wavfile

sys.stdout.reconfigure(encoding='utf-8')
here = os.path.dirname(os.path.abspath(__file__))
plan = json.load(open(os.path.join(here, 'voice-plan.json'), encoding='utf-8'))
cand = os.path.join(here, '후보', '범수_A.wav')
meta = json.load(open(cand[:-4] + '.json', encoding='utf-8'))
GAP, GAP_BREAK, LEAD_SIL = meta['gaps']['GAP'], meta['gaps']['GAP_BREAK'], 0.3
breaks = set(plan['take']['breaks'])
ids = [s['id'] for s in plan['segments']]

def onset(path):
    """대사 파일의 첫 소리(10ms 창 −40 dBFS를 처음 넘는 곳)."""
    sr, x = wavfile.read(path); x = x.astype(np.float32) / 32768
    win = int(0.01 * sr); n = len(x) // win
    lv = 10 * np.log10((x[:n * win].reshape(n, win) ** 2).mean(1) + 1e-12)
    k = int(np.argmax(lv > -40))
    return k / 100, len(x) / sr

segs, t = {}, LEAD_SIL
for i, sid in enumerate(ids):
    wav = os.path.join(here, '범수', sid + '.wav')
    on, dur = onset(wav)
    words = json.load(open(os.path.join(here, '범수', sid + '.json'), encoding='utf-8'))['words']
    text_words = plan['segments'][i]['text'].split()
    if len(words) != len(text_words):
        raise SystemExit(f'{sid}: Typecast 낱말 {len(words)}개 ≠ 대본 낱말 {len(text_words)}개')
    shift = on - words[0]['start']            # Typecast 시각 → 다듬은 대사 파일 시각
    toks = [round(t + w['start'] + shift, 3) for w in words]
    end = round(min(t + words[-1]['end'] + shift, t + dur), 3)
    segs[sid] = {'start': toks[0], 'end': end, 'tokens': toks}
    nxt = ids[i + 1] if i + 1 < len(ids) else None
    t += dur + ((GAP_BREAK if nxt in breaks else GAP) if nxt else 0)

# 앞 무음을 0.05초만 남긴다(넣기.cjs는 첫 말소리를 0.3초에 둔다)
cut = round(segs[ids[0]]['start'] - 0.05, 3)
for g in segs.values():
    g['start'] = round(g['start'] - cut, 3); g['end'] = round(g['end'] - cut, 3); g['tokens'] = [round(x - cut, 3) for x in g['tokens']]
os.makedirs(os.path.join(here, 'take'), exist_ok=True)
tmp = os.path.join(here, 'take', '_cut.wav')
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', str(cut), '-i', cand, '-c:a', 'pcm_s16le', tmp], check=True)
r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', tmp, '-af', 'ebur128=framelog=quiet', '-f', 'null', '-'], capture_output=True, text=True, encoding='utf-8', errors='replace')
lufs = float([l for l in r.stderr.splitlines() if l.strip().startswith('I:')][-1].split()[1])
gain = round(-15.4 - lufs, 2)
out = os.path.join(here, 'take', 'take.wav')
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', tmp, '-af', f'volume={gain}dB,alimiter=limit=0.89:level=false', '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', out], check=True)
os.remove(tmp)
sr, x = wavfile.read(out)
info = {'source': os.path.basename(cand), 'engine': meta['engine'], 'model': meta['model'], 'voice': meta['voice'], 'made': meta['made'],
        'timing': 'Typecast 낱말 시각(범수/<id>.json) + 이은 자리 계산(범수_시각.py)', 'seconds': round(len(x) / sr, 3), 'rate': sr,
        'loudness': {'before': lufs, 'gain_db': gain, 'target': -15.4}, 'segs': segs}
json.dump(info, open(os.path.join(here, 'take', 'take.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f"take/take.wav {info['seconds']}초 · {lufs} → -15.4 LUFS")
for sid in ids:
    g = segs[sid]; print(sid, g['start'], g['end'], len(g['tokens']))
