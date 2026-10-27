'use strict';
// 싱크타운 평가 전용 신호(세로 조각 설계 §20-4, 시험 §20-10 town-eval) — 동의했을 때만 쓰고, 마을 안 계산은 이 갈래를 부르지 않는다(G11).
// 접근 추적(Proxy)은 쓰는 쪽이 생기는 W6에 더하고, import 검사·동의·칸 규칙은 지금 고정한다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { ROOT, TOWN, townModule, runtimeFiles } = require('./lib/town.js');

const line = extra => ({ id: 'V-20748-2', lifeDay: 20748, band: 'evening', lengthBucket: '10-30m', paramsVer: 'town-params-1', arm: 'adapted',
  consentVer: 'town-eval-signals-1', did: { 'tea-order': 1 }, newSeenBy: { line: 3 }, seenTotalBy: { line: 41 }, feedback: { helpful: 1 },
  lessOften: 0, todayOther: 0, help: { meaning: 2 }, stoppedScenes: 0, ladderOffer: 'accepted', ...extra });

test('import 검사: 타운 런타임 층 어디서도 평가 갈래를 부르지 않는다(서버 쓰기만 부른다)', () => {
  const importers = [...runtimeFiles(), ...['core.mjs', 'life.mjs', 'day.mjs', 'bazaar.mjs', 'support.mjs', 'presence.mjs']
    .map(file => path.join(ROOT, 'experiences/synk-town', file))]
    .filter(file => path.basename(file) !== 'eval.mjs')
    .filter(file => /from\s+['"][^'"]*eval\.mjs['"]|import\(\s*['"][^'"]*eval\.mjs/.test(fs.readFileSync(file, 'utf8')));
  assert.deepEqual(importers.map(file => path.relative(ROOT, file)), []);
  assert.ok(fs.existsSync(path.join(TOWN, 'eval.mjs')));
});

test('동의 전·거절·철회 뒤에는 한 줄도 쓰지 않고, 철회는 늘 받는다', async () => {
  const e = await townModule('eval');
  const none = e.initialConsents();
  assert.deepEqual(e.writeVisit([], none, line()), [], '동의 전 쓰기 0');
  const granted = e.changeConsent(none, { state: 'granted' });
  const lines = e.writeVisit([], granted, line());
  assert.equal(lines.length, 1);
  assert.equal(e.writeVisit(lines, granted, line({ did: { 'tea-order': 2 } })).length, 1, '방문 id로 덮어쓴다');
  const withdrawn = e.changeConsent(granted, { state: 'withdrawn', ver: 'old-version' });
  assert.equal(withdrawn.evalSignals.state, 'withdrawn');
  assert.deepEqual(e.writeVisit([], withdrawn, line()), [], '철회 뒤 쓰기 0');
  assert.throws(() => e.changeConsent(none, { state: 'granted', ver: 'town-eval-signals-0' }), /version/);
});

test('학원 소속 계정은 켤 수 없고, 철회는 받는다', async () => {
  const e = await townModule('eval');
  assert.throws(() => e.changeConsent(e.initialConsents(), { state: 'granted', academy: true }), error => error.code === 'eval-consent-academy');
  assert.equal(e.changeConsent(e.initialConsents(), { state: 'withdrawn', academy: true }).evalSignals.state, 'withdrawn');
});

test('방문 줄의 칸은 동의 항목의 칸뿐이고, 이름·자유 입력·시각 원문이 없다 · 보관 기간이 지나면 지운다', async () => {
  const e = await townModule('eval');
  const { paramsFor } = await townModule('params');
  assert.deepEqual([...e.VISIT_FIELDS].sort(), [...new Set(['id', ...Object.values(e.CONSENT_ITEMS).flat()])].sort());
  assert.ok(Object.keys(line()).every(key => e.VISIT_FIELDS.includes(key)));
  for (const extra of [{ name: '유호' }, { note: '자유 입력' }, { atMs: 1792663200000 }]) assert.throws(() => e.visitLine(line(extra)), /not in the consent/);
  const keep = paramsFor().eval.retainLifeDays;
  const kept = e.retainVisits([line({ id: 'old', lifeDay: 100 }), line({ id: 'new', lifeDay: 100 + keep - 1 })], 100 + keep);
  assert.deepEqual(kept.map(l => l.id), ['new']);
  assert.equal(e.comparable(paramsFor().eval.minGroup - 1), false);
});

test('방문 요약의 칸 ⊆ 동의 계약 파일의 칸 — 항목과 칸이 계약 그대로이고 동의판이 같다(talk 사본은 tests/계약동기.test.js)', async () => {
  const e = await townModule('eval'), { EVAL_CONSENT } = await townModule('data.gen');
  const contract = JSON.parse(fs.readFileSync(path.join(ROOT, '계약', '마을평가신호_선택응답_계약.json'), 'utf8')).선택응답;
  assert.equal(contract.동의판, e.CONSENT_VER);
  assert.equal(EVAL_CONSENT.ver, e.CONSENT_VER);
  assert.deepEqual(JSON.parse(JSON.stringify(e.CONSENT_ITEMS)), contract.칸);
  const named = Object.values(contract.칸).flat();
  assert.deepEqual(e.VISIT_FIELDS.filter(field => field !== 'id').filter(field => !named.includes(field)), [], '동의 문구가 이름 대지 않은 칸');
  // 쉬운 판은 계약의 다섯 줄과 단추 셋 그대로다(화면이 이 생성물로 묻는다 — W6b).
  assert.equal(EVAL_CONSENT.easy.ask, contract.쉬운판.물음);
  assert.deepEqual(EVAL_CONSENT.easy.buttons, { no: contract.쉬운판.단추.아니요, yes: contract.쉬운판.단추.좋아요, more: contract.쉬운판.단추.자세히 });
});

test('평가 줄 쓰기가 실패해도 그 요청이 센 것은 기다렸다가 다음 요청의 줄에 그대로 든다(GPT 검수 GA5)', async () => {
  const { createStore } = await import(pathToFileURL(path.join(ROOT, 'experiences', 'synk-town', 'server.mjs')).href);
  const e = await townModule('eval');
  // 세계가 그대로이고 평가 줄만 바뀌는 쓰기(keep)만 실패시킨다 — 명령의 저장은 그대로 된다.
  let failing = false, lastWorld = null, saved = null;
  const save = next => {
    const { evalLines = [], ...world } = next, text = JSON.stringify(world);
    if (failing && text === lastWorld) throw new Error('disk full');
    lastWorld = text; saved = { evalLines };
  };
  let now = Date.UTC(2026, 9, 23, 3, 0, 0), sequence = 0, receipt;
  const s = createStore({ now: () => now, tz: 540, villageSeed: 'acct-ga5', save });
  const pulse = () => { now += 1000; receipt = s.pulse({ surfaceId: 'day-a', surface: 'day', foreground: true, safe: true }).presence; };
  const send = (type, payload) => s.execute({ id: `ga5-${++sequence}`, type, expectedRevision: s.read().state.revision, payload });
  for (let i = 0; i < 4; i++) pulse();
  send('EVAL_CONSENT', { state: 'granted', ver: e.CONSENT_VER });
  for (let i = 0; i < 25; i++) pulse();
  s.boundary({ surfaceId: receipt.surfaceId, fence: receipt.fence });
  assert.equal(saved.evalLines.length, 1);
  assert.equal(saved.evalLines[0].todayOther, 0);
  failing = true;
  send('PREF_TODAY_OTHER', { activity: 'card.C1' });
  assert.equal(saved.evalLines[0].todayOther, 0, '줄 쓰기만 실패했다');
  failing = false;
  send('PREF_TODAY_OTHER', { activity: 'card.C3' });
  assert.equal(saved.evalLines.length, 1);
  assert.equal(saved.evalLines[0].todayOther, 2, '실패한 요청이 센 하나도 남는다');
});
