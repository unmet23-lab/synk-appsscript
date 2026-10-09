'use strict';
// Reuses the recorded QA procedures, loading only modules/assets from the final ASAR.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const desktop=path.resolve(__dirname,'..'),root=path.resolve(process.argv[2]||'');
if(path.dirname(root)!==path.join(desktop,'artifacts')||!path.basename(root).startsWith('platform-convenience-candidate-'))throw Error('Fixed convenience candidate required');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'snapshot-manifest.json'))),pkg=JSON.parse(fs.readFileSync(path.join(root,'artifacts/package-verification.json')));
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),archive=pkg.asar.path;
if(!pkg.ok||hash(archive)!==pkg.asar.sha256)throw Error('Verified package required');
if(fs.existsSync(path.join(root,'artifacts/package-qa.json'))){const previous=path.join(root,'artifacts','qa-attempt-'+new Date().toISOString().replace(/[:.]/g,'-'));fs.mkdirSync(previous);for(const file of ['package-qa.json','package-qa.log','asar-preferences.json','desktop-preferences-native-smoke.log','convenience-native-smoke.log','packaged-boot.json','packaged-boot.log'])if(fs.existsSync(path.join(root,'artifacts',file)))fs.copyFileSync(path.join(root,'artifacts',file),path.join(previous,file));if(fs.existsSync(path.join(root,'artifacts/asar-renderer/result.json')))fs.copyFileSync(path.join(root,'artifacts/asar-renderer/result.json'),path.join(previous,'asar-renderer-result.json'));}
const provenance=[],results=[];
for(const name of ['desktop-preferences-native-smoke','convenience-native-smoke']){
  const source=path.join(root,'tools',name+'.cjs'),target=path.join(root,'artifacts','asar-'+name+'.cjs');
  let code=fs.readFileSync(source,'utf8');
  if(!code.includes("root=path.resolve(__dirname,'..')"))throw Error('Unexpected native test root');
  code=code.replace("root=path.resolve(__dirname,'..')",'root='+JSON.stringify(archive));
  code=code.replace(/cwd:root/g,'cwd:'+JSON.stringify(root));
  code=code.replace(/require\('\.\.\/src\/([^']+)'\)/g,(_match,file)=>'require(path.join(root,'+JSON.stringify('src/'+file)+'))');
  fs.writeFileSync(target,code);
  const output=path.join(root,'artifacts',name==='desktop-preferences-native-smoke'?'asar-preferences.json':'asar-renderer');
  provenance.push({source,target,sourceSHA256:hash(source),generatedSHA256:hash(target),adaptation:'Use final app.asar as root and resolve native module imports within that root; child process working directory is the candidate folder. Assertions unchanged.'});
  const run=spawnSync(process.execPath,[target,'--out='+output],{cwd:root,windowsHide:true,encoding:'utf8',timeout:75000});
  fs.writeFileSync(path.join(root,'artifacts',name+'.log'),(run.stdout||'')+(run.stderr||''));
  const reportPath=name==='desktop-preferences-native-smoke'?output:path.join(output,'result.json');
  const report=fs.existsSync(reportPath)?JSON.parse(fs.readFileSync(reportPath)):null;
  results.push({name,exitCode:run.status,ok:run.status===0&&report?.ok===true,checks:report?.checks?.length,passed:report?.checks?.filter(row=>row.ok).length,report:reportPath,error:report?.error||run.error?.message});
}
const base=path.join(desktop,'artifacts/platform-unified-candidate-2026-10-08T22-33-02-529Z/artifacts/packaged-smoke.cjs'),boot=path.join(root,'artifacts/packaged-smoke.cjs');
fs.copyFileSync(base,boot);provenance.push({source:base,target:boot,sourceSHA256:hash(base),generatedSHA256:hash(boot),adaptation:'None. Existing paused-main path isolation and unchanged EXE --synk-smoke.'});
const bootReport=path.join(root,'artifacts/packaged-boot.json');
const run=spawnSync(process.execPath,[boot,'--executable='+pkg.executable.path,'--stage=candidate','--output='+bootReport],{cwd:root,windowsHide:true,encoding:'utf8',timeout:45000});
fs.writeFileSync(path.join(root,'artifacts/packaged-boot.log'),(run.stdout||'')+(run.stderr||''));
const report=fs.existsSync(bootReport)?JSON.parse(fs.readFileSync(bootReport)):null;
results.push({name:'unchanged-packaged-executable-boot',exitCode:run.status,ok:run.status===0&&report?.ok===true,checks:Object.keys(report?.checks||{}).length,passed:Object.values(report?.checks||{}).filter(Boolean).length,report:bootReport,error:report?.error||run.error?.message});
const summary={checkedAt:new Date().toISOString(),ok:results.every(row=>row.ok)&&hash(archive)===pkg.asar.sha256,sourceHash:manifest.sourceHash,asarSHA256:hash(archive),packageBytesUnchanged:hash(archive)===pkg.asar.sha256,results,provenance,normalProfileRead:false,installedAppLaunched:false,installerExecuted:false,liveAuthenticationPerformed:false,scope:'Actual final ASAR modules/native Tray/DPAPI and actual ASAR renderer/preload, synthetic accounts and isolated hidden windows. Separate unchanged candidate EXE boot in pre-main isolated paths.'};
fs.writeFileSync(path.join(root,'artifacts/package-qa.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary));if(!summary.ok)process.exitCode=1;
