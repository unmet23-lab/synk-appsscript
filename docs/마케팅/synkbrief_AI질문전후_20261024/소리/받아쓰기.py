# -*- coding: utf-8 -*-
"""구운 나레이션(remotion/public/vo/*.wav)을 로컬 faster-whisper로 받아써 대본과 견준다. 비용 0원.

    python -I 소리/받아쓰기.py [medium|large-v3-turbo|small] [파일 접두사]   (기본 medium)
    python -I 소리/받아쓰기.py --믹스 <영상.mp4> [모델]   렌더한 영상의 소리를 자리(place.json)대로 잘라 받아쓴다(효과음·배경음에 묻히는지, CUT=A|B)

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
    (r'챗\s*GPT|챗\s*지피티|ChatGPT|chatGPT|챗 지 피 티', '챗지피티'),
    (r'2만\s*9천\s*원|29,?000\s*원|이만\s*구천\s*원', '이만구천원'),
    (r'1만\s*3천\s*원|만\s*3천\s*원|13,?000\s*원|만\s*삼천\s*원', '만삼천원'),
    (r'7,?500\s*원|7천\s*5백\s*원|칠천\s*오백\s*원', '칠천오백원'),
    (r'22\s*달러|이십이\s*달러', '이십이달러'), (r'18\s*달러|십팔\s*달러', '십팔달러'),
    (r'10월\s*31일|시월\s*삼십일\s*일|10\s*월\s*31\s*일', '시월삼십일일'),
    (r'40\s*%|40\s*퍼센트|사십\s*퍼센트', '사십퍼센트'),
    (r'200\s*만\s*원|이백만\s*원', '이백만원'), (r'PIN|핀|빈', '핀'), (r'Claude|claude|클로드|클라우드', '클로드'), (r'Gmail|G메일|지 메일|지메일', '지메일'), (r'5s*개|다섯s*개', '다섯개'), (r'1\s*분|일\s*분', '일분'), (r'4\s*자리|네\s*자리', '네자리'), (r'3\s*개|세\s*개', '세개'),
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
        size = next((a for a in argv if a in ('small', 'medium', 'large-v3-turbo')), 'medium')
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
