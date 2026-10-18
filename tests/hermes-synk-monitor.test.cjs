'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {plan,collect,kst,clean,POLICY}=require('../tools/hermes-synk/monitor.cjs');
const event=(fingerprint='a',extra={})=>({id:'task:one',kind:'task',severity:'info',needs_attention:false,title:'작업 응답',detail:'검증 대기',fingerprint,...extra});
const at=x=>new Date(x);
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
  assert.equal(kst(at('2026-10-18T15:01:00Z')).day,'2026-10-19');
});
