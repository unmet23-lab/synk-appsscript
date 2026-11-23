'use strict';
/*
 * 기획부 「사업계획서」(사업계획서_설계.md). 넣기 → 읽기 → 메모 고치기 → 새 파일로 저장.
 * 파일 읽기와 쓰기는 이 본체가 하고, AI는 tools.turn(도구 없는 차례)으로 칸만 채운다.
 * 저장 자리: features/bizplan/<부서>/list.json(손님이 고른 것), state.json(고름), reads/<시각>-<업무>.json(읽은 결과)
 */
const path=require('node:path');
const {createHash,randomUUID}=require('node:crypto');
const ox=require('./office-ooxml.cjs');
const ck=require('./office-bizplan-check.cjs');

const fail=(code,detail)=>Object.assign(new Error(code),{code,...(detail?{detail}:{})});
const PLAN_EXT=new Set(['.docx','.md','.txt']);
const DATA_EXT=new Set(['.txt','.md','.csv','.docx','.xlsx']);
const LOCKED_EXT=new Set(['.hwp','.hwpx','.pdf','.doc','.docm']);
const LIMIT={planBytes:10*1024*1024,planChars:200000,dataBytes:5*1024*1024,dataChars:400000,dataFiles:10,criteria:4000,userText:2000,reads:5};
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
const files=(store,member,dept)=>{const d=store.dir(member,'bizplan',dept.id);return {d,list:path.join(d,'list.json'),state:path.join(d,'state.json'),reads:path.join(d,'reads')};};
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
  let planChanged=false;
  if(read&&list.plan&&read.plan?.path===list.plan.path){
    try{const st=await io.stat(list.plan.path);planChanged=st.size!==read.plan.stat.size||Math.round(st.mtimeMs)!==read.plan.stat.mtimeMs;}catch{planChanged=true;}
  }
  return {
    broken,
    list:{plan:list.plan?{name:path.basename(list.plan.path)}:null,data:list.data.map(x=>({name:path.basename(x.path)})),criteria:list.criteria,items:itemsOf(list)},
    read:read?{id:read.id,at:read.at,status:read.status,reason:read.reason||null,provider:read.provider,failedChunks:read.failedChunks||0,totalChunks:read.totalChunks||0,
      plan:{name:read.plan.name,kind:read.plan.kind,samePlan:!!list.plan&&read.plan.path===list.plan.path},dataNames:read.data.map(d=>d.name),
      paragraphs:read.paragraphs,sections:read.sections,items:read.items,
      notes:read.notes.map((n,i)=>({...n,key:'n'+i,sourceName:n.source?read.data[n.source-1]?.name||'':'',handoff:n.kind==='unsupported'?ck.handoffText(n):'',choice:own?state.choices?.['n'+i]||null:null}))}:null,
    drafts:own?state.drafts||{}:{},
    saved:own?state.saved||null:null,
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
          list.plan={path:file};
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
        const res=await saveCopy({read,state:state.readId===read.id?state:{},io,fallbackDir:dept.folder});
        if(!res.ok)return res;
        await saveState({...state,readId:read.id,saved:{name:res.name,path:res.path,at:Date.now(),skipped:res.skipped}});
        return res;
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
    case 'clear':
      if(args.confirm!==true)return {ok:false,code:'VALUE'};
      return store.line(member,async()=>{
        await io.rm(f.reads,{recursive:true,force:true});await io.rm(f.state,{force:true});return {ok:true};
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
async function linkUnique(io,temp,dir,base,ext){
  for(let n=1;n<100;n++){
    const name=base+(n>1?'-'+n:'')+ext,target=path.join(dir,name);
    try{await io.link(temp,target);return {name,path:target};}
    catch(e){if(e.code==='EEXIST')continue;throw e;}
  }
  throw fail('SAVE');
}
async function saveCopy({read,state,io,fallbackDir,now=Date.now()}){
  let plan;
  try{plan=await readPlan(io,read.plan.path);}catch(e){return {ok:false,code:e.code||'PLAN_MISSING'};}
  if(plan.sha256!==read.plan.sha256)return {ok:false,code:'PLAN_CHANGED'};
  const {changes,inserts,skipped}=plannedChanges(read,state);
  if(!changes.length&&!inserts.length)return {ok:false,code:'NOTHING'};
  let out;
  if(plan.kind==='docx'){
    try{out=ox.docxApply(plan.doc,[...changes,...inserts]);}catch{return {ok:false,code:'SAVE'};}
    let again;
    try{again=ox.docxDocument(out);}catch{return {ok:false,code:'SAVE'};}
    const tables=xml=>(xml.match(/<w:tbl>/g)||[]).length+(xml.match(/<w:tbl\s/g)||[]).length;
    const texts=again.paragraphs.map(p=>p.text).join('\n');
    if(!ox.wellFormed(again.xml)||again.paragraphs.length!==plan.doc.paragraphs.length+inserts.length||tables(again.xml)!==tables(plan.doc.xml)||
      changes.some(c=>!texts.includes(c.text))||inserts.some(c=>!texts.includes(c.text.split('\n')[0])))return {ok:false,code:'SAVE'};
  }else{
    let raw=plan.raw;
    const edits=[...changes.map(c=>({at:plan.paragraphs[c.para].start+c.from,end:plan.paragraphs[c.para].start+c.to,text:c.text})),
      ...inserts.map(c=>({at:plan.paragraphs[c.after].end,end:plan.paragraphs[c.after].end,text:(plan.kind==='md'?'\n\n':'\n')+c.text}))].sort((a,b)=>b.at-a.at);
    for(const e of edits)raw=raw.slice(0,e.at)+e.text+raw.slice(e.end);
    out=Buffer.from(raw,'utf8');
  }
  const ext=path.extname(read.plan.path),base=path.basename(read.plan.path,ext)+'_솔리오고침_'+new Date(now).toISOString().slice(0,16).replace(/[-:]/g,'').replace('T','-');
  for(const dir of [path.dirname(read.plan.path),fallbackDir].filter(Boolean)){
    const temp=path.join(dir,'.solio-'+randomUUID()+'.tmp');
    try{
      const handle=await io.open(temp,'wx',0o600);
      try{await handle.writeFile(out);await handle.sync();}finally{await handle.close();}
      const done=await linkUnique(io,temp,dir,base,ext);
      return {ok:true,...done,skipped};
    }catch(e){if(!['EACCES','EPERM','EROFS'].includes(e.code))return {ok:false,code:'SAVE'};}
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
  const secs=ck.sections(paragraphs);
  const heads=new Set(secs.map(s=>s.head).filter(v=>v!=null));
  const shown=paragraphs.map((p,i)=>({text:p.text,heading:heads.has(i),toc:p.toc,inTable:p.inTable}));
  const parts=ck.chunks(secs,paragraphs);
  const items=itemsOf(list);
  const allData=new Set();for(const d of data)for(const v of ck.numbers(d.text,{scale:d.scale}).set)allData.add(v);
  const planNumbers=ck.numbers(paragraphs.map(p=>p.text).join('\n')).set;
  const canReplace=plan.kind==='docx'?(pi,a,b)=>ox.canReplace(plan.doc.paragraphs[pi],a,b):()=>true;
  Object.assign(base,{plan:planInfo,data:data.map(d=>({name:d.name,sha256:d.sha256})),paragraphs:shown,sections:secs,totalChunks:parts.length});
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
    const answer=await tools.turn(ck.itemsPrompt({secs,paragraphs,items,guides:plan.guides}),schema,{timeoutMs:TURN_MS,effort:EFFORT});
    checked=ck.checkItems(answer,{items,secs,planNumbers,allData});addDrops(checked.dropped);
  }catch(e){
    if(stop(e.code)){if(e.code==='CANCELLED')throw e;await failed(e.code);throw e;}
    itemsFailed=true;
  }
  const status=itemsFailed||failedChunks*2>parts.length?'failed':failedChunks?'partial':'ok';
  const record={...base,status,reason:status==='failed'?(itemsFailed?'ITEMS':'CHUNKS'):null,failedChunks,notes,items:checked?.items||[],dropped};
  await write(record);
  if(status==='failed')return {summary:'이번에는 사업계획서를 읽지 못했습니다.',ref:id,alert:true};
  const thin=record.items.filter(x=>x.thin).length,count=notes.length+thin;
  return {summary:count?`사업계획서에서 고칠 곳 ${count}곳을 찾았습니다.`:'사업계획서에서 고칠 곳을 찾지 못했습니다.',ref:id,alert:count>0};
}

module.exports={id:'bizplan',name:'사업계획서',
  attach:dept=>/기획/.test(String(dept?.name||'')),
  snapshot,act,run,
  // 시험용
  readPlan,readData,saveCopy,plannedChanges,draftAnchor,LIMIT};
