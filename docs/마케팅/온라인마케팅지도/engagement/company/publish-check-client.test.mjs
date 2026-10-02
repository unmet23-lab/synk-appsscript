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
  const f=fixture();f.context.record=row({title:'<script>bad</script>',rights:'<img onerror=bad>',media:{name:'<b>파일.mp4',kind:'video',width:1080,height:1920,duration:30,bytes:1000}});f.evaluate('pcSetDraft(record)');const html=f.evaluate('publishCheckPanel()');assert.ok(!html.includes('<script>bad'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('&lt;img onerror'));assert.match(html,/이 브라우저에서 읽습니다/);assert.match(html,/자동 품질 점수가 아닙니다/);
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
  const f=fixture();f.context.record=row();f.evaluate('pc.data.records=[record];pcSetDraft(record);pc.draft.title="未保存";pc.dirty=true;');const refreshing=f.handlers.get('click')(click('refresh'));assert.equal(f.requests.length,1);f.requests[0].resolve({records:[row({title:'다른 창에서 보완',revision:2})],review:f.context.data.review,canWrite:true});await refreshing;assert.equal(f.evaluate('pc.draft.revision'),2);assert.equal(f.evaluate('pc.draft.title'),'다른 창에서 보완');assert.equal(f.evaluate('pc.dirty'),false);
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
  const f=fixture();f.context.record=row({title:'저장한 제목',audience:'저장한 대상'});f.evaluate('pc.data.records=[record];pcSetDraft(record);pc.draft.title="미저장 새 제목"');await f.handlers.get('click')(click('export'));assert.equal(f.requests.length,0);assert.equal(f.downloads[0].attached,true);assert.equal(f.downloads[0].name,'synk-publish-check.md');const content=await f.created[0].blob.text();assert.match(content,/저장한 제목/);assert.ok(!content.includes('미저장 새 제목'));assert.match(content,/게시 승인이 아닙니다/);for(const callback of f.timers.values())callback();assert.equal(f.revoked[0],f.created[0].url);
});
