'use strict';
// The passphrase arrives only on a private stdin pipe from the local masked prompt.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function need(v,c){if(!v)throw Error(c);}
function inside(root,p){const rel=path.relative(root,path.resolve(p));return rel!==''&&!rel.startsWith('..')&&!path.isAbsolute(rel);}
function exists(p){try{fs.lstatSync(p);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}}
function noLinks(root,target){
 need(inside(root,target),'RESTORE_PATH_INVALID');
 let current=root;
 for(const part of path.relative(root,path.resolve(target)).split(path.sep)){
  current=path.join(current,part);
  if(exists(current))need(!fs.lstatSync(current).isSymbolicLink(),'RESTORE_LINK_NOT_ALLOWED');
 }
}
function validatePlan(plan){
 need(typeof process.env.LOCALAPPDATA==='string'&&process.env.LOCALAPPDATA.length>0,'RESTORE_PRIVATE_AREA_MISSING');
 const root=path.resolve(plan.root),base=path.resolve(process.env.LOCALAPPDATA,'SYNK-Restore-Tests');
 need(inside(base,root),'RESTORE_ROOT_OUTSIDE_PRIVATE_AREA');
 need(!fs.lstatSync(base).isSymbolicLink()&&fs.statSync(root).isDirectory(),'RESTORE_ROOT_INVALID');
 noLinks(base,root);
 need(inside(fs.realpathSync(base),fs.realpathSync(root)),'RESTORE_ROOT_OUTSIDE_PRIVATE_AREA');
 need(Array.isArray(plan.targets)&&plan.targets.length>0,'RESTORE_TARGETS_INVALID');
 for(const t of plan.targets){
  noLinks(root,t.cipherPath);noLinks(root,t.outputPath);noLinks(root,t.outputPath+'.part');
  need(!exists(t.outputPath),'RESTORE_OUTPUT_ALREADY_EXISTS');
  need(!exists(t.outputPath+'.part'),'RESTORE_PART_ALREADY_EXISTS');
 }
 return root;
}
async function run(plan,pass){
 const root=validatePlan(plan);
 const mod=require(path.join(plan.vault,'암호.js'));
 const locked=JSON.parse(fs.readFileSync(path.join(plan.keyDir,'비밀키_잠금.json'),'utf8'));
 const key=mod.unlockPrivate(locked,pass);
 const publicPem=fs.readFileSync(path.join(plan.keyDir,'공개키.pem'));
 need(mod.keyId(publicPem)===mod.keyId(crypto.createPublicKey(key).export({type:'spki',format:'pem'})),'KEY_PAIR_MISMATCH');
 const results=[];
 for(const t of plan.targets){
  need(inside(root,t.cipherPath)&&inside(root,t.outputPath),'RESTORE_PATH_INVALID');
  need(fs.statSync(t.cipherPath).size===t.encryptedBytes&&hash(t.cipherPath)===t.encryptedSha256,'CIPHER_MISMATCH');
  fs.mkdirSync(path.dirname(t.outputPath),{recursive:true});
  noLinks(root,t.outputPath);noLinks(root,t.outputPath+'.part');
  need(!exists(t.outputPath),'RESTORE_OUTPUT_ALREADY_EXISTS');
  need(!exists(t.outputPath+'.part'),'RESTORE_PART_ALREADY_EXISTS');
  const r=await mod.decryptFile(key,t.cipherPath,t.outputPath);
  need(fs.statSync(t.outputPath).size===t.plaintextBytes&&r.sha256===t.plaintextSha256&&hash(t.outputPath)===t.plaintextSha256,'RESTORED_HASH_MISMATCH');
  results.push({kind:t.kind,bytes:t.plaintextBytes,sha256:r.sha256,authenticatedDecrypt:true});
 }
 return {status:'success',checkedAt:new Date().toISOString(),actualUserKeyDecryptTested:true,keyFromOneDrive:true,files:results};
}
async function main(){
 const plan=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
 const root=validatePlan(plan),resultPath=path.join(root,'decrypt-result.json');
 noLinks(root,resultPath);
 need(!exists(resultPath),'RESTORE_RESULT_ALREADY_EXISTS');
 const chunks=[];let size=0;
 for await(const c of process.stdin){size+=c.length;need(size<=8192,'INPUT_LIMIT');chunks.push(c);}
 const passbuf=Buffer.concat(chunks);for(const b of chunks)b.fill(0);
 let result;
 try{result=await run(plan,passbuf.toString('utf8').replace(/\r?\n$/,''));}
 catch(e){result={status:'failed',checkedAt:new Date().toISOString(),code:/^[A-Z_]+$/.test(e.message)?e.message:'UNLOCK_OR_DECRYPT_FAILED'};process.exitCode=1;}
 finally{passbuf.fill(0);}
 noLinks(root,resultPath);
 fs.writeFileSync(resultPath,JSON.stringify(result,null,2),{flag:'wx',mode:0o600});
 console.log(JSON.stringify({status:result.status,files:result.files?.length||0,code:result.code}));
}
module.exports={run,inside};
if(require.main===module)main().catch(()=>{console.error('RESTORE_RUN_FAILED');process.exitCode=1;});
