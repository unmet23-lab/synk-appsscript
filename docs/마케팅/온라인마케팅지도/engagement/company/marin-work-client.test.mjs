import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {CREW_PROFILE_CATALOG as catalog, createCrewProfileService} from './crew-profile-service.mjs';

const source=readFileSync(new URL('./public/marin-work.js',import.meta.url),'utf8');
const homeSource=readFileSync(new URL('./public/marin-home.js',import.meta.url),'utf8');
const tick=()=>new Promise(setImmediate);
const plain=value=>JSON.parse(JSON.stringify(value));
const confirmedProfile={skills:['design'],preferredTasks:['planning'],communication:'async',workMode:'solo',availableHours:10,participates:true,confirmed:true};

function fixture(role='admin'){
  const state={user:{id:'crew-a',name:'크루 가',active:true,role,teamId:'team-a'},tab:'home',modalRequest:0},handlers=[],requests=[],notices=[],nodes=new Map();
  const entities=new Map();const store={get:(kind,id)=>entities.get(kind+':'+id),put:(kind,id,value)=>entities.set(kind+':'+id,value),remove:(kind,id)=>entities.delete(kind+':'+id),all:kind=>[...entities].filter(([key])=>key.startsWith(kind+':')).map(([,value])=>value),transaction:callback=>callback()};
  store.put('users',state.user.id,state.user);store.put('teams','team-a',{id:'team-a',name:'마케팅팀',active:true});const service=createCrewProfileService({store,clock:()=> '2026-09-30T00:00:00.000Z'});
  const make=()=>({innerHTML:'',textContent:'',hidden:false,disabled:false,attrs:{},focus(){},scrollIntoView(){},setAttribute(key,value){this.attrs[key]=value;}});
  for(const id of ['marin-work-error','crew-work-result','crew-work-selected','marin-profile-form'])nodes.set(id,make());const body=make(),submit=make();
  const document={addEventListener:(type,fn)=>handlers.push({type,fn}),getElementById:id=>nodes.get(id)||null,querySelector:selector=>selector==='#overlay .modal-body'?body:selector.includes('button[type="submit"]')?submit:null,querySelectorAll:()=>[]};
  const form=values=>({dataset:{},values,querySelector:()=>submit,closest:selector=>selector.includes('form')?true:null});
  class FormDataMock{constructor(form){this.values=form.values||{};}get(key){const value=this.values[key];return Array.isArray(value)?value[0]??null:value??null;}getAll(key){const value=this.values[key];return value==null?[]:Array.isArray(value)?value:[value];}}
  const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const context=vm.createContext({state,document,FormData:FormDataMock,Set,Map,URL,URLSearchParams,window:{addEventListener(){}},sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},escape,icon:()=>'',number:value=>value==null?'—':String(value),time:value=>value,canManageTeam:()=>['admin','manager'].includes(state.user?.role),
    modal(_title,_subtitle,html){state.modalRequest++;body.innerHTML=html;},closeModal(){state.modalRequest++;body.innerHTML='';},notify:text=>notices.push(text),api(path,payload){return new Promise((resolve,reject)=>requests.push({path,payload,resolve,reject}));},render(){},
  });const run=code=>vm.runInContext(code,context);run(homeSource+'\n'+source);
  const dispatch=(type,target)=>{for(const handler of handlers.filter(row=>row.type===type))handler.fn({target,preventDefault(){}});};
  const click=action=>dispatch('click',{dataset:{marinWork:action},closest:selector=>selector==='[data-marin-work]'?{dataset:{marinWork:action}}:null});
  async function respond(index){const row=requests[index];try{const data=row.path==='/api/crew-profile'?(row.payload===undefined?service.own(state.user):service.save(state.user,plain(row.payload))):row.path==='/api/crew-profile/delete'?service.remove(state.user,plain(row.payload)):row.path==='/api/crew-work/roster'?service.roster(state.user):row.path==='/api/crew-work/evaluate'?service.evaluate(state.user,plain(row.payload)):(()=>{throw new Error('Unexpected endpoint '+row.path);})();row.resolve(data);}catch(error){row.reject(error);}await tick();}
  const seed=(user,profile)=>service.save(user,{...profile,expectedRevision:service.own(user).revision});
  async function open(profile=null,suggestion=null){if(profile)seed(state.user,profile);context.proposed=suggestion;const promise=run('openMarinProfile(proposed)');await respond(requests.length-1);await promise;}
  return{state,context,requests,notices,nodes,body,submit,store,service,seed,form,run,dispatch,click,respond,open,work:run('marinWork')};
}

test('self-reported suggestions remain unshared drafts until the user checks and submits the second step',async()=>{
  const f=fixture('viewer');await f.open(null,{preferredTasks:['design'],availableHours:10});assert.equal(f.requests.length,1);assert.equal(f.work.draft.participates,false);assert.equal(f.service.own(f.state.user).profile,null);assert.match(f.body.innerHTML,/아직 저장하지/);
  f.context.form=f.form({skills:['design','unknown'],preferredTasks:['design']});await f.run('saveMarinProfile(form)');assert.equal(f.requests.length,1);assert.equal(f.work.step,2);assert.match(f.body.innerHTML,/name="participates"\s*>/);assert.match(f.body.innerHTML,/name="confirmed" required/);
  f.context.form=f.form({communication:'async',workMode:'',availableHours:'0'});await f.run('saveMarinProfile(form)');assert.equal(f.requests.length,1);assert.match(f.nodes.get('marin-work-error').textContent,/확인/);
  f.context.form=f.form({communication:'async',workMode:'',availableHours:'0',confirmed:'on'});const saving=f.run('saveMarinProfile(form)');await f.run('saveMarinProfile(form)');assert.equal(f.requests.length,2);assert.equal(f.requests[1].path,'/api/crew-profile');
  const payload=plain(f.requests[1].payload);assert.deepEqual(payload.skills,['design']);assert.equal(payload.availableHours,0);assert.equal(payload.workMode,null);assert.equal(payload.participates,false);assert.equal(payload.confirmed,true);assert.equal(payload.userId,undefined);assert.equal(payload.rawChat,undefined);
  await f.respond(1);await saving;assert.equal(f.service.own(f.state.user).profile?.availableHours,0);assert.equal(f.service.own(f.state.user).profile?.participates,false);assert.equal(f.notices.length,1,'the client and real service accept the same payload');
});

test('withdrawing sharing preserves the own card, while deleting it requires an explicit second confirmation',async()=>{
  const f=fixture();await f.open(confirmedProfile);const before=f.service.own(f.state.user).profile;f.click('profile-withdraw');assert.equal(f.requests.length,2);assert.equal(f.requests[1].payload.participates,false);await f.respond(1);
  const withdrawn=f.service.own(f.state.user).profile;assert.deepEqual(withdrawn.skills,before.skills);assert.equal(withdrawn.participates,false);assert.equal(f.service.roster(f.state.user).members[0].profile,undefined);
  await f.open();const count=f.requests.length;f.click('profile-delete');assert.equal(f.requests.length,count);assert.match(f.body.innerHTML,/profile-delete-confirm/);assert.ok(f.service.own(f.state.user).profile);
  f.click('profile-delete-confirm');assert.equal(f.requests.at(-1).path,'/api/crew-profile/delete');await f.respond(f.requests.length-1);assert.equal(f.service.own(f.state.user).profile,null);
});

test('late profile loads and saves cannot replace another dialog, account, or the pending state of a newer save',async()=>{
  const f=fixture();const opening=f.run('openMarinProfile()');f.state.modalRequest++;f.body.innerHTML='새 모달';f.requests[0].resolve({profile:null,catalog});await opening;assert.equal(f.body.innerHTML,'새 모달');assert.equal(f.work.draft,null);
  await f.open();f.context.payload={...confirmedProfile};const old=f.run("mutateMarinProfile('/api/crew-profile',payload,'old')");const oldIndex=f.requests.length-1;
  await f.open();const newer=f.run("mutateMarinProfile('/api/crew-profile',payload,'new')");const newIndex=f.requests.length-1;assert.equal(f.work.pending,true);f.requests[oldIndex].resolve({});await old;assert.equal(f.work.pending,true,'a response from the closed dialog must not release a newer submit lock');assert.deepEqual(f.notices,[]);
  f.state.user={id:'crew-b',role:'admin'};f.run('resetMarinWork()');f.body.innerHTML='다른 계정';f.requests[newIndex].resolve({});await newer;assert.equal(f.body.innerHTML,'다른 계정');assert.equal(f.work.userId,null);assert.deepEqual(f.notices,[]);
});

test('the roster contains no automatic selection and incomplete shared cards remain selectable with unknown values visible',async()=>{
  const f=fixture('manager');f.store.put('users','crew-b',{id:'crew-b',name:'<다른 크루>',active:true,role:'member',teamId:'team-a'});f.seed(f.state.user,{...confirmedProfile,availableHours:null,communication:null});
  const loading=f.run('openMarinTeamBuilder()');await f.respond(0);await f.respond(1);await loading;
  assert.equal(f.work.selected.size,0);assert.equal(f.requests.length,2);assert.doesNotMatch(f.body.innerHTML,/data-work-member="crew-a"[^>]*checked/);assert.doesNotMatch(f.body.innerHTML,/data-work-member="crew-a"[^>]*disabled/);assert.match(f.body.innerHTML,/data-work-member="crew-b"[^>]*disabled/);assert.match(f.body.innerHTML,/시간 미확인/);assert.match(f.body.innerHTML,/확인 부족|미입력/);assert.match(f.body.innerHTML,/&lt;다른 크루&gt;/);assert.doesNotMatch(f.body.innerHTML,/<다른 크루>/);
  f.state.user.role='member';await f.run('openMarinTeamBuilder()');assert.equal(f.requests.length,2,'a member does not fetch the restricted team roster');
});

test('review submits only the hand-picked shared members and condition changes discard an older result',async()=>{
  const f=fixture();await f.open(confirmedProfile);f.store.put('users','crew-b',{id:'crew-b',name:'크루 나',active:true,role:'member',teamId:'team-a'});f.seed(f.store.get('users','crew-b'),{...confirmedProfile,skills:[],availableHours:null});
  const opening=f.run('openMarinTeamBuilder()');await f.respond(1);await f.respond(2);await opening;f.run("marinWork.selected.add('crew-b');marinWork.selected.add('crew-a')");f.context.form=f.form({projectName:'<가을 캠페인>',requiredSkills:['design','filming'],minAvailableHours:'12'});
  const review=f.run('evaluateMarinTeam(form)');const request=f.requests.at(-1);assert.equal(request.path,'/api/crew-work/evaluate');assert.deepEqual(plain(request.payload),{requiredSkills:['design','filming'],memberIds:['crew-b','crew-a'],minAvailableHours:12});assert.equal(f.requests.length,4);
  f.dispatch('change',{closest:selector=>selector==='#marin-team-form'?{}:null});request.resolve({selected:[],coverage:[],availability:[],warnings:['오래된 결과']});await review;assert.equal(f.work.result,null);assert.equal(f.nodes.get('crew-work-result').innerHTML,'');
  const current=f.run('evaluateMarinTeam(form)');await f.respond(4);await current;assert.deepEqual(plain(f.work.result.criteria.memberIds),['crew-b','crew-a']);assert.match(f.nodes.get('crew-work-result').innerHTML,/&lt;가을 캠페인&gt;/);assert.match(f.nodes.get('crew-work-result').innerHTML,/가능 시간 미확인/);assert.match(f.nodes.get('crew-work-result').innerHTML,/2시간 부족/);assert.equal(f.requests.every(row=>!row.path.startsWith('/messenger/')&&!row.path.includes('assignment')),true);
});

test('missing declared skills are described as unconfirmed information and zero hours are distinct from missing hours',()=>{
  const f=fixture();f.context.result={selected:[{id:'a',name:'<가>'},{id:'b',name:'나'}],coverage:[{skill:'filming',covered:false,memberIds:[]}],availability:[{userId:'a',availableHours:0,status:'zero',shortfall:4},{userId:'b',availableHours:null,status:'unknown',shortfall:null}],warnings:['<기재하지 않은 정보는 역량 부족을 뜻하지 않습니다.>']};f.work.catalog=catalog;
  const html=f.run('crewWorkResultHtml(result)');assert.match(html,/현재 가능 시간 0/);assert.match(html,/가능 시간 미확인/);assert.match(html,/&lt;가&gt;/);assert.match(html,/&lt;기재하지/);assert.doesNotMatch(html,/충족하는 역량 없음|역량 부족<|자동 배정 완료|점수|1위/);assert.match(html,/미확인|확인되지/);
});

test('a conflicting old profile form reloads current consent for confirmation instead of resaving withdrawn sharing',async()=>{
  const f=fixture();await f.open(confirmedProfile);const oldRevision=f.work.revision;f.seed(f.state.user,{...confirmedProfile,participates:false});
  f.context.payload=confirmedProfile;const saving=f.run("mutateMarinProfile('/api/crew-profile',payload,'saved')");assert.equal(f.requests[1].payload.expectedRevision,oldRevision);await f.respond(1);
  assert.equal(f.requests.length,3);assert.equal(f.requests[2].path,'/api/crew-profile');assert.equal(f.requests[2].payload,undefined);await f.respond(2);await saving;
  assert.equal(f.work.draft.participates,false);assert.equal(f.work.draft.confirmed,false);assert.equal(f.work.step,1);assert.notEqual(f.work.revision,oldRevision);assert.equal(f.service.own(f.state.user).profile.participates,false);assert.equal(f.requests.filter(row=>row.payload!==undefined).length,1);assert.deepEqual(f.notices,[]);assert.match(f.nodes.get('marin-work-error').textContent,/다시 확인/);
});

test('a typed profile action opens only the current crew confirmation form and strips actor, consent and inferred personal fields',async()=>{
  const f=fixture('viewer');f.run("ensureMarinSession();marinHome.entries=[{role:'assistant',text:'초안을 확인해 주세요',actions:[{type:'profile',label:'업무 카드',userId:'another',draft:{skills:['design','emotional'],preferredTasks:['planning'],availableHours:10,participates:true,confirmed:true,workMode:'solo',communication:'async',personality:'introvert',rawChat:'private'}}]}]");
  const opening=f.run('dispatchMarinAction(0,0)');assert.equal(f.requests.length,1);assert.equal(f.requests[0].path,'/api/crew-profile');assert.equal(f.requests[0].payload,undefined);await f.respond(0);assert.equal(await opening,true);
  assert.deepEqual(plain(f.work.draft.skills),['design']);assert.equal(f.work.draft.participates,false);assert.equal(f.work.draft.confirmed,false);assert.equal(f.work.draft.workMode,null);assert.equal(f.work.draft.communication,null);assert.equal(f.work.draft.rawChat,undefined);assert.equal(f.service.own(f.state.user).profile,null);
  f.run('resetMarinHome()');assert.equal(f.work.userId,null);assert.equal(f.work.draft,null);assert.equal(f.work.result,null);assert.equal(f.work.roster,null,'logout and user-session reset discard work-card data too');
});
