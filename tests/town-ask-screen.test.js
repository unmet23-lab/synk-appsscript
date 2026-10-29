'use strict';
// 싱크타운 W6b 화면 모듈(세로 조각 설계 §10-2·§20-3·§20-4·§20-5) — 마스코트 묻기 카드(내 마스코트 = 이 기기의 WORLD 튜터, 「아니요」가 먼저,
// 답과 닫기의 명령), 「그동안 달라진 것」 판(주민 이름 채우기·창의 첫 맥박보다 30분 넘게 앞인 방문은 안 띄움), 수첩의 자주 오는 때 줄과
// 「마을을 낫게 하는 데 쓰는 기록」 줄(스위치를 끈 호스트에서는 동의한 사람에게 「그만 쓰기」만 — Fable F8), 그리고 서빙 목록 셋.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { execFileSync } = require('node:child_process');
const { ROOT } = require('./lib/town.js');

const load = file => import(pathToFileURL(path.join(ROOT, 'experiences', 'synk-town', file)).href);
const storage = entries => ({ length: entries.length, key: i => entries[i]?.[0] ?? null, getItem: key => entries.find(([k]) => k === key)?.[1] ?? null });
const tutorRow = (owner, tutor) => [`synk.world.tutor.v1:${owner}`, JSON.stringify({ version: 1, completed: true, tutor })];

test('내 마스코트 — 이 기기의 계정들이 고른 튜터가 하나로 같으면 그 튜터, 갈리거나 없거나 깨졌으면 모름(몽글로 그림)', async () => {
  const { tutorOnDevice, askModel } = await load('day-ask.mjs');
  assert.equal(tutorOnDevice(storage([tutorRow('acct-1', 'marin')])), 'marin');
  assert.equal(tutorOnDevice(storage([tutorRow('acct-1', 'kkamong'), tutorRow('acct-2', 'kkamong'), ['other', 'x']])), 'kkamong');
  assert.equal(tutorOnDevice(storage([tutorRow('acct-1', 'marin'), tutorRow('acct-2', 'mongle')])), null);
  assert.equal(tutorOnDevice(storage([['synk.world.tutor.v1:acct-1', '{bad']])), null);
  assert.equal(tutorOnDevice(storage([['synk.world.tutor.v1:acct-1', JSON.stringify({ version: 1, completed: false, tutor: 'marin' })]])), null);
  assert.equal(tutorOnDevice({ get length() { throw new Error('blocked'); } }), null);
  assert.equal(askModel({ key: 'taste:cafe-life', kind: 'taste', family: 'cafe-life' }, { tutor: null }).tutor, 'mongle');
  assert.equal(askModel({ key: 'taste:cafe-life', kind: 'taste', family: 'cafe-life' }, { tutor: 'stranger' }).tutor, 'mongle');
});

test('취향 물음 — 원고(ASK_LINES)의 L2 한 줄과 튜터의 그림, 「아니요」가 먼저, 답은 PREF_FAMILY yes·no', async () => {
  const { askModel, answerCommand } = await load('day-ask.mjs');
  const m = askModel({ key: 'taste:workshop-life', kind: 'taste', family: 'workshop-life' }, { tutor: 'kkamong' });
  assert.equal(m.line, '요즘 공방 일을 자주 하네요. 공방 일을 먼저 보여 드릴까요?');
  assert.equal(m.name, '까몽');
  assert.match(m.picture, /\/assets\/ask\/kkamong-taste\.webp$/);
  assert.deepEqual(m.answers.map(([answer]) => answer), ['no', 'yes']);
  assert.deepEqual(answerCommand(m, 'yes'), ['PREF_FAMILY', { family: 'workshop-life', answer: 'yes' }]);
  assert.deepEqual(answerCommand(m, 'no'), ['PREF_FAMILY', { family: 'workshop-life', answer: 'no' }]);
  // Words this browser does not have (a family from a newer host, a missing key) draw no card.
  assert.equal(askModel({ key: 'taste:x', kind: 'taste', family: 'unknown' }), null);
  assert.equal(askModel({ kind: 'taste', family: 'cafe-life' }), null);
  assert.equal(askModel(null), null);
});

test('동의 물음 — 계약 생성물의 쉬운 판 다섯 줄·단추(손으로 쓴 글 없음)와 동의판, 「아니요」가 먼저, 답은 EVAL_CONSENT', async () => {
  const { askModel, answerCommand } = await load('day-ask.mjs');
  const { EVAL_CONSENT } = await load('town/data.gen.mjs');
  const m = askModel({ key: 'consent', kind: 'consent' }, { tutor: 'marin' });
  assert.equal(m.line, EVAL_CONSENT.easy.ask);
  assert.deepEqual(m.lines, [EVAL_CONSENT.easy.uses, EVAL_CONSENT.easy.where, EVAL_CONSENT.easy.keep, EVAL_CONSENT.easy.choose]);
  assert.deepEqual(m.answers, [['no', EVAL_CONSENT.easy.buttons.no], ['yes', EVAL_CONSENT.easy.buttons.yes]]);
  assert.equal(m.more, EVAL_CONSENT.easy.buttons.more);
  assert.deepEqual(m.detail, EVAL_CONSENT.detail);
  assert.match(m.picture, /\/assets\/ask\/marin-consent\.webp$/);
  assert.deepEqual(answerCommand(m, 'yes'), ['EVAL_CONSENT', { state: 'granted', ver: EVAL_CONSENT.ver }]);
  assert.deepEqual(answerCommand(m, 'no'), ['EVAL_CONSENT', { state: 'declined', ver: EVAL_CONSENT.ver }]);
  assert.equal(askModel({ key: 'consent', kind: 'consent' }, { consent: null }), null);
});

test('W9 말 물음 — 넓히기는 view.ask의 자리 열쇠로(「나중에」가 닫기 · 답은 LANGUAGE_ANSWER), 배치는 첫 대화 한 줄과 두 답(닫기 없음 · 답은 호스트로)', async () => {
  const { askModel, answerCommand } = await load('day-ask.mjs');
  const widen = askModel({ key: 'widen:reading:L3', kind: 'widen' }, { tutor: 'marin' });
  assert.deepEqual([widen.name, widen.channel, widen.picture, widen.close, widen.line], ['마린', 'reading', null, '나중에', '말을 조금 더 넓혀 볼까요?']);
  assert.deepEqual(widen.answers.map(([answer]) => answer), ['accepted', 'declined']);
  assert.deepEqual(answerCommand(widen, 'accepted'), ['LANGUAGE_ANSWER', { channel: 'reading', choice: 'accepted' }]);
  assert.deepEqual(answerCommand(widen, 'declined'), ['LANGUAGE_ANSWER', { channel: 'reading', choice: 'declined' }]);
  assert.equal(askModel({ key: 'widen:speaking:L3', kind: 'widen' }), null, '모르는 자리는 그리지 않는다');
  assert.equal(askModel({ key: 'widen:reading:L1', kind: 'widen' }), null, 'L1로 넓히는 물음은 없다');
  assert.ok(!/L[1-4]|[0-9]/.test([widen.line, ...widen.lines].join(' ')), '판 이름·숫자를 보이지 않는다');
  const place = askModel({ key: 'placement', kind: 'placement', example: '요즘 새 차를 만들고 있거든요.' });
  assert.deepEqual([place.line, place.close, place.picture], ['처음 이야기는 이 말로 해 볼까요?', null, null]);
  assert.equal(place.lines.at(-1), '「요즘 새 차를 만들고 있거든요.」');
  assert.deepEqual(place.answers, [['keep', '이대로'], ['easier', '더 쉬운 말로']]);
  assert.deepEqual(answerCommand(place, 'easier'), ['PLACEMENT', { answer: 'easier' }]);
  assert.equal(askModel({ key: 'placement', kind: 'placement' }), null, '보일 한 줄이 없으면 묻지 않는다');
});

test('W9 수첩 — 넓히기 카드는 수첩이 그리지 않고, 장면 끝에는 호스트가 오늘 물을 수 있다고 할 때만 끝난 장면의 꼴과 함께 묻는다', async () => {
  const { createLanguageSettings } = await load('day-language.mjs');
  const { initialLadder } = await load('town/language-ladder.mjs');
  const original = globalThis.document, nodes = [];
  const element = () => { const node = { children: [], dataset: {}, append(...c) { this.children.push(...c); }, setAttribute() {}, addEventListener() {} }; nodes.push(node); return node; };
  globalThis.document = { createElement: element };
  try {
    const sent = [], settings = createLanguageSettings(element(), { command: async (...args) => { sent.push(args); return true; } });
    assert.equal(nodes.some(node => node.className === 'ask-card'), false, '옛 넓히기 카드 없음');
    const language = askReady => ({ version: 1, ladder: initialLadder({ reading: 'L2', listening: 'L1' }, 1), ...(askReady === undefined ? {} : { askReady }) });
    await settings.boundary(language(undefined), 1, 'single-choice');
    await settings.boundary(language(false), 1, 'single-choice');
    assert.deepEqual(sent, [], 'W9 앞 호스트(askReady 없음)·오늘 못 묻는 날에는 묻지 않는다');
    await settings.boundary(language(true), 1, 'single-choice');
    assert.deepEqual(sent, [['LANGUAGE_OFFER', { channel: 'reading', format: 'single-choice' }]]);
    const fixed = language(true); fixed.ladder.reading.fixed = true;
    await settings.boundary(fixed, 1, 'cup-compose');
    assert.equal(sent.length, 1, '본인이 고정한 자리는 묻지 않는다');
  } finally { globalThis.document = original; }
});

test('마스코트 그림 — 튜터 셋 × 물음 둘의 그림이 저장소 자산으로 있다(바이트·생성 도구 표시는 공개 도구가 본다)', async () => {
  // CI의 희소 체크아웃은 그림을 빼므로 파일을 열지 않고 색인만 본다(tools/ci읽기대조.cjs ③).
  const { TUTORS } = await load('day-ask.mjs');
  const listed = execFileSync('git', ['ls-files', 'experiences/synk-town/assets/ask'], { cwd: ROOT, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
  for (const tutor of Object.keys(TUTORS)) for (const kind of ['taste', 'consent']) assert.ok(listed.includes(`experiences/synk-town/assets/ask/${tutor}-${kind}.webp`), `${tutor}-${kind}.webp`);
});

test('그동안 달라진 것 — 주민 이름을 채운 줄, 첫 맥박보다 30분 넘게 앞인 방문·빈 목록·모르는 줄은 판 없음, 기간 말 없음', async () => {
  const { meanwhileModel, STALE_MS, FRAME_ICONS } = await load('day-meanwhile.mjs');
  const { TOWN_LINES } = await load('town/data.gen.mjs');
  const visit = 5_000_000_000;
  const m = meanwhileModel({ visit, lines: [{ id: 'village.changes.tray.1', npc: 'workshop-owner' }, { id: 'village.changes.pair.1', npc: 'cafe-owner', npc2: 'researcher' }] }, { firstPulseAt: visit + 1000 });
  assert.equal(m.visit, visit);
  assert.equal(m.lines[0].text, '공방 주인이 찻집 쟁반 받침을 새로 맞춰 두었어요.');
  assert.ok(m.lines[1].text.includes('찻집 주인') && m.lines[1].text.includes('연구원') && !/[{}]/.test(m.lines[1].text));
  assert.deepEqual(m.lines.map(l => l.icon), [FRAME_ICONS.tray, FRAME_ICONS.pair]);
  assert.equal(meanwhileModel({ visit, lines: [{ id: 'village.changes.tray.1', npc: 'cafe-owner' }] }, { firstPulseAt: visit + STALE_MS + 1 }), null);
  assert.ok(meanwhileModel({ visit, lines: [{ id: 'village.changes.tray.1', npc: 'cafe-owner' }] }, { firstPulseAt: visit + STALE_MS }));
  assert.equal(meanwhileModel({ visit, lines: [] }), null);
  assert.equal(meanwhileModel({ visit, lines: [{ id: 'village.changes.unknown.1', npc: 'cafe-owner' }] }), null);
  assert.equal(meanwhileModel(null), null);
  // Every frame has its picture, and no filled line carries a period word (the same list the lines check uses).
  const { FORBIDDEN } = await import(pathToFileURL(path.join(ROOT, 'tools/town-lines-check.mjs')).href);
  for (const line of TOWN_LINES.filter(l => l.kind === 'changes')) {
    const frame = line.id.split('.')[2];
    assert.ok(FRAME_ICONS[frame], frame);
    const shown = meanwhileModel({ visit, lines: [{ id: line.id, npc: 'researcher', npc2: 'cafe-owner' }] }).lines[0].text;
    for (const rule of FORBIDDEN) for (const pattern of rule.patterns) assert.ok(!pattern.test(shown), `${line.id}: ${shown}`);
  }
});

test('수첩 — 자주 오는 때 줄(끄기·켜기, PREF_VISIT_BANDS)과 평가 신호 줄: 켠 호스트는 상태·좋아요·자세히, 끈 호스트는 동의한 사람에게 그만 쓰기만, 학원은 안내만', async () => {
  const { notebookModel, evalRecordOf } = await load('day-notebook.mjs');
  const { EVAL_CONSENT } = await load('town/data.gen.mjs');
  const snap = (state, evalSignals) => ({ state: { scope: { subject: 'acct-1' }, ...state }, view: { day: { scene: { village: null } } }, capabilities: { evalSignals } });
  const on = notebookModel(snap({ visitBands: { ring: [], day: null, off: false } }, true)).settings.find(s => s.kind === 'visit-bands');
  assert.deepEqual(on.action, ['PREF_VISIT_BANDS', { on: false }, '끄기']);
  const off = notebookModel(snap({ visitBands: { ring: [], day: null, off: true } }, true)).settings.find(s => s.kind === 'visit-bands');
  assert.deepEqual(off.action, ['PREF_VISIT_BANDS', { on: true }, '켜기']);
  assert.equal(notebookModel(snap({}, true)).settings.some(s => s.kind === 'visit-bands'), false, '옛 세계(칸 없음)는 줄 없음');
  const consent = state => ({ consents: { evalSignals: { state } } });
  assert.deepEqual(evalRecordOf(snap(consent('unasked'), true)), { on: false, stopOnly: false, ver: EVAL_CONSENT.ver, detail: EVAL_CONSENT.detail });
  assert.equal(evalRecordOf(snap(consent('declined'), true)).on, false);
  assert.equal(evalRecordOf(snap(consent('granted'), true)).on, true);
  assert.equal(evalRecordOf(snap(consent('unasked'), false)), null, '끈 호스트·동의 전: 줄 없음');
  assert.equal(evalRecordOf(snap(consent('withdrawn'), false)), null);
  assert.deepEqual({ ...evalRecordOf(snap(consent('granted'), false)), detail: undefined, ver: undefined }, { on: true, stopOnly: true, detail: undefined, ver: undefined }, 'F8: 끈 호스트의 동의 → 그만 쓰기만');
  assert.deepEqual(evalRecordOf({ ...snap(consent('unasked'), true), state: { scope: { subject: 'linked-class-1' }, ...consent('unasked') } }), { academy: true });
  assert.equal(evalRecordOf(snap({}, true)), null, '동의 칸이 없는 세계');
});

test('서빙 목록 셋 — 미리 보기 서버·WORLD 미리 보기 서버·공개 빌드가 새 화면 파일 넷을 싣는다', () => {
  const files = ['day-ask.mjs', 'day-ask.css', 'day-meanwhile.mjs', 'day-meanwhile.css'];
  const preview = fs.readFileSync(path.join(ROOT, 'experiences/synk-town/server.mjs'), 'utf8');
  const world = fs.readFileSync(path.join(ROOT, 'experiences/synk-world-app/server.mjs'), 'utf8');
  const build = fs.readFileSync(path.join(ROOT, 'tools/build-world-app-public.mjs'), 'utf8');
  for (const file of files) {
    assert.ok(preview.includes(`'/${file}'`), `미리 보기 ${file}`);
    assert.ok(world.includes(file.replace(/[.]/g, '\\.')), `WORLD ${file}`);
    assert.ok(build.includes(`'${file}'`), `공개 빌드 ${file}`);
    assert.ok(fs.existsSync(path.join(ROOT, 'experiences/synk-town', file)), file);
  }
});

test('W10 취향 묻기 — 읽기 자리의 안정 판으로 묻는다(판을 모르면 L2)', async () => {
  const { askModel } = await load('day-ask.mjs'), { ASK_LINES } = await load('town/data.gen.mjs');
  const levels = ASK_LINES.find(line => line.family === 'cafe-life').levels, ask = { key: 'taste:cafe-life', kind: 'taste', family: 'cafe-life' };
  assert.equal(askModel(ask, { level: 'L4' }).line, levels.L4);
  assert.equal(askModel(ask, { level: 'L1' }).line, levels.L1);
  assert.equal(askModel(ask).line, levels.L2);
  assert.equal(askModel(ask, { level: 'L9' }).line, levels.L2);
});
