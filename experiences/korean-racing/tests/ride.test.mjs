// MT 자전거 레이스(WORLD 판)의 3D 모형 · 소리 규칙.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { BIKE, BIKE_STYLES, buildBike, poseBike, pedalPoint, bikeStats } from '../ride/ride-bike.js';
import { RIDERS, buildRider, poseRider, riderStats, twoBone } from '../ride/ride-riders.js';
import { EVENTS, PENTA, comboNote, rideRates, rideMix } from '../ride/ride-sound.js';
import { viewPose, worldFov } from '../ride/ride-rig.js';
import { createRideSound } from '../ride/ride-sound.js';

const span = (mesh, from) => new THREE.Vector3().copy(mesh.position).distanceTo(from);

test('자전거: 두 결 모두 예산 안, 컨트롤러가 돌리는 wheels · jets는 비어 있고 실제 바퀴는 bikeWheels', () => {
  for (const style of BIKE_STYLES) {
    const rival = buildBike(THREE, { style, detail: 'rival' }), view = buildBike(THREE, { style, detail: 'view' });
    assert.ok(bikeStats(rival).triangles < 8000, `${style} rival ${bikeStats(rival).triangles}`);
    assert.ok(bikeStats(view).triangles < 26000, `${style} view ${bikeStats(view).triangles}`);
    assert.deepEqual(rival.userData.wheels, []); assert.deepEqual(rival.userData.jets, []);
    assert.equal(rival.userData.bikeWheels.length, 2); assert.equal(rival.userData.vehicleKind, 'bike');
  }
});

test('poseBike: 구른 거리 / 반지름만큼 바퀴가 돌고 페달은 수평을 지킨다', () => {
  const bike = buildBike(THREE, { style: 'city' }), R = BIKE.city.wheelR;
  poseBike(bike, { distance: 3, cadence: 1.2, steer: .2 });
  for (const w of bike.userData.bikeWheels) assert.ok(Math.abs(w.rotation.x - 3 / R) < 1e-9);
  assert.ok(Math.abs(bike.userData.crank.rotation.x - 1.2) < 1e-9);
  for (const p of bike.userData.pedals) assert.ok(Math.abs(p.rotation.x + 1.2) < 1e-9);
  assert.ok(Math.abs(bike.userData.steer.rotation.y - .2) < 1e-9);
});

test('pedalPoint: 위에서 앞으로 밟아 내린다(바퀴와 같은 쪽), 두 발은 반대', () => {
  const s = BIKE.city, top = pedalPoint(s, 0, 1), a = pedalPoint(s, .3, 1), other = pedalPoint(s, 0, -1);
  assert.ok(Math.abs(top[1] - (s.bbY + s.crank)) < 1e-9);
  assert.ok(a[2] > 0, '위 → 앞'); assert.ok(Math.abs(other[1] - (s.bbY - s.crank)) < 1e-9);
  assert.equal(top[0], -other[0]);
});

test('twoBone: 뼈 길이는 어떤 목표에도 그대로, 못 닿으면 끝을 당긴다', () => {
  const a = new THREE.Vector3(0, 1, 0), pole = new THREE.Vector3(0, 0, 1);
  for (const b of [new THREE.Vector3(0, 0, .2), new THREE.Vector3(.1, .2, .1), new THREE.Vector3(0, -3, 0), new THREE.Vector3(0, 1, 0)]) {
    const { joint, end } = twoBone(THREE, a, b, .45, .44, pole);
    assert.ok(Math.abs(joint.distanceTo(a) - .45) < 1e-6);
    assert.ok(Math.abs(joint.distanceTo(end) - .44) < 1e-6);
  }
  const bent = twoBone(THREE, a, new THREE.Vector3(0, .3, 0), .45, .44, pole);
  assert.ok(bent.joint.z > 0, '무릎은 pole 쪽');
});

test('상대: 사람 + 자전거 예산, 어떤 몸짓에도 값이 NaN이 아니고 다리 · 팔 길이가 그대로다', () => {
  for (const id of Object.keys(RIDERS)) {
    const group = buildRider(THREE, RIDERS[id]), { parts, spec } = group.userData.rider;
    const stats = riderStats(group);
    assert.ok(stats.triangles < 15000, `${id} ${stats.triangles}`);
    assert.deepEqual(group.userData.wheels, []);
    for (const pose of [{}, { cadence: 1.1, standing: 1 }, { cadence: 2.4, footDown: 1 }, { cadence: 4, look: 1 }, { cadence: 5, look: -1, thumb: 1 }, { cadence: 6, standing: .5, speed: 16, time: 3 }]) {
      poseRider(THREE, group, pose);
      group.traverse((o) => { for (const v of [o.position.x, o.position.y, o.position.z, o.quaternion.x, o.quaternion.w]) assert.ok(Number.isFinite(v), `${id} ${o.name} ${JSON.stringify(pose)}`); });
      assert.ok(Math.abs(span(parts.shinL, parts.thighL.position) - spec.thigh) < 1e-4, `${id} 넓적다리`);
      assert.ok(Math.abs(span(parts.foreL, parts.upperL.position) - spec.upper) < 1e-4, `${id} 윗팔`);
    }
  }
});

test('태오는 승인 모습의 옷(남색 과잠 · 크림 소매 · 회색 후드), 마스코트는 어디에도 없다', () => {
  assert.equal(RIDERS.taeo.bikeStyle, 'hybrid'); assert.equal(RIDERS.harin.bikeStyle, 'city');   // 내가 고른 결과 상관없이 사람마다 정해져 있다
  const c = RIDERS.taeo.colors;
  assert.equal(c.jacket, 0x1d2f4d); assert.equal(c.sleeve, 0xe8e0cc); assert.equal(c.hood, 0x8f9396);
  assert.deepEqual(Object.keys(RIDERS).sort(), ['harin', 'taeo']);
});

test('사건 소리: 사운드킷 규칙 — 400ms 이하, C 펜타토닉, 오답은 오른다(버저 없음)', () => {
  const inScale = (f) => { const n = 12 * Math.log2(f / 261.63), pc = ((Math.round(n) % 12) + 12) % 12; return [0, 2, 4, 7, 9].includes(pc) && Math.abs(n - Math.round(n)) < .05; };
  for (const [name, e] of Object.entries(EVENTS)) {
    assert.ok(e.seconds <= .4, name);
    for (const f of e.pitches(3)) assert.ok(inScale(f), `${name} ${f}`);
  }
  const [a, b] = EVENTS.wrong.pitches(); assert.ok(b > a, '오답은 내려가지 않는다');
  assert.equal(comboNote(1), PENTA[0]); assert.equal(comboNote(99), PENTA[PENTA.length - 1]);
});

test('환경 층: 빠를수록 바람 · 구름이 크고, 음성 중에는 물러나고, 프리휠은 페달을 멈출 때만', () => {
  const slow = rideMix({ speed: 5 }), fast = rideMix({ speed: 15 }), boost = rideMix({ speed: 15, boosting: true }), voice = rideMix({ speed: 15, narrating: true });
  assert.ok(fast.wind > slow.wind && fast.roll > slow.roll && fast.windCut > slow.windCut);
  assert.ok(boost.wind > fast.wind && boost.windCut > fast.windCut);
  assert.ok(voice.wind < fast.wind && voice.roll < fast.roll);
  assert.equal(rideMix({ speed: 10, pedaling: true }).freewheel, 0); assert.ok(rideMix({ speed: 10 }).freewheel > 0);
  assert.equal(rideMix({ speed: 0 }).freewheel, 0);
  assert.ok(rideMix({ speed: 10, slope: -.09 }).wind > rideMix({ speed: 10, slope: 0 }).wind, '내리막은 바람이 더 세다');
  assert.ok(rideRates(10).clicks > rideRates(2).clicks); assert.equal(rideRates(0).wheel, 0);
});

test('뷰모델 자세: 세로 화면은 손잡이가 폭을 채우고 넓은 화면은 가운데, FOV는 범위 안', () => {
  for (const style of BIKE_STYLES) for (const aspect of [390 / 844, 844 / 390, 1440 / 900, 1]) {
    const p = viewPose(aspect, BIKE[style]);
    assert.ok(p.fov >= 28 && p.fov <= 104, `${style} ${aspect} ${p.fov}`);
    assert.ok(p.pitch > 0 && p.pitch < 1.2, `${style} ${aspect} ${p.pitch}`);
  }
  assert.ok(viewPose(390 / 844, BIKE.city).fov > viewPose(1440 / 900, BIKE.city).fov);
  assert.equal(worldFov(.46, false), 82); assert.equal(worldFov(1.6, false), 68); assert.equal(worldFov(1.6, true), 76);
});

test('느린 흔들림(돌풍 · 파도)은 크기 값에 바로 잇지 않는다 — quiet() 뒤에 바람 · 파도가 남으면 안 된다', () => {
  const links = new Map(), zeroed = new Set();
  const param = (value = 0) => ({ value, setTargetAtTime(v) { if (v === 0) zeroed.add(this); this.value = v; }, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = (extra = {}) => { const n = { connect(target) { links.set(target, [...(links.get(target) || []), n]); return target; }, disconnect() {}, start() {}, stop() {}, ...extra }; return n; };
  const ctx = {
    currentTime: 0, sampleRate: 8000, destination: node(),
    createGain: () => node({ gain: param(1) }),
    createBiquadFilter: () => node({ frequency: param(0), Q: param(0), type: '' }),
    createOscillator: () => node({ frequency: param(0), kind: 'osc' }),
    createChannelMerger: () => node(),
    createBufferSource: () => node({ playbackRate: param(1), buffer: null, loop: false }),
    createBuffer: (channels, length) => { const data = Array.from({ length: channels }, () => new Float32Array(length)); return { getChannelData: (i) => data[i], numberOfChannels: channels, length }; },
  };
  createRideSound(ctx).quiet();
  assert.ok(zeroed.size >= 5, 'quiet()가 다섯 층을 0으로 내린다');
  for (const p of zeroed) assert.equal(links.get(p) || undefined, undefined, '0으로 내리는 크기 값에 잇는 신호가 없어야 한다');
});
