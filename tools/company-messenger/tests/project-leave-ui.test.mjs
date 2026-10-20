import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/\bboot\(\);\s*$/,'');

function fixture(){
 const nodes=new Map(),storage=new Map(),requests=[],selected=[],notices=[];
 const get=selector=>{if(!nodes.has(selector)){const classes=new Set();nodes.set(selector,{innerHTML:'',textContent:'',value:'',disabled:false,open:false,isConnected:true,dataset:{},style:{},scrollHeight:100,classList:{add:value=>classes.add(value),remove:value=>classes.delete(value),contains:value=>classes.has(value),toggle(value,active){if(active)classes.add(value);else classes.delete(value);}},querySelector:get,querySelectorAll:()=>[],insertAdjacentHTML(position,html){this.innerHTML+=html;},addEventListener(name,callback){this['on'+name]=callback;},setAttribute(){},removeAttribute(){},focus(){},contains(){return false;},closest(){return null;},showModal(){this.open=true;},close(){this.open=false;}});}return nodes.get(selector);};
 const context=vm.createContext({document:{querySelector:get,querySelectorAll:()=>[],addEventListener(){},activeElement:null,hidden:false},window:{parent:{},matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener(){}},location:{pathname:'/messenger/',origin:'http://localhost'},localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},URL,URLSearchParams,CSS:{escape:String},setTimeout(){},clearTimeout(){}});
 const run=code=>vm.runInContext(code,context);run(source);run("Object.assign(state,{user:{id:'u1',name:'유호',role:'owner'},integrated:{canWrite:true,canManage:true},members:[{id:'u1',name:'유호'},{id:'u2',name:'민지'}],channels:[{id:'project',kind:'channel',category:'project',scope:'private',name:'가을 <캠페인>',description:'자료',memberIds:['u1','u2'],canManage:true,canDelete:true,canLeave:true,canPost:true},{id:'public',kind:'channel',category:'generic',scope:'public',name:'정보방',memberIds:['u1','u2'],canPost:true},{id:'self',kind:'self',scope:'private',memberIds:['u1'],canPost:true}],channelId:'project',chatCategory:'all',categoryChannels:{all:'project',personal:'self'}});");
 context.request=(path,options={})=>new Promise((resolve,reject)=>requests.push({path,options,resolve,reject}));context.selected=selected;context.notices=notices;
 run("const actualSyncChannelHeader=syncChannelHeader;api=request;toast=(message)=>notices.push(message);renderNavigation=()=>{};syncChannelHeader=()=>{};syncComposerAccess=()=>{};renderMessages=()=>{};renderReplyContext=()=>{};renderQueue=()=>{};renderEmptyChannel=()=>{};renderComposeExtras=()=>{};markRead=async()=>{};parentMessage=()=>{};refreshDetailViews=async()=>{};selectChannel=async channelId=>{saveDraft();state.channelId=channelId;state.navigationSeq++;selected.push(channelId);};");
 return{get,storage,requests,selected,notices,run,context,state:run('state'),modal:get('#modal')};
}

test('current project participants may leave including viewers, creators and the last person',()=>{
 const f=fixture();assert.equal(f.run('canLeaveProject(state.channels[0])'),true);f.run("state.integrated.canWrite=false;state.channels[0].memberIds=['u1']");assert.equal(f.run('canLeaveProject(state.channels[0])'),true);f.run("state.channels[0].scope='public'");assert.equal(f.run('canLeaveProject(state.channels[0])'),true);f.run('state.channels[0].canLeave=false');assert.equal(f.run('canLeaveProject(state.channels[0])'),false);f.run('state.channels[1].canLeave=true');assert.equal(f.run('canLeaveProject(state.channels[1])'),false);f.run("state.channels[0].canLeave=true;state.channels[0].memberIds=['other']");assert.equal(f.run('canLeaveProject(state.channels[0])'),false);
});

test('the visible leave control is a separate sibling button and names the correct room',()=>{
 const f=fixture(),html=f.run('conversationNavItem(state.channels[0])');assert.ok(html.includes('data-channel="project"'));assert.ok(html.includes('data-project-leave="project"'));assert.ok(html.includes('title="가을 &lt;캠페인&gt; 대화방 나가기"'));assert.ok(html.includes('aria-label="가을 &lt;캠페인&gt; 대화방 나가기"'));assert.match(html,/<\/button><button type="button" class="project-leave-button"/);assert.equal((html.match(/<button/g)||[]).length,2);assert.ok(!f.run('conversationNavItem(state.channels[1])').includes('data-project-leave'));
});

test('clicking a room X does not select that room or overwrite the currently open draft',()=>{
 const f=fixture();f.state.channelId='self';f.state.chatCategory='personal';f.get('#composer-input').value='내 메모';let prevented=false,stopped=false;const leave={dataset:{projectLeave:'project'}};f.context.event={target:{closest:selector=>selector==='[data-project-leave]'?leave:null},preventDefault(){prevented=true;},stopPropagation(){stopped=true;}};f.run('handleSidebarAction(event)');assert.equal(prevented,true);assert.equal(stopped,true);assert.equal(f.state.channelId,'self');assert.equal(f.get('#composer-input').value,'내 메모');assert.deepEqual(f.selected,[]);assert.ok(f.modal.innerHTML.includes('내 대화방 목록에서만 빠져요'));
});

test('leave needs one confirmation and cancel changes nothing',()=>{
 const f=fixture();f.run("leaveProjectDialog('project')");assert.ok(f.modal.innerHTML.includes('다른 크루의 대화와 파일은 지워지지 않아요'));assert.ok(f.modal.innerHTML.includes('id="confirm-leave-project"'));f.get('#cancel-leave-project').onclick();assert.equal(f.modal.open,false);assert.equal(f.requests.length,0);assert.equal(f.state.channels.length,3);
});

test('leaving uses POST leave, blocks a duplicate request and selects another room in the same category',async()=>{
 const f=fixture();f.storage.set('synk-messenger:draft:u1:project','이 방의 초안');f.storage.set('synk-messenger:draft:u1:self','다른 초안');const pending=f.run("leaveProjectChannel('project',null)");await f.run("leaveProjectChannel('project',null)");assert.equal(f.requests.length,1);assert.equal(f.requests[0].path,'/api/channels/project/leave');assert.equal(f.requests[0].options.method,'POST');assert.equal(f.run('canPostToChannel()'),false);f.requests[0].resolve({ok:true,newManagerId:'u2',archived:false});await pending;assert.deepEqual(f.selected,['public']);assert.equal(f.state.channels.some(channel=>channel.id==='project'),false);assert.equal(f.storage.has('synk-messenger:draft:u1:project'),false);assert.equal(f.storage.get('synk-messenger:draft:u1:self'),'다른 초안');assert.ok(f.requests.every(request=>request.options.method!=='DELETE'));
});

test('a late leave response preserves the current other room, its draft and a newer modal',async()=>{
 const f=fixture();f.run("leaveProjectDialog('project')");const pending=f.run("leaveProjectChannel('project',null)");f.run("state.channelId='self';state.chatCategory='personal';state.navigationSeq++;openModal('다른 창','유지');");f.get('#composer-input').value='보존할 메모';f.requests[0].resolve({ok:true,archived:false});await pending;assert.equal(f.state.channelId,'self');assert.equal(f.get('#composer-input').value,'보존할 메모');assert.equal(f.modal.open,true);assert.ok(f.modal.innerHTML.includes('유지'));assert.deepEqual(f.selected,[]);
});

test('a rejected leave keeps membership and the draft and restores posting',async()=>{
 const f=fixture();f.run("leaveProjectDialog('project')");f.storage.set('synk-messenger:draft:u1:project','보존');const pending=f.run("leaveProjectChannel('project',$('#confirm-leave-project'))");f.requests[0].reject(new Error('연결을 확인해 주세요'));await pending;assert.equal(f.state.channelId,'project');assert.equal(f.run('canPostToChannel()'),true);assert.equal(f.storage.get('synk-messenger:draft:u1:project'),'보존');assert.equal(f.get('#modal-error').textContent,'연결을 확인해 주세요');
});

test('the last person gets an archive explanation and an empty category remains safe',async()=>{
 const f=fixture();f.state.channels=f.state.channels.filter(channel=>channel.id!=='public');f.state.channels[0].memberIds=['u1'];f.run("leaveProjectDialog('project')");assert.ok(f.modal.innerHTML.includes('혼자 남은 방이라 보관해 두고, ‘삭제된 대화방’에서 복원'));const pending=f.run("leaveProjectChannel('project',null)");f.requests[0].resolve({ok:true,archived:true});await pending;assert.equal(f.state.channelId,null);assert.equal(f.state.chatCategory,'all');assert.ok(f.notices.some(text=>text.includes('‘삭제된 대화방’에서 복원')));
});

test('last-participant copy uses server active membership instead of historical inactive membership IDs',()=>{
 const f=fixture();assert.equal(f.state.channels[0].memberIds.length,2);f.state.channels[0].activeMemberCount=1;f.run("leaveProjectDialog('project')");assert.ok(f.modal.innerHTML.includes('참여 크루 1명'));assert.ok(f.modal.innerHTML.includes('혼자 남은 방이라 보관'));f.run('syncProjectParticipation()');assert.ok(f.get('#project-participation').innerHTML.includes('참여 크루 1명'));
});

test('server-granted restoration for a last-leaver archive works for viewers without weakening ordinary restore permissions',()=>{
 const f=fixture();f.context.archived={id:'project',kind:'channel',category:'project',deletedAt:'2026-09-30T00:00:00Z',memberIds:[],archivedByLeave:true,canRestore:true};f.run('state.integrated.canWrite=false');assert.equal(f.run('canRestoreProject(archived)'),true);f.run('archived.canRestore=false');assert.equal(f.run('canRestoreProject(archived)'),false);f.run("archived.canRestore=true;archived.archivedByLeave=false;archived.memberIds=['u1']");assert.equal(f.run('canRestoreProject(archived)'),false);
});

test('ordinary project crew retain personal notification settings but do not enter manager settings',()=>{
 const f=fixture();f.context.opened=[];f.run("editChannelDialog=()=>opened.push('manager');channelNotificationsDialog=()=>opened.push('notifications');roomSettingsDialog();state.channels[0].canManage=false;state.integrated.canWrite=false;roomSettingsDialog()");assert.deepEqual(Array.from(f.context.opened),['manager','notifications']);
});

test('a public project can re-invite departed crew only when the server grants invitation permission',()=>{
 const f=fixture();f.run("state.channels[0].scope='public';state.channels[0].canInvite=true");assert.equal(f.run('canInviteProject(state.channels[0])'),true);f.run('state.channels[0].canInvite=false');assert.equal(f.run('canInviteProject(state.channels[0])'),false);
});

test('the crew directory presents one range selector and retains direct crew clicks',()=>{
 const f=fixture();f.run('applyDirectoryLayout=()=>{};renderDirectory=()=>{};installDirectory()');const html=f.get('.shell').innerHTML;assert.ok(html.includes('id="directory-team"'));assert.ok(!html.includes('data-directory-filter'));assert.ok(html.includes('이름을 누르면 개인 대화'));
});

test('the concise header retains notifications, search and room settings without a duplicate task button',()=>{
 const f=fixture();f.run('installProductivityUI()');assert.ok(f.get('.header-actions').innerHTML.includes('id="personal-bell"'));assert.ok(!f.get('.header-actions').innerHTML.includes('id="personal-tools"'));assert.ok(f.get('#channel-search').innerHTML.includes('id="channel-notifications"'));
});

test('the restoration list distinguishes a last-leaver archive from a deleted room',()=>{
 const f=fixture();f.context.archived={...f.state.channels[0],deletedAt:'2026-09-30T00:00:00Z',archivedByLeave:true};let html=f.run('deletedProjectRows([archived])');assert.ok(html.includes('보관 · 마지막 사람이 나간 방'));f.context.archived.archivedByLeave=false;html=f.run('deletedProjectRows([archived])');assert.ok(html.includes('삭제</small>'));assert.ok(!html.includes('마지막 사람이 나간 방'));
});

test('the current project title has a mobile leave shortcut that opens the same confirmation and follows room permissions',()=>{
 const f=fixture();f.run('actualSyncChannelHeader()');let html=f.get('#channel-title').innerHTML;assert.ok(html.includes('id="current-project-leave"'));assert.ok(html.includes('aria-label="가을 &lt;캠페인&gt; 대화방 나가기"'));f.get('#current-project-leave').onclick();assert.ok(f.modal.innerHTML.includes('대화방에서 나갈까요?'));assert.equal(f.requests.length,0);f.state.channels[0].canLeave=false;f.run('actualSyncChannelHeader()');assert.ok(!f.get('#channel-title').innerHTML.includes('current-project-leave'));f.state.channelId='public';f.run('actualSyncChannelHeader()');assert.ok(!f.get('#channel-title').innerHTML.includes('current-project-leave'));
});
