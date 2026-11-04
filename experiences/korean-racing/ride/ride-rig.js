// MT 바닷가 자전거 레이스(WORLD 판)의 3D 장치(2026-11-04, 설계 qa/world-mt-20261104/설계.md 4 · 7절).
// app.js가 WORLD일 때만 동적으로 불러온다. 내 자전거(1인칭 뷰모델) · 상대 둘 · 1인칭 카메라 · 소리 · 몸짓을 맡고, 한 판의 진행은 race-controller.js 그대로다.
// 컨트롤러는 코스 단위로 셈하고, 여기서 courseToRoad로 길 위 자리에 놓는다. 컨트롤러가 돌리는 userData.wheels는 비워 두고 실제 바퀴는 여기서 돌린다.
import { buildBike, poseBike, BIKE } from './ride-bike.js';
import { RIDERS, buildRider, poseRider } from './ride-riders.js';
import { createRideSound, rideRates } from './ride-sound.js';
import { buildRideProps } from './ride-props.js';
import { courseToRoad, LANE_GAP, HOLD_DISTANCE } from '../lane-core.js';
import { gatePosition } from '../race-pacing.js';

const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const follow = (value, target, rate, dt) => value + (target - value) * (1 - Math.exp(-dt * rate));

/** 1인칭 시점의 숫자(세계 카메라). 뷰모델 카메라는 viewPose. */
export const EYE_HEIGHT = 1.58;
export const worldFov = (aspect, boosting) => (aspect < 1 ? 82 : 68) + (boosting ? (aspect < 1 ? 6 : 8) : 0);

/**
 * 뷰모델 카메라: 화면 비율마다 손잡이가 화면 폭의 span만큼, 세로 y(NDC)에 오게 FOV · 내려다보는 각을 푼다.
 * 눈 자리는 연출값이다(실제 눈에서 손잡이는 틀 밖 65° 아래 — 설계 4-1). 몸을 숙인 시선(핸들 가까이 위)이라야 앞바퀴가 스템에 안 가리고 손잡이 너머로 보인다(정확히 뒤에서는 바퀴가 스템과 한 줄이다).
 */
export function viewPose(aspect, spec, { width = spec.grip[0] * 2 + .08 } = {}) {
  const eye = [0, 1.55, .2], bar = [0, spec.barCenter[1], spec.barCenter[2]];
  const dy = eye[1] - bar[1], dz = bar[2] - eye[2], below = Math.atan2(dy, dz), dist = Math.hypot(dy, dz);
  const t = clamp((aspect - .46) / (1.78 - .46), 0, 1), span = 1.16 + (.46 - 1.16) * t, y = .68 + (.62 - .68) * t;
  let pitch = below * .6, vTan = 1;
  for (let i = 0; i < 4; i++) {
    const depth = dist * Math.cos(below - pitch), hTan = (width / span) / 2 / depth;
    vTan = hTan / aspect; pitch = below - Math.atan(y * vTan);
  }
  return { eye, pitch, fov: clamp(2 * Math.atan(vTan) * 180 / Math.PI, 28, 104) };
}

/** 게이트 앞 멈춤선에서 본 꼬리표 · 정답 글자 높이(화면 0~1). 조작 연습은 거리가 달라 따로 잰다(app.js가 hold를 넘긴다). */
export function laneAnchors(THREE, camera, { roadPoint, worldS, gateS, hold, aspect }) {
  const probe = camera.clone(), S = worldS(gateS - hold), G = worldS(gateS);
  probe.position.copy(roadPoint(S, 0, EYE_HEIGHT)); probe.lookAt(roadPoint(S + 20, 0, 1.2));
  probe.fov = worldFov(aspect, false); probe.aspect = aspect; probe.updateProjectionMatrix(); probe.updateMatrixWorld(true);
  const y = (point) => (1 - point.project(probe).y) / 2;
  return { foot: y(roadPoint(G, 0, 0)), boardTop: y(roadPoint(G, 0, 3.7)) };
}

export function createRideRig({ THREE, renderer, scene, camera, roadPoint, pathAngle, roadY, sunDirection, track, reducedMotion = false, style = 'city' }) {
  const worldS = (s) => courseToRoad(s, track);
  let spec = BIKE[style];

  /* ── 내 자전거: 세계에는 자리만, 그림은 뷰모델로 ── */
  const player = new THREE.Group(); player.name = 'ride-player'; player.userData = { wheels: [], jets: [], vehicleKind: 'bike' }; scene.add(player);
  const viewScene = new THREE.Scene(), viewCam = new THREE.PerspectiveCamera(60, 1, .02, 12);
  let viewBike = buildBike(THREE, { style, detail: 'view' }); viewScene.add(viewBike);
  /** 내 자전거 결 바꾸기(입구 · 멈춤 창). 뷰모델만 새로 짓는다 — 상대 자전거는 사람마다 정해져 있다. */
  function setStyle(next) {
    if (next === style || !BIKE[next]) return;
    viewScene.remove(viewBike);
    viewBike.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose(); } });
    style = next; spec = BIKE[next]; viewBike = buildBike(THREE, { style, detail: 'view' }); viewScene.add(viewBike); aspect = 0; sound?.setStyle(style);
  }
  const viewSun = new THREE.DirectionalLight(0xffdcb0, 2.3), viewSky = new THREE.HemisphereLight(0xffe6cf, 0x6a5444, 1.05); viewScene.add(viewSun, viewSky);
  let aspect = 0;
  function fitView(nextAspect) {
    if (nextAspect === aspect) return; aspect = nextAspect;
    const pose = viewPose(aspect, spec);
    viewCam.aspect = aspect; viewCam.fov = pose.fov; viewCam.position.set(...pose.eye);
    // 자전거 공간에서 +Z를 보고 pitch만큼 내려다본다.
    viewCam.up.set(0, 1, 0); viewCam.lookAt(pose.eye[0], pose.eye[1] - Math.sin(pose.pitch), pose.eye[2] + Math.cos(pose.pitch)); viewCam.updateProjectionMatrix();
  }

  /* ── 상대 둘: 코스 단위 자리(s · offset · speed)는 컨트롤러가 움직인다 ── */
  const makeRival = (who, s, offset, speed) => {
    const mesh = buildRider(THREE, RIDERS[who]); scene.add(mesh);
    return { mesh, s, offset, speed, who, lastRoad: worldS(s), distance: 0, cadence: 0, vel: 0, standing: 0, burst: 0, burstAt: 6 + Math.random() * 6, look: 0, lookLeft: 0, lookWait: 0, foot: 0, thumb: 0, thumbLeft: 0, wasAhead: true, time: Math.random() * 10 };
  };
  const rivals = [makeRival('taeo', 103, -3.15, 26.1), makeRival('harin', 124, 3.1, 25.6)];

  /* ── 길 위 소품(출발 · 표지판 · 도착 현수막) ── */
  const props = buildRideProps(THREE, renderer, { roadPoint, pathAngle }); scene.add(props.group);

  /* ── 놓기 ── */
  const slopeAt = (road) => (roadY(road + 1.5) - roadY(road - 1.5)) / 3;
  function place(mesh, s, offset, yaw = 0) {
    const road = worldS(s);
    mesh.position.copy(roadPoint(road, offset, .02));
    mesh.rotation.order = 'YXZ'; mesh.rotation.set(-Math.atan(slopeAt(road)), pathAngle(road) + yaw, 0);
  }

  /* ── 소리 ── */
  let sound = null;
  const attachAudio = (ctx) => { if (!sound && ctx) { sound = createRideSound(ctx); sound.setStyle(style); } return sound; };

  /* ── 한 프레임 ── */
  const me = { distance: 0, cadence: 0, roadPrev: null, steer: 0, offsetPrev: 0, lateral: 0, standing: 0, bump: 0, roll: 0, fov: 0, look: 0, time: 0 };
  let onEvent = () => {};
  function update(dt, round) {
    const live = round.running && !round.paused, road = worldS(round.playerS);
    // 도착 현수막은 처음 지나간 뒤(또는 되감긴 뒤)에만 숨긴다 — 완주는 현수막 앞에서 켜지므로 그 순간 숨기면 눈앞에서 사라진다.
    if (!round.finished) me.finishGone = false;
    else if (road > props.finishS + 2 || (me.roadPrev !== null && road - me.roadPrev < -30)) me.finishGone = true;
    props.finish.visible = !me.finishGone;
    if (me.roadPrev === null || Math.abs(road - me.roadPrev) > 30) me.roadPrev = road;   // 처음 · 되감기
    const moved = Math.max(0, road - me.roadPrev), speed = dt > 0 ? moved / dt : 0; me.roadPrev = road; me.time += dt;
    me.distance += moved; me.cadence += moved / 7 * Math.PI * 2;
    me.speed = follow(me.speed || 0, speed, 8, dt);
    const lateral = dt > 0 ? (round.playerOffset - me.offsetPrev) / dt : 0; me.offsetPrev = round.playerOffset; me.lateral = follow(me.lateral, lateral, 10, dt);
    me.steer = follow(me.steer, clamp(me.lateral / 5.8, -1, 1) * .24, 12, dt);
    const boosting = round.boost > 0 && live;
    me.standing = follow(me.standing, boosting ? 1 : 0, 3, dt); me.bump = follow(me.bump, 0, 7, dt);
    // 뷰모델: 바퀴 · 크랭크 · 핸들, 페달 박자의 작은 흔들림, 일어서서 밟을 때의 좌우 흔들림, 접촉 때 손잡이만 튐.
    poseBike(viewBike, { distance: me.distance, cadence: me.cadence, steer: me.steer });
    const motion = reducedMotion ? 0 : 1, sway = Math.sin(me.cadence) * (.008 + .03 * me.standing) * Math.min(1, me.speed / 4) * motion;
    viewBike.rotation.set(Math.sin(me.cadence * 2) * .003 * motion, 0, sway + me.bump * Math.sin(me.time * 44) * .03 * motion);
    viewBike.position.y = Math.abs(Math.sin(me.cadence)) * .004 * motion;
    // 상대: 거리 · 박자 · 몸짓.
    for (const r of rivals) {
      const rRoad = worldS(r.s), rMoved = Math.max(0, rRoad - r.lastRoad), rSpeed = dt > 0 ? rMoved / dt : 0; r.lastRoad = rRoad; r.time += dt;
      r.distance += rMoved; r.cadence += rMoved / 7 * Math.PI * 2; r.vel = follow(r.vel, rSpeed, 6, dt);
      const gap = rRoad - road, behindMe = gap < 0;   // gap > 0이면 내가 뒤에 있다
      // 잠깐씩 일어서서 밟는다(보기만, 속도는 컨트롤러 그대로).
      r.burst -= dt; r.burstAt -= dt; if (r.burstAt <= 0 && r.vel > 4) { r.burst = 2.2 + Math.random() * 1.2; r.burstAt = 9 + Math.random() * 7; }
      r.standing = follow(r.standing, r.burst > 0 ? 1 : 0, 3.2, dt);
      // 게이트 앞에서 기다리면 한 발을 땅에.
      r.foot = follow(r.foot, r.vel < .6 && live ? 1 : 0, 4, dt);
      // 내가 뒤에 바짝 붙으면 어깨 너머로 돌아본다.
      r.lookWait -= dt;
      if (gap > 1.5 && gap < 7 && r.lookWait <= 0 && Math.abs(r.offset - round.playerOffset) < 6) { r.lookLeft = 1.5; r.lookWait = 7; r.lookSide = round.playerOffset > r.offset ? 1 : -1; }
      r.lookLeft -= dt; r.look = follow(r.look, r.lookLeft > 0 ? r.lookSide : 0, 5, dt);
      // 앞지른 순간: 벨, 그 뒤 태오는 한 손 엄지.
      if (live && r.wasAhead && behindMe && Math.abs(gap) < 12) { sound?.bell(); r.thumbLeft = r.who === 'taeo' ? 1.5 : 0; onEvent({ type: 'passed', who: r.who }); }
      if (live && !r.wasAhead && !behindMe && Math.abs(gap) < 12) onEvent({ type: 'overtaken', who: r.who });
      r.wasAhead = !behindMe;
      r.thumbLeft -= dt; r.thumb = follow(r.thumb, r.thumbLeft > 0 ? 1 : 0, 7, dt);
      poseRider(THREE, r.mesh, { distance: r.distance, cadence: r.cadence, standing: reducedMotion ? 0 : r.standing, look: r.look, footDown: r.foot, thumb: r.thumb, speed: r.vel, time: r.time });
    }
  }
  function updateSound(round, { narrating = false } = {}) {
    if (!sound) return;
    if (!round.running || round.paused || !round.soundEnabled) { sound.quiet(); return; }
    const road = worldS(round.playerS), decel = (me.speedPrev ?? 0) - (me.speed || 0); me.speedPrev = me.speed;
    // 페달: 평소 · 오르막 · 질주에는 밟고, 멈추려고 줄일 때와 질주 없는 내리막에서는 발을 멈춰 프리휠이 돈다(기다림의 소리).
    const slope = slopeAt(road), pedaling = !(decel > .02 || (slope < -.03 && round.boost <= 0));
    sound.update({ speed: me.speed || 0, boosting: round.boost > 0, pedaling, narrating, slope });
    if (decel > .05 && (me.speed || 0) > 1.5 && (me.time - (me.brakeAt ?? -9)) > 1.2) { sound.brake(); me.brakeAt = me.time; }
  }

  /* ── 1인칭 카메라 ── */
  function updateCamera(dt, round, { snap = false } = {}) {
    const road = worldS(round.playerS), off = round.playerOffset, a = aspect || camera.aspect;
    const boosting = round.boost > 0 && round.running && !reducedMotion;
    const pos = roadPoint(road, off, EYE_HEIGHT + Math.abs(Math.sin(me.cadence)) * .012 * (reducedMotion ? 0 : 1) + me.standing * .12);
    // 앞을 본다. 꺾는 쪽으로 시선이 조금 먼저 가고, 길 기울기를 따라 숙인다.
    const ahead = 20, target = roadPoint(road + ahead, off + me.lateral * .55, 1.2);
    camera.position.copy(pos); camera.up.set(0, 1, 0); camera.lookAt(target);
    const roll = reducedMotion ? 0 : clamp(me.lateral / 5.8, -1, 1) * .07 + Math.sin(me.cadence) * .004 * me.standing;
    me.roll = snap ? roll : follow(me.roll, roll, 9, dt); camera.rotateZ(me.roll);
    const fov = worldFov(a, boosting); me.fov = snap || !me.fov ? fov : follow(me.fov, fov, 3, dt);
    if (Math.abs(camera.fov - me.fov) > .01) { camera.fov = me.fov; camera.updateProjectionMatrix(); }
  }
  function snapCamera(round) { me.roadPrev = null; me.offsetPrev = round.playerOffset; me.lateral = 0; updateCamera(0, round, { snap: true }); }

  /* ── 뷰모델 그리기: 세계를 그린 뒤 깊이만 지우고 ── */
  const sunWorld = new THREE.Vector3(), camQ = new THREE.Quaternion();
  function renderView() {
    const w = renderer.domElement.clientWidth || 1, h = renderer.domElement.clientHeight || 1; fitView(w / h);
    viewScene.environment = scene.environment;
    // 세계 해 방향을 카메라 공간으로 옮겨 뷰모델 카메라 공간에서 같은 쪽에 둔다.
    camQ.copy(camera.quaternion).invert(); sunWorld.copy(sunDirection).applyQuaternion(camQ).applyQuaternion(viewCam.quaternion);
    viewSun.position.copy(sunWorld).multiplyScalar(10);
    const auto = renderer.autoClear; renderer.autoClear = false; renderer.clearDepth(); renderer.render(viewScene, viewCam); renderer.autoClear = auto;
  }

  /** 멈춤선에서 본 꼬리표 높이. 연습은 hold를 넘긴다. */
  function anchors(hold = HOLD_DISTANCE, gateS = gatePosition(0)) { return laneAnchors(THREE, camera, { roadPoint, worldS, gateS, hold, aspect: aspect || camera.aspect }); }

  return { player, rivals, props, worldS, place, slopeAt, attachAudio, get sound() { return sound; }, update, updateSound, updateCamera, snapCamera, renderView, anchors, setStyle, get style() { return style; }, get viewBike() { return viewBike; }, viewScene, viewCam, me, rate: rideRates,
    bump() { me.bump = 1; sound?.bump(); }, onEvent(fn) { onEvent = fn; }, laneGap: LANE_GAP };
}
