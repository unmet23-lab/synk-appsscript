'use strict';
const fs = require('node:fs'), path = require('node:path');
const file = path.join(process.argv[2], 'atlas-next-plan-shell.test.mjs');
let s = fs.readFileSync(file, 'utf8');
const crlf = s.includes('\r\n'), eol = x => (crlf ? x.replace(/\r?\n/g, '\r\n') : x);
s += eol(`
// 검수 s3d G3: 기기 기록부(손님 · 동의를 끈 계정)에서 새 길 짧은 진단을 도중에 그만두면 판이 그 답으로 다시 접힌다. 접힌 뒤 홈(세 줄 · 이번 주 계획)을
// 한 번 더 그린다 — 엔진의 watch는 같은 문서 안의 접기를 알리지 않아, 그대로면 다른 계기 전까지 홈이 접기 전 요약에 머문다.
test('새 길 짧은 진단을 도중에 그만두면 판이 그 답으로 다시 접힌 뒤 홈을 한 번 더 그린다(검수 s3d G3)', async () => {
  let release = () => {};
  const hold = new Promise(resolve => (release = resolve));
  let held = 0;
  const app = shell({
    wrap: made => ({
      ...made,
      finishSet(options) {
        const out = made.finishSet(options);
        if (!out?.folded) return out;
        held += 1;
        return { ...out, folded: hold.then(() => out.folded) };
      },
    }),
  });
  try {
    app.education.refresh();
    await until(() => engineHome(app), '엔진 판의 이번 주 계획');
    await app.education.position();
    await until(() => /data-position-next="engine"/.test(app.last()), '엔진 판');
    await app.education.position({ start: true });
    await until(() => app.box()?.html.includes('data-position-run'), '진단 문항');
    assert.equal(await answerItems(app, 1), 1, '한 문항 답한다');
    app.box().press('data-position-stop');
    await tick(20);
    assert.equal(held, 1, '판을 닫으며 다시 접기를 기다린다');
    const before = app.drawn();
    await tick(20);
    assert.equal(app.drawn(), before, '접기 전에는 더 그리지 않는다');
    release();
    await until(() => app.drawn() > before, '접힌 뒤 홈을 다시 그린다');
  } finally {
    release();
    app.dispose();
  }
});
`);
fs.writeFileSync(file, s);
console.log('G3 시험 더함');
