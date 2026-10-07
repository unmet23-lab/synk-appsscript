const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const source = fs.readFileSync(require('node:path').join(__dirname, '../엔진_synkbrief.js'), 'utf8');
const KEY = 'test-only-ops-read-key-abcdefghijklmnopqrstuvwxyz';
function snapshot() {
  return { ok: true, healthy: true, checked_at: new Date().toISOString(),
    accounts: [{ username: 'yuhobuilds', connected: true, health: 'ok', token_expires_at: new Date(Date.now()+30*86400000).toISOString(), last_failure_at: null, http_status: null },
      { username: 'unconfigured', connected: false, health: 'missing' }],
    jobs: ['synkbrief-refresh', 'synkbrief-retention'].map(jobname => ({jobname, active: true, last_run_at: new Date().toISOString(), health: 'ok', http_status: 200})) };
}
function fixture() {
  const values = new Map(Object.entries({SYNKBRIEF_OPS_MONITOR_ENABLED: '1', SYNKBRIEF_OPS_READ_KEY: KEY, SYNKBRIEF_IG_TOKEN: 'old-meta-token-remains'}));
  const calls = [], emails = [], deleted = [];
  const f = { values, calls, emails, deleted, payload: snapshot(), http: 200, quota: 100, triggers: [], lock: true };
  const context = vm.createContext({ Date, console,
    PropertiesService: { getScriptProperties: () => ({getProperty:k=>values.get(k),setProperty:(k,v)=>values.set(k,v)}) },
    Session: {getActiveUser:()=>({getEmail:()=> 'owner@example.test'}),getEffectiveUser:()=>({getEmail:()=> 'owner@example.test'})},
    LockService: {getScriptLock:()=>({tryLock:()=>f.lock,releaseLock:()=>{f.released=true;}})},
    Utilities: {DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,value)=>Array.from(crypto.createHash('sha256').update(value).digest())},
    UrlFetchApp: {fetch:(url, options)=>{calls.push({url, options});if(f.fetchError)throw Error('SECRET fetch error '+KEY);return {getResponseCode:()=>f.http,getContentText:()=>f.raw === undefined ? JSON.stringify(f.payload) : f.raw};}},
    MailApp: {getRemainingDailyQuota:()=>{f.quotaChecks=(f.quotaChecks||0)+1;if(f.quotaError)throw Error('quota error');return f.quota;},sendEmail:email=>{emails.push(email);if(f.mailError)throw Error('SECRET mail error');}},
    ScriptApp: {EventType:{CLOCK:'CLOCK'},getProjectTriggers:()=>f.triggers,deleteTrigger:t=>{deleted.push(t);f.triggers=f.triggers.filter(x=>x!==t);},
      newTrigger:handler=>({timeBased:()=>({everyMinutes:minutes=>({create:()=>{if(f.createError)throw Error('create failed');const t=trigger(handler,'CLOCK');t.minutes=minutes;f.triggers.push(t);return t;}})})})}
  });
  vm.runInContext(source,context); f.context=context; f.run=()=>context.synkbrief정기점검(); return f;
}
function trigger(handler, type) { return {getHandlerFunction:()=>handler,getEventType:()=>type}; }
function breakAccount(f, health='auth-needed') { f.payload.healthy=false; f.payload.accounts[0].health=health; f.payload.accounts[0].http_status=401; }

test('정상 최초와 반복 점검은 메일 0통이며 읽기 키만 고정 URL로 보낸다',()=>{
  const f=fixture(); assert.equal(f.run().state,'baseline');f.payload.checked_at=new Date().toISOString();assert.equal(f.run().state,'unchanged');
  assert.equal(f.emails.length,0);assert.equal(f.quotaChecks,undefined);
  assert.equal(f.calls[0].url,'https://qiwxeddwwnzkwalpsuty.supabase.co/functions/v1/synkbrief-dm?task=ops-status');
  assert.equal(f.calls[0].options.headers.Authorization,'Bearer '+KEY);assert.equal(f.calls[0].options.followRedirects,false);
  assert.equal(f.values.get('SYNKBRIEF_IG_TOKEN'),'old-meta-token-remains');assert.equal(f.payload.accounts[1].connected,false);
});
test('신규 장애와 다른 장애 및 복구만 각각 1통, 시각과 순서 변화에는 0통',()=>{
  const f=fixture();f.run();breakAccount(f);assert.equal(f.run().state,'sent');
  f.payload.accounts.reverse();f.payload.jobs.reverse();f.payload.accounts.find(a=>a.connected).last_failure_at=new Date(Date.now()+100).toISOString();
  assert.equal(f.run().state,'unchanged');assert.equal(f.emails.length,1);
  f.payload.accounts.find(a=>a.connected).health='refresh-failed';f.run();assert.equal(f.emails.length,2);
  f.payload=snapshot();f.run();f.run();assert.equal(f.emails.length,3);assert.match(f.emails[2].subject,/복구/);
  assert.ok(f.emails.every(m=>m.to==='unmet23@gmail.com'));assert.doesNotMatch(f.values.get('SYNKBRIEF_OPS_NOTICE')+JSON.stringify(f.emails),/old-meta-token|SECRET|test-only-ops/);
});
test('최초부터 장애여도 알리고 HTTP 실패와 연결 예외를 같은 장애 반복 없이 알린다',()=>{
  const f=fixture();f.http=503;f.raw='SECRET token='+KEY;f.run();f.run();assert.equal(f.emails.length,1);assert.match(f.emails[0].body,/http_error.*503/);
  f.fetchError=true;f.run();f.run();assert.equal(f.emails.length,2);assert.match(f.emails[1].body,/fetch_failed/);
  assert.doesNotMatch(JSON.stringify(f.emails)+f.values.get('SYNKBRIEF_OPS_NOTICE'),/SECRET|test-only/);
});
test('할당량 부족은 발송·해시 소비 없이 다음 점검에서 재시도한다',()=>{
  const f=fixture();breakAccount(f);f.quota=0;assert.equal(f.run().state,'quota_exhausted');assert.equal(f.emails.length,0);assert.equal(f.values.has('SYNKBRIEF_OPS_NOTICE'),false);
  f.quota=1;assert.equal(f.run().state,'sent');f.run();assert.equal(f.emails.length,1);
});
test('메일 전달 예외는 원문을 숨기고 같은 상태를 자동 재발송하지 않는다',()=>{
  const f=fixture();breakAccount(f);f.mailError=true;assert.throws(()=>f.run(),/전달 여부/);assert.equal(f.released,true);
  assert.equal(f.run().state,'delivery_unknown');assert.equal(f.emails.length,1);assert.equal(JSON.parse(f.values.get('SYNKBRIEF_OPS_NOTICE')).delivery,'unknown');
  assert.doesNotMatch(f.values.get('SYNKBRIEF_OPS_NOTICE'),/SECRET/);
});
test('키 누락과 잠금 및 미설치는 토큰이나 불필요한 네트워크에 접근하지 않는다',()=>{
  const f=fixture();f.values.set('SYNKBRIEF_OPS_READ_KEY','');f.run();assert.equal(f.calls.length,0);assert.match(f.emails[0].body,/read_key_missing/);
  f.lock=false;assert.equal(f.run().state,'busy');assert.equal(f.emails.length,1);
  f.values.set('SYNKBRIEF_OPS_MONITOR_ENABLED','0');assert.equal(f.run().state,'disabled');
});
test('서버 200이어도 손상·오래된 응답·누락/꺼진 잡·계정 없음은 장애다',()=>{
  const variants=[f=>{f.raw='oops SECRET';},f=>{f.payload.checked_at=new Date(Date.now()-700000).toISOString();},f=>{f.payload.jobs=[];},f=>{f.payload.jobs[0].active=false;},f=>{f.payload.accounts=[];},f=>{f.payload.jobs.push(f.payload.jobs[0]);},f=>{f.payload.accounts[0].username='SECRET\nprivate';}];
  for(const mutate of variants){const f=fixture();mutate(f);assert.equal(f.run().healthy,false);assert.equal(f.emails.length,1);assert.doesNotMatch(f.emails[0].body,/SECRET/);}
});
test('원문과 임의 health를 메일·속성으로 복사하지 않는다',()=>{
  const f=fixture();f.payload.healthy=false;f.payload.accounts[0].health='SECRET token '+KEY;f.payload.accounts[0].last_failure_at='SECRET';f.payload.accounts[0].http_status='SECRET';f.payload.raw='PRIVATE COMMENT';
  f.run();assert.match(f.emails[0].body,/@yuhobuilds \| unknown/);assert.doesNotMatch(JSON.stringify(f.emails)+f.values.get('SYNKBRIEF_OPS_NOTICE'),/SECRET|PRIVATE|test-only/);
});
test('서버가 정의한 인증·갱신·수신거부 신원·발송 장애 코드를 그대로 구분한다',()=>{
  const f=fixture();
  for(const health of ['auth-needed','auth-failed','refresh-failed','stop-identity-needed','send-failed']){breakAccount(f,health);f.run();assert.match(f.emails.at(-1).body,new RegExp(health));f.run();}
  assert.equal(f.emails.length,5);
});
test('설정은 같은 handler의 시간 트리거만 15분 한 개로 바꾸며 재실행 가능하다',()=>{
  const f=fixture();f.values.delete('SYNKBRIEF_OPS_MONITOR_ENABLED');const unrelated=trigger('other','CLOCK'),otherEvent=trigger('synkbrief정기점검','EDIT');
  f.triggers=[trigger('synkbrief정기점검','CLOCK'),unrelated,otherEvent];const result=f.context.synkbrief운영알림설정();
  assert.equal(result.emailSent,false);assert.equal(f.deleted.length,1);assert.equal(f.triggers.length,3);assert.ok(f.triggers.includes(unrelated));assert.ok(f.triggers.includes(otherEvent));
  f.context.synkbrief운영알림설정();assert.equal(f.triggers.filter(t=>t.getHandlerFunction()==='synkbrief정기점검'&&t.getEventType()==='CLOCK').length,1);
  assert.equal(f.triggers.find(t=>t.minutes).minutes,15);assert.equal(f.emails.length,0);assert.equal(f.calls.length,0);assert.equal(f.values.get('SYNKBRIEF_OPS_MONITOR_ENABLED'),'1');
});
test('설정은 로그인·키·메일 권한 확인 실패 또는 트리거 생성 실패 때 기존 트리거를 지우지 않는다',()=>{
  for(const mutate of [f=>{f.context.Session.getActiveUser=()=>({getEmail:()=>''});},f=>{f.values.delete('SYNKBRIEF_OPS_READ_KEY');},f=>{f.quotaError=true;},f=>{f.createError=true;}]){
    const f=fixture();f.values.delete('SYNKBRIEF_OPS_MONITOR_ENABLED');f.triggers=[trigger('synkbrief정기점검','CLOCK')];mutate(f);assert.throws(()=>f.context.synkbrief운영알림설정());assert.equal(f.deleted.length,0);assert.equal(f.values.has('SYNKBRIEF_OPS_MONITOR_ENABLED'),false);assert.equal(f.emails.length,0);
  }
});
test('연결 시험은 고정 메일 1통만 보내며 운영 장애라고 표시하거나 상태 해시를 바꾸지 않는다',()=>{
  const f=fixture();f.run();const before=f.values.get('SYNKBRIEF_OPS_NOTICE');
  assert.equal(f.context.synkbrief운영알림시험().state,'sent');assert.equal(f.context.synkbrief운영알림시험().state,'already_sent');
  assert.equal(f.emails.length,1);assert.equal(f.emails[0].to,'unmet23@gmail.com');assert.equal(f.emails[0].subject,'[SYNK DM] 알림 연결 시험');assert.match(f.emails[0].body,/장애가 발생했다는 알림이 아닙니다/);
  assert.equal(JSON.parse(f.values.get('SYNKBRIEF_OPS_MAIL_TEST')).delivery,'sent');assert.equal(f.values.get('SYNKBRIEF_OPS_NOTICE'),before);
});
test('연결 시험은 관리자·잠금·quota를 확인하고 전달 미확인 시에도 다시 보내지 않는다',()=>{
  const f=fixture();f.context.Session.getActiveUser=()=>({getEmail:()=>''});assert.throws(()=>f.context.synkbrief운영알림시험(),/관리자/);assert.equal(f.emails.length,0);
  f.context.Session.getActiveUser=()=>({getEmail:()=> 'owner@example.test'});f.lock=false;assert.throws(()=>f.context.synkbrief운영알림시험(),/실행 중/);f.lock=true;f.quota=0;
  assert.equal(f.context.synkbrief운영알림시험().state,'quota_exhausted');assert.equal(f.values.has('SYNKBRIEF_OPS_MAIL_TEST'),false);
  f.quota=1;f.mailError=true;assert.throws(()=>f.context.synkbrief운영알림시험(),/전달 여부/);assert.equal(JSON.parse(f.values.get('SYNKBRIEF_OPS_MAIL_TEST')).delivery,'unknown');
  assert.equal(f.context.synkbrief운영알림시험().state,'delivery_unknown');assert.equal(f.emails.length,1);assert.equal(f.released,true);
});
