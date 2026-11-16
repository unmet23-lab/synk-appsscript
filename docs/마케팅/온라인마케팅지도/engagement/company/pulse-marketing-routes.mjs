// PULSE 「마케팅 성과」 직원 경로(2026-11-16, docs/마케팅/PULSE_마케팅성과_20261116/서버_설계.md 4절). 본보기는 tip-share-routes.mjs다.
// 회사 세션으로 인증한다. 누가 무엇을 볼지는 pulse-marketing.mjs가 clientProjects.project로 정한다(담당자 · 그 팀의 팀장 · 관리자만 쓴다).
//   GET  /api/client-projects/<id>/marketing                 목록
//   POST /api/client-projects/<id>/marketing/report          올리기 {report}
//   POST /api/client-projects/<id>/marketing/report/remove   지우기 {kind,runId}
// 시범(데모) 요청과 주소 뒤 질의는 받지 않는다. 쓰기는 같은 출처와 그 세션의 CSRF 토큰을 요구하고, 몸통을 다 읽은 뒤 세션이 그대로인지 한 번 더 본다.
const ROUTE=/^\/api\/client-projects\/([^/]+)\/marketing(\/.*)?$/,PROJECT_ID=/^[a-f0-9-]{36}$/;
const LIMITS={'/report':{maxBytes:900000,maxChars:300000},'/report/remove':{maxBytes:2000,maxChars:1000}};
const fail=(message,status=400)=>Object.assign(new Error(message),{status});

export function createPulseMarketingRoutes({service,body,send,session,origin,audit,isStopped=()=>false}){
  function running(){if(isStopped())throw fail('서버가 잠시 멈추는 중이에요. 조금 뒤 다시 해 주세요.',503);}
  return async function pulseMarketingRoutes(req,res,{url,demoRequest=false}){
    const match=ROUTE.exec(url.pathname);if(!match)return false;
    running();
    const auth=session(req);if(!auth?.user)throw fail('먼저 로그인해 주세요.',401);
    const id=match[1],rest=match[2]||'';
    if(!PROJECT_ID.test(id)||rest&&!Object.hasOwn(LIMITS,rest))throw fail('마케팅 성과 주소를 확인해 주세요.',404);
    if(demoRequest||req.headers['x-synk-demo']==='1')throw fail('체험 화면에서는 쓸 수 없어요.',403);
    if(url.search)throw fail('마케팅 성과 주소를 확인해 주세요.');
    if(!rest){
      if(req.method!=='GET')throw fail('마케팅 성과 요청을 확인해 주세요.',405);
      if(req.headers['transfer-encoding']||Number(req.headers['content-length']||0)>0)throw fail('마케팅 성과 조회 요청을 확인해 주세요.');
      send(res,200,service.staffList(auth.user,id));return true;
    }
    if(req.method!=='POST')throw fail('마케팅 성과 요청을 확인해 주세요.',405);
    // 출처와 CSRF는 비어 있지 않은 글자일 때만 맞다고 본다(둘 다 없어서 같아지는 일이 없게).
    const token=auth.body?.csrfToken;
    if(typeof origin!=='string'||!origin||req.headers.origin!==origin||typeof token!=='string'||!token||req.headers['x-csrf-token']!==token)throw fail('회사 프로그램 화면에서 요청해 주세요.',403);
    const input=await body(req,LIMITS[rest]);
    running();
    const latest=session(req);
    if(!latest||latest.hash!==auth.hash||latest.user.id!==auth.user.id)throw fail('로그인 상태를 다시 확인해 주세요.',401);
    if(typeof latest.body?.csrfToken!=='string'||!latest.body.csrfToken||req.headers['x-csrf-token']!==latest.body.csrfToken)throw fail('회사 프로그램 화면에서 요청해 주세요.',403);
    if(rest==='/report'){
      const result=service.save(latest.user,id,input);
      // 스위치를 켠 뒤에는 올리기가 곧 공개다. 어디에 올렸는지와 덮어썼는지를 감사 기록에 남긴다.
      audit(latest.user,'pulse-marketing-report-saved',`${id}:${result.head.kind}:${result.head.runId}`,{replaced:result.replaced});
      send(res,200,result);return true;
    }
    const result=service.remove(latest.user,id,input);
    audit(latest.user,'pulse-marketing-report-removed',`${id}:${input.kind}:${input.runId}`);
    send(res,200,result);return true;
  };
}
