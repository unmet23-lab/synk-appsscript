#!/usr/bin/env node
// WORLD 「말하기 연습」 문항 은행(experiences/synk-world-app/world-speaking-items.json)의 판 지문을 맞추고, SYNK-talk world-speaking 함수가
// 동봉하는 두 사본을 만든다(설계 experiences/synk-world-app/qa/speaking-pilot-20261021/설계.md §5).
//   node tools/build-world-speaking-talk.mjs --check                    은행의 contentHash가 지금 내용과 맞는지 본다(시험이 같은 일을 한다)
//   node tools/build-world-speaking-talk.mjs --write                    JSON의 contentHash 줄을 지금 내용으로 고친다
//   node tools/build-world-speaking-talk.mjs --talk <talk 폴더>          그 저장소의 lib/world-speaking-feedback.js·world-speaking-items.js를 다시 쓴다
//   node tools/build-world-speaking-talk.mjs --talk <talk 폴더> --check  두 사본이 지금 원본에서 만든 것과 같은지만 본다
// · 피드백 핵심(tools/lib/말하기피드백.mjs — 프롬프트·출력 꼴·보류·점수 말 거름·받아 적기 속도 검사·규칙 주문 칸·값 셈, 네트워크 없음)은
//   이 저장소가 정본이다. talk 함수 동봉은 CommonJS lib만 감싸므로 export만 module.exports로 바꾼 사본을 둔다. 사본은 손으로 고치지 않는다.
// · 문항 사본은 은행의 types·items·roleplays를 그대로 싣는다(검수 상태 포함). 화면은 contentHash를 items_version으로 보내고, 서버는 자기
//   사본의 지문과 견줘 다르면 ITEM_CHANGED(409)로 막는다. 검수를 통과하지 않은 문항은 함수 설정으로 리허설에서만 연다(talk 쪽 규칙).
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const BANK_FILE=join(root,'experiences/synk-world-app/world-speaking-items.json');
export const CORE_FILE=join(root,'tools/lib/말하기피드백.mjs');
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
export const TALK_FILES=Object.freeze({core:'lib/world-speaking-feedback.js',items:'lib/world-speaking-items.js'});

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
  const out={[TALK_FILES.core]:coreModule(),[TALK_FILES.items]:itemsModule(bank)};
  let stale=0;
  for(const [rel,content] of Object.entries(out)){
   const file=join(resolve(dir),rel);
   if(args.includes('--check')){let now='';try{now=lf(readFileSync(file,'utf8'));}catch{}if(now!==content){stale++;console.error(`낡음: ${rel}`);}else console.log(`같음: ${rel}`);}
   else{writeFileSync(file,content);console.log(`wrote ${file}`);}
  }
  if(stale)process.exit(1);
 }else console.log(`contentHash ${hash} 맞음`);
}
