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
  return { writes, deleted, reviews, notifications,
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
  const row = { row: 7, 게시물ID: 'fixture-a', 종류: 'AI 작업 팁' };
  const r = await t.run([row, row]);
  assert.equal(r.기록, 1);
  assert.equal(t.reviews.length, 1);
  assert.equal(t.writes[0].value.게시물ID, 'fixture-a');
  assert.equal(t.deleted.length, 2);
  assert.ok(t.deleted.every(file => path.basename(path.dirname(file)) === 'fixture-a'));
});

test('장부 거절 또는 디자인 참고 자료이면 원본 영상을 보존한다', async () => {
  for (const [code, kind] of [[1, 'AI 작업 팁'], [0, '디자인 참고']]) {
    const t = fixture(code);
    const r = await t.run([{ row: 7, 게시물ID: 'fixture-a', 종류: kind }]);
    assert.equal(r.기록, code === 0 ? 1 : 0);
    assert.equal(t.deleted.length, 0);
  }
});
