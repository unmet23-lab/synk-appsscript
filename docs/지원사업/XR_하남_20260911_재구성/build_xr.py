"""XR 부문2 교체본. 공모 지정 맑은고딕 10pt, 블라인드 본문 및 독립 구조도."""
from pathlib import Path
import hashlib
import json
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'output/pdf/XR_하남_20260911'
OUT.mkdir(parents=True, exist_ok=True)
TOKENS = json.loads((ROOT / 'docs/디자인_토큰.json').read_text(encoding='utf-8'))
C = {x['이름']: colors.HexColor(x['hex']) for x in TOKENS['색']['킷']}
pdfmetrics.registerFont(TTFont('XRBody', 'C:/Windows/Fonts/malgun.ttf'))
pdfmetrics.registerFont(TTFont('XRHead', 'C:/Windows/Fonts/malgunbd.ttf'))
pdfmetrics.registerFontFamily('XRBody', normal='XRBody', bold='XRHead')
W, H = A4
WIDTH = W - 36*mm
styles = {
    'body': ParagraphStyle('body',fontName='XRBody',fontSize=10,leading=15,spaceAfter=7,textColor=C['Ink'],wordWrap='CJK'),
    'title': ParagraphStyle('title',fontName='XRHead',fontSize=19,leading=27,spaceAfter=12,textColor=C['Ink'],wordWrap='CJK'),
    'section': ParagraphStyle('section',fontName='XRHead',fontSize=12,leading=18,spaceBefore=10,spaceAfter=7,textColor=C['Ink'],wordWrap='CJK'),
    'small': ParagraphStyle('small',fontName='XRBody',fontSize=8,leading=12,spaceAfter=5,textColor=C['Deep Wool'],wordWrap='CJK'),
    'cell': ParagraphStyle('cell',fontName='XRBody',fontSize=10,leading=14,spaceAfter=0,textColor=C['Ink'],wordWrap='CJK'),
    'label': ParagraphStyle('label',fontName='XRHead',fontSize=9,leading=13,spaceAfter=7,textColor=C['Deep Wool']),
}

def p(s, kind='body'):
    return Paragraph(s, styles[kind])

def table(rows, widths, header=True):
    data = [[p(str(v),'cell') for v in row] for row in rows]
    t = Table(data,colWidths=[WIDTH*x for x in widths],hAlign='LEFT',repeatRows=1 if header else 0)
    commands=[('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7),('LINEBELOW',(0,0),(-1,-1),.4,C['Stone'])]
    if header: commands += [('BACKGROUND',(0,0),(-1,0),C['Oat'])]
    t.setStyle(TableStyle(commands))
    return t

def band(text):
    t=Table([[p(text)]],colWidths=[WIDTH]);t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),C['Oat']),('BOX',(0,0),(-1,-1),.5,C['Stone']),('LEFTPADDING',(0,0),(-1,-1),10),('RIGHTPADDING',(0,0),(-1,-1),10),('TOPPADDING',(0,0),(-1,-1),10),('BOTTOMPADDING',(0,0),(-1,-1),5)]));return t

def footer(canvas, doc):
    canvas.saveState();canvas.setFillColor(C['Paper']);canvas.rect(0,0,W,H,fill=1,stroke=0)
    canvas.setFillColor(C['Deep Wool']);canvas.setFont('XRBody',8)
    canvas.drawString(18*mm,H-12*mm,'개방형 XR 협업 플랫폼 발전·확장 아이디어 | 부문 2')
    canvas.setStrokeColor(C['Stone']);canvas.line(18*mm,15*mm,W-18*mm,15*mm)
    canvas.drawString(18*mm,10*mm,'교체본 · 2026.09.11 | 제안·설계와 실제 구현을 구분합니다')
    canvas.drawRightString(W-18*mm,10*mm,str(doc.page));canvas.restoreState()

def build(name, story):
    path=OUT/name
    doc=SimpleDocTemplate(str(path),pagesize=A4,leftMargin=18*mm,rightMargin=18*mm,topMargin=21*mm,bottomMargin=21*mm,title=name.removesuffix('.pdf'),author='',subject='XR 부문2 아이디어 제안 교체본')
    doc.build(story,onFirstPage=footer,onLaterPages=footer)
    return {'path':str(path),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}

story=[
 p('양식 2-2 · 아이디어 제안서','label'),
 p('말이 통하는 방에서<br/>이해가 보이는 방으로','title'),
 p('<b>아이디어명: 이해 공존감</b> — 설명·도움·재시도를 잇는 XR 협업 회복 계층'),
 band('<b>같은 공간에 접속한 사람이, 같은 과업에 다시 참여할 수 있도록.</b><br/>누가 못했는지 표시하는 기능이 아니라, 어디서 흐름이 갈렸고 어떤 도움 뒤에 다시 이어졌는지 함께 확인하는 플랫폼을 제안합니다.'),
 p('1. 제안 배경','section'),
 p('<b>[가상 설계 예시]</b> 다국어 모의 조립 실습에서 진행자가 “이 부품을 화살표 방향으로 옮겨 주세요”라고 말합니다. 한 참여자는 고개를 끄덕였지만 다른 부품을 선택합니다. 지시어가 모호했을 수도, 기기 화면이 달랐을 수도, 조작이 익숙하지 않았을 수도 있습니다. 이 행동만으로 이해 부족을 단정할 수는 없습니다.'),
 p('협업에는 설명을 보낸 사실뿐 아니라 <b>무엇을 함께 하려 했는지, 어느 단계에서 도움이 필요했는지, 도움 뒤 실제로 다시 참여했는지</b>를 연결하는 맥락이 필요합니다. 대화나 조작을 개별 기록으로만 보면 설명과 행동이 갈린 원인을 재구성하기 어렵습니다. 이는 본 제안이 검증할 문제이며 현행 플랫폼의 결함을 실측했다는 뜻은 아닙니다.'),
 p('2. 아이디어 설명 — 플랫폼의 다음 능력','section'),
 table([
  ['지향점','추가로 연결할 것','사용자에게 돌아갈 가치'],
  ['공유된 과업 기준','설명 시점·객체·단계·설명 판의 참조','서로 다른 기기에서도 같은 대상을 확인'],
  ['도움의 선택권','본인 요청·확인·거절과 도움 종류','원하는 도움을 고르고 잘못된 추정을 수정'],
  ['회복의 근거','제공한 도움과 재시도 결과','한 번의 도움을 다음 설명 개선에 활용'],
 ],[.23,.4,.37]),
 Spacer(1,8),
 p('<b>첫 대상:</b> 언어가 다른 참여자와 진행자가 함께하는 비위험 모의 절차 교육. 이후 다른 원격 교육·공동 실습에서 재사용 가능성을 검토합니다. 실제 장비 안전 판단·인사평가·성적 산출에는 바로 적용하지 않습니다.'),
 p('제안 범위: KISTI 개방형 XR 협업 플랫폼의 기능·구조·사용자 경험 발전 아이디어. XR 연동과 실제 참여자 검증은 아직 수행하지 않았습니다.','small'),
 PageBreak(),
 p('2-1. 발전 방향과 기술·사회적 구조','section'),
 p('“확인 후보”를 “필요한 도움”으로,<br/>도움을 다시 참여하는 경험으로','title'),
 p('공식 주요기능 안내에는 공유 2D·3D 자료, 공간 주석의 저장·불러오기, 세션 기록·다시보기, 역할별 접근 제어가 이미 제시되어 있습니다. 이를 새 기능으로 주장하지 않습니다. <b>새 제안은 해당 설명·객체·단계를 본인의 도움 선택과 재시도 결과까지 연결하는 공통 규격</b>입니다. 실제 연동 가능 사건·권한은 접근 후 확인하며 특정 센서나 AI 모델에 종속되지 않습니다.'),
 table([
  ['순서','새로 갖출 연결','적용 방법·오류 시 처리'],
  ['① 기준점 연결','설명 ↔ 객체 ↔ 과업 단계 ↔ 설명 판','안정적인 참조와 시각 정렬 확인. 사건이 없으면 진행자의 수동 표식으로 시작'],
  ['② 어려움 확인','본인 도움 요청·진행자 표식·행동 차이 후보','자동 후보는 보조 단서. 누락·통신 지연·기기 차이는 이해 부족과 분리'],
  ['③ 도움 선택','대상 강조·단계 설명·짧은 시연','본인이 확인·거절·수정. 미응답과 거절을 낮은 능력으로 바꾸지 않음'],
  ['④ 재시도 연결','선택한 도움 ↔ 해당 단계의 재시도','동일 기준 수행·미수행·확인 불가를 구분하고 도움 전후 맥락 보존'],
  ['⑤ 다음 설명 개선','반복된 막힘·도움 뒤 결과의 제한된 집계','사람 순위가 아니라 설명 구간을 개선. 작은 집단의 재식별 위험도 점검'],
 ],[.18,.35,.47]),
 p('2-2. 서비스 개발자가 재사용할 최소 규격','section'),
 band('<b>사건 제안:</b> 사건 ID / 세션 임시참조 / 설명·단계·객체 참조 / 관찰·후보·본인 확인 구분 / 선택한 도움 / 재시도 결과 / 열람·보존 범위.<br/>이 필드는 제안 규격이며 현행 XU:M API의 제공 필드명이나 구현 완료 구조가 아닙니다.'),
 p('관찰 사실, 시스템이 만든 후보, 참여자의 확인을 별도 상태로 둡니다. 시선·원음·개인 식별정보를 기본 수집값으로 가정하지 않습니다. 자동 사건을 확보하지 못해도 명시적 도움 요청과 진행자 표식만으로 동일 흐름을 시험할 수 있습니다.'),
 p('<b>출력은 두 갈래입니다.</b> 참여자는 자신의 도움 카드와 수정·재시도를 봅니다. 진행자는 우선 다시 설명할 구간을 보며 개인 상세는 과업 지원에 필요한 권한·동의 범위로 제한합니다. 기능 끄기와 철회·파생 기록 삭제도 설계에 포함합니다.'),
 PageBreak(),
 p('2-3. 단계적 발전 경로와 실현 가능성','section'),
 p('재현 가능한 작은 과업에서<br/>회복의 효과부터 확인합니다','title'),
 p('사후 확인을 먼저 검증하고, 충분한 근거와 사용자 수용성이 확인될 때 실시간 지원으로 넓힙니다. <b>구현 주체·비용·일정은 플랫폼 접근과 별도 협의 후 정할 사항</b>이며 수상만으로 개발·납품이 약정된다는 뜻은 아닙니다.'),
 table([
  ['단계','구체적인 수행·산출물 제안','다음 단계로 가는 조건'],
  ['A. 연결 확인','사건·객체 참조·시각·권한을 대조한 사건 맵과 화면 스토리보드','필수 참조의 확보 여부 확인. 불가하면 요청·수동 표식 기반으로 축소'],
  ['B. 사후 시범','비위험 모의 과업 2종, 소규모 4~6명부터 시험 설계. 관찰 기준과 기록 누락 정의','모집·동의·비용 사전 합의. 조정용 과업과 평가용 과업 분리'],
  ['C. 비교 검증','일반 다시보기와 도움 선택·재시도 흐름을 비교. 과업 순서를 교차 배치','재시도 결과와 개입 부담을 함께 확인. 연습 효과·기기 차이 기록'],
  ['D. 공통화','다른 콘텐츠에 같은 사건 의미와 권한을 적용한 예제·규격 검토','분야 차이가 크면 공통 필드를 줄이거나 확장 규격으로 남김'],
 ],[.17,.45,.38]),
 p('2-4. 성능보다 먼저 정의할 성공과 중단 기준','section'),
 p('<b>재시도:</b> 시도한 사람 중 해당 단계 기준을 충족한 수를 보되, 미시도·누락을 함께 보고합니다. <b>도움 도달:</b> 요청 후 도움 열람과 본인의 적절성 확인을 구분합니다. <b>부담:</b> 불필요한 표식·진행 중단·진행자 시간·참여자 거절과 수정 의견을 함께 기록합니다.'),
 p('같은 과업의 반복 성공만으로 이해·학습 전반을 입증하지 않습니다. 조건을 바꾼 과업의 독립 수행도 별도로 확인합니다. 통과선은 평가 전에 정하고 결과를 본 뒤 유리하게 바꾸지 않습니다. 도움의 효과가 없거나 감시 부담이 크면 실시간 도입을 보류하고 단순 요청 도구로 범위를 줄입니다.'),
 p('2-5. 현재 준비 근거와 미검증 범위','section'),
 p('2026-09-09의 2차원 학습 앱 검증기록에는 과제→음성 제출→교정 답장 갱신 및 중복 전송·늦은 답장을 다룬 합성 시험이 있습니다. 이는 사건과 답장의 안전한 연결을 설계한 출발점이며 <b>XR 연동·실기기 안정성·실학생 학습효과의 증거는 아닙니다.</b>'),
 p('본 제안의 XU:M 연동, 실제 참여자 실증과 목표 성능은 미검증입니다. 기존 앱의 원격 운영 검증은 별도 과제이며 이 공모에 회사 코드·학생 데이터·내부 엔진을 제공하지 않습니다.','small'),
 PageBreak(),
 p('2-6. 기대 변화와 플랫폼의 확장 가치','section'),
 p('한 번의 도움을<br/>다음 협업의 더 나은 설명으로','title'),
 p('기록·다시보기가 “무슨 일이 있었는가”를 보여준다면, 본 제안은 <b>“어떤 설명에서 도움이 필요했고, 무엇을 바꾼 뒤 다시 참여했는가”</b>까지 잇습니다. 이 차이는 현재 우월성이 입증되었다는 주장이 아니라 비교 검증할 플랫폼 발전 방향입니다.'),
 table([
  ['수혜자','기대하는 변화','검증할 증거'],
  ['참여자','본인이 선택한 도움으로 공동 과업에 재합류','도움 선택·수정·재시도 결과와 본인 의견'],
  ['진행자','같은 말을 반복하기보다 필요한 구간·방식을 수정','확인 시간·불필요한 개입·재설명 후 수행'],
  ['콘텐츠 제작자','설명 판과 막힘·도움 결과를 연결해 다음 판 개선','수정 전후 비교와 다른 과업으로의 전이'],
  ['플랫폼 개발자','분야별 서비스에 공통 연결·권한 규칙 재사용','복수 콘텐츠의 참조 호환·연동 작업량·누락'],
 ],[.2,.43,.37]),
 p('2-7. 개방성은 공유 규격에, 보호는 이용자에게','section'),
 p('플랫폼이 검토할 자산은 최소 사건 규격, 사용자 확인·도움 선택·재시도 흐름, 공개 가능한 가상 예제와 비교 시험 방법입니다. 플랫폼 개발자·콘텐츠 제작자·현장 진행자가 각자의 책임과 접근 권한을 나누도록 제안합니다. 사례가 쌓여도 사람의 고정 점수·성향 판정이나 다른 목적으로의 전용으로 확대하지 않습니다.'),
 p('첫 모의 교육에서 유용성을 확인한 뒤 다른 원격 교육과 공동 실습으로 확장을 검토합니다. 산업 안전·인사·임상처럼 결과의 위험이 다른 현장에는 별도 검증 없이 적용하지 않습니다. 공개 규격과 현장별 제한을 함께 갖추는 것이 지속 가능한 활용 생태계의 조건입니다.'),
 p('3. 기타 첨부 자료','section'),
 p('첨부 1. 이해 공존감 구조도 1부(별도 PDF): 설명 기준점부터 도움 선택·재시도·설명 개선까지의 연결과 두 사용자 화면 설계 예시.'),
 p('4. 참고자료','section'),
 p('① 한국과학기술정보연구원, 「개방형 XR 협업 플랫폼 서비스 아이디어 도출 경진대회」 공고·참가양식·주요기능 안내. 기업마당 공고 PBLN_000000000124982 및 첨부, 2026.09.11 확인. 주요기능 안내의 플랫폼 소개를 근거로 하며 실제 SDK 접근·시험을 뜻하지 않음.<br/>② 제안자의 2차원 학습 앱 「첫 학생 흐름 검증」, 2026.09.09 기록. 합성 시험과 실제 운영·효과를 구분.<br/>③ 본 문서의 장면·연결 규격·화면·시험 방법은 신규 설계 제안이며 실제 이용 사례나 검증된 연구 결과가 아님.','small'),
 p('공개·제공 경계: 본 제출물은 XR 플랫폼 확장 아이디어로 한정합니다. 회사 내부 엔진·소스코드·학습 데이터·브랜드 자산은 첨부하지 않습니다. 이 범위 표시는 공고의 수상작 권리귀속 조항을 변경하는 조건이 아닙니다.','small'),
]

diagram=[
 p('첨부 1 · 구조도 / 신규 설계 제안','label'),
 p('이해 공존감:<br/>설명에서 다시 참여까지','title'),
 p('기존 아이디어의 보완 구조도. 아래 연결과 화면은 구현 결과가 아닌 제안입니다.'),
 band('<b>플랫폼에서 먼저 확인할 기반</b><br/>세션·객체·과업 단계 참조 / 설명 판 / 실제 제공 사건 / 기기·통신 상태 / 열람·저장 권한<br/>필요한 사건이 없으면 본인 도움 요청과 진행자 수동 표식으로 시작'),
 Spacer(1,10),
 table([
  ['연결 단계','공유할 맥락','사람에게 보이는 결과'],
  ['① 설명 기준점','지금 설명하는 객체·단계·판','“지금 이 부품을 다룹니다”'],
  ['↓ ② 어려움 확인','본인 요청·진행자 표식·확인 후보','“대상 / 순서 / 조작 중 도움이 필요한가요?”'],
  ['↓ ③ 본인 선택','도움 필요·불필요·수정·미응답 구분','대상 다시 보기 / 순서 설명 / 짧은 시연'],
  ['↓ ④ 도움과 재시도','선택한 도움 ↔ 같은 단계 재시도','수행 확인 / 미시도 / 확인 불가'],
  ['↓ ⑤ 다음 설명 개선','반복된 막힘과 도움 뒤 결과','진행자가 설명 판 수정 → 다음 ①에 반영'],
 ],[.24,.39,.37]),
 p('두 사용자 출력 — 가상 화면 설계','section'),
 table([
  ['참여자의 개인 도움 카드','진행자의 구간별 확인판'],
  ['현재: 부품 배치 2단계<br/><b>“어떤 도움이 필요한가요?”</b><br/>대상 보기 · 순서 보기 · 도움 불필요<br/>확인 후보 수정 → 선택한 도움 → 다시 시도','현재: 2단계 설명 다시 확인<br/><b>“대상 지시를 더 분명하게”</b><br/>관찰 · 후보 · 본인 확인을 구분<br/>개인 상세는 과업 지원 권한 내에서만'],
 ],[.5,.5]),
 p('모든 연결에 적용할 보호·검증','section'),
 p('<b>보호:</b> 모르면 확인 불가 / 시선·원음 기본 수집 없음 / 기능 끄기 / 용도 제한 / 보존·철회·파생 삭제 / 소규모 집계의 재식별 위험 점검.<br/><b>검증:</b> 실제 제공 범위 확인 → 요청 기반 사후 시범 → 일반 다시보기와 비교 → 공통화 검토. 시범 모집·비용·일정은 별도 협의 대상.'),
 p('회사 내부 코어·학생 원문·원음·모델 훈련·자체 VR 사업에서 플랫폼으로 데이터를 넘기는 구조가 아닙니다. 본 제안의 XR 연동·사용성·학습효과는 아직 검증하지 않았습니다.','small'),
]

if __name__=='__main__':
    results=[build('XR_부문2_아이디어제안서_교체본_20260911.pdf',story),build('XR_첨부1_이해공존감_구조도_교체본_20260911.pdf',diagram)]
    print(json.dumps(results,ensure_ascii=False,indent=2))
