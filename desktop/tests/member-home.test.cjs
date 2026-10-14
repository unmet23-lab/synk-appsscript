'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const loaded=import('../renderer/member-home.mjs');
const member=(owner='member-a',appIds=['world','messenger'])=>({owner,status:'ready',appIds});
const memory=()=>{const values=new Map();return {values,getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};};
const input={kind:'task',appId:'world',title:'다음 연습',body:'한 번 더 읽기',consent:true};

test('home folds Messenger teaching favorites and recents while keeping the latest teaching launch target',async()=>{
  const {buildHomeModel}=await loaded,library=member('a',['messenger','teacher']);
  const model=buildHomeModel({library,personal:{order:['teacher','messenger']},prefs:{favorites:['teacher','messenger'],lastLaunch:{teacher:200,messenger:100}},actions:{teacher:{action:'teacher-preview',disabled:false},messenger:{action:'launch',disabled:false}}});
  assert.deepEqual(model.order,['messenger']);assert.deepEqual(model.favorites,['messenger']);assert.deepEqual(model.recent,[{id:'messenger',at:200,entryId:'teacher'}]);assert.equal(model.firstEntry,'teacher');assert.deepEqual(library.appIds,['messenger','teacher']);
  const teacher=buildHomeModel({library:member('a',['teacher']),prefs:{favorites:['teacher'],lastLaunch:{teacher:200}}});assert.deepEqual(teacher.order,['teacher']);assert.deepEqual(teacher.favorites,['teacher']);
});
test('grouped teacher notes preserve their original key and disappear when the teacher permission is revoked',async()=>{
  const {createHomeStore,HOME_KEY}=await loaded,storage=memory(),store=createHomeStore(storage,{clock:()=>100}),library=member('a',['messenger','teacher']);
  const row=store.add(library,{...input,appId:'teacher'});assert.deepEqual(store.list(library),[{...row,appId:'messenger',entryId:'teacher'}]);
  assert.equal(JSON.parse(storage.getItem(HOME_KEY+':account:a')).records[0].appId,'teacher');assert.deepEqual(store.list(member('a',['messenger'])),[]);assert.throws(()=>store.change(member('a',['messenger']),row.id,'toggle'),/권한/);
});

test('Partners notes remain intact through PULSE display and unrelated writes, with explicit PULSE access',async()=>{
  const {createHomeStore,HOME_KEY}=await loaded,storage=memory();
  const original={id:'legacy-partner',kind:'task',appId:'partners',title:'작품 검토',body:'창작자와 확인',done:false,createdAt:100};
  const key=HOME_KEY+':account:member-a';storage.setItem(key,JSON.stringify({version:1,owner:'member-a',records:[original]}));
  const store=createHomeStore(storage,{clock:()=>200}),withPulse=member('member-a',['pulse','world']);
  assert.deepEqual(store.list(member('member-a',['partners'])),[]);
  assert.throws(()=>store.change(member('member-a',['partners']),original.id,'toggle'),/권한/);
  assert.deepEqual(store.list(withPulse),[{...original,appId:'pulse'}]);
  assert.deepEqual(JSON.parse(storage.getItem(key)).records,[original]);
  store.add(withPulse,input);assert.deepEqual(JSON.parse(storage.getItem(key)).records[1],original);
  store.change(withPulse,original.id,'toggle');assert.deepEqual(JSON.parse(storage.getItem(key)).records[1],{...original,done:true});
  assert.deepEqual(store.list(member('member-b',['pulse'])),[]);
});

test('home records require a confirmed member, an allowed app and explicit storage consent',async()=>{
  const {createHomeStore}=await loaded,storage=memory(),store=createHomeStore(storage,{clock:()=>100});
  for(const library of [{owner:'anonymous-local',status:'guest',appIds:['world']},{owner:null,status:'loading',appIds:[]},{...member(),status:'unavailable'}])assert.throws(()=>store.add(library,input),/로그인/);
  assert.throws(()=>store.add(member(),{...input,consent:false}),/동의/);
  assert.throws(()=>store.add(member(),{...input,appId:'pulse'}),/이용 가능한 앱/);
  assert.equal(storage.values.size,0);
});
test('saved records restore only to their owner and hide immediately when entitlement is revoked',async()=>{
  const {createHomeStore}=await loaded,storage=memory(),store=createHomeStore(storage,{clock:()=>100});
  const row=store.add(member(),input);assert.equal(createHomeStore(storage).list(member())[0].title,'다음 연습');
  assert.deepEqual(store.list(member('member-b')),[]);assert.deepEqual(store.list(member('member-a',['messenger'])),[]);
  assert.throws(()=>store.change(member('member-a',['messenger']),row.id,'remove'),/권한/);
  assert.equal(store.list(member()).length,1);
});
test('task completion, reopen and deletion persist without changing other records',async()=>{
  const {createHomeStore}=await loaded,store=createHomeStore(memory(),{clock:()=>100});
  const task=store.add(member(),input),note=store.add(member(),{...input,kind:'note',title:'내 결과'});
  store.change(member(),task.id,'toggle');assert.equal(store.list(member()).find(row=>row.id===task.id).done,true);
  store.change(member(),task.id,'toggle');assert.equal(store.list(member()).find(row=>row.id===task.id).done,false);
  assert.throws(()=>store.change(member(),note.id,'toggle'),/할 일만/);
  store.change(member(),task.id,'remove');assert.deepEqual(store.list(member()).map(row=>row.id),[note.id]);
});
test('corrupt and foreign records are rejected and arbitrary URLs or account fields are not retained',async()=>{
  const {parseHomeRecords}=await loaded,row={id:'one',kind:'note',appId:'world',title:'valid',body:'memo',createdAt:100,url:'javascript:bad()',owner:'other'};
  assert.deepEqual(parseHomeRecords('{','a'),[]);assert.deepEqual(parseHomeRecords(JSON.stringify({version:1,owner:'b',records:[row]}),'a'),[]);
  const result=parseHomeRecords(JSON.stringify({version:1,owner:'a',records:[row,row,{...row,id:'bad',appId:'retired'},{...row,id:'clock',createdAt:Infinity}]}),'a');
  assert.equal(result.length,1);assert.equal(result[0].url,undefined);assert.equal(result[0].owner,undefined);
});
test('invalid home documents keep their exact original bytes through add, toggle and remove',async t=>{
  const {createHomeStore,HOME_KEY}=await loaded,owner='member-a',key=HOME_KEY+':account:'+owner;
  const original={id:'original',kind:'task',appId:'world',title:'보존할 합성 기록',body:'원문 그대로',done:false,createdAt:100};
  const document=records=>({version:1,owner,records}),raw=value=>JSON.stringify(value,null,2)+'\n';
  const cases=[
    ['malformed JSON',raw(document([original])).slice(0,-3)],
    ['empty string',''],['JSON null','null'],['array root','[]'],['primitive root','true'],
    ['unknown schema',raw({...document([original]),version:2})],
    ['foreign owner',raw({...document([original]),owner:'member-b'})],
    ['missing records',raw({version:1,owner})],
    ['unknown document field',raw({...document([original]),nextVersion:{preserve:'synthetic'}})],
    ['partial invalid row',raw(document([original,{...original,id:'other',appId:'retired'}]))],
    ['unknown row field',raw(document([original,{...original,id:'other',attachment:'synthetic-retained-field'}]))],
    ['missing body',raw(document([original,{...original,id:'other',body:undefined}]))],
    ['invalid body',raw(document([original,{...original,id:'other',body:123}]))],
    ['oversized body',raw(document([original,{...original,id:'other',body:'가'.repeat(1201)}]))],
    ['blank title',raw(document([original,{...original,id:'other',title:'  '}]))],
    ['oversized title',raw(document([original,{...original,id:'other',title:'가'.repeat(81)}]))],
    ['invalid done',raw(document([original,{...original,id:'other',done:'false'}]))],
    ['completed note',raw(document([original,{...original,id:'other',kind:'note',done:true}]))],
    ['invalid time',raw(document([original,{...original,id:'other',createdAt:-1}]))],
    ['duplicate identity',raw(document([original,{...original,title:'중복 ID 원문'}]))],
    ['over capacity',raw(document(Array.from({length:61},(_,i)=>({...original,id:i?'row-'+i:'original'}))))],
  ];
  for(const [name,source]of cases)await t.test(name,()=>{
    const values=new Map([[key,source]]),writes=[];
    const storage={getItem:k=>values.get(k)??null,setItem:(k,value)=>{writes.push({k,value});values.set(k,value);}};
    const store=createHomeStore(storage,{clock:()=>200}),status=store.storageStatus(member());
    assert.equal(status.ok,false);assert.equal(status.code,'HOME_RECORDS_UNREADABLE');
    assert.deepEqual(Object.keys(status).sort(),['code','message','ok']);assert.doesNotMatch(status.message,/보존할 합성 기록|원문 그대로|synthetic-retained-field/);
    for(const action of [()=>store.add(member(),input),()=>store.change(member(),'original','toggle'),()=>store.change(member(),'original','remove')]){
      assert.throws(action,{code:'HOME_RECORDS_UNREADABLE'});
      assert.equal(values.get(key),source);assert.equal(writes.length,0);
    }
  });
});
test('partial readable records remain displayable while mutation status preserves the entire invalid document',async()=>{
  const {createHomeStore,HOME_KEY}=await loaded,key=HOME_KEY+':account:member-a';
  const source=JSON.stringify({version:1,owner:'member-a',records:[{id:'readable',kind:'note',appId:'world',title:'읽을 수 있는 합성 메모',body:'정상 부분',done:false,createdAt:100},{id:'unknown',kind:'note',appId:'retired',title:'옛 원문',body:'보존할 부분',done:false,createdAt:100}]});
  const storage=memory();storage.setItem(key,source);const store=createHomeStore(storage);
  assert.equal(store.list(member()).length,1);assert.equal(store.list(member())[0].id,'readable');
  assert.equal(store.storageStatus(member()).code,'HOME_RECORDS_UNREADABLE');assert.equal(storage.getItem(key),source);
});
test('valid notes, tasks, hidden apps and legacy Partners rows survive every unrelated write without normalization',async()=>{
  const {createHomeStore,HOME_KEY}=await loaded,key=HOME_KEY+':account:member-a',storage=memory();
  const rows=[
    {id:'task',kind:'task',appId:'world',title:'  이어 할 일  ',body:'줄바꿈\n원문  ',done:true,createdAt:100},
    {id:'note',kind:'note',appId:'world',title:'결과 메모',body:'  원문 공백\n',done:false,createdAt:101},
    {id:'hidden',kind:'note',appId:'messenger',title:'권한 밖 정상 메모',body:'숨겨도 보존',done:false,createdAt:102},
    {id:'legacy-partner',kind:'task',appId:'partners',title:'예전 Partners',body:'호환 원문',done:false,createdAt:103},
  ];
  storage.setItem(key,JSON.stringify({version:1,owner:'member-a',records:rows}));
  const store=createHomeStore(storage,{clock:()=>200}),library=member('member-a',['world']),read=()=>JSON.parse(storage.getItem(key)).records;
  assert.deepEqual(store.storageStatus(library),{ok:true});assert.deepEqual(store.list(library).map(row=>row.id),['task','note']);
  const added=store.add(library,input);assert.deepEqual(read().slice(1),rows);
  store.change(library,'task','toggle');assert.deepEqual(read(),[added,{...rows[0],done:false},...rows.slice(1)]);
  store.change(library,added.id,'remove');assert.deepEqual(read(),[{...rows[0],done:false},...rows.slice(1)]);
  const beforeDenied=storage.getItem(key);assert.throws(()=>store.change(library,'hidden','remove'),/권한/);assert.equal(storage.getItem(key),beforeDenied);
  assert.equal(store.list(member('member-a',['pulse']))[0].appId,'pulse');assert.equal(read().at(-1).appId,'partners');
});
test('a missing store starts normally and storage status neither exposes read errors nor reads for an unverified account',async()=>{
  const {createHomeStore,HOME_KEY}=await loaded,storage=memory(),store=createHomeStore(storage,{clock:()=>100});
  assert.deepEqual(store.storageStatus(member()),{ok:true});assert.deepEqual(store.list(member()),[]);
  const saved=store.add(member(),input);assert.deepEqual(store.list(member()),[saved]);assert.equal(JSON.parse(storage.getItem(HOME_KEY+':account:member-a')).owner,'member-a');
  let reads=0,writes=0;const unavailable=createHomeStore({getItem:()=>{reads++;throw Error('synthetic-private-path');},setItem:()=>writes++});
  const status=unavailable.storageStatus(member());assert.equal(status.code,'HOME_STORAGE_UNAVAILABLE');assert.doesNotMatch(status.message,/synthetic-private-path/);
  assert.equal(unavailable.storageStatus({owner:null,status:'loading',appIds:[]}).code,'HOME_ACCOUNT_REQUIRED');assert.equal(reads,1);assert.equal(writes,0);
});
test('storage failures are surfaced and do not claim a successful write',async()=>{
  const {createHomeStore}=await loaded,store=createHomeStore({getItem:()=>null,setItem:()=>{throw Error('storage full');}},{clock:()=>100});
  assert.throws(()=>store.add(member(),input),/storage full/);
});
test('home suggestions, recent launches and favorites intersect current app grants',async()=>{
  const {buildHomeModel}=await loaded;
  const model=buildHomeModel({library:member('a',['world']),personal:{order:['messenger','world','pulse']},prefs:{favorites:['messenger','world'],lastLaunch:{messenger:300,world:200,pulse:400}},records:[{kind:'note',appId:'messenger'},{kind:'task',appId:'world',done:false}]});
  assert.deepEqual(model.order,['world']);assert.deepEqual(model.recent,[{id:'world',at:200}]);assert.deepEqual(model.favorites,['world']);assert.equal(model.notes.length,0);assert.equal(model.tasks.length,1);
});
test('renderer escapes handwritten records and refresh clears member content when owner changes',async()=>{
  const {mountMemberHome,createHomeStore}=await loaded,storage=memory();createHomeStore(storage,{clock:()=>100}).add(member(),{...input,title:'<img src=x onerror=bad()>',body:'<script>bad()</script>'});
  let library=member();const root={innerHTML:'',addEventListener(){}};
  const home=mountMemberHome(root,{storage,getSnapshot:()=>({library,personal:{active:false,order:['world']},prefs:{}})});
  home.render();assert.match(root.innerHTML,/&lt;img/);assert.doesNotMatch(root.innerHTML,/<script>/);
  library=member('b');home.render();assert.doesNotMatch(root.innerHTML,/onerror/);
});

test('the next home action prioritizes an unfinished task, then a recent usable app',async()=>{
  const {buildHomeModel}=await loaded;
  const base={library:member('a',['world','messenger','pulse']),personal:{order:['pulse','world','messenger']},prefs:{lastLaunch:{world:100,messenger:200}},actions:{world:{action:'launch',disabled:false},messenger:{action:'launch',disabled:false},pulse:{action:'none',disabled:true}}};
  const task={id:'next',kind:'task',appId:'world',title:'이어서 배우기',done:false,createdAt:300};
  assert.equal(buildHomeModel({...base,records:[task]}).first,'world');
  assert.equal(buildHomeModel({...base,records:[{...task,done:true}]}).first,'messenger');
  const installing={...base,actions:{...base.actions,world:{action:'prepare',disabled:false}}};
  assert.equal(buildHomeModel({...installing,records:[task]}).first,'messenger');
  assert.equal(buildHomeModel({...base,library:member('a',['world']),records:[{...task,appId:'messenger'}]}).first,'world');
  const busy={...base,actions:{...base.actions,world:{action:'launch',disabled:true,pending:true}}};
  assert.equal(buildHomeModel({...busy,records:[task]}).first,'world','opening must not move the selected home action');
  const explicit={...base,personal:{...base.personal,sessionOnly:true,selected:'messenger'}};
  assert.equal(buildHomeModel({...explicit,records:[task]}).first,'messenger','an explicit purpose takes priority for this window');
});

test('home direct actions never run installers or bypass disabled launch states',async()=>{
  const {canOpenFromHome}=await loaded;
  for(const action of ['launch','teacher-preview','product-preview'])assert.equal(canOpenFromHome({action,disabled:false}),true);
  for(const action of ['prepare','open','refresh','none'])assert.equal(canOpenFromHome({action,disabled:false}),false);
  assert.equal(canOpenFromHome({action:'launch',disabled:true}),false);assert.equal(canOpenFromHome(null),false);
});

function homeFixture(){
  const listeners={};let html='',form=null,renders=0,focuses=0;
  const field=(name,value='')=>({name,value,checked:false,focus(){focuses++;root.ownerDocument.activeElement=this;},setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end;}});
  const root={ownerDocument:{activeElement:null},addEventListener(name,fn){listeners[name]=fn;},querySelector(selector){if(selector==='#member-record-form')return form;if(selector==='[name=title]')return form?.elements.namedItem('title');return null;},get innerHTML(){return html;},set innerHTML(value){renders++;html=value;if(!value.includes('id="member-record-form"')){form=null;return;}const fields={kind:field('kind','task'),appId:field('appId','world'),title:field('title'),body:field('body'),consent:field('consent')};form={elements:{namedItem:name=>fields[name]},contains:element=>Object.values(fields).includes(element)};}};
  return {root,get renders(){return renders;},get focuses(){return focuses;},field:name=>form?.elements.namedItem(name),click:dataset=>listeners.click({target:{closest:()=>({dataset,disabled:false})}}),submit:()=>listeners.submit({target:{id:'member-record-form',elements:form.elements},preventDefault(){}})};
}

test('home distinguishes checking, retry, guest and a member with no connected apps',async()=>{
  const {mountMemberHome}=await loaded,fixture=homeFixture();let library={status:'loading',owner:null,appIds:[]},retried=0;
  const home=mountMemberHome(fixture.root,{storage:memory(),getSnapshot:()=>({library,personal:{},prefs:{}}),onRetry:()=>retried++});
  home.render();assert.match(fixture.root.innerHTML,/aria-busy="true"/);assert.doesNotMatch(fixture.root.innerHTML,/data-member-retry/);
  library={status:'unavailable',owner:'a',appIds:[]};home.render();assert.match(fixture.root.innerHTML,/data-member-retry/);fixture.click({memberRetry:''});assert.equal(retried,1);
  library={status:'guest',owner:'anonymous-local',appIds:['world']};home.render();assert.match(fixture.root.innerHTML,/로그인하고 내 공간 연결/);
  library=member('a',[]);home.render();assert.match(fixture.root.innerHTML,/아직 연결된 앱이 없어요/);assert.doesNotMatch(fixture.root.innerHTML,/id="member-record-form"/);
});

test('purpose changes are temporary until the separate remember action is chosen',async()=>{
  const {mountMemberHome}=await loaded,fixture=homeFixture(),storage=memory(),calls=[];
  const home=mountMemberHome(fixture.root,{storage,getSnapshot:()=>({library:member(),personal:{context:'student',sessionOnly:true},prefs:{}}),onPurpose:(...args)=>calls.push(args)});
  home.render();fixture.click({memberPurpose:'creator'});fixture.click({memberRemember:'student'});
  assert.deepEqual(calls,[['creator',{remember:false}],['student',{remember:true}]]);assert.equal(storage.values.size,0);assert.match(fixture.root.innerHTML,/이 창에서만 적용/);
});

test('home launch controls show progress and recheck action and current grants at click time',async()=>{
  const {mountMemberHome}=await loaded,fixture=homeFixture();let library=member(),action={action:'launch',disabled:true,pending:true},calls=0;
  const home=mountMemberHome(fixture.root,{storage:memory(),getSnapshot:()=>({library,personal:{},prefs:{lastLaunch:{world:100}}}),getAppAction:()=>action,onLaunch:()=>calls++});
  home.render();assert.match(fixture.root.innerHTML,/disabled aria-busy="true"/);assert.match(fixture.root.innerHTML,/여는 중/);
  fixture.click({memberLaunch:'world'});assert.equal(calls,0);
  action={action:'launch',disabled:false};fixture.click({memberLaunch:'world'});assert.equal(calls,1);
  library=member('member-a',['messenger']);fixture.click({memberLaunch:'world'});assert.equal(calls,1);
});

test('in-memory drafts survive temporary account checks, require confirmation to discard and never autosave',async()=>{
  const {mountMemberHome}=await loaded,fixture=homeFixture(),storage=memory();let library=member();
  const home=mountMemberHome(fixture.root,{storage,getSnapshot:()=>({library,personal:{},prefs:{}})});
  home.render();fixture.click({memberAdd:''});fixture.field('title').value='중간까지 적은 글';
  assert.equal(home.hasUnsavedChanges(),true);fixture.click({memberCancel:''});assert.match(fixture.root.innerHTML,/data-member-discard/);assert.equal(fixture.field('title').value,'중간까지 적은 글');
  library={owner:null,status:'loading',appIds:[]};home.render();assert.equal(fixture.field('title'),undefined);assert.equal(home.hasUnsavedChanges(),true);
  library=member();home.render();assert.equal(fixture.field('title').value,'중간까지 적은 글');assert.equal(storage.values.size,0);
  fixture.click({memberKeep:''});assert.equal(home.hasUnsavedChanges(),true);fixture.click({memberCancel:''});fixture.click({memberDiscard:''});assert.equal(home.hasUnsavedChanges(),false);assert.equal(storage.values.size,0);
});

test('switching accounts or revoking the draft app prevents its recovery',async()=>{
  const {mountMemberHome}=await loaded,fixture=homeFixture();let library=member();
  const home=mountMemberHome(fixture.root,{storage:memory(),getSnapshot:()=>({library,personal:{},prefs:{}})});
  home.render();fixture.click({memberAdd:''});fixture.field('title').value='계정 A의 초안';
  library=member('b');home.render();assert.equal(home.hasUnsavedChanges(),false);assert.doesNotMatch(fixture.root.innerHTML,/계정 A의 초안/);
  fixture.click({memberAdd:''});fixture.field('title').value='권한 있는 앱의 초안';library=member('b',['messenger']);home.render();assert.equal(home.hasUnsavedChanges(),false);
});

test('saving a draft clears the leave guard only after storage succeeds',async()=>{
  const {mountMemberHome}=await loaded,fixture=homeFixture(),storage=memory();
  const home=mountMemberHome(fixture.root,{storage,getSnapshot:()=>({library:member(),personal:{},prefs:{}})});
  home.render();fixture.click({memberAdd:''});fixture.field('title').value='안전하게 저장';fixture.field('consent').checked=true;fixture.submit();
  assert.equal(home.hasUnsavedChanges(),false);assert.equal(storage.values.size,1);assert.match(fixture.root.innerHTML,/다음에 같은 계정으로 열면/);
  fixture.click({memberAdd:''});fixture.field('title').value='저장 실패 내용';fixture.field('consent').checked=true;storage.setItem=()=>{throw Error('storage full');};fixture.submit();
  assert.equal(home.hasUnsavedChanges(),true);assert.equal(fixture.field('title').value,'저장 실패 내용');
});

test('record search combines title, body and app while filtering task state',async()=>{
  const {filterHomeRecords}=await loaded,rows=[{id:'1',kind:'task',appId:'world',title:'다음 연습',body:'부탁 말하기',done:false},{id:'2',kind:'task',appId:'world',title:'완료한 연습',body:'부탁 듣기',done:true},{id:'3',kind:'note',appId:'messenger',title:'회의 기록',body:'결과',done:false}];
  assert.deepEqual(filterHomeRecords(rows,'부탁 연습','pending').map(row=>row.id),['1']);assert.deepEqual(filterHomeRecords(rows,'','done').map(row=>row.id),['2']);assert.deepEqual(filterHomeRecords(rows,'결과','notes').map(row=>row.id),['3']);assert.deepEqual(filterHomeRecords(rows,'WORLD').map(row=>row.id),['1','2']);
});
test('command search never exposes notes from another owner or a revoked app',async()=>{
  const {mountMemberHome,createHomeStore}=await loaded,fixture=homeFixture(),storage=memory();let library=member();createHomeStore(storage,{clock:()=>100}).add(library,input);
  const home=mountMemberHome(fixture.root,{storage,getSnapshot:()=>({library,personal:{},prefs:{}})});assert.equal(home.searchRecords('다음').length,1);library=member('member-b');assert.deepEqual(home.searchRecords(),[]);library=member('member-a',['messenger']);assert.deepEqual(home.searchRecords(),[]);assert.equal(home.focusRecord('not-allowed'),false);home.dispose();
});
test('favorite order survives preference reload and appears in the same order on home',async()=>{
  const {parsePreferences}=await import('../renderer/state.mjs'),{buildHomeModel}=await loaded;
  const prefs=parsePreferences(JSON.stringify({favorites:['care','world','care','retired','partners','pulse']}));
  const model=buildHomeModel({library:member('member-a',['world','care']),personal:{order:['world','care']},prefs});
  assert.deepEqual(prefs.favorites,['care','world','pulse']);assert.deepEqual(model.favorites,['care','world']);
});
test('failed encrypted discard restores unsaved content so a second close cannot bypass it',async()=>{
  const {mountMemberHome}=await loaded,fixture=homeFixture();
  const bridge={draftRecoveryStatus:async()=>({ok:true,available:true,enabled:true}),draftRecoveryLoad:async()=>({ok:true,enabled:true,draft:null}),draftRecoveryClear:async()=>({ok:false}),onDraftRecoveryChanged:()=>()=>{}};
  const home=mountMemberHome(fixture.root,{storage:memory(),bridge,getSnapshot:()=>({library:member(),personal:{},prefs:{}})});home.render();await new Promise(resolve=>setImmediate(resolve));
  fixture.click({memberAdd:''});fixture.field('title').value='지우지 못한 초안';assert.equal(await home.discardDraft(),false);assert.equal(home.hasUnsavedChanges(),true);assert.equal(fixture.field('title').value,'지우지 못한 초안');home.dispose();
});

test('a display read failure after a successful storage check remains visible and blocks mutations',async()=>{
  const {mountMemberHome}=await loaded,fixture=homeFixture();let reads=0,writes=0;
  const storage={getItem:()=>{if(++reads===2)throw Error('synthetic storage access failure');return null;},setItem:()=>writes++};
  const home=mountMemberHome(fixture.root,{storage,getSnapshot:()=>({library:member(),personal:{},prefs:{}})});
  home.render();assert.match(fixture.root.innerHTML,/role="alert" data-member-storage-error/);assert.match(fixture.root.innerHTML,/data-member-add disabled/);assert.equal(writes,0);home.dispose();
});

test('recovery updates redraw once while preserving the latest input, consent and selection',async()=>{
  const {mountMemberHome}=await loaded,fixture=homeFixture(),storage=memory();let finishStatus,statusCalls=0,loadCalls=0;
  const bridge={draftRecoveryStatus:()=>{statusCalls++;return new Promise(resolve=>finishStatus=resolve);},draftRecoveryLoad:async()=>{loadCalls++;return {ok:true,enabled:true,draft:{kind:'note',appId:'world',title:'보관된 합성 초안',body:'원문'},updatedAt:100};}};
  const home=mountMemberHome(fixture.root,{storage,bridge,getSnapshot:()=>({library:member(),personal:{},prefs:{}})});
  home.render();await new Promise(resolve=>setImmediate(resolve));assert.equal(fixture.renders,1,'the initial render already includes its synchronous recovery update');
  fixture.click({memberAdd:''});fixture.field('title').value='입력 중';const beforeFailure=fixture.renders;
  finishStatus({ok:false});queueMicrotask(()=>{fixture.field('title').value='갱신 직전까지 쓴 내용';fixture.field('body').value='마지막 본문';fixture.field('kind').value='note';fixture.field('consent').checked=true;fixture.field('title').setSelectionRange(2,5);});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(fixture.renders-beforeFailure,1);assert.match(fixture.root.innerHTML,/data-member-retry-recovery/);
  assert.equal(fixture.field('title').value,'갱신 직전까지 쓴 내용');assert.equal(fixture.field('body').value,'마지막 본문');assert.equal(fixture.field('kind').value,'note');assert.equal(fixture.field('appId').value,'world');assert.equal(fixture.field('consent').checked,true);
  assert.equal(fixture.root.ownerDocument.activeElement,fixture.field('title'));assert.equal(fixture.field('title').selectionStart,2);assert.equal(fixture.field('title').selectionEnd,5);
  const beforeRetry=fixture.renders;fixture.click({memberRetryRecovery:''});await new Promise(resolve=>setImmediate(resolve));assert.equal(fixture.renders-beforeRetry,1);assert.match(fixture.root.innerHTML,/data-member-retry-recovery disabled/);
  finishStatus({ok:true,available:true,enabled:true});await new Promise(resolve=>setImmediate(resolve));
  assert.equal(fixture.renders-beforeRetry,2);assert.doesNotMatch(fixture.root.innerHTML,/data-member-recovery-error/);assert.match(fixture.root.innerHTML,/data-member-recover>/);
  assert.equal(fixture.field('title').value,'갱신 직전까지 쓴 내용');assert.equal(fixture.field('consent').checked,true);assert.equal(statusCalls,2);assert.equal(loadCalls,1);assert.equal(storage.values.size,0);home.dispose();
});

test('selecting a recovery draft absorbs its queued redraw and keeps focus and renewed consent',async()=>{
  const {mountMemberHome}=await loaded,fixture=homeFixture();
  const bridge={draftRecoveryStatus:async()=>({ok:true,available:true,enabled:true}),draftRecoveryLoad:async()=>({ok:true,enabled:true,draft:{kind:'note',appId:'world',title:'선택한 합성 초안',body:'원문'},updatedAt:100}),draftRecoverySave:async()=>({ok:true})};
  const home=mountMemberHome(fixture.root,{storage:memory(),bridge,getSnapshot:()=>({library:member(),personal:{},prefs:{}})});
  home.render();await new Promise(resolve=>setImmediate(resolve));assert.equal(fixture.renders,2);
  const before=fixture.renders;fixture.click({memberRecover:''});await new Promise(resolve=>setImmediate(resolve));
  assert.equal(fixture.renders-before,1);assert.equal(fixture.field('title').value,'선택한 합성 초안');assert.equal(fixture.field('consent').checked,false);assert.equal(fixture.root.ownerDocument.activeElement,fixture.field('title'));home.dispose();
});

test('disposing a home cancels queued rendering and late retry focus',async()=>{
  const {mountMemberHome}=await loaded,fixture=homeFixture();let finishStatus;
  const bridge={draftRecoveryStatus:()=>new Promise(resolve=>finishStatus=resolve)};
  const home=mountMemberHome(fixture.root,{storage:memory(),bridge,getSnapshot:()=>({library:member(),personal:{},prefs:{}})});
  home.render();finishStatus({ok:false});await new Promise(resolve=>setImmediate(resolve));
  fixture.click({memberAdd:''});fixture.field('title').value='종료 전 입력';
  fixture.click({memberRetryRecovery:''});const before=fixture.renders,focuses=fixture.focuses,html=fixture.root.innerHTML;
  home.dispose();finishStatus({ok:false});home.render();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(fixture.renders,before);assert.equal(fixture.focuses,focuses);assert.equal(fixture.root.innerHTML,html);
});

test('a late failed discard cannot reopen a disposed home',async()=>{
  const {mountMemberHome}=await loaded,fixture=homeFixture();let finishClear;
  const bridge={draftRecoveryStatus:async()=>({ok:true,available:true,enabled:true}),draftRecoveryLoad:async()=>({ok:true,enabled:true,draft:null}),draftRecoveryClear:()=>new Promise(resolve=>finishClear=resolve)};
  const home=mountMemberHome(fixture.root,{storage:memory(),bridge,getSnapshot:()=>({library:member(),personal:{},prefs:{}})});
  home.render();await new Promise(resolve=>setImmediate(resolve));fixture.click({memberAdd:''});fixture.field('title').value='합성 미저장 초안';
  const clearing=home.discardDraft(),before=fixture.renders,html=fixture.root.innerHTML;home.dispose();finishClear({ok:false});assert.equal(await clearing,false);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(fixture.renders,before);assert.equal(fixture.root.innerHTML,html);assert.equal(fixture.field('title'),undefined);
});

for(const appId of ['world','messenger'])test('discarding only current input preserves an unselected '+appId+' recovery draft',async()=>{
  const {mountMemberHome}=await loaded,fixture=homeFixture(),storage=memory();let library=member('member-a',['world']);
  const original=JSON.stringify({kind:'note',appId,title:'이전에 남긴 합성 초안',body:'보존할 원문\n두 번째 줄'});let stored=original,clears=0,saves=0;
  const bridge={draftRecoveryStatus:async()=>({ok:true,available:true,enabled:true}),draftRecoveryLoad:async()=>({ok:true,enabled:true,draft:JSON.parse(stored),updatedAt:100}),draftRecoveryClear:async()=>{clears++;stored='null';return {ok:true,available:true,enabled:true};},draftRecoverySave:async(_slot,value)=>{saves++;stored=JSON.stringify(value);return {ok:true};},onDraftRecoveryChanged:()=>()=>{}};
  const home=mountMemberHome(fixture.root,{storage,bridge,getSnapshot:()=>({library,personal:{},prefs:{}})});
  home.render();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(fixture.root.innerHTML.includes('data-member-recover>'),appId==='world');
  fixture.click({memberAdd:''});fixture.field('title').value='지금 작성한 별도 초안';fixture.field('body').value='이 입력만 버리기';fixture.field('consent').checked=true;
  assert.equal(home.hasUnsavedChanges(),true);assert.equal(await home.discardDraft(),true);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(home.hasUnsavedChanges(),false);assert.equal(fixture.field('title'),undefined);assert.equal(clears,0);assert.equal(saves,0);assert.equal(stored,original);assert.equal(storage.values.size,0);
  library=member('member-a',['world','messenger']);home.render();await new Promise(resolve=>setImmediate(resolve));
  assert.match(fixture.root.innerHTML,/data-member-recover>/);fixture.click({memberRecover:''});await new Promise(resolve=>setImmediate(resolve));
  assert.equal(fixture.field('title').value,JSON.parse(original).title);assert.equal(fixture.field('body').value,JSON.parse(original).body);assert.equal(fixture.field('appId').value,appId);assert.equal(fixture.field('consent').checked,false);assert.equal(stored,original);assert.equal(clears,0);home.dispose();
});
