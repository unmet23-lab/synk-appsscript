const fail=(message,status=400)=>Object.assign(new Error(message),{status});

export function createSocialPublicRoutes({review,tracking,body,send,origin,signal,clientAddress,isStopped=()=>false,onReviewChange=()=>{}}){
  function assertRunning(){if(isStopped()||signal?.aborted)throw fail('서비스가 종료 중입니다. 잠시 후 다시 시도해 주세요.',503);}
  return async function handle(req,res,{url}){
    const path=url.pathname,isReview=path.startsWith('/api/social-review/'),isTracking=path.startsWith('/social-track/'),short=path.match(/^\/s\/([A-Za-z0-9_-]{20,100})$/);
    if(!isReview&&!isTracking&&!short)return false;
    assertRunning();
    if(url.search||req.headers['x-synk-demo']==='1')throw fail('실제 기능 주소를 확인해 주세요.');
    const clientKey=clientAddress(req);
    if(short){if(!['GET','HEAD'].includes(req.method))throw fail('추적 링크 요청 방식을 확인해 주세요.',405);const result=tracking.click(short[1],{client:clientKey,method:req.method});res.writeHead(302,{'Location':result.location,'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});res.end();return true;}
    if(isReview){
      if(req.method!=='POST')throw fail('고객 검토는 검토 화면에서 요청해 주세요.',405);
      if(req.headers.origin!==origin)throw fail('고객 검토 화면에서 요청해 주세요.',403);
      const action=path.slice('/api/social-review/'.length);if(!['open','respond','media'].includes(action))throw fail('고객 검토 주소를 찾을 수 없습니다.',404);
      const bearer=/^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.authorization||'');if(!bearer)throw fail('검토 링크를 다시 열어 주세요.',401);
      const input=await body(req,{maxBytes:16000,maxChars:10000}),context={origin:req.headers.origin,clientKey,signal};
      assertRunning();
      const result=action==='open'?await review.open(bearer[1],context):await review[action](bearer[1],input,context);
      assertRunning();
      if(action==='media'){res.writeHead(200,{'Content-Type':result.mimeType,'Content-Length':result.bytes.length,'Content-Disposition':"inline; filename*=UTF-8''"+encodeURIComponent(result.fileName||'review-media'),'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});res.end(result.bytes);}
      else{if(action==='respond')onReviewChange();send(res,200,result);}return true;
    }
    if(!['/social-track/event','/social-track/verified'].includes(path))throw fail('전환 기록 주소를 찾을 수 없습니다.',404);
    const browser=path.endsWith('/event'),requestOrigin=req.headers.origin;
    if(browser){if(!tracking.allowOrigin(requestOrigin))throw fail('허용된 도착 사이트에서만 기록할 수 있습니다.',403);res.setHeader('Access-Control-Allow-Origin',requestOrigin);res.setHeader('Vary','Origin');if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Methods':'POST','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600','Cache-Control':'no-store'});res.end();return true;}}
    if(req.method!=='POST')throw fail('전환 기록 요청 방식을 확인해 주세요.',405);
    const input=await body(req,{maxBytes:4096,maxChars:2000});
    assertRunning();
    const result=tracking.event(input,browser?{origin:requestOrigin,client:clientKey}:{verified:true,timestamp:req.headers['x-synk-timestamp'],signature:req.headers['x-synk-signature'],client:clientKey});send(res,200,result);return true;
  };
}
