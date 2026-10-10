'use strict';
// 전달 폴더: 새 Platform 설치 파일 + 바뀌지 않은 WORLD·Workspace 설치 파일을 하드 링크로 모은다(복사·설치 없음).
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../../..'),qa=__dirname;
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const result=JSON.parse(fs.readFileSync(path.join(qa,'package-result.json'))),verification=JSON.parse(fs.readFileSync(path.join(qa,'verification.json')));
if(!verification.ok)throw Error('verification not ok');
const dest=path.join(root,'desktop/artifacts/platform-reinstall-signal2-20261010'),prevDir=path.join(root,'desktop/artifacts/platform-reinstall-20261010');
if(fs.existsSync(dest))throw Error('delivery folder exists');
const prevManifest=JSON.parse(fs.readFileSync(path.join(prevDir,'delivery-manifest.json')));
const files=[
  {clientId:'platform',source:path.join(root,result.installer.path),sha256:result.installer.sha256,bytes:result.installer.bytes,changed:true},
  ...prevManifest.files.filter(f=>f.clientId!=='platform').map(f=>({clientId:f.clientId,source:f.deliveryPath,sha256:f.sha256,bytes:f.bytes,changed:false}))];
fs.mkdirSync(dest,{recursive:true});const rows=[];
for(const f of files){
  if(hash(f.source)!==f.sha256||fs.statSync(f.source).size!==f.bytes)throw Error('source changed: '+f.source);
  const target=path.join(dest,path.basename(f.source));fs.linkSync(f.source,target);
  if(hash(target)!==f.sha256)throw Error('link mismatch: '+target);
  rows.push({clientId:f.clientId,deliveryPath:target,linkedFrom:f.source,bytes:f.bytes,sha256:f.sha256,linkType:'HardLink',changedFromPreviousReinstall:f.changed});
}
const manifest={createdAt:new Date().toISOString(),status:'local-delivery-links-created',version:'0.4.0',platform:'win32',arch:'x64',
  purpose:'Platform reinstall carrying the signal-2 screens (same as the current PC install) and the teacher-cover image without C2PA. WORLD and Workspace installers are the unchanged 10-10 files.',
  supersedes:'desktop/artifacts/platform-reinstall-20261010 (its Platform installer has the pre-signal-2 screens)',
  installerExecuted:false,publicUpload:false,localPersonalUseOnly:true,files:rows};
fs.writeFileSync(path.join(dest,'delivery-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
fs.writeFileSync(path.join(qa,'delivery-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({ok:true,dest,files:rows.map(r=>({id:r.clientId,bytes:r.bytes,changed:r.changedFromPreviousReinstall}))}));
