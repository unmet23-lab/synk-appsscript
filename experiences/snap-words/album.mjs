// 찰칵 낱말 — 앨범 저장(설계 5-4). 계정 놀이 기록이 정본이고, 기기 사본은 늘 함께 쓴다.
// 그래서 계정 저장이 막혀도 앨범은 비지 않고, 다음에 열 때 두 값을 합쳐 계정으로 올린다. 카드는 더해지기만 하므로 합치면 이름을 잃지 않는다.
import { STORE_KEY, normalizeAlbum } from './core.mjs';

/** 계정 쓰기 간격 — 앨범은 수십 KB이고 쓰기 한 번에 앞 값과 함께 간다. 찍을 때마다 보내지 않고 모아서 보낸다(기기 사본은 그때그때 쓴다). */
export const ACCOUNT_WRITE_GAP_MS = 8000;
const READY_LIMIT_MS = 5000;

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const parse = (raw) => { if (typeof raw !== 'string') return null; try { const v = JSON.parse(raw); return v && typeof v === 'object' && !Array.isArray(v) ? v : null; } catch { return null; } };
/** 칸 순서만 다른 두 값을 같다고 보려고 칸을 줄 세워 적는다. */
const canon = (v) => JSON.stringify(v, (_, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : x));
const hasContent = (a) => Object.keys(a.cards).length > 0 || a.plays > 0 || Object.keys(a.daily).length > 0 || num(a.noticesAt) > 0;

/** 사진은 먼저 찍은 쪽(어느 기기에서 합쳐도 답이 같다), 이름은 어느 쪽이든 붙었으면 붙은 것이다. */
function mergeCard(x, y) {
  if (!x || !y) return x || y;
  const xFirst = x.at !== y.at ? x.at < y.at : canon(x) <= canon(y);
  const first = xFirst ? x : y, later = xFirst ? y : x;
  const { namedAt: _drop, ...card } = first;
  card.scene = first.scene?.length ? first.scene : later.scene || [];
  card.named = !!(x.named || y.named);
  const namedAts = [x, y].filter((c) => c.named && c.namedAt).map((c) => c.namedAt);
  if (namedAts.length) card.namedAt = Math.min(...namedAts);
  return card;
}
/** 내 기록은 합쳐도 깨지지 않는 값만: 가장 빠른 시간 · 가장 많이 한 번에 찾은 수. */
function mergeBest(x, y) {
  const ok = [x, y].filter((b) => b && Number.isFinite(b.ms));
  if (!ok.length) return x || y;
  return { ms: Math.min(...ok.map((b) => b.ms)), first: Math.max(...ok.map((b) => num(b.first))), of: Math.max(...ok.map((b) => num(b.of))) };
}
/** 이어 한 날: 합친 달력에서 마지막 날부터 끊기지 않고 이어진 날 수. 기기마다 센 수를 더하면 부풀므로 달력에서 다시 센다. */
function dailyRun(daily, fallback) {
  const days = Object.keys(daily).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  if (!days.length) return fallback;
  let run = 1;
  for (let i = days.length - 1; i > 0; i -= 1) { if (Date.parse(`${days[i]}T00:00:00Z`) - Date.parse(`${days[i - 1]}T00:00:00Z`) !== 86400000) break; run += 1; }
  return run;
}
const keysOf = (...objs) => [...new Set(objs.flatMap((o) => Object.keys(o)))];
/**
 * 두 앨범을 합친다. 몇 번을 합쳐도, 어느 기기에서 합쳐도 같은 답이 나오도록 판 수는 더하지 않고 큰 쪽을 쓴다.
 * 안내문 켜기만 사용자의 선택이라 나중에 바꾼 쪽을 따르고, 언제 바꿨는지 모르면 primary(계정 값)를 따른다.
 */
export function mergeAlbums(primary, other) {
  const a = normalizeAlbum(primary), b = normalizeAlbum(other);
  const cards = {}, stamps = {}, placePlays = {}, best = {};
  for (const id of keysOf(a.cards, b.cards)) cards[id] = mergeCard(a.cards[id], b.cards[id]);
  for (const id of keysOf(a.stamps, b.stamps)) { const at = [a.stamps[id], b.stamps[id]].map(num).filter(Boolean); stamps[id] = at.length ? Math.min(...at) : a.stamps[id] ?? b.stamps[id]; }
  for (const id of keysOf(a.placePlays, b.placePlays)) placePlays[id] = Math.max(num(a.placePlays[id]), num(b.placePlays[id]));
  for (const id of keysOf(a.best, b.best)) best[id] = mergeBest(a.best[id], b.best[id]);
  const daily = { ...a.daily, ...b.daily }, bLater = num(b.noticesAt) > num(a.noticesAt), noticesAt = Math.max(num(a.noticesAt), num(b.noticesAt));
  const merged = { ...b, ...a, cards, stamps, daily, placePlays, best, plays: Math.max(a.plays, b.plays), streak: dailyRun(daily, Math.max(a.streak, b.streak)), notices: bLater ? b.notices : a.notices };
  if (noticesAt) merged.noticesAt = noticesAt; else delete merged.noticesAt;
  return merged;
}

/** 같은 출처 부모 창의 계정 놀이 호스트. 손님 체험 호스트는 계정이 아니다. */
export function findPlayHost(win) {
  try {
    let scope = win;
    for (let depth = 0; depth < 6; depth += 1) {
      if (scope?.SYNKPlayHost) return scope.SYNKPlayHost.trial ? null : scope.SYNKPlayHost;
      if (!scope?.parent || scope.parent === scope) break;
      if (scope.parent.location.origin !== scope.location.origin) break;
      scope = scope.parent;
    }
  } catch { /* 다른 출처 틀은 계정을 빌리지 못한다 */ }
  return null;
}

/**
 * 앨범을 연다: 계정 값 + 이 기기의 사본(이 계정 것만 — 손님 사본은 옮기지 않는다)을 합쳐 돌려주고, 달라진 것이 있으면 계정으로 올린다.
 * 옛 호스트(키를 모른다)에서는 getItem이 던지므로 이번에는 기기 사본만 쓴다. 지금 값은 지우지 않는다.
 */
export async function openAlbumStore({ win = globalThis.window, storage = win.localStorage, accountKey = 'device', gapMs = ACCOUNT_WRITE_GAP_MS, readyMs = READY_LIMIT_MS } = {}) {
  const host = findPlayHost(win);
  let port = null, seen = null, rejectedAtOpen = 0, accountId = null;
  if (host) {
    try {
      let limit;
      await Promise.race([host.ready(), new Promise((_, reject) => { limit = setTimeout(() => reject(Error('PLAY_READY_TIMEOUT')), readyMs); })]).finally(() => clearTimeout(limit));
      const status = host.status();
      accountId = status.accountId || null; rejectedAtOpen = status.rejected || 0;
      const candidate = host.storage(), raw = candidate.getItem(STORE_KEY);
      // 뒤에 나온 판이 쓴 기록은 이 판이 합쳐 덮지 않는다.
      if (raw === null || parse(raw)?.v === 1) { port = candidate; seen = raw; }
    } catch { port = null; seen = null; }
  }
  const deviceKey = `${STORE_KEY}:${accountKey === 'device' && accountId ? accountId : accountKey}`;
  const copies = [...new Set([deviceKey, ...(accountId ? [`${STORE_KEY}:${accountId}`, `${STORE_KEY}:local:${accountId}`] : [])])]
    .map((key) => { try { return parse(storage.getItem(key)); } catch { return null; } }).filter(Boolean);
  const device = copies.length ? copies.reduce((acc, one) => mergeAlbums(acc, one)) : null;
  const remote = parse(seen);
  const existed = !!(remote || device);
  const album = remote && device ? mergeAlbums(remote, device) : normalizeAlbum(remote || device);

  let dirty = false, timer = null, accountFailed = false;
  const writeDevice = () => { try { storage.setItem(deviceKey, JSON.stringify(album)); return true; } catch { return false; } };
  function push() {
    clearTimeout(timer); timer = null;
    if (!port || !dirty) return;
    try { if ((host.status().rejected || 0) > rejectedAtOpen) { port = null; accountFailed = true; return; } } catch { /* 아래 setItem이 판단한다 */ }
    dirty = false;
    const value = JSON.stringify(album), before = seen;
    if (value === seen) return;
    seen = value; // setItem이 상태를 알려 absorb를 다시 부른다 — 그때 「내가 쓴 값」으로 보이게 먼저 적는다.
    try { port.setItem(STORE_KEY, value); accountFailed = false; }
    catch { seen = before; dirty = true; accountFailed = true; /* 기기 사본이 있다. 다음 저장이나 다음에 열 때 다시 올린다 */ }
  }
  const pushSoon = () => { dirty = true; if (port && !timer) timer = setTimeout(push, gapMs); };
  // 다른 기기가 쓴 값이 호스트에 들어오면(다시 보일 때 호스트가 새로 읽는다) 합쳐 둔다. 그래야 다음 쓰기가 낡은 값 위에 쓰지 않아 충돌 화면이 뜨지 않는다.
  function absorb() {
    if (!port) return;
    let raw; try { raw = port.getItem(STORE_KEY); } catch { return; }
    if (raw === seen) return;
    seen = raw;
    const theirs = parse(raw);
    if (raw !== null && theirs?.v !== 1) { port = null; return; }
    if (theirs) {
      const merged = mergeAlbums(theirs, album);
      for (const key of Object.keys(album)) if (!(key in merged)) delete album[key];
      Object.assign(album, merged);
      writeDevice();
      if (canon(merged) === canon(normalizeAlbum(theirs))) return;
    }
    pushSoon();
  }
  let unsubscribe = null;
  if (port) try { unsubscribe = host.subscribe(absorb); } catch { /* 없으면 합치기는 다음에 열 때 */ }

  if (hasContent(album)) {
    writeDevice();
    if (port && canon(album) !== canon(normalizeAlbum(remote))) { dirty = true; push(); }
  }
  const flush = () => { if (dirty) push(); };
  win.addEventListener?.('pagehide', () => { flush(); unsubscribe?.(); });
  win.document?.addEventListener?.('visibilitychange', () => { if (win.document.visibilityState === 'hidden') flush(); });

  return Object.freeze({
    album, existed,
    /** 기기 사본은 바로, 계정은 모아서. */
    save() { writeDevice(); pushSoon(); },
    /** 판 끝 · 화면을 떠날 때: 계정도 바로. */
    saveNow() { writeDevice(); dirty = true; push(); },
    status: () => ({ account: !!port, pending: dirty, accountFailed, deviceKey }),
  });
}
