import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import base from '../docs/유지비_BM/BM_통합설계_20261018/inputs.mjs';
import { labBep, labPremium, labSaturdaySeats, labClasses, setPremiumClasses, run } from '../docs/유지비_BM/BM_통합설계_20261018/model.mjs';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);
const fixture = () => {
  const inp = structuredClone(base), L = inp.lab;
  L.lightShare = 0.2;
  L.weekendShare = 0.5;
  // 토요일 반 규칙을 재는 고정 값이라 08-01 편제(실마다 토요일 두 시간대 · 위성 강사 셋)를 직접 둔다 — 기본 가정은 10-28부터 토요일 정규가 없다
  L.stages.v23.satSlotsPerRoom = 2;
  L.staff.v23.satelliteHeads = 3;
  L.premiumUptake = 0.5;
  L.premiumSeats = { v23: 5 };
  L.prices = { m1: 100, m3: 100, m6: 100, m12: 100, light: 50, premiumAddon: 40 };
  L.leakage = 0;
  L.textbook.enabled = false;
  L.socialInsurance = 0;
  L.rentPerM2MNT = L.utilitiesPerM2MNT = 0;
  L.staff.director = L.staff.dance = L.staff.teacherHourly = L.staff.ops.wage = 0;
  L.staff.v23.dance = L.staff.v23.beauty = L.staff.v23.vocal = L.staff.v23.satClassCost = 0;
  L.staff.foreignLevy.count = 0;
  L.workshop.uptake = 0; // [11-18] K드라마 주말 워크숍 비용도 다른 비용처럼 0으로 둔다 — 이 고정 값은 회화 · 반 · 성과급 규칙만 잰다
  for (const key of Object.keys(L.staff.cleaning)) L.staff.cleaning[key] = 0;
  for (const stage of Object.values(L.stages)) stage.rentFixedMNT = 0;
  for (const [key, value] of Object.entries(L.other)) {
    if (typeof value === 'number') L.other[key] = 0;
    else if (['materialsSW', 'marketing', 'accountingAudit', 'insurance'].includes(key)) {
      for (const stage of Object.keys(value)) value[stage] = 0;
    }
  }
  L.incentives.fieldBonusMin = 0;
  L.incentives.fieldBonusRate = 0;
  for (const tier of L.incentives.baseBonus) tier.each = 0;
  inp.market.paidShare = 0;
  inp.scenarios['기본'].priceRealization = 1;
  return inp;
};

test('premium revenue excludes light and weekend learners and respects stage capacity, explicit zero and price multipliers', () => {
  const inp = fixture(), sc = inp.scenarios['기본'];
  close(labPremium(inp, sc, 'v23', 8, 4), 80);
  close(labPremium(inp, sc, 'v23', 80, 40), 200);
  close(labPremium(inp, sc, 'v23', 80, 40, 1.3), 260);
  // Other stages cap at 16 seats per conversation class (one class since 10-22, two before).
  inp.company.premiumClasses = 2;
  close(labPremium(inp, sc, 'host', 100, 0), 32 * 40);
  inp.company.premiumClasses = 1;
  close(labPremium(inp, sc, 'host', 100, 0), 16 * 40);
  inp.lab.premiumSeats.v23 = 0;
  close(labPremium(inp, sc, 'v23', 80, 40), 0);
  close(labSaturdaySeats(inp, 'host', 80, 16), 0);
  close(labSaturdaySeats(inp, 'v23', 800, 16, 2), 64);
});

test('break-even searches the capped revenue curve rather than multiplying an uncapped average', () => {
  const inp = fixture(), sc = inp.scenarios['기본'];
  // Independently: every student brings 90 tuition; eligible premium demand is 0.2 per
  // student, at 40 each, with at most five premium places. This crosses the cap at n=25.
  for (const fixed of [1000, 5000]) {
    const expected = fixed === 1000 ? 10.3 : 53.4;
    const result = labBep(inp, sc, 'v23', { extraFixedMNT: fixed });
    assert.equal(result.students, expected);
    const margin = n => 90 * n + Math.min(n * 0.2, 5) * 40 - fixed;
    assert.ok(margin(result.students) >= 0);
    assert.ok(margin(result.students - 0.1) < 0);
    close(result.revPer, (90 * expected + Math.min(expected * 0.2, 5) * 40) / expected);
  }
  inp.lab.premiumSeats.v23 = 0;
  assert.equal(labBep(inp, sc, 'v23', { extraFixedMNT: 1000 }).students, 11.2);
});

test('break-even computes payment fees on the capped total and uses the room-specific weekend limit', () => {
  const inp = fixture(), sc = inp.scenarios['기본'];
  inp.lab.other.paymentFee = 0.1;
  const result = labBep(inp, sc, 'v23', { extraFixedMNT: 5000 });
  const profit = n => (90 * n + Math.min(n * 0.2, 5) * 40) * 0.9 - 5000;
  assert.ok(profit(result.students) >= 0 && profit(result.students - 0.1) < 0);
  inp.lab.premiumSeats.v23 = 1000;
  inp.lab.stages.v23.satSlotsPerRoom = 0.1;
  const limited = labBep(inp, sc, 'v23', { extraFixedMNT: 5000 }, { rooms: 1 });
  const full = labBep(inp, sc, 'v23', { extraFixedMNT: 5000 }, { rooms: 4 });
  assert.ok(limited.students < full.students, 'the monthly rule moves excess weekend demand into weekday seats');
});

test('monthly runs use the same eligibility and cap for every open month, including no-class and half-class sensitivities', () => {
  for (const classes of [2, 1, 0]) {
    const inp = structuredClone(base);
    setPremiumClasses(inp, classes);
    assert.equal(inp.lab.premiumSeats.v23, classes * 24);
    const result = run(inp, '기본', { labMode: 'full4', stopRule: false });
    for (const row of result.rows) {
      const { lab, m } = row;
      if (lab.students === 0) {
        assert.equal(lab.premium, 0);
        continue;
      }
      const regular = lab.students * (1 - inp.lab.lightShare);
      const seats = regular + lab.students * inp.lab.lightShare * 0.5;
      const fill = inp.lab.classFill;
      const size = Math.min(inp.lab.stages[lab.stage].targetClassSize, Math.max(fill.min, fill.base + seats / fill.perSeats));
      const saturday = lab.stage === 'v23' ? Math.min(regular * inp.lab.weekendShare, lab.rooms * inp.lab.stages.v23.satSlotsPerRoom * size) : 0;
      const cap = lab.stage === 'v23' ? classes * 24 : classes * 16;
      const inflation = Math.pow(1 + inp.lab.inflation.price, inp.lab.inflation.steps.filter(step => step <= m).length);
      const expected = Math.min((regular - saturday) * inp.lab.premiumUptake, cap)
        * inp.lab.prices.premiumAddon * (1 - inp.lab.leakage) * inp.scenarios['기본'].priceRealization * inflation;
      close(lab.premium, expected);
    }
  }
});

test('break-even opens weekday and Saturday classes separately, with their actual teaching cost and shared weekday teachers', () => {
  const inp = fixture(), L = inp.lab, sc = inp.scenarios['기본'];
  L.staff.teacherHourly = 1;
  L.staff.hoursPerClass = 100;
  L.staff.v23.satClassCost = 20;
  for (const tier of L.incentives.baseBonus) tier.each = 10;
  const fixed = 1000;
  const result = labBep(inp, sc, 'v23', { extraFixedMNT: fixed });
  const margin = n => {
    const size = Math.min(L.stages.v23.targetClassSize, Math.max(L.classFill.min, L.classFill.base + n * 0.9 / L.classFill.perSeats));
    const satSeats = Math.min(n * 0.4, L.stages.v23.rooms * L.stages.v23.satSlotsPerRoom * size);
    const sat = Math.ceil(satSeats / size - 1e-9);
    const weekday = Math.max(2, Math.ceil((n * 0.9 - satSeats) / size - 1e-9));
    const headcount = L.staff.ops.v23 + 3;
    return 90 * n + Math.min((n * 0.8 - satSeats) * 0.5, 5) * 40
      - weekday * 100 - sat * 20 - Math.ceil(weekday / 2) * 10 - headcount * 10 - fixed;
  };
  assert.ok(margin(result.students) >= 0 && margin(result.students - 0.1) < 0);
  // 평일·토요일 반을 따로 올림하는지는 토요일반이 있던 08-01 입력(주말 1/3 · 실마다 토요일 두 시간대)으로 잰다
  const with0801Saturday = structuredClone(base);
  with0801Saturday.lab.weekendShare = 1 / 3;
  with0801Saturday.lab.stages.v23.satSlotsPerRoom = 2;
  const actual = labClasses(with0801Saturday, 'v23', 117.4);
  assert.equal(actual.classes, 10, 'the old combined rounding counted only nine classes');
  close(result.students * result.contrib, result.fixedAdj + margin(result.students));
});

test('break-even pays the one-times bonus tier and revenue-linked field bonus before allowing the threshold', () => {
  const inp = fixture(), L = inp.lab, sc = inp.scenarios['기본'];
  L.incentives.baseBonus = [{atBep:0,each:10},{atBep:1,each:100},{atBep:1.6,each:150}];
  L.incentives.fieldBonusMin = 5;
  L.incentives.fieldBonusRate = 0.05;
  const result = labBep(inp, sc, 'v23', {extraFixedMNT:1000});
  const profit = (n,ratio) => {
    const size = Math.min(L.stages.v23.targetClassSize,Math.max(L.classFill.min,L.classFill.base+n*0.9/L.classFill.perSeats));
    const sat = Math.min(n*0.4,L.stages.v23.rooms*L.stages.v23.satSlotsPerRoom*size);
    const weekday = Math.max(2,Math.ceil((n*0.9-sat)/size-1e-9));
    const headcount = L.staff.ops.v23+3+Math.ceil(weekday/2);
    const each = ratio>=1.6?150:ratio>=1?100:10;
    const revenue = 90*n+Math.min((n*0.8-sat)*0.5,5)*40;
    return revenue-Math.max(5,revenue*0.05)-headcount*each-1000;
  };
  assert.equal(result.boundaryBonusEach,100);
  assert.ok(profit(result.students,1)>=0);
  assert.ok(profit(result.students-0.1,1)<0,'search includes the tier that will actually be paid');
  assert.ok(profit(result.students*1.6,1.6)>0,'the next bonus tier remains affordable in the fixture');
  close(result.marginAtBep,profit(result.students,1));
});

// 운영 계획(보수적)의 몽골 판을 2030-12까지 돌린다. model.mjs의 runPlan이 몽골에 쓰는 것과 같은 선택이다
const mnPlanRun = () => {
  const inp = structuredClone(base); inp.timeline = { ...inp.timeline, end: inp.planHorizon.end };
  const opts = { labMode: 'full4', stopRule: false, labFill: inp.targets.labFill, pathShare: inp.targets.pathShare, ...inp.targets.mnStart, countryOnly: false, plan: inp.plans['보수적'] };
  return { inp, r: run(inp, '기본', opts) };
};
const near = (actual, expected, tol = 1, what = '') => assert.ok(Math.abs(actual - expected) <= tol, `${what} ${actual} != ${expected}`);

// [11-18 유호님 「웅 넣어」 · 「웅」(2030년 귀국)] K드라마 주말 워크숍과 대표 귀국의 계산 규칙을 지킨다 — 워크숍 비용은 반 수 × (보조 + 제작 실비) + 진행자 시급(대표 · 한국인 강사가 맡지 않는 반) + 빌린 교실 단계의 주말 교실 사용료,
// 대표는 울란바토르에 있는 동안 한 반을 대표 시간으로 맡고, 귀국 달부터 교실은 멀리서 점검만 한다. 한국인 강사는 넘겨받는 달부터 자리값이 나가고 그달만 외국인 고용 부담금을 한 명 몫 더 낸다
test('11-18 K-drama weekend workshop and 2030 return home: workshop cost by class, founder hours, Korean teacher from the handover month', () => {
  const { inp, r } = mnPlanRun();
  const W = inp.lab.workshop, KT = inp.lab.krTeacher, RH = inp.company.returnHome, si = 1 + inp.lab.socialInsurance;
  const at = (m) => r.rows.find((x) => x.m === m);
  const steps = (m) => inp.lab.inflation.steps.filter((s) => m >= s).length;
  const expectWs = (row, free) => {
    const { lab, m } = row; const w = Math.pow(1 + inp.lab.inflation.wage, steps(m)); const ri = Math.pow(1 + inp.lab.inflation.rent, steps(m));
    const classes = Math.ceil(lab.students * (1 - inp.lab.lightShare) * W.uptake / W.perClass - 1e-9);
    const paid = classes - Math.min(classes, free);
    return { classes, cost: paid * W.leadHoursPerClass * W.leadHourlyMNT * w * si + classes * W.assistHoursPerClass * W.assistHourlyMNT * w * si + classes * W.productionPerClassMNT + (lab.stage === 'host' ? classes * W.sessionHours * W.hostRoomHourMNT * ri : 0) };
  };
  // 빌린 교실 단계(대표가 한 반을 맡음)와 직영 단계(귀국 뒤 한국인 강사가 두 반까지)
  for (const [m, free] of [['2027-10', W.founderClasses], ['2028-10', W.founderClasses], ['2030-10', W.krTeacherClasses]]) {
    const row = at(m); const e = expectWs(row, free);
    assert.equal(row.lab.wsClasses, e.classes, `${m} 워크숍 반 수`);
    close(row.lab.workshop, e.cost);
  }
  assert.equal(at('2027-10').lab.stage, 'host');
  assert.ok(at('2027-10').lab.wsRoom > 0 && at('2030-10').lab.wsRoom === 0, '주말 교실 사용료는 빌린 교실 단계에서만');
  // 대표 시간: 울란바토르에 있는 동안 회화 + 교실 운영 30시간 + 워크숍 한 반, 귀국 달부터 교실 점검만 · 한국 쪽 유학 · 정착 시간
  const C = inp.company; const teach = C.premiumClasses * C.premiumTeachingHoursPerClass;
  close(at('2027-10').hours.lab, teach + 30 + W.leadHoursPerClass);
  close(at(RH.month).hours.lab, RH.labRemoteHours);
  const before = addMonth(RH.month, -1); const after = '2030-04';
  // [11-18 대체 검수 P2-1] 넘겨받는 달(2030-01)에는 한국인 강사가 워크숍을 맡는다. 대표 교실 시간은 회화 32.5 + 교실 운영 30 = 62.5시간이고 워크숍 22시간이 붙지 않는다
  assert.equal(before, '2030-01');
  close(at(before).hours.lab, teach + 30);
  close(at(before).hours.lab, 62.5);
  assert.equal(at(before).lab.wsFounderHours, 0);
  // [11-18 대체 검수 P3] 베트남 · 우즈베키스탄 워크숍 값 = 몽골 값 × 그 나라 배수(시급은 임금, 제작 실비는 기타). 대표가 맡는 반은 없다
  for (const c of ['vn', 'uz']) { const s = inp.countries[c].scale, o = inp.countries[c].overrides.lab.workshop; close(o.leadHourlyMNT, W.leadHourlyMNT * s.wage); close(o.assistHourlyMNT, W.assistHourlyMNT * s.wage); close(o.productionPerClassMNT, W.productionPerClassMNT * s.other); assert.equal(o.founderClasses, 0, c); }
  assert.ok(at(after).hours.path - at('2029-04').hours.path >= RH.pathHours - 1e-9, '귀국 뒤 한국 쪽 유학 · 정착 시간이 더해진다');
  // 한국인 강사: 넘겨받는 달(귀국 한 달 전)부터, 그달만 외국인 고용 부담금 한 명 몫을 더 낸다
  assert.equal(at(addMonth(before, -1)).lab.krTeacher, 0);
  const kt = (m) => { const w = Math.pow(1 + inp.lab.inflation.wage, steps(m)); const ri = Math.pow(1 + inp.lab.inflation.rent, steps(m)); return KT.salaryMNT * w * si + KT.housingMNT * ri + KT.flightMNT; };
  close(at(before).lab.krTeacher, kt(before) + inp.lab.staff.foreignLevy.mnt);
  close(at(RH.month).lab.krTeacher, kt(RH.month));
  close(at(RH.month).company.oneOff - (inp.company.oneOff.filter((x) => x.month === RH.month).reduce((a, x) => a + x.krw, 0)), RH.krw);
  // 넘겨받는 달 전에는 한국인 강사 자리값이 없다
  for (const row of r.rows) if (row.m < before) assert.equal(row.lab.krTeacher, 0);
});
function addMonth(label, n) { let [y, m] = label.split('-').map(Number); m += n; while (m > 12) { m -= 12; y += 1; } while (m < 1) { m += 12; y -= 1; } return `${y}-${String(m).padStart(2, '0')}`; }

// [11-18 대체 검수 P2-1] 앞 시험은 워크숍 · 한국인 강사 값 자체만 재서, 학원 비용 합계에서 두 값을 빼도 통과했다.
// 이 시험은 달마다 학원 비용이 비용 칸을 모두 더한 값(워크숍 · 한국인 강사 포함)과 같은지 본다.
// 저장된 results.json의 2030년 값(운영 계획 보수적의 몽골 판)이 지금 입력과 같은지도 본다. 아래 11-09 시험의 저장 값 대조는 2029년까지만 본다
test('11-18 lab cost carries the workshop and the Korean teacher: monthly cost equals its columns, stored 2030 plan results match the inputs', () => {
  const { r } = mnPlanRun();
  const at = (m) => r.rows.find((x) => x.m === m);
  const cols = ['wages', 'socialIns', 'cleaning', 'rent', 'utilities', 'materials', 'marketing', 'cu', 'benefits', 'appAI', 'bookCost', 'extrasCost', 'adminFixed', 'countryOverhead', 'paymentFee', 'reserve', 'hostFee', 'hostTail', 'workshop', 'krTeacher', 'incentives', 'remitCost'];
  for (const m of ['2027-10', '2030-10']) {
    const { lab } = at(m);
    for (const k of cols) assert.equal(typeof lab[k], 'number', `${m} lab.${k}`);
    assert.ok(lab.workshop > 0, `${m} 워크숍 비용이 있어야 대조가 뜻이 있다`);
    near(lab.cost, cols.reduce((a, k) => a + lab[k], 0), 1, `${m} 학원 비용 = 비용 칸 합`);
  }
  assert.ok(at('2030-10').lab.krTeacher > 0, '2030-10 한국인 강사 자리값이 있어야 대조가 뜻이 있다');
  // 저장된 2030년 값
  const R = JSON.parse(readFileSync(new URL('../docs/유지비_BM/BM_통합설계_20261018/results.json', import.meta.url), 'utf8'));
  const P = R.plans['보수적'];
  assert.equal(P.countries[0], 'mn');
  const y2030 = r.rows.filter((x) => x.m.startsWith('2030'));
  assert.equal(y2030.length, 12);
  const S = (f) => y2030.reduce((a, x) => a + f(x), 0);
  const mn = P.years[2030].byC.mn;
  near(mn.labRev, S((x) => x.labKRW.revenue), 1, '2030 학원 매출');
  near(mn.labProfit, S((x) => x.labKRW.profit), 1, '2030 학원 이익');
  near(mn.ebitda, S((x) => x.ebitdaKRW), 1, '2030 몽골 판 영업이익');
  near(mn.endStudents, y2030[11].lab.students, 1e-9, '2030-12 학생');
  for (const x of y2030) {
    const s = P.monthly.find((q) => q.m === x.m).byC.mn;
    near(s.labProfit, x.labKRW.profit, 1, `${x.m} 학원 이익`);
    near(s.students, x.lab.students, 1e-9, `${x.m} 학생`);
  }
});

// [11-18 대체 검수 P2-1] 손익분기도 워크숍 비용과 한국인 강사 자리값을 내야 한다. 앞의 고정 값은 워크숍 참여율이 0이라 두 값을 빼도 통과했다.
// 고정 값 위에서 워크숍 참여율과 강사 자리값을 0보다 크게 두고, 손익분기 학생 수를 따로 셈한 이익과 맞댄다
test('11-18 break-even pays the workshop classes and the Korean teacher seat before allowing the threshold', () => {
  const inp = fixture(), sc = inp.scenarios['기본'];
  Object.assign(inp.lab.workshop, { uptake: 0.5, perClass: 10, leadHoursPerClass: 2, leadHourlyMNT: 10, assistHoursPerClass: 1, assistHourlyMNT: 5, productionPerClassMNT: 20, hostRoomHourMNT: 0 });
  const fixed = 1000, seat = 300, free = 1;
  const result = labBep(inp, sc, 'v23', { extraFixedMNT: fixed }, { krTeacherMNT: seat, wsFree: free });
  // 정규 학생은 0.8n(라이트 20%), 워크숍에 그 절반이 나오고 열 명이 한 반이다. 한 반은 돈 없이 맡고 나머지 반에 진행자 2시간 × 10을 낸다. 보조 1시간 × 5와 제작 실비 20은 모든 반에 낸다
  const ws = (n) => { const classes = Math.ceil(n * 0.8 * 0.5 / 10 - 1e-9); return (classes - Math.min(classes, free)) * 2 * 10 + classes * (1 * 5 + 20); };
  const margin = (n) => 90 * n + Math.min(n * 0.2, 5) * 40 - ws(n) - fixed - seat;
  assert.ok(margin(result.students) >= 0, `손익분기 ${result.students}명에서 이익이 0 아래`);
  assert.ok(margin(result.students - 0.1) < 0, '한 칸 앞에서 이미 흑자라면 더 이른 손익분기를 놓쳤다');
  assert.ok(ws(result.students) > 0, '손익분기에서 워크숍 반이 열려 있어야 대조가 뜻이 있다');
  close(result.fixedAdj, fixed + seat);
  close(result.marginAtBep, margin(result.students));
  assert.ok(result.students > labBep(inp, sc, 'v23', { extraFixedMNT: fixed }, { wsFree: free }).students, '강사 자리값이 손익분기를 올린다');
});

// [11-10] 11-09 방향을 넣은 운영 계획 정본을 지킨다 — 자동화(진단 → 구축 → 월 유지)는 선택사항이라 기본 계산에서 0이고 값은 비교 줄로 남는다,
// 대표 직접 출강은 2027-01부터다, 무겁게 본 대표 시간은 기본 계산에 섞이지 않는다. 저장된 results.json이 지금 입력과 같은 값인지도 본다(입력만 고치고 다시 돌리지 않은 것을 잡는다).
test('11-09 direction base: automation stays out of the base run but its prices remain for comparison, direct lectures start 2027-01, stored results match the inputs', () => {
  const MAIN = { labMode: 'full4', stopRule: false };
  const sum = (rows, y, f) => rows.filter((r) => r.m.startsWith(String(y))).reduce((a, r) => a + f(r), 0);
  const r = run(structuredClone(base), '기본', MAIN);
  for (const y of [2027, 2028, 2029]) close(sum(r.rows, y, (x) => x.shift.entry + x.shift.buildFee + x.shift.maintFee + x.shift.diagnoses), 0);
  assert.equal(base.shift.lecture.from, '2027-01');
  assert.ok(r.rows.find((x) => x.m === '2027-01').shift.lectures > 0, '2027-01 직접 출강이 서야 한다');
  assert.equal(r.rows.find((x) => x.m === '2026-12').shift.lectures, 0);
  // 값은 지우지도 새로 정하지도 않았다 — 10-22 계획 건수대로 팔면 자동화 매출이 다시 생긴다
  assert.equal(base.shift.lecture.avgPrice, 623_000);
  assert.equal(base.shift.entry.avgPrice, 400_000);
  assert.equal(base.shift.automation.buildPrice, 2_000_000);
  assert.equal(base.shift.automation.monthly, 200_000);
  const sold = structuredClone(base); sold.shift.entry.orders = structuredClone(sold.shift.entry.ordersIfSold);
  assert.ok(sum(run(sold, '기본', MAIN).rows, 2028, (x) => x.shift.buildFee + x.shift.maintFee) > 0);
  // 대표 시간: 가볍게 본 값이 기본, 무겁게 본 값은 위험 줄에만
  const hours = (list, m) => list.filter((x) => x.month === m).reduce((a, x) => a + x.hours, 0);
  assert.equal(hours(base.company.oneOffHours, '2027-01'), 26 + 8 + 4 + 4 + 20);
  assert.equal(hours(base.company.oneOffHoursHeavy, '2027-01'), 35 + 8 + 15 + 13 + 13 + 60 + 20);
  assert.equal(hours(base.company.oneOffHours, '2026-12'), 26 + 4 + 4, '바우처 준비 20시간은 12월 보고 뒤(2027-01)');
  // 저장된 결과가 지금 입력과 같은가
  const R = JSON.parse(readFileSync(new URL('../docs/유지비_BM/BM_통합설계_20261018/results.json', import.meta.url), 'utf8'));
  for (const y of [2027, 2028, 2029]) close(sum(R.scenarios['기본'].rows, y, (x) => x.shift.revenue), sum(r.rows, y, (x) => x.shift.revenue));
  assert.equal(R.scenarios['기본'].leadFrom, r.leadFrom);
  assert.equal(R.recalc1110.light.leadFrom, r.leadFrom);
  // 비교 값 덩이(운영 계획으로 돌린 값)의 2027년 SHIFT 매출 · 조건 석 달 평균은 이 기본 계산(시장 몫 방식)과 같아야 한다 — 문서가 두 값을 같은 것으로 읽는다
  close(R.recalc1110.light.shift2027, sum(r.rows, 2027, (x) => x.shift.revenue));
  close(R.recalc1110.light.gateAvg, r.rows.filter((x) => x.m >= '2027-09' && x.m <= '2027-11').reduce((a, x) => a + x.pulse.ads + x.shift.revenue, 0) / 3);
  assert.equal(R.checks.length, 0, '저장된 결과에 검산 실패가 남아 있다');
  // 회사 전체 값과 무겁게 본 판도 저장된 결과와 같은가(LAB · PATH 입력이나 무겁게 본 시간만 고치고 다시 돌리지 않은 것을 잡는다)
  for (const y of [2027, 2028, 2029]) {
    close(sum(R.scenarios['기본'].rows, y, (x) => x.revenueKRW), sum(r.rows, y, (x) => x.revenueKRW));
    close(sum(R.scenarios['기본'].rows, y, (x) => x.ebitdaKRW), sum(r.rows, y, (x) => x.ebitdaKRW));
  }
  const heavyInp = structuredClone(base); heavyInp.company.oneOffHours = structuredClone(heavyInp.company.oneOffHoursHeavy);
  const heavy = run(heavyInp, '기본', MAIN);
  // 넘는 달은 모두 2027-08 전이라 운영 계획으로 돌린 비교 값과 이 계산(시장 몫 방식)의 넘친 시간 합이 같다
  close(R.recalc1110.heavy.overSum, heavy.rows.filter((x) => x.m >= '2026-11' && x.m <= '2027-12').reduce((a, x) => a + x.hours.fixedOver, 0));
  assert.equal(heavy.rows.find((x) => x.m === '2027-01').shift.lectures, 0, '무겁게 보면 2027-01 직접 출강이 서지 않는다');
  // [11-14 유호님 「여기서 다 바꿔」] 온라인 반을 첫 기수부터 강사가 맡아(대표 월 30시간이 빠짐) 2027-03은 상한 아래로 내려왔다
  assert.deepEqual(R.recalc1110.heavyDrop.map((x) => x.m), ['2027-01']);
});
