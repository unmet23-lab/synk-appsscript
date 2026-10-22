// 공개 TOPIK 은행(world-topik-items.json — AI 2중 검수를 통과한 문항만, tools/build-world-topik-items.mjs)을 화면 문항 꼴로 바꾸고
// 필요할 때 한 번 불러온다(2026-10-21 ④). 계정·생활 묶음에 문항을 싣지 않는다 — 문항이 늘어도 묶음이 커지지 않게.
// 문항 꼴은 짧은 진단 문항(world-diagnostic-items.mjs)과 같은 이름의 칸이라 진단·짧은 연습·시험 형식 연습이 함께 쓴다.
// itemKey·familyKey는 문항 묶음(experiences/topik-items/bank.mjs itemKeyOf·familyKeyOf)과 같다 — 내용을 고쳐 판(rev)이 오르면
// 새 문항이 되고, 같은 계열은 판이 달라도 「이미 본 문항」이다. 해설은 화면 언어별(ko·en·mn)로 온다(문항·보기는 늘 한국어).

const tiRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const tiShort=(text,max=26)=>{const value=String(text||'').replace(/\s+/g,' ').trim();return value.length>max?`${value.slice(0,max-1)}…`:value;};
const SKILL=/^ko2?\.(listening|reading)\.[a-z]+$/;

// 한 문항 → 화면 꼴. 소리는 experiences/ 기준 자리(WORLD 공개본에서는 /world/ 아래 같은 자리 — topik-items/audio/…).
export function bankItem(row){
 if(!tiRecord(row)||typeof row.id!=='string'||!Number.isInteger(row.rev)||typeof row.family!=='string'||!SKILL.test(row.skillId||'')
  ||!['listening','reading'].includes(row.section)||row.skillId.split('.')[1]!==row.section||![1,2,3].includes(row.difficulty)
  ||!Array.isArray(row.choices)||row.choices.length<2||!Number.isInteger(row.answer)||row.answer<0||row.answer>=row.choices.length)return null;
 if(row.section==='listening'&&(!tiRecord(row.audio)||typeof row.audio.file!=='string'))return null;
 const itemKey=`topik-items.${row.id}.v${row.rev}`,ids=row.choices.map((_,index)=>`${itemKey}.option-${index}`);
 const opening=row.passage||(Array.isArray(row.script)?row.script.map(line=>line.text).join(' '):'')||row.question;
 return Object.freeze({id:row.id,itemKey,familyKey:`topik-items.${row.family}`,skillId:row.skillId,modality:row.section,difficulty:row.difficulty,
  responseFormat:row.responseFormat||'single-choice',audioRequired:row.section==='listening',confounded:false,conceptIds:Object.freeze([...(row.conceptIds||[])]),
  source:'topik-items',exam:row.exam,form:row.format||'pbt',officialType:row.officialType,targetGrade:row.targetGrade??null,
  setId:row.set?.id||null,setOrder:row.set?.order??null,setSize:row.set?.size??null,
  audio:row.section==='listening'?`topik-items/${row.audio.file}`:null,plays:row.section==='listening'?row.audio.plays:null,seconds:row.audio?.seconds??null,
  prompt:row.passage||null,script:Array.isArray(row.script)?Object.freeze(row.script.map(line=>Object.freeze({speaker:line.speaker,text:line.text}))):null,
  question:row.question,choices:Object.freeze(row.choices.map((label,index)=>Object.freeze({id:ids[index],label}))),correctId:ids[row.answer],
  explanation:Object.freeze({...row.explanation}),choiceNotes:Object.freeze([...(row.choiceNotes||[])]),label:tiShort(opening)});
}
export function bankItems(bank){
 if(!tiRecord(bank)||!Array.isArray(bank.items))return Object.freeze([]);
 const out=[],ids=new Set();
 for(const row of bank.items){const item=bankItem(row);if(item&&!ids.has(item.id)){ids.add(item.id);out.push(item);}}
 return Object.freeze(out);
}

// 은행 한 벌을 들고 있는 곳. 처음 부를 때 한 번 불러오고(실패하면 다음에 다시), 다 불러오면 알린다.
// use(bank): 시험·생활 묶음이 이미 가진 은행을 바로 쓸 때.
export function createTopikBank({fetcher=(...args)=>globalThis.fetch(...args)}={}){
 let state={bank:null,items:Object.freeze([]),byId:new Map(),byKey:new Map()},loading=null;const listeners=new Set();
 function use(bank){
  const items=bankItems(bank);
  state={bank:tiRecord(bank)?{version:bank.version||null,contentHash:bank.contentHash||null,forms:tiRecord(bank.forms)?bank.forms:{}}:null,items,
   byId:new Map(items.map(item=>[item.id,item])),byKey:new Map(items.map(item=>[item.itemKey,item]))};
  for(const listener of listeners){try{listener(state);}catch{/* a screen that cannot redraw keeps its old view */}}
  return items;
 }
 function load(url){
  if(state.bank)return Promise.resolve(state.items);
  loading||=Promise.resolve().then(()=>fetcher(url,{cache:'no-cache'})).then(response=>{if(!response?.ok)throw Error('TOPIK_BANK');return response.json();})
   .then(bank=>{if(!tiRecord(bank)||!Array.isArray(bank.items))throw Error('TOPIK_BANK');return use(bank);})
   .catch(error=>{loading=null;throw error;});
  return loading;
 }
 return Object.freeze({use,load,
  get ready(){return !!state.bank;},
  // 은행 판 지문(contentHash) — 싱크타운 입장 확인이 서버 사본과 같은 판인지 견줄 때 보낸다.
  get hash(){return state.bank?.contentHash||null;},
  get items(){return state.items;},
  get forms(){return state.bank?.forms||{};},
  byId:id=>state.byId.get(id)||null,
  // 근거 줄의 문항 첫머리(판이 달라도 같은 문항이면 찾는다 — itemKey는 topik-items.<id>.v<판>).
  label(itemKey){const key=String(itemKey||''),match=/^topik-items\.(.+)\.v\d+$/.exec(key);return (state.byKey.get(key)||(match?state.byId.get(match[1]):null))?.label??null;},
  subscribe(listener){listeners.add(listener);return ()=>listeners.delete(listener);}});
}
