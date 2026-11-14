'use strict';
// Deterministic attention view and alert detail. Generic fixtures only; no Telegram, model or CLI.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { attentionView, detailText, alertCode } = require('../tools/hermes-synk/attention.cjs');
const { attentionNotification, plan } = require('../tools/hermes-synk/monitor.cjs');

const USER = '12345';
const NOW = new Date('2026-11-14T03:00:00Z');
function home(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-attention-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (rel, value) => { const file = path.join(root, rel); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value)); return file; };
  write('runtime/synk-automation/config.json', { recipient: USER });
  return { root, write };
}
function monitorEvent(id, title, extra = {}) {
  return { id, kind: 'backup', severity: 'warning', needs_attention: true, notify: true, title, detail: title + ' 상세', fingerprint: 'f-' + id, attention_fingerprint: 'a-' + id, ...extra };
}
// Build state and outbox exactly the way monitor.plan/attentionNotification do.
function alerted(h, events, { at = NOW, delivery = 'sent', messageId = '9001' } = {}) {
  const baseline = plan(null, { events: [] }, new Date(at.getTime() - 60_000)).state;
  const result = plan(baseline, { events }, at);
  h.write('runtime/synk-automation/state.json', result.state);
  const alert = result.notifications[0];
  h.write(`runtime/synk-automation/outbox/${alert.id}.json`, { ...alert, createdAt: at.toISOString() });
  if (delivery !== 'not_sent') h.write(`runtime/synk-automation/outbox/${alert.id}.claim`, delivery === 'suppressed' ? JSON.stringify({ status: 'suppressed' }) : at.toISOString());
  if (delivery === 'sent') h.write(`runtime/synk-automation/outbox/${alert.id}.receipt.json`, { id: alert.id, status: 'sent', message_id: messageId });
  return { alert, state: result.state, code: alertCode(alert.id) };
}

test('alert text carries its stored id as a short number and the read-only command', () => {
  const alert = attentionNotification([{ id: 'backup-x', title: 'PC 백업 실패', attention_fingerprint: 'a', incident: 'i1' }]);
  assert.match(alert.text, new RegExp('이 알림의 번호는 ' + alert.id.slice(6, 14) + '입니다\\. 자세한 내용은 /synk_attention ' + alert.id.slice(6, 14) + ' 로 볼 수 있습니다\\.'));
  assert.equal(alertCode(alert.id), alert.id.slice(6, 14));
  // The id still depends only on events, never on the text.
  assert.equal(attentionNotification([{ id: 'backup-x', title: '다른 제목', attention_fingerprint: 'a', incident: 'i1' }]).id, alert.id);
});

test('detail shows the current state of each event and where to look, without changing any file', t => {
  const h = home(t);
  const { code } = alerted(h, [monitorEvent('backup-onedrive', 'PC 백업 · OneDrive 실패'), monitorEvent('task-synk-0123456789ab', 'Codex synk-0123456789ab')]);
  const before = fs.readFileSync(path.join(h.root, 'runtime/synk-automation/state.json'), 'utf8');
  const result = detailText({ home: h.root, code, userId: USER, now: NOW });
  assert.equal(result.ok, true);
  assert.equal(result.open, 2);
  assert.match(result.text, /이 사건은 지금도 열려 있습니다\./);
  assert.match(result.text, /docs\/현장노트\/백업_업로드\.md/);
  assert.match(result.text, /\/synk_tasks synk-0123456789ab/);
  assert.equal(fs.readFileSync(path.join(h.root, 'runtime/synk-automation/state.json'), 'utf8'), before);
  const asked = detailText({ home: h.root, code, userId: USER, now: NOW, asked: '진단' });
  assert.match(asked.text, /위 상태와 설명은 감시가 실제로 모은 기록입니다\./);
  assert.doesNotMatch(asked.text, /범위|구현|자동 반영/);
});

test('detail fails closed for another owner, unknown, unsent, suppressed and expired alerts', t => {
  const h = home(t);
  const { code } = alerted(h, [monitorEvent('backup-a', 'A')]);
  assert.equal(detailText({ home: h.root, code, userId: '999', now: NOW }).code, 'ALERT_NOT_OWNER');
  assert.equal(detailText({ home: h.root, code: 'ffffffff', userId: USER, now: NOW }).code, 'ALERT_NOT_FOUND');
  assert.equal(detailText({ home: h.root, code: '../x', userId: USER, now: NOW }).code, 'ALERT_CODE_INVALID');
  assert.equal(detailText({ home: h.root, code, userId: USER, now: new Date(NOW.getTime() + 8 * 86400_000) }).code, 'ALERT_EXPIRED');
  const quiet = home(t);
  const suppressed = alerted(quiet, [monitorEvent('backup-b', 'B')], { delivery: 'suppressed' });
  assert.equal(detailText({ home: quiet.root, code: suppressed.code, userId: USER, now: NOW }).code, 'ALERT_NOT_DELIVERED');
  const never = home(t);
  const unsent = alerted(never, [monitorEvent('backup-c', 'C')], { delivery: 'not_sent' });
  assert.equal(detailText({ home: never.root, code: unsent.code, userId: USER, now: NOW }).code, 'ALERT_NOT_DELIVERED');
});

test('a resolved or replaced incident is reported as not current, not as completed', t => {
  const h = home(t);
  const first = alerted(h, [monitorEvent('backup-a', 'A')]);
  // Next round: the source healed. plan() drops the attention observation.
  const healed = plan(first.state, { events: [{ ...monitorEvent('backup-a', 'A'), needs_attention: false }] }, new Date(NOW.getTime() + 300_000));
  h.write('runtime/synk-automation/state.json', healed.state);
  const healedAt = new Date(NOW.getTime() + 300_000);
  const result = detailText({ home: h.root, code: first.code, userId: USER, now: healedAt });
  assert.equal(result.open, 0);
  assert.equal(result.healthy, 1);
  assert.match(result.text, /최근 감시에서 정상 기록을 확인했습니다\. 지금은 판단할 일이 아닙니다\./);
  assert.doesNotMatch(result.text, /완료/);
  // The same healthy record read much later is old evidence, not current resolution.
  const late = detailText({ home: h.root, code: first.code, userId: USER, now: new Date(NOW.getTime() + 3 * 3600_000) });
  assert.equal(late.healthy, 0);
  assert.match(late.text, /마지막 정상 기록이 오래됐습니다\. 지금 상태는 미확인입니다\./);
  // Broken again with a new fingerprint → a new incident; the old alert does not claim it.
  const broken = plan(healed.state, { events: [monitorEvent('backup-a', 'A', { attention_fingerprint: 'other' })] }, new Date(NOW.getTime() + 600_000));
  h.write('runtime/synk-automation/state.json', broken.state);
  assert.match(detailText({ home: h.root, code: first.code, userId: USER, now: NOW }).text, /같은 곳에서 새 사건이 생겼습니다/);
});

test('missing, partial, stale or future monitor state is never shown as resolved', t => {
  const h = home(t);
  const { code } = alerted(h, [monitorEvent('backup-a', 'A')]);
  const state = path.join(h.root, 'runtime/synk-automation/state.json');
  const original = JSON.parse(fs.readFileSync(state, 'utf8'));
  for (const [name, value, now] of [
    ['empty', {}, NOW],
    ['observation gone', { ...original, observed: {}, attentionObserved: {} }, NOW],
    ['open but old', original, new Date(NOW.getTime() + 2 * 3600_000)],
    ['future check time', { ...original, checkedAt: new Date(NOW.getTime() + 3600_000).toISOString() }, NOW],
  ]) {
    fs.writeFileSync(state, JSON.stringify(value));
    const result = detailText({ home: h.root, code, userId: USER, now });
    assert.equal(result.healthy, 0, name);
    assert.doesNotMatch(result.text, /모두 정상|정상 기록을 확인했습니다|판단할 일이 아닙니다/, name);
    assert.match(result.text, /미확인|풀렸다고 보지 않았습니다/, name);
  }
  fs.writeFileSync(state, JSON.stringify({ checkedAt: '2026-11-13T00:00:00Z', observed: {}, attentionObserved: {} }));
  const view = attentionView({ home: h.root, userId: USER, now: NOW }).text;
  assert.doesNotMatch(view, /필요한 일은 없습니다/);
  assert.match(view, /미확인/);
});

test('an alert with more than 8 events counts every event, not only the 8 shown', t => {
  const ids = Array.from({ length: 9 }, (_, i) => 'backup-n' + i);
  const scenario = ninth => {
    const h = home(t);
    const { code, state } = alerted(h, ids.map(id => monitorEvent(id, id)));
    const next = structuredClone(state);
    next.checkedAt = NOW.toISOString();
    ids.forEach((id, index) => {
      if (index === 8 && ninth !== 'healthy') {
        if (ninth === 'unknown') { delete next.attentionObserved[id]; delete next.observed[id]; }
        return; // 'open': still in attentionObserved with the same incident
      }
      delete next.attentionObserved[id];
      next.observed[id] = { ...next.observed[id], needs_attention: false };
    });
    h.write('runtime/synk-automation/state.json', next);
    return detailText({ home: h.root, code, userId: USER, now: NOW });
  };
  const open = scenario('open');
  assert.deepEqual([open.open, open.healthy, open.unknown], [1, 8, 0]);
  assert.match(open.text, /화면에 싣지 못한 사건이 1건 더 있습니다\.\n그중 1건은 아직 열려 있습니다\./);
  assert.doesNotMatch(open.text, /모두 정상/);
  const unknown = scenario('unknown');
  assert.deepEqual([unknown.open, unknown.healthy, unknown.unknown], [0, 8, 1]);
  assert.match(unknown.text, /화면에 싣지 못한 사건이 1건 더 있습니다\.\n그중 1건은 지금 상태가 미확인입니다\./);
  assert.doesNotMatch(unknown.text, /모두 정상/);
  const healthy = scenario('healthy');
  assert.deepEqual([healthy.open, healthy.healthy, healthy.unknown], [0, 9, 0]);
  assert.match(healthy.text, /화면에 싣지 못한 사건이 1건 더 있습니다\.\n그중 1건은 정상 기록이 있습니다\./);
  assert.match(healthy.text, /모두 정상으로 기록됐습니다/);
});

test('view lists live incidents with alert numbers, active approvals and recent task decisions, not old failures', t => {
  const h = home(t);
  const { code } = alerted(h, [monitorEvent('backup-a', 'PC 백업 실패'), monitorEvent('task-synk-aaaaaaaaaaaa', '옛 시작 실패 작업')]);
  const task = (id, record) => h.write(`runtime/synk-tasks/${id}/request.json`, { id, route: { user_id: USER, chat_id: USER }, ...record });
  task('synk-aaaaaaaaaaaa', { state: 'launch_failed', created_at: '2026-10-21T10:00:00Z' });
  task('synk-bbbbbbbbbbbb', { state: 'exited', finalization_state: 'attention', attention_reason: 'SOURCE_MERGE_CONFLICT', created_at: '2026-11-13T10:00:00Z' });
  task('synk-cccccccccccc', { state: 'exited', finalization_state: 'attention', attention_reason: 'CHECK_REQUIRED', created_at: '2026-10-01T10:00:00Z' });
  task('synk-dddddddddddd', { state: 'unknown', created_at: '2026-11-14T01:00:00Z' });
  task('synk-eeeeeeeeeeee', { state: 'exited', finalization_state: 'attention', created_at: '2026-11-14T01:00:00Z', route: { user_id: '999', chat_id: '999' } });
  h.write('runtime/synk-approvals/00000000-0000-4000-8000-000000000001.json', { session_id: '00000000-0000-4000-8000-000000000001', state: 'notified', notice: { what: '설정 파일 쓰기', sent_at: '2026-11-13T12:00:00Z' } });
  h.write('runtime/synk-approvals/00000000-0000-4000-8000-000000000002.json', { session_id: '00000000-0000-4000-8000-000000000002', state: 'notified', notice: { what: '옛 단계', sent_at: '2026-10-01T12:00:00Z' } });
  const { text } = attentionView({ home: h.root, userId: USER, now: NOW });
  assert.match(text, /감시가 잡은 사건은 1건입니다\./);
  assert.match(text, new RegExp('알림 번호는 ' + code + '입니다'));
  assert.doesNotMatch(text, /옛 시작 실패 작업/);
  assert.match(text, /synk-bbbbbbbbbbbb 작업의 확인 코드는 SOURCE_MERGE_CONFLICT입니다\./);
  assert.doesNotMatch(text, /synk-cccccccccccc|synk-eeeeeeeeeeee/);
  assert.match(text, /\/synk_release synk-dddddddddddd 종료확인/);
  assert.match(text, /이어 가기를 기다리는 단계가 1건 있습니다\./);
  assert.match(text, /지난 기록은 현재 할 일에서 뺐습니다\.\n7일이 넘은 작업 판단 대기가 1건 있습니다\.\n시작에 실패한 작업 기록이 1건 있습니다\.\n기한이 지난 이어 가기가 1건 있습니다\./);
  assert.equal(attentionView({ home: h.root, userId: '999', now: NOW }).ok, false);
});

test('view says nothing is waiting only when the monitor state was read', t => {
  const h = home(t);
  h.write('runtime/synk-automation/state.json', { checkedAt: NOW.toISOString(), observed: {}, attentionObserved: {} });
  assert.match(attentionView({ home: h.root, userId: USER, now: NOW }).text, /지금 판단이 필요한 일은 없습니다/);
  const missing = home(t);
  const text = attentionView({ home: missing.root, userId: USER, now: NOW }).text;
  assert.match(text, /감시 기록을 읽지 못했습니다/);
  assert.doesNotMatch(text, /필요한 일은 없습니다/);
});

test('CLI accepts only fixed argv shapes and prints text', t => {
  const h = home(t);
  const { code } = alerted(h, [monitorEvent('backup-a', 'A')], { at: new Date() });
  const run = args => execFileSync(process.execPath, [path.join(__dirname, '../tools/hermes-synk/attention.cjs'), ...args], { env: { ...process.env, HERMES_HOME: h.root }, encoding: 'utf8' });
  assert.match(run(['alert', code, '--user', USER]), new RegExp('SYNK 알림 ' + code));
  assert.match(run(['view', '--user', USER]), /감시가 잡은 사건은 1건입니다\./);
  assert.throws(() => run(['alert', code, 'rm -rf', '--user', USER]));
  assert.throws(() => run(['view']));
});

// ── Astra C 지적 재현(GC1~GC3) · 일반 fixture만 씀 ──────────────────────────────
function taskDir(h, id, record, mtime) {
  const file = h.write(`runtime/synk-tasks/${id}/request.json`, typeof record === 'string' ? record : { id, route: { user_id: USER, chat_id: USER }, ...record });
  if (mtime) fs.utimesSync(file, mtime, mtime);
  return file;
}
function freshIncident(h, events, options) {
  const result = alerted(h, events, options);
  const state = structuredClone(result.state);
  state.checkedAt = NOW.toISOString();
  h.write('runtime/synk-automation/state.json', state);
  return result;
}

test('GC1: a recent decision task past the first 300 directory entries is read first and kept', t => {
  const h = home(t);
  const old = new Date('2026-10-01T00:00:00Z');
  for (let i = 0; i < 300; i++) taskDir(h, 'synk-' + i.toString(16).padStart(12, '0'), { state: 'exited', finalization_state: 'completed', created_at: '2026-10-01T00:00:00Z' }, old);
  // Sorts last by name, newest by record time.
  taskDir(h, 'synk-ffffffffffff', { state: 'exited', finalization_state: 'attention', attention_reason: 'SOURCE_MERGE_CONFLICT', created_at: '2026-11-14T01:00:00Z' }, new Date('2026-11-14T01:00:00Z'));
  freshIncident(h, [monitorEvent('task-synk-ffffffffffff', 'Codex synk-ffffffffffff')]);
  const { text } = attentionView({ home: h.root, userId: USER, now: NOW });
  assert.match(text, /감시가 잡은 사건은 1건입니다\./);
  assert.match(text, /synk-ffffffffffff 작업의 확인 코드는 SOURCE_MERGE_CONFLICT입니다\./);
  assert.match(text, /작업 기록은 최근 300건까지만 읽었습니다\. 더 오래된 작업 기록 1건은 확인하지 않았습니다\./);
  assert.doesNotMatch(text, /지금 판단이 필요한 일은 없습니다/);
});

test('GC1: an incident for a task outside the read window or with an unreadable record is not hidden', t => {
  const h = home(t);
  const recent = new Date('2026-11-13T00:00:00Z');
  for (let i = 0; i < 300; i++) taskDir(h, 'synk-' + i.toString(16).padStart(12, '0'), { state: 'exited', finalization_state: 'completed', created_at: '2026-11-13T00:00:00Z' }, recent);
  taskDir(h, 'synk-eeeeeeeeeeee', { state: 'exited', finalization_state: 'attention', created_at: '2026-09-01T00:00:00Z' }, new Date('2026-09-01T00:00:00Z'));
  taskDir(h, 'synk-dddddddddddd', '{broken', new Date('2026-11-14T02:00:00Z'));
  freshIncident(h, [monitorEvent('task-synk-eeeeeeeeeeee', '오래돼 읽지 않은 작업'), monitorEvent('task-synk-dddddddddddd', '읽지 못한 작업')]);
  const { text } = attentionView({ home: h.root, userId: USER, now: NOW });
  assert.match(text, /감시가 잡은 사건은 2건입니다\./);
  assert.match(text, /오래돼 읽지 않은 작업/);
  assert.match(text, /읽지 못한 작업/);
  assert.match(text, /읽지 못한 작업 기록이 1건 있습니다\./);
  assert.doesNotMatch(text, /지금 판단이 필요한 일은 없습니다/);
});

test('GC1: an incomplete task read never concludes that nothing is waiting', t => {
  const h = home(t);
  h.write('runtime/synk-automation/state.json', { checkedAt: NOW.toISOString(), observed: {}, attentionObserved: {} });
  taskDir(h, 'synk-cccccccccccc', '{broken');
  const { text } = attentionView({ home: h.root, userId: USER, now: NOW });
  assert.doesNotMatch(text, /지금 판단이 필요한 일은 없습니다/);
  assert.match(text, /확인하지 못한 작업 기록이 있어서 판단할 일이 없는지는 미확인입니다\./);
  // A read, completed old task still drops its own incident.
  const done = home(t);
  taskDir(done, 'synk-aaaaaaaaaaaa', { state: 'launch_failed', created_at: '2026-10-21T10:00:00Z' });
  freshIncident(done, [monitorEvent('task-synk-aaaaaaaaaaaa', '옛 시작 실패 작업')]);
  const view = attentionView({ home: done.root, userId: USER, now: NOW }).text;
  assert.doesNotMatch(view, /옛 시작 실패 작업/);
  assert.match(view, /지금 판단이 필요한 일은 없습니다\./);
});

test('GC2: the list never offers an alert number that the detail would refuse as expired', t => {
  const h = home(t);
  const { code } = freshIncident(h, [monitorEvent('backup-a', 'PC 백업 실패')], { at: new Date(NOW.getTime() - 8 * 86400_000) });
  assert.equal(detailText({ home: h.root, code, userId: USER, now: NOW }).code, 'ALERT_EXPIRED');
  const { text } = attentionView({ home: h.root, userId: USER, now: NOW });
  assert.doesNotMatch(text, new RegExp('/synk_attention ' + code));
  assert.match(text, /이 사건에 연결된 알림은 만든 지 7일이 지나서 번호로 열 수 없습니다\./);
  assert.match(text, /최근 감시에서 이 사건은 열려 있습니다\./);
  assert.match(text, /docs\/현장노트\/백업_업로드\.md/);
});

test('GC3: send wording follows the actual delivery record', t => {
  const confirmed = home(t);
  const sent = alerted(confirmed, [monitorEvent('backup-a', 'A')]);
  confirmed.write(`runtime/synk-automation/outbox/${sent.alert.id}.receipt.json`, { id: sent.alert.id, status: 'sent', message_id: '9001', attemptedAt: '2026-11-14T02:59:00Z' });
  const ok = detailText({ home: confirmed.root, code: sent.code, userId: USER, now: NOW }).text;
  assert.match(ok, /알림 초안은 2026-11-14 12:00 KST에 만들었습니다\./);
  assert.match(ok, /텔레그램이 이 알림을 받았다는 발송 기록이 있습니다\./);
  assert.match(ok, /발송 기록에 적힌 시각은 2026-11-14 11:59 KST입니다\./);
  const unknown = home(t);
  const claim = alerted(unknown, [monitorEvent('backup-b', 'B')], { delivery: 'unconfirmed' });
  const text = detailText({ home: unknown.root, code: claim.code, userId: USER, now: NOW }).text;
  assert.match(text, /이 알림은 발송을 시도했지만 텔레그램이 받았는지는 미확인입니다\./);
  assert.doesNotMatch(text, /보냈습니다|발송 기록에 적힌 시각/);
});
