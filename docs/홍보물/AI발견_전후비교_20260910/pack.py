from pathlib import Path
import hashlib,json,zipfile
root=Path(__file__).resolve().parent
files=[root/'읽어주세요.md']
for key in ('lab','shift'):
    files += sorted((root/key).glob('upload-*.jpg'))
    files += sorted((root/key).glob('*.txt'))
    files += [root/key/'업로드안내.md',root/key/'material.md']
target=root/'비교판_업로드.zip'
with zipfile.ZipFile(target,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for p in files:z.write(p,p.relative_to(root).as_posix())
with zipfile.ZipFile(target) as z:
    assert z.testzip() is None
    for p in files:assert hashlib.sha256(z.read(p.relative_to(root).as_posix())).digest()==hashlib.sha256(p.read_bytes()).digest()
report={'files':len(files),'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'all_entries_verified':True}
(root/'_검토'/'ZIP검증.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps(report))
