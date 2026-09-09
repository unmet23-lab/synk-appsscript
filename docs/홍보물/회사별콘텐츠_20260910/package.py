from pathlib import Path
import hashlib, json, re, zipfile
from urllib.parse import unquote

base=Path(__file__).resolve().parent
target=base/'업로드_전체.zip'
files=[]
for p in sorted(base.rglob('*')):
    if not p.is_file(): continue
    rel=p.relative_to(base)
    if '_검토' in rel.parts or p.name.startswith('master-') or p.suffix in ('.zip','.cjs','.py'):
        continue
    files.append(p)
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for p in files: z.write(p,p.relative_to(base).as_posix())
bad=[]
with zipfile.ZipFile(target) as z:
    names=set(z.namelist())
    if z.testzip(): bad.append('CRC')
    for p in files:
        rel=p.relative_to(base).as_posix()
        if hashlib.sha256(p.read_bytes()).digest()!=hashlib.sha256(z.read(rel)).digest(): bad.append(rel)
    for p in files:
        if p.suffix!='.html': continue
        for href in re.findall(r'(?:href|src)="([^"]+)"',p.read_text(encoding='utf8')):
            if href.startswith(('http:','https:','data:','blob:','#')): continue
            q=(p.parent/unquote(href.split('#')[0])).resolve()
            if q==target: continue
            try: rel=q.relative_to(base).as_posix()
            except ValueError: bad.append('outside:'+href); continue
            if rel not in names: bad.append('link:'+rel)
report={'entries':len(files),'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'utf8FilenameRoundtrip':True,'errors':bad}
(base/'_검토/압축검증.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(report,ensure_ascii=False))
if bad: raise SystemExit(1)
