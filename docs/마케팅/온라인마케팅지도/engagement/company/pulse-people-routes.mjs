// PULSE 「채널 명단」 관리자 경로(인플루언서 광고 창 조각 ①, 2026-11-21). 본보기는 pulse-marketing-routes.mjs다.
// 회사 세션으로 인증하고, 관리자만 읽고 쓴다(pulse-people.mjs가 정한다).
//   GET  /api/pulse-people          명단 · 스위치 상태 · 고를 수 있는 그림
//   POST /api/pulse-people/roster   통째 저장 {version,entries}
// 시범(데모) 요청과 주소 뒤 질의는 받지 않는다. 쓰기는 같은 출처와 그 세션의 CSRF 토큰을 요구하고, 몸통을 다 읽은 뒤 세션이 그대로인지 한 번 더 본다.
// 스위치 켜고 끄기는 /api/settings/pulse-features의 people이다(관리자 · CSRF · 감사 기록 — server.mjs).
const ROUTE=/^\/api\/pulse-people(\/roster)?$/;
// 칸 60개가 모두 가장 긴 주소(저장할 꼴 1000자, JSON에서 역슬래시는 두 배)여도 받은 명단을 그대로 다시 보낼 수 있는 크기다.
const LIMIT={maxBytes:600000,maxChars:300000};
const fail=(message,status=400)=>Object.assign(new Error(message),{status});

export function createPulsePeopleRoutes({service,body,send,session,origin,audit,isStopped=()=>false}){
  function running(){if(isStopped())throw fail('서버가 잠시 멈추는 중이에요. 조금 뒤 다시 해 주세요.',503);}
  return async function pulsePeopleRoutes(req,res,{url,demoRequest=false}){
    const match=ROUTE.exec(url.pathname);if(!match)return false;
    running();
    const auth=session(req);if(!auth?.user)throw fail('먼저 로그인해 주세요.',401);
    if(demoRequest||req.headers['x-synk-demo']==='1')throw fail('체험 화면에서는 쓸 수 없어요.',403);
    if(url.search)throw fail('채널 명단 주소를 확인해 주세요.');
    if(!match[1]){
      if(req.method!=='GET')throw fail('채널 명단 요청을 확인해 주세요.',405);
      if(req.headers['transfer-encoding']||Number(req.headers['content-length']||0)>0)throw fail('채널 명단 조회 요청을 확인해 주세요.');
      send(res,200,service.adminView(auth.user));return true;
    }
    if(req.method!=='POST')throw fail('채널 명단 요청을 확인해 주세요.',405);
    // 출처와 CSRF는 비어 있지 않은 글자일 때만 맞다고 본다(둘 다 없어서 같아지는 일이 없게).
    const token=auth.body?.csrfToken;
    if(typeof origin!=='string'||!origin||req.headers.origin!==origin||typeof token!=='string'||!token||req.headers['x-csrf-token']!==token)throw fail('회사 프로그램 화면에서 요청해 주세요.',403);
    const input=await body(req,LIMIT);
    running();
    const latest=session(req);
    if(!latest||latest.hash!==auth.hash||latest.user.id!==auth.user.id)throw fail('로그인 상태를 다시 확인해 주세요.',401);
    if(typeof latest.body?.csrfToken!=='string'||!latest.body.csrfToken||req.headers['x-csrf-token']!==latest.body.csrfToken)throw fail('회사 프로그램 화면에서 요청해 주세요.',403);
    const result=service.save(latest.user,input);
    // 손님에게 보이는 칸이 바뀌는 쓰기라 판 번호 · 칸 수 · 고를 수 있는 칸 수(켜짐 · 예시 아님) · 지금 손님에게 보이는지(스위치까지 본 값)를 감사 기록에 남긴다(GPT GA2).
    audit(latest.user,'pulse-people-roster-saved','pulse-people',{version:result.version,entries:result.entries.length,selectable:result.entries.filter(item=>item.active&&!item.example).length,visible:result.visible});
    send(res,200,result);return true;
  };
}
