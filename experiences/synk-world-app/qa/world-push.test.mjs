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
// 가짜 Web Locks(같은 브라우저의 탭들이 함께 쓴다): request(이름, [{ifAvailable}], 콜백). 쥔 이름을 ifAvailable로 청하면 콜백에 null을 준다.
// Web Locks의 가짜: 쥔 이름을 다시 청하면 줄을 서고, 놓으면 다음 차례가 바로 쥔다. ifAvailable은 쥔 이름이면 null을 받는다.
const fakeLocks=()=>{const held=new Set(),waiting=new Map();
 const grant=(name,callback)=>{held.add(name);return Promise.resolve().then(()=>callback({name})).finally(()=>{held.delete(name);const next=waiting.get(name)?.shift();if(next)next();});};
 return {held,request(name,a,b){const options=typeof a==='function'?{}:a||{},callback=typeof a==='function'?a:b;
  if(held.has(name)){if(options.ifAvailable)return Promise.resolve().then(()=>callback(null));
   return new Promise((resolve,reject)=>{const list=waiting.get(name)||[];list.push(()=>grant(name,callback).then(resolve,reject));waiting.set(name,list);});}
  return grant(name,callback);}};};
const SCOPE='https://synk.im/world/';
const flush=()=>new Promise(resolve=>setImmediate(resolve));

// 가짜 브라우저: 서비스 워커 등록 하나, 브라우저 구독 하나(있으면). subscribe는 부른 순간을 센다(누른 동작 안에서 불렀는지).
function browser({userAgent=DESKTOP,permission='default',answer='granted',registered=false,subscribed=null,secure=true,locks=null,extra={}}={}){
 const log=[];let current=subscribed,perm=permission,pendingPrompt=null;
 const subscription=endpoint=>({endpoint,toJSON(){return {endpoint,expirationTime:null,keys:{p256dh:KEY,auth:'A'.repeat(22)}};},async unsubscribe(){log.push(['unsubscribe',endpoint]);if(current?.endpoint===endpoint)current=null;return true;}});
 if(current)current=subscription(current);
 const pushManager={async getSubscription(){return current;},subscribe(options){log.push(['subscribe',options.userVisibleOnly]);
  if(answer==='hang')return new Promise(resolve=>{pendingPrompt=()=>{perm='granted';current=subscription('https://fcm.googleapis.com/fcm/send/late');resolve(current);};});
  if(answer==='denied'){perm='denied';return Promise.reject(Object.assign(new Error('denied'),{name:'NotAllowedError'}));}
  perm='granted';current=current||subscription('https://fcm.googleapis.com/fcm/send/new');return Promise.resolve(current);}};
 const registration={scope:SCOPE,active:{},pushManager};
 const env={navigator:{userAgent,maxTouchPoints:0,...(locks?{locks}:{}),serviceWorker:{async register(url,options){log.push(['register',url,options.scope]);registered=true;return registration;},async getRegistration(scope){return registered&&scope===SCOPE?registration:undefined;}}},
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
 await flush();   // 앞 설정 요청의 응답이 왔다(옛 서버에는 설정 요청을 하나씩 보낸다)
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
// ── 바탕 판(SYNK-appsscript 단계4_계획 §24-6의 5, 설계 주인 11-21 「서버가 매기는 compare-and-set」) ──
// 바탕 판을 아는 가짜 서버(talk world-push의 꼴): 부분마다 판은 쓰기 수다. 요청의 바탕이 저장된 판과 같을 때만 쓰고 +1 한다(처음 null은 받은 때에서 센다).
// 바탕이 없는 요청은 언제나 받고 +1 한다. 응답에 판 · 받음 · 지금 설정(plan) · versioning:'base'를 싣는다. sync 응답에는 기기 칸이 없다.
// hold면 sync를 붙잡아 두었다가 풀 때 닿은 것으로 쓴다(늦게 닿은 요청). failWhen(action, body)이 오류를 돌려주면 그 요청은 서버에 닿지 않는다.
const V0=Date.UTC(2026,9,22,3),SUB='https://fcm.googleapis.com/fcm/send/x';
const DIGEST=(day,reviews=[1])=>({reviews,examDate:null,planWeek:null,lastStudyDay:day,studyHour:null,lang:'ko',timeZone:'Asia/Seoul'});
function versionedServer({clock=()=>V0,settings={frequency:2,hour:null,since:null},versions=null}={}){
 const start=clock(),calls=[],held=[],stored={settings:{...settings},versions:versions?{...versions}:{settings:start,digest:start,reviews:start},digest:null,reviews:null};
 let hold=false,active=true,failWhen=()=>null;
 const view=()=>({frequency:stored.settings.frequency,hour:stored.settings.hour,since:stored.settings.since,next:1,log:[]});
 const reply=extra=>({ok:true,accountId:'acc-1',enabled:true,publicKey:KEY,device:{subscribed:true,deviceId:'dev-1'},account:{active,devices:active?1:0},
  plan:active?view():null,versions:active?{...stored.versions}:null,versioning:'base',...extra});
 function apply(body){
  const v=body.versions,fits=key=>!v||!Object.hasOwn(v,key)||v[key]===(stored.versions[key]??null),next=key=>stored.versions[key]==null?clock():stored.versions[key]+1;
  const applied={settings:false,digest:false,reviews:false};
  if(body.settings&&fits('settings')){stored.settings={...stored.settings,...body.settings,since:clock()};stored.versions.settings=next('settings');applied.settings=true;}
  if(body.digest){
   const known=Array.isArray(body.digest.reviews),takeDigest=fits('digest'),takeReviews=known&&fits('reviews');
   if(takeDigest){stored.digest={...body.digest};stored.versions.digest=next('digest');applied.digest=true;}
   if(takeReviews){stored.reviews=body.digest.reviews;stored.versions.reviews=next('reviews');applied.reviews=true;}
  }
  return applied;
 }
 const arrive=body=>{const {device,...rest}=active?reply({applied:apply(body)}):reply({applied:{settings:false,digest:false,reviews:false}});return rest;};
 const request=(action,body={},options={})=>{
  calls.push({action,body,options});
  const error=failWhen(action,body);if(error)return Promise.reject(error);
  if(action==='status')return Promise.resolve(reply({}));
  if(action==='sync'){
   if(hold)return new Promise(resolve=>held.push(()=>resolve(arrive(body))));
   return Promise.resolve(arrive(body));
  }
  // 켜기: 처음 켜는 계정이면 바탕과 상관없이 새 계획(판은 받은 때), 이미 켠 계정이면 설정은 계정 것을 두고 요약만 바탕으로 견준다(talk subscribe).
  if(action==='subscribe'){
   if(!active){
    const now=clock(),known=Array.isArray(body.digest?.reviews);active=true;
    stored.settings={...stored.settings,...body.settings,since:now};stored.digest={...body.digest};stored.reviews=known?body.digest.reviews:null;
    stored.versions={settings:now,digest:now,reviews:known?now:null};
    return Promise.resolve(reply({applied:{settings:true,digest:true,reviews:known}}));
   }
   return Promise.resolve(reply({applied:apply({digest:body.digest,versions:body.versions})}));
  }
  // 끄기: 이 가짜는 기기 하나 — 마지막 기기라 계정의 2단이 꺼지고 계획 줄이 지워지며 설정을 돌려준다.
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
const KEY_V='synk.world.push.versions.v1.acc-1';
const EDIT_OF=storage=>JSON.parse(storage.getItem(KEY_V)||'null')?.settings??null;
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
// 옛 서버로 되돌릴 수 있는 가짜: old가 참이면 판을 실은 요청은 400 INVALID_ACTION이고 응답에 판 · 받음 · 바탕 표시가 없다. hold…로 응답을 붙잡는다.
function rollback(s){
 const state={old:false,queue:[],holdSync:false,holdStatus:null,holdUnsubscribe:null};
 const strip=data=>{if(!state.old)return data;const {versioning,versions,applied,...rest}=data;return rest;};
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
const on=(s,extra={})=>makeV(browser({registered:true,subscribed:SUB,...(extra.browser||{})}),s,{now:()=>V0,...extra});

test('판: 판을 모르는 서버(응답에 versioning 없음)에는 versions를 싣지 않는다 — 함수를 되돌려도 지금처럼 돈다(설계 검토 P2-4)',async()=>{
 const b=browser({registered:true,subscribed:SUB}),s=server({device:true,active:true}),push=makeV(b,s);
 await push.setAccount('acc-1');
 push.sync({settings:{frequency:1,hour:9}});push.sync({digest:DIGEST('2026-10-21')});
 await flush();
 const bodies=s.calls.filter(call=>call.action==='sync').map(call=>call.body);
 assert.equal(bodies.length,2);assert.ok(bodies.every(body=>!('versions' in body)),JSON.stringify(bodies));
 assert.equal(push.snapshot().versioning,false);
});

test('판: 닫은 탭의 늦은 옛 설정은 바탕이 옛것이라 거절되고 다른 탭의 뒤 설정이 남는다 — 닫은 탭은 다시 보내지 않는다(GPT r4 GA1)',async()=>{
 const s=versionedServer(),storage=memory(),rem=reminderSettings();
 const tabA=on(s,{storage}),tabB=on(s,{storage});tabA.bindSettings(rem);tabB.bindSettings(rem);
 await tabA.setAccount('acc-1');await tabB.setAccount('acc-1');
 s.hold=true;rem.set({hour:9});tabA.sync({settings:{frequency:2,hour:9}});s.hold=false;
 rem.set({hour:20});tabB.sync({settings:{frequency:2,hour:20}});await settled();
 assert.equal(s.stored.settings.hour,20);
 tabA.dispose();
 s.held.shift()();await settled();
 assert.equal(s.stored.settings.hour,20,'늦게 닿은 9시는 거절된다');
 assert.deepEqual(s.syncs().map(call=>[call.body.settings.hour,call.body.versions.settings]),[[9,V0],[20,V0]]);
});

test('판: 같은 바탕의 두 기기 — 뒤에 닿아 거절된 쪽은 새 판을 바탕으로 한 번 다시 보내 학생의 마지막 뜻이 이긴다(설계 주인 11-21 규칙 4)',async()=>{
 const s=versionedServer(),storageB=memory(),remA=reminderSettings(),remB=reminderSettings();
 const a=on(s),b=on(s,{storage:storageB});a.bindSettings(remA);b.bindSettings(remB);
 await a.setAccount('acc-1');await b.setAccount('acc-1');
 remA.set({hour:9});a.sync({settings:{frequency:2,hour:9}});await settled();
 remB.set({hour:20});b.sync({settings:{frequency:2,hour:20}});await settled();
 assert.equal(s.stored.settings.hour,20,'뒤에 바꾼 20시가 남는다');
 assert.deepEqual(s.syncs().filter(call=>call.body.settings?.hour===20).map(call=>call.body.versions.settings),[V0,V0+1],'거절된 뒤 새 판을 바탕으로 한 번 다시 보냈다');
 assert.equal(EDIT_OF(storageB),null,'받혀 편집을 비웠다');
});

test('판: 다시 보낸 설정도 거절되면 응답의 서버 설정을 들이고 멈춘다 — 고리가 없다(설계 주인 11-21 규칙 3 · 4)',async()=>{
 const s=versionedServer(),storage=memory(),rem=reminderSettings();
 // 다른 기기가 다섯 번까지 끼어든다: 이 기기의 설정이 닿을 때마다 그 바로 앞에 15시를 쓴다(고리가 있으면 여섯째에 받혀 셈이 어긋난다).
 let fights=0;
 const request=(action,body={},options={})=>{if(action==='sync'&&body.settings&&fights++<5){s.stored.versions.settings+=1;s.stored.settings={...s.stored.settings,hour:15};}return s.request(action,body,options);};
 const push=on(s,{storage,request});push.bindSettings(rem);
 await push.setAccount('acc-1');
 rem.set({hour:20});push.sync({settings:{frequency:2,hour:20}});await settled();
 assert.equal(s.syncs().filter(call=>call.body.settings).length,2,'한 번만 다시 보낸다');
 assert.equal(rem.value.hour,15,'왕복 없이 거절 응답의 설정을 들였다');
 assert.equal(EDIT_OF(storage),null);
 assert.equal(s.calls.filter(call=>call.action==='status').length,1,'상태를 다시 읽지 않았다');
});

test('판: 다음에 열 때 — 보내지 못한 설정의 바탕이 서버 판과 같으면 보내고, 다르면 그사이 다른 쓰기가 있었으니 서버 것을 들인다(설계 주인 11-21 규칙 5)',async()=>{
 const s=versionedServer();
 const keep=memory();keep.setItem(KEY_V,JSON.stringify({settings:{frequency:2,hour:20,base:V0,known:true,tries:0}}));
 const remA=reminderSettings({frequency:2,hour:20,since:null}),a=on(s,{storage:keep});a.bindSettings(remA);
 await a.setAccount('acc-1');await settled();
 assert.equal(s.stored.settings.hour,20,'바탕이 같아 보냈다');assert.equal(EDIT_OF(keep),null);
 const stale=memory();stale.setItem(KEY_V,JSON.stringify({settings:{frequency:1,hour:9,base:V0,known:true,tries:0}}));
 const remB=reminderSettings({frequency:1,hour:9,since:null}),b=on(s,{storage:stale});b.bindSettings(remB);
 await b.setAccount('acc-1');await settled();
 assert.deepEqual([s.stored.settings.frequency,s.stored.settings.hour],[2,20],'옛 바탕의 9시는 보내지 않는다');
 assert.deepEqual([remB.value.frequency,remB.value.hour],[2,20],'서버 것을 들였다');assert.equal(EDIT_OF(stale),null);
 assert.equal(s.syncs().filter(call=>call.body.settings?.hour===9).length,0);
});

test('판: 다른 탭이 옛 바탕으로 적고 닫은 편집은 이 탭이 보내지 않고 서버 설정을 들인다 — 닫힌 탭의 편집이 그 탭이 보지 못한 쓰기를 이기지 않는다(설계 주인 11-21 규칙 5)',async()=>{
 const s=versionedServer(),storage=memory(),rem=reminderSettings(),push=on(s,{storage});push.bindSettings(rem);
 await push.setAccount('acc-1');
 await s.request('sync',{settings:{frequency:2,hour:20},versions:{settings:V0}});   // 다른 기기가 20시를 썼다
 await push.refresh();await settled();
 assert.equal(push.snapshot().versions.settings,V0+1);assert.equal(rem.value.hour,20);
 storage.setItem(KEY_V,JSON.stringify({settings:{frequency:2,hour:9,base:V0,known:true,tries:0}}));   // 닫힌 탭이 옛 바탕으로 9시를 적어 두었다
 push.sync({digest:DIGEST('2026-10-22')});await flush();await settled();
 const mine=s.syncs().slice(1).map(call=>call.body);
 assert.ok(mine.length>=1&&mine.every(body=>!body.settings),JSON.stringify(mine));
 assert.equal(s.stored.settings.hour,20);assert.equal(rem.value.hour,20);assert.equal(EDIT_OF(storage),null);
});

test('판: 상태를 몰랐을 때 바꾼 설정은 상태가 서면 그때 판을 바탕으로 보낸다 · 떠날 때는 기다림 없이 보낸다 · 로그아웃은 판 키를 지운다(설계 검토 P2-7 · P2-5)',async()=>{
 const s=versionedServer(),storage=memory(),rem=reminderSettings();
 const push=on(s,{storage});push.bindSettings(rem);
 s.failWhen=action=>action==='status'?fault(0,'PUSH_UNAVAILABLE'):null;
 await push.setAccount('acc-1');assert.equal(push.snapshot().account.active,false);
 rem.set({hour:18});push.sync({settings:{frequency:2,hour:18}});
 assert.equal(s.syncs().length,0);assert.equal(EDIT_OF(storage).known,false,'바탕을 모르는 편집으로 적는다');
 s.failWhen=()=>null;await push.refresh();await settled();
 assert.equal(s.stored.settings.hour,18,'상태가 선 뒤 맞추기가 보낸다');assert.equal(EDIT_OF(storage),null,'받혀 비웠다');
 assert.equal(s.syncs()[0].body.versions.settings,V0);
 s.hold=true;rem.set({hour:20});push.sync({settings:{frequency:2,hour:20}});const sent=s.syncs().length;
 push.sync({digest:DIGEST('2026-10-22',[2])});push.sync({digest:DIGEST('2026-10-22',[3])});   // 하나는 바로, 하나는 5분 모으기
 const before=s.syncs().length;push.flush();
 assert.equal(s.syncs().length,before+1,'떠날 때 모은 요약이 기다림 없이(같은 차례에서) 나간다');
 assert.equal(s.syncs().at(-1).options.leaving,true);assert.ok(sent>=1);
 for(const release of s.held.splice(0))release();await settled();
 await push.logout();assert.equal(storage.getItem(KEY_V),null);
});

test('판: 거절된 요약은 지금 기록으로 새로 지어 한 번 다시 보내고, 또 거절되면 멈춘다(설계 주인 11-21 규칙 4)',async()=>{
 const s=versionedServer();let built=0;
 const rem={...reminderSettings(),digest:()=>{built++;return {digest:DIGEST('2026-10-23',[built+5])};}};
 const push=on(s);push.bindSettings(rem);await push.setAccount('acc-1');
 await s.request('sync',{digest:DIGEST('2026-10-22')});   // 다른 기기가 보냈다 — 이 기기가 아는 요약 판은 옛것이다
 push.sync({digest:DIGEST('2026-10-21')});await settled();
 assert.deepEqual(s.syncs()[1].body.versions,{digest:V0,reviews:V0},'요약 · 복습 때 바탕을 함께 싣는다');
 assert.equal(built,1,'한 번 새로 지었다');assert.equal(s.stored.digest.lastStudyDay,'2026-10-23','새로 지은 요약이 받혔다');
 const s2=versionedServer();let built2=0;
 let fights=0;
 const request=(action,body={},options={})=>{if(action==='sync'&&body.digest&&fights++<5){s2.stored.versions.digest+=1;s2.stored.versions.reviews+=1;}return s2.request(action,body,options);};
 const rem2={...reminderSettings(),digest:()=>{built2++;return {digest:DIGEST('2026-10-24')};}};
 const push2=on(s2,{request});push2.bindSettings(rem2);await push2.setAccount('acc-1');
 push2.sync({digest:DIGEST('2026-10-21')});await settled();
 assert.equal(s2.syncs().filter(call=>call.body.digest).length,2,'한 번만 다시 보낸다');assert.equal(built2,1);
});

test('판: 다른 기기의 새 설정을 1단 설정에 들이고, 이 기기에서 횟수만 바꿔도 시각은 서버 값으로 남는다(설계 검토 P1-1)',async()=>{
 const s=versionedServer({settings:{frequency:2,hour:20,since:V0-1000}});
 const rem=reminderSettings({frequency:2,hour:9,since:null}),push=on(s);
 push.bindSettings(rem);await push.setAccount('acc-1');
 assert.deepEqual(rem.adopted,[{frequency:2,hour:20,since:V0-1000}],'편집이 없어 서버 설정을 들였다');
 assert.equal(s.syncs().length,0,'들일 때는 보내지 않는다');
 rem.set({frequency:1});push.sync({settings:{frequency:1,hour:rem.value.hour}});await settled();
 assert.deepEqual([s.stored.settings.frequency,s.stored.settings.hour],[1,20]);
});

test('판: 요약이 400이면 그 요약은 버리고 설정만 다시 보낸다 · 2단이 꺼진 계정 응답이면 다시 보내기를 멈춘다(설계 검토 P2-1 · P2-2)',async t=>{
 const s=versionedServer(),rem=reminderSettings(),push=on(s);
 push.bindSettings(rem);await push.setAccount('acc-1');
 const digest={...DIGEST('2026-10-21'),planWeek:{start:1,end:2}};
 s.failWhen=(action,body)=>action==='sync'&&body.digest?fault(400,'INVALID_DIGEST'):null;
 s.hold=true;push.sync({digest});s.hold=false;
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
 const s=versionedServer(),push=on(s);
 await push.setAccount('acc-1');
 const digest=DIGEST('2026-10-21');
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

test('판: 떠날 때 1단의 모으던 다시 잡기가 낸 요약도 떠남으로 가고, 토큰 갱신을 기다리던 요청은 떠나며 다시 보낸다(GPT push-versions-world GA1)',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const s=versionedServer();
 let attempts=0;const request=(action,body={},options={})=>{if(action==='sync')attempts++;if(action==='sync'&&!options.leaving){options.onWait?.();return new Promise(()=>{});}return s.request(action,body,options);};
 const push=on(s,{request});
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

test('판: 설정 값과 바탕은 한 덩어리로 나가고, 다른 탭의 로그아웃은 보내지 못한 편집을 지우지 않는다 — 로그아웃한 탭의 편집은 남은 탭이 넘겨받아 보낸다(GPT push-versions-world GA2 · 설계 검토 5)',async()=>{
 const s=versionedServer(),storage=memory(),locks=fakeLocks(),rem=reminderSettings();
 const tabA=on(s,{storage,browser:{locks}}),tabB=on(s,{storage,browser:{locks}});tabA.bindSettings(rem);tabB.bindSettings(rem);
 await tabA.setAccount('acc-1');await tabB.setAccount('acc-1');
 s.failWhen=action=>action==='sync'?fault(0,'PUSH_UNAVAILABLE'):null;
 rem.set({hour:9});tabA.sync({settings:{frequency:2,hour:9}});await settled();
 rem.set({hour:20});tabB.sync({settings:{frequency:2,hour:20}});await settled();
 await tabB.logout();await settled();   // 로그아웃한 B는 잠금을 놓는다(비동기)
 assert.equal(EDIT_OF(storage)?.hour,20,'보내지 못한 편집이 남는다');
 s.failWhen=()=>null;tabA.retry();await settled();
 assert.equal(s.stored.settings.hour,20,'A가 넘겨받아 보낸 것은 덩어리의 20시다');
 assert.ok(s.syncs().every(call=>call.body.versions?.settings===V0),'값마다 그때의 바탕이 붙었다');
});

test('판: 켜기는 설정 바탕을 싣지 않는다 — 권한 창이 떠 있는 동안 다른 기기가 켜고 저장한 설정이 남는다(GPT push-versions-world GA3)',async()=>{
 let time=V0;
 const s=versionedServer({clock:()=>time});s.active=false;
 const b=browser({answer:'hang'}),rem=reminderSettings(),push=makeV(b,s,{now:()=>time});push.bindSettings(rem);
 await push.setAccount('acc-1');await push.ready();
 const turning=push.enable({settings:{frequency:2,hour:null,since:null},digest:DIGEST('2026-10-21')});
 time+=1000;s.active=true;s.stored.settings={frequency:2,hour:20,since:time};s.stored.versions={settings:time,digest:time,reviews:time};
 time+=1000;b.resolvePrompt();await turning;await settled();
 assert.equal(push.snapshot().device.subscribed,true);
 assert.equal(s.stored.settings.hour,20,'다른 기기의 20시가 남는다');
 assert.equal(rem.value.hour,20,'이 기기는 계정 설정을 들인다');
 assert.equal(s.syncs().filter(call=>call.body.settings).length,0,'기본 설정을 다시 보내지 않는다');
 assert.equal(s.calls.find(call=>call.action==='subscribe').body.versions?.settings,undefined);
});

test('판: 켜기의 요약이 권한 창 사이 다른 기기의 요약에 거절되면 지금 기록으로 새로 지어 한 번 다시 보낸다(GPT push-versions-world GA4 · 설계 주인 11-21 규칙 4)',async()=>{
 let time=V0;
 const s=versionedServer({clock:()=>time}),b=browser({answer:'hang'});
 const rem={...reminderSettings(),digest:()=>({digest:DIGEST('2026-10-22',[9])})},push=makeV(b,s,{now:()=>time});push.bindSettings(rem);
 await push.setAccount('acc-1');await push.ready();
 const turning=push.enable({settings:{frequency:2,hour:null,since:null},digest:DIGEST('2026-10-21')});
 time+=1000;await s.request('sync',{digest:DIGEST('2026-10-22',[4])});
 time+=1000;b.resolvePrompt();await turning;await settled();
 assert.equal(push.snapshot().device.subscribed,true);
 const subscribe=s.calls.find(call=>call.action==='subscribe');
 assert.equal(subscribe.body.versions.digest,V0,'누를 때 알던 바탕');
 assert.deepEqual(s.stored.reviews,[9],'새로 지은 요약이 받혔다');
});

test('판: 끄기 전에 서버가 처리한 요약의 늦은 응답이 끄기 뒤에 와도 「켜짐」으로 되돌리지 않고, 요약 응답은 이 기기 상태를 바꾸지 않는다(GPT push-versions-world GA5 · 설계 검토 3)',async()=>{
 const s=versionedServer(),m=manual(s),push=on(s,{request:m.request});
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

test('판: 같은 탭에서 응답 전에 9시 뒤 20시 — 20시는 9시의 응답을 기다렸다가 새 판을 바탕으로 간다(자기 요청끼리 거절하지 않는다, 설계 검토 3 · GPT push-versions-world GA6)',async()=>{
 const s=versionedServer(),m=manual(s),rem=reminderSettings(),push=on(s,{request:m.request});push.bindSettings(rem);
 await push.setAccount('acc-1');
 rem.set({hour:9});push.sync({settings:{frequency:2,hour:9}});
 rem.set({hour:20});push.sync({settings:{frequency:2,hour:20}});
 push.sync({digest:DIGEST('2026-10-22')});await flush();
 assert.deepEqual(m.queue.map(item=>item.body.settings?.hour??null),[9,null],'20시는 9시의 응답을 기다린다');
 m.queue.shift().pass();await settled();
 while(m.queue.length){m.queue.shift().pass();await settled();}
 assert.equal(s.syncs().find(call=>call.body.settings?.hour===20).body.versions.settings,V0+1);
 assert.equal(s.stored.settings.hour,20);assert.equal(rem.value.hour,20);
});

test('판: 늦게 온 앞 응답 뒤에 다음 설정이 새 판을 바탕으로 한 번 간다 — 이미 받힌 설정은 다시 가지 않는다',async()=>{
 const s=versionedServer(),m=manual(s),rem=reminderSettings(),push=on(s,{request:m.request});push.bindSettings(rem);
 await push.setAccount('acc-1');
 rem.set({hour:9});push.sync({settings:{frequency:2,hour:9}});await flush();
 const release=m.queue.shift().late();   // 서버는 9시를 먼저 받았고 응답만 늦다
 rem.set({hour:20});push.sync({settings:{frequency:2,hour:20}});await flush();
 assert.equal(m.queue.length,0,'앞 설정 요청이 날아가는 동안 20시는 나가지 않는다');
 release();await settled();
 while(m.queue.length){m.queue.shift().pass();await settled();}
 assert.deepEqual(s.syncs().map(call=>call.body.settings?.hour),[9,20]);
 assert.equal(s.stored.settings.hour,20);assert.equal(rem.value.hour,20);
});

test('판: 서버가 뒤에 처리한 응답이 먼저 닿아도, 보낸 차례가 늦은 앞 처리 응답은 판을 되돌리지 않는다 — 옮긴 편집이 남아 보내진다',async()=>{
 const s=versionedServer(),storage=memory(),m=manual(s),rem=reminderSettings(),push=on(s,{storage,request:m.request});push.bindSettings(rem);
 await push.setAccount('acc-1');
 rem.set({hour:9});push.sync({settings:{frequency:2,hour:9}});
 rem.set({hour:20});push.sync({settings:{frequency:2,hour:20}});
 push.sync({digest:DIGEST('2026-10-22')});await flush();
 const [nine,digest]=m.queue.splice(0);
 const digestReply=digest.late();await settled();   // 서버는 요약을 먼저 받았고 응답만 늦다
 nine.pass();await settled();   // 9시가 받히고 20시 편집은 새 판으로 옮겨져 보내진다
 digestReply();await settled();   // 서버가 앞에 처리한 요약 응답(설정 판이 작다)이 이제 닿는다
 assert.equal(EDIT_OF(storage)?.base,V0+1,'옮긴 편집이 남았다');assert.equal(push.snapshot().versions.settings,V0+1);
 while(m.queue.length){m.queue.shift().pass();await settled();}
 assert.equal(s.stored.settings.hour,20);assert.equal(rem.value.hour,20);assert.equal(EDIT_OF(storage),null);
 assert.equal(push.snapshot().versions.settings,s.stored.versions.settings);
});

test('판: 다른 탭이 더 새 편집을 적으면 그 탭이 맡는다 — 먼저 간 요청의 받힘은 그 편집을 지우지 않고, 그 탭이 거절 뒤 한 번 다시 보내 마지막 편집이 남는다(설계 검토 8 · 11-21 밤 2)',async()=>{
 const s=versionedServer(),storage=memory(),locks=fakeLocks(),m=manual(s),rem=reminderSettings();
 const a=on(s,{storage,request:m.request,browser:{locks}}),b=on(s,{storage,request:m.request,browser:{locks}});a.bindSettings(rem);b.bindSettings(rem);
 await a.setAccount('acc-1');await b.setAccount('acc-1');
 rem.set({hour:20});a.sync({settings:{frequency:2,hour:20}});await flush();
 rem.set({hour:9});b.sync({settings:{frequency:2,hour:9}});await flush();
 assert.equal(m.queue.length,2);
 m.queue.shift().pass();await settled();   // A의 20시가 받힌다
 assert.equal(EDIT_OF(storage)?.hour,9,'B의 더 새 편집은 남는다');assert.equal(rem.value.hour,9,'A는 B가 맡는 동안 서버 설정을 들이지 않는다');
 while(m.queue.length){m.queue.shift().pass();await settled();}
 assert.equal(s.stored.settings.hour,9);assert.equal(rem.value.hour,9);assert.equal(EDIT_OF(storage),null);
});

test('판: 첫 상태 읽기가 실패한 탭도 망이 돌아오면 상태를 읽고 바꾼 설정을 보낸다(GPT push-versions-world GA9)',async()=>{
 const s=versionedServer(),rem=reminderSettings(),push=on(s);push.bindSettings(rem);
 s.failWhen=action=>action==='status'?fault(0,'PUSH_UNAVAILABLE'):null;
 await push.setAccount('acc-1');
 rem.set({hour:18});push.sync({settings:{frequency:2,hour:18}});
 s.failWhen=()=>null;push.retry();await settled();
 assert.equal(s.stored.settings.hour,18);
});

test('판: 바탕 판을 아는 서버를 옛 판으로 되돌려도 바꾼 설정은 판 없이 다시 가고, 마지막 편집이 남는다 — 옛 서버 구간은 판 키를 쓰지 않는다(GPT push-versions-world GA10 · r2 GA1)',async()=>{
 const s=versionedServer(),r=rollback(s),storage=memory(),rem=reminderSettings(),push=on(s,{request:r.request,storage});push.bindSettings(rem);
 await push.setAccount('acc-1');
 r.old=true;r.holdSync=true;   // 상태는 판을 아는 서버였고, 보내기 전에 옛 판으로 되돌렸다
 rem.set({hour:9});push.sync({settings:{frequency:2,hour:9}});
 rem.set({hour:20});push.sync({settings:{frequency:2,hour:20}});await flush();
 assert.equal(r.queue.length,1,'한 페이지 안에서는 설정을 하나씩 보낸다');
 r.holdSync=false;await r.queue.shift().go();await settled();await flush();
 assert.equal(s.stored.settings.hour,20);assert.equal(push.snapshot().versioning,false);
 assert.equal(s.syncs().filter(call=>!call.rejected).at(-1).body.versions,undefined,'옛 서버가 받은 마지막 요청은 판이 없다');
 assert.equal(EDIT_OF(storage),null,'옛 서버 구간은 판 키를 쓰지 않는다');
});

test('판: 처음 켤 때 권한 창 · 응답을 기다리는 사이 바꾼 설정이 누를 때의 값에 지지 않는다(GPT push-versions-world-r3 GA1)',async()=>{
 const s=versionedServer(),b=browser({answer:'hang'}),rem=reminderSettings({frequency:2,hour:9,since:null}),storage=memory();
 s.active=false;
 let release=null,held=null;
 const request=(action,body,options)=>{
  if(action==='subscribe'&&!held){held=body;return new Promise(resolve=>{release=()=>resolve(s.request(action,body,options));});}
  return s.request(action,body,options);
 };
 const push=makeV(b,s,{now:()=>V0,request,storage});push.bindSettings(rem);
 await push.setAccount('acc-1');await push.ready();
 const turning=push.enable({settings:{frequency:2,hour:9,since:null},digest:DIGEST('2026-10-21')});
 rem.set({hour:20});   // 권한 창이 열린 사이 바꿨다(꺼진 계정이라 편집으로 적히지 않는다)
 b.resolvePrompt();await settled();
 assert.equal(held?.settings.hour,20,'보낼 때의 1단 값을 싣는다');
 rem.set({hour:7});    // 응답을 기다리는 사이 또 바꿨다
 release();await turning;await settled();
 assert.equal(push.snapshot().device.subscribed,true);
 assert.equal(s.stored.settings.hour,7,'날아가는 사이 바꾼 값도 이어 보낸다');assert.equal(rem.value.hour,7);assert.equal(EDIT_OF(storage),null);
});

test('판: 처음 켜는 동안 1단이 그대로면 켠 뒤 설정을 다시 보내지 않는다',async()=>{
 const s=versionedServer(),rem=reminderSettings({frequency:2,hour:9,since:null});
 s.active=false;
 const storage=memory(),push=on(s,{storage});push.bindSettings(rem);
 await push.setAccount('acc-1');await push.ready();
 push.sync({settings:{frequency:2,hour:9}});
 assert.equal(EDIT_OF(storage),null,'꺼진 계정에서 바꾼 설정은 판 키에 적지 않는다(켤 때 1단 설정이 간다)');
 await push.enable({settings:{frequency:2,hour:9,since:null},digest:DIGEST('2026-10-21')});await settled();
 assert.equal(push.snapshot().device.subscribed,true);
 assert.equal(s.syncs().length,0);assert.equal(s.stored.settings.hour,9);
});

test('판: 옛 서버로 되돌린 동안 설정 요청이 날아가는 중에 바꾼 설정은 그 응답 뒤에 모은 요약과 함께 보낸다 — 판 없는 두 설정 요청이 거꾸로 닿아 앞 값이 남지 않는다(GPT push-versions-world-r3 GA5 · GA10)',async()=>{
 const s=versionedServer(),r=rollback(s),rem=reminderSettings(),storage=memory(),push=on(s,{request:r.request,storage});push.bindSettings(rem);
 await push.setAccount('acc-1');
 r.old=true;await push.refresh();
 assert.equal(push.snapshot().versioning,false);
 r.holdSync=true;
 rem.set({hour:9});push.sync({settings:{frequency:2,hour:9}});await flush();
 rem.set({hour:20});push.sync({settings:{frequency:2,hour:20},digest:DIGEST('2026-10-23')});await flush();
 assert.equal(r.queue.length,1,'앞 설정 요청이 날아가는 동안 둘째는 나가지 않는다');
 r.holdSync=false;await r.queue.shift().go();await settled();await flush();await settled();
 assert.deepEqual(s.syncs().filter(call=>!call.rejected).map(call=>[call.body.settings?.hour,call.body.digest?.lastStudyDay??null,'versions' in call.body]),
  [[9,null,false],[20,'2026-10-23',false]]);
 assert.equal(s.stored.settings.hour,20);assert.equal(EDIT_OF(storage),null);
 // 요약만 날아가는 동안에는 설정을 바로 보낸다.
 r.holdSync=true;push.sync({digest:DIGEST('2026-10-24')});await flush();
 rem.set({hour:7});push.sync({settings:{frequency:2,hour:7}});await flush();
 assert.equal(r.queue.length,2);
 r.holdSync=false;for(const item of r.queue.splice(0))await item.go();await settled();
 assert.equal(s.stored.settings.hour,7);
});

test('판: 빈 복습 때 판(null)에 첫 복습 때를 쓴 응답은 더 새 상태다 — 다시 지은 요약은 그 판을 바탕으로 받힌다(GPT push-versions-world-r4 GA1)',async()=>{
 const s=versionedServer({versions:{settings:V0,digest:V0,reviews:null}}),m=manual(s);let built=0;
 const rem={...reminderSettings(),digest:()=>{built++;return {digest:DIGEST('2026-10-24',[9])};}};
 const push=on(s,{request:m.request});push.bindSettings(rem);
 await push.setAccount('acc-1');
 push.sync({digest:DIGEST('2026-10-22',[7])});await flush();
 const late=m.queue.shift();
 const {reviews,...noReviews}=DIGEST('2026-10-23');
 await s.request('sync',{digest:noReviews,versions:{digest:V0}});   // 다른 기기가 복습 때 없이 요약을 썼다
 await push.refresh();await settled();
 assert.deepEqual([push.snapshot().versions.digest,push.snapshot().versions.reviews],[V0+1,null]);
 late.pass();await settled();   // 요약은 거절, 복습 때는 받힘(첫 복습 때 판)
 assert.equal(push.snapshot().versions.reviews,s.stored.versions.reviews,'첫 복습 때 판을 적었다');
 while(m.queue.length){m.queue.shift().pass();await settled();}
 assert.equal(built,1);assert.deepEqual([s.stored.digest.lastStudyDay,s.stored.reviews],['2026-10-24',[9]]);
});

test('판: 모아 둔 요약은 모을 때 아는 판을 바탕으로 간다 — 그사이 읽은 다른 기기의 새 판이 묵은 요약에 붙지 않는다(GPT push-versions-world-r4 GA2)',async()=>{
 const s=versionedServer();let built=0;
 const rem={...reminderSettings(),digest:()=>{built++;return {digest:DIGEST('2026-10-25',[9])};}};
 const push=on(s);push.bindSettings(rem);
 await push.setAccount('acc-1');
 push.sync({digest:DIGEST('2026-10-21',[1])});await settled();   // 첫 요약은 바로 간다
 push.sync({digest:DIGEST('2026-10-21',[2])});   // 5분 안이라 모은다(이때 아는 판 V0+1)
 await s.request('sync',{digest:DIGEST('2026-10-22',[3]),versions:{digest:V0+1,reviews:V0+1}});   // 다른 기기가 오늘 요약을 썼다
 await push.refresh();await settled();
 assert.equal(push.snapshot().versions.digest,V0+2);
 push.flush();await settled();
 const held=s.syncs().filter(call=>call.body.digest?.reviews?.[0]===2);
 assert.equal(held.length,1);assert.deepEqual(held[0].body.versions,{digest:V0+1,reviews:V0+1},'모을 때의 바탕');
 assert.equal(built,1,'거절되어 지금 기록으로 새로 지었다');assert.equal(s.stored.digest.lastStudyDay,'2026-10-25');
});

test('판: 같은 탭의 9시 뒤 20시는 9시의 응답 뒤 새 판으로 가고, 20시의 거절은 한 번만 다시 보낸 뒤 둘째 거절에 멈춘다(GPT push-versions-world-r4 GA3 · 설계 검토 3)',async()=>{
 const s=versionedServer(),storage=memory(),m=manual(s),rem=reminderSettings(),push=on(s,{storage,request:m.request});push.bindSettings(rem);
 await push.setAccount('acc-1');
 rem.set({hour:9});push.sync({settings:{frequency:2,hour:9}});
 rem.set({hour:20});push.sync({settings:{frequency:2,hour:20}});await flush();
 assert.equal(m.queue.length,1);
 m.queue.shift().pass();await settled();   // 9시가 받히고 20시는 새 판(V0+1)을 바탕으로 간다
 assert.equal(m.queue[0].body.versions.settings,V0+1);
 await s.request('sync',{settings:{frequency:2,hour:15},versions:{settings:V0+1}});   // 그 사이 다른 기기 15시
 m.queue.shift().pass();await settled();   // 20시의 첫 거절 — 한 번 다시
 await s.request('sync',{settings:{frequency:2,hour:14},versions:{settings:s.stored.versions.settings}});   // 또 다른 기기 14시
 while(m.queue.length){m.queue.shift().pass();await settled();}
 assert.equal(s.syncs().filter(call=>call.body.settings?.hour===20).length,2,'20시는 처음과 한 번 다시');
 assert.equal(s.stored.settings.hour,14);assert.equal(rem.value.hour,14);assert.equal(EDIT_OF(storage),null);
});

test('판: 날아가는 9시가 닿기 전에 마지막 기기를 끄고 20시로 다시 켜면, 늦은 9시의 거절은 다시 보내지 않는다(GPT push-versions-world-r4 GA4)',async()=>{
 let time=V0;
 const s=versionedServer({clock:()=>time}),storage=memory(),m=manual(s),rem=reminderSettings(),push=on(s,{storage,request:m.request});push.bindSettings(rem);
 await push.setAccount('acc-1');await push.ready();
 rem.set({hour:9});push.sync({settings:{frequency:2,hour:9}});await flush();
 const nine=m.queue.shift();
 await push.disable();await settled();
 rem.set({hour:20});time+=60000;
 await push.enable({settings:{frequency:2,hour:20,since:null},digest:DIGEST('2026-10-21')});await settled();
 assert.equal(push.snapshot().device.subscribed,true);
 assert.equal(s.stored.settings.hour,20);assert.equal(EDIT_OF(storage),null,'켜며 새 계획을 썼으니 옛 편집은 지난 것');
 nine.pass();await settled();
 while(m.queue.length){m.queue.shift().pass();await settled();}
 assert.equal(s.syncs().filter(call=>call.body.settings?.hour===9).length,1);
 assert.equal(s.stored.settings.hour,20);assert.equal(rem.value.hour,20);
});

test('판: 첫 거절의 응답이 늦는 사이 더 새 서버 판을 읽었으면 그 판을 바탕으로 한 번 다시 보낸다(GPT push-versions-world-r4 GA5)',async()=>{
 const s=versionedServer(),storage=memory(),m=manual(s),rem=reminderSettings(),push=on(s,{storage,request:m.request});push.bindSettings(rem);
 await push.setAccount('acc-1');
 await s.request('sync',{settings:{frequency:2,hour:15},versions:{settings:V0}});   // 다른 기기 15시(이 탭은 아직 모른다)
 rem.set({hour:20});push.sync({settings:{frequency:2,hour:20}});await flush();
 const reply=m.queue.shift().late();   // 거절은 났고 응답만 늦다
 await s.request('sync',{settings:{frequency:2,hour:14},versions:{settings:V0+1}});   // 다른 기기 14시
 await push.refresh();await settled();
 assert.equal(push.snapshot().versions.settings,V0+2);
 reply();await settled();
 while(m.queue.length){m.queue.shift().pass();await settled();}
 assert.equal(s.syncs().filter(call=>call.body.settings?.hour===20).length,2,'한 번 다시 보냈다');
 assert.equal(s.stored.settings.hour,20);assert.equal(rem.value.hour,20);
});

test('판: 옛 서버에서 바꾼 설정도 판 키에 적어, 다른 탭이 남긴 더 옛 편집을 뒤에 보내지 않는다(GPT push-versions-world-r4 GA6)',async()=>{
 const s=versionedServer(),r=rollback(s),storage=memory(),rem=reminderSettings(),push=on(s,{request:r.request,storage});push.bindSettings(rem);
 r.old=true;await push.setAccount('acc-1');
 assert.equal(push.snapshot().versioning,false);
 storage.setItem(KEY_V,JSON.stringify({settings:{frequency:2,hour:9,base:null,known:false,tries:0,id:'tab-b'}}));   // 다른 탭이 상태를 읽기 전에 적은 9시
 rem.set({hour:20});push.sync({settings:{frequency:2,hour:20}});await settled();await flush();
 assert.deepEqual(s.syncs().filter(call=>!call.rejected).map(call=>call.body.settings?.hour),[20]);
 assert.equal(s.stored.settings.hour,20);assert.equal(EDIT_OF(storage),null);
});

test('판: 바탕을 모르는 편집을 옮기다 저장이 실패하면 되풀이하지 않고 멈춘다(GPT push-versions-world-r4 GA7)',async()=>{
 const s=versionedServer(),inner=memory();let writes=0,broken=false;
 const storage={...inner,getItem:key=>inner.getItem(key),removeItem:key=>inner.removeItem(key),
  setItem:(key,value)=>{if(broken&&key===KEY_V){writes++;throw Object.assign(Error('full'),{name:'QuotaExceededError'});}inner.setItem(key,value);}};
 const rem=reminderSettings(),push=on(s,{storage});push.bindSettings(rem);
 s.failWhen=action=>action==='status'?fault(0,'PUSH_UNAVAILABLE'):null;
 await push.setAccount('acc-1');
 push.sync({settings:{frequency:2,hour:18}});   // 상태를 모를 때 바꾼 편집(바탕 모름)
 broken=true;s.failWhen=()=>null;await push.refresh();await settled();
 assert.ok(writes<=2,`저장 시도 ${writes}번`);assert.equal(s.syncs().length,0);
});

test('판: 상태를 읽기 전에 적은 편집이 남은 채 처음 켜도, 켤 때 보낸 1단 값이 이긴다(GPT push-versions-world-r4 GA8)',async()=>{
 const s=versionedServer(),b=browser({answer:'hang'}),rem=reminderSettings({frequency:2,hour:9,since:null}),storage=memory();
 s.active=false;
 const push=makeV(b,s,{now:()=>V0,storage});push.bindSettings(rem);
 s.failWhen=action=>action==='status'?fault(0,'PUSH_UNAVAILABLE'):null;
 await push.setAccount('acc-1');
 push.sync({settings:{frequency:2,hour:9}});
 assert.equal(EDIT_OF(storage).known,false);
 s.failWhen=()=>null;await push.ready();
 const turning=push.enable({settings:{frequency:2,hour:9,since:null},digest:DIGEST('2026-10-21')});
 rem.set({hour:20});   // 권한 창 사이 다른 탭에서 바꿨다
 b.resolvePrompt();await turning;await settled();
 assert.equal(push.snapshot().device.subscribed,true);
 assert.equal(s.stored.settings.hour,20);assert.equal(rem.value.hour,20);assert.equal(EDIT_OF(storage),null);
 assert.equal(s.syncs().filter(call=>call.body.settings?.hour===9).length,0);
});

test('판: 판을 실은 설정 요청이 옛 서버에 400으로 거절되면 지금 편집을 판 없이 보내고, 그 뒤 설정은 그 응답 뒤에 가 마지막 편집이 남는다(GPT push-versions-world-r4 GA9 · GA12)',async()=>{
 const s=versionedServer(),r=rollback(s),storage=memory(),rem=reminderSettings(),push=on(s,{request:r.request,storage});push.bindSettings(rem);
 await push.setAccount('acc-1');
 r.holdSync=true;
 rem.set({hour:8});push.sync({settings:{frequency:2,hour:8}});
 rem.set({hour:9});push.sync({settings:{frequency:2,hour:9}});await flush();
 assert.equal(r.queue.length,1,'한 페이지 안에서는 설정을 하나씩 보낸다');
 r.old=true;
 await r.queue.shift().go();await settled();   // 400 — 지금 편집(9시)을 판 없이 보낸다(붙잡혀 있다)
 assert.equal(r.queue.length,1);assert.equal(r.queue[0].body.settings.hour,9);
 rem.set({hour:20});push.sync({settings:{frequency:2,hour:20}});await settled();
 assert.equal(r.queue.length,1,'판 없는 설정 요청이 날아가는 동안 20시는 기다린다');
 r.holdSync=false;await r.queue.shift().go();await settled();await flush();await settled();
 assert.deepEqual(s.syncs().filter(call=>!call.rejected).map(call=>call.body.settings?.hour),[9,20]);
 assert.equal(s.stored.settings.hour,20);assert.equal(EDIT_OF(storage),null);
});

test('판: 켜기의 요약 바탕은 누를 때 잡는다 — 권한 창 사이에 읽은 다른 기기의 새 판이 누를 때의 요약에 붙지 않는다(GPT push-versions-world-r4 GA11)',async()=>{
 const s=versionedServer(),b=browser({answer:'hang'});let built=0;
 const rem={...reminderSettings(),digest:()=>{built++;return {digest:DIGEST('2026-10-25',[9])};}};
 const push=makeV(b,s,{now:()=>V0});push.bindSettings(rem);
 await push.setAccount('acc-1');await push.ready();   // 다른 기기가 켠 계정(판 V0)
 const turning=push.enable({settings:{frequency:2,hour:null,since:null},digest:DIGEST('2026-10-21',[1])});
 await s.request('sync',{digest:DIGEST('2026-10-22',[3]),versions:{digest:V0,reviews:V0}});   // 다른 기기가 오늘 요약을 썼다
 await push.refresh();
 b.resolvePrompt();await turning;await settled();
 const pressed=s.calls.find(call=>call.action==='subscribe');
 assert.deepEqual(pressed.body.versions,{digest:V0,reviews:V0},'누를 때의 바탕');
 assert.equal(built,1,'거절되어 지금 기록으로 새로 지었다');assert.equal(s.stored.digest.lastStudyDay,'2026-10-25');
});

test('판: 설정이 400으로 거절되면 그 편집(id)만 비우고, 그사이 다른 탭이 적은 더 새 편집은 남겨 보낸다',async()=>{
 const s=versionedServer(),storage=memory(),m=manual(s),rem=reminderSettings(),push=on(s,{storage,request:m.request});push.bindSettings(rem);
 await push.setAccount('acc-1');
 rem.set({hour:9});push.sync({settings:{frequency:2,hour:9}});await flush();
 storage.setItem(KEY_V,JSON.stringify({settings:{frequency:1,hour:20,base:V0,known:true,tries:0,id:'tab-b'}}));   // 다른 탭이 더 새 편집을 적었다
 m.queue.shift().fail(fault(400,'INVALID_SETTINGS'));await settled();
 while(m.queue.length){m.queue.shift().pass();await settled();}
 assert.deepEqual([s.stored.settings.frequency,s.stored.settings.hour],[1,20]);assert.equal(EDIT_OF(storage),null);
});

test('판: 닫힌 페이지가 남긴 바탕 모르는 편집은 다음에 열 때 보내지 않고 서버 것을 들인다 — 그사이 다른 기기의 설정을 덮지 않는다(설계 검토 11-21 밤 1)',async()=>{
 const s=versionedServer(),storage=memory(),locks=fakeLocks(),rem=reminderSettings();
 const t1=on(s,{storage,browser:{locks}});t1.bindSettings(rem);
 s.failWhen=action=>action==='status'?fault(0,'PUSH_UNAVAILABLE'):null;
 await t1.setAccount('acc-1');
 rem.set({hour:9});t1.sync({settings:{frequency:2,hour:9}});
 assert.equal(EDIT_OF(storage).known,false);
 t1.dispose();await settled();   // 상태가 서기 전에 닫았다
 s.failWhen=()=>null;
 await s.request('sync',{settings:{frequency:2,hour:15},versions:{settings:V0}});   // 휴대폰에서 15시
 const t2=on(s,{storage,browser:{locks}});t2.bindSettings(rem);
 await t2.setAccount('acc-1');await settled();
 assert.equal(s.stored.settings.hour,15);assert.equal(rem.value.hour,15);assert.equal(EDIT_OF(storage),null);
 assert.equal(s.syncs().filter(call=>call.body.settings?.hour===9).length,0);
});

test('판: 닫힌 페이지가 남긴 편집의 바탕이 서버 판과 같으면 다음에 연 탭이 넘겨받아 보낸다(설계 주인 규칙 5)',async()=>{
 const s=versionedServer(),storage=memory(),locks=fakeLocks(),rem=reminderSettings();
 const t1=on(s,{storage,browser:{locks}});t1.bindSettings(rem);
 await t1.setAccount('acc-1');
 s.failWhen=action=>action==='sync'?fault(0,'PUSH_UNAVAILABLE'):null;
 rem.set({hour:20});t1.sync({settings:{frequency:2,hour:20}});await settled();
 t1.dispose();await settled();
 s.failWhen=()=>null;
 const t2=on(s,{storage,browser:{locks}});t2.bindSettings(rem);
 await t2.setAccount('acc-1');await settled();
 assert.equal(s.stored.settings.hour,20);assert.equal(EDIT_OF(storage),null);
});

test('판: 옛 서버 구간에서 바꾼 설정은 판 키에 적지 않는다 — 응답 전에 닫아도 다음에 열 때 보낼 편집이 남지 않는다(설계 검토 11-21 밤 2)',async()=>{
 const s=versionedServer(),r=rollback(s),storage=memory(),locks=fakeLocks(),rem=reminderSettings();
 const t1=on(s,{request:r.request,storage,browser:{locks}});t1.bindSettings(rem);
 await t1.setAccount('acc-1');
 r.old=true;await t1.refresh();assert.equal(t1.snapshot().versioning,false);
 r.holdSync=true;
 rem.set({hour:9});t1.sync({settings:{frequency:2,hour:9}});await flush();
 assert.equal(r.queue.length,1);assert.equal(EDIT_OF(storage),null,'옛 서버 구간은 판 키를 쓰지 않는다');
 t1.dispose();await settled();   // 응답 전에 닫았고 요청은 닿지 못했다
 r.old=false;r.holdSync=false;r.queue.length=0;
 await s.request('sync',{settings:{frequency:2,hour:15},versions:{settings:V0}});   // 다시 올린 뒤 휴대폰 15시
 const t2=on(s,{storage,browser:{locks}});t2.bindSettings(rem);
 await t2.setAccount('acc-1');await settled();
 assert.equal(s.stored.settings.hour,15);assert.equal(rem.value.hour,15);assert.equal(EDIT_OF(storage),null);
});

test('판: 옛 서버로 드러나면 이 페이지의 보내지 못한 편집은 버린다 — 판을 아는 서버로 돌아와도 그 편집이 다른 기기의 새 설정을 덮지 않는다(규칙 6 · 설계 검토 11-21 밤 2)',async()=>{
 const s=versionedServer(),r=rollback(s),storage=memory(),rem=reminderSettings(),push=on(s,{request:r.request,storage});push.bindSettings(rem);
 await push.setAccount('acc-1');
 s.failWhen=action=>action==='sync'?fault(0,'PUSH_UNAVAILABLE'):null;
 rem.set({hour:9});push.sync({settings:{frequency:2,hour:9}});await settled();   // 망이 끊겨 남았다
 assert.equal(EDIT_OF(storage)?.hour,9);
 r.old=true;await push.refresh();await settled();   // 다음 상태 읽기가 옛 서버를 본다
 assert.equal(EDIT_OF(storage),null,'옛 서버 구간은 지금 라이브처럼 보내지 못한 설정을 버린다');
 s.failWhen=()=>null;r.old=false;
 await s.request('sync',{settings:{frequency:2,hour:15},versions:{settings:V0}});   // 다시 올린 뒤 휴대폰 15시
 await push.refresh();await settled();
 assert.equal(s.stored.settings.hour,15);assert.equal(rem.value.hour,15);
 assert.equal(s.syncs().filter(call=>call.body.settings?.hour===9).length,1,'망이 끊긴 첫 시도 말고는 9시를 보내지 않는다');
});

test('판: 다른 탭이 맡은 편집은 이 탭의 요청에 싣지 않는다 — 편집은 쓴 페이지만 보낸다(설계 검토 11-21 밤 3)',async()=>{
 const s=versionedServer(),storage=memory(),locks=fakeLocks(),m=manual(s),rem=reminderSettings();
 const a=on(s,{storage,request:m.request,browser:{locks}}),b=on(s,{storage,request:m.request,browser:{locks}});a.bindSettings(rem);b.bindSettings(rem);
 await a.setAccount('acc-1');await b.setAccount('acc-1');
 rem.set({hour:9});a.sync({settings:{frequency:2,hour:9}});
 rem.set({hour:20});a.sync({settings:{frequency:2,hour:20}});await flush();   // A의 20시는 9시의 응답을 기다린다
 b.sync({digest:DIGEST('2026-10-23')});await flush();
 assert.equal(m.queue.length,2);
 assert.equal(m.queue[1].body.settings,undefined,'B의 요약 요청은 A의 편집을 싣지 않는다');
 while(m.queue.length){m.queue.shift().pass();await settled();}
 assert.equal(s.stored.settings.hour,20);assert.equal(EDIT_OF(storage),null);
 assert.equal(s.syncs().filter(call=>call.body.settings?.hour===20).length,1);
});

test('판: 계정을 바꾼 탭이 남긴 옛 계정의 편집은 다른 탭이 넘겨받는다 — 페이지 잠금은 계정마다다(설계 검토 11-21 밤 1)',async()=>{
 const s=versionedServer(),storage=memory(),locks=fakeLocks(),rem=reminderSettings();
 const a=on(s,{storage,browser:{locks}});a.bindSettings(rem);
 await a.setAccount('acc-1');
 s.failWhen=action=>action==='sync'?fault(0,'PUSH_UNAVAILABLE'):null;
 rem.set({hour:20});a.sync({settings:{frequency:2,hour:20}});await settled();
 assert.equal(EDIT_OF(storage)?.hour,20);
 s.failWhen=action=>action==='status'||action==='sync'?fault(0,'PUSH_UNAVAILABLE'):null;
 await a.setAccount('acc-2');await settled();   // 같은 탭이 다른 계정으로 — acc-1 편집은 판 키에 남는다
 s.failWhen=()=>null;
 const b=on(s,{storage,browser:{locks}});b.bindSettings(rem);
 await b.setAccount('acc-1');await settled();
 assert.equal(s.stored.settings.hour,20);assert.equal(EDIT_OF(storage),null);
 a.dispose();b.dispose();
});

test('판: 다시 보내려고 바탕을 옮긴 편집이 보내기 전에 또 낡으면 서버 것을 들인다 — 다시 보내기는 한 번(규칙 4)',async()=>{
 const s=versionedServer(),storage=memory(),m=manual(s),rem=reminderSettings(),push=on(s,{storage,request:m.request});push.bindSettings(rem);
 await push.setAccount('acc-1');
 rem.set({hour:9});push.sync({settings:{frequency:2,hour:9}});
 rem.set({hour:20});push.sync({settings:{frequency:2,hour:20}});await flush();
 await s.request('sync',{settings:{frequency:2,hour:15},versions:{settings:V0}});   // 다른 기기 15시
 m.queue.shift().pass();await settled();   // 9시 거절 — 기다리던 20시를 새 판으로 옮겨 한 번 보낸다
 assert.equal(m.queue.length,1);assert.equal(EDIT_OF(storage)?.tries,1);
 m.queue.shift().fail(fault(0,'PUSH_UNAVAILABLE'));await settled();   // 망이 끊겨 닿지 못했다
 await s.request('sync',{settings:{frequency:2,hour:7},versions:{settings:V0+1}});   // 다른 기기 7시
 await push.refresh();await settled();
 while(m.queue.length){m.queue.shift().pass();await settled();}
 assert.equal(s.stored.settings.hour,7);assert.equal(rem.value.hour,7);assert.equal(EDIT_OF(storage),null);
 push.dispose();
});

test('판: 한 페이지는 요약을 실은 요청도 하나씩 보낸다 — 앞 요약이 받히면 뒤 요약은 그 판을 바탕으로 가 자기 요약끼리 거절하지 않는다(설계 검토 11-21 밤 3)',async()=>{
 const s=versionedServer(),m=manual(s),storage=memory(),rem=reminderSettings(),push=on(s,{storage,request:m.request});push.bindSettings(rem);
 await push.setAccount('acc-1');
 push.sync({digest:DIGEST('2026-10-23')});await flush();
 push.sync({digest:DIGEST('2026-10-24')});await flush();   // 날이 바뀌어 바로 보낼 요약
 assert.equal(m.queue.length,1,'앞 요약의 응답을 기다린다');
 m.queue.shift().pass();await settled();
 assert.equal(m.queue.length,1);
 const second=m.queue[0].body;
 assert.equal(second.digest.lastStudyDay,'2026-10-24');assert.equal(second.versions.digest,V0+1,'앞 요약이 올린 판을 바탕으로');assert.equal(second.versions.reviews,V0+1);
 m.queue.shift().pass();await settled();
 assert.equal(s.stored.digest.lastStudyDay,'2026-10-24');
 assert.equal(s.syncs().length,2,'자기 요약끼리 거절해 다시 보내지 않는다');
 push.dispose();
});

test('판: 넘겨받은 닫힌 페이지의 편집이 보내는 사이 다른 기기의 쓰기로 거절되면 다시 보내지 않고 서버 것을 들인다(설계 주인 규칙 5, 섞기 시드 97)',async()=>{
 const s=versionedServer(),storage=memory(),locks=fakeLocks(),m=manual(s),rem=reminderSettings();
 const t1=on(s,{storage,browser:{locks}});t1.bindSettings(rem);
 await t1.setAccount('acc-1');
 s.failWhen=action=>action==='sync'?fault(0,'PUSH_UNAVAILABLE'):null;
 rem.set({hour:20});t1.sync({settings:{frequency:2,hour:20}});await settled();
 t1.dispose();await settled();
 s.failWhen=()=>null;
 const before=s.syncs().filter(call=>call.body.settings?.hour===20).length;   // 닫히기 전 실패한 시도
 const t2=on(s,{storage,request:m.request,browser:{locks}});t2.bindSettings(rem);
 await t2.setAccount('acc-1');await settled();
 assert.equal(m.queue.length,1,'넘겨받아 한 번 보낸다');
 await s.request('sync',{settings:{frequency:2,hour:15},versions:{settings:V0}});   // 그사이 휴대폰 15시
 while(m.queue.length){m.queue.shift().pass();await settled();}
 assert.equal(s.stored.settings.hour,15);assert.equal(rem.value.hour,15);assert.equal(EDIT_OF(storage),null);
 assert.equal(s.syncs().filter(call=>call.body.settings?.hour===20).length-before,1,'거절 뒤 다시 보내지 않는다');
});

test('판: 다른 탭은 열린 탭의 날아가는 편집을 지우지 않는다 — 그 탭이 거절 뒤 한 번 다시 보내 20시가 남는다(설계 검토 11-21 밤 2)',async()=>{
 const s=versionedServer(),storage=memory(),locks=fakeLocks(),m=manual(s),rem=reminderSettings();
 const a=on(s,{storage,request:m.request,browser:{locks}}),b=on(s,{storage,request:m.request,browser:{locks}});a.bindSettings(rem);b.bindSettings(rem);
 await a.setAccount('acc-1');await b.setAccount('acc-1');
 await s.request('sync',{settings:{frequency:2,hour:14},versions:{settings:V0}});   // 휴대폰 14시
 await a.refresh();await settled();   // A만 새 판을 안다
 rem.set({hour:20});b.sync({settings:{frequency:2,hour:20}});await flush();   // B는 옛 바탕으로 20시
 await a.refresh();await settled();   // A가 응답을 하나 더 받는다 — B의 편집을 건드리지 않는다
 assert.equal(EDIT_OF(storage)?.hour,20);assert.equal(rem.value.hour,20,'A가 서버 설정을 1단에 들이지 않았다');
 while(m.queue.length){m.queue.shift().pass();await settled();}
 assert.equal(s.stored.settings.hour,20);assert.equal(rem.value.hour,20);
 assert.equal(s.syncs().filter(call=>call.body.settings?.hour===20).length,2,'B가 한 번 다시 보냈다');
});

test('판: Web Locks가 없으면 다른 탭의 편집은 5분 넘게 묵었을 때만 주인이 없다고 본다',async()=>{
 let time=V0;
 const s=versionedServer(),storage=memory(),rem=reminderSettings(),push=on(s,{storage,now:()=>time});push.bindSettings(rem);
 storage.setItem(KEY_V,JSON.stringify({settings:{frequency:2,hour:20,base:V0,known:true,tries:0,id:'tab-b',page:'page-b',at:V0}}));
 await push.setAccount('acc-1');await settled();
 assert.equal(EDIT_OF(storage)?.hour,20,'갓 쓴 편집은 그 탭이 맡는다');assert.equal(s.syncs().length,0);
 time+=6*60000;await push.refresh();await settled();
 assert.equal(s.stored.settings.hour,20,'묵은 편집은 넘겨받아 보낸다(바탕이 같다)');assert.equal(EDIT_OF(storage),null);
});

test('판: 앞 요약이 받히면 그 뒤에 모은 요약의 바탕도 새 판으로 옮겨 자기 요약끼리 거절하지 않는다(설계 검토 3)',async()=>{
 const s=versionedServer(),m=manual(s);let built=0;
 const rem={...reminderSettings(),digest:()=>{built++;return {digest:DIGEST('2026-10-25',[9])};}};
 const push=on(s,{request:m.request});push.bindSettings(rem);
 await push.setAccount('acc-1');
 push.sync({digest:DIGEST('2026-10-21',[1])});await flush();   // 바로 간다(바탕 V0)
 push.sync({digest:DIGEST('2026-10-21',[2])});   // 모은다(바탕 V0)
 m.queue.shift().pass();await settled();   // 앞 요약이 받힌다(V0+1)
 push.flush();await settled();
 while(m.queue.length){m.queue.shift().pass();await settled();}
 const second=s.syncs().find(call=>call.body.digest?.reviews?.[0]===2);
 assert.deepEqual(second.body.versions,{digest:V0+1,reviews:V0+1});assert.equal(built,0,'거절되지 않아 새로 짓지 않았다');
 assert.deepEqual(s.stored.reviews,[2]);
});

test('판: 앞 설정 요청을 기다리던 이 탭의 편집은 그사이 다른 기기가 써서 바탕이 낡아도 한 번 보낸다 — 열린 탭의 마지막 뜻(규칙 4)',async()=>{
 const s=versionedServer(),storage=memory(),m=manual(s),rem=reminderSettings(),push=on(s,{storage,request:m.request});push.bindSettings(rem);
 await push.setAccount('acc-1');
 rem.set({hour:9});push.sync({settings:{frequency:2,hour:9}});
 rem.set({hour:20});push.sync({settings:{frequency:2,hour:20}});await flush();
 await s.request('sync',{settings:{frequency:2,hour:15},versions:{settings:V0}});   // 다른 기기 15시
 m.queue.shift().pass();await settled();   // 9시는 거절된다 — 기다리던 20시는 바탕이 낡았다
 while(m.queue.length){m.queue.shift().pass();await settled();}
 assert.equal(s.stored.settings.hour,20);assert.equal(rem.value.hour,20);assert.equal(EDIT_OF(storage),null);
 assert.equal(s.syncs().filter(call=>call.body.settings?.hour===20).length,1);
});

test('판: 권한 창 사이에 옛 서버로 되돌려도 켜기는 판 없이 다시 보내 켜진다(GPT push-versions-world-r2 GA2)',async()=>{
 const s=versionedServer(),r=rollback(s),b=browser({answer:'hang'});
 const push=makeV(b,s,{now:()=>V0,request:r.request});
 await push.setAccount('acc-1');await push.ready();
 const turning=push.enable({settings:{frequency:2,hour:null,since:null},digest:DIGEST('2026-10-21')});
 r.old=true;await push.refresh();
 assert.equal(push.snapshot().versioning,false);
 b.resolvePrompt();await turning;await settled();
 assert.equal(push.snapshot().device.subscribed,true,'켜졌다');
 assert.equal(s.stored.digest.lastStudyDay,'2026-10-21');
 const s2=versionedServer(),r2=rollback(s2),push2=makeV(browser(),s2,{now:()=>V0,request:r2.request});
 await push2.setAccount('acc-1');await push2.ready();
 r2.old=true;   // 상태를 다시 읽기 전에 되돌렸다 — subscribe가 판 때문에 400이면 판 없이 한 번 다시 보낸다
 await push2.enable({settings:{frequency:2,hour:null,since:null},digest:DIGEST('2026-10-21')});await settled();
 assert.equal(push2.snapshot().device.subscribed,true);
 assert.deepEqual(s2.calls.filter(call=>call.action==='subscribe').map(call=>!!call.body.versions),[true,false]);
});

test('판: 로그아웃은 보낼 것이 없으면 판 키를 지우고, 늦은 응답 · 계정이 바뀌기 전의 1단 다시 잡기가 판 키를 다시 쓰지 않는다 · 실패하면 막기를 푼다(GPT push-versions-world GA12 · 설계 검토 4)',async()=>{
 const s=versionedServer(),m=manual(s),storage=memory(),rem=reminderSettings();
 const push=on(s,{storage,request:m.request});push.bindSettings(rem);
 await push.setAccount('acc-1');
 rem.set({hour:20});push.sync({settings:{frequency:2,hour:20}});await flush();m.queue.shift().pass();await settled();
 assert.equal(EDIT_OF(storage),null,'받혀 편집을 비웠다');
 push.sync({digest:DIGEST('2026-10-22')});await flush();const release=m.queue.shift().late();
 await push.logout();
 assert.equal(storage.getItem(KEY_V),null,'보낼 것이 없어 지웠다');
 const seen=push.snapshot().versions;
 release();await settled();
 assert.equal(storage.getItem(KEY_V),null,'늦은 응답이 다시 쓰지 않는다');
 assert.deepEqual(push.snapshot().versions,seen,'늦은 응답을 상태로 적지 않는다');
 rem.set({hour:9});push.sync({settings:{frequency:2,hour:9}});await settled();
 assert.equal(storage.getItem(KEY_V),null,'계정이 바뀌기 전에는 쓰지 않는다');
 assert.equal(m.queue.length,0,'새 요청도 내지 않는다');
 await push.resume();
 push.sync({settings:{frequency:2,hour:9}});await flush();
 assert.equal(m.queue.at(-1)?.body.settings?.hour,9,'로그아웃이 실패하면 다시 보낸다');
});

test('판: 마지막 기기를 끌 때 보내지 못한 편집이 없으면 서버 설정을 돌려주고, 다음 켜기는 설정 바탕 없이 1단 설정으로 새 계획을 켠다(설계 검토 6)',async()=>{
 let time=V0;
 const s=versionedServer({clock:()=>time}),storage=memory(),rem=reminderSettings();
 const push=makeV(browser({registered:true,subscribed:SUB}),s,{storage,now:()=>time});push.bindSettings(rem);
 await push.setAccount('acc-1');
 rem.set({hour:9});push.sync({settings:{frequency:2,hour:9}});await settled();
 time+=1000;s.stored.settings={frequency:2,hour:20,since:time};s.stored.versions.settings+=1;
 const result=await push.disable();rem.set({hour:result.settings.hour});
 assert.equal(EDIT_OF(storage),null);
 time+=1000;await push.ready();await push.enable({settings:{frequency:2,hour:20,since:null},digest:DIGEST('2026-10-21')});await settled();
 assert.equal(s.stored.settings.hour,20);assert.equal(rem.value.hour,20);
 assert.equal(s.calls.find(call=>call.action==='subscribe').body.versions?.settings,undefined);
});

test('판: 마지막 기기를 끄는 사이 다른 탭이 바꾼 설정은 지우지 않고 1단에도 남긴다(GPT push-versions-world-r2 GA4)',async()=>{
 const s=versionedServer({settings:{frequency:2,hour:9,since:null}}),r=rollback(s),storage=memory(),rem=reminderSettings({frequency:2,hour:9,since:null});
 const tabA=on(s,{storage,request:r.request}),tabB=on(s,{storage});tabA.bindSettings(rem);tabB.bindSettings(rem);
 await tabA.setAccount('acc-1');await tabB.setAccount('acc-1');
 r.holdUnsubscribe=[];const off=tabA.disable();await flush();await flush();
 s.failWhen=action=>action==='sync'?fault(0,'PUSH_UNAVAILABLE'):null;
 rem.set({hour:20});tabB.sync({settings:{frequency:2,hour:20}});await settled();
 for(const release of r.holdUnsubscribe.splice(0))release();r.holdUnsubscribe=null;
 const result=await off;
 assert.equal(EDIT_OF(storage)?.hour,20,'다른 탭의 편집이 남는다');
 assert.equal(result.settings,undefined,'1단에 넣을 서버 설정을 돌려주지 않는다');
});

test('판: 마지막 기기를 끈 뒤 다른 기기가 새 계획을 켜면 이 기기는 새 계획의 설정을 따른다(GPT push-versions-world-r2 GA5)',async()=>{
 let time=V0;
 const s=versionedServer({clock:()=>time}),storageA=memory(),storageB=memory(),remA=reminderSettings(),remB=reminderSettings({frequency:2,hour:9,since:null});
 const a=makeV(browser({registered:true,subscribed:SUB}),s,{storage:storageA,now:()=>time});a.bindSettings(remA);
 await a.setAccount('acc-1');
 remA.set({hour:20});a.sync({settings:{frequency:2,hour:20}});await settled();
 await a.disable();remA.set({hour:20});
 // B 기기는 옛 계획 때 바꾸고 보내지 못한 9시를 들고 있다.
 storageB.setItem(KEY_V,JSON.stringify({settings:{frequency:2,hour:9,base:V0,known:true,tries:0}}));
 time+=60000;
 const b=makeV(browser(),s,{storage:storageB,now:()=>time});b.bindSettings(remB);
 await b.setAccount('acc-1');await b.ready();await b.enable({settings:{frequency:2,hour:9,since:null},digest:DIGEST('2026-10-22')});await settled();
 assert.equal(s.stored.settings.hour,9,'새 계획은 B의 9시로 섰다');assert.equal(EDIT_OF(storageB),null);
 await a.refresh();await settled();
 assert.equal(remA.value.hour,9,'A는 새 계획의 9시를 들인다');
});

test('판: 켜기 결과를 적으며 시작한 설정 응답도 계획 화면에 적힌다 — 켜기 전에 보내지 못한 편집은 바탕이 같으면 켠 뒤 보낸다(GPT push-versions-world-r2 GA6)',async()=>{
 const s=versionedServer({settings:{frequency:2,hour:9,since:null}}),rem=reminderSettings({frequency:2,hour:9,since:null});
 const push=makeV(browser(),s,{now:()=>V0});push.bindSettings(rem);
 await push.setAccount('acc-1');await push.ready();
 s.failWhen=action=>action==='sync'?fault(0,'PUSH_UNAVAILABLE'):null;
 rem.set({hour:20});push.sync({settings:{frequency:2,hour:20}});await settled();
 s.failWhen=()=>null;
 await push.enable({settings:{frequency:2,hour:20,since:null},digest:DIGEST('2026-10-21')});await settled();
 assert.equal(s.stored.settings.hour,20);
 assert.equal(push.snapshot().plan.hour,20,'계획 화면도 20시다');
});

test('판: 켜기 전에 시작한 status가 켜기 뒤에 와도 방금 켠 이 브라우저 구독과 주인 기록을 지우지 않는다(설계 검토 7)',async()=>{
 const s=versionedServer(),storage=memory(),anonymous=[];let hold=null;
 const request=(action,body={},options={})=>{
  if(action==='status'&&hold){const reply=s.request(action,body,options).then(data=>({...data,device:{subscribed:false}}));return new Promise(resolve=>hold.push(()=>resolve(reply)));}
  return s.request(action,body,options);
 };
 const push=makeV(browser(),s,{storage,now:()=>V0,request,anonymous:(action,body)=>{anonymous.push([action,body]);return Promise.resolve({ok:true,removed:true});}});
 await push.setAccount('acc-1');await push.ready();
 hold=[];const reading=push.refresh();await flush();await flush();
 assert.equal(hold.length,1,'status가 붙잡혔다');
 await push.enable({settings:{frequency:2,hour:null,since:null},digest:DIGEST('2026-10-21')});
 assert.equal(push.snapshot().device.subscribed,true);
 hold.shift()();hold=null;await reading;await settled();
 assert.ok(storage.getItem('synk.world.push.v1'),'주인 기록이 남는다');
 assert.equal(anonymous.length,0,'로그인 없이 끄지 않았다');
 assert.equal(push.snapshot().device.subscribed,true);
});

test('판: 기기 시계를 뒤로 맞춰도 모으던 요약은 5분 안에 나간다 — 지난 때는 performance.now()로도 잰다',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 let device=V0,perf=1000;
 const b=browser({registered:true,subscribed:SUB,extra:{performance:{now:()=>perf}}});
 const s=versionedServer(),push=makeV(b,s,{now:()=>device});
 await push.setAccount('acc-1');
 push.sync({digest:DIGEST('2026-10-22',[1])});await flush();
 device+=60000-3600000;perf+=60000;   // 1분 뒤, 기기 시계를 한 시간 뒤로 맞췄다
 push.sync({digest:DIGEST('2026-10-22',[2])});await flush();
 const sent=s.syncs().length;
 t.mock.timers.tick(4*60000);await flush();
 assert.equal(s.syncs().length,sent+1,'모은 요약이 5분 묶음이 차서 나갔다');
 assert.deepEqual(s.stored.reviews,[2]);
});

// ── 섞기 시험(설계 검토 11-21 밤 「더 단순한 구조」 4) ──
// 같은 브라우저의 탭 두세 개(판 키 · 1단 설정 · Web Locks를 함께 쓴다)와 다른 기기 하나를 두고, 시드를 고정한 무작위 차례로 편집 · 응답 · 실패 · 다른
// 기기의 쓰기 · 탭 닫기와 열기 · 상태 다시 읽기를 섞는다. 끝에 남은 요청을 모두 받고 열린 탭이 다시 읽은 뒤 네 가지를 본다.
// (가) 닫힌 페이지의 편집은 그 페이지가 닫힌 뒤에 다른 기기가 쓴 것을 덮지 않는다(열려 있는 동안 본 쓰기는 규칙 4대로 한 번 이길 수 있다). (나) 끝까지 열려 있던 탭의 마지막 편집은 받혔거나, 더 새 편집에 밀렸거나, 만든 뒤
// 다른 쓰기가 있었다(까닭 없이 사라지지 않는다). (다) 한 편집은 두 번 거절된 뒤 다시 가지 않는다. (라) 끝나면 서버 설정과 1단 설정이 같고 판 키가 비었다.
async function shuffleRun(seed,steps=40){
 let x=(seed*2654435761)%4294967296||1;const rand=n=>{x^=x<<13;x>>>=0;x^=x>>>17;x^=x<<5;x>>>=0;return x%n;};
 let time=V0,step=0;
 const s=versionedServer({clock:()=>time}),storage=memory(),locks=fakeLocks(),rem=reminderSettings();
 const queue=[],writes=[],edits=new Map(),rejected=new Map(),problems=[];
 const keyId=()=>JSON.parse(storage.getItem(KEY_V)||'null')?.settings?.id??null;
 const request=(action,body={},options={})=>{
  if(action!=='sync')return s.request(action,body,options);
  const id=body.settings?keyId():null;
  if(id&&(rejected.get(id)||0)>=2)problems.push(`(다) 두 번 거절된 편집 ${id}을 또 보냈다`);
  return new Promise((resolve,reject)=>queue.push({fail:()=>reject(fault(0,'PUSH_UNAVAILABLE')),go:()=>{
   const reply=s.request(action,body,options);
   reply.then(data=>{if(!id||!data?.account?.active)return;
    if(data.applied?.settings===true){writes.push({id,step});const e=edits.get(id);if(e)e.accepted=true;}
    else rejected.set(id,(rejected.get(id)||0)+1);});
   resolve(reply);}}));
 };
 const tabs=[];
 const open=async()=>{const tab=makeV(browser({registered:true,subscribed:SUB,locks}),s,{now:()=>time,storage,request});tab.bindSettings(rem);tab.closed=false;tabs.push(tab);await tab.setAccount('acc-1');};
 const quiet=async()=>{for(let i=0;i<4;i++)await flush();};
 let lastKey=null;
 const watchKey=()=>{const id=keyId();if(lastKey&&id!==lastKey&&id){const e=edits.get(lastKey);if(e&&!e.accepted)e.superseded=true;}lastKey=id;};
 await open();await open();
 for(step=1;step<=steps;step++){
  time+=1000;const pick=rand(12),live=tabs.filter(tab=>!tab.closed);
  if(pick<4&&live.length){
   const tab=live[rand(live.length)],hour=[9,15,18,20,21][rand(5)];
   rem.set({hour});tab.sync({settings:{frequency:2,hour}});
   const id=keyId();if(id&&!edits.has(id)){edits.set(id,{id,tab,step,hour});tab.last=id;}
  }else if(pick<7&&queue.length){const item=queue.splice(rand(queue.length),1)[0];if(rand(10)<8)item.go();else item.fail();}
  else if(pick<8){await s.request('sync',{settings:{frequency:2,hour:[7,8,22][rand(3)]}});writes.push({id:'other',step});}
  else if(pick<9&&live.length>1){const tab=live[rand(live.length)];tab.closed=true;tab.closedAt=step;tab.dispose();}
  else if(pick<10&&live.length<3)await open();
  else if(live.length)void live[rand(live.length)].refresh();
  await quiet();watchKey();
 }
 // 마무리: 남은 요청을 받고, 열린 탭이 다시 읽고 다시 보낸다 — 더 나갈 것이 없을 때까지.
 for(let round=0;round<30;round++){
  step++;
  while(queue.length){queue.shift().go();await quiet();watchKey();}
  for(const tab of tabs.filter(tab=>!tab.closed)){tab.retry();await tab.refresh();await quiet();watchKey();}
  if(!queue.length)break;
 }
 const last=writes.at(-1);
 // (가)
 for(const w of writes){const e=edits.get(w.id);if(!e||!e.tab.closed||e.tab.closedAt>=w.step)continue;
  if(writes.some(o=>o.id==='other'&&o.step>e.tab.closedAt&&o.step<w.step))problems.push(`(가) 닫힌 페이지(${e.tab.closedAt}차례에 닫음)의 편집 ${w.id}가 닫힌 뒤 다른 기기의 쓰기를 덮었다(${w.step}차례)`);}
 // (나)
 for(const tab of tabs.filter(tab=>!tab.closed&&tab.last)){const e=edits.get(tab.last);
  if(e.accepted||e.superseded)continue;
  if(!writes.some(w=>w.step>=e.step&&w.id!==e.id))problems.push(`(나) 열린 탭의 마지막 편집 ${e.id}(${e.hour}시, ${e.step}차례)이 까닭 없이 사라졌다`);}
 // (라)
 if(s.stored.settings.hour!==rem.value.hour)problems.push(`(라) 서버 ${s.stored.settings.hour}시 · 1단 ${rem.value.hour}시`);
 if(keyId())problems.push(`(라) 판 키가 남았다: ${storage.getItem(KEY_V)}`);
 for(const tab of tabs)tab.dispose();
 return {problems,last};
}

test('판: 섞기 — 탭 두세 개와 다른 기기 하나의 차례를 섞어도 (가) 닫힌 페이지가 새 쓰기를 덮지 않고 (나) 열린 탭의 마지막 편집이 까닭 없이 사라지지 않고 (다) 두 번 거절 뒤 다시 가지 않고 (라) 끝나면 서버와 1단이 같다(설계 검토 11-21 밤 4)',async()=>{
 const seeds=Number(process.env.WORLD_PUSH_SHUFFLE_SEEDS||200),failed=[];
 for(let seed=1;seed<=seeds;seed++){const {problems}=await shuffleRun(seed);if(problems.length)failed.push(`시드 ${seed}: ${problems.join(' / ')}`);if(failed.length>=5)break;}
 assert.deepEqual(failed,[]);
});
