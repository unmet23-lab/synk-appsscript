const test=require('node:test'),assert=require('node:assert/strict');
const mod=import('../renderer/state.mjs');
test('launcher never offers install or launch in browser preview',async()=>{const {primaryAction}=await mod;assert.deepEqual(primaryAction({canLaunch:true},{native:false}),{label:'PC 앱에서 설치',action:'none',disabled:true});});
test('installed app remains launchable while update is prepared',async()=>{const {primaryAction}=await mod;assert.equal(primaryAction({canLaunch:true,updateAvailable:true,installer:{canPrepare:true}}).action,'launch');});
test('preparing, ready and opened installer are distinct from installed',async()=>{const {primaryAction,statusLabel}=await mod;assert.equal(primaryAction({installer:{status:'preparing'}}).disabled,true);assert.equal(primaryAction({installer:{status:'ready',canOpen:true}}).action,'open');assert.equal(primaryAction({status:'not-installed',installer:{status:'installer-opened',canOpen:true}}).action,'refresh');assert.equal(statusLabel({status:'not-installed',installer:{status:'installer-opened'}}),'설치되지 않음');});
test('failed installer preparation can retry only when main permits',async()=>{const {primaryAction}=await mod;assert.equal(primaryAction({installer:{status:'error',canPrepare:true}}).action,'prepare');assert.equal(primaryAction({installer:{status:'error',canPrepare:false}}).disabled,true);});
test('renderer calculates real byte progress and clamps invalid values',async()=>{const {progressValue,bytes}=await mod;assert.equal(progressValue({transferredBytes:15,totalBytes:100}),15);assert.equal(progressValue({transferredBytes:105,totalBytes:100}),100);assert.equal(progressValue({transferredBytes:-4,totalBytes:100}),0);assert.equal(progressValue({transferredBytes:10,totalBytes:0}),0);assert.equal(bytes(-1),'—');assert.equal(bytes(1048576),'1.0 MB');});
test('local preferences are strictly limited to view state and known applications',async()=>{const {parsePreferences}=await mod;const p=parsePreferences(JSON.stringify({selected:'evil',favorites:['world','world','bad'],density:'unknown',lastLaunch:{world:'bad',messenger:123},token:'secret'}));assert.deepEqual(p,{selected:'world',favorites:['world'],density:'comfortable',lastLaunch:{world:null,messenger:123,teacher:null,path:null,pulse:null,care:null,fortune:null,rehearsal:null,'family-album':null}});assert.equal(parsePreferences('{').selected,'world');});
test('opening remains a progress state and copy progress waits for verification',async()=>{const {primaryAction,progressValue,parsePreferences}=await mod;assert.equal(primaryAction({installer:{status:'opening'}}).disabled,true);assert.equal(progressValue({status:'preparing',progress:100,transferredBytes:100,totalBytes:100}),99);assert.equal(parsePreferences(JSON.stringify({lastLaunch:{world:1e300}})).lastLaunch.world,null);});
test('nine apps preserve two packages, six local previews and the bundled PULSE catalog',async()=>{
  const {APP_IDS,APPS,INSTALLABLE_IDS,clientRows}=await mod;
  assert.deepEqual(APP_IDS,['world','messenger','teacher','path','pulse','care','fortune','rehearsal','family-album']);assert.deepEqual(INSTALLABLE_IDS,['world','messenger']);
  const rows=clientRows([{id:'teacher',canLaunch:true,installer:{canOpen:true}},{id:'pulse',canLaunch:true,installer:{canPrepare:true}}]);
  assert.equal(rows.length,9);assert.equal(rows.find(r=>r.id==='teacher').status,'preview');assert.equal(rows.find(r=>r.id==='pulse').canLaunch,false);assert.equal(rows.find(r=>r.id==='pulse').installer,undefined);
  for(const id of APP_IDS.slice(2)){assert.ok(APPS[id].audience);assert.ok(APPS[id].summary);assert.ok(APPS[id].boundary);assert.ok(APPS[id].features.length>=3);}
});
test('PULSE opens the independent app even when stale incoming state claims an installer',async()=>{
  const {primaryAction,statusLabel}=await mod,bad={id:'pulse',canLaunch:true,installer:{canPrepare:true,canOpen:true}};
  assert.deepEqual(primaryAction(bad),{label:'PULSE 열기',action:'pulse-app',disabled:false});
  assert.equal(primaryAction(bad,{native:false}).action,'pulse-app');assert.equal(primaryAction(bad,{busy:true}).disabled,true);assert.equal(statusLabel(bad),'모델·제작 진행');
});
test('PATH requires exact source-mode capability and never masquerade as installed packages',async()=>{
  const {primaryAction,clientRows,statusLabel}=await mod;
  for(const id of ['path','care','fortune','rehearsal','family-album']){
    const bad={id,canLaunch:true,installer:{canOpen:true,canPrepare:true}};
    const row=clientRows([bad]).find(item=>item.id===id);
    assert.equal(row.canLaunch,false);assert.equal(row.installer,undefined);assert.equal(row.status,'preview');
    assert.equal(primaryAction(bad).disabled,true);
    for(const capabilities of [null,'path,shift',['world'],[id==='path'?'shift':'path']])assert.equal(primaryAction(bad,{productPreviewsAvailable:capabilities}).disabled,true);
    assert.equal(primaryAction(bad,{native:false,productPreviewsAvailable:[id]}).disabled,true);
    assert.equal(primaryAction(bad,{productPreviewsAvailable:[id]}).action,'product-preview');
    assert.equal(primaryAction(bad,{busy:true,productPreviewsAvailable:[id]}).disabled,true);
    assert.match(statusLabel(row),id==='path'?/실사 면접실 · 공개 MVP/:/로컬 MVP/);assert.doesNotMatch(statusLabel(row),/교사/);
  }
});
test('PATH HTTPS interview takes priority over the legacy local campus only with the native public capability',async()=>{
  const {primaryAction,statusLabel,APPS}=await mod;
  const client={id:'path',status:'preview'},capability={publicAppsAvailable:['path'],productPreviewsAvailable:['path']};
  assert.deepEqual(primaryAction(client,capability),{label:'실사 면접실 열기',action:'public-web',disabled:false});
  assert.equal(primaryAction(client,{...capability,busy:true}).disabled,true);
  assert.equal(primaryAction(client,{...capability,native:false}).disabled,true);
  for(const publicAppsAvailable of [null,'path',['PATH'],['care'],[]])assert.equal(primaryAction(client,{publicAppsAvailable}).disabled,true);
  assert.equal(statusLabel({...client,publicWebAvailable:true}),'웹에서 이용 가능');
  assert.match(APPS.path.boundary,/답변은 계정에 저장하지 않습니다/);
  assert.match(APPS.path.boundary,/Quest 착용·멀미 검증/);
});
test('teacher preview needs explicit native capability and never reuses package launch',async()=>{
  const {primaryAction}=await mod;
  assert.equal(primaryAction({id:'teacher',canLaunch:true}).disabled,true);assert.equal(primaryAction({id:'teacher'},{native:false,teacherPreviewAvailable:true}).disabled,true);
  assert.deepEqual(primaryAction({id:'teacher'},{native:true,teacherPreviewAvailable:true}),{label:'내 수업 열기',action:'teacher-preview',disabled:false});
});
test('library filters and Korean searches expose the PULSE catalog and retain favorites',async()=>{
  const {matchesLibrary,parsePreferences}=await mod;
  assert.equal(matchesLibrary('teacher',{search:'기관'}),true);assert.equal(matchesLibrary('pulse',{search:'고객'}),true);assert.equal(matchesLibrary('path',{search:'면접'}),true);assert.equal(matchesLibrary('messenger',{search:'인공지능'}),true);
  assert.equal(matchesLibrary('teacher',{filter:'planned'}),false);assert.equal(matchesLibrary('pulse',{filter:'planned'}),false);assert.equal(matchesLibrary('pulse',{filter:'development',search:'모델'}),true);assert.equal(matchesLibrary('partners',{filter:'planned'}),false);assert.equal(matchesLibrary('studio',{filter:'installed',client:{canLaunch:false}}),false);
  const prefs=parsePreferences(JSON.stringify({selected:'teacher',favorites:['teacher','pulse','pulse','evil'],lastLaunch:{world:123,teacher:123,pulse:123}}));assert.equal(prefs.selected,'teacher');assert.deepEqual(prefs.favorites,['teacher','pulse']);assert.equal(prefs.lastLaunch.world,123);assert.equal(prefs.lastLaunch.teacher,123);assert.equal(prefs.lastLaunch.pulse,123);
});

test('retired app preferences and stale launch rows cannot become Messenger authority',async()=>{const {parsePreferences,primaryAction,clientRows,matchesLibrary}=await mod;for(const id of ['studio','shift']){const prefs=parsePreferences(JSON.stringify({selected:id,favorites:[id],lastLaunch:{[id]:123}}));assert.equal(prefs.selected,'world');assert.deepEqual(prefs.favorites,[]);assert.equal(prefs.lastLaunch.messenger,null);assert.equal(matchesLibrary(id),false);assert.equal(clientRows([{id,canLaunch:true}]).some(row=>row.id===id),false);assert.equal(primaryAction({id,canLaunch:true,installer:{canOpen:true}},{productPreviewsAvailable:[id]}).disabled,true);}});

test('old Partners view selections converge on PULSE without providing a launch path',async()=>{
  const {parsePreferences,primaryAction,clientRows}=await mod;
  const prefs=parsePreferences(JSON.stringify({selected:'partners',favorites:['partners','pulse'],lastLaunch:{partners:123}}));
  assert.equal(prefs.selected,'pulse');assert.deepEqual(prefs.favorites,['pulse']);assert.equal(prefs.lastLaunch.pulse,null);
  assert.equal(primaryAction({id:'partners',canLaunch:true,installer:{canOpen:true}}).disabled,true);
  assert.equal(clientRows([{id:'partners',canLaunch:true}]).some(row=>row.id==='partners'),false);
  const {resolveLibrary}=await import('../renderer/library.mjs');
  assert.deepEqual(resolveLibrary({signedIn:true,status:'signed-in',account:{synk_user_id:'member-a'},library:{status:'ready',appIds:['partners']}}).appIds,[]);
});
