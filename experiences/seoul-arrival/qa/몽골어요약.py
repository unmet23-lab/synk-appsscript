# 몽골어 검문 결과(.tmp/seoul-mn/결과.jsonl)를 한 장으로: 문법 판정 · 맞춤법 의심과, 원문 · 역번역을 줄마다 나란히(뜻 대조용)
#   python -X utf8 experiences/seoul-arrival/qa/몽골어요약.py [--판정만]
import json,re,sys,pathlib
R=pathlib.Path('.tmp/seoul-mn')
only='--판정만' in sys.argv
seen={}
for l in open(R/'결과.jsonl',encoding='utf-8'):
    r=json.loads(l);seen[r['i']]=r
for i in sorted(seen):
    r=seen[i];o=r['out']
    g=re.search(r'■ 문법[^\n]*\n\s*판정:\s*([^\n]*)',o)
    s=re.search(r'■ 맞춤법[^\n]*\n((?:[^\n■]+\n)+)',o)
    back=re.search(r'■ 직역 역번역[^\n]*\n((?:.|\n)*?)\n\n■',o)
    src=(R/f'묶음{i:02d}.txt').read_text(encoding='utf-8').split('\n---\n')
    ko=src[0].split('\n');mn=src[1].strip().split('\n') if len(src)>1 else []
    print(f'## 묶음 {i} · 종료 {r["code"]} · 문법: {g.group(1)[:300] if g else "(못 읽음)"}')
    if s:
        t=s.group(1).strip()
        if '의심 낱말 없음' not in t:print('   맞춤법:',t[:400].replace('\n',' / '))
    if not only and back:
        bk=[x.strip() for x in back.group(1).split('\n') if x.strip()]
        for j,k in enumerate(ko):
            print(f'{j+1:>2}. {k}\n    {mn[j] if j<len(mn) else "?"}\n    ← {bk[j] if j<len(bk) else "?"}')
