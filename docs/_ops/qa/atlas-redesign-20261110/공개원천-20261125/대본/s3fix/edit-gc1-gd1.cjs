'use strict';
// ③ 섞임 고침(GC1 · GH1 · GD1, 섞임 표 6 · 27 · 28과 「뜻이 바뀐 이름」 1 · 2 · 3)을 한 폴더의 세 파일에 그대로 적용한다.
//   node edit-gc1-gd1.cjs <폴더>   폴더: master 원천 experiences/synk-world-app 또는 ③ 후보의 world/
// 찾는 글은 파일마다 꼭 한 번 있어야 한다(아니면 아무것도 쓰지 않고 멈춤). 줄끝은 파일의 것(CRLF)을 따른다.
const fs = require('node:fs'), path = require('node:path');
const dir = process.argv[2];
if (!dir) throw Error('폴더를 준다');

const edits = {
  'app-shell.mjs': [
    [
      `  // 시험 점검 카드의 판정(4-4d §21-23의 5): 셸이 낸 판정(새 길이면 홈 코치로 — 지금 판이면 입구가 있는가). 판정이 바뀌면 열린 카드에 단추를 더한다(panel).
  canMock:()=>typeof education?.mockReady==='function'?education.mockReady()===true:typeof education?.mock==='function',panel:()=>home.openPanel?.()??null,`,
      `  // 시험 점검 카드: 이름은 옛 뜻을 지키고 새 뜻에는 새 이름을 붙인다(③ 공개 직후 캐시에 남은 옛 알림 모듈과 섞일 때를 막는다).
  // canMock은 옛 뜻(시험 형식 입구가 있는 화면인가 — 옛 알림 모듈이 주 단추 글을 이것으로 고른다), mockNow는 새 뜻(4-4d §21-23의 5 — 셸이 낸 판정,
  // 새 길이면 홈 코치로 지금 열 수 있는가). mockNow를 넘기는 셸만 두 단추(exam-mock · exam-check)를 안다. 판정이 바뀌면 열린 카드에 단추를 더한다(panel).
  canMock:()=>typeof education?.mock==='function',
  mockNow:()=>typeof education?.mockReady==='function'?education.mockReady()===true:typeof education?.mock==='function',panel:()=>home.openPanel?.()??null,`,
    ],
    [
      `// 시험 형식 연습(미니 모의, ④ education.mock — 열 수 없으면 그쪽이 알리고 내 위치로 간다), 짧은 진단 단추는 짧은 진단. 두 단추는 그린 때 고른 대상을
// 그대로 연다 — 누른 때 「education.mock이 있는가」로 다시 고르지 않는다(4-4d §21-23의 5 · 설계 다시 검수 A1 · A2).`,
      `// 시험 형식 연습(미니 모의, ④ education.mock — 열 수 없으면 그쪽이 알리고 내 위치로 간다), 짧은 진단 단추(exam-check)는 짧은 진단. 두 단추는 그린 때 고른
// 대상을 그대로 연다 — 누른 때 「education.mock이 있는가」로 다시 고르지 않는다(4-4d §21-23의 5 · 설계 다시 검수 A1 · A2). 옛 이름 exam-start는 옛 뜻
// 그대로 남긴다 — ③ 공개 직후 캐시에 남은 옛 알림 모듈이 그린 주 단추이고, 누른 때 고른다.`,
    ],
    [
      ` if(kind==='exam-start')return run(()=>life.education?.position?.({start:true}));`,
      ` if(kind==='exam-check')return run(()=>life.education?.position?.({start:true}));
 if(kind==='exam-start')return run(()=>{const education=life.education;return typeof education?.mock==='function'?education.mock():education?.position?.({start:true});});`,
    ],
    [
      `'reminder-exam-start','reminder-exam-mock','reminder-exam-plan'`,
      `'reminder-exam-start','reminder-exam-mock','reminder-exam-check','reminder-exam-plan'`,
    ],
  ],
  'world-reminder-device.mjs': [
    [
      `// canMock(): 시험 형식 연습(미니 모의, education.mock)을 지금 열 수 있는지 — 시험 점검 카드의 주 단추가 그린 때의 이 판정에 묶인다(4-4d §21-23의 5).`,
      `// mockNow(): 시험 형식 연습(미니 모의, education.mock)을 지금 열 수 있는지 — 시험 점검 카드의 주 단추가 그린 때의 이 판정에 묶인다(4-4d §21-23의 5).
//   새 셸만 넘긴다. 없으면 옛 셸(③ 공개 직후 캐시에 남은 옛 app-shell — 클릭 목록이 reminder-exam-mock · reminder-exam-check를 모른다)로 보고 카드를
//   옛 꼴(주 단추 하나 reminder-exam-start — 셸의 open('exam-start')가 누른 때 고른다)로 그린다.
// canMock(): 옛 뜻 — 시험 형식 입구가 있는 화면인지. 옛 꼴 카드의 주 단추 글만 이것으로 고른다.`,
    ],
    [
      ` canMock=()=>false,panel=()=>null,`,
      ` canMock=()=>false,mockNow=null,panel=()=>null,`,
    ],
    [
      `  if(name==='reminder-exam-start')return open('exam-start');`,
      `  if(name==='reminder-exam-check')return open('exam-check');
  if(name==='reminder-exam-start')return open('exam-start');`,
    ],
    [
      ` // 주 단추는 그린 때의 판정(canMock)에 묶는다(4-4d §21-23의 5 · 설계 다시 검수 A1 · A2): 열 수 있으면 시험 형식 연습(reminder-exam-mock),
 // 아니면 짧은 진단(reminder-exam-start)이고, 누른 때 다시 고르지 않는다.`,
      ` // 주 단추는 그린 때의 판정(mockNow)에 묶는다(4-4d §21-23의 5 · 설계 다시 검수 A1 · A2): 열 수 있으면 시험 형식 연습(reminder-exam-mock),
 // 아니면 짧은 진단(reminder-exam-check)이고, 누른 때 다시 고르지 않는다.`,
    ],
    [
      `  let mock=false;try{mock=!added&&canMock()===true;}catch{mock=false;}
  examDrawn=added?'added':mock?'mock':'check';
  const lead=mock?examButton('reminder-exam-mock','reminder.exam.mock',true):examButton('reminder-exam-start','reminder.exam.start',true)+(added?examButton('reminder-exam-mock','reminder.exam.mock',false):'');`,
      `  let lead;
  if(typeof mockNow!=='function'){
   // 옛 셸(mockNow를 넘기지 않는다): 옛 꼴 그대로 — 주 단추 하나(reminder-exam-start)이고 글만 canMock으로 고른다. 누른 때 셸이 고른다.
   // examChanged는 이 카드에 단추를 더하지 않는다(옛 셸의 클릭 목록이 reminder-exam-mock을 모른다).
   let old=false;try{old=canMock()===true;}catch{old=false;}
   examDrawn='old';lead=examButton('reminder-exam-start',old?'reminder.exam.mock':'reminder.exam.start',true);
  }else{
   let mock=false;try{mock=!added&&mockNow()===true;}catch{mock=false;}
   examDrawn=added?'added':mock?'mock':'check';
   lead=mock?examButton('reminder-exam-mock','reminder.exam.mock',true):examButton('reminder-exam-check','reminder.exam.start',true)+(added?examButton('reminder-exam-mock','reminder.exam.mock',false):'');
  }`,
    ],
    [
      `start=card?.querySelector?.('[data-world="reminder-exam-start"]');`,
      `start=card?.querySelector?.('[data-world="reminder-exam-check"]');`,
    ],
    [
      `  let mock=false;try{mock=canMock()===true;}catch{mock=false;}
  if(!mock)return false;`,
      `  let mock=false;try{mock=mockNow()===true;}catch{mock=false;}
  if(!mock)return false;`,
    ],
  ],
  'life-ui.mjs': [
    [
      `   helped=getProgress().reviewHelped(id);helpBy=helped?'user':null;`,
      `   // ③ 공개 직후 캐시에 남은 옛 진도 모듈에는 reviewHelped가 없다 — 그때는 옛 뜻(표시가 곧 도움)으로 읽는다.
   const prog=getProgress();helped=typeof prog.reviewHelped==='function'?prog.reviewHelped(id):marked;helpBy=helped?'user':null;`,
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
    if (n !== 1) throw Error(`${name}: 찾는 글이 ${n}번 있다 — ${find.slice(0, 80)}`);
    text = text.replace(f, () => r);
  }
  out[file] = text;
}
for (const [file, text] of Object.entries(out)) fs.writeFileSync(file, text);
console.log('고침', Object.keys(out).map(f => path.basename(f)).join(' · '));
