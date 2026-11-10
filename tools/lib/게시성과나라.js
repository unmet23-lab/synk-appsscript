'use strict';
/* LAB 계정 · 나라 · 칸별 숫자(2026-11-10 LAB 하루 두 편 · 39계정 — 설계 7 「계정 · 나라 · 틀별로 같은 나이(24 · 72시간)끼리 비교한다.
 * 못 읽는 곳은 0이 아니라 결측으로 적는다」). 게시 성과 요약(docs/마케팅/게시성과.md)의 한 절을 만든다. 읽기만 한다.
 *
 *   절({ ledger, accounts, now, days }) → 마크다운 줄 배열
 *     ledger: docs/_ops/게시성과.jsonl의 줄(kind 「판정」만 쓴다 — 게시물 · 시점마다 가장 늦게 적힌 줄)
 *     accounts: sns-계정.json accounts(계정 키 → 원장 값). LAB이고 dailyFormats가 있는 계정만 줄이 된다.
 *
 * 칸은 계정의 현지 시각 칸(dailyTimes · dailyFormats — 13:00 이야기 · 21:00 노래, 11-10 밤 퀴즈에서 노래로)으로 나눈다: 게시 시각에 가장 가까운 칸.
 * 조회는 같은 나이끼리만 견준다 — 24시간 값은 24시간 값끼리, 72시간 값은 72시간 값끼리의 중앙값(괄호는 판 수).
 * 숫자가 없는 칸은 「—」이고 0으로 적지 않는다. 「숫자」 칸은 원장 metricsState(읽힘 · 확인 전 · 결측)와 metricsRoute(왜 못 읽는지)다.
 * 새 계정은 2~3주 판정하지 않는다 — 이 표는 견주기용이고 틀 판정은 씨앗 계정으로 한다(설계 7 · 25).
 * 요약은 07시 제작이 읽는 글이라 표에는 숫자가 있는 계정만 두고, 숫자가 없는 계정은 까닭마다 한 줄로 모은다.
 */
const T = require('./계정시간.js');

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

function 줄들({ ledger = [], accounts = {}, now = Date.now(), days = 21 } = {}) {
  const cut = now - days * 86400000;
  const lab = Object.entries(accounts).filter(([, a]) => a && a.brand === 'LAB' && Array.isArray(a.dailyFormats));
  const judged = latestByPoint(ledger).filter((l) => Date.parse(l.publishedAt || '') >= cut && typeof l.metrics?.views === 'number');
  const rows = [];
  for (const [key, a] of lab) {
    const mine = judged.filter((l) => l.account === key);
    for (const slot of T.allSlots(a)) {
      const inSlot = mine.filter((l) => T.slotFor(l.publishedAt, a).time === slot.time);
      const views = (point) => inSlot.filter((l) => l.point === point).map((l) => l.metrics.views);
      rows.push({ key, country: a.countryCode || (a.audience === 'global' ? '전 세계' : '—'), platform: a.platform, language: a.language || '—', slot: `${slot.time}${slot.format ? ` ${slot.format}` : ''}`,
        v24: views('24h'), v72: views('72h'), seed: Boolean(a.rotationSeed), open: !T.notStarted(a),
        state: STATE[a.metricsState] || '—', route: a.metricsState === 'missing' && a.metricsRoute === 'server' ? '서버 연결 전' : ROUTE[a.metricsRoute] || a.metricsRoute || '—' });
    }
  }
  rows.sort((x, y) => Number(y.seed) - Number(x.seed) || x.country.localeCompare(y.country) || x.platform.localeCompare(y.platform) || x.key.localeCompare(y.key) || x.slot.localeCompare(y.slot));
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
    '| 나라 | 플랫폼 | 계정 | 말 | 칸(현지) | 24시간 조회 | 72시간 조회 | 숫자 |',
    '|---|---|---|---|---|---|---|---|',
    ...(shown.length ? shown.map((r) => `| ${r.country}${r.seed ? ' · 씨앗' : ''} | ${r.platform} | ${r.key} | ${r.language} | ${r.slot} | ${cell(r.v24)} | ${cell(r.v72)} | ${r.open ? '' : '시작 전 · '}${r.state}${r.state === '읽힘' ? '' : ` — ${r.route}`} |`)
      : ['| 아직 없음 | — | — | — | — | — | — | — |']),
    '',
    ...(why.size ? ['숫자가 없는 계정(빈칸 — 0이 아니다):', ...[...why].map(([k, set]) => `- ${k} ${set.size}곳: ${[...set].join(' · ')}`), ''] : []),
  ];
}

module.exports = { 절, 줄들, latestByPoint, median };
