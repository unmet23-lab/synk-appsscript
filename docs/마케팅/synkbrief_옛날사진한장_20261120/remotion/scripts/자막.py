# 대본 자막(SRT)을 timeline.ts의 말 시각과 줄 파일 길이로 만든다 — 이해 시험(--말)과 기획.md 대본 대조에 쓴다.
#   python -I -X utf8 scripts/자막.py   (remotion 폴더에서) → ../자막.srt
import json, re, subprocess, sys
from pathlib import Path
R = Path(__file__).resolve().parent.parent
ts = (R / 'src' / 'timeline.ts').read_text(encoding='utf8')
plan = json.loads((R.parent / '음성' / '계획.json').read_text(encoding='utf8'))
text = {l['id']: l['text'] for l in plan['lines']}
S = dict((k, float(v)) for k, v in re.findall(r'^\s+(\w+): ([0-9.]+),', ts.split('export const S = {')[1].split('};')[0], re.M))
rows = []
for m in re.finditer(r"\{ id: '(\w+)', t: ([^}]+?) \}", ts.split('export const VO')[1].split('];')[0]):
    vid, expr = m.group(1), m.group(2).strip()
    t = eval(re.sub(r'S\.(\w+)', lambda x: str(S[x.group(1)]), expr))
    wav = R / 'public' / 'vo' / f'{vid}.wav'
    d = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(wav)], capture_output=True, text=True).stdout)
    rows.append((t, t + d, text[vid]))
fmt = lambda s: f'{int(s // 3600):02d}:{int(s % 3600 // 60):02d}:{int(s % 60):02d},{int(round(s * 1000)) % 1000:03d}'
out = '\n'.join(f'{i}\n{fmt(a)} --> {fmt(b)}\n{tx}\n' for i, (a, b, tx) in enumerate(rows, 1))
(R.parent / '자막.srt').write_text(out, encoding='utf8')
print(out)
