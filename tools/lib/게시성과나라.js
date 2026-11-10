'use strict';
/* LAB 계정 · 나라 · 칸별 숫자(2026-11-10 LAB 하루 두 편 · 39계정 — 설계 7 「계정 · 나라 · 틀별로 같은 나이(24 · 72시간)끼리 비교한다.
 * 못 읽는 곳은 0이 아니라 결측으로 적는다」). 게시 성과 요약(docs/마케팅/게시성과.md)의 한 절을 만든다. 읽기만 한다.
 *
 *   절({ ledger, accounts, now, days, 편형식 }) → 마크다운 줄 배열
 *     ledger: docs/_ops/게시성과.jsonl의 줄(kind 「판정」만 쓴다 — 게시물 · 시점마다 가장 늦게 적힌 줄)
 *     accounts: sns-계정.json accounts(계정 키 → 원장 값). LAB이고 dailyFormats가 있는 계정만 줄이 된다.
 *     편형식: (판정 줄) → 그 판 편의 형식 글자 | null(편을 못 찾음) — tools/게시성과.js가 편 색인으로 준다(형식Of(준비.json)).
 *       없으면 형식을 알 길이 없어 칸은 시각으로만 나눈다.
 *
 * 칸은 계정의 현지 시각 칸(dailyTimes)으로 나눈다: 게시 시각이 든 칸 — 자정을 넘긴 새벽 판은 앞 날 마지막 칸이고, 그날 안 열린 칸
 * (dailyTimesFrom · dailyFormatsFrom 앞)에는 넣지 않는다(T.slotFor 돌아서 · 열린칸만 — 11-11 Fable 5.2 P2-12: 새벽에 올린 lab-youtube
 * 세 건이 닫힌 13:00 칸으로 세어졌다). 칸 이름에 원장의 지금 칸 형식(13:00 이야기 · 21:00 노래)을 붙이지 않는다 — 그 칸에 든 판은
 * 대부분 형식이 다른 옛 줄 편이라(11-11: 「20:00 노래」 칸의 수가 줄 편 152 · 이야기 17 · 노래 0) 판마다 그 편의 형식(준비.json
 * 「돌림」.형식, 없으면 「줄 편」)으로 칸 안을 다시 나눈다.
 * 조회는 같은 나이끼리만 견준다 — 24시간 값은 24시간 값끼리, 72시간 값은 72시간 값끼리의 중앙값(괄호는 판 수).
 * 숫자가 없는 칸은 「—」이고 0으로 적지 않는다. 「숫자」 칸은 원장 metricsState(읽힘 · 확인 전 · 결측)와 metricsRoute(왜 못 읽는지)다.
 * 새 계정은 2~3주 판정하지 않는다 — 이 표는 견주기용이고 틀 판정은 씨앗 계정으로 한다(설계 7 · 25).
 * 요약은 07시 제작이 읽는 글이라 표에는 숫자가 있는 계정만 두고, 숫자가 없는 계정은 까닭마다 한 줄로 모은다.
 */
const T = require('./계정시간.js');
const { FORMATS } = require('./돌림.js');

// 편 형식 — 준비.json 「돌림」.형식이 이야기 · 노래 · 퀴즈면 그것, 아니면(「돌림」이 없거나 형식이 틀림 — 돌림표도 원본으로 안 센다) 줄 편.
const LINE_PIECE = '줄 편';
const 형식Of = (prep) => (prep && prep.돌림 && FORMATS.includes(prep.돌림.형식) ? prep.돌림.형식 : LINE_PIECE);
// 성과 표의 칸 셈 — 자정을 넘긴 판은 앞 날 칸, 그날 안 열린 칸은 빼고(T.slotAt)
const SLOT_OPTS = Object.freeze({ 돌아서: true, 열린칸만: true });

const STATE = { reading: '읽힘', unconfirmed: '확인 전(첫 게시 뒤)', missing: '결측' };
const ROUTE = { server: '서버 수집', 'public-api': '공개 조회수만', 'public-page': '공개 페이지(수집기 없음)', 'vk-api': 'API 연결 전', 'screen-only': '화면에서만' };
const median = (values) => {
  const v = values.filter((x) => typeof x === 'number' && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  return v.length % 2 ? v[(v.length - 1) / 2] : Math.round((v[v.length / 2 - 1] + v[v.length / 2]) / 2);
};
const cell = (values) => { const m = median(values); return m === null ? '—' : `${m.toLocaleString('en-US')} (${values.length})`; };

// 게시물 · 시점마다 가장 늦게 적힌 판정 줄
function latestByPoint(ledger) {
  const map = new Map();
  for (const l of ledger) {
    if (!l || l.kind !== '판정' || !l.post || !l.point) continue;
    const k = `${l.post}|${l.point}`;
    const prev = map.get(k);
    if (!prev || String(l.at || '') >= String(prev.at || '')) map.set(k, l);
  }
  return [...map.values()];
}

// 줄 하나 = 계정 · 칸(현지 시각) · 편 형식. slot은 칸 시각, format은 그 칸에 든 판들의 편 형식(판이 없는 칸은 null).
// 편형식을 안 주면 형식을 알 길이 없어 칸마다 한 줄(format 「모름」)이고, 편형식이 null을 낸 판은 「편 못 찾음」으로 따로 센다.
function 줄들({ ledger = [], accounts = {}, now = Date.now(), days = 21, 편형식 = null } = {}) {
  const cut = now - days * 86400000;
  const lab = Object.entries(accounts).filter(([, a]) => a && a.brand === 'LAB' && Array.isArray(a.dailyFormats));
  const judged = latestByPoint(ledger).filter((l) => Date.parse(l.publishedAt || '') >= cut && typeof l.metrics?.views === 'number');
  const formatOf = (l) => (typeof 편형식 === 'function' ? 편형식(l) || '편 못 찾음' : '모름');
  const rows = [];
  for (const [key, a] of lab) {
    const mine = judged.filter((l) => l.account === key).map((l) => ({ l, time: T.slotFor(l.publishedAt, a, SLOT_OPTS).time, format: formatOf(l) }));
    const base = { key, country: a.countryCode || (a.audience === 'global' ? '전 세계' : '—'), platform: a.platform, language: a.language || '—',
      seed: Boolean(a.rotationSeed), open: !T.notStarted(a),
      state: STATE[a.metricsState] || '—', route: a.metricsState === 'missing' && a.metricsRoute === 'server' ? '서버 연결 전' : ROUTE[a.metricsRoute] || a.metricsRoute || '—' };
    for (const slot of T.allSlots(a)) {
      const inSlot = mine.filter((x) => x.time === slot.time);
      const formats = [...new Set(inSlot.map((x) => x.format))];
      for (const format of formats.length ? formats : [null]) {
        const views = (point) => inSlot.filter((x) => x.format === format && x.l.point === point).map((x) => x.l.metrics.views);
        rows.push({ ...base, slot: slot.time || '—', format, v24: views('24h'), v72: views('72h') });
      }
    }
  }
  rows.sort((x, y) => Number(y.seed) - Number(x.seed) || x.country.localeCompare(y.country) || x.platform.localeCompare(y.platform) || x.key.localeCompare(y.key)
    || x.slot.localeCompare(y.slot) || String(x.format || '').localeCompare(String(y.format || '')));
  return rows;
}

function 절(input = {}) {
  const rows = 줄들(input);
  if (!rows.length) return [];
  const days = input.days || 21;
  const has = new Set(rows.filter((r) => r.v24.length || r.v72.length).map((r) => r.key));
  const accounts = new Set(rows.map((r) => r.key)).size;
  const shown = rows.filter((r) => has.has(r.key));
  // 숫자가 없는 계정 — 까닭(시작 전 · 숫자 읽기 상태 · 길)마다 한 줄
  const why = new Map();
  for (const r of rows) {
    if (has.has(r.key)) continue;
    const k = `${r.open ? '' : '시작 전 · '}${r.state}${r.state === '읽힘' ? '(최근 판 없음)' : ` — ${r.route}`}`;
    if (!why.has(k)) why.set(k, new Set());
    why.get(k).add(`${r.key}(${r.country})`);
  }
  return [
    `## LAB 계정 · 나라 · 칸별(최근 ${days}일 · 같은 나이끼리)`,
    '',
    `LAB ${accounts}계정 가운데 숫자가 있는 계정 ${has.size}. 조회는 24시간 값끼리 · 72시간 값끼리의 중앙값(괄호는 판 수)이고, 숫자가 없는 칸은 0이 아니라 「—」다. 새 계정은 2~3주 판정하지 않고 틀 판정은 씨앗 계정으로 한다([제작 절차 「LAB 하루 두 편」](기획장부/제작절차.md#lab-two-a-day-20261110) 9).`,
    '',
    '칸은 게시 시각이 든 그 계정의 현지 칸이다 — 자정을 넘긴 새벽 판은 앞 날 마지막 칸이고, 그날 안 열린 칸에는 넣지 않는다. 「편 형식」은 그 판 편의 형식(준비.json 「돌림」.형식, 없으면 줄 편)이고 원장의 지금 칸 형식(13:00 이야기 · 21:00 노래)이 아니다 — 형식이 다른 판끼리는 섞지 않는다.',
    '',
    '| 나라 | 플랫폼 | 계정 | 말 | 칸(현지) | 편 형식 | 24시간 조회 | 72시간 조회 | 숫자 |',
    '|---|---|---|---|---|---|---|---|---|',
    ...(shown.length ? shown.map((r) => `| ${r.country}${r.seed ? ' · 씨앗' : ''} | ${r.platform} | ${r.key} | ${r.language} | ${r.slot} | ${r.format || '—'} | ${cell(r.v24)} | ${cell(r.v72)} | ${r.open ? '' : '시작 전 · '}${r.state}${r.state === '읽힘' ? '' : ` — ${r.route}`} |`)
      : ['| 아직 없음 | — | — | — | — | — | — | — | — |']),
    '',
    ...(why.size ? ['숫자가 없는 계정(빈칸 — 0이 아니다):', ...[...why].map(([k, set]) => `- ${k} ${set.size}곳: ${[...set].join(' · ')}`), ''] : []),
  ];
}

module.exports = { 절, 줄들, latestByPoint, median, 형식Of, LINE_PIECE };
