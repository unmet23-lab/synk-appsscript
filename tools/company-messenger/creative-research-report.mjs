import {createHash} from 'node:crypto';
import {lstat,open,mkdir,writeFile,rename,unlink} from 'node:fs/promises';
import path from 'node:path';
import {homedir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {validateResearchReport} from '../../docs/마케팅/온라인마케팅지도/engagement/company/creative-research.mjs';

const REPORT_LIMIT=1024*1024,RESPONSE_LIMIT=1024*1024;
const messages={
  USAGE:'사용: --report <절대 JSON 경로> --validate 또는 --report <절대 JSON 경로> --origin <회사 주소> [--receipt-dir <절대 경로>]',
  REPORT_READ_FAILED:'보고서 파일을 읽지 못했습니다. 원래 파일은 보존했습니다.',
  REPORT_TOO_LARGE:'보고서는 1MiB 이하 JSON 파일이어야 합니다.',
  REPORT_INVALID:'보고서 형식·날짜·출처를 확인해 주세요. 서버에 보내지 않았습니다.',
  ORIGIN_INVALID:'계정 정보나 추가 경로가 없는 HTTPS 회사 주소 또는 HTTP loopback 주소를 입력해 주세요.',
  HTTP_AUTH_REQUIRED:'회사 세션과 CSRF 환경값이 필요합니다. 보고서를 읽기만 했으며 업로드하지 않았습니다.',
  HTTP_AUTH_INVALID:'회사 인증 환경값 형식을 확인해 주세요. 업로드하지 않았습니다.',
  HTTP_REQUEST_FAILED:'업로드 완료 여부를 확인하지 못했습니다. 원래 보고서를 보존했으며 자동 재전송하지 않았습니다.',
  HTTP_REJECTED:'회사가 보고서 업로드를 거절했습니다. 원래 보고서는 보존했습니다.',
  HTTP_RESPONSE_INVALID:'업로드 응답을 확인하지 못했습니다. 원래 보고서를 보존했으며 자동 재전송하지 않았습니다.',
  RECEIPT_WRITE_FAILED:'업로드는 확인했으나 로컬 영수증을 저장하지 못했습니다. 같은 보고서의 서버 기록을 확인해 주세요.',
};
const failure=code=>Object.assign(new Error(messages[code]),{code});
const count=value=>Number.isSafeInteger(value)&&value>=0;

export function creativeResearchReceiptDirectory(env=process.env,{platform=process.platform,homeDirectory=homedir()}={}){
  const fallback=platform==='win32'?path.join(homeDirectory,'AppData','Local'):path.join(homeDirectory,'.local','state');
  const configured=platform==='win32'?env.LOCALAPPDATA:env.XDG_STATE_HOME;
  const stateRoot=typeof configured==='string'&&path.isAbsolute(configured)?configured:fallback;
  return path.join(stateRoot,'SYNK','creative-research','receipts');
}

function argumentsFor(argv){
  const flags={},valued=new Set(['--report','--origin','--receipt-dir']);
  for(let i=0;i<argv.length;i++){
    const flag=argv[i];if(Object.hasOwn(flags,flag))throw failure('USAGE');
    if(flag==='--validate')flags[flag]=true;
    else if(valued.has(flag)&&typeof argv[i+1]==='string'&&!argv[i+1].startsWith('--'))flags[flag]=argv[++i];
    else throw failure('USAGE');
  }
  if(!flags['--report']||!path.isAbsolute(flags['--report'])||flags['--receipt-dir']&&!path.isAbsolute(flags['--receipt-dir']))throw failure('USAGE');
  if(flags['--validate']&&(flags['--origin']||flags['--receipt-dir'])||!flags['--validate']&&!flags['--origin'])throw failure('USAGE');
  return flags;
}

export function reportOrigin(value){
  let url;try{url=new URL(value);}catch{throw failure('ORIGIN_INVALID');}
  const loopback=['127.0.0.1','localhost','[::1]'].includes(url.hostname.toLowerCase());
  if(url.username||url.password||url.pathname!=='/'||url.search||url.hash||!(url.protocol==='https:'||url.protocol==='http:'&&loopback))throw failure('ORIGIN_INVALID');
  return url.origin;
}

async function readReport(file,at){
  let handle;
  try{
    const metadata=await lstat(file);if(!metadata.isFile()||metadata.isSymbolicLink())throw failure('REPORT_READ_FAILED');
    if(metadata.size>REPORT_LIMIT)throw failure('REPORT_TOO_LARGE');
    handle=await open(file,'r');const live=await handle.stat();
    if(!live.isFile()||live.size>REPORT_LIMIT)throw failure(live.size>REPORT_LIMIT?'REPORT_TOO_LARGE':'REPORT_READ_FAILED');
    const raw=await handle.readFile();if(raw.length>REPORT_LIMIT)throw failure('REPORT_TOO_LARGE');
    let report;try{report=validateResearchReport(JSON.parse(raw.toString('utf8').replace(/^\uFEFF/,'')),{at});}catch{throw failure('REPORT_INVALID');}
    return {report,body:JSON.stringify(report),digest:createHash('sha256').update(raw).digest('hex')};
  }catch(error){throw error.code&&Object.hasOwn(messages,error.code)?error:failure('REPORT_READ_FAILED');}
  finally{await handle?.close().catch(()=>{});}
}

async function responseJson(response){
  if(!/application\/json/i.test(response.headers.get('content-type')||''))throw failure('HTTP_RESPONSE_INVALID');
  if(Number(response.headers.get('content-length'))>RESPONSE_LIMIT)throw failure('HTTP_RESPONSE_INVALID');
  const parts=[];let size=0;
  try{
    for await(const value of response.body||[]){size+=value.byteLength;if(size>RESPONSE_LIMIT)throw failure('HTTP_RESPONSE_INVALID');parts.push(Buffer.from(value));}
    return JSON.parse(Buffer.concat(parts).toString('utf8'));
  }catch{throw failure('HTTP_RESPONSE_INVALID');}
}

function receiptFrom(payload,input,origin,digest,at){
  const r=payload?.report;
  if(!r||r.reportId!==input.reportId||r.date!==input.date||r.provider!==input.provider||!['imported','empty'].includes(r.status)||!['createdCount','updatedCount','retainedCount','itemCount'].every(key=>count(r[key]))||r.itemCount!==input.entries.length||typeof payload.existing!=='boolean')throw failure('HTTP_RESPONSE_INVALID');
  const guideCounts={};
  for(const key of ['acceptedCount','deferredCount','addedGuideCount'])if(r[key]!==undefined){if(!count(r[key])||r[key]>r.itemCount||key==='addedGuideCount'&&r[key]>10)throw failure('HTTP_RESPONSE_INVALID');guideCounts[key]=r[key];}
  if(guideCounts.acceptedCount!==undefined&&guideCounts.deferredCount!==undefined&&guideCounts.acceptedCount+guideCounts.deferredCount!==r.itemCount)throw failure('HTTP_RESPONSE_INVALID');
  const runTimes={};
  for(const key of ['asOfAt','researchStartedAt','researchCompletedAt']){if(r[key]!==input[key])throw failure('HTTP_RESPONSE_INVALID');if(input[key]!==undefined)runTimes[key]=r[key];}
  return {ok:true,reportId:r.reportId,date:r.date,provider:r.provider,status:r.status,createdCount:r.createdCount,updatedCount:r.updatedCount,retainedCount:r.retainedCount,itemCount:r.itemCount,...guideCounts,...runTimes,existing:payload.existing,origin,reportSHA256:digest,confirmedAt:at};
}

async function saveReceipt(directory,receipt){
  let temporary;
  try{
    await mkdir(directory,{recursive:true,mode:0o700});
    const final=path.join(directory,`${receipt.date}-${receipt.reportSHA256.slice(0,16)}.json`);
    temporary=final+'.'+process.pid+'.'+Date.now()+'.tmp';
    await writeFile(temporary,JSON.stringify(receipt)+'\n',{flag:'wx',mode:0o600});
    await rename(temporary,final);temporary=null;
  }catch{throw failure('RECEIPT_WRITE_FAILED');}
  finally{if(temporary)await unlink(temporary).catch(()=>{});}
}

// This tool only validates or transports an existing report. It never generates content,
// stores authentication values, starts a server, or retries an ambiguous upload.
export async function runCreativeResearchReport({argv=process.argv.slice(2),env=process.env,fetchImpl=fetch,clock=()=>new Date().toISOString(),stdout=line=>console.log(line),stderr=line=>console.error(line)}={}){
  let confirmed=null;
  try{
    const flags=argumentsFor(argv),at=clock(),loaded=await readReport(flags['--report'],at),report=loaded.report;
    if(flags['--validate']){const result={valid:true,schemaVersion:report.schemaVersion,date:report.date,provider:report.provider,entryCount:report.entries.length};stdout(JSON.stringify(result));return {exitCode:0,result};}
    const origin=reportOrigin(flags['--origin']),session=env.SYNK_CREATIVE_RESEARCH_SESSION,csrf=env.SYNK_CREATIVE_RESEARCH_CSRF;
    if(!session||!csrf)throw failure('HTTP_AUTH_REQUIRED');
    if(![session,csrf].every(value=>typeof value==='string'&&/^[A-Za-z0-9_-]{16,4096}$/.test(value)))throw failure('HTTP_AUTH_INVALID');
    let response;
    try{response=await fetchImpl(origin+'/api/creative-research/import-report',{method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),headers:{Accept:'application/json','Content-Type':'application/json',Origin:origin,Cookie:'synk_company_session='+session,'X-CSRF-Token':csrf},body:loaded.body});}
    catch{throw failure('HTTP_REQUEST_FAILED');}
    if(!response.ok){await response.body?.cancel().catch(()=>{});throw failure('HTTP_REJECTED');}
    confirmed=receiptFrom(await responseJson(response),report,origin,loaded.digest,clock());
    await saveReceipt(flags['--receipt-dir']||creativeResearchReceiptDirectory(env),confirmed);
    const result={...confirmed,receiptSaved:true};stdout(JSON.stringify(result));return {exitCode:0,result};
  }catch(error){
    const code=Object.hasOwn(messages,error.code)?error.code:'HTTP_REQUEST_FAILED',result={ok:false,code,message:messages[code],...(confirmed?{uploadConfirmed:true,reportId:confirmed.reportId,date:confirmed.date,createdCount:confirmed.createdCount,updatedCount:confirmed.updatedCount,retainedCount:confirmed.retainedCount,itemCount:confirmed.itemCount}:{})};
    stderr(JSON.stringify(result));return {exitCode:1,result};
  }
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))process.exitCode=(await runCreativeResearchReport()).exitCode;
