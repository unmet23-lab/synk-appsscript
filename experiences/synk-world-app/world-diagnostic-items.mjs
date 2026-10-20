// WORLD 짧은 진단에 낼 수 있는 기존 TOPIK형 문항(2026-10-19 「WORLD 내 위치」). 새 문항을 쓰지 않는다 —
// 각 게임의 원고와 그 게임의 Atlas 메타 함수를 그대로 써서 itemKey·familyKey가 게임과 같다. 그래서 진단에서 본 문항은
// 그 게임에서도 「이미 본 문항」이고(atlas/game-learning.js exposure), 게임에서 본 문항은 진단에 다시 나오지 않는다.
// 모두 교원 검수 전 자체 창작 초안이다(각 원고 머리 주석). 보기 순서만 정하고 내용·정답은 바꾸지 않는다.
import {LISTENING_CHECKS,checkMetadata} from '../korean-runner/listening-check.mjs';
import {TRACKS} from '../korean-rhythm/core.mjs';
import {rhythmItem} from '../korean-rhythm/personalization.mjs';
import {NARRATION} from '../korean-rhythm/narration.mjs';
import {ITEMS as BLANKS} from '../blank-slice/content.mjs';
import {itemMetadata as blankMetadata} from '../blank-slice/learning.mjs';
import {READING_CHECKS,readingMetadata} from '../synk-town/understanding.mjs';
import {VENUES,ITEMS as BAGGAGE,CAST} from '../entry-check/content.mjs';
import {caseMetadata} from '../entry-check/learning.mjs';
import {activeRules,choicesFor} from '../entry-check/core.mjs';

// ask: 문항 내용이 아니라 할 일을 말하는 지시(빈칸 고르기·손님 들이기). 화면이 화면 언어로 보인다(position.diagnostic.ask.*,
// 생활 레슨의 문제 지시와 같다). 싱크타운 읽기의 물음은 읽을 내용이라 한국어 그대로다.
// 정답 자리가 문항마다 달라지게, 문항 id로 늘 같은 순서를 만든다(위치로 답이 드러나지 않게 — 학습기준 §4-2).
function diagSeeded(id){let h=2166136261;for(const c of String(id))h=Math.imul(h^c.codePointAt(0),16777619)>>>0;return ()=>{h=(h+0x6d2b79f5)>>>0;let t=Math.imul(h^(h>>>15),1|h);t^=t+Math.imul(t^(t>>>7),61|t);return((t^(t>>>14))>>>0)/4294967296;};}
function diagArrange(id,values){const next=diagSeeded(id),out=[...values];for(let i=out.length-1;i>0;i--){const j=Math.floor(next()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
const diagShort=(text,max=26)=>{const value=String(text||'').replace(/\s+/g,' ').trim();return value.length>max?`${value.slice(0,max-1)}…`:value;};

// 바람길 듣기 확인 12: 끝까지 들은 뒤 행동 셋 중 고르기(듣기 세부·부정·순서). 소리는 그 게임의 녹음.
function diagRunnerItems(){
 return LISTENING_CHECKS.map(item=>{const meta=checkMetadata(item);
  return {...meta,source:'korean-runner',audio:`korean-runner/assets/voice/${item.id}.mp3`,prompt:null,question:null,
   choices:item.choices.map((label,index)=>({id:item.choiceIds[index],label})),correctId:item.choiceIds[item.correct],
   explanation:item.explanation,label:diagShort(item.text)};});
}
// 말의 리듬 15계열: 이야기를 듣고 묻는 말에 O/X. 한 계열의 두 갈래(claim0 = O, claim1 = X) 가운데 하나만 낸다 —
// 늘 같은 갈래면 답이 O로만 나오니 계열마다 정해진 갈래를 쓴다. recall은 같은 계열이라 쓰지 않는다.
function diagRhythmItems(){
 return TRACKS.flatMap(track=>track.questions.map((question,index)=>{
  const family=rhythmItem(track.id,{sourceIndex:index}).familyKey,variant=diagSeeded(family)()<.5?0:1;
  const meta=rhythmItem(track.id,{sourceIndex:index,variant}),voice=NARRATION[`t${track.id}q${index}v${variant}`],claim=question.claims[variant];
  if(!voice)return null;
  const o='korean-rhythm.o',x='korean-rhythm.x';
  return {...meta,source:'korean-rhythm',audio:`korean-rhythm/${voice.url}`,prompt:null,question:null,
   choices:[{id:o,label:'O · 맞아요'},{id:x,label:'X · 아니에요'}],correctId:claim.answer==='O'?o:x,explanation:question.explanation,label:diagShort(claim.question)};
 }).filter(Boolean));
}
// 빈칸 베기 36: 빈칸에 맞는 낱말·조사·문형 넷 중 하나(읽기 낱말·문형). 원고는 첫 보기가 정답이라 순서를 섞는다.
function diagBlankItems(){
 return BLANKS.map(item=>{const meta=blankMetadata(item),ids=item.options.map((_,index)=>`blank-slice.${item.id}.option-${index}`);
  const order=diagArrange(meta.itemKey,item.options.map((label,index)=>({id:ids[index],label})));
  return {...meta,source:'blank-slice',audio:null,prompt:item.text.replace('{}','(      )'),question:'빈칸에 알맞은 것을 고르세요.',ask:'blank',
   choices:order,correctId:ids[0],explanation:item.why,label:diagShort(item.text.replace('{}','( )'))};});
}
// 싱크타운 읽기 확인 18: 짧은 안내를 읽고 셋 중 고르기(읽기 세부·부정·순서). 보기 id는 타운과 같은 option-N.
function diagTownItems(){
 return READING_CHECKS.map(item=>({...readingMetadata(item),source:'synk-town',audio:null,prompt:item.passage,question:item.question,
  choices:item.choices.map((label,index)=>({id:`option-${index}`,label})),correctId:`option-${item.correct}`,explanation:item.explanation,label:diagShort(item.question)}));
}
// 입장 검사 중 글만으로 풀게 쓴 손님 16(textOnly): 안내문을 읽고 통과인지, 어긴 규칙이 무엇인지(읽기 세부·부정·조건).
// 보기는 그 게임처럼 「통과」 + 지금 적용되는 규칙(안내문 순서), 보기 id는 그 게임의 pass / reject-<규칙>.
function diagEntryItems(){
 return VENUES.flatMap(venue=>venue.cases.filter(item=>item.textOnly).map(item=>{
  const meta=caseMetadata(item),rules=activeRules(venue,item.at),id=choice=>choice==='pass'?'pass':`reject-${choice}`;
  const bag=(item.items||[]).map(entry=>Array.isArray(entry)?`${BAGGAGE[entry[0]]||entry[0]} ${entry[1]}개`:BAGGAGE[entry]||entry);
  return {...meta,source:'entry-check',audio:null,prompt:null,question:'이 손님을 들여보낼까요?',ask:'entry',
   card:{notice:{title:venue.notice.title,rules:rules.map(rule=>rule.text)},at:item.at,doc:{title:item.doc.title,rows:item.doc.rows.map(row=>[...row])},
    bag,line:item.line,who:CAST[item.who]?.name||''},
   choices:choicesFor(venue,item.at).map(choice=>({id:id(choice),label:choice==='pass'?'들여보내기':`돌려보내기 · ${rules.find(rule=>rule.id===choice)?.short||choice}`})),
   correctId:id(item.answer),explanation:item.why,label:`${venue.name} · ${CAST[item.who]?.name||item.id}`};
 }));
}

// 짧은 진단에서 고를 수 있는 전체 묶음. selectDiagnostic(world-position.mjs)이 항목마다 새 계열 하나를 고른다.
export const DIAGNOSTIC_ITEMS=Object.freeze([...diagRunnerItems(),...diagRhythmItems(),...diagBlankItems(),...diagTownItems(),...diagEntryItems()].map(item=>Object.freeze(item)));
// 이 묶음이 아직 다루지 못하는 TOPIK I 항목과 까닭(보고용). 문항을 새로 쓰면 학습기준 §4·§7 제작 기준을 따른다.
export const DIAGNOSTIC_GAPS=Object.freeze({
 'ko.listening.word':'낱말 듣기는 한국어 레이싱의 낱말 2,000개뿐이고 보기가 판마다 무작위다. 고정 보기와 레이싱 녹음을 WORLD에 실어야 한다.',
 'ko.reading.reason':'읽고 이유 이해하기에 맞는 문항이 없다(레이싱 c04의 이음말 빈칸은 이 항목의 뜻과 맞지 않는다).',
 'ko.reading.main':'읽고 핵심 이해하기에 맞는 문항이 없다(레이싱 c04q2는 이음말 빈칸이다).',
});
const diagByKey=new Map(DIAGNOSTIC_ITEMS.map(item=>[item.itemKey,item]));
// 근거 줄에 쓸 문항 첫머리(학습 내용이라 한국어 원문 그대로). 연습 이름은 화면이 화면 언어로 앞에 붙인다(world-position-ui.mjs).
// 진단 묶음에 없는 문항은 null(화면이 연습 이름만 쓴다).
export function diagnosticLabel(itemKey){
 const item=diagByKey.get(itemKey)||diagByKey.get(String(itemKey||'').replace(/:v\d+$/,''));
 return item?item.label:null;
}
