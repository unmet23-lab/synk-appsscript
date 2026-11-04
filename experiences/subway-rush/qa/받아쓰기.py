"""환승 러시 목소리 받아쓰기 확인(2026-11-04): 구운 줄을 faster-whisper로 받아 적어 원고와 견준다 — 합성 목소리가 숫자 · 역 이름을 다르게 읽는 함정을 찾는다.
듣기 게임이라 들리는 말이 곧 문제다. 로컬 CPU · 돈 0. 어긋난 줄만 적는다. 귀로 듣는 판단을 대신하지 않는다.
  python -I -X utf8 experiences/subway-rush/qa/받아쓰기.py [--모델 small]
"""
import json
import re
import sys
from difflib import SequenceMatcher
from pathlib import Path

from faster_whisper import WhisperModel

VOICE = Path(__file__).resolve().parents[1] / 'assets' / 'voice'
NUM = {'1': '일', '2': '이', '3': '삼', '4': '사', '5': '오', '6': '육', '7': '칠', '8': '팔', '9': '구'}


def norm(s):
    s = re.sub(r'(\d)', lambda m: NUM[m.group(1)], s)
    return re.sub(r'[^가-힣a-zA-Z]', '', s).lower()


def main():
    size = sys.argv[sys.argv.index('--모델') + 1] if '--모델' in sys.argv else 'small'
    model = WhisperModel(size, device='cpu', compute_type='int8')
    manifest = json.loads((VOICE / 'manifest.json').read_text(encoding='utf-8'))
    bad, ok = [], 0
    for voice, info in manifest.items():
        segs, _ = model.transcribe(str(VOICE / f'{voice}.mp3'), language='ko', beam_size=5, vad_filter=False, initial_prompt=None)
        got = ''.join(s.text for s in segs).strip()
        ratio = SequenceMatcher(None, norm(info['text']), norm(got)).ratio()
        if ratio < 0.9:
            bad.append((round(ratio, 2), voice, info['text'], got))
        else:
            ok += 1
    print(f'맞음 {ok} · 살필 것 {len(bad)}')
    for r in sorted(bad):
        print(*r, sep=' | ')


if __name__ == '__main__':
    main()
