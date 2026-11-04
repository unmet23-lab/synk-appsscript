'use strict';
// 빈칸 베기 공개(11-04): 공개본(바닷가 레이스)과 후보가 맞닿은 네 파일을 합친다. 공개 작업 폴더 merged/에서 돈다 — merged/<이름>은 git merge-file로 만든 겹침 표식 판, 양쪽을 다 남기게 푼다.
const fs = require('fs');
function solve(name, fn) {
  const raw = fs.readFileSync(name, 'utf8');
  let n = 0;
  const out = raw.replace(/^<<<<<<< 내판\r?\n([\s\S]*?)^=======\r?\n([\s\S]*?)^>>>>>>> 공개본\r?\n/gm, (_, mine, live) => { n += 1; return fn(mine, live, n); });
  if (/^(<<<<<<<|=======|>>>>>>>)/m.test(out)) throw new Error('남은 표식 ' + name);
  fs.writeFileSync(name, out);
  console.log(name, '푼 곳', n);
}
const both = (mine, live) => mine + live;
solve('app-shell.mjs', both);
solve('home.mjs', both);
solve('play-unlocks.mjs', (mine, live, i) => {
  if (i === 1) return both(mine, live);
  const eol = live.includes('\r\n') ? '\r\n' : '\n';
  return live.replace(`cafeVisits: Number(summary.cafe?.completed) || 0,${eol}`, `cafeVisits: Number(summary.cafe?.completed) || 0,${eol}    lessons: Number(summary.completed) || 0,${eol}`);
});
solve('world-strings.mjs', (mine, live) => {
  const eol = live.includes('\r\n') ? '\r\n' : '\n';
  const m = mine.split(eol).filter(Boolean), l = live.split(eol).filter(Boolean);
  const key = (s) => /^ '([^']+)'/.exec(s)?.[1];
  const lm = Object.fromEntries(m.map((s) => [key(s), s])), ll = Object.fromEntries(l.map((s) => [key(s), s]));
  if (lm['play.locked'] !== ll['play.locked'] || lm['play.where.cafe'] !== ll['play.where.cafe']) throw new Error('공통 줄이 다르다');
  return [lm['game.blank.title'], lm['game.blank.detail'], ll['game.racing.title'], ll['game.racing.detail'], ll['play.locked'], ll['play.where.cafe'], ll['play.where.directions'], lm['play.where.lesson']].join(eol) + eol;
});
let s = fs.readFileSync('home.mjs', 'utf8');
const a = /(area:'[^']*'\})(\r?\n \/\/ MT 바닷가 레이스)/;
if (!a.test(s)) throw new Error('자리 없음');
s = s.replace(a, '$1,$2');
fs.writeFileSync('home.mjs', s);
