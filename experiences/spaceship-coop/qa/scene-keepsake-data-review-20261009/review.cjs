'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const root=process.cwd(),out=__dirname,sha=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),load=p=>import(pathToFileURL(path.join(root,p)).href);
(async()=>{
 const [{createWorldPlayHost},{emptyPlayState},{initialProgress,clone,SAVE_KEY},{normalizeKeepsakes,mergeSceneCollection},{LAB_SETS}]=await Promise.all([load('experiences/play-common/account-host.mjs'),load('experiences/play-common/play-data.mjs'),load('experiences/word-magic/core.mjs'),load('experiences/word-magic/keepsakes.mjs'),load('experiences/word-magic/content.mjs')]);
 const expected={'experiences/word-magic/app.mjs':'540d3565b8399dd0a5b5654a6b4dac028735de65ddcb48a6cb3a1f674f26db8a','experiences/word-magic/core.mjs':'fecbd5a7601c33eb5cfcc620e11cd9f73f8c783d6cf9fc1de59e5b61da526a38','experiences/word-magic/keepsakes.mjs':'1a3196d74e838f4c0e3d1ddcdcadf9bc8beab299daeb110c2ae8e4d37ea2dc2a','experiences/word-magic/keepsake-view.mjs':'9b1c94e0df754f72f8691a92052d44b2b08cf64cda8d8ca020b88b9128185fa0'};
 for(const [file,hash] of Object.entries(expected))assert.equal(sha(file),hash,'Final frozen source drift: '+file);
 const source=fs.readFileSync(path.join(root,'experiences/word-magic/app.mjs'),'utf8'),start=source.indexOf('function persist('),end=source.indexOf('\nfunction feedback(',start),actual=source.slice(start,end);
 // This is the exact unsafe function body observed in the pre-freeze tool read.
 // The full pre-fix WIP app was not separately snapshotted; no full app hash is claimed.
 const observedUnsafe="function persist(keepScenes=true){if(state.preview)return;try{if(keepScenes){const latest=progressStorage.getItem(SAVE_KEY);let record=null;if(latest!==null)try{record=JSON.parse(latest);}catch{}if(record?.version===1)state.progress.keepsakes=normalizeKeepsakes(record.keepsakes);}saved=clone(state.progress);progressStorage.setItem(SAVE_KEY,JSON.stringify(state.progress));$('#save-status').textContent=globalThis.SynkPlayAccount.status().mode==='account'?say('Account save status is shown above','계정 저장 상태는 화면 위에서 확인해요'):say('Progress saved on this browser','이 브라우저에 진행을 저장했어요');}catch{saved=clone(state.progress);$('#save-status').textContent=say('Progress lasts for this visit','이번 방문 동안 진행 유지');}}";
 fs.writeFileSync(path.join(out,'observed-unsafe-persist.cjs'),observedUnsafe+'\n');
 const results=[];
 for(const scenario of ['before-unsafe','after-other-progress','after-collection-only']){
  const old=initialProgress();if(scenario==='after-collection-only')old.introduced=['size'];const remote=emptyPlayState();remote.records[SAVE_KEY]=JSON.stringify(old);let revision=0;
  const envelope=()=>({ok:true,scope:'synk-play',accountId:'synthetic-independent-review',revision,state:clone(remote)}),accepted=[],data=new Map(),storage={get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key)};
  const host=createWorldPlayHost({accountId:'synthetic-independent-review',guard:()=>{},storage,locks:null,client:{load:async()=>envelope(),mutate:async body=>{for(const change of body.changes||[]){if(remote.records[change.key]!==change.previous)throw Object.assign(Error('conflict'),{code:'REVISION_CONFLICT'});accepted.push({previousCompleted:JSON.parse(change.previous).completed,nextCompleted:JSON.parse(change.value).completed});remote.records[change.key]=change.value;}revision++;return envelope();}}});
  try{
   await host.ready();const progressStorage=host.storage(),initialRaw=progressStorage.getItem(SAVE_KEY),cached=JSON.parse(initialRaw),advanced=clone(old);
   if(scenario==='after-collection-only')advanced.keepsakes=[{id:'11111111-1111-4111-8111-111111111111',name:'One scene',createdAt:'2026-10-09T01:00:00.000Z',set:'default',objects:LAB_SETS.default.objects.map(({id,size,open,level})=>({id,size,open,level})),words:['grow','shrink']}];
   else{advanced.completed=Array.from({length:6},(_,n)=>'size-'+(n+1));advanced.introduced=['size'];advanced.last=5;}
   remote.records[SAVE_KEY]=JSON.stringify(advanced);revision++;await host.retry();const label={textContent:''};
   const context=vm.createContext({state:{preview:false,progress:cached},saved:clone(cached),lastProgressRaw:initialRaw,progressStorage,SAVE_KEY,normalizeKeepsakes,mergeSceneCollection,clone,$:()=>label,say:(en,ko)=>ko,SynkPlayAccount:{status:()=>({mode:'account',phase:'synced'})},outcome:null});context.state.progress.language='ko';
   vm.runInContext((scenario==='before-unsafe'?observedUnsafe:actual)+'\noutcome=persist();',context);await host.flush();const after=JSON.parse(remote.records[SAVE_KEY]);
   const passed=scenario==='before-unsafe'?accepted.length===1&&accepted[0].previousCompleted.length===6&&after.completed.length===0:scenario==='after-other-progress'?context.outcome===false&&accepted.length===0&&after.completed.length===6:context.outcome===true&&accepted.length===1&&after.keepsakes.length===1&&after.language==='ko';assert.ok(passed,scenario);
   results.push({scenario,outcome:context.outcome,acceptedChanges:accepted,completedBefore:advanced.completed,completedAfter:after.completed,keepsakesAfter:after.keepsakes.length,languageAfter:after.language,saveLabel:label.textContent,passed});
  }finally{host.stop();}
 }
 const metadata={at:new Date().toISOString(),frozenSourceSHA:expected,actualAccountHost:true,currentAppPersistExecuted:true,beforeProvenance:'Function text preserved from the exact pre-freeze tool output. Full old WIP app SHA unavailable.',externalWrites:0,productEdits:0,productionWrites:0,realAccounts:0,voiceGeneration:0,modelCalls:0};
 fs.writeFileSync(path.join(out,'before-reproduction.json'),JSON.stringify({...metadata,results:results.filter(r=>r.scenario==='before-unsafe')},null,2)+'\n');fs.writeFileSync(path.join(out,'after-reproduction.json'),JSON.stringify({...metadata,results:results.filter(r=>r.scenario!=='before-unsafe')},null,2)+'\n');
 console.log(JSON.stringify({scenarios:results.map(({scenario,passed})=>({scenario,passed})),frozenHashesMatched:4}));
})().catch(e=>{console.error(e);process.exitCode=1;});
