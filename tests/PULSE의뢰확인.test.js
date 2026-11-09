'use strict';

// PULSE 의뢰 확인 — 새 의뢰 알림이 Claude 메모와 따로, 의뢰 번호마다 한 번만 가는지(11-10 구매 점검 M5).
// 임시 폴더와 가짜 알림만 쓴다. 작업실 · 텔레그램 · Claude는 건드리지 않는다.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const 작업 = require('../tools/크레딧작업/PULSE의뢰확인.js');

const 방만들기 = () => fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-order-alert-'));
const 알림모음 = (돌려줄 = { code: 0 }) => {
  const 보낸 = [];
  return { 보낸, 알림: (글) => { 보낸.push(글); return typeof 돌려줄 === 'function' ? 돌려줄(글) : 돌려줄; } };
};

test('새 의뢰는 번호마다 한 번만 알리고 장부에 남긴다', async () => {
  const 방 = 방만들기();
  const { 보낸, 알림 } = 알림모음();
  const ctx = { 방, 알림, 지금: '2026-11-10T05:00:00.000Z' };
  const 새것 = { 번호: 'P-1110-AB12', 제목: '  오미톡\n오미자   스파클링 ' };
  assert.equal(await 작업.새의뢰알림(ctx, 새것), true);
  assert.equal(await 작업.새의뢰알림(ctx, 새것), false);
  assert.equal(보낸.length, 1);
  assert.match(보낸[0], /^PULSE 새 의뢰 P-1110-AB12 · 오미톡 오미자 스파클링\n/);
  assert.doesNotMatch(보낸[0], /https?:|@/);
  const 장부 = JSON.parse(fs.readFileSync(path.join(방, '알린의뢰.json'), 'utf8'));
  assert.deepEqual(장부, { 'P-1110-AB12': '2026-11-10T05:00:00.000Z' });
  // 다른 번호는 따로 알린다.
  assert.equal(await 작업.새의뢰알림(ctx, { 번호: 'P-1110-CD34', 제목: '' }), true);
  assert.match(보낸[1], /^PULSE 새 의뢰 P-1110-CD34\n/);
});

test('보내지 못하면 장부에 적지 않아 다음 회차가 다시 보낸다', async () => {
  const 방 = 방만들기();
  const 새것 = { 번호: 'P-1110-EF56', 제목: '시험' };
  const 실패 = 알림모음({ code: 1, stderr: 'hermes down' });
  assert.equal(await 작업.새의뢰알림({ 방, 알림: 실패.알림 }, 새것), false);
  const 던짐 = 알림모음(() => { throw new Error('spawn failed'); });
  assert.equal(await 작업.새의뢰알림({ 방, 알림: 던짐.알림 }, 새것), false);
  assert.equal(fs.existsSync(path.join(방, '알린의뢰.json')), false);
  const 성공 = 알림모음({ code: 0, 건너뜀: true });
  assert.equal(await 작업.새의뢰알림({ 방, 알림: 성공.알림 }, 새것), true);
  assert.equal(성공.보낸.length, 1);
});

test('깨진 장부는 빈 장부로 읽고, 제목은 80자에서 자른다', async () => {
  const 방 = 방만들기();
  fs.writeFileSync(path.join(방, '알린의뢰.json'), '{깨짐');
  const { 보낸, 알림 } = 알림모음();
  assert.equal(await 작업.새의뢰알림({ 방, 알림 }, { 번호: 'P-1110-0A0B', 제목: '가'.repeat(200) }), true);
  const 첫줄 = 보낸[0].split('\n')[0];
  assert.equal(첫줄, `PULSE 새 의뢰 P-1110-0A0B · ${'가'.repeat(80)}`);
});

test('메모가 실패해도 새 의뢰 알림은 사전 확인에서 먼저 간다(사후에만 묶이지 않음)', () => {
  const 글 = fs.readFileSync(path.join(__dirname, '..', 'tools', '크레딧작업', 'PULSE의뢰확인.js'), 'utf8');
  const 사전 = 글.slice(글.indexOf('async 사전확인('), 글.indexOf('인자()'));
  assert.ok(사전.indexOf('새의뢰알림(ctx') > 0 && 사전.indexOf('새의뢰알림(ctx') < 사전.indexOf('의뢰.받기('), '내려받기 전에 알린다');
});
