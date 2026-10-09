// Explicit contract for this procedural study only. It is not an approved
// brand model, a finished rig or a GLB delivery contract.
function freezeTree(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeTree(child);
    Object.freeze(value);
  }
  return value;
}

export const KKAMONG_PROTOTYPE_V1 = freezeTree({
  id: 'kkamong-prototype-v1',
  version: 1,
  characterId: 'kkamong',
  status: 'procedural-prototype',
  approvedBrandModel: false,
  glbAvailable: false,
  coordinateSystem: { up: '+Y', front: '+Z', units: 'model units; not measured centimetres' },
  reference: 'docs/캐릭터/정본_4K/까몽_본체.png',
  body: { x: 0.73, y: 0.93, z: 0.57, centerY: 1.07 },
  standardPose: {
    id: 'front-rest-v1',
    position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
    eyeOpenScaleY: 1, frontPawRotationZ: 0, tailRotationY: 0,
  },
  attachments: {
    // Head is a reference anchor on the continuous body, not a separate head mesh.
    head: { position: [0, 1.94, -0.005], earOffsetX: 0.46, earRotationZ: 0.18 },
    neck: { position: [0, 1.01, 0], radii: [0.715, 0.59], collarWaveY: 0.025 },
    waist: { position: [0, 0.96, 0], radii: [0.737, 0.585] },
    frontPaws: {
      left: { position: [-0.63, 1.10, -0.04], side: -1 },
      right: { position: [0.63, 1.10, -0.04], side: 1 },
    },
  },
  face: { eyeOffsetX: 0.255, eyeY: 1.36, eyeZ: 0.533, irisRadius: 0.115, pupilRadius: 0.080 },
  costumeCompatibility: {
    bodyContract: 'kkamong-prototype-v1',
    mode: 'one-complete-costume-at-a-time',
    modularMixing: false,
    costumes: {
      none: { wardrobeId: 'kkamong-basic', anchors: [], bodyFur: 'full' },
      scarf: { wardrobeId: 'kkamong-scarf', anchors: ['neck'], bodyFur: 'full' },
      apron: { wardrobeId: 'kkamong-apron', anchors: ['waist', 'neck'], bodyFur: 'hide-covered-panel-and-straps' },
    },
  },
  // Values match the existing WORLD/native wardrobe catalogue. This does not
  // change wardrobe persistence, available items or the default lab backdrop.
  backgrounds: { paper: '#FFFFFF', night: '#242943', lapis: '#DDEAF6' },
});

/** Exact supported wardrobe ID -> renderer costume; unsupported IDs stay null. */
export function resolveWardrobeCostume(wardrobeId) {
  if (typeof wardrobeId !== 'string') return null;
  for (const [costume, entry] of Object.entries(KKAMONG_PROTOTYPE_V1.costumeCompatibility.costumes)) {
    if (entry.wardrobeId === wardrobeId) return costume;
  }
  return null;
}
