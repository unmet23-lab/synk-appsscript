import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('./public/social-workspace.js',import.meta.url),'utf8');
const css=readFileSync(new URL('./public/social-workspace.css',import.meta.url),'utf8');
function fixture(){
  const requests=[],handlers=new Map(),uploads=[];let renders=0;
  const preview={innerHTML:''};
  class FakeFormData{constructor(form){this.values=form.values||{};}*[Symbol.iterator](){for(const [key,value]of Object.entries(this.values)){if(Array.isArray(value)){for(const v of value)yield[key,v];}else yield[key,value];}}getAll(key){return this.values[key]===undefined?[]:Array.isArray(this.values[key])?this.values[key]:[this.values[key]];}has(key){return this.values[key]!==undefined;}}
  class Upload{constructor(){this.upload={};this.headers={};uploads.push(this);}open(method,url){this.method=method;this.url=url;}setRequestHeader(k,v){this.headers[k]=v;}send(file){this.file=file;}abort(){this.aborted=true;this.onabort?.();}}
  const location=new URL('https://workspace.test/?tab=social');
  const context=vm.createContext({console,URL,Date,Intl,FormData:FakeFormData,XMLHttpRequest:Upload,crypto:{randomUUID:()=> 'import-key'},location,history:{replaceState(_a,_b,value){location.href=new URL(value,location).href;}},state:{user:{id:'u',role:'admin',teamId:'team'},csrf:'csrf',tab:'social'},document:{querySelector(selector){return selector==='[data-sw-preview-host]'?preview:null;},addEventListener(kind,handler){const list=handlers.get(kind)||[];list.push(handler);handlers.set(kind,list);}},window:{addEventListener(kind,handler){handlers.set(kind,[handler]);}},api(path,body){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});requests.push({path,body,resolve,reject});return promise;},render(){renders++;}});
  vm.runInContext(source,context);const run=text=>vm.runInContext(text,context);
  context.initial={canWrite:true,posts:[],jobs:[],channels:[{id:'ch',name:'LAB Instagram',platform:'instagram',canEdit:true,canPublish:true,capability:{mode:'automatic',canPublish:true,maxTextLength:2200,formats:['post','reel'],options:[]}}],settings:{globalPaused:false,canPauseGlobal:true,brands:[],channels:[]},slots:[],rules:[],accounts:[],campaigns:[],inbox:[],assets:[],clientSources:[],members:[{id:'u',name:'사용자'}],provider:{configured:false,integrations:[]},insights:{campaigns:[],records:[],weekly:{published:0,attention:0},recommendations:[],metricDefinitions:[]}};
  run('snswIdentity();socialWorkspaceState.data=JSON.parse(JSON.stringify(initial));socialWorkspaceState.attempted=true');
  return {run,context,requests,handlers,uploads,preview,get renders(){return renders;}};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('inquiry deep links select only currently readable source and return to the complete list',async()=>{
  const f=fixture();f.context.location.href='https://workspace.test/?tab=social&section=inbox&inboxId=target';
  f.run('socialWorkspaceReset();snswIdentity();socialWorkspaceState.data=initial;socialWorkspaceState.data.inbox=[{id:"target",text:"연결한 문의",channelId:"ch"},{id:"other",text:"다른 문의",channelId:"ch"}]');
  assert.equal(f.run('socialWorkspaceState.view'),'inbox');assert.equal(f.run('socialWorkspaceState.inboxId'),'target');
  const selected=f.run('snswInbox()');assert.match(selected,/연결한 문의/);assert.ok(!selected.includes('다른 문의'));assert.match(selected,/data-sw-inbox-selected/);
  f.run('socialWorkspaceState.data.inbox=initial.inbox.filter(i=>i.id!=="target")');
  const inaccessible=f.run('snswInbox()');assert.match(inaccessible,/연결된 문의를 볼 수 없어요/);assert.ok(!inaccessible.includes('다른 문의'));
  await f.run('snswAction("inbox-all","")');assert.equal(f.run('socialWorkspaceState.inboxId'),'');assert.equal(f.context.location.searchParams.has('inboxId'),false);assert.match(f.run('snswInbox()'),/다른 문의/);
});
test('the linked inquiry receives focus once after loading and ordinary navigation clears the filter',async()=>{
  const f=fixture();let focused=0,scrolled=0;f.context.document.querySelector=selector=>selector==='[data-sw-inbox-selected]'?{focus(){focused++;},scrollIntoView(){scrolled++;}}:null;
  f.run('socialWorkspaceState.view="inbox";socialWorkspaceState.inboxId="i";socialWorkspaceState.inboxFocusPending=true;socialWorkspaceState.loading=true;snswRender()');assert.equal(focused,0);
  f.run('socialWorkspaceState.loading=false;snswRender();snswRender()');assert.equal(focused,1);assert.equal(scrolled,1);
  await f.run('snswAction("view","inbox")');assert.equal(f.run('socialWorkspaceState.inboxId'),'');
});
test('follow-up typing survives immediate rerender without blur and permissions hide obsolete form',()=>{
  const f=fixture();f.run('socialWorkspaceState.data.inbox=[{id:"i",revision:1,canEdit:true}];socialWorkspaceState.data.followups={items:[{inboxId:"i",canCreate:true}]};socialWorkspaceState.forms["followup:i"]={revision:1};socialWorkspaceState.forms["followup-options:i"]={targets:[{id:"r",name:"대화방",assignees:[{id:"u",name:"사용자"}]}]}');
  const form={dataset:{swForm:'followup',id:'i',revision:'1'},values:{roomId:'r',assigneeId:'u',dueDate:'2026-10-15',nextAction:'아직 포커스를 옮기지 않은 입력'}};
  const target={dataset:{},hasAttribute:()=>false,closest:()=>form};for(const handler of f.handlers.get('input'))handler({target});
  assert.equal(f.run('socialWorkspaceState.forms["followup:i"].nextAction'),form.values.nextAction);assert.match(f.run('snswFollowupPanel(socialWorkspaceState.data.inbox[0])'),/아직 포커스를 옮기지 않은 입력/);
  f.run('socialWorkspaceState.data.inbox[0].canEdit=false');assert.ok(!f.run('snswFollowupPanel(socialWorkspaceState.data.inbox[0])').includes('data-sw-form="followup"'));
});
test('task navigation accepts canonical and legacy routes and labels actual task stages',()=>{
  const f=fixture();assert.equal(f.run('snswInternalTaskLink("/?tab=messenger&channel=room&message=12")'),'/?tab=messenger&channelId=room&messageId=12&panel=tasks');
  assert.equal(f.run('snswInternalTaskLink("/?tab=messenger&panel=tasks&channelId=room&messageId=12")'),'/?tab=messenger&panel=tasks&channelId=room&messageId=12');
  f.run('socialWorkspaceState.data.followups={items:[{inboxId:"i",followup:{state:"linked",stage:"doing",taskHref:"/?tab=messenger",nextAction:"다음 행동"}}]}');assert.match(f.run('snswFollowupPanel({id:"i"})'),/진행 중/);
  f.run('socialWorkspaceState.data.followups.items[0].followup.stage="changes"');assert.match(f.run('snswFollowupPanel({id:"i"})'),/수정 요청/);
});
test('explicitly reopening a changed inquiry renews its form revision while keeping the typed action',async()=>{
  const f=fixture();f.run('socialWorkspaceState.data.inbox=[{id:"i",revision:2,canEdit:true}];socialWorkspaceState.forms["followup:i"]={revision:1,roomId:"r",assigneeId:"u",nextAction:"보존할 다음 행동",dueDate:"2026-10-15"};socialWorkspaceState.error="문의가 변경됐습니다"');
  const pending=f.run('snswFollowupAction("followup-open","i")');f.requests[0].resolve({items:[],targets:[],date:'2026-10-14'});await pending;
  assert.equal(f.run('socialWorkspaceState.forms["followup:i"].revision'),2);assert.equal(f.run('socialWorkspaceState.forms["followup:i"].nextAction'),'보존할 다음 행동');assert.equal(f.run('socialWorkspaceState.error'),'');
});

test('setup navigation shows server evidence without changing configuration or claiming completion',async()=>{
  const f=fixture();f.context.initial.onboarding={server:{title:'예약 실행 서버',detail:'개발 서버'},channels:[{channelId:'ch',nextStepId:'connection',steps:[{id:'connection',title:'발행 연결',status:'pending',detail:'설정을 확인하세요',view:'settings',actionLabel:'연결 설정'}]}]};
  f.run('socialWorkspaceState.data=initial');const html=f.run('snswSetupPanel()');assert.match(html,/연결 필요/);assert.match(html,/개발 서버/);assert.ok(!html.includes('연결 확인됨'));await f.run('snswAction("view","settings")');assert.equal(f.requests.length,0);assert.equal(f.run('socialWorkspaceState.view'),'settings');
});
test('follow-up creation preserves exact draft on failure and suppresses duplicate submissions',async()=>{
  const f=fixture();f.run('socialWorkspaceState.data.inbox=[{id:"i",revision:2,canEdit:true}];socialWorkspaceState.data.followups={items:[{inboxId:"i",canCreate:true}]}');
  f.context.form={dataset:{swForm:'followup',id:'i',revision:'2'},values:{roomId:'r',assigneeId:'u',nextAction:'일정을 확인해 답변',dueDate:'2026-10-15'}};
  const pending=f.run('snswFollowupSubmit(form)');await f.run('snswFollowupSubmit(form)');assert.equal(f.requests.length,1);assert.equal(f.requests[0].path,'/api/social/inbox/i/followup');assert.equal(f.requests[0].body.revision,2);
  f.requests[0].reject(new Error('업무 등록 확인 필요'));await pending;assert.equal(f.run('socialWorkspaceState.forms["followup:i"].nextAction'),'일정을 확인해 답변');assert.equal(f.run('socialWorkspaceState.busy'),false);
});
test('a changed original inquiry prevents follow-up submission, and old loads cannot cross identity',async()=>{
  const f=fixture();f.run('socialWorkspaceState.data.inbox=[{id:"i",revision:2,canEdit:true}]');f.context.form={dataset:{swForm:'followup',id:'i',revision:'1'},values:{nextAction:'기존 입력'}};await f.run('snswFollowupSubmit(form)');assert.equal(f.requests.length,0);
  const loading=f.run('snswFollowupAction("followup-open","i")');f.context.state.user={id:'other',role:'member'};f.run('snswIdentity()');f.requests[0].resolve({targets:[],items:[],date:'2026-10-14'});await loading;assert.equal(f.run('socialWorkspaceState.forms["followup:i"]'),undefined);
});
test('follow-up task links stay inside messenger and rendered content is escaped',()=>{
  const f=fixture();f.run('socialWorkspaceState.data.followups={items:[{inboxId:"i",followup:{state:"linked",stage:"requested",nextAction:"<script>alert(1)</script>",taskHref:"https://attacker.example/",dueDate:"2026-10-15"}}]}');const html=f.run('snswFollowupPanel({id:"i"})');assert.ok(!html.includes('<script>'));assert.ok(!html.includes('attacker.example'));assert.match(html,/tab=messenger/);
});

test('changing publication format updates canonical performance format and preserves untouched package detail',()=>{
  const f=fixture();f.run('socialWorkspaceState.data.channels.push({id:"yt",platform:"youtube"});socialWorkspaceState.draft.variants=[{channelId:"ch",format:"image",publicationFormat:"image",text:"draft",options:{}}]');
  const change=(field,value)=>{const target={dataset:{swVariant:field,index:'0'},value,hasAttribute:()=>false,closest:()=>null};for(const handler of f.handlers.get('change'))handler({target});};
  change('format','reel');assert.equal(f.run('snswPostInput().variants[0].publicationFormat'),'instagram-reels');
  f.run('socialWorkspaceState.draft.variants=[{channelId:"yt",format:"shorts",publicationFormat:"youtube-shorts",text:"draft",options:{}}]');
  change('text','updated body');assert.equal(f.run('snswPostInput().variants[0].publicationFormat'),'youtube-shorts');
  change('format','video');assert.equal(f.run('snswPostInput().variants[0].publicationFormat'),'youtube-video');
  f.run('delete socialWorkspaceState.draft.variants[0].publicationFormat');assert.equal(f.run('snswPostInput().variants[0].publicationFormat'),'youtube-video');
  change('format','shorts');assert.equal(f.run('snswPostInput().variants[0].publicationFormat'),'youtube-shorts');
});

test('handoff never exposes local media as a remote link when publishing permission is absent',()=>{
  const f=fixture();f.run('socialWorkspaceState.data.posts=[{id:"p",canPublish:false}];socialWorkspaceState.data.jobs=[{id:"j",postId:"p",status:"manual",handoff:{text:"fixed",media:[{id:"asset1",url:"/api/social/media/asset1",type:"image"},{url:"https://cdn.example.test/public.png",type:"image"}]}}]');
  const html=f.run('snswHandoff(socialWorkspaceState.data.jobs[0])');assert.ok(!html.includes('/api/social/media/asset1'));assert.ok(!html.includes('data-sw-action="handoff-download"'));assert.match(html,/현재 발행 권한/);assert.ok(html.includes('href="https://cdn.example.test/public.png"'));
});
const post={id:'p',revision:1,contentVersion:1,status:'draft',title:'한 문장',body:'공통 본문',brandId:'LAB',language:'ko',source:{},media:[],variants:[{channelId:'ch',format:'post',title:'한 문장',text:'공통 본문',media:[],options:{}}],canEdit:true,canApprove:true,canPublish:true,comments:[],history:[],validation:{valid:true,errors:[],warnings:[]}};

test('all nine views render empty and populated state without unsupported result claims',()=>{
  const f=fixture();f.context.post=post;f.run('socialWorkspaceState.data.posts=[post]');
  for(const view of ['overview','calendar','compose','queue','bulk','accounts','results','inbox','settings']){f.context.view=view;const html=f.run('socialWorkspaceSetView(view);renderSocialWorkspace()');assert.match(html,/SNS·마케팅 메뉴/);assert.ok(!html.includes('undefined'));}
  assert.match(f.run('snswResults()'),/미확인|아직 연결된 관측/);assert.ok(css.includes('@media(max-width:700px)'));
});
test('out of order workspace reads cannot populate a newer read or a different identity',async()=>{
  const f=fixture(),a=f.run('snswLoad()'),b=f.run('snswLoad()');f.requests[1].resolve({...f.context.initial,marker:'new'});await b;f.requests[0].resolve({...f.context.initial,marker:'old'});await a;assert.equal(f.run('socialWorkspaceState.data.marker'),'new');
  const pending=f.run('snswLoad()');f.context.state.user={id:'other',role:'member'};f.run('snswIdentity()');f.requests[2].resolve({...f.context.initial,marker:'private'});await pending;assert.equal(f.run('socialWorkspaceState.data'),null);assert.equal(f.run('socialWorkspaceState.draft.body'),'');
});
test('a save preserves authored input on errors and suppresses concurrent duplicate clicks',async()=>{
  const f=fixture();f.run('socialWorkspaceState.draft.title="작성한 제목";socialWorkspaceState.draft.body="작성 중인 내용";socialWorkspaceState.dirty=true');const pending=f.run('snswSavePost()');await f.run('snswSavePost()');assert.equal(f.requests.length,1);f.requests[0].reject(new Error('저장 실패'));await pending;assert.equal(f.run('socialWorkspaceState.draft.body'),'작성 중인 내용');assert.equal(f.run('socialWorkspaceState.dirty'),true);assert.equal(f.run('socialWorkspaceState.busy'),false);
});
test('saved common text reaches channels and later edits preserve explicit overrides',()=>{
  const f=fixture();f.context.post={...post,variants:[...post.variants,{channelId:'other',text:'다른 계정 문구',title:'다른 제목',format:'post',media:[],options:{}}]};f.run('socialWorkspaceState.draft=snswEditorDraft(post);socialWorkspaceState.draft.body="새 공통 본문";socialWorkspaceState.draft.title="새 제목"');const payload=f.run('snswPostInput()');assert.equal(payload.variants[0].text,'새 공통 본문');assert.equal(payload.variants[0].title,'새 제목');assert.equal(payload.variants[1].text,'다른 계정 문구');assert.equal(payload.variants[1].title,'다른 제목');assert.equal(payload.variants[0].media,undefined);
});
test('saving and submitting uses the returned revision and never schedules implicitly',async()=>{
  const f=fixture();f.context.post=post;f.run('socialWorkspaceState.data.posts=[post];snswOpenDraft("p",true);socialWorkspaceState.draft.body="고친 본문";socialWorkspaceState.dirty=true');const pending=f.run('snswPostAction("p","submit")');assert.equal(f.requests[0].path,'/api/social/posts/p');f.requests[0].resolve({post:{...post,body:'고친 본문',revision:2}});await settle();f.requests[1].resolve({...f.context.initial,posts:[{...post,body:'고친 본문',revision:2}]});await settle();assert.equal(f.requests[2].path,'/api/social/posts/p/action');assert.equal(f.requests[2].body.revision,2);assert.equal(f.requests[2].body.action,'submit');f.requests[2].resolve({post:{...post,revision:3,status:'review'}});await settle();f.requests[3].resolve({...f.context.initial,posts:[{...post,revision:3,status:'review'}]});await pending;assert.ok(f.requests.every(r=>r.body?.action!=='schedule'));
});
test('stale saves after logout cannot replace the next user editor',async()=>{
  const f=fixture();f.run('socialWorkspaceState.draft.title="first"');const pending=f.run('snswSavePost()');f.context.state.user={id:'next',role:'admin'};f.run('snswIdentity();socialWorkspaceState.draft.title="next draft"');f.requests[0].resolve({post});await pending;assert.equal(f.run('socialWorkspaceState.draft.title'),'next draft');assert.equal(f.requests.length,1);
});
test('read-only users have no mutation or upload path',async()=>{
  const f=fixture();f.context.state.user.role='viewer';f.run('snswIdentity();socialWorkspaceState.data=initial;socialWorkspaceState.draft.title="cannot"');await f.run('snswSavePost()');await f.run('snswMutate("settings",{paused:true})');await f.run('snswUpload({name:"x.png",type:"image/png",size:20})');assert.equal(f.requests.length,0);assert.equal(f.uploads.length,0);assert.ok(!f.run('snswInbox()').includes('data-sw-form="inbox"'));
});
test('calendar navigation does not discard an unsaved editor and switching posts needs a choice',()=>{
  const f=fixture();f.context.post=post;f.run('socialWorkspaceState.data.posts=[post];socialWorkspaceState.draft.body="남길 내용";socialWorkspaceState.dirty=true;openSocialWorkspace("calendar")');assert.equal(f.run('socialWorkspaceState.draft.body'),'남길 내용');f.run('snswOpenDraft("p")');assert.equal(f.run('socialWorkspaceState.pending.id'),'p');assert.equal(f.run('socialWorkspaceState.draft.body'),'남길 내용');f.run('snswOpenDraft("p",true)');assert.equal(f.run('socialWorkspaceState.editId'),'p');
});
test('time zone conversion rejects impossible and ambiguous clock times',()=>{
  const f=fixture();assert.equal(f.run('snswInstant("2026-10-13T09:30","Asia/Seoul")'),'2026-10-13T00:30:00.000Z');assert.equal(f.run('snswInstant("2026-07-13T09:30","America/New_York")'),'2026-07-13T13:30:00.000Z');assert.throws(()=>f.run('snswInstant("2026-02-30T09:00")'),/날짜/);assert.throws(()=>f.run('snswInstant("2026-03-08T02:30","America/New_York")'),/없는 시각/);assert.throws(()=>f.run('snswInstant("2026-11-01T01:30","America/New_York")'),/두 번/);assert.match(f.run('snswZoneSelect("Australia/Sydney")'),/Australia\/Sydney" selected/);
});
test('CSV supports quoted commas and newlines and does not lose the common body',()=>{
  const f=fixture();f.context.csv='title,body,channelIds\r\n"제목, 하나","첫 줄\n둘째 줄","ch|other"';const rows=f.run('snswCSV(csv)');assert.equal(rows.length,1);assert.equal(rows[0].title,'제목, 하나');assert.equal(rows[0].variants[0].text,'첫 줄\n둘째 줄');assert.equal(rows[0].variants.length,2);assert.throws(()=>f.run('snswCSV("title,title,channelIds\\nx,y,ch")'),/중복/);assert.throws(()=>f.run('snswCSV("title,channelIds\\nx,ch,extra")'),/열 개수/);
});
test('bulk import reuses its preview idempotency key after an uncertain failure',async()=>{
  const f=fixture();f.run('socialWorkspaceState.bulkText="title,body,channelIds\\n첫편,확정본문,ch";socialWorkspaceState.bulkPreview={rows:[{valid:true}],importKey:"stable"}');const a=f.run('snswAction("bulk-import","")');assert.equal(f.requests[0].body.importKey,'stable');f.requests[0].reject(new Error('네트워크 실패'));await a;const b=f.run('snswAction("bulk-import","")');assert.equal(f.requests[1].body.importKey,'stable');f.requests[1].reject(new Error('네트워크 실패'));await b;assert.equal(f.run('socialWorkspaceState.bulkPreview.importKey'),'stable');
});
test('untrusted content is escaped and media and external URLs reject executable schemes',()=>{
  const f=fixture();f.context.post={...post,title:'<img src=x onerror=alert(1)>',body:'<script>x</script>'};f.run('socialWorkspaceState.data.posts=[post]');const html=f.run('snswPostCard(post)');assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<script>'));for(const url of ['javascript:alert(1)','data:image/svg+xml,x','//evil.test/x','https://user:password@host.test/a','/api/social/media/../private']){f.context.url=url;assert.equal(f.run('snswUrl(url,{media:true})'),'');}assert.equal(f.run('snswUrl("/api/social/media/abc-123",{media:true})'),'/api/social/media/abc-123');
});
test('YouTube options use explicit boolean declarations and account capability singular',()=>{
  const f=fixture();f.run('socialWorkspaceState.data.channels=[{id:"yt",name:"YouTube",platform:"youtube",capability:{canPublish:true,mode:"automatic",formats:["video"],maxTextLength:5000}}];socialWorkspaceState.draft.variants=[{channelId:"yt",format:"video",text:"",options:{}}]');const html=f.run('snswVariantFields(socialWorkspaceState.draft.variants[0],0)');assert.match(html,/data-sw-variant-bool="madeForKids"/);assert.match(html,/아동용 아님/);assert.match(f.run('snswAccounts()'),/자동 발행 가능/);assert.ok(!html.includes('value="false" selected'));const target={dataset:{swVariantBool:'madeForKids',index:'0'},value:'false',hasAttribute:()=>false,closest:()=>null};for(const h of f.handlers.get('change'))h({target});assert.equal(f.run('socialWorkspaceState.draft.variants[0].options.madeForKids'),false);
});
test('channel-specific asset selection preserves shared media',()=>{
  const f=fixture();f.run('socialWorkspaceState.data.assets=[{id:"v2",url:"/api/social/media/v2",mimeType:"video/mp4",name:"세로 영상"}];socialWorkspaceState.draft.media=[{id:"common",url:"/api/social/media/common",type:"video"}];socialWorkspaceState.draft.variants=[{channelId:"ch",options:{}}]');const target={dataset:{swVariantAsset:'0'},value:'v2',hasAttribute:()=>false};for(const h of f.handlers.get('change'))h({target});assert.equal(f.run('socialWorkspaceState.draft.variants[0].media[0].id'),'v2');assert.equal(f.run('socialWorkspaceState.draft.media[0].id'),'common');
});
test('upload is CSRF protected, validates file types and aborts on identity reset',async()=>{
  const f=fixture();await f.run('snswUpload({name:"fake.svg",type:"image/svg+xml",size:20})');assert.equal(f.uploads.length,0);const pending=f.run('snswUpload({name:"영상.mp4",type:"video/mp4",size:20})');assert.equal(f.uploads[0].headers['X-CSRF-Token'],'csrf');assert.equal(f.uploads[0].headers['X-File-Name'],encodeURIComponent('영상.mp4'));f.context.state.user=null;f.run('socialWorkspaceReset()');await pending;assert.equal(f.uploads[0].aborted,true);assert.equal(f.run('socialWorkspaceState.draft.media.length'),0);
});
test('metrics preserve zero, unknown, source and measured time without summed platform reach',()=>{
  const f=fixture();f.context.records=[{title:'기록',channelId:'ch',publishedAt:'2026-10-13T00:00Z',url:'javascript:evil()',checkpoints:[{hours:24,status:'recorded',metrics:{views:0,reach:null},metricProvenance:{views:{source:'manual',observedAt:'2026-10-14T00:02Z',timing:'late'}},unavailableReasons:{reach:'플랫폼 미지원'}}]}];const html=f.run('snswPerformanceRecords(records)');assert.match(html,/<dd>0<\/dd>/);assert.match(html,/미확인/);assert.match(html,/manual/);assert.match(html,/늦은 관측/);assert.match(html,/플랫폼 미지원/);assert.ok(!html.includes('javascript:'));
});
test('campaign submit passes selected channels and current revision',async()=>{
  const f=fixture();f.run('socialWorkspaceState.data.campaigns=[{id:"c",revision:3,name:"캠페인",channelIds:["ch"]}]');f.context.form={dataset:{swForm:'campaign',id:'c'},values:{name:'캠페인',goal:'방문 유입',channelIds:['ch'],startAt:'2026-10-13',endAt:'2026-10-20'}};const pending=f.run('snswSubmit(form)');assert.equal(f.requests[0].body.revision,3);assert.deepEqual(Array.from(f.requests[0].body.channelIds),['ch']);f.requests[0].reject(new Error('검사용 실패'));await pending;assert.equal(f.run('socialWorkspaceState.forms["campaign:c"].goal'),'방문 유입');
});
test('profile linking sends the selected real profile instead of a checkbox boolean',async()=>{
  const f=fixture();f.run('socialWorkspaceState.data.provider={configured:true,integrations:[{id:"ig",profile:"@real-account",name:"실제 계정"}]}');f.context.form={dataset:{swForm:'connect',id:'ch'},values:{integrationId:'ig',confirmedProfile:'on'}};const pending=f.run('snswSubmit(form)');assert.equal(f.requests[0].body.confirmedProfile,'@real-account');f.requests[0].reject(new Error('검사용 실패'));await pending;
});
test('unknown outcomes offer reconciliation and manual evidence, never an immediate retry',()=>{
  const f=fixture();f.context.post=post;f.run('socialWorkspaceState.data.posts=[post]');f.context.job={id:'j',postId:'p',channelId:'ch',status:'unknown',message:'결과가 불명확합니다.'};const html=f.run('snswJobCard(job)');assert.match(html,/job-reconcile/);assert.match(html,/job-manual/);assert.match(html,/provider-job/);assert.ok(!html.includes('job-retry'));assert.ok(!html.includes('job-now'));
});

test('SNS globals coexist with the existing studio globals and direct section survives identity initialization',()=>{
  const f=fixture();assert.doesNotThrow(()=>vm.runInContext('const sw={studio:true};const swButton=()=>"studio";const swGuard=()=>({});const swAlive=()=>true;const swDate=()=>"date";',f.context));
  f.context.location.href='https://workspace.test/?tab=social&section=compose';f.context.state.user={id:'fresh',role:'viewer'};f.run('snswIdentity()');assert.equal(f.run('socialWorkspaceState.view'),'compose');assert.equal(f.run('sw.studio'),true);
});

test('publication evidence distinguishes HTTP reachability from a recorded human public-screen check',()=>{
  const f=fixture();f.context.post=post;f.run('socialWorkspaceState.data.posts=[post]');f.context.job={id:'j',postId:'p',status:'published',publicationUrl:'https://www.instagram.com/p/TEST/',linkCheck:{status:'reachable',label:'HTTP 응답 확인',detail:'HTTP 200',canCheck:true}};
  const html=f.run('snswPublicationEvidence(job)');assert.match(html,/HTTP 응답/);assert.match(html,/공개 화면 확인 기록/);assert.ok(!html.includes('공개 확인 완료'));
});


test('AI execution requires an unchanged quote and explicit cost consent; candidates do not apply themselves',async()=>{
  const f=fixture();f.run('socialWorkspaceState.data.ai={canUse:true,model:"fake-model",remainingUsd:1};socialWorkspaceState.draft.title="제목";socialWorkspaceState.draft.body="확정 본문";socialWorkspaceState.draft.variants=[{channelId:"ch",text:"",options:{}}]');
  const quote=f.run('snswAction("ai-quote","")');assert.equal(f.requests[0].path,'/api/social/ai/quote');assert.equal(f.requests[0].body.body,'확정 본문');f.requests[0].resolve({quote:{id:'q',expiresAt:'2099-10-13T00:00:00Z',estimatedMaxUsd:.01,remainingUsd:1,model:'fake-model'}});await settle();f.requests[1].resolve({...f.context.initial,ai:{canUse:true}});await quote;
  await assert.rejects(f.run('snswAction("ai-generate","")'),/확인란/);assert.equal(f.requests.length,2);f.run('socialWorkspaceState.forms.aiConfirmed=true;socialWorkspaceState.draft.body="수정한 본문"');await assert.rejects(f.run('snswAction("ai-generate","")'),/다시 미리/);assert.equal(f.requests.length,2);
  f.run('socialWorkspaceState.draft.body="확정 본문"');const generate=f.run('snswAction("ai-generate","")');assert.equal(f.requests[2].path,'/api/social/ai/generate');assert.equal(f.requests[2].body.confirmCost,true);f.requests[2].resolve({variants:[{channelId:'ch',title:'검토용 제목',text:'검토용 AI 후보',hashtags:['#한국어']}],warnings:['사실 확인'],model:'fake-model'});await settle();f.requests[3].resolve({...f.context.initial,ai:{canUse:true}});await generate;assert.equal(f.run('socialWorkspaceState.draft.variants[0].text'),'');await f.run('snswAction("ai-use","0")');assert.equal(f.run('socialWorkspaceState.draft.variants[0].text'),'검토용 AI 후보');assert.equal(f.run('socialWorkspaceState.draft.variants[0].options.hashtags'),'#한국어');assert.equal(f.requests.length,4);assert.equal(f.run('socialWorkspaceState.forms.aiQuote'),undefined);
});

test('official comments show read-only source and coverage and obey server channel capabilities',async()=>{
  const f=fixture();f.run('socialWorkspaceState.data.inboxProvider={channels:[{channelId:"ch",enabled:true,available:true,canConfigure:true,canSync:true,lastSyncedAt:"2026-10-13T00:00Z",coverage:{postsChecked:2,commentsReceived:3,status:"partial"}}]};socialWorkspaceState.data.inbox=[{id:"i",channelId:"ch",source:"api:instagram",kind:"comment",text:"공식 질문",status:"open"}]');const html=f.run('snswInbox()');assert.match(html,/Instagram 공식 댓글/);assert.match(html,/일부 수집/);assert.match(html,/DM 수집은 지원하지/);assert.match(html,/발신 계정과 최종 문구를 확인/);assert.ok(!html.includes('name="text" value="공식 질문"'));
  const pending=f.run('snswAction("inbox-provider-sync","ch")');assert.equal(f.requests[0].path,'/api/social/inbox/provider/sync');assert.equal(f.requests[0].body.channelId,'ch');f.requests[0].reject(new Error('테스트 응답'));await pending;f.run('socialWorkspaceState.data.inboxProvider.channels[0].canSync=false');await f.run('snswAction("inbox-provider-sync","ch")');assert.equal(f.requests.length,1);
});


test('format previews keep native media dimensions and navigate a single carousel image without writes',async()=>{
  const f=fixture();f.run('socialWorkspaceState.draft.media=[{id:"a",url:"/api/social/media/a",type:"image",width:1080,height:1350},{id:"b",url:"/api/social/media/b",type:"image",width:1080,height:1080}];socialWorkspaceState.draft.variants=[{channelId:"ch",format:"carousel"}]');assert.equal(f.run('snswPreviewModel().ratio'),.8);assert.match(f.run('snswPreview()'),/1 \/ 2/);await f.run('snswAction("preview-next","")');assert.equal(f.run('snswPreviewModel().selected.id'),'b');assert.equal(f.requests.length,0);f.run('socialWorkspaceState.draft.variants[0].format="reel"');assert.equal(f.run('snswPreviewModel().ratio'),9/16);f.run('socialWorkspaceState.draft.variants[0].format="text"');assert.ok(!f.run('snswPreview()').includes('class="sw-preview-stage"'));
});

test('a calendar move previews only the chosen fixed reservation and preserves its exact time',async()=>{
  const f=fixture();f.context.post=post;f.run('socialWorkspaceState.data.posts=[post];socialWorkspaceState.data.jobs=[{id:"j",postId:"p",channelId:"ch",status:"scheduled",mode:"fixed",scheduledAt:"2026-10-13T00:00:30.000Z"}]');const pending=f.run('snswCalendarMovePreview("j","2026-10-15")');assert.equal(f.requests[0].path,'/api/social/reschedule/preview');assert.equal(f.requests[0].body.shiftMinutes,2880);assert.deepEqual(Array.from(f.requests[0].body.jobIds),['j']);assert.equal(f.requests[0].body.includeFixed,true);f.requests[0].reject(new Error('검사'));await pending;assert.equal(f.run('socialWorkspaceState.data.jobs[0].scheduledAt'),'2026-10-13T00:00:30.000Z');
});

test('manual handoff uses the frozen job only and never substitutes an edited post',()=>{
  const f=fixture();f.context.post={...post,body:'현재 바뀐 원문'};f.run('socialWorkspaceState.data.posts=[post]');f.context.job={id:'j',postId:'p',status:'manual',handoff:{title:'승인 제목',text:'예약 당시 원고',hashtags:'#승인',contentVersion:1,profileUrl:'https://www.instagram.com/approved/',media:[{id:'file',url:'/api/social/media/file',type:'image'}]}};const html=f.run('snswHandoff(job)');assert.match(html,/예약 당시 원고/);assert.ok(!html.includes('현재 바뀐 원문'));assert.match(html,/handoff-download/);assert.match(html,/실제 계정 프로필/);f.context.job.handoff=null;assert.match(f.run('snswHandoff(job)'),/지금 원문으로 대신하지/);
});

test('supported channel options have correct types and UTM builds a real URL for explicit insertion',async()=>{
  const f=fixture();f.run('socialWorkspaceState.data.channels[0].capability.options=["thumbnailTimestamp","link","madeWithAi","paidPartnership"];socialWorkspaceState.draft.body="원고";socialWorkspaceState.draft.variants=[{channelId:"ch",format:"image",options:{}}]');const html=f.run('snswVariantFields(socialWorkspaceState.draft.variants[0],0)');assert.match(html,/data-sw-variant-number="thumbnailTimestamp"/);assert.match(html,/data-sw-variant-bool="madeWithAi"/);assert.match(html,/data-sw-variant-option="link"/);assert.ok(!html.includes('data-sw-variant-option="utm"'));f.run('socialWorkspaceState.forms["utm:ch"]={url:"https://synk.example/try?keep=yes#demo",source:"instagram",medium:"social",campaign:"가을 한 문장"}');await f.run('snswAction("utm-preview","0")');assert.equal(f.run('socialWorkspaceState.draft.variants[0].text'),undefined);await f.run('snswAction("utm-insert","0")');const text=f.run('socialWorkspaceState.draft.variants[0].text'),url=new URL(text.split('\n').at(-1));assert.equal(url.searchParams.get('utm_campaign'),'가을 한 문장');assert.equal(url.searchParams.get('keep'),'yes');assert.equal(url.hash,'#demo');assert.equal(f.requests.length,0);
});

test('offline editor recovery is scoped, never saves an authoritative post, and clears on identity reset',async()=>{
  const f=fixture(),disk=new Map();f.context.localStorage={getItem:k=>disk.get(k)||null,setItem:(k,v)=>disk.set(k,v),removeItem:k=>disk.delete(k)};
  f.run('snswRecoveryAccept({scopeId:"company-one",drafts:[]});socialWorkspaceState.draft.title="복구 원고";socialWorkspaceState.draft.body="미저장 문구";socialWorkspaceState.dirty=true');
  const work=f.run('snswRecoveryFlush()');assert.equal(f.requests[0].path,'/api/social/recovery/save');assert.equal(f.requests[0].body.revision,0);f.requests[0].reject(new Error('offline'));await work;
  assert.equal(disk.size,1);assert.match([...disk.values()][0],/미저장 문구/);assert.equal(f.run('socialWorkspaceState.dirty'),true);assert.equal(f.requests.length,1);f.run('socialWorkspaceReset()');assert.equal(disk.size,0);
});
test('a late editor recovery response cannot alter the next user recovery state',async()=>{
  const f=fixture();f.run('snswRecoveryAccept({scopeId:"company-one",drafts:[]});socialWorkspaceState.draft.body="old user";socialWorkspaceState.dirty=true');const work=f.run('snswRecoveryFlush()');f.context.state.user={id:'other',role:'member'};f.run('snswIdentity()');f.requests[0].resolve({recovery:{revision:9}});await work;assert.equal(f.run('socialRecoveryState.revision'),0);assert.equal(f.run('socialWorkspaceState.draft.body'),'');
});
test('recovering a changed post creates an editable new draft rather than overwriting current revision',async()=>{
  const f=fixture();f.context.post={...post,revision:7};f.run('socialWorkspaceState.data.posts=[post];socialRecoveryState.offers=[{draftKey:"recover-one",postId:"p",revision:0,baseRevision:2,draft:{title:"old recovered",body:"old",variants:[],media:[]},conflict:true}]');assert.match(f.run('snswRecoveryPanel()'),/새 초안으로 복구/);const work=f.run('snswRecoveryAction("recovery-restore","recover-one")');assert.equal(f.requests[0].path,'/api/social/recovery/check');f.requests[0].resolve({ok:true,currentPostRevision:7});await work;assert.equal(f.run('socialWorkspaceState.editId'),'');assert.equal(f.run('socialWorkspaceState.draft.revision'),undefined);assert.equal(f.run('socialWorkspaceState.data.posts[0].revision'),7);assert.equal(f.requests.length,1);
});
test('template application requires a server preview and cannot silently replace an unsaved draft',async()=>{
  const f=fixture();f.run('socialWorkspaceState.dirty=true');await f.run('snswExtendedAction("template-new","tpl")');assert.equal(f.requests.length,0);f.run('socialWorkspaceState.dirty=false');const work=f.run('snswExtendedAction("template-new","tpl")');assert.equal(f.requests[0].path,'/api/social/templates/preview');assert.equal(f.requests[0].body.templateId,'tpl');assert.equal(f.requests[0].body.postId,undefined);f.requests[0].reject(new Error('synthetic stop'));await work;assert.equal(f.run('socialWorkspaceState.editId'),'');
});
test('bulk editing and scheduling use selected posts and preserve the explicit text sync choice',async()=>{
  const f=fixture();f.run('socialWorkspaceState.forms.bulkSelected=["p","q"]');f.context.form={dataset:{swForm:'bulk-actions'},values:{operation:'edit',field:'body',value:'new body',syncCommonText:'on'}};const work=f.run('snswExtendedSubmit(form)');assert.equal(f.requests[0].path,'/api/social/workflow/preview');assert.deepEqual(JSON.parse(JSON.stringify(f.requests[0].body)),{action:'edit',postIds:['p','q'],patch:{body:'new body'},syncCommonText:true});f.requests[0].reject(new Error('synthetic stop'));await work;assert.equal(f.requests.length,1);
});
test('repeat copy variants are edited explicitly and remain inside the content approval input',async()=>{
  const f=fixture();f.run('socialWorkspaceState.draft.variants=[{channelId:"ch",format:"reel",text:"base",options:{}}]');await f.run('snswExtendedAction("copy-add","0")');const target={dataset:{swCopy:'text',variant:'0',copy:'0'},value:'second version'};f.context.event={type:'input',target};f.run('snswExtendedInput(event)');assert.equal(f.run('snswPostInput().variants[0].copyVariants[0].text'),'second version');assert.equal(f.run('socialWorkspaceState.dirty'),true);assert.equal(f.requests.length,0);
});
test('tracking keeps unobserved visits separate from zero and inserts only an explicit chosen link',async()=>{
  const f=fixture();f.run('socialWorkspaceState.data.tracking={settings:{enabled:true,canConfigure:false},links:[{id:"link",postId:"p",channelId:"ch",active:true,shortUrl:"https://workspace.test/s/test",destination:"https://synk.example/try",stats:{clicks:0,visits:null,siteEventsSeen:false,browserEvents:{signup:0},verifiedEvents:{signup:0}}}]};socialWorkspaceState.draft.body="base";socialWorkspaceState.draft.variants=[{channelId:"ch",format:"text",text:"",options:{}}]');assert.match(f.run('snswTrackingResults()'),/미확인/);assert.ok(!f.run('snswTrackingSettings()').includes('tracking-key-create'));await f.run('snswTrackingAction("tracking-insert","link")');assert.match(f.run('socialWorkspaceState.draft.variants[0].text'),/https:\/\/workspace.test\/s\/test/);assert.equal(f.requests.length,0);
});
test('CSV cell edits serialize quoted Korean text without losing media and metadata',()=>{
  const f=fixture();f.context.csv='title,body,channelIds,category,mediaUrl,purpose\n"첫 글","줄1\n줄2",ch,기초,https://example.test/image.png,듣기';const parsed=f.run('snswCSV(csv)');parsed[0].body='고친 "문구", 쉼표';f.context.rows=parsed;const round=f.run('snswCSV(snswCSVSerialize(rows))');assert.equal(round[0].body,parsed[0].body);assert.equal(round[0].purpose,'듣기');assert.equal(round[0].media[0].url,'https://example.test/image.png');
});

test('tracking never converts unconnected verified event counts into zero',()=>{
  const f=fixture();f.run('socialWorkspaceState.data.tracking={links:[{id:"l",channelId:"ch",stats:{clicks:0,visits:null,siteEventsSeen:false,browserEvents:{signup:null},verifiedEvents:{trial_start:null,signup:null,inquiry:null}}}]}');const html=f.run('snswTrackingResults()');assert.match(html,/서버 확인<\/dt><dd>미확인/);assert.match(html,/링크 클릭<\/dt><dd>0/);assert.ok(!html.includes('서버 확인</dt><dd>0'));
});

test('tracking configuration uses the latest settings revision and shows the exact SDK endpoint',async()=>{
  const f=fixture();f.run('socialWorkspaceState.data.tracking={settings:{canConfigure:true,revision:7,sdkUrl:"https://workspace.test/social-tracking.js",verifiedEndpoint:"https://workspace.test/social-track/verified",allowedOrigins:[]}}');assert.match(f.run('snswTrackingSettings()'),/https:\/\/workspace.test\/social-tracking.js/);assert.match(f.run('snswTrackingSettings()'),/X-Synk-Signature/);f.context.form={dataset:{swForm:'tracking-config'},values:{enabled:'on',allowedOrigins:'https://synk.example'}};const work=f.run('snswTrackingSubmit(form)');assert.equal(f.requests[0].body.revision,7);f.requests[0].reject(new Error('synthetic stop'));await work;
});

function recoveryFixture(){const f=fixture(),disk=new Map();let id=0;f.context.localStorage={getItem:k=>disk.get(k)||null,setItem:(k,v)=>disk.set(k,v),removeItem:k=>disk.delete(k)};f.context.setTimeout=()=>1;f.context.clearTimeout=()=>{};f.context.crypto.randomUUID=()=>String(++id);f.run('snswRecoveryAccept({scopeId:"scope-A",drafts:[]});socialWorkspaceState.draft.title="private title";socialWorkspaceState.draft.body="private body";socialWorkspaceState.draft.variants=[{channelId:"ch",format:"text",text:"private body",options:{}}];socialWorkspaceState.dirty=true');return {...f,disk,get renders(){return f.renders;}};}
test('local-only recovery hides private content until current server source and account permission is checked',async()=>{
  const f=recoveryFixture(),save=f.run('snswRecoveryFlush()');f.requests[0].reject(Object.assign(new Error('offline'),{status:503}));await save;
  f.run('snswRecoveryStart();socialWorkspaceState.draft=snswBlank();socialWorkspaceState.dirty=false;socialWorkspaceState.data.channels=[]');const accept=f.run('snswRecoveryAccept({scopeId:"scope-A",drafts:[]})');assert.equal(f.run('socialRecoveryState.offers.length'),0);assert.ok(!f.run('snswRecoveryPanel()').includes('private title'));assert.equal(f.requests[1].path,'/api/social/recovery/check');f.requests[1].reject(Object.assign(new Error('revoked'),{status:403}));await accept;await f.run('snswRecoveryAction("recovery-restore","draft_1")');assert.equal(f.run('socialWorkspaceState.draft.body'),'');assert.equal(f.run('socialRecoveryState.offers.length'),0);assert.match([...f.disk.values()][0],/private body/);
});
test('restoring an offered recovery checks permission again and cannot expose a newly revoked source',async()=>{
  const f=fixture();f.run('socialRecoveryState.offers=[{draftKey:"r",postId:null,draft:{title:"private title",body:"private body",variants:[],media:[]}}]');const work=f.run('snswRecoveryAction("recovery-restore","r")');assert.equal(f.requests[0].path,'/api/social/recovery/check');f.requests[0].reject(Object.assign(new Error('source revoked'),{status:403}));await work;assert.equal(f.run('socialWorkspaceState.draft.body'),'');assert.equal(f.run('socialRecoveryState.offers.length'),0);assert.equal(f.run('socialWorkspaceState.busy'),false);
});
test('a conflict reload from an older editing session cannot replace a new recovery key or offer',async()=>{
  const f=recoveryFixture(),save=f.run('snswRecoveryFlush()');f.requests[0].reject(Object.assign(new Error('conflict'),{status:409}));await settle();assert.equal(f.requests[1].path,'/api/social/recovery');f.run('snswOpenDraft("",true);socialWorkspaceState.draft.body="new draft body";socialWorkspaceState.dirty=true;snswRecoveryQueue()');const key=f.run('socialRecoveryState.key');f.requests[1].resolve({scopeId:'scope-A',drafts:[]});await save;assert.equal(f.run('socialRecoveryState.key'),key);assert.equal(f.run('socialRecoveryState.offers.length'),0);assert.equal(f.run('socialWorkspaceState.draft.body'),'new draft body');assert.equal(f.requests.length,2);
});
test('workspace scope changes isolate drafts and late autosave responses and delete the old local key',async()=>{
  const f=recoveryFixture(),save=f.run('snswRecoveryFlush()');await f.run('snswRecoveryAccept({scopeId:"scope-B",drafts:[]})');f.requests[0].resolve({recovery:{revision:19}});await save;assert.equal(f.run('socialRecoveryState.scopeId'),'scope-B');assert.equal(f.run('socialRecoveryState.revision'),0);assert.equal(f.run('socialWorkspaceState.draft.body'),'');assert.equal(f.run('socialWorkspaceState.dirty'),false);assert.equal([...f.disk.keys()].some(k=>k.includes('scope-A')),false);f.run('socialWorkspaceReset()');assert.equal(f.disk.size,0);
});
test('an approved review whose access expired remains visibly valid and can be revoked',()=>{
  const f=fixture();f.context.post=post;f.run('socialWorkspaceState.forms["review:p"]={comparison:{changes:[],hasBaseline:true},canCreate:true,links:[{id:"review",status:"expired",approvalValid:true,accessExpired:true,contentVersion:1,expiresAt:"2026-10-01T00:00:00Z"}]}');const html=f.run('snswReviewPanel(post)');assert.match(html,/승인 유효 · 링크 열람 만료/);assert.match(html,/data-sw-action="review-revoke"/);assert.match(html,/고객 승인·링크 철회/);
});

test('a workspace scope transition immediately redraws the cleared editor and removes previous private DOM',async()=>{
  const f=recoveryFixture();f.run('snswRender()');const before=f.renders,load=f.run('snswLoad()');f.requests[0].resolve({...f.context.initial,recovery:{scopeId:'scope-B',drafts:[]}});await load;assert.equal(f.run('socialWorkspaceState.draft.body'),'');assert.ok(f.renders>before);assert.equal(f.run('socialWorkspaceState.loading'),false);assert.equal(f.run('socialRecoveryState.offers.length'),0);
});

test('committing the current conflict fork clears only its device copy and preserves the other tab server recovery',async()=>{
  const f=recoveryFixture(),save=f.run('snswRecoveryFlush()');f.requests[0].reject(Object.assign(new Error('conflict'),{status:409}));await settle();f.requests[1].resolve({scopeId:'scope-A',drafts:[{draftKey:'draft_1',postId:null,revision:2,draft:{title:'other window',body:'other window body',variants:[],media:[]},updatedAt:new Date().toISOString()}]});await save;const key=f.run('socialRecoveryState.key');assert.match(key,/draft_1_local_/);assert.equal(f.run('socialRecoveryState.revision'),0);assert.equal(f.run('socialRecoveryState.offers.length'),1);assert.equal(f.run('socialRecoveryState.offers[0].draft.body'),'other window body');await f.run('snswRecoveryCommitted()');assert.equal(f.run('snswRecoveryLocal().length'),0);assert.equal(f.run('socialRecoveryState.offers[0].draft.body'),'other window body');assert.equal(f.requests.length,2);
});

test('a lost autosave response recovers its revision only for the same complete device payload',async()=>{
  for(const matching of [true,false]){const f=recoveryFixture(),save=f.run('snswRecoveryFlush()'),sent=f.requests[0].body;f.requests[0].reject(new Error('response lost'));await save;f.context.serverRecord={...sent,revision:1,draft:{...sent.draft,...(matching?{}:{body:'other tab changed body'})},updatedAt:new Date().toISOString()};await f.run('snswRecoveryAccept({scopeId:"scope-A",drafts:[serverRecord]})');assert.equal(f.run('socialRecoveryState.revision'),matching?1:0);const committed=f.run('snswRecoveryCommitted()');if(matching){assert.equal(f.requests[1].path,'/api/social/recovery/discard');assert.equal(f.requests[1].body.revision,1);f.requests[1].resolve({ok:true});}await committed;assert.equal(f.requests.length,matching?2:1);}
});

test('connection health shows stale or unverified checks without treating them as successful publication',()=>{
  const f=fixture();f.run('socialWorkspaceState.data.connectionHealth={api:{state:"unknown",stale:true,message:"<script>test</script>"},channels:[{channelId:"ch",state:"auth_required",checkedAt:"2026-10-13T01:00:00Z",canCheck:true}]};socialWorkspaceState.data.inboxHealth={channels:[{channelId:"ch",state:"unknown",canCheck:true}]}');const html=f.run('snswAccounts()');assert.match(html,/오래된 확인/);assert.match(html,/재연결 필요/);assert.match(html,/성공한 검사 시각 미확인/);assert.ok(!html.includes('<script>test</script>'));assert.match(html,/data-sw-action="health-inbox"/);
});
test('capacity preview includes only individually permitted fixed reservations and never applies automatically',async()=>{
  const f=fixture();f.run('socialWorkspaceState.forms.capacitySelected=["queue","fixed-a"];socialWorkspaceState.forms.capacityFixed=["fixed-a","not-selected"]');f.context.form={dataset:{swForm:'capacity-preview'},values:{maxShiftHours:'24'}};const work=f.run('snswFourSubmit(form)');assert.equal(f.requests[0].path,'/api/social/capacity/preview');assert.deepEqual(Array.from(f.requests[0].body.includeFixedJobIds),['fixed-a']);assert.equal(f.requests[0].body.maxShiftHours,24);f.requests[0].reject(new Error('synthetic stop'));await work;assert.equal(f.requests.length,1);
});
test('capacity apply accepts only the server preview and not mutable client changes',async()=>{
  const f=fixture();f.run('socialWorkspaceState.forms.capacityPreview={previewId:"snapshot",canApply:true,changes:[{jobId:"edited",to:"evil"}]}');const work=f.run('snswFourAction("capacity-apply","")');assert.deepEqual(JSON.parse(JSON.stringify(f.requests[0].body)),{previewId:'snapshot',confirmed:true});f.requests[0].reject(new Error('synthetic stop'));await work;
});
function replyFixture(){const f=fixture();f.run('socialWorkspaceState.data.inbox=[{id:"comment",channelId:"ch",revision:4,text:"original question",replyDraft:"saved draft",source:"api:instagram"}];socialWorkspaceState.data.replies={items:[{inboxId:"comment",canReply:true}],attempts:[]};socialWorkspaceState.forms.replyOpen="comment";socialWorkspaceState.forms["reply-preview:comment"]={text:"final reply"};socialWorkspaceState.forms.replyPreview={preview:{id:"preview",inboxId:"comment",revision:4,text:"final reply",account:{channelId:"ch",name:"LAB",platform:"instagram"},comment:{text:"original question"}},confirmationToken:"confirmation",idempotencyKey:"stable-key"}');return f;}
test('comment confirmation preserves the saved draft and changes invalidate the send preview',()=>{
  const f=replyFixture(),html=f.run('snswReplyPanel(socialWorkspaceState.data.inbox[0])');assert.match(html,/final reply/);assert.match(html,/original question/);assert.match(html,/확인한 답장 1회 전송/);f.context.event={type:'input',target:{dataset:{swReplyText:'comment'},closest:()=>null}};f.run('snswFourInput(event)');assert.equal(f.run('socialWorkspaceState.forms.replyPreview'),undefined);assert.equal(f.run('socialWorkspaceState.data.inbox[0].replyDraft'),'saved draft');
});
test('a confirmed comment reply sends once and clears the confirmation before awaiting the network',async()=>{
  const f=replyFixture(),send=f.run('snswFourAction("reply-send","comment")');await f.run('snswFourAction("reply-send","comment")');assert.equal(f.requests.length,1);assert.deepEqual(JSON.parse(JSON.stringify(f.requests[0].body)),{previewId:'preview',confirmationToken:'confirmation',idempotencyKey:'stable-key'});assert.equal(f.run('socialWorkspaceState.forms.replyPreview'),undefined);f.requests[0].resolve({attempt:{status:'sent'}});await settle();f.requests[1].resolve({...f.context.initial,replies:{items:[{inboxId:'comment',canReply:false}],attempts:[{inboxId:'comment',status:'sent',text:'final reply'}]}});await send;await f.run('snswFourAction("reply-send","comment")');assert.equal(f.requests.length,2);
});
test('a lost comment-send response does not offer blind resending and keeps the original draft',async()=>{
  const f=replyFixture(),send=f.run('snswFourAction("reply-send","comment")');f.requests[0].reject(new Error('response lost'));await settle();const inbox=f.run('socialWorkspaceState.data.inbox');f.requests[1].resolve({...f.context.initial,inbox,replies:{items:[{inboxId:'comment',canReply:false,reason:'결과 확인 필요'}],attempts:[{inboxId:'comment',status:'unknown',text:'final reply'}]}});await send;const html=f.run('snswReplyPanel(socialWorkspaceState.data.inbox[0])');assert.match(html,/다시 보내지 않아요/);assert.ok(!html.includes('data-sw-action="reply-send"'));assert.equal(f.run('socialWorkspaceState.data.inbox[0].replyDraft'),'saved draft');await f.run('snswFourAction("reply-send","comment")');assert.equal(f.requests.length,2);
});
test('copy comparisons preserve zero, missing values, observation source and separate verified site counts',()=>{
  const f=fixture();f.context.group={condition:{channelId:'ch',channelName:'LAB',metric:'views',hours:24,source:'api:instagram',unit:'count',timing:'on-time',observationOffsetMinutes:0},variants:[{title:'<script>unsafe</script>',text:'fixed published copy',status:'insufficient',sampleCount:1,missingCount:1,unsupportedCount:0,median:0,min:0,max:0,observations:[{jobId:'j',value:0,status:'measured',publishedAt:'2026-10-13T00:00:00Z',observedAt:'2026-10-14T00:00:00Z',denominator:{impressions:{value:null}},tracking:{status:'ambiguous',reason:'여러 발행에서 같은 링크',links:[{label:'test',stats:{clicks:2,visits:null,browserEvents:{signup:1},verifiedEvents:{signup:null}}}]}}]}]};const html=f.run('snswCopyGroup(group,[{id:"views",label:"조회"}])');assert.match(html,/중앙값<\/dt><dd>0/);assert.match(html,/표본 부족/);assert.match(html,/실제 관측/);assert.match(html,/Instagram API/);assert.match(html,/가입 · 서버 확인<\/dt><dd>미확인/);assert.ok(!html.includes('<script>unsafe</script>'));assert.match(html,/더하지 않아요/);
});
test('copy filtering is read-only and available to viewers while template creation still requires write access',async()=>{
  const f=fixture();f.context.state.user.role='viewer';f.run('snswIdentity();socialWorkspaceState.data=initial');f.context.form={dataset:{swForm:'copy-insights-filter'},values:{channelId:'ch',hours:'72',metric:'saves',purpose:'듣기'}};const read=f.run('snswFourSubmit(form)');assert.match(f.requests[0].path,/copy-insights\?/);assert.match(f.requests[0].path,/hours=72/);assert.equal(f.requests[0].body,undefined);f.requests[0].resolve({groups:[],filters:{hours:72},excluded:{}});await read;await f.run('snswFourAction("copy-insights-template","j")');assert.equal(f.requests.length,1);
});
test('copy template preview stays separate from the current draft and requires explicit template save',async()=>{
  const f=fixture();f.run('socialWorkspaceState.draft.body="unsaved body";socialWorkspaceState.dirty=true');const preview=f.run('snswFourAction("copy-insights-template","j")');assert.equal(f.requests[0].path,'/api/social/copy-insights/template-preview');f.requests[0].resolve({post:{title:'proposed',body:'published body',variants:[],media:[]},selection:{jobId:'j'}});await preview;assert.equal(f.run('socialWorkspaceState.draft.body'),'unsaved body');assert.equal(f.requests.length,1);f.context.form={dataset:{swForm:'copy-insights-template'},values:{name:'chosen template',description:'explicit choice'}};const save=f.run('snswFourSubmit(form)');assert.equal(f.requests[1].path,'/api/social/templates');assert.equal(f.requests[1].body.post.body,'published body');f.requests[1].reject(new Error('synthetic stop'));await save;
});

test('reply uncertainty clears only when the exact submitted attempt is durably resolved after a lost response',async()=>{
  for(const exact of [true,false]){const f=replyFixture(),send=f.run('snswFourAction("reply-send","comment")');f.requests[0].reject(new Error('response lost'));await settle();const inbox=f.run('socialWorkspaceState.data.inbox');f.requests[1].resolve({...f.context.initial,inbox,replies:{items:[{inboxId:'comment',canReply:true,latestAttempt:{id:exact?'stable-key':'older-key',status:'sent'}}],attempts:[{id:exact?'stable-key':'older-key',inboxId:'comment',status:'sent',text:'final reply'}]}});await send;assert.equal(f.run('snswReplyUncertain("comment")'),!exact);await f.run('snswFourAction("reply-send","comment")');assert.equal(f.requests.length,2);}
});
test('copy drilldown preserves each exact published text and fixed-window periods without inventing an observation point',()=>{
  const f=fixture();f.context.observation={copy:{title:'실제 제목',text:'고유 링크 https://workspace.test/s/second',hashtags:'#원본'},value:0,status:'measured',windowFrom:'2026-10-10T00:00:00Z',windowTo:'2026-10-11T00:00:00Z',recordedAt:'2026-10-13T00:00:00Z',observedAt:null,tracking:{links:[]}};const html=f.run('snswCopyObservation(observation)');assert.match(html,/게시 당시 실제 문구/);assert.match(html,/https:\/\/workspace.test\/s\/second/);assert.match(html,/실측 집계 기간/);assert.ok(!html.includes('실제 관측'));assert.match(f.run('snswCopyInsights()'),/게시일 시작 \(한국시간\)/);
});
test('unknown reply proof checking requires the dedicated current permission and never calls send',async()=>{
  const f=fixture();f.run('socialWorkspaceState.data.inbox=[{id:"i",channelId:"ch"}];socialWorkspaceState.data.replies={items:[{inboxId:"i",canReply:false,canReconcile:false}],attempts:[{id:"a",inboxId:"i",status:"unknown",text:"body"}]}');assert.ok(!f.run('snswReplyPanel(socialWorkspaceState.data.inbox[0])').includes('data-sw-form="reply-reconcile"'));f.run('socialWorkspaceState.data.replies.items[0].canReconcile=true');assert.match(f.run('snswReplyPanel(socialWorkspaceState.data.inbox[0])'),/data-sw-form="reply-reconcile"/);f.context.form={dataset:{swForm:'reply-reconcile',id:'a'},values:{remoteReplyId:'901'}};const work=f.run('snswFourSubmit(form)');assert.equal(f.requests[0].path,'/api/social/inbox/reply/reconcile');assert.deepEqual(JSON.parse(JSON.stringify(f.requests[0].body)),{attemptId:'a',remoteReplyId:'901'});f.requests[0].reject(new Error('synthetic stop'));await work;
});

test('updated comments, sender accounts and lost permission invalidate a reply confirmation before any send',async()=>{
  for(const change of ['revision','account','permission','channel']){const f=replyFixture();f.run(change==='revision'?'socialWorkspaceState.data.inbox[0].revision=5;socialWorkspaceState.data.inbox[0].text="changed question"':change==='account'?'socialWorkspaceState.data.inbox[0].channelId="other"':change==='permission'?'socialWorkspaceState.data.replies.items[0].canReply=false':'socialWorkspaceState.data.channels=[]');assert.ok(!f.run('snswReplyPanel(socialWorkspaceState.data.inbox[0])').includes('data-sw-action="reply-send"'));f.run('snswFourAccept(socialWorkspaceState.data)');assert.equal(f.run('socialWorkspaceState.forms.replyPreview'),undefined);await f.run('snswFourAction("reply-send","comment")');assert.equal(f.requests.length,0);assert.equal(f.run('socialWorkspaceState.data.inbox[0].replyDraft'),'saved draft');}
  const f=replyFixture();f.run('socialWorkspaceState.data.inbox[0].revision=5');await f.run('snswFourAction("reply-send","comment")');assert.equal(f.requests.length,0);assert.equal(f.run('socialWorkspaceState.forms.replyPreview'),undefined);
});
test('a conflict whose latest recovery cannot load keeps saving the typed draft under a new recovery copy',async()=>{
  const f=fixture(),disk=new Map();f.context.localStorage={getItem:k=>disk.get(k)||null,setItem:(k,v)=>disk.set(k,v),removeItem:k=>disk.delete(k)};
  f.run('snswRecoveryAccept({scopeId:"company-one",drafts:[]});socialWorkspaceState.draft.body="충돌 뒤 문구";socialWorkspaceState.dirty=true');
  const work=f.run('snswRecoveryFlush()');f.requests[0].reject(Object.assign(new Error('changed elsewhere'),{status:409}));await settle();
  assert.equal(f.requests[1].path,'/api/social/recovery');f.requests[1].reject(new Error('offline'));await work;
  assert.equal(f.run('socialRecoveryState.paused'),false);assert.match(f.run('socialRecoveryState.key'),/_local_/);assert.match(f.run('socialRecoveryState.status'),/불러오지 못했/);assert.match([...disk.values()].join(''),/충돌 뒤 문구/);
  f.run('socialWorkspaceState.draft.body="이어서 쓴 문구"');const next=f.run('snswRecoveryFlush()');assert.equal(f.requests[2].path,'/api/social/recovery/save');assert.match(f.requests[2].body.draftKey,/_local_/);assert.equal(f.requests[2].body.revision,0);assert.equal(f.requests[2].body.draft.body,'이어서 쓴 문구');f.requests[2].resolve({recovery:{revision:1}});await next;
});
test('a published job whose performance record did not connect says so on its card',()=>{
  const f=fixture();f.context.post=post;f.run('socialWorkspaceState.data.posts=[post]');f.context.job={id:'j',postId:'p',channelId:'ch',status:'published',publicationUrl:'https://www.instagram.com/p/SYNK1/',outcomeError:'발행은 됐지만 성과 기록 연결을 다시 확인해야 해요.'};
  assert.match(f.run('snswJobCard(job)'),/성과 기록 연결을 다시 확인해야 해요/);f.context.job={...f.context.job,outcomeError:null};assert.doesNotMatch(f.run('snswJobCard(job)'),/성과 기록 연결/);
});
