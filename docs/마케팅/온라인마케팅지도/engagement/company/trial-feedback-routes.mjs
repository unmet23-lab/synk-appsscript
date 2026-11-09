import {trialFeedbackError} from './trial-feedback.mjs';

const PUBLIC=new Map([
  ['/trial-feedback/enroll','enroll'],
  ['/trial-feedback/event','event'],
  ['/trial-feedback/withdraw','withdraw'],
]);
export function createTrialFeedbackRoutes({service,body,send,session,clientAddress,isStopped=()=>false}){
  function running(){if(isStopped())throw trialFeedbackError('stopped',503);}
  function headers(res){res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');}
  function failure(res,error){
    const status=Number.isInteger(error.status)&&error.status>=400&&error.status<600?error.status:500;
    const code=error.trialCode||(status===413?'too_large':status===400?'invalid':'unavailable');
    if(status===429)res.setHeader('Retry-After',String(error.retryAfterSeconds||60));
    send(res,status,{ok:false,error:code,...(error.field?{field:error.field}:{}),...(status===429?{retryAfterSeconds:error.retryAfterSeconds||60}:{})});
  }
  async function publicRoutes(req,res,{url}){
    const action=PUBLIC.get(url.pathname);if(!action)return false;
    headers(res);
    try{
      running();
      if(!service.allowOrigin(req.headers.origin))throw trialFeedbackError('origin',403);
      res.setHeader('Access-Control-Allow-Origin',req.headers.origin);res.setHeader('Vary','Origin');
      if(url.search||req.headers['x-synk-demo']==='1')throw trialFeedbackError('invalid',400,'url');
      if(req.method==='OPTIONS'){
        res.writeHead(204,{'Access-Control-Allow-Methods':'POST','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600'});res.end();return true;
      }
      if(req.method!=='POST')throw trialFeedbackError('method',405);
      if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))throw trialFeedbackError('content_type',415);
      // The shared body reader recognizes lowercase media types.
      req.headers['content-type']=req.headers['content-type'].toLowerCase();
      const input=await body(req,{maxBytes:4096,maxChars:4096});running();
      const result=service[action](input,{origin:req.headers.origin,client:clientAddress(req)});
      send(res,action!=='withdraw'&&!result.duplicate?201:200,result);
    }catch(error){failure(res,error);}
    return true;
  }
  async function staffRoutes(req,res,{url,demoRequest=false}){
    if(!url.pathname.startsWith('/api/trial-feedback/'))return false;
    headers(res);
    try{
      running();
      const auth=session(req);if(!auth)throw trialFeedbackError('unauthorized',401);
      if(demoRequest||req.headers['x-synk-demo']==='1')throw trialFeedbackError('forbidden',403);
      if(url.pathname!=='/api/trial-feedback/summary')throw trialFeedbackError('not_found',404);
      if(req.method!=='GET')throw trialFeedbackError('method',405);
      if(req.headers['transfer-encoding']||Number(req.headers['content-length']||0)>0)throw trialFeedbackError('invalid',400,'body');
      const keys=[...url.searchParams.keys()];
      if(new Set(keys).size!==keys.length||keys.some(key=>!['cohort','days','data'].includes(key)))throw trialFeedbackError('invalid',400,'query');
      // server.mjs revalidates the identity before entering this authenticated handler.
      send(res,200,service.summary(auth.user,Object.fromEntries(url.searchParams)));
    }catch(error){failure(res,error);}
    return true;
  }
  return {publicRoutes,staffRoutes};
}
