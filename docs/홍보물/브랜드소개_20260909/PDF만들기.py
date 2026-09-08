from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader
from PIL import Image
from io import BytesIO
import json

root=Path(__file__).resolve().parent
results=[]
for key,title in [('synk','SYNK'),('lab','SYNK LAB'),('shift','SYNK SHIFT'),('pulse','SYNK PULSE')]:
    target=root/f'{key}.pdf'
    pdf=canvas.Canvas(str(target),pagesize=(1080,675),pageCompression=1)
    pdf.setTitle(title+' | Business & Collaboration')
    pdf.setAuthor('SYNK')
    pdf.setSubject('2026-09-09 — Korean introduction, five pages')
    for page in range(1,6):
        with Image.open(root/'소개서_4K'/f'{key}-{page}.png') as source:
            image=BytesIO()
            source.convert('RGB').save(image,format='JPEG',quality=97,subsampling=0,optimize=True)
            image.seek(0)
            pdf.drawImage(ImageReader(image),0,0,width=1080,height=675)
        pdf.showPage()
    pdf.save()
    check=PdfReader(str(target))
    assert len(check.pages)==5
    assert all(float(p.mediabox.width)==1080 and float(p.mediabox.height)==675 for p in check.pages)
    results.append({'file':target.name,'pages':len(check.pages),'bytes':target.stat().st_size,'imagePixels':[3840,2400],'pagePoints':[1080,675]})
(root/'PDF검사.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(results,ensure_ascii=False))
