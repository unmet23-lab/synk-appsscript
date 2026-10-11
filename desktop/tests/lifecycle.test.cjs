'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {createClientLifecycle}=require('../src/client-lifecycle.cjs');
const {createInstallations,installationPaths}=require('../src/installations.cjs');
const {compareVersions,installerPath}=require('../src/release-catalog.cjs');
const {loadDevelopmentReleases}=require('../src/local-releases.cjs');
const {buildCatalog}=require('../tools/build-client-catalog.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function fixture(t,overrides={}) {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'synk-lifecycle-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const source=Buffer.alloc(1024*1024,42),relativePath='preview/win32/x64/world/SYNK WORLD Preview-0.3.0-win-x64.exe';
  const packageRoot=path.join(root,'dist'),sourcePath=path.join(packageRoot,...relativePath.split('/'));
  await fs.mkdir(path.dirname(sourcePath),{recursive:true});await fs.writeFile(sourcePath,source);
  const release={id:'world',mode:'development',platform:'win32',arch:'x64',version:'0.3.0',executableSHA256:hash('exe'),asarSHA256:hash('asar'),installer:{relativePath,sha256:hash(source),bytes:source.length}};
  const opened=[],events=[];
  const opts={clientId:'platform',mode:'development',platform:'win32',arch:'x64',programRoot:path.join(root,'Programs'),packageRoot,cacheRoot:path.join(root,'cache'),releases:[release],spawn:()=>{throw Error('NO_PROCESS_ALLOWED');},openPath:async file=>{opened.push(file);return '';},onChange:()=>events.push(true),...overrides};
  const service=createClientLifecycle(opts);t.after(()=>service.dispose());
  return {root,opts,release,sourcePath,opened,events,service};
}
async function waitFor(service,status) {
  for(let i=0;i<200;i++){const result=(await service.getClients()).find(c=>c.id==='world');if(result.installer.status===status)return result;await new Promise(r=>setTimeout(r,10));}
  assert.fail('installer did not reach '+status);
}
test('version comparison is numeric, rejects non-release versions and preserves large integers',()=>{
  assert.equal(compareVersions('0.10.0','0.9.9'),1);assert.equal(compareVersions('2.0.0','2.0.0'),0);assert.equal(compareVersions('1.0.0','2.0.0'),-1);
  assert.equal(compareVersions('9007199254740993.0.0','9007199254740992.0.0'),1);
  for(const bad of ['1.0','v1.0.0','1.0.0-beta','01.0.0'])assert.throws(()=>compareVersions(bad,'1.0.0'));
});
test('package paths allow only fixed distribution coordinates or packaged application names',()=>{
  const base={id:'world',platform:'win32',mode:'development',arch:'x64',installer:{sha256:'a'.repeat(64),bytes:3}};
  for(const relativePath of ['../bad.exe','world.exe/../../bad.exe','C:/bad.exe','https://bad.exe','preview/win32/x64/messenger/bad.exe','preview/win32/x64/world/nested/bad.exe','preview/win32/x64/world/app.ps1','messenger.exe'])assert.equal(installerPath({...base,installer:{...base.installer,relativePath}},'/fixed'),null,relativePath);
  assert.ok(installerPath({...base,installer:{...base.installer,relativePath:'world.exe'}},'/fixed'));
});
test('real local bytes prepare with progress; explicit open rechecks SHA and never means installed',async t=>{
  const f=await fixture(t);assert.equal((await f.service.prepareClient('world')).ok,true);
  const ready=await waitFor(f.service,'ready');assert.equal(ready.installer.progress,100);assert.equal(ready.installer.transferredBytes,f.release.installer.bytes);assert.equal(ready.status,'not-installed');assert.equal(ready.installer.source,'local-development');assert.equal(f.opened.length,0);assert.ok(f.events.length>=2);
  assert.deepEqual(await f.service.openInstaller('world'),{ok:true,installationConfirmed:false});assert.equal(f.opened.length,1);assert.ok(f.opened[0].startsWith(f.opts.cacheRoot+path.sep));
  assert.equal((await waitFor(f.service,'installer-opened')).status,'not-installed');
  assert.equal(JSON.stringify(await f.service.getClients()).includes(f.root),false);
});
test('cancelling preparation clears partial bytes and never opens an installer',async t=>{
  const f=await fixture(t);await f.service.prepareClient('world');assert.equal((await f.service.cancelPreparation('world')).ok,true);
  await waitFor(f.service,'cancelled');assert.equal((await f.service.openInstaller('world')).code,'PACKAGE_NOT_READY');assert.equal(f.opened.length,0);
  assert.deepEqual(await fs.readdir(f.opts.cacheRoot).catch(()=>[]),[]);
});
test('unknown IDs, non-platform clients and absent channels never install or launch',async t=>{
  const f=await fixture(t,{clientId:'messenger'});
  for(const method of ['prepareClient','cancelPreparation','openInstaller']){assert.equal((await f.service[method]('../cmd')).code,'UNKNOWN_CLIENT');assert.equal((await f.service[method]('world')).code,'LAUNCHER_ONLY');}
  assert.equal((await f.service.launch('world')).code,'LAUNCHER_ONLY');
  const absent=await fixture(t,{releases:[]});assert.equal((await absent.service.prepareClient('world')).code,'RELEASE_UNAVAILABLE');assert.equal((await absent.service.getClients()).find(c=>c.id==='world').installer.status,'unavailable');
  const production=await fixture(t,{mode:'release'});assert.equal((await production.service.prepareClient('world')).code,'RELEASE_UNAVAILABLE');
});
test('missing or altered local installer reports an error without fake readiness',async t=>{
  const f=await fixture(t);await fs.writeFile(f.sourcePath,Buffer.alloc(f.release.installer.bytes,1));await f.service.prepareClient('world');
  assert.equal((await waitFor(f.service,'error')).installer.error,'PACKAGE_HASH_MISMATCH');assert.equal((await f.service.openInstaller('world')).code,'PACKAGE_NOT_READY');assert.equal(f.opened.length,0);
  const missing=await fixture(t);await fs.unlink(missing.sourcePath);await missing.service.prepareClient('world');assert.equal((await waitFor(missing.service,'error')).installer.error,'PACKAGE_NOT_FOUND');
});
test('prepared installer tampering is rejected again at the explicit open boundary',async t=>{
  const f=await fixture(t);await f.service.prepareClient('world');await waitFor(f.service,'ready');
  const directory=(await fs.readdir(f.opts.cacheRoot))[0],file=path.join(f.opts.cacheRoot,directory,path.basename(f.sourcePath));await fs.writeFile(file,Buffer.alloc(f.release.installer.bytes,7));
  assert.equal((await f.service.openInstaller('world')).code,'PACKAGE_HASH_MISMATCH');assert.equal(f.opened.length,0);
});
test('OS open failure is visible and double clicks cannot open in parallel',async t=>{
  let calls=0,release;const f=await fixture(t,{openPath:async()=>{calls++;await new Promise(r=>{release=r;});return 'OS refused';}});
  await f.service.prepareClient('world');await waitFor(f.service,'ready');const attempt=f.service.openInstaller('world');
  assert.equal((await f.service.openInstaller('world')).code,'PACKAGE_NOT_READY');while(!release)await new Promise(r=>setTimeout(r,5));release();
  assert.equal((await attempt).code,'INSTALLER_OPEN_FAILED');assert.equal(calls,1);
});
test('older verified installation stays launchable while a newer approved release is offered',async()=>{
  const old={id:'world',mode:'development',platform:'darwin',arch:'arm64',version:'0.2.0',executableSHA256:'a'.repeat(64),asarSHA256:'b'.repeat(64)};
  const service=createInstallations({clientId:'platform',mode:'development',platform:'darwin',arch:'arm64',programRoot:'/Applications',releases:[old,{...old,version:'0.10.0'}],realpath:async p=>p,readFile:async()=>JSON.stringify({clientId:'world',appId:'im.synk.world.preview',version:'0.2.0',mode:'development',arch:'arm64',platform:'darwin'}),hash:async p=>p.endsWith('.asar')?'b'.repeat(64):'a'.repeat(64)});
  const world=(await service.getClients()).find(c=>c.id==='world');assert.equal(world.version,'0.2.0');assert.equal(world.latestVersion,'0.10.0');assert.equal(world.updateAvailable,true);assert.equal(world.canLaunch,true);
});
test('catalog loader ignores missing, unapproved and mismatched platform manifests',async t=>{
  const f=await fixture(t);assert.deepEqual(loadDevelopmentReleases({root:f.root,platform:'win32',arch:'x64'}),[]);
  await fs.mkdir(path.join(f.root,'artifacts'));const target=path.join(f.root,'artifacts','client-releases.json');
  await fs.writeFile(target,JSON.stringify({version:1,approved:false,source:'verified-local-builds',releases:[f.release]}));assert.deepEqual(loadDevelopmentReleases({root:f.root,platform:'win32',arch:'x64'}),[]);
  await fs.writeFile(target,JSON.stringify({version:1,approved:true,source:'verified-local-builds',releases:[f.release]}));assert.equal(loadDevelopmentReleases({root:f.root,platform:'win32',arch:'x64'}).length,1);assert.deepEqual(loadDevelopmentReleases({root:f.root,platform:'win32',arch:'arm64'}),[]);
});

test('newer launch-only pins preserve available installers without offering a downgrade as an update',async t=>{
  const f=await fixture(t),legacy={...f.release,version:'0.4.2'};delete legacy.installer;
  const options={...f.opts,releases:[legacy,f.release]},locations=installationPaths('world',options);
  await fs.mkdir(path.dirname(locations.asar),{recursive:true});await fs.writeFile(locations.executable,'exe');await fs.writeFile(locations.asar,'asar');
  await fs.writeFile(locations.metadata,JSON.stringify({clientId:'world',appId:'im.synk.world.preview',mode:'development',platform:'win32',arch:'x64',version:legacy.version}));
  const service=createClientLifecycle(options);t.after(()=>service.dispose());
  const world=(await service.getClients()).find(row=>row.id==='world');
  assert.equal(world.canLaunch,true);assert.equal(world.version,'0.4.2');assert.equal(world.updateAvailable,false);
  assert.equal(world.latestVersion,'0.3.0');assert.equal(world.installer.version,'0.3.0');assert.equal(world.installer.canPrepare,true);
  await service.prepareClient('world');const ready=await waitFor(service,'ready');assert.equal(ready.installer.transferredBytes,f.release.installer.bytes);
});
test('catalog generation verifies installer, executable and archive hashes before approving local packages',async t=>{
  const f=await fixture(t),exe=path.join(path.dirname(f.sourcePath),'app.exe'),asar=path.join(path.dirname(f.sourcePath),'app.asar');await fs.writeFile(exe,'exe');await fs.writeFile(asar,'asar');
  await fs.mkdir(path.join(f.root,'artifacts'));const report={ok:true,packages:[{clientId:'world',mode:'development',platform:'win32',arch:'x64',appId:'im.synk.world.preview',version:'0.3.0',installer:{path:f.sourcePath,sha256:f.release.installer.sha256,bytes:f.release.installer.bytes},executable:{path:exe,sha256:hash('exe')},asar:{path:asar,sha256:hash('asar')}}]};
  await fs.writeFile(path.join(f.root,'artifacts','package-verification.json'),JSON.stringify(report));assert.equal((await buildCatalog({root:f.root})).releases.length,1);
  const previous={...f.release,version:'0.2.0'};await fs.writeFile(path.join(f.root,'artifacts','client-releases.json'),JSON.stringify({version:1,approved:true,source:'verified-local-builds',releases:[previous]}));
  const refreshed=await buildCatalog({root:f.root});assert.equal(refreshed.releases.length,2);assert.equal(refreshed.releases.find(r=>r.version==='0.2.0').installer,undefined);assert.equal(loadDevelopmentReleases({root:f.root,platform:'win32',arch:'x64'}).length,2);
  await fs.writeFile(asar,'tampered');await assert.rejects(buildCatalog({root:f.root}),/PACKAGE_HASH_MISMATCH/);
});
