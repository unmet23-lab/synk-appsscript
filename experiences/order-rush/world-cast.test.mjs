// WORLD 캠퍼스 판 손님(world-cast.mjs, 11-03): 손님 그림 파일이 모두 있고, 줄에 같은 손님이 겹치지 않으며, 한 번 정한 손님은 그 표에 남는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WORLD_GUESTS, createGuestPicker, worldGuestImage, worldGuestFace, worldGuestName } from './world-cast.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

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
