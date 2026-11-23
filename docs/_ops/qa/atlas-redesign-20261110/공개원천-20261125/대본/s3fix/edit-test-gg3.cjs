'use strict';
// GG3 시험(master에 이미 있는 막이를 지킨다 — 후보에도 같은 줄을 넣었다): 닫으며 흐려지는 내 위치 판을 은행 도착 뒤의 repaint가 다시 열지 않는다.
const fs = require('node:fs'), path = require('node:path');
const file = path.join(process.argv[2], 'atlas-next-position-shell.test.mjs');
let s = fs.readFileSync(file, 'utf8');
const crlf = s.includes('\r\n'), eol = x => (crlf ? x.replace(/\r?\n/g, '\r\n') : x);
const anchor = eol(`// 30일째 문장(4-4c — 단계4_계획 §21-7).`);
if (s.split(anchor).length !== 2) throw Error('자리');
s = s.replace(anchor, () => eol(`test('은행이 다 온 뒤의 다시 그리기(repaint)는 닫으며 흐려지는 내 위치 판을 다시 열지 않는다(검수 s3d GG3 — 받기 알림의 D1과 같은 막이)', async () => {
  const app = shell({ timers: fakeClock(), panels: true, fade: true });
  try {
    await app.education.position();
    await until(() => /data-position-next="engine"/.test(app.last()), '엔진 판');
    await tick(20);
    const drawn = app.shown.length;
    app.closePanel();
    await tick(0); // 닫기의 새로 그리기
    app.education.repaint();
    assert.equal(app.shown.length, drawn, '흐려지는 판을 다시 그리지 않는다 — 닫은 판이 다시 열리지 않는다');
    app.endFade();
    assert.equal(app.last(), '');
  } finally {
    app.dispose();
  }
});

`) + anchor);
fs.writeFileSync(file, s);
console.log('GG3 시험 더함');
