import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=(await readFile(new URL('../public/app.js',import.meta.url),'utf8')).replace(/\bboot\(\);\s*$/,'');
function fixture(){
  const storage=new Map(),nodes=new Map();
  const node=()=>({innerHTML:'',textContent:'',value:'',disabled:false,open:false,classList:{add(){},remove(){},toggle(){}},addEventListener(){},querySelector(){return null;},querySelectorAll(){return[];}});
  nodes.set('#app',node());nodes.set('#modal',node());
  const document={hidden:false,activeElement:null,querySelector:selector=>nodes.get(selector)||null,querySelectorAll:()=>[],addEventListener(){}};
  const context=vm.createContext({document,location:{pathname:'/',origin:'http://localhost'},window:{parent:{},matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener(){}},localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)},setTimeout:()=>1,clearTimeout(){},URL,URLSearchParams,crypto:{randomUUID:()=> '00000000-0000-4000-8000-000000000001'},CSS:{escape:String}});
  const run=code=>vm.runInContext(code,context);
  run(source);run("Object.assign(state,{sendRecovery:{messages:true,uploads:true},user:{id:'u1',name:'담당자',role:'owner'},channels:[{id:'c1',kind:'channel',name:'팀',memberIds:['u1'],unread:1}],channelId:'c1',chatCategory:'all'});");
  return{run,context,nodes,storage,document,node};
}

test('reply markup escapes user data, preserves deleted-parent context, and hides writes for viewers',()=>{
  const f=fixture();
  f.context.message={id:'m1',channelId:'c1',body:'확인했어요',user:{id:'u1',name:'담당자'},createdAt:'2026-09-29T00:00:00Z',files:[],reactions:[],replyToId:'m0',replyTo:{id:'m0',body:'<img src=x onerror=alert(1)>',user:{name:'<script>bad</script>'}},replyCount:2,pinned:true};
  const html=f.run('messageHtml(message)');
  assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('data-action="thread"'));assert.ok(html.includes('메시지 고정 해제'));
  f.run('message.replyTo.deleted=true;');
  const deleted=f.run('messageHtml(message)');
  assert.ok(deleted.includes('원래 메시지가 삭제'));assert.ok(!deleted.includes('data-action="reply-origin"'));
  f.run('state.integrated={canWrite:false}');
  const viewer=f.run('messageHtml(message)');
  assert.ok(!viewer.includes('data-action="pin"'));assert.ok(!viewer.includes('data-action="reply"'));assert.ok(viewer.includes('data-action="thread"'));
});

test('reply drafts stay scoped to the signed-in user and channel',()=>{
  const f=fixture();
  f.run("state.replyTarget={id:'m1',channelId:'c1',body:'원문',user:{name:'담당자'}};saveReply();state.channelId='c2';restoreReply();");
  assert.equal(f.run('state.replyTarget'),null);
  f.run("state.channelId='c1';restoreReply();");assert.equal(f.run('state.replyTarget.id'),'m1');
  f.run("state.user={id:'u2'};restoreReply();");assert.equal(f.run('state.replyTarget'),null);
  f.run("state.user={id:'u1'};restoreReply();clearReply();restoreReply();");assert.equal(f.run('state.replyTarget'),null);assert.equal(f.storage.size,0);
});

test('file search ignores stale results after a newer query or a view change',async()=>{
  const f=fixture(),pending=[];const results=f.node();f.nodes.set('#file-results',results);f.nodes.set('#files-count',f.node());
  f.context.request=path=>new Promise(resolve=>pending.push({path,resolve}));f.run("api=request;state.mode='files';state.fileScope='all';");
  const first=f.run("state.fileQuery='old';loadFiles()"),second=f.run("state.fileQuery='new';state.fileType='image';loadFiles()");
  assert.ok(pending[1].path.includes('q=new'));assert.ok(pending[1].path.includes('type=image'));assert.ok(!pending[1].path.includes('channelId'));
  pending[1].resolve({files:[{id:'new',name:'new.png',size:10,createdAt:'2026-09-29T00:00:00Z',channelId:'c1',uploaderId:'u1'}],hasMore:false});await second;
  pending[0].resolve({files:[{id:'old',name:'old.png',size:20,createdAt:'2026-09-29T00:00:00Z'}],hasMore:false});await first;
  assert.ok(results.innerHTML.includes('new.png'));assert.ok(!results.innerHTML.includes('old.png'));
  const third=f.run('loadFiles()');f.run("state.mode='chat'");results.innerHTML='left-files-view';pending[2].resolve({files:[],hasMore:false});await third;assert.equal(results.innerHTML,'left-files-view');
});

test('files, pins, hidden module and hidden document do not mark unseen chat messages read',async()=>{
  const f=fixture(),calls=[];f.context.request=async(path,options)=>{if(path.endsWith('/read'))calls.push({path,body:options.body});return{channels:[{id:'c1',unread:0}]};};f.run("api=request;renderNavigation=()=>{};parentMessage=()=>{};state.messages=[{id:'42'}];");
  for(const mode of ['files','pins']){f.run(`state.mode='${mode}'`);await f.run("markRead('c1')");}
  f.run("state.mode='chat';moduleVisible=false");await f.run("markRead('c1')");
  f.run('moduleVisible=true');f.document.hidden=true;await f.run("markRead('c1')");assert.equal(calls.length,0);
  f.document.hidden=false;await f.run("markRead('another-room')");assert.equal(calls.length,0);
  await f.run("markRead('c1')");assert.equal(calls.length,1);assert.equal(calls[0].body.messageId,'42');assert.equal(f.run('state.channels[0].unread'),0);
});

test('a reply completing after switching rooms cannot clear the new room draft or reply target',async()=>{
  const f=fixture(),box=f.node(),button=f.node();f.nodes.set('#composer-input',box);f.nodes.set('#send-message',button);box.value='보내는 답글';
  let finish;f.context.request=async(path,options)=>{f.context.sent=options.body;return new Promise(resolve=>finish=resolve);};
  f.run("api=request;updateSend=()=>{};persistQueue=()=>{};refreshChannels=async()=>{};markRead=async()=>{};state.replyTarget={id:'m1',channelId:'c1',user:{name:'담당자'}};saveReply();localStorage.setItem(draftKey(),'보내는 답글');");
  const sending=f.run('sendMessage({preventDefault(){}})');assert.equal(f.context.sent.replyToId,'m1');
  f.run("state.channelId='c2';state.replyTarget={id:'m2',channelId:'c2',user:{name:'다른 담당자'}};saveReply();localStorage.setItem(draftKey(),'다른 방의 초안');");box.value='다른 방의 초안';
  finish({message:{id:'m3'}});await sending;
  assert.equal(box.value,'다른 방의 초안');assert.equal(f.run('state.replyTarget.id'),'m2');assert.equal(f.storage.get('synk-messenger:draft:u1:c1'),undefined);assert.equal(f.storage.get('synk-messenger:reply:u1:c1'),undefined);assert.equal(f.storage.get('synk-messenger:draft:u1:c2'),'다른 방의 초안');
});

test('conversation sections use real team scope and keep legacy team labels in company public rooms',()=>{
  const f=fixture();f.context.rooms=[{id:'public',kind:'channel',category:'team',scope:'public'},{id:'legacy',kind:'channel',category:'team'},{id:'project',kind:'channel',category:'project',scope:'public'},{id:'team',kind:'channel',category:'team',scope:'team',teamId:'marketing'},{id:'dm',kind:'dm',scope:'private'},{id:'self',kind:'self',scope:'private'}];
  const groups=f.run('conversationGroups(rooms)');
  assert.deepEqual(Array.from(groups.public,room=>room.id),['public','legacy','project']);assert.deepEqual(Array.from(groups.team,room=>room.id),['team']);assert.deepEqual(Array.from(groups.personal,room=>room.id),['dm','self']);
});

test('employee directory filters actual teams and shows the real user when no team is assigned',()=>{
  const f=fixture();f.run("state.members=[{id:'u1',name:'유호',teamId:null,teamName:null},{id:'u2',name:'지민',teamId:'marketing',teamName:'마케팅팀'},{id:'u3',name:'민서',teamId:'design',teamName:'디자인팀'}];state.user=state.members[0];");
  assert.deepEqual(Array.from(f.run('directoryMembers()'),person=>person.id),['u1','u3','u2']);
  f.run("state.directoryTeam='mine'");assert.equal(f.run('directoryMembers().length'),0);
  f.run("state.directoryTeam='all';state.directoryQuery='마케팅'");assert.deepEqual(Array.from(f.run('directoryMembers()'),person=>person.id),['u2']);
  f.run("state.directoryQuery='';state.directoryTeam='team:design'");assert.deepEqual(Array.from(f.run('directoryMembers()'),person=>person.id),['u3']);
  const self=f.run('personDirectoryHtml(state.user)');assert.ok(self.includes('팀 없음'));assert.ok(self.includes('나에게 메모 열기'));assert.ok(!self.includes('온라인'));
});

test('clicking a person opens an existing DM directly without another create request',async()=>{
  const f=fixture(),selected=[],calls=[];f.context.select=async channelId=>selected.push(channelId);f.context.request=async(...args)=>calls.push(args);
  f.run("selectChannel=select;api=request;state.members=[{id:'u1',name:'유호'},{id:'u2',name:'지민'}];state.channels=[{id:'self',kind:'self',memberIds:['u1']},{id:'dm',kind:'dm',memberIds:['u1','u2']}];state.navFilter='unread';state.integrated={canWrite:false};");
  await f.run("openDirectMessage('u2')");await f.run("openDirectMessage('u1')");assert.deepEqual(selected,['dm','self']);assert.equal(calls.length,0);
  // Actual selectChannel filter reset is exercised in chat-categories.test.mjs.
});

test('rapid employee clicks keep the most recently requested DM selected',async()=>{
  const f=fixture(),pending=[],selected=[];f.context.select=async channelId=>selected.push(channelId);f.context.request=async(path,options)=>new Promise(resolve=>pending.push({path,userId:options.body.userId,resolve}));
  f.run("selectChannel=select;api=request;refreshChannels=async()=>{};state.members=[{id:'u1',name:'유호'},{id:'u2',name:'지민'},{id:'u3',name:'민서'}];");
  const first=f.run("openDirectMessage('u2')"),second=f.run("openDirectMessage('u3')");assert.equal(pending[0].path,'/api/dms');assert.equal(pending[1].userId,'u3');
  pending[1].resolve({channel:{id:'dm-3'}});await second;pending[0].resolve({channel:{id:'dm-2'}});await first;assert.deepEqual(selected,['dm-3']);
});
