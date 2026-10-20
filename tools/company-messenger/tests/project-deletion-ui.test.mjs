import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/\bboot\(\);\s*$/,'');

function fixture(){
 const nodes=new Map(),storage=new Map(),requests=[],selected=[],notices=[];
 const get=selector=>{if(!nodes.has(selector)){const classes=new Set();nodes.set(selector,{innerHTML:'',textContent:'',value:'',disabled:false,open:false,isConnected:true,dataset:{},style:{},scrollHeight:100,classList:{add:value=>classes.add(value),remove:value=>classes.delete(value),contains:value=>classes.has(value),toggle(value,active){if(active)classes.add(value);else classes.delete(value);}},querySelector:get,querySelectorAll:()=>[],addEventListener(name,callback){this['on'+name]=callback;},setAttribute(){},removeAttribute(){},focus(){},contains(){return false;},closest(){return null;},showModal(){this.open=true;},close(){this.open=false;}});}return nodes.get(selector);};
 const context=vm.createContext({document:{querySelector:get,querySelectorAll:()=>[],addEventListener(){},activeElement:null,hidden:false},window:{parent:{},matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener(){}},location:{pathname:'/messenger/',origin:'http://localhost'},localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},URL,URLSearchParams,crypto:{randomUUID:()=> '00000000-0000-4000-8000-000000000001'},CSS:{escape:String},setTimeout(){},clearTimeout(){}});
 const run=code=>vm.runInContext(code,context);run(source);run("Object.assign(state,{sendRecovery:{messages:true,uploads:true},user:{id:'u1',name:'유호',role:'owner'},integrated:{canWrite:true,canManage:true},members:[{id:'u1',name:'유호'},{id:'u2',name:'민지'}],channels:[{id:'project',kind:'channel',category:'project',scope:'private',name:'가을 <캠페인>',description:'자료',memberIds:['u1','u2'],canManage:true,canDelete:true,canPost:true},{id:'public',kind:'channel',category:'generic',scope:'public',name:'정보방',memberIds:['u1','u2'],canPost:true},{id:'self',kind:'self',scope:'private',memberIds:['u1'],canPost:true}],channelId:'project',chatCategory:'all',categoryChannels:{all:'project',personal:'self'}});");
 context.request=(path,options={})=>new Promise((resolve,reject)=>requests.push({path,options,resolve,reject}));context.selected=selected;context.notices=notices;
 run("api=request;toast=(message)=>notices.push(message);renderNavigation=()=>{};syncChannelHeader=()=>{};syncComposerAccess=()=>{};renderMessages=()=>{};renderReplyContext=()=>{};renderQueue=()=>{};renderEmptyChannel=()=>{};renderComposeExtras=()=>{};markRead=async()=>{};parentMessage=()=>{};refreshDetailViews=async()=>{};selectChannel=async channelId=>{saveDraft();state.channelId=channelId;state.navigationSeq++;selected.push(channelId);};");
 return{get,storage,requests,selected,notices,run,context,state:run('state'),modal:get('#modal')};
}
const archived={id:'project',name:'가을 캠페인',kind:'channel',category:'project',scope:'private',memberIds:['u1','u2'],deletedAt:'2026-09-30T03:00:00Z',canRestore:true,canManage:false,canPost:false};
const restored={...archived,deletedAt:null,canRestore:false,canManage:true,canDelete:true,canPost:true};

test('delete and restore require server permission and participating writable crew, for projects only',()=>{
 const f=fixture();assert.equal(f.run('canDeleteProject(state.channels[0])'),true);f.run("state.channels[0].scope='public'");assert.equal(f.run('canDeleteProject(state.channels[0])'),true);f.run('state.channels[1].canDelete=true');assert.equal(f.run('canDeleteProject(state.channels[1])'),false);
 f.context.archived=archived;assert.equal(f.run('canRestoreProject(archived)'),true);f.run("state.user.id='outside'");assert.equal(f.run('canDeleteProject(state.channels[0])'),false);assert.equal(f.run('canRestoreProject(archived)'),false);f.run("state.user.id='u1';state.integrated.canWrite=false");assert.equal(f.run('canDeleteProject(state.channels[0])'),false);assert.equal(f.run('canRestoreProject(archived)'),false);
});

test('project participation has visible text settings and settings exposes a separate recoverable delete action',()=>{
 const f=fixture();f.run('syncProjectParticipation()');assert.ok(f.get('#project-participation').innerHTML.includes('data-project-settings'));assert.ok(f.get('#project-participation').innerHTML.includes('대화방 설정'));f.run('editChannelDialog()');assert.ok(f.modal.innerHTML.includes('id="delete-project"'));assert.ok(f.modal.innerHTML.includes('‘삭제된 대화방’에서 복원'));f.run('state.channels[0].canManage=false;syncProjectParticipation()');assert.ok(f.get('#project-participation').innerHTML.includes('data-project-settings'),'members retain their personal notification settings');
});

test('delete confirmation names the room and audience, explains restore, and cancellation makes no request',()=>{
 const f=fixture();f.run("deleteProjectDialog('project')");assert.ok(f.modal.innerHTML.includes('가을 &lt;캠페인&gt;'));assert.ok(f.modal.innerHTML.includes('참여 크루 2명'));assert.ok(f.modal.innerHTML.includes('모든 참여자의 대화방 목록에서 빠져요'));assert.ok(f.modal.innerHTML.includes('전체채팅 → 삭제된 대화방'));f.get('#cancel-delete-project').onclick();assert.equal(f.modal.open,false);assert.equal(f.requests.length,0);assert.equal(f.state.channels.length,3);
});

test('deletion blocks another submission, purges only this room local state, and selects a room in the same category',async()=>{
 const f=fixture();let aborted=0;const upload={xhr:{abort(){aborted++;}},status:'uploading'};f.state.queues.set('project',[upload]);f.state.queues.set('self',[{name:'다른 첨부'}]);for(const type of ['draft','reply','compose','attachments']){f.storage.set(`synk-messenger:${type}:u1:project`,'old');f.storage.set(`synk-messenger:${type}:u1:self`,'keep');}f.storage.set('synk-messenger:last:u1','project');f.state.messages=[{id:'old',channelId:'project'}];f.state.drawer='thread';f.state.thread={parent:{id:'old',channelId:'project'}};f.state.sharedFiles=[{id:'file'}];f.state.pins=[{id:'old'}];f.get('#composer-input').value='삭제될 초안';
 f.run("deleteProjectDialog('project')");const pending=f.run("deleteProjectChannel('project',$('#confirm-delete-project'))");await f.run("deleteProjectChannel('project',$('#confirm-delete-project'))");assert.equal(f.requests.length,1);assert.equal(f.run('canPostToChannel()'),false);f.requests[0].resolve({ok:true});await pending;
 assert.deepEqual(f.selected,['public']);assert.equal(f.state.channelId,'public');assert.equal(f.state.messages.length,0);assert.equal(f.state.drawer,null);assert.equal(f.state.pins.length,0);assert.equal(f.state.sharedFiles.length,0);assert.equal(aborted,1);assert.equal(upload.channelUnavailable,true);assert.equal(f.state.queues.has('project'),false);assert.equal(f.state.queues.has('self'),true);
 for(const type of ['draft','reply','compose','attachments']){assert.equal(f.storage.has(`synk-messenger:${type}:u1:project`),false);assert.equal(f.storage.get(`synk-messenger:${type}:u1:self`),'keep');}assert.notEqual(f.state.categoryChannels.all,'project');assert.notEqual(f.storage.get('synk-messenger:last:u1'),'project');assert.equal(f.requests.some(request=>request.path.startsWith('/api/files')),false,'recoverable room deletion must not physically delete uploads');
});

test('deleting the only room in a category leaves a safe empty selection',async()=>{
 const f=fixture();f.state.channels=f.state.channels.filter(channel=>channel.id!=='public');const pending=f.run("deleteProjectChannel('project',null)");f.requests[0].resolve({ok:true});await pending;assert.equal(f.state.channelId,null);assert.equal(f.state.chatCategory,'all');assert.equal(f.run('canPostToChannel()'),false);assert.deepEqual(f.selected,[]);
});

test('a failed deletion leaves the room, draft and posting access intact',async()=>{
 const f=fixture();f.storage.set('synk-messenger:draft:u1:project','초안');f.run("deleteProjectDialog('project')");const pending=f.run("deleteProjectChannel('project',$('#confirm-delete-project'))");f.requests[0].reject(new Error('삭제할 권한이 없습니다.'));await pending;assert.equal(f.state.channels.length,3);assert.equal(f.storage.get('synk-messenger:draft:u1:project'),'초안');assert.equal(f.run('canPostToChannel()'),true);assert.equal(f.get('#modal-error').textContent,'삭제할 권한이 없습니다.');
});

test('deletion completed after navigation cannot close a newer modal or clear another room draft',async()=>{
 const f=fixture();f.run("deleteProjectDialog('project')");const pending=f.run("deleteProjectChannel('project',$('#confirm-delete-project'))");f.run("state.channelId='self';state.chatCategory='personal';state.navigationSeq++;openModal('새 작업','새 창');");f.get('#composer-input').value='다른 방 새 초안';f.storage.set('synk-messenger:draft:u1:self','다른 방 새 초안');f.requests[0].resolve({ok:true});await pending;assert.equal(f.state.channelId,'self');assert.equal(f.modal.open,true);assert.ok(f.modal.innerHTML.includes('새 창'));assert.equal(f.get('#composer-input').value,'다른 방 새 초안');assert.equal(f.storage.get('synk-messenger:draft:u1:self'),'다른 방 새 초안');assert.deepEqual(f.selected,[]);
});

test('an older channel-list response cannot resurrect a room deleted while it was loading',async()=>{
 const f=fixture(),original=Array.from(f.state.channels);const refresh=f.run('refreshChannels()');const deletion=f.run("deleteProjectChannel('project',null)");f.requests[1].resolve({ok:true});await deletion;f.requests[0].resolve({channels:original});await refresh;assert.equal(f.state.channels.some(channel=>channel.id==='project'),false);assert.equal(f.state.channelId,'public');
});

test('a message response from a deleted room cannot recreate its attachment queue or draft',async()=>{
 const f=fixture();f.get('#composer-input').value='전송 중 메시지';const pending=f.run('sendMessage({preventDefault(){}})');await f.run("removeChannelFromWorkspace('project')");f.requests[0].resolve({message:{id:'late',channelId:'project',body:'전송 중 메시지'}});await pending;assert.equal(f.state.messages.some(message=>message.id==='late'),false);assert.equal(f.state.queues.has('project'),false);assert.equal(f.storage.has('synk-messenger:draft:u1:project'),false);
});

test('restoring reopens the same channel and clears only its local unavailable marker',async()=>{
 const f=fixture();f.context.archived=archived;f.state.channels=f.state.channels.filter(channel=>channel.id!=='project');f.state.unavailableChannels.add('project');f.state.unavailableChannels.add('other');f.run("openModal('삭제된 대화방','목록')");const pending=f.run("restoreProjectChannel(archived,$('#restore'))");assert.equal(f.requests[0].path,'/api/channels/project/restore');f.requests[0].resolve({channel:restored});await pending;assert.equal(f.state.unavailableChannels.has('project'),false);assert.equal(f.state.unavailableChannels.has('other'),true);assert.deepEqual(f.selected,['project']);assert.equal(f.state.channels.find(channel=>channel.id==='project').canPost,true);
});

test('a late restore preserves the latest navigation and modal',async()=>{
 const f=fixture();f.context.archived=archived;f.run("openModal('삭제된 대화방','목록')");const pending=f.run('restoreProjectChannel(archived,null)');f.run("state.channelId='self';state.chatCategory='personal';state.navigationSeq++;openModal('다른 창','유지')");f.requests[0].resolve({channel:restored});await pending;assert.deepEqual(f.selected,[]);assert.equal(f.state.channelId,'self');assert.equal(f.modal.open,true);assert.ok(f.modal.innerHTML.includes('유지'));
});

test('a delayed deleted-room list cannot overwrite a newer modal',async()=>{
 const f=fixture();const pending=f.run('deletedProjectsDialog()');f.run("openModal('다른 창','유지')");f.get('#deleted-project-list').innerHTML='new';f.requests[0].resolve({channels:[archived]});await pending;assert.equal(f.get('#deleted-project-list').innerHTML,'new');assert.ok(f.modal.innerHTML.includes('유지'));
});
