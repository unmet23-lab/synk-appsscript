import test from 'node:test';
import assert from 'node:assert/strict';
import {withDeviceDeadline,DeviceTimeout,deviceAvailability,deviceConnectionNote,deviceKey,canMigrateDevice,foregroundProjectOptions,rejectedDeviceRegistration} from './public/pulse-app/push.mjs';
import {liveView} from './public/pulse-app/views.mjs';

test('an unanswered embedded browser permission prompt releases the operation and ignores a late resolution',async()=>{
  let finish,aborted=0;
  const pending=new Promise(resolve=>finish=resolve);
  await assert.rejects(withDeviceDeadline(pending,{milliseconds:10,onTimeout:()=>aborted++,message:'permission pending'}),error=>error instanceof DeviceTimeout&&error.message==='permission pending');
  assert.equal(aborted,1);finish('granted');
  assert.equal(await withDeviceDeadline(Promise.resolve('retry granted'),{milliseconds:10}),'retry granted');
  assert.equal(aborted,1);
});
test('deadline preserves a provider error and does not abort successful requests later',async()=>{
  let aborted=0;
  const error=new Error('provider unavailable');
  await assert.rejects(withDeviceDeadline(Promise.reject(error),{milliseconds:10,onTimeout:()=>aborted++}),value=>value===error);
  assert.equal(await withDeviceDeadline(Promise.resolve(42),{milliseconds:10,onTimeout:()=>aborted++}),42);
  await new Promise(resolve=>setTimeout(resolve,20));assert.equal(aborted,0);
});
test('iOS, missing APIs, and denied permissions have actionable guidance without requesting new permission',()=>{
  const supported={secure:true,serviceWorker:true,pushManager:true,notification:true,permission:'granted',ios:false,standalone:false};
  assert.equal(deviceAvailability(supported),'');
  assert.match(deviceAvailability({...supported,ios:true}),/홈 화면에 추가/);
  assert.match(deviceAvailability({...supported,pushManager:false}),/Chrome 또는 Edge/);
  assert.match(deviceAvailability({...supported,permission:'denied'}),/사이트 설정/);
  assert.equal(deviceAvailability({...supported,ios:true,standalone:true}),'');
});
test('persistent customer copy only promises persistence after the server confirms the remembered connection',()=>{
  const base={mode:'customer',enabled:true,configured:true};
  assert.doesNotMatch(deviceConnectionNote(base),/30일|다시 이용하면 자동/);
  assert.match(deviceConnectionNote({...base,connection:{remembered:true,renewalDays:30}}),/마지막 이용 후 30일/);
  assert.match(deviceConnectionNote({...base,connection:{remembered:true,renewalDays:30}}),/연결 닫기/);
  assert.match(deviceConnectionNote({...base,enabled:false}),/공용 기기에서는 켜지/);
});
test('legacy migration requires an already enabled device owned by the current customer session',()=>{
  const input={mode:'customer',permission:'granted',server:{configured:true,deviceConnection:{remembered:false},subscriptions:[{endpointHash:'same',enabled:true,currentSession:true}]},local:{hash:'same',subscription:{}}};
  assert.equal(canMigrateDevice(input),true);
  for(const change of [{mode:'staff'},{permission:'default'},{local:{hash:'other',subscription:{}}},{local:{hash:'same',subscription:null}},{server:{...input.server,deviceConnection:{remembered:true}}},{server:{...input.server,subscriptions:[]}},...[{enabled:false,currentSession:true},{enabled:true,currentSession:false}].map(row=>({server:{...input.server,subscriptions:[{endpointHash:'same',...row}]}}))])assert.equal(canMigrateDevice({...input,...change}),false);
});
test('VAPID public keys reject malformed values before a subscription request',()=>{
  const bytes=Buffer.alloc(65);bytes[0]=4;
  assert.equal(deviceKey(bytes.toString('base64url')).length,65);
  for(const invalid of ['','not key!',Buffer.alloc(65).toString('base64url'),Buffer.alloc(64,4).toString('base64url')])assert.throws(()=>deviceKey(invalid));
});
test('pending and failed device operations are visible in the inbox and errors remain escaped',()=>{
  const html=liveView({live:{open:true,deviceReady:true,deviceBusy:true,deviceProgress:'허용 대기',deviceIssue:'<img src=x>',notifications:[]}});
  assert.match(html,/설정 중…/);assert.match(html,/허용 대기/);assert.match(html,/&lt;img src=x&gt;/);assert.doesNotMatch(html,/<img src=x>/);
});
test('background project refresh and live polling never claim foreground customer activity',()=>{
  const settings={headers:{'X-Pulse-Active':'1','X-Other':'unchanged'}};
  assert.equal(foregroundProjectOptions('/pulse/api/project',{},true).headers['X-Pulse-Active'],'1');
  assert.equal(foregroundProjectOptions('/pulse/api/studio',{},true).headers['X-Pulse-Active'],'1');
  assert.deepEqual(foregroundProjectOptions('/pulse/api/project',settings,false).headers,{'X-Other':'unchanged'});
  assert.equal(settings.headers['X-Pulse-Active'],'1','callers header object is not mutated');
  for(const path of ['/pulse/api/live','/pulse/api/events','/pulse/api/device-notifications','/api/client-projects'])assert.equal(foregroundProjectOptions(path,{},true).headers,undefined);
  assert.equal(foregroundProjectOptions('/pulse/api/studio',{body:{action:'save_preferences'}},true).headers,undefined);
});
test('a lost registration response preserves the subscribed browser endpoint for server reconciliation',()=>{
  for(const error of [new DeviceTimeout('late response'),{status:0},{status:408},{status:500},{name:'AbortError'}])assert.equal(rejectedDeviceRegistration(error),false);
  for(const status of [400,401,403,404,409])assert.equal(rejectedDeviceRegistration({status}),true);
});
