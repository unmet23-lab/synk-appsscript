'use strict';
const fs=require('node:fs'),path=require('node:path');
const {build,Platform,Arch}=require('electron-builder');
const {CLIENTS,DEV_URLS,PLATFORM_ENTRY,MESSENGER_CLOUD_PREVIEW_ENTRY,WORLD_CLOUD_PREVIEW_ENTRY,identity}=require('../src/catalog.cjs');
const {safeEntry,inside}=require('../src/security.cjs');
const {configuration}=require('../src/auth-config.cjs');
const root=path.resolve(__dirname,'..');
const hashFile=p=>require('node:crypto').createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const sourceHash=()=>require('./source-hash.cjs').sourceHash(root);
function verifyMemberActivity(desktopRoot=root){
  for(const [name,entry]of [['member-activity','atlas/member-activity.js'],['member-activity-data','experiences/synk-account/src/member-activity-data.mjs'],['member-understanding','atlas/member-understanding.js'],['member-understanding-data','experiences/synk-account/src/member-understanding-data.mjs']]){
  const generated=path.join(desktopRoot,'renderer/generated',name+'.mjs'),manifestPath=path.join(desktopRoot,'renderer/generated',name+'.manifest.json');
  let manifest;try{manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));}catch{throw Error('Member activity build manifest is missing or invalid.');}
  if(manifest.version!==1||manifest.entry!==entry||!manifest.sources||!Object.hasOwn(manifest.sources,entry)||!Object.values(manifest.sources).every(value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value))||!fs.existsSync(generated)||require('node:crypto').createHash('sha256').update(fs.readFileSync(generated,'utf8').replace(/\r\n/g,'\n')).digest('hex')!==manifest.sha256)throw Error('Member activity browser artifact differs from its build manifest.');
  }
  // A frozen desktop-only release carries the build receipt; a source checkout
  // also verifies freshness against the canonical Atlas implementation.
  const sourceRoot=path.resolve(desktopRoot,'..');
  if(fs.existsSync(path.join(sourceRoot,'atlas/member-activity.js')))require(path.join(sourceRoot,'tools/build-member-activity.js')).buildMemberActivity({sourceRoot,check:true});
}
function previewReleases(options) {
  const entries=[];
  for(const id of ['world','messenger']) {
    const c=identity(id,'development'),output=configFor(id,options).directories.output;
    const dir=options.platform==='win32'?path.join(output,options.arch==='arm64'?'win-arm64-unpacked':'win-unpacked'):path.join(output,options.arch==='arm64'?'mac-arm64':'mac',c.executableName+'.app');
    const resources=options.platform==='win32'?path.join(dir,'resources'):path.join(dir,'Contents','Resources');
    try {const metadata=JSON.parse(fs.readFileSync(path.join(resources,'synk-install.json'),'utf8'));if(metadata.sourceHash!==sourceHash())continue;
      const installer=path.join(output,c.productName+'-'+metadata.version+'-'+(options.platform==='win32'?'win':'mac')+'-'+options.arch+(options.platform==='win32'?'.exe':'.dmg'));
      const item={id,mode:'development',platform:options.platform,arch:options.arch,version:metadata.version,executableSHA256:hashFile(options.platform==='win32'?path.join(dir,c.executableName+'.exe'):path.join(dir,'Contents','MacOS',c.executableName)),asarSHA256:hashFile(path.join(resources,'app.asar'))};
      if(fs.existsSync(installer))item.installer={relativePath:id+(options.platform==='win32'?'.exe':'.dmg'),sha256:hashFile(installer),bytes:fs.statSync(installer).size};
      entries.push(item);
    }catch{}
  }
  const history=require('../src/local-releases.cjs').loadDevelopmentReleases({root,platform:options.platform,arch:options.arch});
  for(const release of history)if(!entries.some(r=>r.id===release.id&&r.version===release.version)){const {installer,...pin}=release;entries.push(pin);}
  return entries;
}
function configFor(id,{mode='development',platform='win32',arch='x64'}={}) {
  const c=identity(id,mode),suffix=mode==='development'?'preview':'release';
  return {appId:c.appId,productName:c.productName,executableName:c.executableName,asar:true,npmRebuild:false,
    directories:{app:path.join(root,'.stage',suffix,platform,arch,id),output:path.join(root,'dist',suffix,platform,arch,id)},
    files:['package.json','runtime.json','src/**','renderer/**','assets/**'],extraResources:[{from:path.join(root,'.stage',suffix,platform,arch,id,'synk-install.json'),to:'synk-install.json'}],
    artifactName:'${productName}-${version}-${os}-${arch}.${ext}',
    forceCodeSigning:mode==='release',
    win:{target:[{target:'nsis',arch:[arch]}],signExecutable:mode==='release',icon:path.join(root,'assets',id+'.ico')},
    nsis:{oneClick:false,perMachine:false,allowElevation:false,allowToChangeInstallationDirectory:false,runAfterFinish:false,deleteAppDataOnUninstall:false,createDesktopShortcut:true,createStartMenuShortcut:true},
    mac:{target:[{target:'dmg',arch:[arch]},{target:'zip',arch:[arch]}],category:id==='world'?'public.app-category.education':'public.app-category.productivity',minimumSystemVersion:'13.0',hardenedRuntime:mode==='release',gatekeeperAssess:false,icon:path.join(root,'assets',id+'.icns'),...(id==='platform'?{signIgnore:['/Contents/Resources/clients/(?:world|messenger)\\.dmg$']}:{}),...(mode==='development'?{identity:'-',notarize:false,preAutoEntitlements:false}:{})},
    publish:null,
  };
}
function previewEntry(id,options={}){
  const worldFlag=options.worldCloudPreview;
  if(worldFlag!==undefined&&worldFlag!==true)throw Error('WORLD cloud preview requires an explicit true flag.');
  if(worldFlag===true){if(options.mode!=='development'||id!=='world'||options.messengerCloudPreview!==undefined)throw Error('Cloud preview is restricted to the WORLD development client.');return WORLD_CLOUD_PREVIEW_ENTRY;}
  const flag=options.messengerCloudPreview;
  if(flag!==undefined&&flag!==true)throw Error('Messenger cloud preview requires an explicit true flag.');
  if(flag===true){if(options.mode!=='development'||id!=='messenger')throw Error('Cloud preview is restricted to the Messenger development client.');return MESSENGER_CLOUD_PREVIEW_ENTRY;}
  return DEV_URLS[id];
}
function prepare(id,options){
  const config=configFor(id,options),c=identity(id,options.mode);let entry=previewEntry(id,options),releases=[],auth=null;
  if(id==='platform'&&['index.html','launcher.mjs','launcher.css'].some(file=>!fs.existsSync(path.join(root,'renderer',file))))throw Error('The native platform renderer must be built before packaging.');
  if(id==='platform')verifyMemberActivity();
  if(options.authConfig){auth=JSON.parse(fs.readFileSync(options.authConfig,'utf8'));configuration(auth,id,options.mode);}
  if(options.mode==='development'&&id==='platform')releases=previewReleases(options);
  if(options.mode==='release') {
    if(!options.releaseConfig)throw Error('Release URLs and approved application hashes are not configured.');
    const release=JSON.parse(fs.readFileSync(options.releaseConfig,'utf8'));entry=id==='platform'?PLATFORM_ENTRY:release.entries?.[id];releases=release.releases||[];
    if(release.version!==1||release.approved!==true)throw Error('Release configuration is not approved.');
  }
  if(!safeEntry(entry,options.mode,{clientId:id,messengerCloudPreview:options.messengerCloudPreview,worldCloudPreview:options.worldCloudPreview}))throw Error('Invalid entry URL for '+id);
  const stageRoot=path.resolve(root,'.stage'),stage=path.resolve(config.directories.app);
  if(!inside(stageRoot,stage))throw Error('Invalid staging directory');
  fs.rmSync(stage,{recursive:true,force:true});
  fs.mkdirSync(stage,{recursive:true});fs.cpSync(path.join(root,'src'),path.join(stage,'src'),{recursive:true});
  for(const directory of ['renderer','assets'])if(fs.existsSync(path.join(root,directory)))fs.cpSync(path.join(root,directory),path.join(config.directories.app,directory),{recursive:true});
  if(id==='platform'&&options.mode==='development')for(const release of releases){if(!release.installer)continue;const child=identity(release.id,'development'),output=configFor(release.id,options).directories.output;
    const installer=path.join(output,child.productName+'-'+release.version+'-'+(options.platform==='win32'?'win':'mac')+'-'+options.arch+(options.platform==='win32'?'.exe':'.dmg'));
    config.extraResources.push({from:installer,to:'clients/'+release.installer.relativePath});
  }
  const version=require('../package.json').version;
  fs.writeFileSync(path.join(config.directories.app,'package.json'),JSON.stringify({name:'synk-'+id+(options.mode==='development'?'-preview':''),version,description:identity(id,options.mode).name+' desktop client',author:'SYNK',main:'src/main.cjs'},null,2));
  fs.writeFileSync(path.join(config.directories.app,'runtime.json'),JSON.stringify({clientId:id,mode:options.mode,entry,...(options.messengerCloudPreview?{messengerCloudPreview:true}:{}),...(options.worldCloudPreview?{worldCloudPreview:true}:{}),releases,auth},null,2));
  fs.writeFileSync(path.join(config.directories.app,'synk-install.json'),JSON.stringify({clientId:id,mode:options.mode,appId:c.appId,version,arch:options.arch,platform:options.platform,sourceHash:sourceHash()},null,2));
  return config;
}
function parseOptions(args) {
  const allowed=['mode','platform','arch','client','release-config','auth-config','dir','messenger-cloud-preview','world-cloud-preview'];const options={mode:'development',platform:process.platform,arch:process.arch};
  for(const arg of args){const m=/^--([a-z-]+)=(.+)$/.exec(arg);if(!m||!allowed.includes(m[1]))throw Error('Unknown argument');options[m[1]==='release-config'?'releaseConfig':m[1]==='auth-config'?'authConfig':m[1]==='messenger-cloud-preview'?'messengerCloudPreview':m[1]==='world-cloud-preview'?'worldCloudPreview':m[1]]=m[2];}
  if(!['development','release'].includes(options.mode)||!['win32','darwin'].includes(options.platform)||!['x64','arm64'].includes(options.arch))throw Error('Unsupported build target');
  if(options.messengerCloudPreview!==undefined){if(options.messengerCloudPreview!=='true'||options.mode!=='development'||options.client!=='messenger')throw Error('Use --client=messenger --mode=development --messenger-cloud-preview=true.');options.messengerCloudPreview=true;}
  if(options.worldCloudPreview!==undefined){if(options.worldCloudPreview!=='true'||options.mode!=='development'||options.client!=='world'||options.messengerCloudPreview!==undefined)throw Error('Use --client=world --mode=development --world-cloud-preview=true.');options.worldCloudPreview=true;}
  return options;
}
async function main(args=process.argv.slice(2)) {
  const options=parseOptions(args);
  if(options.platform==='darwin'&&process.platform!=='darwin'&&options.dir!=='true')throw Error('Create Mac DMG/ZIP installers on macOS; this host can only prepare an unsigned .app directory.');
  const ids=options.client?[options.client]:['world','messenger','platform'];
  const electronVersion=require('../package.json').devDependencies.electron;
  for(const id of ids){const config=prepare(id,options);const target=options.platform==='win32'?Platform.WINDOWS:Platform.MAC;
    const artifacts=await build({targets:target.createTarget(options.dir==='true'?'dir':null,options.arch==='arm64'?Arch.arm64:Arch.x64),config:{...config,electronVersion},publish:'never'});
    process.stdout.write(JSON.stringify({client:id,mode:options.mode,platform:options.platform,arch:options.arch,artifacts})+'\n');
  }
}
if(require.main===module)main().catch(error=>{process.stderr.write(error.message+'\n');process.exitCode=1;});
module.exports={configFor,prepare,previewEntry,parseOptions,verifyMemberActivity};
