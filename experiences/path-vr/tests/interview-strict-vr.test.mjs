import test from 'node:test';
import assert from 'node:assert/strict';
import { createStrictVR, getStrictVRGate, getStrictVRControls, pickStrictVRControl, PREVIEW_COMFORT, previewLookAfter, seatedAnchorFromPose } from '../interview/film/strict-vr.mjs';

test('explicit interview preparation warms one room without entering XR or starting preview', async () => {
  let builds = 0, previews = 0, xrRequests = 0, disposals = 0;
  const mount = { hidden: true };
  const room = createStrictVR({ mount }, { secure: true,
    xr: { isSessionSupported: async () => false, requestSession() { xrRequests++; } },
    createStage: async () => { builds++; return { startPreview() { previews++; }, stopPreview() {}, dispose() { disposals++; } }; },
  });
  assert.equal(await room.check(), false); assert.equal(builds, 0);
  assert.equal(await room.prepareRoom(), true); assert.equal(await room.prepareRoom(), true);
  assert.equal(builds, 1); assert.equal(previews, 0); assert.equal(xrRequests, 0);
  assert.equal(mount.hidden, true); assert.equal(room.active, false);
  await room.preview(); assert.equal(builds, 1); assert.equal(previews, 1);
  await room.dispose(); assert.equal(disposals, 1); assert.equal(await room.prepareRoom(), false);
});

test('PC turns stay in fixed steps, keep a level horizon, and can return directly to the front', () => {
  let look = { yaw: 0, pitch: .2 };
  for (let i = 0; i < 3; i++) look = previewLookAfter(look, { type: 'turn', direction: 1 });
  assert.ok(Math.abs(look.yaw - Math.PI / 2) < 1e-10);
  assert.equal(look.pitch, 0);
  for (let i = 0; i < 9; i++) look = previewLookAfter(look, { type: 'turn', direction: 1 });
  assert.ok(Math.abs(look.yaw) < 1e-10, 'one full turn must return to the same front');
  assert.deepEqual(previewLookAfter({ yaw: 2, pitch: -.3 }, { type: 'reset' }), { yaw: 0, pitch: 0 });
});

test('optional PC dragging cannot rotate hundreds of degrees or tip the horizon vertically in one screen drag', () => {
  const look = previewLookAfter({ yaw: 0, pitch: 0 }, { type: 'drag', dx: 1000, dy: 2000 });
  assert.ok(Math.abs(look.yaw) < Math.PI / 3, '1000 pixels previously turned 229 degrees');
  assert.ok(Math.abs(look.pitch) <= Math.PI / 6, 'dragging must not flip the room above or below the seated view');
  const stationary = previewLookAfter(look, { type: 'drag', dx: 0, dy: 0 });
  assert.deepEqual(stationary, look, 'there is no accumulated angular velocity after input ends');
  assert.ok(PREVIEW_COMFORT.fov < 70);
});

test('the seated XR anchor comes from the centre viewer pose and leaves pitch and roll to headset tracking', () => {
  assert.equal(seatedAnchorFromPose(null), null);
  assert.equal(seatedAnchorFromPose({ transform: { position: { x: 0, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: NaN } } }), null);
  const position = { x: .12, y: 1.18, z: -.04 };
  const quarterTurn = seatedAnchorFromPose({ transform: { position, orientation: { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 } } });
  assert.deepEqual([quarterTurn.x, quarterTurn.y, quarterTurn.z], [.12, 1.18, -.04]);
  assert.ok(Math.abs(quarterTurn.yaw - Math.PI / 2) < 1e-10);
  const tiltedHead = seatedAnchorFromPose({ transform: { position, orientation: { x: Math.sin(Math.PI / 8), y: 0, z: 0, w: Math.cos(Math.PI / 8) } } });
  assert.equal(tiltedHead.yaw, 0, 'looking down on entry must not tilt the entire room');
  assert.equal('pitch' in tiltedHead, false);
  assert.equal('roll' in tiltedHead, false);
});

class FakeSession extends EventTarget {
  visibilityState = 'visible';
  ended = 0;
  async end() { this.ended++; this.dispatchEvent(new Event('end')); }
}
function harness(overrides = {}) {
  const session = new FakeSession(), statuses = [], actions = [], mount = { hidden: false };
  const state = { mode: 'voice', voiceReady: true, canStart: true };
  let starts = 0, stops = 0, disposes = 0, exits = 0, requests = 0;
  const stage = {
    renderer: { xr: { setSession: async () => {} } },
    start() { starts++; }, stop() { stops++; }, dispose() { disposes++; },
  };
  const xr = {
    isSessionSupported: async () => true,
    requestSession: async (mode) => { assert.equal(mode, 'immersive-vr'); requests++; return session; },
    ...overrides.xr,
  };
  const vr = createStrictVR({ mount, getState: () => state, onStatus: (status) => statuses.push(status), onAction: (action) => actions.push(action), onExit: () => exits++ }, {
    secure: true, xr, createStage: async () => stage, ...overrides.dependencies,
  });
  return { vr, state, session, statuses, actions, stage, mount, get counts() { return { starts, stops, disposes, exits, requests }; } };
}

test('VR requires prepared voice, not a text-only interface hidden inside a headset', () => {
  assert.match(getStrictVRGate({ mode: 'text', voiceReady: true }), /음성/);
  assert.match(getStrictVRGate({ mode: 'voice', voiceReady: false }), /준비/);
  assert.equal(getStrictVRGate({ mode: 'voice', voiceReady: true }), '');
});

test('controller controls expose submit only during an answer and resume while paused', () => {
  const primaryUV = { x: 332 / 1536, y: 1 - 338 / 400 };
  assert.equal(pickStrictVRControl(primaryUV, { canStart: true }), 'start');
  assert.equal(pickStrictVRControl(primaryUV, { canSubmit: false }), null);
  assert.equal(pickStrictVRControl(primaryUV, { canSubmit: true }), 'submit');
  assert.equal(pickStrictVRControl(primaryUV, { canSubmit: true, paused: true }), 'resume');
  assert.equal(pickStrictVRControl({ x: -1, y: .5 }, {}), null);
  assert.equal(pickStrictVRControl({ x: .2, y: Number.NaN }, {}), null);
  assert.equal(getStrictVRControls({ canStart: true })[1].enabled, false);
});

test('an empty or unrecognized answer can be retried from inside VR', () => {
  const primaryUV = { x: 332 / 1536, y: 1 - 338 / 400 };
  const secondaryUV = { x: 856 / 1536, y: 1 - 338 / 400 };
  assert.equal(pickStrictVRControl(primaryUV, { phase: 'repair' }), 'retry');
  assert.equal(pickStrictVRControl(secondaryUV, { phase: 'repair' }), 'repeat');
  assert.equal(pickStrictVRControl(primaryUV, { phase: 'repair', paused: true }), 'resume');
});

test('unsupported desktop does not allocate a second renderer or request a session', async () => {
  const h = harness({ xr: { isSessionSupported: async () => false }, dependencies: { createStage: () => { throw new Error('must not allocate'); } } });
  assert.equal(await h.vr.check(), false);
  assert.equal(await h.vr.enter(), false);
  assert.equal(h.counts.requests, 0);
  assert.equal(h.mount.hidden, true);
});

test('video warmup only uses an existing stage and never starts a preview or XR session', async () => {
  const h = harness();
  let warms = 0;
  h.stage.warmVideoFrames = async () => { warms++; return true; };
  assert.equal(await h.vr.warmVideoFrames(), false, 'flat-screen playback must not construct a room');
  assert.equal(warms, 0);
  await h.vr.check();
  assert.equal(await h.vr.warmVideoFrames(), true);
  assert.equal(warms, 1);
  assert.equal(h.mount.hidden, true);
  assert.equal(h.counts.starts, 0);
  assert.equal(h.counts.requests, 0);
  assert.equal(h.vr.previewing, false);
  await h.vr.dispose();
  assert.equal(await h.vr.warmVideoFrames(), false);
  assert.equal(warms, 1);
});

test('a late video warmup cannot revive a disposed stage or report stale readiness', async () => {
  for (const reject of [false, true]) {
    const h = harness();
    let finish;
    h.stage.warmVideoFrames = () => new Promise((resolve, fail) => { finish = () => reject ? fail(new Error('disposed shader')) : resolve(true); });
    await h.vr.check();
    const warming = h.vr.warmVideoFrames();
    await h.vr.dispose();
    finish();
    assert.equal(await warming, false);
    assert.equal(h.mount.hidden, true);
    assert.equal(h.counts.starts, 0);
    assert.equal(h.counts.disposes, 1);
  }
});

test('voice gate prevents any requestSession call', async () => {
  const h = harness(); await h.vr.check();
  h.state.mode = 'text';
  assert.equal(await h.vr.enter(), false);
  h.state.mode = 'voice'; h.state.voiceReady = false;
  assert.equal(await h.vr.enter(), false);
  assert.equal(h.counts.requests, 0);
  await h.vr.dispose();
});

test('actual session end hides VR, stops rendering, and closes mic through onExit once', async () => {
  const h = harness(); assert.equal(await h.vr.check(), true);
  assert.equal(await h.vr.enter(), true); assert.equal(h.vr.active, true);
  assert.equal(h.mount.hidden, false); assert.equal(h.counts.starts, 1);
  h.session.visibilityState = 'hidden'; h.session.dispatchEvent(new Event('visibilitychange'));
  assert.deepEqual(h.actions, ['pause']);
  await h.vr.exit();
  assert.equal(h.vr.active, false); assert.equal(h.mount.hidden, true);
  assert.equal(h.counts.exits, 1); assert.equal(h.counts.stops, 1);
  h.session.dispatchEvent(new Event('end'));
  assert.equal(h.counts.exits, 1);
  await h.vr.dispose(); assert.equal(h.counts.disposes, 1);
});

test('requestSession starts synchronously on the entry gesture, without an intervening await', async () => {
  const h = harness(); await h.vr.check();
  const entering = h.vr.enter();
  assert.equal(h.counts.requests, 1);
  await entering; await h.vr.dispose();
});

test('exit while permission is pending ends the late session and never starts rendering', async () => {
  let resolveRequest;
  const delayed = new Promise((resolve) => { resolveRequest = resolve; });
  const h = harness({ xr: { requestSession: () => delayed } }); await h.vr.check();
  const entering = h.vr.enter();
  assert.equal(h.vr.pending, true);
  await h.vr.exit(); resolveRequest(h.session);
  assert.equal(await entering, false);
  assert.equal(h.session.ended, 1); assert.equal(h.counts.starts, 0); assert.equal(h.vr.active, false);
  await h.vr.dispose();
});

test('renderer session attachment failure closes session and triggers mic cleanup', async () => {
  const h = harness();
  h.stage.renderer.xr.setSession = async () => { throw new Error('device failed'); };
  await h.vr.check(); assert.equal(await h.vr.enter(), false);
  assert.equal(h.session.ended, 1); assert.equal(h.counts.exits, 1); assert.equal(h.counts.starts, 0);
  assert.equal(h.vr.active, false); assert.equal(h.mount.hidden, true);
  await h.vr.dispose();
});

test('disposal while stage loads disposes the late stage instead of reviving VR', async () => {
  let resolveStage;
  const delayed = new Promise((resolve) => { resolveStage = resolve; });
  const h = harness({ dependencies: { createStage: () => delayed } });
  const checking = h.vr.check(); await Promise.resolve();
  await h.vr.dispose(); resolveStage(h.stage);
  assert.equal(await checking, false); assert.equal(h.counts.disposes, 1);
  assert.equal(await h.vr.enter(), false);
});

test('failed OS exit pauses the app immediately; disposal still releases textures and mic', async () => {
  const h = harness(); await h.vr.check(); await h.vr.enter();
  h.session.end = async () => { throw new Error('OS refused'); };
  await h.vr.exit(); assert.deepEqual(h.actions, ['pause']);
  await h.vr.dispose();
  assert.equal(h.counts.exits, 1); assert.equal(h.counts.disposes, 1); assert.equal(h.vr.active, false);
});

test('desktop room preview does not grant XR support or microphone permission', async () => {
  const h = harness({ xr: { isSessionSupported: async () => false } });
  let previewStarts = 0, previewStops = 0;
  h.stage.startPreview = () => previewStarts++;
  h.stage.stopPreview = () => previewStops++;
  h.state.mode = 'text'; h.state.voiceReady = false;
  assert.equal(await h.vr.check(), false);
  assert.equal(await h.vr.preview(), true);
  assert.equal(h.vr.previewing, true); assert.equal(h.mount.hidden, false);
  assert.equal(h.counts.requests, 0); assert.equal(previewStarts, 1);
  assert.equal(await h.vr.check(), false);
  assert.equal(await h.vr.enter(), false);
  await h.vr.exit(); assert.equal(previewStops, 1); assert.equal(h.mount.hidden, true);
  assert.equal(h.counts.exits, 0, 'preview close must not pretend an XR session ended');
  await h.vr.dispose();
});

test('closing a pending room preview prevents its late renderer from opening over the app', async () => {
  let resolveStage;
  const delayed = new Promise((resolve) => { resolveStage = resolve; });
  const h = harness({ dependencies: { createStage: () => delayed } });
  h.stage.startPreview = () => { throw new Error('closed preview must not start'); };
  const loading = h.vr.preview(); h.vr.closePreview(); resolveStage(h.stage);
  assert.equal(await loading, false); assert.equal(h.vr.previewing, false);
  await h.vr.dispose(); assert.equal(h.counts.disposes, 1);
});

test('a failed renderer attachment can be retried with a fresh XR session without allocating another stage', async () => {
  const attempts = [new FakeSession(), new FakeSession()]; let next = 0, attachments = 0;
  const h = harness({ xr: { requestSession: async () => attempts[next++] } });
  h.stage.renderer.xr.setSession = async () => { if (++attachments === 1) throw new Error('first attachment failed'); };
  await h.vr.check();
  assert.equal(await h.vr.enter(), false);
  assert.equal(attempts[0].ended, 1);
  assert.equal(h.vr.active, false);
  assert.equal(await h.vr.enter(), true);
  assert.equal(h.counts.starts, 1);
  await h.vr.exit();
  assert.equal(attempts[1].ended, 1);
  await h.vr.dispose();
  assert.equal(h.counts.disposes, 1);
});

test('closing an inset preview restores its previous mount styling before XR entry', async () => {
  const h = harness(); h.mount.style = { cssText: 'color: red;' };
  h.stage.startPreview = () => {}; h.stage.stopPreview = () => {};
  await h.vr.check(); await h.vr.preview();
  assert.equal(h.mount.style.width, '92vw'); assert.equal(h.mount.style.height, '80dvh');
  h.vr.closePreview();
  assert.equal(h.mount.style.cssText, 'color: red;'); assert.equal(h.mount.hidden, true);
  assert.equal(await h.vr.enter(), true);
  assert.equal(h.vr.previewing, false); assert.equal(h.counts.starts, 1);
  await h.vr.dispose();
});
