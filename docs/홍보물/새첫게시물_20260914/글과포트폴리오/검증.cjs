'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../../..');
const m=JSON.parse(fs.readFileSync(path.join(__dirname,'manifest.json'),'utf8'));
const v=require(path.join(root,'tools/lib/비전정본.js')).loadVisions().shift;
const labVision=require(path.join(root,'tools/lib/비전정본.js')).loadVisions().lab.headline;
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
// 09 추가 당시 90개 보존 증거와 이후 승인된 비시각 LAB 교정을 분리한다.
function reviewPreservation(manifest){
  const problems=[],baselinePath=path.join(__dirname,'09-기존보존_지문.json');
  const baseline=JSON.parse(fs.readFileSync(baselinePath,'utf8')).files;
  if(manifest.preservedExistingFiles.length!==90||baseline.length!==90||manifest.preservedExistingFiles.some((f,i)=>!f.unchanged||f.path!==baseline[i].path||f.sha256!==baseline[i].sha256))problems.push('당시 90개 보존 기록 변경');
  let changes=[];
  if(manifest.provenanceRefresh){
    const ref=manifest.provenanceRefresh,file=path.join(__dirname,'qa/원천갱신_대조.json');
    if(ref.record!=='qa/원천갱신_대조.json'||hash(file)!==ref.sha256)problems.push('후속 대조 기록 변경');
    const record=JSON.parse(fs.readFileSync(file,'utf8'));
    if(hash(baselinePath)!==record.historicalBaselineSha256)problems.push('과거 보존 원본 변경');
    changes=record.preservedFileChanges;
    if(changes.length!==10||new Set(changes.map(c=>c.path)).size!==10)problems.push('후속 교정 범위 변경');
    const evidencePath=path.join(root,record.correctionEvidence.path);
    if(hash(evidencePath)!==record.correctionEvidence.sha256)problems.push('언어 교정 증거 변경');
    const evidence=JSON.parse(fs.readFileSync(evidencePath,'utf8'));
    for(const c of changes){const original=baseline.find(f=>f.path===c.path);const entry=evidence.files.find(f=>f.path===c.path);if(!original||original.sha256!==c.before||(!c.path.endsWith('/LAB/QA.md')&&(!entry||entry.before!==c.before||entry.after!==c.after)))problems.push('후속 교정 전후 근거 '+c.path);}
  }
  const allowed=new Map(changes.map(c=>[c.path,c]));
  for(const f of baseline){const actual=hash(path.join(root,f.path)),change=allowed.get(f.path);if(actual!==(change?change.after:f.sha256))problems.push('현재 보존 대상 변경 '+f.path);}
  return {issues:problems,historicalCount:baseline.length,currentDocumentedChanges:changes.length,currentUnchanged:baseline.length-changes.length};
}
function verify(){
const issues=[],sourceDrift=m.sources.filter(s=>!fs.existsSync(path.join(root,s.path))||hash(path.join(root,s.path))!==s.sha256).map(s=>s.path);
if(m.pages.length!==9)issues.push('원고 수');
if(m.officialVision!==v.headline||m.officialSubtext!==v.subtext)issues.push('비전 변경');
if(m.published||m.livePlatformVerified||m.pages.some(p=>p.published||p.publicUrl!==null)||m.pin.publicDestination!==null)issues.push('미발행 범위');
if(sourceDrift.length)issues.push('원천 지문 변경');
for(const p of m.pages){for(const f of [p.html,p.markdown,p.bodyOnlyText].filter(Boolean)){const full=path.join(__dirname,f);if(!fs.existsSync(full)){issues.push('누락 '+f);continue;}const s=fs.readFileSync(full,'utf8');if(!s.includes(p.brand==='lab'?labVision:v.headline))issues.push('비전 누락 '+f);if(s.includes('AI 시대'))issues.push('금지 수식어 '+f);}}
if(m.labLetter.languageStatus.nativeReviewed||m.labLetter.languageStatus.published||m.labLetter.publicUrl!==null)issues.push('LAB 언어·게시 상태');
if(m.labChecks.length!==2||m.labChecks.some(q=>!q.hasMongolianFont||!q.hasKoreanFont||q.fallback.length))issues.push('LAB 실제 표시 서체');
const preservation=reviewPreservation(m);issues.push(...preservation.issues);
const labHtml=fs.readFileSync(path.join(__dirname,'09-Substack-LAB.html'),'utf8');
for(const phrase of ['게임을 만들어','영상을 만들어','그림을 그려','Ганцаараа чангаар хэлж болно.','원어민','lang="mn"','lang="ko"'])if(!labHtml.includes(phrase))issues.push('LAB 필수 내용 '+phrase);
if(m.independentPixelAudit.outsideStrictEllipse!==486||m.independentPixelAudit.outsideWithBoundaryAllowance!==0)issues.push('눈 비교 조건 변경');
for(const q of m.qa){if(q.scrollWidth>q.width||!q.fontsReady||q.unloadedImages.length||q.externalLinks.length||q.actualFonts.length===0||q.actualFonts.some(f=>!f.isCustomFont))issues.push('화면 검사 '+q.id+' '+q.width);}
for(const f of m.outputs){if(hash(path.join(__dirname,f.file))!==f.sha256)issues.push('출력 지문 '+f.file);}
const badLinks=[];
for(const f of fs.readdirSync(__dirname).filter(f=>f.endsWith('.html'))){const html=fs.readFileSync(path.join(__dirname,f),'utf8');for(const match of html.matchAll(/(?:href|src)="([^"]+)"/g)){const uri=match[1];if(uri.startsWith('data:')||uri.startsWith('#'))continue;if(/^https?:/.test(uri)){badLinks.push({file:f,uri,reason:'외부 목적지'});continue;}const local=path.resolve(__dirname,decodeURIComponent(uri.split('#')[0]));if(!fs.existsSync(local))badLinks.push({file:f,uri,reason:'로컬 대상 없음'});}}
if(badLinks.length)issues.push('링크 검사');
if(m.pin.overflow.length)issues.push('핀 잘림');
const png=fs.readFileSync(path.join(__dirname,m.pin.png));if(png.readUInt32BE(16)!==1200||png.readUInt32BE(20)!==1800)issues.push('핀 크기');
return {passed:issues.length===0,issues,sourceDrift,badLinks,pages:m.pages.length,qaScreens:m.qa.length,qaScope:'Existing render observations retained; this run checks current files and references without rendering.',preservation,pin:[1200,1800],bodyCodePoints:m.pages.map(p=>({platform:p.platform,count:p.bodyCodePoints})),published:false,livePlatformVerified:false};
}
module.exports={reviewPreservation,verify};
if(require.main===module){const result=verify();process.stdout.write(JSON.stringify(result,null,2)+'\n');process.exitCode=result.passed?0:1;}
