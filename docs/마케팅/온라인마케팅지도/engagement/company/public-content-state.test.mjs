import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const sources=['benchmark.js','content.js'].map(name=>({name,source:readFileSync(new URL(`./public/${name}`,import.meta.url),'utf8')}));
const plain=value=>JSON.parse(JSON.stringify(value));
const draft=(owner='A',extra={})=>({id:`draft-${owner}`,ownerId:owner,title:`${owner} private topic`,status:'draft',input:{seriesId:'synkbrief-use'},plan:{seriesId:'synkbrief-use',ideas:[{id:`idea-${owner}`}],secret:`${owner} private material`},...extra});
const workspace=owner=>({catalog:{series:[]},drafts:[{id:`draft-${owner}`,ownerId:owner,title:`${owner} private topic`}],references:[],benchmark:{current:null,history:[]}});

// Execute the actual browser files and their registered event handlers. The small DOM
// double models connected forms and selectors; API responses are resolved by each test.
function fixture(){
  const handlers=new Map(),requests=[],notifications=[],forms=[];
  const previewBox={innerHTML:'',scrolls:0,scrollIntoView(){this.scrolls++;}};
  let activeModal=null,modalSequence=0,closeCount=0,renders=0;
  const node=({selectors=[],closest=[],...props}={})=>({dataset:{},disabled:false,isConnected:true,value:'',textContent:'',innerHTML:'',setAttribute(){},removeAttribute(){},matches(selector){return selectors.includes(selector);},closest(selector){return closest.includes(selector)?this:null;},...props});
  const form=(kind,values={})=>{
    const submit=node(),error=node();
    const content=kind.startsWith('cp:');
    const element=node({dataset:content?{cpForm:kind.slice(3)}:{bmForm:kind},values,closest:[content?'form[data-cp-form]':'form[data-bm-form]'],querySelector(selector){return selector==='[type="submit"]'?submit:selector==='.form-error'?error:null;},submit,error});
    forms.push(element);return element;
  };
  const disconnectForms=()=>{for(const element of forms){element.isConnected=false;element.submit.isConnected=false;element.error.isConnected=false;}};
  const context=vm.createContext({
    console,structuredClone,Intl,Date,URL,Blob,setTimeout,clearTimeout,
    state:{user:{id:'A',role:'admin'},tab:'content',modalRequest:0,data:{channels:[],members:[]}},sw:{userId:'A',data:{examples:[]}},
    document:{addEventListener(type,listener){if(!handlers.has(type))handlers.set(type,[]);handlers.get(type).push(listener);},querySelector(selector){return selector==='#bm-preview'?previewBox:null;},querySelectorAll(){return[];}},
    window:{scrollTo(){}},
    FormData:class{constructor(element){this.values=element.values;}get(key){return this.values[key]??null;}*[Symbol.iterator](){yield*Object.entries(this.values);}},
    api(path,body){
      if(path==='/api/content-workspace')return Promise.resolve(workspace(context.state.user.id));
      let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});requests.push({path,body,resolve,reject});return promise;
    },
    render(){renders++;},notify(message){notifications.push(message);},
    modal(){disconnectForms();activeModal=++modalSequence;},
    closeModal(){closeCount++;disconnectForms();activeModal=null;},
    escape:value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'),
    icon:()=>'',button:(text)=>text,number:value=>String(value),safeUrl:value=>value,
    isViewer:()=>context.state.user?.role==='viewer',isAdmin:()=>context.state.user?.role==='admin'
  });
  for(const {name,source} of sources)vm.runInContext(source,context,{filename:name});
  const evaluate=source=>vm.runInContext(source,context);
  const cp=evaluate('cp'),bm=evaluate('bm');
  const establish=(owner='A')=>{
    context.state.user={id:owner,role:'admin'};cp.userId=owner;cp.data=workspace(owner);cp.draftId=`draft-${owner}`;cp.activeDraft=draft(owner);cp.view='plan';
  };
  const dispatch=(type,target)=>Promise.all((handlers.get(type)||[]).map(listener=>listener({target,preventDefault(){}})));
  const switchWorkspace=owner=>{context.state.user=null;evaluate('resetContentWorkspace()');establish(owner);};
  const importModal=()=>{evaluate('bmImportModal()');return activeModal;};
  establish();
  return{context,cp,bm,node,form,evaluate,dispatch,requests,notifications,previewBox,switchWorkspace,importModal,closeModal:context.closeModal,
    get activeModal(){return activeModal;},get closeCount(){return closeCount;},get renders(){return renders;}};
}

for(const action of ['status','select-idea']){
  for(const destination of ['B','A']){
    test(`${action} response cannot restore an old draft after logout and ${destination==='B'?'another user logs in':'the same user starts a new workspace'}`,async()=>{
      const f=fixture();
      const target=action==='status'?f.node({selectors:['[data-cp-status]'],value:'ready'}):f.node({closest:['[data-action^="cp-"]'],dataset:{action:'cp-select-idea',id:'idea-A'}});
      const pending=f.dispatch(action==='status'?'change':'click',target);
      assert.equal(f.requests.length,1);assert.equal(f.requests[0].path,'/api/content-drafts/draft-A');
      assert.deepEqual(plain(f.requests[0].body),action==='status'?{status:'ready'}:{selectedIdeaId:'idea-A'});
      f.switchWorkspace(destination);
      if(destination==='A'){f.cp.data.drafts=[];f.cp.activeDraft=null;f.cp.draftId='new-empty-draft';}
      const before=plain({data:f.cp.data,activeDraft:f.cp.activeDraft,draftId:f.cp.draftId,view:f.cp.view}),beforeRenders=f.renders;
      f.requests[0].resolve({draft:draft('A',{status:'ready',selectedIdeaId:'idea-A'})});await pending;
      assert.deepEqual(plain({data:f.cp.data,activeDraft:f.cp.activeDraft,draftId:f.cp.draftId,view:f.cp.view}),before);
      assert.equal(f.renders,beforeRenders);assert.equal(f.notifications.length,0);
    });
  }
}

test('current-user status and idea responses still update the active draft',async()=>{
  const f=fixture(),status=f.node({selectors:['[data-cp-status]'],value:'review'});
  const saved=f.dispatch('change',status);f.requests[0].resolve({draft:draft('A',{status:'review'})});await saved;
  assert.equal(f.cp.activeDraft.status,'review');assert.equal(f.cp.data.drafts[0].status,'review');
  assert.ok(!f.cp.data.drafts[0].plan,'the library remains a summary list');
  const selected=f.dispatch('click',f.node({closest:['[data-action^="cp-"]'],dataset:{action:'cp-select-idea',id:'idea-A'}}));
  f.requests[1].resolve({draft:draft('A',{status:'review',selectedIdeaId:'idea-A'})});await selected;
  assert.equal(f.cp.activeDraft.selectedIdeaId,'idea-A');assert.equal(f.notifications.length,2);
});

const planningAction=(f,action,extra={})=>f.dispatch('click',f.node({closest:['[data-action^="cp-"]'],dataset:{action:'cp-'+action,...extra}}));
const generationForm=(f,topic)=>{f.cp.input.topic=topic;return f.form('cp:generate',{seriesId:'synkbrief-use',topic});};

for(const response of ['success','failure']){
  test(`a late generation ${response} cannot replace a new plan or finish its newer request`,async()=>{
    const f=fixture();await planningAction(f,'new');
    const first=generationForm(f,'first topic'),oldPending=f.dispatch('submit',first);
    assert.equal(f.requests[0].path,'/api/content-generate');assert.equal(f.cp.busy,true);
    await planningAction(f,'view',{view:'library'});assert.equal(f.cp.busy,false,'navigation releases only the old generation');
    await planningAction(f,'new');
    const second=generationForm(f,'second topic'),newPending=f.dispatch('submit',second);
    assert.equal(f.requests.length,2,'a new plan can generate while the previous request is still in flight');
    const before=plain({input:f.cp.input,draftId:f.cp.draftId,view:f.cp.view,data:f.cp.data}),beforeRenders=f.renders;
    if(response==='success')f.requests[0].resolve({draft:draft('A',{id:'first-generated',title:'first topic'})});
    else f.requests[0].reject(Error('old generation failed'));
    await oldPending;
    assert.deepEqual(plain({input:f.cp.input,draftId:f.cp.draftId,view:f.cp.view,data:f.cp.data}),before);
    assert.equal(f.cp.busy,true);assert.equal(f.cp.generating,true);assert.equal(second.submit.disabled,true);
    assert.equal(first.error.textContent,'');assert.equal(second.error.textContent,'');assert.equal(f.notifications.length,0);assert.equal(f.renders,beforeRenders);
    f.requests[1].resolve({draft:draft('A',{id:'second-generated',title:'second topic'})});await newPending;
    assert.equal(f.cp.draftId,'second-generated');assert.equal(f.cp.activeDraft.title,'second topic');
    assert.equal(f.cp.busy,false);assert.equal(f.cp.generating,false);assert.equal(second.submit.disabled,false);assert.equal(f.notifications.length,1);
  });

  test(`a generation ${response} does not reopen planning or show errors after leaving the workspace`,async()=>{
    const f=fixture();await planningAction(f,'new');
    const form=generationForm(f,'topic'),pending=f.dispatch('submit',form);
    f.context.state.tab='home';const beforeRenders=f.renders;
    if(response==='success')f.requests[0].resolve({draft:draft('A',{id:'generated-after-leaving'})});
    else f.requests[0].reject(Error('generation failed after leaving'));
    await pending;
    assert.equal(f.context.state.tab,'home');assert.equal(f.cp.draftId,'');assert.equal(f.cp.activeDraft,null);
    assert.equal(form.error.textContent,'');assert.equal(f.notifications.length,0);assert.equal(f.renders,beforeRenders);
    assert.equal(f.cp.busy,false);assert.equal(f.cp.generating,false,'the completed current request still releases its own loading state');
  });
}

test('the current generation failure keeps the plan editable and allows a retry',async()=>{
  const f=fixture();await planningAction(f,'new');
  const form=generationForm(f,'keep this topic'),pending=f.dispatch('submit',form);
  f.requests[0].reject(Error('retry this generation'));await pending;
  assert.equal(form.error.textContent,'retry this generation');assert.equal(f.cp.input.topic,'keep this topic');
  assert.equal(f.cp.busy,false);assert.equal(f.cp.generating,false);assert.equal(form.submit.disabled,false);
  const retry=f.dispatch('submit',form);assert.equal(f.requests.length,2);
  f.requests[1].resolve({draft:draft('A',{id:'retried-generation'})});await retry;
  assert.equal(f.cp.draftId,'retried-generation');assert.equal(form.error.textContent,'');assert.equal(f.cp.busy,false);
});

test('a generation response cannot restore data after the same user starts a fresh workspace',async()=>{
  const f=fixture();await planningAction(f,'new');
  const oldPending=f.dispatch('submit',generationForm(f,'old session topic'));
  f.switchWorkspace('A');const before=plain({data:f.cp.data,activeDraft:f.cp.activeDraft,draftId:f.cp.draftId}),beforeRenders=f.renders;
  f.requests[0].resolve({draft:draft('A',{id:'old-session-generated'})});await oldPending;
  assert.deepEqual(plain({data:f.cp.data,activeDraft:f.cp.activeDraft,draftId:f.cp.draftId}),before);
  assert.equal(f.renders,beforeRenders);assert.equal(f.notifications.length,0);
});

test('a delayed benchmark preview cannot overwrite JSON edited while validation was pending',async()=>{
  const f=fixture();f.importModal();
  const form=f.form('preview',{report:'{"title":"A"}'}),pending=f.dispatch('submit',form);
  assert.equal(f.requests[0].path,'/api/content-benchmarks/preview');assert.equal(f.requests[0].body.report,'{"title":"A"}');
  await f.dispatch('input',f.node({selectors:['[data-bm-form="preview"] [name="report"]'],value:'{"title":"B"}'}));
  const responseA={report:{title:'A',items:[]},warnings:[]};f.requests[0].resolve(responseA);await pending;
  assert.equal(f.bm.raw,'{"title":"B"}');assert.equal(f.bm.preview,null);assert.equal(f.previewBox.innerHTML,'');assert.equal(f.previewBox.scrolls,0);
  assert.equal(form.submit.disabled,false,'the still-current form can validate the revised JSON');
});

test('a current benchmark preview is displayed when the JSON has not changed',async()=>{
  const f=fixture();f.importModal();
  const form=f.form('preview',{report:'{"title":"Current"}'}),pending=f.dispatch('submit',form);
  const report={title:'Current',items:[],candidateCount:0,scope:'test',periodStart:'2026-09-20',periodEnd:'2026-09-27',researchedAt:'2026-09-27T00:00:00Z'};
  f.requests[0].resolve({report,warnings:[]});await pending;
  assert.equal(f.bm.preview.report.title,'Current');assert.match(f.previewBox.innerHTML,/Current/);assert.equal(f.previewBox.scrolls,1);
});

test('publishing A cannot close a later B import modal or force its workspace view',async()=>{
  const f=fixture();f.importModal();f.cp.draftId='';f.cp.activeDraft=null;f.bm.preview={report:{title:'A',items:[]}};
  const oldForm=f.form('publish'),pending=f.dispatch('submit',oldForm);
  assert.equal(f.requests[0].path,'/api/content-benchmarks');assert.equal(f.requests[0].body.report.title,'A');
  f.closeModal();const secondModal=f.importModal(),newForm=f.form('preview',{report:'{"title":"B"}'});
  await f.dispatch('input',f.node({selectors:['[data-bm-form="preview"] [name="report"]'],value:newForm.values.report}));
  f.cp.view='plan';const closes=f.closeCount;
  f.requests[0].resolve({issue:{id:'A'}});await pending;
  assert.equal(f.activeModal,secondModal);assert.equal(f.closeCount,closes);assert.equal(newForm.isConnected,true);
  assert.equal(f.bm.raw,'{"title":"B"}');assert.equal(f.bm.preview,null);assert.equal(f.cp.view,'plan');
});

test('benchmark dates use KST for instants while preserving date-only calendar values',()=>{
  const f=fixture();
  const cases=[
    ['2026-09-27','2026.09.27'],['2024-02-29','2024.02.29'],
    ['2026-09-27T14:59:59Z','2026.09.27'],['2026-09-27T15:00:00Z','2026.09.28'],
    ['2026-12-31T15:00:00Z','2027.01.01'],['2026-09-27T00:00:00+14:00','2026.09.26'],
    [null,'미확인'],['','미확인']
  ];
  for(const [value,expected] of cases){f.context.dateUnderTest=value;assert.equal(f.evaluate('bmDate(dateUnderTest)'),expected,String(value));}
});

test('switching planning sections cancels a pending draft navigation',async()=>{
  const f=fixture(),pending=f.evaluate('cpOpenDraft("draft-late")');
  await f.evaluate('cpNavigate("library")');
  f.requests[0].resolve({draft:draft('A',{id:'draft-late'})});await pending;
  assert.equal(f.cp.view,'library');assert.notEqual(f.cp.draftId,'draft-late');
});

test('direct example saves update the current collection without closing a newer modal',async()=>{
  const f=fixture();f.cp.view='examples';
  const values={title:'예시 제목',kind:'link',url:'https://example.test/video',whyGood:'이유',lesson:'다음 기획',axis:'fun',shareConfirmed:'on'};
  const form=f.form('cp:example',values),pending=f.dispatch('submit',form);
  assert.equal(f.requests[0].path,'/api/studio-examples/direct');assert.equal(f.requests[0].body.shareConfirmed,true);
  f.importModal();const current=f.activeModal,closes=f.closeCount;
  f.requests[0].resolve({example:{id:'example-1',title:values.title}});await pending;
  assert.equal(f.context.sw.data.examples[0].id,'example-1');assert.equal(f.activeModal,current);assert.equal(f.closeCount,closes);assert.equal(f.notifications.length,1);
});

test('a direct example response cannot restore data after a fresh login',async()=>{
  for(const user of ['A','B']){
    const f=fixture(),pending=f.dispatch('submit',f.form('cp:example',{title:'A 예시',kind:'text',text:'원문',whyGood:'이유',lesson:'배울 점',shareConfirmed:'on'}));
    f.switchWorkspace(user);f.context.sw={userId:user,data:{examples:[{id:'fresh-example'}]}};
    f.requests[0].resolve({example:{id:'stale-example',title:'이전 로그인 응답'}});await pending;
    assert.deepEqual(plain(f.context.sw.data.examples),[{id:'fresh-example'}]);assert.equal(f.notifications.length,0);
  }
});
