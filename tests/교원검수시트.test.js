'use strict';
// tools/교원검수시트.js: one sheet for teacher review, made from the sources (the eight games' items
// and story text, the situation examples, the game↔situation draft, the grammar→ability draft), and
// read back against the sources as they are when the reviewed sheet returns.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildRows, buildFeedbackReview, feedbackHtml, writeFeedbackAppendix, toCsv, parseCsv, review, applyConfirmedExamples, writeSheet, COLUMNS, KINDS, SHEET } = require('../tools/교원검수시트.js');
const { createMap } = require('../strata');
const { topikMap } = require('../strata/topik-i');
const { situationExamples } = require('../strata/topik-i-examples');

const rowsPromise = buildRows();
const count = (rows, kind) => rows.filter(row => row.갈래 === kind).length;
const BOM = String.fromCharCode(0xfeff);
const temp = t => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'review-sheet-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true })); return dir; };

test('the sheet lists every kind of thing a teacher reviews, each row once under a stable number', async () => {
  const rows = await rowsPromise;
  assert.equal(new Set(rows.map(row => row.번호)).size, rows.length);
  assert.deepEqual([...new Set(rows.map(row => row.갈래))], KINDS);
  assert.equal(count(rows, '상황 예문'), 78);
  assert.equal(count(rows, '문형→능력'), 87);
  assert.equal(count(rows, '게임↔상황'), 9, 'eight WORLD games, the runner in two situations');
  assert.ok(!rows.some(row => row.번호.startsWith('게임상황/learning-hub/')), 'the hub is not a game');
  for (const game of ['blank-slice', 'entry-check', 'story-classroom', 'order-rush', 'korean-runner', 'korean-rhythm', 'korean-racing', 'talk-rally']) {
    assert.ok(rows.some(row => row.번호.startsWith(`문항/${game}/`)), game);
  }
  assert.ok(rows.every(row => row.내용 && row.자리 && !/[\r\n]/.test(Object.values(row).join(''))), 'no empty or multi-line cell');
  const order = rows.find(row => row.번호 === '예문/ex-travel-order-2');
  assert.deepEqual([order.자리, order.내용, order['정답·보기'], order['읽힌 문형']], ['한국 여행 · 주문 — 주문할 때 쓰는 말', '설탕은 빼 주세요.', '게임 문항 글 그대로(order-rush/o03)', '-아/어 주세요']);
  assert.equal(rows.find(row => row.번호 === '문항/blank-slice/p01').내용, '저는 아침에 빵[을] 먹어요.');
  assert.equal(rows.find(row => row.번호 === '문항/blank-slice/v03')['읽힌 문형'], '-(으)세요', '세 개 주세요: a counter, not -아/어 주세요');
  assert.equal(rows.find(row => row.번호 === '게임상황/order-rush/sit-travel-order').내용, '주문 폭주의 연습 = 「주문」 — 주문할 때 쓰는 말 (한국 여행)');
});

test('the sheet is a CSV a spreadsheet opens, and reads back cell for cell', async () => {
  const rows = await rowsPromise, csv = toCsv(rows);
  assert.ok(csv.startsWith(`${BOM}"번호","갈래"`), 'UTF-8 with a byte order mark for Excel');
  // A grammar form begins with a hyphen (-고 싶다). Excel takes such a cell for a formula and shows
  // #NAME?, so it is written with a leading space, and reading gives the form back.
  assert.ok(rows.filter(row => /^[=+\-@]/.test(row.내용) || /^[=+\-@]/.test(row['읽힌 문형'])).length > 100, 'many cells begin with a hyphen');
  assert.ok(!/(^|,)"[=+\-@]/m.test(csv), 'no cell begins with a formula sign');
  assert.ok(csv.includes('" -았/었어요 → 조사·문형 읽기"'));
  const back = parseCsv(csv);
  assert.equal(back.length, rows.length);
  for (const [i, row] of rows.entries()) for (const column of COLUMNS) assert.equal(back[i][column], row[column] ?? '', `${row.번호} ${column}`);
  const tricky = parseCsv(toCsv([{ 번호: 'x', 갈래: '게임 문항', 자리: '가, 나', 내용: '“네”라고 "말해요", 그리고', 확인: '' }]));
  assert.equal(tricky[0].내용, '“네”라고 "말해요", 그리고');
  assert.equal(tricky[0].자리, '가, 나');
  // As a spreadsheet saves it: empty columns after the last one, and empty lines.
  const saved = parseCsv(`${BOM}번호,갈래,내용,확인,,\r\n예문/a, 상황 예문 ," -고 싶다",맞음,,\r\n,,,,,\r\n`);
  assert.deepEqual(saved.map(row => [row.번호, row.갈래, row.내용, row.확인]), [['예문/a', '상황 예문', '-고 싶다', '맞음']]);
  assert.throws(() => parseCsv('"이름","값"\n"a","b"'), /머리 줄/);
});

test('the sheet in the repository is the blank form, in the same columns', () => {
  const committed = parseCsv(fs.readFileSync(path.join(__dirname, '..', SHEET), 'utf8'));
  assert.ok(committed.length > 400);
  assert.deepEqual(Object.keys(committed[0]), COLUMNS);
  assert.ok(committed.every(row => !row.확인 && !row['고친 내용'] && !row.검수자), 'nothing is marked before a teacher has it');
});

test('a sheet a teacher has written in is not replaced by a blank one in passing', async t => {
  const rows = await rowsPromise, target = path.join(temp(t), 'sheet.csv');
  assert.equal(writeSheet(rows, target), 'written');
  assert.equal(writeSheet(rows, target), 'same');
  const filled = rows.map((row, i) => (i === 3 ? { ...row, 확인: '맞음', 검수자: '김 선생님' } : row));
  fs.writeFileSync(target, toCsv(filled));
  assert.throws(() => writeSheet(rows, target), /교원이 적은 줄이 1개 있다/);
  assert.equal(parseCsv(fs.readFileSync(target, 'utf8'))[3].확인, '맞음', 'left as it was');
  assert.equal(writeSheet(rows, target, true), 'written', 'only when asked to');
  fs.writeFileSync(target, 'not a sheet');
  assert.throws(() => writeSheet(rows, target), /읽지 못했다/);
});

test('a reviewed sheet is counted against the sources as they are now, and nothing written is dropped silently', async () => {
  const rows = await rowsPromise;
  const reviewed = rows.map(row => ({ ...row, 확인: '', '고친 내용': '', 메모: '' }));
  const mark = (id, values) => Object.assign(reviewed.find(row => row.번호 === id), values);
  mark('예문/ex-travel-order-1', { 확인: '맞음' });
  mark('예문/ex-people-greeting-2', { 확인: 'O' });
  mark('예문/ex-culture-emotion-1', { 확인: '고침', '고친 내용': '정말 좋아요!', 메모: '너무는 부정적인 느낌' });
  // 「맞음」 with a corrected text is a correction, not a confirmation.
  mark('예문/ex-travel-lodging-3', { 확인: '맞음', '고친 내용': '수건 좀 더 주세요.' });
  mark('문항/order-rush/o07', { 확인: '빼기', 메모: '초급에 어려움' });
  mark('문항/blank-slice/p02', { 확인: '맞음', 내용: '옛 문장이에요.' });
  mark('문형능력/G209', { 확인: '글쎄요' });
  // No verdict, but something written: a note, a corrected text, an edited sentence.
  mark('예문/ex-work-colleague-3', { 메모: '너무 격식 있음' });
  mark('예문/ex-career-email-3', { '고친 내용': '확인 부탁드리겠습니다.' });
  mark('문항/order-rush/o01', { 내용: '따뜻한 커피 한 잔 주세요!' });
  reviewed.push({ 번호: '', 갈래: '상황 예문', 자리: '한국 여행 · 쇼핑', 내용: '영수증 주세요.', 확인: '' });
  reviewed.push({ 번호: '문항/nowhere/x1', 갈래: '게임 문항', 내용: '없는 줄', 확인: '맞음' });
  reviewed.push({ ...rows.find(row => row.번호 === '예문/ex-travel-order-1'), 확인: '빼기' });
  const report = review(reviewed, rows);
  assert.deepEqual(report.counts['상황 예문'], { 모두: 78, 맞음: 2, 고침: 2, 빼기: 0, 아직: 74 });
  assert.equal(report.counts['게임 문항'].빼기, 1);
  assert.deepEqual(report.confirmedExamples, [{ id: 'ex-travel-order-1', ko: '따뜻한 커피 한 잔 주세요.' }, { id: 'ex-people-greeting-2', ko: '잘 지냈어요?' }]);
  assert.deepEqual(report.fixes, [
    { 번호: '예문/ex-culture-emotion-1', 지금: '너무 좋아요!', 고친: '정말 좋아요!', 메모: '너무는 부정적인 느낌' },
    { 번호: '예문/ex-travel-lodging-3', 지금: '수건을 더 주세요.', 고친: '수건 좀 더 주세요.', 메모: '' }]);
  assert.deepEqual(report.drops.map(d => d.번호), ['문항/order-rush/o07']);
  assert.deepEqual(report.added.map(a => a.내용), ['영수증 주세요.']);
  assert.deepEqual(report.changed.map(c => c.번호), ['문항/blank-slice/p02'], 'a verdict on words the source no longer has is not counted');
  assert.deepEqual(report.noted.map(n => [n.번호, n.시트, n.고친, n.메모]), [
    ['문항/order-rush/o01', '따뜻한 커피 한 잔 주세요!', '', ''],
    ['예문/ex-work-colleague-3', '', '', '너무 격식 있음'],
    ['예문/ex-career-email-3', '', '확인 부탁드리겠습니다.', '']]);
  assert.deepEqual(report.unclear, [{ 번호: '문형능력/G209', 확인: '글쎄요' }]);
  assert.deepEqual(report.duplicates, [{ 번호: '예문/ex-travel-order-1', 확인: '빼기' }], 'the second verdict on one row is shown, not counted');
  assert.deepEqual(report.unknown, ['문항/nowhere/x1']);
});

test('a confirmed sentence is written into the example layer with its words, and nothing else moves', t => {
  const source = path.join(__dirname, '..', 'strata/topik-i.situation-examples.json');
  const copy = path.join(temp(t), 'examples.json');
  fs.copyFileSync(source, copy);
  const confirmed = [{ id: 'ex-people-greeting-2', ko: '잘 지냈어요?' }, { id: 'ex-travel-order-1', ko: '따뜻한 커피 한 잔 주세요.' }];
  assert.deepEqual(applyConfirmedExamples(confirmed, copy), { reviewed: 2, added: 2 });
  const before = JSON.parse(fs.readFileSync(source, 'utf8')), after = JSON.parse(fs.readFileSync(copy, 'utf8'));
  assert.deepEqual(Object.entries(after.review.reviewed), [['ex-travel-order-1', '따뜻한 커피 한 잔 주세요.'], ['ex-people-greeting-2', '잘 지냈어요?']], 'in the source\'s order');
  assert.deepEqual({ ...after, review: before.review }, before, 'only review.reviewed differs');
  const read = () => situationExamples(createMap(topikMap({ includeWords: false })), { data: JSON.parse(fs.readFileSync(copy, 'utf8')) });
  assert.deepEqual(read().examplesFor('sit-travel-order').map(e => e.reviewed), [true, false, false]);
  assert.deepEqual(applyConfirmedExamples([confirmed[1]], copy), { reviewed: 2, added: 0 }, 'confirming again changes nothing');
  assert.throws(() => applyConfirmedExamples([{ id: 'ex-nowhere-1', ko: '없어요.' }], copy), /예문이 아닌 번호/);
  assert.throws(() => applyConfirmedExamples([{ id: 'ex-travel-order-2', ko: '설탕은 넣지 마세요.' }], copy), /지금 원천과 다르다/);
  // The sentence is edited after it was confirmed: it is a draft again, and the next apply drops the old entry.
  fs.writeFileSync(copy, fs.readFileSync(copy, 'utf8').replace('["ex-travel-order-1", "따뜻한 커피 한 잔 주세요."', '["ex-travel-order-1", "뜨거운 커피 한 잔 주세요."'));
  assert.deepEqual(read().examplesFor('sit-travel-order').map(e => e.reviewed), [false, false, false]);
  assert.deepEqual(applyConfirmedExamples([], copy), { reviewed: 1, added: 0 });
  assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync(copy, 'utf8')).review.reviewed), ['ex-people-greeting-2']);
});

test('applying refuses a source where the change would land outside review.reviewed', t => {
  const source = path.join(__dirname, '..', 'strata/topik-i.situation-examples.json');
  const copy = path.join(temp(t), 'examples.json');
  // Another "reviewed" key earlier in the file: the textual replacement would hit it.
  const text = fs.readFileSync(source, 'utf8').replace('"fields":', '"earlier": { "reviewed": {} },\n  "fields":');
  fs.writeFileSync(copy, text);
  assert.throws(() => applyConfirmedExamples([{ id: 'ex-travel-order-1', ko: '따뜻한 커피 한 잔 주세요.' }], copy), /다른 곳이 바뀌려 했다/);
  assert.equal(fs.readFileSync(copy, 'utf8'), text, 'nothing was written');
});

test('the CSV includes current Town checks and racing sentence/finale items under stable source IDs', async () => {
  const rows = await rowsPromise;
  const { READING_CHECKS } = await import('../experiences/synk-town/understanding.mjs');
  const { CAMPAIGN } = await import('../experiences/korean-racing/campaign.js');
  const { FINALES } = await import('../experiences/korean-racing/finales.js');
  for (const item of READING_CHECKS) {
    const row = rows.find(row => row.번호 === `문항/synk-town/${item.id}`);
    assert.ok(row.내용.includes(item.question)); assert.ok(row['정답·보기'].includes(item.choices[item.correct])); assert.equal(row.풀이, item.explanation);
  }
  for (const stage of [...CAMPAIGN, ...FINALES]) for (const item of stage.items) {
    const row = rows.find(row => row.번호 === `문항/korean-racing/${item.id}`);
    assert.ok(row.내용.includes(item.prompt)); assert.equal(row.풀이, item.explanation);
  }
});

test('feedback appendix preserves every authored choice and pairs only actual same-measure new items', async () => {
  const packet = await buildFeedbackReview();
  assert.equal(packet.reviewStatus, 'awaiting-teacher-review'); assert.equal(packet.studentData, false); assert.equal(packet.learningEffectClaim, false);
  assert.deepEqual(packet.activities.map(a => a.gameId), ['entry-check', 'korean-runner', 'korean-racing', 'synk-town']);
  const twoCaps = packet.activities[0].items.find(item => item.id === 'pool-08');
  assert.ok(twoCaps.context.includes('수영 모자 2개 (swim-cap)'), 'reviewers can read the actual quantity shown in the bag');
  assert.ok(!twoCaps.context.includes('swim-cap,2'));
  for (const activity of packet.activities) {
    const items = new Map(activity.items.map(item => [item.id, item]));
    assert.equal(items.size, activity.items.length);
    for (const item of activity.items) {
      assert.equal(item.choices.filter(choice => choice.correct).length, 1);
      assert.ok(item.choices.filter(choice => !choice.correct).every(choice => choice.id && choice.label && choice.feedback));
      assert.ok(item.metadata.itemKey && item.metadata.familyKey && item.explanation);
    }
    assert.ok(activity.pairs.some(pair => pair.status === 'new'));
    for (const pair of activity.pairs) {
      assert.ok(items.has(pair.sourceId)); assert.ok(!pair.targetId || items.has(pair.targetId));
      if (pair.status !== 'new') { assert.equal(pair.measured, null); continue; }
      assert.notEqual(pair.sourceMetadata.familyKey, pair.targetMetadata.familyKey);
      for (const field of ['skillId', 'difficulty', 'responseFormat', 'modality', 'audioRequired']) assert.equal(pair.sourceMetadata[field], pair.targetMetadata[field]);
      assert.equal(pair.measured.status, 'independent-correct'); assert.equal(pair.measured.learningEffectClaim, false);
      assert.ok(!Object.hasOwn(pair, 'sourceAttemptId'), 'synthetic random event IDs are not durable lineage');
    }
    assert.deepEqual(activity.resultLines.map(result => result.status), ['independent-incorrect', 'independent-correct', 'assisted-incorrect', 'assisted-correct']);
  }
  const html = feedbackHtml(packet); assert.equal(feedbackHtml(packet), html);
  assert.ok(html.includes('학생 기록은 없습니다')); assert.ok(html.includes('확인(맞음 / 고침 / 빼기): __________'));
  assert.ok(!/<script|<iframe|contenteditable|<input|<textarea/i.test(html), 'print/copy review fields have no hidden submission or unsaved form state');
  assert.ok(!/https?:\/\//.test(html), 'self-contained source packet has no external assets or network');
  for (const activity of packet.activities) for (const item of activity.items) assert.ok(html.includes(`id="item-${activity.gameId}-${item.id}"`));
});

test('appendix regeneration never overwrites manual review edits and refuses an unmarked HTML file', async t => {
  const target = path.join(temp(t), 'appendix.html'), packet = await buildFeedbackReview(), html = feedbackHtml(packet);
  assert.equal(writeFeedbackAppendix(html, target), 'written'); assert.equal(writeFeedbackAppendix(html, target), 'same');
  packet.activities[0].items[0].explanation += ' source changed'; const updated = feedbackHtml(packet);
  assert.equal(writeFeedbackAppendix(updated, target, { dryRun: true }), 'ready'); assert.equal(fs.readFileSync(target, 'utf8'), html);
  assert.equal(writeFeedbackAppendix(updated, target), 'written');
  const annotated = updated.replace('고친 내용·메모: __', '고친 내용·메모: 교원 의견 __'); fs.writeFileSync(target, annotated);
  assert.throws(() => writeFeedbackAppendix(html, target), /수작업 변경/); assert.equal(fs.readFileSync(target, 'utf8'), annotated);
  fs.writeFileSync(target, '<html>작성본</html>'); assert.throws(() => writeFeedbackAppendix(html, target), /수작업 변경/);
});

test('unmarked new teacher rows and additional input columns survive blank-sheet regeneration', async t => {
  const rows = await rowsPromise, target = path.join(temp(t), 'sheet.csv');
  const addition = [...rows, { 번호: '', 갈래: '게임 문항', 내용: '새 검수 제안' }]; fs.writeFileSync(target, toCsv(addition));
  const added = fs.readFileSync(target, 'utf8'); assert.throws(() => writeSheet(rows, target), /교원이 적은 줄/); assert.equal(fs.readFileSync(target, 'utf8'), added);
  fs.writeFileSync(target, '번호,갈래,내용,확인,추가 검수 메모\n문항/a,게임 문항,문장,,의견\n');
  const extra = fs.readFileSync(target, 'utf8'); assert.throws(() => writeSheet(rows, target), /교원이 적은 줄/); assert.equal(fs.readFileSync(target, 'utf8'), extra);
});

test('an approval cannot survive changed answers, explanations or measurement tags with identical prompt words', async () => {
  const rows = await rowsPromise, row = rows.find(row => row.번호.startsWith('문항/synk-town/'));
  for (const column of ['정답·보기', '풀이', '읽힌 문형', '자리']) {
    const reviewed = [{ ...row, 확인: '맞음' }], current = rows.map(now => now.번호 === row.번호 ? { ...now, [column]: `${now[column]} changed` } : now);
    const result = review(reviewed, current);
    assert.equal(result.counts['게임 문항'].맞음, 0); assert.equal(result.changed.length, 1); assert.deepEqual(result.changed[0].바뀐칸, [column]);
    assert.equal(result.changed[0].시트, result.changed[0].지금, 'same prompt does not approve a changed answer or rationale');
  }
});
