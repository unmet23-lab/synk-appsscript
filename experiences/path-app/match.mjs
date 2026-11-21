// PATH 조건 대조기. 순수 함수만 둔다. 결과는 판정이 아닌 대조다(입학 · 비자를 약속하지 않는다).
import { financeRule, MAX_TOPIK } from './study-data.mjs';

export const MATCH_KEYS = Object.freeze(['education', 'grade', 'topik', 'finance']);

const num = (v, min, max) => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null);

/** 성적과 한국어를 둘 다 넣었는가. 아니면 「맞는 곳」을 세지 않는다(안 넣어서 0으로 보이지 않게). */
export function readyToCount(profile) {
  return Number.isInteger(profile?.gradePct) && Number.isInteger(profile?.topik);
}

/** 조건 넷을 늘 같은 순서로 낸다. 안 넣은 값은 'check'다. 성적 조건 0은 「성적 조건 없음」이다. */
export function matchProgram(profile, program, rules) {
  const p = profile || {};
  const need = program.requires;
  const items = [];

  const edu = p.education === 'graduated' || p.education === 'expected' ? 'ok' : p.education === 'none' ? 'lack' : 'check';
  items.push({ key: 'education', status: edu, need: need.education, mine: p.education ?? null, gap: null, rule: null });

  const grade = num(p.gradePct, 0, 100);
  items.push({ key: 'grade', status: need.gradePct === 0 ? 'ok' : grade === null ? 'check' : grade >= need.gradePct ? 'ok' : 'lack', need: need.gradePct, mine: grade, gap: grade === null ? null : Math.max(0, need.gradePct - grade), rule: null });

  const topik = Number.isInteger(p.topik) ? num(p.topik, 0, MAX_TOPIK) : null;
  const topikStatus = need.topik === 0 ? 'ok' : topik === null ? 'check' : topik >= need.topik ? 'ok' : 'lack';
  items.push({ key: 'topik', status: topikStatus, need: need.topik, mine: topik, gap: topik === null ? null : Math.max(0, need.topik - topik), rule: null });

  const rule = financeRule(rules, program.visa, program.region);
  const funds = num(p.fundsWon, 0, Number.MAX_SAFE_INTEGER);
  // 지금 쓰는 안내에서 확인하지 못했거나 확인한 지 오래된 금액으로는 판정하지 않는다.
  const firm = !!rule && rule.inCurrentGuide === true && !rule.stale;
  const fin = !firm || funds === null ? 'check' : funds >= rule.won ? 'ok' : 'lack';
  items.push({ key: 'finance', status: fin, need: rule ? rule.won : null, mine: funds, gap: rule && funds !== null ? Math.max(0, rule.won - funds) : null, rule, firm });

  const okCount = items.filter((i) => i.status === 'ok').length;
  const canApplyAcademically = items[1].status === 'ok' && items[2].status === 'ok';
  // 맞는 곳: 성적과 한국어가 맞고, 넣은 조건 가운데 부족한 것이 없다(안 넣은 학력 · 돈은 봐준다).
  const fits = canApplyAcademically && items.every((i) => i.status !== 'lack');
  return { items, okCount, canApplyAcademically, fits };
}

function scholarshipRate(program, topik) {
  let rate = 0;
  if (Number.isInteger(topik)) for (const s of program.scholarship) if (topik >= s.topik) rate = s.tuitionRate;
  return rate;
}

/** 한 해에 드는 돈. 장학금은 내 급수 이하에서 가장 높은 단계의 비율을 등록금에 곱한다. */
export function programCost(profile, program) {
  const topik = Number.isInteger(profile?.topik) ? profile.topik : null;
  const { tuition, dorm, living } = program.costs;
  const rate = scholarshipRate(program, topik);
  const scholarship = Math.round(tuition * rate);
  const total = tuition + dorm + living - scholarship;
  const next = program.scholarship.find((s) => s.topik > (topik ?? -1) && s.tuitionRate > rate) || null;
  const nextLevel = next ? { topik: next.topik, total: tuition + dorm + living - Math.round(tuition * next.tuitionRate) } : null;
  return { tuition, dorm, living, scholarship, rate, total, nextLevel };
}

/**
 * 지금 조건에 맞는 과정 수. 머리 숫자와 「조건이 맞는 곳」 거르기가 이 함수 하나를 쓴다.
 * 성적이나 한국어를 안 넣었으면 null(세지 않는다). topik을 주면 그 급수였을 때로 센다.
 */
export function countFit(profile, programs, rules, topik) {
  const p = topik === undefined ? profile : { ...(profile || {}), topik };
  if (!readyToCount(p)) return null;
  return programs.filter((x) => matchProgram(p, x, rules).fits).length;
}

/** 갈 수 있는 길 둘: 어학 과정 먼저 / 바로 학부. */
export function routes(profile, programs, rules) {
  const of = (level) => programs.filter((x) => x.level === level);
  const summarize = (list) => {
    const matched = list.map((x) => matchProgram(profile, x, rules));
    const count = matched.filter((m) => m.canApplyAcademically).length;
    const topik = Number.isInteger(profile?.topik) ? profile.topik : null;
    const needs = list.map((x) => x.requires.topik).filter((n) => n > 0);
    const lowest = needs.length ? Math.min(...needs) : 0;
    const topikGap = topik === null ? null : Math.max(0, lowest - topik);
    const status = !list.length ? 'none' : count > 0 ? 'ok' : matched.some((m) => m.items[1].status === 'check' || m.items[2].status === 'check') ? 'check' : 'lack';
    return { status, count, total: list.length, lowestTopik: lowest, topikGap };
  };
  return { languageFirst: summarize(of('language')), direct: summarize(of('undergraduate')) };
}
