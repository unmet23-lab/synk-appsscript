// 한글 계열 줄의 levels(4-7 — 단계4_계획 §26-4 · §26-8): 계열 줄이 싣는 난도 집합이 제품(experiences/hangul-stage/core.mjs)이 실제로 내는
// 문항 난도와 맞는가. core.mjs의 회차 짜기(planSession)와 다시 내기(retryItem)를 진도 차례의 앞머리(단원 끝마다) × 단(1~3) × 돌아온 글자 창
// (셋씩) × 회차로 돌리고, 단원마다 앞 단원을 다 만난 사람의 첫 회차(새 글자 확인 — 1단)도 돌린다. 문항 난도는 보기 수, 곧 만난 글자에 달려
// 있어 단만 바꿔서는 다 나오지 않는다(2회차 P3-1).
//   · 계열마다 나온 난도 ⊆ levels — levels 밖 문항은 map.item이 null로 내 새 길 모듈이 기록 없이 낸다(§26-3의 3).
//   · (꼴 × 갈래)마다 나온 난도의 합집합 = levels — 규칙이 너무 넓지 않다. 한 번도 나오지 않는 계열(ㅢ · ㅖ · ㅒ의 음절 만들기, 짝 없는 짝
//     고르기)은 규칙 값을 둔다(한계 — 내지 않는 문항이라 levels가 넓어도 샐 것이 없다).
// 낱말 읽기 문항(word)은 계열 줄이 없어 세지 않는다(§26-2).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT } from '../../tools/map-sources.mjs';

const hs = name => pathToFileURL(path.join(REPO_ROOT, 'experiences', 'hangul-stage', name)).href;
const { createPack } = await import(hs('pack.mjs'));
const core = await import(hs('core.mjs'));
const { itemMetadata } = await import(hs('learning.mjs'));
const layer = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'strata', 'hangul.json'), 'utf8'));
const pack = createPack(layer);
const index = JSON.parse(fs.readFileSync(new URL('../../map/index.json', import.meta.url), 'utf8'));

const at = (day, minutes = 0) => new Date(Date.UTC(2026, 9, 5 + day, 1, minutes)).toISOString();
const SESSIONS = 4;
const WINDOW = 3;

const UNITS = layer.units.filter(u => Array.isArray(u.letters) && u.letters.length);

// 만난 글자 met · 단 difficulty · 다시 올 글자 due(나머지는 먼 날)로 진도를 짓는다.
function progressOf(met, difficulty, due) {
  const p = {
    ...(met.length ? core.meet(core.emptyProgress(), met, at(0)) : core.emptyProgress()),
    difficulty,
  };
  for (const id of met) p.letters[id] = { ...p.letters[id], due: due.has(id) ? at(0) : at(40) };
  return p;
}

function planned(p, sessions, record) {
  for (let s = 0; s < sessions; s += 1)
    for (const step of core.planSession(p, pack, { now: at(1, s), sessionNo: s }).steps)
      if (step.kind === 'item') record(step.item);
}

function retried(p, ids, record) {
  for (const id of ids)
    for (const avoid of [null, 'listen_pick', 'see_pick'])
      for (let n = 0; n < 2; n += 1) {
        const item = core.retryItem(p, pack, id, { now: at(1), sessionNo: 0, n, avoid });
        if (item) record(item);
      }
}

function sweep() {
  const seen = new Map();
  const note = meta => {
    if (!seen.has(meta.familyKey)) seen.set(meta.familyKey, new Set());
    seen.get(meta.familyKey).add(meta.difficulty);
  };
  const record = item => {
    if (item.word) return;
    if (item.type === 'match') for (const card of item.cards) note(itemMetadata(item, card.letter));
    else note(itemMetadata(item));
  };
  // 단원 끝마다 그때까지 만난 글자 × 단 × 돌아온 글자 창.
  for (let u = 0; u < UNITS.length; u += 1) {
    const met = UNITS.slice(0, u + 1).flatMap(x => x.letters);
    for (const difficulty of [1, 2, 3])
      for (let w = 0; w < met.length; w += 1) {
        const window = new Set(met.slice(w, w + WINDOW));
        const p = progressOf(met, difficulty, window);
        planned(p, SESSIONS, record);
        retried(p, window, record);
      }
  }
  // 단원마다 앞 단원을 다 만난 사람의 첫 회차들(새 글자 확인).
  for (let u = 0; u < UNITS.length; u += 1) {
    const met = UNITS.slice(0, u).flatMap(x => x.letters);
    for (const difficulty of [1, 2, 3])
      planned(progressOf(met, difficulty, new Set()), SESSIONS * 3, record);
  }
  return seen;
}

const tAt = field => index.templateFields.indexOf(field);
const families = new Map(index.families.map(([n, key]) => [n, key]));
const hangulRows = index.templates
  .filter(row => row[tAt('bank')] === 'hangul-stage')
  .map(row => ({ familyKey: families.get(row[tAt('f')]), levels: row[tAt('levels')] }));
const classOf = familyKey => {
  const [, type, letter] = familyKey.split('.');
  const row = layer.letters.find(([id]) => id === letter);
  const u7 = layer.units.find(u => u.id === 'U7')?.letters?.includes(letter);
  return `${type} ${row?.[2]}${u7 ? '(U7)' : ''}`;
};

test('한글 계열 줄의 levels는 core.mjs가 내는 문항 난도와 맞는다(4-7 §26-4 · §26-8)', () => {
  assert.equal(hangulRows.length, 285, '꼴 여섯 × 글자 마흔아홉(받침은 짝 맞추기 없음)');
  for (const row of hangulRows) {
    assert.ok(Array.isArray(row.levels) && row.levels.length, `${row.familyKey}: levels가 있다`);
    assert.deepEqual([...row.levels].sort(), [...new Set(row.levels)].sort(), row.familyKey);
  }
  const seen = sweep();
  const byClass = new Map();
  for (const row of hangulRows) {
    const got = seen.get(row.familyKey) ?? new Set();
    for (const level of got)
      assert.ok(
        row.levels.includes(level),
        `${row.familyKey}: 난도 ${level}이 levels(${row.levels}) 밖`,
      );
    const key = classOf(row.familyKey);
    if (!byClass.has(key)) byClass.set(key, { levels: row.levels, got: new Set() });
    assert.deepEqual(byClass.get(key).levels, row.levels, `${key}: 같은 갈래의 levels가 같다`);
    for (const level of got) byClass.get(key).got.add(level);
  }
  for (const [key, { levels, got }] of byClass)
    if (got.size)
      assert.deepEqual([...got].sort(), [...levels].sort(), `${key}: 나온 난도의 합집합 = levels`);
  for (const familyKey of seen.keys())
    assert.ok(
      hangulRows.some(row => row.familyKey === familyKey),
      `${familyKey}: 계열 줄이 있다`,
    );
});
