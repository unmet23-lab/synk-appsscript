import test from 'node:test';
import assert from 'node:assert/strict';
import base from '../docs/유지비_BM/BM_통합설계_20261018/inputs.mjs';
import { labBep, labPremium, labSaturdaySeats, labClasses, setPremiumClasses, run } from '../docs/유지비_BM/BM_통합설계_20261018/model.mjs';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);
const fixture = () => {
  const inp = structuredClone(base), L = inp.lab;
  L.lightShare = 0.2;
  L.weekendShare = 0.5;
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
  close(labPremium(inp, sc, 'host', 100, 0), 32 * 40);
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
  const actual = labClasses(base, 'v23', 117.4);
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
