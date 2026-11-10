'use strict';
/* 돌림표 셈(2026-11-10 LAB 하루 두 편 · 39계정 — 설계 2 · 3, docs/마케팅/LAB_하루두편_설계_20261110/README.md). 읽기만 한다.
 *
 * 원본은 매일 이야기 1편 · 노래 1편(11-10 밤 21:00 칸이 퀴즈에서 노래로 — 퀴즈는 예비 형식)이고, 계정마다 날짜를 어긋나게 돌린다(유호님 11-10 「국가별 계정마다 5일치 영상을 동일한걸
 * 업로드하는게 아니라 순서를 뒤죽박죽으로」). 지키는 것:
 *   ① 같은 플랫폼에서 같은 원본은 20시간 안에 두 번 나가지 않는다(⑫ — 10-26 「글자만 다른 거의 같은 영상이 같은 날 두 계정에」).
 *      시간대가 25개라 「같은 날」을 한국 날짜로 보면 멕시코 저녁 판과 몽골 다음 날 아침 판(10시간 차이)이 다른 날로 빠져나가고,
 *      24시간으로 보면 이웃 시간대의 이틀 잇단 13:00 판(21~23시간)까지 막혀 틱톡 다섯 곳도 못 채운다 — 그래서 20시간(11-10 Claude).
 *      유튜브만 언어가 다른 판은 같은 날 여러 채널에 갈 수 있고(한 원본이 하루 다섯 채널까지), 같은 언어 판은 20시간 안에 둘이 안 된다.
 *      「하루 다섯」은 현지 날짜 이름이 아니라 흐른 24시간으로 센다 — 날짜 이름으로 세면 시간대가 달라 이웃한 두 날의 판이
 *      실제 24시간 안에 여덟아홉 채널까지 몰렸다(11-10 Fable 검수 · 재 본 값 8). 앞 날 판 · 이미 있는 판도 같이 센다.
 *   ② 씨앗 먼저: 원본은 씨앗 계정(sns-계정.json rotationSeed)이 먼저 올리고, 다른 계정은 씨앗 첫 판에서 24시간 넘게 지난 뒤(14시 점검 때 씨앗의 24시간 숫자가 있게)
 *      첫 한국 시각 14시(14시 게시 회차의 비상 정지 점검 — 설계 3) 뒤 칸에만 잇는다.
 *      씨앗 첫 판은 플랫폼을 가리지 않는다(그 원본을 가장 먼저 올린 씨앗 계정 하나 — 11-11 정함): 비상 정지 점검이 씨앗 계정 전체의 24시간
 *      숫자 과반으로 가르고, 플랫폼마다 따로 기다리게 하면 씨앗이 없는 플랫폼(VK · RUTUBE · 더우인)과 몽골 원본을 받지 않는 유튜브 씨앗
 *      (@synkkorean — 영어판) 쪽 계정은 영영 못 받는다. 첫 판 시험(trial) 계정은 걸리지 않은 채 지나간 판을 「판 하나」로 세지 않는다.
 *   ③ 한 계정은 같은 원본을 두 번 올리지 않는다. 칸 형식(dailyFormats — 13:00 이야기 · 21:00 노래)이 원본 형식과 같아야 한다.
 *   ④ 순서 섞기: 계정마다 가장 오래 기다린 원본 다섯(창) 가운데서 계정 이름으로 정한 순서(같은 입력이면 늘 같은 표)로 고르고,
 *      한 플랫폼 · 한 날 · 한 형식 칸들은 맞물림(증가 경로)으로 가장 많이 채운다 — 원본이 모자라면 빈 칸이 남는다
 *      (틱톡 7곳은 원본 7편이 쌓이기 전까지 다 못 채운다).
 *   ⑤ 멈춘 원본(돌림.멈춤)은 쓰지 않고, 예비편(돌림.예비)은 useSpares일 때만 쓴다(설계 21).
 *   ⑥ 같은 언어 묶음(유호님 11-10 지적 — 같은 언어를 쓰는 나라 계정끼리 같은 영상이 겹치지 않게): 같은 플랫폼에서 같은 말로 올리는 계정들
 *      (원장 languageGroup, 없으면 language — 유튜브 영어: 미국 · 캐나다 · 호주 · 뉴질랜드 · @synkkorean, 스페인어: 멕시코 · 파라과이)은
 *      같은 원본을 흐른 24시간 안에 둘이 받지 않고(어느 시간대의 달력으로 봐도 같은 날이 아니다), 같은 파일(같은 판본 지문 · 같은 판본 키)은
 *      날이 달라도 둘이 받지 않는다 — 나라마다 첫 카드 · 그 나라 예문 · 끝 질문 · 표지 · 게시글이 다른 나라별판이 따로 있어야 한다.
 *      배속 · 색을 몰래 바꿔 지문만 다르게 하는 길은 쓰지 않는다(설계 「하지 않는 것」).
 *   ⑦ 연재(차례 고정 — 11-10 밤 21:00 칸이 퀴즈에서 노래로 바뀌며: 이미 있는 한글 노래 여섯 곡은 앞 곡의 글자를 안다고 보고 만들어
 *      계정마다 1 → 6 차례를 지킨다): 원본이 series { id, order }를 달면 한 계정은 그 연재의 앞 차례를 받은 뒤에만(그 판 시각이 이 칸보다
 *      앞일 때만) 다음 차례를 받는다 — ④의 섞기보다 먼저다. 앞 차례 원본의 그 계정 판본이 아직 검수 전이거나 쓸 날 전이면 건너뛰지 않고
 *      기다린다(칸이 빈다). 멈춘 원본(⑤)과 안 쓰는 예비편만 있는 차례는 건너뛴다(한 곡의 비상 정지가 연재 전체를 세우지 않게).
 *      같은 날 같은 원본을 둘이 못 받는 플랫폼(①)에서는 이 규칙만으로 계정마다 시작 날이 하루씩 어긋난다(첫 곡을 하루에 한 계정씩).
 *      차례가 어긋나는 예외 둘 — 전환할 때뿐이다(11-11 Fable 검수): ⓐ 취소 · 지움 · 보류로 닫혔거나 걸리지 않은 채 지나간 앞 곡은 그 계정이
 *      받은 것으로 세어(③ — 같은 원본을 다시 주지 않는다) 그 곡 없이 다음 차례로 넘어간다. ⓑ 멈춘 차례를 건너뛴 계정은 그 차례가
 *      되살아나면(멈춤을 풂 · 예비를 켬) 그 곡을 뒤늦게 받아 1 → 3 → 2가 된다. 그래서 멈춤은 되돌리지 않고,
 *      고친 곡은 옛 곡을 멈춤 · 예비로 둔 채 새 원본을 같은 차례 번호로 넣는다(그 차례에 아직 안 온 계정은 차례대로 받는다).
 *      같은 차례 번호의 다른 원본(옛 곡)을 이미 받은 계정은 그 번호의 새 원본을 받지 않는다 — 같은 노래를 두 번 올리지 않는다(11-11 P3-4).
 *   형식은 FORMATS(이야기 · 노래 · 퀴즈) — 21:00 칸은 11-10 밤부터 「노래」다(퀴즈는 예비 형식으로 남는다).
 */
const crypto = require('node:crypto');
const T = require('./계정시간.js');

const DEFAULTS = Object.freeze({ followHours: 24, checkTime: '14:00', checkZone: 'Asia/Seoul', apartHours: 20, sameLanguageHours: 24, youtubeCap: 5, capHours: 24, window: 5 });
const HOUR = 3600000;
// 칸 · 원본 형식. 13:00 이야기 · 21:00 노래(11-10 밤 유호님 — 퀴즈 대신). 「퀴즈」는 만들어 둔 예비 원본 때문에 남긴다.
const FORMATS = Object.freeze(['이야기', '노래', '퀴즈']);

// 같은 언어 묶음 열쇠 — 원장 languageGroup(판은 필리핀어여도 채널 이름이 영어라 영어 묶음과 함께 보는 계정처럼), 없으면 language.
const groupOf = (a) => (a && (a.group || a.languageGroup || a.language)) || null;
// 같은 묶음인지. 말이 안 적힌 둘은 유튜브에서만 같은 말로 본다(옛 셈 그대로 — 다른 플랫폼은 어차피 플랫폼 전체가 20시간을 띄운다).
const sameGroup = (x, y, platform) => { const g = groupOf(x); return g === groupOf(y) && (g !== null || platform === 'youtube'); };
// 계정이 그 원본에서 올릴 파일 — 판본 지문, 없으면 판본 키(같은 키면 같은 파일이다).
const fileOf = (o, a) => o?.versions?.[a.versionKey]?.sha || (a.versionKey ? `판본:${a.versionKey}` : null);

function addDays(day, n) {
  const d = new Date(day + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const hashOf = (text) => crypto.createHash('sha256').update(text).digest('hex');

// 씨앗 첫 판 뒤 다른 계정이 이을 수 있는 가장 이른 때 — 24시간 뒤의 첫 한국 시각 14시(점검 때 씨앗의 24시간 숫자가 있어야 한다).
function checkpointOf(seedMs, cfg = DEFAULTS) {
  const after = seedMs + cfg.followHours * HOUR;
  const day = T.localDate(after, cfg.checkZone);
  let at = T.zonedMs(day, cfg.checkTime, cfg.checkZone);
  if (at < after) at = T.zonedMs(addDays(day, 1), cfg.checkTime, cfg.checkZone);
  return at;
}

// 원본 o를 계정 a의 칸(ms)에 둘 때 같은 플랫폼의 다른 판과 부딪히는지. 같은 언어 묶음은 24시간, 그 밖은 20시간(유튜브는 말이 다르면 안 부딪힌다).
function clashes(plates, account, ms, cfg) {
  return plates.some((p) => {
    if (p.platform !== account.platform) return false;
    const gap = Math.abs(p.ms - ms);
    if (sameGroup(p, account, account.platform)) return gap < Math.max(cfg.sameLanguageHours, cfg.apartHours) * HOUR;
    return account.platform !== 'youtube' && gap < cfg.apartHours * HOUR;
  });
}

// 같은 플랫폼 · 같은 언어 묶음의 다른 계정이 같은 파일을 이미 받았는지 — 받았으면 날이 달라도 주지 않는다(⑥).
function sameFile(plates, key, account, file) {
  return Boolean(file) && plates.some((p) => p.account !== key && p.platform === account.platform && sameGroup(p, account, account.platform) && p.file === file);
}

/**
 * overlaps(plates, accounts, cfg) — 같은 언어 묶음 겹침(⑥)을 판 목록에서 찾는다(셈이 아니라 확인 — 손으로 단 판 · 옛 판까지).
 *   plates: [{ original, account, ms, file }] · accounts: { key: { platform, language, group } }
 *   → [{ original, platform, group, a, b, hours, sameFile }] — 24시간 안이거나 같은 파일인 짝
 */
function overlaps(plates, accounts, given = {}) {
  const cfg = { ...DEFAULTS, ...given };
  const need = Math.max(cfg.sameLanguageHours, cfg.apartHours) * HOUR;
  const by = new Map();
  for (const p of plates) {
    const a = accounts[p.account];
    if (!a || !p.original || !groupOf(a)) continue;
    const k = `${p.original}|${a.platform}|${groupOf(a)}`;
    if (!by.has(k)) by.set(k, []);
    by.get(k).push({ ...p, platform: a.platform, group: groupOf(a) });
  }
  const out = [];
  for (const list of by.values()) {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const [x, y] = [list[i], list[j]];
      if (x.account === y.account) continue;
      const timed = Number.isFinite(x.ms) && Number.isFinite(y.ms);
      const close = timed && Math.abs(x.ms - y.ms) < need;
      const same = Boolean(x.file) && x.file === y.file;
      if (close || same) out.push({ original: x.original, platform: x.platform, group: x.group, a: x.account, b: y.account, hours: timed ? Math.round(Math.abs(x.ms - y.ms) / 360000) / 10 : null, sameFile: same });
    }
  }
  return out;
}

// 같은 언어 묶음표 — 같은 플랫폼 · 같은 말인 계정이 둘 넘는 묶음만. [{ platform, group, accounts: [key…] }]
function bundlesOf(accounts) {
  const by = new Map();
  for (const [key, a] of Object.entries(accounts)) {
    if (!groupOf(a)) continue;
    const k = `${a.platform}|${groupOf(a)}`;
    if (!by.has(k)) by.set(k, { platform: a.platform, group: groupOf(a), accounts: [] });
    by.get(k).accounts.push(key);
  }
  return [...by.values()].filter((b) => b.accounts.length > 1).sort((x, y) => y.accounts.length - x.accounts.length || `${x.platform}|${x.group}`.localeCompare(`${y.platform}|${y.group}`));
}

/**
 * plan({ accounts, originals, existing, from, days, cfg, useSpares })
 *   accounts: { key: { platform, language, group, versionKey, timeZone, dailyTimes, dailyFormats, dailyFrom, dailyTimesFrom, seed, trial, blocked } }
 *   originals: [{ id, format, stopped, spare, readyFrom, series?: { id, order }, versions: { <versionKey>: { ready: true, sha } } }]
 *   existing: [{ original, account, time(ISO), file, fixed, gone, seenAt? }] — 이미 있는 판(예약 · 게시 · 만든 사람이 단 판 · 지난 돌림 판). file은 그 판 파일 지문.
 *     gone인 줄의 seenAt(ISO)은 그 계정이 그 원본을 다른 길로 이미 올린 때(「같은이야기」 · 「이미받음」) — 씨앗 계정이면 씨앗 첫 판 시각으로 세고(②),
 *     그 판은 이 원본의 판으로 ① · ⑥(같은 플랫폼 20시간 · 같은 언어 묶음 24시간 · 유튜브 24시간 다섯 채널)에 든다. 칸은 차지하지 않는다
 *   → { cells: [{ account, day, slot, format, time, ms, original|null, why|null }], seeds: { id: ms } }
 * existing에는 원본이 아닌 편의 판도 넣는다(original: null) — 그 칸은 이미 찼다. gone은 나가지 않는 판(보류 · 취소됨 · 지움) —
 * 칸은 비지만 그 계정은 그 원본을 다시 받지 않는다. trial은 첫 판 확인 전 계정 — 판이 하나도 없을 때만 칸 하나를 받는다.
 */
function plan({ accounts, originals, existing = [], from, days = 5, cfg: given = {}, useSpares = false }) {
  const cfg = { ...DEFAULTS, ...given };
  const byId = new Map(originals.map((o) => [o.id, o]));
  const platesOf = new Map(originals.map((o) => [o.id, []])); // 원본마다 판(ms · 플랫폼 · 언어)
  const posted = new Map(Object.keys(accounts).map((k) => [k, new Set()]));
  const postedAt = new Map(Object.keys(accounts).map((k) => [k, new Map()])); // 계정 → 원본 → 그 판 시각(ms, 나가지 않는 판 · 다른 길로 받은 것은 -Infinity) — 연재 차례(⑦)
  const occupied = new Set(); // `${account}|${day}|${slot time}`
  const seeds = {};
  const trialUsed = new Set(); // 첫 판 확인 전 계정 가운데 이미 판이 있는 계정
  const note = (originalId, key, ms, file = null, { seedOk = true } = {}) => {
    const a = accounts[key];
    if (!a || !platesOf.has(originalId)) return;
    platesOf.get(originalId).push({ account: key, platform: a.platform, language: a.language || null, group: groupOf(a), ms, file: file || fileOf(byId.get(originalId), a) });
    posted.get(key)?.add(originalId);
    const at = postedAt.get(key);
    if (at && !(at.get(originalId) < ms)) at.set(originalId, ms);
    if (a.seed && seedOk && (seeds[originalId] === undefined || ms < seeds[originalId])) seeds[originalId] = ms;
  };
  for (const p of existing) {
    const a = accounts[p.account];
    if (!a) continue;
    // 나가지 않는 판(보류 · 취소됨 · 지움) — 칸은 비지만 그 계정은 그 원본을 다시 받지 않는다(돌림 ③)
    if (p.gone) {
      if (p.original) {
        posted.get(p.account)?.add(p.original);
        if (!postedAt.get(p.account).has(p.original)) postedAt.get(p.account).set(p.original, -Infinity);
        // 다른 길로 이미 올린 때(seenAt)가 있으면 — ⓐ 씨앗 계정은 씨앗 첫 판으로 센다(안 그러면 그 원본은 씨앗 판이 영영 없어 다른 계정이 못 받는다)
        // ⓑ 그 판을 이 원본의 판으로 넣는다(11-11 Fable 검수: @synkkorean의 지마 영어판(11-10 21:00) · 버마어 틱톡 판이 창 밖에 있어, 같은 말 채널이나
        //   같은 플랫폼 계정이 그 24시간 · 20시간 안에 같은 이야기를 받을 수 있었다). 파일은 다른 편 폴더의 것이라 「같은 파일」(⑥)로는 세지 않는다.
        const seen = Date.parse(p.seenAt || '');
        if (Number.isFinite(seen) && platesOf.has(p.original)) {
          if (a.seed && (seeds[p.original] === undefined || seen < seeds[p.original])) seeds[p.original] = seen;
          platesOf.get(p.original).push({ account: p.account, platform: a.platform, language: a.language || null, group: groupOf(a), ms: seen, file: p.file || `다른 길:${p.account}` });
        }
      }
      continue;
    }
    const ms = Date.parse(p.time || '');
    if (!Number.isFinite(ms)) continue;
    const day = T.localDate(ms, T.tzOf(a));
    const slot = T.slotFor(p.time, a);
    occupied.add(`${p.account}|${day}|${slot.time}`);
    // 첫 판 시험 계정의 「판 하나」 — 걸리지 않은 채(booked: false — 실패 · 못 건 판) 셈 첫날보다 앞으로 지나간 판은 세지 않는다. 안 그러면 그 계정은
    // 첫 판이 영영 「있는」 것으로 남아 다음 칸을 못 받는다(11-11 Fable 검수). 그 원본은 받은 것으로 남는다(다시 주지 않는다) — 새 칸은 다른 원본이 받는다.
    const missed = p.booked === false && ms < T.zonedMs(from, '00:00', T.tzOf(a));
    if (a.trial && !missed) trialUsed.add(p.account);
    // 씨앗 판도 같다(11-11 P3-1) — 걸리지 않은 채 지나간 씨앗 판은 씨앗 첫 판으로 세지 않는다(나가지 않은 판의 24시간 뒤를 다른 계정의 문으로 삼지 않게.
    // 그 씨앗 계정이 그 원본을 받은 것으로는 남는다). 다른 씨앗 판이 있으면 그 판이, 없으면 씨앗이 다시 올릴 때까지 다른 계정은 기다린다.
    if (p.original) note(p.original, p.account, ms, p.file || null, { seedOk: !missed });
  }
  // 원본마다 기다린 순서(씨앗 첫 판 · 쓸 수 있게 된 날 · 이름) — 오래 기다린 것부터 창에 든다.
  const ageOf = (o) => seeds[o.id] ?? (o.readyFrom ? Date.parse(o.readyFrom + 'T00:00:00Z') : Infinity);
  // 연재(⑦) — 연재마다 차례 번호 → 그 차례의 살아 있는 원본들(멈춤 · 안 쓰는 예비편은 뺀다)
  const live = (o) => !o.stopped && !(o.spare && !useSpares);
  const seriesOrders = new Map();
  for (const o of originals) {
    if (!o.series?.id || !Number.isFinite(o.series.order) || !live(o)) continue;
    if (!seriesOrders.has(o.series.id)) seriesOrders.set(o.series.id, new Map());
    const byOrder = seriesOrders.get(o.series.id);
    byOrder.set(o.series.order, [...(byOrder.get(o.series.order) || []), o.id]);
  }
  // 이 계정이 칸(ms)에서 원본 o를 받아도 되는 차례인지 — 앞 차례마다 그 차례의 원본 하나를 이 칸보다 먼저 받았어야 한다
  const waitsFor = (o, key, ms) => {
    if (!o.series?.id || !Number.isFinite(o.series.order)) return null;
    const mine = postedAt.get(key);
    // 살아 있는 원본이 있는 앞 차례마다, 그 차례 번호의 원본 하나(멈춘 옛 곡이어도 된다 — 고친 곡을 같은 번호로 넣었을 때 옛 곡을 받은 계정이
    // 새 곡을 기다리며 서지 않게, 11-11 P3-4)를 이 칸보다 먼저 받았어야 한다
    for (const [order] of [...(seriesOrders.get(o.series.id) || [])].sort((x, y) => x[0] - y[0])) {
      if (order >= o.series.order) break;
      const took = originals.some((x) => x.series?.id === o.series.id && x.series.order === order && mine.has(x.id) && mine.get(x.id) < ms);
      if (!took) return order;
    }
    return null;
  };

  // 같은 연재 · 같은 차례 번호의 다른 원본을 이미 받은 계정은 그 번호를 다시 받지 않는다(11-11 P3-4) — 고친 곡은 옛 곡을 멈춤 · 예비로 둔 채 같은 차례
  // 번호의 새 원본으로 넣는데(머리말 ⑦), 옛 곡을 이미 받은 계정이 새 곡(같은 노래)을 또 받았다. 멈춘 · 예비 원본도 「받은 번호」로 센다.
  const tookOrder = (o, key) => {
    if (!o.series?.id || !Number.isFinite(o.series.order)) return false;
    const mine = postedAt.get(key);
    return originals.some((x) => x.id !== o.id && x.series?.id === o.series.id && x.series.order === o.series.order && mine.has(x.id));
  };

  const cells = [];
  const range = Array.from({ length: days }, (_, k) => addDays(from, k));
  for (const day of range) {
    // 플랫폼 · 형식마다 한 무리(같은 현지 날짜의 칸들)
    const groups = new Map();
    for (const [key, a] of Object.entries(accounts)) {
      if (a.blocked) continue;
      for (const slot of T.slotsOn(a, day)) {
        if (!slot.time || !slot.format) continue;
        const ms = T.zonedMs(day, slot.time, T.tzOf(a));
        const cell = { account: key, day, slot: slot.time, format: slot.format, time: T.isoAt(ms, T.tzOf(a)), ms, original: null, why: null };
        if (occupied.has(`${key}|${day}|${slot.time}`)) { cell.why = '이미 찬 칸'; cell.taken = true; cells.push(cell); continue; }
        const g = `${a.platform}|${slot.format}`;
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g).push(cell);
        cells.push(cell);
      }
    }
    // 씨앗 무리를 먼저(씨앗 첫 판이 그날 정해져야 같은 원본의 다른 판 셈이 맞다) — 플랫폼 이름으로 고정 순서.
    const ordered = [...groups.entries()].sort(([x, xs], [y, ys]) => Number(ys.some((c) => accounts[c.account].seed)) - Number(xs.some((c) => accounts[c.account].seed)) || x.localeCompare(y));
    for (const [, all] of ordered) {
      const platform = accounts[all[0].account].platform;
      const cap = platform === 'youtube' ? cfg.youtubeCap : 1;
      // 첫 판 확인 전 계정은 판 하나만 — 이미 판이 있으면(앞 무리 · 앞 날에 받은 것까지) 그 칸은 비운다
      const list = all.filter((cell) => {
        if (!accounts[cell.account].trial || !trialUsed.has(cell.account)) return true;
        cell.why = '첫 판 확인 전 — 건 첫 판을 예약 목록에서 확인하고 postRouteVerified를 true로 바꾸면 다음 칸을 받는다';
        return false;
      });
      const cand = new Map();
      for (const cell of list) {
        const a = accounts[cell.account];
        const ok = originals.filter((o) => {
          if (o.format !== cell.format || o.stopped || (o.spare && !useSpares)) return false;
          if (!o.versions?.[a.versionKey]?.ready) return false;
          if (o.readyFrom && cell.day < o.readyFrom) return false;
          if (posted.get(cell.account).has(o.id)) return false;
          if (!a.seed) {
            const seed = seeds[o.id];
            if (seed === undefined || cell.ms < checkpointOf(seed, cfg)) return false;
          }
          if (tookOrder(o, cell.account)) return false;
          if (waitsFor(o, cell.account, cell.ms) !== null) return false;
          if (sameFile(platesOf.get(o.id), cell.account, a, fileOf(o, a))) return false;
          return !clashes(platesOf.get(o.id), a, cell.ms, cfg);
        });
        ok.sort((x, y) => ageOf(x) - ageOf(y) || x.id.localeCompare(y.id));
        const win = ok.slice(0, cfg.window).sort((x, y) => hashOf(`${cell.account}|${x.id}`).localeCompare(hashOf(`${cell.account}|${y.id}`)));
        cand.set(cell, [...win, ...ok.slice(cfg.window)].map((o) => o.id));
        if (!ok.length) cell.why = whyEmpty(cell, a, originals, posted.get(cell.account), seeds, cfg, useSpares, platesOf, waitsFor, tookOrder);
      }
      // 유튜브는 이 무리 밖(앞 날 · 이미 있는 판)의 같은 원본 판 시각도 넘겨 흐른 24시간 창으로 다섯을 센다
      const prior = new Map();
      if (platform === 'youtube') for (const o of originals) prior.set(o.id, platesOf.get(o.id).filter((p) => p.platform === 'youtube').map((p) => p.ms));
      match(list, cand, cap, accounts, platform, { prior, span: cfg.capHours * HOUR });
      for (const cell of list) if (cell.original) { cell.why = null; note(cell.original, cell.account, cell.ms); if (accounts[cell.account].trial) trialUsed.add(cell.account); }
        else if (!cell.why) cell.why = '같은 플랫폼에서 원본이 겹침(원본 모자람)';
    }
  }
  // 확인용 판 목록 — 이미 있던 판과 이번에 채운 칸(같은 언어 묶음 겹침을 overlaps로 다시 본다)
  const plates = [...platesOf].flatMap(([original, list]) => list.map((p) => ({ original, account: p.account, ms: p.ms, file: p.file })));
  return { cells, seeds, range, byId, plates };
}

// 시각 at을 더하면 at이 든 어느 span 안에 cap보다 많이 몰리는지(이미 있던 몰림은 at과 상관없으면 세지 않는다).
function crowded(times, at, cap, span) {
  const t = [...times, at].sort((x, y) => x - y);
  const k = t.indexOf(at);
  for (let i = Math.max(0, k - cap); i <= k && i + cap < t.length; i++) if (t[i + cap] - t[i] < span) return true;
  return false;
}

// 한 무리 안 맞물림 — 원본마다 칸 cap개(유튜브는 언어가 다른 칸만 · 흐른 24시간에 cap개), 증가 경로로 가장 많이 채운다.
function match(list, cand, cap, accounts, platform, { prior = new Map(), span = 24 * HOUR } = {}) {
  const holders = new Map(); // 원본 → 그 원본을 받은 칸들
  const fits = (o, cell, without = null) => {
    const held = (holders.get(o) || []).filter((c) => c !== without);
    if (platform !== 'youtube') return held.length < cap;
    if (held.some((c) => sameGroup(accounts[c.account], accounts[cell.account], platform))) return false;
    return !crowded([...(prior.get(o) || []), ...held.map((c) => c.ms)], cell.ms, cap, span);
  };
  const take = (cell, o) => { cell.original = o; holders.set(o, [...(holders.get(o) || []), cell]); };
  const drop = (cell) => { holders.set(cell.original, holders.get(cell.original).filter((c) => c !== cell)); cell.original = null; };
  const augment = (cell, seen) => {
    for (const o of cand.get(cell) || []) {
      if (seen.has(o)) continue;
      seen.add(o);
      if (fits(o, cell)) { take(cell, o); return true; }
      // 그 원본을 쥔 칸 하나를 다른 원본으로 옮기면 이 칸이 들어갈 수 있을 때만 자리를 낸다. 옮긴 뒤에도 못 들어가는 칸
      // (유튜브에서 같은 언어 칸이 따로 남는 경우 — 11-10 Fable 검수: 다섯이 찬 원본에서 다른 언어 칸을 옮기고 같은 언어 둘이 한 원본을 받았다)은 건드리지 않는다.
      for (const other of [...(holders.get(o) || [])]) {
        if (!fits(o, cell, other)) continue;
        drop(other);
        if (augment(other, seen)) { take(cell, o); return true; }
        take(other, o);
      }
    }
    return false;
  };
  for (const cell of list) augment(cell, new Set());
}

function whyEmpty(cell, a, originals, mine, seeds, cfg, useSpares, platesOf = new Map(), waitsFor = () => null, tookOrder = () => false) {
  const same = originals.filter((o) => o.format === cell.format && !(o.spare && !useSpares));
  if (!same.length) return `${cell.format} 원본 없음`;
  const live = same.filter((o) => !o.stopped);
  if (!live.length) return `${cell.format} 원본이 모두 멈춤`;
  // 안 받은 원본부터 센다 — 판본 준비를 먼저 거르면, 받을 원본이 남았는데 그 판본이 검수 전인 계정이 「다 올림」으로 잘못 나온다
  // (11-11 Fable 검수: 지마를 받은 채널 가운데 화날때 판본이 검수 전인 곳). 「다 올림」은 정말 안 받은 원본이 없을 때만이다.
  const unseen = live.filter((o) => !mine.has(o.id) && !tookOrder(o, cell.account));
  if (!unseen.length) return `이 계정이 ${cell.format} 원본을 다 올림`;
  const notReady = unseen.filter((o) => !o.versions?.[a.versionKey]?.ready);
  const early = unseen.filter((o) => o.versions?.[a.versionKey]?.ready && o.readyFrom && cell.day < o.readyFrom);
  const fresh = unseen.filter((o) => !notReady.includes(o) && !early.includes(o));
  if (!fresh.length) {
    const bits = [];
    const next = notReady.filter((o) => o.series?.id && Number.isFinite(o.series.order)).sort((x, y) => x.series.id.localeCompare(y.series.id) || x.series.order - y.series.order)[0];
    // 판본이 못 드는 까닭(뜻 검수 전 · 글자 검수 뒤 영상이 바뀜 · 원고 고칠 것 …)은 그 판본 상태의 why 그대로 — 14시 보고에서 무엇을 하면 칸이 차는지 보이게
    const whyNot = (o) => o.versions?.[a.versionKey]?.why || '판본 없음';
    const reasons = [...new Set(notReady.map(whyNot))];
    if (next) bits.push(`연재 「${next.series.id}」 ${next.series.order}번째 판본부터`);
    if (notReady.length) bits.push(`${a.versionKey} 판본이 아직 못 듦 ${notReady.length}편(${reasons.slice(0, 2).join(' · ')}${reasons.length > 2 ? ' …' : ''})`);
    if (early.length) bits.push(`쓸날 전 ${early.length}편`);
    const head = unseen.length < live.length ? `안 받은 ${cell.format} 원본 ${unseen.length}편이 아직 못 나간다` : `${a.versionKey} 판본이 검수를 넘긴 ${cell.format} 원본 없음`;
    return `${head} — ${bits.join(' · ')}`;
  }
  // 연재 차례(⑦) — 받을 수 있는 원본이 모두 앞 차례를 기다리는 때(앞 차례 판본이 검수 전이거나, 이 칸보다 뒤에 걸려 있다)
  const waiting = fresh.filter((o) => waitsFor(o, cell.account, cell.ms) !== null);
  if (waiting.length === fresh.length) {
    const o = waiting[0];
    return `연재 「${o.series.id}」 ${waitsFor(o, cell.account, cell.ms)}번째를 먼저 받아야 한다(차례 고정 — 그 판본이 검수 전이거나 이 칸보다 뒤에 걸려 있다)`;
  }
  if (!a.seed && fresh.every((o) => seeds[o.id] === undefined || cell.ms < checkpointOf(seeds[o.id], cfg))) return '씨앗 계정이 아직 안 올렸거나 14시 점검 전';
  const open = fresh.filter((o) => !(!a.seed && (seeds[o.id] === undefined || cell.ms < checkpointOf(seeds[o.id], cfg))));
  if (open.length && open.every((o) => sameFile(platesOf.get(o.id) || [], cell.account, a, fileOf(o, a)))) return '같은 언어 묶음의 다른 계정이 같은 파일을 받음 — 나라별판(다른 파일)이 있어야 한다';
  return '같은 플랫폼 20시간(같은 언어 묶음은 24시간) 겹침';
}

module.exports = { DEFAULTS, FORMATS, plan, checkpointOf, clashes, crowded, addDays, hashOf, groupOf, sameGroup, sameFile, overlaps, bundlesOf };
