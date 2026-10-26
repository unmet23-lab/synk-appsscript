import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { sourceStatements } from '../../../tests/lib/source-statements.cjs';

const launch = sourceStatements(fs.readFileSync(new URL('../app-shell.mjs', import.meta.url), 'utf8')).function('launchGame');
function fixture() {
  const screens = [], disposed = [], resources = [];
  const session = { status: () => ({ play: { phase: 'ready' } }), dispose: () => disposed.push('session'), closeGame() {} };
  const context = vm.createContext({
    games: { runner: { title: '바람길', path: 'korean-runner/' } },
    client: { snapshot: { accountId: 'account-a' } }, gameLaunch: 0, activeGameSession: null,
    home: { attachPanelResource: resource => resources.push(resource) },
    operating: true, GUEST_GAMES: new Set(), guestTrials: { open: () => [] },
    life: { education: { applyPreferences: () => true } },
    account: { prepareGame: async () => session }, worldPanel: { open: true },
    window: {}, document: { querySelector: () => ({}) },
    t: key => key, notice: (...parts) => parts.join(' '), escape: String, errorText: () => '다시 해 주세요.',
    worldUrl: path => path, queueMicrotask, refreshLife() {},
  });
  context.show = (title, html, type) => { context.gameLaunch++; screens.push({ title, html, type }); };
  vm.runInContext(launch, context);
  return { context, session, screens, disposed, resources };
}

test('a launch failure after preparation disposes its session and offers retry', async () => {
  const f = fixture();
  f.context.life.education.applyPreferences = () => { throw Error('storage is unavailable'); };
  await f.context.launchGame('runner');
  assert.deepEqual(f.disposed, ['session']);
  assert.equal(f.screens.at(-1).type, 'world-game-error');
  assert.match(f.screens.at(-1).html, /data-world-game="runner"/);
});

test('a rejected tutor preparation is handled by the launch boundary', async () => {
  const f = fixture();
  f.context.home.ensureTutor = async () => { throw Error('not ready'); };
  await f.context.launchGame('runner');
  assert.equal(f.screens.at(-1).type, 'world-game-error');
});

test('a late rejected preparation cannot replace another account screen', async () => {
  const f = fixture();
  let reject;
  f.context.account.prepareGame = () => new Promise((_, fail) => { reject = fail; });
  const running = f.context.launchGame('runner');
  f.context.client.snapshot = { accountId: 'account-b' };
  reject(Error('old request'));
  await running;
  assert.equal(f.screens.length, 1);
});

test('normal preparation still opens the game and registers its owner cleanup', async () => {
  const f = fixture();
  await f.context.launchGame('runner');
  assert.equal(f.screens.at(-1).type, 'game');
  assert.equal(f.context.activeGameSession, f.session);
  assert.equal(f.resources.length, 1);
  assert.equal(f.disposed.length, 0);
});
