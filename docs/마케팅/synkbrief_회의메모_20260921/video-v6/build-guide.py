from pathlib import Path
import shutil, json, zipfile
from PIL import Image
EP=Path(__file__).resolve().parent.parent
VIDEO=EP/'video-v6'; KIT=EP/'follow-along-v6'; KIT.mkdir(exist_ok=True)
(KIT/'tmp').mkdir(exist_ok=True)
for f in ['SUIT-Regular.ttf','SUIT-Bold.ttf']: shutil.copyfile(EP/'follow-along/tmp'/f,KIT/'tmp'/f)
instructions=(VIDEO/'project-instructions.txt').read_text(encoding='utf-8-sig')
first='''지수: 소개 페이지 문구는 제가 9월 23일까지 수정할게요.
민호: 설문 초안은 제가 맡을게요. 마감은 아직 정하지 않았어요.
고객 인터뷰는 해보자는 의견만 나왔고, 진행 여부와 담당자는 미정이에요.
다음 회의는 9월 25일 오후 2시예요.'''
second='''수진: 견적서는 제가 10월 2일까지 보낼게요.
도윤: 자료 조사는 제가 할게요. 기한은 아직 정하지 않았어요.
다음 회의는 10월 4일이에요.'''
reuse='프로젝트 지침에 맞춰 이번 회의 메모를 정리해줘.\n\n[이번 회의 메모 붙여넣기]'
repair='프로젝트 지침에 맞춰 다시 정리해줘. 근거 문장 열을 포함한 네 열 표로 만들고, 미정인 담당자·기한은 ‘확인 필요’로 표시해줘.'
for f,t in [('project-instructions.txt',instructions),('practice-1.txt',first),('practice-2.txt',second),('every-meeting.txt',reuse),('repair-format.txt',repair)]: (KIT/f).write_text(t+'\n',encoding='utf-8-sig')
src=(EP/'follow-along/build_guide.py').read_text(encoding='utf-8-sig').split('prompt=(EP/')[0]
src=src.replace("'synkbrief-meeting-guide.pdf'","'synkbrief-meeting-guide-v6.pdf'").replace('2026.09.22','2026.09.23').replace("f'{n} / 4'","f'{n} / 8'")
scope=globals()|{'__file__':str(KIT/'guide-source.py')}
exec(compile(src,str(KIT/'guide-source.py'),'exec'),scope)
for key in ['p','box','image','header','table','escape']: globals()[key]=scope[key]
# Helper definitions from the existing guide have their own globals dictionary.
g=p.__globals__; c=g['c']; OUT=g['OUT']; pdf_path=g['pdf_path']
def crop(name,rect):
    dest=KIT/'tmp'/(name+'.png'); Image.open(VIDEO/'assets/project'/(name+'.png')).crop(rect).save(dest); return dest
def para(t,y,size=12): return p(t,48,y,499,size)
def title(t,y): return p(t,48,y,499,17,bold=True)

header(1,'반복해서 쓰는 회의 정리','지침은 한 번, 메모는 매번','ChatGPT 프로젝트에 회의 정리 규칙을 저장하는 따라 하기 가이드')
box(48,205,499,135)
p('완성하면 이렇게 사용해요',65,222,465,13,bold=True,color='#3D6BC9')
p('회의 정리 프로젝트 열기 → 새 채팅에 이번 메모 넣기<br/>→ 담당자·기한·근거 확인 → 팀 문서에 복사하기',65,260,465,15)
title('프로젝트는 어떤 기능인가요?',380)
para('관련 대화·자료·지침을 모아 두는 작업 공간이에요. “회의 정리” 프로젝트에 표 형식과 정리 규칙을 저장하면, 그 안에서 새 채팅을 시작할 때도 같은 지침을 사용할 수 있어요.',418)
title('이번에 준비할 것',525)
para('① ChatGPT에 로그인한 웹 브라우저<br/>② 제공된 project-instructions.txt<br/>③ 텍스트 회의 메모. 처음에는 practice-1.txt로 연습하세요.',561)
para('녹음·자동 받아쓰기는 이번 안내의 범위가 아니에요. 실제 업무에서는 회사에서 사용을 허용한 메모를 사용하세요.',674,10.5)
para('읽는 순서: 범위 구분 → 프로젝트 만들기 → 지침 저장 → 첫 실행 → 결과 확인 → 다음 회의 → 문제 해결',739,10)
c.showPage()

header(2,'계정 전체와 구분하기','회의 규칙은 프로젝트에만','이 회의 정리 지침을 계정 전체 맞춤 지침에는 넣지 마세요.')
title('왜 계정 전체에 넣으면 안 되나요?',206)
para('계정 전체 맞춤 지침은 일반적인 다른 대화에도 적용돼요. 회의 정리만을 위한 표 형식이나 확인 규칙을 넣으면, 글쓰기·여행 계획 같은 무관한 요청에도 그 규칙이 영향을 줄 수 있어요.',248)
box(48,344,499,139,color='#FFF0C7')
p('범위 차이를 설명하는 가상 예시',65,360,460,10,bold=True)
p('“항상 담당자와 기한을 표로 정리해줘”를 계정 전체에 저장하면, 여행 질문에도 필요 없는 담당자·기한 표가 나올 수 있어요. 반드시 이렇게 나온다는 뜻은 아니에요.',65,393,461,12)
table([['위치','이번 용도'],['계정 설정 → 개인화 → 맞춤 지침','이번 회의 지침을 여기에 넣지 않습니다. 모든 대화에 공통으로 필요한 선호와 구분하세요.'],['회의 프로젝트 → ⋯ → 프로젝트 설정 → 지침','여기에 저장합니다. 이 프로젝트 안에 적용되는 회의 정리 규칙입니다.']],516,[234,265],10.5)
para('계정 전체 맞춤 지침 자체가 나쁜 기능이라는 뜻은 아니에요. 이번 목적에 비해 적용 범위가 넓어서 저장 위치를 나누는 거예요.',714,10.5)
c.showPage()

header(3,'한 번만 설정 · 1','회의 정리 프로젝트 만들기','이름을 알아보기 쉽게 정하면 다음 회의 때 찾기 쉬워요.')
title('01  프로젝트 → 새 프로젝트',204)
para('chatgpt.com에 로그인하고 사이드바에서 프로젝트를 여세요. “새 프로젝트”를 누르고 “회의 정리 · 우리 팀”처럼 용도가 보이는 이름을 적습니다. 화면에 따라 사이드바에 새 프로젝트가 바로 보일 수 있어요.',241,11)
image(crop('02-create',(384,228,896,492)),48,339,499)
para('예시는 가상 메모로 만든 “회의 정리 · synkbrief 실습”입니다.',639,10)
title('메모리 옵션은 지침과 별개예요',675)
para('프로젝트 전용 메모리를 선택하면 외부 대화와 구분할 수 있어요. 그래도 같은 프로젝트의 다른 채팅은 참고할 수 있으므로, “이번 메모만 사용”이라는 지침과 결과 확인이 필요합니다.',713,10.5)
c.showPage()

header(4,'한 번만 설정 · 2','프로젝트의 지침 칸에 저장','프로필의 계정 설정이나 일반 채팅 입력창과 구분하세요.')
title('02  프로젝트 이름 옆 ⋯ → 프로젝트 설정',204)
image(crop('04-menu',(280,90,1070,380)),48,243,499)
title('03  project-instructions.txt 전체 복사',450)
para('파일을 열고 Ctrl+A → Ctrl+C로 전체 복사하세요. 프로젝트 설정의 “지침” 칸에 Ctrl+V로 붙여넣고 저장을 누릅니다. 휴대폰에서는 길게 눌러 선택·복사·붙여넣기 하세요.',490,11)
box(48,583,499,91)
p('꼭 확인하세요',64,598,465,12,bold=True,color='#3D6BC9')
p('설정 창을 닫았다가 다시 열어 내용이 남아 있는지 확인하세요.<br/>파일을 소스에 첨부하는 것과 지침 칸에 저장하는 것은 달라요.',64,626,465,10.5)
para('지침을 고칠 때도 이 경로를 사용해요. 계정 전체 설정은 바꿀 필요가 없습니다. 화면 메뉴는 계정·기기·업데이트에 따라 조금 다를 수 있어요.',713,10.5)
c.showPage()

header(5,'복사용 지침과 이유','이 규칙을 한 번 저장하세요','아래 전문은 project-instructions.txt에도 들어 있어요.')
box(48,199,499,403)
p(escape(instructions).replace('\n','<br/>'),64,215,467,11.5,18)
title('왜 이런 조건이 들어 있나요?',633)
para('네 열: 실행할 내용과 원문 근거를 같이 봅니다.<br/>확인 필요: 정하지 않은 날짜를 만들어 넣지 않게 요청합니다.<br/>제안 분리: “해보자”는 의견을 확정된 업무로 바꾸지 않게 합니다.<br/>이번 메모만: 다른 회의의 이름과 날짜가 섞이지 않게 요청합니다.',670,11)
c.showPage()

header(6,'첫 회의 · 입력과 검토','이번 메모만 넣고 실행하세요','프로젝트 첫 화면의 “이 프로젝트에서 새 채팅” 입력창을 사용해요.')
para('every-meeting.txt의 짧은 요청 뒤에 practice-1.txt를 붙이세요. 아래 연습 입력을 한 번에 보내도 됩니다. 오른쪽 위쪽 화살표가 보내기 버튼이에요.',202,11)
box(48,267,499,200)
p(escape('프로젝트 지침에 맞춰 이번 회의 메모를 정리해줘.\n\n'+first).replace('\n','<br/>'),64,282,466,11,17)
title('답변에서 네 열이 모두 있는지 보세요',496)
para('할 일 / 담당자 / 기한 / 근거 문장. 지수의 기한은 9월 23일, 민호의 기한은 “확인 필요”여야 해요. 고객 인터뷰는 제안이므로 확인 질문으로 분리합니다.',534,11)
title('실제 첫 답변에서도 근거 열이 빠졌어요',615)
para('지침 저장을 확인했어도 결과가 빠질 수 있어요. 같은 채팅에 repair-format.txt를 보내니 네 열과 원문 근거가 보완됐습니다. 문제가 생겼을 때 이 방법으로 바로잡으세요.',653,11)
para('보완 요청: “프로젝트 지침에 맞춰 네 열 표로 다시 정리해줘. 근거 문장을 넣고, 미정은 확인 필요로 표시해줘.”',740,10)
c.showPage()

header(7,'다음 회의 · 다시 쓰기','새 회의는 새 채팅으로','같은 회의의 보완만 기존 채팅에서 이어 말하세요.')
title('04  프로젝트 고정 → 다음에 다시 열기',205)
para('프로젝트 이름 옆 ⋯ → 프로젝트 고정을 누르면 쉽게 찾을 수 있어요. 고정은 목록에서 찾기 위한 기능이며 지침을 저장하는 기능은 아닙니다.',243,11)
title('05  프로젝트 첫 화면에서 새 메모 입력',326)
para('기존 채팅을 계속 늘리지 말고 프로젝트 첫 화면의 새 채팅 입력창을 사용하세요. every-meeting.txt의 짧은 요청과 practice-2.txt만 넣어 시험합니다.',365,11)
box(48,452,499,116)
p(escape(second).replace('\n','<br/>'),64,466,465,11,18)
table([['확인할 값','맞는 결과'],['견적서 발송','수진 · 10월 2일'],['자료 조사','도윤 · 확인 필요'],['다음 회의 10월 4일','도윤의 작업 마감으로 넣으면 안 됨']],595,[206,293],10)
para('새 채팅을 열어도 같은 프로젝트의 다른 대화를 참고할 수 있어요. 첫 연습의 이름·날짜가 섞이지 않았는지 확인하세요. 실제 두 번째 응답은 다음 회의도 별도 행에 표시했어요. 업무 표와 분리해 달라고 요청할 수 있습니다.',737,10)
c.showPage()

header(8,'마무리와 문제 해결','검토한 뒤 업무에 사용하세요','PDF와 복사용 파일은 함께 보관해 두고 필요할 때 꺼내 쓰세요.')
table([['문제 또는 할 일','이렇게 해보세요'],['지침이 적용되지 않는 듯해요','현재 채팅이 회의 프로젝트 안인지 확인하세요. 프로젝트 설정을 다시 열어 저장 내용을 확인하고 repair-format.txt로 빠진 형식을 요청하세요.'],['지난 회의 내용이 섞여요','새 회의인지 확인하고, 이번 메모만 사용하도록 다시 요청하세요. 서로 다른 팀·업무는 별도 프로젝트로 나누세요.'],['담당자·기한이 확인 필요예요','참여자에게 물어본 뒤 표를 수정하세요. 확인 필요는 오류가 아니라 아직 정하지 않은 정보일 수 있어요.'],['표를 업무에 쓰고 싶어요','원문 대조 → 미정 사항 확인 → 표의 복사 버튼 → 팀 문서에 붙여넣기. 붙여넣은 표 모양도 확인하세요.']],203,[142,357],10)
title('제공 파일',608)
para('project-instructions.txt: 한 번 저장할 지침<br/>every-meeting.txt: 매 회의 짧은 요청<br/>practice-1/2.txt: 가상 연습 메모<br/>repair-format.txt: 형식이 빠졌을 때 보완 요청',642,10.5)
p('공식 출처 · 2026-09-23 확인',48,740,499,9,bold=True)
p('<link href="https://help.openai.com/en/articles/10169521-projects-in-chatgpt" color="#3D6BC9">Projects in ChatGPT</link> · <link href="https://help.openai.com/en/articles/8096356-custom-instructions-for-chatgpt" color="#3D6BC9">Custom Instructions</link> · <link href="https://learn.chatgpt.com/docs/projects" color="#3D6BC9">프로젝트 시작 가이드</link>',48,763,499,8.5)
c.save()
(KIT/'guide-layout.json').write_text(json.dumps(g['used'],ensure_ascii=False,indent=2),encoding='utf-8')
shutil.copyfile(pdf_path,KIT/pdf_path.name)
(KIT/'README.md').write_text('# 회의 정리 프로젝트 따라 하기\n\n2026-09-23 실제 ChatGPT 웹 시연 기준. PDF를 먼저 읽으세요.\n\n이 지침은 계정 전체 맞춤 지침에 넣지 않습니다. 회의 프로젝트의 ⋯ → 프로젝트 설정 → 지침에 저장하세요.\n\n첫 답변의 근거 열 누락과 보완 과정을 포함한 검토용 자료입니다. 실제 응답의 표현은 달라질 수 있으므로 원문과 대조하세요.\n',encoding='utf-8')
with zipfile.ZipFile(KIT/'synkbrief-meeting-kit-v6.zip','w',zipfile.ZIP_DEFLATED) as z:
    for f in sorted(KIT.iterdir()):
        if f.suffix in ['.txt','.pdf','.md']: z.write(f,f.name)
print(json.dumps({'pdf':str(pdf_path),'pages':8,'kit':str(KIT)},ensure_ascii=False))
