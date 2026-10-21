// Read-only v10 source/AST scope audit. No GPU or user-save/state API access.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {babelParse}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/lib/transform/babelBundle.js');
const town=path.resolve(__dirname,'../..'),v8=path.resolve(__dirname,'../graphics-v8');
const fileHash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const read=p=>fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n'),json=p=>JSON.parse(read(p).replace(/^\uFEFF/,''));
const checks=[],check=(name,ok,details)=>checks.push({name,ok:ok===true,...(details===undefined?{}:{details})});
const allowed=new Set(['day-scene.mjs','day-environment.mjs','day-materials.mjs','day-rendering.mjs','server.mjs','../synk-world-home/avatar-v3.mjs','../synk-world-home/avatar-textiles.mjs']);
const baseline=json(path.join(__dirname,'baseline-hashes.json'));
const sources=baseline.map(r=>({name:r.name,before:r.sha256,snapshot:fileHash(path.join(__dirname,'source-before',r.snapshot)),current:fileHash(path.resolve(town,r.name)),allowed:allowed.has(r.name)}));
check('all27-v9-frozen-source-baselines-intact',sources.length===27&&sources.every(r=>r.snapshot===r.before));
check('five-Town-files-and-two-external-shared-sources-change',sources.every(r=>r.current===r.before||r.allowed),sources.filter(r=>r.current!==r.before).map(r=>r.name));
check('all20-unaffected-frozen-sources-byte-identical',sources.filter(r=>!r.allowed).length===20&&sources.filter(r=>!r.allowed).every(r=>r.current===r.before));
const logic=Object.entries(json(path.join(__dirname,'logic-before.json'))).map(([name,before])=>({name,before,current:fileHash(path.resolve(town,name))}));
check('nine-life-authority-movement-logic-hashes-intact-and-shared-avatar-update-reviewed-separately',logic.length===10&&logic.filter(r=>r.name!=='../synk-world-home/avatar-v3.mjs').every(r=>r.current===r.before));
const clean=value=>Array.isArray(value)?value.map(clean):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([k])=>!['start','end','loc','extra','leadingComments','trailingComments','innerComments','comments','tokens','errors'].includes(k)).map(([k,v])=>[k,clean(v)])):value;
const ast=s=>babelParse(s,'town-v10-scope.mjs',true),canonical=n=>JSON.stringify(clean(n));
function visit(node,fn){if(!node||typeof node!=='object')return;fn(node);for(const value of Object.values(node))if(Array.isArray(value))value.forEach(n=>visit(n,fn));else if(value&&typeof value==='object')visit(value,fn);}
function functions(tree){const rows=[];visit(tree,n=>{if(n.type==='FunctionDeclaration'&&n.id||n.type==='VariableDeclarator'&&n.id?.name&&['ArrowFunctionExpression','FunctionExpression'].includes(n.init?.type))rows.push(n);});return rows;}
const sharedUpdate=json(path.join(__dirname,'shared-update.json'));
check('four-external-shared-module-hashes-match-observed-update',sharedUpdate.sources.length===4&&sharedUpdate.sources.every(r=>fileHash(path.resolve(town,r.name))===r.sha256));
const serverCurrent=read(path.join(town,'server.mjs')),serverBefore=read(path.join(__dirname,'source-before/server.mjs'));
const addedRoute="  if (['/avatar-wardrobe.mjs', '/wardrobe-catalog.mjs'].includes(route)) return path.join(repo, 'experiences/synk-world-home', path.basename(route));";
const serverStaticOnly=serverCurrent.split(addedRoute).length===2&&canonical(ast(serverCurrent.replace(addedRoute,'')))===canonical(ast(serverBefore));
check('server-full-AST-identical-except-two-allowlisted-preview-static-imports',serverStaticOnly);
const functionEvidence=[];
function sameFunction(file,name,ordinal=0){
  const aSource=read(path.join(__dirname,'source-before',file)),bRaw=read(path.join(town,file)),bSource=file==='day-scene.mjs'?bRaw.replace('AVATAR_OUTFITS.includes(value.outfit)',"['none', 'scarf', 'apron', 'scarf-apron'].includes(value.outfit)"):bRaw,a=functions(ast(aSource)).filter(n=>n.id.name===name)[ordinal],b=functions(ast(bSource)).filter(n=>n.id.name===name)[ordinal];
  const row={file,name,ordinal,found:!!a&&!!b,normalizedSourceEqual:!!a&&!!b&&aSource.slice(a.start,a.end)===bSource.slice(b.start,b.end),astEqual:!!a&&!!b&&canonical(a)===canonical(b),beforeLine:a?.loc.start.line,currentLine:b?.loc.start.line};
  functionEvidence.push(row);check(`${file}:${name}:${ordinal}-source-and-AST-unchanged`,row.normalizedSourceEqual&&row.astEqual);
}
const sceneBefore=read(path.join(__dirname,'source-before/day-scene.mjs')),sceneCurrent=read(path.join(town,'day-scene.mjs')),counts={};
for(const n of functions(ast(sceneBefore))){const name=n.id.name,ordinal=counts[name]||0;counts[name]=ordinal+1;if(name!=='createDayScene'&&name!=='stats')sameFunction('day-scene.mjs',name,ordinal);}
const version='graphicsVersion: 10, brandArt: { revision: 3';
check('scene-version-metrics-only-advance-ten-and-brand-three',sceneCurrent.split(version).length===2);
const sceneInverse=sceneCurrent.replace(version,'graphicsVersion: 9, brandArt: { revision: 2').replace('import { createMongleAvatar, AVATAR_OUTFITS }', 'import { createMongleAvatar }').replace('AVATAR_OUTFITS.includes(value.outfit)',"['none', 'scarf', 'apron', 'scarf-apron'].includes(value.outfit)");
check('scene-two-observed-appearance-catalog-bindings-and-verified-gate',sceneCurrent.includes('import { createMongleAvatar, AVATAR_OUTFITS }')&&sceneCurrent.includes('appearanceVerified && AVATAR_OUTFITS.includes(value.outfit)')&&fileHash(path.join(town,'day-scene.mjs'))===sharedUpdate.sceneAppearanceUpdate.sha256);
check('scene-stats-AST-unchanged-after-only-version-literals',canonical(functions(ast(sceneBefore)).find(n=>n.id.name==='stats'))===canonical(functions(ast(sceneInverse)).find(n=>n.id.name==='stats')));
check('entire-scene-module-AST-unchanged-except-two-version-and-two-observed-appearance-bindings',canonical(ast(sceneBefore))===canonical(ast(sceneInverse)));
sameFunction('day-environment.mjs','terrainHeight');
const place=source=>{let result;visit(ast(source),n=>{if(n.type==='VariableDeclarator'&&n.id?.name==='PLACES')result=n;});return result;};
check('environment-PLACES-AST-intact',canonical(place(read(path.join(__dirname,'source-before/day-environment.mjs'))))===canonical(place(read(path.join(town,'day-environment.mjs')))));
// Implemented after reading the final rendering diff; its exception list is
// exact reviewed syntax, not unrestricted permission to edit this module.
const renderingReview=require('./rendering-scope-review.cjs').reviewRendering({town,beforeDirectory:path.join(__dirname,'source-before'),ast,canonical,visit,check,fileHash});
const ui=json(path.join(v8,'ui-layout.json')),residents=json(path.join(v8,'residents-model.json')),portraits=json(path.join(v8,'portrait-after-hashes.json'));
const reusedReports={UI:{report:'../graphics-v8/ui-layout.json',checks:ui.checks.length,sourceHashMatches:ui.sources.every(r=>fileHash(path.join(town,r.name))===r.sha256)},residents:{report:'../graphics-v8/residents-model.json',checks:residents.checks.length,sourceHashMatches:fileHash(path.join(town,'day-residents.mjs'))===residents.sourceSha256},portraits:{report:'../graphics-v8/portrait-after-hashes.json',checks:portraits.checks,sourceHashMatches:fileHash(path.join(town,'day-residents.mjs'))===portraits.sourceSha256,assets:portraits.portraits.map(r=>({name:r.file,expected:r.sha256,current:fileHash(path.join(town,r.file))}))}};
check('unchanged-UI-source-hashes-match-reused47-check-evidence',ui.passed===true&&reusedReports.UI.checks===47&&reusedReports.UI.sourceHashMatches);
check('unchanged-NPC-source-hash-matches-reused20-check-evidence',residents.passed===true&&reusedReports.residents.checks===20&&reusedReports.residents.sourceHashMatches);
check('six-unchanged-portrait-assets-and-model-match-reused18-check-evidence',portraits.passed===true&&reusedReports.portraits.checks===18&&reusedReports.portraits.sourceHashMatches&&reusedReports.portraits.assets.length===6&&reusedReports.portraits.assets.every(r=>r.expected===r.current));
const assets=json(path.join(__dirname,'assets-before.json')).map(r=>({...r,current:fileHash(path.resolve(town,r.name))}));
check('nine-approved-UI-and-portrait-bitmaps-unchanged',assets.length===9&&assets.every(r=>r.sha256===r.current));
check('approved-professor-original-unchanged',fileHash(path.resolve(town,'../..',portraits.approvedProfessorReference.path))===portraits.approvedProfessorReference.expectedSha256);
const materials=json(path.join(__dirname,'materials-model.json')),architecture=json(path.join(__dirname,'architecture-cpu.json')),renderingCPU=json(path.join(__dirname,'rendering-cpu.json'));
check('current-material-CPU-evidence-source-matches',materials.passed===true&&materials.sha256===fileHash(path.join(town,'day-materials.mjs')));
check('current-architecture-CPU-evidence-source-matches',architecture.passed===true&&architecture.sha256===fileHash(path.join(town,'day-environment.mjs')));
check('current-rendering-CPU-evidence-source-matches',renderingCPU.passed===true&&renderingCPU.sha256===fileHash(path.join(town,'day-rendering.mjs')));
const before=json(path.join(__dirname,'before.json')),audit=json(path.join(__dirname,'before-source-audit.json')),provenance=json(path.join(__dirname,'baseline-provenance.json'));
check('fresh-before-original-report-and-criterion-failures-preserved',before.stage==='before'&&before.checks.length===56&&before.checks.filter(c=>c.ok!==true).length===2&&fileHash(path.join(__dirname,'before.json'))===provenance.freshBeforeCapture.sha256&&fileHash(path.join(__dirname,'before.json'))===audit.beforeReportSha256);
check('fresh-before-integrity-audit-complete-with-20-real-captures',audit.passed===true&&audit.checks.every(c=>c.ok===true)&&before.screenshots.length===20&&audit.captures.length===20&&audit.captures.every(r=>fileHash(path.join(__dirname,r.name))===r.sha256));
check('all-source-hashes-stable-through-read-only-audit',sources.every(r=>fileHash(path.resolve(town,r.name))===r.current));
const report={checkedAt:new Date().toISOString(),scope:'Read-only v10 exact-source/AST preservation audit. UI47/NPC20/portraits18 reused only after hash checks. Fresh before failures remain failures; no GPU, account or user-save access.',passed:checks.every(c=>c.ok===true),checks,allowedProductChanges:[...allowed],changedProductSources:sources.filter(r=>r.current!==r.before).map(r=>r.name),unchangedFrozenSourceCount:sources.filter(r=>r.current===r.before).length,sources,logic,functionEvidence,serverStaticOnly,sharedUpdate,renderingReview,reusedReports,assets,baselineProvenance:provenance,limits:['AST preservation and bounded rendering review establish scope, not visual satisfaction.','The fresh baseline contains two preserved criterion failures; its source integrity and full20captures are separately established.','Headless default-camera screenshots and actual walking must be reviewed independently.']};
fs.writeFileSync(path.join(__dirname,'guard.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({passed:report.passed,checks:checks.length,failed:checks.filter(c=>c.ok!==true),changed:report.changedProductSources,unchanged:report.unchangedFrozenSourceCount}));
if(!report.passed)process.exitCode=1;
