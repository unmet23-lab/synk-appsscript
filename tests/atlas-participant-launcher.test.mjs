import test from 'node:test';
import assert from 'node:assert/strict';
import { mountParticipantLauncher } from '../experiences/atlas-lab/participant-launcher.mjs';

class Element {
  constructor() { this.children = []; this.dataset = {}; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute() {}
}
function find(node, key) { return node.dataset?.participantAction === key ? node : node.children.map(child => find(child, key)).find(Boolean); }

test('changing candidates while preparing role links leaves the current candidate actionable', async t => {
  const priorLocation = Object.getOwnPropertyDescriptor(globalThis, 'location'), priorFetch = globalThis.fetch;
  Object.defineProperty(globalThis, 'location', { configurable: true, value: { hostname: '127.0.0.1', origin: 'http://127.0.0.1:4280' } });
  t.after(() => { priorLocation ? Object.defineProperty(globalThis, 'location', priorLocation) : delete globalThis.location; globalThis.fetch = priorFetch; });
  const area = new Element(); area.dataset.localHost = 'optional';
  const root = { getElementById: () => area, createElement: () => new Element() };
  let release;
  globalThis.fetch = () => new Promise(resolve => { release = () => resolve({ ok: true, json: async () => ({ participants: [{ id: 'person-a', label: '가상 A', capability: 'old-link' }] }) }); });
  const ui = mountParticipantLauncher({ root, getSeed: () => ({ key: 'first' }) });
  const request = find(area, 'create').onclick();
  ui.setSeed({ key: 'second' });
  assert.equal(find(area, 'create').disabled, true);
  release(); await request;
  assert.equal(find(area, 'create').disabled, false, 'new candidate must not retain the discarded button pending state');
  assert.ok(!JSON.stringify(area).includes('old-link'), 'stale role links must not attach to the new candidate');
});
