// Lists every v20 mesh with what the town bake needs to classify it: owner group,
// instancing, geometry size, material key/colour, and how much lies in the core.
//   node experiences/synk-town/qa/blender-town-20261018/inspect.cjs <out.json>
const fs = require('node:fs'), path = require('node:path');
const L = require('../blender-district-20261017/lib.cjs');
const CORE = { minX: -13.6, maxX: 13.6, minZ: -12.2, maxZ: 8.7 };
(async () => {
  let browser;
  try {
    const { base } = await L.fixture(); browser = await L.launch();
    const { page } = await L.openTown(browser, base, { width: 1280, height: 900 });
    const rows = await page.evaluate(core => {
      const { THREE, world, m } = globalThis.__townDebug;
      const keys = new Map(Object.entries(m).map(([k, v]) => [v, k]));
      const inCore = (x, z) => x >= core.minX && x <= core.maxX && z >= core.minZ && z <= core.maxZ;
      const out = [], box = new THREE.Box3(), mat4 = new THREE.Matrix4(), v = new THREE.Vector3();
      world.updateMatrixWorld(true);
      world.traverse(o => {
        if (!o.isMesh) return;
        const chain = []; for (let p = o; p && p !== world; p = p.parent) chain.unshift(p.name || p.type);
        const mat = Array.isArray(o.material) ? o.material[0] : o.material;
        const geo = o.geometry; geo.computeBoundingBox();
        let inside = 0, total = 1;
        if (o.isInstancedMesh) {
          total = o.count;
          for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, mat4); v.setFromMatrixPosition(mat4.premultiply(o.matrixWorld)); if (inCore(v.x, v.z)) inside++; }
        } else { box.copy(geo.boundingBox).applyMatrix4(o.matrixWorld); const c = box.getCenter(v); inside = inCore(c.x, c.z) ? 1 : 0; }
        box.copy(geo.boundingBox).applyMatrix4(o.matrixWorld);
        out.push({ chain: chain.join('/'), name: o.name, instanced: !!o.isInstancedMesh, count: total, inside, verts: geo.attributes.position.count,
          tris: (geo.index ? geo.index.count : geo.attributes.position.count) / 3, material: keys.get(mat) || mat.name || mat.type, color: mat.color ? '#' + mat.color.getHexString() : null,
          transparent: !!mat.transparent, visible: o.visible, castShadow: o.castShadow,
          box: [box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z].map(n => +n.toFixed(2)) });
      });
      return out;
    }, CORE);
    fs.writeFileSync(path.resolve(process.argv[2] || 'inspect.json'), JSON.stringify(rows, null, 1));
    const byTop = {}; for (const r of rows) { const top = r.chain.split('/').slice(0, 2).join('/'); byTop[top] = (byTop[top] || 0) + 1; }
    console.log(JSON.stringify({ meshes: rows.length, byTop }, null, 1));
  } catch (e) { console.error(e.stack || e); process.exitCode = 1; } finally { await L.closeAll(browser); }
})();
