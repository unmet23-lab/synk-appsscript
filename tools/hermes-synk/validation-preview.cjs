'use strict';
// Read-only preparation against the admission snapshot. This is the same
// validator used after native CLI exit, but it never authorizes/applies a merge.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {walk,POLICY,CAP,fingerprint}=require('./integration.cjs');
const {validatePrepared,completion,regular,VALIDATION_CONTRACT}=require('./validation.cjs');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const scoped=(rel,scope)=>scope.some(root=>rel===root||rel.startsWith(root+'/'));
const normalize=bytes=>new TextDecoder('utf8',{fatal:true}).decode(bytes).replace(/\r\n/g,'\n');
function attention(code){const error=new Error(code);error.code=code;throw error;}
function readJSON(file){if(fs.lstatSync(file).isSymbolicLink()||fs.statSync(file).size>1024*1024)attention('PREVIEW_RECEIPT_INVALID');return JSON.parse(fs.readFileSync(file,'utf8'));}
async function previewTask({taskDir}={}){
  let evidence;
  try{
    taskDir=path.resolve(taskDir);
    if(fs.lstatSync(taskDir).isSymbolicLink()||!fs.statSync(taskDir).isDirectory())attention('PREVIEW_RECEIPT_INVALID');
    taskDir=fs.realpathSync(taskDir);
    const request=readJSON(path.join(taskDir,'request.json')),receipt=readJSON(path.join(taskDir,'workspace.json'));
    if(!/^synk-[a-f0-9]{12}$/.test(request.id)||path.basename(taskDir)!==request.id||request.integration_policy!==POLICY
      ||receipt.state!=='ready'||receipt.taskId!==request.id||!receipt.sparse||!receipt.storageChecked||!receipt.ignoredScopeChecked
      ||!Array.isArray(receipt.scope)||receipt.scope.length>500)attention('PREVIEW_RECEIPT_INVALID');
    for(const name of ['workspace','snapshot-files']){
      const stat=fs.lstatSync(path.join(taskDir,name));
      if(stat.isSymbolicLink()||!stat.isDirectory())attention('PREVIEW_RECEIPT_INVALID');
    }
    const candidateRoot=fs.realpathSync(path.join(taskDir,'workspace')),sourceRoot=fs.realpathSync(path.join(taskDir,'snapshot-files'));
    const same=(a,b)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
    if(!same(fs.realpathSync(request.workspace_root),candidateRoot)||!same(fs.realpathSync(receipt.path),candidateRoot))attention('PREVIEW_RECEIPT_INVALID');
    const report=completion(taskDir,request),before=walk(sourceRoot),after=walk(candidateRoot,{skipCompletion:true});
    const changes=[],candidateFiles=[];let total=0,changedBytes=0;
    for(const rel of [...new Set([...before,...after])].sort()){
      if(!scoped(rel,receipt.scope))attention('WORKSPACE_SCOPE_VIOLATION');
      const old=before.includes(rel)?fs.readFileSync(regular(sourceRoot,rel)):null;
      const next=after.includes(rel)?fs.readFileSync(regular(candidateRoot,rel)):null;
      if(next){total+=next.length;candidateFiles.push({path:rel,sha256:hash(next)});}
      if(old&&next&&normalize(old)===normalize(next))continue;
      changedBytes+=(old?.length||0)+(next?.length||0);
      changes.push({path:rel,kind:!old?'add':!next?'delete':'modify',beforeSha256:old?hash(old):null,afterSha256:next?hash(next):null});
    }
    if(total>CAP.bytes||changedBytes>CAP.changedBytes||changes.length>CAP.changes)attention('INTEGRATION_CHANGE_LIMIT');
    const prepared={status:changes.length?'prepared':'no_changes',candidateRoot,sourceRoot,candidateFiles,changes,
      planFingerprint:fingerprint({candidateFiles,changes})};
    // Evidence stays in the native workspace-write boundary and is excluded
    // from source integration. No final receipts or source files are touched.
    const temp=path.join(candidateRoot,'.tmp');if(fs.existsSync(temp)&&fs.lstatSync(temp).isSymbolicLink())attention('VALIDATION_SYMLINK');
    const parent=path.join(temp,'synk-validation-preview');fs.mkdirSync(parent,{recursive:true});
    if(fs.lstatSync(parent).isSymbolicLink())attention('VALIDATION_SYMLINK');
    evidence=path.join(parent,Date.now()+'-'+crypto.randomBytes(5).toString('hex'));fs.mkdirSync(evidence);
    const result=await validatePrepared({taskDir,request,prepared,report,evidenceRoot:evidence});
    const output={version:1,preview:true,validation_contract:VALIDATION_CONTRACT,status:result.status,needs_attention:false,
      changes:changes.map(item=>item.path),checks:result.checks,checkedAt:new Date().toISOString(),evidence};
    fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify(output,null,2)+'\n');
    return output;
  }catch(error){
    const result={version:1,preview:true,validation_contract:VALIDATION_CONTRACT,status:'needs_attention',needs_attention:true,
      reason_code:/^[A-Z_]{3,80}$/.test(error.code||'')?error.code:'PREVIEW_UNAVAILABLE',evidence};
    if(evidence)fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify(result,null,2)+'\n');
    return result;
  }
}
module.exports={previewTask};
if(require.main===module){const args=process.argv.slice(2);if(args.length!==2||args[0]!=='--task-dir'){process.exitCode=2;console.log(JSON.stringify({status:'needs_attention',reason_code:'INVALID_PREVIEW_ARGUMENT'}));}
  else previewTask({taskDir:args[1]}).then(result=>console.log(JSON.stringify(result))).catch(()=>{process.exitCode=2;console.log(JSON.stringify({status:'needs_attention',reason_code:'PREVIEW_UNAVAILABLE'}));});}
