'use strict';
// 싱ㅋ 시그널 2 Platform 재설치 파일. 10-10 재설치(attempt2)의 Platform stage·win-unpacked에서
// 화면 파일 5개(현재 PC 설치본과 같은 바이트)와 교사 그림(C2PA를 뺀 판)만 바꿔 같은 NSIS 설정으로 굽는다.
// WORLD·Workspace 자식 설치 파일, 실행 파일, 인증·runtime·metadata는 그대로. 설치·공개는 하지 않는다.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),os=require('node:os');
const root=path.resolve(__dirname,'../../../..'),desktop=path.join(root,'desktop'),qa=__dirname;
const asar=require(path.join(desktop,'node_modules/@electron/asar'));
const {build,Platform,Arch}=require(path.join(desktop,'node_modules/electron-builder'));
const prev=path.join(root,'.tmp/platform-reinstall-20261010/attempt2/platform'),prevQa=path.join(root,'docs/_ops/qa/platform-reinstall-20261010');
const out=path.join(root,'.tmp/platform-reinstall-signal2-20261010/platform');
const installed=path.join(process.env.LOCALAPPDATA,'Programs/SYNKPlatformPreview/resources/app.asar');
const digest=b=>crypto.createHash('sha256').update(b).digest('hex'),hash=f=>digest(fs.readFileSync(f));
const assert=(ok,msg)=>{if(!ok)throw Error(msg);};
const json=(f,v)=>{fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(v,null,2)+'\n');};
const list=a=>asar.listPackage(a).map(v=>v.replaceAll('\\','/').replace(/^\//,'')).sort();
const PREV_ASAR='eaa006fec10921cbb2681fd52f791fa1ac3ceb008097a951be684209160cf45e',INSTALLED_ASAR='c715de9ed040dc974127ef95ba6d629ed574a47a3c104b0b10a5182849f200a5';
const RENDERER=['renderer/launcher.css','renderer/member-home.css','renderer/convenience.css','renderer/member-home.mjs','renderer/index.html'];
const TEACHER='assets/launcher/teacher-cover.png',TEACHER_SHA='bd0a2570a1ffc8ff1149fb40f507e6a5ba51eb941e2c02206c110c03121ed75c';
(async()=>{
  assert(!fs.existsSync(out),'output exists; keep the earlier attempt');
  // 1) 입력 확인
  const prevAsar=path.join(prev,'win-unpacked/resources/app.asar');
  assert(hash(prevAsar)===PREV_ASAR,'previous Platform asar changed');
  assert(hash(installed)===INSTALLED_ASAR,'installed Platform asar is not the signal-2 install');
  const prevPkg=JSON.parse(fs.readFileSync(path.join(prevQa,'platform-package.json'))),prevCfg=JSON.parse(fs.readFileSync(path.join(prevQa,'platform-builder-config.json')));
  const teacher=fs.readFileSync(path.join(desktop,TEACHER));assert(digest(teacher)===TEACHER_SHA,'working-copy teacher-cover is not the stripped one');
  // 2) 복사(이전 attempt는 그대로 둔다)
  fs.mkdirSync(out,{recursive:true});
  fs.cpSync(path.join(prev,'stage'),path.join(out,'stage'),{recursive:true});
  fs.cpSync(path.join(prev,'win-unpacked'),path.join(out,'win-unpacked'),{recursive:true});
  const stage=path.join(out,'stage'),unpacked=path.join(out,'win-unpacked'),newAsar=path.join(unpacked,'resources/app.asar');
  // stage가 이전 asar와 같은지(파일 목록·내용)
  const prevList=list(prevAsar);
  for(const f of prevList){const p=path.join(stage,f);if(fs.statSync(p).isFile())assert(digest(asar.extractFile(prevAsar,path.normalize(f)))===hash(p),'stage differs from previous asar: '+f);}
  // 3) 바꾸기: 화면 파일은 현재 설치본 그대로, 교사 그림은 C2PA를 뺀 판
  const changed=[];
  for(const f of RENDERER){const b=asar.extractFile(installed,path.normalize(f));fs.writeFileSync(path.join(stage,f),b);changed.push({path:f,from:'installed signal-2 app.asar',sha256:digest(b),bytes:b.length});}
  fs.writeFileSync(path.join(stage,TEACHER),teacher);changed.push({path:TEACHER,from:'desktop/assets/launcher (C2PA removed, appsscript e6f55504a)',sha256:TEACHER_SHA,bytes:teacher.length});
  // 4) 새 asar
  fs.rmSync(newAsar);await asar.createPackage(stage,newAsar);asar.uncache(newAsar);
  const newList=list(newAsar);assert(JSON.stringify(newList)===JSON.stringify(prevList),'asar member list changed');
  const differ=[],sameAsInstalled=[];
  for(const f of newList){let a;try{a=asar.extractFile(newAsar,path.normalize(f));}catch{continue;}
    const p=digest(asar.extractFile(prevAsar,path.normalize(f))),n=digest(a),i=digest(asar.extractFile(installed,path.normalize(f)));
    if(p!==n)differ.push(f);if(i!==n)sameAsInstalled.push(f);}
  assert(JSON.stringify(differ.sort())===JSON.stringify([...RENDERER,TEACHER].sort()),'unexpected changed members: '+differ.join(','));
  assert(JSON.stringify(sameAsInstalled)===JSON.stringify([TEACHER]),'differs from installed beyond teacher-cover: '+sameAsInstalled.join(','));
  // 5) NSIS(이전과 같은 설정, 경로만 새 attempt)
  const config={...prevCfg,directories:{app:stage,output:path.join(out,'dist'),buildResources:path.join(stage,'assets')},win:{...prevCfg.win,icon:path.join(stage,'assets/platform.ico')}};
  json(path.join(qa,'platform-builder-config.json'),config);
  const exe=path.join(unpacked,config.executableName+'.exe'),beforeExe=hash(exe),beforeAsar=hash(newAsar);
  assert(beforeExe===prevPkg.executable.sha256,'executable differs from previous reinstall');
  const artifacts=await build({projectDir:stage,prepackaged:unpacked,targets:Platform.WINDOWS.createTarget('nsis',Arch.x64),config,publish:'never'});
  assert(hash(exe)===beforeExe&&hash(newAsar)===beforeAsar,'builder mutated payload');
  const installer=artifacts.find(f=>f.endsWith('.exe'));assert(installer&&fs.statSync(installer).size>1e6,'installer missing');
  const result={completedAt:new Date().toISOString(),ok:true,basis:'.tmp/platform-reinstall-20261010/attempt2/platform (Platform reinstall of 10-10 06:22, asar '+PREV_ASAR.slice(0,12)+')',
    changedMembers:changed,asar:{previous:PREV_ASAR,installedSignal2:INSTALLED_ASAR,new:beforeAsar,memberCount:newList.length,differsFromInstalledOnly:[TEACHER]},
    executable:{sha256:beforeExe,sameAsPrevious:true},installer:{path:path.relative(root,installer),sha256:hash(installer),bytes:fs.statSync(installer).size,executed:false},
    unchanged:['SYNKPlatformPreview.exe','resources/synk-install.json','resources/clients/world.exe','resources/clients/messenger.exe','runtime.json (child release pins)','package.json','auth'],
    version:'0.4.0',appId:config.appId,publish:'never',publicUpload:false,installerExecuted:false,host:os.hostname()};
  json(path.join(qa,'package-result.json'),result);console.log(JSON.stringify({ok:true,installer:result.installer,asar:beforeAsar}));
})().catch(e=>{json(path.join(qa,'build-failure.json'),{at:new Date().toISOString(),message:e.message});console.error(e.stack||e.message);process.exitCode=1;});
