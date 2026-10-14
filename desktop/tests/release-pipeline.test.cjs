'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {freeze,inventory}=require('../tools/freeze-platform-release.cjs');
const {validateSnapshot,verifySignalPackage,sha,command}=require('../tools/build-platform-release.cjs');
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'synk-release-contract-')),source=path.join(root,'desktop'),output=path.join(root,'frozen');for(const dir of ['src','renderer','assets']){fs.mkdirSync(path.join(source,dir),{recursive:true});fs.writeFileSync(path.join(source,dir,'synthetic.txt'),dir+' source');}t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return {source,output,definition:{schemaVersion:1,product:'platform',channel:'preview',version:'0.4.4',releaseId:'platform-preview-0.4.4',buildId:'20261014.1',manifestUrl:'https://synk.im/desktop/releases/preview.json'}};}
test('freeze is immutable and validates actual source bytes',t=>{const f=fixture(t),report=freeze(f);assert.equal(report.sourceFiles,3);assert.equal(validateSnapshot(f.output).sourceHash,report.sourceHash);assert.throws(()=>freeze(f),/Preserve/);fs.appendFileSync(path.join(f.output,'source/renderer/synthetic.txt'),'changed');assert.throws(()=>validateSnapshot(f.output),/Frozen source changed/);});
test('freeze does not include unrelated files and rejects credential content',t=>{const f=fixture(t);fs.writeFileSync(path.join(f.source,'private.txt'),'outside product roots');freeze(f);assert.equal(fs.existsSync(path.join(f.output,'source/private.txt')),false);const next={...f,output:f.output+'-bad'};fs.writeFileSync(path.join(f.source,'src/token.js'),'const key="sb_secret_syntheticOnly";');assert.throws(()=>freeze(next),/Private source content/);});
test('release identity cannot reuse a version with a mismatched release id',t=>{const f=fixture(t);f.definition.releaseId='platform-preview-0.4.3';assert.throws(()=>freeze(f),/identity mismatch/);});

function signalFixture(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'synk-signal-evidence-')),signalOut=path.join(root,'signal'),payload=path.join(root,'payload'),version='0.4.6';
  fs.mkdirSync(path.join(signalOut,'backend'),{recursive:true});fs.mkdirSync(path.join(payload,'resources'),{recursive:true});
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value));
  fs.writeFileSync(path.join(payload,'SYNKPlatformPreview.exe'),'synthetic app');fs.writeFileSync(path.join(payload,'resources/app.asar'),'synthetic archive');
  const files=inventory(payload),pin={source:'unified-reviewed-payload',bytes:files.reduce((sum,row)=>sum+row.bytes,0),sha256:'a'.repeat(64),asarSHA256:sha(path.join(payload,'resources/app.asar')),executableSHA256:sha(path.join(payload,'SYNKPlatformPreview.exe'))};
  const name='SYNK-Platform-Preview-'+version+'-Signal-win-x64.exe',artifact=path.join(signalOut,name),backend=path.join(signalOut,'backend/signal-backend.exe');
  fs.writeFileSync(artifact,'synthetic signal installer');fs.writeFileSync(backend,'synthetic backend');
  const descriptor=file=>({bytes:fs.statSync(file).size,sha256:sha(file)}),report={ok:true,product:'platform',appVersion:version,baseline:pin,installer:{file:name,...descriptor(artifact)},backend:descriptor(backend),appPayloadUnchanged:true,payloadFiles:files.length};
  const spec={appId:'im.synk.platform.preview',product:'platform',version,executableName:'SYNKPlatformPreview.exe',backendBytes:report.backend.bytes,backendSHA256:report.backend.sha256,files};
  const reportFile=path.join(signalOut,'windows-signal-package.json'),specFile=path.join(signalOut,'install.json');
  const save=()=>{write(reportFile,report);write(specFile,spec);};save();
  return {root,signalOut,payload,version,files,pin,artifact,backend,report,spec,reportFile,specFile,save,verify:()=>verifySignalPackage({signalOut,version,pin,files,payload})};
}

test('Signal success evidence agrees with the final installer, backend and pinned payload',t=>{
  const f=signalFixture(t);assert.equal(f.verify(),f.artifact);
});

test('a zero-exit child with a leftover executable cannot pass without its final Signal success report',t=>{
  const f=signalFixture(t);fs.unlinkSync(f.reportFile);
  assert.equal(command(process.execPath,['-e','console.error("synthetic late payload assertion");process.exitCode=0;']),'');
  assert.equal(fs.existsSync(f.artifact),true);assert.throws(f.verify,/Signal success evidence missing/);
});

test('incomplete or mismatched Signal results cannot produce a release artifact',async t=>{
  const cases=[
    ['malformed JSON',f=>fs.writeFileSync(f.reportFile,'{')],
    ['null report',f=>fs.writeFileSync(f.reportFile,'null')],
    ['failure report',f=>{f.report.ok=false;f.save();}],
    ['wrong product',f=>{f.report.product='world';f.save();}],
    ['wrong version',f=>{f.report.appVersion='0.4.5';f.save();}],
    ['wrong artifact name',f=>{f.report.installer.file='../other.exe';f.save();}],
    ['wrong installer size',f=>{f.report.installer.bytes++;f.save();}],
    ['wrong installer hash',f=>{f.report.installer.sha256='b'.repeat(64);f.save();}],
    ['missing final installer',f=>fs.unlinkSync(f.artifact)],
    ['payload unchanged false',f=>{f.report.appPayloadUnchanged=false;f.save();}],
    ['wrong payload count',f=>{f.report.payloadFiles++;f.save();}],
    ['different payload pin',f=>{f.report.baseline={...f.pin,asarSHA256:'c'.repeat(64)};f.save();}],
    ['missing installation specification',f=>fs.unlinkSync(f.specFile)],
    ['wrong install identity',f=>{f.spec.version='0.4.5';f.save();}],
    ['wrong embedded backend hash',f=>{f.spec.backendSHA256='d'.repeat(64);f.save();}],
    ['wrong backend report size',f=>{f.report.backend.bytes++;f.save();}],
    ['backend modified after reporting',f=>fs.appendFileSync(f.backend,'changed')],
    ['missing backend',f=>fs.unlinkSync(f.backend)],
    ['different embedded inventory',f=>{f.spec.files=f.files.slice(1);f.save();}],
    ['extra payload file left by builder',f=>fs.writeFileSync(path.join(f.payload,'resources/elevate.exe'),'unexpected helper')],
    ['payload changed after reporting',f=>fs.appendFileSync(path.join(f.payload,'resources/app.asar'),'changed')],
  ];
  for(const [name,mutate]of cases)await t.test(name,t=>{const f=signalFixture(t);mutate(f);assert.throws(f.verify,/Signal /);});
});
