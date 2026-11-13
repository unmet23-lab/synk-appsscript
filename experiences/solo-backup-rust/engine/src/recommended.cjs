'use strict';
// A separate, append-only repository. Never imports another app's credentials.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const {StringDecoder}=require('node:string_decoder');
const {BackupEngine,parseKit}=require('./engine.cjs');
const {directory,contains,overlap,atomic,spellings}=require('./paths.cjs');
const {readManifest,extractVerified}=require('./restore-tar.cjs');
const {selectSample,consumeSample}=require('./probe.cjs');
const b2=require('./b2.cjs');
const APP='solo-work-backup-v1',VERIFIED='recommended-verified-v1';
const RATE=6.95,PRICE_DATE='2026-11-10',DAY=86400000;
const digest=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const key=p=>path.resolve(p).toLowerCase();
function minimal(paths){const result=[];for(const p of [...new Set(paths)].sort((a,b)=>a.length-b.length||a.localeCompare(b))){if(!result.some(r=>contains(r,p)))result.push(p);}return result;}
function candidates(inventory,protectedPaths=[]){
  if(!Array.isArray(inventory?.candidates)||inventory.candidates.length>5000)throw Error('진단 결과 형식이 올바르지 않습니다.');
  const valid=c=>typeof c.path?.raw==='string'&&path.isAbsolute(c.path.raw)&&!c.path.raw.includes('\0');
  const exclusions=inventory.candidates.filter(c=>valid(c)&&['credential_location','external_manual','regenerable'].includes(c.category)).map(c=>c.path.raw).concat(protectedPaths);
  const sources=minimal(inventory.candidates.filter(c=>valid(c)&&c.state==='present'&&['irreplaceable','ai_settings'].includes(c.category)).map(c=>c.path.raw)).filter(p=>!exclusions.some(e=>contains(e,p)));
  if(!sources.length||sources.length>200)throw Error('백업할 추천 경로를 확인하지 못했습니다.');
  return {sources,exclusions:minimal(exclusions),manual:inventory.candidates.filter(c=>valid(c)&&c.category==='external_manual').map(c=>c.path.raw),discoveryComplete:inventory.scan_complete===true};
}
function native(executable,args=[],input){return new Promise((resolve,reject)=>{
  const child=spawn(executable,args,{windowsHide:true,shell:false,stdio:['pipe','pipe','pipe']});let output='',error='',large=false,bytes=0;const decoder=new StringDecoder('utf8');
  const timer=setTimeout(()=>child.kill(),370000);
  child.stdout.on('data',b=>{bytes+=b.length;output+=decoder.write(b);if(bytes>16*1024*1024){large=true;child.kill();}});child.stderr.setEncoding('utf8');child.stderr.on('data',b=>{error=(error+b).slice(-2000);});
  child.on('error',reject);child.stdin.on('error',()=>{});child.on('close',code=>{clearTimeout(timer);output+=decoder.end();if(code!==0||large)return reject(Error('자료 진단을 마치지 못했습니다. '+error));resolve(output);});child.stdin.end(input?JSON.stringify(input):undefined);
});}
function validateScan(s){if(s?.schema!==1||typeof s.complete!=='boolean'||!Number.isSafeInteger(s.bytes)||s.bytes<0||!Number.isSafeInteger(s.files)||s.files<0||!Array.isArray(s.sources)||!s.sources.length||s.sources.length>200||!Array.isArray(s.exclusions)||s.exclusions.length>10000||!Array.isArray(s.errors))throw Error('용량 확인 결과를 읽지 못했습니다.');return s;}
function estimate(bytes,changeRate=.1){return {rate:RATE,date:PRICE_DATE,logicalBytes:bytes,month1USD:bytes*1.1/1e12*RATE,month12USD:bytes*1.1*(1+11*changeRate)/1e12*RATE,changeRate,assumption:'압축·중복 제거 할인 없음, 부가 공간 10%, 이전 백업 삭제 없음. 세금·다운로드·기존 저장료 별도.'};}
function approval(plan,input){
  if(!plan?.complete)throw Error('읽지 못한 경로를 먼저 확인해 주세요. 부분 진단으로 백업을 시작하지 않습니다.');
  if(!input||input.planHash!==plan.hash||!['local','b2'].includes(input.destination))throw Error('추천 목록이 바뀌었습니다. 다시 확인해 주세요.');
  const maxBytes=Number(input.maxBytes),monthlyUSD=Number(input.monthlyUSD);
  if(!Number.isSafeInteger(maxBytes)||maxBytes<Math.ceil(plan.bytes*1.1)||!Number.isFinite(monthlyUSD)||monthlyUSD<maxBytes/1e12*RATE||monthlyUSD>10000)throw Error('승인 용량과 예상 월 저장료를 확인해 주세요.');
  const value={version:1,planHash:plan.hash,destination:input.destination,maxBytes,monthlyUSD,sourceBytes:plan.bytes,growth:1.2,rate:RATE,priceDate:PRICE_DATE,exclusions:plan.exclusions,sources:plan.sources};return {...value,hash:digest(value)};
}
function exclusionPattern(p){
  // Restic on Windows matches absolute slash paths, including the drive colon.
  if(/[\r\n\0]/.test(p))throw Error('제외 경로에 지원하지 않는 문자가 있습니다.');
  return p.replaceAll('\\','/').replace(/[\[*?]/g,c=>`[${c}]`);
}
class RecommendedEngine extends BackupEngine {
  async run(args,options){if(['forget','prune','unlock'].includes(args[0]))throw Error('추천 백업은 기존 백업을 삭제하거나 잠금을 강제로 풀지 않습니다.');return super.run(args,options);}
  async initialize(plan,{parent,connection}={}){
    if(this.isCloud())throw Error('추천 자료의 클라우드 확장은 보류 중입니다. 이번 시험판은 로컬 백업만 지원합니다.');
    if(this.config?.repositoryId)throw Error('이미 추천 저장소가 준비되어 있습니다.');
    return this.operation('setup',async()=>{
      if(this.config){
        if(!this.config.recommended||!this.secret||digest(this.config.sources)!==digest(plan.sources))throw Error('이전 준비와 같은 자료·Windows 계정으로 다시 시도해 주세요.');
        let info;try{info=JSON.parse(await this.run(['cat','config']));}catch(e){if(e.exitCode!==10)throw e;await this.run(['init']);info=JSON.parse(await this.run(['cat','config']));}
        if(!/^[a-f0-9]{64}$/.test(info.id))throw Error('추천 저장소 확인에 실패했습니다.');this.config.repositoryId=info.id;await this.save();return;
      }
      const vaultId=crypto.randomUUID();this.secret=crypto.randomBytes(32).toString('base64url');
      let provider,repository;
      if(this.isCloud()){
        if(!connection)throw Error('이 Rust 앱의 클라우드 탭에서 백업용 연결을 먼저 준비해 주세요.');
        provider=b2.provider({endpoint:connection.endpoint,bucket:connection.bucket,prefix:`work-backup/${vaultId}`},vaultId);this.cloudCredentials=b2.credentials(connection.credentials);await this.probe(provider,this.cloudCredentials,{now:this.now()});repository=b2.repository(provider,vaultId);
      }else{parent=await directory(parent);if(plan.sources.some(s=>overlap(s,parent))||this.forbidden().some(p=>overlap(parent,p)))throw Error('원본과 분리된 백업 위치가 필요합니다.');repository=path.join(parent,`recommended-${vaultId}`);await fs.mkdir(repository);}
      await this.storeCredential(this.secret,this.cloudCredentials);
      this.config={schema:1,mode:'backup',vaultId,repository,repositoryId:null,...(provider?{provider}:{}),sources:plan.sources,automatic:false,recoverySaved:false,lastBackup:null,health:null,lastError:null,recommended:true};await this.save();
      await this.run(['init']);const info=JSON.parse(await this.run(['cat','config']));if(!/^[a-f0-9]{64}$/.test(info.id))throw Error('추천 저장소 확인에 실패했습니다.');this.config.repositoryId=info.id;await this.save();
    });
  }
  async backupPlan(plan,permit){
    if(this.isCloud())throw Error('추천 자료의 클라우드 확장은 보류 중입니다. 이번 시험판은 로컬 백업만 지원합니다.');
    return this.operation('backup',async()=>{
      this.assertBackupReady();await this.identity();
      const excluded=path.join(this.stateDir,'excluded.txt');await atomic(excluded,plan.exclusions.map(e=>exclusionPattern(e.path)).join('\n')+'\n');
      const args=['backup','--json','--exclude-cloud-files','--iexclude-file',excluded,'--host',this.config.vaultId,'--tag',`${APP},vault:${this.config.vaultId}`];
      this.stage('추가 저장 용량 확인 중');
      const dry=await this.run([...args,'--dry-run','--',...plan.sources]);
      const summary=dry.trim().split('\n').map(s=>{try{return JSON.parse(s);}catch{return null;}}).findLast(s=>s?.message_type==='summary');
      if(!summary||!Number.isFinite(summary.data_added))throw Error('추가 저장 용량을 확인하지 못했습니다.');
      const existing=JSON.parse(await this.run(['stats','--json','--mode','raw-data']));
      if(!Number.isFinite(existing.total_size)||existing.total_size+summary.data_added*1.1>permit.maxBytes)throw Error('승인한 저장 용량을 넘어 백업을 보류했습니다.');
      const runTag=`run:${crypto.randomUUID()}`;this.stage('추천 자료 암호화 백업 중');await this.run([...args,'--tag',runTag,'--tag','pending','--',...plan.sources]);
      const pending=await this.snapshots([runTag,'pending']);if(pending.length!==1)throw Error('새 백업을 확인하지 못했습니다.');
      const fullRead=!this.isCloud()||!this.config.lastFullReadAt||this.now()-Date.parse(this.config.lastFullReadAt)>=30*DAY;
      this.stage(fullRead?'전체 백업 내용 확인 중':'저장 구조와 복구 표본 확인 중');await this.run(fullRead?['check','--read-data']:['check']);
      if(fullRead){this.config.lastFullReadAt=new Date(this.now()).toISOString();await this.save();}
      // A new link or unsupported path appearing after preflight must not become
      // a "verified" snapshot which this app cannot safely restore.
      await this.run(['ls','--json','--recursive',pending[0].id],{consumeStdout:stream=>readManifest(stream,this.stateDir)});
      let sample;await this.run(['ls','--json','--recursive',pending[0].id],{consumeStdout:async stream=>{sample=await selectSample(stream,pending[0].id,{maxNodes:1000000,maxBytes:512*1024*1024});}});if(!sample)throw Error('복구 확인용 파일을 찾지 못했습니다.');
      let proof;await this.run(['dump',pending[0].id,sample.path],{consumeStdout:async stream=>{proof=await consumeSample(stream,sample.size);}});if(proof?.bytes!==sample.size)throw Error('복구 표본의 내용이 짧습니다.');
      await this.run(['tag','--add',VERIFIED,'--add','complete-structure-checked','--remove','pending',pending[0].id]);const verified=await this.snapshots([runTag,VERIFIED]);if(verified.length!==1)throw Error('검증 완료 기록을 확인하지 못했습니다.');
      const s=verified[0],at=new Date(this.now()).toISOString();this.config.lastBackup={id:s.id,at:s.time,verifiedAt:at,files:s.summary?.total_files_processed||0,bytes:s.summary?.total_bytes_processed||0};this.config.health={status:'ok',checkedAt:at};
      const after=JSON.parse(await this.run(['stats','--json','--mode','raw-data']));this.config.storedBytes=after.total_size;
      if(!Number.isFinite(after.total_size)||after.total_size>permit.maxBytes){this.config.automatic=false;this.config.lastError='실제 저장량이 승인 한도를 넘었습니다. 이후 자동 백업을 중지했습니다.';await this.save();throw Error(this.config.lastError);}
      await this.save();return this.getState();
    });
  }
  async restoreAll(parent){return this.operation('restore',()=>restoreWhole(this,parent));}
}
async function restoreWhole(engine,parent,snapshot){
    await engine.identity();await engine.assertNoRemoteMaintenance();parent=await directory(parent);
    if([...engine.config.sources,...engine.forbidden()].some(p=>overlap(p,parent)))throw Error('원본·설정·저장소와 분리된 복구 위치가 필요합니다.');
    snapshot ||= (await engine.snapshots([VERIFIED]))[0];if(!snapshot?.tags?.includes(VERIFIED))throw Error('검증을 마친 추천 백업이 없습니다.');
    if(!Array.isArray(snapshot.paths)||snapshot.paths.length>200||snapshot.paths.some(p=>typeof p!=='string'||!path.isAbsolute(p)||overlap(p,parent)))throw Error('백업에 기록된 원래 경로와 분리된 위치가 필요합니다.');
    let manifest;await engine.run(['ls','--json','--recursive',snapshot.id],{consumeStdout:async stream=>{manifest=await readManifest(stream,parent);}});
    const space=await fs.statfs(parent,{bigint:true}),free=space.bavail*space.bsize,total=space.blocks*space.bsize;
    const allocation=[...manifest.nodes.values()].reduce((n,e)=>n+((BigInt(e.size)+space.bsize-1n)/space.bsize+1n)*space.bsize,0n);
    if(free<allocation*12n/10n+64n*1024n*1024n||free-allocation<total/10n)throw Error('복구 후 여유 공간 10%를 유지할 수 있는 다른 드라이브가 필요합니다.');
    const target=path.join(parent,`추천복구-${crypto.randomUUID()}`);await fs.mkdir(target);engine.stage('새 폴더로 복구하고 모든 파일 내용 검증 중');
    let proof;await engine.run(['dump',snapshot.id,'/','--archive','tar'],{consumeStdout:async stream=>{proof=await extractVerified(stream,target,manifest);}});
    const receipt={...proof,path:target,snapshotId:snapshot.id,at:new Date(engine.now()).toISOString(),verification:'all-file-SHA256-against-authenticated-stream',applicationConsistent:false};await fs.writeFile(path.join(target,'업무복구-확인.json'),JSON.stringify(receipt,null,2),{flag:'wx'});engine.config.lastRestore=receipt;await engine.save();return receipt;
}
class RecommendedBackup {
  constructor({root,workRoot=null,resticPath,secretStore,plannerPath,inventoryPath,protectedPaths=[],cloudContext,registerStartup,scan=native}){Object.assign(this,{root:path.resolve(root),workRoot:workRoot?path.resolve(workRoot):null,resticPath,secretStore,plannerPath,inventoryPath,protectedPaths,cloudContext,registerStartup,scan});this.busy=false;this.error=null;this.preview=null;this.engine=null;this.closing=false;this.onChange=()=>{};}
  // The folders as they really are, like the profiles' (an 8.3 short root would miss a place chosen by its real path — GPT GA1).
  async open(){await fs.mkdir(this.root,{recursive:true});this.root=await directory(this.root);
    if(this.workRoot){await fs.mkdir(this.workRoot,{recursive:true});this.workRoot=await directory(this.workRoot);}
    this.protectedPaths=await spellings(this.protectedPaths);try{this.saved=JSON.parse(await fs.readFile(path.join(this.root,'plan.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw Error('추천 백업 설정을 읽지 못했습니다.');}try{const p=JSON.parse(await fs.readFile(path.join(this.root,'preview.json'),'utf8'));const {hash,...body}=p.preview;if(digest(body)!==hash)throw Error('preview_changed');this.preview=p.preview;this.request=p.request;}catch(e){if(e.code!=='ENOENT')this.error='추천 목록을 다시 찾아 주세요.';}if(this.saved){const {hash,...body}=this.saved.permit;if(digest(body)!==hash)throw Error('승인 기록이 바뀌었습니다.');await this.makeEngine(this.saved.permit.destination);}this.timer=setInterval(()=>{void this.tick();},30000);this.timer.unref?.();}
  async makeEngine(kind){this.engine=new RecommendedEngine({stateDir:path.join(this.root,'vault'),workDir:this.workRoot?path.join(this.workRoot,'vault'):null,resticPath:this.resticPath,secretStore:this.secretStore,providerType:kind,
    // The engine refuses the whole recommended folder, its work folder and every protected place on its own too (카본 끝판 A1).
    forbiddenPaths:[this.root,...(this.workRoot?[this.workRoot]:[]),...this.protectedPaths]});await this.engine.open();this.engine.on('state',()=>this.onChange());}
  state(){const e=this.engine;return {busy:this.busy,stage:e?.job?.stage||this.stage||null,error:this.error||e?.config?.lastError||null,preview:this.preview?{...this.preview,exclusions:this.preview.exclusions.slice(0,100),exclusionCount:this.preview.exclusions.length}:null,configured:!!e?.config?.lastBackup,needsApproval:!!this.preview&&!!this.saved&&this.preview.hash!==this.saved.permit.planHash,destination:e?.providerType||null,automatic:!!e?.config?.automatic,lastBackup:e?.config?.lastBackup||null,lastRestore:e?.config?.lastRestore||null,storedBytes:e?.config?.storedBytes||0,cloudReady:false,cloudDeferred:true,price:estimate(0)};}
  async acquireLock(){
    const file=path.join(this.root,'operation.lock');
    try{return await fs.open(file,'wx');}catch(e){if(e.code!=='EEXIST')throw e;}
    const before=await fs.lstat(file);if(!before.isFile()||before.isSymbolicLink()||before.size>1024)throw Object.assign(Error('invalid_lock'),{code:'EEXIST'});
    let owner;try{owner=JSON.parse(await fs.readFile(file,'utf8'));}catch{throw Object.assign(Error('invalid_lock'),{code:'EEXIST'});}
    if(!Number.isSafeInteger(owner.pid)||owner.pid<=0)throw Object.assign(Error('invalid_lock'),{code:'EEXIST'});
    let dead=false;try{process.kill(owner.pid,0);}catch(e){dead=e.code==='ESRCH';}if(!dead)throw Object.assign(Error('live_lock'),{code:'EEXIST'});
    const after=await fs.lstat(file);if(after.ino!==before.ino||after.mtimeMs!==before.mtimeMs||after.size!==before.size)throw Object.assign(Error('changed_lock'),{code:'EEXIST'});
    // The native parent additionally holds the OS state lock for this entire
    // worker lifetime. Preserve a dead worker's receipt instead of deleting it.
    await fs.rename(file,path.join(this.root,`stale-operation-${crypto.randomUUID()}.json`));return fs.open(file,'wx');
  }
  async operation(fn){if(this.busy||this.closing)throw Error('추천 자료 작업이 끝난 뒤 다시 눌러 주세요.');this.busy=true;this.error=null;this.onChange();let lock;const lockfile=path.join(this.root,'operation.lock');try{lock=await this.acquireLock();await lock.writeFile(JSON.stringify({pid:process.pid,at:new Date().toISOString()}));await lock.sync();return await fn();}catch(e){this.error=e.code==='EEXIST'?'다른 추천 작업의 잠금이 남아 있습니다. 기존 작업의 종료를 확인해 주세요.':this.engine?.clean(e.message)||e.message;throw Error(this.error);}finally{if(lock){await lock.close();await fs.unlink(lockfile);}this.busy=false;this.stage=null;this.onChange();}}
  async measure(request){return validateScan(JSON.parse(await this.scan(this.plannerPath,[],{sources:request.sources,exclusions:request.exclusions})));}
  async discover(){return this.operation(async()=>{
    this.stage='프로그램과 AI 작업 자료 찾는 중';this.onChange();const out=path.join(this.root,`inventory-${crypto.randomUUID()}`);await this.scan(this.inventoryPath,['--output',out,'--seconds','300','--max-entries','1000000']);
    const inv=JSON.parse(await fs.readFile(path.join(out,'inventory.json'),'utf8'));return this.previewRequest(candidates(inv,[this.root,...this.protectedPaths]),inv.programs);
  });}
  async previewRequest(request,programs=[]){
    this.stage='추천 자료 용량 확인 중';this.onChange();
    if(programs.length){
      if(programs.length>10000)throw Error('프로그램 목록이 너무 큽니다.');
      const base=path.join(process.env.LOCALAPPDATA||path.dirname(this.root),'WorkBackupPlanExports');await fs.mkdir(base,{recursive:true});await directory(base);
      const folder=path.join(base,crypto.randomUUID());await fs.mkdir(folder);const info=path.join(folder,'새-PC-준비.json');
      const list=programs.map(p=>({name:String(p.name||'').slice(0,1024),version:String(p.version||'').slice(0,128),publisher:String(p.publisher||'').slice(0,512),source:String(p.source||'').slice(0,128)}));
      await fs.writeFile(info,JSON.stringify({schema:1,createdAt:new Date().toISOString(),programs:list,originalPaths:request.sources,manualExports:request.manual||[],fileRestoreOnly:true,requiresReinstallAndSignIn:true},null,2),{flag:'wx'});
      request={...request,sources:minimal([...request.sources,info])};
    }
    const scan=await this.measure(request);const body={sources:scan.sources,exclusions:scan.exclusions,files:scan.files,bytes:scan.bytes,complete:scan.complete,errors:scan.errors,databases:scan.databases,manual:request.manual||[],discoveryComplete:request.discoveryComplete!==false,price:estimate(scan.bytes)};this.preview={...body,hash:digest(body)};this.request=request;await atomic(path.join(this.root,'preview.json'),JSON.stringify({preview:this.preview,request,programs}));this.onChange();return this.preview;
  }
  async start(input,{parent,keyFile}={}){return this.operation(async()=>{
    const permit=approval(this.preview,input);
    if(permit.destination==='b2')throw Error('추천 자료의 클라우드 확장은 보류 중입니다. 이번 시험판은 로컬 백업만 지원합니다.');
    if(this.engine?.config&&this.engine.providerType!==permit.destination)throw Error('기존 추천 저장소와 같은 로컬·클라우드 종류를 선택해 주세요. 기존 저장소는 유지됩니다.');
    const fresh=await this.measure(this.request);this.checkFresh(fresh,permit);
    const context=this.cloudContext?.();if(permit.destination==='b2'&&!context?.ready)throw Error('이 앱의 클라우드 연결과 외부 복구 키 보관을 먼저 완료해 주세요.');
    this.saved={permit,request:this.request};await atomic(path.join(this.root,'plan.json'),JSON.stringify(this.saved));
    if(!this.engine||(!this.engine.config&&this.engine.providerType!==permit.destination))await this.makeEngine(permit.destination);
    if(this.engine.providerType!==permit.destination)throw Error('이전과 같은 백업 위치로 다시 시도해 주세요.');
    if(!this.engine.config?.repositoryId)await this.engine.initialize(fresh,{parent,connection:context?.connection});
    this.engine.config.sources=fresh.sources;await this.engine.save();
    if(permit.destination==='b2'){await context.syncFor(this.engine);}else if(!this.engine.hasRecovery()){if(!keyFile)throw Error('복구 키를 별도 장소에 저장해 주세요.');await this.engine.saveRecoveryKit(keyFile);}
    await this.engine.backupPlan(fresh,permit);let registered=false;try{registered=await this.registerStartup?.();}catch{}
    this.engine.config.automatic=registered===true;this.engine.config.startupWarning=registered?null:'Windows 자동 실행을 확인하지 못했습니다. 앱 실행 중에만 사용할 수 있습니다.';await this.engine.save();return this.state();
  });}
  checkFresh(fresh,permit){if(!fresh.complete||fresh.errors.length)throw Error('읽지 못한 자료가 있어 백업을 보류했습니다.');if(digest(fresh.sources)!==digest(permit.sources)||digest(fresh.exclusions)!==digest(permit.exclusions))throw Error('포함·제외 경로가 바뀌었습니다. 추천 목록을 다시 확인해 주세요.');if(fresh.bytes>permit.sourceBytes*permit.growth||fresh.bytes*1.1>permit.maxBytes)throw Error('자료 용량이 승인 범위를 넘어 백업을 보류했습니다.');}
  async tick(){if(this.busy||this.closing||!this.saved||!this.engine?.config?.automatic)return;if(Date.now()-Date.parse(this.engine.config.lastBackup?.verifiedAt||0)<DAY)return;try{await this.operation(async()=>{const fresh=await this.measure(this.saved.request);this.checkFresh(fresh,this.saved.permit);await this.engine.backupPlan(fresh,this.saved.permit);});}catch(e){this.engine.config.automatic=false;this.engine.config.lastError=this.engine.clean(e.message);await this.engine.save().catch(()=>{});this.onChange();}}
  async backup(){return this.operation(async()=>{if(!this.saved||!this.engine?.config?.repositoryId)throw Error('추천 백업을 먼저 준비해 주세요.');const fresh=await this.measure(this.saved.request);this.checkFresh(fresh,this.saved.permit);return this.engine.backupPlan(fresh,this.saved.permit);});}
  async restore(parent){return this.operation(async()=>{if(!this.engine?.config?.lastBackup)throw Error('추천 백업을 먼저 완료해 주세요.');return this.engine.restoreAll(parent);});}
  async stop(){this.closing=true;clearInterval(this.timer);while(this.busy)await new Promise(r=>setTimeout(r,100));await this.engine?.stop();}
}
module.exports={RecommendedBackup,RecommendedEngine,candidates,minimal,estimate,approval,exclusionPattern,native,validateScan,VERIFIED,restoreWhole};
