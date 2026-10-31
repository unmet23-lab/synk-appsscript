import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,rm,appendFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createCompanyApp} from './server.mjs';

// Synthetic inputs only. No live credentials, production data or external calls.
const at='2026-10-31T00:00:00.000Z';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const percentile=(values,p)=>[...values].sort((a,b)=>a-b)[Math.ceil(values.length*p)-1];
const sourceSha256=createHash('sha256').update(['store.mjs','client-projects.mjs','client-search.mjs','client-notifications.mjs','server.mjs'].map(file=>readFileSync(new URL(file,import.meta.url))).join('\n')).digest('hex');

for(const projectCount of [250,1000])test(`API performance with ${projectCount} synthetic projects and current access checks`,async t=>{
  const nativeFetch=globalThis.fetch;
  t.mock.method(globalThis,'fetch',(url,...args)=>{const parsed=new URL(typeof url==='string'||url instanceof URL?url:url.url);assert.equal(parsed.hostname,'127.0.0.1','External fetch is forbidden in this fixture');return nativeFetch(url,...args);});
  let reads={calls:0,rows:0};
  const nativePrepare=DatabaseSync.prototype.prepare;
  t.mock.method(DatabaseSync.prototype,'prepare',function(sql){const statement=nativePrepare.call(this,sql);if(/FROM documents/i.test(sql))for(const method of ['all','get']){const native=statement[method];statement[method]=function(...args){const value=native.apply(this,args);reads.calls++;reads.rows+=Array.isArray(value)?value.length:value?1:0;return value;};}return statement;});
  const directory=await mkdtemp(join(tmpdir(),'synk-api-performance-'));
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,backgroundJobsEnabled:false,automationHealthSchedule:false,synkIdentityConfig:null,synkCustomerIdentityConfig:null,teachingConfig:null,clock:()=>at});
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-api-performance-'));await rm(directory,{recursive:true,force:true});});
  const owner=app.store.createUser({name:'Synthetic owner',email:'owner@performance.test',role:'member',teamId:'a'});
  const other=app.store.createUser({name:'Synthetic other',email:'other@performance.test',role:'member',teamId:'b'});
  const template=app.clientProjects.save(owner,{title:'자막 프로젝트',customerName:'합성 고객',internalNotes:'자막 제작 메모'}).project;
  app.store.remove('clientProjects',template.id);
  app.store.transaction(()=>{
    for(let n=0;n<100;n++)app.store.put('users','synthetic-user-'+n,{id:'synthetic-user-'+n,active:true,role:'member',teamId:'b',name:'Synthetic',email:'synthetic'+n+'@performance.test'});
    for(let n=0;n<projectCount;n++)app.store.put('clientProjects',id(n),{...template,id:id(n),ownerId:n%10===0?owner.id:other.id,teamId:n%10===0?'a':'b',title:'자막 프로젝트 '+n,
      messages:Array.from({length:20},(_,m)=>({id:id(100000+n*20+m),author:'staff',visibility:'customer',text:'자막 검토 의견 '+m,at})),
      history:Array.from({length:50},(_,m)=>({id:id(1000000+n*50+m),action:'synthetic history '+'.'.repeat(200),actor:owner.id,at}))});
  });
  const csrf='synthetic-performance-csrf',session=app.store.mint('session',owner.id,{csrfToken:csrf},30);
  await app.start();const base='http://127.0.0.1:'+app.server.address().port;
  const endpoints=[['health','/api/health'],['identity','/api/me'],['projects','/api/client-projects'],['research','/api/creative-research'],['social','/api/social/simple'],['messenger-summary','/api/workspace-summary'],['search','/api/client-search']];
  const results=[];
  for(const [name,path]of endpoints){
    const samples=[];
    for(let round=0;round<9;round++){
      reads={calls:0,rows:0};const cpu=process.cpuUsage(),start=performance.now();
      const response=await fetch(base+path,{headers:{Cookie:'synk_company_session='+session,...(name==='search'?{Origin:app.origin,'Content-Type':'application/json','X-CSRF-Token':csrf}:{})},...(name==='search'?{method:'POST',body:JSON.stringify({query:'자막',limit:20})}:{})});
      const body=await response.arrayBuffer(),ms=performance.now()-start,used=process.cpuUsage(cpu);
      assert.equal(response.status,200,name);const data=JSON.parse(Buffer.from(body));
      if(name==='search'){assert.equal(data.total,projectCount/10*22);assert.equal(data.items.length,20);}
      if(name==='projects')assert.equal(data.projects.length,projectCount/10);
      if(round>1)samples.push({ms,cpuMs:(used.user+used.system)/1000,sqlCalls:reads.calls,sqlRows:reads.rows,bytes:body.byteLength});
    }
    const result={name,n:samples.length,p50Ms:+percentile(samples.map(x=>x.ms),.5).toFixed(3),p95Ms:+percentile(samples.map(x=>x.ms),.95).toFixed(3),cpuP50Ms:percentile(samples.map(x=>x.cpuMs),.5),sqlCalls:samples.at(-1).sqlCalls,sqlRows:samples.at(-1).sqlRows,bytes:samples.at(-1).bytes};results.push(result);
    // Work budgets are deterministic; elapsed-time assertions would depend on
    // this PC's load. Count document reads, including the response auth checks.
    if(name==='projects')assert.ok(result.sqlCalls<=12,'Project DTOs must reuse user reads within one request');
    if(name==='messenger-summary')assert.ok(result.sqlCalls<=25,'Unread counts must not build every project workspace');
    if(name==='search')assert.ok(result.sqlRows<=projectCount/10+110,'Search must decode only currently permitted project documents');
  }
  const record={at:new Date().toISOString(),node:process.version,sourceSha256,projectCount,visibleProjects:projectCount/10,users:102,fixture:'synthetic; in-process HTTP client and server; 2 warmups + 7 samples',memory:process.memoryUsage(),results};
  if(process.env.SYNK_API_PERFORMANCE_EVIDENCE_PATH)await appendFile(process.env.SYNK_API_PERFORMANCE_EVIDENCE_PATH,JSON.stringify(record)+'\n');
  t.diagnostic('API_PERFORMANCE '+JSON.stringify(record));
});
