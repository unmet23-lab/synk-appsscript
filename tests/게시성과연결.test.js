'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const 연결 = require('../tools/lib/게시성과연결.js');
const 편 = require('../tools/lib/게시성과편.js');
const 도구 = require('../tools/게시성과.js');
const 예약 = require('../tools/작업실예약.js');

function fixture(t) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-post-link-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  const folder = 'LAB_연결시험_20261023', dir = path.join(repo, 'docs/마케팅', folder);
  fs.mkdirSync(path.join(dir, '게시'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'proof.json'), '{}');
  const url = 'https://www.instagram.com/reel/POST_1/';
  const server = { channels: [{ id: 'ig', platform: 'instagram', handle: '@synk.mn' }],
    entries: [{ id: 'entry', channelId: 'ig', platform: 'instagram', url, title: '실제 제목', publishedAt: '2026-10-22T12:00:00Z', checkpoints: [] }],
    posts: [{ id: 'p', channelId: 'ig', url, publishedAt: '2026-10-22T12:00:00Z' }], snapshots: [] };
  const accounts = [{ key: 'lab-instagram', platform: 'instagram', handle: 'synk.mn' }];
  fs.writeFileSync(path.join(repo, 'docs/마케팅/sns-계정.json'), JSON.stringify({ accounts: { 'lab-instagram': accounts[0] } }));
  const request = { 주소: url, 편: folder, 계정: 'lab-instagram', 구분: '콘텐츠', 이유: '실제 계정과 원고·주소 대조', 근거: ['proof.json'] };
  return { repo, folder, dir, url, server, accounts, request, now: Date.parse('2026-10-23T12:00:00Z') };
}

test('연결은 정확 계정·게시물ID·근거 해시를 저장하며 같은 요청은 중복 기록하지 않는다', t => {
  const f = fixture(t);
  const [p] = 연결.prepare(f.repo, [f.request], f.server, f.accounts, [], f.now);
  assert.equal(p.line.post, 'instagram:POST_1');
  assert.equal(p.line.evidence[0].sha256.length, 64);
  const again = 연결.prepare(f.repo, [f.request], f.server, f.accounts, [p.line], f.now + 1000);
  assert.equal(again[0].changed, false);
  assert.throws(() => 연결.prepare(f.repo, [f.request, f.request], f.server, f.accounts, [], f.now), /중복/);
  assert.throws(() => 연결.prepare(f.repo, [{ ...f.request, 계정: '없는계정' }], f.server, f.accounts, [], f.now), /계정/);
  assert.throws(() => 연결.prepare(f.repo, [f.request], { ...f.server, channels: [{ ...f.server.channels[0], handle: '@other' }] }, f.accounts, [], f.now), /실제 계정/);
  assert.throws(() => 연결.prepare(f.repo, [{ ...f.request, 편: '../outside' }], f.server, f.accounts, [], f.now), /폴더 이름/);
  assert.throws(() => 연결.prepare(f.repo, [{ ...f.request, 근거: ['../secret'] }], f.server, f.accounts, [], f.now), /상대 경로/);
  assert.equal(연결.prepare(f.repo, [f.request], f.server, [{ ...f.accounts[0], handle: 'https://instagram.com/synk.mn/' }], [], f.now).length, 1);
});

test('주소만 잇고 예약 상태·후속·다른 플랫폼 기록을 보존하며 같은 계정의 다른 게시를 덮지 않는다', t => {
  const f = fixture(t), plans = 연결.prepare(f.repo, [f.request], f.server, f.accounts, [], f.now);
  const original = { 설명: '원문', 판: [{ 계정: 'lab-instagram', 상태: '예약됨', 시각: '2026-10-22T21:00:00+09:00', 주소: null, 후속: '첫 댓글' }, { 계정: 'shift-tistory', 상태: '보류' }] };
  const got = 연결.applyResult(original, f.folder, plans);
  assert.equal(original.판[0].주소, null);
  assert.equal(got.판[0].상태, '예약됨');
  assert.equal(got.판[0].후속, '첫 댓글');
  assert.deepEqual(got.판[1], original.판[1]);
  assert.equal(got.판[0].게시물ID, 'POST_1');
  assert.equal(got.판[0].편ID, f.folder);
  const second = structuredClone(plans); second[0].line.url = 'https://www.instagram.com/p/POST_2/'; second[0].line.post = 'instagram:POST_2';
  const more = 연결.applyResult(got, f.folder, second);
  assert.equal(more.판[0].게시물ID, 'POST_1');
  assert.equal(more.추가게시[0].게시물ID, 'POST_2');
  assert.equal(more.추가게시[0].상태, '공개 확인 필요');
});

test('공개 확인 대기는 빈 예약 줄을 채우지 않으며 시험·작품과 함께 비교 표본에서 빠진다', t => {
  const f = fixture(t);
  const plans = 연결.prepare(f.repo, [{ ...f.request, 구분: '공개확인대기' }], f.server, f.accounts, [], f.now);
  const got = 연결.applyResult({ 판: [{ 계정: 'lab-instagram', 상태: '예약됨', 주소: null }] }, f.folder, plans);
  assert.equal(got.판[0].주소, null);
  assert.equal(got.추가게시.length, 1);
  const filtered = 연결.filterServer(f.server, 연결.latest(plans.map(p => p.line)));
  assert.equal(filtered.entries.length, 0); assert.equal(filtered.posts.length, 0);
  assert.equal(f.server.entries.length, 1);
});

test('명시 연결과 추가게시를 편 색인에서 읽고, 비슷한 시각·제목만으로 다른 편을 잇지 않는다', t => {
  const f = fixture(t), [p] = 연결.prepare(f.repo, [f.request], f.server, f.accounts, [], f.now);
  const file = path.join(f.dir, '게시/게시결과.json');
  fs.writeFileSync(file, JSON.stringify({ 추가게시: [{ 계정: 'lab-instagram', 주소: f.url }] }));
  let index = 편.buildIndex(path.join(f.repo, 'docs/마케팅'));
  assert.equal(index.resolve(p.line.post).info.folder, f.folder);
  assert.equal(index.resolve('instagram:OTHER'), null);
  fs.writeFileSync(file, '{}');
  index = 편.buildIndex(path.join(f.repo, 'docs/마케팅'), 연결.latest([p.line]));
  assert.equal(index.resolve(p.line.post).account, 'lab-instagram');
});

test('쓰기 재실행은 같은 파일을 다시 쓰지 않고 손상된 게시결과는 덮지 않는다', t => {
  const f = fixture(t), plans = 연결.prepare(f.repo, [f.request], f.server, f.accounts, [], f.now);
  const file = path.join(f.dir, '게시/게시결과.json');
  fs.writeFileSync(file, '{"판":[{"계정":"lab-instagram","주소":null,"상태":"예약됨"}]}\r\n');
  assert.equal(연결.writeResults(f.repo, plans).length, 1);
  const text = fs.readFileSync(file, 'utf8');
  assert.ok(text.includes('\r\n'));
  assert.deepEqual(연결.writeResults(f.repo, plans), []);
  fs.writeFileSync(file, '{broken');
  assert.throws(() => 연결.writeResults(f.repo, plans));
  assert.equal(fs.readFileSync(file, 'utf8'), '{broken');
});

test('작업실 완료 결과는 작업ID·편ID·플랫폼 게시물ID를 남기고 다른 작업을 덮지 않는다', t => {
  const f = fixture(t), bundle = { dir: f.dir, name: f.folder };
  const file = path.join(f.dir, '게시/게시결과.json');
  fs.writeFileSync(file, JSON.stringify({ 판: [{ 계정: 'lab-instagram', 작업: 'old', 주소: 'https://instagram.com/p/OLD/' }] }));
  예약.mergeResults(bundle, [{ 계정: 'lab-instagram', 작업: 'new', 주소: f.url, 상태: '게시됨' }]);
  const rows = JSON.parse(fs.readFileSync(file, 'utf8')).판;
  assert.equal(rows.length, 2); assert.equal(rows[0].작업, 'old');
  assert.equal(rows[1].편ID, f.folder); assert.equal(rows[1].게시물ID, 'POST_1');
  assert.throws(() => 연결.identity(f.folder, { 주소: f.url, 게시물ID: 'OTHER' }), /다르다/);
});

test('미리 보기는 연결·분류 결과를 보여도 원장을 쓰지 않고 요약은 옛 시험 판정을 제외한다', async t => {
  const f = fixture(t);
  const manifest = path.join(f.repo, 'links.json');
  fs.writeFileSync(manifest, JSON.stringify([{ ...f.request, 편: null, 구분: '운영시험' }]));
  const got = await 도구.run({ 저장소: f.repo, 연결목록: manifest, 쇼츠안읽음: true }, { now: f.now, data: f.server, shorts: new Map() });
  assert.equal(got.별도분류, 1); assert.equal(got.미연결.length, 0);
  assert.equal(fs.existsSync(path.join(f.repo, 'docs/_ops/게시성과.jsonl')), false);
  const [p] = 연결.prepare(f.repo, [{ ...f.request, 편: null, 구분: '운영시험' }], f.server, f.accounts, [], f.now);
  const summary = 도구.summarize({ ledger: [{ at: new Date(f.now).toISOString(), kind: '판정', post: p.line.post, point: '24h', publishedAt: '2026-10-22T12:00:00Z', verdict: '상위 25%', metrics: {}, line: '옛 시험 숫자' }, p.line], now: f.now });
  assert.doesNotMatch(summary, /옛 시험 숫자/);
  assert.match(summary, /운영시험/);
});

test('작업ID 없는 수동 게시도 새 작업이 덮지 않으며 같은 작업의 주소 변경은 거부한다', t => {
  const f = fixture(t), bundle = { dir: f.dir, name: f.folder };
  const file = path.join(f.dir, '게시/게시결과.json');
  const original = { 계정: 'lab-instagram', 주소: 'https://instagram.com/p/MANUAL/', 상태: '게시됨', 후속: '첫 댓글' };
  fs.writeFileSync(file, JSON.stringify({ 판: [original] }));
  예약.mergeResults(bundle, [{ 계정: 'lab-instagram', 작업: 'new', 상태: '승인 대기' }]);
  예약.mergeResults(bundle, [{ 계정: 'lab-instagram', 작업: 'new', 주소: f.url, 상태: '게시됨' }]);
  const raw = fs.readFileSync(file, 'utf8'), rows = JSON.parse(raw).판;
  assert.equal(rows.length, 2); assert.deepEqual(rows[0], original);
  assert.equal(rows[1].게시물ID, 'POST_1');
  assert.throws(() => 예약.mergeResults(bundle, [{ 계정: 'lab-instagram', 작업: 'new', 주소: 'https://instagram.com/p/OTHER/' }]), /주소가 달라/);
  assert.equal(fs.readFileSync(file, 'utf8'), raw);
  fs.writeFileSync(file, JSON.stringify({ 판: [original], 추가게시: [{ 계정: 'lab-instagram', 주소: f.url, 후속: '보존' }] }));
  예약.mergeResults(bundle, [{ 계정: 'lab-instagram', 작업: 'new', 주소: f.url, 상태: '게시됨' }]);
  const extra = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(extra.판.length, 1); assert.equal(extra.추가게시.length, 1);
  assert.equal(extra.추가게시[0].작업, 'new'); assert.equal(extra.추가게시[0].후속, '보존');
});

test('별도 분류해 비교에서 뺀 게시도 서버에 있으면 미등록 경고를 내지 않는다', async t => {
  const f = fixture(t), manifest = path.join(f.repo, 'links.json');
  fs.writeFileSync(manifest, JSON.stringify([{ ...f.request, 구분: '작품' }]));
  fs.writeFileSync(path.join(f.dir, '게시/게시결과.json'), JSON.stringify({ 추가게시: [{ 계정: 'lab-instagram', 주소: f.url, 상태: '게시됨', 시각: '2026-10-22T12:00:00Z' }] }));
  const got = await 도구.run({ 저장소: f.repo, 연결목록: manifest, 쇼츠안읽음: true }, { now: f.now, data: f.server, shorts: new Map() });
  assert.deepEqual(got.미등록, []);
  assert.equal(got.별도분류, 1);
  const screened = await 도구.run({ 저장소: f.repo, 연결목록: manifest, 적기: f.url, 값들: ['팔로우=7'], 쇼츠안읽음: true }, { now: f.now, data: f.server, shorts: new Map() });
  assert.deepEqual(screened.화면줄.metrics, { follows: 7 });
  assert.deepEqual(screened.새판정, []);
  assert.equal(fs.existsSync(path.join(f.repo, 'docs/_ops/게시성과.jsonl')), false);
  const without = await 도구.run({ 저장소: f.repo, 쇼츠안읽음: true }, { now: f.now, data: { ...f.server, entries: [], posts: [] }, shorts: new Map() });
  assert.equal(without.미등록.length, 1);
});
