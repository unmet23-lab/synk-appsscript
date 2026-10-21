import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const dir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(dir,'../../../..'), central=path.resolve(root,'../SYNK-talk');
const prior=path.resolve(dir,'../atlas-dating-live-recovery-20261007');
const read=p=>fs.readFile(p,'utf8'), json=async p=>JSON.parse(await read(p));
const write=(name,data)=>fs.writeFile(path.join(dir,name),JSON.stringify(data,null,2)+'\n');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const origin=process.argv[2];
assert.match(origin||'',/^http:\/\/127\.0\.0\.1:\d+$/);
const metrics=log=>Object.fromEntries(['tests','pass','fail','cancelled','skipped'].map(key=>{
  const matches=[...log.matchAll(new RegExp('(?:ℹ |# )'+key+' (\\d+)','g'))];
  return [key,Number(matches.at(-1)?.[1])];
}));
const caseNames=log=>log.split(/\r?\n/).flatMap(line=>{
  const m=line.match(/^✔ (.+) \([\d.]+ms\)$/)||line.match(/^ok \d+ - (.+)$/);
  return m?[m[1]]:[];
});
const groups=[];
for(const [name,log,count] of [
  ['central SQL and worker','producer-tests.log',43],
  ['availability receiver','receiver-tests-final.tap',13],
  ['service, final deletion and receipt regression','receiver-regression-final.tap',70],
  ['account, checkpoint, delivery, live view and receipt','client-recovery-final-tests.log',49],
  ['actual central to product integration','central-integration-tests.log',2],
]){
  const raw=await read(path.join(dir,log)), measured=metrics(raw), names=caseNames(raw);
  assert.equal(measured.tests,count,log);assert.equal(measured.pass,count,log);
  for(const key of ['fail','cancelled','skipped'])assert.equal(measured[key],0,log);
  assert.equal(names.length,count,log);
  groups.push({name,log,...measured,caseNames:names});
}
const counts=new Map();for(const group of groups)for(const name of group.caseNames)counts.set(name,(counts.get(name)||0)+1);
const overlaps=[...counts].filter(([,n])=>n>1).map(([name,executions])=>({name,executions}));
assert.equal(overlaps.length,5);assert.ok(overlaps.every(item=>item.executions===2));
assert.equal(counts.size,172);await write('test-deduplication.json',{uniqueCases:172,executions:177,overlaps,groups});
const producer=await json(path.join(dir,'producer-subtask.json'));
const receiver=await json(path.join(dir,'receiver-subtask.json'));
const checkpoint=await json(path.join(dir,'checkpoint-subtask.json'));
const verifiedSources=[];
for(const [repository,items] of [[central,producer.sources],[root,receiver.sourceHashes],[root,checkpoint.sourceHashes]]){
  for(const item of items){const file=item.path||item.file;const actual=hash(await fs.readFile(path.resolve(repository,file)));
    assert.equal(actual,item.sha256,file);verifiedSources.push({repository:repository===root?'SYNK-appsscript':'SYNK-talk',path:file,sha256:actual});}
}
await write('subtask-source-check.json',{at:new Date().toISOString(),allMatched:true,sources:verifiedSources});
const aba=await json(path.join(dir,'receiver-introduction-aba.json'));
assert.equal(aba.beforeFix.staleRequestHttpStatus,200);assert.equal(aba.afterFix.staleRequestHttpStatus,409);
assert.equal(aba.afterFix.restartChecked,true);assert.equal(aba.afterFix.freshReopenPassed,true);

const browser=[];
for(const [name,count] of [['dating-availability-recovery',9],['dating-live-recovery',13]]){
  const record=await json(path.join(root,'experiences/atlas-lab/qa',name,'result.json'));
  assert.equal(record.status,'passed');assert.equal(record.paths.length,count);
  for(const key of ['errors','externalRequests'])assert.equal(record[key].length,0);
  for(const key of ['actualUsers','modelCalls','externalApiCost'])assert.equal(record[key],0);
  await write('browser-'+name+'.json',record);
  browser.push({kind:name,paths:count,at:record.at,errors:0,externalRequests:0,modelCalls:0});
}
assert.equal(browser.reduce((sum,item)=>sum+item.paths,0),22);
const screenshotFiles=[];
const latest=await json(path.join(dir,'browser-dating-availability-recovery.json'));
assert.match(latest.paths[0],/starting from the default landing through the demo button/);
assert.equal(latest.bootAuthRecovery.checkpointStillPresent,false);
assert.equal(latest.bootAuthRecovery.storedCredentialCleared,true);
assert.equal(latest.bootAuthRecovery.hasView,false);
for(const [name,field] of [['default-entry-before-fix.json','defaultEntryRecovery'],['boot-auth-before-fix.json','bootAuthRecovery']]){
  const before=await json(path.join(root,'experiences/atlas-lab/qa/dating-availability-recovery',name));
  assert.equal(before.status,'failed');assert.equal(before[field].checkpointStillPresent,true);
  assert.equal(before.errors.length,0);assert.equal(before.externalRequests.length,0);
  await write(name,before);
}
for(const name of latest.screenshots){
  const bytes=await fs.readFile(path.join(root,'experiences/atlas-lab/qa/dating-availability-recovery',name));
  await fs.writeFile(path.join(dir,name),bytes);screenshotFiles.push({path:name,sha256:hash(bytes)});
}
assert.equal(screenshotFiles.length,4);await write('screenshots.json',screenshotFiles);

const oldSources=await json(path.join(prior,'sources.json'));
const publicFiles=[...(await json(path.join(prior,'preview-check.json'))).files.map(item=>item.path),'experiences/atlas-lab/dating-checkpoint.mjs'];
const added=[
  'experiences/atlas-lab/dating-server.mjs','experiences/learning-hub/server.mjs',
  'experiences/atlas-lab/dating-lifecycle.mjs','experiences/atlas-lab/dating-store.mjs',
  'tests/atlas-dating-account.test.mjs','tests/atlas-dating-checkpoint.test.mjs',
  'tests/atlas-dating-availability-service.test.mjs','tests/atlas-dating-central-lifecycle.test.mjs',
  'tests/atlas-dating-availability-recovery-smoke.mjs',
  'docs/아틀라스_공통능력_고도화_20261005.md','docs/_ops/트랙.md',
  'docs/_ops/qa/atlas-dating-availability-20261007/finalize.mjs',
];
const sources=[];
for(const p of new Set([...oldSources.map(item=>item.path),...publicFiles,...added,...receiver.sourceHashes.map(item=>item.path),...checkpoint.sourceHashes.map(item=>item.file)])){
  sources.push({path:p,sha256:hash(await fs.readFile(path.resolve(root,p)))});
}
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
for(const p of new Set(publicFiles)){
  const response=await fetch(origin+'/'+p.replace(/^experiences\//,''));
  const bytes=Buffer.from(await response.arrayBuffer());assert.equal(response.status,200,p);assert.equal(hash(bytes),current.get(p),p);
  served.push({path:p,status:response.status,same:true});
}
assert.equal(served.length,11);await write('preview-check.json',{at:new Date().toISOString(),origin,mode:'demo',isolatedDatabase:true,files:served});

await write('run-note.json',{
  initialFailures:[
    'Four checkpoint fixture variables used accountId instead of actorId; corrected fixture, preserved initial log.',
    'A fresh introduction fixture omitted recommendation confirmation; corrected actor/explicit per-peer reopen rather than weakening the product contract.',
    'The central integration fixture tried connecting before explicit per-peer reopen; HTTP403 was expected. Corrected fixture and preserved initial log.',
    'A stale counterpart reopen reused introduction revision2 after central hold and resume and incorrectly returned200. Preserved reproduction; separate monotonic row revision now rejects it with409, including after restart.',
    'Independent review found normal landing demo entry did not retain its public role for reload, and boot auth-loss did not clear the old receipt marker. Preserved pre-fix browser evidence; URL role continuity and boot cleanup were repaired.',
  ],
  reviewFixes:[
    'Central hold clears all private drafts and pending confirmation, so its notice now says they were cleared; it no longer claims valid inputs were retained.',
    'Native beforeunload affects browser navigation fixtures; regression uses explicit dialog acceptance, while the new browser suite separately checks both dismiss and accept.',
  ],
  coverage:{allBackendGroupsRerunAfterIntroductionFix:true,newBrowserNineRerunAfterEntryAndBootFix:true,existingBrowserThirteenRunBeforeEntryAndBootFix:true,existingThirteenAffectedByEntryAndBootFix:false,receiptFiveCasesCountedOnce:true},
  bfcache:{currentNoStoreBackNavigationBootsNewDocument:true,cachedRestoreNotReproduced:true,reference:'../atlas-dating-next-audit-20261007/bfcache-audit.json'},
  earlierCleanup:{action:'Recursive deletion of the previous BFCache audit temporary folder',automaticReview:'blocked by policy',bypass:false,folder:'synk-bfcache-audit-032a90a1-333b-4903-ba15-c78c102f4a91',browserAndServerEnded:true},
  finalFailures:0,paidCalls:0,actualUsers:0,remoteMigration:false,publicDeployment:false,
});
await write('report.json',{
  at:new Date().toISOString(),status:'passed-in-scope',
  scope:[
    'Central requested/disabled availability propagates through authenticated version2 events; monotonic ordering, consent reset, explicit resume and no old acceptance revival.',
    'Same-tab reload restores only a minimal session receipt marker and owned GET confirmation, without original body, credential, automatic POST or reload resend.',
    'Connection health and successful-check timestamp recover on state GET, online and visible-tab triggers without overwriting action notices or valid drafts.',
  ],
  tests:{uniqueCases:172,passed:172,failed:0,totalExecutions:177,duplicateReceiptExecutions:5,groups:groups.map(({caseNames,...item})=>item)},
  browserPaths:22,browser,
  preview:{url:origin+'/atlas-lab/dating.html',filesMatched:11,isolatedDemo:true},
  engineCodeChangedByThisBatch:0,newEngines:0,modelCalls:0,externalApiCost:0,actualUsers:0,tutorChanges:0,publicDeployment:false,remoteMigration:false,
  limitations:[
    'Synthetic local identities, PostgreSQL/PGlite, SQLite and loopback only; actual OAuth/adult verification, production operation and real-device/user satisfaction remain unverified.',
    'Central delivery worker, secrets, remote SQL and schedule remain disabled; exposure can remain until the event is received and current view checked.',
    'Receipt marker persists at most24hours in the same-tab session only, includes a minimal actor identifier and is not anonymous or full-input/cross-device backup.',
    'An absent receipt remains inconclusive and reload recovery does not resend. Browser departure confirmation is browser-dependent.',
    'Production central status, per-subject sequence and outbox backups/restoration need joint validation before operation.',
    'Paid AI features, paid model evaluation, tutor and participant recruitment remain deferred.',
  ],
  evidence:['test-deduplication.json','subtask-source-check.json','receiver-introduction-aba.json','default-entry-before-fix.json','boot-auth-before-fix.json','preview-check.json','screenshots.json','sources.json','frozen-check.json','run-note.json'],
});
console.log('172 unique tests; 22 browser paths; 11 served files matched; paid calls and deployment0.');
