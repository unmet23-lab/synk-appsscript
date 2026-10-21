import fs from 'node:fs';import crypto from 'node:crypto';
const dir='experiences/synk-world-app/qa/costume-convenience-20261009';
const read=name=>JSON.parse(fs.readFileSync(dir+'/'+name,'utf8')),assert=(v,msg)=>{if(!v)throw Error(msg);},hash=body=>crypto.createHash('sha256').update(body).digest('hex');
const core=read('browser-r2-core-result.json'),fault=read('browser-round2-result.json'),delta=read('browser-round2-ready-delta-result.json'),matrix=read('completion-matrix-round2.json'),compat=read('source-compatibility-round2.json'),served=read('served-source.json');
for(const [name,result,count,cases]of [['core',core,101,22],['fault',fault,71,20],['delta',delta,29,3]]){
 assert(result.passed===count,name+' count');assert(result.cases.length===cases&&result.cases.every(c=>c.status==='passed'),name+' scenarios');
 assert((result.errors||[]).length===0&&(result.assetFailures||result.failures||[]).length===0,name+' errors');
}
assert(compat.ok===true&&matrix.length===22&&matrix.every(r=>r.status==='passed'),'22 requirements or source compatibility');
assert(new Set(matrix.map(r=>r.number)).size===22&&matrix.every(r=>r.number>=1&&r.number<=22),'requirement numbering');
assert(served.rows.length===14&&served.rows.every(r=>r.matches),'running source proof');
const currentSource=[];
for(const row of served.rows){const local=fs.readFileSync(row.file),response=await fetch(served.base+row.url),remote=Buffer.from(await response.arrayBuffer()),current=hash(local);assert(response.ok&&current===row.sha256&&hash(remote)===current,'current source drift '+row.file);currentSource.push({file:row.file,sha256:current});}
const performance=JSON.parse(fs.readFileSync('experiences/synk-world-app/qa/costume-performance-20261009/browser-results.json','utf8'));
assert(performance.sourceStable===true&&performance.errors.length===0&&performance.httpWrites.length===0,'performance scope');
assert(performance.reports.length===2&&performance.reports.every(r=>r.actualAssetCount===8&&r.warm.newCacheWrites===0),'actual asset/cache measurement');
const before=read('local-continuity-before.json'),after=read('local-continuity-after.json');assert(before.rows.length===2&&after.rows.every((r,i)=>r.hash===before.rows[i].hash),'existing account data');
const required=read('requirements.json');
required.status='complete_local';required.auditedAt=new Date().toISOString();required.completionArtifact='completion-audit.json';
required.requirements=required.requirements.map(r=>({...r,verification:'passed',evidence:matrix.find(m=>m.number===r.id)}));
fs.writeFileSync(dir+'/requirements.json',JSON.stringify(required,null,2));
const result={checkedAt:new Date().toISOString(),objective:'Save and implement all 22 improvements, then check and correct in a second round',achieved:true,scope:'Local browser app and synthetic local backend; public deployment/native/physical-device/student-effect are separate',requirements:matrix.map(r=>({id:r.number,name:r.name,status:r.status,coreEvidence:r.coreEvidence,riskEvidence:r.riskEvidence})),checks:{firstRound:91,finalCore:101,finalCoreScenarios:22,independentFault:71,faultScenarios:20,readyGuardDelta:29,deltaScenarios:3,sourceCompatibility:true,servedCurrent:currentSource.length,existingTwoAccountsPreserved:true,actualAssetCount:8},sourceExceptions:['CSS EOF blank-line removal: no selector or declaration change','Studio ready guard: independently verified in core101 and delta29'],currentSource,artifacts:['browser-r1-result.json','browser-r2-core-result.json','browser-round2-result.json','browser-round2-ready-delta-result.json','completion-matrix-round2.json','source-compatibility-round2.json','served-source.json','../costume-performance-20261009/browser-results.json'],limits:['Synthetic local accounts, not production identities','Viewport/mock gamepad, not physical phones/controllers','No public deployment or remote C18 migration']};
fs.writeFileSync(dir+'/completion-audit.json',JSON.stringify(result,null,2));console.log(JSON.stringify({achieved:true,requirements:matrix.length,core:core.passed,fault:fault.passed,delta:delta.passed,currentSource:currentSource.length}));

