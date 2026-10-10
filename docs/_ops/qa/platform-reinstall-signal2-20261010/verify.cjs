'use strict';
// 새 Platform 재설치 파일을 실행하지 않고 읽어서 검사한다: 7-Zip CRC·내장 payload 추출 → win-unpacked·이전 재설치 payload와 대조.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../../../..'),desktop=path.join(root,'desktop'),qa=__dirname,prevQa=path.join(root,'docs/_ops/qa/platform-reinstall-20261010');
const asar=require(path.join(desktop,'node_modules/@electron/asar'));
const {UUID}=require(path.join(desktop,'node_modules/builder-util-runtime'));
const tool='C:/Users/q1212/AppData/Local/electron-builder/Cache/7zip@1.0.0/7zip-win-x64-a34pt/bin/7za.exe';
const result=JSON.parse(fs.readFileSync(path.join(qa,'package-result.json'))),out=path.join(root,'.tmp/platform-reinstall-signal2-20261010/platform');
const unpacked=path.join(out,'win-unpacked'),extracted=path.join(out,'extracted-payload'),installer=path.join(root,result.installer.path);
const digest=b=>crypto.createHash('sha256').update(b).digest('hex'),hash=f=>digest(fs.readFileSync(f));
const checks=[];const check=(name,ok,detail)=>{checks.push({name,ok:!!ok,...(detail?{detail}:{})});if(!ok)throw Error(name+(detail?': '+JSON.stringify(detail):''));};
const run=(args,log)=>{const p=spawnSync(tool,args,{windowsHide:true,encoding:'utf8',timeout:300000});fs.writeFileSync(path.join(qa,log+'.log'),(p.stdout||'')+(p.stderr||''));check(log+'-exit0',p.status===0&&!p.error);};
const all=(d,rel='')=>{const r=[];for(const e of fs.readdirSync(path.join(d,rel),{withFileTypes:true})){const f=path.join(rel,e.name);if(e.isDirectory())r.push(...all(d,f));else r.push(f.replaceAll('\\','/'));}return r.sort();};
try{
  check('installer-hash-and-bytes',hash(installer)===result.installer.sha256&&fs.statSync(installer).size===result.installer.bytes);
  run(['t',installer],'installer-crc');
  if(fs.existsSync(extracted))fs.rmSync(extracted,{recursive:true,force:true});
  fs.mkdirSync(extracted,{recursive:true});run(['x',installer,'-o'+extracted,'-y'],'payload-extraction');
  // 실제 payload = win-unpacked(바이트까지)
  const expected=all(unpacked),actual=all(extracted);
  check('payload-file-set-equals-win-unpacked',JSON.stringify(expected)===JSON.stringify(actual),{expected:expected.length,actual:actual.length});
  check('payload-all-bytes-equal-win-unpacked',expected.every(f=>hash(path.join(unpacked,f))===hash(path.join(extracted,f))));
  // 이전 재설치(10-10 06:22) payload와 비교: app.asar만 달라야 한다
  const prevManifest=JSON.parse(fs.readFileSync(path.join(prevQa,'platform-payload-manifest.json')));
  const prev=new Map(prevManifest.files.map(r=>[r.path.replaceAll('\\','/'),r.sha256]));
  const diff=actual.filter(f=>prev.get(f)!==hash(path.join(extracted,f))),missing=[...prev.keys()].filter(f=>!actual.includes(f));
  check('only-app-asar-differs-from-previous-reinstall',JSON.stringify(diff)===JSON.stringify(['resources/app.asar'])&&missing.length===0,{diff,missing,files:actual.length});
  const archive=path.join(extracted,'resources/app.asar');
  check('payload-asar-is-new-build',hash(archive)===result.asar.new);
  // asar 안: 이전과 다른 것은 화면 5개·교사 그림뿐, 현재 설치본과 다른 것은 교사 그림뿐
  const installed=path.join(process.env.LOCALAPPDATA,'Programs/SYNKPlatformPreview/resources/app.asar'),prevAsar=path.join(root,'.tmp/platform-reinstall-20261010/attempt2/platform/win-unpacked/resources/app.asar');
  const members=asar.listPackage(archive).map(v=>v.replaceAll('\\','/').replace(/^\//,''));let vsPrev=[],vsInstalled=[];
  for(const m of members){let b;try{b=asar.extractFile(archive,path.normalize(m));}catch{continue;}const n=digest(b);
    if(n!==digest(asar.extractFile(prevAsar,path.normalize(m))))vsPrev.push(m);if(n!==digest(asar.extractFile(installed,path.normalize(m))))vsInstalled.push(m);}
  check('asar-changes-vs-previous-reinstall',JSON.stringify(vsPrev.sort())===JSON.stringify(result.changedMembers.map(r=>r.path).sort()),vsPrev);
  check('asar-changes-vs-current-install',JSON.stringify(vsInstalled)===JSON.stringify(['assets/launcher/teacher-cover.png']),vsInstalled);
  const teacher=asar.extractFile(archive,path.normalize('assets/launcher/teacher-cover.png'));
  check('teacher-cover-has-no-generator-marks',!/c2pa|openai|chatgpt|gpt-?image|trainedalgorithmicmedia/i.test(teacher.toString('latin1')));
  // 인증·runtime·package·metadata·실행 파일·자식 설치 파일
  const prevPkg=JSON.parse(fs.readFileSync(path.join(prevQa,'platform-package.json')));
  check('runtime-json-unchanged',digest(asar.extractFile(archive,'runtime.json'))===digest(asar.extractFile(prevAsar,'runtime.json')));
  check('package-json-unchanged',digest(asar.extractFile(archive,'package.json'))===digest(asar.extractFile(prevAsar,'package.json')));
  check('synk-install-metadata-unchanged',hash(path.join(extracted,'resources/synk-install.json'))===prev.get('resources/synk-install.json'));
  check('executable-unchanged',hash(path.join(extracted,'SYNKPlatformPreview.exe'))===prevPkg.executable.sha256);
  const runtime=JSON.parse(asar.extractFile(archive,'runtime.json'));
  for(const r of runtime.releases){const f=path.join(extracted,'resources/clients',r.installer.relativePath);check(r.id+'-child-installer-matches-pin',hash(f)===r.installer.sha256&&fs.statSync(f).size===r.installer.bytes);}
  // NSIS 정체성: 같은 appId → 같은 GUID·폴더, 사용자 자료 보존 설정
  const cfg=JSON.parse(fs.readFileSync(path.join(qa,'platform-builder-config.json'))),prevCfg=JSON.parse(fs.readFileSync(path.join(prevQa,'platform-builder-config.json')));
  const ns=UUID.parse('50e065bc-3134-11e6-9bab-38c9862bdaf3'),guid=UUID.v5(cfg.appId,ns);
  const prevIdentity=JSON.parse(fs.readFileSync(path.join(prevQa,'nsis-identity.json'))).rows.find(r=>r.clientId==='platform');
  check('nsis-guid-and-folder-same-as-installed-registration',guid===prevIdentity.existingRegistryGuid&&cfg.executableName==='SYNKPlatformPreview'&&cfg.appId===prevCfg.appId,{guid});
  const strip=c=>JSON.stringify({...c,directories:undefined,win:{...c.win,icon:undefined}});
  check('builder-config-same-except-paths',strip(cfg)===strip(prevCfg));
  check('user-data-preserving-nsis-policy',cfg.nsis.deleteAppDataOnUninstall===false&&cfg.nsis.runAfterFinish===false&&cfg.nsis.perMachine===false&&cfg.nsis.allowElevation===false);
  const res={completedAt:new Date().toISOString(),ok:true,checksPassed:checks.length,checks,payloadFiles:actual.length,installer:result.installer,installerExecuted:false,publicUpload:false};
  fs.writeFileSync(path.join(qa,'verification.json'),JSON.stringify(res,null,2)+'\n');console.log(JSON.stringify({ok:true,checks:checks.length,payloadFiles:actual.length}));
}catch(e){fs.writeFileSync(path.join(qa,'verification.json'),JSON.stringify({completedAt:new Date().toISOString(),ok:false,error:e.message,checks},null,2)+'\n');console.error(e.message);process.exitCode=1;}
