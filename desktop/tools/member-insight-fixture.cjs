'use strict';
// Test-only synthetic Atlas projection. Never loaded by production preloads.
const AS_OF='2026-10-14T03:00:00.000Z',LAST_AT_GAP=16.75*3600000;
const DAY=86400000;
function practicePeriods(empty=false,asOf=AS_OF){
  const at=Date.parse(asOf),stamp=days=>new Date(at-days*DAY).toISOString();
  return {days:30,recent:{from:stamp(30),to:asOf,answered:empty?0:12,independent:empty?0:8,assisted:empty?0:4,activeDays:empty?0:4},previous:{from:stamp(60),to:stamp(30),answered:empty?0:6,independent:empty?0:3,assisted:empty?0:3,activeDays:empty?0:3},sufficient:!empty,reason:empty?'두 기간의 기록이 충분하지 않아 차이는 계산하지 않아요.':'같은 길이의 두 기간에 답한 횟수를 비교해요. 실력 성장이나 학습 효과를 뜻하지 않아요.',delta:empty?null:{answered:6,independent:5,assisted:1,activeDays:1}};
}
function activityDocument(mode='disabled',now=Date.now()){
  if(mode==='disabled')return {version:1,consent:false,enabledAt:null,events:[],favorites:[]};
  const stamp=days=>new Date(now-days*DAY).toISOString();
  const days=mode==='partial'?[2]:mode==='repeated'?[40,10,5,2]:[40,10,2],apps=mode==='repeated'?['world','world','world','world']:['world','world','path'];
  const value={version:1,consent:true,enabledAt:stamp(mode==='partial'?5:70),events:days.map((days,index)=>({id:'00000000-0000-4000-8000-'+String(index+1).padStart(12,'0'),appId:apps[index],at:stamp(days)})),favorites:['world']};
  if(mode==='malformed')value.privateText='synthetic-forbidden-field';
  return value;
}
function activityStore(){
  const owners=new Map();
  const row=owner=>{if(!owners.has(owner))owners.set(owner,{mode:'disabled',revision:0,state:null});return owners.get(owner);};
  return {set(owner,mode){owners.set(owner,{mode,revision:row(owner).revision+1,state:activityDocument(mode)});},
    request(owner,operation,params={}){const current=row(owner);if(current.mode==='error')throw Error('Synthetic activity failure');
      if(operation==='insightSave'){if(params.expected_revision!==current.revision)return {ok:false,error:{code:'REVISION_CONFLICT'}};current.state=JSON.parse(JSON.stringify(params.state));current.revision++;current.mode='saved';}
      return {ok:true,scope:'synk-personal',resource:'member-insight',accountId:'synthetic-insight-'+owner,revision:current.revision,state:current.state,updatedAt:current.state?new Date().toISOString():null};},
    inspect(owner){const current=row(owner);return {consent:current.state?.consent===true,eventCount:current.state?.events.length||0,favorites:current.state?.favorites||[],revision:current.revision};}};
}
function libraryStore(){
  const owners=new Map();
  const row=owner=>{if(!owners.has(owner))owners.set(owner,{revision:0,state:null});return owners.get(owner);};
  return {request(owner,operation,params={}){const current=row(owner);
    if(operation==='platformSave'){if(params.expected_revision!==current.revision)return {ok:false,error:{code:'REVISION_CONFLICT'}};current.state=JSON.parse(JSON.stringify(params.state));current.revision++;}
    return {ok:true,scope:'synk-personal',resource:'platform-library',accountId:'synthetic-insight-'+owner,revision:current.revision,state:current.state,updatedAt:current.state?new Date().toISOString():null};},
    inspect(owner){const current=row(owner);return {consent:current.state?.consent===true,favorites:current.state?.favorites||[],revision:current.revision};}};
}
function understandingStore(){
  const owners=new Map();
  const row=owner=>{if(!owners.has(owner))owners.set(owner,{mode:'ready',revision:0,state:null});return owners.get(owner);};
  return {set(owner,mode){row(owner).mode=mode;},replace(owner,state){row(owner).state=JSON.parse(JSON.stringify(state));row(owner).revision++;},
    request(owner,operation,params={}){const current=row(owner);
      if(current.mode==='error'||current.mode==='load-error'&&operation==='understandingLoad'||current.mode==='save-error'&&operation!=='understandingLoad')throw Error('Synthetic understanding failure');
      if(['understandingSave','understandingDelete'].includes(operation)){
        if(params.expected_revision!==current.revision)return {ok:false,error:{code:'REVISION_CONFLICT'}};
        current.state=operation==='understandingDelete'?null:JSON.parse(JSON.stringify(params.state));current.revision++;
      }
      return {ok:true,scope:'synk-personal',resource:'member-understanding',accountId:'synthetic-insight-'+owner,revision:current.revision,
        state:current.mode==='malformed'?{version:1,reviews:[],overrides:[],privateText:'synthetic-forbidden-understanding'}:current.state,updatedAt:current.state?new Date().toISOString():null};},
    inspect(owner){const current=row(owner);return {reviews:current.state?.reviews.length||0,overrides:current.state?.overrides.length||0,statements:current.state?.statements?.length||0,revision:current.revision,state:current.state?JSON.parse(JSON.stringify(current.state)):null};}};
}
// The learning memory help style and explanation length are saved to (synk-learning ?view=memory).
function memoryStore(){
  const owners=new Map();
  const row=owner=>{if(!owners.has(owner))owners.set(owner,{mode:'ready',posts:0,entries:new Map()});return owners.get(owner);};
  const chosen=owner=>row(owner).entries.get('presentation:chosen')?.value||{};
  return {set(owner,mode){row(owner).mode=mode;},clear(owner){row(owner).entries.clear();},
    request(owner,operation,params={}){const current=row(owner);if(current.mode==='error')throw Error('Synthetic memory failure');
      if(operation==='memoryPost'){current.posts++;for(const entry of params.entries){const key=entry.kind+':'+entry.key,old=current.entries.get(key);if(!old||Date.parse(entry.at)>Date.parse(old.at))current.entries.set(key,JSON.parse(JSON.stringify(entry)));}}
      return {ok:true,revision:params.revision,entries:[...current.entries.values()].map(entry=>JSON.parse(JSON.stringify(entry)))};},
    inspect(owner){return {presentation:{...chosen(owner)},posts:row(owner).posts};},
    // The next summary reads back what was saved, only where the learning connection shares it.
    apply(owner,result){const saved=chosen(owner);if(!Object.keys(saved).length||result?.shared!=='practice-and-settings'||!result.summary)return result;return {...result,summary:{...result.summary,presentation:{...result.summary.presentation,...saved}}};}};
}
function summary(mode='enabled',owner='A',asOf=AS_OF){
  const LAST_AT=new Date(Date.parse(asOf)-LAST_AT_GAP).toISOString();
  if(mode==='sparse-quality'){
    // Aggregate-only synthetic case: overlapping topic counts are not answer counts.
    const at='2026-10-16T00:00:00.000Z',stamp=days=>new Date(Date.parse(at)-days*DAY).toISOString();
    const recent={from:stamp(30),to:at,answered:6,independent:0,assisted:6,activeDays:1};
    return {ok:true,scope:'synk-atlas-summary',learning:{enabled:true,revision:3},shared:'practice-and-settings',summary:{
      version:'atlas-account-summary-1',asOf:at,presentation:null,reasons:null,forReasons:[],
      practice:{answered:6,independent:0,assisted:6,lastAt:stamp(1),periods:{days:30,recent,
        previous:{from:stamp(60),to:stamp(30),answered:0,independent:0,assisted:0,activeDays:0},sufficient:false,reason:'한 번의 학습일 기록만 있어 기간 차이를 해석하지 않아요.',delta:null},
        observations:{from:recent.from,to:at,total:6,topics:['-(으)세요','-지 말다','-지 않다','-아/어도 되다'].map((label,index)=>({id:'synthetic-grammar-'+index,kind:'grammar_point',label,count:index?2:4,activeDays:1,lastAt:stamp(1)})),modes:[],formats:[]},
        skills:[],content:[]},basis:'practice',abilityClaim:false,learningEffectClaim:false,grade:null}};
  }
  const empty=mode==='empty',enabled=mode!=='disabled';
  return {ok:true,scope:'synk-atlas-summary',learning:{enabled,revision:3},shared:enabled?'practice-and-settings':'declared-only',summary:{
    version:'atlas-account-summary-1',asOf,presentation:empty?null:{support:'step',explanation:'brief',textSize:'large',motion:'reduced',audio:'available'},
    reasons:empty?null:['travel','culture'],forReasons:empty?[]:[{reason:'travel',situations:[{id:'cafe-order',label:'카페에서 주문하기',line:'여행 중 카페에서 원하는 음료를 말할 때 연습해요.'}]}],
    practice:{answered:empty?0:18,independent:empty?0:11,assisted:empty?0:7,lastAt:empty?null:LAST_AT,periods:practicePeriods(empty,asOf),
      observations:{from:practicePeriods(false,asOf).recent.from,to:asOf,total:empty?0:12,
        topics:empty?[]:[{id:'cafe-order',kind:'situation',label:'카페에서 주문하기',count:5,activeDays:3,lastAt:LAST_AT},{id:'location-words',kind:'concept',label:'위치와 방향 표현',count:4,activeDays:2,lastAt:LAST_AT}],
        modes:empty?[]:[{id:'listening',count:8,activeDays:3,lastAt:LAST_AT},{id:'reading',count:4,activeDays:2,lastAt:LAST_AT}],
        formats:empty?[]:[{id:'binary-choice',count:8,activeDays:3,lastAt:LAST_AT},{id:'single-choice',count:4,activeDays:2,lastAt:LAST_AT}]},
      skills:empty?[]:[{id:'listen-short',label:'합성 '+owner+' 짧은 안내 듣기',domain:'listening',status:'practice',recent:5,correct:3,assisted:2,lastAt:LAST_AT,line:'짧은 안내의 순서와 행동을 다시 확인해 보세요.'},{id:'read-order',label:'순서에 맞게 읽기',domain:'reading',status:'recent-independent',recent:6,correct:5,assisted:1,lastAt:LAST_AT,line:'최근 혼자 답한 문항에서 순서를 확인했어요.'}],
      content:empty?[]:[{id:'location-words',kind:'concept',label:'위치와 방향 표현',status:'review'}]},
    basis:empty?'cold-start':'practice',abilityClaim:false,learningEffectClaim:false,grade:null}};
}
// A review only counts within 30 days of its claim, so the browser and PC runs follow today. Whole-day
// so the preload and the host, loaded apart, describe the same period.
function currentSummary(mode='enabled',owner='A'){return summary(mode,owner,new Date(Math.floor(Date.now()/DAY)*DAY).toISOString());}
function signedIn(owner='A',generation=1){return {configured:true,status:'signed-in',signedIn:true,sessionGeneration:generation,account:{synk_user_id:'synthetic-insight-'+owner,display_name:'합성 '+owner},learningSync:true,library:{status:'ready',appIds:['world']}};}
if(typeof module!=='undefined')module.exports={summary,currentSummary,signedIn,activityDocument,activityStore,libraryStore,understandingStore,memoryStore};
if(process.versions.electron&&process.type==='renderer'){
  const {contextBridge}=require('electron');
  let auth={configured:true,status:'signed-out',signedIn:false,sessionGeneration:0},mode='enabled',hold=false,launchAllowed=true;
  const listeners=new Set(),calls=[],held=[],activity=activityStore(),library=libraryStore(),understanding=understandingStore(),memory=memoryStore();
  const owner=()=>auth.account?.synk_user_id?.replace('synthetic-insight-','')||'A';
  const denied=operation=>async()=>{calls.push({operation});return {ok:false,code:'QA_OPERATION_DISABLED'};};
  contextBridge.exposeInMainWorld('synkDesktop',Object.freeze({
    getEnvironment:async()=>({platform:'win32',arch:'x64',version:'synthetic',mode:'development',teacherPreviewAvailable:false,productPreviewsAvailable:[]}),
    getClients:async()=>[{id:'world',status:'installed',version:'synthetic',canLaunch:true,installer:{status:'idle'}}],authStatus:async()=>auth,
    onAuthChanged:callback=>{listeners.add(callback);return ()=>listeners.delete(callback);},onClientsChanged:()=>()=>{},onClientProgress:()=>()=>{},
    accountRequest:async(operation,params={})=>{
      calls.push({operation,owner:owner(),keys:Object.keys(params)});
      if(operation==='load')return {ok:true,account:auth.account};
      if(['platformLoad','platformSave'].includes(operation))return library.request(owner(),operation,params);
      if(['insightLoad','insightSave'].includes(operation))return activity.request(owner(),operation,params);
      if(['understandingLoad','understandingSave','understandingDelete'].includes(operation))return understanding.request(owner(),operation,params);
      if(['memoryGet','memoryPost'].includes(operation))return memory.request(owner(),operation,params);
      if(operation!=='atlasSummary')throw Error('Unexpected synthetic operation: '+operation);
      if(mode==='error')throw Error('Synthetic Atlas read failure');
      const value=memory.apply(owner(),currentSummary(mode,owner()));
      if(hold){hold=false;return new Promise(resolve=>held.push(()=>resolve(value)));}
      return value;
    },
    launch:async target=>{calls.push({operation:'launch',target});return {ok:launchAllowed&&target==='world'};},prepareClient:denied('prepare'),openInstaller:denied('install'),cancelPreparation:denied('cancel'),authSignIn:denied('login'),authSignOut:denied('logout'),openTeacherPreview:denied('teacher-preview'),openProductPreview:denied('product-preview'),
  }));
  contextBridge.exposeInMainWorld('__synkFixture',Object.freeze({
    switchAccount:snapshot=>{auth=snapshot;for(const callback of listeners)callback(auth);},
    setMode:value=>{mode=value;},holdNext:()=>{hold=true;},releaseHeld:()=>{for(const release of held.splice(0))release();},pendingCount:()=>held.length,calls:()=>calls.map(call=>({...call})),
    setActivityMode:value=>activity.set(owner(),value),activityState:()=>activity.inspect(owner()),
    setLaunchAllowed:value=>{launchAllowed=value===true;},
    libraryState:()=>library.inspect(owner()),
    setUnderstandingMode:value=>understanding.set(owner(),value),understandingState:()=>understanding.inspect(owner()),
    replaceUnderstanding:value=>understanding.replace(owner(),value),
    setMemoryMode:value=>memory.set(owner(),value),clearMemory:()=>memory.clear(owner()),memoryState:()=>memory.inspect(owner()),
  }));
}
