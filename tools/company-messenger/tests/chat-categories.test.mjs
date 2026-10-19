import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/\bboot\(\);\s*$/,'');
const rooms=()=>[
  {id:'self',kind:'self',scope:'private',name:'나에게 메모',memberIds:['u1'],unread:0},
  {id:'dm',kind:'dm',scope:'private',name:'지민',memberIds:['u1','u2'],unread:2},
  {id:'team',kind:'channel',scope:'team',category:'team',teamId:'marketing',name:'마케팅팀',memberIds:['u1','u2'],unread:3},
  {id:'public',kind:'channel',scope:'public',category:'team',name:'팀 라운지',memberIds:['u1','u2','u3'],unread:4},
  {id:'project',kind:'channel',scope:'public',category:'project',name:'공개 프로젝트',memberIds:['u1','u2','u3'],unread:0},
  {id:'legacy',kind:'channel',category:'team',name:'이전 공용방',memberIds:['u1','u2','u3'],unread:1},
];
function fixture(){
  const nodes=new Map(),collections=new Map(),storage=new Map(),requests=[],uploads=[],notifications=[],reads=[],renders=[];
  const node=(selector='')=>{const classes=new Set(),attrs={};return{selector,innerHTML:'',textContent:'',value:'',disabled:false,hidden:false,open:false,isConnected:true,inert:false,dataset:{},style:{},scrollTop:0,scrollHeight:200,clientHeight:200,
    classList:{add:(...values)=>values.forEach(value=>classes.add(value)),remove:(...values)=>values.forEach(value=>classes.delete(value)),contains:value=>classes.has(value),toggle:(value,force)=>{const enable=force??!classes.has(value);if(enable)classes.add(value);else classes.delete(value);return enable;}},
    setAttribute:(key,value)=>attrs[key]=String(value),getAttribute:key=>attrs[key]??null,removeAttribute:key=>delete attrs[key],hasAttribute:key=>key in attrs,
    addEventListener(){},querySelector:selector=>nodes.get(selector)||null,querySelectorAll:selector=>collections.get(selector)||[],contains:()=>false,closest:selector=>nodes.get(selector)||null,
    focus(){document.activeElement=this;},append(){},insertAdjacentHTML(){},getBoundingClientRect:()=>({left:0,top:0,width:800,height:600}),getClientRects:()=>[{}]};};
  const get=selector=>{if(!nodes.has(selector))nodes.set(selector,node(selector));return nodes.get(selector);};
  const document={hidden:false,activeElement:null,body:node('body'),querySelector:selector=>nodes.get(selector)||null,querySelectorAll:selector=>collections.get(selector)||[],addEventListener(){},getElementById:id=>nodes.get('#'+id)||null,createElement:()=>node()};
  for(const selector of ['#app','#modal','#sidebar','.sidebar-scroll','#self-nav','#dm-nav','#team-nav','#channel-nav','#channel-title','#breadcrumb-type','#channel-about','#channel-options','#composer-input','#composer-status','#composer-form','#composer-wrap','#send-message','#attach-file','#composer-emoji','#file-input','#reply-context','#upload-queue','#message-list','#message-scroll','#jump-latest','#drawer','#create-project','#create-channel','#new-dm','#channel-members','#nav-unread-count','#unread-empty','#member-number','#tab-chat','#tab-files','#tab-pins','#chat-area','#files-view','#pins-view','#file-results','#files-count','#drop-overlay','#mobile-menu','#mobile-scrim','.main'])get(selector);
  const categoryButtons=['personal','team','all'].map(category=>{const button=get(`[data-chat-category="${category}"]`),badge=node();button.dataset.chatCategory=category;button.querySelector=selector=>selector==='.category-unread'?badge:null;return button;});collections.set('[data-chat-category]',categoryButtons);
  const categorySections=['personal','team','all'].map(category=>{const section=get(`[data-chat-section="${category}"]`);section.dataset.chatSection=category;section.querySelector=selector=>selector==='[data-channel]'?node():null;return section;});collections.set('[data-chat-section]',categorySections);collections.set('.sidebar-scroll .nav-section',categorySections);
  for(const selector of ['#chat-category-tabs','#chat-category-description','#chat-category-title','#search-input','#search-scope','#drawer-body'])get(selector);
  const context=vm.createContext({document,location:{pathname:'/',origin:'http://localhost'},window:{parent:{},matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener(){}},localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)},setTimeout:()=>1,clearTimeout(){},URL,URLSearchParams,Intl,crypto:{randomUUID:()=> 'fixture-uuid'},CSS:{escape:String}});
  const run=code=>vm.runInContext(code,context);run(source);
  context.syntheticRooms=rooms();run("Object.assign(state,{user:{id:'u1',name:'유호',role:'owner',teamId:'marketing'},channels:syntheticRooms,members:[{id:'u1',name:'유호',teamId:'marketing'},{id:'u2',name:'지민',teamId:'marketing'},{id:'u3',name:'민서',teamId:'design'}],teams:[{id:'marketing',name:'마케팅팀',canOpen:true},{id:'design',name:'디자인팀',canOpen:false}],channelId:'self',chatCategory:'personal',categoryFilters:{personal:'all',team:'all',all:'all'},categoryChannels:{personal:'self'},mode:'chat'});");
  context.request=(path,options={})=>new Promise((resolve,reject)=>requests.push({path,options,resolve,reject}));context.notice=(...args)=>notifications.push(args);context.recordRead=async channelId=>reads.push(channelId);context.recordRender=()=>renders.push(run('state.channelId'));context.recordUpload=(...args)=>uploads.push(args);
  run('api=request;toast=notice;markRead=recordRead;renderMessages=recordRender;uploadFile=recordUpload;renderDirectory=()=>{};parentMessage=()=>{};');
  return{run,context,nodes,get,collections,storage,requests,uploads,notifications,reads,renders,document,node,state:run('state')};
}
const emptyResponse={messages:[],hasMore:false};
async function settleLast(f,result=emptyResponse){f.requests.at(-1).resolve(result);await Promise.resolve();await Promise.resolve();}

test('personal/team/all classification follows real scope, never a legacy team label or project name',()=>{
  const f=fixture();assert.deepEqual(Array.from(f.run('state.channels.map(channelCategory)')),['personal','personal','team','all','all','all']);
  const groups=f.run('conversationGroups(state.channels)');assert.deepEqual(Array.from(groups.public,row=>row.id),['public','project','legacy']);assert.deepEqual(Array.from(groups.team,row=>row.id),['team']);assert.deepEqual(Array.from(groups.personal,row=>row.id),['self','dm']);
});

test('room finder matches visible names, purposes and DM teams without changing the category or permissions',()=>{
  const f=fixture();f.state.roomQuery='  지민  ';assert.equal(f.run("matchesRoomQuery(state.channels[1])"),true);assert.equal(f.run("matchesRoomQuery(state.channels[0])"),false);
  f.state.members[1].teamName='SYNK LAB';f.state.roomQuery='synk lab';assert.equal(f.run("matchesRoomQuery(state.channels[1])"),true);
  f.state.channels[3].systemKey='info';f.state.roomQuery='자료';assert.equal(f.run("matchesRoomQuery(state.channels[3])"),true);
  f.state.roomQuery='   ';assert.equal(f.run("matchesRoomQuery(state.channels[0])"),true);
  assert.equal(f.state.chatCategory,'personal');assert.equal(f.requests.length,0);
});

test('room finder combines unread filtering within the active category and escapes malicious names',()=>{
  const f=fixture();f.state.roomQuery='지민';f.state.navFilter='unread';f.run('renderNavigation()');
  assert.match(f.get('#dm-nav').innerHTML,/data-channel="dm"/);assert.equal(f.get('#self-nav').innerHTML,'');assert.doesNotMatch(f.get('#dm-nav').innerHTML,/data-channel="team"/);
  f.state.channels[1].name='<img src=x onerror=alert(1)>';f.state.roomQuery='';const markup=f.run('conversationNavItem(state.channels[1])');assert.match(markup,/&lt;img/);assert.doesNotMatch(markup,/<img src=x/);
});

test('direct room navigation clears a stale room query while retaining the source room draft',async()=>{
  const f=fixture();f.state.roomQuery='지민';f.get('#composer-input').value='작성 중인 메모';
  const pending=f.run("selectChannel('team')");await settleLast(f);await pending;
  assert.equal(f.state.roomQuery,'');assert.equal(f.storage.get('synk-messenger:draft:u1:self'),'작성 중인 메모');assert.equal(f.state.channelId,'team');
});

test('direct room selection synchronizes category and revisiting a category restores its last room',async()=>{
  const f=fixture();let pending=f.run("selectChannel('project')");assert.equal(f.state.chatCategory,'all');assert.equal(f.state.channelId,'project');await settleLast(f);await pending;
  pending=f.run("selectChannel('team')");assert.equal(f.state.chatCategory,'team');await settleLast(f);await pending;
  pending=f.run("selectChatCategory('personal')");assert.equal(f.state.chatCategory,'personal');assert.equal(f.state.channelId,'self');await settleLast(f);await pending;
  pending=f.run("selectChatCategory('all')");assert.equal(f.state.channelId,'project','switching categories returns to the last selected room, not its first room');await settleLast(f);await pending;
  const count=f.requests.length;await f.run("selectChannel('inaccessible-room')");await f.run("selectChatCategory('unknown')");assert.equal(f.requests.length,count);assert.equal(f.state.channelId,'project');
});

test('each category keeps its unread filter and only its own sidebar section is exposed',async()=>{
  const f=fixture();f.run("state.navFilter='unread'");
  let pending=f.run("selectChatCategory('all')");await settleLast(f);await pending;assert.equal(f.state.navFilter,'all');assert.equal(f.state.categoryFilters.personal,'unread');
  f.state.navFilter='unread';pending=f.run("selectChatCategory('team')");await settleLast(f);await pending;assert.equal(f.state.navFilter,'all');assert.equal(f.state.categoryFilters.all,'unread');
  pending=f.run("selectChatCategory('personal')");await settleLast(f);await pending;assert.equal(f.state.navFilter,'unread');
  f.run('renderNavigation()');
  for(const category of ['personal','team','all']){const section=f.get(`[data-chat-section="${category}"]`),button=f.get(`[data-chat-category="${category}"]`);assert.equal(section.hidden||section.classList.contains('hidden'),category!=='personal');assert.equal(button.getAttribute('aria-selected')||button.getAttribute('aria-pressed'),String(category==='personal'));}
});

test('opening an already-read room directly resets its category filter so the selected room stays visible',async()=>{
  const f=fixture();f.state.navFilter='unread';f.state.categoryFilters.all='unread';
  const pending=f.run("selectChannel('project')");await settleLast(f);await pending;
  assert.equal(f.state.chatCategory,'all');assert.equal(f.state.channelId,'project');assert.equal(f.state.navFilter,'all');assert.equal(f.state.categoryFilters.all,'all');
  assert.match(f.get('#channel-nav').innerHTML,/data-channel="project"/);
  assert.equal(f.get('[data-chat-section="all"]').classList.contains('hidden'),false);
});

test('an empty team tab saves the previous draft/reply/attachments and makes no null-room requests',async()=>{
  const f=fixture(),box=f.get('#composer-input');box.value='개인 메모 초안';f.state.channels=f.state.channels.filter(room=>room.scope!=='team');f.state.teams=[];f.state.user.teamId=null;
  f.run("state.replyTarget={id:'parent',channelId:'self',body:'원래 메모',user:{id:'u1',name:'유호'}};saveReply();state.queues.set('self',[{key:'upload-a',status:'done',name:'draft.txt',size:3,file:{id:'file-a',channelId:'self',uploaderId:'u1',name:'draft.txt',size:3}}]);persistQueue('self');");
  await f.run("selectChatCategory('team')");assert.equal(f.state.chatCategory,'team');assert.equal(f.state.channelId,null);assert.equal(f.requests.length,0);assert.equal(box.disabled,true);assert.equal(f.get('#send-message').disabled,true);
  assert.equal(f.storage.get('synk-messenger:draft:u1:self'),'개인 메모 초안');assert.equal(JSON.parse(f.storage.get('synk-messenger:reply:u1:self')).id,'parent');assert.equal(JSON.parse(f.storage.get('synk-messenger:attachments:u1:self'))[0].file.id,'file-a');
  f.get('#send-message').disabled=false;box.value='전송하면 안 되는 값';await f.run('sendMessage({preventDefault(){}})');f.run("addFiles([{name:'blocked.txt',size:3}])");
  f.state.drawer='search';f.get('#search-input').value='찾기';f.get('#search-scope').checked=true;await f.run('runSearch()');assert.equal(f.requests.length,0);assert.equal(f.uploads.length,0);
  const pending=f.run("selectChatCategory('personal')");assert.equal(f.state.channelId,'self');assert.equal(box.value,'개인 메모 초안');assert.equal(f.state.replyTarget.id,'parent');assert.equal(f.run("queue()[0].file.id"),'file-a');await settleLast(f);await pending;
  assert.equal([...f.storage.keys()].some(key=>key.endsWith(':null')),false,'empty tabs must not create a shared null-room draft');
});

test('a message load completing after a switch to an empty category cannot repaint or mark the old room read',async()=>{
  const f=fixture();f.state.channels=f.state.channels.filter(room=>room.scope!=='team');f.state.teams=[];
  const loading=f.run("selectChannel('dm')");const old=f.requests[0];await f.run("selectChatCategory('team')");const empty=f.get('#message-list').innerHTML;
  old.resolve({messages:[{id:'old',body:'이전 개인 대화'}],hasMore:true});await loading;
  assert.equal(f.state.channelId,null);assert.equal(f.state.chatCategory,'team');assert.equal(f.state.messages.length,0);assert.equal(f.get('#message-list').innerHTML,empty);assert.deepEqual(f.reads,[]);assert.deepEqual(f.renders,[]);
});

test('a realtime refresh wins over a late initial history response or error',async()=>{
  for(const fails of [false,true]){
    const f=fixture(),loading=f.run("selectChannel('dm')"),initial=f.requests[0];
    const refreshing=f.run('refreshMessages()');
    f.requests[1].resolve({messages:[{id:'new',body:'실시간 최신 대화'}],hasMore:false});await refreshing;
    const markup=f.get('#message-list').innerHTML;
    if(fails)initial.reject(new Error('늦은 첫 요청 실패'));else initial.resolve({messages:[{id:'old',body:'오래된 첫 대화'}],hasMore:true});
    await loading;
    assert.equal(f.state.messages[0].id,'new');assert.equal(f.state.hasMore,false);
    assert.equal(f.get('#message-list').innerHTML,markup);assert.deepEqual(f.renders,['dm']);assert.deepEqual(f.reads,['dm']);
  }
});

test('an initial history response is still usable if the concurrent refresh failed',async()=>{
  const f=fixture(),loading=f.run("selectChannel('dm')"),initial=f.requests[0];
  const refreshing=f.run('refreshMessages()'),rejected=assert.rejects(refreshing,/재조회 실패/);
  f.requests[1].reject(new Error('재조회 실패'));await rejected;
  initial.resolve({messages:[{id:'initial',body:'첫 대화'}],hasMore:false});await loading;
  assert.equal(f.state.messages[0].id,'initial');assert.deepEqual(f.renders,['dm']);assert.deepEqual(f.reads,['dm']);
});

test('pending read receipts do not hold initial history or realtime refresh completion',async()=>{
  const f=fixture();let finishRead;f.context.readPending=new Promise(resolve=>{finishRead=resolve;});
  f.run('markRead=()=>readPending');
  let selected=false,refreshed=false;
  const loading=f.run("selectChannel('dm')").then(()=>{selected=true;});
  f.requests[0].resolve({messages:[{id:'initial',body:'첫 대화'}],hasMore:false});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(selected,true);assert.equal(f.state.messages[0].id,'initial');
  const refreshing=f.run('refreshMessages()').then(()=>{refreshed=true;});
  f.requests[1].resolve({messages:[{id:'new',body:'최신 대화'}],hasMore:false});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(refreshed,true);assert.equal(f.state.messages[0].id,'new');
  finishRead();await Promise.all([loading,refreshing]);
});

test('a pending DM or team-room creation cannot pull the user back after a category change',async()=>{
  for(const kind of ['dm','team']){
    const f=fixture();f.state.channels=f.state.channels.filter(room=>room.kind==='self');f.run('refreshChannels=async()=>{};refreshDirectory=async()=>{};');
    const pending=f.run(kind==='dm'?"openDirectMessage('u3')":"openTeamConversation('marketing')");assert.equal(f.requests.length,1);assert.equal(f.requests[0].options.method,'POST');
    await f.run("selectChatCategory('all')");assert.equal(f.state.channelId,null);assert.equal(f.state.chatCategory,'all');
    f.state.channels.push(kind==='dm'?{id:'created',kind:'dm',memberIds:['u1','u3'],name:'민서'}:{id:'created',kind:'channel',scope:'team',teamId:'marketing',name:'마케팅팀'});
    f.requests[0].resolve({channel:{id:'created'}});await pending;assert.equal(f.state.chatCategory,'all');assert.equal(f.state.channelId,null);assert.equal(f.requests.length,1);
  }
});

test('revoking the active team room leaves the team category empty and disables its composer',async()=>{
  const f=fixture();f.state.chatCategory='team';f.state.channelId='team';f.state.categoryChannels.team='team';
  const pending=f.run('refreshChannels()');f.requests[0].resolve({channels:f.state.channels.filter(room=>room.id!=='team')});await pending;
  assert.equal(f.state.chatCategory,'team');assert.equal(f.state.channelId,null);assert.equal(f.get('#composer-input').disabled,true);assert.equal(f.requests.length,1,'revocation cannot fall back to an unrelated personal room');
});

test('only actual team membership can create a team conversation, including administrators and viewers',async()=>{
  const f=fixture();
  await f.run("openTeamConversation('design')");await f.run("openTeamConversation('missing')");assert.equal(f.requests.length,0,'administrator does not bypass canOpen membership');
  f.state.integrated={canWrite:false};await f.run("openTeamConversation('marketing')");assert.equal(f.requests.length,0,'viewer cannot create a team conversation');
});

test('default public rooms use system identifiers for ordering and never infer announcement permissions from names',()=>{
  const f=fixture();f.context.publicRooms=[
    {id:'custom',kind:'channel',scope:'public',name:'공지',canPost:true},
    {id:'social',kind:'channel',scope:'public',name:'수다방',systemKey:'social',canPost:true},
    {id:'project',kind:'channel',scope:'public',name:'프로젝트',category:'project',canPost:true},
    {id:'info',kind:'channel',scope:'public',name:'정보방',systemKey:'info',canPost:true},
    {id:'announcement',kind:'channel',scope:'public',name:'공지',systemKey:'announcements',canPost:false},
  ];
  assert.deepEqual(Array.from(f.run('sortedPublicChannels(publicRooms)'),room=>room.id),['announcement','info','social','custom','project']);
  f.run("state.channels=publicRooms;state.channelId='custom';state.chatCategory='all';renderNavigation()");
  assert.equal(f.run('canPostToChannel()'),true);assert.equal(f.run("canPostToChannel(state.channels.find(room=>room.id==='announcement'))"),false);
  const html=f.get('#channel-nav').innerHTML;assert.ok(html.indexOf('data-channel="announcement"')<html.indexOf('data-channel="info"'));assert.ok(html.indexOf('data-channel="info"')<html.indexOf('data-channel="social"'));
  assert.match(html,/data-system-key="announcements"/);assert.equal(f.run("chatCategories.find(([key])=>key==='team')[1]"),'팀채팅');
});

test('crew can read announcements and react or delete their old posts while all posting controls and handlers are blocked',async()=>{
  const f=fixture();f.get('#channel-write-notice');f.state.channels.push({id:'notice',name:'공지',kind:'channel',scope:'public',systemKey:'announcements',canPost:false,memberIds:['u1','u2']});
  f.state.user.role='member';f.state.channelId='notice';f.state.chatCategory='all';f.get('#composer-input').value='전송 금지 초안';f.run('syncComposerAccess()');
  assert.equal(f.get('#composer-input').disabled,false);assert.equal(f.get('#composer-input').readOnly,true);
  for(const selector of ['#attach-file','#composer-emoji','#file-input','#send-message'])assert.equal(f.get(selector).disabled,true,selector);
  for(const selector of ['#tab-files','#tab-pins'])assert.equal(f.get(selector).disabled,false,selector);
  assert.match(f.get('#channel-write-notice').textContent,/공지는 관리자만/);
  f.context.noticeMessage={id:'old-notice',channelId:'notice',body:'이전 크루 글',user:{id:'u1',name:'유호'},createdAt:'2026-09-30T00:00:00Z',files:[],reactions:[],pinned:true};
  const html=f.run('messageHtml(noticeMessage)');
  for(const action of ['reply','edit','pin'])assert.ok(!html.includes(`data-action="${action}"`),action);
  assert.ok(html.includes('data-action="reaction-picker"'));assert.ok(html.includes('data-action="delete"'));
  f.run("state.drawer='thread';state.thread={parent:noticeMessage,messages:[]};renderThread()");assert.ok(!f.get('#drawer-body').innerHTML.includes('data-thread-reply'));
  f.get('#send-message').disabled=false;await f.run('sendMessage({preventDefault(){}})');f.run("addFiles([{name:'blocked.txt',size:3}]);startReply(noticeMessage);editMessageDialog(noticeMessage)");await f.run('togglePin(noticeMessage,{})');
  assert.equal(f.requests.length,0);assert.equal(f.uploads.length,0);assert.equal(f.state.replyTarget,null);assert.equal(f.get('#modal').open,false);
  f.state.integrated={canWrite:false};const viewer=f.run('messageHtml(noticeMessage)');assert.ok(!viewer.includes('data-action="delete"'));assert.ok(!viewer.includes('data-action="reaction-picker"'));
  f.state.integrated={canWrite:true};f.state.channels.find(room=>room.id==='notice').canPost=true;f.run('syncComposerAccess()');assert.equal(f.get('#composer-input').readOnly,false);assert.equal(f.get('#attach-file').disabled,false);assert.ok(f.run('messageHtml(noticeMessage)').includes('data-action="edit"'));
});

test('refreshed announcement permissions immediately disable writing without losing an existing draft or limiting ordinary rooms',async()=>{
  const f=fixture();f.get('#channel-write-notice');f.state.channels.push({id:'notice',name:'공지',kind:'channel',scope:'public',systemKey:'announcements',canPost:true,memberIds:['u1','u2']});
  f.state.channelId='notice';f.state.chatCategory='all';f.get('#composer-input').value='권한 변경 전 초안';f.run('syncComposerAccess()');assert.equal(f.get('#composer-input').readOnly,false);
  const pending=f.run('refreshChannels()');f.requests[0].resolve({channels:f.state.channels.map(room=>({...room,...(room.id==='notice'?{canPost:false}:{})}))});await pending;
  assert.equal(f.get('#composer-input').readOnly,true);assert.equal(f.get('#send-message').disabled,true);assert.equal(f.get('#composer-input').value,'권한 변경 전 초안');assert.deepEqual(f.renders,['notice']);
  const selecting=f.run("selectChannel('public')");await settleLast(f);await selecting;
  assert.equal(f.get('#composer-input').readOnly,false);assert.equal(f.get('#attach-file').disabled,false);assert.equal(f.storage.get('synk-messenger:draft:u1:notice'),'권한 변경 전 초안');
  assert.equal(f.get('#channel-write-notice').textContent,'');
});
