'use strict';
// 후보에만(조건 1 브라우저 측정에서 찾음): 새 길 게임 문을 기다린 뒤 「패널이 열려 있나」를 묻지 않는다 — 기다리기 전에 열려 있던 패널만 본다.
// 손님 · 리허설처럼 패널 없이 게임을 여는 길은 기다리기 전부터 패널이 닫혀 있어, 문이 돌아온 뒤(404로 실패한 null 포함) 틀을 열지 않고 끝났다.
// 기다리는 동안 패널을 닫거나 다른 화면을 열면 gameLaunch가 바뀐다(close · show · 패널 close 이벤트). master는 d3abfd8c14(4-6 끝 판)에서 같은 뜻으로
// 고쳤다(loadingGone — 「불러오는 중」 패널을 연 길만 패널을 본다). 그 판은 ③의 바탕(1ebc932569) 뒤라 후보에 없다.
//   node edit-door-cand.cjs <후보 원본 world 폴더>
const fs = require('node:fs'), path = require('node:path');
const file = path.join(process.argv[2], 'app-shell.mjs');
let s = fs.readFileSync(file, 'utf8');
const crlf = s.includes('\r\n'), eol = x => (crlf ? x.replace(/\r?\n/g, '\r\n') : x);
const rep = (find, repl) => { const f = eol(find); const n = s.split(f).length - 1; if (n !== 1) throw Error(`${n}번: ${find.slice(0, 90)}`); s = s.replace(f, () => eol(repl)); };
rep(` // 새 엔진 게임 문(4-6c — 단계4_계획 §23-2): 새 길 입구가 있으면 틀보다 먼저 둔다. 틀의 게임이 셸 창의 게임 코치를 겉으로 받는다(입구가 판을 정한다).
 if(life.atlasNext?.gameDoor){const doorTicket=gameLaunch;gameDoor=await life.atlasNext.gameDoor(id).catch(()=>null);if(doorTicket!==gameLaunch||!worldPanel.open){`,
 ` // 새 엔진 게임 문(4-6c — 단계4_계획 §23-2): 새 길 입구가 있으면 틀보다 먼저 둔다. 틀의 게임이 셸 창의 게임 코치를 겉으로 받는다(입구가 판을 정한다).
 // 기다리는 동안 패널을 닫거나 다른 화면을 열면 gameLaunch가 바뀐다. 패널은 기다리기 전에 열려 있던 길(계정의 「불러오는 중」)만 본다 — 손님 · 리허설은
 // 패널 없이 연다(입구가 없을 때 · 404도 문 없이 옛 길로 연다, 설계 주인 11-23 조건 1 브라우저 측정).
 if(life.atlasNext?.gameDoor){const doorTicket=gameLaunch,panelWas=worldPanel.open;gameDoor=await life.atlasNext.gameDoor(id).catch(()=>null);if(doorTicket!==gameLaunch||panelWas&&!worldPanel.open){`);
fs.writeFileSync(file, s);
console.log('게임 문 패널 검사 고침(후보):', file);
