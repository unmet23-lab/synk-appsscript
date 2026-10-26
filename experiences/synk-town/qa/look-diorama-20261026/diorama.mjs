// 디오라마 그래픽 시안 (2026-10-26, 팁 장부 28·29행) — 마을을 「손에 드는 한 덩어리」로 다시 그린다.
// 구운 빛 · 텍스처 · GLB 없이 코드의 형태와 꼭짓점 색만 쓰고, 빛은 Town의 실시간 해 하나(W7 시간대 빛과 비)를 그대로 받는다.
// 걷기 경계 · 충돌 · 바닥 높이 · 클릭 대상 · 이름표 · 주민 · 소품은 원래 Town 것이다: 원래 메시는 숨기기만 한다.
// 바닥 길 · 마당 · 디딤돌 · 연못 자리와 화단 자리는 원래 마을에서 그대로 읽어 새 재질로 다시 입힌다.
import { createKit } from './diorama-parts.mjs';
import { TOWN_LAYOUT, layoutWorldPoint } from '/town-layout.mjs';
import { PLACE_BY_ID } from '/town/places.mjs';

const PAL = {
  grass: '#9dbf7f', grassDeep: '#7ea66d', grassSun: '#bcd393', meadow: '#cdd79a', turf: '#6f9461',
  soil: '#8f6b4b', soilDeep: '#6e523b', clay: '#b08a60', rock: '#827669', rockDark: '#5d544b', base: '#4a423b',
  paving: '#ede6d7', mortar: '#d0c6b4', gravel: '#e6d5b3', edgeStone: '#f5f0e5', pondSoil: '#9b8566',
  plaster: '#f7f4ed', cafePlaster: '#f8f1e4', shopPlaster: '#f1f2ec', wood: '#b07c4f', woodLight: '#d8a873', woodDark: '#6c4a33', maru: '#dcab6f', apron: '#5b4434',
  tile: '#3a4968', tileLight: '#56698d', mortarWhite: '#f3f0e7', rafter: '#b9885c', roofEdge: '#34415a', shopTile: '#465a6a', shopTileLight: '#61788a',
  stone: '#d2c9b8', coral: '#ee7f6b', coralLight: '#f8b4a2', lapis: '#4a6fc4', butter: '#f5c445', frame: '#6f8f83', ceramic: '#f4ecd9',
  leaf: '#6f9a5e', leafLight: '#a9c97d', leafDeep: '#4b774c', blossom: '#f2b4c4', blossomLight: '#fcdde5', trunk: '#8a6446',
  water: '#7cc6c6', waterDeep: '#4b97a6', foam: '#f6fbf8', sky: '#e4edf0', skyLow: '#f5efe4',
};

export function applyDiorama({ THREE, world, buildings, renderer, phone = false, onAttach = null, replaceVolume = null }) {
  const started = performance.now();
  const kit = createKit(THREE), { softBox, cylinder, blob, slab, tube, place, paint, grounded, rng, noise, smooth, hanokRoof, batcher } = kit;
  const detail = phone ? .5 : 1, rand = rng(26102026);
  const flat = TOWN_LAYOUT.ground.flatBounds, GROUND_Y = TOWN_LAYOUT.ground.rootY + TOWN_LAYOUT.ground.localY;
  const state = { name: 'diorama', look: true, loaded: false, failed: null, meshes: 0, triangles: 0, textures: [], textureBytes: 0, downloadBytes: 0, buildMs: null, hiddenV20Meshes: 0, keptV20: [] };

  // ── materials: one per surface kind, colour from the vertices ──
  const std = (o = {}) => new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: .9, metalness: 0, ...o });
  const radial = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 31);
    g.addColorStop(0, '#fff'); g.addColorStop(.55, '#777'); g.addColorStop(1, '#000'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t;
  })();
  const mats = {
    ground: std({ roughness: .97 }), path: std({ roughness: .9 }), side: std({ roughness: 1 }),
    wall: std({ roughness: .9 }), wood: std({ roughness: .74 }), roof: std({ roughness: .55 }), leaf: std({ roughness: .86 }),
    cloth: std({ roughness: .96, side: THREE.DoubleSide }),
    lantern: std({ roughness: .5, emissive: new THREE.Color(PAL.butter), emissiveIntensity: .08 }),
    glass: new THREE.MeshStandardMaterial({ color: '#cfe4e2', roughness: .06, metalness: 0, transparent: true, opacity: .3, depthWrite: false }),
    thinGlass: new THREE.MeshStandardMaterial({ color: '#d9ece8', roughness: .05, metalness: 0, transparent: true, opacity: .16, depthWrite: false, side: THREE.DoubleSide }),
    water: std({ roughness: .1, transparent: true, opacity: .93 }),
    pool: new THREE.MeshLambertMaterial({ color: '#000000', emissive: new THREE.Color('#7a5526'), emissiveIntensity: 0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, alphaMap: radial }),
    stone: new THREE.MeshStandardMaterial({ color: '#e9e1d2', roughness: .88 }),
  };
  mats.ground.userData.townGround = mats.path.userData.townGround = mats.stone.userData.townGround = true;
  mats.roof.userData.townSurface = 'roof';
  mats.glass.userData.townGlass = mats.thinGlass.userData.townGlass = true;
  mats.lantern.userData.townLantern = mats.pool.userData.townLantern = true;
  for (const [key, m] of Object.entries(mats)) m.name = `diorama-${key}`;

  // ── read what the approved town already decided (paths, stones, pond, planting), then hide it ──
  world.updateMatrixWorld(true);
  const landscape = world.children.find(c => c.name === 'town-landscape');
  const harvest = { paths: [], stones: [], pond: null, pondSoil: null, leaves: [], flowers: [] };
  const m4 = new THREE.Matrix4(), v3 = new THREE.Vector3(), c3 = new THREE.Color();
  const insideFlat = (x, z) => x > flat.minX && x < flat.maxX && z > flat.minZ && z < flat.maxZ;
  // Rain darkens the walkable materials before this runs (W7): name them by hue (colour over its brightest channel), not by value.
  const KINDS = ['eef0ed', 'b8beb5', 'd8ceba', 'ffffff'].map(hex => { const c = new THREE.Color(`#${hex}`), m = Math.max(c.r, c.g, c.b); return { hex, r: c.r / m, g: c.g / m, b: c.b / m }; });
  const kindOf = c => { const m = Math.max(c.r, c.g, c.b) || 1; let best = null, dist = .02; for (const k of KINDS) { const d = Math.hypot(c.r / m - k.r, c.g / m - k.g, c.b / m - k.b); if (d < dist) { dist = d; best = k.hex; } } return best; };
  landscape?.traverse(o => {
    if (!o.isMesh) return;
    const mat = [o.material].flat()[0], hex = mat?.color?.getHexString(), ground = !!mat?.userData?.townGround, kind = ground && !mat.vertexColors ? kindOf(mat.color) : null;
    if (!o.isInstancedMesh) {
      if (kind) harvest.paths.push({ g: o.geometry.clone().applyMatrix4(o.matrixWorld), hex: kind });
      else if (hex === '709da0') harvest.pond = o.geometry.clone().applyMatrix4(o.matrixWorld);
      else if (hex === '66553e') harvest.pondSoil = o.geometry.clone().applyMatrix4(o.matrixWorld);
      return;
    }
    o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox, size = b.getSize(v3).toArray();
    if (ground) { harvest.stones.push(o); return; }
    const leafLike = Math.abs(size[1] - 1) < .05 && size[0] > .3 && size[0] < .5, headLike = Math.abs(size[0] - 2) < .05 && Math.abs(size[1] - .16) < .03;
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, m4); m4.premultiply(o.matrixWorld); v3.setFromMatrixPosition(m4);
      if (!insideFlat(v3.x, v3.z) || v3.y > 1.2) continue;
      if (leafLike && v3.y > .12 && !(v3.x > 3.4 && v3.x < 7.3 && v3.z > -6.9 && v3.z < -4.3)) harvest.leaves.push([v3.x, v3.y, v3.z]);
      else if (headLike) { if (o.instanceColor) o.getColorAt(i, c3); else c3.set('#ffffff'); harvest.flowers.push([v3.x, v3.y, v3.z, c3.getHex()]); }
    }
  });
  if (landscape) landscape.visible = false;
  const hidden = [], layered = [];
  for (const building of buildings) building.traverse(o => { if (o.isMesh && !o.isSprite) { o.visible = false; hidden.push(o); } });
  const houses = world.children.filter(c => c.userData.neighbourhoodHouse);
  for (const house of houses) house.traverse(o => { if (o.isMesh && !o.isSprite) { layered.push([o, o.layers.mask]); o.layers.set(31); } });
  const trees = world.children.filter(c => /^town-tree-/.test(c.name));
  for (const tree of trees) tree.visible = false;
  state.hiddenV20Meshes = hidden.length + layered.length;
  state.keptV20 = world.children.filter(c => /^town-street-/.test(c.name)).map(c => c.name);

  const root = new THREE.Group(); root.name = 'town-diorama'; world.add(root);
  const containers = [root];

  // ── the block: a flat lawn cut clean at the town's edge, with soil and stone in section ──
  const B = batcher();
  const footprints = [...Object.values(PLACE_BY_ID).filter(p => p.player).map(p => ({ x: p.center.x, z: p.center.z - .8, hw: 2.4, hd: 2.2 })),
    ...TOWN_LAYOUT.houses.map(h => ({ x: h.x, z: h.z, hw: h.width / 2 + .35, hd: h.depth / 2 + .35 }))];
  const contact = (x, z) => {
    let d = 9;
    for (const f of footprints) d = Math.min(d, Math.max(Math.abs(x - f.x) - f.hw, Math.abs(z - f.z) - f.hd));
    for (const t of TOWN_LAYOUT.trees) d = Math.min(d, Math.hypot(x - t.x, z - t.z) - .25);
    return 1 - .2 * Math.exp(-Math.max(0, d) / .55);
  };
  const W = flat.maxX - flat.minX, D = flat.maxZ - flat.minZ, cx = (flat.minX + flat.maxX) / 2, cz = (flat.minZ + flat.maxZ) / 2;
  {
    const top = new THREE.PlaneGeometry(W, D, Math.round(W * 2 * detail), Math.round(D * 2 * detail)); top.rotateX(-Math.PI / 2); top.translate(cx, GROUND_Y, cz);
    const g = kit.indexed(top), cDeep = kit.color(PAL.grassDeep), cMid = kit.color(PAL.grass), cSun = kit.color(PAL.grassSun), cMeadow = kit.color(PAL.meadow), out = new THREE.Color();
    paint(g, (x, y, z) => {
      const patch = .5 + .5 * noise(x * .23, 0, z * .21, 3), fleck = .5 + .5 * noise(x * 1.9, 1, z * 1.7, 9);
      const meadow = Math.max(Math.exp(-(((x + 17) / 6) ** 2 + ((z - 1) / 7) ** 2)), Math.exp(-(((x - 17) / 6) ** 2 + ((z + 4) / 6) ** 2)), Math.exp(-(((x - 4) / 9) ** 2 + ((z - 8) / 2.5) ** 2)));
      out.copy(cDeep).lerp(cMid, .35 + .5 * patch).lerp(cSun, fleck * .22).lerp(cMeadow, meadow * .55);
      return out.multiplyScalar(contact(x, z));
    });
    B.add('ground', g);
    // Four cut faces. The top row meets the lawn exactly; lower rows wobble a little, like a cut through earth.
    const bottom = -2.1, rows = Math.round(16 * detail) + 6;
    const layers = (u, y) => {
      const lip = -.06 + .025 * noise(u * 2.1, 0, 0, 1), top = -.78 + .12 * noise(u * .6, 2, 0, 2), mid = -1.38 + .14 * noise(u * .45, 4, 0, 3);
      if (y > lip) return kit.color(PAL.turf).multiplyScalar(.92 + .08 * noise(u * 9, y * 9, 0, 4));
      if (y > top) return kit.color(PAL.soil).lerp(kit.color(PAL.soilDeep), smooth(lip, top, y) * .7).multiplyScalar(.93 + .1 * noise(u * 6, y * 7, 0, 5));
      if (y > mid) return kit.color(PAL.clay).multiplyScalar(.9 + .1 * noise(u * 4, y * 8, 0, 6));
      return kit.color(PAL.rock).lerp(kit.color(PAL.rockDark), .5 + .5 * noise(u * 1.3, y * 2.6, 0, 7)).lerp(kit.color(PAL.base), smooth(-1.7, bottom, y) * .6);
    };
    const side = (ax, az, bx, bz, nx, nz) => {
      const len = Math.hypot(bx - ax, bz - az), cols = Math.round(len * 2.2 * detail) + 4, pos = [], col = [], idx = [];
      for (let i = 0; i <= cols; i++) for (let j = 0; j <= rows; j++) {
        const s = i / cols, y = GROUND_Y - (GROUND_Y - bottom) * Math.pow(j / rows, 1.25), u = s * len + ax * .3 + az * .7;
        const push = j === 0 ? 0 : .045 * (.5 + .5 * noise(u * 1.4, y * 1.8, 0, 11)) + (y < -1.38 ? .03 : 0);
        const x = ax + (bx - ax) * s + nx * push, z = az + (bz - az) * s + nz * push;
        pos.push(x, y, z); const c = layers(u, y); col.push(c.r, c.g, c.b);
      }
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { const q = i * (rows + 1) + j, r = q + rows + 1; idx.push(q, r + 1, r, q, q + 1, r + 1); }
      const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); sg.setIndex(idx); sg.computeVertexNormals();
      sg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); B.add('side', sg);
      // Pebbles half sunk in the soil and stone bands.
      for (let k = 0; k < Math.round(len * 1.1 * detail); k++) {
        const s = rand(), y = -.25 - rand() * 1.7, r = .05 + rand() * .11, x = ax + (bx - ax) * s, z = az + (bz - az) * s;
        B.add('side', paint(place(blob(r, 1, k + len, .22, .7), { p: [x + nx * r * .25, y, z + nz * r * .25] }), kit.color(PAL.stone).multiplyScalar(.72 + rand() * .3)));
      }
    };
    side(flat.minX, flat.maxZ, flat.maxX, flat.maxZ, 0, 1);   // front (+z)
    side(flat.maxX, flat.maxZ, flat.maxX, flat.minZ, 1, 0);   // right
    side(flat.maxX, flat.minZ, flat.minX, flat.minZ, 0, -1);  // back
    side(flat.minX, flat.minZ, flat.minX, flat.maxZ, -1, 0);  // left
    const under = new THREE.PlaneGeometry(W + .1, D + .1); under.rotateX(Math.PI / 2); under.translate(cx, bottom - .01, cz);
    B.add('side', paint(kit.indexed(under), PAL.base));
    // The block's shadow on the table it stands on (only the overview sees it).
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.7, D * 1.8), new THREE.MeshBasicMaterial({ color: '#2a3029', transparent: true, opacity: .34, alphaMap: radial, depthWrite: false, fog: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.set(cx + 4, bottom - .9, cz - 1.5); shadow.name = 'diorama-table-shadow'; root.add(shadow);
  }

  // ── paths, court, joints: the approved shapes, new colours ──
  const pathColour = { eef0ed: PAL.paving, b8beb5: PAL.mortar, d8ceba: PAL.gravel, ffffff: PAL.edgeStone };
  // The shared court (the widest paving piece) gets real stones laid in running bond; its painted joint arcs give way to them.
  const court = harvest.paths.filter(p => p.hex === 'eef0ed').map(p => { p.g.computeBoundingBox(); return { p, b: p.g.boundingBox, area: (p.g.boundingBox.max.x - p.g.boundingBox.min.x) * (p.g.boundingBox.max.z - p.g.boundingBox.min.z) }; })
    .filter(c => c.b.max.z - c.b.min.z < 6).sort((a, b) => b.area - a.area)[0];
  if (court) {
    const b = court.b, cell = .2, gx = Math.ceil((b.max.x - b.min.x) / cell) + 1, gz = Math.ceil((b.max.z - b.min.z) / cell) + 1, inside = new Uint8Array(gx * gz);
    const g = court.p.g, p = g.attributes.position, ix = g.index.array, A = new THREE.Vector3(), Bv = new THREE.Vector3(), C = new THREE.Vector3();
    for (let t = 0; t < ix.length; t += 3) {
      A.fromBufferAttribute(p, ix[t]); Bv.fromBufferAttribute(p, ix[t + 1]); C.fromBufferAttribute(p, ix[t + 2]);
      const n = Math.ceil(Math.max(A.distanceTo(Bv), A.distanceTo(C), Bv.distanceTo(C)) / (cell * .5)) + 1;
      for (let u = 0; u <= n; u++) for (let v = 0; v <= n - u; v++) { const w = 1 - (u + v) / n, x = A.x * w + Bv.x * u / n + C.x * v / n, z = A.z * w + Bv.z * u / n + C.z * v / n;
        const i = Math.floor((x - b.min.x) / cell), j = Math.floor((z - b.min.z) / cell); if (i >= 0 && j >= 0 && i < gx && j < gz) inside[j * gx + i] = 1; }
    }
    const ok = (x, z) => { for (const [dx, dz] of [[-.3, -.24], [.3, -.24], [-.3, .24], [.3, .24], [0, 0]]) { const i = Math.floor((x + dx - b.min.x) / cell), j = Math.floor((z + dz - b.min.z) / cell); if (i < 0 || j < 0 || i >= gx || j >= gz || !inside[j * gx + i]) return false; } return true; };
    const tileY = b.max.y + .012, tones = [PAL.paving, '#e5ddcc', '#f2ece0', '#e9e1d1'].map(h => kit.color(h)), stones = [];
    for (let row = 0, z = b.min.z + .3; z < b.max.z - .2; row++, z += .53) for (let x = b.min.x + .32 + (row % 2) * .33; x < b.max.x - .3; x += .66) if (ok(x, z)) stones.push([x + (rand() - .5) * .02, z + (rand() - .5) * .02]);
    const slabGeo = paint(softBox(.62, .045, .49, .035, 2), '#ffffff');
    const tiles = new THREE.InstancedMesh(slabGeo, std({ roughness: .86 }), stones.length); tiles.name = 'diorama-court-stones'; tiles.material.userData.townGround = true;
    const dm = new THREE.Object3D();
    stones.forEach(([x, z], i) => { dm.position.set(x, tileY, z); dm.rotation.set(0, (rand() - .5) * .03, 0); dm.updateMatrix(); tiles.setMatrixAt(i, dm.matrix); tiles.setColorAt(i, tones[Math.floor(rand() * tones.length)].clone().multiplyScalar(.97 + rand() * .05)); });
    tiles.receiveShadow = true; root.add(tiles); state.courtStones = stones.length;
    // Under the stones the court reads as joint: a little darker.
    court.p.joint = true;
  }
  for (const { g, hex, joint } of harvest.paths) {
    if (court && hex === 'b8beb5') { g.computeBoundingBox(); if (g.boundingBox.min.x > court.b.min.x - .5 && g.boundingBox.max.x < court.b.max.x + .5 && g.boundingBox.min.z > court.b.min.z - .2 && g.boundingBox.max.z < court.b.max.z + .2) continue; }
    if (joint) { B.add('path', paint(kit.indexed(g), PAL.mortar)); continue; }
    const base = kit.color(pathColour[hex]);
    B.add('path', paint(kit.indexed(g), (x, y, z) => base.clone().multiplyScalar((.95 + .05 * noise(x * 2.4, 0, z * 2.4, 13)) * (hex === 'd8ceba' ? .97 + .06 * noise(x * 9, 0, z * 9, 14) : 1))));
  }
  if (harvest.pondSoil) B.add('path', paint(kit.indexed(harvest.pondSoil), PAL.pondSoil));
  // Stepping stones and yard pavers keep their places and shapes, in the new stone colour.
  for (const o of harvest.stones) { root.attach(o); o.material = mats.stone; o.castShadow = false; o.receiveShadow = true; }

  // ── grass tufts on the open lawn (kept off paths, court, buildings, the pond and the cut edge) ──
  {
    const cell = .25, gx = Math.ceil(W / cell), gz = Math.ceil(D / cell), busy = new Uint8Array(gx * gz);
    const mark = (x, z) => { const i = Math.floor((x - flat.minX) / cell), j = Math.floor((z - flat.minZ) / cell); if (i >= 0 && j >= 0 && i < gx && j < gz) busy[j * gx + i] = 1; };
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (const { g } of harvest.paths) {
      const p = g.attributes.position, ix = g.index ? g.index.array : null, n = ix ? ix.length : p.count;
      for (let t = 0; t < n; t += 3) {
        a.fromBufferAttribute(p, ix ? ix[t] : t); b.fromBufferAttribute(p, ix ? ix[t + 1] : t + 1); c.fromBufferAttribute(p, ix ? ix[t + 2] : t + 2);
        const steps = Math.ceil(Math.max(a.distanceTo(b), a.distanceTo(c), b.distanceTo(c)) / (cell * .5)) + 1;
        for (let u = 0; u <= steps; u++) for (let v = 0; v <= steps - u; v++) { const w = 1 - (u + v) / steps; mark(a.x * w + b.x * u / steps + c.x * v / steps, a.z * w + b.z * u / steps + c.z * v / steps); }
      }
    }
    const blocked = (x, z) => {
      if (x < flat.minX + .4 || x > flat.maxX - .4 || z < flat.minZ + .4 || z > flat.maxZ - .4) return true;
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const i = Math.floor((x - flat.minX) / cell) + dx, j = Math.floor((z - flat.minZ) / cell) + dz; if (i >= 0 && j >= 0 && i < gx && j < gz && busy[j * gx + i]) return true; }
      if (x > 3.4 && x < 7.3 && z > -6.9 && z < -4.3) return true;
      return footprints.some(f => Math.abs(x - f.x) < f.hw + .1 && Math.abs(z - f.z) < f.hd + .1);
    };
    const blade = [], bc = [], bi = [], base = kit.color('#93b97a'), tip = kit.color('#d4e7a8');
    for (let k = 0; k < 4; k++) {
      const ang = k * Math.PI * 2 / 4 + .3, lean = .35 + (k % 2) * .25, hgt = .62 + (k % 3) * .2, o = blade.length / 3;
      const dx = Math.cos(ang), dz = Math.sin(ang), px = -dz * .05, pz = dx * .05;
      blade.push(-px, 0, -pz, px, 0, pz, dx * lean * .25, hgt, dz * lean * .25);
      bc.push(base.r, base.g, base.b, base.r, base.g, base.b, tip.r, tip.g, tip.b); bi.push(o, o + 1, o + 2);
    }
    const tuft = new THREE.BufferGeometry(); tuft.setAttribute('position', new THREE.Float32BufferAttribute(blade, 3)); tuft.setAttribute('color', new THREE.Float32BufferAttribute(bc, 3)); tuft.setIndex(bi); tuft.computeVertexNormals();
    // Grass lit from above, whichever side faces the camera.
    const np = tuft.attributes.normal; for (let i = 0; i < np.count; i++) np.setXYZ(i, 0, 1, 0);
    const want = Math.round(5200 * detail), list = [];
    for (let tries = 0; list.length < want && tries < want * 6; tries++) {
      const x = flat.minX + rand() * W, z = flat.minZ + rand() * D;
      if (blocked(x, z)) continue;
      const clump = .5 + .5 * noise(x * .35, 0, z * .35, 21); if (rand() > .35 + .65 * clump) continue;
      list.push([x, z, .1 + rand() * .09 + clump * .05]);
    }
    const grass = new THREE.InstancedMesh(tuft, std({ roughness: 1, side: THREE.DoubleSide }), list.length); grass.name = 'diorama-grass';
    const dummy = new THREE.Object3D();
    list.forEach(([x, z, h], i) => { dummy.position.set(x, GROUND_Y, z); dummy.rotation.set(0, rand() * 6.28, 0); dummy.scale.set(h * 1.4, h, h * 1.4); dummy.updateMatrix(); grass.setMatrixAt(i, dummy.matrix); grass.setColorAt(i, c3.setRGB(.86 + rand() * .2, .9 + rand() * .14, .82 + rand() * .16)); });
    grass.castShadow = false; grass.receiveShadow = true; root.add(grass);
    state.grassTufts = list.length;
  }

  // ── pond: the approved outline, clear water that turns to foam at its rim ──
  if (harvest.pond) {
    const g = kit.indexed(harvest.pond), p = g.attributes.position, centre = new THREE.Vector3(), bins = new Array(36).fill(0);
    for (let i = 0; i < p.count; i++) centre.add(v3.fromBufferAttribute(p, i)); centre.divideScalar(p.count);
    const bin = (x, z) => Math.floor(((Math.atan2(z - centre.z, x - centre.x) + Math.PI) / (2 * Math.PI)) * 36) % 36;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), b = bin(x, z); bins[b] = Math.max(bins[b], Math.hypot(x - centre.x, z - centre.z)); }
    const deep = kit.color(PAL.waterDeep), shallow = kit.color(PAL.water), foam = kit.color(PAL.foam);
    paint(g, (x, y, z) => { const r = Math.hypot(x - centre.x, z - centre.z) / Math.max(.01, bins[bin(x, z)]); return deep.clone().lerp(shallow, smooth(0, .8, r)).lerp(foam, smooth(.8, .98, r) * .9); });
    g.translate(0, .006, 0);
    const water = new THREE.Mesh(g, mats.water); water.name = 'diorama-pond'; water.receiveShadow = true; root.add(water);
    const L = batcher();
    for (const [dx, dz, r] of [[-.5, .1, .2], [.35, -.2, .16], [.8, .25, .13]]) L.add('leaf', paint(place(cylinder(r, r, .012, 14), { p: [centre.x + dx, centre.y + .02, centre.z + dz] }), PAL.leaf));
    for (let i = 0; i < 9; i++) { const a = 2.3 + i * .14, x = centre.x + Math.cos(a) * 1.35, z = centre.z + Math.sin(a) * .7; L.add('leaf', paint(place(cylinder(.006, .018, .55 + rand() * .3, 4), { p: [x, GROUND_Y + .3, z], r: [rand() * .2 - .1, 0, rand() * .2 - .1] }), PAL.leafDeep)); }
    L.build(root, mats, { name: 'diorama-pond-plants', cast: false });
  }

  // ── planting: the approved beds, as round bushes with flowers ──
  {
    const clusters = [];
    for (const [x, y, z] of harvest.leaves) {
      let best = null; for (const c of clusters) if (Math.hypot(c.x / c.n - x, c.z / c.n - z) < .75) { best = c; break; }
      if (!best) clusters.push(best = { x: 0, z: 0, n: 0, minX: x, maxX: x, minZ: z, maxZ: z });
      best.x += x; best.z += z; best.n++; best.minX = Math.min(best.minX, x); best.maxX = Math.max(best.maxX, x); best.minZ = Math.min(best.minZ, z); best.maxZ = Math.max(best.maxZ, z);
    }
    const P = batcher(), deep = kit.color(PAL.leafDeep), mid = kit.color(PAL.leaf), light = kit.color(PAL.leafLight);
    for (const c of clusters) {
      const x = c.x / c.n, z = c.z / c.n, spread = Math.max(.25, Math.max(c.maxX - c.minX, c.maxZ - c.minZ) / 2), parts = Math.min(4, 1 + Math.round(spread * 2));
      for (let i = 0; i < parts; i++) {
        const a = rand() * Math.PI * 2, d = i ? spread * (.35 + rand() * .3) : 0, r = (.26 + .2 * Math.min(1, Math.sqrt(c.n) / 7)) * (i ? .8 : 1);
        const bx = x + Math.cos(a) * d, bz = z + Math.sin(a) * d;
        P.add('leaf', paint(place(blob(r, 1, i * 7 + c.n, .14, .82), { p: [bx, GROUND_Y + r * .62, bz] }),
          (px, py, pz, nx, ny) => deep.clone().lerp(mid, smooth(GROUND_Y, GROUND_Y + r, py)).lerp(light, Math.max(0, ny) * .55 + Math.max(0, -nx * .3))));
      }
    }
    P.build(root, mats, { name: 'diorama-bushes' });
    const dots = harvest.flowers, flower = paint(kit.indexed(new THREE.IcosahedronGeometry(1, 0), false), '#ffffff');
    const inst = new THREE.InstancedMesh(flower, std({ roughness: .7 }), dots.length); inst.name = 'diorama-flowers';
    const dummy = new THREE.Object3D();
    dots.forEach(([x, y, z, hex], i) => { dummy.position.set(x, y + .02, z); dummy.scale.setScalar(.05 + rand() * .025); dummy.rotation.set(rand() * 3, rand() * 3, 0); dummy.updateMatrix(); inst.setMatrixAt(i, dummy.matrix); inst.setColorAt(i, c3.setHex(hex)); });
    inst.castShadow = false; inst.receiveShadow = true; if (dots.length) root.add(inst);
  }

  // ── trees: a trunk, a few soft crowns; two blossom trees by the court ──
  {
    const T = batcher();
    for (const t of TOWN_LAYOUT.trees) {
      const s = t.scale, r2 = rng(t.seed), blossom = t.id === 'tree-41' || t.id === 'tree-52';
      const lean = [(r2() - .5) * .12, 0, (r2() - .5) * .12], h = 1.75 * s;
      T.add('wood', paint(place(cylinder(.07 * s, .13 * s, h, 9), { p: [t.x, GROUND_Y + h / 2, t.z], r: lean }), grounded(PAL.trunk, { from: .7, over: 1, base: GROUND_Y })));
      for (const side of [-1, 1]) T.add('wood', paint(tube([[t.x, GROUND_Y + h * .72, t.z], [t.x + side * .35 * s, GROUND_Y + h * .95, t.z + (r2() - .5) * .3], [t.x + side * .55 * s, GROUND_Y + h * 1.12, t.z + (r2() - .5) * .4]], .045 * s, 6, 8), PAL.trunk));
      const crown = [[0, 1.25, 0, .82], [.55, 1.05, .15, .62], [-.55, 1.1, -.1, .66], [.1, 1.05, .55, .6], [-.1, 1.15, -.55, .62], [.05, 1.7, .05, .6]];
      const c0 = kit.color(blossom ? '#d9879d' : PAL.leafDeep), c1 = kit.color(blossom ? PAL.blossom : PAL.leaf), c2 = kit.color(blossom ? PAL.blossomLight : PAL.leafLight);
      crown.forEach(([dx, dy, dz, r], i) => {
        const p = [t.x + dx * s * 1.05, GROUND_Y + h + (dy - 1) * s * 1.2 + .25 * s, t.z + dz * s * 1.05], rr = r * s;
        T.add('leaf', paint(place(blob(rr, detail > .7 ? 2 : 1, t.seed + i * 13, .13, .9), { p }), (x, y, z, nx, ny, nz) => c0.clone().lerp(c1, smooth(p[1] - rr, p[1] + rr * .2, y)).lerp(c2, Math.max(0, ny) * .6 + Math.max(0, -nx * .25 + nz * .2))));
      });
    }
    T.build(root, mats, { name: 'diorama-trees' });
  }

  // ── buildings: the four places of the tea-house alley, each under its own root (occlusion fading works per root) ──
  const PANEL = (g, B, key, w, h, d, p, fill, o) => B.add(key, paint(place(softBox(w, h, d, o?.r ?? .025, o?.k ?? 1), { p, r: o?.rot }), fill));
  const rect = (x0, y0, x1, y1) => { const s = new THREE.Shape(); s.moveTo(x0, y0); s.lineTo(x1, y0); s.lineTo(x1, y1); s.lineTo(x0, y1); s.closePath(); return s; };
  const holeRect = (x0, y0, x1, y1) => { const h = new THREE.Path(); h.moveTo(x0, y0); h.lineTo(x0, y1); h.lineTo(x1, y1); h.lineTo(x1, y0); h.closePath(); return h; };
  const holeCircle = (x, y, r) => { const h = new THREE.Path(); h.absarc(x, y, r, 0, Math.PI * 2, true); return h; };
  /** A wall in the XY plane facing +Z, its back face at z = zBack, with rectangular / round openings. */
  function wall(B, w, h, t, zBack, openings, fill, x = 0, rotY = 0, zc = 0) {
    const shape = rect(-w / 2, 0, w / 2, h);
    for (const o of openings) shape.holes.push(o.r ? holeCircle(o.x, o.y, o.r) : holeRect(o.x0, o.y0, o.x1, o.y1));
    const g = slab(shape, t, .014); g.translate(0, 0, zBack); if (rotY) g.rotateY(rotY); g.translate(x, 0, zc);
    B.add('wall', paint(g, grounded(fill, { from: .8, over: 1.1, base: .13 })));
  }
  function lattice(B, x0, y0, x1, y1, z, cols = 3, rows = 2) {
    const w = x1 - x0, h = y1 - y0, cx0 = (x0 + x1) / 2, cy0 = (y0 + y1) / 2;
    PANEL(null, B, 'wood', w + .08, .05, .07, [cx0, y1 + .01, z], PAL.woodDark); PANEL(null, B, 'wood', w + .08, .05, .07, [cx0, y0 - .01, z], PAL.woodDark);
    PANEL(null, B, 'wood', .05, h + .06, .07, [x0 - .01, cy0, z], PAL.woodDark); PANEL(null, B, 'wood', .05, h + .06, .07, [x1 + .01, cy0, z], PAL.woodDark);
    for (let i = 1; i < cols; i++) PANEL(null, B, 'wood', .022, h, .03, [x0 + w * i / cols, cy0, z + .015], PAL.wood, { r: .008 });
    for (let j = 1; j < rows; j++) PANEL(null, B, 'wood', w, .022, .03, [cx0, y0 + h * j / rows, z + .015], PAL.wood, { r: .008 });
    const pane = new THREE.PlaneGeometry(w, h); pane.translate(cx0, cy0, z - .01); B.add('glass', paint(kit.indexed(pane), '#ffffff'));
  }
  function deck(B, { w = 4.55, z0 = -2.871, z1 = 1.227, tint = PAL.maru } = {}) {
    PANEL(null, B, 'wood', w + .04, .1, z1 - z0 + .04, [0, .05, (z0 + z1) / 2], PAL.apron, { r: .02 });
    const n = Math.round((z1 - z0) / .274), c = kit.color(tint);
    for (let i = 0; i < n; i++) { const k = .9 + rand() * .14; PANEL(null, B, 'wood', w, .035, .262, [0, .112, z0 + .137 + i * .274], c.clone().multiplyScalar(k), { r: .012 }); }
    for (const x of [-.55, .55]) PANEL(null, B, 'path', .9, .1, .42, [x * 1.6, .04, z1 + .3], PAL.stone, { r: .05, k: 2 });
  }
  function frameBody(B, { w = 3.9, z0 = -2.97, z1 = -.76, h = 2.12, frontPosts = [] } = {}) {
    for (const x of [-w / 2, w / 2, ...frontPosts]) for (const z of [z0, z1]) {
      if (z === z0 && frontPosts.includes(x)) continue;
      B.add('wood', paint(place(cylinder(.072, .08, h - .13, 10), { p: [x, .13 + (h - .13) / 2, z] }), grounded(PAL.wood, { from: .78, over: .8, base: .13 })));
    }
    for (const z of [z0, z1]) PANEL(null, B, 'wood', w + .26, .13, .15, [0, h + .02, z], PAL.woodDark, { r: .02 });
    for (const x of [-w / 2, w / 2]) PANEL(null, B, 'wood', .15, .13, z1 - z0 + .2, [x, h + .02, (z0 + z1) / 2], PAL.woodDark, { r: .02 });
  }
  function roofOn(B, { w, dFront, dBack, rise, lift, y, z, tile = PAL.tile, tileLight = PAL.tileLight, hip = .55 }) {
    const r = hanokRoof({ w, dFront, dBack, rise, lift, hip, tile, tileLight, mortar: PAL.mortarWhite, rafter: PAL.rafter, edge: PAL.roofEdge, detail });
    r.geometry.translate(0, y, z); B.add('roof', r.geometry); return r;
  }
  function lanternAt(B, p) {
    B.add('wood', paint(place(cylinder(.006, .006, .3, 4), { p: [p[0], p[1] + .28, p[2]] }), PAL.woodDark));
    B.add('lantern', paint(place(blob(.11, 1, p[0] * 7, .03, 1.25), { p }), PAL.butter));
    PANEL(null, B, 'wood', .13, .03, .13, [p[0], p[1] + .14, p[2]], PAL.woodDark, { r: .012 });
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), mats.pool); pool.rotation.x = -Math.PI / 2; pool.position.set(p[0], .15, p[2] + .5); pool.renderOrder = 3; pool.name = 'diorama-lantern-pool';
    return pool;
  }
  function stool(B, x, z, h = .44, r = .19, c = PAL.woodLight) {
    B.add('wood', paint(place(cylinder(r, r * .94, .06, 14), { p: [x, .13 + h - .03, z] }), c));
    for (let i = 0; i < 3; i++) { const a = i * 2.094 + .3; B.add('wood', paint(place(cylinder(.018, .022, h - .05, 5), { p: [x + Math.cos(a) * r * .6, .13 + (h - .05) / 2, z + Math.sin(a) * r * .6] }), PAL.woodDark)); }
  }
  const byId = Object.fromEntries(buildings.map(b => [b.userData.placeId, b]));
  const extras = [];

  function home(g) {
    const B = batcher();
    deck(B);
    frameBody(B);
    wall(B, 3.9, 2.12, .12, -2.97, [], PAL.plaster);
    for (const s of [-1, 1]) wall(B, 2.21, 2.12, .12, -.06, s < 0 ? [{ x0: -.55, y0: .95, x1: .35, y1: 1.6 }] : [], PAL.plaster, s * 1.95, s * Math.PI / 2, -1.865);
    // Front: the door, and the big round window with the reading bench under it.
    wall(B, 3.9, 2.12, .12, -.88, [{ x0: -1.38, y0: .13, x1: -.56, y1: 1.86 }, { x: .72, y: 1.22, r: .56 }], PAL.plaster);
    PANEL(null, B, 'wood', .78, 1.7, .06, [-.97, .99, -.84], PAL.wood, { r: .02 });
    for (const y of [.55, 1.15, 1.6]) PANEL(null, B, 'wood', .7, .03, .03, [-.97, y, -.8], PAL.woodDark, { r: .008 });
    B.add('wood', paint(place(blob(.035, 1, 3, 0), { p: [-.72, 1.0, -.79] }), PAL.butter));
    B.add('wood', paint(place(kit.indexed(new THREE.TorusGeometry(.56, .055, 10, 40)), { p: [.72, 1.22, -.78] }), PAL.woodDark));
    for (const dx of [-.28, 0, .28]) { const half = Math.sqrt(.56 * .56 - dx * dx); PANEL(null, B, 'wood', .024, half * 2, .03, [.72 + dx, 1.22, -.8], PAL.wood, { r: .008 }); }
    for (const dy of [-.2, .2]) { const half = Math.sqrt(.56 * .56 - dy * dy); PANEL(null, B, 'wood', half * 2, .024, .03, [.72, 1.22 + dy, -.8], PAL.wood, { r: .008 }); }
    const disc = new THREE.CircleGeometry(.56, 32); disc.translate(.72, 1.22, -.83); B.add('glass', paint(kit.indexed(disc), '#ffffff'));
    PANEL(null, B, 'wood', 1.3, .07, .42, [.78, .47, -.56], PAL.woodLight, { r: .025 });
    PANEL(null, B, 'cloth', 1.18, .07, .36, [.78, .53, -.56], PAL.coral, { r: .03, k: 2 });
    for (const x of [.2, 1.36]) PANEL(null, B, 'wood', .07, .33, .36, [x, .29, -.56], PAL.woodDark, { r: .015 });
    // Window box of flowers, a chimney, a lantern by the door.
    PANEL(null, B, 'wood', .9, .14, .2, [.72, .58 + .0, -.66], PAL.wood, { r: .02 });
    for (let i = 0; i < 7; i++) B.add('leaf', paint(place(blob(.05, 1, i, .1), { p: [.4 + i * .105, .69, -.66 + (rand() - .5) * .06] }), [PAL.coralLight, '#ffffff', PAL.butter, '#d7a6d9'][i % 4]));
    PANEL(null, B, 'wall', .3, .55, .3, [-1.2, 3.05, -2.35], PAL.plaster, { r: .04, k: 2 });
    PANEL(null, B, 'roof', .4, .08, .4, [-1.2, 3.35, -2.35], PAL.roofEdge, { r: .03 });
    extras.push([g, lanternAt(B, [-1.62, 1.72, -.62])]);
    roofOn(B, { w: 5.1, dFront: 1.45, dBack: 1.5, rise: .95, lift: .26, y: 2.2, z: -1.86 });
    return B;
  }
  function cafe(g) {
    const B = batcher();
    deck(B, { tint: '#e1b37a' });
    frameBody(B, { frontPosts: [-.66, .66] });
    wall(B, 3.9, 2.12, .12, -2.97, [{ x0: -1.4, y0: 1.0, x1: -.5, y1: 1.65 }, { x0: .5, y0: 1.0, x1: 1.4, y1: 1.65 }], PAL.cafePlaster);
    for (const s of [-1, 1]) wall(B, 2.21, 2.12, .12, -.06, [{ x0: -.6, y0: .9, x1: .5, y1: 1.65 }], PAL.cafePlaster, s * 1.95, s * Math.PI / 2, -1.865);
    lattice(B, -1.4, 1.0, -.5, 1.65, -2.84); lattice(B, .5, 1.0, 1.4, 1.65, -2.84);
    // Counter, tea shelves with jars, a round table between the two eave seats.
    PANEL(null, B, 'wood', 2.7, .9, .52, [0, .13 + .45, -1.78], PAL.cafePlaster, { r: .03, k: 2 });
    PANEL(null, B, 'wood', 2.82, .06, .6, [0, 1.06, -1.78], PAL.woodLight, { r: .02 });
    for (const y of [1.3, 1.72]) PANEL(null, B, 'wood', 2.6, .045, .24, [0, y, -2.82], PAL.woodLight, { r: .012 });
    const jars = [PAL.ceramic, '#8fb08a', PAL.coral, PAL.butter, '#e9d2b3', PAL.lapis];
    for (let i = 0; i < 12; i++) { const y = i < 6 ? 1.33 : 1.75, x = -1.1 + (i % 6) * .44 + (rand() - .5) * .08, hh = .14 + rand() * .1;
      B.add('wood', paint(place(cylinder(.055, .06, hh, 10), { p: [x, y + hh / 2, -2.8] }), jars[(i * 5) % jars.length])); }
    for (const [x, hh] of [[-.6, .2], [.55, .16]]) B.add('wood', paint(place(blob(.1, 1, x * 9, .05, 1.1), { p: [x, 1.09 + .1, -1.7] }), PAL.ceramic));
    B.add('wood', paint(place(cylinder(.44, .44, .05, 24), { p: [-.2, .78, .42] }), PAL.ceramic));
    B.add('wood', paint(place(cylinder(.05, .07, .6, 8), { p: [-.2, .45, .42] }), PAL.woodDark));
    B.add('wood', paint(place(cylinder(.22, .25, .04, 16), { p: [-.2, .15, .42] }), PAL.woodDark));
    B.add('wood', paint(place(blob(.09, 1, 5, .02, .9), { p: [-.28, .88, .38] }), PAL.ceramic));
    for (const [x, z] of [[-.02, .55], [-.45, .58]]) B.add('wood', paint(place(cylinder(.035, .03, .06, 10), { p: [x, .84, z] }), PAL.ceramic));
    stool(B, -1.2, .4); stool(B, .8, .4);
    for (const x of [-2.05, 2.05]) {
      B.add('wall', paint(place(cylinder(.17, .13, .32, 14), { p: [x, .29, 1.05] }), PAL.ceramic));
      for (let k = 0; k < 3; k++) B.add('leaf', paint(place(blob(.15 - k * .03, 1, k + x, .2, .95), { p: [x + (k - 1) * .06, .56 + k * .1, 1.05 + (k % 2) * .05] }), (px, py, pz, nx, ny) => kit.color(PAL.leafDeep).lerp(kit.color(PAL.leafLight), Math.max(0, ny) * .7)));
    }
    // The coral awning with the soft wave edge (몽글 물결) along the front eave.
    {
      const pos = [], col = [], idx = [], cols = 96, x0 = -2.45, x1 = 2.45, c1 = kit.color(PAL.coral), c2 = kit.color(PAL.coralLight);
      for (let i = 0; i <= cols; i++) {
        const x = x0 + (x1 - x0) * i / cols, wave = .07 * Math.pow(Math.sin(Math.PI * (x - x0) / .49), 2), stripe = Math.floor((x - x0) / .35) % 2 ? c2 : c1;
        for (const [k, y, z] of [[0, 2.08, -.42], [1, 1.82, -.02], [2, 1.70 - wave, .02]]) { pos.push(x, y, z); col.push(stripe.r, stripe.g, stripe.b); }
      }
      for (let i = 0; i < cols; i++) for (let j = 0; j < 2; j++) { const q = i * 3 + j, r = q + 3; idx.push(q, r, r + 1, q, r + 1, q + 1); }
      const a = new THREE.BufferGeometry(); a.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); a.setIndex(idx); a.computeVertexNormals(); a.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      B.add('cloth', a);
    }
    extras.push([g, lanternAt(B, [-1.32, 1.55, -.2])], [g, lanternAt(B, [1.32, 1.55, -.2])]);
    roofOn(B, { w: 5.7, dFront: 2.25, dBack: 1.55, rise: 1.05, lift: .3, y: 2.2, z: -1.86, hip: .5 });
    return B;
  }
  function workshop(g) {
    const B = batcher();
    deck(B, { tint: '#d6b07f' });
    frameBody(B, { frontPosts: [-.7, .7] });
    wall(B, 3.9, 2.12, .12, -2.97, [{ x0: -1.5, y0: 1.05, x1: -.3, y1: 1.75 }], PAL.shopPlaster);
    for (const s of [-1, 1]) wall(B, 2.21, 2.12, .12, -.06, [{ x0: -.7, y0: .95, x1: .55, y1: 1.7 }], PAL.shopPlaster, s * 1.95, s * Math.PI / 2, -1.865);
    lattice(B, -1.5, 1.05, -.3, 1.75, -2.84, 4, 2);
    // Tool wall, back bench, the work table at the front with a vice and planks.
    PANEL(null, B, 'wood', 1.5, .9, .05, [.85, 1.35, -2.86], PAL.woodLight, { r: .015 });
    for (let i = 0; i < 7; i++) { const x = .25 + i * .2, hh = .22 + rand() * .2; PANEL(null, B, 'wood', .04, hh, .03, [x, 1.35 + (rand() - .5) * .3, -2.82], i % 3 ? PAL.woodDark : PAL.lapis, { r: .01 }); }
    PANEL(null, B, 'wood', 3.2, .08, .62, [0, .86, -2.5], PAL.woodLight, { r: .02 });
    for (const x of [-1.45, 1.45]) PANEL(null, B, 'wood', .08, .72, .55, [x, .49, -2.5], PAL.woodDark, { r: .015 });
    PANEL(null, B, 'wood', 1.7, .09, .74, [0, .8, -.42], PAL.wood, { r: .025 });
    for (const x of [-.75, .75]) for (const z of [-.72, -.12]) PANEL(null, B, 'wood', .07, .67, .07, [x, .46, z], PAL.woodDark, { r: .012 });
    PANEL(null, B, 'wood', .22, .16, .18, [.55, .93, -.5], '#5d6b77', { r: .02 });
    for (let i = 0; i < 3; i++) PANEL(null, B, 'wood', .9, .04, .14, [-.35 + i * .05, .87 + i * .042, -.45], PAL.woodLight, { r: .01 });
    PANEL(null, B, 'wood', .5, .32, .4, [-1.2, .29, 1.25], PAL.woodLight, { r: .02 });
    stool(B, -.6, .6, .42, .17);
    for (const [x, z, s] of [[1.75, .75, .42], [1.75, 1.1, .32], [1.4, 1.0, .3]]) PANEL(null, B, 'wood', s, s * .7, s, [x, .13 + s * .35, z], PAL.woodLight, { r: .02 });
    for (let i = 0; i < 5; i++) B.add('wood', paint(place(cylinder(.05, .05, .5, 8), { p: [-1.75, .2 + (i % 3) * .1, -.2 + i * .1], r: [0, 0, Math.PI / 2] }), PAL.woodLight));
    // A lapis guide cloth hung from the front post.
    PANEL(null, B, 'cloth', .5, .8, .02, [-1.25, 1.6, -.68], PAL.lapis, { r: .01 });
    extras.push([g, lanternAt(B, [1.55, 1.6, -.5])]);
    roofOn(B, { w: 5.3, dFront: 1.25, dBack: 1.9, rise: .82, lift: .14, y: 2.2, z: -1.6, tile: PAL.shopTile, tileLight: PAL.shopTileLight, hip: .45 });
    return B;
  }
  function greenhouse(g) {
    const B = batcher(), x0 = -1.75, x1 = 1.75, z0 = -1.6, z1 = 1.35, eave = 2.1, ridge = 3.0;
    PANEL(null, B, 'path', x1 - x0 + .2, .1, z1 - z0 + .2, [0, .05, (z0 + z1) / 2], PAL.gravel, { r: .03 });
    // Low plaster sill all round, then the sage frame and its glass.
    for (const [w, d, p] of [[x1 - x0, .14, [0, .3, z0]], [.14, z1 - z0, [x0, .3, (z0 + z1) / 2]], [.14, z1 - z0, [x1, .3, (z0 + z1) / 2]], [1.1, .14, [-1.2, .3, z1]], [1.1, .14, [1.2, .3, z1]]])
      PANEL(null, B, 'wall', w, .4, d, p, PAL.plaster, { r: .03 });
    const post = (x, z, h) => PANEL(null, B, 'wood', .07, h, .07, [x, .5 + h / 2, z], PAL.frame, { r: .015 });
    for (const x of [x0, -.6, .6, x1]) { post(x, z0, eave - .5); post(x, z1, eave - .5); }
    for (const z of [-.5, .5]) { post(x0, z, eave - .5); post(x1, z, eave - .5); }
    for (const z of [z0, z1]) PANEL(null, B, 'wood', x1 - x0 + .1, .07, .08, [0, eave, z], PAL.frame, { r: .015 });
    for (const x of [x0, x1]) PANEL(null, B, 'wood', .08, .07, z1 - z0 + .1, [x, eave, (z0 + z1) / 2], PAL.frame, { r: .015 });
    const pitch = Math.atan2(ridge - eave, (z1 - z0) / 2), slope = (z1 - z0) / 2 / Math.cos(pitch);
    for (const x of [x0, -1.15, -.6, 0, .6, 1.15, x1]) for (const s of [-1, 1])
      B.add('wood', paint(place(softBox(.06, .06, slope + .1, .015, 1), { p: [x, (eave + ridge) / 2, (z0 + z1) / 2 + s * (z1 - z0) / 4], r: [s * pitch, 0, 0] }), PAL.frame));
    PANEL(null, B, 'wood', x1 - x0 + .2, .08, .1, [0, ridge, (z0 + z1) / 2], PAL.frame, { r: .02 });
    const glass = [];
    const pane = (w, h, p, r) => { const q = new THREE.PlaneGeometry(w, h); place(q, { p, r }); glass.push(paint(kit.indexed(q), '#ffffff')); };
    pane(x1 - x0, eave - .5, [0, .5 + (eave - .5) / 2, z0], [0, 0, 0]);
    pane(z1 - z0, eave - .5, [x0, .5 + (eave - .5) / 2, (z0 + z1) / 2], [0, Math.PI / 2, 0]); pane(z1 - z0, eave - .5, [x1, .5 + (eave - .5) / 2, (z0 + z1) / 2], [0, Math.PI / 2, 0]);
    for (const x of [-1.2, 1.2]) pane(1.1, eave - .5, [x, .5 + (eave - .5) / 2, z1], [0, 0, 0]);
    for (const s of [-1, 1]) pane(x1 - x0, slope, [0, (eave + ridge) / 2, (z0 + z1) / 2 + s * (z1 - z0) / 4], [-Math.PI / 2 + s * pitch, 0, 0]);
    // Gable triangles.
    for (const z of [z0, z1]) { const s = new THREE.Shape(); s.moveTo(x0, eave); s.lineTo(x1, eave); s.lineTo(0, ridge); s.closePath(); const t = new THREE.ShapeGeometry(s); t.translate(0, 0, z); glass.push(paint(kit.indexed(t), '#ffffff')); }
    for (const q of glass) B.add('thinGlass', q);
    // Door frame, two raised beds with greens and fruit, the bench, the board.
    for (const x of [-.6, .6]) PANEL(null, B, 'wood', .08, 2.0, .08, [x, 1.0, z1], PAL.frame, { r: .015 });
    PANEL(null, B, 'wood', 1.28, .08, .08, [0, 2.0, z1], PAL.frame, { r: .015 });
    for (const [bx, bz, bw] of [[-.95, -.75, 1.25], [.85, -.75, 1.25]]) {
      PANEL(null, B, 'wood', bw, .42, .62, [bx, .3, bz], PAL.wood, { r: .025 });
      PANEL(null, B, 'path', bw - .1, .05, .52, [bx, .5, bz], PAL.soilDeep, { r: .02 });
      for (let i = 0; i < 4; i++) {
        const px = bx - bw / 2 + .2 + i * (bw - .4) / 3, r = .14 + rand() * .06;
        B.add('leaf', paint(place(blob(r, 1, i + bx * 10, .18, .9), { p: [px, .58 + r * .7, bz + (rand() - .5) * .15] }), (x, y, z, nx, ny) => kit.color(PAL.leafDeep).lerp(kit.color(PAL.leafLight), Math.max(0, ny) * .7)));
        if (i % 2) for (let k = 0; k < 3; k++) B.add('leaf', paint(place(blob(.035, 1, k, 0), { p: [px + (rand() - .5) * .2, .62 + rand() * .2, bz + .12] }), bx < 0 ? '#e0574a' : PAL.butter));
      }
    }
    PANEL(null, B, 'wood', .9, .06, .32, [1.3, .45, .7], PAL.woodLight, { r: .02 });
    for (const x of [.95, 1.65]) PANEL(null, B, 'wood', .06, .34, .28, [x, .28, .7], PAL.woodDark, { r: .012 });
    PANEL(null, B, 'wood', .6, .45, .04, [.3, 1.15, -.05], PAL.ceramic, { r: .01 });
    PANEL(null, B, 'wood', .66, .5, .03, [.3, 1.15, -.08], PAL.woodLight, { r: .01 });
    for (const x of [.05, .55]) PANEL(null, B, 'wood', .04, .9, .04, [x, .45, -.1], PAL.woodDark, { r: .01 });
    return B;
  }
  const builders = { home, cafe, workshop, greenhouse };
  for (const [id, make] of Object.entries(builders)) {
    const g = byId[id]; if (!g) continue;
    make(g).build(g, mats, { name: `diorama-${id}`, noCast: ['glass', 'thinGlass', 'cloth'] });
    containers.push(g); replaceVolume?.(g);
  }
  for (const [g, pool] of extras) { g.add(pool); }

  // ── neighbour houses: one generator, eight houses from the shared layout ──
  for (const house of TOWN_LAYOUT.houses) {
    const rootHouse = houses.find(h => h.name === 'town-' + house.id); if (!rootHouse) continue;
    const B = batcher(), w = house.width, d = house.depth, h = house.height, r2 = rng(house.id.length * 977 + Math.round(house.x * 31));
    const paintC = kit.color(house.paint);
    PANEL(null, B, 'path', w + .5, .22, d + .5, [0, GROUND_Y + .08, 0], PAL.stone, { r: .05, k: 2 });
    B.add('wall', paint(place(softBox(w, h - .2, d, .04, 2), { p: [0, GROUND_Y + .2 + (h - .2) / 2, 0] }), grounded(paintC.getHex(), { from: .86, over: .9, base: GROUND_Y + .2 })));
    for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) B.add('wood', paint(place(cylinder(.06, .07, h - .2, 8), { p: [x, GROUND_Y + .2 + (h - .2) / 2, z] }), PAL.wood));
    PANEL(null, B, 'wood', w + .16, .1, d + .16, [0, GROUND_Y + h, 0], PAL.woodDark, { r: .02 });
    PANEL(null, B, 'wood', w + .04, .07, .05, [0, GROUND_Y + .55, d / 2 + .01], PAL.wood, { r: .01 });
    PANEL(null, B, 'wood', .62, 1.25, .06, [0, GROUND_Y + .2 + .62, d / 2 + .01], PAL.wood, { r: .02 });
    for (const sx of [-1, 1]) if (w > 2.9 || sx > 0) {
      const x = sx * w * .3, y = GROUND_Y + 1.25;
      lattice(B, x - .32, y - .25, x + .32, y + .25, d / 2 + .03, 3, 2);
    }
    if (house.style === 2) {
      const ax = w / 2 - .23 + .61, az = -d * .14;
      B.add('wall', paint(place(softBox(1.22, 1.1, d * .74, .04, 2), { p: [ax, GROUND_Y + .2 + .55, az] }), paintC.getHex()));
      const small = hanokRoof({ w: 1.6, dFront: d * .37 + .3, dBack: d * .37 + .3, rise: .4, lift: .12, hip: .6, tile: PAL.tile, tileLight: PAL.tileLight, mortar: PAL.mortarWhite, rafter: PAL.rafter, edge: PAL.roofEdge, detail: detail * .6 });
      small.geometry.translate(ax, GROUND_Y + 1.32, az); B.add('roof', small.geometry);
    }
    const tint = kit.color(PAL.tile).lerp(kit.color(['#4b5f7e', '#3e4f5c', '#5a6a86'][house.style]), .5 + r2() * .3).getHex();
    const roof = hanokRoof({ w: w + 1.0, dFront: d / 2 + .5, dBack: d / 2 + .5, rise: .72 + .12 * (h > 2.4 ? 1 : 0), lift: .2, hip: .58, tile: tint, tileLight: kit.color(tint).lerp(kit.color('#ffffff'), .14).getHex(), mortar: PAL.mortarWhite, rafter: PAL.rafter, edge: PAL.roofEdge, detail: detail * .7 });
    roof.geometry.translate(0, GROUND_Y + h + .05, 0); B.add('roof', roof.geometry);
    // Garden walls with a small tile cap (담장), or a timber fence.
    for (const part of house.groundParts.filter(p => p.kind === 'garden-fence')) {
      if (part.materialKey === 'wood') {
        const len = Math.max(part.width, part.depth), along = part.width >= part.depth, n = Math.max(2, Math.round(len / .55));
        for (let i = 0; i <= n; i++) { const t = -len / 2 + len * i / n; PANEL(null, B, 'wood', .07, .55, .07, [part.localX + (along ? t : 0), GROUND_Y + .28, part.localZ + (along ? 0 : t)], PAL.wood, { r: .012 }); }
        for (const y of [.22, .44]) PANEL(null, B, 'wood', along ? len : .05, .05, along ? .05 : len, [part.localX, GROUND_Y + y, part.localZ], PAL.woodLight, { r: .01 });
      } else {
        PANEL(null, B, 'wall', part.width, .48, part.depth, [part.localX, GROUND_Y + .24, part.localZ], grounded('#f0ece2', { from: .82, over: .45, base: GROUND_Y }), { r: .03 });
        PANEL(null, B, 'roof', part.width + .08, .07, part.depth + .1, [part.localX, GROUND_Y + .52, part.localZ], PAL.tile, { r: .025 });
      }
    }
    // Into the house root's own frame (the layout frame is T(x, z)·R(yaw)).
    const layoutFrame = new THREE.Matrix4().makeRotationY(house.yaw).setPosition(house.x, 0, house.z);
    rootHouse.updateMatrixWorld(true);
    const toRoot = rootHouse.matrixWorld.clone().invert().multiply(layoutFrame);
    const holder = new THREE.Group(); holder.name = `diorama-${house.id}`; holder.matrixAutoUpdate = false; holder.matrix.copy(toRoot); rootHouse.add(holder);
    B.build(holder, mats, { name: `diorama-${house.id}`, noCast: ['glass'] });
    containers.push(rootHouse); replaceVolume?.(rootHouse);
  }

  // Ground and the block in one go.
  B.build(root, mats, { name: 'diorama-block', noCast: ['ground', 'path'] });

  // ── the table it stands on: a soft backdrop that follows the hour (the Town light still dims and tints it) ──
  const backdrop = (() => {
    const c = document.createElement('canvas'); c.width = 4; c.height = 256; const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, PAL.sky); g.addColorStop(.62, '#eef0ea'); g.addColorStop(1, PAL.skyLow); x.fillStyle = g; x.fillRect(0, 0, 4, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  // Town sets its photo sky later and the AO pass swaps the background out and back each frame: from the first
  // frame on, any sky Town assigns becomes this backdrop (null, the AO pass's own swap, passes through).
  const keeper = root.getObjectByName('diorama-block-ground');
  keeper.frustumCulled = false;
  keeper.onBeforeRender = (r, scene) => {
    let current = backdrop;
    Object.defineProperty(scene, 'background', { configurable: true, get: () => current, set: value => { current = value === null ? null : backdrop; } });
    keeper.onBeforeRender = () => {};
  };

  root.updateMatrixWorld(true);
  for (const c of containers) onAttach?.(c);
  let triangles = 0, meshes = 0;
  for (const c of containers) c.traverse(o => { if (!o.isMesh || !(o.name.startsWith('diorama') || o.parent === root)) return;
    meshes++; const g = o.geometry; triangles += (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); });
  state.textureBytes = 64 * 64 * 4 + 4 * 256 * 4;
  state.nan = [];
  for (const c of containers) c.traverse(o => { if (!o.isMesh || !o.name.startsWith('diorama')) return; const a = o.geometry.attributes.position.array; for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) { state.nan.push(o.name); break; } });
  Object.assign(state, { meshes, triangles: Math.round(triangles), buildMs: Math.round(performance.now() - started), harvested: { paths: harvest.paths.length, stones: harvest.stones.length, leaves: harvest.leaves.length, flowers: harvest.flowers.length, pond: !!harvest.pond } });
  state.loaded = true;
  globalThis.__lookDiorama = state;
  // Resolving with loaded:false tells Town this is not a baked town, so the sun moves with the hour.
  return { ready: Promise.resolve({ loaded: false, look: 'diorama' }), stats: () => ({ ...state }) };
}
