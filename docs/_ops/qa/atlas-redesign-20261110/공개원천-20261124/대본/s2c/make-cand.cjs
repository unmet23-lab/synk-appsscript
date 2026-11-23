'use strict';
// 공개 도구(tools/공개.js 후보폴더쓰기)와 같은 꼴의 검수 후보 폴더를 만든다 — 앞 공개본이 아직 라이브가 아닌 때(③ 뒤에 올릴 2단계) 검수를 먼저 돌리려고.
// 공개 때 공개 도구가 「검수가 견준 앞 판 blob = 그때 라이브의 blob」과 「검수한 sha256 목록 = 올릴 바이트」를 다시 대조하므로, 여기서 틀리면 공개가 멈춘다.
//   node make-cand.cjs <후보 폴더> <명세.json>   명세: [{ "경로": "world/app-shell.mjs", "새": "<파일>", "앞": "<파일>" | null }, …]
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const [OUT, SPEC] = process.argv.slice(2);
const spec = JSON.parse(fs.readFileSync(SPEC, 'utf8'));
const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');
const blob = b => crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${b.length}\0`), b])).digest('hex');
if (fs.existsSync(OUT) && fs.readdirSync(OUT).length) throw Error('후보 폴더가 비어 있지 않다: ' + OUT);
const 항목 = [], 앞판 = {};
for (const x of spec) {
  const b = fs.readFileSync(x['새']);
  const f = path.join(OUT, ...x['경로'].split('/')); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, b);
  항목.push({ 경로: x['경로'], 종류: x['앞'] ? '바꿈' : '새', sha256: sha256(b), 모드: '100644' });
  if (x['앞']) {
    const a = fs.readFileSync(x['앞']);
    const g = path.join(OUT, '.앞판', ...x['경로'].split('/')); fs.mkdirSync(path.dirname(g), { recursive: true }); fs.writeFileSync(g, a);
    앞판[x['경로']] = blob(a);
  }
}
항목.sort((a, b) => a.경로.localeCompare(b.경로));
const 기록 = { 판: 1, 종류: 'synk.im', 항목, 위: process.env.WI || null, 계획: null, 앞판 };
fs.writeFileSync(path.join(OUT, '후보.json'), `${JSON.stringify(기록, null, 1)}\n`);
console.log('후보', 항목.length, '· 바꿈', Object.keys(앞판).length, '· 새', 항목.length - Object.keys(앞판).length);
