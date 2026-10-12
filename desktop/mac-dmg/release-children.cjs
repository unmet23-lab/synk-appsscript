// 한 번의 CI 실행에서 만든 Mac Platform DMG 두 개(Apple 칩·Intel, signal.3)를 그 기록과 대조하고, 확인값 파일과 Mac 매니페스트를 쓴다.
// GitHub Actions의 release 작업에서 실행한다. 사용: node release-children.cjs <내려받은 폴더> <출력 폴더>
'use strict';
const fs=require('fs'),path=require('path');
const {hash}=require('./repackage.cjs');
const assert=(ok,message)=>{if(!ok)throw Error(message);};
const [input,output]=process.argv.slice(2),env=process.env;
assert(input&&output,'Use: node release-children.cjs <downloaded artifacts> <output>');
fs.mkdirSync(output,{recursive:true});
const reports=['arm64','x64'].map(arch=>{
  const report=JSON.parse(fs.readFileSync(path.join(input,`platform-children-signal.3-${arch}.json`),'utf8'));
  const dmg=JSON.parse(fs.readFileSync(path.join(input,`mac-dmg-platform-signal.3-${arch}.json`),'utf8'));
  assert(report.ok===true&&report.arch===arch&&report.revision==='signal.3'&&report.version==='0.4.3','Unexpected build record '+arch);
  assert(dmg.ok===true&&dmg.product==='platform'&&dmg.output.sha256===report.platform.signalDMG.sha256&&dmg.app.unchangedFromPublished===true&&dmg.codesignVerified===true,'DMG record mismatch '+arch);
  assert(dmg.source.sha256===report.platform.plainDMG.sha256,'Signal DMG was not made from the built Platform '+arch);
  for(const id of ['world','messenger'])assert(report.children[id]&&report.children[id].app.unchangedFromPublished===true,'Child record missing '+id);
  const file=path.join(input,report.platform.signalDMG.file);
  assert(fs.statSync(file).size===report.platform.signalDMG.bytes&&hash(file)===report.platform.signalDMG.sha256,'DMG differs from its build record '+arch);
  fs.renameSync(file,path.join(output,report.platform.signalDMG.file));
  return report;
});
const run=reports[0].ci&&reports[0].ci.run;
assert(run&&reports.every(r=>r.ci&&r.ci.run===run&&r.ci.sourceCommit===reports[0].ci.sourceCommit),'Both DMGs must come from one CI run');
if(env.RELEASE_FROM_RUN)assert(run.endsWith('/actions/runs/'+env.RELEASE_FROM_RUN),'Records come from another run than requested');
fs.writeFileSync(path.join(output,'SHA256SUMS-mac.txt'),reports.map(r=>`${r.platform.signalDMG.sha256}  ${r.platform.signalDMG.file}`).join('\n')+'\n');
fs.writeFileSync(path.join(output,'mac-platform-signal.3.json'),JSON.stringify({revision:'signal.3',version:'0.4.3',buildRun:run,buildSourceCommit:reports[0].ci.sourceCommit,
  packages:reports.map(r=>({arch:r.arch,file:r.platform.signalDMG.file,bytes:r.platform.signalDMG.bytes,sha256:r.platform.signalDMG.sha256,app:{files:r.platform.appFiles,treeSHA256:r.platform.appTreeSHA256,executableSHA256:r.platform.executableSHA256,asarSHA256:r.platform.asarSHA256},
    children:r.children,builtOn:`macOS ${r.runner.macOS} ${r.runner.hostArch}`})),signature:'ad-hoc',notarized:false,minimumSystemVersion:reports[0].minimumSystemVersion},null,2)+'\n');
console.log(JSON.stringify({ok:true,run,files:reports.map(r=>r.platform.signalDMG)}));
