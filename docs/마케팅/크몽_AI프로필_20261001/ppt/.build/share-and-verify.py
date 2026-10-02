from pathlib import Path
import json, hashlib, zipfile, re, subprocess
from xml.etree import ElementTree as ET
from reportlab.pdfgen.canvas import Canvas
from pypdf import PdfReader

workspace = Path(__file__).resolve().parents[1]
output = workspace / 'output'
review = workspace / 'review'
pdf_path = output / '유호_프로필_소개자료_예시.pdf'
canvas = Canvas(str(pdf_path), pagesize=(960, 540), pageCompression=1)
canvas.setTitle('유호 프로필 소개 자료 - AI 프로필 활용 예시')
canvas.setAuthor('SYNK PULSE')
for i in range(1, 6):
    canvas.drawImage(str(review / f'example-{i:02}.png'), 0, 0, width=960, height=540)
    canvas.showPage()
canvas.save()
reader = PdfReader(pdf_path)
assert len(reader.pages) == 5
for page in reader.pages:
    assert float(page.mediabox.width) == 960 and float(page.mediabox.height) == 540
subprocess.run(['C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin/pdftoppm.exe','-png','-r','96',str(pdf_path),str(review/'pdf')],check=True,capture_output=True)

namespaces = {'p':'http://schemas.openxmlformats.org/presentationml/2006/main','a':'http://schemas.openxmlformats.org/drawingml/2006/main'}
evidence = {'pdf': {'pages':5,'sizePoints':[960,540],'sha256':hashlib.sha256(pdf_path.read_bytes()).hexdigest(),'kind':'공유용 이미지 기반 PDF. 편집과 텍스트 검색은 PPTX 사용.','renderedWith':'Poppler'}, 'pptx':[]}
for filename, expected in [('AI_프로필_소개자료_양식.pptx',7),('유호_프로필_소개자료_예시.pptx',5)]:
    file = output / filename
    slides = []
    with zipfile.ZipFile(file) as deck:
        for part in sorted([n for n in deck.namelist() if re.fullmatch(r'ppt/slides/slide\d+\.xml',n)],key=lambda n:int(re.search(r'slide(\d+)',n).group(1))):
            xml = ET.fromstring(deck.read(part))
            boxes = xml.findall('.//p:sp/p:txBody', namespaces)
            texts = [t.text for box in boxes for t in box.findall('.//a:t',namespaces) if t.text]
            pictures = xml.findall('.//p:pic',namespaces)
            assert len(boxes) >= 6, (part, 'not native text boxes')
            assert len(pictures) >= 2, (part, 'missing editable native images')
            if '예시' in filename:
                assert not any('[' in t or ']' in t for t in texts), (part,'unfinished placeholder')
            slides.append({'part':part,'nativeTextBoxes':len(boxes),'nativePictures':len(pictures),'textCharacters':sum(len(t) for t in texts)})
        assert len(slides)==expected
        notes = [n for n in deck.namelist() if re.fullmatch(r'ppt/notesSlides/notesSlide\d+\.xml',n)]
        assert len(notes)==expected
    evidence['pptx'].append({'filename':filename,'slides':slides,'notesCount':len(notes),'sha256':hashlib.sha256(file.read_bytes()).hexdigest()})
evidence['nativePowerPointExecutionVerified'] = False
(review / 'delivery-check.json').write_text(json.dumps(evidence,ensure_ascii=False,indent=2),encoding='utf-8')
print('PDF 5 pages rendered; PPTX 7/5 native text, pictures and notes verified.')
