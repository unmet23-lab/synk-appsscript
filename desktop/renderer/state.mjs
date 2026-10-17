import {MEMBER_BENEFITS} from './benefits.mjs';
export const INSTALLABLE_IDS=['world','messenger'];
export const APPS={
  world:{name:'SYNK WORLD',short:'WORLD',icon:'world.png',category:'PLAY · LEARN · CONNECT',description:'놀면서 익히는 한국어.',cover:'world-book.avif',alt:'코랄색 표지에 크림색 장을 펼친 펠트 책',caption:'SYNK WORLD · 싱크 월드',stage:'development',audience:'한국어를 배우는 학생',keywords:'월드 학습 게임 학생 토픽 TOPIK',summary:'한국어 놀이와 마을 생활에서 다음 학습까지 이어갑니다.',features:[['한국어 놀이','듣고 반응하는 미니게임으로 한국어를 연습합니다.'],['싱크 타운','마을에서 대화와 생활을 경험하는 공간을 개발하고 있습니다.'],['학습 이어가기','학습 기록을 숙제와 코칭에 연결합니다. 제공 범위는 WORLD에서 확인하세요.']]},
  messenger:{name:'SYNK Workspace',short:'WORKSPACE',icon:'messenger.png',category:'WORK · TEACH · CREATE',description:'수업·대화·업무를 한곳에서.',cover:'laptop.webp',alt:'SYNK의 파란 펠트 노트북',caption:'SYNK WORKSPACE · 싱크 워크스페이스',stage:'development',audience:'SYNK 회사 구성원·담당 교사',keywords:'워크스페이스 Workspace 싱크 내 수업 교사 학급 학생 과제 메신저 사내 회사 팀 업무 할일 알림 내 작업실 제작 콘텐츠 스튜디오 Studio SHIFT 시프트 인공지능 AI 연습 검토',summary:'내 수업·팀 대화·내 업무·제작과 AI 실습을 하나의 워크스페이스에 모았습니다.',features:[['팀 대화','개인·팀 대화와 공유 파일을 연결합니다.'],['내 업무','할 일·저장한 메시지·알림을 모아 다음 작업을 챙깁니다.'],['제작·AI 실습','제작 데스크에서 기획·검토·게시 전 점검과 AI 업무 연습을 이어갑니다.']]},
  teacher:{name:'워크스페이스 · 내 수업',short:'워크스페이스 / 내 수업',icon:'world.png',category:'TEACH · GUIDE · GROW',description:'학생의 기록을 다음 수업으로.',cover:'world.png',alt:'SYNK의 펠트 책',caption:'TEACHER & INSTITUTION · LOCAL MVP',stage:'preview',audience:'한국어 교사·교육기관 운영자',keywords:'교사 선생님 기관 학원 학교 수업 숙제 평가 교육',summary:'워크스페이스 안에서 학급·학습 기록·과제를 연결하는 교사와 기관의 수업 공간입니다.',boundary:'워크스페이스의 내 수업에서 학생 WORLD의 기록·과제를 연결하는 로컬 MVP입니다. 담당 반 권한과 회사 자료 권한은 분리하며 운영 학생 연결·공개 배포는 준비 중입니다.',features:[['학급과 학생','담당 학급과 학생의 현황을 확인합니다.'],['기록과 과제','공유한 학습 기록을 보고 읽기·게임 과제를 보내고 결과를 확인합니다.'],['수업 운영','교사·기관의 담당 범위와 권한을 구분하는 기반을 준비합니다.']]},
  path:{name:'SYNK PATH',short:'PATH',icon:'world.png',category:'EXPLORE · PRACTICE · PREPARE',description:'실제 면접을 앞두고, 먼저 앉아 보는 자리.',cover:'world.png',alt:'진로 준비를 나타내는 승인 펠트 책',caption:'VR INTERVIEW · 60–90 SECONDS',stage:'preview',previewLabel:'실사 면접실 · 공개 MVP',audience:'한국 유학·진로·취업을 준비하는 학습자',keywords:'패스 VR Quest 가상 캠퍼스 진로 진학 취업 이력서 면접 목표 음성 경청 필기',summary:'세 면접관 앞에서 말로 답하고, 내 답변에 따른 후속 질문까지 60~90초 동안 연습합니다.',boundary:'PC에서는 글·음성으로, 지원 Quest 브라우저에서는 음성을 준비한 뒤 VR로 연습합니다. 답변은 계정에 저장하지 않습니다. 실제 Quest 착용·멀미 검증과 학교·기업 연결은 남아 있습니다.',features:[['세 면접관의 실사 면접실','차분한 평가 시선과 자연스러운 경청·필기를 보며 면접 분위기를 경험합니다.'],['내 답변에 이어지는 질문','한국어로 말하거나 입력하면, 경험·준비 두 후속 질문 중 답변에 맞는 질문으로 이어집니다.'],['앉아서 둘러보기','PC 30도 회전과 선택형 저감도 드래그, Quest의 실제 고개 움직임으로 공간을 둘러봅니다.']]},
  pulse:{name:'SYNK PULSE',short:'PULSE',icon:'messenger.png',category:'CAST · CREATE · REVIEW',description:'모델 선택부터 시안 검토와 승인까지.',cover:'laptop.webp',alt:'고객과 작품 협업을 나타내는 승인 펠트 노트북',caption:'CLIENT STUDIO · PROJECT & REVIEW',stage:'preview',previewLabel:'모델·제작 진행',audience:'광고 제작 고객·창작자·파트너',keywords:'펄스 pulse partners 파트너 창작자 외부 고객 작품 프로젝트 발주 피드백 영상 브랜드 콘텐츠 포트폴리오 모델 캐스팅 광고 제작 진행 수정 의견 승인',summary:'모델과 작업을 고르고, 연결한 프로젝트의 진행 단계·수정 의견·시안 승인을 함께 확인합니다.',boundary:'초대 링크로 연결한 프로젝트의 의견과 승인은 담당자와 공유됩니다. 제작 요청 초안은 현재 기기에 저장하며 기존 상담 채널로 전달합니다.',features:[['모델·포트폴리오','공개 모델과 작업을 살펴보고 제작 요청에 담습니다.'],['제작 진행·수정 의견','초대한 프로젝트의 단계와 시안을 확인하고 버전·장면별 의견을 남깁니다.'],['시안 최종 승인','확인한 최신 시안의 승인 버전과 일시를 기록하고 최종 파일을 확인합니다.']]},
};
for(const benefit of MEMBER_BENEFITS){
  // 화면 안에 들어가는 혜택(내 성향 확인하기·AI 구독 계정판)은 회원 혜택 화면 안에서만 열리며 앱 목록·실행 권한과 연결하지 않는다.
  // 10-14 insight가 이 조건 없이 아래 마지막 분기로 떨어져 「가족 앨범」 이름의 앱으로 목록에 들어갔었다.
  if(benefit.embedded)continue;
  if(benefit.id==='care'){
    APPS.care={name:'SYNK 플레저',short:'플레저',icon:benefit.asset,category:'REMEMBER · CARE · CONNECT',description:benefit.headline,cover:benefit.asset,alt:benefit.alt,caption:'RELATIONSHIP CARE · LOCAL MVP',stage:'preview',previewLabel:'플레저 · 로컬 MVP',audience:'생일·경조사와 연락을 챙기고 싶은 사람',keywords:'플레저 챙김 관계 생일 경조사 기념일 결혼 부고 연락 말투 녹음 대화',summary:benefit.description,boundary:benefit.availability,features:benefit.steps.map(step=>[step.title,step.body])};
    continue;
  }
  if(benefit.id==='fortune'){
    APPS.fortune={name:'SYNK 무료 운세',short:'무료 운세',icon:benefit.asset,category:'TODAY · LUCK · SMILE',description:benefit.headline,cover:benefit.asset,alt:benefit.alt,caption:'SYNK FOR YOU · LOCAL MVP',stage:'preview',previewLabel:'무료 운세 · 로컬 MVP',audience:'오늘을 가볍게 시작하고 싶은 사람',keywords:'운세 무료 오늘 이번주 별자리 zodiac horoscope 한국 사주 saju 만세력 생년월일 출생시각 일간 오행 행운 색 숫자 일상 계정 저장 보관함 메모 실천 기록 내보내기',summary:benefit.description,boundary:benefit.availability,features:benefit.steps.map(step=>[step.title,step.body])};
    continue;
  }
  const rehearsal=benefit.id==='rehearsal';
  APPS[benefit.id]={name:'SYNK '+benefit.name,short:rehearsal?'대화 리허설':'가족 앨범',icon:benefit.asset,category:rehearsal?'PREPARE · PRACTICE · REFLECT':'PHOTO · STORY · VOICE',description:benefit.headline,cover:benefit.asset,alt:benefit.alt,caption:'SYNK FOR YOU · LOCAL MVP',stage:'preview',previewLabel:benefit.name+' · 로컬 MVP',audience:rehearsal?'중요한 대화를 미리 연습하고 싶은 사람':'사진과 실제 목소리로 가족의 이야기를 남기고 싶은 사람',keywords:rehearsal?'리허설 대화 부탁 거절 면접 업무 연습 회고 재시도':'가족 앨범 사진 이야기 녹음 목소리 기억 추억',summary:benefit.description,boundary:benefit.availability,features:benefit.steps.map(step=>[step.title,step.body])};
}
// Division colours: docs/디자인_토큰.json, SNS키트/README.md and approved palette.
// Studio and SHIFT are workroom features in Messenger, not separate apps.
export const BRAND_PRESENTATION={
  world:{brand:'LAB · 학생',accent:'#F96859',ink:'#AE322A'},
  messenger:{brand:'SYNK · 팀',accent:'#000000',ink:'#000000'},
  teacher:{brand:'LAB · 교사',accent:'#F96859',ink:'#AE322A',icon:'teacher-cover.png',cover:'teacher-cover.png',alt:'수업 내용을 정리한 코럴색 펠트 발표 보드와 연단'},
  path:{brand:'PATH · 다음 길',accent:'#526956',ink:'#526956',icon:'path-cover.png',cover:'path-cover.png',alt:'유학 계획 노트에서 대학 건물로 이어지는 초록색 펠트 길'},
  pulse:{brand:'PULSE · 작품',accent:'#99295D',ink:'#99295D',icon:'pulse-cover.png',cover:'pulse-cover.png',alt:'작품을 담은 베리색 펠트 레코드와 사용 범위 서류'},
  care:{brand:'SYNK · 일상',accent:'#3D6BC9',ink:'#24448C'},
  fortune:{brand:'SYNK · 회원 혜택',accent:'#F5C445',ink:'#7E5A10'},
  rehearsal:{brand:'SYNK · 회원 혜택',accent:'#F96859',ink:'#AE322A'},
  'family-album':{brand:'SYNK · 회원 혜택',accent:'#F5C445',ink:'#7E5A10'},
};
// 2026-10-06 platform redesign: each app is shown as a big Hangul word (the homepage 싱ㅋ idea)
// and a one-syllable tile. Display only; ids, names and entitlements are unchanged.
const DISPLAY_WORDS={world:['월드','월'],messenger:['워크\n스페이스','워'],teacher:['내 수업','수'],path:['패스','패'],pulse:['펄스','펄'],care:['플레저','플'],fortune:['운세','운'],rehearsal:['리허설','리'],'family-album':['가족\n앨범','가']};
for(const [id,presentation] of Object.entries(BRAND_PRESENTATION)){const short=String(APPS[id].short||APPS[id].name),[word,mark]=DISPLAY_WORDS[id]||[short,short.slice(0,1)];Object.assign(APPS[id],presentation,{word,mark});}
export const APP_IDS=Object.keys(APPS);
export function clientRows(snapshot=[],{native=true}={}){return APP_IDS.map(id=>{const app=APPS[id];if(app.stage==='planned')return {id,status:'planned',canLaunch:false,reason:'PRODUCT_PLANNED'};if(app.stage==='preview')return {id,status:'preview',canLaunch:false,reason:'LOCAL_PREVIEW'};return snapshot.find(row=>row?.id===id)||{id,status:'unavailable',reason:native?'CHECKING':'BROWSER_PREVIEW'};});}
export function matchesLibrary(id,{search='',filter='all',favorites=[],client,teacherAvailable=false}={}){const app=APPS[id];if(!app)return false;const text=[app.name,app.keywords,app.audience,app.summary,...(id==='messenger'&&teacherAvailable?[APPS.teacher.name,APPS.teacher.keywords,APPS.teacher.summary]:[])].join(' ').toLowerCase();if(search.trim()&&!text.includes(search.trim().toLowerCase()))return false;if(filter==='installed'&&!client?.canLaunch)return false;if(filter==='favorites'&&!favorites.includes(id))return false;if(filter==='planned'&&app.stage!=='planned')return false;if(filter==='development'&&app.stage==='planned')return false;return true;}
export function bytes(value){if(!Number.isFinite(value)||value<0)return '—';if(value<1024)return `${value} B`;if(value<1024**2)return `${(value/1024).toFixed(1)} KB`;return `${(value/1024**2).toFixed(1)} MB`;}
export function statusLabel(client){if(!client)return '확인 중';if(APPS[client.id]?.stage==='planned'||client.status==='planned')return '확장 준비 중';if(client.publicWebAvailable===true&&['care','fortune','rehearsal','path'].includes(client.id))return '웹에서 이용 가능';if(APPS[client.id]?.stage==='preview'||client.status==='preview')return APPS[client.id]?.previewLabel||'교사·기관용 로컬 MVP';if(client.reason==='CHECKING')return '확인 중';if(client.reason==='BROWSER_PREVIEW')return 'PC 앱에서 확인';if(client.canLaunch)return client.updateAvailable?'업데이트 가능':'설치됨';if(client.status==='not-installed')return '설치되지 않음';if(client.reason==='INVALID_INSTALLATION')return '앱 확인 필요';return '배포 준비 중';}
export function primaryAction(client,{native=true,busy=false,teacherPreviewAvailable=false,productPreviewsAvailable=[],publicAppsAvailable=[]}={}){
  if(client?.id&&!APP_IDS.includes(client.id))return {label:'이용할 수 없음',action:'none',disabled:true};
  if(client?.id==='pulse')return {label:'PULSE 열기',action:'pulse-app',disabled:busy};
  if(busy)return {label:'확인 중…',action:'none',disabled:true};
  if(APPS[client?.id]?.stage==='planned'||client?.status==='planned')return {label:'준비 중',action:'none',disabled:true};
  if(client?.id==='teacher')return native&&teacherPreviewAvailable?{label:'내 수업 열기',action:'teacher-preview',disabled:false}:{label:native?'수업 연결 준비 중':'내 수업 · 로컬 MVP',action:'none',disabled:true};
  if(client?.id==='path'&&native&&Array.isArray(publicAppsAvailable)&&publicAppsAvailable.includes('path'))return {label:'실사 면접실 열기',action:'public-web',disabled:false};
  if(['path','care','fortune','rehearsal','family-album'].includes(client?.id)){
    if(native&&Array.isArray(productPreviewsAvailable)&&productPreviewsAvailable.includes(client.id))return {label:APPS[client.id].short+' MVP 열기',action:'product-preview',disabled:false};
    if(native&&['care','fortune','rehearsal'].includes(client.id)&&Array.isArray(publicAppsAvailable)&&publicAppsAvailable.includes(client.id))return {label:'웹으로 열기',action:'public-web',disabled:false};
    return {label:native?'로컬 MVP 준비 중':'PC 앱 · 로컬 MVP',action:'none',disabled:true};
  }
  if(!native)return {label:'PC 앱에서 설치',action:'none',disabled:true};
  if(!client)return {label:'확인 중…',action:'none',disabled:true};
  if(client.canLaunch)return {label:'실행',action:'launch',disabled:false};
  const installer=client.installer||{};
  if(installer.status==='preparing')return {label:'설치 파일 준비 중',action:'none',disabled:true};
  if(installer.status==='opening')return {label:'설치 파일 확인 중',action:'none',disabled:true};
  if(installer.status==='installer-opened')return {label:'설치 상태 확인',action:'refresh',disabled:false};
  if(installer.canOpen)return {label:'설치 시작',action:'open',disabled:false};
  if(installer.canPrepare)return {label:installer.status==='error'?'다시 준비':'설치 준비',action:'prepare',disabled:false};
  return {label:'배포 준비 중',action:'none',disabled:true};
}
export function installerLabel(installer={}){return ({idle:'설치 파일 준비 가능',preparing:'설치 파일 복사·확인 중',opening:'설치 프로그램 여는 중',ready:'설치 파일 준비 완료','installer-opened':'설치 파일을 열었어요',cancelled:'준비 취소됨',error:'설치 준비를 완료하지 못했어요',unavailable:'배포 준비 중'})[installer.status]||'배포 준비 중';}
export function progressValue(installer={}){if(Number.isFinite(installer.progress))return Math.max(0,Math.min(installer.status==='preparing'?99:100,installer.progress));const total=Number(installer.totalBytes),done=Number(installer.transferredBytes);return total>0&&Number.isFinite(done)?Math.max(0,Math.min(installer.status==='preparing'?99:100,done/total*100)):0;}
export function parsePreferences(raw){
  try{
    const value=JSON.parse(raw),activeId=id=>id==='partners'?'pulse':id;
    const selected=activeId(value?.selected),favorites=Array.isArray(value?.favorites)?value.favorites.map(activeId):[];
    return {selected:APP_IDS.includes(selected)?selected:'world',favorites:[...new Set(favorites)].filter(id=>APP_IDS.includes(id)),density:value?.density==='compact'?'compact':'comfortable',lastLaunch:Object.fromEntries(APP_IDS.map(id=>[id,APPS[id].stage!=='planned'&&Number.isFinite(value?.lastLaunch?.[id])&&value.lastLaunch[id]>0&&value.lastLaunch[id]<=8640000000000000?value.lastLaunch[id]:null]))};
  }catch{return {selected:'world',favorites:[],density:'comfortable',lastLaunch:{}};}
}
