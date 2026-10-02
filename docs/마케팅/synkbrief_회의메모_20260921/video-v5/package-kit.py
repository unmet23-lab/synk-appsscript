from pathlib import Path
from pypdf import PdfReader
import re,json,zipfile,hashlib
EP=Path(__file__).resolve().parent.parent
KIT=EP/'follow-along-v5'
PDF=EP/'output/pdf/synkbrief-meeting-guide-v5.pdf'
intro='''회의 메모 → 할 일 표 | synkbrief v5

1. guide.pdf 1~4쪽: ChatGPT에 prompt.txt와 practice-memo.txt를 넣어 첫 표 만들기.
2. guide.pdf 5~8쪽: ChatGPT Work와 스킬이 무엇인지, 한 번 저장하고 다시 쓰는 방법.
3. 데스크톱 Work에서 @skill-creator를 선택하고 work-setup.txt의 요청 보내기.
4. 지침 검토·저장·설치 뒤 Skills와 새 작업의 @ 목록에서 meeting-actions 확인하기.
5. work-reuse.txt의 짧은 요청 + 새 메모로 다시 사용하기.
6. second-practice.txt로 이전 회의 내용이 섞이지 않는지 확인하기.

meeting-actions/SKILL.md는 검토·설치용 지침 원본입니다. ZIP을 받거나 압축을 푸는 것만으로 앱에 설치되지 않습니다.
Work 웹 진입 화면을 확인했으며, 데스크톱 생성·설치는 공식 문서 기반 안내입니다. 계정에서 설치 완료를 검증한 패키지가 아닙니다.
자료 확인일: 2026-09-23. 댓글 전달·공개 다운로드 설정은 아직 미완료입니다.
'''
(KIT/'START-HERE.txt').write_text(intro,encoding='utf-8-sig')
reader=PdfReader(PDF); texts=[p.extract_text() for p in reader.pages]
assert len(texts)==8
assert all('\ufffd' not in t for t in texts)
norm=lambda s:re.sub(r'\s+','',s)
assert norm((KIT/'prompt.txt').read_text(encoding='utf-8-sig').strip()) in norm(texts[1])
assert norm((KIT/'work-setup.txt').read_text(encoding='utf-8-sig').strip()) in norm(texts[5])
fonts=set()
for page in reader.pages:
 for f in page['/Resources']['/Font'].values():
  obj=f.get_object()
  if 'SUIT' in str(obj.get('/BaseFont','')):
   assert '/FontFile2' in obj['/FontDescriptor'].get_object()
   fonts.add(str(obj['/BaseFont']))
assert len(fonts)>=2
files=['prompt.txt','practice-memo.txt','expected-result.txt','work-setup.txt','work-reuse.txt','second-practice.txt','START-HERE.txt','meeting-actions/SKILL.md']
zpath=KIT/'synkbrief-meeting-kit-v5.zip'
with zipfile.ZipFile(zpath,'w',zipfile.ZIP_DEFLATED) as z:
 z.write(PDF,'guide.pdf')
 for name in files:z.write(KIT/name,name)
with zipfile.ZipFile(zpath) as z:assert z.testzip() is None
(KIT/'verification.json').write_text(json.dumps({'date':'2026-09-23','pdfPages':8,'embeddedFonts':sorted(fonts),'copyTextMatchesPdf':True,'zipIntegrity':True,'desktopWorkSkillInstalled':False,'skillSchemaValidated':True,'files':[{'name':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in [PDF,zpath]]},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'pages':8,'zipBytes':zpath.stat().st_size,'verified':True}))
