'use strict';
// 변형 목록 맞춤(검수 s3e1 회차): 원문이 바뀐 자리의 바꿀 글을 지금 원문에 맞추고, 이번 고침의 변형을 더한다.
//   node edit-mutants-s3e1.cjs <qa 폴더>
const fs = require('node:fs'), path = require('node:path');
const dir = process.argv[2];
const io = name => {
  const file = path.join(dir, name);
  let s = fs.readFileSync(file, 'utf8');
  const crlf = s.includes('\r\n'), eol = x => (crlf ? x.replace(/\r?\n/g, '\r\n') : x);
  const rep = (find, repl, count = 1) => {
    const f = eol(find);
    const n = s.split(f).length - 1;
    if (n !== count) throw Error(`${name}: ${n}번(${count}이어야) — ${find.slice(0, 90)}`);
    s = s.split(f).join(eol(repl));
  };
  const lines = () => s.split(crlf ? '\r\n' : '\n');
  return {
    rep,
    // n번째 줄(1부터) 안에서만 바꾼다 — 같은 글이 다른 원문의 변형에도 있을 때.
    repLine(n, find, repl) {
      const all = lines();
      if (!all[n - 1]?.includes(find)) throw Error(`${name}:${n}에 없다 — ${find.slice(0, 80)}`);
      all[n - 1] = all[n - 1].replace(find, () => repl);
      s = all.join(crlf ? '\r\n' : '\n');
    },
    save: () => fs.writeFileSync(file, s),
  };
};
const lit = x => JSON.stringify(x);

const p = io('position-mutants.mjs');
// 셸 · 시험 형식 셸: 판 닫힘(gone — 검수 s3e1 GB1) · 접힌 뒤 다시 그리기(foldedRedraw — 검수 s3d G3) · 판 끝 수(planEnd — 검수 s3d G2).
p.rep('if(!finishing||!box.isConnected)', 'if(!finishing||gone||!box.isConnected)', 4);
p.rep('if(stopped)return;if(!box.isConnected){', 'if(stopped)return;if(gone||!box.isConnected){', 4);
p.rep('if(stopped||!box.isConnected)return;}', 'if(stopped||gone||!box.isConnected)return;}', 2);
p.rep('.then(()=>redrawNext(),()=>{})', '.then(foldedRedraw,()=>{})', 11);
p.rep('"stopTick();player.silence();let set=null;try{set=session.stop();}catch{set=null;}queueMicrotask(()=>refresh());",\n    "stopTick();player.silence();let set=null;queueMicrotask(()=>refresh());",',
  '"stopTick();player.silence();let set=null;try{set=session.stop();}catch{set=null;}planEnd();queueMicrotask(()=>refresh());",\n    "stopTick();player.silence();let set=null;planEnd();queueMicrotask(()=>refresh());",');
// 학습일 답 상자: 세대 수 → 물음의 표지(검수 s3d GH2), 지우는 길의 열쇠에 지우기 표지가 든다.
p.rep("    '      if (since !== generation) return false;\\n',\n    '',", "    '      if (since !== stampOf(account)) return false;\\n',\n    '',");
p.rep("    '      if (!alive(owner) || since !== answers.generation()) return false;\\n',\n    '      if (!alive(owner)) return false;\\n',",
  "    '      if (!alive(owner) || since !== answers.stamp(owner)) return false;\\n',\n    '      if (!alive(owner)) return false;\\n',");
p.rep("    '      if (!alive(owner) || since !== answers.generation()) return false;\\n',\n    '      if (since !== answers.generation()) return false;\\n',",
  "    '      if (!alive(owner) || since !== answers.stamp(owner)) return false;\\n',\n    '      if (since !== answers.stamp(owner)) return false;\\n',");
p.rep('    "        if (settle() && since === answers.generation()) {\\n",', '    "        if (settle() && since === answers.stamp(owner)) {\\n",');
p.rep('    "  for (const kind of KINDS) {\\n",\n    "  for (const kind of [MONTH_KIND]) {\\n",',
  '    "  for (const kind of [...KINDS, CLEAR_KIND]) {\\n",\n    "  for (const kind of [MONTH_KIND, CLEAR_KIND]) {\\n",');
p.rep('"  for (const kind of KINDS) {\\n    try {\\n      if (account) storage?.removeItem(keyOf(kind, account));\\n    } catch {\\n",\n    "  try {\\n    for (const kind of [...KINDS].reverse()) if (account) storage?.removeItem(keyOf(kind, account));\\n  } catch {\\n    {\\n",',
  '"  for (const kind of [...KINDS, CLEAR_KIND]) {\\n    try {\\n      if (account) storage?.removeItem(keyOf(kind, account));\\n    } catch {\\n",\n    "  try {\\n    for (const kind of [...KINDS, CLEAR_KIND].reverse()) if (account) storage?.removeItem(keyOf(kind, account));\\n  } catch {\\n    {\\n",');
// 다른 원문의 주석이 바뀐 자리(입구 world-atlas-next · 앱 셸).
const at302 = fs.readFileSync(path.join(dir, 'position-mutants.mjs'), 'utf8').split(/\r?\n/).findIndex(line => line.includes('["clear","비우기 입구","옛 대기열을 코치를 열기 전에 올린다'));
if (at302 < 0) throw Error('clear 옛 대기열 줄');
p.repLine(at302 + 1, '4-5 Opus 대체 설계 검토 F1', '4-5 대체 설계 검토 F1');
p.repLine(at302 + 1, '4-5 Opus 대체 설계 검토 F1', '4-5 대체 설계 검토 F1');
const at375 = fs.readFileSync(path.join(dir, 'position-mutants.mjs'), 'utf8').split(/\r?\n/).findIndex(line => line.includes('["clear","비우기 입구","따라 한 비우기가 앞 판 쓸기 뒤에'));
if (at375 < 0) throw Error('clear 따라 한 비우기 줄');
p.repLine(at375 + 1, '(-c GPT GA2).\\n    advanceMark', '(-c GA2).\\n    advanceMark');
p.rep('["meAppShell","나 칸","비우는 사이 단추를 막지 않는다(카본 B3 · 4-5 끝 판)","if(button)button.disabled=true;",""],',
  '["meAppShell","나 칸","비우는 사이 단추를 막지 않는다(카본 B3 · 4-5 끝 판)","if(button){button.disabled=true;","if(button){"],');
// 이번 고침의 변형(검수 s3e1).
const rows = [
  ['shell', '셸 진단 끝', '판 자원의 정리를 닫힘으로 보지 않는다 — 흐려지는 160ms 안에 저장이 끝나면 판 기록을 남기고 닫히는 판에 끝 화면을 그린다(검수 s3e1 GB1)',
    "  home.attachPanelResource?.({dispose(){gone=true;stop();}});\n  const box=panelNode('[data-position-stage]')", "  home.attachPanelResource?.({dispose:stop});\n  const box=panelNode('[data-position-stage]')"],
  ['shell', '셸 진단 시작', '확인 중에 남긴 진단 시작을 그 사이 다른 학습을 연 뒤에도 쓴다(검수 s3e1 GB2)',
    'const wanted=start||startWanted!==0&&startWanted===asked;', 'const wanted=start||startWanted!==0;'],
  ['shell', '셸 진단 시작', '확인 중에 받은 진단 시작을 남기지 않는다 — 엔진 판으로 다시 그려도 시작하지 않는다(검수 s3e1 GB2)',
    'const wanted=start||startWanted!==0&&startWanted===asked;', 'const wanted=start;'],
  ['shell', '셸 진단 시작', '내 위치 열기가 기다린 사이 다른 학습을 열어도 진단을 시작한다(검수 s3e1 GB2)',
    'showNext({start:start&&mine===asked});', 'showNext({start});'],
  ['shell', '셸 초점', '다시 그린 뒤 시험 형식 단추의 초점을 되돌리지 않는다(검수 s3e1 GB5)',
    ",'data-position-writing','data-position-mock'];", ",'data-position-writing'];"],
  ['mockShell', '시험 형식 셸', '판 자원의 정리를 닫힘으로 보지 않는다 — 흐려지는 160ms 안에 저장이 끝나면 판 기록을 남기고 끝 한 장을 그린다(검수 s3e1 GB1)',
    '  home.attachPanelResource?.({dispose(){gone=true;stop();}});\n  unwatch=atlasNext', '  home.attachPanelResource?.({dispose:stop});\n  unwatch=atlasNext'],
  ['monthAnswer', '지우기 표지', '표지가 없는 물음의 답을 적는다 — 다른 탭이 동의를 끄며 공간을 비운 뒤 그 앞에 물은 답이 다시 적힌다(검수 s3e1 GC1)',
    "      if (typeof since !== 'string' || since.endsWith('|')) return false;\n", ''],
  ['monthAnswer', '지우기 표지', '늦은 답을 들일 때 코치가 기기 기록이 되었는지 보지 않는다(검수 s3e1 GC1)',
    '      if (storage && storage.guest !== false) return;\n', ''],
  ['monthAnswer', '판 바닥', '연습 기록 비우기가 표지를 지운다 — 새 판에서 다른 탭이 물은 답까지 버린다(검수 s3e1 GC2)',
    '    raiseFloor(storage, account, before);\n', '    generation += 1;\n    try { storage?.removeItem(keyOf(CLEAR_KIND, account)); } catch {}\n'],
  ['monthAnswer', '판 바닥', '늦은 답을 들일 때 판 바닥을 보지 않는다 — 비운 앞 판의 늦은 답으로 다시 그린다(검수 s3e1 GC2)',
    '      if (!aboveFloor(answers.floor?.(owner) ?? null, revision)) return false; // 연습 기록 비우기가 앞 판을 지웠다(GC2)\n', ''],
  ['monthAnswer', '판 바닥', '적을 때 판 바닥을 보지 않는다 — 비운 앞 판의 답이 적힌다(검수 s3e1 GC2)',
    '      if (!aboveFloor(floorOf(storage, account), revision)) return false;\n', ''],
];
const tail = '\n];\n\n// 시험 묶음 안에서 이 실행기를 불러도';
p.rep(tail, `\n  // ── 검수 s3e1로 고친 것(GB1 · GB2 · GB5 · GC1 · GC2) ──\n${rows.map(row => `  [${row.map(lit).join(',')}],`).join('\n')}${tail}`);
p.save();

const q = io('plan-mutants.mjs');
q.rep(`const WAIT_OPEN = "if(homePhase()==='checking'&&examChosen()){const panel=home.openPanel?.()??'';await settledHome();check();if(!quiet&&(home.openPanel?.()??'')!==panel)return 'skipped';}}";`,
  `const WAIT_OPEN = "if(homePhase()==='checking'&&examChosen()){const panel=home.openPanel?.()??'';await settledHome();check();if(mine!==asked||!quiet&&(home.openPanel?.()??'')!==panel)return 'skipped';}}";`);
q.rep(`WAIT_OPEN, "if(homePhase()==='checking'&&examChosen()){await settledHome();check();}}"],`,
  `WAIT_OPEN, "if(homePhase()==='checking'&&examChosen()){await settledHome();check();if(mine!==asked)return 'skipped';}}"],`);
q.rep('\n];\n\n// 없는 갈래 이름이면', `\n  // ── 검수 s3e1로 고친 것(GB3 · GB4) ──
  ['shell', '확인 중에 기다린 계획 열기가 그 사이 학생이 누른 다른 학습(같은 카드의 짧은 진단 시작)을 덮는다(검수 s3e1 GB4)', WAIT_OPEN, "if(homePhase()==='checking'&&examChosen()){const panel=home.openPanel?.()??'';await settledHome();check();if(!quiet&&(home.openPanel?.()??'')!==panel)return 'skipped';}}"],
  ['shell', '새 길 연습 코치를 기다리는 사이 판을 닫아도 늦게 선 짧은 연습이 그 판을 덮는다(검수 s3e1 GB3 · 2a3a74e85a의 막이)', '  home.attachPanelResource?.({dispose(){if(launching&&ticket===practiceOpen)practiceOpen++;}});\\n', ''],
];\n\n// 없는 갈래 이름이면`);
q.save();
console.log('변형 목록 맞춤');
