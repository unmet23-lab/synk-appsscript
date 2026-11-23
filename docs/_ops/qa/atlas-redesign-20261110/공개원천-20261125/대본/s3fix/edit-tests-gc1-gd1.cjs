'use strict';
// ③ 섞임 고침(GC1 · GH1 · GD1)에 맞춘 시험 · 변형 목록 고침. master 원천 qa 폴더에 적용한다.
//   node edit-tests-gc1-gd1.cjs <experiences/synk-world-app/qa 폴더>
const fs = require('node:fs'), path = require('node:path');
const dir = process.argv[2];
if (!dir) throw Error('qa 폴더를 준다');

const edits = {
  'world-reminder-device.test.mjs': [
    [
      `test('시험 점검 시트의 주 단추는 그린 때의 판정에 묶인다 — 열 수 있으면 시험 형식(reminder-exam-mock), 아니면 짧은 진단(reminder-exam-start)이고, 누르면 그 대상을 연다(4-4d §21-23의 5)',()=>{
 const opened=[];
 const base={owner:'guest',storage:memory(),target:fakeWindow(),offset:SEOUL,open:kind=>opened.push(kind)};
 const withMock=createWorldReminders({...base,canMock:()=>true}),without=createWorldReminders({...base});
 try{
  const mock=withMock.examMarkup(),quick=without.examMarkup();
  assert.match(mock,/data-world="reminder-exam-mock">시험 형식 연습 시작하기/);assert.doesNotMatch(mock,/짧은 진단 시작하기|reminder-exam-start/);
  assert.match(quick,/data-world="reminder-exam-start">짧은 진단 시작하기/);assert.doesNotMatch(quick,/reminder-exam-mock/);
  for(const markup of [mock,quick])assert.equal((markup.match(/class="felt-button"/g)||[]).length,1,'흰 알약 하나');
  withMock.command('reminder-exam-mock');without.command('reminder-exam-start');
  assert.deepEqual(opened,['exam-mock','exam-start'],'누른 때 다시 고르지 않는다');
 }finally{withMock.dispose();without.dispose();}
});`,
      `test('시험 점검 시트의 주 단추는 그린 때의 판정(mockNow)에 묶인다 — 열 수 있으면 시험 형식(reminder-exam-mock), 아니면 짧은 진단(reminder-exam-check)이고, 누르면 그 대상을 연다(4-4d §21-23의 5 · ③ 섞임 표 27)',()=>{
 const opened=[];
 const base={owner:'guest',storage:memory(),target:fakeWindow(),offset:SEOUL,open:kind=>opened.push(kind)};
 // canMock(옛 뜻)은 거꾸로 두어, 새 셸의 카드가 mockNow만 보는지 함께 본다.
 const withMock=createWorldReminders({...base,mockNow:()=>true,canMock:()=>false}),without=createWorldReminders({...base,mockNow:()=>false,canMock:()=>true});
 try{
  const mock=withMock.examMarkup(),quick=without.examMarkup();
  assert.match(mock,/data-world="reminder-exam-mock">시험 형식 연습 시작하기/);assert.doesNotMatch(mock,/짧은 진단 시작하기|reminder-exam-start|reminder-exam-check/);
  assert.match(quick,/data-world="reminder-exam-check">짧은 진단 시작하기/);assert.doesNotMatch(quick,/reminder-exam-mock|reminder-exam-start/);
  for(const markup of [mock,quick])assert.equal((markup.match(/class="felt-button"/g)||[]).length,1,'흰 알약 하나');
  withMock.command('reminder-exam-mock');without.command('reminder-exam-check');
  assert.deepEqual(opened,['exam-mock','exam-check'],'누른 때 다시 고르지 않는다');
 }finally{withMock.dispose();without.dispose();}
});

// ③ 공개 직후 캐시 섞임(섞임 표 28): 새 알림 모듈 + 캐시에 남은 옛 app-shell. 옛 셸은 mockNow를 넘기지 않고, 클릭 목록이 reminder-exam-mock ·
// reminder-exam-check를 모른다 — 카드를 옛 꼴(주 단추 하나 reminder-exam-start, 글만 canMock으로)으로 그려야 단추가 죽지 않는다.
test('옛 셸(mockNow 없음)이면 시험 점검 카드를 옛 꼴로 그린다 — 주 단추 하나(reminder-exam-start)이고 글만 canMock으로 고르며, 판정이 바뀌어도 단추를 더하지 않는다(③ 섞임 표 28)',()=>{
 const opened=[];
 const base={owner:'guest',storage:memory(),target:fakeWindow(),offset:SEOUL,open:kind=>opened.push(kind),panel:()=>'world-reminder'};
 const withMock=createWorldReminders({...base,canMock:()=>true}),without=createWorldReminders({...base});
 try{
  const mock=withMock.examMarkup(),quick=without.examMarkup();
  assert.match(mock,/data-world="reminder-exam-start">시험 형식 연습 시작하기/,'시험 형식 입구가 있으면 그 글');
  assert.match(quick,/data-world="reminder-exam-start">짧은 진단 시작하기/);
  for(const markup of [mock,quick]){
   assert.doesNotMatch(markup,/reminder-exam-mock|reminder-exam-check/,'옛 셸이 모르는 이름을 쓰지 않는다');
   assert.equal((markup.match(/class="felt-button"/g)||[]).length,1,'흰 알약 하나');
   assert.match(markup,/class="plain-button" data-world="reminder-exam-plan"/);
  }
  assert.equal(without.examChanged(),false,'옛 꼴 카드에는 단추를 더하지 않는다');
  withMock.command('reminder-exam-start');without.command('reminder-exam-start');
  assert.deepEqual(opened,['exam-start','exam-start'],'누르면 셸의 옛 이름으로 간다(옛 셸이 누른 때 고른다)');
 }finally{withMock.dispose();without.dispose();}
});`,
    ],
    [
      `selector==='[data-world="reminder-exam-start"]'&&sheet.html.includes('data-world="reminder-exam-start"')?start:null`,
      `selector==='[data-world="reminder-exam-check"]'&&sheet.html.includes('data-world="reminder-exam-check"')?start:null`,
    ],
    [
      `offset:SEOUL,canMock:()=>ready,panel:()=>kind,`,
      `offset:SEOUL,mockNow:()=>ready,panel:()=>kind,`,
    ],
    [
      `assert.ok(added.indexOf('reminder-exam-start')<added.indexOf('reminder-exam-mock'),'다시 그린 꼴도 짧은 진단 단추가 앞이다');`,
      `assert.ok(added.indexOf('reminder-exam-check')<added.indexOf('reminder-exam-mock'),'다시 그린 꼴도 짧은 진단 단추가 앞이다');`,
    ],
  ],
  'atlas-next-mock-shell.test.mjs': [
    [
      `test('앱의 배선 — 시험 점검 카드의 판정은 셸의 mockReady이고, 두 단추는 그린 때 고른 대상을 그대로 열며, 홈을 다시 그리면 열린 카드를 맞춘다 · 입구 감싸기가 시험 형식 코치를 잇는다(§21-23의 1 · 5)', () => {
  const source = fs.readFileSync(process.env.SYNK_APP_SHELL_SOURCE ?? new URL('../app-shell.mjs', import.meta.url), 'utf8');
  assert.match(source, /canMock:\\(\\)=>typeof education\\?\\.mockReady==='function'\\?education\\.mockReady\\(\\)===true:typeof education\\?\\.mock==='function',panel:\\(\\)=>home\\.openPanel\\?\\.\\(\\)\\?\\?null,/);
  assert.match(source, /if\\(kind==='exam-mock'\\)return run\\(\\(\\)=>life\\.education\\?\\.mock\\?\\.\\(\\)\\);/);
  assert.match(source, /if\\(kind==='exam-start'\\)return run\\(\\(\\)=>life\\.education\\?\\.position\\?\\.\\(\\{start:true\\}\\)\\);/);
  assert.doesNotMatch(source, /kind==='exam-start'[^\\n]*education\\?\\.mock/, '누른 때 다시 고르지 않는다');
  assert.match(source, /'reminder-exam-start','reminder-exam-mock','reminder-exam-plan'/, '시험 형식 단추의 명령');`,
      `test('앱의 배선 — 시험 점검 카드의 판정은 셸의 mockReady(새 이름 mockNow)이고, 두 단추는 그린 때 고른 대상을 그대로 열며, 홈을 다시 그리면 열린 카드를 맞춘다 · 옛 이름(canMock · exam-start)은 옛 뜻 · 입구 감싸기가 시험 형식 코치를 잇는다(§21-23의 1 · 5 · ③ 섞임 표 27)', () => {
  const source = fs.readFileSync(process.env.SYNK_APP_SHELL_SOURCE ?? new URL('../app-shell.mjs', import.meta.url), 'utf8');
  assert.match(source, /\\n  canMock:\\(\\)=>typeof education\\?\\.mock==='function',\\r?\\n  mockNow:\\(\\)=>typeof education\\?\\.mockReady==='function'\\?education\\.mockReady\\(\\)===true:typeof education\\?\\.mock==='function',panel:\\(\\)=>home\\.openPanel\\?\\.\\(\\)\\?\\?null,/, '옛 이름 canMock은 옛 뜻(입구가 있는가), 새 뜻은 mockNow');
  assert.match(source, /if\\(kind==='exam-mock'\\)return run\\(\\(\\)=>life\\.education\\?\\.mock\\?\\.\\(\\)\\);/);
  assert.match(source, /if\\(kind==='exam-check'\\)return run\\(\\(\\)=>life\\.education\\?\\.position\\?\\.\\(\\{start:true\\}\\)\\);/);
  assert.doesNotMatch(source, /kind==='exam-check'[^\\n]*education\\?\\.mock/, '누른 때 다시 고르지 않는다');
  // 옛 이름은 옛 뜻(③ 섞임 표 27): ③ 공개 직후 캐시에 남은 옛 알림 모듈의 주 단추는 누른 때 고른다.
  assert.match(source, /if\\(kind==='exam-start'\\)return run\\(\\(\\)=>\\{const education=life\\.education;return typeof education\\?\\.mock==='function'\\?education\\.mock\\(\\):education\\?\\.position\\?\\.\\(\\{start:true\\}\\);\\}\\);/, '옛 이름 exam-start는 옛 뜻');
  assert.match(source, /'reminder-exam-start','reminder-exam-mock','reminder-exam-check','reminder-exam-plan'/, '시험 점검 단추의 명령(옛 이름과 새 이름)');`,
    ],
  ],
  'position-mutants.mjs': [
    [
      `    "  const lead=mock?examButton('reminder-exam-mock',",
    "  const lead=mock?examButton('reminder-exam-start',",`,
      `    "   lead=mock?examButton('reminder-exam-mock',",
    "   lead=mock?examButton('reminder-exam-check',",`,
    ],
    [
      `    "  if(name==='reminder-exam-mock')return open('exam-mock');\\n",
    "  if(name==='reminder-exam-mock')return open('exam-start');\\n",
  ],`,
      `    "  if(name==='reminder-exam-mock')return open('exam-mock');\\n",
    "  if(name==='reminder-exam-mock')return open('exam-check');\\n",
  ],
  // ── ③ 공개 직후 캐시 섞임(섞임 표 27 · 28): 옛 이름은 옛 뜻, 새 뜻은 새 이름, 새 알림 모듈은 옛 셸을 알아본다 ──
  [
    "reminder",
    "시험 점검 카드",
    "옛 셸을 알아보지 않는다 — mockNow가 없어도 두 단추 꼴로 그려 옛 셸에서 주 단추가 죽는다(③ 섞임 표 28)",
    "  if(typeof mockNow!=='function'){\\n",
    "  if(false){\\n",
  ],
  [
    "reminder",
    "시험 점검 카드",
    "새 셸의 짧은 진단 단추가 옛 이름을 쓴다 — 셸이 옛 뜻으로 누른 때 다시 고른다(③ 섞임 표 27)",
    "examButton('reminder-exam-check','reminder.exam.start',true)",
    "examButton('reminder-exam-start','reminder.exam.start',true)",
  ],
  [
    "reminder",
    "시험 점검 카드",
    "옛 꼴 카드의 주 단추 글이 판정(canMock)을 보지 않는다",
    "lead=examButton('reminder-exam-start',old?'reminder.exam.mock':'reminder.exam.start',true);",
    "lead=examButton('reminder-exam-start','reminder.exam.start',true);",
  ],
  [
    "reminder",
    "시험 점검 카드",
    "짧은 진단 새 이름의 명령이 없다",
    "  if(name==='reminder-exam-check')return open('exam-check');\\n",
    "",
  ],`,
    ],
    [
      `    " if(kind==='exam-start')return run(()=>life.education?.position?.({start:true}));\\n",
    " if(kind==='exam-start')return run(()=>{const education=life.education;return typeof education?.mock==='function'?education.mock():education?.position?.({start:true});});\\n",`,
      `    " if(kind==='exam-check')return run(()=>life.education?.position?.({start:true}));\\n",
    " if(kind==='exam-check')return run(()=>{const education=life.education;return typeof education?.mock==='function'?education.mock():education?.position?.({start:true});});\\n",
  ],
  [
    "mockAppShell",
    "시험 점검 앱 배선",
    "옛 이름 exam-start가 새 뜻(짧은 진단만)으로 바뀐다 — 옛 알림 모듈의 「시험 형식 연습」 단추가 짧은 진단을 연다(③ 섞임 표 27)",
    " if(kind==='exam-start')return run(()=>{const education=life.education;return typeof education?.mock==='function'?education.mock():education?.position?.({start:true});});\\n",
    " if(kind==='exam-start')return run(()=>life.education?.position?.({start:true}));\\n",
  ],
  [
    "mockAppShell",
    "시험 점검 앱 배선",
    "클릭 목록에 짧은 진단 새 이름이 없다",
    "'reminder-exam-mock','reminder-exam-check','reminder-exam-plan'",
    "'reminder-exam-mock','reminder-exam-plan'",
  ],
  [
    "mockAppShell",
    "시험 점검 앱 배선",
    "옛 이름 canMock에 새 뜻을 넘긴다 — 켜진 판에서 옛 알림 모듈의 짧은 진단 글 단추가 시험 형식을 연다(③ 섞임 표 「뜻이 바뀐 이름」 3)",
    "  canMock:()=>typeof education?.mock==='function',\\n",
    "  canMock:()=>typeof education?.mockReady==='function'?education.mockReady()===true:typeof education?.mock==='function',\\n",`,
    ],
    [
      `    "canMock:()=>typeof education?.mockReady==='function'?education.mockReady()===true:typeof education?.mock==='function',",
    "canMock:()=>typeof education?.mock==='function',",`,
      `    "mockNow:()=>typeof education?.mockReady==='function'?education.mockReady()===true:typeof education?.mock==='function',",
    "mockNow:()=>typeof education?.mock==='function',",`,
    ],
  ],
  'life-ui-off.test.mjs': [
    [
      `test('생활 단독 묶음 — setupLife 한 번:`,
      `// ③ 공개 직후 캐시 섞임(섞임 표 6 · 검수 s3d GD1): 새 생활 화면이 캐시에 남은 옛 진도 모듈을 받는다. 옛 API에는 reviewHelped · dropStaleHelp ·
// setDueSource가 없다. 그래도 복습 첫 문항이 열리고, 도움은 옛 뜻(미리 본 표시가 곧 도움)으로 읽는다.
test('옛 진도 모듈(reviewHelped · dropStaleHelp 없음)과 섞여도 복습 첫 문항이 열리고, 미리 본 표시가 곧 도움이다(③ 섞임 GD1 — 옛 뜻)', t0 => {
  t0.mock.timers.enable({ apis: ['Date'], now: START });
  const real = createLifeProgress({ owner: 'guest', mode: 'local', storage: memoryStorage(), now: () => Date.now() });
  const { reviewHelped, dropStaleHelp, setDueSource, ...old } = real;
  assert.equal(typeof reviewHelped, 'function', '새 진도에는 있다');
  const progress = Object.freeze(old);
  const w = lifeOn({ progress, entry: false });
  try {
    const lesson = lessonById('greetings-expressions');
    playLesson(w, lesson, { wrong: [0] });
    t0.mock.timers.tick(2 * DAY);
    const hardId = lesson.questions[0].review.id;
    assert.equal(w.practice()(lesson.questions[0].id), true, '미리 본 표현의 홈 연습');
    const run = progress.exportSnapshot().activeReview;
    assert.equal(run.ids[0], hardId);
    assert.equal(run.pendingHelp?.[hardId], true, '미리 본 표현은 도움 표시');
    const seenBefore = w.oldTrail.seen.length;
    w.ui.reviewStart();
    assert.equal(w.ui.metrics().phase, 'review', '첫 문항이 열린다');
    assert.ok(choices(w).length > 0, '보기가 선다');
    assert.equal(w.oldTrail.seen.length, seenBefore + 1, '복습 첫 문항이 옛 거울에 보임');
    playReview(w);
    const notes = Object.fromEntries(rows(last(w)).map(row => [row.korean, row.note]));
    assert.equal(notes[korean(lesson, lesson.questions[0])], t('life.reviewSoon'), '미리 본 표현은 도움 받은 답(조금 뒤 다시)');
    for (const [expression, note] of Object.entries(notes).filter(([k]) => k !== korean(lesson, lesson.questions[0])))
      assert.equal(note, t('life.reviewRemembered'), \`\${expression}: 혼자 맞히면 「잘 기억했어요」\`);
  } finally {
    w.ui.dispose();
  }
});
test('생활 단독 묶음 — setupLife 한 번:`,
    ],
  ],
};

const out = {};
for (const [name, list] of Object.entries(edits)) {
  const file = path.join(dir, name);
  let text = fs.readFileSync(file, 'utf8');
  const crlf = text.includes('\r\n');
  const eol = s => (crlf ? s.replace(/\r?\n/g, '\r\n') : s);
  for (const [find, repl] of list) {
    const f = eol(find), r = eol(repl);
    const n = text.split(f).length - 1;
    if (n !== 1) throw Error(`${name}: 찾는 글이 ${n}번 있다 — ${find.slice(0, 90)}`);
    text = text.replace(f, () => r);
  }
  out[file] = text;
}
for (const [file, text] of Object.entries(out)) fs.writeFileSync(file, text);
console.log('고침', Object.keys(out).map(f => path.basename(f)).join(' · '));
