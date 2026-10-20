#!/usr/bin/env node
// 공개 WORLD 「쓰기 연습」 문항 은행(experiences/synk-world-app/world-writing-items.json)의 판 지문을 맞추고,
// SYNK-talk world-writing 함수가 쓰는 서버 사본(lib/world-writing-items.js)을 만든다.
//   node tools/build-world-writing-items.mjs --check            지문이 내용과 맞는지만 본다(시험이 같은 일을 한다)
//   node tools/build-world-writing-items.mjs --write            JSON의 contentHash 줄을 지금 내용으로 고친다
//   node tools/build-world-writing-items.mjs --talk <talk 폴더>  그 저장소의 lib/world-writing-items.js를 다시 쓴다
// 화면은 contentHash를 그대로 보내고 서버는 자기 사본의 지문과 견준다. 다르면 자동 피드백 없이 규칙 점검만 보인다.
// 공개 빌드(tools/build-world-app-public.mjs)와 서버 사본은 publicBank()로 검수를 통과한 문항만, 검수 기록 없이 싣는다.
// 판 지문도 그 통과 문항만으로 셈한다(servedHash) — 보류 문항을 고치거나 검수 메모만 바뀌면 공개본·서버 사본을 다시 낼 일이 없다.
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const BANK_FILE=join(root,'experiences/synk-world-app/world-writing-items.json');
const sorted=value=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,sorted(value[key])])):value;
export const bankHash=items=>createHash('sha256').update(JSON.stringify(sorted(items))).digest('hex').slice(0,16);
export function readBank(file=BANK_FILE){const text=readFileSync(file,'utf8');return {text,bank:JSON.parse(text)};}
// 공개 사본: 초안·보류 문항과 검수 기록(검수 모델·때·보고·메모)은 원본에만 둔다. contentHash는 이 통과 문항의 지문이라 서버 사본과 맞는다.
export const publicBank=bank=>({...bank,items:bank.items.filter(item=>item?.review?.status==='passed').map(item=>({...item,review:{status:'passed'}}))});
export const servedHash=bank=>bankHash(publicBank(bank).items);
export function talkModule(bank){
 const served=publicBank(bank).items,hash=bankHash(served);
 return `'use strict';\n// 생성물 — SYNK-appsscript tools/build-world-writing-items.mjs가 experiences/synk-world-app/world-writing-items.json에서 만든다. 손으로 고치지 않는다.\n// 검수를 통과해 화면에 나가는 문항만 싣는다. 화면이 보낸 bank_hash가 BANK_HASH와 다르면 함수는 ITEM_CHANGED로 막는다(화면과 서버가 다른 문항을 보는 중).\nconst BANK_VERSION = ${JSON.stringify(bank.version)};\nconst BANK_HASH = ${JSON.stringify(hash)};\nconst ITEMS = Object.freeze(${JSON.stringify(served)});\nmodule.exports = { BANK_VERSION, BANK_HASH, ITEMS };\n`;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),{text,bank}=readBank(),hash=servedHash(bank);
 if(args.includes('--write')){
  const next=/"contentHash": "[0-9a-f]*"/.test(text)?text.replace(/"contentHash": "[0-9a-f]*"/,`"contentHash": "${hash}"`):text.replace(/("basis": "[^"]*",)/,`$1\n  "contentHash": "${hash}",`);
  writeFileSync(BANK_FILE,next);console.log(`contentHash ${hash}`);
 }
 const talk=args.indexOf('--talk');
 if(talk>=0){const dir=args[talk+1];if(!dir)throw new Error('--talk 다음에 SYNK-talk 폴더를 주세요');const out=join(resolve(dir),'lib/world-writing-items.js');writeFileSync(out,talkModule({...bank,contentHash:hash}));console.log(`wrote ${out}`);}
 if(args.includes('--check')||!args.length){
  const current=JSON.parse(readFileSync(BANK_FILE,'utf8')).contentHash;
  if(current!==hash){console.error(`contentHash가 낡았어요: 파일 ${current} · 내용 ${hash}. --write로 고친 뒤 --talk로 서버 사본도 다시 만드세요.`);process.exit(1);}
  console.log(`contentHash ${hash} 맞음`);
 }
}
