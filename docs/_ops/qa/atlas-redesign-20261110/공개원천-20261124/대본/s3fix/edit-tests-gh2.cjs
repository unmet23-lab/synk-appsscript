'use strict';
// GH2 시험: 학습일 답 시험의 since를 표지(stamp)로, 두 탭 장면 더함, 꺼진 판 열쇠 검사에 표지 머리 더함, 변형 다섯.  node edit-tests-gh2.cjs <qa 폴더>
const fs = require('node:fs'), path = require('node:path');
const dir = process.argv[2];
const io = name => {
  const file = path.join(dir, name);
  let s = fs.readFileSync(file, 'utf8');
  const crlf = s.includes('\r\n'), nl = crlf ? '\r\n' : '\n', eol = x => (crlf ? x.replace(/\r?\n/g, '\r\n') : x);
  const rep = (find, repl, count = 1) => { const f = eol(find); const n = s.split(f).length - 1; if (n !== count) throw Error(`${name}: ${n}번(${count}이어야) — ${find.slice(0, 80)}`); s = s.split(f).join(eol(repl)); };
  return { rep, add: text => { s += eol(text); }, lines: fn => { s = s.split(nl).map(fn).join(nl); }, save: () => fs.writeFileSync(file, s) };
};

// 1) 학습일 답 시험 — since: X.generation()을 그 줄의 계정(write('acct' · write(A_ID))으로 표지 X.stamp(계정)로 바꾼다
const m = io('atlas-next-month-answer.test.mjs');
m.lines(line => {
  if (!/\.generation\(\)/.test(line)) return line;
  const acct = /\.write\(A_ID\b/.test(line) ? 'A_ID' : /\.write\('acct'/.test(line) || /const since = \w+\.generation\(\);/.test(line) ? "'acct'" : null;
  if (!acct) throw Error('계정을 모름: ' + line);
  return line.replace(/(\w+(?:\.\w+)*)\.generation\(\)/g, (all, who) => `${who}.stamp(${acct})`);
});
m.add(`
// 검수 s3d GH2: 탭 둘(모듈 사본 둘 — 세대 수가 문서마다 따로) · 저장소 하나. 탭 B가 묻는 중에 탭 A가 지우는 길(동의 끔 · 로그아웃)을 돌면, B의 늦은 답은
// 학습일 답을 다시 적지 않고 다시 그리지도 않는다. 열쇠가 없던 첫 물음도 같다 — 물을 때 둔 계정의 지우기 표지를 A가 지웠기 때문이다.
const MONTH_URL = process.env.SYNK_MONTH_ANSWER_MODULE
  ? pathToFileURL(process.env.SYNK_MONTH_ANSWER_MODULE).href
  : new URL('../world-month-answer.mjs', import.meta.url).href;
test('다른 탭이 지우면(동의 끔 · 로그아웃) 이 탭의 늦은 답은 학습일 답을 다시 적지도 다시 그리지도 않는다 — 열쇠가 없던 첫 물음도(검수 s3d GH2)', async () => {
  const tabA = await import(\`\${MONTH_URL}?tab=gh2-a\`);
  const tabB = await import(\`\${MONTH_URL}?tab=gh2-b\`);
  const key = \`\${tabA.MONTH_KIND.prefix}acct\`;
  for (const stale of [true, false]) {
    const values = new Map();
    const storage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k) };
    const pos = at(5);
    const coach = { summary: () => ({ storage: { guest: false, unfoldedRows: 0, sync: { received: pos } } }), pull: () => Promise.resolve(true) };
    let release;
    const pending = new Promise(resolve => (release = resolve));
    let redraws = 0;
    let asks = 0;
    const answers = tabB.createMonthAnswers({ storage });
    const asker = tabB.createMonthAsker({
      answers,
      account: () => 'acct',
      lineOf: () => ({ revision: 3, ask: () => ((asks += 1), pending) }),
      dayOf: () => '2026-11-23',
      offsetOf: () => 540,
      redraw: () => (redraws += 1),
      note: () => {},
      alive: () => true,
    });
    assert.equal(asker.month(coach), null, '묻는 중');
    assert.equal(asks, 1);
    if (stale) storage.setItem(key, '{"stale":true}');
    tabA.clearMonthAnswer(storage, 'acct');
    assert.equal(values.has(key), false, '탭 A가 지웠다');
    release({ complete: true, summaryAt: pos, lookback: { windows: WINDOWS, month: [{ unit: 'ko.word.1', misses: 2, reviews: 3, last: null }] } });
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(values.has(key), false, \`\${stale ? '앞서 적힌 값이 있던' : '열쇠가 없던 첫'} 물음의 늦은 답을 적지 않는다\`);
    assert.equal(redraws, 0, '늦은 답으로 다시 그리지 않는다');
  }
  // 적기도 같은 표지를 본다 — 물을 때 든 표지를 다른 탭이 지웠으면 적지 않는다.
  const values = new Map();
  const storage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k) };
  const answers = tabB.createMonthAnswers({ storage });
  const since = answers.stamp('acct', { ensure: true });
  tabA.clearMonthAnswer(storage, 'acct');
  assert.equal(answers.write('acct', { revision: 3, day: 'd1', askedFrom: at(5), at: at(5), windows: WINDOWS, month: [], since }), false, '다른 탭이 지운 뒤의 늦은 적기');
  assert.equal(answers.write('acct', { revision: 3, day: 'd1', askedFrom: at(5), at: at(5), windows: WINDOWS, month: [], since: answers.stamp('acct', { ensure: true }) }), true, '지운 뒤에 다시 물은 답은 적는다');
});
`);
m.save();

// 2) 꺼진 판 열쇠 검사 — 표지 머리를 정의에 더하고, 지우는 길은 그 계정의 표지도 지우며 아무것도 쓰지 않는다
const o = io('atlas-next-off.test.mjs');
o.rep(` const {clearMonthAnswer,MONTH_KIND,FIRST_KIND}=await import('../world-month-answer.mjs');
 const prefixes=[MONTH_KIND.prefix,FIRST_KIND.prefix];
 assert.deepEqual(prefixes,['synk:world:month-answer:','synk:world:first-answers:']);`,
` const {clearMonthAnswer,MONTH_KIND,FIRST_KIND,CLEAR_KIND}=await import('../world-month-answer.mjs');
 // 셋째 머리는 지우기 표지(검수 s3d GH2) — 새 길이 물을 때만 두고, 지우는 길은 그 계정의 표지도 지운다.
 const prefixes=[MONTH_KIND.prefix,FIRST_KIND.prefix,CLEAR_KIND.prefix];
 assert.deepEqual(prefixes,['synk:world:month-answer:','synk:world:first-answers:','synk:world:month-clear:']);`);
o.rep(` const values=new Map([[\`\${MONTH_KIND.prefix}acct-a\`,'1'],[\`\${FIRST_KIND.prefix}acct-a\`,'1'],[\`\${MONTH_KIND.prefix}acct-b\`,'1'],
  ['synk.world.lang','ko'],['synk:tutor:acct-a','x'],['synk.world.month-answer.acct-a','keep']]);
 const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
 clearMonthAnswer(storage,'acct-a');
 assert.deepEqual([...values.keys()].sort(),[\`\${MONTH_KIND.prefix}acct-b\`,'synk.world.lang','synk.world.month-answer.acct-a','synk:tutor:acct-a'].sort());`,
` const values=new Map([[\`\${MONTH_KIND.prefix}acct-a\`,'1'],[\`\${FIRST_KIND.prefix}acct-a\`,'1'],[\`\${MONTH_KIND.prefix}acct-b\`,'1'],
  [\`\${CLEAR_KIND.prefix}acct-a\`,'m'],[\`\${CLEAR_KIND.prefix}acct-b\`,'m'],
  ['synk.world.lang','ko'],['synk:tutor:acct-a','x'],['synk.world.month-answer.acct-a','keep']]);
 let writes=0;
 const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>{writes+=1;values.set(key,String(value));},removeItem:key=>values.delete(key)};
 clearMonthAnswer(storage,'acct-a');
 assert.deepEqual([...values.keys()].sort(),[\`\${MONTH_KIND.prefix}acct-b\`,\`\${CLEAR_KIND.prefix}acct-b\`,'synk.world.lang','synk.world.month-answer.acct-a','synk:tutor:acct-a'].sort());
 assert.equal(writes,0,'지우는 길은 쓰지 않는다(꺼진 판의 로그아웃 · 동의 바꿈 — 쓰기 0)');`);
o.save();

// 3) 변형 다섯(monthAnswer 갈래)
const v = io('position-mutants.mjs');
v.rep(`  [
    "monthAnswer",
    "근거 상자",
    "근거 답의 게임을 보지 않는다`, `  // ── 지우기 표지(검수 s3d GH2): 다른 탭의 지우는 길이 이 탭의 늦은 답을 막는다 ──
  [
    "monthAnswer",
    "지우기 표지",
    "적을 때 지우기 표지를 보지 않는다 — 다른 탭이 지운 뒤 늦은 적기가 다시 적는다(검수 s3d GH2)",
    "      if (since !== stampOf(account)) return false;\\n",
    "      if (String(since).split('|')[0] !== String(generation)) return false;\\n",
  ],
  [
    "monthAnswer",
    "지우기 표지",
    "지우는 길이 지우기 표지를 지우지 않는다",
    "  for (const kind of [...KINDS, CLEAR_KIND]) {\\n",
    "  for (const kind of KINDS) {\\n",
  ],
  [
    "monthAnswer",
    "지우기 표지",
    "늦은 답을 들일 때 지우기 표지를 보지 않는다(세대 수만 본다)",
    "      if (!alive(owner) || since !== answers.stamp(owner)) return false;\\n",
    "      if (!alive(owner) || String(since).split('|')[0] !== String(answers.generation())) return false;\\n",
  ],
  [
    "monthAnswer",
    "지우기 표지",
    "물을 때 표지를 두지 않는다 — 열쇠가 없던 첫 물음을 다른 탭의 지우기가 막지 못한다",
    "    const since = answers.stamp(owner, { ensure: true });\\n",
    "    const since = answers.stamp(owner);\\n",
  ],
  [
    "monthAnswer",
    "지우기 표지",
    "이 문서가 만든 표지를 지우는 길로 읽는다 — 다음 그리기가 상자를 비워 같은 자리에서 다시 묻는다",
    "    if (state.owner === owner && state.generation === before) state.generation = since;\\n",
    "",
  ],
  [
    "monthAnswer",
    "근거 상자",
    "근거 답의 게임을 보지 않는다`);
v.save();
console.log('GH2 시험 · 변형 고침');
