# 고른 목소리 판을 줄마다 자른다(2026-10-30) — 한 번에 읽힌 판을 받아쓰기 낱말 시각으로 대본 줄에 맞추고, 줄 사이 쉼 가운데에서 자른다
# (10-29 루나 판 나누기.py와 같은 방법). 자른 줄마다 다시 받아 적어 그 줄과 맞는지 본다.
#   py -3 -I 나누기.py <작업 폴더> <역> <판 열쇠> <내보낼 폴더> <파일 머리>
#   예: py -3 -I 나누기.py .tmp/drama-voices-20261030 교수 교수_eleven_Elena experiences/drama/s1/소리 ep01-professor
# → <내보낼 폴더>/<머리>-01.mp3 … · <내보낼 폴더>/<머리>.json(줄 · 파일 · 길이 · 다시 받아 적은 글 · 맞음)
import difflib, json, re, subprocess, sys
from pathlib import Path
from faster_whisper import WhisperModel

작업, 역, 열쇠, 내보낼, 머리 = Path(sys.argv[1]), sys.argv[2], sys.argv[3], Path(sys.argv[4]), sys.argv[5]
# 줄 앞 여유(초). 받아쓰기 낱말 시각은 첫소리보다 늦게 잡힐 때가 있어(10-30 감독 8번 「지난번엔」·모범 3번 「과제에」의 첫 닿소리가 잘림)
# 0.25로 둔다 — 앞 줄과의 쉼 가운데를 넘지 않는다. 교수 · 선배 줄은 0.12로 잘랐고 다시 받아 적어 모두 맞았다.
앞여유 = float(sys.argv[6]) if len(sys.argv) > 6 else 0.25
기록 = json.loads((작업 / '기록.json').read_text(encoding='utf-8'))
줄 = json.loads((작업 / f'{역}_줄.json').read_text(encoding='utf-8'))
원본 = 작업 / 기록['판'][열쇠]['판']
내보낼.mkdir(parents=True, exist_ok=True)
norm = lambda s: re.sub(r'[^가-힣0-9]', '', s.replace('삼 학년', '3학년'))
model = WhisperModel('medium', device='cpu', compute_type='int8')

segs, _ = model.transcribe(str(원본), language='ko', word_timestamps=True, beam_size=5, initial_prompt='권태오 문지영 새솔대 연구동 동아리 박람회')
words = [w for s in segs for w in s.words]
hyp, owner = '', []
for i, w in enumerate(words):
    t = norm(w.word); hyp += t; owner += [i] * len(t)
ref = ''.join(norm(l['말']) for l in 줄)
r2h = {}
for a, b, n in difflib.SequenceMatcher(None, ref, hyp, autojunk=False).get_matching_blocks():
    for k in range(n): r2h[a + k] = b + k
def word_at(pos, forward=True):
    rng = range(pos, len(ref)) if forward else range(pos, -1, -1)
    for r in rng:
        if r in r2h: return owner[r2h[r]]
    return len(words) - 1 if forward else 0
pos, spans = 0, []
for l in 줄:
    n = len(norm(l['말'])); spans.append((word_at(pos, True), word_at(pos + n - 1, False))); pos += n
dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(원본)], capture_output=True, text=True).stdout)

def 닮음(a, b):
    a, b = norm(a), norm(b)
    return round(difflib.SequenceMatcher(None, a, b, autojunk=False).ratio(), 3) if (a or b) else 1.0

목록 = []
for i, (a, b) in enumerate(spans):
    s, e = words[a].start, words[b].end
    lo = 0.0 if i == 0 else (words[spans[i - 1][1]].end + s) / 2
    hi = dur if i == len(spans) - 1 else (e + words[spans[i + 1][0]].start) / 2
    t0, t1 = max(lo, s - 앞여유), min(hi, e + 0.35)
    파일 = 내보낼 / f'{머리}-{i + 1:02d}.mp3'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{t0:.3f}', '-to', f'{t1:.3f}', '-i', str(원본),
                    '-af', 'afade=t=in:d=0.01,areverse,afade=t=in:d=0.04,areverse', '-ar', '24000', '-ac', '1', '-b:a', '96k', str(파일)], check=True)
    다시, _ = model.transcribe(str(파일), language='ko', beam_size=5)
    글 = ' '.join(x.text.strip() for x in 다시)
    목록.append({'번호': i + 1, '말': 줄[i]['말'], '되묻기': 줄[i]['되묻기'], '파일': 파일.name, '초': round(t1 - t0, 2), '받아쓰기': 글, '맞음': 닮음(줄[i]['말'], 글)})
    print(f"{파일.name} {t1 - t0:.2f}초 맞음 {목록[-1]['맞음']}")
(내보낼 / f'{머리}.json').write_text(json.dumps({'역': 역, '목소리판': 열쇠, '원본': 원본.name, '줄': 목록}, ensure_ascii=False, indent=1), encoding='utf-8')
