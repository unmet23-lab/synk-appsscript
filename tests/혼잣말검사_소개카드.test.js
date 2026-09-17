'use strict';
/* 혼잣말검사 — 소개 카드 «대사» 칸의 금지패턴 회귀 (2026-09-06 · 철학 5회차 심문 아스트라 A5)
 *
 * 무엇을 지키나: 학생이 가이드를 고르는 화면의 대사에 등수·점수·평가어가 들어가도 「정합 OK」가 찍히던 구멍.
 *   자를 «소스 글자»로 재지 않는다 — 변형을 넣은 사본으로 실제로 빨개지나를 잰다(기억 test-guards-the-defect).
 *
 * 재는 법: 정본 JSON 을 임시 폴더에 복사해 대사 한 칸만 바꾸고, env 로 그 사본을 가리켜 검사기를 띄운다.
 *   혼잣말 정본은 그대로 두므로(사본 아님) 이 시험이 잡는 것은 소개 카드 층뿐이다.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const 검사기 = path.join(ROOT, 'tools', '혼잣말검사.js');
const 정본 = path.join(ROOT, 'docs', '캐릭터', '소개글_정본.json');

function 돌리기(사본경로) {
  return spawnSync(process.execPath, [검사기], {
    cwd: ROOT, encoding: 'utf8', timeout: 60000,
    env: { ...process.env, SYNK_소개글_정본: 사본경로 },
  });
}

function 사본(바꾸기) {
  const j = JSON.parse(fs.readFileSync(정본, 'utf8'));
  바꾸기(j);
  const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'synk-소개-')), '소개글_정본.json');
  fs.writeFileSync(p, JSON.stringify(j), 'utf8');
  return p;
}

test('실물 정본 그대로면 초록이다(대조군 — 이 줄이 빨가면 아래 두 시험은 무의미하다)', () => {
  const r = 돌리기(정본);
  assert.strictEqual(r.status, 0, r.stderr + r.stdout);
});

test('🔴 대사 「너는 반에서 1등이야!」 — 숫자·남과의 비교로 빨개진다', () => {
  const p = 사본((j) => { j.카드[0].한마디 = '너는 반에서 1등이야!'; });
  const r = 돌리기(p);
  assert.strictEqual(r.status, 1, '종료코드 1 이어야 한다\n' + r.stdout + r.stderr);
  assert.match(r.stderr, /소개카드 .*: 한마디 (숫자|남과의 비교)/);
});

test('🔴 대사 「너는 100점, 최고야!」 — 숫자·점수·평가어로 빨개진다', () => {
  const p = 사본((j) => { j.카드[1].잘했을때 = '너는 100점, 최고야!'; });
  const r = 돌리기(p);
  assert.strictEqual(r.status, 1, '종료코드 1 이어야 한다\n' + r.stdout + r.stderr);
  assert.match(r.stderr, /소개카드 .*: 잘했을때 (숫자|점수·등급|평가어)/);
});

/* 6회차 심문(아스트라) — 대사 칸만 고치고 목록 칸·파일 부재·카드 수를 안 봤다 */
test('🔴 목록 칸 「이런너에게: 반에서 1등 하고 싶은 너」 — 숫자·남과의 비교로 빨개진다', () => {
  const p = 사본((j) => { j.카드[2].이런너에게 = ['반에서 1등 하고 싶은 너']; });
  const r = 돌리기(p);
  assert.strictEqual(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stderr, /소개카드 .*: 이런너에게 (숫자|남과의 비교)/);
});

test('🔴 카드가 셋 가운데 둘뿐이면 빨개진다 — 「없다」는 「안 재봤다」가 아니다', () => {
  const p = 사본((j) => { j.카드 = j.카드.slice(0, 2); });
  const r = 돌리기(p);
  assert.strictEqual(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stderr, /소개카드: 셋이 한 장씩이어야 한다/);
});

test('🔴 정본 파일이 없으면 빨개진다 — 검사 생략은 통과가 아니다', () => {
  const r = 돌리기(path.join(os.tmpdir(), 'synk-없는-소개글', '소개글_정본.json'));
  assert.strictEqual(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stderr, /소개카드: 정본 파일이 없다/);
});
