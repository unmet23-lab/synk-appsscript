'use strict';
// TOPIK 연습 문항 묶음(experiences/topik-items)의 검사기와 실제 묶음(2026-10-20).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const load = () => import(require('node:url').pathToFileURL(path.join(root, 'experiences/topik-items/validate.mjs')));
const types = require('../strata/topik-types.json');
const skillIds = rel => new Set(require(rel).nodes.filter(node => node.kind === 'skill').map(node => node.id));
const context = () => ({ types: types.types, skillIds: { 'topik-i': skillIds('../strata/maps/topik-i.json'), 'topik-ii': skillIds('../strata/maps/topik-ii.json') },
  pending: new Set(Object.keys(types.pending || {})) });

function readingItem(extra = {}) {
  return { id: 't-001', rev: 1, family: 't-001', exam: 'topik-i', format: 'pbt', section: 'reading', officialType: 'TI-R-43', targetGrade: 1,
    skillId: 'ko.reading.reason', difficulty: 1, responseFormat: 'single-choice', set: null,
    passage: '오늘 비가 많이 왔습니다. 그래서 저는 우산을 사러 가게에 갔습니다.', script: null, question: '다음을 읽고 내용과 같은 것을 고르십시오.',
    choices: ['비가 와서 우산을 사러 갔습니다.', '날씨가 맑아서 가게에 갔습니다.', '저는 우산을 팔았습니다.', '오늘은 비가 오지 않았습니다.'], answer: 0,
    explanation: { ko: '「비가 많이 왔습니다. 그래서…」라고 했어요.', en: 'It says "비가 많이 왔습니다" (it rained a lot).', mn: 'Их бороо орсон гэж бичсэн.' },
    choiceNotes: ['맞음', '날씨가 맑지 않았음', '산 것이지 판 것이 아님', '비가 왔음'], conceptIds: [], audio: null, origin: 'synk-original',
    reviewStatus: 'draft', review: [], ...extra };
}
const file = items => ({ schema: 'topik-item-1', batch: 't', author: '시험', items });

test('schema.json과 검사기가 같은 필수 칸을 말한다', async () => {
  const { ITEM_REQUIRED, FILE_REQUIRED, ITEM_FIELDS } = await load();
  const schema = require('../experiences/topik-items/schema.json');
  assert.deepEqual([...schema.$defs.item.required].sort(), [...ITEM_REQUIRED].sort());
  assert.deepEqual([...schema.required].sort(), [...FILE_REQUIRED].sort());
  assert.deepEqual(Object.keys(schema.$defs.item.properties).sort(), [...ITEM_FIELDS].sort());
});

test('바른 문항은 통과하고, 자리·능력·급·해설 언어·보기·세트가 틀리면 잡는다', async () => {
  const { validateFile } = await load();
  assert.deepEqual(validateFile(file([readingItem()]), { ...context(), name: 't' }), []);
  const cases = [
    [{ skillId: 'ko.reading.main' }, /TI-R-43의 능력/],
    [{ officialType: 'TI-L-15', section: 'listening' }, /만들지 않는 유형/],
    [{ targetGrade: 3 }, /targetGrade 3/],
    [{ explanation: { ko: '해설', en: 'why', mn: 'why' } }, /키릴/],
    [{ choices: ['가', '가', '나', '다'] }, /겹친다/],
    [{ answer: 4 }, /answer/],
    [{ officialType: 'TI-R-50' }, /세트 자리/],
    [{ id: 'x-001' }, /id는 t-/],
    [{ reviewStatus: 'ai-reviewed' }, /통과 검수가 없다/],
    [{ extra: 1 }, /모르는 칸 extra/],
  ];
  for (const [patch, pattern] of cases) {
    const problems = validateFile(file([readingItem(patch)]), { ...context(), name: 't' });
    assert.ok(problems.some(p => pattern.test(p)), `${JSON.stringify(patch)} → ${problems.join(' | ')}`);
  }
});

test('듣기 문항은 대본·소리 칸과 공식 재생 횟수를 지킨다', async () => {
  const { validateFile } = await load();
  const listening = readingItem({ officialType: 'TI-L-17', section: 'listening', skillId: 'ko.listening.negation', passage: null,
    script: [{ speaker: '여자', text: '내일 같이 영화 볼까요?' }, { speaker: '남자', text: '미안해요. 내일은 안 돼요.' }],
    audio: { file: 'audio/t-001.mp3', plays: 2, status: 'pending' } });
  assert.deepEqual(validateFile(file([listening]), { ...context(), name: 't' }), []);
  const once = validateFile(file([{ ...listening, audio: { ...listening.audio, plays: 1 } }]), { ...context(), name: 't' });
  assert.ok(once.some(p => /공식 재생 2/.test(p)));
  const narrator = validateFile(file([{ ...listening, script: [{ speaker: '해설', text: '…' }] }]), { ...context(), name: 't' });
  assert.ok(narrator.some(p => /script 줄 꼴/.test(p)));
});

test('검수 통과는 그때의 내용 지문에만 걸린다 — 고치면 풀린다', async () => {
  const { validateFile, contentHash, reviewOutcome } = await load();
  const item = readingItem();
  const hash = contentHash(item), at = '2026-10-21T00:00:00.000Z';
  item.review = [{ stage: 'claude', model: 'claude-opus-5-5', rubric: 'topik-review-r1', at, verdict: 'pass', rev: 1, hash },
    { stage: 'argon', model: 'gemini-4-argon-high', rubric: 'topik-review-r1', at, verdict: 'pass', rev: 1, hash }];
  item.reviewStatus = 'ai-reviewed';
  assert.equal(reviewOutcome(item), 'pass');
  assert.deepEqual(validateFile(file([item]), { ...context(), name: 't' }), []);
  const edited = { ...item, choices: [...item.choices.slice(0, 3), '오늘은 눈이 왔습니다.'] };
  assert.equal(reviewOutcome(edited), 'incomplete');
  assert.ok(validateFile(file([edited]), { ...context(), name: 't' }).some(p => /통과 검수가 없다/.test(p)));
  // 엇갈리면 판정(adjudication)이 결론을 낸다.
  const split = { ...item, review: [item.review[0], { ...item.review[1], verdict: 'fix' }] };
  assert.equal(reviewOutcome(split), 'split');
  split.review.push({ stage: 'adjudication', model: 'claude-opus-5-5', rubric: 'topik-review-r1', at: '2026-10-21T01:00:00.000Z', verdict: 'pass', rev: 1, hash });
  assert.equal(reviewOutcome(split), 'pass');
});

test('저장소의 실제 문항 묶음이 검사를 통과하고 bank-files.mjs가 목록과 같다', () => {
  const run = spawnSync(process.execPath, [path.join(root, 'tools/topik-items.mjs')], { cwd: root, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stdout + run.stderr);
});

test('화면용 묶음은 검수 통과 문항만 PUBLISHED로 내고 Core 메타를 붙인다', async () => {
  const bank = await import(require('node:url').pathToFileURL(path.join(root, 'experiences/topik-items/bank.mjs')));
  for (const item of bank.PUBLISHED) assert.equal(item.reviewStatus, 'ai-reviewed');
  const sample = readingItem();
  const meta = bank.itemMeta(sample);
  assert.deepEqual([meta.itemKey, meta.familyKey, meta.modality, meta.audioRequired], ['topik-items.t-001.v1', 'topik-items.t-001', 'reading', false]);
  const practice = bank.practiceItem(sample);
  assert.equal(practice.correctId, 'topik-items.t-001.v1.option-0');
  assert.equal(practice.choices.length, 4);
  assert.ok(fs.existsSync(path.join(root, 'experiences/topik-items/review/existing-verdicts.json')));
});

test('대응표 문서(docs/TOPIK_유형_대응표.md)에 공식 자리가 모두 있다 — 원천 JSON과 어긋나지 않게', () => {
  const doc = fs.readFileSync(path.join(root, 'docs/TOPIK_유형_대응표.md'), 'utf8');
  const missing = types.types.map(type => type.id).filter(id => !new RegExp(`\| ${id}( |\|)`).test(doc));
  assert.deepEqual(missing, []);
});
