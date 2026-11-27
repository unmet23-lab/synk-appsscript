'use strict';
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {randomUUID}=require('node:crypto');
const {spawn,execFile} = require('node:child_process');
const exec=require('node:util').promisify(execFile);
const {candidatePaths}=require('./subscription-common.cjs');
const {ID:MEMBER}=require('./site-visits.cjs');
const {openTaskConsole}=require('./office-task-console.cjs');
const {runClaude}=require('./office-task-claude.cjs');
const {claudeSubscriber,readSubscriber}=require('./office-task-claude-hook.cjs');
const {createOfficeTasks}=require('./office-tasks.cjs');
const fail=code=>Object.assign(new Error(code),{code});
const inside=(child,parent)=>{const rel=path.relative(parent,child);return !path.isAbsolute(rel) && rel!=='..' && !rel.startsWith('..'+path.sep);};

function enabled({packaged,mode,clientId,platform,smoke}) {
  return packaged===false && mode==='development' && clientId==='platform' && platform==='win32' && !smoke;
}
// 기능 업무의 Claude 무인 실행은 --json-schema와 --tools ""를 함께 받는 판에서만 돈다(11-23 2.1.323 실측)
function supportsSchema(version){
  const match=/^(\d+)\.(\d+)\.(\d+)(?:\s|$)/.exec(String(version).trim());
  if(!match)return false;
  const [major,minor,patch]=match.slice(1).map(Number);
  return major>2 || major===2 && (minor>1 || minor===1 && patch>=323);
}
function supportsPromptGuard(version){
  const match=/^(\d+)\.(\d+)\.(\d+)(?:\s|$)/.exec(version.trim());
  if(!match)return false;
  const [major,minor,patch]=match.slice(1).map(Number);
  return major>2 || major===2 && (minor>1 || minor===1 && patch>=295);
}
function employeeEnv(source){
  const env={...source};
  // Use the PC's signed-in CLI. A launcher may itself run inside a review profile or have an API key.
  const override=/^(?:ELECTRON_.*|NODE_OPTIONS|CLAUDECODE|CLAUDE_CONFIG_DIR|CLAUDE_CODE_(?:OAUTH_.*|API_KEY|ENTRYPOINT|CHILD_SESSION|USE_(?:BEDROCK|VERTEX|FOUNDRY))|CODEX_HOME|CODEX_API_KEY|CODEX_API_BASE_URL|OPENAI_(?:API_KEY|BASE_URL)|ANTHROPIC_(?:API_KEY|AUTH_TOKEN|BASE_URL|CUSTOM_HEADERS|PROFILE|CONFIG_DIR|FEDERATION_RULE_ID|ORGANIZATION_ID|IDENTITY_TOKEN(?:_FILE)?|SERVICE_ACCOUNT_ID|WORKSPACE_ID|MODEL|SMALL_FAST_MODEL|DEFAULT_[A-Z]+_MODEL)|CLAUDE_CODE_SUBAGENT_MODEL)$/i;
  for(const k of Object.keys(env)) if(override.test(k)||/^SOLIO_MAIL_/i.test(k)) delete env[k];
  return env;
}
async function native(name,env){
  const candidates=candidatePaths(name,{platform:'win32',env,home:os.homedir()});
  for(const file of candidates){
    if(!path.isAbsolute(file))continue;
    try {if(!(await fs.stat(file)).isFile())continue;}catch{continue;}
    if(path.extname(file).toLowerCase()==='.exe')return file;
    if(name!=='codex' || !['x64','arm64'].includes(process.arch))continue;
    // npm puts a shell shim on PATH. Locate its signed-in CLI's native package
    // in the same npm installation without ever executing the shim or its contents.
    const root=path.join(path.dirname(file),'node_modules','@openai');
    const vendor='codex-win32-'+process.arch;
    const triple=process.arch==='x64'?'x86_64-pc-windows-msvc':'aarch64-pc-windows-msvc';
    for(const location of [path.join(root,'codex','node_modules','@openai',vendor),path.join(root,vendor),path.join(root,'codex')]){
      for(const inner of ['bin','codex']){
        const exe=path.join(location,'vendor',triple,inner,'codex.exe');
        try{if((await fs.stat(exe)).isFile())return exe;}catch{}
      }
    }
  }
  throw fail('NO_CLI');
}
async function taskDirectory(userData,member,dept){
  if(typeof member!=='string' || !MEMBER.test(member)) throw fail('FOLDER');
  const realUserData=await fs.realpath(userData);
  if(!dept){
    const target=path.join(realUserData,'OfficeWork',member);
    await fs.mkdir(target,{recursive:true,mode:0o700});
    const real=await fs.realpath(target);
    if(path.relative(target,real)!=='')throw fail('FOLDER');
    return real;
  }
  const real=await fs.realpath(dept.folder);
  if(!(await fs.stat(real)).isDirectory() || /[\\/]AiSubscriptions[\\/]accounts(?:[\\/]|$)/i.test(real))throw fail('FOLDER');
  const protectedDirs=[realUserData,path.join(os.homedir(),'.claude'),path.join(os.homedir(),'.codex')];
  for(const dir of protectedDirs){
    const canonical=await fs.realpath(dir).catch(()=>path.resolve(dir));
    if(inside(real,canonical) || inside(canonical,real)) throw fail('FOLDER');
  }
  return real;
}
// Native CLIs on one Windows profile share a conversation picker. A previously
// approved sole viewer may bind this PC's workers. A later viewer cannot inherit them.
async function ownsWorkers(userData,service,member,localAppData=process.env.LOCALAPPDATA){
  if(typeof member!=='string'||!MEMBER.test(member)||typeof service.viewersFile!=='string'||
      typeof localAppData!=='string'||!path.isAbsolute(localAppData))return false;
  const dir=path.join(localAppData,'synk','solio-office-dev','office-access');
  const file=path.join(dir,'employee-owner.json'), officeDir=path.join(userData,'Office');
  async function readOwner(from){
    if((await fs.stat(from)).size>1024)return false;
    return JSON.parse(await fs.readFile(from,'utf8'))?.member===member;
  }
  async function soleViewer(from){
    if((await fs.stat(from)).size>65536)return false;
    const ids=JSON.parse(await fs.readFile(from,'utf8')).synk_user_ids;
    return Array.isArray(ids)&&ids.length===1&&ids[0]===member;
  }
  try{
    for(const root of [officeDir,path.join(userData,'OfficeWork')]){
      let entries;
      try{entries=await fs.readdir(root,{withFileTypes:true});}catch(e){if(e.code==='ENOENT')continue;throw e;}
      for(const entry of entries){
        if(entry.name===member || !MEMBER.test(entry.name))continue;
        if(entry.isSymbolicLink())return false;
        if(!entry.isDirectory())continue;
        if(root!==officeDir)return false;
        const names=await fs.readdir(path.join(root,entry.name));
        if(names.some(n=>/^(?:tasks\.json|answers)$/i.test(n)))return false;
      }
    }
    try{if(!await readOwner(path.join(officeDir,'employee-owner.json')))return false;}catch(e){if(e.code!=='ENOENT')throw e;}
    try{return await readOwner(file);}catch(e){if(e.code!=='ENOENT')throw e;}
    // The private first-use confirmation enrolls the owner in this fixed Windows
    // location. A fresh Electron userData or a custom viewer file cannot replace it.
    if(!await soleViewer(path.join(dir,'viewers.json')) || !await soleViewer(service.viewersFile))return false;
    const tmp=path.join(dir,'employee-owner-'+randomUUID()+'.tmp');
    await fs.writeFile(tmp,JSON.stringify({member}),{flag:'wx',mode:0o600});
    try{await fs.link(tmp,file);}catch(e){if(e.code!=='EEXIST')throw e;}
    finally{await fs.rm(tmp,{force:true});}
    return await readOwner(file);
  }catch{return false;}
}
/* 기능 업무의 차례 고르기(사업계획서 설계 14.3, 설계 검토 2). 차례마다 {provider, model}을 고를 수 있다.
   업무 줄의 회사(spec.provider)는 처음에 판 · 계정을 보고, 곁 회사(spec.alsoProviders, 손님이 켠 「다른 회사 심사위원」)는
   처음 부를 때 연다. 곁 회사가 막히면 그 회사의 차례만 실패한다. 시험은 deps를 바꿔 끼운다 */
async function featureRun({spec,hooks,file,env,cwd,run},deps={}){
  const st=require('./office-schema-turn.cjs');
  const d={native,exec,spawn,claudeAccount:st.claudeAccount,claudeSchemaTurn:st.claudeSchemaTurn,
    withSchemaAccount:(...a)=>require('./office-task-codex.cjs').withSchemaAccount(...a),...deps};
  const codes={ai:'PROVIDER',timeout:'PROVIDER'};
  const also=(Array.isArray(spec.alsoProviders)?spec.alsoProviders:[]).filter(p=>['claude','codex'].includes(p)&&p!==spec.provider);
  let claudeReady=null;
  const claudeOpen=()=>claudeReady??=(async()=>{
    const exe=spec.provider==='claude'?file:await d.native('claude',env);
    const {stdout}=await d.exec(exe,['--version'],{env,signal:hooks.signal,timeout:10000,maxBuffer:8192,windowsHide:true,shell:false});
    if(!supportsSchema(stdout))throw fail('NO_CLI');
    const first=await d.claudeAccount({file:exe,cwd,env,signal:hooks.signal});
    if(!first)throw fail('LOGIN');
    return {exe,first};
  })();
  const claudeTurn=async(prompt,schema,options)=>{
    const {exe,first}=await claudeOpen();
    if(await d.claudeAccount({file:exe,cwd,env,signal:hooks.signal})!==first)throw fail('LOGIN');
    // 곁 회사 동의는 보내기 바로 앞에 동기로 본다. 이 뒤로 기다림 없이 프롬프트를 쓴다(설계 검토 D1)
    if(typeof options.allow==='function'&&!options.allow())throw fail('OFF');
    return d.claudeSchemaTurn({file:exe,env,spawn:d.spawn,cwd,prompt,schema,model:typeof options.model==='string'?options.model:null,signal:hooks.signal,
      timeoutMs:options.timeoutMs,codes,onInit:typeof options.onInit==='function'?options.onInit:null});
  };
  if(spec.provider==='claude')await claudeOpen();
  let codexDown='LOGIN';
  const go=ask=>run({providers:[spec.provider,...also].filter(p=>p!=='codex'||ask),asked:[spec.provider,...also],turn:(prompt,schema,options={})=>{
    const {provider=spec.provider,...rest}=options;
    if(provider==='claude'&&(spec.provider==='claude'||also.includes('claude')))return claudeTurn(prompt,schema,rest);
    if(provider==='codex'&&ask){const {onInit,...codex}=rest;return ask(prompt,schema,codex);}
    return Promise.reject(fail(provider==='codex'?codexDown:'LOGIN'));
  }});
  if(spec.provider!=='codex'&&!also.includes('codex'))return go(null);
  let exe=file;
  if(spec.provider!=='codex'){try{exe=await d.native('codex',env);}catch(e){codexDown=e.code==='NO_CLI'?'NO_CLI':'LOGIN';return go(null);}}
  let started=false,finished=false,result;
  try{
    return await d.withSchemaAccount({...spec,cwd},hooks,{file:exe,env,spawn:d.spawn},
      ask=>{started=true;return go(ask).then(r=>{finished=true;result=r;return r;});},codes);
  }catch(e){
    // 취소는 업무가 끝난 뒤의 마지막 확인에서 와도 취소다(GPT 검수 2회차 GA1)
    if(e.code==='CANCELLED')throw e;
    // 업무가 끝난 뒤 마지막 계정 확인에서 로그인이 바뀌었으면 결과를 돌려준다. 그 차례들은 차례마다 계정을 봤다(GPT 검수 GA10)
    if(finished)return result;
    if(spec.provider==='codex')throw e;
    if(started)throw e;
    // 곁 회사 연결이 안 되면 Codex 자리만 비우고 돈다
    codexDown=['LOGIN','NO_CLI','LIMIT'].includes(e.code)?e.code:'LOGIN';
    return go(null);
  }
}
function createTaskRuntime({userData,current,office,model,changed,mailOptions,featureOptions={}}){
  let tasks=null;
  const features=require('./office-features.cjs').createOfficeFeatures({userData,tasks:()=>tasks,pick:featureOptions.pick,reveal:featureOptions.reveal,
    departments:async a=>{const s=await (await office()).snapshot(a);return s?.available&&Array.isArray(s.departments)?s.departments:[];}});
  async function context(a,departmentId,{folder=true}={}){
    const s=await (await office()).snapshot(a);
    if(!s?.available)return {ok:false,code:'NOT_ALLOWED'};
    const dept=departmentId===null?null:s.departments.find(d=>d.id===departmentId);
    if(departmentId!==null && !dept)return {ok:false,code:'FOLDER'};
    if(!folder){
      // 기능 업무: 부서가 있는지와 수용 인원만 본다. 부서 폴더를 쓰지 않는다(설계 검토 11)
      if(!dept)return {ok:false,code:'FOLDER'};
      const {cap,toolCaps}=(await model()).officeCapacity({...s.pc,manual:s.settings?.manualCap});
      return {ok:true,cwd:'',name:dept.name,role:'',cap,toolCaps};
    }
    let cwd;
    try {cwd=await taskDirectory(userData,a.synk_user_id,dept);}catch{return {ok:false,code:'FOLDER'};}
    const {cap,toolCaps}=(await model()).officeCapacity({...s.pc,manual:s.settings?.manualCap});
    return {ok:true,cwd,name:dept?.name||'사무실',role:dept?.role||'',cap,toolCaps};
  }
  async function run(spec,hooks){
    const env=employeeEnv(process.env), base=path.join(userData,'OfficeTaskRuns');
    await fs.mkdir(base,{recursive:true,mode:0o700});
    const file=await native(spec.provider,env);
    if(spec.feature)return runFeature(spec,hooks,{file,env});
    if(spec.mailSearch){
      if(spec.provider!=='codex')throw fail('MAIL_PLAN');
      return require('./office-mail-plan.cjs').planMail(spec,hooks,{file,env,spawn});
    }
    if(spec.provider==='claude'){
      const {stdout}=await exec(file,['--version'],{env,signal:hooks.signal,timeout:10000,maxBuffer:8192,windowsHide:true,shell:false});
      if(!supportsPromptGuard(stdout))throw fail('NO_CLI');
    }
    const nodeExe=await native('node',env);
    const tools={file,nodeExe,base,env,spawn,
      open:(file,args,cwd)=>openTaskConsole({file,args,cwd,env,base,nodeExe,signal:hooks.signal}),
      auth:(bin,signal,settings)=>readSubscriber(bin,spec.cwd,env,signal,settings),
    };
    return spec.provider==='claude'?runClaude(spec,hooks,tools):require('./office-task-codex.cjs').runCodex(spec,hooks,tools);
  }
  /* 기능 업무: 도구 없는 차례를 기능의 run에 건넨다(사업계획서_설계.md 5절). 작업 폴더는 비어 있는 고정 폴더 하나다.
     차례마다 {provider, model}을 고를 수 있다(설계 14.3, 설계 검토 2). 업무 줄의 회사(spec.provider)는 처음에 판 · 계정을 보고,
     곁 회사(spec.alsoProviders, 손님이 켠 「다른 회사 심사위원」)는 처음 부를 때 연다. 곁 회사가 막히면 그 차례만 실패한다 */
  async function runFeature(spec,hooks,{file,env}){
    const cwd=path.join(userData,'OfficeFeatureRun');
    await fs.mkdir(cwd,{recursive:true,mode:0o700});
    if((await fs.readdir(cwd)).length)throw fail('FOLDER');
    return featureRun({spec,hooks,file,env,cwd,run:tools=>features.run(spec,hooks,tools)});
  }
  const authorized=async a=>{const service=await office();return await service.allowed(a)&&await ownsWorkers(userData,service,a.synk_user_id);};
  const mail=mailOptions?require('./office-mail.cjs').createOfficeMail({...mailOptions,userData,current,authorized,changed}):null;
  tasks=createOfficeTasks({userData,current,authorized,context,run,mail,changed});
  return Object.assign(tasks,{features});
}
module.exports={enabled,createTaskRuntime,featureRun,employeeEnv,claudeSubscriber,native,taskDirectory,ownsWorkers,supportsPromptGuard,supportsSchema};
