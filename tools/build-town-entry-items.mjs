#!/usr/bin/env node
// 싱크타운 입장 판정(town-entry-r1, docs/디자인/싱크타운_학습개인화다리_설계_20261022.md §4-1)이 세는 문항의 메타를
// SYNK-talk synk-town 함수가 쓰는 서버 사본(lib/town-entry-items.js)으로 만든다.
//   node tools/build-town-entry-items.mjs                    문항 수와 지문만 보인다
//   node tools/build-town-entry-items.mjs --talk <talk 폴더>   그 저장소의 lib/town-entry-items.js를 다시 쓴다
//   node tools/build-town-entry-items.mjs --check <talk 폴더>  그 사본이 지금 내용과 같은지만 본다
// 세는 문항은 AI 2중 검수를 통과한 보기 넷 이상의 선택형뿐이다 — 공개 TOPIK 은행(world-topik-items.json, 통과 문항만 실린다)과
// 「내 위치」 진단 풀에 함께 드는 판정 통과 기존 게임 문항. 보기 셋(싱크타운 읽기 확인·레이싱 낱말)과 O/X는 찍어서 맞힐 확률이 높아 넣지 않는다.
// 서버는 기기가 매긴 맞고 틀림을 믿지 않고 이 사본의 정답 보기 id로 다시 매긴다. 정답과 문항은 이미 공개본에 있는 값이다.
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {bankItems} from '../experiences/synk-world-app/world-topik-items.mjs';
import {DIAGNOSTIC_ITEMS} from '../experiences/synk-world-app/world-diagnostic-items.mjs';
import {passedItems} from '../experiences/synk-world-app/world-reading-practice.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const BANK_FILE=join(root,'experiences/synk-world-app/world-topik-items.json');
const VERDICTS_FILE=join(root,'experiences/topik-items/review/existing-verdicts.json');
export const VERSION='town-entry-items-1';
export const MIN_CHOICES=4;
// world-position-kit.mjs와 같다 — 판정을 통과해도 시험 꼴이 아닌 게임 문항(행동 지시문·물음 없는 O/X)은 진단에 내지 않는다.
const NOT_EXAM_FORM=new Set(['korean-runner','korean-rhythm']);
const examOf=skillId=>String(skillId).startsWith('ko2.')?'topik-ii':'topik-i';
// 한 문항 → [itemKey, familyKey, 시험, 영역, 난도, 정답 보기 id]. 화면 문항 꼴(bankItem·진단 문항)에서 읽는다.
const row=item=>[item.itemKey,item.familyKey||item.itemKey,item.exam==='topik-ii'||item.exam==='topik-i'?item.exam:examOf(item.skillId),item.modality,item.difficulty,item.correctId];
export function entryItems({bank=JSON.parse(readFileSync(BANK_FILE,'utf8')),verdicts=JSON.parse(readFileSync(VERDICTS_FILE,'utf8'))}={}){
 const counted=item=>Array.isArray(item?.choices)&&item.choices.length>=MIN_CHOICES&&item.choices.some(choice=>choice.id===item.correctId);
 const games=passedItems({items:DIAGNOSTIC_ITEMS,verdicts,modalities:['listening','reading']}).filter(item=>!NOT_EXAM_FORM.has(item.source));
 const rows=new Map();
 for(const item of [...bankItems(bank),...games])if(counted(item)&&!rows.has(item.itemKey))rows.set(item.itemKey,row(item));
 const items=[...rows.values()].sort((a,b)=>a[0].localeCompare(b[0]));
 return {version:VERSION,bankHash:bank.contentHash||null,metaHash:createHash('sha256').update(JSON.stringify(items)).digest('hex').slice(0,16),items};
}
export function talkModule(meta=entryItems()){
 return `'use strict';\n// 생성물 — SYNK-appsscript tools/build-town-entry-items.mjs가 공개 TOPIK 은행과 판정 통과 기존 게임 문항에서 만든다. 손으로 고치지 않는다.\n`
  +`// 싱크타운 입장 판정(town-entry-r1)이 세는 보기 넷 이상의 선택형 문항: [itemKey, familyKey, 시험, 영역, 난도, 정답 보기 id].\n`
  +`// 화면이 보낸 은행 지문이 BANK_HASH와 다르고 판정에 모르는 문항이 섞이면 서버는 판정을 미룬다(lib/town-entry-check.js).\n`
  +`const VERSION = ${JSON.stringify(meta.version)};\nconst BANK_HASH = ${JSON.stringify(meta.bankHash)};\nconst META_HASH = ${JSON.stringify(meta.metaHash)};\n`
  +`const ITEMS = Object.freeze(${JSON.stringify(meta.items)}.map(Object.freeze));\nmodule.exports = { VERSION, BANK_HASH, META_HASH, ITEMS };\n`;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),meta=entryItems(),flag=name=>{const at=args.indexOf(name);if(at<0)return null;if(!args[at+1])throw new Error(`${name} 다음에 SYNK-talk 폴더를 주세요`);return join(resolve(args[at+1]),'lib/town-entry-items.js');};
 const count=exam=>meta.items.filter(item=>item[2]===exam).length;
 console.log(`${meta.version} · 문항 ${meta.items.length}(TOPIK I ${count('topik-i')} · TOPIK II ${count('topik-ii')}) · 은행 ${meta.bankHash} · 메타 ${meta.metaHash}`);
 const out=flag('--talk');if(out){writeFileSync(out,talkModule(meta));console.log(`wrote ${out}`);}
 const check=flag('--check');
 if(check){let text='';try{text=readFileSync(check,'utf8').replace(/\r\n/g,'\n');}catch{}if(text!==talkModule(meta)){console.error(`서버 사본이 낡았어요: ${check}. --talk로 다시 만드세요.`);process.exit(1);}console.log('서버 사본 같음');}
}
