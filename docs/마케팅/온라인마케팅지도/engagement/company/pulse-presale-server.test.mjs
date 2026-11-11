import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {createCompanyApp} from './server.mjs';
import {PULSE_MAIL_SECRET} from './pulse-mail.mjs';

// 판 4(11-10 판매 전 고침, 설계 docs/마케팅/PULSE_의뢰흐름_20261104/판4_판매전_설계.md)를 실제 회사 서버 길로:
// 결제 상태와 문턱 · 손님 동의 · 결제 취소 · 사진 첫 장 · 메일 코드로 다시 열기 · 새 시안에 의견 다시 묶기(B2) · 파일 머리(B10) · 그림 형식 고침(B13).
const RELAY='https://script.google.com/macros/s/AKfycbSERVERtest0123456789ab/exec';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
const jpeg=Buffer.concat([Buffer.from([0xff,0xd8,0xff,0xe0,0x00,0x10,0x4a,0x46,0x49,0x46,0x00,0x01]),Buffer.alloc(64,1),Buffer.from([0xff,0xd9])]);
const ANSWERS={name:'오미톡 오미자 스파클링',kind:'food',channels:['shorts'],package:'s15',audience:'운동 끝나고 목마른 20대',oneThing:'한 캔에 맛이 다섯 번 바뀐다',action:'buy',screenText:'다섯 가지 맛, 톡.',avoid:[],win:'story',refs:[],models:[],modelChoice:'ask',date:'',dateFree:true,approver:'one',contactName:'김합성',company:'합성 음료',email:'buyer@pulse-synthetic.test',phone:'',consent:true,rights:true,slots:{}};
const relaySource=await readFile(new URL('./pulse-mail-relay/relay.gs',import.meta.url),'utf8');
const signed=bytes=>[...bytes].map(b=>b>127?b-256:b);

function relay(getNow){
  const props=new Map(),sent=[];let answer=null;
  const ctx={BigInt,JSON,Math,Number,String,isFinite,parseInt,Date:class extends Date{static now(){return getNow();}},
    Utilities:{DigestAlgorithm:{SHA_256:1},Charset:{UTF_8:1},base64Decode:v=>signed(Buffer.from(v,'base64')),computeDigest:(_,v)=>signed(createHash('sha256').update(v,'utf8').digest()),formatDate:d=>new Date(d.getTime()+9*3600000).toISOString().slice(0,10).replaceAll('-','')},
    PropertiesService:{getScriptProperties:()=>({getProperty:n=>props.has(n)?props.get(n):null,setProperty:(n,v)=>props.set(n,String(v)),deleteProperty:n=>props.delete(n),getProperties:()=>Object.fromEntries(props)})},
    LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},
    MailApp:{getRemainingDailyQuota:()=>100,sendEmail:m=>sent.push(JSON.parse(JSON.stringify(m)))},
    ContentService:{MimeType:{JSON:1},createTextOutput:text=>({text,setMimeType(){return this;}})}};
  vm.createContext(ctx);vm.runInContext(relaySource,ctx);
  const respond=(status,body,headers={})=>({status,headers:{get:name=>headers[name.toLowerCase()]??null},body:{cancel:async()=>{}},text:async()=>body});
  return {props,sent,fetch:async(url,init)=>{if(init.method==='POST'){answer=ctx.doPost({postData:{contents:init.body}}).text;return respond(302,'',{location:'https://script.googleusercontent.com/macros/echo?user_content_key=k'});}const body=answer;answer=null;return respond(200,body);}};
}

async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-pulse-presale-'));let offset=0;
  const clock=()=>new Date(Date.now()+offset).toISOString(),fake=relay(()=>Date.now()+offset);
  const options={dataDir:join(directory,'server'),clientIntakeDir:join(directory,'inbox'),host:'127.0.0.1',port:0,origin:'http://127.0.0.1:0',allowTestHost:true,schedule:false,workNotificationsEnabled:false,webPushEnabled:false,synkIdentityConfig:null,synkCustomerIdentityConfig:null,pulseRequestFreeBytes:async()=>100*1024**3,clock,pulseMailFetch:fake.fetch};
  const app=createCompanyApp(options),address=await app.start(),base='http://127.0.0.1:'+address.port;
  const admin=app.store.createUser({name:'관리자',email:'founder@pulse-synthetic.test',role:'admin'});
  const token=app.store.mint('session',admin.id,{csrfToken:'staff-csrf'},120);
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const jar=new Map();
  const remember=response=>{for(const line of response.headers.getSetCookie?.()||[]){const [pair,...rest]=line.split(';'),[name,value]=pair.split('=');if(value&&!/max-age=0/i.test(rest.join(';')))jar.set(name,value);else jar.delete(name);}};
  const parse=async response=>{let data=null;try{data=JSON.parse(await response.text());}catch{}return {status:response.status,data,headers:response.headers};};
  const call=async(path,{body,csrf=''}={})=>{const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{...(jar.size?{Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')}:{}),Origin:app.origin,...(csrf?{'X-Pulse-CSRF':csrf}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:JSON.stringify(body)});remember(response);return parse(response);};
  const staff=async(path,{body,raw,headers={}}={})=>parse(await fetch(base+path,{method:body===undefined&&raw===undefined?'GET':'POST',headers:{Cookie:'synk_company_session='+token,'X-CSRF-Token':'staff-csrf',Origin:app.origin,...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers},body:raw??(body===undefined?undefined:JSON.stringify(body))}));
  async function connect(){
    assert.equal((await staff('/api/settings/pulse-mail',{body:{relayUrl:RELAY}})).status,200);
    fake.props.set('SERVER_KEY_N',app.store.secret(PULSE_MAIL_SECRET).n);
    assert.equal((await staff('/api/settings/pulse-mail/ping',{body:{}})).data.connection.state,'ok');
    assert.equal((await staff('/api/settings/pulse-mail',{body:{enabled:true}})).status,200);
    offset+=60000;
  }
  // 의뢰 하나: 접수 → 확인 → 방향(모델과 함께) → 손님이 고름. 사진 상품은 방향 없이 모델을 고른 의뢰로.
  async function order(extra={}){
    const answers={...ANSWERS,...extra};
    const draft=(await call('/pulse/api/request/start',{body:{}})).data.draft;
    const sent=await call('/pulse/api/request/submit',{body:{answers},csrf:draft.csrf});assert.equal(sent.status,201,JSON.stringify(sent.data));
    const id=sent.data.projectId;let row=(await staff('/api/client-projects/'+id+'/studio')).data.project;
    // 손님 동작이 판 번호를 올리므로 직원 동작은 늘 지금 판 번호로 보낸다.
    const act=async(body,expected=200)=>{row=(await staff('/api/client-projects/'+id+'/studio')).data.project;const result=await staff('/api/client-projects/'+id+'/studio',{body:{revision:row.revision,...body}});assert.equal(result.status,expected,JSON.stringify(result.data));if(expected===200)row=result.data.project;return result;};
    const room=async()=>(await call('/pulse/api/project')).data;
    const customerCall=async body=>{const state=await room();return call('/pulse/api/studio',{body:{revision:state.project.revision,...body},csrf:state.csrf});};
    const customerAct=async body=>{const result=await customerCall(body);assert.equal(result.status,200,JSON.stringify(result.data));return result.data;};
    const upload=async(name,bytes=png,type='image/png')=>{row=(await staff('/api/client-projects/'+id+'/studio')).data.project;const result=await staff(`/api/client-projects/${id}/studio/media`,{raw:bytes,headers:{'Content-Type':type,'X-File-Name':name,'X-Project-Revision':String(row.revision)}});if(result.status===201)row=result.data.project;return result;};
    await act({action:'request_confirm'});
    if(answers.package!=='photo'){
      const a=(await upload('a.png')).data.project.studio.assets.at(-1).id,b=(await upload('b.png')).data.project.studio.assets.at(-1).id;
      const kst=new Date(Date.now()+offset+9*3600000);kst.setUTCDate(kst.getUTCDate()+10);
      const option=(assetId,name)=>({name,sentence:'맛을 설명하려다 말을 다섯 번 바꿔요.',flow:[{at:'0:00',text:'경기가 끝나고'}],why:'대사로 풀려요.',assetId,recommended:name==='아니, 잠깐'});
      await act({action:'propose_direction',lead:'두 방향으로 나눴어요.',options:[option(a,'아니, 잠깐'),option(b,'톡')],modelId:'M06',price:290000,dueDate:kst.toISOString().slice(0,10),revisions:2});
      const state=await room();
      await customerAct({action:'answer_direction',optionId:state.project.studio.request.directionProposal.options[0].id});
      row=(await staff('/api/client-projects/'+id+'/studio')).data.project;
    }
    return {id,number:sent.data.number,open:()=>call('/pulse/api/open',{body:{invite:sent.data.invite}}),get row(){return row;},set row(value){row=value;},act,room,customerCall,customerAct,upload,refresh:async()=>{row=(await staff('/api/client-projects/'+id+'/studio')).data.project;return row;}};
  }
  return {app,call,staff,fake,jar,connect,order,advance:minutes=>{offset+=minutes*60000;}};
}
const scene=(extra={})=>({action:'save_scene',title:'컷 1',description:'벤치 위 캔',narration:'',screenText:'',duration:3,visibility:'customer',...extra});

test('판 4 결제: 글 콘티 승인 뒤 결제 요청 · 확인 전에는 장면 이미지 판을 못 보내고, 제작 시작에는 손님 동의가 남고, 손님 보기에는 주문 번호가 없다',async t=>{
  const f=await fixture(t),o=await f.order();
  // 그림이 다 붙어 있어도 담당자는 글 콘티 판으로 보낼 수 있다(장면 이미지 판은 결제 뒤).
  await o.act(scene({imageUrl:'https://example.com/cut-1.png'}));
  await o.act({action:'send_draft',oneLine:'운동 끝 첫 모금',note:'',kind:'images'},400);
  await o.act({action:'send_draft',oneLine:'운동 끝 첫 모금',note:''},409);
  await o.act({action:'send_draft',oneLine:'운동 끝 첫 모금',note:'',kind:'script'});
  assert.equal(o.row.studio.request.rounds[0].kind,'script');
  await o.customerAct({action:'approve_draft',round:1});
  // 결제 동작은 직원만, 값은 원 단위 1만~1억
  assert.equal((await o.customerCall({action:'payment_confirm'})).status,403);
  await o.act({action:'payment_request',amount:5000},400);
  await o.act({action:'payment_request',amount:290000});
  let room=await o.room();
  assert.equal(room.project.studio.request.paymentFlow,true);
  assert.equal(o.row.studio.request.paymentFlow,true,'the staff view carries the payment-flow flag too (desk payment row · draft kind · relink list)');
  assert.deepEqual(Object.keys(room.project.studio.request.payment).sort(),['amount','requestedAt','status']);
  assert.equal(room.project.studio.request.payment.status,'requested');
  const customerEvents=()=>f.app.store.get('clientProjects',o.id).notificationEvents.filter(event=>event.audiences?.includes('customer')).map(event=>event.type);
  assert.ok(customerEvents().includes('payment_requested'));
  await o.act({action:'send_draft',oneLine:'운동 끝 첫 모금',note:''},409);
  await o.act({action:'payment_confirm',ref:'KMONG-TEST-1234'});
  await o.act({action:'payment_confirm'},409);
  room=await o.room();
  assert.equal(room.project.studio.request.payment.status,'confirmed');assert.equal(JSON.stringify(room).includes('KMONG-TEST-1234'),false,'크몽 주문 번호는 직원만');
  assert.match(room.project.studio.request.payment.dueDate,/^\d{4}-\d{2}-\d{2}$/);
  assert.equal(o.row.studio.request.payment.ref,'KMONG-TEST-1234');
  assert.ok(customerEvents().includes('payment_confirmed'));
  await o.act({action:'send_draft',oneLine:'운동 끝 첫 모금',note:''});
  assert.equal(o.row.studio.request.rounds.at(-1).kind,'images');
  assert.equal((await o.customerCall({action:'approve_draft',round:2})).status,400,'제작 시작에는 취소 · 환불 안내 동의가 든다');
  const started=await o.customerAct({action:'approve_draft',round:2,terms:true});
  assert.equal(started.project.stage,'producing');assert.ok(started.project.studio.request.rounds.at(-1).termsAcceptedAt);
});

test('판 4 결제 문턱: 결제 확인 전에는 시안을 올릴 수 없고, 취소를 적으면 다시 막히고, 다시 요청할 수 있다',async t=>{
  const f=await fixture(t),o=await f.order();
  await o.act(scene());await o.act({action:'send_draft',oneLine:'한 문장',note:''});
  await o.customerAct({action:'approve_draft',round:1});
  const version=async(expected)=>{await o.refresh();const result=await f.staff(`/api/client-projects/${o.id}/versions`,{body:{revision:o.row.revision,kind:'preview',label:'1차',url:'https://example.com/v1.mp4'}});assert.equal(result.status,expected,JSON.stringify(result.data));if(result.status<300)await o.refresh();return result;};
  await version(409);
  await o.act({action:'payment_cancel',note:'결제 전'},409);
  await o.act({action:'payment_confirm'});
  await o.act({action:'payment_cancel'},400);
  await o.act({action:'payment_cancel',note:'크몽 자동 취소(24시간)'});
  const room=await o.room();
  assert.deepEqual(Object.keys(room.project.studio.request.payment).sort(),['cancelledAt','confirmedAt','dueDate','status']);assert.equal(JSON.stringify(room).includes('자동 취소'),false,'취소 사유는 직원만');
  await o.act(scene({title:'컷 2',imageUrl:'https://example.com/cut-2.png'}));
  await version(409);
  await o.act({action:'payment_request',amount:290000});
  await o.act({action:'payment_confirm',dueDate:'2026-01-01'},400);
  await o.act({action:'payment_confirm'});
  await version(200);
});

test('판 4 사진 상품: 첫 장은 결제 전에 오가고, 승인은 동의와 함께 받아 두고, 제작은 결제를 확인할 때 시작한다',async t=>{
  const f=await fixture(t),o=await f.order({package:'photo',models:['M06'],modelChoice:''});
  await o.act(scene({imageUrl:'https://example.com/first.png'}));
  await o.act({action:'send_draft',oneLine:'첫 장',note:''});
  assert.equal(o.row.studio.request.rounds[0].kind,'images','사진은 첫 장이 장면 이미지 판');
  const first=await o.customerAct({action:'approve_draft',round:1,terms:true});
  assert.equal(first.project.stage,'received','결제 전에는 제작을 시작하지 않는다');assert.ok(first.project.studio.request.rounds[0].termsAcceptedAt);
  await o.refresh();
  await o.act({action:'send_draft',oneLine:'첫 장 다시',note:''},409);
  await o.act({action:'payment_confirm'});
  assert.equal(o.row.stage,'producing');assert.equal(o.row.studio.request.approvedRound,1);
});

test('판 4 메일 코드로 다시 열기: 늘 같은 답 · 맞는 주소에만 코드 · 틀리면 다섯 번 · 한 번 쓰면 끝 · 10분 · 초대 기한과 무관 · 보관하면 못 엶 · 둘이면 고르기',async t=>{
  const f=await fixture(t);
  assert.equal((await f.call('/pulse/api/mail-open')).data.available,false,'메일이 꺼져 있으면 화면이 판을 그리지 않는다');
  await f.connect();
  const o=await f.order();
  f.jar.clear();
  assert.equal((await f.call('/pulse/api/mail-open')).data.available,true);
  const codes=()=>f.fake.sent.filter(mail=>mail.subject.startsWith('〔SYNK PULSE〕 프로젝트 열기 코드'));
  const ask=async email=>{const result=await f.call('/pulse/api/mail-open',{body:{email}});await f.app.pulseMailOpen.idle();return result;};
  const verify=(code,email='buyer@pulse-synthetic.test')=>f.call('/pulse/api/mail-open/verify',{body:{email,code}});
  const off=code=>String((Number(code)+1)%1000000).padStart(6,'0');
  const unknown=await ask('nobody@pulse-synthetic.test'),known=await ask('BUYER@pulse-synthetic.test');
  assert.equal(unknown.status,200);assert.deepEqual(unknown.data,known.data,'맞든 안 맞든 같은 답');
  assert.equal(codes().length,1,'맞는 주소로만 보낸다');assert.equal(codes()[0].to,'buyer@pulse-synthetic.test');
  const code=codes()[0].subject.match(/(\d{6})$/)[1];
  assert.match(codes()[0].body,new RegExp(`\\n프로젝트를 여는 코드: ${code}\\n`));assert.doesNotMatch(codes()[0].body,/\d예요/,'숫자 끝 받침에 따라 갈리니 「예요」를 붙이지 않는다(11-10 운영 시험 주문)');
  assert.equal(JSON.stringify(f.app.store.all('pulseMailCodes')).includes(code),false,'코드 원문은 남기지 않는다');
  assert.equal(JSON.stringify(f.app.store.all('pulseMailCodes')).includes('buyer@'),false,'주소 원문도');
  assert.equal((await verify(off(code))).status,401);
  // 초대 기한이 지나도 메일로 연 세션은 산다(메일함을 증명한 손님).
  const row=f.app.store.get('clientProjects',o.id);f.app.store.put('clientProjects',o.id,{...row,inviteExpiresAt:new Date(Date.now()-60000).toISOString()});
  const opened=await verify(code);
  assert.equal(opened.status,200,JSON.stringify(opened.data));assert.equal(opened.data.project.id,o.id);assert.ok(f.jar.get('synk_pulse_session'));
  assert.equal((await f.call('/pulse/api/project')).status,200);
  assert.equal((await verify(code)).status,401,'한 번 쓰면 끝');
  // 다섯 번 틀리면 맞는 코드도 끝
  f.jar.clear();await ask('buyer@pulse-synthetic.test');
  const second=codes().at(-1).subject.match(/(\d{6})$/)[1];
  for(let i=0;i<5;i++)assert.equal((await verify(off(second))).status,401);
  assert.equal((await verify(second)).status,401);
  // 10분이 지나면 끝
  await ask('buyer@pulse-synthetic.test');
  const third=codes().at(-1).subject.match(/(\d{6})$/)[1];
  f.advance(11);assert.equal((await verify(third)).status,401);
  // 주소마다 한 시간에 세 통: 넷째 요청은 같은 답이고 보내지 않는다
  const before=codes().length;await ask('buyer@pulse-synthetic.test');assert.equal(codes().length,before);
  // 둘이면 고르기: 같은 주소로 의뢰 하나 더(한 시간 문턱이 풀린 뒤)
  f.advance(61);
  const other=await f.order({name:'오미톡 두 번째 편'});f.jar.clear();
  await ask('buyer@pulse-synthetic.test');
  const fourth=codes().at(-1).subject.match(/(\d{6})$/)[1];
  const choose=await verify(fourth);
  assert.equal(choose.status,200);assert.deepEqual(choose.data.choices.projects.map(item=>item.id).sort(),[o.id,other.id].sort());
  assert.equal(f.jar.has('synk_pulse_session'),false,'고르기 전에는 세션이 없다');
  assert.equal((await f.call('/pulse/api/mail-open/pick',{body:{ticket:choose.data.choices.ticket,projectId:'00000000-0000-4000-8000-000000000000'}})).status,401);
  const pick=await f.call('/pulse/api/mail-open/pick',{body:{ticket:choose.data.choices.ticket,projectId:other.id}});
  assert.equal(pick.status,200,JSON.stringify(pick.data));assert.equal(pick.data.project.id,other.id);assert.ok(f.jar.get('synk_pulse_session'));
  assert.equal((await f.call('/pulse/api/mail-open/pick',{body:{ticket:choose.data.choices.ticket,projectId:other.id}})).status,401,'고르기 표는 한 번');
  // 보관한 프로젝트는 열리지 않는다
  for(const id of [o.id,other.id]){const value=f.app.store.get('clientProjects',id);f.app.store.put('clientProjects',id,{...value,stage:'archived',inviteHash:null});}
  f.advance(61);const sentBefore=codes().length;
  await ask('buyer@pulse-synthetic.test');assert.equal(codes().length,sentBefore,'보관한 프로젝트 주소로는 코드를 보내지 않는다');
  // 꼴이 틀린 입력
  assert.equal((await f.call('/pulse/api/mail-open',{body:{email:'not-mail'}})).status,400);
  assert.equal((await f.call('/pulse/api/mail-open/verify',{body:{email:'buyer@pulse-synthetic.test',code:'12345'}})).status,400);
});

test('판 4 B2: 새 시안을 올리면 끝나지 않은 고객 의견이 그 시안에 묶여 승인이 바로 켜지고, 뺀 의견은 그대로 남는다',async t=>{
  const f=await fixture(t);
  const ready=async()=>{
    const o=await f.order();
    await o.act(scene({imageUrl:'https://example.com/cut-1.png'}));await o.act({action:'payment_confirm'});await o.act({action:'send_draft',oneLine:'한 문장',note:''});
    await o.customerAct({action:'approve_draft',round:1,terms:true});await o.refresh();
    const version=async(label,extra={})=>{await o.refresh();const result=await f.staff(`/api/client-projects/${o.id}/versions`,{body:{revision:o.row.revision,kind:'preview',label,url:`https://example.com/${encodeURIComponent(label)}.mp4`,...extra}});assert.equal(result.status,200,JSON.stringify(result.data));return o.refresh();};
    const customer=async body=>{const state=await o.room();return f.call('/pulse/api/action',{body:{revision:state.project.revision,...body},csrf:state.csrf});};
    return {o,version,customer};
  };
  const {o,version,customer}=await ready();
  let row=await version('1차');
  const first=row.versions.at(-1).id;
  assert.equal((await customer({action:'feedback',versionId:first,text:'0:12 캔을 더 크게',seconds:12})).status,200);
  row=await version('2차');
  const second=row.versions.at(-1).id,feedback=row.messages.find(message=>message.author==='customer'&&message.action==='feedback');
  assert.equal(feedback.workflow.status,'waiting_customer');assert.equal(feedback.workflow.resultVersionId,second);assert.equal(feedback.workflow.history.at(-1).action,'relinked');
  assert.equal((await customer({action:'approve',versionId:second})).status,200,'의견마다 따로 누르지 않아도 승인이 켜진다');
  // 담당자가 의견을 빼고 올리면 그 의견은 그대로라 승인은 기다린다.
  const b=await ready();
  let next=await b.version('1차');
  assert.equal((await b.customer({action:'feedback',versionId:next.versions.at(-1).id,text:'색이 어두워요'})).status,200);
  next=await b.version('2차',{relinkFeedback:[]});
  assert.equal(next.messages.find(message=>message.author==='customer'&&message.action==='feedback').workflow?.status||'open','open');
  assert.equal((await b.customer({action:'approve',versionId:next.versions.at(-1).id})).status,409);
});

test('판 4 B13 · B10: 이름은 .png인데 속이 JPEG인 그림은 실제 형식으로 받고, 파일 응답 머리에 직원 원본 이름이 없다',async t=>{
  const f=await fixture(t),o=await f.order();
  const result=await o.upload('S1.png',jpeg,'image/png');
  assert.equal(result.status,201,JSON.stringify(result.data));
  const asset=o.row.studio.assets.at(-1);
  assert.equal(asset.mimeType,'image/jpeg');assert.equal(asset.fileName,'S1.jpg');assert.match(f.app.store.get('clientProjects',o.id).studio.assets.at(-1).diskName,/\.jpg$/);
  const media=await f.staff(`/api/client-projects/${o.id}/studio/media/${asset.id}`);
  assert.equal(media.status,200);assert.equal(media.headers.get('content-type'),'image/jpeg');assert.equal(media.headers.get('content-disposition'),'inline');
  // 영상 서명은 고치지 않는다
  assert.equal((await o.upload('clip.mp4',png,'video/mp4')).status,415);
  assert.equal((await o.upload('fake.png',Buffer.from('not an image at all'),'image/png')).status,415);
});
test('판 4 GPT GA1 · GA2: 고르기 표는 고를 때 초대 판 · 받는 주소를 다시 보고, 검토자가 있는 프로젝트는 새 시안에 의견을 묶지 않는다',async t=>{
  const f=await fixture(t);await f.connect();
  const a=await f.order(),b=await f.order({name:'두 번째 편'});f.jar.clear();
  await f.call('/pulse/api/mail-open',{body:{email:'buyer@pulse-synthetic.test'}});await f.app.pulseMailOpen.idle();
  const code=f.fake.sent.filter(mail=>mail.subject.startsWith('〔SYNK PULSE〕 프로젝트 열기 코드')).at(-1).subject.match(/(\d{6})$/)[1];
  const choose=await f.call('/pulse/api/mail-open/verify',{body:{email:'buyer@pulse-synthetic.test',code}});
  assert.equal(choose.status,200);assert.ok(choose.data.choices);
  // 고르기 전에 담당자가 b의 초대를 새로 냈다 → 그 표로는 b가 열리지 않는다
  const row=f.app.store.get('clientProjects',b.id);f.app.store.put('clientProjects',b.id,{...row,inviteRevision:row.inviteRevision+1});
  assert.equal((await f.call('/pulse/api/mail-open/pick',{body:{ticket:choose.data.choices.ticket,projectId:b.id}})).status,401);
  // 검토자가 있는 프로젝트: 새 시안에 의견을 자동으로 묶지 않는다(지금처럼 담당자가 검토 요청)
  assert.equal((await a.open()).status,200);
  const reviewer=f.app.store.createUser({name:'검토',email:'reviewer@pulse-synthetic.test',role:'admin'});
  await a.act(scene({imageUrl:'https://example.com/cut-1.png'}));await a.act({action:'payment_confirm'});await a.act({action:'send_draft',oneLine:'한 문장',note:''});
  await a.customerAct({action:'approve_draft',round:1,terms:true});
  const live=f.app.store.get('clientProjects',a.id);f.app.store.put('clientProjects',a.id,{...live,reviewerId:reviewer.id});
  const version=async label=>{const current=await a.refresh();const result=await f.staff(`/api/client-projects/${a.id}/versions`,{body:{revision:current.revision,kind:'preview',label,url:`https://example.com/${label}.mp4`}});assert.equal(result.status,200,JSON.stringify(result.data));return a.refresh();};
  let current=await version('v1');
  const state=await a.room();
  assert.equal((await f.call('/pulse/api/action',{body:{revision:state.project.revision,action:'feedback',versionId:current.versions.at(-1).id,text:'더 밝게'},csrf:state.csrf})).status,200);
  current=await version('v2');
  assert.equal(current.messages.find(message=>message.author==='customer'&&message.action==='feedback').workflow?.status||'open','open');
});

// 2026-11-11 운영 설계 조각 1(S4 결제 원장): 결제 칸은 지금 상태 하나라 취소 뒤 다시 요청하면 앞 기록이 지워졌다 — 이력은 덮지 않고 쌓고, 손님에게는 내려가지 않는다.
test('결제 이력: 요청 → 취소 → 다시 요청 → 확인이 덮이지 않고 쌓이고, 손님 응답에는 paymentLog가 없다',async t=>{
  const f=await fixture(t),o=await f.order();
  await o.act(scene());await o.act({action:'send_draft',oneLine:'운동 끝 첫 모금',note:'',kind:'script'});await o.customerAct({action:'approve_draft',round:1});
  await o.act({action:'payment_request',amount:290000});
  await o.act({action:'payment_cancel',note:'크몽 요청이 24시간 지나 닫힘 SECRET-CANCEL-NOTE'});
  await o.act({action:'payment_request',amount:300000});
  // 확인 때 담당자가 실제 결제액 · 받은 곳 · 실수령을 적는다(없으면 요청한 값 · 크몽).
  await o.act({action:'payment_confirm',ref:'KM-SECRET-REF',amount:1},400);
  await o.act({action:'payment_confirm',ref:'KM-SECRET-REF',channel:'paypal'},400);
  await o.act({action:'payment_confirm',ref:'KM-SECRET-REF',net:300001},400);
  await o.act({action:'payment_confirm',ref:'KM-SECRET-REF',net:240000});
  const staffRequest=o.row.studio.request,log=staffRequest.paymentLog;
  assert.equal(staffRequest.paymentLedger,true,'직원 화면은 이 표시가 있을 때만 새 칸을 보낸다');
  assert.deepEqual(log.map(entry=>[entry.kind,entry.amount,entry.was||'']),[['requested',290000,''],['cancelled',290000,'requested'],['requested',300000,''],['confirmed',300000,'']]);
  assert.match(log[1].note,/SECRET-CANCEL-NOTE/);assert.equal(log[3].ref,'KM-SECRET-REF');assert.equal(log[3].channel,'kmong');assert.equal(log[3].net,240000);
  assert.ok(log.every(entry=>entry.by==='관리자'&&!Number.isNaN(Date.parse(entry.at))));
  assert.equal(staffRequest.payment.status,'confirmed');assert.equal(staffRequest.payment.amount,300000);assert.equal(staffRequest.payment.net,240000);
  // 손님: 결제 칸은 상태 · 때 · 값 · 받으실 날뿐이고, 이력 · 주문 번호 · 취소 까닭 · 실수령 · 담당자 이름은 어디에도 없다.
  const room=await o.room(),text=JSON.stringify(room);
  assert.equal(room.project.studio.request.paymentLog,undefined);
  const leak=text.match(/paymentLog|paymentLedger|KM-SECRET-REF|SECRET-CANCEL-NOTE|"net"|"channel"|requestedBy|cancelledBy/);   // confirmedBy는 의뢰서 확인(request.confirmedBy)에도 있어 결제 칸의 열쇠 목록으로 본다(아래)
  assert.equal(leak,null,leak?text.slice(Math.max(0,leak.index-120),leak.index+120):"");
  assert.deepEqual(Object.keys(room.project.studio.request.payment).sort(),['amount','confirmedAt','dueDate','requestedAt','status']);
  // 환불: 확인한 결제를 취소하면 was가 confirmed로 남는다(운영판이 환불로 센다).
  await o.act({action:'payment_cancel',note:'전액 환불'});
  const after=(await o.refresh()).studio.request.paymentLog;
  assert.equal(after.length,5);assert.equal(after.at(-1).was,'confirmed');assert.equal(after.at(-1).amount,300000);
});

test('결제 이력: 이력 없이 결제가 적힌 옛 프로젝트는 그때의 결제 칸에서 한 번 만들어 잇는다',async t=>{
  const f=await fixture(t),o=await f.order();
  await o.act(scene());await o.act({action:'send_draft',oneLine:'운동 끝 첫 모금',note:'',kind:'script'});await o.customerAct({action:'approve_draft',round:1});
  await o.act({action:'payment_request',amount:290000});
  // 옛 서버가 쓴 꼴로 되돌린다: paymentLog 없음.
  const stored=f.app.store.get('clientProjects',o.id),{paymentLog,...request}=stored.studio.request;
  f.app.store.put('clientProjects',o.id,{...stored,studio:{...stored.studio,request}});
  assert.deepEqual((await o.refresh()).studio.request.paymentLog.map(entry=>[entry.kind,entry.amount,entry.seeded]),[['requested',290000,true]],'직원 보기는 저장 전에도 지금 결제 칸에서 읽어 보인다');
  await o.act({action:'payment_confirm'});
  assert.deepEqual(o.row.studio.request.paymentLog.map(entry=>[entry.kind,entry.amount,!!entry.seeded]),[['requested',290000,true],['confirmed',290000,false]]);
  assert.equal(JSON.stringify(await o.room()).includes('paymentLog'),false);
});

// GPT GA1 · 결제 이력 상한: 가득 찼다고 취소(환불)까지 막으면 환불한 결제가 「확인함」으로 남아 제작 문턱이 열린 채가 된다.
test('결제 이력이 가득 차도 열린 결제의 확인 · 취소(환불)는 적힌다 — 새 결제를 여는 줄만 막는다',async t=>{
  const f=await fixture(t),o=await f.order();
  await o.act(scene());await o.act({action:'send_draft',oneLine:'운동 끝 첫 모금',note:'',kind:'script'});await o.customerAct({action:'approve_draft',round:1});
  await o.act({action:'payment_request',amount:290000});
  // 이력을 상한(100)까지 채운다 — 지금 열린 요청 한 줄이 맨 끝.
  const stored=f.app.store.get('clientProjects',o.id),log=stored.studio.request.paymentLog;
  const filler=Array.from({length:100-log.length},(_,index)=>({kind:index%2?'cancelled':'requested',at:'2026-11-01T00:00:00.000Z',by:'관리자',amount:290000,...(index%2?{was:'requested',note:'채움'}:{})}));
  f.app.store.put('clientProjects',o.id,{...stored,studio:{...stored.studio,request:{...stored.studio.request,paymentLog:[...filler,...log]}}});
  assert.equal((await o.refresh()).studio.request.paymentLog.length,100);
  await o.act({action:'payment_confirm'});                       // 요청한 결제의 확인
  await o.act({action:'payment_cancel',note:'전액 환불'});        // 환불
  const after=(await o.refresh()).studio.request;
  assert.equal(after.payment.status,'cancelled','환불이 적혀야 제작 문턱이 닫힌다');
  assert.equal(after.paymentLog.length,102);assert.deepEqual(after.paymentLog.slice(-2).map(entry=>[entry.kind,entry.was||'']),[['confirmed',''],['cancelled','confirmed']]);
  await o.act({action:'payment_request',amount:290000},409);     // 새 결제를 여는 줄만 막는다
  await o.act({action:'payment_confirm'},409);                   // 요청 없이 바로 하는 확인도 새 결제를 여는 줄이다
  assert.equal((await o.refresh()).studio.request.paymentLog.length,102);
});

// 2026-11-11 운영 조각 2-A(설계 S1 「함께 메우는 빈칸」 ①): 손님 일지의 결제 줄은 서버가 이력에서 만든 paymentTrail로 그린다 —
// 다시 요청해도 앞 줄이 남고, 허용 목록(종류 · 때 · 값 · 받으실 날)이라 담당자 이름 · 주문 번호 · 취소 까닭 · 받은 곳 · 실수령은 내려가지 않는다.
test('결제 줄: 손님 보기 paymentTrail은 요청 → 취소 → 다시 요청 → 확인 → 환불이 모두 남고, 종류 · 때 · 값 · 받으실 날만 담는다',async t=>{
  const f=await fixture(t),o=await f.order();
  assert.equal(Object.hasOwn((await o.room()).project.studio.request,'paymentTrail'),false,'결제가 한 번도 없으면 칸이 없다');
  await o.act(scene());await o.act({action:'send_draft',oneLine:'운동 끝 첫 모금',note:'',kind:'script'});await o.customerAct({action:'approve_draft',round:1});
  await o.act({action:'payment_request',amount:290000});
  await o.act({action:'payment_cancel',note:'크몽 요청이 24시간 지나 닫힘 SECRET-CANCEL-NOTE'});
  await o.act({action:'payment_request',amount:300000});
  await o.act({action:'payment_confirm',ref:'KM-SECRET-REF',channel:'direct',net:240000});
  const log=o.row.studio.request.paymentLog;
  let trail=(await o.room()).project.studio.request.paymentTrail;
  assert.deepEqual(trail.map(entry=>[entry.kind,entry.amount]),[['requested',290000],['cancelled',290000],['requested',300000],['confirmed',300000]]);
  assert.deepEqual(trail.map(entry=>entry.at),log.map(entry=>entry.at),'때는 이력 그대로');
  assert.equal(trail[3].dueDate,o.row.studio.request.payment.dueDate);assert.match(trail[3].dueDate,/^\d{4}-\d{2}-\d{2}$/);
  assert.ok(trail.slice(0,3).every(entry=>!Object.hasOwn(entry,'dueDate')),'받으실 날은 확인 줄에만');
  for(const entry of trail)assert.deepEqual(Object.keys(entry).filter(key=>!['kind','at','amount','dueDate'].includes(key)),[],JSON.stringify(entry));
  assert.doesNotMatch(JSON.stringify(trail),/KM-SECRET-REF|SECRET-CANCEL-NOTE|관리자|240000|direct|kmong|seeded/);
  // 환불(확인한 결제의 취소)도 한 줄 더 — 까닭 · 무엇을 취소했는지(was)는 내려가지 않는다.
  await o.act({action:'payment_cancel',note:'전액 환불 SECRET-REFUND-NOTE'});
  trail=(await o.room()).project.studio.request.paymentTrail;
  assert.equal(trail.length,5);assert.deepEqual([trail[4].kind,trail[4].amount],['cancelled',300000]);
  assert.doesNotMatch(JSON.stringify(trail),/SECRET-REFUND-NOTE|"was"|"by"|"note"|"ref"|"net"|"channel"/);
  // 손님 결제 칸(지금 상태)은 전과 같은 열쇠뿐이다.
  assert.deepEqual(Object.keys((await o.room()).project.studio.request.payment).sort(),['amount','cancelledAt','confirmedAt','dueDate','requestedAt','status']);
});

test('결제 줄: 이력 없이 결제가 적힌 옛 프로젝트도 그 결제 칸에서 만든 줄이 같은 꼴로 내려가고, 직원 보기에는 paymentTrail이 없다',async t=>{
  const f=await fixture(t),o=await f.order();
  await o.act(scene());await o.act({action:'send_draft',oneLine:'운동 끝 첫 모금',note:'',kind:'script'});await o.customerAct({action:'approve_draft',round:1});
  await o.act({action:'payment_request',amount:290000});
  const stored=f.app.store.get('clientProjects',o.id),{paymentLog,...request}=stored.studio.request;
  f.app.store.put('clientProjects',o.id,{...stored,studio:{...stored.studio,request}});
  const trail=(await o.room()).project.studio.request.paymentTrail;
  assert.deepEqual(trail,[{kind:'requested',at:request.payment.requestedAt,amount:290000}],'seeded 표시 · 담당자 이름 없이');
  assert.equal(Object.hasOwn((await o.refresh()).studio.request,'paymentTrail'),false,'직원은 paymentLog 전체를 본다');
});

// 카본 끝판 검수 A2: 깨진 이력(옛 데이터 · 손으로 고친 문서)에서도 허용 목록만 — 모르는 종류 · 때 없는 줄 · 범위 밖 값은 빼고, 다 빠지면 칸이 없다.
test('결제 줄: 깨진 이력은 줄마다 걸러 내리고(종류 · 때 · 값 · 확인 줄의 받으실 날만), 다 걸러지면 paymentTrail이 없다',async t=>{
  const f=await fixture(t),o=await f.order();
  await o.act(scene());await o.act({action:'send_draft',oneLine:'운동 끝 첫 모금',note:'',kind:'script'});await o.customerAct({action:'approve_draft',round:1});
  await o.act({action:'payment_request',amount:290000});
  const at=new Date().toISOString(),put=log=>{const stored=f.app.store.get('clientProjects',o.id);f.app.store.put('clientProjects',o.id,{...stored,studio:{...stored.studio,request:{...stored.studio.request,paymentLog:log}}});};
  put([null,'x',{kind:'refunded',at},{kind:'requested',at:''},{kind:'requested',at:'  '},{kind:'requested'},{kind:'requested',at:'어제'},
    {kind:'requested',at,amount:5,by:'SECRET-BY'},{kind:'cancelled',at,amount:290000,dueDate:'2026-12-01',note:'SECRET-NOTE',was:'requested'},{kind:'confirmed',at,amount:'290000',dueDate:'',ref:'SECRET-REF'}]);
  const trail=(await o.room()).project.studio.request.paymentTrail;
  assert.deepEqual(trail,[{kind:'requested',at},{kind:'cancelled',at,amount:290000},{kind:'confirmed',at}],'범위 밖 값 · 글자 값 · 빈 받으실 날 · 취소 줄의 받으실 날은 빼고, 담당자 이름 · 까닭 · 주문 번호도 없다');
  put([null,{kind:'refunded',at},{kind:'requested',at:''}]);
  assert.equal(Object.hasOwn((await o.room()).project.studio.request,'paymentTrail'),false);
});
