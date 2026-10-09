import * as THREE from './scene-assets/three.module.js';
import { makeCourtyard, makeLandscape } from './scene-v3-garden.mjs';
import { createMongleAvatar } from './avatar-v3.mjs';
import { createEnvironmentFinish } from './environment-v4.mjs';
import { addCourtyardDetails } from './courtyard-details-v5.mjs';
import { createGardenBreeze } from './garden-breeze-v5.mjs';
import { createSurfaceLibrary } from './surface-library-v6.mjs';
import { createContactLight } from './contact-light-v6.mjs';
import { createEnvironmentOptics } from './environment-optics-v7.mjs';
import { createRiverLife } from './river-life-v8.mjs';

// This home-screen art study is not the approved production mascot mesh.
// Its bell silhouette, scalloped hem, two black eyes and absence of arms/mouth
// follow docs/캐릭터/화면_1024/몽글_본체.webp. No mascot billboard is used.
const clamp = THREE.MathUtils.clamp;
const TAU = Math.PI * 2;
function random(seed = 9123) { let n = seed; return () => ((n = (1664525 * n + 1013904223) >>> 0) / 4294967296); }
function canvasTexture(size, draw, repeat = [1, 1], color = false) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(...repeat);
  if (color) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
function fiberTexture() {
  const rng = random(182);
  return canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = '#898989'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 11500; i++) {
      const x = rng() * s, y = rng() * s, n = Math.round(65 + rng() * 135);
      ctx.strokeStyle = `rgba(${n},${n},${n},.5)`; ctx.lineWidth = .4 + rng() * .6;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + rng() * 5 - 2.5, y + 2, x + rng() * 5 - 2.5, y + 2 + rng() * 3); ctx.stroke();
    }
  }, [4, 3]);
}
function noiseTexture() {
  const rng = random(233);
  return canvasTexture(128, (ctx, s) => {
    const data = ctx.createImageData(s, s);
    for (let i = 0; i < data.data.length; i += 4) { const n = 80 + rng() * 95; data.data[i] = data.data[i + 1] = data.data[i + 2] = n; data.data[i + 3] = 255; }
    ctx.putImageData(data, 0, 0);
  }, [3, 3]);
}
function knitTexture() {
  const rng = random(42);
  return canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = '#d6c4a6'; ctx.fillRect(0, 0, s, s);
    for (let j = -1; j < 17; j++) for (let i = -1; i < 13; i++) {
      const x = i * 22, y = j * 17;
      ctx.strokeStyle = '#a99474'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x + 2, y + 1); ctx.quadraticCurveTo(x + 3, y + 10, x + 11, y + 15); ctx.quadraticCurveTo(x + 19, y + 10, x + 20, y + 1); ctx.stroke();
      ctx.strokeStyle = '#f0e2c9'; ctx.lineWidth = 3.0;
      ctx.beginPath(); ctx.moveTo(x + 3, y + 1); ctx.quadraticCurveTo(x + 5, y + 9, x + 11, y + 14); ctx.moveTo(x + 19, y + 1); ctx.quadraticCurveTo(x + 17, y + 9, x + 12, y + 14); ctx.stroke();
    }
    for (let i = 0; i < 3700; i++) { const v = Math.round(110 + rng() * 130); ctx.strokeStyle = `rgba(${v},${v},${v},.13)`; ctx.lineWidth = .4; const x = rng() * s, y = rng() * s; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 2, y + 4); ctx.stroke(); }
  }, [6, 1], true);
}
function roundedBox(w, h, d, radius = .08) {
  const x = -w / 2, y = -h / 2, r = Math.min(radius, w / 2, h / 2), shape = new THREE.Shape();
  shape.moveTo(x + r, y); shape.lineTo(x + w - r, y); shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r); shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h); shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r); shape.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(.01, d - radius), bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: radius / 2, bevelThickness: radius / 2, curveSegments: 5 });
  g.translate(0, 0, -(d - radius) / 2); return g;
}
function mesh(parent, geo, material, p = [0, 0, 0], scale) {
  const m = new THREE.Mesh(geo, material); m.position.set(...p); if (scale) m.scale.set(...scale);
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function tube(parent, points, radius, material, closed = false, segments = 60) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), closed, 'catmullrom', .4);
  return mesh(parent, new THREE.TubeGeometry(curve, segments, radius, 5, closed), material);
}
function contactShadow(parent, p, size, opacity = .25) {
  const texture = canvasTexture(128, (ctx, s) => { const g = ctx.createRadialGradient(s / 2, s / 2, 4, s / 2, s / 2, s / 2); g.addColorStop(0, 'rgba(42,37,32,.9)'); g.addColorStop(.4, 'rgba(42,37,32,.48)'); g.addColorStop(1, 'rgba(42,37,32,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, s, s); });
  const m = mesh(parent, new THREE.PlaneGeometry(...size), new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity, depthWrite: false }), p);
  m.rotation.x = -Math.PI / 2; m.castShadow = m.receiveShadow = false; return m;
}
function makeMug(parent, materials, p) {
  const g = new THREE.Group(); parent.add(g); g.position.set(...p);
  mesh(g, new THREE.CylinderGeometry(.11, .095, .17, 28, 1, true), materials.ceramic, [0, .087, 0]);
  mesh(g, new THREE.TorusGeometry(.106, .011, 8, 28), materials.ceramic, [0, .172, 0]).rotation.x = Math.PI / 2;
  mesh(g, new THREE.CylinderGeometry(.095, .095, .006, 24), materials.tea, [0, .154, 0]);
  const handle = mesh(g, new THREE.TorusGeometry(.065, .018, 9, 22), materials.ceramic, [.11, .092, 0]); handle.scale.x = .9;
  return g;
}
export async function mountHomeScene(container, { onReady = () => {}, onError = () => {}, reducedMotion = false, quality: initialQuality = 'balanced' } = {}) {
  if (!container?.appendChild) throw new TypeError('A scene container is required.');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'default', preserveDrawingBuffer: true }); }
  catch (error) { onError(error); throw error; }
  const isMobile = () => container.clientWidth < 600;
  let quality=['balanced','detail','light'].includes(initialQuality)?initialQuality:'balanced',shaderFailed=false;
  renderer.debug.onShaderError=(gl,program)=>{if(shaderFailed)return;shaderFailed=true;console.error('SYNK_WORLD_SHADER_ERROR',gl.getProgramInfoLog(program));onError(new Error('3D 재질을 준비하지 못했어요. 다시 불러와 주세요.'));};
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(34, 1, .1, 160);
  scene.background = new THREE.Color('#b7d4df'); scene.fog = new THREE.Fog('#c1d5d8', 19, 135); renderer.setClearColor('#b7d4df', 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.VSMShadowMap;
  const contactLight = createContactLight({ renderer, scene, camera, quality, mobile: isMobile() });
  const canvas = renderer.domElement; canvas.className = 'world-scene-canvas'; canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:pan-y;cursor:grab;outline-offset:-5px';
  canvas.setAttribute('aria-label', '입체 테라스의 몽글. 좌우로 드래그하거나 방향키로 둘러보고, Enter 키로 인사할 수 있어요.'); canvas.tabIndex = 0;
  container.appendChild(canvas);
  const world = new THREE.Group(); scene.add(world);
  const surfaces = createSurfaceLibrary();
  const bump = fiberTexture(), grain = surfaces.wood, noise = noiseTexture(), leafMap = surfaces.leaf, knit = knitTexture();
  const felt = color => new THREE.MeshPhysicalMaterial({ color, roughness: .96, sheen: .78, sheenRoughness: .88, sheenColor: new THREE.Color(color).lerp(new THREE.Color('#fff1dc'), .40), bumpMap: bump, bumpScale: .019, side: THREE.DoubleSide });
  const materials = {
    coral: felt('#de6654'), sage: felt('#617550'), linen: felt('#d8c7a6'), scarf: felt('#e1d5b8'), thread: felt('#bf8b74'),
    eye: new THREE.MeshPhysicalMaterial({ color: '#100e0d', roughness: .17, clearcoat: .75, clearcoatRoughness: .12 }),
    glint: new THREE.MeshBasicMaterial({ color: '#fff3df' }),
    wood: new THREE.MeshStandardMaterial({ color: '#d5b991', map: grain, bumpMap: grain, bumpScale: .012, roughness: .62 }),
    darkWood: new THREE.MeshStandardMaterial({ color: '#826b53', roughness: .76, map: grain, bumpMap: grain, bumpScale: .018 }),
    terra: new THREE.MeshStandardMaterial({ color: '#b98b72', roughness: .86, bumpMap: noise, bumpScale: .018 }),
    ceramic: new THREE.MeshPhysicalMaterial({ color: '#dddcd0', roughness: .16, clearcoat: .85, clearcoatRoughness: .10 }),
    soil: new THREE.MeshStandardMaterial({ color: '#4b4836', roughness: 1, bumpMap: noise, bumpScale: .02 }),
    leaf: new THREE.MeshStandardMaterial({ color: '#567b48', roughness: .75, side: THREE.DoubleSide }),
    leafLight: new THREE.MeshStandardMaterial({ color: '#8b9a58', roughness: .7, side: THREE.DoubleSide }),
    leafVein: new THREE.MeshStandardMaterial({ color: '#9cab72', roughness: .88 }),
    stem: new THREE.MeshStandardMaterial({ color: '#6c7650', roughness: .9 }),
    stone: new THREE.MeshStandardMaterial({ color: '#b6b8af', roughness: .88, bumpMap: noise, bumpScale: .022 }),
    tea: new THREE.MeshStandardMaterial({ color: '#795536', roughness: .28 }),
    stoneLight: new THREE.MeshStandardMaterial({ color: '#cec8b9', roughness: .76, bumpMap: noise, bumpScale: .018 }),
    paving: new THREE.MeshStandardMaterial({ color: '#e2e3dc', roughness: .84, bumpMap: noise, bumpScale: .012 }),
    plaster: new THREE.MeshStandardMaterial({ color: '#e2ded3', roughness: .96, bumpMap: noise, bumpScale: .034 }),
    metal: new THREE.MeshStandardMaterial({ color: '#384d4b', roughness: .38, metalness: .72 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#bdccca', roughness: .10, metalness: .36, clearcoat: .9 }),
    roof: new THREE.MeshStandardMaterial({ color: '#354b50', roughness: .47, metalness: .30 }),
    foliage: new THREE.MeshStandardMaterial({ color: '#ffffff', map: leafMap, bumpMap: leafMap, bumpScale: .008, roughness: .83, side: THREE.DoubleSide, emissive: '#97a67d', emissiveIntensity: .025 }),
    bark: new THREE.MeshStandardMaterial({ color: '#74644c', roughness: .95, bumpMap: noise, bumpScale: .015 }),
    flower: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .86 }),
    water: new THREE.MeshPhysicalMaterial({ color: '#749d9d', roughness: .18, metalness: .65, clearcoat: .8 }),
  };
  for (const name of ['wood', 'darkWood']) {
    materials[name].map = surfaces.wood; materials[name].normalMap = surfaces.woodNormal;
    materials[name].normalScale = new THREE.Vector2(.28, .28); materials[name].bumpMap = null;
    materials[name].roughnessMap = surfaces.woodRoughness; materials[name].roughness = .92;
  }
  materials.wood.color.set('#fff1d7'); materials.darkWood.color.set('#bda787');
  for (const name of ['paving', 'stoneLight', 'stone']) {
    materials[name].map = surfaces.stone; materials[name].normalMap = surfaces.stoneNormal;
    materials[name].normalScale = new THREE.Vector2(name === 'paving' ? .32 : .44, name === 'paving' ? .32 : .44);
    materials[name].bumpMap = null; materials[name].roughnessMap = surfaces.stoneRoughness;
  }
  materials.paving.color.set('#f6f5ef'); materials.stoneLight.color.set('#e8dfcb'); materials.stone.color.set('#c9cdbf');
  materials.roof.metalness = .02; materials.roof.roughness = .76;
  materials.glass.color.set('#718681'); materials.glass.roughness = .13; materials.glass.envMapIntensity = 1.1;
  materials.foliage.map = surfaces.leaf; materials.foliage.normalMap = surfaces.leafNormal; materials.foliage.normalScale = new THREE.Vector2(.25, .25);
  materials.foliage.bumpMap = null; materials.foliage.roughnessMap = surfaces.leafRoughness; materials.foliage.roughness = .95;
  materials.foliage.emissiveIntensity = .012;
  materials.terra.userData.handThrown=true;
  const finish=createEnvironmentFinish(materials);
  materials.scarf.map = knit; materials.scarf.bumpMap = knit; materials.scarf.bumpScale = .009; materials.scarf.color.set('#fff8e6');
  const ambient = new THREE.HemisphereLight('#d6e9f5', '#8e8066', .92); scene.add(ambient);
  const key = new THREE.DirectionalLight('#fff0d1', 2.75); key.position.set(-3.5, 6, 4.5); key.castShadow = true; key.shadow.mapSize.set(isMobile() ? 1024 : 2048, isMobile() ? 1024 : 2048);
  Object.assign(key.shadow.camera, { left: -5.6, right: 5.6, top: 5.6, bottom: -5.6, near: .5, far: 22 }); key.shadow.normalBias = .018; key.shadow.bias = -.0003; key.shadow.radius = 10; key.shadow.blurSamples = 8; scene.add(key);
  const fill = new THREE.DirectionalLight('#b9dce4', .36); fill.position.set(3, 4, -4); scene.add(fill);
  const bounce = new THREE.DirectionalLight('#ead6ba', .28); bounce.position.set(0, 1, 5); scene.add(bounce);
  // A deliberately broad lit environment creates coherent reflections in the
  // eyes and glaze without shipping a photographic HDR background.
  const environment = canvasTexture(256, (ctx, s) => { const g = ctx.createLinearGradient(0, 0, 0, s); g.addColorStop(0, '#e7f0e9'); g.addColorStop(.45, '#e9e8d9'); g.addColorStop(.5, '#f5eddc'); g.addColorStop(.6, '#9fa598'); g.addColorStop(1, '#afb6a3'); ctx.fillStyle = g; ctx.fillRect(0, 0, s, s); ctx.fillStyle = '#fff9e9'; ctx.fillRect(45, 30, 24, 60); }, [1, 1], true);
  environment.mapping = THREE.EquirectangularReflectionMapping; const pmrem = new THREE.PMREMGenerator(renderer), envTarget = pmrem.fromEquirectangular(environment); scene.environment = envTarget.texture; scene.environmentIntensity = .63;
  const skyTextures = {}, skyTargets = {}, assetLoads = [];
  const loader = new THREE.TextureLoader(),assetFailures=[];
  function loadTexture(url){return new Promise((resolve,reject)=>{let settled=false;const fail=reason=>{if(settled)return;settled=true;clearTimeout(timer);assetFailures.push({url:new URL(url,location.href).pathname,reason});reject(new Error('OPTIONAL_TEXTURE_'+reason));};const timer=setTimeout(()=>fail('timeout'),12000);try{loader.load(url,texture=>{if(settled){texture.dispose();return;}settled=true;clearTimeout(timer);resolve(texture);},undefined,()=>fail('load-error'));}catch{fail('load-error');}});}

  const skySuffix = isMobile() ? '-mobile' : '';
  for (const [name, filename] of [['day', `azure-sky-v3${skySuffix}.jpg`], ['sunset', `golden-sky-v3${skySuffix}.jpg`]]) {
    assetLoads.push(loadTexture(new URL(`./scene-assets/graphics-v2/${filename}`, import.meta.url).href).then(texture => {
      texture.colorSpace = THREE.SRGBColorSpace; texture.mapping = THREE.EquirectangularReflectionMapping;
      skyTextures[name] = texture; skyTargets[name] = pmrem.fromEquirectangular(texture);
    }).catch(() => {}));
  }
  assetLoads.push(loadTexture(new URL('./scene-assets/graphics-v2/terrain-normal.jpg', import.meta.url).href).then(texture => {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(3, 3);
    materials.water.normalMap = texture; texture.repeat.set(90,38); materials.water.normalScale.set(.11,.07); materials.water.needsUpdate=true;
  }).catch(() => {}));
  assetLoads.push(loadTexture(new URL('./scene-assets/graphics-v3/terrain.jpg',import.meta.url).href).then(texture=>{texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(15,6);materials.landscapeMap=texture;}).catch(()=>{}));
  assetLoads.push(loadTexture(new URL('./scene-assets/graphics-v2/terrain-normal.jpg',import.meta.url).href).then(texture=>{texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(15,6);materials.landscapeNormal=texture;}).catch(()=>{}));
  await Promise.all(assetLoads); pmrem.dispose();
  scene.background = skyTextures.day || scene.background; scene.environment = skyTargets.day?.texture || envTarget.texture;
  scene.backgroundRotation.y = .65; scene.environmentRotation.y = .65; scene.backgroundIntensity = .95;
  const garden = makeCourtyard(world, materials, { mobile: isMobile() });
  const craft = addCourtyardDetails(world, materials);
  const breeze = createGardenBreeze(world, materials.foliage);
  contactShadow(world, [0, .240, .5], [1.92, 1.35], .47);
  const table = new THREE.Group(); table.position.set(-1.68, .27, .57); world.add(table);
  mesh(table, new THREE.CylinderGeometry(.38, .395, .075, 48), materials.stoneLight, [0, .48, 0]);
  mesh(table, new THREE.CylinderGeometry(.10, .18, .44, 32), materials.stoneLight, [0, .235, 0]);
  contactShadow(table, [0, -.025, 0], [.90, .90], .30); makeMug(table, materials, [-.085, .522, .04]);
  const book = mesh(table, roundedBox(.24, .036, .20, .014), materials.sage, [.13, .531, -.07]); book.rotation.y = -.2;
  const avatar = await createMongleAvatar({mobile:isMobile(),anisotropy:Math.min(8,renderer.capabilities.getMaxAnisotropy())});
  const mascot=avatar.group; world.add(mascot); mascot.position.set(0,.245,.45); avatar.setOutfit('apron');
  const backdrop = makeLandscape(scene, materials);
  const optics = createEnvironmentOptics({ foliage: materials.foliage, water: materials.water, backdrop });
  const riverLife = createRiverLife({ scene, mobile: isMobile() });
  let disposed = false, contextIsLost = false, active = true, visible = true, raf = 0, frameCount = 0, previousTime = 0, outfit = 'apron', time = 'day', yaw = 0, targetYaw = 0, greetingAt = -10000;
  let dragging = false, pointerX = 0, startYaw = 0, dirty = true, lastFrameAt = 0, renderSubmissionMs = 0, view = 'home';
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)'); let requestedReducedMotion=Boolean(reducedMotion),minimizeMotion = requestedReducedMotion || motionQuery.matches;
  const target = new THREE.Vector3(0, 1.08, 0);
  const cameraPosition = new THREE.Vector3(), cameraTarget = new THREE.Vector3(), homePosition = new THREE.Vector3();
  let cameraMoving = false;
  function frameCamera(immediate = false) {
    const aspect = camera.aspect, detail = view === 'detail';
    const lookX = detail ? 0 : aspect >= 1.6 ? -1.05 : 0;
    const distance = detail ? (aspect < 1 ? 5.2 : 4.7) : aspect < 1 ? 6.18 : aspect < 1.6 ? 6.55 : 6.4;
    cameraTarget.set(lookX, detail ? 1.46 : 1.10, detail ? .45 : -.1);
    homePosition.set(lookX + (detail ? .12 : .30), detail ? 2.12 : 2.56, distance);
    const dx = homePosition.x - cameraTarget.x, dz = homePosition.z - cameraTarget.z;
    cameraPosition.set(cameraTarget.x + dx * Math.cos(yaw) + dz * Math.sin(yaw), homePosition.y, cameraTarget.z - dx * Math.sin(yaw) + dz * Math.cos(yaw));
    if (immediate || minimizeMotion) { camera.position.copy(cameraPosition); target.copy(cameraTarget); cameraMoving = false; }
    else cameraMoving = true;
    camera.lookAt(target);
  }
  function resize() {
    if (disposed || contextIsLost || shaderFailed) return;
    const width = Math.max(1, container.clientWidth), height = Math.max(1, container.clientHeight), aspect = width / height;
    const shadowSize=quality==='light'?(width<600?512:1024):quality==='detail'?(width<600?1536:2048):(width<600?1024:2048);if(key.shadow.mapSize.x!==shadowSize){key.shadow.mapSize.set(shadowSize,shadowSize);key.shadow.map?.dispose();key.shadow.mapPass?.dispose();key.shadow.map=null;key.shadow.mapPass=null;key.shadow.needsUpdate=true;}
    const dprCap=quality==='light'?(width<600?1:1.25):quality==='detail'?2:(width<600?1.5:2);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,dprCap,Math.sqrt(3000000/(width*height)))); renderer.setSize(width, height, false); camera.aspect = aspect;
    camera.fov = 37; frameCamera(true); camera.updateProjectionMatrix(); contactLight.setQuality(quality, { mobile: width < 600 }); contactLight.setSize(); dirty = true; schedule();
  }
  function renderFrame(now) {
    raf = 0; if (disposed || contextIsLost || shaderFailed || !active || !visible || document.hidden) return;
    // A calm home uses a capped 30 Hz loop. Gestures and export force a frame.
    if (!minimizeMotion && now - lastFrameAt < 31 && !dirty) { schedule(); return; }
    lastFrameAt = now; const dt = Math.min(.1, (now - (previousTime || now)) / 1000); previousTime = now;
    breeze.update(dt, minimizeMotion); optics.update(dt, minimizeMotion); riverLife.update(dt, minimizeMotion);
    yaw += (targetYaw - yaw) * Math.min(1, dt * 9); frameCamera();
    if (cameraMoving) {
      const blend = Math.min(1, dt * 9); camera.position.lerp(cameraPosition, blend); target.lerp(cameraTarget, blend);
      cameraMoving = camera.position.distanceToSquared(cameraPosition) + target.distanceToSquared(cameraTarget) > .000001;
      if (!cameraMoving) { camera.position.copy(cameraPosition); target.copy(cameraTarget); }
      camera.lookAt(target);
    }
    const greeting = (now - greetingAt) / 1000;
    if (!minimizeMotion) {
      const active = greeting >= 0 && greeting < 1.2;
      mascot.position.y = .245 + (active ? Math.sin(greeting * Math.PI / 1.2) * .12 : Math.sin(now * .0017) * .011);
      mascot.rotation.z = active ? Math.sin(greeting * TAU / 1.2) * .105 : Math.sin(now * .0008) * .009;
      mascot.scale.set(1, 1 + Math.sin(now * .0017) * .005, 1);
    } else { mascot.position.y = .245; mascot.rotation.z = 0; mascot.scale.setScalar(1); }
    const renderStart=performance.now();contactLight.render();renderSubmissionMs=performance.now()-renderStart; frameCount++; dirty = false;
    if (!minimizeMotion || cameraMoving || Math.abs(targetYaw - yaw) > .001) schedule();
  }
  function schedule() { if (!raf && !disposed && !contextIsLost && !shaderFailed && active && visible && !document.hidden) raf = requestAnimationFrame(renderFrame); }
  function forceFrame() { dirty = true; schedule(); }
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(container);
  const intersection = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? true; if (visible) { previousTime = 0; forceFrame(); } else { cancelAnimationFrame(raf); raf = 0; } }, { threshold: 0.01 }); intersection.observe(container);
  function visibilityChange() { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else { previousTime = 0; forceFrame(); } }
  function motionChange() { minimizeMotion = requestedReducedMotion || motionQuery.matches; forceFrame(); }
  function pointerDown(e) { if (e.button !== 0 && e.pointerType === 'mouse') return; dragging = true; pointerX = e.clientX; startYaw = targetYaw; canvas.setPointerCapture?.(e.pointerId); canvas.style.cursor = 'grabbing'; }
  function pointerMove(e) { if (!dragging) return; targetYaw = clamp(startYaw + (e.clientX - pointerX) * .0035, -.35, .35); forceFrame(); }
  function pointerUp() { dragging = false; canvas.style.cursor = 'grab'; }
  function keyDown(e) { if (['ArrowLeft', 'ArrowRight', 'Home', 'Enter', ' '].includes(e.key)) e.preventDefault(); if (e.key === 'ArrowLeft') targetYaw = clamp(targetYaw - .09, -.35, .35); if (e.key === 'ArrowRight') targetYaw = clamp(targetYaw + .09, -.35, .35); if (e.key === 'Home') targetYaw = 0; if (e.key === 'Enter' || e.key === ' ') greet(); forceFrame(); }
  function greet() { greetingAt = performance.now(); forceFrame(); }
  canvas.addEventListener('pointerdown', pointerDown); canvas.addEventListener('pointermove', pointerMove); canvas.addEventListener('pointerup', pointerUp); canvas.addEventListener('pointercancel', pointerUp); canvas.addEventListener('keydown', keyDown);
  document.addEventListener('visibilitychange', visibilityChange); motionQuery.addEventListener?.('change', motionChange);
  function contextLost(event) { event.preventDefault(); contextIsLost=true; cancelAnimationFrame(raf); raf = 0; onError(new Error('3D 그래픽 연결이 잠시 끊겼어요. 새로고침하면 다시 볼 수 있어요.')); }
  canvas.addEventListener('webglcontextlost', contextLost);
  function setOutfit(value) { outfit = avatar.setOutfit(value); forceFrame(); return outfit; }
  function setDyes(value={}) { const dyes=avatar.setDyes(value);forceFrame();return dyes; }
  function setTime(value) {
    time = value === 'sunset' ? 'sunset' : 'day'; const sunset = time === 'sunset';
    scene.fog.color.set(sunset ? '#d6b8a5' : '#c1d5d8');
    key.color.set(sunset ? '#ffd0ae' : '#fff1dc'); key.intensity = sunset ? 2.85 : 2.95; key.position.set(sunset ? -6 : -4.8, sunset ? 3.2 : 5.8, sunset ? 2.4 : 3.4);
    key.shadow.intensity = .90;
    optics.setSun(key.position, key.color, sunset);
    riverLife.setTime(time);
    ambient.color.set(sunset ? '#c6c9e5' : '#d6e9f5'); ambient.groundColor.set(sunset ? '#847065' : '#858979'); ambient.intensity = sunset ? .59 : .65;
    craft.lantern.emissiveIntensity = sunset ? .42 : .045;
    fill.color.set(sunset ? '#aab8e1' : '#b9dce4'); fill.intensity = sunset ? .31 : .27; bounce.intensity=sunset?.21:.24;
    scene.background = skyTextures[time] || new THREE.Color(sunset ? '#d6b8a5' : '#b7d4df');
    scene.environment = skyTargets[time]?.texture || envTarget.texture; scene.backgroundIntensity = sunset ? .80 : .95;
    renderer.toneMappingExposure = sunset ? .97 : 1.0;
    forceFrame(); return time;
  }
  function metrics() { return { renderer: `Three.js r${THREE.REVISION}`, graphicsVersion: 3, visualRevision:'environment-v8', view, cameraYaw:Number(yaw.toFixed(4)), cameraMoving, quality, pixelRatio:renderer.getPixelRatio(), shadowMapSize:key.shadow.mapSize.x, active, contextLost:contextIsLost, shaderError:shaderFailed, renderSubmissionMs, renderStatsIncludeShadows:true, contactLight:contactLight.metrics(), surfaceMaps:surfaces.stats, optics:optics.metrics(), riverLife:riverLife.metrics, roofCraft:garden.roofCraft, assetFailures:[...assetFailures,...(avatar.metrics().assetFailures||[])], avatarVersion: avatar.metrics().avatarVersion, drawingBuffer: { width: canvas.width, height: canvas.height }, dpr: renderer.getPixelRatio(), drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, lines: renderer.info.render.lines, instancedFoliage: garden.foliageCount, frameCount, outfit, dyes:avatar.getDyes(), time, paused: !active || contextIsLost || shaderFailed || !visible || document.hidden, reducedMotion: minimizeMotion, productionAsset: false }; }
  function setView(value) { const next = value === 'detail' ? 'detail' : 'home'; if (next === view) return view; view = next; targetYaw = yaw = 0; frameCamera(); forceFrame(); return view; }
  function setReducedMotion(value){requestedReducedMotion=Boolean(value);minimizeMotion=requestedReducedMotion||motionQuery.matches;forceFrame();return minimizeMotion;}
  function setActive(value){active=Boolean(value);if(!active){cancelAnimationFrame(raf);raf=0;}else{previousTime=0;forceFrame();}return active;}
  function setQuality(value){const next=['balanced','detail','light'].includes(value)?value:'balanced';if(next===quality)return quality;quality=next;resize();forceFrame();return quality;}

  function capture({highResolution=false}={}) {
    if(disposed||contextIsLost||shaderFailed||renderer.getContext().isContextLost())throw new Error(disposed?'SCENE_DISPOSED':shaderFailed?'SCENE_SHADER_ERROR':'SCENE_CONTEXT_LOST');
    const previousDpr=renderer.getPixelRatio(),size=renderer.getSize(new THREE.Vector2());
    try{
      if(highResolution){const photoDpr=Math.min(4,1920/Math.max(size.x,size.y),Math.sqrt(2600000/(size.x*size.y)));renderer.setPixelRatio(photoDpr);renderer.setSize(size.x,size.y,false);}
      contactLight.render();
      if(contextIsLost||shaderFailed||renderer.getContext().isContextLost())throw new Error(shaderFailed?'SCENE_SHADER_ERROR':'SCENE_CONTEXT_LOST');
      return canvas.toDataURL('image/png');
    } finally {
      if(highResolution&&!disposed&&!contextIsLost&&!shaderFailed&&!renderer.getContext().isContextLost()){renderer.setPixelRatio(previousDpr);renderer.setSize(size.x,size.y,false);contactLight.render();}
      forceFrame();
    }
  }

  function dispose() {
    if (disposed) return; disposed = true; cancelAnimationFrame(raf); resizeObserver.disconnect(); intersection.disconnect(); document.removeEventListener('visibilitychange', visibilityChange); motionQuery.removeEventListener?.('change', motionChange);
    for (const [type, fn] of [['pointerdown', pointerDown], ['pointermove', pointerMove], ['pointerup', pointerUp], ['pointercancel', pointerUp], ['keydown', keyDown], ['webglcontextlost', contextLost]]) canvas.removeEventListener(type, fn);
    avatar.dispose();
    const geometries = new Set(), materialSet = new Set(Object.values(materials).filter(m=>m?.isMaterial)), textures = new Set([bump, grain, noise, leafMap, knit, environment, ...Object.values(skyTextures), ...Object.values(materials).filter(m=>m?.isTexture)]);
    scene.traverse(object => {
      // Instance transforms/colors have their own GPU buffers, separate from
      // the shared geometry; geometry.dispose() does not release those.
      if (object.isInstancedMesh) object.dispose();
      if (object.geometry) geometries.add(object.geometry);
      const list = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
      list.forEach(m => { materialSet.add(m); for (const value of Object.values(m)) if (value?.isTexture) textures.add(value); });
    });
    key.shadow.dispose();finish.dispose();breeze.dispose();contactLight.dispose();optics.dispose();riverLife.dispose();
    geometries.forEach(g => g.dispose()); materialSet.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); envTarget.dispose(); Object.values(skyTargets).forEach(t => t.dispose());
    renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
  }
  const api = { setOutfit, setDyes, getDyes:()=>avatar.getDyes(), setTime, setQuality, setView, setActive, setReducedMotion, greet, capture, dispose, metrics };
  try {
    setTime('day'); setQuality(quality); resize(); contactLight.render();
    if (shaderFailed) throw new Error('SCENE_SHADER_ERROR');
  } catch (error) {
    const notifyFailure = !shaderFailed && !contextIsLost;
    dispose();
    if (notifyFailure) onError(error);
    throw error;
  }
  onReady(api); schedule(); return api;
}
