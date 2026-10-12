import { GLTFLoader } from '../vendor/GLTFLoader.js';

// MIT Microsoft Rocketbox subset. See assets/interview/actors/manifest.json.
// Eyes/lips are mesh morphs; head and arms use the original skeleton.
// Mouth motion follows the speech envelope, not phoneme-accurate lip sync.
export const INTERVIEW_ACTOR_MODELS = Object.freeze([
  { id: 'lead', file: 'Business_Male_02.glb', scale: .94 },
  { id: 'specialist', file: 'Business_Female_03.glb', scale: 1 },
  { id: 'observer', file: 'Business_Male_03.glb', scale: .94 },
]);
export const DEFAULT_INTERVIEW_SEATS = Object.freeze([
  { x: 0, y: 0, z: -1.35 }, { x: -1.4, y: 0, z: -1.35 }, { x: 1.4, y: 0, z: -1.35 },
]);

/**
 * Three r180; no CDN or runtime asset generation. y is the floor offset, not
 * chair-seat height. Local +Z is the face direction. Camera is in world space.
 * update(timeSeconds, {speaker:0|'lead', speaking, listening, amplitude, phase}, cameraPosition)
 * also accepts speakerId; amplitude 0..1 can come from an audio analyser.
 */
export async function createInterviewActors(THREE, scene, { seats = DEFAULT_INTERVIEW_SEATS, onProgress = () => {} } = {}) {
  const loader = new GLTFLoader();
  const actors = [];
  const base = new URL('../assets/interview/actors/', import.meta.url);
  const up = new THREE.Vector3(0, 1, 0), right = new THREE.Vector3(1, 0, 0);
  const q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), q3 = new THREE.Quaternion();
  const beforeHand = new THREE.Quaternion(), afterHand = new THREE.Quaternion();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const d = new THREE.Vector3(), e = new THREE.Vector3(), f = new THREE.Vector3();
  const g = new THREE.Vector3(), h = new THREE.Vector3(), writingForward = new THREE.Vector3(0, -.04, 1);
  const target = new THREE.Vector3(), headPosition = new THREE.Vector3();
  const defaultCamera = new THREE.Vector3(0, 1.22, 2.35);
  let disposed = false, lastTime = null;

  function releaseObject(root) {
    const textures = new Set(), materials = new Set(), geometries = new Set(), skeletons = new Set(), bitmaps = new Set();
    root.traverse(o => {
      if (o.geometry) geometries.add(o.geometry);
      if (o.skeleton) skeletons.add(o.skeleton);
      for (const mat of (Array.isArray(o.material) ? o.material : [o.material])) if (mat) {
        materials.add(mat);
        for (const value of Object.values(mat)) if (value?.isTexture) {
          textures.add(value); if (typeof value.image?.close === 'function') bitmaps.add(value.image);
        }
      }
    });
    for (const item of [...textures, ...materials, ...geometries, ...skeletons]) item.dispose();
    for (const image of bitmaps) image.close();
    root.removeFromParent();
  }

  try {
    // Sequential asset downloads avoid a peak of three simultaneous GLB decodes
    // on standalone headsets and make partial-load failure cleanup deterministic.
    for (let i = 0; i < INTERVIEW_ACTOR_MODELS.length; i++) {
      const spec = INTERVIEW_ACTOR_MODELS[i];
      const gltf = await loader.loadAsync(new URL(spec.file, base).href);
      let missingTexture = false;
      gltf.scene.traverse(o => {
        for (const mat of (Array.isArray(o.material) ? o.material : [o.material])) {
          if (mat && /_(body|head|opacity)/i.test(mat.name) && !mat.map?.image) missingTexture = true;
        }
      });
      if (missingTexture) {
        releaseObject(gltf.scene);
        throw new Error('면접관의 질감을 불러오지 못했습니다. 장면을 다시 열어 주세요.');
      }
      const root = new THREE.Group(); root.name = `interviewer-${spec.id}`;
      const seat = seats[i] ?? DEFAULT_INTERVIEW_SEATS[i];
      if (Array.isArray(seat)) root.position.set(seat[0] ?? 0, seat[1] ?? 0, seat[2] ?? -1.35);
      else { root.position.set(seat.x ?? 0, seat.y ?? 0, seat.z ?? -1.35); root.rotation.y = seat.rotationY ?? seat.yaw ?? 0; }
      gltf.scene.scale.setScalar(spec.scale); root.add(gltf.scene); scene.add(root);
      const bones = {}, meshes = [], rest = new Map();
      root.traverse(o => {
        if (o.isBone) { bones[o.name.replace(/[^a-z0-9]/gi, '').toLowerCase()] = o; rest.set(o, o.quaternion.clone()); }
        if (o.isMesh) {
          o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
          if (o.morphTargetInfluences) meshes.push(o);
          for (const mat of (Array.isArray(o.material) ? o.material : [o.material])) {
            mat.roughness = /body/i.test(mat.name) ? .78 : .66;
            mat.metalness = 0;
            if (/opacity/i.test(mat.name)) {
              mat.transparent = false; mat.alphaTest = .42; mat.side = THREE.DoubleSide; mat.depthWrite = true;
            }
          }
        }
      });
      const getBone = suffix => bones[`bip01${suffix.toLowerCase()}`];
      const actor = { id: spec.id, index: i, root, model: gltf.scene, meshes, bones, rest,
        head: getBone('head'), neck: getBone('neck'), spine: getBone('spine2'),
        rightUpper: getBone('rupperarm'), rightFore: getBone('rforearm'), rightHand: getBone('rhand'),
        leftUpper: getBone('lupperarm'), leftFore: getBone('lforearm'), leftHand: getBone('lhand'),
        middleFinger: getBone('rfinger2'), indexFinger: getBone('rfinger1'), littleFinger: getBone('rfinger4'),
        fingers: [1, 2, 3, 4].map(n => [getBone(`rfinger${n}`), getBone(`rfinger${n}1`)]),
        mouth: 0, yaw: 0, pitch: 0, writing: false, elapsed: 0,
      };
      if (!actor.head || !actor.rightHand || meshes.length === 0) {
        releaseObject(root); throw new Error(`면접관 리그가 누락되었습니다: ${spec.file}`);
      }
      actor.animatedRest = new Map([actor.head, actor.neck, actor.spine, actor.rightUpper, actor.rightFore, actor.rightHand,
        ...actor.fingers.flat()].filter(Boolean).map(bone => [bone, rest.get(bone)]));
      const pen = new THREE.Mesh(new THREE.CylinderGeometry(.003, .002, .135, 8), new THREE.MeshStandardMaterial({ color: 0x262b32, metalness: .25, roughness: .35 }));
      pen.name = 'interviewer-pen'; pen.visible = false;
      pen.rotation.x = -.58; root.add(pen); actor.pen = pen;
      root.updateMatrixWorld(true);
      actors.push(actor); onProgress({ loaded: i + 1, total: 3, id: spec.id });
    }
  } catch (error) {
    actors.forEach(actor => releaseObject(actor.root));
    throw error;
  }

  // A world-space delta must be converted through the bone's parent transform;
  // assuming local X is pitch breaks these 3ds Max/Biped skeletons.
  function rotateWorld(bone, axis, angle) {
    if (!bone || Math.abs(angle) < 1e-7) return;
    bone.parent.getWorldQuaternion(q1);
    q2.setFromAxisAngle(axis, angle);
    q3.copy(q1).invert().multiply(q2).multiply(q1);
    bone.quaternion.premultiply(q3); bone.updateMatrixWorld(true);
  }
  function rotateDirection(bone, from, to) {
    bone.parent.getWorldQuaternion(q1);
    q2.setFromUnitVectors(from.normalize(), to.normalize());
    q3.copy(q1).invert().multiply(q2).multiply(q1);
    bone.quaternion.premultiply(q3); bone.updateMatrixWorld(true);
  }
  function handTarget(actor, side, x, y, z, amount = 1) {
    const upper = actor[`${side}Upper`], fore = actor[`${side}Fore`], hand = actor[`${side}Hand`];
    if (!upper || !fore || !hand) return;
    upper.getWorldPosition(a); fore.getWorldPosition(b); hand.getWorldPosition(c);
    target.set(x, y, z); actor.root.localToWorld(target); target.lerp(c, 1 - amount);
    const len1 = a.distanceTo(b), len2 = b.distanceTo(c);
    const distance = Math.max(.02, Math.min(a.distanceTo(target), len1 + len2 - .006));
    d.copy(target).sub(a).normalize();
    // Keep the elbow below the hand, with a small outward component.
    e.set(side === 'right' ? -.32 : .32, -1, -.08);
    e.addScaledVector(d, -e.dot(d)).normalize();
    const along = (len1 * len1 + distance * distance - len2 * len2) / (2 * distance);
    const height = Math.sqrt(Math.max(0, len1 * len1 - along * along));
    f.copy(a).addScaledVector(d, along).addScaledVector(e, height);
    rotateDirection(upper, g.copy(b).sub(a), h.copy(f).sub(a));
    fore.getWorldPosition(b); hand.getWorldPosition(c);
    rotateDirection(fore, g.copy(c).sub(b), h.copy(target).sub(b));
  }
  function morph(actor, name, value) {
    for (const mesh of actor.meshes) {
      const index = mesh.morphTargetDictionary[name];
      if (index !== undefined) mesh.morphTargetInfluences[index] = value;
    }
  }
  function writingHand(actor, amount) {
    const hand = actor.rightHand;
    beforeHand.copy(hand.quaternion);
    hand.getWorldPosition(a); actor.middleFinger.getWorldPosition(b);
    rotateDirection(hand, b.sub(a), writingForward);
    actor.indexFinger.getWorldPosition(b); actor.littleFinger.getWorldPosition(c);
    actor.middleFinger.getWorldPosition(d); hand.getWorldPosition(a);
    d.sub(a).normalize(); e.copy(b).sub(c).normalize();
    f.copy(d).cross(e).normalize();
    const angle = Math.atan2(d.dot(e.copy(f).cross(up)), f.dot(up));
    rotateWorld(hand, d, angle);
    afterHand.copy(hand.quaternion);
    hand.quaternion.slerpQuaternions(beforeHand, afterHand, amount);
    hand.updateMatrixWorld(true);
    for (const [i, joints] of actor.fingers.entries()) {
      rotateWorld(joints[0], right, (.66 + i * .15) * amount);
      rotateWorld(joints[1], right, .9 * amount);
    }
    actor.indexFinger.getWorldPosition(a); a.z += .025; a.y += .045; a.x += .008;
    actor.root.worldToLocal(a); actor.pen.position.copy(a);
  }
  const smoothWindow = (phase, start, end, edge = .22) => {
    const incoming = THREE.MathUtils.smoothstep(phase, start, start + edge);
    const outgoing = 1 - THREE.MathUtils.smoothstep(phase, end - edge, end);
    return incoming * outgoing;
  };

  function update(t, state = {}, cameraPosition = defaultCamera) {
    if (disposed) return;
    const dt = lastTime === null ? 1 / 60 : THREE.MathUtils.clamp(t - lastTime, 0, .1); lastTime = t;
    const speakerValue = state.speaker ?? state.speakerId ?? 0;
    const speakerIndex = typeof speakerValue === 'number' ? speakerValue : INTERVIEW_ACTOR_MODELS.findIndex(m => m.id === speakerValue);
    const speaking = state.speaking === true;
    const userSpeaking = state.listening === true || ['listening', 'answering', 'recording'].includes(state.phase);
    for (const actor of actors) {
      actor.elapsed = t;
      for (const [bone, rotation] of actor.animatedRest) bone.quaternion.copy(rotation);
      actor.root.updateMatrixWorld(true);
      const offset = actor.index * 2.371;
      const isSpeaker = actor.index === speakerIndex && speaking;
      const observePhase = (t + offset * 2) % (actor.index === 2 ? 12.8 : 19.5);
      const noteWeight = userSpeaking && !isSpeaker && actor.index !== 0 ? smoothWindow(observePhase, 4.5, actor.index === 2 ? 7.5 : 6.7) : 0;
      actor.writing = noteWeight > .2;
      actor.head.getWorldPosition(headPosition);
      if (speaking && !isSpeaker && observePhase < 2.2 && actors[speakerIndex]) {
        actors[speakerIndex].head.getWorldPosition(target);
      } else target.copy(cameraPosition?.isVector3 ? cameraPosition : defaultCamera);
      const dx = target.x - headPosition.x, dz = target.z - headPosition.z;
      const desiredYaw = THREE.MathUtils.clamp(Math.atan2(dx, dz) - actor.root.rotation.y, -.55, .55);
      const desiredPitch = noteWeight * .27 + Math.sin(t * .77 + offset) * .012;
      const blend = 1 - Math.exp(-dt * 4);
      actor.yaw += (desiredYaw - actor.yaw) * blend;
      actor.pitch += (desiredPitch - actor.pitch) * blend;
      const nodPhase = (t + offset * 3) % 8.7;
      const nod = userSpeaking && !actor.writing ? Math.sin(nodPhase * 8) * smoothWindow(nodPhase, 1.0, 1.9, .25) * .034 : 0;
      rotateWorld(actor.spine, right, Math.sin(t * 1.12 + offset) * .004);
      rotateWorld(actor.neck, up, actor.yaw * .3);
      rotateWorld(actor.head, up, actor.yaw * .7);
      rotateWorld(actor.head, right, actor.pitch + nod + (isSpeaker ? Math.sin(t * 2.1 + offset) * .011 : 0));
      // One hand reaches the shared table only while making notes. The other
      // rests naturally in the seated source pose; no repeated arm waving.
      if (noteWeight > .002) {
        const scribble = Math.sin(t * 9.2) * .006;
        handTarget(actor, 'right', -.17 + scribble, .774, .48 + Math.sin(t * 6.8) * .004, noteWeight);
        writingHand(actor, noteWeight);
      }
      actor.pen.visible = noteWeight > .85;
      const blinkPeriod = 3.6 + actor.index * .87;
      const blinkPhase = (t + offset) % blinkPeriod;
      const blink = blinkPhase < .19 ? Math.sin(blinkPhase / .19 * Math.PI) ** 2 : 0;
      morph(actor, 'AK_09_EyeBlinkLeft', blink); morph(actor, 'AK_10_EyeBlinkRight', blink * .97);
      const envelope = Number.isFinite(state.amplitude) ? THREE.MathUtils.clamp(state.amplitude, 0, 1) : (.26 + .26 * Math.abs(Math.sin(t * 9.4)));
      const targetMouth = isSpeaker ? envelope : 0;
      actor.mouth += (targetMouth - actor.mouth) * (1 - Math.exp(-dt * 20));
      const vowel = (Math.floor(t * 4.9) + actor.index) % 4;
      morph(actor, 'AK_25_JawOpen', actor.mouth * .32);
      morph(actor, 'AA_VI_10_aa', vowel === 0 ? actor.mouth * .3 : 0);
      morph(actor, 'AA_VI_11_E', vowel === 1 ? actor.mouth * .28 : 0);
      morph(actor, 'AA_VI_13_O', vowel === 2 ? actor.mouth * .34 : 0);
      morph(actor, 'AA_VI_14_U', vowel === 3 ? actor.mouth * .27 : 0);
      morph(actor, 'AA_VI_01_PP', isSpeaker && Math.sin(t * 17) > .91 ? .16 : 0);
      morph(actor, 'AK_03_BrowInnerUp', isSpeaker ? .025 + Math.sin(t * .71) * .02 : .008);
      const smile = state.phase === 'complete' ? .16 : actor.index === 1 ? .035 : .012;
      morph(actor, 'AK_44_MouthSmileLeft', smile); morph(actor, 'AK_45_MouthSmileRight', smile);
    }
  }
  update(0);
  return { actors, update, dispose() {
    if (disposed) return; disposed = true;
    actors.forEach(actor => releaseObject(actor.root)); actors.length = 0;
  } };
}
