// 공유한 게시물 API(2026-11-16, TIP-SHARES.md). 모든 경로는 로그인한 관리자만 쓴다. 보기 전용 체험(데모) 요청과 주소 뒤 쿼리는 받지 않는다.
// POST는 같은 출처 · 세션의 CSRF 토큰을 요구하고, 본문을 다 읽은 뒤 세션이 그대로인지 한 번 더 본다(읽는 동안 로그아웃 · 권한 회수).
import {tipShareError,TIP_SHARE_LIMITS} from './tip-shares.mjs';

const POSTS=new Map([
  ['/api/tip-shares/decision','decide'],
  ['/api/tip-shares/decision/cancel','cancel'],
  ['/api/tip-shares/sync','sync'],
  ['/api/tip-shares/snapshot','snapshot'],
]);

export function createTipShareRoutes({service,body,send,session,origin,isStopped=()=>false}){
  function running(){if(isStopped())throw tipShareError('서버가 잠시 멈추는 중이에요. 조금 뒤 다시 해 주세요.',503,'SYNK_TIP_STOPPING');}
  function adminOf(auth){
    if(!auth?.user)throw tipShareError('먼저 로그인해 주세요.',401,'SYNK_TIP_LOGIN');
    if(auth.user.role!=='admin')throw tipShareError('관리자만 볼 수 있어요.',403,'SYNK_TIP_ADMIN');
    return auth.user;
  }
  return async function tipShareRoutes(req,res,{url,demoRequest=false}){
    const path=url.pathname;
    if(path!=='/api/tip-shares'&&!path.startsWith('/api/tip-shares/'))return false;
    res.setHeader('Cache-Control','no-store');
    running();
    const auth=session(req);adminOf(auth);
    if(demoRequest||req.headers['x-synk-demo']==='1')throw tipShareError('체험 화면에서는 쓸 수 없어요.',403,'SYNK_TIP_DEMO');
    if(url.search)throw tipShareError('공유한 게시물 주소를 확인해 주세요.',400,'SYNK_TIP_INVALID');
    if(path==='/api/tip-shares'){
      if(req.method!=='GET')throw tipShareError('공유한 게시물 요청을 확인해 주세요.',405,'SYNK_TIP_METHOD');
      if(req.headers['transfer-encoding']||Number(req.headers['content-length']||0)>0)throw tipShareError('공유한 게시물 조회 요청을 확인해 주세요.',400,'SYNK_TIP_INVALID');
      send(res,200,service.workspace(auth.user));return true;
    }
    const action=POSTS.get(path);
    if(!action)throw tipShareError('공유한 게시물 주소를 확인해 주세요.',404,'SYNK_TIP_NOT_FOUND');
    if(req.method!=='POST')throw tipShareError('공유한 게시물 요청을 확인해 주세요.',405,'SYNK_TIP_METHOD');
    // 출처와 CSRF는 비어 있지 않은 글자일 때만 맞다고 본다(둘 다 없어서 같아지는 일이 없게).
    const token=auth.body?.csrfToken;
    if(typeof origin!=='string'||!origin||req.headers.origin!==origin||typeof token!=='string'||!token||req.headers['x-csrf-token']!==token)throw tipShareError('회사 프로그램 화면에서 요청해 주세요.',403,'SYNK_TIP_CSRF');
    const small=action==='decide'||action==='cancel'||action==='sync';
    const input=await body(req,small?{maxBytes:4000,maxChars:2000}:{maxBytes:TIP_SHARE_LIMITS.bytes,maxChars:TIP_SHARE_LIMITS.bytes});
    running();
    const latest=session(req);
    if(!latest||latest.hash!==auth.hash||latest.user.id!==auth.user.id)throw tipShareError('로그인 상태를 다시 확인해 주세요.',401,'SYNK_TIP_LOGIN');
    if(typeof latest.body?.csrfToken!=='string'||req.headers['x-csrf-token']!==latest.body.csrfToken)throw tipShareError('회사 프로그램 화면에서 요청해 주세요.',403,'SYNK_TIP_CSRF');
    const user=adminOf(latest);
    send(res,200,service[action](user,input));
    return true;
  };
}
