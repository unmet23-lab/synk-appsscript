#!/usr/bin/env node
// WORLD 학습 알림 계획기(experiences/synk-world-app/world-reminders.mjs)를 SYNK-talk 서버 사본으로 옮긴다 — 2단(앱을 닫아도 받기)에서
// world-push·world-push-send 함수가 기기와 같은 규칙으로 돌게(설계 experiences/synk-world-app/qa/push-reminders-20261022/설계.md §5-1).
//   node tools/build-world-reminders-talk.mjs --talk <talk 폴더>           그 저장소의 lib/world-reminders.js를 다시 쓴다
//   node tools/build-world-reminders-talk.mjs --talk <talk 폴더> --check   사본이 지금 원본에서 만든 것과 같은지만 본다(talk 시험이 같은 일을 한다)
// · 원본은 import 없는 순수 함수 파일이다. talk 함수 동봉은 CommonJS lib만 감싸므로 맨 앞의 `export`만 벗기고 이름을 module.exports에 모은
//   사본을 둔다(tools/build-world-speaking-talk.mjs의 피드백 핵심과 같은 꼴). 사본은 손으로 고치지 않는다 — 원본을 고친 뒤 이 도구로 다시 만든다.
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const SOURCE_FILE=join(root,'experiences/synk-world-app/world-reminders.mjs');
export const TALK_FILE='lib/world-reminders.js';
const lf=text=>String(text).replace(/\r\n/g,'\n');

/** 계획기(ESM)를 CommonJS로 — 맨 앞의 `export const|function`만 벗긴다. import나 다른 export 꼴이 있으면 멈춘다(서버 사본은 다른 파일을 싣지 않는다). */
export function remindersModule(source=readFileSync(SOURCE_FILE,'utf8')){
 const text=lf(source);
 if(/^\s*import\s/m.test(text))throw new Error('world-reminders.mjs가 import를 쓴다 — 서버 사본은 다른 파일을 싣지 않는다');
 const names=[];
 const body=text.replace(/^export (const|function|async function) ([A-Za-z_$][\w$]*)/gm,(_,kind,name)=>{names.push(name);return `${kind} ${name}`;});
 if(/^\s*export\b/m.test(body))throw new Error('world-reminders.mjs에 옮기지 못하는 export 꼴이 있다(export { … }·export default 등)');
 if(!names.length)throw new Error('world-reminders.mjs에서 export를 찾지 못했다');
 const hash=createHash('sha256').update(text).digest('hex').slice(0,16);
 return `'use strict';\n// 생성물 — SYNK-appsscript tools/build-world-reminders-talk.mjs가 experiences/synk-world-app/world-reminders.mjs(ESM, 원본 지문 ${hash})를 CommonJS로 옮겼다. 손으로 고치지 않는다.\n${body.replace(/\n*$/,'\n')}\nmodule.exports = { ${names.join(', ')} };\n`;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),talk=args.indexOf('--talk');
 if(args.some(arg=>arg.startsWith('--')&&!['--talk','--check'].includes(arg)))throw new Error('알 수 있는 플래그는 --talk <폴더>와 --check뿐이다');
 const dir=talk>=0?args[talk+1]:null;
 if(!dir||dir.startsWith('--'))throw new Error('--talk 다음에 SYNK-talk 폴더를 주세요');
 const file=join(resolve(dir),TALK_FILE),content=remindersModule();
 if(args.includes('--check')){
  let now='';try{now=lf(readFileSync(file,'utf8'));}catch{}
  if(now!==content){console.error(`낡음: ${TALK_FILE} — node tools/build-world-reminders-talk.mjs --talk ${dir}로 다시 만드세요`);process.exit(1);}
  console.log(`같음: ${TALK_FILE}`);
 }else{writeFileSync(file,content);console.log(`wrote ${file}`);}
}
