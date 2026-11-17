# 새 여자 선배 목소리 후보 받아쓰기 대조(2026-11-17) — 줄마다 받아 적어 대본과 견준다: 꼬리표를 소리 내 읽었는지, 말이 빠졌거나 붙었는지.
# 함께 줄마다 길이와 음높이(중앙값)를 잰다. faster-whisper small(CPU int8), 언어 ko 고정. 목소리후보-20261030/받아쓰기.py와 같은 셈이다.
#   python -X utf8 experiences/drama/qa/새여자선배-20261117/받아쓰기.py   → 공용 작업본 .tmp/senior-f-voice/받아쓰기.json
import json, re, subprocess, sys, pathlib, unicodedata
import numpy as np, parselmouth
from faster_whisper import WhisperModel

여기 = pathlib.Path(__file__).resolve().parent
뿌리 = 여기.parents[3]
작업 = pathlib.Path(subprocess.run(['node', '-e', "console.log(require('./tools/lib/공용작업본.js').공용작업본(process.cwd()))"], cwd=뿌리, capture_output=True, text=True, encoding='utf-8', check=True).stdout.strip()) / '.tmp' / 'senior-f-voice'
줄들 = json.loads((작업 / '줄.json').read_text(encoding='utf-8'))  # node 목소리.mjs 줄 이 쓴다
model = WhisperModel('small', device='cpu', compute_type='int8')

def 정규(s):
    s = unicodedata.normalize('NFC', s).replace('삼 학년', '3학년').replace('삼학년', '3학년').replace('일 학년', '1학년').replace('일학년', '1학년')
    return re.sub(r'[\s.,!?…~\'"“”‘’·:;()「」\-\[\]]', '', s)
def 일치(a, b):
    a, b = list(정규(a)), list(정규(b))
    앞 = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        지금 = [i]
        for j in range(1, len(b) + 1):
            지금.append(min(앞[j] + 1, 지금[j - 1] + 1, 앞[j - 1] + (a[i - 1] != b[j - 1])))
        앞 = 지금
    return round(1 - 앞[len(b)] / max(len(a), len(b), 1), 3)

결과 = {}
for k, c in 줄들['후보'].items():
    줄결과 = []
    for l in 줄들['줄들']:
        f = 작업 / '받음' / k / f"{l['id']}.mp3"
        if not f.exists(): continue
        wav = f.with_suffix('.wav')
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(f), '-ac', '1', '-ar', '24000', str(wav)], check=True)
        snd = parselmouth.Sound(str(wav))
        f0 = snd.to_pitch(time_step=0.01, pitch_floor=100, pitch_ceiling=500).selected_array['frequency']; f0 = f0[f0 > 0]
        segs, _ = model.transcribe(str(wav), language='ko', vad_filter=True, beam_size=5)
        글 = ' '.join(s.text.strip() for s in segs)
        wav.unlink()
        줄결과.append({'줄': l['id'], '일치': 일치(l['text'], 글), '초': round(snd.duration, 2), '음높이': int(np.median(f0)) if len(f0) else 0, '영어낱말': re.findall(r'[A-Za-z]{3,}', 글), '받아쓰기': 글})
    if not 줄결과: continue
    결과[k] = {'이름': c['이름'], '일치': round(sum(x['일치'] for x in 줄결과) / len(줄결과), 3), '초': round(sum(x['초'] for x in 줄결과), 1), '음높이': int(np.median([x['음높이'] for x in 줄결과])), '줄': 줄결과}
    print(f"{k}: 일치 {결과[k]['일치']} · {결과[k]['초']}초 · {결과[k]['음높이']}Hz · 낮은 줄 {[ (x['줄'], x['일치']) for x in 줄결과 if x['일치'] < 0.9 ]} · 영어 {[w for x in 줄결과 for w in x['영어낱말']][:5]}")
(작업 / '받아쓰기.json').write_text(json.dumps(결과, ensure_ascii=False, indent=1), encoding='utf-8')
