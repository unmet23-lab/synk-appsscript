// 입장 검사 — 판정·근무 구성·점수. 화면과 저장소를 모르는 순수 함수만 둔다.
import { VENUES, CAST, ITEMS, SHIFT_SIZE } from './content.mjs';

export const minutes = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };

/** '17:04' → '오후 5시 4분'. 정각은 '오후 5시'. */
export function koreanTime(t) {
  const [h, m] = String(t).split(':').map(Number);
  const half = h < 12 ? '오전' : '오후';
  const hour = h % 12 || 12;
  return `${half} ${hour}시${m ? ` ${m}분` : ''}`;
}

export const venueById = (id) => VENUES.find((v) => v.id === id) || null;
export const caseById = (id) => { for (const v of VENUES) { const c = v.cases.find((x) => x.id === id); if (c) return { venue: v, item: c }; } return null; };

export const memoActive = (venue, at) => !!venue.memo && minutes(at) >= minutes(venue.memo.at);

/** 그 시각에 적용되는 규칙. 알림(memo)은 알림 시각부터 더해진다. */
export function activeRules(venue, at) {
  return memoActive(venue, at) ? [...venue.notice.rules, venue.memo.rule] : [...venue.notice.rules];
}

/** 고를 수 있는 답: 통과 또는 지금 적용되는 규칙 하나. 보기 순서는 안내문 순서로 고정한다. */
export const choicesFor = (venue, at) => ['pass', ...activeRules(venue, at).map((r) => r.id)];

export function judge(item, choice) {
  return { choice, expected: item.answer, correct: choice === item.answer, kind: item.answer === 'pass' ? 'pass' : 'reject' };
}

/**
 * 한 근무의 손님을 고른다.
 * ranked: 아틀라스가 필요 순서대로 늘어놓은 손님 id(없으면 원고 순서).
 * 1) 처음 하는 사람에게는 가장 쉬운 통과 손님을 넣는다.
 * 2) 안내문의 규칙마다(근무 중 알림 포함) 그 규칙을 어기는 손님을 한 명씩 넣는다. 어느 손님으로 만날지는 필요 순서가 정한다.
 *    규칙을 한 줄도 건너뛰지 않아야 안내문 전체를 읽는 연습이 된다(2026-10-02 도서관 첫 근무에서 마감 시각 손님이 빠졌다).
 * 3) 통과 손님이 없으면 필요 순서에서 하나 넣는다.
 * 4) 남은 자리는 필요 순서대로 채운다. 알림이 있는 근무지는 알림 전 1명·후 2명 이상이 되게 한다.
 * 고른 뒤에는 도착 시각 순서로 줄을 세운다.
 */
export function composeShift(venue, { ranked = null, size = SHIFT_SIZE, firstTime = false } = {}) {
  const byId = new Map(venue.cases.map((c) => [c.id, c]));
  const order = [...(ranked || []).filter((id) => byId.has(id)), ...venue.cases.map((c) => c.id)]
    .filter((id, i, a) => a.indexOf(id) === i).map((id) => byId.get(id));
  const n = Math.min(size, venue.cases.length);
  const picked = [];
  const add = (c) => { if (c && !picked.includes(c) && picked.length < n) picked.push(c); };
  const memoAt = venue.memo ? minutes(venue.memo.at) : null;
  if (firstTime) add(venue.cases.filter((c) => c.answer === 'pass' && c.difficulty === 1).sort((a, b) => minutes(a.at) - minutes(b.at))[0]);
  const ruleIds = [...venue.notice.rules.map((r) => r.id), ...(venue.memo ? [venue.memo.rule.id] : [])];
  for (const id of ruleIds) if (!picked.some((c) => c.answer === id)) add(order.find((c) => c.answer === id));
  if (!picked.some((c) => c.answer === 'pass')) add(order.find((c) => c.answer === 'pass'));
  const short = () => memoAt == null ? { before: 0, after: 0 } : {
    before: Math.max(0, 1 - picked.filter((c) => minutes(c.at) < memoAt).length),
    after: Math.max(0, 2 - picked.filter((c) => minutes(c.at) >= memoAt).length),
  };
  for (const c of order) {
    if (picked.length >= n) break;
    if (picked.includes(c)) continue;
    const r = short(), left = n - picked.length;
    if (r.before + r.after >= left && !((r.before && minutes(c.at) < memoAt) || (r.after && minutes(c.at) >= memoAt))) continue;
    add(c);
  }
  for (const c of order) add(c);
  return picked.sort((a, b) => minutes(a.at) - minutes(b.at));
}

/** 근무 결과. 별은 '첫 도장'이 맞은 수로만 센다(힌트 사용 여부는 학습 기록에 따로 남는다). */
export function scoreShift(results) {
  const total = results.length;
  const correct = results.filter((r) => r.correct).length;
  const helped = results.filter((r) => r.hinted).length;
  const stars = total === 0 ? 0 : correct === total ? 3 : correct >= total - 1 ? 2 : correct >= Math.ceil(total / 2) ? 1 : 0;
  let best = 0, run = 0;
  for (const r of results) { run = r.correct ? run + 1 : 0; best = Math.max(best, run); }
  const bySkill = {};
  for (const r of results) {
    const s = (bySkill[r.skill] ||= { total: 0, correct: 0 });
    s.total += 1; if (r.correct) s.correct += 1;
  }
  return { total, correct, helped, stars, bestRun: best, bySkill };
}

/** 근무지 열림: 1일차는 늘 열려 있고, 다음 근무지는 앞 근무지에서 별 1개 이상. */
export function unlocked(progress, venueId) {
  const i = VENUES.findIndex((v) => v.id === venueId);
  if (i <= 0) return i === 0;
  return (progress?.stars?.[VENUES[i - 1].id] || 0) >= 1;
}

export function itemLabel(entry) {
  const [id, count] = Array.isArray(entry) ? entry : [entry, 1];
  return { id, count, label: ITEMS[id] || id };
}

/** 원고 검사: 시험과 개발 중 확인에 쓴다. 문제 목록을 돌려준다(빈 배열이면 통과). */
export function validateContent() {
  const problems = [];
  const seen = new Set();
  for (const v of VENUES) {
    const ruleIds = new Set([...v.notice.rules.map((r) => r.id), ...(v.memo ? [v.memo.rule.id] : [])]);
    let last = -1;
    for (const c of v.cases) {
      if (seen.has(c.id)) problems.push(`${c.id}: id 중복`);
      seen.add(c.id);
      if (!CAST[c.who]) problems.push(`${c.id}: 없는 손님 ${c.who}`);
      if (minutes(c.at) <= last) problems.push(`${c.id}: 도착 시각이 앞 손님보다 빠르다`);
      last = minutes(c.at);
      const active = new Set(activeRules(v, c.at).map((r) => r.id));
      if (c.answer !== 'pass' && !active.has(c.answer)) problems.push(`${c.id}: 그 시각에 없는 규칙 ${c.answer}`);
      for (const e of c.evidence || []) if (!ruleIds.has(e)) problems.push(`${c.id}: 근거 규칙 ${e} 없음`);
      for (const e of c.items) if (!ITEMS[Array.isArray(e) ? e[0] : e]) problems.push(`${c.id}: 없는 짐 ${e}`);
      if (![1, 2, 3].includes(c.difficulty)) problems.push(`${c.id}: 난도`);
      if (!/^ko\.reading\.(detail|negation|condition)$/.test(c.skill)) problems.push(`${c.id}: 학습 항목 ${c.skill}`);
      for (const k of ['line', 'why', 'reply', 'oops']) if (!c[k] || c[k].length < 4) problems.push(`${c.id}: ${k} 비어 있음`);
    }
    if (v.cases.filter((c) => c.answer === 'pass').length < 2) problems.push(`${v.id}: 통과 손님이 너무 적다`);
    if (v.cases.filter((c) => c.answer !== 'pass').length < 3) problems.push(`${v.id}: 거절 손님이 너무 적다`);
  }
  return problems;
}
