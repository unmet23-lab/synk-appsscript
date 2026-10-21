import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const dir=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(dir,'../../../..'),prior=path.resolve(dir,'../atlas-dating-fit-20261007');
const hash=value=>createHash('sha256').update(value).digest('hex');
const read=file=>fs.readFile(file,'utf8');
const json=async file=>JSON.parse((await read(file)).replace(/^\uFEFF/,''));
const write=(name,value)=>fs.writeFile(path.join(dir,name),JSON.stringify(value,null,2)+'\n');
const names=raw=>raw.split(/\r?\n/).flatMap(line=>{const m=line.match(/^ok \d+ - (.+)$/);return m?[m[1]]:[];});
const metrics=raw=>Object.fromEntries(['tests','pass','fail','cancelled','skipped'].map(key=>{const m=[...raw.matchAll(new RegExp('# '+key+' (\\d+)','g'))];return [key,Number(m.at(-1)?.[1])];}));
const groups=[];
for(const [name,log,count]of [
  ['service, context transition, introduction guidance, completed-meeting criteria and mutual regions','server-final.tap',122],
  ['deadline policy, discovery, relationship contracts, readiness, projections, disclosure and live state','client-discovery-final.tap',213],
  ['adult, central availability, receipts, account, checkpoint, delivery and lifecycle','access-delivery-final.tap',76],
  ['actual paired PGlite and SQLite backup restoration','backup-final.tap',5],
]){
  const bytes=await fs.readFile(path.join(dir,log)),raw=bytes.toString('utf8'),measured=metrics(raw),caseNames=names(raw);
  assert.equal(measured.tests,count,log);assert.equal(measured.pass,count,log);for(const key of ['fail','cancelled','skipped'])assert.equal(measured[key],0,log);assert.equal(caseNames.length,count,log);
  groups.push({name,log,sha256:hash(bytes),...measured,caseNames});
}
const counter=new Map();for(const group of groups)for(const name of group.caseNames)counter.set(name,(counter.get(name)||0)+1);
const overlaps=[...counter].filter(([,n])=>n>1);assert.equal(overlaps.length,0);assert.equal(counter.size,416);
await write('test-deduplication.json',{uniqueCases:counter.size,totalExecutions:416,overlaps,groups});

const browser=[];
for(const [name,sourceDirectory,count,log]of [
  ['new personal controls','dating-control',14,'browser-new.log'],
  ['existing relationship regions and new criterion','dating-fit',15,'browser-fit-regression.log'],
  ['existing introduction and appointment','dating',18,'browser-dating-regression.log'],
  ['existing preparation and adult access','dating-readiness',9,'browser-readiness-regression.log'],
]){
  const record=await json(path.join(root,'experiences/atlas-lab/qa',sourceDirectory,'result.json'));
  assert.equal(record.status,'passed',name);assert.equal(record.paths.length,count,name);assert.equal(new Set(record.paths).size,count,name);
  for(const key of ['errors','externalRequests'])assert.equal(record[key].length,0,name);for(const key of ['modelCalls','actualUsers'])assert.equal(record[key],0,name);
  if(Object.hasOwn(record,'externalApiCost'))assert.equal(record.externalApiCost,0);
  if(record.sourceBefore){assert.deepEqual(record.sourceBefore,record.sourceSha256,name);assert.equal(record.sourceStable,true,name);}
  for(const [file,sha256]of Object.entries(record.sourceSha256||{}))assert.equal(hash(await fs.readFile(path.join(root,'experiences/atlas-lab',file))),sha256,file);
  assert.ok((await read(path.join(dir,log))).includes('"status": "passed"'),log);
  const localRecord='browser-'+sourceDirectory+'.json';await write(localRecord,record);
  browser.push({name,paths:count,record:localRecord,log,at:record.at,errors:0,externalRequests:0});
}
const newBrowser=await json(path.join(dir,'browser-dating-control.json'));
const screenshots=[];
for(const file of newBrowser.screenshots){
  const bytes=await fs.readFile(path.join(root,'experiences/atlas-lab/qa/dating-control',file));assert.equal(bytes.readUInt32BE(12),0x49484452);
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);assert.ok([320,390].includes(width));
  await fs.writeFile(path.join(dir,file),bytes);screenshots.push({path:file,width,height,sha256:hash(bytes)});
}
assert.equal(screenshots.length,8);assert.ok(screenshots.some(item=>item.width===320)&&screenshots.some(item=>item.width===390));await write('screenshots.json',screenshots);

const original=await json(path.join(dir,'context-transition-subtask.json'));
for(const [file,sha256]of Object.entries(original.sourceHashes))assert.equal(hash(await fs.readFile(path.resolve(root,file))),sha256,file);
const deadline=await json(path.join(dir,'preference-deadline-subtask.json'));
await write('parent-completion.json',{at:new Date().toISOString(),status:'passed-in-scope',
  subtaskEvidence:{context:'context-transition-subtask.json',deadline:'preference-deadline-subtask.json',introduction:'guidance-final-tests.log'},
  finalServer:{log:'server-final.tap',tests:122,pass:122,fail:0,includesService57:true,includesContext14:true,includesGuidance28:true,includesCriterion17:true,includesMutualRegion6:true},
  note:'Delegated implementation finished; final shared-source regression, browser scripts, UI integration and documentation were completed by the parent after delegation was interrupted.',
  sourceChecksMatched:true,paidCalls:0});
assert.ok(deadline);

const priorSources=await json(path.join(prior,'sources.json'));
const publicFiles=[...(await json(path.join(prior,'preview-check.json'))).files.map(item=>item.path),'experiences/atlas-lab/preference-deadline.mjs','experiences/atlas-lab/introduction-guidance.mjs'];
const testedFiles=[
  'tests/atlas-dating-service.test.mjs','tests/atlas-dating-context-transition.test.mjs','tests/atlas-dating-introduction-guidance.test.mjs','tests/atlas-dating-new-criterion.test.mjs','tests/atlas-dating-fit-service.test.mjs',
  'tests/atlas-preference-deadline.test.mjs','tests/atlas-discovery.test.mjs','tests/atlas-discovery-personalization.test.mjs','tests/atlas-discovery-conditional.test.mjs','tests/atlas-discovery-repeat.test.mjs','tests/atlas-discovery-relationship.test.mjs',
  'tests/atlas-dating-fit-projections.test.mjs','tests/atlas-discovery-guidance.test.mjs','tests/atlas-dating-insights.test.mjs','tests/atlas-dating-live.test.mjs',
  'tests/atlas-dating-adult.test.mjs','tests/atlas-dating-availability-service.test.mjs','tests/atlas-dating-receipt-service.test.mjs','tests/atlas-dating-account.test.mjs','tests/atlas-dating-checkpoint.test.mjs','tests/atlas-dating-delivery.test.mjs','tests/atlas-dating-lifecycle-service.test.mjs','tests/atlas-dating-backup-restore.test.mjs',
  'tests/atlas-dating-control-smoke.mjs','tests/atlas-dating-fit-smoke.mjs','tests/atlas-dating-smoke.mjs','tests/atlas-dating-readiness-smoke.mjs',
];
const productFiles=[...new Set([...Object.keys(newBrowser.sourceSha256).map(file=>'experiences/atlas-lab/'+file),...Object.keys((await json(path.join(dir,'browser-dating-fit.json'))).sourceSha256).map(file=>'experiences/atlas-lab/'+file)])];
const docs=['docs/아틀라스_공통능력_고도화_20261005.md','docs/_ops/트랙.md','docs/_ops/qa/atlas-dating-control-20261007/finalize.mjs','docs/_ops/qa/atlas-dating-control-20261007/preview.mjs'];
const sourceFiles=new Set([...productFiles,...publicFiles,...testedFiles,...docs,...priorSources.filter(item=>item.path.startsWith('atlas/')).map(item=>item.path)]),sources=[];
for(const file of sourceFiles)sources.push({path:file,sha256:hash(await fs.readFile(path.resolve(root,file)))});await write('sources.json',sources);
const current=new Map(sources.map(item=>[item.path,item.sha256]));
const engines=priorSources.filter(item=>item.path.startsWith('atlas/')).map(item=>({path:item.path,same:item.sha256===current.get(item.path)}));assert.ok(engines.length&&engines.every(item=>item.same));await write('engine-check.json',{engineCodeChangedByThisBatch:0,newEngines:0,checks:engines});
const frozen=await json(path.join(prior,'frozen-check.json'));for(const item of frozen.checks){assert.equal(hash(await fs.readFile(path.resolve(root,item.path))),item.actual,item.path);item.changedSincePrior=false;}assert.equal(frozen.checks.length,9);assert.equal(frozen.checks.filter(item=>item.same).length,8);frozen.at=new Date().toISOString();await write('frozen-check.json',frozen);

const syntaxFiles=[...new Set([...productFiles,...testedFiles,...docs.filter(file=>file.endsWith('.mjs'))])];
for(const file of syntaxFiles.filter(file=>/\.(js|mjs)$/.test(file))){const result=spawnSync(process.execPath,['--check',file],{cwd:root,encoding:'utf8'});assert.equal(result.status,0,file+' '+result.stderr);}
const diff=spawnSync('git',['diff','--check','--',...productFiles,...testedFiles,...docs],{cwd:root,encoding:'utf8'});assert.equal(diff.status,0,diff.stdout+diff.stderr);await write('final-source-check.json',{at:new Date().toISOString(),syntaxPassed:syntaxFiles.filter(file=>/\.(js|mjs)$/.test(file)).length,files:syntaxFiles,diffExit:diff.status});
const preview=await json(path.join(dir,'preview-launch.json'));assert.match(preview.origin,/^http:\/\/127\.0\.0\.1:\d+$/);
const config=await(await fetch(preview.origin+'/api/atlas-dating/config')).json();assert.equal(config.mode,'demo');assert.equal(config.demoEnabled,true);
const served=[];for(const file of new Set(publicFiles)){const response=await fetch(preview.origin+'/'+file.replace(/^experiences\//,'')),bytes=Buffer.from(await response.arrayBuffer());assert.equal(response.status,200,file);assert.equal(hash(bytes),current.get(file),file);served.push({path:file,status:200,same:true});}
assert.equal(served.length,16);await write('preview-check.json',{...preview,at:new Date().toISOString(),files:served});
await write('browser-batch.json',{at:new Date().toISOString(),status:'passed',uniqueBrowserPaths:56,finalSourceStable:true,browser,screenshots:screenshots.length,sourceSha256:newBrowser.sourceSha256});
await write('run-note.json',{
  preservedFailures:['Context-transition fixture used invalid option values and a wrong null expectation; initial three failures retained before final pass.',
    'New browser fixture initially recorded a conditional allowance without its required preview, then tried a control inside a closed ancestor, then supplied an unsupported completion property. Corrected fixture runs are preserved separately.',
    'Delegated agents stopped because of account/runtime authentication and network errors. Parent completed final verification without paid service activation or changes to the product authorization rules.'],
  repeatedRunsNotAdditive:true,existingDatingSmokeChange:'Only its new-context step now explicitly confirms the preview before asserting the same old reset behavior.',
  sourceStable:true,paidCalls:0,modelCalls:0,actualUsers:0,remoteMigration:false,publicDeployment:false});
await write('report.json',{
  at:new Date().toISOString(),status:'passed-in-scope',
  scope:['Blocked-introduction reasons and exact owner action from currently authorized facts','Read-only next-context transition preview and atomic explicit exposure/start apply','Server-time Korean today-only, recommendation-only and custom deadline controls with current-source bounds and return explanation'],
  tests:{uniqueCases:416,passed:416,failed:0,totalExecutions:416,groups:groups.map(({caseNames,...item})=>item)},browserPaths:56,browser,mobileScreenshots:8,
  preview:{url:preview.origin+'/atlas-lab/dating.html',filesMatched:16,isolatedDemo:true},sourceStable:true,
  engineCodeChangedByThisBatch:0,newEngines:0,modelCalls:0,externalApiCost:0,actualUsers:0,tutorChanges:0,publicDeployment:false,remoteMigration:false,
  limitations:['All identities, meetings, authorization suppliers and browser evidence are synthetic and local; real satisfaction, actual meetings, physical devices and production are unverified.',
    'Hidden counterpart region or invitation settings are never identified as a cause; generic pending guidance offers current-state refresh instead.',
    'Only eligible IDs actually listed by the client are accepted for the reviewed exposure plan; server permission checks do not prove physical human viewing.',
    'Today-only uses the current server projection time and Asia/Seoul midnight. Manual custom dates use the device timezone with a visible label; final server revalidation remains authoritative.',
    'Guidance and shortcuts never grant consent, publish answers, widen actual meeting areas or relax either party must-haves.',
    'Existing Core/Domain/Ask/Temper and product contracts are reused; no underlying engine code or weights changed.',
    'Paid AI features, model evaluation, tutor, real participant recruitment, production providers and deployment remain deferred.']
});
console.log(JSON.stringify({status:'passed-in-scope',uniqueTests:416,browserPaths:56,servedFiles:16,preview:preview.origin+'/atlas-lab/dating.html'},null,2));
