'use strict';
// 빈칸 베기 공개(11-04 저녁 판): 공용 네 파일의 「지금 공개본」에 빈칸 베기 줄만 얹는다 — 겹침을 푸는 대신 내 판에서 그 줄을 뽑아 공개본에 끼운다(공개본의 다른 게임 줄은 건드리지 않는다).
// 공개 작업 폴더 merged/에서 돈다: <이름>.live2 = 지금 공개본, <이름>.ours = 내 빌드 → <이름>.hap = 합친 판. 끼울 자리가 없거나 둘이면 멈춘다.
//   node <이 파일>   (현재 폴더: .tmp/blank-slice-publish-20261104/merged)
const fs = require('fs');
const read = (name) => fs.readFileSync(name, 'utf8');
const pick = (name, pattern) => {
  const found = read(name).split('\n').filter((line) => pattern.test(line));
  if (found.length !== 1) throw new Error(`${name} 내 줄 ${pattern}: ${found.length}개`);
  return found[0];
};
const before = (text, anchor, lines, name) => {
  if (text.split(anchor).length !== 2) throw new Error(`${name} 자리 ${anchor}: ${text.split(anchor).length - 1}곳`);
  return text.replace(anchor, () => lines.join('\n') + '\n' + anchor);
};
const write = (name, text) => { fs.writeFileSync(`${name}.hap`, text); console.log(name, '합침', Buffer.byteLength(read(`${name}.live2`)), '→', Buffer.byteLength(text)); };

{
  const n = 'app-shell.mjs', ours = `${n}.ours`;
  const lines = [pick(ours, /^ \/\/ 빈칸 베기\(11-04/), pick(ours, /^ blank:\{get title/)];
  write(n, before(read(`${n}.live2`), ' // MT 바닷가 레이스', lines, n));
}
{
  const n = 'home.mjs', ours = `${n}.ours`;
  // 빈칸 베기는 내 판에서 표의 끝이라 쉼표가 없다 — 공개본에서는 레이스 앞이라 붙인다
  const lines = [pick(ours, /^ \/\/ 빈칸 베기\(11-04/), pick(ours, /^ blank:\{get title/).replace(/,?\s*$/, ',')];
  write(n, before(read(`${n}.live2`), ' // MT 바닷가 레이스', lines, n));
}
{
  const n = 'play-unlocks.mjs', ours = `${n}.ours`;
  const lines = [pick(ours, /^ {2}\/\/ 빈칸 베기\(11-04/), pick(ours, /^ {2}\/\/ 카페 첫 방문을 먼저 한 학생도/), pick(ours, /^ {2}blank: Object\.freeze/)];
  let text = before(read(`${n}.live2`), '  // MT 바닷가 자전거 레이스', lines, n);
  text = before(text, '    directionsDone: Number(', ['    lessons: Number(summary.completed) || 0,'], n);
  write(n, text);
}
{
  const n = 'world-strings.mjs', ours = `${n}.ours`;
  let text = before(read(`${n}.live2`), " 'game.racing.title':", [pick(ours, /^ 'game\.blank\.title':/), pick(ours, /^ 'game\.blank\.detail':/)], n);
  text = before(text, " 'play.where.directions':", [pick(ours, /^ 'play\.where\.lesson':/)], n);
  write(n, text);
}
