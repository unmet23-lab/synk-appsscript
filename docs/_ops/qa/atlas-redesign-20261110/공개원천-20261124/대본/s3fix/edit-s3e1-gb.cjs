'use strict';
// 검수 s3e1 GPT 묶음 B의 world-learning-ui 지적 고침(GB1 · GB2 · GB3 · GB4 · GB5).
//   node edit-s3e1-gb.cjs <world-learning-ui.mjs가 있는 폴더>
// master와 후보는 이 함수들이 같다. 다만 짧은 연습 열기(startPractice)는 master에 2a3a74e85a의 판 자원 막이가 이미 있어(두 길 모두), 후보에는
// 그 막이를 새 길에만 옮긴다(꺼진 판 동작은 지금 라이브와 같게).
const fs = require('node:fs'), path = require('node:path');
const file = path.join(process.argv[2], 'world-learning-ui.mjs');
let s = fs.readFileSync(file, 'utf8');
const crlf = s.includes('\r\n'), eol = x => (crlf ? x.replace(/\r?\n/g, '\r\n') : x);
const rep = (find, repl, count = 1) => {
  const f = eol(find);
  const n = s.split(f).length - 1;
  if (n !== count) throw Error(`${n}번(${count}이어야): ${find.slice(0, 90)}`);
  s = s.split(f).join(eol(repl));
};
const has = find => s.includes(eol(find));

// 학생이 누른 학습 열기의 차례(GB2 · GB4).
rep(`let diagnosed=false,positionOpen=0;`,
 `let diagnosed=false,positionOpen=0;
 // 학생이 연 학습의 차례(검수 s3e1 GB2 · GB4): 내 위치 · 짧은 진단 · 시험 형식 · 짧은 연습 · 이번 주 계획을 열 때마다 오른다(다시 그리기와 학생이
 // 누르지 않은 열기는 올리지 않는다). 기다리던 열기는 그 사이 다른 학습을 열었으면 덮지 않는다 — 판이 아직 서지 않은 열기는 판 종류로 가릴 수
 // 없다. startWanted는 확인 중에 받은 「짧은 진단 시작」의 차례다(없으면 0).
 let asked=0,startWanted=0;`);

// GB5: 시험 형식 단추도 초점을 되돌린다.
rep(`const NEXT_FOCUS=['data-position-diagnostic','data-position-exam','data-position-practice','data-position-recheck','data-position-writing'];`,
 `// 시험 형식 단추(4-4d)도 든다 — 빠지면 다시 그린 뒤 초점이 판 머리로 갔다(검수 s3e1 GB5).
 const NEXT_FOCUS=['data-position-diagnostic','data-position-exam','data-position-practice','data-position-recheck','data-position-writing','data-position-mock'];`);

// GB2: 확인 중에 받은 진단 시작을 남겨 두었다가 엔진 판으로 다시 그릴 때 한 번 시작한다.
rep(`  if(!data){home.showPanel(t('position.title'),nextChecking(),PANEL);panelNode('[data-position-next]')?.focus?.({preventScroll:true});return;}`,
 `  // 확인 중에 받은 「짧은 진단 시작」은 남겨 두고, 판 감시가 엔진 판으로 다시 그릴 때(redrawNext) 그 사이 다른 학습을 열지 않았으면 한 번 시작한다
  // (검수 s3e1 GB2 — 확인 중이면 내 위치만 열리고 시작이 사라졌다). 판을 그리면 남긴 시작을 지운다(쓰거나 버린다).
  if(!data){if(start)startWanted=asked;home.showPanel(t('position.title'),nextChecking(),PANEL);panelNode('[data-position-next]')?.focus?.({preventScroll:true});return;}
  const wanted=start||startWanted!==0&&startWanted===asked;startWanted=0;`);
rep(`  if(start&&data.plan.status==='ready'&&data.plan.items.length)startDiagnosticNext(coachNow,data);`,
 `  if(wanted&&data.plan.status==='ready'&&data.plan.items.length)startDiagnosticNext(coachNow,data);`);

// GB1(진단): 판을 닫으면 정리가 바로 돌지만 판 모습은 160ms 동안 남는다 — 닫힘은 gone으로 본다.
rep(`  if(!P||data?.plan?.status!=='ready'||!data.plan.items.length)return;
  const session=P.createDiagnosticNextSession(`,
 `  if(!P||data?.plan?.status!=='ready'||!data.plan.items.length)return;
  asked+=1; // 진단을 열면 기다리던 다른 열기(이번 주 계획)는 덮지 않는다(GB4)
  const session=P.createDiagnosticNextSession(`);
rep(`  let clip=null,playing=false,notice='',ended=false,finishing=false,unwatch=()=>{};`,
 `  let clip=null,playing=false,notice='',ended=false,finishing=false,gone=false,unwatch=()=>{};`);
rep(`  home.attachPanelResource?.({dispose:stop});
  const box=panelNode('[data-position-stage]');if(!box){stop();return;}
  unwatch=homeNext?.retired?.(coachNow,closed)??(()=>{});`,
 `  // 판을 닫으면 정리가 바로 돌지만 판 모습은 160ms 동안 흐려지며 남는다(home.mjs closePanel) — 닫힘은 gone으로 본다. box.isConnected만 보면 그
  // 사이 끝난 저장이 판 기록을 남기고 닫히는 판에 끝 화면을 그렸다(검수 s3e1 GB1).
  home.attachPanelResource?.({dispose(){gone=true;stop();}});
  const box=panelNode('[data-position-stage]');if(!box){stop();return;}
  unwatch=homeNext?.retired?.(coachNow,closed)??(()=>{});`);
rep(`   if(!finishing||!box.isConnected){const left=finishing;finishing=false;unwatch();let set=null;try{set=session.finish({record:false});}catch{set=null;}if(left){if(session.results().length)diagnosed=true;`,
 `   if(!finishing||gone||!box.isConnected){const left=finishing;finishing=false;unwatch();let set=null;try{set=session.finish({record:false});}catch{set=null;}if(left){if(session.results().length)diagnosed=true;`);

// GB1(시험 형식): 같은 막이.
rep(`  let ended=false,finishing=false,drawn=false,notice='',ticker=null,confirm=false,unwatch=()=>{};`,
 `  let ended=false,finishing=false,drawn=false,gone=false,notice='',ticker=null,confirm=false,unwatch=()=>{};`);
rep(`  home.attachPanelResource?.({dispose:stop});
  unwatch=atlasNext?.retired?.(next,closed)??(()=>{});`,
 `  // 판을 닫으면 판 모습이 160ms 동안 남는다 — 닫힘은 gone으로 본다(짧은 진단과 같은 막이 — 검수 s3e1 GB1).
  home.attachPanelResource?.({dispose(){gone=true;stop();}});
  unwatch=atlasNext?.retired?.(next,closed)??(()=>{});`);
rep(`   if(!finishing||!box.isConnected){const left=finishing;finishing=false;unwatch();let set=null;try{set=session.finish({record:false});}catch{set=null;}if(left){queueMicrotask(()=>refresh());`,
 `   if(!finishing||gone||!box.isConnected){const left=finishing;finishing=false;unwatch();let set=null;try{set=session.finish({record:false});}catch{set=null;}if(left){queueMicrotask(()=>refresh());`);
// 두 끝내기(진단 · 시험 형식)의 접기 기다림 뒤도 gone을 본다.
rep(`if(stopped)return;if(!box.isConnected){refresh();evidenced();Promise.resolve(set.folded).then(foldedRedraw,()=>{});return;}}`,
 `if(stopped)return;if(gone||!box.isConnected){refresh();evidenced();Promise.resolve(set.folded).then(foldedRedraw,()=>{});return;}}`, 2);

// GB2 · GB4: 내 위치 열기는 차례를 올리고, 기다린 사이 다른 학습을 열었으면 시작은 버린다(판은 그린다).
rep(`  check();const ticket=++positionOpen;
  openPosition.pending=ticket;
  try{
  let settled=false;
  home.attachPanelResource?.({dispose(){if(!settled&&ticket===positionOpen){positionOpen++;if(openPosition.pending===ticket)openPosition.pending=0;}}});
  try{await prepare();}catch{/* the board shows the records as incomplete */}
  check();if(ticket!==positionOpen)return;
  try{await target.SYNKLearningHost?.ready?.();}catch{/* device-local evidence still shows */}
  check();if(ticket!==positionOpen)return;
  try{await bankReady();}catch{/* the board opens with the reviewed game items */}
  check();if(ticket!==positionOpen)return;
  if(homePhase()==='engine'){`,
 `  check();const ticket=++positionOpen,mine=++asked;
  openPosition.pending=ticket;
  try{
  let settled=false;
  home.attachPanelResource?.({dispose(){if(!settled&&ticket===positionOpen){positionOpen++;if(openPosition.pending===ticket)openPosition.pending=0;}}});
  try{await prepare();}catch{/* the board shows the records as incomplete */}
  check();if(ticket!==positionOpen)return;
  try{await target.SYNKLearningHost?.ready?.();}catch{/* device-local evidence still shows */}
  check();if(ticket!==positionOpen)return;
  try{await bankReady();}catch{/* the board opens with the reviewed game items */}
  check();if(ticket!==positionOpen)return;
  if(homePhase()==='engine'){`);
rep(`  showNext({start});
  }finally{if(openPosition.pending===ticket)openPosition.pending=0;}`,
 `  // 기다린 사이 다른 학습을 열었으면 「짧은 진단 시작」은 버린다 — 판은 그린다(GB2).
  showNext({start:start&&mine===asked});
  }finally{if(openPosition.pending===ticket)openPosition.pending=0;}`);

// GB4: 시험 형식 열기 · 짧은 연습 열기도 차례를 올린다.
rep(`  check();const ticket=++mockOpen,panel=home.openPanel?.()??'';`,
 `  check();const ticket=++mockOpen,panel=home.openPanel?.()??'';asked+=1;`);
if (has(`  check();const ticket=++practiceOpen;
  let launching=true;`)) {
  // master — 2a3a74e85a의 판 자원 막이(두 길 모두)가 이미 GB3을 막는다. 차례만 올린다.
  rep(`  check();const ticket=++practiceOpen;
  let launching=true;`,
   `  check();const ticket=++practiceOpen;asked+=1;
  let launching=true;`);
} else {
  // 후보 — 2a3a74e85a의 막이를 새 길(연습 코치를 기다리는 열기)에만 옮긴다(GB3).
  rep(`  check();const ticket=++practiceOpen;
  try{await prepare();}catch{/* device-local practice still runs */}`,
   `  check();const ticket=++practiceOpen;asked+=1;
  // 새 길(atlasNext)의 열기는 연습 코치를 기다리는 동안 판을 닫거나 다른 판을 열면 이 열기만 무효로 한다 — 다시 확인을 누른 뒤 판을 닫고 복습을
  // 열면 늦게 선 짧은 연습이 복습을 덮었다(검수 s3e1 GB3). master 2a3a74e85a와 같은 판 자원 막이이고, 꺼진 판 동작이 지금 라이브와 같게 새 길에만 둔다.
  let launching=Boolean(atlasNext&&!followupId);
  if(launching)home.attachPanelResource?.({dispose(){if(launching&&ticket===practiceOpen)practiceOpen++;}});
  try{await prepare();}catch{/* device-local practice still runs */}`);
  rep(`  if(atlasNext&&!followupId){let next=null;try{next=await atlasNext.practiceCoach(position.practice.pool);}catch{next=null;}check();if(ticket!==practiceOpen)return;if(next)return runPracticeNext({next,skillId,more,only});}`,
   `  if(atlasNext&&!followupId){let next=null;try{next=await atlasNext.practiceCoach(position.practice.pool);}catch{next=null;}check();if(ticket!==practiceOpen)return;launching=false;if(next)return runPracticeNext({next,skillId,more,only});}`);
}

// GB4: 확인 중에 기다린 계획 열기는 그 사이 학생이 다른 학습을 열었으면 덮지 않는다.
rep(`  check();const ticket=++planOpen;`,
 `  check();const ticket=++planOpen,mine=keepScroll||quiet?asked:++asked;`);
rep(`   // 기다린 사이 학생이 다른 판을 열었으면 덮지 않는다 — 기다림이 8초까지 길어서 학생이 누른 열기도 본다(4-4b 다시 검수 FA2).
   if(homePhase()==='checking'&&examChosen()){const panel=home.openPanel?.()??'';await settledHome();check();if(!quiet&&(home.openPanel?.()??'')!==panel)return 'skipped';}}`,
 `   // 기다린 사이 학생이 다른 판을 열었으면 덮지 않는다 — 기다림이 8초까지 길어서 학생이 누른 열기도 본다(4-4b 다시 검수 FA2). 그 사이 다른 학습을
   // 열었어도 덮지 않는다 — 판이 아직 서지 않은 열기(같은 카드의 「짧은 진단 시작하기」)는 판 종류로 가릴 수 없어, 늦게 선 계획이 진단 요청을
   // 지웠다(검수 s3e1 GB4).
   if(homePhase()==='checking'&&examChosen()){const panel=home.openPanel?.()??'';await settledHome();check();if(mine!==asked||!quiet&&(home.openPanel?.()??'')!==panel)return 'skipped';}}`);

fs.writeFileSync(file, s);
console.log('GB 고침:', file);
