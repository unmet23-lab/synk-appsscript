'use strict';
// 싱크타운 평가 전용 신호(세로 조각 설계 §20-4, 시험 §20-10 town-eval) — 동의했을 때만 쓰고, 마을 안 계산은 이 갈래를 부르지 않는다(G11).
// 접근 추적(Proxy)은 쓰는 쪽이 생기는 W6에 더하고, import 검사·동의·칸 규칙은 지금 고정한다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
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
