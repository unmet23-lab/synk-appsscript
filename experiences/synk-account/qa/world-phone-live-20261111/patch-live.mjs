#!/usr/bin/env node
// 웹 플랫폼 「WORLD는 휴대폰에서」(2026-11-11) 공개 후보 묶음을 짓는다.
// 공개본 account/dist/platform.js는 master 빌드와 구성이 달라(현장 노트 배포_공개 「공개본 … master 빌드로 덮으면」) 통째로 덮지 않는다.
// 앞 판 master 빌드(바탕 커밋의 dist/platform.js)와 새 빌드를 문장 조각으로 나눠 git diff로 고친 조각(hunk)을 얻고,
// 조각마다 앞뒤 문맥을 붙여 공개본에서 딱 한 번 맞는 자리에만 바꿔 넣는다. 한 번이 아니면(0번 · 여러 번) 멈춘다.
//   node patch-live.mjs <공개본 platform.js> <앞 판 빌드> <새 빌드> <후보 platform.js>
// 단언: ① 모든 조각이 공개본에서 정확히 한 번 맞는다 ② 되돌리기(후보에서 새 조각 → 앞 조각)로 공개본 바이트가 그대로 돌아온다
//       ③ 후보가 문법상 읽힌다(new Function) ④ 새 판에만 있는 이름(worldPhoneSection · listedItem · UNLISTED_APP_IDS)이 후보에 있다.
import {readFileSync,writeFileSync,mkdtempSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';

const [livePath,oldPath,newPath,outPath]=process.argv.slice(2);
if(!outPath){console.error('쓰기: node patch-live.mjs <공개본 platform.js> <앞 판 빌드> <새 빌드> <후보 platform.js>');process.exit(2);}
const live=readFileSync(livePath,'utf8'),before=readFileSync(oldPath,'utf8'),after=readFileSync(newPath,'utf8');
// 문장 조각: ; { } 와 줄바꿈 뒤에서 자른다(빌드는 minifyWhitespace라 한 줄이 길다).
const chunks=text=>text.split(/(?<=[;{}\n])/);
const A=chunks(before),B=chunks(after);
const dir=mkdtempSync(join(tmpdir(),'world-phone-live-'));
const enc=list=>list.map(chunk=>JSON.stringify(chunk)).join('\n')+'\n';
writeFileSync(join(dir,'a'),enc(A));writeFileSync(join(dir,'b'),enc(B));
let patch='';try{execFileSync('git',['diff','--no-index','-U0','--no-color','a','b'],{cwd:dir,encoding:'utf8',maxBuffer:1<<28});}catch(error){patch=error.stdout;}
const hunks=[...patch.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm)].map(m=>{const oldStart=+m[1],oldCount=m[2]===undefined?1:+m[2],newStart=+m[3],newCount=m[4]===undefined?1:+m[4];
  // 개수 0이면 그 줄 「뒤」에 넣는다(git 꼴): 시작 번호가 앞 줄을 가리킨다.
  const o=oldCount?oldStart-1:oldStart,n=newCount?newStart-1:newStart;return {o,oldCount,n,newCount};});
assert.ok(hunks.length>0,'바뀐 조각이 없다');
// 공개본은 지역 이름 몇 곳이 master 빌드와 다르다(예: (a,b)=> ↔ (a2,b2)=>). 그래서 조각 자체가 한 번만 나오면 문맥 없이,
// 아니면 앞 문맥만 · 뒤 문맥만 · 둘 다를 1~12조각까지 늘려 가며 「정확히 한 번」인 자리를 찾는다.
function locate(text,body,h,{beforeChunks,afterChunks}){
  for(let k=0;k<=12;k++)for(const [p,q] of k?[[k,0],[0,k],[k,k]]:[[0,0]]){
    if(!body&&!p&&!q)continue;
    const pre=beforeChunks(p),post=afterChunks(q),needle=pre+body+post;
    const first=text.indexOf(needle);if(first<0||text.indexOf(needle,first+1)>=0)continue;
    return {at:first+pre.length,context:[p,q]};
  }
  return null;
}
const sides=h=>({beforeChunks:k=>A.slice(Math.max(0,h.o-k),h.o).join(''),afterChunks:k=>B.slice(h.n+h.newCount,h.n+h.newCount+k).join('')});
// 뒤에서부터 얹는다: 지금 조각의 앞은 아직 옛 판(A), 뒤는 이미 새 판(B)이라 문맥도 그렇게 잡는다(붙은 조각끼리 문맥이 엇갈리지 않게).
let text=live;const applied=[];
for(const h of [...hunks].reverse()){
  const removed=A.slice(h.o,h.o+h.oldCount).join(''),added=B.slice(h.n,h.n+h.newCount).join('');
  const found=locate(text,removed,h,sides(h));
  assert.ok(found,`공개본에서 한 번만 맞는 자리를 못 찾았다: 앞 판 조각 ${h.o+1}(${removed.slice(0,120)}…)`);
  text=text.slice(0,found.at)+added+text.slice(found.at+removed.length);
  applied.unshift({oldChunk:h.o+1,oldCount:h.oldCount,newCount:h.newCount,context:found.context,removed:removed.length,added:added.length});
}
// ② 되돌리기: 앞에서부터 새 조각을 앞 조각으로 바꾸면 공개본 그대로여야 한다(앞은 되돌린 옛 판 A, 뒤는 아직 새 판 B).
let back=text;
for(const h of hunks){
  const removed=A.slice(h.o,h.o+h.oldCount).join(''),added=B.slice(h.n,h.n+h.newCount).join('');
  const found=locate(back,added,h,sides(h));
  assert.ok(found,`되돌리기에서 새 조각 ${h.n+1}을 한 번만 찾지 못했다`);
  back=back.slice(0,found.at)+removed+back.slice(found.at+added.length);
}
assert.equal(back,live,'되돌린 후보가 공개본과 바이트까지 같지 않다');
new Function(text); // ③ 문법
for(const name of ['worldPhoneSection','worldPhoneEscape','listedItem','UNLISTED_APP_IDS','world-qr.svg'])assert.ok(text.includes(name),'후보에 '+name+'이 없다'); // ④
writeFileSync(outPath,text);
console.log(JSON.stringify({live:live.length,candidate:text.length,hunks:applied.length,applied},null,1));
