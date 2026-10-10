'use strict';
// WORLD·Workspace 설치 파일 payload 목록을 만들고, 지금 설치된 폴더와 비교한다(설치 전 상태 기록).
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../../..'),qa=__dirname;
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const all=(d,rel='')=>{const r=[];for(const e of fs.readdirSync(path.join(d,rel),{withFileTypes:true})){const f=path.join(rel,e.name);if(e.isDirectory())r.push(...all(d,f));else r.push(f.split(path.sep).join('/'));}return r.sort();};
const apps={world:{folder:'SYNKWorldPreview',installer:'SYNK WORLD Preview-0.4.0-win-x64.exe',sha:'537578727fe799eecb0923b1b4b8dfa4778e188103a2113a2c9e8860b0b66ac4'},
  messenger:{folder:'SYNKMessengerPreview',installer:'SYNK Workspace Preview-0.4.0-win-x64.exe',sha:'b1028c0891ba7dfe69c0958c41eb3fc2b2b5569104682906b03da794f298f16b'}};
const summary={};
for(const [id,app] of Object.entries(apps)){
  const inst=path.join(root,'desktop/artifacts/platform-reinstall-signal2-20261010',app.installer);
  if(hash(inst)!==app.sha)throw Error(id+' installer changed');
  const ex=path.join(root,'.tmp/platform-reinstall-signal2-20261010',id+'-payload');
  const files=all(ex).map(p=>({path:p,bytes:fs.statSync(path.join(ex,p)).size,sha256:hash(path.join(ex,p))}));
  fs.writeFileSync(path.join(qa,id+'-payload-manifest.json'),JSON.stringify({preparedAt:new Date().toISOString(),installer:app.installer,installerSHA256:app.sha,files},null,2)+'\n');
  const prog=path.join(process.env.LOCALAPPDATA,'Programs',app.folder),installed=all(prog);
  const want=new Map(files.map(f=>[f.path,f.sha256]));
  const extra=installed.filter(p=>!want.has(p)),missing=files.filter(f=>!installed.includes(f.path)).map(f=>f.path);
  const differ=files.filter(f=>installed.includes(f.path)&&hash(path.join(prog,f.path))!==f.sha256).map(f=>f.path);
  summary[id]={payloadFiles:files.length,installedFiles:installed.length,extraInInstalled:extra,missingFromInstalled:missing,differentBytes:differ,asar:files.find(f=>f.path==='resources/app.asar').sha256};
}
console.log(JSON.stringify(summary,null,1));
fs.writeFileSync(path.join(qa,'children-before.json'),JSON.stringify({checkedAt:new Date().toISOString(),summary},null,2)+'\n');
