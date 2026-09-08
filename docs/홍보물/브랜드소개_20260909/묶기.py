from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
import json,re
from PIL import Image

root=Path(__file__).resolve().parent
brands=['synk','lab','shift','pulse']
keys=json.loads((root/'사용자산.json').read_text(encoding='utf-8'))
keys=sorted(set(keys+['curious','smile']))
with ZipFile(root/'SYNK-division-logos.zip','w',ZIP_DEFLATED,compresslevel=6) as z:
    for p in sorted((root/'로고디테일/로고_투명').glob('*.png')):
        with Image.open(p) as image:
            assert image.width==3840
            assert image.mode=='RGBA'
        z.write(p,p.name)
    z.write(root/'로고디테일/로고설명.md','읽어주세요.md')
    z.write(root/'로고디테일/완성로고.png','모아보기.png')
with ZipFile(root/'SYNK-LAB-carousel.zip','w',ZIP_DEFLATED,compresslevel=6) as z:
    for folder,dimensions in [('캐러셀_업로드',(1080,1350)),('캐러셀_고해상도',(2160,2700))]:
        for p in sorted((root/folder).glob('*.png')):
            with Image.open(p) as image: assert image.size==dimensions
            z.write(p,p.relative_to(root))
    z.write(root/'미리보기/캐러셀-전체.png','미리보기.png')
    z.writestr('읽어주세요.txt','01부터 07까지 순서대로 사용합니다. 업로드용은 1080×1350, 고해상도는 2160×2700입니다. 몽골어 본문 기계 검문 완료. 발행 전 원어민 감수 필요.\nSYNK LAB · 2026.09.09')

with ZipFile(root/'SYNK-brand-introductions.zip','w',ZIP_DEFLATED,compresslevel=6) as z:
    names=['읽어주세요.md','carousel.html','SYNK-LAB-carousel.zip','SYNK-division-logos.zip','로고디테일/완성로고.png','로고디테일/로고설명.md','자산명세.json','사용자산.json','소개서_문안.json','캐러셀_문안.json']
    names += [f'{b}.{ext}' for b in brands for ext in ['html','pdf']]
    names += [f'assets/{key}.webp' for key in keys]
    names += [f'미리보기/{b}-1.png' for b in brands]+['미리보기/캐러셀-전체.png','미리보기/소개서-표지.png']
    for name in names:z.write(root/name,name)
    index=(root/'index.html').read_text(encoding='utf-8')
    index=re.sub(r'<nav><a href="SYNK-brand-introductions.zip".*?</nav>','',index)
    z.writestr('index.html',index)

summary=[]
for filename in ['SYNK-LAB-carousel.zip','SYNK-division-logos.zip','SYNK-brand-introductions.zip']:
    with ZipFile(root/filename) as z:
        assert z.testzip() is None
        summary.append({'file':filename,'files':len(z.namelist()),'bytes':(root/filename).stat().st_size})
(root/'묶음검사.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(summary,ensure_ascii=False))
