# 만든 대사(음성/audio/<id>.wav)를 로컬 받아쓰기(faster-whisper large-v3-turbo)로 다시 듣고 원고와 대조한다.
# 글자 일치율, 말 속도(초당 음절), 앞뒤 무음, 크기를 적는다. 실행(음성 폴더에서): python 받아쓰기_확인.py
import json, os, subprocess, sys, difflib, re
import numpy as np
from scipy.io import wavfile
from faster_whisper import WhisperModel

sys.stdout.reconfigure(encoding='utf-8')
here = os.path.dirname(os.path.abspath(__file__))
plan = json.load(open(os.path.join(here, 'voice-plan.json'), encoding='utf-8'))
model = WhisperModel(os.environ.get('STT_MODEL', 'medium'), device='cpu', compute_type='int8', cpu_threads=8)
norm = lambda s: re.sub(r'[^가-힣A-Za-z0-9]', '', s)
rows = []
for s in plan['segments']:
    wav = os.path.join(here, 'audio', s['id'] + '.wav')
    sr, x = wavfile.read(wav); x = x.astype(np.float32) / 32768
    if x.ndim > 1: x = x.mean(1)
    win = int(0.01 * sr); db = 20 * np.log10(np.sqrt(np.convolve(x * x, np.ones(win) / win, 'valid')[::win] + 1e-12))
    on = int(np.argmax(db > -40)); off = len(db) - int(np.argmax(db[::-1] > -40))
    speech = (off - on) / 100
    segs, _ = model.transcribe(wav, language='ko', beam_size=5, vad_filter=False)
    heard = ''.join(seg.text for seg in segs).strip()
    a, b = norm(s['text']), norm(heard)
    match = difflib.SequenceMatcher(None, a, b).ratio()
    syl = len(re.findall(r'[가-힣]', s['text'])) + len(re.findall(r'[A-Za-z]+', s['text'])) * 2
    rows.append({'id': s['id'], 'match': round(match, 3), 'speech_s': round(speech, 2), 'syl_per_s': round(syl / speech, 2), 'lead': round(on / 100, 2), 'tail': round(len(db) / 100 - off / 100, 2), 'peak_db': round(float(db.max()), 1), 'text': s['text'], 'heard': heard})
    print(flush=True) or print(f"{s['id']:>3} 일치 {match:.2f} · 말 {speech:.2f}초 · 초당 {syl / speech:.1f}음절 · 앞 {on / 100:.2f} 뒤 {len(db) / 100 - off / 100:.2f} | {heard}")
json.dump(rows, open(os.path.join(here, '받아쓰기_확인.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('평균 일치', round(float(np.mean([r['match'] for r in rows])), 3), '· 평균 초당 음절', round(float(np.mean([r['syl_per_s'] for r in rows])), 2), '· 말 합계', round(sum(r['speech_s'] for r in rows), 1), '초')
