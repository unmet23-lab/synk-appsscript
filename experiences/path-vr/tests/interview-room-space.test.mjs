import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { createInterviewSpace, roomPlacement, projectRoomPoint, sideWallUv, ceilingSurfaceUv, wideWallCoverage, filmSurfacePoint, registeredWindowV, ROOM_SPACE } from '../interview/film/room-space.mjs';

async function makeSpace() {
  const parent = new THREE.Group(), textures = [], urls = [];
  const space = await createInterviewSpace(THREE, { parent, loadTexture: async (url) => { urls.push(url); const texture = new THREE.Texture(); textures.push(texture); return texture; } });
  return { space, parent, textures, urls };
}

test('room surrounds the seated origin at human floor, desk and ceiling heights', () => {
  const room = roomPlacement();
  assert.equal(room.floorY, -1.18);
  assert.ok(room.ceilingY > 1.4 && room.ceilingY < 1.6);
  assert.ok(room.tableY > -.5 && room.tableY < -.4);
  assert.ok(room.tableNearZ < -.3 && room.tableNearZ > -.6, 'desk is within natural seated reach');
  assert.ok(ROOM_SPACE.table.depth >= 1.6, 'desk must continue under the whole panel, not end as a narrow shelf');
  assert.ok(ROOM_SPACE.front < -3 && ROOM_SPACE.back > 2);
  assert.ok(room.horizontalFovDegrees > 70 && room.horizontalFovDegrees < 85);
  assert.equal(ROOM_SPACE.source.stereo, false);
  assert.equal(ROOM_SPACE.source.projection, 'rectilinear-mono');
});

test('full-depth table supports the folded film without hiding cups, notes or faces', async () => {
  const { space } = await makeSpace(); space.group.updateMatrixWorld(true);
  const table = space.group.getObjectByName('interview-table');
  const ray = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -.82, -ROOM_SPACE.film.distance).normalize());
  assert.equal(ray.intersectObject(table).length > 0, true);
  ray.ray.direction.set(0, .08, -ROOM_SPACE.film.distance).normalize();
  assert.equal(ray.intersectObject(table).length, 0);
  ray.ray.direction.set(0, -.52, -ROOM_SPACE.film.distance).normalize();
  const film = space.group.getObjectByName('pre-start-reference');
  const tableHit = ray.intersectObject(table)[0], filmHit = ray.intersectObject(film)[0];
  assert.ok(tableHit && filmHit && filmHit.distance < tableHit.distance, 'cups and notebooks must render above the full-depth desk with depth testing enabled');
  assert.equal(film.material.depthTest, true);
  assert.equal(table.material.userData.mapping, 'physical-plane-uv');
  for (const v of [.15, .25, .4, .7, 1]) for (const u of [0, .5, 1]) {
    const point = filmSurfacePoint(u, v), projected = projectRoomPoint(point).film;
    assert.ok(Math.abs(projected.u - u) < 1e-12 && Math.abs(projected.v - v) < 1e-12, 'folding must not move any original photographic ray');
    assert.ok(point.y >= space.placement.tableY + .008, 'film foreground must not intersect the wooden top');
  }
  for (const name of ['floor', 'ceiling', 'back-wall', 'left-wall', 'right-wall', 'applicant-chair', 'back-wall-photo']) assert.ok(space.group.getObjectByName(name), name);
  for (const name of ['oak-door', 'left-window-blinds', 'window-mullion']) assert.equal(space.group.getObjectByName(name), undefined, 'no duplicate photographed architectural features');
  space.dispose();
});

test('room uses same-project photographs without claiming a panorama or cabinet geometry depth', async () => {
  const { space, urls, textures } = await makeSpace();
  assert.equal(urls.length, 10);
  assert.ok(urls.every((url) => url.endsWith('-4k.jpg')), 'every loaded room photograph must use its 4K asset');
  const poster = space.group.getObjectByName('pre-start-reference').material;
  assert.equal(poster.map, textures[urls.findIndex((url) => url.endsWith('/room-poster-4k.jpg'))], 'the idle frame is separate from the architecture reference');
  assert.equal(urls.every((url) => url.includes('/assets/interview/')), true);
  assert.equal(urls.some((url) => /panorama|generated_images/i.test(url)), false);
  assert.equal(space.source.rearWall, 'generated-rectilinear-photo-on-wall');
  assert.equal(space.source.rearWallStereo, false);
  assert.equal(space.source.frontRoom, 'single-calibrated-camera-projection');
  assert.equal(space.source.wideExtension, true);
  assert.deepEqual(space.source.sideWalls, { left: 'physical-wall-uv', right: 'physical-wall-uv' });
  assert.equal(space.source.ceiling, 'dedicated-photo-on-physical-plane');
  assert.equal(space.group.getObjectByName('back-cabinet'), undefined);
  const photo = space.group.getObjectByName('back-wall-photo');
  assert.equal(photo.material.map.repeat.x, 1, 'the rear elevation has no mirrored duplicate window');
  assert.equal(photo.userData.projection, 'orthographic-wall-elevation');
  assert.equal(photo.userData.cabinetDepth, false);
  assert.equal(photo.material.map, textures[urls.findIndex((url) => url.endsWith('/back-wall-detail-4k.jpg'))]);
  assert.deepEqual(space.missingAssets, []);
  let triangles = 0;
  space.group.traverse((mesh) => { if (mesh.geometry) triangles += (mesh.geometry.index?.count || mesh.geometry.attributes.position.count) / 3 * (mesh.isInstancedMesh ? mesh.count : 1); });
  assert.ok(triangles < 2000, `Quest room geometry must remain small, got ${triangles}`);
  space.dispose();
});

test('poster and video share the same registered background, and room textures warm once before rendering', async () => {
  const { space, textures } = await makeSpace();
  const uploaded = [];
  await space.warmTextures({ initTexture(texture) { uploaded.push(texture); } });
  assert.deepEqual(uploaded, textures);
  for (const texture of textures) {
    assert.equal(texture.colorSpace, THREE.SRGBColorSpace);
    assert.equal(texture.minFilter, THREE.LinearMipmapLinearFilter);
    assert.equal(texture.generateMipmaps, true);
  }
  const compile = (name) => {
    const shader = { uniforms: {}, vertexShader: '#include <begin_vertex>', fragmentShader: '#include <map_fragment>\n#include <alphatest_fragment>' };
    space.group.getObjectByName(name).material.onBeforeCompile(shader); return shader;
  };
  const poster = compile('pre-start-reference'), live = compile('original-film-layer-0');
  assert.equal(poster.uniforms.filmReference, live.uniforms.filmReference);
  assert.equal(poster.fragmentShader, live.fragmentShader, 'starting must preserve the same room/wood edge blending');
  assert.notEqual(poster.uniforms.filmReference.value, space.group.getObjectByName('pre-start-reference').material.map);
  const desk = compile('interview-table'), floor = compile('floor');
  assert.notEqual(desk.uniforms.roomDesk.value, desk.uniforms.roomReference.value, 'desk has its dedicated 4K wood crop');
  assert.match(desk.fragmentShader, /vec2\(planeUv.x, 1.0 - planeUv.y\)/);
  assert.match(floor.fragmentShader, /vec2\(planeUv.x, carpetV\)/);
  space.dispose(); uploaded.length = 0;
  await space.warmTextures({ initTexture(texture) { uploaded.push(texture); } });
  assert.equal(uploaded.length, 0, 'disposed assets must not be reuploaded');
});

test('same two videos feed the room; idle photo is never substituted for a failed video', async () => {
  const { space } = await makeSpace();
  const reference = space.group.getObjectByName('pre-start-reference');
  space.update([], { phase: 'idle' }); assert.equal(reference.visible, true);
  space.update([], { phase: 'error' }); assert.equal(reference.visible, false);
  let callbacks = 0, cancelled = 0;
  const makeVideo = () => ({ readyState: 2, requestVideoFrameCallback() { callbacks++; return callbacks; }, cancelVideoFrameCallback() { cancelled++; } });
  const previous = makeVideo(), next = makeVideo();
  space.update([{ video: previous, opacity: 1 }, { video: next, opacity: .5 }], { phase: 'listening' });
  assert.equal(callbacks, 2);
  const layers = [0, 1].map((i) => space.group.getObjectByName(`original-film-layer-${i}`));
  assert.equal(layers[0].material.map.image, previous);
  assert.equal(layers[1].material.map.image, next);
  assert.equal(layers[1].material.opacity, .5);
  assert.equal(layers[0].material.depthTest, true);
  space.update([{ video: previous, opacity: 0 }, { video: next, opacity: 1 }], { phase: 'listening' });
  assert.equal(callbacks, 2, 'updates must not allocate new video textures');
  space.dispose(); assert.equal(cancelled, 2);
});

test('preparing preserves the seated poster until an actual visible decoded frame takes over', async () => {
  const { space } = await makeSpace();
  const reference = space.group.getObjectByName('pre-start-reference');
  const video = { readyState: 2, requestVideoFrameCallback() { return 1; }, cancelVideoFrameCallback() {} };
  space.update([], { phase: 'preparing' });
  assert.equal(reference.visible, true, 'entering preparation must not empty the interview chairs');
  space.update([{ video, opacity: 0 }], { phase: 'preparing' });
  assert.equal(reference.visible, true, 'decoded but hidden buffers are not a displayed performance');
  space.update([{ video, opacity: 1 }], { phase: 'preparing' });
  assert.equal(reference.visible, false, 'the first visible film replaces the poster before phase changes');
  assert.equal(space.group.getObjectByName('original-film-layer-0').visible, true);
  space.update([], { phase: 'error' });
  assert.equal(reference.visible, false, 'an error must still never masquerade as a working filmed performance');
  space.dispose();
});

test('opening the room after completion uploads the paused decoded film without waiting for another frame callback', async () => {
  const { space } = await makeSpace();
  let callbacks = 0, playCalls = 0;
  const video = {
    readyState: 2, paused: true, currentTime: 2.5, videoWidth: 3840, videoHeight: 2160,
    requestVideoFrameCallback() { return ++callbacks; }, cancelVideoFrameCallback() {},
    play() { playCalls++; return Promise.resolve(); },
  };
  space.update([{ video, opacity: 1 }], { phase: 'complete' });
  const layer = space.group.getObjectByName('original-film-layer-0');
  const texture = layer.material.map;
  assert.equal(layer.visible, true);
  assert.equal(texture.image, video);
  assert.equal(callbacks, 1, 'the paused film has not delivered another callback');
  assert.ok(texture.version > 0, 'the already decoded frame must be marked for its first GPU upload');
  assert.equal(space.group.getObjectByName('pre-start-reference').visible, false);
  const uploadVersion = texture.version;
  space.update([{ video, opacity: 1 }], { phase: 'complete' });
  assert.equal(layer.material.map, texture);
  assert.equal(texture.version, uploadVersion, 'an unchanged paused frame must not upload every render');
  assert.equal(playCalls, 0); assert.equal(video.currentTime, 2.5);
  space.dispose();
});

test('a completed session with cleared quality buffers restores the poster, while errors stay explicit', async () => {
  const { space } = await makeSpace();
  const reference = space.group.getObjectByName('pre-start-reference');
  const video = { readyState: 2, requestVideoFrameCallback() { return 1; }, cancelVideoFrameCallback() {} };
  space.update([{ video, opacity: 1 }], { phase: 'complete' });
  assert.equal(reference.visible, false);
  // Changing quality calls film.stop(), clearing its sources without changing
  // the completed session phase before the room preview is opened again.
  video.readyState = 0;
  space.update([{ video, opacity: 0 }], { phase: 'complete' });
  assert.equal(reference.visible, true);
  assert.equal(space.group.getObjectByName('original-film-layer-0').visible, false);
  space.update([], { phase: 'complete' }); assert.equal(reference.visible, true);
  space.update([], { phase: 'error' }); assert.equal(reference.visible, false);
  space.dispose();
});

test('decoded hidden video frames upload before first visibility and keep the same two textures', async () => {
  const { space } = await makeSpace();
  const uploaded = [];
  let callbacks = 0;
  const makeVideo = (src) => ({ src, readyState: 2, requestVideoFrameCallback() { return ++callbacks; }, cancelVideoFrameCallback() {} });
  const frames = [makeVideo('question.mp4'), makeVideo('listening.mp4')].map((video) => ({ video, opacity: 0 }));
  const layers = [0, 1].map((index) => space.group.getObjectByName(`original-film-layer-${index}`));
  space.update(frames, { phase: 'preparing' });
  assert.equal(await space.warmVideoFrames({ initTexture(texture) { uploaded.push(texture); } }, frames), true);
  assert.equal(uploaded.length, 2);
  assert.equal(callbacks, 2);
  for (const [index, layer] of layers.entries()) {
    assert.equal(layer.visible, false, 'warming must not expose a hidden first frame');
    assert.equal(layer.material.map, uploaded[index]);
    assert.equal(layer.material.map.image, frames[index].video);
    assert.equal(layer.material.map.isVideoTexture, true, 'compileAsync must see the real video shader variant');
    assert.ok(layer.material.map.version > 0, 'paused decoded frames must be marked for upload without another callback');
  }
  space.update([{ ...frames[0], opacity: 1 }, frames[1]], { phase: 'question' });
  assert.equal(callbacks, 2, 'first display must reuse the already prepared textures');
  assert.equal(layers[0].visible, true);
  assert.equal(layers[1].visible, false);
  assert.equal(layers[0].material.map, uploaded[0]);
  space.dispose();
});

test('video warmup skips missing decoded data and stops if a source is replaced or the room closes', async () => {
  for (const cancel of ['source', 'close', 'dispose']) {
    const { space } = await makeSpace();
    const videos = [0, 1].map((index) => ({ src: `${index}.mp4`, readyState: 2, requestVideoFrameCallback() { return 1; }, cancelVideoFrameCallback() {} }));
    let uploads = 0;
    assert.equal(await space.warmVideoFrames({ initTexture() { uploads++; } }, [{ video: { readyState: 1 }, opacity: 0 }]), false);
    const warmed = await space.warmVideoFrames({ initTexture() {
      uploads++;
      if (cancel === 'source') videos[0].src = 'replacement.mp4';
      else if (cancel === 'close') space.update([], {});
      else space.dispose();
    } }, videos.map((video) => ({ video, opacity: 0 })));
    assert.equal(warmed, false);
    assert.equal(uploads, 1, `${cancel} must stop the second pending upload`);
    assert.equal(space.group.getObjectByName('original-film-layer-0').visible, false);
    space.dispose();
  }
});

test('disposal releases photographic textures once and removes the whole set', async () => {
  const { space, parent, textures } = await makeSpace();
  let disposed = 0; textures.forEach((texture) => texture.addEventListener('dispose', () => disposed++));
  space.dispose(); space.dispose();
  assert.equal(disposed, 10); assert.equal(parent.children.length, 0);
});

test('one projector preserves the film corners and follows the same ray across different room surfaces', async () => {
  const f = ROOM_SPACE.film, p = roomPlacement();
  const corner = projectRoomPoint({ x: -f.width / 2, y: p.filmTopY, z: -f.distance });
  assert.ok(Math.abs(corner.film.u) < 1e-12); assert.ok(Math.abs(corner.film.v - 1) < 1e-12);
  const a = { x: .8, y: .2, z: -1.79 }, b = { x: 1.6, y: .4, z: -3.58 };
  assert.deepEqual(projectRoomPoint(a).film, projectRoomPoint(b).film);
  assert.deepEqual(projectRoomPoint(a).extension, projectRoomPoint(b).extension);
  assert.equal(projectRoomPoint({ x: 1, y: 1, z: 0 }), null);
  const { space } = await makeSpace();
  for (const name of ['front-wall', 'left-wall', 'right-wall', 'ceiling', 'interview-table']) {
    const mesh = space.group.getObjectByName(name);
    assert.equal(mesh.material.userData.cameraProjected, true);
    assert.ok(mesh.geometry.attributes.roomPosition);
  }
  space.dispose();
});

test('missing extension reports the exact asset and keeps neutral room geometry without replacing an active film by still people', async () => {
  const space = await createInterviewSpace(THREE, { parent: new THREE.Group(), loadTexture: async (url) => {
    if (url.endsWith('/front-room-extension-4k.jpg')) throw new Error('missing');
    return new THREE.Texture();
  } });
  assert.deepEqual(space.missingAssets, ['room/front-room-extension-4k.jpg']);
  assert.equal(space.source.frontRoom, 'neutral-geometry-fallback');
  assert.equal(space.source.wideExtension, false);
  assert.equal(space.group.getObjectByName('front-wall').material.map, null);
  space.update([], { phase: 'error' });
  assert.equal(space.group.getObjectByName('pre-start-reference').visible, false);
  space.dispose();
});

test('side-wall coordinates remain bounded and continuous through 90 degree and rearward head directions', () => {
  const halfWidth = ROOM_SPACE.width / 2;
  for (const side of ['left', 'right']) {
    const samples = [45, 60, 89.99, 90, 90.01, 120, 135].map((degrees) => {
      const angle = degrees * Math.PI / 180;
      const z = -halfWidth / Math.tan(angle);
      return sideWallUv({ y: 0, z }, side);
    });
    for (const uv of samples) {
      assert.ok(Number.isFinite(uv.u) && Number.isFinite(uv.v));
      assert.ok(uv.u > 0 && uv.u < 1, 'side and rear samples must use interior photographic pixels');
      assert.ok(uv.v > 0 && uv.v < 1);
    }
    assert.ok(Math.abs(samples[2].u - samples[4].u) < .0002, 'crossing z=0 must not jump or hit an image edge');
    for (let i = 1; i < samples.length; i++) assert.ok(samples[i].u > samples[i - 1].u, 'new wall pixels remain available as the viewer looks backwards');
    assert.ok(Math.abs(sideWallUv({ y: -ROOM_SPACE.eyeHeight, z: ROOM_SPACE.back }, side).u - 1) < 1e-6);
  }
});

test('dedicated ceiling covers the physical plane once with its front and window edges in the correct direction', async () => {
  const halfWidth = ROOM_SPACE.width / 2;
  assert.deepEqual(ceilingSurfaceUv({ x: -halfWidth, z: ROOM_SPACE.front }), { u: 0, v: 1 });
  assert.deepEqual(ceilingSurfaceUv({ x: halfWidth, z: ROOM_SPACE.front }), { u: 1, v: 1 });
  assert.deepEqual(ceilingSurfaceUv({ x: -halfWidth, z: ROOM_SPACE.back }), { u: 0, v: 0 });
  assert.deepEqual(ceilingSurfaceUv({ x: halfWidth, z: ROOM_SPACE.back }), { u: 1, v: 0 });
  for (const z of [ROOM_SPACE.front, -1, -.0001, 0, .0001, 1, ROOM_SPACE.back]) {
    const uv = ceilingSurfaceUv({ x: 0, z });
    assert.equal(uv.u, .5);
    assert.ok(Number.isFinite(uv.v) && uv.v >= 0 && uv.v <= 1, 'overhead and rearward pixels stay finite without repeating the ceiling');
  }
  const before = ceilingSurfaceUv({ x: 0, z: -.0001 });
  const after = ceilingSurfaceUv({ x: 0, z: .0001 });
  assert.ok(Math.abs(before.v - after.v) < .0001, 'ceiling has no projection discontinuity above the viewer');
  const { space, textures, urls } = await makeSpace();
  const shader = { uniforms: {}, vertexShader: '#include <begin_vertex>', fragmentShader: '#include <map_fragment>' };
  space.group.getObjectByName('ceiling').material.onBeforeCompile(shader);
  assert.equal(shader.uniforms.roomCeiling.value, textures[urls.findIndex((url) => url.endsWith('/ceiling-detail-4k.jpg'))]);
  assert.notEqual(shader.uniforms.roomCeiling.value, shader.uniforms.roomWide.value, 'ceiling detail must come from the full plane asset rather than the small wide-photo crop');
  assert.equal(shader.uniforms.roomCeilingReady.value, 1);
  assert.match(shader.fragmentShader, /texture2D\(roomCeiling, vec2\(planeUv.x, 1.0 - planeUv.y\)\)/);
  space.dispose();
});

test('missing ceiling detail falls back to its registered wide photograph independently of the side walls', async () => {
  for (const missingWide of [false, true]) {
    const space = await createInterviewSpace(THREE, { parent: new THREE.Group(), loadTexture: async (url) => {
      if (url.endsWith('/ceiling-detail-4k.jpg') || missingWide && url.endsWith('/front-room-wide-4k.jpg')) throw new Error('missing');
      return new THREE.Texture();
    } });
    assert.equal(space.source.ceiling, missingWide ? 'neutral-geometry-fallback' : 'rectified-photo-on-physical-plane');
    assert.deepEqual(space.missingAssets, [...(missingWide ? ['room/front-room-wide-4k.jpg'] : []), 'room/ceiling-detail-4k.jpg']);
    assert.deepEqual(space.source.sideWalls, { left: 'physical-wall-uv', right: 'physical-wall-uv' });
    const shader = { uniforms: {}, vertexShader: '#include <begin_vertex>', fragmentShader: '#include <map_fragment>' };
    space.group.getObjectByName('ceiling').material.onBeforeCompile(shader);
    assert.equal(shader.uniforms.roomCeilingReady.value, 0);
    assert.equal(shader.uniforms.roomWideReady.value, missingWide ? 0 : 1);
    assert.match(shader.fragmentShader, /else if \(roomWideReady > 0.5\)/);
    space.dispose();
  }
});

test('wide photograph ceiling pixels cannot paint bright triangles onto the side walls', async () => {
  // Samples straddling the visible left-wall defect in room-detail-ceiling.png.
  assert.equal(wideWallCoverage({ u: .217, v: .81 }, 'left'), 0, 'old ceiling above the window belongs to the physical ceiling');
  assert.equal(wideWallCoverage({ u: .217, v: .77 }, 'left'), 1, 'the adjacent photographed blind remains registered');
  assert.equal(wideWallCoverage({ u: .8, v: .90 }, 'right'), 0);
  assert.equal(wideWallCoverage({ u: .8, v: .86 }, 'right'), 1);
  assert.equal(wideWallCoverage({ u: .217, v: .81 }, 'front'), 1, 'front image registration is unchanged');
  const edgeV = ROOM_SPACE.sides.left.wideCeilingLine.intercept + ROOM_SPACE.sides.left.wideCeilingLine.slope * .217;
  const feather = [edgeV - .004, edgeV - .003, edgeV - .002, edgeV - .001, edgeV, edgeV + .001].map((v) => wideWallCoverage({ u: .217, v }, 'left'));
  for (let i = 1; i < feather.length; i++) assert.ok(feather[i] <= feather[i - 1], 'fixed photographic boundary fades continuously');
  const { space } = await makeSpace();
  for (const name of ['left-wall', 'right-wall', 'front-wall', 'ceiling']) {
    const shader = { uniforms: {}, vertexShader: '#include <begin_vertex>', fragmentShader: '#include <map_fragment>' };
    space.group.getObjectByName(name).material.onBeforeCompile(shader);
    assert.equal(shader.fragmentShader.includes('wideCoverage *= 1.0 - smoothstep(wideCeilingV'), ['left-wall', 'right-wall'].includes(name), 'mask applies to side wide-photo projection only');
  }
  space.dispose();
});

test('physical room corners align with the photographed rear corner rays and side joins use the matching upright features', () => {
  const p = roomPlacement();
  const left = projectRoomPoint({ x: -ROOM_SPACE.width / 2, y: p.ceilingY, z: ROOM_SPACE.front }).extension;
  const right = projectRoomPoint({ x: ROOM_SPACE.width / 2, y: p.ceilingY, z: ROOM_SPACE.front }).extension;
  assert.ok(Math.abs(left.u - 393 / 1672) < .015);
  assert.ok(Math.abs(left.v - (1 - 111 / 941)) < .015);
  assert.ok(Math.abs(right.u - 1304 / 1672) < .015);
  assert.ok(Math.abs(right.v - (1 - 96 / 941)) < .015);
  assert.ok(Math.abs(sideWallUv({ y: 0, z: ROOM_SPACE.sides.left.joinZ }).u - .276) < .002, 'join on the window mullion');
  assert.ok(Math.abs(sideWallUv({ y: 0, z: ROOM_SPACE.sides.right.joinZ }, 'right').u - .272) < .002, 'the new right image starts beyond its door frame');
  assert.equal(registeredWindowV(0), 0); assert.equal(registeredWindowV(1), 1);
  assert.equal(registeredWindowV(.322), .329); assert.equal(registeredWindowV(.584), .562);
});

test('missing side photographs degrade independently while loaded surfaces and video remain available', async () => {
  const space = await createInterviewSpace(THREE, { parent: new THREE.Group(), loadTexture: async (url) => {
    if (url.endsWith('/left-wall-detail-4k.jpg')) throw new Error('missing');
    return new THREE.Texture();
  } });
  assert.deepEqual(space.missingAssets, ['room/left-wall-detail-4k.jpg']);
  assert.equal(space.source.sideWalls.left, 'neutral-geometry-fallback');
  assert.equal(space.source.sideWalls.right, 'physical-wall-uv');
  assert.equal(space.source.frontRoom, 'single-calibrated-camera-projection');
  for (const name of ['ceiling', 'floor']) assert.equal(space.group.getObjectByName(name).material.userData.mapping, 'physical-plane-uv');
  space.dispose();
});
