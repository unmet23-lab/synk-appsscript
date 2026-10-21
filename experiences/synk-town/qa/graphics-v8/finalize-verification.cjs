// Read-only aggregation. Does not open a browser, save, API or product file for writing.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const town = path.resolve(__dirname, '../..');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, name + '.json')));
const checks = [], add = (name, ok, details) => checks.push({name, ok: ok === true, ...(details === undefined ? {} : {details})});
const artifacts = {};
function artifact(name, expectedCount, key = 'ok') {
  const r = read(name);
  artifacts[name] = {sha256:hash(path.join(__dirname,name+'.json')),checks:r.checks?.length};
  add(name+'-strict-check-results', r.checks.length === expectedCount && r.checks.every(c => c[key] === true), {count:r.checks.length});
  return r;
}
function sourceMatch(name, expected, label) { add(label+':'+name, hash(path.resolve(town,name)) === expected); }
const before = artifact('before',42), after = artifact('after',67), guard = artifact('guard',62);
const ui = artifact('ui-layout',47,'pass'), residents = artifact('residents-model',20), memory = artifact('brand-memory',64);
const portraits = artifact('portraits/RESIDENTS-portraits',18);
const environment = read('environment-model'), resources = read('resources'), served = read('served-local'), logic = read('logic-tests'), portraitAssets = read('portrait-after-hashes'), uiSource = read('ui-source');
for (const name of ['environment-model','resources','served-local','logic-tests','portrait-after-hashes','ui-source']) artifacts[name] = {sha256:hash(path.join(__dirname,name+'.json'))};
add('baseline-capture-complete', before.failure === null && before.errors.length === 0);
add('after-capture-complete', after.failure === null && ['errors','consoleErrors','shaderWarnings','failedRequests','apiFailures'].every(k=>after[k].length===0));
add('final-scope-guard',guard.pass === true && guard.finalized === true && guard.changedProductSources.length===7 && guard.unchangedFrozenSourceCount===20);
add('CPU-environment-and-geometry', environment.passed === true && environment.invalid===0 && environment.inverted===0 && environment.missingVertexColorAttributes===0 && environment.placesUnchanged === true);
add('CPU-residents',residents.passed === true);
add('CPU-completed-memory',memory.passed === true);
add('UI-layout',ui.passed === true && uiSource.passed === true && uiSource.htmlInverseExactlyMatchesBaseline === true);
add('logic-tests',logic.exitCode===0 && logic.tests===148 && logic.passed===148 && logic.failed===0);
for (const [name,sha] of Object.entries(after.sourceHashes)) sourceMatch(name,sha,'after-current-source');
for (const [name,sha] of Object.entries(memory.sourceHashes)) sourceMatch(name,sha,'memory-current-source');
for (const [name,sha] of Object.entries(portraits.sourceHashes)) sourceMatch(name,sha,'portraits-current-source');
for (const row of ui.sources) sourceMatch(row.name,row.sha256,'UI-current-source');
sourceMatch('day-environment.mjs',environment.sha256,'environment-current-source');
sourceMatch('day-residents.mjs',residents.sourceSha256,'residents-current-source');
for (const [name,sha] of Object.entries(read('logic-before'))) sourceMatch(name,sha,'protected-logic');
add('resources-two-cases',resources.passed === true && resources.cases.length===2 && resources.errors.length===0);
add('resources-actual-new-presentation',resources.loadedStats.graphicsVersion===8 && resources.loadedStats.brandArt.memoryMarkers.length===1 && resources.loadedStats.propCount===2);
for (const [name,sha] of Object.entries(resources.sourceHashes)) {
  sourceMatch(name,sha,'resources-current-source');
  add('resources-stable-source:'+name,resources.sourceHashesAfter[name]===sha);
}
add('public-static-files',served.passed===true && served.sources.length===35 && served.sources.every(row=>row.matches===true && row.status===200));
for(const row of served.sources) sourceMatch(row.name,row.servedSha256,'served-current-file');
add('portrait-render-complete',portraits.failure === null && portraits.errors.length===0 && portraits.failedRequests.length===0);
add('six-reviewed-portrait-assets',portraitAssets.passed===true && portraitAssets.portraits.length===6 && portraitAssets.visualInspection.allSixInspected===true);
for(const row of portraitAssets.portraits) sourceMatch(row.file,row.sha256,'portrait-current-file');
add('six-portrait-baselines-preserved',portraitAssets.portraits.every(row=>row.beforePreserved===true && hash(path.join(__dirname,'source-before',row.file))===row.beforeSha256));
add('all-twenty-final-screenshots-exist',after.screenshots.length===20 && after.screenshots.every(name=>fs.statSync(path.join(__dirname,name)).size>0));
const cadence = ['1280','390'].map(width => ({width:Number(width),...after.checks.find(c=>c.name===width+'-walking-cadence-at-least-55fps').details,comparison:after.metrics[width+'-cadenceComparison']}));
const report = {
  verifiedAt:new Date().toISOString(),scope:'Local v8 brand art, preserved direct movement/camera, completed-history presentation and static assets. Counts are separate suites, not a summed user-scenario total.',
  passed:checks.every(c=>c.ok),checks,artifacts,sourceHashes:after.sourceHashes,
  counts:{before:42,after:67,UI:47,residentsCPU:20,memoryCPU:64,scopeGuard:62,portraits:18,logicTests:148,resourceCases:2,servedPublicFiles:35},
  cadence,environment:{triangles:environment.stats.environmentTriangles,v7Triangles:environment.baselineEnvironmentTriangles,changePercent:environment.triangleChangePercent},
  limits:[
    '1280x900 and390x844 are host headless Edge viewport checks, not physical phones or controllers.',
    'Average sustained walking was55.66/56.93fps. Mobile had a520.5ms moving-frame interval and two intervals over50ms; cause not isolated. No constant60fps or stutter-free claim.',
    'Authoritative memory completion/reload is verified on disposable isolated stores. Existing4288 user save was neither read nor changed by QA.',
    'Resource fixture deliberately supplies one presentation-only memory plus table/cushion. Completion truth is established by separate actual UI and reducer/store checks.',
    'Resource disposal released every instance and the context. A normal renderer-internal buffer remains before context loss; not a claim that every raw deleteBuffer count equals allocation count.',
    'Portraits use fixture lighting. Final user art satisfaction, physical-device performance, live WORLD accounts and public deployment remain unverified.',
    'First after test used a route through an existing bench collider; preserved in route-check-first. Final test uses the authoritative workshop lane, without product collision edits.'
  ]
};
fs.writeFileSync(path.join(__dirname,'verification.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({passed:report.passed,checks:checks.length,failed:checks.filter(c=>!c.ok).map(c=>c.name),counts:report.counts}));
if(!report.passed)process.exitCode=1;
