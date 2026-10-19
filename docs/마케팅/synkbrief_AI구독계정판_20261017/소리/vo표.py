# -*- coding: utf-8 -*-
"""나레이션 줄 파일의 끝 숨을 자르고, 낱말 시각 표 remotion/src/full/vo.ts를 만든다.

    python -I 소리/vo표.py [--보기]     --보기는 자를 자리만 보여 주고 파일은 그대로 둔다

- 첫 소리: 줄 파일(앞 무음만 걷은 판)에서 10ms 창이 −40 dBFS를 처음 넘는 곳. Typecast 낱말 시각(<id>.json words)을 여기에 맞춰 옮긴다.
- 끝: Typecast 마지막 낱말 끝은 파일 끝(숨 포함)이라 쓰지 않는다. 받아쓰기(faster-whisper large-v3-turbo) 마지막 낱말 끝과
  소리 크기(봉우리 −30 dB 아래로 떨어지는 마지막 자리) 가운데 늦은 쪽 + 0.12초에서 자르고 0.06초 페이드(현장 노트 영상_ffmpeg_자막 「Typecast」).
"""
import json, os, shutil, subprocess, sys, tempfile
import numpy as np
from scipy.io import wavfile

sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
VO = os.path.join(HERE, '..', 'remotion', 'public', 'vo')
TS = os.path.join(HERE, '..', 'remotion', 'src', 'full', 'vo.ts')
KEEP = os.path.join(tempfile.gettempdir(), 'synkbrief-subs-vo-uncut')  # 자르기 전 판(한 번만 남김, git 밖)
TAIL, FADE = 0.12, 0.06


def levels(x, sr, win=0.01):
    n = int(win * sr); k = len(x) // n
    return 10 * np.log10((x[:k * n].reshape(k, n) ** 2).mean(1) + 1e-12)


def main():
    look = '--보기' in sys.argv
    from faster_whisper import WhisperModel
    model = WhisperModel('large-v3-turbo', device='cpu', compute_type='int8')
    lines = json.load(open(os.path.join(VO, 'vo.json'), encoding='utf-8'))['lines']
    table = {}
    os.makedirs(KEEP, exist_ok=True)
    for L in lines:
        i = L['id']
        wav = os.path.join(VO, i + '.wav')
        keep = os.path.join(KEEP, i + '.wav')
        if not os.path.exists(keep):
            shutil.copy2(wav, keep)
        src = keep  # 늘 자르기 전 판에서 잰다(다시 돌려도 같은 자리)
        sr, x = wavfile.read(src); x = x.astype(np.float32) / 32768
        lv = levels(x, sr)
        dur = len(x) / sr
        onset = int(np.argmax(lv > -40)) / 100
        words = json.load(open(os.path.join(VO, i + '.json'), encoding='utf-8'))['words']
        shift = onset - words[0]['start']
        segs, _ = model.transcribe(src, language='ko', beam_size=5, word_timestamps=True)
        ww = [w for s in segs for w in s.words]
        w_end = ww[-1].end if ww else dur
        loud = lv > lv.max() - 30
        e_end = (len(lv) - int(np.argmax(loud[::-1]))) / 100
        end = min(dur, max(w_end, e_end) + TAIL)
        print(f'{i} 파일 {dur:.2f} · 첫 소리 {onset:.2f}(옮김 {shift:+.3f}) · 받아쓰기 끝 {w_end:.2f} · 소리 끝 {e_end:.2f} → 자름 {end:.2f}  (숨 {dur - end:.2f}초 덜어냄)')
        if not look:
            tmp = wav + '.tmp.wav'
            subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', src, '-af', f'atrim=0:{end:.3f},afade=t=out:st={end - FADE:.3f}:d={FADE}',
                            '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', tmp], check=True)
            os.replace(tmp, wav)
        tw = []
        for k, w in enumerate(words):
            t = round(w['start'] + shift, 3)
            e = round(min(w['end'] + shift, end - TAIL) if k == len(words) - 1 else w['end'] + shift, 3)
            tw.append({'w': w['text'], 't': max(0.0, t), 'e': e})
        table[i] = {'dur': round(end, 3), 'speech': round(end - TAIL, 3), 'words': tw}
    if look:
        return
    body = ',\n'.join(f'  {i}: {{ dur: {v["dur"]}, speech: {v["speech"]}, words: [' + ', '.join(
        f'{{ w: {json.dumps(w["w"], ensure_ascii=False)}, t: {w["t"]:.3f}, e: {w["e"]:.3f} }}' for w in v['words']) + '] }' for i, v in table.items())
    ts = ('// 나레이션(Typecast 범수 · 1.12배) 길이와 낱말 시각 — 소리/vo표.py가 public/vo/*.json·*.wav에서 만든 표. 다시 구우면 이 파일도 다시 만든다.\n'
          '// dur: 자른 wav 길이(초), speech: 마지막 말소리 끝(초), t/e: 낱말 시작·끝(초, 줄 파일 기준).\n'
          'export type Word = { w: string; t: number; e: number };\n'
          'export const VO: Record<string, { dur: number; speech: number; words: Word[] }> = {\n' + body + ',\n};\n')
    with open(TS, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write(ts)
    print('vo.ts', len(table), '줄')


main()
