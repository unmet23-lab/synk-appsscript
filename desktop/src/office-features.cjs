'use strict';
/*
 * 셋째 조각의 기능 틀(기능줄_경쟁사_설계.md 3절, 사업계획서_설계.md 4절).
 * - 기능 목록: 기능마다 id, name, attach(부서), snapshot, act, run을 둔다. 손님이 기능을 만들지는 않는다.
 * - 저장: userData/Office/<계정>/features/<기능>/<부서>/ 아래. office.json에 넣지 않는다.
 *   계정마다 한 줄 서기 안에서 읽고 쓰고, 쓰기는 같은 폴더의 임시 파일을 이름 바꿔 넣는다. 이름 바꾸기 바로 앞에 계정을 다시 본다.
 * - 진행: 도는 기능 업무의 진행(묶음 2/5)은 메모리에만 둔다.
 */
const fs=require('node:fs/promises');
const {renameSync}=require('node:fs');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {ID:MEMBER}=require('./site-visits.cjs');

const fail=code=>Object.assign(new Error(code),{code});
const FEATURE_ID=/^[a-z][a-z0-9-]{1,31}$/;
const DEPT_ID=/^[A-Za-z0-9_-]{4,32}$/;
const MAX_JSON=40*1024*1024;

function createFeatureStore(userData,io=fs){
  const chains=new Map();
  function dir(member,feature,dept){
    if(typeof member!=='string'||!MEMBER.test(member)||['.','..'].includes(member))throw fail('ACCOUNT');
    if(!FEATURE_ID.test(feature)||!DEPT_ID.test(dept))throw fail('VALUE');
    return path.join(userData,'Office',member,'features',feature,dept);
  }
  /* 계정마다 한 줄. work 안에서 파일을 새로 읽고 고친다 */
  function line(member,work){
    const prev=chains.get(member)||Promise.resolve();
    const next=prev.then(work);
    chains.set(member,next.catch(()=>{}));
    return next;
  }
  async function readJson(file,{missing=null}={}){
    let raw;
    try{if((await io.stat(file)).size>MAX_JSON)throw fail('STORAGE');raw=await io.readFile(file,'utf8');}
    catch(e){if(e.code==='ENOENT')return missing;throw e;}
    try{return JSON.parse(raw);}catch{throw fail('BROKEN');}
  }
  async function writeJson(folder,name,value,current=()=>true){
    await io.mkdir(folder,{recursive:true,mode:0o700});
    const temp=path.join(folder,'.'+name+'.'+randomUUID()+'.tmp');
    try{
      const handle=await io.open(temp,'wx',0o600);
      try{await handle.writeFile(JSON.stringify(value),'utf8');await handle.sync();}finally{await handle.close();}
      if(!current())throw fail('AUTH_CHANGED');
      (io.renameSync||renameSync)(temp,path.join(folder,name));
    }finally{await io.rm(temp,{force:true}).catch(()=>{});}
  }
  return {dir,line,readJson,writeJson,io};
}

/* 기능 목록. 둘째 기능부터 이 줄에 더한다 */
function features(){
  return {bizplan:require('./office-feature-bizplan.cjs')};
}
/* 부서에 붙는 기능(기능줄_경쟁사_설계.md 3.2). 이름으로 붙고, 한 번 쓰면 부서 번호로 남는다 */
function attached(department,used=new Set()){
  const out=[];
  for(const [id,f] of Object.entries(features())){
    if(f.attach(department)||used.has(id+'/'+department.id))out.push({id,name:f.name});
  }
  return out;
}

function createOfficeFeatures({userData,io=fs,tasks=null,pick=null,reveal=null,departments=async()=>[]}){
  const store=createFeatureStore(userData,io);
  const T=()=>typeof tasks==='function'?tasks():tasks;
  const progress=new Map();
  const list=features();
  const featureOf=id=>Object.hasOwn(list,id)?list[id]:null;
  async function deptOf(a,departmentId){
    const all=await departments(a);
    return Array.isArray(all)?all.find(d=>d?.id===departmentId)||null:null;
  }
  async function snapshot(a,{feature,departmentId}){
    const f=featureOf(feature);
    if(!f||!DEPT_ID.test(departmentId||''))return {ok:false,code:'VALUE'};
    const dept=await deptOf(a,departmentId);
    if(!dept)return {ok:false,code:'NOT_FOUND'};
    try{
      const s=await f.snapshot({store,member:a.synk_user_id,dept,io});
      return {ok:true,feature,departmentId,progress:progress.get(a.synk_user_id+'/'+feature+'/'+departmentId)||null,...s};
    }catch(e){return {ok:false,code:e.code||'STORAGE'};}
  }
  async function act(a,{feature,departmentId,action,args},current){
    const f=featureOf(feature);
    if(!f||!DEPT_ID.test(departmentId||'')||typeof action!=='string')return {ok:false,code:'VALUE'};
    const dept=await deptOf(a,departmentId);
    if(!dept)return {ok:false,code:'NOT_FOUND'};
    try{
      return await f.act({store,member:a.synk_user_id,dept,action,args:args&&typeof args==='object'?args:{},io,current,
        pick,reveal,departments:()=>departments(a),
        submitFeature:provider=>T()?T().submitFeature(a,{id:randomUUID(),feature,departmentId,provider}):{ok:false,code:'NOT_AVAILABLE'},
        submitTask:input=>T()?T().submit(a,{...input,id:randomUUID()}):{ok:false,code:'NOT_AVAILABLE'}});
    }catch(e){return {ok:false,code:e.code||'STORAGE'};}
  }
  /* 런타임이 부른다. hooks.progress는 메모리 진행만 고친다 */
  async function run(spec,hooks,tools){
    const f=featureOf(spec.feature);
    if(!f)throw fail('PROVIDER');
    const k=spec.member+'/'+spec.feature+'/'+spec.departmentId;
    const withProgress={...hooks,progress:p=>{progress.set(k,{...p,taskId:spec.id});hooks.progress?.(p);hooks.changed?.();}};
    try{return await f.run(spec,withProgress,{...tools,store,io});}
    finally{progress.delete(k);hooks.changed?.();}
  }
  return {snapshot,act,run,store,attached};
}

module.exports={createOfficeFeatures,createFeatureStore,features,attached,FEATURE_ID,DEPT_ID};
