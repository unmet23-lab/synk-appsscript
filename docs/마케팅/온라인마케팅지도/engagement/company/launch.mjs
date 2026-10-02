import { spawn } from 'node:child_process';
import { join,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from './store.mjs';
import { mkdirSync, openSync, closeSync, appendFileSync, writeFileSync } from 'node:fs';

const here=dirname(fileURLToPath(import.meta.url));
const base='http://127.0.0.1:4191';
const tab=process.argv.includes('--messenger')?'?tab=messenger':'';
async function health(){try{const response=await fetch(base+'/api/health',{signal:AbortSignal.timeout(1000)});return response.ok?await response.json():null;}catch{return null;}}
const ready=value=>value?.app==='synk-company'&&value.workspaceIntegration===true&&value.ready===true;
let status=await health(),failure=null,child=null;
if(status&&(status.app!=='synk-company'||status.workspaceIntegration!==true))throw new Error('4191 포트를 다른 프로그램이 사용 중입니다. 실행 중인 프로그램을 확인해 주세요.');
if(status&&typeof status.ready!=='boolean')throw new Error('이전 버전의 서버가 실행 중입니다. 회사 프로그램을 종료한 뒤 바로가기를 다시 열어 주세요.');
if(!status){
  const dataDir=join(here,'data'),logDir=join(dataDir,'logs');
  mkdirSync(logDir,{recursive:true,mode:0o700});
  const stamp=new Date().toISOString().replace(/[:.]/g,'-'),logFile=join(logDir,'server-'+stamp+'.log');
  const logFd=openSync(logFile,'ax',0o600);
  try{
    child=spawn(process.execPath,[join(here,'server.mjs')],{cwd:here,detached:true,windowsHide:true,stdio:['ignore',logFd,logFd],env:{...process.env,SYNK_COMPANY_PORT:'4191',SYNK_COMPANY_HOST:'127.0.0.1',SYNK_COMPANY_ORIGIN:base,SYNK_COMPANY_DATA:dataDir}});
    child.once('error',error=>{failure=error.code||error.name;});
    child.once('exit',(code,signal)=>{failure=`exit=${code}, signal=${signal||'none'}`;});
    appendFileSync(logFd,`[launcher] ${stamp} node=${process.version} pid=${child.pid||'unavailable'}\n`);
    if(child.pid)writeFileSync(join(dataDir,'server-4191.pid'),String(child.pid)+'\n',{mode:0o600});
    child.unref();
  }finally{closeSync(logFd);}
}
for(let i=0;i<40&&!ready(status)&&!failure;i++){await new Promise(r=>setTimeout(r,250));status=await health();}
if(!ready(status)||failure)throw new Error(`워크스페이스를 시작하지 못했습니다. data/logs의 최신 서버 기록을 확인해 주세요.${failure?' ('+failure+')':''}`);
const store=new Store(join(here,'data'));
let admin=store.all('users').find(u=>u.role==='admin'&&u.active);
if(!admin){if(store.all('users').length)throw new Error('활성 관리자가 없습니다.');admin=store.createUser({email:'founder@synk.im',name:'유호',role:'admin'});}
if(!store.get('settings','initialImport')){
  const response=await fetch(base+'/api/launch',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({token:store.mint('launch',admin.id,{},5)})});
  if(!response.ok)throw new Error('관리자 시작 인증에 실패했습니다.');
  const session=await response.json(),cookie=response.headers.get('set-cookie').split(';')[0];
  const imported=await fetch(base+'/api/import-legacy',{method:'POST',headers:{'Content-Type':'application/json',Origin:base,Cookie:cookie,'X-CSRF-Token':session.csrfToken},body:'{}'});
  if(imported.ok)store.put('settings','initialImport',{at:new Date().toISOString(),result:await imported.json()});
}
const value=store.mint('launch',admin.id,{},5);store.close();
// Only the launcher consumes this URL. Never persist the token or include it in logs.
process.stdout.write(base+'/'+tab+'#launch='+value);
