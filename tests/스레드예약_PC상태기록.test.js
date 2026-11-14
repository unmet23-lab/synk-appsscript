'use strict';
/* 스레드 21시 게시(tools/스레드예약/게시.js)의 판정과 PC 상태 기록(tools/PC상태기록/기록.py)의 줄 꼴 — 2026-11-14 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const 게시 = require('../tools/스레드예약/게시.js');

const 편만들기 = (뿌리, 이름, 준비) => {
  const d = path.join(뿌리, 'docs', '마케팅', 이름, '게시');
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, '준비.json'), JSON.stringify(준비));
};

test('스레드 게시: 오늘 슬롯의 yuhobuilds-threads 판이 든 편만 찾고, 같은 이름은 앞 뿌리 것을 쓴다', () => {
  const a = fs.mkdtempSync(path.join(os.tmpdir(), 'th-a-'));
  const b = fs.mkdtempSync(path.join(os.tmpdir(), 'th-b-'));
  편만들기(a, '오늘편', { 판: [{ 계정: 'yuhobuilds-threads', 시각: '2026-11-15T21:00+09:00' }] });
  편만들기(b, '오늘편', { 판: [{ 계정: 'yuhobuilds-threads', 시각: '2026-11-16T21:00+09:00' }] });
  편만들기(b, '내일편', { 판: [{ 계정: 'yuhobuilds-threads', 시각: '2026-11-16T21:00+09:00' }] });
  편만들기(b, '다른계정', { 판: [{ 계정: 'yuhobuilds-youtube', 시각: '2026-11-15T21:00+09:00' }] });
  편만들기(b, '고칠편', { 검사: { 결과: '고칠 것' }, 판: [{ 계정: 'yuhobuilds-threads', 시각: '2026-11-15T21:00+09:00' }] });
  const 편들 = 게시.오늘편([a, b], '2026-11-15');
  assert.deepEqual(편들.map((e) => e.편).sort(), ['고칠편', '오늘편']);
  assert.equal(편들.find((e) => e.편 === '고칠편').고칠것, true);
});

test('스레드 게시: 창 밖, 편 없음, 최종 확인 전이면 올리지 않고 모두 통과일 때만 올린다', () => {
  const 통과 = [{ 편: 'A', 막힘: '' }];
  const 막힘 = [{ 편: 'A', 막힘: '' }, { 편: 'B', 막힘: '최종 확인 기록 없음' }];
  assert.equal(게시.판정({ 날짜: '2026-11-15', 분: 20 * 60, 편들: 통과 }).결과, '창 밖');
  assert.equal(게시.판정({ 날짜: '2026-11-15', 분: 21 * 60, 편들: [] }).결과, '오늘 편 없음');
  const p = 게시.판정({ 날짜: '2026-11-15', 분: 21 * 60, 편들: 막힘 });
  assert.equal(p.올림, false);
  assert.match(p.까닭, /B\(최종 확인 기록 없음\)/);
  assert.equal(게시.판정({ 날짜: '2026-11-15', 분: 21 * 60, 편들: 통과 }).올림, true);
  assert.equal(게시.판정({ 날짜: '2026-11-15', 분: 23 * 60 + 59, 편들: 통과 }).올림, true);
  const 확인만 = 게시.판정({ 날짜: '2026-11-15', 분: 9 * 60, 편들: 통과, 확인만: true });
  assert.equal(확인만.올림, false, '확인만이면 통과여도 올리지 않는다');
  assert.equal(확인만.결과, '확인만 — 올릴 수 있음');
});

test('스레드 게시: 편을 읽지 못하면 막힘으로 본다', () => {
  const 빈 = fs.mkdtempSync(path.join(os.tmpdir(), 'th-c-'));
  const r = 게시.최종확인판정([{ 편: '없는편', 고칠것: false }, { 편: '고칠편', 고칠것: true }], 빈);
  assert.match(r[0].막힘, /편을 읽지 못함/);
  assert.equal(r[1].막힘, '올리기 전 검사 「고칠 것」');
});

test('스레드 게시: 스크립트 출력의 마지막 JSON 줄을 읽고 한국 시각으로 날짜와 분을 낸다', () => {
  assert.deepEqual(게시.마지막json('잡음\n{"ok":false}\n{"ok":true,"url":"https://x/1"}\n'), { ok: true, url: 'https://x/1' });
  assert.equal(게시.마지막json('아무것도 없음'), null);
  assert.deepEqual(게시.한국시각(new Date('2026-11-15T12:05:00Z')), { 날짜: '2026-11-15', 분: 21 * 60 + 5 });
  assert.deepEqual(게시.한국시각(new Date('2026-11-15T15:30:00Z')), { 날짜: '2026-11-16', 분: 30 });
});

test('PC 상태 기록: 한 줄을 열두 칸으로 남긴다', { skip: process.platform !== 'win32' && 'Windows에서만 돈다' }, () => {
  const 자리 = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-state-'));
  const r = spawnSync('python', ['-X', 'utf8', '-B', path.join(__dirname, '..', 'tools', 'PC상태기록', '기록.py')], { env: { ...process.env, LOCALAPPDATA: 자리 }, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const 폴더 = path.join(자리, 'synk', 'pc-state');
  const 파일 = fs.readdirSync(폴더).filter((f) => f.endsWith('.tsv'));
  assert.equal(파일.length, 1);
  const 칸 = fs.readFileSync(path.join(폴더, 파일[0]), 'utf8').trim().split('\t');
  assert.equal(칸.length, 12, 칸.join(' | '));
  assert.match(칸[0], /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/);
  assert.match(칸[3], /^\d+\.\d\/\d+\.\d$/);
  assert.ok(Number(칸[5]) > 10, '프로세스 수');
  assert.ok(Number(칸[8]) >= 0, 'C: 쓰기 ms');
  assert.match(칸[11], /×\d+=\d/);
});
