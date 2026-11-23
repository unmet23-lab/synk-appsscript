'use strict';
const fs = require('node:fs'), path = require('node:path');
const file = path.join(process.argv[2], 'atlas-next-position-shell.test.mjs');
let s = fs.readFileSync(file, 'utf8');
const crlf = s.includes('\r\n'), eol = x => (crlf ? x.replace(/\r?\n/g, '\r\n') : x);
const anchor = eol(`// 30일째 문장(4-4c — 단계4_계획 §21-7).`);
if (s.split(anchor).length !== 2) throw Error('자리');
s = s.replace(anchor, () => eol(`test('한글 열쇠 — 손님은 옛 코치를 들지 않아도 이 기기 열쇠(synk.hangul-stage.v1)로 졸업을 읽는다 — 계정 구역 열쇠로 바꾸지 않는다(검수 s3d GG1의 막이)', async () => {
  const storage = new Map([['synk.hangul-stage.v1', JSON.stringify({ v: 1, letters: {}, graduated: { at: '2026-11-01T00:00:00.000Z' } })]]);
  const app = shell({ reading: { answer: 'new' }, storage });
  try {
    await tick();
    await app.education.position();
    await until(() => /data-position-next="engine"/.test(app.last()), '엔진 판');
    assert.doesNotMatch(app.last(), /data-position-board="hangul"/, '이 기기에서 졸업했으면 한글 판이 아니다');
  } finally {
    app.dispose();
  }
});

`) + anchor);
fs.writeFileSync(file, s);
console.log('GG1 손님 시험 더함');
