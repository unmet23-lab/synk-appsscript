import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const packageId='11111111-1111-4111-8111-111111111111',otherId='22222222-2222-4222-8222-222222222222';
const mediaId='33333333-3333-4333-8333-333333333333';
const pack={id:packageId,productionId:'44444444-4444-4444-8444-444444444444',versionId:'55555555-5555-4555-8555-555555555555',title:'카페 최종본',body:'확인할 게시문',link:'https://synk.im/learn',subtitleText:'1\n00:00:00,000 --> 00:00:01,000\n다시 말해 주세요.',source:{fileName:'final.mp4'},outputs:[{channel:'youtube-shorts',label:'YouTube Shorts',mediaId,fileName:'video.mp4',width:1080,height:1920,previewUrl:'https://untrusted.test/video.mp4'}]};
const item=(id,status='pending',extra={})=>({id,label:({video:'전체 화면',audio:'소리 전체 듣기',copy:'사실과 출처',rights:'사용권',subtitles:'자막',link:'자료 링크',technical:'기술 주의사항'})[id],detail:'이 묶음의 실제 결과를 확인하세요.',status,note:'',reviewerName:'',reviewedAt:null,allowNotApplicable:id==='audio',locked:false,...extra});
const review={packageId,productionId:pack.productionId,versionId:pack.versionId,versionLabel:'완성본 v2',latestVersionId:pack.versionId,isLatestVersion:true,revision:0,canEdit:true,invalidated:false,summary:{status:'pending',label:'직접 확인 대기',total:6,confirmedCount:0,pendingCount:6,needsWorkCount:0,notApplicableCount:0,automaticIssueCount:0},automatic:[{id:'format',label:'영상 규격',status:'pass',detail:'1080 × 1920',resolved:true,checkedAt:'2026-10-11T00:00:00.000Z'}],manual:['video','audio','copy','rights','subtitles','link'].map(id=>item(id))};
const escape=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function fixture({opened=true}={}){
  const requests=[],handlers=new Map(),timers=new Map(),notices=[];let rendered=0,timerId=0;
  const location=new URL('http://localhost:64046/?tab=workroom&section=tools&tool=publication'),hosts=new Map(),overviews=new Map();
  function hostFor(id){if(hosts.has(id))return hosts.get(id);const done={open:false},video={currentTime:4.5,paused:false},fields=[{disabled:false}],buttons=[{disabled:false}],records={innerHTML:'',contains:node=>!!node?.insideRecords,querySelector:selector=>selector==='[data-pf-review-done]'?done:null,querySelectorAll:()=>[],getBoundingClientRect:()=>({top:300}),parentElement:null,focus(){context.document.activeElement=this;}},host={innerHTML:'',records,done,video,fields,buttons,querySelector:selector=>selector==='[data-pf-review-records]'?records:selector==='video'?video:null,querySelectorAll:selector=>selector==='fieldset'?fields:selector==='[data-pf-action]'?buttons:[],scrollIntoView(){},focus(){context.document.activeElement=this;}};hosts.set(id,host);overviews.set(id,{hidden:false});return host;}
  const context=vm.createContext({console,URL,URLSearchParams,Date,Intl,structuredClone,escape,queueMicrotask,location,history:{replaceState(_a,_b,value){location.href=new URL(value,location).href;}},selectWorkspaceView(view,section){context.state.tab=view;context.wr.view=section;},state:{user:{id:'owner',role:'member'},tab:'workroom'},wr:{view:'tools'},makerTools:{view:'publication'},document:{visibilityState:'visible',activeElement:null,querySelector(selector){const match=selector.match(/^\[data-pf-(review-host|package-overview)="([0-9a-f-]+)"\]( video)?$/);return match?match[1]==='package-overview'?overviews.get(match[2]):match[3]?hostFor(match[2]).video:hostFor(match[2]):null;},addEventListener(type,callback){if(!handlers.has(type))handlers.set(type,[]);handlers.get(type).push(callback);}},window:{scrollX:0,scrollY:0,scrollTo(){},getComputedStyle:()=>({overflowY:'auto'}),getSelection:()=>({isCollapsed:true})},setTimeout(callback,delay){const id=++timerId;timers.set(id,{callback,delay});return id;},clearTimeout(id){timers.delete(id);},api(path,body){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});requests.push({path,body,resolve,reject});return promise;},render(){rendered++;},notify(message){notices.push(message);}});
  vm.runInContext(readFileSync(new URL('./public/publication-flow.js',import.meta.url),'utf8'),context);const run=code=>vm.runInContext(code,context);context.pack=structuredClone(pack);context.review=structuredClone(review);context.packageId=packageId;context.otherId=otherId;context.initial={packages:{packages:[pack]},studio:{productions:[]},catalog:{channels:[]},performance:{entries:[],channels:[]},learning:{cards:[]}};run('pfIdentity();pf.data=structuredClone(initial);pf.attempted=true');hostFor(packageId);hostFor(otherId);
  if(opened)run('pf.reviewPackageId=packageId;pf.reviewPackage=structuredClone(pack);pf.reviewData=structuredClone(review)');
  return {context,run,requests,handlers,timers,hosts,overviews,notices,get rendered(){return rendered;}};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('review opening reads the exact saved package and review, without creating any manual approval',async()=>{
  const f=fixture({opened:false}),pending=f.run('pfReviewOpen(packageId)');assert.deepEqual(f.requests.map(row=>row.path),['/api/publication-packages/'+packageId+'/review','/api/publication-packages/'+packageId]);assert.ok(f.requests.every(row=>row.body===undefined));f.requests[0].resolve({review});f.requests[1].resolve({package:pack});assert.equal(await pending,true);assert.equal(f.run('pf.reviewData.revision'),0);assert.equal(f.run('pf.reviewData.manual.filter(row=>row.status==="confirmed").length'),0);assert.equal(f.overviews.get(packageId).hidden,true);assert.match(f.hosts.get(packageId).innerHTML,/이 묶음의 최종 파일/);
});

test('final media and text come from the selected package and untrusted URLs and markup cannot execute',()=>{
  const f=fixture();let html=f.run('pfReviewMedia()');assert.match(html,new RegExp('/api/studio-media/'+mediaId));assert.ok(!html.includes('untrusted.test'));assert.match(html,/확인할 게시문/);assert.match(html,/다시 말해 주세요/);f.run('pf.reviewPackage.body="<script>bad</script>";pf.reviewPackage.subtitleText="<img src=x onerror=bad>";pf.reviewPackage.link="javascript:alert(1)"');html=f.run('pfReviewMedia()');assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img'));assert.ok(!html.includes('javascript:'));assert.match(html,/&lt;script&gt;/);
});

test('old version warning, exact-snapshot boundary and saved reviewer evidence are visible, with completed items collapsed',()=>{
  const f=fixture();f.run('pf.reviewData.isLatestVersion=false;pf.reviewData.manual[0]={...pf.reviewData.manual[0],status:"confirmed",reviewerName:"검토 담당",reviewedAt:"2026-10-11T00:00:00.000Z",note:"모든 장면 확인"}');const html=f.run('pfReviewRecords()');assert.match(html,/현재 최신 영상 버전이 아닌 이전 버전/);assert.match(html,/새 묶음을 만들면 이전 확인은 승계되지/);assert.match(html,/검토 담당/);assert.match(html,/모든 장면 확인/);assert.match(html,/<details class="pf-review-done" data-pf-review-done>/);assert.ok(html.indexOf('data-pf-review-check="audio"')<html.indexOf('data-pf-review-check="video"'));
});

test('a saved check updates only review records and preserves the playing video and other unfinished notes',async()=>{
  const f=fixture(),host=f.hosts.get(packageId);f.run('pfReviewDraft("video").status="confirmed";pfReviewDraft("video").note="끝까지 재생 확인";pfReviewDraft("rights").note="아직 확인하는 사용권"');host.innerHTML='original video DOM';const pending=f.run('pfReviewSave("video")');await f.run('pfReviewSave("video")');assert.equal(f.requests.length,1);assert.deepEqual(JSON.parse(JSON.stringify(f.requests[0].body)),{revision:0,checkId:'video',status:'confirmed',note:'끝까지 재생 확인'});assert.equal(host.fields[0].disabled,true);f.requests[0].resolve({review:{...review,revision:1,manual:review.manual.map(row=>row.id==='video'?{...row,status:'confirmed',note:'끝까지 재생 확인',reviewerName:'검토자',reviewedAt:'2026-10-11T00:00:00.000Z'}:row)}});assert.equal(await pending,true);assert.equal(host.innerHTML,'original video DOM');assert.equal(host.video.currentTime,4.5);assert.equal(host.video.paused,false);assert.equal(f.rendered,0);assert.equal(f.run('pf.reviewDrafts[packageId+":video"]'),undefined);assert.equal(f.run('pf.reviewDrafts[packageId+":rights"].note'),'아직 확인하는 사용권');assert.equal(host.fields[0].disabled,false);assert.match(host.records.innerHTML,/확인 기록을 저장/);
});

test('needs-work, technical confirmation and silent-audio exceptions require a note before sending',async()=>{
  const f=fixture();f.run('pf.reviewData.manual.push({id:"technical",label:"기술 주의사항",status:"pending",allowNotApplicable:false})');for(const [id,status]of [['video','needs-work'],['technical','confirmed'],['audio','not-applicable']]){f.context.checkId=id;f.context.nextStatus=status;f.run('pfReviewDraft(checkId).status=nextStatus');assert.equal(await f.run('pfReviewSave(checkId)'),false);assert.match(f.run('pf.reviewError'),/메모/);}assert.equal(f.requests.length,0);
});

test('viewer, revoked edit access, locked fields and disallowed not-applicable values cannot save',async()=>{
  const f=fixture();f.context.state.user.role='viewer';await f.run('pfReviewSave("video")');assert.ok(!f.run('pfReviewRecords()').includes('data-pf-form="review"'));f.context.state.user.role='member';f.run('pf.reviewData.canEdit=false');await f.run('pfReviewSave("video")');f.run('pf.reviewData.canEdit=true;pf.reviewData.manual[0].locked=true');await f.run('pfReviewSave("video")');f.run('pf.reviewData.manual[0].locked=false;pfReviewDraft("video").status="not-applicable"');await f.run('pfReviewSave("video")');assert.equal(f.requests.length,0);assert.match(f.run('pf.reviewError'),/선택할 수 있는 상태/);
});

test('revision conflicts load the current record, retain authored notes, and retry with the new revision',async()=>{
  const f=fixture();f.run('pfReviewDraft("copy").status="confirmed";pfReviewDraft("copy").note="내가 확인한 출처"');const pending=f.run('pfReviewSave("copy")');f.requests[0].reject(Object.assign(new Error('다른 변경'),{status:409}));await settle();assert.equal(f.requests[1].body,undefined);f.requests[1].resolve({review:{...review,revision:4,manual:review.manual.map(row=>row.id==='rights'?{...row,status:'confirmed',note:'동료의 근거'}:row)}});await pending;assert.equal(f.run('pf.reviewData.revision'),4);assert.equal(f.run('pf.reviewDrafts[packageId+":copy"].note'),'내가 확인한 출처');assert.match(f.run('pf.reviewError'),/저장하지 못했어요/);assert.match(f.hosts.get(packageId).records.innerHTML,/동료의 근거/);const retry=f.run('pfReviewSave("copy")');assert.equal(f.requests[2].body.revision,4);f.requests[2].resolve({review:{...review,revision:5}});assert.equal(await retry,true);
});

test('permission failures remove the private media and saved notes from the review panel',async()=>{
  const f=fixture();f.run('pfReviewDraft("copy").status="confirmed"');const pending=f.run('pfReviewSave("copy")');f.requests[0].reject(Object.assign(new Error('접근 권한이 없습니다.'),{status:403}));await pending;assert.equal(f.run('pf.reviewData'),null);assert.equal(f.run('pf.reviewPackage'),null);const html=f.hosts.get(packageId).innerHTML;assert.match(html,/접근 권한이 없습니다/);assert.ok(!html.includes(pack.body));assert.ok(!html.includes('/api/studio-media/'));
});

test('late review responses cannot cross logout, a different package, or a closed panel',async()=>{
  for(const mode of ['logout','switch','close']){const f=fixture({opened:false}),pending=f.run('pfReviewOpen(packageId,false)');if(mode==='logout'){f.context.state.user=null;f.run('publicationFlowReset()');}else if(mode==='switch'){const second=f.run('pfReviewOpen(otherId,false)');f.requests[2].resolve({review:{...review,packageId:otherId,revision:0}});f.requests[3].resolve({package:{...pack,id:otherId}});await second;}else f.run('pfReviewClose()');f.requests[0].resolve({review});f.requests[1].resolve({package:pack});await pending;assert.ok(f.run('pf.reviewPackageId')!==packageId);if(mode==='switch')assert.equal(f.run('pf.reviewData.packageId'),otherId);else assert.equal(f.run('pf.reviewData'),null);}
});

test('a fresh package starts with its own pending checks and never inherits another package draft',async()=>{
  const f=fixture();f.run('pfReviewDraft("video").status="confirmed";pfReviewDraft("video").note="이전 묶음만 확인"');const pending=f.run('pfReviewOpen(otherId,false)');f.requests[0].resolve({review:{...review,packageId:otherId}});f.requests[1].resolve({package:{...pack,id:otherId,title:'수정한 새 묶음'}});await pending;assert.equal(f.run('pfReviewDraft("video").status'),'pending');assert.equal(f.run('pfReviewDraft("video").note'),'');assert.equal(f.run('pf.reviewDrafts[packageId+":video"].note'),'이전 묶음만 확인');assert.ok(!f.hosts.get(otherId).innerHTML.includes('이전 묶음만 확인'));
});

test('review deep links accept an exact package and open it without replacing a prepared publication draft',async()=>{
  const f=fixture({opened:false});f.context.href='/?tab=workroom&section=tools&tool=publication&publicationAction=review&packageId='+packageId;assert.equal(f.run('pfReadTarget(href).action'),'review');for(const suffix of ['&publicationFormat=youtube-shorts','&entryId='+'a'.repeat(64),'&packageId='+otherId]){f.context.bad=f.context.href+suffix;assert.equal(f.run('pfReadTarget(bad)'),null);}f.run('pf.draft.body="작성 중인 게시문"');const pending=f.run('openPublicationWorkflowLink(href)');f.requests[0].resolve(f.context.initial);await settle();assert.equal(f.requests[1].path,'/api/publication-packages/'+packageId+'/review');f.requests[1].resolve({review});f.requests[2].resolve({package:pack});assert.equal(await pending,true);assert.equal(f.run('pf.draft.body'),'작성 중인 게시문');assert.equal(f.run('pf.view'),'prepare');assert.equal(f.run('pf.reviewPackageId'),packageId);assert.ok(f.requests.every(row=>row.body===undefined));
});

test('mismatched package responses are rejected without displaying another package content',async()=>{
  const f=fixture({opened:false}),pending=f.run('pfReviewOpen(packageId,false)');f.requests[0].resolve({review:{...review,packageId:otherId}});f.requests[1].resolve({package:{...pack,id:otherId,title:'다른 개인 자료'}});assert.equal(await pending,false);assert.equal(f.run('pf.reviewData'),null);assert.ok(!f.hosts.get(packageId).innerHTML.includes('다른 개인 자료'));assert.match(f.run('pf.reviewError'),/점검 정보를 확인할 수 없어요/);
});

test('navigation to another review waits for the current check save and never labels the old package as the new target',async()=>{
  const f=fixture();f.run('pfReviewDraft("video").status="confirmed"');const saving=f.run('pfReviewSave("video")');f.context.href='/?tab=workroom&section=tools&tool=publication&publicationAction=review&packageId='+otherId;assert.equal(await f.run('openPublicationWorkflowLink(href)'),false);assert.equal(await f.run('pfOpenTarget({action:"review",packageId:otherId})'),false);assert.equal(f.requests.length,1);assert.equal(f.run('pf.reviewPackageId'),packageId);assert.equal(f.run('pf.target'),null);assert.match(f.notices[0],/진행 중인 저장/);f.requests[0].resolve({review:{...review,revision:1}});await saving;assert.equal(f.run('pf.reviewData.packageId'),packageId);
});

test('opening review pauses a hidden overview preview once while saving preserves the review player',()=>{
  const f=fixture(),overview=f.overviews.get(packageId);let paused=0;overview.querySelectorAll=()=>[{pause(){paused++;}}];f.run('pfReviewPaint()');assert.equal(paused,1);assert.equal(overview.hidden,true);f.run('pfReviewPaint()');assert.equal(paused,1);assert.equal(f.hosts.get(packageId).video.paused,false);assert.equal(f.hosts.get(packageId).video.currentTime,4.5);
});

test('automatic warnings stay separate from confirmed checks and cannot become approval through rendering',()=>{
  const f=fixture();f.run('pf.reviewData.automatic.push({id:"warning",label:"소리 검사",status:"warn",detail:"소리를 직접 확인",resolved:false});pf.reviewData.manual.push({id:"technical",label:"기술 주의사항",status:"pending"})');const html=f.run('pfReviewRecords()');assert.match(html,/자동 검사에서 확인할 점 1/);assert.match(html,/소리를 직접 확인/);assert.equal(f.run('pf.reviewData.manual.filter(row=>row.status==="confirmed").length'),0);assert.equal(f.requests.length,0);
});

test('automated placeholders for human review remain folded while unresolved technical warnings stay prominent',()=>{
  const f=fixture();f.run('pf.reviewData.automatic.push({id:"manual-video",label:"최종 시청과 사용권",status:"unknown",detail:"직접 확인",resolved:false,manualCheckIds:["video","rights"]},{id:"technical",label:"영상 기술 주의사항",status:"warn",detail:"화면 비율 확인",resolved:false,manualCheckIds:["technical"]},{id:"no-link",label:"자료 링크",status:"unknown",detail:"자료 링크 없음",resolved:true,manualCheckIds:["link"]})');const html=f.run('pfReviewRecords()');assert.match(html,/자동 검사에서 확인할 점 1/);assert.match(html,/확인·해당 없음 0 · 기술 검사 근거 3/);assert.ok(!html.includes('자동 확인 3'));assert.ok(html.indexOf('영상 기술 주의사항')<html.indexOf('data-pf-review-done'));assert.ok(html.indexOf('최종 시청과 사용권')>html.indexOf('data-pf-review-done'));assert.equal(f.requests.length,0);
});
