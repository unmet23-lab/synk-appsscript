// 1단계 후보의 3방향 겹침을 손으로 푼다(설계 주인 11-20 — 라이브 위에 새 길 조각만). 겹침마다 「라이브 + 새 길 줄」로 쓰고,
// 라이브에 없는 다른 일(한글 기록 옮기기 · 연습 열기 표 launching/active · 내 위치 열기 표 home.openPanel 확인)은 넣지 않는다.
//   node resolve.cjs   → <export>/.tmp/cand-step1-resolved/<공개 경로>
const fs=require('node:fs'),path=require('node:path');
const C='D:/SYNK-worktrees/world-export-atlas-20261120b/.tmp/cand-step1',R=path.join(C,'..','cand-step1-resolved');
const blocks=text=>{const re=/^<<<<<<< [^\n]*\n([\s\S]*?)^=======\n([\s\S]*?)^>>>>>>> [^\n]*\n/gm;const out=[];let m;while((m=re.exec(text)))out.push({all:m[0],live:m[1],mine:m[2]});return out;};
function solve(p,fixes){
 const text=fs.readFileSync(path.join(C,'new/world',p),'utf8');const bs=blocks(text);
 if(bs.length!==fixes.length)throw Error(`${p}: 겹침 ${bs.length}개인데 푼 판 ${fixes.length}개`);
 let out=text;bs.forEach((b,i)=>{const r=fixes[i](b);if(typeof r!=='string')throw Error(`${p} #${i+1}`);out=out.replace(b.all,r);});
 if(/^(<{7}|={7}|>{7})/m.test(out))throw Error(p+': 표식이 남았다');
 fs.mkdirSync(path.dirname(path.join(R,p)),{recursive:true});fs.writeFileSync(path.join(R,p),out);console.log(p,'풂',bs.length);
}
const must=(s,frag)=>{if(!s.includes(frag))throw Error('없는 조각: '+frag.slice(0,80));return s;};
const drop=(s,frag)=>must(s,frag).replace(frag,'');
// app-shell.mjs는 rebase-shell.cjs가 푼다(셋째 — 검수한 앞 후보를 새 라이브 위에 다시 얹음). 아래 옛 풀이는 앞 후보(옛 라이브 위)의 것이다.
if(false)solve('app-shell.mjs',[
 // ① 생활 기록의 새 길 입구 · 생활 판정 · 새 길 홈 — 한글 옮기기 통로(keep hangulMigration)는 라이브에 없다.
 b=>{if(b.live!=='')throw Error('①');return drop(b.mine," // 입장 때 준비한 한글 옮기기 통로도 이 생활 기록에 딸린다. 계정 변경·다시 세우기·pagehide에서 함께 버린다.\n keep('hangulMigration',null,()=>{const port=hangulMigrationPort;hangulMigrationPort=null;port?.dispose();});\n");},
 // ② 학습 화면에 넘기는 새 길 입구 · 새 길 홈 · 시험 점검 다시 보기 — 한글 기록 읽기(readHangulProgress)는 라이브에 없다.
 b=>{if(b.live!=='')throw Error('②');const cut=b.mine.indexOf('  readHangulProgress:');if(cut<0)throw Error('②-');return b.mine.slice(0,cut);},
 // ③ 기기 기록 묻기: 라이브 줄 + 새 길이 넘기는 계정 세대(accountGeneration — Atlas 계정 길 ⑤ e55e3b5a3e). hangulPort는 라이브에 없다.
 b=>{const live=b.live;const anchor="accountOwner:()=>client.snapshot?.accountId||'guest',";must(live,anchor);must(b.mine,anchor+'accountGeneration:()=>client.generation,');
  if(live.split(anchor)[1]!==b.mine.split(anchor+'accountGeneration:()=>client.generation,')[1])throw Error('③ 뒤가 다르다');return live.replace(anchor,anchor+'accountGeneration:()=>client.generation,');},
 // ④ 기기 기록 묻기(offer): 새 길 입구가 손님 저장소에서 옮길 수를 센다. 한글 옮기기 준비(async · prepareHangulProgress)는 라이브에 없다.
 b=>{must(b.live,' offer:identity=>deviceRecords.offer(identity),\n');
  const keep=b.mine.match(/  \/\/ Atlas 새 길\(기능 atlasNext\)[^\n]*\n  const next=[^\n]*\n  return deviceRecords\.offer\(identity,\{atlas:[^\n]*\n/);if(!keep)throw Error('④-');
  return ' offer:identity=>{\n'+keep[0]+' },\n';},
]);
solve('world-learning-ui.mjs',[
 // ① 학습 화면 인자: 라이브 서명 + 새 길 셋(atlasNext · homeNext · mockChanged). 한글 기록 읽기(readHangulProgress)는 라이브에 없다.
 b=>{const tail='target=globalThis}){\n';must(b.live,tail);must(b.mine,'target=globalThis,atlasNext=null,homeNext=null,mockChanged=null}){\n');return b.live.replace(tail,'target=globalThis,atlasNext=null,homeNext=null,mockChanged=null}){\n');},
 // ② 다시 그리기 막기: 새 길 열기 표(openPosition.pending — 새 길 openPositionNext만 세운다)와 새 길 시험 형식(heldMock) · 새 길 「내 위치」 다시 그리기.
 //    home.openPanel 확인은 라이브 밖 다른 일(A0 앞)이라 넣지 않는다 — 꺼진 판에서 두 값 모두 거짓이라 라이브와 같다.
 b=>{if(b.live!=='')throw Error('②');must(b.mine,"   if(home.openPanel?.()===''||openPosition.pending||heldMock())return;\n");
  return b.mine.replace("   if(home.openPanel?.()===''||openPosition.pending||heldMock())return;\n","   if(openPosition.pending||heldMock())return;\n");},
 // ③ 짧은 연습 시작: 라이브의 check() 차례 + 새 길 코치 줄(엔진이 다음 문항을 고르는 판)과 「한 항목만」(only) 막기. launching · active()는 라이브에 없다.
 b=>{const live=b.live;must(live,'  check();if(ticket!==practiceOpen)return;\n');
  const atlas=b.mine.match(/  \/\/ Atlas 새 길\(재설계 단계 4-1[^\n]*\n  if\(atlasNext&&!followupId\)\{[^\n]*\n  if\(only\)\{[^\n]*\n/);if(!atlas)throw Error('③-');
  const line=atlas[0].replace('if(!active())return;if(next){launching=false;return runPracticeNext({next,skillId,more,only});}','check();if(ticket!==practiceOpen)return;if(next)return runPracticeNext({next,skillId,more,only});');
  if(line===atlas[0])throw Error('③ 바꿀 조각 없음');return live+line;},
 // ④ 다시 그리기 건너뜀: 새 길 열기 표와 시험 형식만(꺼진 판에서 둘 다 거짓).
 b=>{if(b.live!=='')throw Error('④');return must(b.mine,"  if(keepScroll&&(openPosition.pending||heldMock()))return 'skipped';\n");},
]);
