import {readFileSync,statSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../../../..');
const lab='docs/정본/SYNK LAB/About Syestem/SYNK_리라이팅_v2/';
// Explicit source allowlist: employee guidance never turns into arbitrary file access.
const rows=[
 ['crew-handbook','crew','크루 핸드북','직원 복지, 근무·소통·보호·보안, 평가, 합류와 퇴직','SYNK LAB 크루','2027-02-25 시행 예정',lab+'04_SYNK_크루_핸드북.txt'],
 ['pay','crew','급여와 인센티브','기본급·보상 경로·8주 심사·개원 멤버 조건·이의 제기','LAB 크루·운영진','보상 설계 정본',lab+'SYNK LAB 급여 인센티브 정본.txt'],
 ['privacy','crew','개인정보와 학생 자료','학생 기록·미성년자 동의·접근·보관·삭제와 홍보 사용','자료를 다루는 크루','현행 게시 기준','docs/개인정보처리방침_초안_v1.md'],
 ['student-welfare','student','학생 복지 프로그램','최신 7가지 복지안, 장학 4종, 포인트와 학생 공간','LAB 학생 지원 담당','2026-09-29 복지안',lab+'02_학생_복지_프로그램.txt'],
 ['scholarship','student','장학 제도 운영 규칙','자격·선정·중복 수혜·지급·기록·이의 제기와 예산','LAB 내부 크루·리드크루','내부 운영 기준',lab+'02B_장학제도_운영규칙_내부용.txt'],
 ['photobooth','student','학생 포토부스','월 촬영권, 친구와 함께 찍기, 프레임·보관과 이용 흐름','학생 혜택·공간 담당','설계 · 운영 준비','docs/포토부스_설계.md'],
 ['pathway','student','유학·진로 프로그램','목표 설정, 로드맵과 한국 유학·생활·진로 지원 방향','학생 상담·진로 담당','프로그램 준비',lab+'03_유학_프로그램.txt'],
 ['terms','student','수강 조건과 환불','1기와 개원 뒤 정규 과정, 환불·일시정지·학생 정보','등록·상담 담당','게시 전 초안','docs/수강약관_초안_v1.md'],
 ['curriculum','teaching','커리큘럼 정본','최신 과정 목표, 레벨 대응, 8주 시즌·승급·학습 구조','LAB 교육 설계·강사','최신 수업 기준','docs/커리큘럼_정본_v1.md'],
 ['curriculum-overview','teaching','수업 커리큘럼 안내','레벨·시간표·등록 구성·앱 학습·평가의 설명','LAB 강사·상담 담당','과정 안내 원문',lab+'10_SYNK_LAB_수업_커리큘럼.txt'],
 ['lesson-rules','teaching','강사 수업 규칙','수업 진행·조·역할·결석·지각·교실 규칙과 차시 기록','SYNK LAB 강사','수업 규칙 · 개정 대조',lab+'SYNK LAB 강사 수업 규칙.txt'],
 ['weekly-plan','teaching','주간 교안 양식','주 5차시·14칸, 목표·오류·확장 과제·회고와 작성 견본','SYNK LAB 강사','교안 원문',lab+'SYNK LAB 주간 교안 양식.txt'],
 ['tasks','teaching','소그룹 과업 은행','정보 차·합의·창작·조사·게임 과업 20개와 확장 방법','SYNK LAB 강사','수업 과업 원문',lab+'SYNK LAB 소그룹 과업 은행.txt'],
 ['operations','operations','학원 운영 시스템','출결·기록·앱·강사·학부모·원장 업무와 준비 항목','LAB 내부 운영진','운영 대장 · 기록',lab+'05_운영_시스템.txt'],
 ['supplies','operations','비품 체크리스트','필수·권장·후순위 비품, 굿즈와 조달 준비','LAB 운영·공간 담당','구매 준비 원문',lab+'06_비품_체크리스트.txt'],
 ['space-design','operations','방별 공간과 하루 운영','각 방의 쓰임, 수납·관리·등하원·직원 개점과 마감','LAB 공간·운영 담당','2026-10-01 통합 설계','docs/오프라인_공간설계/방별_인테리어_디자인_20260929.md'],
 ['space-layout','operations','공간과 수업 촬영','현재 배치, 교실·사무실·상담·포토실과 촬영 방식','LAB 공간·수업 촬영 담당','6안 통합 설계','docs/오프라인_공간설계/평면도_20260929/공간과_촬영_통합설계.md'],
 ['main-room','operations','메인 룸 인테리어 원본','거울·커튼·바닥·조명·다크 촬영 배경의 출발점','LAB 공간 담당','보존 원문 · 최신안 연결',lab+'07_SYNK_메인룸_인테리어.txt'],
 ['lab-detail','operations','LAB 운영 상세서','수업 구조, 교재·앱·엔진·고객과 개원 준비','LAB 내부 운영진','내부 상세 원문','docs/정본/SYNK LAB/SYNK LAB 상세서.txt'],
 ['vision','company','회사와 브랜드의 비전','SYNK·LAB·SHIFT·PULSE·PATH의 현재 역할과 지향점','회사 공통','현재 비전 정본','docs/비전_정본.md'],
 ['philosophy','company','우리가 일하는 기준','개인화, 실제 이용 결과, 판단·협업·성장과 기록','회사 공통','현재 철학 정본','docs/SYNK_철학.md'],
 ['company-intro','company','SYNK 기업소개서','회사 철학, 개인화와 교육 시스템, 사업의 방향','회사 공통','회사 소개 원문','docs/정본/SYNK/SYNK 기업소개서.txt'],
 ['company-master','company','회사 자료 길잡이','회사·제품·준비 상태를 확인하는 내부 색인과 원문 지도','회사 내부 크루','내부 참고 원문','docs/정본/SYNK/SYNK 기업마스터.txt'],
 ['lab-intro','company','SYNK LAB 소개서','학생의 목표, 한국어 교육, 교실의 하루와 성장 기록','회사·LAB 크루','LAB 소개 원문','docs/정본/SYNK LAB/SYNK LAB 소개서.txt'],
 ['shift-intro','company','SYNK SHIFT 소개서','기업·교육기관의 AI 활용과 개인·조직의 성장 방향','회사·SHIFT 크루','SHIFT 소개 원문','docs/정본/SYNK SHIFT/SYNK SHIFT 소개서.txt'],
 ['parent-guide','work','학부모 안내문','첫 방문·교육 목표·아이의 하루·기록·상담 안내','LAB 상담·학부모 안내 담당','개원 전 소개 원문',lab+'09_학부모_안내문.txt'],
 ['parent-speech','work','설명회 원장 스피치','순차통역 원고, 설명회 진행과 예상 질문','설명회·통역 담당','설명회 원고',lab+'08_설명회_원장_스피치.txt'],
 ['public-faq','work','학생·학부모 FAQ','가격·기간·수업·학부모·AI·사진 사용과 등록 질문','LAB 상담·안내 담당','대외 FAQ 원문','docs/정본/SYNK/SYNK FAQ.txt'],
 ['faq-gates','work','상담 답변 기준','공개 가능한 답, 확인이 필요한 조건과 답변 원칙','LAB 상담·콘텐츠 담당','공개 상담 기준','docs/자주묻는질문_정본.md'],
 ['quality','work','디자인과 완성도 기준','승인 자산·서체·색, 읽힘·사용성·움직임과 마감','디자인·콘텐츠 제작','현재 정본','docs/명품_기준_v1.md'],
 ['content-template','work','콘텐츠 제작 양식','시청자가 볼 이유, 브랜드·가치와 유형별 제작 양식','콘텐츠 제작 크루','공동 제작 입구','docs/마케팅/콘텐츠_제작양식.md'],
 ['workspace','work','워크스페이스 사용 안내','내 작업실·회사 안내·마케팅·메신저, 초대·권한·개인 자료','워크스페이스 사용자','사용 안내','docs/마케팅/온라인마케팅지도/engagement/company/WORKSPACE.md']
];
const categories=[
 ['crew','직원 안내','복지·근무·급여'],['student','학생 복지','혜택·장학·수강 조건'],['teaching','수업 기준','커리큘럼·교안·과업'],['work','상담 안내','학부모 안내·FAQ']
].map(([id,label,description],index)=>({id,label,description,number:String(index+1).padStart(2,'0')}));
const notes={
 'crew-handbook':'LAB 개원일부터 시행하는 기준입니다. 카페테리아와 생일 혜택은 개원과 함께 시작하는 안이고, 급식·야간 교통비·자기계발비는 예산과 도입 시점이 미정입니다.',
 pay:'개원 편제와 재원생 수를 전제로 한 보상 설계입니다. 예상 수령액과 가정 환율은 실제 지급 기록이 아닙니다. 미정 항목·계약 조건은 원문에서 확인합니다.',
 privacy:'게시 조항과 내부 확인 기록이 함께 있는 원문입니다. 자료를 읽는 것으로 개별 동의·처리·삭제가 완료되지는 않습니다.',
 'student-welfare':'9월 29일의 「현재 정리된 학생 복지안」이 기존 설명보다 우선합니다. 실제 제공 시작 시점·지급·예약·이용 절차는 운영 전에 정합니다. Google AI Pro의 몽골 계정 제공 방식, 분기 장학의 할인 기간·정산, 화상 참여는 확인·준비가 필요합니다.',
 scholarship:'학생·학부모용 안내와 구분되는 내부 문서입니다. 혜택의 금액·주기가 다르면 학생 복지 프로그램의 최신 복지안을 우선합니다.',
 photobooth:'월 1회, 촬영을 시작한 대표 학생 1명만 이용권을 사용하는 기준입니다. 부스 코드·실기기·운영 배포는 아직 없고 인화·저장 방식은 미정입니다.',
 pathway:'유학·진로 지원 설계입니다. 현재 사업별 역할은 회사 비전을 함께 확인하며 입학·비자·취업 결과를 보장하는 안내로 사용하지 않습니다.',
 terms:'게시 전 초안입니다. 원문의 「게시 전 확인」이 닫히기 전에는 대외 게시·계약서·상담 봇 답변에 사용하지 않습니다. 1기와 개원 뒤 정규 과정의 조건을 구분합니다.',
 curriculum:'9월 18일 추가 기준을 우선합니다. 한 차시 90분 안에 그룹별 발화 30분을 포함하며 학생 1인당 발화 시간은 아닙니다. 정규 1년 과정 목표는 TOPIK 4급, 전체 자체 과정 상한은 TOPIK 5급입니다. 세부 요목에는 재정렬·확인이 필요한 부분이 남아 있습니다.',
 'curriculum-overview':'설명용 원문입니다. 1년 과정 목표와 수업 시간은 최신 커리큘럼 정본을 우선합니다. 옛 수치·구현 표현을 현재 성과로 간주하지 않습니다.',
 'lesson-rules':'원문의 소그룹 20분 표는 이전 구성입니다. 최신 기준은 커리큘럼 정본의 90분 안에 그룹별 발화 30분입니다. 나머지 블록의 분 단위 재배분은 아직 이 안내에서 정하지 않습니다. LAB 강사용 규칙이며 앱 자동화 설명은 실제 연결 상태와 구분합니다.',
 'weekly-plan':'양식에 인용된 옛 소그룹 시간은 최신 커리큘럼의 그룹별 발화 30분 기준과 대조합니다. 앱 초안 생성 설명은 구현 완료의 증거가 아닙니다.',
 tasks:'과업은 최신 커리큘럼의 그룹별 발화 30분 기준에 맞춰 준비합니다. 옛 20분 구성을 현행 시간표로 안내하지 않습니다.',
 operations:'작성 당시의 코드 실측·구현 상태를 담은 운영 대장입니다. 「이미 돈다」 표기는 현재 라이브 운영이나 새 연결의 검증 결과를 대신하지 않습니다.',
 supplies:'구매 준비 자료입니다. 옛 수량·가격·장비는 최신 공간안과 실제 견적을 대조하며 구매 완료로 표시하지 않습니다.',
 'space-design':'현재 6안의 공간·브랜드·하루 운영 개념 설계입니다. 실측·제품 선정·설비 검토·견적·시공과 실제 운영은 확인 전입니다.',
 'space-layout':'현재 배치와 장비를 연결하는 개념안입니다. 치수·수량은 실측이나 법적 수용인원 검증 결과가 아닙니다.',
 'main-room':'v7 본문을 보존한 원본입니다. 현재 방 배치와 운영은 방별 공간·공간과 수업 촬영의 최신 통합안을 함께 확인합니다.',
 'lab-detail':'내부 준비 자료입니다. 현재 비전·커리큘럼·학생 복지·공간 통합안을 각각 우선합니다.',
 'company-intro':'소개 원문과 현재 비전을 함께 읽습니다. 과거 일정·구현 상태·사업 설명이 다르면 현재 담당 정본을 우선합니다.',
 'company-master':'내부 원문 지도입니다. 옛 조직 표기와 구현 상태는 현재 비전·담당 문서·실제 구현에서 다시 확인합니다.',
 'lab-intro':'수업 시간·목표·학생 혜택은 최신 커리큘럼과 학생 복지 정본을 함께 확인합니다.',
 'shift-intro':'현재 사업별 역할은 회사 비전 정본을 우선합니다. 준비 방향을 제공 완료로 안내하지 않습니다.',
 'parent-guide':'개원 전 소개 원문입니다. 대외 전달 전 최신 수업·복지·준비 상태를 함께 확인합니다.',
 'parent-speech':'낭독·통역용 원고입니다. 과거 일정·수치·구현 설명은 현행 담당 문서와 대조해 사용합니다.',
 'public-faq':'대외 설명용 FAQ입니다. 공개 가능한 답변 조건은 상담 답변 기준, 최신 수업·혜택은 각 정본에서 확인합니다.',
 'faq-gates':'대외 FAQ와 역할이 다른 내부 답변 기준입니다. 미정·초안인 가격·환불·조건을 확정된 안내로 바꾸지 않습니다.'
};
const shortcuts={
 crew:[['직원 복지','crew-handbook','일상을 받치는 것'],['급여·시즌 평가','pay','7장.'],['학생 자료와 동의','privacy','미성년자']],
 student:[['최신 학생 복지 7가지','student-welfare','현재 정리된 학생 복지안'],['장학 선정·지급','scholarship','§4.'],['월 1회 포토부스','photobooth','학생이 얻는 경험']],
 teaching:[['90분 수업·그룹 발화 30분','curriculum','SYNK LAB 수업 커리큘럼 정본'],['주간 교안 14칸과 견본','weekly-plan','열네 칸'],['소그룹 과업 20개','tasks','스무 장']],
 operations:[['학생 등원부터 하원까지','space-design','21.'],['직원 개점·마감','space-design','22.'],['비품·구매 우선순위','supplies','P0 —']],
 company:[['사업별 역할과 방향','vision',''],['학생을 이해하고 돕는 기준','philosophy','LAB'],['회사·제품 원문 지도','company-master','값은 여기 없다']],
 work:[['학생·학부모 질문','public-faq','30초 안에'],['콘텐츠를 만들기 전에','content-template','시청자가 볼 이유'],['업무 도구 사용법','workspace','']]
};
const highlights={
 'crew-handbook':[['개원과 함께','카페테리아 음료·간식, 생일 당일 유급휴가와 상품권','일상을 받치는 것'],['도입 미정','급식·야간 교통비·자기계발비는 아직 예산에 없습니다.','일상을 받치는 것'],['매일과 매주','매일 기록과 주간 교안·영상·상담 업무를 구분합니다.','매일 하는 일']],
 'student-welfare':[['시험 지원','6개월 이상 수강자에게 공식 TOPIK 시험 1회 응시료 전액 지원. 목표 급수와 무관하며 같은 시험의 성취 보상과 중복 지급하지 않습니다.','새로 추가한 복지'],['성장 인정','매월 각 반 1명, 개인의 성장·학습 과정을 평가해 CU 카드 50,000₮ 지급','현재 정리된 학생 복지안'],['진로와 안심 수강','1년 과정 학생 연 1회 진로 자료 검토·최종본. 연 1회 최대 2주 수강 일시정지·기간 연장','새로 추가한 복지']],
 curriculum:[['수업 시간','한 차시 90분 안에 그룹별 발화 30분. 옛 20분 표기보다 우선합니다.','SYNK LAB 수업 커리큘럼 정본'],['목표와 범위','정규 1년 과정 목표 TOPIK 4급 · 전체 자체 과정 상한 TOPIK 5급','SYNK LAB 수업 커리큘럼 정본'],['한 시즌','8주·40차시, 8주차 5차시에 승급 평가. 도달 기준을 확인합니다.','SYNK LAB 수업 커리큘럼 정본']]
};
const related={
 'crew-handbook':['pay','lesson-rules','weekly-plan'],pay:['crew-handbook'],privacy:['crew-handbook','terms'],
 'student-welfare':['scholarship','photobooth','terms','pathway'],scholarship:['student-welfare'],photobooth:['student-welfare','space-design'],pathway:['student-welfare','vision'],terms:['student-welfare','faq-gates','privacy'],
 curriculum:['curriculum-overview','lesson-rules','weekly-plan','tasks','philosophy'],'curriculum-overview':['curriculum','lesson-rules'],'lesson-rules':['curriculum','weekly-plan','tasks'],'weekly-plan':['curriculum','lesson-rules','tasks'],tasks:['curriculum','weekly-plan'],
 operations:['workspace','lab-detail','supplies'],supplies:['space-layout','space-design'],'space-design':['space-layout','photobooth','main-room','supplies'],'space-layout':['space-design','main-room'],'main-room':['space-design','space-layout'],'lab-detail':['vision','curriculum','student-welfare','operations'],
 vision:['philosophy','company-intro','lab-intro','shift-intro'],philosophy:['vision','curriculum','quality'],'company-intro':['vision','company-master'],'company-master':['vision','company-intro','lab-detail'],'lab-intro':['curriculum','student-welfare','lab-detail'],'shift-intro':['vision'],
 'parent-guide':['student-welfare','curriculum','public-faq','parent-speech'],'parent-speech':['parent-guide','public-faq','curriculum'],'public-faq':['faq-gates','terms','student-welfare','curriculum'],'faq-gates':['public-faq','terms'],quality:['content-template','philosophy'],'content-template':['quality','philosophy'],workspace:['crew-handbook']
};
const retained=rows.filter(row=>['crew','student','teaching'].includes(row[1])||['parent-guide','parent-speech','public-faq','faq-gates'].includes(row[0]));
const retainedIds=new Set(retained.map(row=>row[0]));
const documents=retained.map(([id,category,title,description,scope,status,path])=>({id,category,title,description,scope,status,path,notice:notes[id]||'',related:(related[id]||[]).filter(id=>retainedIds.has(id)),highlights:(highlights[id]||[]).map(([label,text,section])=>({label,text,section}))}));
const facts={
 crew:[
  ['카페테리아','음료·간식 상시 운영','개원 시작','crew-handbook','일상을 받치는 것'],
  ['생일 혜택','당일 유급휴가 + 상품권','개원 시작','crew-handbook','일상을 받치는 것'],
  ['급식 지원','지정 업체 1일 1식','도입 미정','crew-handbook','일상을 받치는 것'],
  ['야간 교통비','22시 이후 연장근무 시 택시비','도입 미정','crew-handbook','일상을 받치는 것'],
  ['자기계발비','직무 관련 도서·교육비','도입 미정','crew-handbook','일상을 받치는 것'],
  ['신규 멘토링','전담 멘토 3개월','개원 기준','crew-handbook','소통']
 ],
 student:[
  ['Google AI Pro','1년 수강료 선결제 학생','제공 방식 확인','student-welfare','현재 정리된 학생 복지안'],
  ['분기 최우수 장학','학원 전체 1등 · 수강료 100% 할인','기간·정산 미정','student-welfare','현재 정리된 학생 복지안'],
  ['월간 성장 인정상','각 반 매월 1명 · CU 카드 50,000₮','운영 준비','student-welfare','현재 정리된 학생 복지안'],
  ['SYNK WORLD','수강기간 프리미엄 · 비상시 화상 참여','화상 참여 준비','student-welfare','현재 정리된 학생 복지안'],
  ['TOPIK 응시료','6개월 이상 수강 · 공식 시험 1회 전액','지급 절차 준비','student-welfare','새로 추가한 복지','목표 급수 취득과 무관하며 같은 시험의 성취 보상과 중복 지급하지 않습니다.'],
  ['유학·진로 준비권','1년 과정 · 연 1회 자료 검토·최종본','절차 준비','student-welfare','새로 추가한 복지'],
  ['수강 일시정지','연 1회 · 최대 2주 · 중지 기간만큼 연장','신청 절차 준비','student-welfare','새로 추가한 복지']
 ],
 teaching:[
  ['한 차시','90분','수업 기준','curriculum','SYNK LAB 수업 커리큘럼 정본'],
  ['그룹별 발화','90분 안에 30분 포함','수업 기준','curriculum','SYNK LAB 수업 커리큘럼 정본','학생 1인당 30분이 아닙니다. 옛 소그룹 20분 표기보다 우선합니다.'],
  ['정규 1년 목표','TOPIK 4급','과정 설계','curriculum','SYNK LAB 수업 커리큘럼 정본'],
  ['전체 과정 범위','Lv1~6 · TOPIK 5급까지','과정 설계','curriculum','레벨 대응표'],
  ['한 시즌','8주 · 40차시 · 마지막 차시 승급 평가','과정 설계','curriculum','SYNK LAB 수업 커리큘럼 정본'],
  ['주간 교안','주 5차시 · 목표·오류·회고 등 14칸','교안 양식','weekly-plan','열네 칸']
 ]
};
const overviews={
 crew:{note:'LAB · 2027-02-25 시행 예정',items:[['개원 복지','생일 휴가·상품권, 음료·간식'],['도입 미정','급식·야간 교통비·자기계발비']]},
 student:{note:'최신 복지안 · 지급·이용 절차 준비',items:[['시험 지원','6개월 이상 · TOPIK 응시료 1회'],['성장 인정','각 반 매월 1명 · CU 카드 5만₮']]},
 teaching:{note:'최신 커리큘럼 기준',items:[['수업 시간','90분 · 그 안에 그룹별 발화 30분'],['과정 목표','1년 TOPIK 4급 · 전체 범위 5급까지']]}
};
export function companyGuide(){
  return {categories:categories.map(category=>({...category,overview:overviews[category.id]||null,facts:(facts[category.id]||[]).map(([label,value,condition,documentId,section,note])=>({label,value,condition,documentId,section,note:note||''})),shortcuts:shortcuts[category.id].filter(row=>retainedIds.has(row[1])).map(([label,documentId,section])=>({label,documentId,section}))})),documents:documents.map(document=>{
    try{const path=resolve(root,document.path);return {...document,text:readFileSync(path,'utf8').replace(/^\uFEFF/,''),updatedAt:statSync(path).mtime.toISOString()};}
    catch{return {...document,text:'',error:'이 원문을 불러오지 못했어요. 관리자에게 문서 위치를 확인해 주세요.'};}
  })};
}
