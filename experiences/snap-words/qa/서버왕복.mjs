// 찰칵 낱말 앨범 — 실제 서버 코드 왕복. 운영 · 리허설 계정을 만들지 않고, 배포된 synk-play 런타임 + 실제 마이그레이션(PGlite) + 실제 놀이 호스트 + 실제 album.mjs로 두 기기를 돌린다.
//   node experiences/snap-words/qa/서버왕복.mjs <SYNK-talk 사본 폴더>
// 사본은 운영 함수와 같은 커밋이어야 뜻이 있다 — 그 사본에서 tools/배포대조.js synk-play가 「같다」인지 먼저 본다.
import { createRequire } from 'node:module';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { STORE_KEY, emptyAlbum, addCard, nameCard, recordRound } from '../core.mjs';
import { openAlbumStore } from '../album.mjs';
import { WORDS } from '../words.mjs';
import { createWorldPlayHost } from '../../play-common/account-host.mjs';

const talk = path.resolve(process.argv[2] || '');
if (!process.argv[2]) { console.error('쓰기: node experiences/snap-words/qa/서버왕복.mjs <SYNK-talk 사본 폴더>'); process.exit(2); }
const { createPlayFixture } = createRequire(path.join(talk, 'tests/x.js'))('./lib/play-fixture.js');

const checks = [];
const check = (name, ok, more = '') => { checks.push(!!ok); console.log(`${ok ? '✓' : '✗'} ${name}${more ? ` — ${more}` : ''}`); };
const Q = [[0.1, 0.2], [0.3, 0.2], [0.3, 0.4], [0.1, 0.4]];
const shot = (word) => ({ word, kind: 'plate', q: Q, style: 'blade', vertical: false });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function memoryStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return { get length() { return map.size; }, key: (i) => [...map.keys()][i] ?? null, getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => { map.set(k, String(v)); }, removeItem: (k) => { map.delete(k); } };
}
/** WORLD 클라이언트와 같은 머리 · 같은 오류 꼴로 서버 처리기를 부른다. */
function clientOf(handler) {
  async function send(body) {
    const res = await handler(new Request('https://synthetic.invalid/functions/v1/synk-play', { method: body === undefined ? 'GET' : 'POST', headers: { 'content-type': 'application/json', 'x-synk-product': 'world', 'x-synk-contract': '1' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }));
    const data = await res.json();
    if (!res.ok) throw Object.assign(Error(data.error?.message || data.error?.code), { code: data.error?.code, status: res.status });
    return data;
  }
  return { load: () => send(), mutate: (body) => send(body) };
}
function device(actor, seed) {
  const storage = memoryStorage(seed), client = clientOf(actor.handler);
  const holder = {};
  const win = { localStorage: storage, addEventListener() {}, document: { addEventListener() {}, visibilityState: 'visible' }, get SYNKPlayHost() { return holder.host; } };
  win.parent = win;
  return { win, storage, client, async begin(accountId) { holder.host = createWorldPlayHost({ accountId, client, guard() {}, storage, locks: null, uuid: () => randomUUID() }); return holder.host; } };
}
const open = (d, accountId, opts = {}) => openAlbumStore({ win: d.win, storage: d.storage, accountKey: accountId, gapMs: 5, ...opts });
const settled = async (host) => { await sleep(350); await host.flush().catch(() => {}); };

const f = await createPlayFixture();
try {
  // ① 첫 기기에서 저장 → 계정에 올라감
  const actor = await f.actor();
  const reader = clientOf(actor.handler);
  const { accountId } = await reader.load();
  const record = async () => { const raw = (await reader.load()).state.records[STORE_KEY]; return raw ? JSON.parse(raw) : null; };
  const a = device(actor); const hostA = await a.begin(accountId);
  const albumA = await open(a, accountId);
  addCard(albumA.album, shot('library'), 'gate', 100); nameCard(albumA.album, 'library', 101);
  addCard(albumA.album, shot('cat'), 'gate', 200);
  recordRound(albumA.album, 'gate', { ms: 61000, first: 3, of: 4 });
  albumA.saveNow();
  await settled(hostA);
  const first = await record();
  check('서버 런타임이 앨범 키를 받아 저장한다', first?.cards.library.named === true && first?.placePlays.gate === 1, `상태 ${hostA.status().phase}`);

  // ② 저장이 빈 새 기기(새 프로필)에서 같은 계정으로 앨범 · 이름 · 장소 열림
  const b = device(actor); const hostB = await b.begin(accountId);
  const albumB = await open(b, accountId);
  check('새 기기에 앨범과 이름이 그대로', albumB.album.cards.library?.named === true && albumB.album.cards.cat?.named === false);
  check('새 기기에서 다음 장소가 잠기지 않는다', (albumB.album.placePlays.gate || 0) > 0);
  check('받기만 한 기기는 계정에 다시 쓰지 않는다', hostB.status().pending === 0);

  // ③ 두 기기를 번갈아 쓰기 — 탭을 켜 둔 채 다른 기기에서 놀다 돌아와도 충돌 화면이 없다
  addCard(albumB.album, shot('bank'), 'gate', 300); nameCard(albumB.album, 'bank', 301); albumB.saveNow();
  await settled(hostB);
  const albumA2 = albumA; // 기기 A는 그대로 켜 둔 채
  await hostA.retry(); // 화면이 다시 보일 때 호스트가 하는 일
  check('다른 기기에서 붙인 이름이 들어온다', albumA2.album.cards.bank?.named === true);
  addCard(albumA2.album, shot('dorm'), 'gate', 400); nameCard(albumA2.album, 'dorm', 401); albumA2.saveNow();
  await settled(hostA);
  const both = await record();
  check('번갈아 써도 충돌 없이 합쳐진다', hostA.status().phase !== 'conflict' && ['bank', 'cat', 'dorm', 'library'].every((id) => both.cards[id]), Object.keys(both.cards).sort().join(', '));

  // ④ 이미 기기에 쌓인 앨범을 계정으로 옮김(사본은 남는다) · 두 값이 다르면 이름 쪽으로
  const actor2 = await f.actor();
  const reader2 = clientOf(actor2.handler);
  const { accountId: id2 } = await reader2.load();
  const legacy = emptyAlbum(); addCard(legacy, shot('library'), 'gate', 100); nameCard(legacy, 'library', 101);
  const key2 = `${STORE_KEY}:${id2}`;
  const c = device(actor2, { [key2]: JSON.stringify(legacy) }); const hostC = await c.begin(id2);
  await open(c, id2);
  await settled(hostC);
  const moved = JSON.parse((await reader2.load()).state.records[STORE_KEY]);
  check('기기 앨범이 계정으로 옮겨 간다', moved.cards.library.named === true);
  check('기기 사본은 지우지 않는다', !!c.storage.getItem(key2));
  const unnamed = emptyAlbum(); addCard(unnamed, shot('library'), 'gate', 50); addCard(unnamed, shot('cat'), 'gate', 60); nameCard(unnamed, 'cat', 61);
  const d = device(actor2, { [key2]: JSON.stringify(unnamed) }); const hostD = await d.begin(id2);
  const merged = await open(d, id2);
  await settled(hostD);
  const saved = JSON.parse((await reader2.load()).state.records[STORE_KEY]);
  check('두 값이 다르면 어느 쪽 이름도 잃지 않는다', saved.cards.library.named === true && saved.cards.cat.named === true && merged.album.cards.library.at === 50);

  // ⑤ 다른 계정에는 안 보이고, 낱말을 다 모은 앨범도 실제 서버 한도 안이다
  const other = clientOf((await f.actor()).handler);
  check('다른 계정에는 보이지 않는다', (await other.load()).state.records[STORE_KEY] === undefined);
  const actor3 = await f.actor(); const reader3 = clientOf(actor3.handler); const { accountId: id3 } = await reader3.load();
  const e = device(actor3); const hostE = await e.begin(id3);
  const full = await open(e, id3);
  const scene = Array.from({ length: 7 }, (_, i) => ({ q: Q, text: `판 글자 ${i}`, style: 'blade' }));
  for (const id of Object.keys(WORDS)) { addCard(full.album, shot(id), 'gate', 1793000000000); full.album.cards[id].scene = scene; nameCard(full.album, id, 1793000000001); }
  full.saveNow();
  await settled(hostE);
  const raw = (await reader3.load()).state.records[STORE_KEY];
  check('낱말을 다 모은 앨범도 저장된다', JSON.parse(raw).cards && Object.keys(JSON.parse(raw).cards).length === Object.keys(WORDS).length, `${Object.keys(WORDS).length}장 · ${Buffer.byteLength(raw)}바이트`);
} finally {
  await f.close();
}
const bad = checks.filter((ok) => !ok).length;
console.log(bad ? `✗ ${bad}/${checks.length} 실패` : `✓ ${checks.length}건 모두 통과`);
process.exit(bad ? 1 : 0);
