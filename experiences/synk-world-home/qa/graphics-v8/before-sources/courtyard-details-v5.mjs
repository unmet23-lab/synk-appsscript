import * as THREE from './scene-assets/three.module.js';

// Close-range craft details. No extra lights, render targets or frame loop.
export function addCourtyardDetails(parent, materials) {
  const group = new THREE.Group(); group.name = 'courtyard-craft-v5'; parent.add(group);
  const place = (geometry, material, position) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); return mesh;
  };
  const profile = (points, material, position, segments = 32) => place(new THREE.LatheGeometry(points.map(p => new THREE.Vector2(...p)), segments), material, position);
  const batch = (geometry, material, entries) => {
    const mesh = new THREE.InstancedMesh(geometry, material, entries.length), dummy = new THREE.Object3D();
    entries.forEach((entry, index) => {
      dummy.position.set(...entry.p); dummy.rotation.set(...(entry.r || [0, 0, 0])); dummy.scale.set(...(entry.s || [1, 1, 1])); dummy.updateMatrix(); mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.castShadow = mesh.receiveShadow = true; mesh.computeBoundingSphere(); group.add(mesh); return mesh;
  };
  // Curtains have folds and a weighted hem, rather than a flat blue window.
  const fabric = new THREE.MeshPhysicalMaterial({ color: '#e3d9bf', roughness: .97, sheen: .65, sheenRoughness: .9, sheenColor: new THREE.Color('#f8ecd5'), side: THREE.DoubleSide, bumpMap: materials.linen.bumpMap, bumpScale: .004 });
  for (const side of [-1, 1]) {
    const geometry = new THREE.PlaneGeometry(.33, 1.42, 20, 10), p = geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), fold = Math.sin((x + .165) * Math.PI * 6 / .33);
      p.setXYZ(i, x * (1 + .11 * (1 - (y + .71) / 1.42)), y + .015 * Math.cos(x * 45), .035 * fold);
    }
    geometry.computeVertexNormals(); place(geometry, fabric, [-3.05 + side * .54, 1.32, -2.117]);
  }
  // Narrow divisions evoke timber joinery without filling the window with detail.
  batch(new THREE.BoxGeometry(1, 1, 1), materials.darkWood, [-.37, -.185, .185, .37].map(x => ({ p: [-3.05 + x, 1.80, -2.124], s: [.015, .60, .034] })));

  const weaveCanvas = document.createElement('canvas'); weaveCanvas.width = weaveCanvas.height = 256;
  const weaveContext = weaveCanvas.getContext('2d'); weaveContext.fillStyle = '#c9b68e'; weaveContext.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 4) for (let x = 0; x < 256; x += 4) {
    const crossing = (x / 4 + y / 4) % 2 === 0;
    weaveContext.fillStyle = crossing ? '#d7c8a7' : '#b4a17f'; weaveContext.fillRect(x, y, crossing ? 3 : 1, crossing ? 1 : 3);
    weaveContext.fillStyle = '#bba786'; weaveContext.fillRect(x + 3, y + 3, 1, 1);
  }
  const weave = new THREE.CanvasTexture(weaveCanvas); weave.colorSpace = THREE.SRGBColorSpace; weave.wrapS = weave.wrapT = THREE.RepeatWrapping; weave.repeat.set(2, 1);
  const linen = new THREE.MeshStandardMaterial({ color: '#fff9ea', map: weave, roughness: .98, bumpMap: materials.linen.bumpMap, bumpScale: .006 });
  const rug = place(new THREE.CircleGeometry(1, 64), linen, [-3.05, .325, -.25]); rug.rotation.x = -Math.PI / 2; rug.scale.set(1.02, .48, 1); rug.castShadow = false;
  const border = place(new THREE.TorusGeometry(1, .009, 4, 64), materials.linen, [-3.05, .329, -.25]); border.rotation.x = -Math.PI / 2; border.scale.set(1.00, .47, 1);
  const fringes = [];
  for (let i = 0; i < 42; i++) {
    const a = i / 42 * Math.PI * 2;
    fringes.push({ p: [-3.05 + Math.cos(a) * 1.04, .329, -.25 + Math.sin(a) * .49], r: [Math.PI / 2, 0, -a + Math.PI / 2], s: [.004, .046, .004] });
  }
  batch(new THREE.CylinderGeometry(1, 1, 1, 4), materials.linen, fringes);

  // Ribbed paper lantern: visible interior craft, deliberately no point-light cost.
  const paper = new THREE.MeshStandardMaterial({ color: '#f5e0b5', roughness: .88, emissive: '#e5a751', emissiveIntensity: .045 });
  const lanternPoints = [[.028, -.23], [.11, -.20], [.19, -.12], [.214, 0], [.19, .12], [.11, .20], [.028, .23]];
  profile(lanternPoints, paper, [-3.73, 2.38, -.52]);
  place(new THREE.CylinderGeometry(.005, .005, .33, 6), materials.metal, [-3.73, 2.78, -.52]);
  const ribs = [];
  for (let i = -6; i <= 6; i++) {
    const y = i * .031, r = .214 * Math.sqrt(Math.max(.1, 1 - (y / .23) ** 2));
    ribs.push({ p: [-3.73, 2.38 + y, -.52], r: [Math.PI / 2, 0, 0], s: [r, r, r] });
  }
  batch(new THREE.TorusGeometry(1, .013, 4, 28), materials.linen, ribs);

  // The close pot gets a real foot. Fine clay grain stays in its surface shader.
  profile([[.24, 0], [.25, .005], [.265, .022], [.28, .032], [.29, .041]], materials.terra, [1.98, .24, .35]);
  // Tiny page block and a glazed saucer make the table read as a lived-in place.
  place(new THREE.BoxGeometry(.214, .018, .17), fabric, [-1.55, .80, .50]).rotation.y = -.2;
  profile([[0, 0], [.095, 0], [.145, .004], [.16, .015], [.154, .024], [.11, .017], [0, .014]], materials.ceramic, [-1.765, .797, .61]);
  return { group, lantern: paper };
}
