import { TOWN_LAYOUT, layoutWorldPoint } from './town-layout.mjs';
// The town's static, original 3D environment. Coordinates deliberately match
// walk.mjs and the shared town-layout.mjs. Visual walls match the shared solids.
// Three and the existing material library are injected by day-scene.mjs.
const TAU = Math.PI * 2;
const PLACES = { home: [-6, 0], cafe: [0, 0], workshop: [6, 0], greenhouse: [0, -6] };
const random = seed => () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);

export function buildTownEnvironment(THREE, world, m, helpers = {}) {
  const rand = random(81026), roots = [], buildings = [], hitTargets = [], occlusionMeshes = [], occlusionRoots = [];
  const plantingMasks=[],soilPatchData={positions:[],uv:[],indices:[],colors:[]},districtFloorRecords=[],floorRegions=[],stoneFloorRegions=[];
  const baseFloorY=TOWN_LAYOUT.ground.rootY+TOWN_LAYOUT.ground.localY;
  const ownedMaterials = new Set(), ownedGeometries = new Set(), ownedTextures = new Set(), batches = new Map(), curvedBatches = new Map();
  const cube = geometry(new THREE.BoxGeometry(1, 1, 1));
  const eased = geometry(easedBoxGeometry(.035));
  const pillow = geometry(pillowGeometry());
  const dressedStone = geometry(easedBoxGeometry(.075));
  const cylinder = geometry(new THREE.CylinderGeometry(1, 1, 1, 20));
  const twig = geometry(new THREE.CylinderGeometry(1, 1, 1, 4, 1, true));
  const sphere = geometry(new THREE.SphereGeometry(1, 16, 12));
  const leaf = geometry(leafGeometry(6, 2));
  const canopyLeaf = geometry(leafGeometry(4, 3));
  const cloverLeaf = geometry(cloverGeometry());
  const crownLeaf = geometry(crownLeafGeometry());
  const flowerBud = geometry(new THREE.SphereGeometry(1, 4, 3));
  const pebble = geometry(organicStoneGeometry());
  const stem = material({ color: '#536143', roughness: .91 });
  const foliage = m.foliage || material({ color: '#ffffff', roughness: .84, side: THREE.DoubleSide });
  const flowers = material({ color: '#ffffff', roughness: .77, side: THREE.DoubleSide });
  const bark = material({ color: '#776049', roughness: .93, bumpMap: m.wood?.bumpMap || m.wood?.map, bumpScale: .04 });
  const stone = m.stone ? m.stone.clone() : material({ color: '#e7dfc9', roughness: .89, bumpScale: .018 }); ownedMaterials.add(stone);
  const paving = m.paving ? m.paving.clone() : material({ color: '#ffffff', roughness: .88, bumpMap: m.stone?.bumpMap, bumpScale: .014 }); ownedMaterials.add(paving);
  // Cool-neutral limestone connects white plaster and ceramic, while the
  // natural timber maru gives the shared tea-room frontage its warm centre.
  paving.color.set('#eef0ed');
  const mortar = material({ color: '#b8beb5', roughness: 1 });
  const gravel = material({ color: '#d8ceba', roughness: .98, bumpMap: m.stone?.bumpMap || m.stone?.map, bumpScale: .013 });
  const gardenSoil = material({ color: '#827859', roughness: 1, bumpMap: m.soil?.bumpMap, bumpScale: .019 });
  const homePlaster = m.plasterWarm.clone(); homePlaster.color.set('#f4f5f1'); ownedMaterials.add(homePlaster);
  const cafePlaster = m.plaster.clone(); cafePlaster.color.set('#f4f5f1'); ownedMaterials.add(cafePlaster);
  const workshopPlaster = m.plaster.clone(); workshopPlaster.color.set('#eff1ed'); ownedMaterials.add(workshopPlaster);
  const shutters = material({ color: '#d8dfd9', roughness: .83, map: m.wood?.map, normalMap: m.wood?.normalMap, normalScale: new THREE.Vector2(.14, .14) });
  const metal = material({ color: '#46564d', metalness: .58, roughness: .40 });
  const glassBacking = material({ color: '#433f36', roughness: .91, metalness: 0 });
  const interiorPlaster = material({ color: '#897b64', roughness: .94 });
  const farFoliage = material({ color: '#ffffff', roughness: .94, side: THREE.DoubleSide, map: m.foliage?.map, normalMap: m.foliage?.normalMap, normalScale: new THREE.Vector2(.06,.06) });
  const cloth = m.cotton ? m.cotton.clone() : material({ color: '#ffffff', roughness: .93, bumpMap: m.awning?.bumpMap, bumpScale: .014 });
  cloth.side = THREE.DoubleSide; ownedMaterials.add(cloth);
  const guideCloth = m.lapis ? m.lapis.clone() : material({ color: '#3d6bc9', roughness: .92 });
  guideCloth.side = THREE.DoubleSide; ownedMaterials.add(guideCloth);
  const coral = m.coral || material({ color: '#f96859', roughness: .42 });
  const butter = m.butter || material({ color: '#f5c445', roughness: .6, emissive: '#f5c445', emissiveIntensity: .08 });
  const terrainMaterial = material({ color: '#ffffff', vertexColors: true, roughness: 1, bumpMap: m.soil?.bumpMap, bumpScale: .026 });
  const cliffMaterial = material({ color: '#83917e', roughness: .94, bumpMap: m.stone?.bumpMap, bumpScale: .035 });
  const greenhouseGlass = m.glass.clone(); greenhouseGlass.opacity = .16; greenhouseGlass.depthWrite = false; ownedMaterials.add(greenhouseGlass);
  const ground = root('town-landscape', [0, .20, 0]);

  // Surface-scale colour is separate from the large terrain colour field.
  // Small, low-contrast fibres avoid both a flat khaki plane and TV-like noise.
  const grassMap = surfaceTexture('grass', [24, 22]);
  terrainMaterial.map = terrainMaterial.bumpMap = grassMap; terrainMaterial.bumpScale = .014;
  gardenSoil.color.set('#ffffff'); gardenSoil.vertexColors = true; gardenSoil.map = grassMap;
  if (!m.paving) { const pavingMap = surfaceTexture('stone', [1.35, 1.35]); paving.map = paving.bumpMap = pavingMap; paving.bumpScale = .010; }

  function plantingMask(points) {
    const xs=points.map(p=>p[0]),zs=points.map(p=>p[1]);plantingMasks.push({points,minX:Math.min(...xs),maxX:Math.max(...xs),minZ:Math.min(...zs),maxZ:Math.max(...zs)});
  }
  function clearOfWalkingSurface(x,z,margin=.20) {
    for(const mask of plantingMasks){
      if(x<mask.minX-margin||x>mask.maxX+margin||z<mask.minZ-margin||z>mask.maxZ+margin)continue;
      let inside=false;const points=mask.points;
      for(let i=0,j=points.length-1;i<points.length;j=i++){
        const a=points[j],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));
        if((x-a[0]-dx*t)**2+(z-a[1]-dz*t)**2<margin*margin)return false;
        if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
      }
      if(inside)return false;
    }
    return true;
  }
  function recordFloor(points,height,id='floor-'+floorRegions.length){
    const xs=points.map(p=>p[0]),zs=points.map(p=>p[1]);floorRegions.push({id,points,height,minX:Math.min(...xs),maxX:Math.max(...xs),minZ:Math.min(...zs),maxZ:Math.max(...zs)});
  }
  function insideFloorPolygon(x,z,points){
    let inside=false;
    for(let i=0,j=points.length-1;i<points.length;j=i++){
      const a=points[j],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));
      if((x-a[0]-dx*t)**2+(z-a[1]-dz*t)**2<1e-10)return true;
      if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
    }
    return inside;
  }
  function recordStoneFloor(geo,p,scale,rotation){
    const object=new THREE.Object3D();object.position.set(p[0],p[1]+ground.position.y,p[2]);object.scale.set(...scale);object.rotation.set(...rotation);object.updateMatrix();
    const position=geo.attributes.position,index=geo.index,points=[];for(let i=0;i<position.count;i++)points.push(new THREE.Vector3().fromBufferAttribute(position,i).applyMatrix4(object.matrix));
    const triangles=[];for(let i=0;i<index.count;i+=3){const a=points[index.getX(i)],b=points[index.getX(i+1)],c=points[index.getX(i+2)],area=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);if(Math.abs(area)>1e-10)triangles.push({a:a.toArray(),b:b.toArray(),c:c.toArray(),inverseArea:1/area});}
    stoneFloorRegions.push({minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minZ:Math.min(...points.map(p=>p.z)),maxZ:Math.max(...points.map(p=>p.z)),triangles});
  }
  function floorHeight(x,z){
    if(disposed||!Number.isFinite(x)||!Number.isFinite(z))return baseFloorY;
    let height=baseFloorY;
    for(const region of floorRegions){if(x<region.minX-1e-5||x>region.maxX+1e-5||z<region.minZ-1e-5||z>region.maxZ+1e-5)continue;if(insideFloorPolygon(x,z,region.points))height=Math.max(height,region.height);}
    for(const region of stoneFloorRegions){if(x<region.minX||x>region.maxX||z<region.minZ||z>region.maxZ)continue;for(const t of region.triangles){const u=((t.b[2]-t.c[2])*(x-t.c[0])+(t.c[0]-t.b[0])*(z-t.c[2]))*t.inverseArea,v=((t.c[2]-t.a[2])*(x-t.c[0])+(t.a[0]-t.c[0])*(z-t.c[2]))*t.inverseArea,w=1-u-v;if(u>=-1e-6&&v>=-1e-6&&w>=-1e-6)height=Math.max(height,u*t.a[1]+v*t.b[1]+w*t.c[1]);}}
    return height;
  }
  function geometry(value) { ownedGeometries.add(value); return value; }
  function material(options) { const value = new THREE.MeshStandardMaterial(options); ownedMaterials.add(value); return value; }
  function surfaceTexture(kind, repeat) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
    const c = canvas.getContext('2d'), rng = random(kind === 'grass' ? 835 : 1643), data = c.createImageData(512, 512);
    for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
      const nx = x / 512 * TAU, ny = y / 512 * TAU;
      const broad = Math.sin(nx * 3 + Math.sin(ny * 2) * 1.6) * 1.2
        + Math.cos(ny * 5 - Math.sin(nx * 3)) * .8 + Math.sin(nx * 7 + Math.sin(ny * 4)) * .55;
      const n = (kind === 'grass' ? 218 : 237) + broad + (rng() - .5) * (kind === 'grass' ? 13 : 10), i = (y * 512 + x) * 4;
      data.data[i] = n; data.data[i + 1] = n + (kind === 'grass' ? 2 : 0); data.data[i + 2] = n - 3; data.data[i + 3] = 255;
    }
    c.putImageData(data, 0, 0);
    if (kind === 'grass') for (let i = 0; i < 22000; i++) {
      const x = rng() * 512, y = rng() * 512, length = 1.8 + rng() * 4.5;
      c.strokeStyle = i % 3 ? 'rgba(103,123,82,.105)' : 'rgba(249,239,197,.18)'; c.lineWidth = .55 + rng() * .35;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + (rng() - .5) * 2, y - length); c.stroke();
    }
    else for (let i = 0; i < 6300; i++) {
      c.fillStyle = i % 2 ? 'rgba(114,112,98,.065)' : 'rgba(255,255,245,.19)'; c.fillRect(rng() * 512, rng() * 512, .5 + rng(), .5 + rng());
    }
    const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 4; ownedTextures.add(t); return t;
  }
  function root(name, p = [0, 0, 0]) { const g = new THREE.Group(); g.name = name; g.position.set(...p); world.add(g); roots.push(g); return g; }
  function part(parent, geo, mat, p = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0], cast = true) {
    const obj = new THREE.Mesh(geo, mat); obj.position.set(...p); obj.scale.set(...scale); obj.rotation.set(...rotation);
    obj.castShadow = cast; obj.receiveShadow = true; parent.add(obj); return obj;
  }
  function batch(parent, geo, mat, p, scale = [1, 1, 1], rotation = [0, 0, 0], color, cast = true) {
    let entries = batches.get(parent); if (!entries) batches.set(parent, entries = new Map());
    const key = `${geo.uuid}:${mat.uuid}:${cast}`;
    let b = entries.get(key); if (!b) entries.set(key, b = { geo, mat, cast, items: [] });
    b.items.push({ p, scale, rotation, color });
  }
  const timber = (g, p, s, r, mat = m.wood) => batch(g, eased, mat, p, s, r);
  const stoneBlock = (g, p, s, c) => batch(g, dressedStone, stone, p, s, undefined, c);
  function beam(g, a, b, width, mat = bark, profile = cylinder, cast = true) {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), direction = to.clone().sub(from);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
    const euler = new THREE.Euler().setFromQuaternion(q);
    batch(g, profile, mat, from.add(to).multiplyScalar(.5).toArray(), [width, direction.length(), width], [euler.x, euler.y, euler.z], undefined, cast);
  }
  // Shared chamfered profiles catch light along timber/stone edges. Instancing
  // preserves the small draw-call count, while removing razor-sharp box seams.
  function easedBoxGeometry(radius) {
    const g = new THREE.BoxGeometry(1, 1, 1, 3, 3, 3), p = g.attributes.position, n = g.attributes.normal;
    const inner = .5 - radius;
    for (let i = 0; i < p.count; i++) {
      const coordinate = v => Math.abs(v) < .49 ? Math.sign(v) * inner : v;
      const v = new THREE.Vector3(coordinate(p.getX(i)), coordinate(p.getY(i)), coordinate(p.getZ(i)));
      const core = v.clone().clampScalar(-inner, inner);
      v.sub(core).normalize(); n.setXYZ(i, v.x, v.y, v.z); v.multiplyScalar(radius).add(core); p.setXYZ(i, v.x, v.y, v.z);
    }
    return g;
  }
  function organicStoneGeometry(segments = 8, rings = 4) {
    const g = new THREE.SphereGeometry(1, segments, rings), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const r = 1 + Math.sin(x * 7 + z * 4) * .043 + Math.cos(y * 9 - x * 2) * .036;
      p.setXYZ(i, x * r, y * r, z * r);
    }
    g.computeVertexNormals(); return g;
  }
  function pillowGeometry() {
    // A closed cotton cushion with a bowed top and a flat contact underside.
    // The full x/z envelope remains the same as the old box profile.
    const g = new THREE.BoxGeometry(1,1,1,6,2,4), p = g.attributes.position;
    for (let i=0;i<p.count;i++) {
      const x=p.getX(i), y=p.getY(i), z=p.getZ(i), taper=1-.09*(Math.abs(y)*2)**4;
      const crown=y>.49?.28*Math.cos(x*Math.PI)*Math.cos(z*Math.PI):0;
      p.setXYZ(i,x*taper,y+crown,z*taper);
    }
    g.computeVertexNormals();return g;
  }
  function curvedBeam(g, points, radius, mat) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    // All authored curved courses of one material merge into one static mesh.
    // This retains round roof edges without 25 extra draw calls per roof.
    let materials = curvedBatches.get(g); if (!materials) curvedBatches.set(g, materials = new Map());
    let data = materials.get(mat); if (!data) materials.set(mat, data = { positions: [], normals: [], uv: [], indices: [] });
    const tube = new THREE.TubeGeometry(curve, 24, radius, 8, false), offset = data.positions.length / 3;
    data.positions.push(...tube.attributes.position.array); data.normals.push(...tube.attributes.normal.array); data.uv.push(...tube.attributes.uv.array);
    data.indices.push(...Array.from(tube.index.array, n => n + offset)); tube.dispose();
  }
  function leafGeometry(rows = 6, cols = 4) {
    const p = [], uv = [], indices = [];
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
      const v = j / rows, u = i / cols * 2 - 1;
      const w = Math.sin(v * Math.PI) ** .74 * (1.15 - .31 * v);
      // A fuller lower shoulder, off-centre tip and curled margin keep the
      // leaf botanical at silhouette scale, rather than a folded diamond.
      p.push(u * .22 * w * (1 + u * .075) + Math.sin(v * Math.PI) * .018,
        v + Math.abs(u) * Math.sin(v * Math.PI) * .025,
        Math.sin(v * Math.PI) * (.10 - .075 * u * u) + v * v * .065 + Math.sin(v * 9 + u * 1.3) * .012 * u * u * w);
      uv.push(i / cols, v); const k = j * (cols + 1) + i;
      if (j < rows && i < cols) indices.push(k, k + 1, k + cols + 1, k + 1, k + cols + 2, k + cols + 1);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(indices); g.computeVertexNormals(); return g;
  }
  function crownLeafGeometry() {
    // Fine individual leaves use 24 triangles instead of a 96-triangle oval.
    // An asymmetric shoulder and a modest curved tip keep the larger canopy
    // botanical while avoiding broad flat green plates in the near view.
    const p=[],uv=[],ind=[],rows=6,cols=2;
    for(let j=0;j<=rows;j++) for(let i=0;i<=cols;i++){
      const v=j/rows,u=i/cols*2-1,shoulder=Math.sin(v*Math.PI)**.68*(1.08-.24*v);
      p.push(u*.34*shoulder*(1+u*.13)+Math.sin(v*Math.PI)*.032,
        v+Math.abs(u)*Math.sin(v*Math.PI)*.016,
        Math.sin(v*Math.PI)*(.045-.031*u*u)+v*v*.034);
      uv.push(i/cols,v);const k=j*(cols+1)+i;if(j<rows&&i<cols)ind.push(k,k+1,k+cols+1,k+1,k+cols+2,k+cols+1);
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(ind);geo.computeVertexNormals();return geo;
  }
  function cloverGeometry() {
    // A 12-triangle curved lens replaces a 352-triangle sphere for tiny ground leaves.
    const p = [0, .16, 0], uv = [.5, .5], indices = [];
    for (let i = 0; i < 12; i++) { const a = i * TAU / 12; p.push(Math.cos(a), 0, Math.sin(a)); uv.push(.5 + Math.cos(a) * .5, .5 + Math.sin(a) * .5); }
    for (let i = 0; i < 12; i++) indices.push(0, 1 + (i + 1) % 12, i + 1);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(indices); g.computeVertexNormals(); return g;
  }
  function pavingGeometry(cornerX = 0, cornerZ = 0) {
    const shape = new THREE.Shape(), w = .88, d = .68;
    const radius = (x, y) => cornerX === x && cornerZ === -y ? .58 : .025;
    const bl = radius(-1, -1), br = radius(1, -1), tr = radius(1, 1), tl = radius(-1, 1);
    shape.moveTo(-w / 2 + bl, -d / 2); shape.lineTo(w / 2 - br, -d / 2); shape.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + br);
    shape.lineTo(w / 2, d / 2 - tr); shape.quadraticCurveTo(w / 2, d / 2, w / 2 - tr, d / 2); shape.lineTo(-w / 2 + tl, d / 2);
    shape.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - tl); shape.lineTo(-w / 2, -d / 2 + bl); shape.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + bl, -d / 2);
    const g = new THREE.ExtrudeGeometry(shape, { depth: .038, bevelEnabled: true, bevelSize: .007, bevelThickness: .007, bevelSegments: 2, curveSegments: 3 });
    g.translate(0, 0, -.019); g.rotateX(-Math.PI / 2); return g;
  }
  function roofTileGeometry() {
    const p = [], uv = [], indices = [], rows = 3, cols = 8;
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
      const u = i / cols, v = j / rows;
      p.push((v - .5) * .43, Math.sin(u * Math.PI) * .045 + v * .012, (u - .5) * .188);
      uv.push(u, v); const k = j * (cols + 1) + i;
      if (j < rows && i < cols) indices.push(k, k + 1, k + cols + 1, k + 1, k + cols + 2, k + cols + 1);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(indices); g.computeVertexNormals(); return g;
  }
  function herb(g, p, scale = 1, count = 18, flowerColor) {
    for (let i = 0; i < count; i++) {
      const angle = i * 2.399 + rand(), radius = Math.sqrt(rand()) * .19 * scale, h = (.12 + rand() * .20) * scale;
      const x = p[0] + Math.sin(angle) * radius, z = p[2] + Math.cos(angle) * radius;
      batch(g, twig, stem, [x, p[1] + h * .5, z], [.006 * scale, h, .006 * scale]);
      for (let j = 0; j < 3; j++) batch(g, leaf, foliage, [x, p[1] + h * (.25 + j * .25), z], [.43 * scale, .20 * scale, .43 * scale], [.88 + rand() * .52, angle + j * 2.2, 0], new THREE.Color('#496345').lerp(new THREE.Color('#a3ae69'), rand()).getHex());
      if (flowerColor && i % 2 === 0) {
        batch(g, flowerBud, flowers, [x, p[1] + h + .007, z], [.019 * scale, .02 * scale, .019 * scale], undefined, '#d9b771');
        for (let j = 0; j < 5; j++) {
          const a = j / 5 * TAU; batch(g, canopyLeaf, flowers, [x + Math.sin(a) * .005, p[1] + h, z + Math.cos(a) * .005], [.12 * scale, .058 * scale, .12 * scale], [1.23, a, 0], flowerColor, false);
        }
      }
    }
  }
  function pot(g, p, scale = 1, bloom = '#caa8a0') {
    const geo = geometry(new THREE.LatheGeometry([[.14, 0], [.175, .02], [.235, .33], [.245, .36], [.244, .39], [.208, .39], [.205, .34], [.17, .07]].map(v => new THREE.Vector2(...v)), 24));
    part(g, geo, m.ceramic, p, [scale, scale, scale]);
    batch(g, cylinder, m.soil, [p[0], p[1] + .355 * scale, p[2]], [.207 * scale, .015, .207 * scale]);
    herb(g, [p[0], p[1] + .37 * scale, p[2]], scale * 1.05, 27, bloom);
  }
  function bench(g, p, width) {
    // The same .64 m ground footprint as the shared walking collision.
    for (let i = 0; i < 5; i++) timber(g, [p[0], p[1] + .48, p[2] - .22 + i * .105], [width, .075, .093]);
    for (let i = 0; i < 3; i++) timber(g, [p[0], p[1] + .68 + i * .115, p[2] - .29], [width, .086, .065], [-.09, 0, 0]);
    for (const x of [-width * .36, width * .36]) {
      timber(g, [p[0] + x, p[1] + .28, p[2]], [.068, .51, .50], undefined, metal);
      timber(g, [p[0] + x, p[1] + .64, p[2] - .27], [.055, .53, .055], [-.09, 0, 0], metal);
      for (const z of [-.18, .16]) batch(g, sphere, m.brass, [p[0] + x, p[1] + .522, p[2] + z], [.014, .005, .014]);
    }
  }
  function homeRoofHeight(x, z, width = 4.70) {
    const u = x / (width * .5), front = (z + 3.04) / 2.30;
    return 3.12 - .81 * Math.abs(u - .06) ** 1.26 + .19 * Math.abs(u) ** 6 + .105 * front ** 4 - .085 * Math.sin(front * Math.PI);
  }
  function cafeRoofHeight(x, z, width = 5.26) {
    const u=x/(width*.5),front=(z+3.04)/2.39;
    return 3.22-.72*Math.abs(u)**1.46+.22*Math.abs(u)**7+.13*front**5;
  }
  function workshopRoofHeight(x,z,width=4.88) {
    const u=x/(width*.5),front=(z+3.04)/2.45;
    return 3.48-.48*(u+1)*.5+.08*Math.sin(front*Math.PI)+.085*Math.abs(u)**6;
  }
  function roof(g, mat, id) {
    // Large, distinct silhouettes are visible from the default far camera.
    // Each roof is a thick closed surface; none adds a ground-level obstacle.
    const isCafe = id === 'cafe', isShop = id === 'workshop';
    const width = isCafe ? 5.26 : isShop ? 4.88 : 4.70;
    const near = isCafe ? -.65 : isShop ? -.59 : -.74, far = -3.04;
    const heightAt = (x, z) => {
      const u = x / (width * .5), front = (z - far) / (near - far);
      if (isCafe) return cafeRoofHeight(x,z,width);
      if (isShop) return workshopRoofHeight(x,z,width);
      return homeRoofHeight(x, z, width);
    };
    roofSurface(g, width, far, near, heightAt, mat);
    // Long visible tile courses, rather than hundreds of tiny curved tiles.
    for (let i = 0; i <= 18; i++) {
      const x = -width / 2 + i * width / 18;
      const points = Array.from({length: 8}, (_, j) => { const z = far + (near - far) * j / 7; return [x, heightAt(x, z) + .018, z]; });
      curvedBeam(g, points, .011, mat);
    }
    // Low overlapping ceramic courses interrupt the long ribs. Each shallow
    // band has an actual front step and closes back onto the curved shell.
    roofCourses(g, width, far, near, heightAt, mat);
    for (const z of [near + .025, far - .025]) {
      const points = Array.from({length: 25}, (_, i) => {const x = -width / 2 + i * width / 24; return [x, heightAt(x,z) - .06,z];});
      curvedBeam(g, points, .075, m.darkWood);
      curvedBeam(g, points.map(([x,y,z]) => [x,y-.076,z]), .023, m.wood);
    }
    // A true front infill closes the attic, so the roof never floats above it.
    const shape = new THREE.Shape(); shape.moveTo(-1.925,2.11); shape.lineTo(1.925,2.11);
    for (let i=24;i>=0;i--) {const x=-1.925+i*3.85/24;shape.lineTo(x,heightAt(x,-1.98)-.13);}
    shape.closePath(); part(g,geometry(new THREE.ShapeGeometry(shape,4)),id==='home'?homePlaster:id==='cafe'?cafePlaster:workshopPlaster,[0,0,-1.98]);
    curvedBeam(g,Array.from({length:21},(_,i)=>{const x=-1.92+i*3.84/20;return[x,heightAt(x,-1.92)-.13,-1.81];}),.042,m.wood);
    for (let i=0;i<13;i++) {
      const x=-1.85+i*3.70/12;
      if (id==='home'||isCafe||isShop) curvedBeam(g,Array.from({length:8},(_,j)=>{
        const z=far+(near-far)*j/7;return[x,heightAt(x,z)-.145,z];
      }),.017,m.wood);
      else beam(g,[x,heightAt(x,far)-.13,far],[x,heightAt(x,near)-.13,near],.034,m.wood);
    }
    // Home has a low attached reading-bay roof; the workshop is an asymmetric
    // shed. Neither repeats the communal tea pavilion's broad curved canopy.
    if (id === 'home') {
      const smallCentre = .72, smallWidth = 2.08;
      const smallHeight = (x,z) => 2.36-.24*Math.abs((x-smallCentre)/1.04)+.075*((z+1.78)/1.42)**2;
      // A shallow slate cover shelters the wall; the open timber pergola
      // extends over the reading seat without masking the enlarged window.
      roofSurface(g,smallWidth,-1.78,-1.54,(x,z)=>smallHeight(x+smallCentre,z),mat,smallCentre);
      curvedBeam(g,Array.from({length:15},(_,i)=>{const x=smallCentre-smallWidth/2+i*smallWidth/14;return[x,smallHeight(x,-.36)-.07,-.36];}),.053,m.darkWood);
      for (let i=0;i<9;i++) {
        const x=smallCentre-.90+i*.225;
        beam(g,[x,smallHeight(x,-1.57)-.045,-1.57],[x,smallHeight(x,-.36)-.045,-.36],.050,m.wood,eased);
      }
      for (const x of [-.18, 1.61]) beam(g,[x,1.97,-1.79],[x,smallHeight(x,-.54)-.08,-.54],.026,m.wood);
    }
    if (isShop) workshopRoofLantern(g,heightAt);
  }
  function workshopRoofLantern(g,heightAt) {
    // The daylight bay is entirely overhead. Its lowest closed ceiling is
    // 2.21 m above the existing legal walking surface, with no new collider.
    const left=-1.56,right=.40,front=-.70,back=-1.98,bottom=2.24;
    const outer=new THREE.Shape();outer.moveTo(left,bottom);outer.lineTo(right,bottom);
    for (let i=20;i>=0;i--) {const x=left+(right-left)*i/20;outer.lineTo(x,heightAt(x,front)-.13);}
    outer.closePath();outer.holes.push(roundedShape(-.58,2.55,1.62,.36,.028,true));
    part(g,geometry(new THREE.ExtrudeGeometry(outer,{depth:.055,bevelEnabled:false,curveSegments:10})),workshopPlaster,[0,0,front-.055]);
    for (const side of [-1,1]) {
      const x=side<0?left:right,profile=new THREE.Shape();profile.moveTo(-front,bottom);profile.lineTo(-back,bottom);
      for (let i=0;i<=8;i++) {const z=back+(front-back)*i/8;profile.lineTo(-z,heightAt(x,z)-.145);}
      profile.closePath();const geo=geometry(new THREE.ExtrudeGeometry(profile,{depth:.055,bevelEnabled:false,curveSegments:1}));geo.rotateY(Math.PI/2);
      part(g,geo,workshopPlaster,[side<0?left:right-.055,0,0]);
    }
    batch(g,eased,m.wood,[-.58,2.225,(front+back)/2],[right-left,.030,front-back]);
    const frame=new THREE.Shape(roundedShape(-.58,2.55,1.76,.50,.052).getPoints(24));frame.holes.push(roundedShape(-.58,2.55,1.62,.36,.028,true));
    part(g,geometry(new THREE.ExtrudeGeometry(frame,{depth:.078,bevelEnabled:true,bevelSize:.009,bevelThickness:.008,bevelSegments:1,curveSegments:8})),m.wood,[0,0,front-.08]);
    const pane=geometry(new THREE.ShapeGeometry(new THREE.Shape(roundedShape(-.58,2.55,1.61,.35,.027).getPoints(24)),4));
    part(g,pane,glassBacking,[0,0,front-.175]);part(g,pane,m.glass,[0,0,front-.065]);
    for (const x of [-.98,-.18]) timber(g,[x,2.55,front+.012],[.039,.36,.068],undefined,m.darkWood);
  }
  function roofCourses(g,width,far,near,heightAt,mat) {
    const p=[],uv=[],ind=[],cols=36,courses=7;
    for(let row=0;row<courses;row++){
      const front=far+(row+1)*(near-far)/courses,back=front-.14,offset=p.length/3;
      for(let i=0;i<=cols;i++){
        const x=-width/2+i*width/cols;
        for(const [z,lift] of [[back,.006],[front,.025],[front+.013,.007]]) {
          p.push(x,heightAt(x,z)+lift,z);uv.push(i/cols*2,row/courses);
        }
      }
      for(let i=0;i<cols;i++)for(let strip=0;strip<2;strip++){
        const k=offset+i*3+strip;ind.push(k,k+1,k+3,k+1,k+4,k+3);
      }
    }
    const geo=geometry(new THREE.BufferGeometry());geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(ind);geo.computeVertexNormals();part(g,geo,mat);
  }
  function roofSurface(g,width,far,near,heightAt,mat,offsetX=0) {
    const p=[],uv=[],ind=[],nx=24,nz=10,thickness=.10;
    for (let layer=0;layer<2;layer++) for (let ix=0;ix<=nx;ix++) for(let iz=0;iz<=nz;iz++) {
      const x=-width/2+ix*width/nx,z=far+iz*(near-far)/nz;
      p.push(x+offsetX,heightAt(x,z)-layer*thickness,z);uv.push(ix/nx*2,iz/nz);
    }
    const stride=nz+1,offset=(nx+1)*stride;
    for(let ix=0;ix<nx;ix++) for(let iz=0;iz<nz;iz++) {
      const k=ix*stride+iz;ind.push(k,k+1,k+stride,k+1,k+stride+1,k+stride);
      ind.push(k+offset,k+stride+offset,k+1+offset,k+1+offset,k+stride+offset,k+stride+1+offset);
    }
    const join=(a,b)=>ind.push(a,b,a+offset,b,b+offset,a+offset);
    for(let i=0;i<nx;i++){join(i*stride,(i+1)*stride);join((i+1)*stride+nz,i*stride+nz);}
    for(let i=0;i<nz;i++){join(i+1,i);join(nx*stride+i,nx*stride+i+1);}
    const geo=geometry(new THREE.BufferGeometry());geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(ind);geo.computeVertexNormals();part(g,geo,mat);
  }

  function facade(id) {
    const [x,z]=PLACES[id],g=root(`town-${id}`,[x,0,z]);g.userData.placeId=id;buildings.push(g);
    const floorGroup=new THREE.Group();floorGroup.name='town-'+id+'-floor';floorGroup.userData.townSurface='floor';g.add(floorGroup);
    const deck=part(floorGroup,cube,mortar,[0,-.036,-.85],[4.6,.20,4.2]);deck.userData.destination=id;hitTargets.push(deck);
    recordFloor([[x-2.275,z-2.871],[x+2.275,z-2.871],[x+2.275,z+1.227],[x-2.275,z+1.227]],.1295,'maru-'+id);
    // The flush visual maru surface keeps the established .12 m movement
    // height. A thick dark apron reaches the ground, never a floating platform.
    for(let iz=0;iz<15;iz++) {
      const tint=id==='cafe'?new THREE.Color('#ffffff').lerp(new THREE.Color('#dad5c7'),rand()*.16).getHex():new THREE.Color('#f0ede4').lerp(new THREE.Color('#d4d5ca'),rand()*.15).getHex();
      if(id==='cafe'){
        const joint=iz%2?.43:-.36,left=joint+2.275,right=2.275-joint;
        batch(floorGroup,eased,m.wood,[-2.275+left/2,.102,-2.74+iz*.274],[left-.005,.055,.262],undefined,tint,false);
        batch(floorGroup,eased,m.wood,[joint+right/2,.102,-2.74+iz*.274],[right-.005,.055,.262],undefined,tint,false);
      }else batch(floorGroup,eased,paving,[0,.102,-2.74+iz*.274],[4.55,.055,.262],undefined,tint,false);
    }
    for(const sx of [-2.25,2.25]) timber(floorGroup,[sx,.102,-.82],[.075,.055,4.12],undefined,m.darkWood);
    timber(floorGroup,[0,.006,1.20],[4.54,.24,.075],undefined,id==='cafe'?m.darkWood:stone);
    if(id==='greenhouse'){greenhouse(g);historyHanger(g,id);return g;}
    const plaster=id==='home'?homePlaster:id==='cafe'?cafePlaster:workshopPlaster;
    const wallShape=new THREE.Shape();wallShape.moveTo(-1.925,0);wallShape.lineTo(1.925,0);wallShape.lineTo(1.925,2.2);wallShape.lineTo(-1.925,2.2);wallShape.closePath();
    // Windows really recess through the plaster and reveal full-depth jambs.
    const openings=id==='home'?[{x:.65,y:1.27,w:2.04,h:1.36,round:.57}]:id==='cafe'?[{x:0,y:1.29,w:3.12,h:1.52,round:.16}]:[{x:.58,y:1.28,w:2.08,h:1.58,round:.07}];
    for(const o of openings)wallShape.holes.push(roundedShape(o.x,o.y,o.w,o.h,o.round,true));
    const wallGeo=geometry(new THREE.ExtrudeGeometry(wallShape,{depth:.25,bevelEnabled:false,curveSegments:16}));
    const wall=part(g,wallGeo,plaster,[0,0,-2.125]);wall.userData.destination=id;hitTargets.push(wall);
    for(const side of [-1,1]){
      stoneBlock(g,[side*1.8,.23,-1.65],[.28,.38,.9]);
      const pierTop=id==='home'?homeRoofHeight(side*1.8,-1.65)-.145:id==='cafe'?cafeRoofHeight(side*1.8,-1.65)-.145:workshopRoofHeight(side*1.8,-1.65)-.145;
      if (id==='cafe') {
        // Open tea-room framing occupies the original solid pier rectangle.
        for (const z of [-2.032,-1.265]) {
          const top=cafeRoofHeight(side*1.8,z)-.145;
          timber(g,[side*1.8,(top+.405)/2,z],[.18,top-.405,.115]);
        }
        timber(g,[side*1.8,.58,-1.65],[.18,.09,.87]);
        beam(g,[side*1.8,cafeRoofHeight(side*1.8,-2.09)-.18,-2.09],[side*1.8,cafeRoofHeight(side*1.8,-1.21)-.18,-1.21],.086,m.wood,eased);
        cafeSideScreen(g,side,pierTop-.065);
      } else timber(g,[side*1.8,(pierTop+.405)/2,-1.65],[.25,pierTop-.405,.87],undefined,id==='home'?homePlaster:m.darkWood);
      // A dark timber shoe sits directly on the stone shoulder; its bevel and
      // small reveal make the material junction visible in the close view.
      timber(g,[side*1.8,.431,-1.65],[.285,.039,.90],undefined,m.darkWood);
      const frontTop=id==='home'?homeRoofHeight(side*1.8,-1.198)-.145:id==='cafe'?cafeRoofHeight(side*1.8,-1.198)-.145:workshopRoofHeight(side*1.8,-1.198)-.145;
      timber(g,[side*1.8,(frontTop+.325)/2,-1.198],[.145,frontTop-.325,.085]);
      for(const y of [.50,frontTop-.12]) timber(g,[side*1.8,y,-1.20],[.277,.058,.094],undefined,m.brass);
    }
    timber(g,[0,.24,-1.824],[3.85,.25,.105],undefined,m.darkWood);
    for(const o of openings) framedOpening(g,o,id);
    roof(g,m.roofSlate,id);
    // Small domestic door and workshop sliding door stay on the original wall.
    if(id!=='cafe'){
      const doorX=id==='home'?-1.03:-1.18,doorW=id==='home'?.73:.64;
      timber(g,[doorX,.96,-1.819],[doorW+.17,1.84,.105],undefined,m.darkWood);
      timber(g,[doorX,.96,-1.746],[doorW,1.67,.065],undefined,id==='home'?m.wood:shutters);
      for(let i=0;i<5;i++) timber(g,[doorX-doorW*.38+i*doorW*.19,1.19,-1.701],[.024,.86,.031],undefined,m.darkWood);
      for(const y of [.47,.77,1.61]) timber(g,[doorX,y,-1.695],[doorW-.09,.043,.029],undefined,m.darkWood);
      batch(g,sphere,m.brass,[doorX+doorW*.30,.88,-1.674],[.036,.036,.03]);
    } else {
      // A full-width open-looking tea counter has one coherent glazed face,
      // broad posts and a continuous low sill rather than door/window clutter.
      timber(g,[0,.53,-1.69],[3.31,.14,.32]);
      for(const x of [-1.62,0,1.62]) timber(g,[x,1.29,-1.701],[.092,1.62,.145]);
    }
    // A warm ceramic lantern anchors each wall without adding new point lights.
    const lanternX=id==='cafe'?-1.47:-.23;
    timber(g,[lanternX,1.74,-1.71],[.11,.08,.25],undefined,metal);
    batch(g,sphere,butter,[lanternX,1.59,-1.56],[.078,.136,.078]);
    for(const y of [1.46,1.72]) timber(g,[lanternX,y,-1.56],[.17,.039,.17],undefined,metal);
    // Finished reverse-side cladding stays on the original thin rear wall.
    for(let i=0;i<16;i++) timber(g,[-1.65+i*.22,.47,-2.151],[.204,.52,.047]);
    timber(g,[0,.76,-2.17],[3.78,.084,.084],undefined,m.darkWood);
    shopIdentity(g,id);facadeCraft(g,id);historyHanger(g,id);
    if(id==='home'){
      bench(g,[.82,.12,-.70],1.25);homeReadingNook(g);windowBox(g,.65,.44,'#e4bac4',1.80);
    }else if(id==='cafe'){
      awning(g);teaRoomShelves(g);
      const topProfile=[[0,-.045],[.52,-.045],[.558,-.033],[.567,-.012],[.565,.018],[.551,.040],[.522,.046],[0,.046]];
      const teaTableTop=part(g,geometry(new THREE.LatheGeometry(topProfile.map(v=>new THREE.Vector2(...v)),32)),m.ceramic,[1.05,.68,-.3]);teaTableTop.userData.townSupportSurface=true;
      part(g,geometry(new THREE.CylinderGeometry(.115,.21,.55,12)),metal,[1.05,.37,-.3]);
      for(const a of [0,TAU/3,TAU*2/3]) timber(g,[1.05+Math.sin(a)*.16,.15,-.3+Math.cos(a)*.16],[.055,.08,.42],[0,a,0],metal);
      teaSet(g,[1.14,.732,-.33]);tableTeapot(g,[.85,.740,-.34]);
    }else{workbench(g);workshopMaterials(g);windowBox(g,.58,.39,'#b8a8c9',1.80);}
    return g;
  }
  let teaScreenGeometry;
  function cafeSideScreen(g,side,top) {
    if (!teaScreenGeometry) {
      teaScreenGeometry=geometry(new THREE.PlaneGeometry(.68,1,6,10));
      const p=teaScreenGeometry.attributes.position;
      for (let i=0;i<p.count;i++) p.setZ(i,Math.sin(p.getX(i)*Math.PI*9)*.023+Math.cos(p.getY(i)*Math.PI)*.009);
      teaScreenGeometry.computeVertexNormals();
    }
    const bottom=.65,height=top-bottom;
    batch(g,teaScreenGeometry,cloth,[side*1.8,(top+bottom)/2,-1.65],[1,height,1],[0,side*Math.PI/2,0]);
  }
  function teaRoomShelves(g) {
    // Storage is a real recessed layer inside the original .25 m wall.
    for (const y of [.88,1.43]) batch(g,eased,m.wood,[0,y,-2.060],[1.68,.053,.110],undefined,undefined,false);
    for (const x of [-.81,.81]) batch(g,eased,m.wood,[x,1.15,-2.077],[.055,.64,.065],undefined,undefined,false);
    const cup=geometry(new THREE.LatheGeometry([[0,0],[.036,0],[.05,.008],[.060,.077],[.053,.081],[.046,.016],[0,.016]].map(v=>new THREE.Vector2(...v)),12));
    for (const x of [-.46,.46]) batch(g,cup,m.ceramic,[x,.907,-2.061],[1,1,.70],undefined,undefined,false);
  }
  function tableTeapot(g,p) {
    // A decorative vessel on the existing table, never an acquired item or a
    // completed tea event. The tray top and closed body bottom meet exactly.
    batch(g,cylinder,m.ceramic,[p[0],p[1]-.007,p[2]],[.149,.014,.149]);
    const profile=[[0,0],[.075,0],[.110,.035],[.119,.105],[.105,.170],[.073,.183],[.074,.170],[.106,.103],[.085,.040],[0,.036]];
    part(g,geometry(new THREE.LatheGeometry(profile.map(v=>new THREE.Vector2(...v)),20)),m.ceramic,p);
    batch(g,sphere,m.ceramic,[p[0],p[1]+.190,p[2]],[.078,.018,.078]);
    batch(g,sphere,m.ceramic,[p[0],p[1]+.228,p[2]],[.019,.019,.019]);
    curvedBeam(g,[[p[0]-.073,p[1]+.100,p[2]],[p[0]-.163,p[1]+.146,p[2]],[p[0]-.214,p[1]+.205,p[2]]],.022,m.ceramic);
    curvedBeam(g,[[p[0]+.088,p[1]+.136,p[2]],[p[0]+.150,p[1]+.110,p[2]],[p[0]+.158,p[1]+.055,p[2]],[p[0]+.082,p[1]+.047,p[2]]],.012,m.ceramic);
  }
  function homeReadingNook(g) {
    // The canopy is overhead. Closed books stay inside the original wall;
    // the soft seat stays inside the existing bench's ground footprint.
    batch(g,pillow,cloth,[.82,.674,-.70],[1.09,.075,.40],undefined,undefined,false);
    for (const x of [.31,1.33]) batch(g,pillow,cloth,[x,.75,-.82],[.12,.075,.29],undefined,undefined,false);
    timber(g,[.68,.92,-2.055],[1.48,.055,.065],undefined,m.wood);
    const covers=[coral,guideCloth,cloth,m.darkWood];
    for (let i=0;i<4;i++) {
      const x=.22+i*.22,y=1.07,r=[0,0,(i-1.5)*.025];
      batch(g,eased,m.paper,[x,y,-2.064],[.152,.22,.037],r,undefined,false);
      const coverColor=covers[i].color.getHex();
      for (const z of [-2.089,-2.039]) batch(g,eased,cloth,[x,y,z],[.175,.24,.008],r,coverColor,false);
      batch(g,eased,cloth,[x-.082,y,-2.064],[.012,.24,.053],r,coverColor,false);
    }
    timber(g,[1.32,1.19,-2.045],[.11,.49,.06],undefined,m.wood);
    timber(g,[1.07,1.41,-2.045],[.58,.047,.07],undefined,m.wood);
  }
  function roundedShape(x,y,w,h,r,clockwise=false) {
    const shape=new THREE.Path(),left=x-w/2,right=x+w/2,bottom=y-h/2,top=y+h/2;
    shape.moveTo(left+r,bottom);shape.lineTo(right-r,bottom);shape.quadraticCurveTo(right,bottom,right,bottom+r);
    shape.lineTo(right,top-r);shape.quadraticCurveTo(right,top,right-r,top);shape.lineTo(left+r,top);
    shape.quadraticCurveTo(left,top,left,top-r);shape.lineTo(left,bottom+r);shape.quadraticCurveTo(left,bottom,left+r,bottom);shape.closePath();
    if(clockwise){const points=shape.getPoints(24).reverse();const reversed=new THREE.Path();reversed.setFromPoints(points);reversed.closePath();return reversed;}
    return shape;
  }
  function framedOpening(g,o,id) {
    const outer=roundedShape(o.x,o.y,o.w+.19,o.h+.19,o.round+.08);
    const frame=new THREE.Shape(outer.getPoints(28));frame.holes.push(roundedShape(o.x,o.y,o.w-.035,o.h-.035,Math.max(.025,o.round-.035),true));
    const geo=geometry(new THREE.ExtrudeGeometry(frame,{depth:.16,bevelEnabled:true,bevelSegments:2,bevelSize:.018,bevelThickness:.014,curveSegments:12}));
    part(g,geo,m.wood,[0,0,-1.898]);
    const pane=geometry(new THREE.ShapeGeometry(new THREE.Shape(roundedShape(o.x,o.y,o.w-.025,o.h-.025,o.round).getPoints(28)),8));
    part(g,pane,glassBacking,[0,0,-2.120]);
    // The shaded warm back wall, sill and folded curtains occupy only the
    // original .25 m wall thickness. They do not invent a room or obstacle.
    batch(g,cube,interiorPlaster,[o.x,o.y+.035,-2.114],[o.w*.82,o.h*.82,.006],undefined,undefined,false);
    timber(g,[o.x,o.y-o.h*.37,-2.076],[o.w*.82,.053,.071],undefined,m.darkWood);
    if(id!=='workshop'){
      for(const side of [-1,1]){
        const curtain=geometry(new THREE.PlaneGeometry(o.w*.105,o.h*.84,8,5)),cp=curtain.attributes.position;
        for(let i=0;i<cp.count;i++){
          const xx=cp.getX(i),yy=cp.getY(i);
          cp.setXYZ(i,xx*(1+.14*Math.cos(yy*4)),yy,Math.sin(xx*58)*.021);
        }
        curtain.computeVertexNormals();part(g,curtain,cloth,[o.x+side*o.w*.35,o.y,-2.054],undefined,undefined,false);
      }
    }else for(const u of [-.25,.18]) timber(g,[o.x+u*o.w,o.y-o.h*.20,-2.058],[o.w*.20,.038,.052],undefined,m.wood);
    part(g,pane,m.glass,[0,0,-1.976]);
    const mullions=id==='home'?[-.18,.18]:id==='cafe'?[-.38,0,.38]:[-.34,0,.34];
    for(const u of mullions) timber(g,[o.x+u*o.w,o.y,-1.789],[id==='cafe'?.047:.039,o.h-.07,.082],undefined,m.darkWood);
    timber(g,[o.x,o.y-.05,-1.778],[o.w-.09,.042,.088],undefined,m.darkWood);
    timber(g,[o.x,o.y-o.h/2-.092,-1.731],[o.w+.30,.12,.31]);
  }

  function shopIdentity(g, id) {
    // In-world hand-painted wooden plaques are geometry, not floating UI.
    const plaque = geometry(new THREE.CylinderGeometry(.165, .165, .043, 32));
    batch(g, plaque, m.wood, [1.38, 1.92, -1.633], [1, 1, 1], [Math.PI / 2, 0, 0]);
    part(g, geometry(new THREE.TorusGeometry(.145, .008, 6, 32)), m.brass, [1.38, 1.92, -1.603]);
    if (id === 'cafe') {
      batch(g, eased, m.paper, [1.376, 1.91, -1.59], [.105, .081, .013]);
      part(g, geometry(new THREE.TorusGeometry(.027, .007, 6, 16)), m.paper, [1.44, 1.913, -1.59]);
      timber(g, [1.38, 1.858, -1.59], [.14, .009, .012], undefined, m.paper);
    } else if (id === 'workshop') {
      timber(g, [1.38, 1.907, -1.59], [.014, .126, .018], [0, 0, -.35], m.paper);
      timber(g, [1.36, 1.956, -1.59], [.091, .035, .023], [0, 0, -.35], m.paper);
    } else {
      for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; batch(g, sphere, m.paper, [1.38 + Math.sin(a) * .034, 1.92 + Math.cos(a) * .034, -1.593], [.024, .024, .008]); }
      batch(g, sphere, m.brass, [1.38, 1.92, -1.58], [.020, .020, .009]);
    }
  }
  function blossom(g,p,size,color,heading=0,petals=5,cast=false) {
    // A cupped, rounded petal profile stays legible at the walking camera.
    // Reusing the 12-triangle clover lens keeps flower drifts inexpensive.
    for (let j = 0; j < petals; j++) {
      const a = j / petals * TAU + heading;
      batch(g, cloverLeaf, flowers,
        [p[0] + Math.sin(a) * size * .37, p[1] + size * .07, p[2] + Math.cos(a) * size * .37],
        [size * .35, size * .24, size * .49], [.12,a,(j%2?1:-1)*.09],color,cast);
    }
    batch(g, flowerBud, flowers, [p[0], p[1] + size * .10, p[2]], [size*.16,size*.11,size*.16],undefined,'#dbbc79',cast);
  }
  function flowerDrift(x, z, radius, color, seed, kind = 'cosmos') {
    const rng=random(seed),y=terrainHeight(x,z),count=radius>.85?(kind==='hydrangea'?28:24):kind==='hydrangea'?18:11;
    for (let i = 0; i < count; i++) {
      const a = i * 2.399 + rng(), r = Math.sqrt(rng()) * radius;
      const px=x+Math.sin(a)*r,pz=z+Math.cos(a)*r;
      if(!clearOfWalkingSurface(px,pz,.42))continue;
      const h = kind === 'hydrangea' ? .42 + Math.sqrt(Math.max(0,1-(r/radius)**2)) * .29 : .28 + rng() * .32;
      batch(ground, twig, stem, [px, y + h * .5, pz], [.009, h, .009], [0, a, 0], undefined, true);
      for (let k = 0; k < 3; k++) {
        const angle = a + k * 2.1;
        batch(ground, canopyLeaf, foliage, [px, y + .10 + k * .055, pz], [.70,.33,.70],[1.02+k*.09,angle,.10],k%2?'#66876c':'#779776',true);
      }
      const petalColor = new THREE.Color(color).lerp(new THREE.Color('#f5ecda'), rng() * .24).getHex();
      blossom(ground, [px, y + h, pz], kind==='hydrangea'?.19+rng()*.045:.18+rng()*.055,petalColor,a,kind==='hydrangea'?5:7,true);
    }
  }
  function facadeCraft(g,id) {
    if(id==='home'){
      // A small pale flue and one coral enamel mailbox identify the home.
      stoneBlock(g,[1.18,2.66,-2.55],[.27,.74,.31],'#d4d9ce');stoneBlock(g,[1.18,3.05,-2.55],[.38,.08,.41]);
      batch(g,eased,coral,[-1.80,.92,-1.12],[.26,.31,.16]);batch(g,eased,m.ceramic,[-1.80,1.09,-1.12],[.28,.055,.18]);
      batch(g,cube,m.darkWood,[-1.80,.99,-1.031],[.15,.014,.008]);batch(g,sphere,m.brass,[-1.80,.84,-1.027],[.012,.012,.01]);
    }else if(id==='cafe'){
      // A generous continuous timber ledge and vessels, rather than many
      // unrelated small signs, make the facade read as a shared tea space.
      timber(g,[.14,.54,-1.57],[3.18,.13,.36]);
      for(const x of [-1.10,-.83]) batch(g,sphere,m.ceramic,[x,.72,-1.52],[.115,.13,.09]);
      for(const x of [-1.67,1.62]){
        beam(g,[x,2.19,-1.47],[x,1.78,-1.47],.005,metal,twig);
        batch(g,sphere,m.ceramic,[x,1.66,-1.47],[.145,.12,.13]);herb(g,[x,1.76,-1.47],.53,7);
      }
    }else{
      // Large asymmetrical work-room glazing and a single timber tool rack.
      timber(g,[-1.26,1.97,-1.70],[.77,.068,.13],undefined,m.darkWood);
      for(let i=0;i<4;i++){
        const x=-1.52+i*.18;timber(g,[x,1.76,-1.659],[.053,.32,.046],undefined,i%2?metal:m.wood);
        timber(g,[x,1.84,-1.659],[.135,.067,.051],undefined,metal);
      }
      for(let i=0;i<13;i++) timber(g,[-1.56+i*.27,.27,-1.811],[.251,.30,.045],undefined,i%4?m.wood:m.darkWood);
    }
  }

  function windowBox(g, x, y, bloom, width = 1.16) {
    timber(g, [x, y, -1.65], [width, .19, .26]);
    batch(g, cube, m.soil, [x, y + .102, -1.65], [width - .12, .014, .205]);
    for (let i = 0; i < 5; i++) herb(g, [x - width * .37 + i * width * .185, y + .11, -1.64], .50, 7, bloom);
  }
  function awning(g) {
    // Broad suspended cotton with an unmistakable pair of soft Mongle waves.
    // It spans the maru at head-safe height and stays supported by old piers.
    const p=[],uv=[],ind=[],cols=40,rows=12,width=3.12,centre=0;
    const nearZ=-1.04,farZ=-1.80,frontY=2.59;
    for(let j=0;j<=rows;j++) for(let i=0;i<=cols;i++){
      const u=i/cols,v=j/rows;
      const transverseArch=Math.sin(u*Math.PI);
      p.push((u-.5)*width+centre,2.64-v*.05+transverseArch*(.14-v*.06)-Math.sin(v*Math.PI)*.055,farZ+v*(nearZ-farZ));
      uv.push(u,v);const n=j*(cols+1)+i;if(i<cols&&j<rows)ind.push(n,n+cols+1,n+1,n+1,n+cols+1,n+cols+2);
    }
    const geo=geometry(new THREE.BufferGeometry());geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(ind);geo.computeVertexNormals();part(g,geo,cloth);
    const hemP=[],hemUv=[],hemI=[],steps=64;
    for(let i=0;i<=steps;i++){
      const u=i/steps,x=(u-.5)*width,top=frontY+Math.sin(u*Math.PI)*.08,bottom=2.555+Math.cos(u*TAU*2)*.025;
      hemP.push(x,top,nearZ,x,bottom,nearZ+.027);hemUv.push(u,1,u,0);
      if(i<steps){const k=i*2;hemI.push(k,k+1,k+2,k+1,k+3,k+2);}
    }
    const hem=geometry(new THREE.BufferGeometry());hem.setAttribute('position',new THREE.Float32BufferAttribute(hemP,3));hem.setAttribute('uv',new THREE.Float32BufferAttribute(hemUv,2));hem.setIndex(hemI);hem.computeVertexNormals();part(g,hem,cloth);
    for(const side of [-1,1]) {
      const x=side*width/2;
      beam(g,[side*1.80,2.02,-1.65],[x,2.64,farZ],.024,m.darkWood);
      beam(g,[x,2.64,farZ],[x,frontY,nearZ],.018,m.darkWood);
    }
    curvedBeam(g,Array.from({length:31},(_,i)=>{const u=i/30;return[(u-.5)*width,frontY+Math.sin(u*Math.PI)*.08-.012,nearZ-.009];}),.019,m.darkWood);
    curvedBeam(g,Array.from({length:41},(_,i)=>{const u=i/40;return[(u-.5)*width,2.555+Math.cos(u*TAU*2)*.025,nearZ+.031];}),.007,guideCloth);
    textileGuide(g,[-1.80,1.25,-1.17]);
  }

  function stitchedEmbroidery(g, paths, mat = m.paper) {
    const positions = [], uv = [], indices = [];
    for (const points of paths) {
      const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), length = curve.getLength(), steps = Math.max(1, Math.ceil(length / .043));
      for (let i = 0; i < steps; i++) {
        const from = i / steps, to = (i + .72) / steps;
        const stitch = new THREE.CatmullRomCurve3([curve.getPoint(from), curve.getPoint((from + to) / 2).add(new THREE.Vector3(0, 0, .002)), curve.getPoint(to)]);
        const tube = new THREE.TubeGeometry(stitch, 3, .0045, 5, false), offset = positions.length / 3;
        positions.push(...tube.attributes.position.array); uv.push(...tube.attributes.uv.array); indices.push(...Array.from(tube.index.array, n => n + offset)); tube.dispose();
      }
    }
    const geo = geometry(new THREE.BufferGeometry()); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(indices); geo.computeVertexNormals(); return part(g, geo, mat, undefined, undefined, undefined, false);
  }
  function textileGuide(g, [x, y, z]) {
    const geo = geometry(new THREE.PlaneGeometry(.42, .74, 4, 8)), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin((p.getY(i) + .37) * 6.3) * .013);
    geo.computeVertexNormals(); part(g, geo, guideCloth, [x, y, z]);
    timber(g, [x, y + .38, z], [.48, .030, .035]); timber(g, [x, y - .37, z], [.42, .024, .030]);
    stitchedEmbroidery(g, [[[x - .11, y + .055, z + .018], [x + .11, y + .055, z + .018]], [[x + .04, y + .125, z + .018], [x + .11, y + .055, z + .018], [x + .04, y - .015, z + .018]], [[x - .14, y - .25, z + .018], [x + .14, y - .25, z + .018]]]);
  }
  function historyHanger(g, id) {
    const anchors = { home: [-1.72, .94, -.4], cafe: [1.73, 1.02, -.52], workshop: [1.62, 1.04, -.48], greenhouse: [1.66, 1.10, -.52] };
    const [x, y, z] = anchors[id], top = y + .225, mountY = top + .16;
    // These empty supports are architecture. The scene may hang a real,
    // completed-history textile here; this module invents no memory or reward.
    if (id === 'greenhouse') beam(g, [1.88, mountY, z], [x, mountY, z], .012, m.darkWood, twig, false);
    else beam(g, [x, mountY, -1.26], [x, mountY, z], .013, m.darkWood, twig, false);
    timber(g, [x, mountY, z], [.38, .027, .032]);
    for (const side of [-1, 1]) beam(g, [x + side * .13, mountY, z], [x + side * .13, top + .012, z], .004, cloth, twig, false);
  }
  function teaSet(g, p) {
    batch(g, cylinder, m.ceramic, p, [.19, .018, .19]);
    const profile=[[.075,0],[.082,.010],[.095,.137],[.096,.145],[.084,.145],[.083,.135],[.072,.020]];
    part(g, geometry(new THREE.LatheGeometry(profile.map(v=>new THREE.Vector2(...v)),20)), m.ceramic, [p[0], p[1] + .008, p[2]]);
    batch(g, cylinder, m.tea, [p[0], p[1] + .141, p[2]], [.086, .006, .086]);
    part(g, geometry(new THREE.TorusGeometry(.055, .016, 6, 16)), m.ceramic, [p[0] + .093, p[1] + .087, p[2]]);
    timber(g, [p[0] - .24, p[1] + .018, p[2]], [.13, .018, .19], [0, -.2, 0], m.paper);
  }
  function workbench(g) {
    timber(g, [.2, .615, -.65], [2.08, .065, .79], undefined, m.darkWood);
    for (let i = 0; i < 5; i++) timber(g, [.2, .685, -.972 + i * .16], [2.08, .082, .149]);
    for (const x of [-.64, 1.04]) for (const z of [-.94, -.37]) timber(g, [x, .35, z], [.095, .59, .095]);
    timber(g, [.2, .24, -.65], [1.87, .06, .53]);
    for (const x of [-.64, 1.04]) timber(g, [x, .29, -.65], [.07, .08, .59], undefined, m.darkWood);
    for (let i = 0; i < 3; i++) timber(g, [.52, .758 + i * .037, -.88], [.87, .031, .14], [0, i * .055, 0]);
    timber(g, [-.51, .763, -.60], [.25, .032, .065], [0, -.45, 0], metal);
    timber(g, [-.48, .765, -.50], [.047, .037, .26], [0, -.45, 0]);
    for (let i = 0; i < 3; i++) timber(g, [-.60 + i * .37, .296, -.63], [.27, .04, .34], [0, .05, 0]);
  }
  function workshopMaterials(g) {
    // Fabric, timber and a small vice occupy only the original worktable core.
    batch(g,cylinder,cloth,[-.15,.789,-.60],[.063,.64,.063],[0,0,Math.PI/2]);
    batch(g,cylinder,m.wood,[-.55,.801,-.77],[.070,.15,.070]);
    for (const y of [.744,.864]) batch(g,cylinder,m.wood,[-.55,y,-.77],[.085,.023,.085]);
    batch(g,eased,metal,[1.00,.76,-.42],[.36,.065,.22]);
    for (const x of [.88,1.10]) batch(g,eased,metal,[x,.846,-.42],[.08,.115,.20]);
    timber(g,[.99,.8275,-.42],[.14,.065,.25]);
    timber(g,[1.18,.80,-.42],[.12,.025,.025],undefined,metal);
    timber(g,[1.23,.80,-.42],[.018,.10,.018],undefined,metal);
  }
  function greenhouse(g) {
    const frame=m.frame||metal,eave=2.60,ridge=3.06,postCentre=(eave+.08)/2,postHeight=eave-.08;
    // Panes and sills share the exact original three walls, leaving the front
    // open and both planting beds in their authoritative movement footprints.
    for (let i = 0; i < 6; i++) {
      batch(g,cube,greenhouseGlass,[-1.60+i*.64,1.40,-1.90],[.606,2.34,.025]);
      timber(g,[-1.91+i*.64,postCentre,-1.90],[.035,postHeight,.055],undefined,frame);
    }
    timber(g,[1.91,postCentre,-1.90],[.035,postHeight,.055],undefined,frame);
    for (const x of [-1.9, 1.9]) {
      for (let i = 0; i < 4; i++) {
        batch(g,cube,greenhouseGlass,[x,1.40,-1.675+i*.65],[.025,2.34,.61]);
        timber(g,[x,postCentre,-2+i*.65],[.055,postHeight,.035],undefined,frame);
      }
      timber(g,[x,postCentre,.6],[.055,postHeight,.055],undefined,frame);
      for (const y of [.20,1.40,eave]) timber(g,[x,y,-.7],[.06,.045,2.64],undefined,frame);
      timber(g,[x,.18,-.7],[.065,.13,2.64]);
    }
    for (const y of [.20,1.40,eave]) timber(g,[0,y,-1.90],[3.86,.055,.055],undefined,frame);
    timber(g,[0,.18,-1.90],[3.86,.13,.065]);
    timber(g,[0,eave,.60],[3.86,.075,.070],undefined,frame);
    const roofSpan=Math.hypot(1.90,ridge-eave),roofAngle=Math.atan2(ridge-eave,1.90);
    for (const sign of [-1, 1]) {
      const p=new THREE.Group();p.position.set(sign*.95,(eave+ridge)/2,-.7);p.rotation.z=-sign*roofAngle;g.add(p);
      batch(p,cube,greenhouseGlass,[0,0,0],[roofSpan,.024,2.67]);
      for (let i=0;i<5;i++) timber(p,[0,.02,-1.3+i*.65],[roofSpan+.04,.043,.038],undefined,frame);
      for (const x of [-roofSpan/2,0,roofSpan/2]) timber(p,[x,.02,0],[.039,.043,2.70],undefined,frame);
    }
    timber(g,[0,ridge+.018,-.7],[.075,.09,2.77],undefined,frame);
    for (const x of [-1.25, 1.15]) {
      timber(g, [x, .245, -.67], [.88, .35, 1.85]);
      batch(g, cube, m.soil, [x, .424, -.67], [.77, .024, 1.74]);
      for (const side of [-1, 1]) timber(g, [x + side * .397, .437, -.67], [.086, .065, 1.9]);
      for (let i=0;i<3;i++) {
        greenhouseCrop(g,x,-1.27+i*.60,x>0,510+i+(x>0?20:0));
        timber(g,[x+.27,.57,-1.27+i*.60],[.035,.26,.023],[.10,0,0],m.paper);
      }
      if (x>0) {
        for (const z of [-1.46,.16]) timber(g,[x+.30,1.08,z],[.045,1.36,.045]);
        for (const y of [.83,1.29,1.71]) timber(g,[x+.30,y,-.65],[.040,.038,1.68]);
      }
      for (const z of [-1.62, .28]) timber(g, [x, .437, z], [.9, .065, .08]);
    }
    // Small vents and rain gutter complete the transparent construction.
    for (const x of [-1.97,1.97]) timber(g,[x,eave-.04,-.7],[.095,.07,2.79],undefined,metal);
    // The deck is the classic-mode destination target; no invisible duplicate
    // glass surface participates in the player-visibility raycast.
  }
  function greenhouseCrop(g,x,z,climbing,seed) {
    const rng=random(seed),base=.429,height=climbing?1.22:.74,lean=climbing?.19:.015;
    beam(g,[x,base,z],[x+lean,base+height,z],climbing?.011:.014,stem,twig);
    for (let row=0;row<5;row++) for (const side of [-1,1]) {
      const t=.16+row*.16,y=base+height*t,angle=side*(.76+(row%2)*.33)+(row%2?.36:-.18);
      const direction=new THREE.Vector3(Math.sin(angle),climbing?.38:.47,Math.cos(angle)*.58).normalize();
      const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction),r=new THREE.Euler().setFromQuaternion(q);
      const length=.25+rng()*.035,color=new THREE.Color(climbing?'#497147':'#5f8351').lerp(new THREE.Color('#91a86c'),rng()*.48).getHex();
      batch(g,leaf,foliage,[x+lean*t,y,z],[.58,length,.58],[r.x,r.y,r.z],color);
    }
  }

  // The land extends well beyond the walking boundary, avoiding a display slab.
  const terrainHeight = (x, z) => {
    const outside = Math.max(Math.abs(x)-TOWN_LAYOUT.ground.flatBounds.maxX,z-TOWN_LAYOUT.ground.flatBounds.maxZ,TOWN_LAYOUT.ground.flatBounds.minZ-z, 0);
    const berm = Math.exp(-(((Math.abs(x) - 12.8) / 2.7) ** 2)) * Math.exp(-(((z + 2) / 10) ** 2)) * .46;
    return -.125 - Math.min(.48, outside * .065) + Math.min(1, outside / 4) * (Math.sin(x * .18 + z * .07) * .22 + Math.cos(z * .17) * .14 + berm);
  };
  const landscapeLayers = (x, z) => {
    const field = (cx, cz, rx, rz) => Math.exp(-(((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2));
    const meadow = Math.max(field(-17, 1, 9.3, 8.5), field(17, -4, 8.5, 7), field(-5, 10, 10, 4), field(7, -18, 10, 5));
    const grove = Math.max(field(-10.5, -6.5, 3.8, 6), field(10.6, -8, 4.5, 5), field(-3, -13, 5.5, 3));
    return { meadow, grove };
  };
  function terrainColor(x, z) {
    const outside = Math.max(Math.abs(x)-TOWN_LAYOUT.ground.flatBounds.maxX,z-TOWN_LAYOUT.ground.flatBounds.maxZ,TOWN_LAYOUT.ground.flatBounds.minZ-z, 0);
    const patch = .50 + .18 * Math.sin(x * .33 + Math.sin(z * .31) * 1.8) + .15 * Math.cos(z * .54 - Math.sin(x * .22)) + .11 * Math.sin(x * 1.12 + z * .57);
    const layers = landscapeLayers(x, z);
    return new THREE.Color('#72956e').lerp(new THREE.Color('#a4b981'), patch * .62)
      .lerp(new THREE.Color('#bdc38c'), layers.meadow * .62)
      .lerp(new THREE.Color('#5f887c'), layers.grove * .41)
      .lerp(new THREE.Color('#779a8b'), Math.min(.24, outside / 110));
  }
  const terrain = geometry(new THREE.PlaneGeometry(100, 90, 50, 45)); terrain.rotateX(-Math.PI / 2);
  const tp = terrain.attributes.position, terrainUv=terrain.attributes.uv, tc = [];
  for (let i = 0; i < tp.count; i++) {
    // Concentrate the reduced grid around the walking view: about 1.1 m
    // spacing here, wider samples only in the smooth distant ground. Texture
    // coordinates continue to use metres, so the surface scale never stretches.
    const sourceX=tp.getX(i),sourceZ=tp.getZ(i)-7,ax=Math.abs(sourceX);
    let x=Math.sign(sourceX)*(ax<=20?ax*.60:12+(ax-20)*38/30);
    const flatX=TOWN_LAYOUT.ground.flatBounds.maxX;if(Math.abs(x)>flatX&&Math.abs(x)<flatX+2.6)x=Math.sign(x)*flatX;
    let z=sourceZ < -20 ? -12+(sourceZ+20)*40/32 : sourceZ > 16 ? 8+(sourceZ-16)*30/22 : -12+(sourceZ+20)*20/36;
    const flatZ=TOWN_LAYOUT.ground.flatBounds;if(z<flatZ.minZ&&z>flatZ.minZ-2.6)z=flatZ.minZ;if(z>flatZ.maxZ&&z<flatZ.maxZ+3)z=flatZ.maxZ;
    const y = terrainHeight(x, z);
    tp.setXYZ(i, x, y, z);terrainUv.setXY(i,x/100+.5,.5-(z+7)/90); const c = terrainColor(x, z); tc.push(c.r, c.g, c.b);
  }
  terrain.setAttribute('color', new THREE.Float32BufferAttribute(tc, 3)); terrain.computeVertexNormals(); part(ground, terrain, terrainMaterial, undefined, undefined, undefined, false);
  // Far overview sees continuous land below the detailed walking terrain.
  // This is a visual underlay, not an extension of the authoritative bounds.
  const underlay=geometry(new THREE.PlaneGeometry(200,200,1,1));underlay.rotateX(-Math.PI/2);
  const up=underlay.attributes.position,uu=underlay.attributes.uv,uc=[],underlayColour=new THREE.Color('#93a174');
  for(let i=0;i<up.count;i++){uu.setXY(i,up.getX(i)/100+.5,.5-(up.getZ(i)+7)/90);uc.push(underlayColour.r,underlayColour.g,underlayColour.b);}
  underlay.setAttribute('color',new THREE.Float32BufferAttribute(uc,3));
  part(ground,underlay,terrainMaterial,[0,-1.2,0],undefined,undefined,false);
  // One broad, curved limestone court replaces the rectangular tile grid.
  // These are flush material boundaries; all walking heights remain unchanged.
  const court = new THREE.Shape();
  court.moveTo(-9.45,1.12);court.bezierCurveTo(-9.40,.42,-7.28,.39,-6.22,.48);
  court.bezierCurveTo(-4.06,.62,-2.80,.73,-.42,.60);court.bezierCurveTo(2.21,.44,4.37,.55,6.13,.50);
  court.bezierCurveTo(8.61,.31,9.40,.72,9.48,1.37);court.lineTo(9.40,4.10);
  court.bezierCurveTo(9.21,4.86,7.30,5.01,5.74,4.94);court.bezierCurveTo(3.32,4.81,2.33,5.13,.12,5.18);
  court.bezierCurveTo(-2.51,5.23,-3.89,4.83,-6.16,4.92);court.bezierCurveTo(-8.82,5.09,-9.42,4.83,-9.48,4.10);court.closePath();
  const courtGeo=geometry(new THREE.ShapeGeometry(court,24));courtGeo.rotateX(Math.PI/2);
  const ci=courtGeo.index;
  for(let i=0;i<ci.count;i+=3){const a=ci.getX(i+1);ci.setX(i+1,ci.getX(i+2));ci.setX(i+2,a);}
  courtGeo.computeVertexNormals();part(ground,courtGeo,paving,[0,-.097,0],undefined,undefined,false);
  plantingMask(court.getPoints(24).map(p=>[p.x,p.y]));recordFloor(court.getPoints(24).map(p=>[p.x,p.y]),ground.position.y-.097,'shared-court');
  // Broad curved stone courses are sparse enough to keep the foreground calm.
  // Long arc joints connect the fronts instead of emphasizing a checkerboard.
  for(const points of [
    [[-9.08,1.61],[-6.53,1.35],[-3.4,1.69],[0,1.48],[3.4,1.65],[6.4,1.41],[9.11,1.76]],
    [[-9.17,2.50],[-6.62,2.34],[-3.30,2.64],[0,2.56],[3.41,2.49],[6.47,2.43],[9.15,2.69]],
    [[-8.85,3.36],[-6.31,3.30],[-3.21,3.40],[0,3.60],[3.03,3.38],[6.41,3.29],[8.95,3.45]]
  ]) groundRibbon(points,.014,mortar,.035);
  // Small rounded connecting stones run to the greenhouse over a continuous
  // neutral substrate. The central approach is still the established route.
  groundRibbon([[0,1.5],[.04,-.6],[-.11,-2.6],[.04,-4.5],[0,-6.85]],3.54,gravel,.014);
  for(let iz=0;iz<8;iz++) for(const side of [-1,1]) {
    const x=side*(.59+(iz%2)*.11),z=-6.71+iz*.96;
    const turn=[0,(iz%2?.13:-.10)*side,0];
    batch(ground,pebble,paving,[x,-.101,z],[.67,.035,.46],turn,iz%3?'#e4e8dd':'#d4dccc',false);recordStoneFloor(pebble,[x,-.101,z],[.67,.035,.46],turn);
  }
  // A slim continuous curved edging connects the path to cultivated lawn.
  const courtBorder=[[-9.39,1.10],[-9.05,.62],[-6.20,.52],[-3.20,.70],[0,.62],[3.25,.58],[6.20,.54],[9.10,.79],[9.43,1.34]];
  groundRibbon(courtBorder,.13,stone,.022);
  groundRibbon([[-9.28,4.53],[-6.43,4.96],[-3.48,4.93],[0,5.17],[3.32,4.97],[6.37,4.97],[9.23,4.53]],.13,stone,.022);
  // Broad paths form an actual garden circuit around both sides and behind
  // the greenhouse. They share the level meadow and add no new obstacles.
  const leisureCircuit = [[-8.85,3.1],[-10.5,0],[-10.4,-4.8],[-9.2,-8.8],[-5.3,-9.8],[0,-9.9],[6.3,-9.8],[10.4,-7.9],[10.55,-2.4],[10.4,1.2],[8.9,3.9]];
  groundRibbon(leisureCircuit,1.70,paving,.026);
  groundRibbon([[-9.2,3],[-9.0,5.3],[-4.5,6.0],[0,6.12],[4.8,5.92],[9.0,5.3],[9.2,3]],1.35,gravel,.025);
  for(const path of TOWN_LAYOUT.paths)groundRibbon(path.points,path.width,path.materialKey==='paving'?paving:gravel,path.surfaceLift,true);
  // Short curved tufts grow in patches, with open mown lawn between them.
  // Each blade has an actual tapered ribbon; no large needle silhouettes.
  const blade = geometry(new THREE.BufferGeometry());
  blade.setAttribute('position', new THREE.Float32BufferAttribute([
    -.010, 0, 0, .010, 0, 0, -.010, .035, .010, .008, .035, .010, -.005, .065, .027, .005, .065, .027, .011, .080, .053,
  ], 3)); blade.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4, 4, 5, 6]); blade.computeVertexNormals();
  const grass = material({ color: '#ffffff', roughness: .93, side: THREE.DoubleSide });
  const lawnAllowed = (x, z) => !((z > .39 && z < 5.25 && Math.abs(x) < 9.7) || (Math.abs(x) > 9.35 && Math.abs(x) < 11.6 && z > -10.75 && z < 5.9) || (Math.abs(x) < 10 && z < -8.65 && z > -10.8) || (Math.abs(x) < 10 && z > 5.15 && z < 7.0) || (Math.abs(x) < 1.95 && z > -7.2 && z < 1.3)
      || [-6, 0, 6].some(center => Math.abs(x - center) < 2.4 && z > -3.04 && z < 1.3)
      || (Math.abs(x) < 2.45 && z < -3.8 && z > -9.05) || ((x - 5.35) / 2.05) ** 2 + ((z + 5.6) / 1.36) ** 2 < 1);
  for (let i = 0; i < 60; i++) {
    const cx = -12.5 + rand() * 25, cz = -11.5 + rand() * 17;
    if (!lawnAllowed(cx,cz)||!clearOfWalkingSurface(cx,cz,.32))continue;
    for (let j = 0; j < 10; j++) {
      const a = rand() * TAU, r = Math.sqrt(rand()) * .29, x = cx + Math.sin(a) * r, z = cz + Math.cos(a) * r;
      if (!lawnAllowed(x,z)||!clearOfWalkingSurface(x,z,.20))continue;
      const size = .7 + rand() * .8;
      batch(ground, blade, grass, [x, terrainHeight(x, z) + .011, z], [.85, size, .85], [0, rand() * TAU, (rand() - .5) * .2], new THREE.Color('#526c42').lerp(new THREE.Color('#899356'), rand() * .75).getHex(), false);
      if (j % 11 === 0) for (let petal = 0; petal < 3; petal++) batch(ground, cloverLeaf, grass, [x + Math.sin(petal * TAU / 3) * .017, terrainHeight(x, z) + .014, z + Math.cos(petal * TAU / 3) * .017], [.021, .012, .015], [0, petal * TAU / 3, 0], '#405d35', false);
    }
  }
  // Loose meadow drifts extend beyond the formal borders. Larger blades and
  // broad sparse patches read as growth, instead of dark dots on a green mat.
  for (let i = 0; i < 1150; i++) {
    const x = -28 + rand() * 56, z = -26 + rand() * 35;
    if (Math.abs(x)<23.0&&z>-26&&z<10.2)continue;
    const density = Math.sin(x * .46 + Math.sin(z * .38) * 2) + Math.cos(z * .69 - x * .18);
    if (density < .52) continue;
    for (let j = 0; j < 2; j++) batch(ground, blade, grass, [x + (rand() - .5) * .28, terrainHeight(x, z) + .015, z + (rand() - .5) * .28], [1.7, 1.4 + rand(), 1.7], [0, rand() * TAU, 0], i % 4 ? '#798a59' : '#a8aa75', false);
  }
  // Low meadow islands belong to the broad pigment fields, outside every
  // playable route. Their scale reads as gentle growth rather than dark dots.
  const meadowRandom = random(7109);
  for (let i = 0; i < 16; i++) {
    const side = i % 3, cx = side===0?-24.0-meadowRandom()*7:side===1?24.0+meadowRandom()*7:-20+meadowRandom()*40;
    const cz = side<2?-16+meadowRandom()*22:-27.2-meadowRandom()*4, radius = .55 + meadowRandom() * .65;
    const shade = new THREE.Color('#91a26e').lerp(new THREE.Color('#c4c596'), meadowRandom() * .72).getHex();
    for (let k = 0; k < 4; k++) {
      const a = k * 2.399 + i;
      batch(ground, canopyLeaf, foliage, [cx + Math.sin(a) * .09, terrainHeight(cx, cz) + .012, cz + Math.cos(a) * .09], [.62, .26, .62], [.97, a, .08], shade, false);
    }
    for (let j = 0; j < 18; j++) {
      const a = j * 2.399 + meadowRandom(), r = Math.sqrt(meadowRandom()) * radius;
      const x = cx + Math.sin(a) * r, z = cz + Math.cos(a) * r, h = .18 + meadowRandom() * .15;
      batch(ground, blade, grass, [x, terrainHeight(x, z) + .008, z], [1.65, h / .08, 1.65], [0, meadowRandom() * TAU, (meadowRandom() - .5) * .18], shade, false);
      if (j === 3 || j === 14) {
        batch(ground, twig, stem, [x, terrainHeight(x, z) + h * .48, z], [.006, h, .006], undefined, undefined, false);
        blossom(ground, [x, terrainHeight(x, z) + h, z], .075 + meadowRandom() * .025, i % 3 ? '#e9e2c7' : '#d4b7c8', a, 5);
      }
    }
  }
  for (const id of Object.keys(PLACES)) facade(id);
  for (const sign of [-1, 1]) {
    const seat = root(`town-street-bench-${sign}`, [sign * 5, 0, 3.06]); occlusionRoots.push(seat);
    bench(seat, [0, .07, 0], 1.8);
    const planter = root(`town-street-planter-${sign}`, [sign * 8.6, .05, 2.7]); occlusionRoots.push(planter);
    pot(planter, [0, 0, 0], 1.2, sign < 0 ? '#f0ede1' : '#e4bac4');
  }

  function tree(p, scale, seed) {
    const rng = random(seed), g = root(`town-tree-${seed}`, [p[0], .2 + p[1], p[2]]);
    g.scale.setScalar(scale); occlusionRoots.push(g);
    const data = { positions: [], uv: [], indices: [] }, up = new THREE.Vector3(0, 1, 0);
    // The branch construction follows the home v6 botanical principle: each
    // leaf begins at a real tapering twig. There are no spherical crown cores.
    const trunk=branch([new THREE.Vector3(0,0,0),new THREE.Vector3(.010,.85,.005),new THREE.Vector3(-.018,2.10,-.015),new THREE.Vector3(.08,3.55,-.04)],.10,.009,12,8);
    const broad=seed%2?1.22:1.06;
    g.userData.trunkPhysicalRadius=.12*scale;g.userData.lowerBranchWorldY=.2+p[1]+1.56*scale-.034*scale;
    for (let j = 0; j < 8; j++) {
      const angle = j * 2.399 + seed * .13, height = 1.56 + j * .245;
      const reach = (1.03 + rng() * .30) * broad * (j === 7 ? .72 : 1);
      const start = trunk.getPointAt(height / 3.55), end = new THREE.Vector3(Math.sin(angle) * reach, height + .37 + rng() * .14, Math.cos(angle) * reach * .87);
      const elbow = start.clone().lerp(end, .55); elbow.y -= .09;
      const b = branch([start, elbow, end], .032 - j * .0017, .0045, 7, 6);
      for (let k = 0; k < 4; k++) {
        const origin = b.getPoint(.33 + k * .215), sign = k % 2 ? 1 : -1;
        const heading = angle + sign * (.65 + rng() * .4), length = .43 + rng() * .20;
        const tip = origin.clone().add(new THREE.Vector3(Math.sin(heading) * length, .15 + rng() * .19, Math.cos(heading) * length));
        const middle = origin.clone().lerp(tip, .55); middle.y += .035;
        const t = branch([origin, middle, tip], .009, .0018, 4, 5);
        if (seed === 41 || seed === 75) {
          // One flowering tree on each side gives the garden a seasonal focal
          // point. Blossoms begin at twig tips, alongside the original leaves.
          const at = t.getPoint(.91);
          blossom(g, at.toArray(), .19 + rng() * .035, seed === 41 ? '#e6bfc1' : '#eee5ce', heading, 5);
        }
        for (let pair = 0; pair < 8; pair++) for (const side of [-1, 1]) {
          const u = .13 + (pair + (side > 0 ? .31 : 0)) / 8 * .76;
          const anchor = t.getPoint(u), a = heading + side * (.65 + rng() * .60);
          const direction = new THREE.Vector3(Math.sin(a), -.08 + rng() * .45, Math.cos(a)).normalize();
          const q = new THREE.Quaternion().setFromUnitVectors(up, direction).multiply(new THREE.Quaternion().setFromAxisAngle(up, (rng() - .5) * 1.25));
          const r = new THREE.Euler().setFromQuaternion(q), size = (.31 + rng() * .070) * (1 - u * .10);
          batch(g, crownLeaf, foliage, anchor.toArray(), [size * (1.02 + rng() * .15), size, size], [r.x, r.y, r.z], new THREE.Color('#466a40').lerp(new THREE.Color('#8b9e60'), rng() * .72 + u * .10).getHex());
        }
      }
    }
    for (let i = 0; i < 5; i++) {
      const a = i * TAU / 5, start = new THREE.Vector3(0, .07, 0), tip = new THREE.Vector3(Math.sin(a) * .33, .015, Math.cos(a) * .33);
      branch([start, start.clone().lerp(tip, .48), tip], .035, .007, 4, 5);
    }
    const geo = geometry(new THREE.BufferGeometry()); geo.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(data.uv, 2)); geo.setIndex(data.indices); geo.computeVertexNormals(); part(g, geo, bark);
    function branch(points, startRadius, endRadius, segments, sides) {
      const curve = new THREE.CatmullRomCurve3(points), offset = data.positions.length / 3;
      const axis = new THREE.Vector3(), normal = new THREE.Vector3(), length = curve.getLength();
      for (let row = 0; row <= segments; row++) {
        const t = row / segments, center = curve.getPoint(t), tangent = curve.getTangent(t).normalize();
        axis.crossVectors(tangent, Math.abs(tangent.y) > .95 ? new THREE.Vector3(1, 0, 0) : up).normalize(); normal.crossVectors(axis, tangent).normalize();
        const radius = THREE.MathUtils.lerp(startRadius, endRadius, Math.pow(t, .82));
        for (let col = 0; col <= sides; col++) {
          const a = col / sides * TAU, r = radius * (1 + Math.sin(a * 3 + t) * .055);
          const vertex = center.clone().addScaledVector(axis, Math.cos(a) * r).addScaledVector(normal, Math.sin(a) * r);
          data.positions.push(vertex.x, vertex.y, vertex.z); data.uv.push(col / sides, t * length * 2);
          const at = offset + row * (sides + 1) + col;
          if (row < segments && col < sides) data.indices.push(at, at + sides + 1, at + 1, at + 1, at + sides + 1, at + sides + 2);
        }
      }
      return curve;
    }
  }
  // Trunks are all outside the legal walking rectangle. Airy foliage replaces
  // the old spherical bushes while leaving route silhouettes easy to read.
  for(const t of TOWN_LAYOUT.trees)tree([t.x,-.32,t.z],t.scale,t.seed);
  // The perimeter is designed as a garden: broad planted curves and a quiet
  // low stone edge, rather than isolated rocks pasted onto an empty plane.
  const gardenCurves = [
    [[-13.0, 5.5], [-13.1, 1], [-13.4, -4], [-12.8, -10.9]],
    [[13.0, 5.3], [13.3, 1], [13.55, -4], [12.85, -10.9]],
    [[-9.7, -11.7], [-5.6, -11.6], [-2.4, -11.4]],
    [[2.5, -11.5], [6.5, -11.6], [9.9, -11.8]],
    [[-10.8, 8.1], [-8.2, 7.65], [-5.5, 7.75], [-2.7, 8.35]],
    [[2.7, 8.35], [5.4, 7.70], [8.3, 7.65], [10.8, 8.1]],
  ];
  function groundRibbon(points,width,mat,lift=.006,uniformWidth=false) {
    const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z))), positions = [], uv = [], indices = [], colors = [];
    const planted = mat === gardenSoil, cross = planted ? [-1, -.82, 0, .82, 1] : [-1, 1], stride = cross.length;
    for (let i = 0; i <= 48; i++) {
      const t = i / 48, p = curve.getPoint(t), v = curve.getTangent(t);
      const localWidth=uniformWidth?width:width*(1+Math.sin(t*TAU+points[0][0]*.11)*.065+Math.sin(t*TAU*2+points[0][1])*.035);
      for (const side of cross) {
        const x = p.x - v.z * localWidth * .5 * side, z = p.z + v.x * localWidth * .5 * side;
        positions.push(x, terrainHeight(x, z) + lift, z);
        uv.push(...(planted ? [x / 100 + .5, .5 - (z + 7) / 90] : [t * 6, (side + 1) / 2]));
        if (planted) { const c = new THREE.Color('#827859').lerp(terrainColor(x, z), THREE.MathUtils.smoothstep(Math.abs(side), .63, 1)); colors.push(c.r, c.g, c.b); }
      }
      if (i < 48) for (let j = 0; j < stride - 1; j++) { const k = i * stride + j; indices.push(k, k + 1, k + stride, k + 1, k + stride + 1, k + stride); }
    }
    const geo = geometry(new THREE.BufferGeometry()); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(indices); geo.computeVertexNormals();
    if (planted) geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    if(mat===paving||mat===gravel||mat===stone){const left=[],right=[];for(let i=0;i<=48;i++){const a=i*stride*3,b=a+(stride-1)*3;left.push([positions[a],positions[a+2]]);right.push([positions[b],positions[b+2]]);}plantingMask([...left,...right.reverse()]);recordFloor([...left,...right],baseFloorY+lift);}
    part(ground,geo,mat,undefined,undefined,undefined,false);return curve;
  }
  function gardenShrub(x,z,size,shade) {
    if(!clearOfWalkingSurface(x,z,.72))return;
    const y=terrainHeight(x,z);
    for (let shoot = 0; shoot < 5; shoot++) {
      const a = shoot * 2.399 + x, height = (.24 + rand() * .16) * size;
      const tip = [x + Math.sin(a) * .24 * size, y + height, z + Math.cos(a) * .24 * size];
      if(!clearOfWalkingSurface(tip[0],tip[2],.35))continue;
      beam(ground,[x,y+.01,z],tip,.008*size,stem,twig,true);
      for (let pair = 0; pair < 5; pair++) for (const side of [-1, 1]) {
        const t = .17 + (pair + (side > 0 ? .25 : 0)) * .15, angle = a + side * 1.05;
        batch(ground, canopyLeaf, foliage, [x + (tip[0] - x) * t, y + height * t, z + (tip[2] - z) * t], [.25 * size, (.17 + rand() * .06) * size, .25 * size], [1.10 + rand() * .35, angle, side * .12], pair<4?shade:'#9aac70',true);
      }
    }
  }
  function soilPocket(x,z,radius) {
    // Only a small circular soil pocket sits below each planted group. Smooth
    // concentric colour rings meet the actual lawn, avoiding exposed polygons.
    const p=[x,terrainHeight(x,z)+.006,z],uv=[x/100+.5,.5-(z+7)/90],ind=[],colors=[];
    const centre=new THREE.Color('#82765b');colors.push(centre.r,centre.g,centre.b);
    const rings=5,segments=32;
    for(let ring=1;ring<=rings;ring++)for(let i=0;i<segments;i++){
      const a=i/segments*TAU,r=radius*ring/rings,px=x+Math.cos(a)*r,pz=z+Math.sin(a)*r*.86;
      p.push(px,terrainHeight(px,pz)+.006,pz);uv.push(px/100+.5,.5-(pz+7)/90);
      const c=centre.clone().lerp(terrainColor(px,pz),THREE.MathUtils.smoothstep(ring/rings,.15,1));colors.push(c.r,c.g,c.b);
      if(ring===1)ind.push(0,1+(i+1)%segments,1+i);
      else {const inner=1+(ring-2)*segments+i,outer=1+(ring-1)*segments+i,next=(i+1)%segments;
        ind.push(inner,1+(ring-1)*segments+next,outer,inner,1+(ring-2)*segments+next,1+(ring-1)*segments+next);}
    }
    const outer=[];for(let i=0;i<segments;i++){const k=(1+(rings-1)*segments+i)*3;outer.push([p[k],p[k+2]]);}recordFloor(outer,ground.position.y+terrainHeight(x,z)+.006);
    const offset=soilPatchData.positions.length/3;soilPatchData.positions.push(...p);soilPatchData.uv.push(...uv);soilPatchData.colors.push(...colors);soilPatchData.indices.push(...ind.map(i=>i+offset));
  }
  for(let n=0;n<gardenCurves.length;n++) {
    const curve=new THREE.CatmullRomCurve3(gardenCurves[n].map(([x,z])=>new THREE.Vector3(x,0,z)));
    const groups=n<2?[.16,.63,.89]:n<4?[.25,.75]:[.12,.48,.88];
    for(let i=0;i<groups.length;i++){
      const t=groups[i],p=curve.getPoint(t),v=curve.getTangent(t),offset=n>=4?.13:0;
      const radius=n>=4?1.05:n<2?1.03:.93;
      soilPocket(p.x-v.z*offset,p.z+v.x*offset,radius*.79);
      flowerDrift(p.x-v.z*offset,p.z+v.x*offset,radius,i===1?(n%2?'#d1b0d1':'#e6b6c4'):'#f1eee1',1019+n*113+i,'hydrangea');
      // One broad lower leaf mass knits each flower group into the planted edge.
      const shrubSide=n>=4?-1:1;
      gardenShrub(p.x+v.z*(radius*.62)*shrubSide,p.z-v.x*(radius*.62)*shrubSide,2.05,n%2?'#608366':'#739572');
    }
    // Quiet runs of connected river stone interrupt only at deliberate gaps.
    const steps=30;
    for(let i=0;i<=steps;i++){
      const t=i/steps,p=curve.getPoint(t),v=curve.getTangent(t),side=n===0?-1:n===1?1:n<4?1:-1;
      const edge=n>=4?1.12:n<2?1.02:.72,x=p.x+v.z*edge*side,z=p.z-v.x*edge*side;
      batch(ground,pebble,stone,[x,terrainHeight(x,z)+.024,z],[.203,.055,.161],[0,Math.atan2(v.x,v.z),0],i%5?'#bfc8b9':'#d2d9c9',false);
    }
  }
  // Sixteen colour-blended soil pockets share one static mesh.
  const mergedSoil=geometry(new THREE.BufferGeometry());mergedSoil.setAttribute('position',new THREE.Float32BufferAttribute(soilPatchData.positions,3));mergedSoil.setAttribute('uv',new THREE.Float32BufferAttribute(soilPatchData.uv,2));mergedSoil.setAttribute('color',new THREE.Float32BufferAttribute(soilPatchData.colors,3));mergedSoil.setIndex(soilPatchData.indices);mergedSoil.computeVertexNormals();part(ground,mergedSoil,gardenSoil,undefined,undefined,undefined,false);
  // A low, irregular gravel shoulder softens the long square edge. Its stones
  // are flush and retain every existing walking and bench collision footprint.
  groundRibbon([[-9.1, 5.19], [-6.3, 5.22], [-3, 5.25], [0, 5.18], [3.3, 5.24], [6.4, 5.21], [9.1, 5.19]], .30, gravel, .024);
  for (let i = 0; i < 20; i++) {
    const x = -9 + rand() * 18, z = 5.24 + (rand() - .5) * .17;
    batch(ground, pebble, stone, [x, -.109, z], [.027 + rand() * .030, .012, .025 + rand() * .022], [0, rand() * TAU, 0], i % 3 ? '#bcbca4' : '#d8ceb8', false);
  }

  // Shallow garden pond: stones, silt edge, lily leaves and reeds stay entirely
  // within its existing 1.82 x 1.11 m protected ellipse.
  part(ground, geometry(new THREE.CylinderGeometry(1, 1, .025, 56)), m.soil, [5.35, -.116, -5.6], [1.67, 1, .99], undefined, false);
  part(ground, geometry(new THREE.CylinderGeometry(1, 1, .018, 56)), m.water, [5.35, -.092, -5.6], [1.55, 1, .89], undefined, false);
  for (let i = 0; i < 39; i++) {
    const angle = i / 39 * TAU, radial = 1 + Math.sin(i * 2.4) * .02;
    batch(ground, pebble, stone, [5.35 + Math.sin(angle) * 1.62 * radial, -.035 + rand() * .012, -5.6 + Math.cos(angle) * .92 * radial], [.16 + rand() * .07, .095 + rand() * .035, .11 + rand() * .04], [rand() * .3, angle, .1], new THREE.Color('#c2c3ac').lerp(new THREE.Color('#858f7b'), rand() * .7).getHex());
  }
  for (let i = 0; i < 6; i++) {
    const x = 4.75 + rand() * .68, z = -5.85 + rand() * .43; batch(ground, sphere, foliage, [x, -.071, z], [.14 + rand() * .07, .008, .11 + rand() * .05], [0, rand() * TAU, 0], '#6f8751', false);
  }
  for (let i = 0; i < 7; i++) herb(ground, [6.15 + rand() * .24, -.12, -6.05 + rand() * .34], .8, 9);
  landscape();
  function landscape() {
    // Smooth closed-looking landforms extend behind and to both sides. Their
    // broad Gaussian ridges have no triangular card edges at the horizon.
    for (const [depth, height, color, width, reach] of [[-57, 9.6, '#9eafb0', 118, 31], [-40, 7.2, '#819d92', 106, 28], [-27, 4.1, '#72916f', 94, 22]]) {
      const geo = geometry(new THREE.PlaneGeometry(width, reach * 2, 96, 48)); geo.rotateX(-Math.PI / 2);
      const p = geo.attributes.position, colors = [], base = new THREE.Color(color);
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), localZ = p.getZ(i), z = localZ + depth;
        const along = .68 + .19 * Math.sin(x * .093 + depth * .13) + .16 * Math.cos(x * .17 - depth * .05);
        const ridgeOffset = Math.sin(x * .049 + depth) * 4.5;
        const across = Math.exp(-(((localZ - ridgeOffset) / (reach * .44)) ** 2));
        const ridgeY = -1.3 + height * across * along + Math.sin(x * .29 + z * .13) * .18 * across;
        const y=THREE.MathUtils.lerp(ridgeY,-1.5,THREE.MathUtils.smoothstep(z,TOWN_LAYOUT.ground.flatBounds.minZ-6,TOWN_LAYOUT.ground.flatBounds.minZ));
        p.setXYZ(i, x, y, z);
        const c = base.clone().lerp(new THREE.Color('#b4bc9a'), Math.max(0, y) / 36).lerp(new THREE.Color('#67877c'), Math.max(0, Math.sin(x * .22 + z * .13)) * .045);
        colors.push(c.r, c.g, c.b);
      }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geo.computeVertexNormals();
      const hillMaterial = material({ color: '#ffffff', vertexColors: true, roughness: 1, side: THREE.DoubleSide });
      if (depth === -27) {
        hillMaterial.map = grassMap; hillMaterial.bumpMap = grassMap; hillMaterial.bumpScale = .012;
        // Matching world texture scale at the foreground hill's toe prevents
        // a giant smooth green wedge cutting through the detailed meadow.
        const hillUv = geo.attributes.uv;
        for (let i = 0; i < p.count; i++) hillUv.setXY(i, p.getX(i) / 100 + .5, .5 - (p.getZ(i) + 7) / 90);
        const hillColors = geo.attributes.color;
        for (let i = 0; i < p.count; i++) {
          const edgeBlend = THREE.MathUtils.smoothstep(p.getZ(i), -22, -10);
          const c = new THREE.Color().fromBufferAttribute(hillColors, i).lerp(new THREE.Color('#93a174'), edgeBlend * .82);
          hillColors.setXYZ(i, c.r, c.g, c.b);
        }
      }
      part(ground, geo, hillMaterial, undefined, undefined, undefined, false);
    }
    // Small leaves form connected branch clusters at distance. Twelve triangles
    // per leaf keep a botanical outline without separate spherical crown blobs
    // or the previous 4,900 detailed leaves. Foreground leaves stay sculpted.
    const farLeaf=geometry(leafGeometry(3,2));
    for (let i = 0; i < 35; i++) {
      const x = -26 + i * 1.55, z = -29 - rand() * 7, h = 1.4 + rand() * 2.1, y = terrainHeight(x, z);
      const variant=i%3,spread=variant===0?.76:variant===1?.52:.65;
      batch(ground, twig, bark, [x, y + h * .47, z], [.052, h * .94, .052], [0, 0, (rand() - .5) * .12], undefined, false);
      for (let j = 0; j < 5; j++) {
        const a = j * 2.399 + i, height=h*(variant===1?.61+j*.067:.66+j*.057),reach=spread*(.66+rand()*.27);
        const from = [x, y + height*.72, z], end = [x + Math.sin(a) * reach, y + height, z + Math.cos(a) * reach];
        beam(ground, from, end, .014, bark, twig, false);
        for(let k=0;k<16;k++){
          const angle=a+k*2.399,radial=Math.sqrt((k+.5)/16)*spread*.40,length=.32+rand()*.18;
          const position=[end[0]+Math.sin(angle)*radial,end[1]+(rand()-.5)*h*.10,end[2]+Math.cos(angle)*radial];
          const shade=new THREE.Color('#4d7057').lerp(new THREE.Color('#8a9e68'),rand()*.65+j*.04).getHex();
          batch(ground,farLeaf,farFoliage,position,[length*(1.5+rand()*.38),length,length],[.76+rand()*.55,angle,(rand()-.5)*.35],shade,false);
        }
      }
    }
    const farWall=m.plaster.clone();farWall.color.set('#ffffff');farWall.vertexColors=true;ownedMaterials.add(farWall);
    const districtWood=m.wood.clone(),districtRoof=m.roofSlate.clone(),districtGlass=m.glass.clone();
    for(const mat of [districtWood,districtRoof,districtGlass]){mat.color.set('#ffffff');mat.vertexColors=true;ownedMaterials.add(mat);}
    districtRoof.userData.townSurface='roof';districtGlass.userData.townSurface='glass';
    const roofPrimitives=[0,1,2].map(style=>geometry(neighbourRoofGeometry(style)));
    const temporaryGables=[];
    for(const house of TOWN_LAYOUT.houses) neighbourHouse(house);
    for(const geo of [...roofPrimitives,...temporaryGables]){geo.dispose();ownedGeometries.delete(geo);}
    function neighbourHeight(x,z,style=0){
      if(style===1)return .69-.56*(x+.5)+.055*(Math.abs(z)*2)**5;
      if(style===2)return .21+.43*Math.cos(x*Math.PI)+.09*(Math.abs(x)*2)**7+.05*(Math.abs(z)*2)**5;
      return .64-.57*Math.sin(Math.abs(x)*Math.PI)+.13*(Math.abs(x)*2)**7+.04*(Math.abs(z)*2)**5;
    }
    function neighbourRoofGeometry(style){
      const p=[],uv=[],ind=[],nx=18,nz=8,stride=nz+1,offset=(nx+1)*stride;
      for(let layer=0;layer<2;layer++)for(let ix=0;ix<=nx;ix++)for(let iz=0;iz<=nz;iz++){
        const x=ix/nx-.5,z=iz/nz-.5;p.push(x,neighbourHeight(x,z,style)-layer*.065,z);uv.push(ix/nx*2,iz/nz*2);
      }
      for(let ix=0;ix<nx;ix++)for(let iz=0;iz<nz;iz++){
        const k=ix*stride+iz;ind.push(k,k+1,k+stride,k+1,k+stride+1,k+stride);
        ind.push(k+offset,k+stride+offset,k+1+offset,k+1+offset,k+stride+offset,k+stride+1+offset);
      }
      const join=(a,b)=>ind.push(a,b,a+offset,b,b+offset,a+offset);
      for(let i=0;i<nx;i++){join(i*stride,(i+1)*stride);join((i+1)*stride+nz,i*stride+nz);}
      for(let i=0;i<nz;i++){join(i+1,i);join(nx*stride+i,nx*stride+i+1);}
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(ind);geo.computeVertexNormals();return geo;
    }
    function neighbourGable(w,d,style,side){
      const shape=new THREE.Shape();shape.moveTo(-w/2,0);shape.lineTo(w/2,0);
      for(let i=32;i>=0;i--){const x=-w/2+w*i/32,u=(side<0?-x:x)/(w+.78),z=side*d/(2*(d+.69));shape.lineTo(x,neighbourHeight(u,z,style)*1.24-.09);}
      shape.closePath();const geo=geometry(new THREE.ShapeGeometry(shape,1));temporaryGables.push(geo);return geo;
    }
    function neighbourHouse(house){
      const {width:w,depth:d,height:h,yaw:angle,style,paint:color}=house;
      const g=root('town-'+house.id,[house.x,TOWN_LAYOUT.ground.rootY+TOWN_LAYOUT.ground.localY,house.z]);g.rotation.y=angle;
      g.userData.neighbourhoodHouse=true;g.userData.layoutId=house.id;g.userData.groundPartFootprints=[];occlusionRoots.push(g);
      const categories=new Map(),mats={plaster:farWall,wood:districtWood,roof:districtRoof,glass:districtGlass};
      const dummyPart=new THREE.Object3D(),houseMatrix=new THREE.Matrix4().makeRotationY(angle);houseMatrix.setPosition(g.position);
      function addFloor(p,s){
        const points=[[-s[0]/2,-s[2]/2],[s[0]/2,-s[2]/2],[s[0]/2,s[2]/2],[-s[0]/2,s[2]/2]].map(([x,z])=>{const v=new THREE.Vector3(x+p[0],p[1]+s[1]/2,z+p[2]).applyMatrix4(houseMatrix);return[v.x,v.z];});
        const id=house.id+'-floor-'+districtFloorRecords.length,height=g.position.y+p[1]+s[1]/2;districtFloorRecords.push({id,polygon:points,worldY:height});plantingMask(points);recordFloor(points,height,id);
      }
      function b(geo,mat,p,s,r=[0,0,0],tint,floor=false,partId){
        dummyPart.position.set(...p);dummyPart.scale.set(...s);dummyPart.rotation.set(...r);dummyPart.updateMatrix();
        const local=dummyPart.matrix.clone(),full=new THREE.Matrix4().multiplyMatrices(houseMatrix,local);
        if(partId){geo.computeBoundingBox();const bbox=geo.boundingBox.clone().applyMatrix4(full),old=g.userData.groundPartFootprints.find(v=>v.id===partId);if(old){old.minX=Math.min(old.minX,bbox.min.x);old.maxX=Math.max(old.maxX,bbox.max.x);old.minZ=Math.min(old.minZ,bbox.min.z);old.maxZ=Math.max(old.maxZ,bbox.max.z);}else g.userData.groundPartFootprints.push({id:partId,minX:bbox.min.x,maxX:bbox.max.x,minZ:bbox.min.z,maxZ:bbox.max.z});}
        if(floor)addFloor(p,s);
        const low=floor||mat===stone||mat===paving||mat===gravel||mat===foliage||mat===flowers;
        if(low){const at=new THREE.Vector3(...p).applyMatrix4(houseMatrix);at.y-=.20;batch(ground,geo,mat,at.toArray(),s,[r[0],angle+r[1],r[2]],tint,mat===stone);return;}
        const category=mat===m.roofSlate?'roof':mat===m.glass?'glass':mat===farWall?'plaster':'wood';
        let data=categories.get(category);if(!data)categories.set(category,data={positions:[],normals:[],uv:[],colors:[],indices:[],floorRanges:[]});
        const position=geo.attributes.position,normal=geo.attributes.normal,uv=geo.attributes.uv,offset=data.positions.length/3,triangleStart=data.indices.length/3;
        const normalMatrix=new THREE.Matrix3().getNormalMatrix(local),v=new THREE.Vector3(),n=new THREE.Vector3(),paint=mat.color.clone();if(tint!==undefined)paint.multiply(new THREE.Color(tint));
        const oldWorld=layoutWorldPoint(house,p[0],p[2]),offsetU=oldWorld.x*.31+(TOWN_LAYOUT.ground.localY+p[1])*.47+oldWorld.z*.23,offsetV=oldWorld.x*.19+(TOWN_LAYOUT.ground.localY+p[1])*.37+oldWorld.z*.41;
        for(let i=0;i<position.count;i++){
          const px=position.getX(i)*s[0],py=position.getY(i)*s[1],pz=position.getZ(i)*s[2],nx=Math.abs(normal.getX(i)),ny=Math.abs(normal.getY(i)),nz=Math.abs(normal.getZ(i));
          let u=uv?.getX(i)||0,vv=uv?.getY(i)||0;
          if(category==='wood'){if(s[0]>s[1]&&s[0]>s[2]){u=ny>nz?pz:py;vv=px;}else if(s[2]>s[1]){u=ny>nx?px:py;vv=pz;}else{u=nz>nx?px:pz;vv=py;}u=u/.26+offsetU;vv=vv/1.15+offsetV;}
          v.fromBufferAttribute(position,i).applyMatrix4(local);n.fromBufferAttribute(normal,i).applyNormalMatrix(normalMatrix);
          data.positions.push(v.x,v.y,v.z);data.normals.push(n.x,n.y,n.z);data.uv.push(u,vv);data.colors.push(paint.r,paint.g,paint.b);
        }
        const indices=geo.index?Array.from(geo.index.array):Array.from({length:position.count},(_,i)=>i);data.indices.push(...indices.map(i=>i+offset));
        if(floor)data.floorRanges.push({startTriangle:triangleStart,countTriangles:indices.length/3});
      }
      b(cube,stone,[0,-.12,0],[w+.36,.40,d+.35],undefined,'#c7cec4');
      for(const p of house.groundParts){
        if(p.kind==='house-wall'){b(cube,farWall,[p.localX,p.localY,p.localZ],[p.width,p.height,p.depth],undefined,color,false,p.id);continue;}
        const front=p.id.includes('garden-front');
        if(p.materialKey==='wood'){
          b(cube,stone,[p.localX,.07,p.localZ],[p.width,.14,p.depth],undefined,'#c5cfc0',false,p.id);
          for(const y of [.22,.44])b(eased,m.wood,[p.localX,y,p.localZ],[p.width,.055,.065],undefined,undefined,false,p.id);
          for(let j=0;j<7;j++)b(eased,m.wood,[p.localX-p.width*.46+j*p.width*.153,.25,p.localZ],[.055,.50,.065],undefined,undefined,false,p.id);
        }else{
          b(cube,farWall,[p.localX,.21,p.localZ],[front?p.width:.13,.42,front?.13:p.depth],undefined,'#e9ece5',false,p.id);
          b(cube,stone,[p.localX,.46,p.localZ],[p.width,.08,p.depth],undefined,undefined,false,p.id);
        }
      }
      b(roofPrimitives[style],m.roofSlate,[0,h-.13,0],[w+.78,1.24,d+.69]);
      for(const side of [-1,1])b(neighbourGable(w,d,style,side),farWall,[0,h-.13,side*(d/2+.016)],[1,1,1],[0,side<0?Math.PI:0,0],color);
      for(const side of [-1,1]){b(eased,m.darkWood,[side*(w+.70)/2,h+.085,0],[.09,.10,d+.70]);b(eased,m.wood,[side*(w/2-.07),h*.5,d/2+.035],[.12,h,.11]);}
      for(let j=0;j<11;j++){const u=j/10-.5,yy=h-.13+neighbourHeight(u,0,style)*1.24;b(eased,m.roofSlate,[u*(w+.78),yy+.015,0],[.042,.036,d+.69]);}
      const ridgeX=style===1?-(w+.78)*.49:0;b(eased,m.roofSlate,[ridgeX,h-.13+neighbourHeight(style===1?-.49:0,0,style)*1.24+.025,0],[.14,.12,d+.77]);
      for(const sign of [-1,1])b(eased,m.darkWood,[0,h-.04,sign*d/2],[w,.14,.10]);
      b(eased,m.darkWood,[0,.80,d/2+.032],[.70,1.60,.07]);b(eased,style===1?shutters:m.wood,[0,.80,d/2+.076],[.55,1.43,.026]);
      for(const side of [-1,1]){
        const wx=side*w*.29;b(eased,m.darkWood,[wx,1.26,d/2+.027],[.80,.94,.12]);b(cube,glassBacking,[wx,1.26,d/2+.094],[.64,.78,.025]);b(cube,m.glass,[wx,1.26,d/2+.126],[.64,.78,.008]);
        for(const u of [-.18,.18])b(eased,m.wood,[wx+u,1.26,d/2+.137],[.025,.82,.035]);b(eased,m.wood,[wx,1.25,d/2+.14],[.68,.035,.037]);b(eased,stone,[wx,.76,d/2+.08],[.90,.11,.25],undefined,'#d6ddd2');
        b(eased,shutters,[wx+side*.54,1.26,d/2+.073],[.23,.96,.035]);for(let j=0;j<3;j++)b(eased,shutters,[wx+side*.54,1+j*.26,d/2+.101],[.21,.023,.03]);
        b(eased,m.darkWood,[side*(w/2+.026),1.20,0],[.10,.85,.88]);b(cube,glassBacking,[side*(w/2+.083),1.20,0],[.02,.66,.71]);b(cube,m.glass,[side*(w/2+.099),1.20,0],[.008,.66,.71]);
        for(const v of [-.22,.22])b(eased,m.wood,[side*(w/2+.105),1.20,v],[.023,.69,.022]);b(eased,m.wood,[side*(w/2+.105),1.20,0],[.023,.024,.73]);
      }
      b(cube,paving,[0,.025,d/2+.40],[.87,.08,.80],undefined,'#e8ece6',true);
      b(cube,gravel,[0,.009,d/2+(house.yardFrontMargin+.4)/2],[1.4,.014,house.yardFrontMargin-.25],undefined,undefined,true);
      if(style===0){
        b(roofPrimitives[0],m.roofSlate,[0,1.91,d/2+.33],[w*.72,.53,1.10]);
        for(const side of [-1,1]){b(eased,m.wood,[side*w*.27,.97,d/2-.09],[.073,1.91,.073]);b(cube,stone,[side*w*.27,.14,d/2-.09],[.16,.29,.16]);}
        b(eased,m.darkWood,[0,1.94,d/2+.69],[w*.62,.085,.085]);
        for(let j=0;j<6;j++)b(eased,m.wood,[-w*.27+j*w*.108,.29,d/2+.65],[w*.095,.055,.62],undefined,undefined,true);
        addFloor([0,.29,d/2+.65],[w*.635,.055,.62]);
        for(const [z,y]of [[d/2+1.24,.0525],[d/2+.99,.160]])b(cube,paving,[0,y,z],[1.20,.085,.34],undefined,'#e8ece6',true);
        b(cube,farWall,[w*.30,h+.41,-d*.21],[.30,.99,.33],undefined,'#cbd3c7');b(eased,m.roofSlate,[w*.30,h+.93,-d*.21],[.41,.11,.43]);
      }else if(style===1){
        b(eased,m.darkWood,[-w*.18,h-.20,d/2+.04],[1.00,.31,.09]);b(cube,glassBacking,[-w*.18,h-.20,d/2+.092],[.86,.21,.018]);b(cube,m.glass,[-w*.18,h-.20,d/2+.110],[.86,.21,.008]);
      }else{
        const sx=w/2-.23;b(roofPrimitives[0],m.roofSlate,[sx,1.23,-d*.14],[1.68,.82,d*.74+.44],[0,Math.PI/2,0]);b(eased,m.darkWood,[sx,.83,d*.235],[.49,.61,.069]);b(eased,shutters,[sx,.83,d*.235+.045],[.39,.49,.027]);
        for(let j=0;j<9;j++)b(eased,m.wood,[-w*.42+j*w*.105,.39,d/2+.043],[w*.089,.59,.038]);
      }
      // Clear exterior window fronts leave the shared body/gate routes unobstructed.

      for(const [category,data]of categories){
        const geo=geometry(new THREE.BufferGeometry());geo.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(data.normals,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(data.uv,2));geo.setAttribute('color',new THREE.Float32BufferAttribute(data.colors,3));geo.setIndex(data.indices);geo.userData.townFloorTriangleRanges=data.floorRanges;
        const obj=part(g,geo,mats[category],undefined,undefined,undefined,category!=='glass');obj.userData.townSurface=category;
      }
    }

  }

  for (const [g, materials] of curvedBatches) for (const [mat, data] of materials) {
    const geo = geometry(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(data.uv, 2)); geo.setIndex(data.indices); part(g, geo, mat);
  }
  curvedBatches.clear();
  let instanceCount = 0, meshCount = 0, triangleCount = 0, vertexCount = 0;
  const dummy = new THREE.Object3D();
  for(const [parent,entries]of batches)for(const b of entries.values()) {
    if(parent===ground&&(b.mat===foliage||b.mat===flowers||b.mat===grass||b.mat===stem))b.items=b.items.filter(t=>t.p[1]+.20>1.85||clearOfWalkingSurface(t.p[0],t.p[2],.42));
    if(!b.items.length)continue;
    const object = new THREE.InstancedMesh(b.geo, b.mat, b.items.length); object.castShadow = b.cast; object.receiveShadow = true;
    for (let i = 0; i < b.items.length; i++) {
      const t = b.items[i]; dummy.position.set(...t.p); dummy.rotation.set(...t.rotation); dummy.scale.set(...t.scale); dummy.updateMatrix(); object.setMatrixAt(i, dummy.matrix);
      if (t.color !== undefined) object.setColorAt(i, new THREE.Color(t.color));
    }
    object.instanceMatrix.needsUpdate = true; if (object.instanceColor) object.instanceColor.needsUpdate = true;
    object.computeBoundingSphere(); parent.add(object); instanceCount += b.items.length;
  }
  // Every environment transform is static, including the tree root scale.
  // Keep matrixWorldAutoUpdate enabled so changing an ancestor still propagates.
  // Scene-owned label sprites added after this build retain automatic matrices.
  for(const g of roots)g.traverse(object=>{if(object.isSprite)return;object.updateMatrix();object.matrixAutoUpdate=false;});
  for (const g of buildings) g.traverse(o => { if (o.isMesh) occlusionMeshes.push(o); });
  for (const g of roots) g.traverse(o => {
    if (!o.isMesh) return; meshCount++;
    const copies = o.isInstancedMesh ? o.count : 1;
    triangleCount += (o.geometry.index?.count || o.geometry.attributes.position.count) / 3 * copies;
    vertexCount += o.geometry.attributes.position.count * copies;
  });
  let disposed = false;
  return {
    buildings,hitTargets,occlusionMeshes,occlusionRoots:[...buildings,...occlusionRoots],
    districtFloorRecords,floorHeight,
    stats: { artRevision: 20, environmentMeshes: meshCount, environmentInstances: instanceCount, environmentGeometries: ownedGeometries.size, environmentMaterials: ownedMaterials.size,
      environmentTriangles: triangleCount, environmentVertices: vertexCount, gardenBorders: gardenCurves.length, neighbouringHouses: TOWN_LAYOUT.houses.length, walkableNeighbourhood: true, neighbourMaterialCategories: 4, botanicalTrees: 6, treeLeaves: 3072, largeBranchCrowns: 6, mergedSoilPockets: 16, soilPocketMeshes: 1, prunedLowerBranches: true, distantBranchClusters: 175, distantLeaves: 2800, floweringTrees: 2, layeredFlowerGardens: 6, meadowIslands: 16, landscapePigmentFields: 4, facadeOpeningStyles: 3,
      levelWalkingMeadow: { ...TOWN_LAYOUT.ground.flatBounds, worldY: .075 }, linkedLeisureCircuits: 2, generousFrontCourt: true, artLanguage: 'sculpted-future-korean-village', heroBuildingSilhouettes: 3, wideRoundedHomeWindows: 1, domesticReadingBayRoof: true, homeWindowWidth: 2.04, roofConnectedHomeColumns: true, closedReadingBooks: 4, asymmetricWorkshopRoofs: 1, communalPavilionRoofs: 1, sharedTimberMaru: 1, signatureWaveAwnings: 1, embroideredLapisGuides: 1, coralMailboxes: 1, historyHangers: 4, neutralRoofFamily: 1, frozenStaticTransforms: true, warmRecessedWindowLayers: 3, staggeredMaruJoints: 15, ceramicWallAndRims: true },
    setCliffNormal(map) { cliffMaterial.normalMap = map; cliffMaterial.normalScale.set(.45, .45); cliffMaterial.needsUpdate = true; },
    setTerrainNormal(map) {
      // Authored paving/dressed-stone PBR owns its own surface scale and normals.
      if (!m.paving) { paving.normalMap = map; paving.normalScale.set(.08, .08); paving.needsUpdate = true; }
      if (!m.stone?.normalMap) { stone.normalMap = map; stone.normalScale.set(.11, .11); stone.needsUpdate = true; }
    },
    dispose() {
      if (disposed) return; disposed = true;
      // Instance matrices/colours are object-owned GPU attributes in Three.
      // Disposing their shared geometry alone does not release these buffers.
      for (const g of roots) {
        g.traverse(object => { if (object.isInstancedMesh) object.dispose(); });
        world.remove(g);
      }
      for (const geo of ownedGeometries) geo.dispose();
      for (const mat of ownedMaterials) mat.dispose();
      for (const map of ownedTextures) map.dispose();
      batches.clear();floorRegions.length=0;stoneFloorRegions.length=0;
    },
  };
}
