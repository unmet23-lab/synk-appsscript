// PULSE 「인플루언서 광고」 의뢰 동작(조각 ②, 2026-11-23). 설계 docs/디자인/PULSE고객경험_20261120/인플루언서_의뢰창_설계.md 9절 「조각 ②」.
// 이 시험의 사람 · 채널 · 금액은 모두 합성이다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {createCompanyApp} from './server.mjs';
import {applyPeopleAction,peopleRequestsView,peopleEvents,openPeopleRequests,PEOPLE_LIMITS} from './pulse-people-requests.mjs';
import {localizeCustomerProject,staffSources} from './pulse-translations.mjs';
import {pulseMailActed,pulseMailCompose,PULSE_MAIL_MOMENTS} from './pulse-mail.mjs';
import {serverText} from './pulse-locale.mjs';

const AT='2026-11-23T03:00:00.000Z';
const channel=(extra={})=>({id:'ch_cafe0001',name:'합성 카페 채널',platform:'instagram',handle:'@synthetic.cafe',url:'https://www.instagram.com/synthetic.cafe/',topics:['food'],audience:'합성 시청자',followers:12000,avgViews:3400,prices:{post:300000,review:null},image:'',samples:[],virtual:false,example:false,active:true,...extra});
const roster=(entries=[channel()],{on=true,version=3}={})=>({visible:()=>on&&entries.some(item=>item.active&&!item.example),read:()=>({version,entries})});
const staffStamp={author:'staff',authorId:'u1',authorName:'담당자 합성',at:AT},customerStamp={author:'customer',authorId:'customer',authorName:'손님',at:AT};
const refuses=(fn,pattern,status=400,message=String(pattern))=>assert.throws(fn,error=>error.status===status&&pattern.test(error.message),message);
function run(studio,input,{staff=false,people=roster(),row={versions:[{id:'v1'}]},locale='ko'}={}){
  applyPeopleAction({studio,row,input,staff,stamp:staff?staffStamp:customerStamp,locale,people});
  return studio;
}
const sent=(studio={},extra={})=>run(studio,{action:'people_request',channelId:'ch_cafe0001',note:'후기도 같이\n찍어 주시면 좋겠어요',rosterVersion:3,...extra});
const only=studio=>studio.people.requests.at(-1);

test('의뢰: 서버가 명단에서 채널 이름 · 값을 복사하고, 보낼 수 없는 때는 까닭과 함께 막는다',()=>{
  const studio=sent();const item=only(studio);
  assert.equal(item.status,'sent');assert.deepEqual(item.channel,{id:'ch_cafe0001',name:'합성 카페 채널',platform:'instagram',handle:'@synthetic.cafe',url:'https://www.instagram.com/synthetic.cafe/',virtual:false,price:300000});
  assert.equal(item.note,'후기도 같이\n찍어 주시면 좋겠어요');assert.deepEqual(item.trail,[{kind:'sent',at:AT,by:'customer'}]);
  refuses(()=>sent({},{rosterVersion:2}),/채널 명단이 바뀌었어요/,409);
  refuses(()=>run({},{action:'people_request',channelId:'ch_cafe0001',note:'',rosterVersion:3},{people:roster([channel()],{on:false})}),/받지 않아요/,404);
  refuses(()=>run({},{action:'people_request',channelId:'ch_cafe0001',note:'',rosterVersion:3},{people:null}),/받지 않아요/,404);
  refuses(()=>run({},{action:'people_request',channelId:'ch_cafe0001',note:'',rosterVersion:3},{row:{versions:[]}}),/영상 시안이 나온 뒤/,409);
  refuses(()=>run({},{action:'people_request',channelId:'ch_x',note:'',rosterVersion:3},{people:roster([channel(),channel({id:'ch_x',example:true})])}),/고를 수 없는 채널/,404);
  refuses(()=>run({},{action:'people_request',channelId:'ch_x',note:'',rosterVersion:3},{people:roster([channel(),channel({id:'ch_x',active:false})])}),/고를 수 없는 채널/,404);
  refuses(()=>sent(studio),/진행 중인 의뢰가 끝난 뒤에/,409);
  refuses(()=>sent({},{note:'가'.repeat(501)}),/한마디를 확인/);
  refuses(()=>run({},{action:'people_request',channelId:'ch_cafe0001',note:'',rosterVersion:3},{staff:true}),/고객 화면에서만/,403);
});

test('열린 의뢰는 프로젝트마다 한 건, 기록은 스물까지. 끝나거나 닫힌 의뢰는 열린 수에 들지 않는다',()=>{
  const ids=['ch_a0000001','ch_b0000001'],people=roster(ids.map(id=>channel({id,url:'https://www.instagram.com/'+id+'/',handle:'@'+id})));
  const studio={};run(studio,{action:'people_request',channelId:ids[0],note:'',rosterVersion:3},{people});
  refuses(()=>run(studio,{action:'people_request',channelId:ids[1],note:'',rosterVersion:3},{people}),/진행 중인 의뢰가 끝난 뒤에 다른 채널에 의뢰할 수 있어요/,409,'다른 채널도 열린 의뢰가 끝난 뒤에(같은 채널에 둘이 생길 길이 없다)');
  run(studio,{action:'people_cancel',requestId:studio.people.requests[0].id,why:''});
  run(studio,{action:'people_request',channelId:ids[1],note:'',rosterVersion:3},{people});
  assert.equal(openPeopleRequests(studio).length,1);
  const full={people:{schemaVersion:1,requests:Array.from({length:PEOPLE_LIMITS.requests},(_,i)=>({id:'x'+i,status:'done',channel:{id:'ch_old'}}))}};
  refuses(()=>run(full,{action:'people_request',channelId:ids[0],note:'',rosterVersion:3},{people}),/가득 찼어요/,409);
});

test('값 안내 → 동의 → 결제 확인 → 게시 → 결과. 단계를 건너뛰면 409, 담당자 · 손님 동작은 서로 못 한다',()=>{
  const studio=sent(),id=only(studio).id;
  refuses(()=>run(studio,{action:'people_agree',requestId:id,amount:300000}),/다음 단계로/,409);
  refuses(()=>run(studio,{action:'people_quote',requestId:id,amount:300000,includes:'',postBy:''}),/담당자 화면에서만/,403);
  refuses(()=>run(studio,{action:'people_quote',requestId:id,amount:9999,includes:'',postBy:''},{staff:true}),/1만 원에서 1억 원/);
  refuses(()=>run(studio,{action:'people_quote',requestId:id,amount:300000.5,includes:'',postBy:''},{staff:true}),/1만 원에서 1억 원/);
  refuses(()=>run(studio,{action:'people_quote',requestId:id,amount:300000,includes:'',postBy:'2026-02-30'},{staff:true}),/게시 예정일/);
  refuses(()=>run(studio,{action:'people_quote',requestId:id,amount:300000,includes:'',postBy:'2026-13-01'},{staff:true}),/게시 예정일/);
  refuses(()=>run(studio,{action:'people_quote',requestId:id,amount:300000,includes:'',postBy:false},{staff:true}),/게시 예정일/);
  run(studio,{action:'people_quote',requestId:id,amount:300000,includes:'릴스 한 편 · 스토리 한 번',postBy:'2026-12-05'},{staff:true});
  assert.equal(only(studio).status,'quoted');
  // 값을 다시 보낼 수 있고, 손님은 지금 보이는 값으로만 동의한다.
  run(studio,{action:'people_quote',requestId:id,amount:350000,includes:'릴스 한 편 · 스토리 한 번 · 직접 찍은 후기',postBy:'2026-12-05'},{staff:true});
  refuses(()=>run(studio,{action:'people_agree',requestId:id,amount:300000}),/값이 바뀌었어요/,409);
  run(studio,{action:'people_agree',requestId:id,amount:350000});assert.equal(only(studio).status,'agreed');
  refuses(()=>run(studio,{action:'people_cancel',requestId:id,why:''}),/다음 단계로/,409,'동의한 뒤에는 손님이 거두지 못한다(GPT 검수 GA3)');
  refuses(()=>run(studio,{action:'people_posted',requestId:id,posts:['https://www.instagram.com/p/x/'],disclosed:true},{staff:true}),/다음 단계로/,409);
  run(studio,{action:'people_paid',requestId:id,ref:'크몽 주문 합성-1'},{staff:true});
  refuses(()=>run(studio,{action:'people_cancel',requestId:id,why:''}),/다음 단계로/,409);
  refuses(()=>run(studio,{action:'people_posted',requestId:id,posts:['https://www.instagram.com/p/x/'],disclosed:false},{staff:true}),/광고」 표시/);
  refuses(()=>run(studio,{action:'people_posted',requestId:id,posts:['http://www.instagram.com/p/x/'],disclosed:true},{staff:true}),/https/);
  refuses(()=>run(studio,{action:'people_posted',requestId:id,posts:[],disclosed:true},{staff:true}),/1~5개/);
  refuses(()=>run(studio,{action:'people_posted',requestId:id,posts:Array.from({length:6},(_,i)=>`https://example.com/${i}`),disclosed:true},{staff:true}),/1~5개/);
  run(studio,{action:'people_posted',requestId:id,posts:['https://www.instagram.com/p/x/','https://www.instagram.com/p/x/'],disclosed:true},{staff:true});
  assert.deepEqual(only(studio).posts,['https://www.instagram.com/p/x/'],'같은 주소는 한 번');
  refuses(()=>run(studio,{action:'people_done',requestId:id,result:''},{staff:true}),/결과 한 줄을 적어/);
  run(studio,{action:'people_done',requestId:id,result:'조회 2.1만 · 저장 340'},{staff:true});
  const item=only(studio);assert.equal(item.status,'done');
  assert.deepEqual(item.trail.map(entry=>`${entry.kind}:${entry.by}`),['sent:customer','quoted:staff','quoted:staff','agreed:customer','paid:staff','posted:staff','done:staff']);
  refuses(()=>run(studio,{action:'people_close',requestId:id,why:'끝'},{staff:true}),/다음 단계로/,409);
  refuses(()=>run(studio,{action:'people_done',requestId:'00000000-0000-4000-8000-000000000000',result:'x'},{staff:true}),/찾지 못했어요/,404);
});

test('거두기 · 닫기: 손님은 동의 전까지, 담당자는 열린 의뢰 모두(까닭 필수)',()=>{
  const studio=sent(),id=only(studio).id;
  run(studio,{action:'people_quote',requestId:id,amount:200000,includes:'',postBy:''},{staff:true});
  run(studio,{action:'people_cancel',requestId:id,why:'값이 예산보다 커요'});
  assert.deepEqual(only(studio).closed,{by:'customer',why:'값이 예산보다 커요',at:AT,from:'quoted'});
  const other=sent(),otherId=only(other).id;
  refuses(()=>run(other,{action:'people_close',requestId:otherId,why:''},{staff:true}),/닫는 까닭/);
  run(other,{action:'people_close',requestId:otherId,why:'채널이 이번 달 광고를 받지 않아요'},{staff:true});
  assert.equal(only(other).closed.by,'staff');
});

test('손님 보기에는 크몽 주문 메모와 담당자 이름이 없다. 영어 프로젝트는 손님에게 보일 글의 번역이 있어야 보낸다',()=>{
  const studio=sent(),id=only(studio).id;
  refuses(()=>run(studio,{action:'people_quote',requestId:id,amount:300000,includes:'릴스 한 편',postBy:''},{staff:true,locale:'en'}),/영어 프로젝트예요/,409);
  run(studio,{action:'people_quote',requestId:id,amount:300000,includes:'릴스 한 편',postBy:'',translation:{includes:'One Reel'}},{staff:true,locale:'en'});
  run(studio,{action:'people_agree',requestId:id,amount:300000},{locale:'en'});
  run(studio,{action:'people_paid',requestId:id,ref:'주문 비공개-77'},{staff:true,locale:'en'});
  const staffView=peopleRequestsView(studio,{staff:true}),customerView=peopleRequestsView(studio);
  assert.equal(staffView.requests[0].paid.ref,'주문 비공개-77');assert.equal(staffView.requests[0].quote.by,'담당자 합성');
  const raw=JSON.stringify(customerView);assert.equal(raw.includes('비공개-77'),false);assert.equal(raw.includes('담당자 합성'),false);
  assert.deepEqual(Object.keys(customerView.requests[0].paid),['at']);
  assert.equal(staffSources(studio).get(`people:${id}:includes`).text,'릴스 한 편');
  const shown=localizeCustomerProject({studio:{people:customerView}},{map:studio.translations,locale:'en',text:value=>value,producer:'Producer'});
  assert.equal(shown.studio.people.requests[0].quote.includes,'One Reel');
  assert.equal(peopleRequestsView({}),undefined,'의뢰가 없으면 칸이 없다');
});

test('알림 사건: 앞뒤 문서를 견줘 상태가 바뀐(또는 값을 다시 보낸) 의뢰만',()=>{
  const before=sent(),id=only(before).id,after=structuredClone(before);
  assert.deepEqual(peopleEvents({},before).map(entry=>entry.kind),['sent']);
  assert.deepEqual(peopleEvents(before,structuredClone(before)),[]);
  run(after,{action:'people_quote',requestId:id,amount:200000,includes:'',postBy:''},{staff:true});
  assert.deepEqual(peopleEvents(before,after).map(entry=>entry.kind),['quoted']);
  const again=structuredClone(after);again.people.requests[0].quote={...again.people.requests[0].quote,at:'2026-11-23T04:00:00.000Z'};
  assert.deepEqual(peopleEvents(after,again).map(entry=>entry.kind),['quoted'],'값을 다시 보내면 다시 알린다');
});

test('메일: 값 안내와 게시 두 순간. 손님이 이미 답했거나 닫혔으면 보내지 않는다. 손님이 쓴 한마디는 메일에 없다',()=>{
  assert.ok(PULSE_MAIL_MOMENTS.includes('people_quoted')&&PULSE_MAIL_MOMENTS.includes('people_posted'));
  const studio=sent(),id=only(studio).id;
  run(studio,{action:'people_quote',requestId:id,amount:350000,includes:'',postBy:''},{staff:true});
  const view=()=>({studio:{...studio,request:{answers:{name:'합성 음료',contactName:'김합성'}}}}),latest={peopleId:id};
  assert.equal(pulseMailActed(view(),'people_quoted',latest),false);
  const mail=pulseMailCompose(view(),'people_quoted','ko',latest);
  assert.match(mail.subject,/인플루언서 광고 값이 나왔어요/);assert.match(mail.body,/합성 카페 채널/);assert.match(mail.body,/35만 원/);
  assert.equal(mail.body.includes('후기도 같이'),false);
  const english=pulseMailCompose(view(),'people_quoted','en',latest);assert.match(english.subject,/influencer ad quote/);assert.match(english.body,/KRW 350,000/);
  run(studio,{action:'people_agree',requestId:id,amount:350000});
  assert.equal(pulseMailActed(view(),'people_quoted',latest),true,'동의한 뒤에는 보내지 않는다');
  assert.equal(pulseMailActed(view(),'people_quoted',{peopleId:'없음'}),true);
  run(studio,{action:'people_paid',requestId:id,ref:''},{staff:true});
  run(studio,{action:'people_posted',requestId:id,posts:['https://www.instagram.com/p/x/'],disclosed:true},{staff:true});
  assert.equal(pulseMailActed(view(),'people_posted',latest),false);
  assert.match(pulseMailCompose(view(),'people_posted','ko',latest).subject,/채널에 광고가 올라갔어요/);
  run(studio,{action:'people_done',requestId:id,result:'끝'},{staff:true});
  assert.equal(pulseMailActed(view(),'people_posted',latest),false,'결과까지 간 뒤에도 게시 메일은 보낸다');
  assert.equal(serverText('en','인플루언서 광고 값이 나왔어요'),'Your influencer ad quote is ready');
});

async function server(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-pulse-people-requests-'));
  const options={dataDir:join(directory,'server'),clientIntakeDir:join(directory,'inbox'),host:'127.0.0.1',port:0,origin:'http://127.0.0.1:0',allowTestHost:true,schedule:false,workNotificationsEnabled:false,webPushEnabled:false,synkIdentityConfig:null,synkCustomerIdentityConfig:null,pulseRequestFreeBytes:async()=>100*1024**3};
  const app=createCompanyApp(options),address=await app.start(),base='http://127.0.0.1:'+address.port;
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const person=(name,email,role,csrf)=>{const row=app.store.createUser({name,email,role,teamId:'team-a'});return {row,id:row.id,csrf,token:app.store.mint('session',row.id,{csrfToken:csrf},120)};};
  const admin=person('관리자 합성','admin@people-requests.test','admin','csrf-admin'),member=person('담당자 합성','member@people-requests.test','member','csrf-member');
  const parse=async response=>{const text=await response.text();let data=null;try{data=JSON.parse(text);}catch{}return {status:response.status,data,text};};
  const staff=(who,path,{body}={})=>fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Cookie:'synk_company_session='+who.token,'X-CSRF-Token':who.csrf,Origin:app.origin,...(body!==undefined?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:JSON.stringify(body)}).then(parse);
  const jar=new Map();
  const call=async(path,{body,csrf=''}={})=>{
    const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{...(jar.size?{Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')}:{}),Origin:app.origin,...(csrf?{'X-Pulse-CSRF':csrf}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
    for(const line of response.headers.getSetCookie?.()||[]){const [pair,...rest]=line.split(';'),[name,value]=pair.split('=');if(value&&!/max-age=0/i.test(rest.join(';')))jar.set(name,value);else jar.delete(name);}
    return parse(response);
  };
  let project=app.clientProjects.save(admin.row,{title:'합성 프로젝트',customerName:'합성 고객',ownerId:member.id,dueDate:'2026-12-01'}).project;
  const raw=()=>app.store.get('clientProjects',project.id);
  const invite=app.clientProjects.invite(admin.row,project.id,{revision:raw().revision}).invite;
  assert.equal((await call('/pulse/api/open',{body:{invite}})).status,200);
  const room=async()=>(await call('/pulse/api/project')).data;
  const customer=async body=>{const state=await room();return call('/pulse/api/studio',{body:{revision:state.project.revision,...body},csrf:state.csrf});};
  const studioAct=async(who,body)=>staff(who,'/api/client-projects/'+project.id+'/studio',{body:{revision:raw().revision,...body}});
  const preview=async()=>{const result=await staff(member,'/api/client-projects/'+project.id+'/versions',{body:{revision:raw().revision,kind:'preview',label:'v1',url:'https://example.test/v1'}});assert.equal(result.status,200,result.text);};
  const setRoster=async entries=>{const view=await staff(admin,'/api/pulse-people');const saved=await staff(admin,'/api/pulse-people/roster',{body:{version:view.data.version,entries}});assert.equal(saved.status,200,saved.text);return saved.data.version;};
  const feature=async on=>assert.equal((await staff(admin,'/api/settings/pulse-features',{body:{people:on}})).status,200);
  const staffNews=async()=>(await staff(member,'/api/client-projects/'+project.id+'/news')).data;
  return {app,admin,member,staff,call,room,customer,studioAct,preview,setRoster,feature,raw,project,staffNews};
}

test('회사 서버 길: 손님 의뢰 → 담당자 알림 → 값 안내 → 손님 알림(창 people, peopleId) → 동의 → 결제 → 게시 → 결과. 열린 의뢰가 있으면 보관을 막는다',async t=>{
  const f=await server(t);
  await f.feature(true);const version=await f.setRoster([channel({id:''})]);
  const list=await f.call('/pulse/api/people');assert.equal(list.status,200,list.text);assert.equal(list.data.version,version);
  const channelId=list.data.entries[0].id;
  let result=await f.customer({action:'people_request',channelId,note:'',rosterVersion:version});
  assert.equal(result.status,409,'시안 전에는 보내지 못한다');assert.match(result.data.error||result.text,/영상 시안이 나온 뒤/);
  await f.preview();
  result=await f.customer({action:'people_request',channelId,note:'',rosterVersion:version-1});assert.equal(result.status,409);
  assert.equal((await f.customer({action:'people_request',channelId,note:'',rosterVersion:version,price:1})).status,400,'화면이 값 · 이름을 보내면 400');
  result=await f.customer({action:'people_request',channelId,note:'겨울 신메뉴로',rosterVersion:version});assert.equal(result.status,200,result.text);
  const id=result.data.project.studio.people.requests[0].id;
  assert.equal(result.data.project.studio.people.requests[0].channel.price,300000);
  // 명단 규칙: 진행 중인 의뢰가 있는 칸은 지울 수 없고 주소 · 플랫폼을 바꿀 수 없다(GPT 검수 GA2 · GA3). 같은 채널은 칸 id로만 보므로 주소가 같은 칸도 막지 않는다.
  const roster=(await f.staff(f.admin,'/api/pulse-people')).data;
  const removed=await f.staff(f.admin,'/api/pulse-people/roster',{body:{version:roster.version,entries:roster.entries.filter(item=>item.id!==channelId)}});
  assert.equal(removed.status,409,removed.text);assert.match(removed.data.error||removed.text,/진행 중인 의뢰 1건이 있어 지울 수 없어요/);
  const rewrite=patch=>f.staff(f.admin,'/api/pulse-people/roster',{body:{version:roster.version,entries:roster.entries.map(item=>item.id===channelId?{...item,...patch}:item)}});
  const moved=await rewrite({name:'다른 채널',handle:'@other.channel',url:'https://www.instagram.com/other.channel/'});
  assert.equal(moved.status,409,'의뢰가 있는 칸을 다른 채널 주소로 고쳐 쓰지 못한다');assert.match(moved.data.error||moved.text,/진행 중인 의뢰 1건이 있어 채널 주소와 플랫폼을 바꿀 수 없어요/);
  assert.equal((await rewrite({url:'https://www.instagram.com/synthetic.cafe/?hl=ko'})).status,409,'주소는 글자 그대로 견준다 — 같은 계정의 다른 꼴도 바꾸기다');
  assert.equal((await rewrite({platform:'youtube'})).status,409,'플랫폼 바꾸기도 막는다');
  assert.equal((await f.staff(f.admin,'/api/pulse-people')).data.version,roster.version,'막힌 저장은 명단 판을 올리지 않는다');
  const twin=await f.staff(f.admin,'/api/pulse-people/roster',{body:{version:roster.version,entries:[...roster.entries,channel({id:'',name:'같은 주소의 둘째 칸',handle:'',url:'https://www.instagram.com/synthetic.cafe/'})]}});
  assert.equal(twin.status,200,'명단은 주소 꼴로 같은 채널을 막지 않는다 — 의뢰는 칸 id로만 본다(설계 9절 「같은 채널」)');
  roster.version=twin.data.version;roster.entries=twin.data.entries;
  const twinId=roster.entries.find(item=>item.name==='같은 주소의 둘째 칸').id;
  roster.entries=roster.entries.filter(item=>item.id!==twinId);
  const dropped=await f.staff(f.admin,'/api/pulse-people/roster',{body:{version:roster.version,entries:roster.entries}});assert.equal(dropped.status,200,'의뢰 없는 칸은 지울 수 있다');roster.version=dropped.data.version;roster.entries=dropped.data.entries;
  const edited=await f.staff(f.admin,'/api/pulse-people/roster',{body:{version:roster.version,entries:roster.entries.map(item=>item.id===channelId?{...item,name:'합성 카페 채널(새 이름)',prices:{post:310000,review:null}}:item)}});
  assert.equal(edited.status,200,'의뢰가 있는 칸도 이름 · 값은 고칠 수 있다');roster.version=edited.data.version;roster.entries=edited.data.entries;
  const off=await f.staff(f.admin,'/api/pulse-people/roster',{body:{version:roster.version,entries:roster.entries.map(item=>item.id===channelId?{...item,active:false}:item)}});
  assert.equal(off.status,200,'「켜 둠」을 끄는 것은 된다');
  const back=(await f.staff(f.admin,'/api/pulse-people')).data;
  assert.equal((await f.staff(f.admin,'/api/pulse-people/roster',{body:{version:back.version,entries:back.entries.map(item=>({...item,active:true}))}})).status,200);
  const events=()=>f.raw().notificationEvents.filter(event=>/people/.test(event.type));
  assert.deepEqual(events().map(event=>[event.type,event.tab,event.audiences.join()]),[['customer_people_request','desk','owner,reviewer']]);
  const news=await f.staffNews();assert.ok(news.items.some(item=>item.type==='customer_people_request'&&/채널과 값/.test(item.text)&&item.href.includes('tab=desk')),JSON.stringify(news.items.map(item=>[item.type,item.href])));
  // 담당자 동작은 직원 길로만, 손님 동작은 손님 길로만.
  assert.equal((await f.customer({action:'people_quote',requestId:id,amount:300000,includes:'',postBy:''})).status,403);
  assert.equal((await f.studioAct(f.member,{action:'people_agree',requestId:id,amount:300000})).status,403);
  result=await f.studioAct(f.member,{action:'people_quote',requestId:id,amount:320000,includes:'릴스 한 편',postBy:'2026-12-10'});assert.equal(result.status,200,result.text);
  const live=(await f.call('/pulse/api/live')).data;
  const quoted=live.notifications.find(item=>item.type==='people_quoted');
  assert.ok(quoted,'손님에게 값 안내 알림');assert.equal(quoted.tab,'people');assert.equal(quoted.peopleId,id);assert.match(quoted.body,/진행할지 골라/);
  // 보관 막기
  assert.throws(()=>f.app.clientProjects.save(f.admin.row,{...f.raw(),revision:f.raw().revision,stage:'archived'},f.project.id),error=>error.status===409&&/진행 중인 인플루언서 광고/.test(error.message));
  // 스위치를 꺼도 보낸 의뢰는 보이고 이어진다. 새 의뢰와 명단은 막힌다.
  await f.feature(false);
  assert.equal((await f.call('/pulse/api/people')).status,404);
  const state=await f.room();assert.equal(state.features.people,false);assert.equal(state.project.studio.people.requests[0].status,'quoted');
  assert.equal((await f.customer({action:'people_agree',requestId:id,amount:320000})).status,200);
  assert.equal((await f.studioAct(f.member,{action:'people_paid',requestId:id,ref:'크몽 합성-9'})).status,200);
  assert.equal(JSON.stringify((await f.room()).project.studio.people).includes('합성-9'),false,'손님에게 주문 메모가 내려가지 않는다');
  assert.equal((await f.studioAct(f.member,{action:'people_posted',requestId:id,posts:['https://www.instagram.com/p/synthetic/'],disclosed:true})).status,200);
  assert.equal((await f.studioAct(f.member,{action:'people_done',requestId:id,result:'조회 1.8만'})).status,200);
  assert.deepEqual(events().map(event=>event.type),['customer_people_request','people_quoted','customer_people_agree','people_paid','people_posted','people_done']);
  const saved=f.app.clientProjects.save(f.admin.row,{...f.raw(),revision:f.raw().revision,stage:'archived'},f.project.id);
  assert.equal(saved.project?.stage??f.raw().stage,'archived','끝난 뒤에는 보관할 수 있다');
});

test('회사 서버 길: 스위치를 끈 뒤 손님은 거둘 수 있고 담당자는 닫을 수 있다. 새 의뢰는 404',async t=>{
  const f=await server(t);
  await f.feature(true);const version=await f.setRoster([channel({id:''}),channel({id:'',name:'합성 운동 채널',platform:'youtube',handle:'@synthetic.fit',url:'https://www.youtube.com/@synthetic.fit'})]);
  await f.preview();
  const ids=(await f.call('/pulse/api/people')).data.entries.map(item=>item.id);
  const first=await f.customer({action:'people_request',channelId:ids[0],note:'',rosterVersion:version});assert.equal(first.status,200,first.text);
  assert.equal((await f.customer({action:'people_request',channelId:ids[1],note:'',rosterVersion:version})).status,409,'열린 의뢰는 한 건');
  const a=first.data.project.studio.people.requests[0].id;
  await f.feature(false);
  assert.equal((await f.customer({action:'people_request',channelId:ids[0],note:'',rosterVersion:version})).status,404);
  assert.equal((await f.customer({action:'people_cancel',requestId:a,why:''})).status,200,'끈 뒤에도 손님은 보냄 단계 의뢰를 거둘 수 있다');
  await f.feature(true);
  const second=await f.customer({action:'people_request',channelId:ids[1],note:'',rosterVersion:version});assert.equal(second.status,200,second.text);
  const b=second.data.project.studio.people.requests[1].id;
  await f.feature(false);
  assert.equal((await f.studioAct(f.member,{action:'people_close',requestId:b,why:'채널 일정이 맞지 않아요'})).status,200);
  const live=(await f.call('/pulse/api/live')).data;
  assert.ok(live.notifications.some(item=>item.type==='people_closed'&&item.peopleId===b));
  assert.equal(live.notifications.some(item=>item.type==='people_closed'&&item.peopleId===a),false,'손님이 거둔 것은 손님에게 알리지 않는다');
  assert.ok(f.raw().notificationEvents.some(event=>event.type==='customer_people_cancel'));
});
