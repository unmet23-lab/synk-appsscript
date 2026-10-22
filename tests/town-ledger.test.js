'use strict';
// 싱크타운 물건·재료 장부(세로 조각 설계 §20-7 ①, 시험 §20-10 town-ledger) — 서버가 확정한 사건으로만 바뀌는 원장 하나.
const test = require('node:test');
const assert = require('node:assert/strict');
const { townModule } = require('./lib/town.js');

test('같은 원인의 지급은 한 번 · 도감은 첫 지급 사건 하나', async () => {
  const l = await townModule('ledger');
  const first = l.grant(l.emptyLedger(), { accountId: 'acct-1', causeId: 'E-1', itemId: 'mint', qty: 2 });
  assert.equal(first.events.length, 1);
  assert.deepEqual(first.ledger.inventory, [{ itemId: 'mint', source: 'gather', qty: 2, costBasis: 0, saleAllowed: false }]);
  const again = l.grant(first.ledger, { accountId: 'acct-1', causeId: 'E-1', itemId: 'mint', qty: 2 });
  assert.deepEqual([again.events, again.ledger], [[], first.ledger], '같은 지급 ID는 다시 주지 않는다');
  const second = l.grant(first.ledger, { accountId: 'acct-1', causeId: 'E-2', itemId: 'mint', qty: 1 });
  assert.equal(l.held(second.ledger, 'mint'), 3);
  assert.equal(second.ledger.discoveries.mint, first.events[0].grantId, '도감은 첫 지급만');
  assert.notEqual(l.grantId('acct-2', 'E-1', 'mint'), l.grantId('acct-1', 'E-1', 'mint'), '지급 ID는 계정·원인·물건의 해시');
  assert.ok(l.validLedger(second.ledger));
});

test('한도를 넘는 지급은 아무것도 바꾸지 않는다 · 모르는 물건·출처는 거절', async () => {
  const l = await townModule('ledger');
  const full = l.grant(l.emptyLedger(), { accountId: 'a', causeId: 'E-1', itemId: 'leaf-young', qty: l.ITEM_BY_ID['leaf-young'].stackMax }).ledger;
  const before = structuredClone(full);
  assert.throws(() => l.grant(full, { accountId: 'a', causeId: 'E-2', itemId: 'leaf-young', qty: 1 }), error => error.code === 'stack-full');
  assert.deepEqual(full, before);
  assert.throws(() => l.grant(full, { accountId: 'a', causeId: 'E-3', itemId: 'gold', qty: 1 }), error => error.code === 'unknown-item');
  assert.throws(() => l.grant(full, { accountId: 'a', causeId: 'E-3', itemId: 'mint', qty: 1, source: 'shop' }), error => error.code === 'invalid-source');
});

test('출처가 다른 같은 물건은 합치지 않고, 기기가 보낸 잔액 칸은 읽지 않는다', async () => {
  const l = await townModule('ledger');
  const ledger = { inventory: [{ itemId: 'mint', source: 'gather', qty: 1, costBasis: 0, saleAllowed: false }], discoveries: {}, grants: [] };
  // 다른 출처(나중의 구매·제작)를 흉내 내 한 줄을 더해 둔다 — 합치지 않는 규칙만 본다.
  const mixed = { ...ledger, inventory: [...ledger.inventory, { itemId: 'mint', source: 'other', qty: 2, costBasis: 0, saleAllowed: false }] };
  assert.equal(l.held(mixed, 'mint'), 3);
  assert.equal(mixed.inventory.length, 2);
  const granted = l.grant(ledger, { accountId: 'a', causeId: 'E-9', itemId: 'mint', qty: 1, balance: 999, held: 999 });
  assert.equal(l.held(granted.ledger, 'mint'), 2, '잔액 주장은 무시');
});

test('드리기는 옮김이지 복제가 아니다 · 모자라면 거절', async () => {
  const l = await townModule('ledger');
  const ledger = l.grant(l.emptyLedger(), { accountId: 'a', causeId: 'E-1', itemId: 'leaf-young', qty: 3 }).ledger;
  const moved = l.transfer(ledger, { eventId: 'E-2', itemId: 'leaf-young', qty: 2, to: 'cafe-leaf-tin' });
  assert.equal(l.held(moved.ledger, 'leaf-young'), 1);
  assert.deepEqual(moved.events, [{ id: 'E-2', kind: 'item.transferred', itemId: 'leaf-young', qty: 2, from: 'gather', to: 'cafe-leaf-tin' }]);
  assert.equal(l.held(ledger, 'leaf-young'), 3, '원래 원장은 그대로');
  assert.throws(() => l.transfer(moved.ledger, { eventId: 'E-3', itemId: 'leaf-young', qty: 2, to: 'cafe-leaf-tin' }), error => error.code === 'not-enough');
  const used = l.consume(moved.ledger, { eventId: 'E-4', itemId: 'leaf-young', qty: 1, causeId: 'E-3' });
  assert.deepEqual(used.ledger.inventory, [], '다 쓴 줄은 빠진다');
});
