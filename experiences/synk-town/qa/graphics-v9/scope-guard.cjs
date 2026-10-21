// Read-only v9 scope audit. No browser, GPU, save, account, or product writes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {babelParse}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/lib/transform/babelBundle.js');
const town=path.resolve(__dirname,'../..'),v8=path.resolve(__dirname,'../graphics-v8');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const fileHash=p=>hash(fs.readFileSync(p));
const read=p=>fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
const json=p=>JSON.parse(read(p).replace(/^\uFEFF/,''));
const checks=[],check=(name,ok,details)=>checks.push({name,ok:!!ok,...(details===undefined?{}:{details})});
const allowed=new Set(['day-scene.mjs','day-environment.mjs','day-materials.mjs']);
const baseline=json(path.join(__dirname,'baseline-hashes.json'));
const sources=baseline.map(row=>({name:row.name,before:row.sha256,snapshot:fileHash(path.join(__dirname,'source-before',row.snapshot)),current:fileHash(path.resolve(town,row.name)),allowed:allowed.has(row.name)}));
check('all27-v8-frozen-source-baselines-intact',sources.length===27&&sources.every(r=>r.snapshot===r.before));
check('only-three-authorized-art-product-sources-change',sources.every(r=>r.current===r.before||r.allowed),sources.filter(r=>r.current!==r.before).map(r=>r.name));
check('all24-other-frozen-sources-byte-identical',sources.filter(r=>!r.allowed).length===24&&sources.filter(r=>!r.allowed).every(r=>r.current===r.before));
const logic=Object.entries(json(path.join(__dirname,'logic-before.json'))).map(([name,before])=>({name,before,current:fileHash(path.resolve(town,name))}));
check('all-ten-living-authority-movement-avatar-logic-hashes-intact',logic.length===10&&logic.every(r=>r.current===r.before));
const clean=value=>Array.isArray(value)?value.map(clean):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([k])=>!['start','end','loc','extra','leadingComments','trailingComments','innerComments','comments','tokens','errors'].includes(k)).map(([k,v])=>[k,clean(v)])):value;
const ast=s=>babelParse(s,'town-v9-scope.mjs',true),canonical=node=>JSON.stringify(clean(node));
function visit(node,fn){if(!node||typeof node!=='object')return;fn(node);for(const value of Object.values(node))if(Array.isArray(value))value.forEach(n=>visit(n,fn));else if(value&&typeof value==='object')visit(value,fn);}
function functions(tree){const rows=[];visit(tree,n=>{if(n.type==='FunctionDeclaration'&&n.id||n.type==='VariableDeclarator'&&n.id?.name&&['ArrowFunctionExpression','FunctionExpression'].includes(n.init?.type))rows.push(n);});return rows;}
const functionEvidence=[];
function sameFunction(file,name,ordinal=0){
  const aSource=read(path.join(__dirname,'source-before',file)),bSource=read(path.join(town,file));
  const a=functions(ast(aSource)).filter(n=>n.id.name===name)[ordinal],b=functions(ast(bSource)).filter(n=>n.id.name===name)[ordinal];
  const row={file,name,ordinal,found:!!a&&!!b,normalizedSourceEqual:!!a&&!!b&&aSource.slice(a.start,a.end)===bSource.slice(b.start,b.end),astEqual:!!a&&!!b&&canonical(a)===canonical(b),beforeLine:a?.loc.start.line,currentLine:b?.loc.start.line};
  functionEvidence.push(row);check(`${file}:${name}:${ordinal}-source-and-AST-unchanged`,row.normalizedSourceEqual&&row.astEqual);
}
const sceneBefore=read(path.join(__dirname,'source-before/day-scene.mjs')),sceneCurrent=read(path.join(town,'day-scene.mjs'));
const counts={};
for(const n of functions(ast(sceneBefore))){const name=n.id.name,ordinal=counts[name]||0;counts[name]=ordinal+1;if(name!=='createDayScene'&&name!=='stats')sameFunction('day-scene.mjs',name,ordinal);}
const statsReplacement='graphicsVersion: 9, brandArt: { revision: 2';
check('scene-version-metrics-only-advance-nine-and-brand-two',sceneCurrent.split(statsReplacement).length===2);
const sceneInverse=sceneCurrent.replace(statsReplacement,'graphicsVersion: 8, brandArt: { revision: 1');
check('scene-stats-AST-unchanged-after-reviewed-version-literals',canonical(functions(ast(sceneBefore)).find(n=>n.id.name==='stats'))===canonical(functions(ast(sceneInverse)).find(n=>n.id.name==='stats')));
const lightingEvidence=[];
function memberPath(node){return node?.type==='Identifier'?node.name:node?.type==='MemberExpression'&&!node.computed?`${memberPath(node.object)}.${node.property.name}`:null;}
function lightingProjection(source,stage){
  const tree=ast(source),rows=[];
  const literals=(label,args,types)=>{
    if(args.length!==types.length||args.some((n,i)=>n.type!==types[i]))return false;
    rows.push({stage,label,values:args.map(n=>n.value)});args.forEach(n=>{n.value=n.type==='StringLiteral'?'<reviewed-light-color>':-9001;});return true;
  };
  visit(tree,n=>{
    if(n.type==='AssignmentExpression'){
      const lhs=memberPath(n.left);
      if(lhs==='scene.background'&&n.right.type==='NewExpression'&&memberPath(n.right.callee)==='THREE.Color')literals(lhs,n.right.arguments,['StringLiteral']);
      if(lhs==='scene.fog'&&n.right.type==='NewExpression'&&memberPath(n.right.callee)==='THREE.Fog')literals(lhs,n.right.arguments,['StringLiteral','NumericLiteral','NumericLiteral']);
      if(['scene.environmentIntensity','light.shadow.radius'].includes(lhs))literals(lhs,[n.right],['NumericLiteral']);
    }
    if(n.type==='VariableDeclarator'&&['light','fill'].includes(n.id?.name)&&n.init?.type==='NewExpression'&&memberPath(n.init.callee)==='THREE.DirectionalLight')literals(n.id.name,n.init.arguments,['StringLiteral','NumericLiteral']);
    if(n.type==='CallExpression'&&memberPath(n.callee)==='scene.add'&&n.arguments.length===1&&n.arguments[0].type==='NewExpression'&&memberPath(n.arguments[0].callee)==='THREE.HemisphereLight')literals('hemisphere',n.arguments[0].arguments,['StringLiteral','StringLiteral','NumericLiteral']);
  });
  lightingEvidence.push(...rows);check(`${stage}-exact-seven-reviewed-light-literal-groups`,rows.length===7,rows);
  return tree;
}
const aProjection=lightingProjection(sceneBefore,'v8'),bProjection=lightingProjection(sceneInverse,'v9');
check('entire-scene-module-AST-unchanged-except-seven-reviewed-light-literal-groups-and-versions',canonical(aProjection)===canonical(bProjection));
sameFunction('day-environment.mjs','terrainHeight');
const findPlace=source=>{let result;visit(ast(source),n=>{if(n.type==='VariableDeclarator'&&n.id?.name==='PLACES')result=n;});return result;};
check('environment-PLACES-AST-intact',canonical(findPlace(read(path.join(__dirname,'source-before/day-environment.mjs'))))===canonical(findPlace(read(path.join(town,'day-environment.mjs')))));
const ui=json(path.join(v8,'ui-layout.json')),residents=json(path.join(v8,'residents-model.json')),portrait=json(path.join(v8,'portrait-after-hashes.json'));
const reusedReports={UI:{report:'../graphics-v8/ui-layout.json',checks:ui.checks.length,sourceHashMatches:ui.sources.every(r=>fileHash(path.join(town,r.name))===r.sha256)},residents:{report:'../graphics-v8/residents-model.json',checks:residents.checks.length,sourceHashMatches:fileHash(path.join(town,'day-residents.mjs'))===residents.sourceSha256},portraits:{report:'../graphics-v8/portrait-after-hashes.json',checks:portrait.checks,sourceHashMatches:fileHash(path.join(town,'day-residents.mjs'))===portrait.sourceSha256,assets:portrait.portraits.map(r=>({name:r.file,expected:r.sha256,current:fileHash(path.join(town,r.file))}))}};
check('unchanged-UI-source-hashes-match-existing47-check-evidence',ui.passed&&reusedReports.UI.checks===47&&reusedReports.UI.sourceHashMatches);
check('unchanged-NPC-source-hash-matches-existing20-check-evidence',residents.passed&&reusedReports.residents.checks===20&&reusedReports.residents.sourceHashMatches);
check('six-unchanged-portrait-assets-and-model-match-existing18-check-evidence',portrait.passed&&reusedReports.portraits.checks===18&&reusedReports.portraits.sourceHashMatches&&reusedReports.portraits.assets.length===6&&reusedReports.portraits.assets.every(r=>r.expected===r.current));
const uiAssets=ui.assetCopies.map(r=>({name:`assets/ui/${r.name}`,expected:r.sha256,current:fileHash(path.join(town,'assets/ui',r.name))}));
check('three-approved-UI-bitmaps-unchanged',uiAssets.length===3&&uiAssets.every(r=>r.expected===r.current));
const professor=portrait.approvedProfessorReference;
check('approved-professor-reference-unchanged',fileHash(path.resolve(town,'../..',professor.path))===professor.expectedSha256);
const materials=json(path.join(__dirname,'materials-model.json'));
check('current-material-model-evidence-source-hash-matches',materials.passed&&materials.sha256===fileHash(path.join(town,'day-materials.mjs')),{report:'materials-model.json',checks:materials.checks.length});
const original=json(path.join(v8,'after.json')),provenance=json(path.join(__dirname,'baseline-provenance.json'));
check('reused-v8-report-preserved-byte-identical',fileHash(path.join(__dirname,'before.json'))===fileHash(path.join(v8,'after.json')));
check('reused-v8-provenance-reports67-successful-checks',provenance.checks===67&&original.checks.length===67&&original.checks.every(c=>c.ok)&&!original.failure);
const screenshots=original.screenshots.map(name=>({name:name.replace(/^after-/,'before-'),before:fileHash(path.join(__dirname,name.replace(/^after-/,'before-'))),original:fileHash(path.join(v8,name))}));
check('all20-reused-v8-screenshots-preserved-byte-identical',screenshots.length===20&&screenshots.every(r=>r.before===r.original));
check('all-source-hashes-stable-through-read-only-audit',sources.every(r=>fileHash(path.resolve(town,r.name))===r.current));
const report={checkedAt:new Date().toISOString(),scope:'Read-only v9 source/AST preservation audit. Existing UI47/NPC20/portrait18 evidence reused only after exact source and asset hash checks; those tests are not rerun here. No GPU or live save access.',passed:checks.every(c=>c.ok),checks,allowedProductChanges:[...allowed],changedProductSources:sources.filter(r=>r.current!==r.before).map(r=>r.name),unchangedFrozenSourceCount:sources.filter(r=>r.current===r.before).length,sources,logic,functionEvidence,lightingEvidence,reusedReports,uiAssets,baselineProvenance:provenance,screenshots,limits:['Lighting literal review and complete scene AST conservation establish scope, not visual satisfaction or performance.','Historical v8 captures are visual/performance references, not fresh same-session GPU baseline.','Default-camera screenshots and current real walking checks must be reviewed separately.']};
fs.writeFileSync(path.join(__dirname,'guard.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({passed:report.passed,checks:checks.length,failed:checks.filter(c=>!c.ok),changed:report.changedProductSources,unchanged:report.unchangedFrozenSourceCount}));
if(!report.passed)process.exitCode=1;
