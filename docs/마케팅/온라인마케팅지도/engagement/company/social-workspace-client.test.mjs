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

test('overview shows actual observed posts separately from Workspace publishing and preserves unknown',()=>{
 const f=fixture();f.context.initial.observed={published7d:12,channelsObserved:3,channelsTotal:34};f.run('socialWorkspaceState.data=initial');
 let html=f.run('snswOverview()');assert.match(html,/SNS 7일 게시/);assert.match(html,/<strong>12<\/strong>/);assert.match(html,/3\/34개 채널/);assert.match(html,/Workspace 7일 발행/);assert.match(html,/href="\/\?tab=overview&section=all"/);
 f.run('socialWorkspaceState.data.observed.published7d=null');html=f.run('snswOverview()');assert.match(html,/<strong>—<\/strong>/);
});

test('first entry renders loading before ensure starts and settles without a refresh or duplicate request',async()=>{
  const f=fixture(),frames=[];f.run('socialWorkspaceReset()');
  f.context.render=()=>{frames.push(f.run('renderSocialWorkspace()'));f.run('socialWorkspaceEnsure()');};
  f.context.render();f.run('socialWorkspaceEnsure();socialWorkspaceEnsure()');
  assert.equal(f.requests.length,1);assert.ok(frames.length>=2);
  for(const html of frames){assert.match(html,/SNS 작업실을 불러오고 있어요/);assert.ok(!html.includes('작업실을 불러오지 못했어요'));}
  await f.run('snswAction("refresh","")');assert.equal(f.requests.length,1);
  f.requests[0].resolve(f.context.initial);await settle();
  assert.equal(f.run('socialWorkspaceState.loading'),false);assert.match(frames.at(-1),/SNS 운영 숫자/);assert.ok(!frames.at(-1).includes('작업실을 불러오지 못했어요'));
});
test('a real first-load failure stays failed until an explicit retry and the retry shows loading immediately',async()=>{
  const f=fixture(),frames=[];f.run('socialWorkspaceReset()');f.context.render=()=>{frames.push(f.run('renderSocialWorkspace()'));f.run('socialWorkspaceEnsure()');};
  f.context.render();f.requests[0].reject(new Error('조회 연결 실패'));await settle();
  assert.equal(f.requests.length,1);assert.match(frames.at(-1),/조회 연결 실패/);assert.match(frames.at(-1),/작업실을 불러오지 못했어요/);
  f.context.render();assert.equal(f.requests.length,1,'renders do not retry a failed request');
  const retry=f.run('snswAction("refresh","")');assert.equal(f.requests.length,2);assert.match(frames.at(-1),/SNS 작업실을 불러오고 있어요/);assert.ok(!frames.at(-1).includes('조회 연결 실패'));
  await f.run('snswAction("refresh","")');assert.equal(f.requests.length,2);
  f.requests[1].resolve(f.context.initial);await retry;assert.equal(f.run('socialWorkspaceState.error'),'');assert.match(frames.at(-1),/SNS 운영 숫자/);
});
test('a first load may finish after leaving social without rendering over the next screen',async()=>{
  const f=fixture();f.run('socialWorkspaceReset();socialWorkspaceEnsure()');const renders=f.renders;
  f.context.state.tab='home';f.requests[0].resolve(f.context.initial);await settle();
  assert.equal(f.renders,renders);assert.equal(f.run('socialWorkspaceState.loading'),false);assert.equal(f.context.state.tab,'home');
  f.context.state.tab='social';f.run('socialWorkspaceEnsure()');assert.equal(f.requests.length,1);assert.match(f.run('renderSocialWorkspace()'),/SNS 운영 숫자/);
});
test('late initial responses cannot clear loading or expose data after an identity reset',async()=>{
  const f=fixture();f.run('socialWorkspaceReset();socialWorkspaceEnsure()');
  f.context.state.user={id:'next',role:'viewer'};f.run('socialWorkspaceEnsure()');assert.equal(f.requests.length,2);
  f.requests[0].resolve({...f.context.initial,posts:[{id:'old-secret',body:'prior user'}]});await settle();
  assert.equal(f.run('socialWorkspaceState.loading'),true);assert.equal(f.run('socialWorkspaceState.data'),null);
  f.requests[1].resolve({...f.context.initial,canWrite:false});await settle();assert.equal(f.run('socialWorkspaceState.loading'),false);assert.equal(f.run('socialWorkspaceState.data.posts.length'),0);
});

test('calendar groups each reservation once in Korean time and keeps sorted dates and unscheduled posts',()=>{
  const f=fixture();f.run(`socialWorkspaceState.date='2026-10-14';socialWorkspaceState.calendar='month';
    socialWorkspaceState.data.posts=[{id:'p',title:'예약 있는 게시물',status:'approved',canPublish:true,variants:[]},{id:'cancelled',title:'취소만 있는 게시물',status:'draft',variants:[]}];
    socialWorkspaceState.data.jobs=[{id:'late',postId:'p',channelId:'ch',scheduledAt:'2026-10-14T16:00:00Z',status:'scheduled'},{id:'early',postId:'p',channelId:'ch',scheduledAt:'2026-10-14T15:00:00Z',status:'scheduled'},{id:'previous',postId:'p',channelId:'ch',scheduledAt:'2026-10-14T14:59:00Z',status:'scheduled'},{id:'cancel',postId:'cancelled',channelId:'ch',scheduledAt:'2026-10-15T00:00:00Z',status:'cancelled'},{id:'hidden',postId:'unreadable',channelId:'ch',scheduledAt:'2026-10-15T00:00:00Z',status:'scheduled'}];
    var originalDay=snswDay,dayReads=0;snswDay=(...args)=>{dayReads++;return originalDay(...args)};`);
  const html=f.run('snswCalendar()'),today=html.match(/<section data-sw-drop-date="2026-10-14"[\s\S]*?<\/section>/)?.[0],tomorrow=html.match(/<section data-sw-drop-date="2026-10-15"[\s\S]*?<\/section>/)?.[0];
  assert.ok(today.includes('data-sw-drag-job="previous"'));assert.ok(!today.includes('data-sw-drag-job="early"'));assert.ok(tomorrow.indexOf('data-sw-drag-job="early"')<tomorrow.indexOf('data-sw-drag-job="late"'));
  assert.ok(!html.includes('data-sw-drag-job="hidden"'));assert.match(html,/일정 없는 게시물<b>1<\/b>/);assert.equal(f.run('dayReads'),5);
});
test('date formatter reuse preserves exact zones and invalid dates and stays bounded',()=>{
  const f=fixture();let constructed=0;f.context.Intl={DateTimeFormat:function(...args){constructed++;return new Intl.DateTimeFormat(...args);}};
  f.run('snswDateFormats.clear()');
  for(const zone of ['Asia/Seoul','Asia/Ulaanbaatar','America/New_York','UTC'])for(const value of ['2026-03-08T06:59:00Z','2026-03-08T07:00:00Z','2026-11-01T06:00:00Z']){
    f.context.zone=zone;f.context.value=value;
    assert.equal(f.run('snswDay(value,zone)'),new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value)));
    assert.equal(f.run('snswClock(value,zone)'),new Intl.DateTimeFormat('ko-KR',{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value)));
  }
  assert.equal(constructed,8);assert.equal(f.run('snswDay("invalid")'),'');assert.equal(f.run('snswClock(null)'),'--:--');
  for(const zone of Intl.supportedValuesOf('timeZone').slice(0,40)){f.context.zone=zone;f.run('snswDay("2026-10-14",zone)');}
  assert.equal(f.run('snswDateFormats.size'),32);assert.throws(()=>f.run('snswDay("2026-10-14","Invalid/Zone")'),/time zone/i);
});
test('account lookup preserves channel precedence and sees permission changes immediately',()=>{
  const f=fixture();f.run('socialWorkspaceState.data.accounts=[{id:"ch",name:"account name",canEdit:false,canPublish:true,onlyAccount:true},{id:"ch",name:"duplicate"},{id:"orphan",name:"unmatched account"}]');
  assert.equal(f.run('snswChannels()[0].name'),'LAB Instagram');assert.equal(f.run('snswChannel("ch").onlyAccount'),true);assert.equal(f.run('snswChannel("ch").canEdit'),true);
  f.run('socialWorkspaceState.data.channels[0].canEdit=false');assert.equal(f.run('snswChannel("ch").canEdit'),false);
  assert.equal(f.run('snswChannel("orphan").name'),'unmatched account');assert.equal(f.run('snswChannel("missing").id'),'missing');
});

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

test('YouTube subscriber notification choice preserves an explicit false through saving',()=>{
  const f=fixture();f.run('socialWorkspaceState.data.channels=[{id:"yt",name:"YouTube",platform:"youtube",capability:{options:["notifySubscribers"]}}];socialWorkspaceState.draft.variants=[{channelId:"yt",options:{}}]');
  assert.match(f.run('snswVariantFields(socialWorkspaceState.draft.variants[0],0)'),/data-sw-variant-bool="notifySubscribers"/);
  const target={dataset:{swVariantBool:'notifySubscribers',index:'0'},value:'false',hasAttribute:()=>false,closest:()=>null};
  for(const h of f.handlers.get('change'))h({target});
  assert.equal(f.run('socialWorkspaceState.draft.variants[0].options.notifySubscribers'),false);
  assert.match(f.run('snswVariantFields(socialWorkspaceState.draft.variants[0],0)'),/value="false" selected/);
  f.run('socialWorkspaceState.data.channels[0].capability.options=[]');
  assert.doesNotMatch(f.run('snswVariantFields(socialWorkspaceState.draft.variants[0],0)'),/data-sw-variant-bool="notifySubscribers"/);
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


test('comment coverage explains a limited recent scan separately from a completed historical sweep',()=>{
  const f=fixture();f.context.coverage={status:'partial',postsChecked:7,commentsReceived:2,partialReasons:['recent-post-limit','recent-post-limit','<img src=x onerror=alert(1)>'],recentStatus:'limited',requestsUsed:10,requestsLimit:12,progress:{recentPostsChecked:5,historyPostsChecked:2,historyPending:false,historyCompletedAt:'2026-10-15T00:00:00Z'}};
  const html=f.run('snswInboxCoverage({coverage})');assert.match(html,/최근 게시물 조회 한도에 도달해 다음 주기에 다시 확인해요/);assert.equal((html.match(/최근 게시물 조회 한도/g)||[]).length,1);assert.match(html,/과거 조회 한 바퀴 완료/);assert.match(html,/이번 조회 요청 10 \/ 12회/);assert.doesNotMatch(html,/과거 댓글 이어받기 대기|onerror|남은 범위는 다음/);
  f.context.coverage={status:'partial',postsChecked:2,commentsReceived:3};const legacy=f.run('snswInboxCoverage({coverage})');assert.match(legacy,/일부 수집/);assert.doesNotMatch(legacy,/요청 한도|조회 요청/);assert.equal(f.requests.length,0);
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
test('an in-flight comment send shows waiting instead of claiming its response was lost',async()=>{
  const f=replyFixture(),send=f.run('snswFourAction("reply-send","comment")'),html=f.run('snswReplyPanel(socialWorkspaceState.data.inbox[0])');
  assert.match(html,/답장을 전송하고 있어요/);assert.ok(!html.includes('전송 응답을 받지 못했어요'));assert.ok(!html.includes('data-sw-action="reply-send"'));
  await f.run('snswFourAction("reply-send","comment")');assert.equal(f.requests.length,1);f.requests[0].resolve({attempt:{status:'sent'}});await settle();const inbox=f.run('socialWorkspaceState.data.inbox');f.requests[1].resolve({...f.context.initial,inbox,replies:{items:[{inboxId:'comment',canReply:false}],attempts:[{id:'stable-key',inboxId:'comment',status:'sent',text:'final reply'}]}});await send;
  const completed=f.run('snswReplyPanel(socialWorkspaceState.data.inbox[0])');assert.match(completed,/SNS 답장 전송됨/);assert.ok(!completed.includes('답장을 전송하고 있어요'));assert.ok(!completed.includes('전송 응답을 받지 못했어요'));assert.equal(f.requests.filter(r=>r.path.endsWith('/reply/send')).length,1);
});
test('a real lost comment response stops the waiting message while the result lookup is pending',async()=>{
  const f=replyFixture(),send=f.run('snswFourAction("reply-send","comment")');f.requests[0].reject(new Error('response lost'));await settle();const html=f.run('snswReplyPanel(socialWorkspaceState.data.inbox[0])');assert.ok(!html.includes('답장을 전송하고 있어요'));assert.match(html,/전송 응답을 받지 못했어요/);assert.equal(f.run('socialWorkspaceState.busy'),true);
  f.requests[1].reject(new Error('lookup offline'));await send;assert.equal(f.run('snswReplyUncertain("comment")'),true);assert.equal(f.requests.filter(r=>r.path.endsWith('/reply/send')).length,1);
});
test('an exact durable sent record replaces the lost-response notice without another send',async()=>{
  const f=replyFixture(),send=f.run('snswFourAction("reply-send","comment")');f.requests[0].reject(new Error('response lost'));await settle();const inbox=f.run('socialWorkspaceState.data.inbox');f.requests[1].resolve({...f.context.initial,inbox,replies:{items:[{inboxId:'comment',canReply:false,latestAttempt:{id:'stable-key',status:'sent'}}],attempts:[{id:'stable-key',inboxId:'comment',status:'sent',text:'final reply'}]}});await send;
  assert.equal(f.run('socialWorkspaceState.notice'),'SNS 답장 전송 결과를 기록했어요.');assert.equal(f.run('snswReplyUncertain("comment")'),false);assert.equal(f.requests.filter(r=>r.path.endsWith('/reply/send')).length,1);
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

test('an unknown reply offers a platform recheck only after the settle window and never sends',async()=>{
  const f=fixture(),old=new Date(Date.now()-11*60000).toISOString();f.run('socialWorkspaceState.data.inbox=[{id:"i",channelId:"ch"}];socialWorkspaceState.data.replies={items:[{inboxId:"i",canReply:false,canReconcile:true}],attempts:[{id:"a",inboxId:"i",status:"unknown",text:"body",createdAt:"'+new Date().toISOString()+'",submittedAt:"'+new Date().toISOString()+'"}]}');
  assert.match(f.run('snswReplyPanel(socialWorkspaceState.data.inbox[0])'),/data-sw-action="reply-recheck" data-value="a" disabled/);
  f.run('socialWorkspaceState.data.replies.attempts[0].submittedAt="'+old+'"');const html=f.run('snswReplyPanel(socialWorkspaceState.data.inbox[0])');assert.match(html,/data-sw-action="reply-recheck" data-value="a" >/);assert.ok(!html.includes('data-sw-action="reply-send"'));
  f.run('socialWorkspaceState.data.replies.items[0].canReconcile=false');assert.ok(!f.run('snswReplyPanel(socialWorkspaceState.data.inbox[0])').includes('reply-recheck'));f.run('socialWorkspaceState.data.replies.items[0].canReconcile=true');
  const work=f.run('snswFourAction("reply-recheck","a")');assert.equal(f.requests[0].path,'/api/social/inbox/reply/recheck');assert.deepEqual(JSON.parse(JSON.stringify(f.requests[0].body)),{attemptId:'a'});f.requests[0].reject(new Error('synthetic stop'));await work;assert.equal(f.requests.length,1);
});

test('typing while another request runs is kept when the screen redraws',async()=>{
  const f=fixture(),fire=(kind,target)=>{for(const h of f.handlers.get(kind)||[])h({type:kind,target});};
  f.context.initial.inbox=[{id:'i1',channelId:'ch',text:'첫 문의',status:'open',effectiveStatus:'open',canEdit:true,revision:1},{id:'i2',channelId:'ch',text:'둘째 문의',status:'open',effectiveStatus:'open',canEdit:true,revision:1}];
  f.context.initial.inboxProvider={channels:[{channelId:'ch',enabled:true,available:true,canConfigure:true,canSync:true}]};f.run('socialWorkspaceState.data=JSON.parse(JSON.stringify(initial));socialWorkspaceState.view="inbox"');
  const pending=f.run('snswAction("inbox-provider-sync","ch")');assert.equal(f.requests[0].path,'/api/social/inbox/provider/sync');assert.equal(f.run('socialWorkspaceState.busy'),true);
  const form={dataset:{swForm:'inbox-update',id:'i2'},values:{replyDraft:'수집 기다리며 쓴 초안',assigneeId:'u',status:'open'}};fire('input',{dataset:{},hasAttribute:()=>false,closest:()=>form});
  const followup={dataset:{swForm:'followup',id:'i1',revision:'1'},values:{roomId:'r',assigneeId:'u',dueDate:'2026-10-15',nextAction:'기다리며 쓴 다음 행동'}};fire('change',{dataset:{},hasAttribute:()=>false,closest:selector=>selector==='[data-sw-form="followup"]'?followup:null});
  assert.equal(f.run('socialWorkspaceState.forms["followup:i1"].nextAction'),'기다리며 쓴 다음 행동');
  f.requests[0].resolve({ok:true});await settle();assert.equal(f.requests[1].path.split('?')[0],'/api/social/workspace');f.requests[1].resolve(JSON.parse(JSON.stringify(f.context.initial)));await pending;
  assert.match(f.run('snswInbox()'),/수집 기다리며 쓴 초안/);
});

test('switches and selections the server would refuse are not offered',()=>{
  const f=fixture();f.run(`state.user.role='member';socialWorkspaceState.data.settings.canPauseGlobal=false;
    socialWorkspaceState.data.channels=[{id:'ch',name:'LAB Instagram',platform:'instagram',brandId:'LAB',canEdit:true,canPublish:true,capability:{}},{id:'ro',name:'쓰기만 되는 계정',platform:'youtube',brandId:'PULSE',canEdit:true,canPublish:false,capability:{}}];
    socialWorkspaceState.data.rules=[{id:'rule',title:'남의 규칙',enabled:true,sourceId:'src',channelIds:['ro'],delayMinutes:0},{id:'mine',title:'내 규칙',enabled:true,sourceId:'src',channelIds:['ch'],delayMinutes:0}];
    socialWorkspaceState.data.posts=[{id:'p',title:'관리자만 예약 가능한 글',status:'approved',canEdit:true,canPublish:false,variants:[{channelId:'ro'}]},{id:'q',title:'내가 옮길 수 있는 글',status:'approved',canEdit:true,canPublish:true,variants:[{channelId:'ch'}]}];
    socialWorkspaceState.data.jobs=[{id:'j',postId:'p',channelId:'ro',status:'scheduled',mode:'fixed',scheduledAt:'2026-11-01T03:00:00Z'},{id:'k',postId:'q',channelId:'ch',status:'scheduled',mode:'fixed',scheduledAt:'2026-11-01T04:00:00Z'}];`);
  const settings=f.run('snswSettings()');assert.ok(!settings.includes('data-sw-action="pause-brand"'),'brand pauses are for administrators');
  assert.ok(!settings.includes('data-sw-action="pause-channel" data-value="ro"'));assert.match(settings,/data-sw-action="pause-channel" data-value="ch"/);
  const queue=f.run('snswQueue()');assert.ok(!queue.includes('data-sw-action="rule-toggle" data-value="rule"'));assert.match(queue,/data-sw-action="rule-toggle" data-value="mine"/);
  assert.ok(!queue.includes('data-sw-job-select="j"'));assert.match(queue,/data-sw-job-select="k"/);
});

test('the queue reads each reservation day once instead of once per day it shows, keeping day groups in time order',()=>{
  const f=fixture(),start=Date.parse('2030-01-07T00:00:00Z');
  f.run(`socialWorkspaceState.data.posts=[{id:'p',title:'예약 글',status:'approved',canEdit:true,canPublish:true,variants:[]}];socialWorkspaceState.data.jobs=Array.from({length:40},(_,i)=>({id:'j'+i,postId:'p',channelId:'ch',status:'scheduled',mode:'fixed',scheduledAt:new Date(${start}+Math.floor(i/10)*86400000+(i%10)*60000).toISOString()}));var originalDay=snswDay,dayReads=0;snswDay=(...args)=>{dayReads++;return originalDay(...args)};`);
  const html=f.run('snswQueue()'),at=i=>html.indexOf('data-sw-job-select="j'+i+'"');f.run('snswDay=originalDay');
  for(let i=0;i<40;i++)assert.ok(at(i)>=0,'j'+i);for(let i=1;i<40;i++)assert.ok(at(i-1)<at(i),'order '+i);
  assert.ok(f.run('dayReads')<130,'day reads '+f.run('dayReads'));
});

test('the inbox draws fifty comments at a time and indexes replies and follow-ups once per draw',()=>{
  const f=fixture();
  f.run(`socialWorkspaceState.data.inbox=Array.from({length:120},(_,i)=>({id:'i'+i,channelId:'ch',author:'작성자'+i,text:'댓글 '+i,status:'open',effectiveStatus:'open',revision:1,canEdit:true,createdAt:new Date(Date.UTC(2026,9,1,0,0)-i*60000).toISOString()}));
    socialWorkspaceState.data.replies={items:socialWorkspaceState.data.inbox.map(r=>({inboxId:r.id,canReply:true,effectiveStatus:'open',alreadyAnswered:false,reason:'자격 '+r.id+' 끝'})),attempts:socialWorkspaceState.data.inbox.filter((_,i)=>i%10===0).map((r,i)=>({id:'a'+i,inboxId:r.id,status:'sent',text:'보낸 답장 '+r.id+' 끝',createdAt:'2026-10-13T00:00:00Z'}))};
    socialWorkspaceState.data.followups={items:socialWorkspaceState.data.inbox.map(r=>({inboxId:r.id,canCreate:true}))};
    var reads={find:0,filter:0,followFind:0};const D=socialWorkspaceState.data,count=(arr,method,key)=>Object.defineProperty(arr,method,{value:function(...a){reads[key]++;return Array.prototype[method].apply(this,a);},configurable:true});
    count(D.replies.items,'find','find');count(D.replies.attempts,'filter','filter');count(D.followups.items,'find','followFind');`);
  const cards=html=>html.split('data-sw-inbox-card="').length-1;
  let html=f.run('snswInbox()');
  assert.equal(cards(html),50,'first draw');assert.ok(html.includes('data-sw-action="list-more" data-value="inbox"'));assert.ok(html.includes('70건 더 보기'));
  assert.ok(html.includes('자격 i49 끝'));assert.ok(!html.includes('자격 i50 끝'));assert.ok(html.includes('보낸 답장 i40 끝'));assert.ok(html.includes('data-sw-followup="i49"'));
  assert.equal(f.run('JSON.stringify(reads)'),'{"find":0,"filter":0,"followFind":0}');
  f.run('snswAction("list-more","inbox")');html=f.run('snswInbox()');assert.equal(cards(html),100,'after one more');assert.ok(html.includes('20건 더 보기'));
  f.run('snswAction("list-more","inbox")');html=f.run('snswInbox()');assert.equal(cards(html),120,'all shown');assert.ok(!html.includes('더 보기'));
  f.run('snswAction("inbox-filter","open")');html=f.run('snswInbox()');assert.equal(cards(html),50,'a filter change starts over');assert.ok(html.includes('전체<b>120</b>'));
  f.run('socialWorkspaceState.inboxId="i77"');assert.ok(f.run('snswInbox()').includes('data-sw-inbox-card="i77"'));
});

test('the calendar list and unscheduled tray draw fifty posts at a time, index jobs once and defer video thumbnails',()=>{
  const f=fixture(),queued=[],observers=[];
  f.context.queueMicrotask=fn=>queued.push(fn);f.context.IntersectionObserver=class{constructor(cb){this.cb=cb;this.seen=[];observers.push(this);}observe(node){this.seen.push(node);}unobserve(){}disconnect(){this.disconnected=true;}};
  f.run(`socialWorkspaceState.date='2026-10-14';socialWorkspaceState.calendar='list';
    socialWorkspaceState.data.posts=Array.from({length:130},(_,i)=>({id:'p'+i,title:'게시물 '+i,status:i%2?'approved':'draft',canEdit:true,canPublish:true,media:[{id:'m'+i,url:'/api/social/media/m'+i,type:i%2?'video':'image'}],variants:[{channelId:'ch'}]}));
    socialWorkspaceState.data.jobs=Array.from({length:260},(_,i)=>({id:'j'+i,postId:'p'+(i%65),channelId:'ch',status:i%4===3?'cancelled':'scheduled',scheduledAt:new Date(Date.UTC(2026,9,1,0,i)).toISOString()}));
    var jobReads=0,originalPostJobs=snswPostJobs;snswPostJobs=post=>{jobReads++;return originalPostJobs(post);};`);
  const count=(html,text)=>html.split(text).length-1;
  let html=f.run('snswCalendar()');
  assert.equal(count(html,'class="sw-post sw-post-row"'),50,'list cards');assert.ok(html.includes('data-sw-action="list-more" data-value="calendar"'));assert.ok(html.includes('80건 더 보기'));
  assert.equal(f.run('jobReads'),0,'jobs are indexed once per draw');assert.ok(html.includes('data-status="cancelled">취소됨'),'job badges still come from the same jobs');
  assert.ok(html.includes('일정 없는 게시물<b>65</b>'));assert.equal(count(html,'class="sw-post-row"'),50,'tray rows');assert.ok(html.includes('data-sw-action="list-more" data-value="tray"'));assert.ok(html.includes('15건 더 보기'));
  assert.ok(!html.includes('<video src='),'no eager video source');assert.ok(html.includes('<video data-sw-thumb-src="/api/social/media/m1#t=0.5" muted preload="none"'));assert.equal(count(html,'<video '),50);
  assert.equal(queued.length,1,'one lazy pass per draw');
  const nodes=[{dataset:{swThumbSrc:'/api/social/media/m1#t=0.5'},removeAttribute(name){if(name==='data-sw-thumb-src')delete this.dataset.swThumbSrc;}},{dataset:{swThumbSrc:'/api/social/media/m3#t=0.5'},removeAttribute(){}}];
  f.context.document.querySelectorAll=selector=>selector==='video[data-sw-thumb-src]'?nodes:[];
  queued[0]();assert.equal(observers.length,1);assert.equal(observers[0].seen.length,2);
  observers[0].cb([{target:nodes[0],isIntersecting:true},{target:nodes[1],isIntersecting:false}]);
  assert.equal(nodes[0].src,'/api/social/media/m1#t=0.5');assert.equal(nodes[0].preload,'metadata');assert.equal(nodes[0].dataset.swThumbSrc,undefined);assert.equal(nodes[1].src,undefined);
  f.run('snswAction("list-more","calendar")');html=f.run('snswCalendar()');assert.equal(count(html,'class="sw-post sw-post-row"'),100);assert.ok(html.includes('30건 더 보기'));
  const stack={innerHTML:''},button={textContent:'',hidden:false},base=f.context.document.querySelector,renders=f.renders;f.context.document.querySelector=s=>s==='.sw-workspace .sw-cal-tray-pop .sw-stack'?stack:s==='.sw-workspace .sw-cal-tray-pop [data-sw-action="list-more"]'?button:base(s);
  f.run('snswAction("list-more","tray")');assert.equal(f.renders,renders,'the open tray grows in place instead of a full redraw');assert.equal(count(stack.innerHTML,'class="sw-post-row"'),65);assert.equal(button.hidden,true);
  f.context.document.querySelector=base;html=f.run('snswCalendar()');assert.equal(count(html,'class="sw-post-row"'),65);assert.ok(!html.includes('data-value="tray"'));
  f.run('snswPostJobs=originalPostJobs');
  delete f.context.IntersectionObserver;assert.ok(f.run('snswCalendar()').includes('<video src="/api/social/media/m1#t=0.5" muted preload="metadata"'),'without IntersectionObserver the thumbnail loads as before');
});

test('status filters, upcoming groups and calendar head counts stop rescanning every job',()=>{
  const f=fixture();
  f.run(`socialWorkspaceState.date='2026-10-14';
    socialWorkspaceState.data.posts=Array.from({length:40},(_,i)=>({id:'p'+i,title:'게시물 '+i,status:i%5?'approved':'published',canEdit:true,canPublish:true,variants:[{channelId:'ch'}]}));
    var postIdReads=0;const make=(i,status,at)=>{const job={id:'j'+i,channelId:'ch',status,scheduledAt:at};Object.defineProperty(job,'postId',{enumerable:true,get(){postIdReads++;return 'p'+(i%40);}});return job;};
    socialWorkspaceState.data.jobs=[...Array.from({length:400},(_,i)=>make(i,i%4?'scheduled':'published',new Date(Date.UTC(2026,8+(i%3),1+(i%27),(i%2)*15+1,i%60)).toISOString())),make(400,'scheduled','2026-09-30T16:00:00Z'),make(401,'scheduled','2026-10-31T15:30:00Z'),make(402,'published','2026-10-31T14:59:00Z')];
    var dayReads=0,originalDay=snswDay;snswDay=(...a)=>{dayReads++;return originalDay(...a);};var jobReads=0,originalPostJobs=snswPostJobs;snswPostJobs=p=>{jobReads++;return originalPostJobs(p);};`);
  f.run('socialWorkspaceState.filters.status="published"');
  const expectedFilter=f.run('snswRows("posts").filter(p=>p.status==="published"||originalPostJobs(p).some(j=>j.status==="published")).map(p=>p.id).join(" ")');
  f.run('jobReads=0');const filtered=f.run('snswFilteredPosts().map(p=>p.id).join(" ")');
  assert.equal(filtered,expectedFilter);assert.equal(filtered.split(' ').length,17);assert.equal(f.run('jobReads'),0,'the status filter scans jobs once');
  f.run('socialWorkspaceState.filters.status=""');
  const naive=f.run(`JSON.stringify((()=>{const out=[];for(const j of snswRows('jobs').filter(j=>j.status==='scheduled').sort((a,b)=>String(a.scheduledAt).localeCompare(String(b.scheduledAt)))){const g=out.find(x=>x[0].postId&&x[0].postId===j.postId&&x[0].scheduledAt===j.scheduledAt);if(g)g.push(j);else out.push([j]);}return out.slice(0,8).map(g=>g.map(j=>j.id));})())`);
  f.run('postIdReads=0');
  const groups=f.run(`JSON.stringify(snswGroupJobs(snswRows('jobs').filter(j=>j.status==='scheduled').sort((a,b)=>String(a.scheduledAt).localeCompare(String(b.scheduledAt))),8).map(g=>g.map(j=>j.id)))`);
  assert.equal(groups,naive);assert.equal(JSON.parse(groups).length,8);assert.ok(f.run('postIdReads')<=40,'grouping stops after the first eight groups: '+f.run('postIdReads')+' postId reads');
  f.run('postIdReads=0');assert.ok(f.run('snswOverview()').includes('data-sw-block="upcoming"'));assert.ok(f.run('postIdReads')<=500,'overview grouping is no longer quadratic: '+f.run('postIdReads')+' postId reads');
  const expectedStats=f.run(`JSON.stringify([['이달 예약',snswRows('jobs').filter(j=>j.status==='scheduled'&&originalDay(j.scheduledAt).slice(0,7)==='2026-10').length,''],['이달 게시',snswRows('jobs').filter(j=>j.status==='published'&&originalDay(j.publishedAt||j.scheduledAt).slice(0,7)==='2026-10').length,'ok']])`);
  f.run('dayReads=0');const stats=f.run('JSON.stringify(snswPosterStats("calendar"))');
  assert.equal(stats,expectedStats);assert.equal(f.run('dayReads'),0,'calendar head counts without per-job day formatting');
  f.run('snswDay=originalDay;snswPostJobs=originalPostJobs');
});

test('typing rewrites the device recovery copy once per content change instead of twice per keystroke',()=>{
  const f=fixture(),disk=new Map(),ls={reads:0,writes:0,getItem(k){ls.reads++;return disk.get(k)??null;},setItem(k,v){ls.writes++;disk.set(k,v);},removeItem(k){disk.delete(k);}};
  f.context.localStorage=ls;f.context.setTimeout=()=>1;f.context.clearTimeout=()=>{};
  f.run('snswRecoveryAccept({scopeId:"scope-A",drafts:[]});socialWorkspaceState.view="compose";socialWorkspaceState.draft.title="제목";socialWorkspaceState.draft.variants=[{channelId:"ch",format:"text",text:"",options:{}}];socialWorkspaceState.dirty=true');
  const key=f.run('socialRecoveryState.localKey'),target={dataset:{swField:'body'},value:'',hasAttribute:()=>false,closest:()=>null},fire=()=>{for(const h of f.handlers.get('input'))h({type:'input',target});};
  ls.reads=0;ls.writes=0;target.value='첫';fire();
  assert.equal(f.run('socialWorkspaceState.draft.body'),'첫');assert.equal(ls.writes,1,'one write per keystroke');assert.equal(ls.reads,1,'one read per keystroke');assert.ok(disk.get(key).includes('"첫"'));
  fire();assert.equal(ls.writes,1,'unchanged content is not written again');
  target.value='첫째';fire();assert.equal(ls.writes,2);assert.equal(ls.reads,2);assert.ok(disk.get(key).includes('"첫째"'));assert.equal(JSON.parse(disk.get(key)).length,1);
  f.context.crypto.randomUUID=()=>'second-key';f.run('snswRecoveryStart();socialWorkspaceState.dirty=true');target.value='첫째 둘째';fire();assert.equal(ls.writes,3,'a new recovery key stores again');assert.equal(JSON.parse(disk.get(key)).length,2);assert.equal(JSON.parse(disk.get(key)).at(-1).draftKey,'draft_second-key');
});

test('input typed while a recovery save is in flight is saved again once that save finishes',async()=>{
  const f=fixture(),disk=new Map(),timers=[];f.context.localStorage={getItem:k=>disk.get(k)??null,setItem:(k,v)=>disk.set(k,v),removeItem:k=>disk.delete(k)};f.context.setTimeout=fn=>{timers.push(fn);return timers.length;};f.context.clearTimeout=()=>{};
  f.run('snswRecoveryAccept({scopeId:"scope-A",drafts:[]});socialWorkspaceState.view="compose";socialWorkspaceState.draft.title="제목";socialWorkspaceState.draft.body="첫 문장";socialWorkspaceState.dirty=true');
  const first=f.run('snswRecoveryFlush()');assert.equal(f.requests[0].path,'/api/social/recovery/save');assert.equal(f.requests[0].body.draft.body,'첫 문장');
  const target={dataset:{swField:'body'},value:'첫 문장 둘째 문장',hasAttribute:()=>false,closest:()=>null};for(const h of f.handlers.get('input'))h({type:'input',target});
  assert.equal(f.run('socialWorkspaceState.draft.body'),'첫 문장 둘째 문장');assert.ok(timers.length>=1);
  const second=timers.at(-1)();await settle();assert.equal(f.requests.length,1,'the debounced flush waits for the running save');
  f.requests[0].resolve({recovery:{revision:1}});await first;await second;
  assert.equal(f.requests.length,2,'the newer text goes to the server once the first save finished');assert.equal(f.requests[1].path,'/api/social/recovery/save');assert.equal(f.requests[1].body.draft.body,'첫 문장 둘째 문장');assert.equal(f.requests[1].body.revision,1);
  f.requests[1].resolve({recovery:{revision:2}});await settle();assert.equal(f.run('socialRecoveryState.revision'),2);assert.equal(f.run('socialRecoveryState.pending'),null);
  const again=f.run('snswRecoveryFlush()');await again;assert.equal(f.requests.length,2,'nothing new to save');
});

test('a recovery summary in the workspace read fetches the full drafts once per distinct summary',async()=>{
  const f=fixture();f.context.summary=(revision,scopeId='scope-A')=>({scopeId,retentionDays:7,maxDrafts:20,summary:true,drafts:[{draftKey:'d1',postId:null,baseRevision:null,revision,updatedAt:'2026-10-14T00:00:00Z',expiresAt:'2026-10-21T00:00:00Z',currentPostRevision:null,conflict:false}]});
  f.context.full=(revision,body)=>({scopeId:'scope-A',drafts:[{draftKey:'d1',postId:null,baseRevision:null,revision,draft:{title:'다른 창 원고',body,variants:[],media:[]},updatedAt:'2026-10-14T00:00:00Z',expiresAt:'2026-10-21T00:00:00Z'}]});
  const first=f.run('snswRecoveryAccept(summary(2))');assert.equal(f.requests.length,1);assert.equal(f.requests[0].path,'/api/social/recovery');assert.equal(f.requests[0].body,undefined);
  f.requests[0].resolve(f.context.full(2,'다른 창 본문'));await first;
  assert.equal(f.run('socialRecoveryState.offers.length'),1);assert.equal(f.run('socialRecoveryState.offers[0].draft.body'),'다른 창 본문');assert.ok(f.run('snswRecoveryPanel()').includes('다른 창 원고'));
  await f.run('snswRecoveryAccept(summary(2))');assert.equal(f.requests.length,1,'the same summary reuses the fetched drafts');assert.equal(f.run('socialRecoveryState.offers[0].draft.body'),'다른 창 본문');
  const load=f.run('snswLoad()');assert.equal(f.requests[1].path.split('?')[0],'/api/social/workspace');f.requests[1].resolve({...JSON.parse(JSON.stringify(f.context.initial)),recovery:f.context.summary(2)});await load;
  assert.equal(f.requests.length,2,'a workspace read with the same summary does not fetch again');assert.equal(f.run('socialRecoveryState.offers[0].draft.body'),'다른 창 본문');
  const third=f.run('snswRecoveryAccept(summary(3))');assert.equal(f.requests[2].path,'/api/social/recovery');f.requests[2].resolve(f.context.full(3,'고친 본문'));await third;
  assert.equal(f.run('socialRecoveryState.offers[0].draft.body'),'고친 본문');assert.equal(f.run('socialRecoveryState.offers[0].revision'),3);
  const stale=f.run('snswRecoveryAccept(summary(4))'),fresh=f.run('snswRecoveryAccept(summary(5))');assert.equal(f.requests.length,5);
  f.requests[4].resolve(f.context.full(5,'가장 새 본문'));await fresh;f.requests[3].resolve(f.context.full(4,'늦게 온 본문'));await stale;
  assert.equal(f.run('socialRecoveryState.offers[0].draft.body'),'가장 새 본문','a late response cannot replace the newer list');
  await f.run('snswRecoveryAccept(summary(5))');assert.equal(f.requests.length,5);
  await f.run('snswRecoveryAccept({scopeId:"scope-A",drafts:[{draftKey:"d9",postId:null,baseRevision:null,revision:1,draft:{title:"옛 서버 원고",body:"옛 서버 본문",variants:[],media:[]},updatedAt:"2026-10-14T00:00:00Z"}]})');
  assert.equal(f.requests.length,5,'a full list without the summary flag is used as it is');assert.equal(f.run('socialRecoveryState.offers[0].draft.title'),'옛 서버 원고');
  const moved=f.run('snswRecoveryAccept(summary(5,"scope-B"))');assert.equal(f.requests[5].path,'/api/social/recovery','a scope change forgets the remembered drafts');f.requests[5].resolve({scopeId:'scope-B',drafts:[]});await moved;assert.equal(f.run('socialRecoveryState.offers.length'),0);
  f.run('socialWorkspaceReset()');assert.equal(f.run('socialRecoveryState.full'),null);
});

test('server counts reach the page only as numbers',()=>{
  const f=fixture();
  f.run('socialWorkspaceState.forms.workflowPreview={action:"edit",validCount:"<img src=x onerror=alert(1)>",errorCount:"<b>2</b>",rows:[],expiresAt:"2026-10-14T00:00:00Z",previewId:"w"};socialWorkspaceState.forms.workflowOwner="bulk"');
  const preview=f.run('snswWorkflowPreview("bulk")');assert.ok(!preview.includes('<img'));assert.ok(!preview.includes('<b>2</b>'));assert.ok(preview.includes('가능한 항목 미확인개'));
  f.run('socialWorkspaceState.forms.workflowPreview.validCount=1234;socialWorkspaceState.forms.workflowPreview.errorCount=0');assert.ok(f.run('snswWorkflowPreview("bulk")').includes('가능한 항목 1,234개 · 오류 0개'));
  f.run('socialWorkspaceState.data.tracking={links:[{id:"l",channelId:"ch",label:"링크",destination:"https://synk.example/",stats:{clicks:"<i>9</i>",visits:"<u>8</u>",siteEventsSeen:true,browserEvents:{signup:"<s>7</s>",trial_start:3},verifiedEvents:{signup:"<em>6</em>",inquiry:0}}}]}');
  const html=f.run('snswTrackingResults()');for(const tag of ['<i>','<u>','<s>','<em>'])assert.ok(!html.includes(tag),tag);
  assert.ok(html.includes('링크 클릭</dt><dd>미확인'));assert.ok(html.includes('사이트 방문</dt><dd>미확인'));assert.ok(html.includes('가입 · 사이트 신고</dt><dd>미확인'));assert.ok(html.includes('가입 · 서버 확인</dt><dd>미확인'));
  assert.ok(html.includes('체험 시작 · 사이트 신고</dt><dd>3'));assert.ok(html.includes('상담 신청 · 서버 확인</dt><dd>0'));
});

test('a copy confirmation after a user change stays with the user who copied',async()=>{
  for(const [setup,action] of [['socialWorkspaceState.forms["review-url:p"]="https://workspace.test/social-review#token"','snswExtendedAction("review-copy","p")'],['socialWorkspaceState.data.tracking={settings:{canConfigure:true}};socialWorkspaceState.forms.trackingKey={key:"secret",endpoint:"https://workspace.test/social-track/verified"}','snswTrackingAction("tracking-key-copy","")']]){
    const f=fixture();let release,copied='';f.context.navigator={clipboard:{writeText:text=>new Promise(resolve=>{copied=text;release=resolve;})}};
    f.run(setup);const work=f.run(action);assert.ok(copied);
    f.context.state.user={id:'other',role:'admin',teamId:'team'};f.run('snswIdentity()');release();await work;
    assert.equal(f.run('socialWorkspaceState.notice'),'',action);assert.equal(f.renders,0,action+' must not redraw the next user');
  }
});

test('the account classification save carries the revision the form was opened with and a conflict reloads the current values',async()=>{
  const f=fixture(),fire=(kind,target)=>{for(const h of f.handlers.get(kind)||[])h({type:kind,target});};
  f.run('socialWorkspaceState.data.channels[0].metaRevision=3;socialWorkspaceState.data.accounts=[{id:"ch",brandId:"LAB",language:"ko",category:"기초",timeZone:"Asia/Seoul"}]');
  assert.ok(f.run('snswAccounts()').includes('<input type="hidden" name="revision" value="3">'));
  const form={dataset:{swForm:'account',id:'ch'},values:{brand:'PULSE',language:'ko',category:'기초',timeZone:'Asia/Seoul',campaign:'',revision:'3'}};
  fire('input',{dataset:{},hasAttribute:()=>false,closest:()=>form});assert.equal(f.run('socialWorkspaceState.forms["account:ch"].revision'),'3');
  f.run('socialWorkspaceState.data.channels[0].metaRevision=4');
  assert.ok(f.run('snswAccounts()').includes('name="revision" value="3"'),'the open form keeps the revision it started from');
  f.context.form=form;let pending=f.run('snswSubmit(form)');assert.equal(f.requests[0].path,'/api/social/accounts/ch');assert.equal(f.requests[0].body.revision,3);assert.equal(f.requests[0].body.brand,'PULSE');
  f.requests[0].reject(Object.assign(new Error('다른 창에서 계정 분류가 바뀌었어요. 새로고침한 뒤 다시 저장해 주세요.'),{status:409}));await settle();
  assert.equal(f.requests[1].path.split('?')[0],'/api/social/workspace','a conflict reloads the workspace');
  const fresh=JSON.parse(JSON.stringify(f.context.initial));fresh.channels[0].metaRevision=4;fresh.accounts=[{id:'ch',brandId:'synk',language:'ko',category:'뉴스',timeZone:'Asia/Seoul'}];f.requests[1].resolve(fresh);await pending;
  assert.equal(f.run('socialWorkspaceState.forms["account:ch"]'),undefined,'the stale typed values are dropped');
  const after=f.run('snswAccounts()');assert.ok(after.includes('name="revision" value="4"'));assert.ok(after.includes('value="synk"'));assert.ok(!after.includes('value="PULSE"'));
  assert.ok(f.run('socialWorkspaceState.error').includes('다른 창에서 계정 분류가 바뀌었어요'));assert.equal(f.run('socialWorkspaceState.busy'),false);
  form.values={brand:'LAB',language:'ko',category:'뉴스',timeZone:'Asia/Seoul',campaign:'',revision:'4'};fire('input',{dataset:{},hasAttribute:()=>false,closest:()=>form});
  pending=f.run('snswSubmit(form)');assert.equal(f.requests[2].body.revision,4);f.requests[2].resolve({ok:true});await settle();assert.equal(f.requests[3].path.split('?')[0],'/api/social/workspace');f.requests[3].resolve(fresh);await pending;
  assert.equal(f.run('socialWorkspaceState.forms["account:ch"]'),undefined,'a saved form forgets its typed copy');assert.equal(f.run('socialWorkspaceState.notice'),'계정 분류를 저장했어요.');
  f.run('delete socialWorkspaceState.data.channels[0].metaRevision');assert.ok(f.run('snswAccounts()').includes('name="revision" value="0"'),'no revision from the server sends 0');
  const other={dataset:{swForm:'account',id:'ch'},values:{brand:'LAB',language:'ko',category:'',timeZone:'Asia/Seoul',campaign:''}};f.context.form=other;pending=f.run('snswSubmit(form)');assert.equal(f.requests[4].body.revision,0);f.requests[4].reject(new Error('offline'));await pending;
  assert.equal(f.requests.length,5,'an ordinary failure does not reload');assert.equal(f.run('socialWorkspaceState.forms["account:ch"].brand'),'LAB','an ordinary failure keeps the typed values');
});

test('a more button keeps the reader at the same place after the redraw',()=>{
  const f=fixture();let main={scrollTop:4200};const next={scrollTop:0},base=f.context.document.querySelector,original=f.context.render;
  f.context.document.querySelector=s=>s==='#main'?main:base(s);f.context.render=()=>{original();main=next;};
  f.run('snswAction("list-more","inbox")');assert.equal(f.renders,1);assert.equal(next.scrollTop,4200,'the redrawn page opens where the more button was');
  next.scrollTop=900;main={scrollTop:900};const again={scrollTop:900};f.context.render=()=>{original();main=again;};f.run('snswAction("list-more","calendar")');assert.equal(again.scrollTop,900,'a redraw that kept the place is left alone');
  f.context.document.querySelector=base;f.context.render=original;f.run('snswAction("list-more","inbox")');assert.equal(f.renders,3,'no page container still redraws');
});

function pagedFixture(){
  const f=fixture();f.context.page={posts:{total:120,limit:50,hasMore:true,nextCursor:'post-next'},jobs:{total:3000,limit:50,hasMore:true,nextCursor:'job-next'}};
  f.run('socialWorkspaceState.data.pagination=JSON.parse(JSON.stringify(page));socialWorkspaceState.loadKey=snswWorkspacePath();socialWorkspaceState.loadedKey=socialWorkspaceState.loadKey');return f;
}
test('workspace requests send bounded pages with the current date, mode and every filter',()=>{
  const f=pagedFixture();f.run('socialWorkspaceState.view="calendar";socialWorkspaceState.calendar="week";socialWorkspaceState.date="2026-10-15";socialWorkspaceState.query="문구 & 검색";socialWorkspaceState.filters={brand:"LAB",channel:"ch",status:"failed",campaign:"c",language:"ko",owner:"u"}');
  const url=new URL(f.run('snswWorkspacePath("jobs")'),'https://workspace.test');
  assert.deepEqual(Object.fromEntries(url.searchParams),{pageSize:'50',section:'calendar',view:'week',date:'2026-10-15',search:'문구 & 검색',brandId:'LAB',channelId:'ch',status:'failed',campaignId:'c',language:'ko',ownerId:'u',jobCursor:'job-next'});
  f.run('socialWorkspaceState.view="settings"');assert.equal(new URL(f.run('snswWorkspacePath()'),'https://workspace.test').searchParams.has('search'),false);
});
test('independent page loading merges unique rows and preserves the other cursor and linked post lookup',async()=>{
  const f=pagedFixture();f.run('socialWorkspaceState.data.posts=[{id:"p1",title:"first"}];socialWorkspaceState.data.jobs=[{id:"j1",postId:"linked"}];socialWorkspaceState.data.linkedPosts=[{id:"linked",title:"job context"}]');
  const pending=f.run('snswAction("page-more","posts")');assert.match(f.requests[0].path,/postCursor=post-next/);assert.ok(!f.requests[0].path.includes('jobCursor='));
  await f.run('snswAction("page-more","posts")');assert.equal(f.requests.length,1);
  f.requests[0].resolve({...f.context.initial,posts:[{id:'p1',title:'updated'},{id:'p2',title:'second'}],jobs:[{id:'ignored'}],linkedPosts:[{id:'context2'}],pagination:{posts:{total:120,limit:50,hasMore:true,nextCursor:'post-final'},jobs:{total:3000,limit:50,hasMore:true,nextCursor:'reset'}}});await pending;
  assert.equal(f.run('socialWorkspaceState.data.posts.length'),2);assert.equal(f.run('socialWorkspaceState.data.posts[0].title'),'updated');assert.equal(f.run('socialWorkspaceState.data.jobs[0].id'),'j1');assert.equal(f.run('socialWorkspaceState.data.pagination.jobs.nextCursor'),'job-next');assert.equal(f.run('socialWorkspaceState.data.pagination.posts.nextCursor'),'post-final');assert.equal(f.run('snswRows("posts").length'),4);assert.equal(f.run('snswPostList().length'),2);
});
test('a filter change replaces an in-flight next page and late pages cannot mix query results',async()=>{
  const f=pagedFixture();f.run('socialWorkspaceState.view="calendar";socialWorkspaceState.loadKey=snswWorkspacePath();socialWorkspaceState.loadedKey=socialWorkspaceState.loadKey');
  f.context.render=()=>{f.run('renderSocialWorkspace();socialWorkspaceEnsure()');};
  const older=f.run('snswAction("page-more","jobs")');f.run('socialWorkspaceState.filters.channel="new-channel";snswRender()');assert.equal(f.requests.length,2);assert.match(f.requests[1].path,/channelId=new-channel/);assert.ok(!f.requests[1].path.includes('Cursor='));
  f.requests[1].resolve({...f.context.initial,posts:[],jobs:[{id:'new'}],pagination:{posts:{total:0,hasMore:false},jobs:{total:1,hasMore:false}}});await settle();
  f.requests[0].resolve({...f.context.initial,jobs:[{id:'old-private'}],pagination:f.context.page});await older;
  assert.equal(f.run('socialWorkspaceState.data.jobs.length'),1);assert.equal(f.run('socialWorkspaceState.data.jobs[0].id'),'new');assert.equal(f.run('socialWorkspaceState.loading'),false);
});
test('calendar uses authoritative counts and occupancy outside the hydrated page without inventing empty slots',()=>{
  const f=pagedFixture();f.run(`socialWorkspaceState.view='calendar';socialWorkspaceState.calendar='day';socialWorkspaceState.date='2099-10-15';socialWorkspaceState.data.posts=[{id:'draft',title:'Unscheduled',hasActiveJobs:false,variants:[]}];socialWorkspaceState.data.linkedPosts=[{id:'scheduled',title:'Linked',hasActiveJobs:true,variants:[]}];socialWorkspaceState.data.jobs=[];socialWorkspaceState.data.pagination.posts.total=120;socialWorkspaceState.data.summary={days:[{day:'2099-10-15',total:100}],jobs:{monthScheduled:1000,monthPublished:800}};socialWorkspaceState.data.occupiedSlots=[{channelId:'ch',scheduledAt:'2099-10-15T00:00:00Z'}];socialWorkspaceState.data.slots=[{channelId:'ch',timezone:'Asia/Seoul',slots:[{weekday:new Date('2099-10-15T12:00Z').getUTCDay(),time:'09:00'}]}]`);
  const html=f.run('snswCalendar()');assert.match(html,/일정 없는 게시물<b>120<\/b>/);assert.match(html,/게시 작업을 더 불러오세요/);assert.ok(!html.includes('빈 시간 칸'));assert.ok(!html.includes('예약 없음'));assert.deepEqual(Array.from(f.run('snswPosterStats("calendar")'),x=>Array.from(x)),[['이달 예약',1000,''],['이달 게시',800,'ok']]);
  f.run('socialWorkspaceState.calendar="month"');assert.match(f.run('snswCalendar()'),/100개 게시 일정 보기">100건/);
});
test('linked posts do not inflate the post list or bulk selection and a later source opens through its detail endpoint',async()=>{
  const f=pagedFixture();f.run('socialWorkspaceState.view="calendar";socialWorkspaceState.calendar="list";socialWorkspaceState.data.posts=[{id:"visible",title:"Visible",variants:[],canEdit:true}];socialWorkspaceState.data.linkedPosts=[{id:"linked",title:"Context only",variants:[],canEdit:true}];socialWorkspaceState.loadKey=snswWorkspacePath();socialWorkspaceState.loadedKey=socialWorkspaceState.loadKey');
  assert.equal(f.run('snswFilteredPosts().length'),1);await f.run('snswExtendedAction("bulk-select-all","")');assert.deepEqual(Array.from(f.run('socialWorkspaceState.forms.bulkSelected')),['visible']);
  const pending=f.run('snswAction("edit","not-in-page")');assert.equal(f.requests[0].path,'/api/social/posts/not-in-page');f.requests[0].resolve({post:{id:'not-in-page',title:'Full source',body:'full body',variants:[],status:'approved',revision:9,canEdit:true},jobs:[{id:'full-job',postId:'not-in-page',status:'published'}]});await pending;
  assert.equal(f.run('socialWorkspaceState.editId'),'not-in-page');assert.equal(f.run('socialWorkspaceState.draft.body'),'full body');assert.equal(f.run('snswPostJobs(socialWorkspaceState.detail.post)[0].id'),'full-job');assert.equal(f.run('socialWorkspaceState.view'),'compose');
});
test('a failed page leaves the existing rows and cursor available and a detail denial never opens stale content',async()=>{
  const f=pagedFixture();f.run('socialWorkspaceState.data.posts=[{id:"p",title:"Existing",variants:[]}]');
  const more=f.run('snswAction("page-more","posts")');f.requests[0].reject(new Error('Page unavailable'));await more;assert.equal(f.run('socialWorkspaceState.data.posts[0].id'),'p');assert.equal(f.run('socialWorkspaceState.data.pagination.posts.nextCursor'),'post-next');assert.match(f.run('snswPageFooter("posts")'),/게시물 더 불러오기/);
  const detail=f.run('snswAction("edit","p")');f.requests[1].reject(Object.assign(new Error('Access denied'),{status:403}));await detail;assert.equal(f.run('socialWorkspaceState.editId'),'');assert.equal(f.run('socialWorkspaceState.detail'),null);assert.match(f.run('socialWorkspaceState.error'),/Access denied/);
});

test('leaving the workspace while a post detail is loading never navigates back into the editor',async()=>{
  const f=pagedFixture(),pending=f.run('snswAction("edit","p")');f.context.state.tab='home';f.requests[0].resolve({post:{id:'p',title:'Late',body:'Late body',variants:[]},jobs:[]});await pending;
  assert.equal(f.context.state.tab,'home');assert.equal(f.run('socialWorkspaceState.editId'),'');assert.equal(f.run('socialWorkspaceState.busy'),false);
});
test('server brand choices and job statuses remain visible outside the hydrated job page',()=>{
  const f=pagedFixture();f.run('socialWorkspaceState.data.summary={brands:["Older brand"]};socialWorkspaceState.data.posts=[{id:"p",title:"Old failed post",variants:[],jobStatuses:["failed","published"]}];socialWorkspaceState.data.jobs=[]');
  assert.match(f.run('snswFilterBar()'),/Older brand/);const html=f.run('snswPostCard(snswPostList()[0])');assert.match(html,/data-status="failed"/);assert.match(html,/data-status="published"/);
});

test('overview renders each bounded preview bucket and keeps its global counts and job actions',async()=>{
  const f=pagedFixture();f.run(`socialWorkspaceState.data.posts=Array.from({length:50},(_,i)=>({id:'recent'+i,title:'Recent published',status:'published'}));socialWorkspaceState.data.jobs=Array.from({length:50},(_,i)=>({id:'old'+i,status:'published'}));socialWorkspaceState.data.overview={review:[{id:'old-review',title:'Old review still pending',status:'review',variants:[]}],drafts:[{id:'old-draft',title:'Earlier draft',status:'draft',variants:[]}],attention:[{id:'missed',postId:'linked',channelId:'ch',status:'missed',scheduledAt:'2026-01-01T00:00:00Z'}],upcoming:[{id:'next',postId:'linked',channelId:'ch',status:'scheduled',scheduledAt:'2099-10-15T00:00:00Z'}]};socialWorkspaceState.data.linkedPosts=[{id:'linked',title:'Future scheduled source',variants:[],canPublish:true}];socialWorkspaceState.data.summary={posts:{draft:21,review:88},jobs:{scheduled:71,attention:64,published7d:500}}`);
  const html=f.run('snswOverview()');assert.match(html,/Old review still pending/);assert.match(html,/Earlier draft/);assert.match(html,/Future scheduled source/);assert.match(html,/63건 더 보기/);assert.match(html,/최근 초안[\s\S]*?21/);assert.ok(!html.includes('게시물 50 /'));
  await f.run('snswAction("job-now","missed")');assert.equal(f.run('socialWorkspaceState.forms.job.id'),'missed');assert.equal(f.run('socialWorkspaceState.forms.job.kind'),'now');
});

test('a failed editor permission refresh preserves authored text but prevents saving until source access is confirmed',async()=>{
  const f=pagedFixture();f.run('socialWorkspaceState.view="compose";socialWorkspaceState.editId="p";socialWorkspaceState.draft={...snswBlank(),id:"p",title:"Keep authored text",body:"unsaved text"};socialWorkspaceState.dirty=true;socialWorkspaceState.detail={post:{id:"p",title:"Old source",canEdit:true,variants:[]},jobs:[]}');
  const pending=f.run('snswLoad()');f.requests[0].resolve({...f.context.initial,posts:[],jobs:[],pagination:f.context.page});await settle();assert.equal(f.requests[1].path,'/api/social/posts/p');f.requests[1].reject(Object.assign(new Error('Source access expired'),{status:404}));await pending;
  assert.equal(f.run('socialWorkspaceState.draft.body'),'unsaved text');assert.equal(f.run('socialWorkspaceState.detailUnavailable'),true);assert.equal(f.run('socialWorkspaceState.detail'),null);assert.match(f.run('snswComposer()'),/<fieldset disabled>/);
  await f.run('snswSavePost()');assert.equal(f.requests.length,2);f.run('socialWorkspaceState.dirty=false;snswOpenDraftReady()');assert.equal(f.run('socialWorkspaceState.detailUnavailable'),false);assert.equal(f.run('socialWorkspaceState.editId'),'');
});

test('capacity renders fifty reservations at a time while preserving full totals, selections and the preview',async()=>{
  const f=fixture();f.run(`socialWorkspaceState.data.capacity={generatedAt:'2026-10-15T00:00:00Z',periodMinutes:15,planningLimit:80,limit:100,reserve:20,jobs:Array.from({length:3333},(_,i)=>({jobId:'capacity-'+i,title:'Reservation '+i,channelId:'ch',scheduledAt:'2026-10-15T00:00:00Z',mode:'fixed',estimatedRequests:3,canMove:true})),windows:[],assumptions:[],warnings:[]};socialWorkspaceState.forms.capacitySelected=['capacity-0'];socialWorkspaceState.forms.capacityFixed=['capacity-0'];socialWorkspaceState.forms.capacityPreview={previewId:'existing-plan',changes:[],warnings:[],validCount:1,blockedCount:0,canApply:true}`);
  const before=f.run('snswCapacityPanel()');assert.equal((before.match(/data-sw-capacity-select=/g)||[]).length,50);assert.match(before,/현재 예약 전체 추정 합계 9,999회 · 3333건/);assert.match(before,/예약 목록 50 \/ 3,333건 표시/);assert.match(before,/data-sw-action="list-more" data-value="capacity"/);assert.ok(!before.includes('Reservation 50'));assert.ok(before.includes('data-sw-capacity-select="capacity-0" checked'));assert.ok(before.includes('data-sw-capacity-fixed="capacity-0" checked'));
  await f.run('snswAction("list-more","capacity")');const after=f.run('snswCapacityPanel()');assert.equal((after.match(/data-sw-capacity-select=/g)||[]).length,100);assert.match(after,/예약 목록 100 \/ 3,333건 표시/);assert.ok(after.includes('Reservation 99'));assert.ok(!after.includes('Reservation 100'));assert.ok(after.includes('data-sw-capacity-select="capacity-0" checked'));assert.ok(after.includes('data-sw-capacity-fixed="capacity-0" checked'));assert.equal(f.run('socialWorkspaceState.forms.capacityPreview.previewId'),'existing-plan');assert.equal(f.requests.length,0);
  f.context.event={type:'change',target:{dataset:{swCapacitySelect:'capacity-75'},checked:true}};f.run('snswFourInput(event)');assert.deepEqual(Array.from(f.run('socialWorkspaceState.forms.capacitySelected')),['capacity-0','capacity-75']);assert.equal(f.run('socialWorkspaceState.forms.capacityPreview'),undefined);
});

function capacityPage({offset=0,revision='capacity-v1',windowOffset=0}={}){return {generatedAt:'2026-10-15T00:00:00Z',scope:'workspace',periodMinutes:60,planningLimit:24,limit:30,reserve:6,summary:{jobCount:143,estimatedRequests:572,windowCount:30},jobs:Array.from({length:Math.min(50,143-offset)},(_,n)=>({jobId:'server-'+(offset+n),title:'Server reservation '+(offset+n),channelId:'ch',scheduledAt:'2026-10-15T01:00:00Z',mode:'fixed',canMove:true,estimatedRequests:4})),windows:Array.from({length:Math.min(12,30-windowOffset)},(_,n)=>({from:new Date(Date.UTC(2026,9,15,0,windowOffset+n)).toISOString(),to:new Date(Date.UTC(2026,9,15,1,windowOffset+n)).toISOString(),estimatedRequests:40,jobCount:10,overLimit:true})),warnings:[],assumptions:[],pagination:{revision,jobs:{total:143,hasMore:offset+50<143,nextCursor:offset+50<143?'jobs-'+(offset+50):null},windows:{total:30,hasMore:windowOffset+12<30,nextCursor:windowOffset+12<30?'windows-'+(windowOffset+12):null}}};}

test('capacity server pages retain full totals, checked fixed consent and preview while jobs and windows load independently',async()=>{
  const f=fixture();f.context.capacity=capacityPage();f.run('socialWorkspaceState.view="queue";socialWorkspaceState.data.capacity=capacity;socialWorkspaceState.forms.capacitySelected=["server-0"];socialWorkspaceState.forms.capacityFixed=["server-0"];socialWorkspaceState.forms.capacityPreview={previewId:"existing",changes:[],warnings:[],canApply:true}');
  const first=f.run('snswCapacityPanel()');assert.match(first,/현재 예약 전체 추정 합계 572회 · 143건/);assert.match(first,/예약 목록 50 \/ 143건 표시/);assert.match(first,/시간창 12 \/ 30개 표시/);
  const more=f.run('snswAction("capacity-more","jobs")');assert.equal(f.requests.length,1);const url=new URL(f.requests[0].path,'https://workspace.test');assert.equal(url.pathname,'/api/social/capacity');assert.equal(url.searchParams.get('cursor'),'jobs-50');assert.equal(f.requests[0].body,undefined);await f.run('snswAction("capacity-more","jobs")');assert.equal(f.requests.length,1);
  f.requests[0].resolve(capacityPage({offset:50}));await more;const second=f.run('snswCapacityPanel()');assert.equal((second.match(/data-sw-capacity-select=/g)||[]).length,100);assert.match(second,/예약 목록 100 \/ 143건 표시/);assert.ok(second.includes('data-sw-capacity-fixed="server-0" checked'));assert.equal(f.run('socialWorkspaceState.forms.capacityPreview.previewId'),'existing');assert.equal(f.run('socialWorkspaceState.data.capacity.windows.length'),12);
  const windows=f.run('snswAction("capacity-more","windows")');assert.equal(new URL(f.requests[1].path,'https://workspace.test').searchParams.get('windowCursor'),'windows-12');f.requests[1].resolve(capacityPage({windowOffset:12}));await windows;assert.equal(f.run('socialWorkspaceState.data.capacity.windows.length'),24);assert.equal(f.run('socialWorkspaceState.data.capacity.jobs.length'),100);assert.match(f.run('snswCapacityPanel()'),/시간창 24 \/ 30개 표시/);
});

test('read-only viewers can fetch further capacity pages without access to apply mutations',async()=>{
  const f=fixture();f.context.state.user.role='viewer';f.run('snswIdentity()');f.context.capacity=capacityPage();f.context.initial={...f.context.initial,capacity:f.context.capacity};f.run('socialWorkspaceState.view="queue";socialWorkspaceState.data=initial');
  const more=f.run('snswAction("capacity-more","jobs")');assert.equal(f.requests.length,1);assert.equal(new URL(f.requests[0].path,'https://workspace.test').pathname,'/api/social/capacity');assert.equal(f.requests[0].body,undefined);
  f.requests[0].resolve(capacityPage({offset:50}));await more;assert.equal(f.run('socialWorkspaceState.data.capacity.jobs.length'),100);
  f.run('socialWorkspaceState.forms.capacityPreview={previewId:"fake-plan",canApply:true}');await f.run('snswAction("capacity-apply","")');assert.equal(f.requests.length,1);
});

test('capacity late pages cannot cross a reload or identity change, and current stale failures invalidate apply',async()=>{
  const f=fixture();f.context.capacity=capacityPage();f.run('socialWorkspaceState.view="queue";socialWorkspaceState.data.capacity=capacity;socialWorkspaceState.forms.capacityRevision="capacity-v1";socialWorkspaceState.forms.capacitySelected=["server-75"];socialWorkspaceState.forms.capacityFixed=["server-75"];socialWorkspaceState.forms.capacityPreview={previewId:"old",canApply:true}');
  const more=f.run('snswCapacityMore("jobs")'),reload=f.run('snswLoad()');f.requests[1].resolve({...f.context.initial,capacity:capacityPage({revision:'capacity-v2'})});await reload;f.requests[0].resolve(capacityPage({offset:50}));await more;assert.equal(f.run('socialWorkspaceState.data.capacity.pagination.revision'),'capacity-v2');assert.equal(f.run('socialWorkspaceState.data.capacity.jobs.length'),50);assert.equal(f.run('socialWorkspaceState.forms.capacitySelected.length'),0);assert.equal(f.run('socialWorkspaceState.forms.capacityPreview'),undefined);
  f.run('socialWorkspaceState.forms.capacityPreview={previewId:"stale",canApply:true}');const stale=f.run('snswCapacityMore("jobs")');f.requests[2].reject(Object.assign(new Error('예약이 바뀌었어요. 새로고침해 주세요.'),{status:409}));await stale;assert.match(f.run('socialWorkspaceState.error'),/새로고침/);assert.equal(f.run('socialWorkspaceState.forms.capacityPreview'),undefined);assert.equal(f.run('socialWorkspaceState.data.capacity.jobs.length'),50);
  const last=f.run('snswCapacityMore("jobs")');f.context.state.user={id:'another',role:'viewer'};f.run('snswIdentity()');f.requests[3].resolve(capacityPage({offset:50}));await last;assert.equal(f.run('socialWorkspaceState.data'),null);assert.equal(f.run('socialWorkspaceState.forms.capacitySelected'),undefined);
});

test('same capacity revision keeps loaded pages and selected reservations after a workspace refresh',async()=>{
  const f=fixture();f.context.capacity={...capacityPage(),jobs:[...capacityPage().jobs,...capacityPage({offset:50}).jobs],pagination:{...capacityPage().pagination,jobs:capacityPage({offset:50}).pagination.jobs}};f.run('socialWorkspaceState.view="queue";socialWorkspaceState.data.capacity=capacity;socialWorkspaceState.forms.capacityRevision="capacity-v1";socialWorkspaceState.forms.capacitySelected=["server-75"];socialWorkspaceState.forms.capacityFixed=["server-75"]');
  const load=f.run('snswLoad()');f.requests[0].resolve({...f.context.initial,capacity:capacityPage()});await load;assert.equal(f.run('socialWorkspaceState.data.capacity.jobs.length'),100);assert.equal(f.run('socialWorkspaceState.data.capacity.pagination.jobs.nextCursor'),'jobs-100');assert.deepEqual(Array.from(f.run('socialWorkspaceState.forms.capacitySelected')),['server-75']);assert.deepEqual(Array.from(f.run('socialWorkspaceState.forms.capacityFixed')),['server-75']);
});

test('a workspace detail refresh cannot replace a newer editor or a reopened revision of the same post',async()=>{
  const make=(id,revision)=>({id,revision,contentVersion:revision,status:'approved',title:id,body:'Body '+id,variants:[{channelId:'ch',format:'text',options:{}}],media:[],source:{},canEdit:true,canApprove:true,canPublish:true});
  for(const scenario of [{next:'b',deny:false},{next:'a',deny:false},{next:'b',deny:true}]){
    const f=pagedFixture(),a=make('a',1),b=make('b',1),fresh=make(scenario.next,2),data={...f.context.initial,posts:[a],linkedPosts:[b],jobs:[],pagination:f.context.page};f.context.data=data;f.context.a=a;f.context.next=scenario.next;
    f.run('socialWorkspaceState.data=data;socialWorkspaceState.view="compose";socialWorkspaceState.editId="a";socialWorkspaceState.draft=snswEditorDraft(a);socialWorkspaceState.loadKey=snswWorkspacePath();socialWorkspaceState.loadedKey=socialWorkspaceState.loadKey');
    const loading=f.run('snswLoad()');f.requests[0].resolve(data);await settle();assert.equal(f.requests[1].path,'/api/social/posts/a');
    const opening=f.run('snswOpenDraft(next,true)');f.requests[2].resolve({post:fresh,jobs:[]});await opening;
    if(scenario.deny)f.requests[1].reject(Object.assign(new Error('Old source denied'),{status:404}));else f.requests[1].resolve({post:a,jobs:[]});await loading;
    assert.equal(f.run('socialWorkspaceState.editId'),scenario.next);assert.equal(f.run('socialWorkspaceState.detail.post.id'),scenario.next);assert.equal(f.run('socialWorkspaceState.detail.post.revision'),2);assert.equal(f.run('snswRows("posts").find(p=>p.id===next).revision'),2);assert.equal(f.run('socialWorkspaceState.draft.revision'),2);assert.equal(f.run('socialWorkspaceState.detailUnavailable'),false);assert.equal(f.run('socialWorkspaceState.error'),'');assert.equal(f.run('socialWorkspaceState.loading'),false);
  }
});
test('results offer the post address register link only to people who can write',()=>{
  const f=fixture(),has=()=>f.run('snswResults()').includes('publicationAction=register');
  assert.equal(has(),true);assert.match(f.run('snswResults()'),/게시 주소로 추가/);
  f.context.state.user.role='viewer';assert.equal(has(),false);
  f.context.state.user.role='admin';f.run('socialWorkspaceState.data.canWrite=false');assert.equal(has(),false);
});
