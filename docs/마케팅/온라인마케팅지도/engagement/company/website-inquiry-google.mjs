import {createHash} from 'node:crypto';

export const WEBSITE_INQUIRY_FORM_ID='1vLTVIJZaFFmRBu3EIj4_bEiV7KTOOAlsDKFw0vUL7Mw';
export const WEBSITE_INQUIRY_SECRET='website-inquiries:google';
export const WEBSITE_INQUIRY_SCOPES=['https://www.googleapis.com/auth/forms.body.readonly','https://www.googleapis.com/auth/forms.responses.readonly'];
const API='https://forms.googleapis.com/v1/forms/';
const fail=(code,message,status=503)=>Object.assign(new Error(message),{code,status});
const fingerprint=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const validId=value=>typeof value==='string'&&/^[\w-]{1,200}$/.test(value);
const ISO=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const publicError=(status)=>status===401||status===403
  ?fail('FORMS_AUTH_REQUIRED','Google 계정에 문의 양식을 읽을 권한이 없어요. 질문 · 응답 읽기 권한으로 다시 연결해 주세요.')
  :status===404?fail('FORMS_NOT_FOUND','정해 둔 문의 양식을 열 수 없어요. 양식을 가진 계정의 권한을 봐 주세요.')
  :fail(status===429?'FORMS_RATE_LIMIT':'FORMS_UNAVAILABLE','Google 문의 양식을 읽지 못했어요. 다음 수집 때 다시 읽어요.');

export function inquiryQuestionMap(form){
  if(form?.formId!==WEBSITE_INQUIRY_FORM_ID)throw fail('FORM_ID_MISMATCH','열린 양식이 홈페이지 문의 양식과 달라요. 「Google 원본 열기」로 양식 주소를 봐 주세요.');
  if(!['VERIFIED','RESPONDER_INPUT'].includes(form?.settings?.emailCollectionType))
    throw fail('FORM_EMAIL_COLLECTION_REQUIRED','문의 양식이 답변받을 이메일을 모으지 않아요. 양식 설정에서 이메일 모으기를 켜 주세요.');
  const titles={type:'문의 유형',message:'문의 내용',consent:'개인정보 수집·이용 동의'},map={};
  for(const [key,title]of Object.entries(titles)){
    const matches=(form.items||[]).filter(item=>item.title===title&&validId(item.questionItem?.question?.questionId));
    if(matches.length!==1)throw fail('FORM_SCHEMA_CHANGED','문의 양식 질문이 바뀌었어요. 문의 유형 · 내용 · 동의 질문이 그대로인지 봐 주세요.');
    map[key]=matches[0].questionItem.question.questionId;
  }
  return map;
}

function answer(response,id){
  const values=response.answers?.[id]?.textAnswers?.answers;
  if(!Array.isArray(values)||values.length!==1||typeof values[0]?.value!=='string')throw fail('FORM_RESPONSE_INVALID','꼭 받아야 할 답이 빠진 응답이 있어요. Google 원본에서 그 응답을 봐 주세요.');
  return values[0].value;
}
export function normalizeGoogleInquiry(response,map){
  if(!validId(response?.responseId)||!ISO(response.createTime)||!ISO(response.lastSubmittedTime||response.createTime))throw fail('FORM_RESPONSE_INVALID','응답 번호나 접수 시각이 빠진 응답이 있어요. Google 원본에서 그 응답을 봐 주세요.');
  return {responseId:response.responseId,createdAt:new Date(response.createTime).toISOString(),submittedAt:new Date(response.lastSubmittedTime||response.createTime).toISOString(),
    email:response.respondentEmail,type:answer(response,map.type),message:answer(response,map.message),consent:answer(response,map.consent)};
}

/** Uses a dedicated encrypted company secret; never returns a token or raw
 * Google error. Only metadata is read by verify(), including a response-ID-only
 * permission probe. A failed permission check is not an empty inbox. */
export function createGoogleFormsInquiryReader({getCredentials,fetchImpl=globalThis.fetch,clock=()=>new Date().toISOString()}={}){
  if(typeof getCredentials!=='function')throw new TypeError('getCredentials is required');
  let cached=null,refreshing=null;
  function credentials(){
    const value=getCredentials();
    if(value&&typeof value.then==='function')throw new TypeError('Credentials resolver must be synchronous');
    if(!value||!['client_id','client_secret','refresh_token'].every(key=>typeof value[key]==='string'&&value[key].length>0))
      throw fail('FORMS_NOT_CONNECTED','홈페이지 문의를 읽을 Google 연결이 아직 없어요. 연결을 마친 뒤 「연결 확인」을 눌러 주세요.');
    return value;
  }
  function assertSame(binding){if(fingerprint(credentials())!==binding)throw fail('FORMS_CONNECTION_CHANGED','문의 계정 연결이 바뀌어 수집을 멈췄어요. 「연결 확인」을 다시 눌러 주세요.',409);}
  async function token(value,binding,signal){
    signal?.throwIfAborted();
    if(cached?.binding===binding&&cached.until>Date.parse(clock())+60000)return cached.token;
    if(refreshing?.binding===binding)return refreshing.promise;
    const promise=(async()=>{
      let response;
      try{response=await fetchImpl('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body:new URLSearchParams({client_id:value.client_id,client_secret:value.client_secret,refresh_token:value.refresh_token,grant_type:'refresh_token'}),
        redirect:'error',signal:AbortSignal.timeout(30000)});}catch{throw fail('FORMS_AUTH_UNAVAILABLE','Google 인증 서버에 연결하지 못했어요. 잠시 뒤 다시 해 주세요.');}
      const data=await response.json().catch(()=>null);
      if(!response.ok||typeof data?.access_token!=='string')throw fail('FORMS_AUTH_REQUIRED','Google 읽기 연결이 풀렸어요. 계정을 다시 연결한 뒤 「연결 확인」을 눌러 주세요.');
      assertSame(binding);
      cached={binding,token:data.access_token,until:Date.parse(clock())+Math.max(60,Math.min(3600,Number(data.expires_in)||3600))*1000};
      return cached.token;
    })();
    refreshing={binding,promise};
    try{return await promise;}finally{if(refreshing?.promise===promise)refreshing=null;}
  }
  async function request(path,params={},signal){
    const value=credentials(),binding=fingerprint(value);
    const url=new URL(API+WEBSITE_INQUIRY_FORM_ID+path);
    for(const [key,v]of Object.entries(params))if(v!==undefined&&v!==null)url.searchParams.set(key,String(v));
    const auth=await token(value,binding,signal);signal?.throwIfAborted();assertSame(binding);
    let response;
    try{response=await fetchImpl(url.href,{headers:{Authorization:'Bearer '+auth},redirect:'error',
      signal:signal?AbortSignal.any([signal,AbortSignal.timeout(30000)]):AbortSignal.timeout(30000)});}
    catch{signal?.throwIfAborted();throw fail('FORMS_UNAVAILABLE','Google 문의 양식에 연결하지 못했어요. 잠시 뒤 다시 해 주세요.');}
    signal?.throwIfAborted();assertSame(binding);
    if(!response.ok){if(response.status===401)cached=null;await response.body?.cancel?.().catch(()=>{});throw publicError(response.status);}
    const raw=await response.text();signal?.throwIfAborted();assertSame(binding);
    if(Buffer.byteLength(raw)>2*1024*1024)throw fail('FORMS_RESPONSE_TOO_LARGE','문의 응답이 너무 커서 수집을 멈췄어요. Google 원본에서 그 응답을 봐 주세요.');
    let data;try{data=JSON.parse(raw);}catch{throw fail('FORMS_INVALID_JSON','Google 문의 응답 형식이 맞지 않아요. 잠시 뒤 다시 모아 주세요.');}
    if(!data||typeof data!=='object'||Array.isArray(data))throw fail('FORMS_INVALID_JSON','Google 문의 응답 형식이 맞지 않아요. 잠시 뒤 다시 모아 주세요.');
    return data;
  }
  async function schema({signal}={}){return inquiryQuestionMap(await request('',{fields:'formId,settings(emailCollectionType),items(title,questionItem(question(questionId)))'},signal));}
  async function verify({signal}={}){
    await schema({signal});
    await request('/responses',{pageSize:1,fields:'responses(responseId),nextPageToken'},signal);
    return {connected:true,formId:WEBSITE_INQUIRY_FORM_ID,verifiedAt:clock()};
  }
  async function readPage({after,pageToken,questionMap,signal}={}){
    if(after!==undefined&&!ISO(after))throw fail('FORMS_CURSOR_INVALID','이어 모을 시각을 읽지 못했어요. 잠시 뒤 다시 모아 주세요.',400);
    if(pageToken!==undefined&&(typeof pageToken!=='string'||pageToken.length>4096))throw fail('FORMS_CURSOR_INVALID','이어 모을 자리를 읽지 못했어요. 잠시 뒤 다시 모아 주세요.',400);
    const map=questionMap||await schema({signal});
    const data=await request('/responses',{pageSize:100,...(after?{filter:'timestamp >= '+new Date(after).toISOString()}:{}),pageToken},signal);
    if(data.responses!==undefined&&!Array.isArray(data.responses)||data.nextPageToken!==undefined&&(typeof data.nextPageToken!=='string'||data.nextPageToken.length>4096))
      throw fail('FORMS_RESPONSE_INVALID','Google에서 받은 문의 목록 형식이 맞지 않아요. 잠시 뒤 다시 모아 주세요.');
    return {items:(data.responses||[]).map(row=>normalizeGoogleInquiry(row,map)),nextPageToken:data.nextPageToken||null,questionMap:map};
  }
  // Before the company copy is erased: does Google still keep this one response? Reads the responseId field
  // only. The form is opened first, so a 404 afterwards means the response itself is gone.
  async function responseState({responseId,signal}={}){
    if(!validId(responseId))throw fail('FORMS_RESPONSE_INVALID','지울 문의의 응답 번호 형식이 맞지 않아요. 문의를 새로 읽은 뒤 다시 해 주세요.',400);
    await schema({signal});
    let data;
    try{data=await request('/responses/'+encodeURIComponent(responseId),{fields:'responseId'},signal);}
    catch(error){if(error.code==='FORMS_NOT_FOUND')return 'deleted';throw error;}
    if(data.responseId!==responseId)throw fail('FORMS_RESPONSE_INVALID','Google에서 받은 응답 번호가 지울 문의와 달라요. 잠시 뒤 다시 해 주세요.');
    return 'present';
  }
  return {verify,readPage,responseState,configured:()=>{try{credentials();return true;}catch{return false;}}};
}
