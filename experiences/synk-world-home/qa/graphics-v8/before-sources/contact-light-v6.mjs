import * as THREE from './scene-assets/three.module.js';
import { SSAOPass } from './scene-assets/rendering/SSAOPass.js';
import { OutputPass } from './scene-assets/rendering/OutputPass.js';

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
  const wantsAO = () => currentQuality === 'detail' || currentQuality === 'balanced' && !isMobile;
  const release = () => {
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
  return { setSize, setQuality, render, dispose, metrics };
}
