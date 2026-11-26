// PULSE 「채널 명단」 관리자 경로(인플루언서 광고 창 조각 ①, 2026-11-21). 본보기는 pulse-marketing-routes.mjs다.
// 회사 세션으로 인증하고, 관리자만 읽고 쓴다(pulse-people.mjs가 정한다).
//   GET  /api/pulse-people          명단 · 스위치 상태 · 고를 수 있는 그림
//   POST /api/pulse-people/roster   통째 저장 {version,entries}
//   POST /api/pulse-people/media    그림 한 장(PNG · JPEG 2MB, 몸통이 그림 바이트 — 조각 ③)
//   GET  /api/pulse-people/media/<id>  올린 그림 보기(관리자)
// 시범(데모) 요청과 주소 뒤 질의는 받지 않는다. 쓰기는 같은 출처와 그 세션의 CSRF 토큰을 요구하고, 몸통을 다 읽은 뒤 세션이 그대로인지 한 번 더 본다.
// 스위치 켜고 끄기는 /api/settings/pulse-features의 people이다(관리자 · CSRF · 감사 기록 — server.mjs).
const ROUTE=/^\/api\/pulse-people(?:(\/roster)|(\/media)(?:\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}))?)?$/;
// 칸 60개가 모두 가장 긴 주소(저장할 꼴 1000자, JSON에서 역슬래시는 두 배)여도 받은 명단을 그대로 다시 보낼 수 있는 크기다.
const LIMIT={maxBytes:600000,maxChars:300000};
const fail=(message,status=400)=>Object.assign(new Error(message),{status});

// media(조각 ③): {receive(req), commit(upload), discard(upload), remove(diskName), serve(req,res,doc,authorize)} — server.mjs가 작업실 파일 자리로 묶어 준다.
export function createPulsePeopleRoutes({service,body,send,session,origin,audit,isStopped=()=>false,media=null}){
  function running(){if(isStopped())throw fail('서버가 잠시 멈추는 중이에요. 조금 뒤 다시 해 주세요.',503);}
  // 정리된 그림 파일을 지우고, 지웠거나 이미 없던 것만 문서에서 뗀다. 지우지 못한 파일은 문서가 남아 다음 정리 때 다시 지운다(GPT 검수 GA8).
  // 이번에 실제로 지운 수(deleted)와 이미 없던 수(missing)를 돌려준다 — 감사 기록에는 시도한 수가 아니라 지운 수를 적는다(서버 끝 판 카본 A2),
  // 이미 없던 파일(서버가 먼저 비움 등)은 지운 수에 세지 않는다(감사 기록 검수 GA1). remove가 참 · 거짓을 돌려주지 않으면 지운 것으로 본다.
  async function dropFiles(names=[]){
    const out={deleted:0,missing:0};if(!media||!names.length)return out;const done=[];
    for(const name of names){try{const removed=await media.remove(name);done.push(name);if(removed===false)out.missing++;else out.deleted++;}catch{}}
    if(done.length)service.forgetMedia(done);return out;
  }
  return async function pulsePeopleRoutes(req,res,{url,demoRequest=false}){
    const match=ROUTE.exec(url.pathname);if(!match)return false;
    running();
    const auth=session(req);if(!auth?.user)throw fail('먼저 로그인해 주세요.',401);
    if(demoRequest||req.headers['x-synk-demo']==='1')throw fail('체험 화면에서는 쓸 수 없어요.',403);
    if(url.search)throw fail('채널 명단 주소를 확인해 주세요.');
    const [,roster,mediaPath,mediaId]=match;
    // 그림 보기(관리자). 권한을 먼저 보고 파일을 읽는다 — 내주는 동안에도 세션이 그대로인지 serve가 한 번 더 부른다.
    if(mediaPath&&mediaId){
      if(!['GET','HEAD'].includes(req.method))throw fail('채널 명단 그림 요청을 확인해 주세요.',405);
      if(!media)throw fail('그림을 찾지 못했어요.',404);
      const doc=service.adminMedia(auth.user,mediaId);
      await media.serve(req,res,doc,()=>{const latest=session(req);if(!latest||latest.hash!==auth.hash)throw fail('로그인 상태를 다시 확인해 주세요.',401);service.adminMedia(latest.user,mediaId);});
      return true;
    }
    if(!roster&&!mediaPath){
      if(req.method!=='GET')throw fail('채널 명단 요청을 확인해 주세요.',405);
      if(req.headers['transfer-encoding']||Number(req.headers['content-length']||0)>0)throw fail('채널 명단 조회 요청을 확인해 주세요.');
      send(res,200,service.adminView(auth.user));return true;
    }
    if(req.method!=='POST')throw fail('채널 명단 요청을 확인해 주세요.',405);
    // 출처와 CSRF는 비어 있지 않은 글자일 때만 맞다고 본다(둘 다 없어서 같아지는 일이 없게).
    const token=auth.body?.csrfToken;
    if(typeof origin!=='string'||!origin||req.headers.origin!==origin||typeof token!=='string'||!token||req.headers['x-csrf-token']!==token)throw fail('회사 프로그램 화면에서 요청해 주세요.',403);
    // 그림 올리기: 받기 전에 관리자인지 보고(관리자가 아니면 몸통을 받지 않는다), 받은 뒤 세션을 다시 보고, 파일을 자리에 둔 다음 문서를 적는다. 문서를 못 적으면 파일을 지운다.
    if(mediaPath){
      if(!media||!service.mediaOpen())throw fail('명단 그림 올리기는 아직 열리지 않았어요.',404);
      service.assertAdmin(auth.user);
      let upload=null;
      try{
        upload=await media.receive(req);running();
        const fresh=session(req);
        if(!fresh||fresh.hash!==auth.hash||fresh.user.id!==auth.user.id)throw fail('로그인 상태를 다시 확인해 주세요.',401);
        await media.commit(upload);
        // 파일을 옮기는 사이 로그아웃 · 만료됐을 수 있어 문서를 적기 바로 전에 세션을 한 번 더 본다(같은 동기 구간 — GPT 검수 GA4).
        const still=session(req);
        if(!still||still.hash!==auth.hash||still.user.id!==auth.user.id)throw fail('로그인 상태를 다시 확인해 주세요.',401);
        const added=service.addMedia(still.user,upload.metadata);upload=null;
        const dropped=await dropFiles(added.removed);
        audit(still.user,'pulse-people-media-uploaded','pulse-people',{ref:added.ref,removed:dropped.deleted,...(dropped.missing?{missing:dropped.missing}:{})});
        send(res,201,{ref:added.ref,url:added.url});return true;
      }finally{if(upload)await media.discard(upload).catch(()=>{});}
    }
    const input=await body(req,LIMIT);
    running();
    const latest=session(req);
    if(!latest||latest.hash!==auth.hash||latest.user.id!==auth.user.id)throw fail('로그인 상태를 다시 확인해 주세요.',401);
    if(typeof latest.body?.csrfToken!=='string'||!latest.body.csrfToken||req.headers['x-csrf-token']!==latest.body.csrfToken)throw fail('회사 프로그램 화면에서 요청해 주세요.',403);
    // 찾지 못한 그림으로 저장하면(SYNK_PEOPLE_MEDIA_GONE) 그 그림의 참조를 함께 내린다 — 화면이 그 그림만 뺀다(GPT pulse-people-followups-20261127 GA1).
    let saved;try{saved=service.save(latest.user,input);}catch(error){if(error?.code==='SYNK_PEOPLE_MEDIA_GONE'&&Array.isArray(error.gone)){send(res,400,{error:error.message,code:error.code,gone:error.gone});return true;}throw error;}
    const {removed=[],...result}=saved;
    // 정리가 돌려준 파일(지우는 중으로 표시한 지 하루 지난 그림)은 저장이 커밋된 뒤 디스크에서 지운다. 응답에는 싣지 않는다.
    await dropFiles(removed);
    // 손님에게 보이는 칸이 바뀌는 쓰기라 판 번호 · 칸 수 · 고를 수 있는 칸 수(켜짐 · 예시 아님) · 지금 손님에게 보이는지(스위치까지 본 값)를 감사 기록에 남긴다(GPT GA2).
    audit(latest.user,'pulse-people-roster-saved','pulse-people',{version:result.version,entries:result.entries.length,selectable:result.entries.filter(item=>item.active&&!item.example).length,visible:result.visible});
    send(res,200,result);return true;
  };
}
