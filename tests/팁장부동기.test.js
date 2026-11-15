'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const t = require('../tools/팁장부동기.js');

const 장부줄 = (덧) => ({ row: 52, 날짜: '2026-11-16 10:12', 링크: 'https://www.instagram.com/reel/AbC/?igsh=xyz&utm_source=ig_web&x=1', 게시물ID: 'AbC', 종류: '디자인 참고', 요약: ' 요약\u0007 글 ', 상태: '새로', 어디에: '홈페이지\n · WORLD 앱', '가져올 것': '가져올 것 글', 적용안: '[시안] 시안을 만든다', 언제: '지금', 카드: 'docs/참고카드/카드/2026-11-16_시험.md', 'Claude 날짜': '2026-11-16 10:30', ...덧 });
const 카드 = (덧) => ({ 파일: '2026-11-16_시험.md', 판단: '시안', 언제: '지금', 상태: '새로', ...덧 });

test('verdict: card wins, then the 적용안 header, then 언제; nothing before judging', () => {
  assert.equal(t.줄만들기(장부줄({ 'Claude 날짜': '', 적용안: '', 언제: '' }), null).verdict, '');
  assert.equal(t.줄만들기(장부줄({ 'Claude 날짜': '', 적용안: '', 언제: '' }), null).stage, '판단 전');
  assert.equal(t.줄만들기(장부줄({ 적용안: '[기록] 그때', 언제: '지금' }), null).verdict, '기록');
  assert.equal(t.줄만들기(장부줄({ 적용안: '옛 글', 언제: '그 작업 때' }), null).verdict, '기록');
  assert.equal(t.줄만들기(장부줄({ 적용안: '[시안] x' }), 카드({ 판단: '기록' })).verdict, '기록', 'a card lowered to 기록 beats the old header');
  const 기각 = t.줄만들기(장부줄({ 적용안: '[시안] x' }), 카드({ 상태: '기각 — 이미 있는 기능이라서' }));
  assert.equal(기각.verdict, '기각'); assert.equal(기각.stage, '기각'); assert.equal(기각.note, '이미 있는 기능이라서'); assert.equal(기각.draft, null);
  const 장부기각 = t.줄만들기(장부줄({ 적용안: '[기각] 사유: 우리와 맞지 않음', 언제: '안 맞음', 카드: '' }), null);
  assert.equal(장부기각.note, '우리와 맞지 않음');
  assert.equal(t.줄만들기(장부줄({ 적용안: '', 언제: '' }), 카드({ 판단: '', 언제: '지금' })).verdict, '시안', 'an old card without 판단 reads 언제');
});

test('stage: 버림 · 적용함 · 적용 중 · 보류 come first, then the draft progress', () => {
  assert.equal(t.줄만들기(장부줄({ 상태: '버림' }), 카드({ 시안: 'https://claude.ai/artifact/x' })).stage, '버림');
  assert.equal(t.줄만들기(장부줄(), 카드({ 상태: '적용함 — abc123 · synk.im' })).stage, '적용함');
  assert.equal(t.줄만들기(장부줄({ 상태: '적용 중' }), 카드()).stage, '적용 중');
  assert.equal(t.줄만들기(장부줄(), 카드({ 상태: '적용 중 — 자동 2026-11-16 11:30' })).stage, '적용 중');
  const 보류 = t.줄만들기(장부줄(), 카드({ 상태: '보류 — 유호님 차례: 채널 이름 정하기' }));
  assert.equal(보류.stage, '보류'); assert.equal(보류.stageNote, '유호님 차례: 채널 이름 정하기');
  assert.equal(t.줄만들기(장부줄(), 카드()).stage, '시안 차례');
  assert.equal(t.줄만들기(장부줄(), 카드({ 상태: '시안 만드는 중 — 2026-11-16 11:30' })).stage, '시안 만드는 중');
  const 나옴 = t.줄만들기(장부줄(), 카드({ 시안: 'https://claude.ai/artifact/abc', 상태: '시안 대기 — https://claude.ai/artifact/abc' }));
  assert.equal(나옴.stage, '시안 나옴'); assert.deepEqual(나옴.draft, { url: 'https://claude.ai/artifact/abc' });
  const 상태링크 = t.줄만들기(장부줄(), 카드({ 상태: '시안 대기 — https://claude.ai/artifact/def' }));
  assert.deepEqual(상태링크.draft, { url: 'https://claude.ai/artifact/def' });
  const 옛자리 = t.줄만들기(장부줄(), 카드({ 상태: '시안 대기 — 카운터 다음 판 비교 페이지(.tmp/카운터)' }));
  assert.deepEqual(옛자리.draft, { text: '카운터 다음 판 비교 페이지(.tmp/카운터)' }, 'an old place description stays whole, as text');
  assert.equal(t.줄만들기(장부줄(), 카드({ 시안: 'javascript:alert(1)' })).draft.text, 'javascript:alert(1)', 'a non-http value is never a link');
});

test('fields are trimmed, control characters dropped and tracking tails removed', () => {
  const r = t.줄만들기(장부줄(), 카드({ 시안: 'https://claude.ai/artifact/abc' }));
  assert.equal(r.url, 'https://www.instagram.com/reel/AbC/?x=1');
  assert.equal(r.summary, '요약 글'); assert.equal(r.target, '홈페이지 · WORLD 앱');
  assert.equal(r.kind, '디자인 참고'); assert.equal(t.줄만들기(장부줄({ 종류: '이상한 값' }), null).kind, '기타');
  assert.equal(t.줄만들기(장부줄({ 링크: 'ftp://x/y' }), null).url, '');
  assert.equal(t.줄만들기(장부줄({ 날짜: '2026. 10. 16' }), null).sharedAt, '');
  assert.equal(t.줄만들기(장부줄({ 게시물ID: '../x' }), null).postId, '');
  assert.equal(t.줄만들기(장부줄({ 요약: '가'.repeat(900) }), null).summary.length, t.한도.요약);
});

test('a ledger status outside the four values is shown as 보류 and cannot be picked; an empty one is new', () => {
  const 손 = t.줄만들기(장부줄({ 상태: '보류 중' }), 카드({ 시안: 'https://claude.ai/artifact/abc' }));
  assert.equal(손.stage, '보류'); assert.equal(손.stageNote, '장부 상태 칸: 보류 중'); assert.equal(손.status, '새로');
  assert.equal(t.줄만들기(장부줄({ 상태: '' }), 카드({ 시안: 'https://claude.ai/artifact/abc' })).stage, '시안 나옴');
});

test('a bundle is newest first and stays under the row and byte limits', () => {
  const 줄들 = Array.from({ length: 320 }, (_, i) => 장부줄({ row: i + 2, 게시물ID: 'P' + i, 요약: '가'.repeat(400), '가져올 것': '나'.repeat(800), 카드: '' }));
  const 묶음 = t.묶음만들기(줄들, new Map());
  assert.ok(묶음.length <= t.한도.줄);
  assert.ok(Buffer.byteLength(JSON.stringify(묶음)) <= t.한도.바이트);
  assert.equal(묶음[0].row, 321); assert.ok(묶음.every((r, i, a) => !i || a[i - 1].row > r.row));
});

test('a fresh checkout adds new cards and draft links but never rolls back other cards of the ops copy', () => {
  const 지금 = Date.parse('2026-11-16T03:00:00Z');
  const 운영 = new Map([['a.md', 카드({ 파일: 'a.md' })], ['b.md', 카드({ 파일: 'b.md', 상태: '적용함 — 11-16' })]]);
  const 뿌리 = new Map([['a.md', 카드({ 파일: 'a.md', 시안: 'https://claude.ai/artifact/a' })], ['b.md', 카드({ 파일: 'b.md', 상태: '새로' })], ['c.md', 카드({ 파일: 'c.md', 판단: '기록' })]]);
  const { 합친 } = t.기억합치기(운영, 뿌리, {}, 지금);
  assert.equal(합친.get('a.md').시안, 'https://claude.ai/artifact/a');
  assert.equal(합친.get('b.md').상태, '적용함 — 11-16', 'the older checkout does not reopen a card the ops copy already closed');
  assert.equal(합친.get('c.md').판단, '기록', 'a card only the checkout has shows at once');
});

test('drafts seen in a fresh checkout are remembered until the ops copy catches up', () => {
  const 지금 = Date.parse('2026-11-16T03:00:00Z');
  const 운영 = new Map([['a.md', 카드({ 파일: 'a.md' })]]);
  const 뿌리 = new Map([['a.md', 카드({ 파일: 'a.md', 시안: 'https://claude.ai/artifact/a', 상태: '시안 대기 — https://claude.ai/artifact/a' })]]);
  const 첫 = t.기억합치기(운영, 뿌리, {}, 지금);
  assert.equal(첫.합친.get('a.md').시안, 'https://claude.ai/artifact/a'); assert.ok(첫.기억['a.md']);
  // 5분 뒤 운영 사본은 아직 옛 카드다 — 기억이 시안을 지킨다.
  const 둘 = t.기억합치기(운영, null, 첫.기억, 지금 + 300000);
  assert.equal(둘.합친.get('a.md').시안, 'https://claude.ai/artifact/a');
  // 운영 사본이 따라오면 기억을 지운다.
  const 셋 = t.기억합치기(뿌리, null, 둘.기억, 지금 + 600000);
  assert.deepEqual(셋.기억, {});
  // 2시간이 지나면 기억은 쓰지 않는다. 카드가 이미 닫혔으면(적용 · 기각 · 보류) 기억으로 되돌리지 않는다.
  assert.equal(t.기억합치기(운영, null, 첫.기억, 지금 + 3 * 3600000).합친.get('a.md').시안, undefined);
  const 닫힌 = new Map([['a.md', 카드({ 파일: 'a.md', 상태: '기각 — 이유' })]]);
  assert.equal(t.기억합치기(닫힌, null, 첫.기억, 지금 + 300000).합친.get('a.md').상태, '기각 — 이유');
});

test('a request becomes applied, conflict, or stays for the next run', async () => {
  const 요청 = { id: '00000000-0000-4000-8000-000000000001', row: 52, postId: 'AbC', from: '새로', to: '적용 중' };
  const 장부 = (답) => ({ fetchImpl: async () => ({ status: 200, text: async () => JSON.stringify(답) }) });
  const cfg = { url: 'https://script.example/exec', token: 'T' };
  assert.deepEqual(await t.요청쓰기(cfg, 'K', 요청, 장부({ ok: true })), { id: 요청.id, outcome: 'applied', current: '적용 중' });
  assert.deepEqual(await t.요청쓰기(cfg, 'K', 요청, 장부({ ok: true, 이미: true })), { id: 요청.id, outcome: 'applied', current: '적용 중' });
  assert.deepEqual(await t.요청쓰기(cfg, 'K', 요청, 장부({ ok: false, error: '상태가 바뀜', 현재: '버림' })), { id: 요청.id, outcome: 'conflict', current: '버림' });
  assert.deepEqual(await t.요청쓰기(cfg, 'K', 요청, 장부({ ok: false, error: 'row와 게시물ID가 맞지 않음' })), { id: 요청.id, outcome: 'conflict' });
  assert.deepEqual(await t.요청쓰기(cfg, 'K', 요청, 장부({ ok: false, error: 'busy' })), { 남김: 'busy' });
  assert.deepEqual(await t.요청쓰기(cfg, 'K', 요청, 장부({ ok: false, error: 'unauthorized status' })), { 남김: 'unauthorized status' });
  // 사람이 상태 칸에 네 값 밖의 글을 적었으면 다시 하지 않고 어긋남으로 정리한다.
  assert.deepEqual(await t.요청쓰기(cfg, 'K', 요청, 장부({ ok: false, error: '상태가 바뀜', 현재: '보류 중' })), { id: 요청.id, outcome: 'conflict' });
  assert.deepEqual(await t.요청쓰기(cfg, 'K', 요청, 장부({ ok: false, error: '게시물ID가 빈 줄은 바꾸지 않음' })), { id: 요청.id, outcome: 'conflict' });
  // 게시물ID가 빈 요청은 장부를 부르지도 않는다.
  let 불림 = 0;
  const 빈 = { ...요청, postId: '' };
  assert.deepEqual(await t.요청쓰기(cfg, 'K', 빈, { fetchImpl: async () => { 불림++; return { status: 200, text: async () => '{"ok":true}' }; } }), { id: 요청.id, outcome: 'conflict' });
  assert.equal(불림, 0);
});

function 가짜(t0, { 요청들 = [], 장부상태 = '새로', 열쇠 = 'K' } = {}) {
  const 자리 = fs.mkdtempSync(path.join(os.tmpdir(), 'tip-sync-'));
  t0.after(() => fs.rmSync(자리, { recursive: true, force: true }));
  const 장부 = [장부줄({ 상태: 장부상태 }), 장부줄({ row: 51, 게시물ID: 'Old', 카드: '', 적용안: '[기록] x', 언제: '그 작업 때' })];
  const 보낸 = [], 장부호출 = [];
  const fetchImpl = async (url, opt) => {
    const 몸 = JSON.parse(opt.body); 장부호출.push(몸.action);
    if (몸.action === 'list') return { status: 200, text: async () => JSON.stringify({ ok: true, rows: 장부 }) };
    if (몸.action === 'status') { assert.equal(몸.statusKey, 'K'); const 줄 = 장부.find((r) => r.row === 몸.row); 줄.상태 = 몸.상태; return { status: 200, text: async () => JSON.stringify({ ok: true }) }; }
    throw new Error('unexpected ' + 몸.action);
  };
  const ws = { post: async (p, body) => { 보낸.push([p, body]); if (p.endsWith('/sync')) return { requests: 요청들 }; if (p.endsWith('/snapshot')) return { stored: true, changed: true, settled: body.results.length, open: 0 }; return {}; } };
  const 옵션 = { 자리, 장부: { url: 'https://script.example/exec', token: 'T' }, 카드표: new Map([['2026-11-16_시험.md', 카드({ 시안: 'https://claude.ai/artifact/abc' })]]), 연결: async () => ws, fetchImpl, 열쇠 };
  return { 옵션, 보낸, 장부호출, 장부, 자리 };
}

test('one run claims requests, writes the ledger, re-reads it and uploads rows with the results', async (t0) => {
  const 요청 = { id: '00000000-0000-4000-8000-000000000001', row: 52, postId: 'AbC', from: '새로', to: '적용 중', requestedAt: '2026-11-16T02:00:00Z' };
  const f = 가짜(t0, { 요청들: [요청] });
  const 결과 = await t.한번(f.옵션);
  assert.equal(결과.끝코드, 0); assert.equal(결과.옮김, 1); assert.equal(결과.줄, 2);
  assert.deepEqual(f.장부호출, ['list', 'status', 'list']);
  assert.deepEqual(f.보낸.map(([p]) => p), ['/api/tip-shares/sync', '/api/tip-shares/snapshot']);
  const 올림 = f.보낸[1][1];
  assert.deepEqual(올림.results, [{ id: 요청.id, outcome: 'applied', current: '적용 중' }]);
  assert.equal(올림.rows[0].row, 52); assert.equal(올림.rows[0].status, '적용 중'); assert.equal(올림.rows[0].stage, '적용 중');
  assert.ok(fs.readFileSync(path.join(f.자리, '기록.jsonl'), 'utf8').includes('"옮김":1'));
  assert.equal(fs.existsSync(path.join(f.자리, '.잠금')), false, 'the lock is released');
});

test('without the status key the rows still go up and the requests stay for later', async (t0) => {
  const 요청 = { id: '00000000-0000-4000-8000-000000000002', row: 52, postId: 'AbC', from: '새로', to: '버림', requestedAt: '2026-11-16T02:00:00Z' };
  const f = 가짜(t0, { 요청들: [요청], 열쇠: null });
  const 결과 = await t.한번(f.옵션);
  assert.equal(결과.끝코드, 5); assert.equal(결과.남김, 1);
  assert.deepEqual(f.장부호출, ['list']);
  assert.deepEqual(f.보낸[1][1].results, []);
});

test('a wrong status key or a ledger error keeps the requests and ends with a code that says so', async (t0) => {
  const 요청 = { id: '00000000-0000-4000-8000-000000000003', row: 52, postId: 'AbC', from: '새로', to: '적용 중', requestedAt: '2026-11-16T02:00:00Z' };
  for (const [오류, 끝] of [['unauthorized status', 5], ['busy', 1]]) {
    const f = 가짜(t0, { 요청들: [요청] });
    const 원래 = f.옵션.fetchImpl;
    f.옵션.fetchImpl = async (url, opt) => (JSON.parse(opt.body).action === 'status' ? { status: 200, text: async () => JSON.stringify({ ok: false, error: 오류 }) } : 원래(url, opt));
    const 결과 = await t.한번(f.옵션);
    assert.equal(결과.끝코드, 끝); assert.equal(결과.남김, 1); assert.equal(결과.장부오류, 오류);
    assert.deepEqual(f.보낸[1][1].results, [], 'no result is sent, so the next run gets the request again');
  }
});

test('a second run waits while another holds a fresh lock, and takes over a dead one', async (t0) => {
  const f = 가짜(t0);
  const 풀기 = t.잠그기(f.자리);
  const 막힘 = await t.한번(f.옵션);
  assert.equal(막힘.끝코드, 4);
  풀기();
  fs.mkdirSync(path.join(f.자리, '.잠금'));
  fs.writeFileSync(path.join(f.자리, '.잠금', 'owner.json'), JSON.stringify({ pid: 999999, at: new Date().toISOString(), 표: 'dead' }));
  assert.equal((await t.한번(f.옵션)).끝코드, 0);
  // 주인 파일이 아직 없는 새 잠금은 막 잡힌 것일 수 있어 넘겨받지 않는다. 1분이 지나면 넘겨받는다.
  fs.mkdirSync(path.join(f.자리, '.잠금'));
  assert.equal((await t.한번(f.옵션)).끝코드, 4);
  const 옛 = new Date(Date.now() - 120000);
  fs.utimesSync(path.join(f.자리, '.잠금'), 옛, 옛);
  assert.equal((await t.한번(f.옵션)).끝코드, 0);
});

test('a failed run reports the error and never leaves the lock behind', async (t0) => {
  const f = 가짜(t0);
  f.옵션.연결 = async () => ({ post: async (p) => { if (p.endsWith('/sync')) throw new Error('/api/tip-shares/sync 실패(403): 관리자만'); return {}; } });
  const 결과 = await t.한번(f.옵션);
  assert.equal(결과.끝코드, 1); assert.match(결과.오류, /403/);
  assert.equal(fs.existsSync(path.join(f.자리, '.잠금')), false);
});
