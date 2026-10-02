import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createStore } from './server.mjs';

test('FT10 server plans keep the cup hidden until serving after the real JSON-to-browser boundary', () => {
  for (const branch of ['inside', 'outside']) {
    const store = createStore(); let sequence = 0;
    const send = (type, payload = {}) => store.execute({ id: `roundtrip.${++sequence}`, type, payload,
      expectedRevision: store.read().state.revision });
    send('CHOOSE', { branch }); send('NEXT');
    if (branch === 'outside') { send('COLOR', { color: 'yellow' }); send('CRAFT'); }
    const snapshot = send('PLACE', { slot: branch === 'inside' ? 'eaves-left' : 'garden' });
    const browser = vm.createContext({});
    vm.runInContext(fs.readFileSync(new URL('../../tools/lib/loom-life.js', import.meta.url), 'utf8'), browser);
    const delivered = JSON.parse(JSON.stringify(snapshot));
    const plan = browser.LoomLife.createPlan(delivered.view.plan);
    const context = { currentRevision: delivered.state.worldRevision, currentPlanId: delivered.view.reaction.id,
      committedStepIds: delivered.view.committedStepIds };
    assert.equal(plan.initialActors.tea.pose, 'hidden', branch);
    assert.equal(browser.LoomLife.sample(plan, 0, context).actors.tea.pose, 'hidden', branch);
    const serving = browser.LoomLife.sample(plan, 2000, context);
    assert.equal(serving.actors.owner.pose, 'carrying', branch);
    assert.equal(serving.actors.tea.pose, 'hidden', 'The app can attach this hidden cup to the carrying owner');
    assert.equal(browser.LoomLife.sample(plan, plan.totalMs, context).actors.tea.pose, 'placed', branch);
  }
});
