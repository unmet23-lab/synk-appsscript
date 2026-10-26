// 디오라마 시안의 조형 도구 — 텍스처 · 3D 파일 없이 형태와 꼭짓점 색만으로 만든다.
// 모든 조각은 position · normal · color 세 속성의 색인 기하로 맞춰 재질별로 한 덩어리로 합친다.
import { mergeGeometries, mergeVertices } from '/rendering/BufferGeometryUtils.js';

export function createKit(THREE) {
  const color = new THREE.Color(), tmp = new THREE.Vector3(), matrix = new THREE.Matrix4(), quat = new THREE.Quaternion(), euler = new THREE.Euler(), scale = new THREE.Vector3();
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v)), smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function rng(seed) { let s = (seed >>> 0) || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
  // Cheap smooth 3D noise in [-1, 1] (sum of sines): enough for organic wobble, no table to ship.
  const noise = (x, y, z, s = 0) => (Math.sin(x * 1.7 + s + Math.sin(z * 1.3 + s * .7)) * Math.sin(y * 2.1 - s * .4 + Math.sin(x * .9)) + Math.sin(z * 2.3 + x * .6 + s * 1.9) * .6) / 1.6;

  /** Keeps only position (+ normal when kept) in an indexed geometry. */
  function indexed(g, keepNormal = true) {
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && !(keepNormal && k === 'normal')) g.deleteAttribute(k);
    if (!g.index) g = mergeVertices(g, 1e-5);
    if (!g.attributes.normal) g.computeVertexNormals();
    return g;
  }
  /** Writes vertex colours: a hex, or fn(x, y, z, nx, ny, nz) → Color/hex, in the geometry's own space. */
  function paint(g, fill) {
    const p = g.attributes.position, n = g.attributes.normal, out = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const c = typeof fill === 'function' ? fill(p.getX(i), p.getY(i), p.getZ(i), n.getX(i), n.getY(i), n.getZ(i)) : fill;
      if (c && c.isColor) color.copy(c); else color.set(c);
      out.set([color.r, color.g, color.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(out, 3));
    return g;
  }
  /** Moves a geometry: p position, r Euler rotation (XYZ), s scale (number or [x,y,z]). */
  function place(g, { p = [0, 0, 0], r = [0, 0, 0], s = 1 } = {}) {
    euler.set(r[0], r[1], r[2]); quat.setFromEuler(euler); scale.set(...(Array.isArray(s) ? s : [s, s, s]));
    matrix.compose(tmp.set(p[0], p[1], p[2]), quat, scale); g.applyMatrix4(matrix); return g;
  }
  /** Darkens a colour by height above the ground: the contact shade a bake would give, computed here. */
  function grounded(hex, { from = .62, over = .9, base = 0, jitter = 0, seed = 1 } = {}) {
    const c0 = new THREE.Color(hex);
    return (x, y, z) => {
      const ao = from + (1 - from) * smooth(base, base + over, y), j = 1 + jitter * noise(x * 3.1, y * 2.7, z * 3.3, seed);
      return color.copy(c0).multiplyScalar(ao * j);
    };
  }

  // A box with truly rounded edges: sample rows at the bevel start, then inflate by r around the inner box.
  function axisSamples(h, r, k) {
    if (r <= 0 || k <= 0) return [-h, h];
    const a = [];
    for (let i = 0; i <= k; i++) a.push(-h + r - r * Math.cos(i / k * Math.PI / 2));
    for (let i = k; i >= 0; i--) a.push(h - r + r * Math.cos(i / k * Math.PI / 2));
    return a;
  }
  function softBox(w, h, d, r = .03, k = 1) {
    r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
    const half = [w / 2, h / 2, d / 2], S = half.map(v => axisSamples(v, r, k)), pos = [], nor = [], idx = [];
    // [fixed axis, sign, a axis, b axis] with a × b = outward normal.
    const faces = [[0, 1, 1, 2], [0, -1, 2, 1], [1, 1, 2, 0], [1, -1, 0, 2], [2, 1, 0, 1], [2, -1, 1, 0]];
    const v = [0, 0, 0];
    for (const [f, sign, a, b] of faces) {
      const base = pos.length / 3, A = S[a], B = S[b];
      for (let i = 0; i < A.length; i++) for (let j = 0; j < B.length; j++) {
        v[f] = sign * half[f]; v[a] = A[i]; v[b] = B[j];
        const inner = v.map((x, q) => clamp(x, -half[q] + r, half[q] - r)), dir = v.map((x, q) => x - inner[q]), len = Math.hypot(...dir);
        if (len > 1e-6) { const nrm = dir.map(x => x / len); pos.push(...inner.map((x, q) => x + nrm[q] * r)); nor.push(...nrm); }
        else { pos.push(...v); const nrm = [0, 0, 0]; nrm[f] = sign; nor.push(...nrm); }
      }
      for (let i = 0; i < A.length - 1; i++) for (let j = 0; j < B.length - 1; j++) {
        const q = base + i * B.length + j, q10 = q + B.length;
        idx.push(q, q10, q10 + 1, q, q10 + 1, q + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx);
    return g;
  }
  const cylinder = (rt, rb, h, seg = 10, open = false) => indexed(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open));
  /** A lumpy round mass (tree crowns, bushes, stones). */
  function blob(radius = 1, detail = 1, seed = 1, amp = .16, squash = 1) {
    const g = indexed(new THREE.IcosahedronGeometry(1, detail), false), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      tmp.set(p.getX(i), p.getY(i), p.getZ(i)).normalize();
      const k = radius * (1 + amp * noise(tmp.x * 2.2, tmp.y * 2.2, tmp.z * 2.2, seed));
      p.setXYZ(i, tmp.x * k, tmp.y * k * squash, tmp.z * k);
    }
    g.computeVertexNormals(); return g;
  }
  /** Extruded flat shape (walls with openings): built in XY, extruded towards +Z by depth. */
  function slab(shape, depth, bevel = .012) {
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 20 });
    return indexed(g);
  }
  function tube(points, radius, seg = 6, tubular = 24) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    return indexed(new THREE.TubeGeometry(curve, tubular, radius, seg, false));
  }

  /**
   * A Korean tiled roof: hipped, concave towards the eaves, corners lifted (앙곡), long tile courses as real
   * ripples, white mortar where the courses end, rafter-coloured underside. Ridge along X, centre at origin,
   * eave at y = 0 and ridge at y = rise. dFront/dBack let the ridge sit off centre (an asymmetric shed).
   */
  function hanokRoof({ w, dFront, dBack, rise = .9, hip = .55, lift = .22, thickness = .08, spacing = .27, tile = '#3d4c6b', tileLight = '#56688a', mortar = '#f1efe6', rafter = '#a8784d', edge = '#2c3850', detail = 1 }) {
    const hw = w / 2, hipLen = Math.min(hw, Math.max(dFront, dBack) * hip);
    const parts = [];
    const tAt = (x, z) => {
      const tz = z >= 0 ? z / dFront : -z / dBack, tx = Math.max(0, (Math.abs(x) - (hw - hipLen)) / hipLen);
      return { tz, tx, t: Math.max(tz, tx) };
    };
    const shellY = (x, z) => {
      const { tz, tx, t } = tAt(x, z), ux = Math.abs(x) / hw, uz = z >= 0 ? z / dFront : -z / dBack;
      return rise * Math.pow(Math.max(0, 1 - t), 1.55) + lift * Math.pow(ux, 3.2) * Math.pow(t, 1.15) + lift * .55 * Math.pow(uz, 3) * tx;
    };
    const ripple = (x, z) => {
      const { tz, tx } = tAt(x, z), front = smooth(-.04, .04, tz - tx);
      const along = .5 + .5 * Math.cos(2 * Math.PI * x / spacing), side = .5 + .5 * Math.cos(2 * Math.PI * z / spacing);
      return along * front + side * (1 - front);
    };
    const nx = Math.max(16, Math.round(w / spacing * (detail > .7 ? 4 : 3))), nz = detail > .7 ? 18 : 10;
    const grid = (fn, cfn, cols, rows) => {
      const pos = [], idx = [];
      for (let i = 0; i <= cols; i++) for (let j = 0; j <= rows; j++) {
        const x = -hw + w * i / cols, z = -dBack + (dFront + dBack) * j / rows; pos.push(x, fn(x, z), z);
      }
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { const q = i * (rows + 1) + j, r = q + rows + 1; idx.push(q, q + 1, r + 1, q, r + 1, r); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return paint(g, cfn);
    };
    const cTile = new THREE.Color(tile), cLight = new THREE.Color(tileLight), cMortar = new THREE.Color(mortar), cRafter = new THREE.Color(rafter);
    const top = grid((x, z) => shellY(x, z) + .045 * ripple(x, z), (x, y, z) => {
      const r = ripple(x, z), t = tAt(x, z).t;
      color.copy(cTile).lerp(cLight, r * .85);
      if (t > .965 && r > .55) color.lerp(cMortar, smooth(.965, .995, t) * smooth(.55, .9, r));
      return color;
    }, nx, nz);
    // Underside faces down: flip its winding. Rafter stripes along the slope.
    const under = grid((x, z) => shellY(x, z) - thickness, (x, y, z) => color.copy(cRafter).multiplyScalar(.78 + .22 * (.5 + .5 * Math.cos(2 * Math.PI * x / .21))), Math.round(nx / 2), Math.round(nz / 2));
    { const ix = under.index.array; for (let i = 0; i < ix.length; i += 3) { const a = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = a; } under.computeVertexNormals(); }
    // Eave band all round.
    const band = [], bandIdx = [], ring = [];
    const steps = nx;
    for (let i = 0; i <= steps; i++) ring.push([-hw + w * i / steps, dFront]);
    for (let j = 1; j <= nz; j++) ring.push([hw, dFront - (dFront + dBack) * j / nz]);
    for (let i = steps - 1; i >= 0; i--) ring.push([-hw + w * i / steps, -dBack]);
    for (let j = nz - 1; j >= 1; j--) ring.push([-hw, -dBack + (dFront + dBack) * j / nz]);
    ring.forEach(([x, z]) => { band.push(x, shellY(x, z) + .045 * ripple(x, z), z, x, shellY(x, z) - thickness, z); });
    for (let i = 0; i < ring.length; i++) { const a = i * 2, b = ((i + 1) % ring.length) * 2; bandIdx.push(a, a + 1, b, b, a + 1, b + 1); }
    const bandGeo = new THREE.BufferGeometry(); bandGeo.setAttribute('position', new THREE.Float32BufferAttribute(band, 3)); bandGeo.setIndex(bandIdx); bandGeo.computeVertexNormals();
    paint(bandGeo, edge);
    parts.push(top, under, bandGeo);
    // Ridge (용마루) with upturned ends, and the four hip ridges (내림마루) down to the corners.
    const rx = hw - hipLen, ridgeY = x => shellY(x, 0) + .06;
    const ridgePts = [];
    for (let i = 0; i <= 12; i++) { const x = -rx - .12 + (2 * rx + .24) * i / 12, end = smooth(.72, 1, Math.abs(x) / (rx + .12)); ridgePts.push([x, ridgeY(clamp(x, -rx, rx)) + end * .16, 0]); }
    parts.push(paint(tube(ridgePts, .075, 8, 28), edge), paint(tube(ridgePts.map(([x, y, z]) => [x, y - .06, z]), .082, 8, 28), mortar));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const pts = [];
      for (let i = 0; i <= 8; i++) { const s = i / 8, x = sx * (rx + hipLen * s * .98), z = sz * (sz > 0 ? dFront : dBack) * s * .98; pts.push([x, shellY(x, z) + .07 + s * s * .05, z]); }
      parts.push(paint(tube(pts, .05, 6, 14), edge));
    }
    return { geometry: mergeGeometries(parts), shellY, hipLen };
  }

  /** Collects pieces per material and merges them into one mesh each. */
  function batcher() {
    const lists = new Map();
    return {
      add(key, g) { if (!lists.has(key)) lists.set(key, []); lists.get(key).push(g); return g; },
      build(parent, materials, { cast = true, receive = true, name = 'diorama', noCast = [] } = {}) {
        const meshes = [];
        for (const [key, list] of lists) {
          const g = mergeGeometries(list); list.forEach(x => x.dispose());
          if (!g) throw new Error(`diorama: could not merge ${key}`);
          g.computeBoundingSphere();
          const mesh = new THREE.Mesh(g, materials[key]); mesh.name = `${name}-${key}`;
          mesh.castShadow = cast && !noCast.includes(key); mesh.receiveShadow = receive; parent.add(mesh); meshes.push(mesh);
        }
        lists.clear(); return meshes;
      },
    };
  }

  return { rng, noise, clamp, smooth, indexed, paint, place, grounded, softBox, cylinder, blob, slab, tube, hanokRoof, batcher, color: hex => new THREE.Color(hex) };
}
