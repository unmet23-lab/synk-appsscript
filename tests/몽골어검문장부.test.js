'use strict';
/* 몽골어 검문 장부 회귀 — 2026-09-01
 *
 * 무엇을 지키나: **검문이 셈에 잡히는가.** 09-01 이전엔 도장이 사람이 쓴 문장이라
 *   문안을 고쳐도 그대로 남았고(도장 4벌 · 지문 0), 「돌렸나」를 셀 장부가 0줄이었다.
 *
 * ⚠ 여기서 «못» 재는 것: 실제 검문 왕복(제미나이 호출)은 키가 있어야 돌아 회귀로 안 잡는다.
 *   그래서 이 파일이 지키는 것은 **장부 층의 계약 셋**이고, 「검문이 실제로 장부를 남기더라」는
 *   09-01 손 실행으로 한 번 확인했을 뿐이다(안 재본 축을 안 재봤다고 적는다).
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const 대조 = require(path.join(path.resolve(__dirname, '..'), 'tools', '몽골어대조.js'));

test('🔑 지문 자가 ①배포 검수·심문 드리프트와 **같은 계산**이다 — 자가 둘이면 판정이 갈린다', () => {
  const buf = Buffer.from('아무 바이트나');
  const 손으로 = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 12);
  assert.strictEqual(대조.지문(buf), 손으로);
  assert.strictEqual(대조.지문(buf).length, 12);
});

test('장부는 한 줄씩 붙는다(append) — 덮어쓰면 이력이 아니라 마지막 한 번만 남는다', () => {
  const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'synk-mn-')), '깊은', '장부.jsonl');
  process.env.SYNK_MN_LEDGER = p;
  assert.strictEqual(대조.장부쓰기({ 시각: 'a' }), null, '없는 상위 폴더도 만들어야 한다');
  assert.strictEqual(대조.장부쓰기({ 시각: 'b' }), null);
  const 줄 = fs.readFileSync(p, 'utf8').split('\n').filter(Boolean);
  assert.strictEqual(줄.length, 2);
  assert.deepStrictEqual(줄.map((l) => JSON.parse(l).시각), ['a', 'b']);
  delete process.env.SYNK_MN_LEDGER;
});

test('🔑 장부를 못 써도 **던지지 않는다** — 여기서 죽으면 검문 자체가 안 도는 셈이 된다', () => {
  const 파일 = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'synk-mn-')), '막힘');
  fs.writeFileSync(파일, 'x');                     // 파일을 폴더 자리에 둬서 mkdir 을 막는다
  process.env.SYNK_MN_LEDGER = path.join(파일, '장부.jsonl');
  const 사유 = 대조.장부쓰기({ 시각: 'a' });
  assert.ok(typeof 사유 === 'string' && 사유.length, '실패는 «사유를 반환»해야 한다(조용한 null 금지)');
  delete process.env.SYNK_MN_LEDGER;
});
