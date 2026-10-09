import * as THREE from './scene-assets/three.module.js';

// One small river launch, four merged material batches and one water decal.
// The home owns rendering and scene-resource disposal; this module owns no
// lights, render targets, timers, external textures or animation frame loop.
const WATER_Y = -1.16;
const ROUTE = Object.freeze({ left: -52, right: 52, z: -22.2, speed: .235 });

function mergeParts(parts) {
  const positions = [], normals = [];
  for (const part of parts) {
    const geometry = part.index ? part.toNonIndexed() : part;
    positions.push(...geometry.attributes.position.array);
    normals.push(...geometry.attributes.normal.array);
    geometry.dispose(); if (geometry !== part) part.dispose();
  }
  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  result.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  result.computeBoundingSphere(); return result;
}

function transformed(geometry, position, rotation = [0, 0, 0]) {
  geometry.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(1, 1, 1)));
  return geometry;
}

function roundedDeck(length, beam, thickness, y, x = 0) {
  const r = Math.min(.12, beam * .3), shape = new THREE.Shape(), left = -length / 2, near = -beam / 2;
  shape.moveTo(left + r, near); shape.lineTo(left + length - r, near);
  shape.quadraticCurveTo(left + length, near, left + length, near + r);
  shape.lineTo(left + length, near + beam - r); shape.quadraticCurveTo(left + length, near + beam, left + length - r, near + beam);
  shape.lineTo(left + r, near + beam); shape.quadraticCurveTo(left, near + beam, left, near + beam - r);
  shape.lineTo(left, near + r); shape.quadraticCurveTo(left, near, left + r, near);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true,
    bevelThickness: .012, bevelSize: .012, bevelSegments: 2, curveSegments: 3 });
  geometry.rotateX(Math.PI / 2); geometry.translate(x, y + thickness / 2, 0); return geometry;
}

function hullBand(bottom, top, widen = 0) {
  const sections = [[-1.57, .08], [-1.39, .31], [-.96, .44], [.57, .44], [1.12, .33], [1.48, .12], [1.60, .014]];
  const points = [], index = [];
  for (const [x, width] of sections) {
    const base = width * .76 + widen, lip = width + widen;
    points.push(x, bottom, -base, x, top, -lip, x, top, lip, x, bottom, base);
  }
  for (let i = 0; i < sections.length - 1; i++) {
    for (let j = 0; j < 4; j++) {
      const a = i * 4 + j, b = i * 4 + (j + 1) % 4, c = (i + 1) * 4 + j, d = (i + 1) * 4 + (j + 1) % 4;
      index.push(a, b, c, b, d, c);
    }
  }
  index.push(0, 3, 1, 1, 3, 2, 24, 25, 27, 25, 26, 27);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3)); geometry.setIndex(index);
  geometry.computeVertexNormals(); return geometry;
}

function quad(points) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]); geometry.computeVertexNormals(); return geometry;
}

function rail(parts, a, b, radius = .014) {
  const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), direction = to.clone().sub(from);
  const geometry = new THREE.CylinderGeometry(radius, radius, direction.length(), 6, 1);
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()));
  geometry.translate(...from.add(to).multiplyScalar(.5).toArray()); parts.push(geometry);
}

export function createRiverLife({ scene, mobile = false } = {}) {
  if (!scene?.add) throw new TypeError('createRiverLife requires a Three.js scene');
  const group = new THREE.Group(); group.name = 'han-river-passing-launch-v8'; scene.add(group);
  const boat = new THREE.Group(); boat.name = 'cream-and-navy-river-launch'; group.add(boat);
  const cream = [], navy = [], wood = [], glass = [];
  const creamMaterial = new THREE.MeshStandardMaterial({ color: '#efe9d9', roughness: .46, metalness: .06 });
  const navyMaterial = new THREE.MeshStandardMaterial({ color: '#274f64', roughness: .4, metalness: .14 });
  const woodMaterial = new THREE.MeshStandardMaterial({ color: '#b18a56', roughness: .68, metalness: 0 });
  // Opaque smoked glazing keeps the distant silhouette clear and avoids a
  // transparent cabin sorting cost; the environment still lights its surface.
  const glassMaterial = new THREE.MeshStandardMaterial({ color: '#294d58', roughness: .19, metalness: .38 });
  cream.push(hullBand(-.12, .29)); navy.push(hullBand(.115, .205, .008));
  wood.push(roundedDeck(2.77, .76, .035, .315, -.045));
  navy.push(roundedDeck(2.84, .80, .018, .286, -.045));

  // Shallow, gently rounded roof, separated from the deck by open stern and
  // bow space. The front windscreen leans back rather than reading as a box.
  cream.push(roundedDeck(1.91, .81, .063, 1.005, -.16));
  navy.push(roundedDeck(1.85, .77, .020, .966, -.16));
  cream.push(transformed(new THREE.BoxGeometry(.10, .56, .63), [-.92, .645, 0]));
  cream.push(transformed(new THREE.BoxGeometry(.10, .49, .035), [.64, .675, -.318], [0, 0, .18]));
  cream.push(transformed(new THREE.BoxGeometry(.10, .49, .035), [.64, .675, .318], [0, 0, .18]));
  for (const side of [-1, 1]) {
    for (const x of [-.40, .13]) cream.push(transformed(new THREE.BoxGeometry(.038, .51, .037), [x, .668, side * .324]));
    cream.push(transformed(new THREE.BoxGeometry(1.51, .042, .04), [-.16, .424, side * .322]));
    glass.push(quad([[-.856, .456, side * .322], [.669, .456, side * .322], [.577, .917, side * .322], [-.856, .917, side * .322]]));
  }
  glass.push(quad([[.67, .46, -.294], [.67, .46, .294], [.58, .919, .294], [.58, .919, -.294]]));
  // Stern bench, teak deck seams, boarding step and thin handrails add scale
  // through actual geometry, all merged into the existing material batches.
  wood.push(transformed(new THREE.BoxGeometry(.28, .055, .60), [-1.18, .485, 0]));
  navy.push(transformed(new THREE.BoxGeometry(.20, .12, .53), [-1.18, .40, 0]));
  cream.push(transformed(new THREE.BoxGeometry(.18, .055, .54), [-1.51, .27, 0]));
  for (const z of [-.23, -.077, .077, .23]) navy.push(transformed(new THREE.BoxGeometry(.37, .004, .008), [1.02, .349, z]));
  for (const side of [-1, 1]) {
    for (const x of [-1.35, 1.12]) rail(cream, [x, .34, side * .34], [x, .58, side * .34], .012);
    rail(cream, [-1.35, .58, side * .34], [-.99, .58, side * .34], .012);
    rail(cream, [.77, .58, side * .34], [1.12, .58, side * .34], .012);
    navy.push(transformed(new THREE.CylinderGeometry(.038, .038, .13, 8), [-1.31, .21, side * .43], [Math.PI / 2, 0, 0]));
  }
  cream.push(transformed(new THREE.BoxGeometry(.15, .055, .23), [-.28, 1.079, 0]));
  const materialParts = [[cream, creamMaterial, 'ivory-hull-roof-and-rails'], [navy, navyMaterial, 'navy-rubbing-strake-and-trim'],
    [wood, woodMaterial, 'teak-deck-and-stern-bench'], [glass, glassMaterial, 'smoked-cabin-windows']];
  let triangleCount = 0;
  for (const [parts, material, name] of materialParts) {
    const geometry = mergeParts(parts), mesh = new THREE.Mesh(geometry, material); mesh.name = name;
    // At this distance the water contact decal supplies the contact cue. Avoid
    // multiplying the small vessel's draw calls in the sun's shadow pass.
    mesh.castShadow = mesh.receiveShadow = false; boat.add(mesh);
    triangleCount += geometry.attributes.position.count / 3;
  }
  // Both sides of the cabin are visible through its single-sided facade batch.
  glassMaterial.side = THREE.DoubleSide;

  const phase = { value: 0 }, reflectionColor = { value: new THREE.Color('#e8e3cb') };
  const waterMaterial = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uPhase: phase, uReflection: reflectionColor }]),
    vertexShader: `varying vec2 vUv;
      #include <fog_pars_vertex>
      void main(){vUv=uv;vec4 mvPosition=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uPhase;uniform vec3 uReflection;varying vec2 vUv;
      #include <fog_pars_fragment>
      void main(){
        float x=vUv.x*7.6-5.7;float z=(1.0-vUv.y)*4.0-2.0;
        float contact=exp(-3.2*(pow((x+.08)/1.58,2.0)+pow(z/.48,2.0)))*.25;
        float aft=-x-1.36;float valid=smoothstep(0.0,.16,aft)*(1.0-smoothstep(2.8,4.18,aft));
        float offset=.38+max(aft,0.0)*.21;
        float ripple=sin(aft*8.5-uPhase*1.6)*.014;
        float wake=exp(-pow((abs(z)-offset-ripple)/(.033+max(aft,0.0)*.019),2.0))*valid;
        wake*=.14+.055*sin(aft*10.0-uPhase*1.1);
        float wash=exp(-pow((x+1.73)/.42,2.0)-pow(z/.26,2.0))*.115;
        float reflection=smoothstep(.18,.38,z)*(1.0-smoothstep(.53,1.30,z));
        reflection*=1.0-smoothstep(1.03,1.45,abs(x+.13+sin(z*28.0+uPhase*.8)*.035));
        reflection*=.11*(.58+.42*sin(z*87.0+uPhase*.7));
        float alpha=contact+wake+wash+reflection;
        if(alpha<.002)discard;
        vec3 rgb=(vec3(.17,.29,.31)*contact+vec3(.84,.91,.87)*(wake+wash)+uReflection*reflection)/max(alpha,.001);
        gl_FragColor=vec4(rgb,clamp(alpha,0.0,.38));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }` });
  // UniformsUtils clones values: keep the live references after its fog merge.
  waterMaterial.uniforms.uPhase = phase; waterMaterial.uniforms.uReflection = reflectionColor;
  const waterGeometry = new THREE.PlaneGeometry(7.6, 4); waterGeometry.rotateX(-Math.PI / 2); waterGeometry.translate(-1.9, .014, 0);
  const waterEffects = new THREE.Mesh(waterGeometry, waterMaterial); waterEffects.name = 'launch-contact-reflection-and-wake';
  waterEffects.renderOrder = 1; waterEffects.frustumCulled = true; group.add(waterEffects); triangleCount += 2;

  let elapsed = 0, disposed = false, currentTime = 'day';
  const routeLength = ROUTE.right - ROUTE.left;
  // Each home layout exposes a different gap in the foreground terrace. This
  // changes the decorative route's initial phase, not its speed or geography.
  const initialX = mobile ? -5.4 : -1.2;
  function place() {
    const progress = (initialX - ROUTE.left + elapsed * ROUTE.speed) % routeLength;
    group.position.set(ROUTE.left + progress, WATER_Y, ROUTE.z);
    // Only the vessel heaves. The surface decal remains on the water plane.
    boat.position.y = Math.sin(elapsed * .74) * .009;
    boat.rotation.z = Math.sin(elapsed * .58 + .6) * .006;
  }
  place(); group.userData.visualRevision = 'river-life-v8';
  return {
    update(dt, reducedMotion = false) {
      if (disposed || reducedMotion || !Number.isFinite(dt) || dt <= 0) return;
      elapsed += Math.min(dt, .1); phase.value = elapsed; place();
    },
    setTime(time) {
      if (disposed) return; currentTime = time === 'sunset' ? 'sunset' : 'day';
      creamMaterial.color.set(currentTime === 'sunset' ? '#efe2ce' : '#efe9d9');
      reflectionColor.value.set(currentTime === 'sunset' ? '#e8c9ad' : '#e8e3cb');
    },
    get metrics() {
      return { revision: 8, vesselCount: 1, drawCalls: 5, triangles: triangleCount,
        elapsed: +elapsed.toFixed(4), position: group.position.toArray().map(v => +v.toFixed(4)),
        routeSpeed: ROUTE.speed, routeZ: ROUTE.z, routeBounds: [ROUTE.left, ROUTE.right], initialX,
        waterEffects: ['contact-shadow', 'approximate-reflection', 'stern-wash', 'diverging-wake'],
        extraRenderTargets: 0, extraLights: 0, textureCount: 0, mobile, time: currentTime, disposed };
    },
    // Scene-owned meshes/materials are disposed by the home's single traversal.
    // This only stops updates, avoiding double disposal of standard resources.
    dispose() { disposed = true; }
  };
}
