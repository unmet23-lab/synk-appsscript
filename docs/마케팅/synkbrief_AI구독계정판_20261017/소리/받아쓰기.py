# -*- coding: utf-8 -*-
"""구운 나레이션(remotion/public/vo/*.wav)을 로컬 faster-whisper로 받아써 대본과 견준다. 비용 0원.

    python -I 소리/받아쓰기.py [medium|large-v3-turbo|small] [파일 접두사]   (기본 medium)
    python -I 소리/받아쓰기.py --믹스 <영상.mp4>   렌더한 영상의 소리를 vo표 자리대로 잘라 받아쓴다(효과음·배경음에 묻히는지)

판정: 글자 오차율(CER). 읽는 법이 갈리는 말(AI·싱크·피씨·숫자)은 양쪽을 같은 글로 바꿔 견준다.
"""
import json, os, re, subprocess, sys, tempfile, unicodedata

sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
VO = os.path.join(HERE, '..', 'remotion', 'public', 'vo')

SAME = [
    (r'에이\s*아이|AI|A\.I\.|에이 아이', '에이아이'),
    (r'SYNK|SYNC|Sync|sync|씽크|싱크', '싱크'),
    (r'PC|pc|피시|피씨', '피씨'),
    (r'16\s*개', '열여섯개'), (r'3\s*개', '세개'), (r'열 여섯', '열여섯'),
]


def norm(s):
    s = unicodedata.normalize('NFC', s)
    for a, b in SAME:
        s = re.sub(a, b, s)
    return re.sub(r'[^0-9A-Za-z가-힣]', '', s)


def cer(ref, hyp):
    r, h = norm(ref), norm(hyp)
    if not r:
        return 0.0 if not h else 1.0
    d = list(range(len(h) + 1))
    for i, rc in enumerate(r, 1):
        prev, d[0] = d[0], i
        for j, hc in enumerate(h, 1):
            cur = min(d[j] + 1, d[j - 1] + 1, prev + (rc != hc))
            prev, d[j] = d[j], cur
    return d[len(h)] / len(r)


def main():
    argv = sys.argv[1:]
    from faster_whisper import WhisperModel
    lines = {x['id']: x for x in json.load(open(os.path.join(VO, 'vo.json'), encoding='utf-8'))['lines']}
    if '--믹스' in argv:
        film = argv[argv.index('--믹스') + 1]
        plan = json.load(open(os.path.join(VO, 'place.json'), encoding='utf-8'))  # vo표.mjs가 쓴 자리(초)
        clips = [c for c in plan[os.environ.get('CUT', 'A')]]
        tmp = tempfile.mkdtemp()
        jobs = []
        for c in clips:
            out = os.path.join(tmp, c['id'] + '.wav')
            subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', str(max(0, c['start'] - 0.15)), '-t', str(c['end'] - c['start'] + 0.3), '-i', film,
                            '-vn', '-ac', '1', '-ar', '16000', out], check=True)
            jobs.append((c['id'], out))
        size = 'medium'
    else:
        size = next((a for a in argv if a in ('small', 'medium', 'large-v3-turbo')), 'medium')
        pre = next((a for a in argv if a not in ('small', 'medium', 'large-v3-turbo')), '')
        jobs = [(i, os.path.join(VO, i + '.wav')) for i in lines if i.startswith(pre)]
    model = WhisperModel(size, device='cpu', compute_type='int8')
    worst = 0
    for i, wav in jobs:
        segs, _ = model.transcribe(wav, language='ko', beam_size=5, vad_filter=False)
        hyp = ' '.join(s.text.strip() for s in segs)
        e = cer(lines[i]['text'], hyp)
        worst = max(worst, e)
        print(f"{i}  CER {e:.2f}  {'OK ' if e <= 0.08 else '확인'}  대본: {lines[i]['text']}\n                   받아씀: {hyp}")
    print(f'모델 {size} · 가장 큰 CER {worst:.2f}')


main()
