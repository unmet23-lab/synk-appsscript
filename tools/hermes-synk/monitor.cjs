'use strict';
// Change accounting only. Hermes owns scheduling; the official sender owns transport.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const POLICY = 'attention_only_v1';
const hash = x => crypto.createHash('sha256').update(typeof x === 'string' ? x : JSON.stringify(x)).digest('hex');
const { awakeSince, AWAKE_GAP_MS } = require('./awake-time.cjs');
function kst(date) {
  const text = new Date(new Date(date).getTime() + 9 * 3600000).toISOString();
  return {day: text.slice(0, 10), hour: Number(text.slice(11, 13))};
}
function clean(value, max = 220) {
  return String(value || '').replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[계정]')
    .replace(/\b(?:sk-|ghp_|gho_|xoxb-)[A-Za-z0-9_-]+/g, '[인증값]')
    .replace(/(?:access_token|refresh_token|api_key|password)\s*[:=]\s*\S+/gi, '[인증값]')
    .replace(/MEDIA:/g, 'MEDIA :').replace(/\[\[(?:as_document|audio_as_voice)\]\]/g, '').slice(0, max);
}
function eventView(event) {
  return {id: clean(event.id, 180), kind: clean(event.kind, 50), severity: clean(event.severity, 40), notify: event.notify !== false,
    needs_attention: event.needs_attention === true, notify_recovery: event.notify_recovery === true, attention_fingerprint: clean(event.attention_fingerprint || event.fingerprint, 100),
    title: clean(event.title, 150), detail: clean(event.detail, 240), fingerprint: clean(event.fingerprint, 100)};
}
function attentionNotification(events, heading = 'SYNK · 판단이 필요한 일') {
  const id = 'event-' + hash([POLICY, events.map(x => [x.id, x.attention_fingerprint, x.incident || '']).sort()]).slice(0, 24);
  return {id, kind:'attention',policy:POLICY,needs_attention:true,
    events:events.map(x=>({id:x.id,fingerprint:x.attention_fingerprint,incident:x.incident||'',needs_attention:true})),
    text:heading+'\n'+events.slice(0,6).map(x=>'- '+x.title+(x.detail?'\n  '+x.detail:'')).join('\n')
      +(events.length>6?'\n그 밖에 '+(events.length-6)+'건 · /synk_today 에서 전체 확인':'')
      // The alert number is the stored outbox id; attention.cjs reads it back. Same id, no extra message.
      +'\n\n이 알림의 번호는 '+id.slice(6,14)+'입니다. 자세한 내용은 /synk_attention '+id.slice(6,14)+' 로 볼 수 있습니다.\n이 알림에 「자세히」라고 답장해도 됩니다.'};
}
// Keeps needs_attention:true because the sender delivers nothing else; it is only ever built for an incident someone was alerted to.
function recoveryNotification(events) {
  const id = 'event-' + hash([POLICY, 'recovery', events.map(x => [x.id, x.incident]).sort()]).slice(0, 24);
  return {id, kind:'recovery',policy:POLICY,needs_attention:true,
    events:events.map(x=>({id:x.id,incident:x.incident,notice:x.notice})),
    text:'SYNK · 풀린 일\n'+events.slice(0,6).map(x=>'- '+x.title+(x.detail?'\n  '+x.detail:'')).join('\n')
      +(events.length>6?'\n그 밖에 '+(events.length-6)+'건 · /synk_today 에서 전체 확인':'')};
}
function plan(previous, overview, now = new Date(), {delivered: sent = () => true} = {}) {
  const events = (overview.events || []).map(eventView).filter(x => x.id && x.fingerprint);
  const current = Object.fromEntries(events.map(x => [x.id, x]));
  const first = !previous;
  const state = previous ? structuredClone(previous) : {baselineAt: now.toISOString(), observed: {}};
  state.version = 2;
  if (state.notification_policy !== POLICY) state.suppressedPendingCount = Object.keys(state.pending || {}).length;
  state.notification_policy = POLICY;
  state.pending = {};
  state.attentionObserved ||= {};
  state.attentionIncidents ||= {};
  state.attentionAlerted ||= {};
  for (const event of events) {
    if (event.needs_attention) {
      let incident=state.attentionIncidents[event.id];
      if(!incident || incident.fingerprint!==event.attention_fingerprint) {
        incident={fingerprint:event.attention_fingerprint,id:hash([event.id,event.attention_fingerprint,now.toISOString()]).slice(0,24)};
        state.attentionIncidents[event.id]=incident;
      }
      event.incident=incident.id;
    }
  }
  const urgent = first ? [] : events.filter(x => x.needs_attention && x.notify
    && state.attentionObserved[x.id] !== x.incident);
  // Only a present, healthy row proves recovery, and only for an incident someone was actually told about.
  // An alert withdrawn before sending (its source healed first) leaves nothing to recover from.
  const told = id => { const value = state.attentionAlerted[id]; return typeof value === 'string' ? {incident:value} : value || null; };
  const healed = first ? [] : events.filter(x => !x.needs_attention && x.notify_recovery && told(x.id));
  const recovered = healed.filter(x => !told(x.id).notice || sent(told(x.id).notice)).map(x => ({...x,...told(x.id)}));
  const alert = urgent.length ? attentionNotification(urgent) : null;
  for (const event of urgent) if (event.notify_recovery) state.attentionAlerted[event.id] = {incident:event.incident,notice:alert.id};
  for (const event of healed) delete state.attentionAlerted[event.id];
  // Absence is never completion: failed/partial readers must not erase evidence.
  state.observed = {...state.observed, ...current};
  for (const event of events) {
    if (event.needs_attention) state.attentionObserved[event.id] = event.incident;
    else {delete state.attentionObserved[event.id];delete state.attentionIncidents[event.id];}
  }
  const notifications = [];
  if (alert) notifications.push(alert);
  if (recovered.length) notifications.push(recoveryNotification(recovered));
  state.awakeSince = awakeSince(previous, now);
  state.checkedAt = now.toISOString();
  // Bound old observations and accumulated change summaries, without interpreting deletion.
  state.observed = Object.fromEntries(Object.entries(state.observed).slice(-2500));
  state.attentionObserved = Object.fromEntries(Object.entries(state.attentionObserved).slice(-1000));
  state.attentionIncidents = Object.fromEntries(Object.entries(state.attentionIncidents).slice(-1000));
  state.attentionAlerted = Object.fromEntries(Object.entries(state.attentionAlerted).slice(-1000));
  return {state, notifications, first};
}
function readJSON(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch(e) { if(e.code === 'ENOENT') return fallback; throw new Error('state_unreadable'); } }
function writeJSON(file, value) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  const temp = file + '.' + process.pid + '.' + crypto.randomBytes(5).toString('hex') + '.tmp';
  const fd = fs.openSync(temp, 'wx', 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(value, null, 2)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(temp, file);
}
// The sender kills a collector after 90 seconds, which leaves its lock behind, and Windows soon hands that pid to another
// process (10-31: a conhost held a dead collector's pid and every later round stayed busy). A lock this old has no live owner.
const STALE_LOCK_MS = 5 * 60_000;
function acquire(folder) {
  fs.mkdirSync(folder, {recursive: true});
  const lock = path.join(folder, 'monitor.lock');
  for (let attempt=0; attempt<2; attempt++) {
    try { const fd=fs.openSync(lock, 'wx', 0o600); fs.writeFileSync(fd, JSON.stringify({pid:process.pid}));fs.closeSync(fd); return () => { if(readJSON(lock, {})?.pid === process.pid) fs.unlinkSync(lock); }; }
    catch(e) {
      if(e.code !== 'EEXIST') throw e;
      const guard=lock+'.reclaim';let guardFd;
      try { guardFd=fs.openSync(guard,'wx',0o600); } catch {return null;}
      try {
        const owner=readJSON(lock, {}); if(!Number.isInteger(owner.pid)) return null;
        if (Date.now() - fs.statSync(lock).mtimeMs < STALE_LOCK_MS) {
          try { process.kill(owner.pid, 0); return null; } catch(probe) { if(probe.code !== 'ESRCH') return null; }
        }
        // Reclaimers serialize and re-read ownership; a live replacement is never removed.
        fs.renameSync(lock, lock + '.orphan-' + crypto.randomBytes(5).toString('hex'));
      } catch {return null;} finally {fs.closeSync(guardFd);fs.unlinkSync(guard);}
    }
  }
  return null;
}
function attentionDraft(item) {
  return item && item.policy === POLICY && item.kind === 'attention' && item.needs_attention === true
    && Array.isArray(item.events) && item.events.length > 0 && item.events.every(event => event?.needs_attention === true)
    && typeof item.text === 'string' && item.text.trim();
}
function recoveryDraft(item) {
  return item && item.policy === POLICY && item.kind === 'recovery' && item.needs_attention === true
    && Array.isArray(item.events) && item.events.length > 0 && typeof item.text === 'string' && item.text.trim();
}
// The sender claims a draft before it sends; a withdrawn draft carries a suppressed receipt instead.
function delivered(outbox, id) {
  let claim;
  try { claim = fs.readFileSync(path.join(outbox, id + '.claim'), 'utf8'); } catch { return false; }
  try { return JSON.parse(claim).status !== 'suppressed'; } catch { return true; }
}
function suppressDraft(outbox, item, now) {
  if (!/^(?:event-[a-f0-9]{24}|daily-\d{4}-\d{2}-\d{2})$/.test(item.id || '')) throw new Error('invalid_draft');
  const claim = path.join(outbox, item.id + '.claim');
  let fd;
  try { fd = fs.openSync(claim, 'wx', 0o600); }
  catch (error) { if (error.code === 'EEXIST') return; throw error; }
  try {
    fs.writeFileSync(fd, JSON.stringify({status:'suppressed',policy:POLICY,at:now.toISOString()}));fs.fsyncSync(fd);
  } finally {fs.closeSync(fd);}
  const receipt = path.join(outbox, item.id + '.receipt.json');
  // Preserve any earlier transport evidence; no send attempt happens here.
  if (!fs.existsSync(receipt)) writeJSON(receipt,{id:item.id,status:'suppressed',policy:POLICY,
    reason:'notification_policy_attention_only_v1',suppressedAt:now.toISOString(),sendAttempted:false});
}
// 11-25 유호님 「너무 알림이 잦아서 … 특정 시간에 한번만 몰아서 보고해줘」 · 「알람만 끄게하고 이 알람들을 모아서 왜 막혔는지
// 그리고 해결방안이 뭔지」: drafts wait in the outbox and go out once a day, from the first round at or after this KST hour
// (a PC asleep at 09:00 sends when it wakes). Anything that healed before then is withdrawn by the replacement step, so the
// digest lists only what is still open. The digest itself waits up to DIGEST_HOLD_MS for the credit job 「알림해결」
// (tools/크레딧작업/알림해결.js) to leave its cause/fix lines in runtime/synk-automation/diagnosis/<id>.json, then goes out
// as one message with them, or without them once the hold ends.
const DIGEST_HOUR_KST = 9;
const DIGEST_HOLD_MS = 120 * 60_000;
const DIGEST_HEADING = 'SYNK · 오늘 확인할 일';
function digestDue(state, now, digestHour) {
  if (digestHour === null || digestHour === undefined) return true;
  const {day, hour} = kst(now);
  return hour >= digestHour && state.digestDay !== day;
}
function digestDraft(item) {
  return item && item.policy === POLICY && item.kind === 'attention' && item.needs_attention === true && item.digest
    && Array.isArray(item.digest.items) && typeof item.digest.holdUntil === 'string';
}
const DIAGNOSIS_STATES = new Set(['고침', '유호님 차례', '확인 필요']);
function readDiagnosis(folder, id) {
  const value = readJSON(path.join(folder, 'diagnosis', id + '.json'), null);
  if (!value || value.id !== id || !Array.isArray(value.items)) return null;
  return {items: value.items.slice(0, 20).filter(x => x && typeof x.id === 'string').map(x => ({id: clean(x.id, 180),
    cause: clean(x['원인'], 200), fix: clean(x['해결'], 260), state: DIAGNOSIS_STATES.has(x['상태']) ? x['상태'] : '확인 필요'})),
    note: clean(value.note, 240)};
}
// healedNow: ids whose current row is healthy at send time (the digest may have waited two hours for its diagnosis).
function digestText(draft, diagnosis, healedNow = new Set()) {
  const byId = new Map((diagnosis?.items || []).map(x => [x.id, x]));
  const items = draft.digest.items;
  const lines = items.slice(0, 6).map(x => {
    const found = byId.get(x.id);
    return '- ' + x.title + (x.detail ? '\n  ' + x.detail : '')
      + (found ? (found.cause ? '\n  원인: ' + found.cause : '') + (found.fix ? '\n  ' + (found.state === '고침' ? '고친 것: ' : '해결: ') + found.fix : '')
        + (found.state === '유호님 차례' && !healedNow.has(x.id) ? '\n  → 유호님 차례' : '') : '')
      + (healedNow.has(x.id) ? '\n  지금은 풀렸어요.' : '');
  });
  const recoveries = draft.digest.recoveries || [];
  const id = draft.id.slice(6, 14);
  return DIGEST_HEADING + '\n' + lines.join('\n')
    + (items.length > 6 ? '\n그 밖에 ' + (items.length - 6) + '건 · /synk_today 에서 전체 확인' : '')
    + (recoveries.length ? '\n\n풀린 일\n' + recoveries.slice(0, 6).map(x => '- ' + x).join('\n') : '')
    + (diagnosis ? (diagnosis.note ? '\n\n' + diagnosis.note : '') : '\n\n원인 진단은 이번에 오지 않았어요.')
    + '\n\n이 알림의 번호는 ' + id + '입니다. 자세한 내용은 /synk_attention ' + id + ' 로 볼 수 있습니다.\n이 알림에 「자세히」라고 답장해도 됩니다.';
}
async function collect({home, root, now = new Date(), readOverview, initial = false, digestHour = null, holdMs = DIGEST_HOLD_MS}) {
  const folder = path.join(home, 'runtime/synk-automation');
  const release = acquire(folder); if(!release) return {busy:true,notifications:[]};
  try {
    const stateFile = path.join(folder,'state.json');
    const previous=readJSON(stateFile, null);
    const refresh = !previous || now.getTime() - Date.parse(previous.remoteRefreshAt || previous.baselineAt) >= 3600000;
    // Only this monitor persists the backup failure marks; ad-hoc /synk_today reads stay write-free.
    const overview=await readOverview({root,hermesHome:home,now,remoteRefresh:refresh,persistState:true});
    const result=plan(previous, overview, now, {delivered:id=>delivered(path.join(folder,'outbox'),id)});
    result.state.remoteRefreshAt = refresh ? now.toISOString() : previous.remoteRefreshAt;
    for(const item of result.notifications) {
      const output=path.join(folder,'outbox',item.id+'.json');
      if(!fs.existsSync(output)) writeJSON(output,{...item,createdAt:now.toISOString()});
    }
    // Outbox precedes cursor commit: a crash can repeat preparation, never lose its draft.
    writeJSON(stateFile,result.state);
    const outbox=path.join(folder,'outbox');
    const drafts=fs.existsSync(outbox)?fs.readdirSync(outbox)
      .filter(x=>/^(?:event-[a-f0-9]{24}|daily-\d{4}-\d{2}-\d{2})\.json$/.test(x))
      .filter(x=>!fs.existsSync(path.join(outbox,x.slice(0,-5)+'.claim')))
      .map(x=>readJSON(path.join(outbox,x),null)).filter(Boolean)
      .sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt))):[];
    const notifications=[], heldDigests=[];
    for (const draft of drafts) {
      // A digest already went through the replacement step when it was built; it only waits for its diagnosis.
      if (digestDraft(draft)) { heldDigests.push(draft); continue; }
      if (recoveryDraft(draft)) {
        // A queued recovery must not arrive after the same source broke again.
        const broken = new Set((overview.events || []).map(eventView).filter(event=>event.needs_attention).map(event=>event.id));
        // Nor may it announce something nobody heard about: every source's alert must have actually gone out.
        if (draft.events.some(source=>broken.has(source.id)) || !draft.events.every(source=>!source.notice || delivered(outbox,source.notice))) suppressDraft(outbox,draft,now);
        else if (notifications.length < 20) notifications.push(draft);
        continue;
      }
      if (!attentionDraft(draft)) suppressDraft(outbox,draft,now);
      else {
        const current = new Map((overview.events || []).map(eventView).map(event=>[event.id,{...event,incident:result.state.attentionIncidents[event.id]?.id||''}]));
        const sources = draft.events.map(source=>current.get(source.id));
        // Only positive, current resolution may retire a queued attention item.
        // Missing records still do not imply success or deletion.
        if (sources.every(Boolean)) {
          const active = sources.filter(event=>event.needs_attention && event.notify);
          const replacement = active.length ? attentionNotification(active) : null;
          if (!replacement || replacement.id !== draft.id) {
            if (replacement) {
              const replacementPath=path.join(outbox,replacement.id+'.json');
              if(!fs.existsSync(replacementPath)) writeJSON(replacementPath,{...replacement,createdAt:now.toISOString()});
              if(!fs.existsSync(path.join(outbox,replacement.id+'.claim')) && !notifications.some(item=>item.id===replacement.id) && notifications.length<20) notifications.push(replacement);
            }
            suppressDraft(outbox,draft,now);
            continue;
          }
        }
        if (notifications.length < 20 && !notifications.some(item=>item.id===draft.id)) notifications.push(draft);
      }
    }
    const done = extra => ({first:result.first,checkedAt:now.toISOString(),policy:POLICY,coverage:overview.coverage,...extra});
    if (digestHour === null || digestHour === undefined) return done({notifications:[...notifications,...heldDigests]});
    // A held digest goes out with its diagnosis as soon as that arrives, or without it once the hold ends.
    const ready = [];
    // Only a present, healthy row counts as healed; a missing row stays as it was announced.
    const healedNow = new Set((overview.events || []).map(eventView).filter(event=>!event.needs_attention).map(event=>event.id));
    for (const draft of heldDigests) {
      const diagnosis = readDiagnosis(folder, draft.id);
      if (diagnosis || now.getTime() >= Date.parse(draft.digest.holdUntil)) ready.push({...draft, text: digestText(draft, diagnosis, healedNow), diagnosed: !!diagnosis});
    }
    // Every other draft stays unclaimed in the outbox until the digest round, so nothing is lost meanwhile.
    if (!digestDue(result.state, now, digestHour)) return done({notifications:ready,held:notifications.length,waitingDigests:heldDigests.length-ready.length});
    result.state.digestDay = kst(now).day;
    const current = new Map((overview.events || []).map(eventView).map(event=>[event.id,{...event,incident:result.state.attentionIncidents[event.id]?.id||''}]));
    const attention = notifications.filter(item=>item.kind==='attention'), recoveries = notifications.filter(item=>item.kind==='recovery');
    const healedTitles = recoveries.flatMap(item=>item.events.map(source=>clean(current.get(source.id)?.title || source.id, 150)));
    const seen = new Map();
    for (const item of attention) for (const source of item.events) {
      const event = current.get(source.id);
      // A source missing from this round is not proof it healed; keep it as it was announced.
      if (!seen.has(source.id)) seen.set(source.id, event ? event : {id:source.id,attention_fingerprint:source.fingerprint,incident:source.incident,title:'이전에 잡힌 일 · '+source.id,detail:'이번 조회에 자료가 없습니다',needs_attention:true,notify:true});
    }
    const active = [...seen.values()].filter(event=>event.needs_attention && event.notify);
    if (active.length) {
      const base = attentionNotification(active, DIGEST_HEADING);
      const merged = {...base, digest:{day:kst(now).day, holdUntil:new Date(now.getTime()+holdMs).toISOString(),
        items:active.map(x=>({id:x.id,title:x.title,detail:x.detail})), recoveries:healedTitles}};
      merged.text = digestText(merged, null);
      const mergedPath = path.join(outbox, merged.id+'.json');
      // The same set of items gives the same id as the alert already waiting; that unsent draft becomes the digest.
      if (!fs.existsSync(path.join(outbox, merged.id+'.claim'))) writeJSON(mergedPath,{...merged,createdAt:now.toISOString()});
      // The recovery bookkeeping points at the notice that actually goes out.
      for (const event of active) if (result.state.attentionAlerted[event.id]) result.state.attentionAlerted[event.id] = {incident:event.incident,notice:merged.id};
      for (const item of notifications) if (item.id !== merged.id) suppressDraft(outbox,item,now);
    } else if (recoveries.length) {
      // Only good news: nothing to diagnose, so it goes out at once.
      const merged = recoveryNotification(recoveries.flatMap(item=>item.events.map(source=>({...source,...(current.get(source.id)||{title:source.id})}))));
      const mergedPath = path.join(outbox, merged.id+'.json');
      if (!fs.existsSync(mergedPath)) writeJSON(mergedPath,{...merged,createdAt:now.toISOString()});
      if (!fs.existsSync(path.join(outbox, merged.id+'.claim'))) ready.push(merged);
      for (const item of recoveries) if (item.id !== merged.id) suppressDraft(outbox,item,now);
    }
    writeJSON(stateFile,result.state);
    return done({notifications:ready,digest:true});
  } finally {release();}
}
module.exports={STALE_LOCK_MS,DIGEST_HOUR_KST,DIGEST_HOLD_MS,digestDue,digestDraft,digestText,readDiagnosis,plan,collect,kst,clean,writeJSON,readJSON,attentionDraft,recoveryDraft,suppressDraft,attentionNotification,recoveryNotification,awakeSince,AWAKE_GAP_MS,POLICY};
if(require.main===module) {
  const home=process.env.HERMES_HOME || path.join(process.env.LOCALAPPDATA,'hermes');
  const {readOverview}=require('./overview.cjs');
  // 코드는 운영 사본에서 돌아도 읽는 자료(트랙·카드·조사 역할·휴대폰 작업 기록의 repo_root)는 공용 작업본이다 — 작업 맡기기가 결과를
  // 공용 작업본에 반영하고 기록에 그 경로를 남긴다(10-22).
  const {공용작업본}=require('../lib/공용작업본.js');
  collect({home,root:공용작업본(path.resolve(__dirname,'../..')),readOverview,digestHour:DIGEST_HOUR_KST}).then(x=>console.log(JSON.stringify(x))).catch(()=>{console.error('SYNK monitor could not read its current sources/state.');process.exitCode=1;});
}
