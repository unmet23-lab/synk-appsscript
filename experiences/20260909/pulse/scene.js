import * as THREE from 'three';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';
import { mergeGeometries } from './vendor/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from './vendor/addons/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/addons/postprocessing/RenderPass.js';
import { OutputPass } from './vendor/addons/postprocessing/OutputPass.js';
import { Reflector } from './vendor/addons/objects/Reflector.js';
import { createNavigation } from './world-navigation.js';
import { createAtmosphere } from './world-atmosphere.js';
import { createFeltMaterials } from './world-materials.js';
import { SSAOPass } from './scene-assets/ssao/SSAOPass.js';

// Authored, deterministic 3D art. No generated background is used by this renderer.
const C = { paper: 0xfbf7f0, oat: 0xede7dc, stone: 0xc7bfb2, ash: 0x8d857a, wool: 0x575046, ink: 0x2b2320, deep: 0x080605, lapis: 0x3d6bc9, lapisDeep: 0x24448c, lapisSoft: 0xc5d6f5, indigo: 0x283158, butter: 0xf5c445, butterSoft: 0xffebb0, coral: 0xf96859, coralDeep: 0x941f19 };
const vec = (x, y, z) => new THREE.Vector3(x, y, z);
let seed = 917204;
function rnd(a = 0, b = 1) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return a + seed / 4294967296 * (b - a); }
const clamp = THREE.MathUtils.clamp;

export async function createWorld({ container, hotspots, onInspect, onStatus }) {
  seed = 917204;
  hotspots.inert = true;
  let reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.4 : 1.6));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.info.autoReset = false;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', '실시간 3D 해안 도시. W A S D로 걷고 마우스를 드래그해 바라봅니다. 가까운 사물은 E로 조사합니다. 방향키는 시선을 바꾸고 Home은 출발점으로 돌아갑니다.');
  container.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x233961);
  scene.fog = new THREE.FogExp2(0x384c69, .0105);
  const camera = new THREE.PerspectiveCamera(47, container.clientWidth / container.clientHeight, .15, 450);
  const root = new THREE.Group();
  scene.add(root);
  const geometries = new Map();
  const animated = [];
  const lights = [];
  const glowSprites = [];
  const fiberPositions = [], fiberColors = [], fiberNormals = [];
  const sun = new THREE.DirectionalLight(0xc5d6f5, 1.65);
  sun.position.set(-30, 38, -28);
  sun.castShadow = true;
  sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 110 });
  sun.shadow.normalBias = .015;
  sun.shadow.bias = -.00015;
  sun.shadow.radius = 3;
  sun.target.position.set(0, 1, -8);
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(0xaac5ef, 0x42404c, .52));
  const warmFill = new THREE.DirectionalLight(0xa7bddd, .46);
  warmFill.position.set(-12, 10, 18);
  scene.add(warmFill);

  const feltMaterials = await createFeltMaterials(renderer);
  const { felt, tile: woolTexture } = feltMaterials;
  const m = {
    paving: felt(0x777979, .94, .065), pavingLight: felt(C.ash, .97, .075), curb: felt(C.stone), masonry: felt(0x85817b), cream: felt(C.stone), paper: felt(C.oat), wallDark: felt(0x59606b), roof: felt(C.indigo), blue: felt(C.lapis), trim: felt(C.oat), dark: felt(0x30323b), trunk: felt(C.wool), leaf: felt(0x495652), leafLight: felt(0x636e60), rope: felt(C.stone), coral: felt(0xbe5148), brass: felt(0xb7a37d, .5, .06), ocean: felt(0x243b56, .39, .17), rock: felt(0x515c67), hill: felt(0x3d4d62), wood: felt(0x71665a), stitch: felt(C.oat), windowFrame: felt(C.ink), rubber: felt(0x23242b)
  };
  m.stone = m.cream;
  m.window = new THREE.MeshStandardMaterial({ color: 0x75634c, emissive: 0xe7b76c, emissiveIntensity: .37, roughness: .92 });
  m.windowDim = new THREE.MeshStandardMaterial({ color: 0x675747, emissive: C.butterSoft, emissiveIntensity: .075, roughness: .95 });
  m.windowOff = felt(0x374351, .35, .03);
  m.signal = new THREE.MeshStandardMaterial({ color: C.coral, emissive: C.coral, emissiveIntensity: 1.7, roughness: .5 });
  m.lamp = new THREE.MeshStandardMaterial({ color: C.butterSoft, emissive: C.butterSoft, emissiveIntensity: 1.8, roughness: .5 });
  m.curtain = felt(0xb8a78b, .99, .025);
  m.curtainDark = felt(0x6c737a, .99, .03);
  m.glass = new THREE.MeshPhysicalMaterial({ color: 0x859aaf, transparent: true, opacity: .15, roughness: .23, metalness: .15, depthWrite: false });
  m.threadDark = felt(0x303443, .98, .018);

  function boxGeo(w, h, d, r = .07) {
    const key = [w, h, d, r].join(',');
    if (geometries.has(key)) return geometries.get(key);
    const g = new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 3, h / 3, d / 3));
    const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
      uv.setXY(i, (ay > ax && ay > az ? p.getX(i) : ax > az ? p.getZ(i) : p.getX(i)) * .18, (ay > ax && ay > az ? p.getZ(i) : p.getY(i)) * .18);
    }
    geometries.set(key, g); return g;
  }
  function mesh(geometry, material, x, y, z, parent = root) { if (!material) throw new Error('A scene surface has no authored material.'); const o = new THREE.Mesh(geometry, material); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o; }
  function box(w, h, d, material, x, y, z, parent = root, r = .07) { return mesh(boxGeo(w, h, d, r), material, x, y, z, parent); }
  function cylinder(rt, rb, h, material, x, y, z, parent = root, segments = 14) { return mesh(new THREE.CylinderGeometry(rt, rb, h, segments), material, x, y, z, parent); }
  function sphere(r, material, x, y, z, parent = root, sx = 1, sy = 1, sz = 1) {
    const natural=[m.rock,m.hill,m.leaf,m.leafLight].includes(material);
    const geometry=natural?new THREE.SphereGeometry(r,24,16):new THREE.IcosahedronGeometry(r,2);
    if(natural){
      const p=geometry.attributes.position;for(let i=0;i<p.count;i++){const xx=p.getX(i),yy=p.getY(i),zz=p.getZ(i);const k=1+.12*Math.sin(xx*7.3+yy*4.7+zz*9.1)*Math.cos(xx*4.1-yy*8.9+zz*5.3);p.setXYZ(i,xx*k,yy*k,zz*k);}geometry.computeVertexNormals();
    }
    const o=mesh(geometry,material,x,y,z,parent);o.scale.set(sx,sy,sz);return o;
  }
  function rod(a, b, radius, material, parent = root) {
    const av = new THREE.Vector3(...a), bv = new THREE.Vector3(...b), delta = bv.clone().sub(av);
    const o = cylinder(radius, radius, delta.length(), material, ...av.clone().add(bv).multiplyScalar(.5).toArray(), parent, 8);
    o.quaternion.setFromUnitVectors(vec(0, 1, 0), delta.normalize()); return o;
  }
  function curve(points, radius, material, parent = root, segments = 40) { return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), segments, radius, 6, false), material, 0, 0, 0, parent); }
  function torus(radius, tube, material, x, y, z, parent = root) { return mesh(new THREE.TorusGeometry(radius, tube, 8, 32), material, x, y, z, parent); }
  function seam(a, b, parent = root, color = m.stitch, step = .22) {
    const av = new THREE.Vector3(...a), bv = new THREE.Vector3(...b), length = av.distanceTo(bv);
    const tangent = bv.clone().sub(av).normalize();
    const normal = Math.abs(tangent.y) > .6 ? vec(0,0,1) : vec(0,1,0);
    const sideways = tangent.clone().cross(normal).normalize();
    rod(a,b,.013,m.threadDark,parent);
    for (let s = 0; s < length; s += step) {
      const start = av.clone().lerp(bv,s/length), end=av.clone().lerp(bv,Math.min(1,(s+step*.59)/length));
      const points=[];
      for(let k=0;k<=6;k++) {const t=k/6;points.push(start.clone().lerp(end,t).addScaledVector(normal,Math.sin(t*Math.PI)*.033+.009).addScaledVector(sideways,Math.sin(t*Math.PI*2)*.009).toArray());}
      curve(points,.012,color,parent,8);
    }
  }
  function fuzz(o, count = 260, length = .05) {
    o.updateWorldMatrix(true, false);
    const g = o.geometry, p = g.attributes.position, n = g.attributes.normal, index = g.index;
    const c = new THREE.Color(o.material.color || C.stone).lerp(new THREE.Color(C.stone), .12);
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(o.matrixWorld);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3(), normal = new THREE.Vector3();
    const faceCount = Math.floor((index ? index.count : p.count) / 3);
    // Rounded boxes have many tiny bevel triangles. Area-weighted sampling prevents corner tufts.
    const areas = []; let totalArea = 0;
    for(let f=0;f<faceCount*3;f+=3){const ia=index?index.getX(f):f,ib=index?index.getX(f+1):f+1,ic=index?index.getX(f+2):f+2;
      a.fromBufferAttribute(p,ia);b.fromBufferAttribute(p,ib);d.fromBufferAttribute(p,ic);totalArea+=b.sub(a).cross(d.sub(a)).length()*.5;areas.push(totalArea);}
    count=Math.floor(count*.85);length*=.65;
    for (let i = 0; i < count; i++) {
      const pick=rnd(0,totalArea);let lo=0,hi=areas.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(areas[mid]<pick)lo=mid+1;else hi=mid;}
      const f = lo * 3, ia = index ? index.getX(f) : f, ib = index ? index.getX(f + 1) : f + 1, ic = index ? index.getX(f + 2) : f + 2;
      let u = rnd(), v = rnd(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
      a.fromBufferAttribute(p, ia); b.fromBufferAttribute(p, ib); d.fromBufferAttribute(p, ic);
      const point = a.multiplyScalar(1 - u - v).addScaledVector(b, u).addScaledVector(d, v).applyMatrix4(o.matrixWorld);
      normal.fromBufferAttribute(n,ia).multiplyScalar(1-u-v).addScaledVector(vec().fromBufferAttribute(n,ib),u).addScaledVector(vec().fromBufferAttribute(n,ic),v).applyMatrix3(normalMatrix).normalize();
      const tangent=normal.clone().cross(Math.abs(normal.y)<.9?vec(0,1,0):vec(1,0,0)).normalize();
      const side=tangent.clone().cross(normal).normalize();
      const angle=rnd(0,Math.PI*2),direction=tangent.multiplyScalar(Math.cos(angle)).addScaledVector(side,Math.sin(angle));
      const widthDirection=direction.clone().cross(normal).normalize(),strandLength=rnd(length*.5,length);
      const mid=point.clone().addScaledVector(direction,strandLength*.52).addScaledVector(normal,strandLength*.18);
      const end=point.clone().addScaledVector(direction,strandLength).addScaledVector(normal,strandLength*.08);
      const cc=c.clone().multiplyScalar(rnd(.96,1.3)), width=rnd(.0016,.0028);
      const baseA=point.clone().addScaledVector(widthDirection,-width),baseB=point.clone().addScaledVector(widthDirection,width);
      const midA=mid.clone().addScaledVector(widthDirection,-width*.65),midB=mid.clone().addScaledVector(widthDirection,width*.65);
      fiberPositions.push(...baseA.toArray(),...baseB.toArray(),...midA.toArray(),...baseB.toArray(),...midB.toArray(),...midA.toArray(),...midA.toArray(),...midB.toArray(),...end.toArray());
      for(let k=0;k<9;k++){fiberColors.push(cc.r,cc.g,cc.b);fiberNormals.push(...normal.toArray());}
    }
  }
  function softDisc() {
    const c = document.createElement('canvas'); c.width = c.height = 128; const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 1, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.15, 'rgba(255,255,255,.6)'); g.addColorStop(.4, 'rgba(255,255,255,.15)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }
  const disc = softDisc();
  function glow(x, y, z, size, color = C.butterSoft, opacity = .24, parent = root) {
    const o = new THREE.Sprite(new THREE.SpriteMaterial({ map: disc, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); o.position.set(x, y, z); o.scale.set(size, size, 1); parent.add(o); glowSprites.push(o); return o;
  }
  function shadow(x, z, sx, sz, opacity = .55) {
    const mat = new THREE.MeshBasicMaterial({ map: disc, color: C.deep, transparent: true, opacity, depthWrite: false });
    const o = mesh(new THREE.PlaneGeometry(sx, sz), mat, x, .174, z); o.rotation.x = -Math.PI / 2; o.castShadow = false; return o;
  }
  function signPlate(text,w,h,x,y,z,parent=root){
    box(w+.13,h+.12,.12,m.dark,x,y,z,parent,.045);
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;const ctx=canvas.getContext('2d');
    ctx.fillStyle='#283158';ctx.fillRect(0,0,1024,256);ctx.strokeStyle='#8d857a';ctx.lineWidth=3;ctx.setLineDash([12,9]);ctx.strokeRect(14,14,996,228);
    ctx.fillStyle='#ede7dc';ctx.font='500 104px "Inter Tight", sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,512,139,925);
    const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
    return mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:tex,roughness:.95}),x,y,z+.069,parent);
  }

  const atmosphere = createAtmosphere(scene);

  // Coast and fabric terrain, with an actual drop to the water along the quay.
  box(56, 1.6, 110, m.rock, 16, -1, -26, root, .35);
  box(48, .24, 100, m.paving, 13, -.03, -22, root, .1);
  const waterGeo = new THREE.PlaneGeometry(500, 500, 80, 100); waterGeo.rotateX(-Math.PI / 2);
  const ocean = new THREE.Mesh(waterGeo, m.ocean); ocean.position.set(-65, -1.18, -50); ocean.receiveShadow = true; scene.add(ocean);
  animated.push({ type: 'water', o: ocean, base: waterGeo.attributes.position.array.slice() });
  for (let i = 0; i < 8; i++) sphere(rnd(5, 12), m.hill, -45 - i * 5, -3, -35 - i * 10, root, rnd(.7, 1.4), rnd(.5, 1.4), rnd(.8, 1.6));
  for (let i = 0; i < 30; i++) sphere(rnd(.45, 1.8), m.rock, rnd(-15, -10.5), rnd(-1.5, -.6), rnd(-56, 24), root, 1, .7, 1);

  // Individually rounded, slightly uneven felt cobbles; merged after construction.
  for (let iz = -30; iz < 26; iz++) {
    for (let ix = -10; ix < 17; ix++) {
      const x = ix * 1.08 + (iz % 2 ? .52 : 0), z = iz * 1.04;
      box(1.025, .13 + rnd(0, .025), .975, rnd() < .23 ? m.pavingLight : m.paving, x, .045, z, root, .09);
    }
  }
  box(6.3, .25, 83, m.masonry, 13.7, .24, -14, root, .08);
  for (let i = -40; i < 28; i += 1.4) box(.55, .44, 1.33, m.curb, 10.4, .22, i, root, .08);
  for (let i = -55; i < 25; i += 1.8) {
    box(.65, .9, 1.73, m.cream, -11.4, -.12, i, root, .1);
    if (i < -2 || i > 10) box(.85, .28, 1.8, m.stone, -11.4, .45, i, root, .12);
  }
  // Actual rails and sleepers curve through the playable foreground.
  const railPoints = [[-1, .17, 31], [1.1, .17, 17], [1.3, .17, 8], [.1, .17, -3], [-.9, .17, -18], [-.9, .17, -54]];
  for (const off of [-.77, .77]) curve(railPoints.map(([x, y, z]) => [x + off, y, z]), .045, m.brass, root, 110);
  for (let z = -46; z < 30; z += .78) { const x = z > 5 ? 1.1 : -.3; box(2.4, .045, .11, m.wood, x, .12, z, root, .015); }
  for (let z = -40; z < 23; z += 3) seam([-8.9, .17, z], [-8.9, .17, z + 1.5], root, m.rope, .38);

  // Wet patches reflect the actual scene, with a textile noise mask to keep dry fibres visible.
  const puddleShader = {
    name: 'FeltPuddle',
    uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, fiber: { value: woolTexture } },
    vertexShader: `uniform mat4 textureMatrix; varying vec4 vReflection; varying vec2 vGround; void main(){vReflection=textureMatrix*vec4(position,1.);vGround=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform sampler2D tDiffuse;uniform sampler2D fiber;uniform vec3 color;varying vec4 vReflection;varying vec2 vGround;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
    void main(){float n=noise(vGround*1.1)*.5+noise(vGround*3.7)*.3+noise(vGround*.19)*.2;float mask=smoothstep(.48,.68,n);if(mask<.01)discard;vec4 uv=vReflection;uv.xy+=(texture2D(fiber,vGround*.3).rg-.5)*.018*uv.w;vec3 c=texture2DProj(tDiffuse,uv).rgb;gl_FragColor=vec4(c*.7+color*.12,mask*.66);#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace(';#include', ';\n#include')
  };
  const puddles = new Reflector(new THREE.PlaneGeometry(21, 79), { color: 0x25374d, textureWidth: coarse ? 512 : 1024, textureHeight: coarse ? 512 : 1024, clipBias: .005, shader: puddleShader });
  puddles.rotation.x = -Math.PI / 2; puddles.position.set(-.1, .143, -12); puddles.material.transparent = true; puddles.material.depthWrite = false; scene.add(puddles);

  function windowBay(w,h,lit,x,y,z,parent,rotation=0) {
    const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rotation;parent.add(g);
    box(w+.18,h+.18,.22,m.windowFrame,0,0,0,g,.045);
    box(w,h,.045,lit,0,0,.131,g,.018);
    for(const side of [-1,1]){
      const geometry=new THREE.PlaneGeometry(w*.27,h*.94,5,6),p=geometry.attributes.position;
      for(let i=0;i<p.count;i++)p.setZ(i,.045*Math.sin(p.getX(i)*47)+.014*Math.cos(p.getY(i)*5));
      geometry.computeVertexNormals();
      mesh(geometry,lit===m.windowOff?m.curtainDark:m.curtain,side*w*.33,-.015,.24,g);
    }
    box(.055,h,.095,m.wood,0,0,.30,g,.012);
    box(w,.055,.095,m.wood,0,.1,.30,g,.012);
    box(w+.24,.13,.43,m.stone,0,-h*.5-.10,.16,g,.03);
    const pane=mesh(new THREE.PlaneGeometry(w,h),m.glass,0,0,.36,g);pane.castShadow=false;
    if(lit===m.window&&rnd()>.56){
      cylinder(.08,.06,.14,m.wood,w*.19,-h*.42,.225,g,9);
      sphere(.095,m.leaf,w*.19,-h*.30,.25,g,.8,1.5,.35);
    }
    return g;
  }

  function building({ x, z, w = 6, d = 6, h = 10, material = m.cream, style = 0, floors = 3 }) {
    const g = new THREE.Group(); g.position.set(x, .37, z); root.add(g);
    const walls = box(w, h, d, material, 0, h / 2, 0, g, .16); if (z > -22) fuzz(walls, 1300, .065);
    box(w + .3, .4, d + .3, m.stone, 0, .15, 0, g, .06);
    box(w + .42, .24, d + .4, m.oat || m.paper, 0, h - .18, 0, g, .06);
    for (let y = 1.85; y < h - .7; y += h / floors) {
      for (let xx = -w / 2 + 1.15; xx < w / 2 - .6; xx += 1.75) {
        const lit = rnd() > .34 ? m.window : rnd() > .5 ? m.windowDim : m.windowOff;
        windowBay(.78,1.35,lit,xx,y,d/2+.10,g);
        if (lit === m.window && z > -15 && y < 4) glow(xx, y, d / 2 + .28, 2.5, C.butter, .075, g);
      }
      for (let zz = -d / 2 + 1.15; zz < d / 2 - .4; zz += 1.75) {
        windowBay(.78,1.3,rnd()>.43?m.window:m.windowOff,-w/2-.10,y,zz,g,-Math.PI/2);
      }
    }
    for (let q = 0; q < 2; q++) {
      const roof = box(w / 2 + .45, .24, d + .8, m.roof, (q ? 1 : -1) * w / 4, h + .45, 0, g, .08); roof.rotation.z = (q ? -1 : 1) * .26; if (z > -20) fuzz(roof, 800, .075);
      for (let dz = -d / 2; dz < d / 2 + .2; dz += .25) {
        rod([(q ? .1 : -w / 2 - .3), h + (q ? 1.14 : -.14) * .6, dz], [(q ? w / 2 + .3 : -.1), h + (q ? -.14 : 1.14) * .6, dz], .055, m.roof, g);
      }
    }
    box(.52, 1.2, .7, material, w * .25, h + 1.12, -.7, g, .08);
    box(.7, .18, .9, m.stone, w * .25, h + 1.7, -.7, g, .04);
    if (style === 1) for (let y = 3.3; y < h - 1; y += 3.2) box(w + .24, .14, d + .22, m.stone, 0, y, 0, g, .04);
    return g;
  }
  building({ x: 15.8, z: -6.8, w: 10, d: 8, h: 9, material: m.cream, floors: 2 });
  building({ x: 16.3, z: -19, w: 9, d: 10, h: 12.8, material: m.masonry, floors: 4, style: 1 });
  building({ x: 15.5, z: -33, w: 9, d: 10, h: 16, material: m.wallDark, floors: 5 });
  building({ x: 11, z: -47, w: 8, d: 10, h: 13, material: m.masonry, floors: 4 });
  building({ x: 23, z: 9, w: 11, d: 11, h: 12, material: m.wallDark, floors: 3, style: 1 });
  building({ x: -6.8, z: -35, w: 5, d: 7, h: 9, material: m.wallDark, floors: 3 });
  building({ x: -5.8, z: -46, w: 5.5, d: 7, h: 12, material: m.masonry, floors: 4 });
  for (let i = 0; i < 10; i++) building({ x: 3 + (i % 4) * 7.8, z: -64 - Math.floor(i / 4) * 11, w: rnd(5, 7), d: 7, h: rnd(9, 19), material: i % 3 ? m.wallDark : m.masonry, floors: 3 });

  // Radio hall: arched entry, clock, stitched awning and the lattice transmitter.
  const station = new THREE.Group(); station.position.set(10.9, .38, -4); root.add(station);
  box(.3, 3.8, 2.6, m.windowFrame, 0, 2.0, 0, station, .15);
  box(.14, 3.25, 2.2, m.window, -.17, 2.1, 0, station, .1);
  box(.19, 3.3, .08, m.wood, -.27, 2.1, 0, station, .015);
  box(.18, .1, 2.22, m.wood, -.27, 2.2, 0, station, .015);
  for (const zz of [-1.6, 1.6]) { cylinder(.22, .28, 4.2, m.masonry, -.6, 2.1, zz, station); box(.8, .28, .8, m.stone, -.6, .14, zz, station); }
  box(3.5, .3, 5.6, m.roof, -1.1, 4.28, 0, station, .1);
  for (let i = -2.5; i <= 2.5; i += .4) rod([-2.6, 4.4, i], [.5, 4.4, i], .055, m.dark, station);
  for (const z of [-5.5, -.5]) {
    const pole = cylinder(.12, .18, 4.65, m.dark, 8.2, 2.5, z); fuzz(pole, 420);
    curve([[8.2, 4.75, z], [8.55, 5.1, z], [10, 5.35, z]], .11, m.dark);
  }
  const clockFace = mesh(new THREE.CircleGeometry(.92, 40), m.lamp, 15.8, 7.4, -2.69);
  torus(.98, .13, m.stone, 15.8, 7.4, -2.62);
  rod([15.8, 7.4, -2.54], [15.4, 7.65, -2.54], .035, m.ink || m.dark);
  rod([15.8, 7.4, -2.53], [15.8, 8.03, -2.53], .027, m.dark);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; sphere(.035, m.dark, 15.8 + Math.sin(a) * .78, 7.4 + Math.cos(a) * .78, -2.54); }
  const tower = new THREE.Group(); tower.position.set(15.2, 10.2, -8); root.add(tower);
  for (const x of [-1, 1]) for (const z of [-1, 1]) rod([x, 0, z], [x * .26, 11, z * .26], .09, m.dark, tower);
  for (let y = 0; y < 10; y += 1.6) {
    const width = 1 - y / 15;
    for (const z of [-1, 1]) { rod([-width, y, z * width], [width * .88, y + 1.6, z * width * .88], .038, m.dark, tower); rod([width, y, z * width], [-width * .88, y + 1.6, z * width * .88], .038, m.dark, tower); }
    for (const x of [-1, 1]) rod([x * width, y, -width], [x * width * .88, y + 1.6, width * .88], .04, m.dark, tower);
  }
  cylinder(.035, .035, 4, m.brass, 0, 12, 0, tower);
  const dish = sphere(1.05, m.stone, .8, 5.4, 1.08, tower, 1, 1, .22); dish.rotation.y = -.4; fuzz(dish, 750, .06);
  rod([.8, 5.4, 1.2], [.8, 5.4, 2.2], .065, m.brass, tower);
  for (let i = 0; i < 3; i++) box(.32, 1.9, .25, m.stone, -.85, 4.2 + i * 2.1, .2, tower);

  // The tram is a tangible felt model, with interior seats, curved nose and fuzzy seams.
  const tram = new THREE.Group(); tram.position.set(.15, .45, -2.2); tram.rotation.y = -.04; root.add(tram);
  const chassis = box(2.7, 1.28, 5.8, m.blue, 0, 1.045, 0, tram, .20); fuzz(chassis, 12000, .047);
  box(2.38,.14,5.5,m.wood,0,1.7,0,tram,.05);
  for(const x of [-1.27,1.27]) {
    for(let z=-2.67;z<2.9;z+=1.12)box(.16,1.28,.13,m.blue,x,2.30,z,tram,.035);
    box(.19,.18,5.5,m.blue,x,2.87,0,tram,.055);
    for(let z=-1.86;z<2.2;z+=1.05){
      box(.53,.18,.83,m.coral,x*.72,1.9,z,tram,.09);
      box(.15,.52,.83,m.coral,x*.88,2.10,z,tram,.08);
      seam([x*.72-.2,2.0,z-.3],[x*.72-.2,2.0,z+.3],tram,m.rope,.13);
    }
  }
  box(2.5,.19,.16,m.blue,0,2.90,2.82,tram,.05);
  for(const x of [-1.30,-.53,.53,1.30])box(.10,1.3,.16,m.blue,x,2.25,2.84,tram,.03);
  box(2.76, .12, 5.85, m.trim, 0, 1.55, 0, tram, .04);
  const tramRoof = box(3.03, .58, 6.18, m.roof, 0, 3.17, 0, tram, .25); fuzz(tramRoof, 3300, .058);
  box(2.85, .12, 5.96, m.trim, 0, 2.93, 0, tram, .035);
  box(2.83, .12, 5.94, m.trim, 0, .62, 0, tram, .035);
  for (const x of [-1.05, 0, 1.05]) {
    box(.66, .98, .025, m.glass, x, 2.26, 2.96, tram, .01);
    box(.04, 1.02, .06, m.wood, x, 2.26, 3.035, tram, .008);
  }
  for (const x of [-1.39, 1.39]) for (let z = -2.1; z < 2.4; z += 1.12) {
    box(.018, 1.04, .77, m.glass, x * 1.02, 2.25, z, tram, .009);
    box(.08, .045, .8, m.wood, x * 1.07, 2.38, z, tram, .01);
    box(.08, 1.1, .045, m.wood, x * 1.07, 2.25, z, tram, .01);
  }
  for (const x of [-1.2, 1.2]) for (const z of [-1.75, 1.75]) { const wheel = cylinder(.46, .46, .29, m.rubber, x, .37, z, tram, 20); wheel.rotation.z = Math.PI / 2; const hub = cylinder(.15, .15, .34, m.brass, x, .37, z, tram); hub.rotation.z = Math.PI / 2; }
  box(2.1, .21, .36, m.dark, 0, .63, 3.15, tram, .1);
  const headlamp = cylinder(.25, .25, .17, m.lamp, 0, 1.18, 3.05, tram, 24); headlamp.rotation.x = Math.PI / 2;
  const rim = torus(.28, .055, m.brass, 0, 1.18, 3.14, tram); glow(0, 1.18, 3.26, 2.2, C.butterSoft, .2, tram);
  for (const x of [-1.31, 1.31]) { seam([x, .76, 2.96], [x, 2.95, 2.96], tram, m.stitch, .17); seam([x, .81, -2.7], [x, .81, 2.7], tram, m.stitch, .18); }
  box(1.2, .32, .15, m.dark, 0, 3.03, 3.04, tram, .055);
  signPlate('03',.74,.23,0,3.03,3.135,tram);
  const sign = cylinder(.12, .12, .38, m.signal, 0, 3.7, 0, tram, 20); glow(0, 3.77, 0, 1.9, C.coral, .38, tram);
  const tramSignal = new THREE.PointLight(C.coral, 5, 6, 2); tramSignal.position.set(.15, 4.35, -2.2); scene.add(tramSignal);
  rod([-.9, 3.5, -1.6], [0, 4.45, .5], .055, m.dark, tram); rod([.9, 3.5, -1.6], [0, 4.45, .5], .055, m.dark, tram); rod([0, 4.45, .5], [0, 5.4, -1.4], .055, m.dark, tram); rod([-.8, 5.4, -1.4], [.8, 5.4, -1.4], .06, m.dark, tram);
  const tramLight = new THREE.PointLight(C.butterSoft, 10, 7, 2); tramLight.position.set(0, 2.8, -1.3); scene.add(tramLight);
  for(const z of [-1.2,1.2])box(.2,.055,.55,m.lamp,0,2.88,z,tram,.04);
  shadow(.3, -2, 5.5, 9, .75);
  signPlate('PULSE RADIO',4.4,.73,15.8,4.54,-2.61);
  cylinder(.07,.11,3.2,m.dark,-4.3,1.65,-.7);
  signPlate('LAST STOP',1.6,.42,-4.3,3.04,-.7);

  function lamp(x, z, height = 5.5, addLight = true) {
    const g = new THREE.Group(); g.position.set(x, .2, z); root.add(g);
    cylinder(.11, .16, height, m.dark, 0, height / 2, 0, g); cylinder(.26, .32, .48, m.dark, 0, .2, 0, g);
    curve([[0, height - .4, 0], [.05, height + .2, 0], [.48, height + .38, 0], [.82, height, 0]], .08, m.dark, g, 20);
    cylinder(.21, .07, .55, m.lamp, .82, height - .23, 0, g);
    cylinder(.05, .47, .28, m.dark, .82, height + .15, 0, g);
    cylinder(.06, .22, .12, m.brass, .82, height - .58, 0, g);
    for (let a = 0; a < 4; a++) { const t = a * Math.PI / 2; rod([.82 + Math.sin(t) * .21, height + .02, Math.cos(t) * .21], [.82 + Math.sin(t) * .1, height - .52, Math.cos(t) * .1], .023, m.dark, g); }
    glow(.82, height - .2, 0, 2.5, C.butterSoft, .18, g);
    if (addLight) { const l = new THREE.PointLight(C.butterSoft, 35, 13, 2); l.position.set(x + .8, height - .05, z); scene.add(l); lights.push(l); }
    return g;
  }
  lamp(-8.8, 11, 6); lamp(9.3, 7.5, 6.5); lamp(-9.7, -5, 5); lamp(9.4, -14, 5.8); lamp(-9.8, -22, 4.7, false); lamp(7.5, -33, 4.9, false); lamp(-9.9, -44, 4.5, false);
  for (let z = -28; z < 22; z += 18) {
    cylinder(.08, .12, 7.2, m.dark, -7.3, 3.6, z);
    curve([[-7.3, 7.2, z], [0, 6.1, z], [10, 7.5, z]], .026, m.dark);
  }
  curve([[0, 6.8, 30], [0, 5.9, 4], [-.8, 6.4, -16], [-.8, 6.8, -53]], .025, m.dark, root, 90);

  function bench(x, z, rot = 0) {
    const g = new THREE.Group(); g.position.set(x, .4, z); g.rotation.y = rot; root.add(g);
    for (const xx of [-1.1, 1.1]) { rod([xx, 0, .42], [xx, .8, .32], .09, m.dark, g); rod([xx, 0, -.4], [xx, 1.7, -.5], .09, m.dark, g); curve([[xx, .9, -.45], [xx, 1.1, .12], [xx, .92, .5]], .065, m.dark, g); }
    for (let z = -.42; z <= .42; z += .2) box(2.8, .1, .16, m.wood, 0, .73, z, g, .035);
    for (let y = 1; y < 1.7; y += .21) { const slat = box(2.8, .16, .1, m.wood, 0, y, -.47, g, .035); fuzz(slat, 200); }
    shadow(x, z, 4, 2, .4);
  }
  bench(-7.7, 7.5, -.15); bench(9.7, 1.8, -Math.PI / 2); bench(-8.1, -15, -.12);
  // Mail box, quay bollards and a life ring: close objects have real silhouette fibres.
  const post = new THREE.Group(); post.position.set(-7.2, .3, 12.7); root.add(post);
  const postBody = cylinder(.49, .49, 2.6, m.coral, 0, 1.43, 0, post, 24); fuzz(postBody, 4000, .054);
  const postCap = sphere(.58, m.coral, 0, 2.76, 0, post, 1, .35, 1); fuzz(postCap, 1000, .05);
  cylinder(.56, .6, .25, m.dark, 0, .16, 0, post, 24);
  box(.63, .17, .14, m.dark, 0, 2.14, .48, post, .04); box(.5, .79, .06, m.paper, 0, 1.42, .49, post, .045);
  for (let y = 1.17; y < 1.7; y += .12) box(.28 + rnd(0, .1), .02, .02, m.ash || m.wood, 0, y, .535, post, .004);
  seam([-.32, .75, .5], [-.32, 2.5, .5], post, m.rope, .15); seam([.32, .75, .5], [.32, 2.5, .5], post, m.rope, .15);
  shadow(-7.2, 12.7, 2, 2, .65);
  const rail = new THREE.Group(); root.add(rail);
  for (let z = -6; z < 20; z += 3) { cylinder(.19, .22, 1.5, m.dark, -10.7, .82, z, rail); sphere(.24, m.dark, -10.7, 1.58, z, rail, 1, .8, 1); }
  for (let z = -6; z < 17; z += 3) curve([[-10.7, 1.35, z], [-10.7, 1.05, z + 1.5], [-10.7, 1.35, z + 3]], .065, m.rope, rail, 12);
  const ring = torus(.74, .19, m.paper, -10.38, 1.15, 4.5); ring.rotation.y = Math.PI / 2; fuzz(ring, 2500, .05);
  for (let a = 0; a < 4; a++) { const t = a / 4 * Math.PI * 2; const wrap = box(.41, .37, .26, m.coral, -10.15, 1.15 + Math.cos(t) * .73, 4.5 + Math.sin(t) * .73, root, .07); wrap.rotation.x = t; }
  const buoy = new THREE.Group(); buoy.position.set(-13.5, -.77, -6.5); scene.add(buoy);
  cylinder(.7, .92, .65, m.paper, 0, .35, 0, buoy); cylinder(.47, .7, .62, m.coral, 0, .97, 0, buoy); cylinder(.18, .46, .65, m.paper, 0, 1.55, 0, buoy); rod([0, 1.88, 0], [0, 2.67, 0], .07, m.dark, buoy); torus(.22, .045, m.dark, 0, 2.7, 0, buoy); animated.push({ type: 'buoy', o: buoy, y: -.77 });

  function cypress(x, z, h) {
    cylinder(.15, .22, h * .8, m.trunk, x, h * .4, z);
    const points=[];
    for(let i=0;i<=26;i++){const t=i/26;points.push(new THREE.Vector2(Math.pow(Math.sin(t*Math.PI),.68)*h*.105*(1-.3*t)*(1+.05*Math.sin(t*23)),h*(.20+t*.80)));}
    const geometry=new THREE.LatheGeometry(points,32);geometry.computeVertexNormals();
    const leaf=mesh(geometry,m.leaf,x,.2,z);if(z>-25)fuzz(leaf,3300,.035);
    for(let i=0;i<3;i++){
      const a=i*Math.PI*2/3,pts=[];
      for(let k=4;k<24;k+=2){const t=k/26,r=Math.pow(Math.sin(t*Math.PI),.68)*h*.106*(1-.3*t);pts.push([x+Math.cos(a)*r,h*(.20+t*.80)+.2,z+Math.sin(a)*r]);}
      curve(pts,.009,m.trunk,root,26);
    }
  }
  for (const [x,z,h] of [[17,-1,8],[12,-14,12],[9,-25,10],[7,-43,11],[-5,-28,8],[-9,-48,8],[23,5,10],[-18,-40,7]]) cypress(x,z,h);
  // A foreground tree frames the sky and makes orbiting reveal real depth.
  const tree = new THREE.Group(); tree.position.set(-11.8, .35, 6.8); root.add(tree);
  const trunk = cylinder(.33, .68, 7.5, m.trunk, 0, 3.6, 0, tree, 12); trunk.rotation.z = -.12; fuzz(trunk, 5400, .075);
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2, xx = Math.cos(a) * rnd(2.5, 4.5), zz = Math.sin(a) * rnd(2, 4);
    const branch = rod([-.5, 4.4, 0], [xx, 7.5 + rnd(-.5,1.2), zz], .18, m.trunk, tree); fuzz(branch, 700, .055);
    for (let j = 0; j < 3; j++) { const leaf = sphere(rnd(1.15,1.85), j % 2 ? m.leaf : m.leafLight, xx + rnd(-1.1,1.1), 8 + rnd(-.4,1), zz + rnd(-.9,.9), tree, 1.3,.6,1); fuzz(leaf, 1800, .095); }
  }
  function planter(x, z, size = 1) {
    cylinder(.57 * size, .42 * size, .76 * size, m.cream, x, .38 * size + .2, z);
    sphere(.6 * size, m.leaf, x, .9 * size, z, root, 1, .55, 1);
    for (let i = 0; i < 10; i++) { const a = rnd(0,Math.PI*2), r = rnd(.1,.5)*size; sphere(.09 * size, i % 3 ? m.paper : m.brass, x + Math.cos(a)*r, (1 + rnd(-.1,.15))*size, z + Math.sin(a)*r); }
  }
  planter(-6.1,9.3,1.1); planter(9.8,9.7,1.3); planter(8,-7,1.1); planter(11.2,-9,1.3); planter(-8.4,14.7,.9);

  // Touchable repair equipment. Only these local circuits light when restored.
  // Their state comes from the shared story; there is no client-side puzzle solution.
  const powerLedMaterial = new THREE.MeshStandardMaterial({color:0x585b48,emissive:C.butterSoft,emissiveIntensity:0,roughness:.6});
  const radioLedMaterial = new THREE.MeshStandardMaterial({color:0x544943,emissive:C.coral,emissiveIntensity:0,roughness:.6});
  const workLampMaterial = new THREE.MeshStandardMaterial({color:0x908775,emissive:C.butterSoft,emissiveIntensity:0,roughness:.65});
  const powerBox=new THREE.Group();powerBox.position.set(-2.75,.28,.38);root.add(powerBox);
  const batteryCase=box(1.18,1.24,.66,m.blue,0,.7,0,powerBox,.12);fuzz(batteryCase,2100,.04);
  box(1.0,.91,.055,m.dark,0,.78,.352,powerBox,.07);
  const powerKnobs=[];
  for(const x of [-.34,0,.34]){
    const knob=cylinder(.095,.095,.10,m.brass,x,.96,.433,powerBox,18);knob.rotation.x=Math.PI/2;
    torus(.13,.02,m.rope,x,.96,.447,powerBox);
    const pointer=box(.018,.075,.017,m.paper,x,.98,.491,powerBox,.005);powerKnobs.push(pointer);
  }
  for(const x of [-.34,0,.34]){
    rod([x,.67,.405],[x,.84,.405],.018,m.rope,powerBox);
    box(.22,.045,.023,powerLedMaterial,x,.54,.413,powerBox,.014);
  }
  // A stitched lid, a carry strap and insulated leads make the equipment a made object.
  seam([-.48,1.31,.31],[.48,1.31,.31],powerBox,m.rope,.14);
  curve([[-.34,1.36,0],[-.3,1.62,0],[.3,1.62,0],[.34,1.36,0]],.06,m.dark,powerBox,16);
  curve([[-2.18,.56,.25],[-1.76,.3,.31],[-1.7,.26,-.15],[-1.15,.42,-.4]],.034,m.coral);
  cylinder(.055,.08,1.55,m.dark,-3.48,1.03,.05);
  const workLamp=cylinder(.045,.30,.27,m.dark,-3.48,1.79,.05);workLamp.rotation.z=-.22;
  const workBulb=sphere(.12,workLampMaterial,-3.42,1.62,.05);workBulb.castShadow=false;
  const workLight=new THREE.PointLight(C.butterSoft,0,6,2);workLight.position.set(-3.40,1.59,.05);workLight.castShadow=true;workLight.shadow.mapSize.set(512,512);workLight.shadow.normalBias=.02;scene.add(workLight);
  shadow(-2.75,.4,2.2,1.9,.45);

  const radioDesk=new THREE.Group();radioDesk.position.set(9.25,.3,-3.15);radioDesk.rotation.y=-Math.PI/2;root.add(radioDesk);
  for(const x of [-.53,.53])for(const z of [-.32,.32])box(.09,1.06,.09,m.dark,x,.53,z,radioDesk,.025);
  box(1.46,.15,.94,m.wood,0,1.12,0,radioDesk,.075);
  const receiver=box(1.14,.61,.49,m.roof,0,1.49,-.06,radioDesk,.095);fuzz(receiver,2300,.04);
  box(.61,.17,.04,m.windowDim,-.11,1.58,.204,radioDesk,.02);
  for(let i=0;i<11;i++)box(.008,i%2?.045:.072,.016,m.brass,-.38+i*.052,1.58,.231,radioDesk,.002);
  const tuningNeedle=box(.013,.13,.023,radioLedMaterial,0,1.58,.239,radioDesk,.003);
  for(const x of [-.37,.36]){const dial=cylinder(.09,.09,.095,m.brass,x,1.35,.23,radioDesk,22);dial.rotation.x=Math.PI/2;}
  sphere(.035,radioLedMaterial,.41,1.63,.25,radioDesk);
  for(let y=1.33;y<1.53;y+=.045)box(.36,.011,.018,m.dark,.05,y,.236,radioDesk,.002);
  curve([[.36,1.84,-.05],[.37,2.11,-.09],[.55,2.4,-.15]],.018,m.brass,radioDesk,12);
  seam([-.49,1.81,.18],[.49,1.81,.18],radioDesk,m.rope,.13);
  const radioLight=new THREE.PointLight(C.butterSoft,0,3.8,2);radioLight.position.set(8.84,1.95,-3.15);scene.add(radioLight);
  shadow(9.25,-3.15,2,2.1,.45);

  // A few human traces stay quiet: wool blankets, a dropped glove and tide-line rope.
  const blanket=box(.91,.065,.76,m.coral,-7.58,1.20,7.42,root,.06);blanket.rotation.y=-.12;fuzz(blanket,1700,.038);
  for(let x=-7.92;x<-7.2;x+=.13)seam([x,1.24,7.13],[x,1.24,7.72],root,m.rope,.15);
  const glove=sphere(.14,m.brass,-6.93,.23,7.95,root,1,.30,1.5);fuzz(glove,250,.035);
  const crate=new THREE.Group();crate.position.set(-2.85,.22,8.35);crate.rotation.y=.18;root.add(crate);
  for(let y=.12;y<.77;y+=.21){for(const z of [-.55,.55])box(1.26,.17,.10,m.wood,0,y,z,crate,.035);for(const x of [-.58,.58])box(.10,.17,1.02,m.wood,x,y,0,crate,.035);}
  for(const x of [-.58,.58])for(const z of [-.53,.53])box(.11,.78,.11,m.dark,x,.4,z,crate,.03);
  box(1.3,.09,1.16,m.wood,0,.83,0,crate,.055);
  const folded=box(.9,.11,.79,m.curtain,-.06,.93,.09,crate,.07);folded.rotation.y=-.10;fuzz(folded,1800,.028);
  for(let x=-.41;x<.36;x+=.10)seam([x,1.0,-.17],[x,1.0,.40],crate,m.rope,.12);
  const spool=cylinder(.15,.15,.26,m.blue,.32,1.12,-.29,crate,20);fuzz(spool,350,.025);
  torus(.16,.033,m.wood,.32,1.0,-.29,crate).rotation.x=Math.PI/2;
  torus(.16,.033,m.wood,.32,1.26,-.29,crate).rotation.x=Math.PI/2;
  shadow(-2.85,8.35,2.7,2.5,.5);
  for(let i=0;i<4;i++){const rope=torus(.44-i*.07,.032,m.rope,-9.8,.23,5.67);rope.rotation.x=Math.PI/2;}
  for(const [x,z]of[[-7.15,13.55],[5.8,-9.2],[-4.3,8.0],[8.8,5.2]]){
    for(let k=0;k<3;k++){const leaf=box(.12,.012,.25,m.wood,x+rnd(-.18,.18),.185,z+rnd(-.18,.18),root,.028);leaf.rotation.y=rnd(0,6.28);}
  }

  // Harbor craft, rigging and stitched sails are modeled, not billboard scenery.
  function boat(x, z, scale, rotation) {
    const g = new THREE.Group(); g.position.set(x, -.92, z); g.scale.setScalar(scale); g.rotation.y = rotation; scene.add(g);
    const hull = sphere(1, m.blue, 0, .45, 0, g, 1.25, .75, 3.3); hull.castShadow = true;
    box(2.1,.13,5,m.wood,0,.87,0,g,.15); box(1.8,.8,1.5,m.paper,0,1.3,.6,g,.15); box(1.9,.16,1.65,m.roof,0,1.75,.6,g,.06);
    for (const xx of [-.6,0,.6]) box(.4,.42,.05,m.window,xx,1.31,1.37,g,.025);
    cylinder(.052,.085,7.5,m.wood,0,4,-.5,g);
    rod([0,7.7,-.5],[-1,1.1,2.6],.017,m.rope,g); rod([0,7.7,-.5],[1,1.1,2.6],.017,m.rope,g); rod([0,7.7,-.5],[0,1.1,-3.1],.017,m.rope,g);
    for (let zz=-2.6;zz<2.7;zz+=.65) { rod([-.95,.9,zz],[-.95,1.35,zz],.022,m.brass,g); rod([.95,.9,zz],[.95,1.35,zz],.022,m.brass,g); }
    rod([-.95,1.3,-2.6],[-.95,1.3,2.6],.025,m.rope,g); rod([.95,1.3,-2.6],[.95,1.3,2.6],.025,m.rope,g);
    batchModel(g); animated.push({type:'boat',o:g,y:-.92,phase:rnd(0,6)}); return g;
  }
  boat(-20,-15,1.15,-.3); boat(-26,-29,.95,.4); boat(-32,-36,.7,.3); boat(-17,-35,.8,-.2);
  // Distant lighthouse is the physical destination of one possible ending.
  const lighthouse = new THREE.Group(); lighthouse.position.set(-32, -.8, -54); root.add(lighthouse);
  for (let i = 0; i < 5; i++) sphere(rnd(2,4),m.rock,rnd(-2.6,2.6),rnd(-.8,.3),rnd(-2.6,2.6),lighthouse,1,1,1);
  cylinder(.95,1.5,10,m.paper,0,6.3,0,lighthouse,24); cylinder(1.1,1.14,.38,m.ash||m.dark,0,11.1,0,lighthouse,24);
  cylinder(.7,.7,1.4,m.windowOff,0,11.94,0,lighthouse,16); cylinder(.06,1.28,.8,m.roof,0,13.06,0,lighthouse,20);
  for (let i=0;i<8;i++){const a=i/8*Math.PI*2;rod([Math.sin(a)*.9,11.2,Math.cos(a)*.9],[Math.sin(a)*.9,12.7,Math.cos(a)*.9],.048,m.dark,lighthouse);}
  const beacon = sphere(.47,m.windowOff,0,11.98,0,lighthouse); const beaconGlow = glow(0,11.98,0,8,C.butterSoft,0,lighthouse);
  const beaconLight = new THREE.PointLight(C.butterSoft,0,30,2); beaconLight.position.set(-32,11.18,-54);scene.add(beaconLight);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(5.3,42,40,1,true),new THREE.MeshBasicMaterial({color:C.butterSoft,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending})); beam.position.set(-13,10.9,-54);beam.rotation.z=-Math.PI/2;scene.add(beam);

  // Rope rings in the water read as knitted ripples under the distant warm windows.
  const ripples = new THREE.Group(); scene.add(ripples);
  const rippleMats=Array.from({length:4},(_,i)=>new THREE.MeshBasicMaterial({color:i?0x7896b3:C.butterSoft,transparent:true,opacity:.08+i*.025,depthWrite:false}));
  for(let i=0;i<75;i++) {
    const o = new THREE.Mesh(new THREE.PlaneGeometry(rnd(.6,4.7),rnd(.025,.09)), rippleMats[i%4]);
    o.rotation.x=-Math.PI/2;o.position.set(rnd(-47,-12),-1.02,rnd(-55,20));ripples.add(o);
  }
  batchModel(ripples,true);

  function batchModel(group,transparent=false){
    group.updateWorldMatrix(true,true);const inverse=group.matrixWorld.clone().invert(),groups=new Map(),originals=[];
    group.traverse(o=>{if(!o.isMesh||(!transparent&&o.material.transparent))return;
      let g=o.geometry.clone();if(g.index)g=g.toNonIndexed();for(const name of Object.keys(g.attributes))if(!['position','normal','uv'].includes(name))g.deleteAttribute(name);
      if(!g.attributes.uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
      g.applyMatrix4(inverse.clone().multiply(o.matrixWorld));if(!groups.has(o.material))groups.set(o.material,[]);groups.get(o.material).push(g);originals.push(o);
    });
    for(const o of originals)o.removeFromParent();for(const [material,gs]of groups){const geometry=mergeGeometries(gs,false);gs.forEach(g=>g.dispose());if(!geometry)continue;const o=new THREE.Mesh(geometry,material);o.castShadow=!transparent&&!material.emissive?.getHex();o.receiveShadow=!transparent;group.add(o);}
  }

  // Merge static geometry by material; retain spatial hit volumes independently.
  root.updateMatrixWorld(true);
  const buckets = new Map(), toRemove = [];
  root.traverse(o => {
    if(!o.isMesh || o===beacon || o===tuningNeedle || powerKnobs.includes(o) || (o.material.transparent&&o.material!==m.glass) || Array.isArray(o.material))return;
    const key=o.material.uuid; if(!buckets.has(key))buckets.set(key,{material:o.material,geometries:[]});
    let g=o.geometry.clone(); if(g.index)g=g.toNonIndexed();
    for(const name of Object.keys(g.attributes))if(!['position','normal','uv'].includes(name))g.deleteAttribute(name);
    if(!g.attributes.uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
    g.applyMatrix4(o.matrixWorld); buckets.get(key).geometries.push(g); toRemove.push(o);
  });
  for(const o of toRemove)o.removeFromParent();
  for(const {material,geometries:gs} of buckets.values()) {
    const combined=mergeGeometries(gs,false); for(const g of gs)g.dispose();
    if(combined){const o=new THREE.Mesh(combined,material);o.castShadow=!material.transparent&&!material.emissive?.getHex()&&![m.paving,m.pavingLight,m.ocean].includes(material);o.receiveShadow=true;scene.add(o);}
  }
  const fiberGeo=new THREE.BufferGeometry();fiberGeo.setAttribute('position',new THREE.Float32BufferAttribute(fiberPositions,3));fiberGeo.setAttribute('color',new THREE.Float32BufferAttribute(fiberColors,3));fiberGeo.setAttribute('normal',new THREE.Float32BufferAttribute(fiberNormals,3));
  const fibers=new THREE.Mesh(fiberGeo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide}));fibers.receiveShadow=false;scene.add(fibers);

  const composer=new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene,camera));
  const occlusion=new SSAOPass(scene,camera,Math.ceil(container.clientWidth*.65),Math.ceil(container.clientHeight*.65),16);
  occlusion.kernelRadius=.65;occlusion.minDistance=.0004;occlusion.maxDistance=.017;
  const aoSize=occlusion.setSize.bind(occlusion);occlusion.setSize=(w,h)=>aoSize(Math.ceil(w*.65),Math.ceil(h*.65));
  const aoRender=occlusion.render.bind(occlusion);
  occlusion.render=(...args)=>{
    // FOV changes while walking/zooming without a canvas resize.
    occlusion.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(camera.projectionMatrix);
    occlusion.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(camera.projectionMatrixInverse);
    const hidden=[];scene.traverse(o=>{if(o.visible&&(o===fibers||o.isSprite||(o.isMesh&&o.material&&(o.material.visible===false||o.material.transparent||o.material.depthWrite===false)))){hidden.push(o);o.visible=false;}});
    try{aoRender(...args);}finally{hidden.forEach(o=>{o.visible=true;});}
  };
  composer.addPass(occlusion);
  // Local light sprites provide the small optical halos. Avoid a full-frame
  // bloom convolution: it obscures fibre contrast and amplified invalid HDR pixels.
  composer.addPass(new OutputPass());
  renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  const poses={
    street:{position:vec(4.65,2.03,15.8),target:vec(-1.5,3.15,-10)},
    overview:{position:vec(30,29,32),target:vec(-3,2,-12)},
    tram:{position:vec(-4.45,2.03,2.7),target:vec(-1.5,1.9,-.2)},
    radio:{position:vec(6.65,2.03,-1.6),target:vec(9.4,1.8,-3.2)},
    buoy:{position:vec(-7.8,2.03,5.0),target:vec(-10.4,1.2,4.5)},
    postbox:{position:vec(-4.85,2.03,14.7),target:vec(-7.2,1.8,12.7)},
    lighthouse:{position:vec(-4,5.5,15),target:vec(-25,5,-34)},
    station:{position:vec(2.4,5.3,15.1),target:vec(11.1,5,-5)},
    homes:{position:vec(-6,8,22),target:vec(15,6,-20)}
  };
  const objectInfo=[
    {id:'tram',title:'전차 연결함',point:vec(-2.75,2.3,.38),interaction:vec(-2.75,1.2,.38),role:'signal'},
    {id:'radio',title:'방송국 수신기',point:vec(9.25,2.6,-3.15),interaction:vec(9.25,1.9,-3.15),role:'archive'},
    {id:'buoy',title:'항구의 구명환',point:vec(-10.38,2.2,4.5),interaction:vec(-10.38,1.15,4.5),role:'coast'},
    {id:'postbox',title:'빨간 우체통',point:vec(-7.2,3.3,12.7),interaction:vec(-7.2,1.8,12.7),role:'courier'}
  ];
  const hitVolumes=[];
  for(const item of objectInfo){
    const button=document.createElement('button');button.className='hotspot';button.dataset.object=item.id;button.innerHTML='<i aria-hidden="true"></i><span></span>';button.querySelector('span').textContent=item.title;button.setAttribute('aria-label',`${item.title} 조사`);button.addEventListener('click',()=>{focus(item.id);onInspect(item.id);});hotspots.append(button);item.button=button;
    const hit=mesh(new THREE.BoxGeometry(item.id==='tram'?3.5:2.7,item.id==='tram'?4.4:3.5,item.id==='tram'?6:2.7),new THREE.MeshBasicMaterial({visible:false}),item.point.x,item.point.y-1.7,item.point.z,scene);hit.userData.objectId=item.id;hitVolumes.push(hit);
  }
  let phase='entry',quality='auto',frameCount=0,sampleFrames=0,sampleMs=0,autoReduced=false,active=true;
  let endingChoice=null,restorationState={power:false,radio:false,rotations:[0,0,0],frequency:93};
  const pointerVec=new THREE.Vector2(),raycaster=new THREE.Raycaster();
  const navigation=createNavigation({canvas:renderer.domElement,camera,poses,objects:objectInfo,onInspect,onStatus,onClick:e=>{
    const r=renderer.domElement.getBoundingClientRect();pointerVec.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointerVec,camera);const hit=raycaster.intersectObjects(hitVolumes,false)[0];if(hit){focus(hit.object.userData.objectId);onInspect(hit.object.userData.objectId);}
  }});
  function focus(id){navigation.focus(id);onStatus?.({place:objectInfo.find(o=>o.id===id)?.title||'서쪽 해안, 오래된 전차 광장'});}
  const resize=()=>{const w=container.clientWidth,h=container.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);composer.setSize(w,h);};
  const observer=new ResizeObserver(resize);observer.observe(container);
  function setQuality(value){quality=value;const low=value==='low'||(value==='auto'&&autoReduced);renderer.setPixelRatio(low?Math.min(devicePixelRatio,1):Math.min(devicePixelRatio,coarse?1.25:1.6));occlusion.enabled=!low;puddles.visible=!low;fibers.visible=!low;atmosphere.setQuality(low);renderer.shadowMap.enabled=true;renderer.shadowMap.needsUpdate=true;resize();onStatus?.({quality:low?'가벼운 실시간 3D':'실시간 3D · 펠트와 빛'});}
  let previous=performance.now(),elapsed=0;
  const projected=new THREE.Vector3();
  function frame(now){
    if(!active)return;requestAnimationFrame(frame);const dt=Math.min((now-previous)/1000,.1);previous=now;if(document.hidden)return;elapsed+=dt;
    navigation.update(dt);atmosphere.update(elapsed,reduced);
    if(!reduced){
      for(const a of animated){
        if(a.type==='water'&&frameCount%3===0){const p=a.o.geometry.attributes.position;for(let i=0;i<p.count;i++){const x=a.base[i*3],z=a.base[i*3+2];p.setY(i,Math.sin(x*.32+elapsed*.6)*Math.cos(z*.17+elapsed*.25)*.075+Math.sin(x*1.9+z*.8+elapsed)*.018);}p.needsUpdate=true;if(frameCount%30===0)a.o.geometry.computeVertexNormals();}
        else if(a.type==='buoy'){a.o.rotation.z=Math.sin(elapsed*.65)*.055;a.o.position.y=a.y+Math.sin(elapsed*.8)*.055;}
        else if(a.type==='boat'){a.o.rotation.z=Math.sin(elapsed*.4+a.phase)*.025;a.o.position.y=a.y+Math.sin(elapsed*.48+a.phase)*.05;}
      }
      if(endingChoice==='lighthouse')beam.rotation.y=Math.sin(elapsed*.18)*.13;
    }
    if(phase!=='entry')for(const item of objectInfo){
      projected.copy(item.point).project(camera);const x=(projected.x*.5+.5)*container.clientWidth,y=(-projected.y*.5+.5)*container.clientHeight;
      const visible=projected.z<1&&projected.z>0&&x>25&&x<container.clientWidth-25&&y>80&&y<container.clientHeight-60;
      item.button.style.visibility=visible?'visible':'hidden';item.button.dataset.near=String(navigation.getState().nearest===item.id);item.button.style.transform=`translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) translate(-50%,-100%)`;
    }
    renderer.info.reset();composer.render();frameCount++;sampleFrames++;sampleMs+=dt*1000;
    if(quality==='auto'&&!autoReduced&&sampleFrames>120&&sampleMs>6500){autoReduced=true;setQuality('auto');}
    if(sampleFrames>180){sampleFrames=0;sampleMs=0;}
  }
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();active=false;onStatus?.({lost:true});});
  renderer.domElement.addEventListener('webglcontextrestored',()=>{location.reload();});
  setQuality('auto');resize();navigation.update(0);await renderer.compileAsync(scene,camera);composer.render();requestAnimationFrame(frame);
  return {
    focus,
    setQuality,
    setCameraMode:navigation.setCameraMode,
    setWalkMode:navigation.setWalkMode,
    getNavigationState:navigation.getState,
    setReducedMotion(value){reduced=Boolean(value);navigation.setReducedMotion(reduced);},
    setPhase(next){phase=next;hotspots.inert=next==='entry';navigation.setEnabled(next!=='entry');},
    setRole(role,inspected=[]){for(const o of objectInfo){o.button.dataset.own=String(o.role===role);o.button.dataset.done=String(inspected.includes(o.id));}},
    setEnding(choice){
      if(choice===endingChoice)return;endingChoice=choice;
      beacon.material=choice==='lighthouse'?m.lamp:m.windowOff;beaconGlow.material.opacity=choice==='lighthouse'?.52:0;beaconLight.intensity=choice==='lighthouse'?120:0;beam.material.opacity=choice==='lighthouse'?.018:0;
      if(choice==='station'){for(const l of lights)l.intensity=42;tramSignal.intensity=1.5;}
      else if(choice==='homes'){m.window.emissiveIntensity=.83;for(const l of lights)l.intensity=24;}
      else {m.window.emissiveIntensity=.37;for(const l of lights)l.intensity=35;tramSignal.intensity=5;}
      if(choice)focus(choice);
    },
    updateRestoration(restoration={}){
      const power=Boolean(restoration.power?.solved),radio=Boolean(restoration.radio?.solved);
      const rotations=Array.isArray(restoration.power?.rotations)?restoration.power.rotations.slice(0,3):[0,0,0];
      for(let i=0;i<3;i++)powerKnobs[i].rotation.z=-(Number(rotations[i])||0)*Math.PI/2;
      const frequency=clamp(Number(restoration.radio?.frequency)||93,90,104);
      tuningNeedle.position.x=-.38+(frequency-90)/14*.52;
      if(power===restorationState.power&&radio===restorationState.radio){restorationState={power,radio,rotations,frequency};return;}
      powerLedMaterial.emissiveIntensity=power?1.5:0;workLampMaterial.emissiveIntensity=power?1.7:0;workLight.intensity=power?13:0;
      radioLedMaterial.emissiveIntensity=radio?1.5:0;radioLight.intensity=radio?2.8:0;
      restorationState={power,radio,rotations,frequency};
      renderer.shadowMap.needsUpdate=true;
    },
    getMetrics(){return {renderer:'Three.js r180 / WebGL2',geometries:renderer.info.memory.geometries,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,pixelRatio:renderer.getPixelRatio(),quality,autoReduced,reflections:puddles.visible,silhouetteFibres:fibers.visible,contactOcclusion:occlusion.enabled,reducedMotion:reduced,textile:feltMaterials.source,navigation:navigation.getState(),restoration:{...restorationState,workLight:workLight.intensity,radioLight:radioLight.intensity}};},
    dispose(){active=false;navigation.dispose();atmosphere.dispose();feltMaterials.dispose();observer.disconnect();occlusion.dispose();composer.dispose();puddles.dispose();renderer.dispose();}
  };
}
