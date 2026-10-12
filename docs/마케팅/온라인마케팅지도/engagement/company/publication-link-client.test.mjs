import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const packageId='11111111-1111-4111-8111-111111111111',otherId='22222222-2222-4222-8222-222222222222',entryId='a'.repeat(64),url='https://synk.im/material';
const check={kind:'package',id:packageId,url,status:'unchecked',label:'아직 확인하지 않음',detail:'저장된 자료 주소',checkedAt:null,httpStatus:null,finalUrl:null,canCheck:true,revision:0,nextCheckAt:null,cooldownUntil:null};
const checked={...check,status:'reachable',label:'HTTP 응답 확인',detail:'주소에서 응답을 받았습니다.',checkedAt:'2026-10-12T00:00:00.000Z',httpStatus:200,revision:1,nextCheckAt:'2026-10-12T06:00:00.000Z',cooldownUntil:'2026-10-12T00:01:00.000Z'};
const pack={id:packageId,title:'로컬 자료 연결',link:url,outputs:[],body:'본문',subtitleText:''},review={packageId,versionLabel:'완성본',isLatestVersion:true,canEdit:true,revision:0,manual:[{id:'link',label:'자료 링크',status:'pending',note:'',allowNotApplicable:false}],automatic:[],summary:{status:'pending',label:'직접 확인 필요'}};
const escape=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function fixture({kind='package'}={}){
  let clock=Date.parse('2026-10-12T00:00:00.000Z'),renders=0,timerId=0;const requests=[],timers=new Map(),handlers=new Map(),hosts=new Map(),location=new URL('http://localhost:64046/?tab=workroom&section=tools&tool=publication');
  const records={innerHTML:'',querySelector:()=>null,querySelectorAll:()=>[],contains:()=>false},reviewHost={innerHTML:'video remains',querySelector:selector=>selector==='[data-pf-review-records]'?records:selector==='video'?{}:null,querySelectorAll:()=>[]};
  function hostFor(key){if(!hosts.has(key))hosts.set(key,{innerHTML:'',writes:0,contains:node=>!!node?.insideLink,querySelector:()=>null,focus(){context.document.activeElement=this;this.focused=true;},scrollIntoView(){this.scrolled=true;}});return hosts.get(key);}
  class Now extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}}
  const context=vm.createContext({console,URL,URLSearchParams,Date:Now,Intl,structuredClone,escape,queueMicrotask,location,history:{replaceState(_a,_b,value){location.href=new URL(value,location).href;}},selectWorkspaceView(tab,section){context.state.tab=tab;context.wr.view=section;},state:{user:{id:'owner',role:'member'},tab:'workroom'},wr:{view:'tools',loading:false},makerTools:{view:'publication'},document:{visibilityState:'visible',activeElement:null,querySelector(selector){const match=selector.match(/^\[data-pf-link-host="(.+)"\]$/);if(match)return hosts.get(match[1])||null;if(selector==='[data-pf-review-host="'+packageId+'"]')return reviewHost;if(selector==='[data-pf-review-host="'+packageId+'"] video')return {};return null;},addEventListener(type,handler){if(!handlers.has(type))handlers.set(type,[]);handlers.get(type).push(handler);}},window:{scrollX:0,scrollY:200,scrollTo(x,y){this.scrollX=x;this.scrollY=y;},getComputedStyle:()=>({overflowY:'auto'}),getSelection:()=>({isCollapsed:true})},setTimeout(callback,delay){const id=++timerId;timers.set(id,{callback,delay});return id;},clearTimeout(id){timers.delete(id);},api(path,body){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});requests.push({path,body,resolve,reject});return promise;},render(){renders++;},notify(){}});
  vm.runInContext(readFileSync(new URL('./public/publication-flow.js',import.meta.url),'utf8'),context);const run=code=>vm.runInContext(code,context);context.packageId=packageId;context.otherId=otherId;context.entryId=entryId;context.pack=structuredClone(pack);context.review=structuredClone(review);context.initial={packages:{packages:[pack]},performance:{entries:[{id:entryId,url,title:'게시 기록',checkpoints:[]}],canWrite:true,channels:[]},studio:{productions:[]},catalog:{channels:[]},learning:{cards:[]}};run('pfIdentity();pf.data=structuredClone(initial);pf.attempted=true');
  if(kind==='package'){run('pf.view="prepare";pf.reviewPackageId=packageId;pf.reviewPackage=structuredClone(pack);pf.reviewData=structuredClone(review)');hostFor('package:'+packageId);}else{run('pf.view="performance"');hostFor('post:'+entryId);}run('pfLinkEnsure()');
  return {context,run,requests,timers,handlers,hosts,hostFor,reviewHost,records,get renders(){return renders;},advance(ms){clock+=ms;},fire(type){for(const handler of handlers.get(type)||[])handler({});}};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('an unchecked writable package reads its saved URL, checks without supplying any URL, then refreshes review evidence only',async()=>{
  const f=fixture();f.run('pf.reviewDrafts[packageId+":link"]={status:"pending",note:"직접 확인 중인 메모"}');const pending=f.run('pfLinkLoad("package",packageId)');assert.equal(f.requests[0].body,undefined);f.requests[0].resolve({check});await settle();assert.deepEqual(JSON.parse(JSON.stringify(f.requests[1].body)),{});assert.equal(f.requests[1].path,'/api/publication-links/package/'+packageId);f.requests[1].resolve({check:checked});await settle();assert.equal(f.requests[2].path,'/api/publication-packages/'+packageId+'/review');f.requests[2].resolve({review:{...review,automatic:[{id:'resource',label:'자료 링크 응답',status:'pass',detail:'HTTP 200',resolved:true}],revision:0}});assert.equal(await pending,true);assert.equal(f.run('pf.reviewData.manual[0].status'),'pending');assert.equal(f.run('pf.reviewDrafts[packageId+":link"].note'),'직접 확인 중인 메모');assert.equal(f.reviewHost.innerHTML,'video remains');assert.equal(f.renders,0);assert.match(f.hosts.get('package:'+packageId).innerHTML,/실제 게시·영상 재생·자료 다운로드 성공을 판단하지/);
});

test('fresh checks, server cooldowns, viewers and read-only sources never cause an external check',async()=>{
  for(const mode of ['fresh','cooldown','viewer','read-only']){const f=fixture();if(mode==='viewer')f.context.state.user.role='viewer';const value=mode==='fresh'?checked:mode==='cooldown'?{...check,cooldownUntil:checked.cooldownUntil}:mode==='read-only'?{...check,canCheck:false}:check;const pending=f.run('pfLinkLoad("package",packageId)');f.requests[0].resolve({check:value});await pending;assert.equal(f.requests.length,1,mode);assert.equal(f.run('pfLinkRecord("package",packageId).loaded'),true);}
});

test('no-link responses remain empty and do not trigger a request to any URL',async()=>{
  const f=fixture();f.run('pf.reviewPackage.link=""');const pending=f.run('pfLinkLoad("package",packageId)');f.requests[0].resolve({check:null});await pending;assert.equal(f.requests.length,1);assert.match(f.hosts.get('package:'+packageId).innerHTML,/접속을 확인할 링크가 없어요/);
});

test('a saved link error and blocked response remain distinct from successful publishing or manual review',async()=>{
  const f=fixture();const pending=f.run('pfLinkLoad("package",packageId)');f.requests[0].resolve({check:{...checked,status:'error',label:'접속 오류',detail:'HTTP 404',httpStatus:404}});await pending;assert.match(f.hosts.get('package:'+packageId).innerHTML,/접속 오류/);assert.equal(f.run('pf.reviewData.manual[0].status'),'pending');const next=f.run('pfLinkLoad("package",packageId)');f.requests[1].resolve({check:{...checked,status:'manual-required',label:'직접 확인 필요',detail:'로그인 후 확인해 주세요.',httpStatus:403}});await next;assert.match(f.hosts.get('package:'+packageId).innerHTML,/로그인 후 확인/);assert.ok(!f.hosts.get('package:'+packageId).innerHTML.includes('접속 오류'));
});

test('link updates preserve metric fields, review drafts, text selection and the existing video DOM',async()=>{
  const f=fixture({kind:'post'}),editor={value:'미저장 성과 근거',selectionStart:2,selectionEnd:4,closest:()=>true,parentElement:null,getBoundingClientRect:()=>({top:230})};f.context.document.activeElement=editor;f.run('pf.manual[entryId+":72"]={note:"미저장 성과 근거",metrics:{views:"0"}};pf.registration.title="미저장 제목"');const pending=f.run('pfLinkLoad("post",entryId)');f.requests[0].resolve({check:{...checked,kind:'post',id:entryId}});await pending;assert.equal(f.context.document.activeElement,editor);assert.equal(editor.selectionStart,2);assert.equal(editor.value,'미저장 성과 근거');assert.equal(f.run('pf.registration.title'),'미저장 제목');assert.equal(f.run('pf.manual[entryId+":72"].metrics.views'),'0');assert.equal(f.renders,0);
});

test('late responses after account reset, visibility loss, package change or source URL change are discarded',async()=>{
  for(const mode of ['account','hidden','package','url']){const f=fixture(),pending=f.run('pfLinkLoad("package",packageId)');if(mode==='account'){f.context.state.user={id:'other',role:'member'};f.run('pfIdentity()');}else if(mode==='hidden'){f.context.document.visibilityState='hidden';f.fire('visibilitychange');}else if(mode==='package'){f.run('pf.reviewPackageId=otherId;pfLinkStop(true)');}else f.run('pf.reviewPackage.link="https://synk.im/new"');f.requests[0].resolve({check:checked});assert.equal(await pending,false);assert.equal(f.requests.length,1);assert.ok(!f.hosts.get('package:'+packageId).innerHTML.includes('data-status="reachable"'));}
});

test('permission errors clear cached private URLs and offer reading again without silently approving',async()=>{
  const f=fixture();f.context.checked=checked;f.run('pfLinkRecord("package",packageId).check=checked;pfLinkRecord("package",packageId).loaded=true');const pending=f.run('pfLinkLoad("package",packageId,true)');f.requests[0].reject(Object.assign(new Error('링크 접근 권한을 확인해 주세요.'),{status:403}));await pending;assert.equal(f.run('pfLinkRecord("package",packageId).check'),null);assert.ok(!f.hosts.get('package:'+packageId).innerHTML.includes(url));assert.match(f.hosts.get('package:'+packageId).innerHTML,/권한/);assert.equal(f.run('pf.reviewData.manual[0].status'),'pending');
});

test('wrong-source responses and untrusted server prose cannot be turned into active markup or arbitrary requests',async()=>{
  const f=fixture(),pending=f.run('pfLinkLoad("package",packageId)');f.requests[0].resolve({check:{...checked,url:'https://elsewhere.test'}});await pending;assert.match(f.run('pfLinkRecord("package",packageId).error'),/현재 저장된 주소/);assert.equal(f.requests.length,1);f.context.malicious={...checked,label:'<script>bad</script>',detail:'<img src=x onerror=bad>',finalUrl:'javascript:bad()'};f.run('pfLinkRecord("package",packageId).check=malicious;pfLinkRecord("package",packageId).error=""');const html=f.run('pfLinkContents("package",packageId)');assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img'));assert.ok(!html.includes('javascript:'));assert.match(html,/&lt;script&gt;/);
});

test('changing a source URL drops its old result before the next asynchronous read',()=>{
  const f=fixture();f.context.checked=checked;f.run('Object.assign(pfLinkRecord("package",packageId),{check:checked,loaded:true});pf.reviewPackage.link="https://synk.im/new-material"');const html=f.run('pfLinkContents("package",packageId)');assert.ok(!html.includes(url));assert.ok(!html.includes('data-status="reachable"'));assert.equal(f.run('pfLinkRecord("package",packageId).loaded'),false);
});

test('review save controls cannot re-enable a link button during its server cooldown',()=>{
  const f=fixture(),button={dataset:{pfAction:'link-check',kind:'package',id:packageId},disabled:false};f.context.checked=checked;f.reviewHost.querySelectorAll=()=>[button];f.run('Object.assign(pfLinkRecord("package",packageId),{check:checked,loaded:true});pfReviewDisable()');assert.equal(button.disabled,true);f.advance(61000);f.run('pfReviewDisable()');assert.equal(button.disabled,false);f.run('pf.reviewBusy=true;pfReviewDisable()');assert.equal(button.disabled,true);
});

test('manual checks obey a newly returned cooldown and concurrent clicks share one read',async()=>{
  const f=fixture(),pending=f.run('pfLinkLoad("package",packageId,true)');assert.equal(await f.run('pfLinkLoad("package",packageId,true)'),false);f.requests[0].resolve({check:checked});await pending;assert.equal(f.requests.length,1);assert.match(f.hosts.get('package:'+packageId).innerHTML,/잠시 뒤 다시 확인/);f.advance(61000);f.run('pfLinkPaint("package",packageId)');assert.ok(!f.hosts.get('package:'+packageId).innerHTML.includes('잠시 뒤 다시 확인'));
});

test('due checks use nextCheckAt and refresh again while hidden views cancel all link timers',async()=>{
  const f=fixture({kind:'post'});f.context.checked={...checked,kind:'post',id:entryId};f.run('Object.assign(pfLinkRecord("post",entryId),{check:checked,loaded:true});pfLinkEnsure()');assert.equal([...f.timers.values()].some(row=>row.delay===60000),true);f.advance(6*3600000+1);const sweep=f.run('pfLinkSweep()');f.requests[0].resolve({check:f.context.checked});await settle();assert.deepEqual(JSON.parse(JSON.stringify(f.requests[1].body)),{});f.requests[1].resolve({check:{...f.context.checked,nextCheckAt:'2026-10-12T12:00:00.001Z',cooldownUntil:'2026-10-12T06:01:00.001Z'}});await sweep;f.context.document.visibilityState='hidden';f.fire('visibilitychange');assert.equal(f.run('pf.linkTimer'),null);
});

test('inactive posts omit link checks and stop requests until automatic collection resumes',async()=>{
  const f=fixture({kind:'post'});f.run('pfEntries()[0].active=false;pfLinkEnsure()');assert.equal(f.run('pf.linkTimer'),null);assert.ok(!f.run('pfEntryCard(pfEntries()[0],true)').includes('data-pf-link-host'));assert.equal(await f.run('pfLinkLoad("post",entryId)'),false);await f.run('pfLinkSweep()');assert.equal(f.requests.length,0);f.run('pfEntries()[0].active=true;pfLinkEnsure()');assert.equal(f.timers.get(f.run('pf.linkTimer')).delay,0);assert.ok(f.run('pfEntryCard(pfEntries()[0],true)').includes('data-pf-link-host'));const pending=f.run('pfLinkLoad("post",entryId)');f.requests[0].resolve({check:{...checked,kind:'post',id:entryId}});assert.equal(await pending,true);assert.equal(f.requests.length,1);
});

test('an outdated link task for an inactive post shows its current state without running a check',async()=>{
  const f=fixture({kind:'post'});f.context.initial.performance.entries[0].active=false;const pending=f.run('pfOpenTarget({action:"link",entryId})');f.requests[0].resolve(f.context.initial);assert.equal(await pending,false);assert.match(f.run('pf.targetError'),/자동 수집이 멈춰/);assert.equal(f.run('pf.target'),null);assert.equal(f.requests.length,1);
});

test('link targets require exactly a package UUID or post SHA256 and never permit mixed target fields',()=>{
  const f=fixture();for(const target of [{packageId},{entryId}]){f.context.href='/?'+new URLSearchParams({tab:'workroom',section:'tools',tool:'publication',publicationAction:'link',...target});assert.equal(f.run('pfReadTarget(href).action'),'link');for(const suffix of ['&checkpoint=72h','&packageId='+otherId,'&publicationFormat=youtube-shorts']){f.context.bad=f.context.href+suffix;assert.equal(f.run('pfReadTarget(bad)'),null);}}f.context.bad='/?'+new URLSearchParams({tab:'workroom',section:'tools',tool:'publication',publicationAction:'link',entryId:packageId});assert.equal(f.run('pfReadTarget(bad)'),null);
});

test('a post link target opens its source without changing registration or requesting collection',async()=>{
  const f=fixture({kind:'post'});f.run('pf.registration.title="저장 전 기록"');const pending=f.run('pfOpenTarget({action:"link",entryId})');f.requests[0].resolve(f.context.initial);await pending;assert.equal(f.run('pf.target.entryId'),entryId);assert.equal(f.run('pf.registration.title'),'저장 전 기록');assert.equal(f.run('pf.view'),'performance');assert.equal(f.requests.length,1);assert.equal(f.hosts.get('post:'+entryId).focused,true);
});

test('a package link target reads the exact review and package before focusing its link block',async()=>{
  const f=fixture();f.run('pf.draft.body="미저장 게시 초안";pf.registration.title="미저장 게시 기록"');const pending=f.run('pfOpenTarget({action:"link",packageId})');f.requests[0].resolve(f.context.initial);await settle();assert.equal(f.requests[1].path,'/api/publication-packages/'+packageId+'/review');assert.equal(f.requests[2].path,'/api/publication-packages/'+packageId);f.requests[1].resolve({review});f.requests[2].resolve({package:pack});assert.equal(await pending,true);assert.equal(f.run('pf.view'),'prepare');assert.equal(f.run('pf.reviewData.packageId'),packageId);assert.equal(f.run('pf.draft.body'),'미저장 게시 초안');assert.equal(f.run('pf.registration.title'),'미저장 게시 기록');assert.equal(f.hosts.get('package:'+packageId).focused,true);assert.equal(f.requests.length,3);
});

test('opening review from the ordinary package button schedules its initial link read after loading completes',async()=>{
  const f=fixture();const pending=f.run('pfReviewOpen(packageId,false)');f.requests[0].resolve({review});f.requests[1].resolve({package:pack});assert.equal(await pending,true);const scheduled=f.run('pf.linkTimer');assert.ok(scheduled!==null);assert.equal(f.timers.get(scheduled).delay,0);assert.equal(f.run('pf.reviewLoading'),false);
});

test('link target focus waits for workroom loading and does not repeat after it has been applied',async()=>{
  const f=fixture({kind:'post'});f.run('pf.target={action:"link",entryId};wr.loading=true;pfLinkTargetFocus()');await settle();assert.equal(f.hosts.get('post:'+entryId).focused,undefined);f.run('wr.loading=false;pfLinkTargetFocus()');await settle();assert.equal(f.hosts.get('post:'+entryId).focused,true);f.hosts.get('post:'+entryId).focused=false;f.run('pfLinkTargetFocus()');await settle();assert.equal(f.hosts.get('post:'+entryId).focused,false);
});
