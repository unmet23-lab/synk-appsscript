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
