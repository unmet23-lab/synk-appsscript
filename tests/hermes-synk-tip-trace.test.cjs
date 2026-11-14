'use strict';
// Read-time receipt → ledger → card → applied → verified trace. Generic post IDs only.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { PRIVATE_QUERY, traceLine, lookupKey, lookupHash, refIdentity, traceReceipt, traceSummary, formatTrace, projectReceipt, tipIntakeSnapshot } = require('../tools/hermes-synk/tip-intake-status.cjs');
const { traceTip, listTips } = require('../tools/hermes-synk/tip-trace.cjs');

const NOW = new Date('2026-11-14T03:00:00Z');
const ledgerOf = (rows, extra = {}) => ({ available: true, stale: false, limited: false, checkedAt: '2026-11-14T02:00:00Z',
  rows: rows.map(([row, id, status]) => ({ row, postId: id, lookupHash: lookupHash(id), status })), ...extra });
const cardsOf = (items, complete = true) => ({ available: true, complete, items: items.map(([postId, status, ledgerRow, title = '카드 ' + postId]) => ({ postId, status, ledgerRow, title, file: 'docs/참고카드/카드/' + postId + '.md' })) });
const receipt = refs => ({ schemaVersion: 1, id: 'tip-' + 'a'.repeat(24), ownerHash: 'b'.repeat(64), messageId: '1', receivedAt: '2026-11-13T01:00:00Z',
  updatedAt: '2026-11-13T01:00:00Z', status: 'pending', refs, ledgerMatches: [] });
const exactRef = id => ({ kind: 'url', url: `https://www.instagram.com/reel/${id}/`, lookupKey: id, exact: true });
const historicalRef = id => ({ kind: 'url', url: `https://www.instagram.com/p/${id}/`, lookupKey: null, exact: false });

test('realistic share/tracking query keys keep the post identity; private keys still drop it', () => {
  for (const query of ['cplk=1', 'exln=x', 'mdxt=1', 'rpxt=2', 'srtk=3', 'vrfl=4', 'obrf=5', 'psln=6', 'img_index=2&cplk=1', 'igsh=abc'])
    assert.equal(lookupKey(`https://www.instagram.com/reel/PostAlpha01/?${query}`), 'PostAlpha01', query);
  for (const query of ['token=1', 'auth=1', 'signature=x', 'api_key=1'])
    assert.equal(lookupKey(`https://www.instagram.com/reel/PostAlpha01/?${query}`), null, query);
  // Redirect wrappers and other hosts are never a post identity.
  assert.equal(lookupKey('https://l.instagram.com/?u=https%3A%2F%2Fexample.com%2F'), null);
  assert.equal(lookupKey('https://www.instagram.com/reel/PostAlpha01/../PostBeta02/'), null);
});

test('Python and JS use the same private-query pattern', () => {
  const python = fs.readFileSync(path.join(__dirname, '../tools/hermes-synk/plugin/tip_intake.py'), 'utf8');
  const source = /PRIVATE_QUERY = re\.compile\(r"([^"]+)", re\.I\)/.exec(python)[1];
  assert.equal(PRIVATE_QUERY.source, source);
  assert.equal(PRIVATE_QUERY.flags, 'i');
  for (const key of ['design', 'monkey', 'signup', 'keyboard', 'cplk']) assert.equal(PRIVATE_QUERY.test(key), false, key);
  for (const key of ['key', 'sig', 'api_key', 'apikey', 'access_token', 'auth', 'x-amz-date', 'client_secret']) assert.equal(PRIVATE_QUERY.test(key), true, key);
});

test('list line keeps the stored receipt state apart from the live lookup', () => {
  const raw = receipt([historicalRef('PostL1')]);
  const line = traceLine(traceReceipt(raw, { ledger: ledgerOf([[47, 'PostL1', '새로']]), cards: cardsOf([['PostL1', '적용함 (abc)', 47]]) }), raw.status);
  assert.match(line, /접수 당시 기록은 「장부와 대조하기 전」입니다\./);
  assert.match(line, /지금 조회한 결과: 장부 47행에서 찾았습니다\. 참고 카드에 적용 기록이 있습니다\. 저장된 주소 경로로 식별했습니다\. 확인할 점이 있습니다\./);
  assert.doesNotMatch(line, /처리 대기|완료/);
});

test('historical sanitized refs are a recovered candidate, never a receipt match or a projected reconcile', () => {
  const ref = historicalRef('PostOld01');
  assert.deepEqual(refIdentity(ref), { key: 'PostOld01', basis: 'recovered' });
  assert.deepEqual(refIdentity(exactRef('PostNew01')), { key: 'PostNew01', basis: 'receipt' });
  // A generic URL or a message-only reference is not recovered.
  assert.equal(refIdentity({ kind: 'url', url: 'https://example.com/p/PostOld01/', lookupKey: null, exact: false }).basis, 'none');
  assert.equal(refIdentity({ kind: 'message', reference: 'platform-message:1#url0', lookupKey: null, exact: false }).basis, 'none');
  // The monitor-facing projection keeps its original conservative status.
  const raw = receipt([ref]);
  const projected = projectReceipt(raw, raw.id + '.json', ledgerOf([[3, 'PostOld01', '새로']]), NOW);
  assert.equal(projected.status, 'pending');
  const trace = traceReceipt(raw, { ledger: ledgerOf([[3, 'PostOld01', '새로']]), cards: cardsOf([]) });
  assert.equal(trace.refs[0].identity, 'recovered');
  assert.equal(trace.refs[0].ledger.state, 'one');
  assert.match(formatTrace(trace), /저장된 주소 경로에서 ID를 다시 찾아 식별했습니다\. 이 식별은 후보이고/);
});

test('steps separate ledger row, card plan, applied record and the never-verified outcome', () => {
  const trace = traceReceipt(receipt([exactRef('PostA')]), { ledger: ledgerOf([[4, 'PostA', '새로']]), cards: cardsOf([['PostA', '적용함 (abc1234)', 4]]) });
  const ref = trace.refs[0];
  assert.equal(ref.ledger.state, 'one');
  assert.equal(ref.card.state, 'one');
  assert.equal(ref.applied, 'applied');
  assert.equal(ref.verified, 'unverified');
  assert.deepEqual(ref.issues, ['card_ledger_status_mismatch']);
  const text = formatTrace(trace);
  assert.match(text, /장부 4행에서 찾았습니다\. 장부에 적힌 상태는 「새로」입니다\./);
  assert.match(text, /카드 원문에 적용 기록이 있습니다\./);
  assert.match(text, /배포와 사용자 효과는 검증 기록이 없습니다\./);
  assert.match(text, /확인 필요: 카드 상태와 장부 상태가 다릅니다\./);
  assert.doesNotMatch(text, /완료/);
});

test('duplicate ledger rows, duplicate cards and a card row mismatch are flagged, not resolved', () => {
  const dup = traceReceipt(receipt([exactRef('PostD')]), { ledger: ledgerOf([[5, 'PostD', '새로'], [9, 'PostD', '새로']]), cards: cardsOf([['PostD', '새로', 5], ['PostD', '적용함', 9]]) }).refs[0];
  assert.equal(dup.ledger.state, 'duplicate');
  assert.equal(dup.card.state, 'duplicate');
  assert.equal(dup.applied, 'unknown');
  assert.deepEqual(dup.issues.sort(), ['card_duplicate', 'ledger_duplicate']);
  const moved = traceReceipt(receipt([exactRef('PostM')]), { ledger: ledgerOf([[12, 'PostM', '새로']]), cards: cardsOf([['PostM', '새로', 3]]) }).refs[0];
  assert.deepEqual(moved.issues, ['card_row_mismatch']);
});

test('stale, partial or unavailable coverage stays unconfirmed', () => {
  const outside = traceReceipt(receipt([exactRef('PostX')]), { ledger: ledgerOf([[2, 'Other', '새로']], { limited: true, stale: true }), cards: cardsOf([], false) }).refs[0];
  assert.equal(outside.ledger.state, 'outside_coverage');
  assert.equal(outside.ledger.stale, true);
  assert.equal(outside.card.state, 'unknown');
  assert.equal(outside.applied, 'unknown');
  const text = formatTrace(traceReceipt(receipt([exactRef('PostX')]), { ledger: ledgerOf([], { limited: true, stale: true }), cards: cardsOf([]) }));
  assert.match(text, /최근 장부 50행에서는 찾지 못했습니다\. 더 오래된 행에 있을 수 있어 장부 연결은 미확인입니다\./);
  assert.match(text, /이 사본은 오래됐습니다\./);
  const none = traceReceipt(receipt([exactRef('PostY')]), { ledger: { available: false, rows: [] }, cards: { available: false, items: [] } }).refs[0];
  assert.equal(none.ledger.state, 'unavailable');
  assert.equal(none.applied, 'unknown');
  const media = traceReceipt(receipt([{ kind: 'media', reference: 'media/x.jpg', mediaType: 'image', lookupKey: null, exact: false }]), { ledger: ledgerOf([]), cards: cardsOf([]) }).refs[0];
  assert.equal(media.ledger.state, 'no_identity');
});

test('summary counts never claim a verified outcome', () => {
  const traces = [
    traceReceipt(receipt([exactRef('PostP1')]), { ledger: ledgerOf([[2, 'PostP1', '적용함']]), cards: cardsOf([['PostP1', '적용함', 2]]) }),
    traceReceipt(receipt([historicalRef('PostP2')]), { ledger: ledgerOf([]), cards: cardsOf([]) }),
  ];
  const counts = traceSummary(traces);
  assert.equal(counts.appliedRecord, 1);
  assert.equal(counts.recovered, 1);
  assert.equal(counts.verified, 0);
});

test('list over 100 receipt files reports the scan limit instead of hiding older receipts', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-trace-list-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const home = path.join(root, 'hermes'), repo = path.join(root, 'repo'), folder = path.join(home, 'runtime/synk-tip-intake');
  fs.mkdirSync(folder, { recursive: true }); fs.mkdirSync(path.join(repo, 'docs/참고카드/카드'), { recursive: true });
  const owner = 'b'.repeat(64), files = [];
  for (let i = 0; i < 105; i++) {
    const raw = { ...receipt([exactRef('PostLimit' + i)]), id: 'tip-' + i.toString(16).padStart(24, '0') };
    const file = path.join(folder, raw.id + '.json');
    fs.writeFileSync(file, JSON.stringify(raw));
    fs.utimesSync(file, new Date(1_800_000_000_000 + i * 1000), new Date(1_800_000_000_000 + i * 1000));
    files.push(file);
  }
  const before = files.map(file => fs.readFileSync(file, 'utf8'));
  const { text } = await listTips({ hermesHome: home, root: repo, owner, now: NOW });
  assert.match(text, /그 밖에 90건이 더 있습니다\. 이 수는 최근 접수 파일 100개 안에서 센 것입니다\./);
  assert.match(text, /최근 접수 파일 100개까지만 읽었습니다\. 더 오래된 접수 5개는 이 목록에서 확인하지 않았습니다\./);
  assert.deepEqual(files.map(file => fs.readFileSync(file, 'utf8')), before);
  assert.equal(fs.existsSync(path.join(home, 'runtime/synk-overview')), false);
  // Under the bound nothing about a limit is claimed.
  for (const file of files.slice(0, 10)) fs.unlinkSync(file);
  assert.doesNotMatch((await listTips({ hermesHome: home, root: repo, owner, now: NOW })).text, /100개까지만 읽었습니다/);
});

test('CLI trace reads only, checks the owner and leaves receipt, cache and cards unchanged', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-trace-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const home = path.join(root, 'hermes'), repo = path.join(root, 'repo');
  const write = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value); return file; };
  const raw = receipt([exactRef('PostC1')]);
  const receiptFile = write(path.join(home, 'runtime/synk-tip-intake', raw.id + '.json'), JSON.stringify(raw));
  const cache = write(path.join(home, 'runtime/synk-overview/ledger-cache.json'), JSON.stringify({ version: 1, checkedAt: NOW.toISOString(), rows: [{ row: 6, 게시물ID: 'PostC1', 상태: '새로' }] }));
  const card = write(path.join(repo, 'docs/참고카드/카드/2026-11-13_예시.md'), '---\n제목: 예시 카드\n공유일: 2026-11-13\n상태: 적용 중\n게시물ID: PostC1\n장부: 6행\n---\n본문\n');
  const before = [receiptFile, cache, card].map(file => fs.readFileSync(file, 'utf8') + fs.statSync(file).mtimeMs);
  const { text } = await traceTip({ hermesHome: home, root: repo, id: raw.id, owner: raw.ownerHash, now: NOW });
  assert.match(text, /장부 6행에서 찾았습니다\. 장부에 적힌 상태는 「새로」입니다\./);
  assert.match(text, /참고 카드가 연결됐습니다\. 카드 제목은 「예시 카드」입니다\. 파일은 docs\/참고카드\/카드\/2026-11-13_예시\.md 입니다\./);
  assert.match(text, /카드 원문에는 적용 중이라고 적혀 있습니다\./);
  assert.deepEqual([receiptFile, cache, card].map(file => fs.readFileSync(file, 'utf8') + fs.statSync(file).mtimeMs), before);
  await assert.rejects(traceTip({ hermesHome: home, root: repo, id: raw.id, owner: 'c'.repeat(64), now: NOW }), /OWNER/);
  // Overview receives counts only; monitor-facing items are unchanged by the trace.
  const snapshot = tipIntakeSnapshot({ hermesHome: home, now: NOW, ledger: ledgerOf([[6, 'PostC1', '새로']]), cards: cardsOf([['PostC1', '적용 중', 6]]) });
  assert.equal(snapshot.traceCounts.carded, 1);
  assert.equal(snapshot.items[0].status, 'reconciled');
  assert.equal(createHash('sha256').update('x').digest('hex').length, 64);
});

// ── Astra D 지적 재현(GD1) · 일반 fixture만 씀 ──────────────────────────────────
test('GD1: a match found in a partial or stale source is a candidate in detail, list and summary', () => {
  const raw = receipt([exactRef('PostPart1')]);
  const partial = { ledger: ledgerOf([[47, 'PostPart1', '새로']], { limited: true, stale: true }), cards: cardsOf([['PostPart1', '적용함 (abc)', 47]], false) };
  const trace = traceReceipt(raw, partial);
  const ref = trace.refs[0];
  // The found row and card stay visible.
  assert.equal(ref.ledger.state, 'one');
  assert.equal(ref.card.state, 'one');
  assert.equal(ref.ledger.certain, false);
  assert.equal(ref.card.certain, false);
  const text = formatTrace(trace);
  assert.match(text, /장부 47행에서 찾았습니다\./);
  assert.match(text, /장부 조회는 최근 50행까지라서 더 오래된 행에 같은 게시물이 있는지는 미확인입니다\./);
  assert.match(text, /장부 사본이 오래돼서 지금 장부와 같은지는 미확인입니다\./);
  assert.match(text, /참고 카드 일부를 읽지 못해서 같은 게시물의 다른 카드가 있는지는 미확인입니다\./);
  assert.match(text, /그래서 이 적용 기록은 후보로 봅니다\./);
  assert.match(text, /배포와 사용자 효과는 검증 기록이 없습니다\./);
  const line = traceLine(trace, raw.status);
  assert.match(line, /장부 47행에서 찾았습니다\. 이 장부 연결은 부분 조회나 오래된 사본에서 찾은 후보입니다\./);
  assert.match(line, /참고 카드에 적용 기록이 있습니다\. 이 카드 연결은 일부만 읽은 카드에서 찾은 후보입니다\./);
  const counts = traceSummary([trace]);
  assert.deepEqual([counts.ledgerLinked, counts.ledgerCandidate, counts.carded, counts.cardCandidate, counts.appliedRecord, counts.appliedCandidate, counts.verified], [0, 1, 0, 1, 0, 1, 0]);
  // A complete, fresh source still confirms.
  const full = traceReceipt(raw, { ledger: ledgerOf([[47, 'PostPart1', '새로']]), cards: cardsOf([['PostPart1', '적용함 (abc)', 47]]) });
  assert.equal(full.refs[0].ledger.certain, true);
  const fullCounts = traceSummary([full]);
  assert.deepEqual([fullCounts.ledgerLinked, fullCounts.ledgerCandidate, fullCounts.carded, fullCounts.appliedRecord], [1, 0, 1, 1]);
  assert.doesNotMatch(formatTrace(full), /후보로 봅니다|50행까지라서|오래돼서|다른 카드가 있는지/);
});

test('GD1: the list states the ledger copy time, staleness, row bound and card coverage once', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-trace-source-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const home = path.join(root, 'hermes'), repo = path.join(root, 'repo');
  const write = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value); return file; };
  const raw = receipt([exactRef('PostOld50')]);
  const receiptFile = write(path.join(home, 'runtime/synk-tip-intake', raw.id + '.json'), JSON.stringify(raw));
  const rows = Array.from({ length: 50 }, (_, i) => ({ row: i + 2, 게시물ID: i === 0 ? 'PostOld50' : 'Other' + i, 상태: '새로' }));
  const cache = write(path.join(home, 'runtime/synk-overview/ledger-cache.json'), JSON.stringify({ version: 1, checkedAt: '2026-11-13T00:00:00Z', rows }));
  fs.mkdirSync(path.join(repo, 'docs/참고카드/카드'), { recursive: true });
  const before = [receiptFile, cache].map(file => fs.readFileSync(file, 'utf8'));
  const { text } = await listTips({ hermesHome: home, root: repo, owner: raw.ownerHash, now: NOW });
  assert.match(text, /장부 사본은 2026-11-13 09:00 KST에 조회했습니다\./);
  assert.match(text, /이 장부 사본은 오래됐습니다\./);
  assert.match(text, /장부 조회는 최근 50행까지입니다\./);
  assert.match(text, /장부 2행에서 찾았습니다\. 이 장부 연결은 부분 조회나 오래된 사본에서 찾은 후보입니다\./);
  assert.deepEqual([receiptFile, cache].map(file => fs.readFileSync(file, 'utf8')), before);
  assert.deepEqual(fs.readdirSync(path.join(home, 'runtime/synk-overview')), ['ledger-cache.json']);
});
