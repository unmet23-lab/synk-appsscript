import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('./public/studio.js',import.meta.url),'utf8');
const reviewSource=readFileSync(new URL('./public/studio-review.js',import.meta.url),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
const production=(id='pA')=>({id,title:'작업 '+id,ownerId:'A',assigneeId:'A',reviewerId:null,teamId:null,draftId:null,canEdit:true,canComment:true,stage:'making',versions:[],notes:[]});
const workspace=()=>({productions:[production('pA'),production('pB')],materials:[],examples:[],assignableMembers:[{id:'A',name:'A'}],assignableTeams:[]});
function fixture(){
  const listeners=new Map(),requests=[],forms=[],notices=[];let html='',renders=0;
  const context=vm.createContext({
    state:{user:{id:'A',name:'A'},tab:'studio',modalRequest:0},structuredClone,console,overlay:{children:[]},
    document:{addEventListener(type,listener){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(listener);},querySelectorAll(){return[];},querySelector(){return null;}},window:{scrollTo(){}},
    api:(path,body)=>new Promise((resolve,reject)=>requests.push({path,body,resolve,reject})),
    render(){renders++;},notify:value=>notices.push(value),isViewer:()=>false,
    escape:value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),
    button:()=>'',icon:()=>'',cpOption:(id,label,selected)=>`<option value="${id}" ${id===selected?'selected':''}>${label}</option>`,
    modal(title,subtitle,body){html=body;context.state.modalRequest++;context.overlay.children=[{}];for(const form of forms)form.isConnected=false;},
    closeModal(){context.state.modalRequest++;context.overlay.children=[];for(const form of forms)form.isConnected=false;},
    FormData:class{constructor(form){this.values=form.values;}get(key){return this.values[key]??null;}*[Symbol.iterator](){yield*Object.entries(this.values);}}
  });
  vm.runInContext(source,context,{filename:'studio.js'});
  vm.runInContext(reviewSource,context,{filename:'studio-review.js'});
  const evaluate=value=>vm.runInContext(value,context),sw=evaluate('sw');
  const establish=id=>{context.state.user={id,name:id};sw.userId=id;sw.data=workspace();sw.productionId='pA';sw.detail=production();sw.view='review';};
  establish('A');
  const form=(values={},id='pA',kind='production')=>{const submit={disabled:false,isConnected:true,setAttribute(){},removeAttribute(){}},error={textContent:'',isConnected:true},element={values,dataset:kind==='production'?{id}:{production:id,swrForm:kind,version:'vA'},isConnected:true,reset(){this.values={};},querySelector:selector=>selector==='[type="submit"]'?submit:selector==='.form-error'?error:null,closest:selector=>(selector==='[data-sw-form="production"]'&&kind==='production'||selector==='form[data-swr-form]'&&kind!=='production')?element:null};forms.push(element);return element;};
  const dispatch=(type,target)=>Promise.all((listeners.get(type)||[]).map(listener=>listener({target,preventDefault(){}})));
  const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
  const switchUser=id=>{context.state.user=null;evaluate('resetStudioWorkspace()');establish(id);};
  return{context,sw,requests,notices,form,dispatch,evaluate,settle,switchUser,get html(){return html;},get renders(){return renders;}};
}

test('studio workspace and detail responses cannot cross a logout/login boundary',async()=>{
  for(const method of ['swReload()','swOpenProduction("pA")']){
    const f=fixture(),pending=f.evaluate(method);assert.equal(f.requests.length,1);
    f.switchUser('B');f.sw.data={...workspace(),productions:[{id:'only-B'}]};f.sw.productionId='pB';f.sw.detail={id:'pB',title:'B only'};
    const before=plain({data:f.sw.data,detail:f.sw.detail,productionId:f.sw.productionId,view:f.sw.view});
    f.requests[0].resolve(method.startsWith('swReload')?workspace():{production:production('pA')});await pending;
    assert.deepEqual(plain({data:f.sw.data,detail:f.sw.detail,productionId:f.sw.productionId,view:f.sw.view}),before);
  }
});

test('changing the studio subview cancels a pending production navigation',async()=>{
  const f=fixture(),pending=f.evaluate('swOpenProduction("pB")');
  await f.dispatch('click',{disabled:false,isConnected:true,dataset:{action:'sw-view',view:'materials'},closest(){return this;}});
  f.requests[0].resolve({production:production('pB')});await pending;
  assert.equal(f.sw.view,'materials');assert.equal(f.sw.productionId,'pA');
});

test('content examples load without old production data and cannot cross an account boundary',async()=>{
  const f=fixture();f.context.state.tab='content';f.context.cp={view:'examples'};
  const first=f.evaluate('swLoadExamples()');assert.equal(f.requests[0].path,'/api/studio-examples');
  f.requests[0].resolve({examples:[{id:'shared-example',title:'팀 예시'}],canCreate:true});await first;
  assert.equal(f.sw.data.examples[0].id,'shared-example');assert.equal(f.sw.data.productions.length,2,'pre-existing studio data is preserved in memory');assert.equal(f.renders,1);
  const pending=f.evaluate('swLoadExamples()');f.switchUser('B');f.sw.data.examples=[{id:'B-example'}];
  f.requests[1].resolve({examples:[{id:'A-stale-example'}],canCreate:true});await pending;
  assert.deepEqual(plain(f.sw.data.examples),[{id:'B-example'}]);
});

test('editing without access to the original assignment or draft preserves omitted fields',async()=>{
  const f=fixture();f.sw.detail={...production(),assigneeId:'former-assignee',assigneeName:'이전 담당자',reviewerId:'former-reviewer',reviewerName:'이전 검토자',teamId:'former-team',draftId:null};
  f.evaluate('swProductionModal("pA")');
  for(const id of ['former-assignee','former-reviewer','former-team'])assert.match(f.html,new RegExp(`value="${id}" selected disabled`));
  // Native FormData omits a selected disabled option. An unreadable draft is blank
  // in the response; neither condition should erase the existing server value.
  const pending=f.dispatch('submit',f.form({title:'제목만 수정',stage:'making',dueDate:'',draftId:''}));
  const body=plain(f.requests[0].body);
  for(const key of ['assigneeId','reviewerId','teamId','draftId'])assert.ok(!Object.hasOwn(body,key),key);
  f.requests[0].resolve({production:production()});await f.settle();f.requests[1].resolve(workspace());await pending;
});

test('a production save response cannot inject A data after B logs in',async()=>{
  const f=fixture(),pending=f.dispatch('submit',f.form({title:'A save'}));
  f.switchUser('B');f.sw.data={...workspace(),productions:[{id:'B-private'}]};const before=plain(f.sw.data),renders=f.renders;
  f.requests[0].resolve({production:{...production(),title:'A private response'}});await pending;
  assert.deepEqual(plain(f.sw.data),before);assert.equal(f.requests.length,1);assert.equal(f.renders,renders);assert.equal(f.notices.length,0);
});

test('saving A then opening B during refresh preserves the new modal and destination',async()=>{
  const f=fixture(),pending=f.dispatch('submit',f.form({title:'saved A'}));
  f.requests[0].resolve({production:{...production(),title:'saved A'}});await f.settle();
  assert.equal(f.requests[1].path,'/api/studio-workspace');
  f.sw.productionId='pB';f.sw.detail=production('pB');f.sw.view='materials';f.evaluate('swProductionModal("pB")');const modal=f.context.state.modalRequest;
  f.requests[1].resolve(workspace());await pending;
  assert.equal(f.context.state.modalRequest,modal);assert.equal(f.sw.view,'materials');assert.equal(f.sw.productionId,'pB');assert.equal(f.sw.detail.id,'pB');
});

test('an uninterrupted production save returns to the board with the saved detail',async()=>{
  const f=fixture(),pending=f.dispatch('submit',f.form({title:'updated title'}));
  f.requests[0].resolve({production:{...production(),title:'updated title'}});await f.settle();f.requests[1].resolve(workspace());await pending;
  assert.equal(f.sw.view,'board');assert.equal(f.sw.detail.title,'updated title');assert.equal(f.notices.length,1);
});

for(const kind of ['note','version'])test(`a delayed ${kind} response leaves the newly opened production and its unfinished note intact`,async()=>{
  const f=fixture(),values=kind==='note'?{text:'A 의견',axis:'general',atSeconds:''}:{label:'A 새 버전',kind:'text',text:'A 원고'};
  const original=f.form(values,'pA',kind),pending=f.dispatch('submit',original);
  assert.equal(f.requests.length,1);assert.match(f.requests[0].path,kind==='note'?/\/pA\/notes$/:/\/pA\/versions$/);
  original.isConnected=false;f.evaluate('swResetReview()');f.sw.productionId='pB';f.sw.detail=production('pB');f.sw.view='review';
  const current=f.form({text:'B에서 아직 작성 중인 중요한 의견'},'pB','note'),before=plain(f.sw.detail),renders=f.renders;
  f.requests[0].resolve({production:{...production('pA'),versions:[{id:'vA',label:'A 새 버전',kind:'text',text:'A 원고'}],notes:[{id:'noteA',text:'A 의견'}]}});await pending;
  assert.deepEqual(plain(f.sw.detail),before);assert.equal(f.sw.productionId,'pB');assert.equal(f.renders,renders);
  assert.equal(current.values.text,'B에서 아직 작성 중인 중요한 의견');assert.equal(current.isConnected,true);
});

test('a note response for a detached same-production form cannot erase a newer version comment',async()=>{
  const f=fixture(),original=f.form({text:'이전 버전 의견',axis:'fun'},'pA','note'),pending=f.dispatch('submit',original);
  original.isConnected=false;f.evaluate('swr.versionId="vB"');const current=f.form({text:'새 버전에 작성 중'},'pA','note'),renders=f.renders;
  f.requests[0].resolve({production:{...production(),notes:[{id:'noteA',text:'이전 버전 의견'}]}});await pending;
  assert.equal(f.renders,renders);assert.equal(current.values.text,'새 버전에 작성 중');assert.equal(f.evaluate('swr.versionId'),'vB');
});

test('a current review note response still updates the production and clears its submitted form',async()=>{
  const f=fixture(),form=f.form({text:'현재 의견',axis:'usefulness'},'pA','note'),pending=f.dispatch('submit',form);
  f.requests[0].resolve({production:{...production(),notes:[{id:'noteA',text:'현재 의견'}]}});await pending;
  assert.equal(f.sw.detail.notes[0].text,'현재 의견');assert.deepEqual(form.values,{});assert.equal(f.renders,1);assert.equal(f.evaluate('swr.busy'),false);
});

test('the production tool opens review in workroom and accepts its review notes',async()=>{
  const f=fixture();
  f.context.wr={view:'tools'};f.context.makerTools={view:'productions'};
  f.context.selectWorkspaceView=(tab,view)=>{f.context.state.tab=tab;f.context.wr.view=view;};
  f.context.state.tab='workroom';
  const pending=f.evaluate('swOpenProduction("pA")');
  f.requests[0].resolve({production:production()});await pending;
  assert.equal(f.context.state.tab,'workroom');assert.equal(f.context.makerTools.view,'productions');assert.equal(f.sw.view,'review');
  const form=f.form({text:'제작 도구 검토 의견',axis:'usefulness'},'pA','note'),save=f.dispatch('submit',form);
  f.requests[1].resolve({production:{...production(),notes:[{id:'n1',text:'제작 도구 검토 의견'}]}});await save;
  assert.equal(f.sw.detail.notes[0].text,'제작 도구 검토 의견');assert.deepEqual(form.values,{});
});

test('changing the workroom tool cancels delayed production navigation',async()=>{
  const f=fixture();f.context.wr={view:'tools'};f.context.makerTools={view:'productions'};f.context.state.tab='workroom';
  const pending=f.evaluate('swOpenProduction("pB")');f.context.makerTools.view='inquiries';
  f.requests[0].resolve({production:production('pB')});await pending;
  assert.equal(f.context.makerTools.view,'inquiries');assert.equal(f.sw.productionId,'pA');
});

test('same-user role changes reject cached workspace and in-flight detail data',async()=>{
  const f=fixture();f.context.state.user.role='admin';f.evaluate('swSyncIdentity()');
  const pending=f.evaluate('swOpenProduction("pB")');f.context.state.user.role='viewer';
  f.requests[0].resolve({production:production('pB')});await pending;
  assert.equal(f.sw.productionId,'pA');f.evaluate('swSyncIdentity()');
  assert.equal(f.sw.data,null);assert.equal(f.sw.detail,null);
});

test('an opened production keeps its place in the list and only a new one goes first',()=>{
  const f=fixture();
  f.evaluate(`swAcceptProduction(${JSON.stringify({...production('pB'),title:'바뀐 제목'})})`);
  assert.deepEqual(plain(f.sw.data.productions.map(row=>[row.id,row.title])),[['pA','작업 pA'],['pB','바뀐 제목']]);
  f.evaluate(`swAcceptProduction(${JSON.stringify(production('pC'))})`);
  assert.deepEqual(plain(f.sw.data.productions.map(row=>row.id)),['pC','pA','pB']);
  assert.equal(f.sw.data.productions.filter(row=>row.id!=='pA').some(row=>'versions' in row||'notes' in row),false,'accepted rows are stored as summaries');
});

test('opening production tools after loading examples fetches the full workspace once',async()=>{
  const f=fixture();f.context.wr={view:'tools'};f.context.makerTools={view:'productions'};f.context.state.tab='workroom';
  f.evaluate('ensureStudioWorkspace();ensureStudioWorkspace()');assert.equal(f.requests.length,1);
  f.requests[0].resolve(workspace());await f.settle();
  f.evaluate('ensureStudioWorkspace()');assert.equal(f.requests.filter(row=>row.path==='/api/studio-workspace').length,1);assert.equal(f.sw.workspaceLoaded,true);
  // 열려 있던 작업 상세는 새 목록과 어긋나지 않게 뒤에서 한 번 새로 받는다.
  assert.deepEqual(f.requests.slice(1).map(row=>row.path),['/api/studio-productions/pA']);
});
