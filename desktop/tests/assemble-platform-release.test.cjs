'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {freeze}=require('../tools/freeze-platform-release.cjs');
const {assemble,parseArgs,TARGETS}=require('../tools/assemble-platform-release.cjs');
const {validateManifest,MANIFEST_URL}=require('../src/platform-update.cjs');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex'),now=Date.parse('2026-10-14T12:00:00.000Z');
const json=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');
function fixture(t,{remoteMac=false}={}){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'synk-assemble-release-')),source=path.join(root,'desktop'),release=path.join(root,'frozen'),output=path.join(root,'output/preview.json');
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  for(const dir of ['src','renderer','assets']){fs.mkdirSync(path.join(source,dir),{recursive:true});fs.writeFileSync(path.join(source,dir,'synthetic.txt'),dir+' synthetic source');}
  const definition={schemaVersion:1,product:'platform',channel:'preview',version:'0.4.4',releaseId:'platform-preview-0.4.4',buildId:'20261014.1',manifestUrl:MANIFEST_URL};
  freeze({source,output:release,definition});const spec=JSON.parse(fs.readFileSync(path.join(release,'release-input.json'))),reports=[],documents=[],remoteAssets=[];
  for(const target of TARGETS){
    const [platform,arch]=target.split('-'),directory=path.join(root,target);fs.mkdirSync(directory);
    const bytes=Buffer.from('synthetic installer for '+target),name=`SYNK-Platform-Preview-${spec.version}-Signal-${platform==='win32'?'win':'mac'}-${arch}.${platform==='win32'?'exe':'dmg'}`;
    const artifact={platform,arch,url:`https://github.com/unmet23-lab/synk-policy/releases/download/${spec.releaseId}/${name}`,bytes:bytes.length,sha256:hash(bytes),asarSHA256:hash('archive '+target)};
    const artifactFile=remoteMac&&platform==='darwin'?'/Users/runner/work/remote/dist/'+name:path.join(directory,name);
    if(!remoteMac||platform!=='darwin')fs.writeFileSync(artifactFile,bytes);
    else remoteAssets.push({name,size:bytes.length,digest:'sha256:'+artifact.sha256,browser_download_url:artifact.url,state:'uploaded'});
    const report={ok:true,schemaVersion:1,product:'platform',channel:spec.channel,version:spec.version,releaseId:spec.releaseId,buildId:spec.buildId,builtAt:'2026-10-14T11:50:00.000Z',sourceHash:spec.sourceHash,artifact,artifactFile,memberCount:3,bundled:[],metadata:{clientId:'platform',mode:'development',appId:'im.synk.platform.preview',version:spec.version,arch,platform,sourceHash:spec.sourceHash,releaseId:spec.releaseId,buildId:spec.buildId,channel:spec.channel},unsignedPreview:platform==='win32',adHocSigned:platform==='darwin',notarized:false,installedStateTouched:false,published:false};
    const reportFile=path.join(directory,'build-report.json');json(reportFile,report);json(path.join(directory,'artifact.json'),artifact);reports.push(reportFile);documents.push(report);
  }
  return {root,source,release,output,reports,documents,remoteAssets,spec,now};
}
test('assembles all three verified native targets from one frozen source into a client-valid manifest',t=>{
  const f=fixture(t),result=assemble({...f,reports:[f.reports[2],f.reports[0],f.reports[1]]});
  assert.equal(result.ok,true);assert.equal(result.manifest.sourceHash,f.spec.sourceHash);assert.equal(result.manifest.publishedAt,new Date(now).toISOString());
  assert.deepEqual(result.manifest.artifacts.map(row=>row.platform+'-'+row.arch),TARGETS);
  for(const artifact of result.manifest.artifacts)assert.equal(validateManifest(result.manifest,{platform:artifact.platform,arch:artifact.arch,currentVersion:f.spec.version,currentBuildId:f.spec.buildId,now}).current,true);
  assert.ok(result.verification.every(row=>row.verifiedBy.join()==='local-bytes'));
  assert.deepEqual(JSON.parse(fs.readFileSync(f.output)),result.manifest);assert.equal(JSON.stringify(result.manifest).includes(f.root),false);
});
test('mixing different source, version, build, release or delivered identity is rejected before output',t=>{
  const f=fixture(t),original=structuredClone(f.documents[1]);
  for(const [key,value]of [['sourceHash','b'.repeat(64)],['version','0.4.5'],['releaseId','platform-preview-0.4.5'],['buildId','20261014.2'],['channel','stable']]){
    json(f.reports[1],{...original,[key]:value});assert.throws(()=>assemble(f),new RegExp(key));assert.equal(fs.existsSync(f.output),false);
  }
  json(f.reports[1],{...original,metadata:{...original.metadata,sourceHash:'c'.repeat(64)}});assert.throws(()=>assemble(f),/Delivered sourceHash/);
  json(f.reports[1],{...original,metadata:{...original.metadata,arch:'x64'}});assert.throws(()=>assemble(f),/Delivered target/);
});
test('missing, repeated, unsupported and mismatched targets never produce a partial manifest',t=>{
  const f=fixture(t);assert.throws(()=>assemble({...f,reports:f.reports.slice(0,2)}),/exactly three/);
  assert.throws(()=>assemble({...f,reports:[f.reports[0],f.reports[1],f.reports[1]]}),/Repeated build target/);
  json(f.reports[2],{...f.documents[2],artifact:{...f.documents[2].artifact,platform:'linux'}});assert.throws(()=>assemble(f),/Unexpected build target/);assert.equal(fs.existsSync(f.output),false);
});
test('an artifact sidecar from another output, unsuccessful build or missing archive verification is rejected',t=>{
  const f=fixture(t),original=f.documents[0];json(path.join(path.dirname(f.reports[0]),'artifact.json'),f.documents[1].artifact);assert.throws(()=>assemble(f),/artifact.json differ/);
  json(path.join(path.dirname(f.reports[0]),'artifact.json'),original.artifact);
  for(const patch of [{ok:false},{memberCount:0},{unsignedPreview:false},{installedStateTouched:true},{published:true},{notarized:true}]){json(f.reports[0],{...original,...patch});assert.throws(()=>assemble(f));}
});
test('actual installer bytes are checked even when a build report claims the expected digest',t=>{
  const f=fixture(t),file=f.documents[0].artifactFile;fs.writeFileSync(file,Buffer.alloc(f.documents[0].artifact.bytes));
  assert.throws(()=>assemble(f),/Local installer bytes differ for win32-x64/);assert.equal(fs.existsSync(f.output),false);
});
test('remote Mac outputs can be verified by GitHub asset digests while Windows is verified locally',t=>{
  const f=fixture(t,{remoteMac:true}),remoteFile=path.join(f.root,'github-assets.json');json(remoteFile,{tag_name:f.spec.releaseId,assets:f.remoteAssets});
  const result=assemble({...f,remoteAssets:remoteFile});assert.deepEqual(result.verification.map(row=>row.verifiedBy),[['local-bytes'],['github-release-assets'],['github-release-assets']]);
  assert.equal(result.manifest.artifacts.length,3);
});
test('remote reports alone are not proof of an uploaded installer',t=>{
  const f=fixture(t,{remoteMac:true});assert.throws(()=>assemble({...f,remoteAssets:null}),/No local bytes or uploaded GitHub digest for darwin-arm64/);assert.equal(fs.existsSync(f.output),false);
});
test('an untagged GitHub draft URL requires matching top-level draft and tag proof and keeps canonical manifest URLs',t=>{
  const f=fixture(t,{remoteMac:true}),rows=f.remoteAssets.map(row=>({...row,browser_download_url:row.browser_download_url.replace('/'+f.spec.releaseId+'/','/untagged-3c8dc9aa8f189f96843d/')}));
  assert.throws(()=>assemble({...f,remoteAssets:rows}),/download URL differs/);
  assert.throws(()=>assemble({...f,remoteAssets:{assets:rows,isDraft:false,tagName:f.spec.releaseId}}),/download URL differs/);
  assert.throws(()=>assemble({...f,remoteAssets:{assets:rows,isDraft:true,tagName:'platform-preview-0.4.3'}}),/release tag differs/);
  for(const changed of [rows[0].browser_download_url.replace('unmet23-lab','other-owner'),rows[0].browser_download_url.replace('arm64.dmg','x64.dmg')]){
    assert.throws(()=>assemble({...f,remoteAssets:{assets:[{...rows[0],browser_download_url:changed},rows[1]],isDraft:true,tagName:f.spec.releaseId}}),/download URL differs/);
  }
  const result=assemble({...f,remoteAssets:{assets:rows,isDraft:true,tagName:f.spec.releaseId}});
  assert.ok(result.manifest.artifacts.every(row=>row.url.includes('/'+f.spec.releaseId+'/')));assert.equal(JSON.stringify(result.manifest).includes('untagged-'),false);
});
test('GitHub evidence must match the exact name, size, SHA-256, release URL and completed upload state',t=>{
  const f=fixture(t,{remoteMac:true}),original=structuredClone(f.remoteAssets);
  for(const patch of [{size:1},{digest:null},{digest:'sha256:'+'c'.repeat(64)},{browser_download_url:original[0].browser_download_url.replace('0.4.4','0.4.3')},{state:'starter'},{name:'another-file.dmg'}]){
    const rows=structuredClone(original);rows[0]={...rows[0],...patch};assert.throws(()=>assemble({...f,remoteAssets:rows}));assert.equal(fs.existsSync(f.output),false);
  }
  assert.throws(()=>assemble({...f,remoteAssets:[...original,original[0]]}),/Duplicate GitHub asset name/);
  assert.throws(()=>assemble({...f,remoteAssets:{tag_name:'platform-preview-0.4.3',assets:original}}),/GitHub release tag differs/);
});
test('collected local artifacts may use an explicit root without relying on a CI absolute file path',t=>{
  const f=fixture(t),artifactRoot=path.join(f.root,'collected');fs.mkdirSync(artifactRoot);
  for(let i=0;i<f.documents.length;i++){const report=f.documents[i],name=path.basename(report.artifactFile);fs.renameSync(report.artifactFile,path.join(artifactRoot,name));json(f.reports[i],{...report,artifactFile:'/Users/remote/build/'+name});}
  const result=assemble({...f,artifactRoot});assert.ok(result.verification.every(row=>row.verifiedBy.join()==='local-bytes'));
});
test('if a same-name collected copy exists it must also match instead of silently choosing another file',t=>{
  const f=fixture(t),artifactRoot=path.join(f.root,'collected');fs.mkdirSync(artifactRoot);fs.writeFileSync(path.join(artifactRoot,path.basename(f.documents[0].artifactFile)),'wrong copy');
  assert.throws(()=>assemble({...f,artifactRoot}),/Local installer bytes differ/);
});
test('a changed frozen tree or hash cannot be hidden behind matching report fields',t=>{
  const f=fixture(t);fs.appendFileSync(path.join(f.release,'source/src/synthetic.txt'),'changed');assert.throws(()=>assemble(f),/Frozen source changed/);assert.equal(fs.existsSync(f.output),false);
});
test('assembler preserves an existing manifest and emits only after all checks succeed',t=>{
  const f=fixture(t);const first=assemble(f),bytes=fs.readFileSync(f.output);assert.throws(()=>assemble(f),/Preserve existing assembled manifest/);assert.deepEqual(fs.readFileSync(f.output),bytes);
  assert.deepEqual(fs.readdirSync(path.dirname(f.output)),['preview.json']);assert.equal(first.manifest.version,'0.4.4');
});
test('CLI accepts exactly documented inputs and preserves all three report paths',()=>{
  assert.deepEqual(parseArgs(['--release=frozen','--report=win.json','--report=arm.json','--report=intel.json','--out=preview.json','--artifact-root=files','--remote-assets=assets.json']),{reports:['win.json','arm.json','intel.json'],release:'frozen',output:'preview.json',artifactRoot:'files',remoteAssets:'assets.json'});
  assert.throws(()=>parseArgs(['--release=a','--release=b']),/Repeated argument/);assert.throws(()=>parseArgs(['--publish=yes']),/Unsupported argument/);
});
test('published unified tools load the shipped validator from source/src without a development checkout',t=>{
  const f=fixture(t),published=path.join(f.root,'public-unified'),tools=path.join(published,'tools');fs.mkdirSync(tools,{recursive:true});fs.mkdirSync(path.join(published,'source/src'),{recursive:true});
  for(const name of ['assemble-platform-release.cjs','build-platform-release.cjs','freeze-platform-release.cjs','source-hash.cjs'])fs.copyFileSync(path.join(__dirname,'../tools',name),path.join(tools,name));
  fs.copyFileSync(path.join(__dirname,'../src/platform-update.cjs'),path.join(published,'source/src/platform-update.cjs'));
  const run=require('node:child_process').spawnSync(process.execPath,['-e','require(process.argv[1]); process.stdout.write("loaded")',path.join(tools,'assemble-platform-release.cjs')],{encoding:'utf8',windowsHide:true});
  assert.equal(run.status,0,run.stderr);assert.equal(run.stdout,'loaded');
});
