// 내 글감 경로(2026-11-20, 계약 .tmp/employee-stories-contract.md).
// 공개 쪽 /story/…는 세션 · 쿠키를 읽지 않고 같은 출처 JSON POST만 받는다(trial-feedback-routes.mjs와 같은 틀).
// 직원 쪽 /api/my-stories…는 세션 + 같은 출처 + CSRF, 본문을 다 읽은 뒤 세션을 다시 본다(tip-share-routes.mjs와 같은 틀).
// 이 이름은 workspaceRouteFeature의 SNS · 제작 관문에 걸리지 않는다 — 담당 권한 없이 모든 정직원이 쓴다.
import {staffStoryError,isStaffStoryPublicId} from './staff-stories.mjs';

const UUID='[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
const STORY=new RegExp('^/api/my-stories/('+UUID+')$');
const INQUIRY=/^\/api\/my-stories\/inquiries\/(story-[a-f0-9]{64})$/;
const HELD=/^\/api\/my-stories\/held-inquiries\/(story-[a-f0-9]{64})$/;
const PUBLIC=/^\/story\/([A-Za-z0-9_-]{22})\/(content|inquiries)$/;
export const STAFF_STORY_PAGE=/^\/story\/([A-Za-z0-9_-]{22})$/;
// 접수증 화면: 글이 내려가거나 주인이 중지돼도 방문자가 접수증으로 본인 문의를 확인 · 삭제하는 고정 주소(publicId는 22자라 겹치지 않는다).
export const STAFF_STORY_RECEIPT_PAGE='/story/receipt';

export function createStaffStoryRoutes({service,body,send,session,origin,clientAddress,isStopped=()=>false}){
  if(typeof origin!=='string'||!origin)throw new Error('staff story routes need the registered origin');
  function running(){if(isStopped())throw staffStoryError('서버가 잠시 멈추는 중이에요. 조금 뒤 다시 해 주세요.',503,'SYNK_STORY_STOPPING');}
  function headers(res){res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Robots-Tag','noindex, nofollow');}
  function failure(res,error){
    const status=Number.isInteger(error?.status)&&error.status>=400&&error.status<600?error.status:500;
    const code=typeof error?.code==='string'&&/^SYNK_STORY_[A-Z_]+$/.test(error.code)?error.code:status===413?'SYNK_STORY_TOO_LARGE':status===400?'SYNK_STORY_INVALID':status===404?'SYNK_STORY_NOT_FOUND':'SYNK_STORY_UNAVAILABLE';
    const message=status>=500&&code==='SYNK_STORY_UNAVAILABLE'?'잠시 문제가 생겼어요. 조금 뒤 다시 해 주세요.':String(error?.message||'요청을 확인해 주세요.');
    if(status===429)res.setHeader('Retry-After',String(error.retryAfterSeconds||60));
    send(res,status,{error:message,code,...(typeof error?.field==='string'?{field:error.field}:{}),...(status===429?{retryAfterSeconds:error.retryAfterSeconds||60}:{}),...(error?.story?{story:error.story}:{})});
  }
  const noBody=req=>{if(req.headers['transfer-encoding']||Number(req.headers['content-length']||0)>0)throw staffStoryError('조회 요청에는 본문을 싣지 않아요.',400,'SYNK_STORY_INVALID');};
  function json(req){
    if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))throw staffStoryError('JSON으로 보내 주세요.',415,'SYNK_STORY_CONTENT_TYPE');
    req.headers['content-type']=req.headers['content-type'].toLowerCase();
  }
  // 방문자 쪽. 화면 HTML(/story/<id>, /story/receipt)은 server.mjs의 정적 응답이 맡으므로 여기서는 지나간다.
  async function publicRoutes(req,res,{url}){
    const path=url.pathname,match=path.match(PUBLIC);
    if(!match&&path!=='/story/inquiry-receipt'&&path!=='/story/inquiry-delete')return false;
    headers(res);
    try{
      running();
      if(url.search||req.headers['x-synk-demo']==='1')throw staffStoryError('주소를 확인해 주세요.',400,'SYNK_STORY_INVALID',{field:'url'});
      if(match?.[2]==='content'){
        if(req.method!=='GET'&&req.method!=='HEAD')throw staffStoryError('요청을 확인해 주세요.',405,'SYNK_STORY_METHOD');
        noBody(req);send(res,200,service.publicView(match[1]));return true;
      }
      if(req.method!=='POST')throw staffStoryError('요청을 확인해 주세요.',405,'SYNK_STORY_METHOD');
      if(req.headers.origin!==origin)throw staffStoryError('이 글 화면에서 다시 보내 주세요.',403,'SYNK_STORY_ORIGIN');
      json(req);
      const input=await body(req,{maxBytes:36000,maxChars:12000});running();
      const context={client:clientAddress(req)};
      if(match){const {status,result}=service.submit(match[1],input,context);send(res,status,result);return true;}
      send(res,200,path==='/story/inquiry-receipt'?service.lookup(input,context):service.removeByVisitor(input,context));
    }catch(error){failure(res,error);}
    return true;
  }
  async function staffRoutes(req,res,{url,demoRequest=false}){
    const path=url.pathname;
    if(path!=='/api/my-stories'&&!path.startsWith('/api/my-stories/'))return false;
    headers(res);
    try{
      running();
      const auth=session(req);if(!auth?.user)throw staffStoryError('먼저 로그인해 주세요.',401,'SYNK_STORY_LOGIN');
      if(demoRequest||req.headers['x-synk-demo']==='1')throw staffStoryError('체험 화면에서는 쓸 수 없어요.',403,'SYNK_STORY_DEMO');
      if(url.search)throw staffStoryError('주소를 확인해 주세요.',400,'SYNK_STORY_INVALID',{field:'url'});
      const story=path.match(STORY),inquiry=path.match(INQUIRY),held=path.match(HELD);
      const known=path==='/api/my-stories'||path==='/api/my-stories/held-inquiries'||story||inquiry||held;
      if(!known)throw staffStoryError('요청을 찾을 수 없어요.',404,'SYNK_STORY_NOT_FOUND');
      if(req.method==='GET'){
        noBody(req);
        if(path==='/api/my-stories')return send(res,200,service.workspace(auth.user)),true;
        if(path==='/api/my-stories/held-inquiries')return send(res,200,service.heldInquiries(auth.user)),true;
        if(inquiry)return send(res,200,service.inquiry(auth.user,inquiry[1])),true;
        if(held)return send(res,200,service.heldInquiry(auth.user,held[1])),true;
        throw staffStoryError('요청을 확인해 주세요.',405,'SYNK_STORY_METHOD');
      }
      if(req.method!=='POST'||path==='/api/my-stories/held-inquiries')throw staffStoryError('요청을 확인해 주세요.',405,'SYNK_STORY_METHOD');
      const token=auth.body?.csrfToken;
      if(req.headers.origin!==origin||typeof token!=='string'||!token||req.headers['x-csrf-token']!==token)throw staffStoryError('회사 프로그램 화면에서 요청해 주세요.',403,'SYNK_STORY_CSRF');
      json(req);
      const input=await body(req,{maxBytes:80000,maxChars:40000});
      running();
      const latest=session(req);
      if(!latest?.user||latest.hash!==auth.hash||latest.user.id!==auth.user.id)throw staffStoryError('로그인 상태를 다시 확인해 주세요.',401,'SYNK_STORY_LOGIN');
      if(typeof latest.body?.csrfToken!=='string'||req.headers['x-csrf-token']!==latest.body.csrfToken)throw staffStoryError('회사 프로그램 화면에서 요청해 주세요.',403,'SYNK_STORY_CSRF');
      if(path==='/api/my-stories'){const {status,...result}=service.create(latest.user,input);send(res,status,result);return true;}
      if(story)return send(res,200,service.mutate(latest.user,story[1],input)),true;
      if(inquiry)return send(res,200,service.inquiryAction(latest.user,inquiry[1],input)),true;
      return send(res,200,service.heldAction(latest.user,held[1],input)),true;
    }catch(error){failure(res,error);}
    return true;
  }
  return {publicRoutes,staffRoutes,isPage:path=>STAFF_STORY_PAGE.test(path),isReceiptPage:path=>path===STAFF_STORY_RECEIPT_PAGE,pagePublicId:path=>path.match(STAFF_STORY_PAGE)?.[1]||null,isPublicId:isStaffStoryPublicId};
}
