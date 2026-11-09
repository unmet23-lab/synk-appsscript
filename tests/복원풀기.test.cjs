'use strict';
// node --test tests/복원풀기.test.cjs — 복호화 암호가 틀리면 그 자리에서 다시 묻고(받은 조각을 버리지 않게), 다섯 번 틀리면 멈춘다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const 암호 = require('../tools/복원/암호.js');
const 풀기 = require('../tools/복원/복원풀기.cjs');

const 진짜 = '시험용-창고-열쇠-암호';

function 판() {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), '복원풀기시험-'));
  const 잠금 = path.join(뿌리, '비밀키_잠금.json');
  fs.writeFileSync(잠금, JSON.stringify(암호.makeKeys(진짜).locked));
  const 값 = (묻기) => ({ 집: path.join(뿌리, '집'), 폴더: [], 받기: [], 비밀키: 잠금, 임시: path.join(뿌리, '임시'), 묻기 });
  return { 값, 끝: () => fs.rmSync(뿌리, { recursive: true, force: true }) };
}

test('틀린 암호는 그 자리에서 다시 묻고, 맞으면 이어 간다', async () => {
  const t = 판();
  try {
    const 답 = ['열자짜리글자임', '열두 글자가 넘는 틀린 암호', 진짜];
    let 번 = 0;
    const 합 = await 풀기.돌리기(t.값(async () => { 번 += 1; return 답.shift(); }), () => {});
    assert.equal(번, 3);
    assert.equal(합.조각, 0);
  } finally { t.끝(); }
});

test('다섯 번 틀리면 멈춘다', async () => {
  const t = 판();
  try {
    let 번 = 0;
    await assert.rejects(풀기.돌리기(t.값(async () => { 번 += 1; return '열두 글자가 넘는 틀린 암호'; }), () => {}), /암호가 맞지 않습니다/);
    assert.equal(번, 5);
  } finally { t.끝(); }
});
