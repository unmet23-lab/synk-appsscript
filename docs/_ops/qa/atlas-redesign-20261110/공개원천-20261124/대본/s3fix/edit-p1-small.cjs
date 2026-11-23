'use strict';
// ③ 남는 P1 가운데 작은 셋(GD4 · GG2 · G2)을 한 폴더에 적용한다(master 원천 experiences/synk-world-app 또는 ③ 후보 원본 world/).
//   node edit-p1-small.cjs <폴더>
const fs = require('node:fs'), path = require('node:path');
const dir = process.argv[2];
if (!dir) throw Error('폴더를 준다');
const edits = {
  'life-ui.mjs': [
    // GD4: 쓰기 · 말하기 추천의 허브 꼬리표(허브 꼬리표는 모든 언어에서 영어 대문자 — UP NEXT · PACK과 같은 관례)
    [
      "const open=row.open,hangul=open.route==='game'&&open.gameId==='hangul',listening=open.modality==='listening';",
      "const open=row.open,hangul=open.route==='game'&&open.gameId==='hangul';\n  // 꼬리표는 그 줄의 일(모든 언어에서 영어 대문자 — UP NEXT · PACK과 같은 관례). 쓰기 · 말하기 줄을 READING으로 쓰지 않는다(검수 s3d GD4).\n  const mode=hangul?'HANGUL':({listening:'LISTENING',writing:'WRITING',speaking:'SPEAKING'})[open.modality]||'READING';",
    ],
    [
      "UP NEXT · ${hangul?'HANGUL':listening?'LISTENING':'READING'}",
      "UP NEXT · ${mode}",
    ],
  ],
  'world-learning-ui.mjs': [
    // GG2: 「다시 확인」 카드로 연 판(only)의 「더 하기」 · 「새 말 더 배우기」도 그 단위 문항만
    [
      "    else if(button.hasAttribute('data-practice-again'))void Promise.resolve(startPractice(skillId,{more})).catch(failed);\n    else if(button.hasAttribute('data-practice-more'))void Promise.resolve(startPractice(skillId,{more:true})).catch(failed);",
      "    // 「다시 확인」 카드로 연 판(only)은 다음 판도 그 단위 문항만이다 — 같은 능력의 다른 단위를 내지 않는다(검수 s3d GG2).\n    else if(button.hasAttribute('data-practice-again'))void Promise.resolve(startPractice(skillId,{more,only})).catch(failed);\n    else if(button.hasAttribute('data-practice-more'))void Promise.resolve(startPractice(skillId,{more:true,only})).catch(failed);",
    ],
    // G2: 새 길 시험 형식 판이 끝나면(그만둠 · 판 닫힘 포함) 이번 주 계획의 묶음 만남을 다시 묻게 판 끝 수를 한 번 올린다(planOnce와 같은 꼴)
    [
      "  let logged=false;\n  const markPlan=()=>{if(logged||!session.presented)return;",
      "  let logged=false,planEnded=false;\n  // 판 끝(검수 s3d G2): 문항을 낸 판이 멈추거나 끝나면 판 끝 수를 한 번 올린다 — 이번 주 계획이 묶음 만남을 다시 물어, 다 쓴 시험 형식 칸이 서지 않는다.\n  const planEnd=()=>{if(planEnded||!session.presented)return;planEnded=true;planEnds+=1;};\n  const markPlan=()=>{if(logged||!session.presented)return;",
    ],
    [
      "  const stop=()=>{unwatch();if(ended)return;ended=true;stopTick();player.silence();let set=null;try{set=session.stop();}catch{set=null;}queueMicrotask(()=>refresh());",
      "  const stop=()=>{unwatch();if(ended)return;ended=true;stopTick();player.silence();let set=null;try{set=session.stop();}catch{set=null;}planEnd();queueMicrotask(()=>refresh());",
    ],
    [
      "   finishing=true;ended=true;stopTick();player.silence();\n   try{await session.settled();}catch{/* 저장에 실패한 답은 혼자 맞힘이 아니다 */}\n   // 저장을 기다리는 사이 판이 닫혔거나(패널을 닫음) 코치가 닫혔다",
      "   finishing=true;ended=true;stopTick();player.silence();\n   try{await session.settled();}catch{/* 저장에 실패한 답은 혼자 맞힘이 아니다 */}\n   planEnd();\n   // 저장을 기다리는 사이 판이 닫혔거나(패널을 닫음) 코치가 닫혔다",
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
