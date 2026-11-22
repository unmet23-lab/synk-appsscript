'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {mailAppServer}=require('./fixtures/office-mail-app-server.cjs');
const {combinePlan,searchMailbox}=require('../src/office-mail-api.cjs');
const {authorize}=require('../src/office-mail-oauth.cjs');
const {planMail}=require('../src/office-mail-plan.cjs');
const seed={terms:[],from:'',after:'',before:'',folder:'',provider:'',inherit:false};
const json=v=>new Response(JSON.stringify(v),{status:200});
test('같은 기간에 계약서만, 조건 추가 및 조건 해제가 서로 다른 검색으로 이어진다',()=>{
  const before=combinePlan({...seed,terms:['견적'],after:'2026-11-09',before:'2026-11-16',from:'담당자',provider:'gmail'});
  const replace=combinePlan({...seed,inherit:true,terms:['계약서'],mergeTerms:'replace'},before);
  assert.deepEqual(replace.terms,['계약서']);assert.equal(replace.after,before.after);assert.equal(replace.from,before.from);
  const add=combinePlan({...seed,inherit:true,terms:['교재'],mergeTerms:'add',clear:['from','provider']},before);
  assert.deepEqual(add.terms,['견적','교재']);assert.equal(add.from,'');assert.equal(add.provider,'all');
  const all=combinePlan({...seed,inherit:true,clear:['terms','period','folder']},before);
  assert.deepEqual(all.terms,[]);assert.equal(all.before,'');assert.equal(all.folder,'received');
  assert.throws(()=>combinePlan({...seed,terms:['일곱'],inherit:true,mergeTerms:'add'},{...before,terms:['일','이','삼','사','오','육']}),{code:'MAIL_PLAN'});
});
test('Outlook은 인용된 구절과 보낸 사람 이름을 그대로 검색한다',async()=>{
  let query;
  await searchMailbox({provider:'outlook',access:'fixture',plan:combinePlan({...seed,folder:'inbox',terms:['winter quote'],from:'Jane Doe'}),
    fetch:async u=>{query=JSON.parse(new URL(u).searchParams.get('$search'));return json({value:[]});}});
  assert.equal(query,'"winter quote" AND from:"Jane Doe"');
});
test('첫 페이지가 전부 제외된 메일이어도 제한된 다음 페이지에서 실제 받은 메일을 찾는다',async()=>{
  const p=combinePlan(seed),called=[];
  const message=(folder,i)=>({id:String(i),parentFolderId:folder,subject:folder,receivedDateTime:'2026-11-14T08:00:00Z'});
  const fetch=async raw=>{
    const url=new URL(raw);called.push(url);
    if(url.pathname.endsWith('/messages'))return url.searchParams.has('$skiptoken')?json({value:[message('inbox',41)]}):json({value:Array.from({length:40},(_,i)=>message('sentitems',i)),'@odata.nextLink':'https://graph.microsoft.com/v1.0/me/messages?$skiptoken=next'});
    const id=url.pathname.split('/').at(-1);return json({id,parentFolderId:id==='inbox'?'msgfolderroot':null});
  };
  const result=await searchMailbox({provider:'outlook',access:'fixture',plan:p,fetch});
  assert.deepEqual(result.items.map(r=>r.subject),['inbox']);assert.equal(result.more,false);
  assert.equal(called.filter(u=>u.pathname.endsWith('/messages')).length,2);
});
test('열 건을 채운 뒤에는 확인하지 않은 폴더에 추가 요청을 보내지 않는다',async()=>{
  const calls=[], roots=['deleteditems','junkemail','drafts','sentitems','msgfolderroot','known'];
  const message=(id,parentFolderId)=>({id,parentFolderId,receivedDateTime:'2026-11-10T09:00:00Z'});
  const fetch=async raw=>{
    const id=new URL(raw).pathname.split('/').pop();calls.push(id);
    if(id==='messages')return json({value:[...Array.from({length:10},(_,i)=>message(String(i),'known')),message('extra','unopened')]});
    return roots.includes(id)?json({id,parentFolderId:'msgfolderroot'}):new Response('{}',{status:500});
  };
  const r=await searchMailbox({provider:'outlook',access:'fixture',plan:combinePlan(seed),fetch});
  assert.equal(r.items.length,10);assert.equal(calls.includes('unopened'),false);assert.equal(r.more,true);assert.equal(r.code,undefined);
});
test('Outlook 다음 페이지에서 폴더 조회가 복구되면 같은 메일을 한 번 표시한다',async()=>{
  const message={id:'one',subject:'견적',parentFolderId:'sample',receivedDateTime:'2026-11-10T09:00:00Z'};
  let reads=0;
  const fetch=async raw=>{
    const u=new URL(raw),id=u.pathname.split('/').pop();
    if(id==='messages')return json(u.searchParams.has('skip')?{value:[message]}:{value:[message],'@odata.nextLink':'?skip=next'});
    if(id==='sample'&&++reads===1)return new Response('{}',{status:500});
    return json({id,parentFolderId:'msgfolderroot'});
  };
  const r=await searchMailbox({provider:'outlook',access:'fixture',plan:combinePlan(seed),fetch});
  assert.equal(reads,2);assert.deepEqual(r.items.map(m=>m.subject),['견적']);assert.equal(r.code,undefined);
});
test('Outlook에서 다음 폴더의 허용량이 소진되면 이미 찾아낸 메일을 카드에 남긴다',async()=>{
  const m=id=>({id,parentFolderId:id,subject:id,receivedDateTime:'2026-11-10T09:00:00Z'});
  const fetch=async raw=>{const id=new URL(raw).pathname.split('/').pop();
    if(id==='messages')return json({value:[m('found'),m('limited')]});
    if(id==='limited')return new Response('{}',{status:429});
    return json({id,parentFolderId:'msgfolderroot'});
  };
  const r=await searchMailbox({provider:'outlook',access:'fixture',plan:combinePlan(seed),fetch});
  assert.deepEqual(r.items.map(x=>x.subject),['found']);assert.equal(r.code,'MAIL_LIMIT');assert.equal(r.more,true);
});
test('Microsoft 디렉터리에 로그인해도 Exchange 사서함이 없으면 연결 성공으로 저장하지 않는다',async()=>{
  const open=async link=>{const auth=new URL(link),back=new URL(auth.searchParams.get('redirect_uri'));back.searchParams.set('state',auth.searchParams.get('state'));back.searchParams.set('code','sample');await fetch(back);};
  const net=async url=>String(url).includes('/token')?json({access_token:'x',refresh_token:'r',token_type:'Bearer',scope:'User.Read Mail.Read'}):
    String(url).includes('/mailFolders/inbox')?new Response('{}',{status:404}):json({id:'directory-id',userPrincipalName:'user@example.test'});
  await assert.rejects(authorize({provider:'outlook',client:{id:'test-native'},open,fetch:net}),{code:'MAIL_NO_MAILBOX'});
});
test('격리 계획기가 도구 활동을 알리면 출력을 채택하지 않고 프로세스를 닫는다',async()=>{
  const mock=mailAppServer({itemType:'mcpToolCall'}),id=randomUUID();
  const hooks={signal:new AbortController().signal,checkpoint:async()=>true,session:async()=>true};
  await assert.rejects(planMail({id,providerSalt:id,prompt:'검색 조건만 추출해 주세요.'},hooks,{file:'codex-fixture',env:{},spawn:mock.spawn}),{code:'MAIL_PLAN'});
  assert.equal(mock.sessions.length,1);
  const [proc]=mock.sessions;
  assert.ok(proc.closed);assert.equal(proc.launch.shell,false);
  assert.equal(proc.requests.find(r=>r.method==='thread/start').params.cwd,proc.launch.cwd);
  for(const feature of ['code_mode_only','shell_tool','apps','plugins','hooks'])assert.ok(proc.args.includes(feature));
});
