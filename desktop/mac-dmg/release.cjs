// 한 번의 CI 실행에서 검증된 Mac DMG 두 개(Apple 칩·Intel)를 그 기록과 대조하고, 릴리스 확인값·매니페스트·노트를 만든다.
// GitHub Actions의 release 작업에서 실행한다. 사용: node release.cjs <내려받은 폴더> <출력 폴더>
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {SOURCE,REVISION,VERSION,RELEASE,APP,LAYOUT}=require('./repackage.cjs');

const assert=(ok,message)=>{if(!ok)throw Error(message);};
function hash(file){const h=crypto.createHash('sha256'),fd=fs.openSync(file,'r'),buf=Buffer.allocUnsafe(8<<20);try{for(let n;(n=fs.readSync(fd,buf,0,buf.length,null))>0;)h.update(buf.subarray(0,n));}finally{fs.closeSync(fd);}return h.digest('hex');}
const bytes=n=>n.toLocaleString('en-US');

const [input,output]=process.argv.slice(2),env=process.env;
assert(input&&output,'Use: node release.cjs <downloaded artifacts> <output>');
fs.mkdirSync(output,{recursive:true});
const reports=['arm64','x64'].map(arch=>{
  const report=JSON.parse(fs.readFileSync(path.join(input,`mac-dmg-${REVISION}-${arch}.json`),'utf8'));
  assert(report.ok===true&&report.arch===arch&&report.revision===REVISION&&report.version===VERSION,'Unexpected build record '+arch);
  assert(report.source.release===RELEASE&&report.source.sha256===SOURCE[arch].sha256&&report.source.bytes===SOURCE[arch].bytes,'Build record names another source DMG '+arch);
  assert(report.app.name===APP&&report.app.unchangedFromPublished===true&&report.codesignVerified===true&&report.notarized===false,'Application checks missing '+arch);
  const file=path.join(input,report.output.file);
  assert(fs.statSync(file).size===report.output.bytes&&hash(file)===report.output.sha256,'DMG differs from its build record '+arch);
  fs.renameSync(file,path.join(output,report.output.file));
  return report;
});
const run=reports[0].ci&&reports[0].ci.run;
assert(run&&reports.every(r=>r.ci&&r.ci.run===run&&r.ci.sourceCommit===reports[0].ci.sourceCommit),'Both DMGs must come from one CI run');
if(env.RELEASE_FROM_RUN)assert(run.endsWith('/actions/runs/'+env.RELEASE_FROM_RUN),'Records come from another run than requested');
const shotsOk=reports.every(r=>['light','dark'].every(mode=>r.screenshots.some(s=>s.mode===mode&&s.bounds&&!s.captureError&&!s.appearanceError)));

fs.writeFileSync(path.join(output,'SHA256SUMS-mac-signal.txt'),reports.map(r=>`${r.output.sha256}  ${r.output.file}`).join('\n')+'\n');
const commit=env.GITHUB_SHA||reports[0].ci.sourceCommit,repo=`${env.GITHUB_SERVER_URL||'https://github.com'}/${env.GITHUB_REPOSITORY||'unmet23-lab/synk-policy'}`;
const manifest={version:VERSION,client:'platform',dmgWindowRevision:REVISION,
  packages:reports.map(r=>({file:r.output.file,platform:'darwin',arch:r.arch,sha256:r.output.sha256,bytes:r.output.bytes,
    replaces:{release:RELEASE,file:r.source.file,sha256:r.source.sha256,bytes:r.source.bytes},
    app:{name:APP,files:r.app.files,bytes:r.app.bytes,treeSHA256:r.app.treeSHA256,unchangedFromPublished:true},
    volumeName:r.volumeName,builtOn:`macOS ${r.runner.macOS} ${r.runner.hostArch}`})),
  window:{width:LAYOUT.window.width,height:LAYOUT.window.height,iconSize:LAYOUT.iconSize,iconTextSize:LAYOUT.iconTextSize,app:LAYOUT.app,applications:LAYOUT.applications,background:reports[0].window.background},
  tools:reports[0].tools,buildRun:run,buildSourceCommit:reports[0].ci.sourceCommit,releaseSourceCommit:commit,
  sourceRepository:repo,sourcePublication:'.github/desktop-preview/mac-dmg-signal/',
  finderWindowChecked:shotsOk,macMinimumVersion:reports[0].app.minimumSystemVersion,macSignature:'ad-hoc',notarized:false};
fs.writeFileSync(path.join(output,'public-release-manifest.json'),JSON.stringify(manifest,null,2)+'\n');

const [arm,intel]=reports;
const notes=`Mac DMG 창을 SYNK 플랫폼과 같은 시그널 2 디자인으로 다시 그렸습니다. DMG를 열면 청금석 바탕 위에 SYNK 앱과 Applications 폴더가 나란히 놓이고, 그 사이의 화살표와 「SYNK를 Applications 폴더로 끌어 놓으세요」 안내가 보입니다. 처음 열 때 확인 창이 나오면 어디서 「그래도 열기」를 누르는지도 창 안에 적었습니다.

DMG 창 revision은 **${REVISION}**, 앱 버전은 **${VERSION}**입니다. 안에 든 ${APP}은 기존 공개 ${VERSION} DMG의 앱과 모든 파일(Apple 칩 ${bytes(arm.app.files)}개, Intel ${bytes(intel.app.files)}개)·권한·심볼릭 링크가 바이트 단위로 같습니다. 바뀐 것은 DMG 창의 배경·아이콘 크기·위치와 파일 이름뿐이라, 이미 ${VERSION}을 설치했다면 다시 받을 필요가 없습니다.

검증: Apple 칩·Intel 각각 공개 DMG를 받아 확인값을 맞춘 뒤 앱을 꺼내 새 DMG로 포장했습니다. 새 DMG를 읽기 전용으로 열어 앱 묶음 전체가 원본과 같은지, ad-hoc 서명 검사(\`codesign --verify --deep --strict\`)를 통과하는지 확인했습니다.${shotsOk?' Finder에서 실제 창을 밝은 모드와 어두운 모드로 열어 배치를 확인했습니다.':''}

Apple 칩 Mac은 \`Signal-mac-arm64.dmg\`, Intel Mac은 \`Signal-mac-x64.dmg\`를 받으세요. macOS ${String(manifest.macMinimumVersion).replace(/\.0$/,'')} 이상이 필요합니다. 정식 게시자 서명·Apple 공증을 받지 않은 Preview라서 처음 열 때 확인 창이 나올 수 있습니다. 이때는 시스템 설정 → 개인정보 보호 및 보안에서 「그래도 열기」를 누르세요.

**파일:**
${reports.map(r=>`- ${r.output.file} (${bytes(r.output.bytes)} bytes) · SHA-256 \`${r.output.sha256}\``).join('\n')}

[재현 소스와 빌드 안내](${repo}/tree/${commit}/.github/desktop-preview/mac-dmg-signal) · [빌드 기록](${run})
`;
fs.writeFileSync(path.join(output,'notes.md'),notes);
fs.writeFileSync(path.join(output,'title.txt'),`SYNK Platform Preview ${VERSION} · Signal Mac DMG window (${REVISION})`);
console.log(JSON.stringify({ok:true,packages:manifest.packages.map(p=>({file:p.file,bytes:p.bytes,sha256:p.sha256})),finderWindowChecked:shotsOk,run}));
