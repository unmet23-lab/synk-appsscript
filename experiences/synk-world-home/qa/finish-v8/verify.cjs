const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const checks = [], errors = [], check = (label, condition) => { assert.ok(condition, label); checks.push(label); };
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/__finish-check', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><body></body>' }));
    const before = path.resolve(__dirname, '../graphics-v8/before-sources');
    for (const file of ['scene-v3-garden.mjs', 'courtyard-details-v5.mjs']) {
      await page.route('**/before-' + file, route => route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(before, file), 'utf8').replaceAll("from './", "from '/") }));
    }
    await page.goto('http://127.0.0.1:4296/__finish-check');
    const result = await page.evaluate(async () => {
      const THREE = await import('/scene-assets/three.module.js');
      const currentGarden = await import('/scene-v3-garden.mjs'), currentCraft = await import('/courtyard-details-v5.mjs');
      const oldGarden = await import('/before-scene-v3-garden.mjs'), oldCraft = await import('/before-courtyard-details-v5.mjs');
      const material = () => new Proxy({}, { get(target, name) { return target[name] ||= new THREE.MeshStandardMaterial(); } });
      const build = (garden, craft) => { const group = new THREE.Group(), m = material(); m.terra.userData.handThrown = true; garden.makeCourtyard(group, m, { mobile: true }); craft.addCourtyardDetails(group, m); return group; };
      const count = group => { let draws = 0, triangles = 0; group.traverse(object => { if (object.isMesh) { draws++; triangles += (object.geometry.index?.count || object.geometry.attributes.position.count) / 3 * (object.isInstancedMesh ? object.count : 1); } }); return { draws, triangles }; };
      const old = build(oldGarden, oldCraft), current = build(currentGarden, currentCraft);
      const rug = current.getObjectByName('bound-woven-rug-v8'), pot = current.getObjectByName('continuous-clay-planter-v8');
      let deck;
      current.traverse(object => { if (object.isMesh && object.position.x === -2.95 && object.position.y === .233 && object.position.z === -.61) deck = object; });
      function geometryInfo(mesh) {
        const g = mesh.geometry, p = g.attributes.position, n = g.attributes.normal, index = g.index, edges = new Map();
        const key = i => [p.getX(i), p.getY(i), p.getZ(i)].map(v => Math.round(v * 1e5)).join(',');
        let degenerate = 0, invalidNormals = 0;
        for (let i = 0; i < p.count; i++) { const length = Math.hypot(n.getX(i), n.getY(i), n.getZ(i)); if (!Number.isFinite(length) || Math.abs(length - 1) > .01) invalidNormals++; }
        for (let i = 0; i < index.count; i += 3) {
          const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)], keys = ids.map(key);
          if (new Set(keys).size < 3) { degenerate++; continue; }
          for (let j = 0; j < 3; j++) { const edge = [keys[j], keys[(j + 1) % 3]].sort().join('|'); edges.set(edge, (edges.get(edge) || 0) + 1); }
        }
        mesh.updateMatrixWorld(true); const bounds = new THREE.Box3().setFromObject(mesh);
        return { triangles: index.count / 3, invalidNormals, degenerate, openOrNonManifoldEdges: [...edges.values()].filter(value => value !== 2).length, minY: bounds.min.y, maxY: bounds.max.y };
      }
      const surfaces = (await import('/surface-library-v6.mjs')).createSurfaceLibrary();
      const pixels = surfaces.leafNormal.image.getContext('2d').getImageData(0, 0, 256, 256).data;
      const normalInfo = { allFlipY: ['woodNormal', 'stoneNormal', 'leafNormal'].every(key => surfaces[key].flipY), descendingCanvasSlopeGreen: pixels[(3 * 256 + 128) * 4 + 1], ascendingCanvasSlopeGreen: pixels[(23 * 256 + 128) * 4 + 1] };
      deck.updateMatrixWorld(true); const deckBounds = new THREE.Box3().setFromObject(deck);
      const pn = pot.geometry.attributes.normal, rn = rug.geometry.attributes.normal, profileCount = pot.geometry.parameters.points.length;
      const facing = { rugTopZ: rn.getZ(0), rugBottomZ: rn.getZ(rn.count - 1), potOuterX: pn.getX(9 * profileCount + 9), potInnerX: pn.getX(9 * profileCount + 23) };
      return { old: count(old), current: count(current), rug: geometryInfo(rug), pot: geometryInfo(pot), deck: { maxY: deckBounds.max.y }, normalInfo, facing };
    });
    check('craft uses fewer draw calls', result.current.draws < result.old.draws);
    check('craft does not add triangles', result.current.triangles <= result.old.triangles);
    for (const label of ['rug', 'pot']) {
      check(label + ' has no open or nonmanifold welded edges', result[label].openOrNonManifoldEdges === 0);
      check(label + ' normals are finite and normalized', result[label].invalidNormals === 0);
      check(label + ' has no zero-area faces', result[label].degenerate === 0);
    }
    check('rug top and underside normals face outward', result.facing.rugTopZ > .99 && result.facing.rugBottomZ < -.99);
    check('pot outer and basin normals face outward from clay', result.facing.potOuterX > .9 && result.facing.potInnerX < -.9);
    check('rug underside contacts actual beveled deck with one millimeter clearance', Math.abs(result.rug.minY - result.deck.maxY - .001) < .00001);
    check('rug stays below previous floating surface', result.rug.maxY < .325);
    check('integrated pot keeps original ground contact', Math.abs(result.pot.minY - .24) < .00001);
    check('all generated normal textures use CanvasTexture flipY', result.normalInfo.allFlipY);
    check('leaf normal green follows upward texture V on both slopes', result.normalInfo.descendingCanvasSlopeGreen < 128 && result.normalInfo.ascendingCanvasSlopeGreen > 128);
    check('browser module execution has no errors', errors.length === 0);
    fs.writeFileSync(path.join(__dirname, 'verification.json'), JSON.stringify({ checkedAt: new Date().toISOString(), passed: checks.length, checks, errors, result }, null, 2));
    console.log({ passed: checks.length, errors, result });
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
