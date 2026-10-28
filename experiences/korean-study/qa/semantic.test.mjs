import test from 'node:test';import assert from 'node:assert/strict';import {webcrypto} from 'node:crypto';
import {readSemantic,recordSemantic,semanticNext,semanticHistory} from '../src/semantic.mjs';
import {readState,trailRows,addObs} from '../src/tutor.mjs';
import {createFeedbackClient} from '../src/feedback-client.mjs';
import {progressSnapshot} from '../src/progress-sync.mjs';
import {rememberStudyLogin,studyCallbackIntent,finishStudyLogin,STUDY_INTENT,STUDY_SESSION} from '../../synk-account/src/study-login.mjs';
import {ANSWER,ACCOUNT,feedbackFixture,memoryStore,configFor} from './semantic-fixture.mjs';
const NOW=1793113200000,BASE='https://test.synk.invalid',PENDING='synk.oauth.pending.world';
test('의미 응답은 실제 글의 인용만 받고 AI 선택지는 독립 성공으로 기록하지 않는다',()=>{
 const f=readSemantic(feedbackFixture(),ANSWER);let state=recordSemantic(readState(null),{feedback:f,itemId:'w53-resale'},{now:NOW});
 assert.equal(trailRows(state,NOW).size,0);
 state=recordSemantic(state,{feedback:f,itemId:'w53-resale',stage:'check',pick:'b'},{now:NOW+1});
 assert.equal(state.obs.at(-1).result,'selected-right');assert.ok([...trailRows(state,NOW+1).values()].every(row=>!row.independent));
 assert.throws(()=>readSemantic({...f,focus:{...f.focus,quote:'학생이 쓰지 않은 글'}},ANSWER));
 assert.throws(()=>readSemantic({...f,focus:{...f.focus,certainty:'proven'}},ANSWER));
});
test('원인별 도움 뒤 자기 글, 다음 새 과제, 한 자리 한도를 잇는다',()=>{
 const bank={open53:[{id:'a'},{id:'b'}],open54:[{id:'c'}]};let state={...readState(null),seen:{a:1}};
 for(const skill of ['data.accuracy','task.coverage','language.expression'])assert.deepEqual(semanticNext(state,bank,{itemId:'a',revise:true,focusSkill:skill,now:NOW}),{id:'write',itemId:'a',mode:'revise',support:1,phase:'edit',why:'semantic',semantic:true,focusSkill:skill,focusTarget:'other'});
 assert.equal(semanticNext(state,bank,{itemId:'a',now:NOW}).itemId,'b');
 for(let i=0;i<3;i++)state=addObs(state,{kind:'write',itemId:'a',mode:'revise',support:1,plain:0,off:0,total:3,formal:0,polite:0,verdict:'unassessed',linked:true},{now:NOW+i});
 assert.equal(semanticNext(state,bank,{itemId:'a',revise:true,now:NOW+4}).id,'rest');
});
test('공부 로그인은 같은 탭 PKCE에 묶이고 WORLD 세션을 덮지 않는다',()=>{
 const s=memoryStore(),p={state:'a'.repeat(43),createdAt:NOW,clientId:'world-fixture',redirectUri:BASE+'/account/client.html?product=world'};s.setItem(PENDING,JSON.stringify(p));
 const intent=rememberStudyLogin(s,{now:NOW}),url=p.redirectUri+'&state='+p.state+'&code=fixture';s.setItem('synk.oauth.session.world','original');
 assert.equal(studyCallbackIntent({storage:s,url,product:'portal',now:NOW}),null);
 for(const [u,n] of [[url,NOW+600001],[url,NOW-1],[url.replace(p.state,'bad'),NOW],[p.redirectUri,NOW]]){s.setItem(STUDY_INTENT,JSON.stringify(intent));assert.equal(studyCallbackIntent({storage:s,url:u,product:'world',now:n}),null);assert.equal(s.getItem(STUDY_INTENT),null);}
 s.setItem(STUDY_INTENT,JSON.stringify(intent));
 assert.deepEqual(studyCallbackIntent({storage:s,url,product:'world',now:NOW}),intent);
 assert.equal(finishStudyLogin(s,{access_token:'fixture'},intent),'/study/');assert.equal(s.getItem('synk.oauth.session.world'),'original');assert.equal(s.getItem(STUDY_INTENT),null);
 assert.equal(studyCallbackIntent({storage:s,url,product:'world',now:NOW}),null);assert.throws(()=>finishStudyLogin(s,{access_token:'other'},intent));
});
function clientHarness({version=1,contextVersion,send,stored=true}={}){
 const storage=memoryStore(),calls=[];if(stored)storage.setItem(STUDY_SESSION,JSON.stringify({access_token:'fixture',expires_at:NOW+3600000}));
 const fetcher=async(url,opt={})=>{if(String(url).endsWith('config.json'))return Response.json(configFor(BASE));const b=JSON.parse(opt.body);calls.push(b);if(b.action==='status')return Response.json({ok:true,accountId:ACCOUNT,enabled:true,studyVersion:version,studyContextVersion:contextVersion,bankHash:'hash'});return send?send(b):Response.json({ok:true,accountId:ACCOUNT,status:'ok',feedback:feedbackFixture()});};
 const client=createFeedbackClient({storage,fetcher,base:BASE,now:()=>NOW,cryptoAPI:webcrypto});return {client,storage,calls};
}
const request={itemId:'w53-resale',bankHash:'hash',answer:ANSWER,lang:'ko',consent:'send-once'};
test('최근 선택 반응만 네 건 전송하고 재시작·옛 서버·기록 없는 계정을 안전하게 잇는다',async()=>{
 let state=readState(null);const f=readSemantic(feedbackFixture(),ANSWER);
 for(let i=0;i<6;i++)state=recordSemantic(state,{feedback:f,stage:i%2?'practice':'check',pick:'a',itemId:'w53-resale'},{now:NOW+i});
 const history=semanticHistory(readState(JSON.parse(JSON.stringify(state))),{now:NOW+10});assert.equal(history.length,4);assert.equal(history[0].target,'trend');assert.equal(history[0].selected,'이용자가 줄었다.');
 const sync=progressSnapshot(state);for(const value of [f.check.prompt,f.check.why,f.practice.prompt,f.practice.why,'이용자가 줄었다.'])assert.ok(!JSON.stringify(sync).includes(value));assert.ok(sync.obs.every(o=>!o.detail));assert.equal(semanticHistory(state,{now:NOW+10}).length,4);
 assert.equal(semanticHistory(state,{now:NOW+15*86400000}).length,0);assert.equal(semanticHistory(state,{now:NOW-1}).length,0);assert.deepEqual(semanticHistory(readState(null)),[]);
 assert.ok(!JSON.stringify(history).includes(ANSWER));assert.ok(!JSON.stringify(history).includes('attempt'));
 for(const contextVersion of [undefined,1]){const h=clientHarness({contextVersion});await h.client.init();await h.client.request({...request,history,focusSkill:'data.accuracy',focusTarget:'trend'});
  assert.deepEqual(h.calls[1].study.history,contextVersion===1?history:undefined);}
 const legacy=feedbackFixture();delete legacy.focus.target;assert.equal(readSemantic(legacy,ANSWER).focus.target,'other');
});
test('방금 연습한 목표를 다루는 안 본 자료를 고르고 재고가 없으면 같은 유형으로 돌아간다',()=>{
 const bank={open53:['w53-resale','w53-study-ways','w53-exchange','w53-living-cost','w53-clinic'].map(id=>({id,type:53})),open54:[{id:'w54-a',type:54}]};
 const state={...readState(null),seen:{'w53-resale':new Date(NOW).toISOString()}};
 assert.equal(semanticNext(state,bank,{itemId:'w53-resale',focusSkill:'data.accuracy',focusTarget:'trend',now:NOW}).itemId,'w53-exchange');
 assert.equal(semanticNext(state,bank,{itemId:'w53-resale',focusSkill:'data.accuracy',focusTarget:'comparison',now:NOW}).itemId,'w53-study-ways');
 const next=semanticNext(state,bank,{itemId:'w53-resale',focusSkill:'data.accuracy',focusTarget:'unit',now:NOW});assert.equal(next.focusTarget,'unit');
 for(const i of bank.open53)state.seen[i.id]='seen';assert.equal(semanticNext(state,bank,{itemId:'w53-resale',focusSkill:'data.accuracy',focusTarget:'trend',now:NOW}).itemId,'w54-a');
 state.seen['w54-a']='seen';assert.equal(semanticNext(state,bank,{itemId:'w53-resale',now:NOW}).why,'no-items');
});
test('동의·현재 문항·서버 지원이 있을 때만 학생 글을 보내며 중복 발송을 막는다',async()=>{
 const h=clientHarness();await h.client.init();assert.equal(h.client.owner(),'user-'+ACCOUNT);
 await assert.rejects(h.client.request({...request,consent:undefined}),/CONSENT_REQUIRED/);await assert.rejects(h.client.request({...request,bankHash:'old'}),/ITEM_CHANGED/);
 const one=h.client.request(request);await assert.rejects(h.client.request(request),/BUSY/);await one;
 assert.equal(h.calls.length,2);assert.equal(h.calls[1].mode,'study');assert.equal(h.calls[1].study.stage,'initial');
 const no=clientHarness({version:0});await no.client.init();await assert.rejects(no.client.request(request),/STUDY_UNAVAILABLE/);
 const guest=clientHarness({stored:false});await guest.client.init();assert.equal(guest.calls.length,0);
});
test('늦게 온 AI 응답은 연결을 닫거나 계정 토큰이 바뀌면 폐기한다',async()=>{
 let resolve;const h=clientHarness({send:()=>new Promise(r=>resolve=r)});await h.client.init();const p=h.client.request(request);await new Promise(r=>setImmediate(r));h.client.disconnect();resolve(Response.json({ok:true,accountId:ACCOUNT,status:'ok',feedback:feedbackFixture()}));await assert.rejects(p,/ACCOUNT_CHANGED/);assert.equal(h.client.owner(),null);
 const j=clientHarness({send:async()=>{j.storage.setItem(STUDY_SESSION,JSON.stringify({access_token:'other',expires_at:NOW+3600000}));return Response.json({ok:true,accountId:ACCOUNT,status:'ok'});}});await j.client.init();await assert.rejects(j.client.request(request),/ACCOUNT_CHANGED/);
 assert.equal(j.client.owner(),null);assert.equal(j.client.status().connected,false);assert.equal(JSON.parse(j.storage.getItem(STUDY_SESSION)).access_token,'other');
});
test('갱신할 수 없는 인증은 연결을 닫고, 중단 요청의 늦은 응답은 새 요청을 막지 않는다',async()=>{
 const expired=clientHarness();await expired.client.init();expired.storage.setItem(STUDY_SESSION,JSON.stringify({access_token:'fixture',expires_at:1}));await assert.rejects(expired.client.request(request),/AUTH_REQUIRED/);assert.equal(expired.client.owner(),null);
 const resolvers=[],h=clientHarness({send:()=>new Promise(r=>resolvers.push(r))});await h.client.init();const first=h.client.request(request);await new Promise(r=>setImmediate(r));h.client.cancel();const second=h.client.request(request);await new Promise(r=>setImmediate(r));
 const response=()=>Response.json({ok:true,accountId:ACCOUNT,status:'ok',feedback:feedbackFixture()});resolvers[0](response());await assert.rejects(first,/CANCELLED/);resolvers[1](response());assert.equal((await second).status,'ok');assert.equal(h.client.owner(),'user-'+ACCOUNT);
});
