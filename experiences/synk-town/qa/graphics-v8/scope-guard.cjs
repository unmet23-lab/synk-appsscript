// Read-only source/AST scope audit. No product writes, browser or GPU.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const { babelParse } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/lib/transform/babelBundle.js');
const town = path.resolve(__dirname, '../..');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const read = p => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const checks = [], check = (name, ok, details) => checks.push({ name, ok: !!ok, ...(details === undefined ? {} : { details }) });
const allowed = new Set(['day-scene.mjs','day-materials.mjs','day-environment.mjs','day-residents.mjs','day-style.css','day.html','day-app.mjs']);
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'baseline-hashes.json')));
const sources = baseline.map(row => {
  const frozen = fs.readFileSync(path.join(__dirname, 'source-before', row.snapshot));
  const current = fs.readFileSync(path.resolve(town, row.name));
  return { name:row.name, before:row.sha256, snapshot:hash(frozen), current:hash(current), baselineIntact:hash(frozen) === row.sha256, unchanged:hash(current) === row.sha256, normalizedUnchanged:read(path.resolve(town,row.name)) === frozen.toString('utf8').replace(/\r\n/g,'\n'), allowedVisualChange:allowed.has(row.name) };
});
check('all27-frozen-baseline-hashes-intact', sources.length === 27 && sources.every(r=>r.baselineIntact));
check('only-seven-authorized-product-sources-change', sources.every(r=>r.unchanged || r.allowedVisualChange), sources.filter(r=>!r.unchanged).map(r=>r.name));
check('twenty-shared-movement-server-avatar-and-renderer-sources-byte-identical', sources.filter(r=>!r.allowedVisualChange).length === 20 && sources.filter(r=>!r.allowedVisualChange).every(r=>r.unchanged));
const logic = Object.entries(JSON.parse(fs.readFileSync(path.join(__dirname,'logic-before.json')))).map(([name,before])=>({name,before,current:hash(fs.readFileSync(path.resolve(town,name)))}));
check('all-ten-living-authority-and-movement-logic-hashes-intact', logic.length === 10 && logic.every(r=>r.before===r.current));
const clean = value => {
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([k])=>!['start','end','loc','extra','leadingComments','trailingComments','innerComments','comments','tokens','errors'].includes(k)).map(([k,v])=>[k,clean(v)]));
  return value;
};
const ast = s => babelParse(s, 'town-scope.mjs', true);
const canonical = node => JSON.stringify(clean(node));
function functions(tree) {
  const out=[];
  const visit=node=>{
    if (!node || typeof node!=='object') return;
    if (node.type==='FunctionDeclaration' && node.id) out.push(node);
    if (node.type==='VariableDeclarator' && node.id?.name && ['ArrowFunctionExpression','FunctionExpression'].includes(node.init?.type)) out.push(node);
    for(const v of Object.values(node)) if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')visit(v);
  };
  visit(tree); return out;
}
const functionEvidence=[];
function sameFunction(file,name,ordinal=0) {
  const before=read(path.join(__dirname,'source-before',file)), current=read(path.join(town,file));
  const a=functions(ast(before)).filter(n=>n.id.name===name)[ordinal],b=functions(ast(current)).filter(n=>n.id.name===name)[ordinal];
  const row={file,name,ordinal,found:!!a&&!!b,normalizedSourceEqual:!!a&&!!b&&before.slice(a.start,a.end)===current.slice(b.start,b.end),astEqual:!!a&&!!b&&canonical(a)===canonical(b),beforeLine:a?.loc.start.line,currentLine:b?.loc.start.line};
  functionEvidence.push(row);check(`${file}:${name}:${ordinal} normalized function and AST unchanged`,row.normalizedSourceEqual&&row.astEqual);
}
const appBefore=read(path.join(__dirname,'source-before/day-app.mjs')), appCurrent=read(path.join(town,'day-app.mjs'));
const memoryAddition=', memories: (snapshot.state.day?.history || []).map(({ resultId, kind, role, choice, location }) => ({ resultId, kind, role, choice, location }))';
check('app-change-exactly-one-presentation-only-memory-projection', appCurrent.includes(memoryAddition) && appCurrent.replace(memoryAddition,'')===appBefore);
for(const name of ['reconcileWalk','flushWalk','walkFrame','observe','command','request','ensureFreshPresence','setBusy','pauseWalkInput','interactWalk','useFallback']) {
  if (functions(ast(appBefore)).some(n=>n.id.name===name)) sameFunction('day-app.mjs',name);
}
const sceneProtected=['actor','fadeBuilding','updateOcclusion','focusShadow','followTarget','layoutCamera','resize','setPlayerPose','setActor','releaseObjects','cafePoint','updateLegacy','frame','schedule','pointerDown','pointerUp','pointerCancel','visibilityChange','motionChange','lost','setAppearance','cameraDiagnostics','dispose'];
sceneProtected.forEach(n=>sameFunction('day-scene.mjs',n));
sameFunction('day-residents.mjs','update',0);sameFunction('day-residents.mjs','update',1);
for(const n of ['makeFace','makeHair','hairCap','paddedShell','standingHeight'])sameFunction('day-residents.mjs',n);
sameFunction('day-environment.mjs','terrainHeight');
const sceneBefore=read(path.join(__dirname,'source-before/day-scene.mjs')), sceneCurrent=read(path.join(town,'day-scene.mjs'));
let sceneInverse=sceneCurrent.replace(' updateMemories(data.memories);','').replace('graphicsVersion: 8, brandArt: { revision: 1, palette: TOWN_BRAND, materialVersion: surfaceArt.version, memoryMarkers: memoryMarkers.map(h => ({ ...h })) },','graphicsVersion: 7,');
const sceneAFns=functions(ast(sceneBefore)), sceneBFns=functions(ast(sceneInverse));
for(const name of ['render','stats']) {
  const a=sceneAFns.find(n=>n.id.name===name),b=sceneBFns.find(n=>n.id.name===name);
  check(`scene-${name}-unchanged-after-authorized-memory-or-art-metrics-removal`,canonical(a)===canonical(b));
}
// Remove only individually reviewed art nodes. Remaining module AST must match.
function artProjection(source) {
  const tree=ast(source);
  const create=functions(tree).find(n=>n.id.name==='createDayScene');
  const artHelpers=new Set(['requestCard','pictureMenu','updateProps','updateMemories','stats']);
  tree.program.body=tree.program.body.filter(n=>!(n.type==='FunctionDeclaration'&&artHelpers.has(n.id.name)));
  const statementText=n=>source.slice(n.start,n.end);
  create.body.body=create.body.body.filter(n=>{
    if(n.type==='FunctionDeclaration'&&artHelpers.has(n.id.name))return false;
    if(n.type==='VariableDeclaration') {
      const names=n.declarations.map(d=>d.id.name);
      if(names.some(k=>['environment','light','fill','memoryRoot','memorySignature'].includes(k)))return false;
    }
    const s=statementText(n);
    if(s.startsWith('scene.background =')||s.startsWith('scene.fog =')||s.startsWith('scene.add(new THREE.HemisphereLight(')||s.startsWith('memoryRoot.name =')||s==='world.add(memoryRoot);')return false;
    return true;
  });
  const imports=tree.program.body.filter(n=>n.type==='ImportDeclaration');
  for(const n of imports)n.specifiers=n.specifiers.filter(s=>s.imported?.name!=='TOWN_BRAND');
  return tree;
}
check('remaining-scene-module-AST-equal-after-reviewed-art-node-removal',canonical(artProjection(sceneBefore))===canonical(artProjection(sceneInverse)));
const html=read(path.join(town,'day.html')), htmlBefore=read(path.join(__dirname,'source-before/day.html'));
let htmlInverse=html;
for(const [id,title]of[['settings','내 속도로 지내요'],['journal','함께한 일'],['reading','짧은 안내문 읽기'],['life','찻집 주인과']])htmlInverse=htmlInverse.replace(`<dialog id="${id}-dialog" aria-labelledby="${id}-title"><div class="dialog-head"><h2 id="${id}-title">${title}</h2>`,`<dialog id="${id}-dialog"><div class="dialog-head"><h2>${title}</h2>`);
check('HTML-only-four-dialog-label-connections',htmlInverse===htmlBefore);
const ui=JSON.parse(fs.readFileSync(path.join(__dirname,'ui-layout.json')));
check('current-UI-layout-source-hashes-match-passing-47-check-report',ui.passed&&ui.checks.length===47&&ui.sources.every(r=>r.sha256===hash(fs.readFileSync(path.join(town,r.name)))));
const assetCopies=ui.assetCopies.map(r=>({...r,current:hash(fs.readFileSync(path.join(town,'assets/ui',r.name))),sourceCurrent:hash(fs.readFileSync(path.resolve(town,'../..',r.source)))}));
check('three-new-UI-assets-are-exact-approved-copies',assetCopies.length===3&&assetCopies.every(r=>r.sha256===r.current&&r.current===r.sourceCurrent));
const portraitBaseline=JSON.parse(fs.readFileSync(path.join(__dirname,'portrait-before-hashes.json')));
const portraits=portraitBaseline.sources.map(r=>({name:r.name,path:r.source,before:r.sha256,snapshot:r.snapshot,snapshotSha256:hash(fs.readFileSync(path.join(__dirname,r.snapshot))),current:hash(fs.readFileSync(path.join(town,r.source)))}));
check('all-six-previous-procedural-portraits-preserved-exactly',portraits.length===6&&portraits.every(r=>r.before===r.snapshotSha256));
const approvedReference={path:'docs/캐릭터/교수연구실/research.png',before:'d874a8fd3e84ea442676fac1784865980f32a0ae4be4bed94e312e2b758d71f1'};
approvedReference.current=hash(fs.readFileSync(path.resolve(town,'../..',approvedReference.path)));
check('approved-professor-2D-reference-remains-unchanged',approvedReference.before===approvedReference.current);
const environmentModel=JSON.parse(fs.readFileSync(path.join(__dirname,'environment-model.json')));
check('final-environment-CPU-model-directly-matches-source',environmentModel.passed&&environmentModel.sha256===sources.find(r=>r.name==='day-environment.mjs').current);
const residentsModel=JSON.parse(fs.readFileSync(path.join(__dirname,'residents-model.json')));
check('resident-CPU-model-directly-matches-source',residentsModel.passed&&residentsModel.sourceSha256===sources.find(r=>r.name==='day-residents.mjs').current);
const replacedPortraitCount=portraits.filter(r=>r.current!==r.before).length;
const assetReview={separateFromProductSourceScope:true,felt:{change:'Three approved unchanged bitmap copies added to assets/ui.',count:3,bytes:assetCopies.reduce((n,r)=>n+r.bytes,0)},portraits:{change:'Six existing procedural portraits may be replaced with actual current Three model captures. These PNG assets are separate from the seven product source files.',captureState:replacedPortraitCount===6?'six-current-files-replaced':replacedPortraitCount===0?'awaiting-current-model-capture':'capture-replacement-in-progress',replacedPortraitCount,baselineManifest:'portrait-before-hashes.json',records:portraits,approvedReference},modelReports:{environment:{path:'environment-model.json',sourceSha256:environmentModel.sha256,triangles:environmentModel.stats.environmentTriangles},residents:{path:'residents-model.json',sourceSha256:residentsModel.sourceSha256}}};
async function memoryChecks(){
  const T=await import(pathToFileURL(path.resolve(town,'../synk-world-home/scene-assets/three.module.js')).href);
  const node=functions(ast(sceneCurrent)).find(n=>n.id.name==='updateMemories');
  const fn=sceneCurrent.slice(node.start,node.end), memoryRoot=new T.Group();
  const context={THREE:T,LOCATIONS:{home:1,cafe:1,workshop:1,greenhouse:1},memoryRoot,m:{cotton:{},lapis:{},coral:{},butter:{}},box:()=>{},tube:()=>{},releaseObjects:r=>r.clear()};
  vm.createContext(context);
  vm.runInContext(`let memorySignature='',memoryMarkers=[];${fn};globalThis.run=records=>{updateMemories(records);return JSON.parse(JSON.stringify(memoryMarkers));};`,context);
  const records=[{resultId:'observer',kind:'tea',role:'observer',choice:'sequence',location:'cafe'},{resultId:'alone',kind:'help',role:'planner',choice:'alone',location:'workshop'},{resultId:'',kind:'tea',role:'planner',location:'cafe'},{resultId:'unknown',kind:'reward',role:'planner',location:'home'},{resultId:'bad-place',kind:'tea',role:'planner',location:'elsewhere'}];
  const before=JSON.stringify(records), empty=context.run(records);
  check('memory-rejects-observer-alone-missing-result-unknown-kind-place',empty.length===0);
  check('memory-renderer-does-not-mutate-source-records',JSON.stringify(records)===before);
  const valid=[{resultId:'cafe-old',kind:'tea',role:'planner',choice:'sequence',location:'cafe'},{resultId:'workshop',kind:'help',role:'planner',choice:'hold',location:'workshop'},{resultId:'greenhouse',kind:'coordination',role:'delegated',choice:'delegate',location:'greenhouse'},{resultId:'cafe-new',kind:'tea',role:'delegated',choice:'sequence',location:'cafe'}];
  const displayed=context.run(valid);
  check('memory-keeps-latest-actual-participation-per-place',displayed.length===3&&displayed.some(h=>h.resultId==='cafe-new')&&!displayed.some(h=>h.resultId==='cafe-old'),displayed);
  check('memory-clears-on-empty-authoritative-history',context.run([]).length===0&&memoryRoot.children.length===0);
}
memoryChecks().then(()=>{
  check('all-source-hashes-stable-through-read-only-audit',sources.every(r=>r.current===hash(fs.readFileSync(path.resolve(town,r.name)))));
  const final=process.argv.includes('--final');
  const report={checkedAt:new Date().toISOString(),scope:'Read-only graphics-v8 source, normalized function and AST comparison plus CPU memory filtering. No product writes, GPU or live account actions.',finalized:final,pass:checks.every(c=>c.ok),checks,allowedProductChanges:[...allowed],changedProductSources:sources.filter(r=>!r.unchanged).map(r=>r.name),unchangedFrozenSourceCount:sources.filter(r=>r.unchanged).length,sources,logic,functionEvidence,assetCopies,sceneReview:{allowed:'Art palette, lighting/background, sculpted request/menu/cushion/bazaar props, memory display and art metrics only.',protected:'Exact normalized source and AST checks cover direct camera, occlusion, player pose, NPC interpolation, 60Hz frame/distance gait/stop/reduced-motion, WebGL fallback, appearance, dispose, plus all unchanged movement/server/avatar/rendering files.',memoryTruth:'Only completed state.day.history fields are copied for presentation; observer and help/alone excluded. This adds no reward, inventory, write, API or movement command. Completed delegated participation is remembered without claiming it was observed.',scopeLimit:'This source audit does not establish final world visual quality, real-device FPS, comfort, or public deployment. UI geometry was CPU-only; GPU validation belongs to root/QA.'}};
  report.assetReview=assetReview;
  fs.writeFileSync(path.join(__dirname,'guard.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({pass:report.pass,finalized:final,checks:checks.length,failed:checks.filter(c=>!c.ok),changed:report.changedProductSources}));
  if(!report.pass)process.exitCode=1;
}).catch(e=>{console.error(e);process.exitCode=1;});
