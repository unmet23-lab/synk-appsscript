#!/usr/bin/env node
// 공개 WORLD 「TOPIK 문항 은행」(experiences/synk-world-app/world-topik-items.json)을 문항 묶음(experiences/topik-items)에서 만든다.
//   node tools/build-world-topik-items.mjs --write   지금 문항 묶음으로 다시 쓴다
//   node tools/build-world-topik-items.mjs --check   파일이 문항 묶음과 같은지만 본다(시험 qa/world-topik-items.test.mjs가 같은 일을 한다)
// 화면(짧은 진단·짧은 연습·시험 형식 연습)은 이 파일을 필요할 때 불러온다 — 계정 묶음에 문항을 싣지 않는다(문항이 늘면 묶음이 커진다).
// 싣는 것: AI 2중 검수를 통과한(reviewStatus "ai-reviewed") 문항만, 화면이 쓰는 칸만. 검수 기록(검수한 모델·날짜·보고)·목소리 이름·
// 초안·보류 문항은 원본에만 둔다(synk.im에는 AI 도구 이름을 두지 않는다). 듣기는 소리가 준비된(status "ready") 문항만.
// 문항의 개념(conceptIds)은 WORLD 코치 지도(world-learning-map.mjs)에 있는 것만 남긴다 — 지도에 없는 개념을 기록하면 코치가 거절한다.
// 검수 「반영」으로 통과 문항이 바뀌면 같은 커밋에서 --write를 한 번 돌린다(세션 ② 문항 길 5번).
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {ALL_ITEMS} from '../experiences/topik-items/bank.mjs';
import {worldMap} from '../experiences/synk-world-app/world-learning-map.mjs';
import TOPIK_TYPES from '../strata/topik-types.json' with {type:'json'};

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const TOPIK_BANK_FILE=join(root,'experiences/synk-world-app/world-topik-items.json');
export const TOPIK_BANK_VERSION='world-topik-items-1';
const sorted=value=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,sorted(value[key])])):value;
const hashOf=items=>createHash('sha256').update(JSON.stringify(sorted(items))).digest('hex').slice(0,16);
const known=id=>{const node=worldMap.getNode(id);return !!node&&node.kind!=='skill';};

// 화면이 쓰는 칸만(문항 묶음 schema.json의 이름 그대로). 세트는 {id, order, size — 원본 세트의 문항 수(통과하지 않은 문항 포함)},
// 소리는 파일·허용 재생 수·길이만. 시험 형식 연습은 세트의 모든 문항이 통과했을 때만 세트를 통째로 낸다.
export function publicItem(item,{setSize=null}={}){
 return {id:item.id,rev:item.rev,family:item.family,exam:item.exam,format:item.format,section:item.section,officialType:item.officialType,
  targetGrade:item.targetGrade??null,skillId:item.skillId,difficulty:item.difficulty,responseFormat:item.responseFormat,
  set:item.set?{id:item.set.id,order:item.set.order,size:setSize}:null,passage:item.passage??null,
  script:Array.isArray(item.script)?item.script.map(line=>({speaker:line.speaker,text:line.text})):null,
  question:item.question,choices:[...item.choices],answer:item.answer,explanation:{...item.explanation},choiceNotes:[...(item.choiceNotes||[])],
  conceptIds:(item.conceptIds||[]).filter(known),
  audio:item.audio?{file:item.audio.file,plays:item.audio.plays,seconds:item.audio.seconds??null}:null};
}
// 시험 형식 연습이 쓰는 실제 구성(PBT): 영역마다 공식 문항 수·시간, 공식 유형을 번호 순서로(세트 이름, 듣기는 허용 재생 수).
// 원천은 strata/topik-types.json(공식 유형 대응표). IBT는 번호별 유형 배치·재생 횟수가 확인 전이라 싣지 않는다.
export function examForms(types=TOPIK_TYPES){
 return Object.fromEntries(Object.entries(types.exams).map(([exam,info])=>[exam,{grades:[...info.grades],
  pbt:Object.fromEntries(Object.entries(info.pbt).filter(([,value])=>value&&Number.isInteger(value.items)&&Number.isInteger(value.minutes)).map(([section,value])=>[section,{items:value.items,minutes:value.minutes}])),
  types:types.types.filter(row=>row.exam===exam).sort((a,b)=>a.numbers[0]-b.numbers[0]||(a.section<b.section?-1:1))
   .map(row=>({id:row.id,section:row.section,from:row.numbers[0],to:row.numbers[1],set:row.set||null,...(Number.isInteger(row.plays)?{plays:row.plays}:{})}))}]));
}
export function publicTopikBank(items=ALL_ITEMS,{types=TOPIK_TYPES}={}){
 const plays=new Map(types.types.filter(row=>Number.isInteger(row.plays)).map(row=>[row.id,row.plays]));
 // 소리 파일의 허용 재생 수는 공식 유형의 재생 수와 같아야 한다(화면은 이 수만큼 혼자 들은 것으로 센다).
 for(const item of items)if(item.reviewStatus==='ai-reviewed'&&item.section==='listening'&&item.audio&&item.audio.plays!==plays.get(item.officialType))
  throw new Error(`${item.id}: 소리 허용 재생 ${item.audio.plays}회가 공식 유형 ${item.officialType}의 ${plays.get(item.officialType)}회와 달라요`);
 const open=items.filter(item=>item.reviewStatus==='ai-reviewed'&&(item.section!=='listening'||item.audio?.status==='ready'&&typeof item.audio.file==='string'))
  .filter(item=>worldMap.getNode(item.skillId)?.kind==='skill')
  .map(item=>publicItem(item,{setSize:item.set?items.filter(other=>other.set?.id===item.set.id).length:null}));
 return {version:TOPIK_BANK_VERSION,basis:'experiences/topik-items의 AI 2중 검수 통과 문항(tools/build-world-topik-items.mjs가 만든다 · 손으로 고치지 않는다)',
  contentHash:hashOf(open),forms:examForms(types),items:open};
}
// 문항 한 줄에 하나(바뀐 문항만 차이로 보이고, 들여쓰기로 파일이 커지지 않게).
export const bankText=(bank=publicTopikBank())=>{const {items,...head}=bank;return `${JSON.stringify(head).slice(0,-1)},"items":[\n${items.map(item=>JSON.stringify(item)).join(',\n')}\n]}\n`;};
const sameText=(a,b)=>a.replace(/\r\n/g,'\n')===b.replace(/\r\n/g,'\n');
export function bankCurrent(file=TOPIK_BANK_FILE){return existsSync(file)&&sameText(readFileSync(file,'utf8'),bankText());}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),bank=publicTopikBank();
 const tally=bank.items.reduce((acc,item)=>{const key=`${item.exam} ${item.section}`;acc[key]=(acc[key]||0)+1;return acc;},{});
 if(args.includes('--write')){writeFileSync(TOPIK_BANK_FILE,bankText(bank));console.log(`world-topik-items.json ${bank.contentHash} · ${JSON.stringify(tally)}`);}
 else{
  if(!bankCurrent()){console.error('world-topik-items.json이 문항 묶음과 달라요. node tools/build-world-topik-items.mjs --write로 다시 만드세요.');process.exit(1);}
  console.log(`world-topik-items.json 맞음 ${bank.contentHash} · ${JSON.stringify(tally)}`);
 }
}
