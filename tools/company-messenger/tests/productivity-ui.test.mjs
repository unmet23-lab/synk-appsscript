import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/\bboot\(\);\s*$/,'');
function fixture(){
 const storage=new Map(),nodes=new Map(),requests=[],listeners={};
 const make=()=>({innerHTML:'',value:'',textContent:'',disabled:false,readOnly:false,open:false,isConnected:true,selectionStart:0,selectionEnd:0,dataset:{},style:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},removeAttribute(){},addEventListener(){},querySelector(){return null;},querySelectorAll(){return[];},focus(){},setRangeText(value,start,end){this.value=this.value.slice(0,start)+value+this.value.slice(end);this.selectionStart=this.selectionEnd=start+value.length;}});
 for(const key of ['#app','#modal','#composer-input','#send-message','#composer-status','#compose-extras','#mention-picker','#personal-body','#drawer','#reply-context','#upload-queue'])nodes.set(key,make());
 const document={hidden:false,activeElement:null,querySelector:key=>nodes.get(key)||null,querySelectorAll:()=>[],addEventListener(){}};
 const parent={},window={parent,matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener:(event,callback)=>listeners[event]=callback};
 const context=vm.createContext({document,window,location:{pathname:'/messenger/',origin:'http://localhost'},localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},URL,URLSearchParams,CSS:{escape:String},crypto:{randomUUID:()=> 'uuid'},setTimeout:()=>1,clearTimeout(){}});
 const run=code=>vm.runInContext(code,context);run(source);run("Object.assign(state,{user:{id:'u1',name:'유호',role:'member'},members:[{id:'u1',name:'유호'},{id:'u2',name:'민지'},{id:'u3',name:'다른팀'}],channels:[{id:'c1',kind:'channel',name:'정보방',memberIds:['u1','u2'],canPost:true},{id:'c2',kind:'channel',name:'공지',systemKey:'announcements',memberIds:['u1','u2'],canPost:false}],channelId:'c1',chatCategory:'all'});");
 context.request=(path,options={})=>new Promise((resolve,reject)=>requests.push({path,options,resolve,reject}));run('api=request;toast=()=>{};refreshNotificationCount=async()=>{};');
 return{context,run,nodes,storage,requests,listeners,parent,state:run('state'),make};
}
const message={id:'m1',channelId:'c1',body:'함께 확인',user:{id:'u1',name:'유호'},files:[],reactions:[],createdAt:'2026-09-30T00:00:00Z'};
test('structured cards allow only same-origin workspace views and escape labels',()=>{
 const f=fixture();assert.equal(f.run("safeWorkspaceLink({title:'a',url:'javascript:alert(1)'})"),null);assert.equal(f.run("safeWorkspaceLink({title:'a',url:'https://outside.test/#view=content'})"),null);assert.equal(f.run("safeWorkspaceLink({title:'a',url:'/api/files/a#view=content'})"),null);
 f.context.link={title:'<img src=x onerror=bad>',url:'/#view=content&section=plan&draftId=abc',kind:'content-review'};const html=f.run('workspaceCardHtml(link)');assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img'));assert.ok(html.includes('콘텐츠 검토 요청'));assert.equal(f.run("safeWorkspaceLink({title:'history',url:'/#view=history'}).url"),'http://localhost/#view=history');
});
test('mention picker includes only conversation crew and selection preserves the text around the caret',()=>{
 const f=fixture(),box=f.nodes.get('#composer-input');box.value='확인 @민 뒤의 문장';box.selectionStart=box.selectionEnd=5;f.run('updateMentionPicker()');assert.deepEqual(Array.from(f.run('state.mentionPicker.people'),p=>p.id),['u2']);f.run('chooseMention(0)');assert.equal(box.value,'확인 @민지  뒤의 문장');assert.deepEqual(Array.from(f.run('composePayload().mentionIds')),['u2']);box.value='멘션을 지웠어요';assert.deepEqual(Array.from(f.run('composePayload().mentionIds')),[]);
 f.run("state.channelId='c2';updateMentionPicker()");assert.equal(f.state.mentionPicker,null);
});
test('compose cards and mentions remain scoped to user and room across selection and restore',()=>{
 const f=fixture();f.run("state.mentionIds=['u2'];state.workspaceLink={title:'성장',url:'http://localhost/#view=history'};state.ackRequired=true;saveComposeExtras();state.channelId='c2';restoreComposeExtras();");assert.equal(f.state.workspaceLink,null);assert.equal(f.state.ackRequired,true);f.run("state.channelId='c1';restoreComposeExtras()");assert.equal(f.state.workspaceLink.title,'성장');assert.deepEqual(Array.from(f.state.mentionIds),['u2']);f.run("state.user={id:'another'};restoreComposeExtras()");assert.equal(f.state.workspaceLink,null);
});
test('read-only crew retain private save/remind and explicit acknowledgement without posting controls',()=>{
 const f=fixture();f.context.message={...message,channelId:'c2',ackRequired:true,acknowledged:false,ackCount:1};f.run('state.integrated={canWrite:false};state.channelId="c2"');let html=f.run('messageHtml(message)');for(const action of ['save','remind','ack','ack-list'])assert.ok(html.includes(`data-action="${action}"`));for(const action of ['reply','pin','edit'])assert.ok(!html.includes(`data-action="${action}"`));
 f.run('message.acknowledged=true;message.reminder={remindAt:"2026-09-30T00:00:00Z",deliveredAt:"2026-09-30T00:01:00Z"}');html=f.run('messageHtml(message)');assert.ok(html.includes('확인 완료'));assert.ok(html.includes('알림함에 도착'));assert.ok(!html.includes('알림 예정'));
});
test('task pagination follows the chosen channel and does not duplicate the first page',async()=>{
 const f=fixture();f.run("state.drawer='personal';state.personalTab='tasks';state.taskScope='channel';state.taskFilter='doing';state.personalItems=[{id:'task1',messageId:'m1',channelId:'c1',title:'이미 받은 일',status:'doing'}]");const pending=f.run('loadPersonalPanel({append:true})');const query=new URL('http://local'+f.requests[0].path).searchParams;assert.equal(query.get('offset'),'1');assert.equal(query.get('channelId'),'c1');assert.equal(query.get('scope'),'channel');assert.equal(query.get('status'),'doing');f.requests[0].resolve({tasks:[{id:'task2',messageId:'m2',channelId:'c1',title:'다음 일',status:'doing'}],hasMore:false});await pending;assert.deepEqual(Array.from(f.state.personalItems,p=>p.id),['task1','task2']);
});
test('a late personal panel request cannot repaint after closing the panel',async()=>{
 const f=fixture();f.run("state.drawer='personal';state.personalTab='saved'");const pending=f.run('loadPersonalPanel()');f.run("state.drawer=null;state.personalSeq++");f.nodes.get('#personal-body').innerHTML='next screen';f.requests[0].resolve({messages:[message]});await pending;assert.equal(f.nodes.get('#personal-body').innerHTML,'next screen');
});
test('filtered search supports a blank keyword and paginates with all filters intact',async()=>{
 const f=fixture();for(const [key,value] of Object.entries({'#search-input':'','#search-author':'u2','#search-from':'2026-09-01','#search-to':'2026-09-30','#search-file-type':'document'})){const node=f.make();node.value=value;f.nodes.set(key,node);}f.nodes.set('#search-scope',{checked:true});f.nodes.set('#drawer-body',f.make());f.run("state.drawer='search';state.searchMessages=[{id:'old'}]");const pending=f.run('runSearch({append:true})');const query=new URL('http://local'+f.requests[0].path).searchParams;assert.equal(query.get('q'),'');assert.equal(query.get('offset'),'1');assert.equal(query.get('authorId'),'u2');assert.equal(query.get('fileType'),'document');assert.equal(query.get('channelId'),'c1');f.requests[0].resolve({messages:[],hasMore:false});await pending;
});

test('a card-only share is a draft until send, and sending mention plus card clears only that submitted metadata',async()=>{
 const f=fixture(),box=f.nodes.get('#composer-input');f.run('setMode=()=>{};closeDrawer=()=>{};parentMessage=()=>{};resizeComposer=()=>{};renderMessages=()=>{};renderQueue=()=>{};scrollToBottom=()=>{};refreshChannels=async()=>{};markRead=async()=>{};');
 await f.listeners.message({origin:'http://localhost',source:f.parent,data:{type:'workspace:share',channelId:'c1',workspaceLink:{title:'기획 검토',url:'/#view=content&section=plan&draftId=d1',kind:'content-review'},requestId:'share1'}});
 assert.equal(f.state.workspaceLink.title,'기획 검토');assert.equal(f.requests.length,0);assert.equal(box.value,'');assert.equal(f.nodes.get('#send-message').disabled,false);
 box.value='@민지 확인 부탁해요';f.run("state.mentionIds=['u2'];saveDraft();updateSend()");const pending=f.run('sendMessage({preventDefault(){}})');assert.equal(f.requests[0].options.body.workspaceLink.kind,'content-review');assert.deepEqual(Array.from(f.requests[0].options.body.mentionIds),['u2']);
 f.requests[0].resolve({message});await pending;assert.equal(box.value,'');assert.equal(f.state.workspaceLink,null);assert.deepEqual(Array.from(f.state.mentionIds),[]);
});

test('a delayed share selection cannot replace the draft after the user navigates elsewhere',async()=>{
 const f=fixture();f.context.selection=new Promise(resolve=>f.context.finishSelection=resolve);f.run("state.channels.push({id:'c3',kind:'channel',memberIds:['u1','u2'],canPost:true});selectChannel=async channelId=>{state.channelId=channelId;state.navigationSeq++;await selection;};");
 const pending=f.listeners.message({origin:'http://localhost',source:f.parent,data:{type:'workspace:share',channelId:'c3',workspaceLink:{title:'이전 요청',url:'/#view=history'}}});
 f.run("state.channelId='c1';state.navigationSeq++;state.workspaceLink={title:'새 초안',url:'http://localhost/#view=overview'}");f.context.finishSelection();await pending;assert.equal(f.state.channelId,'c1');assert.equal(f.state.workspaceLink.title,'새 초안');
});

test('sending in an old room does not delete a newer card-only draft prepared while the request was pending',async()=>{
 const f=fixture();f.run("state.workspaceLink={title:'전송 중 카드',url:'http://localhost/#view=overview'};saveDraft();updateSend();resizeComposer=()=>{};refreshChannels=async()=>{};markRead=async()=>{};");const pending=f.run('sendMessage({preventDefault(){}})');
 f.run("state.workspaceLink={title:'새로 받은 카드',url:'http://localhost/#view=history'};saveDraft();state.channelId='c2';restoreComposeExtras();");f.requests[0].resolve({message});await pending;const saved=JSON.parse(f.storage.get('synk-messenger:compose:u1:c1'));assert.equal(saved.workspaceLink.title,'새로 받은 카드');
});

test('an overlaid drawer makes background conversation views inert and moves focus out of a newly covered composer',()=>{
 const f=fixture(),box=f.nodes.get('#composer-input');let focused=0;const close=f.make();close.focus=()=>{focused++;};f.nodes.set('#close-drawer',close);for(const key of ['#chat-area','#files-view','#pins-view']){const node=f.make();node.contains=value=>key==='#chat-area'&&value===box;f.nodes.set(key,node);}f.context.document.activeElement=box;
 f.run("state.drawer='personal';directoryWide.matches=false;syncDrawerAccess()");assert.equal(focused,1);for(const key of ['#chat-area','#files-view','#pins-view'])assert.equal(f.nodes.get(key).inert,true);
 f.run('directoryWide.matches=true;syncDrawerAccess()');for(const key of ['#chat-area','#files-view','#pins-view'])assert.equal(f.nodes.get(key).inert,false);
});

test('closing an overlaid drawer restores background access before returning focus to the original control',()=>{
 const f=fixture(),box=f.nodes.get('#composer-input'),area=f.make();area.inert=true;let focused=false;box.closest=()=>null;box.focus=()=>{assert.equal(area.inert,false);focused=true;};f.nodes.set('#chat-area',area);f.nodes.get('#drawer').contains=()=>true;f.run("state.drawer='search';drawerReturnFocus=$('#composer-input');closeDrawer()");assert.equal(focused,true);assert.equal(area.inert,false);assert.equal(f.state.drawer,null);
});
