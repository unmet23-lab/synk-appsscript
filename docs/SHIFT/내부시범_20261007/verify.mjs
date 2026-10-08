import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const read=async f=>JSON.parse(await fs.readFile(path.join(here,f),'utf8'));
const hash=async p=>createHash('sha256').update(await fs.readFile(p)).digest('hex');
const Domain=createRequire(import.meta.url)('../../../atlas/domain.js');
const protocol=await read('protocol.json'),common=await read('input/common.json');
const personalization=await read('input/atlas-decision.json');
const records=await read('workbook-input.json');
const checks=[];
const check=(name,fn)=>{fn();checks.push({name,passed:true});};
for(const entry of protocol.input){assert.equal(await hash(path.join(here,entry.file)),entry.sha256);checks.push({name:`Frozen input ${entry.file}`,passed:true});}
for(const entry of protocol.source){assert.equal(await hash(entry.path),entry.sha256);checks.push({name:`Current source unchanged: ${path.basename(entry.path)}`,passed:true});}
const d=personalization.decision;
const observations=personalization.declarations.map(({id,field,value})=>({id,field,value,scope:d.scope,contract:d.contract,source:'declared',at:d.at,refs:[id]}));
check('Recorded Core decision replays without mutation',()=>assert.deepEqual(Domain.decide({contract:d.snapshot.contract,scope:d.scope,observations,at:d.at,candidates:d.snapshot.candidates}),d));
check('No declarations falls back without invented personal facts',()=>{
 const result=Domain.decide({contract:d.snapshot.contract,scope:d.scope,observations:[],at:d.at,candidates:d.snapshot.candidates});
 assert.deepEqual(result.ranked.map(x=>x.id),['C1','C2','C3','C4','C5']);
 assert.ok(result.understanding.fields.every(x=>x.status==='unknown'&&!x.usable));
});
const results={};
for(const method of ['baseline','personalized']){
 const result=await read(`results/${method}.json`),packet=await read(`input/${method}.json`),trial=records.trials.find(x=>x.method===(method==='baseline'?'기존':'개인화'));
 results[method]=result;
 check(`${method}: shared common packet and five sections`,()=>{assert.equal(packet.common,'common.json');assert.deepEqual(result.sections.map(x=>x.id),packet.order);assert.deepEqual([...new Set(result.sections.map(x=>x.id))].sort(),common.sections.map(x=>x.id));});
 check(`${method}: evidence and fixed rubric references`,()=>{for(const x of result.sections){assert.ok(['유지','수정 필요'].includes(x.decision));assert.ok(x.evidence.length>20);assert.ok(x.rubricIds.length);assert.ok(x.rubricIds.every(id=>protocol.fixedRubric.some(([r])=>r===id)));}assert.ok(result.conclusion.length>20);});
 check(`${method}: observed times and recorded metric`,()=>{assert.equal(result.startedAt,trial.startedAt);assert.equal(result.endedAt,trial.endedAt);assert.ok(Date.parse(result.startedAt)>=Date.parse(protocol.frozenAt));assert.ok(Date.parse(result.endedAt)>Date.parse(result.startedAt));assert.ok(Date.parse(result.endedAt)<=Date.now());assert.ok(Math.abs((Date.parse(result.endedAt)-Date.parse(result.startedAt))/60000-trial.minutes)<1e-10);});
 check(`${method}: no human metric or inferred cost`,()=>{assert.equal(trial.humanHandoff,null);assert.equal(result.comparisonKind,'AI-performed internal review');assert.equal(typeof result.helpRequested,'boolean');});
}
const assessment=await read('results/independent-assessment.json');
for(const entry of assessment.reviewedFiles){assert.equal(await hash(path.join(here,entry.path)),entry.sha256);checks.push({name:`Independent assessment source ${entry.path}`,passed:true});}
check('Independent outcome assessment',()=>{
 assert.deepEqual(assessment.rubricAssessment.map(x=>x.id),protocol.fixedRubric.map(([id])=>id));
 for(const method of ['baseline','personalized']){const a=assessment.completionAssessment[method];assert.equal(a.completed,true);assert.equal(a.substantiveResultErrorCount,records.trials.find(x=>x.method===(method==='baseline'?'기존':'개인화')).errorCount);assert.equal(a.reviewedSectionCount,5);assert.equal(a.humanHandoff,null);assert.equal(assessment.rubricAssessment.reduce((sum,x)=>sum+x[`${method}ErrorCount`],0),a.substantiveResultErrorCount);}
});
const manifest=[];
for(const file of ['protocol.json','workbook-input.json','prepare.mjs','verify.mjs','results/baseline.json','results/personalized.json','results/independent-assessment.json',...protocol.input.map(x=>x.file)])manifest.push({file,sha256:await hash(path.join(here,file))});
const report={status:'ai-internal-review-comparison-completed',checkedAt:new Date().toISOString(),checks,protocol:protocol.id,kind:protocol.kind,repeatCount:1,
 conclusions:{reviewedSectionsPerArm:5,baseline:{completed:true,resultErrors:assessment.completionAssessment.baseline.substantiveResultErrorCount,elapsedSeconds:99},personalized:{completed:true,resultErrors:assessment.completionAssessment.personalized.substantiveResultErrorCount,elapsedSeconds:77},requiredSourcePatches:0,qualityImprovementObserved:false,elapsedDifferenceSeconds:-22,humanProductivityEffect:null,realCustomerEffect:null,profitability:null,next:'Keep current source; test an actual human workflow before claiming a business effect.'},
 boundaries:{currentSourceUnchanged:true,coreSourceUnchanged:true,newAtlasEngine:false,domainPolicyLocation:'SHIFT internal pilot',realHumanTrial:false,realCustomerTrial:false,sourceNotesIncluded:true,companyServerChanged:false,productionDataChanged:false,accountDataSaved:false,deployed:false,paidProviderCalls:0,officialAgentBillingCost:null},
 timingLimitation:'Agent tool timestamps at second resolution, one run per arm, no randomization. Clarification during execution aligned the protocol to each agent instruction. Timing includes tool/service delay; preparation and final verification excluded.',
 manifest};
await fs.writeFile(path.join(here,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,checks:checks.length,resultErrors:[report.conclusions.baseline.resultErrors,report.conclusions.personalized.resultErrors],coreChanged:false}));
