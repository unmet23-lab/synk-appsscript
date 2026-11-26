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
// 열쇠 표식(access_token · refresh_token · api_key · password 뒤 : 또는 =)마다 표식부터 그 값이 시작한 줄 끝까지의 자리.
// 값에 빈칸이 들어도 꼬리가 남지 않는다(GPT alert-fix-20261126-r10 GA3). 앞 표식의 자리 안에 든 표식도 따로 센다 — 뒤 표식의 값은
// 다음 줄에 있을 수 있다(r11 GA1). 줄 끝은 앞으로만 찾는다 — 표식이 많아도 글 길이에 비례한다(r12 GA2).
function secretSpans(value) {
  const text = String(value || ''), spans = [], key = /(?:access_token|refresh_token|api_key|password)\s*[:=]\s*/gi, nl = /[\r\n]/g;
  let lineEnd = -1;
  for (let m = key.exec(text); m; m = key.exec(text)) {
    const from = m.index + m[0].length;
    if (lineEnd < from) { nl.lastIndex = from; const n = nl.exec(text); lineEnd = n ? n.index : text.length; }
    spans.push([m.index, lineEnd]);
    key.lastIndex = m.index + 1;
  }
  return spans;
}
// 가릴 자리들 — 열쇠 · 토큰 · 메일을 모두 원문에서 찾는다. 한 꼴을 먼저 바꾸면 그 자리가 다른 꼴의 일부를 잘라 나머지가 남는다
// (메일 끝의 password: 따위, r12 GA1). 알림 고침의 다듬기도 이 자리에 경로 자리를 더해 쓴다.
// 메일은 끝 경계 없이 가장 길게 잡는다 — 바로 뒤에 글자(api_key= 따위)가 붙어도 놓치지 않는다(r13 GA1). 시작은 이어진 글자의 맨 앞에서만 본다 —
// 긴 값에서도 글 길이에 비례한다(r13 GA2).
const MASK_RANK = {'[인증값]': 4, '[계정]': 3, '<집>': 2, '<이름>': 1};
function privateSpans(value) {
  const text = String(value || ''), spans = secretSpans(text).map(([from, to]) => [from, to, '[인증값]']);
  for (const m of text.matchAll(/\b(?:sk-|ghp_|gho_|xoxb-)[A-Za-z0-9_-]+/g)) spans.push([m.index, m.index + m[0].length, '[인증값]']);
  for (const m of text.matchAll(/(?<![A-Z0-9._%+-])[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)) spans.push([m.index, m.index + m[0].length, '[계정]']);
  return spans;
}
// 찾은 자리를 ~로 지운 글에서 다시 찾기를 새 자리가 없을 때까지 되풀이한다 — 맞닿은 꼴이 단어 경계를 가려 못 찾던 꼴도 찾는다(r13 GA1).
// ~는 단어 글자가 아니고(경계가 생긴다) UNC 앞 글자로도 치지 않는다. 여덟 번을 넘기면 글 전체를 가린다.
function collectSpans(value, finders) {
  const text = String(value || ''), spans = [], seen = new Set();
  let view = text;
  for (let pass = 0; pass < 8; pass++) {
    let grew = false;
    for (const find of finders) for (const [from, to, label] of find(view)) {
      const key = `${from}:${to}:${label}`;
      if (to > from && !seen.has(key)) { seen.add(key); spans.push([from, to, label]); grew = true; }
    }
    if (!grew) return spans;
    // 겹친 자리는 한 번만 지운다 — 한 줄에 표식이 많아도 글 길이에 비례한다
    const chars = text.split('');
    let reach = 0;
    for (const [from, to] of spans.map(([a, b]) => [a, b]).sort((a, b) => a[0] - b[0])) {
      for (let i = Math.max(from, reach); i < to; i++) if (chars[i] !== '\r' && chars[i] !== '\n') chars[i] = '~';
      reach = Math.max(reach, to);
    }
    view = chars.join('');
  }
  return text ? [[0, text.length, '[인증값]']] : [];
}
// 겹친 자리를 하나로 합쳐 가장 센 표(열쇠 > 메일 > 집 > 이름)로 바꾼다
function maskSpans(value, spans) {
  const text = String(value || ''), sorted = spans.filter(([from, to]) => to > from).sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  let out = '', end = 0;
  for (let i = 0; i < sorted.length;) {
    let [from, to, label] = sorted[i], j = i + 1;
    for (; j < sorted.length && sorted[j][0] < to; j++) {
      to = Math.max(to, sorted[j][1]);
      if ((MASK_RANK[sorted[j][2]] || 0) > (MASK_RANK[label] || 0)) label = sorted[j][2];
    }
    out += text.slice(end, from) + label;
    end = to;
    i = j;
  }
  return out + text.slice(end);
}
function clean(value, max = 220) {
  const text = String(value || '');
  return maskSpans(text, collectSpans(text, [privateSpans])).replace(/MEDIA:/g, 'MEDIA :').replace(/\[\[(?:as_document|audio_as_voice)\]\]/g, '').slice(0, max);
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
  // A newer alert of the same source may still wait for its digest, or be withdrawn, after an older one was read: `heard` keeps that one.
  const told = id => { const value = state.attentionAlerted[id]; return typeof value === 'string' ? {incident:value} : value || null; };
  const heard = id => [told(id), told(id)?.heard].find(value => value && (!value.notice || sent(value.notice))) || null;
  const healed = first ? [] : events.filter(x => !x.needs_attention && x.notify_recovery && told(x.id));
  const recovered = healed.filter(x => heard(x.id)).map(x => ({...x,incident:heard(x.id).incident,notice:heard(x.id).notice}));
  const alert = urgent.length ? attentionNotification(urgent) : null;
  for (const event of urgent) if (event.notify_recovery) {
    const before = heard(event.id);
    state.attentionAlerted[event.id] = {incident:event.incident,notice:alert.id,...(before ? {heard:{incident:before.incident,notice:before.notice}} : {})};
  }
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
// 11-25 유호님 「너무 알림이 잦아서 10/1토막 내던지 특정 시간에 한번만 몰아서 보고해줘」: drafts wait in the outbox and one message a
// day tells what is still open. The hour, the hold and the diagnosis are Claude's choices, not yet confirmed (README 「하루 한 번 무음 묶음」).
// One message per KST day by construction: the digest id is made from the day, and the sender's claim file lets an id out once.
// The drafts stay in the outbox until that claim exists. A crash, a sleeping PC or a changed set of events only means that a later
// round composes the message again from the drafts still waiting; nothing is carried over from a digest that was not sent.
// The first round at or after DIGEST_HOUR_KST leaves diagnosis/request.json for the credit job 「알림해결」 (tools/크레딧작업/알림해결.js)
// and waits up to DIGEST_HOLD_MS for diagnosis/<digest id>.json. Nothing is composed after DIGEST_LAST_HOUR_KST, so a round
// cannot cross midnight between composing and sending.
const DIGEST_HOUR_KST = 9;
const DIGEST_LAST_HOUR_KST = 23;
const DIGEST_HOLD_MS = 120 * 60_000;
const DIGEST_HEADING = 'SYNK · 오늘 확인할 일';
const digestId = day => 'event-' + hash([POLICY, 'digest', day]).slice(0, 24);
const DIAGNOSIS_STATES = new Set(['유호님 차례', '확인 필요']);
function readDiagnosis(folder, id) {
  let value;
  // An unreadable diagnosis must not stop the collector; the digest then goes out without it.
  try { value = readJSON(path.join(folder, 'diagnosis', id + '.json'), null); } catch { return null; }
  if (!value || value.id !== id || !Array.isArray(value.items)) return null;
  return {items: value.items.slice(0, 20).filter(x => x && typeof x.id === 'string').map(x => ({id: clean(x.id, 180), incident: clean(x['사건'], 60),
    cause: clean(x['원인'], 200), fix: clean(x['해결'], 260), state: DIAGNOSIS_STATES.has(x['상태']) ? x['상태'] : '확인 필요'})),
    note: clean(value.note, 240)};
}
// automation.py sends the first 3400 characters. The alert number at the end is reserved first; then whole items are added while
// they fit, shortened to their title when the diagnosis does not fit, and counted as 「그 밖에」 when even the title does not.
const DIGEST_LIMIT = 3300;
// An AI fix (tools/크레딧작업/알림고침.js) is told before the items, outside their six-line cap, from its record: what the AI says about
// before and after, kept apart from what the machine measured.
function fixReports(folder, items) {
  const out = new Map();
  for (const x of items) {
    // The stop row has no record: it is told as its own line, never as an item waiting for a diagnosis.
    if (x.id === 'fix-stopped') { out.set(x.id, x.title + (x.detail ? '\n  ' + x.detail : '')); continue; }
    const rid = String(x.id).startsWith('fix-') ? String(x.id).slice(4) : '';
    if (!/^\d{12}-[0-9a-f]{6}$/.test(rid)) continue;
    let r = null;
    try { r = readJSON(path.join(folder, 'fixes', rid, '기록.json'), null); } catch { r = null; }
    if (!r || r.version !== 1) continue;
    const n = v => Number.isSafeInteger(v) && v >= 0 ? v : null;
    // What the AI wrote goes out as one line without links, even if the record was written by hand.
    const said = (v, max) => clean(String(v || '').replace(/https?:\/\/\S+/gi, '').replace(/\s+/g, ' ').trim(), max);
    if (r.상태 === '올림') {
      const short = /^[0-9a-f]{40}$/.test(r.커밋 || '') ? r.커밋.slice(0, 8) : '';
      const 전새 = r.전새 || {}, 후 = r.후시험 || {}, 셈 = r.셈 || {}, 검 = r.검수?.셈 || {};
      const p01 = n(검.P0) !== null && n(검.P1) !== null ? n(검.P0) + n(검.P1) : '?';
      // The AI's words carry 「(AI 설명)」 on their own lines; the measured line holds only counts and the commit.
      out.set(x.id, ['AI가 고쳐 올렸어요 · ' + said(r.제목, 120),
        '  전에는: ' + said(r.전, 160) + ' → 이제는: ' + said(r.후, 160) + ' (AI 설명)',
        '  바꾼 것: ' + said(r.무엇, 160) + ' (AI 설명)',
        '  잰 것: 새 시험 ' + (n(전새.시험) ?? '?') + '개가 고치기 전 ' + (n(전새.실패) ?? '?') + '개 실패, 고친 뒤 ' + (n(후.통과) ?? '?') + '/' + (n(후.시험) ?? '?') + ' 통과 · GPT 검수 P0·P1 ' + p01 + '건'
          + (n(검.P2) ? ' · P2 ' + n(검.P2) + '건' : '') + ' · 파일 ' + (n(셈.파일) ?? '?') + '개(+' + (n(셈.더함) ?? '?') + ' −' + (n(셈.뺌) ?? '?') + ')' + (short ? ' · 커밋 ' + short : ''),
        ...(r.바이트같음 === false ? ['  올라간 판이 검수한 판과 달라요 — 그사이 다른 커밋과 합쳐져서 알림 고침을 멈췄어요'] : []),
        short ? '  되돌리려면 Claude 세션에 「알림 고침 ' + short + ' 되돌려」라고 말씀해 주세요.' : ''].filter(Boolean).join('\n'));
    } else out.set(x.id, 'AI가 고쳐 보았지만 올리지 않았어요 · ' + said(r.제목, 120) + '\n  까닭: ' + said(r.까닭 || (r.상태 === '끊김' ? '도중에 끊겼어요' : '미기록'), 200));
  }
  return out;
}
function digestText({id, items, recoveries = []}, diagnosis, fixes = new Map()) {
  // A diagnosis belongs to one incident; the same source failing anew since then is told without it.
  const found = x => (diagnosis?.items || []).find(y => y.id === x.id && y.incident === x.incident);
  const full = x => {
    const y = found(x);
    return '\n- ' + x.title + (x.detail ? '\n  ' + x.detail : '')
      + (y ? (y.cause ? '\n  원인: ' + y.cause : '') + (y.fix ? '\n  해결: ' + y.fix : '') + (y.state === '유호님 차례' ? '\n  → 유호님 차례' : '') : '');
  };
  const code = id.slice(6, 14);
  const told = items.filter(x => fixes.has(x.id)), rest = items.filter(x => !fixes.has(x.id));
  const tail = (recoveries.length ? '\n\n풀린 일\n' + recoveries.slice(0, 6).map(x => '- ' + x).join('\n')
      + (recoveries.length > 6 ? '\n그 밖에 ' + (recoveries.length - 6) + '건' : '') : '')
    // The note speaks about the diagnosed items; without any of them here it would explain something else.
    + (diagnosis ? (diagnosis.note && (!diagnosis.items.length || rest.some(found)) ? '\n\n' + diagnosis.note : '') : rest.length ? '\n\n원인 진단은 이번에 오지 않았어요.' : '')
    + '\n\n이 알림의 번호는 ' + code + '입니다. 자세한 내용은 /synk_attention ' + code + ' 로 볼 수 있습니다.\n이 알림에 「자세히」라고 답장해도 됩니다.';
  const room = DIGEST_LIMIT - tail.length - 60; // 60: the 「그 밖에 N건」 line
  let body = DIGEST_HEADING, shown = 0;
  for (const x of told) body += '\n- ' + fixes.get(x.id);
  for (const x of rest.slice(0, 6)) {
    const line = [full(x), '\n- ' + x.title].find(text => body.length + text.length <= room);
    if (!line) break;
    body += line; shown++;
  }
  return body + (rest.length > shown ? '\n그 밖에 ' + (rest.length - shown) + '건 · /synk_today 에서 전체 확인' : '') + tail;
}
// A source missing from this round is not proof it healed: it stays as its draft announced it.
const unseen = source => ({id: source.id, attention_fingerprint: source.fingerprint, incident: source.incident,
  title: '이전에 잡힌 일 · ' + source.id, detail: '이번 조회에 자료가 없습니다', needs_attention: true, notify: true});
// What today's message would say right now, from the drafts that are still waiting and this round's rows.
function composeDigest(drafts, overview, state) {
  const current = new Map((overview.events || []).map(eventView).map(event => [event.id, {...event, incident: state.attentionIncidents[event.id]?.id || ''}]));
  const open = new Map(), healed = new Map();
  for (const draft of drafts) for (const source of draft.events) {
    const row = current.get(source.id);
    if (draft.kind === 'recovery') healed.set(source.id, {id: source.id, incident: source.incident, notice: source.notice,
      title: clean(row?.title || source.id, 150), detail: clean(row?.detail, 240)});
    else open.set(source.id, row || unseen(source)); // the newest draft of a missing source stands
  }
  const active = [...open.values()].filter(event => event.needs_attention && event.notify);
  return {active, healed: [...healed.values()].filter(x => !active.some(event => event.id === x.id)), absorbed: drafts.map(draft => draft.id)};
}
// The drafts a digest told leave the outbox only once the sender has claimed that digest.
function settleDigest(state, outbox, now, today) {
  // The first 11-25 version kept only the day of the finished round.
  if (!state.digest && state.digestDay) state.digest = {day: state.digestDay, id: digestId(state.digestDay), status: 'done'};
  delete state.digestDay;
  const settle = digest => {
    for (const id of readJSON(path.join(outbox, digest.id + '.json'), null)?.digest?.absorbed || []) suppressDraft(outbox, {id}, now);
    state.digest = {day: digest.day, id: digest.id, status: 'done'};
  };
  if (state.digest?.status === 'sending' && delivered(outbox, state.digest.id)) settle(state.digest);
  // The state can be older than the sender's claim (a killed collector). The claim decides.
  if (!(state.digest?.day === today && state.digest.status === 'done') && delivered(outbox, digestId(today))) settle({day: today, id: digestId(today)});
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
    const outbox=path.join(folder,'outbox');
    const bundling = digestHour !== null && digestHour !== undefined, today = kst(now).day;
    const rows = new Map((overview.events || []).map(eventView).map(event=>[event.id,event]));
    for(const item of result.notifications) {
      // A digest names recoveries one by one, so in digest mode each source waits in a draft of its own.
      const drafts = bundling && item.kind==='recovery' ? item.events.map(source=>recoveryNotification([{...rows.get(source.id),...source}])) : [item];
      for(const draft of drafts) {
        const output=path.join(outbox,draft.id+'.json');
        if(!fs.existsSync(output)) writeJSON(output,{...draft,createdAt:now.toISOString()});
      }
    }
    if (bundling) settleDigest(result.state, outbox, now, today); // repeatable, so it may precede the state
    // Outbox precedes cursor commit: a crash can repeat preparation, never lose its draft.
    writeJSON(stateFile,result.state);
    const drafts=fs.existsSync(outbox)?fs.readdirSync(outbox)
      .filter(x=>/^(?:event-[a-f0-9]{24}|daily-\d{4}-\d{2}-\d{2})\.json$/.test(x))
      .filter(x=>!fs.existsSync(path.join(outbox,x.slice(0,-5)+'.claim')))
      .map(x=>readJSON(path.join(outbox,x),null)).filter(Boolean)
      .sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt))):[];
    // Immediate alerts keep their per-round cap. A digest must see every waiting draft, or the 21st open item is never reported.
    const cap = bundling ? Infinity : 20, notifications=[];
    for (const draft of drafts) {
      // A composed digest is only ever offered to the sender by the round that composed it; its drafts are here too.
      if (draft.digest?.version === 2) continue;
      if (recoveryDraft(draft)) {
        // A queued recovery must not arrive after the same source broke again.
        const broken = new Set((overview.events || []).map(eventView).filter(event=>event.needs_attention).map(event=>event.id));
        const again = draft.events.some(source=>broken.has(source.id));
        // Nor may it announce something nobody heard about: every source's alert must have actually gone out.
        const heard = draft.events.every(source=>!source.notice || delivered(outbox,source.notice));
        // Waiting for a digest, a source that broke again keeps its untold recovery until it heals or until the newer alert was told:
        // that alert may be withdrawn before anyone reads it, and then this recovery is still the one to tell.
        const replaced = again && draft.events.every(source=>{
          const newer = result.state.attentionAlerted[source.id];
          return newer?.notice && newer.incident!==source.incident && delivered(outbox,newer.notice);
        });
        if (!heard || replaced || again && !bundling) suppressDraft(outbox,draft,now);
        else if (!again && notifications.length<cap) notifications.push(draft);
        continue;
      }
      if (!attentionDraft(draft)) suppressDraft(outbox,draft,now);
      else {
        const current = new Map((overview.events || []).map(eventView).map(event=>[event.id,{...event,incident:result.state.attentionIncidents[event.id]?.id||''}]));
        const sources = draft.events.map(source=>current.get(source.id));
        // Only positive, current resolution may retire a queued attention item.
        // Missing records still do not imply success or deletion.
        // A waiting digest draft is narrowed source by source: one seen healthy leaves at once, one that failed anew has a newer draft,
        // a missing one stays. Alone, a draft's text names all its sources, so it is narrowed only when every one is in the round.
        if (bundling || sources.every(Boolean)) {
          const active = (bundling ? draft.events.map((source,i)=>sources[i] ? sources[i].incident===source.incident && sources[i] : unseen(source)) : sources)
            .filter(event=>event && event.needs_attention && event.notify);
          const replacement = active.length ? attentionNotification(active) : null;
          // An id already used cannot carry this alert again; then the draft itself stays and the digest reads the current rows.
          const used = bundling && replacement && replacement.id !== draft.id && fs.existsSync(path.join(outbox,replacement.id+'.claim'));
          if (!replacement || replacement.id !== draft.id && !used) {
            if (replacement) {
              const replacementPath=path.join(outbox,replacement.id+'.json');
              if(!fs.existsSync(replacementPath)) writeJSON(replacementPath,{...replacement,createdAt:now.toISOString()});
              if(!fs.existsSync(path.join(outbox,replacement.id+'.claim')) && !notifications.some(item=>item.id===replacement.id) && notifications.length<cap) notifications.push(replacement);
            }
            suppressDraft(outbox,draft,now);
            continue;
          }
        }
        if (notifications.length<cap && !notifications.some(item=>item.id===draft.id)) notifications.push(draft);
      }
    }
    const done = extra => ({first:result.first,checkedAt:now.toISOString(),policy:POLICY,coverage:overview.coverage,...extra});
    if (!bundling) return done({notifications});
    const id = digestId(today), hour = kst(now).hour, last = result.state.digest;
    const stage = last?.day === today ? last.status : 'none';
    const hold = extra => done({notifications:[],held:notifications.length,...extra});
    if (hour < digestHour || hour >= DIGEST_LAST_HOUR_KST || stage === 'done') return hold();
    const {active, healed, absorbed} = composeDigest(notifications, overview, result.state);
    const save = (status, extra) => { result.state.digest = {day:today,id,status,...extra}; writeJSON(stateFile,result.state); };
    // Nothing to tell: today's round is over, and whatever comes later waits for tomorrow.
    if (!active.length && !healed.length) { save('done'); return hold({digest:true}); }
    // AI fix reports (fix-*) are told, never diagnosed: with only those there is nothing to wait for.
    const asked = active.filter(x => !String(x.id).startsWith('fix-'));
    const diagnosis = asked.length ? readDiagnosis(folder, id) : null;
    // Ask for a diagnosis once a day. After a day that ended without its message, do not wait again.
    if (asked.length && stage === 'none' && !(last && last.status !== 'done')) {
      const holdUntil = new Date(now.getTime() + holdMs).toISOString();
      writeJSON(path.join(folder,'diagnosis','request.json'),{version:1,id,day:today,createdAt:now.toISOString(),holdUntil,
        items:asked.map(x=>({id:x.id,incident:x.incident,title:x.title,detail:x.detail})),recoveries:healed.map(x=>x.title)});
      save('waiting',{holdUntil});
      return hold({waiting:true});
    }
    if (asked.length && stage === 'waiting' && !diagnosis && now.getTime() < Date.parse(last.holdUntil)) return hold({waiting:true});
    const digest = {version:2,day:today,items:active.map(x=>({id:x.id,incident:x.incident,title:x.title,detail:x.detail})),recoveries:healed.map(x=>x.title),
      healed:healed.map(x=>({id:x.id,incident:x.incident})),absorbed};
    const item = {...(active.length ? attentionNotification(active, DIGEST_HEADING) : recoveryNotification(healed)), id, digest};
    if (active.length) item.text = digestText({id,...digest}, diagnosis, fixReports(folder, active));
    // The recovery bookkeeping points at the message that actually goes out.
    for (const event of active) {
      const value = result.state.attentionAlerted[event.id];
      if (value) result.state.attentionAlerted[event.id] = {...(typeof value === 'object' ? value : {}),incident:event.incident,notice:id};
    }
    writeJSON(path.join(outbox,id+'.json'),{...item,createdAt:now.toISOString()});
    save('sending');
    return done({notifications:[item],digest:true});
  } finally {release();}
}
module.exports={secretSpans,privateSpans,maskSpans,collectSpans,STALE_LOCK_MS,DIGEST_HOUR_KST,DIGEST_LAST_HOUR_KST,DIGEST_HOLD_MS,digestId,digestText,fixReports,readDiagnosis,plan,collect,kst,clean,writeJSON,readJSON,attentionDraft,recoveryDraft,suppressDraft,attentionNotification,recoveryNotification,awakeSince,AWAKE_GAP_MS,POLICY};
if(require.main===module) {
  const home=process.env.HERMES_HOME || path.join(process.env.LOCALAPPDATA,'hermes');
  const {readOverview}=require('./overview.cjs');
  // 코드는 운영 사본에서 돌아도 읽는 자료(트랙·카드·조사 역할·휴대폰 작업 기록의 repo_root)는 공용 작업본이다 — 작업 맡기기가 결과를
  // 공용 작업본에 반영하고 기록에 그 경로를 남긴다(10-22).
  const {공용작업본}=require('../lib/공용작업본.js');
  collect({home,root:공용작업본(path.resolve(__dirname,'../..')),readOverview,digestHour:DIGEST_HOUR_KST}).then(x=>console.log(JSON.stringify(x))).catch(()=>{console.error('SYNK monitor could not read its current sources/state.');process.exitCode=1;});
}
