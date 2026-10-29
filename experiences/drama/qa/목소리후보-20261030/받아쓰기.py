# 목소리 후보 받아쓰기 대조(2026-10-30) — 판마다 받아 적어 대본 줄과 견준다: 꼬리표를 소리 내 읽었는지, 줄이 빠졌거나 지어낸 말이 붙었는지.
#   py -3 -I 받아쓰기.py <작업 폴더>     → <작업>/받아쓰기.json, 판마다 한 줄 요약
# faster-whisper small(CPU int8, 현장노트 영상 「faster-whisper가 GPU에서 cublas64_12.dll…」), 언어 ko 고정.
import json, sys, re, pathlib, unicodedata
from faster_whisper import WhisperModel

작업 = pathlib.Path(sys.argv[1])
기록 = json.loads((작업/'기록.json').read_text(encoding='utf-8'))
model = WhisperModel('small', device='cpu', compute_type='int8')

def 정규(s):
    s = unicodedata.normalize('NFC', s).replace('삼 학년', '3학년').replace('삼학년', '3학년')
    return re.sub(r'[\s.,!?…~\'"“”‘’·:;()「」\-\[\]]', '', s)
def 일치(a, b):
    a, b = list(정규(a)), list(정규(b))
    if not a and not b: return 1.0
    앞 = list(range(len(b)+1))
    for i in range(1, len(a)+1):
        지금 = [i]
        for j in range(1, len(b)+1):
            지금.append(min(앞[j]+1, 지금[j-1]+1, 앞[j-1]+(a[i-1] != b[j-1])))
        앞 = 지금
    return round(1 - 앞[len(b)]/max(len(a), len(b)), 3)

결과파일 = 작업/'받아쓰기.json'
결과 = json.loads(결과파일.read_text(encoding='utf-8')) if 결과파일.exists() else {}
for 열쇠, 판 in 기록['판'].items():
    # 이미 받아 적은 판은 다시 하지 않는다(새로 구운 역만).
    if not 판.get('판') or 열쇠 in 결과: continue
    줄 = json.loads((작업/f"{판['역']}_줄.json").read_text(encoding='utf-8'))
    대본 = ' '.join(l['말'] for l in 줄)
    segs, _ = model.transcribe(str(작업/판['판']), language='ko', vad_filter=True, beam_size=5)
    글 = ' '.join(s.text.strip() for s in segs)
    영어 = re.findall(r'[A-Za-z]{3,}', 글)
    결과[열쇠] = {'일치': 일치(대본, 글), '영어낱말': 영어, '받아쓰기': 글}
    print(f"{열쇠}: 일치 {결과[열쇠]['일치']} · 영어 낱말 {영어[:5]}")
(작업/'받아쓰기.json').write_text(json.dumps(결과, ensure_ascii=False, indent=1), encoding='utf-8')
