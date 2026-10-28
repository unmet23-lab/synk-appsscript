import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createFeedbackClient} from '../src/feedback-client.mjs';
import {STUDY_SESSION} from '../../synk-account/src/study-login.mjs';
import {ACCOUNT,ANSWER,memoryStore,configFor,feedbackFixture} from './semantic-fixture.mjs';

const NOW=1793113200000,BASE='https://test.synk.invalid',OTHER='22222222-2222-4222-8222-222222222222';
const turn=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const snapshot=()=>({v:2,seq:0,obs:[],trail:[],seen:{},recentCards:[]});
const account=(extra={})=>({ok:true,account:{synk_user_id:ACCOUNT,status:'active'},learning:{enabled:true,revision:3},...extra});
const saved=(extra={})=>({ok:true,accountId:ACCOUNT,revision:3,version:0,study:null,...extra});
const request={itemId:'w53-resale',bankHash:'hash',answer:ANSWER,lang:'ko',consent:'send-once'};
function harness({stored=true,enabled=true,aiStatus=200,route}={}){
 const storage=memoryStore(),calls=[];
 if(stored)storage.setItem(STUDY_SESSION,JSON.stringify({access_token:'fixture',refresh_token:'refresh',expires_at:NOW+3600000}));
 const fetcher=async(url,options={})=>{
  const u=new URL(url),body=options.body&&options.headers?.['Content-Type']==='application/json'?JSON.parse(options.body):options.body;
  const call={url:u,options,body};calls.push(call);const custom=route?.(call);if(custom!==undefined)return custom;
  if(u.pathname==='/account/config.json')return Response.json(configFor(BASE));
  if(u.pathname==='/functions/v1/synk-account')return Response.json(account({learning:{enabled,revision:3}}));
  if(u.pathname==='/functions/v1/synk-learning')return Response.json(saved(options.method==='POST'?{version:body.baseVersion+1,study:body.study}:{}));
  if(u.pathname==='/functions/v1/world-writing')return body.action==='status'?
   Response.json(aiStatus===200?{ok:true,accountId:ACCOUNT,enabled:true,studyVersion:1,bankHash:'hash'}:{ok:false,code:'FEATURE_DISABLED'},{status:aiStatus}):
   Response.json({ok:true,accountId:ACCOUNT,status:'ok',feedback:feedbackFixture()});
  throw Error('Unexpected test endpoint: '+u.pathname);
 };
 return {storage,calls,client:createFeedbackClient({storage,fetcher,base:BASE,now:()=>NOW,cryptoAPI:webcrypto})};
}

test('진도 신원은 AI 지원과 독립이고 고정된 제품 API와 revision만 보낸다',async()=>{
 const h=harness({aiStatus:403});assert.equal(await h.client.init(),null);
 assert.deepEqual(await h.client.learningSession(),{accountId:ACCOUNT,enabled:true,revision:3});
 assert.equal(h.client.owner(),'user-'+ACCOUNT);assert.equal(h.client.status().enabled,undefined);
 assert.equal((await h.client.studyProgress({revision:3})).study,null);
 const study=snapshot();assert.equal((await h.client.studyProgress({method:'POST',revision:3,baseVersion:0,study})).version,1);
 const progress=h.calls.filter(c=>c.url.pathname==='/functions/v1/synk-learning');
 assert.equal(progress[0].url.search,'?view=study&revision=3');assert.equal(progress[0].options.method,'GET');assert.equal(progress[0].options.body,undefined);
 assert.equal(progress[1].url.search,'?view=study');assert.deepEqual(progress[1].body,{revision:3,baseVersion:0,study});
 for(const c of progress){assert.equal(c.options.headers.authorization,'Bearer fixture');assert.equal(c.options.headers['X-SYNK-Product'],'world');assert.equal(c.options.credentials,'omit');assert.equal(c.options.redirect,'error');}
 const disabled=harness({enabled:false});assert.deepEqual(await disabled.client.learningSession(),{accountId:ACCOUNT,enabled:false,revision:3});
 const guest=harness({stored:false});assert.equal(await guest.client.learningSession(),null);assert.equal(guest.calls.length,0);
});

test('학습 비동의·기능 차단·진도 충돌은 원래 오류를 보존하고 AI 로그인은 지우지 않는다',async()=>{
 for(const [status,code]of [[403,'LEARNING_DISABLED'],[403,'FEATURE_DISABLED'],[409,'REVISION_CONFLICT'],[409,'STUDY_PROGRESS_CONFLICT']]){
  const h=harness({route:c=>c.url.pathname==='/functions/v1/synk-learning'?Response.json({ok:false,error:{code},revision:4},{status}):undefined});
  await h.client.init();await h.client.learningSession();
  await assert.rejects(h.client.studyProgress({revision:3}),e=>e.code===code&&e.status===status&&e.revision===4);
  assert.equal(h.client.owner(),'user-'+ACCOUNT);assert.ok(h.storage.getItem(STUDY_SESSION));assert.equal((await h.client.request(request)).status,'ok');
 }
});

test('401 및 세션 폐기는 두 요청 계열을 닫으며 잘못된 401 본문도 로그인 상태를 남기지 않는다',async()=>{
 for(const response of [()=>Response.json({ok:false,error:{code:'AUTH_SESSION_MISSING'}},{status:401}),()=>Response.json({ok:false,error:{code:'SESSION_REVOKED'}},{status:403}),()=>new Response('not json',{status:401})]){
  const h=harness({route:c=>c.url.pathname==='/functions/v1/synk-learning'?response():undefined});await h.client.learningSession();
  await assert.rejects(h.client.studyProgress({revision:3}),e=>['AUTH_SESSION_MISSING','SESSION_REVOKED','AUTH_REQUIRED'].includes(e.code));
  assert.equal(h.client.owner(),null);assert.equal(h.storage.getItem(STUDY_SESSION),null);
 }
});

test('AI 취소는 진행 중인 진도 읽기를 취소하지 않는다',async()=>{
 const ai=deferred(),progress=deferred();const h=harness({route:c=>c.url.pathname==='/functions/v1/synk-learning'?progress.promise:c.body?.action==='feedback'?ai.promise:undefined});
 await h.client.init();await h.client.learningSession();
 const reading=h.client.studyProgress({revision:3}),writing=h.client.request(request);await turn();h.client.cancel();
 const progressCall=h.calls.find(c=>c.url.pathname==='/functions/v1/synk-learning'),aiCall=h.calls.find(c=>c.body?.action==='feedback');
 assert.equal(progressCall.options.signal.aborted,false);assert.equal(aiCall.options.signal.aborted,true);
 progress.resolve(Response.json(saved()));assert.equal((await reading).version,0);
 ai.resolve(Response.json({ok:true,accountId:ACCOUNT,status:'ok'}));await assert.rejects(writing,{code:'CANCELLED'});assert.equal(h.client.owner(),'user-'+ACCOUNT);
});

test('AI와 진도는 갱신 하나를 공유하고 AI 취소가 갱신을 통해 진도로 전파되지 않는다',async()=>{
 const refresh=deferred();const h=harness({route:c=>c.url.pathname==='/auth/v1/oauth/token'?refresh.promise:undefined});
 await h.client.init();await h.client.learningSession();h.storage.setItem(STUDY_SESSION,JSON.stringify({access_token:'fixture',refresh_token:'refresh',expires_at:1}));
 const writing=h.client.request(request),reading=h.client.studyProgress({revision:3});await turn();h.client.cancel();
 assert.equal(h.calls.filter(c=>c.url.pathname==='/auth/v1/oauth/token').length,1);
 refresh.resolve(Response.json({access_token:'renewed',refresh_token:'renewed-refresh',expires_in:3600}));
 await assert.rejects(writing,{code:'CANCELLED'});assert.equal((await reading).version,0);
 assert.equal(h.calls.find(c=>c.url.pathname==='/functions/v1/synk-learning').options.headers.authorization,'Bearer renewed');
 assert.equal(JSON.parse(h.storage.getItem(STUDY_SESSION)).access_token,'renewed');assert.equal(h.client.owner(),'user-'+ACCOUNT);
});

test('config·계정·진도 응답의 fetch와 JSON 대기 중 토큰 교체를 모두 차단한다',async t=>{
 for(const stage of ['config-fetch','config-json','account-fetch','account-json','study-fetch','study-json'])await t.test(stage,async()=>{
  const wait=deferred();const isStudy=stage.startsWith('study'),endpoint=stage.startsWith('config')?'/account/config.json':stage.startsWith('account')?'/functions/v1/synk-account':'/functions/v1/synk-learning';
  const h=harness({route:c=>c.url.pathname===endpoint?(stage.endsWith('fetch')?wait.promise:{ok:true,status:200,json:()=>wait.promise}):undefined});
  if(isStudy)await h.client.learningSession();
  const p=isStudy?h.client.studyProgress({revision:3}):h.client.learningSession();await turn();
  h.storage.setItem(STUDY_SESSION,JSON.stringify({access_token:'other',expires_at:NOW+3600000}));
  const body=stage.startsWith('config')?configFor(BASE):isStudy?saved():account();wait.resolve(stage.endsWith('fetch')?Response.json(body):body);
  await assert.rejects(p,{code:'ACCOUNT_CHANGED'});assert.equal(h.client.owner(),null);assert.equal(JSON.parse(h.storage.getItem(STUDY_SESSION)).access_token,'other');
  if(stage.startsWith('config'))assert.equal(h.calls.filter(c=>c.url.pathname.startsWith('/functions/')).length,0);
 });
});

test('연결 폐기 뒤 늦은 토큰 갱신 및 다른 UUID의 진도 응답은 적용하지 않는다',async()=>{
 const refresh=deferred(),h=harness({route:c=>c.url.pathname==='/auth/v1/oauth/token'?refresh.promise:undefined});
 await h.client.learningSession();h.storage.setItem(STUDY_SESSION,JSON.stringify({access_token:'fixture',refresh_token:'refresh',expires_at:1}));
 const p=h.client.studyProgress({revision:3});await turn();h.client.disconnect();refresh.resolve(Response.json({access_token:'late',expires_in:3600}));
 await assert.rejects(p,{code:'ACCOUNT_CHANGED'});assert.equal(h.storage.getItem(STUDY_SESSION),null);
 const j=harness({route:c=>c.url.pathname==='/functions/v1/synk-learning'?Response.json(saved({accountId:OTHER})):undefined});await j.client.learningSession();
 await assert.rejects(j.client.studyProgress({revision:3}),{code:'ACCOUNT_CHANGED'});assert.equal(j.client.owner(),null);
});

test('잘못된 UUID·revision·진도 응답과 작성 중 원문을 붙인 요청은 받지 않는다',async()=>{
 const bad=harness({route:c=>c.url.pathname==='/functions/v1/synk-account'?Response.json(account({account:{synk_user_id:'not-a-uuid'}})):undefined});
 await assert.rejects(bad.client.learningSession(),{code:'INVALID_RESPONSE'});assert.equal(bad.client.owner(),null);
 const h=harness();await assert.rejects(h.client.studyProgress({revision:3}),{code:'AUTH_REQUIRED'});await h.client.learningSession();const before=h.calls.length;
 for(const args of [{method:'DELETE',revision:3},{revision:0},{method:'POST',revision:3,baseVersion:0,study:{...snapshot(),drafts:{answer:'private'}}}])await assert.rejects(h.client.studyProgress(args),{code:'INVALID_REQUEST'});
 assert.equal(h.calls.length,before);
 for(const change of [{revision:4},{version:-1},{study:{v:1}},{accountId:'bad'}]){
  const j=harness({route:c=>c.url.pathname==='/functions/v1/synk-learning'?Response.json(saved(change)):undefined});await j.client.learningSession();await assert.rejects(j.client.studyProgress({revision:3}),{code:'INVALID_RESPONSE'});
 }
});
