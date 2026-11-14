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
  return {app,call,staff,fake,jar,connect,order,advance:minutes=>{offset+=minutes*60000;},now:()=>Date.now()+offset};
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

// 운영 조각 6-A(설계 S2 「받으실 날 고치기」): 결제를 확인한 뒤 담당자가 받으실 날을 까닭과 함께 고친다 — 손님 일지 · 알림 · 메일, 메모는 직원만.
test('운영 조각 6-A 받으실 날 고치기: 확인한 결제만 · 까닭 넷 · 같은 날 · 범위 · 손님 보기 허용 목록 · 알림 · 메일 · 환불 뒤 · 납품 뒤 · 스무 번',async t=>{
  const f=await fixture(t);await f.connect();const o=await f.order();
  const day=days=>new Date(f.now()+9*3600000+days*86400000).toISOString().slice(0,10);
  await o.act(scene());await o.act({action:'send_draft',oneLine:'운동 끝 첫 모금',note:'',kind:'script'});
  await o.customerAct({action:'approve_draft',round:1});
  await o.act({action:'payment_request',amount:290000});
  await o.act({action:'due_change',dueDate:day(30),reason:'waiting'},409);   // 결제 요청만 — 확인 전
  await o.act({action:'payment_confirm',ref:'KMONG-DUE-1'});
  const first=o.row.studio.request.payment.dueDate;assert.match(first,/^\d{4}-\d{2}-\d{2}$/);
  assert.equal(o.row.studio.request.dueChange,true,'직원 보기는 이 서버가 받으실 날 고치기를 안다고 알린다');
  assert.equal((await o.customerCall({action:'due_change',dueDate:day(30),reason:'waiting'})).status,403,'손님은 못 고친다');
  await o.act({action:'due_change',dueDate:day(30)},400);                      // 까닭 없음
  await o.act({action:'due_change',dueDate:day(30),reason:'late'},400);        // 모르는 까닭
  await o.act({action:'due_change',dueDate:first,reason:'waiting'},400);       // 같은 날
  await o.act({action:'due_change',dueDate:day(-1),reason:'waiting'},400);     // 지난 날
  await o.act({action:'due_change',dueDate:day(121),reason:'waiting'},400);    // 120일 넘음
  await o.act({action:'due_change',dueDate:'2026-02-30',reason:'waiting'},400);// 없는 날
  await o.act({action:'due_change',dueDate:day(30),reason:'waiting',note:7},400);
  await o.act({action:'due_change',dueDate:day(30),reason:'scope',note:'손님 3차 수정 요청 — 내부 메모'});
  const log=o.row.studio.request.paymentLog.at(-1);
  assert.deepEqual({...log,at:'',by:''},{kind:'due_changed',at:'',by:'',from:first,dueDate:day(30),reason:'scope',note:'손님 3차 수정 요청 — 내부 메모'});
  assert.equal(o.row.studio.request.payment.dueDate,day(30));assert.ok(o.row.studio.request.payment.dueChangedAt);
  // 손님 보기: 받으실 날 · 고친 때만 더 내리고, 일지 줄은 종류 · 때 · 새 날 · 앞 날 · 까닭만. 메모 · 담당자 이름 · 주문 번호는 없다.
  const room=await o.room(),request=room.project.studio.request;
  assert.deepEqual(Object.keys(request.payment).sort(),['amount','confirmedAt','dueChangedAt','dueDate','requestedAt','status']);
  assert.equal(request.payment.dueDate,day(30));
  const line=request.paymentTrail.at(-1);
  assert.deepEqual(Object.keys(line).sort(),['at','dueDate','from','kind','reason']);assert.deepEqual([line.kind,line.dueDate,line.from,line.reason],['due_changed',day(30),first,'scope']);
  assert.equal(JSON.stringify(room).includes('내부 메모'),false,'담당자 메모는 손님에게 안 내려간다');assert.equal(JSON.stringify(room).includes('KMONG-DUE-1'),false);
  const events=()=>f.app.store.get('clientProjects',o.id).notificationEvents.filter(event=>event.audiences?.includes('customer')&&event.type==='due_changed');
  assert.equal(events().length,1,'손님 알림 하나');
  // 메일: 3분 묶음 뒤 한 통 — 새 날과 까닭 문장, 메모는 없다.
  const before=f.fake.sent.length;
  f.advance(1);await f.app.pulseMail.tick();f.advance(3);await f.app.pulseMail.tick();
  const mails=f.fake.sent.slice(before).filter(mail=>mail.subject.includes('받으실 날이 바뀌었어요'));
  assert.equal(mails.length,1,JSON.stringify(f.fake.sent.slice(before).map(mail=>mail.subject)));
  const [y,m,d]=day(30).split('-').map(Number);
  assert.match(mails[0].body,new RegExp(`받으실 날을 ${m}월 ${d}일로 다시 정했어요\\. 고칠 범위가 바뀌어 날을 다시 잡았어요\\.`));
  assert.doesNotMatch(mails[0].body,/내부 메모|KMONG/);
  // 같은 결제 이력 안에서 스무 번까지(앞에서 한 번 고쳤다 — 열아홉 번 더, 그다음은 409).
  for(let i=0;i<19;i++)await o.act({action:'due_change',dueDate:day(31+i),reason:'agreed'});
  await o.act({action:'due_change',dueDate:day(60),reason:'agreed'},409);
  // 환불(취소)한 결제는 고치지 않는다.
  await o.act({action:'payment_cancel',note:'환불'});
  await o.act({action:'due_change',dueDate:day(61),reason:'ours'},409);
});

// GPT 서버 검수 GA1: 고친 뒤 3분 묶음 안에 환불 · 다시 결제 확인을 하면, 앞 결제의 고침 사건이 새 결제의 날에 옛 까닭을 붙여 나가지 않는다.
test('운영 조각 6-A 받으실 날 고치기 · GA1: 고친 뒤 3분 안에 환불 · 다시 확인하면 받으실 날 메일은 안 나간다',async t=>{
  const f=await fixture(t);await f.connect();const o=await f.order();
  const day=days=>new Date(f.now()+9*3600000+days*86400000).toISOString().slice(0,10);
  await o.act(scene());await o.act({action:'send_draft',oneLine:'운동 끝 첫 모금',note:'',kind:'script'});
  await o.customerAct({action:'approve_draft',round:1});
  await o.act({action:'payment_confirm'});
  await o.act({action:'due_change',dueDate:day(30),reason:'ours'});
  await o.act({action:'payment_cancel',note:'환불'});await o.act({action:'payment_request',amount:290000});await o.act({action:'payment_confirm'});
  const before=f.fake.sent.length;
  f.advance(1);await f.app.pulseMail.tick();f.advance(3);await f.app.pulseMail.tick();
  assert.equal(f.fake.sent.slice(before).filter(mail=>mail.subject.includes('받으실 날이 바뀌었어요')).length,0,JSON.stringify(f.fake.sent.slice(before).map(mail=>mail.subject)));
  const line=f.app.store.all('pulseMailOutbox').find(item=>item.moment==='due_changed');
  assert.deepEqual([line?.state,line?.reason],['skipped','acted']);
});

test('운영 조각 6-A 받으실 날 고치기: 납품한 프로젝트는 409, 취소 줄 뒤에도 앞 결제 줄은 그대로',async t=>{
  const f=await fixture(t),o=await f.order();
  const day=days=>new Date(f.now()+9*3600000+days*86400000).toISOString().slice(0,10);
  await o.act(scene());await o.act({action:'send_draft',oneLine:'운동 끝 첫 모금',note:'',kind:'script'});
  await o.customerAct({action:'approve_draft',round:1});
  await o.act({action:'payment_confirm'});
  // 깨진 이력 줄(달력에 없는 날 · 꼴이 틀린 앞 날)은 손님 일지로 내리지 않고, 앞 날만 깨졌으면 앞 날 칸만 뺀다.
  const stored=f.app.store.get('clientProjects',o.id),log=stored.studio.request.paymentLog;
  f.app.store.put('clientProjects',o.id,{...stored,studio:{...stored.studio,request:{...stored.studio.request,paymentLog:[...log,{kind:'due_changed',at:new Date(f.now()).toISOString(),by:'x',dueDate:'2026-13-40',reason:'ours'},{kind:'due_changed',at:new Date(f.now()).toISOString(),by:'x',from:'2026-02-30',dueDate:day(41),reason:'ours'}]}}});
  const trail=(await o.room()).project.studio.request.paymentTrail.filter(entry=>entry.kind==='due_changed');
  assert.deepEqual(trail.map(entry=>[entry.dueDate,entry.from??null]),[[day(41),null]]);
  const row=f.app.store.get('clientProjects',o.id);f.app.store.put('clientProjects',o.id,{...row,stage:'delivered'});
  const late=await o.act({action:'due_change',dueDate:day(40),reason:'ours'},409);assert.match(JSON.stringify(late.data),/납품을 마친 프로젝트/);
});

// 운영 조각 6-B(설계 S2 「정원 · 예약」): 제작 자리 · 대기 — 설정 길(관리자 · 감사 기록), 영상 · 사진이 모두 대기까지 차면 새 의뢰서 시작만 409,
// 자리가 모자란 때 보낸 방향 제안은 날짜 없이 굳히고(seat:'queue'), 손님 · 직원 보기에 그 프로젝트의 자리 · 직원에게 종류별 자리 수.
async function confirmedOnly(f,extra={}){
  const draft=(await f.call('/pulse/api/request/start',{body:{}})).data.draft;
  const sent=await f.call('/pulse/api/request/submit',{body:{answers:{...ANSWERS,...extra}},csrf:draft.csrf});assert.equal(sent.status,201,JSON.stringify(sent.data));
  const id=sent.data.projectId,path='/api/client-projects/'+id+'/studio';
  const act=async(body,expected=200)=>{const row=(await f.staff(path)).data.project;const result=await f.staff(path,{body:{revision:row.revision,...body}});assert.equal(result.status,expected,JSON.stringify(result.data));return result;};
  await act({action:'request_confirm'});
  const upload=async name=>{const row=(await f.staff(path)).data.project;return (await f.staff(path+'/media',{raw:png,headers:{'Content-Type':'image/png','X-File-Name':name,'X-Project-Revision':String(row.revision)}})).data.project.studio.assets.at(-1).id;};
  return {id,path,act,upload,room:async()=>(await f.call('/pulse/api/project')).data,staffRow:async()=>(await f.staff(path)).data.project};
}
const directionBody=(a,b,extra={})=>({action:'propose_direction',lead:'두 방향으로 나눴어요.',options:[{name:'아니, 잠깐',sentence:'맛을 설명하려다 말을 다섯 번 바꿔요.',flow:[{at:'0:00',text:'경기가 끝나고'}],why:'대사로 풀려요.',assetId:a,recommended:true},{name:'톡',sentence:'한 모금에 톡.',flow:[{at:'0:00',text:'캔을 따고'}],why:'짧아요.',assetId:b}],modelId:'M06',price:290000,revisions:2,...extra});

test('운영 조각 6-B 제작 자리: 설정 길은 관리자 · 감사 기록, 쉬기와 자리 몫이 서로 안 지워짐, 공개 응답은 상태 · 찬 종류 · 날짜만',async t=>{
  const f=await fixture(t);
  const audits=kind=>f.app.store.all('audit').filter(row=>row.action===kind);
  let r=await f.staff('/api/settings/pulse-capacity');
  assert.deepEqual([r.data.seats,r.data.held,r.data.seatsNow.video],[{video:3,photo:5,queue:6},[],{state:'open',used:0,total:3,waiting:0}]);
  assert.equal((await f.staff('/api/settings/pulse-capacity/seats',{body:{video:1,photo:1}})).status,400);
  r=await f.staff('/api/settings/pulse-capacity/seats',{body:{video:0,photo:2,queue:4}});assert.equal(r.status,200,JSON.stringify(r.data));
  assert.deepEqual(audits('pulse-capacity-seats').at(-1).seats,{video:0,photo:2,queue:4});
  r=await f.staff('/api/settings/pulse-capacity/held',{body:{add:{kind:'photo',note:'옛 흐름 사진 건'}}});assert.equal(r.status,200);
  const heldId=r.data.held[0].id;assert.equal(audits('pulse-capacity-held').at(-1).added.note,'옛 흐름 사진 건');
  assert.equal((await f.staff('/api/settings/pulse-capacity',{body:{open:false,pauseNote:'쉬어요'}})).status,200);
  r=await f.staff('/api/settings/pulse-capacity');assert.deepEqual([r.data.state,r.data.seats.photo,r.data.held.length],['paused',2,1],'쉬기를 저장해도 자리 몫이 남는다');
  assert.equal((await f.staff('/api/settings/pulse-capacity',{body:{open:true}})).status,200);
  const pub=await f.call('/pulse/api/availability');
  assert.deepEqual(pub.data,{state:'queue',kinds:['video'],noticeDate:''},'영상 자리 0 — 받을 수는 있고(대기) 날짜를 셀 재료가 없다');
  r=await f.staff('/api/settings/pulse-capacity/held',{body:{remove:heldId}});assert.equal(r.data.held.length,0);assert.equal(audits('pulse-capacity-held').at(-1).removed.id,heldId);
});

test('운영 조각 6-B 새 의뢰서 막기: 영상 · 사진 모두 대기까지 차면 시작만 409(SYNK_PULSE_INTAKE_FULL), 쓰던 초안은 그대로 보낸다',async t=>{
  const f=await fixture(t);
  const early=(await f.call('/pulse/api/request/start',{body:{}})).data.draft;
  assert.equal((await f.staff('/api/settings/pulse-capacity/seats',{body:{video:0,photo:0,queue:0}})).status,200);
  assert.deepEqual((await f.call('/pulse/api/availability')).data,{state:'full',kinds:['video','photo'],noticeDate:''});
  const blocked=await f.call('/pulse/api/request/start',{body:{}});
  assert.equal(blocked.status,409);assert.equal(blocked.data.code,'SYNK_PULSE_INTAKE_FULL');
  const sent=await f.call('/pulse/api/request/submit',{body:{answers:ANSWERS},csrf:early.csrf});
  assert.equal(sent.status,201,'다 쓴 손님을 보내기에서 거절하지 않는다');
  assert.equal((await f.staff('/api/settings/pulse-capacity/seats',{body:{video:0,photo:1,queue:0}})).status,200);
  assert.equal((await f.call('/pulse/api/request/start',{body:{}})).status,201,'사진 자리가 하나라도 있으면 시작은 연다');
});

test('운영 조각 6-B 방향 제안: 자리가 모자라면 날짜 없이 받고 seat:queue로 굳히며, 손님 · 직원 보기에 자리 · 자리 수가 실린다 — 자리가 있으면 날짜가 꼭 든다',async t=>{
  const f=await fixture(t);
  const open=await confirmedOnly(f);
  const a=await open.upload('a.png'),b=await open.upload('b.png');
  await open.act(directionBody(a,b),400);   // 자리가 있으면 받으실 날이 꼭 든다
  let room=await open.room();
  assert.equal(Object.hasOwn(room.project,'seat'),false,'자리가 있는 손님 보기에는 자리 칸이 없다');
  assert.deepEqual((await open.staffRow()).seats.video,{state:'open',used:0,total:3,waiting:1});
  assert.equal((await f.staff('/api/settings/pulse-capacity/seats',{body:{video:0,photo:5,queue:6}})).status,200);
  room=await open.room();assert.deepEqual(room.project.seat,{state:'queue',noticeDate:''});
  const sent=await open.act(directionBody(a,b));
  const proposal=sent.data.project.studio.request.directionProposal;
  assert.deepEqual([proposal.dueDate,proposal.seat],['','queue'],'보내는 순간의 자리를 굳힌다');
  room=await open.room();assert.deepEqual([room.project.studio.request.directionProposal.dueDate,room.project.studio.request.directionProposal.seat],['','queue']);
  // 굳힌 뒤 자리가 나도 제안은 그대로(볼 때마다 따지지 않는다), 손님 보기의 자리 칸만 사라진다.
  assert.equal((await f.staff('/api/settings/pulse-capacity/seats',{body:{video:3,photo:5,queue:6}})).status,200);
  room=await open.room();
  assert.equal(room.project.studio.request.directionProposal.seat,'queue');assert.equal(Object.hasOwn(room.project,'seat'),false);
  // 자리가 모자라도 담당자가 날짜를 적으면 그 날로 약속한다(굳힘 없음).
  assert.equal((await f.staff('/api/settings/pulse-capacity/seats',{body:{video:0,photo:5,queue:6}})).status,200);
  const other=await confirmedOnly(f,{name:'다른 탄산수'});
  const c=await other.upload('c.png'),d=await other.upload('d.png');
  const day=new Date(f.now()+9*3600000+20*86400000).toISOString().slice(0,10);
  const dated=(await other.act(directionBody(c,d,{dueDate:day}))).data.project.studio.request.directionProposal;
  assert.deepEqual([dated.dueDate,Object.hasOwn(dated,'seat')],[day,false]);
});

test('운영 조각 6-B 방향 제안(화면 검수 Fable F1): 기간이 정해지지 않은 구성(기업 · 추천)은 자리 대기여도 받으실 날이 꼭 든다 — 비운 날로 굳히지 않는다',async t=>{
  const f=await fixture(t);
  assert.equal((await f.staff('/api/settings/pulse-capacity/seats',{body:{video:0,photo:5,queue:6}})).status,200);
  for(const pkg of ['corp','ask']){
    const one=await confirmedOnly(f,{name:'기업 건 '+pkg,package:pkg});
    assert.deepEqual((await one.room()).project.seat,{state:'queue',noticeDate:''},pkg+' 자리 대기');
    const a=await one.upload('a.png'),b=await one.upload('b.png');
    await one.act(directionBody(a,b),400);
    const day=new Date(f.now()+9*3600000+20*86400000).toISOString().slice(0,10);
    const sent=(await one.act(directionBody(a,b,{dueDate:day}))).data.project.studio.request.directionProposal;
    assert.deepEqual([sent.dueDate,Object.hasOwn(sent,'seat')],[day,false],pkg);
  }
});

test('운영 조각 6-B 결제 요청(서버 검수 GA1): 자리 차례를 기다리는 건은 자리 경고를 본 확인(overSeat:true)이 있어야 받는다 — 막지는 않고(설계 S2 담당자 판단), 자리가 있으면 확인 없이 그대로',async t=>{
  const f=await fixture(t);
  assert.equal((await f.staff('/api/settings/pulse-capacity/seats',{body:{video:0,photo:5,queue:6}})).status,200);
  const waiting=await confirmedOnly(f);
  assert.deepEqual((await waiting.room()).project.seat,{state:'queue',noticeDate:''});
  const refused=await waiting.act({action:'payment_request',amount:290000},409);
  assert.match(refused.data.error,/아직 제작 자리 차례가 아니에요/);assert.equal(refused.data.code,'SYNK_PULSE_SEAT_WAIT','화면이 판 번호 충돌과 가르는 코드');
  assert.equal((await waiting.staffRow()).studio.request.payment,undefined,'거절하면 결제 칸이 생기지 않는다');
  await waiting.act({action:'payment_request',amount:290000,overSeat:'1'},400);
  await waiting.act({action:'payment_request',amount:290000,overSeat:false},400);
  const sent=await waiting.act({action:'payment_request',amount:290000,overSeat:true});
  assert.equal(sent.data.project.studio.request.payment.status,'requested','담당자가 경고를 보고 보내면 받는다');
  // 자리가 있으면 확인 없이 받는다(앞 판 그대로).
  assert.equal((await f.staff('/api/settings/pulse-capacity/seats',{body:{video:3,photo:5,queue:6}})).status,200);
  const free=await confirmedOnly(f,{name:'다른 탄산수'});
  assert.equal(Object.hasOwn((await free.room()).project,'seat'),false);
  assert.equal((await free.act({action:'payment_request',amount:290000})).data.project.studio.request.payment.status,'requested');
});

// 운영 조각 6-C(설계 S2 「정원 · 예약」 알림 명단): 대기까지 찬 동안 「열리면 메일로 알려 드릴까요?」 — 실제 회사 서버 길.
test('운영 조각 6-C 알림 명단: 메일이 켜진 full에만 notify · 같은 출처 · 늘 같은 답 · 자리가 나면 남긴 차례로 한 통(손님 언어) · 열린 뒤에는 409 · 접속 주소 문턱',async t=>{
  const f=await fixture(t);
  assert.equal((await f.staff('/api/settings/pulse-capacity/seats',{body:{video:0,photo:0,queue:0}})).status,200);
  let view=(await f.call('/pulse/api/availability')).data;
  assert.equal(view.state,'full');assert.equal(Object.hasOwn(view,'notify'),false,'메일이 꺼져 있으면 칸을 그리지 않는다');
  const off=await f.call('/pulse/api/waitlist',{body:{email:'wait@pulse-synthetic.test'}});
  assert.equal(off.status,409);assert.equal(off.data.code,'SYNK_PULSE_WAITLIST_OFF');
  await f.connect();
  view=(await f.call('/pulse/api/availability')).data;
  assert.deepEqual(Object.keys(view).sort(),['kinds','noticeDate','notify','state'],'공개 응답에 명단 크기 · 주소가 없다');assert.equal(view.notify,true);
  const base='http://127.0.0.1:'+f.app.server.address().port;
  const foreign=await fetch(base+'/pulse/api/waitlist',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:JSON.stringify({email:'x@pulse-synthetic.test'})});
  assert.equal(foreign.status,403,'다른 출처는 받지 않는다');
  assert.equal((await fetch(base+'/pulse/api/waitlist')).status,405,'POST만 받는다');
  assert.equal((await f.call('/pulse/api/waitlist',{body:{email:'x'.repeat(2100)+'@pulse-synthetic.test'}})).status,413,'몸통은 작게(문턱 앞)');
  assert.deepEqual((await f.call('/pulse/api/waitlist',{body:{email:'Wait@Pulse-Synthetic.test',locale:'en'}})).data,{ok:true});
  assert.deepEqual((await f.call('/pulse/api/waitlist',{body:{email:'wait@pulse-synthetic.test'}})).data,{ok:true},'같은 주소도 같은 답');
  assert.deepEqual((await f.call('/pulse/api/waitlist',{body:{email:'second@pulse-synthetic.test'}})).data,{ok:true});
  assert.equal((await f.call('/pulse/api/waitlist',{body:{email:'third@pulse-synthetic.test',note:'메모'}})).status,400,'손님이 적은 글은 받지 않는다');
  const rows=f.app.store.all('pulseWaitlist');
  assert.equal(rows.length,2);assert.ok(rows.every(row=>row.state==='waiting'));
  const before=f.fake.sent.length;
  assert.equal((await f.app.pulseWaitlist.tick()).sent,0,'자리가 없으면 보내지 않는다');
  // 영상 자리 하나가 난다 → 먼저 남긴 한 사람에게만, 그 사람이 고른 영어로.
  assert.equal((await f.staff('/api/settings/pulse-capacity/seats',{body:{video:1,photo:0,queue:0}})).status,200);
  assert.deepEqual(await f.app.pulseWaitlist.tick(),{sent:1,waiting:1});
  const mails=f.fake.sent.slice(before);
  assert.equal(mails.length,1);assert.equal(mails[0].to,'wait@pulse-synthetic.test');
  assert.equal(mails[0].subject,'〔SYNK PULSE〕 A production spot just opened up');assert.match(mails[0].body,/pulse-app\/\?start=request&lang=en/);
  assert.equal(f.app.store.all('pulseWaitlist').find(row=>row.state==='sent').email,undefined,'보낸 뒤 주소 원문은 지운다');
  assert.equal((await f.app.pulseWaitlist.tick()).sent,0,'같은 자리로 둘째를 부르지 않는다');
  // 쉬는 동안은 자리가 나도 부르지 않고, 명단도 받지 않는다(「바로 시작」 대신 쉬기 안내) — 다시 열면 둘째에게.
  assert.equal((await f.staff('/api/settings/pulse-capacity',{body:{open:false,pauseNote:'쉬어요'}})).status,200);
  assert.equal((await f.staff('/api/settings/pulse-capacity/seats',{body:{video:2,photo:0,queue:0}})).status,200);
  assert.equal((await f.app.pulseWaitlist.tick()).sent,0,'쉬는 동안은 부르지 않는다');
  const resting=await f.call('/pulse/api/waitlist',{body:{email:'rest@pulse-synthetic.test'}});
  assert.equal(resting.status,409);assert.equal(resting.data.code,'SYNK_PULSE_INTAKE_PAUSED');
  assert.equal((await f.staff('/api/settings/pulse-capacity',{body:{open:true}})).status,200);
  assert.deepEqual(await f.app.pulseWaitlist.tick(),{sent:1,waiting:0},'다시 열면 남은 자리만큼 둘째에게');
  assert.equal(f.fake.sent.at(-1).to,'second@pulse-synthetic.test');
  // 열린 뒤 등록은 409(화면이 다시 읽어 시작 단추를 세운다), notify도 없다.
  const late=await f.call('/pulse/api/waitlist',{body:{email:'late@pulse-synthetic.test'}});
  assert.equal(late.status,409);assert.equal(late.data.code,'SYNK_PULSE_WAITLIST_OPEN');
  assert.equal(Object.hasOwn((await f.call('/pulse/api/availability')).data,'notify'),false);
  // 접속 주소마다 한 시간 열 번(지금까지 꺼짐 409 · 확인 셋 · 400 · 쉬기 409 · 열림 409 = 일곱 — 다른 출처 403 · GET 405 · 큰 몸통 413은 문턱 앞).
  for(let i=0;i<3;i++)await f.call('/pulse/api/waitlist',{body:{email:`n${i}@pulse-synthetic.test`}});
  const over=await f.call('/pulse/api/waitlist',{body:{email:'over@pulse-synthetic.test'}});
  assert.equal(over.status,429);assert.equal(over.data.code,'SYNK_PULSE_WAITLIST_BUSY','이 칸의 문턱 글(로그인 글이 아니다)');
  // 메일 일정이 켜진 서버(운영)는 5분마다 한 바퀴 돌고, 멈출 때 타이머를 끈다(시험 서버는 일정을 끄고 tick을 바로 부른다).
  const serverSource=await readFile(new URL('./server.mjs',import.meta.url),'utf8');
  assert.ok(serverSource.includes('pulseWaitlistTimer=setInterval(()=>{void pulseWaitlist.tick().catch(()=>{});},5*60000);pulseWaitlistTimer.unref();'),'5분 타이머');
  assert.equal(serverSource.split('clearInterval(pulseWaitlistTimer)').length-1,2,'멈춤 두 길 모두 타이머를 끈다');
});

// 운영 조각 8-A(설계 S4 「운영판」): 장부 길 — 권한별 응답 · 달 고르기 · CSV, 옛 화면(금액 없이)과 새 화면(금액 · 받은 곳 · 실수령)의 결제 확인, 일정 파생.
test('운영 조각 8-A 운영판 장부: 읽을 수 있는 프로젝트만 · 합계도 그 줄의 합, 달 하나만 받음, 월 CSV(BOM · 수식 막기), 결제 확인은 옛 · 새 화면 모두, 일정은 결제의 받으실 날로 파생',async t=>{
  const f=await fixture(t);
  // 새 화면: 요청 금액으로 확인 · 받은 곳 · 실수령.
  const paid=await confirmedOnly(f,{name:'탄산수 하나'});
  await paid.act({action:'payment_request',amount:290000});
  const confirmed=(await paid.act({action:'payment_confirm',ref:'K-1',channel:'direct',net:250000})).data.project.studio.request.payment;
  assert.deepEqual([confirmed.status,confirmed.amount,confirmed.channel,confirmed.net],['confirmed',290000,'direct',250000]);
  // 옛 화면: 금액 · 받은 곳 없이 확인(요청도 없이) — 막히지 않고, 운영판은 「금액 없음」으로 센다.
  const old=await confirmedOnly(f,{name:'탄산수 둘'});
  assert.equal((await old.act({action:'payment_confirm',ref:'K-2'})).data.project.studio.request.payment.status,'confirmed');
  let r=await f.staff('/api/pulse/ledger');
  assert.equal(r.status,200,JSON.stringify(r.data));
  const month=r.data.current;assert.equal(r.data.month,month);
  assert.deepEqual([r.data.summary.revenue,r.data.summary.confirmed,r.data.summary.net,r.data.summary.noAmount],[290000,1,250000,1]);
  assert.equal(r.data.rows.length,2);
  const row=r.data.rows.find(item=>item.id===paid.id);
  assert.deepEqual([row.status,row.amount,row.channel,row.net,row.package],['confirmed',290000,'direct',250000,'15초']);
  assert.ok(!JSON.stringify(r.data).includes('paymentLog')&&!JSON.stringify(r.data).includes('K-1'),'이력 · 주문 번호 원본은 안 내린다');
  // 다른 팀 매니저: 읽을 수 있는 프로젝트가 없으면 줄도 합계도 없다.
  const other=f.app.store.createUser({name:'다른 팀',email:'other@pulse-synthetic.test',role:'manager',teamId:'other-team'});
  const otherToken=f.app.store.mint('session',other.id,{csrfToken:'other-csrf'},120),base='http://127.0.0.1:'+f.app.server.address().port;
  const asOther=await fetch(base+'/api/pulse/ledger',{headers:{Cookie:'synk_company_session='+otherToken}});
  const otherData=await asOther.json();
  assert.equal(asOther.status,200,JSON.stringify(otherData));assert.deepEqual([otherData.rows.length,otherData.summary.revenue,otherData.summary.noAmount],[0,0,0]);
  // 로그인 없이는 401, 달은 하나만 · 꼴이 맞아야.
  assert.equal((await fetch(base+'/api/pulse/ledger')).status,401);
  for(const query of ['?month=2026-13','?month=2026-11&month=2026-10','?team=a','?month=11','?month=0026-11'])assert.equal((await f.staff('/api/pulse/ledger'+query)).status,400,query);
  // 지난달을 고르면 이번 달 확인 건은 없다.
  const [y,m]=month.split('-').map(Number),last=new Date(Date.UTC(y,m-2,1)).toISOString().slice(0,7);
  r=await f.staff('/api/pulse/ledger?month='+last);assert.deepEqual([r.data.month,r.data.rows.length,r.data.summary.revenue],[last,0,0]);
  // 월 CSV.
  const csv=await fetch(base+'/api/pulse/ledger.csv?month='+month,{headers:{Cookie:'synk_company_session='+(f.app.store.mint('session',f.app.store.all('users').find(u=>u.role==='admin').id,{csrfToken:'c'},120))}});
  assert.equal(csv.status,200);assert.match(csv.headers.get('content-type'),/^text\/csv; charset=utf-8/);
  assert.match(csv.headers.get('content-disposition'),new RegExp(`attachment; filename="pulse-ledger-${month}\.csv"`));
  const text=new TextDecoder('utf-8',{ignoreBOM:true}).decode(await csv.arrayBuffer());
  assert.ok(text.startsWith('\ufeff"접수 번호"'));assert.ok(text.includes('"탄산수 하나"')||text.includes('"직접"'));
  // 일정 파생: 프로젝트 기록에 전달일을 안 썼는데 일정 카드의 합의한 전달일은 결제의 받으실 날, 계획이 꺼져 있어 경고는 없다.
  const list=(await f.staff('/api/client-projects')).data.projects,project=list.find(item=>item.id===paid.id);
  assert.equal(project.dueDate,'');assert.equal(project.schedule.agreedDueDate,confirmed.dueDate);assert.equal(project.schedule.agreedDueSource,'payment');
  assert.deepEqual([project.schedule.status,project.schedule.pendingCount],['disabled',0]);
});
