// 말 랠리 WORLD 캠퍼스 판: 태오 파일이 빠짐없고, 3D 카메라가 사진의 탁구대에 맞고, 화면 크기마다 사진이 빈틈없이 놓이는지, 문항 글이 그대로인지 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import * as THREE from './vendor/three.module.js';
import { ITEMS, PRACTICE } from './content.mjs';
import { NARRATION } from './narration.mjs';
import { SCENE, PLATES, CLIPS, CAST_ART } from './world-scene.mjs';
import { CAST, pickOpponent, castDir } from './world-cast.mjs';
import { VOICE_DIR, REACT, NARRATION_WORLD, NARRATION_FILE_ID, itemVoice, reactVoice, narrationVoice } from './world-lines.mjs';

const has = (p) => existsSync(new URL(`./${p}`, import.meta.url));
const read = (p) => readFileSync(new URL(`./${p}`, import.meta.url), 'utf8');

test('태오 목소리: 문항 47줄 · 반응 · 안내 파일이 모두 있고, 공개 목록에 제작 도구 이름이 없다', () => {
  for (const it of [PRACTICE, ...ITEMS]) assert.ok(has(itemVoice(it.id)), it.id);
  for (const k of Object.keys(REACT)) assert.ok(has(reactVoice(k)), k);
  for (const k of Object.keys(NARRATION_WORLD)) assert.ok(has(narrationVoice(k)), k);
  const m = read(`${VOICE_DIR}/manifest.json`);
  assert.doesNotMatch(m, /eleven|higgsfield|julian/i);
  const lines = JSON.parse(m).lines;
  for (const it of [PRACTICE, ...ITEMS]) assert.equal(lines[it.id]?.text, it.line, `${it.id}: 구운 글이 문항 글과 같다`);
});

test('안내 음성 WORLD 판은 narration.mjs의 자리와 짝이 맞고, 글에 몽글이 없다', () => {
  assert.deepEqual(Object.keys(NARRATION_WORLD).sort(), Object.keys(NARRATION).sort());
  for (const [k, v] of Object.entries(NARRATION_WORLD)) {
    assert.equal(NARRATION_FILE_ID[k], NARRATION[k].id);
    assert.doesNotMatch(v.text, /몽글/);
  }
});

test('표정 판 · 입구 · 결과 그림이 있다', () => {
  for (const src of [...Object.values(PLATES), CAST_ART.lobby, CAST_ART.result]) assert.ok(has(src), src);
  for (const c of Object.values(CLIPS)) assert.ok(has(c.src), c.src);
});

function project(x, y, z) {
  const cam = new THREE.PerspectiveCamera(SCENE.camera.fov, SCENE.photo.w / SCENE.photo.h, 0.05, 60);
  cam.position.set(...SCENE.camera.position); cam.quaternion.set(...SCENE.camera.quaternion);
  cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const p = new THREE.Vector3(x, y, z).project(cam);
  return { x: (p.x + 1) / 2 * SCENE.photo.w, y: (1 - p.y) / 2 * SCENE.photo.h };
}

test('3D 카메라: 탁구대 네 점이 사진의 그 자리에 2px 안으로 맞는다(장면맞추기.py의 점)', () => {
  const W = 0.7625, L = 1.37;
  for (const [[x, z], [u, v]] of [[[-W, -L], [264, 1638.5]], [[W, -L], [1271, 1638]], [[-W, 0], [24, 1952]], [[W, 0], [1509, 1952]]]) {
    const p = project(x, 0, z);
    assert.ok(Math.hypot(p.x - u, p.y - v) < 2, `(${x},${z}) → ${p.x.toFixed(1)},${p.y.toFixed(1)} · 사진 ${u},${v}`);
  }
});

test('자리: 대답 칸은 탁구대 먼 쪽 안, 공 받는 자리 · 튀는 자리는 내 쪽, 태오가 치는 자리는 먼 끝 뒤', () => {
  assert.ok(SCENE.padZ < 0 && SCENE.padZ - 0.21 > -1.37 && SCENE.padZ + 0.21 < 0);
  assert.ok(SCENE.bounceZ > 0 && SCENE.bounceZ < SCENE.hit.z && SCENE.hit.z < 1.37);
  assert.ok(SCENE.opp.z < -1.37);
  assert.equal(SCENE.contact.length, 3);
});

test('사진 자리: 세로 화면은 빈틈없이 덮고 탁구대 먼 모서리가 남으며, 넓은 화면은 높이를 채우고 가운데다', () => {
  for (const [w, h] of [[320, 568], [360, 640], [390, 844], [430, 932], [768, 1024]]) {
    const L = SCENE.layout(w, h);
    assert.ok(L.x <= 0 && L.y <= 0 && L.x + L.w >= w - 1e-6 && L.y + L.h >= h - 1e-6, `${w}×${h}: ${JSON.stringify(L)}`);
    const farLeft = L.x + (264 / SCENE.photo.w) * L.w;
    assert.ok(farLeft >= -1, `${w}×${h}: 먼 왼쪽 모서리 ${farLeft}`);
  }
  for (const [w, h] of [[1280, 720], [1440, 900]]) {
    const L = SCENE.layout(w, h);
    assert.equal(L.wide, true);
    assert.ok(Math.abs(L.x + L.w / 2 - w / 2) < 1e-6 && L.y + L.h >= h - 1e-6 && L.y <= 0);
  }
});

test('상대 고르기: 그 난이도의 반대 성별 → 그 난이도 누구나 → 명단 첫 사람, 성별을 모르면 나누지 않는다', () => {
  const m = { id: 'm', gender: 'm', levels: [1, 2] }, f = { id: 'f', gender: 'f', levels: [1] }, h = { id: 'h', gender: 'f', levels: [2] };
  const list = [m, f, h];
  assert.equal(pickOpponent({ level: 1, playerGender: 'm' }, list), f);
  assert.equal(pickOpponent({ level: 2, playerGender: 'm' }, list), h);
  assert.equal(pickOpponent({ level: 1, playerGender: 'f' }, list), m);
  assert.equal(pickOpponent({ level: 1 }, list), m);
  assert.equal(pickOpponent({ level: 3, playerGender: 'm' }, list), m, '그 난이도에 아무도 없으면 첫 사람');
  assert.equal(pickOpponent({ level: 1, playerGender: 'm' }, [m]), m, '반대 성별이 없으면 있는 사람');
  for (const c of CAST) assert.ok(has(`${castDir(c)}/plates/ready.webp`), c.id);
});

test('WORLD 겉 파일에 마스코트 그림 · 소리 길이 없다', () => {
  for (const f of ['world-play.mjs', 'world-skin.css', 'world-scene.mjs', 'world-lines.mjs']) assert.doesNotMatch(read(f), /mongle-[a-z]+\.(webp|wav)|kit\/brand\/mongle/);
});
