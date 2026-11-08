// 생활 한국어 문항의 엔진 정체(Atlas × WORLD 2단계 D, 2026-11-08): 문항 id · itemKey · 계열(familyKey)과 측정 칸.
// 측정 칸(능력 · 난도 · 꼴 · 장면)은 Strata 대응표(strata/world-life.js lifeMeasure) 그대로, 계열은 「한 문항의 답이 다른 문항의 답을 알려 주는가」의
// 연결 덩어리다(설계 3판 — 다시 검수 GPT GA1 · GA2 · 그록 KA1 · Fable FA2 뒤 규칙을 덩어리로 다시 정함). 원고 132문항 사이의 연결은 셋:
//  ① 새 상황 복습의 보기 셋이 본문항과 같은 묶음(순서만 다름) — 보기 변형(원고 66쌍 가운데 9쌍)
//  ② 같은 표현의 낱말 뜻 · 문형(vocabulary · grammar) 문항끼리 — 그 표현을 알면 답이 나온다(「안녕하세요」를 고르는 여섯 문항)
//  ③ 정답 글(띄어쓰기 · 문장부호 뺌)이 같은 문항끼리 — 표현 · 능력이 달라도(「포장해 주세요」를 묻는 이야기 문항과 고르기 문항,
//    「차가운 주스 한 잔 주세요」가 정답인 취향 · 품절 복습)
// 덩어리에 낱말 뜻 · 문형 문항이 있으면 life.expr.<원고 차례로 처음 그런 문항의 표현>, 없으면 life.ans.<덩어리 첫 문항의 정답 지문>.
// 정답 · 보기가 바뀐 새 상황 복습은 다른 연결이 없으면 새 계열이다. 측정 문항 117개 → 계열 66개(장면 문항도 덩어리에 들어 그 답을 본 뒤는 반복).
// 거울(life-trail.mjs) · 홈 후보(world-learning-plan.mjs) · 재확인 공급(life-followups.mjs) · 문항 검수(tools/topik-review.mjs)가 모두 이 함수를 쓴다.
// 순수 함수다 — 기록 · 화면 · 저장을 모른다.
import worldLife from '../../strata/world-life.js';
import {PACKS} from './life-content.mjs';
import verdicts from '../topik-items/review/existing-verdicts.json' with {type:'json'};

export const LIFE_GAME_ID='world-life';
const KNOWLEDGE=new Set(['ko.reading.vocabulary','ko.reading.grammar']);
// 정답 글 지문: 띄어쓰기 · 문장부호를 뺀 글의 FNV-1a 32비트(Atlas 식별자에는 한글을 쓰지 않는다).
const normalize=text=>String(text??'').normalize('NFC').replace(/[\s.,?!·…~'"‘’“”]+/g,'');
function fingerprint(text){let h=2166136261;for(const c of normalize(text))h=Math.imul(h^c.codePointAt(0),16777619)>>>0;return h.toString(16).padStart(8,'0');}
const answerText=item=>item?.choices?.find(choice=>choice.id===item.answerId)?.text??'';
const choiceSet=item=>JSON.stringify((item?.choices||[]).map(choice=>normalize(choice.text)).sort());
// 보기 셋이 본문항과 같은 묶음인 복습(순서만 바꾼 보기 변형).
export const sameChoices=question=>!!question?.review&&choiceSet(question)===choiceSet(question.review);
// 원고 전체의 계열 표(itemKey → familyKey). 원고 차례(팩 → 레슨 → 본문항 → 그 복습)로 한 번 만든다.
let FAMILY=null;
function familyTable(){
 if(FAMILY)return FAMILY;
 const rows=[];
 for(const pack of PACKS)for(const lesson of pack.lessons)for(const question of lesson.questions)for(const review of [false,true]){
  const item=review?question.review:question,measure=item&&worldLife.lifeMeasure({skillId:question.skillId,questionId:question.id,lessonId:lesson.id,review});
  if(!measure||typeof item.id!=='string')continue;
  rows.push({key:`life.${item.id}`,answer:normalize(answerText(item)),expression:question.expressionId,knowledge:KNOWLEDGE.has(measure.skillId),
   main:!review||sameChoices(question)?question.id:null});
 }
 // 덩어리 묶기: 뿌리는 늘 원고 차례로 앞선 문항이다.
 const parent=rows.map((_,index)=>index),first=new Map();
 const find=index=>{while(parent[index]!==index){parent[index]=parent[parent[index]];index=parent[index];}return index;};
 const link=(name,index)=>{if(!first.has(name)){first.set(name,index);return;}const a=find(first.get(name)),b=find(index);if(a!==b)parent[Math.max(a,b)]=Math.min(a,b);};
 rows.forEach((row,index)=>{
  if(row.answer)link(`answer:${row.answer}`,index);
  if(row.knowledge)link(`expression:${row.expression}`,index);
  if(row.main)link(`main:${row.main}`,index);
 });
 const naming=new Map();
 rows.forEach((row,index)=>{const root=find(index);if(!naming.has(root))naming.set(root,null);if(row.knowledge&&naming.get(root)===null)naming.set(root,`life.expr.${row.expression}`);});
 FAMILY=new Map(rows.map((row,index)=>{const root=find(index);return [row.key,naming.get(root)||`life.ans.${fingerprint(rows[root].answer)}`];}));
 return FAMILY;
}

// 한 문항(본문항 또는 그 새 상황 복습)의 엔진 정체. 대응표에 없는 문항이면 null(지어내지 않는다).
export function lifeItem({lesson,question,review=false}={}){
 const item=review?question?.review:question;
 if(!lesson||!question||!item||typeof item.id!=='string')return null;
 const measure=worldLife.lifeMeasure({skillId:question.skillId,questionId:question.id,lessonId:lesson.id,review});
 if(!measure)return null;
 const key=`life.${item.id}`;
 // 원고 밖 문항(시험이 만든 꼴)은 자기 정답 글 하나로 계열을 잡는다.
 const familyKey=familyTable().get(key)||(KNOWLEDGE.has(measure.skillId)?`life.expr.${question.expressionId}`:`life.ans.${fingerprint(answerText(item))}`);
 return Object.freeze({id:key,itemKey:key,familyKey,...measure,lessonId:lesson.id,questionId:question.id,review,packId:lesson.packId??null});
}

// 원고 전체의 문항 정체(차례: 팩 → 레슨 → 본문항 → 그 복습). 시험 · 검수 · 계열 대조가 쓴다.
let ALL=null;
export function lifeItems(){
 if(ALL)return ALL;
 const out=[];
 for(const pack of PACKS)for(const lesson of pack.lessons)for(const question of lesson.questions)for(const review of [false,true]){
  const row=lifeItem({lesson:{...lesson,packId:pack.id},question,review});if(row)out.push(row);
 }
 return ALL=Object.freeze(out);
}
// 같은 계열의 문항들(제품 이력 대조 · 재확인 공급이 쓴다).
let FAMILIES=null;
export function lifeFamilyMembers(familyKey){
 if(!FAMILIES){FAMILIES=new Map();for(const row of lifeItems()){if(!FAMILIES.has(row.familyKey))FAMILIES.set(row.familyKey,[]);FAMILIES.get(row.familyKey).push(row);}}
 return FAMILIES.get(familyKey)||[];
}

// 판정 자격(D 설계 §4-2 ③): AI 2중 검수가 pass이고 검수가 확인한 능력 · 난도 · 꼴이 지금 정체와 같고, 읽기 영역 · 소리 없음 · 장면 아님.
// 계열은 검수가 보는 칸이 아니라(문항 지문 해시에 없다) 위 규칙이 정한다 — 규칙을 고쳐도 검수를 다시 받지 않는다. 원고가 바뀌면
// tests/world-life-review.test.mjs가 통과 기록의 지문과 견줘 잡는다.
// 판정 목록(existing-verdicts.json)을 묶음에는 판정 칸만 싣는다(tools/lib/world-verdicts.mjs). 목록을 못 읽으면 하나도 자격이 없다.
const VERDICT_VERSION='topik-existing-verdicts-1';
let PASSED=null;
function passedRows(){
 if(PASSED)return PASSED;
 const rows=new Map(),conflicted=new Set();
 if(verdicts?.version===VERDICT_VERSION&&Array.isArray(verdicts.items))for(const row of verdicts.items){
  if(typeof row?.itemKey!=='string'||!row.itemKey.startsWith('life.'))continue;
  if(rows.has(row.itemKey))conflicted.add(row.itemKey);rows.set(row.itemKey,row);
 }
 for(const key of conflicted)rows.delete(key);
 return PASSED=rows;
}
export function lifeAssessable(item){
 if(!item||item.confounded||item.audioRequired||item.modality!=='reading'||item.skillId.split('.')[1]!=='reading')return false;
 const row=passedRows().get(item.itemKey);
 return !!row&&row.verdict==='pass'&&row.skillId===item.skillId&&row.difficulty===item.difficulty&&(row.responseFormat??'unknown')===item.responseFormat;
}

// Core에 넘기는 측정(코치 present의 문항 꼴).
export function lifeMeasureItem(item){
 return {id:item.id,itemKey:item.itemKey,familyKey:item.familyKey,skillId:item.skillId,modality:item.modality,difficulty:item.difficulty,
  responseFormat:item.responseFormat,audioRequired:item.audioRequired,confounded:item.confounded};
}
// 홈 후보의 target 꼴(Core recommendActivities). familyKeys(다 쓴 활동 판정)는 넘기지 않는다 — D 설계 §4-3.
export function lifeTarget(item){
 return {id:item.id,skillIds:[item.skillId],difficulty:item.difficulty,modality:item.modality,responseFormat:item.responseFormat,
  itemKey:item.itemKey,familyKey:item.familyKey,conceptIds:[]};
}
