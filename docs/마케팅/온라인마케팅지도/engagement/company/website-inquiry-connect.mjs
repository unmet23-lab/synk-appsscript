import {readFile,stat,realpath} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {Store} from './store.mjs';
import {createGoogleFormsInquiryReader,WEBSITE_INQUIRY_SECRET} from './website-inquiry-google.mjs';

export function websiteInquiryCredentialInput(value){
  const fields=['client_id','client_secret','refresh_token'];
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==3||fields.some(key=>typeof value[key]!=='string'||!value[key]||value[key].length>8192||/[\r\n\0]/.test(value[key])))
    throw new Error('문의 연결 입력 형식을 확인해 주세요.');
  return Object.fromEntries(fields.map(key=>[key,value[key]]));
}
export function readWebsiteInquiryCredentialStdin(input=process.stdin,{signal=AbortSignal.timeout(30000)}={}){
  return new Promise((done,reject)=>{
    let chunks=[],bytes=0,settled=false;
    const cleanup=()=>{for(const [name,handler]of[['data',data],['end',end],['error',error],['close',closed]])input.removeListener(name,handler);signal?.removeEventListener('abort',aborted);input.pause();};
    const finish=(err,value)=>{if(settled)return;settled=true;cleanup();chunks=[];err?reject(err):done(value);};
    const error=()=>finish(new Error('문의 연결 비공개 입력을 읽지 못했습니다.'));
    const aborted=()=>{error();input.destroy();};
    const closed=()=>{if(!settled)error();};
    const data=chunk=>{const part=Buffer.from(chunk);bytes+=part.length;if(bytes>16384){error();input.destroy();return;}chunks.push(part);};
    const end=()=>{try{const value=websiteInquiryCredentialInput(JSON.parse(Buffer.concat(chunks).toString('utf8')));finish(null,value);}catch{error();}};
    if(signal?.aborted){error();return;}
    for(const [name,handler]of[['data',data],['end',end],['error',error],['close',closed]])input.on(name,handler);
    signal?.addEventListener('abort',aborted,{once:true});
  });
}

/** Run on the company host with an existing, protected credential input.
 * Default is verification only. Never prints account names, customer data,
 * access tokens or Google diagnostics; --execute stores only encrypted data. */
export async function connectWebsiteInquiry({dataDir,credentialsPath,credentials,execute=false,fetchImpl=globalThis.fetch,signal,assertInstall}={}){
  if(!dataDir)throw new Error('기존 회사 데이터 경로를 지정해 주세요.');
  if(credentialsPath&&credentials!==undefined)throw new Error('문의 연결 입력은 한 경로만 지정해 주세요.');
  if(execute&&!credentialsPath&&credentials===undefined)throw new Error('설치할 비공개 OAuth 입력을 지정해 주세요.');
  signal?.throwIfAborted();
  const directory=await realpath(resolve(dataDir)),repo=resolve(dirname(fileURLToPath(import.meta.url)),'../../../../..');
  const [database,keyFile]=await Promise.all([stat(join(directory,'company.sqlite')),stat(join(directory,'encryption.key'))]);
  if(!database.isFile()||!keyFile.isFile()||keyFile.size!==32)throw new Error('기존 회사 데이터와 암호화 키를 확인해 주세요.');
  let value;
  if(credentials!==undefined)value=websiteInquiryCredentialInput(credentials);
  else if(credentialsPath){
    const source=await realpath(resolve(credentialsPath));
    const comparable=process.platform==='win32'?source.toLowerCase():source,root=process.platform==='win32'?repo.toLowerCase():repo;
    if(comparable===root||comparable.startsWith(root+'/')||comparable.startsWith(root+'\\'))throw new Error('인증 파일은 저장소 밖 비공개 경로에 두어야 합니다.');
    const file=await stat(source);
    if(!file.isFile()||file.size>65536)throw new Error('인증 파일 형식을 확인해 주세요.');
    if(process.platform!=='win32'&&(file.mode&0o077))throw new Error('인증 파일의 접근 권한은 소유자 전용이어야 합니다.');
    let raw;try{raw=JSON.parse(await readFile(source,'utf8'));}catch{throw new Error('인증 파일 JSON을 읽지 못했습니다.');}
    value=websiteInquiryCredentialInput(Object.fromEntries(['client_id','client_secret','refresh_token'].map(key=>[key,raw[key]])));
  }else{
    // Do not construct Store in read-only mode: its constructor maintains
    // tables and expired sessions. Use the same decrypt method with only the key.
    const db=new DatabaseSync(join(directory,'company.sqlite'),{readOnly:true});
    try{
      const row=db.prepare('SELECT ciphertext FROM credentials WHERE id=?').get(WEBSITE_INQUIRY_SECRET);
      if(!row)throw Object.assign(new Error('홈페이지 문의용 Google 읽기 연결이 아직 없습니다.'),{code:'FORMS_NOT_CONNECTED'});
      const key=await readFile(join(directory,'encryption.key'));
      value=Store.prototype.decrypt.call({key},row.ciphertext);
    }finally{db.close();}
  }
  const reader=createGoogleFormsInquiryReader({getCredentials:()=>value,fetchImpl});
  const result=await reader.verify({signal});
  if(execute){
    await assertInstall?.();signal?.throwIfAborted();
    const store=new Store(directory);try{store.setSecret(WEBSITE_INQUIRY_SECRET,value);const saved=store.secret(WEBSITE_INQUIRY_SECRET);if(JSON.stringify(saved)!==JSON.stringify(value))throw new Error('문의 연결 저장 확인을 완료하지 못했습니다.');}finally{store.close();}
  }
  return {verified:result.connected,installed:execute,verifiedAt:result.verifiedAt,customerDataRead:false};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),values={};
  try{
    for(let i=0;i<args.length;i++){const key=args[i];if(!['--data-dir','--credentials','--execute','--install-stdin'].includes(key)||Object.hasOwn(values,key))throw new Error('Invalid arguments');if(['--execute','--install-stdin'].includes(key))values[key]=true;else{if(!args[i+1]||args[i+1].startsWith('--'))throw new Error('Invalid arguments');values[key]=args[++i];}}
    if(values['--install-stdin']&&(!values['--execute']||values['--credentials']))throw new Error('stdin install requires execute and one source');
    const signal=AbortSignal.timeout(120000),credentials=values['--install-stdin']?await readWebsiteInquiryCredentialStdin(process.stdin,{signal}):undefined;
    const result=await connectWebsiteInquiry({dataDir:values['--data-dir'],credentialsPath:values['--credentials'],credentials,execute:values['--execute']===true,signal});
    process.stdout.write(JSON.stringify(result)+'\n');
  }catch(error){process.stderr.write((error?.code?.startsWith('FORMS_')?error.message:'문의 연결 확인을 완료하지 못했습니다. 비공개 인증 파일·데이터 경로·권한을 확인해 주세요.')+'\n');process.exitCode=1;}
}
