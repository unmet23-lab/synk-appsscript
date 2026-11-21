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
function supportsPromptGuard(version){
  const match=/^(\d+)\.(\d+)\.(\d+)(?:\s|$)/.exec(version.trim());
  if(!match)return false;
  const [major,minor,patch]=match.slice(1).map(Number);
  return major>2 || major===2 && (minor>1 || minor===1 && patch>=295);
}
function employeeEnv(source){
  const env={...source};
  // Use the PC's signed-in CLI. A launcher may itself run inside a review profile or have an API key.
  const override=/^(?:ELECTRON_.*|NODE_OPTIONS|CLAUDECODE|CLAUDE_CONFIG_DIR|CLAUDE_CODE_(?:OAUTH_.*|API_KEY|ENTRYPOINT|CHILD_SESSION|USE_(?:BEDROCK|VERTEX|FOUNDRY))|CODEX_HOME|CODEX_API_KEY|CODEX_API_BASE_URL|OPENAI_(?:API_KEY|BASE_URL)|ANTHROPIC_(?:API_KEY|AUTH_TOKEN|BASE_URL|CUSTOM_HEADERS|PROFILE|CONFIG_DIR|FEDERATION_RULE_ID|ORGANIZATION_ID|IDENTITY_TOKEN(?:_FILE)?|SERVICE_ACCOUNT_ID|WORKSPACE_ID))$/i;
  for(const k of Object.keys(env)) if(override.test(k)) delete env[k];
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
function createTaskRuntime({userData,current,office,model,changed}){
  async function context(a,departmentId){
    const s=await (await office()).snapshot(a);
    if(!s?.available)return {ok:false,code:'NOT_ALLOWED'};
    const dept=departmentId===null?null:s.departments.find(d=>d.id===departmentId);
    if(departmentId!==null && !dept)return {ok:false,code:'FOLDER'};
    let cwd;
    try {cwd=await taskDirectory(userData,a.synk_user_id,dept);}catch{return {ok:false,code:'FOLDER'};}
    const {cap,toolCaps}=(await model()).officeCapacity({...s.pc,manual:s.settings?.manualCap});
    return {ok:true,cwd,name:dept?.name||'사무실',role:dept?.role||'',cap,toolCaps};
  }
  async function run(spec,hooks){
    const env=employeeEnv(process.env), base=path.join(userData,'OfficeTaskRuns');
    await fs.mkdir(base,{recursive:true,mode:0o700});
    const file=await native(spec.provider,env);
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
  const authorized=async a=>{const service=await office();return await service.allowed(a)&&await ownsWorkers(userData,service,a.synk_user_id);};
  return createOfficeTasks({userData,current,authorized,context,run,changed});
}
module.exports={enabled,createTaskRuntime,employeeEnv,claudeSubscriber,native,taskDirectory,ownsWorkers,supportsPromptGuard};
