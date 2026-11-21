// PATH 조건 대조기. 순수 함수만 둔다. 결과는 판정이 아닌 대조다(입학 · 비자를 약속하지 않는다).
import { financeRule, scholarshipAmount, applyWindow, MAX_TOPIK } from './study-data.mjs';

export const MATCH_KEYS = Object.freeze(['education', 'grade', 'topik', 'finance']);

const num = (v, min, max) => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null);

/**
 * 세기 전에 넣어야 하는 칸. 보이는 과정 가운데 그 조건(0보다 큰 기준)이 있는 과정이 있을 때만 요구한다
 * (결과를 바꾸지 않는 성적을 지어 넣지 않게). 과정 목록을 안 주면 성적과 한국어 둘 다다.
 */
export function countNeeds(programs) {
  return ['gradePct', 'topik'].filter((k) => !Array.isArray(programs) || programs.some((p) => p.requires[k] > 0));
}

/** 세기에 필요한 칸을 다 넣었는가. 아니면 「맞는 곳」을 세지 않는다(안 넣어서 0으로 보이지 않게). */
export function readyToCount(profile, programs) {
  return countNeeds(programs).every((k) => Number.isInteger(profile?.[k]));
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


/**
 * 한 해에 드는 돈. 장학금은 내 급수 이하에서 가장 높은 단계의 비율을 등록금에 곱한다
 * (scholarshipTerms가 1이면 한 해 두 학기 가운데 한 학기에만 준다).
 * 대학이 안내하지 않은 비용(null)은 합계에 넣지 않고 missing에 이름을 적는다.
 */
export function programCost(profile, program) {
  const topik = Number.isInteger(profile?.topik) ? profile.topik : null;
  const level = topik ?? 0;   // 급수 0 단계(신입생 모두)는 급수를 안 넣어도 받는다
  const { tuition, dorm, living } = program.costs;
  let step = null;
  for (const s of program.scholarship) if (level >= s.topik) step = s;
  const scholarship = step ? scholarshipAmount(program, step) : 0;
  // rate는 비율로 적힌 단계일 때만 있다(금액으로 적힌 단계는 null).
  const rate = !step ? 0 : typeof step.tuitionRate === 'number' ? step.tuitionRate : null;
  const known = tuition + (dorm ?? 0) + (living ?? 0);
  const missing = ['dorm', 'living'].filter((k) => program.costs[k] === null);
  const total = known - scholarship;
  const next = program.scholarship.find((s) => s.topik > level && scholarshipAmount(program, s) > scholarship) || null;
  const nextLevel = next ? { topik: next.topik, total: known - scholarshipAmount(program, next) } : null;
  return { tuition, dorm, living, scholarship, rate, stepTopik: step ? step.topik : null, total, nextLevel, missing };
}

/**
 * 지금 조건에 맞는 과정 수. 머리 숫자와 「조건이 맞는 곳」 거르기가 이 함수 하나를 쓴다.
 * 세기에 필요한 칸(countNeeds)을 안 넣었으면 null(세지 않는다). topik을 주면 그 급수였을 때로 센다.
 */
export function countFit(profile, programs, rules, topik) {
  const p = topik === undefined ? profile : { ...(profile || {}), topik };
  if (!readyToCount(p, programs)) return null;
  return programs.filter((x) => matchProgram(p, x, rules).fits).length;
}

/**
 * 갈 수 있는 길 둘: 어학 과정 먼저 / 바로 학부.
 * 머리 숫자와 같은 기준이다: 세기에 필요한 칸을 넣기 전에는 'check', 넣은 뒤에는 fits인 과정을 센다.
 * open은 그 가운데 지금 접수 중이거나 접수가 곧 열리는 과정 수다(마감된 과정은 「지금」 갈 수 없다).
 */
export function routes(profile, programs, rules, now = new Date()) {
  const ready = readyToCount(profile, programs);
  const topik = Number.isInteger(profile?.topik) ? profile.topik : null;
  const of = (level) => programs.filter((x) => x.level === level);
  const summarize = (list) => {
    const needs = list.map((x) => x.requires.topik).filter((n) => n > 0);
    const lowest = needs.length ? Math.min(...needs) : 0;
    const topikGap = topik === null ? null : Math.max(0, lowest - topik);
    if (!list.length) return { status: 'none', count: 0, academic: 0, open: 0, total: 0, lowestTopik: lowest, topikGap };
    const matched = list.map((x) => [x, matchProgram(profile, x, rules)]);
    const fit = matched.filter(([, m]) => m.fits);
    const academic = matched.filter(([, m]) => m.canApplyAcademically).length;
    const open = fit.filter(([x]) => ['open', 'before'].includes(applyWindow(x, now).state)).length;
    const status = !ready ? 'check' : fit.length ? 'ok' : 'lack';
    return { status, count: fit.length, academic, open, total: list.length, lowestTopik: lowest, topikGap };
  };
  return { languageFirst: summarize(of('language')), direct: summarize(of('undergraduate')) };
}
