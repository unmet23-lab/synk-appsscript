import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const escape=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function fixture(){
  const requests=[],handlers=new Map(),uploads=[],status={textContent:''},timers=new Map();let renders=0,timerId=0;
  const inboxDetails={open:false},inboxTime={textContent:''},inboxList={scrollTop:0},inboxElement={innerHTML:'',contains(){return false;},querySelector(selector){return selector==='[data-pf-inbox-settings]'?inboxDetails:selector==='[data-pf-inbox-time]'?inboxTime:selector==='.pf-inbox-list'?inboxList:null;},querySelectorAll(){return [];}};
  class UploadFixture{constructor(){this.upload={};this.headers={};uploads.push(this);}open(method,url){this.method=method;this.url=url;}setRequestHeader(key,value){this.headers[key]=value;}send(body){this.body=body;}abort(){this.aborted=true;this.onabort?.();}}
  const location=new URL('http://localhost:4191/?tab=workroom&section=tools&tool=publication');
  const context=vm.createContext({console,structuredClone,URL,URLSearchParams,location,history:{replaceState(_a,_b,value){location.href=new URL(value,location).href;}},selectWorkspaceView(view,section){context.state.tab=view;context.wr.view=section;},Date,Intl,XMLHttpRequest:UploadFixture,escape,queueMicrotask,setTimeout(callback,delay){const id=++timerId;timers.set(id,{callback,delay});return id;},clearTimeout(id){timers.delete(id);},wr:{view:'tools'},makerTools:{view:'publication'},window:{scrollX:0,scrollY:300,scrollTo(x,y){this.scrollX=x;this.scrollY=y;},getSelection(){return {isCollapsed:true};}},navigator:{clipboard:{async writeText(){}}},state:{user:{id:'member',role:'member'},csrf:'fixture-csrf',tab:'workroom'},document:{visibilityState:'visible',activeElement:null,querySelector(selector){return selector==='[data-pf-inbox]'?inboxElement:selector==='[data-pf-status]'?status:null;},addEventListener(type,handler){if(!handlers.has(type))handlers.set(type,[]);handlers.get(type).push(handler);}},api(path,body){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});requests.push({path,body,resolve,reject});return promise;},render(){renders++;},notify(){}});
  vm.runInContext(readFileSync(new URL('./public/publication-flow.js',import.meta.url),'utf8'),context);const run=code=>vm.runInContext(code,context);
  run('pfIdentity()');context.initial={studio:{productions:[]},packages:{packages:[]},catalog:{channels:[{id:'youtube-shorts',label:'YouTube Shorts',width:1080,height:1920}],capabilities:{conversion:true}},performance:{entries:[],channels:[{id:'channel',displayName:'내 계정',canEdit:true}],canWrite:true,metricDefinitions:[{id:'views',label:'조회'},{id:'reach',label:'도달'}]}};run('pf.data=structuredClone(initial);pf.attempted=true');
  return {context,run,requests,handlers,uploads,status,timers,inboxElement,inboxDetails,inboxTime,inboxList,get renders(){return renders;}};
}
const entry={id:'entry',channelId:'channel',channelName:'내 계정',canEdit:true,title:'등록 콘텐츠',url:'https://www.youtube.com/watch?v=fixture',publishedAt:'2026-10-10T00:00:00.000Z',checkpoints:[{hours:24,dueAt:'2026-10-11T00:00:00.000Z',status:'manual-required',metrics:{views:null,reach:null},unavailableReasons:{reach:'API에서 제공하지 않습니다.'}}]};

test('late workspace responses cannot populate a different account or win a newer refresh',async()=>{
  const f=fixture(),first=f.run('pfLoad()'),second=f.run('pfLoad()');f.requests[1].resolve({...f.context.initial,marker:'latest'});await second;f.requests[0].resolve({...f.context.initial,marker:'old'});await first;assert.equal(f.run('pf.data.marker'),'latest');
  const pending=f.run('pfLoad()');f.context.state.user={id:'other',role:'member'};f.run('pfIdentity()');f.requests[2].resolve({...f.context.initial,marker:'private'});await pending;assert.equal(f.run('pf.data'),null);assert.equal(f.run('pf.userId'),'other');
});
test('new source selection rejects stale details without replacing the publication draft',async()=>{
  const f=fixture();f.run('pf.draft.body="남길 게시문"');const first=f.run('pfSelectProduction("old")'),second=f.run('pfSelectProduction("new")');f.requests[1].resolve({production:{id:'new',title:'새 원본',versions:[{id:'v-new',kind:'video',mediaId:'new-media'}]}});await second;f.requests[0].resolve({production:{id:'old',title:'이전 원본',versions:[{id:'v-old',kind:'video',mediaId:'old-media'}]}});await first;assert.equal(f.run('pf.production.id'),'new');assert.equal(f.run('pf.draft.versionId'),'v-new');assert.equal(f.run('pf.draft.body'),'남길 게시문');
});
test('package failures preserve source, channels and authored text and duplicate submits are ignored',async()=>{
  const f=fixture();f.run('Object.assign(pf.draft,{productionId:"p",versionId:"v",title:"완성본",body:"내 게시문",subtitleText:"1\\n00:00:00,000 --> 00:00:01,000\\n자막"})');const pending=f.run('pfCreatePackage()');await f.run('pfCreatePackage()');assert.equal(f.requests.length,1);assert.equal(f.requests[0].path,'/api/publication-packages');assert.equal(f.requests[0].body.body,'내 게시문');f.requests[0].reject(new Error('변환 시간 초과'));await pending;assert.equal(f.run('pf.draft.body'),'내 게시문');assert.equal(f.run('pf.draft.versionId'),'v');assert.equal(f.run('pf.busy'),false);assert.match(f.run('pf.error'),/시간 초과/);
});
test('successful package result is listed without claiming it has been published',async()=>{
  const f=fixture();f.run('Object.assign(pf.draft,{productionId:"p",versionId:"v",title:"완성본"})');const pending=f.run('pfCreatePackage()');f.requests[0].resolve({package:{id:'package',title:'완성본',outputs:[],checks:[]}});await pending;assert.equal(f.run('pfPackages()[0].id'),'package');assert.match(f.run('pf.status'),/실제 결과를 확인/);assert.match(f.run('pfPackageCard(pfPackages()[0])'),/\/api\/publication-packages\/package\/download/);assert.equal(f.run('pfEntries().length'),0);
});
test('Korean posting dates are converted independently of the browser timezone and impossible dates rejected',()=>{
  const f=fixture();assert.equal(f.run('pfInstant("2026-10-11T09:30")'),'2026-10-11T00:30:00.000Z');assert.throws(()=>f.run('pfInstant("2026-02-30T09:30")'),/날짜/);assert.throws(()=>f.run('pfInstant("")'),/날짜/);
});
test('registration preserves unsaved input on errors and ignores an account change on success',async()=>{
  const f=fixture();f.run('Object.assign(pf.registration,{channelId:"channel",url:"https://youtube.com/watch?v=x",publishedAt:"2026-10-11T09:00",title:"제목"})');const first=f.run('pfRegisterPost()');assert.equal(f.requests[0].body.publishedAt,'2026-10-11T00:00:00.000Z');f.requests[0].reject(new Error('계정 연결을 확인해 주세요.'));await first;assert.equal(f.run('pf.registration.title'),'제목');const second=f.run('pfRegisterPost()');f.context.state.user=null;f.run('publicationFlowReset()');f.requests[1].resolve({entry});await second;assert.equal(f.run('pf.data'),null);assert.equal(f.run('pf.registration.title'),'');
});
test('manual metrics preserve unknown vs zero and submit the actual observation timestamp',async()=>{
  const f=fixture();f.context.entry=entry;f.run('pf.data.performance.entries=[entry];pf.manual["entry:24"]={metrics:{views:"0",reach:""},measuredAt:"2026-10-11T09:05",note:"화면 확인"}');const pending=f.run('pfSaveMetrics("entry",24)');assert.deepEqual(JSON.parse(JSON.stringify(f.requests[0].body)),{metrics:{views:0},measuredAt:'2026-10-11T00:05:00.000Z',note:'화면 확인'});f.requests[0].resolve({entry:{...entry,checkpoints:[{hours:24,metrics:{views:0,reach:null}}]}});await pending;assert.equal(f.run('pf.manual["entry:24"]'),undefined);
});
test('read-only users cannot upload, prepare, register, collect or record metrics',async()=>{
  const f=fixture();f.context.state.user.role='viewer';f.context.entry=entry;f.run('pf.data.performance.entries=[entry];pf.file={name:"video.mp4",size:100};pf.draft.productionId="p";pf.draft.versionId="v"');await f.run('pfUploadSelected()');await f.run('pfCreatePackage()');await f.run('pfRegisterPost()');await f.run('pfCollect("entry")');await f.run('pfSaveMetrics("entry",24)');assert.equal(f.requests.length,0);assert.equal(f.uploads.length,0);
});
test('subtitle reads are account-bound and discarded when a later file supersedes them',async()=>{
  const f=fixture();let resolveFirst,resolveSecond;f.context.first={name:'first.srt',size:10,text:()=>new Promise(resolve=>{resolveFirst=resolve;})};f.context.second={name:'second.vtt',size:10,text:()=>new Promise(resolve=>{resolveSecond=resolve;})};const first=f.run('pfReadSubtitle(first)'),second=f.run('pfReadSubtitle(second)');resolveSecond('WEBVTT\n');await second;resolveFirst('old');await first;assert.equal(f.run('pf.draft.subtitleText'),'WEBVTT\n');assert.equal(f.run('pf.draft.subtitleFileName'),'second.vtt');
});
test('reset aborts in-flight upload and cannot accept the old response',async()=>{
  const f=fixture();f.context.file={name:'fixture.mp4',size:100,type:'video/mp4'};f.run('pf.file=file;pf.draft.productionId="p"');const pending=f.run('pfUploadSelected()');assert.equal(f.uploads.length,1);assert.equal(f.uploads[0].headers['X-CSRF-Token'],'fixture-csrf');f.context.state.user=null;f.run('publicationFlowReset()');await pending;assert.equal(f.uploads[0].aborted,true);assert.equal(f.run('pf.production'),null);assert.equal(f.run('pf.error'),'');
});
test('untrusted result fields and post URLs stay escaped and missing metrics stay explicit',()=>{
  const f=fixture();f.context.entry={...entry,title:'<script>bad</script>',url:'javascript:alert(1)'};const html=f.run('pfEntryCard(entry,true)');assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('href="javascript:'));assert.ok(html.includes('미확인'));assert.ok(html.includes('API에서 제공하지 않습니다.'));
});
test('channel read-only entries cannot be collected, paused or supplemented by a writable member',async()=>{
  const f=fixture();f.context.entry={...entry,canEdit:false};f.run('pf.data.performance.entries=[entry]');await f.run('pfCollect("entry")');await f.run('pfSaveMetrics("entry",24)');await f.run('pfSetActive("entry")');assert.equal(f.requests.length,0);const html=f.run('pfEntryCard(entry,true)');assert.ok(!html.includes('data-pf-action="collect"'));assert.ok(!html.includes('data-pf-form="metrics"'));
});
test('supplement only sends previously unknown metrics and renders each metric observation separately',async()=>{
  const f=fixture();f.context.entry={...entry,checkpoints:[{...entry.checkpoints[0],status:'recorded',metrics:{views:5,reach:null},metricProvenance:{views:{source:'api:youtube',observedAt:'2026-10-11T00:00:00.000Z',timing:'on-time'}}}]};f.run('pf.data.performance.entries=[entry];pf.manual["entry:24"]={metrics:{views:"999",reach:"12"},measuredAt:"2026-10-11T09:05",note:"보완"}');const html=f.run('pfEntryCard(entry,true)');assert.ok(!html.includes('data-pf-metric="views"'));assert.ok(html.includes('data-pf-metric="reach"'));assert.ok(html.includes('자동 수집'));const pending=f.run('pfSaveMetrics("entry",24)');assert.deepEqual(JSON.parse(JSON.stringify(f.requests[0].body.metrics)),{reach:12});f.requests[0].resolve({entry:f.context.entry});await pending;
});
test('pause and resume keep the server returned original checkpoint times',async()=>{
  const f=fixture();f.context.entry={...entry,active:true};f.run('pf.data.performance.entries=[entry]');const pending=f.run('pfSetActive("entry")');assert.equal(f.requests[0].body.active,false);f.requests[0].resolve({entry:{...f.context.entry,active:false}});await pending;assert.equal(f.run('pfEntries()[0].active'),false);assert.equal(f.run('pfEntries()[0].checkpoints[0].dueAt'),entry.checkpoints[0].dueAt);assert.match(f.run('pfEntryCard(pfEntries()[0],true)'),/원래 24·72시간 예정 시각은 바뀌지 않습니다/);
});
test('package output preview uses the authenticated local media identifier instead of untrusted URLs',()=>{
  const f=fixture();f.context.package={id:'p',title:'출력',outputs:[{channel:'youtube-shorts',fileName:'output.mp4',mediaId:'m',previewUrl:'https://evil.test/video.mp4'}]};const html=f.run('pfPackageCard(package)');assert.ok(html.includes('src="/api/studio-media/m"'));assert.ok(!html.includes('evil.test'));
});

const inbox={available:true,active:true,inboxPath:'C:\\workspace\\완성본',lastScanAt:'2026-10-11T00:00:00.000Z',entries:[{id:'delivery',status:'ready',title:'확정된 한 편',createdAt:'2026-10-11T00:00:00.000Z',productionId:'automatic',versionId:'version'}]};
function inboxFixture(){const f=fixture();f.context.inbox=inbox;f.run('pf.data.inbox=structuredClone(inbox);pfInboxPanel()');return f;}

test('automatic arrivals refresh only the inbox and preserve authored draft, video state and scroll',async()=>{
  const f=inboxFixture();f.run('pf.draft.body="작성하던 게시문";pf.draft.title="내 제목";pf.production={id:"current",versions:[]};pf.inboxChoice="delivery"');f.inboxDetails.open=true;f.inboxList.scrollTop=17;const renders=f.renders,pending=f.run('pfInboxLoad()');assert.equal(f.requests[0].path,'/api/publication-inbox');assert.equal(f.requests[0].body,undefined);f.requests[0].resolve({...inbox,entries:[...inbox.entries,{id:'new',title:'다음 완성본',status:'error',message:'자막을 다시 확인해 주세요.'}]});await pending;assert.equal(f.renders,renders);assert.equal(f.run('pf.draft.body'),'작성하던 게시문');assert.equal(f.run('pf.production.id'),'current');assert.equal(f.run('pf.inboxChoice'),'delivery');assert.equal(f.context.window.scrollY,300);assert.equal(f.inboxDetails.open,true);assert.equal(f.inboxList.scrollTop,17);assert.ok(f.inboxElement.innerHTML.includes('다음 완성본'));assert.equal(f.timers.size,1);
});

test('unchanged scan timestamps do not replace the inbox DOM',async()=>{
  const f=inboxFixture();f.inboxElement.innerHTML='preserved-dom';const pending=f.run('pfInboxLoad()');f.requests[0].resolve({...inbox,lastScanAt:'2026-10-11T00:00:05.000Z'});await pending;assert.equal(f.inboxElement.innerHTML,'preserved-dom');assert.notEqual(f.inboxTime.textContent,'');assert.equal(f.renders,0);
});

test('inbox polling stops while hidden, on another view, when disabled and after reset',()=>{
  const f=inboxFixture();f.run('pfInboxSchedule()');assert.equal(f.timers.size,1);assert.equal([...f.timers.values()][0].delay,5000);f.context.document.visibilityState='hidden';f.handlers.get('visibilitychange').forEach(handler=>handler());assert.equal(f.timers.size,0);f.context.document.visibilityState='visible';f.handlers.get('visibilitychange').forEach(handler=>handler());assert.equal(f.timers.size,1);f.context.makerTools.view='publish';f.run('pfInboxSchedule()');assert.equal(f.timers.size,0);f.context.makerTools.view='publication';f.run('pf.view="performance";pfInboxSchedule()');assert.equal(f.timers.size,0);f.run('pf.view="prepare";pf.data.inbox.active=false;pfInboxSchedule()');assert.equal(f.timers.size,0);f.run('pf.data.inbox.active=true;pfInboxSchedule();publicationFlowReset()');assert.equal(f.timers.size,0);assert.equal(f.requests.length,0);
});

test('late inbox response cannot cross users or overwrite a newer setting change',async()=>{
  const f=inboxFixture(),pending=f.run('pfInboxLoad()'),toggle=f.run('pfInboxAction("toggle")');assert.equal(f.requests[1].path,'/api/publication-inbox/settings');assert.equal(f.requests[1].body.active,false);f.requests[1].resolve({...inbox,active:false});await toggle;f.requests[0].resolve(inbox);await pending;assert.equal(f.run('pf.data.inbox.active'),false);assert.equal(f.timers.size,0);f.run('pf.data.inbox.active=true');const old=f.run('pfInboxLoad()');f.context.state.user={id:'other',role:'member'};f.run('pfIdentity()');f.requests[2].resolve(inbox);await old;assert.equal(f.run('pf.data'),null);assert.equal(f.timers.size,0);
});

test('existing drafts require a cancellable choice before an inbox item is applied',async()=>{
  const f=inboxFixture();f.run('pf.draft.body="아직 쓰는 중"');await f.run('pfInboxUse("delivery")');assert.equal(f.requests.length,0);assert.equal(f.run('pf.inboxChoice'),'delivery');assert.match(f.inboxElement.innerHTML,/현재 초안 유지/);assert.equal(f.run('pf.draft.body'),'아직 쓰는 중');f.run('pf.inboxChoice="";pfInboxPaint()');assert.equal(f.run('pf.draft.body'),'아직 쓰는 중');const pending=f.run('pfInboxUse("delivery",true)');assert.equal(f.requests[0].path,'/api/publication-inbox/delivery/draft');f.requests[0].resolve({draft:{productionId:'automatic',versionId:'version',title:'확정된 한 편',body:'확정 게시문',subtitleText:'확정 자막',channels:['instagram-reels'],mode:'original'},production:{id:'automatic',title:'확정된 한 편',versions:[{id:'version',kind:'video',mediaId:'source'}]}});await pending;assert.equal(f.run('pf.draft.body'),'확정 게시문');assert.equal(f.run('pf.draft.subtitleText'),'확정 자막');assert.equal(f.run('pf.production.id'),'automatic');assert.equal(f.run('pf.data.studio.productions[0].id'),'automatic');assert.equal(f.run('pfPackages().length'),0);assert.equal(f.requests.length,1);
});

test('failed draft retrieval preserves the existing draft and stale subtitle read cannot replace imported subtitles',async()=>{
  const f=inboxFixture();f.run('pf.draft.body="남길 내용"');const fail=f.run('pfInboxUse("delivery",true)');f.requests[0].reject(new Error('완성본 접근 권한을 확인해 주세요.'));await fail;assert.equal(f.run('pf.draft.body'),'남길 내용');let resolve;f.context.file={name:'previous.srt',size:10,text:()=>new Promise(yes=>{resolve=yes;})};const subtitle=f.run('pfReadSubtitle(file)'),success=f.run('pfInboxUse("delivery",true)');f.requests[1].resolve({draft:{productionId:'automatic',versionId:'version',subtitleText:'가져온 자막'},production:{id:'automatic',versions:[]}});await success;resolve('과거 파일');await subtitle;assert.equal(f.run('pf.draft.subtitleText'),'가져온 자막');
});

test('viewer cannot change inbox settings, scan or import and inaccessible local paths are absent',async()=>{
  const f=inboxFixture();f.context.state.user.role='viewer';await f.run('pfInboxAction("toggle")');await f.run('pfInboxAction("scan")');await f.run('pfInboxUse("delivery")');assert.equal(f.requests.length,0);let html=f.run('pfInboxContents()');assert.ok(!html.includes('data-pf-action="inbox-toggle"'));assert.ok(!html.includes('data-pf-action="inbox-use"'));f.run('pf.data.inbox.available=false');html=f.run('pfInboxContents()');assert.ok(!html.includes('C:\\workspace'));assert.ok(!html.includes('지정 폴더 경로 복사'));
});

test('inbox paths, titles and server errors are escaped and do not create executable markup',()=>{
  const f=inboxFixture();f.context.malicious={...inbox,inboxPath:'<img src=x onerror=alert(1)>',entries:[{...inbox.entries[0],title:'<script>bad</script>',message:'<iframe src=x>'}]};f.run('pf.data.inbox=malicious');const html=f.run('pfInboxContents()');assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img'));assert.ok(!html.includes('<iframe'));assert.ok(html.includes('&lt;script&gt;'));
});

test('whole-folder scan failures are visible and clear after a successful retry',async()=>{
  const f=inboxFixture(),pending=f.run('pfInboxLoad()');f.requests[0].resolve({...inbox,message:'지정 폴더에 접근할 수 없습니다.'});await pending;assert.match(f.inboxElement.innerHTML,/지정 폴더에 접근할 수 없습니다/);const retry=f.run('pfInboxLoad()');f.requests[1].resolve({...inbox,message:''});await retry;assert.ok(!f.inboxElement.innerHTML.includes('지정 폴더에 접근할 수 없습니다'));
});

test('selected text in the inbox remains selectable until the selection is released',async()=>{
  const f=inboxFixture();f.inboxElement.innerHTML='selected-content';f.context.window.getSelection=()=>({isCollapsed:false,rangeCount:1,getRangeAt:()=>({intersectsNode:()=>true})});const pending=f.run('pfInboxLoad()');f.requests[0].resolve({...inbox,entries:[]});await pending;assert.equal(f.inboxElement.innerHTML,'selected-content');f.context.window.getSelection=()=>({isCollapsed:true});f.run('pfInboxPaint()');assert.notEqual(f.inboxElement.innerHTML,'selected-content');
});

test('new arrivals keep a focused editor at the same position inside the workroom scroll container',async()=>{
  const f=inboxFixture(),main={scrollTop:821,scrollLeft:0,scrollHeight:1800,clientHeight:800,parentElement:null};let addedHeight=0,painted='';
  const editor={value:'작성 중인 본문',selectionStart:3,selectionEnd:7,parentElement:main,closest:()=>true,getBoundingClientRect:()=>({top:317.421875+addedHeight-(main.scrollTop-821)})};
  f.context.document.activeElement=editor;f.context.window.getComputedStyle=node=>({overflowY:node===main?'auto':'visible'});Object.defineProperty(f.inboxElement,'innerHTML',{get:()=>painted,set:value=>{painted=value;addedHeight=59.546875;}});
  const before=editor.getBoundingClientRect().top,pending=f.run('pfInboxLoad()');f.requests[0].resolve({...inbox,entries:[...inbox.entries,{...inbox.entries[0],id:'new-arrival',title:'새로 도착한 완성본'}]});await pending;
  assert.equal(editor.getBoundingClientRect().top,before);assert.equal(main.scrollTop,880.546875);assert.equal(f.context.window.scrollY,300);assert.equal(f.context.document.activeElement,editor);assert.equal(editor.value,'작성 중인 본문');assert.equal(editor.selectionStart,3);assert.equal(editor.selectionEnd,7);assert.equal(f.renders,0);
});

test('scroll compensation reaches an outer container when an inner panel has no remaining scroll space',async()=>{
  const f=inboxFixture(),outer={scrollTop:100,scrollLeft:0,scrollHeight:2000,clientHeight:800,parentElement:null};let innerTop=40,addedHeight=0;
  const inner={get scrollTop(){return innerTop;},set scrollTop(value){innerTop=Math.min(50,Math.max(0,value));},scrollLeft:0,scrollHeight:250,clientHeight:200,parentElement:outer};
  const editor={parentElement:inner,closest:()=>true,getBoundingClientRect:()=>({top:200+addedHeight-(innerTop-40)-(outer.scrollTop-100)})};
  f.context.document.activeElement=editor;f.context.window.getComputedStyle=()=>({overflowY:'auto'});Object.defineProperty(f.inboxElement,'innerHTML',{get:()=>'',set:()=>{addedHeight=60;}});
  const pending=f.run('pfInboxLoad()');f.requests[0].resolve({...inbox,entries:[]});await pending;assert.equal(inner.scrollTop,50);assert.equal(outer.scrollTop,150);assert.equal(editor.getBoundingClientRect().top,200);assert.equal(f.context.window.scrollY,300);
});

const targetIds={inbox:'11111111-1111-4111-8111-111111111111',production:'22222222-2222-4222-8222-222222222222',version:'33333333-3333-4333-8333-333333333333',package:'44444444-4444-4444-8444-444444444444',entry:'928346a44dad18a8c0ed48f673d891698c5b8b8f0e2af7efb92706f1c7b409a2'};
const targetLink=fields=>'/?'+new URLSearchParams({tab:'workroom',section:'tools',tool:'publication',...fields});
function targetFixture(){const f=fixture();f.context.ids=targetIds;return f;}
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('publication links accept only exact local routes and reject external, mixed, duplicate and malformed targets',()=>{
  const f=targetFixture(),valid=[{publicationAction:'prepare',inboxId:targetIds.inbox},{publicationAction:'prepare',productionId:targetIds.production,versionId:targetIds.version},{publicationAction:'publish',packageId:targetIds.package},{publicationAction:'performance',entryId:targetIds.entry,checkpoint:'72h'}];
  for(const value of valid){f.context.href=targetLink(value);assert.ok(f.run('pfReadTarget(href)'));}
  const base=targetLink(valid[0]),invalid=['https://outside.test'+base,'//outside.test'+base,'http://user:pass@localhost:4191'+base,base+'#x',base+'&inboxId='+targetIds.inbox,base+'&packageId='+targetIds.package,base.replace('tools','clients'),base.replace(targetIds.inbox,'../../secret'),targetLink({publicationAction:'performance',entryId:targetIds.entry,checkpoint:'48h'})];
  for(const href of invalid){f.context.href=href;assert.equal(f.run('pfReadTarget(href)'),null,href);}
  assert.equal(f.requests.length,0);
});

test('actual SHA256 performance IDs open checkpoint links while UUID or malformed performance IDs are rejected',async()=>{
  const f=targetFixture(),targetEntry={...entry,id:targetIds.entry};
  for(const checkpoint of ['24h','72h']){f.context.href=targetLink({publicationAction:'performance',entryId:targetIds.entry,checkpoint});assert.equal(f.run('pfReadTarget(href).entryId'),targetIds.entry);}
  for(const entryId of [targetIds.package,targetIds.entry.slice(1),targetIds.entry+'a','g'.repeat(64)]){f.context.href=targetLink({publicationAction:'performance',entryId,checkpoint:'24h'});assert.equal(f.run('pfReadTarget(href)'),null);}
  f.context.href=targetLink({publicationAction:'performance',entryId:targetIds.entry,checkpoint:'24h'});const pending=f.run('openPublicationWorkflowLink(href)');assert.equal(f.requests[0].path,'/api/publication-workspace');f.requests[0].resolve({...f.context.initial,performance:{...f.context.initial.performance,entries:[targetEntry]}});await pending;assert.equal(f.run('pf.target.entryId'),targetIds.entry);assert.equal(f.run('pf.view'),'performance');f.context.targetEntry=targetEntry;assert.ok(f.run('pfCheckpoint(targetEntry,targetEntry.checkpoints[0],true)').includes('<details open>'));
});

test('today-work arrival links refresh access and reuse the existing draft confirmation without replacing authored text',async()=>{
  const f=targetFixture();f.run('pf.draft.body="작성 중인 내용"');f.context.href=targetLink({publicationAction:'prepare',inboxId:targetIds.inbox});const pending=f.run('openPublicationWorkflowLink(href)');
  assert.equal(f.requests[0].path,'/api/publication-workspace');f.requests[0].resolve({...f.context.initial,inbox:{...inbox,entries:[{...inbox.entries[0],id:targetIds.inbox}]}});await pending;
  assert.equal(f.requests.length,1);assert.equal(f.run('pf.inboxChoice'),targetIds.inbox);assert.equal(f.run('pf.draft.body'),'작성 중인 내용');assert.equal(f.context.location.searchParams.get('publicationAction'),'prepare');assert.match(f.inboxElement.innerHTML,/현재 초안 유지/);
});

test('source targets select the requested version instead of the latest file and missing versions preserve the draft',async()=>{
  const f=targetFixture();const pending=f.run('pfOpenTarget({action:"prepare",productionId:ids.production,versionId:ids.version})');f.requests[0].resolve({...f.context.initial,studio:{productions:[{id:targetIds.production}]}});await settle();
  assert.equal(f.requests[1].path,'/api/studio-productions/'+targetIds.production);f.requests[1].resolve({production:{id:targetIds.production,title:'선택한 완성본',canEdit:true,versions:[{id:targetIds.version,kind:'video',mediaId:'requested'},{id:'newest',kind:'video',mediaId:'latest'}]}});await pending;assert.equal(f.run('pf.draft.versionId'),targetIds.version);
  f.run('pf.draft.body="남길 원문"');const unavailable=f.run('pfOpenTarget({action:"prepare",productionId:ids.production,versionId:ids.version},true)');f.requests[2].resolve({...f.context.initial,studio:{productions:[{id:targetIds.production}]}});await settle();f.requests[3].resolve({production:{id:targetIds.production,canEdit:true,versions:[]}});await unavailable;assert.equal(f.run('pf.draft.body'),'남길 원문');assert.match(f.run('pf.targetError'),/영상 버전/);assert.equal(f.run('pf.target'),null);
});

test('unavailable and revoked targets show a clear error without using stale cached records',async()=>{
  const f=targetFixture();f.run('pf.data.packages.packages=[{id:ids.package,title:"오래된 자료"}];pf.draft.body="보존"');const pending=f.run('pfOpenTarget({action:"publish",packageId:ids.package})');f.requests[0].resolve(f.context.initial);await pending;assert.equal(f.run('pf.target'),null);assert.match(f.run('pf.targetError'),/권한/);assert.equal(f.run('pf.draft.body'),'보존');assert.ok(!f.run('publicationFlowPanel()').includes('오래된 자료'));
  f.context.state.user.role='viewer';const revoked=f.run('pfOpenTarget({action:"performance",entryId:ids.entry,checkpoint:"24h"})');f.requests[1].resolve(f.context.initial);await revoked;assert.match(f.run('pf.targetError'),/권한/);assert.equal(f.requests.length,2);
});

test('package targets keep an unfinished registration until confirmation and show the exact ZIP beside registration',async()=>{
  const f=targetFixture(),data={...f.context.initial,packages:{packages:[{id:targetIds.package,title:'오늘 게시할 묶음',outputs:[]}]}};f.run('pf.registration.url="https://youtube.com/watch?v=unfinished";pf.registration.title="내 기록"');const pending=f.run('pfOpenTarget({action:"publish",packageId:ids.package})');f.requests[0].resolve(data);await pending;
  assert.equal(f.run('pf.registration.title'),'내 기록');assert.equal(f.run('pf.targetChoice.packageId'),targetIds.package);assert.match(f.run('pfTargetChoicePanel()'),/작성 중인 내용 유지/);
  const confirmed=f.run('pfOpenTarget(pf.targetChoice,true)');f.requests[1].resolve(data);await confirmed;assert.equal(f.run('pf.registration.publicationPackageId'),targetIds.package);assert.equal(f.run('pf.registration.url'),'');const html=f.run('pfPerformancePanel()');assert.match(html,/오늘 할 일의 게시 묶음/);assert.ok(html.includes('/api/publication-packages/'+targetIds.package+'/download'));assert.match(html,/data-pf-form="register"/);
});

test('performance targets open only the requested checkpoint and preserve other unfinished metrics without collecting',async()=>{
  const f=targetFixture();f.run('pf.manual["another:24"]={metrics:{views:"8"},measuredAt:"",note:"아직 작성"}');const targetEntry={...entry,id:targetIds.entry,checkpoints:[entry.checkpoints[0],{...entry.checkpoints[0],hours:72}]},pending=f.run('pfOpenTarget({action:"performance",entryId:ids.entry,checkpoint:"72h"})');f.requests[0].resolve({...f.context.initial,performance:{...f.context.initial.performance,entries:[targetEntry]}});await pending;
  assert.equal(f.requests.length,1);assert.equal(f.run('pf.manual["another:24"].note'),'아직 작성');assert.equal(f.run('pf.view'),'performance');f.context.targetEntry=targetEntry;assert.ok(!f.run('pfCheckpoint(targetEntry,targetEntry.checkpoints[0],true)').includes('<details open>'));assert.ok(f.run('pfCheckpoint(targetEntry,targetEntry.checkpoints[1],true)').includes('<details open>'));assert.match(f.run('pf.status'),/72시간/);
});

test('late target responses cannot cross an account reset and direct links are applied only once',async()=>{
  const f=targetFixture(),pending=f.run('pfOpenTarget({action:"publish",packageId:ids.package})');f.context.state.user={id:'other',role:'member'};f.run('pfIdentity()');f.requests[0].resolve({...f.context.initial,packages:{packages:[{id:targetIds.package,title:'private'}]}});await pending;assert.equal(f.run('pf.data'),null);assert.equal(f.run('pf.target'),null);
  const fresh=targetFixture();fresh.context.location.href='http://localhost:4191'+targetLink({publicationAction:'publish',packageId:targetIds.package});fresh.run('publicationFlowEnsure();publicationFlowEnsure()');assert.equal(fresh.requests.length,1);fresh.requests[0].resolve({...fresh.context.initial,packages:{packages:[{id:targetIds.package,title:'묶음'}]}});await settle();fresh.run('publicationFlowEnsure()');assert.equal(fresh.requests.length,1);assert.equal(fresh.run('pf.registration.publicationPackageId'),targetIds.package);
});

test('publication format selection separates Shorts from regular video while channel changes preserve authored registration',async()=>{
  const f=targetFixture();f.run('pf.data.packages.packages=[{id:ids.package,title:"두 형식",outputs:[{channel:"youtube-shorts"},{channel:"youtube-video"},{channel:"instagram-reels"}]}];pf.data.performance.channels=[{id:"youtube",platform:"youtube"},{id:"instagram",platform:"instagram"}];Object.assign(pf.registration,{publicationPackageId:ids.package,channelId:"youtube",title:"입력한 제목",url:"https://youtube.com/watch?v=post",publishedAt:"2026-10-11T09:30"});pfSyncRegistrationFormat()');
  assert.equal(f.run('pf.registration.publicationFormat'),'');assert.match(f.run('pfRegistrationFormatField()'),/게시한 형식 선택/);await f.run('pfRegisterPost()');assert.equal(f.requests.length,0);assert.match(f.run('pf.error'),/영상 형식/);
  f.run('pf.registration.publicationFormat="youtube-video"');const pending=f.run('pfRegisterPost()');assert.equal(f.requests[0].body.publicationFormat,'youtube-video');f.requests[0].reject(new Error('다시 확인'));await pending;assert.equal(f.run('pf.registration.title'),'입력한 제목');
  f.run('pf.registration.channelId="instagram";pfSyncRegistrationFormat()');assert.equal(f.run('pf.registration.publicationFormat'),'instagram-reels');assert.equal(f.run('pf.registration.title'),'입력한 제목');f.run('pf.registration.publicationPackageId="";pfSyncRegistrationFormat()');assert.equal(f.run('pf.registration.publicationFormat'),'');
});

test('a publication task prefills its permitted format and cannot request an output missing from the package',async()=>{
  const f=targetFixture(),data={...f.context.initial,packages:{packages:[{id:targetIds.package,title:'형식별 할 일',channels:['youtube-shorts','youtube-video'],outputs:[{channel:'youtube-shorts'},{channel:'youtube-video'}]}]}};f.context.href=targetLink({publicationAction:'publish',packageId:targetIds.package,publicationFormat:'youtube-video'});assert.equal(f.run('pfReadTarget(href).publicationFormat'),'youtube-video');const pending=f.run('openPublicationWorkflowLink(href)');f.requests[0].resolve(data);await pending;
  assert.equal(f.run('pf.registration.publicationFormat'),'youtube-video');f.context.href=targetLink({publicationAction:'publish',packageId:targetIds.package,publicationFormat:'instagram-reels'});const missing=f.run('openPublicationWorkflowLink(href)');f.requests[1].resolve(data);await missing;assert.match(f.run('pf.targetError'),/영상 형식이 없어요/);assert.equal(f.run('pf.registration.publicationFormat'),'youtube-video');
  f.context.href=targetLink({publicationAction:'publish',packageId:targetIds.package,publicationFormat:'unknown'});assert.equal(f.run('pfReadTarget(href)'),null);
});

test('linking a format to an existing post reports the metadata update without claiming a new post or observation',async()=>{
  const f=targetFixture();f.run('Object.assign(pf.registration,{channelId:"channel",url:"https://youtube.com/watch?v=existing",publishedAt:"2026-10-11T09:30",publicationFormat:"youtube-shorts"})');const pending=f.run('pfRegisterPost()');f.requests[0].resolve({entry,existing:true,linked:true});await pending;assert.match(f.run('pf.status'),/기존 게시 기록에 영상 형식을 연결/);assert.match(f.run('pf.status'),/게시 시각과 수집 기록은 유지/);
});

test('company navigation accepts publication messages only from its authenticated messenger frame and clears target links on exit',async()=>{
  const listeners=new Map(),calls=[],source=readFileSync(new URL('./public/workspace.js',import.meta.url),'utf8'),location=new URL('http://localhost:4191'+targetLink({publicationAction:'publish',packageId:targetIds.package,publicationFormat:'youtube-shorts'})),frame={};
  const context=vm.createContext({URL,URLSearchParams,location,state:{user:{id:'member',role:'member'},tab:'workroom'},wr:{view:'tools'},makerTools:{view:'publication'},cp:{view:'plan'},window:{addEventListener(name,handler){listeners.set(name,handler);}},document:{addEventListener(){},getElementById(){return null;}},MutationObserver:class{observe(){}},history:{replaceState(_a,_b,value){location.href=new URL(value,location).href;}},openPublicationWorkflowLink(url){calls.push(url);return true;},notify(){}});
  vm.runInContext(source,context);context.frame=frame;vm.runInContext('workspaceModule.frame={contentWindow:frame}',context);const message=listeners.get('message'),data={type:'messenger:publication-open',url:location.href};
  message({origin:'https://outside.test',source:frame,data});message({origin:location.origin,source:{},data});assert.equal(calls.length,0);message({origin:location.origin,source:frame,data});assert.equal(calls.length,1);context.state.user=null;message({origin:location.origin,source:frame,data});assert.equal(calls.length,1);
  context.state.user={id:'member',role:'member'};vm.runInContext('syncWorkspaceLocation()',context);assert.equal(location.searchParams.get('publicationFormat'),'youtube-shorts');context.state.tab='messenger';vm.runInContext('syncWorkspaceLocation()',context);assert.equal(location.searchParams.has('publicationAction'),false);assert.equal(location.searchParams.has('publicationFormat'),false);assert.equal(location.searchParams.has('packageId'),false);
});
test('address lookup fills the platform time, title and format and registers the format without a package',async()=>{
  const f=fixture();f.run('pf.data.performance.lookupAvailable=true;Object.assign(pf.registration,{channelId:"channel",url:"https://youtube.com/shorts/abc"})');
  const pending=f.run('pfLookup()');const request=f.requests[0];assert.match(request.path,/^\/api\/post-performance\/lookup\?/);const query=new URL(request.path,'http://fixture.test').searchParams;assert.equal(query.get('channelId'),'channel');assert.equal(query.get('url'),'https://youtube.com/shorts/abc');assert.equal(request.body,undefined);
  request.resolve({platform:'youtube',externalId:'abc',publishedAt:'2026-10-18T07:13:00.000Z',suggestedFormat:'youtube-shorts',title:'플랫폼 제목',ownerMatch:true,existingEntryId:null,checkpoints:{24:{dueAt:'2026-10-19T07:13:00.000Z',missed:false},72:{dueAt:'2026-10-21T07:13:00.000Z',missed:false}}});await pending;
  assert.equal(f.run('pf.registration.publishedAt'),'2026-10-18T16:13');assert.equal(f.run('pf.registration.title'),'플랫폼 제목');assert.equal(f.run('pf.registration.publicationFormat'),'youtube-shorts');
  assert.deepEqual(JSON.parse(f.run('JSON.stringify(pfRegistrationFormats())')),['youtube-shorts','youtube-video']);
  const note=f.run('pfLookupNote()');assert.match(note,/확인했어요/);assert.match(note,/YouTube Shorts/);assert.match(note,/24시간 확인/);assert.match(note,/72시간 확인/);
  const field=f.run('pfRegistrationFormatField()');assert.match(field,/쇼츠와 일반 영상을 따로 비교/);assert.doesNotMatch(field,/묶음에 여러/);
  const saving=f.run('pfRegisterPost()');const register=f.requests[1];assert.equal(register.path,'/api/post-performance');assert.equal(register.body.publicationFormat,'youtube-shorts');assert.equal('publicationPackageId' in register.body,false);assert.equal(register.body.publishedAt,'2026-10-18T07:13:00.000Z');register.resolve({entry,publishedAtAdjusted:true});await saving;assert.equal(f.run('pf.lookup'),null);assert.match(f.run('pf.status'),/플랫폼에 나온 시각으로 맞췄어요/);
});
test('a post from another account blocks registration and stale lookups never fill the form',async()=>{
  const f=fixture();f.run('pf.data.performance.lookupAvailable=true;Object.assign(pf.registration,{channelId:"channel",url:"https://youtube.com/watch?v=other",publishedAt:"2026-10-18T10:00"})');
  const first=f.run('pfLookup()');f.requests[0].resolve({platform:'youtube',ownerMatch:false,reason:'다른 채널의 영상이에요.'});await first;
  assert.match(f.run('pfLookupNote()'),/이 계정에서 올린 게시물이 아니에요/);
  await f.run('pfRegisterPost()');assert.equal(f.requests.length,1);assert.match(f.run('pf.error'),/이 계정에서 올린 게시물이 아니에요/);
  f.run('pf.registration.url="https://youtube.com/watch?v=mine"');const second=f.run('pfLookup()');f.run('pf.registration.url="https://youtube.com/watch?v=changed"');f.requests[1].resolve({platform:'youtube',ownerMatch:true,publishedAt:'2026-10-18T01:00:00.000Z',title:'옛 응답',suggestedFormat:'youtube-video'});await second;
  assert.equal(f.run('pf.registration.title'),'');assert.equal(f.run('pf.registration.publishedAt'),'2026-10-18T10:00');assert.equal(f.run('pfLookupFor()'),null);
  f.run('pf.registration.url="https://youtube.com/watch?v=mine"');assert.equal(f.run('pfLookupFor()'),null);assert.equal(f.run('pfLookupBlocked()'),false);assert.equal(f.run('pfLookupNote()'),'');
});
test('until the server announces lookup the form stays manual, never calls it and never sends a format without a package',async()=>{
  const f=fixture();f.run('Object.assign(pf.registration,{channelId:"channel",url:"https://www.instagram.com/reel/CODE/",publishedAt:"2026-10-18T16:30",publicationFormat:"instagram-reels"})');
  await f.run('pfLookup()');f.handlers.get('change').forEach(handler=>handler({target:{dataset:{pfRegister:'url'},value:'https://www.instagram.com/reel/OTHER/',matches:()=>false}}));assert.equal(f.requests.length,0);
  const html=f.run('pfPerformancePanel()');assert.doesNotMatch(html,/data-pf-action="lookup"/);assert.match(html,/유튜브 스튜디오·인스타 게시 정보에 나온 시각/);assert.deepEqual(JSON.parse(f.run('JSON.stringify(pfRegistrationFormats())')),[]);
  const saving=f.run('pfRegisterPost()');assert.equal('publicationFormat' in f.requests[0].body,false);assert.equal(f.requests[0].body.publishedAt,'2026-10-18T07:30:00.000Z');f.requests[0].resolve({entry});await saving;
});
test('the register link opens the post-performance form directly',async()=>{
  const f=fixture();assert.deepEqual(JSON.parse(f.run('JSON.stringify(pfReadTarget("/?tab=workroom&section=tools&tool=publication&publicationAction=register"))')),{action:'register'});
  assert.equal(f.run('pfReadTarget("/?tab=workroom&section=tools&tool=publication&publicationAction=register&entryId=x")'),null);
  const opening=f.run('pfOpenTarget({action:"register"})');f.requests[0].resolve(f.run('structuredClone(initial)'));assert.equal(await opening,true);assert.equal(f.run('pf.view'),'performance');assert.equal(f.run('pf.target.action'),'register');assert.match(f.run('pf.status'),/게시한 계정과 주소, 게시 시각을 넣어 주세요/);
  const g=fixture();g.context.initial.performance.lookupAvailable=true;const again=g.run('pfOpenTarget({action:"register"})');g.requests[0].resolve(g.run('structuredClone(initial)'));assert.equal(await again,true);assert.match(g.run('pf.status'),/게시 시각과 형식을 확인해 채워요/);
});
test('lookups and account changes update the register form in place instead of repainting the page',async()=>{
  const f=fixture(),inputs={publishedAt:{value:'2026-10-18T10:00'},title:{value:''}},lookup={disabled:true},note={innerHTML:''},hint={textContent:''},inserted=[],submit={disabled:false,insertAdjacentHTML(position,html){inserted.push([position,html]);}},flush=()=>new Promise(resolve=>setImmediate(resolve)),change=(field,value)=>f.handlers.get('change').forEach(handler=>handler({target:{dataset:{pfRegister:field},value,matches:()=>false}}));let format=null;
  const form={querySelector(selector){const field=/data-pf-register="(\w+)"/.exec(selector)?.[1];if(field==='publicationFormat')return format&&{closest:()=>format};if(field)return inputs[field]||null;return {'[data-pf-action="lookup"]':lookup,'.pf-lookup-note':note,'[data-pf-register-hint]':hint,'button[type="submit"]':submit}[selector]||null;}},query=f.context.document.querySelector;
  f.context.document.querySelector=selector=>selector==='[data-pf-form="register"]'?form:query(selector);f.run('pf.data.performance.lookupAvailable=true;pf.data.performance.channels[0].platform="youtube";pf.registration.publishedAt="2026-10-18T10:00"');
  change('channelId','channel');assert.equal(f.requests.length,0);assert.equal(lookup.disabled,true);
  change('url','https://youtube.com/shorts/abc');assert.match(f.requests[0].path,/^\/api\/post-performance\/lookup\?/);assert.equal(lookup.disabled,false);assert.match(note.innerHTML,/확인하고 있어요/);
  f.requests[0].resolve({platform:'youtube',ownerMatch:true,publishedAt:'2026-10-18T07:13:00.000Z',title:'플랫폼 제목',suggestedFormat:'youtube-shorts'});await flush();
  assert.equal(lookup.disabled,false);assert.equal(inputs.publishedAt.value,'2026-10-18T16:13');assert.equal(inputs.title.value,'플랫폼 제목');assert.match(hint.textContent,/플랫폼에서 확인한/);assert.match(note.innerHTML,/확인했어요/);assert.equal(inserted.length,1);assert.equal(inserted[0][0],'beforebegin');assert.match(inserted[0][1],/data-pf-register="publicationFormat"/);assert.equal(submit.disabled,false);
  format={outerHTML:inserted[0][1]};change('url','https://youtube.com/watch?v=other');assert.equal(format.outerHTML,'');assert.match(hint.textContent,/저장할 때 플랫폼 시각으로 맞춰요/);assert.equal(inputs.title.value,'');assert.equal(inputs.publishedAt.value,'');
  f.requests[1].resolve({platform:'youtube',ownerMatch:false});await flush();assert.equal(submit.disabled,true);assert.match(note.innerHTML,/이 계정에서 올린 게시물이 아니에요/);
  assert.equal(f.renders,0);assert.equal(inserted.length,1);
});
test('unconfirmed results and lookup errors keep manual entry open and say why',async()=>{
  const f=fixture();f.run('pf.data.performance.lookupAvailable=true;Object.assign(pf.registration,{channelId:"channel",url:"https://youtube.com/watch?v=a",title:"내가 쓴 제목"})');
  let pending=f.run('pfLookup()');f.requests[0].resolve({platform:'threads',ownerMatch:null,publishedAt:null,reason:'스레드는 자동으로 확인할 수 없어요.'});await pending;
  assert.match(f.run('pfLookupNote()'),/스레드는 자동으로 확인할 수 없어요\. 게시 시각을 직접 넣어 주세요/);assert.equal(f.run('pfRegisterBlocked()'),false);
  pending=f.run('pfLookup()');f.requests[1].resolve({platform:'youtube',ownerMatch:true,publishedAt:null,title:'플랫폼 제목',suggestedFormat:'youtube-video',reason:'게시 시각을 읽지 못했어요.'});await pending;
  const note=f.run('pfLookupNote()');assert.match(note,/확인했어요/);assert.match(note,/게시 시각을 읽지 못했어요\. 채널 연결과 게시 주소를 확인/);assert.match(note,/플랫폼의 게시 시각을 확인해야 등록할 수 있어요/);assert.doesNotMatch(note,/게시 시각을 직접 넣어 주세요|role=/);assert.equal(f.run('pf.registration.title'),'내가 쓴 제목');assert.equal(f.run('pf.registration.publicationFormat'),'youtube-video');
  pending=f.run('pfLookup()');const denied=new Error('이 채널의 게시물을 확인할 권한이 없어요.');denied.status=403;f.requests[2].reject(denied);await pending;assert.match(f.run('pfLookupNote()'),/권한이 없어요/);assert.equal(f.run('pfRegisterBlocked()'),false);
  pending=f.run('pfLookup()');f.requests[3].reject(new TypeError('Failed to fetch'));await pending;assert.match(f.run('pfLookupNote()'),/게시 정보를 확인하지 못했어요/);assert.doesNotMatch(f.run('pfLookupNote()'),/Failed/);
});
test('YouTube and Instagram unknown lookup results explain verification instead of an unusable manual fallback',async()=>{
  for(const platform of ['youtube','instagram']){
    const f=fixture();f.context.platform=platform;f.run('pf.data.performance.lookupAvailable=true;pf.data.performance.channels[0].platform=platform;Object.assign(pf.registration,{channelId:"channel",url:"https://example.test/post"})');
    assert.match(f.run('pfPublishedHint()'),/저장할 때 플랫폼 시각으로 맞춰요/);assert.doesNotMatch(f.run('pfPublishedHint()'),/5분|직접 넣어/);
    const pending=f.run('pfLookup()');f.requests[0].resolve({platform,ownerMatch:null,publishedAt:null,reason:'연결을 확인해 주세요.'});await pending;
    assert.match(f.run('pfLookupNote()'),/채널 연결과 게시 주소를 확인한 뒤 다시 조회/);assert.match(f.run('pfLookupNote()'),/플랫폼의 게시 시각을 확인해야 등록할 수 있어요/);assert.doesNotMatch(f.run('pfLookupNote()'),/게시 시각을 직접 넣어 주세요/);assert.equal(f.run('pfRegisterBlocked()'),false);
  }
  const f=fixture();f.run('pf.data.performance.lookupAvailable=true;pf.data.performance.channels[0].platform="threads";pf.registration.channelId="channel"');assert.match(f.run('pfPublishedHint()'),/시각을 직접 넣어 주세요/);
});
test('a new address clears what the last lookup filled, keeps edits, and feed posts get no reels format',async()=>{
  const f=fixture();f.run('pf.data.performance.lookupAvailable=true;Object.assign(pf.registration,{channelId:"channel",url:"https://www.instagram.com/reel/REEL/"})');
  let pending=f.run('pfLookup()');f.requests[0].resolve({platform:'instagram',ownerMatch:true,publishedAt:'2026-10-18T07:30:00.000Z',title:'릴스',suggestedFormat:'instagram-reels'});await pending;
  assert.equal(f.run('pf.registration.publicationFormat'),'instagram-reels');assert.deepEqual(JSON.parse(f.run('JSON.stringify(pfRegistrationFormats())')),['instagram-reels']);assert.equal(f.run('pf.registration.publishedAt'),'2026-10-18T16:30');
  f.run('pf.registration.title="내가 고친 제목";pf.registration.url="https://www.instagram.com/p/FEED/"');pending=f.run('pfLookup()');
  assert.equal(f.run('pf.registration.title'),'내가 고친 제목');assert.equal(f.run('pf.registration.publishedAt'),'');assert.equal(f.run('pf.registration.publicationFormat'),'');
  f.requests[1].resolve({platform:'instagram',ownerMatch:true,publishedAt:null,title:null,suggestedFormat:null});await pending;
  assert.deepEqual(JSON.parse(f.run('JSON.stringify(pfRegistrationFormats())')),[]);assert.equal(f.run('pfRegistrationFormatField()'),'');
  f.run('pf.registration.publishedAt="2026-10-18T17:00"');const saving=f.run('pfRegisterPost()');const body=f.requests[2].body;assert.equal('publicationFormat' in body,false);assert.equal(body.title,'내가 고친 제목');assert.equal(body.url,'https://www.instagram.com/p/FEED/');f.requests[2].resolve({entry});await saving;assert.equal(f.run('pf.lookupFill'),null);
});
test('with a package selected the lookup leaves the package format alone',async()=>{
  const f=fixture();f.run('pf.data.performance.lookupAvailable=true;pf.data.performance.channels[0].platform="youtube";pf.data.packages.packages=[{id:"pkg",title:"묶음",outputs:[{channel:"youtube-shorts"}]}];Object.assign(pf.registration,{channelId:"channel",url:"https://youtube.com/watch?v=x",publicationPackageId:"pkg"});pfSyncRegistrationFormat()');
  assert.equal(f.run('pf.registration.publicationFormat'),'youtube-shorts');
  const pending=f.run('pfLookup()');f.requests[0].resolve({platform:'youtube',ownerMatch:true,publishedAt:'2026-10-18T07:00:00.000Z',suggestedFormat:'youtube-video'});await pending;
  assert.equal(f.run('pf.registration.publicationFormat'),'youtube-shorts');assert.deepEqual(JSON.parse(f.run('JSON.stringify(pfRegistrationFormats())')),['youtube-shorts']);assert.equal(f.run('pf.registration.publishedAt'),'2026-10-18T16:00');
});
test('a deep-link target keeps its focus through later full repaints until the person moves on',async()=>{
  const f=fixture(),flush=()=>new Promise(resolve=>setImmediate(resolve)),doc=f.context.document,query=doc.querySelector,select='pfFocusTarget(\'[data-pf-register="url"]\')';let scrolled=0;
  const make=()=>({focus(){doc.activeElement=this;},scrollIntoView(){scrolled++;},contains(node){return node===this;}}),fire=type=>f.handlers.get(type).forEach(handler=>handler({type})),repaint=async()=>{url=make();doc.activeElement=null;f.run('publicationFlowEnsure()');await flush();};
  let url=make();doc.querySelector=selector=>selector==='[data-pf-register="url"]'?url:query(selector);
  f.run(select);await flush();assert.equal(doc.activeElement,url);assert.equal(scrolled,1);
  await repaint();assert.equal(doc.activeElement,url);assert.equal(scrolled,2);
  f.run('publicationFlowEnsure()');await flush();assert.equal(scrolled,2);
  f.context.wr.loading=true;await repaint();assert.equal(doc.activeElement,null);f.context.wr.loading=false;f.run('publicationFlowEnsure()');await flush();assert.equal(doc.activeElement,url);
  f.context.overlay={children:{length:1}};await repaint();assert.equal(doc.activeElement,null);f.context.overlay={children:{length:0}};f.run('publicationFlowEnsure()');await flush();assert.equal(doc.activeElement,url);
  f.context.document.getElementById=id=>id==='main'?{getBoundingClientRect:()=>({top:0,bottom:900})}:null;f.context.window.innerHeight=900;const inView=scrolled;url=Object.assign(make(),{getBoundingClientRect:()=>({top:300,bottom:340,height:40})});doc.activeElement=null;f.run('publicationFlowEnsure()');await flush();assert.equal(doc.activeElement,url);assert.equal(scrolled,inView);
  for(const type of ['keydown','pointerdown','wheel','touchstart']){f.run(select);await flush();fire(type);assert.equal(f.run('pf.focusTarget'),null,type);}
  const released=scrolled;await repaint();assert.equal(doc.activeElement,null);assert.equal(scrolled,released);
  f.run(select);await flush();f.run('pf.focusTarget.until=0');await repaint();assert.equal(f.run('pf.focusTarget'),null);assert.equal(doc.activeElement,null);
  f.run(select);f.context.makerTools.view='weekly';await flush();assert.equal(f.run('pf.focusTarget'),null);
});
