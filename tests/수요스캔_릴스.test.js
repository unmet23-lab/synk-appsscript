'use strict';
// 수요 스캔 · 인스타 릴스(tools/수요스캔/릴스.js) — ego 없이 판정 · 막힘 · 결과 글만 본다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const 릴스 = require('../tools/수요스캔/릴스.js');
const 스캔 = require('../tools/수요스캔/스캔.js');

const 초 = (날짜) => Date.parse(`${날짜}T12:00:00+09:00`) / 1000;
const 평소 = Array.from({ length: 12 }, (_, i) => ({ code: `n${i}`, 재생: 2000 + i * 10, 좋아요: 30, 댓글: 1, 올린때: 초(`2026-10-${String(10 + i).padStart(2, '0')}`), 길이: 20 }));

test('릴스 판정 — 계정 평소 재생의 3배 · 최소 조회를 넘은 창 안 편만, 주소를 붙인다', () => {
  const rec = { 핸들: 'dailystudykorean', 상태: '됨', 릴스: [...평소, { code: 'BIG1', 재생: 45000, 좋아요: 900, 댓글: 40, 올린때: 초('2026-10-25'), 길이: 18.4 }] };
  const r = 릴스.계정판정(rec, { 오늘: '2026-10-28', 기준값: { 배수: 3, 최소조회: 10000 } });
  assert.equal(r.읽은편, 13);
  assert.equal(r.기준.중앙값, 2060);
  assert.deepEqual(r.후보.map((p) => [p.id, p.주소, p.길이]), [['BIG1', 'https://www.instagram.com/reel/BIG1/', 18]]);
  const 작음 = 릴스.계정판정({ ...rec, 릴스: [...평소, { code: 'MID', 재생: 9000, 올린때: 초('2026-10-25') }] }, { 오늘: '2026-10-28', 기준값: { 배수: 3, 최소조회: 10000 } });
  assert.equal(작음.후보.length, 0, '3배를 넘어도 최소 조회 밑이면 아니다');
  assert.deepEqual(릴스.계정판정({ 핸들: 'x', 상태: '막힘', 까닭: '계정 보호 확인 창' }, { 오늘: '2026-10-28' }), { 핸들: 'x', 상태: '막힘', 까닭: '계정 보호 확인 창', 후보: [] });
});

test('릴스 읽기 — 한 계정에서 막히면 남은 브랜드는 부르지 않고 막힘을 적는다', () => {
  const 출력 = fs.mkdtempSync(path.join(os.tmpdir(), '릴스-'));
  try {
    const 불림 = [];
    const 돌리기 = (job) => { 불림.push(job.계정); return { 결과: [{ 핸들: job.계정[0], 상태: '막힘', 까닭: '계정 보호 확인 창(본인입니다 / 내가 아닙니다)' }] }; };
    const r = 릴스.읽기(['lab-en', 'lab-mn'], { 날짜: '2026-10-28', 출력, 돌리기 });
    assert.equal(불림.length, 1, '막힌 뒤에는 ego를 다시 부르지 않는다');
    assert.match(r.결과['lab-mn'].막힘, /계정 보호/);
    const 글 = fs.readFileSync(path.join(출력, '릴스.md'), 'utf8');
    assert.match(글, /## lab-en[\s\S]*\*\*막힘 — 계정 보호 확인 창/);
    assert.ok(!/본인입니다를 눌/.test(글));
  } finally { fs.rmSync(출력, { recursive: true, force: true }); }
});

test('설정 — 인스타 계정은 핸들 목록이고, 두 LAB 설정에 들어 있다(10-28 못 잼에서 옮김)', () => {
  for (const b of ['lab-en', 'lab-mn']) {
    const { 설정, 오류 } = 스캔.설정읽기(b);
    assert.deepEqual(오류, []);
    assert.ok(설정.인스타.length >= 3, b);
    assert.ok(!설정.못잼.some((m) => 설정.인스타.some((x) => m.계정 === `@${x.핸들}`)), '읽는 계정은 못 잼에서 뺀다');
  }
});
