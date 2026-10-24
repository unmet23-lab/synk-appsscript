import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const escape=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function fixture(){
  const handlers=new Map(),requests=[],notifications=[],elements=[],created=[],revoked=[],timers=new Map(),downloads=[];let renders=0,id=0,confirmed=true;
  class ImageFixture{constructor(){elements.push(this);this.naturalWidth=1080;this.naturalHeight=1920;}set src(value){this.source=value;}get src(){return this.source;}removeAttribute(){this.source='';}load(){}pause(){}}
  const context=vm.createContext({Intl,console,structuredClone,Blob,URL:class extends URL{static createObjectURL(blob){const url='blob:test-'+(++id);created.push({url,blob});return url;}static revokeObjectURL(url){revoked.push(url);}},Image:ImageFixture,
    state:{user:{id:'A',role:'member'},tab:'workroom'},window:{confirm(){return confirmed;}},document:{addEventListener(type,handler){handlers.set(type,handler);},querySelector(){return {textContent:'',matches(){return false;}};},body:{append(element){element.attached=true;}},createElement(type){if(type==='video'){const video=new ImageFixture();video.videoWidth=1080;video.videoHeight=1920;video.duration=30;return video;}return {click(){downloads.push({href:this.href,name:this.download,attached:this.attached});},remove(){this.attached=false;}};}},
    api(path,body){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});requests.push({path,body,resolve,reject});return promise;},render(){renders++;},notify:message=>notifications.push(message),escape,icon:name=>`<i>${name}</i>`,setTimeout(callback){const key=++id;timers.set(key,callback);return key;},clearTimeout(key){timers.delete(key);}
  });
  // 그리기 도우미(mt*)는 maker-tools.js 앞 절반 — 탭 파일보다 먼저 읽어 탭의 처리기가 덮이지 않게 한다. 머리 주석에도 같은 글자가 있어 줄 머리(줄바꿈 + //)로 찾는다.
  const kit=readFileSync(new URL('./public/maker-tools.js',import.meta.url),'utf8');vm.runInContext(kit.slice(0,kit.indexOf('\n// ── 상태와 화면 바꾸기')),context,{filename:'maker-tools.js'});
  for(const file of ['publish-rules.js','publish-check.js'])vm.runInContext(readFileSync(new URL('./public/'+file,import.meta.url),'utf8'),context,{filename:file});
  const evaluate=code=>vm.runInContext(code,context);evaluate('pcIdentity()');
  const data={records:[],review:[{id:'viewer',label:'왜 볼까요?'},{id:'source',label:'출처 확인'}],canWrite:true};context.data=data;evaluate('pc.data=data;pc.draft=pcNewDraft();pc.attempted=true;');
  return {context,evaluate,handlers,requests,notifications,elements,created,revoked,timers,downloads,get renders(){return renders;},set confirmed(value){confirmed=value;}};
}
const row=(extra={})=>({id:'record',ownerId:'A',revision:1,title:'기록 제목',preset:'youtube-shorts',media:null,audience:'',rights:'',measurement:'',checks:{viewer:{checked:false,note:''},source:{checked:false,note:''}},archived:false,checkCount:0,updatedAt:'2026-10-02T01:00:00Z',...extra});
const file=(extra={})=>({name:'작업.mp4',type:'video/mp4',size:10000,...extra});
const click=(action,id)=>({target:{closest:()=>({dataset:{publishAction:action,id},disabled:false})}});

test('official rules keep format boundaries separate from human quality and unmeasured bitrate',()=>{
  const f=fixture();f.context.media={kind:'video',name:'작업.mp4',bytes:500000000,width:540,height:960,duration:600};let rows=f.evaluate('publishRules.analyze(media,"tiktok-ad")');assert.equal(rows.find(row=>row.label==='파일 용량').status,'match');assert.equal(rows.find(row=>row.label==='재생 시간').status,'match');assert.equal(rows.find(row=>row.label==='영상 비트레이트').status,'unknown');
  f.context.media.bytes++;f.context.media.duration=600.001;rows=f.evaluate('publishRules.analyze(media,"tiktok-ad")');assert.equal(rows.find(row=>row.label==='파일 용량').status,'review');assert.equal(rows.find(row=>row.label==='재생 시간').status,'review');
  for(const dimensions of [[960,540],[640,640],[1080,1920]]){[f.context.media.width,f.context.media.height]=dimensions;assert.equal(f.evaluate('publishRules.analyze(media,"tiktok-ad").find(row=>row.label==="화면 비율·최소 해상도").status'),'match');}
  f.context.media.width=1080;f.context.media.height=1080;f.context.media.duration=180;assert.equal(f.evaluate('publishRules.analyze(media,"youtube-shorts").find(row=>row.label==="재생 시간").status'),'match');f.context.media.duration=180.01;assert.equal(f.evaluate('publishRules.analyze(media,"youtube-shorts").find(row=>row.label==="재생 시간").status'),'review');
  assert.equal(f.evaluate('publishRules.analyze(null,"vertical")[0].status'),'unknown');
});
test('editable record fields and all markup are escaped while filenames and raw files stay distinct',()=>{
  const f=fixture();f.context.record=row({title:'<script>bad</script>',rights:'<img onerror=bad>',media:{name:'<b>파일.mp4',kind:'video',width:1080,height:1920,duration:30,bytes:1000}});f.evaluate('pcSetDraft(record)');const html=f.evaluate('publishCheckPanel()');assert.ok(!html.includes('<script>bad'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('&lt;img onerror'));assert.match(html,/이 브라우저에서만 읽어요/);assert.match(html,/자동 점수가 아니에요/);assert.match(html,/규격 비교는 게시 승인을 대신하지 않아요/);assert.doesNotMatch(html,/습니다|합니다|입니다/);
});
test('save sends only the captured metadata and notes, ignores duplicate submission and keeps server result',async()=>{
  const f=fixture();f.evaluate('pc.draft.title="작업";pc.preview="blob:local-file";pc.dirty=true;');const saving=f.evaluate('pcSave({})');await f.evaluate('pcSave({})');assert.equal(f.requests.length,1);assert.equal(f.requests[0].path,'/api/creator-reviews');assert.ok(!JSON.stringify(f.requests[0].body).includes('blob:'));assert.ok(!Object.hasOwn(f.requests[0].body,'preview'));
  f.requests[0].resolve({record:row({title:'작업'})});await saving;assert.equal(f.evaluate('pc.draft.id'),'record');assert.equal(f.evaluate('pc.dirty'),false);assert.equal(f.evaluate('pc.saving'),false);assert.equal(f.notifications.length,1);
});
test('saving errors preserve local changes and old-account responses never populate a new account',async()=>{
  const f=fixture();f.evaluate('pc.draft.title="남길 변경";pc.dirty=true;');const failed=f.evaluate('pcSave({})');f.requests[0].reject(new Error('다른 창에서 변경'));await failed;assert.equal(f.evaluate('pc.draft.title'),'남길 변경');assert.equal(f.evaluate('pc.dirty'),true);assert.match(f.evaluate('pc.error'),/다른 창/);
  const stale=f.evaluate('pcSave({})');f.context.state.user={id:'B',role:'member'};f.evaluate('pcIdentity()');f.requests[1].resolve({record:row({title:'A의 비공개 기록'})});await stale;assert.equal(f.evaluate('pc.draft'),null);assert.equal(f.evaluate('pc.data'),null);assert.equal(f.notifications.length,0);
});
test('archive and restore use the latest revision and cannot run from a read-only workspace',async()=>{
  const f=fixture();f.context.record=row();f.evaluate('pc.data.records=[record];pcSetDraft(record)');const archiving=f.handlers.get('click')(click('archive'));assert.equal(f.requests[0].body.revision,1);assert.equal(f.requests[0].body.archived,true);f.requests[0].resolve({record:row({archived:true,revision:2})});await archiving;assert.equal(f.evaluate('pc.archived'),true);
  const restoring=f.handlers.get('click')(click('archive'));assert.equal(f.requests[1].body.revision,2);assert.equal(f.requests[1].body.archived,false);f.requests[1].resolve({record:row({revision:3})});await restoring;assert.equal(f.evaluate('pc.draft.revision'),3);f.evaluate('pc.data.canWrite=false');await f.handlers.get('click')(click('archive'));await f.evaluate('pcSave({})');assert.equal(f.requests.length,2);
});
test('refresh reloads the current record revision after explicit discard, rather than keeping a conflicting draft',async()=>{
  const f=fixture();f.context.record=row();f.evaluate('pc.data.records=[record];pcSetDraft(record);pc.draft.title="未保存";pc.dirty=true;');const refreshing=f.handlers.get('click')(click('refresh'));assert.equal(f.requests.filter(row=>row.path==='/api/creator-reviews').length,1);assert.equal(f.requests.filter(row=>row.path==='/api/publication-workflow').length,0,'게시 묶음 점검 줄은 10-24부터 부르지 않는다');f.requests[0].resolve({records:[row({title:'다른 창에서 보완',revision:2})],review:f.context.data.review,canWrite:true});await refreshing;assert.equal(f.evaluate('pc.draft.revision'),2);assert.equal(f.evaluate('pc.draft.title'),'다른 창에서 보완');assert.equal(f.evaluate('pc.dirty'),false);
});
test('ordinary loads preserve a dirty draft and new edits made during refresh cannot be discarded late',async()=>{
  const f=fixture();f.context.record=row();f.evaluate('pc.data.records=[record];pcSetDraft(record);pc.draft.title="남길 작성";pc.dirty=true');const loading=f.evaluate('pcLoad()');f.requests[0].resolve({records:[row({title:'서버 최신',revision:2})],review:f.context.data.review,canWrite:true});await loading;assert.equal(f.evaluate('pc.draft.title'),'남길 작성');assert.equal(f.evaluate('pc.dirty'),true);
  const refreshing=f.handlers.get('click')(click('refresh'));f.evaluate('pc.draft.title="조회 중 새로 입력";pcChanged()');f.requests[1].resolve({records:[row({title:'다른 창 최신',revision:3})],review:f.context.data.review,canWrite:true});await refreshing;assert.equal(f.evaluate('pc.draft.title'),'조회 중 새로 입력');assert.equal(f.evaluate('pc.data.records[0].revision'),3);
});
test('new and open respect an unsaved-changes refusal and release a previous preview after acceptance',async()=>{
  const f=fixture();f.context.record=row();f.evaluate('pc.data.records=[record];pc.dirty=true;pc.preview="blob:previous"');f.confirmed=false;await f.handlers.get('click')(click('open','record'));assert.equal(f.evaluate('pc.draft.id'),undefined);assert.equal(f.revoked.length,0);
  f.confirmed=true;await f.handlers.get('click')(click('open','record'));assert.equal(f.evaluate('pc.draft.id'),'record');assert.equal(f.revoked[0],'blob:previous');assert.equal(f.evaluate('pc.dirty'),false);
});
test('local video metadata produces descriptive fields without upload or inferred sound/bitrate',async()=>{
  const f=fixture();f.context.file=file();const reading=f.evaluate('pcReadFile(file)');const element=f.elements[0];assert.equal(element.preload,'metadata');element.onloadedmetadata();await reading;assert.equal(f.requests.length,0);assert.equal(f.evaluate('pc.draft.media.width'),1080);assert.equal(f.evaluate('pc.draft.media.duration'),30);assert.equal(f.evaluate('pc.preview'),'blob:test-1');assert.ok(!Object.hasOwn(f.evaluate('pc.draft.media'),'bitrate'));assert.equal(f.timers.size,0);
});
test('late metadata cannot replace another record or leak after logout and its blob URL is released',async()=>{
  const f=fixture();f.context.file=file();const reading=f.evaluate('pcReadFile(file)');const finish=f.elements[0].onloadedmetadata;f.context.record=row({id:'next'});f.evaluate('pcSetDraft(record)');finish();await reading;assert.equal(f.evaluate('pc.draft.id'),'next');assert.equal(f.evaluate('pc.draft.media'),null);assert.ok(f.revoked.includes('blob:test-1'));
  f.context.file=file();const late=f.evaluate('pcReadFile(file)');const done=f.elements[1].onloadedmetadata;f.context.state.user=null;f.evaluate('publishCheckReset()');done();await late;assert.equal(f.evaluate('pc.draft'),null);assert.equal(f.requests.length,0);assert.ok(f.revoked.includes('blob:test-3'));
});
test('cancel, replacement and clearing abort metadata immediately, release timer and clear video source',async()=>{
  const f=fixture();f.context.file=file();const first=f.evaluate('pcReadFile(file)');assert.equal(f.timers.size,1);f.evaluate('publishCheckReset()');assert.equal(f.timers.size,0);assert.equal(f.elements[0].source,'');assert.equal(f.revoked[0],'blob:test-1');await first;
  f.evaluate('pcIdentity();pc.data=data;pc.draft=pcNewDraft()');f.context.file=file();const second=f.evaluate('pcReadFile(file)');f.context.file=file({name:'대체.mp4'});const replacement=f.evaluate('pcReadFile(file)');assert.equal(f.elements[1].source,'');assert.equal(f.timers.size,1);await f.handlers.get('click')(click('clear-file'));assert.equal(f.timers.size,0);assert.equal(f.elements[2].source,'');await second;await replacement;assert.equal(f.evaluate('pc.draft.media'),null);assert.equal(f.evaluate('pc.reading'),false);assert.equal(f.evaluate('pc.error'),'');
});
test('unreadable or oversized files retain the prior stored metadata and do not leave active URLs',async()=>{
  const f=fixture();f.context.file=file({size:2147483649});await f.evaluate('pcReadFile(file)');assert.equal(f.created.length,0);assert.match(f.evaluate('pc.error'),/2 GB/);
  f.context.file=file();const reading=f.evaluate('pcReadFile(file)');f.elements[0].onerror();await reading;assert.equal(f.evaluate('pc.reading'),false);assert.equal(f.evaluate('pc.draft.media'),null);assert.equal(f.revoked.length,1);assert.equal(f.timers.size,0);
});
test('export downloads the saved version through an attached local anchor and releases the blob URL',async()=>{
  const f=fixture();f.context.record=row({title:'저장한 제목',audience:'저장한 대상'});f.evaluate('pc.data.records=[record];pcSetDraft(record);pc.draft.title="미저장 새 제목"');await f.handlers.get('click')(click('export'));assert.equal(f.requests.length,0);assert.equal(f.downloads[0].attached,true);assert.equal(f.downloads[0].name,'synk-publish-check.md');const content=await f.created[0].blob.text();assert.match(content,/저장한 제목/);assert.ok(!content.includes('미저장 새 제목'));assert.match(content,/게시 승인은 아니에요/);assert.doesNotMatch(content,/습니다|합니다|입니다/);for(const callback of f.timers.values())callback();assert.equal(f.revoked[0],f.created[0].url);
});
// 13판 A 데스크: 점검 기다림(게시 묶음) · 첫 줄 자동 열기 · 검은 알약 하나 · 보관 포함 · 휴대폰 목록 펼치기 · 읽기만 계정.
const workflow=(extra=[])=>({items:[{id:'publication:review:p1',kind:'publication_review',title:'AI 직원 셋에게 한 편씩',statusLabel:'점검 남음',status:'review',href:'/?tab=workroom&section=tools&tool=publication&publicationAction=review&packageId=5c7d2f1e-8a3b-4e6f-9d21-7b4c0a9e3f58',channelFormats:['youtube-shorts','instagram-reels']},...extra]});
const press=(dataset)=>({target:{closest:()=>({dataset,disabled:false})}});
const blackPills=html=>(html.match(/class="btn[^"]*\bprimary\b/g)||[]).length;
test('waiting packages come only from publication review rows, keep one black pill and disappear from the meter when the workflow cannot be read',async()=>{
  const f=fixture();f.context.record=row();f.evaluate('pc.data.records=[record];pcSetDraft(record)');
  const loading=f.evaluate('pcLoadWaiting()');assert.equal(f.requests[0].path,'/api/publication-workflow');f.requests[0].resolve(workflow([{id:'publication:publish:x',kind:'publication_publish',title:'다른 일'}]));await loading;
  assert.equal(f.evaluate('pc.waiting.length'),1);assert.deepEqual(JSON.parse(f.evaluate('JSON.stringify(publishCheckNavCount())')),{value:1,tone:'',label:'점검 기다림'});
  let html=f.evaluate('publishCheckPanel()');assert.match(html,/data-publish-action="package" data-href="\/\?tab=workroom&amp;section=tools&amp;tool=publication&amp;publicationAction=review&amp;packageId=5c7d2f1e/);assert.match(html,/점검 기다림/);assert.ok(!html.includes('다른 일'));
  assert.equal(blackPills(html),1);assert.match(html,/<button class="btn primary" type="submit"[^>]*>점검 기록 저장</);assert.match(html,/class="btn" data-publish-action="new"/);assert.doesNotMatch(html,/data-maker-tool="publication"/,'게시 묶음 탭은 10-24 간편판에서 뺐다');assert.doesNotMatch(html,/\sstyle=/);
  const failed=f.evaluate('pcLoadWaiting()');f.requests[1].reject(new Error('게시 할 일을 읽지 못했어요'));await failed;
  assert.equal(f.evaluate('pc.waiting'),null);assert.equal(f.evaluate('publishCheckNavCount()'),null);html=f.evaluate('publishCheckPanel()');assert.doesNotMatch(html,/점검 기다림/);assert.match(html,/저장한 기록/);
});
test('a late workflow response after an account switch never fills the new account and package rows open through the shared link opener',async()=>{
  const f=fixture();const stale=f.evaluate('pcLoadWaiting()');f.context.state.user={id:'B',role:'member'};f.evaluate('pcIdentity()');f.requests[0].resolve(workflow());await stale;assert.equal(f.evaluate('pc.waiting'),null);
  const opened=[];f.context.openPublicationWorkflowLink=async href=>{opened.push(href);return true;};f.evaluate('pc.data=data;pc.draft=pcNewDraft()');
  await f.handlers.get('click')(press({publishAction:'package',href:workflow().items[0].href}));assert.deepEqual(opened,[workflow().items[0].href]);
});
test('the first load opens the newest active record, archived records appear only with 보관 포함 and the new-check button turns primary when nothing is writable',async()=>{
  const f=fixture();f.evaluate('pc.data=null;pc.draft=null;pc.attempted=false');const loading=f.evaluate('pcLoad()');
  f.requests[0].resolve({records:[row({id:'old',title:'보관한 점검',archived:true,updatedAt:'2026-10-20T11:00:00Z'}),row({id:'live',title:'진행 중 점검'})],review:f.context.data.review,canWrite:true});await loading;
  assert.equal(f.evaluate('pc.draft.id'),'live');let html=f.evaluate('publishCheckPanel()');assert.ok(!html.includes('보관한 점검'));assert.match(html,/data-filter="all" aria-pressed="false">보관 포함 <b>2<\/b>/);
  await f.handlers.get('click')(press({publishAction:'filter',filter:'all'}));assert.equal(f.evaluate('pc.archived'),true);html=f.evaluate('publishCheckPanel()');assert.match(html,/보관한 점검/);
  await f.handlers.get('click')(press({publishAction:'open',id:'old'}));assert.equal(f.evaluate('pc.draft.id'),'old');html=f.evaluate('publishCheckPanel()');
  assert.equal(blackPills(html),1);assert.match(html,/class="btn primary" data-publish-action="new"/);assert.doesNotMatch(html,/type="submit"/);assert.match(html,/보관한 기록이에요/);
});
test('checks update the count in place without redrawing, the phone list opens and closes, and a read-only account without records gets no empty sheet',async()=>{
  const f=fixture();f.context.record=row();f.evaluate('pc.data.records=[record];pcSetDraft(record)');const renders=f.renders;
  f.evaluate('pc.draft.checks.viewer.checked=true;pcChanged("viewer")');assert.equal(f.renders,renders);assert.equal(f.evaluate('pc.dirty'),true);assert.match(f.evaluate('pcNow(pc.draft,true,2,1)'),/2칸 중 1칸 남았어요/);
  await f.handlers.get('click')(press({publishAction:'pick'}));assert.match(f.evaluate('publishCheckPanel()'),/class="mt-desk is-picking"/);
  await f.handlers.get('click')(press({publishAction:'open',id:'record'}));assert.equal(f.evaluate('pc.picking'),false);assert.equal(f.evaluate('pc.dirty'),true);
  const viewer=fixture();viewer.evaluate('pc.data={records:[],review:data.review,canWrite:false};pc.draft=pcFirstDraft(pc.data)');const html=viewer.evaluate('publishCheckPanel()');
  assert.equal(viewer.evaluate('pc.draft'),null);assert.match(html,/읽기만 할 수 있는 계정이라 새 점검을 만들 수 없어요/);assert.doesNotMatch(html,/data-publish-action="new"|type="submit"/);
});
// 아르곤 검수 뒤: 저장 뒤 복사본 · 다시 읽기가 읽기만 계정에 새 점검을 만들지 않음 · 늦은 점검 기다림은 배경 다시 그리기 · 없는 칸 키 · 근거 접기 기억.
test('after saving, edits stay in the sheet copy so the list and the export keep the saved record, and refresh never invents a sheet for read-only accounts',async()=>{
  const f=fixture();f.evaluate('pc.draft.title="저장할 제목";pc.dirty=true');const saving=f.evaluate('pcSave({})');f.requests[0].resolve({record:row({title:'저장할 제목'})});await saving;
  f.evaluate('pc.draft.title="저장 뒤 고친 제목";pc.draft.checks.viewer.checked=true');assert.equal(f.evaluate('pc.data.records[0].title'),'저장할 제목');assert.equal(f.evaluate('pc.data.records[0].checks.viewer.checked'),false);
  await f.handlers.get('click')(click('export'));const content=await f.created[0].blob.text();assert.match(content,/저장할 제목/);assert.ok(!content.includes('저장 뒤 고친 제목'));
  const viewer=fixture();viewer.evaluate('pc.data={records:[],review:data.review,canWrite:false};pc.draft=null');const refreshing=viewer.handlers.get('click')(click('refresh'));viewer.requests.find(request=>request.path==='/api/creator-reviews').resolve({records:[],review:viewer.context.data.review,canWrite:false});await refreshing;assert.equal(viewer.evaluate('pc.draft'),null);
  const writer=fixture();const again=writer.handlers.get('click')(click('refresh'));writer.requests.find(request=>request.path==='/api/creator-reviews').resolve({records:[row({id:'live'})],review:writer.context.data.review,canWrite:true});await again;assert.equal(writer.evaluate('pc.draft.id'),undefined);assert.equal(writer.evaluate('typeof pc.draft.checks'),'object');
});
test('late waiting rows redraw in the background, missing check keys do not break input, and note folds remember their state',async()=>{
  const f=fixture();let background=0;f.context.renderBackground=()=>{background++;};const renders=f.renders;const loading=f.evaluate('pcLoadWaiting()');f.requests[0].resolve(workflow());await loading;assert.equal(background,1);assert.equal(f.renders,renders);
  f.context.record=row({checks:{viewer:{checked:false,note:''}}});f.evaluate('pc.data.records=[record];pcSetDraft(record)');
  f.handlers.get('change')({target:{matches:selector=>selector==='[data-publish-check]',dataset:{publishCheck:'source'},checked:true}});assert.equal(f.evaluate('pc.draft.checks.source.checked'),true);
  f.handlers.get('input')({target:{matches:selector=>selector==='[data-publish-note]',dataset:{publishNote:'source'},value:'본 장면'}});assert.equal(f.evaluate('pc.draft.checks.source.note'),'본 장면');
  f.handlers.get('toggle')({target:{matches:()=>true,dataset:{publishFold:'note:viewer'},open:true}});assert.match(f.evaluate('publishCheckPanel()'),/data-publish-fold="note:viewer" open>/);
  assert.match(f.evaluate('pcNow(pc.draft,true,2,2)'),/2칸을 모두 봤어요/);assert.doesNotMatch(f.evaluate('pcNow(pc.draft,true,2,2)'),/is-poster|data-publish-action="checks"/);
});
