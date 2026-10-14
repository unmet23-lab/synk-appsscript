'use strict';
// Freeze reviewed product source once. Does not build, publish or inspect a profile.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {sourceHash}=require('./source-hash.cjs');
const assert=(value,message)=>{if(!value)throw Error(message);};
const digest=data=>crypto.createHash('sha256').update(data).digest('hex');
function inventory(root,relative='') { return fs.readdirSync(path.join(root,relative),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en')).flatMap(entry=>{const name=path.posix.join(relative,entry.name),file=path.join(root,name);assert(!entry.isSymbolicLink(),'Source links are forbidden');return entry.isDirectory()?inventory(root,name):[{path:name,bytes:fs.statSync(file).size,sha256:digest(fs.readFileSync(file))}];}); }
function audit(root,files) {
  const patterns=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/gh[pousr]_[A-Za-z0-9_]{20,}/,/sb_secret_[A-Za-z0-9_-]+/,/C:\\Users\\[^\\\s"']+/i];
  for(const item of files){assert(!/(?:\.env$|\.log$|\.pem$|\.pfx$|\.p12$|\.key$|\.sqlite|\.db$|auth\.json$|cookies|vault\.json|credentials)/i.test(item.path),'Private source filename: '+item.path);if(/\.(?:cjs|mjs|js|json|html|txt)$/.test(item.path)){const contents=fs.readFileSync(path.join(root,item.path),'utf8');assert(!patterns.some(pattern=>pattern.test(contents)),'Private source content: '+item.path);}}
}
function freeze({source,output,definition}) {
  assert(!fs.existsSync(output),'Preserve existing frozen release');
  assert(definition.schemaVersion===1&&definition.product==='platform'&&definition.channel==='preview'&&/^\d+\.\d+\.\d+$/.test(definition.version),'Invalid preview definition');
  assert(definition.releaseId==='platform-preview-'+definition.version&&/^\d{8}\.\d+$/.test(definition.buildId),'Release/build identity mismatch');
  const stage=path.join(output,'source');fs.mkdirSync(stage,{recursive:true});
  for(const dir of ['src','renderer','assets'])fs.cpSync(path.join(source,dir),path.join(stage,dir),{recursive:true});
  const files=inventory(stage);audit(stage,files);
  const contract={...definition,electronVersion:'44.5.1',sourceHash:sourceHash(stage),sourceFiles:files};
  fs.writeFileSync(path.join(output,'release-input.json'),JSON.stringify(contract,null,2)+'\n');
  return {ok:true,releaseId:contract.releaseId,buildId:contract.buildId,sourceHash:contract.sourceHash,sourceFiles:files.length,sourceBytes:files.reduce((sum,file)=>sum+file.bytes,0)};
}
if(require.main===module){try{const args=Object.fromEntries(process.argv.slice(2).map(arg=>{const match=/^--(source|out|definition)=(.+)$/.exec(arg);assert(match,'Unsupported argument');return [match[1],path.resolve(match[2])];}));assert(args.source&&args.out&&args.definition,'Use --source=desktop --out=release --definition=definition.json');console.log(JSON.stringify(freeze({source:args.source,output:args.out,definition:JSON.parse(fs.readFileSync(args.definition))})));}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={freeze,inventory,audit,digest};
