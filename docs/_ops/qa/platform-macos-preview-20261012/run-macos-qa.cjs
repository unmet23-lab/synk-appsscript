'use strict';
// Run on an ephemeral macOS CI host after packaging. Every app is copied from
// its actual mounted DMG into a private Applications folder before native QA.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const args=Object.fromEntries(process.argv.slice(2).map(x=>{const m=/^--(root|manifest|out|arch)=(.+)$/.exec(x);if(!m)throw Error('Unexpected argument '+x);return [m[1],m[2]];}));
const expectedArch=args.arch||process.arch;
if(process.platform!=='darwin'||!['arm64','x64'].includes(expectedArch)||expectedArch!==process.arch)throw Error('Native macOS host matching --arch required');
const root=path.resolve(args.root||process.cwd()),out=path.resolve(args.out||path.join(root,'qa-results',expectedArch)),manifestFile=path.resolve(root,args.manifest||path.join('dist',expectedArch,'deliverables','mac-package-'+expectedArch+'.json'));
if(fs.existsSync(out)&&fs.readdirSync(out).length)throw Error('Output must be new or empty');fs.mkdirSync(out,{recursive:true});
const asar=require(path.join(root,'node_modules/@electron/asar')),manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8')),checks=[],bundles={};
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const resolve=value=>{const p=path.resolve(root,value),r=path.relative(root,p);if(r==='..'||r.startsWith('..'+path.sep)||path.isAbsolute(r))throw Error('Manifest path outside source');return p;};
const run=(file,args)=>{const r=cp.spawnSync(file,args,{encoding:'utf8',maxBuffer:4*1024*1024});if(r.status!==0)throw Error(file+' failed: '+(r.stderr||r.stdout));return {stdout:r.stdout,stderr:r.stderr};};
const check=(name,ok,detail)=>{checks.push({name,ok:!!ok,...(detail===undefined?{}:{detail})});if(!ok)throw Error(name);};
const applications=path.join(out,'Applications');fs.mkdirSync(applications);
let failure=null;
try{
  check('manifest is current native macOS architecture',manifest.platform==='darwin'&&manifest.arch===process.arch&&manifest.packages.length===3,{host:process.arch,arch:manifest.arch});
  for(const client of ['world','messenger','platform']){
    const p=manifest.packages.find(p=>p.client===client);check(client+' package exists',!!p);
    const dmg=resolve(p.installer.path);check(client+' DMG digest and byte size',sha(dmg)===p.installer.sha256&&fs.statSync(dmg).size===p.installer.bytes);
    const mount=path.join(out,'mount-'+client);fs.mkdirSync(mount);let mounted=false;
    try{
      run('/usr/bin/hdiutil',['attach',dmg,'-readonly','-nobrowse','-noautoopen','-mountpoint',mount]);mounted=true;
      const apps=fs.readdirSync(mount).filter(x=>x.endsWith('.app'));check(client+' DMG contains one app',apps.length===1,apps);
      const app=path.join(applications,apps[0]);run('/usr/bin/ditto',[path.join(mount,apps[0]),app]);
      const executableName=run('/usr/libexec/PlistBuddy',['-c','Print:CFBundleExecutable',path.join(app,'Contents/Info.plist')]).stdout.trim();
      const executable=path.join(app,'Contents/MacOS',executableName),archive=path.join(app,'Contents/Resources/app.asar'),metadata=JSON.parse(fs.readFileSync(path.join(app,'Contents/Resources/synk-install.json'),'utf8'));
      check(client+' mounted executable and ASAR match frozen manifest',sha(executable)===p.executable.sha256&&sha(archive)===p.asar.sha256);
      check(client+' metadata matches host and client',metadata.clientId===client&&metadata.platform==='darwin'&&metadata.arch===manifest.arch&&metadata.version===p.metadata.version,metadata);
      run('/usr/bin/codesign',['--verify','--deep','--strict','--verbose=2',app]);
      const signature=run('/usr/bin/codesign',['-dv','--verbose=4',app]);
      check(client+' ad-hoc code signature verifies',/Signature=adhoc/.test(signature.stderr),signature.stderr.split(/\r?\n/).filter(x=>/^(Identifier|Signature|TeamIdentifier|Runtime Version)=/.test(x)));
      const arch=run('/usr/bin/lipo',['-archs',executable]).stdout.trim();check(client+' executable CPU architecture',arch===(manifest.arch==='arm64'?'arm64':'x86_64'),arch);
      if(manifest.arch==='x64'){
        const library=path.join(app,'Contents/Frameworks/Electron Framework.framework/Versions/A/Libraries/libvulkan.dylib');
        const provenance=JSON.parse(fs.readFileSync(path.join(app,'Contents/Resources/Vulkan-Loader/provenance.json')));
        check(client+' signed Intel graphics loader and license included',run('/usr/bin/lipo',['-archs',library]).stdout.trim()==='x86_64'&&provenance.loaderCommit==='fa218055ff4948b159f31d43f800c808a13d51df'&&fs.existsSync(path.join(app,'Contents/Resources/Vulkan-Loader/LICENSES')),{sha256:sha(library),provenance});
      }
      const runtime=JSON.parse(asar.extractFile(archive,'runtime.json'));
      bundles[client]={client,app,executable,archive,metadata,runtime,installer:p.installer,signature:'ad-hoc',manifestExecutableSha:p.executable.sha256,manifestAsarSha:p.asar.sha256};
    }finally{if(mounted)run('/usr/bin/hdiutil',['detach',mount]);}
  }
  check('WORLD uses live HTTPS entry',bundles.world.runtime.worldCloudPreview===true&&bundles.world.runtime.entry==='https://synk.im/account/client.html?product=world');
  check('Workspace uses live HTTPS entry',bundles.messenger.runtime.messengerCloudPreview===true&&bundles.messenger.runtime.entry==='https://workspace.synk.im/?tab=messenger');
  check('Platform has bundled local renderer',bundles.platform.runtime.entry==='synk-desktop://platform/index.html');
  for(const client of ['world','messenger']){
    const bundle=bundles[client],r=bundles.platform.runtime.releases.find(r=>r.id===client&&r.platform==='darwin'&&r.arch===manifest.arch&&r.version===bundle.metadata.version);
    check(client+' Platform executable/ASAR pins',r?.executableSHA256===bundle.manifestExecutableSha&&r?.asarSHA256===bundle.manifestAsarSha);
    const installer=path.join(bundles.platform.app,'Contents/Resources/clients',r.installer.relativePath);
    check(client+' bundled DMG pin and exact bytes',r.installer.relativePath===client+'.dmg'&&sha(installer)===r.installer.sha256&&r.installer.sha256===bundle.installer.sha256&&fs.statSync(installer).size===r.installer.bytes);
  }
  const config={arch:manifest.arch,applications,bundles:Object.fromEntries(Object.entries(bundles).map(([id,b])=>[id,{app:b.app,executable:b.executable,archive:b.archive,version:b.metadata.version}]))};
  const configFile=path.join(out,'native-config.json');fs.writeFileSync(configFile,JSON.stringify(config,null,2));
  for(const mode of ['world-online','world-offline','platform']){
    const nativeOut=path.join(out,mode);
    const p=cp.spawnSync(process.execPath,[path.join(__dirname,'native-smoke.cjs'),'--config='+configFile,'--out='+nativeOut,'--mode='+mode],{encoding:'utf8',timeout:190000,maxBuffer:6*1024*1024});
    fs.writeFileSync(path.join(out,mode+'-process.log'),(p.stdout||'')+(p.stderr||''));
    check(mode+' actual native process exited successfully',p.status===0,{status:p.status,error:p.error?.message});
    const result=JSON.parse(fs.readFileSync(path.join(nativeOut,'report.json'),'utf8'));check(mode+' native report passed',result.ok,{checks:result.result?.checks?.length,passed:result.result?.checks?.filter(c=>c.ok).length});
  }
  for(const [client,b]of Object.entries(bundles))check(client+' QA preserved candidate bytes',sha(b.archive)===b.manifestAsarSha&&sha(b.executable)===b.manifestExecutableSha);
}catch(error){failure=error.stack||error.message;}
const result={checkedAt:new Date().toISOString(),ok:!failure,host:{platform:process.platform,arch:process.arch,node:process.version,runnerArch:process.env.RUNNER_ARCH||null},manifest:manifestFile,checks,failure,limitations:{installedFromActualDmg:true,location:'private temporary Applications',notarized:false,gatekeeperApprovalTested:false,realAuthenticationPerformed:false,realProfileTouched:false,physicalUserMac:false,platformManagedLaunchPerformed:false,offlineSimulation:'initial HTTPS canceled; actual native retry after unblocking'}};
fs.writeFileSync(path.join(out,'mac-native-qa.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({ok:result.ok,passed:checks.filter(x=>x.ok).length,checks:checks.length,report:path.join(out,'mac-native-qa.json'),failure}));if(!result.ok)process.exitCode=1;
