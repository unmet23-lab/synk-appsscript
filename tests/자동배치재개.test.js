'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', '엔진_셋업확장.js'), 'utf8');
const runtime = source.slice(source.indexOf('function safeRun('), source.indexOf('function morningJobs()'));

function harness(options = {}) {
  let now = Date.parse('2026-09-11T00:00:00Z'), locked = false, serial = 0;
  const values = new Map(), logs = [], notices = [], effects = [];
  const triggers = Array.from({ length: 13 }, (_, i) => ({ id: 'old-' + i, name: 'existing-' + i }));
  const triggerView = t => ({ getHandlerFunction: () => t.name, getUniqueId: () => t.id });
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  const props = {
    getProperty: k => values.has(k) ? values.get(k) : null,
    setProperty(k, v) { if (options.writeFailure && options.writeFailure(k, v)) throw new Error('synthetic write failure'); values.set(k, String(v)); },
    deleteProperty: k => values.delete(k)
  };
  const ctx = {
    Date: Clock, Logger: { log: m => logs.push(String(m)) },
    PropertiesService: { getScriptProperties: () => props },
    Utilities: { getUuid: () => 'run-' + (++serial), formatDate: (d, tz, pattern) => pattern === 'yyyy-MM-dd HH:mm' ? d.toISOString().slice(0, 16).replace('T', ' ') : d.toISOString().slice(0, 10) },
    Session: { getScriptTimeZone: () => 'UTC' },
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSpreadsheetTimeZone: () => 'UTC' }) },
    LockService: { getScriptLock: () => ({ tryLock() { if (locked || options.lockBusy) return false; locked = true; return true; }, releaseLock() { assert.equal(locked, true); locked = false; } }) },
    ScriptApp: {
      getProjectTriggers: () => triggers.map(triggerView),
      newTrigger(name) { const t = { name }; const builder = { timeBased: () => builder, after(ms) { t.after = ms; return builder; }, atHour(hour) { t.hour = hour; return builder; }, everyDays(days) { t.days = days; return builder; }, create() { if (options.scheduleFailure) throw new Error('synthetic trigger failure'); t.id = 'new-' + (++serial); triggers.push(t); return triggerView(t); } }; return builder; },
      deleteTrigger(t) { const i = triggers.findIndex(x => x.id === t.getUniqueId()); assert.ok(i >= 0); triggers.splice(i, 1); }
    },
    adminMail: (...args) => notices.push(args), MailApp: { sendEmail: (...args) => notices.push(args) },
    ADMIN_EMAIL: 'owner@example.test', quotaOk: () => true,
    automationOwnerAllowed_: () => options.owner !== false
  };
  vm.createContext(ctx); vm.runInContext(runtime, ctx);
  const clean = x => JSON.parse(JSON.stringify(x));
  return { ctx, props, values, triggers, notices, logs, effects, advance: ms => { now += ms; },
    state: name => JSON.parse(props.getProperty('배치진행_' + (name || 'morningJobs'))),
    run: (steps, resume = false, name = 'morningJobs') => clean(ctx.배치실행_(name, resume, () => steps.forEach(s => ctx.safeRun(s.name, s.run)))),
    summary: () => clean(ctx.ensureMomentSweepTrigger()), effect: name => ({ name, run: () => { effects.push(name); } }) };
}

test('6단계 뒤 양보하고 완료된 단계를 다시 부르지 않고 전부 재개한다', () => {
  const h = harness(), plan = Array.from({ length: 9 }, (_, i) => h.effect('stage-' + i));
  assert.equal(h.run(plan).status, 'waiting');
  assert.equal(h.state().next, 6); assert.equal(h.triggers.length, 14);
  assert.equal(h.run(plan, true).status, 'complete');
  assert.deepEqual(h.effects, plan.map(x => x.name)); assert.equal(h.triggers.length, 13);
  assert.equal(h.run(plan).status, 'complete'); assert.equal(h.effects.length, 9);
  assert.equal(h.run(plan, true).status, 'no_pending');
});
test('실행 시간 예산에서 안전 경계로 멈추고 다음 단계부터 이어간다', () => {
  const h = harness(), plan = [{ name: 'slow', run() { h.effects.push('slow'); h.advance(151000); } }, h.effect('next')];
  assert.equal(h.run(plan).status, 'waiting'); assert.equal(h.state().next, 1);
  assert.equal(h.run(plan, true).status, 'complete'); assert.deepEqual(h.effects, ['slow', 'next']);
});
test('하위 단계는 잠금을 다시 얻을 수 있고 동시 배치는 실행권 때문에 건너뛴다', () => {
  const h = harness();
  h.run([{ name: 'lock-user', run() {
    const nested = h.ctx.LockService.getScriptLock(); assert.equal(nested.tryLock(1), true); nested.releaseLock();
    assert.equal(h.run([h.effect('duplicate')]).status, 'busy');
    h.effects.push('once');
  } }]);
  assert.deepEqual(h.effects, ['once']);
});
test('예외 단계와 내부 safeRun 실패는 도장을 막고 뒤 단계 실행을 실패 0으로 위장하지 않는다', () => {
  const h = harness();
  const result = h.run([{ name: 'bad', run() { throw new Error('synthetic private detail'); } },
    { name: 'nested', run() { h.ctx.safeRun('inner', () => { throw new Error('synthetic'); }); } }, h.effect('last')], false, 'nightJobs');
  assert.equal(result.status, 'partial'); assert.deepEqual(result.failures, ['bad', 'nested']);
  assert.equal(h.props.getProperty('야간배치완료일'), null); assert.deepEqual(h.effects, ['last']);
  assert.ok(!JSON.stringify(result).includes('private detail'));
});
test('야간 전 단계가 끝난 뒤에만 완료 도장을 쓴다', () => {
  const h = harness(), plan = Array.from({ length: 7 }, (_, i) => h.effect('s' + i));
  h.run(plan, false, 'nightJobs'); assert.equal(h.props.getProperty('야간배치완료일'), null);
  h.run(plan, true, 'nightJobs'); assert.equal(h.props.getProperty('야간배치완료일'), '2026-09-11 00:00');
});
test('슬라이스 양보는 같은 단계에서 재개하고 안전 포인터를 유지한다', () => {
  const h = harness(); const plan = [{ name: 'rows', run() {
    const c = h.ctx.배치실행_.현재; const next = c.state.slice ? c.state.slice.next : 0;
    h.effects.push(next); c.state.slice = { next: next + 1 }; h.ctx.배치저장_(c);
    return next < 2 ? { batchYield: true } : undefined;
  } }, h.effect('after')];
  assert.equal(h.run(plan).next, 0); assert.equal(h.run(plan, true).next, 0);
  assert.equal(h.run(plan, true).status, 'complete'); assert.deepEqual(h.effects, [0, 1, 2, 'after']);
});
test('중간 하드킬의 실행중 흔적은 메일을 재전송하지 않고 불확실 상태·경보로 남는다', () => {
  const h = harness();
  h.run(Array.from({ length: 7 }, (_, i) => h.effect('s' + i)));
  const state = h.state(); state.status = 'running'; state.running = { name: 'mail', at: state.updatedAt }; state.lease = { token: 'killed', until: 0 };
  h.props.setProperty('배치진행_morningJobs', JSON.stringify(state));
  const result = h.run([h.effect('duplicate-mail')], true);
  assert.equal(result.status, 'uncertain'); assert.equal(h.effects.length, 6); assert.equal(h.notices.length, 1);
  h.run([h.effect('duplicate-mail')], true); assert.equal(h.notices.length, 1);
});
test('날짜를 넘긴 미완료 단계와 바뀐 단계 목록은 다른 날짜/업무로 조용히 재개하지 않는다', () => {
  const h = harness(), plan = Array.from({ length: 7 }, (_, i) => h.effect('s' + i));
  h.run(plan); h.advance(86400000);
  assert.equal(h.run(plan, true).status, 'date_changed'); assert.equal(h.effects.length, 6);
  const j = harness(); j.run(Array.from({ length: 7 }, (_, i) => j.effect('s' + i)));
  assert.equal(j.run([j.effect('changed')], true).status, 'plan_changed'); assert.equal(j.effects.length, 6);
});
test('예약 확보가 실패하면 학생/메일 단계에 들어가지 않고 기존 예약을 보존한다', () => {
  const h = harness({ scheduleFailure: true });
  assert.throws(() => h.run([h.effect('forbidden')]), /배치 진행 중단/);
  assert.equal(h.effects.length, 0); assert.equal(h.triggers.length, 13); assert.equal(h.state().status, 'waiting');
});
test('부모 스위프는 완료 후 다음 정규 틱에서 새로 처리하지만 늦은 이어하기는 새 회차를 만들지 않는다', () => {
  const h = harness(), plan = [h.effect('sweep')];
  h.run(plan, false, 'parentSweep'); h.run(plan, true, 'parentSweep'); h.run(plan, false, 'parentSweep');
  assert.deepEqual(h.effects, ['sweep', 'sweep']);
});
test('손상된 진행 기록과 잠금 실패는 쓰기/작업 없이 거절한다', () => {
  const h = harness(); h.props.setProperty('배치진행_morningJobs', '{broken');
  assert.equal(h.run([h.effect('forbidden')]).status, 'invalid_state'); assert.equal(h.effects.length, 0);
  const j = harness({ lockBusy: true }); assert.equal(j.run([j.effect('forbidden')]).status, 'busy'); assert.equal(j.values.size, 0);
});
test('순간 예약은 소유자만, 기존13개를 지우지 않고 정확히1개 등록하며 재실행은 무변경이다', () => {
  const h = harness(); const before = h.triggers.map(x => x.id);
  assert.deepEqual(h.summary(), { ok: true, stage: 'registered', created: true, matched: 1, beforeCount: 13, afterCount: 14 });
  assert.deepEqual(h.triggers.slice(0, 13).map(x => x.id), before);
  assert.equal(h.triggers[13].name, 'momentSweepJob'); assert.equal(h.triggers[13].hour, 21); assert.equal(h.triggers[13].days, 1);
  assert.equal(h.summary().created, false); assert.equal(h.triggers.length, 14);
  const denied = harness({ owner: false }); assert.deepEqual(denied.summary(), { ok: false, stage: 'access' }); assert.equal(denied.triggers.length, 13);
});
test('순간 예약 중복은 자동 삭제하지 않고 구분해 반환한다', () => {
  const h = harness(); h.triggers.push({ id: 'm1', name: 'momentSweepJob' }, { id: 'm2', name: 'momentSweepJob' });
  assert.equal(h.summary().stage, 'duplicate'); assert.equal(h.triggers.length, 15);
});

const content = fs.readFileSync(path.join(__dirname, '..', '엔진_콘텐츠AI.js'), 'utf8');
const { 시트흉내 } = require('./lib/시트흉내.js');
function fn(src, name) { const start = src.indexOf('function ' + name + '('); assert.ok(start >= 0); return src.slice(start, src.indexOf('\n}', start) + 2); }
function sheet(rows) { const s = 시트흉내({ 첫행: 1, 행들: rows }); s.getSheetId = () => 1; s.appendRow = row => s.getRange(s.getLastRow() + 1, 1, 1, row.length).setValues([row]); return s; }
function installSheets(h, sheets = {}) {
  const state = new Map(), ss = { getSheetByName: n => sheets[n] || null, getSpreadsheetTimeZone: () => 'UTC', getUrl: () => 'synthetic' };
  Object.assign(h.ctx, { SpreadsheetApp: { getActiveSpreadsheet: () => ss }, ensureSheet: (_ss, n, heads) => sheets[n] || (sheets[n] = sheet([heads])),
    getState: (_s, key) => ({ val: state.get(key) || '' }), setState: (_s, key, val) => state.set(key, val) });
  return { ss, sheets, state };
}
test('상태가 JSON이어도 범위 밖 포인터/낯선 상태/잘못된 계획은 실행하지 않는다', () => {
  for (const mutate of [s => s.next = 999, s => s.status = 'success', s => s.plan = {}, s => s.failures = null]) {
    const h = harness(); h.run(Array.from({ length: 7 }, (_, i) => h.effect('s' + i)));
    const s = h.state(); mutate(s); h.props.setProperty('배치진행_morningJobs', JSON.stringify(s));
    assert.equal(h.run([h.effect('forbidden')], true).status, 'invalid_state'); assert.equal(h.effects.length, 6);
  }
});
test('소유자 확인과 CAS 없이는 불확실 회차를 해소하지 않고, 확인한 단계도 재전송하지 않는다', () => {
  const h = harness(), plan = Array.from({ length: 8 }, (_, i) => h.effect('s' + i)); h.run(plan);
  const s = h.state(); s.status = 'uncertain'; s.running = { name: 's6', at: s.updatedAt }; s.lease = null;
  h.props.setProperty('배치진행_morningJobs', JSON.stringify(s));
  assert.equal(h.ctx.resolveAutomationBatch('morningJobs', s.updatedAt - 1, 'skip_confirmed_step').stage, 'stale');
  h.ctx.automationOwnerAllowed_ = () => false;
  assert.equal(h.ctx.resolveAutomationBatch('morningJobs', s.updatedAt, 'skip_confirmed_step').stage, 'access');
  h.ctx.automationOwnerAllowed_ = () => true;
  assert.equal(h.ctx.resolveAutomationBatch('morningJobs', s.updatedAt, 'skip_confirmed_step').ok, true);
  assert.equal(h.run(plan, true).status, 'partial'); assert.deepEqual(h.effects, ['s0', 's1', 's2', 's3', 's4', 's5', 's7']);
});
test('날짜/계획 변경 회차는 소유자가 닫은 뒤에만 다음 부모 정규 틱으로 복구된다', () => {
  const h = harness(), plan = Array.from({ length: 7 }, (_, i) => h.effect('s' + i)); h.run(plan, false, 'parentSweep'); h.advance(86400000);
  h.run(plan, true, 'parentSweep'); const s = h.state('parentSweep');
  assert.equal(h.ctx.resolveAutomationBatch('parentSweep', s.updatedAt, 'skip_confirmed_step').stage, 'state');
  assert.equal(h.ctx.resolveAutomationBatch('parentSweep', s.updatedAt, 'close_confirmed_run').status, 'partial');
  assert.equal(h.run([h.effect('new-cycle')], false, 'parentSweep').status, 'complete'); assert.equal(h.effects.at(-1), 'new-cycle');
});
test('조각마다 AI 사용량을 보고하되 마지막 기존 장부 단계와 이중 보고하지 않는다', () => {
  const h = harness(); let reports = 0; h.ctx.AI사용_보고_ = () => { reports++; };
  const plan = Array.from({ length: 6 }, (_, i) => h.effect('s' + i)).concat({ name: 'aiUsageLedger', run: h.ctx.AI사용_보고_ });
  h.run(plan); assert.equal(reports, 1); h.run(plan, true); assert.equal(reports, 2);
});
test('헤더 분할은 5표 후 같은 포인터에서 재개하고 H:L 전달 열/값과 누적 기록을 보존한다', () => {
  const h = harness(); const extra = ['전달상태', '전달시각', '전달사유', '원본문안', '제목'];
  const skel = Array.from({ length: 12 }, (_, i) => [i === 0 ? 'report_cards' : 'tab-' + i, ['A', 'B', 'C', 'D', 'E', 'F', 'G']]);
  const sheets = Object.fromEntries(skel.map(([n, heads]) => [n, sheet([heads.concat(extra), Array.from({ length: 12 }, (_, i) => 'cell-' + i)])]));
  Object.values(sheets).forEach(s => { s.getMaxColumns = () => s.getLastColumn(); });
  const { ss, state } = installSheets(h, sheets); const before = JSON.stringify(sheets.report_cards.data);
  h.ctx.sheetSkeleton_ = () => skel;
  const collect = fs.readFileSync(path.join(__dirname, '..', '엔진_수집.js'), 'utf8');
  vm.runInContext(['열밀기켜졌나_', '열에값있나_', '시트칸정본맞추기_', '시트칸맞추기한판_', '시트칸맞추기기록_'].map(n => fn(source, n)).join('\n') + '\n' + fn(collect, '헤더보정_'), h.ctx);
  const plan = [{ name: '시트칸맞추기', run: () => h.ctx.시트칸맞추기한판_(ss) }, h.effect('after')];
  assert.equal(h.run(plan).status, 'waiting'); assert.equal(h.state().slice.next, 5);
  assert.equal(h.state().slice.result, undefined); assert.ok(Buffer.byteLength(h.props.getProperty('배치진행_morningJobs')) < 8000);
  assert.equal(h.run(plan, true).status, 'waiting'); assert.equal(h.state().slice.next, 10);
  assert.equal(h.run(plan, true).status, 'complete'); assert.equal(JSON.stringify(sheets.report_cards.data), before);
  assert.equal(JSON.parse(state.get('시트칸맞추기_마지막')).맞춘표, 12); assert.deepEqual(h.effects, ['after']);
});
test('공지 제목 저장 뒤 시간이 끝나면 본문만 이어 번역하며 기존 제목을 다시 과금하지 않는다', () => {
  const h = harness(), notices = sheet([['title', 'body', 'title_mn', 'body_mn'], ['title source', 'body source', '', '']]);
  const { ss } = installSheets(h, { notices }); const calls = [];
  h.ctx.LanguageApp = { translate(t) { calls.push(t); h.advance(151000); return 'translated ' + t; } };
  vm.runInContext(fn(content, 'translateNotices_'), h.ctx);
  const plan = [{ name: 'translateNotices', run: () => h.ctx.translateNotices_(ss) }];
  assert.equal(h.run(plan, false, 'parentSweep').status, 'waiting'); assert.equal(notices.data[1][2], 'translated title source'); assert.equal(notices.data[1][3], '');
  assert.equal(h.run(plan, true, 'parentSweep').status, 'complete'); assert.deepEqual(calls, ['title source', 'body source']);
});
test('서클은 두 반씩 굽고 각 반의 저장된 도장으로 재개하며 완료/발송한 반을 반복하지 않는다', () => {
  const h = harness(), classes = ['C1', 'C2', 'C3', 'C4', 'C5'];
  const { ss } = installSheets(h, { schedule: sheet([['class', 'day'], ...classes.map(c => [c, 'fri'])]) });
  Object.assign(h.ctx, { isRehearsal_: () => false, classDowOk_: () => true, circleBatchDone_: () => true,
    circleSheetOf_: () => ({ session_no: 1, 보고: { 출석확정: true }, groups: [{}] }),
    printCircleSheets(c, made) { h.effects.push(c); made.push(c); return 'synthetic-link-' + c; }, teacherEmailMap_: () => ({ byClass: {} }) });
  vm.runInContext(['circleSheetsAuto_', 'circleStampTrim_', 'circleStampOf_'].map(n => fn(source, n)).join('\n'), h.ctx);
  const plan = [{ name: 'circleSheetsAuto', run: () => h.ctx.circleSheetsAuto_(ss) }];
  assert.equal(h.run(plan, false, 'parentSweep').status, 'waiting'); assert.deepEqual(h.effects, ['C1', 'C2']);
  assert.equal(h.run(plan, true, 'parentSweep').status, 'waiting');
  assert.equal(h.run(plan, true, 'parentSweep').status, 'complete'); assert.deepEqual(h.effects, classes); assert.equal(h.notices.length, 5);
  h.run(plan, false, 'parentSweep'); assert.equal(h.notices.length, 5); assert.equal(h.effects.length, 5);
});

function studioHarness(cap = 4) {
  const h = harness(), sheets = { ai_daily: sheet([['student_id', '날짜', '한문장', '퀴즈문제', '퀴즈정답해설']]), class_stats: sheet([['class', 'count'], ['C1', 4]]) };
  sheets.ai_daily.서식[2] = '@';
  const { state } = installSheets(h, sheets); h.props.setProperty('CLAUDE_API_KEY', 'synthetic-not-a-key');
  let calls = 0; const categories = [];
  Object.assign(h.ctx, { AI_STUDIO_MAX_CALLS: cap, AI_DAILY_BATCH_SIZE: 1,
    aiStudents_: () => Array.from({ length: 3 }, (_, i) => ({ id: 'S' + i, cls: 'C1' })), aiWeakMap_: () => ({}),
    복귀창_: () => ({ 맵: {}, 상한밖: 0 }), 퀴즈오답맵_: () => ({ 맵: {} }), 성취맵_: () => ({ 맵: {} }), 복귀_공백상한일: 180,
    aiCall_(_key, sys) { calls++; h.advance(151000); const personal = sys.includes('개인화 튜터'); categories.push(personal ? 'personal' : 'brief'); return { items: personal ? [{ i: 0, s: 'synthetic', q: 'q', a: 'a' }] : [{ c: 'C1', line: 'synthetic brief' }] }; } });
  h.ctx.Utilities.sleep = () => {};
  vm.runInContext(fn(content, 'aiStudioBatch_'), h.ctx);
  return { h, sheets, state, calls: () => calls, categories, plan: [{ name: 'aiStudioBatch', run: () => h.ctx.aiStudioBatch_() }] };
}
test('야간 AI 스튜디오는 저장된 학생 출력과 완료 갈래를 재개하고 전체 호출 상한을 늘리지 않는다', () => {
  const x = studioHarness(4); let result;
  for (let i = 0; i < 8; i++) { result = x.h.run(x.plan, i > 0, 'nightJobs'); if (result.status !== 'waiting') break; }
  assert.equal(result.status, 'complete'); assert.equal(x.calls(), 4);
  assert.deepEqual(x.sheets.ai_daily.data.slice(1).map(r => r[0]), ['S0', 'S1', 'S2']); assert.deepEqual(x.categories, ['personal', 'personal', 'personal', 'brief']);
  const y = studioHarness(2);
  y.h.run(y.plan, false, 'nightJobs'); assert.equal(y.h.run(y.plan, true, 'nightJobs').status, 'complete');
  assert.equal(y.calls(), 2); assert.equal(y.sheets.ai_daily.data.length, 3); // 원래 한도 밖 학생은 다음 밤 몫
});
test('야간 첨삭은 원본 포인터를 전진한 학생만 처리하고 이어하기 전체 생성 상한을 지킨다', () => {
  const h = harness(), pf = sheet([['id', 'name', 'unused', 'role'], ['S1', 'synthetic', '', 'student']]);
  const { sheets } = installSheets(h, { profiles: pf, 숙제폼_응답: sheet([['at', 'sid', 'text'], ...['one', 'two', 'three'].map(t => ['', 'S1', t])]) });
  h.props.setProperty('CLAUDE_API_KEY', 'synthetic-not-a-key');
  Object.assign(h.ctx, { AI_FEEDBACK_MAX_PER_RUN: 2, HW_FEEDBACK_HEADERS: ['id'], SCHEMA_VER: 'test', AI_FEEDBACK_AUTOPUBLISH: false,
    강의요약대기_: () => [], isRehearsal_: () => false, hwFeedbackEnsureCols_: () => [], fbPromptVer_: () => 'test',
    callClaudeFeedback_(_key, _s, t) { h.effects.push(t); h.advance(151000); return { corrected: t }; }, fbQualityGate_: () => ({ ok: true }),
    셀안전_: x => x, dstr: () => '2026-09-11', hwTagsClean_: () => '', hwRedoUrlOf_: () => '',
    발행경로_: { 대기: 'pending' }, 재작성지급_: () => {}, notifyDroppedSids_: () => {} });
  h.ctx.Utilities.sleep = () => {}; vm.runInContext(fn(content, 'aiFeedbackBatch_'), h.ctx);
  const plan = [{ name: 'aiFeedbackBatch', run: () => h.ctx.aiFeedbackBatch_() }];
  assert.equal(h.run(plan, false, 'nightJobs').status, 'waiting'); assert.equal(h.props.getProperty('숙제폼_포인터'), '2');
  assert.equal(h.run(plan, true, 'nightJobs').status, 'complete'); assert.equal(h.props.getProperty('숙제폼_포인터'), '3');
  assert.deepEqual(h.effects, ['one', 'two']); assert.equal(sheets.hw_feedback.data.length, 3);
});
test('메일 반환 후 체크포인트 쓰기가 죽으면 이전 running 흔적이 남아 재발송하지 않는다', () => {
  let fail = true;
  const h = harness({ writeFailure(k, v) { return fail && k === '배치진행_morningJobs' && JSON.parse(v).next === 1; } });
  const plan = [h.effect('sent-mail'), h.effect('after')];
  assert.throws(() => h.run(plan)); assert.deepEqual(h.effects, ['sent-mail']);
  fail = false; h.advance(421000);
  assert.equal(h.run(plan, true).status, 'uncertain'); assert.deepEqual(h.effects, ['sent-mail']);
});
test('한 표 내부 예산이 끝나면 헤더 이름을 덮거나 다음 표로 포인터를 넘기지 않는다', () => {
  const h = harness(), s = sheet([['A', 'B', 'C'], ['a', 'b', 'c']]); s.getMaxColumns = () => 3;
  const { ss } = installSheets(h, { one: s }); h.ctx.sheetSkeleton_ = () => [['one', ['A', 'B', 'C']]];
  let reads = 0; const getRange = s.getRange.bind(s);
  s.getRange = (...args) => { reads++; if (reads === 2) h.advance(151000); return getRange(...args); };
  const collect = fs.readFileSync(path.join(__dirname, '..', '엔진_수집.js'), 'utf8');
  vm.runInContext(['열밀기켜졌나_', '열에값있나_', '시트칸정본맞추기_', '시트칸맞추기한판_', '시트칸맞추기기록_'].map(n => fn(source, n)).join('\n') + '\n' + fn(collect, '헤더보정_'), h.ctx);
  const plan = [{ name: '시트칸맞추기', run: () => h.ctx.시트칸맞추기한판_(ss) }];
  assert.equal(h.run(plan).status, 'waiting'); assert.equal(h.state().slice.next, 0);
  assert.equal(h.run(plan, true).status, 'complete'); assert.deepEqual(s.data[1], ['a', 'b', 'c']);
});
test('야간 AI 오류와 시간 보류가 겹치면 같은 밤 실패 요청을 즉시 재시도하지 않는다', () => {
  const x = studioHarness(); let calls = 0;
  x.h.ctx.aiCall_ = () => { calls++; x.h.advance(151000); const error = new Error('synthetic permanent'); error.permanent = true; throw error; };
  assert.equal(x.h.run(x.plan, false, 'nightJobs').status, 'partial');
  assert.equal(x.h.run(x.plan, true, 'nightJobs').status, 'no_pending'); assert.equal(calls, 1);
  assert.equal(x.h.props.getProperty('야간배치완료일'), null);
});
test('배치 날짜와 완주 도장은 스크립트 개인 TZ가 아니라 기존 시트 TZ를 따른다', () => {
  const h = harness(), zones = [];
  h.ctx.SpreadsheetApp.getActiveSpreadsheet = () => ({ getSpreadsheetTimeZone: () => 'Asia/Ulaanbaatar' });
  const original = h.ctx.Utilities.formatDate; h.ctx.Utilities.formatDate = (d, tz, pattern) => { zones.push(tz); return original(d, tz, pattern); };
  h.run([h.effect('night')], false, 'nightJobs'); assert.ok(zones.length >= 2); assert.ok(zones.every(z => z === 'Asia/Ulaanbaatar'));
});
test('보호 때문에 보류한 헤더는 값을 보존하면서 배치를 complete 대신 partial로 남긴다', () => {
  const h = harness(), s = sheet([['A', 'X', 'C'], ['a', 'private synthetic', 'c']]); s.getMaxColumns = () => 3;
  const { ss, state } = installSheets(h, { one: s }); h.ctx.sheetSkeleton_ = () => [['one', ['A', 'B', 'C']]];
  const collect = fs.readFileSync(path.join(__dirname, '..', '엔진_수집.js'), 'utf8');
  vm.runInContext(['열밀기켜졌나_', '열에값있나_', '시트칸정본맞추기_', '시트칸맞추기한판_', '시트칸맞추기기록_'].map(n => fn(source, n)).join('\n') + '\n' + fn(collect, '헤더보정_'), h.ctx);
  const result = h.run([{ name: '시트칸맞추기', run: () => h.ctx.시트칸맞추기한판_(ss) }, h.effect('independent')]);
  assert.equal(result.status, 'partial'); assert.deepEqual(result.failures, ['시트칸맞추기']);
  assert.equal(JSON.parse(state.get('시트칸맞추기_마지막')).보류표.length, 1);
  assert.deepEqual(s.data, [['A', 'X', 'C'], ['a', 'private synthetic', 'c']]);
  assert.ok(!JSON.stringify(result).includes('private synthetic')); assert.deepEqual(h.effects, ['independent']);
});
