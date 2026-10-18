import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/\bboot\(\);\s*$/,'');
function fixture(){
 const listeners={},calls=[],parent={},nodes=new Map();
 const node={addEventListener(){},classList:{add(){},remove(){},toggle(){}},querySelector(){return null;},querySelectorAll(){return[];}};
 for(const key of ['#app','#modal'])nodes.set(key,node);
 const context=vm.createContext({document:{hidden:false,querySelector:key=>nodes.get(key)||null,querySelectorAll:()=>[],addEventListener(){}},window:{parent,addEventListener:(type,handler)=>listeners[type]=handler,matchMedia:()=>({matches:false,addEventListener(){}})},location:{pathname:'/messenger/',origin:'http://localhost'},URL,URLSearchParams,setTimeout(){},clearTimeout(){},localStorage:{getItem(){return null;},setItem(){},removeItem(){}},calls});
 const run=code=>vm.runInContext(code,context);run(source);run("Object.assign(state,{user:{id:'u1'},members:[{id:'u1'},{id:'u2'}],channels:[{id:'self',kind:'self',memberIds:['u1']},{id:'c1',kind:'channel',memberIds:['u1','u2']}],channelId:'self',chatCategory:'personal'});moduleVisible=true;refreshChannels=async()=>calls.push(['refresh']);refreshDirectory=async()=>calls.push(['directory']);selectChannel=async id=>{state.channelId=id;state.navigationSeq++;state.chatCategory=id==='self'?'personal':'all';calls.push(['select',id]);};openDirectMessage=async id=>{calls.push(['dm',id]);return 'dm1';};openSearchMessage=async(message,options)=>calls.push(['message',message,options.isCurrent()]);openPersonalPanel=tab=>calls.push(['panel',tab]);setMode=mode=>calls.push(['mode',mode]);setMobileMenu=()=>{};closeDrawer=()=>{};refreshMessages=async()=>{};toast=message=>calls.push(['toast',message]);parentMessage=(type,payload)=>calls.push(['parent',type,payload]);");
 const message=data=>listeners.message({origin:'http://localhost',source:parent,data:{type:'workspace:open',...data}});
 return{context,run,listeners,parent,calls,message,state:run('state')};
}
test('workspace destinations require the authenticated parent origin and window before any lookup or DM creation',async()=>{
 const f=fixture(),data={type:'workspace:open',requestId:'one',userId:'u2'};await f.listeners.message({origin:'http://outside',source:f.parent,data});await f.listeners.message({origin:'http://localhost',source:{},data});assert.equal(f.calls.length,0);await f.message({requestId:'one',userId:'u2'});assert.deepEqual(f.calls.filter(row=>row[0]==='dm').map(row=>Array.from(row)),[['dm','u2']]);await f.message({requestId:'one',userId:'u2'});assert.equal(f.calls.filter(row=>row[0]==='dm').length,1);
});
test('a room and exact source message are opened only after membership refresh with a current-request guard',async()=>{
 const f=fixture();await f.message({requestId:'one',channelId:'c1',messageId:'42',fileId:'file-uuid',panel:'files'});assert.equal(f.calls[0][0],'refresh');const message=f.calls.find(row=>row[0]==='message');assert.equal(message[1].id,'42');assert.equal(message[1].channelId,'c1');assert.equal(message[2],true);assert.ok(!f.calls.some(row=>row[0]==='dm'));
});
test('unsupported identifiers, arbitrary panels and inaccessible rooms never perform navigation',async()=>{
 const f=fixture();for(const value of [{channelId:'../secrets'},{channelId:'c1',userId:'u2'},{panel:'admin'},{channelId:'c1',messageId:'bad'},{fileId:'file-without-room'}])await f.message({requestId:JSON.stringify(value),...value});assert.equal(f.calls.length,0);await f.message({requestId:'missing',channelId:'private-other'});assert.ok(f.calls.some(row=>row[0]==='toast'));assert.ok(!f.calls.some(row=>row[0]==='select'));
});
test('leaving the messenger while destination lookup is pending cancels late navigation',async()=>{
 const f=fixture();f.context.waiting=new Promise(resolve=>f.context.finish=resolve);f.run('refreshChannels=()=>waiting');const pending=f.message({requestId:'one',channelId:'c1'});await f.listeners.message({origin:'http://localhost',source:f.parent,data:{type:'workspace:visible',visible:false}});f.context.finish();await pending;assert.equal(f.state.channelId,'self');assert.ok(!f.calls.some(row=>row[0]==='select'));assert.equal(f.state.workspaceOpenPending,false);
});
test('a newer destination or a manual room choice wins over an older pending request',async()=>{
 const f=fixture(),resolvers=[];f.context.lookup=()=>new Promise(resolve=>resolvers.push(resolve));f.run('refreshChannels=lookup');const first=f.message({requestId:'first',channelId:'c1'}),second=f.message({requestId:'second',panel:'saved'});resolvers[1]();await second;resolvers[0]();await first;assert.deepEqual(f.calls.filter(row=>row[0]==='panel').map(row=>Array.from(row)),[['panel','saved']]);assert.ok(!f.calls.some(row=>row[0]==='select'));
 const third=f.message({requestId:'third',channelId:'c1'});f.run('state.navigationSeq++');resolvers[2]();await third;assert.equal(f.state.channelId,'self');
});
test('personal shortcuts open assigned tasks and saved messages even after using other filters',async()=>{
 const f=fixture();f.run("state.taskScope='all';state.taskFilter='done';state.savedView='reminders'");
 await f.message({requestId:'tasks',panel:'tasks'});assert.equal(f.state.taskScope,'mine');assert.equal(f.state.taskFilter,'all');
 await f.message({requestId:'saved',panel:'saved'});assert.equal(f.state.savedView,'saved');assert.deepEqual(f.calls.filter(row=>row[0]==='panel').map(row=>Array.from(row)),[['panel','workday'],['panel','saved']]);
});

test('the embedded shell and realtime connection start before an initial history request settles',async()=>{
 const f=fixture();let finish;f.context.historyRequest=new Promise(resolve=>{finish=resolve;});
 f.context.document.body={classList:{toggle(){}}};
 f.run("resetTransfers=()=>{};resetWorkNotificationState=()=>{};setWorkNotificationStatus=()=>{};renderShell=()=>calls.push(['shell']);voiceController=()=>null;selectChannel=()=>historyRequest;connectEvents=()=>calls.push(['events']);enterWorkspace({user:{id:'u1'},channels:[{id:'c1'}],members:[]})");
 assert.ok(f.calls.some(row=>row[0]==='shell'));assert.ok(f.calls.some(row=>row[0]==='parent'&&row[1]==='messenger:ready'));
 assert.equal(f.calls.filter(row=>row[0]==='events').length,1);
 finish();await new Promise(resolve=>setImmediate(resolve));assert.equal(f.calls.filter(row=>row[0]==='events').length,1);
});

test('only the authenticated parent can repeat a ready handshake after the UI has been rendered',async()=>{
 const f=fixture(),data={type:'workspace:ready-check'};
 await f.listeners.message({origin:'http://localhost',source:f.parent,data});assert.equal(f.calls.length,0);
 f.run('moduleReady=true');
 await f.listeners.message({origin:'http://outside',source:f.parent,data});
 await f.listeners.message({origin:'http://localhost',source:{},data});assert.equal(f.calls.length,0);
 await f.listeners.message({origin:'http://localhost',source:f.parent,data});
 assert.deepEqual(f.calls.map(row=>Array.from(row)),[['parent','messenger:ready',undefined]]);
});
