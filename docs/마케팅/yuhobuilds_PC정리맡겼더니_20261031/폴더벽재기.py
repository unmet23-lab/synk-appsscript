#!/usr/bin/env python
# Y27 폴더 벽 자료 — 실제 옮긴 목록 · 되돌린 목록에서 폴더마다 크기와 갈 곳만 뽑는다(이름 · 경로는 저장소에 넣지 않는다).
#   python -X utf8 폴더벽재기.py  →  자료/폴더벽.json
# 갈래: 0 = 그날 밤 되돌림, 1 = 지우기 전 확인에서 또 되돌림, 2 = 끝까지 남음(진짜 지워도 되는 것), 3 = 목록엔 있고 지금 없음
import json, os, sys
ROOT = r'C:\Users\q1212\Documents\SYNK-appsscript'
TMP = os.path.join(ROOT, '.tmp')
HERE = os.path.dirname(os.path.abspath(__file__))
read = lambda p: [json.loads(l) for l in open(p, encoding='utf-8') if l.strip()]
moved = read(os.path.join(TMP, '공간정리_20261029', 'tmp옮긴목록.jsonl'))
r1 = {r['이름'] for r in read(os.path.join(TMP, 'yt-ai-label-38-carry-20261029', 'restored-from-cleanup.jsonl'))}
r2 = {r['이름'] for r in read(os.path.join(TMP, '공간정리_20261029', '대기되돌린목록.jsonl'))}
wait = r'C:\Users\q1212\SYNK_정리대기\20261029'
left = set(os.listdir(wait))
rows, gone = [], []
for m in moved:
    n, mb = m['이름'], m.get('MB', 0) or 0
    g = 0 if n in r1 else 1 if n in r2 else 2
    if g == 2 and n not in left:
        gone.append(mb)
        g = 3  # 옮긴 목록엔 있지만 지금 정리 대기에 없는 곳 — 남은 469곳에 넣지 않는다
    rows.append([round(mb, 1), g])
sum_gb = lambda g: sum(r[0] for r in rows if r[1] == g) / 1024
at = [m['at'] for m in moved]
out = {
    '폴더': len(rows), '합_GiB': round(sum(r[0] for r in rows) / 1024, 2),
    '그날밤': {'폴더': sum(r[1] == 0 for r in rows), 'GiB': round(sum_gb(0), 2)},
    '또': {'폴더': sum(r[1] == 1 for r in rows), 'GiB': round(sum_gb(1), 2)},
    '남음': {'폴더': sum(r[1] == 2 for r in rows), 'GiB': round(sum_gb(2), 2), '지금폴더': len(left)},
    '목록엔있고지금없음': {'폴더': len(gone), 'GiB': round(sum(gone) / 1024, 2)},
    '옮긴시각': [at[0], at[-1]],
    '행': rows,
}
os.makedirs(os.path.join(HERE, '자료'), exist_ok=True)
json.dump(out, open(os.path.join(HERE, '자료', '폴더벽.json'), 'w', encoding='utf-8'), ensure_ascii=False)
print(json.dumps({k: v for k, v in out.items() if k != '행'}, ensure_ascii=False))
