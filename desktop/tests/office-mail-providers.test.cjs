'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {authorize,refreshGrant}=require('../src/office-mail-oauth.cjs');
const {searchMailbox,validatePlan,checkDecision,explicitPlan,combinePlan,searchScope}=require('../src/office-mail-api.cjs');
const json=value=>new Response(JSON.stringify(value),{status:200});
const msScope='openid profile User.Read Mail.Read';
const client={id:'11111111-1111-4111-8111-111111111111'};
test('Outlook은 데스크톱용 localhost 반환과 위임 읽기 권한으로 식별된 메일함을 연결한다',async()=>{
  const net=[];
  const open=async link=>{
    const auth=new URL(link),back=new URL(auth.searchParams.get('redirect_uri'));
    assert.equal(auth.hostname,'login.microsoftonline.com');assert.equal(back.hostname,'localhost');assert.equal(back.pathname,'/');
    assert.equal(auth.searchParams.get('scope'),'offline_access https://graph.microsoft.com/User.Read https://graph.microsoft.com/Mail.Read');
    back.searchParams.set('session_state','vendor-supplied');back.searchParams.set('state',auth.searchParams.get('state'));back.searchParams.set('code','single-use');
    assert.equal((await fetch(back)).status,200);
  };
  const linked=await authorize({provider:'outlook',client,open,fetch:async(url,init)=>{
    net.push(String(url));if(net.length===1){const p=new URLSearchParams(init.body);assert.ok(!p.has('client_secret'));return json({access_token:'a',refresh_token:'r',scope:msScope,token_type:'bearer'});}
    return String(url).includes('/mailFolders/inbox')?json({id:'inbox-folder'}):json({id:'immutable-user',mail:null,userPrincipalName:'member@example.test'});
  }});
  assert.equal(linked.subject,'immutable-user');assert.equal(linked.address,'member@example.test');assert.equal(net.length,3);
  assert.match(net[2],/mailFolders\/inbox\?\$select=id$/);
});
test('회전된 Outlook 갱신 토큰은 같은 사서함에서만 이어간다',async()=>{
  const grant={subject:'stable',address:'a@example.test',refreshToken:'old',scope:msScope};
  let subject='stable';
  const fetch=async(url,init)=>{
    if(new URL(url).hostname==='graph.microsoft.com')return json({id:subject,mail:grant.address});
    assert.equal(new URLSearchParams(init.body).get('refresh_token'),'old');
    return json({access_token:'access',refresh_token:'rotated',scope:msScope,token_type:'Bearer'});
  };
  assert.equal((await refreshGrant({provider:'outlook',client,grant,fetch})).refreshToken,'rotated');
  subject='another';await assert.rejects(refreshGrant({provider:'outlook',client,grant,fetch}),{code:'MAIL_CHANGED'});
});
test('받은 메일 전체는 보관 폴더까지 찾고 휴지통·보낸편지함 하위 폴더는 제외한다',async()=>{
  const p=validatePlan({terms:[],from:'',after:'2026-11-09',before:'2026-11-16',folder:'received',provider:'all',inherit:false});
  const observe=[];
  const items=['archive-child','trash-child','sentitems','inbox','deleteditems','drafts','junkemail'].map((v,i)=>({subject:v,id:String(i),receivedDateTime:'2026-11-12T00:00:00Z',parentFolderId:v}));
  const fetch=async raw=>{
    const url=new URL(raw);observe.push(url);
    if(url.pathname.endsWith('/messages'))return json({value:items,'@odata.nextLink':'https://graph.microsoft.com/another-page'});
    const name=url.pathname.split('/').at(-1);
    const parents={'archive-child':'archive','archive':'msgfolderroot','trash-child':'deleteditems','inbox':'msgfolderroot'};
    return json({id:name,parentFolderId:parents[name]||null});
  };
  const result=await searchMailbox({provider:'outlook',access:'fixture',plan:p,fetch});
  assert.deepEqual(result.items.map(v=>v.subject),['archive-child','inbox']);assert.equal(result.more,true);
  assert.equal(observe.some(url=>url.pathname==='/another-page'),false);
  assert.match(observe[0].searchParams.get('$filter'),/receivedDateTime ge/);
});
test('Gmail에서 검색 중 이동한 메일을 상세 조회하지 못하면 일부 누락을 표시한다',async()=>{
  const p=validatePlan({terms:[],from:'',after:'',before:'',folder:'received',provider:'all',inherit:false});
  const fetch=async url=>new URL(url).pathname.endsWith('/messages')?json({messages:[{id:'aa'},{id:'bb'}]}):
    new URL(url).pathname.endsWith('/aa')?json({id:'aa',internalDate:String(Date.now()),snippet:'예시 &amp; 문의',payload:{headers:[]}}):new Response('{}',{status:404});
  const result=await searchMailbox({provider:'gmail',access:'fixture',plan:p,fetch});
  assert.equal(result.items.length,1);assert.equal(result.items[0].snippet,'예시 & 문의');assert.equal(result.code,'MAIL_NOT_FOUND');
});
function twoFolders(){
  return explicitPlan({terms:['견적'],from:'',after:'',before:'',folder:'inbox_sent',provider:'',inherit:false,unmet:[],
    scope:'mailbox',mailRef:'메일',otherRef:'',period:'',attachment:'',mergeTerms:'replace',clear:[],
    evidence:[{role:'folder',quote:'받은편지함',nth:1},{role:'folder',quote:'보낸편지함',nth:1}]},
    '받은편지함과 보낸편지함에서 견적 메일 찾아줘');
}
test('두 이름 폴더를 지정한 Gmail 검색은 보관한 수신 메일을 포함하지 않고 같은 범위를 이어 쓴다',async()=>{
  const plan=twoFolders(),queries=[];
  const fetch=async raw=>{
    const url=new URL(raw);
    if(url.pathname.endsWith('/messages')){
      const q=url.searchParams.get('q');queries.push(q);
      const ids=q.includes('{in:inbox in:sent}')?['aa','bb']:['aa','bb','cc'];
      return json({messages:ids.map(id=>({id}))});
    }
    const id=url.pathname.split('/').at(-1);
    return url.searchParams.get('format')==='metadata'?json({id,payload:{headers:[]}}):json({id,internalDate:'1794300000000',snippet:id});
  };
  const hits=await searchMailbox({provider:'gmail',access:'fixture',plan,fetch});
  assert.deepEqual(hits.items.map(item=>item.sourceId),['aa','bb']);
  assert.equal(queries.length,1);assert.match(searchScope(plan),/받은편지함과 보낸편지함/);
  const saved=JSON.parse(JSON.stringify(combinePlan(plan)));
  assert.equal(combinePlan({...plan,terms:['계약서'],folder:'',inherit:true},saved).folder,'inbox_sent');
  assert.equal(combinePlan({...plan,folder:'',inherit:true},{...saved,folder:'all'}).folder,'all');
  const prompt='받은편지함과 보낸편지함에서 견적 메일 찾아줘';
  const raw={...plan,scope:'mailbox',mailRef:'메일',otherRef:''};
  assert.equal(checkDecision(raw,prompt).kind,'review');
  assert.throws(()=>explicitPlan(raw,prompt),{code:'MAIL_REVIEW'});
  assert.throws(()=>searchScope({...plan,folder:'unknown'}),{code:'MAIL_PLAN'});
});
test('Outlook은 받은편지함과 보낸편지함 경로에서 날짜순으로 열 건을 모으고 이동 중 중복을 한 번만 센다',async()=>{
  const calls=[],plan=twoFolders();
  const message=(id,day)=>({id,subject:id,receivedDateTime:day,sentDateTime:day,webLink:'https://outlook.office.com/mail/id/'+id});
  const dated=(day)=>'2026-11-'+String(day).padStart(2,'0')+'T05:00:00Z';
  const folders={inbox:[message('shared',dated(8)),...Array.from({length:6},(_,i)=>message('in'+i,dated(1+i)))],
    sentitems:[message('shared',dated(12)),...Array.from({length:5},(_,i)=>message('out'+i,dated(13+i)))]};
  const fetch=async raw=>{
    const path=new URL(raw).pathname;calls.push(path);
    return json({value:folders[path.split('/').at(-2)]||[message('archive',dated(22))]});
  };
  const result=await searchMailbox({provider:'outlook',access:'fixture',plan,fetch});
  assert.deepEqual(calls,['/v1.0/me/mailFolders/inbox/messages','/v1.0/me/mailFolders/sentitems/messages']);
  assert.equal(result.items.length,10);assert.equal(result.more,true);assert.equal(result.code,undefined);
  assert.deepEqual(result.items.slice(0,6).map(item=>item.subject),['out4','out3','out2','out1','out0','shared']);
  assert.equal(result.items.filter(item=>item.subject==='shared').length,1);
  assert.equal(result.items.some(item=>item.subject==='archive'),false);
  assert.equal(result.items.some(item=>Object.hasOwn(item,'graphId')),false);
});
test('Outlook 두 폴더 중 하나만 응답하면 확인한 결과를 남기고 인증이 취소되면 다음 폴더 요청을 멈춘다',async()=>{
  const plan=twoFolders(),calls=[];
  const partial=await searchMailbox({provider:'outlook',access:'fixture',plan,fetch:async raw=>{
    const path=new URL(raw).pathname;calls.push(path);
    return path.endsWith('/inbox/messages')?json({value:[{id:'m',subject:'found',receivedDateTime:'2026-11-10T00:00:00Z'}]}):new Response('{}',{status:500});
  }});
  assert.equal(calls.length,2);assert.equal(partial.items[0].subject,'found');assert.equal(partial.code,'MAIL_NETWORK');
  let denied=0;
  await assert.rejects(searchMailbox({provider:'outlook',access:'fixture',plan,fetch:async()=>{denied++;return new Response('{}',{status:401});}}),{code:'MAIL_RECONNECT'});
  assert.equal(denied,1);
  await assert.rejects(searchMailbox({provider:'outlook',access:'fixture',plan,fetch:async raw=>
    String(raw).includes('/inbox/messages')?json({value:[]}):new Response('{}',{status:429})}),{code:'MAIL_LIMIT'});
  const abort=new AbortController();let interrupted=0;
  await assert.rejects(searchMailbox({provider:'outlook',access:'fixture',plan,signal:abort.signal,fetch:async()=>{
    interrupted++;abort.abort();return json({value:[]});
  }}),{code:'CANCELLED'});
  assert.equal(interrupted,1);
});

test('전체 발신자 주소를 지정하면 Gmail은 From에서 주소를 확인한 메일만 발췌한다',async()=>{
  const expected='studio+mail@example.test';
  const fromHeaders={
    a1:['"STUDIO+MAIL@example.test" <member@example.test>'],
    a2:['"협력사, 납품 \\"1팀\\"" (서울 (서부))\r\n\t<STUDIO+MAIL@EXAMPLE.TEST> (본사)'],
    a3:['다른 팀 <member@example.test> (studio+mail@example.test)'],
    a4:['studio+mail@example.test'],
    a5:[],
    a6:['member@example.test',expected],
    a7:['"납품팀 <studio+mail@example.test>"'],
    a8:['member@example.test, '+expected],
  };
  const plan=validatePlan({terms:[],from:expected,after:'',before:'',folder:'inbox',provider:'gmail',inherit:false});
  const snippets=[],metadata=[];
  async function fetchFixture(raw){
    const url=new URL(raw);
    if(url.pathname.endsWith('/messages')){
      assert.equal(url.searchParams.get('maxResults'),'11');
      assert.ok(url.searchParams.get('q').includes('from:('+plan.from+')'));
      return json({messages:Object.keys(fromHeaders).map(id=>({id}))});
    }
    const id=url.pathname.split('/').at(-1);
    if(url.searchParams.get('format')==='metadata'){
      metadata.push(id);
      return json({id,payload:{headers:fromHeaders[id].map(value=>({name:'From',value}))}});
    }
    snippets.push(id);
    assert.equal(url.searchParams.get('fields'),'id,internalDate,snippet');
    return json({id,internalDate:'1794300000000',snippet:id});
  }
  const search=()=>searchMailbox({provider:'gmail',access:'fixture',plan,fetch:fetchFixture});
  const got=await search();
  assert.deepEqual(metadata,Object.keys(fromHeaders));
  assert.deepEqual(snippets,['a2','a4']);
  assert.deepEqual(got.items.map(item=>item.sourceId),snippets);
  assert.equal(got.code,undefined);
  plan.from='납품 팀';snippets.length=0;
  assert.equal((await search()).items.length,Object.keys(fromHeaders).length);
  assert.deepEqual(snippets,Object.keys(fromHeaders));
});

test('전체 발신자 주소를 지정하면 Outlook은 표시 이름을 무시하고 다음 페이지의 일치 메일까지 읽는다',async()=>{
  const expected='Studio+mail@example.test';
  const rows=[
    {id:'first',from:{emailAddress:{name:expected,address:'member@example.test'}}},
    {id:'missing',from:{emailAddress:{name:expected}}},
    {id:'last',from:{emailAddress:{name:'납품 팀',address:'STUDIO+MAIL@EXAMPLE.TEST'}}},
  ].map(row=>({...row,subject:row.id,receivedDateTime:'2026-11-10T03:00:00Z'}));
  const plan=validatePlan({terms:[],from:expected,after:'',before:'',folder:'inbox',provider:'outlook',inherit:false});
  const fetched=[];
  async function fetchFixture(raw){
    const url=new URL(raw);
    assert.equal(url.pathname,'/v1.0/me/mailFolders/inbox/messages');
    fetched.push(url.href);
    if(url.searchParams.has('$skiptoken'))return json({value:rows.slice(2)});
    assert.ok(JSON.parse(url.searchParams.get('$search')).includes('from:'+(plan.from.includes(' ')?'"'+plan.from+'"':plan.from)));
    return json({value:rows.slice(0,2),'@odata.nextLink':url.origin+url.pathname+'?$skiptoken=next'});
  }
  const search=()=>searchMailbox({provider:'outlook',access:'fixture',plan,fetch:fetchFixture});
  const got=await search();assert.deepEqual(got.items.map(item=>item.subject),['last']);
  assert.equal(got.code,undefined);assert.equal(fetched.length,2);
  plan.from='납품 팀';fetched.length=0;
  assert.deepEqual((await search()).items.map(item=>item.subject),['first','missing','last']);
  assert.equal(fetched.length,2);
});
