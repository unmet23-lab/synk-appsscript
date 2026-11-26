'use strict';
/*
 * 기획부 「사업계획서」(사업계획서_설계.md). 넣기 → 읽기 → 메모 고치기 → 새 파일로 저장.
 * 파일 읽기와 쓰기는 이 본체가 하고, AI는 tools.turn(도구 없는 차례)으로 칸만 채운다.
 * 저장 자리: features/bizplan/<부서>/list.json(손님이 고른 것), state.json(고름), reads/<시각>-<업무>.json(읽은 결과),
 *   draft.json(계획서가 없을 때 손님이 직접 쓴 일곱 장, 설계 14.2)
 */
const path=require('node:path');
const {createHash,randomUUID}=require('node:crypto');
const fsSync=require('node:fs');
// 확정(잇기 · 지우기)은 동기로 한다. 시험은 io에 같은 이름의 Sync 함수를 넣어 바꾼다
const syncOf=(io,name)=>io[name+'Sync']||fsSync[name+'Sync'];
const ox=require('./office-ooxml.cjs');
const ck=require('./office-bizplan-check.cjs');

const fail=(code,detail)=>Object.assign(new Error(code),{code,...(detail?{detail}:{})});
const PLAN_EXT=new Set(['.docx','.md','.txt']);
const DATA_EXT=new Set(['.txt','.md','.csv','.docx','.xlsx']);
const LOCKED_EXT=new Set(['.hwp','.hwpx','.pdf','.doc','.docm']);
const LIMIT={planBytes:10*1024*1024,planChars:200000,dataBytes:5*1024*1024,dataChars:400000,dataFiles:10,criteria:4000,userText:2000,reads:5,writeChapter:4000};
/* 직접 쓰기의 일곱 장(설계 14.2, 쓰기 시안의 물음과 같은 차례) */
const CHAPTERS=['문제 인식','해결책','고객과 시장','경쟁과 차별점','비즈니스 모델','팀','실행 계획과 자금'];
const DRAFT_TITLE='# 사업계획서 초안';
const chapterHead=k=>`## ${String(k+1).padStart(2,'0')} ${CHAPTERS[k]}`;
// Codex는 생각 깊이를 낮춰 부른다(11-23 실측: 같은 차례가 174초 → 68초, 답의 꼴은 같음). 한 차례 5분, 한 번 읽기 20분
const TURN_MS=300_000,RUN_MS=20*60_000,EFFORT='low';
const notesSchema=require('./office-bizplan.schema.json');
const itemsSchemaBase=require('./office-bizplan-items.schema.json');
const sha=buf=>createHash('sha256').update(buf).digest('hex');
const stamp=t=>new Date(t).toISOString().replace(/[-:]/g,'').replace(/\.\d+Z$/,'Z');

/* ── 파일 읽기 ── */
function decodeText(buf){
  let t=buf.toString('utf8').replace(/^﻿/,'');
  const bad=(t.match(/�/g)||[]).length;
  if(bad>8&&bad>t.length/200){try{t=new TextDecoder('euc-kr').decode(buf);}catch{}}
  return t;
}
async function readFileLimited(io,file,max){
  const st=await io.stat(file).catch(e=>{throw fail(e.code==='ENOENT'?'PLAN_MISSING':'PLAN_READ');});
  if(!st.isFile())throw fail('PLAN_MISSING');
  if(st.size>max)throw fail('TOO_BIG');
  return {buf:await io.readFile(file),stat:{size:st.size,mtimeMs:Math.round(st.mtimeMs)}};
}
async function readPlan(io,file){
  const ext=path.extname(file).toLowerCase();
  if(LOCKED_EXT.has(ext))throw fail('PLAN_FORMAT');
  if(!PLAN_EXT.has(ext))throw fail('PLAN_FORMAT');
  const {buf,stat}=await readFileLimited(io,file,LIMIT.planBytes);
  if(ext==='.docx'){
    let doc;
    try{doc=ox.docxDocument(buf);}catch(e){throw fail(e.code==='MACRO'?'PLAN_FORMAT':'PLAN_LOCKED');}
    const paragraphs=doc.paragraphs.map(p=>({text:p.text,level:p.level,toc:!!p.toc,inTable:!!p.inTable,empty:!!p.empty}));
    return {kind:'docx',doc,paragraphs,guides:doc.guides,sha256:sha(buf),stat,buf};
  }
  const raw=decodeText(buf);
  const paragraphs=[];
  let at=0;
  for(const line of raw.split('\n')){
    const body=line.replace(/\r$/,'');
    const m=/^(#{1,6})\s/.exec(body);
    paragraphs.push({text:body,level:ext==='.md'&&m?m[1].length-1:null,toc:false,inTable:false,start:at,end:at+body.length});
    at+=line.length+1;
  }
  return {kind:ext==='.md'?'md':'txt',raw,paragraphs,guides:[],sha256:sha(buf),stat,buf};
}
async function readData(io,file){
  const ext=path.extname(file).toLowerCase();
  if(!DATA_EXT.has(ext))throw fail('DATA_FORMAT');
  const {buf}=await readFileLimited(io,file,LIMIT.dataBytes).catch(e=>{throw fail(e.code==='TOO_BIG'?'DATA_TOO_BIG':'DATA_MISSING');});
  let lines;
  try{
    if(ext==='.docx'){const d=ox.docxDocument(buf);lines=[...d.paragraphs.map(p=>p.text),...d.guides];}
    else if(ext==='.xlsx')lines=ox.xlsxLines(buf);
    else lines=decodeText(buf).split(/\r?\n/);
  }catch{throw fail('DATA_LOCKED');}
  lines=lines.map(l=>l.replace(/\s+$/,'')).filter(l=>l.trim());
  const text=lines.join('\n');
  return {name:path.basename(file),lines,text,scale:ck.fileScale(text),sha256:sha(buf)};
}

/* ── 저장소 ── */
const files=(store,member,dept)=>{const d=store.dir(member,'bizplan',dept.id);return {d,list:path.join(d,'list.json'),state:path.join(d,'state.json'),reads:path.join(d,'reads'),draft:path.join(d,'draft.json')};};
/* ── 직접 쓴 초안(설계 14.2) ── */
function emptyDraft(){return {chapters:CHAPTERS.map(()=>''),skipped:[],file:null,at:0};}
function validDraft(v){
  return !!v&&typeof v==='object'&&Array.isArray(v.chapters)&&v.chapters.length===CHAPTERS.length&&v.chapters.every(t=>typeof t==='string')&&
    Array.isArray(v.skipped)&&v.skipped.every(k=>Number.isInteger(k)&&k>=0&&k<CHAPTERS.length)&&(v.file===null||typeof v.file?.path==='string'&&typeof v.file?.sha256==='string');
}
/* 쓰던 초안. 없으면 빈 초안. 읽지 못하거나 깨졌으면 쓰는 동작(strict)에서는 멈춘다 — 빈 초안으로 덮어 잃지 않게(GPT 검수 GA6) */
async function loadDraft(store,f,{strict=false}={}){
  const MISSING={};let v;
  try{v=await store.readJson(f.draft,{missing:MISSING});}
  catch(e){if(strict)throw fail(e.code==='BROKEN'?'BROKEN':'STORAGE');return emptyDraft();}
  if(v===MISSING)return emptyDraft();
  if(!validDraft(v)){if(strict)throw fail('BROKEN');return emptyDraft();}
  return v;
}
/* 손님 줄이 장 제목처럼 읽히지 않게 맨 앞 #만 막는다. 장은 솔리오가 쓴 제목 줄로만 가른다 */
function draftMarkdown(d){
  const out=[DRAFT_TITLE,''];
  d.chapters.forEach((t,k)=>{
    out.push(chapterHead(k),'');
    const body=t.replace(/\r\n?/g,'\n').split('\n').map(l=>/^\s*#/.test(l)?'\\'+l.trimStart():l).join('\n').trim();
    if(body)out.push(body,'');
  });
  return out.join('\n');
}
/* 이 계획서가 솔리오가 만든 초안 그대로인가. 그렇다면 장 제목 줄의 자리를 돌려준다 */
/* 솔리오가 만든 초안의 짜임(맨 앞 표제와 차례대로 선 일곱 장 제목 줄)이면 그 자리를 돌려준다.
   draft.json이 없어도(기록 지우기 뒤) 짜임으로 알아본다(GPT 다시 검수 GA6) */
function draftHeads(paragraphs){
  // 표제는 보지 않는다. 손님이 표제에 회사 이름을 넣어도 일곱 장 제목 줄로 알아본다(GPT 다시 검수 r3 GA6)
  const heads=[];let k=0;
  paragraphs.forEach((p,i)=>{if(k<CHAPTERS.length&&p.level!=null&&p.text.trim()===chapterHead(k)){heads.push({i,k});k++;}});
  if(k!==CHAPTERS.length)return null;
  // 첫 장 앞의 표제(장 제목보다 높은 「#」 줄)는 묶음이 아니다. 01장 앞에 손님이 넣은 「## 기업 개요」는 따로 묶음이다(GPT 다시 검수 r4 GA2)
  const level=paragraphs[heads[0].i].level;
  const titles=paragraphs.map((p,i)=>i).filter(i=>i<heads[0].i&&paragraphs[i].level!=null&&paragraphs[i].level<level);
  return {titles,heads,level};
}
function emptyList(){return {plan:null,data:[],criteria:{mode:'default',text:''}};}
function validList(v){
  return v&&typeof v==='object'&&(v.plan===null||typeof v.plan?.path==='string')&&Array.isArray(v.data)&&v.data.every(x=>typeof x?.path==='string')&&
    v.criteria&&['default','pasted'].includes(v.criteria.mode)&&typeof v.criteria.text==='string';
}
async function loadList(store,f){
  const v=await store.readJson(f.list,{missing:emptyList()});
  if(!validList(v))throw fail('BROKEN');
  return v;
}
async function loadState(store,f){
  try{const v=await store.readJson(f.state,{missing:null});return v&&typeof v==='object'?v:{};}catch{return {};}
}
async function latestRead(store,f,io){
  let names;
  try{names=(await io.readdir(f.reads)).filter(n=>/^\d{8}T\d{6}Z-[0-9a-f-]{36}\.json$/.test(n)).sort();}catch(e){if(e.code==='ENOENT')return null;throw e;}
  for(let i=names.length-1;i>=0;i--){
    try{const r=await store.readJson(path.join(f.reads,names[i]));if(r&&r.id===names[i].slice(0,-5))return r;}catch{}
  }
  return null;
}
const itemsOf=list=>list.criteria.mode==='pasted'?ck.pastedItems(list.criteria.text):ck.DEFAULT_ITEMS;

/* ── 화면에 줄 모습 ── */
async function snapshot({store,member,dept,io}){
  const f=files(store,member,dept);
  let list,broken=false;
  try{list=await loadList(store,f);}catch{list=emptyList();broken=true;}
  const read=await latestRead(store,f,io);
  const state=await loadState(store,f);
  const own=read&&state.readId===read.id;
  // 깨진 초안(BROKEN)만 「기록 지우기」 길을 보인다. 잠시 읽지 못한 것(STORAGE)은 지우게 하지 않는다(GPT 다시 검수 r3 GA2)
  let draft,draftBroken=false,draftUnread=false;
  try{draft=await loadDraft(store,f,{strict:true});}catch(e){draft=emptyDraft();if(e.code==='BROKEN')draftBroken=true;else draftUnread=true;}
  // 읽은 계획서와 목록의 계획서가 다른 파일이어도 바뀐 것이다. 초안을 새 이름으로 다시 만들었거나 다른 계획서를 골랐을 때(Opus 대체 검수 r3 P2)
  let planChanged=!!(read?.plan&&list.plan&&read.plan.path!==list.plan.path);
  // 초안 파일을 손님이 파일에서 고쳤는가. 만들 때 적어 둔 크기 · 시각과 다르면 참. 파일이 정본이다(설계 검토 지적 2)
  let draftEdited=false;
  if(draft.file&&Number.isFinite(draft.file.size)){try{const st=await io.stat(draft.file.path);draftEdited=st.size!==draft.file.size||Math.round(st.mtimeMs)!==draft.file.mtimeMs;}catch{}}
  // 크기 · 시각을 적지 않은 앞 판의 기록은 지문으로 본다(GPT 다시 검수 r4 GA3)
  else if(draft.file){try{const st=await io.stat(draft.file.path);if(st.size<=LIMIT.planBytes)draftEdited=sha(await io.readFile(draft.file.path))!==draft.file.sha256;}catch{}}
  if(read&&list.plan&&read.plan?.path===list.plan.path){
    try{const st=await io.stat(list.plan.path);planChanged=st.size!==read.plan.stat.size||Math.round(st.mtimeMs)!==read.plan.stat.mtimeMs;}catch{planChanged=true;}
  }
  return {
    broken,
    list:{plan:list.plan?{name:path.basename(list.plan.path),outline:Array.isArray(list.plan.outline)?list.plan.outline.filter(x=>typeof x==='string').slice(0,12):[]}:null,data:list.data.map(x=>({name:path.basename(x.path)})),criteria:list.criteria,items:itemsOf(list)},
    read:read?{id:read.id,at:read.at,status:read.status,reason:read.reason||null,provider:read.provider,failedChunks:read.failedChunks||0,totalChunks:read.totalChunks||0,dataName:read.dataName||'',
      // 계획서를 열지 못한 실패 기록은 plan이 없다(코드 검수 P1-1)
      plan:{name:read.plan?.name||'',kind:read.plan?.kind||'',samePlan:!!list.plan&&!!read.plan&&read.plan.path===list.plan.path},dataNames:(read.data||[]).map(d=>d.name),
      paragraphs:read.paragraphs,sections:read.sections,items:read.items,fromDraft:!!read.fromDraft,empty:Array.isArray(read.empty)?read.empty:[],
      notes:read.notes.map((n,i)=>({...n,key:'n'+i,sourceName:n.source?read.data[n.source-1]?.name||'':'',handoff:n.kind==='unsupported'?ck.handoffText(n):'',choice:own?state.choices?.['n'+i]||null:null}))}:null,
    drafts:own?state.drafts||{}:{},
    saved:own&&state.saved?{name:state.saved.name,at:state.saved.at,skipped:state.saved.skipped||0}:null,
    draft:{chapters:draft.chapters,skipped:draft.skipped,at:draft.at,name:draft.file?path.basename(draft.file.path):null,isPlan:!!draft.file&&!!list.plan&&draft.file.path===list.plan.path,broken:draftBroken,unread:draftUnread,edited:draftEdited},
    planChanged,
  };
}

/* ── 단추 ── */
const cleanUser=t=>typeof t==='string'?ox.clean(t).trim().slice(0,LIMIT.userText):'';
async function act(ctx){
  const {store,member,dept,action,args,io}=ctx;
  const f=files(store,member,dept);
  const current=ctx.current||(()=>true);
  const saveList=list=>store.writeJson(f.d,'list.json',list,current);
  const saveState=state=>store.writeJson(f.d,'state.json',state,current);
  switch(action){
    case 'pick-plan':
    case 'pick-data':{
      const plan=action==='pick-plan';
      const picked=await ctx.pick?.({multi:!plan,filters:[plan?{name:'사업계획서',extensions:['docx','md','txt']}:{name:'회사 자료',extensions:['txt','md','csv','docx','xlsx']}]});
      if(!Array.isArray(picked)||!picked.length)return {ok:false,code:'CANCELLED'};
      return store.line(member,async()=>{
        const list=await loadList(store,f);
        if(plan){
          const file=picked[0],ext=path.extname(file).toLowerCase();
          if(LOCKED_EXT.has(ext)||!PLAN_EXT.has(ext))return {ok:false,code:'PLAN_FORMAT'};
          // 고를 때 목차를 미리 읽어 처음 화면의 종이에 보인다. 열리지 않는 파일은 여기서 알린다(11-23 미학 맹검 「빈 흰 상자」)
          let outline=[];
          try{const p=await readPlan(io,file);outline=p.paragraphs.filter(x=>x.level!=null&&!x.toc&&x.text.trim()).slice(0,12).map(x=>x.text.trim().slice(0,80));}
          catch(e){if(['PLAN_FORMAT','PLAN_LOCKED'].includes(e.code))return {ok:false,code:e.code};}
          list.plan={path:file,outline};
        }else{
          for(const file of picked){
            if(!DATA_EXT.has(path.extname(file).toLowerCase()))return {ok:false,code:'DATA_FORMAT'};
            if(!list.data.some(x=>x.path===file))list.data.push({path:file});
          }
          if(list.data.length>LIMIT.dataFiles)return {ok:false,code:'DATA_COUNT'};
        }
        await saveList(list);return {ok:true};
      });
    }
    case 'remove-data':
      return store.line(member,async()=>{
        const list=await loadList(store,f),i=Number(args.index);
        if(!Number.isInteger(i)||!list.data[i])return {ok:false,code:'VALUE'};
        list.data.splice(i,1);await saveList(list);return {ok:true};
      });
    case 'criteria':
      return store.line(member,async()=>{
        const list=await loadList(store,f);
        const mode=args.mode==='pasted'?'pasted':'default',text=typeof args.text==='string'?ox.clean(args.text).slice(0,LIMIT.criteria):'';
        if(mode==='pasted'&&!ck.pastedItems(text).length)return {ok:false,code:'CRITERIA'};
        list.criteria={mode,text:mode==='pasted'?text:''};await saveList(list);return {ok:true};
      });
    case 'start':{
      if(!['claude','codex'].includes(args.provider))return {ok:false,code:'VALUE'};
      const list=await loadList(store,f);
      if(!list.plan)return {ok:false,code:'PLAN_MISSING'};
      try{await io.stat(list.plan.path);}catch{return {ok:false,code:'PLAN_MISSING'};}
      return ctx.submitFeature(args.provider);
    }
    case 'choose':
      return store.line(member,async()=>{
        const read=await latestRead(store,f,io);
        const key=String(args.key||''),i=/^n(\d{1,3})$/.exec(key)?.[1];
        const note=read&&i!=null?read.notes[Number(i)]:null;
        if(!note)return {ok:false,code:'NOT_FOUND'};
        const state=await loadState(store,f);
        if(state.readId!==read.id)Object.assign(state,{readId:read.id,choices:{},drafts:{},saved:null});
        state.choices??={};
        if(args.kind==='undo')delete state.choices[key];
        else if(args.kind==='fix'){if(!note.fix||!note.canReplace)return {ok:false,code:'VALUE'};state.choices[key]={kind:'fix'};}
        else if(args.kind==='edit'){const text=cleanUser(args.text);if(!text||!note.canReplace)return {ok:false,code:'VALUE'};state.choices[key]={kind:'edit',text};}
        else if(args.kind==='keep')state.choices[key]={kind:'keep'};
        else return {ok:false,code:'VALUE'};
        state.saved=null;await saveState(state);return {ok:true};
      });
    case 'draft':
      return store.line(member,async()=>{
        const read=await latestRead(store,f,io);
        const item=read?.items.find(x=>x.item===args.item&&x.thin&&x.asks.length);
        if(!item)return {ok:false,code:'NOT_FOUND'};
        const answers=Array.isArray(args.answers)?args.answers:[];
        if(answers.length!==item.asks.length||answers.some((v,j)=>!Number.isInteger(v)||!item.asks[j].opts[v]))return {ok:false,code:'VALUE'};
        const text=item.asks.map((a,j)=>a.opts[answers[j]].sentence).join(' ');
        const state=await loadState(store,f);
        if(state.readId!==read.id)Object.assign(state,{readId:read.id,choices:{},drafts:{},saved:null});
        state.drafts??={};
        if(args.remove===true)delete state.drafts[item.item];else state.drafts[item.item]={answers,text};
        state.saved=null;await saveState(state);return {ok:true,text};
      });
    case 'save':
      return store.line(member,async()=>{
        const read=await latestRead(store,f,io),state=await loadState(store,f);
        if(!read||read.status==='failed')return {ok:false,code:'NOT_FOUND'};
        // 읽은 뒤 목록의 계획서가 다른 파일로 바뀌었으면 앞 파일의 고친 판을 만들지 않는다
        const now=await loadList(store,f);
        if(now.plan&&now.plan.path!==read.plan?.path)return {ok:false,code:'PLAN_CHANGED'};
        const res=await saveCopy({read,state:state.readId===read.id?state:{},io,fallbackDir:dept.folder,current});
        if(!res.ok)return res;
        await saveState({...state,readId:read.id,saved:{name:res.name,path:res.path,at:Date.now(),skipped:res.skipped}});
        // 경로는 본체에만 둔다. 화면에는 이름과 뺀 수만 보낸다(코드 검수 P3-15)
        return {ok:true,name:res.name,skipped:res.skipped};
      });
    case 'reveal':{
      const state=await loadState(store,f);
      if(!state.saved?.path)return {ok:false,code:'NOT_FOUND'};
      return ctx.reveal?ctx.reveal(state.saved.path):{ok:false,code:'NOT_AVAILABLE'};
    }
    case 'handoff':{
      const read=await latestRead(store,f,io);
      const i=/^n(\d{1,3})$/.exec(String(args.key||''))?.[1];
      const note=read&&i!=null?read.notes[Number(i)]:null;
      if(!note||note.kind!=='unsupported')return {ok:false,code:'NOT_FOUND'};
      if(!['claude','codex'].includes(args.provider)||typeof args.departmentId!=='string')return {ok:false,code:'VALUE'};
      const all=await ctx.departments();
      if(!all.some(d=>d.id===args.departmentId))return {ok:false,code:'NOT_FOUND'};
      const extra=cleanUser(args.extra);
      const prompt=ck.handoffText(note)+(extra?'\n\n덧붙이는 말: '+extra:'');
      const res=await ctx.submitTask({provider:args.provider,departmentId:args.departmentId,prompt,mailSearch:false});
      if(res?.ok)await store.line(member,async()=>{
        const state=await loadState(store,f);
        if(state.readId!==read.id)Object.assign(state,{readId:read.id,choices:{},drafts:{},saved:null});
        state.choices??={};state.choices['n'+i]={kind:'handed',taskId:res.id,departmentId:args.departmentId};
        await saveState(state);
      });
      return res;
    }
    case 'write-save':{
      // 쓴 글은 「다음」 · 「건너뛰기」 · 「나중에 쓰기」 때만 온다. 장마다 4천 자. 글이 빠진 요청은 받지 않는다(GA5)
      const k=args.chapter;
      if(!Number.isInteger(k)||k<0||k>=CHAPTERS.length||typeof args.text!=='string')return {ok:false,code:'VALUE'};
      const text=ox.clean(args.text).slice(0,LIMIT.writeChapter);
      return store.line(member,async()=>{
        const d=await loadDraft(store,f,{strict:true});
        d.chapters[k]=text;
        d.skipped=d.skipped.filter(x=>x!==k);
        if(args.skipped===true&&!text.trim())d.skipped.push(k);
        d.at=Date.now();
        await store.writeJson(f.d,'draft.json',d,current);return {ok:true};
      });
    }
    case 'write-done':
      return store.line(member,async()=>{
        const d=await loadDraft(store,f,{strict:true});
        if(!d.chapters.some(t=>t.trim()))return {ok:false,code:'WRITE_EMPTY'};
        const out=Buffer.from(draftMarkdown(d),'utf8'),outSha=sha(out);
        const shaOf=async file=>{try{return sha(await io.readFile(file));}catch{return null;}};
        const list=await loadList(store,f);
        const point=async file=>{list.plan={path:file,outline:CHAPTERS.slice()};await saveList(list);};
        // 솔리오가 만든 앞 초안이 그대로이고 글도 같으면 다시 쓰지 않는다. 다시 쓰면 수정 시각이 바뀌어 고른 것을 저장하려면 다시 읽어야 한다(GA7)
        // 초안 파일이 생긴 뒤에는 파일이 정본이다. 화면 글이 만들 때와 같으면 손님이 파일을 고쳤어도 그 파일을 그대로 계획서로 둔다(설계 검토 지적 2).
        // 목록은 가리킴일 뿐이라 가리킨 뒤 파일을 다시 보지 않는다. 그 뒤 손님이 옮기면 읽기와 저장이 그때 알아본다(설계 14.2 받아들인 한계, r3 GA5)
        if(d.file&&outSha===d.file.sha256){
          const now=await shaOf(d.file.path);
          if(now!==null){
            if(list.plan?.path!==d.file.path)await point(d.file.path);
            return {ok:true,name:path.basename(d.file.path),changed:false,edited:now!==outSha};
          }
        }
        // 손님 폴더의 파일은 덮지도 지우지도 않는다. 글이 바뀌면 늘 새 이름으로 만들고 앞 초안은 그대로 둔다.
        // 갈아 쓰기는 해시를 본 뒤 덮기까지 틈이 남아 손님이 그 사이에 고친 글을 덮을 수 있었다(GPT 다시 검수 GA4, 설계 14.2를 다시 봄)
        const t=new Date(),two=n=>String(n).padStart(2,'0');
        const base='사업계획서_초안_'+t.getFullYear()+two(t.getMonth()+1)+two(t.getDate())+'-'+two(t.getHours())+two(t.getMinutes());
        // 부서 폴더 → 기능 폴더. 부서 폴더에 쓸 수 없으면 기능 폴더에(GA8)
        let done=null;
        for(const dir of [...new Set([dept.folder,f.d].filter(Boolean))]){
          const temp=path.join(dir,'.solio-'+randomUUID()+'.tmp');
          try{
            if(dir===f.d)await io.mkdir(dir,{recursive:true,mode:0o700});
            const handle=await io.open(temp,'wx',0o600);
            try{await handle.writeFile(out);await handle.sync();}finally{await handle.close();}
            // 새 이름으로 잇는다. 같은 이름이 있으면 -2. 계정은 잇는 바로 그 차례에 본다(GA2 · GA5)
            // 늘 새 이름으로 잇는다. 같은 글의 앞 파일을 다시 잇지 않는다 — 기록이 가리키지 않던 파일이 다시 계획서가 되어 어긋났다(GPT 다시 검수 r5 GA1 · GA2)
            done=await linkUnique(io,temp,dir,base,'.md',current);
            break;
          }catch(e){
            if(e.code==='AUTH_CHANGED')return {ok:false,code:'AUTH_CHANGED'};
            if(!['EACCES','EPERM','EROFS','ENOENT','ENOTDIR'].includes(e.code))return {ok:false,code:'SAVE'};
          }
          finally{await io.rm(temp,{force:true}).catch(()=>{});}
        }
        if(!done)return {ok:false,code:'SAVE'};
        const before=d.file;
        try{
          // 만들 때의 크기와 시각을 적어 둔다. 화면이 「파일에서 고쳤는지」를 알아본다(설계 검토 지적 2)
          const st=await io.stat(done.path).catch(()=>null);
          d.file={path:done.path,sha256:outSha,...(st?{size:st.size,mtimeMs:Math.round(st.mtimeMs)}:{})};
          await store.writeJson(f.d,'draft.json',d,current);
          await point(done.path);
        }catch(e){
          // 손님 폴더에서는 아무것도 지우지 않는다. 열린 핸들로 쓴 글까지 지울 수 있는 거두기를 없앴다(GPT 다시 검수 r4 GA4).
          // draft.json을 썼으면 그대로 새 파일을 가리킨다. 다시 끝내면 같은 글이라 그 파일을 목록에 잇는다.
          // draft.json을 못 썼으면 새 파일은 어느 기록도 가리키지 않은 채 남는다. 다시 끝내면 새 이름이 된다(받아들인 한계)
          return {ok:false,code:e.code==='AUTH_CHANGED'?'AUTH_CHANGED':'SAVE'};
        }
        // 앞 초안이 아직 폴더에 있을 때만 「그대로 두었다」고 말한다(r3 GA3)
        const kept=before&&before.path!==done.path&&await io.stat(before.path).then(()=>true,()=>false)?path.basename(before.path):null;
        return {ok:true,name:path.basename(done.path),changed:true,kept};
      });
    case 'clear':
      if(args.confirm!==true)return {ok:false,code:'VALUE'};
      return store.line(member,async()=>{
        // 쓰던 초안(draft.json)도 지운다. 만든 초안 파일과 계획서 · 회사 자료 파일은 그대로 둔다(설계 검토 4)
        // 지우기마다 계정을 본 바로 그 차례에 동기로 지운다. 본 뒤 지우기 전에 다른 일이 끼지 않는다(GPT 다시 검수 GA5)
        const rmNow=(p,o)=>{if(!current())throw fail('AUTH_CHANGED');syncOf(io,'rm')(p,o);};
        try{
          rmNow(f.reads,{recursive:true,force:true});rmNow(f.state,{force:true});rmNow(f.draft,{force:true});
          // 깨진 목록은 「기록 지우기」로 지워야 다시 고를 수 있다(코드 검수 P2-7). 멀쩡한 목록은 남긴다
          let broken=false;try{await loadList(store,f);}catch{broken=true;}
          if(broken)rmNow(f.list,{force:true});
        }catch(e){if(e.code==='AUTH_CHANGED')return {ok:false,code:'AUTH_CHANGED'};throw e;}
        return {ok:true};
      });
    default:return {ok:false,code:'VALUE'};
  }
}

/* ── 새 파일로 저장(설계 4.3) ── */
function draftAnchor(read,itemName){
  const item=read.items.find(x=>x.item===itemName);
  if(!item||!item.secs.length)return null;
  const secs=read.sections.filter(s=>item.secs.includes(s.id));
  for(let si=secs.length-1;si>=0;si--){
    const body=[...secs[si].paras].reverse().find(i=>{const p=read.paragraphs[i];return p&&!p.heading&&!p.inTable&&!p.toc&&p.text.trim();});
    if(body!=null)return {after:body,plain:false};
  }
  const head=secs.find(s=>s.head!=null);
  return head?{after:head.head,plain:true}:null;
}
function plannedChanges(read,state){
  const changes=[];let skipped=0;
  for(const [key,choice] of Object.entries(state.choices||{})){
    const note=read.notes[Number(key.slice(1))];
    if(!note||!['fix','edit'].includes(choice.kind))continue;
    const text=choice.kind==='fix'?note.fix:choice.text;
    if(!text||!note.canReplace){skipped++;continue;}
    if(changes.some(c=>c.para===note.para&&c.from<note.to&&note.from<c.to)){skipped++;continue;}
    changes.push({para:note.para,from:note.from,to:note.to,text:ox.clean(text).replace(/[\r\n\u000B]+/g,' ')});
  }
  const inserts=[];
  for(const [item,d] of Object.entries(state.drafts||{})){
    const at=draftAnchor(read,item);
    if(!at||!d?.text){skipped++;continue;}
    inserts.push({...at,text:ox.clean(d.text)});
  }
  return {changes,inserts,skipped};
}
/* 한 문단의 고침 둘 이상은 그 사이 글까지 덮는 한 편집으로 합친다. 한 글 조각 안의 두 고침이 같은 XML 자리를 고쳐 저장 전체가 막히던 것(코드 검수 P1-3).
   합친 자리가 바꿀 수 없는 조각(탭, 필드)을 걸치면 앞의 고침만 넣고 나머지는 뺀 수로 센다 */
function mergeParagraphChanges(changes,textOf,can){
  const out=[];let skipped=0;
  const groups=new Map();
  for(const c of changes){if(!groups.has(c.para))groups.set(c.para,[]);groups.get(c.para).push(c);}
  for(const [para,list] of groups){
    list.sort((x,y)=>x.from-y.from);
    if(list.length===1){out.push(list[0]);continue;}
    const a=list[0].from,b=Math.max(...list.map(c=>c.to));
    if(!can(para,a,b)){out.push(list[0]);skipped+=list.length-1;continue;}
    let seg=textOf(para).slice(a,b);
    for(const c of [...list].sort((x,y)=>y.from-x.from))seg=seg.slice(0,c.from-a)+c.text+seg.slice(c.to-a);
    out.push({para,from:a,to:b,text:seg,merged:list.map(c=>c.text)});
  }
  return {changes:out,skipped};
}
/* 같은 이름이 있으면 -2, -3. 하드 링크가 안 되는 드라이브(exFAT 등)는 있는 이름을 덮지 않는 복사로 대신한다(코드 검수 P3-10) */
/* 새 이름으로 잇는다(덮지 않음). 같은 이름이 있으면 -2, -3. 잇기는 계정(guard)을 본 바로 그 차례에 동기로 한다(GPT 다시 검수 GA5) */
async function linkUnique(io,temp,dir,base,ext,guard=()=>true){
  for(let n=1;n<100;n++){
    const name=base+(n>1?'-'+n:'')+ext,target=path.join(dir,name);
    if(!guard())throw fail('AUTH_CHANGED');
    try{syncOf(io,'link')(temp,target);return {name,path:target};}
    catch(e){
      if(e.code==='EEXIST')continue;
      if(!['EISDIR','ENOTSUP','EXDEV','EPERM','EINVAL','ENOSYS'].includes(e.code))throw e;
      if(!guard())throw fail('AUTH_CHANGED');
      try{syncOf(io,'copyFile')(temp,target,fsSync.constants.COPYFILE_EXCL);return {name,path:target};}
      catch(e2){if(e2.code==='EEXIST')continue;throw e2;}
    }
  }
  throw fail('SAVE');
}
async function saveCopy({read,state,io,fallbackDir,now=Date.now(),current=()=>true}){
  let plan;
  try{plan=await readPlan(io,read.plan.path);}catch(e){return {ok:false,code:e.code||'PLAN_MISSING'};}
  if(plan.sha256!==read.plan.sha256)return {ok:false,code:'PLAN_CHANGED'};
  const planned=plannedChanges(read,state);
  const merged=mergeParagraphChanges(planned.changes,i=>plan.paragraphs[i].text,plan.kind==='docx'?(i,a,b)=>ox.canReplace(plan.doc.paragraphs[i],a,b):()=>true);
  const {changes}=merged,{inserts}=planned,skipped=planned.skipped+merged.skipped;
  if(!changes.length&&!inserts.length)return {ok:false,code:'NOTHING'};
  let out;
  if(plan.kind==='docx'){
    try{out=ox.docxApply(plan.doc,[...changes,...inserts]);}catch{return {ok:false,code:'SAVE'};}
    let again;
    try{again=ox.docxDocument(out);}catch{return {ok:false,code:'SAVE'};}
    const tables=xml=>(xml.match(/<w:tbl>/g)||[]).length+(xml.match(/<w:tbl\s/g)||[]).length;
    const texts=again.paragraphs.map(p=>p.text).join('\n');
    if(!ox.wellFormed(again.xml)||again.paragraphs.length!==plan.doc.paragraphs.length+inserts.length||tables(again.xml)!==tables(plan.doc.xml)||
      changes.some(c=>(c.merged||[c.text]).some(t=>!texts.includes(t)))||inserts.some(c=>!texts.includes(c.text.split('\n')[0])))return {ok:false,code:'SAVE'};
  }else{
    let raw=plan.raw;
    const edits=[...changes.map(c=>({at:plan.paragraphs[c.para].start+c.from,end:plan.paragraphs[c.para].start+c.to,text:c.text})),
      ...inserts.map(c=>({at:plan.paragraphs[c.after].end,end:plan.paragraphs[c.after].end,text:(plan.kind==='md'?'\n\n':'\n')+c.text}))].sort((a,b)=>b.at-a.at);
    for(const e of edits)raw=raw.slice(0,e.at)+e.text+raw.slice(e.end);
    out=Buffer.from(raw,'utf8');
  }
  // 파일 이름의 시각은 이 PC의 시각으로 쓴다. 세계 표준시로 찍혀 아홉 시간 어긋나던 것(11-23 앱 창 확인)
  const t=new Date(now),two=n=>String(n).padStart(2,'0');
  const ext=path.extname(read.plan.path),base=path.basename(read.plan.path,ext)+'_솔리오고침_'+t.getFullYear()+two(t.getMonth()+1)+two(t.getDate())+'-'+two(t.getHours())+two(t.getMinutes());
  for(const dir of [path.dirname(read.plan.path),fallbackDir].filter(Boolean)){
    const temp=path.join(dir,'.solio-'+randomUUID()+'.tmp');
    try{
      const handle=await io.open(temp,'wx',0o600);
      try{await handle.writeFile(out);await handle.sync();}finally{await handle.close();}
      const done=await linkUnique(io,temp,dir,base,ext,current);
      return {ok:true,...done,skipped};
    }catch(e){if(e.code==='AUTH_CHANGED')return {ok:false,code:'AUTH_CHANGED'};if(!['EACCES','EPERM','EROFS'].includes(e.code))return {ok:false,code:'SAVE'};}
    finally{await io.rm(temp,{force:true}).catch(()=>{});}
  }
  return {ok:false,code:'SAVE'};
}

/* ── 읽기(설계 3.2). 영수증 {summary, ref, alert}를 돌려준다 ── */
async function run(spec,hooks,tools){
  const {store,io}=tools;
  const dept={id:spec.departmentId};
  const f=files(store,spec.member,dept);
  const started=Date.now();
  const at=Date.now();
  const id=stamp(at)+'-'+spec.id;
  const base={id,taskId:spec.id,at,provider:spec.provider,plan:null,data:[],paragraphs:[],sections:[],notes:[],items:[],failedChunks:0,totalChunks:0,dropped:{}};
  const write=async record=>{
    if(!await hooks.checkpoint())throw fail('CANCELLED');
    await store.line(spec.member,async()=>{
      await store.writeJson(f.reads,id+'.json',record,()=>true);
      const names=(await io.readdir(f.reads)).filter(n=>n.endsWith('.json')).sort();
      for(const old of names.slice(0,Math.max(0,names.length-LIMIT.reads)))await io.rm(path.join(f.reads,old),{force:true});
    });
  };
  const failed=async(reason,extra={})=>{await write({...base,...extra,status:'failed',reason});return {summary:'이번에는 사업계획서를 읽지 못했습니다.',ref:id,alert:true};};
  const list=await loadList(store,f).catch(()=>null);
  if(!list)return failed('LIST');
  if(!list.plan)return failed('PLAN_MISSING');
  let plan;
  try{plan=await readPlan(io,list.plan.path);}catch(e){return failed(e.code||'PLAN_READ');}
  const paragraphs=plan.paragraphs.map(p=>({text:p.text.slice(0,20000),level:p.level,toc:p.toc,inTable:p.inTable}));
  const total=paragraphs.reduce((n,p)=>n+p.text.length,0);
  const planInfo={path:list.plan.path,name:path.basename(list.plan.path),kind:plan.kind,sha256:plan.sha256,stat:plan.stat};
  if(total>LIMIT.planChars)return failed('PLAN_TOO_LONG',{plan:planInfo});
  if(!paragraphs.some(p=>p.text.trim()&&!p.toc))return failed('PLAN_EMPTY',{plan:planInfo});
  const data=[];let chars=0;
  for(const d of list.data.slice(0,LIMIT.dataFiles)){
    let x;try{x=await readData(io,d.path);}catch(e){return failed(e.code,{plan:planInfo,dataName:path.basename(d.path)});}
    if(chars+x.text.length>LIMIT.dataChars)return failed('DATA_TOO_LONG',{plan:planInfo});
    chars+=x.text.length;data.push(x);
  }
  const dh=draftHeads(paragraphs);
  const headAt=dh?new Set(dh.heads.map(h=>h.i)):null;
  // 첫 장 앞의 표제는 묶음이 아니다(GA9). 일곱 장 제목 줄과, 첫 장 뒤에 손님이 더한 마크다운 제목 줄(「## 부록」)이 묶음을 가른다(r3 GA1).
  // 손님이 쓴 「1. 온라인 판매」 같은 줄은 마크다운 제목이 아니라 묶음이 되지 않는다. 솔리오는 손님 줄의 맨 앞 #을 \#로 막는다
  const titleAt=new Set(dh?.titles||[]);
  const secParas=dh?paragraphs.map((p,i)=>titleAt.has(i)?{...p,toc:true}:p):paragraphs;
  // 장 제목과 같은 높이 이상(#, ##)만 묶음을 가른다. 「### 세부」 아래 글은 그 장의 묶음이다(설계 검토 지적 4)
  const secs=dh?ck.sections(secParas,(p,i)=>headAt.has(i)||(!titleAt.has(i)&&p.level!=null&&p.level<=dh.level&&!!p.text.trim())):ck.sections(paragraphs);
  // 빈 장: 초안 그대로 읽을 때 본체가 안다(설계 검토 8). 쓰는 중인 draft.json이 아니라 계획서 파일의 내용으로 본다(GA3)
  // 장의 끝: 다음 장 제목, 또는 장 제목과 같은 높이 이상의 제목 줄(손님이 더한 「## 부록」). 「### 세부」 아래 글은 그 장의 글이다
  const chapterEnd=j=>{const h=dh.heads[j];for(let i=h.i+1;i<paragraphs.length;i++){if(headAt.has(i))return i;const p=paragraphs[i];if(p.level!=null&&p.level<=paragraphs[h.i].level)return i;}return paragraphs.length;};
  const empty=dh?dh.heads.map((h,j)=>({h,end:chapterEnd(j)})).filter(({h,end})=>!paragraphs.slice(h.i+1,end).some(p=>p.level==null&&p.text.trim()))
    .map(({h})=>({chapter:h.k,name:CHAPTERS[h.k],sec:secs.find(x=>x.head===h.i)?.id??null})):[];
  const headSet=new Set(secs.map(s=>s.head).filter(v=>v!=null));
  const shown=paragraphs.map((p,i)=>({text:p.text,heading:headSet.has(i),toc:p.toc,inTable:p.inTable}));
  const parts=ck.chunks(secs,paragraphs);
  const items=itemsOf(list);
  const allData=new Set();for(const d of data)for(const v of ck.numbers(d.text,{scale:d.scale}).set)allData.add(v);
  // 문단 맨 앞의 차례 표시(장 번호 01~07, 「## 5. 성장 전략」, 「1. 」)는 숫자 근거가 아니다. 모든 계획서에서 뺀다 — 초안 알아보기와 떼어 놓는다(GA4, 설계 검토 지적 1)
  const planNumbers=ck.numbers(paragraphs.map(p=>ck.ordinalFree(p.text,p.level!=null)).join('\n')).set;
  const canReplace=plan.kind==='docx'?(pi,a,b)=>ox.canReplace(plan.doc.paragraphs[pi],a,b):()=>true;
  Object.assign(base,{plan:planInfo,data:data.map(d=>({name:d.name,sha256:d.sha256})),paragraphs:shown,sections:secs,totalChunks:parts.length,fromDraft:!!dh,empty});
  const notes=[],dropped={};
  const addDrops=d=>{for(const [k,v] of Object.entries(d))dropped[k]=(dropped[k]||0)+v;};
  const stop=code=>['LIMIT','LOGIN','CANCELLED','AUTH_CHANGED','NO_CLI','NATIVE'].includes(code);
  let failedChunks=0;
  for(let i=0;i<parts.length;i++){
    if(Date.now()-started>RUN_MS){failedChunks+=parts.length-i;break;}
    const part=parts[i];
    hooks.progress?.({part:i+1,total:parts.length+1,title:part.title});
    const text=part.paras.map(pi=>paragraphs[pi].text).join('\n');
    const prompt=ck.chunkPrompt({chunk:part,paragraphs,title:part.title,files:ck.excerpt(text,data),items,guides:plan.guides});
    try{
      const answer=await tools.turn(prompt,notesSchema,{timeoutMs:TURN_MS,effort:EFFORT});
      const r=ck.checkNotes(answer,{chunk:part,paragraphs,files:data,allData,canReplace});
      notes.push(...r.notes);addDrops(r.dropped);
    }catch(e){
      if(stop(e.code)){if(e.code==='CANCELLED')throw e;await failed(e.code);throw e;}
      failedChunks++;
    }
  }
  hooks.progress?.({part:parts.length+1,total:parts.length+1,title:'평가 항목'});
  let checked=null,itemsFailed=false;
  try{
    const schema=structuredClone(itemsSchemaBase);
    schema.properties.items.items.properties.item.enum=items;
    const answer=await tools.turn(ck.itemsPrompt({secs,paragraphs,items,guides:plan.guides,draft:!!dh}),schema,{timeoutMs:TURN_MS,effort:EFFORT});
    checked=ck.checkItems(answer,{items,secs,planNumbers,allData,minChars:dh?150:600});addDrops(checked.dropped);
  }catch(e){
    if(stop(e.code)){if(e.code==='CANCELLED')throw e;await failed(e.code);throw e;}
    itemsFailed=true;
  }
  const status=itemsFailed||failedChunks*2>parts.length?'failed':failedChunks?'partial':'ok';
  const record={...base,status,reason:status==='failed'?(itemsFailed?'ITEMS':'CHUNKS'):null,failedChunks,notes,items:checked?.items||[],dropped};
  await write(record);
  if(status==='failed')return {summary:'이번에는 사업계획서를 읽지 못했습니다.',ref:id,alert:true};
  const thin=record.items.filter(x=>x.thin).length,count=notes.length+thin+empty.length;
  return {summary:count?`사업계획서에서 고칠 곳 ${count}곳을 찾았습니다.`:'사업계획서에서 고칠 곳을 찾지 못했습니다.',ref:id,alert:count>0};
}

module.exports={id:'bizplan',name:'사업계획서',
  attach:dept=>/기획/.test(String(dept?.name||'')),
  snapshot,act,run,
  // 시험용
  readPlan,readData,saveCopy,plannedChanges,mergeParagraphChanges,draftAnchor,draftMarkdown,CHAPTERS,LIMIT};
