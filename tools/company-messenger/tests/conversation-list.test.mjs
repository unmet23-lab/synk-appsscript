// 메신저 한 목록(2026-11-06 새 판): 개인/팀/전체 세 칸 시험(chat-categories)을 옮겨 왔다.
// 지키는 것은 그대로 — 초안 · 답글 · 첨부 보존, 늦은 응답이 화면을 되돌리지 않음, 권한 동기화, 공지방 권한, 팀 방 만들기 권한.
// 새로 지키는 것 — 대화방 → 사람 두 묶음, 방을 떠날 때만 다시 세우는 줄 순서, 안 읽음 걸러보기에서도 연 방은 남음, 묶음 접기 기억, 「새 대화」 메뉴 권한.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

import {appSource as source,installMessengerModules} from './support/messenger-client.mjs';
const rooms=()=>[
  {id:'self',kind:'self',scope:'private',name:'나에게',memberIds:['u1'],unread:0,lastMessageAt:'2026-11-06T00:10:00Z'},
  {id:'dm',kind:'dm',scope:'private',name:'지민',memberIds:['u1','u2'],unread:2,lastMessageAt:'2026-11-06T01:00:00Z'},
  {id:'team',kind:'channel',scope:'team',category:'team',teamId:'marketing',name:'마케팅팀',memberIds:['u1','u2'],unread:3,lastMessageAt:'2026-11-06T02:00:00Z'},
  {id:'public',kind:'channel',scope:'public',category:'team',name:'팀 라운지',memberIds:['u1','u2','u3'],unread:4,lastMessageAt:'2026-11-06T00:30:00Z'},
  {id:'project',kind:'channel',scope:'public',category:'project',name:'공개 프로젝트',memberIds:['u1','u2','u3'],unread:0,lastMessageAt:'2026-11-06T03:00:00Z'},
  {id:'legacy',kind:'channel',category:'team',name:'이전 공용방',memberIds:['u1','u2','u3'],unread:1,lastMessageAt:null},
];
function fixture(){
  const nodes=new Map(),collections=new Map(),storage=new Map(),requests=[],uploads=[],notifications=[],reads=[],renders=[];
  const node=(selector='')=>{const classes=new Set(),attrs={};return{selector,innerHTML:'',textContent:'',value:'',disabled:false,hidden:false,open:false,isConnected:true,inert:false,dataset:{},style:{},scrollTop:0,scrollHeight:200,clientHeight:200,
    classList:{add:(...values)=>values.forEach(value=>classes.add(value)),remove:(...values)=>values.forEach(value=>classes.delete(value)),contains:value=>classes.has(value),toggle:(value,force)=>{const enable=force??!classes.has(value);if(enable)classes.add(value);else classes.delete(value);return enable;}},
    setAttribute:(key,value)=>attrs[key]=String(value),getAttribute:key=>attrs[key]??null,removeAttribute:key=>delete attrs[key],hasAttribute:key=>key in attrs,
    addEventListener(){},querySelector:selector=>nodes.get(selector)||null,querySelectorAll:selector=>collections.get(selector)||[],contains:()=>false,closest:selector=>nodes.get(selector)||null,
    focus(){document.activeElement=this;},append(){},insertAdjacentHTML(){},getBoundingClientRect:()=>({left:0,top:0,right:800,bottom:600,width:800,height:600}),getClientRects:()=>[{}]};};
  const get=selector=>{if(!nodes.has(selector))nodes.set(selector,node(selector));return nodes.get(selector);};
  const document={hidden:false,activeElement:null,body:node('body'),querySelector:selector=>nodes.get(selector)||null,querySelectorAll:selector=>collections.get(selector)||[],addEventListener(){},getElementById:id=>nodes.get('#'+id)||null,createElement:()=>node()};
  for(const selector of ['#app','#modal','#sidebar','.shell','.sidebar-scroll','#dm-nav','#channel-nav','#channel-title','#channel-sub','#room-info','#personal-bell','#deleted-projects','#new-conversation','#new-menu','#message-menu','#message-sheet','#room-filter','#clear-room-filter','#room-filter-empty','#global-search','#composer-input','#composer-status','#composer-form','#send-message','#attach-file','#composer-emoji','#composer-mention','#file-input','#reply-context','#upload-queue','#message-list','#message-scroll','#jump-latest','#drawer','#create-channel','#new-dm','#nav-unread-count','#unread-empty','#chat-area','#files-view','#pins-view','#file-results','#files-count','#drop-overlay','#mobile-menu','.main'])get(selector);
  const groups=['rooms','people'].map(key=>{const group=get(`[data-nav-group="${key}"]`),toggle=node();group.dataset.navGroup=key;group.querySelector=selector=>selector==='[data-group-toggle]'?toggle:null;group.toggle=toggle;return group;});collections.set('[data-nav-group]',groups);
  for(const selector of ['#search-input','#search-scope','#drawer-body','#channel-write-notice'])get(selector);
  const context=vm.createContext({document,location:{pathname:'/',origin:'http://localhost'},window:{parent:{},matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener(){}},localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)},setTimeout:()=>1,clearTimeout(){},URL,URLSearchParams,Intl,crypto:{randomUUID:()=> 'fixture-uuid'},CSS:{escape:String},innerWidth:1440,innerHeight:900});
  installMessengerModules(context);const run=code=>vm.runInContext(code,context);run(source);
  context.syntheticRooms=rooms();run("Object.assign(state,{user:{id:'u1',name:'유호',role:'owner',teamId:'marketing'},channels:syntheticRooms,members:[{id:'u1',name:'유호',teamId:'marketing'},{id:'u2',name:'지민',teamId:'marketing'},{id:'u3',name:'민서',teamId:'design'}],teams:[{id:'marketing',name:'마케팅팀',canOpen:true},{id:'design',name:'디자인팀',canOpen:false}],channelId:'self',mode:'chat'});");
  context.request=(path,options={})=>new Promise((resolve,reject)=>requests.push({path,options,resolve,reject}));context.notice=(...args)=>notifications.push(args);context.recordRead=async channelId=>reads.push(channelId);context.recordRender=()=>renders.push(run('state.channelId'));context.recordUpload=(...args)=>uploads.push(args);
  run('api=request;toast=notice;markRead=recordRead;renderMessages=recordRender;uploadFile=recordUpload;renderDirectory=()=>{};parentMessage=()=>{};');
  return{run,context,nodes,get,collections,groups,storage,requests,uploads,notifications,reads,renders,document,node,state:run('state')};
}
const emptyResponse={messages:[],hasMore:false};
async function settleLast(f,result=emptyResponse){f.requests.at(-1).resolve(result);await Promise.resolve();await Promise.resolve();}
const order=html=>[...html.matchAll(/data-channel="([^"]+)"/g)].map(match=>match[1]);

test('one list puts every room before people by real kind, never by a legacy team label or project name',()=>{
  const f=fixture();assert.deepEqual(Array.from(f.run('state.channels.map(navGroup)')),['people','people','rooms','rooms','rooms','rooms']);
  f.run('renderNavigation()');
  assert.deepEqual(order(f.get('#channel-nav').innerHTML).sort(),['legacy','project','public','team']);assert.deepEqual(order(f.get('#dm-nav').innerHTML).sort(),['dm','self']);
  assert.equal(f.run('roomLabel(state.channels[0])'),'나에게');assert.equal(f.run('selectedConversation()?.id'),'self');
});

test('room finder matches visible names, purposes and DM teams without changing the selection or permissions',()=>{
  const f=fixture();f.state.roomQuery='  지민  ';assert.equal(f.run("matchesRoomQuery(state.channels[1])"),true);assert.equal(f.run("matchesRoomQuery(state.channels[0])"),false);
  f.state.members[1].teamName='SYNK LAB';f.state.roomQuery='synk lab';assert.equal(f.run("matchesRoomQuery(state.channels[1])"),true);
  f.state.channels[3].systemKey='info';f.state.roomQuery='자료';assert.equal(f.run("matchesRoomQuery(state.channels[3])"),true);
  f.state.roomQuery='   ';assert.equal(f.run("matchesRoomQuery(state.channels[0])"),true);
  assert.equal(f.state.channelId,'self');assert.equal(f.requests.length,0);
});

test('room finder combines unread filtering across both groups and escapes malicious names',()=>{
  const f=fixture();f.state.channelId='project';f.state.roomQuery='지민';f.state.navFilter='unread';f.run('renderNavigation()');
  assert.deepEqual(order(f.get('#dm-nav').innerHTML),['dm']);assert.equal(order(f.get('#channel-nav').innerHTML).length,0);
  assert.equal(f.get('#room-filter-empty').classList.contains('hidden'),true);
  f.state.channels[1].name='<img src=x onerror=alert(1)>';f.state.roomQuery='';const markup=f.run('conversationNavItem(state.channels[1])');assert.match(markup,/&lt;img/);assert.doesNotMatch(markup,/<img src=x/);
});

test('direct room navigation clears a stale room query while retaining the source room draft',async()=>{
  const f=fixture();f.state.roomQuery='지민';f.get('#composer-input').value='작성 중인 메모';
  const pending=f.run("selectChannel('team')");await settleLast(f);await pending;
  assert.equal(f.state.roomQuery,'');assert.equal(f.storage.get('synk-messenger:draft:u1:self'),'작성 중인 메모');assert.equal(f.state.channelId,'team');
  const count=f.requests.length;await f.run("selectChannel('inaccessible-room')");assert.equal(f.requests.length,count);assert.equal(f.state.channelId,'team');
});

test('the list follows recent activity, keeps 나에게 last, and only re-sorts when the user leaves a room',async()=>{
  const f=fixture();f.run('renderNavigation()');
  assert.deepEqual(order(f.get('#channel-nav').innerHTML),['project','team','public','legacy']);assert.deepEqual(order(f.get('#dm-nav').innerHTML),['dm','self']);
  let pending=f.run("selectChannel('legacy')");await settleLast(f);await pending;
  // 읽거나 새 메시지가 와도 이 방에 있는 동안은 줄이 그 자리에 있다.
  f.state.channels.find(room=>room.id==='public').lastMessageAt='2026-11-06T09:00:00Z';f.state.channels.find(room=>room.id==='team').unread=0;f.run('renderNavigation()');
  assert.deepEqual(order(f.get('#channel-nav').innerHTML),['project','team','public','legacy']);
  // 새로 생긴 방은 맨 위에 바로 보인다.
  f.state.channels.push({id:'fresh',kind:'channel',scope:'public',category:'project',name:'새 프로젝트',memberIds:['u1'],unread:1,lastMessageAt:'2026-11-06T08:00:00Z'});f.run('renderNavigation()');
  assert.equal(order(f.get('#channel-nav').innerHTML)[0],'fresh');
  pending=f.run("selectChannel('dm')");await settleLast(f);await pending;f.run('renderNavigation()');
  assert.deepEqual(order(f.get('#channel-nav').innerHTML),['public','fresh','project','team','legacy'],'leaving a room re-sorts by recent activity');
});

test('the unread filter keeps the open room visible after it is read and stays on when changing rooms',async()=>{
  const f=fixture();f.state.navFilter='unread';
  const pending=f.run("selectChannel('project')");await settleLast(f);await pending;
  assert.equal(f.state.channelId,'project');assert.equal(f.state.navFilter,'unread');
  f.run('renderNavigation()');assert.deepEqual(order(f.get('#channel-nav').innerHTML),['project','team','public','legacy']);assert.deepEqual(order(f.get('#dm-nav').innerHTML),['dm']);
  f.state.channels.forEach(room=>{room.unread=0;});f.state.channelId='dm';f.run('renderNavigation()');
  assert.deepEqual(order(f.get('#channel-nav').innerHTML),[]);assert.deepEqual(order(f.get('#dm-nav').innerHTML),['dm'],'the open room stays after it is read');assert.equal(f.groups[0].classList.contains('hidden'),true,'an empty group hides under the unread filter');
  assert.equal(f.get('#unread-empty').classList.contains('hidden'),true);
  f.state.channelId=null;f.run('renderNavigation()');assert.equal(f.get('#unread-empty').classList.contains('hidden'),false);
});

test('a collapsed group is remembered on this device and still shows unread and open rooms',()=>{
  const f=fixture();f.state.channelId='project';f.run("toggleNavGroup('rooms')");
  assert.deepEqual(JSON.parse(f.storage.get('synk-messenger:nav-collapsed:u1')),{rooms:true});
  assert.deepEqual(order(f.get('#channel-nav').innerHTML),['project','team','public','legacy']);
  f.state.channelId='self';f.state.channels.find(room=>room.id==='legacy').unread=0;f.run('renderNavigation()');
  assert.deepEqual(order(f.get('#channel-nav').innerHTML),['team','public']);assert.equal(f.groups[0].classList.contains('is-collapsed'),true);assert.equal(f.groups[0].toggle.getAttribute('aria-expanded'),'false');
  f.state.roomQuery='라운지';f.run('renderNavigation()');assert.equal(f.groups[0].classList.contains('is-collapsed'),false,'searching opens collapsed groups');
  f.run("toggleNavGroup('nope')");assert.deepEqual(JSON.parse(f.storage.get('synk-messenger:nav-collapsed:u1')),{rooms:true});
});

test('clearing a revoked selection saves the previous draft/reply/attachments and makes no null-room requests',async()=>{
  const f=fixture(),box=f.get('#composer-input');box.value='개인 메모 초안';
  f.run("state.replyTarget={id:'parent',channelId:'self',body:'원래 메모',user:{id:'u1',name:'유호'}};saveReply();state.queues.set('self',[{key:'upload-a',status:'done',name:'draft.txt',size:3,file:{id:'file-a',channelId:'self',uploaderId:'u1',name:'draft.txt',size:3}}]);persistQueue('self');");
  f.run('clearChannelSelection()');assert.equal(f.state.channelId,null);assert.equal(f.requests.length,0);assert.equal(box.disabled,true);assert.equal(f.get('#send-message').disabled,true);
  assert.equal(f.storage.get('synk-messenger:draft:u1:self'),'개인 메모 초안');assert.equal(JSON.parse(f.storage.get('synk-messenger:reply:u1:self')).id,'parent');assert.equal(JSON.parse(f.storage.get('synk-messenger:attachments:u1:self'))[0].file.id,'file-a');
  f.get('#send-message').disabled=false;box.value='전송하면 안 되는 값';await f.run('sendMessage({preventDefault(){}})');f.run("addFiles([{name:'blocked.txt',size:3}])");
  f.state.drawer='search';f.get('#search-input').value='찾기';f.get('#search-scope').checked=true;await f.run('runSearch()');assert.equal(f.requests.length,0);assert.equal(f.uploads.length,0);
  assert.equal(f.get('#channel-title').textContent,'메신저');assert.equal(f.get('#room-info').disabled,true);
  const pending=f.run("selectChannel('self')");assert.equal(f.state.channelId,'self');assert.equal(box.value,'개인 메모 초안');assert.equal(f.state.replyTarget.id,'parent');assert.equal(f.run("queue()[0].file.id"),'file-a');await settleLast(f);await pending;
  assert.equal([...f.storage.keys()].some(key=>key.endsWith(':null')),false,'an empty selection must not create a shared null-room draft');
});

test('a message load completing after the selection is cleared cannot repaint or mark the old room read',async()=>{
  const f=fixture();
  const loading=f.run("selectChannel('dm')");const old=f.requests[0];f.run('clearChannelSelection()');const empty=f.get('#message-list').innerHTML;
  old.resolve({messages:[{id:'old',body:'이전 개인 대화'}],hasMore:true});await loading;
  assert.equal(f.state.channelId,null);assert.equal(f.state.messages.length,0);assert.equal(f.get('#message-list').innerHTML,empty);assert.deepEqual(f.reads,[]);assert.deepEqual(f.renders,[]);
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

test('a pending DM or team-room creation cannot pull the user back after they open another room',async()=>{
  for(const kind of ['dm','team']){
    const f=fixture();f.state.channels=f.state.channels.filter(room=>room.kind==='self');f.state.channelId=null;f.run('refreshChannels=async()=>{};refreshDirectory=async()=>{};');
    const pending=f.run(kind==='dm'?"openDirectMessage('u3')":"openTeamConversation('marketing')");assert.equal(f.requests.length,1);assert.equal(f.requests[0].options.method,'POST');
    const opening=f.run("selectChannel('self')");f.requests[1].resolve(emptyResponse);await opening;assert.equal(f.state.channelId,'self');
    f.state.channels.push(kind==='dm'?{id:'created',kind:'dm',memberIds:['u1','u3'],name:'민서'}:{id:'created',kind:'channel',scope:'team',teamId:'marketing',name:'마케팅팀'});
    f.requests[0].resolve({channel:{id:'created'}});await pending;assert.equal(f.state.channelId,'self');assert.equal(f.requests.length,2);
  }
});

test('revoking the active team room clears the selection, disables its composer and falls back to no unrelated room',async()=>{
  const f=fixture();f.state.channelId='team';
  const pending=f.run('refreshChannels()');f.requests[0].resolve({channels:f.state.channels.filter(room=>room.id!=='team')});await pending;
  assert.equal(f.state.channelId,null);assert.equal(f.get('#composer-input').disabled,true);assert.equal(f.requests.length,1,'revocation cannot fall back to an unrelated room');
});

test('only actual team membership can create a team conversation, including administrators and viewers',async()=>{
  const f=fixture();
  await f.run("openTeamConversation('design')");await f.run("openTeamConversation('missing')");assert.equal(f.requests.length,0,'administrator does not bypass canOpen membership');
  f.state.integrated={canWrite:false};await f.run("openTeamConversation('marketing')");assert.equal(f.requests.length,0,'viewer cannot create a team conversation');
});

test('「새 대화」 offers a 1:1, a new room and only unopened team rooms the user may open, and viewers get the 1:1 list only',()=>{
  const f=fixture();assert.deepEqual(Array.from(f.run('newMenuItems()'),row=>row[0]),['new-dm','new-room'],'marketing already has a team room and design cannot be opened');
  f.state.channels=f.state.channels.filter(room=>room.scope!=='team');assert.deepEqual(Array.from(f.run('newMenuItems()'),row=>row.slice(0,2).join(':')),['new-dm:크루와 1:1','new-room:새 대화방 만들기','open-team:마케팅팀 대화방 열기']);
  f.state.integrated={canWrite:false,canManage:false};assert.deepEqual(Array.from(f.run('newMenuItems()'),row=>row[0]),['new-dm']);
  f.state.integrated={canWrite:true,canManage:true};assert.equal(f.run('newMenuItems()').at(-1)[0],'team-manage');
  f.state.teams[0].name='<b>팀</b>';f.get('#new-menu').classList.add('hidden');f.run('toggleNewMenu()');assert.match(f.get('#new-menu').innerHTML,/&lt;b&gt;팀&lt;\/b&gt;/);
});

test('default public rooms keep system identifiers and never infer announcement permissions from names',()=>{
  const f=fixture();f.context.publicRooms=[
    {id:'custom',kind:'channel',scope:'public',name:'공지',canPost:true},
    {id:'social',kind:'channel',scope:'public',name:'수다방',systemKey:'social',canPost:true},
    {id:'info',kind:'channel',scope:'public',name:'정보방',systemKey:'info',canPost:true},
    {id:'announcement',kind:'channel',scope:'public',name:'공지',systemKey:'announcements',canPost:false},
  ];
  f.run("state.channels=publicRooms;state.channelId='custom';state.navOrder=null;renderNavigation()");
  assert.equal(f.run('canPostToChannel()'),true);assert.equal(f.run("canPostToChannel(state.channels.find(room=>room.id==='announcement'))"),false);
  const html=f.get('#channel-nav').innerHTML;assert.match(html,/data-system-key="announcements"/);assert.equal(order(html).length,4);
});

test('crew can read announcements and react or delete their old posts while all posting controls and handlers are blocked',async()=>{
  const f=fixture();f.state.channels.push({id:'notice',name:'공지',kind:'channel',scope:'public',systemKey:'announcements',canPost:false,memberIds:['u1','u2']});
  f.state.user.role='member';f.state.channelId='notice';f.get('#composer-input').value='전송 금지 초안';f.run('syncComposerAccess()');
  assert.equal(f.get('#composer-input').disabled,false);assert.equal(f.get('#composer-input').readOnly,true);
  for(const selector of ['#attach-file','#composer-emoji','#composer-mention','#file-input','#send-message'])assert.equal(f.get(selector).disabled,true,selector);
  f.run('syncChannelHeader()');assert.equal(f.get('#room-info').disabled,false,'room info (files · pins) stays readable');
  assert.match(f.get('#channel-write-notice').textContent,/공지는 관리자만/);
  f.context.noticeMessage={id:'old-notice',channelId:'notice',body:'이전 크루 글',user:{id:'u1',name:'유호'},createdAt:'2026-09-30T00:00:00Z',files:[],reactions:[],pinned:true};
  const html=f.run('messageHtml(noticeMessage)'),menu=Array.from(f.run('messageMenuItems(noticeMessage)'),row=>row[0]);
  for(const action of ['reply','task'])assert.ok(!html.includes(`data-action="${action}"`),action);
  for(const action of ['edit','pin','decision'])assert.ok(!menu.includes(action),action);
  assert.ok(html.includes('data-action="reaction-picker"'));assert.ok(html.includes('data-action="message-more"'));assert.deepEqual(menu,['save','remind','delete']);
  f.run("state.drawer='thread';state.thread={parent:noticeMessage,messages:[]};renderThread()");assert.ok(!f.get('#drawer-body').innerHTML.includes('data-thread-reply'));
  f.get('#send-message').disabled=false;await f.run('sendMessage({preventDefault(){}})');f.run("addFiles([{name:'blocked.txt',size:3}]);startReply(noticeMessage);editMessageDialog(noticeMessage)");await f.run('togglePin(noticeMessage,{})');await f.run('togglePin(noticeMessage,null)');
  assert.equal(f.requests.length,0);assert.equal(f.uploads.length,0);assert.equal(f.state.replyTarget,null);assert.equal(f.get('#modal').open,false);
  f.state.integrated={canWrite:false};const viewer=f.run('messageHtml(noticeMessage)');assert.ok(!viewer.includes('data-action="reaction-picker"'));assert.deepEqual(Array.from(f.run('messageMenuItems(noticeMessage)'),row=>row[0]),['save','remind']);
  f.state.integrated={canWrite:true};f.state.channels.find(room=>room.id==='notice').canPost=true;f.run('syncComposerAccess()');assert.equal(f.get('#composer-input').readOnly,false);assert.equal(f.get('#attach-file').disabled,false);assert.ok(Array.from(f.run('messageMenuItems(noticeMessage)'),row=>row[0]).includes('edit'));
});

test('refreshed announcement permissions immediately disable writing without losing an existing draft or limiting ordinary rooms',async()=>{
  const f=fixture();f.state.channels.push({id:'notice',name:'공지',kind:'channel',scope:'public',systemKey:'announcements',canPost:true,memberIds:['u1','u2']});
  f.state.channelId='notice';f.get('#composer-input').value='권한 변경 전 초안';f.run('syncComposerAccess()');assert.equal(f.get('#composer-input').readOnly,false);
  const pending=f.run('refreshChannels()');f.requests[0].resolve({channels:f.state.channels.map(room=>({...room,...(room.id==='notice'?{canPost:false}:{})}))});await pending;
  assert.equal(f.get('#composer-input').readOnly,true);assert.equal(f.get('#send-message').disabled,true);assert.equal(f.get('#composer-input').value,'권한 변경 전 초안');assert.deepEqual(f.renders,['notice']);
  const selecting=f.run("selectChannel('public')");await settleLast(f);await selecting;
  assert.equal(f.get('#composer-input').readOnly,false);assert.equal(f.get('#attach-file').disabled,false);assert.equal(f.storage.get('synk-messenger:draft:u1:notice'),'권한 변경 전 초안');
  assert.equal(f.get('#channel-write-notice').textContent,'');
});
