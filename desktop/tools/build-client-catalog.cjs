'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {identity}=require('../src/catalog.cjs');
const {inside}=require('../src/security.cjs');
const {fileHash}=require('../src/client-lifecycle.cjs');
const {validRelease,installerPath}=require('../src/release-catalog.cjs');
async function buildCatalog({root=path.resolve(__dirname,'..')}={}) {
  const distribution=await fs.realpath(path.join(root,'dist'));
  const report=JSON.parse(await fs.readFile(path.join(root,'artifacts','package-verification.json'),'utf8'));
  if(report.ok!==true||!Array.isArray(report.packages))throw Error('PACKAGE_VERIFICATION_REQUIRED');
  const entries=new Map(),key=r=>[r.id,r.mode,r.platform,r.arch,r.version].join(':');
  // Keep pins for older, previously verified installations so a new build can offer an update without disabling their launch button.
  try {
    const previous=JSON.parse(await fs.readFile(path.join(root,'artifacts','client-releases.json'),'utf8'));
    if(previous.version===1&&previous.approved===true&&previous.source==='verified-local-builds')for(const r of previous.releases||[]) {
      if(!['world','messenger'].includes(r.id)||r.mode!=='development'||!validRelease(r,r))continue;
      const {installer,...pin}=r;entries.set(key(pin),pin);
    }
  }catch{}
  for(const p of report.packages) {
    if(!['world','messenger'].includes(p.clientId)||p.mode!=='development')continue;
    const i=identity(p.clientId,p.mode);
    if(i.appId!==p.appId)throw Error('INVALID_PACKAGE_IDENTITY');
    for(const member of [p.installer,p.executable,p.asar]) {
      if(!member||typeof member.path!=='string')throw Error('INVALID_PACKAGE_MANIFEST');
      const file=await fs.realpath(member.path);
      if(!inside(distribution,file)||await fileHash(file)!==member.sha256)throw Error('PACKAGE_HASH_MISMATCH');
    }
    const release={id:p.clientId,mode:p.mode,platform:p.platform,arch:p.arch,version:p.version,executableSHA256:p.executable.sha256,asarSHA256:p.asar.sha256,installer:{relativePath:path.relative(distribution,p.installer.path).split(path.sep).join('/'),sha256:p.installer.sha256,bytes:(await fs.stat(p.installer.path)).size}};
    if(release.installer.bytes!==p.installer.bytes||!validRelease(release,p)||!installerPath(release,distribution))throw Error('INVALID_PACKAGE_MANIFEST');
    entries.set(key(release),release);
  }
  const releases=[...entries.values()];
  const result={version:1,approved:true,source:'verified-local-builds',checkedAt:new Date().toISOString(),installerExecuted:false,releases};
  await fs.writeFile(path.join(root,'artifacts','client-releases.json'),JSON.stringify(result,null,2)+'\n');
  return result;
}
if(require.main===module)buildCatalog().then(r=>process.stdout.write(JSON.stringify({ok:true,releaseCount:r.releases.length,installerExecuted:false})+'\n')).catch(e=>{process.stderr.write(e.message+'\n');process.exitCode=1;});
module.exports={buildCatalog};
