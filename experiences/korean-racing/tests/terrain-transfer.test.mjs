import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import * as THREE from '../vendor/three.module.js';
import {ROAD_END, pathX, pathY, pathAngle, noise, terrainColorAt} from '../course.js';
import {createLandscapeHeight} from '../landscape.js';
import {buildCourseTerrain, serializeCourseTerrain} from '../render-world.js';

const levels = ['near', 'mid', 'far'];
const groundHeight = createLandscapeHeight(pathX, pathY);
let generated, prepared, material;
test.before(() => {
  material = new THREE.MeshStandardMaterial({color: 0xaabbcc});
  generated = buildCourseTerrain(THREE, {pathX, groundHeight, ROAD_END, material, colorAt: terrainColorAt});
  prepared = serializeCourseTerrain(generated, ROAD_END);
});
test.after(() => {generated?.dispose(); material?.dispose();});

const meshes = world => world.group.userData.chunks.flatMap(chunk => levels.map(level => chunk.meshes[level]));
const bytes = array => Buffer.from(array.buffer, array.byteOffset, array.byteLength);

function sameGeometry(actual, expected) {
  assert.deepEqual(Object.keys(actual.attributes).sort(), Object.keys(expected.attributes).sort());
  for (const name of Object.keys(expected.attributes)) {
    assert.equal(actual.attributes[name].itemSize, expected.attributes[name].itemSize, name);
    assert.equal(actual.attributes[name].array.constructor, expected.attributes[name].array.constructor, name);
    assert(bytes(actual.attributes[name].array).equals(bytes(expected.attributes[name].array)), `${name} bytes changed`);
  }
  assert.equal(actual.index.array.constructor, expected.index.array.constructor);
  assert(bytes(actual.index.array).equals(bytes(expected.index.array)), 'triangle indices changed');
  assert.deepEqual(actual.userData.terrain, expected.userData.terrain);
  assert(actual.boundingBox.equals(expected.boundingBox));
  assert(actual.boundingSphere.equals(expected.boundingSphere));
}

test('shared course functions preserve the original scene road and terrain colour samples exactly', () => {
  // Freeze the pre-worker app formula independently of the new shared module.
  const originalHash = (x, z) => {const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123; return n - Math.floor(n);};
  const originalNoise = (x, z) => {
    const a = Math.floor(x), b = Math.floor(z), fx = x - a, fz = z - b;
    const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(originalHash(a,b), originalHash(a+1,b), u), THREE.MathUtils.lerp(originalHash(a,b+1), originalHash(a+1,b+1), u), v);
  };
  for (let z = -150; z <= ROAD_END + 350; z += 12.5) {
    assert.equal(pathX(z), Math.sin(z / 235) * 25 + Math.sin(z / 580) * 31);
    assert.equal(pathY(z), 23 + Math.sin(z / 280) * 2.8 + Math.sin(z / 100) * 1.2);
    assert.equal(pathAngle(z), Math.atan(Math.cos(z / 235) * 25 / 235 + Math.cos(z / 580) * 31 / 580));
    for (const offset of [-350, -7.1, 0, 7.1, 19.75, 170]) {
      const x = pathX(z) + offset, nx = x * .08, nz = z * .08;
      assert.equal(noise(nx, nz), originalNoise(nx, nz));
      const shade = .90 + (originalNoise(nx,nz)*.55 + originalNoise(nx*2,nz*2)*.28 + originalNoise(nx*4,nz*4)*.12 + originalNoise(nx*8,nz*8)*.05) * .20;
      assert.deepEqual(terrainColorAt(x,z), [shade,shade,shade]);
    }
  }
});

test('transferred geometry bypasses all sampling and preserves exact attributes, bounds, LOD and material ownership', () => {
  const unexpectedSample = () => {throw new Error('main-thread procedural sampling');};
  const result = buildCourseTerrain(THREE, {pathX: unexpectedSample, groundHeight: unexpectedSample, ROAD_END, material, colorAt: unexpectedSample, prepared});
  const actual = meshes(result), expected = meshes(generated);
  assert.equal(actual.length, 66);
  for (let i = 0; i < actual.length; i++) {
    sameGeometry(actual[i].geometry, expected[i].geometry);
    assert.equal(actual[i].material, material);
    assert.equal(actual[i].castShadow, false);
    assert.equal(actual[i].receiveShadow, true);
    assert.equal(actual[i].frustumCulled, true);
    for (const name of Object.keys(prepared.geometries[i].attributes)) {
      assert.equal(actual[i].geometry.attributes[name].array, prepared.geometries[i].attributes[name].array, 'received buffers must not be copied');
    }
  }
  assert.deepEqual(result.stats, generated.stats);
  const camera = new THREE.PerspectiveCamera(55, 1.6, .1, 2500);
  let time = 100;
  for (const quality of ['high', 'balanced', 'low']) for (const playerS of [0, 25, 500, 1250, 2240]) {
    camera.position.set(pathX(playerS), pathY(playerS) + 8, playerS - 12);
    camera.lookAt(pathX(playerS+80), pathY(playerS+80), playerS+80);
    const options = {playerS, quality, camera, time: time++};
    assert.deepEqual(result.update(options), generated.update(options));
    assert.deepEqual(actual.map(mesh => mesh.visible), expected.map(mesh => mesh.visible));
  }
  let geometryDisposals = 0, materialDisposals = 0;
  actual.forEach(mesh => mesh.geometry.addEventListener('dispose', () => geometryDisposals++));
  const onMaterialDispose = () => materialDisposals++;
  material.addEventListener('dispose', onMaterialDispose);
  result.dispose(); result.dispose();
  material.removeEventListener('dispose', onMaterialDispose);
  assert.equal(geometryDisposals, 66);
  assert.equal(materialDisposals, 0);
  assert.equal(result.group.children.length, 0);
  assert.equal(result.stats.submittedTriangles, 0);
  assert.equal(generated.group.children.length, 66, 'receiving scene disposal must not affect source geometry');
});

test('broken transfer headers, geometry attributes and bounds fail before scene allocation', () => {
  let allocations = 0;
  const guardedThree = {...THREE, Group: class extends THREE.Group {constructor() {super(); allocations++;}}};
  const cases = [
    data => {data.version = 0;},
    data => {data.roadEnd = ROAD_END + 1;},
    data => {data.geometries.pop();},
    data => {data.geometries[0].terrain.level = 'far';},
    data => {data.geometries[0].terrain.end++;},
    data => {delete data.geometries[0].attributes.normal;},
    data => {data.geometries[0].attributes.position.array = new Float64Array(3);},
    data => {data.geometries[0].attributes.uv.itemSize = 3;},
    data => {data.geometries[0].attributes.surface.array = new Float32Array(1);},
    data => {data.geometries[0].index = new Float32Array([0,1,2]);},
    data => {data.geometries[0].index = new Uint16Array([0,1]);},
    data => {data.geometries[0].box[0][0] = NaN;},
    data => {data.geometries[0].sphere[1] = 0;},
  ];
  for (const mutate of cases) {
    const invalid = structuredClone(prepared);
    mutate(invalid);
    assert.throws(() => buildCourseTerrain(guardedThree, {pathX, groundHeight, ROAD_END, material, prepared: invalid}), /Invalid prepared course terrain/);
  }
  assert.equal(allocations, 0);
});

test('the real worker module transfers exact geometry and relinquishes every source buffer', async () => {
  // Node supplies only the browser worker messaging surface. The real worker
  // module, road functions and pure terrain generator execute unchanged.
  const script = `
    const {parentPort,workerData}=require('node:worker_threads');
    globalThis.self={
      postMessage(value,transfers){
        parentPort.postMessage(value,transfers);
        if(transfers)parentPort.postMessage({detached:transfers.every(buffer=>buffer.byteLength===0),bufferCount:transfers.length});
      },
      close(){parentPort.close();}
    };
    import(workerData.url).then(()=>self.onmessage({data:{type:'build'}})).catch(error=>{throw error;});
  `;
  const worker = new Worker(script, {eval: true, workerData: {url: new URL('../terrain-worker.js', import.meta.url).href}});
  const messages = [];
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {worker.terminate(); reject(new Error('Terrain worker did not finish'));}, 15000);
    worker.on('message', message => messages.push(message));
    worker.on('error', error => {clearTimeout(timeout); reject(error);});
    worker.on('exit', code => {clearTimeout(timeout); code === 0 ? resolve() : reject(new Error(`Terrain worker exited ${code}`));});
  });
  assert.equal(messages.length, 2);
  assert.equal(messages[0].ok, true);
  assert(messages[0].computeMs > 0);
  assert.equal(messages[1].detached, true);
  assert.equal(messages[1].bufferCount, 66 * 6);
  const result = buildCourseTerrain(THREE, {pathX, groundHeight, ROAD_END, material, prepared: messages[0].terrain});
  const actual = meshes(result), expected = meshes(generated);
  for (let i = 0; i < actual.length; i++) sameGeometry(actual[i].geometry, expected[i].geometry);
  result.dispose();
});
