'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// 실제 장부·캐시·게시 도구는 호출하지 않는다. 사후 처리의 파일 효과만 메모리에 기록한다.
function fixture(reviewCode = 0) {
  const writes = [], deleted = [], reviews = [], notifications = [];
  const mod = { exports: {} };
  const source = path.resolve(__dirname, '../tools/크레딧작업/팁적용안.js');
  const files = {
    existsSync: () => true, mkdirSync() {},
    writeFileSync(file, text) { writes.push({ file, value: JSON.parse(text) }); },
    readdirSync: () => ['video.mp4', 'video-02.mp4', 'notes.txt'],
    rmSync(file) { deleted.push(file); },
  };
  vm.runInNewContext(fs.readFileSync(source, 'utf8'), {
    module: mod, __dirname: path.dirname(source), process: { execPath: process.execPath },
    require(id) { if (id === 'fs') return files; if (id === 'path') return path; throw new Error('Unexpected dependency'); },
  }, { filename: source });
  const ctx = { 루트: '/dummy/repo', 경로: '크레딧', 알림: text => notifications.push(text),
    실행(_exe, args) {
      if (args[1] === 'review') { reviews.push(args[2]); return { code: reviewCode, stdout: '' }; }
      return { code: 0, stdout: args[0].includes('커밋') ? '{"결과":"완료"}' : '[]' };
    } };
  return { writes, deleted, reviews, notifications, ctx,
    run: rows => mod.exports.사후({ 글: JSON.stringify({ 줄: rows }) }, { 줄: [{ row: 7, 게시물ID: 'fixture-a' }, { row: 8, 게시물ID: 'fixture-b' }] }, ctx) };
}

test('행 번호와 게시물 ID가 함께 요청과 일치해야 캐시·장부에 접근한다', async () => {
  for (const row of [{ row: 7, 게시물ID: 'fixture-b' }, { row: 9, 게시물ID: 'fixture-a' }, { row: 7, 게시물ID: '../fixture-b' }, null]) {
    const t = fixture();
    const r = await t.run([row]);
    assert.equal(r.기록, 0);
    assert.equal(t.writes.length, 0);
    assert.equal(t.reviews.length, 0);
    assert.equal(t.deleted.length, 0);
    assert.equal(t.notifications.length, 0);
  }
});

test('일치한 답은 한 번만 기록하고 성공한 비디자인 자료의 영상만 정리한다', async () => {
  const t = fixture();
  const row = { row: 7, 게시물ID: 'fixture-a', 종류: 'AI 작업 팁', 판단: '기록', 사유: '지금 방식과 차이가 작다', 카드: 'docs/참고카드/카드/x.md' };
  const r = await t.run([row, row]);
  assert.equal(r.기록, 1);
  assert.equal(t.reviews.length, 1);
  assert.equal(t.writes[0].value.게시물ID, 'fixture-a');
  assert.equal(t.deleted.length, 2);
  assert.ok(t.deleted.every(file => path.basename(path.dirname(file)) === 'fixture-a'));
});

test('장부 거절 또는 디자인 참고 시안 · 기록이면 원본 영상을 보존한다', async () => {
  for (const [code, kind] of [[1, 'AI 작업 팁'], [0, '디자인 참고']]) {
    const t = fixture(code);
    const r = await t.run([{ row: 7, 게시물ID: 'fixture-a', 종류: kind, 판단: '시안', 사유: '확실히 낫다', 카드: 'docs/참고카드/카드/x.md' }]);
    assert.equal(r.기록, code === 0 ? 1 : 0);
    assert.equal(t.deleted.length, 0);
  }
});

test('판단은 장부 「언제」 옛 값으로 짝지어 쓰고, 적용안 칸에 판단 머리를 붙인다', async () => {
  const t = fixture();
  await t.run([
    { row: 7, 게시물ID: 'fixture-a', 종류: '디자인 참고', 판단: '기각', 사유: '이미 쓰는 GSAP 전환이 더 낫다', 어디에: '홈페이지', 카드: 'docs/참고카드/카드/x.md' },
    { row: 8, 게시물ID: 'fixture-b', 종류: 'AI 작업 팁', 판단: '시안', 사유: '검수 묶음을 절반으로 줄인다', 적용안: '전후 비용 비교 한 장', 어디에: 'AI 작업 방식', 카드: 'docs/참고카드/카드/y.md' },
  ]);
  const [기각, 시안] = t.writes.map(w => w.value);
  assert.equal(기각.언제, '안 맞음');
  assert.equal(기각.적용안, '[기각] 사유: 이미 쓰는 GSAP 전환이 더 낫다');
  assert.equal(기각.카드, '', '기각은 카드를 장부에 잇지 않는다');
  assert.equal(기각.어디에, '');
  assert.equal(시안.언제, '지금');
  assert.equal(시안.적용안, '[시안] 검수 묶음을 절반으로 줄인다 · 전후 비용 비교 한 장');
  assert.equal(t.deleted.length, 4, '기각은 디자인 참고라도 영상을 지우고, 비디자인 시안도 지운다');
  assert.equal(t.notifications.length, 1);
  assert.match(t.notifications[0], /^\[판단\] 2건/);
  assert.match(t.notifications[0], /→ 기각\n   사유: 이미 쓰는 GSAP/);
  assert.match(t.notifications[0], /→ 시안 · AI 작업 방식\n   이유: 검수 묶음/);
  assert.match(t.notifications[0], /시안은 다음 카드 적용 회차/);
});

test('텔레그램은 카드 커밋보다 먼저 보낸다(커밋이 오래 걸려도 판단 알림이 늦지 않게)', async () => {
  const t = fixture();
  const order = [];
  const 알림 = t.notifications.push.bind(t.notifications);
  t.notifications.push = (x) => { order.push('알림'); return 알림(x); };
  t.ctx.실행 = ((실행) => (exe, args) => { if (args[0]?.includes('커밋')) order.push('커밋'); return 실행(exe, args); })(t.ctx.실행);
  await t.run([{ row: 7, 게시물ID: 'fixture-a', 종류: '기타', 판단: '기각', 사유: '잘못 보낸 링크' }]);
  assert.deepEqual(order, ['알림', '커밋']);
});

test('판단 값이 세 갈래가 아니면 기록하지 않고 다음 실행에 남긴다', async () => {
  const t = fixture();
  const r = await t.run([{ row: 7, 게시물ID: 'fixture-a', 종류: '기타', 판단: '지금', 사유: '옛 값' }]);
  assert.equal(r.기록, 0);
  assert.equal(t.reviews.length, 0);
  assert.equal(t.notifications.length, 0);
  assert.ok(r.문제.some(x => /세 갈래|시안 · 기록 · 기각/.test(x)));
});
