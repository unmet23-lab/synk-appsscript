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
 const calls=[],held=[],stored={settings:{...settings},versions:{...versions},digest:null,startedAt:clock()-3600000};let hold=false,active=true,failWhen=()=>null;
 const view=()=>({frequency:stored.settings.frequency,hour:stored.settings.hour,since:stored.settings.since,startedAt:stored.startedAt,next:1,log:[]});
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
 // sync 응답에는 기기 칸이 없다(talk world-push sync).
 const arrive=body=>{const {device,...rest}=active?reply({applied:apply(body)}):reply({applied:{settings:false,digest:false,reviews:false}});return rest;};
 const request=(action,body={},options={})=>{
  calls.push({action,body,options});
  const error=failWhen(action,body);if(error)return Promise.reject(error);
  if(Object.values(body.versions||{}).some(value=>value>clock()+30000))return Promise.reject(fault(409,'VERSION_AHEAD'));
  if(action==='status')return Promise.resolve(reply({}));
  if(action==='sync'){
   if(hold)return new Promise(resolve=>held.push(()=>resolve(arrive(body))));
   return Promise.resolve(arrive(body));
  }
  // 켜기: 처음 켜는 계정이면 받은 설정 · 요약으로 새 계획(판이 없으면 받은 때), 이미 켠 계정이면 설정은 계정 것을 두고 요약만 판으로 견준다(talk subscribe).
  if(action==='subscribe'){
   const v=body.versions||{},now=clock();
   if(!active){
    active=true;stored.startedAt=now;stored.settings={...stored.settings,...body.settings,since:now};stored.versions.settings=v.settings??now;
    if(body.digest){stored.digest=body.digest;stored.versions.digest=v.digest??now;if(Array.isArray(body.digest.reviews))stored.versions.reviews=v.digest??now;}
    return Promise.resolve(reply({applied:{settings:true,digest:!!body.digest,reviews:Array.isArray(body.digest?.reviews)}}));
   }
   return Promise.resolve(reply({applied:apply({digest:body.digest,versions:v.digest===undefined?{}:{digest:v.digest}})}));
  }
  // 끄기: 이 가짜는 기기 하나 — 마지막 기기라 계정의 2단이 꺼지고 설정을 돌려준다.
  if(action==='unsubscribe'){active=false;const settings={...stored.settings};stored.versions={settings:null,digest:null,reviews:null};return Promise.resolve({ok:true,accountId:'acc-1',removed:true,account:{active:false,devices:0},handover:[],settings});}
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
 assert.equal(VERSIONS_OF(storage).settings,null,'받혔으면 덩어리를 비운다(덩어리는 보내지 못한 편집만 뜻한다)');
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
 const storage=memory();storage.setItem('synk.world.push.versions.v1.acc-1',JSON.stringify({issued:V,settings:{frequency:2,hour:20,version:V,at:null}}));
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
 assert.equal(s.syncs().length,0);assert.equal(VERSIONS_OF(storage).settings.at,time,'바꾼 때를 적어 둔다');
 s.failWhen=()=>null;await push.refresh();await settled();
 assert.equal(s.stored.settings.hour,18,'상태가 선 뒤 맞추기가 보낸다');assert.equal(VERSIONS_OF(storage).settings,null,'받혀 덩어리를 비웠다');
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

// ── 기기 판 설계 관문(11-21, 공유 노트 world-push-device-versions-design.md) — GPT push-versions-world GA1~GA12 재현과 설계 검토(Opus 5.5) 지킴 ──
const SUB='https://fcm.googleapis.com/fcm/send/x';
const DIGEST=(day,reviews=[1])=>({reviews,examDate:null,planWeek:null,lastStudyDay:day,studyHour:null,lang:'ko',timeZone:'Asia/Seoul'});
// 손으로 푸는 sync: 부를 때마다 줄에 선다. pass()는 그때 서버에 닿게 하고 응답을 돌려주고, late()는 지금 서버에 닿게 하되 응답은 돌려준 함수를 부를 때
// 돌려주고, fail(오류)는 서버에 닿지 않는다. sync가 아닌 동작은 바로 서버로 간다.
function manual(s){
 const queue=[];
 const request=(action,body={},options={})=>{
  if(action!=='sync')return s.request(action,body,options);
  return new Promise((resolve,reject)=>{queue.push({body,options,pass:()=>resolve(s.request(action,body,options)),fail:error=>reject(error),
   late:()=>{const reply=s.request(action,body,options);return ()=>resolve(reply);}});});
 };
 return {queue,request};
}

test('판: 떠날 때 1단의 모으던 다시 잡기가 낸 요약도 떠남으로 가고, 토큰 갱신을 기다리던 요청은 떠나며 다시 보낸다(GPT push-versions-world GA1)',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const time=Date.UTC(2026,9,22,3),s=versionedServer({clock:()=>time});
 // 토큰이 곧 끝나 평소 요청은 갱신을 기다린다(떠나면 계정 정리가 그 갱신을 끊어 나가지 않는다). 떠남 요청은 지금 토큰으로 바로 나간다.
 let attempts=0;const request=(action,body={},options={})=>{if(action==='sync')attempts++;if(action==='sync'&&!options.leaving){options.onWait?.();return new Promise(()=>{});}return s.request(action,body,options);};
 const push=makeV(browser({registered:true,subscribed:SUB}),s,{now:()=>time,request});
 await push.setAccount('acc-1');
 push.flush(()=>push.sync({digest:DIGEST('2026-10-22')}));await flush();
 assert.equal(s.stored.digest?.lastStudyDay,'2026-10-22','떠나는 중에 1단이 낸 요약이 떠남으로 나갔다');
 assert.equal(attempts,1,'처음부터 떠남으로 나가 두 번 보내지 않았다');
 push.sync({digest:DIGEST('2026-10-23')});await flush();
 assert.equal(s.stored.digest.lastStudyDay,'2026-10-22','평소 요청은 토큰 갱신을 기다린다');
 push.flush();await flush();
 assert.equal(s.stored.digest.lastStudyDay,'2026-10-23','기다리던 요약을 떠나며 다시 보냈다');
 push.sync({settings:{frequency:1,hour:9}});await flush();
 assert.equal(s.stored.settings.frequency,2,'평소 설정 요청도 토큰 갱신을 기다린다');
 push.flush();await flush();
 assert.equal(s.stored.settings.frequency,1,'기다리던 설정을 떠나며 다시 보냈다');
 assert.ok(s.syncs().every(call=>call.options.leaving===true));
});

test('판: 설정 값과 판은 한 덩어리로 나간다 — 다른 탭이 새 설정을 적은 뒤 다시 보내도 옛 값에 새 판이 붙지 않고, 다른 탭의 로그아웃은 보내지 못한 편집을 지우지 않는다(GPT push-versions-world GA2 · 설계 검토 5)',async()=>{
 let time=Date.UTC(2026,9,22,3);
 const s=versionedServer({clock:()=>time}),storage=memory(),rem=reminderSettings();
 const tabA=makeV(browser({registered:true,subscribed:SUB}),s,{storage,now:()=>time}),tabB=makeV(browser({registered:true,subscribed:SUB}),s,{storage,now:()=>time});
 tabA.bindSettings(rem);tabB.bindSettings(rem);
 await tabA.setAccount('acc-1');await tabB.setAccount('acc-1');
 s.failWhen=action=>action==='sync'?fault(0,'PUSH_UNAVAILABLE'):null;
 rem.set({hour:9});tabA.sync({settings:{frequency:2,hour:9}});await settled();
 time+=1000;rem.set({hour:20});tabB.sync({settings:{frequency:2,hour:20}});await settled();
 await tabB.logout();
 assert.equal(VERSIONS_OF(storage)?.settings?.hour,20,'보내지 못한 편집이 남는다');
 s.failWhen=()=>null;tabA.retry();await settled();
 assert.equal(s.stored.settings.hour,20,'A가 다시 보낸 것은 덩어리의 20시다');
 const sent=s.syncs().filter(call=>call.body.settings).map(call=>[call.body.settings.hour,call.body.versions?.settings]);
 const nine=sent.filter(([hour])=>hour===9).map(([,v])=>v),twenty=sent.filter(([hour])=>hour===20).map(([,v])=>v);
 assert.ok(sent.every(([,v])=>Number.isSafeInteger(v)),JSON.stringify(sent));
 assert.ok(Math.max(...nine)<Math.min(...twenty),`9시에 20시의 판이 붙지 않는다: ${JSON.stringify(sent)}`);
});

test('판: 켜기는 바꾸지 않은 기본 설정에 판을 매기지 않는다 — 권한 창이 떠 있는 동안 다른 기기가 켜고 저장한 설정이 남는다(GPT push-versions-world GA3)',async()=>{
 let time=Date.UTC(2026,9,22,3);
 const s=versionedServer({clock:()=>time});s.active=false;
 const b=browser({answer:'hang'}),rem=reminderSettings(),push=makeV(b,s,{now:()=>time});push.bindSettings(rem);
 await push.setAccount('acc-1');await push.ready();
 const on=push.enable({settings:{frequency:2,hour:null,since:null},digest:DIGEST('2026-10-21')});
 time+=1000;s.active=true;s.stored.settings={frequency:2,hour:20,since:time};s.stored.versions.settings=time;
 time+=1000;b.resolvePrompt();await on;await settled();
 assert.equal(push.snapshot().device.subscribed,true);
 assert.equal(s.stored.settings.hour,20,'다른 기기의 20시가 남는다');
 assert.equal(rem.value.hour,20,'이 기기는 계정 설정을 들인다');
 assert.equal(s.syncs().filter(call=>call.body.settings).length,0,'기본 설정을 다시 보내지 않는다');
 assert.equal(s.calls.find(call=>call.action==='subscribe').body.versions?.settings,undefined);
});

test('판: 켜기의 요약 판은 누른 그때 매긴다 — 권한 창이 떠 있는 동안 다른 기기가 보낸 더 새 요약을 덮지 않는다(GPT push-versions-world GA4)',async()=>{
 let time=Date.UTC(2026,9,22,3);
 const s=versionedServer({clock:()=>time}),b=browser({answer:'hang'}),push=makeV(b,s,{now:()=>time});
 await push.setAccount('acc-1');await push.ready();
 const on=push.enable({settings:{frequency:2,hour:null,since:null},digest:DIGEST('2026-10-21')});
 time+=1000;await s.request('sync',{digest:DIGEST('2026-10-22'),versions:{digest:time}});
 time+=1000;b.resolvePrompt();await on;await settled();
 assert.equal(push.snapshot().device.subscribed,true);
 assert.equal(s.stored.digest.lastStudyDay,'2026-10-22','권한 창 사이에 온 오늘 공부 요약이 남는다');
});

test('판: 끄기 전에 서버가 처리한 요약의 늦은 응답이 끄기 뒤에 와도 「켜짐」으로 되돌리지 않고, 요약 응답은 이 기기 상태를 바꾸지 않는다(GPT push-versions-world GA5 · 설계 검토 3)',async()=>{
 const time=Date.UTC(2026,9,22,3),s=versionedServer({clock:()=>time}),m=manual(s);
 const push=makeV(browser({registered:true,subscribed:SUB}),s,{now:()=>time,request:m.request});
 await push.setAccount('acc-1');
 assert.equal(push.snapshot().device.subscribed,true);
 push.sync({digest:DIGEST('2026-10-22')});await flush();m.queue.shift().pass();await settled();
 assert.equal(push.snapshot().device.subscribed,true,'요약 응답에는 기기 칸이 없다 — 이 기기는 켜진 그대로다');
 push.sync({digest:DIGEST('2026-10-23')});await flush();
 const release=m.queue.shift().late();
 await push.disable();
 release();await settled();
 assert.equal(push.snapshot().account.active,false,'늦은 응답이 계정을 다시 켜지 않는다');
 assert.equal(push.snapshot().device.subscribed,false);
});

test('판: 늦게 온 옛 9시 응답은 뒤 20시를 보낼 일을 지우지 못한다(GPT push-versions-world GA6)',async()=>{
 let time=Date.UTC(2026,9,22,3);
 const s=versionedServer({clock:()=>time}),m=manual(s),rem=reminderSettings();
 const push=makeV(browser({registered:true,subscribed:SUB}),s,{now:()=>time,request:m.request});push.bindSettings(rem);
 await push.setAccount('acc-1');
 rem.set({hour:9});push.sync({settings:{frequency:2,hour:9}});
 time+=1000;rem.set({hour:20});push.sync({settings:{frequency:2,hour:20}});
 push.sync({digest:DIGEST('2026-10-22')});push.flush();await flush();
 const [nine,twenty,digest]=m.queue.splice(0);
 assert.deepEqual([nine.body.settings?.hour,twenty.body.settings?.hour,digest.body.settings],[9,20,undefined]);
 digest.pass();await settled();twenty.fail(fault(0,'PUSH_UNAVAILABLE'));await settled();nine.pass();await settled();
 push.retry();await flush();
 while(m.queue.length){m.queue.shift().pass();await settled();}
 assert.equal(s.stored.settings.hour,20,'20시를 다시 보냈다');
});

test('판: 기기 시계를 뒤로 맞춘 뒤 바꾼 설정도 이긴다 — 닻이 뒤로 간 만큼 시계 차이를 바로 고친다(GPT push-versions-world GA7)',async()=>{
 let server=Date.UTC(2026,9,22,3),device=server,perf=1000;
 const b=browser({registered:true,subscribed:SUB,extra:{performance:{now:()=>perf}}});
 const s=versionedServer({clock:()=>server}),rem=reminderSettings(),push=makeV(b,s,{now:()=>device});push.bindSettings(rem);
 await push.setAccount('acc-1');
 server+=1000;device+=1000;perf+=1000;
 s.stored.settings={frequency:2,hour:9,since:server};s.stored.versions.settings=server;
 server+=1000;device+=1000-10*60000;perf+=1000;
 rem.set({hour:20});push.sync({settings:{frequency:2,hour:20}});await settled();
 assert.equal(s.stored.settings.hour,20);
 assert.equal(rem.value.hour,20,'9시로 돌아가지 않는다');
});

test('판: 앞선 요약이 409로 거절되면 다시 잰 뒤 같은 요약을 다시 보낸다(GPT push-versions-world GA8)',async()=>{
 const server=Date.UTC(2026,9,22,3);let device=server;
 const s=versionedServer({clock:()=>server}),push=makeV(browser({registered:true,subscribed:SUB}),s,{now:()=>device});
 await push.setAccount('acc-1');
 device+=3600000;push.sync({digest:DIGEST('2026-10-22')});await settled();
 assert.ok(s.syncs()[0].body.versions.digest>server+30000,'앞선 판으로 한 번 거절됐다');
 assert.equal(s.stored.digest?.lastStudyDay,'2026-10-22','들고 있던 요약을 다시 잰 뒤 보냈다');
 assert.ok(s.stored.versions.digest<=server+30000,'다시 잰 판이다');
});

test('판: 첫 상태 읽기가 실패한 탭도 망이 돌아오면 상태를 읽고 바꾼 설정을 보낸다(GPT push-versions-world GA9)',async()=>{
 const time=Date.UTC(2026,9,22,3),s=versionedServer({clock:()=>time}),rem=reminderSettings();
 const push=makeV(browser({registered:true,subscribed:SUB}),s,{now:()=>time});push.bindSettings(rem);
 s.failWhen=action=>action==='status'?fault(0,'PUSH_UNAVAILABLE'):null;
 await push.setAccount('acc-1');
 rem.set({hour:18});push.sync({settings:{frequency:2,hour:18}});
 s.failWhen=()=>null;push.retry();await settled();
 assert.equal(s.stored.settings.hour,18);
});

test('판: 판을 아는 서버를 옛 판으로 되돌려도 바꾼 설정은 판 없이 다시 간다(GPT push-versions-world GA10)',async()=>{
 const time=Date.UTC(2026,9,22,3),s=versionedServer({clock:()=>time}),rem=reminderSettings();let old=false;
 // 옛 서버: 모르는 칸 versions를 400 INVALID_ACTION으로 거절하고, 응답에 판 · 서버 시각이 없다.
 const request=(action,body={},options={})=>{
  if(old&&body.versions){s.calls.push({action,body,options,rejected:true});return Promise.reject(fault(400,'INVALID_ACTION'));}
  return s.request(action,body,options).then(data=>{if(!old)return data;const {serverTime,versions,applied,...rest}=data;return rest;});
 };
 const push=makeV(browser({registered:true,subscribed:SUB}),s,{now:()=>time,request});push.bindSettings(rem);
 await push.setAccount('acc-1');
 old=true;rem.set({hour:20});push.sync({settings:{frequency:2,hour:20}});await settled();
 assert.equal(s.stored.settings.hour,20,'판 없이 다시 보내 받혔다');
 assert.equal(push.snapshot().versioning,false);
 assert.equal(s.syncs().at(-1).body.versions,undefined);
});

test('판: 로그아웃은 보낼 것이 없으면 판 키를 지우고, 늦은 응답 · 계정이 바뀌기 전의 1단 다시 잡기가 판 키를 다시 쓰지 않는다 · 실패하면 막기를 푼다(GPT push-versions-world GA12 · 설계 검토 4)',async()=>{
 const time=Date.UTC(2026,9,22,3),s=versionedServer({clock:()=>time}),m=manual(s),storage=memory(),rem=reminderSettings();
 const push=makeV(browser({registered:true,subscribed:SUB}),s,{storage,now:()=>time,request:m.request});push.bindSettings(rem);
 await push.setAccount('acc-1');
 rem.set({hour:20});push.sync({settings:{frequency:2,hour:20}});await flush();m.queue.shift().pass();await settled();
 assert.equal(VERSIONS_OF(storage)?.settings??null,null,'받혀 덩어리를 비웠다');
 push.sync({digest:DIGEST('2026-10-22')});await flush();const release=m.queue.shift().late();
 await push.logout();
 assert.equal(storage.getItem('synk.world.push.versions.v1.acc-1'),null,'보낼 것이 없어 지웠다');
 const seen=push.snapshot().versions;
 release();await settled();
 assert.equal(storage.getItem('synk.world.push.versions.v1.acc-1'),null,'늦은 응답이 다시 쓰지 않는다');
 assert.deepEqual(push.snapshot().versions,seen,'늦은 응답을 상태로 적지 않는다');
 rem.set({hour:9});push.sync({settings:{frequency:2,hour:9}});await settled();
 assert.equal(storage.getItem('synk.world.push.versions.v1.acc-1'),null,'계정이 바뀌기 전에는 쓰지 않는다');
 assert.equal(m.queue.length,0,'새 요청도 내지 않는다');
 await push.resume();
 push.sync({settings:{frequency:2,hour:9}});await flush();
 assert.equal(m.queue.at(-1)?.body.settings?.hour,9,'로그아웃이 실패하면 다시 보낸다');
});

test('판: 마지막 기기를 끄면 덩어리도 비운다 — 다음 켜기가 옛 설정을 되살리지 않는다(설계 검토 6)',async()=>{
 let time=Date.UTC(2026,9,22,3);
 const s=versionedServer({clock:()=>time}),storage=memory(),rem=reminderSettings();
 const push=makeV(browser({registered:true,subscribed:SUB}),s,{storage,now:()=>time});push.bindSettings(rem);
 await push.setAccount('acc-1');
 rem.set({hour:9});push.sync({settings:{frequency:2,hour:9}});await settled();
 time+=1000;s.stored.settings={frequency:2,hour:20,since:time};s.stored.versions.settings=time;
 const result=await push.disable();rem.set({hour:result.settings.hour});
 assert.equal(VERSIONS_OF(storage)?.settings??null,null,'덩어리를 비웠다');
 time+=1000;await push.ready();await push.enable({settings:{frequency:2,hour:20,since:null}});await settled();
 assert.equal(s.stored.settings.hour,20);assert.equal(rem.value.hour,20);
 assert.equal(s.calls.find(call=>call.action==='subscribe').body.versions?.settings,undefined);
});

test('판: 켜기 안에서는 시계를 다시 재지 않는다 — 권한 창이 떠 있는 동안 status를 부르지 않는다(설계 검토 7)',async()=>{
 let time=Date.UTC(2026,9,22,3),perf=1000;
 const b=browser({answer:'hang',extra:{performance:{now:()=>perf}}}),s=versionedServer({clock:()=>time}),push=makeV(b,s,{now:()=>time});
 await push.setAccount('acc-1');await push.ready();
 const statuses=()=>s.calls.filter(call=>call.action==='status').length,before=statuses();
 time+=10*60000;
 const on=push.enable({settings:{frequency:2,hour:null,since:null},digest:DIGEST('2026-10-21')});
 await flush();await flush();
 assert.equal(statuses(),before,'누른 그때 다시 재지 않는다');
 b.resolvePrompt();await on;
 assert.equal(push.snapshot().device.subscribed,true);
});

test('판: 서버 설정은 판이 가장 큰 응답을 따른다 — 늦게 온 옛 응답이 이미 받힌 설정을 다시 보내게 하지 않는다(설계 관문 2)',async()=>{
 let time=Date.UTC(2026,9,22,3);
 const s=versionedServer({clock:()=>time}),m=manual(s),rem=reminderSettings();
 const push=makeV(browser({registered:true,subscribed:SUB}),s,{now:()=>time,request:m.request});push.bindSettings(rem);
 await push.setAccount('acc-1');
 rem.set({hour:9});push.sync({settings:{frequency:2,hour:9}});await flush();
 const release=m.queue.shift().late();   // 서버는 9시를 먼저 받았고 응답만 늦다
 time+=1000;rem.set({hour:20});push.sync({settings:{frequency:2,hour:20}});await flush();
 m.queue.shift().pass();await settled();
 release();await settled();
 assert.equal(m.queue.length,0,'옛 응답 뒤 20시를 다시 보내지 않는다');
 assert.equal(rem.value.hour,20);assert.equal(s.stored.settings.hour,20);
});

test('판: 기기 시계를 뒤로 맞춰도 모으던 요약은 5분 안에 나간다 — 지난 때는 performance.now()로도 잰다(설계 관문 6)',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 let server=Date.UTC(2026,9,22,3),device=server,perf=1000;
 const b=browser({registered:true,subscribed:SUB,extra:{performance:{now:()=>perf}}});
 const s=versionedServer({clock:()=>server}),push=makeV(b,s,{now:()=>device});
 await push.setAccount('acc-1');
 push.sync({digest:DIGEST('2026-10-22',[1])});await flush();
 server+=60000;device+=60000-3600000;perf+=60000;   // 1분 뒤, 기기 시계를 한 시간 뒤로 맞췄다
 push.sync({digest:DIGEST('2026-10-22',[2])});await flush();
 const sent=s.syncs().length;
 t.mock.timers.tick(4*60000);await flush();
 assert.equal(s.syncs().length,sent+1,'모은 요약이 5분 묶음이 차서 나갔다');
 assert.deepEqual(s.stored.digest.reviews,[2]);
});

test('판: 맞추기가 덩어리를 쓰기 직전에 다시 읽는다 — 그 사이 다른 탭이 적은 더 새 편집을 덮지 않는다(설계 검토 8)',async()=>{
 const time=Date.UTC(2026,9,22,3),V=time-1000;
 const s=versionedServer({clock:()=>time,settings:{frequency:2,hour:20,since:V},versions:{settings:V,digest:null,reviews:null}}),storage=memory();
 const key='synk.world.push.versions.v1.acc-1',newer={frequency:1,hour:9,version:time+10,at:null};
 // 1단에 서버 설정을 들이는 사이 다른 탭이 더 새 편집을 적었다.
 storage.setItem(key,JSON.stringify({issued:V-500,settings:{frequency:2,hour:9,version:V-500,at:null}}));   // 이 브라우저의 옛 편집(서버 판보다 작다)
 const rem=reminderSettings({frequency:2,hour:9,since:null}),adopt=rem.adopt;rem.adopt=value=>{adopt(value);storage.setItem(key,JSON.stringify({issued:newer.version,settings:newer}));};
 const push=makeV(browser({registered:true,subscribed:SUB}),s,{storage,now:()=>time});push.bindSettings(rem);
 await push.setAccount('acc-1');
 assert.equal(rem.adopted.length,1);
 assert.deepEqual(VERSIONS_OF(storage).settings,newer,'다른 탭의 편집이 남는다');
});

test('판: 켜기 전에 시작한 status가 켜기 뒤에 와도 방금 켠 이 브라우저 구독과 주인 기록을 지우지 않는다(설계 검토 7)',async()=>{
 const time=Date.UTC(2026,9,22,3),s=versionedServer({clock:()=>time}),storage=memory(),anonymous=[];let hold=null;
 const request=(action,body={},options={})=>{
  if(action==='status'&&hold){const reply=s.request(action,body,options).then(data=>({...data,device:{subscribed:false}}));return new Promise(resolve=>hold.push(()=>resolve(reply)));}
  return s.request(action,body,options);
 };
 const push=makeV(browser(),s,{storage,now:()=>time,request,anonymous:(action,body)=>{anonymous.push([action,body]);return Promise.resolve({ok:true,removed:true});}});
 await push.setAccount('acc-1');await push.ready();
 hold=[];const reading=push.refresh();await flush();await flush();
 assert.equal(hold.length,1,'status가 붙잡혔다');
 await push.enable({settings:{frequency:2,hour:null,since:null}});
 assert.equal(push.snapshot().device.subscribed,true);
 hold.shift()();hold=null;await reading;await settled();
 assert.ok(storage.getItem('synk.world.push.v1'),'주인 기록이 남는다');
 assert.equal(anonymous.length,0,'로그인 없이 끄지 않았다');
 assert.equal(push.snapshot().device.subscribed,true);
});

// ── 둘째 설계 관문(11-21 밤) — GPT push-versions-world-r2 GA1~GA10 재현 ──
// 옛 서버로 되돌릴 수 있는 가짜: old가 참이면 판을 실은 요청은 400 INVALID_ACTION이고 응답에 판 · 서버 시각이 없다. hold가 참이면 sync를 줄 세운다.
function rollback(s){
 const state={old:false,queue:[],holdSync:false,holdStatus:null,holdUnsubscribe:null};
 const strip=data=>{if(!state.old)return data;const {serverTime,versions,applied,...rest}=data;if(rest.plan){const {startedAt,...plan}=rest.plan;rest.plan=plan;}return rest;};
 const send=(action,body,options)=>{
  if(state.old&&body.versions){s.calls.push({action,body,options,rejected:true});return Promise.reject(fault(400,'INVALID_ACTION'));}
  return s.request(action,body,options).then(strip);
 };
 state.request=(action,body={},options={})=>{
  if(action==='status'&&state.holdStatus){const reply=send(action,body,options);return new Promise((resolve,reject)=>state.holdStatus.push(()=>reply.then(resolve,reject)));}
  if(action==='unsubscribe'&&state.holdUnsubscribe){const reply=send(action,body,options);return new Promise((resolve,reject)=>state.holdUnsubscribe.push(()=>reply.then(resolve,reject)));}
  if(action==='sync'&&state.holdSync)return new Promise((resolve,reject)=>state.queue.push({body,options,go:()=>send(action,body,options).then(resolve,reject)}));
  return send(action,body,options);
 };
 return state;
}

test('판: 옛 서버로 되돌린 뒤 두 편집의 거절이 거꾸로 와도 마지막 편집이 남는다(GPT push-versions-world-r2 GA1 · GA10)',async()=>{
 let time=Date.UTC(2026,9,22,3);
 const s=versionedServer({clock:()=>time}),r=rollback(s),rem=reminderSettings();
 const push=makeV(browser({registered:true,subscribed:SUB}),s,{now:()=>time,request:r.request});push.bindSettings(rem);
 await push.setAccount('acc-1');
 r.old=true;r.holdSync=true;
 rem.set({hour:9});push.sync({settings:{frequency:2,hour:9}});
 time+=1000;rem.set({hour:20});push.sync({settings:{frequency:2,hour:20}});await flush();
 const [nine,twenty]=r.queue.splice(0);r.holdSync=false;
 await twenty.go();await settled();
 await nine.go();await settled();
 assert.equal(s.stored.settings.hour,20,'늦게 온 9시 거절이 9시를 다시 보내지 않는다');
});

test('판: 권한 창 사이에 옛 서버로 되돌려도 켜기는 판 없이 다시 보내 켜진다(GPT push-versions-world-r2 GA2)',async()=>{
 let time=Date.UTC(2026,9,22,3);
 const s=versionedServer({clock:()=>time}),r=rollback(s),b=browser({answer:'hang'});
 const push=makeV(b,s,{now:()=>time,request:r.request});
 await push.setAccount('acc-1');await push.ready();
 const on=push.enable({settings:{frequency:2,hour:null,since:null},digest:DIGEST('2026-10-21')});
 r.old=true;await push.refresh();
 assert.equal(push.snapshot().versioning,false);
 b.resolvePrompt();await on;await settled();
 assert.equal(push.snapshot().device.subscribed,true,'켜졌다');
 assert.equal(s.stored.digest.lastStudyDay,'2026-10-21');
});

test('판: 409 뒤 다시 재는 동안 지은 요약은 판 없이 나가지 않는다 — 다른 기기의 더 새 요약을 덮지 않는다(GPT push-versions-world-r2 GA3 · GA9)',async()=>{
 const server=Date.UTC(2026,9,22,3);let device=server;
 const s=versionedServer({clock:()=>server}),r=rollback(s),push=makeV(browser({registered:true,subscribed:SUB}),s,{now:()=>device,request:r.request});
 await push.setAccount('acc-1');
 device+=3600000;r.holdStatus=[];
 push.sync({digest:DIGEST('2026-10-21')});await settled();
 assert.equal(s.stored.digest,null,'앞선 요약은 거절됐다');
 await s.request('sync',{digest:DIGEST('2026-10-22'),versions:{digest:server+1000}});   // 다른 기기가 오늘 공부를 보냈다
 push.sync({digest:DIGEST('2026-10-21')});await settled();
 assert.equal(s.stored.digest.lastStudyDay,'2026-10-22','다시 재기 전에는 판 없는 요약을 보내지 않는다');
 push.sync({digest:DIGEST('2026-10-23')});await settled();   // 다시 재는 동안 새로 지은 요약(지은 때는 다른 기기 저장보다 앞선다)
 assert.equal(s.stored.digest.lastStudyDay,'2026-10-22','새로 지은 요약도 판 없이 보내지 않는다');
 for(const release of r.holdStatus.splice(0))release();r.holdStatus=null;await settled();
 assert.equal(s.stored.digest.lastStudyDay,'2026-10-22','다시 잰 뒤의 판은 지은 때라 오늘 요약보다 작다');
 assert.ok(s.syncs().filter(call=>call.body.digest&&!call.rejected).every(call=>Number.isSafeInteger(call.body.versions?.digest)),'요약은 늘 판을 싣는다');
});

test('판: 409 뒤 다시 재는 동안 누른 켜기도 판 없는 요약을 싣지 않는다(GPT push-versions-world-r2 GA7)',async()=>{
 const server=Date.UTC(2026,9,22,3);let device=server;
 const s=versionedServer({clock:()=>server}),r=rollback(s),b=browser({answer:'hang'}),push=makeV(b,s,{now:()=>device,request:r.request});
 await push.setAccount('acc-1');await push.ready();
 device+=3600000;r.holdStatus=[];
 push.sync({digest:DIGEST('2026-10-20')});await settled();   // 409 → 다시 재기(붙잡힘)
 const on=push.enable({settings:{frequency:2,hour:null,since:null},digest:DIGEST('2026-10-21')});
 await s.request('sync',{digest:DIGEST('2026-10-22'),versions:{digest:server+1000}});
 b.resolvePrompt();await flush();
 for(const release of r.holdStatus.splice(0))release();r.holdStatus=null;await on;await settled();
 assert.equal(s.stored.digest.lastStudyDay,'2026-10-22','권한 창 사이에 온 오늘 요약이 남는다');
 const subscribe=s.calls.find(call=>call.action==='subscribe');
 assert.ok(!subscribe||Number.isSafeInteger(subscribe.body.versions?.digest),'켜기 요약에 판이 있다');
 assert.ok(s.syncs().some(call=>call.body.digest?.lastStudyDay==='2026-10-21'&&call.body.versions?.digest>1),'누른 요약을 다시 잰 뒤 판으로 보냈다');
});

test('판: 마지막 기기를 끄는 사이 다른 탭이 바꾼 설정은 지우지 않고 1단에도 남긴다(GPT push-versions-world-r2 GA4)',async()=>{
 let time=Date.UTC(2026,9,22,3);
 const s=versionedServer({clock:()=>time,settings:{frequency:2,hour:9,since:null},versions:{settings:time-1000,digest:null,reviews:null}}),r=rollback(s),storage=memory(),rem=reminderSettings({frequency:2,hour:9,since:null});
 const tabA=makeV(browser({registered:true,subscribed:SUB}),s,{storage,now:()=>time,request:r.request}),tabB=makeV(browser({registered:true,subscribed:SUB}),s,{storage,now:()=>time});
 tabA.bindSettings(rem);tabB.bindSettings(rem);
 await tabA.setAccount('acc-1');await tabB.setAccount('acc-1');
 r.holdUnsubscribe=[];const off=tabA.disable();await flush();await flush();
 time+=1000;s.failWhen=action=>action==='sync'?fault(0,'PUSH_UNAVAILABLE'):null;
 rem.set({hour:20});tabB.sync({settings:{frequency:2,hour:20}});await settled();
 for(const release of r.holdUnsubscribe.splice(0))release();r.holdUnsubscribe=null;
 const result=await off;
 assert.equal(VERSIONS_OF(storage)?.settings?.hour,20,'다른 탭의 편집이 남는다');
 assert.equal(result.settings,undefined,'1단에 넣을 서버 설정을 돌려주지 않는다');
});

test('판: 마지막 기기를 끈 뒤 다른 기기가 새 계획을 켜면 이 기기는 새 계획의 설정을 따른다(GPT push-versions-world-r2 GA5)',async()=>{
 let time=Date.UTC(2026,9,22,3);
 const s=versionedServer({clock:()=>time}),storageA=memory(),storageB=memory(),remA=reminderSettings(),remB=reminderSettings({frequency:2,hour:9,since:null});
 const a=makeV(browser({registered:true,subscribed:SUB}),s,{storage:storageA,now:()=>time});a.bindSettings(remA);
 await a.setAccount('acc-1');
 remA.set({hour:20});a.sync({settings:{frequency:2,hour:20}});await settled();
 const old=s.stored.versions.settings;
 await a.disable();remA.set({hour:20});
 // B 기기는 옛 계획 때 바꾸고 보내지 못한 9시를 들고 있다(판이 A의 20시보다 작다).
 storageB.setItem('synk.world.push.versions.v1.acc-1',JSON.stringify({issued:old-5000,settings:{frequency:2,hour:9,version:old-5000,at:null}}));
 time+=60000;
 const bb=browser(),b=makeV(bb,s,{storage:storageB,now:()=>time});b.bindSettings(remB);
 await b.setAccount('acc-1');await b.ready();await b.enable({settings:{frequency:2,hour:9,since:null},digest:DIGEST('2026-10-22')});await settled();
 assert.equal(s.stored.settings.hour,9,'새 계획은 B의 9시로 섰다');
 await a.refresh();await settled();
 assert.equal(remA.value.hour,9,'A는 새 계획의 9시를 들인다');
});

test('판: 켜기가 보낸 결과를 적으며 시작한 설정 응답도 계획 화면에 적힌다(GPT push-versions-world-r2 GA6)',async()=>{
 let time=Date.UTC(2026,9,22,3);
 const s=versionedServer({clock:()=>time,settings:{frequency:2,hour:9,since:null},versions:{settings:time-1000,digest:null,reviews:null}}),rem=reminderSettings({frequency:2,hour:9,since:null});
 const push=makeV(browser(),s,{now:()=>time});push.bindSettings(rem);
 await push.setAccount('acc-1');await push.ready();
 s.failWhen=action=>action==='sync'?fault(0,'PUSH_UNAVAILABLE'):null;
 time+=1000;rem.set({hour:20});push.sync({settings:{frequency:2,hour:20}});await settled();
 s.failWhen=()=>null;
 await push.enable({settings:{frequency:2,hour:20,since:null}});await settled();
 assert.equal(s.stored.settings.hour,20);
 assert.equal(push.snapshot().plan.hour,20,'계획 화면도 20시다');
});

test('판: 요청 도중 기기 시계를 뒤로 맞춰도 그 재기를 버리고, 뒤에 바꾼 설정이 이긴다(GPT push-versions-world-r2 GA8)',async()=>{
 let server=Date.UTC(2026,9,22,3),device=server,perf=1000;
 const b=browser({registered:true,subscribed:SUB,extra:{performance:{now:()=>perf}}});
 const s=versionedServer({clock:()=>server}),r=rollback(s),rem=reminderSettings(),push=makeV(b,s,{now:()=>device,request:r.request});push.bindSettings(rem);
 await push.setAccount('acc-1');
 server+=1000;device+=1000;perf+=1000;
 r.holdStatus=[];const reading=push.refresh();await flush();await flush();
 device-=10*60000;   // 응답을 기다리는 동안 기기 시계를 10분 뒤로 맞췄다
 for(const release of r.holdStatus.splice(0))release();r.holdStatus=null;await reading;
 server+=1000;device+=1000;perf+=1000;
 s.stored.settings={frequency:2,hour:9,since:server};s.stored.versions.settings=server;   // 다른 기기가 9시를 저장했다
 server+=1000;device+=1000;perf+=1000;
 rem.set({hour:20});push.sync({settings:{frequency:2,hour:20}});await settled();
 assert.equal(s.stored.settings.hour,20);
});

test('판: 켜기가 판 때문에 400 INVALID_ACTION을 받으면 판 없이 한 번 다시 보내 켜진다 · 다시 재는 동안 「동의하고 켜기」는 잠긴다(둘째 설계 검토)',async()=>{
 const server=Date.UTC(2026,9,22,3);let device=server;
 const s=versionedServer({clock:()=>server}),r=rollback(s),push=makeV(browser(),s,{now:()=>device,request:r.request});
 await push.setAccount('acc-1');await push.ready();
 assert.equal(push.snapshot().publicReady,true);
 device+=3600000;r.holdStatus=[];push.sync({digest:DIGEST('2026-10-20')});await settled();
 assert.equal(push.snapshot().publicReady,false,'시계 차이를 모르는 동안 잠근다');
 for(const release of r.holdStatus.splice(0))release();r.holdStatus=null;await settled();
 assert.equal(push.snapshot().publicReady,true,'다시 재면 풀린다');
 r.old=true;   // 상태를 다시 읽기 전에 옛 서버로 되돌렸다
 await push.enable({settings:{frequency:2,hour:null,since:null},digest:DIGEST('2026-10-21')});await settled();
 assert.equal(push.snapshot().device.subscribed,true,'판 없이 다시 보내 켜졌다');
 const subscribes=s.calls.filter(call=>call.action==='subscribe');
 assert.deepEqual(subscribes.map(call=>!!call.body.versions),[true,false]);
});

test('판: 첫 재기를 버려 시계 차이를 모르는 동안에도 판을 아는 서버로 보고, 설정을 판 없이 보내지 않는다 — 곧바로 다시 잰 뒤 보낸다(둘째 설계 검토 3)',async()=>{
 const server=Date.UTC(2026,9,22,3);let device=server,perf=1000;
 const b=browser({registered:true,subscribed:SUB,extra:{performance:{now:()=>perf}}});
 const s=versionedServer({clock:()=>server}),r=rollback(s),rem=reminderSettings(),push=makeV(b,s,{now:()=>device,request:r.request});push.bindSettings(rem);
 r.holdStatus=[];const opening=push.setAccount('acc-1');await flush();await flush();
 device-=10*60000;   // 첫 status를 기다리는 동안 기기 시계를 10분 뒤로 맞췄다
 r.holdStatus.shift()();await opening;await flush();await flush();
 assert.equal(push.snapshot().versioning,true,'판을 아는 서버다');
 assert.equal(push.snapshot().publicReady,false,'차이를 모르는 동안 켜기를 잠근다');
 rem.set({hour:20});push.sync({settings:{frequency:2,hour:20}});await flush();
 assert.equal(s.syncs().length,0,'판 없이 보내지 않는다');
 for(const release of r.holdStatus.splice(0))release();r.holdStatus=null;await settled();
 assert.equal(s.stored.settings.hour,20);
 assert.ok(s.syncs().every(call=>Number.isSafeInteger(call.body.versions?.settings)),'판을 실어 보냈다');
});
