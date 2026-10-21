// CPU surface-data and ownership inspection. This is not a rendered GPU proof.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const town = path.resolve(__dirname, '../..');
const dataURL = value => `data:text/javascript;base64,${Buffer.from(value).toString('base64')}`;
async function main() {
  const file = path.join(town, 'day-materials.mjs'), source = fs.readFileSync(file, 'utf8');
  const threeURL = pathToFileURL(path.resolve(town, '../synk-world-home/scene-assets/three.module.js')).href;
  const T = await import(threeURL);
  const { applyTownMaterials, TOWN_BRAND } = await import(dataURL(source.replace("'/scene-assets/three.module.js'", JSON.stringify(threeURL))));
  const checks = [], surfaces = [], check = (name, ok, details) => checks.push({ name, ok: !!ok, ...(details ? { details } : {}) });
  const makeMaterials = () => Object.fromEntries(['wood', 'darkWood', 'plaster', 'plasterWarm', 'stone', 'roofSlate', 'roofTerra', 'roofSage', 'ceramic', 'glass', 'brass', 'frame', 'paper', 'awning', 'water'].map(k => [k, new T.MeshPhysicalMaterial({color:'#ffffff'})]));
  const beforeSource = fs.readFileSync(path.join(__dirname, 'source-before/day-materials.mjs'), 'utf8');
  const old = await import(dataURL(beforeSource.replace("'/scene-assets/three.module.js'", JSON.stringify(threeURL))));
  const oldMaterials = makeMaterials(), oldArt = old.applyTownMaterials(oldMaterials, 4);
  const m = makeMaterials();
  let textureDisposeCalls = 0;
  const originalDispose = T.Texture.prototype.dispose;
  T.Texture.prototype.dispose = function () { textureDisposeCalls++; return originalDispose.call(this); };
  const started = performance.now(), art = applyTownMaterials(m, 4), cpuGenerationMs = performance.now() - started;
  T.Texture.prototype.dispose = originalDispose;
  check('material-version-9', art.version === 9);
  check('brand-role-values-unchanged', JSON.stringify(TOWN_BRAND) === JSON.stringify(old.TOWN_BRAND));
  check('texture-count-budget-preserved', art.textures.length === oldArt.textures.length, { current: art.textures.length, before: oldArt.textures.length });
  check('generated-source-textures-released', textureDisposeCalls === 21, { textureDisposeCalls });
  check('owned-textures-unique', new Set(art.textures).size === art.textures.length);
  const images = new Set(); let uploadedBytes = 0, sourceBytes = 0;
  for (const [key, material] of Object.entries(m)) {
    check(`${key}-finite-colour-and-pbr`, ['r','g','b'].every(k => Number.isFinite(material.color[k]) && material.color[k] >= 0 && material.color[k] <= 1) && Number.isFinite(material.roughness) && material.roughness >= 0 && material.roughness <= 1 && Number.isFinite(material.metalness) && material.metalness >= 0 && material.metalness <= 1);
    for (const name of ['map', 'normalMap', 'roughnessMap']) {
      const texture = material[name]; if (!texture) continue;
      check(`${key}-${name}-owns-or-shares-an-owned-texture`, art.textures.includes(texture));
    }
  }
  for (const [i, texture] of art.textures.entries()) {
    const { data, width, height } = texture.image; uploadedBytes += data.byteLength;
    if (!images.has(data)) { images.add(data); sourceBytes += data.byteLength; }
    check(`texture-${i}-bounded-mipmapped-colourspace`, data instanceof Uint8Array && data.length === width * height * 4 && (width === 256 || width === 128) && width === height && texture.generateMipmaps && texture.minFilter === T.LinearMipmapLinearFilter && texture.anisotropy === 4 && [T.SRGBColorSpace,T.NoColorSpace].includes(texture.colorSpace));
  }
  const oldUploaded = oldArt.textures.reduce((sum, t) => sum + t.image.data.byteLength, 0);
  check('same-uploaded-texture-byte-budget', uploadedBytes === oldUploaded, { before: oldUploaded, current: uploadedBytes, sourceBytes });
  for (const key of ['wood','plaster','roofSlate','paving','cotton','foliage','water']) {
    const material = m[key], row = { key, materialColour: `#${material.color.getHexString()}` };
    for (const property of ['map','roughnessMap','normalMap']) {
      const texture = material[property]; if (!texture) continue;
      let min = 255, max = 0, sum = 0; const bytes = texture.image.data;
      for (let i = 0; i < bytes.length; i += 4) { min = Math.min(min, bytes[i]); max = Math.max(max, bytes[i]); sum += bytes[i]; }
      row[property] = { size: texture.image.width, min, max, mean: +(sum / (bytes.length / 4)).toFixed(2), sha256: sha(bytes) };
    }
    surfaces.push(row);
  }
  check('real-light-dark-wood-separation', m.darkWood.color.r < m.wood.color.r * .35 && m.darkWood.color.g < m.wood.color.g * .30);
  check('nonmetal-roof-and-ceramic', [m.roofSlate,m.roofTerra,m.roofSage,m.ceramic,m.glass,m.water].every(mat => mat.metalness === 0));
  check('glass-no-transmission-buffer-request', m.glass.transmission === 0);
  check('no-all-felt-surface-conversion', m.cotton.isMeshPhysicalMaterial && m.wood.normalMap !== m.cotton.normalMap && m.stone.normalMap !== m.cotton.normalMap && m.plaster.normalMap !== m.cotton.normalMap);
  for (const key of ['wood','darkWood']) {
    const shader = { vertexShader: T.ShaderLib.standard.vertexShader, fragmentShader: T.ShaderLib.standard.fragmentShader, uniforms:{} };
    m[key].onBeforeCompile(shader);
    check(`${key}-uv-hook-has-existing-three-chunk`, shader.vertexShader.includes('#include <uv_vertex>') && shader.vertexShader.includes('#ifdef USE_INSTANCING') && shader.vertexShader.includes('vMapUv = (mapTransform') && shader.vertexShader.includes('vNormalMapUv = (normalMapTransform') && shader.vertexShader.includes('vRoughnessMapUv = (roughnessMapTransform') && !shader.vertexShader.includes('undefined'));
    check(`${key}-fragment-pbr-preserved`, shader.fragmentShader === T.ShaderLib.standard.fragmentShader);
  }
  const disposed = new Map(art.textures.map(t => [t,0]));
  for (const texture of art.textures) texture.addEventListener('dispose', () => disposed.set(texture,disposed.get(texture)+1));
  art.textures.forEach(t => t.dispose());
  check('every-returned-texture-disposes-once', [...disposed.values()].every(n=>n===1));
  oldArt.textures.forEach(t=>t.dispose());
  Object.values(m).forEach(mat=>mat.dispose()); Object.values(oldMaterials).forEach(mat=>mat.dispose());
  const report = { scope:'CPU generated PBR surface-data, finite values, public palette, unchanged texture budgets and ownership. Does not compile GLSL or verify visual appearance on a GPU.', source:'experiences/synk-town/day-materials.mjs', sha256:sha(source), cpuGenerationMs:+cpuGenerationMs.toFixed(2), materials:Object.keys(m).length, ownedTextures:art.textures.length, sourceBytes, uploadedBytes, surfaces, checks, passed:checks.every(c=>c.ok) };
  fs.writeFileSync(path.join(__dirname,'materials-model.json'), JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({ passed:report.passed, checks:checks.length, cpuGenerationMs:report.cpuGenerationMs, textures:report.ownedTextures, uploadedBytes, sourceBytes, sha256:report.sha256, failures:checks.filter(c=>!c.ok) }));
  if (!report.passed) process.exitCode = 1;
}
main().catch(error=>{ console.error(error); process.exitCode=1; });
