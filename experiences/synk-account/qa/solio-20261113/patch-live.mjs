#!/usr/bin/env node
// 웹 플랫폼 SYNK SOLIO 판(2026-11-13) 공개 후보 묶음을 짓는다 — 11-11 「WORLD는 휴대폰에서」 판(qa/world-phone-live-20261111/patch-live.mjs)과 같은 방법.
// 공개본 account/dist/platform.js는 master 빌드와 구성이 달라 통째로 덮지 않는다. 앞 판 master 빌드(바탕 커밋의 dist/platform.js)와 새 빌드를
// 문장 조각으로 나눠 git diff로 고친 조각(hunk)을 얻고, 조각마다 앞뒤 문맥을 붙여 공개본에서 딱 한 번 맞는 자리에만 바꿔 넣는다. 한 번이 아니면 멈춘다.
//   node patch-live.mjs <공개본 platform.js> <앞 판 빌드> <새 빌드> <후보 platform.js>
// 단언: ① 모든 조각이 공개본에서 정확히 한 번 맞는다 ② 되돌리기(후보에서 새 조각 → 앞 조각)로 공개본 바이트가 그대로 돌아온다
//       ③ 후보가 문법상 읽힌다(new Function) ④ 새 판에만 있는 이름(solio로 시작하는 새 모듈 이름 · SOLIO_SEARCH · solio-object.webp)이 후보에 있다.
// 새 웹 모듈(src/platform-solio.mjs)과 platform.mjs에 더한 최상위 이름은 모두 solio로 시작한다 — 흔한 이름이면 esbuild가 뒤 모듈 이름 번호를 밀어 차이가 번진다(설계 검토 D9).
import {readFileSync,writeFileSync,mkdtempSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';

const [livePath,oldPath,newPath,outPath]=process.argv.slice(2);
if(!outPath){console.error('쓰기: node patch-live.mjs <공개본 platform.js> <앞 판 빌드> <새 빌드> <후보 platform.js>');process.exit(2);}
const liveRaw=readFileSync(livePath,'utf8'),beforeRaw=readFileSync(oldPath,'utf8'),after=readFileSync(newPath,'utf8');
// 구역 바꿈(2026-11-13): 공개본의 회원 혜택 목록(desktop/renderer/benefits.mjs)은 앞서 손으로 얹은 JSON 꼴(「"id":」)이라 글자로는 master와 안 맞는다.
// 그 구역만 「공개본 목록 = 앞 판 목록」(값으로 같음)을 단언한 뒤 새 판 구역(MEMBER_INSIGHT + MEMBER_BENEFITS)으로 통째로 바꾸고, 나머지만 조각으로 얹는다.
// 되돌리기 단언은 조각을 되돌린 뒤 이 구역을 공개본 글자 그대로 되돌려 바이트를 견준다.
const region=(text,start)=>{const i=text.indexOf(start),j=text.indexOf('function memberBenefit(',i);assert.ok(i>=0&&j>i&&text.indexOf(start,i+1)<0,'회원 혜택 구역을 한 번만 찾지 못했다: '+start);return {i,j,body:text.slice(i,j)};};
const listOf=body=>JSON.stringify(new Function(body+';return MEMBER_BENEFITS;')());
const liveRegion=region(liveRaw,'var MEMBER_BENEFITS='),oldRegion=region(beforeRaw,'var MEMBER_BENEFITS='),newRegion=region(after,'var MEMBER_INSIGHT=');
assert.equal(listOf(liveRegion.body),listOf(oldRegion.body),'공개본 회원 혜택 목록이 앞 판 master 목록과 값이 다르다 — 통째로 바꾸면 남의 공개 고침을 덮는다');
assert.ok(newRegion.body.includes('var MEMBER_BENEFITS='),'새 판 구역에 MEMBER_BENEFITS가 없다');
const live=liveRaw.slice(0,liveRegion.i)+newRegion.body+liveRaw.slice(liveRegion.j),before=beforeRaw.slice(0,oldRegion.i)+newRegion.body+beforeRaw.slice(oldRegion.j);
// 문장 조각: ; { } 와 줄바꿈 뒤에서 자른다(빌드는 minifyWhitespace라 한 줄이 길다).
const chunks=text=>text.split(/(?<=[;{}\n])/);
const A=chunks(before),B=chunks(after);
const dir=mkdtempSync(join(tmpdir(),'solio-live-'));
const enc=list=>list.map(chunk=>JSON.stringify(chunk)).join('\n')+'\n';
writeFileSync(join(dir,'a'),enc(A));writeFileSync(join(dir,'b'),enc(B));
let patch='';try{execFileSync('git',['diff','--no-index','-U0','--no-color','a','b'],{cwd:dir,encoding:'utf8',maxBuffer:1<<28});}catch(error){patch=error.stdout;}
const hunks=[...patch.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm)].map(m=>{const oldStart=+m[1],oldCount=m[2]===undefined?1:+m[2],newStart=+m[3],newCount=m[4]===undefined?1:+m[4];
  // 개수 0이면 그 줄 「뒤」에 넣는다(git 꼴): 시작 번호가 앞 줄을 가리킨다.
  const o=oldCount?oldStart-1:oldStart,n=newCount?newStart-1:newStart;return {o,oldCount,n,newCount};});
assert.ok(hunks.length>0,'바뀐 조각이 없다');
// 공개본 구성 맞춤(2026-11-13): 공개본은 내 성향 · 이해 모듈을 따로 지은 이름공간(SYNK_MEMBER_INSIGHT_20261014)으로 부른다(master 빌드는 맨 이름).
// 조각이 공개본에서 그대로 안 맞으면, 공개본이 그 이름공간으로 부르는 이름의 맨 호출(함수 정의 · 점 뒤는 아님)만 「이름공간.이름」으로 바꿔 다시 찾고, 넣는 조각도 같이 바꾼다.
const NS=[...new Set([...live.matchAll(/\b(SYNK_MEMBER_[A-Z_]+_\d{8})\.(\w+)/g)].map(m=>m[1]+'.'+m[2]))].map(x=>x.split('.'));
const bareCall=name=>new RegExp('(?<![.\\w$]|function )'+name+'(?=\\()','g');
const nsAlias=value=>NS.reduce((t,[ns,name])=>t.replace(bareCall(name),ns+'.'+name),value);
// 공개본에서 이름공간 묶음(따로 지은 IIFE)이 끝나는 자리 — 그 뒤가 플랫폼 본문이다.
const NS_END=(()=>{if(!NS.length)return -1;const i=live.indexOf('return __toCommonJS(');assert.ok(i>=0&&live.indexOf('return __toCommonJS(',i+1)<0,'공개본 이름공간 묶음 끝(return __toCommonJS)을 한 번만 찾지 못했다');const end=live.indexOf('})();',i);assert.ok(end>i,'공개본 이름공간 묶음 닫힘을 찾지 못했다');return end+5;})();
const aliasSides=side=>({beforeChunks:k=>nsAlias(side.beforeChunks(k)),afterChunks:k=>nsAlias(side.afterChunks(k))});
// 이름 번호 맞춤: 공개본의 이름공간 사본은 지역 이름 번호가 master와 다르다(text ↔ text2). 위 둘로 못 찾으면, 조각과 앞뒤 문맥의 맨 이름(점 뒤 속성 제외)마다
// 「같은 이름 + 숫자 꼬리」를 허용해 정확히 한 번 맞는 자리를 찾고, 거기서 읽은 대응(text → text2)을 넣는 조각에도 똑같이 쓴다(한 이름은 한 대응만).
const IDENT=/(?<![.\w$])[A-Za-z_$][\w$]*/g,reEsc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function numbered(text,body,side){
  for(let k=1;k<=12;k++)for(const [p,q] of [[k,0],[0,k],[k,k]]){
    const pre=side.beforeChunks(p),post=side.afterChunks(q),needle=pre+body+post,names=[];let src='',last=0;
    for(const m of needle.matchAll(IDENT)){src+=reEsc(needle.slice(last,m.index))+'('+reEsc(m[0])+'\\d*)';names.push(m[0]);last=m.index+m[0].length;}
    src+=reEsc(needle.slice(last));
    const re=new RegExp(src,'g'),hits=[...text.matchAll(re)];if(hits.length!==1)continue;
    const map=new Map();let ok=true;names.forEach((name,i)=>{const got=hits[0][i+1];if(map.has(name)&&map.get(name)!==got)ok=false;map.set(name,got);});
    if(!ok)continue;
    const preLen=hits[0][0].length-(post?rename(post,map).length:0)-rename(body,map).length;
    return {at:hits[0].index+preLen,context:[p,q,'번호'],map};
  }
  return null;
}
const rename=(value,map)=>value.replace(IDENT,word=>map.get(word)??word);
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
  let found=locate(text,removed,h,sides(h));h.alias=false;h.map=null;
  if(!found){found=locate(text,nsAlias(removed),h,aliasSides(sides(h)));h.alias=!!found;}
  if(!found){found=numbered(text,removed,sides(h));h.map=found?.map||null;}
  assert.ok(found,`공개본에서 한 번만 맞는 자리를 못 찾았다: 앞 판 조각 ${h.o+1}(${removed.slice(0,120)}…)`);
  // 이름공간 묶음이 끝난 뒤(플랫폼 본문)에 넣는 조각은 그 이름들을 늘 이름공간으로 부른다 — 새 함수(맞춤 정보 화면)도 공개본 구성에서 돈다.
  h.outside=NS_END>=0&&found.at>NS_END;
  const baseAdded=h.alias||h.outside?nsAlias(added):added,baseRemoved=h.alias?nsAlias(removed):removed;
  const put=h.map?rename(baseAdded,h.map):baseAdded,cut=h.map?rename(baseRemoved,h.map):baseRemoved;
  assert.equal(text.slice(found.at,found.at+cut.length),cut,`조각 ${h.o+1}: 찾은 자리의 글이 빼려는 조각과 다르다`);
  text=text.slice(0,found.at)+put+text.slice(found.at+cut.length);
  applied.unshift({oldChunk:h.o+1,oldCount:h.oldCount,newCount:h.newCount,context:found.context,removed:cut.length,added:put.length,alias:h.alias,outside:h.outside||undefined,renamed:h.map?[...h.map].filter(([a,b])=>a!==b):undefined});
}
// ② 되돌리기: 앞에서부터 새 조각을 앞 조각으로 바꾸면 공개본 그대로여야 한다(앞은 되돌린 옛 판 A, 뒤는 아직 새 판 B).
let back=text;
for(const h of hunks){
  const removed=A.slice(h.o,h.o+h.oldCount).join(''),added=B.slice(h.n,h.n+h.newCount).join('');
  const baseAdded=h.alias||h.outside?nsAlias(added):added,baseRemoved=h.alias?nsAlias(removed):removed;
  const put=h.map?rename(baseAdded,h.map):baseAdded,cut=h.map?rename(baseRemoved,h.map):baseRemoved;
  const found=h.map?numbered(back,baseAdded,h.alias||h.outside?aliasSides(sides(h)):sides(h)):(locate(back,put,h,h.alias||h.outside?aliasSides(sides(h)):sides(h))||locate(back,put,h,sides(h)));
  assert.ok(found,`되돌리기에서 새 조각 ${h.n+1}을 한 번만 찾지 못했다`);
  assert.equal(back.slice(found.at,found.at+put.length),put,`되돌리기 조각 ${h.n+1}: 찾은 자리의 글이 넣었던 조각과 다르다`);
  back=back.slice(0,found.at)+cut+back.slice(found.at+put.length);
}
assert.equal(back,live,'되돌린 후보가 공개본과 바이트까지 같지 않다');
assert.equal(back.slice(0,liveRegion.i)+liveRegion.body+back.slice(liveRegion.i+newRegion.body.length),liveRaw,'회원 혜택 구역까지 되돌린 후보가 공개본과 바이트까지 같지 않다');
new Function(text); // ③ 문법
for(const name of ['solioLegacyHash','solioPage','solioHomeItem','solioDiscoverSection','solioAccountPage','solioInsightPage','solioProfileSet','solioFollowLegacy','SOLIO_SEARCH','solio-object.webp','「솔리오」 → 「AI 구독 관리」','이전 판에서는 「회원 혜택」 → 「AI 구독 계정판」'])assert.ok(text.includes(name),'후보에 '+name+'이 없다'); // ④
assert.ok(!text.includes('(이전 판은 「회원 혜택」)에서 「AI 구독 관리」'),'후보에 구형 PC 메뉴·항목 혼동 문구가 남아 있다 — dist/platform.js를 먼저 다시 지어야 한다');
// ⑤ 공개본 구성에서 이름공간 밖 맨 이름으로 내 성향 함수를 부르는 곳이 늘지 않았다(공개본 위층에는 그 맨 이름이 없다).
for(const [,name] of NS)assert.equal((text.match(bareCall(name))||[]).length,(live.match(bareCall(name))||[]).length,'후보에 이름공간 밖 '+name+' 호출이 늘었다');
writeFileSync(outPath,text);
console.log(JSON.stringify({live:live.length,candidate:text.length,hunks:applied.length,applied},null,1));
