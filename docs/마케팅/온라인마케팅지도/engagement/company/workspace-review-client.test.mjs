import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const workspaceSource=readFileSync(new URL('./public/workspace.js',import.meta.url),'utf8');
const contentSource=readFileSync(new URL('./public/content.js',import.meta.url),'utf8');
const appSource=readFileSync(new URL('./public/app.js',import.meta.url),'utf8');
const draftId='11111111-1111-4111-8111-111111111111';
const draft={id:draftId,title:'회의록 검토 순서',ownerId:'author',status:'draft',input:{proof:'SHOULD NOT BE SHARED'},plan:{secret:'PRIVATE FULL PLAN',ideas:[]}};
const link={title:draft.title,url:`/#view=content&section=plan&draftId=${draftId}`,kind:'content-review'};
function fixture(){
  const windowHandlers=new Map(),documentHandlers=new Map(),requests=[],sent=[],notifications=[],renders=[],modals=[];let currentForm=null;
  const state={user:{id:'author',role:'member'},tab:'content',scope:'mine',marketingView:'summary',data:{channels:[]},modalRequest:0,reportRequest:0};
  const location=new URL('http://localhost:4191/');
  const form=()=>({isConnected:true,values:{target:''},error:{textContent:''},submit:{disabled:false},querySelector(selector){return selector==='[type="submit"]'?this.submit:selector==='.form-error'?this.error:null;}});
  const context=vm.createContext({state,location,URL,URLSearchParams,Intl,structuredClone,
    document:{addEventListener(type,fn){documentHandlers.set(type,[...(documentHandlers.get(type)||[]),fn]);},getElementById:()=>null,querySelector:selector=>selector==='[data-cp-review-share]'?currentForm:null},
    window:{addEventListener(type,fn){windowHandlers.set(type,[...(windowHandlers.get(type)||[]),fn]);},scrollTo(){},matchMedia:()=>({matches:false})},MutationObserver:class{observe(){}},
    history:{replaceState(_a,_b,url){location.href=new URL(url,location).href;}},crypto:{randomUUID:()=> 'share-request'},
    canManageTeam:()=>false,isAdmin:()=>state.user?.role==='admin',isViewer:()=>state.user?.role==='viewer',bmReset(){},
    icon:()=>'',button:(title,action)=>`<button data-action="${action}">${title}</button>`,escape:value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
    render:()=>renders.push(state.tab),notify:message=>notifications.push(message),
    modal(title,subtitle,html){state.modalRequest++;if(currentForm)currentForm.isConnected=false;currentForm=html.includes('data-cp-review-share')?form():null;modals.push({title,subtitle,html});},
    closeModal(){state.modalRequest++;if(currentForm)currentForm.isConnected=false;currentForm=null;},
    FormData:class{constructor(form){this.values=form.values;}get(key){return this.values[key];}},
    api(path,body){return new Promise((resolve,reject)=>requests.push({path,body,resolve,reject}));},
  });
  const run=code=>vm.runInContext(code,context);run(workspaceSource+'\n'+contentSource);context.fixtureDraft=structuredClone(draft);
  run("cp.userId=state.user.id;cp.data={drafts:[],catalog:{series:[]},references:[]};cp.draftId=fixtureDraft.id;cp.activeDraft=fixtureDraft;cp.view='plan';");
  const frame={contentWindow:{postMessage:(value,origin)=>sent.push({value,origin})}};context.savedFrame=frame;run('workspaceModule.frame=savedFrame;workspaceModule.ready=true;');
  return{state,context,location,requests,sent,notifications,renders,modals,run,cp:run('cp'),frame,get form(){return currentForm;},emitMessage(event){for(const handler of windowHandlers.get('message')||[])handler(event);}};
}
const targets={workspaceLink:link,channels:[{id:'team',name:'마케팅팀',scope:'team',allowed:false,reason:'기획을 볼 수 없는 참여자가 있어요'}],people:[{id:'admin-messenger-id',name:'관리자',allowed:true}]};

test('workspace cards accept only safe local destinations and identify a specific saved plan',()=>{
  const f=fixture();f.context.cardUrl=link.url;assert.equal(f.run('workspaceLinkDestination(cardUrl).draftId'),draftId);
  for(const url of ['https://evil.test/'+link.url,'//evil.test/#view=content','javascript:alert(1)','/#view=content&section=plan&draftId=x&token=secret','/?tab=content#view=content','/#view=content&section=library&draftId=x','/#view=analysis&draftId=x','/#view=content&view=analysis','/#view=content&section=plan&draftId=../../data']){f.context.cardUrl=url;assert.equal(f.run('workspaceLinkDestination(cardUrl)'),null,url);}
  assert.ok(f.run("workspaceLinkDestination('/?tab=history&section=team&teamId=team-a')"));
});

test('a plan card opens the exact plan on a fresh content workspace and preserves its URL for reload',async()=>{
  const f=fixture();f.cp.userId='';f.cp.draftId='';f.cp.activeDraft=null;f.state.tab='messenger';f.context.cardUrl=link.url;
  const opening=f.run('navigateWorkspaceLink(cardUrl)');assert.equal(f.state.tab,'content');assert.equal(f.state.workspaceSidebarOpen,false);assert.equal(f.requests[0].path,'/api/content-workspace');
  f.requests[0].resolve({drafts:[{id:draftId,title:draft.title}],references:[],catalog:{series:[]}});await new Promise(setImmediate);
  assert.equal(f.cp.error,'');assert.equal(f.cp.draftId,draftId);
  assert.equal(f.requests[1].path,'/api/content-drafts/'+draftId);f.requests[1].resolve({draft:structuredClone(draft)});assert.equal(await opening,true);
  assert.equal(f.cp.draftId,draftId);assert.equal(f.cp.activeDraft.title,draft.title);assert.equal(f.cp.view,'plan');
  f.run('syncWorkspaceLocation()');assert.equal(f.location.searchParams.get('draftId'),draftId);assert.equal(f.location.searchParams.get('section'),'plan');
  f.run("selectWorkspaceView('analysis');syncWorkspaceLocation()");assert.equal(f.location.searchParams.has('draftId'),false);
});

test('review selection prepares only a title/link card for the chosen reviewer and never posts a message',async()=>{
  const f=fixture(),opening=f.run('cpReviewRequest()');assert.equal(f.requests[0].path,`/api/content-drafts/${draftId}/share-targets`);f.requests[0].resolve(targets);await opening;
  const html=f.modals.at(-1).html;assert.match(html,/disabled>마케팅팀/);assert.match(html,/관리자 · 개인 대화/);assert.ok(!html.includes('SHOULD NOT BE SHARED'));assert.ok(!html.includes('PRIVATE FULL PLAN'));
  const form=f.form;form.values.target='person:admin-messenger-id';const choosing=form.onsubmit({preventDefault(){}});assert.equal(f.requests.length,2,'permissions are checked again immediately before preparing the draft');
  f.requests[1].resolve(targets);await choosing;
  assert.equal(f.state.tab,'messenger');assert.equal(f.sent.length,1);assert.equal(f.sent[0].value.type,'workspace:share');assert.equal(f.sent[0].value.userId,'admin-messenger-id');assert.deepEqual(JSON.parse(JSON.stringify(f.sent[0].value.workspaceLink)),link);
  assert.ok(f.requests.every(row=>row.body===undefined));assert.ok(f.requests.every(row=>!row.path.includes('/messages')));assert.ok(!JSON.stringify(f.sent).includes('PRIVATE FULL PLAN'));assert.equal(f.run('workspaceModule.frame'),f.frame);
});

test('a stale review modal cannot switch users or bypass changed recipient permissions',async()=>{
  const f=fixture(),opening=f.run('cpReviewRequest()');f.requests[0].resolve(targets);await opening;
  const form=f.form;form.values.target='person:admin-messenger-id';const choosing=form.onsubmit({preventDefault(){}});f.requests[1].resolve({...targets,people:[]});await choosing;
  assert.equal(f.sent.length,0);assert.equal(f.state.tab,'content');assert.match(form.error.textContent,/권한이 바뀌었어요/);assert.equal(form.submit.disabled,false);
  const again=f.run('cpReviewRequest()');f.state.user={id:'different-user',role:'member'};f.run('resetContentWorkspace()');f.requests[2].resolve(targets);await again;assert.equal(f.sent.length,0);assert.equal(f.cp.activeDraft,null);
});

test('only the current messenger frame can request local navigation',async()=>{
  const f=fixture();f.state.tab='messenger';f.emitMessage({origin:'https://evil.test',source:f.frame.contentWindow,data:{type:'messenger:navigate',url:link.url}});f.emitMessage({origin:f.location.origin,source:{},data:{type:'messenger:navigate',url:link.url}});
  assert.equal(f.requests.length,0);assert.equal(f.state.tab,'messenger');
  f.emitMessage({origin:f.location.origin,source:f.frame.contentWindow,data:{type:'messenger:navigate',url:'https://evil.test/#view=content'}});assert.equal(f.requests.length,0);
  f.context.loadContentWorkspace=async()=>{};f.emitMessage({origin:f.location.origin,source:f.frame.contentWindow,data:{type:'messenger:navigate',url:link.url}});await Promise.resolve();assert.equal(f.state.tab,'content');assert.equal(f.cp.draftId,draftId);
});

test('query and shared hash deep links restore the saved plan after authenticating a fresh page',async()=>{
  for(const suffix of [`?tab=content&section=plan&draftId=${draftId}`,`#view=content&section=plan&draftId=${draftId}`]){
    const f=fixture();f.location.href=f.location.origin+'/'+suffix;f.state.user=null;f.cp.userId='';f.cp.draftId='';f.cp.activeDraft=null;
    Object.assign(f.context,{isDemoMode:()=>false,loadState:async()=>{},reportTabs:()=>false,startPolling(){},renderAuth(){throw Error('Unexpected unauthenticated view');},app:{innerHTML:''}});
    f.run(appSource.slice(appSource.indexOf('async function initialize()'),appSource.indexOf('async function loadState()')));
    const initializing=f.run('initialize()');assert.equal(f.requests[0].path,'/api/me');f.requests[0].resolve({user:{id:'author',role:'member'},csrfToken:'csrf'});await new Promise(setImmediate);
    assert.equal(f.requests[1].path,'/api/content-workspace');f.requests[1].resolve({drafts:[],references:[],catalog:{series:[]}});await new Promise(setImmediate);
    assert.equal(f.requests[2].path,'/api/content-drafts/'+draftId);f.requests[2].resolve({draft:structuredClone(draft)});await initializing;
    assert.equal(f.state.initialized,true);assert.equal(f.cp.activeDraft.id,draftId);assert.equal(f.cp.view,'plan');assert.equal(f.context.app.innerHTML,'');
  }
});

test('an inaccessible linked plan shows the server error without retaining a previously opened plan',async()=>{
  const f=fixture();f.context.cardUrl='/#view=content&section=plan&draftId=unreadable-plan';
  const opening=f.run('navigateWorkspaceLink(cardUrl)');assert.equal(f.cp.activeDraft,null);
  f.requests[0].resolve({drafts:[{id:draftId,title:draft.title}],references:[],catalog:{series:[]}});await new Promise(setImmediate);
  f.requests[1].reject(Error('기획을 찾을 수 없어요.'));await opening;
  assert.equal(f.run('cpDraft()'),undefined);assert.equal(f.cp.activeDraft,null);assert.equal(f.cp.error,'기획을 찾을 수 없어요.');
});
