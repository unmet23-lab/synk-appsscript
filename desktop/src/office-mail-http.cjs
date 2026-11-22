'use strict';
const fail = code => Object.assign(new Error(code), {code});
const providers = Object.freeze(['gmail','outlook']);
const grantText = value => typeof value==='string' && value.length>0 && value.length<=16384 && !/[\s\x00-\x1f\x7f]/.test(value);
const addressValid = value => typeof value==='string' && /^[^\s@/?#\\<>]{1,128}@[^\s@/?#\\<>]{1,180}$/.test(value);
function current(signal) { if (signal?.aborted) throw fail('CANCELLED'); }
async function jsonRequest(fetch,url,options={},signal) {
  current(signal);
  const timeout=AbortSignal.timeout(20000);
  const cancel=signal?AbortSignal.any([signal,timeout]):timeout;
  try {
    const response=await fetch(url,{...options,redirect:'error',signal:cancel});
    let size=0;const chunks=[];
    for await(const chunk of response.body||[]) {
      size+=chunk.length;
      if(size>2*1024*1024)throw fail('MAIL_NETWORK');
      chunks.push(chunk);
    }
    let body;
    try { body=JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { body=null; }
    if (!response.ok) {
      const remote=body?.error?.code??body?.error;
      if (response.status===429 || /^(?:rateLimitExceeded|userRateLimitExceeded|ErrorQuotaExceeded)$/i.test(body?.error?.errors?.[0]?.reason||remote)) throw fail('MAIL_LIMIT');
      if (remote==='invalid_client' || remote==='unauthorized_client' || remote==='invalid_scope' || remote==='redirect_uri_mismatch' || body?.error?.errors?.[0]?.reason==='accessNotConfigured') throw fail('MAIL_CONFIG');
      if (remote==='invalid_grant'||remote==='interaction_required'||remote==='consent_required'||response.status===401)throw fail('MAIL_RECONNECT');
      if(response.status===403)throw fail('MAIL_SCOPE');
      if(response.status===404)throw fail('MAIL_NOT_FOUND');
      throw fail('MAIL_NETWORK');
    }
    if(!body || typeof body!=='object')throw fail('MAIL_NETWORK');
    return body;
  } catch(error) {
    current(signal);
    throw typeof error.code==='string' && error.code.startsWith('MAIL_') ? error : fail('MAIL_NETWORK');
  }
}
const bearer=access=>({Authorization:'Bearer '+access,Accept:'application/json'});
module.exports={fail,providers,grantText,addressValid,current,jsonRequest,bearer};
