'use strict';
// Actual Finder, Dock and DMG screenshots on an ephemeral macOS CI runner.
// Never launch a SYNK application; account/userData and app-location prompts are
// outside this test. Dock pins render the exact delivered bundles' icons.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const {pathToFileURL}=require('node:url');
const assert=(ok,message)=>{if(!ok)throw Error(message);};
const run=(exe,args)=>cp.execFileSync(exe,args,{encoding:'utf8',timeout:120000,maxBuffer:8<<20});
const osa=script=>run('osascript',['-e',script]).trim();
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const hash=file=>{const h=crypto.createHash('sha256'),fd=fs.openSync(file,'r'),chunk=Buffer.allocUnsafe(8<<20);try{for(let n;(n=fs.readSync(fd,chunk,0,chunk.length,null));)h.update(chunk.subarray(0,n));}finally{fs.closeSync(fd);}return h.digest('hex');};
const xml=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
async function main(){
  assert(process.platform==='darwin'&&process.env.GITHUB_ACTIONS==='true'&&/^\d+$/.test(process.env.GITHUB_RUN_ID||''),'Only an ephemeral macOS GitHub Actions runner may change its Finder/Dock preferences');
  const arg=name=>process.argv.find(value=>value.startsWith('--'+name+'='))?.slice(name.length+3);
  const root=path.resolve(arg('root')||'.'),manifest=JSON.parse(fs.readFileSync(path.resolve(arg('manifest')))),out=path.resolve(arg('out')),assets=path.resolve(arg('assets')||path.join(root,'unified/source/assets'));
  assert(!fs.existsSync(out),'Keep earlier screenshot evidence');fs.mkdirSync(out,{recursive:true});
  const report={ok:false,checkedAt:new Date().toISOString(),arch:process.arch,version:manifest.version,ciRun:process.env.GITHUB_RUN_ID,scope:'Delivered DMG icon bytes plus actual Finder/Dock rendering; SYNK apps are not executed.',appLaunches:0,userDataOperations:0,applicationsFolderOperations:0,products:[],screenshots:[]};
  const mounts=[],dockBackup=path.join(out,'dock-before.plist'),finder=path.join(out,'Finder Applications');fs.mkdirSync(finder);let dockSaved=false,darkBefore=null;
  const shot=async(name)=>{await pause(2200);const file=path.join(out,name+'.png');run('screencapture',['-x','-t','png',file]);assert(fs.statSync(file).size>10000,'Empty screenshot: '+name);report.screenshots.push({file:path.basename(file),bytes:fs.statSync(file).size,sha256:hash(file)});};
  const showFolder=folder=>osa(`tell application "Finder"\nactivate\nopen (POSIX file ${JSON.stringify(folder)} as alias)\nend tell`);
  try{
    for(const client of ['platform','world','messenger']){
      const item=manifest.packages.find(row=>row.client===client);assert(item?.installer,'Missing package '+client);const dmg=path.resolve(root,item.installer.path);assert(hash(dmg)===item.installer.sha256&&fs.statSync(dmg).size===item.installer.bytes,'DMG digest mismatch '+client);
      const mount=path.join(out,'mount-'+client);fs.mkdirSync(mount);run('hdiutil',['attach','-readonly','-nobrowse','-noautoopen','-mountpoint',mount,dmg]);mounts.push(mount);
      const apps=fs.readdirSync(mount).filter(name=>name.endsWith('.app'));assert(apps.length===1,'Expected one delivered app');const app=path.join(mount,apps[0]),info=path.join(app,'Contents/Info.plist');let iconName=run('plutil',['-extract','CFBundleIconFile','raw','-o','-',info]).trim();if(!iconName.endsWith('.icns'))iconName+='.icns';
      const expected=hash(path.join(assets,client+'.icns')),icon=path.join(app,'Contents/Resources',iconName);assert(hash(icon)===expected,'App icon differs '+client);const volumeIcon=path.join(mount,'.VolumeIcon.icns');assert(fs.existsSync(volumeIcon)&&hash(volumeIcon)===expected,'DMG volume icon differs '+client);
      const copied=path.join(finder,apps[0]);run('ditto',[app,copied]);assert(hash(path.join(copied,'Contents/Resources',iconName))===expected,'Finder copy differs');report.products.push({client,version:item.version,app:apps[0],iconSHA256:expected,appIconMatches:true,volumeIconMatches:true,dmgSHA256:item.installer.sha256,copy:copied,mount});
    }
    run('defaults',['export','com.apple.dock',dockBackup]);dockSaved=true;
    darkBefore=osa('tell application "System Events" to tell appearance preferences to get dark mode');
    run('defaults',['write','com.apple.dock','persistent-apps','-array']);
    const native=['/System/Applications/System Settings.app','/System/Applications/Notes.app'].filter(file=>fs.existsSync(file));
    for(const app of [...native,...report.products.map(row=>row.copy)]){const entry='<dict><key>tile-data</key><dict><key>file-data</key><dict><key>_CFURLString</key><string>'+xml(pathToFileURL(app).href)+'</string><key>_CFURLStringType</key><integer>15</integer></dict></dict><key>tile-type</key><string>file-tile</string></dict>';run('defaults',['write','com.apple.dock','persistent-apps','-array-add',entry]);}
    run('defaults',['write','com.apple.dock','tilesize','-int','80']);run('defaults',['write','com.apple.dock','autohide','-bool','false']);run('defaults',['write','com.apple.dock','orientation','-string','bottom']);run('defaults',['write','com.apple.dock','magnification','-bool','false']);run('killall',['Dock']);await pause(3000);
    for(const mode of ['light','dark']){
      osa(`tell application "System Events" to tell appearance preferences to set dark mode to ${mode==='dark'}`);
      showFolder(finder);osa('tell application "Finder"\nset current view of front window to icon view\nset bounds of front window to {60, 60, 980, 620}\nset icon size of icon view options of front window to 128\nset arrangement of icon view options of front window to arranged by name\nend tell');
      await shot('finder-dock-'+mode);
      for(const row of report.products){showFolder(row.mount);await shot('dmg-'+row.client+'-'+mode);osa('tell application "Finder" to close front window');}
      osa('tell application "Finder" to close front window');
    }
    report.ok=true;
  }catch(error){report.error=String(error.stack||error);}
  finally{
    const cleanup=[];if(dockSaved){try{run('defaults',['import','com.apple.dock',dockBackup]);run('killall',['Dock']);}catch(error){cleanup.push('Dock restore: '+error.message);}}
    if(darkBefore!==null){try{osa(`tell application "System Events" to tell appearance preferences to set dark mode to ${darkBefore==='true'}`);}catch(error){cleanup.push('Appearance restore: '+error.message);}}
    for(const mount of mounts.reverse()){try{run('hdiutil',['detach',mount]);}catch(error){cleanup.push('DMG detach: '+error.message);}}
    report.preferenceRestore=cleanup.length===0;report.cleanupErrors=cleanup;if(cleanup.length)report.ok=false;
    for(const row of report.products){delete row.copy;delete row.mount;}fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  }
  console.log(JSON.stringify(report));assert(report.ok,'Native icon QA failed; see report.json');
}
if(require.main===module)main().catch(error=>{console.error(error.stack);process.exitCode=1;});
