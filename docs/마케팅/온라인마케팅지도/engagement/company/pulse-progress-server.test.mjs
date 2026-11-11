import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {createCompanyApp} from './server.mjs';
import {PULSE_MAIL_SECRET,PULSE_MAIL_MOMENTS} from './pulse-mail.mjs';
import {workspaceMediaNames} from './workspace-media.mjs';

// 운영 조각 4 작업 소식(2026-11-11 설계 S1 「시험」)을 실제 회사 서버 길로:
// 손님이 초안 · 거둔 소식 · 그 그림을 못 받음, 상한(글 600 · 그림 넷 · 소식 그림 40장 · 소식 30개), 거둔 소식의 알림이 사라짐,
// 다른 참조가 있는 그림은 거둬도 안 지워짐, 90일 정리 뒤 남지 않음(일반 보관에서는 남음), 소식 그림의 백업 목록 대조, 메일 함에 들지 않음(서버를 되돌려도 함이 깨끗).
const RELAY='https://script.google.com/macros/s/AKfycbSERVERtest0123456789ab/exec';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
const mp4=Buffer.concat([Buffer.from([0,0,0,0x18]),Buffer.from('ftypmp42'),Buffer.alloc(12)]);
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
  const directory=await mkdtemp(join(tmpdir(),'synk-pulse-progress-'));let offset=0;
  const clock=()=>new Date(Date.now()+offset).toISOString(),fake=relay(()=>Date.now()+offset);
  const options={dataDir:join(directory,'server'),clientIntakeDir:join(directory,'inbox'),host:'127.0.0.1',port:0,origin:'http://127.0.0.1:0',allowTestHost:true,schedule:false,workNotificationsEnabled:false,webPushEnabled:false,synkIdentityConfig:null,synkCustomerIdentityConfig:null,pulseRequestFreeBytes:async()=>100*1024**3,clock,pulseMailFetch:fake.fetch};
  const app=createCompanyApp(options),address=await app.start(),base='http://127.0.0.1:'+address.port;
  const admin=app.store.createUser({name:'관리자 비공개이름',email:'founder@pulse-synthetic.test',role:'admin'});
  const token=app.store.mint('session',admin.id,{csrfToken:'staff-csrf'},120);
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const jar=new Map();
  const remember=response=>{for(const line of response.headers.getSetCookie?.()||[]){const [pair,...rest]=line.split(';'),[name,value]=pair.split('=');if(value&&!/max-age=0/i.test(rest.join(';')))jar.set(name,value);else jar.delete(name);}};
  const parse=async response=>{const raw=await response.text();let data=null;try{data=JSON.parse(raw);}catch{}return {status:response.status,data,raw,headers:response.headers};};
  const call=async(path,{body,csrf=''}={})=>{const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{...(jar.size?{Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')}:{}),Origin:app.origin,...(csrf?{'X-Pulse-CSRF':csrf}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:JSON.stringify(body)});remember(response);return parse(response);};
  const staff=async(path,{body,raw,headers={}}={})=>parse(await fetch(base+path,{method:body===undefined&&raw===undefined?'GET':'POST',headers:{Cookie:'synk_company_session='+token,'X-CSRF-Token':'staff-csrf',Origin:app.origin,...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers},body:raw??(body===undefined?undefined:JSON.stringify(body))}));
  async function connect(){
    assert.equal((await staff('/api/settings/pulse-mail',{body:{relayUrl:RELAY}})).status,200);
    fake.props.set('SERVER_KEY_N',app.store.secret(PULSE_MAIL_SECRET).n);
    assert.equal((await staff('/api/settings/pulse-mail/ping',{body:{}})).data.connection.state,'ok');
    assert.equal((await staff('/api/settings/pulse-mail',{body:{enabled:true}})).status,200);
    offset+=60000;
  }
  // 의뢰 하나: 접수(→ 확인). confirm:false면 접수만 한 채로 둔다(90일 정리 시험).
  async function order(extra={},{confirm=true}={}){
    jar.clear();
    const answers={...ANSWERS,...extra};
    const draft=(await call('/pulse/api/request/start',{body:{}})).data.draft;
    const sent=await call('/pulse/api/request/submit',{body:{answers},csrf:draft.csrf});assert.equal(sent.status,201,JSON.stringify(sent.data));
    const id=sent.data.projectId;let row=(await staff('/api/client-projects/'+id+'/studio')).data.project;
    const refresh=async()=>{row=(await staff('/api/client-projects/'+id+'/studio')).data.project;return row;};
    const act=async(body,expected=200)=>{await refresh();const result=await staff('/api/client-projects/'+id+'/studio',{body:{revision:row.revision,...body}});assert.equal(result.status,expected,JSON.stringify(result.data));if(expected===200)row=result.data.project;return result;};
    const room=async()=>(await call('/pulse/api/project')).data;
    const customerCall=async body=>{const state=await room();return call('/pulse/api/studio',{body:{revision:state.project.revision,...body},csrf:state.csrf});};
    // 그림 올리기. purpose가 있으면 x-studio-purpose로 소식 전용 표시.
    const upload=async(name,{bytes=png,type='image/png',purpose='progress'}={})=>{await refresh();return staff(`/api/client-projects/${id}/studio/media`,{raw:bytes,headers:{'Content-Type':type,'X-File-Name':encodeURIComponent(name),'X-Project-Revision':String(row.revision),...(purpose!==null?{'X-Studio-Purpose':purpose}:{})}});};
    const image=async(name,options={})=>{const result=await upload(name,options);assert.equal(result.status,201,JSON.stringify(result.data));row=result.data.project;return result.data.asset.id;};
    if(confirm)await act({action:'request_confirm'});
    const save=async(body,expected=200)=>act({action:'progress_save',...body},expected);
    const post=async(progressId,expected=200)=>act({action:'progress_post',id:progressId},expected);
    const withdraw=async(progressId,expected=200)=>act({action:'progress_withdraw',id:progressId},expected);
    return {id,invite:sent.data.invite,get row(){return row;},act,room,customerCall,upload,image,save,post,withdraw,refresh,
      progress:()=>row.studio.request.progress,asset:assetId=>row.studio.assets.find(asset=>asset.id===assetId),
      // 저장된 파일 이름(직원 보기에도 내리지 않는다 — 기록에서 읽는다).
      disk:assetId=>app.store.get('clientProjects',id).studio.assets.find(asset=>asset.id===assetId)?.diskName,
      media:assetId=>call('/pulse/api/studio/media/'+assetId),live:async()=>(await call('/pulse/api/live')).data};
  }
  const mediaPath=name=>join(options.dataDir,'studio-media',name);
  const exists=async name=>!!(await stat(mediaPath(name)).catch(()=>null));
  // 백업이 멈추지 않는 조건: 기록이 가리키는 파일은 모두 디스크에 있다(backup.mjs가 목록의 파일을 하나라도 못 읽으면 멈춘다).
  const backupConsistent=async()=>{const names=workspaceMediaNames(app.store.db);for(const name of names)assert.ok(await exists(name),'백업 목록의 파일이 디스크에 있다: '+name);return names;};
  return {app,call,staff,fake,connect,order,mediaPath,exists,backupConsistent,advance:ms=>{offset+=ms;}};
}

test('작업 소식 · 손님은 초안 · 거둔 소식 · 그 그림을 못 받고, 올린 소식만 허용 목록으로 받는다 — 거두면 알림 · 그림 · 파일까지 빠진다',async t=>{
  const f=await fixture(t),o=await f.order();
  assert.equal(o.row.studio.request.progressFeed,true,'직원 보기의 서버 능력 표시');
  assert.deepEqual(o.row.studio.request.progress,[],'처음에는 빈 목록');
  const p1=await o.image('비공개-작업화면-파일이름.png');
  assert.equal(o.asset(p1).purpose,'progress','직원 보기에는 소식 전용 표시가 실린다');
  await o.save({text:'이미지 콘티를 만들고 있어요. SECRET-DRAFT-TEXT',stage:'draft',assets:[p1]});
  const [draft]=o.progress();
  assert.equal(draft.state,'draft');assert.equal(draft.by,'관리자 비공개이름');assert.deepEqual(draft.assets,[p1]);
  // 초안: 손님 응답 어디에도 없다.
  let room=await o.room();
  assert.equal(room.project.studio.request.progress,undefined,'초안만 있으면 칸이 없다');
  assert.ok(!room.project.studio.assets.some(asset=>asset.id===p1),'초안 그림은 손님 자산 목록에 없다');
  const raw=(await f.call('/pulse/api/project')).raw;
  assert.doesNotMatch(raw,/SECRET-DRAFT-TEXT|비공개-작업화면/);
  assert.equal((await o.media(p1)).status,404,'초안 그림 주소는 손님에게 404');
  // 손님은 소식 동작을 못 한다.
  assert.equal((await o.customerCall({action:'progress_save',text:'손님이 쓴 소식'})).status,403);
  assert.equal((await o.customerCall({action:'progress_post',id:draft.id})).status,403);
  // 올리기: 허용 목록 그대로.
  await o.post(draft.id);
  assert.equal(o.progress()[0].state,'posted');assert.ok(o.progress()[0].postedAt);
  room=await o.room();
  const shown=room.project.studio.request.progress;
  assert.equal(shown.length,1);
  assert.deepEqual(Object.keys(shown[0]).sort(),['assets','at','id','stage','text']);
  assert.deepEqual(shown[0],{id:draft.id,at:o.progress()[0].postedAt,stage:'draft',text:'이미지 콘티를 만들고 있어요. SECRET-DRAFT-TEXT',assets:[p1]});
  const media=room.project.studio.assets.find(asset=>asset.id===p1);
  assert.ok(media,'올린 소식의 그림은 손님 자산 목록에 있다');
  assert.equal(media.fileName,'progress.png','직원이 올린 파일 이름은 내리지 않는다');assert.equal(media.purpose,undefined);
  assert.doesNotMatch((await f.call('/pulse/api/project')).raw,/비공개-작업화면/,'직원이 올린 파일 이름이 손님 응답에 없다(담당자 이름은 머리 칸으로 원래 보인다 — 소식 줄에는 by가 없다)');
  assert.equal((await o.media(p1)).status,200);
  // 서버를 이 판 전으로 되돌려도(GPT 서버 검수 GA2): 앞 판 손님 보기는 request를 notes · contact · paymentLog만 빼고 통째로 내린다 —
  // 저장된 request에는 소식이 없어야 한다(소식은 studio.progress). 앞 판 투영을 그대로 흉내 내 초안 · 담당자 이름이 없는지 본다.
  await o.save({text:'되돌림 시험 SECRET-ROLLBACK-DRAFT'});
  const stored=f.app.store.get('clientProjects',o.id).studio;
  assert.equal(stored.request.progress,undefined,'소식은 request 밖에 둔다');assert.equal(stored.progress.length,2);
  const {notes,contact,paymentLog,...oldView}=stored.request;
  assert.doesNotMatch(JSON.stringify(oldView),/SECRET-ROLLBACK-DRAFT|SECRET-DRAFT-TEXT|progress/,'초안 · 소식 칸이 없다(확인자 이름 confirmedBy는 원래 손님 보기에 있는 칸)');
  await o.withdraw(o.progress().at(-1).id);
  // 소식 전용이 아닌 직원 그림을 소식에 붙여 올려도 손님에게 파일 이름을 내리지 않는다(GPT 서버 검수 GA1). 손님 그림은 그대로.
  const plain=(await o.upload('비공개-일반그림.png',{purpose:null})).data.asset.id;
  await o.save({text:'일반 그림 소식',assets:[plain]});const plainNews=o.progress().at(-1).id;await o.post(plainNews);
  const plainShown=(await o.room()).project.studio.assets.find(asset=>asset.id===plain);
  assert.equal(plainShown.fileName,'progress.png');assert.doesNotMatch((await f.call('/pulse/api/project')).raw,/비공개-일반그림/);
  await o.withdraw(plainNews);
  // 알림: 앱 안에 하나, 소식 id를 단다.
  let live=await o.live();
  const note=live.notifications.find(item=>item.type==='progress_posted');
  assert.ok(note,'올리면 손님 알림');assert.equal(note.progressId,draft.id);assert.equal(note.title,'작업 중인 화면이 올라왔어요');
  assert.match(note.body,/완성본이 아니라 작업 중인 화면이에요/);
  assert.equal(live.notifications.filter(item=>item.type==='progress_posted').length,1,'거둔 일반 그림 소식의 알림은 빠지고 첫 소식 알림 하나');
  // 올린 소식은 고칠 수 없고, 다시 올릴 수도 없다.
  await o.save({id:draft.id,text:'고친 글'},409);await o.post(draft.id,409);
  // 거두기: 손님 보기 · 알림 · 그림 · 파일에서 모두 빠진다. 소식 전용이고 다른 참조가 없으니 기록을 빼고 파일을 지운다.
  const diskName=o.disk(p1);assert.ok(await f.exists(diskName));
  assert.ok((await f.backupConsistent()).includes(diskName),'소식 그림은 백업 목록에 든다');
  const withdrawn=await o.withdraw(draft.id);
  assert.equal(withdrawn.data.removed,undefined,'지운 파일 이름은 응답에 싣지 않는다');
  assert.equal(o.progress()[0].state,'withdrawn');assert.deepEqual(o.progress()[0].assets,[],'거둔 소식은 지운 그림을 가리키지 않는다');
  assert.equal(o.asset(p1),undefined,'자산 기록에서 빠졌다');
  assert.equal(await f.exists(diskName),false,'커밋 뒤 파일을 지웠다');
  assert.ok(!(await f.backupConsistent()).includes(diskName),'백업 목록에서도 빠졌다');
  room=await o.room();
  assert.equal(room.project.studio.request.progress,undefined);
  assert.equal((await o.media(p1)).status,404);
  live=await o.live();
  assert.ok(!live.notifications.some(item=>item.type==='progress_posted'),'거둔 소식의 알림은 사라진다');
  await o.withdraw(draft.id,409);await o.post(draft.id,409);
  // 사라진 소식 id · 모르는 칸은 받지 않는다.
  await o.post('00000000-0000-4000-8000-000000000000',404);
  await o.act({action:'progress_save',text:'칸 시험',extra:1},400);
});

test('작업 소식 · 상한: 글 600자 · 그림 넷 · 소식 그림 40장 · 소식 30개, 소식 그림은 PNG · JPG만',async t=>{
  const f=await fixture(t),o=await f.order();
  await o.save({text:'가'.repeat(601)},400);
  await o.save({text:'   '},400);
  await o.save({text:'단계',stage:'request'},400);
  await o.save({text:'가'.repeat(600)});
  const ids=[];for(let i=0;i<5;i++)ids.push(await o.image(`p${i}.png`));
  await o.save({text:'그림 다섯',assets:ids},400);
  await o.save({text:'같은 그림 둘',assets:[ids[0],ids[0]]},400);
  await o.save({text:'없는 그림',assets:['00000000-0000-4000-8000-000000000000']},404);
  // 소식 그림은 PNG · JPG만, 모르는 purpose는 거절.
  assert.equal((await o.upload('clip.mp4',{bytes:mp4,type:'video/mp4'})).status,415);
  assert.equal((await o.upload('x.png',{purpose:'scene'})).status,400);
  // 소리 파일(일반 올리기)은 소식에 붙일 수 없다.
  const voice=Buffer.concat([Buffer.from('RIFF'),Buffer.alloc(4),Buffer.from('WAVE'),Buffer.alloc(32)]);
  const audio=await o.upload('voice.wav',{bytes:voice,type:'audio/wav',purpose:null});assert.equal(audio.status,201,JSON.stringify(audio.data));
  await o.save({text:'소리',assets:[audio.data.asset.id]},404);
  // 소식 그림 40장(이미 5장) — 41장째는 409, 일반 그림은 그대로 올라간다.
  await o.save({text:'넷까지',assets:ids.slice(0,4)});
  for(let i=5;i<40;i++)await o.image(`q${i}.png`);
  const over=await o.upload('q40.png');assert.equal(over.status,409);assert.match(over.data.error||'',/40장/);
  assert.equal((await o.upload('plain.png',{purpose:null})).status,201,'소식 전용이 아닌 그림은 40장과 상관없다');
  // 한 시간 넘게 어느 소식에도 안 붙은 그림은 40장에 세지 않고(끝 판 카본 검수 A1), 다음 소식 동작이 지운다. 초안에 붙은 넷은 남는다.
  f.advance(61*60000);
  assert.equal((await o.upload('q40.png')).status,201,'붙이지 못한 그림이 자리를 막지 않는다');
  const progressImages=()=>f.app.store.get('clientProjects',o.id).studio.assets.filter(asset=>asset.purpose==='progress').length;
  assert.equal(progressImages(),41);
  await o.save({text:'정리 시험'});
  assert.equal(progressImages(),5,'한 시간 지난 붙지 않은 그림 36장을 지우고 초안의 넷 · 방금 올린 하나는 남는다');
  // 소식 30개 — 31번째는 막히고, 거둔 소식이 있으면 가장 오래 거둔 기록 하나를 비우고 쓴다.
  while(o.progress().length<30)await o.save({text:'소식 '+o.progress().length});
  await o.save({text:'서른한 번째'},409);
  const oldest=o.progress()[0].id,second=o.progress()[1].id;
  await o.withdraw(second);await o.withdraw(oldest);
  await o.save({text:'서른한 번째'});
  assert.equal(o.progress().length,30);
  assert.ok(!o.progress().some(item=>item.id===second),'먼저 거둔 기록이 비워졌다');
  assert.ok(o.progress().some(item=>item.id===oldest&&item.state==='withdrawn'));
});

test('작업 소식 · 다른 참조가 있는 그림은 거둬도 지우지 않는다(숨기기만) — 장면 · 다른 소식 · 일반 그림, 초안에서 뺀 그림과 붙이지 못한 그림은 정리한다',async t=>{
  const f=await fixture(t),o=await f.order();
  // ① 장면(내부 공개)이 같이 쓰는 소식 그림: 거두면 손님에게서만 숨는다.
  const shared=await o.image('shared.png');
  await o.act({action:'save_scene',title:'컷 1',description:'벤치 위 캔',narration:'',screenText:'',duration:3,visibility:'internal',assetId:shared});
  await o.save({text:'장면과 같은 그림',assets:[shared]});const a=o.progress().at(-1).id;await o.post(a);
  assert.equal((await o.media(shared)).status,200);
  await o.withdraw(a);
  assert.ok(o.asset(shared),'장면이 가리키니 자산 기록은 남는다');assert.ok(await f.exists(o.disk(shared)),'파일도 남는다');
  assert.deepEqual(o.progress().find(item=>item.id===a).assets,[shared],'거둔 소식 기록도 그대로');
  assert.equal((await o.media(shared)).status,404,'손님에게서는 숨는다');
  // 소식 전용 그림이 손님에게 공개된 장면으로 보일 때도 직원 파일 이름은 내리지 않는다(소식에 안 붙어 있어도).
  const sceneShot=await o.image('비공개-장면캡처.png');
  await o.act({action:'save_scene',title:'컷 2',description:'손님 공개 장면',narration:'',screenText:'',duration:3,visibility:'customer',assetId:sceneShot});
  const viaScene=(await o.room()).project.studio.assets.find(asset=>asset.id===sceneShot);
  assert.equal(viaScene?.fileName,'progress.png','장면으로 보여도 소식 전용 그림 이름은 형식만');assert.doesNotMatch((await f.call('/pulse/api/project')).raw,/비공개-장면캡처/);
  // ② 두 소식이 함께 쓰는 그림: 하나를 거두면 남고, 둘 다 거두면 지운다.
  const both=await o.image('both.png');
  await o.save({text:'첫 소식',assets:[both]});const b1=o.progress().at(-1).id;await o.post(b1);
  await o.save({text:'둘째 소식',assets:[both]});const b2=o.progress().at(-1).id;await o.post(b2);
  const bothDisk=o.disk(both);
  await o.withdraw(b1);
  assert.ok(o.asset(both)&&await f.exists(bothDisk),'다른 소식이 쓰면 남는다');assert.equal((await o.media(both)).status,200,'둘째 소식으로 여전히 보인다');
  await o.withdraw(b2);
  assert.equal(o.asset(both),undefined);assert.equal(await f.exists(bothDisk),false);
  // ③ 소식 전용이 아닌 그림(일반 올리기)은 거둬도 지우지 않는다.
  const plain=(await o.upload('plain.png',{purpose:null})).data.asset.id;
  await o.save({text:'일반 그림',assets:[plain]});const c=o.progress().at(-1).id;await o.post(c);await o.withdraw(c);
  assert.ok(o.asset(plain)&&await f.exists(o.disk(plain)),'소식 전용이 아니면 남는다');
  // ④ 초안에서 뺀 소식 그림은 바로 정리한다(다른 참조가 없을 때).
  const keep=await o.image('keep.png'),drop=await o.image('drop.png');
  await o.save({text:'초안',assets:[keep,drop]});const d=o.progress().at(-1).id;const dropDisk=o.disk(drop);
  await o.save({id:d,text:'초안 고침',assets:[keep]});
  assert.equal(o.asset(drop),undefined);assert.equal(await f.exists(dropDisk),false);assert.ok(o.asset(keep));
  // ⑤ 올리고 소식에 붙이지 못한 그림: 한 시간 안에는 그대로, 한 시간이 지나면 다음 소식 동작 때 정리한다.
  const stray=await o.image('stray.png');const strayDisk=o.disk(stray);
  await o.save({id:d,text:'초안 또 고침',assets:[keep]});
  assert.ok(o.asset(stray),'한 시간 안에는 붙이는 중일 수 있어 남긴다');
  f.advance(61*60000);
  await o.save({id:d,text:'한 시간 뒤',assets:[keep]});
  assert.equal(o.asset(stray),undefined);assert.equal(await f.exists(strayDisk),false);
  assert.ok(o.asset(keep),'초안에 붙은 그림은 오래돼도 남는다');assert.ok(o.asset(shared),'장면이 쓰는 그림은 남는다');
  await f.backupConsistent();
});

test('작업 소식 · 90일 정리(확인 안 된 접수) 뒤에는 소식 · 그림이 남지 않고, 일반 보관에서는 남는다',async t=>{
  const f=await fixture(t);
  const kept=await f.order();
  const keptImage=await kept.image('kept.png');await kept.save({text:'보관해도 남는 소식',assets:[keptImage]});await kept.post(kept.progress()[0].id);
  // 일반 보관(stage archived — 파일을 지우지 않는다, client-projects.mjs).
  const row=f.app.store.get('clientProjects',kept.id);f.app.store.put('clientProjects',kept.id,{...row,stage:'archived',revision:row.revision+1});
  const gone=await f.order({},{confirm:false});
  const goneImage=await gone.image('gone.png');await gone.save({text:'정리되는 소식',assets:[goneImage]});await gone.post(gone.progress()[0].id);
  const goneDisk=gone.disk(goneImage),keptDisk=kept.disk(keptImage);
  f.advance(91*86400000);
  const result=await f.app.pulseRequests.retireUnconfirmed();
  assert.equal(result.retired,1);
  const after=f.app.store.get('clientProjects',gone.id);
  assert.equal(after.studio.request.status,'retired');assert.equal(after.studio.progress,undefined,'소식이 남지 않는다');
  assert.ok(!after.studio.assets.length);assert.equal(await f.exists(goneDisk),false,'소식 그림 파일도 지운다');
  const archived=f.app.store.get('clientProjects',kept.id);
  assert.equal(archived.studio.progress.length,1,'일반 보관은 소식을 지우지 않는다');assert.ok(await f.exists(keptDisk));
  await f.backupConsistent();
});

test('작업 소식 · 알림은 앱 안 · 기기만 — 메일 함에 들지 않아 서버를 되돌려도 함에 모르는 순간이 없다',async t=>{
  const f=await fixture(t);await f.connect();
  const o=await f.order();
  f.advance(60000);await f.app.pulseMail.tick();f.advance(4*60000);await f.app.pulseMail.tick();
  const before=f.app.store.all('pulseMailOutbox').length,sent=f.fake.sent.length;
  const p=await o.image('p.png');await o.save({text:'작업 중',assets:[p]});await o.post(o.progress()[0].id);
  f.advance(60000);await f.app.pulseMail.tick();f.advance(4*60000);await f.app.pulseMail.tick();
  const outbox=f.app.store.all('pulseMailOutbox');
  assert.equal(outbox.length,before,'소식은 메일 함에 들지 않는다');assert.equal(f.fake.sent.length,sent);
  assert.ok(outbox.every(item=>PULSE_MAIL_MOMENTS.includes(item.moment)),'옛 판 메일 조립기가 모르는 순간이 함에 없다');
  assert.ok(f.app.store.get('clientProjects',o.id).notificationEvents.some(event=>event.type==='progress_posted'),'알림 사건은 남는다(앱 안 · 기기)');
  assert.ok(!PULSE_MAIL_MOMENTS.includes('progress_posted'));
});

test('작업 소식 · 영어 프로젝트는 손님에게 보일 영어 문장이 있어야 올라가고, 손님 보기는 그 영어로',async t=>{
  const f=await fixture(t);
  assert.equal((await f.staff('/api/settings/pulse-features',{body:{projectLocales:['ko','en']}})).status,200);
  const o=await f.order({contactLocale:'en'});
  await o.save({text:'이미지 콘티를 만들고 있어요.'});const id=o.progress()[0].id;
  const blocked=await o.post(id,409);assert.match(blocked.data.error||'',/영어 프로젝트예요/);
  await o.save({id,text:'이미지 콘티를 만들고 있어요.',translation:{text:'We are drawing the storyboard frames.'}});
  await o.post(id);
  assert.equal(o.row.translation.entries['progress:'+id+':text'].fresh,true,'직원 번역 칸에 소식 글이 서고 원문과 맞다');
  const room=await o.room();
  assert.equal(room.project.studio.request.progress[0].text,'We are drawing the storyboard frames.');
  const note=(await o.live()).notifications.find(item=>item.type==='progress_posted');
  assert.equal(note.title,'New work-in-progress update');
  // 원문을 고치면 낡은 번역은 쓰지 않는다 — 고친 초안은 새 번역이 있어야 올라간다.
  await o.save({text:'장면 이미지를 만들고 있어요.',translation:{text:'We are making the scene images.'}});const second=o.progress().at(-1).id;
  await o.save({id:second,text:'장면 이미지를 고치고 있어요.'});
  await o.post(second,409);
});
