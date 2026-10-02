'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {createClientLifecycle}=require('../src/client-lifecycle.cjs');
const {loadDevelopmentReleases}=require('../src/local-releases.cjs');
async function main() {
  const root=path.resolve(__dirname,'..'),cacheRoot=await fs.mkdtemp(path.join(os.tmpdir(),'synk-lifecycle-smoke-'));
  const releases=loadDevelopmentReleases({root,platform:process.platform,arch:process.arch});
  if(!releases.find(r=>r.id==='world')||!releases.find(r=>r.id==='messenger'))throw Error('Run build-client-catalog.cjs with both client builds first.');
  let calls=0,changes=0;
  const service=createClientLifecycle({clientId:'platform',mode:'development',platform:process.platform,arch:process.arch,programRoot:path.join(cacheRoot,'synthetic-not-installed'),packageRoot:path.join(root,'dist'),cacheRoot:path.join(cacheRoot,'prepared'),releases,spawn:()=>{calls++;throw Error('Not permitted by smoke');},openPath:async()=>{calls++;throw Error('Not permitted by smoke');},onChange:()=>{changes++;}});
  try {
    const before=await service.getClients();await service.prepareClient('world');
    let ready=null;
    for(let i=0;i<1000;i++){const c=(await service.getClients()).find(c=>c.id==='world');if(c.installer.status==='ready'){ready=c;break;}if(c.installer.status==='error')throw Error(c.installer.error);await new Promise(r=>setTimeout(r,20));}
    if(!ready)throw Error('PREPARATION_TIMEOUT');
    await service.prepareClient('messenger');const cancelled=await service.cancelPreparation('messenger');
    const after=await service.getClients(),ok=ready.installer.progress===100&&ready.installer.transferredBytes===ready.installer.totalBytes&&ready.status==='not-installed'&&cancelled.job.status==='cancelled'&&calls===0;
    const report={ok,checkedAt:new Date().toISOString(),realInstallerBytesCopied:true,installedApplicationsExecuted:false,installerExecuted:false,installationDirectory:'synthetic-not-installed',changes,before,after};
    await fs.mkdir(path.join(root,'artifacts'),{recursive:true});await fs.writeFile(path.join(root,'artifacts','lifecycle-smoke.json'),JSON.stringify(report,null,2)+'\n');
    process.stdout.write(JSON.stringify({ok,bytes:ready.installer.transferredBytes,changes,installerExecuted:false})+'\n');if(!ok)process.exitCode=1;
  }finally{service.dispose();await fs.rm(cacheRoot,{recursive:true,force:true});}
}
if(require.main===module)main().catch(e=>{process.stderr.write(e.message+'\n');process.exitCode=1;});
