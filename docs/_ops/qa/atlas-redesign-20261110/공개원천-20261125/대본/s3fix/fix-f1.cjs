'use strict';
// 검수 -s3f1 Fable F1: 「이어서 하기」(하던 복습 판)는 새 길 판정(dueState)이 있을 때만 — 꺼진 판 복습 첫 화면 · 허브 포스터는 라이브 그대로.
//   node fix-f1.cjs <life-ui.mjs …>  — 자리마다 꼭 한 번 있어야 고친다(줄 끝은 그대로).
const fs = require('node:fs');
const 바꿈 = [
  ['resume=!s.dueCount&&resumableReview();', 'resume=!s.dueCount&&!!s.dueState&&resumableReview();'],
  ["const reviewPoster=(s,why='')=>!backCount(s)&&resumableReview()?resumePoster(why)", "const reviewPoster=(s,why='')=>!backCount(s)&&!!s.dueState&&resumableReview()?resumePoster(why)"],
  ['그대로 연다. 그때 허브 포스터는 「이어 하기」로 그 판을 열고(「0개가 돌아왔어요」로 막히지 않는다), 복습 화면에도 이어 하기 단추를 둔다(검수 s3d GD3).',
   '그대로 연다. 그때 허브 포스터는 「이어 하기」로 그 판을 열고(「0개가 돌아왔어요」로 막히지 않는다), 복습 화면에도 이어 하기 단추를 둔다(검수 s3d GD3).\n // 새 길 판정(dueState)이 있을 때만이다 — 꺼진 판의 복습 첫 화면과 허브는 라이브 그대로다(검수 -s3f1 F1).'],
];
for (const f of process.argv.slice(2)) {
  let s = fs.readFileSync(f, 'utf8'); const nl = s.includes('\r\n') ? '\r\n' : '\n';
  for (const [a, b] of 바꿈) { const n = s.split(a).length - 1; if (n !== 1) throw Error(`${f}: 자리 ${n}번 — ${a.slice(0, 40)}`); s = s.replace(a, () => b.replace(/\n/g, nl)); }
  fs.writeFileSync(f, s); console.log('고침', f);
}
