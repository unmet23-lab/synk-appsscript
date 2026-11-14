// 문의 사진(운영 조각 8-B): 손님이 담당자에게 묻는 글에 JPG · PNG를 넷까지 붙인다.
// 순수 도우미(pulse-message-photos.mjs)와 서버 길(올리기 · 보내기 · 한도 · 한 시간 뒤 정리 · 정리 예약 · 직원에게 안 보이는 올려 둔 사진 · 자동 안내 건너뛰기 · 백업 · 90일 정리)을 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readdir,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {request as httpRequest} from 'node:http';
import {createCompanyApp} from './server.mjs';
import {Store} from './store.mjs';
import {createClientProjectsService} from './client-projects.mjs';
import {createPulseStudioService} from './pulse-studio.mjs';
import {createPulseAutoReplyService,PULSE_AUTO_REPLY_MODEL} from './pulse-auto-reply.mjs';
import {workspaceMediaNames} from './workspace-media.mjs';
import {MESSAGE_PHOTOS,isMessagePhoto,attachedPhotoIds,messageUploadsOf,photoList,supportPhotos,attachUploads,sweepUnsentPhotos} from './pulse-message-photos.mjs';

const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
const jpeg=Buffer.concat([Buffer.from([0xff,0xd8,0xff,0xe0,0x00,0x10,0x4a,0x46,0x49,0x46,0x00,0x01]),Buffer.alloc(64,1),Buffer.from([0xff,0xd9])]);
const answers=(extra={})=>({name:'오미톡 오미자 스파클링',kind:'food',channels:['shorts'],package:'s15',audience:'운동 끝나고 목마른 20대',oneThing:'한 캔에 맛이 다섯 번 바뀐다',action:'buy',screenText:'다섯 가지 맛, 톡.',avoid:['갈증 해소'],win:'impact',refs:[{url:'https://youtu.be/example',points:['카메라 · 속도'],why:''}],models:['M06'],date:'2026-11-21',approver:'one',contactName:'김합성',company:'합성 음료',email:'buyer@pulse-synthetic.test',consent:true,rights:true,...extra});
const photoAsset=(extra={})=>({id:randomUUID(),diskName:randomUUID()+'.png',fileName:'a.png',mimeType:'image/png',byteSize:10,purpose:'message',author:'customer',authorId:'customer',authorName:'합성',at:'2026-11-15T00:00:00.000Z',...extra});
// 올려 두고 아직 글에 안 붙은 사진(자산이 아니다 — purpose는 붙일 때 단다).
const upload=(extra={})=>{const {purpose,...rest}=photoAsset(extra);return rest;};

// ── 순수 도우미 ──
test('only customer message photos count, and attached ids are gathered from every message',()=>{
  assert.equal(isMessagePhoto(photoAsset()),true);
  assert.equal(isMessagePhoto(photoAsset({author:'staff'})),false,'a staff picture is never a customer question photo');
  assert.equal(isMessagePhoto(photoAsset({purpose:undefined})),false,'a request photo (no purpose) is not a message photo');
  assert.equal(isMessagePhoto(photoAsset({purpose:'progress'})),false);
  assert.equal(isMessagePhoto(null),false);
  const ids=attachedPhotoIds({messages:[{photos:['a','b']},{text:'x'},{photos:'bad'},null,{photos:['c']}]});
  assert.deepEqual([...ids],['a','b','c']);
  assert.equal(attachedPhotoIds({}).size,0);
});
test('a message takes up to four unique photos uploaded to this project and not sent yet',()=>{
  const mine=[upload(),upload(),upload(),upload(),upload()],staff=photoAsset({author:'staff'}),request=photoAsset({purpose:undefined}),sent=photoAsset();
  const row={studio:{assets:[staff,request,sent],messageUploads:mine},messages:[{author:'customer',action:'support',photos:[sent.id]}]};
  const status=(value,code,message)=>assert.throws(()=>supportPhotos(row,value),error=>error.status===code&&(!message||error.message===message));
  assert.deepEqual(supportPhotos(row,undefined),[]);
  assert.deepEqual(supportPhotos(row,[]),[]);
  assert.deepEqual(supportPhotos(row,mine.slice(0,4).map(a=>a.id)),mine.slice(0,4).map(a=>a.id));
  status('x',400);status(null,400);status({},400);
  status(mine.map(a=>a.id),400);
  status([mine[0].id,mine[0].id],400);
  status(['not-a-uuid'],400);status([7],400);
  status([randomUUID()],409,'붙인 사진을 찾지 못했어요. 사진을 다시 골라 주세요.');
  status([staff.id],409,'붙인 사진을 찾지 못했어요. 사진을 다시 골라 주세요.');
  status([request.id],409,'붙인 사진을 찾지 못했어요. 사진을 다시 골라 주세요.');
  status([sent.id],409,'이미 보낸 사진이에요. 사진을 다시 골라 주세요.');
  assert.equal(MESSAGE_PHOTOS.perMessage,4);
  assert.deepEqual(messageUploadsOf({messageUploads:[mine[0],null,{id:7},'x']}),[mine[0]]);assert.deepEqual(messageUploadsOf({}),[]);assert.deepEqual(messageUploadsOf(null),[]);
});
test('attaching moves the photos from the uploads into the assets, in the order they were attached, marked as question photos',()=>{
  const a=upload(),b=upload(),c=upload(),kept=photoAsset({author:'staff',purpose:undefined}),studio={schemaVersion:1,assets:[kept],messageUploads:[a,b,c],scenes:[]};
  const next=attachUploads(studio,[c.id,a.id]);
  assert.deepEqual(next.assets.map(asset=>asset.id),[kept.id,c.id,a.id]);
  assert.deepEqual(next.assets.slice(1).map(asset=>asset.purpose),['message','message']);assert.equal(isMessagePhoto(next.assets[1]),true);
  assert.deepEqual(next.messageUploads.map(item=>item.id),[b.id]);assert.deepEqual(next.scenes,[]);assert.equal(next.schemaVersion,1);
  assert.equal(studio.messageUploads.length,3,'the old studio is left as it was');
  assert.equal(attachUploads(studio,[]),studio);
  assert.throws(()=>attachUploads(studio,[randomUUID()]),error=>error.status===409);
  const full={assets:Array.from({length:MESSAGE_PHOTOS.assets-1},()=>photoAsset({author:'staff'})),messageUploads:[a,b]};
  assert.equal(attachUploads(full,[a.id]).assets.length,MESSAGE_PHOTOS.assets);
  assert.throws(()=>attachUploads(full,[a.id,b.id]),error=>error.status===409&&error.message==='이 프로젝트의 기록이 가득 찼어요. 새 프로젝트로 이어 가 주세요.');
});
test('uploads older than an hour are swept; fresh ones stay',()=>{
  const now=Date.parse('2026-11-15T12:00:00.000Z'),old='2026-11-15T10:59:00.000Z',fresh='2026-11-15T11:30:00.000Z';
  const stale=upload({at:old}),young=upload({at:fresh}),broken=upload({at:'nope'}),bare=upload({at:old,diskName:''});
  const {uploads,removed}=sweepUnsentPhotos([stale,young,broken,bare],now);
  assert.deepEqual(uploads.map(a=>a.id),[young.id]);
  assert.deepEqual(removed,[{diskName:stale.diskName},{diskName:broken.diskName}],'an upload without a readable time is swept too; one without a file is just dropped');
  assert.equal(sweepUnsentPhotos([upload({at:new Date(now-MESSAGE_PHOTOS.orphanMs).toISOString()})],now).uploads.length,0,'exactly one hour old is swept');
  assert.equal(sweepUnsentPhotos([upload({at:new Date(now-MESSAGE_PHOTOS.orphanMs+1).toISOString()})],now).uploads.length,1);
});
test('the photo list shape is checked on its own, before any other rule',()=>{
  assert.deepEqual(photoList(undefined),[]);
  for(const bad of ['not-an-array',null,{},[1],['x'],[randomUUID(),randomUUID(),randomUUID(),randomUUID(),randomUUID()]])assert.throws(()=>photoList(bad),error=>error.status===400);
  const two=[randomUUID(),randomUUID()];assert.equal(photoList(two),two);
});

// ── 서버 길 ──
async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-pulse-message-photo-'));
  const options={dataDir:join(directory,'server'),clientIntakeDir:join(directory,'inbox'),host:'127.0.0.1',port:0,origin:'http://127.0.0.1:0',allowTestHost:true,schedule:false,workNotificationsEnabled:false,webPushEnabled:false,synkIdentityConfig:null,synkCustomerIdentityConfig:null,pulseRequestFreeBytes:async()=>100*1024**3};
  const app=createCompanyApp(options),address=await app.start(),base='http://127.0.0.1:'+address.port;
  const owner=app.store.createUser({name:'담당자',email:'owner@pulse-synthetic.test',role:'admin'}),token=app.store.mint('session',owner.id,{csrfToken:'staff-csrf'},120);
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const jar=new Map();
  function remember(response){for(const line of response.headers.getSetCookie?.()||[]){const [pair,...rest]=line.split(';'),[name,value]=pair.split('=');if(value&&!/max-age=0/i.test(rest.join(';')))jar.set(name,value);else jar.delete(name);}}
  async function call(path,{body,raw,headers={},method=body===undefined&&raw===undefined?'GET':'POST',origin=app.origin,csrf=''}={}){
    const response=await fetch(base+path,{method,headers:{...(jar.size?{Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')}:{}),...(origin?{Origin:origin}:{}),...(csrf?{'X-Pulse-CSRF':csrf}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers},body:raw??(body===undefined?undefined:JSON.stringify(body)),...(raw instanceof ReadableStream?{duplex:'half'}:{})});
    remember(response);const bytes=Buffer.from(await response.arrayBuffer());let data=null;try{data=JSON.parse(bytes.toString());}catch{}
    return {status:response.status,data,bytes,headers:response.headers};
  }
  async function staff(path,{body,method=body===undefined?'GET':'POST'}={}){
    const response=await fetch(base+path,{method,headers:{Cookie:'synk_company_session='+token,'X-CSRF-Token':'staff-csrf',Origin:app.origin,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
    const bytes=Buffer.from(await response.arrayBuffer());let data=null;try{data=JSON.parse(bytes.toString());}catch{}return {status:response.status,data,bytes,headers:response.headers};
  }
  const draft=await call('/pulse/api/request/start',{body:{}});assert.equal(draft.status,201);
  const sent=await call('/pulse/api/request/submit',{body:{answers:answers()},csrf:draft.data.draft.csrf});assert.equal(sent.status,201,JSON.stringify(sent.data));
  const id=sent.data.projectId,room=(await call('/pulse/api/project')).data;
  const photo=({bytes=png,type='image/png',name='질문 사진.png',csrf=room.csrf,origin}={})=>call('/pulse/api/studio/message-photo',{raw:bytes,csrf,...(origin?{origin}:{}),headers:{'Content-Type':type,'X-File-Name':encodeURIComponent(name)}});
  const ask=async(body,csrf=room.csrf)=>{const now=(await call('/pulse/api/project')).data;return call('/pulse/api/action',{body:{action:'support',revision:now.project.revision,...body},csrf});};
  const disk=async()=>(await readdir(join(options.dataDir,'studio-media'))).filter(name=>!name.endsWith('.upload')).length;
  const row=()=>app.store.get('clientProjects',id);
  const put=change=>{const current=row();app.store.put('clientProjects',id,change(current));};
  const cookie=()=>[...jar].map(([k,v])=>`${k}=${v}`).join('; ');
  return {app,options,base,cookie,call,staff,photo,ask,disk,row,put,id,room,owner};
}

test('a customer attaches photos to a question: upload one at a time, send with or without text, both sides see them',async t=>{
  const f=await fixture(t);const before=await f.disk();
  const first=await f.photo();assert.equal(first.status,201,JSON.stringify(first.data));
  assert.equal(typeof first.data.photo.id,'string');
  assert.equal(Object.hasOwn(first.data,'removed'),false,'swept disk names are never sent back');
  assert.equal(JSON.stringify(first.data).includes('diskName'),false);
  assert.equal(first.data.project.studio.assets.some(asset=>asset.id===first.data.photo.id),false,'an uploaded photo is not an asset until it is sent');
  assert.equal(JSON.stringify(first.data).includes('messageUploads'),false,'the uploads list stays on the server');
  const second=await f.photo({bytes:jpeg,type:'image/jpeg',name:'IMG_0001.JPEG'});assert.equal(second.status,201,JSON.stringify(second.data));
  assert.equal(await f.disk(),before+2);
  assert.equal(f.row().messages.some(message=>message.photos),false,'uploading alone sends nothing');
  assert.deepEqual(f.row().studio.messageUploads.map(item=>item.id),[first.data.photo.id,second.data.photo.id]);
  // 서버 끝판 카본 A1: 보내기 전의 사진은 직원 스튜디오 보기 · 프로젝트 · 자료 목록 · 내려받기 어디에도 없고, 손님도 주소로 열 수 없다.
  for(const path of ['/api/client-projects/'+f.id+'/studio','/api/client-projects','/api/client-projects/'+f.id+'/materials']){const seen=await f.staff(path);assert.equal(seen.status,200,path);assert.equal(seen.bytes.toString().includes(first.data.photo.id),false,path+' shows no unsent photo');assert.equal(seen.bytes.toString().includes('messageUploads'),false,path);}
  assert.equal((await f.staff('/api/client-projects/'+f.id+'/studio/media/'+first.data.photo.id)).status,404);
  assert.equal((await f.call('/pulse/api/studio/media/'+first.data.photo.id)).status,404);
  const sent=await f.ask({text:'  이 부분 색이 이상해요  ',photos:[first.data.photo.id,second.data.photo.id]});assert.equal(sent.status,200,JSON.stringify(sent.data));
  const message=f.row().messages.at(-1);
  assert.equal(message.text,'이 부분 색이 이상해요');assert.deepEqual(message.photos,[first.data.photo.id,second.data.photo.id]);assert.equal(message.author,'customer');
  const room=(await f.call('/pulse/api/project')).data;
  assert.deepEqual(room.project.messages.at(-1).photos,[first.data.photo.id,second.data.photo.id],'the customer room gets the photo ids back');
  assert.deepEqual(f.row().studio.messageUploads,[],'sending moves them out of the uploads');
  const shown=room.project.studio.assets.find(asset=>asset.id===first.data.photo.id);
  assert.equal(shown.url,'/pulse/api/studio/media/'+first.data.photo.id,'once sent, the customer can open their own photo');
  assert.equal(shown.purpose,undefined,'the customer view carries no staff tags');
  assert.equal(room.project.studio.request.messagePhotos,true,'the room says this server takes question photos (the screen shows the picker only then)');
  const served=await f.call('/pulse/api/studio/media/'+first.data.photo.id);assert.equal(served.status,200);assert.deepEqual(served.bytes,png);
  const staffView=(await f.staff('/api/client-projects/'+f.id+'/studio')).data.project;
  const tagged=staffView.studio.assets.filter(asset=>asset.purpose==='message').map(asset=>asset.id).sort();
  assert.deepEqual(tagged,[first.data.photo.id,second.data.photo.id].sort(),'staff see which pictures came with a question');
  assert.equal((await f.staff('/api/client-projects/'+f.id+'/studio/media/'+second.data.photo.id)).status,200);
  assert.equal((await f.staff('/api/client-projects')).bytes.toString().includes(first.data.photo.id),true,'the staff project list (which hid it before) shows the photo once it is sent');
  const materials=await f.staff('/api/client-projects/'+f.id+'/materials');assert.equal(materials.status,200);
  assert.equal(JSON.stringify(materials.data).split('고객 문의 사진').length-1,2,'the staff materials list names them as question photos');
  // 사진만 보내는 문의
  const only=await f.photo();const alone=await f.ask({photos:[only.data.photo.id]});assert.equal(alone.status,200,JSON.stringify(alone.data));
  assert.equal(f.row().messages.at(-1).text,'');assert.deepEqual(f.row().messages.at(-1).photos,[only.data.photo.id]);
  const quiet=await f.ask({text:'   '});assert.equal(quiet.status,400,'no text and no photos is still refused');
  const plain=await f.ask({text:'글만 보내요'});assert.equal(plain.status,200);assert.equal(Object.hasOwn(f.row().messages.at(-1),'photos'),false,'a text-only message keeps its old shape');
});

test('a photo is sent once; resending the same message is one line; photos ride only on questions',async t=>{
  const f=await fixture(t);
  const a=(await f.photo()).data.photo.id,b=(await f.photo()).data.photo.id;
  const body={text:'같은 질문',photos:[a]};
  assert.equal((await f.ask(body)).status,200);const count=f.row().messages.length;
  assert.equal((await f.ask(body)).status,200,'a double tap sends one message');assert.equal(f.row().messages.length,count);
  const again=await f.ask({text:'다른 질문',photos:[a]});assert.equal(again.status,409);assert.equal(again.data.error,'이미 보낸 사진이에요. 사진을 다시 골라 주세요.');
  const textOnlyRepeat=await f.ask({text:'같은 질문'});assert.equal(textOnlyRepeat.status,200);assert.equal(f.row().messages.length,count+1,'the same words without the photos are a new message');
  // GPT GA2: 바로 앞 글과 같은 말이어도 꼴이 틀린 사진 목록은 「두 번 누름」으로 넘어가지 않고 400이다.
  assert.equal((await f.ask({text:'같은 질문',photos:'not-an-array'})).status,400);
  assert.equal((await f.ask({text:'같은 질문',photos:[]})).status,200,'an empty list is the same as no photos');assert.equal(f.row().messages.length,count+1);
  assert.equal((await f.ask({text:'다섯 장',photos:[b,randomUUID(),randomUUID(),randomUUID(),randomUUID()]})).status,400);
  assert.equal((await f.ask({text:'겹침',photos:[b,b]})).status,400);
  assert.equal((await f.ask({text:'모양',photos:b})).status,400);
  const unknown=await f.ask({text:'없는 사진',photos:[randomUUID()]});assert.equal(unknown.status,409);assert.equal(unknown.data.error,'붙인 사진을 찾지 못했어요. 사진을 다시 골라 주세요.');
  const now=(await f.call('/pulse/api/project')).data;
  assert.equal((await f.call('/pulse/api/action',{body:{action:'feedback',revision:now.project.revision,text:'의견',photos:[b]},csrf:f.room.csrf})).status,400,'only a question takes photos');
  // 직원이 올린 그림 · 손님이 보낸 의뢰 자료는 문의 사진이 아니다.
  const request=await f.call('/pulse/api/studio/request-file',{raw:png,csrf:f.room.csrf,headers:{'Content-Type':'image/png','X-File-Name':'front.png','X-Request-Slot':'front'}});assert.equal(request.status,201,JSON.stringify(request.data));
  assert.equal((await f.ask({text:'의뢰 자료',photos:[request.data.file.id]})).status,409);
  const staffAsset=photoAsset({author:'staff',authorId:f.owner.id});f.put(current=>({...current,studio:{...current.studio,assets:[...current.studio.assets,staffAsset]}}));
  assert.equal((await f.ask({text:'직원 그림',photos:[staffAsset.id]})).status,409);
  assert.equal(f.row().messages.some(message=>message.text==='직원 그림'||message.text==='의뢰 자료'),false);
  assert.equal((await f.ask({text:'남은 사진',photos:[b]})).status,200,'a photo that was refused alongside others is still free to send');
});

test('the photo route checks session, origin, type, signature and size, and leaves no file behind when it refuses',async t=>{
  const f=await fixture(t);const before=await f.disk();
  assert.equal((await f.photo({csrf:'wrong'})).status,403);
  assert.equal((await f.photo({origin:'https://evil.example'})).status,403);
  const pdf=await f.photo({bytes:Buffer.from('%PDF-1.7 synthetic'),type:'application/pdf',name:'a.pdf'});assert.equal(pdf.status,415);assert.equal(pdf.data.error,'문의에는 사진(JPG · PNG)만 붙일 수 있어요.');
  assert.equal((await f.photo({bytes:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),type:'image/svg+xml',name:'a.svg'})).status,415);
  assert.equal((await f.photo({type:'image/png',name:'a.mp4'})).status,415,'the name has to match the type');
  const named=await f.photo({bytes:Buffer.from('%PDF-1.7 synthetic'),type:'image/png',name:'logo.pdf'});assert.equal(named.status,415,'a picture type with a document name and document bytes is not a photo');assert.equal(named.data.error,'문의에는 사진(JPG · PNG)만 붙일 수 있어요.');
  assert.equal((await f.photo({bytes:Buffer.from([0,0,0,0x18,0x66,0x74,0x79,0x70,0x6d,0x70,0x34,0x32,...Buffer.alloc(32)]),type:'video/mp4',name:'clip.mp4'})).status,415,'a video is not a question photo, even though request files take it');
  const early=await f.photo({csrf:'wrong',bytes:Buffer.concat([png,Buffer.alloc(16*1024**2)])});assert.equal(early.status,403,'a wrong session is refused before the bytes are read (not 413)');
  const chunked=await (async()=>{const big=Buffer.concat([png,Buffer.alloc(15*1024**2)]);const body=new ReadableStream({start(controller){for(let at=0;at<big.length;at+=1024**2)controller.enqueue(big.subarray(at,at+1024**2));controller.close();}});return f.call('/pulse/api/studio/message-photo',{raw:body,csrf:f.room.csrf,headers:{'Content-Type':'image/png','X-File-Name':'big.png'}});})();
  assert.equal(chunked.status,413,'a body without a declared length is cut at 15MB while it streams');
  // 선언한 길이가 15MB를 넘으면 몸통을 기다리지 않고 바로 거절한다(디스크에 쓰기 전).
  const declared=await new Promise((done,fail)=>{const url=new URL(f.base+'/pulse/api/studio/message-photo');const req=httpRequest({host:url.hostname,port:url.port,path:url.pathname,method:'POST',headers:{Origin:f.app.origin,Cookie:f.cookie(),'X-Pulse-CSRF':f.room.csrf,'Content-Type':'image/png','X-File-Name':'big.png','Content-Length':String(20*1024**2)}},res=>{res.resume();done(res.statusCode);});const timer=setTimeout(()=>{req.destroy();done('no answer');},3000);req.on('error',error=>{clearTimeout(timer);if(error.code==='ECONNRESET')return;fail(error);});req.on('close',()=>clearTimeout(timer));req.write(png);});
  assert.equal(declared,413,'a declared size over 15MB is refused at once, before the body arrives');
  assert.equal((await f.photo({bytes:Buffer.from('not a png'),name:'fake.png'})).status,415,'the first bytes are checked');
  assert.equal((await f.photo({bytes:Buffer.alloc(0)})).status,415);
  const big=Buffer.concat([png,Buffer.alloc(15*1024**2)]);
  const tooBig=await f.photo({bytes:big});assert.equal(tooBig.status,413);assert.equal(tooBig.data.error,'사진은 한 장에 15MB까지 붙일 수 있어요.');
  assert.equal(await f.disk(),before,'refused photos leave nothing on disk');
  assert.equal((await readdir(join(f.options.dataDir,'studio-media'))).some(name=>name.endsWith('.upload')),false);
  f.put(current=>({...current,stage:'archived'}));
  const archived=await f.photo();assert.equal(archived.status,401,'an archived project has no customer session left');assert.equal(await f.disk(),before);
});

test('limits: eight unsent at a time, forty per project, the shared asset cap; an hour-old unsent photo is swept from disk',async t=>{
  const f=await fixture(t);const before=await f.disk();
  const ids=[];for(let i=0;i<MESSAGE_PHOTOS.pending;i+=1){const result=await f.photo();assert.equal(result.status,201);ids.push(result.data.photo.id);}
  const ninth=await f.photo();assert.equal(ninth.status,409);assert.equal(ninth.data.error,'아직 보내지 않은 사진이 많아요. 문의를 먼저 보내 주세요.');
  assert.equal(await f.disk(),before+8,'the refused ninth photo is discarded');
  assert.equal((await f.ask({text:'넷 보내요',photos:ids.slice(0,4)})).status,200);
  assert.equal((await f.photo()).status,201,'sending frees room for more');
  // 한 시간 넘게 안 보낸 사진: 다음 올리기 때 올려 둔 목록에서 빠지고 디스크에서도 지워진다. 보낸 사진은 그대로.
  const old=new Date(Date.now()-2*3600000).toISOString();
  f.put(current=>({...current,studio:{...current.studio,messageUploads:current.studio.messageUploads.map(item=>({...item,at:old}))}}));
  const sweptDisk=f.row().studio.messageUploads.map(item=>item.diskName);
  assert.equal(sweptDisk.length,5);
  const fresh=await f.photo();assert.equal(fresh.status,201,JSON.stringify(fresh.data));
  assert.deepEqual(f.row().studio.messageUploads.map(item=>item.id),[fresh.data.photo.id]);
  assert.deepEqual(f.row().studio.assets.filter(isMessagePhoto).map(asset=>asset.id).sort(),ids.slice(0,4).sort(),'sent photos stay');
  const files=await readdir(join(f.options.dataDir,'studio-media'));
  for(const name of sweptDisk)assert.equal(files.includes(name),false,'swept photos leave the disk');
  assert.equal(await f.disk(),before+5);
  // 보내기 전의 사진은 자산이 아니라 다른 칸(참고 자료)에 걸 수 없다(GPT GA1이 걱정한 「안 보낸 사진을 가리키는 칸」이 생기지 않는다).
  const room=(await f.call('/pulse/api/project')).data;
  assert.equal((await f.call('/pulse/api/studio',{body:{revision:room.project.revision,action:'save_reference',label:'이 느낌',assetId:fresh.data.photo.id,preference:'like',reason:''},csrf:f.room.csrf})).status,404);
  // 한 프로젝트 40장(보낸 사진 + 올려 둔 사진). 지금 수를 세어 정확히 40장을 채운다(GPT 다시 검수 GA1 — 41장이면 「40장을 넘으면」으로 잘못 바뀌어도 통과한다).
  const have=f.row().studio.assets.filter(isMessagePhoto).length+f.row().studio.messageUploads.length,many=Array.from({length:MESSAGE_PHOTOS.perProject-have},()=>photoAsset({at:new Date().toISOString()}));
  assert.equal(have,5);assert.equal(have+many.length,MESSAGE_PHOTOS.perProject);
  f.put(current=>({...current,studio:{...current.studio,assets:[...current.studio.assets,...many]},messages:[...current.messages,...Array.from({length:Math.ceil(many.length/4)},(_,i)=>({id:randomUUID(),author:'customer',visibility:'customer',action:'support',text:'',photos:many.map(asset=>asset.id).slice(i*4,i*4+4),at:new Date().toISOString(),resolved:false}))]}));
  const diskBefore=await f.disk();
  const full=await f.photo();assert.equal(full.status,409);assert.equal(full.data.error,'문의 사진은 한 프로젝트에 40장까지 붙일 수 있어요. 더 보낼 사진은 드라이브 링크로 알려 주세요.');
  assert.equal(await f.disk(),diskBefore,'the refused photo is discarded');
  // 프로젝트 자산 120 한도에는 올려 둔 사진도 든다(자산 119 + 올려 둔 하나 = 120).
  f.put(current=>({...current,studio:{...current.studio,assets:Array.from({length:MESSAGE_PHOTOS.assets-1},()=>photoAsset({author:'staff',purpose:undefined}))},messages:current.messages.map(({photos,...message})=>message)}));
  assert.equal(f.row().studio.messageUploads.length,1);
  const capped=await f.photo();assert.equal(capped.status,409);assert.equal(capped.data.error,'이 프로젝트의 기록이 가득 찼어요. 새 프로젝트로 이어 가 주세요.');
  assert.equal(await f.disk(),diskBefore);
});

test('the maintenance sweep clears hour-old unsent photos and their files without moving the project clock (end-pass A2)',async t=>{
  const f=await fixture(t);
  const a=(await f.photo()).data.photo.id,b=(await f.photo()).data.photo.id;
  const old=new Date(Date.now()-2*3600000).toISOString();
  f.put(current=>({...current,studio:{...current.studio,messageUploads:current.studio.messageUploads.map(item=>item.id===a?{...item,at:old}:item)}}));
  const stale=f.row().studio.messageUploads.find(item=>item.id===a).diskName,kept=f.row().studio.messageUploads.find(item=>item.id===b).diskName,{revision,updatedAt}=f.row();
  await f.app.sweepPulseMessageUploads();
  assert.deepEqual(f.row().studio.messageUploads.map(item=>item.id),[b]);
  const files=await readdir(join(f.options.dataDir,'studio-media'));assert.equal(files.includes(stale),false);assert.equal(files.includes(kept),true);
  assert.equal(f.row().revision,revision,'cleaning is not a change anyone made');assert.equal(f.row().updatedAt,updatedAt,'and does not reset the 90-day quiet clock');
  await f.app.sweepPulseMessageUploads();assert.deepEqual(f.row().studio.messageUploads.map(item=>item.id),[b],'a second pass with nothing stale changes nothing');
  // 이 정리는 6시간마다 도는 의뢰 정리 회차에 실려 있다(서버 시작 시 예약 — 시험 서버는 예약을 끄므로 코드 자리를 본다).
  const server=await readFile(new URL('./server.mjs',import.meta.url),'utf8');
  assert.match(server,/const retirePulseRequests=\(\)=>pulseRequests\.retireUnconfirmed\(\)\.catch\(\(\)=>\{\}\)\.then\(sweepPulseMessageUploads\);/);
  assert.match(server,/pulseRequestTimer=setInterval\(retirePulseRequests,6\*3600000\)/);
});

test('a request file that a question points at cannot be taken back',async t=>{
  const f=await fixture(t);
  const file=await f.call('/pulse/api/studio/request-file',{raw:png,csrf:f.room.csrf,headers:{'Content-Type':'image/png','X-File-Name':'front.png','X-Request-Slot':'front'}});assert.equal(file.status,201);
  f.put(current=>({...current,messages:[...current.messages,{id:randomUUID(),author:'customer',visibility:'customer',action:'support',text:'',photos:[file.data.file.id],at:new Date().toISOString(),resolved:false}]}));
  const room=(await f.call('/pulse/api/project')).data;
  assert.equal((await f.call('/pulse/api/studio/request-file/'+file.data.file.id,{method:'DELETE',csrf:room.csrf})).status,409);
});

test('message photos are in the backup list and leave with the rest when an unconfirmed request retires',async t=>{
  const f=await fixture(t);
  const one=await f.photo();assert.equal(one.status,201);assert.equal((await f.ask({text:'사진 문의',photos:[one.data.photo.id]})).status,200);
  const diskName=f.row().studio.assets.find(asset=>asset.id===one.data.photo.id).diskName;
  const two=await f.photo();assert.equal(two.status,201);const unsent=f.row().studio.messageUploads[0].diskName;
  const names=workspaceMediaNames(f.app.store.db);
  assert.equal(names.includes(diskName),true,'backups carry sent message photos');assert.equal(names.includes(unsent),true,'and photos waiting to be sent');
  f.put(current=>({...current,updatedAt:new Date(Date.now()-91*86400000).toISOString()}));
  assert.deepEqual(await f.app.pulseRequests.retireUnconfirmed(),{retired:1});
  assert.equal(f.row().studio.assets.length,0);
  assert.equal((await readdir(join(f.options.dataDir,'studio-media'))).includes(diskName),false,'the photo file leaves too');
  assert.equal((await readdir(join(f.options.dataDir,'studio-media'))).includes(unsent),false,'and so does the unsent one');
  assert.equal(f.row().studio.messageUploads,undefined);
});

test('the automatic guide stays silent on a question with photos and still answers a plain one',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'synk-pulse-message-photo-auto-'));const store=new Store(directory);let service;
  t.after(async()=>{await service?.stop();store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  let now='2026-10-19T03:00:00.000Z';const calls=[];
  const fetchImpl=async(url,init)=>{calls.push(JSON.parse(init.body));return {ok:true,status:200,text:async()=>JSON.stringify({model:PULSE_AUTO_REPLY_MODEL,stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify({decision:'answer',reply:'평일 10~19시에 답해요.',handoffReason:'none'})}],usage:{input_tokens:10,output_tokens:10}})};};
  const admin=store.createUser({name:'admin',email:'admin@auto-reply.example',role:'admin',teamId:'a'}),owner=store.createUser({name:'owner',email:'owner@auto-reply.example',role:'member',teamId:'a'});
  const projects=createClientProjectsService({store,clock:()=>now}),studio=createPulseStudioService({store,clientProjects:projects,clock:()=>now});
  service=createPulseAutoReplyService({store,clientProjects:projects,snapshot:id=>studio.customerSnapshot(id),clock:()=>now,fetchImpl});
  const row=projects.save(owner,{title:'합성 광고',customerName:'합성 카페',contact:'',summary:'합성',terms:'',internalNotes:'',nextStep:'',dueDate:'2026-10-24',stage:'producing'}).project;
  const customer=projects.open(projects.invite(owner,row.id,{revision:row.revision}).invite);
  service.configure(admin,{apiKey:'sk-ant-api03-'+'x'.repeat(40)});service.configure(admin,{enabled:true});
  const asset=photoAsset({at:now});studio.addMessagePhoto(customer.session,customer.csrf,asset);
  now='2026-10-19T03:01:00.000Z';
  const read=()=>store.get('clientProjects',row.id);
  projects.customerAction(customer.session,customer.csrf,{revision:read().revision,action:'support',text:'이 사진 보이세요?',photos:[asset.id]});
  now='2026-10-19T03:02:00.000Z';await service.tick();
  assert.equal(calls.length,0,'no API call for a question with photos');
  assert.equal(read().messages.some(message=>message.automated),false);
  now='2026-10-19T03:03:00.000Z';projects.customerAction(customer.session,customer.csrf,{revision:read().revision,action:'support',text:'언제 받을 수 있나요?'});
  now='2026-10-19T03:04:00.000Z';await service.tick();
  assert.equal(calls.length,1,'a plain question still gets the guide');
  assert.match(JSON.stringify(calls[0]),/언제 받을 수 있나요/);
});
