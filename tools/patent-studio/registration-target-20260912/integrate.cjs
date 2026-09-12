'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root='C:/Users/q1212/.codex/visualizations/2026/09/11/01a08f0d-d3c5-7c41-9c85-d69384fa2412/IP_디딤돌_준비/미팅완성본';
const out=path.join(root,'등록목표_공보형_초안_20260912'),packet=path.join(root,'현재_미팅본_20260912');
const file='SYNK_등록목표_공보형_초안',sourceDir=path.join(packet,'09_등록목표_원문');
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const entry=path.join(packet,'00_여기서시작.html');
let entryHtml=fs.readFileSync(entry,'utf8');
if(!entryHtml.includes('<section class="action" data-patent-audit>'))throw Error('Expected current audit entry');
fs.mkdirSync(path.join(sourceDir,'figures'),{recursive:true});
for(const name of ['DRAFT.json','PATENT_DRAFT.md','FIGURES.md','figs.json']){
  fs.copyFileSync(path.join(out,name),path.join(sourceDir,name));
  if(hash(path.join(__dirname,name))!==hash(path.join(sourceDir,name)))throw Error('Source copy mismatch '+name);
}
for(let i=1;i<=6;i++){
  const name='fig'+i+'.svg';fs.copyFileSync(path.join(out,'figures',name),path.join(sourceDir,'figures',name));
  if(hash(path.join(__dirname,'figures',name))!==hash(path.join(sourceDir,'figures',name)))throw Error('Figure copy mismatch '+name);
}
let html=fs.readFileSync(path.join(out,file+'.html'),'utf8')
 .replaceAll(file+'.pdf','09_등록목표_공보형.pdf')
 .replaceAll('href="PATENT_DRAFT.md"','href="09_등록목표_원문/PATENT_DRAFT.md"')
 .replaceAll('figures/','09_등록목표_원문/figures/')
 .replaceAll('../현재_미팅본_20260912/00_여기서시작.html','00_여기서시작.html')
 .replaceAll('../선행대조_종합검수_20260912/SYNK_특허후보_선행대조_종합검수_20260912.html','08_선행대조_종합검수.html');
fs.writeFileSync(path.join(packet,'09_등록목표_공보형.html'),html);
fs.copyFileSync(path.join(out,file+'.pdf'),path.join(packet,'09_등록목표_공보형.pdf'));
if(hash(path.join(out,file+'.pdf'))!==hash(path.join(packet,'09_등록목표_공보형.pdf')))throw Error('PDF copy mismatch');
entryHtml=entryHtml.replace(/<section class="action" data-registration-target>[\s\S]*?<\/section>/,'');
const card='<section class="action" data-registration-target><div><h2>먼저 볼 자료 · 등록 목표 문안과 도면</h2><p>이 기술을 어떤 명칭·요약·청구범위로 설명할지 구체화했습니다. 한국어·영어 요약, 청구항 8개, 도면 6개와 구현 대응을 담은 18쪽 검토 초안입니다. 실제 등록 공보가 아닙니다.</p></div><div class="buttons"><a class="button primary" href="09_등록목표_공보형.html" target="_blank">공보형 초안 열기</a><a class="button" href="09_등록목표_공보형.pdf" target="_blank">전체 문안 PDF</a></div></section>';
entryHtml=entryHtml.replace('<section class="action" data-patent-audit>',card+'<section class="action" data-patent-audit>').replace('가장 먼저 · 선행 대조·검수 보고','함께 볼 자료 · 선행 대조·검수 보고');
fs.writeFileSync(entry,entryHtml);
const rootGuide=path.join(root,'00_현재본_여기부터.md');
let rootText=fs.readFileSync(rootGuide,'utf8');
rootText=rootText.replace(/^# .*\r?\n/,'# 현재 특허 미팅본 · 등록 목표 문안과 선행 대조\n');
rootText=rootText.replace('**검수 보고 열기**를 누릅니다.','**공보형 초안 열기**를 누릅니다.');
rootText=rootText.replace('10쪽 선행·후보·증거 검수 → 11쪽 발전 구현 → 실제 작업실 → 기존 등록 전략 순서입니다.','18쪽 등록 목표 초안 → 10쪽 선행·후보·증거 검수 → 실제 작업실 → 11쪽 발전 구현 순서입니다.');
fs.writeFileSync(rootGuide,rootText);
const guide=path.join(packet,'00_미팅진행가이드.md');let guideText=fs.readFileSync(guide,'utf8');
const intro='<!-- registration-target-start -->\n먼저 **09_등록목표_공보형.html**을 열어 제목·요약과 도면 5를 보여줍니다. 같은 원음에서 무엇이 유지되고 무엇이 달라지는지 설명한 다음, **청구항 1**의 관계를 확인합니다. 전체 문안·도면은 **09_등록목표_공보형.pdf** 18쪽이며 원문은 **09_등록목표_원문/**에 있습니다. 이 문안은 등록 목표 검토 초안입니다.\n\n독립항에는 늦은 도움에 따른 용도·능력별 기여 정정을, 종속항에는 시간 범위·정밀화·새 수행 구별·확인 행동의 추가 조건을 담았습니다. 아래 선행 검수와 함께 독립항의 최종 구성과 필요한 한정을 결정합니다.\n<!-- registration-target-end -->\n\n';
guideText=guideText.replace(/<!-- registration-target-start -->[\s\S]*?<!-- registration-target-end -->\s*/,'');
guideText=guideText.replace(/^(# .*\r?\n\r?\n)/,'$1'+intro);
fs.writeFileSync(guide,guideText);
let links=0;
for(const filePath of [entry,path.join(packet,'09_등록목표_공보형.html'),path.join(out,file+'.html')]){
  const body=fs.readFileSync(filePath,'utf8');
  for(const m of body.matchAll(/href="([^"]+)"/g)){
    if(/^(?:https?:|#|data:|mailto:)/.test(m[1]))continue;
    const target=path.resolve(path.dirname(filePath),decodeURIComponent(m[1].split('#')[0]));
    if(!fs.existsSync(target))throw Error('Missing link '+m[1]);links++;
  }
}
function manifest(dir,extra){
  const mf=path.join(dir,'파일지문.json');const old=fs.existsSync(mf)?JSON.parse(fs.readFileSync(mf,'utf8')):{};
  const files=fs.readdirSync(dir,{recursive:true}).filter(n=>fs.statSync(path.join(dir,n)).isFile()&&n!=='파일지문.json');
  fs.writeFileSync(mf,JSON.stringify({...old,...extra,generatedAt:new Date().toISOString(),files:files.map(n=>({path:n,bytes:fs.statSync(path.join(dir,n)).size,sha256:hash(path.join(dir,n))}))},null,2));
  return files.length;
}
const sourceVerification={generatedAt:new Date().toISOString(),localLinksVerified:links,sourceCopiesMatched:4,figureCopiesMatched:6,pdfCopyMatched:true};
fs.writeFileSync(path.join(out,'검수/integration.json'),JSON.stringify(sourceVerification,null,2));
const outputFiles=manifest(out,{primary:file+'.html',status:'registration-target-draft',actualPublication:false});
const packetFiles=manifest(packet,{currentCore:'0.5.0',primary:'09_등록목표_공보형.html'});
console.log(JSON.stringify({...sourceVerification,entry,outputFiles,packetFiles}));
