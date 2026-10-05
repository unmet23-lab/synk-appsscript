// Exact legacy-public/candidate terrain comparison, without a browser or Git mutation.
// node qa/release-20261005/verify-public-terrain-parity.mjs <release-worktree> <baseline-ref> [report.json]
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtemp, mkdir, readFile, writeFile, copyFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const [releaseInput, baselineRef, outputInput] = process.argv.slice(2);
if (!releaseInput || !baselineRef) throw new Error('Provide release worktree and immutable public baseline ref.');
const release = path.resolve(releaseInput), racing = path.join(release, 'try/racing');
const output = outputInput ? path.resolve(outputInput) : fileURLToPath(new URL('public-terrain-parity.json', import.meta.url));
const git = (...args) => execFileSync('git', ['-C', release, ...args], {encoding:'utf8', maxBuffer:8*1024*1024});
const baselineCommit = git('rev-parse', baselineRef).trim();
const legacy = name => git('show', `${baselineCommit}:try/racing/${name}`);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const normal = text => text.replace(/\r\n/g, '\n');
const allowed = ['app.js','course.js','landscape.js','render-world.js','terrain-data.js','terrain-startup.js','terrain-worker.js'];
const changed = git('diff', '--name-only', baselineCommit, '--', 'try/racing').trim().split('\n').filter(Boolean);
assert.deepEqual(changed.sort(), allowed.map(name => `try/racing/${name}`).sort());

// Reverse only the approved startup/terrain substitutions. Everything else in
// the candidate app must still be the exact current-public game implementation.
const originalApp = normal(legacy('app.js'));
let app = normal(await readFile(path.join(racing, 'app.js'), 'utf8'));
const replaceOnce = (before, after) => {
  assert.equal(app.split(before).length - 1, 1, `Expected one approved fragment: ${before.slice(0,90)}`);
  app = app.replace(before, after);
};
replaceOnce("import { ROAD_END, pathX, pathY, pathAngle, noise, terrainColorAt } from './course.js';\n", '');
replaceOnce("import { startTerrainBuild } from './terrain-startup.js';\n", '');
replaceOnce('const LANES = [-3.45, 0, 3.45];', 'const ROAD_END = 2250, LANES = [-3.45, 0, 3.45];');
const helpers = originalApp.slice(originalApp.indexOf('const hash ='), originalApp.indexOf('function roadPoint('));
replaceOnce('function roadPoint(', helpers + 'function roadPoint(');
replaceOnce('function setupTerrain(prepared) {', 'function setupTerrain() {');
const originalTerrainLine = originalApp.split('\n').find(line => line.includes('scenery.terrain=buildCourseTerrain('));
replaceOnce(`  const options={pathX,groundHeight,ROAD_END,material:coastalTerrainMaterial(),colorAt:terrainColorAt};
  if(prepared){
    try{scenery.terrain=buildCourseTerrain(THREE,{...options,prepared});}
    catch{startup.terrainSource='fallback';startup.terrainFallback='worker-data';}
  }
  if(!scenery.terrain)scenery.terrain=buildCourseTerrain(THREE,options);`, originalTerrainLine);
replaceOnce('  let draco,terrainBuild;', '  let draco;');
replaceOnce('    terrainBuild=startTerrainBuild();\n', '');
replaceOnce(`    startup.phase='terrain';
    const terrainWaitAt=performance.now(),terrainResult=await terrainBuild.result;
    startup.terrainWaitMs=Math.round(performance.now()-terrainWaitAt);
    startup.terrainSource=terrainResult.ok?'worker':'fallback';
    if(terrainResult.ok)startup.terrainWorkerMs=Math.round(terrainResult.computeMs);
    else startup.terrainFallback=terrainResult.reason;
    const terrainMainAt=performance.now();
    setupSky();setupTerrain(terrainResult.ok?terrainResult.terrain:undefined);setupWater(clearSky,goldenSky);
    startup.terrainMainMs=Math.round(performance.now()-terrainMainAt);`, "    startup.phase='terrain';setupSky();setupTerrain();setupWater(clearSky,goldenSky);");
replaceOnce('  finally{draco?.dispose();terrainBuild?.cancel();}', '  finally{draco?.dispose();}');
assert.equal(app, originalApp, 'Candidate changes game behavior outside the approved terrain startup patch.');

const temporaryRoot = path.resolve(await mkdtemp(path.join(tmpdir(), 'synk-public-terrain-parity-')));
const expectedParent = path.resolve(tmpdir());
assert.equal(path.dirname(temporaryRoot), expectedParent);
assert(path.basename(temporaryRoot).startsWith('synk-public-terrain-parity-'));
try {
  await mkdir(path.join(temporaryRoot, 'legacy'));
  await mkdir(path.join(temporaryRoot, 'candidate'));
  await mkdir(path.join(temporaryRoot, 'vendor'));
  await writeFile(path.join(temporaryRoot, 'package.json'), '{"type":"module"}');
  for (const name of ['three.module.js','three.core.js']) await copyFile(path.join(racing, 'vendor', name), path.join(temporaryRoot, 'vendor', name));
  for (const name of ['render-world.js','landscape.js']) await writeFile(path.join(temporaryRoot, 'legacy', name), legacy(name));
  for (const name of ['render-world.js','landscape.js','terrain-data.js','course.js']) await copyFile(path.join(racing, name), path.join(temporaryRoot, 'candidate', name));
  const moduleAt = relative => import(pathToFileURL(path.join(temporaryRoot, relative)).href);
  const [THREE, oldTerrain, oldLandscape, newTerrain, newLandscape, course] = await Promise.all([
    moduleAt('vendor/three.module.js'), moduleAt('legacy/render-world.js'), moduleAt('legacy/landscape.js'), moduleAt('candidate/render-world.js'), moduleAt('candidate/landscape.js'), moduleAt('candidate/course.js'),
  ]);
  // Original public app formula, independent of the newly shared course module.
  const pathX = s => Math.sin(s/235)*25 + Math.sin(s/580)*31;
  const pathY = s => 23 + Math.sin(s/280)*2.8 + Math.sin(s/100)*1.2;
  const hash = (x,z) => {const v=Math.sin(x*127.1+z*311.7)*43758.5453123;return v-Math.floor(v);};
  const noise = (x,z) => {const a=Math.floor(x),b=Math.floor(z),fx=x-a,fz=z-b,u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(a,b),hash(a+1,b),u),THREE.MathUtils.lerp(hash(a,b+1),hash(a+1,b+1),u),v);};
  const fbm = (x,z) => noise(x,z)*.55+noise(x*2,z*2)*.28+noise(x*4,z*4)*.12+noise(x*8,z*8)*.05;
  const colorAt = (x,z) => {const shade=.90+fbm(x*.08,z*.08)*.20;return [shade,shade,shade];};
  const material = new THREE.MeshBasicMaterial();
  const oldWorld = oldTerrain.buildCourseTerrain(THREE, {pathX, groundHeight:oldLandscape.createLandscapeHeight(pathX,pathY), ROAD_END:2250, material, colorAt});
  const newWorld = newTerrain.buildCourseTerrain(THREE, {pathX:course.pathX, groundHeight:newLandscape.createLandscapeHeight(course.pathX,course.pathY), ROAD_END:course.ROAD_END, material, colorAt:course.terrainColorAt});
  const signatures = world => {
    const geometry = createHash('sha256'), complete = createHash('sha256');
    for (const mesh of world.group.children) {
      for (const name of Object.keys(mesh.geometry.attributes).sort()) {
        const a = mesh.geometry.attributes[name].array, bytes = new Uint8Array(a.buffer,a.byteOffset,a.byteLength);
        geometry.update(bytes); complete.update(bytes);
      }
      const a = mesh.geometry.index.array, bytes = new Uint8Array(a.buffer,a.byteOffset,a.byteLength);
      geometry.update(bytes); complete.update(bytes);
      complete.update(JSON.stringify({box:[mesh.geometry.boundingBox.min.toArray(),mesh.geometry.boundingBox.max.toArray()], sphere:[mesh.geometry.boundingSphere.center.toArray(),mesh.geometry.boundingSphere.radius], terrain:mesh.geometry.userData.terrain}));
    }
    return {geometrySha256:geometry.digest('hex'), geometryBoundsMetadataSha256:complete.digest('hex')};
  };
  const original = signatures(oldWorld), candidate = signatures(newWorld);
  assert.deepEqual(candidate, original);
  assert.equal(newWorld.group.children.length, 66);
  const sources = {};
  for (const name of allowed) sources[name] = sha(await readFile(path.join(racing, name)));
  const report = {capturedAt:new Date().toISOString(), baselineCommit, releaseDirectory:release, method:'Immutable origin/main public render-world and landscape versus staged candidate, using the unchanged public THREE runtime. Compare every typed attribute/index byte and serialized exact bounds/row metadata across all 66 meshes. Reverse only approved app substitutions and require the remaining app to match the public baseline exactly.', ok:true, original, candidate, geometryCount:newWorld.group.children.length, storedTriangles:newWorld.stats.storedTriangles, storedVertices:newWorld.stats.storedVertices, unchangedGameplayOutsideTerrainPatch:true, changedRacingFiles:changed, baselineSources:{'app.js':sha(legacy('app.js')),'render-world.js':sha(legacy('render-world.js')),'landscape.js':sha(legacy('landscape.js'))}, candidateSources:sources};
  await writeFile(output, JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
  oldWorld.dispose(); newWorld.dispose(); material.dispose();
} finally {
  // The verified mkdtemp child is the only recursive cleanup target.
  await rm(temporaryRoot, {recursive:true, force:true});
}
