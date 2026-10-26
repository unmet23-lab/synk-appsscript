// 블렌더 판 주민(아르곤이 모델링 · Claude가 굽기)을 불러와 코드 판 주민과 같은 손잡이(update)로 움직인다.
// GLB 하나에 주민 하나: `<id>_body`(원점 = 바닥 가운데) 아래 눈 · 팔 · 발 · 소품이 자식으로 붙어 있다.
import * as THREE from '../../../../experiences/synk-world-home/scene-assets/three.module.js';
import { GLTFLoader } from '../../../../experiences/synk-world-home/scene-assets/vendor/GLTFLoader.js';
import { feltFinish } from '../../../../experiences/synk-town/day-residents.mjs';
import { createAvatarTextiles } from '../../../../experiences/synk-world-home/avatar-textiles.mjs';

let wool = null; // one matted-wool relief for every Blender resident, built once

// The same per-form numbers as the code cast: arm pose, lean and seed for the idle sway.
const FORMS = { bun: { seed: 31, lean: 0 }, bean: { seed: 53, lean: .2 }, ricecake: { seed: 79, lean: .04 } };

export async function loadBlenderResident(url, form, { mobile = false } = {}) {
  // A .json url carries the GLB as base64 (the artifact host does not serve .glb).
  const gltf = url.endsWith('.json')
    ? await new GLTFLoader().parseAsync(Uint8Array.from(atob((await (await fetch(url)).json()).glb), ch => ch.charCodeAt(0)).buffer, '')
    : await new GLTFLoader().loadAsync(url), f = FORMS[form];
  const root = new THREE.Group(), body = gltf.scene.getObjectByName(`${form}_body`) || gltf.scene;
  body.position.set(0, 0, 0); root.add(body);
  const node = name => body.getObjectByName(`${form}_${name}`);
  const arms = [['xneg', -1], ['xpos', 1]].map(([n, side]) => ({ node: node(`arm_${n}`), side, rest: node(`arm_${n}`)?.rotation.clone() })).filter(a => a.node);
  const feet = [['xneg', -1], ['xpos', 1]].map(([n, side]) => ({ node: node(`foot_${n}`), side, y: node(`foot_${n}`)?.position.y })).filter(a => a.node);
  const eyes = ['xneg', 'xpos'].map(n => node(`eye_${n}`)).filter(Boolean);
  const teapot = node('teapot'), rest = { y: body.position.y, rot: body.rotation.clone() };
  root.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; for (const m of [o.material].flat()) if (m && 'roughness' in m) { m.roughness = Math.max(m.roughness, .9); m.envMapIntensity = .5; } } });
  const box = new THREE.Box3().setFromObject(root, true);
  // The Blender high models came out smooth as clay, so their baked normals carry little felt. The shapes,
  // colours and baked shade stay; the surface takes the code cast's matted wool relief and its finish:
  // soft mottling, shade toward the floor and a fibre halo on each moving mesh. A Blender metre is about
  // .58 of the code cast's rig unit.
  wool ??= createAvatarTextiles({ anisotropy: 4 }).fabric('wool', [6, 6]);
  root.traverse(o => { if (!o.isMesh || /_eye_/.test(o.name)) return; for (const m of [o.material].flat()) if (m?.normalMap) { m.normalMap = wool.normalMap; m.normalScale.set(1.1, 1.1); m.userData.haloFromMap = true; m.needsUpdate = true; } });
  feltFinish(root, { mobile, seed: f.seed, unit: .58, ownMesh: true });
  function update({ now = 0, walkPhase, gaitBlend, walking = false, motion = true, talking = false, working = false, holding = false, showing = false, seated = false } = {}) {
    const t = motion ? now * .001 : 0, gait = motion ? (Number.isFinite(gaitBlend) ? gaitBlend : walking ? 1 : 0) : 0;
    const phase = Number.isFinite(walkPhase) ? walkPhase : t * 7, breath = motion ? Math.sin(t * 1.7 + f.seed) * .012 : 0;
    body.position.y = rest.y + Math.abs(Math.sin(phase)) * .025 * gait;
    body.rotation.set(rest.rot.x + f.lean + (working ? .05 : 0) + (talking ? Math.sin(t * 3.4) * .02 : 0), rest.rot.y, rest.rot.z + Math.sin(phase) * .075 * gait + Math.sin(t * 1.1 + f.seed) * .01 * (1 - gait));
    body.scale.set(1 - breath * .5, 1 + breath - (seated ? .03 : 0), 1 - breath * .5);
    for (const { node: n, side, y } of feet) n.position.y = y + Math.max(0, Math.sin(phase + (side < 0 ? 0 : Math.PI))) * .025 * gait;
    for (const arm of arms) {
      let x = Math.sin(phase + (arm.side < 0 ? Math.PI : 0)) * .45 * gait, z = arm.side * .12;
      if (holding) { x = -1.15; z = arm.side * .05; }
      else if (working) {
        if (form === 'bean') x = arm.side > 0 ? -1.25 + Math.sin(t * 7) * .45 : -.35;
        else if (form === 'ricecake') x = -.25 + Math.sin(t * 5 + arm.side) * .06;
        else x = arm.side > 0 ? -.55 + Math.sin(t * 2.2) * .12 : -.2;
      } else if (showing && arm.side < 0) { x = -1; z = arm.side * .5; }
      else if (talking && arm.side < 0) x = -.4 - Math.sin(t * 2.6) * .15;
      arm.node.rotation.set(arm.rest.x + x, arm.rest.y, arm.rest.z + z);
    }
    if (teapot) teapot.visible = !holding;
    const blink = (t + f.seed * .07) % 4.9, openness = blink > 4.74 ? Math.max(.1, Math.abs((blink - 4.82) / .08)) : 1;
    for (const eye of eyes) eye.scale.y = openness;
  }
  update();
  return { body: root, update, height: box.max.y - box.min.y, head: body };
}
