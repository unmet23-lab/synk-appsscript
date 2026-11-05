const test=require('node:test'),assert=require('node:assert/strict');
const mod=import('../renderer/state.mjs');
test('launcher never offers install or launch in browser preview',async()=>{const {primaryAction}=await mod;assert.deepEqual(primaryAction({canLaunch:true},{native:false}),{label:'PC 앱에서 설치',action:'none',disabled:true});});
test('installed app remains launchable while update is prepared',async()=>{const {primaryAction}=await mod;assert.equal(primaryAction({canLaunch:true,updateAvailable:true,installer:{canPrepare:true}}).action,'launch');});
test('preparing, ready and opened installer are distinct from installed',async()=>{const {primaryAction,statusLabel}=await mod;assert.equal(primaryAction({installer:{status:'preparing'}}).disabled,true);assert.equal(primaryAction({installer:{status:'ready',canOpen:true}}).action,'open');assert.equal(primaryAction({status:'not-installed',installer:{status:'installer-opened',canOpen:true}}).action,'refresh');assert.equal(statusLabel({status:'not-installed',installer:{status:'installer-opened'}}),'설치되지 않음');});
test('failed installer preparation can retry only when main permits',async()=>{const {primaryAction}=await mod;assert.equal(primaryAction({installer:{status:'error',canPrepare:true}}).action,'prepare');assert.equal(primaryAction({installer:{status:'error',canPrepare:false}}).disabled,true);});
test('renderer calculates real byte progress and clamps invalid values',async()=>{const {progressValue,bytes}=await mod;assert.equal(progressValue({transferredBytes:15,totalBytes:100}),15);assert.equal(progressValue({transferredBytes:105,totalBytes:100}),100);assert.equal(progressValue({transferredBytes:-4,totalBytes:100}),0);assert.equal(progressValue({transferredBytes:10,totalBytes:0}),0);assert.equal(bytes(-1),'—');assert.equal(bytes(1048576),'1.0 MB');});
test('local preferences are strictly limited to view state and known applications',async()=>{const {parsePreferences}=await mod;const p=parsePreferences(JSON.stringify({selected:'evil',favorites:['world','world','bad'],density:'unknown',lastLaunch:{world:'bad',messenger:123},token:'secret'}));assert.deepEqual(p,{selected:'world',favorites:['world'],density:'comfortable',lastLaunch:{world:null,messenger:123,teacher:null,path:null,pulse:null,care:null}});assert.equal(parsePreferences('{').selected,'world');});
test('opening remains a progress state and copy progress waits for verification',async()=>{const {primaryAction,progressValue,parsePreferences}=await mod;assert.equal(primaryAction({installer:{status:'opening'}}).disabled,true);assert.equal(progressValue({status:'preparing',progress:100,transferredBytes:100,totalBytes:100}),99);assert.equal(parsePreferences(JSON.stringify({lastLaunch:{world:1e300}})).lastLaunch.world,null);});
test('six apps preserve two packages, three local previews and the bundled PULSE catalog',async()=>{
  const {APP_IDS,APPS,INSTALLABLE_IDS,clientRows}=await mod;
  assert.deepEqual(APP_IDS,['world','messenger','teacher','path','pulse','care']);assert.equal(APPS.fortune,undefined,'무료 운세는 다시 만드는 동안 앱 칸이 없다');assert.deepEqual(INSTALLABLE_IDS,['world','messenger']);
  const rows=clientRows([{id:'teacher',canLaunch:true,installer:{canOpen:true}},{id:'pulse',canLaunch:true,installer:{canPrepare:true}}]);
  assert.equal(rows.length,6);assert.equal(rows.find(r=>r.id==='teacher').status,'preview');assert.equal(rows.find(r=>r.id==='pulse').canLaunch,false);assert.equal(rows.find(r=>r.id==='pulse').installer,undefined);
  for(const id of APP_IDS.slice(2)){assert.ok(APPS[id].audience);assert.ok(APPS[id].summary);assert.ok(APPS[id].boundary);assert.ok(APPS[id].features.length>=3);}
});
test('PULSE opens the independent app even when stale incoming state claims an installer',async()=>{
  const {primaryAction,statusLabel}=await mod,bad={id:'pulse',canLaunch:true,installer:{canPrepare:true,canOpen:true}};
  assert.deepEqual(primaryAction(bad),{label:'PULSE 열기',action:'pulse-app',disabled:false});
  assert.equal(primaryAction(bad,{native:false}).action,'pulse-app');assert.equal(primaryAction(bad,{busy:true}).disabled,true);assert.equal(statusLabel(bad),'전용 창');
});
test('PATH requires exact source-mode capability and never masquerade as installed packages',async()=>{
  const {primaryAction,clientRows,statusLabel}=await mod;
  for(const id of ['path','care']){
    const bad={id,canLaunch:true,installer:{canOpen:true,canPrepare:true}};
    const row=clientRows([bad]).find(item=>item.id===id);
    assert.equal(row.canLaunch,false);assert.equal(row.installer,undefined);assert.equal(row.status,'preview');
    assert.equal(primaryAction(bad).disabled,true);
    for(const capabilities of [null,'path,shift',['world'],[id==='path'?'shift':'path']])assert.equal(primaryAction(bad,{productPreviewsAvailable:capabilities}).disabled,true);
    assert.equal(primaryAction(bad,{native:false,productPreviewsAvailable:[id]}).disabled,true);
    assert.equal(primaryAction(bad,{productPreviewsAvailable:[id]}).action,'product-preview');
    assert.equal(primaryAction(bad,{busy:true,productPreviewsAvailable:[id]}).disabled,true);
    assert.match(statusLabel(row),id==='path'?/웹에서 연습/:/웹에서 열림/);assert.doesNotMatch(statusLabel(row),/교사/);
  }
});
test('PATH HTTPS interview takes priority over the legacy local campus only with the native public capability',async()=>{
  const {primaryAction,statusLabel,APPS}=await mod;
  const client={id:'path',status:'preview'},capability={publicAppsAvailable:['path'],productPreviewsAvailable:['path']};
  assert.deepEqual(primaryAction(client,capability),{label:'면접 연습 열기',action:'public-web',disabled:false});
  assert.equal(primaryAction(client,{...capability,busy:true}).disabled,true);
  assert.equal(primaryAction(client,{...capability,native:false}).disabled,true);
  for(const publicAppsAvailable of [null,'path',['PATH'],['care'],[]])assert.equal(primaryAction(client,{publicAppsAvailable}).disabled,true);
  assert.equal(statusLabel({...client,publicWebAvailable:true}),'웹에서 열림');
  assert.match(APPS.path.boundary,/답은 계정에 저장하지 않아요/);
  assert.match(APPS.path.boundary,/Quest 브라우저에서는 VR로/);
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
test('PULSE guide keeps the approved intro and still says what the app does',async()=>{
  const {APPS}=await mod,pulse=APPS.pulse,copy=[pulse.brand,pulse.category,pulse.description,pulse.caption,pulse.summary,pulse.boundary,pulse.maker.title,pulse.maker.body,pulse.maker.credits,...pulse.features.flat()].join(' ');
  // 11-05 첫 줄 판(유호님 「좋아 훌륭해」): 한 줄은 사이트 제목 그대로, 요약은 소개 줄과 맡긴 뒤의 일이다(사이트 첫 화면처럼 「확인하신 컷 · 합성」 문장은 뺐다).
  // 「모든 컷 먼저」와 합성 단서는 기능 첫 칸이 맡는다.
  assert.equal(pulse.description,'AI 모델에게 연기를 가르칩니다.');assert.equal(pulse.features.length,3);
  assert.equal(pulse.summary,'배우·광고 모델로 10년 일한 대표가 시선, 제품을 쥔 손, 웃음이 나오는 타이밍까지 직접 연출해요. 맡기신 뒤에는 초대 링크 하나로 진행 단계와 시안을 보고 의견을 남기고, 승인한 뒤 최종 파일까지 한곳에서 받아요.');
  assert.match(pulse.features[0][1],/들어갈 모든 컷을 완성 화질로 먼저 보여 드려요/);
  // 이력 자리의 경력은 「엔터테인먼트·광고 업계 10년」이다(배우만 앞세우지 않는다, 유호님 11-05).
  assert.match(pulse.maker.body,/SYNK PULSE는 엔터테인먼트·광고 업계에서 10년 일한 대표 유호가 연출해요\./);
  for(const old of ['모든 컷을 먼저 보여 드리는','배우로 활동한'])assert.ok(!copy.includes(old),old);
  for(const words of ['AI 모델 21명','같은 모델','제품·로고·글자는 합성이라 달라지지 않아요','움직이는 동안 작은 부분은 달라질 수 있고','대표 유호','뮤직비디오 주연'])assert.ok(copy.includes(words),words);
  // 소개가 앱의 실제 일을 가리면 안 된다: 초대받은 프로젝트의 진행 · 시안 확인 · 승인이 함께 읽혀야 한다.
  for(const words of ['초대 링크','초대받은 프로젝트','어느 단계','시안','승인','최종 파일'])assert.ok(copy.includes(words),words);
  // 소개글 원고가 쓰지 않는 말: 정하지 않은 약속 · 옛 화면 이름 · 제작 도구 이름
  assert.doesNotMatch(copy,/같은 얼굴|실제 촬영|납기|부가세|세금계산서|CLIENT STUDIO|최고|최초|유일|무제한|시댄스|Seedance|Omni|Veo|Flow|Higgsfield|힉스필드|Gemini|나노바나나|GPT|Sunburst/i);
});
