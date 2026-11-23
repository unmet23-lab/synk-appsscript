'use strict';
// -s3e 검수 지적 고침(life-ui 넷 · app-shell 하나).  node edit-s3e-fixes.cjs <app-shell · life-ui가 있는 폴더(master experiences/synk-world-app 또는 후보 원본 world)>
const fs = require('node:fs'), path = require('node:path');
const dir = process.argv[2];
const io = name => {
  const file = path.join(dir, name);
  let s = fs.readFileSync(file, 'utf8');
  const crlf = s.includes('\r\n'), eol = x => (crlf ? x.replace(/\r?\n/g, '\r\n') : x);
  const rep = (find, repl, count = 1) => { const f = eol(find); const n = s.split(f).length - 1; if (n !== count) throw Error(`${name}: ${n}번(${count}이어야) — ${find.slice(0, 80)}`); s = s.split(f).join(eol(repl)); };
  return { rep, save: () => fs.writeFileSync(file, s) };
};

const l = io('life-ui.mjs');
// GPT s3e1 — 같은 표현의 장면을 합칠 때 「곧 다시」(again)도 합친다(soon과 같게). 장면 순서에 따라 결과 안내가 갈렸다.
l.rep(`if(kept){kept.scenes+=1;kept.soon=kept.soon===true||row.soon===true;}`,
 `if(kept){kept.scenes+=1;kept.soon=kept.soon===true||row.soon===true;kept.again=kept.again===true||row.again===true;}`);
// GPT s3e1 — 「내일쯤」은 달력의 다음 날로 잰다. 24시간 뒤로 재면 하루가 23시간인 날(일광 절약 시간 시작)에 이틀 뒤를 내일이라 했다.
l.rep(` if(day(at)===day(now+86400000))return t('life.when.tomorrowDay');`,
 ` const next=new Date(now);next.setDate(next.getDate()+1);
 if(day(at)===day(next.getTime()))return t('life.when.tomorrowDay');`);
// GPT s3e1 — 복습 화면의 판정 표지에 오늘 날짜도 넣는다. 자정이 지나면 「내일쯤」이 「오늘 중」이 되는데 표지가 같아 다시 그리지 않았다.
l.rep(` const reviewSign=s=>[s.dueState??'',s.dueCount,(s.dueIds||[]).join(','),s.nextReviewAt??''].join('|');`,
 ` const reviewSign=s=>[s.dueState??'',s.dueCount,(s.dueIds||[]).join(','),s.nextReviewAt??'',new Date().toDateString()].join('|');`);
// GPT s3e1 — 다시 그린 뒤 초점을 되돌릴 단추에 허브의 「내 위치」(data-view)도 든다. 빠지면 초점이 닫기 단추로 가서 엔터가 허브를 닫았다.
l.rep(`const attr=[...(el.attributes||[])].find(a=>a.name.startsWith('data-life-'));`,
 `const attr=[...(el.attributes||[])].find(a=>a.name.startsWith('data-life-')||a.name==='data-view');`);
l.save();

const a = io('app-shell.mjs');
// GPT s3e2 GA1 — 학습 기록 동의를 바꾼 계정의 열쇠만 지운다. 기다리는 사이 다른 계정으로 바뀌면 응답 때의 계정(B)의 학습일 답을 지웠다.
a.rep(`const enabled=control.checked;void account.setLearning(enabled,Number(control.dataset.revision)).then(()=>{clearMonthAnswer(localStorage,client.snapshot?.accountId);if(life.owner===(client.snapshot?.accountId||'guest'))life.atlasNext?.redecide?.('account');if(screen==='world-profile')profile();}).catch(error=>{control.checked=!enabled;clearMonthAnswer(localStorage,client.snapshot?.accountId);home.toast(errorText(error));if(life.owner===(client.snapshot?.accountId||'guest'))life.atlasNext?.redecide?.('account');`,
 `const enabled=control.checked,owner=client.snapshot?.accountId;void account.setLearning(enabled,Number(control.dataset.revision)).then(()=>{clearMonthAnswer(localStorage,owner);if(life.owner===(owner||'guest'))life.atlasNext?.redecide?.('account');if(screen==='world-profile')profile();}).catch(error=>{control.checked=!enabled;clearMonthAnswer(localStorage,owner);home.toast(errorText(error));if(life.owner===(owner||'guest'))life.atlasNext?.redecide?.('account');`);
a.rep(` // 학습일 답은 실패한 갈래에서도 지운다 — 서버의 동의 판은 바뀌었을 수 있다(세대 수만 오르고 해가 없다 — 4-4c 끝 판 F3).`,
 ` // 학습일 답은 실패한 갈래에서도 지운다 — 서버의 동의 판은 바뀌었을 수 있다(세대 수만 오르고 해가 없다 — 4-4c 끝 판 F3). 지우는 열쇠는 누른 때의
 // 계정 것이다 — 기다리는 사이 다른 계정으로 바뀌어도 그 계정의 학습일 답은 그대로 둔다.`);
a.save();
console.log('고침:', dir);
