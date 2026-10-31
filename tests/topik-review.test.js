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

test('반영: 판을 올린 기존 문항은 같은 문항의 옛 판 줄을 새 판 줄로 갈아 끼우고, 같은 계열의 다른 문항 줄은 그대로 둔다', async () => {
  const { applyToExisting } = await tool();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'topik-bank-'));
  try {
    fs.mkdirSync(path.join(dir, 'review'));
    const row = (itemKey, familyKey, verdict) => ({ itemKey, familyKey, verdict, source: 'x', skillId: 'ko.reading.grammar', difficulty: 1, responseFormat: 'single-choice', hash: 'h' });
    fs.writeFileSync(path.join(dir, 'review/existing-verdicts.json'), JSON.stringify({ version: 'topik-existing-verdicts-1', items: [
      row('blank-slice.e06.v1', 'blank-slice.e06.v1', 'fix'), row('blank-slice.e07.v2', 'blank-slice.e07.v1', 'fix'),
      row('korean-rhythm:t1q0:v1:claim1', 'korean-rhythm:t1q0:v1', 'fix'), row('korean-rhythm:t1q0:v1:claim0', 'korean-rhythm:t1q0:v1', 'pass')] }));
    const unit = (ref, key, familyKey, source) => ({ ref, kind: 'existing', key, source, hash: 'cccccccccccccccc',
      meta: { itemKey: key, familyKey, skillId: 'ko.reading.grammar', difficulty: 1, responseFormat: 'single-choice' }, view: view(0) });
    const units = [unit('u001', 'blank-slice.e06.v2', 'blank-slice.e06.v1', 'blank-slice'), unit('u002', 'blank-slice.e07.v2', 'blank-slice.e07.v1', 'blank-slice'),
      unit('u003', 'korean-rhythm:t1q0:v1:claim1:v2', 'korean-rhythm:t1q0:v1', 'korean-rhythm')];
    const pass = { outcome: 'pass', claude: { verdict: 'pass', notes: 'ok' }, argon: { verdict: 'pass', notes: 'ok' }, judge: null };
    applyToExisting(packet(units), { u001: pass, u002: pass, u003: pass }, { dir, at: '2026-10-21T00:00:00.000Z' });
    const rows = JSON.parse(fs.readFileSync(path.join(dir, 'review/existing-verdicts.json'), 'utf8')).items;
    assert.deepEqual(rows.map(r => [r.itemKey, r.verdict]), [['blank-slice.e06.v2', 'pass'], ['blank-slice.e07.v2', 'pass'],
      ['korean-rhythm:t1q0:v1:claim0', 'pass'], ['korean-rhythm:t1q0:v1:claim1:v2', 'pass']]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('레이싱 그림 낱말: 공식 자리 없이, 들리는 낱말과 그림마다 그 낱말을 붙여 검수자가 대조한다', async () => {
  const { existingItemView } = await tool();
  const item = { source: 'korean-racing', ask: 'picture', label: '사과', skillId: 'ko.listening.word', difficulty: 1, prompt: null, question: '들리는 낱말의 그림을 고르세요.',
    choices: [{ id: 'w0001', label: '🍎' }, { id: 'w0003', label: '🍇' }, { id: 'w9999', label: '❓' }], correctId: 'w0001', explanation: '들린 낱말은 「사과」예요.' };
  const v = existingItemView(item, [], { 'ko.listening.word': '낱말 듣기' });
  assert.equal(v.officialType, null);
  assert.equal(v.passage, '[소리로 들리는 낱말] 사과');
  assert.deepEqual(v.choices, ['🍎(사과)', '🍇(포도)', '❓']);
  assert.equal(v.answer, 0);
  assert.match(v.format, /공식 시험 자리는 없다/);
});

test('듣기 게임 기존 문항(말 랠리·바람길·리듬): 들리는 글 전체를 대본으로 보이고, 말 랠리는 대답 자리(1~4·5~6번)에 맞춘다', async () => {
  const { existingItemView } = await tool();
  const types = [{ id: 'TI-L-01', numbers: [1, 4], task: '듣고 물음에 맞는 대답 고르기', skills: ['ko.listening.response'] }, { id: 'TI-L-05', numbers: [5, 6], task: '듣고 이어지는 말 고르기', skills: ['ko.listening.response'] }];
  const rally = { source: 'talk-rally', kind: 'follow', skillId: 'ko.listening.response', difficulty: 1, question: null, explanation: '고마울 때 하는 대답이에요.',
    choices: [{ id: 'talk-rally.f01.0', label: '아니에요.' }, { id: 'talk-rally.f01.1', label: '네, 고마워요.' }], correctId: 'talk-rally.f01.0' };
  const v = existingItemView(rally, types, {}, { script: [{ speaker: '몽글', text: '고마워요.' }] });
  assert.equal(v.officialType.id, 'TI-L-05');
  assert.deepEqual(v.script, [{ speaker: '몽글', text: '고마워요.' }]);
  assert.equal(v.passage, null);
  assert.equal(v.answer, 0);
  assert.match(v.format, /대답 카드/);
  assert.equal(existingItemView({ ...rally, kind: 'answer' }, types, {}, { script: [] }).officialType.id, 'TI-L-01');
  const rhythm = existingItemView({ source: 'korean-rhythm', skillId: 'ko.listening.detail', difficulty: 1, question: null, explanation: '내일이에요.',
    choices: [{ id: 'korean-rhythm.o', label: 'O · 맞아요' }, { id: 'korean-rhythm.x', label: 'X · 아니에요' }], correctId: 'korean-rhythm.o' }, types, {}, { script: [{ speaker: '이야기', text: '내일 가요.' }, { speaker: '묻는 말', text: '내일 가나요?' }] });
  assert.equal(rhythm.officialType, null);
  assert.equal(rhythm.script.length, 2);
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

// ── 찻집 주문 틀(rubric-compose-r1, W10) ──
test('찻집 주문 틀 — 채운 예마다 정답은 묶음 밖에 두고, 블라인드 풀이가 어긋난 판은 평가 판에서 빠지며, 두 검수자가 다 낸 L1 · L2만 증거에 적는다', async () => {
  const t = await tool();
  const units = await t.teaUnits(['guest.tea.req-same-all.1', 'guest.tea.react-again.1']);
  const [req, line] = units;
  assert.equal(req.role, 'request'); assert.equal(line.role, 'line');
  assert.ok(!JSON.stringify(req.view).includes('"answers"') && !JSON.stringify(req.view).includes('barley'), '풀이에 보이는 글에는 정답 값이 없다');
  assert.ok(req.view.판.L2.every(s => s.앞손님), '「같은 걸로」 틀은 앞 손님 말을 함께 준다');
  assert.equal(new Set(req.answers.L1.map(a => a.tea)).size, 3, '차 셋이 한 번씩');
  const right = Object.entries(req.answers).flatMap(([level, rows]) => rows.map(r => ({ level, ...r })));
  assert.deepEqual(t.composeMisses(req, right), []);
  const wrongL2 = right.map(r => (r.level === 'L2' && r.n === 1 ? { ...r, sweet: 2 } : r));
  assert.deepEqual(t.composeMisses(req, wrongL2), [{ level: 'L2', n: 1, axis: 'sweet' }]);
  req.ref = 'u001'; line.ref = 'u002';
  const p = { name: 'tea', rubric: { id: t.COMPOSE_RUBRIC_ID, sha: '0'.repeat(16) }, units: [req, line] };
  const reqs = t.claudeRequests(p);
  assert.deepEqual(reqs.map(r => r.custom_id), ['u001-blind', 'u001-review', 'u002-review'], '요청 틀은 풀이 + 검수, 손님 줄은 검수만');
  assert.ok(!reqs[0].params.messages[0].content.includes('# 정답'), '블라인드 풀이에는 정답을 주지 않는다');
  assert.ok(!t.argonComposePrompt([req]).prompt.includes('"tea": "barley"'), '아르곤에도 정답을 주지 않는다');
  const ok = levels => ({ verdict: 'pass', criteria: {}, levelsOk: levels, fixes: [], summary: '좋음' });
  const claude = { u001: { blind: { solved: wrongL2, reason: '단맛을 달게로 읽음' }, review: ok(['L1', 'L2', 'L3', 'L4']), errors: [] }, u002: { review: ok(['L1', 'L2', 'L3', 'L4']), errors: [] } };
  const argon = { results: { u001: { ...ok(['L1', 'L2', 'L3']), solved: right }, u002: ok(['L1', 'L2', 'L3', 'L4']) } };
  const merged = t.merge(p, claude, argon);
  assert.equal(merged.u001.outcome, 'split', 'Claude 풀이가 어긋나면 fix — 아르곤 pass와 엇갈림');
  assert.deepEqual(merged.u001.claude.levelsOk, ['L1', 'L3', 'L4']);
  const judged = t.merge(p, claude, argon, { u001: { verdict: 'pass', reason: '「달게요」는 꿀 두 숟가락', fixes: [], levelsOk: ['L1', 'L2', 'L3'] } });
  assert.deepEqual(t.teaEvidenceRows(p, judged), [{ id: req.id, hash: req.hash, verdict: 'pass', levels: ['L1', 'L2'], packet: 'tea' }]);
  assert.deepEqual(t.teaEvidenceRows(p, merged), [], '엇갈린 채로는 증거에 적지 않는다');
});

test('찻집 평가 판 — W10 증거는 기준 · 판정 계약 · 두 검수자가 맞을 때만, 틀 지문이 같은 줄만 받는다', async () => {
  const { teaAssessmentMetadata, teaReviewUnitHash, TEA_JUDGE } = await import(pathToFileURL(path.join(root, 'tools/lib/town-tea-review-unit.mjs')));
  const lines = JSON.parse(fs.readFileSync(path.join(root, 'experiences/synk-town/town/data/lines/tea.json'), 'utf8'));
  const axes = JSON.parse(fs.readFileSync(path.join(root, 'experiences/synk-town/town/data/tea.json'), 'utf8')).axes;
  const frame = lines.find(l => l.id === 'guest.tea.req-mine.1');
  const doc = { task: 'town-w10-tea', rubric: 'rubric-compose-r1', judge: TEA_JUDGE, reviewers: [{ stage: 'claude', model: 'claude-opus-5-5' }, { stage: 'argon', model: 'gemini-4-argon-high' }],
    results: [{ id: frame.id, hash: teaReviewUnitHash(frame, axes), verdict: 'pass', levels: ['L1', 'L2'] }] };
  assert.deepEqual(teaAssessmentMetadata([frame], axes, null, doc)[frame.id].levels, ['L1', 'L2']);
  assert.deepEqual(teaAssessmentMetadata([frame], axes, null, { ...doc, reviewers: [{ stage: 'claude', model: 'x' }] })[frame.id].levels, [], '2차 검수자가 없으면 받지 않는다');
  assert.deepEqual(teaAssessmentMetadata([frame], axes, null, { ...doc, rubric: 'topik-review-r1' })[frame.id].levels, []);
  const changed = { ...frame, levels: { ...frame.levels, L2: frame.levels.L2 + ' ' } };
  assert.deepEqual(teaAssessmentMetadata([changed], axes, null, doc)[frame.id].levels, [], '검수 뒤 바뀐 글은 받지 않는다');
  assert.deepEqual(teaAssessmentMetadata([frame], axes, null, { ...doc, results: [{ ...doc.results[0], verdict: 'drop' }] })[frame.id].levels, []);
});

// ── 드라마 말하기 대사 칸 명세(drama-spec-r1, 결정 10-31 ③) ──
const episodeFile = path.join(root, 'experiences/drama/s1/ep01.mjs');
const freshImport = file => import(`${pathToFileURL(file).href}?t=${Date.now()}-${Math.random().toString(36).slice(2)}`);
test('드라마 대사 — 블라인드 몫에는 명세 · 판정 시험이 없고, 검수 몫에는 도구가 지금 명세로 돌린 판정 시험이 붙으며, 지문은 빌더와 같은 단위로 잰다', async () => {
  const t = await tool();
  const { dramaReviewRows, dramaSpecUnit, dramaSpecHash } = await import(pathToFileURL(path.join(root, 'tools/lib/drama-spec-review-unit.mjs')));
  const ep = (await freshImport(episodeFile)).default;
  const units = await t.dramaUnits(null, { episodes: [ep] });
  assert.deepEqual([units.filter(u => u.role === 'scene').length, units.filter(u => u.role === 'unseen').length], [9, 8]);
  const rows = dramaReviewRows(ep);
  for (const [i, u] of units.entries()) {
    assert.equal(u.hash, dramaSpecHash(dramaSpecUnit(rows[i], ep.id)), u.id);
    assert.ok(!('명세' in u.blind) && !('판정_시험' in u.blind) && !JSON.stringify(u.blind).includes('"alts"'), `${u.id} 블라인드에 명세가 없다`);
    assert.equal(u.view.판정_시험[0].결과, '통과 · 확실', `${u.id} 모범 대사는 자기 명세를 확실히 통과`);
  }
  const yo = units.find(u => u.id === 's1e01-3').view.판정_시험.find(r => r.무엇 === '끝 「요」를 뺌');
  assert.match(yo.결과, /^노트 끝맺음/);
  units.forEach((u, i) => { u.ref = `u${String(i + 1).padStart(3, '0')}`; });
  const p = { name: 'drama', rubric: { id: t.DRAMA_RUBRIC_ID, sha: '0'.repeat(16) }, units };
  const reqs = t.claudeRequests(p);
  assert.equal(reqs.length, 34);
  assert.deepEqual(reqs.slice(0, 2).map(r => r.custom_id), ['u001-blind', 'u001-review']);
  assert.ok(reqs.filter(r => r.custom_id.endsWith('-blind')).every(r => !r.params.messages[0].content.includes('"명세"') && !r.params.messages[0].content.includes('판정_시험')), '블라인드 요청에는 명세를 주지 않는다');
  assert.ok(reqs.every(r => r.params.system[0].text.includes(t.DRAMA_RUBRIC_ID) && !r.params.system[0].cache_control), '드라마 일괄은 캐시를 쓰지 않는다(동시에 돌아 캐시 쓰기만 늘었다)');
  assert.ok(t.claudeRequests({ ...p, rubric: { id: 'drama-spec-r1', sha: '0'.repeat(16) } })[0].params.system[0].text.includes('drama-spec-r1'), '앞 판 묶음은 앞 판 기준 글');
  assert.ok(units.find(u => u.id === 's1e01-t8').blind.듣는_사람.startsWith('professor — 교수') && !units.find(u => u.id === 's1e01-t8').blind.듣는_사람.includes('문지영'), '처음 보는 대사는 장면 인물이 아니다');
  const { prompt } = t.argonDramaPrompt(units.slice(0, 2));
  assert.ok(prompt.includes('### 상황') && prompt.includes('### 명세와 판정 시험') && prompt.indexOf('### 상황') < prompt.indexOf('### 명세와 판정 시험'));
});

test('드라마 대사 — 시험 말은 지금 명세로 판정해 오노트 · 너그러움이 있으면 pass를 fix로 내리고, 엇갈리면 판정이 결론이다', async () => {
  const t = await tool();
  const ep = (await freshImport(episodeFile)).default;
  const [u] = await t.dramaUnits(['s1e01-5'], { episodes: [ep] });
  u.ref = 'u001';
  const probe = (say, expect, kind = expect === 'pass' ? 'none' : 'ending') => ({ say, expect, kind, why: '' });
  const clean = [probe('네, 알겠습니다. 감사합니다.', 'pass'), probe('네, 알겠어요. 감사해요, 교수님.', 'pass'), probe('알겠습니다, 교수님. 고맙습니다.', 'pass'),
    probe('네, 알겠어. 고마워, 교수님', 'note'), probe('감사', 'note', 'length'), probe('네, 알겠어. 감사해.', 'note')];
  const r = t.dramaProbeResults(u, clean);
  assert.deepEqual(r.filter(x => t.DRAMA_SERIOUS.includes(x.problem)), [], JSON.stringify(r));
  const falseNote = t.dramaProbeResults(u, [probe('알겠어요, 교수님. 정말 감사해요.', 'pass'), probe('네', 'pass')]);
  assert.equal(falseNote[1].problem, 'false_note', '「네」 한마디는 길이 노트 — 맞는 말이라고 썼으면 오노트로 잡힌다');
  const falseCredit = t.dramaProbeResults(u, [probe('네, 알겠습니다. 감사합니다, 교수님.', 'note')]);
  assert.equal(falseCredit[0].problem, 'false_credit');
  const review = verdict => ({ verdict, criteria: {}, fixes: [], grammarLevels: [], summary: verdict });
  const p = { name: 'drama', rubric: { id: t.DRAMA_RUBRIC_ID, sha: '0'.repeat(16) }, units: [u] };
  const claude = { u001: { blind: { probes: [...clean, probe('네', 'pass')], reason: '' }, review: review('pass'), errors: [] } };
  const argon = { results: { u001: { ...review('pass'), probes: clean } } };
  const merged = t.merge(p, claude, argon);
  assert.equal(merged.u001.claude.verdict, 'fix', 'Claude 시험 말에 오노트가 있어 fix');
  assert.equal(merged.u001.outcome, 'split');
  assert.match(merged.u001.claude.notes, /오노트 「네」/);
  assert.equal(t.merge(p, claude, argon, { u001: { verdict: 'pass', reason: '「네」 한마디는 대사를 한 것이 아니다 — 검수자가 잘못 쓴 시험 말', fixes: [] } }).u001.outcome, 'pass');
  assert.equal(t.merge(p, { u001: { ...claude.u001, blind: { probes: clean.slice(0, 3), reason: '' } } }, argon).u001.outcome, 'incomplete', '시험 말이 넷보다 적으면 결과 없음');
  // 너그러움(노트 줄 말이 확실한 통과)은 처음 보는 대사만 막는다 — 장면 대사는 평가로 세지 않아 「노트를 못 준 것」으로 적기만 한다.
  const lenient = [...clean, probe('네, 알겠습니다. 감사합니다, 교수님.', 'note', 'missing')];
  assert.equal(t.merge(p, { u001: { ...claude.u001, blind: { probes: lenient, reason: '' } } }, argon).u001.outcome, 'pass', '장면 대사의 너그러움은 막지 않는다');
  const [t7] = await t.dramaUnits(['s1e01-t7'], { episodes: [ep] });
  t7.ref = 'u001';
  const unseen = { name: 'drama', rubric: p.rubric, units: [t7] };
  const credit = [probe('선생님 덕분에 살았어요. 정말 감사합니다.', 'pass'), probe('선생님 덕분에 살았어요. 감사합니다.', 'pass'), probe('정말 감사합니다, 선생님.', 'pass'),
    probe('선생님 덕분에 살았어. 정말 고마워.', 'note'), probe('감사', 'note', 'length'), probe('선생님 덕분에 살았어요. 정말 감사합니다.', 'note', 'missing')];
  assert.equal(t.merge(unseen, { u001: { blind: { probes: credit, reason: '' }, review: review('pass'), errors: [] } }, { results: { u001: { ...review('pass'), probes: credit.slice(0, 5) } } }).u001.claude.verdict, 'fix', '처음 보는 대사의 너그러움은 막는다');
  assert.equal(t.judgeRequest(u, merged.u001, 'drama-spec-r1').system[0].text.includes('drama-spec-r1'), true, '묶음은 만든 때의 기준 판으로 판정한다');
  assert.equal(t.judgeRequest(u, merged.u001).system[0].text.includes('drama-spec-r2'), true);
  assert.equal(t.rubricText('drama', 'drama-spec-r1').id, 'drama-spec-r1');
});

test('드라마 대사 — 반영: 통과한 줄에만 검수:passed와 검수지문을 달고 못 넘은 줄은 검수 칸을 지우며, 빌더는 지문이 같을 때만 passed로 싣는다(고치면 풀린다)', async () => {
  const t = await tool();
  const { dramaLines } = await import(pathToFileURL(path.join(root, 'tools/build-world-speaking-talk.mjs')));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'drama-review-'));
  try {
    const file = path.join(dir, 'ep01.mjs'), evidence = path.join(dir, 'spec-review.json');
    fs.copyFileSync(episodeFile, file);
    const units = await t.dramaUnits(['s1e01-1', 's1e01-t2'], { episodes: [(await freshImport(file)).default] });
    units.forEach((u, i) => { u.ref = `u00${i + 1}`; });
    const p = { name: 'drama-test', rubric: { id: t.DRAMA_RUBRIC_ID, sha: '0'.repeat(16) }, units };
    const side = verdict => ({ verdict, notes: verdict, fixes: verdict === 'pass' ? [] : ['keys[0].alts에 「반납일이」 더함'], grammarLevels: [], probes: [] });
    const merged = { u001: { outcome: 'pass', claude: side('pass'), argon: side('pass'), judge: null }, u002: { outcome: 'fix', claude: side('fix'), argon: side('fix'), judge: null } };
    const out = await t.applyToDrama(p, merged, { at: '2026-10-31T00:00:00Z', file: evidence, episodeFiles: [file] });
    assert.deepEqual([out.passed, out.held, out.skipped], [1, 1, []]);
    const text = fs.readFileSync(file, 'utf8');
    assert.ok(text.includes(`id:'s1e01-1',검수:'passed',검수지문:'${units[0].hash}',`));
    assert.ok(!/id:'s1e01-t2',검수/.test(text));
    const doc = JSON.parse(fs.readFileSync(evidence, 'utf8'));
    assert.deepEqual(doc.results.map(r => [r.id, r.verdict, r.hash]), [['s1e01-1', 'pass', units[0].hash], ['s1e01-t2', 'fix', units[1].hash]]);
    assert.deepEqual(doc.results[1].fixes, ['keys[0].alts에 「반납일이」 더함']);
    const status = lines => Object.fromEntries(lines.map(l => [l.id, l.review.status]));
    const built = status(dramaLines([(await freshImport(file)).default]));
    assert.equal(built['s1e01-1'], 'passed'); assert.equal(built['s1e01-t2'], 'draft'); assert.equal(built['s1e01-2'], 'draft');
    // 통과한 줄을 고치면(명세의 alts 하나 더함) 통과가 풀리고 빌더가 알린다.
    fs.writeFileSync(file, text.replace("alts:['안녕하십니까']", "alts:['안녕하십니까','안녕']"));
    const stale = [];
    assert.equal(status(dramaLines([(await freshImport(file)).default], { onStale: id => stale.push(id) }))['s1e01-1'], 'draft');
    assert.deepEqual(stale, ['s1e01-1']);
    // 바뀐 뒤의 판정이 아니면(지문이 다르면) 반영하지 않고 건너뛴다.
    const again = await t.applyToDrama(p, { ...merged, u001: { ...merged.u001, outcome: 'fix' } }, { file: evidence, episodeFiles: [file] });
    assert.deepEqual(again.skipped, ['s1e01-1']);
    assert.equal(t.markReviewed("{id:'a',검수:'passed',검수지문:'x',말:'b'}", 'a', null), "{id:'a',말:'b'}");
    assert.equal(t.markReviewed("{id:'a',말:'b'}", 'a', 'h1'), "{id:'a',검수:'passed',검수지문:'h1',말:'b'}");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
