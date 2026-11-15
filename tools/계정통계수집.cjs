#!/usr/bin/env node
'use strict';
/* 계정 통계 수집(2026-11-14) — AI 없는 하루 두 번 읽기 전용 수집의 올리기 단계. 이 기록은 API 연결이 아니다.
 *   node tools/계정통계수집.cjs [--입력 <manifest.json>] [--실행] [--json]
 * 기본은 미리 보기다: 목록·증거 파일·봉투를 서버와 같은 규칙(external-observations.mjs의 record)으로 메모리에서만 검사한다.
 *   자격을 읽거나 로그인·요청하지 않고 파일도 쓰지 않는다.
 * 목록(기본 ~/.synk/account-metrics/manifest.json, git 작업본 안이면 멈춘다 — 저장소는 공개) {version:1, batches:[{accountId, evidenceFile, envelope}]} 50묶음까지.
 *   evidenceFile: 목록 폴더 안의 1바이트~10MiB 파일(.. · 절대 경로 · 연결로 밖을 가리키면 거절). 이 도구가 쓰는 자리(receipts/ · 잠금 폴더 · 실행 기록)의 파일도 거절한다.
 *   envelope.evidenceSha256(필수, 소문자 64자리)은 봉투를 만들 때 읽은 증거 바이트의 SHA-256이다. 실제 파일과 정확히 같아야 하고, 없거나 null이면 지금 파일 해시로 채우지 않고 거절한다.
 *   envelope: POST /api/channels/:id/external-observations 본문(tools/lib/외부통계파싱.cjs가 만든다). observedAt은 캡처 시각 그대로 — 지금 시각으로 채우지 않는다.
 * --실행일 때만: 목록 폴더에 잠금 폴더를 만들고(있으면 멈춤 · 낡은 잠금도 저절로 지우지 않음) tools/작업실예약.js connect로 https://workspace.synk.im 에 들어가
 *   GET /api/state 한 번 → 묶음마다 원장 계정에 짝지어진 운영 채널이 꼭 하나이고 쓸 수 있을 때만 POST 한 번. 채널 등록·연결·자격·게시·메시지·삭제는 하지 않는다.
 *   영수증이 있어도 요청을 건너뛰지 않는다 — 같은 증거를 다시 보내면 서버가 증거 해시로 같은 기록을 돌려주고(늘지 않음), 값이 다르면 409로 앞 기록을 지킨다.
 *   영수증 <목록 폴더>/receipts/<해시>.json은 성공(created·existing)만 적는다(상태만, 수치 없음). 실패·거절·보내지 못함·로컬 거절은 영수증을 바꾸지 않고
 *   보고와 실행 기록 ~/.synk/account-metrics/수집기록.jsonl에만 남는다(앞선 성공 증거를 덮지 않음). 원본 통계는 저장소 밖에만 둔다.
 *   영수증 폴더가 목록 폴더 바로 아래의 진짜 폴더가 아니면(연결·바로가기) 쓰지 않고, 그 자리에 이 도구가 쓴 같은 증거·계정·채널·관측의 성공 영수증(v2, 또는 앞 판 v1)이 아닌 파일이 있으면 덮지 않는다.
 *   앞 판 v1 성공 영수증(v2와 같은 14칸)은 다시 성공하면 그 첫 성공 시각(firstRecordedAt)을 그대로 이어 v2로 옮기고, 실패 회차에는 그대로 둔다. 앞 판이 남긴 실패 기록은 성공으로 치지 않고 덮지도 않는다.
 *   직접 로그인한 세션은 끝에 늘 로그아웃한다(SYNK_WORKSPACE_SESSION으로 받은 세션은 남의 것이라 두고 간다). 로그아웃이 실패하면 영수증은 그대로 두고 실행 미완료(complete:false)로 보고한다.
 * 끝 코드: 0 모두 정상 · 1 거절·실패 묶음 있음 · 2 목록·인자 오류 · 3 잠금 있음 · 4 묶음은 모두 정상이지만 직접 연 세션의 로그아웃 실패(실행 미완료).
 */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');

const ORIGIN='https://workspace.synk.im';
const HOME_DIR=path.join(os.homedir(),'.synk','account-metrics');
const DEFAULT_MANIFEST=path.join(HOME_DIR,'manifest.json');
const LOG_FILE='수집기록.jsonl',LOCK_NAME='.계정통계수집.lock';
const LIMITS=Object.freeze({evidenceBytes:10*1024*1024,manifestBytes:12*1024*1024,batches:50,rows:200});
const COMPANY=path.join(__dirname,'..','docs','마케팅','온라인마케팅지도','engagement','company');
const SUCCESS=Object.freeze(['created','existing']);

const problem=(code,message)=>Object.assign(new Error(message),{code});
const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const inside=(root,target)=>{const rel=path.relative(root,target);return !!rel&&rel!=='..'&&!rel.startsWith('..'+path.sep)&&!path.isAbsolute(rel);};
const sameOrInside=(root,target)=>!path.relative(root,target)||inside(root,target);
const realOr=at=>{try{return fs.realpathSync(at);}catch{return at;}};

let loaded=null;
async function serverRules(){
  if(!loaded){
    const load=name=>import(pathToFileURL(path.join(COMPANY,name)).href);
    const [catalog,external]=await Promise.all([load('account-catalog.mjs'),load('external-observations.mjs')]);
    loaded={...catalog,...external};
  }
  return loaded;
}
function insideGit(dir){
  for(let at=dir;;at=path.dirname(at)){if(fs.existsSync(path.join(at,'.git')))return true;if(path.dirname(at)===at)return false;}
}
function readManifest(manifestPath){
  let file;
  try{file=fs.realpathSync(path.resolve(String(manifestPath)));}catch{throw problem('MANIFEST',`목록 파일이 없어요: ${manifestPath}`);}
  const stat=fs.statSync(file),dir=path.dirname(file);
  if(!stat.isFile()||stat.size>LIMITS.manifestBytes)throw problem('MANIFEST','목록은 12MiB까지의 보통 파일이어야 해요.');
  if(insideGit(dir))throw problem('MANIFEST_IN_REPO','원본 통계는 저장소 밖에 둬요. 목록 폴더가 git 작업본 안이에요(이 저장소는 공개).');
  let manifest;
  try{const text=fs.readFileSync(file,'utf8');manifest=JSON.parse(text.charCodeAt(0)===0xfeff?text.slice(1):text);}catch{throw problem('MANIFEST','목록이 JSON이 아니에요.');}
  if(!plain(manifest)||manifest.version!==1||Object.keys(manifest).some(key=>!['version','batches'].includes(key))||!Array.isArray(manifest.batches)||!manifest.batches.length||manifest.batches.length>LIMITS.batches)
    throw problem('MANIFEST',`목록은 {version:1, batches:[1~${LIMITS.batches}묶음]}이어야 해요.`);
  return {file,dir,batches:manifest.batches};
}
// 이 도구가 쓰는 자리(영수증 폴더·잠금 폴더 — 연결이면 그 실제 위치까지 — 와 실행 기록)는 증거로 받지 않는다. 입력과 출력을 나눠 영수증 쓰기가 원본 증거를 덮거나 바꾸지 않게 한다.
function outputArea(manifest,real){
  const dirs=['receipts',LOCK_NAME].map(name=>path.join(manifest.dir,name));
  if(dirs.some(at=>sameOrInside(at,real)||sameOrInside(realOr(at),real)))return true;
  return !!manifest.logFile&&!path.relative(realOr(manifest.logFile),real);
}
// 증거 파일 한 개를 열어 SHA-256을 낸다. 목록 폴더 밖(.. · 절대 경로 · 연결)과 이 도구가 쓰는 자리는 읽기 전에 거절한다.
function evidenceHash(manifest,relative){
  if(typeof relative!=='string'||!relative||relative.length>300||relative.includes(String.fromCharCode(0))||relative.includes(':')||path.isAbsolute(relative))
    throw problem('EVIDENCE_PATH','증거 파일은 목록 폴더 기준 상대 경로로 적어 주세요.');
  const resolved=path.resolve(manifest.dir,relative);
  if(!inside(manifest.dir,resolved))throw problem('EVIDENCE_PATH','증거 파일이 목록 폴더 밖이에요.');
  let real;
  try{real=fs.realpathSync(resolved);}catch{throw problem('EVIDENCE_MISSING','증거 파일이 없어요.');}
  if(!inside(manifest.dir,real)||real===manifest.file)throw problem('EVIDENCE_PATH','증거 파일이 연결·바로가기로 목록 폴더 밖을 가리켜요.');
  if(outputArea(manifest,real))throw problem('EVIDENCE_PATH','증거 파일이 이 도구가 쓰는 자리(receipts · 잠금 폴더 · 실행 기록)에 있어요. 영수증 쓰기가 원본을 덮지 않게 다른 곳에 두세요.');
  const fd=fs.openSync(real,'r');
  try{
    const stat=fs.fstatSync(fd);
    if(!stat.isFile()||stat.size<1||stat.size>LIMITS.evidenceBytes)throw problem('EVIDENCE_SIZE','증거 파일은 1바이트~10MiB 보통 파일이어야 해요.');
    const bytes=Buffer.alloc(stat.size);
    let read=0;
    while(read<bytes.length){const n=fs.readSync(fd,bytes,read,bytes.length-read,read);if(!n)break;read+=n;}
    if(read!==stat.size)throw problem('EVIDENCE_SIZE','증거 파일을 읽는 동안 크기가 바뀌었어요.');
    return crypto.createHash('sha256').update(bytes).digest('hex');
  }finally{fs.closeSync(fd);}
}
function memoryStore(channel){
  const kinds=new Map([['channels',new Map([[channel.id,channel]])]]);
  const bag=kind=>{if(!kinds.has(kind))kinds.set(kind,new Map());return kinds.get(kind);};
  return {get:(kind,id)=>bag(kind).get(id)??null,put:(kind,id,value)=>{bag(kind).set(id,value);},all:kind=>[...bag(kind).values()],transaction:fn=>fn()};
}
async function checkBatch(batch,index,manifest,now){
  const row={index:index+1,accountId:plain(batch)&&typeof batch.accountId==='string'?batch.accountId:null,evidenceSha256:null,observedAt:null,rows:0,status:'ready',code:null};
  try{
    if(!plain(batch)||Object.keys(batch).some(key=>!['accountId','evidenceFile','envelope'].includes(key))||!/^[a-z0-9][a-z0-9-]{0,79}$/.test(row.accountId||'')||!plain(batch.envelope))
      throw problem('BATCH','묶음은 accountId·evidenceFile·envelope 세 칸이에요.');
    const envelope=batch.envelope;
    row.evidenceSha256=evidenceHash(manifest,batch.evidenceFile);
    // 봉투의 증거 해시는 봉투를 만들 때 읽은 바이트의 값이어야 한다. 비었으면 지금 파일 해시로 채우지 않는다(그 사이 바뀐 파일을 오래된 수치와 묶지 않게).
    if(typeof envelope.evidenceSha256!=='string'||!/^[0-9a-f]{64}$/.test(envelope.evidenceSha256))
      throw problem('EVIDENCE_HASH_MISSING','봉투에 증거 해시(evidenceSha256, 소문자 64자리)가 없어요. 봉투를 만들 때 읽은 증거 파일의 SHA-256을 넣어 주세요 — 지금 파일 해시로 채우지 않아요.');
    if(envelope.evidenceSha256!==row.evidenceSha256)
      throw problem('EVIDENCE_HASH','봉투에 적힌 증거 해시가 증거 파일과 달라요. 봉투를 만든 뒤 파일이 바뀌었을 수 있어요.');
    if(typeof envelope.observedAt!=='string'||!envelope.observedAt)throw problem('OBSERVED_AT','캡처 시각(observedAt)이 없어요. 지금 시각으로 채우지 않아요.');
    if(!plain(envelope.identity)||envelope.identity.accountId!==row.accountId)throw problem('IDENTITY','봉투의 계정 확인(identity.accountId)이 묶음 계정과 달라요.');
    if(!Array.isArray(envelope.observations)||!envelope.observations.length||envelope.observations.length>LIMITS.rows)throw problem('ROWS',`관측은 한 묶음에 1~${LIMITS.rows}줄이에요.`);
    row.observedAt=envelope.observedAt;
    row.rows=envelope.observations.length;
    const rules=await serverRules(),account=rules.accountCatalog.accounts.find(item=>item.id===row.accountId);
    if(!account||!rules.MANAGED_ACCOUNT_STATUSES.includes(account.accountStatus))throw problem('CATALOG','원장의 운영·확정 계정이 아니에요.');
    row.envelope={...envelope,evidenceSha256:row.evidenceSha256};
    row.account=account;
    // 서버와 같은 검사를 원장 값만 가진 가상 채널로 메모리에서 한 번 돌린다(저장·요청 없음). 실제 채널 대조는 --실행에서 서버가 다시 한다.
    const channel={id:'preview-'+account.id,platform:account.platform,handle:account.handle||null,externalId:account.externalId||null,publicUrl:account.publicUrl||null,canonicalUrl:null,catalogAccountId:account.id,active:true};
    rules.createExternalObservations({store:memoryStore(channel),clock:()=>now,catalog:rules.accountCatalog}).record({id:'preview',role:'admin'},channel,row.envelope); // 메모리 검사 전용 가짜 관리자. 실제 POST 권한은 서버가 로그인 사용자로 따로 본다.
  }catch(error){Object.assign(row,{status:'invalid',code:String(error?.code||'LOCAL_ERROR'),message:String(error?.message||'').slice(0,300)});}
  return row;
}
// 서버 accountFor와 같은 순서: 원장 ID가 묶인 채널은 그 ID로만, 아니면 matchAccount. 운영 중이고 쓸 수 있는 채널이 꼭 하나여야 한다.
function channelFor(state,account,rules){
  const ours=channel=>channel.catalogAccountId?channel.catalogAccountId===account.id&&rules.platformKey(channel.platform)===rules.platformKey(account.platform):rules.matchAccount(channel,rules.accountCatalog)?.id===account.id;
  const found=(Array.isArray(state?.channels)?state.channels:[]).filter(channel=>plain(channel)&&typeof channel.id==='string'&&channel.active!==false&&ours(channel));
  if(!found.length)return {status:'channel-missing'};
  if(found.length>1)return {status:'channel-ambiguous'};
  return found[0].canEdit===true?{channel:found[0]}:{status:'channel-not-writable'};
}
async function send(ws,channel,envelope){
  try{
    const body=await ws.post(`/api/channels/${encodeURIComponent(channel.id)}/external-observations`,envelope);
    const created=Array.isArray(body?.created)?body.created.length:0,existing=Array.isArray(body?.existing)?body.existing.length:0;
    if(body?.evidenceSha256!==envelope.evidenceSha256||created+existing!==envelope.observations.length)return {status:'unknown',httpStatus:null,code:'RESPONSE_SHAPE',created,existing};
    return {status:created?'created':'existing',httpStatus:created?201:200,code:null,created,existing};
  }catch(error){
    const status=Number.isInteger(error?.status)?error.status:null,code=typeof error?.data?.code==='string'&&/^SYNK_[A-Z_]+$/.test(error.data.code)?error.data.code:null;
    return {status:status>=400&&status<500?'rejected':'unknown',httpStatus:status,code:code||(status?'HTTP_'+status:'NETWORK')};
  }
}
// 영수증은 그 증거가 서버에 기록됐다는 성공 증거다(상태·코드·개수·해시·시각만, 수치·서버 문장 없음). 성공(created·existing)일 때만 부른다.
// 같은 증거·같은 계정·같은 채널의 다시 성공은 마지막 확인(attemptedAt·상태·개수)만 고치고 첫 성공 시각을 잇는다.
// 다른 계정·채널의 성공 영수증이 이미 있으면 바꾸지 않고 'conflict'를, 이 도구가 쓴 영수증이 아닌 파일(모르는 꼴·연결·폴더)이 있으면 'unknown'을 돌려준다.
// 임시 파일에 쓰고 이름을 바꿔 한 번에 바꾼다. 영수증 폴더는 receiptStore가 목록 폴더 바로 아래의 진짜 폴더인지 먼저 확인한다.
const RECEIPT_KEYS=Object.freeze(['accountId','attemptedAt','channelId','code','countsAsApiCollection','created','evidenceSha256','existing','firstRecordedAt','httpStatus','observedAt','rows','status','version']);
function receiptStore(dir,create){
  const at=path.join(dir,'receipts');
  if(create){try{fs.mkdirSync(at);}catch(error){if(error.code!=='EEXIST')throw error;}}
  let stat;
  try{stat=fs.lstatSync(at);}catch(error){if(error.code==='ENOENT')return null;throw error;}
  if(stat.isSymbolicLink()||!stat.isDirectory()||fs.realpathSync(at)!==at)
    throw problem('RECEIPTS_PATH','영수증 폴더(receipts)가 연결·바로가기이거나 진짜 폴더가 아니에요. 목록 폴더 밖이나 다른 파일을 덮지 않게 영수증을 쓰지 않았어요.');
  return at;
}
// 영수증 자리의 파일: 없으면 null, 이 도구가 쓴 그 증거의 성공 영수증이면 그 값, 그 밖(연결·폴더·큰 파일·모르는 꼴·실패 기록)은 'unknown'.
// v2와 앞 판 v1은 같은 14칸이다. 둘 다 같은 증거 해시이고 개수가 서로 맞아야(created+existing=rows, 상태·HTTP 코드와 일치) 받는다.
// 앞 판은 실패 줄도 적었으므로 성공 상태인 v1만 받는다. v1의 첫 성공 시각(firstRecordedAt)은 문자열이고 마지막 확인 시각(attemptedAt)과 같거나 앞서야 한다.
function readReceipt(file,hash){
  let stat;
  try{stat=fs.lstatSync(file);}catch(error){return error.code==='ENOENT'?null:'unknown';}
  if(!stat.isFile()||stat.size>64*1024)return 'unknown';
  let value;
  try{value=JSON.parse(fs.readFileSync(file,'utf8'));}catch{return 'unknown';}
  if(!plain(value))return 'unknown';
  const keys=Object.keys(value).sort(),[first,last]=[value.firstRecordedAt,value.attemptedAt].map(at=>typeof at==='string'?Date.parse(at):NaN);
  const counted=[value.rows,value.created,value.existing].every(n=>Number.isSafeInteger(n)&&n>=0)&&value.rows>0&&value.created+value.existing===value.rows
    &&value.status===(value.created?'created':'existing')&&value.httpStatus===(value.created?201:200)&&value.code===null;
  const ours=(value.version===1||value.version===2)&&keys.length===RECEIPT_KEYS.length&&keys.every((key,i)=>key===RECEIPT_KEYS[i])&&value.evidenceSha256===hash&&counted&&value.countsAsApiCollection===false
    &&typeof value.accountId==='string'&&(value.channelId===null||typeof value.channelId==='string')&&typeof value.observedAt==='string'&&typeof value.attemptedAt==='string'
    &&typeof value.firstRecordedAt==='string'&&(value.version===2||(Number.isFinite(first)&&Number.isFinite(last)&&first<=last));
  return ours?value:'unknown';
}
function writeReceipt(store,row,now){
  const target=path.join(store,row.evidenceSha256+'.json'),previous=readReceipt(target,row.evidenceSha256);
  if(previous==='unknown')return 'unknown';
  // 같은 증거라도 다른 계정·채널이나 다른 관측(캡처 시각·줄 수)의 성공 기록은 바꾸지 않는다.
  if(previous&&(previous.accountId!==row.accountId||previous.channelId!==(row.channelId||null)||previous.observedAt!==row.observedAt||previous.rows!==row.rows))return 'conflict';
  const receipt={version:2,evidenceSha256:row.evidenceSha256,accountId:row.accountId,channelId:row.channelId||null,status:row.status,httpStatus:row.httpStatus??null,code:row.code||null,
    created:row.created??null,existing:row.existing??null,rows:row.rows,observedAt:row.observedAt,attemptedAt:now,
    firstRecordedAt:previous?previous.firstRecordedAt:now,countsAsApiCollection:false};
  const temp=`${target}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  try{fs.writeFileSync(temp,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});fs.renameSync(temp,target);}catch(error){fs.rmSync(temp,{force:true});throw error;}
  return 'written';
}
function takeLock(dir,now){
  const at=path.join(dir,LOCK_NAME),owner=path.join(at,'owner.json'),token=crypto.randomBytes(12).toString('hex');
  try{fs.mkdirSync(at);}catch(error){
    if(error.code!=='EEXIST')throw error;
    let who='';
    try{who=fs.readFileSync(owner,'utf8').slice(0,200).trim();}catch{who='';}
    throw problem('LOCKED',`다른 수집이 돌고 있거나 지난 수집이 잠금을 남겼어요(${at} ${who}). 그 수집이 끝났는지 확인한 뒤 사람이 지워 주세요 — 저절로 지우지 않아요.`);
  }
  // 주인 파일을 못 쓰면(디스크 부족 등) 방금 만든 이 잠금 폴더만 치우고 원래 오류를 낸다. 남기면 실제 실행이 없어도 다음 회차가 잠금으로 멈춘다.
  try{fs.writeFileSync(owner,JSON.stringify({pid:process.pid,host:os.hostname(),startedAt:now,token}),{flag:'wx'});}
  catch(error){try{fs.rmSync(at,{recursive:true,force:true});}catch{/* 못 치우면 다음 회차가 주인 없는 잠금으로 알린다 */}throw error;}
  return ()=>{try{if(JSON.parse(fs.readFileSync(owner,'utf8')).token===token)fs.rmSync(at,{recursive:true,force:true});}catch{/* 남의 잠금이거나 이미 없음 — 그대로 둔다 */}};
}
async function run({manifestPath=DEFAULT_MANIFEST,execute=false,connect=null,env=process.env,logDir=HOME_DIR,clock=()=>new Date().toISOString()}={}){
  const manifest={...readManifest(manifestPath),logFile:path.join(path.resolve(String(logDir)),LOG_FILE)},startedAt=clock(),release=execute?takeLock(manifest.dir,startedAt):()=>{};
  const results=[];
  let loggedOut=null;
  try{
    for(const [index,batch] of manifest.batches.entries())results.push(await checkBatch(batch,index,manifest,startedAt));
    const hashes=new Set();
    for(const row of results.filter(item=>item.status==='ready')){
      if(hashes.has(row.evidenceSha256))Object.assign(row,{status:'invalid',code:'DUPLICATE_EVIDENCE',message:'같은 증거 파일을 두 묶음이 써요.'});
      hashes.add(row.evidenceSha256);
    }
    const ready=results.filter(row=>row.status==='ready');
    if(execute&&ready.length){
      const rules=await serverRules(),borrowed=typeof env.SYNK_WORKSPACE_SESSION==='string'&&env.SYNK_WORKSPACE_SESSION.length>0;
      const open=connect||require('./작업실예약.js').connect;
      let ws=null;
      try{
        ws=await open({origin:ORIGIN,session:borrowed?env.SYNK_WORKSPACE_SESSION:null});
        const state=await ws.get('/api/state');
        for(const row of ready){
          const found=channelFor(state,row.account,rules);
          if(!found.channel){Object.assign(row,{status:found.status,code:found.status.toUpperCase().replace(/-/g,'_')});continue;}
          row.channelId=found.channel.id;
          Object.assign(row,await send(ws,found.channel,row.envelope));
        }
      }catch(error){
        for(const row of ready)if(row.status==='ready')Object.assign(row,{status:'not-sent',code:error?.code==='NO_CREDENTIAL'?'NO_CREDENTIAL':'WORKSPACE',message:String(error?.message||'').slice(0,200)});
      }finally{
        if(ws&&!borrowed){try{await ws.post('/api/logout',{});loggedOut=true;}catch{loggedOut=false;}}
      }
    }
    // 성공 줄만 영수증을 쓴다. 실패·로컬 거절 줄은 같은 증거의 영수증(앞 회차나 같은 목록의 성공)을 바꾸지 않고, 남아 있는지만 보고·실행 기록에 적는다.
    // 영수증 폴더가 연결이거나 쓰기가 실패하면 그 줄만 receipt-failed로 남기고 나머지 보고·실행 기록은 이어서 쓴다(서버에는 기록됐을 수 있음).
    if(execute){
      const writes=results.filter(row=>row.evidenceSha256&&SUCCESS.includes(row.status));
      let store=null,refused=null;
      try{store=receiptStore(manifest.dir,writes.length>0);}catch(error){refused=error;}
      for(const row of writes){
        try{
          if(refused)throw refused;
          row.receipt=writeReceipt(store,row,startedAt);
        }catch(error){
          Object.assign(row,{status:'receipt-failed',code:error?.code==='RECEIPTS_PATH'?'RECEIPTS_PATH':'RECEIPT_WRITE',receipt:'failed',message:String(error?.message||'').slice(0,200)});
          continue;
        }
        if(row.receipt==='conflict')Object.assign(row,{status:'receipt-conflict',code:'RECEIPT_IDENTITY_CONFLICT',message:'같은 증거에 다른 계정·채널이나 다른 관측의 성공 영수증이 있어 바꾸지 않았어요. 서버 기록을 확인해 주세요.'});
        if(row.receipt==='unknown')Object.assign(row,{status:'receipt-conflict',code:'RECEIPT_UNKNOWN_FILE',message:'영수증 자리에 이 도구가 쓴 영수증이 아닌 파일이 있어 덮지 않았어요. 그 파일을 확인해 주세요(서버에는 기록됐을 수 있어요).'});
      }
      for(const row of results){
        if(!row.evidenceSha256||row.receipt)continue;
        const prior=store?readReceipt(path.join(store,row.evidenceSha256+'.json'),row.evidenceSha256):null;
        row.receipt=refused?'unchecked':prior==='unknown'?'unknown-file':prior?'kept-prior':'none';
      }
    }
  }finally{release();}
  // 직접 연 세션의 로그아웃이 실패하면 올린 것·영수증은 그대로 두되 실행은 끝나지 않은 것(complete:false, 끝 코드 4)으로 보고한다.
  const ok=execute?SUCCESS:['ready'];
  const report={mode:execute?'execute':'preview',startedAt,origin:execute?ORIGIN:null,loggedOut,complete:results.every(row=>ok.includes(row.status))&&loggedOut!==false,countsAsApiCollection:false,
    results:results.map(({envelope:_envelope,account:_account,...rest})=>rest)};
  if(execute){
    fs.mkdirSync(logDir,{recursive:true});
    fs.appendFileSync(path.join(logDir,LOG_FILE),JSON.stringify({...report,results:report.results.map(({message:_message,...rest})=>rest)})+'\n');
  }
  return report;
}
function parseArgs(argv){
  const options={manifestPath:DEFAULT_MANIFEST,execute:false,json:false};
  for(let i=0;i<argv.length;i++){
    const arg=argv[i];
    if(arg==='--입력'&&typeof argv[i+1]==='string'&&!argv[i+1].startsWith('--'))options.manifestPath=argv[++i];
    else if(arg==='--실행')options.execute=true;
    else if(arg==='--json')options.json=true;
    else throw problem('USAGE',`알 수 없는 인자예요: ${arg}. 쓰는 법: node tools/계정통계수집.cjs [--입력 <manifest.json>] [--실행] [--json]`);
  }
  return options;
}
async function main(){
  let options,report;
  try{options=parseArgs(process.argv.slice(2));report=await run(options);}
  catch(error){console.error(`멈춤(${error.code||'ERROR'}): ${error.message}`);process.exitCode=error.code==='LOCKED'?3:2;return;}
  if(options.json)console.log(JSON.stringify(report,null,2));
  else{
    console.log(report.mode==='execute'?`작업실 외부 관측으로 올림(API 연결 아님) — ${report.origin}`:'미리 보기 — 자격 읽기·로그인·요청·파일 쓰기 없음. 올리려면 --실행');
    for(const row of report.results)console.log(`${row.index}. ${row.accountId||'?'} · ${row.evidenceSha256?row.evidenceSha256.slice(0,12):'증거 없음'} · ${row.rows}줄 → ${row.status}${row.code?` (${row.code})`:''}${row.receipt==='kept-prior'?' · 앞선 영수증 그대로':''}${row.message?` — ${row.message}`:''}`);
    if(report.loggedOut===false)console.log('실행 미완료: 로그아웃 요청이 실패했어요(올린 것·영수증은 그대로). 세션은 서버 만료 시각에 끝나요.');
  }
  process.exitCode=exitCodeOf(report);
}
// 끝 코드: 줄 하나라도 정상(올리기 created·existing / 미리 보기 ready)이 아니면 1, 줄은 모두 정상인데 직접 연 세션의 로그아웃이 실패했으면 4.
function exitCodeOf(report){
  const ok=report.mode==='execute'?SUCCESS:['ready'];
  if(!report.results.every(row=>ok.includes(row.status)))return 1;
  return report.loggedOut===false?4:0;
}
if(require.main===module)main();
module.exports={run,exitCodeOf,readManifest,evidenceHash,checkBatch,channelFor,ORIGIN,HOME_DIR,DEFAULT_MANIFEST,LIMITS,LOCK_NAME};
