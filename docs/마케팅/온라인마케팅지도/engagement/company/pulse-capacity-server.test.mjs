// PULSE 접수 멈춤 스위치(2026-11-11 운영 조각 3, 설계 docs/마케팅/PULSE_의뢰흐름_20261104/소통_정원_현황_운영판_설계_20261111.md S2) — 서버를 띄워서 본다.
// 쉬는 동안 새 의뢰서 시작만 409, 쓰던 초안의 저장 · 파일 · 보내기와 접수 직후 10분 재전송은 그대로, 공개 응답에 건수 · 이름 없음,
// 설정은 관리자 · CSRF · 감사 기록, 다시 여는 날이 되면 저절로 열림, 저장 문서가 이상하면 여는 쪽.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {createCompanyApp} from './server.mjs';
import {readPulseCapacity,createPulseCapacity,kstDate,CAPACITY_LIMITS} from './pulse-capacity.mjs';
import {ERROR_CODE_TEXT} from './public/pulse-app/api.mjs';
import en from './public/pulse-app/i18n/en.mjs';
import {REQUEST_LIMITS} from './pulse-requests.mjs';

const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
const answers=(extra={})=>({name:'합성 탄산수',kind:'food',channels:['shorts'],package:'s15',audience:'운동 끝난 20대',oneThing:'한 캔에 맛이 다섯 번',action:'buy',contactName:'김합성',email:'buyer@pulse-synthetic.test',consent:true,rights:true,...extra});
async function fixture(t,extra={}){
  const directory=await mkdtemp(join(tmpdir(),'synk-pulse-capacity-'));
  const options={dataDir:join(directory,'server'),clientIntakeDir:join(directory,'inbox'),host:'127.0.0.1',port:0,origin:'http://127.0.0.1:0',allowTestHost:true,schedule:false,workNotificationsEnabled:false,webPushEnabled:false,synkIdentityConfig:null,synkCustomerIdentityConfig:null,pulseRequestFreeBytes:async()=>100*1024**3,...extra};
  const app=createCompanyApp(options),address=await app.start(),base='http://127.0.0.1:'+address.port;
  const owner=app.store.createUser({name:'담당자',email:'owner@pulse-synthetic.test',role:'admin'}),token=app.store.mint('session',owner.id,{csrfToken:'staff-csrf'},120);
  const member=app.store.createUser({name:'크루',email:'crew@pulse-synthetic.test',role:'member'}),memberToken=app.store.mint('session',member.id,{csrfToken:'crew-csrf'},120);
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const jar=new Map();
  function remember(response){for(const line of response.headers.getSetCookie?.()||[]){const [pair,...rest]=line.split(';'),[name,value]=pair.split('=');if(value&&!/max-age=0/i.test(rest.join(';')))jar.set(name,value);else jar.delete(name);}}
  const parse=async response=>{const bytes=Buffer.from(await response.arrayBuffer());let data=null;try{data=JSON.parse(bytes.toString());}catch{}return {status:response.status,data,text:bytes.toString(),headers:response.headers};};
  async function call(path,{body,raw,headers={},csrf='',method=body===undefined&&raw===undefined?'GET':'POST'}={}){
    const response=await fetch(base+path,{method,headers:{...(jar.size?{Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')}:{}),Origin:app.origin,...(csrf?{'X-Pulse-CSRF':csrf}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers},body:raw??(body===undefined?undefined:JSON.stringify(body))});
    remember(response);return parse(response);
  }
  async function staff(path,{body,session=token,csrf='staff-csrf'}={}){
    const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Cookie:'synk_company_session='+session,...(csrf?{'X-CSRF-Token':csrf}:{}),Origin:app.origin,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
    return parse(response);
  }
  const start=()=>call('/pulse/api/request/start',{body:{}});
  const upload=csrf=>call('/pulse/api/request/media',{raw:png,csrf,headers:{'Content-Type':'image/png','X-File-Name':'front.png','X-Request-Slot':'front'}});
  const pause=(body={})=>staff('/api/settings/pulse-capacity',{body:{open:false,...body}});
  const reopen=()=>staff('/api/settings/pulse-capacity',{body:{open:true}});
  const audits=()=>app.store.all('audit').filter(row=>row.action==='pulse-capacity-settings');
  return {app,call,staff,start,upload,pause,reopen,audits,owner,member,memberToken,jar};
}

test('기본은 열림이다 — 공개 응답은 상태 하나뿐이고 잠깐 캐시된다',async t=>{
  const f=await fixture(t);
  const open=await f.call('/pulse/api/availability');
  assert.equal(open.status,200);assert.deepEqual(open.data,{state:'open'},'열려 있을 때는 화면이 더할 것이 없다');
  assert.equal(open.headers.get('cache-control'),'public, max-age=30');
  assert.equal(open.headers.get('x-content-type-options'),'nosniff');
  assert.equal((await f.call('/pulse/api/availability?x=1')).status,400,'주소에 꼬리를 붙여 캐시를 늘리지 못한다');
  assert.equal((await f.call('/pulse/api/availability',{body:{}})).status>=400,true,'읽기만 받는다');
  assert.equal((await f.start()).status,201);
  assert.equal(f.audits().length,0);
});

test('관리자만 접수를 쉬고 다시 열며, 바꿀 때마다 감사 기록이 남는다',async t=>{
  const f=await fixture(t,{clock:()=>'2026-11-11T03:00:00.000Z'});
  const read=await f.staff('/api/settings/pulse-capacity');
  assert.equal(read.status,200);assert.deepEqual(read.data,{open:true,pausedUntil:'',pauseNote:'',pauseNoteEn:'',state:'open',reopened:'',seats:{video:3,photo:5,queue:6},held:[],seatsNow:{video:{state:'open',used:0,total:3,waiting:0},photo:{state:'open',used:0,total:5,waiting:0},queue:{used:0,total:6}},canEdit:true,updatedAt:null,updatedBy:null});
  // 크루는 상태를 읽을 수 있지만(손님에게 보이는 값과 같다) 바꾸지 못하고, 누가 바꿨는지는 받지 않는다.
  const crew=await f.staff('/api/settings/pulse-capacity',{session:f.memberToken,csrf:'crew-csrf'});
  assert.equal(crew.status,200);assert.equal(crew.data.canEdit,false);assert.equal(Object.hasOwn(crew.data,'updatedBy'),false);
  assert.equal((await f.staff('/api/settings/pulse-capacity',{body:{open:false},session:f.memberToken,csrf:'crew-csrf'})).status,403,'크루는 못 바꾼다');
  assert.equal((await f.staff('/api/settings/pulse-capacity',{body:{open:false},csrf:''})).status,403,'CSRF 없이는 못 바꾼다');
  assert.equal((await f.staff('/api/settings/pulse-capacity',{session:'no-such-session',csrf:''})).status,401,'로그인 없이는 못 읽는다');
  const bad=[{},{open:'false'},{open:0},{open:false,extra:1},{open:false,pausedUntil:'2026-11-11'},{open:false,pausedUntil:'2026-11-10'},{open:false,pausedUntil:'2026-02-30'},{open:false,pausedUntil:'내일'},{open:false,pausedUntil:20261120},
    {open:false,pausedUntil:'2027-11-13'},{open:false,pauseNote:'가'.repeat(CAPACITY_LIMITS.note+1)},{open:false,pauseNote:'줄\n바꿈'},{open:false,pauseNote:7},{open:false,pauseNoteEn:'a'.repeat(CAPACITY_LIMITS.noteEn+1)},{open:true,pauseNote:'열면서 안내'},{open:true,pausedUntil:'2026-11-20'},['open'],null];
  for(const body of bad){const result=await f.staff('/api/settings/pulse-capacity',{body});assert.equal(result.status,400,JSON.stringify(body)+' '+result.text);}
  assert.equal(f.audits().length,0,'거절된 변경은 기록하지 않는다');
  assert.equal((await f.call('/pulse/api/availability')).data.state,'open','거절된 변경은 접수를 닫지 않는다');
  const paused=await f.pause({pausedUntil:'2026-11-12',pauseNote:'  촬영이 몰려 잠시 쉬어요.  ',pauseNoteEn:'We are fully booked for now.'});
  assert.equal(paused.status,200,paused.text);
  assert.deepEqual({...paused.data,updatedAt:null},{open:false,pausedUntil:'2026-11-12',pauseNote:'촬영이 몰려 잠시 쉬어요.',pauseNoteEn:'We are fully booked for now.',state:'paused',reopened:'',seats:{video:3,photo:5,queue:6},held:[],seatsNow:{video:{state:'open',used:0,total:3,waiting:0},photo:{state:'open',used:0,total:5,waiting:0},queue:{used:0,total:6}},canEdit:true,updatedAt:null,updatedBy:f.owner.id});
  assert.equal(f.audits().length,1);assert.equal(f.audits()[0].userId,f.owner.id);assert.equal(f.audits()[0].open,false);assert.equal(f.audits()[0].pausedUntil,'2026-11-12');assert.equal(f.audits()[0].pauseNote,'촬영이 몰려 잠시 쉬어요.');
  const reopened=await f.reopen();
  assert.equal(reopened.status,200);assert.deepEqual({...reopened.data,updatedAt:null,updatedBy:null},{open:true,pausedUntil:'',pauseNote:'',pauseNoteEn:'',state:'open',reopened:'',seats:{video:3,photo:5,queue:6},held:[],seatsNow:{video:{state:'open',used:0,total:3,waiting:0},photo:{state:'open',used:0,total:5,waiting:0},queue:{used:0,total:6}},canEdit:true,updatedAt:null,updatedBy:null},'열면 쉬는 안내는 지운다');
  assert.deepEqual({...f.app.store.get('pulseCapacity','main'),updatedAt:null,updatedBy:null},{open:true,pausedUntil:'',pauseNote:'',pauseNoteEn:'',updatedAt:null,updatedBy:null},'저장 문서에도 지난 안내가 남지 않는다');
  assert.equal(f.audits().length,2);assert.equal(f.audits().find(row=>row.open===true).pauseNote,'');
  assert.deepEqual((await f.call('/pulse/api/availability')).data,{state:'open'});
});

test('쉬는 동안 새 의뢰서 시작만 409로 막고, 공개 응답에는 건수 · 이름이 없다',async t=>{
  const f=await fixture(t);
  // 이미 들어온 의뢰가 있어도 공개 응답에 그 흔적이 없다.
  const sentDraft=(await f.start()).data.draft;await f.upload(sentDraft.csrf);
  const sent=await f.call('/pulse/api/request/submit',{body:{answers:answers()},csrf:sentDraft.csrf});assert.equal(sent.status,201,sent.text);
  f.jar.clear();
  assert.equal((await f.pause({pauseNote:'11월 셋째 주까지 제작 일정이 찼어요.'})).status,200);
  const drafts=f.app.store.all('pulseRequests').length;
  const blocked=await f.start();
  assert.equal(blocked.status,409,blocked.text);
  const said=blocked.data.error?.message||blocked.data.error;
  assert.equal(said,'지금은 잠시 접수를 쉬어요. 다시 열리면 이 화면에서 바로 시작하실 수 있어요.');
  assert.equal(blocked.data.code,'SYNK_PULSE_INTAKE_PAUSED','화면이 코드로 알아본다');
  assert.equal(ERROR_CODE_TEXT[blocked.data.code],said,'화면의 코드 표가 같은 문장을 가리킨다');assert.ok(en[said]&&!/[가-힣]/.test(en[said]),'영어 화면에는 영어로 나온다');
  assert.equal(f.jar.has('synk_pulse_request'),false,'막힌 시작은 초안 쿠키를 주지 않는다');
  assert.equal(f.app.store.all('pulseRequests').length,drafts,'막힌 시작은 초안을 만들지 않는다');
  const shown=await f.call('/pulse/api/availability');
  assert.deepEqual(shown.data,{state:'paused',until:'',note:'11월 셋째 주까지 제작 일정이 찼어요.',noteEn:''});
  for(const secret of [f.owner.id,f.owner.email,'담당자','김합성','buyer@pulse-synthetic.test','합성 탄산수',sent.data.number,sent.data.projectId,'updatedBy','updatedAt'])assert.equal(shown.text.includes(secret),false,'공개 응답에 없어야 한다: '+secret);
  // 쉬는 동안의 시작 시도는 주소별 시작 문턱을 쓰지 않는다 — 다시 열면 바로 시작된다.
  for(let i=0;i<REQUEST_LIMITS.startsPerHourByClient+2;i++)assert.equal((await f.start()).status,409);
  assert.equal((await f.reopen()).status,200);
  assert.equal((await f.start()).status,201,'다시 열면 그 자리에서 시작된다');
});

test('쉬기 전에 쓰던 초안은 쉬는 동안에도 저장 · 파일 · 보내기가 그대로 된다',async t=>{
  const f=await fixture(t);
  const draft=(await f.start()).data.draft;
  assert.equal((await f.pause()).status,200);
  const read=await f.call('/pulse/api/request');
  assert.equal(read.status,200);assert.equal(read.data.draft?.id,draft.id,'쓰던 초안을 그대로 읽는다');
  assert.equal((await f.call('/pulse/api/request/save',{body:{answers:answers({consent:undefined,rights:undefined}),step:'brand'},csrf:draft.csrf})).status,200);
  assert.equal((await f.upload(draft.csrf)).status,201);
  const sent=await f.call('/pulse/api/request/submit',{body:{answers:answers()},csrf:draft.csrf});
  assert.equal(sent.status,201,sent.text);assert.match(sent.data.number,/^P-/);
  assert.equal(f.app.store.all('clientProjects').filter(row=>row.id===sent.data.projectId).length,1,'쉬는 동안에도 다 쓴 의뢰는 접수된다');
  assert.equal((await f.call('/pulse/api/project')).status,200,'접수한 손님은 고객 방으로 들어간다');
});

test('접수 직후 응답을 못 받은 손님의 10분 재전송은 쉬는 동안에도 같은 의뢰로 이어진다',async t=>{
  const f=await fixture(t);
  const draft=(await f.start()).data.draft,cookie=f.jar.get('synk_pulse_request');
  const first=await f.call('/pulse/api/request/submit',{body:{answers:answers()},csrf:draft.csrf});assert.equal(first.status,201,first.text);
  assert.equal((await f.pause()).status,200);
  f.jar.clear();f.jar.set('synk_pulse_request',cookie);
  const second=await f.call('/pulse/api/request/submit',{body:{answers:answers()},csrf:draft.csrf});
  assert.equal(second.status,201,second.text);assert.equal(second.data.duplicate,true);assert.equal(second.data.number,first.data.number);assert.equal(second.data.projectId,first.data.projectId);
  assert.equal(f.app.store.all('clientProjects').length,1);
});

test('다시 여는 날이 되면(한국 시간 0시) 저절로 열리고, 직원 화면은 그 사실을 안다',async t=>{
  let at='2026-11-11T03:00:00.000Z';
  const f=await fixture(t,{clock:()=>at});
  assert.equal((await f.pause({pausedUntil:'2026-11-13',pauseNote:'잠시 쉬어요.'})).status,200);
  at='2026-11-12T14:59:59.000Z';// 한국 11-12 23:59:59
  assert.deepEqual((await f.call('/pulse/api/availability')).data,{state:'paused',until:'2026-11-13',note:'잠시 쉬어요.',noteEn:''});
  assert.equal((await f.start()).status,409);
  at='2026-11-12T15:00:00.000Z';// 한국 11-13 00:00:00
  assert.deepEqual((await f.call('/pulse/api/availability')).data,{state:'open'});
  assert.equal((await f.start()).status,201);
  const seen=await f.staff('/api/settings/pulse-capacity');
  assert.equal(seen.data.state,'open');assert.equal(seen.data.reopened,'2026-11-13');assert.equal(seen.data.pauseNote,'','지난 안내는 다시 보이지 않는다');
  assert.equal(f.audits().length,1,'저절로 열린 것은 사람이 바꾼 기록이 아니다');
  // 사람이 다시 손대면 「저절로 열림」 표시는 사라진다.
  assert.equal((await f.reopen()).data.reopened,'');
});

test('저장된 문서가 이상하면 여는 쪽으로 읽는다(문서가 깨져 접수가 닫히지 않게)',async t=>{
  const f=await fixture(t);
  for(const doc of [{open:'false'},{open:0},{open:null},{pausedUntil:'2099-01-01'},'paused',[false]]){
    f.app.store.put('pulseCapacity','main',doc);
    assert.deepEqual((await f.call('/pulse/api/availability')).data,{state:'open'},JSON.stringify(doc));
  }
  // 쉬는 중인데 딸린 값만 이상하면: 쉬는 것은 지키고 이상한 값만 버린다.
  f.app.store.put('pulseCapacity','main',{open:false,pausedUntil:'2026-13-40',pauseNote:{text:'x'},pauseNoteEn:'줄\n바꿈'});
  assert.deepEqual((await f.call('/pulse/api/availability')).data,{state:'paused',until:'',note:'',noteEn:''});
  assert.equal((await f.start()).status,409);
});

test('순수 읽기: 날짜 경계 · 한국 날짜',()=>{
  assert.equal(kstDate('2026-11-11T14:59:59.000Z'),'2026-11-11');assert.equal(kstDate('2026-11-11T15:00:00.000Z'),'2026-11-12');assert.equal(kstDate('not a date'),'');
  const paused={open:false,pausedUntil:'2026-11-13',pauseNote:'쉬어요',pauseNoteEn:''};
  assert.equal(readPulseCapacity(paused,'2026-11-12T14:59:59.000Z').open,false);
  assert.equal(readPulseCapacity(paused,'2026-11-12T15:00:00.000Z').open,true);
  assert.equal(readPulseCapacity(paused,'시계 고장').open,false,'시계를 못 읽으면 사람이 정한 대로(쉼) 둔다');
  assert.deepEqual(readPulseCapacity(null,'2026-11-11T00:00:00.000Z'),{open:true,pausedUntil:'',pauseNote:'',pauseNoteEn:''});
  assert.throws(()=>createPulseCapacity({}),TypeError);
  // 서버 시계가 깨졌을 때: 다시 여는 날을 받은 저장은 거절하고(범위를 못 잰다), 날짜 없는 쉬기 · 다시 받기는 된다.
  const docs=new Map([['users:u1',{id:'u1',active:true,role:'admin'}]]),store={get:(kind,id)=>docs.get(kind+':'+id)||null,put:(kind,id,value)=>{docs.set(kind+':'+id,value);}};
  const broken=createPulseCapacity({store,clock:()=>'시계 고장'}),user={id:'u1'};
  for(const until of ['2020-01-01','2099-01-01','2026-11-12'])assert.throws(()=>broken.configure(user,{open:false,pausedUntil:until}),error=>error.status===500&&/서버 시계/.test(error.message),until);
  assert.equal(docs.has('pulseCapacity:main'),false,'거절된 저장은 문서를 만들지 않는다');
  assert.equal(broken.configure(user,{open:false,pauseNote:'쉬어요'}).state,'paused');assert.equal(broken.configure(user,{open:true}).state,'open');
});
