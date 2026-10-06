// 해안도로 3D 세계 만들기 — 도로·지형·바다·하늘·꽃밭·바위·풀·난간·표지판과 풍경 테마(app.js에서 옮김).
// 같은 씨앗의 난수를 같은 순서로 쓰므로, 만드는 순서(app.js init)를 바꾸면 풍경 배치가 달라진다.
import { buildCourseTerrain } from './render-world.js';
import { buildDistantCoast } from './landscape.js';
import { createAtmosphere } from './atmosphere.js';
import { createCoastalBoats } from './seascape-boats.js';
import { buildCityLife } from './city-life.js';
import { buildSceneryDetails } from './scenery.js';
import { ROAD_END, pathX, pathAngle, noise, terrainColorAt } from './course.js';

/** 씨앗이 같은 난수(풍경 배치가 매번 같다). */
export function seededRandom(seed) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}

/** 캔버스에 그린 결(도로 갓길·표지판·글자판·그림자)을 텍스처로. */
export function canvasTexture(THREE, renderer, size, paint) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  paint(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return t;
}

/**
 * W: { THREE, renderer, scene, light, ambientLight, sunDirection, scenery, textures, canopy:{pine,blossom}, random,
 *      roadPoint, groundHeight, worldTime, reducedMotion, startup }
 */
export function createWorldBuilder(W) {
  const { THREE, scene, scenery, random, roadPoint, groundHeight } = W;
  const tempObj = new THREE.Object3D();
  const texture = (size, paint) => canvasTexture(THREE, W.renderer, size, paint);

  function surfaceTexture(kind) {
    return texture(512, (ctx, size) => {
      const img = ctx.createImageData(size, size);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const n = random(), i = (y * size + x) * 4;
        const v = kind === 'road' ? 47 + n * 36 : 113 + n * 34;
        img.data[i] = v; img.data[i + 1] = kind === 'road' ? v + 2 : v + 4; img.data[i + 2] = kind === 'road' ? v + 3 : v - 13; img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      if (kind === 'road') {
        for (let j = 0; j < 14; j++) {
          let x = random() * size, y = random() * size;
          ctx.strokeStyle = 'rgba(15,20,21,.32)'; ctx.lineWidth = .4 + random(); ctx.beginPath(); ctx.moveTo(x, y);
          for (let k = 0; k < 12; k++) { x += (random() - .5) * 22; y += random() * 9; ctx.lineTo(x, y); }
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(10,13,17,.09)';
        for (const x of [110, 155, 235, 280, 360, 405]) ctx.fillRect(x, 0, 8, size);
      }
    });
  }

  /** 도로를 따라 놓는 띠(아스팔트·갓길·차선). */
  function ribbon(offset, width, start, end, material, dashed = false, height = .022) {
    const p = [], uv = [], idx = [];
    let vertex = 0;
    const step = dashed ? 7 : 3;
    for (let s = start; s < end; s += step) {
      const e = Math.min(end, s + (dashed ? 3.2 : step));
      for (const [t, o, u] of [[s, offset - width / 2, 0], [s, offset + width / 2, 1], [e, offset - width / 2, 0], [e, offset + width / 2, 1]]) {
        const v = roadPoint(t, o, height); p.push(v.x, v.y, v.z); uv.push(u * 3.4, t / 5.3);
      }
      idx.push(vertex, vertex + 2, vertex + 1, vertex + 1, vertex + 2, vertex + 3); vertex += 4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, material); mesh.receiveShadow = true; scene.add(mesh);
    return mesh;
  }

  function coastalTerrainMaterial() {
    const t = W.textures;
    const mat = new THREE.MeshStandardMaterial({ map: t.terrain, normalMap: t.terrainNormal, normalScale: new THREE.Vector2(.17, .17), vertexColors: true, roughness: 1, envMapIntensity: .25 });
    // 풀·밝은 바위·모래를 한 번의 그리기로 섞는다(모든 면에 풀색을 덧칠하지 않는다).
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.coastalRock = { value: t.cliff }; shader.uniforms.coastalSand = { value: t.beach };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float surface;\nvarying float vSurface;\nvarying vec3 vTerrainPosition;\nvarying vec3 vTerrainNormal;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSurface=surface;\nvTerrainPosition=position;\nvTerrainNormal=normal;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vSurface;\nvarying vec3 vTerrainPosition;\nvarying vec3 vTerrainNormal;\nuniform sampler2D coastalRock;\nuniform sampler2D coastalSand;')
        .replace('#include <map_fragment>', `#include <map_fragment>
      #ifdef USE_MAP
        vec3 weights=abs(normalize(vTerrainNormal));
        float rockBlend=weights.x/(weights.x+weights.z+.001);
        vec3 rockSample=mix(texture2D(coastalRock,vTerrainPosition.xy*.065).rgb,texture2D(coastalRock,vTerrainPosition.zy*.065).rgb,rockBlend);
        float stratum=.88+.12*sin(vTerrainPosition.y*.47+sin(vTerrainPosition.z*.021)*2.2);
        float mineral=.94+.09*sin(vTerrainPosition.x*.024+vTerrainPosition.z*.017);
        vec3 rockColor=mix(rockSample,vec3(dot(rockSample,vec3(.2126,.7152,.0722))),.22)*vec3(.47,.45,.41)*stratum*mineral;
        vec3 sandColor=mix(texture2D(coastalSand,vTerrainPosition.xz*.09).rgb,vec3(.20,.17,.12),.12);
        float meadow=sin(vTerrainPosition.x*.049+sin(vTerrainPosition.z*.014)*2.3)*sin(vTerrainPosition.z*.035)*.5+.5;
        float glade=sin(vTerrainPosition.x*.012-vTerrainPosition.z*.009)*.5+.5;
        vec3 grassTone=mix(vec3(.025,.043,.017),vec3(.064,.070,.032),meadow*.7+glade*.3);
        diffuseColor.rgb=mix(diffuseColor.rgb*vec3(.42,.53,.37),grassTone,.16+glade*.06);
        float cliffSlope=smoothstep(.16,.42,1.-abs(normalize(vTerrainNormal).y));
        diffuseColor.rgb=mix(diffuseColor.rgb,rockColor,max(clamp(vSurface,0.,1.),cliffSlope));
        diffuseColor.rgb=mix(diffuseColor.rgb,sandColor,clamp(vSurface-1.,0.,1.));
      #endif`)
        .replace('#include <tonemapping_fragment>', `float air=smoothstep(350.,2400.,length(vTerrainPosition-cameraPosition))*.17;
      gl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(.30,.48,.62),air);
      #include <tonemapping_fragment>`);
    };
    mat.customProgramCacheKey = () => 'coastal-terrain-v6';
    return mat;
  }

  function setupTerrain(prepared) {
    const t = W.textures, asphalt = t.road;
    asphalt.wrapS = asphalt.wrapT = THREE.RepeatWrapping;
    const asphaltMat = new THREE.MeshStandardMaterial({ map: asphalt, normalMap: t.roadNormal, normalScale: new THREE.Vector2(.12, .12), roughness: .96, metalness: 0, color: 0xb6bdc0, envMapIntensity: .12 });
    asphaltMat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb=mix(diffuseColor.rgb,vec3(.12,.135,.14),.24);');
    };
    asphaltMat.customProgramCacheKey = () => 'coastal-asphalt-v2';
    ribbon(0, 11.6, -65, ROAD_END, asphaltMat, false, 0);
    const shoulderTex = surfaceTexture('sand');
    shoulderTex.wrapS = shoulderTex.wrapT = THREE.RepeatWrapping;
    const shoulder = new THREE.MeshStandardMaterial({ map: shoulderTex, color: 0xb7b6a8, roughness: 1 });
    ribbon(-6.2, .8, -65, ROAD_END, shoulder, false, -.025); ribbon(6.2, .8, -65, ROAD_END, shoulder, false, -.025);
    const white = new THREE.MeshStandardMaterial({ color: 0xe7e5cb, roughness: .9 });
    const yellow = new THREE.MeshStandardMaterial({ color: 0xcfb466, roughness: .9 });
    ribbon(-5.45, .13, -60, ROAD_END, white); ribbon(5.45, .13, -60, ROAD_END, white);
    ribbon(-1.725, .1, -60, ROAD_END, white, true); ribbon(1.725, .1, -60, ROAD_END, white, true);
    ribbon(-5.72, .1, -60, ROAD_END, yellow); ribbon(5.72, .1, -60, ROAD_END, yellow);
    const options = { pathX, groundHeight, ROAD_END, material: coastalTerrainMaterial(), colorAt: terrainColorAt };
    if (prepared) {
      try { scenery.terrain = buildCourseTerrain(THREE, { ...options, prepared }); }
      catch { W.startup.terrainSource = 'fallback'; W.startup.terrainFallback = 'worker-data'; }
    }
    if (!scenery.terrain) scenery.terrain = buildCourseTerrain(THREE, options);
    scene.add(scenery.terrain.group);
  }

  function setupSky() {
    // 먼 곶에만 대기 원근을 준다. 해안은 또렷하게.
    scene.fog = new THREE.Fog(0x91bce0, 1800, 6500);
  }

  function setupWater(daySky, sunsetSky) {
    scenery.atmosphere = createAtmosphere(THREE, { daySky, sunsetSky, time: W.worldTime, sunDirection: W.sunDirection, shoreOffset: groundHeight.shoreOffset, groundHeight, pathX, ROAD_END });
    scene.add(scenery.atmosphere.ocean, scenery.atmosphere.sky);
    scene.background = null;
  }

  function setupCoastalScenery() {
    const coast = buildDistantCoast(THREE, { material: coastalTerrainMaterial(), roadPoint, pathX, groundHeight, ROAD_END, textures: { pineCanopy: W.canopy.pine }, random });
    scene.add(coast); scenery.coast = coast;
    scenery.boats = createCoastalBoats(THREE, { pathX, groundHeight });
    scene.add(scenery.boats.group);
  }

  function setupVegetation() {
    const t = W.textures;
    // 길가 돌·풀·난간은 수천 번 그리지 않고 인스턴스로.
    const rockGeometry = new THREE.IcosahedronGeometry(1, 1), rockVertices = rockGeometry.attributes.position;
    for (let i = 0; i < rockVertices.count; i++) {
      const x = rockVertices.getX(i), y = rockVertices.getY(i), z = rockVertices.getZ(i), j = .80 + noise(x * 3.7 + 4.2, z * 4.1 + y * 2.7) * .34;
      rockVertices.setXYZ(i, x * j + y * .13, y * (.82 + noise(x * 6, z * 7) * .23), z * j);
    }
    rockGeometry.computeVertexNormals();
    const rockMat = new THREE.MeshStandardMaterial({ map: t.cliff, normalMap: t.cliffNormal, normalScale: new THREE.Vector2(.32, .32), color: 0xc5bca9, roughness: .94, envMapIntensity: .22 });
    const rocks = new THREE.InstancedMesh(rockGeometry, rockMat, 180);
    let rockCount = 0;
    for (let i = 0; i < 180; i++) {
      const z = random() * ROAD_END, x = pathX(z) - (8 + random() * 25), s = .3 + random() * 1.4;
      tempObj.position.set(x, groundHeight(x, z) + s * .2, z); tempObj.rotation.set(random() * 3, random() * 3, random() * 3); tempObj.scale.set(s * 1.4, s * .65, s);
      if (scenery.city.containsFootprint(x, z, s * 1.5)) continue;
      tempObj.updateMatrix(); rocks.setMatrixAt(rockCount++, tempObj.matrix);
    }
    rocks.count = rockCount; rocks.receiveShadow = true; scene.add(rocks);
    const grassPositions = [], grassColors = [];
    for (let j = 0; j < 3; j++) {
      const a = j * 2.094, c = Math.cos(a), s = Math.sin(a), height = .28 + j * .055;
      grassPositions.push(-.032 * c, 0, -.032 * s, .032 * c, 0, .032 * s, .07 * c, height, .07 * s);
      grassColors.push(.035, .065, .018, .035, .065, .018, .105, .135, .043);
    }
    const grassGeometry = new THREE.BufferGeometry();
    grassGeometry.setAttribute('position', new THREE.Float32BufferAttribute(grassPositions, 3));
    grassGeometry.setAttribute('color', new THREE.Float32BufferAttribute(grassColors, 3));
    grassGeometry.computeVertexNormals();
    const grassMat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 1, envMapIntensity: .2 });
    const grass = new THREE.InstancedMesh(grassGeometry, grassMat, 4500);
    let grassCount = 0;
    for (let i = 0; i < 4500; i++) {
      const z = random() * ROAD_END, side = random() > .65 ? 1 : -1, off = side * (6.9 + random() * 6), x = pathX(z) + off;
      tempObj.position.set(x, groundHeight(x, z) + .005, z); tempObj.rotation.set(0, random() * Math.PI, (random() - .5) * .15);
      tempObj.scale.set(.6 + random() * .6, .5 + random() * .65, .6 + random() * .6);
      if (scenery.city.containsFootprint(x, z, .25)) continue;
      tempObj.updateMatrix(); grass.setMatrixAt(grassCount++, tempObj.matrix);
    }
    grass.count = grassCount; grass.receiveShadow = true; scene.add(grass);
    scenery.groundProps = { rocks: rockCount, grass: grassCount, excludedRocks: 180 - rockCount, excludedGrass: 4500 - grassCount };
    const railMat = new THREE.MeshStandardMaterial({ color: 0xa8b5b3, metalness: .68, roughness: .48 });
    const rail = new THREE.InstancedMesh(new THREE.BoxGeometry(.12, .33, 5.1), railMat, 440);
    const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(.11, .85, .14), railMat, 440);
    const reflectors = new THREE.InstancedMesh(new THREE.BoxGeometry(.03, .11, .16), new THREE.MeshStandardMaterial({ color: 0xe6ae49, roughness: .5 }), 220);
    for (let i = 0; i < 440; i++) {
      const s = i * 5.1, p = roadPoint(s, 6.85, .65);
      tempObj.position.copy(p); tempObj.rotation.set(0, pathAngle(s), 0); tempObj.scale.set(1, 1, 1); tempObj.updateMatrix(); rail.setMatrixAt(i, tempObj.matrix);
      tempObj.position.copy(roadPoint(s, 6.85, .32)); tempObj.updateMatrix(); posts.setMatrixAt(i, tempObj.matrix);
      if (i % 2 === 0) { tempObj.position.copy(roadPoint(s, 6.76, .69)); tempObj.updateMatrix(); reflectors.setMatrixAt(i / 2, tempObj.matrix); }
    }
    rail.castShadow = posts.castShadow = true; scene.add(rail, posts, reflectors);
    // 굽은 길의 측량 말뚝과 갈매기 표지.
    const signs = new THREE.Group();
    const arrowTex = texture(128, (ctx, n) => {
      ctx.fillStyle = '#cbb96c'; ctx.fillRect(0, 0, n, n); ctx.fillStyle = '#303e38'; ctx.beginPath();
      ctx.moveTo(20, 10); ctx.lineTo(62, 10); ctx.lineTo(108, 64); ctx.lineTo(62, 118); ctx.lineTo(20, 118); ctx.lineTo(68, 64); ctx.closePath(); ctx.fill();
    });
    const signPosts = new THREE.InstancedMesh(new THREE.BoxGeometry(.11, 2.4, .11), railMat, 26);
    const signPanels = new THREE.InstancedMesh(new THREE.BoxGeometry(1.05, .88, .06), new THREE.MeshStandardMaterial({ map: arrowTex, roughness: .65 }), 26);
    for (let i = 0; i < 26; i++) {
      const s = 60 + i * 83, p = roadPoint(s, -7.6, 1.5);
      tempObj.position.copy(p).add(new THREE.Vector3(0, -.4, 0)); tempObj.rotation.set(0, 0, 0); tempObj.scale.setScalar(1); tempObj.updateMatrix(); signPosts.setMatrixAt(i, tempObj.matrix);
      tempObj.position.copy(p).add(new THREE.Vector3(0, .5, 0)); tempObj.rotation.y = pathAngle(s) + Math.PI; tempObj.updateMatrix(); signPanels.setMatrixAt(i, tempObj.matrix);
    }
    signs.add(signPosts, signPanels); scene.add(signs);
  }

  function wildflowerGeometry() {
    const positions = [], colours = [];
    const triangle = (a, b, c, colour) => { for (const point of [a, b, c]) { positions.push(...point); colours.push(...colour); } };
    for (let i = 0; i < 3; i++) {
      const angle = i * Math.PI * 2 / 3, next = (i + 1) * Math.PI * 2 / 3;
      const a = [Math.cos(angle) * .006, 0, Math.sin(angle) * .006], b = [Math.cos(next) * .006, 0, Math.sin(next) * .006];
      const c = [a[0], .235, a[2]], d = [b[0], .235, b[2]];
      triangle(a, b, c, [.22, .37, .12]); triangle(b, d, c, [.22, .37, .12]);
    }
    for (let i = 0; i < 5; i++) {
      const angle = i * Math.PI * 2 / 5;
      const point = (radius, a, height) => [Math.cos(a) * radius, height, Math.sin(a) * radius];
      const base = point(.012, angle, .245), left = point(.055, angle - .44, .258), tip = point(.095, angle, .249), right = point(.055, angle + .44, .258);
      triangle(base, left, tip, [.92, .88, .79]); triangle(base, tip, right, [.92, .88, .79]);
      triangle([0, .261, 0], point(.015, angle, .261), point(.015, angle + Math.PI * 2 / 5, .261), [.73, .43, .12]);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
    geometry.computeVertexNormals();
    return geometry;
  }

  /** 꽃빛 해안의 들꽃·꽃잎, 도시의 사람들, 길가 나무(테마에 따라 켜고 끈다). */
  function setupJourneyScenery(themeName) {
    scenery.sky = scenery.atmosphere.sky;
    const flowerGroup = new THREE.Group(); scenery.bloom = flowerGroup; scene.add(flowerGroup);
    const flowers = new THREE.InstancedMesh(wildflowerGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 1 }), 1700);
    const tint = new THREE.Color();
    for (let i = 0; i < 1700; i++) {
      const z = random() * ROAD_END, x = pathX(z) - 8 - random() * 17;
      tempObj.position.set(x, groundHeight(x, z) - .015, z); tempObj.rotation.set((random() - .5) * .16, random() * 6.28, (random() - .5) * .12);
      tempObj.scale.setScalar(.7 + random() * .55); tempObj.updateMatrix(); flowers.setMatrixAt(i, tempObj.matrix);
      tint.set(i % 3 === 0 ? 0xfff3de : i % 3 === 1 ? 0xf1c8c6 : 0xf2dfab); flowers.setColorAt(i, tint);
    }
    flowers.receiveShadow = true; flowerGroup.add(flowers);
    const particles = new THREE.BufferGeometry(), positions = [];
    for (let i = 0; i < 65; i++) positions.push((random() - .5) * 40, 1 + random() * 12, random() * 65);
    particles.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const petals = new THREE.Points(particles, new THREE.PointsMaterial({ color: 0xf6ded9, size: .065, transparent: true, opacity: .65, depthWrite: false }));
    petals.visible = !W.reducedMotion; flowerGroup.add(petals); scenery.petals = petals;
    scenery.cityLife = buildCityLife(THREE, { anchors: scenery.city.group.userData.activityAnchors, groundHeight, pathX, surfaceHeightAt: scenery.city.surfaceHeightAt });
    scene.add(scenery.cityLife.group);
    const textures = { ...W.textures, pineCanopy: W.canopy.pine, blossomCanopy: W.canopy.blossom };
    scenery.details = buildSceneryDetails(THREE, { roadPoint, pathX, groundHeight, ROAD_END, textures, random, excludeAt: (x, z, margin) => scenery.city.containsFootprint(x, z, margin) });
    scene.add(scenery.details.group);
    setScenery(themeName);
  }

  /** 풍경 테마(꽃빛 해안·섬과 바다·노을 만). 같은 도로 지형에 꽃·도시 분위기를 바꾸고, 빛은 노을빛 하나로 둔다. */
  function setScenery(theme) {
    if (!scenery.sky) return;
    scenery.theme = theme; scenery.bloom.visible = theme === 'bloom'; scenery.details.setTheme(theme);
    scenery.city.setTheme(theme === 'bloom' ? 'bloom' : 'sunset');
    scenery.cityLife.setTheme(theme);
    scenery.atmosphere.setTheme('sunset');
    W.sunDirection.set(.34, .115, .94).normalize();
    W.light.color.set(0xffd4ac); W.light.intensity = 2.15;
    W.ambientLight.intensity = .88; W.ambientLight.color.set(0xc4c8e2); W.ambientLight.groundColor.set(0x756550);
    W.renderer.toneMappingExposure = 1.04;
    scene.environment = scenery.environments.sunset.texture; scene.environmentIntensity = .95; scene.environmentRotation.y = 0;
  }

  return { texture, setupSky, setupTerrain, setupWater, setupCoastalScenery, setupVegetation, setupJourneyScenery, setScenery };
}
