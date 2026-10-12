// 공개된 SYNK Platform Preview 0.4.3 Mac DMG를 받아, 앱 묶음은 바이트 그대로 두고 DMG 창만 시그널 디자인으로 다시 포장한다.
// 바뀌는 것: 창 배경(background.png·@2x), 아이콘 112pt·이름 13pt, 앱(180,200)·Applications(480,200) 자리, 파일 이름.
// macOS 전용. 서명·공증·설치·게시를 하지 않는다. 사용: node repackage.cjs --arch=arm64|x64 [--shots]
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{execFileSync}=require('child_process');

const HERE=__dirname,VERSION='0.4.3',REVISION='mac-signal.1',RELEASE='platform-preview-0.4.3-20261012';
const SOURCE={
  arm64:{file:'SYNK-Platform-Preview-0.4.3-mac-arm64.dmg',bytes:457408094,sha256:'e0796502af692e386aa28dacfae2492b1ca30e6241435213e4a73521cc32a28a'},
  x64:{file:'SYNK-Platform-Preview-0.4.3-mac-x64.dmg',bytes:475085655,sha256:'28919a62be30fb86733356ab7636c20b20f5257571eb7aa704f6b0946afbb333'},
};
const APP='SYNKPlatformPreview.app',PRODUCT='SYNK Platform Preview';
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

async function main(){
  const arch=(process.argv.find(a=>/^--arch=(?:arm64|x64)$/.test(a))||'').slice(7),wantShots=process.argv.includes('--shots');
  assert(arch,'Use --arch=arm64|x64 [--shots]');
  assert(process.platform==='darwin','macOS is required');
  assert(!process.env.CSC_LINK&&!process.env.CSC_KEY_PASSWORD&&!process.env.APPLE_ID&&!process.env.APPLE_API_KEY,'Repackaging must not receive signing or notarization credentials');
  const source=SOURCE[arch],work=path.join(HERE,'work',arch),out=path.join(HERE,'out',arch),shotsDir=path.join(HERE,'shots',arch);
  assert(![work,out,shotsDir].some(dir=>fs.existsSync(dir)),'Preserve previous work/out/shots folders');
  for(const dir of [work,out,shotsDir])fs.mkdirSync(dir,{recursive:true});

  // 1. 공개된 0.4.3 DMG를 받아 고정값과 맞춘다
  const original=path.join(work,source.file),url=`https://github.com/unmet23-lab/synk-policy/releases/download/${RELEASE}/${source.file}`;
  run('curl',['-fsSL','--retry','3','--retry-delay','5','-o',original,url]);
  assert(fs.statSync(original).size===source.bytes&&hash(original)===source.sha256,'Downloaded DMG differs from the published 0.4.3 file');
  run('hdiutil',['verify',original]);

  // 2. 앱 묶음을 그대로 꺼낸다
  const mountA=path.join(work,'mount-published'),app=path.join(work,'app',APP);let before,volume,rootBefore,volumeIcon=null;
  attach(original,mountA);
  try{
    rootBefore=fs.readdirSync(mountA).sort();volume=volumeNameOf(mountA);
    assert(fs.readlinkSync(path.join(mountA,'Applications'))==='/Applications','Published DMG lacks the Applications link');
    before=tree(path.join(mountA,APP));
    if(fs.existsSync(path.join(mountA,'.VolumeIcon.icns'))){volumeIcon=path.join(work,'VolumeIcon.icns');fs.copyFileSync(path.join(mountA,'.VolumeIcon.icns'),volumeIcon);}
    fs.mkdirSync(path.dirname(app),{recursive:true});run('ditto',[path.join(mountA,APP),app]);
  }finally{detach(mountA);}
  assert(volume===`${PRODUCT} ${VERSION} ${arch}`,'Unexpected published volume name '+volume);
  assert(JSON.stringify(tree(app))===JSON.stringify(before),'Copied app differs from the published DMG');
  run('codesign',['--verify','--deep','--strict','--verbose=2',app]);
  const info=fs.readFileSync(path.join(app,'Contents/Info.plist'));
  let icon=volumeIcon;if(!icon){const name=plistValue(info,'CFBundleIconFile');icon=path.join(app,'Contents/Resources',name.endsWith('.icns')?name:name+'.icns');}

  // 3. 시그널 창으로 다시 포장한다(prepackaged: 앱을 다시 만들거나 서명하지 않음)
  const project=path.join(work,'project');fs.mkdirSync(project);
  fs.writeFileSync(path.join(project,'package.json'),JSON.stringify({name:'synk-platform-preview',productName:PRODUCT,version:VERSION,description:'SYNK Platform Preview',author:'SYNK',private:true},null,2)+'\n');
  const {build,Platform,Arch}=require('electron-builder');
  const config={appId:'im.synk.platform.preview',productName:PRODUCT,electronVersion:'44.5.1',npmRebuild:false,
    directories:{output:path.join(work,'dist'),buildResources:HERE},
    artifactName:'SYNK-Platform-Preview-${version}-Signal-mac-${arch}.${ext}',
    mac:{target:[{target:'dmg',arch:[arch]}],identity:null,icon},
    dmg:{format:'UDZO',sign:false,writeUpdateInfo:false,title:volume,icon,background:path.join(HERE,'background.png'),
      iconSize:LAYOUT.iconSize,iconTextSize:LAYOUT.iconTextSize,
      contents:[{...LAYOUT.app,type:'file',name:APP},{...LAYOUT.applications,type:'link',path:'/Applications'}]},
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
    after=tree(path.join(mountB,APP));
    run('codesign',['--verify','--deep','--strict','--verbose=2',path.join(mountB,APP)]);
  }finally{detach(mountB);}
  assert(JSON.stringify(after)===JSON.stringify(before),'Delivered app differs from the published 0.4.3 app');

  // 5. 결과·확인값·기록
  const target=path.join(out,path.basename(built));fs.copyFileSync(built,target);
  const output={file:path.basename(target),bytes:fs.statSync(target).size,sha256:hash(target)};
  fs.writeFileSync(path.join(out,`SHA256SUMS-${REVISION}-${arch}.txt`),`${output.sha256}  ${output.file}\n`);
  const screenshots=wantShots?finderShots(target,shotsDir,arch):[];
  // 비교용: 기존 공개 DMG 창(밝은 모드)
  let publishedWindow=null;if(wantShots){try{publishedWindow=finderShots(original,shotsDir,arch,{prefix:'published',modes:['light']})[0];}catch(e){publishedWindow={error:String(e.message).slice(0,300)};}}
  const env=process.env,ci=env.GITHUB_RUN_ID?{run:`${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`,sourceCommit:env.GITHUB_SHA,ref:env.GITHUB_REF}:null;
  const report={ok:true,revision:REVISION,builtAt:new Date().toISOString(),version:VERSION,platform:'darwin',arch,ci,
    runner:{macOS:run('sw_vers',['-productVersion']).trim(),hostArch:process.arch,node:process.version},
    tools:{electronBuilder:pkgVersion('electron-builder'),dmgBuilder:pkgVersion('dmg-builder')},
    source:{release:RELEASE,url,...source},output,volumeName:volume,
    app:{name:APP,entries:before.length,files:before.filter(e=>e.sha256).length,bytes:before.reduce((s,e)=>s+(e.bytes||0),0),treeSHA256:sha(JSON.stringify(before)),unchangedFromPublished:true,
      minimumSystemVersion:plistValue(info,'LSMinimumSystemVersion')},
    signature:'ad-hoc',codesignVerified:true,notarized:false,
    window:{...LAYOUT,background:{png:hash(path.join(HERE,'background.png')),png2x:hash(path.join(HERE,'background@2x.png'))},inDmg:backgroundInDmg,dsStoreSHA256},
    rootEntries:{published:rootBefore,signal:rootAfter},screenshots,publishedWindow};
  for(const dir of [out,shotsDir])fs.writeFileSync(path.join(dir,`mac-dmg-${REVISION}-${arch}.json`),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({ok:true,arch,output,screenshots:screenshots.length}));
}
module.exports={SOURCE,REVISION,VERSION,RELEASE,APP,LAYOUT};
if(require.main===module)main().catch(error=>{console.error(error);process.exit(1);});
