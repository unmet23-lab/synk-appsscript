// Mac DMG를 받아, 앱 묶음은 바이트 그대로 두고 DMG 창만 시그널 디자인으로 다시 포장한다.
// 제품: platform(기본, 공개 0.4.3) · world · messenger(플랫폼 안에서 설치하는 공개 0.4.1 DMG). --source를 주면 그 DMG(예: 같은 CI에서 막 만든 플랫폼)를 쓴다.
// 바뀌는 것: 창 배경(background*.png·@2x), 아이콘 112pt·이름 13pt, 앱(180,200)·Applications(480,200) 자리, 파일 이름.
// macOS 전용. 서명·공증·설치·게시를 하지 않는다.
// 사용: node repackage.cjs --arch=arm64|x64 [--product=platform|world|messenger] [--source=<DMG>] [--revision=<이름>] [--shots]
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{execFileSync}=require('child_process');

const HERE=__dirname,RELEASES='https://github.com/unmet23-lab/synk-policy/releases/download/';
// published: 고정한 공개 DMG. 하위 앱 값은 platform-performance/manifest.json(0.4.3 플랫폼이 싣는 DMG)과 같다.
const PRODUCTS={
  platform:{app:'SYNKPlatformPreview.app',name:'SYNK Platform Preview',appId:'im.synk.platform.preview',packageName:'synk-platform-preview',version:'0.4.3',stem:'SYNK-Platform-Preview',background:'background.png',
    published:{release:'platform-preview-0.4.3-20261012',
      arm64:{file:'SYNK-Platform-Preview-0.4.3-mac-arm64.dmg',bytes:457408094,sha256:'e0796502af692e386aa28dacfae2492b1ca30e6241435213e4a73521cc32a28a'},
      x64:{file:'SYNK-Platform-Preview-0.4.3-mac-x64.dmg',bytes:475085655,sha256:'28919a62be30fb86733356ab7636c20b20f5257571eb7aa704f6b0946afbb333'}}},
  world:{app:'SYNKWorldPreview.app',name:'SYNK WORLD Preview',appId:'im.synk.world.preview',packageName:'synk-world-preview',version:'0.4.1',stem:'SYNK-WORLD-Preview',background:'background-world.png',
    published:{release:'platform-preview-0.4.1-20261012',
      arm64:{file:'SYNK-WORLD-Preview-0.4.1-mac-arm64.dmg',bytes:152884190,sha256:'71f9fa1171ff76087bd172a057fb46df5baea0f0c3ff5ef546f5d245af2f49a4'},
      x64:{file:'SYNK-WORLD-Preview-0.4.1-mac-x64.dmg',bytes:158791048,sha256:'d21e051858a80987e134ebd1c8dbf024511d430de2b71512f89a5a817bd06938'}}},
  messenger:{app:'SYNKMessengerPreview.app',name:'SYNK Workspace Preview',appId:'im.synk.messenger.preview',packageName:'synk-messenger-preview',version:'0.4.1',stem:'SYNK-Workspace-Preview',background:'background-messenger.png',
    published:{release:'platform-preview-0.4.1-20261012',
      arm64:{file:'SYNK-Workspace-Preview-0.4.1-mac-arm64.dmg',bytes:152735791,sha256:'a4a30674bac32fb6f17d8c5d390d41ccfb30095ee51debd77784eba145093f49'},
      x64:{file:'SYNK-Workspace-Preview-0.4.1-mac-x64.dmg',bytes:158588373,sha256:'fc442aa1ab2cb7f4587697d78d1d8607acd6a0857289f4bdd907527f1fd8df92'}}},
};
// 지난 공개(mac-signal.1, 플랫폼만)와 같은 이름·경로
const VERSION='0.4.3',REVISION='mac-signal.1',RELEASE=PRODUCTS.platform.published.release,APP=PRODUCTS.platform.app;
const SOURCE={arm64:PRODUCTS.platform.published.arm64,x64:PRODUCTS.platform.published.x64};
const LAYOUT={window:{width:660,height:448,titleBarAllowance:28},iconSize:112,iconTextSize:13,app:{x:180,y:200},applications:{x:480,y:200}};

const assert=(ok,message)=>{if(!ok)throw Error(message);};
const run=(cmd,args,options={})=>execFileSync(cmd,args,{encoding:'utf8',maxBuffer:64<<20,...options});
const sleep=ms=>Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms);
const sha=text=>crypto.createHash('sha256').update(text).digest('hex');
function hash(file){const h=crypto.createHash('sha256'),fd=fs.openSync(file,'r'),buf=Buffer.allocUnsafe(8<<20);try{for(let n;(n=fs.readSync(fd,buf,0,buf.length,null))>0;)h.update(buf.subarray(0,n));}finally{fs.closeSync(fd);}return h.digest('hex');}
// 앱 묶음의 모든 항목: 경로·권한·크기·SHA-256·심볼릭 링크 대상
function tree(root,rel=''){return fs.readdirSync(path.join(root,rel)).sort().flatMap(name=>{const p=rel?rel+'/'+name:name,file=path.join(root,p),st=fs.lstatSync(file),mode=(st.mode&0o7777).toString(8);if(st.isSymbolicLink())return[{path:p,link:fs.readlinkSync(file)}];if(st.isDirectory())return[{path:p+'/',mode},...tree(root,p)];return[{path:p,mode,bytes:st.size,sha256:hash(file)}];});}
function plistValue(input,key){return run('plutil',['-extract',key,'raw','-o','-','-'],{input}).trim();}
const volumeNameOf=mount=>plistValue(run('diskutil',['info','-plist',mount]),'VolumeName');
function attach(dmg,mount){fs.mkdirSync(mount,{recursive:true});run('hdiutil',['attach','-readonly','-nobrowse','-noautoopen','-mountpoint',mount,dmg]);}
function detach(target){for(let i=0;;i++){try{run('hdiutil',['detach',target]);return;}catch(e){if(i===4){run('hdiutil',['detach','-force',target]);return;}sleep(2000);}}}
function pkgVersion(name){try{let dir=path.dirname(require.resolve(name));for(let i=0;i<8;i++,dir=path.dirname(dir)){const file=path.join(dir,'package.json');if(fs.existsSync(file)){const pkg=JSON.parse(fs.readFileSync(file,'utf8'));if(pkg.name===name)return pkg.version;}}}catch{}return null;}

// Finder로 실제 창을 열어 밝은·어두운 모드 화면을 남긴다(CI 기록용, 실패해도 DMG 검증과 무관).
function finderShots(dmg,out,arch,{prefix='finder',modes=['light','dark']}={}){
  const shots=[],osa=script=>run('osascript',['-e',script],{timeout:20000}).trim();
  const attached=run('hdiutil',['attach','-readonly','-noautoopen',dmg]);
  const mount=(attached.split('\n').map(line=>/\s(\/Volumes\/.+?)\s*$/.exec(line)).find(Boolean)||[])[1];
  assert(mount,'Finder mount point not found: '+attached);
  try{
    let screen=null;try{screen=osa('tell application "Finder" to get bounds of window of desktop').split(/,\s*/).map(Number);}catch(e){}
    for(const mode of modes){
      const shot={mode,screen};
      try{osa(`tell application "System Events" to tell appearance preferences to set dark mode to ${mode==='dark'}`);}catch(e){shot.appearanceError=String(e.message).slice(0,300);}
      run('open',[mount]);sleep(5000);
      try{shot.bounds=osa('tell application "Finder" to get bounds of front window').split(/,\s*/).map(Number);}catch(e){shot.boundsError=String(e.message).slice(0,300);}
      shot.file=`${prefix}-${mode}-${arch}.png`;
      try{run('screencapture',['-x','-t','png',path.join(out,shot.file)],{timeout:20000});}catch(e){shot.captureError=String(e.message).slice(0,300);}
      if(shot.bounds){const [x1,y1,x2,y2]=shot.bounds;shot.windowFile=`${prefix}-${mode}-${arch}-window.png`;try{run('screencapture',['-x','-t','png','-R'+[x1-40,y1-60,x2-x1+80,y2-y1+100].join(','),path.join(out,shot.windowFile)],{timeout:20000});}catch(e){shot.windowCaptureError=String(e.message).slice(0,300);}}
      try{osa('tell application "Finder" to close every window');}catch(e){}
      sleep(1500);shots.push(shot);
    }
  }finally{try{osa('tell application "System Events" to tell appearance preferences to set dark mode to false');}catch(e){}detach(mount);}
  return shots;
}

async function repackage({product='platform',arch,source=null,revision=null,shots:wantShots=false}={}){
  assert(Object.hasOwn(PRODUCTS,product),'Unknown product '+product);
  assert(['arm64','x64'].includes(arch),'arch must be arm64 or x64');
  assert(process.platform==='darwin','macOS is required');
  assert(!process.env.CSC_LINK&&!process.env.CSC_KEY_PASSWORD&&!process.env.APPLE_ID&&!process.env.APPLE_API_KEY,'Repackaging must not receive signing or notarization credentials');
  const P=PRODUCTS[product],legacy=product==='platform'&&!source&&!revision;revision=revision||REVISION;
  const key=legacy?'':`${product}-${revision}`,dir=name=>key?path.join(HERE,name,key,arch):path.join(HERE,name,arch);
  const work=dir('work'),out=dir('out'),shotsDir=dir('shots'),stem=legacy?revision:`${product}-${revision}`;
  assert(![work,out,shotsDir].some(d=>fs.existsSync(d)),'Preserve previous work/out/shots folders');
  for(const d of [work,out,shotsDir])fs.mkdirSync(d,{recursive:true});

  // 1. 원본 DMG: 고정한 공개 파일을 받거나(확인값 대조), 주어진 DMG를 그대로 쓴다
  let original,from;
  if(source){original=path.resolve(source);assert(fs.existsSync(original),'Missing source DMG '+original);from={file:path.basename(original),bytes:fs.statSync(original).size,sha256:hash(original),local:true};}
  else{
    const pin=P.published[arch],url=RELEASES+P.published.release+'/'+pin.file;original=path.join(work,pin.file);
    run('curl',['-fsSL','--retry','3','--retry-delay','5','-o',original,url]);
    assert(fs.statSync(original).size===pin.bytes&&hash(original)===pin.sha256,'Downloaded DMG differs from the published '+P.version+' file');
    from={release:P.published.release,url,...pin};
  }
  run('hdiutil',['verify',original]);

  // 2. 앱 묶음을 그대로 꺼낸다
  const mountA=path.join(work,'mount-source'),app=path.join(work,'app',P.app);let before,volume,rootBefore,volumeIcon=null;
  attach(original,mountA);
  try{
    rootBefore=fs.readdirSync(mountA).sort();volume=volumeNameOf(mountA);
    assert(rootBefore.filter(name=>name.endsWith('.app')).join()===P.app,'Unexpected apps in the source DMG: '+rootBefore.join(', '));
    assert(fs.readlinkSync(path.join(mountA,'Applications'))==='/Applications','Source DMG lacks the Applications link');
    before=tree(path.join(mountA,P.app));
    if(fs.existsSync(path.join(mountA,'.VolumeIcon.icns'))){volumeIcon=path.join(work,'VolumeIcon.icns');fs.copyFileSync(path.join(mountA,'.VolumeIcon.icns'),volumeIcon);}
    fs.mkdirSync(path.dirname(app),{recursive:true});run('ditto',[path.join(mountA,P.app),app]);
  }finally{detach(mountA);}
  assert(volume===`${P.name} ${P.version} ${arch}`,'Unexpected source volume name '+volume);
  assert(JSON.stringify(tree(app))===JSON.stringify(before),'Copied app differs from the source DMG');
  run('codesign',['--verify','--deep','--strict','--verbose=2',app]);
  const info=fs.readFileSync(path.join(app,'Contents/Info.plist')),executableName=plistValue(info,'CFBundleExecutable');
  const pick=p=>(before.find(e=>e.path===p)||{}).sha256||null;
  let icon=volumeIcon;if(!icon){const name=plistValue(info,'CFBundleIconFile');icon=path.join(app,'Contents/Resources',name.endsWith('.icns')?name:name+'.icns');}

  // 3. 시그널 창으로 다시 포장한다(prepackaged: 앱을 다시 만들거나 서명하지 않음)
  const project=path.join(work,'project');fs.mkdirSync(project);
  fs.writeFileSync(path.join(project,'package.json'),JSON.stringify({name:P.packageName,productName:P.name,version:P.version,description:P.name,author:'SYNK',private:true},null,2)+'\n');
  const {build,Platform,Arch}=require('electron-builder');
  const background=path.join(HERE,P.background);
  const config={appId:P.appId,productName:P.name,electronVersion:'44.5.1',npmRebuild:false,
    directories:{output:path.join(work,'dist'),buildResources:HERE},
    artifactName:P.stem+'-${version}-Signal-mac-${arch}.${ext}',
    mac:{target:[{target:'dmg',arch:[arch]}],identity:null,icon},
    dmg:{format:'UDZO',sign:false,writeUpdateInfo:false,title:volume,icon,background,
      iconSize:LAYOUT.iconSize,iconTextSize:LAYOUT.iconTextSize,
      contents:[{...LAYOUT.app,type:'file',name:P.app},{...LAYOUT.applications,type:'link',path:'/Applications'}]},
    publish:null};
  const artifacts=await build({projectDir:project,prepackaged:app,targets:Platform.MAC.createTarget('dmg',arch==='arm64'?Arch.arm64:Arch.x64),config,publish:'never'});
  const built=artifacts.find(file=>file.endsWith('.dmg'));assert(built&&fs.existsSync(built),'DMG was not produced');

  // 4. 새 DMG를 읽기 전용으로 열어 앱 바이트·서명·창 구성 확인
  run('hdiutil',['verify',built]);
  const mountB=path.join(work,'mount-signal');let after,rootAfter,backgroundInDmg,dsStoreSHA256;
  attach(built,mountB);
  try{
    rootAfter=fs.readdirSync(mountB).sort();
    assert(volumeNameOf(mountB)===volume,'Volume name changed');
    assert(fs.readlinkSync(path.join(mountB,'Applications'))==='/Applications','Applications link missing');
    const bgEntry=rootAfter.find(name=>/^\.background(?:\.|$)/.test(name));assert(bgEntry,'Window background missing: '+rootAfter.join(', '));
    const bgFile=fs.statSync(path.join(mountB,bgEntry)).isDirectory()?bgEntry+'/'+fs.readdirSync(path.join(mountB,bgEntry))[0]:bgEntry;
    backgroundInDmg={file:bgFile,bytes:fs.statSync(path.join(mountB,bgFile)).size,sha256:hash(path.join(mountB,bgFile))};
    assert(fs.existsSync(path.join(mountB,'.DS_Store')),'Finder window layout (.DS_Store) missing');dsStoreSHA256=hash(path.join(mountB,'.DS_Store'));
    after=tree(path.join(mountB,P.app));
    run('codesign',['--verify','--deep','--strict','--verbose=2',path.join(mountB,P.app)]);
  }finally{detach(mountB);}
  assert(JSON.stringify(after)===JSON.stringify(before),'Delivered app differs from the source app');

  // 5. 결과·확인값·기록
  const target=path.join(out,path.basename(built));fs.copyFileSync(built,target);
  const output={file:path.basename(target),bytes:fs.statSync(target).size,sha256:hash(target)};
  fs.writeFileSync(path.join(out,`SHA256SUMS-${stem}-${arch}.txt`),`${output.sha256}  ${output.file}\n`);
  const screenshots=wantShots?finderShots(target,shotsDir,arch):[];
  // 비교용: 원본 DMG 창(밝은 모드)
  let sourceWindow=null;if(wantShots){try{sourceWindow=finderShots(original,shotsDir,arch,{prefix:'published',modes:['light']})[0];}catch(e){sourceWindow={error:String(e.message).slice(0,300)};}}
  const env=process.env,ci=env.GITHUB_RUN_ID?{run:`${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`,sourceCommit:env.GITHUB_SHA,ref:env.GITHUB_REF}:null;
  const report={ok:true,product,revision,builtAt:new Date().toISOString(),version:P.version,platform:'darwin',arch,ci,
    runner:{macOS:run('sw_vers',['-productVersion']).trim(),hostArch:process.arch,node:process.version},
    tools:{electronBuilder:pkgVersion('electron-builder'),dmgBuilder:pkgVersion('dmg-builder')},
    source:from,output,volumeName:volume,
    app:{name:P.app,entries:before.length,files:before.filter(e=>e.sha256).length,bytes:before.reduce((s,e)=>s+(e.bytes||0),0),treeSHA256:sha(JSON.stringify(before)),unchangedFromPublished:true,
      executableSHA256:pick(`Contents/MacOS/${executableName}`),asarSHA256:pick('Contents/Resources/app.asar'),minimumSystemVersion:plistValue(info,'LSMinimumSystemVersion')},
    signature:'ad-hoc',codesignVerified:true,notarized:false,
    window:{...LAYOUT,background:{png:hash(background),png2x:hash(background.replace(/\.png$/,'@2x.png'))},inDmg:backgroundInDmg,dsStoreSHA256},
    rootEntries:{published:rootBefore,signal:rootAfter},screenshots,publishedWindow:sourceWindow};
  for(const d of [out,shotsDir])fs.writeFileSync(path.join(d,`mac-dmg-${stem}-${arch}.json`),JSON.stringify(report,null,2)+'\n');
  return {...report,outputPath:target,outDir:out,shotsDir};
}

async function main(){
  const arg=name=>(process.argv.find(a=>a.startsWith('--'+name+'='))||'').slice(name.length+3)||null;
  const arch=arg('arch');assert(/^(arm64|x64)$/.test(arch||''),'Use --arch=arm64|x64 [--product=platform|world|messenger] [--source=<DMG>] [--revision=<name>] [--shots]');
  const report=await repackage({product:arg('product')||'platform',arch,source:arg('source'),revision:arg('revision'),shots:process.argv.includes('--shots')});
  console.log(JSON.stringify({ok:true,product:report.product,arch,output:report.output,screenshots:report.screenshots.length}));
}
module.exports={PRODUCTS,SOURCE,REVISION,VERSION,RELEASE,APP,LAYOUT,repackage,hash};
if(require.main===module)main().catch(error=>{console.error(error);process.exit(1);});
