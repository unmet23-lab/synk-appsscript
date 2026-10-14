import * as THREE from './scene-assets/three.module.js';
import { SSAOPass } from './scene-assets/rendering/SSAOPass.js';
import { OutputPass } from './scene-assets/rendering/OutputPass.js';
import { waitForShaderPrograms, yieldForShaderPreparation, runShaderPreparationTasks } from './shader-preparation.mjs';

// Optional contact AO. The beauty buffer remains full resolution; normals/AO
// are half resolution and capped. Mobile balanced/light allocate no buffers.
// Three's render-target path stays linear, followed by one official OutputPass.
export function createContactLight({ renderer, scene, camera, quality = 'balanced', mobile = false } = {}) {
  if (!renderer?.isWebGLRenderer || !scene?.isScene || !camera?.isPerspectiveCamera) throw new TypeError('CONTACT_SCENE_REQUIRED');
  const originalRender = renderer.render.bind(renderer);
  const pixelSize = new THREE.Vector2();
  let disposed = false, beauty = null, ao = null, output = null;
  let frameCalls = 0, frameTriangles = 0, width = 1, height = 1, aw = 1, ah = 1;
  let lastMs = 0, allocations = 0, releases = 0;
  let currentQuality = quality, isMobile = Boolean(mobile);
  const preparations = new Set();
  const wantsAO = () => currentQuality === 'detail' || currentQuality === 'balanced' && !isMobile;
  const release = () => {
    for (const preparation of preparations) preparation.abort();
    if (!beauty) return;
    beauty.dispose(); ao.dispose(); output.dispose(); beauty = ao = output = null; releases++;
  };
  function allocate() {
    if (beauty || !wantsAO()) return;
    beauty = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: true, depthTexture: new THREE.DepthTexture(1, 1, THREE.UnsignedIntType), stencilBuffer: false, samples: 2 });
    beauty.texture.name = 'SYNK contact beauty linear';
    ao = new SSAOPass(scene, camera, 1, 1, 12);
    ao.kernelRadius = .26;
    ao.minDistance = .00012;
    ao.maxDistance = .003;
    ao.renderToScreen = false;
    // Stable kernels make before/after captures and view changes deterministic.
    let seed = 3169;
    const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    ao.kernel.forEach((v, i) => v.set(random() * 2 - 1, random() * 2 - 1, random()).normalize().multiplyScalar(.1 + .9 * (i / ao.kernel.length) ** 2));
    ao.noiseTexture.image.data.forEach((_, i, values) => { values[i] = random(); }); ao.noiseTexture.needsUpdate = true;
    // Far scenery and the sky retain the exact beauty pass. Contact AO is only
    // a local cue, not another fog or global color grade.
    ao.ssaoMaterial.fragmentShader = ao.ssaoMaterial.fragmentShader.replace('if ( depth == 1.0 )', 'if ( depth >= 0.999999 || -getViewZ( depth ) > 18.0 )');
    ao.copyMaterial.uniforms.opacity.value = .43;
    ao.copyMaterial.uniforms.tContactDepth = { value: ao.normalRenderTarget.depthTexture };
    ao.copyMaterial.fragmentShader = ao.copyMaterial.fragmentShader
      .replace('uniform float opacity;', 'uniform float opacity;\nuniform highp sampler2D tContactDepth;')
      .replace('gl_FragColor = opacity * texel;', 'float depth = texture2D(tContactDepth, vUv).x;\ngl_FragColor = vec4(depth >= 0.999999 ? vec3(1.0) : mix(vec3(1.0), texel.rgb, opacity), 1.0);');
    // Avoid dark blur leaking across depth discontinuities, especially leaf/sky
    // edges. The kernel and AO itself remain the bundled Three.js shader.
    ao.blurMaterial.uniforms.tContactDepth = { value: ao.normalRenderTarget.depthTexture };
    ao.blurMaterial.fragmentShader = ao.blurMaterial.fragmentShader
      .replace('uniform vec2 resolution;', 'uniform vec2 resolution;\nuniform highp sampler2D tContactDepth;')
      .replace('float result = 0.0;', 'float result = 0.0; float weightSum = 0.0; float centerDepth = texture2D(tContactDepth, vUv).x;')
      .replace('result += texture2D( tDiffuse, vUv + offset ).r;', 'float sampleDepth = texture2D(tContactDepth, vUv + offset).x; float weight = exp(-abs(sampleDepth - centerDepth) * 1800.0); result += texture2D(tDiffuse, vUv + offset).r * weight; weightSum += weight;')
      .replace('result / ( 5.0 * 5.0 )', 'result / max(weightSum, 0.0001)');
    // Deformed foliage must not acquire a stationary phantom AO silhouette.
    // It still casts the existing animated sun shadow in the beauty render.
    const override = ao._overrideVisibility.bind(ao);
    ao._overrideVisibility = () => {
      override();
      scene.traverse(object => { if (object.visible && object.customDepthMaterial) { object.visible = false; ao._visibilityCache.push(object); } });
    };
    output = new OutputPass(); output.renderToScreen = true;
    // Three deliberately bypasses tone mapping for an sRGB photographic sky
    // (or a clear Color). Preserve that exception after offscreen rendering.
    output.uniforms.tBeautyDepth = { value: beauty.depthTexture };
    output.uniforms.skipBackgroundToneMap = { value: true };
    output.material.fragmentShader = output.material.fragmentShader
      .replace('uniform sampler2D tDiffuse;', 'uniform sampler2D tDiffuse;\nuniform highp sampler2D tBeautyDepth;\nuniform bool skipBackgroundToneMap;')
      .replace('// tone mapping', 'bool isBackground = texture2D(tBeautyDepth, vUv).x >= 0.999999;\nif (!skipBackgroundToneMap || !isBackground) {\n// tone mapping')
      .replace('// color space', '}\n// color space');
    allocations++;
  }
  function resizeTargets() {
    renderer.getDrawingBufferSize(pixelSize);
    const w = Math.max(1, Math.floor(pixelSize.x)), h = Math.max(1, Math.floor(pixelSize.y));
    const factor = Math.min(.5, 960 / Math.max(w, h));
    const nextAW = Math.max(1, Math.round(w * factor)), nextAH = Math.max(1, Math.round(h * factor));
    if (w !== width || h !== height || beauty?.width !== w || beauty?.height !== h) { width = w; height = h; beauty?.setSize(w, h); }
    if (ao && (aw !== nextAW || ah !== nextAH || ao.width !== nextAW || ao.height !== nextAH)) { aw = nextAW; ah = nextAH; ao.setSize(aw, ah); }
    if (ao) {
      const samples = currentQuality === 'detail' ? 12 : 8;
      if (ao.ssaoMaterial.defines.KERNEL_SIZE !== samples) { ao.ssaoMaterial.defines.KERNEL_SIZE = samples; ao.ssaoMaterial.needsUpdate = true; }
      ao.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(camera.projectionMatrix);
      ao.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(camera.projectionMatrixInverse);
      ao.ssaoMaterial.uniforms.cameraNear.value = camera.near; ao.ssaoMaterial.uniforms.cameraFar.value = camera.far;
    }
  }
  function setSize() { if (disposed) return; resizeTargets(); }
  function setQuality(value, { mobile: nextMobile = isMobile } = {}) {
    currentQuality = ['light', 'balanced', 'detail'].includes(value) ? value : 'balanced'; isMobile = Boolean(nextMobile);
    if (!wantsAO()) release();
    return currentQuality;
  }
  /** Queue the same shader variants as render(), without drawing a frame. */
  async function prepare({ signal } = {}) {
    if (disposed) throw new Error('CONTACT_DISPOSED');
    if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new DOMException('Contact preparation cancelled', 'AbortError');
    if (renderer.getContext().isContextLost()) throw new Error('CONTACT_CONTEXT_LOST');
    const preparation = new AbortController(), abort = () => preparation.abort(signal?.reason);
    preparations.add(preparation); signal?.addEventListener('abort', abort, { once: true });
    const previousTarget = renderer.getRenderTarget();
    const proxies = [], normals = [], textures = new Set();
    const quadGeometry = new THREE.BufferGeometry();
    quadGeometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, 3, 0, -1, -1, 0, 3, -1, 0], 3));
    quadGeometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 2, 0, 0, 2, 0], 2));
    const quad = new THREE.Mesh(quadGeometry, null), quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    function checkActive() {
      if (preparation.signal.aborted) throw preparation.signal.reason instanceof Error ? preparation.signal.reason : new DOMException('Contact preparation cancelled', 'AbortError');
      if (disposed) throw new Error('CONTACT_DISPOSED');
      if (renderer.getContext().isContextLost()) throw new Error('CONTACT_CONTEXT_LOST');
    }
    function addTexture(texture) {
      if (texture?.isTexture && !texture.isRenderTargetTexture && !texture.isDepthTexture) textures.add(texture);
    }
    function compile(object, view, target, targetScene = null) {
      checkActive();
      const restoreTarget = renderer.getRenderTarget(), restoreFace = renderer.getActiveCubeFace(), restoreLevel = renderer.getActiveMipmapLevel();
      try { renderer.setRenderTarget(target); renderer.compile(object, view, targetScene); }
      finally { renderer.setRenderTarget(restoreTarget, restoreFace, restoreLevel); }
    }
    try {
      const enabled = wantsAO();
      if (enabled) { allocate(); resizeTargets(); }
      // compile() visits invisible descendants and ignores overrideMaterial.
      // A shallow visible-only proxy retains instancing/skinning/geometry flags
      // while sharing the original materials and their compiled programs.
      scene.traverseVisible(object => {
        if (!(object.isMesh || object.isPoints || object.isLine || object.isSprite) || !object.layers.test(camera.layers)) return;
        const proxy = object.clone(false); proxy.material = scene.overrideMaterial || object.material; proxies.push(proxy);
        for (const material of Array.isArray(proxy.material) ? proxy.material : [proxy.material]) {
          for (const value of Object.values(material || {})) addTexture(value);
          for (const uniform of Object.values(material?.uniforms || {})) {
            for (const value of Array.isArray(uniform.value) ? uniform.value : [uniform.value]) addTexture(value);
          }
        }
        if (enabled && object.isMesh && !object.customDepthMaterial) {
          const normal = object.clone(false); normal.material = ao.normalMaterial; normals.push(normal);
        }
      });
      addTexture(scene.environment); addTexture(scene.background);
      if (enabled) addTexture(ao.noiseTexture);
      // Upload only the visible look, one texture per task. Render-target/depth
      // textures belong to their passes and must not be uploaded as image data.
      for (const texture of textures) {
        checkActive(); renderer.initTexture(texture);
        await yieldForShaderPreparation({ signal: preparation.signal });
      }
      checkActive();
      const tasks = proxies.map(proxy => () => compile(proxy, camera, enabled ? beauty : previousTarget, scene));
      if (enabled) {
        tasks.push(...normals.map(normal => () => compile(normal, camera, ao.normalRenderTarget, scene)));
        for (const [material, target] of [[ao.ssaoMaterial, ao.ssaoRenderTarget], [ao.blurMaterial, ao.blurRenderTarget], [ao.copyMaterial, beauty]]) {
          tasks.push(() => { quad.material = material; compile(quad, quadCamera, target); });
        }
        // Match OutputPass.render() before its first draw. Its subsequent
        // needsUpdate reuses this identical program cache key.
        const defines = {};
        if (THREE.ColorManagement.getTransfer(renderer.outputColorSpace) === THREE.SRGBTransfer) defines.SRGB_TRANSFER = '';
        const toneMaps = [[THREE.LinearToneMapping, 'LINEAR_TONE_MAPPING'], [THREE.ReinhardToneMapping, 'REINHARD_TONE_MAPPING'], [THREE.CineonToneMapping, 'CINEON_TONE_MAPPING'], [THREE.ACESFilmicToneMapping, 'ACES_FILMIC_TONE_MAPPING'], [THREE.AgXToneMapping, 'AGX_TONE_MAPPING'], [THREE.NeutralToneMapping, 'NEUTRAL_TONE_MAPPING'], [THREE.CustomToneMapping, 'CUSTOM_TONE_MAPPING']];
        const tone = toneMaps.find(([value]) => value === renderer.toneMapping);
        if (tone) defines[tone[1]] = '';
        output.material.defines = defines; output.material.needsUpdate = true;
        tasks.push(() => { quad.material = output.material; compile(quad, quadCamera, null); });
      }
      await runShaderPreparationTasks(tasks, { signal: preparation.signal });
      checkActive();
      return await waitForShaderPrograms(renderer, { signal: preparation.signal });
    } finally {
      signal?.removeEventListener('abort', abort); preparations.delete(preparation);
      // Abort/context loss may already have disposed the owning renderer.
      // Every compile restores its target synchronously before yielding.
      quadGeometry.dispose();
    }
  }
  function render() {
    if (disposed) throw new Error('CONTACT_DISPOSED');
    if (renderer.getContext().isContextLost()) throw new Error('CONTACT_CONTEXT_LOST');
    const start = performance.now(), previousAutoReset = renderer.info.autoReset;
    const previousTarget = renderer.getRenderTarget(), previousOverride = scene.overrideMaterial, previousBackground = scene.background;
    const previousShadowAuto = renderer.shadowMap.autoUpdate, previousShadowUpdate = renderer.shadowMap.needsUpdate;
    const previousAutoClear = renderer.autoClear, previousClearAlpha = renderer.getClearAlpha(), previousClear = renderer.getClearColor(new THREE.Color());
    const previousViewport = renderer.getViewport(new THREE.Vector4()), previousScissor = renderer.getScissor(new THREE.Vector4()), previousScissorTest = renderer.getScissorTest();
    renderer.info.autoReset = false; renderer.info.reset();
    try {
      if (!wantsAO()) { release(); originalRender(scene, camera); }
      else {
        allocate(); resizeTargets();
        renderer.setRenderTarget(beauty); renderer.autoClear = true; originalRender(scene, camera);
        renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = false;
        scene.background = null;
        ao.render(renderer, null, beauty);
        scene.background = previousBackground; scene.overrideMaterial = previousOverride;
        output.uniforms.skipBackgroundToneMap.value = Boolean(previousBackground?.isColor || previousBackground?.colorSpace === THREE.SRGBColorSpace);
        output.render(renderer, null, beauty);
      }
      frameCalls = renderer.info.render.calls; frameTriangles = renderer.info.render.triangles;
      lastMs = performance.now() - start;
    } finally {
      ao?._restoreVisibility();
      scene.overrideMaterial = previousOverride; scene.background = previousBackground;
      renderer.shadowMap.autoUpdate = previousShadowAuto; renderer.shadowMap.needsUpdate = previousShadowUpdate;
      renderer.autoClear = previousAutoClear; renderer.setClearColor(previousClear, previousClearAlpha);
      renderer.setRenderTarget(previousTarget); renderer.setViewport(previousViewport); renderer.setScissor(previousScissor); renderer.setScissorTest(previousScissorTest);
      renderer.info.autoReset = previousAutoReset;
    }
  }
  function metrics() {
    const enabled = Boolean(beauty) && wantsAO();
    // RGBA16F resolved beauty (8) + depth (4), plus two MSAA samples of each;
    // three half-size RGBA16F buffers (24), normal depth (4), and two spare
    // default depth buffers (8). Driver alignment/internal copies excluded.
    const estimatedTargetBytes = enabled ? width * height * 36 + aw * ah * 36 : 0;
    return { enabled, quality: currentQuality, mobile: isMobile, passCount: enabled ? 6 : 1, aoSamples: enabled ? currentQuality === 'detail' ? 12 : 8 : 0,
      beautySize: enabled ? [width, height] : null, aoSize: enabled ? [aw, ah] : null, msaaSamples: enabled ? 2 : 0, estimatedTargetBytes,
      drawCalls: frameCalls, triangles: frameTriangles, cpuSubmissionMs: lastMs, allocations, releases, disposed };
  }
  function dispose() { if (disposed) return; release(); disposed = true; }
  setQuality(quality, { mobile });
  return { setSize, setQuality, prepare, render, dispose, metrics };
}
