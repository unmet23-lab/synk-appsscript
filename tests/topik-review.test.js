'use strict';
// TOPIK 문항 AI 2중 검수 도구(tools/topik-review.mjs)의 요청 꼴·합치기·반영. 네트워크와 실제 키는 쓰지 않는다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const tool = () => import(pathToFileURL(path.join(root, 'tools/topik-review.mjs')));
const validate = () => import(pathToFileURL(path.join(root, 'experiences/topik-items/validate.mjs')));

const view = (answer = 1, extra = {}) => ({ existing: false, exam: 'topik-i', officialType: { id: 'TI-R-43' }, skillId: 'ko.reading.detail', difficulty: 1,
  passage: '글', script: null, question: '물음', choices: ['가', '나', '다', '라'], answer, explanation: { ko: '해설', en: 'why', mn: 'яагаад' }, choiceNotes: ['a', 'b', 'c', 'd'], ...extra });
const packet = units => ({ name: 'p', rubric: { id: 'topik-review-r1', sha: '0'.repeat(16) }, units });
const criteria = Object.fromEntries(['answer_unique', 'distractors', 'type_fit', 'level_fit', 'naturalness', 'explanation', 'culture_bias', 'exam_similarity', 'skill_fit', 'difficulty_fit'].map(c => [c, { ok: true, note: '' }]));
const review = (verdict, solved = 1, extra = {}) => ({ solved, verdict, criteria, fixes: [], suggestedSkillId: null, suggestedDifficulty: null, summary: verdict, ...extra });
const blind = (solved = 1, alsoDefensible = []) => ({ solved, confidence: 'high', alsoDefensible, reason: '근거' });
const succeeded = (custom_id, value, extra = {}) => ({ custom_id, result: { type: 'succeeded', message: { model: 'claude-opus-5-5', stop_reason: 'end_turn',
  content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: JSON.stringify(value) }], usage: { input_tokens: 10, output_tokens: 10 }, ...extra } } });

test('Claude 일괄 요청: 문항마다 블라인드 풀이와 기준 검수 둘, 기준은 1시간 캐시, 블라인드에는 정답·해설이 없다', async () => {
  const { claudeRequests, BLIND_SCHEMA, REVIEW_SCHEMA } = await tool();
  const requests = claudeRequests(packet([{ ref: 'u001', view: view() }, { ref: 'u002', view: view(2) }]), { text: '기준', sha: 'x' });
  assert.deepEqual(requests.map(r => r.custom_id), ['u001-blind', 'u001-review', 'u002-blind', 'u002-review']);
  for (const r of requests) {
    assert.equal(r.params.model, 'claude-opus-5-5');
    assert.deepEqual(r.params.system[0].cache_control, { type: 'ephemeral', ttl: '1h' });
    assert.equal(r.params.thinking, undefined); // Opus 5.5는 적응형 생각이 기본이고 끌 수 없다
    assert.equal('fallbacks' in r.params, false); // 일괄은 fallbacks를 거절한다
  }
  assert.deepEqual(requests[0].params.output_config.format.schema, BLIND_SCHEMA);
  assert.deepEqual(requests[1].params.output_config.format.schema, REVIEW_SCHEMA);
  const blindBody = requests[0].params.messages[0].content;
  assert.equal(blindBody.includes('"answer"'), false);
  assert.equal(blindBody.includes('"explanation"'), false);
  assert.equal(requests[1].params.messages[0].content.includes('"answer": 1'), true);
  // 같은 기준 글이면 모든 요청의 system이 바이트까지 같다(캐시 앞부분).
  assert.equal(new Set(requests.map(r => JSON.stringify(r.params.system))).size, 1);
});

test('합치기: 둘 다 통과만 통과, 블라인드 풀이·역번역이 어긋나면 고침, 하나만 통과면 엇갈림 → 판정이 결론', async () => {
  const { parseClaudeResults, merge } = await tool();
  const units = ['u001', 'u002', 'u003', 'u004', 'u005'].map(ref => ({ ref, view: view() }));
  const p = packet(units);
  const claude = parseClaudeResults(p, [
    succeeded('u001-blind', blind()), succeeded('u001-review', review('pass')),
    succeeded('u002-blind', blind(2)), succeeded('u002-review', review('pass')),
    succeeded('u003-blind', blind()), succeeded('u003-review', review('pass')),
    succeeded('u004-blind', blind()), succeeded('u004-review', review('drop')),
    succeeded('u005-blind', blind()), { custom_id: 'u005-review', result: { type: 'errored', error: { type: 'overloaded_error' } } },
  ]);
  const argonRow = (ref, verdict, ok = true) => ({ ref, ...review(verdict), backTranslation: { en: '왜', mn: '왜' }, translation_match: { ok, note: ok ? '' : '근거가 다름' } });
  const argon = { results: { u001: argonRow('u001', 'pass'), u002: argonRow('u002', 'pass'), u003: argonRow('u003', 'pass', false), u004: argonRow('u004', 'drop'), u005: argonRow('u005', 'pass') } };
  const merged = merge(p, claude, argon);
  assert.deepEqual(Object.fromEntries(Object.entries(merged).map(([ref, m]) => [ref, m.outcome])),
    { u001: 'pass', u002: 'split', u003: 'split', u004: 'drop', u005: 'incomplete' });
  assert.match(merged.u002.claude.notes, /블라인드 풀이 2/);
  assert.match(merged.u003.argon.notes, /역번역 불일치/);
  const judged = merge(p, claude, argon, { u002: { verdict: 'fix', reason: '정답이 둘' }, u003: { verdict: 'pass', reason: '사소함' } });
  assert.deepEqual([judged.u002.outcome, judged.u003.outcome], ['fix', 'pass']);
});

test('아르곤: 문항을 묶어 차례로 부르고, 목록 끝을 못 본 답은 버리며, 이미 받은 문항은 다시 부르지 않는다', async () => {
  const { runArgon, argonPrompt } = await tool();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'topik-review-'));
  try {
    const units = ['u001', 'u002', 'u003'].map(ref => ({ ref, view: view() }));
    const prompts = [];
    let round = 0;
    const call = async ({ prompt, schema }) => {
      prompts.push(prompt); round += 1;
      assert.ok(schema.properties.items);
      const refs = [...prompt.matchAll(/## ref (u\d{3})/g)].map(m => m[1]);
      if (round === 1) return { text: JSON.stringify({ seen: [...refs, 'truncated'], items: [] }), selectedModel: 'gemini-4-argon-high' };
      return { text: JSON.stringify({ seen: refs, items: refs.map(ref => ({ ref, ...review('pass'), backTranslation: { en: '', mn: '' }, translation_match: { ok: true, note: '' } })) }), selectedModel: 'gemini-4-argon-high' };
    };
    const quiet = () => {};
    let state = await runArgon(packet(units), dir, { groupSize: 2, call, log: quiet });
    assert.deepEqual(Object.keys(state.results).sort(), ['u003']);
    assert.match(state.calls[0].error, /잘림/);
    state = await runArgon(packet(units), dir, { groupSize: 2, call, log: quiet });
    assert.deepEqual(Object.keys(state.results).sort(), ['u001', 'u002', 'u003']);
    assert.equal(prompts.length, 3);
    const { marker, prompt } = argonPrompt(units, { text: '기준', sha: 'x' });
    assert.ok(prompt.trimEnd().endsWith(marker));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('반영: 새 문항에는 그 내용 지문으로 검수 줄을 달고, 검수 뒤 바뀐 문항은 건드리지 않으며, 기존 문항은 허용 목록에 쓴다', async () => {
  const { applyToItems, applyToExisting } = await tool();
  const { contentHash, reviewOutcome } = await validate();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'topik-bank-'));
  try {
    fs.mkdirSync(path.join(dir, 'items')); fs.mkdirSync(path.join(dir, 'review'));
    const base = { rev: 1, exam: 'topik-i', section: 'reading', officialType: 'TI-R-43', targetGrade: 1, skillId: 'ko.reading.detail', difficulty: 1,
      passage: '글', script: null, question: '물음', choices: ['가', '나', '다', '라'], answer: 1, explanation: { ko: '해설', en: 'why', mn: 'яагаад' },
      choiceNotes: ['a', 'b', 'c', 'd'], reviewStatus: 'draft', review: [] };
    const items = [{ id: 't-001', ...base }, { id: 't-002', ...base, passage: '다른 글' }];
    fs.writeFileSync(path.join(dir, 'items/t.json'), JSON.stringify({ schema: 'topik-item-1', batch: 't', author: '시험', items }));
    fs.writeFileSync(path.join(dir, 'review/existing-verdicts.json'), JSON.stringify({ version: 'topik-existing-verdicts-1', items: [] }));
    const units = [
      { ref: 'u001', kind: 'new', file: 'items/t.json', id: 't-001', rev: 1, hash: contentHash(items[0]), view: view() },
      { ref: 'u002', kind: 'new', file: 'items/t.json', id: 't-002', rev: 1, hash: 'ffffffffffffffff', view: view() }, // 그 뒤 바뀐 문항
      { ref: 'u003', kind: 'existing', key: 'blank-slice.p01.v1', source: 'blank-slice', hash: 'aaaaaaaaaaaaaaaa',
        meta: { itemKey: 'blank-slice.p01.v1', familyKey: 'blank-slice.p01.v1', skillId: 'ko.reading.grammar', difficulty: 1, responseFormat: 'single-choice' }, view: view(0, { officialType: { id: 'TI-R-34' } }) },
      { ref: 'u004', kind: 'existing', key: 'synk-town.x.v1', source: 'synk-town', hash: 'bbbbbbbbbbbbbbbb',
        meta: { itemKey: 'synk-town.x.v1', familyKey: 'synk-town.x.v1', skillId: 'ko.reading.detail', difficulty: 1, responseFormat: 'single-choice' }, view: view(0) },
    ];
    const pass = { outcome: 'pass', claude: { verdict: 'pass', notes: 'ok' }, argon: { verdict: 'pass', notes: 'ok' }, judge: null };
    const merged = { u001: pass, u002: pass, u003: pass, u004: { ...pass, claude: { verdict: 'pass', notes: 'ok', suggestedSkillId: 'ko.reading.reason' } } };
    const changed = applyToItems(packet(units), merged, { dir, at: '2026-10-21T00:00:00.000Z' });
    assert.deepEqual(changed, ['t-001']);
    const saved = JSON.parse(fs.readFileSync(path.join(dir, 'items/t.json'), 'utf8')).items;
    assert.equal(saved[0].reviewStatus, 'ai-reviewed');
    assert.equal(reviewOutcome(saved[0]), 'pass');
    assert.equal(saved[1].reviewStatus, 'draft');
    applyToExisting(packet(units), merged, { dir, at: '2026-10-21T00:00:00.000Z' });
    const rows = JSON.parse(fs.readFileSync(path.join(dir, 'review/existing-verdicts.json'), 'utf8')).items;
    assert.deepEqual(rows.map(r => [r.itemKey, r.verdict, r.skillId, r.suggestedSkillId || null]),
      [['blank-slice.p01.v1', 'pass', 'ko.reading.grammar', null], ['synk-town.x.v1', 'fix', 'ko.reading.detail', 'ko.reading.reason']]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('--미판정: 지금 지문으로 판정을 받은 문항만 빠지고, 고쳐 rev·지문이 바뀐 문항과 기존 문항의 바뀐 원고는 다시 들어간다', async () => {
  const { alreadyJudged } = await tool();
  const line = (rev, hash, stage = 'claude') => ({ stage, model: 'm', rubric: 'r', at: '2026-10-21T00:00:00.000Z', verdict: 'fix', rev, hash });
  const unit = { kind: 'new', rev: 2, hash: 'bbbbbbbbbbbbbbbb' };
  assert.equal(alreadyJudged(unit, { review: [] }), false);
  assert.equal(alreadyJudged(unit, { review: [line(1, 'aaaaaaaaaaaaaaaa')] }), false); // 판정 뒤 고친 문항
  assert.equal(alreadyJudged(unit, { review: [line(2, 'bbbbbbbbbbbbbbbb', 'author-fix')] }), false); // 고친 기록만으로는 판정이 아니다
  assert.equal(alreadyJudged(unit, { review: [line(2, 'bbbbbbbbbbbbbbbb')] }), true);
  const verdictHash = new Map([['blank-slice.v01.v1', 'cccccccccccccccc']]);
  assert.equal(alreadyJudged({ kind: 'existing', key: 'blank-slice.v01.v1', hash: 'cccccccccccccccc' }, { verdictHash }), true);
  assert.equal(alreadyJudged({ kind: 'existing', key: 'blank-slice.v01.v1', hash: 'dddddddddddddddd' }, { verdictHash }), false);
  assert.equal(alreadyJudged({ kind: 'existing', key: 'blank-slice.v02.v1', hash: 'cccccccccccccccc' }, { verdictHash }), false);
});
