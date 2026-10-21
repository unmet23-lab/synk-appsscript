import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const dir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(dir,'../../../..');
const prior=path.resolve(dir,'../atlas-dating-availability-20261007');
const read=file=>fs.readFile(file,'utf8');
const json=async file=>JSON.parse((await read(file)).replace(/^\uFEFF/,''));
const write=(name,value)=>fs.writeFile(path.join(dir,name),JSON.stringify(value,null,2)+'\n');
const hash=value=>createHash('sha256').update(value).digest('hex');
const origin=process.argv[2];
assert.match(origin||'',/^http:\/\/127\.0\.0\.1:\d+$/);
const metrics=log=>Object.fromEntries(['tests','pass','fail','cancelled','skipped'].map(key=>{
  const matches=[...log.matchAll(new RegExp('(?:ℹ |# )'+key+' (\\d+)','g'))];
  return [key,Number(matches.at(-1)?.[1])];
}));
const caseNames=log=>log.split(/\r?\n/).flatMap(line=>{
  const match=line.match(/^✔ (.+) \([\d.]+ms\)$/)||line.match(/^ok \d+ - (.+)$/);
  return match?[match[1]]:[];
});
const helper=await json(path.join(dir,'helper-subtask.json'));
const adult=await json(path.join(dir,'adult-subtask.json'));
const backup=await json(path.join(dir,'backup-subtask.json'));
assert.equal(adult.sourceFrozen,true);
assert.equal(backup.tests.finalFrozenSourceRunPending,false);
assert.equal(backup.tests.sourceUnchangedDuringRun,true);
const groups=[];
for(const [name,log,count] of [
  ['discovery guidance, readiness and personalization',helper.tests.final.log,129],
  ['server adult assertion and enforcement',adult.newTests.log,21],
  ['service, availability and receipt regression',adult.regressionTests.log,75],
  ['account, checkpoint, delivery, live and lifecycle','client-lifecycle-final-tests.log',55],
  ['actual paired PGlite and SQLite backup restore',backup.tests.log,5],
]){
  const raw=await read(path.join(dir,log)), measured=metrics(raw), names=caseNames(raw);
  assert.equal(measured.tests,count,log);assert.equal(measured.pass,count,log);
  for(const key of ['fail','cancelled','skipped'])assert.equal(measured[key],0,log);
  assert.equal(names.length,count,log);
  groups.push({name,log,...measured,caseNames:names,sha256:hash(raw)});
}
const counts=new Map();
for(const group of groups)for(const name of group.caseNames)counts.set(name,(counts.get(name)||0)+1);
const overlaps=[...counts].filter(([,n])=>n>1).map(([name,executions])=>({name,executions}));
assert.equal(overlaps.length,0);assert.equal(counts.size,285);
await write('test-deduplication.json',{uniqueCases:counts.size,totalExecutions:285,overlaps,groups});
const verifiedSources=[];
for(const items of [helper.sources,adult.sources,backup.sourceHashes])for(const item of items){
  const file=item.path||item.file, actual=hash(await fs.readFile(path.resolve(root,file)));
  assert.equal(actual,item.sha256,file);verifiedSources.push({path:file,sha256:actual});
}
for(const item of [adult.newTests,adult.regressionTests])assert.equal(hash(await fs.readFile(path.join(dir,item.log))),item.sha256,item.log);
await write('subtask-source-check.json',{at:new Date().toISOString(),allMatched:true,sources:verifiedSources});
const prefail=metrics(await read(path.join(dir,'adult-boundary-prefail.log')));
assert.equal(prefail.tests,2);assert.equal(prefail.fail,2);
const syntax=await json(path.join(dir,'final-source-check.json'));
assert.equal(syntax.syntaxPassed,14);assert.equal(syntax.diffExit,0);
const browserBatch=await json(path.join(root,'experiences/atlas-lab/qa/dating-readiness/batch-result.json'));
assert.equal(browserBatch.status,'passed');assert.equal(browserBatch.uniqueBrowserPaths,36);assert.equal(browserBatch.finalSourceStable,true);
assert.deepEqual(browserBatch.sourceBeforeFinalReadiness,browserBatch.sourceAfterFinalDating);
for(const [file,sha256] of Object.entries(browserBatch.sourceAfterFinalDating))
  assert.equal(hash(await fs.readFile(path.join(root,'experiences/atlas-lab',file))),sha256,file);
for(const [file,sha256] of Object.entries(browserBatch.testSha256))
  assert.equal(hash(await fs.readFile(path.join(root,'tests',file))),sha256,file);
await write('browser-batch.json',browserBatch);
const beforeFixture=await json(path.join(root,'experiences/atlas-lab/qa/dating-readiness/before-fixture-correction.json'));
assert.equal(beforeFixture.status,'failed-fixture-assumption');assert.equal(beforeFixture.passedPaths.length,8);assert.equal(beforeFixture.productDefect,false);
await write('browser-before-fixture-correction.json',beforeFixture);

const browser=[], screenshotFiles=[];
for(const [kind,expected,log] of [
  ['dating-readiness',9,'browser-new.log'],
  ['dating-availability-recovery',9,'browser-availability-regression.log'],
  ['dating',18,'browser-dating-regression.log'],
]){
  const sourceDir=path.join(root,'experiences/atlas-lab/qa',kind);
  const record=await json(path.join(sourceDir,'result.json'));
  assert.equal(record.status,'passed');assert.equal(record.paths.length,expected);
  assert.equal(new Set(record.paths).size,expected);
  for(const key of ['errors','externalRequests'])assert.equal(record[key].length,0);
  for(const key of ['actualUsers','modelCalls'])assert.equal(record[key],0);
  if(Object.hasOwn(record,'externalApiCost'))assert.equal(record.externalApiCost,0);
  assert.ok((await read(path.join(dir,log))).includes('"status": "passed"'),log);
  if(kind==='dating-readiness')for(const [file,sha256] of Object.entries(record.sourceSha256))
    assert.equal(hash(await fs.readFile(path.join(root,'experiences/atlas-lab',file))),sha256,file);
  await write('browser-'+kind+'.json',record);
  browser.push({kind,paths:expected,at:record.at,errors:0,externalRequests:0,modelCalls:0,log});
  if(kind==='dating-readiness')for(const name of record.screenshots){
    const bytes=await fs.readFile(path.join(sourceDir,name));
    await fs.writeFile(path.join(dir,name),bytes);screenshotFiles.push({path:name,sha256:hash(bytes)});
  }
}
assert.equal(browser.reduce((sum,item)=>sum+item.paths,0),36);
assert.ok(screenshotFiles.length>=4);await write('screenshots.json',screenshotFiles);

const oldSources=await json(path.join(prior,'sources.json'));
const publicFiles=(await json(path.join(prior,'preview-check.json'))).files.map(item=>item.path);
const added=[
  'experiences/atlas-lab/dating-adult.mjs','experiences/atlas-lab/dating-ui.mjs',
  'experiences/atlas-lab/dating.css','experiences/atlas-lab/dating-live.mjs',
  'experiences/atlas-lab/discovery-guidance.mjs','experiences/atlas-lab/dating-store.mjs',
  'tests/atlas-discovery-guidance.test.mjs','tests/atlas-dating-adult.test.mjs',
  'tests/atlas-dating-backup-restore.test.mjs','tests/atlas-dating-readiness-smoke.mjs',
  'tests/atlas-dating-smoke.mjs','tests/atlas-dating-live.test.mjs',
  'docs/아틀라스_공통능력_고도화_20261005.md','docs/_ops/트랙.md',
  'docs/_ops/qa/atlas-dating-readiness-20261007/finalize.mjs',
];
const sources=[];
for(const file of new Set([...oldSources.map(item=>item.path),...publicFiles,...added,...verifiedSources.map(item=>item.path)]))
  sources.push({path:file,sha256:hash(await fs.readFile(path.resolve(root,file)))});
await write('sources.json',sources);
const current=new Map(sources.map(item=>[item.path,item.sha256]));
const engines=oldSources.filter(item=>item.path.startsWith('atlas/')).map(item=>({path:item.path,same:item.sha256===current.get(item.path)}));
assert.ok(engines.length>0&&engines.every(item=>item.same));
await write('engine-check.json',{engineCodeChangedByThisBatch:0,newEngines:0,checks:engines});
const frozen=await json(path.join(prior,'frozen-check.json'));
for(const item of frozen.checks){assert.equal(hash(await fs.readFile(path.resolve(root,item.path))),item.actual,item.path);item.changedSincePrior=false;}
assert.equal(frozen.checks.filter(item=>item.same).length,8);assert.equal(frozen.checks.length,9);
frozen.at=new Date().toISOString();await write('frozen-check.json',frozen);
const config=await(await fetch(origin+'/api/atlas-dating/config')).json();
assert.equal(config.mode,'demo');assert.equal(config.demoEnabled,true);
const served=[];
for(const file of new Set(publicFiles)){
  const response=await fetch(origin+'/'+file.replace(/^experiences\//,''));
  const bytes=Buffer.from(await response.arrayBuffer());assert.equal(response.status,200,file);assert.equal(hash(bytes),current.get(file),file);
  served.push({path:file,status:response.status,same:true});
}
assert.equal(served.length,11);
await write('preview-check.json',{at:new Date().toISOString(),origin,mode:'demo',isolatedDatabase:true,files:served});
await write('run-note.json',{
  preservedFailures:[
    'Guidance fixtures and gated getter ordering were corrected before the helper129 final run; intermediate counts are not added.',
    'Simultaneous adult holds reused an introduction archive timestamp. Per-hold logical clock advance fixed the two initially failing cases.',
    'An enforced DB lost its requirement after deletion of every account and an omitted verifier restart. Reproduced before fixing with durable non-personal metadata, including legacy schema upgrade.',
    'Same-sequence conflicting claims could recover with the original same-sequence claim. Reproduced before a persistent conflict fence requiring a higher trusted sequence.',
    'Backup source drift was observed while the adult contract was being edited; the full final five were rerun with matching before/after source hashes.',
    'The new browser fixture incorrectly required an already-open counterpart gate to reopen; its initial eight successful paths and final fixture failure were preserved before correction.',
  ],
  wording:{publicWaitingTitleClarifiedAfterMobileReview:true,guidanceIdAndActionUnchanged:true,helper129Rerun:true,newBrowser9AndDating18AfterWordingChange:true,availability9BeforeWordingChange:true,availabilityChecksAffectedByWording:false},
  review:{twoActualAdultBoundaryIssuesResolved:true,independentReadOnlyReview:true,extraReviewTests:0},
  regression:{client55AfterFinalPolicyFix:true,service75AfterFinalPolicyFix:true,backup5AfterFinalPolicyFix:true,browser36AfterFinalPolicyFix:true},
  noProviderActivation:true,paidCalls:0,actualUsers:0,remoteMigration:false,publicDeployment:false,
});
await write('report.json',{
  at:new Date().toISOString(),status:'passed-in-scope',
  scope:[
    'Separate missing own required confirmation from authorized current public-information waiting, without lowering conditions or exposing private peer data.',
    'Display first-recommendation preparation, currently usable recommendations and optional questions without completion percentages or all-answer counts.',
    'Injected server-only minimal adult assertion contract, durable required policy, persistent conflict fence, expiry/revocation/error holds and explicit new consent and acceptance.',
    'Physical paired PGlite dump/load and SQLite backup/restore under quiesced synthetic writers, with receipt, high-water, deletion and mismatch checks.',
  ],
  tests:{uniqueCases:285,passed:285,failed:0,totalExecutions:285,groups:groups.map(({caseNames,...item})=>item)},
  browserPaths:36,browser,
  preview:{url:origin+'/atlas-lab/dating.html',filesMatched:11,isolatedDemo:true},
  engineCodeChangedByThisBatch:0,newEngines:0,modelCalls:0,externalApiCost:0,actualUsers:0,tutorChanges:0,publicDeployment:false,remoteMigration:false,
  limitations:[
    'All checks use synthetic local identities, loopback HTTP and local PGlite/SQLite. Real OAuth, adult supplier, legal age threshold, physical devices and participant satisfaction are unverified.',
    'No actual verification provider, webhook, bulk retrieval, operating schedule or paid AI is enabled. Revocation is observed on the next configured local request.',
    'The demo remains declaration-only with verified:false; a demo declaration is not server adult verification.',
    'Paired snapshots are sequential and consistent only because writers and admission are quiesced. The test does not install production automatic restore or an atomic cross-database backup.',
    'Coherent old paired backups require newer sequence or erasure knowledge outside the pair to detect later holds/deletion. The synthetic knownLatest input is not a production witness implementation.',
    'Production encrypted backup storage, retention, restored policy admission, remote DB recovery and actual operational effects remain unimplemented or unverified.',
    'Paid AI activation/evaluation, tutor and participant recruitment remain deferred.',
  ],
  evidence:['test-deduplication.json','subtask-source-check.json','final-source-check.json','helper-subtask.json','adult-subtask.json','adult-boundary-prefail.log','backup-subtask.json','browser-batch.json','browser-before-fixture-correction.json','preview-check.json','screenshots.json','sources.json','frozen-check.json','run-note.json'],
});
console.log('285 distinct free tests; 36 browser paths; 11 served files matched; paid calls and deployment0.');
