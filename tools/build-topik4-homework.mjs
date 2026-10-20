// TOPIK 4급 온라인 반 수업 자료(docs/온라인반_TOPIK4급)를 WORLD 「이번 주 과제」가 읽는 JSON 두 개로 옮긴다.
//  · experiences/synk-world-app/topik4-homework.json — 학생이 푸는 것(주차표, 쓰기 W1~W8의 문제·자료·쓸 칸, 읽기 R1~R8의 지문·보기). 답은 없다.
//  · experiences/synk-world-app/topik4-homework-key.json — 낸 뒤에 보는 것(읽기 정답·근거·오답 이유, 쓰기 예시답·인정 범위·채점에서 보는 것).
// 손으로 옮기지 않는다. 문서를 고치면 `node tools/build-topik4-homework.mjs`로 다시 만들고, `--check`(CI·시험)가 어긋남을 잡는다.
// 문서 꼴이 바뀌어 읽지 못하면 조용히 넘기지 않고 멈춘다. 「(같은 지문)」 문항은 지문을 다시 싣는다.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
export const HOMEWORK_SOURCES=Object.freeze({schedule:'docs/온라인반_TOPIK4급/README.md',writing:'docs/온라인반_TOPIK4급/쓰기과제.md',reading:'docs/온라인반_TOPIK4급/읽기연습.md',guide:'docs/온라인반_TOPIK4급/첨삭기준.md'});
export const HOMEWORK_TARGETS=Object.freeze({homework:'experiences/synk-world-app/topik4-homework.json',key:'experiences/synk-world-app/topik4-homework-key.json'});
// 한 주의 흐름(첨삭기준.md §6): 토요일 수업 끝에 내고 수요일 23:00 마감, 첨삭은 금요일까지. 시각은 한국 시간이다.
export const HOMEWORK_SCHEDULE=Object.freeze({weeks:8,dueWeekday:3,dueTime:'23:00',timeZone:'Asia/Seoul',utcOffset:'+09:00'});
const CIRCLED=['①','②','③','④'];

const fail=(message,where)=>{throw new Error(`TOPIK 4급 과제 변환: ${message}${where?` (${where})`:''}`);};
const lf=text=>String(text).replace(/\r\n?/g,'\n');
const sha256=text=>crypto.createHash('sha256').update(lf(text),'utf8').digest('hex');
// 글자 수: NFC 정규화 뒤 공백·문장부호를 넣고 줄바꿈을 뺀 Unicode 문자 수(tests/online-class-topik4.test.js와 같다).
export const homeworkLength=text=>[...lf(text).normalize('NFC').replace(/\n/g,'')].length;

// ── 줄 안의 꾸밈: **굵게**와 <u>밑줄</u>만 받는다. 줄은 [문자열 | {b} | {u}] 배열이다. ──
export function inline(text,where){
 const out=[];let last=0;
 for(const m of text.matchAll(/\*\*([^*]+?)\*\*|<u>([^<]+?)<\/u>/g)){
  if(m.index>last)out.push(text.slice(last,m.index));
  out.push(m[1]!==undefined?{b:m[1]}:{u:m[2]});last=m.index+m[0].length;
 }
 if(last<text.length)out.push(text.slice(last));
 for(const part of out)if(typeof part==='string'&&/\*\*|<\/?u>|\]\(|`/.test(part))fail('읽지 못하는 꾸밈 「'+text+'」',where);
 return out;
}
const plain=segments=>segments.map(s=>typeof s==='string'?s:s.b??s.u).join('');

// ── 블록: 빈 줄로 나뉜 문단(줄마다 그대로), 인용(>), 표(|), 목록(- ) ──
function tokenize(lines,where){
 const blocks=[];
 for(let i=0;i<lines.length;){
  const line=lines[i];
  if(!line.trim()){i++;continue;}
  if(line.startsWith('>')){const inner=[];for(;i<lines.length&&lines[i].startsWith('>');i++)inner.push(lines[i].replace(/^> ?/,''));blocks.push({kind:'quote',lines:inner});continue;}
  if(line.startsWith('|')){const rows=[];for(;i<lines.length&&lines[i].startsWith('|');i++)rows.push(lines[i]);blocks.push({kind:'table',rows});continue;}
  if(line.startsWith('- ')){const items=[];for(;i<lines.length&&lines[i].startsWith('- ');i++)items.push(lines[i].slice(2));blocks.push({kind:'list',items});continue;}
  if(/^#{1,6} /.test(line)||/^<a id=/.test(line))fail('과제 안에서 머리말·자리표를 만났다: '+line,where);
  const para=[];for(;i<lines.length&&lines[i].trim()&&!/^(?:>|\||- )/.test(lines[i]);i++)para.push(lines[i]);
  blocks.push({kind:'para',lines:para});
 }
 return blocks;
}
function table(rows,where,{raw=false}={}){
 const cells=row=>{if(!/^\|.*\|$/.test(row.trim()))fail('표 줄 꼴: '+row,where);return row.trim().slice(1,-1).split('|').map(c=>c.trim());};
 if(rows.length<3)fail('표가 짧다',where);
 const head=cells(rows[0]),rule=cells(rows[1]);
 if(rule.length!==head.length||!rule.every(c=>/^:?-{3,}:?$/.test(c)))fail('표 구분 줄 꼴',where);
 const body=rows.slice(2).map(cells);
 for(const row of body)if(row.length!==head.length)fail('표 칸 수가 머리와 다르다',where);
 const cell=raw?c=>c:c=>inline(c,where);
 return {head:head.map(cell),align:rule.map(c=>c.endsWith(':')?'right':'left'),rows:body.map(row=>row.map(cell))};
}
// 인용 안: 빈 줄로 나뉜 문단(줄 바꿈 유지)·목록·표
function quoteBlocks(lines,where){
 return tokenize(lines,where).map(block=>{
  if(block.kind==='para')return {p:block.lines.map(l=>inline(l,where))};
  if(block.kind==='list')return {list:block.items.map(l=>inline(l,where))};
  if(block.kind==='table')return {table:table(block.rows,where)};
  fail('인용 안에 인용',where);
 });
}

// ── 8주 차시표(README) ──
export function parseSchedule(md){
 const text=lf(md),start=text.indexOf('<a id="schedule"></a>');
 if(start<0)fail('차시표 자리표가 없다','README');
 const lines=text.slice(start).split('\n'),head=lines.findIndex(l=>l.startsWith('| 주 |'));
 if(head<0)fail('차시표 머리가 없다','README');
 const rows=[];for(let i=head;i<lines.length&&lines[i].startsWith('|');i++)rows.push(lines[i]);
 const t=table(rows,'README 차시표',{raw:true}),names=t.head;
 const expected=['주','수업에서 다루는 쓰기','4급 문법·표현','듣기(공개 기출)','읽기 숙제','쓰기 숙제'];
 if(JSON.stringify(names)!==JSON.stringify(expected))fail('차시표 열 이름이 바뀌었다: '+names.join(' | '),'README');
 return t.rows.map((row,index)=>{
  const week=Number(row[0]);if(week!==index+1)fail('차시표 주 번호',`README ${index+1}행`);
  const reading=row[4].match(/^\[(R\d) [^\]]+\]\(읽기연습\.md#r(\d)-1\)$/),writing=row[5].match(/^\[(W\d) [^\]]+\]\(쓰기과제\.md#w(\d)\)$/);
  if(reading?.[1]!==`R${week}`||reading[2]!==String(week)||writing?.[1]!==`W${week}`||writing[2]!==String(week))fail('차시표의 과제 번호',`README ${week}주`);
  // 수업·문법·듣기 칸은 꾸밈 없는 글이어야 한다(링크·굵게가 생기면 멈춘다).
  const text=cell=>plain(inline(cell,`README ${week}주`)),[lesson,grammar,listening]=row.slice(1,4).map(text);
  if(row.slice(1,4).some((cell,i)=>cell!==[lesson,grammar,listening][i]))fail('차시표 수업 칸의 꾸밈',`README ${week}주`);
  return {week,lesson,grammar,listening};
 });
}

// ── 쓰기 과제 W1~W8 ──
// 문제마다 학생이 쓰는 칸의 꼴. 이름·분량·줄 이름은 문서에서 읽고, 없으면 멈춘다.
//  blanks: 지문의 ( ㉠ )마다 한 줄 · rewrite: 바꿔 쓸 문장마다 한 줄 · essay: 분량(a~b자)이 있는 글 · outline: 개요 표 · errors: 나의 오류 목록 표
const FIELD_PLAN=Object.freeze({
 'W1-1':['blanks'],'W1-2':['blanks'],'W2-1':['blanks'],'W2-2':['blanks'],'W2-3':['rewrite'],'W3-1':['essay'],'W4-1':['essay'],
 'W5-1':['outline',['essay','서론','서론 한 문단']],'W6-1':['essay'],'W7-1':['blanks'],'W7-2':['blanks'],'W7-3':['essay'],'W7-4':['essay'],'W8-1':[['essay','고쳐 쓴 글'],'errors']});
const PART_START=/^\*\*(문제(?: (\d))?\.|(5[1-4])\.|문어체 바꿔 쓰기\.)\*\*\s*(.*)$/;
const KEY_LINE=/^\*\*(인정 범위|채점에서 보는 것|흔한 실수|검산|보는 것):\*\*\s*(.+)$/;
const KEY_FIELD={'인정 범위':'accept','채점에서 보는 것':'criteria','흔한 실수':'mistakes','검산':'check','보는 것':'criteria'};

export function parseWriting(md){
 const text=lf(md),sections=[];
 const re=/^<a id="(w\d)"><\/a>\n## (W(\d)) · (\d)주 · (.+)$/gm;let m;const heads=[];
 while((m=re.exec(text)))heads.push({anchor:m[1],id:m[2],week:Number(m[3]),weekLabel:Number(m[4]),title:m[5],start:m.index,bodyStart:m.index+m[0].length});
 if(heads.length!==8)fail(`쓰기 과제가 ${heads.length}개다`);
 heads.forEach((h,i)=>{
  if(h.week!==i+1||h.weekLabel!==h.week||h.anchor!==`w${h.week}`)fail('쓰기 과제 번호·주·자리표가 어긋났다',h.id);
  sections.push(parseWritingSection(h,text.slice(h.bodyStart,heads[i+1]?.start??text.length)));
 });
 return sections;
}
function parseWritingSection(head,body){
 const where=head.id,blocks=tokenize(body.split('\n'),where),intro=[],parts=[];
 let part=null,mode='intro',pending=null;
 const open=(label,number,instruction)=>{
  part={key:`${head.id}-${parts.length+1}`,label,number,instruction:inline(instruction,where),blocks:[],rewrite:null,ref:{},tables:{}};
  parts.push(part);mode='student';pending=null;
 };
 for(const block of blocks){
  if(block.kind==='para'){
   for(const line of block.lines){
    const start=line.match(PART_START);
    if(start){
     const label=start[1]==='문어체 바꿔 쓰기.'?'문어체 바꿔 쓰기':start[3]?`${start[3]}번`:start[2]?`문제 ${start[2]}`:'문제';
     const number=start[3]?Number(start[3]):null;
     if(!start[4])fail('문제 지시문이 없다',where);open(label,number,start[4]);continue;
    }
    if(!part){if(mode!=='intro')fail('문제 밖 문단',where);intro.push({p:[inline(line,where)]});continue;}
    const key=line.match(KEY_LINE);
    if(key){const name=KEY_FIELD[key[1]];if(part.ref[name])part.ref[name]+=' '+key[2];else part.ref[name]=key[2];mode='key';pending=null;continue;}
    const model=line.match(/^\*\*(?:(서론) )?예시답(?: — 본문 (\d+)자)?\*\*$/);
    if(model){mode='key';pending={kind:model[2]?'model-text':'model-blanks',name:model[1]||null,stated:model[2]?Number(model[2]):null};continue;}
    if(line==='**개요 예시**'){mode='key';pending={kind:'outline'};continue;}
    if(line==='**나의 오류 목록(예)**'){mode='key';pending={kind:'errors'};continue;}
    // 가상 학생 초안·첨삭 시범은 선생님 몫이라 옮기지 않는다.
    if(/^\*\*(가상 학생 초안|고쳐 쓰기 시범|고쳐 쓴 앞부분)/.test(line)){mode='skip';pending=null;continue;}
    const data=line.match(/^\*\*(자료\([^*]+\))\*\*$/);
    if(data&&mode==='student'){part.blocks.push({h:data[1]});continue;}
    if(mode==='student'){part.blocks.push({p:[inline(line,where)]});continue;}
    if(mode==='skip')continue;
    fail('읽지 못한 줄: '+line,where);
   }
   continue;
  }
  if(!part){if(block.kind==='quote'||block.kind==='list'){fail('문제 앞의 인용·목록',where);}fail('문제 앞의 표',where);}
  if(mode==='skip'){if(block.kind==='list'&&block.items.every(i=>/^\*\*(잘된 점|고칠 핵심|다시 써 볼 곳):\*\*/.test(i)))continue;if(block.kind==='quote')continue;fail('시범 칸의 뜻밖 블록',where);}
  if(mode==='student'){
   if(block.kind==='quote'){part.blocks.push(...quoteBlocks(block.lines,where));continue;}
   if(block.kind==='list'){part.blocks.push({list:block.items.map(i=>inline(i,where))});continue;}
   if(block.kind==='table'){
    const t=table(block.rows,where);
    // 문어체 바꿔 쓰기 표: 왼쪽 「말하는 문장」은 문제, 오른쪽은 예시답.
    if(part.label==='문어체 바꿔 쓰기'){
     if(plain(t.head[0])!=='말하는 문장'||!plain(t.head[1]).startsWith('글로 바꾼 문장'))fail('바꿔 쓰기 표 머리',where);
     part.rewrite=t.rows.map(r=>({say:plain(r[0]),model:plain(r[1])}));mode='key';continue;
    }
    part.blocks.push({table:t});continue;
   }
  }
  if(mode==='key'&&pending){
   if(pending.kind==='model-blanks'&&block.kind==='quote'){
    const lines=block.lines.filter(l=>l.trim());part.ref.model=lines.map(l=>{const b=l.match(/^([㉠-㉣]) (.+)$/);if(!b)fail('빈칸 예시답 줄 꼴: '+l,where);return {blank:b[1],text:b[2]};});pending=null;continue;
   }
   if(pending.kind==='model-text'&&block.kind==='quote'){
    const paragraphs=[];let current=[];for(const l of block.lines){if(l.trim()){current.push(l);}else if(current.length){paragraphs.push(current.join('\n'));current=[];}}
    if(current.length)paragraphs.push(current.join('\n'));
    const textModel=paragraphs.join('\n');
    const length=homeworkLength(textModel);if(length!==pending.stated)fail(`예시답 글자 수 ${pending.stated}자로 적었는데 ${length}자다`,where);
    (part.ref.models??=[]).push({name:pending.name,paragraphs,length});pending=null;continue;
   }
   if(pending.kind==='outline'&&block.kind==='table'){part.tables.outline=table(block.rows,where);pending=null;continue;}
   if(pending.kind==='errors'&&block.kind==='table'){part.tables.errors=table(block.rows,where);pending=null;continue;}
  }
  fail(`읽지 못한 ${block.kind} 블록(${mode})`,where);
 }
 return {id:head.id,week:head.week,title:head.title,intro,parts};
}

function ranges(segments){return [...plain(segments).matchAll(/(\d+)~(\d+)자/g)].map(m=>({min:Number(m[1]),max:Number(m[2]),at:m.index,text:m[0]}));}
function fieldsFor(part,where){
 const plan=FIELD_PLAN[part.key];if(!plan)fail('쓸 칸 계획이 없는 문제 '+part.key,where);
 const fields=[],instruction=plain(part.instruction);
 for(const step of plan){
  const [kind,label,anchor]=Array.isArray(step)?step:[step];
  const id=()=>`${part.key}.${fields.length+1}`;
  if(kind==='blanks'){
   const text=part.blocks.flatMap(b=>b.p?b.p.map(plain):b.list?b.list.map(plain):[]).join('\n'),marks=[...text.matchAll(/\( ([㉠-㉣]) \)/g)].map(m=>m[1]);
   if(marks.length<1||new Set(marks).size!==marks.length)fail('지문의 빈칸 ( ㉠ )을 찾지 못했다',part.key);
   for(const blank of marks)fields.push({id:id(),kind:'line',label:blank,blank});
  }else if(kind==='rewrite'){
   if(!part.rewrite?.length)fail('바꿔 쓸 문장이 없다',part.key);
   for(const row of part.rewrite)fields.push({id:id(),kind:'line',label:row.say});
  }else if(kind==='essay'){
   const found=ranges(part.instruction);let range;
   if(anchor){const at=instruction.indexOf(anchor);range=found.find(r=>r.at>at&&r.at<at+anchor.length+12);}
   else range=found.length===1?found[0]:null;
   if(!range)fail(`분량(a~b자)을 하나로 정하지 못했다(${found.map(r=>r.text).join(', ')||'없음'})`,part.key);
   fields.push({id:id(),kind:'text',label:label||'글',min:range.min,max:range.max});
  }else if(kind==='outline'){
   const t=part.tables.outline;if(!t)fail('개요 예시 표가 없다',part.key);
   if(plain(t.head[0])!=='부분')fail('개요 표 머리',part.key);
   fields.push({id:id(),kind:'grid',label:'개요',rows:t.rows.map(r=>plain(r[0])),columns:t.head.slice(1).map(plain)});
  }else if(kind==='errors'){
   const t=part.tables.errors;if(!t)fail('나의 오류 목록 예가 없다',part.key);
   const count=instruction.match(/자주 틀린 것 (세|네|다섯) 가지/);if(!count)fail('오류 목록 개수(세 가지)를 찾지 못했다',part.key);
   // 표의 예(가상 학생의 오류)는 답이 아니라 칸의 꼴을 보여 주는 예라 학생 쪽 칸에 함께 싣는다.
   fields.push({id:id(),kind:'grid',label:'나의 오류 목록',rows:Array.from({length:{세:3,네:4,다섯:5}[count[1]]},(_,i)=>String(i+1)),columns:t.head.map(plain),example:t.rows.map(r=>r.map(plain))});
  }else fail('모르는 칸 꼴 '+kind,part.key);
 }
 return fields;
}
function writingKey(part,fields){
 const out={};
 for(const name of ['accept','criteria','mistakes','check'])if(part.ref[name])out[name]=part.ref[name];
 const models={};
 if(part.ref.model){for(const item of part.ref.model){const field=fields.find(f=>f.blank===item.blank);if(!field)fail('예시답 빈칸이 지문에 없다 '+item.blank,part.key);models[field.id]=item.text;}}
 if(part.rewrite)fields.forEach((field,i)=>{models[field.id]=part.rewrite[i].model;});
 for(const model of part.ref.models||[]){
  const field=fields.find(f=>f.kind==='text'&&(model.name?f.label===model.name:true));if(!field)fail('예시답이 들어갈 글 칸이 없다',part.key);
  if(model.length<field.min||model.length>field.max)fail(`예시답 ${model.length}자가 ${field.min}~${field.max}자 밖이다`,part.key);
  models[field.id]=model.paragraphs.join('\n\n');
 }
 if(part.tables.outline){const field=fields.find(f=>f.label==='개요');models[field.id]=part.tables.outline.rows.map(r=>r.slice(1).map(plain));}
 if(Object.keys(models).length)out.model=models;
 return out;
}

// ── 읽기 연습 R1~R8 ──
export function parseReading(md){
 const text=lf(md),weeks=[];
 const weekRe=/^## (\d)주 · (.+)$/gm,heads=[];let m;
 while((m=weekRe.exec(text)))heads.push({week:Number(m[1]),title:m[2],start:m.index,bodyStart:m.index+m[0].length});
 if(heads.length!==8)fail(`읽기 주가 ${heads.length}개다`);
 heads.forEach((h,i)=>{
  if(h.week!==i+1)fail('읽기 주 번호',`${h.week}주`);
  const body=text.slice(h.bodyStart,heads[i+1]?.start??text.length);
  const parts=body.split(/\n(?=<a id="r\d-\d"><\/a>\n### )/).slice(1);
  weeks.push({id:`R${h.week}`,week:h.week,title:h.title,items:parts.map(part=>parseReadingItem(part,h.week))});
 });
 const byId=new Map(weeks.flatMap(w=>w.items).map(item=>[item.id,item]));
 for(const item of byId.values())if(item.samePassageAs){
  const source=byId.get(item.samePassageAs);if(!source||source.samePassageAs||!source.passage.length)fail('같은 지문의 원래 문항이 없다',item.id);
  if(Number(source.id.slice(3))>=Number(item.id.slice(3))||source.id.slice(0,3)!==item.id.slice(0,3))fail('같은 지문은 같은 주의 앞 문항이어야 한다',item.id);
  item.passage=structuredClone(source.passage);
 }
 return weeks;
}
function parseReadingItem(part,week){
 const head=part.match(/^<a id="(r(\d)-(\d))"><\/a>\n### (R(\d)-(\d)) · (.+)$/m);
 if(!head||head[1]!==head[4].toLowerCase()||Number(head[5])!==week)fail('읽기 문항 머리·자리표',head?.[4]);
 const id=head[4],where=id,lines=part.slice(part.indexOf(head[0])+head[0].length).split('\n');
 const answerAt=lines.findIndex(l=>l.startsWith('**정답:**'));if(answerAt<0)fail('정답 줄이 없다',where);
 const blocks=tokenize(lines.slice(0,answerAt),where),tail=lines.slice(answerAt).filter(l=>l.trim());
 let instruction=null,samePassageAs=null;const notes=[],passage=[],options=[];
 for(const block of blocks){
  if(block.kind==='quote'){if(passage.length)fail('지문이 둘',where);passage.push(...quoteBlocks(block.lines,where));continue;}
  if(block.kind!=='para')fail('읽기 문항의 뜻밖 블록 '+block.kind,where);
  for(const line of block.lines){
   if(/^[①②③④]/.test(line)){options.push(line);continue;}
   if(options.length)fail('보기 뒤 문단',where);
   const same=line.match(/^\((R\d-\d)과 같은 지문\)$/);if(same){samePassageAs=same[1];continue;}
   const box=line.match(/^<보기> (.+)$/);if(box){notes.push({box:inline(box[1],where)});continue;}
   if(instruction===null){instruction=line;continue;}
   if(passage.length)fail('지문 뒤 문단: '+line,where);
   notes.push({p:[inline(line,where)]});
  }
 }
 if(!instruction)fail('지시문이 없다',where);
 if(!samePassageAs&&!passage.length)fail('지문이 없다',where);
 if(samePassageAs&&passage.length)fail('같은 지문인데 지문이 또 있다',where);
 const choices=[];
 for(const line of options)for(const o of line.matchAll(/([①②③④])\s*(.+?)(?=[\s　]*[①②③④]|$)/g))choices.push({mark:o[1],text:o[2].replace(/[\s　]+$/,'')});
 if(choices.map(c=>c.mark).join('')!==CIRCLED.join(''))fail('보기 번호 '+choices.map(c=>c.mark).join(''),where);
 for(const c of choices)if(!c.text||/[①②③④]/.test(c.text))fail('보기 글 꼴',where);
 const field=name=>{const line=tail.find(l=>l.startsWith(`**${name}:**`));if(!line)fail(name+' 줄이 없다',where);return line.slice(name.length+6).trim();};
 const answerMark=field('정답');if(!CIRCLED.includes(answerMark))fail('정답 꼴 '+answerMark,where);
 const answer=CIRCLED.indexOf(answerMark)+1,wrongText=field('오답'),wrong={};
 for(const piece of wrongText.split(/\s·\s(?=[①②③④] )/)){const w=piece.match(/^([①②③④]) (.+)$/);if(!w)fail('오답 꼴: '+piece,where);const n=CIRCLED.indexOf(w[1])+1;if(wrong[n])fail('오답 번호가 두 번',where);wrong[n]=w[2];}
 const expected=[1,2,3,4].filter(n=>n!==answer);
 if(JSON.stringify(Object.keys(wrong).map(Number))!==JSON.stringify(expected))fail(`오답 설명 번호 ${Object.keys(wrong).join(',')}(정답 ${answer})`,where);
 if(tail.length!==3)fail('정답·근거·오답 밖의 줄',where);
 return {id,label:head[7],instruction,samePassageAs,notes,passage,options:choices.map(c=>c.text),answer,reason:field('근거'),wrong};
}

// ── 첨삭 기준: 기호 11개(§3), 한마디 세 줄(§4), 51·52 빈칸 판정 셋(§2). 학생이 첨삭을 읽을 때 기호 뜻을 함께 보인다. ──
export function parseGuide(md){
 const text=lf(md),where='첨삭기준';
 const codesAt=text.indexOf('<a id="codes"></a>'),commentAt=text.indexOf('<a id="comment"></a>'),amountAt=text.indexOf('<a id="amount"></a>');
 if(codesAt<0||commentAt<0||amountAt<0)fail('기호·한마디·분량 자리표',where);
 const lines=text.slice(codesAt,commentAt).split('\n'),head=lines.findIndex(l=>l.startsWith('| 기호 |'));
 const rows=[];for(let i=head;i>=0&&i<lines.length&&lines[i].startsWith('|');i++)rows.push(lines[i]);
 const t=table(rows,where,{raw:true});
 if(JSON.stringify(t.head)!==JSON.stringify(['기호','뜻','예']))fail('기호표 머리',where);
 const codes={};
 for(const row of t.rows){const c=row[0].match(/^〔(.)〕$/);if(!c||codes[c[1]])fail('기호 꼴 '+row[0],where);codes[c[1]]=plain(inline(row[1],where));}
 const comment=[...text.slice(commentAt).split('\n<a id=')[0].matchAll(/^- \*\*(.+?):\*\*/gm)].map(m=>m[1]);
 if(JSON.stringify(comment)!==JSON.stringify(['잘된 점','고칠 핵심','다시 써 볼 곳']))fail('한마디 세 줄 이름: '+comment.join(','),where);
 const verdict=text.slice(amountAt,codesAt).match(/「(\S+) · (\S+) · (\S+)」 셋 중 하나/);
 if(!verdict)fail('빈칸 판정 셋',where);
 return {codes,comment,verdicts:verdict.slice(1,4)};
}

// ── 두 JSON 만들기 ──
export function buildHomework({schedule:scheduleMd,writing:writingMd,reading:readingMd,guide:guideMd}){
 const schedule=parseSchedule(scheduleMd),writing=parseWriting(writingMd),reading=parseReading(readingMd),guide=parseGuide(guideMd);
 // 판 이름은 옮긴 내용으로만 정한다. 문서의 다른 절(남은 일 등)을 고쳐도 판과 JSON은 그대로다.
 const homework={schema:'synk.topik4-homework.v1',course:'topik4-online',version:'',title:'TOPIK II 4급 온라인 반',sources:{...HOMEWORK_SOURCES},schedule:{...HOMEWORK_SCHEDULE},feedback:guide,weeks:[]};
 const key={schema:'synk.topik4-homework-key.v1',course:'topik4-online',version:'',reading:{},writing:{}};
 for(let week=1;week<=HOMEWORK_SCHEDULE.weeks;week++){
  const plan=schedule[week-1],w=writing[week-1],r=reading[week-1];
  if(!plan||!w||!r)fail('주 자료가 빠졌다',`${week}주`);
  const parts=w.parts.map(part=>{
   const fields=fieldsFor(part,w.id);
   key.writing[part.key]=writingKey(part,fields);
   const number=part.number||(part.label==='문어체 바꿔 쓰기'?null:Number(w.title.match(/\((5[1-4])번 유형\)/)?.[1])||null);
   return {key:part.key,label:part.label,...(number?{number}:{}),instruction:part.instruction,blocks:part.blocks,fields:fields.map(({blank,...field})=>field)};
  });
  for(const item of r.items)key.reading[item.id]={answer:item.answer,reason:item.reason,wrong:item.wrong};
  homework.weeks.push({week,lesson:plan.lesson,grammar:plan.grammar,listening:plan.listening,
   writing:{id:w.id,title:w.title,...(w.intro.length?{intro:w.intro}:{}),parts},
   reading:{id:r.id,title:r.title,items:r.items.map(({answer,reason,wrong,samePassageAs,notes,...item})=>({...item,...(notes.length?{notes}:{}),...(samePassageAs?{samePassageAs}:{})}))}});
 }
 const version='v1-'+sha256(JSON.stringify([homework.weeks,homework.feedback,key.reading,key.writing])).slice(0,12);
 homework.version=key.version=version;
 return {homework:JSON.parse(JSON.stringify(homework)),key:JSON.parse(JSON.stringify(key))};
}
export const homeworkJson=value=>JSON.stringify(value,null,1)+'\n';
export function readSources(base=root){return Object.fromEntries(Object.entries(HOMEWORK_SOURCES).map(([name,file])=>[name,fs.readFileSync(path.join(base,file),'utf8')]));}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const built=buildHomework(readSources());
 const outputs=[[HOMEWORK_TARGETS.homework,homeworkJson(built.homework)],[HOMEWORK_TARGETS.key,homeworkJson(built.key)]];
 if(process.argv.includes('--check')){
  const stale=outputs.filter(([file,text])=>!fs.existsSync(path.join(root,file))||lf(fs.readFileSync(path.join(root,file),'utf8'))!==text).map(([file])=>file);
  if(stale.length)throw new Error('TOPIK 4급 과제 JSON이 문서와 다르다 — node tools/build-topik4-homework.mjs 로 다시 만든다: '+stale.join(', '));
  console.log(`TOPIK 4급 과제 JSON current (${built.homework.version})`);
 }else{for(const [file,text] of outputs)fs.writeFileSync(path.join(root,file),text);console.log(`TOPIK 4급 과제 JSON built (${built.homework.version})`);}
}
