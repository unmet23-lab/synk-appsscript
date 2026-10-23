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
