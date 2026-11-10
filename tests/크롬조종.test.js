'use strict';
/* 크롬조종 — 모든 기다림에 끝이 있고, 깨질 때 띄운 크롬을 끄는지 (2026-11-10).
 * 11-10 전체 시험(tools/test-ci.js)이 글자검사에서 5시간 넘게 멈췄다: CI 모사가 바꾼 USERPROFILE 때문에 크롬이 조종 통로를 안 열었고,
 * 20초 뒤 깨진 다음에도 그 크롬이 살아 stderr 통로를 붙잡아 시험 파일 프로세스가 끝나지 못했다. 기록: docs/현장노트/시험_화면확인.md */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const 조종길 = path.join(REPO, 'tools', 'lib', '크롬조종.js');
const 조종 = require(조종길);
const 크롬있음 = (() => { try { 조종.크롬찾기(); return true; } catch { return false; } })();
const 크롬없음 = 크롬있음 ? false : '크롬 없음(SYNK_CHROME으로 경로를 줄 수 있다)';

test('크롬환경 — 윈도우에서 바뀐 USERPROFILE만 로그인 계정의 실제 폴더로 돌린다(다른 값은 그대로)', () => {
  const 가짜 = path.join(os.tmpdir(), 'synk-가짜홈');
  const env = { USERPROFILE: 가짜, HOME: 가짜, TZ: 'UTC', CI: 'true', 남는값: '그대로' };
  const 받음 = 조종.크롬환경(env);
  if (process.platform !== 'win32') {
    assert.equal(받음, env, '윈도우가 아니면 손대지 않는다');
    return;
  }
  const 실제 = os.userInfo().homedir;
  assert.equal(받음.USERPROFILE, 실제);
  assert.notEqual(받음, env, '받은 env 를 고쳐 쓰지 않는다');
  assert.equal(env.USERPROFILE, 가짜);
  assert.deepEqual({ ...받음, USERPROFILE: 가짜 }, env, 'HOME · TZ · CI 는 그대로(크롬이 막힌 것은 USERPROFILE 하나였다)');
  const 이미 = { USERPROFILE: 실제, HOME: 가짜 };
  assert.equal(조종.크롬환경(이미), 이미, '이미 실제 폴더면 그대로 돌려준다');
});

test('크롬띄우기 — 한도를 넘기면 띄운 크롬을 끄고 깨진다(부른 프로세스가 스스로 끝난다)', { skip: 크롬없음 }, () => {
  const 프로필 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-크롬조종-시험-'));
  // 1ms 안에 조종 통로를 알릴 크롬은 없다 → 언제나 한도 넘김 길. 크롬이 남으면 이 아이 프로세스가 끝나지 못해 spawnSync 한도에 걸린다.
  const 식 = `require(${JSON.stringify(조종길)}).크롬띄우기(${JSON.stringify(프로필)}, { 기다림ms: 1 })`
    + `.then(() => { console.log('열림'); process.exitCode = 3; }, (e) => console.log('깨짐: ' + e.message));`;
  const r = spawnSync(process.execPath, ['-e', 식], { encoding: 'utf8', timeout: 60000, windowsHide: true });
  try { fs.rmSync(프로필, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch { /* 청소 실패는 판정과 무관 */ }
  assert.equal(r.error, undefined, `아이 프로세스가 60초 안에 안 끝났다 — 크롬이 남았다: ${r.error && r.error.message}`);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /깨짐: 크롬이 조종 통로를 1ms 안에 안 열었다/);
});

test('통로 — 답 없는 부름 · 안 오는 사건은 한도에서 깨지고, 닫은 뒤의 부름은 바로 깨진다 · 못 여는 지면은 지면열기가 깬다', { skip: 크롬없음 }, async () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-크롬조종-시험-'));
  const html = path.join(방, 'p.html');
  fs.writeFileSync(html, '<!doctype html><meta charset="utf-8"><p>시험</p>', 'utf8');
  const 열린 = await 조종.지면열기(html, { 기다림: 'document.readyState==="complete"', 최대초: 20, 부름초: 30 });
  try {
    const { c } = 열린;
    const 시작 = Date.now();
    await assert.rejects(c.보냄('Runtime.evaluate', { expression: 'new Promise(() => {})', awaitPromise: true }, 400), /Runtime\.evaluate가 400ms 안에 답하지 않았다/);
    await assert.rejects(c.사건('Page.없는사건', 300), /Page\.없는사건이 300ms 안에 안 왔다/);
    assert.ok(Date.now() - 시작 < 10000, '한도(0.4초 · 0.3초)를 지나 곧 깨져야 한다');
    const r = await c.보냄('Runtime.evaluate', { expression: '1 + 1', returnByValue: true });
    assert.equal(r.result.value, 2, '한도로 깨진 부름 뒤에도 통로는 쓸 수 있다');
    열린.닫기();
    await assert.rejects(c.보냄('Runtime.evaluate', { expression: '1' }), /조종 통로를 닫았다/);
    열린.닫기(); // 두 번 불러도 괜찮다
  } finally { 열린.닫기(); }
  await assert.rejects(조종.지면열기(path.join(방, '없는파일.html'), { 부름초: 30 }), /지면을 못 열었다|안 왔다/);
  fs.rmSync(방, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});
