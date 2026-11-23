# 대본 자막(SRT)을 timeline.ts의 말 시각과 줄 파일 길이로 만든다 — 이해 시험(--말)과 기획.md 대본 대조에 쓴다.
#   python -I -X utf8 scripts/자막.py   (remotion 폴더에서) → ../자막.srt(인스타 · 틱톡 판) · ../자막_유튜브.srt
import json, re
from pathlib import Path
R = Path(__file__).resolve().parent.parent
ts = (R / 'src' / 'timeline.ts').read_text(encoding='utf8')
plan = json.loads((R.parent / '음성' / '계획.json').read_text(encoding='utf8'))
text = {l['id']: l['text'] for l in plan['lines']}
dur = {l['id']: json.loads((R.parent / '음성' / '범수' / f"{l['id']}.json").read_text(encoding='utf8'))['dur'] for l in plan['lines']}
n7 = float(re.search(r'export const N7_AT = ([0-9.]+);', ts).group(1))
vo = [(m.group(1), float(m.group(2))) for m in re.finditer(r"\{ id: '(\w+)', t: ([0-9.]+) \}", ts.split('export const VO')[1].split('];')[0])]
fmt = lambda s: f'{int(s // 3600):02d}:{int(s % 3600 // 60):02d}:{int(s % 60):02d},{int(round(s * 1000)) % 1000:03d}'
for name, last in (('자막.srt', 'N7'), ('자막_유튜브.srt', 'N7Y')):
    rows = [(t, t + dur[v], text[v]) for v, t in vo] + [(n7, n7 + dur[last], text[last])]
    out = '\n'.join(f'{i}\n{fmt(a)} --> {fmt(b)}\n{tx}\n' for i, (a, b, tx) in enumerate(rows, 1))
    (R.parent / name).write_text(out, encoding='utf8')
    if name == '자막.srt': print(out)
