'use strict';
// 조건 1 시험: (가) 셸 입구 겉 — 입구가 없을 때 계기에 한 번, F9 시험의 흘려보냄 기대값. (나) ③ (나)의 남는 파일이 뺀 열일곱을 정적으로 부르지 않는다.
//   node edit-tests-entry404.cjs <qa 폴더>
const fs = require('node:fs'), path = require('node:path');
const dir = process.argv[2];
const io = name => {
  const file = path.join(dir, name);
  let s = fs.readFileSync(file, 'utf8');
  const crlf = s.includes('\r\n'), eol = x => (crlf ? x.replace(/\r?\n/g, '\r\n') : x);
  const rep = (find, repl) => { const f = eol(find); const n = s.split(f).length - 1; if (n !== 1) throw Error(`${name}: ${n}번 — ${find.slice(0, 80)}`); s = s.replace(f, () => eol(repl)); };
  return { rep, save: () => fs.writeFileSync(file, s) };
};

// (가) 생활 셸 시험
const l = io('atlas-next-life-shell.test.mjs');
l.rep(` assert.deepEqual(seen.notes,[['save','LIFE_NO_COACH']],'받기 전의 계기를 흘려보낸다');`,
 ` assert.deepEqual(seen.notes,[['save','LIFE_NO_COACH'],['load','ENTRY_IMPORT']],'받기 전의 계기를 흘려보낸다 — 입구 받기 실패도 계기에 한 번(설계 주인 11-23 조건 1)');`);
l.rep(` lazy.note('load',{ok:true});
 assert.equal(seen.notes.length,2,'받은 뒤에는 바로 넘긴다');
 lazy.dispose();lazy.note('save',{ok:false,code:'AFTER'});
 assert.equal(seen.notes.length,2,'닫은 뒤의 계기는 버린다');`,
 ` lazy.note('load',{ok:true});
 assert.equal(seen.notes.length,3,'받은 뒤에는 바로 넘긴다');
 lazy.dispose();lazy.note('save',{ok:false,code:'AFTER'});
 assert.equal(seen.notes.length,3,'닫은 뒤의 계기는 버린다');`);
l.rep(`test('셸 입구 겉(원문) — 리허설 나르개의 401은`,
 `// 설계 주인 11-23 조건 1: 깃발이 잘못 켜져 새 길 입구(world-atlas-next.mjs)가 없을 때(404). 부르는 곳(짧은 연습 · 시험 형식 · 게임 문 · 생활 판정 ·
// 홈)은 이 실패를 받아 지금 판으로 간다(world-learning-ui · app-shell의 catch — 브라우저 측정은 ③ 사슬 배경). 셸은 첫 실패만 계기에 남긴다.
test('셸 입구 겉(원문) — 입구가 없을 때(404) 부르는 곳마다 실패를 받아 지금 판으로 가고, 계기에는 첫 실패 한 번만 남는다(설계 주인 11-23 조건 1)',async()=>{
 let tries=0;
 const missing=()=>{tries+=1;return Promise.reject(new TypeError('Failed to fetch dynamically imported module'));};
 for(const owner of ['guest','acct-1']){
  tries=0;
  const lazy=lazyShell({loadEntry:missing})(owner);
  lazy.note('save',{ok:false,code:'EARLY'});
  assert.deepEqual(lazy.health(),{early:[{kind:'save',ok:false,code:'EARLY'}]},\`\${owner}: 받기 전 계기는 셸이 입구와 같은 꼴로 준다\`);
  for(let round=0;round<3;round+=1){
   await assert.rejects(lazy.practiceCoach([]),/Failed to fetch/,\`\${owner}: 짧은 연습은 실패를 받는다(부르는 곳이 지금 판으로 간다)\`);
   await assert.rejects(lazy.mockCoach([]),/Failed to fetch/);
   await assert.rejects(lazy.gameDoor('hangul'),/Failed to fetch/);
   await assert.rejects(lazy.lifeCoach(),/Failed to fetch/);
   await assert.rejects(lazy.homeCoach([]),/Failed to fetch/);
  }
  assert.equal(tries,15,\`\${owner}: 부를 때마다 다시 받아 본다(브라우저는 실패한 모듈을 문서 안에서 다시 받지 않는다)\`);
  assert.deepEqual(lazy.health(),{early:[{kind:'save',ok:false,code:'EARLY'},{kind:'load',ok:false,code:'ENTRY_IMPORT'}]},\`\${owner}: 입구 실패는 계기에 한 번\`);
  // 입구가 없으면 받기를 기다리지 않는 겉은 비어 있다
  assert.equal(lazy.planLog({}),null);assert.equal(lazy.lookbackOf({}),null);assert.equal(lazy.firstAnswersOf({}),null);
  assert.equal(await lazy.readResponses({}),null);assert.equal(await lazy.noteLogout(),false);
  const quit=lazy.retired({},()=>{});assert.equal(typeof quit,'function');lazy.redecide('account');
  lazy.dispose();
  assert.equal(await lazy.practiceCoach([]),null,\`\${owner}: 닫은 뒤에는 받지 않는다\`);
  assert.equal(tries,15);
 }
 // 받는 사이에 닫혔으면 실패를 남기지 않는다(떠난 주인의 계기다)
 let fail;
 const closing=lazyShell({loadEntry:()=>new Promise((resolve,reject)=>{fail=reject;})})('acct-1');
 const pending=closing.lifeCoach();
 await Promise.resolve();
 closing.dispose();fail(new TypeError('Failed to fetch dynamically imported module'));
 await assert.rejects(pending,/Failed to fetch/);
 assert.deepEqual(closing.health(),{early:[]},'닫은 뒤의 받기 실패는 남기지 않는다');
});

test('셸 입구 겉(원문) — 리허설 나르개의 401은`);
l.save();

// (나) 꺼진 판 시험 — ③ (나)의 남는 파일
const o = io('atlas-next-off.test.mjs');
o.rep(`// 4-3 홈의 세 줄(world-today.mjs)은 입구(world-atlas-next.mjs)만 정적으로 받는다`,
 `// 선택 공개 ③ (나)(설계 주인 11-23 조건 1): ③은 첫 화면 모듈 열 하나 · 새 파일 하나(world-month-answer) · 셸 · 글꼴표 둘 · HTML 셋만 싣는다. 엔진 다섯
// (/atlas/0.1.0/ · /atlas/loader.*)과 새 길 모듈 열둘은 켜는 공개(5-3)에 싣는다. 남는 파일이 뺀 파일을 정적으로 부르면 ③ 뒤 첫 화면이 404로 서지
// 못한다. 뺀 파일을 동적으로 부르는 곳은 셸의 입구 하나(lazyAtlasNext)다 — 꺼진 판은 부르지 않고, 깃발이 잘못 켜져 404면 부르는 곳이 지금 판으로 간다.
const STEP3_KEPT=['app-shell.mjs','world-learning-ui.mjs','life-ui.mjs','life-progress.mjs','world-client.mjs','world-session.mjs','world-reminder-device.mjs','world-month-answer.mjs',
 '../brand-opening/home.mjs','../brand-opening/home-tutor.mjs','../brand-opening/home-tutor-lines.mjs'];
const STEP3_LEFT_OUT=['world-atlas-next','world-practice-next','world-today','world-position-next','world-diagnostic-next','world-mock-next','world-position-next-view',
 'world-plan-next','world-lookback-next','world-me-next','world-old-engine-doors','world-atlas-game'];
test('선택 공개 ③ (나) — 남는 파일은 뺀 열일곱(엔진 다섯 · 새 길 모듈 열둘)을 정적으로 부르지 않고, 뺀 파일을 동적으로 부르는 곳은 셸의 입구 하나다(설계 주인 11-23 조건 1)',()=>{
 const leftOut=specifier=>{
  const bare=specifier.split(/[?#]/)[0];
  if(/(^|\\/)atlas\\/(0\\.1\\.0\\/|loader\\.)/.test(bare)||bare.startsWith('/atlas/'))return true;
  return STEP3_LEFT_OUT.some(name=>bare.split('/').pop()===\`\${name}.mjs\`);
 };
 assert.equal(STEP3_LEFT_OUT.length,12);
 const dynamic=[];
 for(const file of STEP3_KEPT){
  const source=read(file),stack=[parse(source)],found=[];
  while(stack.length){
   const node=stack.pop();
   if(!node||typeof node.type!=='string')continue;
   if(['ImportDeclaration','ExportAllDeclaration','ExportNamedDeclaration'].includes(node.type)&&node.source)found.push({kind:'static',specifier:String(node.source.value)});
   if(node.type==='ImportExpression')found.push({kind:'dynamic',specifier:node.source.type==='Literal'?String(node.source.value):source.slice(node.source.start,node.source.end)});
   for(const value of Object.values(node))if(value&&typeof value==='object')stack.push(...(Array.isArray(value)?value:[value]));
  }
  assert.deepEqual(found.filter(row=>row.kind==='static'&&leftOut(row.specifier)).map(row=>row.specifier),[],\`\${file}이 뺀 파일을 정적으로 부르지 않는다\`);
  // 정적으로 부르는 파일은 이 저장소에 있다(지금 라이브에 있는지 · 이름이 맞는지는 공개 도구의 가져오는 이름 검사가 후보마다 본다)
  for(const row of found.filter(row=>row.kind==='static'))
   assert.ok(fs.existsSync(new URL(row.specifier,new URL(\`../\${file}\`,import.meta.url))),\`\${file}이 부르는 \${row.specifier}가 있다\`);
  for(const row of found.filter(row=>row.kind==='dynamic'))dynamic.push(\`\${file} \${row.specifier}\`);
 }
 const toLeftOut=dynamic.filter(row=>leftOut(row.split(' ').slice(1).join(' ')));
 assert.deepEqual(toLeftOut,['app-shell.mjs ./world-atlas-next.mjs'],'뺀 파일을 동적으로 부르는 곳은 셸의 입구 하나');
 // 식으로 부르는 곳은 셸의 세 곳(홈 · 오프닝 · 게임 튜터 도움)뿐이다 — 뺀 파일 이름을 짓지 않는다
 assert.deepEqual(dynamic.filter(row=>!/ \\.{1,2}\\//.test(row)).sort(),[
  "app-shell.mjs worldUrl('brand-opening/game-tutor-support.mjs')",
  "app-shell.mjs worldUrl('brand-opening/home.mjs')",
  "app-shell.mjs worldUrl('brand-opening/opening.mjs')",
 ]);
 for(const css of ['life-ui.css','../brand-opening/home.css'])assert.doesNotMatch(read(css),/@import|world-atlas|\\/atlas\\//,\`\${css}은 다른 글꼴표 · 새 길을 부르지 않는다\`);
});

// 4-3 홈의 세 줄(world-today.mjs)은 입구(world-atlas-next.mjs)만 정적으로 받는다`);
o.save();
console.log('조건 1 시험 더함');
