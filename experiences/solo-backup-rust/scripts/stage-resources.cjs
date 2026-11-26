'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const RESTIC='b0dd1fd21eea5d8fe1325f55f7118213c21f36de8a261e04c0624a5ab9fd7830';
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const {FILES:UI_FILES,DIST}=require('./stage-ui.cjs');
// The engine screen as stage-ui.cjs left it in dist/ — every file of its list, each a plain file. They go to resources/ui/
// with their hashes in the manifest: SYNK 솔리오 shows this screen from the installed folder and serves only what the
// manifest lists, as it lists it (SOLIO_ONE_CLIENT.md 2.2).
async function uiFiles(dist=DIST){
  const out=[];
  for(const name of UI_FILES){const source=path.join(dist,...name.split('/'));const st=await fs.lstat(source).catch(()=>null);if(!st||st.isSymbolicLink()||!st.isFile())throw Error(`UI file missing: ${name} in ${dist} (run stage-ui.cjs first)`);out.push([name,await fs.readFile(source)]);}
  return out;
}
async function stage({node,restic,output,client,inventoryBin,ui}) {
  output=path.resolve(output);
  if(await fs.stat(output).then(()=>true,()=>false))throw Error('Output must be a new directory');
  // 1단계부터 엔진은 이 패키지 안의 갈래(engine/)다 — 0.5.0(../solo-backup)은 동결(STAGE1_DESIGN 4.1).
  const self=path.resolve(__dirname,'..'),engine=path.resolve(self,'engine');
  const resticBytes=await fs.readFile(restic);if(hash(resticBytes)!==RESTIC)throw Error('Restic hash mismatch');
  const screen=await uiFiles(ui);
  await fs.mkdir(output,{recursive:true});const files={};
  async function put(name,bytes){const dest=path.join(output,name);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.writeFile(dest,bytes,{flag:'wx'});files[name]={size:bytes.length,sha256:hash(bytes)};}
  async function tree(source,prefix){for(const item of await fs.readdir(source,{withFileTypes:true})){if(item.isSymbolicLink())throw Error('Bundle links forbidden');const relative=prefix+'/'+item.name;if(item.isDirectory())await tree(path.join(source,item.name),relative);else if(item.isFile())await put(relative,await fs.readFile(path.join(source,item.name)));}}
  await put('node.exe',await fs.readFile(node));await put('restic.exe',resticBytes);
  if(!inventoryBin)throw Error('inventoryBin directory required');
  for(const name of ['WorkBackupInventory.exe','WorkBackupPlanner.exe'])await put(name,await fs.readFile(path.join(inventoryBin,name)));
  await tree(path.join(self,'worker'),'worker');await tree(path.join(self,'contract'),'contract');
  // The engine's data files go too: 옮겨 오기's app table (move-apps.json) is read by the window and the run (4.6b).
  for(const name of await fs.readdir(path.join(engine,'src'))){if(!/\.(cjs|json)$/.test(name)||['main.cjs','preload.cjs','startup.cjs'].includes(name))continue;await put('engine/src/'+name,await fs.readFile(path.join(engine,'src',name)));}
  for(const name of ['package.json','package-lock.json','THIRD_PARTY_NOTICES.txt'])await put('engine/'+name,await fs.readFile(path.join(engine,name)));
  await tree(path.join(engine,'node_modules'),'engine/node_modules');
  for(const [name,bytes] of screen)await put('ui/'+name,bytes);
  if(client&&client!=='--none'){const value=JSON.parse(await fs.readFile(client,'utf8'));const {clientConfig}=require(path.join(engine,'src/recovery-auth.cjs'));const publicClient=clientConfig(value);await put('recovery-client.json',Buffer.from(JSON.stringify({installed:publicClient})));}
  const manifest={version:1,appVersion:'0.7.5',resticVersion:'0.19.1',files};
  await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2),{flag:'wx'});
  return {output,files:Object.keys(files).length,bytes:Object.values(files).reduce((sum,f)=>sum+f.size,0),manifestSha256:hash(Buffer.from(JSON.stringify(manifest,null,2)))};
}
module.exports={stage,uiFiles,UI_FILES};
if(require.main===module){const [node,restic,output,client,inventoryBin]=process.argv.slice(2);if(!node||!restic||!output)throw Error('Usage: stage-resources <node.exe> <restic.exe> <new-output> <public-oauth-client-or-empty> <inventory-bin>');stage({node,restic,output,client,inventoryBin}).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.message);process.exitCode=1;});}
