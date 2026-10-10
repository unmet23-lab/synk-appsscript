'use strict';
// WORLD 펠트 책 Platform 재설치 파일. 싱ㅋ 시그널 2 재설치(현재 PC 설치본과 같은 판)의 stage·win-unpacked에서
// WORLD 변경(appsscript 6974907b5)만 얹는다: 화면 파일 4개의 해당 줄, world-book.avif 추가, 그림 목록 sources.json 두 줄.
// 실행 파일·자식 설치 파일·runtime·metadata·package는 그대로. 설치·공개는 하지 않는다.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../../..'),desktop=path.join(root,'desktop'),qa=__dirname;
const asar=require(path.join(desktop,'node_modules/@electron/asar'));
const {build,Platform,Arch}=require(path.join(desktop,'node_modules/electron-builder'));
const prev=path.join(root,'.tmp/platform-reinstall-signal2-20261010/platform'),prevQa=path.join(root,'docs/_ops/qa/platform-reinstall-signal2-20261010');
const out=path.join(root,'.tmp/platform-reinstall-worldbook-20261010/platform');
const installed=path.join(process.env.LOCALAPPDATA,'Programs/SYNKPlatformPreview/resources/app.asar');
const digest=b=>crypto.createHash('sha256').update(b).digest('hex'),hash=f=>digest(fs.readFileSync(f));
const assert=(ok,msg)=>{if(!ok)throw Error(msg);};
const json=(f,v)=>{fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(v,null,2)+'\n');};
const list=a=>asar.listPackage(a).map(v=>v.replaceAll('\\','/').replace(/^\//,'')).sort();
const swap=(t,from,to,count=1)=>{const n=t.split(from).length-1;assert(n===count,'expected '+count+' of '+from.slice(0,60)+' got '+n);return t.split(from).join(to);};
const PREV_ASAR=JSON.parse(fs.readFileSync(path.join(root,'docs/_ops/qa/platform-reinstall-signal2-20261010/package-result.json'))).asar.new;
const BOOK='assets/launcher/world-book.avif',BOOK_SHA='1b764c1a17ebe67d55dd6b66d56dfdfd0858575cc9e2db7a0910b661dab8be0e';
const B='.hero:is(.brand-messenger,.brand-care,.brand-fortune,.brand-family-album';
const edits={
  'renderer/state.mjs':t=>swap(t,"cover:'world-cover.webp',alt:'리듬 게임에 사용된 펠트 세계의 장면',caption:'SIGNAL RHYTHM · WORLD의 게임 아트'","cover:'world-book.avif',alt:'코랄색 표지에 크림색 장을 펼친 펠트 책',caption:'SYNK WORLD · 싱크 월드'"),
  'renderer/member-home.mjs':t=>swap(t,"const CUTOUT_ART=new Set(['laptop.webp'","const CUTOUT_ART=new Set(['world-book.avif','laptop.webp'"),
  'renderer/index.html':t=>swap(t,'src="/assets/launcher/world-cover.webp" alt="리듬 게임에 사용된 펠트 세계의 장면"','src="/assets/launcher/world-book.avif" alt="코랄색 표지에 크림색 장을 펼친 펠트 책"'),
  'renderer/launcher.css':t=>swap(swap(t,'장면(world-cover)은 흑백→곱하기 이중톤, 누끼 물건(노트북·메모·별·카메라)은','장면 그림은 흑백→곱하기 이중톤, 누끼 물건(책·노트북·메모·별·카메라)은'),B,'.hero:is(.brand-world,.brand-messenger,.brand-care,.brand-fortune,.brand-family-album',5),
  // 그림 목록(실행 중에는 읽지 않음): 교사 그림을 C2PA 뺀 값으로, 책 한 줄 추가
  'assets/launcher/sources.json':t=>swap(swap(swap(t,'747e85e5bb1e2bbb0fd86567c6bbe4b925c43e26a4ae4d8e847ef454a5f78c4f','bd0a2570a1ffc8ff1149fb40f507e6a5ba51eb941e2c02206c110c03121ed75c'),'"bytes": 1612282,','"bytes": 1588616,'),
    '      "sha256": "de50792266bbafb375e85be5b34799b6039246087c1146509a814643cc44d7be"\n    },\n','      "sha256": "de50792266bbafb375e85be5b34799b6039246087c1146509a814643cc44d7be"\n    },\n    {\n      "name": "world-book.avif",\n      "source": "docs/Loom_자산/구움/공방_책.avif",\n      "bytes": 790910,\n      "sha256": "'+BOOK_SHA+'"\n    },\n')};
(async()=>{
  assert(!fs.existsSync(out),'output exists; keep the earlier attempt');
  const prevAsar=path.join(prev,'win-unpacked/resources/app.asar');
  assert(hash(prevAsar)===PREV_ASAR,'previous (signal-2) asar changed');
  assert(hash(installed)===PREV_ASAR,'installed Platform is not the signal-2 reinstall');
  const prevPkg=JSON.parse(fs.readFileSync(path.join(prevQa,'package-result.json'))),prevCfg=JSON.parse(fs.readFileSync(path.join(prevQa,'platform-builder-config.json')));
  const book=fs.readFileSync(path.join(desktop,'assets/launcher/world-book.avif'));assert(digest(book)===BOOK_SHA,'world-book.avif is not the approved copy');
  assert(book.equals(fs.readFileSync(path.join(root,'docs/Loom_자산/구움/공방_책.avif'))),'world-book.avif differs from its source');
  fs.mkdirSync(out,{recursive:true});
  fs.cpSync(path.join(prev,'stage'),path.join(out,'stage'),{recursive:true});
  fs.cpSync(path.join(prev,'win-unpacked'),path.join(out,'win-unpacked'),{recursive:true});
  const stage=path.join(out,'stage'),unpacked=path.join(out,'win-unpacked'),newAsar=path.join(unpacked,'resources/app.asar');
  const prevList=list(prevAsar);
  for(const f of prevList){const p=path.join(stage,f);if(fs.statSync(p).isFile())assert(digest(asar.extractFile(prevAsar,path.normalize(f)))===hash(p),'stage differs from previous asar: '+f);}
  const changed=[];
  for(const [rel,fix] of Object.entries(edits)){const p=path.join(stage,rel),before=fs.readFileSync(p,'utf8'),after=fix(before);fs.writeFileSync(p,after,'utf8');changed.push({path:rel,before:digest(Buffer.from(before)),after:digest(Buffer.from(after))});}
  // 화면 파일은 저장소 커밋 판과 바이트까지 같아야 한다
  for(const rel of ['renderer/state.mjs','renderer/member-home.mjs','renderer/index.html','renderer/launcher.css']){
    const committed=require('node:child_process').execFileSync('git',['cat-file','blob','6974907b536caea419f59a04fcb3551dc5ea1a88:desktop/'+rel],{cwd:root});
    assert(committed.equals(fs.readFileSync(path.join(stage,rel))),'stage differs from commit 6974907b5: '+rel);}
  fs.writeFileSync(path.join(stage,BOOK),book);changed.push({path:BOOK,added:true,sha256:BOOK_SHA,bytes:book.length});
  fs.rmSync(newAsar);await asar.createPackage(stage,newAsar);asar.uncache(newAsar);
  const newList=list(newAsar);
  assert(JSON.stringify(newList)===JSON.stringify([...prevList,BOOK].sort()),'asar member list: expected exactly one added file');
  const differ=[];for(const f of prevList){let a;try{a=asar.extractFile(newAsar,path.normalize(f));}catch{continue;}if(digest(a)!==digest(asar.extractFile(prevAsar,path.normalize(f))))differ.push(f);}
  assert(JSON.stringify(differ.sort())===JSON.stringify(Object.keys(edits).sort()),'unexpected changed members: '+differ.join(','));
  const config={...prevCfg,directories:{app:stage,output:path.join(out,'dist'),buildResources:path.join(stage,'assets')},win:{...prevCfg.win,icon:path.join(stage,'assets/platform.ico')}};
  json(path.join(qa,'platform-builder-config.json'),config);
  const exe=path.join(unpacked,config.executableName+'.exe'),beforeExe=hash(exe),beforeAsar=hash(newAsar);
  assert(beforeExe===prevPkg.executable.sha256,'executable differs');
  const artifacts=await build({projectDir:stage,prepackaged:unpacked,targets:Platform.WINDOWS.createTarget('nsis',Arch.x64),config,publish:'never'});
  assert(hash(exe)===beforeExe&&hash(newAsar)===beforeAsar,'builder mutated payload');
  const installer=artifacts.find(f=>f.endsWith('.exe'));assert(installer&&fs.statSync(installer).size>1e6,'installer missing');
  const result={completedAt:new Date().toISOString(),ok:true,basis:'.tmp/platform-reinstall-signal2-20261010/platform (signal-2 reinstall, asar '+PREV_ASAR.slice(0,12)+', = current PC install)',
    source:'SYNK-appsscript 6974907b5 (WORLD felt book)',changedMembers:changed,asar:{previous:PREV_ASAR,new:beforeAsar,memberCount:newList.length,added:[BOOK]},
    executable:{sha256:beforeExe,sameAsPrevious:true},installer:{path:path.relative(root,installer),sha256:hash(installer),bytes:fs.statSync(installer).size,executed:false},
    unchanged:['SYNKPlatformPreview.exe','resources/synk-install.json','resources/clients/world.exe','resources/clients/messenger.exe','runtime.json','package.json','auth'],
    version:'0.4.0',appId:config.appId,publish:'never',publicUpload:false,installerExecuted:false};
  json(path.join(qa,'package-result.json'),result);console.log(JSON.stringify({ok:true,installer:result.installer,asar:beforeAsar}));
})().catch(e=>{json(path.join(qa,'build-failure.json'),{at:new Date().toISOString(),message:e.message});console.error(e.stack||e.message);process.exitCode=1;});
