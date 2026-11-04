// WORLD 캠퍼스 판 손님(world-cast.mjs, 11-03): 손님 그림 파일이 모두 있고, 줄에 같은 손님이 겹치지 않으며, 한 번 정한 손님은 그 표에 남는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WORLD_GUESTS, createGuestPicker, worldGuestImage, worldGuestFace, worldGuestName, worldGuestVoice } from './world-cast.mjs';
import { ORDERS, REVIEW, DELAYED_ORDERS } from './core.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ALL_ORDERS = [...ORDERS, ...REVIEW, ...DELAYED_ORDERS];
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(here, p), 'utf8'));

test('손님마다 세 표정 그림과 얼굴 동그라미가 있다', () => {
  for (const { id } of WORLD_GUESTS) {
    for (const mood of ['order', 'thanks', 'puzzled']) assert.ok(fs.existsSync(path.join(here, worldGuestImage(id, mood))), `${id}-${mood}`);
    assert.ok(fs.existsSync(path.join(here, worldGuestFace(id))), `${id} face`);
  }
  for (const name of ['hall', 'close', 'lobby']) assert.ok(fs.existsSync(path.join(here, `assets/world/${name}.webp`)), name);
});

test('줄에 선 손님과 겹치지 않게 고르고, 한 번 정한 손님은 바뀌지 않는다', () => {
  const pick = createGuestPicker(3), queue = [];
  for (let uid = 1; uid <= 5; uid += 1) { const t = { uid }; queue.push(t); pick.of(t, queue); }
  const ids = queue.map((t) => t.worldGuest);
  assert.equal(new Set(ids).size, ids.length);
  const first = queue[0].worldGuest;
  assert.equal(pick.of(queue[0], queue), first);
});

test('떠난 손님 자리는 다시 쓸 수 있고, 판마다 첫 손님이 달라진다', () => {
  const a = createGuestPicker(0), b = createGuestPicker(1);
  const ta = { uid: 1 }, tb = { uid: 1 };
  a.of(ta, [ta]); b.of(tb, [tb]);
  assert.notEqual(ta.worldGuest, tb.worldGuest);
  const pick = createGuestPicker(0), seen = [];
  for (let uid = 1; uid <= 12; uid += 1) { const t = { uid }; pick.of(t, [t]); seen.push(t.worldGuest); }
  assert.equal(new Set(seen).size, WORLD_GUESTS.length);   // 혼자 서는 손님이면 여섯이 돌아가며 온다
});

test('손님 이름은 정한 손님 것, 모르면 「손님」', () => {
  assert.equal(worldGuestName('g6'), '유학생 손님');
  assert.equal(worldGuestName(undefined), '손님');
});

/* ── 손님별 주문 음성(11-04): 기록 qa/world-voices.json · 포락선 assets/world/voice-env.json ── */
test('손님 여섯이 목소리 여섯으로 모든 주문을 말한다', () => {
  const v = readJson('qa/world-voices.json');
  assert.equal(ALL_ORDERS.length, 26);
  const voices = WORLD_GUESTS.map((g) => v.guests[g.id]?.voice);
  assert.ok(voices.every(Boolean), '손님마다 목소리가 적혀 있다');
  assert.equal(new Set(voices).size, WORLD_GUESTS.length, '목소리가 겹치지 않는다');
  for (const { id } of WORLD_GUESTS) {
    for (const order of ALL_ORDERS) {
      const key = `${id}/${order.id}`, file = path.join(here, worldGuestVoice(id, order.id));
      assert.ok(fs.existsSync(file), `파일 없음 ${key}`);
      const clip = v.clips[key];
      assert.ok(clip, `기록 없음 ${key}`);
      assert.equal(clip.text, order.text, `글자가 주문과 다르다 ${key}`);
      assert.equal(clip.bytes, fs.statSync(file).size, `기록과 파일이 다르다 ${key}`);
    }
  }
  assert.equal(Object.keys(v.clips).length, WORLD_GUESTS.length * ALL_ORDERS.length);
});

test('주문 음성 크기는 지금 게임 기준(−22.5 LUFS)이고 잘리지 않으며, 받아 적으면 주문 글과 같다', () => {
  const { clips } = readJson('qa/world-voices.json');
  for (const [key, c] of Object.entries(clips)) {
    assert.ok(Math.abs(c.lufs + 22.5) <= 0.5, `${key} 크기 ${c.lufs}`);
    assert.ok(c.peak <= -1, `${key} 봉우리 ${c.peak}`);
    assert.ok(c.seconds > 1 && c.seconds < 16, `${key} 길이 ${c.seconds}`);
    assert.ok(c.match === 1 || c.match2 === 1, `${key} 받아쓰기가 주문 글과 다르다: ${c.heard} / ${c.heard2}`);   // 낱말 하나가 답을 가른다 — 두 귀 가운데 하나는 글자까지 같아야 한다
  }
});

test('목소리 막대 포락선이 손님 · 주문마다 파일 길이만큼 있다', () => {
  const env = readJson('assets/world/voice-env.json'), { clips } = readJson('qa/world-voices.json');
  assert.equal(Object.keys(env.orders).length, Object.keys(clips).length);
  for (const [key, c] of Object.entries(clips)) {
    const data = env.orders[key];
    assert.ok(data, `포락선 없음 ${key}`);
    assert.match(data, /^[0-9a-z]+$/);
    assert.equal(data.length % env.bands, 0, key);
    assert.ok(Math.abs(data.length / env.bands - c.seconds * env.fps) <= 3, `${key}: 장 수 ${data.length / env.bands} · 길이 ${c.seconds}초`);
  }
});

test('LAB 음성은 그대로 audio/<주문>.wav다', async () => {
  const src = fs.readFileSync(path.join(here, 'audio.mjs'), 'utf8');
  assert.match(src, /this\.element\.src = src \|\| `audio\/\$\{order\.id\}\.wav`;/);
  for (const order of ALL_ORDERS) assert.ok(fs.existsSync(path.join(here, `audio/${order.id}.wav`)), order.id);
});
