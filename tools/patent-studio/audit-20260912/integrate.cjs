'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const data=require('./content.cjs');
const root='C:/Users/q1212/.codex/visualizations/2026/09/11/01a08f0d-d3c5-7c41-9c85-d69384fa2412/IP_디딤돌_준비/미팅완성본';
const packet=path.join(root,'현재_미팅본_20260912'),out=path.join(root,'선행대조_종합검수_20260912');
const details=['CORE_PRIOR_ART.md','COMPANY_CANDIDATES.md','EVIDENCE_AUDIT.md','SUPPLEMENTAL_PRIOR_ART.md','KR_SEARCH_LOG.md'];
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const entry=path.join(packet,'00_여기서시작.html');let entryHtml=fs.readFileSync(entry,'utf8');
if(!entryHtml.includes('<section class="action" data-advance-implementation>'))throw Error('Current meeting entry lacks expected implementation card');
fs.mkdirSync(path.join(packet,'08_상세검수'),{recursive:true});
let html=fs.readFileSync(path.join(out,data.title+'.html'),'utf8');
for(const name of details){fs.copyFileSync(path.join(__dirname,name),path.join(packet,'08_상세검수',name));html=html.replace(`href="${name}"`,`href="08_상세검수/${name}"`);}
fs.writeFileSync(path.join(packet,'08_선행대조_종합검수.html'),html);
fs.copyFileSync(path.join(out,data.title+'.pdf'),path.join(packet,'08_선행대조_종합검수.pdf'));
entryHtml=entryHtml.replace(/<section class="action" data-patent-audit>[\s\S]*?<\/section>/,'');
const card='<section class="action" data-patent-audit><div><h2>가장 먼저 · 선행 대조·검수 보고</h2><p>회사 후보 8개·가까운 국내외 선행·실제 재현 근거를 다시 대조했습니다. Core를 주안으로 유지하는 이유, 겹치는 기술, 남는 진보성 쟁점과 미팅 결정을 10쪽에 정리했습니다.</p></div><div class="buttons"><a class="button primary" href="08_선행대조_종합검수.html" target="_blank">검수 보고 열기</a><a class="button" href="08_선행대조_종합검수.pdf" target="_blank">인쇄 PDF</a></div></section>';
entryHtml=entryHtml.replace('<section class="action" data-advance-implementation>',card+'<section class="action" data-advance-implementation>').replace('가장 먼저 · Core 0.5 발전 구현','함께 볼 자료 · Core 0.5 발전 구현');
fs.writeFileSync(entry,entryHtml);
fs.writeFileSync(path.join(root,'00_현재본_여기부터.md'),'# 현재 특허 미팅본 · 선행 대조와 종합 검수\n\n[현재 미팅 시작 화면](현재_미팅본_20260912/00_여기서시작.html)에서 **검수 보고 열기**를 누릅니다.\n\n10쪽 선행·후보·증거 검수 → 11쪽 발전 구현 → 실제 작업실 → 기존 등록 전략 순서입니다.\n\n현재 주안은 SYNK Core의 늦은 도움에 따른 용도·능력별 기여 정정입니다. Loom 표정 합성은 별도 예비안입니다. 구현과 기록 재현을 확인했지만 중복 부재·최고 등록 확률·진보성 충족을 확정한 것은 아닙니다. 이전 판본의 구현·근거 자료는 보존했습니다.\n');
fs.writeFileSync(path.join(packet,'00_미팅진행가이드.md'),'# 선행 대조·종합 검수 · 미팅 진행\n\n1. 08_선행대조_종합검수.html/PDF의 1~3쪽으로 현재 후보·등록 요건·작동 원리를 설명합니다.\n2. 06_작업실_실행.cmd 또는 저장소 start.cmd로 Core 0.5 작업실을 엽니다. 새 시간 예제에서 조사 보류 → 발화 뒤 확인 → 반영을 보입니다.\n3. 별도 새 시간 예제에서 발화 전 확인 → 조사 제외를 보입니다. 전사·독립 조건을 충족한 과거형의 기여와 원음이 유지되는지 확인합니다.\n4. 저장 기록 재현 확인과 내려받기로 원인 사건·전후 판본·기여 원장을 보입니다. 새 0.5 예제는 합성 사건이며, 추가 합성 WAV 보존 검사는 별도 검수에 기록되어 있습니다.\n5. 검수 4~6쪽의 가까운 선행과 결합 반론을 놓고, 9쪽 A/B 청구 구조를 비교합니다. 원래 근거 확인과 새 수행 구별은 필요할 때 보조 시연합니다.\n6. 최인접 문헌·정확한 차이, 독립항으로 삼을 관계와 이유, 보정 한정·필요한 보강 증거 세 가지를 결정해 받습니다.\n\n07_발전구현은 연결·데이터 계약·계산 규모를 설명하는 기존 11쪽 자료이고, 05_등록우선전략은 이전 전략의 배경입니다. 최신 등록성 판단은 08_선행대조_종합검수에서 읽습니다.\n\n상세 원문 5개는 08_상세검수 폴더에 있습니다. 국내 공보를 읽은 것과 KIPRIS 직접 상세·심사서류 조회는 구별하며 후자는 이번에 확인하지 못했습니다. 회사 전체 최고 확률이나 중복 부재를 확정했다고 설명하지 않습니다.\n');
for(const name of details)if(hash(path.join(__dirname,name))!==hash(path.join(out,name))||hash(path.join(__dirname,name))!==hash(path.join(packet,'08_상세검수',name)))throw Error('Detail copy mismatch: '+name);
if(hash(path.join(out,data.title+'.pdf'))!==hash(path.join(packet,'08_선행대조_종합검수.pdf')))throw Error('PDF mismatch');
for(const file of [entry,path.join(packet,'08_선행대조_종합검수.html')]){
  const body=fs.readFileSync(file,'utf8');for(const m of body.matchAll(/href="([^"]+)"/g)){if(/^(?:https?:|#|data:|mailto:)/.test(m[1]))continue;const target=path.resolve(path.dirname(file),decodeURIComponent(m[1].split('#')[0]));if(!fs.existsSync(target))throw Error('Missing link '+m[1]+' in '+file);}
}
const mp=path.join(packet,'파일지문.json'),previous=JSON.parse(fs.readFileSync(mp,'utf8'));
const files=fs.readdirSync(packet,{recursive:true}).filter(n=>fs.statSync(path.join(packet,n)).isFile()&&n!=='파일지문.json');
fs.writeFileSync(mp,JSON.stringify({...previous,generatedAt:new Date().toISOString(),currentCore:'0.5.0',primary:'08_선행대조_종합검수.html',files:files.map(n=>({path:n,bytes:fs.statSync(path.join(packet,n)).size,sha256:hash(path.join(packet,n))}))},null,2));
const outFiles=fs.readdirSync(out,{recursive:true}).filter(n=>fs.statSync(path.join(out,n)).isFile()&&n!=='파일지문.json');
const om=path.join(out,'파일지문.json'),old=JSON.parse(fs.readFileSync(om,'utf8'));
fs.writeFileSync(om,JSON.stringify({...old,generatedAt:new Date().toISOString(),files:outFiles.map(n=>({path:n,bytes:fs.statSync(path.join(out,n)).size,sha256:hash(path.join(out,n))}))},null,2));
console.log(JSON.stringify({entry,primary:'08_선행대조_종합검수.html',detailCopiesMatched:details.length,packetFiles:files.length,localLinksVerified:true,pdfCopyMatched:true}));
