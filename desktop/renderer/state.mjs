import {MEMBER_BENEFITS} from './benefits.mjs';
export const INSTALLABLE_IDS=['world','messenger'];
export const APPS={
  world:{name:'SYNK WORLD',short:'WORLD',icon:'world.png',category:'KOREAN · TOPIK · PLAY',description:'TOPIK 진단부터 쓰기 연습, 한국어 게임까지 들어 있어요.',cover:'world-book.avif',alt:'코랄색 표지에 크림색 장을 펼친 펠트 책',caption:'SYNK WORLD · 싱크 월드',stage:'development',audience:'한국어를 배우는 학생',keywords:'월드 학습 게임 학생 토픽 TOPIK 진단 쓰기 듣기 읽기 한글 바람길 리듬 튜터 옷장 싱크타운',summary:'짧은 진단으로 TOPIK I 내 위치를 보고, 그에 맞춘 이번 주 연습과 게임을 이어서 해요.',features:[['TOPIK 준비','TOPIK I 짧은 진단으로 내 위치를 보고, 듣기·읽기 연습과 TOPIK II 쓰기 연습을 해요.'],['한국어 놀이','바람길·말의 리듬·한글 만나기 같은 게임으로 소리와 글자를 익혀요.'],['튜터와 옷장','까몽·몽글·마린 중 고른 친구가 튜터로 같이 다녀요. 옷장에서 친구들 옷도 골라 입혀요.']]},
  messenger:{name:'SYNK Workspace',short:'WORKSPACE',icon:'messenger.png',category:'CHAT · TASKS · CLASS',description:'SYNK 팀이 대화하고 일하는 업무 앱이에요.',cover:'laptop.webp',alt:'SYNK의 파란 펠트 노트북',caption:'SYNK WORKSPACE · 싱크 워크스페이스',stage:'development',audience:'SYNK 회사 구성원·담당 교사',keywords:'워크스페이스 Workspace 싱크 내 수업 교사 학급 학생 과제 메신저 사내 회사 팀 업무 할일 알림 내 작업실 제작 콘텐츠 스튜디오 Studio SHIFT 시프트 인공지능 AI 연습 검토',summary:'팀 대화, 오늘 할 일, 작업실과 제작 도구, 교사의 「내 수업」이 들어 있어요.',features:[['팀 대화','개인·팀 대화방에서 이야기하고 파일을 주고받아요.'],['내 업무','오늘 할 일과 기한, 내 차례인 검토와 알림을 한 화면에서 챙겨요.'],['작업실','트렌드·레퍼런스를 모으고, 제작 데스크에서 기획부터 게시 전 점검까지 해요. AI 업무 연습도 여기서 해요.']]},
  teacher:{name:'워크스페이스 · 내 수업',short:'워크스페이스 / 내 수업',icon:'world.png',category:'TEACH · GUIDE · GROW',description:'학생 기록으로 다음 수업을 준비해요.',cover:'world.png',alt:'SYNK의 펠트 책',caption:'SYNK WORKSPACE · 내 수업',stage:'preview',audience:'한국어 교사·교육기관 운영자',keywords:'교사 선생님 기관 학원 학교 수업 숙제 평가 교육',summary:'워크스페이스 안의 「내 수업」이에요. 담당 반 학생이 공유한 학습 기록을 보고, 과제를 보내고, 챙길 일을 정해요.',boundary:'학생이 공유한 기록만 보여요. 담당 반 권한과 회사 자료 권한은 따로 확인해요.',features:[['담당 반','반마다 학생의 최근 활동과 문항 기록을 한눈에 봐요.'],['기록과 과제','학생이 공유한 학습 기록을 보고, 읽기·게임 과제를 보내 결과를 봐요.'],['관찰과 챙길 일','수업에서 본 것은 관찰로 남기고, 학생마다 챙길 일을 정해요.']]},
  path:{name:'SYNK PATH',short:'PATH',icon:'world.png',category:'INTERVIEW · PRACTICE',description:'세 면접관 앞에서 미리 해 보는 60~90초 면접 연습이에요.',cover:'world.png',alt:'진로 준비를 나타내는 승인 펠트 책',caption:'VR INTERVIEW · 60–90 SECONDS',stage:'preview',previewLabel:'웹에서 연습',audience:'한국 유학·진로·취업을 준비하는 학습자',keywords:'패스 VR Quest 가상 캠퍼스 진로 진학 취업 이력서 면접 목표 음성 경청 필기',summary:'요양보호사 지원 면접을 세 면접관 앞에서 연습해요. 말이나 글로 답하면 내 답에 맞춘 후속 질문이 하나 더 나와요. 한 번에 60~90초예요.',boundary:'PC 브라우저에서는 말이나 글로, Quest 브라우저에서는 VR로 연습해요. 답은 계정에 저장하지 않아요.',features:[['면접관 세 명','면접관들이 답을 들으며 메모해요. 실제 면접장처럼 세 사람의 시선을 받으며 답해요.'],['내 답에 맞춘 후속 질문','말하거나 입력한 답을 보고, 경험을 묻는 질문과 준비를 묻는 질문 중 하나가 이어져요.'],['앉은 채로 둘러보기','PC에서는 화면을 끌어 30도까지 둘러보고, Quest에서는 고개를 돌려 둘러봐요.']]},
  pulse:{name:'SYNK PULSE',short:'PULSE',icon:'messenger.png',category:'CAST · CREATE · REVIEW',description:'광고 모델 고르기부터 시안 확인과 승인까지.',cover:'laptop.webp',alt:'고객과 작품 협업을 나타내는 승인 펠트 노트북',caption:'CLIENT STUDIO · PROJECT & REVIEW',stage:'preview',previewLabel:'전용 창',audience:'광고 제작 고객·창작자·파트너',keywords:'펄스 pulse partners 파트너 창작자 외부 고객 작품 프로젝트 발주 피드백 영상 브랜드 콘텐츠 포트폴리오 모델 캐스팅 광고 제작 진행 수정 의견 승인',summary:'광고 제작을 맡긴 고객이 모델과 작업물을 고르고, 진행 단계와 시안을 보며 의견을 남기고 승인하는 앱이에요.',boundary:'초대 링크로 연결한 프로젝트만 보여요. 남긴 의견과 승인은 담당자에게 전해져요.',features:[['모델·포트폴리오','공개된 모델과 작업물을 보고 마음에 드는 것을 제작 요청에 담아요.'],['진행 단계·수정 의견','프로젝트가 어느 단계인지 보고, 시안의 버전·장면마다 의견을 남겨요.'],['최종 승인','마지막 시안을 승인하면 승인한 버전과 시각이 남고, 최종 파일을 받을 수 있어요.']]},
};
for(const benefit of MEMBER_BENEFITS){
  // 화면 안에 들어가는 혜택(내 성향 확인하기·AI 구독 계정판)은 회원 혜택 화면 안에서만 열리며 앱 목록·실행 권한과 연결하지 않는다.
  // 10-14 insight가 이 조건 없이 아래 마지막 분기로 떨어져 「가족 앨범」 이름의 앱으로 목록에 들어갔었다.
  if(benefit.embedded)continue;
  if(benefit.id==='care'){
    APPS.care={name:'SYNK 플레저',short:'플레저',icon:benefit.asset,category:'DATES · LEDGER · CONTACT',description:benefit.headline,cover:benefit.asset,alt:benefit.alt,caption:'RELATIONSHIP CARE · WEB',stage:'preview',previewLabel:'웹에서 열림',audience:'생일·경조사와 연락을 챙기고 싶은 사람',keywords:'플레저 챙김 관계 생일 경조사 기념일 결혼 부고 연락 말투 녹음 대화',summary:benefit.description,boundary:benefit.availability,features:benefit.steps.map(step=>[step.title,step.body])};
    continue;
  }
  if(benefit.id==='fortune'){
    APPS.fortune={name:'SYNK 무료 운세',short:'무료 운세',icon:benefit.asset,category:'TODAY · TAROT · SAJU',description:benefit.headline,cover:benefit.asset,alt:benefit.alt,caption:'SYNK FOR YOU · WEB',stage:'preview',previewLabel:'웹에서 열림',audience:'재미로 운세를 보고 싶은 사람',keywords:'운세 무료 오늘 이번주 별자리 zodiac horoscope 한국 사주 saju 만세력 생년월일 출생시각 일간 오행 행운 색 숫자 일상 계정 저장 보관함 메모 실천 기록 내보내기',summary:benefit.description,boundary:benefit.availability,features:benefit.steps.map(step=>[step.title,step.body])};
    continue;
  }

}
// Division colours: docs/디자인_토큰.json, SNS키트/README.md and approved palette.
// Studio and SHIFT are workroom features in Messenger, not separate apps.
export const BRAND_PRESENTATION={
  world:{brand:'LAB · 학생',accent:'#F96859',ink:'#AE322A'},
  messenger:{brand:'SYNK · 팀',accent:'#000000',ink:'#000000'},
  teacher:{brand:'LAB · 교사',accent:'#F96859',ink:'#AE322A',icon:'teacher-cover.png',cover:'teacher-cover.png',alt:'수업 내용을 정리한 코럴색 펠트 발표 보드와 연단'},
  path:{brand:'PATH · 면접 연습',accent:'#526956',ink:'#526956',icon:'path-cover.png',cover:'path-cover.png',alt:'유학 계획 노트에서 대학 건물로 이어지는 초록색 펠트 길'},
  pulse:{brand:'PULSE · 광고 제작',accent:'#99295D',ink:'#99295D',icon:'pulse-cover.png',cover:'pulse-cover.png',alt:'작품을 담은 베리색 펠트 레코드와 사용 범위 서류'},
  care:{brand:'SYNK · 회원 혜택',accent:'#3D6BC9',ink:'#24448C'},
  fortune:{brand:'SYNK · 회원 혜택',accent:'#F5C445',ink:'#7E5A10'},
};
// 2026-10-06 platform redesign: each app is shown as a big Hangul word (the homepage 싱ㅋ idea)
// and a one-syllable tile. Display only; ids, names and entitlements are unchanged.
const DISPLAY_WORDS={world:['월드','월'],messenger:['워크\n스페이스','워'],teacher:['내 수업','수'],path:['패스','패'],pulse:['펄스','펄'],care:['플레저','플'],fortune:['운세','운']};
// 회원 혜택 목록에서 내린 것(10-30 무료 운세)은 앱 칸이 없으니 꾸밈도 건너뛴다.
for(const [id,presentation] of Object.entries(BRAND_PRESENTATION)){if(!APPS[id])continue;const short=String(APPS[id].short||APPS[id].name),[word,mark]=DISPLAY_WORDS[id]||[short,short.slice(0,1)];Object.assign(APPS[id],presentation,{word,mark});}
export const APP_IDS=Object.keys(APPS);
// 목록에서 잠시 내린 앱(10-30 무료 운세). 화면·새 기록에는 안 나오지만, 이미 저장된 기록을 읽고 지키는 검사에서는 아는 앱으로 친다.
export const PAUSED_APP_IDS=Object.freeze(['fortune']);
export function clientRows(snapshot=[],{native=true}={}){return APP_IDS.map(id=>{const app=APPS[id];if(app.stage==='planned')return {id,status:'planned',canLaunch:false,reason:'PRODUCT_PLANNED'};if(app.stage==='preview')return {id,status:'preview',canLaunch:false,reason:'LOCAL_PREVIEW'};return snapshot.find(row=>row?.id===id)||{id,status:'unavailable',reason:native?'CHECKING':'BROWSER_PREVIEW'};});}
export function matchesLibrary(id,{search='',filter='all',favorites=[],client,teacherAvailable=false}={}){const app=APPS[id];if(!app)return false;const text=[app.name,app.keywords,app.audience,app.summary,...(id==='messenger'&&teacherAvailable?[APPS.teacher.name,APPS.teacher.keywords,APPS.teacher.summary]:[])].join(' ').toLowerCase();if(search.trim()&&!text.includes(search.trim().toLowerCase()))return false;if(filter==='installed'&&!client?.canLaunch)return false;if(filter==='favorites'&&!favorites.includes(id))return false;if(filter==='planned'&&app.stage!=='planned')return false;if(filter==='development'&&app.stage==='planned')return false;return true;}
export function bytes(value){if(!Number.isFinite(value)||value<0)return '—';if(value<1024)return `${value} B`;if(value<1024**2)return `${(value/1024).toFixed(1)} KB`;return `${(value/1024**2).toFixed(1)} MB`;}
export function statusLabel(client){if(!client)return '확인 중';if(APPS[client.id]?.stage==='planned'||client.status==='planned')return '준비 중';if(client.publicWebAvailable===true&&['care','fortune','path'].includes(client.id))return '웹에서 열림';if(APPS[client.id]?.stage==='preview'||client.status==='preview')return APPS[client.id]?.previewLabel||'교사·기관용 미리보기';if(client.reason==='CHECKING')return '확인 중';if(client.reason==='BROWSER_PREVIEW')return 'PC 앱에서';if(client.canLaunch)return client.updateAvailable?'업데이트 가능':'설치됨';if(client.status==='not-installed')return '설치되지 않음';if(client.reason==='INVALID_INSTALLATION')return '다시 설치 필요';return '준비 중';}
export function primaryAction(client,{native=true,busy=false,teacherPreviewAvailable=false,productPreviewsAvailable=[],publicAppsAvailable=[]}={}){
  if(client?.id&&!APP_IDS.includes(client.id))return {label:'이용할 수 없음',action:'none',disabled:true};
  if(client?.id==='pulse')return {label:'PULSE 열기',action:'pulse-app',disabled:busy};
  if(busy)return {label:'확인 중…',action:'none',disabled:true};
  if(APPS[client?.id]?.stage==='planned'||client?.status==='planned')return {label:'준비 중',action:'none',disabled:true};
  if(client?.id==='teacher')return native&&teacherPreviewAvailable?{label:'내 수업 열기',action:'teacher-preview',disabled:false}:{label:'내 수업 준비 중',action:'none',disabled:true};
  if(client?.id==='path'&&native&&Array.isArray(publicAppsAvailable)&&publicAppsAvailable.includes('path'))return {label:'면접 연습 열기',action:'public-web',disabled:false};
  if(['path','care','fortune'].includes(client?.id)){
    if(native&&Array.isArray(productPreviewsAvailable)&&productPreviewsAvailable.includes(client.id))return {label:APPS[client.id].short+' 열기',action:'product-preview',disabled:false};
    if(native&&['care','fortune'].includes(client.id)&&Array.isArray(publicAppsAvailable)&&publicAppsAvailable.includes(client.id))return {label:'웹에서 열기',action:'public-web',disabled:false};
    return {label:native?'준비 중':'PC 앱에서만',action:'none',disabled:true};
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
  return {label:'준비 중',action:'none',disabled:true};
}
export function installerLabel(installer={}){return ({idle:'설치 가능',preparing:'설치 파일 준비 중',opening:'설치 프로그램 여는 중',ready:'설치 파일 준비됨','installer-opened':'설치 창 열림',cancelled:'준비 취소됨',error:'설치 파일 준비 실패',unavailable:'설치 파일 없음'})[installer.status]||'설치 파일 없음';}
export function progressValue(installer={}){if(Number.isFinite(installer.progress))return Math.max(0,Math.min(installer.status==='preparing'?99:100,installer.progress));const total=Number(installer.totalBytes),done=Number(installer.transferredBytes);return total>0&&Number.isFinite(done)?Math.max(0,Math.min(installer.status==='preparing'?99:100,done/total*100)):0;}
export function parsePreferences(raw){
  try{
    const value=JSON.parse(raw),activeId=id=>id==='partners'?'pulse':id;
    const selected=activeId(value?.selected),favorites=Array.isArray(value?.favorites)?value.favorites.map(activeId):[];
    return {selected:APP_IDS.includes(selected)?selected:'world',favorites:[...new Set(favorites)].filter(id=>APP_IDS.includes(id)),density:value?.density==='compact'?'compact':'comfortable',lastLaunch:Object.fromEntries(APP_IDS.map(id=>[id,APPS[id].stage!=='planned'&&Number.isFinite(value?.lastLaunch?.[id])&&value.lastLaunch[id]>0&&value.lastLaunch[id]<=8640000000000000?value.lastLaunch[id]:null]))};
  }catch{return {selected:'world',favorites:[],density:'comfortable',lastLaunch:{}};}
}
