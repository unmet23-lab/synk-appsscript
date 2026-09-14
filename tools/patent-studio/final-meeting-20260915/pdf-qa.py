from pathlib import Path
import hashlib, json, re, subprocess, sys, zipfile
from pypdf import PdfReader
from PIL import Image, ImageDraw
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')
repo=Path(__file__).resolve().parents[3]
folder=Path('C:/Users/q1212/.codex/visualizations/2026/09/11/01a08f0d-d3c5-7c41-9c85-d69384fa2412/IP_디딤돌_준비/미팅완성본/최종미팅가이드_20260915')
qa=json.loads((folder/'검수/verification.json').read_text(encoding='utf-8'))
pdf=folder/(qa['name']+'.pdf')
sha=hashlib.sha256(pdf.read_bytes()).hexdigest()
assert sha==qa['pdfHash']
reader=PdfReader(pdf)
texts=[p.extract_text() for p in reader.pages]
norm=lambda t: ''.join(t.replace('\u02bc','\u2019').split())
assert len(texts)==qa['pages']==13
for i,(text,chunks) in enumerate(zip(texts,qa['expectedText'])):
    assert len(text)>100
    for chunk in chunks:
        assert norm(chunk) in norm(text),(i+1,chunk)
full=norm(''.join(texts))
claims=(repo/'tools/patent-studio/grant-path-20260913/targeted/CLAIM_DECISIONS.md').read_text(encoding='utf-8')
parts=re.findall(r'^\*\*\[(P1-0[1-7])\]\*\*([^\r\n]+)',claims,re.M)
assert len(parts)==7
for claim,text in parts:
    assert norm('['+claim+']'+text) in full,claim
assert all(x in full for x in ['내가변리사에게','변리사의질문에','5분진행순서','발화전도움기록을뒤늦게추가','저장기록재현확인','4320','시제품열기.cmd'])
assert not any(x in full for x in ['{{P1','공개이력','공개시점','unmet23','C:/Users/'])
font_names=set();links=[]
for page in reader.pages:
    assert abs(float(page.mediabox.width)-595.28)<2 and abs(float(page.mediabox.height)-841.89)<2
    for ref in page['/Resources']['/Font'].values():
        font=ref.get_object();font_names.add(str(font.get('/BaseFont','embedded-type3')))
        if font.get('/Subtype')=='/Type3':
            assert font.get('/CharProcs') and font.get('/ToUnicode');continue
        for descendant in font.get('/DescendantFonts',[font]):
            d=descendant.get_object().get('/FontDescriptor')
            assert d and any(k in d.get_object() for k in ['/FontFile','/FontFile2','/FontFile3'])
    for ref in page.get('/Annots',[]):
        action=ref.get_object().get('/A')
        if action and action.get('/URI'):links.append(str(action['/URI']))
assert qa['baselineUrl'] in links
assert all(x.startswith('https://') or x.startswith('http://127.0.0.1:') for x in links)
out=folder/'검수'/('pdf-'+sha[:10]);out.mkdir(exist_ok=True)
poppler=Path('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin/pdftoppm.exe')
subprocess.run([str(poppler),'-r','110','-png',str(pdf),str(out/'page')],check=True)
pages=sorted(out.glob('page-*.png'),key=lambda p:int(p.stem.split('-')[-1]));assert len(pages)==13
contacts=[]
for start in range(0,len(pages),4):
    sheet=Image.new('RGB',(1640,2360),'#EDE7DC');draw=ImageDraw.Draw(sheet)
    for off,f in enumerate(pages[start:start+4]):
        im=Image.open(f).convert('RGB');im.thumbnail((790,1130));x,y=(off%2)*820+15,(off//2)*1180+30
        sheet.paste(im,(x,y));draw.text((x,y-18),f'PAGE {start+off+1}',fill='#2B2320')
    f=out/f'contact-{start//4+1}.png';sheet.save(f);contacts.append(str(f))
result={'pdfHash':sha,'pages':13,'renderedPages':13,'allExpectedTextPreserved':True,'exactP1Paragraphs':7,'textCharacters':[len(t) for t in texts],'fontsEmbedded':True,'fonts':sorted(font_names),'links':links,'mobile':qa['mobile'],'contacts':contacts}
(folder/'검수/pdf-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
launcher=repo/'tools/patent-studio/final-meeting-20260915/start-meeting.cmd'
(folder/'시제품열기.cmd').write_text('@echo off\r\ncall "'+str(launcher)+'"\r\n',encoding='utf-8')
readme='SYNK 특허 미팅 최종 가이드 · 2026.09.15\n\nPDF 한 개를 보시면 됩니다. 1쪽 시작 멘트, 2쪽 질문, 3-4쪽 답변, 5쪽 시연 순서입니다. 변리사에게는 6-11쪽의 그림·실제 화면·선행·청구 문안을 보여주세요.\n\n현재 시제품: '+qa['baselineUrl']+'\n\n링크는 준비된 현재 PC에서 열립니다. 서버가 꺼져 있으면 시제품열기.cmd를 실행하십시오. 이 실행기는 현재 PC의 저장소를 사용하므로 다른 PC로 파일만 복사해서는 실행되지 않습니다.\n\nHTML은 인터넷 없이 읽을 수 있고, Markdown은 수정 가능한 본문입니다. 이미지가 필요하므로 자산 폴더를 같이 보관합니다.\n'
(folder/'먼저읽기.txt').write_text(readme,encoding='utf-8')
archive=folder/'SYNK_특허미팅_최종가이드_전체.zip'
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED) as z:
    for ext in ['.pdf','.html','.md']:
        f=folder/(qa['name']+ext);z.write(f,f.name)
    for name in ['시제품열기.cmd','먼저읽기.txt']:z.write(folder/name,name)
    for f in sorted((folder/'자산').iterdir()):
        if f.is_file():z.write(f,'자산/'+f.name)
with zipfile.ZipFile(archive) as z:assert z.testzip() is None
print(json.dumps({'pdfHash':sha,'pages':13,'fontsEmbedded':True,'textPreserved':True,'exactP1Paragraphs':7,'contacts':contacts,'archive':str(archive)},ensure_ascii=False))
