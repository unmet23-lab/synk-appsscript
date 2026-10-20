import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as Overview from './workspace-overview.mjs';
import {applySharingFence} from './sharing-fence.mjs';
import {mountCourseWriting} from './course-writing-ui.mjs';

const source=fs.readFileSync(new URL('./app.mjs',import.meta.url),'utf8').replace("import {mountHomeworkReview} from './homework-review.mjs';",'').replace("import {applySharingFence} from './sharing-fence.mjs';",'').replace("import {createPersonalizationUI} from './personalization-ui.mjs';",'').replace(/^import \{[^\n]*\} from '\.\/workspace-overview\.mjs';\r?\n/m,'');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const reply=(body,status=200)=>({ok:status<400,status,json:async()=>body});
const learner=(overrides={})=>({id:'learner-a',name:'연결 학생',goal:'안내문 읽기',skills:[{id:'ko.reading.detail',label:'세부 정보',status:'unseen',n:0,correct:0}],connectedAt:'2026-10-02T10:00:00Z',sharing:{enabled:true,revision:2},observations:[],...overrides});
const workspace=(learners=[])=>({mode:'local-linked',synthetic:false,teacher:{id:'teacher-local'},classes:[{id:'class-local',name:'내 수업',learners}],content:[{id:'reading-detail',title:'도서관 읽기',assignable:true,modality:'reading'}],assignments:[],integration:{worldConnected:true,productionConnected:false}});

// Run the real module while controlling the order of authentication and data responses.
function fixture({hash='',storedToken='',mode='local-linked',account=false,courseMount=mountCourseWriting,homework=null}={}){
  const nodes=new Map(),documentEvents=new Map(),requests=[],pending=[],storage=new Map();let cleanURL=null,poll;
  if(storedToken)storage.set('synk.teacher.local-linked.session',storedToken);
  function element(id){if(!nodes.has(id))nodes.set(id,{id,value:id==='assignment-filter'?'all':'',textContent:'',innerHTML:'',hidden:false,dataset:{},listeners:new Map(),addEventListener(name,fn){this.listeners.set(name,fn);},replaceChildren(){this.innerHTML='';this.textContent='';},close(){this.open=false;},showModal(){this.open=true;},querySelector(){return element(id+'-submit');},get elements(){return {instructions:element('assignment-instructions')};},reset(){for(const name of id==='assignment-form'?['assignment-title','assignment-due','assignment-instructions','content-select']:['note-text','note-skill'])element(name).value='';}});return nodes.get(id);}
  const context={...Overview,applySharingFence,URL,URLSearchParams,Date,Error,FormData:class{},crypto:{randomUUID:()=> 'test-key'},setTimeout:()=>0,clearTimeout(){},setInterval:fn=>{poll=fn;return 1;},clearInterval(){poll=null;},
    location:{href:'http://127.0.0.1:44001/'+(account?'?account=1':'')+hash,origin:'http://127.0.0.1:44001'},history:{replaceState(_state,_title,url){cleanURL=url;}},
    sessionStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},
    window:{addEventListener(){}},document:{getElementById:element,documentElement:element('html'),querySelector:selector=>selector==='dialog[open]'?[...nodes.values()].find(n=>n.open)||null:null,querySelectorAll:selector=>selector==='dialog[open]'?[...nodes.values()].filter(n=>n.open):[],addEventListener:(name,fn)=>documentEvents.set(name,fn)},
    mountHomeworkReview:()=>({show(){},peek(){},reset(){if(homework)homework.resets++;},hasDraft:()=>!!homework?.draft,refresh(){}}),createPersonalizationUI:()=>({set(){},invalidate(){element('personalization-panel').hidden=true;}}),
    fetch:(url,options={})=>{requests.push({url,options});if(url==='/api/health')return Promise.resolve(reply({mode}));return new Promise((resolve,reject)=>pending.push({url,resolve,reject}));}
  };
  if(account){context.window.parent={location:{origin:context.location.origin},postMessage(){},SYNKClassroomHost:{mode:'account-linked',classId:'class-local',request:(url,payload)=>{requests.push({url,payload});return new Promise((resolve,reject)=>pending.push({url,resolve:response=>response.json().then(resolve),reject}));}}};context.document.fonts={ready:Promise.resolve()};}
  context.mountCourseWriting=courseMount;
  vm.createContext(context);vm.runInContext(source.replace("import {mountCourseWriting} from './course-writing-ui.mjs';",''),context,{filename:'app.mjs'});
  return {element,requests,storage,pending,view:()=>context.window.SYNKTeacherView,get cleanURL(){return cleanURL;},
    resolve(url,body,status=200){const at=pending.findIndex(row=>row.url===url);assert.notEqual(at,-1,`pending ${url}`);pending.splice(at,1)[0].resolve(reply(body,status));},
    reject(url,error=Error('network failure')){const at=pending.findIndex(row=>row.url===url);assert.notEqual(at,-1);pending.splice(at,1)[0].reject(error);},
    click(id,dataset={}){return documentEvents.get('click')({target:{closest:()=>({id,dataset,disabled:false,classList:{contains:()=>false}})}});},
    poll(){assert.ok(poll,'poll callback registered');return poll();},
    submit(id){return element(id).listeners.get('submit')({preventDefault(){},submitter:{disabled:false}});}
  };
}

test('linked mode starts with a teacher gate and never fetches an anonymous workspace',async()=>{
  const f=fixture();await tick();assert.equal(f.element('teacher-session').hidden,false);assert.equal(f.element('html').dataset.ready,'auth');
  assert.equal(f.requests.some(row=>row.url==='/api/workspace'),false);assert.equal(f.element('world-connections').hidden,true);
});

test('teacher key is removed from the URL before exchange and only the bearer is retained',async()=>{
  const f=fixture({hash:'#teacher-key=temporary-key'});assert.equal(f.cleanURL,'/');await tick();
  const exchange=f.requests.find(row=>row.url==='/api/teacher/session');assert.deepEqual(JSON.parse(exchange.options.body),{key:'temporary-key'});
  f.resolve('/api/teacher/session',{token:'teacher-token'});await tick();const get=f.requests.find(row=>row.url==='/api/workspace');assert.equal(get.options.headers.Authorization,'Bearer teacher-token');
  f.resolve('/api/workspace',workspace());await tick();assert.equal(f.storage.get('synk.teacher.local-linked.session'),'teacher-token');assert.equal(f.element('teacher-session').hidden,true);
  assert.match(f.element('roster').innerHTML,/연결된 학생이 아직 없어요/);assert.equal(f.element('personalization-button').hidden,true);
});

test('an invalid key stays at the teacher gate and does not retain a credential',async()=>{
  const f=fixture({hash:'#teacher-key=wrong'});await tick();f.resolve('/api/teacher/session',{ok:false,code:'UNAUTHORIZED'},401);await tick();
  assert.equal(f.element('teacher-session').hidden,false);assert.equal(f.storage.size,0);assert.equal(f.requests.some(row=>row.url==='/api/workspace'),false);
});

test('manual teacher reconnection reads the current key and opens an empty real class',async()=>{
  const f=fixture();await tick();f.element('teacher-key').value='new-key';const submit=f.submit('teacher-session-form');f.resolve('/api/teacher/session',{token:'new-token'});await tick();f.resolve('/api/workspace',workspace());await submit;
  assert.equal(f.element('teacher-key').value,'');assert.equal(f.element('html').dataset.ready,'true');assert.equal(f.element('world-connections').hidden,false);
});

test('linked student details show consent and never link into the demo student impersonation screen',async()=>{
  const f=fixture({storedToken:'token'});await tick();f.resolve('/api/workspace',workspace([learner()]));await tick();
  assert.match(f.element('student-detail').innerHTML,/WORLD 계정 연결됨 · 학습 공유 중/);assert.doesNotMatch(f.element('student-detail').innerHTML,/href="\/student|예시 학생/);
  assert.match(f.element('student-detail').innerHTML,/자신의 WORLD 앱에서 과제를/);
});

test('a pending or withdrawn learner cannot be assigned work through the rendered action',async()=>{
  const f=fixture({storedToken:'token'});await tick();f.resolve('/api/workspace',workspace([learner({connectedAt:null,sharing:{enabled:false,revision:0}})]));await tick();
  assert.match(f.element('student-detail').innerHTML,/id="assign" disabled/);assert.match(f.element('student-detail').innerHTML,/계정 연결을 기다리고/);
});

test('logout removes student data and a late workspace cannot restore it',async()=>{
  const f=fixture({storedToken:'token'});await tick();f.resolve('/api/workspace',workspace([learner()]));await tick();
  const refresh=f.element('refresh').onclick();const logout=f.click('teacher-logout');f.resolve('/api/logout',{ok:true});await logout;
  assert.equal(f.element('student-detail').innerHTML,'');assert.equal(f.storage.size,0);f.resolve('/api/workspace',workspace([learner()]));await refresh;
  assert.equal(f.element('student-detail').innerHTML,'');assert.equal(f.element('html').dataset.ready,'auth');
});

test('an old 401 cannot sign out a newly opened teacher session',async()=>{
  const f=fixture({storedToken:'old-token'});await tick();f.resolve('/api/workspace',workspace());await tick();
  const stale=f.element('refresh').onclick();const logout=f.click('teacher-logout');f.resolve('/api/logout',{ok:true});await logout;
  f.element('teacher-key').value='fresh-key';const login=f.submit('teacher-session-form');f.resolve('/api/teacher/session',{token:'fresh-token'});await tick();
  f.resolve('/api/workspace',{ok:false,code:'UNAUTHORIZED'},401);await stale;f.resolve('/api/workspace',workspace([learner()]));await login;
  assert.equal(f.storage.get('synk.teacher.local-linked.session'),'fresh-token');assert.equal(f.element('teacher-session').hidden,true);assert.match(f.element('student-detail').innerHTML,/연결 학생/);
});

test('a current 401 clears names, connections, and retained bearer before asking to reconnect',async()=>{
  const f=fixture({storedToken:'token'});await tick();f.resolve('/api/workspace',workspace([learner()]));await tick();const refresh=f.element('refresh').onclick();f.resolve('/api/workspace',{ok:false,code:'UNAUTHORIZED'},401);await refresh;
  assert.equal(f.element('student-detail').innerHTML,'');assert.equal(f.element('world-connections').hidden,true);assert.equal(f.storage.size,0);assert.equal(f.element('teacher-session').hidden,false);
});

test('revoke captures the current learner and consent revision',async()=>{
  const f=fixture({storedToken:'token'});await tick();f.resolve('/api/workspace',workspace([learner()]));await tick();const revoke=f.click('',{revoke:'learner-a'});
  assert.deepEqual(JSON.parse(f.requests.find(row=>row.url==='/api/links/revoke').options.body),{learnerId:'learner-a',revision:2});
  f.resolve('/api/links/revoke',{ok:true});await tick();f.resolve('/api/workspace',workspace([learner({sharing:{enabled:false,revision:3}})]));await revoke;
  assert.match(f.element('student-detail').innerHTML,/학습 공유 안 함/);
});

test('new learner connection sends only the selected class and chosen name',async()=>{
  const f=fixture({storedToken:'token'});await tick();f.resolve('/api/workspace',workspace());await tick();f.element('world-learner-name').value=' 새 학생 ';const joining=f.submit('world-link-form');
  assert.deepEqual(JSON.parse(f.requests.find(row=>row.url==='/api/links').options.body),{classId:'class-local',name:'새 학생'});
  f.resolve('/api/links',{code:'1234-5678',learnerId:'learner-a',expiresAt:'2026-10-02T13:00:00Z'});await tick();f.resolve('/api/workspace',workspace([learner({connectedAt:null,sharing:{enabled:false,revision:0}})]));await joining;
  assert.match(f.element('world-link-result').innerHTML,/1234-5678/);assert.match(f.element('world-link-result').innerHTML,/공유 범위를 확인/);
});

test('the original demo still loads without a bearer or connected controls',async()=>{
  const f=fixture({mode:'demo'});await tick();f.resolve('/api/workspace',{...workspace([learner()]),mode:'demo',_token:'demo-csrf'});await tick();
  assert.equal(f.requests.find(row=>row.url==='/api/workspace').options.headers.Authorization,undefined);assert.equal(f.element('world-connections').hidden,true);assert.match(f.element('student-detail').innerHTML,/학생의 WORLD 과제 체험/);
});

test('poll continues through an open assignment and preserves a valid draft',async()=>{
  const student=learner({recommendation:{contentId:'reading-detail',reason:'연습 안내'}}),f=fixture({storedToken:'token'});await tick();f.resolve('/api/workspace',workspace([student]));await tick();
  await f.click('assign');f.element('assignment-title').value='작성 중인 제목';f.element('assignment-instructions').value='학생에게 전할 말';
  const polling=f.poll();f.resolve('/api/workspace',workspace([student]));await polling;
  assert.equal(f.element('assignment-dialog').open,true);assert.equal(f.element('assignment-title').value,'작성 중인 제목');assert.equal(f.element('assignment-instructions').value,'학생에게 전할 말');
});

test('sharing withdrawal during an open assignment closes it and erases the captured student draft',async()=>{
  const student=learner({recommendation:{contentId:'reading-detail'}}),f=fixture({storedToken:'token'});await tick();f.resolve('/api/workspace',workspace([student]));await tick();await f.click('assign');
  f.element('assignment-title').value='민감한 제목';f.element('assignment-instructions').value='민감한 학생 안내';
  const polling=f.poll();f.resolve('/api/workspace',workspace([learner({sharing:{enabled:false,revision:3}})]));await polling;
  assert.equal(f.element('assignment-dialog').open,false);assert.equal(f.element('assignment-title').value,'');assert.equal(f.element('assignment-instructions').value,'');assert.equal(f.element('assignment-student').textContent,'');
  await f.submit('assignment-form');assert.equal(f.requests.some(row=>row.url==='/api/assignments'),false);assert.match(f.element('student-detail').innerHTML,/학습 공유 안 함/);
});

test('a new consent epoch cannot keep a draft authorized under the previous consent',async()=>{
  const f=fixture({storedToken:'token'});await tick();f.resolve('/api/workspace',workspace([learner()]));await tick();await f.click('add-note');f.element('note-text').value='이전 동의의 관찰';
  const polling=f.poll();f.resolve('/api/workspace',workspace([learner({sharing:{enabled:true,revision:4}})]));await polling;
  assert.equal(f.element('note-dialog').open,false);assert.equal(f.element('note-text').value,'');assert.equal(f.element('note-student').textContent,'');await f.submit('note-form');assert.equal(f.requests.some(row=>row.url==='/api/observations'),false);
});

for(const failure of ['network','forbidden'])test(`${failure} on the current workspace hides records and blocks writes while retaining the login for retry`,async()=>{
  const f=fixture({storedToken:'token'});await tick();f.resolve('/api/workspace',workspace([learner()]));await tick();await f.click('add-note');f.element('note-text').value='작성 중인 관찰';
  const polling=f.poll();if(failure==='network')f.reject('/api/workspace');else f.resolve('/api/workspace',{ok:false,code:'FORBIDDEN'},403);await polling;
  assert.equal(f.storage.get('synk.teacher.local-linked.session'),'token');assert.equal(f.element('html').dataset.ready,'blocked');assert.equal(f.element('student-detail').innerHTML,'');assert.equal(f.element('roster').innerHTML,'');assert.equal(f.element('note-dialog').open,false);assert.equal(f.element('note-text').value,'');assert.equal(f.element('teacher-session').hidden,true);
  await f.submit('note-form');await f.submit('assignment-form');f.element('world-learner-name').value='다른 학생';await f.submit('world-link-form');assert.equal(f.requests.some(row=>['/api/observations','/api/assignments','/api/links'].includes(row.url)),false);
  const retry=f.element('retry').onclick();f.resolve('/api/workspace',workspace([learner()]));await retry;assert.equal(f.element('html').dataset.ready,'true');assert.match(f.element('student-detail').innerHTML,/연결 학생/);
});

test('a late write result cannot repopulate a connection code after access verification fails',async()=>{
  const f=fixture({storedToken:'token'});await tick();f.resolve('/api/workspace',workspace());await tick();f.element('world-learner-name').value='학생';const creating=f.submit('world-link-form');
  const polling=f.poll();f.reject('/api/workspace');await polling;f.resolve('/api/links',{code:'STALECODE',learnerId:'learner-a',expiresAt:'2026-10-02T13:00:00Z'});await creating;
  assert.equal(f.element('world-link-result').innerHTML,'');assert.equal(f.element('world-link-result').hidden,true);assert.equal(f.element('html').dataset.ready,'blocked');
});

for(const invalidation of ['learner-change','permission-loss','already-linked'])test('account invite cannot return after '+invalidation,async()=>{
 const f=fixture({account:true}),a=learner({accountConnected:false,connectedAt:null,sharing:{enabled:false,revision:0}}),b={...a,id:'learner-b'};
 f.resolve('/api/workspace',{...workspace([a,b]),mode:'account-linked'});await tick();
 assert.match(f.element('student-detail').innerHTML,/student-invite/);const creating=f.click('student-invite');await tick();
 assert.equal(f.element('student-invite-dialog').open,true);assert.deepEqual(JSON.parse(JSON.stringify(f.requests.find(r=>r.url==='/api/teacher/invites').payload)),{learnerId:'learner-a'});
 if(invalidation==='learner-change')await f.click('',{student:'learner-b'});
 else {const refresh=f.element('refresh').onclick();if(invalidation==='permission-loss')f.reject('/api/workspace');else f.resolve('/api/workspace',{...workspace([learner({accountConnected:true}),b]),mode:'account-linked'});await refresh;}
 f.resolve('/api/teacher/invites',{invite:{token:'a'.repeat(32),expiresAt:'2026-10-12T00:00:00Z'}});await creating;
 assert.equal(f.element('student-invite-code').value,'');assert.equal(f.element('student-invite-dialog').open,false);
});
test('account invite stays in the dialog through polling without browser storage',async()=>{
 const f=fixture({account:true}),student=learner({accountConnected:false,connectedAt:null,sharing:{enabled:false,revision:0}}),snapshot={...workspace([student]),mode:'account-linked'};
 f.resolve('/api/workspace',snapshot);await tick();const creating=f.click('student-invite');f.resolve('/api/teacher/invites',{invite:{token:'b'.repeat(32),expiresAt:'2026-10-12T00:00:00Z'}});await creating;
 assert.equal(f.element('student-invite-code').value,'b'.repeat(32));const polling=f.poll();f.resolve('/api/workspace',snapshot);await polling;
 assert.equal(f.element('student-invite-code').value,'b'.repeat(32));assert.equal(f.element('student-invite-dialog').open,true);assert.equal(f.storage.size,0);
});

for(const failure of ['network','503','forbidden','account-changed'])test('course draft lifecycle distinguishes '+failure,async()=>{
 let mounted=0,disposed=0,suspended=0,refreshed=0;
 const f=fixture({account:true,courseMount:()=>{mounted++;return {reload(){},refreshGroups(){refreshed++;},suspend(){suspended++;},dispose(){disposed++;}};}});
 const snapshot={...workspace([learner()]),mode:'account-linked'};
 f.resolve('/api/workspace',snapshot);await tick();await f.click('',{view:'writing'});assert.equal(mounted,1);
 const polling=f.poll(),transient=['network','503'].includes(failure);
 f.reject('/api/workspace',Object.assign(Error(failure),failure==='503'?{status:503}:failure==='forbidden'?{status:403,code:'FORBIDDEN'}:failure==='account-changed'?{code:'ACCOUNT_CHANGED'}:{}));await polling;
 assert.equal(suspended,transient?1:0);assert.equal(disposed,transient?0:1);assert.equal(f.element('html').dataset.ready,'blocked');
 const retry=f.element('retry').onclick();f.resolve('/api/workspace',snapshot);await retry;
 assert.equal(mounted,transient?1:2);assert.equal(refreshed,transient?1:0);
});

// 계정 포털은 고른 학생의 공유가 바뀌면 이 답(true)을 보고서야 교사 화면을 다시 만들지 않는다. 걸러 낸 학생의 기록과
// 그 학생의 공유에 묶인 작성 창은 바로 닫히고, 명부 기준인 과제 첨삭 초안은 그대로다.
test('account frame fences a withdrawn learner in place for the portal: records and the bound note close, the homework review draft stays',async()=>{
 const homework={draft:true,resets:0},f=fixture({account:true,homework}),a=learner({accountConnected:true}),b=learner({id:'learner-b',name:'하늘 학생',accountConnected:true});
 const meta=(id,revision,enabled)=>({id,revision,enabled,connected:true,revoked:false}),fresh={...workspace([a,b]),mode:'account-linked'};
 f.resolve('/api/workspace',fresh);await tick();await f.click('',{student:'learner-a'});await f.click('add-note');f.element('note-text').value='공유가 끊길 학생의 관찰';
 assert.equal(f.element('note-dialog').open,true);assert.match(f.element('student-detail').innerHTML,/세부 정보/);
 assert.equal(f.view().applySharing({classId:'class-other',learners:[meta('learner-a',3,false),meta('learner-b',2,true)]}),false,'다른 반의 범위는 받지 않는다');
 assert.equal(f.view().applySharing({classId:'class-local',learners:[{id:'learner-a'}]}),false,'빈 공유 정보는 받지 않는다');
 assert.equal(f.view().applySharing(null),false);assert.equal(f.element('note-dialog').open,true);
 assert.equal(f.view().applySharing({classId:'class-local',learners:[meta('learner-a',3,false),meta('learner-b',2,true)]}),true);
 assert.equal(f.element('note-dialog').open,false);assert.equal(f.element('note-text').value,'');assert.match(f.element('toast').textContent,/공유 또는 과제 상태가 바뀌어 작성 창을 닫았어요/);
 assert.match(f.element('student-detail').innerHTML,/학습 공유 안 함/);assert.doesNotMatch(f.element('student-detail').innerHTML,/세부 정보/);
 assert.equal(homework.resets,0);assert.equal(f.view().hasDraft(),true,'과제 첨삭 초안은 남는다');
 assert.equal(f.requests.filter(row=>row.url==='/api/workspace').length,2,'걸러 낸 뒤 최신 판을 다시 읽는다');
 // 다시 읽은 판이 옛 공유를 담고 와도 포털이 알린 공유 상태로 걸러 보인다.
 f.resolve('/api/workspace',fresh);await tick();assert.match(f.element('student-detail').innerHTML,/학습 공유 안 함/);assert.equal(f.view().hasDraft(),true);
 assert.equal(f.view().applySharing({classId:'class-local',learners:[meta('learner-a',3,false),meta('learner-b',2,true)]}),true,'이미 거른 상태면 그대로 true');
});
test('a frame that has not read its class yet keeps the portal scope for the first read',async()=>{
 const f=fixture({account:true}),meta=(id,revision,enabled)=>({id,revision,enabled,connected:true,revoked:false});
 assert.equal(f.view().applySharing({classId:'class-local',learners:[meta('learner-a',3,false)]}),true);
 f.resolve('/api/workspace',{...workspace([learner({accountConnected:true})]),mode:'account-linked'});await tick();
 assert.match(f.element('student-detail').innerHTML,/학습 공유 안 함/);assert.doesNotMatch(f.element('student-detail').innerHTML,/세부 정보/);
});
test('portal sharing acknowledges the synchronous course fence while exposing unsent course feedback to navigation guards',async()=>{
 const calls=[],course={reload(){},refreshGroups(){},applySharing(rows){calls.push(rows);},hasDraft:()=>true,dispose(){}};
 let initial;
 const f=fixture({account:true,courseMount:options=>{initial=options.sharingMetadata;return course;}}),meta=(revision,enabled)=>({id:'learner-a',revision,enabled,connected:true,revoked:false});
 assert.equal(f.view().applySharing({classId:'class-local',learners:[meta(2,true)]}),true);
 f.resolve('/api/workspace',{...workspace([learner({accountConnected:true})]),mode:'account-linked'});await tick();await f.click('',{view:'writing'});
 assert.equal(initial[0].revision,2);assert.equal(f.view().hasDraft(),true);
 assert.equal(f.view().applySharing({classId:'class-other',learners:[meta(3,false)]}),false);assert.equal(calls.length,0);
 assert.equal(f.view().applySharing({classId:'class-local',learners:[meta(3,false)]}),true);
 assert.equal(calls.length,1);assert.equal(calls[0][0].enabled,false);assert.equal(calls[0][0].revision,3);
});
