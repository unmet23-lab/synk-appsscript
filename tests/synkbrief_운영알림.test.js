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
    jobs: ['synkbrief-refresh', 'synkbrief-retention'].map(jobname => ({jobname, active: true, last_run_at: new Date().toISOString(), health: 'ok', http_status: 200})), queue:queueSnapshot() };
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
const QUEUE_ISSUES = ['stalled_ready','stalled_retries','stale_leases','expiry_overdue','recent_errors','cron_missing','cron_disabled','cron_duplicate','cron_failed','cron_stale'];
function queueSnapshot(issues = {}, keyConfigured = true) {
  const issue_counts = Object.fromEntries(QUEUE_ISSUES.map(code => [code, issues[code] || 0]));
  return {queued:0,processing:0,done:0,expired:0,cancelled:0,error:0,ready:0,expired_leases:0,expiry_due:0,
    rate_limited:0,eligible_ready:0,oldest_queued_at:null,oldest_pending_at:null,
    healthy:keyConfigured && Object.values(issue_counts).every(count=>count===0),key_configured:keyConfigured,issue_counts};
}

test('정상 큐와 한도 대기는 해시를 바꾸거나 메일을 보내지 않는다',()=>{
  const f=fixture();assert.equal(f.run().state,'baseline');const before=f.values.get('SYNKBRIEF_OPS_NOTICE');
  f.payload.queue=queueSnapshot();f.payload.queue.queued=1200;f.payload.queue.rate_limited=1200;
  f.payload.queue.oldest_queued_at=new Date(Date.now()-3600000).toISOString();
  assert.equal(f.run().state,'unchanged');
  f.payload.queue.queued=2200;f.payload.queue.rate_limited=2200;f.payload.checked_at=new Date().toISOString();
  assert.equal(f.run().state,'unchanged');assert.equal(f.emails.length,0);assert.equal(f.values.get('SYNKBRIEF_OPS_NOTICE'),before);
});

test('발송 ON 계정의 토큰 소실은 다른 정상 계정이 있어도 경보가 된다',()=>{
  const f=fixture();f.payload.accounts[0].dm_enabled=true;f.payload.accounts[0].issue_codes=[];
  f.payload.accounts.push({username:'other',connected:true,health:'ok',dm_enabled:false,issue_codes:[]});
  f.run();f.payload.accounts[0].connected=false;
  f.payload.accounts[0].issue_codes=['token-missing'];f.payload.healthy=false;
  assert.equal(f.run().state,'sent');assert.match(f.emails.at(-1).body,/@yuhobuilds \| token-missing/);
  assert.equal(f.run().state,'unchanged');
  f.payload.accounts[0].connected=true;f.payload.accounts[0].issue_codes=[];f.payload.healthy=true;
  f.run();assert.equal(f.emails.length,2);assert.match(f.emails.at(-1).subject,/복구/);
});

test('캠페인 만료·비활성과 토큰 소실은 기존 발송 오류 중에도 각각 알린다',()=>{
  const f=fixture();breakAccount(f,'send-failed');f.payload.accounts[0].dm_enabled=true;
  f.payload.accounts[0].issue_codes=[];f.run();
  for(const code of ['campaign-expired','campaign-inactive','token-missing']){
    f.payload.accounts[0].issue_codes=[code];assert.equal(f.run().state,'sent');
    assert.match(f.emails.at(-1).body,new RegExp('@yuhobuilds \\| '+code));
    assert.match(f.emails.at(-1).body,/send-failed/);assert.equal(f.run().state,'unchanged');
  }
  assert.equal(f.emails.length,4);
});

test('의도적으로 꺼 둔 미연결 계정은 무경보이고 ON 연결 소실은 서버 전체 정상이어도 숨기지 않는다',()=>{
  const f=fixture();Object.assign(f.payload.accounts[1],{dm_enabled:false,issue_codes:[]});
  assert.equal(f.run().state,'baseline');assert.equal(f.emails.length,0);
  f.payload.accounts[1].dm_enabled=true;f.payload.accounts[1].health='ok';
  assert.equal(f.run().state,'sent');assert.match(f.emails[0].body,/@unconfigured \| token-missing/);
});

test('기한을 넘긴 미전달 큐는 알리되 건수 변화와 같은 장애는 재발송하지 않는다',()=>{
  const f=fixture();breakAccount(f,'send-failed');f.run();
  f.payload.queue.issue_counts.recent_expired=0;assert.equal(f.run().state,'unchanged');
  f.payload.queue.issue_counts.recent_expired=1;f.payload.queue.healthy=false;
  assert.equal(f.run().state,'sent');assert.match(f.emails.at(-1).body,/synkbrief-queue \| recent_expired/);
  f.payload.queue.issue_counts.recent_expired=25;assert.equal(f.run().state,'unchanged');
  f.payload.queue.issue_counts.recent_expired=0;f.payload.queue.healthy=true;
  assert.equal(f.run().state,'sent');assert.doesNotMatch(f.emails.at(-1).body,/recent_expired/);
  assert.equal(f.emails.length,3);
});

test('확장 계정·만료 경보 계약의 손상과 비밀 원문은 고정 형식 오류로만 알린다',()=>{
  const changes=[f=>{f.payload.accounts[0].dm_enabled='SECRET';},
    f=>{f.payload.accounts[0].issue_codes=['SECRET '+KEY];},
    f=>{f.payload.accounts[0].issue_codes='token-missing';},
    f=>{Object.assign(f.payload.accounts[0],{dm_enabled:true,issue_codes:['token-missing','token-missing']});},
    f=>{Object.assign(f.payload.accounts[0],{dm_enabled:false,issue_codes:['campaign-inactive']});},
    f=>{f.payload.queue.issue_counts.recent_expired='SECRET';},
    f=>{f.payload.queue.issue_counts.recent_expired=-1;},
    f=>{f.payload.queue.issue_counts.recent_expired=1;},
  ];
  for(const change of changes){const f=fixture();change(f);f.run();
    assert.match(f.emails[0].body,/ops-status \| invalid_response/);
    assert.doesNotMatch(JSON.stringify(f.emails)+JSON.stringify([...f.values]),/SECRET/);
  }
});

test('고정 운영 서버의 큐 필드 누락은 기존 계정 오류 중에도 별도 경보가 된다',()=>{
  for(const existingFailure of [false,true]){
    const f=fixture();if(existingFailure)breakAccount(f,'send-failed');f.run();const before=f.emails.length;
    delete f.payload.queue;assert.equal(f.run().state,'sent');assert.equal(f.emails.length,before+1);
    assert.equal(JSON.parse(f.values.get('SYNKBRIEF_OPS_NOTICE')).healthy,false);assert.match(f.emails.at(-1).body,/synkbrief-queue \| missing/);
    assert.equal(f.run().state,'unchanged');assert.equal(f.emails.length,before+1);
  }
});

test('기존 계정 장애 중 새 큐 장애·오류 종류 전환·부분 복구를 알리고 건수 변화는 알리지 않는다',()=>{
  const f=fixture();breakAccount(f,'send-failed');f.payload.queue=queueSnapshot();f.run();assert.equal(f.emails.length,1);
  f.payload.queue=queueSnapshot({stalled_ready:1});assert.equal(f.run().state,'sent');assert.equal(f.emails.length,2);
  assert.match(f.emails[1].body,/synkbrief-queue \| stalled_ready/);assert.match(f.emails[1].body,/@yuhobuilds \| send-failed/);
  f.payload.queue.issue_counts.stalled_ready=990;f.payload.queue.queued=1000;assert.equal(f.run().state,'unchanged');assert.equal(f.emails.length,2);
  f.payload.queue=queueSnapshot({cron_disabled:1});f.run();assert.equal(f.emails.length,3);assert.match(f.emails[2].body,/cron_disabled/);
  f.payload.queue=queueSnapshot();f.run();assert.equal(f.emails.length,4);assert.equal(f.emails[3].subject,'[SYNK DM] 운영 이상');assert.doesNotMatch(f.emails[3].body,/synkbrief-queue/);
  f.payload=snapshot();f.payload.queue=queueSnapshot();f.run();assert.equal(f.emails.length,5);assert.match(f.emails[4].subject,/복구/);
});

test('모든 알려진 큐 오류와 키 누락을 고정 코드로만 알리며 임의 원문과 필드를 노출하지 않는다',()=>{
  for(const code of QUEUE_ISSUES){
    const f=fixture();f.payload.queue=queueSnapshot({[code]:1});f.payload.healthy=false;
    f.payload.queue.recipient='PRIVATE RECIPIENT';f.payload.queue.error_message='SECRET '+KEY;f.payload.queue.ciphertext='PRIVATE CIPHER';
    f.run();f.run();assert.equal(f.emails.length,1);assert.match(f.emails[0].body,new RegExp('synkbrief-queue \\| '+code));
    assert.doesNotMatch(JSON.stringify(f.emails)+JSON.stringify([...f.values]),/PRIVATE|SECRET/);
  }
  const f=fixture();breakAccount(f,'send-failed');f.payload.queue=queueSnapshot();f.run();
  f.payload.queue=queueSnapshot({},false);f.run();assert.equal(f.emails.length,2);assert.match(f.emails[1].body,/synkbrief-queue \| key_missing/);
  f.run();assert.equal(f.emails.length,2);
});

test('제공된 큐가 손상되거나 상태가 모순되면 형식 오류로 처리하고 읽기 키 저장도 거절한다',()=>{
  const changes=[f=>{f.payload.queue=null;},f=>{f.payload.queue=[];},f=>{f.payload.queue.healthy='false';},
    f=>{f.payload.queue.key_configured='SECRET';},f=>{delete f.payload.queue.key_configured;},
    f=>{f.payload.queue.issue_counts=[];},f=>{delete f.payload.queue.issue_counts.cron_stale;},
    f=>{f.payload.queue.issue_counts.stalled_ready='SECRET';},f=>{f.payload.queue.issue_counts.stalled_ready=-1;},
    f=>{f.payload.queue.issue_counts.stalled_ready=1.5;},f=>{f.payload.queue.issue_counts.stalled_ready=Number.MAX_SAFE_INTEGER+1;},
    f=>{f.payload.queue.issue_counts['SECRET '+KEY]=1;},f=>{delete f.payload.queue.issue_counts.cron_stale;f.payload.queue.issue_counts.SECRET=0;},
    f=>{f.payload.queue.issue_counts.stalled_ready=1;},f=>{f.payload.queue.healthy=false;}];
  for(const change of changes){const f=fixture();f.payload.queue=queueSnapshot();change(f);const before=f.values.get('SYNKBRIEF_OPS_READ_KEY');
    assert.equal(f.run().healthy,false);assert.match(f.emails[0].body,/ops-status \| invalid_response/);assert.doesNotMatch(JSON.stringify(f.emails),/SECRET|test-only/);
    assert.throws(()=>f.context.synkbrief운영알림키저장('a'.repeat(64)),/연결하지 못했습니다/);assert.equal(f.values.get('SYNKBRIEF_OPS_READ_KEY'),before);
  }
});

test('큐 장애 알림 전달 미확인 뒤 건수만 늘어도 자동 재발송하지 않는다',()=>{
  const f=fixture();f.payload.healthy=false;f.payload.queue=queueSnapshot({cron_failed:1});f.mailError=true;
  assert.throws(()=>f.run(),/전달 여부/);f.payload.queue.issue_counts.cron_failed=20;
  assert.equal(f.run().state,'delivery_unknown');assert.equal(f.emails.length,1);
});

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
  const f=fixture();f.payload.healthy=false;f.payload.accounts[0].health='SECRET token '+KEY;f.payload.raw='PRIVATE COMMENT';
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

test('읽기 키 연결은 관리자와 정확한 64자 base64url 및 잠금을 확인한 뒤에만 조회한다',()=>{
  const incoming='a'.repeat(64);
  for(const configure of [f=>{f.context.Session.getActiveUser=()=>({getEmail:()=>''});},f=>{f.context.Session.getEffectiveUser=()=>({getEmail:()=> 'another@example.test'});},f=>{f.lock=false;}]){
    const f=fixture(),before=[...f.values];configure(f);assert.throws(()=>f.context.synkbrief운영알림키저장(incoming),/연결하지 못했습니다/);
    assert.equal(f.calls.length,0);assert.deepEqual([...f.values],before);
  }
  for(const value of [undefined,null,64,'a'.repeat(63),'a'.repeat(65),'a'.repeat(63)+'=','a'.repeat(63)+'.',' '+incoming]){
    const f=fixture();assert.throws(()=>f.context.synkbrief운영알림키저장(value),/연결하지 못했습니다/);assert.equal(f.calls.length,0);assert.equal(f.values.get('SYNKBRIEF_OPS_READ_KEY'),KEY);
  }
});
test('읽기 키 연결의 HTTP·통신·형식 실패는 이전 키와 다른 속성을 보존하며 원인을 노출하지 않는다',()=>{
  const incoming='b'.repeat(64);
  for(const configure of [f=>{f.http=401;},f=>{f.http=302;},f=>{f.http=503;},f=>{f.fetchError=true;},f=>{f.raw='SECRET response';},f=>{f.payload.ok=false;},f=>{f.payload.jobs[0].active='true';},f=>{f.payload.accounts[0].http_status='SECRET';},f=>{f.payload.accounts[0].last_failure_at='SECRET';},f=>{delete f.payload.accounts[1].username;},f=>{f.payload.checked_at=[new Date().toISOString()];},f=>{f.payload.checked_at=new Date(Date.now()-700000).toISOString();}]){
    const f=fixture(),before=[...f.values];configure(f);
    assert.throws(()=>f.context.synkbrief운영알림키저장(incoming),error=>{assert.doesNotMatch(error.message,/SECRET|bbbb|401|503/);return /연결하지 못했습니다/.test(error.message);});
    assert.deepEqual([...f.values],before);assert.equal(f.emails.length,0);assert.equal(f.triggers.length,0);assert.equal(f.quotaChecks,undefined);assert.equal(f.released,true);
  }
});
test('인증된 정상 응답이면 장애 상태에서도 키 하나만 저장하고 비밀값·메일·타이머를 반환하거나 실행하지 않는다',()=>{
  const incoming='C_d-'.repeat(16);
  for(const enabled of ['0',undefined]){
    const f=fixture();if(enabled===undefined)f.values.delete('SYNKBRIEF_OPS_MONITOR_ENABLED');else f.values.set('SYNKBRIEF_OPS_MONITOR_ENABLED',enabled);
    f.values.set('unrelated','preserve');const before=new Map(f.values);breakAccount(f,'send-failed');
    const result=f.context.synkbrief운영알림키저장(incoming);assert.deepEqual(JSON.parse(JSON.stringify(result)),{ok:true,configured:true});assert.doesNotMatch(JSON.stringify(result),/C_d-|Bearer/);
    before.set('SYNKBRIEF_OPS_READ_KEY',incoming);assert.deepEqual([...f.values],[...before]);
    assert.equal(f.calls.length,1);assert.equal(f.calls[0].options.headers.Authorization,'Bearer '+incoming);assert.equal(f.calls[0].options.followRedirects,false);
    assert.equal(f.emails.length,0);assert.equal(f.triggers.length,0);assert.equal(f.deleted.length,0);assert.equal(f.quotaChecks,undefined);
  }
});
test('관리 시트 메뉴의 비밀번호 모달은 저장된 키를 읽거나 서버 조회 없이 열며 익명 호출은 차단한다',()=>{
  const f=fixture(),items=[];let html,shown=0;const output={setWidth(){return this;},setHeight(){return this;}};
  const menu={addItem:(label,handler)=>{items.push({label,handler});return menu;},addSeparator:()=>menu,addToUi(){}};
  f.context.HtmlService={createHtmlOutput:value=>{html=value;return output;}};
  f.context.SpreadsheetApp={getUi:()=>({createMenu:()=>menu,showModalDialog:()=>{shown++;}})};
  f.context.synkbrief관리메뉴();assert.ok(items.some(x=>x.handler==='synkbrief운영알림연결창'));
  f.context.synkbrief운영알림연결창();assert.equal(shown,1);assert.match(html,/type="password"/);assert.match(html,/synkbrief운영알림키저장\(value\)/);assert.doesNotMatch(html,new RegExp(KEY));
  assert.equal(f.calls.length,0);assert.equal(f.emails.length,0);assert.equal(f.triggers.length,0);
  f.context.Session.getActiveUser=()=>({getEmail:()=>''});assert.throws(()=>f.context.synkbrief운영알림연결창(),/관리자/);assert.equal(shown,1);
});

function observeStatus(f) {
  const logs=[];f.context.console={log:value=>logs.push(value)};
  const value=JSON.parse(JSON.stringify(f.context.synkbrief운영알림상태()));
  assert.equal(logs.length,1);assert.deepEqual(JSON.parse(logs[0]),value);
  return {value,log:logs[0]};
}

test('운영 상태 조회는 승인된 상태만 출력하고 HTTP·메일·속성·트리거를 바꾸지 않는다',()=>{
  const f=fixture(),at='2026-10-08T01:02:03.000Z';
  f.values.set('SYNKBRIEF_OPS_MAIL_TEST',JSON.stringify({delivery:'sent',at}));
  f.values.set('SYNKBRIEF_OPS_NOTICE',JSON.stringify({delivery:'baseline',healthy:true,at,hash:'PRIVATE_HASH'}));
  f.values.set('SYNKBRIEF_OPS_LAST_CHECK',JSON.stringify({healthy:false,at}));
  f.triggers=[trigger('synkbrief정기점검','CLOCK'),trigger('other','CLOCK'),trigger('synkbrief정기점검','EDIT')];
  const before=[...f.values],timers=[...f.triggers];
  const allowed=new Set(['SYNKBRIEF_OPS_MAIL_TEST','SYNKBRIEF_OPS_NOTICE','SYNKBRIEF_OPS_LAST_CHECK','SYNKBRIEF_OPS_READ_KEY','SYNKBRIEF_OPS_MONITOR_ENABLED']);
  const forbidden=()=>{throw Error('unexpected mutation');};
  f.context.PropertiesService.getScriptProperties=()=>({getProperty:key=>{assert.ok(allowed.has(key));return f.values.get(key);},setProperty:forbidden,deleteProperty:forbidden,getProperties:forbidden});
  f.context.ScriptApp.newTrigger=forbidden;f.context.ScriptApp.deleteTrigger=forbidden;
  const {value,log}=observeStatus(f);
  assert.deepEqual(value,{enabled:true,keyConfigured:true,mailTest:{state:'sent',at},notice:{delivery:'baseline',healthy:true,at},lastCheck:{at,healthy:false},currentMailQuota:100,timers:{ownerScope:'current_user',handler:'synkbrief정기점검',count:1}});
  assert.deepEqual([...f.values],before);assert.deepEqual(f.triggers,timers);
  assert.equal(f.calls.length,0);assert.equal(f.emails.length,0);assert.equal(f.deleted.length,0);assert.equal(f.quotaChecks,1);assert.equal(f.released,undefined);
  assert.doesNotMatch(log,/PRIVATE_HASH|old-meta-token|test-only|Bearer|owner@example/);
});

test('운영 상태 조회는 관리자 확인 전에 속성·quota·트리거·로그에 접근하지 않는다',()=>{
  for(const configure of [f=>{f.context.Session.getActiveUser=()=>({getEmail:()=>''});},f=>{f.context.Session.getEffectiveUser=()=>({getEmail:()=> 'other@example.test'});},f=>{f.context.Session.getActiveUser=()=>{throw Error('PRIVATE '+KEY);};}]){
    const f=fixture();configure(f);let touched=0;
    const forbidden=()=>{touched++;throw Error('PRIVATE');};
    f.context.PropertiesService.getScriptProperties=forbidden;f.context.MailApp.getRemainingDailyQuota=forbidden;f.context.ScriptApp.getProjectTriggers=forbidden;f.context.console={log:forbidden};
    assert.throws(()=>f.context.synkbrief운영알림상태(),error=>{assert.doesNotMatch(error.message,/PRIVATE|test-only/);return /관리자/.test(error.message);});assert.equal(touched,0);assert.equal(f.calls.length,0);assert.equal(f.emails.length,0);
  }
});

test('운영 상태 조회는 손상된 속성·임의 필드·날짜·문자열 boolean의 원문을 노출하지 않는다',()=>{
  const samples=['PRIVATE '+KEY,'null','[]','123',JSON.stringify({delivery:'PRIVATE '+KEY,at:'PRIVATE',healthy:'PRIVATE',hash:KEY,error:'PRIVATE',recipient:'private@example.test'}),JSON.stringify({delivery:['sent'],at:['2026-10-08T01:02:03.000Z'],healthy:'true'}),'x'.repeat(4097)];
  for(const raw of samples){const f=fixture();for(const name of ['SYNKBRIEF_OPS_MAIL_TEST','SYNKBRIEF_OPS_NOTICE','SYNKBRIEF_OPS_LAST_CHECK'])f.values.set(name,raw);const {value,log}=observeStatus(f);
    assert.deepEqual(value.mailTest,{state:'invalid',at:null});assert.deepEqual(value.notice,{delivery:'invalid',healthy:null,at:null});assert.deepEqual(value.lastCheck,{at:null,healthy:null});
    assert.doesNotMatch(log,/PRIVATE|test-only|private@example|Bearer/);assert.equal(f.calls.length,0);assert.equal(f.emails.length,0);
  }
  for(const at of ['2026-02-30T01:02:03.000Z','2026-10-08','2026-10-08T01:02:03.000Z PRIVATE']){const f=fixture();f.values.set('SYNKBRIEF_OPS_MAIL_TEST',JSON.stringify({delivery:'sent',at}));assert.equal(observeStatus(f).value.mailTest.at,null);}
});

test('운영 상태 조회는 기록 없음·pending·sent·unknown과 현재 quota 0을 구분한다',()=>{
  const f=fixture();f.quota=0;f.values.set('SYNKBRIEF_OPS_MONITOR_ENABLED','true');f.values.delete('SYNKBRIEF_OPS_READ_KEY');
  let value=observeStatus(f).value;assert.equal(value.enabled,false);assert.equal(value.keyConfigured,false);assert.deepEqual(value.mailTest,{state:'not_recorded',at:null});assert.equal(value.currentMailQuota,0);assert.equal(value.timers.count,0);
  const at='2026-10-08T01:02:03.000Z';
  for(const state of ['pending','sent','unknown']){f.values.set('SYNKBRIEF_OPS_MAIL_TEST',JSON.stringify({delivery:state,at}));value=observeStatus(f).value;assert.deepEqual(value.mailTest,{state,at});}
  assert.equal(f.emails.length,0);assert.equal(f.calls.length,0);
});

test('운영 상태 조회 실패는 quota·트리거를 0으로 오인하거나 서비스 예외 원문을 노출하지 않는다',()=>{
  for(const quota of [-1,NaN,Infinity,'100']){const f=fixture();f.quota=quota;assert.equal(observeStatus(f).value.currentMailQuota,null);}
  const f=fixture();f.context.MailApp.getRemainingDailyQuota=()=>{throw Error('PRIVATE '+KEY);};f.context.ScriptApp.getProjectTriggers=()=>{throw Error('PRIVATE '+KEY);};
  const {value,log}=observeStatus(f);assert.equal(value.currentMailQuota,null);assert.equal(value.timers.count,null);assert.doesNotMatch(log,/PRIVATE|test-only/);
  f.context.PropertiesService.getScriptProperties=()=>{throw Error('PRIVATE '+KEY);};
  assert.throws(()=>f.context.synkbrief운영알림상태(),error=>{assert.doesNotMatch(error.message,/PRIVATE|test-only/);return /상태를 읽지 못했습니다/.test(error.message);});
});
