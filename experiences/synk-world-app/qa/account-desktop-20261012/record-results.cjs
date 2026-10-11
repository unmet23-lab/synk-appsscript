'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=process.cwd(),out=__dirname,web=path.join(root,'.tmp/tutor-account-desktop-20261012'),pc=path.join(root,'.tmp/world-tutor-native-20261012');
const copy=(from,to)=>fs.copyFileSync(from,path.join(out,to));
for(const name of ['publication.json','public-http.json','bundle-manifest.json','bundle-verification.json','bundle-tests.log'])copy(path.join(web,name),name);
for(const name of ['candidate.json','package.json','final-payload.json','installed.json','source-overlay.json'])copy(path.join(pc,name),'desktop-'+name);
copy(path.join(pc,'launcher/report.json'),'launcher-update.json');
copy(path.join(pc,'online-qa-r2/report.json'),'native-online.json');copy(path.join(pc,'offline-qa/report.json'),'native-offline.json');
for(const name of ['marin-home.png','kkamong-home.png','mongle-home.png','kkamong-choice-success.png'])copy(path.join(pc,'online-qa-r2',name),name);
const observation={at:new Date().toISOString(),method:'Actual Chrome UI with existing real SYNK ID session; no synthetic account, no injected learning records',accountIdentifiersRecorded:false,credentialsRecorded:false,checks:[
 {name:'SYNK ID login returns to WORLD with connected account',pass:true},
 {name:'Select Kkamong through the actual tutor introduction and confirmation UI',pass:true},
 {name:'First live life save rejected before server allowlist fix',pass:true,expectedFailure:true},
 {name:'After live synk-play v10 update, complete the three greeting questions correctly',pass:true},
 {name:'Completion UI reports life progress saved to SYNK account',pass:true,observed:'생활 한국어 진도가 SYNK 계정에 저장됐어요.'},
 {name:'New navigation restores Kkamong and completed lesson with the next recommendation',pass:true,observed:'1 / 22 학습 완료 · 계정별 진도; 이름표를 찾아서'},
 {name:'Logout clears signed-in tutor/learning view and returns to separate guest state',pass:true,observed:'0 / 22 학습 완료 · 이 기기의 진도; 나의 AI 튜터 만나기'},
 {name:'Real SYNK ID re-login restores Kkamong, 1 completed lesson and 3 practiced expressions',pass:true,observed:'까몽; 1 / 22 학습 완료 · 계정별 진도; 오늘의 3개 표현 · 마무리하기'}
],learningPerformed:{lesson:'첫 인사 세 마디',initialCorrect:3,questions:3,completedLessons:1},boundaries:{tutorChoice:'local device storage keyed by verified account; no cross-device tutor sync',lifeProgress:'server account record synk.life-korean.progress.v1',nativeRealAccountRoundtrip:false,physicalPhone:false,realGameCompletion:false},capture:'The actual completion screenshot was shown through CUA. Later screenshot export reported a zero-width browser surface; native isolated screenshots are saved separately.'};
fs.writeFileSync(path.join(out,'real-account-ui.json'),JSON.stringify(observation,null,2)+'\n');
// Register the verified local component so future Platform builds recognize it.
const packageInfo=require(path.join(pc,'package.json')),relative='preview/win32/x64/world/SYNK WORLD Preview-0.4.2-win-x64.exe',target=path.join(root,'desktop/dist',relative);fs.mkdirSync(path.dirname(target),{recursive:true});
if(!fs.existsSync(target))fs.copyFileSync(packageInfo.installer.path,target);
const crypto=require('node:crypto'),hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');assert.equal(hash(target),packageInfo.installer.sha256);
const registryFile=path.join(root,'desktop/artifacts/client-releases.json'),registry=JSON.parse(fs.readFileSync(registryFile));
const release={id:'world',mode:'development',platform:'win32',arch:'x64',version:'0.4.2',executableSHA256:packageInfo.executable.sha256,asarSHA256:packageInfo.asar.sha256,installer:{relativePath:relative,sha256:packageInfo.installer.sha256,bytes:packageInfo.installer.bytes}};
const existing=registry.releases.find(r=>r.id==='world'&&r.version==='0.4.2'&&r.platform==='win32'&&r.arch==='x64');if(existing)assert.deepEqual(existing,release);else registry.releases.unshift(release);
fs.writeFileSync(registryFile,JSON.stringify(registry,null,2)+'\n');fs.writeFileSync(path.join(out,'local-release.json'),JSON.stringify(release,null,2)+'\n');
console.log(JSON.stringify({recorded:true,realAccountChecks:observation.checks.length,localReleaseRegistered:true}));
