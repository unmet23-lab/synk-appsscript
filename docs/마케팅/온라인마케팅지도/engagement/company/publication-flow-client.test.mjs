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
