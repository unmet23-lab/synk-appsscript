import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdir,open,readdir,rename,statfs,unlink,stat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {pipeline} from 'node:stream/promises';
import {validMediaSignature} from './studio-media.mjs';
import {emptyPulseStudio} from './pulse-studio.mjs';
import {recordSceneReview} from './client-scene-requests.mjs';
import {CASTING_MODELS} from './public/pulse-app/casting-catalog.mjs';

// 초대 없이 시작하는 공개 의뢰서(2026-11-04, 설계 docs/마케팅/PULSE_의뢰흐름_20261104/README.md 5절).
// 공개 경로라 프로젝트는 「보내기」에서만 생긴다. 그 전의 초안 · 파일은 따로 두어 스팸이 직원 서버의 프로젝트 · 백업으로 번지지 않게 하고,
// 같은 볼륨을 쓰므로 주소별 · 전체 문턱과 디스크 여유를 먼저 본다. 어떤 칸도 보내기를 막지 않는다 — 막는 것은 연락처와 동의뿐이다.
const KIND='pulseRequests',TOKEN='pulse-request';
export const REQUEST_LIMITS=Object.freeze({
  draftDays:14,tokenDays:30,unconfirmedDays:90,resendMinutes:10,sendingMinutes:2,
  startsPerHourByClient:20,startsPerDay:300,submitsPerDay:50,savesPerHourByClient:1200,uploadsPerHourByClient:200,
  uploadBytesPerDayByClient:2*1024**3,uploadBytesPerDay:10*1024**3,
  filesPerDraft:30,bytesPerDraft:400*1024**2,fileBytes:100*1024**2,attachmentBytes:30*1024**2,
  minimumFreeBytes:20*1024**3,
});
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const busy=()=>fail('지금 의뢰가 많아요. 잠시 뒤에 다시 시도하거나 hello@synk.im으로 알려 주세요.',429);
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const digest=value=>createHash('sha256').update(value).digest('hex');
const CONTROL=/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/;
function text(value,max){if(value===undefined||value===null)return '';if(typeof value!=='string'||value.length>max||CONTROL.test(value))throw fail('입력 내용과 길이를 확인해 주세요.');return value.trim();}
// 주소는 쓰는 동안 막지 않는다(저장은 글자 그대로). 보낼 때만 고쳐 쓰고, 고칠 수 없으면 어느 칸인지 말한다.
function link(value,strict,label){
  const raw=text(value,1000);if(!raw||!strict)return raw;
  const candidate=/^[a-z][a-z0-9+-]*:/i.test(raw)?raw:'https://'+raw;let parsed;
  try{parsed=new URL(candidate);}catch{throw fail(`${label} 주소를 확인해 주세요.`);}
  if(!['https:','http:'].includes(parsed.protocol)||parsed.username||parsed.password)throw fail(`${label} 주소를 확인해 주세요.`);
  return parsed.href;
}
const one=(value,list)=>{const found=value===undefined||value===null?'':value;if(found&&!list.includes(found))throw fail('고른 값을 확인해 주세요.');return found;};
function many(value,list,max=list?.length??8,itemMax=40){if(value===undefined||value===null)return [];if(!Array.isArray(value)||value.length>max)throw fail('고른 값을 확인해 주세요.');const out=[...new Set(value.map(item=>text(item,itemMax)))].filter(Boolean);if(list&&out.some(item=>!list.includes(item)))throw fail('고른 값을 확인해 주세요.');return out;}

export const REQUEST_KINDS=['food','beauty','fashion','living','app','place','brand'];
export const REQUEST_CHANNELS=['shorts','youtube','store','screen'];
export const REQUEST_PACKAGES=['s15','s30','s60','corp','photo','ask'];
const ACTIONS=['buy','install','visit','ask','remember'],WINS=['story','impact','ask'],APPROVERS=['one','many'],MODEL_CHOICES=['ask','none'];
const POINTS=['전개 · 구성','색감 · 빛','카메라 · 속도','모델 연기','소리 · 음악'];
export const REQUEST_SLOTS=['front','side','logo','label','use','detail','screens','space','menu','guide','scene','etc'];
const ANSWER_FIELDS=['name','kind','channels','paid','package','slots','size','useNote','pageUrl','driveUrl','audience','oneThing','action','screenText','avoid','avoidNote','facts','win','refs','avoidFeel','models','modelChoice','date','dateFree','approver','approverName','contactName','company','email','phone','consent','rights'];
const MODEL_IDS=CASTING_MODELS.map(model=>model.id);

export function emptyRequestAnswers(){return {name:'',kind:'',channels:[],paid:false,package:'',slots:{},size:'',useNote:'',pageUrl:'',driveUrl:'',audience:'',oneThing:'',action:'',screenText:'',avoid:[],avoidNote:'',facts:'',win:'',refs:[],avoidFeel:'',models:[],modelChoice:'',date:'',dateFree:false,approver:'',approverName:'',contactName:'',company:'',email:'',phone:'',consent:false,rights:false};}
// 저장(strict 아님)은 길이 · 제어문자 · 고르는 값만 본다. 칸을 쓰는 중에 형식 때문에 자동 저장이 끊기면 안 된다.
// 형식(메일 · 번호 · 주소 · 날짜)은 보낼 때 본다. 파일 목록은 서버가 쥐고, 답에서는 「지금 없어요」 표시만 받는다.
export function normalizeRequestAnswers(input,{strict=false}={}){
  if(!object(input)||Object.keys(input).some(key=>!ANSWER_FIELDS.includes(key)))throw fail('의뢰서 입력 항목을 확인해 주세요.');
  const slots={};if(input.slots!==undefined){if(!object(input.slots))throw fail('준비물 항목을 확인해 주세요.');for(const [key,value]of Object.entries(input.slots)){if(!REQUEST_SLOTS.includes(key)||!object(value))throw fail('준비물 항목을 확인해 주세요.');if(value.none===true)slots[key]={none:true};}}
  const refs=[];if(input.refs!==undefined){if(!Array.isArray(input.refs)||input.refs.length>3)throw fail('참고 광고는 셋까지 적어 주세요.');for(const ref of input.refs){if(!object(ref)||Object.keys(ref).some(key=>!['url','points','why'].includes(key)))throw fail('참고 광고 항목을 확인해 주세요.');const item={url:link(ref.url,strict,'참고 광고'),points:many(ref.points,POINTS),why:text(ref.why,300)};if(item.url||item.points.length||item.why)refs.push(item);}}
  let date=text(input.date,10);if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)){if(strict)throw fail('받고 싶은 날을 확인해 주세요.');date='';}
  const email=text(input.email,254);if(strict&&email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw fail('이메일 주소를 확인해 주세요.');
  const phone=text(input.phone,30);if(strict&&phone&&!/^[0-9+\-() ]{7,30}$/.test(phone))throw fail('휴대폰 번호를 확인해 주세요.');
  return {
    name:text(input.name,120),kind:one(input.kind,REQUEST_KINDS),channels:many(input.channels,REQUEST_CHANNELS),paid:input.paid===true,package:one(input.package,REQUEST_PACKAGES),
    slots,size:text(input.size,120),useNote:text(input.useNote,200),pageUrl:link(input.pageUrl,strict,'제품 페이지'),driveUrl:link(input.driveUrl,strict,'드라이브'),
    audience:text(input.audience,300),oneThing:text(input.oneThing,300),action:one(input.action,ACTIONS),
    screenText:text(input.screenText,300),avoid:many(input.avoid,null,12,40),avoidNote:text(input.avoidNote,300),facts:text(input.facts,300),
    win:one(input.win,WINS),refs,avoidFeel:text(input.avoidFeel,200),models:many(input.models,MODEL_IDS,2),modelChoice:one(input.modelChoice,MODEL_CHOICES),
    date,dateFree:input.dateFree===true,approver:one(input.approver,APPROVERS),approverName:text(input.approverName,80),contactName:text(input.contactName,80),company:text(input.company,100),email,phone,consent:input.consent===true,rights:input.rights===true,
  };
}
// 업로드 형식. 화면에 바로 띄우는 것은 서명을 재서 확인한 PNG · JPEG · MP4 · WebM뿐이고, 나머지는 내려받기 전용으로만 둔다.
const INLINE={'image/png':'png','image/jpeg':'jpg','video/mp4':'mp4','video/webm':'webm'};
const ATTACHMENT=/\.(webp|heic|heif|svg|ai|eps|pdf|ppt|pptx|mov)$/i;
const ftyp=head=>head.length>=12&&head.subarray(4,8).toString('ascii')==='ftyp';
const SIGNATURES={
  webp:head=>head.subarray(0,4).toString('ascii')==='RIFF'&&head.subarray(8,12).toString('ascii')==='WEBP',
  heic:ftyp,heif:ftyp,mov:head=>ftyp(head)||['moov','mdat','wide','free'].includes(head.subarray(4,8).toString('ascii')),
  svg:head=>/^\s*(?:﻿)?<(?:\?xml|svg|!--|!DOCTYPE)/i.test(head.toString('utf8')),
  pdf:head=>head.subarray(0,5).toString('ascii')==='%PDF-',
  ai:head=>['%PDF-','%!PS-'].includes(head.subarray(0,5).toString('ascii')),
  eps:head=>head.subarray(0,5).toString('ascii')==='%!PS-'||head.subarray(0,4).equals(Buffer.from([0xc5,0xd0,0xd3,0xc6])),
  pptx:head=>head.subarray(0,2).toString('ascii')==='PK',
  ppt:head=>head.subarray(0,4).equals(Buffer.from([0xd0,0xcf,0x11,0xe0])),
};
export function requestFileKind(mimeType,fileName){
  const name=String(fileName||'');
  if(INLINE[mimeType]){const extension=INLINE[mimeType],suffix=name.split('.').pop().toLowerCase();if([extension,...(extension==='jpg'?['jpeg']:[])].includes(suffix))return {inline:true,extension};}
  const attachment=ATTACHMENT.exec(name);if(attachment)return {inline:false,extension:'intake',type:attachment[1].toLowerCase()};
  throw fail('이 형식은 받을 수 없어요. 사진(JPG · PNG), 영상(MP4), 로고(AI · SVG · PDF) 같은 파일로 보내 주시거나 드라이브 링크를 적어 주세요.',415);
}
export const validRequestFile=(kind,mimeType,head)=>kind.inline?validMediaSignature(mimeType,head):!!SIGNATURES[kind.type]?.(head);
// 새 고객 방을 쓸 프로젝트: 의뢰서가 있거나, 담당자가 막 만들어 아직 아무 자료도 쌓이지 않은 프로젝트. 옛 자료가 쌓인 프로젝트는 옛 탭을 그대로 쓴다.
export function usesRequestFlow(row,studio){
  if(studio?.request)return true;
  return ['received','planning'].includes(row.stage)&&!studio?.strategy?.revision&&!studio?.scenes?.length&&!studio?.concepts?.length&&!studio?.references?.length&&!studio?.assets?.length&&!row.intake?.files?.length&&!row.messages?.length&&!row.versions?.length;
}
const requestNumber=at=>{const date=new Date(at);return `P-${String(date.getUTCMonth()+1).padStart(2,'0')}${String(date.getUTCDate()).padStart(2,'0')}-${randomBytes(2).toString('hex').toUpperCase()}`;};
export function requestSummaryRows(a,files=[]){
  return [a.oneThing&&`남길 것: ${a.oneThing}`,a.audience&&`보는 사람: ${a.audience}`,a.channels?.length&&`올릴 곳: ${a.channels.join(', ')}`,a.package&&`구성: ${a.package}`,`받은 자료: ${files.length}개`].filter(Boolean).join('\n');
}

export function createPulseRequests({store,clientProjects,clock=()=>new Date().toISOString(),freeBytes}){
  const directory=()=>resolve(store.directory,'pulse-request-media'),media=()=>resolve(store.directory,'studio-media');
  const inDraft=name=>{if(!/^[a-f0-9-]{36}\.(?:part|mp4|webm|png|jpg|intake)$/.test(name))throw fail('파일 경로를 확인해 주세요.',404);const path=resolve(directory(),name);if(dirname(path)!==directory())throw fail('파일 경로를 확인해 주세요.',404);return path;};
  const inMedia=name=>{if(!/^[a-f0-9-]{36}\.(?:upload|mp4|webm|png|jpg|intake)$/.test(name))throw fail('파일 경로를 확인해 주세요.',404);const path=resolve(media(),name);if(dirname(path)!==media())throw fail('파일 경로를 확인해 주세요.',404);return path;};
  const now=()=>Date.parse(clock());
  // 문턱 값은 메모리에 둔다(쓰기 서버 하나). 시작 · 접수 수는 기록을 세어 재시작에도 이어지고, 파일 바이트 수는 재시작하면 다시 센다 — 디스크 여유 검사가 마지막 방어다.
  const counters=new Map();
  function count(key,amount,max,windowMs){
    const stamp=now();for(const [name,row]of counters)if(row.until<=stamp)counters.delete(name);
    if(counters.size>5000)throw busy();
    const row=counters.get(key)||{until:stamp+windowMs,value:0};if(row.value+amount>max)throw busy();
    row.value+=amount;counters.set(key,row);
  }
  const recent=hours=>store.all(KIND).filter(row=>now()-Date.parse(row.createdAt)<hours*3600000);
  async function assertDisk(){
    const check=freeBytes||(async()=>{const info=await statfs(store.directory);return Number(info.bavail)*Number(info.bsize);});
    let free;try{free=await check();}catch{return;}
    // 5xx는 회사 서버가 글을 가리므로(현장 노트 배포_공개) 손님이 읽어야 할 안내는 4xx로 낸다.
    if(free<REQUEST_LIMITS.minimumFreeBytes)throw fail('지금은 파일을 받을 수 없어요. 드라이브 링크를 적어 주시거나 hello@synk.im으로 알려 주세요.',409);
  }
  function draftOf(raw,csrf,{write=false}={}){
    const auth=store.readToken(raw,TOKEN);let row=auth&&store.get(KIND,auth.body.requestId);
    if(!row||row.status==='removing')throw fail('이어 쓸 의뢰서를 찾지 못했어요. 처음부터 시작해 주세요.',401);
    // 보내다 서버가 멈춘 초안은 잠시 뒤 다시 쓸 수 있다.
    if(row.status==='sending'&&now()-Date.parse(row.sendingAt)>REQUEST_LIMITS.sendingMinutes*60000){const {sendingAt,sendingId,...rest}=row;row={...rest,status:'draft'};}
    // 보낸 뒤의 토큰은 응답을 못 받은 경우의 다시 보내기만 잠깐 허용한다.
    if(row.status==='submitted'&&now()-Date.parse(row.submittedAt)>REQUEST_LIMITS.resendMinutes*60000)throw fail('이미 보낸 의뢰서예요. 받은 링크로 열어 주세요.',401);
    if(write&&(typeof csrf!=='string'||csrf!==auth.body.csrf))throw fail('화면을 새로 고친 뒤 다시 시도해 주세요.',403);
    return {auth,row};
  }
  const fileView=file=>({id:file.id,slot:file.slot,fileName:file.fileName,mimeType:file.mimeType,byteSize:file.byteSize,inline:file.inline});
  const view=(row,auth)=>({id:row.id,status:row.status,step:row.step||'',answers:row.answers||emptyRequestAnswers(),files:(row.files||[]).map(fileView),csrf:auth?.body?.csrf,number:row.number||''});

  function start(input={},{client=''}={}){
    pruneDrafts().catch(()=>{});
    if(!object(input)||input.website)throw fail('의뢰서 요청을 확인해 주세요.');
    count('start:'+digest(client),1,REQUEST_LIMITS.startsPerHourByClient,3600000);
    if(recent(24).length>=REQUEST_LIMITS.startsPerDay)throw busy();
    const at=clock(),id=randomUUID(),csrf=randomBytes(24).toString('base64url');
    const row={id,revision:1,status:'draft',createdAt:at,updatedAt:at,step:'',answers:emptyRequestAnswers(),files:[],bytes:0};
    store.put(KIND,id,row);
    const token=store.mint(TOKEN,null,{requestId:id,csrf},REQUEST_LIMITS.tokenDays*1440);
    return {token,draft:view(row,{body:{csrf}})};
  }
  // 쓰던 의뢰서가 있는지 묻는 자리다. 없거나 기한이 지났으면 「없음」으로 답해 첫 손님의 콘솔에 오류가 남지 않게 한다.
  function read(raw){try{const {auth,row}=draftOf(raw);return {draft:view(row,auth)};}catch(error){if(error.status===401)return {draft:null};throw error;}}
  function save(raw,csrf,input,{client=''}={}){
    count('save:'+digest(client),1,REQUEST_LIMITS.savesPerHourByClient,3600000);
    return store.transaction(()=>{
      const {auth,row}=draftOf(raw,csrf,{write:true});
      if(row.status!=='draft')throw fail('이미 보낸 의뢰서예요.',409);
      if(!object(input)||Object.keys(input).some(key=>!['answers','step'].includes(key)))throw fail('의뢰서 입력 항목을 확인해 주세요.');
      const updated={...row,answers:normalizeRequestAnswers(input.answers),step:text(input.step,20),updatedAt:clock()};
      store.put(KIND,row.id,updated);
      return {draft:view(updated,auth)};
    });
  }
  // 파일 받기: 스트림으로 쓰면서 재고, 끝난 뒤 서명을 확인한다. 실패하면 조각을 남기지 않는다.
  async function receive(req,raw,csrf,{client=''}={}){
    const before=draftOf(raw,csrf,{write:true}).row;
    if(before.status!=='draft')throw fail('이미 보낸 의뢰서예요.',409);
    if(before.files.length>=REQUEST_LIMITS.filesPerDraft)throw fail('파일은 30개까지 보낼 수 있어요. 나머지는 드라이브 링크로 적어 주세요.',413);
    count('upload:'+digest(client),1,REQUEST_LIMITS.uploadsPerHourByClient,3600000);
    await assertDisk();
    const header=key=>{const value=req.headers[key];if(value==null)return '';try{return decodeURIComponent(value);}catch{throw fail('파일 이름을 확인해 주세요.');}};
    const fileName=text(header('x-file-name'),200),slot=one(header('x-request-slot'),REQUEST_SLOTS),mimeType=String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase();
    if(!fileName||!slot)throw fail('파일 정보를 확인해 주세요.');
    const kind=requestFileKind(mimeType,fileName),limit=kind.inline?REQUEST_LIMITS.fileBytes:REQUEST_LIMITS.attachmentBytes,tooBig=()=>fail(kind.inline?'파일은 100MB까지 받을 수 있어요. 더 크면 드라이브 링크로 적어 주세요.':'이 형식은 30MB까지 받을 수 있어요. 더 크면 드라이브 링크로 적어 주세요.',413);
    const declared=Number(req.headers['content-length']);if(declared>limit)throw tooBig();
    if(before.bytes+(declared||0)>REQUEST_LIMITS.bytesPerDraft)throw fail('파일이 많아요. 나머지는 드라이브 링크로 적어 주세요.',413);
    if(declared){count('bytes:'+digest(client),declared,REQUEST_LIMITS.uploadBytesPerDayByClient,86400000);count('bytes:all',declared,REQUEST_LIMITS.uploadBytesPerDay,86400000);}
    const id=randomUUID(),temporary=inDraft(id+'.part');
    await mkdir(directory(),{recursive:true,mode:0o700});
    const handle=await open(temporary,'wx',0o600),sha=createHash('sha256');let size=0,head=Buffer.alloc(0);
    try{
      for await(const chunk of req.iterator({destroyOnReturn:false})){
        size+=chunk.length;if(size>limit){req.resume();throw tooBig();}
        if(head.length<4096)head=Buffer.concat([head,chunk.subarray(0,4096-head.length)]);
        sha.update(chunk);let offset=0;while(offset<chunk.length){const {bytesWritten}=await handle.write(chunk,offset,chunk.length-offset);offset+=bytesWritten;}
      }
      await handle.close();
      if(!size||!validRequestFile(kind,mimeType,head))throw fail('파일 내용이 형식과 달라요. 다른 파일을 골라 주세요.',415);
      if(!declared){count('bytes:'+digest(client),size,REQUEST_LIMITS.uploadBytesPerDayByClient,86400000);count('bytes:all',size,REQUEST_LIMITS.uploadBytesPerDay,86400000);}
      const diskName=`${id}.${kind.extension}`,file={id,slot,diskName,fileName,mimeType:kind.inline?mimeType:'application/octet-stream',byteSize:size,sha256:sha.digest('hex'),inline:kind.inline,at:clock()};
      await rename(temporary,inDraft(diskName));
      try{
        return store.transaction(()=>{
          const {auth,row}=draftOf(raw,csrf,{write:true});
          if(row.status!=='draft')throw fail('이미 보낸 의뢰서예요.',409);
          if(row.files.length>=REQUEST_LIMITS.filesPerDraft||row.bytes+size>REQUEST_LIMITS.bytesPerDraft)throw fail('파일이 많아요. 나머지는 드라이브 링크로 적어 주세요.',413);
          const updated={...row,files:[...row.files,file],bytes:row.bytes+size,updatedAt:clock()};store.put(KIND,row.id,updated);
          return {file:fileView(file),draft:view(updated,auth)};
        });
      }catch(error){await unlink(inDraft(diskName)).catch(()=>{});throw error;}
    }catch(error){await handle.close().catch(()=>{});await unlink(temporary).catch(()=>{});throw error;}
  }
  async function removeFile(raw,csrf,fileId){
    const removed=store.transaction(()=>{
      const {row,auth}=draftOf(raw,csrf,{write:true});
      if(row.status!=='draft')throw fail('이미 보낸 의뢰서예요.',409);
      const file=row.files.find(item=>item.id===fileId);if(!file)throw fail('파일을 찾지 못했어요.',404);
      const updated={...row,files:row.files.filter(item=>item.id!==fileId),bytes:row.bytes-file.byteSize,updatedAt:clock()};store.put(KIND,row.id,updated);
      return {file,draft:view(updated,auth)};
    });
    await unlink(inDraft(removed.file.diskName)).catch(()=>{});
    // 앞서 보내다 실패했으면 프로젝트 쪽 폴더로 옮겨 가 있다(submit). 접수 전이라 어느 프로젝트도 가리키지 않는다.
    await unlink(inMedia(removed.file.diskName)).catch(()=>{});
    return {draft:removed.draft};
  }
  // 본인이 고르며 올린 사진을 다시 보여 줄 때. 화면에 바로 띄우는 형식만 내준다.
  function draftFilePath(raw,fileId){const {row}=draftOf(raw),file=(row.files||[]).find(item=>item.id===fileId);if(!file||!file.inline)throw fail('파일을 찾지 못했어요.',404);return {paths:[inDraft(file.diskName),inMedia(file.diskName)],file};}
  function newNumber(at){
    const date=new Date(at),day=`${String(date.getUTCMonth()+1).padStart(2,'0')}${String(date.getUTCDate()).padStart(2,'0')}`,used=new Set([...store.all(KIND).map(row=>row.number),...store.all('clientProjects').map(row=>row.studio?.request?.number)].filter(Boolean));
    for(let i=0;i<20;i++){const candidate=`P-${day}-${randomBytes(2).toString('hex').toUpperCase()}`;if(!used.has(candidate))return candidate;}
    throw busy();
  }
  async function submit(raw,csrf,input,{client=''}={}){
    const {row:peek}=draftOf(raw,csrf,{write:true});
    // 응답을 못 받고 다시 누른 경우(보낸 뒤 잠깐만): 원문 초대는 저장하지 않으므로 새로 발급해 같은 프로젝트로 잇는다.
    const again=row=>{const {invite,expiresAt}=clientProjects.reissueRequestInvite(row.projectId),opened=clientProjects.open(invite);return {number:row.number,at:row.submittedAt,projectId:row.projectId,invite,expiresAt,session:opened.session,csrf:opened.csrf,duplicate:true};};
    if(peek.status==='submitted')return store.transaction(()=>again(peek));
    if(!object(input)||Object.keys(input).some(key=>key!=='answers'))throw fail('의뢰서 입력 항목을 확인해 주세요.');
    const answers=normalizeRequestAnswers(input.answers,{strict:true});
    if(!answers.name)throw fail('제품이나 브랜드 이름을 알려 주세요.');
    if(!answers.contactName||!(answers.email||answers.phone))throw fail('성함과 연락받을 곳(이메일이나 휴대폰)을 알려 주세요.');
    if(!answers.consent||!answers.rights)throw fail('동의 칸을 확인해 주세요.');
    count('submit:'+digest(client),1,10,3600000);
    if(store.all(KIND).filter(row=>row.status==='submitted'&&now()-Date.parse(row.submittedAt)<86400000).length>=REQUEST_LIMITS.submitsPerDay)throw busy();
    // 보내는 동안에는 새 파일 · 저장을 받지 않는다. 기록하는 파일 목록이 잠근 때의 목록과 같아야 한다.
    const sending=store.transaction(()=>{
      const {row}=draftOf(raw,csrf,{write:true});
      if(row.status==='submitted')return row;
      if(row.status==='sending')throw fail('보내는 중이에요. 잠시 뒤 다시 확인해 주세요.',409);
      const at=clock(),locked={...row,status:'sending',sendingAt:at,sendingId:randomUUID(),updatedAt:at};store.put(KIND,row.id,locked);return locked;
    });
    if(sending.status==='submitted')return store.transaction(()=>again(sending));
    // 파일은 앞으로만 옮기고 되돌리지 않는다(옮기고 되돌리던 처음 설계는 잠금이 풀린 사이의 경쟁을 막지 못했다 — GPT 세 회차 · Fable 설계 검토).
    // 프로젝트 쪽 폴더의 파일은 프로젝트가 가리키기 전까지 아무 일도 하지 않고 백업에도 오르지 않는다. 어디서 실패하거나 서버가 멈춰도 파일은 두 폴더 중 한 곳에 그대로 있고,
    // 같은 요청을 다시 보내면 그대로 잇는다. 다시 보내지 않으면 14일 정리(pruneDrafts)나 파일 지우기(removeFile)가 두 폴더를 함께 지운다.
    try{
      await mkdir(media(),{recursive:true,mode:0o700});
      for(const file of sending.files){
        const source=inDraft(file.diskName),target=inMedia(file.diskName);
        try{await rename(source,target);}catch(error){if(error.code!=='ENOENT')throw error;if(!await stat(target).catch(()=>null))throw fail(`「${file.fileName}」 파일을 찾지 못했어요. 지우고 다시 올려 주세요.`,409);}
      }
      return store.transaction(()=>{
        const {row}=draftOf(raw,csrf,{write:true}),held=store.get(KIND,sending.id);
        // 늦게 끝난 보내기: 다른 보내기가 이미 접수했다. 여기서 새 초대를 만들면 손님이 쓰고 있는 세션이 끊긴다.
        if(held?.status==='submitted')throw fail('이미 보낸 의뢰서예요. 받은 링크로 열어 주세요.',409);
        // 옮기는 일이 2분을 넘기면 잠금이 풀린다. 그 사이 손님이 저장하거나 파일을 더했거나 다른 보내기가 잠금을 가져갔으면 잠근 때의 목록을 기록하면 안 되니 여기서 멈춘다.
        if(held?.status!=='sending'||held.sendingId!==sending.sendingId)throw fail('보내는 동안 내용이 바뀌었어요. 다시 보내 주세요.',409);
        const at=clock(),no=newNumber(at),files=sending.files;
        const assets=files.filter(file=>file.inline).map(file=>({id:file.id,diskName:file.diskName,fileName:file.fileName,mimeType:file.mimeType,byteSize:file.byteSize,slot:file.slot,author:'customer',authorId:'customer',authorName:answers.contactName,at:file.at}));
        const attachments=files.filter(file=>!file.inline).map(file=>({id:file.id,diskName:file.diskName,fileName:file.fileName,byteSize:file.byteSize,mimeType:file.mimeType,sha256:file.sha256,kind:'attachment',slot:file.slot}));
        const {consent,rights,...kept}=answers;
        const request={schemaVersion:1,number:no,status:'submitted',submittedAt:at,consentAt:at,answers:kept,files:files.map(fileView),asks:[],notes:[],rounds:[]};
        const studio={...emptyPulseStudio(),assets,request};
        const contact=[answers.contactName,answers.email,answers.phone].filter(Boolean).join(' · ').slice(0,300);
        const {project,invite,expiresAt}=clientProjects.createFromRequest({title:answers.name,customerName:answers.company||answers.contactName,contact,summary:requestSummaryRows(answers,files),studio,attachments});
        const opened=clientProjects.open(invite);
        store.put(KIND,row.id,{id:row.id,status:'submitted',createdAt:row.createdAt,submittedAt:at,updatedAt:at,files:[],bytes:0,projectId:project.id,number:no});
        return {number:no,at,projectId:project.id,invite,expiresAt,session:opened.session,csrf:opened.csrf};
      });
    }catch(error){
      store.transaction(()=>{const current=store.get(KIND,sending.id);if(current?.status==='sending'&&current.sendingId===sending.sendingId){const {sendingAt,sendingId,...rest}=current;store.put(KIND,sending.id,{...rest,status:'draft'});}});
      throw error;
    }
  }
  // 14일 안 건드린 초안을 지운다. 공개 요청에서 돌아도 되는 유일한 정리다(남의 프로젝트에 닿지 않는다).
  async function pruneDrafts(){
    const stamp=now(),stale=row=>row?.status==='removing'||['draft','sending'].includes(row?.status)&&stamp-Date.parse(row.updatedAt||row.createdAt)>REQUEST_LIMITS.draftDays*86400000;
    for(const {id} of store.all(KIND).filter(stale)){
      // 지우기 직전에 다시 보고 표시부터 한다(표시한 뒤로는 손님이 쓸 수 없다). 그 사이 손님이 저장했으면 그대로 둔다. 파일을 지운 뒤에 기록을 지우므로, 사이에 서버가 멈춰도 다음 정리가 잇는다.
      const marked=store.transaction(()=>{const row=store.get(KIND,id);if(!stale(row))return null;const next={...row,status:'removing'};store.put(KIND,id,next);return next;});
      if(!marked)continue;
      // 보내다 멈춘 초안의 파일은 프로젝트 쪽 폴더로 옮겨 가 있을 수 있다. 접수되지 않았으니 어느 프로젝트도 가리키지 않는다.
      for(const file of marked.files||[]){await unlink(inDraft(file.diskName)).catch(()=>{});await unlink(inMedia(file.diskName)).catch(()=>{});}
      store.remove(KIND,id);
    }
    // 파일을 지우거나 올리는 도중에 서버가 멈추면 파일만 남는다. 어느 초안도 가리키지 않고 하루 넘게 그대로인 파일을 지운다.
    const kept=new Set(store.all(KIND).flatMap(row=>(row.files||[]).map(file=>file.diskName)));
    for(const name of await readdir(directory()).catch(()=>[])){
      if(kept.has(name))continue;
      let file;try{file=inDraft(name);}catch{continue;}
      const info=await stat(file).catch(()=>null);
      if(info&&stamp-info.mtimeMs>86400000)await unlink(file).catch(()=>{});
    }
  }
  // 동의 문구의 약속: 접수 뒤 90일 동안 아무 움직임이 없고 제작으로 이어지지 않은 의뢰는 연락처 · 답 · 파일을 지우고 보관으로 돌린다.
  // 유지보수 예약에서만 돈다(익명 요청이 방아쇠가 되면 안 된다). 움직임 하나라도 있으면 그때부터 다시 잰다.
  async function retireUnconfirmed(){
    const stamp=now(),cutoff=REQUEST_LIMITS.unconfirmedDays*86400000;let retired=0;
    for(const row of store.all(KIND)){
      if(row.status!=='submitted')continue;
      const project=row.projectId&&store.get('clientProjects',row.projectId);
      if(!project){if(stamp-Date.parse(row.submittedAt)>cutoff)store.remove(KIND,row.id);continue;}
      if(stamp-Date.parse(project.updatedAt)<=cutoff)continue;
      if(project.studio?.request?.confirmedAt||project.stage!=='received'){store.remove(KIND,row.id);continue;}
      const files=clientProjects.retireRequest(project.id,{...emptyPulseStudio(),request:{schemaVersion:1,number:row.number||'',status:'retired',retiredAt:clock(),answers:{},files:[],asks:[],notes:[],rounds:[]}});
      for(const file of files)await unlink(inMedia(file.diskName)).catch(()=>{});
      store.remove(KIND,row.id);retired++;
    }
    return {retired};
  }
  // 접수 뒤 손님이 더 보내는 파일(되묻기 답 · 자료 더 보내기 · 담당자가 만든 프로젝트의 의뢰서). 받는 형식과 문턱은 초안과 같고, 자리는 처음부터 백업되는 폴더다.
  async function receiveProjectFile(req,{session,client=''}){
    const before=session();
    if(before.row.stage==='archived')throw fail('보관된 프로젝트예요.',409);
    if((before.row.studio?.request?.files||[]).length>=REQUEST_LIMITS.filesPerDraft*2)throw fail('파일이 많아요. 나머지는 드라이브 링크로 알려 주세요.',413);
    count('upload:'+digest(client),1,REQUEST_LIMITS.uploadsPerHourByClient,3600000);
    await assertDisk();
    const header=key=>{const value=req.headers[key];if(value==null)return '';try{return decodeURIComponent(value);}catch{throw fail('파일 이름을 확인해 주세요.');}};
    const fileName=text(header('x-file-name'),200),slot=one(header('x-request-slot'),REQUEST_SLOTS)||'etc',mimeType=String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase();
    if(!fileName)throw fail('파일 정보를 확인해 주세요.');
    const kind=requestFileKind(mimeType,fileName),limit=kind.inline?REQUEST_LIMITS.fileBytes:REQUEST_LIMITS.attachmentBytes,tooBig=()=>fail(kind.inline?'파일은 100MB까지 받을 수 있어요. 더 크면 드라이브 링크로 알려 주세요.':'이 형식은 30MB까지 받을 수 있어요. 더 크면 드라이브 링크로 알려 주세요.',413);
    const declared=Number(req.headers['content-length']);if(declared>limit)throw tooBig();
    if(declared){count('bytes:'+digest(client),declared,REQUEST_LIMITS.uploadBytesPerDayByClient,86400000);count('bytes:all',declared,REQUEST_LIMITS.uploadBytesPerDay,86400000);}
    const id=randomUUID(),temporary=inMedia(id+'.upload');
    await mkdir(media(),{recursive:true,mode:0o700});
    const handle=await open(temporary,'wx',0o600),sha=createHash('sha256');let size=0,head=Buffer.alloc(0);
    try{
      for await(const chunk of req.iterator({destroyOnReturn:false})){
        size+=chunk.length;if(size>limit){req.resume();throw tooBig();}
        if(head.length<4096)head=Buffer.concat([head,chunk.subarray(0,4096-head.length)]);
        sha.update(chunk);let offset=0;while(offset<chunk.length){const {bytesWritten}=await handle.write(chunk,offset,chunk.length-offset);offset+=bytesWritten;}
      }
      await handle.close();
      if(!size||!validRequestFile(kind,mimeType,head))throw fail('파일 내용이 형식과 달라요. 다른 파일을 골라 주세요.',415);
      if(!declared){count('bytes:'+digest(client),size,REQUEST_LIMITS.uploadBytesPerDayByClient,86400000);count('bytes:all',size,REQUEST_LIMITS.uploadBytesPerDay,86400000);}
      const diskName=`${id}.${kind.extension}`;
      await rename(temporary,inMedia(diskName));
      return {id,slot,diskName,fileName,mimeType:kind.inline?mimeType:'application/octet-stream',byteSize:size,sha256:sha.digest('hex'),inline:kind.inline,at:clock()};
    }catch(error){await handle.close().catch(()=>{});await unlink(temporary).catch(()=>{});throw error;}
  }
  const discardProjectFile=async file=>{await unlink(inMedia(file.diskName)).catch(()=>{});};
  return {start,read,save,receive,removeFile,draftFilePath,submit,pruneDrafts,retireUnconfirmed,receiveProjectFile,discardProjectFile,limits:REQUEST_LIMITS};
}
export async function streamDraftFile(res,{paths,file},req){
  let path,info;
  for(path of paths){info=await stat(path).catch(()=>null);if(info)break;}
  if(!info)throw fail('파일을 찾지 못했어요.',404);
  res.writeHead(200,{'Content-Type':file.mimeType,'Content-Length':info.size,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cross-Origin-Resource-Policy':'same-origin','Content-Security-Policy':"default-src 'none'; sandbox"});
  if(req.method==='HEAD')return res.end();
  await pipeline(createReadStream(path),res);
}

// ── 프로젝트 안의 의뢰서 액션(pulse-studio의 mutate 확장 — 다른 액션과 같은 트랜잭션 · 판 검사를 탄다) ──
const FIELDS={
  request_note:['note'],request_ask:['items'],request_confirm:[],propose_model:['modelId','note'],send_draft:['oneLine','note'],
  request_answer:['askId','text','fileId'],answer_model:['accept','modelId','note'],request_save:['answers'],request_submit:['answers'],submit_draft_review:['round','items'],approve_draft:['round'],
};
export const requestActions=action=>Object.hasOwn(FIELDS,action)?FIELDS[action]:undefined;
const STAFF_ONLY=['request_note','request_ask','request_confirm','propose_model','send_draft'],CUSTOMER_ONLY=['request_answer','answer_model','request_save','request_submit','submit_draft_review','approve_draft'];
export function applyRequestAction({studio,row,input,staff,stamp}){
  const action=input.action,now=stamp.at;
  if(STAFF_ONLY.includes(action)&&!staff)throw fail('담당자 화면에서만 할 수 있어요.',403);
  if(CUSTOMER_ONLY.includes(action)&&staff)throw fail('고객 화면에서만 할 수 있어요.',403);
  const request=studio.request||{schemaVersion:1,number:'',status:'writing',answers:emptyRequestAnswers(),files:[],asks:[],notes:[],rounds:[]};
  if(action==='request_save'||action==='request_submit'){
    if(request.status==='confirmed'||request.confirmedAt)throw fail('확인이 끝난 의뢰서예요. 바꿀 내용은 담당자에게 알려 주세요.',409);
    const strict=action==='request_submit',answers=normalizeRequestAnswers(input.answers,{strict}),{consent,rights,...kept}=answers;
    if(strict&&!(consent&&rights))throw fail('동의 칸을 확인해 주세요.');
    studio.request={...request,answers:kept,...(strict?{status:'submitted',number:request.number||requestNumber(now),submittedAt:request.submittedAt||now,consentAt:now}:{}),updatedAt:now};
    return;
  }
  if(!studio.request)throw fail('의뢰서가 아직 없어요.',409);
  if(action==='request_note'){
    if(!object(input.note)||Object.keys(input.note).some(key=>!['summary','lines','model','ref','risks','by'].includes(key)))throw fail('메모 항목을 확인해 주세요.');
    const note={id:randomUUID(),at:now,by:text(input.note.by,40)||stamp.authorName,summary:text(input.note.summary,1000),lines:many(input.note.lines,null,5,200),model:text(input.note.model,300),ref:text(input.note.ref,500),risks:many(input.note.risks,null,8,300)};
    studio.request={...request,notes:[...request.notes,note].slice(-20)};
    return;
  }
  if(action==='request_ask'){
    if(!Array.isArray(input.items)||!input.items.length||input.items.length>8)throw fail('물어볼 것을 확인해 주세요.');
    const items=input.items.map(item=>{if(!object(item))throw fail('물어볼 것을 확인해 주세요.');const label=text(item.label,120);if(!label)throw fail('물어볼 것을 적어 주세요.');return {id:randomUUID(),label,why:text(item.why,300),status:'open',at:now};});
    // 확인을 마친 뒤에 더 물어도 「확인 끝」은 지우지 않는다(고객 방은 열린 물음을 먼저 보인다).
    studio.request={...request,status:request.confirmedAt?request.status:'asking',asks:[...request.asks,...items].slice(-40)};
    return;
  }
  if(action==='request_answer'){
    const ask=request.asks.find(item=>item.id===input.askId);if(!ask||ask.status!=='open')throw fail('이 질문이 바뀌었어요. 최신 내용을 불러와 주세요.',409);
    const value=text(input.text,1000),fileId=input.fileId?text(input.fileId,40):'';
    const file=fileId?(request.files||[]).find(item=>item.id===fileId):null;if(fileId&&!file)throw fail('올린 파일을 찾지 못했어요.',404);
    if(!value&&!fileId)throw fail('답이나 파일을 보내 주세요.');
    const asks=request.asks.map(item=>item.id===ask.id?{...item,status:'answered',answer:value,fileId,fileName:file?.fileName||'',answeredAt:now}:item);
    studio.request={...request,asks,status:request.confirmedAt?request.status:asks.some(item=>item.status==='open')?'asking':'submitted'};
    return;
  }
  if(action==='request_confirm'){
    if(request.status==='confirmed')throw fail('이미 확인했어요.',409);
    studio.request={...request,status:'confirmed',confirmedAt:now,confirmedBy:stamp.authorName};
    studio.strategy=carryToStrategy(studio.strategy,studio.request.answers,stamp);
    return;
  }
  // 영상 전 세 번 확인의 첫 번째: 모델을 손님이 고르지 않았으면 먼저 제안해 확인받는다(장면을 굽고 나서 모델이 바뀌지 않게).
  if(action==='propose_model'){
    const modelId=one(input.modelId,MODEL_IDS);if(!modelId)throw fail('제안할 모델을 골라 주세요.');
    studio.request={...request,modelProposal:{modelId,note:text(input.note,300),at:now,by:stamp.authorName,status:'open'}};
    return;
  }
  if(action==='answer_model'){
    const proposal=request.modelProposal;
    const picked=input.modelId?one(input.modelId,MODEL_IDS):'';
    if(input.accept!==true&&!picked&&!text(input.note,300))throw fail('진행할 모델을 고르거나 바라는 점을 적어 주세요.');
    const modelId=picked||(input.accept===true?proposal?.modelId:'');
    studio.request={...request,answers:{...request.answers,...(modelId?{models:[modelId],modelChoice:''}:{})},modelProposal:{...(proposal||{}),status:modelId?'accepted':'declined',answer:text(input.note,300),answeredAt:now,...(modelId?{modelId}:{})}};
    // 확인 끝 뒤에 정해진 모델은 제작 설계에도 옮긴다(확인 때 옮긴 값을 고객이 바꿀 수 있다).
    if(modelId&&request.confirmedAt)studio.strategy=strategyWith(studio.strategy,{...studio.strategy.data,castingSelection:{...studio.strategy.data?.castingSelection,modelId}},stamp);
    return;
  }
  if(action==='send_draft'){
    if(request.status!=='confirmed')throw fail('의뢰서 확인을 먼저 끝내 주세요.',409);
    const answers=request.answers||{},modelReady=answers.models?.length||answers.modelChoice==='none'||request.modelProposal?.status==='accepted';
    if(!modelReady)throw fail('모델을 먼저 제안해 확인받아 주세요.',409);
    const scenes=studio.scenes.filter(scene=>scene.visibility==='customer');
    if(!scenes.length)throw fail('고객에게 보이는 장면을 먼저 준비해 주세요.',409);
    const oneLine=text(input.oneLine,300)||studio.strategy?.data?.primaryPromise||'';if(!oneLine)throw fail('이 광고가 남길 한 문장을 적어 주세요.');
    // 그림이 빠진 컷이 있으면 글 콘티 판이고, 모든 컷에 장면 이미지가 있어야 제작을 시작할 수 있는 판이다.
    const kind=scenes.every(scene=>scene.assetId||scene.imageUrl)?'images':'script';
    const round={round:request.rounds.length+1,kind,oneLine,note:text(input.note,600),sentAt:now,by:stamp.authorName,scenes:scenes.map(scene=>({id:scene.id,revision:scene.revision}))};
    studio.request={...request,rounds:[...request.rounds,round]};
    return;
  }
  const round=request.rounds.at(-1);
  if(!round||input.round!==round.round)throw fail('새 판이 도착했어요. 최신 내용을 불러와 주세요.',409);
  if(action==='submit_draft_review'){
    if(round.approvedAt)throw fail('이미 확인한 판이에요.',409);
    if(round.feedbackAt)throw fail('이 판의 의견은 이미 보내셨어요. 반영한 판을 곧 보내 드려요.',409);
    if(!Array.isArray(input.items)||!input.items.length||input.items.length>60)throw fail('의견을 확인해 주세요.');
    if(studio.sceneReviews.length+input.items.length>240)throw fail('이 프로젝트의 기록이 가득 찼어요. 담당자에게 알려 주세요.',409);
    const items=input.items.map(item=>{if(!object(item)||!['confirmed','changes'].includes(item.status))throw fail('의견을 확인해 주세요.');const ref=round.scenes.find(value=>value.id===item.sceneId);if(!ref)throw fail('이 판에 없는 컷이에요.',404);const note=text(item.text,1000);if(item.status==='changes'&&!note)throw fail('고칠 내용을 적어 주세요.');return {ref,status:item.status,text:note};});
    for(const item of items){
      const scene=studio.scenes.find(value=>value.id===item.ref.id),review={id:randomUUID(),sceneId:item.ref.id,sceneRevision:item.ref.revision,title:scene?.title||'',status:item.status,text:item.text,...stamp,author:'customer',round:round.round};
      studio.sceneReviews.push(review);
      row.sceneRequestWorkflows=recordSceneReview({...row,studio},review,{at:now})||row.sceneRequestWorkflows;
    }
    studio.request={...request,rounds:request.rounds.map(value=>value.round===round.round?{...value,feedbackAt:now,changes:items.filter(item=>item.status==='changes').length}:value)};
    return;
  }
  if(action==='approve_draft'){
    if(round.approvedAt)throw fail('이미 확인한 판이에요.',409);
    if(round.feedbackAt&&round.changes)throw fail('보내 주신 의견을 반영한 판을 곧 보내 드려요. 그 판에서 확인해 주세요.',409);
    const rounds=request.rounds.map(value=>value.round===round.round?{...value,approvedAt:now,approvedBy:stamp.authorName}:value);
    if(round.kind==='script'){studio.request={...request,rounds,scriptApprovedAt:now};return;}
    studio.request={...request,rounds,approvedRound:round.round,approvedAt:now};
    if(['received','planning'].includes(row.stage)){row.stage='producing';row.closeoutWorkRevision=(row.closeoutWorkRevision||0)+1;}
    return;
  }
  throw fail('의뢰서 요청을 확인해 주세요.');
}
// 확인이 끝나면 답을 제작 설계 칸으로 옮겨 담는다(직원 도구가 그대로 쓰게). 이미 저장한 칸은 덮지 않는다.
// 제작 설계에 칸이 없는 것(무엇으로 이길지 · 참고 광고 · 드라이브 · 쓰는 법 등)은 메모 칸에 줄로 남겨 옮겨 적는 일이 없게 한다.
const CHANNEL_MAP={shorts:['instagram','tiktok','youtube'],youtube:['youtube','website'],store:['website'],screen:['offline']};
const PACKAGE_SECONDS={s15:15,s30:30,s60:60,corp:30};
const OBJECTIVE={buy:'sales',install:'sales',visit:'sales',ask:'sales',remember:'brand'};
const WIN_LABEL={story:'이야기로 여운을',impact:'한 장면의 임팩트로',ask:'맡김'};
export function carryToStrategy(strategy,a,stamp){
  const data={...strategy.data},put=(key,value)=>{if(value&&(data[key]===undefined||data[key]===''||data[key]===null||Array.isArray(data[key])&&!data[key].length))data[key]=value;};
  put('product',a.name);put('audience',a.audience);put('primaryPromise',a.oneThing);put('evidence1',a.facts);
  put('desiredAction',{buy:'제품 페이지에서 사기',install:'앱 설치하기',visit:'찾아오기',ask:'문의하기',remember:'브랜드를 기억하기'}[a.action]||'');
  put('objective',OBJECTIVE[a.action]||'');put('channels',[...new Set((a.channels||[]).flatMap(id=>CHANNEL_MAP[id]||[]))]);
  put('aspectRatio',a.channels?.length>1?'multiple':{shorts:'9:16',youtube:'16:9',store:'1:1',screen:'16:9'}[a.channels?.[0]]||'');
  put('durationSeconds',PACKAGE_SECONDS[a.package]||null);put('distribution',a.paid?'paid':'');
  put('screenCopy',a.screenText);put('destinationUrl',/^https:\/\//.test(a.pageUrl||'')?a.pageUrl:'');put('proposedDeadline',a.date);
  const refs=(a.refs||[]).map(ref=>[ref.url,(ref.points||[]).join(', '),ref.why].filter(Boolean).join(' — ')).filter(Boolean);
  const lines=[a.win&&`무엇으로 이길지: ${WIN_LABEL[a.win]}`,refs.length&&`참고 광고: ${refs.join(' / ')}`,a.avoidFeel&&`피할 느낌: ${a.avoidFeel}`,[...(a.avoid||[]),a.avoidNote].filter(Boolean).length&&`피할 말: ${[...(a.avoid||[]),a.avoidNote].filter(Boolean).join(', ')}`,a.models?.[1]&&`함께 고민 중인 모델: ${a.models[1]}`,a.size&&`크기: ${a.size}`,a.useNote&&`쓰는 법: ${a.useNote}`,a.driveUrl&&`드라이브: ${a.driveUrl}`,a.approver==='many'&&`여러 명이 확인${a.approverName?` · 최종 ${a.approverName}`:''}`].filter(Boolean);
  put('notes',lines.join('\n').slice(0,3000));
  const casting={...data.castingSelection};if(a.models?.[0]&&!casting.modelId)casting.modelId=a.models[0];data.castingSelection=casting;
  return strategyWith(strategy,data,stamp);
}
function strategyWith(strategy,data,stamp){
  if(JSON.stringify(data)===JSON.stringify(strategy.data))return strategy;
  const history=strategy.revision>0?[...strategy.history,{revision:strategy.revision,data:strategy.data,request:strategy.request,confirmation:strategy.confirmation,updatedAt:strategy.updatedAt,author:strategy.author,authorName:strategy.authorName}].slice(-20):strategy.history;
  return {...strategy,revision:strategy.revision+1,data,history,updatedAt:stamp.at,author:stamp.author,authorName:stamp.authorName,authorId:stamp.authorId};
}
export function requestView(studio,{staff=false}={}){
  const request=studio.request;if(!request)return null;
  const {notes,...safe}=request;
  return staff?{...safe,notes:notes||[]}:safe;
}
