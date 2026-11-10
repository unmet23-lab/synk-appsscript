'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const RESTIC='b0dd1fd21eea5d8fe1325f55f7118213c21f36de8a261e04c0624a5ab9fd7830';
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
async function stage({node,restic,output,client,inventoryBin}) {
  output=path.resolve(output);
  if(await fs.stat(output).then(()=>true,()=>false))throw Error('Output must be a new directory');
  const self=path.resolve(__dirname,'..'),engine=path.resolve(self,'../solo-backup');
  const resticBytes=await fs.readFile(restic);if(hash(resticBytes)!==RESTIC)throw Error('Restic hash mismatch');
  await fs.mkdir(output,{recursive:true});const files={};
  async function put(name,bytes){const dest=path.join(output,name);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.writeFile(dest,bytes,{flag:'wx'});files[name]={size:bytes.length,sha256:hash(bytes)};}
  async function tree(source,prefix){for(const item of await fs.readdir(source,{withFileTypes:true})){if(item.isSymbolicLink())throw Error('Bundle links forbidden');const relative=prefix+'/'+item.name;if(item.isDirectory())await tree(path.join(source,item.name),relative);else if(item.isFile())await put(relative,await fs.readFile(path.join(source,item.name)));}}
  await put('node.exe',await fs.readFile(node));await put('restic.exe',resticBytes);
  if(!inventoryBin)throw Error('inventoryBin directory required');
  for(const name of ['WorkBackupInventory.exe','WorkBackupPlanner.exe'])await put(name,await fs.readFile(path.join(inventoryBin,name)));
  await tree(path.join(self,'worker'),'worker');await tree(path.join(self,'contract'),'contract');
  for(const name of await fs.readdir(path.join(engine,'src'))){if(!name.endsWith('.cjs')||['main.cjs','preload.cjs','startup.cjs'].includes(name))continue;await put('engine/src/'+name,await fs.readFile(path.join(engine,'src',name)));}
  for(const name of ['package.json','package-lock.json','THIRD_PARTY_NOTICES.txt'])await put('engine/'+name,await fs.readFile(path.join(engine,name)));
  await tree(path.join(engine,'node_modules'),'engine/node_modules');
  if(client&&client!=='--none'){const value=JSON.parse(await fs.readFile(client,'utf8'));const {clientConfig}=require(path.join(engine,'src/recovery-auth.cjs'));const publicClient=clientConfig(value);await put('recovery-client.json',Buffer.from(JSON.stringify({installed:publicClient})));}
  const manifest={version:1,appVersion:'0.6.1-rust-beta.1',resticVersion:'0.19.1',files};
  await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2),{flag:'wx'});
  return {output,files:Object.keys(files).length,bytes:Object.values(files).reduce((sum,f)=>sum+f.size,0),manifestSha256:hash(Buffer.from(JSON.stringify(manifest,null,2)))};
}
module.exports={stage};
if(require.main===module){const [node,restic,output,client,inventoryBin]=process.argv.slice(2);if(!node||!restic||!output)throw Error('Usage: stage-resources <node.exe> <restic.exe> <new-output> <public-oauth-client-or-empty> <inventory-bin>');stage({node,restic,output,client,inventoryBin}).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.message);process.exitCode=1;});}
