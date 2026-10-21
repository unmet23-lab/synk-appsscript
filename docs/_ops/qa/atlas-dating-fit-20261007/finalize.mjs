import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const dir=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(dir,'../../../..');
const prior=path.resolve(dir,'../atlas-dating-readiness-20261007');
const hash=value=>createHash('sha256').update(value).digest('hex');
const read=file=>fs.readFile(file,'utf8');
const json=async file=>JSON.parse((await read(file)).replace(/^\uFEFF/,''));
const write=(name,value)=>fs.writeFile(path.join(dir,name),JSON.stringify(value,null,2)+'\n');
const metrics=raw=>Object.fromEntries(['tests','pass','fail','cancelled','skipped'].map(key=>{
  const matches=[...raw.matchAll(new RegExp('(?:ℹ |# )'+key+' (\\d+)','g'))];
  return [key,Number(matches.at(-1)?.[1])];
}));
const caseNames=raw=>raw.split(/\r?\n/).flatMap(line=>{
  const match=line.match(/^✔ (.+) \([\d.]+ms\)$/)||line.match(/^ok \d+ - (.+)$/);
  return match?[match[1]]:[];
});
const fullLog=file=>file.includes('/')?path.resolve(root,file):path.join(dir,file);
const discovery=await json(path.join(dir,'discovery-subtask.json'));
const regions=await json(path.join(dir,'meeting-regions-subtask.json'));
const criterion=await json(path.join(dir,'new-criterion-subtask.json'));
const serviceRegression=criterion.finalServiceRegression;
assert.equal(serviceRegression.tests,57);
assert.equal(serviceRegression.fail,0);
assert.equal(serviceRegression.sourceHashesStable,true);
const groups=[];
for(const [name,log,count] of [
  ['discovery relationship, preference, old contracts and guidance',discovery.tests.final.log,150],
  ['explicit broad meeting region validation and exact intersection',regions.tests.log,11],
  ['completed meeting new criterion and actual HTTP',criterion.newChecks.log,17],
  ['full final service regression',serviceRegression.log,57],
  ['final projections, live invalidation, guidance and disclosure','fit-projections-final.tap',73],
  ['mutual regions, adult, central availability and receipt regression','backend-final.tap',45],
  ['account, checkpoint, delivery and lifecycle regression','client-lifecycle-final.tap',37],
  ['physical paired PGlite and SQLite backup restore','backup-final.tap',5],
]){
  const bytes=await fs.readFile(fullLog(log)),raw=bytes.toString('utf8'),measured=metrics(raw),names=caseNames(raw);
  assert.equal(measured.tests,count,log);assert.equal(measured.pass,count,log);
  for(const key of ['fail','cancelled','skipped'])assert.equal(measured[key],0,log);
  assert.equal(names.length,count,log);
  groups.push({name,log,sha256:hash(bytes),...measured,caseNames:names});
}
const product=criterion.productRegression;
assert.equal(product.sourceStable,true);assert.equal(product.tests,14);assert.equal(product.pass,14);assert.equal(product.fail,0);
const productRaw=await read(fullLog(product.log)),productNames=caseNames(productRaw),selectedProductNames=product.cases.map(item=>{
  assert.equal(item.passed,true);assert.ok(productNames.includes(item.name));return item.name;
});
assert.equal(selectedProductNames.length,14);
groups.push({name:'unchanged pure product regression extracted from preserved mixed run',log:product.log,tests:14,pass:14,fail:0,cancelled:0,skipped:0,
  sha256:hash(await fs.readFile(fullLog(product.log))),caseNames:selectedProductNames,
  note:'Only these fourteen passed pure product cases count; the same mixed run contains seven fixture failures and one service regression, all excluded and fixed separately.'});
const allNames=new Map();for(const group of groups)for(const name of group.caseNames)allNames.set(name,(allNames.get(name)||0)+1);
const overlaps=[...allNames].filter(([,n])=>n>1).map(([name,executions])=>({name,executions}));
const executions=groups.reduce((sum,item)=>sum+item.tests,0),unique=allNames.size;
assert.equal(unique,378);assert.equal(executions,409);assert.equal(overlaps.length,31);
await write('test-deduplication.json',{uniqueCases:unique,totalExecutions:executions,overlaps,groups});

const verifiedSources=[];
for(const item of [...discovery.sources,...regions.sources,...Object.entries(criterion.sourceHashes).map(([path,sha256])=>({path,sha256}))]){
  const actual=hash(await fs.readFile(path.resolve(root,item.path)));assert.equal(actual,item.sha256,item.path);verifiedSources.push(item);
}
await write('subtask-source-check.json',{at:new Date().toISOString(),allMatched:true,sources:verifiedSources});
const review=await json(path.join(dir,'review-reproductions.json'));
await write('review-summary.json',{record:'review-reproductions.json',formalTestsAddedByManualReview:0,actualIssuesFixed:4,
  fixes:['Pause retained own reflection without forcing unavailable discovery','Expired priority scope no longer blocks new preview','Region mismatch keeps an explicit decline control','One-slot priority form no longer offers rejected replacement'],
  additionalFixes:['Expired temporary priority is described as current baseline','Disclosure array summaries are detached'],
  nonblockingObservation:'The optional shared-region label branch has no dedicated projection; the current structured match reason supplies the actual comparison.'});
assert.ok(review);

const batch=await json(path.join(dir,'browser-batch.json'));assert.equal(batch.status,'passed');
assert.equal(batch.uniqueBrowserPaths,42);assert.equal(batch.finalSourceStable,true);
const browser=[];
for(const [label,file,count] of [['new fit flows','browser-new-result.json',15],['existing introduction and meeting','browser-dating-result.json',18],['existing readiness and adult gating','browser-readiness-result.json',9]]){
  const record=await json(path.join(dir,file));assert.equal(record.status,'passed');assert.equal(record.paths.length,count);assert.equal(new Set(record.paths).size,count);
  assert.equal(record.errors.length,0);assert.equal(record.externalRequests.length,0);assert.equal(record.actualUsers,0);assert.equal(record.modelCalls,0);
  if(Object.hasOwn(record,'externalApiCost'))assert.equal(record.externalApiCost,0);
  if(record.sourceBefore){assert.deepEqual(record.sourceBefore,record.sourceSha256);assert.equal(record.sourceStable,true);}
  for(const [file,sha256] of Object.entries(record.sourceSha256||{}))assert.equal(hash(await fs.readFile(path.join(root,'experiences/atlas-lab',file))),sha256,file);
  browser.push({name:label,paths:count,at:record.at,record:file,errors:0,externalRequests:0});
}
const screenshotManifest=[];
const newBrowser=await json(path.join(dir,'browser-new-result.json'));
for(const file of newBrowser.screenshots){
  const bytes=await fs.readFile(path.join(root,'experiences/atlas-lab/qa/dating-fit',file));
  await fs.writeFile(path.join(dir,file),bytes);screenshotManifest.push({path:file,sha256:hash(bytes)});
}
assert.equal(screenshotManifest.length,14);await write('screenshots.json',screenshotManifest);

const oldSources=await json(path.join(prior,'sources.json'));
const publicFiles=[...(await json(path.join(prior,'preview-check.json'))).files.map(item=>item.path),
  'experiences/atlas-lab/meeting-regions.mjs','experiences/atlas-lab/discovery.mjs','experiences/atlas-lab/discovery-ui.mjs'];
const testedFiles=[
  'tests/atlas-dating-fit-service.test.mjs','tests/atlas-dating-fit-projections.test.mjs','tests/atlas-dating-new-criterion.test.mjs','tests/atlas-meeting-regions.test.mjs',
  'tests/atlas-product-experience.test.mjs','tests/atlas-dating-service.test.mjs',
  'tests/atlas-dating-live.test.mjs','tests/atlas-dating-insights.test.mjs','tests/atlas-dating-adult.test.mjs','tests/atlas-dating-availability-service.test.mjs',
  'tests/atlas-dating-receipt-service.test.mjs','tests/atlas-dating-account.test.mjs','tests/atlas-dating-checkpoint.test.mjs','tests/atlas-dating-delivery.test.mjs',
  'tests/atlas-dating-lifecycle-service.test.mjs','tests/atlas-dating-backup-restore.test.mjs','tests/atlas-dating-fit-smoke.mjs','tests/atlas-dating-smoke.mjs','tests/atlas-dating-readiness-smoke.mjs',
  ...discovery.testSources.map(item=>item.path)];
const productFiles=[...Object.keys(newBrowser.sourceSha256).map(file=>'experiences/atlas-lab/'+file),'experiences/atlas-lab/discovery-ui.mjs'];
const docs=['docs/아틀라스_공통능력_고도화_20261005.md','docs/_ops/트랙.md','docs/_ops/qa/atlas-dating-fit-20261007/finalize.mjs','docs/_ops/qa/atlas-dating-fit-20261007/preview.mjs'];
const sourceFiles=new Set([...productFiles,...publicFiles,...testedFiles,...docs,...oldSources.filter(item=>item.path.startsWith('atlas/')).map(item=>item.path)]);
const sources=[];for(const file of sourceFiles)sources.push({path:file,sha256:hash(await fs.readFile(path.resolve(root,file)))});
await write('sources.json',sources);
const current=new Map(sources.map(item=>[item.path,item.sha256]));
const engineChecks=oldSources.filter(item=>item.path.startsWith('atlas/')).map(item=>({path:item.path,same:item.sha256===current.get(item.path)}));
assert.ok(engineChecks.length&&engineChecks.every(item=>item.same));
await write('engine-check.json',{engineCodeChangedByThisBatch:0,newEngines:0,checks:engineChecks});
const frozen=await json(path.join(prior,'frozen-check.json'));
for(const item of frozen.checks){assert.equal(hash(await fs.readFile(path.resolve(root,item.path))),item.actual,item.path);item.changedSincePrior=false;}
assert.equal(frozen.checks.filter(item=>item.same).length,8);assert.equal(frozen.checks.length,9);frozen.at=new Date().toISOString();await write('frozen-check.json',frozen);

const syntaxFiles=[...new Set([...productFiles,...testedFiles,...docs.filter(file=>file.endsWith('.mjs'))])].filter(file=>/\.(?:mjs|js)$/.test(file));
for(const file of syntaxFiles){const result=spawnSync(process.execPath,['--check',file],{cwd:root,encoding:'utf8'});assert.equal(result.status,0,file+' '+result.stderr);}
const diff=spawnSync('git',['diff','--check','--',...productFiles,...testedFiles,...docs],{cwd:root,encoding:'utf8'});assert.equal(diff.status,0,diff.stdout+diff.stderr);
await write('final-source-check.json',{at:new Date().toISOString(),syntaxPassed:syntaxFiles.length,files:syntaxFiles,diffExit:diff.status});

const preview=await json(path.join(dir,'preview-launch.json'));assert.match(preview.origin,/^http:\/\/127\.0\.0\.1:\d+$/);
const config=await(await fetch(preview.origin+'/api/atlas-dating/config')).json();assert.equal(config.mode,'demo');assert.equal(config.demoEnabled,true);
const served=[];
for(const file of new Set(publicFiles)){const response=await fetch(preview.origin+'/'+file.replace(/^experiences\//,''));const bytes=Buffer.from(await response.arrayBuffer());
  assert.equal(response.status,200,file);assert.equal(hash(bytes),current.get(file),file);served.push({path:file,status:response.status,same:true});}
assert.equal(served.length,14);await write('preview-check.json',{...preview,at:new Date().toISOString(),files:served});
await write('run-note.json',{
  preservedFailures:[
    'Old field count and rejection wording fixtures were updated while legacy replay remained preserved.',
    'Seven new HTTP setup failures came from a public region without a separate current private declaration; fixture now explicitly confirms both owners.',
    'An actual pause view regression was reproduced and fixed; the final full service57 is rerun after all service fixes.',
    'Independent review reproduced expired-priority preview, unavailable UI decline, and one-slot replacement errors before their fixes.',
    'Root projection fixture initially reused a timestamp; all eight new projections and affected old regressions pass on final source.',
    'Browser fixture reused historical timestamps, missed a valid Korean notice variant, and tried a child inside a closed ancestor; exact failed runs remain preserved.',
    'Incomplete or pre-fix service groups and repeated development runs do not add to final unique test counts.'
  ],paidCalls:0,modelCalls:0,actualUsers:0,remoteMigration:false,publicDeployment:false});
await write('report.json',{
  at:new Date().toISOString(),status:'passed-in-scope',
  scope:['Independent relationship goal and starting speed with historical combined declarations preserved','Explicit private and public meeting regions, exact intersection and mutual new-introduction gates','Newly important own criterion from a completed meeting, explicit preview/apply and next delivered recommendation followup'],
  tests:{uniqueCases:unique,passed:unique,failed:0,totalExecutions:executions,overlapCases:overlaps.length,groups:groups.map(({caseNames,...item})=>item)},
  browserPaths:42,browser,mobileScreenshots:14,preview:{url:preview.origin+'/atlas-lab/dating.html',filesMatched:served.length,isolatedDemo:true},
  sourceStable:true,engineCodeChangedByThisBatch:0,newEngines:0,modelCalls:0,externalApiCost:0,actualUsers:0,tutorChanges:0,publicDeployment:false,remoteMigration:false,
  limitations:['Synthetic local identities, injected local authorization, loopback browsers and local databases; real OAuth, actual meetings, physical devices and satisfaction improvement are unverified.',
    'Broad region IDs do not establish travel distance, actual venue availability, GPS or adjacent-area compatibility; only explicitly chosen exact intersections compare.',
    'Historical mixed relationship answers are not mapped to new axes; a previous required condition remains until the owner explicitly retires it.',
    'New criterion reflection is private, does not infer peer behavior, does not change historical connection importance, and never applies by saving alone.',
    'Existing Core/Domain/Ask/Temper are reused with product-specific typed declarations and guards; this batch does not change underlying engine code or weights.',
    'Paid AI activation/evaluation, tutor, real participant recruitment, operating provider configuration and public deployment remain deferred.']
});
console.log(JSON.stringify({status:'passed-in-scope',uniqueTests:unique,browserPaths:42,servedFiles:served.length,preview:preview.origin+'/atlas-lab/dating.html'},null,2));
