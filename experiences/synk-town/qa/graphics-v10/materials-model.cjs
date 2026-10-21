// CPU inspection of actual material factories and shaders. No browser or GPU.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const town = path.resolve(__dirname, '../..'), sha = value => crypto.createHash('sha256').update(value).digest('hex');
const dataURL = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
async function main() {
  const file = path.join(town, 'day-materials.mjs'), source = fs.readFileSync(file, 'utf8'), beforeSource = fs.readFileSync(path.join(__dirname, 'source-before/day-materials.mjs'), 'utf8');
  const threeFile = path.resolve(town, '../synk-world-home/scene-assets/three.module.js'), threeURL = pathToFileURL(threeFile).href, T = await import(threeURL);
  const load = async source => import(dataURL(source.replace("'/scene-assets/three.module.js'", JSON.stringify(threeURL))));
  const old = await load(beforeSource), now = await load(source);
  const checks = [], check = (name, ok, details) => checks.push({ name, ok:!!ok, ...(details ? { details } : {}) });
  const standardKeys = ['wood','darkWood','plaster','plasterWarm','stone','roofSlate','roofTerra','roofSage','brass','frame','paper'];
  const makeMaterials = () => Object.fromEntries([...standardKeys.map(key=>[key,new T.MeshStandardMaterial({color:'#ffffff'})]), ...['ceramic','glass','awning','water'].map(key=>[key,new T.MeshPhysicalMaterial({color:'#ffffff'})])]);
  const oldMaterials=makeMaterials(), oldStarted=performance.now(), oldArt=old.applyTownMaterials(oldMaterials,4), oldGenerationMs=performance.now()-oldStarted;
  const m=makeMaterials(); let disposedSources=0; const originalDispose=T.Texture.prototype.dispose;
  T.Texture.prototype.dispose=function(){disposedSources++;return originalDispose.call(this);};
  const started=performance.now(); let art;
  try { art=now.applyTownMaterials(m,4); } finally { T.Texture.prototype.dispose=originalDispose; }
  const generationMs=performance.now()-started;
  const measure = art => {
    const sources=new Set(art.textures.map(t=>t.source)), sourcesWithParameters=new Set(art.textures.map(t=>[t.source.uuid,t.wrapS,t.wrapT,t.magFilter,t.minFilter,t.anisotropy,t.internalFormat,t.format,t.type,t.generateMipmaps,t.premultiplyAlpha,t.flipY,t.unpackAlignment,t.colorSpace].join(':')));
    return { textureObjects:art.textures.length, uniqueSources:sources.size, sourceAndParameterCombinations:sourcesWithParameters.size,
      uniqueSourceBaseLevelBytes:[...sources].reduce((n,s)=>n+s.data.data.byteLength,0), textureObjectDataBytesWithDuplicates:art.textures.reduce((n,t)=>n+t.image.data.byteLength,0) };
  };
  const before=measure(oldArt), current=measure(art), packedKeys=['wood','darkWood','plaster','plasterWarm','stone','roofSlate','roofTerra','roofSage','paving','cotton','awning','foliage','lapis','coral','butter','pop'];
  check('material-version10',art.version===10);
  check('frozen-v9-material-version9',oldArt.version===9);
  check('approved-palette-identical',JSON.stringify(now.TOWN_BRAND)===JSON.stringify(old.TOWN_BRAND));
  check('material-library-keys-and-count-preserved',JSON.stringify(Object.keys(m))===JSON.stringify(Object.keys(oldMaterials)) && new Set(Object.values(m)).size===new Set(Object.values(oldMaterials)).size);
  check('source-textures-released-after-cloning',disposedSources===14,{disposedSources});
  check('returned-textures-unique-and-count-reduced',new Set(art.textures).size===25 && before.textureObjects===37 && current.textureObjects===25);
  check('unique-sources19-to13',before.uniqueSources===19 && current.uniqueSources===13);
  check('source-and-parameter-combinations19-to13',before.sourceAndParameterCombinations===19 && current.sourceAndParameterCombinations===13);
  check('unique-baselevel-bytes-reduced',before.uniqueSourceBaseLevelBytes===4784128 && current.uniqueSourceBaseLevelBytes===3211264);
  check('duplicate-inclusive-data-bytes-reduced',before.textureObjectDataBytesWithDuplicates===9502720 && current.textureObjectDataBytesWithDuplicates===6356992);
  for(const [i,t] of art.textures.entries()) {
    const {width,height,data}=t.image;
    check(`texture-${i}-valid-mipmapped-budget`,data instanceof Uint8Array && data.length===width*height*4 && [128,256].includes(width) && width===height && t.generateMipmaps && t.minFilter===T.LinearMipmapLinearFilter && t.magFilter===T.LinearFilter && t.anisotropy===4 && t.wrapS===T.RepeatWrapping && t.wrapT===T.RepeatWrapping);
  }
  const surfaces=[];
  const stats = (texture,channel=0) => { const bytes=texture.image.data; let min=255,max=0,sum=0; for(let i=channel;i<bytes.length;i+=4){min=Math.min(min,bytes[i]);max=Math.max(max,bytes[i]);sum+=bytes[i];} return { min,max,mean:+(sum/(bytes.length/4)).toFixed(3) }; };
  for(const [key,material] of Object.entries(m)) {
    check(`${key}-finite-pbr-colour-and-opacity`,['r','g','b'].every(k=>Number.isFinite(material.color[k]) && material.color[k]>=0 && material.color[k]<=1) && ['roughness','metalness','opacity'].every(k=>Number.isFinite(material[k]) && material[k]>=0 && material[k]<=1));
    check(`${key}-colour-and-transparency-unchanged`,material.color.equals(oldMaterials[key].color) && material.opacity===oldMaterials[key].opacity && material.transparent===oldMaterials[key].transparent && material.depthWrite===oldMaterials[key].depthWrite && material.side===oldMaterials[key].side);
    for(const name of ['map','normalMap','roughnessMap']) if(material[name]) check(`${key}-${name}-returned-owned-reference`,art.textures.includes(material[name]));
  }
  const packedNormalChunk=T.ShaderChunk.normal_fragment_maps.replace('vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;','vec3 mapN = townSurfaceTexel.rgb * 2.0 - 1.0;');
  const roughBlock=/\n      float roughnessFactor = roughness;[\s\S]*?\n      #endif\n    /;
  const shader = material => { const s={vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,uniforms:{}}; material.onBeforeCompile(s);return s; };
  // This limited preprocessor exercises the actual inserted surface and Three
  // normal chunks, rather than counting samples in disabled fallback branches.
  const enabledSurface = (source,flags) => {
    const frames=[],out=[]; const active=()=>frames.every(frame=>frame.active);
    const condition=text=>{ const name=/defined\s*\(\s*(\w+)\s*\)/.exec(text);return name?flags.has(name[1]):flags.has(text.trim()); };
    for(const line of source.split('\n')){
      let match=/^\s*#(ifdef|ifndef)\s+(\w+)/.exec(line);
      if(match){const truth=flags.has(match[2])===(match[1]==='ifdef');frames.push({active:truth,seen:truth});continue;}
      match=/^\s*#elif\s+(.+)/.exec(line);if(match){const frame=frames.at(-1);frame.active=!frame.seen && condition(match[1]);frame.seen ||= frame.active;continue;}
      if(/^\s*#else\b/.test(line)){const frame=frames.at(-1);frame.active=!frame.seen;frame.seen=true;continue;}
      if(/^\s*#endif\b/.test(line)){frames.pop();continue;}
      if(active())out.push(line);
    }
    if(frames.length)throw Error('Unbalanced surface preprocessor');return out.join('\n');
  };
  for(const key of packedKeys) {
    const material=m[key], oldShader=shader(oldMaterials[key]), currentShader=shader(material), clone=material.clone(), secondClone=clone.clone();
    check(`${key}-no-separate-roughness-texture`,material.roughnessMap===null && material.normalMap.colorSpace===T.NoColorSpace && material.normalMapType===T.TangentSpaceNormalMap);
    check(`${key}-opaque-diffuse-alpha`,stats(material.map,3).min===255 && material.map.colorSpace===T.SRGBColorSpace);
    const rough=stats(material.normalMap,3), blue=stats(material.normalMap,2);
    check(`${key}-linear-roughness-alpha-and-normal-z`,rough.min>0 && rough.max<255 && blue.min>=240 && rough.mean<blue.mean);
    check(`${key}-preserves-existing-vertex-shader-and-uv`,currentShader.vertexShader===oldShader.vertexShader);
    const block=roughBlock.exec(currentShader.fragmentShader)?.[0];
    check(`${key}-preserves-all-other-fragment-code`,!!block && currentShader.fragmentShader.replace(block,'#include <roughnessmap_fragment>').replace(packedNormalChunk,'#include <normal_fragment_maps>')===oldShader.fragmentShader);
    const active=enabledSurface(`${block || ''}\n${packedNormalChunk}`,new Set(['USE_NORMALMAP','USE_NORMALMAP_TANGENTSPACE']));
    check(`${key}-one-normal-fetch-reused-for-roughness`,(active.match(/texture2D\(\s*normalMap\s*,/g)||[]).length===1 && !/texture2D\(\s*roughnessMap\s*,/.test(active) && active.includes('roughnessFactor *= townSurfaceTexel.a') && active.includes('vec3 mapN = townSurfaceTexel.rgb'));
    check(`${key}-clone-and-second-clone-keep-hooks`,clone.onBeforeCompile===material.onBeforeCompile && secondClone.onBeforeCompile===material.onBeforeCompile && clone.customProgramCacheKey()===material.customProgramCacheKey() && secondClone.customProgramCacheKey()===material.customProgramCacheKey());
    check(`${key}-clone-shaders-and-source-data-identical`,shader(clone).vertexShader===currentShader.vertexShader && shader(clone).fragmentShader===currentShader.fragmentShader && shader(secondClone).fragmentShader===currentShader.fragmentShader && clone.map===material.map && clone.normalMap===material.normalMap && clone.roughnessMap===null && clone.color.equals(material.color) && clone.constructor===material.constructor && clone.version>0);
    check(`${key}-stable-versioned-program-key`,material.customProgramCacheKey().endsWith('|town-normal-roughness-v10') && material.customProgramCacheKey()===material.customProgramCacheKey());
    if(['wood','plaster','roofSlate','paving','cotton','foliage'].includes(key)) surfaces.push({key,albedo:stats(material.map),roughness:rough,normalZ:blue,albedoSha256:sha(material.map.image.data),normalRoughnessSha256:sha(material.normalMap.image.data)});
    clone.dispose();secondClone.dispose();
  }
  for(const key of ['wood','roofSlate','stone','foliage']) check(`${key}-actual-surface-detail-data-refined`,sha(m[key].map.image.data)!==sha(oldMaterials[key].map.image.data));
  for(const key of ['water','glass','ceramic','paper','brass','frame']) check(`${key}-no-unrequested-packed-shader`,!m[key].customProgramCacheKey().includes('town-normal-roughness-v10'));
  check('water-single-normal-sample-and-roughness-preserved',m.water.normalMap && !m.water.roughnessMap && m.water.roughness===oldMaterials.water.roughness);
  check('glass-no-transmission-render-target',m.glass.transmission===0 && m.glass.transmission===oldMaterials.glass.transmission);
  check('foliage-emissive-remains-off',m.foliage.emissiveIntensity===0);
  const disposed=new Map(art.textures.map(t=>[t,0]));for(const t of art.textures)t.addEventListener('dispose',()=>disposed.set(t,disposed.get(t)+1));art.textures.forEach(t=>t.dispose());
  check('every-owned-texture-disposes-once',[...disposed.values()].every(n=>n===1));
  oldArt.textures.forEach(t=>t.dispose());Object.values(m).forEach(mat=>mat.dispose());Object.values(oldMaterials).forEach(mat=>mat.dispose());
  const report={scope:'CPU actual PBR surface-data, GLSL chunk composition/preprocessor, material clone/second-clone callback retention and ownership. Does not compile GPU GLSL, measure driver allocation, verify visual appearance or establish FPS gains.',
    source:'experiences/synk-town/day-materials.mjs',sha256:sha(source),baselineSha256:sha(beforeSource),threeSha256:sha(fs.readFileSync(threeFile)),materials:Object.keys(m).length,
    cpuGenerationDiagnostic:{beforeMs:+oldGenerationMs.toFixed(2),afterMs:+generationMs.toFixed(2),scope:'One generation each in this CPU process, not a controlled benchmark.'},
    textureBudget:{before,current,uniqueSourceBaseLevelReductionPercent:+((1-current.uniqueSourceBaseLevelBytes/before.uniqueSourceBaseLevelBytes)*100).toFixed(2),note:'uniqueSourceBaseLevelBytes is an RGBA data-size allocation estimate without mipmaps or driver overhead. textureObjectDataBytesWithDuplicates, including the historical v9 uploadedBytes field, double-counts shared Source clones and is not measured GPU upload/allocation.'},
    surfaceSamples:{before:3,after:2,appliedMaterials:packedKeys,scope:'Diffuse+normal+roughness on these mapped materials only; water keeps one normal sample, untextured materials are excluded.'},surfaces,checks,passed:checks.every(c=>c.ok)};
  fs.writeFileSync(path.join(__dirname,'materials-model.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({passed:report.passed,checks:checks.length,sha256:report.sha256,textureBudget:report.textureBudget,cpu:report.cpuGenerationDiagnostic,failures:checks.filter(c=>!c.ok)}));
  if(!report.passed)process.exitCode=1;
}
main().catch(error=>{console.error(error);process.exitCode=1;});
