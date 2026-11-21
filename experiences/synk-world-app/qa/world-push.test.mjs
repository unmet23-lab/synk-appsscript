// WORLD 학습 알림 2단 · 기기 쪽 푸시 모듈(world-push.mjs)과 서비스 워커(world-push-sw.js). 설계 qa/push-reminders-20261022/설계.md.
// 가짜 브라우저(서비스 워커·PushManager·권한)와 가짜 서버로 켜기·끄기·주인 기록·요약 모으기를 보고, 공개할 실제 워커 파일을 격리된 vm에서 돌려
// 잠금 화면 글 표 = 글 표(world-strings), 누름 알림·창 열기를 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createECDH} from 'node:crypto';
import {createWorldPush,worldPushSupport,decodeVapidKey,deviceTimeZone,PUSH_RECORD_KEY} from '../world-push.mjs';
import STRINGS from '../../brand-opening/world-strings.mjs';

const KEY=(()=>{const ecdh=createECDH('prime256v1');return ecdh.generateKeys().toString('base64url');})();
const DESKTOP='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';
const ANDROID='Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36';
const IPHONE='Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1';
const memory=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key),key:index=>[...values.keys()][index]??null,get length(){return values.size;}};};
const SCOPE='https://synk.im/world/';
const flush=()=>new Promise(resolve=>setImmediate(resolve));

// 가짜 브라우저: 서비스 워커 등록 하나, 브라우저 구독 하나(있으면). subscribe는 부른 순간을 센다(누른 동작 안에서 불렀는지).
function browser({userAgent=DESKTOP,permission='default',answer='granted',registered=false,subscribed=null,secure=true,extra={}}={}){
 const log=[];let current=subscribed,perm=permission,pendingPrompt=null;
 const subscription=endpoint=>({endpoint,toJSON(){return {endpoint,expirationTime:null,keys:{p256dh:KEY,auth:'A'.repeat(22)}};},async unsubscribe(){log.push(['unsubscribe',endpoint]);if(current?.endpoint===endpoint)current=null;return true;}});
 if(current)current=subscription(current);
 const pushManager={async getSubscription(){return current;},subscribe(options){log.push(['subscribe',options.userVisibleOnly]);
  if(answer==='hang')return new Promise(resolve=>{pendingPrompt=()=>{perm='granted';current=subscription('https://fcm.googleapis.com/fcm/send/late');resolve(current);};});
  if(answer==='denied'){perm='denied';return Promise.reject(Object.assign(new Error('denied'),{name:'NotAllowedError'}));}
  perm='granted';current=current||subscription('https://fcm.googleapis.com/fcm/send/new');return Promise.resolve(current);}};
 const registration={scope:SCOPE,active:{},pushManager};
 const env={navigator:{userAgent,maxTouchPoints:0,serviceWorker:{async register(url,options){log.push(['register',url,options.scope]);registered=true;return registration;},async getRegistration(scope){return registered&&scope===SCOPE?registration:undefined;}}},
  PushManager:function(){},Notification:{get permission(){return perm;}},isSecureContext:secure,atob:value=>Buffer.from(value,'base64').toString('binary'),...extra};
 return {env,log,resolvePrompt:()=>pendingPrompt?.(),get current(){return current;}};
}
// 가짜 서버(world-push): 동작마다 답을 정한다.
function server({enabled=true,device=false,active=false,plan=null,fail={}}={}){
 const calls=[];let deviceOn=device,accountOn=active;
 const reply=(action,body)=>{
  if(fail[action])return Promise.reject(Object.assign(new Error(fail[action]),{code:fail[action]}));
  if(action==='status')return Promise.resolve({ok:true,accountId:'acc-1',enabled,...(enabled?{publicKey:KEY}:{}),device:deviceOn&&body.endpoint?{subscribed:true,deviceId:'dev-1'}:{subscribed:false},account:{active:accountOn,devices:accountOn?1:0},plan});
  if(action==='subscribe'){deviceOn=true;accountOn=true;return Promise.resolve({ok:true,accountId:'acc-1',enabled:true,publicKey:KEY,device:{subscribed:true,deviceId:'dev-1'},account:{active:true,devices:1},plan:{next:1,log:[]}});}
  if(action==='unsubscribe'){deviceOn=false;accountOn=false;return Promise.resolve({ok:true,accountId:'acc-1',removed:true,account:{active:false,devices:0},handover:[{id:'review:1'}],settings:{frequency:1,hour:18,since:null}});}
  if(action==='sync')return Promise.resolve({ok:true,accountId:'acc-1',enabled:true,publicKey:KEY,account:{active:accountOn,devices:1},plan});
  return Promise.reject(new Error('unknown'));
 };
 return {calls,request:(action,body={},options={})=>{calls.push({action,body,options});return reply(action,body);},
  anonymous:(action,body={},options={})=>{calls.push({action,body,options,anonymous:true});return Promise.resolve({ok:true,removed:true});}};
}
const make=(b,s,extra={})=>createWorldPush({request:s.request,anonymous:s.anonymous,env:b.env,storage:extra.storage||memory(),workerUrl:SCOPE+'world-push-sw.js',scopeUrl:SCOPE,now:extra.now||(()=>Date.UTC(2026,9,22,3)),...extra});

test('받을 수 있는 기기: PC·안드로이드 크롬은 되고, 아이폰·아이패드(홈 화면 앱 없음)·PC 앱 창·안전하지 않은 곳·푸시 없는 브라우저는 안 된다',()=>{
 assert.deepEqual(worldPushSupport(browser().env),{supported:true,reason:'ok',permission:'default'});
 assert.equal(worldPushSupport(browser({userAgent:ANDROID}).env).supported,true,'안드로이드 크롬 — 1단은 안 되던 곳');
 assert.equal(worldPushSupport(browser({userAgent:IPHONE}).env).reason,'ios');
 const ipad=browser({userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/19.0 Safari/605.1.15'});ipad.env.navigator.maxTouchPoints=5;
 assert.equal(worldPushSupport(ipad.env).reason,'ios','아이패드 사파리(맥 꼴 + 터치)');
 assert.equal(worldPushSupport(browser({extra:{synkDesktop:{accountRequest(){}}}}).env).reason,'desktop');
 assert.equal(worldPushSupport(browser({secure:false}).env).reason,'unsupported');
 assert.equal(worldPushSupport({...browser().env,PushManager:undefined}).reason,'unsupported');
 assert.equal(worldPushSupport(browser({permission:'denied'}).env).reason,'blocked');
 assert.match(deviceTimeZone(),/^(?:UTC|[A-Za-z]+(?:\/[A-Za-z0-9_+-]+){1,2})$/);
 assert.equal(decodeVapidKey(KEY,value=>Buffer.from(value,'base64').toString('binary')).length,65);
 assert.throws(()=>decodeVapidKey('abc'),{code:'PUSH_KEY'});
});

test('켜기: 누른 동작 안에서 바로 subscribe를 부르고(사파리), 서버에 동의 판·설정·요약·1단 기록을 보내고, 이 브라우저 주인 기록을 남긴다',async()=>{
 const b=browser(),s=server(),storage=memory(),push=make(b,s,{storage});
 await push.setAccount('acc-1');
 assert.equal(push.snapshot().publicReady,false,'설정을 열기 전에는 서비스 워커가 없다');
 await push.ready();
 assert.equal(push.snapshot().publicReady,true);assert.deepEqual(b.log[0],['register',SCOPE+'world-push-sw.js',SCOPE]);
 const settings={frequency:2,hour:null,since:null},digest={reviews:[],examDate:null,planWeek:null,lastStudyDay:null,studyHour:null,lang:'ko',timeZone:'Asia/Seoul'};
 const run=push.enable({settings,digest,handover:[{id:'review:1'}]});
 assert.deepEqual(b.log.at(-1),['subscribe',true],'await 없이 그 자리에서 불렀다');
 const result=await run;
 assert.equal(result.device.subscribed,true);assert.equal(result.account.active,true);
 const sent=s.calls.find(call=>call.action==='subscribe').body;
 assert.equal(sent.consent,1);assert.deepEqual(sent.settings,settings);assert.deepEqual(sent.digest,digest);assert.deepEqual(sent.handover,[{id:'review:1'}]);
 assert.deepEqual(Object.keys(sent.subscription.keys).sort(),['auth','p256dh']);
 assert.deepEqual(JSON.parse(storage.getItem(PUSH_RECORD_KEY)),{accountId:'acc-1',deviceId:'dev-1',endpoint:'https://fcm.googleapis.com/fcm/send/new'});
});

test('켜기 실패·거절·30초 무응답: 켜지 않고, 방금 만든 브라우저 구독은 지운다(늦게 허용돼도)',async t=>{
 // 서버 저장 실패.
 let b=browser(),s=server({fail:{subscribe:'PUSH_DEVICE_LIMIT'}}),push=make(b,s);
 await push.setAccount('acc-1');await push.ready();
 let value=await push.enable({settings:{frequency:2,hour:null,since:null},digest:null});
 assert.equal(value.error,'PUSH_DEVICE_LIMIT');assert.equal(b.current,null,'브라우저 구독을 지웠다');assert.equal(value.device.subscribed,false);
 // 권한 거절.
 b=browser({answer:'denied'});s=server();push=make(b,s);await push.setAccount('acc-1');await push.ready();
 value=await push.enable({});assert.equal(value.error,'PUSH_DENIED');
 // 30초 무응답 → 기다리지 않음 → 늦게 허용된 구독도 지운다.
 t.mock.timers.enable({apis:['setTimeout']});
 b=browser({answer:'hang'});s=server();push=make(b,s);await push.setAccount('acc-1');await push.ready();
 const run=push.enable({});
 assert.equal(push.snapshot().waiting,true);
 t.mock.timers.tick(30000);
 // 권한 창이 끝내 답하지 않아도 켜기는 30초에 끝나고(화면이 「응답 없음」을 알린다), 단추를 다시 쓸 수 있다(10-22 아르곤 화면 A1).
 value=await run;
 assert.equal(value.error,'PUSH_TIMEOUT');assert.equal(value.waiting,false);assert.equal(value.busy,false);assert.equal(value.publicReady,true);
 const before=b.log.filter(entry=>entry[0]==='subscribe').length;
 const again=push.enable({});
 assert.equal(b.log.filter(entry=>entry[0]==='subscribe').length,before+1,'다시 누르면 다시 청한다');
 t.mock.timers.tick(30000);await again;
 // 늦게 허용된 구독은 받는 대로 지운다. 서버에는 보내지 않았다.
 b.resolvePrompt();await flush();await flush();
 assert.equal(b.current,null,'늦게 허용된 구독을 지웠다');assert.equal(s.calls.some(call=>call.action==='subscribe'),false,'서버에는 보내지 않았다');
 // 계정이 바뀌면 기다림을 끝낸다 — 새 계정이 바로 켤 수 있다.
 b=browser({answer:'hang'});s=server();push=make(b,s);await push.setAccount('acc-1');await push.ready();
 const old=push.enable({});
 await push.setAccount('acc-2');
 assert.equal((await old).waiting,false);assert.equal(push.snapshot().waiting,false);
});

test('켠 바로 뒤 다시 잡기는 켜며 보낸 요약을 또 보내지 않는다(10-22 아르곤 화면 A3)',async()=>{
 const b=browser(),s=server(),push=make(b,s);
 await push.setAccount('acc-1');await push.ready();
 const digest={reviews:[1],examDate:null,planWeek:null,lastStudyDay:'2026-10-21',studyHour:null,lang:'ko',timeZone:'Asia/Seoul'},handover=[{id:'review:1',kind:'review',ref:'1',at:1,plannedAt:1,deliveredAt:2}];
 await push.enable({settings:{frequency:2,hour:null,since:null},digest,handover});
 push.sync({digest,handover});
 assert.equal(s.calls.filter(call=>call.action==='sync').length,0);
});

test('주인 기록: 서버에 없는 이 계정 구독은 지우고, 다른 계정으로 로그인만 해서는 지우지 않으며, 다른 계정이 켜면 그 동작에서 가져간다',async()=>{
 // 서버에서 지워진 이 계정 구독(정리·404·다른 기기에서 로그아웃시킴) → 브라우저에서도 지운다.
 let storage=memory();storage.setItem(PUSH_RECORD_KEY,JSON.stringify({accountId:'acc-1',deviceId:'dev-1',endpoint:'https://fcm.googleapis.com/fcm/send/old'}));
 let b=browser({registered:true,subscribed:'https://fcm.googleapis.com/fcm/send/old'}),s=server({device:false}),push=make(b,s,{storage});
 await push.setAccount('acc-1');
 assert.equal(b.current,null);assert.equal(storage.getItem(PUSH_RECORD_KEY),null);
 // 브라우저가 구독을 잃었는데(사이트 데이터 지움) 서버에 남았을 수 있으면 → 로그인 없이 기기 식별자로 지운다.
 storage=memory();storage.setItem(PUSH_RECORD_KEY,JSON.stringify({accountId:'acc-1',deviceId:'dev-1',endpoint:'https://fcm.googleapis.com/fcm/send/lost'}));
 b=browser({registered:true});s=server();push=make(b,s,{storage});
 await push.setAccount('acc-1');await flush();
 assert.deepEqual(s.calls.filter(call=>call.anonymous).map(call=>[call.action,call.body.deviceId]),[['unsubscribe','dev-1']]);
 // 다른 계정으로 로그인만: 앞 계정의 구독은 그대로(두 탭이 다른 계정일 수 있다).
 storage=memory();storage.setItem(PUSH_RECORD_KEY,JSON.stringify({accountId:'acc-0',deviceId:'dev-0',endpoint:'https://fcm.googleapis.com/fcm/send/shared'}));
 b=browser({registered:true,subscribed:'https://fcm.googleapis.com/fcm/send/shared'});s=server({device:false});push=make(b,s,{storage});
 await push.setAccount('acc-1');
 assert.notEqual(b.current,null);assert.equal(JSON.parse(storage.getItem(PUSH_RECORD_KEY)).accountId,'acc-0');
 // 이 계정이 켜면: 앞 계정의 이 브라우저 구독을 서버에서 지운 뒤 가져간다.
 await push.ready();await push.enable({settings:{frequency:2,hour:null,since:null},digest:null});
 const order=s.calls.map(call=>call.anonymous?`anon:${call.action}:${call.body.deviceId}`:call.action);
 assert.ok(order.indexOf('anon:unsubscribe:dev-0')<order.indexOf('subscribe'),order.join(' '));
 assert.equal(JSON.parse(storage.getItem(PUSH_RECORD_KEY)).accountId,'acc-1');
});

test('끄기·로그아웃: 서버와 브라우저에서 지우고 주인 기록을 비운다 — 마지막 기기면 보낸 기록·설정을 돌려준다, 서버가 막히면 로그인 없이',async()=>{
 const storage=memory(),b=browser(),s=server(),push=make(b,s,{storage});
 await push.setAccount('acc-1');await push.ready();await push.enable({settings:{frequency:2,hour:null,since:null},digest:null});
 const result=await push.disable();
 assert.deepEqual(result.handover,[{id:'review:1'}]);assert.deepEqual(result.settings,{frequency:1,hour:18,since:null});
 assert.equal(b.current,null);assert.equal(storage.getItem(PUSH_RECORD_KEY),null);assert.equal(push.snapshot().device.subscribed,false);
 // 로그아웃: 서버가 막히면 기기 식별자로.
 const s2=server({fail:{unsubscribe:'PUSH_UNAVAILABLE'}}),b2=browser(),storage2=memory(),push2=make(b2,s2,{storage:storage2});
 await push2.setAccount('acc-1');await push2.ready();await push2.enable({settings:{frequency:2,hour:null,since:null},digest:null});
 const out=await push2.logout();
 assert.equal(out.ok,true);assert.ok(s2.calls.some(call=>call.anonymous&&call.action==='unsubscribe'&&call.body.deviceId==='dev-1'));
 assert.equal(b2.current,null);assert.equal(storage2.getItem(PUSH_RECORD_KEY),null);
});

// 4-8 §24-2: 새 길 판정이 「확인 중」인 동안 기기는 복습 때 칸을 뺀 요약을 보낸다(서버가 아는 때를 그대로 둔다). 판정이 서서 처음으로
// 때를 실은 요약은 5분 모으기를 기다리지 않는다 — 그 사이 앱을 닫아도 서버가 새 때를 안다.
test('요약 모으기: 복습 때를 모르던 요약 뒤 처음 아는 요약은 바로 간다',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 let clock=Date.UTC(2026,9,22,3);
 const b=browser({registered:true,subscribed:'https://fcm.googleapis.com/fcm/send/x'}),s=server({device:true,active:true});
 const push=make(b,s,{now:()=>clock});
 await push.setAccount('acc-1');
 const base={examDate:null,planWeek:null,lastStudyDay:'2026-10-21',studyHour:null,lang:'ko',timeZone:'Asia/Seoul'};
 const syncs=()=>s.calls.filter(call=>call.action==='sync');
 push.sync({digest:{...base}});assert.equal(syncs().length,1);assert.equal('reviews' in syncs()[0].body.digest,false);
 clock+=60000;push.sync({digest:{...base,reviews:[1]}});assert.equal(syncs().length,2,'모르던 뒤 처음 아는 요약은 바로');
 clock+=60000;push.sync({digest:{...base,reviews:[2]}});assert.equal(syncs().length,2,'그 뒤 바뀐 때는 지금처럼 5분 모으기');
});

// 11-20 GPT 끝 판 GA1 · 다시 검수 GA1 · GA2 · GA3: 보낸 뒤 응답 전에 앱을 닫으면 계정 정리(stop)가 보통 요청을 끊는다. 그래서 요약 · 설정 요청은
// 모두 keepalive로 보낸다(keepalive 요청에는 끊는 신호를 달지 않는다 — world-account pushRequest). 떠날 때 다시 보내지는 않는다(다른 탭의 새 설정을 덮지 않게).
test('요약 보내기: 요약 · 설정 요청은 모두 keepalive로 간다 — 모르는 요약 · 처음 아는 요약 · 설정 · 오늘 공부함 · 탭의 첫 요약 · 모아 둔 요약',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 let clock=Date.UTC(2026,9,22,3);
 const b=browser({registered:true,subscribed:'https://fcm.googleapis.com/fcm/send/x'}),s=server({device:true,active:true});
 const push=make(b,s,{now:()=>clock});
 await push.setAccount('acc-1');
 const base={examDate:null,planWeek:null,lastStudyDay:'2026-10-21',studyHour:null,lang:'ko',timeZone:'Asia/Seoul'};
 const syncs=()=>s.calls.filter(call=>call.action==='sync');
 const other=server({device:true,active:true}),tab=make(b,other,{now:()=>clock});await tab.setAccount('acc-1');
 tab.sync({digest:{...base,reviews:[1]}});assert.equal(other.calls.filter(call=>call.action==='sync')[0].options.keepalive,true,'탭의 첫 요약(이미 아는 복습 때)');
 push.sync({digest:{...base}});assert.equal(syncs()[0].options.keepalive,true,'모르는 요약');
 push.sync({digest:{...base,reviews:[1]}});assert.equal(syncs().length,2);assert.equal(syncs()[1].options.keepalive,true,'처음 아는 요약');
 push.sync({digest:{...base,reviews:[1],examDate:'2026-12-01'}});assert.equal(syncs().length,2,'아는 요약 뒤 바뀐 요약은 모은다');
 push.sync({settings:{frequency:1,hour:9}});assert.equal(syncs()[2].options.keepalive,true,'설정(모아 둔 요약과 함께)');
 push.sync({digest:{...base,reviews:[1],lastStudyDay:'2026-10-22'}});assert.equal(syncs()[3].options.keepalive,true,'오늘 공부함');
 clock+=60000;push.sync({digest:{...base,reviews:[2],lastStudyDay:'2026-10-22'}});assert.equal(syncs().length,4,'5분 모으기');
 clock+=5*60000;t.mock.timers.tick(5*60000);await flush();assert.equal(syncs()[4].options.keepalive,true,'모아 둔 요약');
 push.flush();assert.equal(syncs().length,5,'보낸 요청을 떠날 때 다시 보내지 않는다');
});

// 11-20 GPT GA2: 앞 요청의 응답이 뒤 요청의 응답보다 늦게 와도 화면의 계획은 뒤 응답 것이다.
test('요약 보내기: 늦게 온 앞 응답은 뒤 응답의 계획을 덮지 않는다',async()=>{
 const b=browser({registered:true,subscribed:'https://fcm.googleapis.com/fcm/send/x'}),s=server({device:true,active:true});
 const answers=[];const request=(action,body,options)=>action==='sync'?(s.calls.push({action,body,options}),new Promise(resolve=>answers.push(resolve))):s.request(action,body,options);
 const push=make(b,{...s,request});
 await push.setAccount('acc-1');
 const base={examDate:null,planWeek:null,lastStudyDay:'2026-10-21',studyHour:null,lang:'ko',timeZone:'Asia/Seoul'};
 const reply=next=>({ok:true,accountId:'acc-1',enabled:true,publicKey:KEY,account:{active:true,devices:1},plan:{next,log:[]}});
 push.sync({digest:{...base}});push.sync({digest:{...base,reviews:[1]}});assert.equal(answers.length,2);
 answers[1](reply(2000));await flush();assert.equal(push.snapshot().plan.next,2000);
 answers[0](reply(5000));await flush();assert.equal(push.snapshot().plan.next,2000,'옛 응답은 버린다');
});

// 11-20 Fable 설계 검토 P2-2 · P3-7 · P2-5: 응답을 기다리는 동안 떠나도 다시 보내지 않고(다른 탭의 새 설정을 덮지 않게), 늦게 온 앞 요청의 실패는
// 뒤 응답을 지우지 않고, 응답이 영영 안 오면 12초에 오류를 띄운다(요청은 끊지 않는다).
test('요약 보내기: 응답을 기다리는 동안 떠나도 다시 보내지 않는다 · 늦은 앞 실패는 뒤 응답을 지우지 않는다 · 응답이 없으면 12초에 오류',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const b=browser({registered:true,subscribed:'https://fcm.googleapis.com/fcm/send/x'}),s=server({device:true,active:true});
 const answers=[];const request=(action,body,options)=>action==='sync'?(s.calls.push({action,body,options}),new Promise((resolve,reject)=>answers.push({resolve,reject}))):s.request(action,body,options);
 const push=make(b,{...s,request});
 await push.setAccount('acc-1');
 const base={examDate:null,planWeek:null,lastStudyDay:'2026-10-21',studyHour:null,lang:'ko',timeZone:'Asia/Seoul'};
 const syncs=()=>s.calls.filter(call=>call.action==='sync');
 const reply=next=>({ok:true,accountId:'acc-1',enabled:true,publicKey:KEY,account:{active:true,devices:1},plan:{next,log:[]}});
 push.sync({digest:{...base}});push.sync({settings:{frequency:1,hour:9}});assert.equal(syncs().length,2);
 push.flush();assert.equal(syncs().length,2,'응답을 기다리는 요약 · 설정을 떠날 때 다시 보내지 않는다');
 answers[1].resolve(reply(3000));await flush();assert.equal(push.snapshot().plan.next,3000);
 answers[0].reject(Object.assign(Error('PUSH_UNAVAILABLE'),{code:'PUSH_UNAVAILABLE'}));await flush();
 assert.equal(push.snapshot().error,null,'늦게 실패한 앞 요청은 뒤 응답 뒤의 화면에 오류를 띄우지 않는다');assert.equal(push.snapshot().plan.next,3000);
 push.sync({digest:{...base,lastStudyDay:'2026-10-22'}});assert.equal(syncs().length,3);
 t.mock.timers.tick(12000);await flush();assert.equal(push.snapshot().error,'PUSH_TIMEOUT','응답이 없으면 12초에 오류');
});

test('요약 모으기: 2단이 켜진 계정만 — 같은 요약은 6시간에 한 번, 바뀌면 5분에 한 번(마지막 것), 「오늘 공부함」·설정은 바로, 떠날 때는 keepalive',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 let clock=Date.UTC(2026,9,22,3);
 const b=browser({registered:true,subscribed:'https://fcm.googleapis.com/fcm/send/x'}),s=server({device:true,active:true});
 const push=make(b,s,{now:()=>clock});
 await push.setAccount('acc-1');
 const digest=(extra={})=>({reviews:[1],examDate:null,planWeek:null,lastStudyDay:'2026-10-21',studyHour:null,lang:'ko',timeZone:'Asia/Seoul',...extra});
 const syncs=()=>s.calls.filter(call=>call.action==='sync');
 push.sync({digest:digest()});assert.equal(syncs().length,1,'처음은 바로');
 push.sync({digest:digest()});assert.equal(syncs().length,1,'같으면 안 보냄');
 clock+=60000;push.sync({digest:digest({reviews:[2]})});assert.equal(syncs().length,1,'바뀌어도 5분 안이면 모은다');
 push.sync({digest:digest({reviews:[3]})});
 clock+=4*60000;t.mock.timers.tick(4*60000);await flush();
 assert.equal(syncs().length,2);assert.deepEqual(syncs()[1].body.digest.reviews,[3],'모은 것 중 마지막');
 clock+=30000;push.sync({digest:digest({reviews:[3],lastStudyDay:'2026-10-22'})});assert.equal(syncs().length,3,'오늘 공부함은 바로');
 clock+=30000;push.sync({settings:{frequency:1,hour:9}});assert.equal(syncs().length,4,'설정은 바로');assert.deepEqual(syncs()[3].body.settings,{frequency:1,hour:9});
 assert.equal(syncs()[3].body.digest,undefined,'모아 둔 요약이 없으면 설정만');
 clock+=30000;push.sync({digest:digest({reviews:[4],lastStudyDay:'2026-10-22'})});assert.equal(syncs().length,4,'설정만 보낸 뒤에도 요약 간격은 그대로');
 push.flush();assert.equal(syncs().length,5);assert.equal(syncs()[4].options.keepalive,true);assert.deepEqual(syncs()[4].body.digest.reviews,[4]);
 clock+=60000;push.sync({digest:digest({reviews:[4],lastStudyDay:'2026-10-22'})});assert.equal(syncs().length,5,'떠날 때 보낸 것과 같다');
 clock+=7*3600000;push.sync({digest:digest({reviews:[4],lastStudyDay:'2026-10-22'})});assert.equal(syncs().length,6,'6시간 지나면 같아도 한 번');
 // 모아 둔 요약은 설정과 함께 나간다. 보낸 것과 같은 요약으로 돌아오면 모아 둔 것을 버린다.
 clock+=60000;push.sync({digest:digest({reviews:[5],lastStudyDay:'2026-10-22'})});assert.equal(syncs().length,6);
 push.sync({settings:{frequency:2,hour:null}});assert.equal(syncs().length,7);assert.deepEqual(syncs()[6].body.digest.reviews,[5],'설정과 함께');
 clock+=60000;push.sync({digest:digest({reviews:[6],lastStudyDay:'2026-10-22'})});push.sync({digest:digest({reviews:[5],lastStudyDay:'2026-10-22'})});
 clock+=5*60000;t.mock.timers.tick(5*60000);await flush();assert.equal(syncs().length,7,'되돌아온 요약 — 모아 둔 것을 버렸다');
 // 2단이 꺼진 계정은 보내지 않는다.
 const quiet=server({active:false}),off=make(browser(),quiet);await off.setAccount('acc-2');
 off.sync({digest:digest()});off.sync({settings:{frequency:2,hour:null}});off.flush();
 assert.deepEqual(quiet.calls.map(call=>call.action),['status']);
});

test('보낸 줄: 요약에 이 기기 1단이 보낸 줄을 싣고, 새 줄은 모으지 않고 바로 보낸다',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 let clock=Date.UTC(2026,9,22,3);
 const s=server({device:true,active:true}),push=make(browser({registered:true,subscribed:'https://fcm.googleapis.com/fcm/send/x'}),s,{now:()=>clock});
 await push.setAccount('acc-1');
 const syncs=()=>s.calls.filter(call=>call.action==='sync');
 const base={reviews:[1],examDate:null,planWeek:null,lastStudyDay:'2026-10-21',studyHour:null,lang:'ko',timeZone:'Asia/Seoul'};
 const row={id:'review:1',kind:'review',ref:'1',at:1,plannedAt:1,deliveredAt:2};
 push.sync({digest:base,handover:[]});assert.equal(syncs().length,1);assert.equal(syncs()[0].body.handover,undefined,'빈 줄은 싣지 않는다');
 clock+=60000;push.sync({digest:base,handover:[row]});assert.equal(syncs().length,2,'새 보낸 줄은 바로');assert.deepEqual(syncs()[1].body.handover,[row]);
 clock+=60000;push.sync({digest:{...base,reviews:[2]},handover:[row]});assert.equal(syncs().length,2,'줄이 같으면 요약 간격대로');
 push.flush();assert.equal(syncs().length,3);assert.deepEqual(syncs()[2].body,{digest:{...base,reviews:[2]},handover:[row]});
});

test('받을 수 없는 기기(아이폰·푸시 없는 브라우저): 계정이 바뀐 직후에는 부르지 않고, 설정을 열 때·1단이 띄우기 직전에만 계정 상태를 읽는다 — PC 앱 창은 부르지 않는다',async()=>{
 const s=server({active:true}),push=make(browser({userAgent:IPHONE}),s);
 await push.setAccount('acc-1');
 assert.deepEqual(s.calls,[]);assert.equal(push.snapshot().phase,'unsupported');
 await push.ready();
 assert.deepEqual(s.calls.map(call=>[call.action,call.body]),[['status',{}]],'등록 없이 상태만');
 const value=push.snapshot();
 assert.equal(value.phase,'unsupported');assert.equal(value.enabled,false);assert.equal(value.publicReady,false);assert.equal(value.account.active,true,'다른 기기에서 켜 둔 2단');
 await push.fresh();assert.equal(s.calls.length,1,'10분 안이면 다시 읽지 않는다');
 // 푸시 없는 PC 브라우저: 1단이 띄우기 직전(fresh)에 읽는다.
 const s2=server({active:true}),plain=make({...browser().env,PushManager:undefined},s2);
 await plain.setAccount('acc-1');assert.equal(s2.calls.length,0);
 assert.equal((await plain.fresh()).account.active,true);assert.equal(s2.calls.length,1);
 // PC 앱 창(다리): 계정 요청 길이 없다.
 const s3=server({active:true}),desk=make(browser({extra:{synkDesktop:{accountRequest(){}}}}),s3);
 await desk.setAccount('acc-1');await desk.ready();await desk.fresh();
 assert.deepEqual(s3.calls,[]);
});

test('비상 스위치(서버 기능 꺼짐): 계정의 2단도 꺼진 것으로 본다 — 1단이 다시 맡고, 이 브라우저 구독은 남긴다(다시 켜면 이어진다)',async()=>{
 const s=server({enabled:false,device:true,active:true}),b=browser({registered:true,subscribed:'https://fcm.googleapis.com/fcm/send/x'}),storage=memory();
 storage.setItem(PUSH_RECORD_KEY,JSON.stringify({accountId:'acc-1',deviceId:'dev-1',endpoint:'https://fcm.googleapis.com/fcm/send/x'}));
 const push=make(b,s,{storage});await push.setAccount('acc-1');
 const value=push.snapshot();
 assert.equal(value.enabled,false);assert.equal(value.account.active,false);assert.equal(value.device.subscribed,true);
 assert.notEqual(b.current,null);assert.notEqual(storage.getItem(PUSH_RECORD_KEY),null);
 push.sync({digest:{reviews:[],examDate:null,planWeek:null,lastStudyDay:null,studyHour:null,lang:'ko',timeZone:'Asia/Seoul'}});
 assert.equal(s.calls.filter(call=>call.action==='sync').length,0,'꺼진 동안 요약을 보내지 않는다');
 await push.ready();assert.equal(push.snapshot().publicReady,false,'켜기도 잠근다(공개 키 없음)');
});

test('누름 알림(ack): 토큰 모양이 맞을 때만 로그인 없이 보낸다',async()=>{
 const s=server(),push=make(browser(),s);
 push.ack('A'.repeat(22));push.ack('nope');push.ack(null);
 assert.deepEqual(s.calls.map(call=>[call.anonymous,call.action,call.body.token]),[[true,'opened','A'.repeat(22)]]);
});

// ── 서비스 워커(공개할 실제 파일) ──
const SW=fs.readFileSync(new URL('../world-push-sw.js',import.meta.url),'utf8');
function worker({windows=[]}={}){
 const handlers={},shown=[],opened=[],fetches=[],waits=[];
 const self={addEventListener:(type,fn)=>{handlers[type]=fn;},skipWaiting:()=>Promise.resolve(),
  registration:{scope:SCOPE,showNotification:(title,options)=>{shown.push({title,options});return Promise.resolve();}},
  clients:{claim:()=>Promise.resolve(),matchAll:async()=>windows,openWindow:async url=>{opened.push(url);return {};}}};
 const context={self,URL,JSON,Object,Array,
  fetch:async(url,init={})=>{fetches.push({url:String(url),init});
   if(String(url).endsWith('/world-config.json'))return {json:async()=>({mode:'account',basePath:'/world/',account:{supabaseUrl:'https://abcdefgh.supabase.co',supabasePublishableKey:'sb_publishable_test'}})};
   return {ok:true,json:async()=>({ok:true})};}};
 vm.createContext(context);vm.runInContext(SW,context);
 const fire=async(type,event)=>{handlers[type]({...event,waitUntil:p=>waits.push(p)});await Promise.all(waits.splice(0));};
 return {handlers,shown,opened,fetches,fire,text:JSON.parse(vm.runInContext('JSON.stringify(TEXT)',context))};
}

test('워커 잠금 화면 글 = 글 표(world-strings reminder.push.*): 세 문장·세 언어, 같은 tag, 아이콘, 모양이 틀린 푸시는 이번 주 연습 한국어',async()=>{
 for(const kind of ['review','plan','exam'])for(const lang of ['ko','en','mn']){
  const w=worker();
  await w.fire('push',{data:{json:()=>({type:'synk-world-reminder',kind,lang,token:'B'.repeat(22)})}});
  assert.equal(w.shown.length,1);
  assert.equal(w.shown[0].title,STRINGS['reminder.push.title'][lang]);
  assert.equal(w.shown[0].options.body,STRINGS[`reminder.push.${kind}`][lang],`${kind} ${lang}`);
  assert.equal(w.shown[0].options.tag,'synk-world-reminder');assert.equal(w.shown[0].options.lang,lang);
  assert.equal(w.shown[0].options.icon,SCOPE+'world-icon-192.png');
  assert.deepEqual({...w.shown[0].options.data},{kind,token:'B'.repeat(22)});
 }
 for(const odd of [()=>{throw new Error('bad');},()=>({type:'other',kind:'review',lang:'mn'}),()=>({type:'synk-world-reminder',kind:'score',lang:'ja',token:'x'})]){
  const w=worker();await w.fire('push',{data:{json:odd}});
  assert.equal(w.shown[0].options.body,STRINGS['reminder.push.plan'].ko);assert.equal(w.shown[0].options.data.token,null);
 }
 const w=worker();await w.fire('push',{data:null});assert.equal(w.shown.length,1,'몸통이 없어도 알림은 띄운다');
 // 워커의 글 표는 글 표의 네 줄과 하나도 다르지 않고(1단과 같은 문장), 약점·급수·점수·이름·연속 기록 같은 말이 없다.
 assert.deepEqual(w.text,Object.fromEntries(['title','review','plan','exam'].map(key=>[key,{...STRINGS[`reminder.push.${key}`]}])));
 assert.doesNotMatch(JSON.stringify(w.text),/streak|score|grade|weak|level|점수|급수|연속|약점|틀린|Оноо|түвшин/i);
});

test('워커 누름: 공개 설정에서 함수 주소·공개 키를 읽어 누름을 알리고 새 창을 연다 — 열린 WORLD 창이 있으면 그 창에 알리고 앞으로',async()=>{
 const token='C'.repeat(22);
 let w=worker();
 await w.fire('notificationclick',{notification:{data:{kind:'exam',token},close(){}}});
 assert.equal(w.fetches[0].url,SCOPE+'world-config.json');
 const post=w.fetches[1];
 assert.equal(post.url,'https://abcdefgh.supabase.co/functions/v1/world-push/api');assert.equal(post.init.method,'POST');
 assert.deepEqual(JSON.parse(post.init.body),{action:'opened',token});
 assert.equal(post.init.headers.apikey,'sb_publishable_test');assert.equal(post.init.headers['X-SYNK-Product'],'world');
 assert.deepEqual(w.opened,[`${SCOPE}?reminder=exam&opening=off&ack=${token}`]);
 // 이미 열린 창: 그 창에 알리고 앞으로, 새 창은 열지 않는다.
 const messages=[];let focused=0;
 w=worker({windows:[{url:'https://synk.im/world/mobile.html',postMessage:message=>messages.push(message),focus:()=>{focused++;return Promise.resolve();}}]});
 await w.fire('notificationclick',{notification:{data:{kind:'review',token},close(){}}});
 assert.deepEqual(messages.map(message=>({...message})),[{type:'synk-world-reminder-open',kind:'review',token}]);assert.equal(focused,1);assert.deepEqual(w.opened,[]);
 // 토큰이 없으면 서버를 부르지 않는다. 다른 출처 창은 무시한다.
 w=worker({windows:[{url:'https://evil.example/world/',postMessage(){throw new Error('no');},focus(){throw new Error('no');}}]});
 await w.fire('notificationclick',{notification:{data:{kind:'plan'},close(){}}});
 assert.equal(w.fetches.length,0);assert.deepEqual(w.opened,[`${SCOPE}?reminder=plan&opening=off`]);
 // 워커는 가져오기(fetch)를 가로채지 않는다.
 assert.equal(w.handlers.fetch,undefined);
});

import {afterEach} from 'node:test';
// 판 시험이 만든 push는 시험마다 정리한다 — 단언이 실패해도 다시 보내기 타이머가 남아 시험 러너가 끝나지 않는 일이 없게.
const madeV=[];const makeV=(...args)=>{const push=make(...args);madeV.push(push);return push;};
afterEach(()=>{for(const push of madeV.splice(0))push.dispose();});
// ── 쓰기 판(SYNK-appsscript 단계4_계획 §24-6의 5, 설계 주인 11-21) — 서버가 판으로 옛 쓰기를 거절하고, 기기는 받을 때까지 다시 보낸다 ──
// 판을 아는 가짜 서버(talk world-push의 판 견주기 꼴): 설정 · 요약 · 복습 때 판이 더 클 때만 받고, 응답에 판 · 받음 · 서버 시각을 싣는다.
// hold면 sync를 붙잡아 두었다가 풀 때 닿은 것으로 쓴다(늦게 닿은 요청). failWhen(action, body)이 오류를 돌려주면 그 요청은 서버에 닿지 않는다.
function versionedServer({clock=()=>Date.UTC(2026,9,22,3),settings={frequency:2,hour:null,since:null},versions={settings:null,digest:null,reviews:null}}={}){
 const calls=[],held=[],stored={settings:{...settings},versions:{...versions},digest:null};let hold=false,active=true,failWhen=()=>null;
 const view=()=>({frequency:stored.settings.frequency,hour:stored.settings.hour,since:stored.settings.since,next:1,log:[]});
 const reply=extra=>({ok:true,accountId:'acc-1',enabled:true,publicKey:KEY,device:{subscribed:true,deviceId:'dev-1'},account:{active,devices:active?1:0},
  plan:active?view():null,versions:active?{...stored.versions}:null,serverTime:clock(),...extra});
 function apply(body){
  const now=clock(),applied={settings:false,digest:false,reviews:false},v=body.versions||{};
  const at=(given,current)=>given===undefined?Math.max(now,(current??0)+1):given;
  if(body.settings){const sv=at(v.settings,stored.versions.settings);if(sv>(stored.versions.settings??0)){stored.settings={...stored.settings,...body.settings,since:now};stored.versions.settings=sv;applied.settings=true;}}
  if(body.digest){const dv=at(v.digest,stored.versions.digest);
   if(dv>(stored.versions.digest??0)){stored.digest=body.digest;stored.versions.digest=dv;applied.digest=true;}
   if(Array.isArray(body.digest.reviews)&&dv>(stored.versions.reviews??0)){stored.versions.reviews=dv;applied.reviews=true;}}
  return applied;
 }
 const arrive=body=>active?reply({applied:apply(body)}):reply({applied:{settings:false,digest:false,reviews:false}});
 const request=(action,body={},options={})=>{
  calls.push({action,body,options});
  const error=failWhen(action,body);if(error)return Promise.reject(error);
  if(Object.values(body.versions||{}).some(value=>value>clock()+30000))return Promise.reject(fault(409,'VERSION_AHEAD'));
  if(action==='status')return Promise.resolve(reply({}));
  if(action==='sync'){
   if(hold)return new Promise(resolve=>held.push(()=>resolve(arrive(body))));
   return Promise.resolve(arrive(body));
  }
  return Promise.reject(new Error('unknown'));
 };
 return {calls,held,stored,request,anonymous:()=>Promise.resolve({ok:true,removed:true}),syncs:()=>calls.filter(call=>call.action==='sync'),
  set hold(value){hold=value;},set active(value){active=value;},set failWhen(value){failWhen=value;}};
}
// 1단 설정(이 브라우저의 localStorage — 탭이 함께 쓴다)의 가짜: read는 지금 값, adopt는 서버 설정을 들인 것을 적는다.
function reminderSettings(start={frequency:2,hour:null,since:null}){
 let value={...start};const adopted=[];
 return {read:()=>({...value}),adopt:next=>{adopted.push(next);value={...value,...next};},set:patch=>{value={...value,...patch};},get value(){return value;},adopted};
}
const fault=(status,code)=>Object.assign(Error(code),{code,status});
const settled=()=>new Promise(resolve=>setTimeout(resolve,5));
const VERSIONS_OF=storage=>JSON.parse(storage.getItem('synk.world.push.versions.v1.acc-1')||'null');

test('판: 판을 모르는 서버(응답에 serverTime 없음)에는 versions를 싣지 않는다 — 함수를 되돌려도 지금처럼 돈다(설계 검토 P2-4)',async()=>{
 const b=browser({registered:true,subscribed:'https://fcm.googleapis.com/fcm/send/x'}),s=server({device:true,active:true}),push=makeV(b,s);
 await push.setAccount('acc-1');
 push.sync({settings:{frequency:1,hour:9}});push.sync({digest:{reviews:[1],examDate:null,planWeek:null,lastStudyDay:'2026-10-21',studyHour:null,lang:'ko',timeZone:'Asia/Seoul'}});
 await flush();
 const bodies=s.calls.filter(call=>call.action==='sync').map(call=>call.body);
 assert.equal(bodies.length,2);assert.ok(bodies.every(body=>!('versions' in body)),JSON.stringify(bodies));
 assert.equal(push.snapshot().versioning,false);
});

test('판: 닫은 탭의 늦은 옛 설정은 다른 탭의 뒤 설정을 덮지 않는다 — 같은 브라우저의 탭은 가장 큰 판 + 1로 차례가 선다(GPT r4 GA1 재현)',async()=>{
 let time=Date.UTC(2026,9,22,3);
 const s=versionedServer({clock:()=>time}),storage=memory(),rem=reminderSettings();
 const tabA=makeV(browser({registered:true,subscribed:'https://fcm.googleapis.com/fcm/send/x'}),s,{storage,now:()=>time});
 const tabB=makeV(browser({registered:true,subscribed:'https://fcm.googleapis.com/fcm/send/x'}),s,{storage,now:()=>time});
 tabA.bindSettings(rem);tabB.bindSettings(rem);
 await tabA.setAccount('acc-1');await tabB.setAccount('acc-1');
 s.hold=true;rem.set({hour:9});tabA.sync({settings:{frequency:2,hour:9}});s.hold=false;
 time+=1000;rem.set({hour:20});tabB.sync({settings:{frequency:2,hour:20}});await settled();
 assert.equal(s.stored.settings.hour,20);
 tabA.dispose();
 s.held.shift()();await settled();
 assert.equal(s.stored.settings.hour,20,'늦게 닿은 9시는 판이 작아 버려진다');
 const [late,later]=s.syncs().map(call=>call.body.versions.settings);assert.ok(later>late,`뒤 탭의 판이 크다(${late} → ${later})`);
});

test('판: 기기 시계가 뒤로 가도 뒤에 바꾼 설정이 이긴다 — 앞 요청의 응답이 오기 전이어도 새 판은 이 브라우저에서 매긴 가장 큰 판보다 1 크다',async()=>{
 const serverTime=Date.UTC(2026,9,22,3);let device=serverTime;
 const s=versionedServer({clock:()=>serverTime}),storage=memory(),rem=reminderSettings();
 const push=makeV(browser({registered:true,subscribed:'https://fcm.googleapis.com/fcm/send/x'}),s,{storage,now:()=>device});
 push.bindSettings(rem);await push.setAccount('acc-1');
 s.hold=true;rem.set({hour:9});push.sync({settings:{frequency:2,hour:9}});s.hold=false;   // 앞 요청은 늦게 닿는다
 device-=5000;   // 기기 시계를 5초 뒤로 맞췄다(시계 차이는 그대로 — 아직 다시 재지 않았다)
 rem.set({hour:20});push.sync({settings:{frequency:2,hour:20}});await settled();
 for(const release of s.held.splice(0))release();await settled();
 assert.equal(s.stored.settings.hour,20,'뒤에 바꾼 20시가 남는다(늦게 닿은 9시는 판이 작다)');
 const [first,second]=s.syncs().map(call=>call.body.versions.settings);assert.ok(second>first,`${first} → ${second}`);
});

test('판: 보내지 못하고 닫은 설정은 다음에 열 때 맞추기가 보낸다(GPT r4 GA3 · GA5 재현 — 토큰 갱신 중 닫음)',async()=>{
 const time=Date.UTC(2026,9,22,3),s=versionedServer({clock:()=>time}),storage=memory(),rem=reminderSettings();
 const first=makeV(browser({registered:true,subscribed:'https://fcm.googleapis.com/fcm/send/x'}),s,{storage,now:()=>time});first.bindSettings(rem);
 await first.setAccount('acc-1');
 s.failWhen=action=>action==='sync'?fault(0,'PUSH_UNAVAILABLE'):null;
 rem.set({hour:20});first.sync({settings:{frequency:2,hour:20}});await settled();first.dispose();
 assert.equal(s.stored.settings.hour,null,'서버에 닿지 않았다');
 s.failWhen=()=>null;
 const next=makeV(browser({registered:true,subscribed:'https://fcm.googleapis.com/fcm/send/x'}),s,{storage,now:()=>time});next.bindSettings(rem);
 await next.setAccount('acc-1');await settled();
 assert.equal(s.stored.settings.hour,20,'다음에 연 탭이 이 브라우저 판이 크다고 보고 보낸다');
 assert.equal(VERSIONS_OF(storage).settings,s.stored.versions.settings);
});

test('판: 다른 기기의 새 설정을 1단 설정에 들이고, 이 기기에서 횟수만 바꿔도 시각은 서버 값으로 남는다(설계 검토 P1-1)',async()=>{
 const time=Date.UTC(2026,9,22,3),s=versionedServer({clock:()=>time,settings:{frequency:2,hour:20,since:time-1000},versions:{settings:time-1000,digest:null,reviews:null}});
 const storage=memory(),rem=reminderSettings({frequency:2,hour:9,since:null}),push=makeV(browser({registered:true,subscribed:'https://fcm.googleapis.com/fcm/send/x'}),s,{storage,now:()=>time});
 push.bindSettings(rem);await push.setAccount('acc-1');
 assert.deepEqual(rem.adopted,[{frequency:2,hour:20,since:time-1000}],'서버 판이 크고 내용이 달라 들였다');
 assert.equal(s.syncs().length,0,'들일 때는 보내지 않는다');
 rem.set({frequency:1});push.sync({settings:{frequency:1,hour:rem.value.hour}});await settled();
 assert.deepEqual([s.stored.settings.frequency,s.stored.settings.hour],[1,20]);
});

test('판: 판이 같고 내용이 다른 두 탭 — 서버가 앞의 것만 받았으면 뒤의 탭은 응답의 설정을 들인다(설계 주인 11-21 조건 1)',async()=>{
 const time=Date.UTC(2026,9,22,3),V=time-500;
 const s=versionedServer({clock:()=>time,settings:{frequency:2,hour:9,since:V},versions:{settings:V,digest:null,reviews:null}});
 const storage=memory();storage.setItem('synk.world.push.versions.v1.acc-1',JSON.stringify({issued:V,settings:V}));
 const rem=reminderSettings({frequency:2,hour:20,since:V}),push=makeV(browser({registered:true,subscribed:'https://fcm.googleapis.com/fcm/send/x'}),s,{storage,now:()=>time});
 push.bindSettings(rem);await push.setAccount('acc-1');
 assert.deepEqual(rem.adopted,[{frequency:2,hour:9,since:V}],'같은 판이어도 내용이 다르면 서버 설정을 들인다');
 assert.equal(s.syncs().length,0,'같은 판은 다시 보내지 않는다');
});

test('판: 기기 시계가 한 시간 앞서 서버가 판을 409로 거절하면, 시계를 다시 재고 새 판으로 한 번 보낸다 — 앞선 판이 남지 않는다(설계 검토 P1-2 · GPT push-versions-talk GA1)',async t=>{
 const serverTime=Date.UTC(2026,9,22,3);let device=serverTime;
 const s=versionedServer({clock:()=>serverTime}),storage=memory(),rem=reminderSettings(),push=makeV(browser({registered:true,subscribed:'https://fcm.googleapis.com/fcm/send/x'}),s,{storage,now:()=>device});
 push.bindSettings(rem);await push.setAccount('acc-1');
 t.mock.timers.enable({apis:['setTimeout']});
 device+=3600000;rem.set({hour:18});push.sync({settings:{frequency:2,hour:18}});
 for(let i=0;i<6;i++)await flush();
 assert.equal(s.stored.settings.hour,18,'다시 잰 뒤 새 판으로 받혔다');
 assert.ok(s.stored.versions.settings<=serverTime+30000,`서버 판이 앞서지 않는다(${s.stored.versions.settings-serverTime}ms)`);
 assert.ok(VERSIONS_OF(storage).issued<=serverTime+30000,'이 브라우저의 가장 큰 판도 앞서지 않는다');
 const sent=s.syncs().length;
 t.mock.timers.tick(60*60000);await flush();
 assert.equal(s.syncs().length,sent,'받혔으면 더 보내지 않는다');
 assert.equal(s.syncs().filter(call=>call.body.versions?.settings>serverTime+30000).length,1,'앞선 판은 한 번만 나갔다');
});

test('판: 요약이 400이면 그 요약은 버리고 설정만 다시 보낸다 · 2단이 꺼진 계정 응답이면 다시 보내기를 멈춘다(설계 검토 P2-1 · P2-2)',async t=>{
 const time=Date.UTC(2026,9,22,3),s=versionedServer({clock:()=>time}),rem=reminderSettings(),push=makeV(browser({registered:true,subscribed:'https://fcm.googleapis.com/fcm/send/x'}),s,{now:()=>time});
 push.bindSettings(rem);await push.setAccount('acc-1');
 const digest={reviews:[1],examDate:null,planWeek:{start:1,end:2},lastStudyDay:'2026-10-21',studyHour:null,lang:'ko',timeZone:'Asia/Seoul'};
 s.failWhen=(action,body)=>action==='sync'&&body.digest?fault(400,'INVALID_DIGEST'):null;
 s.hold=true;push.sync({digest});s.hold=false;   // 요약을 모아 둔 채로
 rem.set({hour:12});push.sync({settings:{frequency:2,hour:12}});await settled();
 const bodies=s.syncs().map(call=>Object.keys(call.body).filter(key=>key!=='versions').sort().join(','));
 assert.ok(bodies.includes('settings'),`설정만 다시 간다: ${JSON.stringify(bodies)}`);assert.equal(s.stored.settings.hour,12);
 s.failWhen=()=>null;
 t.mock.timers.enable({apis:['setTimeout']});
 s.active=false;rem.set({hour:15});push.sync({settings:{frequency:2,hour:15}});await flush();
 const count=s.syncs().length;
 t.mock.timers.tick(2*3600000);await flush();
 assert.equal(s.syncs().length,count,'꺼진 계정에는 다시 보내지 않는다');
});

test('판: 실패 → 오류 → 1단 다시 잡기에서 같은 요약을 다시 보내지 않고, 다시 보내기는 15초 · 1분 간격으로만 간다(설계 검토 P2-3)',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const time=Date.UTC(2026,9,22,3),s=versionedServer({clock:()=>time}),push=makeV(browser({registered:true,subscribed:'https://fcm.googleapis.com/fcm/send/x'}),s,{now:()=>time});
 await push.setAccount('acc-1');
 const digest={reviews:[1],examDate:null,planWeek:null,lastStudyDay:'2026-10-21',studyHour:null,lang:'ko',timeZone:'Asia/Seoul'};
 s.failWhen=action=>action==='sync'?fault(503,'SERVER_UNAVAILABLE'):null;
 push.sync({digest});await flush();
 assert.equal(push.snapshot().error,'SERVER_UNAVAILABLE');
 for(let i=0;i<5;i++){push.sync({digest});await flush();}
 assert.equal(s.syncs().length,1,'다시 잡기가 같은 요약을 다시 보내지 않는다');
 t.mock.timers.tick(15000);await flush();assert.equal(s.syncs().length,2,'15초 뒤 한 번');
 t.mock.timers.tick(59000);await flush();assert.equal(s.syncs().length,2);
 s.failWhen=()=>null;t.mock.timers.tick(1000);await flush();assert.equal(s.syncs().length,3,'1분 뒤 한 번');
 assert.equal(s.stored.digest?.lastStudyDay,'2026-10-21');
 t.mock.timers.tick(3600000);await flush();assert.equal(s.syncs().length,3,'받혔으면 멈춘다');
});

test('판: 상태를 몰랐을 때 바꾼 설정은 상태가 선 뒤 보낸다 · 떠날 때는 기다림 없이 보낸다 · 로그아웃은 판 키를 지운다(설계 검토 P2-7 · P2-5)',async()=>{
 const time=Date.UTC(2026,9,22,3),s=versionedServer({clock:()=>time}),storage=memory(),rem=reminderSettings();
 const push=makeV(browser({registered:true,subscribed:'https://fcm.googleapis.com/fcm/send/x'}),s,{storage,now:()=>time});push.bindSettings(rem);
 s.failWhen=action=>action==='status'?fault(0,'PUSH_UNAVAILABLE'):null;
 await push.setAccount('acc-1');assert.equal(push.snapshot().account.active,false);
 rem.set({hour:18});push.sync({settings:{frequency:2,hour:18}});
 assert.equal(s.syncs().length,0);assert.equal(VERSIONS_OF(storage).dirtyAt,time,'바꾼 때를 적어 둔다');
 s.failWhen=()=>null;await push.refresh();await settled();
 assert.equal(s.stored.settings.hour,18,'상태가 선 뒤 맞추기가 보낸다');assert.equal(VERSIONS_OF(storage).dirtyAt,null);
 s.hold=true;rem.set({hour:20});push.sync({settings:{frequency:2,hour:20}});const sent=s.syncs().length;
 const digest={reviews:[2],examDate:null,planWeek:null,lastStudyDay:'2026-10-22',studyHour:null,lang:'ko',timeZone:'Asia/Seoul'};
 push.sync({digest});push.sync({digest:{...digest,reviews:[3]}});   // 하나는 바로, 하나는 5분 모으기
 const before=s.syncs().length;push.flush();
 assert.equal(s.syncs().length,before+1,'떠날 때 모은 요약이 기다림 없이(같은 차례에서) 나간다');
 assert.equal(s.syncs().at(-1).options.leaving,true);assert.ok(sent>=1);
 for(const release of s.held.splice(0))release();await settled();
 await push.logout();assert.equal(storage.getItem('synk.world.push.versions.v1.acc-1'),null);
});

test('판: 시계가 움직였으면 status로 다시 재되, 계정마다 5분에 한 번만(설계 주인 11-21 조건 3)',async()=>{
 let time=Date.UTC(2026,9,22,3),perf=1000;
 const b=browser({registered:true,subscribed:'https://fcm.googleapis.com/fcm/send/x',extra:{performance:{now:()=>perf}}});
 const s=versionedServer({clock:()=>time}),push=makeV(b,s,{now:()=>time});
 await push.setAccount('acc-1');
 const statuses=()=>s.calls.filter(call=>call.action==='status').length,first=statuses();
 time+=10*60000;   // 휴대폰이 잠든 동안 performance.now()가 멈췄다 — 닻이 10분 움직인 것으로 보인다
 push.sync({settings:{frequency:1,hour:9}});await settled();
 assert.equal(statuses(),first+1,'움직인 시계를 한 번 다시 잰다');
 time+=60000;push.sync({settings:{frequency:2,hour:9}});await settled();
 assert.equal(statuses(),first+1,'5분 안에는 다시 재지 않는다');
});
