import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudyAccount } from './study-account.mjs';
import { validateStudyDocument } from './study-shape.mjs';
import { createProfile, normalizeProfile } from './study-profile.mjs';

function memoryStorage() {
  const data = new Map();
  return { get length() { return data.size; }, key: (i) => [...data.keys()][i] ?? null, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => { data.set(k, String(v)); }, removeItem: (k) => { data.delete(k); }, data };
}
// 서버 규칙(SYNK-talk synk-path의 path-study)을 따르는 가짜: 판 CAS, 응답 유실 재확인, 동의 base 규칙, 지우기 재확인.
function fakeServer() {
  const row = { revision: 0, state: null }, calls = [];
  let down = null, loseAck = false;
  const fault = (code, revision) => Object.assign(new Error(code), { code, revision });
  const reply = () => ({ ok: true, scope: 'synk-path', resource: 'path-study', accountId: 'acct-1', revision: row.revision, updatedAt: '2026-11-22T12:00:00.000Z', state: row.state ? JSON.parse(JSON.stringify(row.state)) : null });
  async function request(operation, values) {
    calls.push(operation);
    if (down) throw fault(down);
    if (operation === 'pathLoad') return reply();
    const expected = values.expected_revision;
    if (operation === 'pathDelete') {
      if (row.state === null && expected === row.revision - 1) return reply();
      if (expected !== row.revision) throw fault('REVISION_CONFLICT', row.revision);
      row.state = null; row.revision++; return reply();
    }
    const state = validateStudyDocument(values.state);
    if (expected < row.revision && row.state && JSON.stringify(row.state) === JSON.stringify(state)) return reply();
    const ok = row.state === null ? state.consent.base === row.revision : JSON.stringify(row.state.consent) === JSON.stringify(state.consent);
    if (expected !== row.revision) throw fault('REVISION_CONFLICT', row.revision);
    if (!ok) throw fault('PATH_STUDY_CONSENT_STALE', row.revision);
    row.state = state; row.revision++;
    if (loseAck) { loseAck = false; throw fault('NETWORK'); }
    return reply();
  }
  return { row, calls, request, setDown: (code) => { down = code; }, loseNextAck: () => { loseAck = true; } };
}
const until = async (check, ms = 3000) => { const end = Date.now() + ms; while (Date.now() < end) { if (check()) return true; await new Promise((r) => setTimeout(r, 15)); } return false; };
const NOW = () => new Date('2026-11-22T12:00:00.000Z');
const profile = (patch = {}) => normalizeProfile({ ...createProfile(), topik: 3, target: 'jj-ug', ...patch });
const make = (server, storage = memoryStorage()) => createStudyAccount({ request: server.request, storage, now: NOW });

test('동의 전에는 none, 동의하면 서버에 base 0 · 보호자 확인과 함께 저장하고 consented', async () => {
  const server = fakeServer(), acct = make(server);
  assert.equal(await acct.open('acct-1'), true);
  assert.equal(acct.snapshot().phase, 'none');
  assert.equal(acct.snapshot().profile, null);
  assert.equal(await acct.give({ profile: profile(), minor: true, lang: 'mn' }), true);
  assert.equal(server.row.revision, 1);
  assert.deepEqual(server.row.state.consent, { v: 1, at: '2026-11-22T12:00:00.000Z', minor: true, guardian: true, lang: 'mn', base: 0 });
  assert.equal(acct.snapshot().phase, 'consented');
  assert.equal(acct.snapshot().profile.topik, 3);
  acct.close();
});

test('동의한 뒤 고치면 같은 동의로 저장하고, 지우면 빈 행과 다음 판이 남고 이 문서의 복구 기록도 지운다', async () => {
  const server = fakeServer(), storage = memoryStorage(), acct = make(server, storage);
  await acct.open('acct-1'); await acct.give({ profile: profile(), minor: false, lang: 'ko' });
  assert.equal(acct.write(profile({ topik: 4 }), (p) => ({ ...p, topik: 4 })), true);
  await acct.retry();
  assert.ok(await until(() => server.row.revision === 2));
  assert.equal(server.row.state.profile.topik, 4);
  assert.equal(server.row.state.consent.base, 0, '동의는 바뀌지 않는다');
  assert.equal(await acct.remove(), true);
  assert.equal(server.row.state, null); assert.equal(server.row.revision, 3);
  assert.equal(acct.snapshot().phase, 'none');
  assert.equal([...storage.data.keys()].filter((k) => k.includes(':draft:')).length, 0, '남은 초안이 없다');
  // 지운 뒤 다시 동의하면 base는 지금 판(3)이다.
  assert.equal(await acct.give({ profile: profile({ topik: 1 }), minor: false, lang: 'en' }), true);
  assert.equal(server.row.state.consent.base, 3);
  acct.close();
});

test('다른 곳에서 지웠으면 이 탭의 고침을 다시 보내지 않고 동의 전으로 돌린다(되살리지 않는다)', async () => {
  const server = fakeServer(), acct = make(server);
  await acct.open('acct-1'); await acct.give({ profile: profile(), minor: false, lang: 'ko' });
  server.row.state = null; server.row.revision = 2; // 다른 기기에서 지움
  acct.write(profile({ topik: 5 }), (p) => ({ ...p, topik: 5 }));
  await acct.retry();
  assert.ok(await until(() => acct.snapshot().deletedElsewhere === true), '지워졌다고 알린다');
  assert.equal(acct.snapshot().phase, 'none');
  assert.equal(server.row.state, null, '서버에 다시 생기지 않는다');
  acct.close();
});

test('판 충돌이면 계정 것을 받고 마지막 동작 하나만 다시 적용한다', async () => {
  const server = fakeServer(), acct = make(server);
  await acct.open('acct-1'); await acct.give({ profile: profile(), minor: false, lang: 'ko' });
  // 다른 기기가 급수를 바꿈
  server.row.state = { ...server.row.state, profile: { ...server.row.state.profile, topik: 6 } }; server.row.revision = 2;
  const op = (p) => ({ ...p, docs: [...p.docs, { id: 'jj-ug-form', doneAt: '2026-11-22T12:00:00.000Z' }] });
  acct.write(op(profile()), op);
  await acct.retry();
  assert.ok(await until(() => server.row.revision === 3), '다시 적용해 저장');
  assert.equal(server.row.state.profile.topik, 6, '다른 기기의 급수를 지킨다');
  assert.deepEqual(server.row.state.profile.docs.map((d) => d.id), ['jj-ug-form'], '이 탭의 서류 표시를 더한다');
  acct.close();
});

test('서버가 아직이거나 꺼졌으면 paused: 앱은 탭 저장으로 계속 쓴다', async () => {
  const server = fakeServer(); server.setDown('PATH_STUDY_UNAVAILABLE');
  const acct = make(server);
  await acct.open('acct-1');
  assert.equal(acct.snapshot().phase, 'paused');
  assert.equal(await acct.give({ profile: profile(), minor: false, lang: 'ko' }), false, '확인 못 한 상태에서는 동의 저장을 하지 않는다');
  assert.throws(() => acct.write(profile()), /PATH_STUDY_NOT_CONSENTED/);
  acct.close();
});

test('동의 저장이 서버에 닿지 않으면 동의 초안을 남기지 않고 동의 전으로 돌린다: 다시 누를 수 있고, 거부하면 나중에도 보내지 않는다', async () => {
  const server = fakeServer(), storage = memoryStorage(), acct = make(server, storage);
  await acct.open('acct-1');
  server.setDown('NETWORK');
  assert.equal(await acct.give({ profile: profile(), minor: true, lang: 'ko' }), false);
  assert.notEqual(acct.snapshot().phase, 'consented', '보내지 못한 동의로 동의한 상태가 되지 않는다');
  assert.equal(acct.snapshot().consent, null);
  assert.equal([...storage.data.keys()].filter((k) => k.includes(':draft:')).length, 0, '보내지 못한 동의 초안이 남지 않는다');
  server.setDown(null);
  await acct.retry();
  assert.equal(server.row.state, null, '연결이 돌아와도 거부했거나 다시 누르지 않은 동의는 올라가지 않는다');
  assert.ok(await until(() => acct.snapshot().phase === 'none'));
  assert.equal(await acct.give({ profile: profile(), minor: true, lang: 'ko' }), true, '다시 누르면 저장된다');
  assert.equal(server.row.revision, 1);
  acct.close();
});

test('판 충돌 때 마지막 동작을 문서 꼴로 다시 적용하고, 남은 초안을 고르면 그 초안으로 계정을 덮는다', async () => {
  const server = fakeServer(), storage = memoryStorage(), acct = make(server, storage);
  await acct.open('acct-1'); await acct.give({ profile: profile(), minor: false, lang: 'ko' });
  // 다른 기기가 같은 동의로 고쳐 판이 올랐다.
  server.row.state = { ...server.row.state, profile: { ...server.row.state.profile, gradePct: 77 } }; server.row.revision = 2;
  // 앱의 마지막 동작은 탭 저장 꼴(v가 붙은 프로필)을 돌려준다.
  acct.write(profile({ topik: 6 }), (p) => normalizeProfile({ ...p, topik: 6, v: 1 }));
  await acct.retry();
  assert.ok(await until(() => server.row.revision === 3), '충돌 뒤 다시 적용해 저장한다');
  assert.deepEqual([server.row.state.profile.topik, server.row.state.profile.gradePct], [6, 77], '계정 것 위에 바뀐 칸만 얹는다');
  assert.ok(await until(() => ![...storage.data.keys()].some((k) => k.includes(':draft:'))), '다시 적용한 저장 뒤에는 옛 사본이 남지 않는다(다음에 열 때 고르라고 묻지 않는다)');
  acct.close();

  // 이 탭에 보내지 못한 초안을 남기고 닫는다. 그사이 다른 기기가 고친다.
  const tab = make(server, storage);
  await tab.open('acct-1');
  server.setDown('NETWORK');
  tab.write(profile({ topik: 2, gradePct: 77 }));
  await tab.retry();
  tab.close();
  server.setDown(null);
  server.row.state = { ...server.row.state, profile: { ...server.row.state.profile, fundsWon: 9000000 } }; server.row.revision = 4;
  const again = make(server, storage);
  await again.open('acct-1');
  assert.equal(again.snapshot().phase, 'choose', '기준 판이 달라 고르게 한다');
  assert.equal(again.snapshot().localDrafts.length, 1);
  assert.equal(await again.pickDraft(again.snapshot().localDrafts[0].id), true);
  assert.ok(await until(() => server.row.revision === 5), '고른 초안으로 계정을 덮는다');
  assert.equal(server.row.state.profile.topik, 2);
  assert.equal(again.snapshot().phase, 'consented');
  again.close();
});

test('동의 저장의 응답만 잃었으면 다시 열어 계정의 동의 문서를 확인하고 exists를 돌려준다', async () => {
  const server = fakeServer(), acct = make(server);
  await acct.open('acct-1');
  server.loseNextAck();
  assert.equal(await acct.give({ profile: profile(), minor: false, lang: 'ko' }), 'exists');
  assert.equal(server.row.revision, 1, '서버에는 한 번만 저장됐다');
  assert.equal(acct.snapshot().phase, 'consented');
  acct.close();
});

test('앞 저장 실패로 계정 상태를 모르는 채 다시 동의하면 먼저 다시 불러와 저장하고, 연달아 바꾼 고침은 판 충돌 뒤에도 모두 남는다', async () => {
  const server = fakeServer(), storage = memoryStorage(), acct = make(server, storage);
  server.setDown('NETWORK');
  await acct.open('acct-1');
  assert.equal(acct.snapshot().phase, 'paused');
  server.setDown(null);
  assert.equal(await acct.give({ profile: profile(), minor: false, lang: 'ko' }), true, '다시 불러온 뒤 저장한다');
  assert.equal(server.row.revision, 1);
  server.setDown('NETWORK');
  acct.write(profile({ topik: 1 }), (p) => ({ ...p, topik: 1 }));
  await acct.retry();
  acct.write(profile({ topik: 1, gradePct: 66 }), (p) => ({ ...p, gradePct: 66 }));
  await acct.retry();
  server.setDown(null);
  server.row.state = { ...server.row.state, profile: { ...server.row.state.profile, fundsWon: 7000000 } }; server.row.revision = 2;
  await acct.retry();
  assert.ok(await until(() => server.row.revision === 3), '충돌 뒤 다시 적용해 저장한다');
  assert.deepEqual([server.row.state.profile.topik, server.row.state.profile.gradePct, server.row.state.profile.fundsWon], [1, 66, 7000000], '두 고침 모두와 다른 기기의 고침이 남는다');
  acct.close();
});

test('지우는 동안 계정이 닫히면 지웠다고 하지 않고, 남은 초안에서 계정 것을 고르면 그 초안을 지우며, 판 번호 없이 오류만 남으면 error다', async () => {
  const server = fakeServer(), storage = memoryStorage(), acct = make(server, storage);
  await acct.open('acct-1'); await acct.give({ profile: profile(), minor: false, lang: 'ko' });
  server.setDown('NETWORK');
  const pending = acct.remove();
  acct.close();
  assert.equal(await pending, false, '계정이 닫혔으면 지웠다고 하지 않는다');
  server.setDown(null);
  assert.notEqual(server.row.state, null, '서버 문서는 그대로다');

  const tab = make(server, storage);
  await tab.open('acct-1');
  server.setDown('NETWORK');
  tab.write(profile({ topik: 2 }));
  await tab.retry();
  tab.close();
  server.setDown(null);
  server.row.state = { ...server.row.state, profile: { ...server.row.state.profile, gradePct: 50 } }; server.row.revision = 2;
  const again = make(server, storage);
  await again.open('acct-1');
  assert.equal(again.snapshot().phase, 'choose');
  assert.equal(await again.useAccount(), true);
  assert.ok(await until(() => ![...storage.data.keys()].some((k) => k.includes(':draft:'))), '고르지 않은 초안을 지운다');
  again.close();
  const third = make(server, storage);
  await third.open('acct-1');
  assert.equal(third.snapshot().phase, 'consented', '다시 열 때 묻지 않는다');
  third.close();

  server.setDown('INTERNAL_ERROR');
  const broken = make(server, memoryStorage());
  await broken.open('acct-1');
  assert.equal(broken.snapshot().phase, 'error', '판 번호 없이 오류만 남으면 불러오는 중이 아니라 오류다');
  broken.close();
});

test('보내지 못함 표시는 한 번 실패하면 계정에 닿을 때까지 켜져 있고, 판 충돌을 스스로 푸는 동안에는 켜지지 않는다', async () => {
  const server = fakeServer(), acct = make(server);
  await acct.open('acct-1'); await acct.give({ profile: profile(), minor: false, lang: 'ko' });
  server.setDown('NETWORK');
  acct.write(profile({ topik: 2 }), (p) => ({ ...p, topik: 2 }));
  await acct.retry();
  assert.equal(acct.snapshot().sendFailed, true);
  acct.write(profile({ topik: 3 }), (p) => ({ ...p, topik: 3 }));
  assert.equal(acct.snapshot().sendFailed, true, '끊긴 채 이어 눌러도 꺼지지 않는다');
  server.setDown(null);
  await acct.retry();
  assert.ok(await until(() => server.row.state.profile.topik === 3));
  assert.equal(acct.snapshot().sendFailed, false, '계정에 닿으면 꺼진다');
  server.row.state = { ...server.row.state, profile: { ...server.row.state.profile, gradePct: 40 } }; server.row.revision++;
  acct.write(profile({ topik: 4, gradePct: 40 }), (p) => ({ ...p, topik: 4 }));
  await acct.retry();
  assert.ok(await until(() => server.row.state.profile.topik === 4), '판 충돌을 풀어 저장한다');
  assert.equal(acct.snapshot().sendFailed, false, '판 충돌은 보내지 못함으로 치지 않는다');
  acct.close();
});
