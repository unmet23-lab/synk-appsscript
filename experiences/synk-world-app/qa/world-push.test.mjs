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
function browser({userAgent=DESKTOP,permission='default',answer='granted',registered=false,subscribed=null,secure=true,locks=null,extra={},endpoints=null}={}){
 const log=[];let current=subscribed,perm=permission,pendingPrompt=null;
 const subscription=endpoint=>({endpoint,toJSON(){return {endpoint,expirationTime:null,keys:{p256dh:KEY,auth:'A'.repeat(22)}};},async unsubscribe(){log.push(['unsubscribe',endpoint]);if(current?.endpoint===endpoint)current=null;return true;}});
 if(current)current=subscription(current);
 const pushManager={async getSubscription(){return current;},subscribe(options){log.push(['subscribe',options.userVisibleOnly]);
  if(answer==='hang')return new Promise(resolve=>{pendingPrompt=()=>{perm='granted';current=subscription('https://fcm.googleapis.com/fcm/send/late');resolve(current);};});
  if(answer==='denied'){perm='denied';return Promise.reject(Object.assign(new Error('denied'),{name:'NotAllowedError'}));}
  perm='granted';current=current||subscription(endpoints?.shift()||'https://fcm.googleapis.com/fcm/send/new');return Promise.resolve(current);}};   // endpoints: 새 구독마다 다른 주소(차례대로)
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
 // 서버에서 지워진 이 계정 구독(정리·404) → 지우기만 하지 않고 새 구독으로 다시 잇는다(설계 주인 11-23 불변식 — 아래 「다시 잇기」 시험들).
 let storage=memory();storage.setItem(PUSH_RECORD_KEY,JSON.stringify({accountId:'acc-1',deviceId:'dev-1',endpoint:'https://fcm.googleapis.com/fcm/send/old'}));
 let b=browser({registered:true,subscribed:'https://fcm.googleapis.com/fcm/send/old',permission:'granted'}),s=server({device:false}),push=make(b,s,{storage});
 push.bindSettings(withDigest(reminderSettings()));await push.setAccount('acc-1');await settled();
 assert.equal(b.current?.endpoint,'https://fcm.googleapis.com/fcm/send/new');assert.equal(JSON.parse(storage.getItem(PUSH_RECORD_KEY)).endpoint,'https://fcm.googleapis.com/fcm/send/new');
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
 let hold=false,active=true,failWhen=()=>null,planId=1;
 const view=()=>({frequency:stored.settings.frequency,hour:stored.settings.hour,since:stored.settings.since,next:1,log:[]});
 const reply=extra=>({ok:true,accountId:'acc-1',enabled:true,publicKey:KEY,device:{subscribed:true,deviceId:'dev-1'},account:{active,devices:active?1:0},
  plan:active?view():null,versions:active?{...stored.versions}:null,planId:active?planId:null,versioning:'base',...extra});
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
    const now=clock(),known=Array.isArray(body.digest?.reviews);active=true;planId++;
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
// 다시 잇기가 쓰는 1단 묶음 — 설정에 더해 지금 기록으로 지은 요약을 준다(world-reminder-device의 digest()와 같은 꼴).
const withDigest=rem=>Object.assign(rem,{digest:()=>({digest:DIGEST('2026-10-21')})});
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
 const strip=data=>{const {versioning,versions,applied,planId,...rest}=data;return rest;};
 const send=(action,body,options)=>{const old=state.old;
  if(state.old&&body.versions){s.calls.push({action,body,options,rejected:true});return Promise.reject(fault(400,'INVALID_ACTION'));}
  return s.request(action,body,options).then(data=>old?strip(data):data);
 };
 state.request=(action,body={},options={})=>{
  if(action==='status'&&state.holdStatus){const reply=send(action,body,options);return new Promise((resolve,reject)=>state.holdStatus.push(()=>reply.then(resolve,reject)));}
  if(action==='unsubscribe'&&state.holdUnsubscribe){const reply=send(action,body,options);return new Promise((resolve,reject)=>state.holdUnsubscribe.push(()=>reply.then(resolve,reject)));}
  if(action==='sync'&&state.holdSync)return new Promise((resolve,reject)=>state.queue.push({body,options,go:()=>send(action,body,options).then(resolve,reject),
   late:()=>{const reply=send(action,body,options);return ()=>reply.then(resolve,reject);}}));
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
 await push.logout({hold:true});assert.equal(storage.getItem(KEY_V),null);
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

test('판: 설정 값과 바탕은 한 덩어리로 나가고, 로그아웃한 탭의 확인받지 못한 편집은 탭이 함께 쓰는 판 키에서 지운다 — 남은 탭은 넘겨받지 않고 서버 설정을 들인다(GPT push-versions-world GA2 · 설계 주인 11-23)',async()=>{
 const s=versionedServer(),storage=memory(),locks=fakeLocks(),rem=reminderSettings();
 const tabA=on(s,{storage,browser:{locks}}),tabB=on(s,{storage,browser:{locks}});tabA.bindSettings(rem);tabB.bindSettings(rem);
 await tabA.setAccount('acc-1');await tabB.setAccount('acc-1');
 s.failWhen=action=>action==='sync'?fault(0,'PUSH_UNAVAILABLE'):null;
 rem.set({hour:9});tabA.sync({settings:{frequency:2,hour:9}});await settled();
 rem.set({hour:20});tabB.sync({settings:{frequency:2,hour:20}});await settled();
 assert.ok(s.syncs().every(call=>call.body.versions?.settings===V0),'값마다 그때의 바탕이 붙었다');
 const sent=s.syncs().length;
 await tabB.logout({hold:true});await settled();
 assert.equal(EDIT_OF(storage),null,'로그아웃한 B의 편집을 지운다');
 s.failWhen=()=>null;tabA.retry();await tabA.refresh();await settled();
 assert.equal(s.syncs().length,sent,'A는 B의 편집을 넘겨받아 보내지 않는다');
 assert.equal(s.stored.settings.hour,null);assert.equal(rem.value.hour,null,'A는 서버 설정을 들인다');
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

test('판: 계정을 바꾼 탭은 옛 계정에서 확인받지 못한 편집을 판 키에서 지운다 — 그 계정으로 여는 다른 탭은 서버 설정을 들인다(설계 주인 11-23)',async()=>{
 const s=versionedServer(),storage=memory(),locks=fakeLocks(),rem=reminderSettings();
 const a=on(s,{storage,browser:{locks}});a.bindSettings(rem);
 await a.setAccount('acc-1');
 s.failWhen=action=>action==='sync'?fault(0,'PUSH_UNAVAILABLE'):null;
 rem.set({hour:20});a.sync({settings:{frequency:2,hour:20}});await settled();
 assert.equal(EDIT_OF(storage)?.hour,20);
 s.failWhen=action=>action==='status'||action==='sync'?fault(0,'PUSH_UNAVAILABLE'):null;
 await a.setAccount('acc-2');await settled();   // 같은 탭이 다른 계정으로 — acc-1 편집을 버린다
 assert.equal(EDIT_OF(storage),null);
 s.failWhen=()=>null;
 const b=on(s,{storage,browser:{locks}});b.bindSettings(rem);
 await b.setAccount('acc-1');await settled();
 assert.equal(s.stored.settings.hour,null);assert.equal(rem.value.hour,null);
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

test('판: 다른 기기가 끄고 다시 켠 새 계획을 읽은 뒤, 늦게 온 옛 계획의 상태 응답은 판이 섞여도 1단을 되돌리지 않는다 — 가장 큰 판이 작은 쪽이 앞이다(GPT push-versions-world-r5 GA1)',async()=>{
 let time=V0,stale=null;
 const s=versionedServer({clock:()=>time,settings:{frequency:2,hour:9,since:null}}),storage=memory(),rem=reminderSettings({frequency:2,hour:9,since:null});
 const request=(action,body,options)=>action==='status'&&stale?Promise.resolve(stale):s.request(action,body,options);
 const push=on(s,{storage,request});push.bindSettings(rem);
 await push.setAccount('acc-1');await settled();
 const old=await s.request('status');   // 옛 계획(복습 때 판이 있다)을 읽어 둔 응답
 time=V0+500000;
 await s.request('unsubscribe');await s.request('subscribe',{settings:{frequency:2,hour:20},digest:DIGEST('2026-10-24',null)});   // 다른 기기가 끄고 20시로 다시 켰다(복습 때 확인 중)
 await push.refresh();await settled();
 assert.equal(rem.value.hour,20);
 stale=old;await push.refresh();await settled();   // 뒤에 보낸 상태 읽기가 옛 계획을 늦게 돌려준다
 assert.equal(rem.value.hour,20,'옛 계획의 응답이 1단을 9시로 되돌리지 않는다');assert.equal(push.snapshot().plan.hour,20);
});

test('판: 같은 탭이 9시 응답을 기다리는 사이 20시로 바꾸고 바로 닫으면, 9시가 받힌 뒤 다음에 연 탭은 9시를 들인다 — 받는 한계(설계 주인 11-22 규칙 5 (가), GPT push-versions-world-r5 GA2)',async()=>{
 const s=versionedServer(),storage=memory(),locks=fakeLocks(),m=manual(s),rem=reminderSettings();
 const a=on(s,{storage,request:m.request,browser:{locks}});a.bindSettings(rem);
 await a.setAccount('acc-1');
 rem.set({hour:9});a.sync({settings:{frequency:2,hour:9}});
 rem.set({hour:20});a.sync({settings:{frequency:2,hour:20}});await flush();
 assert.equal(m.queue.length,1,'20시는 9시의 응답을 기다린다');
 a.dispose();await settled();   // 닫았다
 m.queue.shift().pass();await settled();   // 9시는 받혔다(응답은 닫힌 탭에 닿지 않는다)
 assert.equal(s.stored.settings.hour,9);
 const b=on(s,{storage,browser:{locks}});b.bindSettings(rem);
 await b.setAccount('acc-1');await settled();
 assert.equal(s.stored.settings.hour,9,'앞 9시가 남는다 — 받는 한계');assert.equal(rem.value.hour,9,'다음에 열면 설정 화면에 9시가 보인다');assert.equal(EDIT_OF(storage),null);
 assert.equal(s.syncs().filter(call=>call.body.settings?.hour===20).length,0);
 b.dispose();
});

test('판: 닫힌 탭의 편집은 서버 판이 바탕보다 한 칸 위이고 서버 값이 그 탭의 앞 설정과 같아도 바탕이 다르면 서버 것을 들인다 — 다른 기기가 같은 값을 먼저 쓴 것을 덮지 않는다(설계 주인 11-22 규칙 5 (가), GPT push-versions-world-r6 GA1)',async()=>{
 const s=versionedServer(),storage=memory(),locks=fakeLocks(),m=manual(s),rem=reminderSettings();
 const a=on(s,{storage,request:m.request,browser:{locks}});a.bindSettings(rem);
 await a.setAccount('acc-1');
 rem.set({hour:9});a.sync({settings:{frequency:2,hour:9}});
 rem.set({hour:20});a.sync({settings:{frequency:2,hour:20}});await flush();
 a.dispose();await settled();   // 닫았다
 await s.request('sync',{settings:{frequency:2,hour:9},versions:{settings:V0}});   // 다른 기기가 9시를 먼저 썼다
 m.queue.shift().pass();await settled();   // 탭의 9시는 거절됐다(응답은 닫힌 탭에 닿지 않는다)
 assert.equal(s.stored.versions.settings,V0+1);
 const b=on(s,{storage,browser:{locks}});b.bindSettings(rem);
 await b.setAccount('acc-1');await settled();
 assert.equal(s.stored.settings.hour,9,'다른 기기의 9시가 남는다');assert.equal(rem.value.hour,9);assert.equal(EDIT_OF(storage),null);
 assert.equal(s.syncs().filter(call=>call.body.settings?.hour===20).length,0,'닫힌 탭의 20시를 보내지 않는다');
 b.dispose();
});

test('판: 같은 탭의 9시가 받힌 뒤 응답 전에 상태가 먼저 그 판을 읽어도 기다리던 20시는 다시 보내기를 쓰지 않는다 — 그 뒤 다른 기기의 15시에 거절되면 한 번 다시 보내 이긴다(GPT push-versions-world-r5 GA3)',async()=>{
 const s=versionedServer(),storage=memory(),m=manual(s),rem=reminderSettings(),push=on(s,{storage,request:m.request});push.bindSettings(rem);
 await push.setAccount('acc-1');
 rem.set({hour:9});push.sync({settings:{frequency:2,hour:9}});
 rem.set({hour:20});push.sync({settings:{frequency:2,hour:20}});await flush();
 const answer=m.queue.shift().late();   // 9시는 서버에 닿았고 응답만 늦다
 await push.refresh();await settled();   // 상태가 9시의 새 판을 먼저 읽는다
 assert.equal(EDIT_OF(storage)?.tries,0,'자기 쓰기로 낡은 것은 거절로 세지 않는다');
 await s.request('sync',{settings:{frequency:2,hour:15},versions:{settings:V0+1}});   // 다른 기기 15시
 answer();await settled();
 while(m.queue.length){m.queue.shift().pass();await settled();}
 assert.equal(s.stored.settings.hour,20);assert.equal(rem.value.hour,20);assert.equal(EDIT_OF(storage),null);
 push.dispose();
});

test('판: 옛 서버에 미뤄 둔 설정은 판을 아는 서버로 돌아온 뒤 바꾼 더 새 설정을 덮지 않는다(GPT push-versions-world-r5 GA4)',async()=>{
 const s=versionedServer(),r=rollback(s),storage=memory(),rem=reminderSettings(),push=on(s,{request:r.request,storage});push.bindSettings(rem);
 await push.setAccount('acc-1');
 r.old=true;await push.refresh();assert.equal(push.snapshot().versioning,false);
 r.holdSync=true;
 rem.set({hour:9});push.sync({settings:{frequency:2,hour:9}});await flush();
 rem.set({hour:15});push.sync({settings:{frequency:2,hour:15}});await flush();   // 9시 응답을 기다리며 미뤄 둔다
 assert.equal(r.queue.length,1);
 r.old=false;await push.refresh();assert.equal(push.snapshot().versioning,true);   // 판을 아는 서버로 돌아왔다
 rem.set({hour:20});push.sync({settings:{frequency:2,hour:20}});await flush();
 r.holdSync=false;
 while(r.queue.length){await r.queue.shift().go();await settled();}
 await settled();
 assert.equal(s.stored.settings.hour,20);assert.equal(rem.value.hour,20);assert.equal(EDIT_OF(storage),null);
 push.dispose();
});

test('판: 옛 서버로 되돌린 뒤 요약 요청의 400이 설정 요청의 400보다 먼저 와도, 그사이 바꾼 마지막 설정은 판 없이 간다(GPT push-versions-world-r5 GA5 · GA8 · GA10)',async()=>{
 const s=versionedServer(),r=rollback(s),storage=memory(),rem=reminderSettings(),push=on(s,{request:r.request,storage});push.bindSettings(rem);
 await push.setAccount('acc-1');
 r.holdSync=true;
 rem.set({hour:9});push.sync({settings:{frequency:2,hour:9}});await flush();
 push.sync({digest:DIGEST('2026-10-23')});await flush();
 assert.equal(r.queue.length,2);
 r.old=true;
 const settingsJob=r.queue.shift(),digestJob=r.queue.shift();
 await digestJob.go().catch(()=>{});await settled();   // 요약의 400이 먼저 온다
 rem.set({hour:20});push.sync({settings:{frequency:2,hour:20}});await flush();
 while(r.queue.length){await r.queue.shift().go().catch(()=>{});await settled();}   // 판 없이 다시 보낸 요약은 먼저 받혔다
 await settingsJob.go().catch(()=>{});await settled();   // 설정의 400이 나중에 온다
 r.holdSync=false;
 while(r.queue.length){await r.queue.shift().go().catch(()=>{});await settled();}
 push.retry();await push.refresh();await settled();
 assert.equal(s.stored.settings.hour,20,'마지막 20시가 판 없이 간다');
 push.dispose();
});

test('판: 처음 켜는 탭의 늦은 응답은 새 계획을 읽고 다른 탭이 쓴 편집을 지우지 않는다(GPT push-versions-world-r5 GA6)',async()=>{
 const s=versionedServer(),bA=browser({answer:'hang',registered:true}),storage=memory(),locks=fakeLocks(),rem=reminderSettings({frequency:2,hour:9,since:null});
 s.active=false;
 let release=null;
 const requestA=(action,body,options)=>{
  if(action==='subscribe'&&!release){const reply=s.request(action,body,options);return new Promise(resolve=>{release=()=>resolve(reply);});}
  return s.request(action,body,options);
 };
 bA.env.navigator.locks=locks;
 const a=makeV(bA,s,{now:()=>V0,request:requestA,storage});a.bindSettings(rem);
 await a.setAccount('acc-1');await a.ready();
 const turning=a.enable({settings:{frequency:2,hour:9,since:null},digest:DIGEST('2026-10-21')});
 bA.resolvePrompt();await settled();
 assert.ok(release,'켜기가 서버에 닿았고 응답만 늦다');
 const m=manual(s),b=on(s,{storage,request:m.request,browser:{locks}});b.bindSettings(rem);
 await b.setAccount('acc-1');await settled();   // B는 새 계획을 읽었다
 rem.set({hour:20});b.sync({settings:{frequency:2,hour:20}});await flush();
 rem.set({hour:9});b.sync({settings:{frequency:2,hour:9}});await flush();   // 20시의 응답을 기다리며 다시 9시로
 release();await turning;await settled();
 assert.equal(EDIT_OF(storage)?.hour,9,'A의 늦은 응답이 B의 편집을 지우지 않는다');
 while(m.queue.length){m.queue.shift().pass();await settled();}
 assert.equal(s.stored.settings.hour,9);assert.equal(rem.value.hour,9);assert.equal(EDIT_OF(storage),null);
 a.dispose();b.dispose();
});

test('판: 옛 서버일 때 켜기를 누르고 권한 창 사이에 판을 아는 서버를 읽었으면, 켜기의 요약은 지금 기록으로 새로 지어 지금 판을 바탕으로 싣는다(GPT push-versions-world-r5 GA9)',async()=>{
 const s=versionedServer(),r=rollback(s),b=browser({answer:'hang',registered:true}),storage=memory();
 const rem={...reminderSettings(),digest:()=>({digest:DIGEST('2026-10-24')})};
 s.active=true;
 const push=makeV(b,s,{now:()=>V0,request:r.request,storage});push.bindSettings(rem);
 await push.setAccount('acc-1');
 r.old=true;await push.refresh();await push.ready();assert.equal(push.snapshot().versioning,false);
 const turning=push.enable({settings:{frequency:2,hour:null,since:null},digest:DIGEST('2026-10-22')});   // 누를 때는 어제 요약 · 판 모름
 await s.request('sync',{digest:DIGEST('2026-10-23'),versions:{digest:V0,reviews:V0}});   // 다른 기기의 새 요약
 r.old=false;await push.refresh();assert.equal(push.snapshot().versioning,true);   // 권한 창 사이에 판을 아는 서버를 읽었다(다른 기기의 새 판도 안다)
 b.resolvePrompt();await turning;await settled();
 const call=s.calls.find(c=>c.action==='subscribe');
 assert.ok(call.body.versions,'켜기가 바탕 판을 싣는다');
 assert.equal(s.stored.digest.lastStudyDay,'2026-10-24','누를 때의 어제 요약 대신 지금 기록으로 새로 지은 요약이 간다');
 push.dispose();
});

test('판: 다른 기기가 마지막 기기를 끄고 다시 켜 새 계획이 생기면, 옛 계획 때 보낸 이 탭의 설정은 거절된 뒤 다시 보내지 않고 다시 켜며 고른 설정을 들인다(설계 주인 11-22 규칙 4 (나), GPT world-r5 GA7)',async()=>{
 let time=V0;
 const s=versionedServer({clock:()=>time}),storage=memory(),m=manual(s),rem=reminderSettings(),push=on(s,{storage,request:m.request});push.bindSettings(rem);
 await push.setAccount('acc-1');
 rem.set({hour:9});push.sync({settings:{frequency:2,hour:9}});await flush();
 time=V0+500000;
 await s.request('unsubscribe');await s.request('subscribe',{settings:{frequency:2,hour:20},digest:DIGEST('2026-10-24')});   // 다른 기기가 끄고 20시로 다시 켰다
 while(m.queue.length){m.queue.shift().pass();await settled();}
 assert.equal(s.stored.settings.hour,20);assert.equal(rem.value.hour,20);assert.equal(EDIT_OF(storage),null);
 assert.equal(s.syncs().filter(call=>call.body.settings?.hour===9).length,1,'옛 계획 때의 9시는 다시 가지 않는다');
 push.dispose();
});

test('판: 판이 범위 경계(65536의 배수)를 지나도 같은 계획이다 — 거절된 설정은 규칙 4대로 한 번 다시 보내 이긴다(설계 주인 11-22)',async()=>{
 const edge=Math.ceil(V0/65536)*65536-1;
 const s=versionedServer({versions:{settings:edge,digest:edge,reviews:edge}}),storage=memory(),m=manual(s),rem=reminderSettings(),push=on(s,{storage,request:m.request});push.bindSettings(rem);
 await push.setAccount('acc-1');
 rem.set({hour:9});push.sync({settings:{frequency:2,hour:9}});await flush();
 await s.request('sync',{settings:{frequency:2,hour:15},versions:{settings:edge}});   // 다른 기기 15시 — 판이 경계를 넘는다
 assert.equal(s.stored.versions.settings%65536,0);
 while(m.queue.length){m.queue.shift().pass();await settled();}
 assert.equal(s.stored.settings.hour,9,'같은 계획이라 이 탭의 마지막 뜻이 이긴다');assert.equal(rem.value.hour,9);assert.equal(EDIT_OF(storage),null);
 push.dispose();
});

test('판: 처음 켜는 탭이 응답을 기다리는 사이 1단에만 적은 설정은, 다른 탭이 새 계획에서 쓴 편집보다 뒤면 켜기 응답 뒤에 보낸다(GPT push-versions-world-r6 GA2)',async()=>{
 const s=versionedServer(),bA=browser({answer:'hang',registered:true}),storage=memory(),locks=fakeLocks(),rem=reminderSettings({frequency:2,hour:9,since:null});
 s.active=false;
 let release=null;
 const requestA=(action,body,options)=>{
  if(action==='subscribe'&&!release){const reply=s.request(action,body,options);return new Promise(resolve=>{release=()=>resolve(reply);});}
  return s.request(action,body,options);
 };
 bA.env.navigator.locks=locks;
 const a=makeV(bA,s,{now:()=>V0,request:requestA,storage});a.bindSettings(rem);
 await a.setAccount('acc-1');await a.ready();
 const turning=a.enable({settings:{frequency:2,hour:9,since:null},digest:DIGEST('2026-10-21')});
 bA.resolvePrompt();await settled();
 const m=manual(s),b=on(s,{storage,request:m.request,browser:{locks}});b.bindSettings(rem);
 await b.setAccount('acc-1');await settled();
 rem.set({hour:20});b.sync({settings:{frequency:2,hour:20}});await flush();
 rem.set({hour:18});a.sync({settings:{frequency:2,hour:18}});await flush();   // A는 아직 꺼진 계정으로 알아 1단에만 적힌다
 release();await turning;await settled();
 while(m.queue.length){m.queue.shift().pass();await settled();}
 await settled();
 assert.equal(s.stored.settings.hour,18,'마지막 뜻 18시');assert.equal(rem.value.hour,18);
 a.dispose();b.dispose();
});

test('판: 앞 설정 요청이 시간 초과로 끝나면 기다리던 이 탭의 편집을 바로 다룬다 — 다음 상태 읽기까지 묶이지 않는다(GPT push-versions-world-r6 GA3)',async()=>{
 const s=versionedServer(),storage=memory(),m=manual(s),rem=reminderSettings(),push=on(s,{storage,request:m.request});push.bindSettings(rem);
 await push.setAccount('acc-1');
 rem.set({hour:9});push.sync({settings:{frequency:2,hour:9}});
 rem.set({hour:20});push.sync({settings:{frequency:2,hour:20}});await flush();
 const first=m.queue.shift();first.late();   // 9시는 서버에 닿았다
 await push.refresh();await settled();   // 상태가 9시의 새 판을 읽는다
 first.fail(fault(0,'PUSH_TIMEOUT'));await settled();   // 그 응답은 시간 초과로 끝났다
 assert.equal(m.queue.length,1,'기다리던 20시가 바로 간다');
 m.queue.shift().pass();await settled();
 assert.equal(s.stored.settings.hour,20);assert.equal(rem.value.hour,20);assert.equal(EDIT_OF(storage),null);
 push.dispose();
});

test('판: 옛 서버에 미뤄 둔 설정은 이 탭이 끄고 다시 켜면 지난 것이다 — 옛 응답이 와도 다시 켜며 보낸 설정을 덮지 않는다(GPT push-versions-world-r6 GA6 · r7 GA3)',async()=>{
 let time=V0;
 const s=versionedServer({clock:()=>time}),r=rollback(s),storage=memory(),rem=reminderSettings(),push=on(s,{request:r.request,storage});push.bindSettings(rem);
 await push.setAccount('acc-1');await push.ready();
 r.old=true;await push.refresh();assert.equal(push.snapshot().versioning,false);
 r.holdSync=true;
 rem.set({hour:9});push.sync({settings:{frequency:2,hour:9}});await flush();
 rem.set({hour:15});push.sync({settings:{frequency:2,hour:15}});await flush();   // 9시 응답을 기다리며 미뤄 둔다
 const answer=r.queue.shift().late();   // 옛 서버가 9시를 받았고 응답만 늦다
 r.old=false;r.holdSync=false;await push.refresh();
 await push.disable();await settled();   // 마지막 기기를 껐다
 time=V0+500000;rem.set({hour:20});
 await push.enable({settings:{frequency:2,hour:20,since:null},digest:DIGEST('2026-10-24')});await settled();
 assert.equal(s.stored.settings.hour,20);
 await answer().catch(()=>{});await settled();await settled();   // 옛 9시의 응답이 온다
 assert.equal(s.stored.settings.hour,20,'미뤄 둔 15시가 다시 켠 20시를 덮지 않는다');
 assert.equal(s.syncs().filter(call=>call.body.settings?.hour===15).length,0,'지난 15시를 보내지 않는다');
 assert.equal(rem.value.hour,20,'1단도 20시로 남는다');
 push.dispose();
});

test('판: 넘겨받을 편집의 바탕이 이 탭이 아는 판보다 크면 상태를 다시 읽고 넘겨받는다 — 낡은 상태로 다른 탭의 편집을 지우지 않는다(GPT push-versions-world-r6 GA7)',async()=>{
 const s=versionedServer(),storage=memory(),locks=fakeLocks(),m=manual(s),rem=reminderSettings();
 const a=on(s,{storage,request:m.request,browser:{locks}});a.bindSettings(rem);
 await a.setAccount('acc-1');
 a.sync({digest:DIGEST('2026-10-23')});await flush();
 const answer=m.queue.shift().late();   // A의 요약은 닿았고 응답만 늦다(그때의 판)
 await s.request('sync',{settings:{frequency:2,hour:15},versions:{settings:V0}});   // 다른 기기 15시
 const requestB=(action,body,options)=>action==='sync'?Promise.reject(fault(0,'PUSH_UNAVAILABLE')):s.request(action,body,options);
 const b=on(s,{storage,request:requestB,browser:{locks}});b.bindSettings(rem);
 await b.setAccount('acc-1');await settled();   // B는 15시의 새 판을 읽었다
 rem.set({hour:18});b.sync({settings:{frequency:2,hour:18}});await settled();   // 망이 끊겨 남았다
 b.dispose();await settled();
 answer();await settled();await settled();   // A가 낡은 판의 응답을 받고 맞춘다
 while(m.queue.length){m.queue.shift().pass();await settled();}
 assert.equal(s.stored.settings.hour,18,'B가 새 판을 보고 고른 18시를 넘겨받아 보낸다');assert.equal(rem.value.hour,18);
 a.dispose();
});

test('판: 상태를 읽기 전에 적은 편집은 그 뒤에 보낸 상태 읽기의 계획 정체를 붙인다 — 다른 기기가 다시 켜 새 계획이 생기면 다시 보내지 않고 들인다(GPT push-versions-world-r6 GA8 · r8 GA2)',async()=>{
 let time=V0;
 const s=versionedServer({clock:()=>time}),storage=memory(),m=manual(s),rem=reminderSettings(),push=on(s,{storage,request:m.request});push.bindSettings(rem);
 s.failWhen=action=>action==='status'?fault(0,'PUSH_UNAVAILABLE'):null;
 await push.setAccount('acc-1');
 rem.set({hour:9});push.sync({settings:{frequency:2,hour:9}});
 assert.equal(EDIT_OF(storage).known,false);
 s.failWhen=()=>null;await push.refresh();await settled();
 assert.equal(m.queue.length,1);assert.ok(EDIT_OF(storage).planId,'편집 뒤에 보낸 상태 읽기의 계획 정체를 붙인다');
 time=V0+500000;
 await s.request('unsubscribe');await s.request('subscribe',{settings:{frequency:2,hour:20},digest:DIGEST('2026-10-24')});   // 다른 기기가 끄고 20시로 다시 켰다
 while(m.queue.length){m.queue.shift().pass();await settled();}
 assert.equal(s.stored.settings.hour,20);assert.equal(rem.value.hour,20);assert.equal(EDIT_OF(storage),null);
 push.dispose();
});

test('판: 편집 앞에 보낸 상태 읽기의 늦은 응답은 그 편집에 계획 정체를 붙이지 않는다 — 그사이 다른 기기가 다시 켰어도 이 탭에서 방금 고른 시각이 이긴다, 받는 한계(설계 주인 11-22, GPT push-versions-world-r7 GA2)',async()=>{
 let time=V0,hold=null;
 const s=versionedServer({clock:()=>time}),storage=memory(),m=manual(s),rem=reminderSettings();
 const request=(action,body,options)=>{
  if(action==='status'&&!hold){const reply=s.request(action,body,options);return new Promise(resolve=>{hold=()=>resolve(reply);});}
  return m.request(action,body,options);
 };
 const push=on(s,{storage,request});push.bindSettings(rem);
 const opening=push.setAccount('acc-1');await flush();   // 첫 상태 읽기는 닿았고 응답만 늦다(옛 계획)
 time=V0+500000;
 await s.request('unsubscribe');await s.request('subscribe',{settings:{frequency:2,hour:20},digest:DIGEST('2026-10-24')});   // 다른 기기가 끄고 20시로 다시 켰다
 rem.set({hour:18});push.sync({settings:{frequency:2,hour:18}});   // 이 탭은 아직 상태를 모른다
 assert.equal(EDIT_OF(storage).known,false);
 hold();await opening;await settled();
 assert.equal(EDIT_OF(storage)?.planId??null,null,'편집 앞에 보낸 읽기의 계획 정체는 붙이지 않는다');
 while(m.queue.length){m.queue.shift().pass();await settled();}
 assert.equal(s.stored.settings.hour,18,'이 탭에서 고른 18시가 남는다 — 받는 한계');assert.equal(rem.value.hour,18);
 push.dispose();
});

test('판: 이미 켠 계정에 이 기기를 더하는 켜기는 미뤄 둔 옛 서버 설정을 버리지 않는다 — 켜기가 설정을 보내지 않으므로 그 뒤에 보낸다(GPT push-versions-world-r7 GA1)',async()=>{
 const s=versionedServer({settings:{frequency:2,hour:9,since:null}}),r=rollback(s),b=browser({registered:true}),storage=memory(),rem=reminderSettings({frequency:2,hour:9,since:null});
 const push=makeV(b,s,{now:()=>V0,request:r.request,storage});push.bindSettings(rem);
 await push.setAccount('acc-1');await push.ready();
 r.old=true;await push.refresh();
 r.holdSync=true;
 rem.set({hour:9});push.sync({settings:{frequency:2,hour:9}});await flush();
 rem.set({hour:15});push.sync({settings:{frequency:2,hour:15}});await flush();   // 9시 응답을 기다리며 미뤄 둔다
 const answer=r.queue.shift().late();
 r.old=false;r.holdSync=false;
 await push.enable({settings:{frequency:2,hour:15,since:null},digest:DIGEST('2026-10-24')});await settled();   // 이미 켠 계정에 이 브라우저를 더한다
 await answer().catch(()=>{});await settled();await settled();
 assert.equal(s.stored.settings.hour,15,'미뤄 둔 15시가 간다');assert.equal(rem.value.hour,15);
 push.dispose();
});

test('판: 처음 켜는 탭이 응답을 기다리는 사이 바꾼 설정은 편집으로 적혀, 다른 탭의 응답이 먼저 와도 1단에서 지워지지 않는다(GPT push-versions-world-r7 GA4)',async()=>{
 const s=versionedServer(),bA=browser({answer:'hang',registered:true}),storage=memory(),locks=fakeLocks(),rem=reminderSettings({frequency:2,hour:9,since:null});
 s.active=false;
 let release=null;
 const requestA=(action,body,options)=>{
  if(action==='subscribe'&&!release){const reply=s.request(action,body,options);return new Promise(resolve=>{release=()=>resolve(reply);});}
  return s.request(action,body,options);
 };
 bA.env.navigator.locks=locks;
 const a=makeV(bA,s,{now:()=>V0,request:requestA,storage});a.bindSettings(rem);
 await a.setAccount('acc-1');await a.ready();
 const turning=a.enable({settings:{frequency:2,hour:9,since:null},digest:DIGEST('2026-10-21')});
 bA.resolvePrompt();await settled();
 const m=manual(s),b=on(s,{storage,request:m.request,browser:{locks}});b.bindSettings(rem);
 await b.setAccount('acc-1');await settled();
 rem.set({hour:20});b.sync({settings:{frequency:2,hour:20}});await flush();
 rem.set({hour:18});a.sync({settings:{frequency:2,hour:18}});await flush();
 while(m.queue.length){m.queue.shift().pass();await settled();}   // B의 20시 응답이 A의 켜기 응답보다 먼저 온다
 assert.equal(rem.value.hour,18,'B가 서버 설정을 1단에 들여 18시를 지우지 않는다');
 release();await turning;await settled();
 while(m.queue.length){m.queue.shift().pass();await settled();}
 await settled();
 assert.equal(s.stored.settings.hour,18,'마지막 뜻 18시');assert.equal(rem.value.hour,18);
 a.dispose();b.dispose();
});

test('판: 넘겨받기 전에 상태를 다시 읽는 동안 온 다른 늦은 응답은 그 결과를 기다린다 — 다시 읽은 뒤 넘겨받는다(GPT push-versions-world-r7 GA6)',async()=>{
 const s=versionedServer(),storage=memory(),locks=fakeLocks(),m=manual(s),rem=reminderSettings();
 let holdStatus=null;
 const requestA=(action,body,options)=>{
  if(action==='status'&&holdStatus){const reply=s.request(action,body,options);return new Promise(resolve=>holdStatus.push(()=>resolve(reply)));}
  return m.request(action,body,options);
 };
 const a=on(s,{storage,request:requestA,browser:{locks}});a.bindSettings(rem);
 await a.setAccount('acc-1');
 a.sync({digest:DIGEST('2026-10-23')});await flush();
 const first=m.queue.shift().late();   // A의 요약은 닿았고 응답만 늦다(그때의 판)
 holdStatus=[];void a.refresh();await flush();   // A의 상태 읽기도 닿았고 응답만 늦다(그때의 판)
 await s.request('sync',{settings:{frequency:2,hour:15},versions:{settings:V0}});   // 다른 기기 15시
 const requestB=(action,body,options)=>action==='sync'?Promise.reject(fault(0,'PUSH_UNAVAILABLE')):s.request(action,body,options);
 const b=on(s,{storage,request:requestB,browser:{locks}});b.bindSettings(rem);
 await b.setAccount('acc-1');await settled();
 rem.set({hour:18});b.sync({settings:{frequency:2,hour:18}});await settled();
 b.dispose();await settled();
 first();await settled();await settled();   // A가 낡은 응답을 받고 상태를 다시 읽기 시작한다(응답은 붙잡힘)
 assert.equal(holdStatus.length,2);
 holdStatus.shift()();await settled();await settled();   // 그사이 앞의 낡은 상태 응답이 먼저 온다
 assert.equal(EDIT_OF(storage)?.hour,18,'다시 읽는 동안 18시를 지우지 않는다');
 holdStatus.shift()();holdStatus=null;await settled();await settled();
 while(m.queue.length){m.queue.shift().pass();await settled();}
 assert.equal(s.stored.settings.hour,18);assert.equal(rem.value.hour,18);
 a.dispose();
});

test('판: 켜기가 실패하면 켜기를 기다리며 적은 편집을 지운다 — 나중에 다른 기기가 켠 계획을 덮지 않는다(GPT push-versions-world-r8 GA1)',async()=>{
 const s=versionedServer(),b=browser({answer:'hang',registered:true}),storage=memory(),rem=reminderSettings({frequency:2,hour:9,since:null});
 s.active=false;
 let fail=null;
 const request=(action,body,options)=>action==='subscribe'&&!fail?new Promise((resolve,reject)=>{fail=()=>reject(fault(0,'PUSH_UNAVAILABLE'));}):s.request(action,body,options);
 const push=makeV(b,s,{now:()=>V0,request,storage});push.bindSettings(rem);
 await push.setAccount('acc-1');await push.ready();
 const turning=push.enable({settings:{frequency:2,hour:9,since:null},digest:DIGEST('2026-10-21')});
 b.resolvePrompt();await settled();
 rem.set({hour:18});push.sync({settings:{frequency:2,hour:18}});
 assert.equal(EDIT_OF(storage)?.hour,18,'켜기를 기다리며 바꾼 설정은 편집으로 적힌다');
 fail();await turning;await settled();
 assert.equal(EDIT_OF(storage),null,'켜기가 실패하면 지운다');
 await s.request('subscribe',{settings:{frequency:2,hour:20},digest:DIGEST('2026-10-24')});   // 한참 뒤 다른 기기가 20시로 켰다
 await push.refresh();await settled();
 assert.equal(s.stored.settings.hour,20);assert.equal(rem.value.hour,20);
 assert.equal(s.syncs().filter(call=>call.body.settings?.hour===18).length,0);
 push.dispose();
});

test('판: 넘겨받기 전 상태 다시 읽기가 실패해도 편집을 지우지 않는다 — 망이 돌아와 앱이 다시 시도하면 다시 읽고 넘겨받는다(GPT push-versions-world-r8 GA3 · r9 GA2 · GA8)',async()=>{
 const s=versionedServer(),storage=memory(),locks=fakeLocks(),m=manual(s),rem=reminderSettings();
 const a=on(s,{storage,request:m.request,browser:{locks}});a.bindSettings(rem);
 await a.setAccount('acc-1');
 a.sync({digest:DIGEST('2026-10-23')});await flush();
 const answer=m.queue.shift().late();
 await s.request('sync',{settings:{frequency:2,hour:15},versions:{settings:V0}});   // 다른 기기 15시
 const requestB=(action,body,options)=>action==='sync'?Promise.reject(fault(0,'PUSH_UNAVAILABLE')):s.request(action,body,options);
 const b=on(s,{storage,request:requestB,browser:{locks}});b.bindSettings(rem);
 await b.setAccount('acc-1');await settled();
 rem.set({hour:18});b.sync({settings:{frequency:2,hour:18}});await settled();
 b.dispose();await settled();
 s.failWhen=action=>action==='status'?fault(0,'PUSH_UNAVAILABLE'):null;
 answer();await settled();await settled();   // A가 낡은 응답을 받고 상태를 다시 읽지만 실패한다
 assert.equal(EDIT_OF(storage)?.hour,18,'다시 읽기가 실패해도 18시를 지우지 않는다');
 s.failWhen=()=>null;a.retry();await settled();await settled();   // 온라인 · 화면 복귀에서 앱이 부르는 다시 시도
 while(m.queue.length){m.queue.shift().pass();await settled();}
 assert.equal(s.stored.settings.hour,18);assert.equal(rem.value.hour,18);
 a.dispose();
});

test('판: 옛 서버에서 꺼져 있던 계정을 켜면 미뤄 둔 옛 서버 설정은 지난 것이다 — 옛 서버는 applied를 주지 않는다(GPT push-versions-world-r8 GA4)',async()=>{
 let time=V0;
 const s=versionedServer({clock:()=>time}),r=rollback(s),storage=memory(),rem=reminderSettings(),push=on(s,{request:r.request,storage});push.bindSettings(rem);
 await push.setAccount('acc-1');await push.ready();
 r.old=true;await push.refresh();
 r.holdSync=true;
 rem.set({hour:9});push.sync({settings:{frequency:2,hour:9}});await flush();
 rem.set({hour:15});push.sync({settings:{frequency:2,hour:15}});await flush();
 const answer=r.queue.shift().late();   // 옛 서버가 9시를 받았고 응답만 늦다
 r.holdSync=false;
 await s.request('unsubscribe');   // 다른 기기가 마지막 기기를 껐다
 await push.refresh();assert.equal(push.snapshot().account.active,false);
 time=V0+500000;rem.set({hour:20});
 await push.enable({settings:{frequency:2,hour:20,since:null},digest:DIGEST('2026-10-24')});await settled();   // 옛 서버에 새 계획을 만든다
 assert.equal(s.stored.settings.hour,20);
 await answer().catch(()=>{});await settled();await settled();
 assert.equal(s.stored.settings.hour,20,'미뤄 둔 15시가 새 계획의 20시를 덮지 않는다');assert.equal(rem.value.hour,20);
 assert.equal(s.syncs().filter(call=>call.body.settings?.hour===15).length,0);
 push.dispose();
});

test('판: 넘겨받기 전 상태를 다시 읽는 동안 먼저 온 옛 서버의 늦은 상태 응답도 편집을 지우지 않는다(GPT push-versions-world-r8 GA6)',async()=>{
 const s=versionedServer(),storage=memory(),locks=fakeLocks(),m=manual(s),rem=reminderSettings();
 const strip=data=>{const {versioning,versions,applied,planId,...rest}=data;return rest;};
 let holdStatus=null;
 const requestA=(action,body,options)=>{
  if(action==='status'&&holdStatus){const legacy=holdStatus.length===0,reply=s.request(action,body,options);return new Promise(resolve=>holdStatus.push(()=>resolve(reply.then(d=>legacy?strip(d):d))));}
  return m.request(action,body,options);
 };
 const a=on(s,{storage,request:requestA,browser:{locks}});a.bindSettings(rem);
 await a.setAccount('acc-1');
 a.sync({digest:DIGEST('2026-10-23')});await flush();
 const first=m.queue.shift().late();
 holdStatus=[];void a.refresh();await flush();   // 이 상태 읽기의 늦은 응답은 옛 서버 응답이다(판이 없다)
 await s.request('sync',{settings:{frequency:2,hour:15},versions:{settings:V0}});
 const requestB=(action,body,options)=>action==='sync'?Promise.reject(fault(0,'PUSH_UNAVAILABLE')):s.request(action,body,options);
 const b=on(s,{storage,request:requestB,browser:{locks}});b.bindSettings(rem);
 await b.setAccount('acc-1');await settled();
 rem.set({hour:18});b.sync({settings:{frequency:2,hour:18}});await settled();
 b.dispose();await settled();
 first();await settled();await settled();
 assert.equal(holdStatus.length,2);
 holdStatus.shift()();await settled();await settled();   // 옛 서버의 늦은 상태 응답이 먼저 온다
 assert.equal(EDIT_OF(storage)?.hour,18,'다시 읽는 동안 18시를 지우지 않는다');
 holdStatus.shift()();holdStatus=null;await settled();await settled();
 while(m.queue.length){m.queue.shift().pass();await settled();}
 assert.equal(s.stored.settings.hour,18);assert.equal(rem.value.hour,18);
 a.dispose();
});

test('판: 앞 계정의 켜기 실패는 계정을 바꾼 뒤 지금 계정의 편집을 지우지 않는다(GPT push-versions-world-r9 GA1)',async()=>{
 const s=versionedServer(),b=browser({registered:true}),storage=memory(),rem=reminderSettings({frequency:2,hour:9,since:null});
 s.active=false;
 let failFirst=null,holdSecond=null;
 const request=(action,body,options)=>{
  if(action==='subscribe'&&!failFirst)return new Promise((resolve,reject)=>{failFirst=()=>reject(fault(0,'PUSH_UNAVAILABLE'));});
  if(action==='subscribe'&&!holdSecond){const reply=s.request(action,body,options);return new Promise(resolve=>{holdSecond=()=>resolve(reply);});}
  return s.request(action,body,options);
 };
 const push=makeV(b,s,{now:()=>V0,request,storage});push.bindSettings(rem);
 await push.setAccount('acc-1');await push.ready();
 const first=push.enable({settings:{frequency:2,hour:9,since:null},digest:DIGEST('2026-10-21')});await settled();
 await push.setAccount('acc-2');await push.ready();   // 같은 탭이 다른 계정으로 바꿨다
 const second=push.enable({settings:{frequency:2,hour:9,since:null},digest:DIGEST('2026-10-21')});await settled();
 rem.set({hour:18});push.sync({settings:{frequency:2,hour:18}});
 const KEY2='synk.world.push.versions.v1.acc-2',edit2=()=>JSON.parse(storage.getItem(KEY2)||'null')?.settings??null;
 assert.equal(edit2()?.hour,18);
 failFirst();await first;await settled();   // 앞 계정의 켜기가 실패한다
 assert.equal(edit2()?.hour,18,'지금 계정의 편집을 지우지 않는다');
 holdSecond();const done=await second;await settled();
 // 앞 계정 켜기 실패의 정리가 두 켜기가 함께 쓰던 이 브라우저 구독을 지웠다 — 뒤 켜기는 죽은 주소로 「켜짐」을 적지 않고 실패로 끝난다(r18 켜기 응답 뒤 구독 확인).
 // 기록은 남겨 다음 평소 읽기가 서버의 그 기기를 끄게 한다.
 assert.equal(b.current,null);assert.equal(done.error,'PUSH_UNAVAILABLE');
 assert.equal(JSON.parse(storage.getItem(PUSH_RECORD_KEY)).accountId,'acc-2');
 push.dispose();
});

test('판: 옛 서버에서 켜기 응답이 늦는 사이 새 계획을 읽고 미뤄 둔 설정은 켜기 응답이 버리지 않는다(GPT push-versions-world-r9 GA3)',async()=>{
 let time=V0;
 const s=versionedServer({clock:()=>time}),r=rollback(s),b=browser({registered:true}),storage=memory(),rem=reminderSettings({frequency:2,hour:9,since:null});
 s.active=false;
 let releaseEnable=null;
 const request=(action,body,options)=>{
  if(action==='subscribe'&&!releaseEnable){const reply=r.request(action,body,options);return new Promise((resolve,reject)=>{releaseEnable=()=>reply.then(resolve,reject);});}
  return r.request(action,body,options);
 };
 const push=makeV(b,s,{now:()=>V0,request,storage});push.bindSettings(rem);
 await push.setAccount('acc-1');r.old=true;await push.ready();
 const turning=push.enable({settings:{frequency:2,hour:9,since:null},digest:DIGEST('2026-10-21')});await settled();   // 옛 서버에 새 계획이 생겼고 응답만 늦다
 await push.refresh();assert.equal(push.snapshot().account.active,true);   // 상태가 새 계획(켜짐)을 먼저 읽는다
 r.holdSync=true;
 rem.set({hour:10});push.sync({settings:{frequency:2,hour:10}});await flush();
 rem.set({hour:18});push.sync({settings:{frequency:2,hour:18}});await flush();   // 10시 응답을 기다리며 18시를 미뤄 둔다
 const answer=r.queue.shift().late();r.holdSync=false;
 releaseEnable();await turning;await settled();
 await answer().catch(()=>{});await settled();await settled();
 assert.equal(s.stored.settings.hour,18,'새 계획에서 미뤄 둔 18시가 간다');assert.equal(rem.value.hour,18);
 push.dispose();
});

test('판: 옛 서버에서 켜기를 누른 뒤 권한 창 사이에 계정이 꺼졌으면, 미뤄 둔 옛 서버 설정은 새 계획을 덮지 않는다(GPT push-versions-world-r9 GA9)',async()=>{
 let time=V0;
 const s=versionedServer({clock:()=>time}),r=rollback(s),b=browser({answer:'hang',registered:true}),storage=memory(),rem=reminderSettings();
 const push=makeV(b,s,{now:()=>V0,request:r.request,storage});push.bindSettings(rem);
 await push.setAccount('acc-1');await push.ready();
 r.old=true;await push.refresh();assert.equal(push.snapshot().account.active,true);
 r.holdSync=true;
 rem.set({hour:9});push.sync({settings:{frequency:2,hour:9}});await flush();
 rem.set({hour:15});push.sync({settings:{frequency:2,hour:15}});await flush();
 const answer=r.queue.shift().late();r.holdSync=false;
 const turning=push.enable({settings:{frequency:2,hour:15,since:null},digest:DIGEST('2026-10-21')});   // 켜 둔 계정에 이 브라우저를 더하려고 눌렀다(권한 창)
 await s.request('unsubscribe');   // 그사이 다른 기기가 마지막 기기를 껐다
 await push.refresh();assert.equal(push.snapshot().account.active,false);
 time=V0+500000;rem.set({hour:20});
 b.resolvePrompt();await turning;await settled();   // 옛 서버에 20시로 새 계획을 만든다
 assert.equal(s.stored.settings.hour,20);
 await answer().catch(()=>{});await settled();await settled();
 assert.equal(s.stored.settings.hour,20,'미뤄 둔 15시가 새 계획을 덮지 않는다');assert.equal(rem.value.hour,20);
 push.dispose();
});

test('판: 넘겨받기 전 다시 읽는 동안 그 앞에 보낸 켜기의 늦은 응답은 보낸 때의 차례로 적혀 편집을 지우지 않는다(GPT push-versions-world-r9 GA4 · GA11)',async()=>{
 const s=versionedServer(),storage=memory(),locks=fakeLocks(),m=manual(s),rem=reminderSettings();
 const bA=browser({registered:true,locks});
 let holdStatus=null,releaseEnable=null;
 const requestA=(action,body,options)=>{
  if(action==='subscribe'){const reply=s.request(action,body,options);return new Promise(resolve=>{releaseEnable=()=>resolve(reply);});}
  if(action==='status'&&holdStatus){const reply=s.request(action,body,options);return new Promise(resolve=>holdStatus.push(()=>resolve(reply)));}
  return m.request(action,body,options);
 };
 const a=makeV(bA,s,{now:()=>V0,request:requestA,storage});a.bindSettings(rem);
 await a.setAccount('acc-1');await a.ready();
 a.sync({digest:DIGEST('2026-10-23')});await flush();
 const first=m.queue.shift().late();   // A의 요약은 닿았고 응답만 늦다(그때의 판)
 const turning=a.enable({settings:{frequency:2,hour:null,since:null},digest:DIGEST('2026-10-23')});await settled();   // 켜 둔 계정에 이 브라우저를 더한다 — 닿았고 응답만 늦다
 await s.request('sync',{settings:{frequency:2,hour:15},versions:{settings:V0}});   // 다른 기기 15시
 const requestB=(action,body,options)=>action==='sync'?Promise.reject(fault(0,'PUSH_UNAVAILABLE')):s.request(action,body,options);
 const b=on(s,{storage,request:requestB,browser:{locks}});b.bindSettings(rem);
 await b.setAccount('acc-1');await settled();
 rem.set({hour:18});b.sync({settings:{frequency:2,hour:18}});await settled();
 b.dispose();await settled();
 holdStatus=[];
 first();await settled();await settled();   // 낡은 응답 — 상태를 다시 읽기 시작한다(붙잡힘)
 assert.equal(holdStatus.length,1);
 releaseEnable();await turning;await settled();await settled();   // 그 앞에 보낸 켜기의 늦은 응답이 온다
 assert.equal(EDIT_OF(storage)?.hour,18,'다시 읽는 동안 18시를 지우지 않는다');
 holdStatus.shift()();holdStatus=null;await settled();await settled();
 while(m.queue.length){m.queue.shift().pass();await settled();}
 assert.equal(s.stored.settings.hour,18);assert.equal(rem.value.hour,18);
 a.dispose();
});

test('판: 편집 앞에 보낸 읽기가 먼저 바탕을 매겨도, 편집 뒤에 보낸 읽기가 같은 판을 확인하면 계획 정체를 붙인다(GPT push-versions-world-r9 GA7)',async()=>{
 let time=V0,hold=null;
 const s=versionedServer({clock:()=>time}),storage=memory(),m=manual(s),rem=reminderSettings();
 const request=(action,body,options)=>{
  if(action==='status'&&!hold){const reply=s.request(action,body,options);return new Promise(resolve=>{hold=()=>resolve(reply);});}
  return m.request(action,body,options);
 };
 const push=on(s,{storage,request});push.bindSettings(rem);
 const opening=push.setAccount('acc-1');await flush();   // 편집 앞에 보낸 첫 읽기 — 응답만 늦다
 rem.set({hour:9});push.sync({settings:{frequency:2,hour:9}});
 hold();await opening;await settled();   // 앞 읽기가 먼저 바탕을 매긴다(계획 정체는 없다)
 assert.equal(EDIT_OF(storage)?.planId??null,null);
 while(m.queue.length)m.queue.shift().fail(fault(0,'PUSH_UNAVAILABLE'));await settled();   // 설정 보내기는 망이 끊겨 실패
 await push.refresh();await settled();   // 편집 뒤에 보낸 읽기가 같은 판을 확인한다
 assert.ok(EDIT_OF(storage)?.planId,'계획 정체를 붙였다');
 time=V0+500000;
 await s.request('unsubscribe');await s.request('subscribe',{settings:{frequency:2,hour:20},digest:DIGEST('2026-10-24')});   // 한참 뒤 다른 기기가 끄고 20시로 다시 켰다
 await push.refresh();await settled();
 while(m.queue.length){m.queue.shift().pass();await settled();}
 assert.equal(s.stored.settings.hour,20);assert.equal(rem.value.hour,20);assert.equal(EDIT_OF(storage),null);
 push.dispose();
});

test('판: 켜기의 늦은 응답과 넘겨받기 전 다시 읽기가 같은 판을 돌려줘도, 그 읽기가 서면 닫힌 탭의 편집을 넘겨받는다(GPT push-versions-world-r10 GA1 · GA8)',async()=>{
 const s=versionedServer(),storage=memory(),locks=fakeLocks(),m=manual(s),rem=reminderSettings();
 const bA=browser({registered:true,locks});
 let holdStatus=null,releaseEnable=null;
 const requestA=(action,body,options)=>{
  if(action==='subscribe'){const reply=s.request(action,body,options);return new Promise(resolve=>{releaseEnable=()=>resolve(reply);});}
  if(action==='status'&&holdStatus){const reply=s.request(action,body,options);return new Promise(resolve=>holdStatus.push(()=>resolve(reply)));}
  return m.request(action,body,options);
 };
 const a=makeV(bA,s,{now:()=>V0,request:requestA,storage});a.bindSettings(rem);
 await a.setAccount('acc-1');await a.ready();
 a.sync({digest:DIGEST('2026-10-23')});await flush();
 const first=m.queue.shift().late();   // A의 요약은 닿았고 응답만 늦다
 await s.request('sync',{settings:{frequency:2,hour:15},versions:{settings:V0}});   // 다른 기기 15시 — A의 켜기보다 먼저 닿는다
 const turning=a.enable({settings:{frequency:2,hour:null,since:null}});await settled();   // 켜 둔 계정에 이 브라우저를 더한다(요약 없이 — 다시 보낸 요약의 응답이 넘겨받기를 풀어 주지 않게) — 닿았고 응답만 늦다
 const requestB=(action,body,options)=>action==='sync'?Promise.reject(fault(0,'PUSH_UNAVAILABLE')):s.request(action,body,options);
 const b=on(s,{storage,request:requestB,browser:{locks}});b.bindSettings(rem);
 await b.setAccount('acc-1');await settled();
 rem.set({hour:18});b.sync({settings:{frequency:2,hour:18}});await settled();
 b.dispose();await settled();
 holdStatus=[];
 first();await settled();await settled();   // 낡은 응답 — 상태를 다시 읽기 시작한다(붙잡힘)
 assert.equal(holdStatus.length,1);
 releaseEnable();await turning;await settled();await settled();   // 켜기의 늦은 응답 — 다시 읽기와 같은 판이다
 holdStatus.shift()();holdStatus=null;await settled();await settled();
 while(m.queue.length){m.queue.shift().pass();await settled();}
 assert.equal(s.stored.settings.hour,18,'닫힌 탭의 18시를 넘겨받아 보낸다');assert.equal(rem.value.hour,18);
 a.dispose();
});

test('판: 켜기가 날아가는 동안 고른 시각은, 계정을 바꾼 뒤 그 켜기가 실패하면(돌아왔어도) 그 계정에 남지 않는다(GPT push-versions-world-r10 GA2)',async()=>{
 for(const back of [true,false]){
  let time=V0;
  const s=versionedServer({clock:()=>time}),b=browser({registered:true}),storage=memory(),rem=reminderSettings({frequency:2,hour:9,since:null});
  s.active=false;
  let failFirst=null;
  const request=(action,body,options)=>{
   if(action==='subscribe'&&!failFirst)return new Promise((resolve,reject)=>{failFirst=()=>reject(fault(0,'PUSH_UNAVAILABLE'));});
   return s.request(action,body,options);
  };
  const push=makeV(b,s,{now:()=>V0,request,storage});push.bindSettings(rem);
  await push.setAccount('acc-1');await push.ready();
  const first=push.enable({settings:{frequency:2,hour:9,since:null},digest:DIGEST('2026-10-21')});await settled();
  rem.set({hour:18});push.sync({settings:{frequency:2,hour:18}});await flush();
  assert.equal(EDIT_OF(storage)?.hour,18);
  await push.setAccount('acc-2');await push.ready();
  if(back){await push.setAccount('acc-1');await push.ready();}   // 같은 탭이 다른 계정을 거쳐 돌아왔다
  failFirst();await first;await settled();   // 첫 켜기가 실패한다
  assert.equal(EDIT_OF(storage),null,(back?'돌아온 뒤':'다른 계정에 있는 동안')+' 실패한 켜기 때 고른 시각을 지운다');
  if(!back){await push.setAccount('acc-1');await push.ready();}
  time=V0+3600000;
  await s.request('subscribe',{settings:{frequency:2,hour:20},digest:DIGEST('2026-10-24')});   // 한 시간 뒤 다른 기기가 20시로 켰다
  await push.refresh();await settled();
  assert.equal(s.stored.settings.hour,20,'다른 기기의 20시를 덮지 않는다');
  push.dispose();
 }
});

test('판: 옛 서버에서 켜기를 누른 뒤 다른 기기가 잠시 켠 계획에서 미뤄 둔 설정은, 그 계획이 끝난 것을 읽으면 버린다(GPT push-versions-world-r10 GA3 · GA6)',async()=>{
 let time=V0;
 const s=versionedServer({clock:()=>time}),r=rollback(s),b=browser({answer:'hang',registered:true}),storage=memory(),rem=reminderSettings();
 s.active=false;
 const push=makeV(b,s,{now:()=>V0,request:r.request,storage});push.bindSettings(rem);
 await push.setAccount('acc-1');r.old=true;await push.ready();
 assert.equal(push.snapshot().account.active,false);
 const turning=push.enable({settings:{frequency:2,hour:9,since:null},digest:DIGEST('2026-10-21')});   // 꺼진 계정에서 켜기를 눌렀다(권한 창)
 await s.request('subscribe',{settings:{frequency:2,hour:7},digest:DIGEST('2026-10-21')});   // 그사이 다른 기기가 잠시 켰다
 await push.refresh();assert.equal(push.snapshot().account.active,true);
 r.holdSync=true;
 rem.set({hour:9});push.sync({settings:{frequency:2,hour:9}});await flush();
 rem.set({hour:18});push.sync({settings:{frequency:2,hour:18}});await flush();   // 9시 응답을 기다리며 18시를 미뤄 둔다
 const answer=r.queue.shift().late();r.holdSync=false;
 await s.request('unsubscribe');   // 그 기기가 껐다 — 그 계획이 끝났다
 await push.refresh();assert.equal(push.snapshot().account.active,false);
 time=V0+500000;rem.set({hour:20});
 b.resolvePrompt();await turning;await settled();   // 옛 서버에 20시로 새 계획을 만든다
 assert.equal(s.stored.settings.hour,20);
 await answer().catch(()=>{});await settled();await settled();
 assert.equal(s.stored.settings.hour,20,'끝난 계획에서 미뤄 둔 18시가 새 계획을 덮지 않는다');assert.equal(rem.value.hour,20);
 push.dispose();
});

test('판: 넘겨받기 전 다시 읽기가 날아가는 동안 앱의 다시 시도는 읽기를 더 보내지 않는다(GPT push-versions-world-r10 GA4)',async()=>{
 const s=versionedServer(),storage=memory(),locks=fakeLocks(),m=manual(s),rem=reminderSettings();
 let held=null;
 const request=(action,body,options)=>{
  if(action==='status'&&held){held.count++;const reply=s.request(action,body,options);return new Promise(resolve=>held.list.push(()=>resolve(reply)));}
  return m.request(action,body,options);
 };
 const a=on(s,{storage,request,browser:{locks}});a.bindSettings(rem);
 await a.setAccount('acc-1');
 a.sync({digest:DIGEST('2026-10-23')});await flush();
 const answer=m.queue.shift().late();
 await s.request('sync',{settings:{frequency:2,hour:15},versions:{settings:V0}});   // 다른 기기 15시
 const requestB=(action,body,options)=>action==='sync'?Promise.reject(fault(0,'PUSH_UNAVAILABLE')):s.request(action,body,options);
 const b=on(s,{storage,request:requestB,browser:{locks}});b.bindSettings(rem);
 await b.setAccount('acc-1');await settled();
 rem.set({hour:18});b.sync({settings:{frequency:2,hour:18}});await settled();
 b.dispose();await settled();
 held={count:0,list:[]};
 answer();await settled();await settled();   // A가 낡은 응답을 받고 상태를 다시 읽는다(붙잡힘)
 assert.equal(held.count,1);
 a.retry();a.retry();await settled();   // 온라인 복귀 · 화면 복귀
 assert.equal(held.count,1,'날아가는 다시 읽기가 있으면 다시 시도가 읽기를 더 보내지 않는다');
 const list=held.list;held=null;list.shift()();await settled();await settled();
 while(m.queue.length){m.queue.shift().pass();await settled();}
 assert.equal(s.stored.settings.hour,18);assert.equal(rem.value.hour,18);assert.equal(a.snapshot().error,null);
 a.dispose();
});

test('판: 넘겨받기 전 다시 읽기가 날아가는 동안 온 다시 시도는, 그 읽기가 실패하면 한 번 다시 읽는다(GPT push-versions-world-r11 GA3)',async()=>{
 const s=versionedServer(),storage=memory(),locks=fakeLocks(),m=manual(s),rem=reminderSettings();
 let held=null;
 const request=(action,body,options)=>{
  if(action==='status'&&held){held.count++;const reply=s.request(action,body,options);return new Promise((resolve,reject)=>held.list.push({pass:()=>resolve(reply),fail:error=>reject(error)}));}
  return m.request(action,body,options);
 };
 const a=on(s,{storage,request,browser:{locks}});a.bindSettings(rem);
 await a.setAccount('acc-1');
 a.sync({digest:DIGEST('2026-10-23')});await flush();
 const answer=m.queue.shift().late();
 await s.request('sync',{settings:{frequency:2,hour:15},versions:{settings:V0}});   // 다른 기기 15시
 const requestB=(action,body,options)=>action==='sync'?Promise.reject(fault(0,'PUSH_UNAVAILABLE')):s.request(action,body,options);
 const b=on(s,{storage,request:requestB,browser:{locks}});b.bindSettings(rem);
 await b.setAccount('acc-1');await settled();
 rem.set({hour:18});b.sync({settings:{frequency:2,hour:18}});await settled();
 b.dispose();await settled();
 held={count:0,list:[]};
 answer();await settled();await settled();   // A가 낡은 응답을 받고 상태를 다시 읽는다(붙잡힘)
 assert.equal(held.count,1);
 a.retry();await settled();   // 망이 돌아왔다 — 날아가는 읽기가 있어 더 보내지 않는다
 assert.equal(held.count,1);
 const list=held.list;held=null;list.shift().fail(fault(0,'PUSH_UNAVAILABLE'));await settled();await settled();   // 그 읽기는 끊긴 망에서 실패한다
 while(m.queue.length){m.queue.shift().pass();await settled();}
 assert.equal(s.stored.settings.hour,18,'날아가는 동안 온 다시 시도를 잊지 않고 다시 읽어 넘겨받는다');assert.equal(rem.value.hour,18);
 a.dispose();
});

const heldEnable=s=>{const box={release:null};box.request=(action,body,options)=>{
 if(action==='subscribe'&&!box.release){const reply=s.request(action,body,options);return new Promise(resolve=>{box.release=()=>resolve(reply);});}
 return s.request(action,body,options);};return box;};
test('판: 켜기 응답을 기다리는 사이 고르고 로그아웃하면 그 뒤 그 계정으로 요청이 없고, 다시 로그인하면(같은 탭에서 · 탭을 닫고 새로 열어도) 서버 시각이 보인다(설계 주인 11-23 (가))',async()=>{
 for(const reopen of [false,true]){
  const s=versionedServer(),storage=memory(),rem=reminderSettings({frequency:2,hour:9,since:null});
  s.active=false;
  const held=heldEnable(s),push=makeV(browser({registered:true}),s,{now:()=>V0,request:held.request,storage});push.bindSettings(rem);
  await push.setAccount('acc-1');await push.ready();
  const turning=push.enable({settings:{frequency:2,hour:9,since:null},digest:DIGEST('2026-10-21')});await settled();   // 서버는 9시로 계획을 만들었고 응답만 늦다
  rem.set({hour:18});push.sync({settings:{frequency:2,hour:18}});await flush();
  assert.equal(EDIT_OF(storage)?.hour,18);
  const before=s.calls.length;
  await push.logout({hold:true});
  push.sync({settings:{frequency:2,hour:18},digest:DIGEST('2026-10-22')});push.retry();push.flush();await settled();   // 로그아웃 중의 1단 다시 잡기 · 다시 시도 · 떠남
  if(!reopen)await push.setAccount(null);
  held.release();await turning;await settled();   // 늦은 성공 응답
  push.retry();await settled();
  assert.equal(s.calls.length,before,'로그아웃 뒤에는 그 계정으로 요청을 내지 않는다');
  assert.equal(EDIT_OF(storage),null,'확인받지 못한 편집은 탭이 함께 쓰는 판 키에서도 지운다');
  let next=push;
  if(reopen){push.dispose();next=makeV(browser({registered:true}),s,{now:()=>V0,storage});next.bindSettings(rem);}   // 탭을 닫고 새로 연다
  await next.setAccount('acc-1');await next.ready();await settled();
  assert.equal(s.stored.settings.hour,9,'서버가 받은 켜기는 서버에 있다');assert.equal(rem.value.hour,9,'다시 로그인하면 서버 시각이 보인다');
  assert.equal(s.syncs().filter(call=>call.body.settings?.hour===18).length,0);
  next.dispose();
 }
});

test('판: 다른 계정이 들어오면 앞 계정에서 확인받지 못한 편집은 버려 새 계정에 닿지 않고, 앞 계정으로 돌아와도 서버 시각이 보인다(설계 주인 11-23 (나))',async()=>{
 const s1=versionedServer(),s2=versionedServer({settings:{frequency:1,hour:7,since:null}}),storage=memory(),rem1=reminderSettings(),rem2=reminderSettings();
 let who=s1;
 const request=(action,body,options)=>who.request(action,body,options);
 const push=makeV(browser({registered:true,subscribed:SUB}),s1,{now:()=>V0,request,storage});push.bindSettings(rem1);
 await push.setAccount('acc-1');await settled();
 s1.failWhen=action=>action==='sync'?fault(0,'PUSH_UNAVAILABLE'):null;   // acc-1의 18시는 망이 끊겨 확인받지 못했다
 rem1.set({hour:18});push.sync({settings:{frequency:2,hour:18}});await settled();
 assert.equal(EDIT_OF(storage)?.hour,18);
 who=s2;await push.setAccount('acc-2');push.bindSettings(rem2);await settled();   // 같은 탭에 다른 계정이 들어온다(토큰이 먼저 바뀌고, 1단 설정은 계정마다 — 새 계정의 1단은 계정을 받은 뒤 붙는다)
 push.retry();await settled();
 assert.equal(EDIT_OF(storage),null,'앞 계정의 편집을 판 키에서 지운다');
 assert.equal(s2.calls.filter(call=>call.body?.settings).length,0,'앞 계정의 편집이 새 계정에 닿지 않는다');
 assert.equal(s2.stored.settings.hour,7);assert.equal(rem2.value.hour,7);
 s1.failWhen=()=>null;who=s1;await push.setAccount('acc-1');push.bindSettings(rem1);await settled();   // 앞 계정으로 돌아온다
 assert.equal(s1.stored.settings.hour,null,'버린 18시는 다시 가지 않는다');assert.equal(rem1.value.hour,null,'서버 시각이 보인다');
 push.dispose();
});

test('판: 로그아웃은 넘겨받을 편집과 그 다시 읽기를 버린다 — 로그아웃이 실패해 resume()이 다시 읽어도 앞 읽기의 실패가 셋째 읽기를 잇지 않고 서버 설정이 보인다(GPT push-versions-world-r12 GA2 · 설계 주인 11-23)',async()=>{
 const s=versionedServer(),storage=memory(),locks=fakeLocks(),m=manual(s),rem=reminderSettings();
 let held=null;
 const request=(action,body,options)=>{
  if(action==='status'&&held){held.count++;const reply=s.request(action,body,options);return new Promise((resolve,reject)=>held.list.push({pass:()=>resolve(reply),fail:error=>reject(error)}));}
  return m.request(action,body,options);
 };
 const a=on(s,{storage,request,browser:{locks}});a.bindSettings(rem);
 await a.setAccount('acc-1');
 a.sync({digest:DIGEST('2026-10-23')});await flush();
 const answer=m.queue.shift().late();
 await s.request('sync',{settings:{frequency:2,hour:15},versions:{settings:V0}});   // 다른 기기 15시
 const requestB=(action,body,options)=>action==='sync'?Promise.reject(fault(0,'PUSH_UNAVAILABLE')):s.request(action,body,options);
 const b=on(s,{storage,request:requestB,browser:{locks}});b.bindSettings(rem);
 await b.setAccount('acc-1');await settled();
 rem.set({hour:18});b.sync({settings:{frequency:2,hour:18}});await settled();
 b.dispose();await settled();
 held={count:0,list:[]};
 answer();await settled();await settled();   // A가 낡은 응답을 받고 상태를 다시 읽는다(붙잡힘)
 assert.equal(held.count,1);
 a.retry();await settled();   // 날아가는 동안 다시 시도가 온다
 await a.logout({hold:true});a.resume();await settled();   // 로그아웃이 실패해 막기를 풀고 다시 읽는다
 assert.equal(held.count,2);assert.equal(EDIT_OF(storage),null,'로그아웃이 확인받지 못한 편집을 버렸다');
 held.list[0].fail(fault(0,'PUSH_UNAVAILABLE'));await settled();await settled();   // 앞 읽기가 실패한다
 assert.equal(held.count,2,'버린 편집 때문에 다시 읽지 않는다');
 const list=held.list;held=null;list[1].pass();await settled();await settled();
 while(m.queue.length){m.queue.shift().pass();await settled();}
 assert.equal(s.stored.settings.hour,15);assert.equal(rem.value.hour,15,'서버 설정이 보인다');assert.equal(a.snapshot().error,null);
 a.dispose();
});

// 저장소 알림을 듣는 가짜 창: 다른 탭이 판 키를 바꾸면 브라우저가 이 탭에 storage 사건을 준다.
const storageBus=()=>{const heard=[];return {heard,extra:{addEventListener:(type,fn)=>{if(type==='storage')heard.push(fn);},removeEventListener:(type,fn)=>{const i=heard.indexOf(fn);if(i>=0)heard.splice(i,1);}},
 fire:event=>{for(const fn of [...heard])fn(event);}};};
const twoTabsLeft=async()=>{
 const s=versionedServer({settings:{frequency:2,hour:9,since:null}}),storage=memory(),locks=fakeLocks(),rem=reminderSettings({frequency:2,hour:9,since:null}),bus=storageBus(),callsB=[];
 const requestB=(action,body,options)=>{callsB.push(action);return s.request(action,body,options);};
 const a=on(s,{storage,browser:{locks}});a.bindSettings(rem);
 const b=on(s,{storage,request:requestB,browser:{locks,extra:bus.extra}});b.bindSettings(rem);
 await a.setAccount('acc-1');await b.setAccount('acc-1');await settled();
 s.failWhen=action=>action==='sync'?fault(0,'PUSH_UNAVAILABLE'):null;   // B의 18시는 망이 끊겨 못 갔다
 rem.set({hour:18});b.sync({settings:{frequency:2,hour:18}});await settled();
 assert.equal(EDIT_OF(storage)?.hour,18);
 s.failWhen=()=>null;
 const oldValue=storage.getItem(KEY_V);
 await a.logout({hold:true});await settled();   // 같은 계정의 A 탭만 로그아웃 — B의 편집도 지운다(한계 13)
 assert.equal(EDIT_OF(storage),null);
 return {s,a,b,rem,bus,callsB,mark:callsB.length,oldValue};
};
test('판: 같은 계정의 다른 탭이 로그아웃해 이 탭이 보내지 못한 편집이 지워지면, 이 탭 화면은 서버 시각으로 바뀌고 쓰기 요청은 없다(설계 주인 11-23 r13 GA1 (가))',async()=>{
 const {s,a,b,rem,bus,callsB,mark,oldValue}=await twoTabsLeft();
 bus.fire({key:KEY_V,oldValue,newValue:null});await settled();   // 브라우저가 B에 저장소 알림을 준다(지워진 값과 함께)
 assert.equal(rem.value.hour,9,'B 화면이 서버 시각으로 바뀐다');assert.equal(s.stored.settings.hour,9);
 const after=callsB.slice(mark);
 assert.equal(after.filter(action=>action!=='status').length,0,'쓰기 요청은 없다');assert.ok(after.length<=1,'읽기는 한 번까지');
 a.dispose();b.dispose();
});

test('판: 다시 시도할 때 보낼 것이 없으면, 이 탭 화면이 서버 시각과 다를 때 한 번 읽어 맞추고 쓰기 요청은 없다(설계 주인 11-23 r13 GA1 (나))',async()=>{
 const {s,a,b,rem,callsB,mark}=await twoTabsLeft();
 b.retry();await settled();   // 저장소 알림 없이 망이 돌아온다
 assert.equal(rem.value.hour,9,'B 화면이 서버 시각으로 바뀐다');assert.equal(s.stored.settings.hour,9);
 const after=callsB.slice(mark);
 assert.equal(after.filter(action=>action!=='status').length,0,'쓰기 요청은 없다');assert.equal(after.length,1,'읽기는 한 번');
 b.retry();await settled();   // 화면이 맞으면 더 읽지 않는다
 assert.equal(callsB.length,mark+1);
 a.dispose();b.dispose();
});

test('판: 다른 탭의 편집이 받혀 나눠 쓰는 판 키가 비어도, 이 탭은 마지막으로 받은 옛 서버 값으로 화면을 되돌리지 않는다 — 한 번 읽어 새 값을 본다(r13 GA1)',async()=>{
 const s=versionedServer({settings:{frequency:2,hour:9,since:null}}),storage=memory(),locks=fakeLocks(),rem=reminderSettings({frequency:2,hour:9,since:null}),bus=storageBus();
 const a=on(s,{storage,browser:{locks}});a.bindSettings(rem);
 const b=on(s,{storage,browser:{locks,extra:bus.extra}});b.bindSettings(rem);
 await a.setAccount('acc-1');await b.setAccount('acc-1');await settled();
 rem.set({hour:20});a.sync({settings:{frequency:2,hour:20}});const oldValue=storage.getItem(KEY_V);await settled();   // A의 20시가 받혀 판 키가 빈다
 assert.equal(s.stored.settings.hour,20);assert.equal(EDIT_OF(storage),null);
 bus.fire({key:KEY_V,oldValue,newValue:null});await settled();
 assert.equal(rem.value.hour,20,'B가 아는 옛 9시로 되돌리지 않는다');
 a.dispose();b.dispose();
});

test('판: 화면 맞추기 읽기가 날아가는 동안 다른 탭이 이 브라우저 알림을 켜도, 늦은 응답이 그 새 구독과 기기 기록을 지우지 않는다(GPT push-versions-world-r14 GA1)',async()=>{
 const s=versionedServer({settings:{frequency:2,hour:9,since:null}}),storage=memory(),locks=fakeLocks(),rem=reminderSettings({frequency:2,hour:9,since:null}),bus=storageBus();
 let hold=null;const anonB=[];
 const requestB=(action,body,options)=>{if(action==='status'&&hold){const reply=s.request(action,body,options);return new Promise(resolve=>{hold.push(()=>resolve(reply));});}return s.request(action,body,options);};
 const a=makeV(browser({registered:true}),s,{now:()=>V0,storage,browser:{locks}});a.bindSettings(rem);   // 이 브라우저는 아직 알림을 받지 않는다(다른 기기만 켜 둠)
 const b=makeV(browser({registered:true,locks,extra:bus.extra}),s,{now:()=>V0,storage,request:requestB,anonymous:(action,body)=>{anonB.push(action);return Promise.resolve({ok:true,removed:true});}});b.bindSettings(rem);
 await a.setAccount('acc-1');await a.ready();await b.setAccount('acc-1');await settled();
 rem.set({hour:20});a.sync({settings:{frequency:2,hour:20}});const oldValue=storage.getItem(KEY_V);await settled();   // A의 20시가 받혀 판 키가 빈다
 hold=[];bus.fire({key:KEY_V,oldValue,newValue:null});await settled();   // B가 화면을 맞추려 상태를 읽는다(붙잡힘 — 지워진 값과 함께)
 assert.equal(hold.length,1);
 await a.enable({settings:{frequency:2,hour:20,since:null}});await settled();   // 그사이 A가 이 브라우저 알림을 켠다
 const record=storage.getItem('synk.world.push.v1');assert.ok(record,'A가 기기 기록을 적었다');
 const list=hold;hold=null;list.shift()();await settled();await settled();   // B의 늦은 응답
 assert.equal(storage.getItem('synk.world.push.v1'),record,'B의 화면 맞추기 읽기는 기기 기록을 지우지 않는다');
 assert.equal(anonB.length,0,'B는 구독을 끄는 요청을 내지 않는다');
 a.dispose();b.dispose();
});

test('판: 이 탭이 쓴 편집을 다른 탭이 지우면, 마지막으로 받은 서버 값이 화면과 우연히 같아도 한 번 읽어 서버 시각을 보인다(GPT push-versions-world-r14 GA3)',async()=>{
 const s=versionedServer({settings:{frequency:2,hour:18,since:null}}),storage=memory(),locks=fakeLocks(),rem=reminderSettings({frequency:2,hour:18,since:null}),bus=storageBus(),callsB=[];
 const requestB=(action,body,options)=>{callsB.push(action);return s.request(action,body,options);};
 const a=on(s,{storage,browser:{locks}});a.bindSettings(rem);
 const b=on(s,{storage,request:requestB,browser:{locks,extra:bus.extra}});b.bindSettings(rem);
 await a.setAccount('acc-1');await b.setAccount('acc-1');await settled();   // B가 마지막으로 받은 서버 값은 18시
 await s.request('sync',{settings:{frequency:2,hour:9},versions:{settings:V0}});   // 다른 기기가 9시로 바꾼다
 s.failWhen=action=>action==='sync'?fault(0,'PUSH_UNAVAILABLE'):null;   // B는 망이 끊겼다
 rem.set({hour:20});b.sync({settings:{frequency:2,hour:20}});await settled();
 rem.set({hour:18});b.sync({settings:{frequency:2,hour:18}});await settled();   // 20시를 거쳐 다시 18시
 assert.equal(EDIT_OF(storage)?.hour,18);
 s.failWhen=()=>null;const oldValue=storage.getItem(KEY_V),mark=callsB.length;
 await a.logout({hold:true});await settled();
 bus.fire({key:KEY_V,oldValue,newValue:null});await settled();
 assert.equal(rem.value.hour,9,'B 화면이 서버 시각 9시로 바뀐다');
 const after=callsB.slice(mark);assert.equal(after.filter(action=>action!=='status').length,0);assert.equal(after.length,1);
 a.dispose();b.dispose();
});

// 서버 18시에서 시작한 세 탭(B는 저장소 알림을 듣는다). 다른 기기가 9시로 바꾸고, 망이 끊긴 B가 20시를 거쳐 18시를 고른 뒤 A가 로그아웃한다.
const threeTabsLeft=async()=>{
 const s=versionedServer({settings:{frequency:2,hour:18,since:null}}),storage=memory(),locks=fakeLocks(),rem=reminderSettings({frequency:2,hour:18,since:null}),bus=storageBus();
 const net={offline:false,holdNext:false,held:[],callsB:[]};
 const requestB=(action,body,options)=>{net.callsB.push(action);
  if(net.offline)return Promise.reject(fault(0,'PUSH_UNAVAILABLE'));
  if(action==='status'&&net.holdNext){net.holdNext=false;const reply=s.request(action,body,options);return new Promise(resolve=>net.held.push(()=>resolve(reply)));}
  return s.request(action,body,options);};
 const a=on(s,{storage,browser:{locks}});a.bindSettings(rem);
 const b=on(s,{storage,request:requestB,browser:{locks,extra:bus.extra}});b.bindSettings(rem);
 const c=on(s,{storage,browser:{locks}});c.bindSettings(rem);
 await a.setAccount('acc-1');await b.setAccount('acc-1');await c.setAccount('acc-1');await settled();   // 셋 다 18시를 읽었다
 await s.request('sync',{settings:{frequency:2,hour:9},versions:{settings:V0}});   // 다른 기기가 9시로
 net.offline=true;
 rem.set({hour:20});b.sync({settings:{frequency:2,hour:20}});await settled();
 rem.set({hour:18});b.sync({settings:{frequency:2,hour:18}});await settled();   // B의 화면 · 마지막으로 받은 값은 18시, 서버는 9시
 const oldValue=storage.getItem(KEY_V);
 await a.logout({hold:true});await settled();   // A가 로그아웃해 B의 편집을 지운다
 return {s,a,b,c,rem,bus,net,storage,oldValue};
};
test('판: 화면 맞추기 읽기가 늦는 사이 다른 탭이 시각을 저장해 판 키가 다시 비면, 이 탭은 한 번 더 읽어 늦은 옛 응답이 화면을 되돌리지 않는다(GPT push-versions-world-r15 GA1)',async()=>{
 const {s,a,b,c,rem,bus,net,storage,oldValue}=await threeTabsLeft();
 net.offline=false;net.holdNext=true;
 bus.fire({key:KEY_V,oldValue,newValue:null});await settled();   // B가 읽는다(9시 응답이 늦다)
 assert.equal(net.held.length,1);
 rem.set({hour:18});c.sync({settings:{frequency:2,hour:18}});const cValue=storage.getItem(KEY_V);
 bus.fire({key:KEY_V,oldValue:null,newValue:cValue});await settled();await settled();   // C의 18시가 판을 맞춰 받힌다
 assert.equal(s.stored.settings.hour,18);assert.equal(EDIT_OF(storage),null);
 bus.fire({key:KEY_V,oldValue:cValue,newValue:null});await settled();   // C가 받힌 편집을 지운 알림
 net.held.shift()();await settled();await settled();   // B의 늦은 9시 응답
 assert.equal(rem.value.hour,18,'늦은 옛 응답이 화면을 9시로 되돌리지 않는다');assert.equal(s.stored.settings.hour,18);
 a.dispose();b.dispose();c.dispose();
});

test('판: 화면 맞추기 읽기가 망이 끊겨 실패하면, 망이 돌아온 다시 시도가 한 번 다시 읽어 서버 시각을 보인다(GPT push-versions-world-r15 GA3)',async()=>{
 const {s,a,b,c,rem,bus,net,oldValue}=await threeTabsLeft();
 bus.fire({key:KEY_V,oldValue,newValue:null});await settled();   // 읽기가 끊긴 망에서 실패한다
 assert.equal(rem.value.hour,18);assert.ok(b.snapshot().error);
 net.offline=false;const mark=net.callsB.length;
 b.retry();await settled();await settled();   // 망이 돌아온다
 assert.equal(rem.value.hour,9,'서버 시각이 보인다');assert.equal(s.stored.settings.hour,9);assert.equal(b.snapshot().error,null);
 const after=net.callsB.slice(mark);assert.equal(after.filter(action=>action!=='status').length,0);assert.equal(after.length,1);
 a.dispose();b.dispose();c.dispose();
});

// 같은 브라우저의 두 탭(구독 · 알림 권한 · 저장소 · 잠금을 함께 쓴다). 서버는 이 브라우저 기기를 잃었고, 브라우저 구독과 기록은 남았다.
const reEnableTabs=()=>{
 const s=versionedServer({settings:{frequency:2,hour:9,since:null}}),storage=memory(),locks=fakeLocks(),bus=storageBus();
 storage.setItem(PUSH_RECORD_KEY,JSON.stringify({accountId:'acc-1',deviceId:'dev-1',endpoint:SUB}));
 const shared=browser({registered:true,subscribed:SUB,permission:'granted',locks,extra:bus.extra});
 const net={holdNext:false,held:[]},netA={holdSubscribe:false,held:[]},anonB=[];
 const requestB=(action,body,options)=>{if(action==='status'&&net.holdNext){net.holdNext=false;const reply=s.request(action,body,options).then(data=>({...data,device:{subscribed:false}}));return new Promise(resolve=>net.held.push(()=>resolve(reply)));}return s.request(action,body,options);};
 const requestA=(action,body,options)=>{if(action==='subscribe'&&netA.holdSubscribe){netA.holdSubscribe=false;const reply=s.request(action,body,options);return new Promise(resolve=>netA.held.push(()=>resolve(reply)));}return s.request(action,body,options);};
 const a=makeV(shared,s,{now:()=>V0,storage,request:requestA});
 const b=makeV(shared,s,{now:()=>V0,storage,request:requestB,anonymous:(action,body)=>{anonB.push([action,body.endpoint]);return Promise.resolve({ok:true,removed:true});}});
 const rem=withDigest(reminderSettings({frequency:2,hour:9,since:null}));a.bindSettings(rem);b.bindSettings(rem);
 // 끝: 이 브라우저에 구독이 있고, 기록이 그 구독을 가리키고, 서버에 그 구독이 올랐고, 두 탭이 켜짐이다(설계 주인 11-23 불변식).
 const onAndRegistered=(why)=>{
  assert.ok(shared.current,'이 브라우저 구독이 있다 — '+why);
  assert.equal(JSON.parse(storage.getItem(PUSH_RECORD_KEY)||'null')?.endpoint,shared.current.endpoint,'기록이 지금 구독을 가리킨다 — '+why);
  assert.ok(s.calls.some(c=>c.action==='subscribe'&&c.body.subscription?.endpoint===shared.current.endpoint),'서버에 지금 구독이 올랐다 — '+why);
  assert.equal(a.snapshot().device.subscribed,true);assert.equal(b.snapshot().device.subscribed,true);
  assert.deepEqual(anonB,[],'로그인 없이 끄지 않는다 — '+why);
 };
 return {s,storage,bus,net,netA,anonB,shared,a,b,rem,onAndRegistered};
};
test('판: 같은 브라우저의 다른 탭이 같은 구독으로 다시 켜는 요청이 날아가는 사이 늦게 온 평소 읽기도, 끝은 켜짐과 서버에 오른 구독이다(설계 주인 11-23 불변식)',async()=>{
 const {net,netA,a,b,onAndRegistered}=reEnableTabs();
 await a.setAccount('acc-1');await b.setAccount('acc-1');await a.ready();await b.refresh();await settled();
 net.holdNext=true;const ordinary=b.refresh();await settled();   // B의 평소 읽기는 「이 기기 없음」을 받아 두고 늦다
 netA.holdSubscribe=true;const enabling=a.enable({settings:{frequency:2,hour:9,since:null}});await settled();   // A의 켜기 요청도 날아가는 중이다
 assert.equal(netA.held.length,1);
 net.held.shift()();await ordinary;await settled();   // A의 응답보다 먼저 늦은 B 응답이 닿는다 — B가 새 구독으로 다시 잇는다
 netA.held.shift()();const on=await enabling;await settled();
 assert.equal(on.error,null);
 onAndRegistered('A의 켜기 응답이 옛 주소로 기록을 덮지 않는다');
 a.dispose();b.dispose();
});
test('판: 같은 브라우저의 다른 탭이 같은 구독으로 다시 켜고 시각을 저장한 사이 늦게 온 평소 읽기도, 끝은 켜짐과 서버에 오른 구독이다(GPT push-versions-world-r17 GA1)',async()=>{
 const {storage,bus,net,a,b,rem,onAndRegistered}=reEnableTabs();
 await a.setAccount('acc-1');await b.setAccount('acc-1');await a.ready();await b.refresh();await settled();
 net.holdNext=true;const ordinary=b.refresh();await settled();   // B의 평소 읽기는 「이 기기 없음」을 받아 두고 늦다
 assert.equal(net.held.length,1);
 const on=await a.enable({settings:{frequency:2,hour:9,since:null}});await settled();   // A가 같은 구독 · 같은 기기 이름으로 다시 켠다
 assert.equal(on.device.subscribed,true);
 rem.set({hour:18});a.sync({settings:{frequency:2,hour:18}});const oldValue=storage.getItem(KEY_V);await settled();   // A가 시각을 저장해 판 키가 빈다
 bus.fire({key:KEY_V,oldValue,newValue:null});await settled();await settled();   // B의 화면 맞추기 읽기가 먼저 「있음」을 받는다
 net.held.shift()();await ordinary;await settled();   // 늦은 평소 읽기
 onAndRegistered('화면 맞추기 읽기가 낀 차례');
 a.dispose();b.dispose();
});
test('판: 같은 브라우저의 다른 탭이 같은 구독으로 다시 켠 사이 늦게 온 평소 읽기도, 화면 맞추기 읽기 없이 끝은 켜짐과 서버에 오른 구독이다(GPT push-versions-world-r17 GA1 · r17 설계 검토 P3)',async()=>{
 const {storage,net,a,b,onAndRegistered,shared}=reEnableTabs();
 await a.setAccount('acc-1');await b.setAccount('acc-1');await a.ready();await b.refresh();await settled();
 net.holdNext=true;const ordinary=b.refresh();await settled();
 assert.equal(net.held.length,1);
 const on=await a.enable({settings:{frequency:2,hour:9,since:null}});await settled();
 assert.equal(on.device.subscribed,true);
 net.held.shift()();await ordinary;await settled();
 onAndRegistered('화면 맞추기 읽기가 없는 차례');
 const off=await a.disable();await settled();   // A는 다시 잇기 전의 옛 구독을 기억한다 — 끄기는 지금 구독을 끈다
 assert.equal(off.removed,true);assert.equal(shared.current,null,'다른 탭이 이은 새 구독도 끈다');assert.equal(storage.getItem(PUSH_RECORD_KEY),null);
 a.dispose();b.dispose();
});
test('다시 잇기: 다른 탭이 새 구독으로 다시 이은 뒤 이 탭의 옛 주소 켜기 요청이 서버에 늦게 닿아도, 서버에는 지금 구독이 남는다(GPT push-versions-world-r18 GA2 · GA6)',async()=>{
 // 서버는 한 로그인 세션에 주소 하나를 두고 마지막 subscribe로 덮는다(SYNK-talk world-push-store subscribe).
 const s=versionedServer({settings:{frequency:2,hour:9,since:null}}),storage=memory(),locks=fakeLocks();let onServer=SUB;
 const serve=(action,body,options)=>s.request(action,body,options).then(data=>{
  if(action==='subscribe')onServer=body.subscription.endpoint;
  return action==='status'||action==='subscribe'?{...data,device:action==='subscribe'||body.endpoint&&body.endpoint===onServer?{subscribed:true,deviceId:'dev-1'}:{subscribed:false}}:data;
 });
 storage.setItem(PUSH_RECORD_KEY,JSON.stringify({accountId:'acc-1',deviceId:'dev-1',endpoint:SUB}));
 const shared=browser({registered:true,subscribed:SUB,permission:'granted',locks}),late=[];
 const requestA=(action,body,options)=>action==='subscribe'&&!late.done?new Promise(resolve=>late.push(()=>resolve(serve(action,body,options)))):serve(action,body,options);
 const a=makeV(shared,s,{now:()=>V0,storage,request:requestA}),b=makeV(shared,s,{now:()=>V0,storage,request:serve});
 const rem=withDigest(reminderSettings({frequency:2,hour:9,since:null}));a.bindSettings(rem);b.bindSettings(rem);
 await a.setAccount('acc-1');await b.setAccount('acc-1');await a.ready();await settled();
 onServer=null;   // 서버가 이 브라우저 기기를 잃었다(만료 정리)
 const enabling=a.enable({settings:{frequency:2,hour:9,since:null}});await settled();   // A가 옛 주소로 켜는 요청이 서버에 아직 닿지 않았다
 assert.equal(late.length,1);
 await b.refresh();await settled();   // B의 평소 읽기가 「없음」을 보고 새 구독으로 다시 잇는다
 assert.notEqual(shared.current.endpoint,SUB);assert.equal(onServer,shared.current.endpoint);
 late.done=true;late.shift()();const on=await enabling;await settled();   // A의 옛 주소 요청이 뒤에 닿아 서버 주소를 덮는다
 assert.equal(on.error,null);
 assert.equal(onServer,shared.current.endpoint,'서버에 남은 주소가 지금 구독이다');
 assert.equal(JSON.parse(storage.getItem(PUSH_RECORD_KEY)).endpoint,shared.current.endpoint,'기록이 지금 구독을 가리킨다');
 a.dispose();b.dispose();
});
test('끄기: 같은 브라우저의 다른 탭이 다른 계정으로 이 구독을 가져간 뒤 이 탭에서 끄면, 그 계정의 서버 구독 · 브라우저 구독 · 기록을 건드리지 않는다(GPT push-versions-world-r18 GA1)',async()=>{
 const storage=memory(),shared=browser({registered:true,subscribed:SUB,permission:'granted'});
 storage.setItem(PUSH_RECORD_KEY,JSON.stringify({accountId:'acc-1',deviceId:'dev-1',endpoint:SUB}));
 const s1=server({device:true,active:true}),s2=server(),a=make(shared,s1,{storage}),b=make(shared,s2,{storage});
 await a.setAccount('acc-1');await a.ready();await settled();   // A는 이 구독을 기억한다
 await b.setAccount('acc-2');await b.ready();
 const taken=await b.enable({settings:{frequency:2,hour:null,since:null},digest:null});   // B가 다른 계정으로 같은 구독을 가져간다
 assert.equal(taken.device.subscribed,true);
 const record=JSON.stringify({accountId:'acc-2',deviceId:'dev-1',endpoint:SUB});storage.setItem(PUSH_RECORD_KEY,record);   // 가짜 서버는 늘 acc-1을 주어 기록 계정을 바로 맞춘다
 const before=[s1.calls.length,s2.calls.length];
 const off=await a.disable();await settled();
 assert.equal(off.removed,true,'이 계정 구독은 이 브라우저에 없다');
 assert.equal(shared.current?.endpoint,SUB,'다른 계정의 브라우저 구독이 남는다');
 assert.equal(storage.getItem(PUSH_RECORD_KEY),record,'다른 계정의 기록이 남는다');
 assert.deepEqual([...s1.calls.slice(before[0]),...s2.calls.slice(before[1])].filter(c=>c.action==='unsubscribe'),[],'다른 계정의 서버 구독을 끄지 않는다(GPT r19 GA4 — 두 서버의 새 호출을 따로 자른다)');
 a.dispose();b.dispose();
});
test('끄기: 끄기 응답이 늦는 사이 다른 계정 탭이 같은 브라우저 구독을 켜 기록을 가져가면, 늦은 응답은 그 구독과 기록을 지우지 않는다(GPT push-versions-world-r19 GA1)',async()=>{
 const storage=memory(),shared=browser({registered:true,subscribed:SUB,permission:'granted'});
 storage.setItem(PUSH_RECORD_KEY,JSON.stringify({accountId:'acc-1',deviceId:'dev-1',endpoint:SUB}));
 const s1=server({device:true,active:true}),s2=server(),held=[];
 const request1=(action,body,options)=>action==='unsubscribe'?new Promise(resolve=>held.push(()=>resolve(s1.request(action,body,options)))):s1.request(action,body,options);
 const a=make(shared,s1,{storage,request:request1}),b=make(shared,s2,{storage});
 await a.setAccount('acc-1');await a.ready();await b.setAccount('acc-2');await b.ready();await settled();
 const off=a.disable();await settled();   // A의 서버 해제는 닿았고 응답만 늦다
 assert.equal(held.length,1);
 const taken=await b.enable({settings:{frequency:2,hour:null,since:null},digest:null});await settled();   // 그사이 B가 다른 계정으로 같은 구독을 켠다
 assert.equal(taken.device.subscribed,true);assert.equal(JSON.parse(storage.getItem(PUSH_RECORD_KEY)).accountId,'acc-2');
 held.shift()();const done=await off;await settled();
 assert.equal(done.removed,true);
 assert.equal(shared.current?.endpoint,SUB,'다른 계정의 브라우저 구독이 남는다');
 assert.equal(JSON.parse(storage.getItem(PUSH_RECORD_KEY)||'null')?.accountId,'acc-2','다른 계정의 기록이 남는다');
 a.dispose();b.dispose();
});
test('다시 잇기: 주인 기록이 이 계정인데 그 주소가 지금 구독과 달라도, 지금 구독이 서버에 없으면 다시 잇는다(GPT push-versions-world-r19 GA2 — 다음 평소 읽기가 늘 바로잡는다)',async()=>{
 const b=browser({registered:true,subscribed:SUB,permission:'granted'}),s=server({device:false}),storage=memory();
 storage.setItem(PUSH_RECORD_KEY,JSON.stringify({accountId:'acc-1',deviceId:'dev-1',endpoint:'https://fcm.googleapis.com/fcm/send/stale'}));   // 다른 탭의 늦은 등록이 옛 주소를 남겼다
 const push=make(b,s,{storage});push.bindSettings(withDigest(reminderSettings()));await push.setAccount('acc-1');await settled();
 assert.ok(b.current&&b.current.endpoint!==SUB,'새 구독으로 다시 이었다');
 assert.equal(JSON.parse(storage.getItem(PUSH_RECORD_KEY)).endpoint,b.current.endpoint);
 assert.equal(push.snapshot().device.subscribed,true);
 push.dispose();
});
test('다시 잇기: 다른 탭이 이은 구독으로 한 번 더 올리는 요청이 늦는 사이 또 다시 이으면, 늦은 요청은 기록을 옛 주소로 덮지 않고 다음 평소 읽기가 서버를 지금 구독에 맞춘다(GPT push-versions-world-r19 GA2)',async()=>{
 const s=versionedServer({settings:{frequency:2,hour:9,since:null}}),storage=memory(),locks=fakeLocks();let onServer=SUB;
 const serve=(action,body,options)=>s.request(action,body,options).then(data=>{
  if(action==='subscribe')onServer=body.subscription.endpoint;
  return action==='status'||action==='subscribe'?{...data,device:action==='subscribe'||body.endpoint&&body.endpoint===onServer?{subscribed:true,deviceId:'dev-1'}:{subscribed:false}}:data;
 });
 storage.setItem(PUSH_RECORD_KEY,JSON.stringify({accountId:'acc-1',deviceId:'dev-1',endpoint:SUB}));
 const shared=browser({registered:true,subscribed:SUB,permission:'granted',locks,endpoints:['https://fcm.googleapis.com/fcm/send/y','https://fcm.googleapis.com/fcm/send/z','https://fcm.googleapis.com/fcm/send/w']}),late=[];let holdA=0;
 const requestA=(action,body,options)=>action==='subscribe'&&holdA>0?(holdA--,new Promise(resolve=>late.push(()=>resolve(serve(action,body,options))))):serve(action,body,options);
 const a=makeV(shared,s,{now:()=>V0,storage,request:requestA}),b=makeV(shared,s,{now:()=>V0,storage,request:serve});
 const rem=withDigest(reminderSettings({frequency:2,hour:9,since:null}));a.bindSettings(rem);b.bindSettings(rem);
 await a.setAccount('acc-1');await b.setAccount('acc-1');await a.ready();await settled();
 onServer=null;holdA=2;   // 서버가 이 브라우저 기기를 잃었다. A의 subscribe 둘(옛 주소 X · 한 번 더 올리는 Y)이 늦다
 const enabling=a.enable({settings:{frequency:2,hour:9,since:null}});await settled();
 await b.refresh();await settled();const y=shared.current.endpoint;   // B가 Y로 다시 잇는다
 late.shift()();await settled();await settled();   // A의 옛 주소 X가 뒤에 닿아 Y를 밀어낸다 — A는 Y로 한 번 더 올리는 요청을 낸다(늦다)
 assert.equal(late.length,1);assert.equal(onServer,SUB);
 await b.refresh();await settled();const z=shared.current.endpoint;   // B가 Y도 서버에 없다고 보고 Z로 다시 잇는다
 assert.notEqual(z,y);assert.equal(onServer,z);
 late.shift()();await enabling;await settled();   // A의 늦은 Y 등록이 서버를 Y로 덮는다
 assert.equal(JSON.parse(storage.getItem(PUSH_RECORD_KEY)).endpoint,shared.current.endpoint,'늦은 요청이 기록을 옛 주소로 덮지 않는다');
 await b.refresh();await settled();   // 다음 평소 읽기
 assert.equal(onServer,shared.current.endpoint,'서버에 지금 구독이 있다');
 assert.equal(JSON.parse(storage.getItem(PUSH_RECORD_KEY)).endpoint,shared.current.endpoint);
 assert.equal(a.snapshot().device.subscribed,true);assert.equal(b.snapshot().device.subscribed,true);
 a.dispose();b.dispose();
});
test('다시 잇기: 옛 구독을 지우는 사이 sync가 더 새 학습 요약을 저장해도, 다시 잇기는 지운 뒤 지은 요약을 보내 서버 요약을 되돌리지 않는다(GPT push-versions-world-r19 GA3)',async()=>{
 const s=versionedServer({settings:{frequency:2,hour:9,since:null}}),storage=memory();
 storage.setItem(PUSH_RECORD_KEY,JSON.stringify({accountId:'acc-1',deviceId:'dev-1',endpoint:SUB}));
 const b=browser({registered:true,subscribed:SUB,permission:'granted'}),held=[];let day='2026-11-22',lost=true;
 const old=b.current,unsubscribe=old.unsubscribe.bind(old);old.unsubscribe=()=>new Promise(resolve=>held.push(()=>resolve(unsubscribe())));   // 구독 지우기가 늦다
 const request=(action,body,options)=>s.request(action,body,options).then(data=>action==='status'&&lost?{...data,device:{subscribed:false}}:data);   // 다른 기기가 켠 계정에서 이 기기만 만료됐다
 const rem=reminderSettings({frequency:2,hour:9,since:null});rem.digest=()=>({digest:DIGEST(day)});
 const push=makeV(b,s,{storage,now:()=>V0,request});push.bindSettings(rem);
 const starting=push.setAccount('acc-1');await settled();
 assert.equal(held.length,1,'다시 잇기가 옛 구독을 지우는 중이다');
 day='2026-11-23';push.sync({digest:DIGEST(day)});await settled();await settled();   // 그사이 새 학습 요약이 서버에 저장된다
 assert.equal(s.stored.digest?.lastStudyDay,'2026-11-23');
 lost=false;held.shift()();await starting;await settled();await settled();
 assert.equal(s.stored.digest?.lastStudyDay,'2026-11-23','서버 요약이 앞 날로 돌아가지 않는다');
 assert.ok(b.current,'다시 이었다');
 push.dispose();
});
test('다시 잇기: 상태 읽기가 이 브라우저 구독이 서버에 없다고 하면, 지우기만 하지 않고 새 구독으로 다시 올려 켜짐으로 끝난다(설계 주인 11-23 불변식)',async()=>{
 const b=browser({registered:true,subscribed:SUB,permission:'granted'}),s=server({device:false}),storage=memory();
 storage.setItem(PUSH_RECORD_KEY,JSON.stringify({accountId:'acc-1',deviceId:'dev-1',endpoint:SUB}));
 const push=make(b,s,{storage});push.bindSettings(withDigest(reminderSettings()));await push.setAccount('acc-1');await push.ready();await settled();
 assert.ok(b.current,'구독이 남아 있다');assert.notEqual(b.current.endpoint,SUB,'만료됐을 수 있는 옛 주소 대신 새 구독이다');
 assert.equal(JSON.parse(storage.getItem(PUSH_RECORD_KEY)).endpoint,b.current.endpoint);
 assert.equal(s.calls.filter(c=>c.action==='subscribe').length,1,'서버에 한 번 다시 올렸다');
 assert.equal(push.snapshot().device.subscribed,true);
 assert.deepEqual(s.calls.filter(c=>c.anonymous).map(c=>c.action),[],'서버에서 끄지 않았다');
 push.dispose();
});
test('다시 잇기: 다시 올린 구독도 서버가 곧바로 없다고 하면 한 번만 더 해 보고 멈추고, 설정 화면에 꺼짐과 오류가 보인다(설계 주인 11-23 불변식 5)',async()=>{
 const b=browser({registered:true,subscribed:SUB,permission:'granted'}),base=server({device:false}),storage=memory();
 storage.setItem(PUSH_RECORD_KEY,JSON.stringify({accountId:'acc-1',deviceId:'dev-1',endpoint:SUB}));
 let subscribes=0;
 const request=(action,body,options)=>action==='subscribe'?(subscribes++,base.request(action,body,options).then(data=>({...data,device:{subscribed:false}}))):base.request(action,body,options);
 const push=make(b,base,{storage,request});push.bindSettings(withDigest(reminderSettings()));await push.setAccount('acc-1');await settled();   // 계정을 정한 읽기가 다시 잇기를 두 번 해 본다
 assert.equal(subscribes,2,'한 번만 더 해 보고 멈춘다');
 const view=push.snapshot();
 assert.equal(view.device.subscribed,false,'설정 화면은 꺼짐이다');assert.ok(view.error,'다시 켜 달라는 오류가 보인다');
 await push.refresh();await settled();
 assert.equal(subscribes,2,'다음 읽기가 다시 잇기를 되풀이하지 않는다');
 push.dispose();
});
test('다시 잇기: 1단 설정 묶음이 붙기 전에는 다시 잇지 않고 구독도 지우지 않으며, 붙은 뒤의 평소 읽기가 다시 잇는다(GPT push-versions-world-r18 GA4)',async()=>{
 const b=browser({registered:true,subscribed:SUB,permission:'granted'}),s=server({device:false}),storage=memory();
 storage.setItem(PUSH_RECORD_KEY,JSON.stringify({accountId:'acc-1',deviceId:'dev-1',endpoint:SUB}));
 const push=make(b,s,{storage});await push.setAccount('acc-1');await settled();   // 앱을 열면 계정 상태 읽기가 1단 묶음보다 먼저 끝난다
 assert.equal(b.current?.endpoint,SUB,'구독을 지우지 않는다');
 assert.equal(s.calls.filter(c=>c.action==='subscribe').length,0,'빈 설정으로 다시 올리지 않는다');
 push.bindSettings(withDigest(reminderSettings()));await push.refresh();await settled();
 assert.ok(b.current&&b.current.endpoint!==SUB,'묶음이 붙은 뒤 새 구독으로 다시 이었다');
 assert.equal(s.calls.filter(c=>c.action==='subscribe').length,1);
 assert.equal(push.snapshot().device.subscribed,true);
 push.dispose();
});
test('다시 잇기: 알림 권한이 허용이 아니면 다시 잇지 않고 구독도 지우지 않는다(설계 주인 11-23 불변식)',async()=>{
 const b=browser({registered:true,subscribed:SUB,permission:'denied'}),s=server({device:false}),storage=memory();
 storage.setItem(PUSH_RECORD_KEY,JSON.stringify({accountId:'acc-1',deviceId:'dev-1',endpoint:SUB}));
 const push=make(b,s,{storage});push.bindSettings(withDigest(reminderSettings()));await push.setAccount('acc-1');await settled();
 assert.equal(b.current?.endpoint,SUB,'구독을 지우지 않는다');
 assert.equal(s.calls.filter(c=>c.action==='subscribe').length,0,'다시 올리지 않는다');
 assert.equal(push.snapshot().device.subscribed,false,'설정 화면은 꺼짐이다');
 push.dispose();
});
test('다시 잇기: 이 브라우저 구독을 지우기만 하는 것은 끄기와 로그아웃뿐이다(설계 주인 11-23 불변식 2)',async()=>{
 const s=versionedServer(),storage=memory(),b=browser({registered:true,permission:'granted'});
 const push=makeV(b,s,{storage,now:()=>V0});await push.setAccount('acc-1');await push.ready();
 await push.enable({settings:{frequency:2,hour:null,since:null},digest:DIGEST('2026-10-21')});
 assert.ok(b.current);
 await push.refresh();await push.fresh(0);await settled();
 assert.ok(b.current,'상태 읽기는 지우지 않는다');
 const off=await push.disable();
 assert.equal(off.removed,true);assert.equal(b.current,null,'끄기는 지운다');assert.equal(storage.getItem(PUSH_RECORD_KEY),null);
 await push.enable({settings:{frequency:2,hour:null,since:null},digest:DIGEST('2026-10-21')});
 assert.ok(b.current);
 await push.logout({hold:true});
 assert.equal(b.current,null,'로그아웃은 지운다');assert.equal(storage.getItem(PUSH_RECORD_KEY),null);
 push.dispose();
});
test('판: 같은 브라우저의 다른 탭이 알림을 켜는 사이 늦게 온 평소 읽기는 그 탭이 방금 쓴 기기 기록을 지우지 않는다(r17 Fable 설계 검토 — world-push.mjs:422)',async()=>{
 const s=server(),storage=memory(),shared=browser({registered:false});
 const net={holdNext:false,held:[]},anonB=[];
 const requestB=(action,body,options)=>{if(action==='status'&&net.holdNext){net.holdNext=false;const reply=s.request(action,body,options);return new Promise(resolve=>net.held.push(()=>resolve(reply)));}return s.request(action,body,options);};
 const a=makeV(shared,s,{storage});
 const b=makeV(shared,{request:requestB,anonymous:(action,body)=>{anonB.push([action,body.endpoint]);return Promise.resolve({ok:true,removed:true});}},{storage});
 await a.setAccount('acc-1');await b.setAccount('acc-1');await a.ready();await settled();
 assert.equal(storage.getItem(PUSH_RECORD_KEY),null,'처음에는 이 브라우저 구독도 기기 기록도 없다');
 net.holdNext=true;const ordinary=b.ready();await settled();   // B가 설정을 열어 평소 읽기를 보냈고 응답이 늦다(그때 구독은 없었다)
 assert.equal(net.held.length,1);
 const on=await a.enable({settings:{frequency:2,hour:null}});await settled();   // 그사이 A가 알림을 켠다
 assert.equal(on.device.subscribed,true);
 const record=storage.getItem(PUSH_RECORD_KEY);assert.ok(record,'A가 기기 기록을 썼다');
 net.held.shift()();await ordinary;await settled();   // 늦은 B 응답
 assert.equal(storage.getItem(PUSH_RECORD_KEY),record,'늦은 평소 읽기는 다른 탭이 방금 쓴 기기 기록을 지우지 않는다');
 assert.deepEqual(anonB,[],'A의 새 구독을 서버에서 끄지 않는다');
 assert.ok(shared.current,'브라우저 구독도 남는다');
 a.dispose();b.dispose();
});

test('판: 화면 맞추기 읽기가 늦은 평소 읽기보다 먼저 끝나도, 평소 읽기는 사라진 구독의 기기 기록을 정리한다(GPT push-versions-world-r16 GA1)',async()=>{
 const s=versionedServer({settings:{frequency:2,hour:9,since:null}}),storage=memory(),locks=fakeLocks(),rem=reminderSettings({frequency:2,hour:9,since:null}),bus=storageBus();
 const net={holdNext:false,held:[]},anonB=[];
 const requestB=(action,body,options)=>{if(action==='status'&&net.holdNext){net.holdNext=false;const reply=s.request(action,body,options);return new Promise(resolve=>net.held.push(()=>resolve(reply)));}return s.request(action,body,options);};
 const a=on(s,{storage,browser:{locks}});a.bindSettings(rem);
 const b=makeV(browser({registered:true,locks,extra:bus.extra}),s,{now:()=>V0,storage,request:requestB,anonymous:(action,body)=>{anonB.push(action);return Promise.resolve({ok:true,removed:true});}});b.bindSettings(rem);
 await a.setAccount('acc-1');await b.setAccount('acc-1');await settled();
 const record=JSON.stringify({accountId:'acc-1',deviceId:'dev-1',endpoint:'https://fcm.googleapis.com/fcm/send/gone'});
 storage.setItem('synk.world.push.v1',record);   // 이 브라우저의 구독은 사라졌고 기기 기록만 남았다
 net.holdNext=true;const ordinary=b.refresh();await settled();   // 평소 읽기(정리함)가 늦다
 assert.equal(net.held.length,1);
 rem.set({hour:18});a.sync({settings:{frequency:2,hour:18}});const oldValue=storage.getItem(KEY_V);await settled();   // A의 18시가 받혀 판 키가 빈다
 bus.fire({key:KEY_V,oldValue,newValue:null});await settled();await settled();   // B의 화면 맞추기 읽기가 먼저 끝난다
 assert.equal(storage.getItem('synk.world.push.v1'),record,'화면 맞추기 읽기는 정리하지 않는다');
 net.held.shift()();await ordinary;await settled();   // 늦은 평소 읽기
 assert.equal(storage.getItem('synk.world.push.v1'),null,'평소 읽기가 사라진 구독의 기기 기록을 지운다');
 assert.deepEqual(anonB,['unsubscribe'],'서버의 기기 기록도 끈다');
 a.dispose();b.dispose();
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
 await push.logout({hold:true});
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

test('판: 이미 있던 이 브라우저 구독으로 다시 켜 기기 기록이 그대로여도, 켜기 전에 시작한 status는 그 구독과 기록을 지우지 않는다(설계 검토 7 · r17)',async()=>{
 const s=versionedServer(),storage=memory(),anonymous=[],b=browser({registered:true,subscribed:SUB});let hold=null;
 const record=JSON.stringify({accountId:'acc-1',deviceId:'dev-1',endpoint:SUB});storage.setItem(PUSH_RECORD_KEY,record);   // 서버는 이 기기를 잃었고 브라우저 구독과 기록은 남았다
 const request=(action,body={},options={})=>{
  if(action==='status'&&hold){const reply=s.request(action,body,options).then(data=>({...data,device:{subscribed:false}}));return new Promise(resolve=>hold.push(()=>resolve(reply)));}
  return s.request(action,body,options);
 };
 const push=makeV(b,s,{storage,now:()=>V0,request,anonymous:(action,body)=>{anonymous.push([action,body]);return Promise.resolve({ok:true,removed:true});}});
 await push.setAccount('acc-1');await push.ready();
 hold=[];const reading=push.refresh();await flush();await flush();
 assert.equal(hold.length,1,'status가 붙잡혔다');
 await push.enable({settings:{frequency:2,hour:null,since:null},digest:DIGEST('2026-10-21')});
 assert.equal(storage.getItem(PUSH_RECORD_KEY),record,'같은 구독으로 다시 켜 기록이 바이트까지 같다');
 hold.shift()();hold=null;await reading;await settled();
 assert.equal(b.current?.endpoint,SUB,'브라우저 구독이 남는다');
 assert.equal(storage.getItem(PUSH_RECORD_KEY),record,'주인 기록이 남는다');
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

// ── 5-3 켜기 공개의 캐시 섞임(섞임 표 3 · 4, 설계 주인 11-25) ──────────────────────────────────────────────────────────────────────────────
// 맨 주소로 불리는 world-push는 HTML · 셸과 캐시 판이 갈린다. 옛 판은 라이브(synk-policy abd09dc) world-push.mjs를 그대로 둔 live-world-push-20261125.mjs다.
// 셸은 node에서 못 올리므로 app-shell.mjs의 진짜 문장을 떼어 돈다. 라이브 셸(abd09dc app-shell 1134 · 1166)은 worldPush?.logout()을 옵션 없이 부르고,
// 실패해도 resume을 부르지 않으며, 떠날 때 worldPush?.flush()만 부른다 — 「옛 셸」 시험은 이 차례를 그대로 흉내 낸다.
import {createHash} from 'node:crypto';
import {sourceStatements} from '../../../tests/lib/source-statements.cjs';
import {createWorldPush as createLivePush} from './live-world-push-20261125.mjs';
const LIVE_PUSH_SHA='620858264b3f97b8ccb712bdb11b88ad2cd75c381097f9c3ecb5501d53ff3487';
const shellStatements=sourceStatements(fs.readFileSync(new URL('../app-shell.mjs',import.meta.url),'utf8'));
const makeLive=(b,s,extra={})=>createLivePush({request:s.request,anonymous:s.anonymous,env:b.env,storage:extra.storage||memory(),workerUrl:SCOPE+'world-push-sw.js',scopeUrl:SCOPE,now:()=>V0,...extra});
// 셸의 떠남 · 망 돌아옴 · 화면 숨김 · 보임 처리기(flushReminders · pagehide · online · visibilitychange)를 이 worldPush로 건다.
function shellHandlers(worldPush){
 const handlers={},refreshed=[],flushedReminders=[];
 const on=kind=>({hidden:false,addEventListener:(type,fn)=>{handlers[`${kind}:${type}`]=fn;}});
 const window=on('window'),document=on('document');
 const client={snapshot:{accountId:'acc-1'},busy:false,refresh:()=>{refreshed.push(document.hidden);return Promise.resolve();}};
 const life={reminders:{flushPending:()=>flushedReminders.push(1)},close(){}};
 const body=[shellStatements.declaration('flushReminders'),shellStatements.call('window.addEventListener',{0:'pagehide'},{calls:'flushReminders'}),
  shellStatements.call('window.addEventListener',{0:'online'}),shellStatements.call('document.addEventListener',{0:'visibilitychange'})].join('\n');
 new Function('worldPush','client','life','window','document','refreshTutorAccount','writing','speaking','releaseSheet','account','authBoundary',body)(
  worldPush,client,life,window,document,()=>{},null,null,()=>{},{stop(){}},0);
 return {handlers,document,refreshed,flushedReminders};
}
// 셸의 로그아웃 명령(commands.logout) 원문을 이 worldPush와 client.logout으로 돈다. 셸이 고르는 화면 함수는 가짜다.
function shellLogout(worldPush,clientLogout){
 const node=shellStatements.declarationNode('commands').declarations[0].init.properties.find(p=>p.key?.name==='logout');
 const toasts=[];
 const names=['dramaInvite','finishDramaInvite','accountActionPending','authBoundary','entryGate','client','worldPush','life','noteDeviceAccount','clearMonthAnswer',
  'noteDeviceSignOut','localStorage','sessionConfirmed','close','front','entryDestinationHandled','startOpening','home','welcome','t','showEntryRecovery'];
 const run=new Function(...names,`return (${shellStatements.text(node.value)});`)(
  {},()=>{},false,0,null,{snapshot:{accountId:'acc-1'},logout:clientLogout},worldPush,{owner:'acc-1',atlasNext:null},()=>{},()=>{},
  ()=>{},memory(),true,()=>{},null,false,()=>{},{isMaru:false,toast:text=>toasts.push(text)},()=>{},key=>key,()=>{});
 return {run,toasts};
}

test('섞임: 옛 판 world-push는 라이브와 내용이 같고(줄 끝만 작업본 설정을 따른다 — GA5), retry · resume · bindSettings가 없으며 셸이 부르는 그 밖의 이름은 있다',()=>{
 const text=fs.readFileSync(new URL('./live-world-push-20261125.mjs',import.meta.url),'utf8').replace(/\r\n/g,'\n');
 assert.equal(createHash('sha256').update(text).digest('hex'),LIVE_PUSH_SHA,'라이브 abd09dc의 world-push.mjs와 같다 — 저장소에는 LF로 들고, core.autocrlf 작업본은 CRLF로 꺼내므로 줄 끝을 LF로 맞춰 견준다');
 const live=makeLive(browser({registered:true,subscribed:SUB}),server({device:true,active:true}));
 for(const name of ['retry','resume','bindSettings','hasEdit'])assert.equal(typeof live[name],'undefined',`옛 판에는 ${name}이 없다`);
 for(const name of ['flush','logout','setAccount','ack','subscribe'])assert.equal(typeof live[name],'function',`셸이 부르는 ${name}은 옛 판에도 있다`);
});

test('섞임: 새 셸은 world-push의 새 이름(retry · resume)을 ?.()로 부르고, 로그아웃은 hold로 부른다 — 셸이 부르는 그 밖의 이름은 옛 판에도 있다',()=>{
 const shell=fs.readFileSync(new URL('../app-shell.mjs',import.meta.url),'utf8');
 const calls=[...shell.matchAll(/worldPush(\?)?\.([A-Za-z]+)(\?\.)?\(/g)].map(([,,name,guard])=>({name,guarded:!!guard}));
 const live=makeLive(browser(),server());
 for(const {name,guarded} of calls)assert.ok(typeof live[name]==='function'||guarded,`${name}: 옛 판에 없는 이름은 ?.()로 부른다`);
 assert.ok(calls.some(c=>c.name==='retry'),'retry를 부르는 줄이 있다');
 assert.match(shell,/worldPush\?\.logout\(\{hold:true\}\)/,'새 셸은 hold를 넘긴다');
 assert.match(shell,/worldPush\?\.resume\?\.\(\)/,'로그아웃이 실패하면 resume을 부른다');
});

test('섞임 표 3 · 새 셸 + 옛 world-push: 망이 돌아오거나 화면이 다시 보이면 TypeError 없이 계정을 다시 읽고, 떠날 때와 숨을 때는 옛 flush만 부른다',async()=>{
 const b=browser({registered:true,subscribed:SUB,permission:'granted'}),s=server({device:true,active:true});
 const live=makeLive(b,s);await live.setAccount('acc-1');
 let flushes=0;const flush0=live.flush;live.flush=(...args)=>{flushes++;return flush0(...args);};
 const shell=shellHandlers(live);
 shell.handlers['window:online']();
 shell.document.hidden=false;shell.handlers['document:visibilitychange']();
 assert.deepEqual(shell.refreshed,[false,false],'두 처리기 모두 뒤 줄(client.refresh)까지 돈다');
 shell.document.hidden=true;shell.handlers['document:visibilitychange']();shell.handlers['window:pagehide']();
 assert.equal(flushes,2,'숨을 때와 떠날 때 옛 flush를 부른다');
 assert.deepEqual(shell.flushedReminders,[],'옛 flush는 1단 다시 잡기를 받지 않는다 — 라이브 셸처럼 돌리지 않는다');
});

test('섞임 표 3 · 새 셸 + 옛 world-push: 로그아웃이 실패해도 옛 logout에 옵션을 넘기고 resume 없이 실패 안내까지 간다',async()=>{
 const b=browser({registered:true,subscribed:SUB,permission:'granted'}),s=server({device:true,active:true}),storage=memory();
 storage.setItem(PUSH_RECORD_KEY,JSON.stringify({accountId:'acc-1',deviceId:'dev-1',endpoint:SUB}));
 const live=makeLive(b,s,{storage});await live.setAccount('acc-1');
 const seen=[];const logout0=live.logout;live.logout=(...args)=>{seen.push(args);return logout0(...args);};
 const shell=shellLogout(live,()=>Promise.reject(Object.assign(Error('offline'),{code:'NETWORK'})));
 await shell.run();
 assert.deepEqual(seen,[[{hold:true}]],'새 셸은 hold를 넘긴다 — 옛 판은 이 옵션을 모른다');
 assert.deepEqual(shell.toasts,['account.logoutFailed']);
 assert.equal(b.current,null,'옛 logout은 옛 뜻대로 이 브라우저 구독을 껐다');
});

test('섞임 표 4 · 옛 셸 + 새 world-push: 옵션 없는 logout은 옛 뜻 그대로 끄기만 하고, 로그아웃이 실패하면 그 탭의 2단 요청이 막히지 않는다',async()=>{
 const s=versionedServer(),m=manual(s),storage=memory(),rem=reminderSettings();
 storage.setItem(PUSH_RECORD_KEY,JSON.stringify({accountId:'acc-1',deviceId:'dev-1',endpoint:SUB}));
 // 이 기기만 끈다 — 계정에는 다른 기기가 남아 2단이 켜져 있다(가짜 서버는 기기 하나라 끄기를 여기서 답한다).
 const request=(action,body,options)=>action==='unsubscribe'?Promise.resolve({ok:true,accountId:'acc-1',removed:true,account:{active:true,devices:1}}):m.request(action,body,options);
 const push=on(s,{storage,request});push.bindSettings(rem);
 await push.setAccount('acc-1');
 rem.set({hour:20});push.sync({settings:{frequency:2,hour:20}});await flush();
 const pending=m.queue.shift();
 const out=await push.logout();   // 라이브 셸: await worldPush?.logout() — 그 뒤 client.logout이 실패하고 resume은 부르지 않는다
 assert.equal(out.ok,true);assert.equal(storage.getItem(PUSH_RECORD_KEY),null,'이 브라우저 구독을 껐다');
 assert.ok(EDIT_OF(storage),'확인받지 못한 편집을 버리지 않는다(옛 logout은 편집을 몰랐다)');
 pending.pass();await settled();
 assert.equal(EDIT_OF(storage),null,'앞서 보낸 요청의 응답을 버리지 않고 받힌다');
 rem.set({hour:9});push.sync({settings:{frequency:2,hour:9}});await flush();
 assert.equal(m.queue.at(-1)?.body.settings?.hour,9,'로그아웃이 실패한 뒤에도 그 탭의 설정 요청이 나간다');
 m.queue.shift().pass();await settled();
 const before=s.calls.filter(call=>call.action==='status').length;
 await push.refresh();
 assert.equal(s.calls.filter(call=>call.action==='status').length,before+1,'상태 읽기도 나간다');
});

test('섞임 · 같은 판끼리(새 셸 + 새 world-push): 셸의 로그아웃은 끝날 때까지 2단 요청을 막고, 실패하면 resume으로 풀며, 끝나면 계정 바뀜까지 막는다',async()=>{
 for(const fails of [true,false]){
  const s=versionedServer(),m=manual(s),storage=memory(),rem=reminderSettings();
  const push=on(s,{storage,request:m.request});push.bindSettings(rem);
  await push.setAccount('acc-1');
  let finish;const gate=new Promise((resolve,reject)=>{finish=()=>fails?reject(Object.assign(Error('offline'),{code:'NETWORK'})):resolve();});
  const shell=shellLogout(push,()=>gate);
  const running=shell.run();await settled();
  rem.set({hour:9});push.sync({settings:{frequency:2,hour:9}});await settled();
  assert.equal(m.queue.length,0,'로그아웃하는 동안(client.logout을 기다린다) 새 요청을 내지 않는다');
  finish();await running;await settled();
  push.sync({settings:{frequency:2,hour:9}});await flush();
  if(fails){
   assert.deepEqual(shell.toasts,['account.logoutFailed']);
   assert.equal(m.queue.at(-1)?.body.settings?.hour,9,'실패하면 셸이 resume으로 막기를 풀어 다시 보낸다');
  }else{
   assert.equal(m.queue.length,0,'로그아웃이 끝나면 계정이 바뀔 때까지 막는다');
   await push.setAccount(null);assert.equal(push.snapshot().phase,'signed-out');
  }
 }
});

test('섞임 · 같은 판끼리(옛 셸 + 옛 world-push): 라이브 그대로 — 옵션 없는 logout은 끄기만 하고 막지 않는다',async()=>{
 const b=browser({registered:true,subscribed:SUB,permission:'granted'}),s=server({device:true,active:true}),storage=memory();
 storage.setItem(PUSH_RECORD_KEY,JSON.stringify({accountId:'acc-1',deviceId:'dev-1',endpoint:SUB}));
 const live=makeLive(b,s,{storage});await live.setAccount('acc-1');
 assert.equal((await live.logout()).ok,true);assert.equal(b.current,null);
 const before=s.calls.length;live.sync({settings:{frequency:1,hour:9}});await settled();
 assert.ok(s.calls.length>before,'실패한 로그아웃 뒤에도 요청이 나간다');
});

test('섞임 표 4 · 불변식: 옵션 없는 logout이 끄는 동안에는 상태 읽기가 「서버에 없음」을 봐도 로그아웃하는 계정의 구독을 다시 올리지 않는다',async()=>{
 const b=browser({registered:true,subscribed:SUB,permission:'granted'}),base=server({device:true,active:true}),storage=memory();
 storage.setItem(PUSH_RECORD_KEY,JSON.stringify({accountId:'acc-1',deviceId:'dev-1',endpoint:SUB}));
 const held=[];let gone=false;
 const request=(action,body,options)=>{
  if(action==='unsubscribe'){gone=true;const reply=base.request(action,body,options);return new Promise(resolve=>held.push(()=>resolve(reply)));}   // 서버는 지웠고 응답이 늦다
  return base.request(action,body,options).then(data=>action==='status'&&gone?{...data,device:{subscribed:false}}:data);
 };
 const push=make(b,base,{storage,request});push.bindSettings(withDigest(reminderSettings()));await push.setAccount('acc-1');await settled();
 const leaving=push.logout();await settled();
 assert.equal(held.length,1,'끄기 요청이 날아가는 중이다');
 await push.refresh();await settled();   // 1단이 띄우기 직전의 평소 읽기 — 이 브라우저 구독이 서버에 없다고 본다
 assert.equal(base.calls.filter(c=>c.action==='subscribe').length,0,'끄는 동안 다시 잇지 않는다');
 assert.deepEqual(b.log.filter(([kind])=>kind==='unsubscribe'),[],'다시 잇기를 시작하지 않아 브라우저 구독도 건드리지 않는다(지우기는 로그아웃이 한다)');
 held.shift()();await leaving;await settled();
 assert.equal(b.current,null,'로그아웃이 이 브라우저 구독을 껐다');assert.equal(storage.getItem(PUSH_RECORD_KEY),null);
 assert.equal(base.calls.filter(c=>c.action==='subscribe').length,0,'서버에 로그아웃하는 계정의 구독이 남지 않는다');
 push.dispose();
});

test('섞임 표 4 · 불변식: 다시 잇기가 옛 구독을 지우는 사이 옵션 없는 logout이 시작되면, 다시 잇기는 새 구독을 올리지 않고 멈춘다',async()=>{
 const b=browser({registered:true,subscribed:SUB,permission:'granted'}),base=server({device:false,active:true}),storage=memory();
 storage.setItem(PUSH_RECORD_KEY,JSON.stringify({accountId:'acc-1',deviceId:'dev-1',endpoint:SUB}));
 const held=[];const old=b.current,unsubscribe=old.unsubscribe.bind(old);old.unsubscribe=()=>new Promise(resolve=>held.push(()=>resolve(unsubscribe())));   // 구독 지우기가 늦다
 const push=make(b,base,{storage});push.bindSettings(withDigest(reminderSettings()));
 const starting=push.setAccount('acc-1');await settled();
 assert.equal(held.length,1,'다시 잇기가 옛 구독을 지우는 중이다');
 const leaving=push.logout();await settled();
 assert.equal(held.length,2,'로그아웃도 같은 구독을 지우는 중이다');
 held.shift()();await starting;await settled();
 assert.equal(base.calls.filter(c=>c.action==='subscribe').length,0,'로그아웃하는 동안 다시 잇기가 새 구독을 올리지 않는다');
 held.shift()();await leaving;await settled();
 assert.equal(b.current,null);assert.equal(storage.getItem(PUSH_RECORD_KEY),null);
 assert.equal(base.calls.filter(c=>c.action==='subscribe').length,0);
 push.dispose();
});

// 설계 검토 push-mix53(Fable 5.2, P1): 옵션 없는 logout은 기록의 옛 주소만 끈다. 그 사이 날아가던 켜기가 그대로 끝나면 방금 만든 구독과 기록이
// 로그아웃한 계정으로 남는다. 켜기는 시작할 때의 logout 수와 다르면 멈추고 방금 만든 구독을 지운다. 다시 잇기는 계정이 바뀔 때까지 하지 않는다.
test('섞임 표 4 · 불변식: 다시 잇기의 켜기 요청이 날아가는 사이 옵션 없는 logout이 돌면, 켜기는 멈추고 방금 만든 구독을 지워 로그아웃한 계정의 구독 · 기록이 남지 않는다',async()=>{
 const b=browser({registered:true,subscribed:SUB,permission:'granted'}),base=server({device:false,active:true}),storage=memory();
 storage.setItem(PUSH_RECORD_KEY,JSON.stringify({accountId:'acc-1',deviceId:'dev-1',endpoint:SUB}));
 const held=[];
 const request=(action,body,options)=>action==='subscribe'?new Promise(resolve=>held.push(()=>resolve(base.request(action,body,options)))):base.request(action,body,options);
 const push=make(b,base,{storage,request});push.bindSettings(withDigest(reminderSettings()));
 const starting=push.setAccount('acc-1');await settled();
 assert.equal(held.length,1,'다시 잇기의 켜기 요청이 날아가는 중이다');
 const fresh=b.current.endpoint;assert.notEqual(fresh,SUB,'새 구독이 생겼고 기록은 아직 옛 주소다');
 await push.logout();await settled();   // 라이브 셸의 logout — 기록의 옛 주소만 끈다
 held.shift()();await starting;await settled();
 assert.equal(b.current,null,'켜기가 방금 만든 구독을 지웠다');
 assert.equal(storage.getItem(PUSH_RECORD_KEY),null,'로그아웃한 계정의 기록이 남지 않는다');
 assert.equal(push.snapshot().error,null,'학생이 고른 로그아웃이라 오류를 보이지 않는다');
 await push.setAccount(null);await settled();   // 라이브 셸: client.logout 성공 → onLoading → setAccount(null)
 assert.equal(b.current,null);assert.equal(storage.getItem(PUSH_RECORD_KEY),null);
 push.dispose();
});

test('섞임 표 4 · 불변식: 켜기가 권한 창을 기다리는 사이 옵션 없는 logout이 돌면, 뒤늦게 허용돼도 구독을 남기지 않는다',async()=>{
 const b=browser({registered:true,permission:'default',answer:'hang'}),s=server({device:false,active:false}),storage=memory();
 const push=make(b,s,{storage});push.bindSettings(withDigest(reminderSettings()));await push.setAccount('acc-1');await push.ready();
 const turning=push.enable({settings:{frequency:2,hour:null,since:null},digest:DIGEST('2026-10-21')});await settled();
 await push.logout();await settled();
 b.resolvePrompt();await turning;await settled();
 assert.equal(b.current,null,'뒤늦게 허용된 구독을 지웠다');
 assert.equal(storage.getItem(PUSH_RECORD_KEY),null);
 assert.equal(s.calls.filter(c=>c.action==='subscribe').length,0,'서버에 켜기를 보내지 않았다');
 push.dispose();
});

test('섞임 표 4 · 불변식: 옵션 없는 logout이 끝난 뒤 계정이 바뀌기 전에는, 브라우저 구독이 남아 있어도 다시 잇지 않는다 — 계정이 바뀌면 다시 잇는다',async()=>{
 const b=browser({registered:true,subscribed:SUB,permission:'granted'}),base=server({device:true,active:true}),storage=memory();
 storage.setItem(PUSH_RECORD_KEY,JSON.stringify({accountId:'acc-1',deviceId:'dev-1',endpoint:SUB}));
 const push=make(b,base,{storage});push.bindSettings(withDigest(reminderSettings()));await push.setAccount('acc-1');await settled();
 const old=b.current;old.unsubscribe=async()=>false;   // 브라우저가 구독 지우기를 거절했다 — 로그아웃은 기록을 남긴다
 await push.logout();await settled();
 assert.equal(b.current?.endpoint,SUB,'브라우저 구독이 남았다');
 await push.refresh();await settled();   // 서버는 이미 이 기기를 지웠다 — 상태 읽기가 「서버에 없음」을 본다
 assert.equal(base.calls.filter(c=>c.action==='subscribe').length,0,'로그아웃한 계정으로 다시 올리지 않는다');
 await push.setAccount('acc-1');   // 같은 계정으로 바꿔 들어와도 그대로 — 계정이 바뀐 것이 아니다
 await push.setAccount(null);await push.setAccount('acc-1');await settled();   // 다시 로그인했다
 assert.equal(base.calls.filter(c=>c.action==='subscribe').length,1,'다시 로그인한 뒤의 읽기는 다시 잇는다');
 push.dispose();
});

test('섞임 표 4: 옵션 없는 logout이 실패해 계정이 그대로여도, 학생이 그 뒤에 누른 켜기는 된다 — 멈추는 것은 그때 날아가던 켜기뿐이다',async()=>{
 const b=browser({registered:true,permission:'granted'}),s=versionedServer(),storage=memory();
 const push=makeV(b,s,{storage,now:()=>V0});push.bindSettings(withDigest(reminderSettings()));await push.setAccount('acc-1');await push.ready();
 await push.logout();   // 라이브 셸: 그 뒤 client.logout이 실패하고 resume은 부르지 않는다
 await push.enable({settings:{frequency:2,hour:null,since:null},digest:DIGEST('2026-10-21')});await settled();
 assert.ok(b.current,'켰다');
 assert.equal(JSON.parse(storage.getItem(PUSH_RECORD_KEY)).accountId,'acc-1');
 assert.equal(push.snapshot().device.subscribed,true);
});

// GPT push-versions-world-mix53 GA1~GA4: 멈춘 켜기의 자리 셋과 셸 처리기의 retry.
test('섞임 표 4 · GA1: 다른 계정의 구독을 넘겨받는 응답을 기다리는 사이 옵션 없는 logout이 돌면, 켜기 요청을 서버에 보내지 않는다',async()=>{
 const b=browser({registered:true,subscribed:SUB,permission:'granted'}),s=server({device:false,active:false}),storage=memory();
 storage.setItem(PUSH_RECORD_KEY,JSON.stringify({accountId:'acc-B',deviceId:'dev-b',endpoint:SUB}));   // 이 브라우저 구독은 B 계정 것이다
 const held=[];
 const anonymous=(action,body,options)=>new Promise(resolve=>held.push(()=>resolve(s.anonymous(action,body,options))));
 const push=make(b,s,{storage,anonymous});push.bindSettings(withDigest(reminderSettings()));await push.setAccount('acc-1');await push.ready();
 const turning=push.enable({settings:{frequency:2,hour:null,since:null},digest:DIGEST('2026-10-21')});await settled();
 assert.equal(held.length,1,'B의 구독을 넘겨받는 끄기 요청이 날아가는 중이다');
 await push.logout();await settled();
 held.shift()();await turning;await settled();
 assert.equal(s.calls.filter(c=>c.action==='subscribe').length,0,'로그아웃을 시작한 계정으로 켜기 요청을 보내지 않는다');
 assert.notEqual(JSON.parse(storage.getItem(PUSH_RECORD_KEY)||'null')?.accountId,'acc-1','로그아웃한 계정의 기록이 없다');
 push.dispose();
});

test('섞임 표 4 · GA2: 켜기가 다른 계정의 이 브라우저 구독을 받기 전에 멈추면(옵션 없는 logout · 계정 바뀜) 그 계정의 구독을 지우지 않는다',async()=>{
 for(const stop of ['logout','account']){
  const b=browser({registered:true,subscribed:SUB,permission:'granted'}),s=server({device:false,active:false}),storage=memory();
  storage.setItem(PUSH_RECORD_KEY,JSON.stringify({accountId:'acc-B',deviceId:'dev-b',endpoint:SUB}));
  const reg=await b.env.navigator.serviceWorker.getRegistration(SCOPE),answer=reg.pushManager.subscribe.bind(reg.pushManager);let release;
  reg.pushManager.subscribe=options=>new Promise(resolve=>{release=()=>resolve(answer(options));});   // 브라우저가 늦게 지금 구독(B 것)을 돌려준다
  const push=make(b,s,{storage});push.bindSettings(withDigest(reminderSettings()));await push.setAccount('acc-1');await push.ready();
  const turning=push.enable({settings:{frequency:2,hour:null,since:null},digest:DIGEST('2026-10-21')});await settled();
  if(stop==='logout')await push.logout();else await push.setAccount('acc-2');
  release();await turning;await settled();await settled();
  assert.equal(b.current?.endpoint,SUB,`${stop}: B의 브라우저 구독이 남는다`);
  assert.equal(JSON.parse(storage.getItem(PUSH_RECORD_KEY)).accountId,'acc-B',`${stop}: B의 기록이 남는다`);
  assert.equal(s.calls.filter(c=>c.action==='subscribe'||c.anonymous).length,0,`${stop}: 서버에 아무것도 보내지 않았다`);
  push.dispose();
 }
});

test('섞임 표 4 · GA3: 켜기 뒤 다른 탭의 새 구독으로 다시 올리는 요청이 실패해도, 그사이 옵션 없는 logout이 돌았으면 켜짐으로 적지 않는다',async()=>{
 const b=browser({registered:true,permission:'granted',endpoints:['https://fcm.googleapis.com/fcm/send/e1','https://fcm.googleapis.com/fcm/send/e2']}),s=server(),storage=memory();
 const reg=await b.env.navigator.serviceWorker.getRegistration(SCOPE);let push,subscribes=0;
 const request=async(action,body,options)=>{
  if(action!=='subscribe')return s.request(action,body,options);
  subscribes++;
  if(subscribes===1){const reply=await s.request(action,body,options);await b.current.unsubscribe();await reg.pushManager.subscribe({userVisibleOnly:true});return reply;}   // 다른 탭이 새 구독(e2)으로 다시 이었다
  await push.logout();throw Object.assign(Error('offline'),{code:'NETWORK'});   // 다시 올리는 사이 옛 셸이 로그아웃하고, 그 요청은 망이 끊겨 실패한다
 };
 push=make(b,s,{storage,request});push.bindSettings(withDigest(reminderSettings()));await push.setAccount('acc-1');await push.ready();
 await push.enable({settings:{frequency:2,hour:null,since:null},digest:DIGEST('2026-10-21')});await settled();
 assert.equal(subscribes,2,'다시 올리기까지 갔다');
 assert.equal(push.snapshot().device.subscribed,false,'멈춘 켜기를 켜짐으로 적지 않는다');
 assert.equal(push.snapshot().error,null);
 push.dispose();
});

test('섞임 · GA4 · 같은 판끼리(새 셸 + 새 world-push): 망이 돌아올 때와 화면이 다시 보일 때 둘 다 retry를 부른다',async()=>{
 const s=versionedServer(),push=on(s);await push.setAccount('acc-1');
 let retries=0;const retry0=push.retry;push.retry=(...args)=>{retries++;return retry0(...args);};
 const shell=shellHandlers(push);
 shell.handlers['window:online']();assert.equal(retries,1,'망이 돌아오면 다시 보낸다');
 shell.document.hidden=false;shell.handlers['document:visibilitychange']();assert.equal(retries,2,'화면이 다시 보이면 다시 보낸다');
 assert.deepEqual(shell.refreshed,[false,false]);
});
