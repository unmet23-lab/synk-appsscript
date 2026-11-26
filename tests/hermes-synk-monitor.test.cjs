'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {plan,collect,kst,clean,awakeSince,attentionNotification,digestId,POLICY,STALE_LOCK_MS}=require('../tools/hermes-synk/monitor.cjs');
const event=(fingerprint='a',extra={})=>({id:'task:one',kind:'task',severity:'info',needs_attention:false,title:'작업 응답',detail:'검증 대기',fingerprint,...extra});
const at=x=>new Date(x);
const {tipStatusEvents}=require('../tools/hermes-synk/overview.cjs');

test('tip worker separates ongoing failure from notification ownership and recognizes new failures',()=>{
  const worker=(state,extra={})=>({available:true,observedState:state,stale:false,cooldownActive:false,route:null,...extra});
  const overview=value=>({events:tipStatusEvents(value)});
  const clock=at('2026-10-18T07:00:00Z');
  let cursor=plan(null,overview(worker('성공')),clock);
  for(const state of ['한도쉼','할일없음','키없음']) {
    cursor=plan(cursor.state,overview(worker(state,{cooldownActive:state==='한도쉼'})),clock);
    assert.equal(cursor.notifications.length,0);
  }
  cursor=plan(cursor.state,overview(worker('실패',{directNotificationAttempted:true})),clock);
  assert.equal(cursor.notifications.length,0,'existing direct notification owns the failure');
  const directIncident=cursor.state.attentionIncidents['tip-worker'].id;
  cursor=plan(cursor.state,overview(worker('실패',{directNotificationAttempted:false})),clock);
  assert.equal(cursor.notifications.length,0,'a direct attempt is not a recovery before the next round');
  assert.equal(cursor.state.attentionIncidents['tip-worker'].id,directIncident);
  const unnotified={directNotificationAttempted:false,failureKind:'preflight_exception'};
  cursor=plan(cursor.state,overview(worker('실패',unnotified)),clock);
  assert.equal(cursor.notifications.length,1);
  cursor=plan(cursor.state,overview(worker('실패',{...unnotified,checkedAt:'2026-10-18T08:00:00Z'})),clock);
  assert.equal(cursor.notifications.length,0);
  cursor=plan(cursor.state,overview({available:false,coverage:'읽기 실패'}),clock);
  assert.ok(cursor.state.attentionIncidents['tip-worker'],'an unreadable receipt is not resolution');
  cursor=plan(cursor.state,overview(worker('실패',unnotified)),clock);
  assert.equal(cursor.notifications.length,0);
  cursor=plan(cursor.state,overview(worker('성공')),clock);
  cursor=plan(cursor.state,overview(worker('실패',unnotified)),clock);
  assert.equal(cursor.notifications.length,1,'a confirmed recovery permits a new incident');
});

test('login failure does not repeat when the producer alternates direct sends and suppressed rounds',()=>{
  const worker=(state,extra={})=>({available:true,observedState:state,stale:false,...extra});
  const overview=value=>({events:tipStatusEvents(value)});
  const clock=at('2026-11-10T00:00:00Z');
  let cursor=plan(null,overview(worker('성공')),clock);
  let incident;
  for(const directNotificationAttempted of [false,true,false,false,true,false]) {
    const value=worker('실패',{failureKind:'subscription_login',directNotificationAttempted});
    const row=overview(value).events[0];
    assert.equal(row.needs_attention,true,'an unresolved login is still a failure');
    assert.equal(row.notify,false,'the producer owns both direct and suppressed login notifications');
    cursor=plan(cursor.state,overview(value),clock);
    assert.equal(cursor.notifications.length,0);
    incident ||= cursor.state.attentionIncidents['tip-worker'].id;
    assert.equal(cursor.state.attentionIncidents['tip-worker'].id,incident);
  }
  cursor=plan(cursor.state,overview({available:false,coverage:'읽기 실패'}),clock);
  assert.equal(cursor.state.attentionIncidents['tip-worker'].id,incident);
  cursor=plan(cursor.state,overview(worker('실패',{failureKind:'postprocess_exception',directNotificationAttempted:false})),clock);
  assert.equal(cursor.notifications.length,1,'a different unnotified error remains visible');
  cursor=plan(cursor.state,overview(worker('성공')),clock);
  assert.equal(cursor.state.attentionIncidents['tip-worker'],undefined,'only a healthy receipt clears the failure');
});

test('tip inbox partial reads cannot resolve duplicates; exact reconciliation permits recurrence',()=>{
  const clock=at('2026-10-18T07:00:00Z');
  const receipt=status=>({id:'tip-'+'a'.repeat(24),status,stale:false,requiresCoverage:status==='pending'});
  const overview=(items,extra={})=>({events:tipStatusEvents(null,{available:true,complete:true,items,unreadable:0,limited:false,...extra})});
  let cursor=plan(null,overview([]),clock);
  cursor=plan(cursor.state,overview([receipt('ambiguous')]),clock);
  assert.equal(cursor.notifications.length,1);
  for(const report of [overview([receipt('pending')]),overview([],{complete:false,unreadable:1})]) {
    cursor=plan(cursor.state,report,clock);
    assert.equal(cursor.notifications.length,0);
    assert.ok(cursor.state.attentionIncidents['tip-intake-tip-'+'a'.repeat(24)]);
  }
  cursor=plan(cursor.state,overview([receipt('ambiguous')]),clock);
  assert.equal(cursor.notifications.length,0);
  cursor=plan(cursor.state,overview([receipt('reconciled')]),clock);
  assert.equal(cursor.notifications.length,0);
  cursor=plan(cursor.state,overview([receipt('ambiguous')]),clock);
  assert.equal(cursor.notifications.length,1);
});

test('tip receipt capacity is one stable incident and resolves only after a readable below-cap count',()=>{
  const clock=at('2026-10-18T07:00:00Z');
  const overview=(capReached,extra={})=>({events:tipStatusEvents(null,{available:true,complete:false,items:[],unreadable:0,limited:true,capReached,...extra})});
  let cursor=plan(null,overview(false),clock);
  cursor=plan(cursor.state,overview(true,{receiptCount:2000}),clock);
  assert.equal(cursor.notifications.length,1);
  assert.match(cursor.notifications[0].text,/새 접수 저장 한도 도달/);
  cursor=plan(cursor.state,overview(true,{receiptCount:2001,checkedAt:'2026-10-18T09:00:00Z'}),clock);
  assert.equal(cursor.notifications.length,0);
  cursor=plan(cursor.state,overview(null,{available:false}),clock);
  assert.equal(cursor.notifications.length,0);
  assert.ok(cursor.state.attentionIncidents['tip-intake-cap']);
  cursor=plan(cursor.state,overview(true),clock);
  assert.equal(cursor.notifications.length,0);
  cursor=plan(cursor.state,overview(false,{receiptCount:1999}),clock);
  assert.equal(cursor.notifications.length,0);
  assert.equal(cursor.state.attentionIncidents['tip-intake-cap'],undefined);
  cursor=plan(cursor.state,overview(true),clock);
  assert.equal(cursor.notifications.length,1);
});
test('first observation is a silent baseline; same content and changed clocks stay quiet',()=>{
  const a=plan(null,{events:[event()]},at('2026-10-18T07:00:00Z'));
  assert.equal(a.notifications.length,0);
  const b=plan(a.state,{events:[event()]},at('2026-10-18T07:05:00Z'));
  assert.equal(b.notifications.length,0);assert.deepEqual(b.state.pending,{});
});
test('urgent change is reported once and next identical poll is silent',()=>{
  const a=plan(null,{events:[event()]},at('2026-10-18T07:00:00Z'));
  const b=plan(a.state,{events:[event('b',{severity:'error',needs_attention:true})]},at('2026-10-18T07:05:00Z'));
  assert.equal(b.notifications.length,1);
  assert.equal(plan(b.state,{events:[event('b',{severity:'error',needs_attention:true})]},at('2026-10-18T07:10:00Z')).notifications.length,0);
});

test('ordinary research result changes are query-only and do not accumulate a digest',()=>{
  const a=plan(null,{events:[event('a',{kind:'research',severity:'info'})]},at('2026-10-18T07:00:00Z'));
  const b=plan(a.state,{events:[event('b',{kind:'research',severity:'info'})]},at('2026-10-18T07:05:00Z'));
  assert.equal(b.notifications.length,0);
  assert.equal(Object.keys(b.state.pending).length,0);
});

test('research error and warning changes alert once without repeating unchanged failures',()=>{
  for(const severity of ['error','warning']) {
    const baseline=event('a',{kind:'research',severity:'info'});
    const failed=event('b',{kind:'research',severity,needs_attention:true,title:'조사 서버 상태 확인 필요'});
    const a=plan(null,{events:[baseline]},at('2026-10-18T07:00:00Z'));
    const b=plan(a.state,{events:[failed]},at('2026-10-18T07:05:00Z'));
    assert.equal(b.notifications.length,1,severity);
    assert.equal(b.notifications[0].kind,'attention');
    assert.match(b.notifications[0].text,/조사 서버 상태 확인 필요/);
    assert.equal(plan(b.state,{events:[failed]},at('2026-10-18T07:10:00Z')).notifications.length,0,severity);
  }
});
test('9 KST and later days never send daily or successful change digests',()=>{
  const a=plan(null,{events:[event()]},at('2026-10-18T07:00:00Z'));
  const b=plan(a.state,{events:[event('b')]},at('2026-10-18T08:00:00Z'));
  assert.equal(b.notifications.length,0);
  const c=plan(b.state,{events:[event('b')]},at('2026-10-18T23:59:00Z'));
  assert.equal(c.notifications.length,0);
  const d=plan(c.state,{events:[event('b')]},at('2026-10-19T00:00:00Z'));
  assert.equal(d.notifications.length,0);
  assert.deepEqual(d.state.pending,{});
  assert.equal(plan(d.state,{events:[event('b')]},at('2026-10-20T00:00:00Z')).notifications.length,0);
});
test('partial reader failure does not turn missing task into completion or erase it',()=>{
  const a=plan(null,{events:[event()]},at('2026-10-18T07:00:00Z'));
  const b=plan(a.state,{events:[],coverage:{complete:false}},at('2026-10-18T07:05:00Z'));
  assert.deepEqual(b.state.observed['task:one'],a.state.observed['task:one']);assert.equal(b.notifications.length,0);
});
test('native delivered attention is query-only and never alerted a second time',()=>{
  const a=plan(null,{events:[event()]},at('2026-10-18T07:00:00Z'));
  const b=plan(a.state,{events:[event('b',{severity:'error',needs_attention:true,notify:false})]},at('2026-10-18T07:05:00Z'));
  assert.equal(b.notifications.length,0);assert.equal(Object.keys(b.state.pending).length,0);
});
test('state and outbox survive restart without inventing a second event',async()=>{
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'synk-monitor-test-'));
  let current=event();const reader=async()=>({events:[current],coverage:'fixture'});
  await collect({home,root:home,now:at('2026-10-18T07:00:00Z'),readOverview:reader});
  current=event('b',{severity:'error',needs_attention:true});
  const a=await collect({home,root:home,now:at('2026-10-18T07:05:00Z'),readOverview:reader});
  const b=await collect({home,root:home,now:at('2026-10-18T07:10:00Z'),readOverview:reader});
  assert.equal(a.notifications.length,1);assert.equal(b.notifications[0].id,a.notifications[0].id);
  assert.equal(fs.readdirSync(path.join(home,'runtime/synk-automation/outbox')).length,1);
});
test('concurrent collectors execute only one source read',async()=>{
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'synk-monitor-race-'));let reads=0;
  const reader=async()=>{reads++;await new Promise(r=>setTimeout(r,50));return {events:[]};};
  const pair=await Promise.all([collect({home,root:home,readOverview:reader}),collect({home,root:home,readOverview:reader})]);
  assert.equal(reads,1);assert.equal(pair.filter(x=>x.busy).length,1);
});
test('a lock left by a killed collector is reclaimed once it is old, even when its pid now belongs to another process',async()=>{
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'synk-monitor-lock-'));
  const folder=path.join(home,'runtime/synk-automation'),lock=path.join(folder,'monitor.lock');
  fs.mkdirSync(folder,{recursive:true});
  // A live pid (this test process) stands in for the reused one.
  fs.writeFileSync(lock,JSON.stringify({pid:process.pid}));
  const reader=async()=>({events:[]});
  assert.equal((await collect({home,root:home,readOverview:reader})).busy,true,'a fresh lock with a live owner is respected');
  const old=new Date(Date.now()-STALE_LOCK_MS-60_000);fs.utimesSync(lock,old,old);
  const out=await collect({home,root:home,readOverview:reader});
  assert.notEqual(out.busy,true);
  assert.equal(fs.existsSync(lock),false,'the collector released its own new lock');
  assert.equal(fs.readdirSync(folder).filter(name=>name.startsWith('monitor.lock.orphan-')).length,1,'the old lock is set aside, not deleted');
});
test('old daily and info drafts are preserved with suppressed receipts and never returned for delivery',async()=>{
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'synk-monitor-backlog-'));
  const outbox=path.join(home,'runtime/synk-automation/outbox');fs.mkdirSync(outbox,{recursive:true});
  for(let i=0;i<120;i++) {
    const id='event-'+i.toString(16).padStart(24,'0');
    fs.writeFileSync(path.join(outbox,id+'.json'),JSON.stringify({id,text:'past'}));
    fs.writeFileSync(path.join(outbox,id+'.claim'),'past send');
  }
  fs.writeFileSync(path.join(outbox,'daily-2026-10-19.json'),JSON.stringify({id:'daily-2026-10-19',text:'new',createdAt:'2026-10-19T00:00:00Z'}));
  const result=await collect({home,root:home,readOverview:async()=>({events:[]})});
  assert.deepEqual(result.notifications,[]);
  assert.equal(JSON.parse(fs.readFileSync(path.join(outbox,'daily-2026-10-19.receipt.json'),'utf8')).status,'suppressed');
  assert.equal(fs.existsSync(path.join(outbox,'daily-2026-10-19.json')),true);
});

test('severity alone is insufficient: only boolean needs_attention true may alert',()=>{
  const a=plan(null,{events:[event()]},at('2026-10-18T07:00:00Z'));
  for(const flag of [undefined,false,'true',1]) {
    const b=plan(a.state,{events:[event('b',{severity:'error',needs_attention:flag})]},at('2026-10-18T07:05:00Z'));
    assert.equal(b.notifications.length,0);
  }
  const b=plan(a.state,{events:[event('b',{severity:'info',needs_attention:true})]},at('2026-10-18T07:05:00Z'));
  assert.equal(b.notifications.length,1);
  assert.equal(b.notifications[0].policy,POLICY);
  assert.equal(b.notifications[0].needs_attention,true);
});

test('same decision stays quiet when record timestamps change and may alert again after resolution',()=>{
  const a=plan(null,{events:[event()]},at('2026-10-18T07:00:00Z'));
  const failure=event('b',{needs_attention:true,attention_fingerprint:'same-conflict'});
  const b=plan(a.state,{events:[failure]},at('2026-10-18T07:05:00Z'));
  assert.equal(b.notifications.length,1);
  const c=plan(b.state,{events:[{...failure,fingerprint:'new-time'}]},at('2026-10-18T07:10:00Z'));
  assert.equal(c.notifications.length,0);
  const resolved=plan(c.state,{events:[event('resolved')]},at('2026-10-18T07:15:00Z'));
  const recur=plan(resolved.state,{events:[failure]},at('2026-10-18T07:20:00Z'));
  assert.equal(recur.notifications.length,1);
});

test('the awake streak survives regular polls and restarts after sleep, a backwards clock or a legacy state',()=>{
  const a=plan(null,{events:[]},at('2026-10-18T07:00:00Z'));
  assert.equal(a.state.awakeSince,'2026-10-18T07:00:00.000Z');
  const b=plan(a.state,{events:[]},at('2026-10-18T07:06:00Z'));
  const c=plan(b.state,{events:[]},at('2026-10-18T07:21:00Z'));
  assert.equal(c.state.awakeSince,'2026-10-18T07:00:00.000Z','one missed poll (a fifteen-minute gap) still counts as awake');
  assert.equal(plan(c.state,{events:[]},at('2026-10-18T07:36:01Z')).state.awakeSince,'2026-10-18T07:36:01.000Z','a longer gap is sleep or shutdown');
  assert.equal(plan(c.state,{events:[]},at('2026-10-18T07:10:00Z')).state.awakeSince,'2026-10-18T07:10:00.000Z','a clock moved backwards');
  const {awakeSince:_,...legacy}=c.state;
  assert.equal(plan(legacy,{events:[]},at('2026-10-18T07:25:00Z')).state.awakeSince,'2026-10-18T07:25:00.000Z','a state from before this field');
  assert.equal(awakeSince({checkedAt:'2026-10-18T07:16:00Z',awakeSince:'2026-10-18T07:20:00Z'},at('2026-10-18T07:22:00Z')),'2026-10-18T07:22:00.000Z','a streak cannot start after its last poll');
  assert.equal(awakeSince({checkedAt:123,awakeSince:0},at('2026-10-18T07:20:00Z')),'2026-10-18T07:20:00.000Z');
});

test('the collector persists the awake streak with its cursor',async t=>{
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'synk-monitor-awake-'));
  t.after(()=>fs.rmSync(home,{recursive:true,force:true}));
  const reader=async()=>({events:[]});
  await collect({home,root:home,now:at('2026-10-18T07:00:00Z'),readOverview:reader});
  await collect({home,root:home,now:at('2026-10-18T07:06:00Z'),readOverview:reader});
  const state=JSON.parse(fs.readFileSync(path.join(home,'runtime/synk-automation/state.json'),'utf8'));
  assert.deepEqual([state.awakeSince,state.checkedAt],['2026-10-18T07:00:00.000Z','2026-10-18T07:06:00.000Z']);
});

test('a recurring decision receives a new outbox identity after the previous incident was claimed',async()=>{
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'synk-monitor-recurrence-'));
  let current=event();const reader=async()=>({events:[current]});
  await collect({home,root:home,now:at('2026-10-18T07:00:00Z'),readOverview:reader});
  current=event('blocked',{needs_attention:true,attention_fingerprint:'same-conflict'});
  const first=await collect({home,root:home,now:at('2026-10-18T07:05:00Z'),readOverview:reader});
  const firstId=first.notifications[0].id;
  const outbox=path.join(home,'runtime/synk-automation/outbox');
  fs.writeFileSync(path.join(outbox,firstId+'.claim'),'fixture official sender claim');
  fs.writeFileSync(path.join(outbox,firstId+'.receipt.json'),JSON.stringify({status:'sent',transport:'fixture'}));
  current=event('resolved');
  await collect({home,root:home,now:at('2026-10-18T07:10:00Z'),readOverview:reader});
  current=event('blocked',{needs_attention:true,attention_fingerprint:'same-conflict'});
  const recur=await collect({home,root:home,now:at('2026-10-18T07:15:00Z'),readOverview:reader});
  assert.equal(recur.notifications.length,1);
  assert.notEqual(recur.notifications[0].id,firstId);
  assert.equal(recur.notifications[0].needs_attention,true);
  assert.equal(JSON.parse(fs.readFileSync(path.join(outbox,firstId+'.receipt.json'),'utf8')).status,'sent');
});

test('attention text remains bounded and discloses additional decisions available in manual overview',()=>{
  const baseline=Array.from({length:12},(_,i)=>event('ok',{id:'task:'+i}));
  const initial=plan(null,{events:baseline},at('2026-10-18T07:00:00Z'));
  const decisions=baseline.map(row=>({...row,fingerprint:'blocked',needs_attention:true,title:'가'.repeat(200),detail:'나'.repeat(400)}));
  const result=plan(initial.state,{events:decisions},at('2026-10-18T07:05:00Z'));
  assert.equal(result.notifications.length,1);
  assert.equal(result.notifications[0].events.length,12);
  assert.match(result.notifications[0].text,/그 밖에 6건.*synk_today/);
  assert.ok(result.notifications[0].text.length<4000);
});

test('quiet policy migration discards old digest accounting without dispatching pending info',()=>{
  const previous={version:1,baselineAt:'2026-10-18T07:00:00Z',observed:{},pending:{old:event('old')},lastDaily:'2026-10-17'};
  const result=plan(previous,{events:[event('new')]},at('2026-10-19T00:00:00Z'));
  assert.equal(result.notifications.length,0);
  assert.equal(result.state.notification_policy,POLICY);
  assert.equal(result.state.suppressedPendingCount,1);
  assert.deepEqual(result.state.pending,{});
  assert.equal(previous.pending.old.fingerprint,'old');
});

test('legacy attention draft without explicit policy and flag is also suppressed',async()=>{
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'synk-monitor-legacy-draft-'));
  const outbox=path.join(home,'runtime/synk-automation/outbox');fs.mkdirSync(outbox,{recursive:true});
  const id='event-'+'a'.repeat(24);
  fs.writeFileSync(path.join(outbox,id+'.json'),JSON.stringify({id,kind:'attention',text:'old inferred severity'}));
  const result=await collect({home,root:home,readOverview:async()=>({events:[]})});
  assert.equal(result.notifications.length,0);
  const receipt=JSON.parse(fs.readFileSync(path.join(outbox,id+'.receipt.json'),'utf8'));
  assert.equal(receipt.status,'suppressed');
  assert.equal(receipt.sendAttempted,false);
  assert.equal(receipt.policy,POLICY);
});

test('quiet migration preserves original draft bytes and existing transport evidence',async()=>{
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'synk-monitor-preserve-draft-'));
  const outbox=path.join(home,'runtime/synk-automation/outbox');fs.mkdirSync(outbox,{recursive:true});
  const id='event-'+'b'.repeat(24);
  const original='{"id":"'+id+'","kind":"daily","text":"이전 요약"}\n';
  const priorReceipt='{"status":"unconfirmed","transport":"fixture"}\n';
  fs.writeFileSync(path.join(outbox,id+'.json'),original);
  fs.writeFileSync(path.join(outbox,id+'.receipt.json'),priorReceipt);
  const result=await collect({home,root:home,readOverview:async()=>({events:[]})});
  assert.deepEqual(result.notifications,[]);
  assert.equal(fs.readFileSync(path.join(outbox,id+'.json'),'utf8'),original);
  assert.equal(fs.readFileSync(path.join(outbox,id+'.receipt.json'),'utf8'),priorReceipt);
  assert.equal(JSON.parse(fs.readFileSync(path.join(outbox,id+'.claim'),'utf8')).status,'suppressed');
});

test('resolved queued attention is suppressed before a late sender can announce it',async()=>{
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'synk-monitor-resolved-draft-'));
  let current=event();const reader=async()=>({events:[current]});
  await collect({home,root:home,now:at('2026-10-18T07:00:00Z'),readOverview:reader});
  current=event('blocked',{needs_attention:true,attention_fingerprint:'conflict'});
  const blocked=await collect({home,root:home,now:at('2026-10-18T07:05:00Z'),readOverview:reader});
  assert.equal(blocked.notifications.length,1);
  current=event('resolved');
  const resolved=await collect({home,root:home,now:at('2026-10-18T07:10:00Z'),readOverview:reader});
  assert.equal(resolved.notifications.length,0);
  const receipt=JSON.parse(fs.readFileSync(path.join(home,'runtime/synk-automation/outbox',blocked.notifications[0].id+'.receipt.json'),'utf8'));
  assert.equal(receipt.status,'suppressed');
});

test('mixed queued attention is narrowed without losing its still-blocked decision',async()=>{
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'synk-monitor-pruned-draft-'));
  let current=[event('a',{id:'one'}),event('a',{id:'two'})];const reader=async()=>({events:current});
  await collect({home,root:home,now:at('2026-10-18T07:00:00Z'),readOverview:reader});
  current=current.map(x=>({...x,fingerprint:'b',needs_attention:true}));
  const both=await collect({home,root:home,now:at('2026-10-18T07:05:00Z'),readOverview:reader});
  assert.equal(both.notifications[0].events.length,2);
  current=[{...current[0],needs_attention:false,fingerprint:'resolved'},current[1]];
  const remaining=await collect({home,root:home,now:at('2026-10-18T07:10:00Z'),readOverview:reader});
  assert.equal(remaining.notifications.length,1);
  assert.deepEqual(remaining.notifications[0].events.map(x=>x.id),['two']);
  assert.notEqual(remaining.notifications[0].id,both.notifications[0].id);
});

test('9 KST no longer forces a remote read; hourly refresh remains independent of notifications',async()=>{
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'synk-monitor-refresh-'));
  const flags=[];const reader=async options=>{flags.push(options.remoteRefresh);return {events:[]};};
  await collect({home,root:home,now:at('2026-10-18T23:55:00Z'),readOverview:reader});
  await collect({home,root:home,now:at('2026-10-19T00:00:00Z'),readOverview:reader});
  await collect({home,root:home,now:at('2026-10-19T00:55:00Z'),readOverview:reader});
  assert.deepEqual(flags,[true,false,true]);
});
test('private accounts, credentials and media directives are neutralized',()=>{
  const text=clean('a@b.com sk-secret access_token=secret MEDIA:/private [[as_document]]');
  assert.doesNotMatch(text,/a@b.com|sk-secret|access_token=secret|MEDIA:|as_document/);
  // 열쇠 표식 뒤 값은 그 줄 끝까지 — 빈칸 든 값의 꼬리가 남지 않는다(GPT alert-fix-20261126-r10 GA3)
  assert.equal(clean('a api_key=C:\\Users\\Jane Doe\\sk_live_abc tail\nnext'),'a [인증값]\nnext');
  // 앞 표식의 자리 안에 든 표식도 따로 센다 — 뒤 표식의 값이 다음 줄에 있어도 남지 않는다(r11 GA1)
  assert.equal(clean('api_key=sample-one password:\n sample-two\nnext'),'[인증값]\nnext');
  // 열쇠 · 토큰 · 메일 자리를 원문에서 함께 찾아 합친다 — 메일 끝의 password:가 메일 일부를 남기지 않는다(r12 GA1)
  assert.equal(clean('회신 주소 my.name@example.password: 확인 필요'),'회신 주소 [인증값]');
  // 메일 바로 뒤에 글자가 붙어도 메일을 놓치지 않는다(r13 GA1)
  assert.doesNotMatch(clean('회신 주소 my.name@example.comapi_key=sample'),/my\.name|example|sample/);
  // 긴 하이픈 값에서도 메일 꼴이 글 길이에 비례한다(r13 GA2)
  const longValue=Date.now();
  assert.equal(clean('password='+'a-'.repeat(100000),20),'[인증값]');
  assert.equal(clean('x '+'a-'.repeat(100000),4),'x a-');
  assert.ok(Date.now()-longValue<2000,`${Date.now()-longValue}ms`);
  // 표식이 아주 많아도 글 길이에 비례한다(r12 GA2) — 제곱으로 늘면 수 초가 걸린다
  const started=Date.now();
  assert.equal(clean('password=x '.repeat(200000),20),'[인증값]');
  assert.ok(Date.now()-started<2000,`${Date.now()-started}ms`);
  assert.equal(kst(at('2026-10-18T15:01:00Z')).day,'2026-10-19');
});


// 11-25 하루 한 번 모아 보내기: KST 09시 이후 첫 회차가 진단을 부탁하고, 진단이 오거나 120분이 지나면 그때 열린 일만 한 통으로 보낸다.
// 알림 초안은 그 한 통이 실제로 나간 뒤에만 거둔다. 묶음 번호는 날짜에서 나오므로 하루에 한 통뿐이다.
function digestFixture(prefix){
  const home=fs.mkdtempSync(path.join(os.tmpdir(),prefix));
  const folder=path.join(home,'runtime/synk-automation'),outbox=path.join(folder,'outbox');
  const ok=id=>({id,kind:'task',severity:'info',needs_attention:false,title:id+' 정상',fingerprint:'ok',notify_recovery:true});
  const bad=(id,fp)=>({id,kind:'task',severity:'error',needs_attention:true,notify_recovery:true,title:id+' 멈춤',detail:'확인 필요',fingerprint:fp});
  const box={rows:[]};
  const reader=async()=>({events:box.rows});
  // The sender (automation.py) claims an id exactly once; claim:false is a sender that died before it.
  const sent=[];
  const run=async(iso,{claim=true,...extra}={})=>{const r=await collect({home,root:home,now:at(iso),readOverview:reader,digestHour:9,...extra});
    if(claim)for(const n of r.notifications){try{fs.writeFileSync(path.join(outbox,n.id+'.claim'),'sent',{flag:'wx'});}catch{continue;}sent.push({...n,day:kst(at(iso)).day});}
    return r;};
  const state=()=>JSON.parse(fs.readFileSync(path.join(folder,'state.json'),'utf8'));
  const request=()=>{try{return JSON.parse(fs.readFileSync(path.join(folder,'diagnosis/request.json'),'utf8'));}catch{return null;}};
  // What 「알림해결」 leaves behind: one line per requested item, with the incident it read.
  const diagnose=(lines,note='')=>{const q=request();fs.writeFileSync(path.join(folder,'diagnosis',q.id+'.json'),JSON.stringify({id:q.id,note,
    items:q.items.filter(x=>lines[x.id]).map(x=>({id:x.id,'사건':x.incident,...lines[x.id]}))}));};
  // Drafts still waiting for a message (a composed digest is not one).
  const waiting=()=>fs.readdirSync(outbox).filter(x=>/^event-[0-9a-f]{24}\.json$/.test(x)).filter(x=>!fs.existsSync(path.join(outbox,x.slice(0,-5)+'.claim')))
    .map(x=>JSON.parse(fs.readFileSync(path.join(outbox,x),'utf8'))).filter(x=>x.digest?.version!==2);
  return {home,folder,outbox,ok,bad,box,run,sent,state,request,diagnose,waiting};
}
test('one message a day: held until 09:00 KST, asks for a diagnosis, then tells what is still open',async()=>{
  const f=digestFixture('synk-digest-');
  f.box.rows=[f.ok('a'),f.ok('b'),f.ok('c'),f.ok('d')];
  await f.run('2026-11-24T15:00:00Z'); // 00:00 KST, baseline
  f.box.rows=[f.bad('a','1'),f.ok('b'),f.ok('c'),f.ok('d')];
  assert.equal((await f.run('2026-11-24T16:00:00Z')).notifications.length,0,'01:00 KST is held');
  f.box.rows=[f.bad('a','1'),f.bad('b','1'),f.bad('c','1'),f.bad('d','1')];
  assert.equal((await f.run('2026-11-24T18:00:00Z')).notifications.length,0,'03:00 KST is held');
  f.box.rows=[f.bad('a','1'),f.bad('b','1'),f.ok('c'),f.bad('d','1')];
  assert.equal((await f.run('2026-11-24T23:55:00Z')).notifications.length,0,'08:55 KST is held');
  assert.equal((await f.run('2026-11-25T00:05:00Z')).waiting,true,'09:05 KST asks for the diagnosis and waits');
  assert.deepEqual(f.request().items.map(x=>x.id),['a','b','d'],'c healed before the digest');
  assert.equal(f.request().id,digestId('2026-11-25'));
  assert.equal((await f.run('2026-11-25T00:10:00Z')).notifications.length,0,'still waiting');
  f.diagnose({a:{'원인':'예약 잠금이 남았다','해결':'잠금을 푼다','상태':'확인 필요'},b:{'원인':'계정 저장 공간이 찼다','해결':'Drive를 비운다','상태':'유호님 차례'},d:{'원인':'이미 풀린 일','해결':'-','상태':'확인 필요'}});
  f.box.rows=[f.bad('a','1'),f.bad('b','1'),f.ok('c'),f.ok('d')]; // d healed while the message waited
  const out=await f.run('2026-11-25T00:15:00Z');
  assert.equal(out.notifications.length,1);assert.equal(out.notifications[0].id,digestId('2026-11-25'));
  const text=out.notifications[0].text;
  assert.match(text,/오늘 확인할 일/);assert.match(text,/a 멈춤[\s\S]*원인: 예약 잠금이 남았다\n  해결: 잠금을 푼다/);
  assert.match(text,/b 멈춤[\s\S]*해결: Drive를 비운다\n  → 유호님 차례/);assert.doesNotMatch(text,/c 멈춤|d 멈춤|이미 풀린 일|고친 것/);
  assert.match(text,new RegExp('/synk_attention '+digestId('2026-11-25').slice(6,14)));
  assert.equal(f.waiting().length,2,'the drafts stay until the message has gone out');
  f.box.rows=[f.bad('a','1'),f.bad('b','1'),f.bad('c','2'),f.ok('d')];
  assert.equal((await f.run('2026-11-25T06:00:00Z')).notifications.length,0,'15:00 KST waits for tomorrow');
  assert.deepEqual(f.waiting().map(x=>x.events.map(e=>e.id).join()),['c'],'the told drafts were withdrawn, the new one waits');
  await f.run('2026-11-26T00:10:00Z');
  const next=await f.run('2026-11-26T02:15:00Z'); // no diagnosis came: the hold ends after 120 minutes
  assert.equal(next.notifications.length,1);assert.match(next.notifications[0].text,/c 멈춤/);assert.match(next.notifications[0].text,/원인 진단은 이번에 오지 않았어요/);
  assert.doesNotMatch(next.notifications[0].text,/a 멈춤/,'yesterday’s items are not repeated');
  await f.run('2026-11-26T02:20:00Z');
  assert.deepEqual(f.waiting(),[],'every draft was told or withdrawn');
  assert.equal(f.sent.length,2,'two days, two messages');
});
test('a day with only good news does not wait for a diagnosis, and a day with nothing sends nothing',async()=>{
  const f=digestFixture('synk-digest-good-');
  f.box.rows=[f.ok('a')];
  await f.run('2026-11-24T15:00:00Z');
  f.box.rows=[f.bad('a','1')];
  await f.run('2026-11-24T16:00:00Z');
  await f.run('2026-11-25T00:05:00Z');f.diagnose({});
  assert.equal((await f.run('2026-11-25T00:10:00Z')).notifications.length,1,'an empty diagnosis still releases the message');
  f.box.rows=[f.ok('a')];
  await f.run('2026-11-25T03:00:00Z');
  const good=await f.run('2026-11-26T00:05:00Z');
  assert.equal(good.notifications.length,1);assert.equal(good.notifications[0].kind,'recovery');assert.match(good.notifications[0].text,/풀린 일\n- a 정상/);
  assert.equal((await f.run('2026-11-27T00:05:00Z')).digest,true);
  f.box.rows=[f.bad('a','2')];
  assert.equal((await f.run('2026-11-27T05:00:00Z')).waiting,undefined,'the round of the 27th is over; this waits for the 28th');
  assert.equal((await f.run('2026-11-28T00:05:00Z')).waiting,true);
  assert.equal(f.sent.length,2);
});
test('without a digest hour the monitor still alerts at once',async()=>{
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'synk-monitor-nodigest-'));
  let rows=[event()];const reader=async()=>({events:rows});
  await collect({home,root:home,now:at('2026-11-24T16:00:00Z'),readOverview:reader});
  rows=[event('b',{severity:'error',needs_attention:true})];
  assert.equal((await collect({home,root:home,now:at('2026-11-24T16:05:00Z'),readOverview:reader})).notifications.length,1);
});
test('a message that never went out is composed again the next day from what is still open',async()=>{
  for(const how of ['asleep','killed']){
    const f=digestFixture('synk-digest-missed-');
    f.box.rows=[f.ok('a'),f.ok('b'),f.ok('c')];
    await f.run('2026-11-24T15:00:00Z');
    f.box.rows=[f.bad('a','1'),f.ok('b'),f.ok('c')];await f.run('2026-11-24T16:00:00Z');
    f.box.rows=[f.bad('a','1'),f.ok('b'),f.bad('c','1')];await f.run('2026-11-24T17:00:00Z');
    await f.run('2026-11-25T00:05:00Z'); // 25일 09:05 KST waits for the diagnosis
    if(how==='killed')assert.equal((await f.run('2026-11-25T02:10:00Z',{claim:false})).notifications.length,1,'composed, but the sender died');
    f.diagnose({a:{'원인':'어제의 원인','해결':'-','상태':'확인 필요'}});
    f.box.rows=[f.bad('a','1'),f.bad('b','1'),f.ok('c')]; // c healed overnight: only a (told by nobody yet) and b remain
    assert.equal((await f.run('2026-11-25T23:00:00Z')).notifications.length,0,'26일 08:00 KST');
    const out=await f.run('2026-11-26T00:05:00Z');
    assert.equal(out.notifications.length,1,'after a day without its message the next one does not wait');
    assert.deepEqual(out.notifications[0].digest.items.map(x=>x.id).sort(),['a','b']);
    assert.doesNotMatch(out.notifications[0].text,/어제의 원인/,'yesterday’s diagnosis is not attached');
    await f.run('2026-11-26T08:00:00Z');
    assert.deepEqual(f.sent.map(x=>x.day),['2026-11-26'],how);assert.deepEqual(f.waiting(),[]);
  }
});
test('the same day composes again when the sender died, and never sends twice',async()=>{
  const f=digestFixture('synk-digest-again-');
  f.box.rows=[f.ok('a'),f.ok('b')];await f.run('2026-11-24T15:00:00Z');
  f.box.rows=[f.bad('a','1'),f.ok('b')];await f.run('2026-11-24T16:00:00Z');
  await f.run('2026-11-25T00:05:00Z');
  await f.run('2026-11-25T02:10:00Z',{claim:false});
  f.box.rows=[f.bad('a','1'),f.bad('b','1')];
  assert.equal((await f.run('2026-11-25T02:15:00Z')).notifications.length,1);
  assert.equal((await f.run('2026-11-25T02:20:00Z')).notifications.length,0);
  assert.equal(f.sent.length,1);assert.deepEqual(f.sent[0].digest.items.map(x=>x.id),['a','b']);
  assert.deepEqual(f.waiting(),[]);
});
test('a state older than the sender’s claim does not repeat the message',async()=>{
  const f=digestFixture('synk-digest-oldstate-');
  f.box.rows=[f.ok('a')];await f.run('2026-11-24T15:00:00Z');
  f.box.rows=[f.bad('a','1')];await f.run('2026-11-24T16:00:00Z');
  await f.run('2026-11-25T00:05:00Z');
  const before=fs.readFileSync(path.join(f.folder,'state.json'));
  assert.equal((await f.run('2026-11-25T02:10:00Z')).notifications.length,1);
  fs.writeFileSync(path.join(f.folder,'state.json'),before);
  assert.equal((await f.run('2026-11-25T02:15:00Z')).notifications.length,0);
  assert.deepEqual(f.waiting(),[]);assert.equal(f.state().digest.status,'done');
  await f.run('2026-11-26T00:05:00Z');assert.equal(f.sent.length,1);
});
test('the digest reports every open item, also the 21st draft',async()=>{
  const f=digestFixture('synk-digest-many-');
  const ids=Array.from({length:25},(_,i)=>'e'+String(i).padStart(2,'0'));
  f.box.rows=ids.map(f.ok);
  await f.run('2026-11-24T15:00:00Z');
  for(let i=0;i<ids.length;i++){f.box.rows=ids.map((id,k)=>k<=i?f.bad(id,'1'):f.ok(id));await f.run(new Date(Date.parse('2026-11-24T15:05:00Z')+i*300000).toISOString());}
  await f.run('2026-11-25T00:05:00Z');
  const out=await f.run('2026-11-25T02:10:00Z');
  assert.equal(out.notifications[0].digest.items.length,25);assert.match(out.notifications[0].text,/그 밖에 19건/);
});
test('the alert number survives a full diagnosis within the 3400 characters that are sent',async()=>{
  const f=digestFixture('synk-digest-long-');
  const ids=['a','b','c','d','e','f'];const long=n=>'가'.repeat(n);
  const bad=id=>({...f.bad(id,'1'),title:id+' '+long(58),detail:long(150)});
  f.box.rows=ids.map(f.ok);
  await f.run('2026-11-24T15:00:00Z');
  f.box.rows=ids.map(bad);
  await f.run('2026-11-24T16:00:00Z');
  await f.run('2026-11-25T00:05:00Z');
  f.diagnose(Object.fromEntries(ids.map(x=>[x,{'원인':long(200),'해결':long(250),'상태':'유호님 차례'}])),long(200));
  const text=(await f.run('2026-11-25T00:15:00Z')).notifications[0].text;
  assert.ok(text.length<=3400,'길이 '+text.length);
  assert.match(text.slice(0,3400),new RegExp('/synk_attention '+digestId('2026-11-25').slice(6,14)));
  for(const x of ids)assert.match(text,new RegExp('- '+x+' '),x+' 제목은 남는다');
});
test('a recovery is told once, waits while its source is broken again, and only after its alert was told',async()=>{
  const f=digestFixture('synk-digest-recover-');
  f.box.rows=[f.ok('a'),f.ok('b'),f.ok('c')];await f.run('2026-11-10T15:00:00Z');
  f.box.rows=[f.bad('a','1'),f.bad('b','1'),f.ok('c')];
  await f.run('2026-11-11T20:00:00Z');await f.run('2026-11-12T00:05:00Z');await f.run('2026-11-12T02:10:00Z');
  assert.equal(f.sent.length,1,'a and b were told on the 12th');
  f.box.rows=[f.ok('a'),f.ok('b'),f.bad('c','1')];
  await f.run('2026-11-12T05:00:00Z'); // both healed in one round
  f.box.rows=[f.bad('a','2'),f.ok('b'),f.bad('c','1')]; // a broke again before the next message
  await f.run('2026-11-12T22:00:00Z');await f.run('2026-11-13T00:05:00Z');
  f.box.rows=[f.bad('a','2'),f.ok('b'),f.ok('c')]; // c healed before anyone heard about it
  const out=(await f.run('2026-11-13T02:10:00Z')).notifications[0];
  assert.deepEqual(out.digest.items.map(x=>x.id),['a']);assert.deepEqual(out.digest.recoveries,['b 정상'],'b alone; a is broken again, c was never told');
  f.box.rows=[f.ok('a'),f.ok('b'),f.ok('c')];
  await f.run('2026-11-13T05:00:00Z');
  const good=(await f.run('2026-11-14T00:05:00Z')).notifications[0];
  assert.deepEqual(good.digest.recoveries,['a 정상'],'one line for a');
  await f.run('2026-11-15T00:05:00Z');
  assert.equal(f.sent.length,3);assert.deepEqual(f.waiting(),[]);
});
test('a source that healed, broke and healed again between two messages is still told as healed',async()=>{
  const f=digestFixture('synk-digest-flap-');
  f.box.rows=[f.ok('a')];await f.run('2026-11-10T15:00:00Z');
  f.box.rows=[f.bad('a','1')];await f.run('2026-11-11T20:00:00Z');await f.run('2026-11-12T00:05:00Z');await f.run('2026-11-12T02:10:00Z');
  f.box.rows=[f.ok('a')];await f.run('2026-11-12T05:00:00Z');
  f.box.rows=[f.bad('a','2')];await f.run('2026-11-12T08:00:00Z');
  f.box.rows=[f.ok('a')];await f.run('2026-11-12T11:00:00Z');
  const out=(await f.run('2026-11-13T00:05:00Z')).notifications;
  assert.equal(out.length,1);assert.deepEqual(out[0].digest.recoveries,['a 정상']);assert.deepEqual(out[0].digest.items,[]);
});
test('an alert that was read is closed with a recovery even when a newer untold alert replaced it',async()=>{
  const f=digestFixture('synk-digest-heard-');
  f.box.rows=[f.ok('a')];await f.run('2026-11-10T15:00:00Z');
  f.box.rows=[f.bad('a','1')];await f.run('2026-11-11T20:00:00Z');await f.run('2026-11-12T00:05:00Z');await f.run('2026-11-12T02:10:00Z');
  f.box.rows=[f.bad('a','2')];await f.run('2026-11-12T05:00:00Z'); // a new incident, not told yet
  f.box.rows=[f.ok('a')];await f.run('2026-11-12T08:00:00Z');
  const out=(await f.run('2026-11-13T00:05:00Z')).notifications;
  assert.equal(out.length,1);assert.deepEqual(out[0].digest.recoveries,['a 정상']);
});
test('a source missing from the round keeps its newest draft, and every told draft leaves',async()=>{
  const f=digestFixture('synk-digest-missing-');
  f.box.rows=[f.ok('a'),f.ok('b')];await f.run('2026-11-24T15:00:00Z');
  f.box.rows=[f.bad('a','1'),f.bad('b','1')];await f.run('2026-11-24T16:00:00Z'); // one draft with both
  const b=f.state().attentionIncidents.b.id,old=f.state().attentionIncidents.a.id;
  f.box.rows=[f.bad('a','2')];await f.run('2026-11-24T20:00:00Z'); // b is not in the round, a fails differently: a second draft
  const a=f.state().attentionIncidents.a.id;assert.notEqual(a,old);assert.equal(f.waiting().length,2);
  f.box.rows=[];await f.run('2026-11-25T00:05:00Z');
  const out=(await f.run('2026-11-25T02:10:00Z')).notifications[0];
  assert.deepEqual(out.digest.items.map(x=>[x.id,x.incident]).sort(),[['a',a],['b',b]]);
  f.box.rows=[f.bad('a','2'),f.bad('b','1')];await f.run('2026-11-25T05:00:00Z');await f.run('2026-11-26T00:05:00Z');await f.run('2026-11-26T02:10:00Z');
  assert.equal(f.sent.length,1,'the same incidents are not told again');assert.deepEqual(f.waiting(),[]);
});
test('a source seen healthy leaves a shared draft at once, even while another of it is missing',async()=>{
  const f=digestFixture('synk-digest-shared-');
  f.box.rows=[f.ok('a'),f.ok('b')];await f.run('2026-11-24T15:00:00Z');
  f.box.rows=[f.bad('a','1'),f.bad('b','1')];await f.run('2026-11-24T16:00:00Z'); // one draft with both
  f.box.rows=[f.ok('a')];assert.equal((await f.run('2026-11-25T00:05:00Z')).waiting,true);
  assert.deepEqual(f.request().items.map(x=>x.id),['b'],'a is healthy, b is not in the round');
  f.box.rows=[f.bad('b','1')]; // now a is missing: it was already seen healthy
  const out=(await f.run('2026-11-25T02:10:00Z')).notifications[0];
  assert.deepEqual(out.digest.items.map(x=>x.id),['b']);
  await f.run('2026-11-25T02:15:00Z');assert.deepEqual(f.waiting(),[]);
});
test('a source is never told as open and as healed in one message',async()=>{
  const f=digestFixture('synk-digest-both-');
  f.box.rows=[f.ok('a'),f.ok('b')];await f.run('2026-11-10T15:00:00Z');
  f.box.rows=[f.bad('a','1'),f.ok('b')];await f.run('2026-11-11T20:00:00Z');await f.run('2026-11-12T00:05:00Z');await f.run('2026-11-12T02:10:00Z');
  f.box.rows=[f.ok('a'),f.bad('b','1')];await f.run('2026-11-12T05:00:00Z');
  await f.run('2026-11-13T00:05:00Z');
  f.box.rows=[f.bad('a','2'),f.bad('b','1')];await f.run('2026-11-13T00:10:00Z'); // a broke again while the message waited
  f.box.rows=[f.bad('b','1')]; // and is not in the sending round
  const out=(await f.run('2026-11-13T02:10:00Z')).notifications[0];
  assert.deepEqual(out.digest.items.map(x=>x.id).sort(),['a','b']);assert.deepEqual(out.digest.recoveries,[]);
});
test('a draft whose narrowed id was already used still carries its alert',async()=>{
  const f=digestFixture('synk-digest-used-');
  f.box.rows=[f.ok('a'),f.ok('b')];await f.run('2026-11-24T15:00:00Z');
  f.box.rows=[f.bad('a','1'),f.bad('b','1')];await f.run('2026-11-24T16:00:00Z');
  const draft=f.waiting()[0],a=draft.events.find(e=>e.id==='a');
  // What the first 11-25 version left behind: the narrowed id was withdrawn into a digest that never went out.
  const used=attentionNotification([{id:'a',attention_fingerprint:a.fingerprint,incident:a.incident,title:'a 멈춤'}]).id;
  fs.writeFileSync(path.join(f.outbox,used+'.claim'),JSON.stringify({status:'suppressed'}));
  f.box.rows=[f.bad('a','1'),f.ok('b')];await f.run('2026-11-25T00:05:00Z');
  const out=(await f.run('2026-11-25T02:10:00Z')).notifications[0];
  assert.deepEqual(out.digest.items.map(x=>x.id),['a']);
  await f.run('2026-11-25T02:15:00Z');assert.deepEqual(f.waiting(),[]);
});
test('a diagnosis belongs to the incident it read',async()=>{
  const f=digestFixture('synk-digest-incident-');
  f.box.rows=[f.ok('a')];await f.run('2026-11-24T15:00:00Z');
  f.box.rows=[f.bad('a','1')];await f.run('2026-11-24T16:00:00Z');
  await f.run('2026-11-25T00:05:00Z');
  f.diagnose({a:{'원인':'앞 사건의 원인','해결':'-','상태':'확인 필요'}},'둘의 까닭은 하나예요.');
  f.box.rows=[f.bad('a','2')]; // it failed anew, differently, before the message went out
  const out=(await f.run('2026-11-25T00:15:00Z')).notifications[0];
  assert.match(out.text,/a 멈춤/);assert.doesNotMatch(out.text,/앞 사건의 원인|둘의 까닭은 하나/,'neither its lines nor its note');
});
test('nothing is composed after 23:00 KST, so a message never crosses midnight',async()=>{
  const f=digestFixture('synk-digest-late-');
  f.box.rows=[f.ok('a')];await f.run('2026-11-24T15:00:00Z');
  f.box.rows=[f.bad('a','1')];
  assert.equal((await f.run('2026-11-25T12:30:00Z')).waiting,true,'21:30 KST: the PC just woke, then sleeps again');
  for(const iso of ['2026-11-25T14:30:01Z','2026-11-25T14:59:59Z'])assert.equal((await f.run(iso)).notifications.length,0,iso+': the hold is over, but it is past 23:00');
  assert.equal((await f.run('2026-11-25T23:59:00Z')).notifications.length,0,'26일 08:59 KST');
  assert.equal((await f.run('2026-11-26T00:05:00Z')).notifications.length,1);
  assert.deepEqual(f.sent.map(x=>x.day),['2026-11-26']);
});
test('a state from the first 11-25 version keeps its finished day',async()=>{
  const f=digestFixture('synk-digest-legacy-');
  f.box.rows=[f.ok('a')];await f.run('2026-11-24T15:00:00Z');
  const state=f.state();delete state.digest;state.digestDay='2026-11-25';fs.writeFileSync(path.join(f.folder,'state.json'),JSON.stringify(state));
  f.box.rows=[f.bad('a','1')];
  assert.equal((await f.run('2026-11-25T12:10:00Z')).waiting,undefined,'21:10 KST, after today’s round');
  assert.equal(f.state().digestDay,undefined);
  assert.equal((await f.run('2026-11-26T00:05:00Z')).waiting,true);
});
test('an unreadable diagnosis file does not stop the collector; the message goes out without it',async()=>{
  const f=digestFixture('synk-digest-broken-');
  f.box.rows=[f.ok('a')];await f.run('2026-11-24T15:00:00Z');
  f.box.rows=[f.bad('a','1')];await f.run('2026-11-24T16:00:00Z');await f.run('2026-11-25T00:05:00Z');
  fs.writeFileSync(path.join(f.folder,'diagnosis',f.request().id+'.json'),'{ 끊긴 글');
  assert.equal((await f.run('2026-11-25T00:15:00Z')).notifications.length,0);
  const out=await f.run('2026-11-25T02:10:00Z');
  assert.equal(out.notifications.length,1);assert.match(out.notifications[0].text,/원인 진단은 이번에 오지 않았어요/);
});
// Random days, a sleeping PC, a collector killed between any two writes and a sender that dies before its claim.
test('random timelines with crashes: one message a day, nothing lost, nothing told twice',async()=>{
  const seeds=(process.env.SYNK_DIGEST_SEEDS||'1,2,3').split(',').map(Number),sync=fs.fsyncSync;
  fs.fsyncSync=()=>{}; // only speed: the order of writes is unchanged
  try{for(const seed of seeds){
    let x=(seed*2654435761+12345)>>>0||1;const rand=()=>{x^=x<<13;x>>>=0;x^=x>>>17;x^=x<<5;x>>>=0;return x/4294967296;};
    const f=digestFixture('synk-digest-random-');const ids=['a','b','c','d'];
    const world=Object.fromEntries(ids.map(id=>[id,{bad:false,fp:0,missing:false}]));
    let now=Date.parse('2026-11-20T15:00:00Z');
    const step=async({crash=false,claim=true}={})=>{
      f.box.rows=ids.filter(id=>!world[id].missing).map(id=>world[id].bad?f.bad(id,'f'+world[id].fp):f.ok(id));
      const real={renameSync:fs.renameSync,openSync:fs.openSync,writeFileSync:fs.writeFileSync};
      let budget=1+Math.floor(rand()*14),dead=false;
      if(crash)for(const name of Object.keys(real))fs[name]=(...args)=>{
        if(!String(args[0]).includes('monitor.lock')){if(dead||--budget<0){dead=true;throw new Error('CRASH');}}
        return real[name](...args);
      };
      const r=await (async()=>{try{return await collect({home:f.home,root:f.home,now:new Date(now),readOverview:async()=>({events:f.box.rows}),digestHour:9});}
        catch(error){if(error.message!=='CRASH')throw error;return null;}finally{Object.assign(fs,real);}})();
      for(const n of claim&&r?r.notifications:[]){try{fs.writeFileSync(path.join(f.outbox,n.id+'.claim'),'sent',{flag:'wx'});}catch{continue;}f.sent.push({...n,day:kst(new Date(now)).day});}
      if(rand()<0.3&&f.request()&&!fs.existsSync(path.join(f.folder,'diagnosis',f.request().id+'.json')))f.diagnose(Object.fromEntries(ids.map(id=>[id,{'원인':'x','해결':'y','상태':'확인 필요'}])));
    };
    await step();
    for(let i=0;i<60;i++){
      for(const id of ids){const w=world[id];
        if(rand()<0.10){if(!w.bad){w.bad=true;w.fp++;}else if(rand()<0.6)w.bad=false;else w.fp++;}
        if(rand()<0.05)w.missing=!w.missing;}
      now+=rand()<0.06?(8+rand()*30)*3600000:(5+rand()*175)*60000;
      await step({crash:rand()<0.12,claim:rand()>=0.08});
    }
    for(const id of ids)world[id].missing=false;
    for(let i=0;i<30;i++){now+=2*3600000;await step();} // two and a half quiet days
    assert.equal(new Set(f.sent.map(m=>m.day)).size,f.sent.length,'seed '+seed+': one message a day');
    const told=new Map(),healed=new Map();
    f.sent.forEach((m,k)=>{
      for(const e of m.digest.items){const key=e.id+'/'+e.incident;assert.ok(!told.has(key),'seed '+seed+': told twice '+key);told.set(key,k);}
      assert.ok(!m.digest.healed.some(e=>m.digest.items.some(x=>x.id===e.id)),'seed '+seed+': open and healed in one message');
      for(const e of m.digest.healed){const key=e.id+'/'+e.incident;assert.ok(!healed.has(key)&&told.get(key)<k,'seed '+seed+': recovery '+key);healed.set(key,k);}
    });
    const last=(map,id)=>Math.max(-1,...[...map].filter(([key])=>key.startsWith(id+'/')).map(([,k])=>k));
    for(const id of ids){
      if(world[id].bad)assert.ok(told.has(id+'/'+f.state().attentionIncidents[id].id),'seed '+seed+': open but never told '+id);
      else assert.ok(last(told,id)<0||last(healed,id)>=last(told,id),'seed '+seed+': told, healed, but the recovery was lost '+id);
    }
    assert.deepEqual(f.waiting(),[],'seed '+seed+': nothing waits after quiet days');
    fs.rmSync(f.home,{recursive:true,force:true});
  }}finally{fs.fsyncSync=sync;}
});

// 11-26 알림 고침(무인): 고침 줄은 진단하지 않고, 기록에서 전후를 지어 사건 줄보다 앞에 한 번 싣는다. 고침 줄만 있으면 기다리지 않는다.
test('an AI fix is told first from its record, is never diagnosed, alone does not wait, and is told once',async()=>{
  const f=digestFixture('synk-digest-fix-');
  const rid='202611260930-a1b2c3';
  const fixRow=(show=true)=>({id:'fix-'+rid,kind:'fix',severity:'info',needs_attention:show,notify_recovery:false,title:'AI가 고쳐 올렸어요 · 팁 적용안 처리 · 실패',detail:'커밋 aaaaaaaa',fingerprint:'f'+show});
  fs.mkdirSync(path.join(f.folder,'fixes',rid),{recursive:true});
  fs.writeFileSync(path.join(f.folder,'fixes',rid,'기록.json'),JSON.stringify({version:1,'상태':'올림','제목':'팁 적용안 처리 · 실패','전':'팁 적용안이 빈 값에서 멈췄어요 https://example.com/x','후':'빈 값도 넘겨요',
    '무엇':'빈 값을 거르는 줄을 더함','커밋':'a'.repeat(40),'전새':{'시험':2,'실패':2},'후시험':{'시험':32,'통과':32},'셈':{'파일':2,'더함':30,'뺌':4},'검수':{'셈':{P0:0,P1:0,P2:1,P3:0}},'바이트같음':true}));
  f.box.rows=[f.ok('a')];
  await f.run('2026-11-24T15:00:00Z');
  f.box.rows=[f.ok('a'),fixRow()];
  await f.run('2026-11-24T16:00:00Z');
  const out=await f.run('2026-11-25T00:05:00Z');
  assert.equal(f.request(),null,'nothing to diagnose');
  assert.equal(out.notifications.length,1,'sent at once');
  const text=out.notifications[0].text;
  assert.match(text,/오늘 확인할 일\n- AI가 고쳐 올렸어요 · 팁 적용안 처리 · 실패\n  전에는: 팁 적용안이 빈 값에서 멈췄어요 → 이제는: 빈 값도 넘겨요 \(AI 설명\)/);
  // AI가 쓴 말은 줄마다 「(AI 설명)」, 잰 줄에는 셈과 커밋만(GPT alert-fix-20261126 GA17)
  assert.match(text,/\n  바꾼 것: 빈 값을 거르는 줄을 더함 \(AI 설명\)\n  잰 것: 새 시험 2개가 고치기 전 2개 실패, 고친 뒤 32\/32 통과 · GPT 검수 P0·P1 0건 · P2 1건 · 파일 2개\(\+30 −4\) · 커밋 aaaaaaaa\n/);
  assert.match(text,/되돌리려면 Claude 세션에 「알림 고침 aaaaaaaa 되돌려」라고 말씀해 주세요/);
  assert.doesNotMatch(text,/https?:|원인 진단은 이번에 오지 않았어요/,'no links from the model, no missing-diagnosis line');
  // The next day another item opens: only it is diagnosed, and the fix is not told again.
  f.box.rows=[f.bad('b','1'),fixRow()];
  await f.run('2026-11-25T05:00:00Z');
  assert.equal((await f.run('2026-11-26T00:05:00Z')).waiting,true);
  assert.deepEqual(f.request().items.map(x=>x.id),['b']);
  f.diagnose({b:{'원인':'x','해결':'y','상태':'확인 필요'}});
  const next=await f.run('2026-11-26T00:10:00Z');
  assert.match(next.notifications[0].text,/b 멈춤/);
  assert.doesNotMatch(next.notifications[0].text,/AI가 고쳐 올렸어요/);
  // Three days on the row turns quiet and tells no recovery.
  f.box.rows=[f.bad('b','1'),fixRow(false)];
  assert.equal((await f.run('2026-11-26T03:00:00Z')).notifications.length,0);
  assert.equal(f.state().attentionObserved['fix-'+rid],undefined);
});
test('a fix that was tried but not pushed is one line with its reason',()=>{
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'synk-fix-text-'));
  const rid='202611260930-b2c3d4';
  fs.mkdirSync(path.join(home,'fixes',rid),{recursive:true});
  fs.writeFileSync(path.join(home,'fixes',rid,'기록.json'),JSON.stringify({version:1,'상태':'못 고침','제목':'팁 적용안 처리 · 실패','까닭':'검수: GPT 검수 A 묶음을 받지 못했다(생략)'}));
  const {digestText,fixReports}=require('../tools/hermes-synk/monitor.cjs');
  const items=[{id:'fix-'+rid,title:'x',incident:'i'}];
  const text=digestText({id:digestId('2026-11-26'),items},null,fixReports(home,items));
  assert.match(text,/- AI가 고쳐 보았지만 올리지 않았어요 · 팁 적용안 처리 · 실패\n  까닭: 검수: GPT 검수 A 묶음을 받지 못했다\(생략\)/);
  fs.rmSync(home,{recursive:true,force:true});
});

// 11-26 GA16: 멈춤 줄만 있는 묶음은 진단을 묻지 않았으니 「원인 진단은 이번에 오지 않았어요」를 붙이지 않는다.
test('a stopped AI fix alone is told as its own line without the missing-diagnosis note',()=>{
  const {digestText,fixReports}=require('../tools/hermes-synk/monitor.cjs');
  const items=[{id:'fix-stopped',title:'AI 알림 고침이 멈췄어요',detail:'올린 고침이 되돌려졌어요 · 새 고침을 하지 않아요',incident:'i'}];
  const text=digestText({id:digestId('2026-11-26'),items},null,fixReports(os.tmpdir(),items));
  assert.match(text,/오늘 확인할 일\n- AI 알림 고침이 멈췄어요\n  올린 고침이 되돌려졌어요 · 새 고침을 하지 않아요\n/);
  assert.doesNotMatch(text,/원인 진단은 이번에 오지 않았어요|그 밖에/);
});
