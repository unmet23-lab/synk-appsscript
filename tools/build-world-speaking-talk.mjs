#!/usr/bin/env node
// WORLD 「말하기 연습」 문항 은행(experiences/synk-world-app/world-speaking-items.json)의 판 지문을 맞추고, SYNK-talk world-speaking 함수가
// 동봉하는 두 사본을 만든다(설계 experiences/synk-world-app/qa/speaking-pilot-20261021/설계.md §5).
//   node tools/build-world-speaking-talk.mjs --check                    은행의 contentHash가 지금 내용과 맞는지 본다(시험이 같은 일을 한다)
//   node tools/build-world-speaking-talk.mjs --write                    JSON의 contentHash 줄을 지금 내용으로 고친다
//   node tools/build-world-speaking-talk.mjs --talk <talk 폴더>          그 저장소의 lib/world-speaking-feedback.js·world-speaking-items.js와
//                                                                       드라마 두 사본(lib/world-drama-judge.js·world-drama-lines.js)을 다시 쓴다
//   node tools/build-world-speaking-talk.mjs --talk <talk 폴더> --check  네 사본이 지금 원본에서 만든 것과 같은지만 본다
// · 피드백 핵심(tools/lib/말하기피드백.mjs — 프롬프트·출력 꼴·보류·점수 말 거름·받아 적기 속도 검사·규칙 주문 칸·값 셈, 네트워크 없음)은
//   이 저장소가 정본이다. talk 함수 동봉은 CommonJS lib만 감싸므로 export만 module.exports로 바꾼 사본을 둔다. 사본은 손으로 고치지 않는다.
// · 문항 사본은 은행의 types·items·roleplays를 그대로 싣는다(검수 상태 포함). 화면은 contentHash를 items_version으로 보내고, 서버는 자기
//   사본의 지문과 견줘 다르면 ITEM_CHANGED(409)로 막는다. 검수를 통과하지 않은 문항은 함수 설정으로 리허설에서만 연다(talk 쪽 규칙).
// · 드라마 말하기(10-31): 장면 판정 tools/lib/드라마판정.mjs가 정본이고, talk에는 import 한 줄(말하기피드백.mjs의 syllables)을 그 사본
//   world-speaking-feedback.js의 require로 바꾼 CommonJS 사본만 둔다. 대사 은행은 대본(experiences/drama/s*/ep*.mjs)의 학생 줄과 처음 보는
//   대사이고 하나라도 자기 칸 명세(checkSpec)를 통과하지 못하면 멈춘다(조용히 빼면 화면과 서버가 다른 줄을 본다). 화면은 LINES_HASH를
//   lines_version으로 보낸다. 칸 명세는 AI 2중 검수를 통과해야 학습 근거로 쓴다(기획 §4-1) — 대본 줄에 검수:'passed'가 없으면 draft로 실어
//   함수가 리허설(WORLD_SPEAKING_DRAFT_ITEMS=true)에서만 연다.
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {syllables} from './lib/말하기피드백.mjs';
import {checkSpec,DRAMA_JUDGE_VERSION} from './lib/드라마판정.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const BANK_FILE=join(root,'experiences/synk-world-app/world-speaking-items.json');
export const CORE_FILE=join(root,'tools/lib/말하기피드백.mjs');
export const JUDGE_FILE=join(root,'tools/lib/드라마판정.mjs');
export const EPISODE_FILES=Object.freeze([join(root,'experiences/drama/s1/ep01.mjs')]);
const lf=text=>String(text).replace(/\r\n/g,'\n');
const sorted=value=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,sorted(value[key])])):value;
// 판 지문은 서버가 쓰는 세 칸(types·items·roleplays)으로만 셈한다 — 머리말(note·basis)이 바뀌어도 서버 사본을 다시 낼 일이 없다.
export const bankHash=bank=>createHash('sha256').update(JSON.stringify(sorted({types:bank.types,items:bank.items,roleplays:bank.roleplays||[]}))).digest('hex').slice(0,16);
export function readBank(file=BANK_FILE){const text=readFileSync(file,'utf8');return {text,bank:JSON.parse(text)};}

/** 피드백 핵심(ESM)을 CommonJS로 — 맨 앞의 `export const|function`만 벗기고 이름을 module.exports에 모은다. import·다른 export 꼴은 멈춘다. */
export function coreModule(source=readFileSync(CORE_FILE,'utf8')){
 const text=lf(source);
 if(/^\s*import\s/m.test(text))throw new Error('말하기피드백.mjs가 import를 쓴다 — 서버 사본은 다른 파일을 싣지 않는다(동봉 표에 따로 더해야 한다)');
 const names=[];
 const body=text.replace(/^export (const|function|async function) ([A-Za-z_$][\w$]*)/gm,(_,kind,name)=>{names.push(name);return `${kind} ${name}`;});
 if(/^\s*export\b/m.test(body))throw new Error('말하기피드백.mjs에 옮기지 못하는 export 꼴이 있다(export { … }·export default 등)');
 if(!names.length)throw new Error('말하기피드백.mjs에서 export를 찾지 못했다');
 const hash=createHash('sha256').update(text).digest('hex').slice(0,16);
 return `'use strict';\n// 생성물 — SYNK-appsscript tools/build-world-speaking-talk.mjs가 tools/lib/말하기피드백.mjs(ESM, 원본 지문 ${hash})를 CommonJS로 옮겼다. 손으로 고치지 않는다.\n${body.replace(/\n*$/,'\n')}\nmodule.exports = { ${names.join(', ')} };\n`;
}
/** 서버 문항 사본 — 은행의 세 칸 그대로, 지문은 bankHash. */
export function itemsModule(bank){
 return `'use strict';\n// 생성물 — SYNK-appsscript tools/build-world-speaking-talk.mjs가 experiences/synk-world-app/world-speaking-items.json에서 만든다. 손으로 고치지 않는다.\n// 화면이 보낸 items_version이 BANK_HASH와 다르면 함수는 ITEM_CHANGED(409)로 막는다(화면과 서버가 다른 문항을 보는 중).\n// review.status가 'passed'가 아닌 문항·역할극은 검수 전 초안이다 — 함수는 WORLD_SPEAKING_DRAFT_ITEMS=true(리허설)일 때만 연다.\nconst BANK_VERSION = ${JSON.stringify(bank.version)};\nconst BANK_HASH = ${JSON.stringify(bankHash(bank))};\nconst TYPES = Object.freeze(${JSON.stringify(bank.types)});\nconst ITEMS = Object.freeze(${JSON.stringify(bank.items)});\nconst ROLEPLAYS = Object.freeze(${JSON.stringify(bank.roleplays||[])});\nmodule.exports = { BANK_VERSION, BANK_HASH, TYPES, ITEMS, ROLEPLAYS };\n`;
}
/** 드라마 판정(ESM)을 CommonJS로 — import는 말하기피드백.mjs의 syllables 하나만 받는다. 한 줄에 이름이 여럿인 단순 값 선언(HIT·MISS)도 모은다. */
export function judgeModule(source=readFileSync(JUDGE_FILE,'utf8')){
 const text=lf(source);
 const imports=[...text.matchAll(/^import\s*\{([^}]*)\}\s*from\s*'([^']+)';[ \t]*$/gm)];
 if(imports.length!==1||imports[0][2]!=='./말하기피드백.mjs'||imports[0][1].split(',').map(s=>s.trim()).filter(Boolean).join(',')!=='syllables')
  throw new Error('드라마판정.mjs의 import는 말하기피드백.mjs의 syllables 하나만 옮긴다(talk 사본은 world-speaking-feedback.js를 require한다)');
 const names=[];
 const body=text.replace(imports[0][0],"const { syllables } = require('./world-speaking-feedback.js');")
  .replace(/^export const ((?:[A-Za-z_$][\w$]*=[^,;()[\]{}'"`\n]*,)+[A-Za-z_$][\w$]*=[^,;()[\]{}'"`\n]*);$/gm,(_,list)=>{for(const m of list.matchAll(/(?:^|,)([A-Za-z_$][\w$]*)=/g))names.push(m[1]);return `const ${list};`;})
  .replace(/^export (const|function|async function) ([A-Za-z_$][\w$]*)/gm,(_,kind,name)=>{names.push(name);return `${kind} ${name}`;});
 if(/^\s*(export|import)\b/m.test(body))throw new Error('드라마판정.mjs에 옮기지 못하는 import·export 꼴이 있다');
 const hash=createHash('sha256').update(text).digest('hex').slice(0,16);
 return `'use strict';\n// 생성물 — SYNK-appsscript tools/build-world-speaking-talk.mjs가 tools/lib/드라마판정.mjs(ESM, 원본 지문 ${hash})를 CommonJS로 옮겼다. 손으로 고치지 않는다.\n${body.replace(/\n*$/,'\n')}\nmodule.exports = { ${names.join(', ')} };\n`;
}
/** 녹음 상한 초(대사마다) — 학습자가 1초에 2음절쯤 말한다고 보고 시작 머뭇거림 4초를 더한다. 8~30초. 함수는 여기에 5초를 더 받는다. */
export const answerSecOf=line=>Math.min(30,Math.max(8,Math.ceil(syllables(line)/2)+4));
export async function readEpisodes(files=EPISODE_FILES){const out=[];for(const file of files)out.push((await import(pathToFileURL(file).href)).default);return out;}
/** 대사 은행 — 학생 줄(scene, 장면 대사 · 연습)과 처음 보는 대사(unseen). 판정 명세는 대본 그대로 {id, line, ...명세}. */
export function dramaLines(episodes){
 const lines=[],seen=new Set();
 const add=(episode,row,kind)=>{
  const spec={id:row.id,line:row.말,...row.명세};
  const problems=checkSpec(spec);
  if(problems.length)throw new Error(`대사 ${row.id} 칸 명세 문제 — ${problems.join(' · ')}`);
  if(seen.has(row.id))throw new Error(`대사 id가 겹친다: ${row.id}`);
  seen.add(row.id);
  lines.push({id:row.id,episode:episode.id,kind,to:spec.to,line:row.말,spec,answerSec:answerSecOf(row.말),review:{status:row.검수==='passed'?'passed':'draft'}});
 };
 for(const episode of episodes){
  for(const day of episode.촬영일||[])for(const row of day.줄||[])if(row.누가==='학생')add(episode,row,'scene');
  for(const row of episode.처음보는대사||[])add(episode,row,'unseen');
 }
 return lines;
}
export const linesHash=lines=>createHash('sha256').update(JSON.stringify(sorted(lines))).digest('hex').slice(0,16);
/** 서버 대사 은행 사본 — 지문은 linesHash, 판정 판은 드라마판정.mjs의 DRAMA_JUDGE_VERSION. */
export function linesModule(lines){
 return `'use strict';\n// 생성물 — SYNK-appsscript tools/build-world-speaking-talk.mjs가 드라마 대본(experiences/drama/s*/ep*.mjs)의 학생 줄과 처음 보는 대사에서 만든다. 손으로 고치지 않는다.\n// 화면이 보낸 lines_version이 LINES_HASH와 다르면 함수는 ITEM_CHANGED(409)로 막는다. review.status가 'passed'가 아닌 대사는 칸 명세 AI 2중 검수 전이다\n// — 함수는 WORLD_SPEAKING_DRAFT_ITEMS=true(리허설)일 때만 연다. kind: scene(장면 대사 — 연습) · unseen(처음 보는 대사 — 도움 없이 말해 봄을 볼 수 있는 줄).\nconst JUDGE_VERSION = ${JSON.stringify(DRAMA_JUDGE_VERSION)};\nconst LINES_HASH = ${JSON.stringify(linesHash(lines))};\nconst LINES = Object.freeze(${JSON.stringify(lines)});\nmodule.exports = { JUDGE_VERSION, LINES_HASH, LINES };\n`;
}
export const TALK_FILES=Object.freeze({core:'lib/world-speaking-feedback.js',items:'lib/world-speaking-items.js',judge:'lib/world-drama-judge.js',lines:'lib/world-drama-lines.js'});

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),{text,bank}=readBank(),hash=bankHash(bank);
 if(args.includes('--write')){
  const next=/"contentHash": "[0-9a-f]*"/.test(text)?text.replace(/"contentHash": "[0-9a-f]*"/,`"contentHash": "${hash}"`):text.replace(/("status": "[^"]*",)/,`$1\n  "contentHash": "${hash}",`);
  if(next===text&&!/"contentHash": "/.test(text))throw new Error('contentHash를 넣을 자리("status" 줄)를 찾지 못했다');
  writeFileSync(BANK_FILE,next);console.log(`contentHash ${hash}`);
 }
 const current=JSON.parse(readFileSync(BANK_FILE,'utf8')).contentHash;
 if(current!==hash){console.error(`contentHash가 낡았어요: 파일 ${current} · 내용 ${hash}. --write로 고친 뒤 --talk로 서버 사본도 다시 만드세요.`);process.exit(1);}
 const talk=args.indexOf('--talk');
 if(talk>=0){
  const dir=args[talk+1];if(!dir||dir.startsWith('--'))throw new Error('--talk 다음에 SYNK-talk 폴더를 주세요');
  const out={[TALK_FILES.core]:coreModule(),[TALK_FILES.items]:itemsModule(bank),[TALK_FILES.judge]:judgeModule(),[TALK_FILES.lines]:linesModule(dramaLines(await readEpisodes()))};
  let stale=0;
  for(const [rel,content] of Object.entries(out)){
   const file=join(resolve(dir),rel);
   if(args.includes('--check')){let now='';try{now=lf(readFileSync(file,'utf8'));}catch{}if(now!==content){stale++;console.error(`낡음: ${rel}`);}else console.log(`같음: ${rel}`);}
   else{writeFileSync(file,content);console.log(`wrote ${file}`);}
  }
  if(stale)process.exit(1);
 }else console.log(`contentHash ${hash} 맞음`);
}
