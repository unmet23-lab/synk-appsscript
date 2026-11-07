// Reed 「녹음 중에는 0」(2026-11-08, docs/_ops/qa/atlas-world-engine-20261108/설계.md §3 B).
// ① WORLD 공통 소리(world-sound.mjs)와 드라마 시범판(takes.mjs)의 마이크 알림 사본이 같은 상황에서 같은 저장 · 알림을 낸다.
// ② 녹음 주체마다 따로: 두 창이 녹음하다 한 창만 끝내도 공유 열쇠가 남는다(검수 GA2). 15초 지난 주체는 세지 않는다.
// ③ 마이크가 열린 동안 효과음 · 이야기 말소리는 0이고 끝난 뒤 몰아 내지 않는다. 캐릭터 반응(화면)과 미리 굽기(render)는 그대로다(검수 A3).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// 브라우저 대신: 저장소 · 소리 그래프만 흉내 낸다(실제 기기 소리는 화면 검수에서 본다).
class Store {
  constructor() { this.m = new Map(); }
  get length() { return this.m.size; }
  key(i) { return [...this.m.keys()][i] ?? null; }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
  snapshot() { return Object.fromEntries([...this.m].sort(([a], [b]) => a.localeCompare(b))); }
}
const counters = { nodes: 0 };
const fake = () => new Proxy(function () {}, {
  get(t, k) { if (k === 'then') return undefined; if (!(k in t)) t[k] = fake(); return t[k]; },
  set(t, k, v) { t[k] = v; return true; },
  apply() { return fake(); },
});
class FakeAudioContext {
  constructor() { this.state = 'running'; this.currentTime = 0; this.sampleRate = 48000; this.destination = fake(); }
  createGain() { counters.nodes++; return fake(); }
  createBiquadFilter() { counters.nodes++; return fake(); }
  createOscillator() { counters.nodes++; return fake(); }
  createBufferSource() { counters.nodes++; return fake(); }
  createBuffer(_c, length) { return { getChannelData: () => new Float32Array(length) }; }
  resume() { return Promise.resolve(); }
}
const store = new Store();
globalThis.localStorage = store;
globalThis.AudioContext = FakeAudioContext;
delete globalThis.BroadcastChannel;   // 시험 프로세스가 열린 통로로 멈추지 않게(알림은 저장 결과로 본다)
const sound = await import('../experiences/brand-opening/world-sound.mjs');
const drama = await import('../experiences/drama/pilot/takes.mjs');

// 주체 하나 = 창 하나(같은 저장소를 나눠 쓴다).
function harness(factory) {
  const storage = new Store(), messages = [];
  let t = 1_000_000, nextId = 1; const timers = new Map();
  const make = owner => factory({ storage, owner, now: () => t, bus: () => ({ postMessage: m => messages.push({ ...m, at: t }) }),
    every: (fn, ms) => { const id = nextId++; timers.set(id, { fn, ms, owner }); return id; }, stop: id => timers.delete(id) });
  // 주체 열쇠 없는 옛 판 창: 공유 열쇠 하나를 5초마다 쓰고, 끝낼 때 지운다.
  const older = { beat: () => storage.setItem('synk.world.mic', String(t)), end: () => storage.removeItem('synk.world.mic') };
  return { storage, messages, make, older, advance: ms => { t += ms; }, beatAll: () => { for (const { fn } of timers.values()) fn(); },
    beatOf: owner => { for (const x of [...timers.values()]) if (x.owner === owner) x.fn(); }, now: () => t };
}
const OLDER = 'synk.world.mic:~older';   // 새 판들이 함께 기억하는 옛 판의 마지막 박동
// 같은 순서를 두 사본에 돌린다.
function scenario(factory) {
  const h = harness(factory), log = [];
  const a = h.make('a'), b = h.make('b');
  a.set(true); h.advance(1000); b.set(true); log.push(h.storage.snapshot());
  h.advance(1000); a.set(false); log.push(h.storage.snapshot());           // 다른 주체(b)가 녹음 중 — 공유 열쇠는 b의 시각으로 남는다
  h.advance(1000); b.set(false); log.push(h.storage.snapshot());           // 모두 끝 — 공유 열쇠를 지운다
  const c = h.make('c'), d = h.make('d');
  c.set(true); d.set(true); h.advance(20000); c.set(false); log.push(h.storage.snapshot());   // d는 20초 박동 없음(멈춘 창) — 세지 않는다
  h.storage.removeItem('synk.world.mic:d');
  const e = h.make('e'); e.set(true); h.advance(500); h.storage.setItem('synk.world.mic', String(h.now()));   // 주체 열쇠 없는 옛 판이 늦게 씀
  h.advance(500); e.set(false); log.push(h.storage.snapshot());
  const f = h.make('f'); f.set(false); log.push(h.storage.snapshot());       // 연 적 없는 주체의 닫기는 아무것도 바꾸지 않는다
  return { log, messages: h.messages };
}

test('the WORLD and drama copies of the microphone signal produce the same records and messages', () => {
  assert.deepEqual(scenario(drama.createMicSignal), scenario(sound.createMicSignal));
  assert.equal(drama.MIC_KEY, sound.MIC_KEY);
  assert.equal(drama.MIC_STALE_MS, sound.MIC_STALE_MS);
  const stay = JSON.parse(fs.readFileSync(new URL('../experiences/synk-town/town/data/stay.json', import.meta.url), 'utf8'));
  assert.equal(stay.sound.record.staleMs, sound.MIC_STALE_MS, 'the town reads the same freshness');
});

test('one owner ending keeps the shared key while another still records; only the last one closes it', () => {
  const { log, messages } = scenario(sound.createMicSignal);
  assert.equal(log[0]['synk.world.mic'], '1001000');
  assert.equal(log[1]['synk.world.mic'], '1001000', 'b still records: the shared key keeps b’s beat');
  assert.equal(log[1]['synk.world.mic:a'], undefined);
  assert.equal(log[2]['synk.world.mic'], undefined, 'all owners ended');
  assert.equal(log[3]['synk.world.mic'], undefined, 'a stale owner (20s without a beat) is not counted');
  assert.equal(log[4]['synk.world.mic'], String(1_000_000 + 1000 + 1000 + 1000 + 20000 + 500), 'a later beat from an old copy without owner keys is kept');
  assert.deepEqual(log[5], log[4], 'closing an owner that never opened changes nothing');
  const closes = messages.filter(m => m.open === false).length, reopens = messages.filter(m => m.open === true).length;
  assert.equal(closes, 2); assert.ok(reopens >= 6);
});

// 주체 열쇠 없는 옛 판(공개 직후 캐시 10분 동안 남는 창)과 섞일 때(검수 GPT B1). 옛 판은 공유 열쇠 하나를 5초마다 쓰고 끝낼 때 지운다.
function olderCopyScenario(factory) {
  const h = harness(factory), log = [];
  const olderBeat = h.older.beat, olderEnd = h.older.end;
  olderBeat(); h.advance(1000);
  const n = h.make('n'); n.set(true); h.advance(1000); n.set(false); log.push([h.storage.snapshot(), h.messages.at(-1).open]);   // 옛 창이 박동한 뒤 새 녹음이 시작 · 먼저 끝남
  olderBeat(); h.advance(1000);
  const m = h.make('m'); m.set(true); h.advance(4000); olderBeat(); h.advance(1000); h.beatAll(); h.advance(1000); m.set(false); log.push([h.storage.snapshot(), h.messages.at(-1).open]);   // 옛 창이 새 녹음 사이에도 박동
  olderBeat(); h.advance(1000);
  const k = h.make('k'); k.set(true); h.advance(1000); olderEnd(); h.advance(1000); k.set(false); log.push([h.storage.snapshot(), h.messages.at(-1).open]);   // 옛 창이 먼저 끝내고 지움 — 다시 세우지 않는다
  olderBeat(); h.advance(1000);
  const j = h.make('j'); j.set(true); h.advance(1000); olderEnd(); h.advance(1000); h.beatAll(); h.advance(1000); j.set(false); log.push([h.storage.snapshot(), h.messages.at(-1).open]);   // 지운 뒤 내 박동이 한 번 더 — 그래도 옛 시각을 되살리지 않는다
  olderBeat(); h.advance(16000);
  const s = h.make('s'); s.set(true); h.advance(1000); s.set(false); log.push([h.storage.snapshot(), h.messages.at(-1).open]);   // 16초 지난 옛 시각은 닫힌 것
  return log;
}

test('an older copy without owner keys keeps the silence when a newer recording starts after its beat and ends first', () => {
  const log = olderCopyScenario(sound.createMicSignal);
  assert.deepEqual(olderCopyScenario(drama.createMicSignal), log, 'the WORLD and drama copies agree');
  assert.deepEqual(log[0], [{ 'synk.world.mic': '1000000', [OLDER]: '1000000' }, true], 'the older window still records: its beat stays and others hear “open”');
  const mid = String(1_000_000 + 2000 + 1000 + 4000);
  assert.deepEqual(log[1], [{ 'synk.world.mic': mid, [OLDER]: mid }, true], 'its beat during my take is kept too');
  assert.deepEqual(log[2], [{}, false], 'once the older window ended and removed the key, nothing revives its beat');
  assert.deepEqual(log[3], [{}, false], 'nor after another beat of mine');
  assert.deepEqual(log[4], [{}, false], 'a 16 s old beat counts as closed');
});

// 다시 검수 GA1: 옛 창 0초, 새 A 1초 · B 2초 시작 → 옛 창 5초 · A 6초 박동 → 옛 창 6.5초 끝(지움) → B 7초 박동 · 7.5초 끝 → A 8초 끝.
// B가 곧바로 공유 열쇠를 다시 채워 A는 빈 열쇠를 못 본다 — 빈 열쇠를 본 B가 함께 쓰는 기억을 지워, 모두 끝난 뒤 열쇠가 남지 않는다.
function threeWindows(factory) {
  const h = harness(factory), log = [];
  h.older.beat(); h.advance(1000);
  const a = h.make('a'); a.set(true); h.advance(1000);
  const b = h.make('b'); b.set(true); h.advance(3000);
  h.older.beat(); h.advance(1000); h.beatOf('a'); h.advance(500);
  h.older.end(); h.advance(500); h.beatOf('b'); h.advance(500);
  b.set(false); log.push([h.storage.snapshot(), h.messages.at(-1).open]);   // A가 아직 녹음 — A의 시각으로 남는다
  h.advance(500); a.set(false); log.push([h.storage.snapshot(), h.messages.at(-1).open]);
  return log;
}

// 다시 검수 FA1: 한 창은 주체 하나를 테이크마다 다시 연다(드라마 micSignal ||= · WORLD micDefault ||=). 둘째 테이크도 옛 판 시각을 기억해야 한다.
function sameOwnerTwice(factory) {
  const h = harness(factory), log = [];
  h.older.beat(); h.advance(1000);
  const n = h.make('n'); n.set(true); h.advance(1000); n.set(false); log.push([h.storage.snapshot(), h.messages.at(-1).open]);
  h.advance(1000); n.set(true); h.advance(1000); n.set(false); log.push([h.storage.snapshot(), h.messages.at(-1).open]);   // 옛 창은 아직 다음 박동 전(4초)
  return log;
}

test('a reopened owner remembers the older window’s beat again on its next take', () => {
  const log = sameOwnerTwice(sound.createMicSignal);
  assert.deepEqual(sameOwnerTwice(drama.createMicSignal), log, 'the WORLD and drama copies agree');
  assert.deepEqual(log[0], [{ 'synk.world.mic': '1000000', [OLDER]: '1000000' }, true]);
  assert.deepEqual(log[1], [{ 'synk.world.mic': '1000000', [OLDER]: '1000000' }, true], 'the second take of the same owner keeps the older window’s beat too');
});

// 무작위 시험에서 찾은 순서: 옛 창의 박동을 본 새 창 A가, 그것을 못 본 새 창 B보다 먼저 끝난다. 기억이 A 안에만 있으면 B가 끝날 때 열쇠를 지운다.
function firstWitnessEndsFirst(factory) {
  const h = harness(factory), log = [];
  h.older.beat(); h.advance(2750);
  const a = h.make('a'); a.set(true); h.advance(250);   // A가 옛 박동을 본다
  const b = h.make('b'); b.set(true); h.advance(250);   // B는 A의 시각만 본다
  a.set(false); b.set(false); log.push([h.storage.snapshot(), h.messages.at(-1).open]);   // 옛 창은 아직 녹음 중(다음 박동은 5초에)
  return log;
}

test('the older window’s beat is shared memory: the last new window to end still knows it', () => {
  const log = firstWitnessEndsFirst(sound.createMicSignal);
  assert.deepEqual(firstWitnessEndsFirst(drama.createMicSignal), log, 'the WORLD and drama copies agree');
  assert.deepEqual(log[0], [{ 'synk.world.mic': '1000000', [OLDER]: '1000000' }, true]);
});

test('an older window that ended while another new window refilled the key is not revived by the last one to end', () => {
  const log = threeWindows(sound.createMicSignal);
  assert.deepEqual(threeWindows(drama.createMicSignal), log, 'the WORLD and drama copies agree');
  assert.deepEqual(log[0], [{ 'synk.world.mic': String(1_000_000 + 6000), 'synk.world.mic:a': String(1_000_000 + 6000) }, true], 'A still records');
  assert.deepEqual(log[1], [{}, false], 'everyone ended: the shared key is gone and others hear “closed”');
});

// 무작위로 섞기(고정 씨앗): 옛 판 · 새 판 창 2~4개가 녹음을 켜고 끈다. 창마다 시계가 조금씩 어긋난다(같은 밀리초에 쓰지 않는다).
// ① 누가 녹음 중이면 공유 열쇠는 15초 안이다 — 옛 판이 끝내며 지운 뒤 5초(옛 판 규약 탓)만 뺀다. ② 아무도 녹음하지 않으면 공유 열쇠가 없다.
function randomMixes(factory, runs) {
  let seed = 20261108; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let run = 0; run < runs; run++) {
    const store = new Store(); let t = 1_000_000;
    const wins = Array.from({ length: 2 + Math.floor(rnd() * 3) }, (_, i) => ({ id: `w${i}`, old: rnd() < 0.4, rec: false, next: 0, timers: new Map(), off: 1 + i * 53 + Math.floor(rnd() * 40) }));
    for (const w of wins) if (!w.old) {
      let n = 0;
      w.sig = factory({ storage: store, owner: w.id, now: () => t + w.off, bus: () => null,
        every: (fn, ms) => { w.timers.set(++n, { fn, ms, at: t + w.off + ms }); return n; }, stop: k => w.timers.delete(k) });
    }
    let olderEnded = -Infinity; const log = [];
    for (let step = 0; step < 600; step++) {
      t += 250;
      for (const w of wins) {
        const at = t + w.off;
        if (w.old && w.rec && at >= w.next) { store.setItem('synk.world.mic', String(at)); w.next = at + 5000; }
        if (!w.old) for (const x of [...w.timers.values()]) if (at >= x.at) { x.at += x.ms; x.fn(); }
        if (rnd() < 0.02) {
          w.rec = !w.rec; log.push(`${at - 1_000_000}:${w.id}${w.old ? '(옛)' : ''}${w.rec ? '+' : '-'}`);
          if (!w.old) w.sig.set(w.rec);
          else if (w.rec) { store.setItem('synk.world.mic', String(at)); w.next = at + 5000; }
          else { store.removeItem('synk.world.mic'); olderEnded = at; }
        }
      }
      const end = t + 250, raw = store.getItem('synk.world.mic'), recording = wins.some(w => w.rec);
      if (recording && end - olderEnded > 5250) assert.ok(raw != null && end - Number(raw) < 15000, `새어 남 run ${run}: ${log.join(' ')}`);
      if (!recording) assert.equal(raw, null, `오래 막음 run ${run}: ${log.join(' ')}`);
    }
  }
}

test('random mixes of older and newer windows neither leak sound into a recording nor keep the key after everyone stopped', () => {
  randomMixes(sound.createMicSignal, 400);
  randomMixes(drama.createMicSignal, 400);
});

test('while the microphone is open WORLD sounds are dropped, not queued; reactions and offline rendering still run', () => {
  store.m.clear(); counters.nodes = 0;
  assert.equal(sound.micOpen(), false);
  assert.equal(sound.play('tap'), true, 'a normal tap sounds');   // 첫 소리는 소리 길(master)까지 연다
  counters.nodes = 0; assert.equal(sound.play('tap'), true);
  const normal = counters.nodes; assert.ok(normal > 0);
  sound.recordingSignal(true);
  try {
    assert.equal(sound.micOpen(), true);
    counters.nodes = 0;
    assert.equal(sound.play('tap'), false); assert.equal(sound.play('ok'), false);
    assert.equal(sound.haptic('ok'), false);
    const line = sound.storyVoice('mongle', '안녕하세요.');
    assert.equal(line.at(0), false, 'live story voice is silent');
    assert.equal(counters.nodes, 0, 'no sound graph was built while recording');
    let reacted = null; sound.verdict(true, { react: ok => { reacted = ok; } });
    assert.equal(reacted, true, 'the character reaction is visual and still runs');
    const ctx = new FakeAudioContext();
    assert.equal(sound.storyVoice('mongle', '안녕하세요.', { render: { ctx, dest: ctx.destination } }).at(0), true, 'offline rendering is not a playback');
  } finally { sound.recordingSignal(false); }
  counters.nodes = 0;
  assert.equal(sound.micOpen(), false);
  assert.equal(sound.play('tap'), true, 'sound returns after recording');
  assert.equal(counters.nodes, normal, 'only the new tap — nothing that was dropped is replayed');
});

test('another window’s fresh microphone beat silences this window; a 15 s old beat does not', () => {
  store.m.clear();
  store.setItem('synk.world.mic', String(Date.now()));
  assert.equal(sound.micOpen(), true); assert.equal(sound.play('tap'), false);
  store.setItem('synk.world.mic', String(Date.now() - 15001));
  assert.equal(sound.micOpen(), false); assert.equal(sound.play('tap'), true);
  store.m.clear();
});

test('a 20 s take keeps the shared key fresh with 5 s beats (other windows use a 15 s freshness)', () => {
  const h = harness(sound.createMicSignal), take = h.make('take');
  take.set(true);
  for (let s = 0; s < 20; s += 5) { h.advance(5000); h.beatAll(); assert.ok(h.now() - Number(h.storage.getItem('synk.world.mic')) < sound.MIC_STALE_MS); }
  take.set(false); assert.equal(h.storage.getItem('synk.world.mic'), null);
});

test('this window stays silent while it records even when storage is blocked or a second copy of the module is loaded', async () => {
  const blocked = { get length() { throw new Error('blocked'); }, key() { throw new Error('blocked'); }, getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  globalThis.localStorage = blocked;
  const twin = await import('../experiences/brand-opening/world-sound.mjs?twin');   // 한 문서에 든 두 번째 사본
  try {
    sound.recordingSignal(true);
    assert.equal(sound.micOpen(), true); assert.equal(sound.play('tap'), false);
    assert.equal(twin.micOpen(), true, 'the other copy in the same window knows'); assert.equal(twin.play('tap'), false);
  } finally { sound.recordingSignal(false); globalThis.localStorage = store; }
  assert.equal(twin.micOpen(), false);
});

test('the drama pilot opens the signal right before recording and closes it in the single finish of a take', () => {
  const pilot = fs.readFileSync(new URL('../experiences/drama/pilot/pilot.mjs', import.meta.url), 'utf8');
  assert.match(pilot, /import \{[^}]*createMicSignal[^}]*\} from '\.\/takes\.mjs';/);
  assert.match(pilot, /S\.rec = state;\s*micSet\(true\);\s*try \{ rec\.start\(250\); \}/);
  assert.match(pilot, /stopStream\(stream\);[^\n]*\n(?:\s*\/\/[^\n]*\n)?\s*if \(S\.rec === state\) \{ S\.rec = null; micSet\(false\); \}/, 'only the take that still holds the recorder closes the signal');
  assert.equal(pilot.match(/micSet\(false\)/g).length, 1, 'one close');
  assert.equal(pilot.split("'./takes.mjs'").length, 2, 'the public build still sees exactly one takes.mjs import');
});
