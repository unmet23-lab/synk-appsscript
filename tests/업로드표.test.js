'use strict';
// 업로드표(tools/lib/업로드표.js · tools/업로드표.js) — 칸 판정(O · △ · X · ! · –)과 표 한 장, 예약큐를 불러 써도 예약큐 본체가 돌지 않는지.
// 임시 폴더의 가짜 편 폴더만 읽고 docs/마케팅은 건드리지 않는다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { 칸, html } = require('../tools/lib/업로드표.js');

const now = Date.parse('2026-10-30T12:00:00+09:00');
const today = '2026-10-30';

test('칸 — 게시됨 O · 예약 O(시각 전 · 지남) · 승인 대기 △ · 고칠 것 △ · 안 보임 ! · 빈 칸 X · 쉼 –', () => {
  assert.deepEqual([칸([{ state: '게시됨', url: 'u' }], '2026-10-29', today, now).표, 칸([{ state: '게시됨', url: 'u' }], '2026-10-29', today, now).주소], ['O', 'u']);
  const 앞 = 칸([{ state: '예약됨', time: '2026-10-31T21:00+09:00' }], '2026-10-31', today, now);
  assert.deepEqual([앞.표, 앞.결, 앞.말], ['O', 'set', '예약 21:00']);
  const 지남 = 칸([{ state: '예약됨', time: '2026-10-29T21:00+09:00' }], '2026-10-29', today, now);
  assert.deepEqual([지남.표, 지남.결, 지남.말], ['O', 'done', '예약 · 확인 전']);
  assert.equal(칸([{ state: '예약됨', time: '2026-10-29T21:00+09:00', unseen: true }], '2026-10-29', today, now).표, '!');
  assert.deepEqual([칸([{ state: '승인 대기' }], '2026-10-31', today, now).표, 칸([{ state: '승인 대기', fix: true }], '2026-10-31', today, now).결], ['△', 'fix']);
  // 블로그 판은 같은 편 영상이 걸리면 예약큐가 채움(done)으로 센다 — 표는 아직 안 건 글이라 △로 보인다.
  assert.equal(칸([{ state: '승인 대기', done: true }], '2026-10-31', today, now).말, '영상 뒤에 걸 글');
  assert.deepEqual(['2026-10-29', today, '2026-10-31'].map((d) => 칸([], d, today, now).말), ['안 올라감', '아직 없음', '만들 차례']);
  assert.equal(칸([{ state: '보류' }], '2026-10-29', today, now).말, '보류');
  assert.equal(칸([], '2026-10-31', today, now, true).표, '–');
  assert.equal(칸([{ state: '예약됨', time: '2026-10-31T21:00+09:00' }, { state: '게시됨' }], '2026-10-31', today, now).편수, 2);
});

test('표 한 장 — 오늘 칸 · 합계 · 막힌 계정 줄 · 이름 이스케이프', () => {
  const range = ['2026-10-29', '2026-10-30', '2026-10-31'];
  const report = {
    range, server: null,
    accounts: [
      { account: 'a-yt', line: 'yuhobuilds', brand: 'yuhobuilds', off: [], byDay: { '2026-10-29': [{ state: '게시됨', title: '<편>' }], '2026-10-30': [], '2026-10-31': [{ state: '예약됨', time: '2026-10-31T21:00+09:00' }] } },
    ],
    blocked: [{ account: 'a-th', line: 'yuhobuilds', reason: '로그인 풀림' }],
  };
  const out = html(report, { accounts: { 'a-yt': { platform: 'youtube', handle: '@a' }, 'a-th': { platform: 'threads', handle: '@a' } }, now, today });
  assert.match(out, /<title>업로드 일정표<\/title>/);
  assert.match(out, /th class="d today"/);
  assert.match(out, /막힘 — 로그인 풀림/);
  assert.ok(!out.includes('<편>') && out.includes('&lt;편&gt;'));
  // 오늘은 빈 칸 하나(1개 중 0), 앞날 예약 하나(1개 중 1)
  assert.match(out, /오늘 10\/30 올라감·예약<\/div><div class="v">0<small> \/ 1/);
  assert.match(out, /앞 7일 예약 걸림<\/div><div class="v">1<small> \/ 1/);
});

test('tools/업로드표.js — 가짜 편 폴더로 파일을 쓰고, 예약큐를 불러도 예약큐 본체는 돌지 않는다', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), '업로드표-'));
  try {
    fs.writeFileSync(path.join(root, 'sns-계정.json'), JSON.stringify({ accounts: { 'yuhobuilds-youtube': { platform: 'youtube', handle: '@yuhobuilds', dailyLine: 'yuhobuilds' } } }));
    const dir = path.join(root, 'y1', '게시');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '준비.json'), JSON.stringify({ 브랜드: 'yuhobuilds', 슬롯: '2026-10-30', 제목: 'Y1', 판: [{ 계정: 'yuhobuilds-youtube', 시각: '2026-10-30T21:00+09:00' }] }));
    fs.writeFileSync(path.join(dir, '게시결과.json'), JSON.stringify({ 판: [{ 계정: 'yuhobuilds-youtube', 상태: '예약됨', 시각: '2026-10-30T21:00+09:00' }] }));
    const out = path.join(root, '표.html');
    const r = spawnSync(process.execPath, [path.resolve(__dirname, '..', 'tools', '업로드표.js'), '--폴더', root, '--오늘', '2026-10-30', '--출력', out], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.trim(), out); // 예약큐 본체의 표가 섞여 나오지 않는다
    const page = fs.readFileSync(out, 'utf8');
    assert.match(page, /예약 21:00/);
    assert.match(page, /10\/23\(금\) ~ 11\/6\(금\)/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
