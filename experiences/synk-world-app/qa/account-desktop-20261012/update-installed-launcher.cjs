'use strict';
// Add one verified WORLD release to the installed Platform catalog. Preserve all
// Platform/PULSE code and every other app/installer; never access user profiles.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=process.cwd(),asar=require(path.join(root,'desktop/node_modules/@electron/asar'));
const work=path.join(root,'.tmp/world-tutor-native-20261012/launcher'),resources=path.join(process.env.LOCALAPPDATA,'Programs/SYNKPlatformPreview/resources'),archive=path.join(resources,'app.asar');
const pkg=require(path.join(root,'.tmp/world-tutor-native-20261012/package.json'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const walk=(dir,rel='')=>fs.readdirSync(path.join(dir,rel),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(dir,path.join(rel,e.name)):[path.join(rel,e.name)]).sort();
async function main(){
 assert.ok(!fs.existsSync(work));fs.mkdirSync(work,{recursive:true});
 const beforeSHA256=hash(archive),backup=path.join(work,'before-app.asar');fs.copyFileSync(archive,backup);
 const stage=path.join(work,'stage');asar.extractAll(archive,stage);
 const names=walk(stage),original=new Map(names.map(name=>[name,hash(path.join(stage,name))]));
 const runtimeFile=path.join(stage,'runtime.json'),runtime=JSON.parse(fs.readFileSync(runtimeFile));assert.equal(runtime.clientId,'platform');assert.equal(runtime.mode,'development');assert.equal(hash(pkg.installer.path),pkg.installer.sha256);
 const release={id:'world',mode:'development',platform:'win32',arch:'x64',version:'0.4.2',executableSHA256:pkg.executable.sha256,asarSHA256:pkg.asar.sha256,installer:{relativePath:'world-0.4.2.exe',sha256:pkg.installer.sha256,bytes:pkg.installer.bytes}};
 // Existing package validation allows only the fixed world.exe path. Update
 // that installer with its matching catalog pin and preserve the old release.
 release.installer.relativePath='world.exe';
 const old=runtime.releases.find(r=>r.id==='world'&&r.installer);assert.ok(old);const previousInstaller=path.join(resources,'clients',old.installer.relativePath);assert.equal(hash(previousInstaller),old.installer.sha256);fs.copyFileSync(previousInstaller,path.join(work,'before-world.exe'));
 const oldReleases=structuredClone(runtime.releases);runtime.releases=runtime.releases.map(r=>r.id==='world'?(({installer,...pin})=>pin)(r):r);runtime.releases.unshift(release);
 fs.writeFileSync(runtimeFile,JSON.stringify(runtime,null,2)+'\n');
 for(const name of names)if(name!=='runtime.json')assert.equal(hash(path.join(stage,name)),original.get(name),name);
 const candidate=path.join(work,'candidate-app.asar');await asar.createPackage(stage,candidate);
 for(const name of names)assert.equal(digest(asar.extractFile(candidate,path.normalize(name))),hash(path.join(stage,name)),name);
 const checkOptions={clientId:'platform',mode:'development',platform:'win32',arch:'x64',programRoot:path.join(process.env.LOCALAPPDATA,'Programs'),releases:runtime.releases};
 const {createInstallations}=require(path.join(stage,'src/installations.cjs'));const before=await createInstallations({...checkOptions,releases:oldReleases}).getClients(),after=await createInstallations(checkOptions).getClients();
 assert.equal(before.find(c=>c.id==='world').canLaunch,false);assert.equal(after.find(c=>c.id==='world').canLaunch,true);assert.deepEqual(after.filter(c=>c.id!=='world'),before.filter(c=>c.id!=='world'));
 const nextInstaller=path.join(resources,'clients','world.exe.tutor-next'),nextArchive=path.join(resources,'app.asar.tutor-next');fs.copyFileSync(pkg.installer.path,nextInstaller);assert.equal(hash(nextInstaller),pkg.installer.sha256);fs.copyFileSync(candidate,nextArchive);assert.equal(hash(nextArchive),hash(candidate));
 fs.renameSync(nextInstaller,path.join(resources,'clients','world.exe'));fs.renameSync(nextArchive,archive);
 asar.uncache(archive);for(const name of names)if(name!=='runtime.json')assert.equal(digest(asar.extractFile(archive,path.normalize(name))),original.get(name),name);
 const installedRuntime=JSON.parse(asar.extractFile(archive,'runtime.json')),actual=await createInstallations({...checkOptions,releases:installedRuntime.releases}).getClients();assert.equal(actual.find(c=>c.id==='world').canLaunch,true);
 const result={at:new Date().toISOString(),ok:true,platformVersion:JSON.parse(asar.extractFile(archive,'package.json')).version,platformCodePreserved:names.length-1,changedArchiveMembers:['runtime.json'],beforeSHA256,afterSHA256:hash(archive),world:actual.find(c=>c.id==='world'),otherClientsUnchanged:true,profilesAccessed:false,worldInstallerSHA256:hash(path.join(resources,'clients','world.exe')),backup};fs.writeFileSync(path.join(work,'report.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
