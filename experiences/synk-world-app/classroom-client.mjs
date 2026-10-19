// 「우리 반 수업」 목록: 학생 앱(SYNK-talk src/수업영상API.js · src/사건통로.js)과 같은 classroom 함수를 WORLD의 SYNK ID 토큰으로 부른다.
// 함수는 토큰의 sub로 학생 명부(engine.learners)를 찾는다. WORLD의 반 연결(synk-classroom enrollment/claim)이 그 명부에
// 이 계정을 적으므로 같은 토큰이 통한다. 서버 함수·DB는 바꾸지 않는다. 계약판은 학생 앱 src/계약판.js와 같아야 한다(앞선 판이면 426).
export const CLASSROOM_CONTRACT_VER='c16';
const classroomRecord=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const classroomText=value=>typeof value==='string'?value:null;
const classroomFailure=(code,status)=>Object.assign(new Error('수업 목록을 불러오지 못했어요.'),{code,status});

// 계정 API 주소(…/functions/v1/synk-account 등)와 같은 프로젝트의 /functions/v1/classroom. 함수는 쿼리가 붙으면 400이다.
export function classroomEndpoint(accountApiUrl){
 const url=new URL(accountApiUrl);
 url.pathname=url.pathname.replace(/\/$/,'').replace(/\/functions\/v1(?:\/synk-(?:account|world-v1|town))?$/,'')+'/functions/v1/classroom';
 url.search='';url.hash='';return url.href;
}

// 서버가 낸 모양(SYNK-talk lib/수업영상.js presentClass)만 남긴다. 상태 이름은 그대로 두고 화면이 학생 앱처럼 묶는다.
export function normalizeClassroomClasses(list){
 return list.filter(c=>classroomRecord(c)&&typeof c.class_id==='string'&&c.class_id).map(c=>({
  class_id:c.class_id,display_name:classroomText(c.display_name)||'',video_privacy:classroomText(c.video_privacy),playlist_url:classroomText(c.playlist_url),meeting_url:classroomText(c.meeting_url),
  sessions:(Array.isArray(c.sessions)?c.sessions:[]).filter(s=>classroomRecord(s)&&typeof s.session_key==='string'&&typeof s.title==='string')
   .map(s=>({session_key:s.session_key,title:s.title,starts_at:classroomText(s.starts_at),ends_at:classroomText(s.ends_at),status:classroomText(s.status)||'',watch_url:classroomText(s.watch_url)}))}));
}

// 401은 두 가지다.
// · 게이트웨이(verify_jwt)가 만료·잘못된 토큰을 자르면 우리 봉투(error.code)가 없다 → 한 번만 갱신해 다시 묻는다(학생 앱 통로와 같다).
// · 함수가 낸 AUTH_REQUIRED는 이 계정이 학생 명부에 없다는 뜻이다. 반을 연결하지 않은 WORLD 계정이 대부분 그렇다 → 빈 목록.
//   WORLD의 다른 요청처럼 로그아웃시키지 않는다. 계정 세션 판정은 synk-account 확인이 맡는다.
export async function requestClassrooms({url,publishableKey,token,renew=null,fetch,guard=()=>{}}){
 for(let attempt=0;;attempt++){
  guard();
  const response=await fetch(url,{method:'GET',credentials:'omit',cache:'no-store',redirect:'error',
   headers:{apikey:publishableKey,Authorization:`Bearer ${token()}`,'X-Contract-Ver':CLASSROOM_CONTRACT_VER}});guard();
  const body=await response.json().catch(()=>null);guard();
  const code=classroomRecord(body)&&body.ok===false&&classroomRecord(body.error)&&typeof body.error.code==='string'?body.error.code:null;
  if(response.status===401&&code==='AUTH_REQUIRED')return {classes:[],emptyReason:'NO_LEARNER'};
  if(response.status===401&&!code&&attempt===0&&renew){const next=await renew();guard();if(next)continue;}
  if(!response.ok||!classroomRecord(body)||body.ok!==true)throw classroomFailure(code||(response.status===401?'AUTH_EXPIRED':'CLASSROOM_UNAVAILABLE'),response.status);
  if(!Array.isArray(body.classes))throw classroomFailure('CONTRACT_VIOLATION',response.status);
  return {classes:normalizeClassroomClasses(body.classes),emptyReason:typeof body.empty_reason==='string'?body.empty_reason:null};
 }
}
