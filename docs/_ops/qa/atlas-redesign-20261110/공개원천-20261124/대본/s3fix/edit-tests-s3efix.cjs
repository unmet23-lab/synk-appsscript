'use strict';
// -s3e 검수 지적 고침의 시험(life-ui 넷 · app-shell GA1)과 변형 두 줄 맞춤.  node edit-tests-s3efix.cjs <qa 폴더>
const fs = require('node:fs'), path = require('node:path');
const dir = process.argv[2];
const io = name => {
  const file = path.join(dir, name);
  let s = fs.readFileSync(file, 'utf8');
  const crlf = s.includes('\r\n'), eol = x => (crlf ? x.replace(/\r?\n/g, '\r\n') : x);
  const rep = (find, repl) => { const f = eol(find); const n = s.split(f).length - 1; if (n !== 1) throw Error(`${name}: ${n}번 — ${find.slice(0, 80)}`); s = s.replace(f, () => eol(repl)); };
  return { rep, add: text => { s += eol(text); }, save: () => fs.writeFileSync(file, s) };
};

const n = io('life-ui-next.test.mjs');
n.add(`
// 검수 s3e1(GPT): 복습 결과의 표현 합치기 · 「내일쯤」 · 자정 넘김 · 다시 그린 뒤 초점.
test('복습 결과는 같은 표현의 장면을 합칠 때 「곧 다시」도 합친다 — 장면 순서와 상관없이 같은 안내(검수 s3e1)', async () => {
  const { reviewRowsByExpression } = await import('../life-ui.mjs');
  const first = { korean: '안녕하세요', soon: false, again: false }, second = { korean: '안녕하세요', soon: false, again: true };
  for (const rows of [[first, second], [second, first]]) {
    const [row] = reviewRowsByExpression(rows.map(r => ({ ...r })));
    assert.equal(row.scenes, 2);
    assert.equal(row.again, true, '한 장면이라도 곧 다시 돌아오면 그 표현은 곧 다시다');
    assert.equal(row.soon, false);
  }
  const [only] = reviewRowsByExpression([{ korean: '네', soon: false, again: false }, { korean: '네', soon: true, again: false }]);
  assert.equal(only.soon, true, 'soon은 앞과 같이 합친다');
});

test('새 길 생활 화면 원문 — 「내일쯤」은 달력의 다음 날, 복습 화면 표지에는 오늘 날짜, 다시 그린 뒤 초점은 「내 위치」(data-view)도 되돌린다(검수 s3e1)', async () => {
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(new URL('../life-ui.mjs', import.meta.url), 'utf8');
  // 24시간 뒤로 재면 하루가 23시간인 날(일광 절약 시간 시작)에 이틀 뒤를 내일이라 했다.
  assert.match(source, /const next=new Date\\(now\\);next\\.setDate\\(next\\.getDate\\(\\)\\+1\\);\\r?\\n if\\(day\\(at\\)===day\\(next\\.getTime\\(\\)\\)\\)return t\\('life\\.when\\.tomorrowDay'\\);/);
  assert.doesNotMatch(source, /now\\+86400000/);
  // 자정이 지나면 「내일쯤」이 「오늘 중」이 된다 — 표지가 같으면 열린 복습 화면을 다시 그리지 않았다.
  assert.match(source, /const reviewSign=s=>\\[[^\\]]*,new Date\\(\\)\\.toDateString\\(\\)\\]\\.join\\('\\|'\\);/);
  // 허브의 「내 위치」 단추는 data-view만 있다 — 빠지면 초점이 닫기 단추로 가서 엔터가 허브를 닫았다.
  assert.match(source, /find\\(a=>a\\.name\\.startsWith\\('data-life-'\\)\\|\\|a\\.name==='data-view'\\)/);
});
`);
n.save();

const o = io('atlas-next-off.test.mjs');
o.add(`
// 검수 s3e2 GA1: 학습 기록 동의를 바꾼 뒤 지우는 학습일 답은 누른 때의 계정 것이다 — 기다리는 사이 다른 계정으로 바뀌면 응답 때의 계정 열쇠를 지웠다.
test('학습 기록 동의 바꾸기는 누른 때의 계정 열쇠만 지우고, 판을 다시 정하는 것도 그 계정의 생활 기록일 때만이다(검수 s3e2 GA1)',()=>{
 const shell=read('app-shell.mjs');
 const start=shell.indexOf("if(control.matches?.('[data-world-learning]'))"),end=shell.indexOf("if(!control.matches?.('[data-town-sharing]'))");
 assert.ok(start>0&&end>start,'동의 토글 손잡이를 찾았다');
 const handler=shell.slice(start,end);
 assert.match(handler,/const enabled=control\\.checked,owner=client\\.snapshot\\?\\.accountId;/);
 assert.equal(handler.match(/clearMonthAnswer\\(localStorage,owner\\)/g)?.length,2,'됨 · 실패 두 갈래 모두 누른 때의 계정');
 assert.doesNotMatch(handler,/clearMonthAnswer\\(localStorage,client\\.snapshot/);
 assert.equal(handler.match(/if\\(life\\.owner===\\(owner\\|\\|'guest'\\)\\)life\\.atlasNext\\?\\.redecide\\?\\.\\('account'\\)/g)?.length,2);
});
`);
o.save();

const v = io('position-mutants.mjs');
v.rep(`    '.then(()=>{clearMonthAnswer(localStorage,client.snapshot?.accountId);',`, `    '.then(()=>{clearMonthAnswer(localStorage,owner);',`);
v.rep(`    'control.checked=!enabled;clearMonthAnswer(localStorage,client.snapshot?.accountId);',`, `    'control.checked=!enabled;clearMonthAnswer(localStorage,owner);',`);
v.save();
console.log('시험 더함 · 변형 두 줄 맞춤');
