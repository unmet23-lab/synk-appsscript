import {lookup as dnsLookup} from 'node:dns/promises';
import {request as httpsRequest} from 'node:https';
import {isIP} from 'node:net';

const TIMEOUT=8000,MAX_BYTES=65536,MAX_REDIRECTS=5;
const problem=(code)=>Object.assign(new Error(code),{code});
const socialHosts=['youtube.com','youtu.be','instagram.com','facebook.com','fb.watch','tiktok.com','threads.net','threads.com','x.com','twitter.com','linkedin.com','douyin.com','xiaohongshu.com','vk.com','vk.ru'];
const knownSocial=hostname=>socialHosts.some(host=>hostname===host||hostname.endsWith('.'+host));
const labels={reachable:'HTTP 응답 확인',error:'접속 오류','manual-required':'직접 확인 필요'};
function result(status,reason,detail,httpStatus=null,finalUrl=null){return {status,reason,label:labels[status],detail,httpStatus,finalUrl};}

// Conservatively accept global unicast addresses only. IPv4-mapped/transition
// IPv6 ranges are excluded rather than allowing embedded private addresses.
export function isPublicLinkAddress(address){
  if(typeof address!=='string'||address.includes('%'))return false;
  const family=isIP(address);
  if(family===4){
    const [a,b,c]=address.split('.').map(Number);
    return !(a===0||a===10||a===127||a>=224||a===100&&b>=64&&b<=127||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0&&(c===0||c===2)||b===88&&c===99)||a===198&&(b===18||b===19||b===51&&c===100)||a===203&&b===0&&c===113);
  }
  if(family!==6)return false;
  const normalized=address.toLowerCase(),first=parseInt(normalized.split(':')[0]||'0',16),second=parseInt(normalized.split(':')[1]||'0',16);
  return first>=0x2000&&first<=0x3fff&&first!==0x2002&&!(first===0x2001&&(second<0x0200||second===0x0db8))&&!(first===0x3fff&&second<0x1000);
}
function publicUrl(input){
  if(typeof input!=='string'||input.length>4096||/[\u0000-\u0020\\]/.test(input))throw problem('UNSAFE_URL');
  let url;try{url=new URL(input);}catch{throw problem('UNSAFE_URL');}
  if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443')throw problem('UNSAFE_URL');
  const hostname=url.hostname.replace(/^\[|\]$/g,'').replace(/\.$/,'').toLowerCase();
  if(!hostname||hostname==='localhost'||hostname.endsWith('.localhost')||/(?:^|\.)(?:local|internal|lan|home)$/.test(hostname)||isIP(hostname)&&!isPublicLinkAddress(hostname))throw problem('UNSAFE_ADDRESS');
  url.hash='';return {url,hostname};
}
function abortable(promise,signal){
  if(signal.aborted)return Promise.reject(problem(signal.reason?.code||'CANCELLED'));
  return new Promise((resolve,reject)=>{const cancel=()=>reject(problem(signal.reason?.code||'CANCELLED'));signal.addEventListener('abort',cancel,{once:true});Promise.resolve(promise).then(resolve,reject).finally(()=>signal.removeEventListener('abort',cancel));});
}
function requestOnce(url,address,{method,signal,requestImpl,maxBytes}){
  return new Promise((resolve,reject)=>{
    let settled=false,request,response;
    const finish=(error,value)=>{if(settled)return;settled=true;signal.removeEventListener('abort',cancel);if(error)reject(error);else resolve(value);};
    const cancel=()=>{const error=problem(signal.reason?.code||'CANCELLED');finish(error);response?.destroy();request?.destroy();};
    if(signal.aborted){cancel();return;}signal.addEventListener('abort',cancel,{once:true});
    const hostname=url.hostname.replace(/^\[|\]$/g,'');
    try{
      request=requestImpl({protocol:'https:',hostname,port:443,path:url.pathname+url.search,method,agent:false,servername:isIP(hostname)?undefined:hostname,rejectUnauthorized:true,family:address.family,
        lookup(_host,options,callback){if(typeof options==='function'){callback=options;options={};}if(options?.all)callback(null,[address]);else callback(null,address.address,address.family);},
        headers:{'User-Agent':'SYNK-Link-Check/1.0','Accept':'text/html,application/octet-stream;q=0.5,*/*;q=0.1','Accept-Encoding':'identity'}},res=>{
        response=res;const status=Number(res.statusCode),headers=res.headers||{};
        if(method==='HEAD'||[301,302,303,307,308].includes(status)){finish(null,{status,headers,body:''});res.destroy();return;}
        if(Number(headers['content-length'])>maxBytes){finish(problem('RESPONSE_TOO_LARGE'));res.destroy();return;}
        let length=0;const chunks=[];
        res.on('data',chunk=>{if(settled)return;const bytes=Buffer.from(chunk);length+=bytes.length;if(length>maxBytes){finish(problem('RESPONSE_TOO_LARGE'));res.destroy();return;}chunks.push(bytes);});
        res.on('end',()=>finish(null,{status,headers,body:Buffer.concat(chunks).toString('utf8')}));res.on('error',error=>finish(error));res.on('aborted',()=>finish(problem('RESPONSE_ABORTED')));
      });request.on('error',error=>finish(error));request.end();
    }catch(error){finish(error);}
  });
}

export async function checkPublicLink(input,{signal,lookupImpl=dnsLookup,requestImpl=httpsRequest,timeoutMs=TIMEOUT,maxBytes=MAX_BYTES,maxRedirects=MAX_REDIRECTS}={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(problem('TIMEOUT')),Math.max(1,Math.min(TIMEOUT,timeoutMs))),cancel=()=>controller.abort(problem('CANCELLED'));
  signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();
  let finalUrl=null,httpStatus=null;
  try{
    let target=input,redirects=0,method='HEAD';const visited=new Set();
    while(true){
      if(controller.signal.aborted)throw problem(controller.signal.reason?.code||'CANCELLED');
      const {url,hostname}=publicUrl(target);finalUrl=url.href;
      const key=method+' '+url.href;if(visited.has(key))return result('manual-required','redirect-loop','주소 이동이 반복되어 직접 확인이 필요합니다.',httpStatus,finalUrl);visited.add(key);
      let addresses;
      try{addresses=isIP(hostname)?[{address:hostname,family:isIP(hostname)}]:await abortable(lookupImpl(hostname,{all:true,verbatim:true}),controller.signal);}catch(error){if(controller.signal.aborted)throw problem(controller.signal.reason?.code||'CANCELLED');throw problem('DNS_FAILURE');}
      if(!Array.isArray(addresses)||!addresses.length)throw problem('DNS_FAILURE');
      if(addresses.some(item=>!isPublicLinkAddress(item.address)||isIP(item.address)!==Number(item.family)))throw problem('UNSAFE_ADDRESS');
      const response=await requestOnce(url,addresses[0],{method,signal:controller.signal,requestImpl,maxBytes:Math.max(1,Math.min(MAX_BYTES,maxBytes))});httpStatus=response.status;
      if([301,302,303,307,308].includes(httpStatus)){
        if(redirects++>=Math.min(MAX_REDIRECTS,maxRedirects))return result('manual-required','redirect-limit','주소 이동 횟수가 많아 직접 확인이 필요합니다.',httpStatus,finalUrl);
        const location=response.headers.location;if(typeof location!=='string'||!location)return result('manual-required','redirect-location','이동할 주소를 확인하지 못했습니다.',httpStatus,finalUrl);
        try{target=new URL(location,url).href;}catch{throw problem('UNSAFE_URL');}continue;
      }
      if(method==='HEAD'&&[403,404,405,410,501].includes(httpStatus)){method='GET';continue;}
      if([404,410].includes(httpStatus))return result('error','not-found','서버가 해당 주소의 자료를 찾을 수 없다고 응답했습니다.',httpStatus,finalUrl);
      if([401,403,429].includes(httpStatus))return result('manual-required','access-limited','로그인·접근 제한 또는 요청 제한 응답입니다. 실제 사용자 화면에서 확인해 주세요.',httpStatus,finalUrl);
      if(httpStatus>=500&&httpStatus!==501)return result('error','server-error','상대 서버가 오류 응답을 보냈습니다. 잠시 뒤 다시 확인해 주세요.',httpStatus,finalUrl);
      if(method==='HEAD'&&httpStatus>=200&&httpStatus<300&&!knownSocial(hostname)&&/\b(?:text\/html|application\/xhtml\+xml)\b/i.test(response.headers['content-type']||'')){method='GET';continue;}
      if(httpStatus<200||httpStatus>=300)return result('manual-required','unexpected-response','자동 확인으로 판단하기 어려운 응답입니다. 주소를 직접 열어 확인해 주세요.',httpStatus,finalUrl);
      if(knownSocial(hostname))return result('manual-required','social-page','플랫폼의 HTTP 응답만 확인했습니다. 실제 게시물 공개 여부와 재생은 로그인 상태에서 직접 확인해 주세요.',httpStatus,finalUrl);
      if(/(?:^|[\/_.-])(?:login|signin|sign-in|auth|oauth|captcha)(?:[\/_.-]|$)/i.test(url.pathname))return result('manual-required','login-page','로그인·인증 화면일 수 있어 실제 사용자 화면에서 자료 접근을 확인해 주세요.',httpStatus,finalUrl);
      if(response.headers['content-encoding']&&!/^identity$/i.test(response.headers['content-encoding']))return result('manual-required','encoded-response','압축 응답 내용은 자동 판독하지 않았습니다. 실제 접근 화면을 확인해 주세요.',httpStatus,finalUrl);
      if(/captcha|cf-chl-|challenge-platform|verify (?:you are|that you are) human|checking your browser|type\s*=\s*["']?password|sign in to continue|로그인(?:이|을)?\s*(?:필요|해)/i.test(response.body))return result('manual-required','access-challenge','로그인 또는 자동 접근 확인 화면이 감지됐습니다. 실제 사용자 화면에서 확인해 주세요.',httpStatus,finalUrl);
      return result('reachable','http-response','이 시각에 HTTP 응답을 받았습니다. 실제 게시·재생·다운로드 완료를 확인한 결과는 아닙니다.',httpStatus,finalUrl);
    }
  }catch(error){
    const code=controller.signal.aborted?controller.signal.reason?.code:error.code;
    if(code==='CANCELLED')throw problem('CANCELLED');
    if(['UNSAFE_URL','UNSAFE_ADDRESS'].includes(code))return result('manual-required','unsafe-target','공개 HTTPS 주소로 안전하게 확인할 수 없는 대상입니다.',httpStatus,null);
    if(code==='RESPONSE_TOO_LARGE')return result('manual-required','response-limit','응답이 자동 확인 범위를 넘었습니다. 자료를 직접 열어 확인해 주세요.',httpStatus,finalUrl);
    if(code==='TIMEOUT')return result('error','timeout','제한 시간 안에 응답을 받지 못했습니다.',httpStatus,finalUrl);
    if(code==='DNS_FAILURE')return result('error','dns-error','주소의 서버 위치를 확인하지 못했습니다.',httpStatus,finalUrl);
    return result('error','connection-error','HTTPS 연결을 완료하지 못했습니다. 상대 서버 상태를 확인해 주세요.',httpStatus,finalUrl);
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
}
