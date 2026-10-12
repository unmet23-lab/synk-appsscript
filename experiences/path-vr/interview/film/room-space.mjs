/** Seated camera-projected set extension. Original people stay on mono video;
 * large head translations still expose the source's missing parallax. */
export const ROOM_SPACE = Object.freeze({
  // Rays through the photographed back-wall/ceiling corners give width 4.53m
  // and a back wall about 4.12m ahead at this 1.18m seated eye height.
  eyeHeight: 1.18, width: 4.53, height: 2.68, front: -4.12, back: 2.5,
  // A full desk reaches the interviewers instead of ending below the frame.
  // The folded lower film surface keeps photographed cups above this desk.
  table: Object.freeze({ width: 3.5, depth: 1.70, height: .735, centerZ: -1.20 }),
  film: Object.freeze({ width: 2.82, height: 2.82 * 9 / 16, centerY: -.14, distance: 1.79, edgeFeather: .012 }),
  extension: Object.freeze({
    // Normalized UV with lower-left origin. Calibrate against the actual asset.
    sourceRect: Object.freeze({ x: .110707, y: .110369, width: .780405, height: .780405 }),
    wideSourceRect: Object.freeze({ x: .243174, y: .201080, width: .497463, height: .497463 }),
    asset: 'room/front-room-extension-4k.jpg', wideAsset: 'room/front-room-wide-4k.jpg', referenceBorder: .025,
  }),
  sides: Object.freeze({
    // The joins follow the first photograph's outer vertical window mullion
    // and the empty panel beyond the door. Parent can fine-tune the elevation
    // registration without changing the original people/video projection.
    left: Object.freeze({ asset: 'room/left-wall-detail-4k.jpg', joinZ: -2.60, joinWidth: .035, offsetU: .06022, scaleU: .93978, wideCeilingLine: Object.freeze({ slope: -1.197747821, intercept: 1.042846792 }) }),
    right: Object.freeze({ asset: 'room/right-wall-detail-4k.jpg', joinZ: -2.80, joinWidth: .035, offsetU: .09074, scaleU: .90926, wideCeilingLine: Object.freeze({ slope: 1.362664516, intercept: -.215706283 }) }),
  }),
  ceiling: Object.freeze({ asset: 'room/ceiling-detail-4k.jpg' }),
  // A small fixed linear-light balance brings the reconstructed fabric back
  // to the subdued greige of the filmed room. Never grade the live people.
  wallBalance: Object.freeze([.98, .97, .93]),
  source: Object.freeze({ projection: 'rectilinear-mono', stereo: false, environment: 'front-projection-with-surface-registered-photographs' }),
});

export function roomPlacement(settings = ROOM_SPACE) {
  return {
    floorY: -settings.eyeHeight, ceilingY: settings.height - settings.eyeHeight,
    tableY: settings.table.height - settings.eyeHeight,
    tableNearZ: settings.table.centerZ + settings.table.depth / 2,
    tableFarZ: settings.table.centerZ - settings.table.depth / 2,
    filmBottomY: settings.film.centerY - settings.film.height / 2,
    filmTopY: settings.film.centerY + settings.film.height / 2,
    horizontalFovDegrees: 2 * Math.atan(settings.film.width / (2 * settings.film.distance)) * 180 / Math.PI,
  };
}

/** Same off-axis pinhole calculation as the shader, shared by every surface. */
export function projectRoomPoint({ x, y, z }, settings = ROOM_SPACE) {
  const q = -z;
  if (!(q > 0)) return null;
  const film = settings.film, rect = settings.extension.sourceRect;
  const u = .5 + film.distance * x / (q * film.width);
  const v = .5 + (film.distance * y / q - film.centerY) / film.height;
  return { film: { u, v }, extension: { u: rect.x + u * rect.width, v: rect.y + v * rect.height }, depth: q };
}

/** Image x=0 means interviewer end of either wall; x=1 means applicant rear.
 * UVs belong to the physical surface, never the moving viewer/camera. */
export function sideWallUv({ y, z }, side = 'left', settings = ROOM_SPACE) {
  const registration = settings.sides[side];
  if (!registration) throw new TypeError('Unknown room side');
  const elevationV = (y + settings.eyeHeight) / settings.height;
  return {
    u: registration.offsetU + (z - settings.front) / (settings.back - settings.front) * registration.scaleU,
    v: side === 'left' ? registeredWindowV(elevationV) : elevationV,
  };
}

/** The dedicated ceiling photograph is a full orthographic physical plane.
 * Image top is the interviewer end; image left is the window wall. */
export function ceilingSurfaceUv({ x, z }, settings = ROOM_SPACE) {
  return {
    u: x / settings.width + .5,
    v: 1 - (z - settings.front) / (settings.back - settings.front),
  };
}

/** Wide-plate ceiling/wall edges derived from its registered ceiling corners.
 * The small photo-space feather excludes ceiling pixels from a side wall. */
export function wideWallCoverage({ u, v }, side, settings = ROOM_SPACE) {
  const line = settings.sides[side]?.wideCeilingLine;
  if (!line) return 1;
  const edgeV = line.intercept + line.slope * u;
  const t = Math.min(1, Math.max(0, (v - (edgeV - .004)) / .005));
  return 1 - t * t * (3 - 2 * t);
}

/** Sill and blind-bottom heights measured at the photographed front mullion.
 * All positions are on the wall, so the registration stays fixed during yaw. */
export function registeredWindowV(v) {
  if (v < .322) return v * .329 / .322;
  if (v < .584) return .329 + (v - .322) * (.562 - .329) / (.584 - .322);
  return .562 + (v - .584) * (1 - .562) / (1 - .584);
}

/** Fold only the photographed tabletop along its original camera rays.
 * Its cups/papers sit just above the physical desk while faces stay untouched.
 * Perspective from the seated origin is identical; depth testing stays on. */
export function filmSurfacePoint(u, v, settings = ROOM_SPACE) {
  const f = settings.film, x = (u - .5) * f.width, y = f.centerY + (v - .5) * f.height;
  const supportY = settings.table.height - settings.eyeHeight + .009;
  const scale = y < supportY ? supportY / y : 1;
  return { x: x * scale, y: y * scale, z: -f.distance * scale };
}

function photographMaterial(THREE, texture, { video = false, stabilizeBackground = video, referenceUniform, referenceReady } = {}) {
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: true, depthWrite: false, toneMapped: false });
  material.userData.originalFilm = video;
  material.onBeforeCompile = (shader) => {
    if (stabilizeBackground) { shader.uniforms.filmReference = referenceUniform; shader.uniforms.filmReferenceReady = referenceReady; }
    shader.vertexShader = `varying vec3 vFilmPosition;\n${shader.vertexShader}`.replace('#include <begin_vertex>', `#include <begin_vertex>\nvFilmPosition = position + vec3(0.0, ${ROOM_SPACE.film.centerY}, -${ROOM_SPACE.film.distance});`);
    // The folded tabletop cannot interpolate the original texture UVs across
    // wide triangles: that shears cups and papers at every row. Reproject the
    // physical fragment position instead; this is exact at any tessellation.
    shader.fragmentShader = `varying vec3 vFilmPosition;\n${shader.fragmentShader}`.replace('#include <map_fragment>', `
      float filmQ = max(0.1, -vFilmPosition.z);
      vec2 vFilmUv = vec2(0.5 + ${ROOM_SPACE.film.distance / ROOM_SPACE.film.width} * vFilmPosition.x / filmQ, ${.5 - ROOM_SPACE.film.centerY / ROOM_SPACE.film.height} + ${ROOM_SPACE.film.distance / ROOM_SPACE.film.height} * vFilmPosition.y / filmQ);
      ${THREE.ShaderChunk.map_fragment.replaceAll('vMapUv', 'vFilmUv')}
      // SYNK_FILM_LIVE_REFERENCE
    `).replace('#include <alphatest_fragment>', `
      // Matching reference pixels behind the narrow border replace the old
      // broad fade into a flat wall. Faces, hands and glasses remain opaque.
      // Empty foreground wood needs a wider lateral join for the photographed
      // window reflections. Keep arm/hand rows at the narrow original border.
      float foregroundWood = 1.0 - smoothstep(0.245, 0.30, vFilmUv.y);
      float sideFeather = mix(${ROOM_SPACE.film.edgeFeather}, 0.10, foregroundWood);
      float side = smoothstep(0.0, sideFeather, vFilmUv.x) * smoothstep(0.0, sideFeather, 1.0 - vFilmUv.x);
      float top = smoothstep(0.0, 0.015, 1.0 - vFilmUv.y);
      // Only bare wood fades into the real tabletop. The bottom-most cup,
      // paper and pen pixels are above .245 and stay fully opaque.
      float deskJoin = smoothstep(0.14, 0.235, vFilmUv.y);
      diffuseColor.a *= side * top * deskJoin;
      #include <alphatest_fragment>
    `);
  };
  const edgeCompile = material.onBeforeCompile;
  if (stabilizeBackground) material.onBeforeCompile = (shader) => {
    edgeCompile(shader);
    shader.fragmentShader = `uniform sampler2D filmReference;\nuniform float filmReferenceReady;\n${shader.fragmentShader}`.replace('// SYNK_FILM_LIVE_REFERENCE', `
      // Keep people, cups and papers live. Only outer architecture and empty
      // wood blend into the registered reference; never replace a failed clip.
      // A shoulder-to-elbow envelope preserves the moving coats and hands,
      // while the window and door above the arms stay registered and still.
      float armFlare = 1.0 - smoothstep(0.32, 0.66, vFilmUv.y);
      float leftBody = mix(0.145, 0.018, armFlare);
      float rightBody = mix(0.895, 0.963, armFlare);
      float livingArea = smoothstep(leftBody - 0.025, leftBody, vFilmUv.x) * (1.0 - smoothstep(rightBody, rightBody + 0.022, vFilmUv.x));
      livingArea *= (1.0 - smoothstep(0.855, 0.965, vFilmUv.y)) * smoothstep(0.14, 0.235, vFilmUv.y);
      if (filmReferenceReady > 0.5) diffuseColor.rgb = mix(texture2D(filmReference, vFilmUv).rgb, diffuseColor.rgb, livingArea);
    `);
  };
  material.customProgramCacheKey = () => `synk-room-matched-film-border-v7-${stabilizeBackground}`;
  return material;
}

export async function createInterviewSpace(THREE, { parent, loadTexture, maxAnisotropy = 4 } = {}) {
  if (!parent?.add) throw new TypeError('면접 공간을 연결할 장면이 필요합니다.');
  const load = loadTexture || ((url) => new THREE.TextureLoader().loadAsync(url));
  const group = new THREE.Group(); group.name = 'seated-interview-space'; parent.add(group);
  const resources = new Set(), geometries = new Set(), videoTextures = new Map(), projectedMaterials = [];
  const placement = roomPlacement(), register = (resource) => { resources.add(resource); return resource; };
  const basic = (color) => register(new THREE.MeshBasicMaterial({ color, toneMapped: false }));
  const material = (color, roughness = .85) => register(new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 }));
  const sourceUniform = { value: null }, sourceReady = { value: 0 }, wideUniform = { value: null }, wideReady = { value: 0 };
  const frontUniform = { value: null }, frontReady = { value: 0 }, rearUniform = { value: null }, rearReady = { value: 0 };
  const deskUniform = { value: null }, deskReady = { value: 0 }, staticTextures = [];
  const ceilingUniform = { value: null }, ceilingReady = { value: 0 };
  const sideUniforms = { left: { value: null }, right: { value: null } }, sideReady = { left: { value: 0 }, right: { value: 0 } };
  const rect = ROOM_SPACE.extension.sourceRect, wideRect = ROOM_SPACE.extension.wideSourceRect, film = ROOM_SPACE.film;
  function projectedMaterial(fallback, surface = 'front') {
    const result = basic(fallback), side = ROOM_SPACE.sides[surface];
    result.userData = { cameraProjected: true, surface, mapping: side ? 'physical-wall-uv' : ['ceiling', 'floor', 'table'].includes(surface) ? 'physical-plane-uv' : 'bounded-front-projection' };
    result.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, {
        roomReference: sourceUniform, roomReferenceReady: sourceReady,
        roomFront: frontUniform, roomFrontReady: frontReady,
        roomWide: wideUniform, roomWideReady: wideReady,
        roomRear: rearUniform, roomRearReady: rearReady,
        roomDesk: deskUniform, roomDeskReady: deskReady,
        roomCeiling: ceilingUniform, roomCeilingReady: ceilingReady,
        roomSide: side ? sideUniforms[surface] : sourceUniform,
        roomSideReady: side ? sideReady[surface] : { value: 0 },
        roomSourceRect: { value: new THREE.Vector4(rect.x, rect.y, rect.width, rect.height) },
        roomWideRect: { value: new THREE.Vector4(wideRect.x, wideRect.y, wideRect.width, wideRect.height) },
        roomFallback: { value: new THREE.Color(fallback) },
      });
      shader.vertexShader = `attribute vec3 roomPosition;\nvarying vec3 vRoomPosition;\n${shader.vertexShader}`.replace('#include <begin_vertex>', '#include <begin_vertex>\nvRoomPosition = roomPosition;');
      const declarations = `varying vec3 vRoomPosition;
        uniform sampler2D roomReference, roomFront, roomWide, roomRear, roomSide, roomDesk, roomCeiling;
        uniform float roomReferenceReady, roomFrontReady, roomWideReady, roomRearReady, roomSideReady, roomDeskReady, roomCeilingReady;
        uniform vec4 roomSourceRect, roomWideRect;
        uniform vec3 roomFallback;
        float roomPhotoCoverage(vec2 uv) {
          float edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
          return smoothstep(0.0, 0.012, edge);
        }
      `;
      const surfaceBase = side ? `
        vec2 wallUv = vec2(${side.offsetU} + (vRoomPosition.z - ${ROOM_SPACE.front}) / ${ROOM_SPACE.back - ROOM_SPACE.front} * ${side.scaleU}, (vRoomPosition.y + ${ROOM_SPACE.eyeHeight}) / ${ROOM_SPACE.height});
        ${surface === 'left' ? `if (wallUv.y < .322) wallUv.y *= .329 / .322;
        else if (wallUv.y < .584) wallUv.y = .329 + (wallUv.y - .322) * (.562 - .329) / (.584 - .322);
        else wallUv.y = .562 + (wallUv.y - .584) * (1.0 - .562) / (1.0 - .584);` : ''}
        if (roomSideReady > 0.5) surfaceColor = texture2D(roomSide, wallUv).rgb${surface === 'right' ? ` * vec3(${ROOM_SPACE.wallBalance.join(', ')})` : ''};
        // This is a 3.5cm join at a real upright feature, not an image border
        // extrapolation. Side/rear rays never enter the pinhole division.
        frontAmount = 1.0 - smoothstep(${side.joinZ - side.joinWidth / 2}, ${side.joinZ + side.joinWidth / 2}, vRoomPosition.z);
      ` : surface === 'ceiling' ? `
        vec2 planeUv = vec2(vRoomPosition.x / ${ROOM_SPACE.width} + 0.5, (vRoomPosition.z - ${ROOM_SPACE.front}) / ${ROOM_SPACE.back - ROOM_SPACE.front});
        if (roomCeilingReady > 0.5) {
          // Same physical coordinates as ceilingSurfaceUv: no camera-ray
          // division, stretched source crop, or repeated overhead fixtures.
          surfaceColor = texture2D(roomCeiling, vec2(planeUv.x, 1.0 - planeUv.y)).rgb;
        } else if (roomWideReady > 0.5) {
          // Keep the registered wide photograph as an independent fallback.
          // Its denominator stays >= .49, including behind the seated origin.
          mat3 ceilingRectification = mat3(.464644692, .048599215, .048745452, -.248411313, -.229489725, -.505370336, .267344500, .722635500, 1.0);
          vec3 ceilingPoint = ceilingRectification * vec3(planeUv, 1.0);
          surfaceColor = texture2D(roomWide, ceilingPoint.xy / ceilingPoint.z).rgb;
        }
        frontAmount = 0.0;
      ` : surface === 'floor' ? `
        vec2 planeUv = vec2(vRoomPosition.x / ${ROOM_SPACE.width} + 0.5, (vRoomPosition.z - ${ROOM_SPACE.front}) / ${ROOM_SPACE.back - ROOM_SPACE.front});
        // This crop is entirely carpet, below the rear cabinet and skirting.
        // Its 2:1 source makes the crop 9.8:1. Repeat at that physical aspect
        // rather than stretching a narrow strip over the whole room depth.
        // Mirrored repetitions share their boundary pixels without a hard seam.
        float carpetV = 1.0 - abs(1.0 - mod(planeUv.y * ${(ROOM_SPACE.back - ROOM_SPACE.front) / ROOM_SPACE.width * 9.8}, 2.0));
        if (roomRearReady > 0.5) surfaceColor = texture2D(roomRear, vec2(planeUv.x, carpetV)).rgb;
        frontAmount = 0.0;
      ` : surface === 'table' ? `
        vec2 planeUv = vec2(vRoomPosition.x / ${ROOM_SPACE.table.width} + 0.5, (vRoomPosition.z - ${placement.tableFarZ}) / ${ROOM_SPACE.table.depth});
        // Photograph only the empty wood strip, never windows or people.
        // UVs remain attached to this 1.70m physical top when looking sideways.
        if (roomDeskReady > 0.5) surfaceColor = texture2D(roomDesk, vec2(planeUv.x, 1.0 - planeUv.y)).rgb;
        frontAmount = 0.0;
      ` : '';
      shader.fragmentShader = declarations + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
        vec3 surfaceColor = roomFallback;
        float frontAmount = 1.0;
        ${surfaceBase}
        // No clamped-edge photograph is used outside its photographed area.
        // In particular, yaw +/-90 and the whole rear half use wall/plane UVs.
        float q = -vRoomPosition.z;
        if (frontAmount > 0.0 && q > 0.10 && roomFrontReady > 0.5) {
          vec2 sourceUv = vec2(0.5 + ${film.distance / film.width} * vRoomPosition.x / q, ${.5 - film.centerY / film.height} + ${film.distance / film.height} * vRoomPosition.y / q);
          vec2 extendedUv = roomSourceRect.xy + sourceUv * roomSourceRect.zw;
          float innerCoverage = roomPhotoCoverage(extendedUv);
          vec3 projectedColor = surfaceColor;
          float coverage = 0.0;
          if (roomWideReady > 0.5) {
            vec2 wideUv = roomWideRect.xy + sourceUv * roomWideRect.zw;
            float rightWall = smoothstep(0.77, 0.88, extendedUv.x) * smoothstep(0.28, 0.32, extendedUv.y);
            wideUv += vec2(0.043, 0.041) * rightWall;
            float wideCoverage = roomPhotoCoverage(wideUv);
            ${side ? `// Do not project the wide photograph's ceiling onto a wall.
            // The independent wall elevation owns pixels above this boundary.
            float wideCeilingV = ${side.wideCeilingLine.intercept} + ${side.wideCeilingLine.slope} * wideUv.x;
            wideCoverage *= 1.0 - smoothstep(wideCeilingV - 0.004, wideCeilingV + 0.001, wideUv.y);` : ''}
            if (wideCoverage > 0.0) {
              projectedColor = texture2D(roomWide, wideUv).rgb;
              coverage = wideCoverage;
            }
          }
          if (innerCoverage > 0.0) {
            projectedColor = mix(projectedColor, texture2D(roomFront, extendedUv).rgb, innerCoverage);
            coverage = max(coverage, innerCoverage);
          }
          float sourceEdge = min(min(sourceUv.x, 1.0 - sourceUv.x), min(sourceUv.y, 1.0 - sourceUv.y));
          if (sourceEdge >= 0.0) {
            vec3 wallOnly = roomFallback;
            if (roomReferenceReady > 0.5) wallOnly = texture2D(roomReference, vec2(0.48, 0.94)).rgb;
            float safeBorder = 1.0 - smoothstep(${ROOM_SPACE.extension.referenceBorder}, ${ROOM_SPACE.extension.referenceBorder + .012}, sourceEdge);
            projectedColor = wallOnly;
            if (roomReferenceReady > 0.5) projectedColor = mix(wallOnly, texture2D(roomReference, sourceUv).rgb, safeBorder);
          }
          // Photographed wood belongs to the desk, never to a wall below it.
          // The solid full-depth desk now occludes this lower architecture.
          frontAmount *= smoothstep(.22, .30, sourceUv.y);
          surfaceColor = mix(surfaceColor, projectedColor, coverage * frontAmount);
        }
        diffuseColor.rgb = surfaceColor;
      `);
    };
    result.customProgramCacheKey = () => `synk-physical-room-surfaces-v6-${surface}`;
    projectedMaterials.push(result); return result;
  }
  const plaster = projectedMaterial('#b9bab0'), ceiling = projectedMaterial('#c6c9c0', 'ceiling'), carpet = projectedMaterial('#92928c', 'floor');
  const leftWall = projectedMaterial('#b9bab0', 'left'), rightWall = projectedMaterial('#b9bab0', 'right');
  const tableWood = projectedMaterial('#b79c79', 'table'), rearPlaster = basic('#b9bab0');
  const steel = material('#323632', .68), fabric = material('#454944');
  function box(name, size, position, mat, root = group) {
    const geometry = new THREE.BoxGeometry(...size); geometries.add(geometry);
    if (mat.userData.cameraProjected) {
      const vertices = geometry.attributes.position, projected = new Float32Array(vertices.count * 3);
      for (let i = 0; i < vertices.count; i++) { projected[i * 3] = vertices.getX(i) + position[0]; projected[i * 3 + 1] = vertices.getY(i) + position[1]; projected[i * 3 + 2] = vertices.getZ(i) + position[2]; }
      geometry.setAttribute('roomPosition', new THREE.BufferAttribute(projected, 3));
    }
    const mesh = new THREE.Mesh(geometry, mat); mesh.name = name; mesh.position.set(...position); root.add(mesh); return mesh;
  }
  const roomCenterZ = (ROOM_SPACE.front + ROOM_SPACE.back) / 2, roomDepth = ROOM_SPACE.back - ROOM_SPACE.front;
  box('floor', [ROOM_SPACE.width, .10, roomDepth], [0, placement.floorY - .05, roomCenterZ], carpet);
  box('ceiling', [ROOM_SPACE.width, .10, roomDepth], [0, placement.ceilingY + .05, roomCenterZ], ceiling);
  box('front-wall', [ROOM_SPACE.width, ROOM_SPACE.height, .10], [0, (placement.floorY + placement.ceilingY) / 2, ROOM_SPACE.front - .05], plaster);
  box('back-wall', [ROOM_SPACE.width, ROOM_SPACE.height, .10], [0, (placement.floorY + placement.ceilingY) / 2, ROOM_SPACE.back + .05], rearPlaster);
  box('right-wall', [.10, ROOM_SPACE.height, roomDepth], [ROOM_SPACE.width / 2 + .05, (placement.floorY + placement.ceilingY) / 2, roomCenterZ], rightWall);
  box('left-wall', [.10, ROOM_SPACE.height, roomDepth], [-ROOM_SPACE.width / 2 - .05, (placement.floorY + placement.ceilingY) / 2, roomCenterZ], leftWall);
  // Blinds, frames and front door are already photographed in their positions.
  // Guessed duplicate geometry would create a second window/door at the seam.
  const table = box('interview-table', [ROOM_SPACE.table.width, .055, ROOM_SPACE.table.depth], [0, placement.tableY - .0275, ROOM_SPACE.table.centerZ], tableWood);
  table.userData.realDepth = true;
  for (const x of [-1.45, 1.45]) {
    box('table-leg', [.058, .68, .38], [x, placement.floorY + .34, ROOM_SPACE.table.centerZ], steel);
    box('table-foot', [.40, .027, .46], [x, placement.floorY + .0135, ROOM_SPACE.table.centerZ], steel);
  }
  const chair = new THREE.Group(); chair.name = 'applicant-chair'; chair.position.set(0, placement.floorY, .30); group.add(chair);
  box('chair-seat', [.48, .075, .46], [0, .45, 0], fabric, chair);
  const chairBack = box('chair-back', [.46, .43, .05], [0, .69, .25], fabric, chair); chairBack.rotation.x = -.08;
  for (const x of [-.20, .20]) for (const z of [-.16, .20]) box('chair-leg', [.025, .42, .025], [x, .21, z], steel, chair);
  group.add(new THREE.HemisphereLight(0xeaf0ed, 0x60584b, 2.05));
  const photoGeometry = new THREE.PlaneGeometry(film.width, film.height, 1, 64); geometries.add(photoGeometry);
  const filmPositions = photoGeometry.attributes.position, filmUv = photoGeometry.attributes.uv;
  for (let i = 0; i < filmPositions.count; i++) {
    const point = filmSurfacePoint(filmUv.getX(i), filmUv.getY(i));
    filmPositions.setXYZ(i, point.x, point.y - film.centerY, point.z + film.distance);
  }
  photoGeometry.computeBoundingBox(); photoGeometry.computeBoundingSphere();
  // The poster is the actual question's first frame. Its border uses the same
  // registered architecture as live video, so starting cannot swap the room.
  const reference = new THREE.Mesh(photoGeometry, register(photographMaterial(THREE, null, { stabilizeBackground: true, referenceUniform: sourceUniform, referenceReady: sourceReady }))); reference.name = 'pre-start-reference';
  reference.position.set(0, film.centerY, -film.distance); reference.renderOrder = 1; reference.visible = false; group.add(reference);
  const layers = [0, 1].map((index) => {
    const mesh = new THREE.Mesh(photoGeometry, register(photographMaterial(THREE, null, { video: true, referenceUniform: sourceUniform, referenceReady: sourceReady })));
    mesh.name = `original-film-layer-${index}`; mesh.position.set(0, film.centerY, -film.distance); mesh.renderOrder = index + 2; mesh.visible = false; group.add(mesh); return mesh;
  });
  async function texture(path) {
    const result = await load(new URL(`../../assets/interview/${path}`, import.meta.url).href);
    result.colorSpace = THREE.SRGBColorSpace; result.anisotropy = Math.min(4, maxAnisotropy);
    result.minFilter = THREE.LinearMipmapLinearFilter; result.magFilter = THREE.LinearFilter;
    result.generateMipmaps = true; resources.add(result); staticTextures.push(result); return result;
  }
  let rearPhotoReady = false, extensionReady = false;
  const assetPaths = ['film/room-reference-4k.jpg', 'room/carpet-4k.jpg', ROOM_SPACE.extension.asset, ROOM_SPACE.extension.wideAsset, ROOM_SPACE.sides.left.asset, ROOM_SPACE.sides.right.asset, 'room/back-wall-detail-4k.jpg', 'film/room-poster-4k.jpg', 'room/desk-4k.jpg', ROOM_SPACE.ceiling.asset];
  const loaded = await Promise.allSettled([
    texture(assetPaths[0]).then((t) => { sourceUniform.value = t; sourceReady.value = 1; }),
    texture(assetPaths[1]).then((t) => {
      rearUniform.value = t; rearReady.value = 1;
    }),
    texture(assetPaths[2]).then((t) => { frontUniform.value = t; frontReady.value = 1; for (const mat of projectedMaterials) { mat.map = t; mat.color.set('#ffffff'); mat.needsUpdate = true; } extensionReady = true; }),
    texture(assetPaths[3]).then((t) => { wideUniform.value = t; wideReady.value = 1; }),
    texture(assetPaths[4]).then((t) => { sideUniforms.left.value = t; sideReady.left.value = 1; }),
    texture(assetPaths[5]).then((t) => { sideUniforms.right.value = t; sideReady.right.value = 1; }),
    texture(assetPaths[6]).then((t) => {
      const rearMaterial = register(new THREE.MeshBasicMaterial({ map: t, toneMapped: false }));
      rearMaterial.color.setRGB(...ROOM_SPACE.wallBalance);
      const rearGeometry = new THREE.PlaneGeometry(ROOM_SPACE.width, ROOM_SPACE.height); geometries.add(rearGeometry);
      const rear = new THREE.Mesh(rearGeometry, rearMaterial); rear.name = 'back-wall-photo';
      rear.position.set(0, (placement.floorY + placement.ceilingY) / 2, ROOM_SPACE.back - .008); rear.rotation.y = Math.PI;
      rear.userData = { projection: 'orthographic-wall-elevation', stereo: false, cabinetDepth: false, fixedSurfaceUv: true }; group.add(rear); rearPhotoReady = true;
    }),
    texture(assetPaths[7]).then((t) => { reference.material.map = t; reference.material.needsUpdate = true; }),
    texture(assetPaths[8]).then((t) => { deskUniform.value = t; deskReady.value = 1; }),
    texture(assetPaths[9]).then((t) => { ceilingUniform.value = t; ceilingReady.value = 1; }),
  ]);
  const missingAssets = loaded.flatMap((result, index) => result.status === 'rejected' ? [assetPaths[index]] : []);
  let disposed = false, videoWarmupRevision = 0;
  function videoTexture(video) {
    if (!videoTextures.has(video)) {
      const texture = new THREE.VideoTexture(video);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = texture.magFilter = THREE.LinearFilter;
      // Preview can first open (or reopen) after pause/completion. The decoded
      // frame already exists, so a new RVFC may never arrive. Upload that frame
      // on the first render; later frames keep Three's normal callback updates.
      if (video.readyState >= 2) texture.needsUpdate = true;
      videoTextures.set(video, texture);
    }
    return videoTextures.get(video);
  }
  function bindVideoTexture(mesh, texture) {
    if (mesh.material.map !== texture) { mesh.material.map = texture; mesh.material.needsUpdate = true; }
  }
  return {
    group, placement, source: { ...ROOM_SPACE.source, frontRoom: extensionReady ? 'single-calibrated-camera-projection' : 'neutral-geometry-fallback', wideExtension: extensionReady && wideReady.value === 1, sideWalls: { left: sideReady.left.value ? 'physical-wall-uv' : 'neutral-geometry-fallback', right: sideReady.right.value ? 'physical-wall-uv' : 'neutral-geometry-fallback' }, ceiling: ceilingReady.value ? 'dedicated-photo-on-physical-plane' : wideReady.value ? 'rectified-photo-on-physical-plane' : 'neutral-geometry-fallback', floor: rearReady.value ? 'carpet-photo-on-physical-plane' : 'neutral-geometry-fallback', rearWall: rearPhotoReady ? 'generated-rectilinear-photo-on-wall' : 'geometry', rearWallStereo: false, rearCabinetDepth: false }, missingAssets,
    async warmTextures(renderer) {
      // Upload the large static photographs before immersive rendering starts.
      // Yield between uploads instead of stalling a tracked XR frame on all 10.
      for (const t of staticTextures) {
        if (disposed) return;
        renderer.initTexture(t);
        if (typeof requestAnimationFrame === 'function') await new Promise(requestAnimationFrame);
      }
    },
    async warmVideoFrames(renderer, frames = []) {
      // prepare() has already verified actual decoded frames. Upload these
      // while both layers are still hidden, rather than on the first visible
      // tracked frame. The stage can then compile the real VideoTexture shader.
      if (disposed) return false;
      const revision = ++videoWarmupRevision;
      const prepared = frames.slice(0, 2).flatMap((entry, index) => {
        const video = entry?.video;
        if (!video || video.readyState < 2) return [];
        const texture = videoTexture(video);
        bindVideoTexture(layers[index], texture);
        return [{ video, texture, source: video.currentSrc || video.src || '' }];
      });
      if (!prepared.length) return false;
      const current = () => !disposed && revision === videoWarmupRevision && prepared.every(({ video, texture, source }) =>
        videoTextures.get(video) === texture && video.readyState >= 2 && (video.currentSrc || video.src || '') === source);
      for (const { texture } of prepared) {
        if (!current()) return false;
        // A paused, already decoded video need not fire another video-frame
        // callback after the VideoTexture is created. Mark this frame explicitly.
        texture.needsUpdate = true;
        renderer.initTexture(texture);
        if (typeof requestAnimationFrame === 'function') await new Promise(requestAnimationFrame);
      }
      return current();
    },
    update(frames = [], state = {}) {
      if (disposed) return;
      const entries = frames.slice(0, 2), videos = new Set(entries.map((entry) => entry?.video).filter(Boolean));
      for (const [video, t] of videoTextures) if (!videos.has(video)) { videoWarmupRevision++; t.dispose(); videoTextures.delete(video); }
      const hasActiveFilm = entries.some((entry) => entry?.video?.readyState >= 2 && entry.opacity > 0);
      // Changing quality after completion clears the old film buffers. Keep
      // the seated people visible while waiting for the next interview, without
      // replacing an active performance or disguising a playback error.
      reference.visible = !hasActiveFilm && ['idle', 'preparing', 'complete'].includes(state.phase) && !!reference.material.map;
      layers.forEach((mesh, index) => {
        const entry = entries[index], video = entry?.video;
        mesh.visible = !!video && video.readyState >= 2 && entry.opacity > 0;
        if (!mesh.visible) return;
        bindVideoTexture(mesh, videoTexture(video));
        mesh.material.opacity = Math.min(1, Math.max(0, Number(entry.opacity) || 0));
      });
    },
    dispose() {
      if (disposed) return; disposed = true; videoWarmupRevision++;
      videoTextures.forEach((t) => t.dispose()); videoTextures.clear(); resources.forEach((r) => r.dispose()); geometries.forEach((g) => g.dispose()); parent.remove(group);
    },
  };
}
