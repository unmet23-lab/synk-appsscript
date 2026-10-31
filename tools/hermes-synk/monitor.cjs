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
function attentionNotification(events) {
  const id = 'event-' + hash([POLICY, events.map(x => [x.id, x.attention_fingerprint, x.incident || '']).sort()]).slice(0, 24);
  return {id, kind:'attention',policy:POLICY,needs_attention:true,
    events:events.map(x=>({id:x.id,fingerprint:x.attention_fingerprint,incident:x.incident||'',needs_attention:true})),
    text:'SYNK · 판단이 필요한 일\n'+events.slice(0,6).map(x=>'- '+x.title+(x.detail?'\n  '+x.detail:'')).join('\n')
      +(events.length>6?'\n그 밖에 '+(events.length-6)+'건 · /synk_today 에서 전체 확인':'')};
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
async function collect({home, root, now = new Date(), readOverview, initial = false}) {
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
    const notifications=[];
    for (const draft of drafts) {
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
    return {first:result.first,checkedAt:now.toISOString(),policy:POLICY,notifications,coverage:overview.coverage};
  } finally {release();}
}
module.exports={STALE_LOCK_MS,plan,collect,kst,clean,writeJSON,readJSON,attentionDraft,recoveryDraft,suppressDraft,attentionNotification,recoveryNotification,awakeSince,AWAKE_GAP_MS,POLICY};
if(require.main===module) {
  const home=process.env.HERMES_HOME || path.join(process.env.LOCALAPPDATA,'hermes');
  const {readOverview}=require('./overview.cjs');
  // 코드는 운영 사본에서 돌아도 읽는 자료(트랙·카드·조사 역할·휴대폰 작업 기록의 repo_root)는 공용 작업본이다 — 작업 맡기기가 결과를
  // 공용 작업본에 반영하고 기록에 그 경로를 남긴다(10-22).
  const {공용작업본}=require('../lib/공용작업본.js');
  collect({home,root:공용작업본(path.resolve(__dirname,'../..')),readOverview}).then(x=>console.log(JSON.stringify(x))).catch(()=>{console.error('SYNK monitor could not read its current sources/state.');process.exitCode=1;});
}
