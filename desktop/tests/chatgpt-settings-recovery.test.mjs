import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate as settle} from 'node:timers/promises';
import {createOrbRooms} from '../renderer/orb-rooms.mjs';
import {settingsRoom} from '../renderer/solio-rooms.mjs';

function actions(row) {
  return row.more.find(([kind]) => kind === 'acts')?.[1] ?? [];
}

test('settings shows the actual next confirmation date and the actions available during recovery', () => {
  const now = Date.UTC(2026, 10, 22, 3);
  function row(state) {
    const connection = {ok: true, state, verifiedAt: now};
    return settingsRoom({member: true, chatgpt: connection}, {}, now).rows.find(item => item.key === 'chatgpt');
  }
  const info = row('connected').more.filter(([kind]) => kind === 'say').map(([, line]) => line).join(' ');
  const dueDate = new Date(now + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('ko-KR');
  assert.ok(info.includes('다음 확인'));
  assert.ok(info.includes(dueDate));
  assert.deepEqual(actions(row('storage-error')).map(([, action]) => action), ['chatgpt-disconnect']);
  assert.deepEqual(actions(row('unavailable')), []);
});

for (const interruption of ['cancel', 'close', 'switch member']) {
  test('an unfinished ChatGPT login releases its controls after ' + interruption, async () => {
    let state = 'disconnected';
    let onStatus;
    let signIns = 0;
    const pending = Promise.withResolvers();
    const chatgpt = {
      status: async () => ({ok: true, state}),
      onChange(callback) {
        onStatus = callback;
        return () => { onStatus = null; };
      },
      connect() {
        signIns++;
        state = 'connecting';
        onStatus?.();
        return pending.promise;
      },
      async cancel() {
        state = 'disconnected';
        onStatus?.();
        return {ok: true, state};
      }
    };
    const rooms = createOrbRooms({pc: {chatgpt}});
    const currentRow = () => rooms.scene({aside: 'settings', member: true}).settings.rows.find(item => item.key === 'chatgpt');
    const click = action => rooms.handle({key: 'chatgpt', act: action});
    rooms.open('settings');
    currentRow();
    await settle();
    const connecting = click('chatgpt-connect');
    await settle();
    assert.equal(signIns, 1);
    assert.ok(actions(currentRow()).some(([, action, , disabled]) => action === 'chatgpt-cancel' && disabled !== 'off'));

    if (interruption === 'cancel') {
      await click('chatgpt-cancel');
    } else {
      state = 'disconnected';
      if (interruption === 'close') {
        rooms.close();
        rooms.open('settings');
      } else {
        rooms.accountChanged();
      }
      currentRow();
    }
    await settle();
    pending.resolve({ok: false, code: 'NETWORK'});
    await connecting;
    await settle();
    const after = currentRow();
    assert.ok(actions(after).some(([, action, , disabled]) => action === 'chatgpt-connect' && disabled !== 'off'));
    assert.ok(!after.more.find(([kind]) => kind === 'live')?.[1]);
    rooms.close();
  });
}

