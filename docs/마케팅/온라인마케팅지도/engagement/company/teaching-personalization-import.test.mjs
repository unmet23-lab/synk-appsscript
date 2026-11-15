import test from 'node:test';
import assert from 'node:assert/strict';

test('the shipped teacher personalization UI imports before the DOM mounts',async()=>{
  // Exercise the actual shipped module. The connected UI harness stubs this
  // import, and the standalone teacher server is outside the company image.
  const ui=await import('../../../../../experiences/teacher-world/personalization-ui.mjs');
  assert.equal(typeof ui.createPersonalizationUI,'function');
});
