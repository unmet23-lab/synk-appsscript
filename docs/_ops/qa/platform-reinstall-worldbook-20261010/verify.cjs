'use strict';
// WORLD 펠트 책 재설치 파일을 실행하지 않고 읽어서 검사한다. 비교 기준은 싱ㅋ 시그널 2 재설치(= 현재 PC 설치본).
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../../../..'),desktop=path.join(root,'desktop'),qa=__dirname,prevQa=path.join(root,'docs/_ops/qa/platform-reinstall-signal2-20261010');
const asar=require(path.join(desktop,'node_modules/@electron/asar'));
const {UUID}=require(path.join(desktop,'node_modules/builder-util-runtime'));
const tool='C:/Users/q1212/AppData/Local/electron-builder/Cache/7zip@1.0.0/7zip-win-x64-a34pt/bin/7za.exe';
const result=JSON.parse(fs.readFileSync(path.join(qa,'package-result.json'))),out=path.join(root,'.tmp/platform-reinstall-worldbook-20261010/platform');
const unpacked=path.join(out,'win-unpacked'),extracted=path.join(out,'extracted-payload'),installer=path.join(root,result.installer.path);
const digest=b=>crypto.createHash('sha256').update(b).digest('hex'),hash=f=>digest(fs.readFileSync(f));
const checks=[];const check=(name,ok,detail)=>{checks.push({name,ok:!!ok,...(detail?{detail}:{})});if(!ok)throw Error(name+(detail?': '+JSON.stringify(detail):''));};
const run=(args,log)=>{const p=spawnSync(tool,args,{windowsHide:true,encoding:'utf8',timeout:300000});fs.writeFileSync(path.join(qa,log+'.log'),(p.stdout||'')+(p.stderr||''));check(log+'-exit0',p.status===0&&!p.error);};
const all=(d,rel='')=>{const r=[];for(const e of fs.readdirSync(path.join(d,rel),{withFileTypes:true})){const f=path.join(rel,e.name);if(e.isDirectory())r.push(...all(d,f));else r.push(f.split(path.sep).join('/'));}return r.sort();};
try{
  check('installer-hash-and-bytes',hash(installer)===result.installer.sha256&&fs.statSync(installer).size===result.installer.bytes);
  run(['t',installer],'installer-crc');
  if(fs.existsSync(extracted))throw Error('preserve the previous extraction');
  fs.mkdirSync(extracted,{recursive:true});run(['x',installer,'-o'+extracted,'-y'],'payload-extraction');
  const expected=all(unpacked),actual=all(extracted);
  check('payload-file-set-equals-win-unpacked',JSON.stringify(expected)===JSON.stringify(actual),{expected:expected.length,actual:actual.length});
  check('payload-all-bytes-equal-win-unpacked',expected.every(f=>hash(path.join(unpacked,f))===hash(path.join(extracted,f))));
  const prevManifest=JSON.parse(fs.readFileSync(path.join(prevQa,'payload-manifest.json')));
  const prev=new Map(prevManifest.files.map(r=>[r.path,r.sha256]));
  const diff=actual.filter(f=>prev.get(f)!==hash(path.join(extracted,f))),missing=[...prev.keys()].filter(f=>!actual.includes(f));
  check('only-app-asar-differs-from-signal2-reinstall',JSON.stringify(diff)===JSON.stringify(['resources/app.asar'])&&missing.length===0,{diff,missing,files:actual.length});
  const archive=path.join(extracted,'resources/app.asar');
  check('payload-asar-is-new-build',hash(archive)===result.asar.new);
  const installed=path.join(process.env.LOCALAPPDATA,'Programs/SYNKPlatformPreview/resources/app.asar');
  const prevAsar=path.join(root,'.tmp/platform-reinstall-signal2-20261010/platform/win-unpacked/resources/app.asar');
  check('installed-is-signal2-build',hash(installed)===hash(prevAsar));
  const members=asar.listPackage(archive).map(v=>v.replaceAll('\\','/').replace(/^\//,''));const changed=[],added=[];
  for(const m of members){let b;try{b=asar.extractFile(archive,path.normalize(m));}catch{continue;}let p=null;try{p=asar.extractFile(prevAsar,path.normalize(m));}catch{added.push(m);continue;}if(digest(b)!==digest(p))changed.push(m);}
  const want=result.changedMembers.filter(r=>!r.added).map(r=>r.path).sort();
  check('asar-changes-vs-current-install',JSON.stringify(changed.sort())===JSON.stringify(want),changed);
  check('asar-added-only-world-book',JSON.stringify(added)===JSON.stringify(['assets/launcher/world-book.avif']),added);
  const book=asar.extractFile(archive,path.normalize('assets/launcher/world-book.avif'));
  check('world-book-equals-approved-source',book.equals(fs.readFileSync(path.join(root,'docs/Loom_자산/구움/공방_책.avif'))));
  check('no-generator-marks-in-new-or-changed-assets',[book,asar.extractFile(archive,path.normalize('assets/launcher/teacher-cover.png'))].every(b=>!/c2pa|openai|chatgpt|gpt-?image|trainedalgorithmicmedia/i.test(b.toString('latin1'))));
  for(const rel of ['renderer/state.mjs','renderer/member-home.mjs','renderer/index.html','renderer/launcher.css']){
    const committed=require('node:child_process').execFileSync('git',['cat-file','blob','6974907b536caea419f59a04fcb3551dc5ea1a88:desktop/'+rel],{cwd:root});
    check('renderer-equals-commit-'+rel,committed.equals(asar.extractFile(archive,path.normalize(rel))));}
  const state=asar.extractFile(archive,path.normalize('renderer/state.mjs')).toString('utf8');
  check('world-cover-is-felt-book',state.includes("cover:'world-book.avif'")&&!state.includes("cover:'world-cover.webp'"));
  const prevPkg=JSON.parse(fs.readFileSync(path.join(prevQa,'package-result.json')));
  check('runtime-json-unchanged',digest(asar.extractFile(archive,'runtime.json'))===digest(asar.extractFile(prevAsar,'runtime.json')));
  check('package-json-unchanged',digest(asar.extractFile(archive,'package.json'))===digest(asar.extractFile(prevAsar,'package.json')));
  check('synk-install-metadata-unchanged',hash(path.join(extracted,'resources/synk-install.json'))===prev.get('resources/synk-install.json'));
  check('executable-unchanged',hash(path.join(extracted,'SYNKPlatformPreview.exe'))===prevPkg.executable.sha256);
  const runtime=JSON.parse(asar.extractFile(archive,'runtime.json'));
  for(const r of runtime.releases){const f=path.join(extracted,'resources/clients',r.installer.relativePath);check(r.id+'-child-installer-matches-pin',hash(f)===r.installer.sha256&&fs.statSync(f).size===r.installer.bytes);}
  const cfg=JSON.parse(fs.readFileSync(path.join(qa,'platform-builder-config.json'))),prevCfg=JSON.parse(fs.readFileSync(path.join(prevQa,'platform-builder-config.json')));
  const guid=UUID.v5(cfg.appId,UUID.parse('50e065bc-3134-11e6-9bab-38c9862bdaf3'));
  check('nsis-guid-same-as-installed-registration',guid==='c4ee183e-8850-55ce-9d7f-a3a1acb8c830'&&cfg.executableName==='SYNKPlatformPreview'&&cfg.appId===prevCfg.appId,{guid});
  const strip=c=>JSON.stringify({...c,directories:undefined,win:{...c.win,icon:undefined}});
  check('builder-config-same-except-paths',strip(cfg)===strip(prevCfg));
  check('user-data-preserving-nsis-policy',cfg.nsis.deleteAppDataOnUninstall===false&&cfg.nsis.runAfterFinish===false&&cfg.nsis.perMachine===false&&cfg.nsis.allowElevation===false);
  const files=actual.map(p=>({path:p,bytes:fs.statSync(path.join(extracted,p)).size,sha256:hash(path.join(extracted,p))}));
  fs.writeFileSync(path.join(qa,'payload-manifest.json'),JSON.stringify({preparedAt:new Date().toISOString(),source:'Extracted NSIS payload of '+path.basename(installer)+' ('+result.installer.sha256.slice(0,8)+'…), equal to win-unpacked',files},null,2)+'\n');
  const res={completedAt:new Date().toISOString(),ok:true,checksPassed:checks.length,checks,payloadFiles:actual.length,installer:result.installer,installerExecuted:false,publicUpload:false};
  fs.writeFileSync(path.join(qa,'verification.json'),JSON.stringify(res,null,2)+'\n');console.log(JSON.stringify({ok:true,checks:checks.length,payloadFiles:actual.length}));
}catch(e){fs.writeFileSync(path.join(qa,'verification.json'),JSON.stringify({completedAt:new Date().toISOString(),ok:false,error:e.message,checks},null,2)+'\n');console.error(e.message);process.exitCode=1;}
