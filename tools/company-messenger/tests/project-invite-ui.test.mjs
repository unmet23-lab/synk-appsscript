import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/\bboot\(\);\s*$/,'');
function fixture(){
 const nodes=new Map(),requests=[],storage=new Map();
 const get=key=>{if(!nodes.has(key)){const classes=new Set();nodes.set(key,{innerHTML:'',textContent:'',value:'',disabled:false,open:false,isConnected:true,dataset:{},style:{},classList:{add:value=>classes.add(value),remove:value=>classes.delete(value),contains:value=>classes.has(value),toggle(value,active){if(active)classes.add(value);else classes.delete(value);}},querySelector:get,querySelectorAll:()=>[],addEventListener(event,callback){this['on'+event]=callback;},setAttribute(){},removeAttribute(){},focus(){},contains(){return false;},closest(){return null;},showModal(){this.open=true;},close(){this.open=false;}});}return nodes.get(key);};
 for(const key of ['#app','#modal','#project-participation','#channel-form','#channel-edit-form','#project-invite-form','#new-channel-name','#project-crew-search','#project-crew-list','#project-access','#project-create-options','#project-create-picker','#public-channel-note','#project-access-note','#project-selection-count','#project-member-total','#project-invite-submit','#create-project-submit','#cancel-channel','#close-modal','#modal-error','[data-project-members]','[data-project-invite]','button[type=submit]','input[name="category"]:checked'])get(key);
 get('#project-access').value='private';get('input[name="category"]:checked').value='project';
 const document={querySelector:get,querySelectorAll:()=>[],addEventListener(){},activeElement:null},parent={};
 const context=vm.createContext({document,window:{parent,matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener(){}},location:{pathname:'/messenger/',origin:'http://localhost'},localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},URL,URLSearchParams,CSS:{escape:String},setTimeout(){},clearTimeout(){},FormData:class {constructor(form){this.values=form.values||{};}*[Symbol.iterator](){yield* Object.entries(this.values);}}});
 const run=code=>vm.runInContext(code,context);run(source);run("Object.assign(state,{user:{id:'u1',name:'유호',role:'owner'},integrated:{canWrite:true,canManage:true},members:[{id:'u1',name:'유호',teamName:'운영팀'},{id:'u2',name:'민지',teamName:'마케팅'},{id:'u3',name:'지수',teamName:'디자인',companyRole:'viewer'},{id:'u4',name:'<img src=x>',teamName:'마케팅'}],channels:[{id:'private',kind:'channel',scope:'private',category:'project',name:'캠페인',memberIds:['u1','u2'],canInvite:true,canManage:true},{id:'public',kind:'channel',scope:'public',category:'project',name:'공개 프로젝트',memberIds:['u1','u2','u3','u4'],canInvite:false}],channelId:'private',chatCategory:'all'});");
 context.request=(path,options={})=>new Promise((resolve,reject)=>requests.push({path,options,resolve,reject}));run('api=request;toast=()=>{};refreshChannels=async()=>{};selectChannel=async channelId=>{state.channelId=channelId;};');
 return{get,run,context,requests,state:run('state'),modal:get('#modal')};
}

test('project creation defaults to selected crew and explicit public creation sends no member IDs',()=>{
 const f=fixture();const payload=f.run("channelCreationPayload({name:'봄',category:'project'},new Set(['u1','u3','missing']))");assert.equal(payload.scope,'private');assert.deepEqual(Array.from(payload.memberIds),['u1','u3']);
 const publicPayload=f.run("channelCreationPayload({name:'공개',category:'project',scope:'public'},new Set(['u1','u2']))");assert.equal(publicPayload.scope,'public');assert.equal('memberIds' in publicPayload,false);assert.equal(f.state.channels.find(room=>room.id==='public').scope,'public');
 const solo=f.run("channelCreationPayload({name:'혼자 시작',category:'project'},new Set(['u1']))");assert.deepEqual(Array.from(solo.memberIds),['u1']);
});

test('crew selection searches name and team, preserves selected crew and includes read-only invitees',()=>{
 const f=fixture();const html=f.run("projectCrewListHtml({selected:new Set(['u3']),existing:['u1','u2']})");assert.match(html,/data-project-crew="u1" checked disabled/);assert.match(html,/data-project-crew="u3" checked/);assert.ok(html.includes('&lt;img src=x&gt;'));assert.ok(!html.includes('<img src=x>'));
 const filtered=f.run("projectCrewListHtml({query:'마케팅'})");assert.ok(filtered.includes('data-project-crew="u2"'));assert.ok(filtered.includes('data-project-crew="u4"'));assert.ok(!filtered.includes('data-project-crew="u3"'));
});

test('invitation requires server permission, writable role, project and actual room membership',()=>{
 const f=fixture();assert.equal(f.run('canInviteProject(state.channels[0])'),true);assert.equal(f.run('canInviteProject(state.channels[1])'),false);
 f.run('state.channels[0].canInvite=false');assert.equal(f.run('canInviteProject(state.channels[0])'),false);f.run("state.channels[0].canInvite=true;state.channels[0].memberIds=['u2']");assert.equal(f.run('canInviteProject(state.channels[0])'),false);f.run("state.channels[0].memberIds=['u1'];state.integrated.canWrite=false");assert.equal(f.run('canInviteProject(state.channels[0])'),false);
});

test('project participation controls clearly distinguish public membership from invitations',()=>{
 const f=fixture();f.run('syncProjectParticipation()');let html=f.get('#project-participation').innerHTML;assert.ok(html.includes('참여 크루 2명'));assert.ok(html.includes('data-project-invite'));assert.ok(html.includes('고른 크루만 참여'));
 f.run("state.channelId='public';syncProjectParticipation()");html=f.get('#project-participation').innerHTML;assert.ok(html.includes('전체 공개'));assert.ok(html.includes('참여 크루 4명'));assert.ok(!html.includes('data-project-invite'));
});

test('public project roster explains current participation and reinvitation and a solo admin can reach crew registration',()=>{
 const f=fixture();f.run("state.members=[state.members[0]];state.channels[1].memberIds=['u1'];projectMembersDialog('public')");assert.ok(f.modal.innerHTML.includes('나간 크루는 관리자가 다시 초대'));assert.ok(f.modal.innerHTML.includes('먼저 크루를 등록해 주세요'));assert.ok(f.modal.innerHTML.includes('data-project-register'));assert.ok(!f.modal.innerHTML.includes('id="project-invite-submit"'));assert.equal(f.requests.length,0);
});

test('inviting selected crew posts only new members and explains access to previous messages and files',async()=>{
 const f=fixture();f.run("projectMembersDialog('private',{invite:true})");assert.ok(f.modal.innerHTML.includes('지난 대화와 파일을 볼 수 있어요'));
 const change=id=>f.get('#project-crew-list').onchange({target:{closest:()=>({dataset:{projectCrew:id},checked:true,disabled:false})}});change('u3');change('u4');assert.equal(f.get('#project-selection-count').textContent,'2명 선택');assert.equal(f.get('#project-invite-submit').disabled,false);
 const pending=f.get('#project-invite-form').onsubmit({preventDefault(){}});assert.equal(f.requests[0].path,'/api/channels/private/members');assert.deepEqual(Array.from(f.requests[0].options.body.memberIds),['u3','u4']);f.state.channels[0].memberIds.push('u3','u4');f.requests[0].resolve({addedIds:['u3','u4']});await pending;assert.equal(f.get('#project-selection-count').textContent,'0명 선택');assert.equal(f.get('#project-invite-submit').disabled,true);
});

test('permission changes invalidate an open invitation and removed room membership closes it',()=>{
 const f=fixture();f.run("projectMembersDialog('private');state.channels[0].canInvite=false;refreshProjectPicker()");assert.equal(f.get('#project-invite-submit').disabled,true);assert.ok(!f.get('#project-crew-list').innerHTML.includes('data-project-crew="u3"'));
 f.run("state.channels[0].memberIds=['u2'];refreshProjectPicker()");assert.equal(f.modal.open,false);
});

test('a late invitation failure cannot overwrite another modal',async()=>{
 const f=fixture();f.run("projectMembersDialog('private')");f.get('#project-crew-list').onchange({target:{closest:()=>({dataset:{projectCrew:'u3'},checked:true,disabled:false})}});const pending=f.get('#project-invite-form').onsubmit({preventDefault(){}});f.run("openModal('다른 창','새 창 내용')");f.get('#modal-error').textContent='';f.requests[0].reject(new Error('초대 권한이 바뀌었어요'));await pending;assert.equal(f.get('#modal-error').textContent,'');assert.ok(f.modal.innerHTML.includes('새 창 내용'));
});

test('creating a project with nobody else selected submits a solo private room without changing old public rooms',async()=>{
 const f=fixture();f.get('#channel-form').values={name:'새 캠페인',category:'project',scope:'private'};f.run("createChannelDialog('project')");assert.equal(f.get('#project-access').value,'private');assert.equal(f.get('#project-selection-count').textContent,'나 포함 1명 참여');assert.ok(f.modal.innerHTML.includes('<fieldset class="room-category hidden">'));assert.ok(f.modal.innerHTML.includes('<details class="project-extra-settings" id="project-extra-settings">'));const pending=f.get('#channel-form').onsubmit({preventDefault(){}});assert.deepEqual(Array.from(f.requests[0].options.body.memberIds),['u1']);assert.equal(f.requests[0].options.body.scope,'private');f.requests[0].resolve({channel:{id:'new'}});await pending;assert.equal(f.state.channelId,'new');assert.equal(f.state.channels.find(room=>room.id==='public').scope,'public');
});

test('private project editing does not offer a public category change',()=>{
 const f=fixture();f.run('editChannelDialog()');assert.ok(f.modal.innerHTML.includes('고른 크루만 들어오는 프로젝트'));assert.ok(f.modal.innerHTML.includes('<fieldset disabled class="room-category hidden"'));assert.ok(!f.modal.innerHTML.includes('회사 크루 모두가 함께 보는 대화방'));
});
