#!/usr/bin/env node
'use strict';
// Deterministic "what needs me now" view and alert detail. Reads only the monitor state/outbox,
// approval notices and this chat's task receipts. No model, CLI launch, message delivery,
// shell command or record write. Diagnosis by an official CLI is deliberately not started here
// (design review 11-14 P1-2: the existing task path would integrate changes automatically).
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const status = require('./status.cjs');
const { attentionDraft } = require('./monitor.cjs');

const ALERT_TTL_MS = 7 * 24 * 60 * 60_000;
const CURRENT_TASK_MS = 7 * 24 * 60 * 60_000;
const MONITOR_STALE_MS = 30 * 60_000;
const MAX_ALERTS = 400;
const MAX_TASKS = 300;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.json$/i;
const AUTOMATION = 'runtime/synk-automation';
const plain = (value, limit) => status.plain(value, limit);
const time = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
const formatTime = value => time(value) === null ? '미확인'
  : new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) + ' KST';
// A state is usable for "now" only when its own check time is recent and not in the future.
const freshState = (state, now) => {
  const checked = time(state?.checkedAt);
  return checked !== null && checked <= now.getTime() + 60_000 && now.getTime() - checked <= MONITOR_STALE_MS;
};
const alertCode = id => /^event-[a-f0-9]{24}$/.test(id || '') ? id.slice(6, 14) : null;

function readJson(home, relative, limit = 200_000) {
  try { return JSON.parse(status.readText(home, relative, limit).content); }
  catch (error) { if (error.code === 'ENOENT') return undefined; return null; }
}
function list(home, relative) {
  try { return fs.readdirSync(status.safePath(home, relative), { withFileTypes: true }); } catch { return []; }
}
function monitorState(home) {
  const state = readJson(home, AUTOMATION + '/state.json', 4_000_000);
  const config = readJson(home, AUTOMATION + '/config.json', 400_000);
  return { state: state && typeof state === 'object' ? state : null, recipient: typeof config?.recipient === 'string' ? config.recipient : null };
}
function owner(home, userId) {
  const { recipient } = monitorState(home);
  return /^\d{1,20}$/.test(userId || '') && recipient === userId;
}
// Outbox drafts the monitor wrote, newest first, with what actually happened to each send.
function alerts(home) {
  const rows = [];
  for (const entry of list(home, AUTOMATION + '/outbox')) {
    if (!entry.isFile() || !/^event-[a-f0-9]{24}\.json$/.test(entry.name)) continue;
    let mtime = 0;
    try { mtime = fs.statSync(path.join(status.safePath(home, AUTOMATION + '/outbox'), entry.name)).mtimeMs; } catch { continue; }
    rows.push({ name: entry.name, mtime });
  }
  rows.sort((a, b) => b.mtime - a.mtime);
  return rows.slice(0, MAX_ALERTS).map(({ name }) => {
    const id = name.slice(0, -5);
    const draft = readJson(home, AUTOMATION + '/outbox/' + name, 200_000);
    const receipt = readJson(home, AUTOMATION + '/outbox/' + id + '.receipt.json', 20_000);
    let claim;
    try { claim = status.readText(home, AUTOMATION + '/outbox/' + id + '.claim', 4_000).content; } catch { claim = null; }
    let suppressed = false;
    if (claim !== null) { try { suppressed = JSON.parse(claim).status === 'suppressed'; } catch { suppressed = false; } }
    const delivery = claim === null ? 'not_sent' : suppressed || receipt?.status === 'suppressed' ? 'suppressed'
      : receipt?.status === 'sent' ? 'sent' : 'unconfirmed';
    return { id, code: alertCode(id), draft: attentionDraft(draft) ? draft : null, delivery,
      messageId: delivery === 'sent' && /^\d{1,24}$/.test(String(receipt?.message_id || '')) ? String(receipt.message_id) : null,
      // automation.py stamps attemptedAt before the send; with status sent it is the confirmed send's record time.
      sentAt: delivery === 'sent' && time(receipt?.attemptedAt) !== null ? receipt.attemptedAt : null };
  }).filter(row => row.draft);
}
// One rule for the list and the detail: an alert number is offered only while the detail would open it.
function openable(alert, now) {
  const created = time(alert.draft.createdAt);
  return ['sent', 'unconfirmed'].includes(alert.delivery) && created !== null && created <= now.getTime() + 60_000 && now.getTime() - created <= ALERT_TTL_MS;
}
// The kind decides where to look next. Fixed text only: nothing here is run.
function guidance(event) {
  const id = String(event.id || '');
  const task = /(?:^|-)(synk-[0-9a-f]{12})$/.exec(id)?.[1];
  if (task) return `작업 기록은 /synk_tasks ${task} 로 볼 수 있습니다.`;
  if (/^tip-intake-tip-[a-f0-9]{24}$/.test(id)) return `이 접수의 흐름은 /synk 팁 ${id.slice('tip-intake-'.length)} 로 볼 수 있습니다.`;
  if (id.startsWith('tip-')) return '팁 적용안 처리 상태는 /synk_today 에서 볼 수 있습니다. 처리 절차는 docs/참고카드/README.md 에 있습니다.';
  if (id.startsWith('backup-')) return 'PC 백업 절차는 docs/현장노트/백업_업로드.md 에 있습니다. PC에서 백업 상태 파일을 확인해 주세요.';
  if (id.startsWith('sns')) return '회사 SNS 상태는 /synk_today 에서 볼 수 있습니다. 설명은 tools/hermes-synk/README.md 의 「오늘 확인」 절에 있습니다.';
  if (id.startsWith('research-')) return '조사 예약 상태는 /synk_today 에서 볼 수 있습니다. 설명은 tools/argon-schedules/README.md 에 있습니다.';
  if (id.startsWith('gateway-')) return '게이트웨이 복구 설명은 tools/hermes-synk/runtime/README.md 에 있습니다.';
  if (id.startsWith('ops-')) return '운영 사본 상태는 PC에서 node tools/운영사본.js 로 확인할 수 있습니다.';
  return '전체 상태는 /synk_today 에서 볼 수 있습니다.';
}
function incidentRows(home, state) {
  const observed = state?.observed || {}, active = state?.attentionObserved || {};
  return Object.entries(active).filter(([id, incident]) => typeof incident === 'string' && observed[id])
    .map(([id, incident]) => ({ id, incident, kind: plain(observed[id].kind, 40), title: plain(observed[id].title, 110), detail: plain(observed[id].detail, 200) }));
}

function detailText({ home, code, messageId, userId, now = new Date(), asked = '자세히' }) {
  if (!owner(home, userId)) return { ok: false, code: 'ALERT_NOT_OWNER', text: '이 알림은 이 대화로 보낸 감시 알림이 아닙니다. 그래서 내용을 열지 않았습니다.' };
  if (code && !/^[a-f0-9]{8}$/.test(code)) return { ok: false, code: 'ALERT_CODE_INVALID', text: '알림 번호는 알림 끝에 적힌 영문과 숫자 8자입니다. 예를 들어 /synk_attention 1a2b3c4d 처럼 보내 주세요.' };
  const found = alerts(home).filter(row => code ? row.code === code : row.messageId === messageId);
  if (found.length !== 1) return { ok: false, code: found.length ? 'ALERT_AMBIGUOUS' : 'ALERT_NOT_FOUND',
    text: found.length ? '같은 번호를 가진 알림이 여러 개입니다. 그래서 하나를 고르지 않았습니다. 지금 목록은 /synk_attention 으로 볼 수 있습니다.'
      : '이 번호의 감시 알림을 찾지 못했습니다. 지금 목록은 /synk_attention 으로 볼 수 있습니다.' };
  const alert = found[0];
  if (!['sent', 'unconfirmed'].includes(alert.delivery)) return { ok: false, code: 'ALERT_NOT_DELIVERED', text: '이 번호의 알림은 보내지 않고 접어 둔 알림입니다. 지금 목록은 /synk_attention 으로 볼 수 있습니다.' };
  if (!openable(alert, now)) return { ok: false, code: 'ALERT_EXPIRED',
    text: `알림 ${alert.code}는 만든 지 7일이 지났습니다. 그래서 이 번호로는 더 열지 않습니다. 지금 상황은 /synk_attention 으로 볼 수 있습니다.` };
  const { state } = monitorState(home);
  if (!state) return { ok: false, code: 'MONITOR_STATE_UNAVAILABLE', text: '감시 기록을 읽지 못했습니다. 그래서 알림 상태를 확인하지 않았습니다. 사건이 끝났거나 풀렸다고 판단하지도 않았습니다.' };
  const lines = [`SYNK 알림 ${alert.code}`, `알림 초안은 ${formatTime(alert.draft.createdAt)}에 만들었습니다.`];
  if (alert.delivery === 'sent') {
    lines.push('텔레그램이 이 알림을 받았다는 발송 기록이 있습니다.');
    lines.push(alert.sentAt ? `발송 기록에 적힌 시각은 ${formatTime(alert.sentAt)}입니다.` : '발송 기록에는 시각이 적혀 있지 않습니다.');
  } else lines.push('이 알림은 발송을 시도했지만 텔레그램이 받았는지는 미확인입니다.');
  const stale = !freshState(state, now);
  lines.push(`감시가 마지막으로 확인한 때는 ${formatTime(state.checkedAt)}입니다.`);
  if (stale) lines.push('이 감시 기록은 오래됐거나 시각이 맞지 않습니다. 그래서 지금 상태는 미확인입니다.');
  // Classify every event in the stored alert; only the display is limited to 8.
  // Resolution needs a positive healthy observation of the same source in a fresh state.
  // A missing record, a partial state or an old/future check is never read as resolved.
  const rows = alert.draft.events.map(event => {
    const seen = state.observed?.[event.id];
    const current = state.attentionObserved?.[event.id];
    if (current === event.incident) return { event, seen, kind: 'open', label: stale ? '마지막 감시 때는 열려 있었습니다. 지금 상태는 미확인입니다.' : '이 사건은 지금도 열려 있습니다.' };
    if (current) return { event, seen, kind: 'unknown', label: '같은 곳에서 새 사건이 생겼습니다. 지금 목록에서 확인해 주세요.' };
    if (seen && seen.needs_attention === false && !stale) return { event, seen, kind: 'healthy', label: '최근 감시에서 정상 기록을 확인했습니다. 지금은 판단할 일이 아닙니다.' };
    return { event, seen, kind: 'unknown', label: seen && seen.needs_attention === false ? '마지막 정상 기록이 오래됐습니다. 지금 상태는 미확인입니다.' : '지금 상태를 보여 줄 감시 기록이 없습니다. 그래서 풀렸다고 보지 않았습니다.' };
  });
  const count = kind => rows.filter(row => row.kind === kind).length;
  const open = count('open'), healthy = count('healthy'), unknown = count('unknown');
  rows.slice(0, 8).forEach(({ event, seen, label }, index) => {
    lines.push('', `${index + 1}. ${plain(seen?.title || event.id, 110)}`);
    if (seen?.detail) lines.push('   ' + plain(seen.detail, 220));
    lines.push('   ' + label);
    lines.push('   ' + guidance(event));
  });
  const hidden = rows.slice(8);
  if (hidden.length) {
    const sentence = { open: n => `그중 ${n}건은 아직 열려 있습니다.`, unknown: n => `그중 ${n}건은 지금 상태가 미확인입니다.`, healthy: n => `그중 ${n}건은 정상 기록이 있습니다.` };
    lines.push('', `화면에 싣지 못한 사건이 ${hidden.length}건 더 있습니다.`);
    for (const kind of ['open', 'unknown', 'healthy']) { const n = hidden.filter(row => row.kind === kind).length; if (n) lines.push(sentence[kind](n)); }
    lines.push('전체 목록은 /synk_attention 으로 볼 수 있습니다.');
  }
  lines.push('');
  if (asked === '진단') lines.push('위 상태와 설명은 감시가 실제로 모은 기록입니다.', '원인은 사건마다 적어 둔 확인할 곳에서 볼 수 있습니다.', '고칠 일을 맡기려면 /synk_claude 로 요청해 주세요.');
  if (!open && !unknown && rows.length && healthy === rows.length) lines.push('이 알림의 사건은 최근 감시에서 모두 정상으로 기록됐습니다.');
  lines.push('이번 답은 감시 기록을 읽기만 했습니다. 아무것도 바꾸거나 실행하지 않았습니다.');
  return { ok: true, code: alert.code, open, healthy, unknown, stale, text: lines.join('\n').slice(0, 3900) };
}

// Reads the newest MAX_TASKS task records by request.json time (metadata only for the rest).
// `settled` holds only tasks that were actually read, owned and found not current; only those may
// drop a monitor incident. Anything unread (over the bound, unreadable, odd) keeps its incident.
function taskRows(home, userId, now) {
  const current = [], running = [], uncertain = [], settled = new Set();
  let old = 0, failed = 0, unreadable = 0;
  const entries = [];
  let folder = null;
  try { folder = status.safePath(home, 'runtime/synk-tasks'); } catch { /* no task folder */ }
  for (const entry of list(home, 'runtime/synk-tasks')) {
    if (!/^synk-[0-9a-f]{12}$/.test(entry.name)) continue;
    if (!entry.isDirectory() || !folder) { unreadable++; continue; }
    let mtime;
    try { mtime = fs.statSync(path.join(folder, entry.name, 'request.json')).mtimeMs; } catch { unreadable++; continue; }
    entries.push({ name: entry.name, mtime });
  }
  entries.sort((a, b) => b.mtime - a.mtime || b.name.localeCompare(a.name));
  const beyond = Math.max(0, entries.length - MAX_TASKS);
  for (const { name } of entries.slice(0, MAX_TASKS)) {
    const record = readJson(home, 'runtime/synk-tasks/' + name + '/request.json', 200_000);
    if (!record || typeof record !== 'object' || record.id !== name) { unreadable++; continue; }
    if (record.route?.user_id !== userId || record.route?.chat_id !== userId) continue;
    const created = time(record.created_at);
    const recent = created !== null && now.getTime() - created <= CURRENT_TASK_MS;
    if (record.state === 'closed_by_user') { settled.add(name); continue; }
    if (record.state === 'launch_failed') { failed++; settled.add(name); continue; }
    if (record.state === 'unknown') { uncertain.push(record); continue; }
    if (['preparing', 'launching', 'running', 'finalizing'].includes(record.state)) { running.push(record); continue; }
    if (record.finalization_state === 'attention') { if (recent) current.push(record); else { old++; settled.add(name); } }
    else settled.add(name);
  }
  const byTime = (a, b) => String(b.created_at).localeCompare(String(a.created_at));
  return { current: current.sort(byTime), running: running.sort(byTime), uncertain: uncertain.sort(byTime), old, failed, settled, beyond, unreadable,
    complete: beyond === 0 && unreadable === 0 };
}
function approvalRows(home, now) {
  let expired = 0;
  const active = [];
  for (const entry of list(home, 'runtime/synk-approvals')) {
    if (!entry.isFile() || !UUID.test(entry.name)) continue;
    const record = readJson(home, 'runtime/synk-approvals/' + entry.name, 200_000);
    if (!record || !['notified', 'notify_failed'].includes(record.state)) continue;
    const sent = time(record.notice?.sent_at || record.updated_at);
    if (sent === null || now.getTime() - sent > ALERT_TTL_MS) { expired++; continue; }
    active.push({ what: plain(record.notice?.what || '막힌 단계', 100), sentAt: record.notice?.sent_at || record.updated_at, failed: record.state === 'notify_failed' });
  }
  return { active: active.sort((a, b) => String(b.sentAt).localeCompare(String(a.sentAt))), expired };
}

function attentionView({ home, userId, now = new Date() }) {
  if (!owner(home, userId)) return { ok: false, text: '판단 대기 목록은 감시 알림을 받는 등록된 대화에서만 볼 수 있습니다.' };
  const { state } = monitorState(home);
  const lines = [`SYNK 지금 판단이 필요한 일 (${formatTime(now.toISOString())} 기준)`];
  const tasks = taskRows(home, userId, now);
  let incidents = [], viewStale = true;
  if (!state) lines.push('', '감시 기록을 읽지 못했습니다. 사건이 없다는 뜻은 아닙니다.');
  else {
    const stale = !freshState(state, now);
    viewStale = stale;
    // Newest alert first; an expired or undelivered alert is remembered only to explain the missing number.
    const codes = new Map(), expired = new Set();
    for (const alert of alerts(home)) {
      if (!['sent', 'unconfirmed'].includes(alert.delivery)) continue;
      for (const event of alert.draft.events) {
        if (openable(alert, now)) { if (!codes.has(event.incident)) codes.set(event.incident, alert.code); }
        else expired.add(event.incident);
      }
    }
    // A task-shaped incident is dropped only when its task record was read and found settled.
    incidents = incidentRows(home, state).filter(row => {
      const task = /(?:^|-)(synk-[0-9a-f]{12})$/.exec(row.id)?.[1];
      return !task || !tasks.settled.has(task);
    });
    lines.push('', `감시가 잡은 사건은 ${incidents.length}건입니다.`);
    if (stale) lines.push(`감시가 마지막으로 확인한 때는 ${formatTime(state.checkedAt)}입니다. 이 기록은 오래됐거나 시각이 맞지 않아 지금 상태는 미확인입니다.`);
    incidents.slice(0, 8).forEach((row, index) => {
      const code = codes.get(row.incident);
      lines.push(`${index + 1}. ${row.title}`);
      if (row.detail) lines.push('   ' + row.detail);
      if (code) lines.push(`   알림 번호는 ${code}입니다. 자세한 내용은 /synk_attention ${code} 로 볼 수 있습니다.`);
      else {
        lines.push(stale ? '   마지막 감시 때 이 사건은 열려 있었습니다. 지금 상태는 미확인입니다.' : '   최근 감시에서 이 사건은 열려 있습니다.');
        lines.push(expired.has(row.incident) ? '   이 사건에 연결된 알림은 만든 지 7일이 지나서 번호로 열 수 없습니다.' : '   이 사건은 알림 없이 기록만 됐습니다.');
      }
      lines.push('   ' + guidance(row));
    });
    if (incidents.length > 8) lines.push(`그 밖에 사건이 ${incidents.length - 8}건 더 있습니다. 전체는 /synk_today 에서 볼 수 있습니다.`);
  }
  const approvals = approvalRows(home, now);
  if (approvals.active.length) {
    lines.push('', `자동 모드에 막혀 이어 가기를 기다리는 단계가 ${approvals.active.length}건 있습니다.`, '그 알림에 답장하거나 /synk_continue <문장> 으로 이어 갈 수 있습니다.');
    for (const row of approvals.active.slice(0, 4)) lines.push(`- ${row.what} (${formatTime(row.sentAt)}에 알림)${row.failed ? ' 이 알림이 전달됐는지는 미확인입니다.' : ''}`);
  }
  if (tasks.current.length) {
    lines.push('', `맡긴 작업 가운데 판단을 기다리는 작업이 ${tasks.current.length}건 있습니다.`);
    for (const row of tasks.current.slice(0, 4)) lines.push(`- ${row.id} 작업의 확인 코드는 ${/^[A-Z][A-Z0-9_]{0,79}$/.test(row.attention_reason || '') ? row.attention_reason : 'CHECK_REQUIRED'}입니다. 자세한 내용은 /synk_tasks ${row.id} 로 볼 수 있습니다.`);
  }
  for (const row of tasks.uncertain.slice(0, 3)) lines.push('', `${row.id} 작업은 실행 상태가 미확인입니다. PC에서 끝난 것을 확인한 뒤 /synk_release ${row.id} 종료확인 을 보내 주세요.`);
  for (const row of tasks.running.slice(0, 2)) lines.push('', `${row.id} 작업이 진행 중입니다. 상태는 /synk_tasks ${row.id} 로 볼 수 있습니다.`);
  if (tasks.beyond) lines.push('', `작업 기록은 최근 ${MAX_TASKS}건까지만 읽었습니다. 더 오래된 작업 기록 ${tasks.beyond}건은 확인하지 않았습니다.`);
  if (tasks.unreadable) { if (!tasks.beyond) lines.push(''); lines.push(`읽지 못한 작업 기록이 ${tasks.unreadable}건 있습니다.`); }
  const nothing = !incidents.length && !approvals.active.length && !tasks.current.length && !tasks.uncertain.length;
  if (nothing && state && !viewStale && tasks.complete) lines.push('', '지금 판단이 필요한 일은 없습니다.');
  else if (nothing && state && !tasks.complete) lines.push('', '확인하지 못한 작업 기록이 있어서 판단할 일이 없는지는 미확인입니다.');
  else if (nothing && state) lines.push('', '감시 기록이 오래됐습니다. 그래서 지금 판단할 일이 없는지는 미확인입니다.');
  const past = [tasks.old ? `7일이 넘은 작업 판단 대기가 ${tasks.old}건 있습니다.` : '', tasks.failed ? `시작에 실패한 작업 기록이 ${tasks.failed}건 있습니다.` : '',
    approvals.expired ? `기한이 지난 이어 가기가 ${approvals.expired}건 있습니다.` : ''].filter(Boolean);
  if (past.length) lines.push('', '지난 기록은 현재 할 일에서 뺐습니다.', ...past, '지난 기록은 /synk_tasks 로 볼 수 있습니다.');
  lines.push('', '이번 답은 기록을 읽기만 했습니다. 아무것도 실행하거나 바꾸지 않았습니다.');
  let text = lines.join('\n');
  if (text.length > 3900) text = text.slice(0, 3780) + '\n글이 길어 일부를 생략했습니다. 전체는 /synk_today 에서 볼 수 있습니다.';
  return { ok: true, text };
}

function main(argv = process.argv.slice(2)) {
  const home = process.env.HERMES_HOME || path.join(process.env.LOCALAPPDATA || os.homedir(), 'hermes');
  const [command, ...rest] = argv;
  const user = rest.length >= 2 && rest.at(-2) === '--user' ? rest.at(-1) : null;
  if (!user || !/^\d{1,20}$/.test(user)) throw new Error('ARGS');
  if (command === 'view' && rest.length === 2) return attentionView({ home, userId: user });
  if (command === 'alert' && (rest.length === 3 || rest.length === 4) && ['자세히', '진단', undefined].includes(rest.length === 4 ? rest[1] : undefined))
    return detailText({ home, code: rest[0], userId: user, asked: rest.length === 4 ? rest[1] : '자세히' });
  throw new Error('ARGS');
}
module.exports = { attentionView, detailText, alerts, alertCode, guidance, openable, ALERT_TTL_MS, CURRENT_TASK_MS, MAX_TASKS };
if (require.main === module) {
  try { process.stdout.write(main().text + '\n'); }
  catch { process.stderr.write('ATTENTION_VIEW_UNAVAILABLE\n'); process.exitCode = 1; }
}
