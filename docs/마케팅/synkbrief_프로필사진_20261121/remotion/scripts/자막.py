# 대본 자막(SRT)을 timeline.ts의 말 시각과 줄 파일 길이로 만든다 — 이해 시험(--말)과 기획.md 대본 대조에 쓴다.
#   python -I -X utf8 scripts/자막.py   (remotion 폴더에서) → ../자막.srt(인스타 판) · ../자막_유튜브.srt · ../자막_틱톡.srt
# N6은 영상에서 쉼표 자리마다 나눠 놓으므로 첫 도막의 시작과 끝 도막의 끝으로 한 줄을 적는다.
import json, re
from pathlib import Path
R = Path(__file__).resolve().parent.parent
ts = (R / 'src' / 'timeline.ts').read_text(encoding='utf8')
plan = json.loads((R.parent / '음성' / '계획.json').read_text(encoding='utf8'))
text = {l['id']: l['text'] for l in plan['lines']}
dur = {l['id']: json.loads((R.parent / '음성' / '범수' / f"{l['id']}.json").read_text(encoding='utf8'))['dur'] for l in plan['lines']}
n7 = float(re.search(r'export const N7_AT = ([0-9.]+);', ts).group(1))
segs = {}
for m in re.finditer(r"\{ id: '(\w+)', t: ([0-9.]+)(?:, from: ([0-9.]+))?(?:, to: ([0-9.]+))? \}", ts.split('export const VO')[1].split('];')[0]):
    vid, t, a, b = m.group(1), float(m.group(2)), float(m.group(3) or 0), m.group(4)
    end = t + ((float(b) if b else dur[vid]) - a)
    s = segs.setdefault(vid, [t, end]); s[0] = min(s[0], t); s[1] = max(s[1], end)
fmt = lambda s: f'{int(s // 3600):02d}:{int(s % 3600 // 60):02d}:{int(s % 60):02d},{int(round(s * 1000)) % 1000:03d}'
for name, last in (('자막.srt', 'N7'), ('자막_유튜브.srt', 'N7Y'), ('자막_틱톡.srt', 'N7T')):
    rows = [(a, b, text[v]) for v, (a, b) in sorted(segs.items(), key=lambda kv: kv[1][0])] + [(n7, n7 + dur[last], text[last])]
    out = '\n'.join(f'{i}\n{fmt(a)} --> {fmt(b)}\n{tx.replace("챗지피티", "ChatGPT")}\n' for i, (a, b, tx) in enumerate(rows, 1))
    (R.parent / name).write_text(out, encoding='utf8')
    if name == '자막.srt': print(out)
