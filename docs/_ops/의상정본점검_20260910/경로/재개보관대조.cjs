'use strict';
// Bounded read-only source/archive inventory. No archive creation, upload, reclaim or restore.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../../../..');
const L=require(path.join(root,'tools/lib/옷목록.js')),M=require(path.join(root,'tools/lib/마스코트자산.js'));
const ops='docs/_ops/마스코트_Drive이관_20260910',prefix='docs/Loom_자산/옷/';
const abs=p=>path.join(root,p),exists=p=>fs.existsSync(abs(p));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const fileSha=p=>hash(fs.readFileSync(abs(p)));
const read=p=>JSON.parse(fs.readFileSync(abs(p),'utf8'));
function inspectJson(p){const b=fs.readFileSync(abs(p)),text=b.toString('utf8'),data=JSON.parse(text),actualFileCount=Array.isArray(data.files)?data.files.length:data.sets.reduce((n,s)=>n+s.files.length,0);return {path:p,bytes:b.length,sha256:hash(b),parse:true,endsWithObjectAfterWhitespace:text.trimEnd().endsWith('}'),trailingNul:b.includes(0),recordCounts:data.totals,actualFileCount,countMatches:actualFileCount===data.totals.files,createdAt:data.createdAt};}
const priorPath='docs/_ops/의상정본점검_20260910/경로/현행재고검사.json',prior=read(priorPath),old=new Map(prior.files.map(f=>[f.path,f]));
const plan=read(`${ops}/pack-plan.json`),manifest=read(`${ops}/옷_manifest.json`),archiveRows=new Map(manifest.files.map(f=>[f.path,f]));
const cuts=M.까몽누끼컷;
const stages=Object.entries(L.방).flatMap(([stage])=>(stage.startsWith('표정')||stage==='앱'?cuts:[null]).map(cut=>({stage,cut,path:L.옷경로('까몽',['3개월 출석 잎망토'],cut,stage)})));
const stageRows=stages.map(f=>{
 const p=f.path.slice(prefix.length),record=archiveRows.get(p),pack=plan.packs.find(x=>x.files.some(r=>r.path===p)),receiptPath=pack?`${ops}/mascot-${String(pack.number).padStart(4,'0')}.json`:null;
 const receipt=receiptPath&&exists(receiptPath)?read(receiptPath):null,member=receipt?.files.find(r=>r.path===p);
 const journalPath=pack?`${ops}/mascot-${String(pack.number).padStart(4,'0')}-reclaimed.jsonl`:null;
 const events=journalPath&&exists(journalPath)?fs.readFileSync(abs(journalPath),'utf8').trim().split(/\r?\n/).filter(Boolean).map(x=>JSON.parse(x)):[];
 const current=exists(f.path)?{bytes:fs.statSync(abs(f.path)).size,sha256:fileSha(f.path)}:null;
 return {...f,relativeToOutfit:p,beforeAuditSha:old.get(f.path)?.sha256||null,current,archiveManifest:record||null,planPack:pack?.number||null,keptLocal:plan.keep_local.some(r=>r.path===p),packReceipt:receipt?{path:receiptPath,archive:receipt.archive,sha256:receipt.sha256,memberSha:member?.sha256||null}:null,remoteVerifiedRecorded:receipt?events.some(e=>e.event==='remote-sha256-verified'&&e.sha256===receipt.sha256):false,reclaimedRecorded:events.some(e=>e.event==='reclaimed'&&e.path===p),currentSameAsBefore:current?current.sha256===old.get(f.path)?.sha256:null,currentSameAsArchiveManifest:current?current.sha256===record?.sha256:null,archivedSameAsBefore:member?member.sha256===old.get(f.path)?.sha256:null};
});
const extraPaths=['docs/라디오/선정무대_20260910/정수리수정/source-before-4f1481c2ecb2.png','docs/라디오/선정무대_20260910/라이브13/leaf-base-48823c235151.webp','docs/라디오/선정무대_20260910/정수리수정/leaf-base-514d7886949b.png'];
const radioRecord=read('docs/Loom_자산/라디오차림/_기록/3개월출석잎망토.json');
const radioRows=Object.entries(radioRecord.파일).map(([cut,f])=>{const p=`docs/Loom_자산/라디오차림/${f.결과}`,out=fileSha(p),input=exists(f.원본)?fileSha(f.원본):null;return {cut,path:p,currentSha:out,recordSha:f.결과_sha256,matchesRecord:out===f.결과_sha256,input:f.원본,inputSha:input,inputMatchesRecord:input===f.원본_sha256,beforeAuditSha:old.get(p)?.sha256,unchangedSinceEarlierAudit:out===old.get(p)?.sha256};});
const sourcePaths=['AGENTS.md','docs/AI_운영원칙.md','docs/대용량자산_운영.md','tools/drive-mascot-archive.py',`${ops}/옷_manifest.json`,`${ops}/pack-plan.json`,'docs/라디오/선정무대_20260910/정수리수정/복원검증.json','docs/라디오/선정무대_20260910/라이브준비.cjs'];
const report={at:new Date().toISOString(),head:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),scope:'Read-only exact leaf single-outfit 60-stage mapping, active 8 radio candidate hashes, archive manifests/receipts/journals, and earlier audit JSON integrity. Remote Drive ZIP bytes not reread; no writes outside this report.',readSources:sourcePaths.map(p=>({path:p,sha256:fileSha(p)})),integrity:[inspectJson(priorPath),inspectJson('docs/_ops/의상정본점검_20260910/경로/표정기술검사.json')],stages:stageRows,radio:radioRows,extra:extraPaths.map(p=>({path:p,exists:exists(p),bytes:exists(p)?fs.statSync(abs(p)).size:null,sha256:exists(p)?fileSha(p):null})),totals:{stages:stageRows.length,localStageFiles:stageRows.filter(r=>r.current).length,missingStageFiles:stageRows.filter(r=>!r.current).length,changedSinceEarlierAudit:stageRows.filter(r=>r.currentSameAsBefore===false).map(r=>r.path),receiptMembers:stageRows.filter(r=>r.packReceipt).length,remoteVerifiedRecordedMembers:stageRows.filter(r=>r.remoteVerifiedRecorded).length,reclaimedRecordedMembers:stageRows.filter(r=>r.reclaimedRecorded).length,planOnlyMembers:stageRows.filter(r=>r.planPack&&!r.packReceipt).length,keptLocalMembers:stageRows.filter(r=>r.keptLocal).length,radioUnchanged:radioRows.filter(r=>r.unchangedSinceEarlierAudit).length}};
report.originalHashSearch=['4f1481c2ecb224e115f2f53a5760cbbb617b7d5d65dc0eaffcc242147c5b380b','3e9ecc50a6c972f528baffdc2bac55b647843fbb4e0a541552e606e997e4dbf3'].map(sha256=>({sha256,manifestMatches:manifest.files.filter(r=>r.sha256===sha256),planMatches:plan.packs.flatMap(p=>p.files.filter(r=>r.sha256===sha256).map(r=>({number:p.number,path:r.path}))),priorInventoryMatches:prior.files.filter(r=>r.sha256===sha256).map(r=>r.path)}));
fs.writeFileSync(path.join(__dirname,'재개보관대조.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({at:report.at,head:report.head,integrity:report.integrity,totals:report.totals,source:stageRows.find(r=>r.stage==='구운것')},null,2));
