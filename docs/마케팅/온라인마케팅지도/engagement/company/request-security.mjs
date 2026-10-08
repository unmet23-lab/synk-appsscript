import { isIP } from 'node:net';

const rateError=()=>Object.assign(new Error('로그인 요청이 많습니다. 잠시 후 다시 시도해 주세요.'),{status:429,code:'SYNK_RATE_LIMITED'});
function canonicalIp(value){
  if(typeof value!=='string'||value.length>64||value.includes('%')||!isIP(value))return null;
  if(isIP(value)===4)return value;
  const normalized=new URL(`http://[${value}]/`).hostname.slice(1,-1);
  const mapped=/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(normalized);
  if(mapped){const high=parseInt(mapped[1],16),low=parseInt(mapped[2],16);return [high>>8,high&255,low>>8,low&255].join('.');}
  return normalized;
}

// Only exact, explicitly configured peers can assert a client address. Neither
// a general "trust proxy" switch nor an untrusted forwarded prefix is accepted.
export function createClientAddress(setting=process.env.SYNK_COMPANY_TRUSTED_PROXY_IPS??''){
  if(typeof setting!=='string')throw new Error('SYNK_COMPANY_TRUSTED_PROXY_IPS에는 정확한 프록시 IP만 설정해 주세요.');
  const entries=setting?setting.split(',').map(value=>canonicalIp(value.trim())):[];
  if(entries.length>8||entries.some(value=>!value))throw new Error('SYNK_COMPANY_TRUSTED_PROXY_IPS에는 정확한 프록시 IP만 설정해 주세요.');
  const trusted=new Set(entries);
  return req=>{
    const peer=canonicalIp(req.socket?.remoteAddress)||'unknown';
    if(!trusted.has(peer))return peer;
    const forwarded=req.headers?.['x-forwarded-for'];
    if(typeof forwarded!=='string'||forwarded.length>512)return peer;
    if(Array.isArray(req.rawHeaders)&&req.rawHeaders.filter((value,index)=>index%2===0&&String(value).toLowerCase()==='x-forwarded-for').length>1)return peer;
    const chain=forwarded.split(',').map(value=>canonicalIp(value.trim()));
    return chain.length<=8&&chain.every(Boolean)?chain.at(-1):peer;
  };
}

// Reserving before an await also counts in-flight attempts. A successful check
// may release its reservation; failures remain until their fixed window expires.
export function createAttemptLimiter({limit,windowMs,maxEntries=1000,now=()=>Date.now()}){
  if(!Number.isSafeInteger(limit)||limit<1||!Number.isSafeInteger(maxEntries)||maxEntries<1||!Number.isFinite(windowMs)||windowMs<=0)throw new Error('Invalid limiter configuration');
  const entries=new Map();
  function prune(stamp){for(const [key,row]of entries)if(row.expiresAt<=stamp)entries.delete(key);}
  return {
    reserve(key){
      const stamp=now();prune(stamp);
      let row=entries.get(key);
      if(!row){if(entries.size>=maxEntries)throw rateError();row={count:0,expiresAt:stamp+windowMs};entries.set(key,row);}
      if(row.count>=limit)throw rateError();row.count++;
      let released=false;
      return ()=>{if(released)return;released=true;if(entries.get(key)===row&&--row.count===0)entries.delete(key);};
    },
    get size(){prune(now());return entries.size;},
  };
}

export function reserveAttempts(pairs){
  const releases=[];
  try{for(const [limiter,key]of pairs)releases.push(limiter.reserve(key));}
  catch(error){for(const release of releases)release();throw error;}
  return ()=>{for(const release of releases)release();};
}

// Reject excess work instead of growing a promise or libuv work queue.
export function createConcurrencyGuard(limit=4){
  if(!Number.isSafeInteger(limit)||limit<1)throw new Error('Invalid concurrency limit');
  let active=0;
  return async work=>{
    if(active>=limit)throw Object.assign(new Error('로그인 요청을 처리 중입니다. 잠시 후 다시 시도해 주세요.'),{status:429,code:'SYNK_AUTH_BUSY'});
    active++;
    try{return await work();}finally{active--;}
  };
}

export function publicRequestError(error,{production=false}={}){
  const explicit=Number.isInteger(error?.status)&&error.status>=400&&error.status<=599;
  const status=explicit?error.status:500;
  if(status>=500){
    const label=['SQLITE_FULL','SQLITE_BUSY','SQLITE_CORRUPT','ENOSPC','EACCES'].includes(error?.code)?error.code:'INTERNAL_ERROR';
    console.error('SYNK_COMPANY_SERVER REQUEST_FAILED '+label);
  }
  return {status,message:status>=500&&(production||!explicit)?'처리하지 못했습니다. 관리자에게 문의해 주세요.':String(error?.message||'처리하지 못했습니다.')};
}
