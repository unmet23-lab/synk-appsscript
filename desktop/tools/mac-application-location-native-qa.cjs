'use strict';
// Only for an ephemeral GitHub macOS runner. The candidate helper is exercised
// byte-for-byte in a disposable packaged fixture with no account/app UI code.
// This never launches or rewrites an installed SYNK application.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const {createRequire}=require('node:module');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const assert=(value,message)=>{if(!value)throw Error(message);};
const json=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');
function command(file,args){const result=cp.spawnSync(file,args,{encoding:'utf8',timeout:120000,maxBuffer:1024*1024});assert(result.status===0,file+' failed: '+(result.stderr||result.error?.message||result.stdout));return result.stdout.trim();}
function fixtureMain(){
  const {app,dialog}=require('electron'),fs=require('node:fs'),path=require('node:path');
  const config=require('./config.json'),{createMacApplicationLocationGate}=require('./mac-application-location.cjs');
  app.setPath('appData',config.profile);app.setPath('userData',path.join(config.profile,'synthetic'));app.setPath('sessionData',path.join(config.profile,'session'));app.disableHardwareAcceleration();
  const append=value=>fs.appendFileSync(config.events,JSON.stringify({at:new Date().toISOString(),pid:process.pid,...value})+'\n');
  app.on('before-quit',()=>append({event:'before-quit'}));app.on('will-quit',()=>append({event:'will-quit'}));
  app.whenReady().then(async()=>{
    app.dock?.hide();const inside=app.isInApplicationsFolder();append({event:'started',inside,packaged:app.isPackaged,executable:app.getPath('exe'),electron:process.versions.electron,arch:process.arch});
    // Dialog responses are synthetic; both location and movement APIs are real.
    dialog.showMessageBox=async options=>{append({event:'dialog',type:options.type,message:options.message,buttons:options.buttons});return {response:options.type==='question'?config.initial:0};};
    dialog.showMessageBoxSync=options=>{append({event:'replacement-confirmation',message:options.message,defaultId:options.defaultId,cancelId:options.cancelId});return config.replace;};
    const originalMove=app.moveToApplicationsFolder.bind(app);app.moveToApplicationsFolder=options=>{append({event:'native-move-called'});return originalMove({conflictHandler:type=>{append({event:'native-conflict',type});return options.conflictHandler(type);}});};
    const gate=createMacApplicationLocationGate({app,dialog,productName:'SYNK Location QA'}),result=await gate.run();append({event:'result',inside,...result});
    if(result.continueStartup){jsonDone({ok:true,inside,...result,packaged:app.isPackaged});app.quit();}
    function jsonDone(value){fs.writeFileSync(config.done,JSON.stringify(value));}
  }).catch(error=>{append({event:'error',message:error.message});fs.writeFileSync(config.done,JSON.stringify({ok:false,error:error.message}));app.exit(1);});
}
async function run(options){
  assert(process.platform==='darwin'&&process.env.GITHUB_ACTIONS==='true'&&process.env.RUNNER_OS==='macOS','Ephemeral GitHub macOS runner required');
  const out=path.resolve(options.out),builder=path.resolve(options.builder||'.'),config=JSON.parse(fs.readFileSync(path.resolve(options.config),'utf8')),bundle=config.bundles.platform;
  assert(!out.split(path.sep).includes('Applications'),'Fixture source must be outside every Applications directory');
  assert(!fs.existsSync(out),'Output must be new');fs.mkdirSync(out,{recursive:true});
  const asar=createRequire(path.join(builder,'package.json'))('@electron/asar'),originalArchive=fs.readFileSync(bundle.archive),sourceSHA256=sha(originalArchive),helper=asar.extractFile(bundle.archive,'src/mac-application-location.cjs'),helperSHA256=sha(helper);
  fs.accessSync('/Applications',fs.constants.W_OK);
  const runId=crypto.randomBytes(8).toString('hex'),results=[],checks=[];
  const check=(name,ok,detail)=>{checks.push({name,ok:!!ok,...(detail===undefined?{}:{detail})});assert(ok,name);};
  const cleanup=new Set();let failure=null;
  try{
    for(const scenario of [{name:'decline',initial:1,replace:0,status:'declined'},{name:'move',initial:0,replace:0,status:'in-applications'},{name:'replacement-decline',initial:0,replace:0,existing:true,status:'replacement-declined'},{name:'replacement-accept',initial:0,replace:1,existing:true,status:'in-applications'}]){
      const caseRoot=path.join(out,scenario.name);fs.mkdirSync(caseRoot);const appName='SYNKLocationQA-'+runId+'-'+scenario.name+'.app',fixture=path.join(caseRoot,appName),destination=path.join('/Applications',appName);
      assert(!fs.existsSync(destination),'Unique QA application already exists');cleanup.add(destination);
      // APFS clone keeps the large framework/child installers from being copied.
      command('/bin/cp',['-cR',bundle.app,fixture]);
      const resources=path.join(fixture,'Contents/Resources');
      for(const leaf of ['app.asar','app.asar.unpacked','clients']){const target=path.join(resources,leaf);assert(path.dirname(target)===resources,'Fixture cleanup escaped');fs.rmSync(target,{recursive:true,force:true});}
      const stage=path.join(caseRoot,'fixture-source'),profile=path.join(caseRoot,'profile');fs.mkdirSync(stage);fs.mkdirSync(path.join(profile,'synthetic'),{recursive:true});
      const sentinels=['account.json','library.json'].map((name,index)=>{const file=path.join(profile,'synthetic',name),value=Buffer.from('synthetic-preserved-record-'+index);fs.writeFileSync(file,value);return {file,sha256:sha(value)};});
      const eventFile=path.join(caseRoot,'events.jsonl'),done=path.join(caseRoot,'done.json');
      json(path.join(stage,'package.json'),{name:'synk-location-qa',version:'0.0.0',main:'main.cjs'});json(path.join(stage,'config.json'),{...scenario,profile,events:eventFile,done});fs.writeFileSync(path.join(stage,'mac-application-location.cjs'),helper);fs.writeFileSync(path.join(stage,'main.cjs'),'('+fixtureMain.toString()+')();\n');await asar.createPackage(stage,path.join(resources,'app.asar'));
      const plist=path.join(fixture,'Contents/Info.plist'),executableName=command('/usr/libexec/PlistBuddy',['-c','Print :CFBundleExecutable',plist]);
      // Preserve CFBundleName: Electron locates its existing Helper bundles by
      // this name before JavaScript starts. The .app path and ID remain unique.
      command('/usr/libexec/PlistBuddy',['-c','Set :CFBundleIdentifier im.synk.locationqa.'+runId+'.'+scenario.name,plist]);
      cp.spawnSync('/usr/libexec/PlistBuddy',['-c','Delete :ElectronAsarIntegrity',plist],{encoding:'utf8'});
      command('/usr/bin/codesign',['--force','--deep','--sign','-',fixture]);
      if(scenario.existing){command('/bin/cp',['-cR',fixture,destination]);fs.writeFileSync(path.join(destination,'Contents/Resources/previous-version-marker'),'keep until confirmed');}
      const previousArchive=scenario.existing?sha(fs.readFileSync(path.join(destination,'Contents/Resources/app.asar'))):null;
      const child=cp.spawn(path.join(fixture,'Contents/MacOS',executableName),[],{cwd:caseRoot,stdio:['ignore','pipe','pipe']});let stderr='',stdout='',closed=false;child.stdout.on('data',value=>{stdout+=value;});child.stderr.on('data',value=>{stderr+=value;});child.once('exit',()=>{closed=true;});
      const expires=Date.now()+50000;while(Date.now()<expires&&!fs.existsSync(done)){if(closed&&!fs.existsSync(eventFile))break;await sleep(100);}
      if(!fs.existsSync(done)){if(!closed)child.kill('SIGTERM');fs.writeFileSync(path.join(caseRoot,'process.log'),stdout+'\n'+stderr);throw Error('Native location timeout: '+scenario.name);}
      for(let i=0;i<100&&!closed;i++)await sleep(50);
      const result=JSON.parse(fs.readFileSync(done,'utf8')),events=fs.readFileSync(eventFile,'utf8').trim().split('\n').map(JSON.parse),starts=events.filter(value=>value.event==='started'),moved=scenario.status==='in-applications';
      check(scenario.name+' real packaged API result',result.ok&&result.packaged&&result.status===scenario.status,result);
      check(scenario.name+' first open is outside Applications',starts[0]?.inside===false&&starts[0]?.packaged===true);
      check(scenario.name+' initial proposal appears once',events.filter(value=>value.event==='dialog'&&value.type==='question').length===1);
      check(scenario.name+' preserves synthetic account and library bytes',sentinels.every(row=>sha(fs.readFileSync(row.file))===row.sha256));
      if(moved){check(scenario.name+' native move and automatic relaunch occurred',events.some(value=>value.event==='native-move-called')&&starts.length===2&&starts[1].inside===true&&starts[1].pid!==starts[0].pid);check(scenario.name+' relaunch resolves in the real Applications directory',starts[1].executable.startsWith(destination+path.sep));check(scenario.name+' copied production helper stays byte exact',sha(asar.extractFile(path.join(destination,'Contents/Resources/app.asar'),'mac-application-location.cjs'))===helperSHA256);}
      else{check(scenario.name+' declined movement never calls native API',!events.some(value=>value.event==='native-move-called'));check(scenario.name+' opens original copy with update warning',result.continueStartup&&!result.inside&&events.some(value=>value.event==='dialog'&&value.type==='warning'));}
      if(scenario.existing){check(scenario.name+' asks explicitly before replacing',events.filter(value=>value.event==='replacement-confirmation').length===1);if(!moved)check('replacement refusal preserves previous app bytes',sha(fs.readFileSync(path.join(destination,'Contents/Resources/app.asar')))===previousArchive&&fs.existsSync(path.join(destination,'Contents/Resources/previous-version-marker')));else check('confirmed replacement carries the new app',!fs.existsSync(path.join(destination,'Contents/Resources/previous-version-marker')));}
      results.push({scenario:scenario.name,result,events});
      if(fs.existsSync(destination)){assert(path.dirname(destination)==='/Applications'&&path.basename(destination).startsWith('SYNKLocationQA-'+runId+'-'),'QA cleanup escaped');fs.rmSync(destination,{recursive:true});}cleanup.delete(destination);
    }
  }catch(error){failure=error.stack||error.message;}
  finally{for(const destination of cleanup){if(fs.existsSync(destination)){assert(path.dirname(destination)==='/Applications'&&path.basename(destination).startsWith('SYNKLocationQA-'+runId+'-'),'QA cleanup escaped');fs.rmSync(destination,{recursive:true});}}}
  check('original candidate ASAR untouched',sha(fs.readFileSync(bundle.archive))===sourceSHA256);
  const report={ok:!failure,checkedAt:new Date().toISOString(),host:{platform:process.platform,arch:process.arch},helperSHA256,candidateAsarSHA256:sourceSHA256,checks,results,failure,limitations:{syntheticDialogResponses:true,realNativeLocationAndMoveAPI:true,automaticNativeRelaunch:true,productionMainUIExercised:false,realAccountsAccessed:false,realInstalledSynkAppChanged:false,protectedDirectoryBranch:'unit tested; privileged native move intentionally disabled'}};
  json(path.join(out,'report.json'),report);console.log(JSON.stringify({ok:report.ok,checks:checks.length,passed:checks.filter(row=>row.ok).length,report:path.join(out,'report.json'),failure}));return report;
}
if(require.main===module){const options={};for(const arg of process.argv.slice(2)){const match=/^--(config|out|builder)=(.+)$/.exec(arg);assert(match,'Unexpected argument');options[match[1]]=match[2];}run(options).then(report=>{if(!report.ok)process.exitCode=1;}).catch(error=>{console.error(error.stack);process.exitCode=1;});}
module.exports={run,fixtureMain};
