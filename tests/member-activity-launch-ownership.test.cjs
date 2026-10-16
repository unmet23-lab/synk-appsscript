'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../experiences/synk-account/src/platform.mjs'),'utf8');
const body=source.split('\n').find(line=>line.includes("else if(action==='launch'){")).trim().replace(/^else /,'');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const branch=new AsyncFunction('action','id','launches','control','render','window','dispatch','notice','location','root','insightIdentity',body);
test('the actual native-launch UI branch records only the initiating owner and session',async()=>{
  for(const change of [null,{accountId:'synthetic-b',sessionGeneration:2},{sessionGeneration:2},{status:'signed-out',signedIn:false}]){
    let identity={accountId:'synthetic-a',sessionGeneration:1,status:'signed-in',signedIn:true},finish;
    const observed=[],notices=[],launches=new Map(),pending=new Promise(resolve=>finish=resolve);
    const job=branch('launch','world',launches,{},()=>{},{synkDesktop:{launch:()=>pending}},action=>{observed.push({owner:identity.accountId,...action});return true;},text=>notices.push(text),{hash:'#app/world'},{querySelector:()=>null},()=>identity);
    if(change)identity={...identity,...change};finish({ok:true});await job;
    assert.equal(observed.length,change?0:1);assert.equal(notices.length,change?0:1);assert.equal(launches.has('world'),false);
    if(!change)assert.equal(observed[0].owner,'synthetic-a');
  }
});
test('a failed native launch cannot create an observation',async()=>{
  for(const rejected of [false,true]){
    const observed=[],launches=new Map();
    await branch('launch','world',launches,{},()=>{},{synkDesktop:{launch:async()=>{if(rejected)throw Error('synthetic failure');return {ok:false};}}},value=>observed.push(value),()=>{},{hash:'#app/world'},{querySelector:()=>null},()=>({accountId:'synthetic-a',sessionGeneration:1}));
    assert.deepEqual(observed,[]);assert.equal(launches.get('world'),'error');
  }
});
const popupBody=source.slice(source.indexOf('function openActivityWindow('),source.indexOf('function route()'));
const createPopupOpener=new Function('window','notice','dispatch',popupBody+'\nreturn openActivityWindow;');
const mountLine=source.split('\n').find(line=>line.startsWith('continuity=mountPlatformLibrary('));
const createLibraryOpen=new Function('mountPlatformLibrary','continuityRoot','shortcutDestination','location','clients','config','messengerUrl','accountEntryReady','accountEntryUnavailable','publicEntry','openActivityWindow','libraryItemRoute',`let continuity;${mountLine}\nreturn continuity.onOpen;`);
test('the actual library open callback preserves the page and records only a successfully opened window',()=>{
  for(const mode of ['unverified','blocked','navigation-failed','opened']){
    const actions=[],notices=[],opened=[],navigated=[];let unavailable=0,closed=0;
    const popup={opener:{},location:{replace(href){if(mode==='navigation-failed')throw Error('synthetic navigation failure');navigated.push(href);}},close(){closed++;}};
    const openActivityWindow=createPopupOpener({open:(...args)=>{opened.push(args);return mode==='blocked'?null:popup;}},text=>notices.push(text),action=>actions.push(action));
    const location={href:'https://platform.example/',hash:'',assign(){throw Error('must preserve the current page until activity save finishes');}};
    const onOpen=createLibraryOpen((_,options)=>options,{},()=>({kind:'web',href:'https://world.example/'}),location,[],{},null,()=>mode!=='unverified',()=>unavailable++,(id,href)=>href+'#handoff='+id,openActivityWindow,id=>'#app/'+id);
    onOpen('world');
    assert.equal(unavailable,mode==='unverified'?1:0);assert.equal(opened.length,mode==='unverified'?0:1);
    assert.deepEqual(actions,mode==='opened'?[{type:'launch',id:'world',mode:'web'}]:[]);
    assert.deepEqual(navigated,mode==='opened'?['https://world.example/#handoff=world']:[]);
    assert.equal(closed,mode==='navigation-failed'?1:0);assert.equal(notices.length,['blocked','navigation-failed'].includes(mode)?1:0);
    if(mode==='opened')assert.equal(popup.opener,null);
    assert.equal(location.hash,'');
  }
});
