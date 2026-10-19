// SYNK BM 통합 설계 — 계산 모델 (2026-10-18)
// 실행: node docs/유지비_BM/BM_통합설계_20261018/model.mjs
// 결과: 같은 폴더의 results.json(모든 달·모든 가정)과 results.md(표)
// 입력은 inputs.mjs 한 곳에서만 바꾼다. 이 파일은 계산 규칙이다.

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import base from './inputs.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const clone = (o) => JSON.parse(JSON.stringify(o));

// ───────── 달력 도구 ─────────
function monthList(start, end) {
  const out = [];
  let [y, m] = start.split('-').map(Number);
  const [ey, em] = end.split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1; if (m > 12) { m = 1; y += 1; }
  }
  return out;
}
const moy = (label) => Number(label.slice(5));
const yearOf = (label) => Number(label.slice(0, 4));
// [10-19 관문] 개원 전 문의가 쌓이는 달(개원 달 lab.opGate.leadMonthsBefore달 전 ~ 개원 달)과 그 계절 가중치 — 나라마다 그 나라 개원 달 기준 [페이블 9차 P3-5]
function leadWeights(L) {
  const months = []; for (let mm = addMonths(L.openMonth, -L.opGate.leadMonthsBefore); mm <= L.openMonth; mm = addMonths(mm, 1)) months.push(mm);
  const w = months.map((mm) => L.season[Number(mm.slice(5))]);
  return { months, w, sum: w.reduce((a, x) => a + x, 0) };
}
function addMonths(label, n) {
  let [y, m] = label.split('-').map(Number);
  m += n;
  while (m > 12) { m -= 12; y += 1; }
  while (m < 1) { m += 12; y -= 1; }
  return `${y}-${String(m).padStart(2, '0')}`;
}
// [{from, v}] 계단: 그 달에 해당하는 마지막 값(첫 from 전에는 dflt)
function step(list, label, dflt = 0) {
  let v = dflt;
  for (const s of list || []) if (label >= s.from) v = s.v;
  return v;
}

// ───────── 시장 깔때기 [10-19 유호님 「TOPIK → 유학생(+취업)은 전부 기본 잠재 고객」] ─────────
// 해마다(1월 계단) growth만큼 커진다. 몽골 숫자는 2025년 값, 한국 체류 유학생은 2026-08 값이 기준
function marketAt(inp, label) {
  const K = inp.market; const mn = K.mongolia;
  const g = (y0) => Math.pow(1 + K.growth, Math.max(0, yearOf(label) - y0));
  return {
    pool: (mn.topik * mn.topikDedup + mn.eps + mn.d4Direct) * mn.ubShare * g(K.baseYear), // 울란바토르 한국행 준비 인원(연): TOPIK 지원(사람) + EPS-TOPIK 접수 + TOPIK 없이 가는 어학연수
    ubNew: mn.newStudents * mn.ubShare * g(K.baseYear), // 울란바토르에서 그해 새로 한국 유학을 가는 사람
    countryNew: mn.newStudents * g(K.baseYear), // 그 나라 전체에서 그해 새로 한국 유학을 가는 사람(세 지표의 유학 10% 기준)
    inKorea: mn.studentsInKorea * g(2026), // 한국에 있는 몽골 유학생(취업 준비 상품 대상)
    targetsNew: K.targetsNewStudents * g(K.baseYear), // 대상 국가 한 해 새 한국 유학생(온라인 상담 대상)
  };
}

// ───────── LAB 손익분기(단계별) ─────────
// 기간권 비중은 달마다 다를 수 있다(첫해 짧은 권 위주). mix를 안 주면 마지막 계단(자리 잡은 뒤)을 쓴다
function passMixAt(inp, label) {
  const pm = inp.lab.passMix;
  if (!Array.isArray(pm)) return pm;
  return label ? step(pm, label, pm[0].v) : pm[pm.length - 1].v;
}
function labUnit(inp, sc, mix = passMixAt(inp)) {
  const L = inp.lab;
  const pReg = mix.m1 * L.prices.m1 + mix.m3 * L.prices.m3 + mix.m6 * L.prices.m6 + mix.m12 * L.prices.m12;
  const keep = (1 - L.leakage) * sc.priceRealization;
  const regShare = 1 - L.lightShare;
  const tuitionPer = (regShare * pReg + L.lightShare * L.prices.light) * keep; // 학생 1명 평균 수강료
  const premiumPer = regShare * L.premiumUptake * L.prices.premiumAddon * keep;
  const bookRev = L.textbook.enabled ? (L.textbook.booksPerYear / 12) * L.textbook.pricePerBook : 0;
  const bookCost = L.textbook.enabled ? (L.textbook.booksPerYear / 12) * L.textbook.costPerBook : 0;
  const seatEq = regShare + 0.5 * L.lightShare; // 라이트 과정은 격일이라 좌석 0.5개
  const avgPrepaid = mix.m1 * L.prepaidMonthsRemaining.m1 + mix.m3 * L.prepaidMonthsRemaining.m3 + mix.m6 * L.prepaidMonthsRemaining.m6 + mix.m12 * L.prepaidMonthsRemaining.m12;
  return { pReg, tuitionPer, premiumPer, bookRev, bookCost, seatEq, avgPrepaid };
}

// SYNK반 기관 몫: shareTiers가 있으면 한계 계단(60명까지 30%, 61~100명 몫 25% …)의 평균 비율, 없으면 hostShare 하나
function hostRateAt(H, s) {
  if (!H.shareTiers || !H.shareTiers.length) return H.hostShare;
  if (s <= 0) return H.shareTiers[0].rate;
  let prev = 0; let fee = 0;
  for (const tier of H.shareTiers) { const up = tier.upTo == null ? Infinity : tier.upTo; const take = Math.max(0, Math.min(s, up) - prev); fee += take * tier.rate; prev = up; if (s <= up) break; }
  return fee / s;
}

// 반 평균 인원: 학생이 적으면 레벨·시간대가 흩어져 덜 찬다(좌석 40개 9명 → 100개 12명, 단계 상한까지)
function avgClassSize(inp, stageKey, seats) {
  const f = inp.lab.classFill; const cap = inp.lab.stages[stageKey].targetClassSize;
  if (!f) return cap;
  return Math.min(cap, Math.max(f.min, f.base + seats / f.perSeats));
}

// 단계 고정비(₮/월). mult는 그달 물가 계단(wage·rent) — 넓히는 기준·멈춤 규칙이 그달 값으로 재게 한다 [아르곤 코드 검수 10-18]
function labStageFixed(inp, stageKey, opts = {}, mult = {}) {
  const L = inp.lab; const S = L.stages[stageKey]; const st = L.staff; const o = L.other;
  const si = 1 + L.socialInsurance;
  const w = mult.wage || 1; const ri = mult.rent || 1;
  const opsN = stageKey === 'host' ? (mult.hostRooms > 2 ? (st.ops.host3 ?? st.ops.host) : st.ops.host) : st.ops[stageKey];
  const ops = opsN * st.ops.wage;
  const v23 = stageKey === 'v23' ? st.v23 : null; // 08-01 4실 편제: 댄스(전일+토)·뷰티·보컬 위성 강사
  const wages = (st.director + ops + (v23 ? v23.dance + v23.beauty + v23.vocal : st.dance)) * w;
  const avgUtil = (S.areaM2 * L.utilitiesPerM2MNT) * ri * (Object.values(L.utilitiesSeason).reduce((a, b) => a + b, 0) + (12 - Object.keys(L.utilitiesSeason).length)) / 12;
  const headcountBase = opsN + (v23 ? 3 : 1) /* 댄스(+뷰티·보컬) */;
  const HS = L.hosted || {};
  const hostRentFixed = stageKey === 'host' && HS.fixedPerRoomMNT ? HS.fixedPerRoomMNT * (mult.hostRooms || S.rooms) * ri : 0; // 고정 임대로 계약하면 기관 몫이 고정비가 된다
  const rentMNT = S.rentFixedMNT ? S.rentFixedMNT : S.areaM2 * L.rentPerM2MNT; // 08-01 4실은 77평 임대 월 1,500만₮
  const fixed = hostRentFixed + wages * si + st.cleaning[stageKey] * w + rentMNT * ri * (opts.rentMult || 1) + avgUtil
    + o.materialsSW[stageKey] + o.marketing[stageKey] + o.cuBase + o.accountingAudit[stageKey] + o.insurance[stageKey]
    + L.incentives.fieldBonusMin * si + L.incentives.baseBonus[0].each * headcountBase * si
    + st.foreignLevy.count * st.foreignLevy.mnt // 외국인 고용 부담금(사회보험 대상 아님)
    + (opts.extraFixedMNT || 0) // [페이블 5차] 나라 판 손익분기: 현지 책임자·회계·출장
    + (opts.demand === 'acq' ? (stageKey === 's2' || stageKey === 'v23' ? L.acquisition.adBudgetMNT[1].v : L.acquisition.adBudgetMNT[0].v) : 0); // 옛 수요 방식의 광고비(달 평균). 시장 방식은 광고비가 새 등록을 따라 움직여 손익분기에서 변동비로 센다
  return { fixed, wages, avgUtil };
}

// 손익분기 학생 수: 달별 계산(run)과 같은 규칙으로 센다 — 반 수는 올림(최소 2반), 강사 기본 성과급(두 반에 한 명), 그달 물가 계단(mult).
// 반 수가 올림이라 이익이 톱니 모양이므로, 0.1명씩 늘려 처음 흑자가 되는 학생 수를 찾는다 [아르곤 코드 검수 10-18]
// 가격·비용은 mult가 없으면 2027년 값, 기간권 비중은 자리 잡은 뒤 값
function labBep(inp, sc, stageKey, opts = {}, mult = {}) {
  const L = inp.lab; const st = L.staff; const o = L.other;
  const u = labUnit(inp, sc);
  const si = 1 + L.socialInsurance;
  const p = mult.price || 1; const w = mult.wage || 1;
  const wkdClassCost = st.hoursPerClass * st.teacherHourly * si * w;
  const v23 = stageKey === 'v23' ? st.v23 : null;
  const classCost = v23 ? ((1 - L.weekendShare) * wkdClassCost + L.weekendShare * v23.satClassCost * si * w) : wkdClassCost;
  const dirTeach = v23 ? v23.directorTeachesClasses : st.directorTeachesClasses;
  const { fixed } = labStageFixed(inp, stageKey, opts, mult);
  const fixedAdj = fixed - dirTeach * classCost; // 원장이 맡는 반만큼은 강사비가 안 든다(4실 편제는 0반)
  const revPer = (u.tuitionPer + u.premiumPer + u.bookRev) * p;
  const HS = L.hosted || {};
  const hostFeePer = stageKey === 'host' && !HS.fixedPerRoomMNT ? hostRateAt(HS, 0) * (u.tuitionPer + u.premiumPer) * p : 0; // 기존 기관에 내는 공간 사용료(손익분기 근처는 첫 계단)
  const hostFloor = stageKey === 'host' && HS.floorPerRoomMNT ? HS.floorPerRoomMNT * (mult.hostRooms || L.stages.host.rooms) * (mult.rent || 1) : 0; // 최소 보장: 몫이 이보다 작으면 모자란 만큼 더 낸다
  const adPer = opts.demand === 'acq' ? 0 : (1 - sc.labRetention) * inp.market.paidShare * L.acquisition.cacMNT[sc.label]; // 시장 방식: 나가는 학생만큼 새로 데려오는 광고비(학생 1명·달)
  const otherVar = o.topikFeeSupport / 12 + o.jacket / 24 + o.appAIperStudentKRW * inp.fx.mntPerKrw + u.bookCost + (o.paymentFee + o.reserve) * revPer + hostFeePer + adPer;
  const classesAt = (n) => { const seats = n * u.seatEq; return Math.max(2, Math.ceil(seats / avgClassSize(inp, stageKey, seats) - 1e-9)); };
  const margin = (n) => {
    const classes = classesAt(n);
    const teacherBonus = Math.ceil(Math.max(0, classes - dirTeach) / 2) * L.incentives.baseBonus[0].each * si;
    return n * (revPer - otherVar) - classes * (classCost + o.cuPerClass) - teacherBonus - fixedAdj - Math.max(0, hostFloor - n * hostFeePer);
  };
  let n = null;
  for (let k = 1; k <= 20000; k += 1) { if (margin(k / 10) >= 0) { n = k / 10; break; } }
  if (n === null) return { students: Infinity, fixedAdj, revPer, varPer: NaN, contrib: NaN };
  const seats = n * u.seatEq; const size = avgClassSize(inp, stageKey, seats);
  const varPer = otherVar + (u.seatEq * (classCost + o.cuPerClass)) / size; // 손익분기 지점의 학생당 변동비(반 비용은 평균 인원으로 나눔)
  return { students: n, fixedAdj, revPer, varPer, contrib: revPer - varPer, classSize: size, classes: classesAt(n) };
}

// 정원: 쓸 수 있는 시간대 수 × 그 인원에서의 반 평균. 반 평균이 인원에 따라 늘어나므로 이분법
// 4실 직영 정원: 평일 시간대(정규 평일생 + 라이트 0.5석)와 토요일 시간대(주말생)를 따로 채운다. 둘 중 먼저 차는 쪽이 정원이다
function labCapacityV23(inp, wkdSlots, satSlots, sizeFixed) { // sizeFixed: 반마다 그 인원으로 채운 정원(세 지표의 「4실 정원」은 설계 16석)
  const L = inp.lab;
  const reg = 1 - L.lightShare;
  const wkdPer = reg * (1 - L.weekendShare) + 0.5 * L.lightShare; const satPer = reg * L.weekendShare;
  const seatEq = reg + 0.5 * L.lightShare;
  const fits = (n) => { const size = sizeFixed || avgClassSize(inp, 'v23', n * seatEq); return Math.ceil(n * wkdPer / size - 1e-9) <= wkdSlots && Math.ceil(n * satPer / size - 1e-9) <= satSlots; };
  let lo = 0; let hi = (wkdSlots + satSlots) * L.stages.v23.targetClassSize / Math.min(wkdPer, satPer || 1);
  for (let k = 0; k < 80; k += 1) { const mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; }
  return lo;
}

function labCapacity(inp, stageKey, slots) {
  const L = inp.lab;
  const seatEq = (1 - L.lightShare) + 0.5 * L.lightShare;
  const fits = (seats) => seats / avgClassSize(inp, stageKey, seats) <= slots + 1e-9;
  let lo = 0; let hi = slots * L.stages[stageKey].targetClassSize;
  if (fits(hi)) return hi / seatEq;
  for (let k = 0; k < 60; k += 1) { const mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; }
  return lo / seatEq;
}

// ───────── 한 가정(시나리오) 돌리기 ─────────
function run(inp, scName, opts = {}) {
  const sc = { ...inp.scenarios[scName], ...(opts.scOverride || {}) };
  const CO = !!opts.countryOnly; // [10-19 세 지표] 몽골 밖 나라: 그 나라 LAB·PATH만 센다(한국 법인·PULSE·SHIFT·WORLD·회사 공통비는 몽골 판에서 한 번만)
  const M = monthList(inp.timeline.start, inp.timeline.end);
  const fx = inp.fx;
  const toKRW = (mnt) => mnt / fx.mntPerKrw;
  const L = inp.lab; const P = inp.path; const ON = inp.online; const PU = inp.pulse; const SH = inp.shift; const C = inp.company; const F = inp.funding;
  const si = 1 + L.socialInsurance;
  const subV = CO ? 0 : (sc.subVolume ?? sc.volume); // PULSE·SHIFT: 계획한 고객 수 가운데 실제로 오는 몫
  // 몽골 물가: 9월 새 학기마다 계단식으로 오른다(inflation.steps)
  const infl = (m, rate) => { let k = 0; for (const s of (L.inflation?.steps || [])) if (m >= s) k += 1; return Math.pow(1 + (rate || 0), k); };
  const preOpenStart = addMonths(L.openMonth, -(opts.labMode === 'full4' ? (L.stages.v23.prepMonths || L.preOpenMonths) : L.preOpenMonths));
  const lastPreOpen = addMonths(L.openMonth, -1);
  const partnerOpt = !!opts.partnerMode; // C안: 현지 파트너가 교실을 운영하고 SYNK는 사용료를 받음(처음부터)
  const forceStage2 = !!opts.forceStage2; // B안: 처음부터 교실 4개
  const full4 = opts.labMode === 'full4'; // [10-19 기본] 08-01 4실 24반 직영: 77평을 처음부터 빌려 2실로 열고, 차면 한 실씩 연다
  const hosted = opts.labMode === 'hosted'; // D안: 첫해는 기존 기관 안 SYNK반, 현금 기준을 채우면 직영 교실 2개
  const directFrom = hosted ? (opts.directFrom || L.hosted.directFrom) : null;
  let directStage = opts.directStage || 's1'; // D안에서 직영으로 옮길 때 처음 여는 단계 — SYNK반 교실이 3개가 되면 교실 4개로 간다(정원이 줄지 않게)
  const bep1 = labBep(inp, sc, 's1', opts).students;
  const bep2 = labBep(inp, sc, 's2', opts).students;
  const bepHost = labBep(inp, sc, 'host', opts).students;
  const fdiKRW = F.mongoliaFdiUSD * fx.krwPerUsd;
  const buf = F.expansionBuffer || { krMonths: 0, safetyKRW: 0 };
  const fullCapexMNT = (key) => (key === 's2' ? L.stages.s1.capexMNT + L.stages.s2.capexMNT : L.stages[key].capexMNT) * (opts.capexMult || 1);
  const directCapexKRW = (key, rentMult) => toKRW(fullCapexMNT(key) + (L.stages[key].rentFixedMNT || L.stages[key].areaM2 * L.rentPerM2MNT) * rentMult * L.stages[key].depositMonths);
  const bepCache = {}; // 그달 단계·물가 계단별 손익분기(성과급 배수용)
  const bepAt = (key, mult, k) => { const c = `${key}|${k}|${mult.hostRooms || ''}`; if (!(c in bepCache)) bepCache[c] = labBep(inp, sc, key, opts, mult).students; return bepCache[c]; };
  let directNeedAt = null;

  const rows = [];
  let students = 0; let stage = null; let s2Start = null; let triggerRun = 0;
  let deferredPrev = 0; let shiftActive = 0; let leadFrom = null; let leadRun = 0;
  let directPrepStart = null; let directSwitch = null; let studentsAtSwitch = null;
  let v23Rooms = L.stages.v23 ? (opts.labFill ? L.stages.v23.rooms : L.stages.v23.startRooms) : 0; let v23Run = 0; let v23AddFrom = null; const v23AddMonths = []; // 4실 직영: 지금 연 실 수
  let hostRooms = L.stages.host.rooms; let hostRun = 0; let hostAddFrom = null; let hostFullRun = 0; const hostAddMonths = []; // hostFullRun: 교실을 다 빌린 뒤 정원 85%를 넘긴 달 수
  let foundingPaid = { 1.5: false, 2.5: false };
  const admissionsHist = []; const admValueHist = [];
  let cash = CO ? 0 : F.ownCashKRW; let grantBal = 0; let krFixedPrev = 0;
  let stopFrom = null; let stopRun = 0; const stopR = opts.stopRule ? C.stopRule : null; // 멈춤 규칙(현금이 모자라면 교실 운영을 현지 기관에 넘김)
  // 개원 관문: 2027-06 점검에서 수요 증거가 모자라면 SYNK반을 열지 않고 준비 첫 달부터 C안으로 간다(비품·채용 전에 정한다)
  const gateFail = hosted && !!stopR && !opts.noGate && !!L.openGate && sc.labPreReg < L.openGate.minPreReg;
  if (gateFail) stopFrom = preOpenStart;
  const yearMnRev = {}; const yearMnProfit = {}; const yearKrProfit = {};

  for (let i = 0; i < M.length; i += 1) {
    const m = M[i]; const mo = moy(m);
    const r = { m, lab: {}, path: {}, online: {}, pulse: {}, shift: {}, company: {}, hours: {}, cash: {} };
    const stopped = !!stopFrom && m >= stopFrom; // 멈춤 규칙이 걸린 뒤에는 C안처럼 돈다
    const partnerMode = partnerOpt || stopped;
    const wageM = infl(m, L.inflation?.wage); const rentInfl = infl(m, L.inflation?.rent); const rentM = rentInfl * (opts.rentMult || 1); const priceM = infl(m, L.inflation?.price);
    const multNow = { wage: wageM, rent: rentInfl, price: priceM };
    // 지난달 말 「가용 현금」 = 통장 잔액 − 아직 안 쓴 지원금(전용 통장). 넓히는 결정은 이 돈으로만 한다
    const freeCash = cash - grantBal;
    const krBuffer = buf.krMonths * krFixedPrev + buf.safetyKRW; // 한국 법인 고정비 석 달 + 안전 여유

    // ── LAB 단계
    const isPreOpen = m >= preOpenStart && m < L.openMonth;
    const isOpen = m >= L.openMonth;
    if (isOpen && stage === null) stage = hosted ? 'host' : (full4 ? 'v23' : (forceStage2 ? 's2' : 's1'));
    // D안 직영 준비는 계획 달 두 달 전부터, 가용 현금이 「출자(10만 달러 초과) + 한국 고정비 석 달 + 여유」를 채울 때 시작한다. 못 채우면 SYNK반을 이어 간다
    // 직영 준비는 ① 계획 달 두 달 전부터 ② SYNK반이 찼을 때(교실을 다 빌린 뒤 정원 85%를 두 달) ③ 가용 현금이 「출자 + 한국 고정비 석 달 + 여유」를 채울 때만 시작한다
    //    출자금은 몽골 법인 통장에서 공사·보증금·첫 석 달 운영에 쓴다. 그 합이 출자보다 크면 모자란 만큼 더 있어야 한다 [아르곤 코드 검수 10-18]
    const wantStage = opts.directStage || (hostRooms > L.stages.s1.rooms ? 's2' : 's1');
    const directNeedKRW = Math.max(fdiKRW, directCapexKRW(wantStage, rentM) + toKRW(3 * labStageFixed(inp, wantStage, opts, multNow).fixed)) + krBuffer;
    const prepM = L.hosted.prepMonths || 2;
    if (hosted && !stopped && !directPrepStart && m >= addMonths(directFrom, -prepM) && hostFullRun >= L.stages.s2.triggerMonths && freeCash >= directNeedKRW) {
      directPrepStart = m; directSwitch = addMonths(m, prepM); directStage = wantStage; directNeedAt = directNeedKRW;
    }
    if (hosted && stage === 'host' && directSwitch && m >= directSwitch) { stage = directStage; students *= 1 - (L.hosted.moveChurn || 0); studentsAtSwitch = students; } // 옮기기 직전 학생(꼬리 몫 계산용)
    if (s2Start && m >= s2Start) stage = 's2';
    const stageKey = stage || (hosted ? 'host' : (full4 ? 'v23' : (forceStage2 ? 's2' : 's1')));
    const S = L.stages[stageKey];
    const isDirectPre = hosted && directPrepStart && m >= directPrepStart && m < directSwitch; // 직영으로 옮기기 전 두 달(임대 겹침)
    // SYNK반 정원이 차면 기관 교실을 하나 더 빌린다(비품 값만 든다)
    let hostAddCapex = 0;
    if (stageKey === 'host' && hostAddFrom && m === hostAddFrom) { hostRooms = Math.min(hostRooms + 1, L.stages.host.maxRooms); hostAddCapex = L.stages.host.addRoomCapexMNT || 0; hostAddMonths.push(m); hostAddFrom = null; hostRun = 0; } // 교실은 하나씩 늘린다
    if (stageKey === 'v23' && v23AddFrom && m === v23AddFrom) { v23Rooms = Math.min(v23Rooms + 1, S.rooms); v23AddMonths.push(m); v23AddFrom = null; v23Run = 0; } // 공사는 처음에 다 했다
    const rooms = stageKey === 'host' ? hostRooms : (stageKey === 'v23' ? v23Rooms : S.rooms);

    // ── 부가 상품: 그 단계에서 열 수 있는 것만(EPS 반은 저녁 시간대를 하나 쓴다)
    const ex = L.extras;
    const exOn = (x) => !!x && isOpen && m >= x.from && (!x.stages || x.stages.includes(stageKey));
    const epsActive = exOn(ex.eps);
    const epsClasses = epsActive ? Math.max(1, Math.round(ex.eps.classes * sc.volume)) : 0; // [페이블 4차] 반 수는 정수
    const epsInCore = stageKey !== 'v23'; // [페이블 4차] 4실은 코어(11·14·15:30·18시) 뒤 저녁 반이라 코어 정원을 줄이지 않는다. 옛 단계는 저녁 시간대 하나를 쓴다
    const premiumSlots = L.premiumUsesRegularSlots ? C.premiumClasses : 0; // 회화 반이 정규 시간대를 쓰면 그만큼 준다
    const slots = isOpen ? rooms * S.slotsPerRoom - (epsInCore ? epsClasses : 0) - premiumSlots : 0;
    const cap = isOpen ? (stageKey === 'v23' ? labCapacityV23(inp, rooms * S.weekdaySlotsPerRoom - premiumSlots, rooms * S.satSlotsPerRoom, opts.labFill ? S.seatsPerClass : undefined) : labCapacity(inp, stageKey, slots)) : 0; // 세 지표는 설계 좌석(16석) 기준 정원

    // ── 학생 수
    // [10-19 기본] 시장 방식: 그해 울란바토르 한국행 준비 인원 ÷ 12 × LAB이 잡는 몫(labCapture) × 계절이 등록하러 온다.
    //   그중 paidShare는 광고로 오고(광고비 = 그 수 × CAC), 나머지는 콘텐츠·소개·WORLD로 온다. 정원이 차면 나머지는 대기자로 남고 그만큼 광고를 쓰지 않는다
    // 옛 방식(opts.demand = 'acq', 비교용): 콘텐츠·소개 등록 + 광고비 ÷ CAC
    const mk = marketAt(inp, m);
    let newStudents = 0; let adBudget = 0; let organicNew = 0; let paidNew = 0; let marketNew = 0; let waitlist = 0;
    if (isOpen) {
      const season = L.season[mo];
      const A = L.acquisition;
      const ret = sc.labRetention - ([6, 7, 8].includes(mo) ? L.summerRetentionDrop : 0);
      const pre = m === L.openMonth ? sc.labPreReg : 0;
      if (opts.labFill) { // [10-19 세 지표] 4실 정원의 labFill(80%)을 채운다고 본다. 새 등록 = 그 인원을 지키려고 나간 만큼 다시 받는 수
        const target = opts.labFill * cap;
        newStudents = Math.max(0, target - students * ret);
        paidNew = newStudents * inp.market.paidShare; organicNew = newStudents - paidNew;
        adBudget = paidNew * A.cacMNT[scName];
        students = target;
      } else if (opts.demand === 'acq') {
        adBudget = step(A.adBudgetMNT, m) * season * (opts.adMult ?? 1); // 1년 광고 예산을 계절대로 나눠 쓴다
        organicNew = step(A.organic, m) * sc.labNew * season;
        paidNew = adBudget / A.cacMNT[scName];
        const before = students * ret + organicNew + pre;
        // 정원이 차면 광고를 그만큼 줄인다(받을 수 없는 학생에게 광고비를 쓰지 않는다)
        const room = Math.max(0, cap - before);
        if (paidNew > room) { paidNew = room; adBudget = paidNew * A.cacMNT[scName]; }
        newStudents = organicNew + paidNew;
        students = Math.min(cap, before + paidNew);
      } else {
        marketNew = (mk.pool / 12) * step(inp.market.labCapture[scName], m) * season * (opts.demandMult ?? 1);
        const before = students * ret + pre;
        const want = Math.max(0, marketNew - pre); // [검수 2] 사전 등록은 그 달 시장 수요 안에 든다
        newStudents = Math.min(want, Math.max(0, cap - before));
        waitlist = want - newStudents;
        paidNew = newStudents * inp.market.paidShare; organicNew = newStudents - paidNew;
        adBudget = paidNew * A.cacMNT[scName];
        students = Math.min(cap, before + newStudents);
      }
    }
    // SYNK반 넓히기 신호: 정원의 85%를 두 달 넘기면 다음 달 기관 교실을 하나 더 빌린다
    if (isOpen && !partnerMode && stageKey === 'host' && !hostAddFrom && hostRooms < (L.stages.host.maxRooms || hostRooms)) {
      if (students >= L.stages.s2.triggerFill * cap) hostRun += 1; else hostRun = 0;
      if (hostRun >= L.stages.s2.triggerMonths) hostAddFrom = addMonths(m, 1);
    }
    // 4실 직영 넓히기 신호: 연 실의 정원 85%를 두 달 넘기면 다음 달 한 실 더 연다(최대 4실)
    if (isOpen && !partnerMode && stageKey === 'v23' && !v23AddFrom && v23Rooms < S.rooms) {
      if (students >= S.addRoom.triggerFill * cap) v23Run += 1; else v23Run = 0;
      if (v23Run >= S.addRoom.months) v23AddFrom = addMonths(m, 1);
    }
    if (isOpen && !partnerMode && stageKey === 'host' && hostRooms >= (L.stages.host.maxRooms || hostRooms)) {
      if (students >= L.stages.s2.triggerFill * cap) hostFullRun += 1; else hostFullRun = 0;
    }
    // 2단계 확장 신호: 1단계 실용 정원의 85%를 두 달 넘기면, 준비 석 달 뒤(또는 가장 이른 때) 연다
    // 단, 공사·보증금·2단계 고정비 석 달 치를 내고도 한국 법인 고정비 석 달 치와 여유가 남을 때만 연다(12절 멈춤 규칙)
    if (isOpen && !stopped && stageKey === 's1' && !s2Start) {
      if (students >= L.stages.s2.triggerFill * cap) triggerRun += 1; else triggerRun = 0;
      const s2Need = toKRW(L.stages.s2.capexMNT * (opts.capexMult || 1) + (L.stages.s2.areaM2 - L.stages.s1.areaM2) * L.rentPerM2MNT * rentM * L.stages.s2.depositMonths + 3 * labStageFixed(inp, 's2', opts, multNow).fixed) + krBuffer;
      if (triggerRun >= L.stages.s2.triggerMonths && (partnerOpt || freeCash >= s2Need)) {
        const cand = addMonths(m, L.stages.s2.setupMonths);
        s2Start = cand > L.stages.s2.earliest ? cand : L.stages.s2.earliest;
      }
    }

    // ── LAB 매출(₮) — 기간권 비중은 그달 계단(첫해 짧은 권 위주), 가격은 물가 계단을 곱한다
    const u = labUnit(inp, sc, passMixAt(inp, m < L.openMonth ? L.openMonth : m));
    const reg = students * (1 - L.lightShare); const light = students * L.lightShare;
    const lab = r.lab;
    lab.students = students; lab.newStudents = newStudents; lab.stage = isOpen ? stageKey : (isPreOpen ? 'pre' : null); lab.cap = cap; lab.rooms = isOpen ? rooms : 0; lab.slots = slots;
    lab.organicNew = organicNew; lab.paidNew = paidNew; lab.adBudget = adBudget; lab.marketNew = marketNew; lab.waitlist = waitlist; lab.pool = mk.pool;
    lab.leadsNeeded = isOpen ? newStudents / L.acquisition.leadToStudent[scName] : 0; // 콘텐츠·광고를 합쳐 이만큼 문의가 와야 이 등록이 나온다
    const seatsNeeded = reg + 0.5 * light;
    lab.classSize = isOpen ? avgClassSize(inp, stageKey, seatsNeeded) : 0;
    // 4실 직영: 주말반(토 90분 + 녹화)은 정규 학생의 weekendShare, 라이트 과정은 평일만. 토요일 반은 실마다 두 시간대
    const satSeats = isOpen && stageKey === 'v23' ? Math.min(reg * L.weekendShare, rooms * S.satSlotsPerRoom * lab.classSize) : 0;
    lab.satClasses = satSeats > 0 ? Math.ceil(satSeats / lab.classSize - 1e-9) : 0;
    lab.classes = isOpen ? Math.max(2, Math.ceil((seatsNeeded - satSeats) / lab.classSize - 1e-9)) + lab.satClasses : 0;
    if (isOpen && opts.labFill && stageKey === 'v23') { // [10-19 세 지표] 시간표의 반을 모두 열고(평일 16 + 토요일 8) 좌석의 labFill만 찬다(반 평균 약 12.8명)
      lab.satClasses = rooms * S.satSlotsPerRoom; lab.classes = rooms * (S.weekdaySlotsPerRoom + S.satSlotsPerRoom);
      lab.classSize = seatsNeeded / lab.classes;
    }
    lab.tuition = isOpen ? (reg * u.pReg + light * L.prices.light) * (1 - L.leakage) * sc.priceRealization * priceM : 0;
    const premiumCap = (L.premiumSeats && L.premiumSeats[stageKey]) || C.premiumClasses * 16; // 유호님 회화: 4실은 위성 세 묶음 48석, 그 밖은 회화 반 2개 32석
    lab.premium = isOpen ? Math.min((reg - satSeats) * L.premiumUptake, premiumCap) * L.prices.premiumAddon * (1 - L.leakage) * sc.priceRealization * priceM : 0; // 주말생에게 올액세스(회화 추가)는 안 판다
    lab.textbook = isOpen && L.textbook.enabled ? students * (L.textbook.booksPerYear / 12) * L.textbook.pricePerBook * priceM : 0;
    lab.topik = exOn(ex.topik) && ex.topik.months.includes(mo)
      ? (students * ex.topik.internalShare * ex.topik.internalPrice + ex.topik.external * sc.volume * ex.topik.externalPrice) * sc.priceRealization * priceM : 0;
    lab.eps = epsActive ? epsClasses * ex.eps.size * ex.eps.price * sc.priceRealization * priceM : 0;
    lab.camp = exOn(ex.camp) && ex.camp.months.includes(mo) ? ex.camp.participants * sc.volume * ex.camp.price * sc.priceRealization * priceM : 0;
    lab.danceExternal = exOn(ex.danceExternal) ? ex.danceExternal.participants * sc.volume * ex.danceExternal.price * sc.priceRealization * priceM : 0;
    lab.corporate = exOn(ex.corporate) ? ex.corporate.contracts * sc.volume * ex.corporate.price * sc.priceRealization * priceM : 0;
    lab.mockTest = exOn(ex.mockTest) && ex.mockTest.months.includes(mo) ? ex.mockTest.takers[scName] * ex.mockTest.price * sc.priceRealization * priceM : 0;
    lab.revenue = lab.tuition + lab.premium + lab.textbook + lab.topik + lab.eps + lab.camp + lab.danceExternal + lab.corporate + lab.mockTest;

    // ── LAB 비용(₮) — 몽골 인건비·임대료는 물가 계단을 곱한다
    const st = L.staff; const o = L.other;
    const opsCount = isOpen ? (stageKey === 'host' ? (rooms > 2 ? (st.ops.host3 ?? st.ops.host) : st.ops.host) : st.ops[stageKey]) : (m === lastPreOpen ? (hosted ? st.ops.host : 1) : 0); // [페이블 3차] SYNK반은 개원 전달에도 반일
    const v23s = stageKey === 'v23' ? st.v23 : null;
    const dirTeach = v23s ? v23s.directorTeachesClasses : st.directorTeachesClasses;
    const teacherClasses = Math.max(0, lab.classes - dirTeach);
    const wkdTeacherClasses = Math.max(0, teacherClasses - (lab.satClasses || 0));
    const directorPaid = isOpen || (m >= addMonths(L.openMonth, -st.preOpenTrainingMonths) && isPreOpen);
    const satelliteWages = isOpen ? (v23s ? v23s.dance + v23s.beauty + v23s.vocal : st.dance) : 0; // 4실: 댄스(전일+토)·뷰티·보컬
    lab.wages = ((directorPaid ? st.director : 0) + opsCount * st.ops.wage + satelliteWages + wkdTeacherClasses * st.hoursPerClass * st.teacherHourly + (lab.satClasses || 0) * (v23s ? v23s.satClassCost : 0)) * wageM;
    lab.socialIns = lab.wages * L.socialInsurance;
    lab.cleaning = isOpen ? st.cleaning[stageKey] * wageM : 0;
    const rentArea = (isOpen || isPreOpen) ? S.areaM2 : 0;
    const preArea = isDirectPre ? L.stages[directStage].areaM2 : 0;
    lab.rent = S.rentFixedMNT ? ((isOpen || isPreOpen) ? S.rentFixedMNT * rentM : 0) : (rentArea + preArea) * L.rentPerM2MNT * rentM; // 4실은 77평 고정 임대(공사 기간부터)
    lab.utilities = (rentArea * L.utilitiesPerM2MNT * (L.utilitiesSeason[mo] || 1) * (isPreOpen ? 0.5 : 1) + preArea * L.utilitiesPerM2MNT * 0.5) * rentInfl;
    lab.materials = isOpen ? o.materialsSW[stageKey] : 0;
    lab.marketing = isOpen ? o.marketing[stageKey] + adBudget : (isPreOpen ? o.preOpenMarketing : 0);
    if (o.adTest && m >= o.adTest.from && m <= o.adTest.to) lab.marketing += o.adTest.mnt; // 개원 전 광고 시험
    if (opts.adShift && L.opGate && m >= addMonths(L.openMonth, -L.opGate.leadMonthsBefore) && m <= L.openMonth) { // [10-19 관문 · 페이블 8차] 개원 달 광고비를 문의가 쌓이는 달(계절 몫)대로 앞당겨 쓴다
      const lw = leadWeights(L); const k = lw.months.indexOf(m);
      if (m < L.openMonth) lab.marketing += opts.adShift * lw.w[k] / lw.sum; else lab.marketing -= opts.adShift * (1 - lw.w[k] / lw.sum);
    }
    lab.cu = isOpen ? o.cuPerClass * lab.classes + o.cuBase : 0;
    lab.benefits = isOpen ? students * (o.topikFeeSupport / 12 + o.jacket / 24) : 0;
    lab.appAI = isOpen ? students * o.appAIperStudentKRW * fx.mntPerKrw : 0;
    lab.bookCost = isOpen && L.textbook.enabled ? students * (L.textbook.booksPerYear / 12) * L.textbook.costPerBook : 0;
    lab.extrasCost = (lab.topik ? ex.topik.teacherHours * st.teacherHourly * si * wageM + ex.topik.materialRate * lab.topik : 0)
      + (lab.eps ? epsClasses * st.hoursPerClass * st.teacherHourly * si * wageM : 0)
      + lab.camp * ex.camp.costRate
      + (lab.danceExternal ? ex.danceExternal.costMNT * sc.volume * wageM : 0)
      + (lab.corporate ? ex.corporate.costMNT * ex.corporate.contracts * sc.volume * wageM : 0)
      + lab.mockTest * (ex.mockTest?.costRate || 0);
    lab.adminFixed = isOpen ? o.accountingAudit[stageKey] + o.insurance[stageKey] : 0;
    lab.foreignLevy = isOpen && m >= st.foreignLevy.from ? st.foreignLevy.count * st.foreignLevy.mnt : 0;
    lab.adminFixed += lab.foreignLevy;
    lab.countryOverhead = (isOpen || isPreOpen) && L.countryOverheadMNT ? L.countryOverheadMNT * wageM : 0; // [10-19] 대표가 상주하지 않는 나라의 현지 책임자·출장·회계
    lab.paymentFee = lab.revenue * o.paymentFee;
    lab.reserve = lab.revenue * o.reserve;
    const HS = L.hosted;
    lab.hostRate = isOpen && stageKey === 'host' && !HS.fixedPerRoomMNT ? hostRateAt(HS, students) : 0; // 계단형 기관 몫의 그달 평균
    lab.hostFee = lab.hostRate * (lab.tuition + lab.premium);
    if (isOpen && stageKey === 'host' && HS.fixedPerRoomMNT) lab.hostFee = HS.fixedPerRoomMNT * rooms * rentInfl; // 고정 임대(교실당 월)
    if (isOpen && stageKey === 'host' && HS.floorPerRoomMNT) lab.hostFee = Math.max(lab.hostFee, HS.floorPerRoomMNT * rooms * rentInfl); // 최소 보장
    // 직영으로 옮긴 뒤 몇 달은 옮겨 간 학생 수강료의 일부를 기관에 준다(학생·강사·선수금을 붙잡지 않는 대가) [D안 업그레이드 2차 10-19]
    lab.hostTail = isOpen && hosted && directSwitch && m >= directSwitch && HS.exitTail && m < addMonths(directSwitch, HS.exitTail.months) ? HS.exitTail.rate * (lab.tuition + lab.premium) * Math.min(1, ((studentsAtSwitch || 0) * Math.pow(sc.labRetention, M.indexOf(m) - M.indexOf(directSwitch))) / Math.max(1, students)) : 0; // 옮겨 간 학생 가운데 남은 사람 몫만 [페이블 3차]
    const costBeforeInc = lab.wages + lab.socialIns + lab.cleaning + lab.rent + lab.utilities + lab.materials + lab.marketing + lab.cu + lab.benefits + lab.appAI + lab.bookCost + lab.extrasCost + lab.adminFixed + lab.countryOverhead + lab.paymentFee + lab.reserve + lab.hostFee + lab.hostTail;
    const op0 = lab.revenue - costBeforeInc;

    // ── 인센티브(₮): 기본 성과급·현장 보너스는 늘 나가고, 이익 나눔·창립 보너스는 이익의 25% 안에서
    const I = L.incentives;
    const kInfl = (L.inflation?.steps || []).filter((s) => m >= s).length;
    const bepNow = bepAt(stageKey, { ...multNow, hostRooms: stageKey === 'host' ? rooms : undefined }, kInfl); // 그달 물가로 다시 잰 손익분기 [아르곤 코드 검수 10-18]
    const ratio = isOpen ? students / bepNow : 0;
    const headcount = isOpen ? Math.ceil(Math.max(0, teacherClasses - (lab.satClasses || 0)) / 2) + opsCount + (v23s ? 3 : 1) : 0; // [페이블 4차] 토요일 반은 평일 강사가 겹쳐 맡는다
    let baseEach = 0; for (const b of I.baseBonus) if (ratio >= b.atBep) baseEach = b.each;
    const baseBonus = isOpen ? baseEach * headcount : 0;
    const fieldBonus = isOpen ? Math.max(I.fieldBonusMin, I.fieldBonusRate * lab.revenue) : 0;
    let rate = 0; for (const p of I.profitShare) if (ratio >= p.atBep) rate = p.rate;
    const profitAfterFixedBonus = op0 - (baseBonus + fieldBonus) * si;
    let pool = Math.max(0, profitAfterFixedBonus) * rate;
    let founding = 0;
    for (const f of I.foundingBonus) {
      if (isOpen && !foundingPaid[f.atBep] && ratio >= f.atBep) { founding += f.each * (headcount + 1); foundingPaid[f.atBep] = true; }
    }
    const capAmt = I.capOfProfit * Math.max(0, profitAfterFixedBonus);
    if (pool + founding > capAmt) { const k = capAmt / (pool + founding); pool *= k; founding *= k; }
    lab.incentives = (baseBonus + fieldBonus + pool + founding) * si;
    lab.incentiveDetail = { ratio, baseBonus, fieldBonus, pool, founding, rate, headcount, baseEach };
    // SYNK반 기간에는 기관이 강사를 고용하고 남는 몫을 한국 법인으로 보낸다 → 원천징수·환전 몫을 뺀다(남는 몫이 있을 때만)
    const remitBase = lab.revenue - costBeforeInc - lab.incentives;
    const remitRate = L.hosted.remitCostRate || 0;
    lab.remitCost = isOpen && stageKey === 'host' && !partnerMode && remitBase > 0 ? remitRate * remitBase : 0;
    lab.cost = costBeforeInc + lab.incentives + lab.remitCost;
    lab.profit = lab.revenue - lab.cost;

    // ── LAB 일회성(₮): 1단계 공사·보증금은 준비 첫 달, 2단계는 개방 두 달 전
    lab.capex = 0; lab.deposit = 0;
    const firstKey = hosted ? 'host' : (full4 ? 'v23' : (forceStage2 ? 's2' : 's1'));
    const depositBase = (key) => (L.stages[key].rentFixedMNT || L.stages[key].areaM2 * L.rentPerM2MNT) * rentM * L.stages[key].depositMonths;
    if (m === preOpenStart) { lab.capex += fullCapexMNT(firstKey); lab.deposit += depositBase(firstKey); } // B안은 1·2단계 공사비를 다 낸다 [아르곤 코드 검수]
    lab.capex += hostAddCapex * (opts.capexMult || 1);
    if (hosted && directPrepStart && m === directPrepStart) {
      lab.capex += fullCapexMNT(directStage);
      lab.deposit += L.stages[directStage].areaM2 * L.rentPerM2MNT * rentM * L.stages[directStage].depositMonths;
    }
    if (!forceStage2 && s2Start && m === addMonths(s2Start, -2)) { lab.capex += L.stages.s2.capexMNT * (opts.capexMult || 1); lab.deposit += (L.stages.s2.areaM2 - L.stages.s1.areaM2) * L.rentPerM2MNT * rentM * L.stages.s2.depositMonths; }

    // ── PATH — [10-19] 학생 1명당 경제로 센다
    const path_ = r.path;
    const ubLive = m >= P.startUB && isOpen;
    const pm = opts.pathMult ?? 1;
    // ① LAB 재원생: 그달 LAB을 마치는 학생(재원생 × (1 − 유지율)) 가운데 labToKorea가 PATH 입학 지원으로 한국에 간다
    let admLab = ubLive && m >= P.labConvFrom ? students * (1 - sc.labRetention) * P.labToKorea[scName] * pm : 0;
    // ② LAB 밖 몽골 학생: 그달 울란바토르에서 새로 한국 유학을 가는 사람(LAB에서 간 사람은 뺌) 가운데 extShare
    let admExt = ubLive ? Math.max(0, mk.ubNew / 12 - admLab) * step(P.extShare[scName], m) * pm : 0;
    if (opts.pathShare) { // [10-19 세 지표] 그 나라 한 해 새 한국 유학생의 pathShare(10%)를 PATH가 맡는다. LAB에서 가는 학생을 먼저 세고 나머지는 LAB 밖
      const total = ubLive ? (mk.countryNew / 12) * opts.pathShare * pm : 0;
      admLab = Math.min(admLab, total); admExt = total - admLab;
    }
    const plansExt = ubLive ? step(P.externalPlansPerMonth, m) * sc.volume : 0; // 유학 준비 계획(입구 상품). 계획에서 계약으로 가는 사람은 ②에 들어 있다
    admissionsHist.push(admLab + admExt);
    admValueHist.push((admLab * P.prices.admissionLab + admExt * P.prices.admissionExternal) * sc.priceRealization * priceM);
    path_.admissions = admLab + admExt; path_.admLab = admLab; path_.admExt = admExt;
    path_.planMNT = plansExt * P.prices.plan * sc.priceRealization * priceM;
    const singles = ubLive && P.singles && m >= P.singles.from ? P.singles.perMonth[scName] : 0; // 서류 점검·모의 면접 단품
    path_.singlesMNT = singles * (P.singles?.priceMNT || 0) * sc.priceRealization * priceM;
    // 입학 지원은 계약·합격·비자 세 번에 나눠 받는다. 비자가 안 나온 몫(10%)은 마지막 몫을 받지 않는다
    let admRev = 0;
    P.milestones.forEach((ms, k) => { const j = i - ms.lag; if (j >= 0) admRev += admValueHist[j] * ms.share * (k === P.milestones.length - 1 ? 1 - P.visaFailRate : 1); });
    path_.admissionMNT = admRev;
    const lagged = (i >= P.commissionLagMonths ? admissionsHist[i - P.commissionLagMonths] : 0) * (1 - P.visaFailRate); // 입학한 학생만
    const partnerShare = m >= sc.partnerUnivFrom ? sc.partnerUnivShare : 0;
    const commissionPer = (1 - P.transfer.d4Share) * P.prices.univCommissionKRW + P.transfer.d4Share * (P.prices.univCommissionD4KRW ?? P.prices.univCommissionKRW); // [페이블 4차] 학위(D-2)와 어학연수(D-4) 수수료를 나눠 섞는다
    path_.commissionKRW = lagged * partnerShare * commissionPer;
    path_.settlementKRW = lagged * P.settlementUptake * (P.prices.settlementKRW - P.prices.settlementCostKRW); // 제휴사 실비를 뺀 몫
    // ③ 어학연수(D-4)로 간 학생이 한국 안에서 대학(D-2)으로 옮길 때 진학 지원을 다시 산다
    const T = P.transfer;
    const tN = i >= T.lagMonths ? admissionsHist[i - T.lagMonths] * (1 - P.visaFailRate) * T.d4Share * T.uptake[scName] : 0;
    path_.transfers = tN;
    path_.transferKRW = tN * T.priceKRW * sc.priceRealization;
    // ④ 취업까지: 한국에 있는 몽골 유학생 가운데 그달 졸업·취업 준비(4주, 알선 아님)를 사는 사람
    const careerN = m >= P.startUB ? (mk.inKorea / 12) * step(P.careerUptake[scName], m) * pm : 0;
    path_.career = careerN;
    path_.careerKRW = careerN * P.prices.careerKRW * sc.priceRealization;
    // ⑤ 대상 국가 온라인 상담(WORLD로 들어온 학생)
    const onN = !CO && m >= P.online.from ? (mk.targetsNew / 12) * P.online.share[scName] * pm : 0; // 대상 국가 온라인은 몽골 판에서 한 번만
    path_.onlineN = onN;
    path_.onlineKRW = onN * P.online.priceKRW * sc.priceRealization;
    const univContracts = CO ? 0 : step(P.univMarketingContracts[scName], m);
    path_.univMarketingKRW = univContracts * P.prices.univMarketingKRW / 12;
    path_.campMNT = !CO && m >= P.camp.from && P.camp.months.includes(mo) ? P.camp.participants[scName] * P.prices.campMNT * P.prices.campMargin * priceM : 0; // 대행 몫만 매출로
    path_.travelKRW = !CO && m >= P.travelAffiliateKRW.from ? P.travelAffiliateKRW.v * sc.volume : 0;
    // 상담 담당: 일 시간(계약 25시간 · 진학 · 취업 준비 · 온라인 상담)을 월 monthHours(140시간)로 나눠 반일 단위로 늘린다. 세 명이 넘으면 여덟 명마다 팀장 한 명
    const CS = P.counselor;
    const csFrom = opts.pathShare && P.startUB < CS.halfFrom ? P.startUB : CS.halfFrom; // [페이블 5차] 세 지표는 상담을 여는 달부터 상담 담당
    const pathHoursTotal = path_.admissions * P.hoursPerAdmission + plansExt * (P.planHours ?? 3) + singles * (P.singles?.hours || 0) + tN * T.hours + careerN * P.careerHours + onN * P.online.hours;
    const pathFte = m >= csFrom && pathHoursTotal > 0 ? Math.max(0.5, Math.ceil((pathHoursTotal / CS.monthHours) * 2 - 1e-9) / 2) : 0;
    const pathLeads = pathFte > CS.leadAtFte ? Math.max(1, Math.ceil(pathFte / (CS.leadSpan || Infinity))) : 0; // [페이블 4차] 세 명이 넘을 때 · [10-19] 여덟 명마다 한 명
    const pathLead = pathLeads > 0;
    const counselorWage = (pathFte * CS.full + pathLeads * CS.leadExtra) * wageM;
    path_.fte = pathFte; path_.lead = pathLeads; path_.hours = pathHoursTotal;
    path_.costMNT = counselorWage * si + path_.admissionMNT * P.successShare * si + pathFte * CS.perFteMNT * rentInfl + admExt * P.extCacMNT;
    const hasMnCorp = !partnerMode && (hosted ? !!directPrepStart && m >= directPrepStart : m >= preOpenStart); // 몽골 법인이 있는 달
    const pathMnRev0 = path_.planMNT + path_.admissionMNT + path_.campMNT + path_.singlesMNT;
    path_.hostFeeMNT = !hasMnCorp && (partnerMode || stageKey === 'host') ? (L.hosted.pathShare || 0) * pathMnRev0 : 0; // 기관 명의로 받고 상담 담당도 기관이 고용 [페이블 10-18]
    path_.costMNT += path_.hostFeeMNT;
    const pathMnProfit0 = pathMnRev0 - path_.costMNT;
    path_.remitMNT = !hasMnCorp && pathMnProfit0 > 0 ? remitRate * pathMnProfit0 : 0; // [아르곤 코드 검수 10-18]
    path_.costMNT += path_.remitMNT;
    path_.costKRW = path_.univMarketingKRW * P.univMarketingCostRate + (!CO && m >= P.koreaTripsFrom && [3, 9].includes(mo) ? P.koreaTripKRW * (P.koreaTripsPerYear / 2) : 0);
    path_.revenueKRW = toKRW(path_.planMNT + path_.admissionMNT + path_.campMNT + path_.singlesMNT) + path_.commissionKRW + path_.settlementKRW + path_.careerKRW + path_.transferKRW + path_.onlineKRW + path_.univMarketingKRW + path_.travelKRW;
    path_.profitKRW = path_.revenueKRW - toKRW(path_.costMNT) - path_.costKRW;

    // ── LAB 온라인(한국 법인): TOPIK 4급 온라인 반 · 교재 라이선스
    // [10-19 유호님 「synk world는 lab에서 빼고 pulse에 추가해줘」] WORLD(앱 구독·학원 좌석·몽골 기업 좌석)는 r.pulse의 world*로 센다
    const on = r.online; const pw = r.pulse;
    const t4 = ON.topik4Cohort;
    const cohortStart = m >= t4.from && ((i - M.indexOf(t4.from)) % t4.everyMonths === 0);
    on.topik4 = cohortStart ? t4.size[scName] * t4.price * sc.priceRealization / (t4.vatIncluded ? 1.1 : 1) : 0;
    on.topik4Cost = cohortStart && m >= t4.teacherCostFrom && t4.size[scName] > 0 ? t4.teacherCost : 0; // 학생이 없으면 강사도 없다 [페이블 2차]
    const kB2C = m >= ON.worldB2C.paidFrom ? (M.indexOf(m) - M.indexOf(ON.worldB2C.paidFrom) + 1) : 0;
    const w12 = ON.worldB2C.m12[sc.worldScale]; const w36 = ON.worldB2C.m36[sc.worldScale];
    pw.worldB2C = kB2C <= 0 ? 0 : (kB2C <= 12 ? w12 * kB2C / 12 : (kB2C <= 36 ? w12 + (w36 - w12) * (kB2C - 12) / 24 : w36));
    pw.worldB2CCost = pw.worldB2C * ON.worldB2C.costRate;
    pw.worldPaid = 0;
    if (inp.world && opts.plan && !CO) { // [10-19 세 지표] 전 세계 한국어 학습자 × 닿는 비율 × 유료 비율 × 1명 순매출(진출한 나라는 개원 뒤 현장 마케팅으로 더 닿는다)
      const W = inp.world;
      const kyP = m >= W.paidFrom ? Math.floor((M.indexOf(m) - M.indexOf(W.paidFrom)) / 12) : -1; // 유료를 연 뒤 몇 해째(0부터)
      if (kyP >= 0) {
        const gY = Math.pow(1 + W.growth, Math.max(0, yearOf(m) - W.baseYear));
        const stepK = (list, k) => { let v = 0; for (const x of list) if (k >= x.from) v = x.v; return v; };
        let rev = 0; let paid = 0; let listedLearners = 0;
        for (const [c, C1] of Object.entries(W.countries)) { // [페이블 5차] 따로 센 나라는 그 지표에서 진출했으면 개원 뒤 더 닿고 아니면 온라인만, 1명 순매출은 나라 값
          listedLearners += C1.learners;
          const openC = opts.plan.countries.includes(c) ? inp.countries[c]?.open : null;
          const kc = openC && m >= openC ? Math.floor((M.indexOf(m) - M.indexOf(openC)) / 12) : -1;
          const reach = kc >= 0 ? stepK(W.reachActive, kc) * (C1.reachScale ?? 1) : stepK(W.reachOnline, kyP); // 진출 나라 배수(베트남·우즈베키스탄 0.5)
          const pc = C1.learners * gY * reach * W.paidRate; paid += pc; rev += pc * C1.netKRW;
        }
        const restPaid = Math.max(0, W.globalLearners - listedLearners) * gY * stepK(W.reachOnline, kyP) * W.paidRate;
        paid += restPaid; rev += restPaid * W.netKRWGlobal;
        pw.worldPaid = paid;
        pw.worldB2C = rev * sc.priceRealization;
        pw.worldB2CCost = pw.worldB2C * W.costRate;
      } else { pw.worldB2C = 0; pw.worldB2CCost = 0; }
    }
    const acad = step(ON.worldSeats.academies[scName], m);
    pw.worldSeats = acad * ON.worldSeats.seatsPer * ON.worldSeats.usdPerSeat * fx.krwPerUsd;
    pw.worldSeatsCost = pw.worldSeats * ON.worldSeats.costRate;
    on.textbookLicense = m >= ON.textbookLicense.from ? toKRW(ON.textbookLicense.academies[scName] * ON.textbookLicense.studentsPer * ON.textbookLicense.mntPerStudent) : 0;
    const wc = ON.worldCorporateMN; // 몽골 접객 기업 직원 좌석
    pw.worldCorporate = wc ? toKRW(step(wc.companies[scName], m) * wc.seats * wc.mntPerSeat) : 0;
    pw.worldCorporateCost = wc ? pw.worldCorporate * wc.costRate : 0;
    pw.world = pw.worldB2C + pw.worldSeats + pw.worldCorporate;
    pw.worldCost = pw.worldB2CCost + pw.worldSeatsCost + pw.worldCorporateCost;
    if (CO) { pw.worldB2C = 0; pw.worldB2CCost = 0; pw.worldSeats = 0; pw.worldSeatsCost = 0; pw.worldCorporate = 0; pw.worldCorporateCost = 0; pw.world = 0; pw.worldCost = 0; }
    on.revenue = on.topik4 + on.textbookLicense;
    on.cost = on.topik4Cost;
    on.profit = on.revenue - on.cost;
    if (CO) { on.topik4 = 0; on.topik4Cost = 0; on.textbookLicense = 0; on.revenue = 0; on.cost = 0; on.profit = 0; }

    // ── 대표 시간 ①: 먼저 고정으로 드는 시간(경영·WORLD·온라인 반·PATH·LAB)
    const h = r.hours;
    h.mgmt = C.founderBaseHours.mgmt + (C.oneOffHours || []).filter((x) => x.month === m).reduce((a, x) => a + x.hours, 0);
    h.world = m >= C.founderBaseHours.worldSwitch ? C.founderBaseHours.worldDevAfter : C.founderBaseHours.worldDevBefore;
    h.marketing = m >= C.founderBaseHours.worldSwitch ? C.founderBaseHours.marketingAfter : C.founderBaseHours.marketingBefore; // 몽골어 콘텐츠
    h.online = cohortStart || (m >= t4.from && (i - M.indexOf(t4.from)) % t4.everyMonths === 1) ? (m >= t4.teacherCostFrom ? 2 : t4.founderHours / 2) : 0;
    // 상담 담당이 있으면 대표는 점검·어려운 건만(팀장이 있으면 더 적게), 없으면 일의 절반을 대표가 한다
    h.path = (pathFte ? (pathLead ? CS.founderHoursWithLead : CS.founderHoursBase + CS.founderHoursRate * pathHoursTotal) : 0.5 * pathHoursTotal) + univContracts * (P.univMarketingFounderHours ?? 10) + (m >= P.koreaTripsFrom && [3, 9].includes(mo) ? 30 : 0);
    h.lab = isPreOpen ? 80 : (isOpen ? C.premiumClasses * C.premiumTeachingHoursPerClass + 30 : (C.labPrepEarly && m >= C.labPrepEarly.from && m < preOpenStart ? C.labPrepEarly.hours : 0));
    if (partnerMode) h.lab = isOpen ? 10 : (isPreOpen ? 30 : 0); // [페이블 3차] C안이면 대표는 회화를 가르치지 않고 운영 점검만
    const fixedHours = h.mgmt + h.world + h.marketing + h.online + h.path + h.lab;

    // ── PULSE·SHIFT 수요(대표 시간을 따지기 전). 정기 고객(광고 정기·몽골 콘텐츠·SHIFT 운영)은 「이미 맡은 일」, 나머지는 「새 일」
    // 계획한 고객·주문 수 × subVolume(보수 25% · 기본 50% · 상방 100%). AI바우처만 가정별 건수를 따로 둔다
    const entryOrders0 = m >= PU.entry.from ? step(PU.entry.orders, m) * subV : 0;
    const adClients0 = m >= PU.adRetainer.from ? step(PU.adRetainer.clients, m) * subV : 0;
    const projects0 = m >= PU.projects.from ? (step(PU.projects.perQuarter, m) / 3) * subV : 0;
    const mnClients0 = m >= PU.mongoliaContent.from ? step(PU.mongoliaContent.clients, m) * subV : 0;
    const entryS0 = m >= SH.entry.from ? step(SH.entry.orders, m) * subV : 0;
    const interval = step(SH.deploy.everyMonths, m, null);
    const deploys0 = m >= SH.deploy.firstMonth && interval ? subV / interval : 0;
    const vPerYear = CO ? 0 : (SH.voucher.perYear[scName][yearOf(m)] || 0);
    const vCount0 = m >= inp.company.krCorpFrom && mo >= 5 && mo <= 11 ? vPerYear / 7 : 0; // 바우처 과제는 5~11월
    const digitalOn = m >= SH.digital.from;
    const digitalSales = digitalOn && !CO ? (typeof SH.digital.sales === 'object' ? SH.digital.sales[scName] : SH.digital.sales * subV) : 0;
    const committedPu = adClients0 * PU.adRetainer.hours + mnClients0 * PU.mongoliaContent.hours;
    const newPu = entryOrders0 * PU.entry.hours + projects0 * PU.projects.hours;
    const committedSh = shiftActive * SH.deploy.hoursRun + (digitalOn ? SH.digital.hours : 0);
    const newSh = entryS0 * SH.entry.hours + deploys0 * SH.deploy.hoursDeploy + vCount0 * SH.voucher.hours;
    const demandKRW = entryOrders0 * PU.entry.avgPrice + adClients0 * (PU.adRetainer.monthly + PU.exclusive.attach * PU.exclusive.monthly) + projects0 * PU.projects.avgPrice + toKRW(mnClients0 * PU.mongoliaContent.monthlyMNT)
      + entryS0 * SH.entry.avgPrice + deploys0 * SH.deploy.fee + shiftActive * SH.deploy.monthly + vCount0 * SH.voucher.fee + digitalSales * SH.digital.price;

    // 한국 담당자: 계획한 달이 있으면 그 달부터, 없으면 PULSE·SHIFT 수요가 기준을 석 달 넘긴 다음 달부터
    const plannedLead = CO ? null : (opts.leadPlanned !== undefined ? opts.leadPlanned : (C.krLead.planned || {})[scName]);
    if (!leadFrom && plannedLead) leadFrom = plannedLead;
    if (!leadFrom) {
      if (demandKRW >= C.krLead.triggerKRW) leadRun += 1; else leadRun = 0;
      if (leadRun >= C.krLead.months) { const cand = addMonths(m, 1); leadFrom = cand > C.krLead.earliest ? cand : C.krLead.earliest; }
    }
    const leadOn = !!leadFrom && m >= leadFrom;
    const leadCap = leadOn ? C.krLead.capacityHours : 0;

    // 대표(와 담당자)만 할 수 있는 몫이 남은 시간을 넘으면, 이미 맡은 일을 먼저 하고 새 일을 그만큼 덜 받는다
    const availF = Math.max(0, C.founderHoursCap - fixedHours);
    const nonDelegCap = availF + leadCap * C.krLead.founderLikeShare;
    const needCommit = committedPu * PU.founderShare + committedSh * SH.founderShare;
    const needNew = newPu * PU.founderShare + newSh * SH.founderShare;
    const kC = needCommit > 0 ? Math.min(1, nonDelegCap / needCommit) : 1;
    const kN = needNew > 0 ? Math.max(0, Math.min(1, (nonDelegCap - needCommit * kC) / needNew)) : 1;

    // ── PULSE (한국 법인, ₩)
    const pu = r.pulse;
    const entryOrders = entryOrders0 * kN; const projects = projects0 * kN;
    const adClients = adClients0 * kC; const mnClients = mnClients0 * kC;
    pu.entry = entryOrders * PU.entry.avgPrice * sc.priceRealization;
    pu.retainer = adClients * PU.adRetainer.monthly * sc.priceRealization;
    pu.exclusive = adClients * PU.exclusive.attach * PU.exclusive.monthly * sc.priceRealization;
    pu.projects = projects * PU.projects.avgPrice * sc.priceRealization;
    pu.mongolia = toKRW(mnClients * PU.mongoliaContent.monthlyMNT) * sc.priceRealization;
    pu.ads = pu.entry + pu.retainer + pu.exclusive + pu.projects + pu.mongolia; // 광고 영상 사업만(한국 담당자 채용 점검은 이것으로)
    pu.revenue = pu.ads + pu.world; // WORLD는 위 온라인 칸에서 셈
    pu.direct = pu.entry * (PU.entry.platformFee + PU.entry.directRate) + pu.retainer * PU.adRetainer.directRate + pu.projects * PU.projects.directRate + pu.mongolia * PU.mongoliaContent.directRate;
    const puHours = committedPu * kC + newPu * kN;

    // ── SHIFT (한국 법인, ₩)
    const sh = r.shift;
    const entryS = entryS0 * kN; const deploys = deploys0 * kN; const vCount = vCount0 * kN;
    sh.runFee = shiftActive * kC * SH.deploy.monthly * sc.priceRealization; // 이번 달까지 쌓인 운영 고객
    sh.entry = entryS * SH.entry.avgPrice * sc.priceRealization;
    sh.deployFee = deploys * SH.deploy.fee * sc.priceRealization;
    sh.voucher = vCount * SH.voucher.fee;
    sh.digital = digitalSales * kC * SH.digital.price * sc.priceRealization / (SH.digital.vatIncluded ? 1.1 : 1); // [아르곤·페이블 10-18]
    sh.revenue = sh.entry + sh.deployFee + sh.runFee + sh.voucher + sh.digital;
    sh.direct = sh.entry * SH.entry.directRate + (sh.deployFee + sh.runFee) * SH.deploy.directRate + sh.voucher * SH.voucher.directRate + sh.digital * SH.digital.platformFee;
    sh.activeClients = shiftActive;
    shiftActive = shiftActive * (1 - SH.deploy.annualChurn / 12) + deploys; // 다음 달부터 운영료
    const shHours = committedSh * kC + newSh * kN;

    // ── 맡길 수 있는 시간은 사람에게: 담당자 → 울란바토르 제작팀(10월부터) 또는 한국 프리랜서
    const nonDelegUsed = needCommit * kC + needNew * kN;
    const leadNonDeleg = Math.max(0, nonDelegUsed - availF);
    const delegHours = puHours * (1 - PU.founderShare) + shHours * (1 - SH.founderShare);
    const leadDelegCap = Math.max(0, leadCap - leadNonDeleg);
    const paidHours = Math.max(0, delegHours - leadDelegCap);
    const ubProd = Array.isArray(C.ubTeam.productivity) ? step(C.ubTeam.productivity, m, C.ubTeam.productivity[0].v) : C.ubTeam.productivity; // 손이 익을수록 같은 일에 드는 시간이 준다
    const hourRate = m >= C.ubTeam.from ? toKRW(C.ubTeam.hourlyMNT * wageM * si / ubProd) : C.krFreelanceHourlyKRW;
    const production = paidHours * hourRate;
    const leadCost = leadOn ? C.krLead.costKRW : 0;
    const puShare = puHours + shHours > 0 ? puHours / (puHours + shHours) : 0.5;
    pu.people = (production + leadCost) * puShare; sh.people = (production + leadCost) * (1 - puShare);
    if (CO) { pu.people = 0; sh.people = 0; } // [10-19] 몽골 밖 나라 판에는 PULSE·SHIFT 제작 인력·한국 담당자 몫이 없다(몽골 판에서 셈)
    pu.cost = pu.direct + pu.people + pu.worldCost; pu.profit = pu.revenue - pu.cost;
    sh.cost = sh.direct + sh.people; sh.profit = sh.revenue - sh.cost;
    r.capacity = { kCommitted: kC, kNew: kN, availF, paidHours, hourRate, leadOn, demandKRW };

    // ── 회사 공통(₩)
    const co = r.company;
    co.accounting = m >= C.krCorpFrom ? C.accountingKRW : 0;
    co.tools = C.toolsKRW; co.infra = C.infraKRW;
    co.oneOff = C.oneOff.filter((x) => x.month === m && !(x.move && (gateFail || opts.noMove))).reduce((a, x) => a + x.krw, 0); // 관문에 걸리면 한국에 남는다(이주비 없음) [페이블 3차]
    const payPlan = step(C.founderPayKRW, m);
    co.founderPay = (stopped || opts.freezePay) ? Math.min(payPlan, C.founderPayKRW[0].v) : payPlan; // 동결은 첫 생활비(150만원)에서 멈추는 것이지 앞당기는 것이 아니다 // 멈춤 규칙이 걸리면 생활비 인상을 멈춘다
    co.textbookWriting = (C.textbookFinishing && m === C.textbookFinishing.month ? C.textbookFinishing.krw : 0) // 교재 원어민 검수·편집 마무리
      + (C.mnReviewer && m >= C.mnReviewer.from && m <= C.mnReviewer.to ? C.mnReviewer.krw : 0); // 몽골어 감수 프리랜서(교재·앱·SNS)
    // 대표 고정 일(경영·WORLD·콘텐츠·회화·LAB·PATH)이 상한을 넘는 몫은 사람에게 맡기고 그 값을 낸다(원칙 5) [페이블 10-18]
    h.fixedOver = Math.max(0, fixedHours - C.founderHoursCap);
    co.overflow = h.fixedOver * hourRate;
    co.cost = co.accounting + co.tools + co.infra + co.founderPay + co.textbookWriting + co.overflow; // 일회성은 현금에서만 뺀다
    co.krFixed = co.cost + leadCost; // 한국 법인이 매달 꼭 내는 돈(넓힐 때 석 달 치를 남긴다)
    if (CO) { co.accounting = 0; co.tools = 0; co.infra = 0; co.founderPay = 0; co.textbookWriting = 0; co.overflow = 0; co.oneOff = 0; co.cost = 0; co.krFixed = 0; }

    // ── 대표 시간 ②: 최종
    h.pulse = Math.min(availF, nonDelegUsed) * (needCommit + needNew > 0 ? (committedPu * kC * PU.founderShare + newPu * kN * PU.founderShare) / (nonDelegUsed || 1) : 0);
    h.shift = Math.min(availF, nonDelegUsed) - h.pulse;
    h.total = fixedHours - h.fixedOver + h.pulse + h.shift; // 넘친 고정 일은 맡겼으므로 대표 시간에서 뺀다

    // ── 합치기(₩)
    let labRevKRW = toKRW(lab.revenue); let labCostKRW = toKRW(lab.cost);
    let labCapexKRW = toKRW(lab.capex + lab.deposit);
    let royaltyKRW = 0;
    if (partnerMode) { // C안: 교실 손익은 파트너 몫, SYNK는 수강료의 사용료와 교재·앱 공급 몫만
      royaltyKRW = toKRW((lab.tuition + lab.premium) * (opts.royaltyRate || (stopR && stopR.royaltyRate) || 0.1) + (lab.textbook - lab.bookCost));
      labRevKRW = royaltyKRW; labCostKRW = 0; labCapexKRW = 0;
    }
    const pathCostKRW = toKRW(path_.costMNT) + path_.costKRW;
    r.revenueKRW = labRevKRW + path_.revenueKRW + on.revenue + pu.revenue + sh.revenue;
    r.costKRW = labCostKRW + pathCostKRW + on.cost + pu.cost + sh.cost + co.cost;
    const fixedPass = co.founderPay + (partnerMode ? 0 : toKRW(lab.hostFee + lab.remitCost)) + toKRW(path_.remitMNT + path_.hostFeeMNT); // 정해진 돈
    co.contingency = C.contingencyRate * Math.max(0, r.costKRW - fixedPass); // 예비비 [아르곤 코드 검수 10-18]
    r.costKRW += co.contingency;
    r.ebitdaKRW = r.revenueKRW - r.costKRW;
    // 한국 법인 이익(연말 법인세 계산용): 온라인·PULSE·SHIFT·PATH 한국 몫 − 한국 공통비
    const krProfit = on.profit + pu.profit + sh.profit + path_.commissionKRW + path_.settlementKRW + path_.careerKRW + path_.transferKRW + path_.onlineKRW + path_.univMarketingKRW + path_.travelKRW - path_.costKRW - (co.accounting + co.tools + co.infra + co.textbookWriting) - co.oneOff;
    yearKrProfit[yearOf(m)] = (yearKrProfit[yearOf(m)] || 0) + krProfit;

    // ── 몽골 세금(연말 정산): 연 매출 3억₮ 이하 1%, 넘으면 이익의 10%
    // 몽골 법인세는 몽골 법인이 있는 달만 센다. SYNK반·C안 동안의 교실·PATH 몽골 몫에는 원천징수·환전(remit)이 이미 붙었다
    const mnRev = hasMnCorp ? lab.revenue + path_.planMNT + path_.admissionMNT + path_.campMNT + path_.singlesMNT : 0;
    const mnProfit = hasMnCorp ? lab.profit + path_.planMNT + path_.admissionMNT + path_.campMNT + path_.singlesMNT - path_.costMNT : 0;
    yearMnRev[yearOf(m)] = (yearMnRev[yearOf(m)] || 0) + mnRev;
    yearMnProfit[yearOf(m)] = (yearMnProfit[yearOf(m)] || 0) + mnProfit;
    let taxMNT = 0;
    // 연 매출 3억₮ 이하는 매출의 1%, 그 위는 이익의 10%이고, 연 매출 15억₮ 이하는 그 세액의 90%를 공제(2026 세법)
    if (mo === 12) { const yr = yearOf(m); const rev = yearMnRev[yr]; taxMNT = inp.tax && inp.tax.regime === 'flat' ? (inp.tax.byYear && inp.tax.byYear[yr] != null ? inp.tax.byYear[yr] : inp.tax.rate) * Math.max(0, yearMnProfit[yr]) : (rev <= 300_000_000 ? 0.01 * rev : 0.1 * Math.max(0, yearMnProfit[yr]) * (rev <= 1_500_000_000 ? 0.1 : 1)); } // 나라 판은 그 나라 법인세(inp.tax)
    if (opts.vatOnTuition && !partnerMode) taxMNT += (lab.tuition + lab.premium) * (0.1 / 1.1);
    const krTaxKRW = !CO && mo === 12 ? 0.1 * Math.max(0, yearKrProfit[yearOf(m)] || 0) * (1 - C.krTaxRelief) : 0;

    // ── 현금
    // 기간권 선수금: 직영일 때만 SYNK 통장에 쌓인다(SYNK반·파트너는 그 기관이 받고 달마다 정산).
    // 직영으로 옮긴 뒤에는 기간권이 갱신되는 대로 석 달에 걸쳐 쌓인다고 본다
    const deferredTarget = partnerMode || stageKey === 'host' || !isOpen ? 0 : toKRW((lab.tuition + lab.premium) * u.avgPrepaid);
    const deferred = deferredTarget <= deferredPrev ? deferredTarget : Math.min(deferredTarget, deferredPrev + deferredTarget / 3);
    const dDeferred = deferred - deferredPrev; deferredPrev = deferred;
    // 정부 사업화 자금: 지원금 70% + 현금 자부담 10%를 사업비로 쓴다(현물 20%는 현금 아님).
    // 지원금은 전용 통장(grantBal)에 들어와 건별로 나가고, 가용 현금에는 들어가지 않는다.
    // 사업비 가운데 substituteShare만큼은 원래 계획에 있던 비용(한국 담당자 인건비·도구비)을 대신 내고, 나머지는 개발·마케팅을 앞당기는 새 지출이다
    const grantTotal = CO ? 0 : (sc.grantKRW || 0);
    const gIn = grantTotal && m === addMonths(F.grant.contractMonth, 1) ? grantTotal * 0.7 : (grantTotal && m === addMonths(F.grant.spendFrom, Math.floor(F.grant.spendMonths / 2)) ? grantTotal * 0.3 : 0);
    const inSpend = grantTotal && m >= F.grant.spendFrom && m < addMonths(F.grant.spendFrom, F.grant.spendMonths);
    const gFromGrant = inSpend ? grantTotal / F.grant.spendMonths : 0;
    const gSelfCash = inSpend ? (grantTotal / (1 - F.grant.selfShare)) * 0.1 / F.grant.spendMonths : 0;
    const gSpend = gFromGrant + gSelfCash;
    const gSub = inSpend ? Math.min(leadCost + co.tools, gSpend * (F.grant.substituteShare || 0)) : 0; // 이미 영업이익에 들어 있는 비용을 대신 낸 몫
    grantBal = Math.max(0, grantBal + gIn - gFromGrant);
    const modoo = !CO && m === F.modooActivityKRW.month ? F.modooActivityKRW.krw : 0;
    const extraFund = CO ? 0 : (opts.extraFunding || []).filter((x) => x.month === m).reduce((a, x) => a + x.krw, 0) + (sc.modooR2KRW && m === '2027-03' ? sc.modooR2KRW : 0);
    const flow = r.ebitdaKRW + dDeferred + gIn - (gSpend - gSub) + modoo + extraFund - labCapexKRW - co.oneOff - toKRW(taxMNT) - krTaxKRW;
    cash += flow;
    krFixedPrev = co.krFixed;
    // 멈춤 규칙 점검: 개원 석 달 뒤부터, 교실이 적자인데 가용 현금이 그룹 고정비(한국 + LAB) 두 달 치 아래인 달이 이어지면 다음 달부터 C안으로
    if (stopR && isOpen && !partnerMode && m >= addMonths(L.openMonth, stopR.graceMonths || 0)) {
      const stageFixedNow = labStageFixed(inp, stageKey, opts, { ...multNow, hostRooms: stageKey === 'host' ? rooms : undefined }).fixed;
      const fixedNow = co.krFixed + toKRW(stageFixedNow);
      const lossLine = -(stopR.lossTolerance || 0) * stageFixedNow; // 몇만원짜리 적자는 세지 않는다
      if (cash - grantBal < stopR.fixedMonths * fixedNow && lab.profit < lossLine) stopRun += 1; else stopRun = 0;
      if (stopRun >= stopR.months) stopFrom = addMonths(m, 1);
    }
    r.cash = { deferred, dDeferred, grantIn: gIn, grantSpend: gSpend, grantSub: gSub, grantBal, modoo, extraFund, capex: labCapexKRW, oneOff: co.oneOff, taxKRW: toKRW(taxMNT) + krTaxKRW, flow, balance: cash, free: cash - grantBal };
    r.labKRW = { revenue: labRevKRW, cost: labCostKRW, profit: labRevKRW - labCostKRW, royalty: royaltyKRW };
    r.pathKRW = { revenue: path_.revenueKRW, cost: pathCostKRW, profit: path_.revenueKRW - pathCostKRW };
    rows.push(r);
  }

  // 몽골 출자 요건 점검: 직영 교실을 준비하는 첫 달 전에, 가용 현금이 「출자 10만 달러 초과 + 한국 고정비 석 달 + 여유」를 채우나
  // (출자금은 몽골 법인 통장으로 옮겨 공사·운영에 쓰는 돈이라 그룹 현금에서 바로 빠지지는 않는다. 다만 한국 법인 통장은 그만큼 비므로 한국 쪽 버틸 돈을 따로 남긴다)
  const fdiMonth = partnerOpt ? null : (hosted ? directPrepStart : preOpenStart);
  const fIdx = fdiMonth ? M.indexOf(fdiMonth) : -1;
  const prevRow = fIdx > 0 ? rows[fIdx - 1] : null;
  const cashBefore = prevRow ? prevRow.cash.free : F.ownCashKRW;
  const firstDirect = full4 ? 'v23' : (forceStage2 ? 's2' : 's1');
  const needAt = hosted && directNeedAt ? directNeedAt : Math.max(fdiKRW, (partnerOpt ? 0 : directCapexKRW(firstDirect, 1) + toKRW(3 * labStageFixed(inp, firstDirect, opts).fixed))) + buf.krMonths * Math.max(prevRow ? prevRow.company.krFixed : 0, fIdx >= 0 ? rows[fIdx].company.krFixed : 0) + buf.safetyKRW;
  let fdi;
  if (partnerOpt) fdi = { needKRW: 0, fdiKRW: 0, cashBefore: null, gap: 0, month: null, moved: null };
  else if (hosted && !directPrepStart) fdi = { needKRW: fdiKRW + buf.safetyKRW, fdiKRW, cashBefore: null, gap: null, month: null, moved: false }; // 기간 안에 직영으로 못 옮김
  else fdi = { needKRW: needAt, fdiKRW, cashBefore, gap: Math.max(0, needAt - cashBefore), month: fdiMonth, moved: hosted ? directSwitch : null };
  if (stopFrom) fdi.stopFrom = stopFrom;
  if (gateFail) fdi.gate = true;
  if (fdi && hosted && directPrepStart) fdi.directStage = directStage;
  return { scName, sc, rows, bep1, bep2, bepHost, s2Start, leadFrom, fdi, directSwitch, hostAddFrom: hostAddMonths[0] || null, hostAddMonths, stopFrom, directStage, v23AddMonths, inp, fill: !!opts.pathShare };
}

// ───────── 요약 ─────────
function summarize(res) {
  const years = [...new Set(res.rows.map((r) => yearOf(r.m)))]; // [10-19] 세 지표 판은 2030까지
  const by = {};
  for (const y of years) {
    const rs = res.rows.filter((r) => yearOf(r.m) === y);
    const sum = (f) => rs.reduce((a, r) => a + f(r), 0);
    by[y] = {
      revenue: sum((r) => r.revenueKRW), ebitda: sum((r) => r.ebitdaKRW),
      lab: { revenue: sum((r) => r.labKRW.revenue), profit: sum((r) => r.labKRW.profit) },
      path: { revenue: sum((r) => r.pathKRW.revenue), profit: sum((r) => r.pathKRW.profit), admissions: sum((r) => r.path.admissions) },
      online: { revenue: sum((r) => r.online.revenue), profit: sum((r) => r.online.profit) },
      pulse: { revenue: sum((r) => r.pulse.revenue), profit: sum((r) => r.pulse.profit) },
      pulseAds: { revenue: sum((r) => r.pulse.ads), profit: sum((r) => r.pulse.ads - r.pulse.direct - r.pulse.people) }, // [페이블 4차] 광고 제작만
      world: { revenue: sum((r) => r.pulse.world), profit: sum((r) => r.pulse.world - r.pulse.worldCost) }, // WORLD 앱만
      shift: { revenue: sum((r) => r.shift.revenue), profit: sum((r) => r.shift.profit) },
      company: { cost: sum((r) => r.company.cost) },
      endStudents: rs.length ? rs[rs.length - 1].lab.students : 0,
      endCash: rs.length ? rs[rs.length - 1].cash.free : 0,
      peakHours: Math.max(...rs.map((r) => r.hours.total)),
      overHoursMonths: rs.filter((r) => r.hours.total > base.company.founderHoursCap).length,
    };
  }
  // 가장 낮은 현금은 「가용 현금」(지원금 전용 통장을 뺀 돈)으로 본다
  let minCash = Infinity; let minCashMonth = null;
  for (const r of res.rows) if (r.cash.free < minCash) { minCash = r.cash.free; minCashMonth = r.m; }
  // 흑자로 돌아선 뒤 다시 적자로 떨어지지 않는 첫 달
  let firstPositive = null;
  for (let i = 0; i < res.rows.length; i += 1) {
    if (res.rows.slice(i).every((r) => r.ebitdaKRW > 0)) { firstPositive = res.rows[i].m; break; }
  }
  let labFirstProfit = null;
  for (const r of res.rows) if (r.lab.stage && r.lab.stage !== 'pre' && !r.labKRW.royalty && r.labKRW.profit > 0) { labFirstProfit = r.m; break; }
  return { years: by, minCash, minCashMonth, firstPositive, labFirstProfit };
}

// 학생 1명당 경제(₩) [10-19 유호님 「PATH를 학생 1명당 경제로」]
// LAB은 그 가정 y년 계산의 학생 1명·달 평균(4실 운영, 물가 계단 반영)에 평균 재원 개월을 곱한다.
// PATH는 계약 1건이 끝까지 가져오는 돈: 입학 지원(세 번 나눠 받음, 비자 실패 몫 뺌) + 협약 대학 수수료 + 정착 + 어학연수생의 대학 진학 지원(y년 물가)
function unitEconomics(inp, scName, res, y = 2029) {
  const sc = inp.scenarios[scName]; const L = inp.lab; const P = inp.path; const fx = inp.fx.mntPerKrw;
  const rs = res.rows.filter((r) => yearOf(r.m) === y && r.lab.students > 0 && !r.labKRW.royalty);
  const sMonths = rs.reduce((a, r) => a + r.lab.students, 0);
  const newSum = rs.reduce((a, r) => a + (r.lab.newStudents || 0), 0);
  const tenure = newSum > 0 ? sMonths / newSum : 1 / (1 - sc.labRetention); // [페이블 4차] 그해 실제 재원 개월(여름 이탈 포함)
  const perSM = (f) => (sMonths ? rs.reduce((a, r) => a + f(r), 0) / sMonths : 0);
  const extrasRev = (r) => r.lab.topik + r.lab.eps + r.lab.camp + r.lab.danceExternal + r.lab.corporate + r.lab.mockTest;
  const labMonthlyKRW = perSM((r) => (r.lab.tuition + r.lab.premium + r.lab.textbook) / fx); // [페이블 4차] 외부 수강생 매출(특강·EPS·캠프·댄스·기업반·모의고사)은 뺀다
  const labMonthlyProfitKRW = perSM((r) => r.labKRW.profit - (extrasRev(r) - r.lab.extrasCost) / fx);
  const labRev = labMonthlyKRW * tenure; const labProfit = labMonthlyProfitKRW * tenure;
  const avg = (rate) => (rs.length ? rs.reduce((a, r) => a + Math.pow(1 + rate, (L.inflation.steps || []).filter((st) => r.m >= st).length), 0) / rs.length : 1);
  const priceM = avg(L.inflation.price); const wageM = avg(L.inflation.wage);
  const visaKeep = 1 - P.visaFailRate;
  const lastShare = P.milestones[P.milestones.length - 1].share;
  const admFactor = (1 - lastShare) + lastShare * visaKeep; // 비자가 안 나오면 마지막 몫을 받지 않는다
  const si = 1 + L.socialInsurance;
  const hourKRW = (P.counselor.full * wageM * si + P.counselor.perFteMNT) / P.counselor.monthHours / fx; // 상담 1시간 값
  const T = P.transfer;
  const one = (priceMNT, cacMNT) => {
    const adm = priceMNT * sc.priceRealization * priceM * admFactor / fx;
    const commission = visaKeep * sc.partnerUnivShare * ((1 - P.transfer.d4Share) * P.prices.univCommissionKRW + P.transfer.d4Share * (P.prices.univCommissionD4KRW ?? P.prices.univCommissionKRW));
    const settlement = visaKeep * P.settlementUptake * (P.prices.settlementKRW - P.prices.settlementCostKRW);
    const tP = visaKeep * T.d4Share * T.uptake[scName];
    const transfer = tP * T.priceKRW * sc.priceRealization;
    const revenue = adm + commission + settlement + transfer;
    const hours = P.hoursPerAdmission + tP * T.hours;
    const cost = hours * hourKRW + adm * P.successShare * si + cacMNT / fx;
    return { adm, commission, settlement, transfer, revenue, hours, cost, profit: revenue - cost, margin: revenue ? (revenue - cost) / revenue : 0 };
  };
  const pathLab = one(P.prices.admissionLab, 0); const pathExt = one(P.prices.admissionExternal, P.extCacMNT);
  const toKorea = Math.min(1, P.labToKorea[scName] * (1 - sc.labRetention) * tenure); // [페이블 4차] 여름 이탈자는 PATH로 세지 않으므로 신입 1명 기준 몫은 조금 작다
  const perLabStudent = labProfit + toKorea * pathLab.profit;
  return { year: y, tenure, labMonthlyKRW, labRev, labCost: labRev - labProfit, labProfit, labMargin: labRev ? labProfit / labRev : 0, pathLab, pathExt, toKorea, hourKRW,
    perLabStudent, pathShareOfStudent: perLabStudent ? (toKorea * pathLab.profit) / perLabStudent : 0,
    labValue: labRev, pathValue: toKorea * pathLab.revenue, pAdm: toKorea, total: labRev + toKorea * pathLab.revenue }; // 아래 셋은 옛 이름(생애 매출)
}

// ───────── 실행 ─────────
// [10-19 유호님 「4실 기준」] 본 결과는 08-01 확정 4실 24반 직영이다. 모자라는 돈은 투자·차입으로 채운다고 보고(2절 「필요 자금」) 멈춤 규칙은 쓰지 않는다.
// D안(첫해 기존 기관 안 SYNK반 → 현금 기준을 채우면 직영)과 A안(직영 교실 2개)은 비교로 둔다
const MAIN = { labMode: 'full4', stopRule: false };
const DPLAN = { labMode: 'hosted', stopRule: true }; // D안은 멈춤 규칙까지 계획의 일부로 돌린다
const scenarioNames = Object.keys(base.scenarios);
const results = {}; const summaries = {}; const aPlan = {}; const dPlan = {};
for (const s of scenarioNames) {
  results[s] = run(base, s, MAIN); summaries[s] = summarize(results[s]);
  const a = run(base, s); aPlan[s] = { res: a, sum: summarize(a) };
  const d = run(base, s, DPLAN); dPlan[s] = { res: d, sum: summarize(d) };
}
// 필요 자금: 가장 낮은 가용 현금이 0 아래로 내려간 만큼 + 여유(expansionBuffer.safetyKRW)
const needFunding = (sm) => Math.max(0, -sm.minCash) + (sm.minCash < 0 ? base.funding.expansionBuffer.safetyKRW : 0);
// [검수 2] 필요 자금 = 현금 바닥 기준과 「출자·공사 시점에 출자 + 공사·보증금·첫 석 달 고정비 + 한국 고정비 석 달 + 여유를 갖추는 데 모자라는 돈」 가운데 큰 쪽. 투입 시점은 그 달(4실은 2027-05)
const needFor = (res, sm) => Math.max(needFunding(sm), res && res.fdi && res.fdi.gap > 0 && !res.fdi.moved ? res.fdi.gap : 0);

// 민감도(4실 직영 기본 가정에서 하나씩만 바꿈). D안 변형은 D안 판으로 돌린다
const sens = [
  ['기본 그대로(4실 직영)', {}, null],
  ['D안 · 첫해 기존 기관 안 SYNK반(계단형 몫 30·25·20%)', { ...DPLAN }, null],
  ['수강료 실현 −15%', { scOverride: { priceRealization: 0.85 } }, null],
  ['LAB이 잡는 몫 −30%', { demandMult: 0.7 }, null],
  ['시장이 커지지 않음(성장 0%)', {}, (inp) => { inp.market.growth = 0; }],
  ['LAB 새 등록만 옛 방식(광고·콘텐츠로만 셈, 10-19 오전 판 · PATH는 새 방식)', { demand: 'acq' }, null],
  ['월 유지율 86% → 82%', { scOverride: { labRetention: 0.82 } }, null],
  ['광고로 학생 1명 값 8만 → 12만₮', {}, (inp) => { inp.lab.acquisition.cacMNT['기본'] = 120_000; }],
  ['PATH: LAB에서 한국 가는 몫 25% → 20%', {}, (inp) => { inp.path.labToKorea['기본'] = 0.2; }],
  ['PATH: LAB 밖 몽골 학생 몫 절반', {}, (inp) => { inp.path.extShare['기본'] = inp.path.extShare['기본'].map((x) => ({ ...x, v: x.v / 2 })); }],
  ['PATH: 협약 대학 비중 40% → 20%', { scOverride: { partnerUnivShare: 0.2 } }, null],
  ['PATH 위로: LAB에서 한국 가는 몫 25% → 50%', {}, (inp) => { inp.path.labToKorea['기본'] = 0.5; }],
  ['PATH 위로: LAB 밖 몽골 학생 몫 두 배(2029 6%)', {}, (inp) => { inp.path.extShare['기본'] = inp.path.extShare['기본'].map((x) => ({ ...x, v: x.v * 2 })); }],
  ['PATH 위로: 협약 대학 비중 40% → 70%', { scOverride: { partnerUnivShare: 0.7 } }, null],
  ['PATH 위로: 입학 지원 값 +50%(재원생 180만₮ · 외부 225만₮)', {}, (inp) => { inp.path.prices.admissionLab *= 1.5; inp.path.prices.admissionExternal *= 1.5; }],
  ['PULSE 광고·SHIFT 0원(담당자도 안 뽑음, WORLD는 남김)', { scOverride: { subVolume: 0 }, leadPlanned: null }, (inp) => { inp.shift.voucher.perYear['기본'] = {}; }],
  ['PULSE·SHIFT 계획대로(100%)', { scOverride: { subVolume: 1 } }, null],
  ['메인만(PULSE·SHIFT·온라인·WORLD 모두 0, 담당자 안 뽑음)', { scOverride: { subVolume: 0 }, leadPlanned: null }, (inp) => { inp.shift.voucher.perYear['기본'] = {}; inp.online.topik4Cohort.size['기본'] = 0; inp.online.worldB2C.m12.base = 0; inp.online.worldB2C.m36.base = 0; inp.online.worldCorporateMN.companies['기본'] = []; inp.online.textbookLicense.academies['기본'] = 0; }],
  ['유호님 회화 반이 정규 시간대를 씀(위성 시간을 못 받음)', {}, (inp) => { inp.lab.premiumUsesRegularSlots = true; }],
  ['메인만 + 대표 생활비를 2028년 말까지 받지 않음', { scOverride: { subVolume: 0 }, leadPlanned: null }, (inp) => { inp.shift.voucher.perYear['기본'] = {}; inp.online.topik4Cohort.size['기본'] = 0; inp.online.worldB2C.m12.base = 0; inp.online.worldB2C.m36.base = 0; inp.online.worldCorporateMN.companies['기본'] = []; inp.online.textbookLicense.academies['기본'] = 0; inp.company.founderPayKRW = [ { from: '2029-01', v: 3_000_000 } ]; }],
  ['한국 담당자를 뽑았는데 PULSE·SHIFT가 계획의 25%만 옴', { scOverride: { subVolume: 0.25 } }, null],
  ['AI바우처 0건', {}, (inp) => { inp.shift.voucher.perYear['기본'] = {}; }],
  ['다시 열기 두 가지를 열지 않음(TOPIK 4급 온라인 반·SHIFT 입구 상품)', {}, (inp) => { inp.online.topik4Cohort.size['기본'] = 0; inp.shift.entry.orders = [ { from: '2027-02', v: 0 } ]; }],
  ['다시 열기 ① TOPIK 4급 온라인 반만 열지 않음', {}, (inp) => { inp.online.topik4Cohort.size['기본'] = 0; }],
  ['다시 열기 ② SHIFT 입구 상품만 열지 않음', {}, (inp) => { inp.shift.entry.orders = [ { from: '2027-02', v: 0 } ]; }],
  ['다시 열기 ③ SHIFT 디지털 상품에서 유료 강의를 빼고 전자책·템플릿만(판매 절반으로 어림)', {}, (inp) => { inp.shift.digital.sales = inp.shift.digital.sales / 2; }],
  ['PULSE 광고만 0원(SHIFT·WORLD·담당자는 그대로)', {}, (inp) => { const z = (a) => a.map((x) => ({ ...x, v: 0 })); inp.pulse.entry.orders = z(inp.pulse.entry.orders); inp.pulse.adRetainer.clients = z(inp.pulse.adRetainer.clients); inp.pulse.projects.perQuarter = z(inp.pulse.projects.perQuarter); inp.pulse.mongoliaContent.clients = z(inp.pulse.mongoliaContent.clients); }],
  ['SHIFT만 0원(PULSE·담당자는 그대로)', {}, (inp) => { const z = (a) => a.map((x) => ({ ...x, v: 0 })); inp.shift.entry.orders = z(inp.shift.entry.orders); inp.shift.deploy.everyMonths = z(inp.shift.deploy.everyMonths); inp.shift.voucher.perYear['기본'] = {}; inp.shift.digital.sales = 0; }],
  ['SHIFT 디지털 상품이 한 건도 안 팔림(따르는 사람이 아직 거의 없음)', {}, (inp) => { inp.shift.digital.sales = 0; }],
  ['WORLD 유료 시작을 2027-04 → 2027-10으로 늦춤(개발자 계정·결제·심사가 밀릴 때)', {}, (inp) => { inp.online.worldB2C.paidFrom = '2027-10'; }],
  ['유호님 회화 0반(회화 추가를 팔지 않고 그 시간을 PULSE·SHIFT로)', {}, (inp) => { inp.company.premiumClasses = 0; }],
  ['유호님 회화 0반 + 한국 담당자는 수요를 보고 뽑음', { leadPlanned: null }, (inp) => { inp.company.premiumClasses = 0; }],
  ['2027-06 점검에 걸린 대응(담당자 미룸 + 생활비 150만원에 묶음)', { leadPlanned: null, freezePay: true }, null],
  ['PATH만 0원(유학 상품을 열지 않음)', {}, (inp) => { const P = inp.path; P.labToKorea['기본'] = 0; P.extShare['기본'] = [ { from: '2028-03', v: 0 } ]; P.externalPlansPerMonth = [ { from: '2027-10', v: 0 } ]; P.singles.perMonth = { 보수: 0, 기본: 0, 상방: 0 }; P.careerUptake['기본'] = [ { from: '2028-03', v: 0 } ]; P.online.share['기본'] = 0; P.univMarketingContracts['기본'] = []; P.camp.participants = { 보수: 0, 기본: 0, 상방: 0 }; P.travelAffiliateKRW.v = 0; P.koreaTripKRW = 0; }],
  ['PULSE 정기 묶음·전속 없이(입구 상품·프로젝트만)', {}, (inp) => { inp.pulse.adRetainer.clients = inp.pulse.adRetainer.clients.map((x) => ({ ...x, v: 0 })); }],
  ['PULSE·SHIFT 영업을 개원 뒤(2027-09)부터(10-03 결정대로)', { leadPlanned: null }, (inp) => { const f = '2027-09'; inp.pulse.entry.from = f; inp.pulse.entry.orders = [ { from: f, v: 3 }, { from: '2028-01', v: 6 } ]; inp.pulse.adRetainer.from = f; inp.pulse.adRetainer.clients = [ { from: f, v: 1 }, { from: '2028-03', v: 4 }, { from: '2029-03', v: 6 } ]; inp.pulse.projects.from = f; inp.pulse.projects.perQuarter = [ { from: f, v: 1 }, { from: '2028-01', v: 1.5 } ]; inp.shift.entry.from = f; inp.shift.entry.orders = [ { from: f, v: 2 }, { from: '2028-01', v: 3 } ]; inp.shift.deploy.firstMonth = f; inp.shift.deploy.everyMonths = [ { from: f, v: 6 }, { from: '2028-01', v: 4 }, { from: '2029-01', v: 3 } ]; inp.shift.digital.from = f; }],
  ['AI 도구비 월 100만 → 200만원', {}, (inp) => { inp.company.toolsKRW = 2_000_000; }],
  ['대표 생활비 처음부터 월 300만원', {}, (inp) => { inp.company.founderPayKRW = [ { from: '2027-07', v: 3_000_000 } ]; }],
  ['D안 변형 · 기관 몫을 계단 없이 30%로(기관이 고집할 때)', { ...DPLAN }, (inp) => { delete inp.lab.hosted.shareTiers; inp.lab.hosted.hostShare = 0.3; }],
  ['D안 변형 · 기관 몫 40%(기관이 더 달라고 할 때)', { ...DPLAN }, (inp) => { delete inp.lab.hosted.shareTiers; inp.lab.hosted.hostShare = 0.4; }],
  ['공사·비품비 +50%', { capexMult: 1.5 }, null],
  ['투그릭 15% 약세(1원 = 3.1₮)', {}, (inp) => { inp.fx.mntPerKrw = 3.1; }],
  ['수강료 부가세 비면제(10%)', { vatOnTuition: true }, null],
  ['정부 지원금 0원', { scOverride: { grantKRW: 0 } }, null],
  ['정부 지원금 0원 + 한국 담당자는 수요를 보고 뽑음', { scOverride: { grantKRW: 0 }, leadPlanned: null }, null],
  ['유호님 회화 수업 2반 → 1반(그 시간을 PULSE·SHIFT로)', {}, (inp) => { inp.company.premiumClasses = 1; }],
  ['한국 담당자를 미리 뽑지 않음(수요가 월 600만원을 석 달 넘을 때)', { leadPlanned: null }, null],
  ['한국 법인 청년 감면 50%', {}, (inp) => { inp.company.krTaxRelief = 0.5; }],
  ['사회보험 0(옛 모델 가정)', {}, (inp) => { inp.lab.socialInsurance = 0; }],
  ['D안 변형 · 기관 몫 처음부터 20%(교실만 빌리고 접수는 SYNK)', { ...DPLAN }, (inp) => { delete inp.lab.hosted.shareTiers; inp.lab.hosted.hostShare = 0.2; inp.lab.staff.ops.host = 1; }],
  ['D안 변형 · 직영 계획을 2029-01로 늦춤', { ...DPLAN, directFrom: '2029-01' }, null],
  ['A안 · 처음부터 직영 교실 2개', { labMode: null, stopRule: false }, null],
  ['B안 · 처음부터 교실 4개', { labMode: null, forceStage2: true, stopRule: false }, null],
  ['C안 · 현지 파트너 운영 + 사용료 10%', { labMode: null, partnerMode: true, royaltyRate: 0.1, stopRule: false }, null],
];
const sensRows = sens.map(([label, opts, patch]) => {
  const inp = clone(base); if (patch) patch(inp);
  const r = run(inp, '기본', { ...MAIN, ...opts }); const s = summarize(r);
  return { label, need: needFor(r, s), needMonth: r.fdi && r.fdi.month, roomsFull: r.v23AddMonths && r.v23AddMonths.length >= 2 ? r.v23AddMonths[1] : null, ebitda2027: s.years[2027].ebitda, ebitda2028: s.years[2028].ebitda, ebitda2029: s.years[2029].ebitda, cum: s.years[2027].ebitda + s.years[2028].ebitda + s.years[2029].ebitda, minCash: s.minCash, minCashMonth: s.minCashMonth, endCash2029: s.years[2029].endCash, bep1: r.bep1, bep2: r.bep2, bepHost: r.bepHost, fdi: r.fdi, s2Start: r.s2Start, leadFrom: r.leadFrom };
});
// 시장 손잡이: LAB이 시장에서 잡는 몫이 바뀌면(4실 직영)
const adRows = [
  ['보수 · 잡는 몫 그대로', '보수', {}],
  ['기본 · 잡는 몫 절반', '기본', { demandMult: 0.5 }],
  ['기본 · 잡는 몫 −25%', '기본', { demandMult: 0.75 }],
  ['기본 · 그대로', '기본', {}],
  ['기본 · 잡는 몫 +25%', '기본', { demandMult: 1.25 }],
  ['상방 · 잡는 몫 그대로', '상방', {}],
].map(([label, s, opts]) => { const r = run(base, s, { ...MAIN, ...opts }); const sm = summarize(r); return { label, ebitda2028: sm.years[2028].ebitda, ebitda2029: sm.years[2029].ebitda, minCash: sm.minCash, minCashMonth: sm.minCashMonth, students2028: sm.years[2028].endStudents, need: needFor(r, sm), rooms3: r.v23AddMonths[0] || null, rooms4: r.v23AddMonths[1] || null, fdi: r.fdi, s2Start: r.s2Start }; });

// D안 거래 조건 비교(세 가정) — 기관과 어떤 모양으로 계약하느냐 [D안 업그레이드 2차 10-19]
// 기관이 받는 돈은 수강료 몫 + PATH 몫 + 이전 꼬리 몫(₮). 교실 시간은 정규 세 시간대만 센다(위성 시간·토요일·댄스는 덤)
const ROOM_HOURS = 3 * 1.5 * 21.7;
const dealShapes = [
  ['계단형 몫 30·25·20%(제안)', null],
  ['단일 30%', (inp) => { delete inp.lab.hosted.shareTiers; inp.lab.hosted.hostShare = 0.3; }],
  ['단일 35%(협상 상한으로 제안)', (inp) => { delete inp.lab.hosted.shareTiers; inp.lab.hosted.hostShare = 0.35; }],
  ['단일 40%(기관이 더 달라고 할 때)', (inp) => { delete inp.lab.hosted.shareTiers; inp.lab.hosted.hostShare = 0.4; }],
  ['고정 임대 교실당 월 300만₮(접수·수납은 SYNK 운영 담당)', (inp) => { delete inp.lab.hosted.shareTiers; inp.lab.hosted.hostShare = 0; inp.lab.hosted.fixedPerRoomMNT = 3_000_000; inp.lab.staff.ops.host = 1; }],
  ['최소 보장 교실당 월 200만₮ + 계단형 몫', (inp) => { inp.lab.hosted.floorPerRoomMNT = 2_000_000; }],
  ['교실만 20%(접수·수납은 SYNK 운영 담당)', (inp) => { delete inp.lab.hosted.shareTiers; inp.lab.hosted.hostShare = 0.2; inp.lab.staff.ops.host = 1; }],
  ['SYNK반을 교실 4개까지 넓힘(직영 이전은 그 뒤)', (inp) => { inp.lab.stages.host.maxRooms = 4; }],
  ['C안 · 현지 기관이 운영 + 사용료 10%', 'C'],
];
const dealCompare = dealShapes.map(([label, patch]) => {
  const inp = clone(base); if (typeof patch === 'function') patch(inp);
  const isC = patch === 'C';
  const opts = isC ? { labMode: null, partnerMode: true, royaltyRate: 0.1, stopRule: false } : { ...DPLAN, noGate: true };
  const bySc = Object.fromEntries(scenarioNames.map((s) => {
    const r = run(inp, s, opts); const sm = summarize(r);
    const yr = (y) => r.rows.filter((x) => x.m.startsWith(String(y)) && !isC && !x.labKRW.royalty);
    const hostIncome = (y) => yr(y).reduce((a, x) => a + (x.lab.hostFee || 0) + (x.lab.hostTail || 0) + (x.path.hostFeeMNT || 0), 0);
    const hostHours = (y) => yr(y).reduce((a, x) => a + (x.lab.stage === 'host' ? x.lab.rooms * ROOM_HOURS : 0), 0);
    return [s, { ebitda2028: sm.years[2028].ebitda, ebitda2029: sm.years[2029].ebitda, cum: sm.years[2027].ebitda + sm.years[2028].ebitda + sm.years[2029].ebitda, cum2728: sm.years[2027].ebitda + sm.years[2028].ebitda,
      minCash: sm.minCash, minCashMonth: sm.minCashMonth, endCash2029: sm.years[2029].endCash, endStudents2029: sm.years[2029].endStudents,
      fdi: r.fdi, hostAddMonths: r.hostAddMonths || [], stopFrom: r.stopFrom,
      hostIncome2028MNT: hostIncome(2028), hostHours2028: hostHours(2028), hostIncome2029MNT: hostIncome(2029), hostHours2029: hostHours(2029) }];
  }));
  return { label, bep: isC ? null : labBep(inp, inp.scenarios['기본'], 'host').students, bySc };
});

// 학생 수별로 기관이 받는 돈(₮/월, 2027년 값·자리 잡은 뒤 기간권 비중) — 협상 자리에서 보여 줄 표 [D안 업그레이드 4차 10-19]
const hostIncomeTable = (() => {
  const u = labUnit(base, base.scenarios['기본']);
  const per = u.tuitionPer + u.premiumPer; // 학생 1명 월 수강료 + 회화 추가(교재비는 빼고 나눈다)
  const H = base.lab.hosted;
  const cap2 = labCapacity(base, 'host', base.lab.stages.host.rooms * base.lab.stages.host.slotsPerRoom);
  const roomsFor = (n) => (n <= cap2 ? base.lab.stages.host.rooms : base.lab.stages.host.maxRooms);
  return [40, 60, 80, 100, 120].map((n) => ({ students: n, perStudent: per, rooms: roomsFor(n), hours: roomsFor(n) * ROOM_HOURS,
    tiers: hostRateAt(H, n) * per * n, flat30: 0.3 * per * n, flat35: 0.35 * per * n, flat40: 0.4 * per * n, fixed300: 3_000_000 * roomsFor(n) }));
})();

const bepDetail = { v23: labBep(base, base.scenarios['기본'], 'v23'), host: labBep(base, base.scenarios['기본'], 'host'), host3: labBep(base, base.scenarios['기본'], 'host', {}, { hostRooms: 3 }), s1: labBep(base, base.scenarios['기본'], 's1'), s2: labBep(base, base.scenarios['기본'], 's2') };
const capV23 = (n) => labCapacityV23(base, n * base.lab.stages.v23.weekdaySlotsPerRoom, n * base.lab.stages.v23.satSlotsPerRoom);
const capDetail = { v23r2: capV23(2), v23r3: capV23(3), v23r4: capV23(4), host2: labCapacity(base, 'host', base.lab.stages.host.rooms * base.lab.stages.host.slotsPerRoom), host3: labCapacity(base, 'host', base.lab.stages.host.maxRooms * base.lab.stages.host.slotsPerRoom), s1: labCapacity(base, 's1', base.lab.stages.s1.rooms * base.lab.stages.s1.slotsPerRoom), s2: labCapacity(base, 's2', base.lab.stages.s2.rooms * base.lab.stages.s2.slotsPerRoom) };
const units = Object.fromEntries(scenarioNames.map((s) => [s, unitEconomics(base, s, results[s])]));
const ltvBase = units['기본'];
// 시장 깔때기 표: 한 해 합계(가정별, 4실 직영)
const marketYear = (res, y) => {
  const rs = res.rows.filter((r) => yearOf(r.m) === y);
  const sum = (f) => rs.reduce((a, r) => a + (f(r) || 0), 0);
  const mk = marketAt(base, `${y}-06`);
  return { pool: mk.pool, ubNew: mk.ubNew, inKorea: mk.inKorea, targetsNew: mk.targetsNew, capture: step(base.market.labCapture[res.scName], `${y}-12`),
    marketNew: sum((r) => r.lab.marketNew), newStudents: sum((r) => r.lab.newStudents), waitlist: sum((r) => r.lab.waitlist), endStudents: rs.length ? rs[rs.length - 1].lab.students : 0,
    admLab: sum((r) => r.path.admLab), admExt: sum((r) => r.path.admExt), transfers: sum((r) => r.path.transfers), career: sum((r) => r.path.career), online: sum((r) => r.path.onlineN) };
};
const marketRows = Object.fromEntries(scenarioNames.map((s) => [s, Object.fromEntries([2027, 2028, 2029].map((y) => [y, marketYear(results[s], y)]))]));
// PATH 줄별 한 해 합계(₩)
const pathYear = (res, y) => {
  const rs = res.rows.filter((r) => yearOf(r.m) === y);
  const sum = (f) => rs.reduce((a, r) => a + (f(r) || 0), 0); const k = (x) => x / base.fx.mntPerKrw;
  return { admissions: sum((r) => r.path.admissions), admLab: sum((r) => r.path.admLab), admExt: sum((r) => r.path.admExt),
    admission: k(sum((r) => r.path.admissionMNT)), commission: sum((r) => r.path.commissionKRW), settlement: sum((r) => r.path.settlementKRW), transfer: sum((r) => r.path.transferKRW), career: sum((r) => r.path.careerKRW), online: sum((r) => r.path.onlineKRW),
    other: k(sum((r) => r.path.planMNT + r.path.singlesMNT + r.path.campMNT)) + sum((r) => r.path.univMarketingKRW + r.path.travelKRW),
    revenue: sum((r) => r.pathKRW.revenue), cost: sum((r) => r.pathKRW.cost), profit: sum((r) => r.pathKRW.profit), fteEnd: rs.length ? rs[rs.length - 1].path.fte : 0, leadEnd: rs.length ? rs[rs.length - 1].path.lead : false };
};
const pathRows = Object.fromEntries(scenarioNames.map((s) => [s, Object.fromEntries([2028, 2029].map((y) => [y, pathYear(results[s], y)]))]));
// 2028년 직접 이익에서 서브(PULSE·SHIFT)와 WORLD·온라인이 차지하는 몫
const subShare = Object.fromEntries(scenarioNames.map((s) => {
  const y = summaries[s].years[2028];
  const parts = { lab: y.lab.profit, path: y.path.profit, online: y.online.profit, pulse: y.pulseAds.profit, world: y.world.profit, shift: y.shift.profit }; // [페이블 4차] 서브 = PULSE 광고 + SHIFT, WORLD는 따로
  const pos = Object.values(parts).reduce((a, v) => a + Math.max(0, v), 0);
  return [s, { ...parts, subShare: pos ? (Math.max(0, parts.pulse) + Math.max(0, parts.shift)) / pos : 0, subOnlineShare: pos ? (Math.max(0, parts.pulse) + Math.max(0, parts.shift) + Math.max(0, parts.online) + Math.max(0, parts.world)) / pos : 0 }];
}));

// ───────── 진출 나라 세 지표 [10-19 유호님 「보수적 = 몽골 · 평균적 = 몽골 외 1개 · 성공적 = 몽골 외 2개, 1년에 하나씩」] ─────────
// 나라마다 학원은 4실 정원의 targets.labFill(80%), 유학은 그 나라 한 해 새 한국 유학생의 targets.pathShare(10%).
// 몽골 판이 한국 법인·PULSE·SHIFT·WORLD·회사 공통비를 한 번 세고, 다른 나라는 그 나라 LAB·PATH만 센 판을 더한다
function deepMerge(t, src) {
  for (const [k, v] of Object.entries(src || {})) {
    const empty = v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0; // [페이블 5차] 빈 객체 = 그 칸을 비운다
    if (!empty && v && typeof v === 'object' && !Array.isArray(v) && t[k] && typeof t[k] === 'object' && !Array.isArray(t[k])) deepMerge(t[k], v); else t[k] = empty ? {} : v;
  }
  return t;
}
// 나라 입력: 몽골 값(₮)을 원화 기준 물가 배수(scale)로 바꾼 「몽골 환산 ₮」. 환율은 몽골 그대로 두고 값만 바꾼다
function countryInp(key) {
  const C0 = base.countries[key]; const inp = clone(base);
  const sc = C0.scale || {}; const L = inp.lab; const P = inp.path;
  const mul = (o, k, f) => { if (o && typeof o[k] === 'number') o[k] *= f; };
  if (sc.price) {
    for (const k of Object.keys(L.prices)) mul(L.prices, k, sc.price);
    mul(L.textbook, 'pricePerBook', sc.price);
    for (const x of Object.values(L.extras)) { mul(x, 'price', sc.price); mul(x, 'internalPrice', sc.price); mul(x, 'externalPrice', sc.price); }
    mul(P.prices, 'plan', sc.price); mul(P.singles, 'priceMNT', sc.price);
  }
  if (sc.wage) {
    const st = L.staff; mul(st, 'director', sc.wage); mul(st.ops, 'wage', sc.wage); mul(st, 'teacherHourly', sc.wage); mul(st, 'dance', sc.wage);
    for (const k of ['dance', 'beauty', 'vocal', 'satClassCost']) mul(st.v23, k, sc.wage);
    mul(st.cleaning, 'v23', sc.wage);
    mul(P.counselor, 'full', sc.wage); mul(P.counselor, 'leadExtra', sc.wage);
    for (const b of L.incentives.baseBonus) mul(b, 'each', sc.wage);
    for (const f of L.incentives.foundingBonus) mul(f, 'each', sc.wage);
    mul(L.incentives, 'fieldBonusMin', sc.wage);
  }
  if (sc.rent) { mul(L.stages.v23, 'rentFixedMNT', sc.rent); mul(L, 'utilitiesPerM2MNT', sc.rent); mul(P.counselor, 'perFteMNT', sc.rent); }
  if (sc.capex) mul(L.stages.v23, 'capexMNT', sc.capex);
  if (sc.other) {
    for (const k of ['materialsSW', 'marketing', 'accountingAudit', 'insurance']) mul(L.other[k], 'v23', sc.other);
    for (const k of ['cuPerClass', 'cuBase', 'preOpenMarketing', 'topikFeeSupport', 'jacket']) mul(L.other, k, sc.other);
    mul(L.textbook, 'costPerBook', sc.other);
  }
  if (sc.cac) { for (const k of Object.keys(L.acquisition.cacMNT)) mul(L.acquisition.cacMNT, k, sc.cac); mul(P, 'extCacMNT', sc.cac); }
  deepMerge(inp, C0.overrides || {});
  return inp;
}
const FILL = { labMode: 'full4', stopRule: false, labFill: base.targets.labFill, pathShare: base.targets.pathShare };
const planHz = base.planHorizon || { end: base.timeline.end, years: [2027, 2028, 2029] }; // [10-19] 세 지표만 2030-12까지
const lastY = planHz.years[planHz.years.length - 1];
const withHz = (inp) => { inp.timeline = { ...inp.timeline, end: planHz.end }; return inp; };
function runPlan(name, extra = {}) {
  const plan = base.plans[name];
  const { newOnly, all, ...rest } = extra; // 유학 몫 견주기: newOnly = 둘째 나라부터의 몫, all = 모든 나라의 몫
  const runs = plan.countries.map((c, k) => { const ps = all ?? (k > 0 && newOnly != null ? newOnly : FILL.pathShare); return { c, res: run(withHz(k === 0 ? clone(base) : countryInp(c)), '기본', { ...FILL, ...rest, pathShare: ps, countryOnly: k > 0, plan }) }; });
  const rows = runs[0].res.rows.map((r0, i) => {
    const parts = runs.map(({ c, res }) => ({ c, r: res.rows[i] }));
    const sum = (f) => parts.reduce((a, q) => a + f(q.r), 0);
    return { m: r0.m, revenue: sum((r) => r.revenueKRW), ebitda: sum((r) => r.ebitdaKRW), cash: sum((r) => r.cash.free), parts };
  });
  let minCash = Infinity; let minCashMonth = null;
  for (const r of rows) if (r.cash < minCash) { minCash = r.cash; minCashMonth = r.m; }
  const years = {};
  for (const y of planHz.years) {
    const rs = rows.filter((r) => yearOf(r.m) === y);
    const S = (f) => rs.reduce((a, r) => a + f(r), 0);
    const byC = Object.fromEntries(plan.countries.map((c, k) => [c, {
      labRev: S((r) => r.parts[k].r.labKRW.revenue), labProfit: S((r) => r.parts[k].r.labKRW.profit),
      pathRev: S((r) => r.parts[k].r.pathKRW.revenue), pathProfit: S((r) => r.parts[k].r.pathKRW.profit),
      contracts: S((r) => r.parts[k].r.path.admissions), endStudents: rs[rs.length - 1].parts[k].r.lab.students,
      ebitda: S((r) => r.parts[k].r.ebitdaKRW), capex: S((r) => r.parts[k].r.cash.capex), fteEnd: rs[rs.length - 1].parts[k].r.path.fte, leadsEnd: rs[rs.length - 1].parts[k].r.path.lead || 0, labNew: S((r) => r.parts[k].r.lab.newStudents || 0),
    }]));
    const tot = (f) => Object.values(byC).reduce((a, v) => a + f(v), 0);
    const p0 = (f) => S((r) => f(r.parts[0].r));
    years[y] = {
      revenue: S((r) => r.revenue), ebitda: S((r) => r.ebitda), byC,
      lab: { revenue: tot((v) => v.labRev), profit: tot((v) => v.labProfit) },
      path: { revenue: tot((v) => v.pathRev), profit: tot((v) => v.pathProfit), contracts: tot((v) => v.contracts) },
      world: { revenue: p0((r) => r.pulse.world), profit: p0((r) => r.pulse.world - r.pulse.worldCost), paidEnd: rs[rs.length - 1].parts[0].r.pulse.worldPaid || 0 },
      pulseAds: { revenue: p0((r) => r.pulse.ads), profit: p0((r) => r.pulse.ads - r.pulse.direct - r.pulse.people) },
      shift: { revenue: p0((r) => r.shift.revenue), profit: p0((r) => r.shift.profit) },
      online: { revenue: p0((r) => r.online.revenue), profit: p0((r) => r.online.profit) },
      company: p0((r) => r.company.cost), contingency: S((r) => r.parts.reduce((a, q) => a + q.r.company.contingency, 0)),
      endCash: rs[rs.length - 1].cash,
    };
  }
  const needFloor = Math.max(0, -minCash) + (minCash < 0 ? base.funding.expansionBuffer.safetyKRW : 0);
  const f0 = runs[0].res.fdi || {};
  const need = Math.max(needFloor, f0.gap > 0 ? f0.gap : 0); // [검수 2] 몽골 출자·공사 시점(2027-05)에 모자라는 돈과 견준다
  return { name, plan, runs, rows, years, minCash, minCashMonth, need, needFloor, needAtOpen: f0.gap || 0, needMonth: f0.month || null };
}
const planNames = Object.keys(base.plans);
const plans = Object.fromEntries(planNames.map((p) => [p, runPlan(p)]));
// [10-19 유호님 확정] 운영 계획: 새 나라 유학 몫만 opPlan.newPathShare(1.5%)로. 세 지표(10%)는 투자 자료의 성공 시나리오
const opPlans = base.opPlan ? Object.fromEntries(planNames.map((p) => [p, runPlan(p, { newOnly: base.opPlan.newPathShare })])) : null;
// 유학 몫 견주기(inputs.pathShareChecks): 세 지표마다 해마다(2027~2030) 영업이익과 유학 계약
const planChecks = (base.pathShareChecks || []).map((ck) => ({ label: ck.label, byPlan: Object.fromEntries(planNames.map((p) => { const r = runPlan(p, { newOnly: ck.newOnly, all: ck.all }); return [p, { ebitda: Object.fromEntries(planHz.years.map((y) => [y, r.years[y].ebitda])), contracts: Object.fromEntries(planHz.years.map((y) => [y, r.years[y].path.contracts])), revenue2029: r.years[2029].revenue, contracts2029: r.years[2029].path.contracts, pathProfit2029: r.years[2029].path.profit, byC2029: Object.fromEntries(Object.entries(r.years[2029].byC).map(([c, v]) => [c, { contracts: v.contracts, pathProfit: v.pathProfit }])), byCLast: Object.fromEntries(Object.entries(r.years[lastY].byC).map(([c, v]) => [c, { contracts: v.contracts, pathProfit: v.pathProfit, ebitda: v.ebitda }])), need: r.need }]; })) }));
// 운영 계획용 개원 전 관문 [제안 · 10-19, inputs.lab.opGate]: 몽골(보수적 지표) 운영 계획의 개원 달 등록에서 거꾸로 센 문의·체험·사전 등록 문턱과,
// 못 미칠 때 몽골만 다시 센 값(24반을 다 열었는데 학원만 덜 참 · 학원과 유학이 함께 반쯤), 유학 첫 석 달 계약 문턱
const opGate = base.lab.opGate && opPlans ? (() => {
  const OG = base.lab.opGate; const L = base.lab; const A = L.acquisition; const P = base.path;
  const conv = A.leadToStudent['기본'];
  const op80 = opPlans['보수적']; const mnRows = op80.rows;
  const rowAt = (m) => { const r = mnRows.find((x) => x.m === m); if (!r) throw new Error(`opGate: ${m} 줄 없음`); return r.parts[0].r; };
  const target = rowAt(L.openMonth).lab.newStudents; // 개원 달 새 등록(4실 정원 × labFill)
  const leads = target / conv;
  const lw = leadWeights(L);
  const shareTo = (m) => lw.months.reduce((a, mm, i) => a + (mm <= m ? lw.w[i] : 0), 0) / lw.sum;
  // 실 수별 정원(설계 16석)과 그 planFill이 개원 달 목표에서 차지하는 몫(2실 50% · 3실 75% · 4실 100%) [페이블 8차 P2-2]
  const S4 = L.stages.v23; const capR = (r) => labCapacityV23(base, r * S4.weekdaySlotsPerRoom, r * S4.satSlotsPerRoom, S4.seatsPerClass);
  const seatEq = (1 - L.lightShare) + 0.5 * L.lightShare; // 반 평균은 좌석 환산(라이트 과정은 격일이라 0.5석)
  const rooms = [2, 3, 4].map((r) => {
    const classes = r * S4.slotsPerRoom; const low = r === 2 ? target * OG.dCut : capR(r - 1) * OG.planFill; // 그 실 수로 여는 구간의 아래 끝
    const x = { rooms: r, classes, cap: capR(r), students: capR(r) * OG.planFill, share: capR(r) * OG.planFill / target, lowAvg: low * seatEq / classes };
    if (r > 2) { x.closeBelow = capR(r - 1) * OG.closeFill; x.closeAvg = x.closeBelow * seatEq / classes; } // 개원 뒤 줄이는 선: 한 실 적은 정원 × closeFill [페이블 9차 P3-2]
    return x;
  });
  const bandMin = { 4: rooms[1].share, 3: rooms[0].share, 2: OG.dCut }; // 그 몫 이상이면 그 실 수로 연다. dCut 아래는 4실을 짓지 않고 D안
  const checks = [...OG.checks, L.openMonth].map((m) => {
    const share = shareTo(m); const ld = leads * share; const open = m === L.openMonth;
    const promise = open ? target : ld * conv; // 등록 약속 상한: 그때까지 문의 × 문의→등록(모두 개원 전에 약속할 때)
    const promiseExp = open ? target : promise * OG.promiseRate; // 약속률을 곱한 예상 약속 — 8월 선은 이 값의 몫으로 잡는다 [페이블 9차 P3-3]
    return { month: m, share, leads: ld, leads4: ld * bandMin[4], leads3: ld * bandMin[3], leads2: ld * bandMin[2], trialApps: ld * OG.trialRate,
      promise, promiseExp, promise4: promiseExp * bandMin[4], promise3: promiseExp * bandMin[3], promise2: promiseExp * bandMin[2] };
  });
  // 체험 수업을 여는 달: 개원 전 preOpenMonths달(폐쇄 시험·공개 체험) [페이블 9차 P3-5]
  const trialMonths = []; for (let m = addMonths(L.openMonth, -L.preOpenMonths); m < L.openMonth; m = addMonths(m, 1)) trialMonths.push(m);
  const leadCostCap = A.cacMNT['기본'] * conv; const leadCostAlarm = A.cacMNT['보수'] * conv;
  const adTotalMNT = rowAt(L.openMonth).lab.adBudget; // 운영 계획이 개원 달에 붙인 광고비(광고로 오는 등록 × CAC)
  const adBeforeOpenMNT = adTotalMNT * shareTo(addMonths(L.openMonth, -1)); // 문의를 개원 전에 모으면 그만큼 앞당겨 쓴다(크기는 같음)
  const t = L.other.adTest; let testMonths = 0; for (let m = t.from; m <= t.to; m = addMonths(m, 1)) testMonths += 1;
  const adTestLeads = { months: testMonths, perMonth: t.mnt / leadCostCap, total: testMonths * t.mnt / leadCostCap };
  // 광고비를 실제로 앞당겨 다시 센 판: 2027-04 말 현금이 줄어 공사 때 모자라는 돈과 현금 바닥이 함께 바뀐다 [페이블 8차 P1]
  const early = runPlan('보수적', { newOnly: base.opPlan.newPathShare, adShift: adTotalMNT });
  const fdiOf = (r) => r.runs[0].res.fdi || {};
  const pick = (r) => ({ ebitda: Object.fromEntries([2027, 2028, 2029].map((y) => [y, r.years[y].ebitda])), need: r.need, minCash: r.minCash, minCashMonth: r.minCashMonth, contracts2028: r.years[2028].path.contracts, labProfit2028: r.years[2028].lab.profit, cashBeforeBuild: fdiOf(r).cashBefore });
  const fill = OG.fillChecks.map((x) => ({ labFill: x, ...pick(runPlan('보수적', { newOnly: base.opPlan.newPathShare, labFill: x })) }));
  const both = { ...OG.bothHalf, ...pick(runPlan('보수적', { newOnly: base.opPlan.newPathShare, labFill: OG.bothHalf.labFill, all: OG.bothHalf.pathShare })) };
  // 유학 관문: 상담을 연 첫 석 달(전체 계약) · 재원생 입학 지원을 연 첫 석 달(재원생 계약) [페이블 8차 P2-7 · P3-7]
  const pathSum = (from, f) => { let s = 0; let m = from; for (let i = 0; i < OG.pathFirstMonths; i++) { s += f(rowAt(m).path); m = addMonths(m, 1); } return s; };
  const endOf = (from) => addMonths(from, OG.pathFirstMonths - 1);
  const pathGate = {
    first: { from: P.startUB, to: endOf(P.startUB), contracts: pathSum(P.startUB, (p) => p.admissions), fte: rowAt(P.startUB).path.fte, lead: rowAt(P.startUB).path.lead },
    second: { from: P.labConvFrom, to: endOf(P.labConvFrom), contracts: pathSum(P.labConvFrom, (p) => p.admissions), labContracts: pathSum(P.labConvFrom, (p) => p.admLab || 0) },
  };
  return { target, conv, leads, months: lw.months, wSum: lw.sum, seatEq, rooms, bandMin, checks, trialMonths, leadCostCap, leadCostAlarm, adTotalMNT, adBeforeOpenMNT, adBeforeKRW: adBeforeOpenMNT / base.fx.mntPerKrw, adTestLeads,
    early: pick(early), base80: pick(op80), fill, both, pathGate };
})() : null;
// 나라별 학생 1명당 경제와 나라 사실(성공적 지표의 나라 판에서)
const widest = planNames.reduce((a, p) => (base.plans[p].countries.length > base.plans[a].countries.length ? p : a), planNames[0]);
const planUnits = Object.fromEntries(base.plans[widest].countries.map((c, k) => [c, unitEconomics(k === 0 ? base : countryInp(c), '기본', plans[widest].runs[k].res, lastY)])); // [10-19] 세 나라 모두 한 해를 다 도는 2030
const countryFacts = Object.fromEntries(Object.keys(base.countries).map((c) => {
  const inpC = c === 'mn' ? base : countryInp(c); const V = inpC.lab.stages.v23; const fxC = inpC.fx.mntPerKrw;
  const cap4 = labCapacityV23(inpC, V.rooms * V.weekdaySlotsPerRoom, V.rooms * V.satSlotsPerRoom, V.seatsPerClass);
  const LL = inpC.lab; const seatEq = (1 - LL.lightShare) + 0.5 * LL.lightShare; const classes = V.rooms * (V.weekdaySlotsPerRoom + V.satSlotsPerRoom);
  const s80 = cap4 * base.targets.labFill; const wkdPer = (1 - LL.lightShare) * (1 - LL.weekendShare) + 0.5 * LL.lightShare; const satPer = (1 - LL.lightShare) * LL.weekendShare;
  const bepC = labBep(inpC, inpC.scenarios['기본'], 'v23', { extraFixedMNT: LL.countryOverheadMNT || 0 });
  const demand = (y) => inpC.market.mongolia.newStudents * Math.pow(1 + inpC.market.growth, Math.max(0, y - inpC.market.baseYear));
  return [c, { name: base.countries[c].name, open: base.countries[c].open, scale: base.countries[c].scale || {}, cap4, students80: s80, seatEq, classes, avgClass80: s80 * seatEq / classes,
    wkdFill80: s80 * wkdPer / (V.rooms * V.weekdaySlotsPerRoom * V.seatsPerClass), satFill80: s80 * satPer / (V.rooms * V.satSlotsPerRoom * V.seatsPerClass), seatFill80: s80 * seatEq / (classes * V.seatsPerClass), bepStudents: bepC.students,
    demand2027: demand(2027), demand2028: demand(2028), demand2029: demand(2029), demand2030: demand(2030), demandBy: Object.fromEntries(planHz.years.map((y) => [y, demand(y)])), growth: inpC.market.growth, newStudents2025: inpC.market.mongolia.newStudents, inKorea: inpC.market.mongolia.studentsInKorea,
    m1KRW: inpC.lab.prices.m1 / fxC, m6KRW: inpC.lab.prices.m6 / fxC, admLabKRW: inpC.path.prices.admissionLab / fxC, admExtKRW: inpC.path.prices.admissionExternal / fxC,
    capexKRW: V.capexMNT / fxC, rentKRW: V.rentFixedMNT / fxC, teacherClassKRW: inpC.lab.staff.hoursPerClass * inpC.lab.staff.teacherHourly / fxC, counselorKRW: inpC.path.counselor.full / fxC,
    taxRate: inpC.tax ? inpC.tax.rate : null, taxByYear: inpC.tax && inpC.tax.byYear ? inpC.tax.byYear : null, socialInsurance: inpC.lab.socialInsurance, overheadKRW: (inpC.lab.countryOverheadMNT || 0) / fxC, note: base.countries[c].note || '' }];
}));

// ───────── 검산 ─────────
const checks = [];
const allRuns = [...planNames.flatMap((p) => plans[p].runs.map(({ c, res }) => [`${p} ${c}`, res, summarize(res)])), ...scenarioNames.map((s) => [`4실 ${s}`, results[s], summaries[s]]), ...scenarioNames.map((s) => [`D ${s}`, dPlan[s].res, dPlan[s].sum]), ...scenarioNames.map((s) => [`A ${s}`, aPlan[s].res, aPlan[s].sum])];
for (const p of planNames) for (const r of plans[p].rows) { const rev = r.parts.reduce((a, q) => a + q.r.revenueKRW, 0); if (Math.abs(rev - r.revenue) > 1) checks.push(`${p} ${r.m} 나라 합 매출 불일치`); }
for (const [name, res, sum] of allRuns) {
  for (const r of res.rows) {
    const sumRev = r.labKRW.revenue + r.pathKRW.revenue + r.online.revenue + r.pulse.revenue + r.shift.revenue;
    if (Math.abs(sumRev - r.revenueKRW) > 1) checks.push(`${name} ${r.m} 매출 합 불일치`);
    if (r.lab.students > r.lab.cap + 1e-6) checks.push(`${name} ${r.m} 학생 수가 정원을 넘음`);
    if (r.lab.incentiveDetail.pool < -1e-6) checks.push(`${name} ${r.m} 이익 나눔이 음수`);
    if (r.lab.classes > Math.ceil(r.lab.slots + 1e-9) && r.lab.classes > 2) checks.push(`${name} ${r.m} 반 수가 시간대보다 많음`);
    if (r.cash.grantBal < -1e-6) checks.push(`${name} ${r.m} 지원금 통장이 음수`);
    if (r.lab.marketNew && r.lab.newStudents > r.lab.marketNew + 1e-6) checks.push(`${name} ${r.m} 받은 등록이 시장에서 온 사람보다 많음`);
    const mkC = marketAt(res.inp || base, r.m); // 세 지표는 그 나라 전체 새 유학생, 시장 몫 방식은 울란바토르 새 유학생이 한도
    if (r.path.admExt > (res.fill ? mkC.countryNew : mkC.ubNew) / 12 + 1e-6 || r.path.admissions < -1e-9) checks.push(`${name} ${r.m} PATH 계약 수가 시장 밖`);
  }
  const ys = sum.years; const tot = Object.values(ys).reduce((a, v) => a + v.revenue, 0);
  const tot2 = res.rows.reduce((a, r) => a + r.revenueKRW, 0);
  if (Math.abs(tot - tot2) > 1) checks.push(`${name} 연 합계와 달 합계 불일치`);
}

// ───────── 쓰기 ─────────
const won = (x) => `${x < 0 ? '−' : ''}${Math.round(Math.abs(x) / 10000).toLocaleString('ko-KR')}만`;
// 직영 이전 칸: D안은 준비 → 이전 달, 기간 안에 못 옮기면 그렇게. A안은 출자 시점에 모자라는 돈
const moveText = (f) => {
  if (!f || (f.moved === null && f.month === null)) return '해당 없음';
  if (f.gate) return '개원 관문 → 처음부터 C안';
  if (f.stopFrom) return `멈춤 규칙 → ${f.stopFrom}부터 C안`;
  if (f.moved === false) return '기간 안에 못 옮김';
  if (f.moved) return `${f.month} 준비 → ${f.moved} 이전${f.directStage ? `(교실 ${f.directStage === 's2' ? 4 : 2}개)` : ''}`;
  return f.gap > 0 ? `${f.month}에 ${won(f.gap)} 모자람` : `${f.month}에 채움`;
};
const mnt = (x) => `${Math.round(x / 10000).toLocaleString('ko-KR')}만₮`;
const n1 = (x) => (Number.isFinite(x) ? (Math.round(x * 10) / 10).toLocaleString('ko-KR') : '없음');
const pct = (x) => `${Math.round(x * 100)}%`;
let md = `# 계산 결과 (model.mjs가 만든 파일 — 손으로 고치지 않는다)\n\n기준일 ${base.asOf} · 환율 1원 = ${base.fx.mntPerKrw}₮, 1달러 = ${base.fx.krwPerUsd}원 · 금액은 원(₩) 기준, 「만」은 만 원\n\n`;
md += `**본 결과는 08-01 확정 4실 24반 직영**(77평을 처음부터 빌려 2실 12반으로 열고 정원 85%를 두 달 넘기면 한 실씩 더 열어 4실 24반 · 평일 코어 11·14·15:30·18시 + 토요일 11·14시)이다. 모자라는 돈은 투자·차입으로 채운다고 보고 계산을 이어 갔다(2절 「필요 자금」). D안(첫해 기존 기관 안 SYNK반)과 A안(직영 교실 2개)은 2-2절에 비교로 둔다. 표의 「현금」은 정부 지원금 전용 통장을 뺀 **가용 현금**이다.\n\n`;
md += `검산: ${checks.length ? checks.join(' / ') : '이상 없음(매출 합·정원·반 수·이익 나눔·지원금 통장·연 합계 대조, 4실·D·A안 세 가정 모두)'}\n\n`;
const K = base.market; const fmt = (x) => Math.round(x).toLocaleString('ko-KR');
const cname = (c) => base.countries[c].name;
md += `## 진출 나라 세 지표 — ${planHz.years.join(' · ')}\n\n유호님 10-19: 보수적 = 몽골 1개 나라, 평균적 = 몽골 외 1개 나라, 성공적 = 몽골 외 2개 나라에서 학원 + 유학 + WORLD 앱이 성공적으로 돌 때. 1년에 한 나라씩 연다(${planNames.map((p) => `${p} ${base.plans[p].countries.map((c) => `${cname(c)} ${base.countries[c].open}`).join(' · ')}`).join(' / ')}). 나라마다 학원은 4실 정원의 ${pct(base.targets.labFill)}, 유학은 그 나라 한 해 새 한국 유학생의 ${pct(base.targets.pathShare)}를 가져간다고 셌다. PULSE 광고·SHIFT·LAB 온라인은 세 지표 모두 같은 값(기본)이다.\n\n| 지표 | 연도 | 매출 | 영업이익 | LAB 이익 | PATH 이익 | WORLD 이익 | PULSE 광고 이익 | SHIFT 이익 | 회사 공통비 | 연말 현금 |\n|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n`;
for (const p of planNames) for (const y of planHz.years) { const v = plans[p].years[y]; md += `| ${p} | ${y} | ${won(v.revenue)} | ${won(v.ebitda)} | ${won(v.lab.profit)} | ${won(v.path.profit)} | ${won(v.world.profit)} | ${won(v.pulseAds.profit)} | ${won(v.shift.profit)} | −${won(v.company)} | ${won(v.endCash)} |\n`; }
md += `\n| 지표 | 가장 낮은 현금(달) | 현금 바닥 기준 | 출자·공사 시점에 모자라는 돈 | 필요 자금(큰 쪽) | 투입 시점 |\n|---|---:|---:|---:|---:|---|\n`;
for (const p of planNames) md += `| ${p} | ${won(plans[p].minCash)} (${plans[p].minCashMonth}) | ${won(plans[p].needFloor)} | ${won(plans[p].needAtOpen)} | ${won(plans[p].need)} | ${plans[p].needMonth || '—'} 전 |\n`;
md += `\n### 나라별\n\n| 지표 | 연도 | 나라 | 연말 학생 | LAB 매출 / 이익 | 유학 계약 | PATH 매출 / 이익 | 그 나라 영업이익 |\n|---|---|---|---:|---:|---:|---:|---:|\n`;
for (const p of planNames) for (const y of planHz.years) for (const c of base.plans[p].countries) { const v = plans[p].years[y].byC[c]; md += `| ${p} | ${y} | ${cname(c)} | ${fmt(v.endStudents)} | ${won(v.labRev)} / ${won(v.labProfit)} | ${fmt(v.contracts)} | ${won(v.pathRev)} / ${won(v.pathProfit)} | ${won(v.ebitda)} |\n`; }
md += `\n그 나라 영업이익은 그 나라 LAB·PATH 이익에서 예비비를 뺀 값이고, 몽골 줄에는 한국 법인·PULSE·SHIFT·WORLD·회사 공통비가 함께 들어 있다.\n\n`;
if (opPlans) {
  md += `### ${base.opPlan.label} — 새 나라 유학 몫 ${(base.opPlan.newPathShare * 100).toFixed(1)}%부터\n\n10-19 유호님 확정: 위 세 지표(유학 ${pct(base.targets.pathShare)})는 투자 자료의 성공 시나리오로만 쓰고, 운영 계획은 새 나라(둘째 나라부터)의 유학 몫을 ${(base.opPlan.newPathShare * 100).toFixed(1)}%로 둔다(2030년까지 그대로). 몽골은 운영 계획도 세 지표와 같은 학원 ${pct(base.targets.labFill)}·유학 ${pct(base.targets.pathShare)}이고(10-19 유호님 확정), 학원·WORLD는 두 판이 같다.\n\n| 지표 | 연도 | 매출 | 영업이익 | LAB 이익 | PATH 이익 | 유학 계약 | 나라별 유학 계약 | 연말 현금 |\n|---|---|---:|---:|---:|---:|---:|---|---:|\n`;
  for (const p of planNames) for (const y of planHz.years) { const v = opPlans[p].years[y]; md += `| ${p} | ${y} | ${won(v.revenue)} | ${won(v.ebitda)} | ${won(v.lab.profit)} | ${won(v.path.profit)} | ${fmt(v.path.contracts)} | ${base.plans[p].countries.map((c) => `${cname(c)} ${fmt(v.byC[c].contracts)}`).join(' · ')} | ${won(v.endCash)} |\n`; }
  md += `\n필요 자금: ${planNames.map((p) => `${p} ${won(opPlans[p].need)}(${opPlans[p].needMonth || '—'} 전)`).join(' · ')}\n\n`;
}
if (opGate) {
  const og = opGate; const og4 = (v) => Math.round(v).toLocaleString('ko-KR'); const OGi = base.lab.opGate; const openM = base.lab.openMonth;
  md += `\n### 운영 계획용 개원 전 관문(제안, 몽골)\n\n개원 달 등록 ${n1(og.target)}명 ÷ 문의→등록 ${pct(og.conv)} = 문의 ${og4(og.leads)}건(${og.months[0]}~${og.months[og.months.length - 1]}, 계절 가중 합 ${n1(og.wSum)}). 실 수별 정원 × ${pct(OGi.planFill)}: ${og.rooms.map((r) => `${r.rooms}실 ${r.classes}반 ${og4(r.students)}명(목표의 ${pct(r.share)})`).join(' · ')}. 구간 아래 끝에서 열 때 반 평균(좌석 환산): ${og.rooms.map((r) => `${r.rooms}실 ${n1(r.lowAvg)}명`).join(' · ')}. 개원 뒤 줄이는 선(한 실 적은 정원 × ${pct(OGi.closeFill)}): ${og.rooms.filter((r) => r.closeBelow).map((r) => `${r.rooms}실 ${og4(r.closeBelow)}명 아래(반 평균 ${n1(r.closeAvg)}명)`).join(' · ')}. 체험 수업 ${og.trialMonths.join('·')}. 문의 1건 값 문턱 ${og4(og.leadCostCap)}₮(경보 ${og4(og.leadCostAlarm)}₮), 광고 시험으로 모이는 문의 ${og4(og.adTestLeads.total)}건(${og.adTestLeads.months}달). 광고비를 개원 전에 앞당겨 쓰면(${mnt(og.adBeforeOpenMNT)}) 공사 전 현금 ${won(og.base80.cashBeforeBuild)} → ${won(og.early.cashBeforeBuild)}, 필요 자금 ${won(og.base80.need)} → ${won(og.early.need)}, 가장 낮은 현금 ${won(og.base80.minCash)} → ${won(og.early.minCash)}.\n\n| 점검 | 누적 몫 | 문의 목표 | 4실(${pct(og.bandMin[4])} 이상) | 3실(${pct(og.bandMin[3])} 이상) | 2실(${pct(og.bandMin[2])} 이상) | 체험 신청 | 등록 약속 상한 | 예상 약속(약속률 ${pct(OGi.promiseRate)}) | 4실 · 3실 · 2실 약속 선 |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---|\n`;
  for (const c of og.checks) { const o = c.month === openM; md += `| ${c.month} | ${pct(c.share)} | ${og4(c.leads)} | ${o ? '—' : og4(c.leads4)} | ${o ? '—' : og4(c.leads3)} | ${o ? '—' : og4(c.leads2)} | ${og4(c.trialApps)} | ${og4(c.promise)} | ${og4(c.promiseExp)} | ${o ? '—' : `${og4(c.promise4)} · ${og4(c.promise3)} · ${og4(c.promise2)}`} |\n`; }
  md += `\n| 경우(몽골만) | 2027 | 2028 | 2029 | 가장 낮은 현금(달) | 필요 자금 |\n|---|---:|---:|---:|---:|---:|\n`;
  for (const [lb, v] of [['운영 계획 · 학원 80%·유학 10%', og.base80], ['운영 계획 · 광고비를 개원 전에 앞당김', og.early], ...og.fill.map((f) => [`24반 · 학원 ${pct(f.labFill)}·유학 10%`, f]), [`24반 · 학원 ${pct(og.both.labFill)}·유학 ${pct(og.both.pathShare)}`, og.both]]) md += `| ${lb} | ${won(v.ebitda[2027])} | ${won(v.ebitda[2028])} | ${won(v.ebitda[2029])} | ${won(v.minCash)} (${v.minCashMonth}) | ${won(v.need)} |\n`;
  const g = og.pathGate;
  md += `\n유학 관문: ${g.first.from}~${g.first.to} 계약 ${n1(g.first.contracts)}건(상담 ${g.first.fte}명, 그중 팀장 ${g.first.lead}명) · ${g.second.from}~${g.second.to} 재원생 계약 ${n1(g.second.labContracts)}건(전체 ${n1(g.second.contracts)}건)\n\n`;
}
md += `### 나라 가정\n\n| 나라 | 개원 | 학원 학생(4실 정원의 ${pct(base.targets.labFill)}) | 한 해 새 한국 유학생(2025) · 성장 | 유학 계약(한 해, 10%) | 물가 배수(값 · 임금 · 임대 · 공사) | 메모 |\n|---|---|---:|---:|---:|---|---|\n`;
for (const c of Object.keys(base.countries)) { const C0 = base.countries[c]; const inpC = c === 'mn' ? base : countryInp(c); const mn0 = inpC.market.mongolia; const capC = labCapacityV23(inpC, inpC.lab.stages.v23.rooms * inpC.lab.stages.v23.weekdaySlotsPerRoom, inpC.lab.stages.v23.rooms * inpC.lab.stages.v23.satSlotsPerRoom, inpC.lab.stages.v23.seatsPerClass); /* 세 지표와 같이 설계 좌석 기준 */ const sc0 = C0.scale || {}; md += `| ${C0.name} | ${C0.open} | ${fmt(capC * base.targets.labFill)}명 | ${fmt(mn0.newStudents)} · ${pct(inpC.market.growth)} | ${fmt(mn0.newStudents * Math.pow(1 + inpC.market.growth, lastY - inpC.market.baseYear) * base.targets.pathShare)}(${lastY}) | ${[sc0.price, sc0.wage, sc0.rent, sc0.capex].map((x) => (x ?? 1).toFixed(2)).join(' · ')} | ${C0.note || ''} |\n`; }
if (planChecks.length) {
  md += `\n### 유학 몫 견주기(같은 세 지표에서 유학 몫만 바꿈)\n\n| 유학 몫 | ${planNames.map((p) => `${p} ${planHz.years.join(' · ')} 영업이익`).join(' | ')} | ${lastY} 유학 계약(${planNames[planNames.length - 1]}) |\n|---|${planNames.map(() => '---').join('|')}|---:|\n`;
  md += `| 모든 나라 ${pct(base.targets.pathShare)}(세 지표) | ${planNames.map((p) => planHz.years.map((y) => won(plans[p].years[y].ebitda)).join(' · ')).join(' | ')} | ${fmt(plans[planNames[planNames.length - 1]].years[lastY].path.contracts)} |\n`;
  for (const c of planChecks) md += `| ${c.label} | ${planNames.map((p) => planHz.years.map((y) => won(c.byPlan[p].ebitda[y])).join(' · ')).join(' | ')} | ${fmt(c.byPlan[planNames[planNames.length - 1]].contracts[lastY])} |\n`;
}
md += `\n`;
md += `## 0. 시장 깔때기 — 잠재 고객\n\n유호님 10-19 「TOPIK → 유학생(+취업)은 전부 기본 잠재 고객」. 숫자는 [조사/시장깔때기_20261019.md](조사/시장깔때기_20261019.md)(국립국제교육원 TOPIK 시행 현황 · 법무부 출입국 통계 · 산업인력공단 EPS 통계)에서 왔다. TOPIK은 연인원이라 한 사람이 여러 번 보면 겹친다.\n\n| 몽골(2025) | 인원 |\n|---|---:|\n`;
for (const [k, v] of K.funnel.mongolia) md += `| ${k} | ${fmt(v)} |\n`;
md += `\n| 대상 국가(2025) | 인원 |\n|---|---:|\n`;
for (const [k, v] of K.funnel.targets) md += `| ${k} | ${fmt(v)} |\n`;
const mn = K.mongolia;
md += `\n**계산에 쓴 잠재 고객.** 울란바토르 한국행 준비 인원(연) = (TOPIK 지원 ${fmt(mn.topik)} × 사람 기준 ${pct(mn.topikDedup)} + EPS-TOPIK 접수 ${fmt(mn.eps)} + TOPIK 없이 가는 어학연수 ${fmt(mn.d4Direct)}) × 울란바토르 비중 ${pct(mn.ubShare)}이고, 해마다 ${pct(K.growth)}씩 큰다. LAB 새 등록 = 그 인원 ÷ 12 × LAB이 잡는 몫 × 계절(9월 1.8배 · 7월 0.5배)이고, 그 가운데 ${pct(K.paidShare)}는 광고로 온다고 보고 광고비를 붙였다. 정원이 차면 그 달에 받지 못한 사람은 다음 달로 넘기지 않고 놓친 것으로 센다. PATH의 LAB 밖 계약 = 울란바토르의 그해 새 유학생(${fmt(mn.newStudents)} × ${pct(mn.ubShare)}, 해마다 ${pct(K.growth)} 성장)에서 LAB으로 간 사람을 뺀 수 × PATH가 잡는 몫. 취업 준비 = 한국 체류 몽골 유학생 × 그해 사는 몫. 대상 국가 온라인 상담 = 대상 국가 한 해 새 유학생(약 ${fmt(K.targetsNewStudents)}명) × 잡는 몫.\n\n`;
md += `| 가정 | 연도 | 울란바토르 준비 인원 | LAB이 잡는 몫(연말) | LAB에 오려는 사람 | 받은 등록 | 놓친 사람(정원 넘침) | 연말 학생 | 울란바토르 새 유학생 | PATH 계약 LAB / 밖 | 새 유학생 가운데 PATH | 진학 지원 | 취업 준비 | 대상 국가 온라인 |\n|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n`;
for (const s of scenarioNames) for (const y of [2027, 2028, 2029]) {
  const v = marketRows[s][y];
  md += `| ${s} | ${y} | ${fmt(v.pool)} | ${pct(v.capture)} | ${fmt(v.marketNew)} | ${fmt(v.newStudents)} | ${fmt(v.waitlist)} | ${fmt(v.endStudents)} | ${fmt(v.ubNew)} | ${fmt(v.admLab)} / ${fmt(v.admExt)} | ${pct((v.admLab + v.admExt) / v.ubNew)} | ${fmt(v.transfers)} | ${fmt(v.career)} | ${fmt(v.online)} |\n`;
}
const w36 = base.online.worldB2C.m36.base; const wSubs = w36 / K.worldNetPerSubKRW;
md += `\n2027년은 개원(9월)부터 넉 달만 센다. WORLD(PULSE 쪽)는 대상 국가 쪽 잠재 고객을 쓴다: 기본 36개월째 월 매출 ${won(w36)} ÷ 유료 1명 순매출 ${fmt(K.worldNetPerSubKRW)}원(BM 목록 ㉯) ≈ 유료 ${fmt(wSubs)}명 = 18개국 TOPIK 지원 ${fmt(K.targetsTopik)}건의 ${(wSubs / K.targetsTopik * 100).toFixed(1)}%.\n\n`;
const u = units['기본']; const pl = u.pathLab; const pe = u.pathExt;
md += `### 학생 1명당 경제(${u.year}년 값, 기본 가정)\n\n| | LAB 학생 1명(평균 재원 ${n1(u.tenure)}개월) | PATH 계약 1건 · LAB 학생 | PATH 계약 1건 · LAB 밖 학생 |\n|---|---:|---:|---:|\n`;
md += `| 매출 | ${won(u.labRev)} | ${won(pl.revenue)} | ${won(pe.revenue)} |\n`;
md += `| 그중 | 수강료·교재·부가 상품(학생 1명 월 ${won(u.labMonthlyKRW)}) | 입학 지원 ${won(pl.adm)} · 대학 수수료 ${won(pl.commission)} · 정착 ${won(pl.settlement)} · 진학 ${won(pl.transfer)} | 입학 지원 ${won(pe.adm)} · 대학 수수료 ${won(pe.commission)} · 정착 ${won(pe.settlement)} · 진학 ${won(pe.transfer)} |\n`;
md += `| 비용 | ${won(u.labCost)}(강사·임대·운영·성과급 전부) | ${won(pl.cost)}(상담 ${n1(pl.hours)}시간 · 성과 몫) | ${won(pe.cost)}(상담 ${n1(pe.hours)}시간 · 성과 몫 · 계약 광고 ${mnt(base.path.extCacMNT)}) |\n`;
md += `| 남는 돈 | ${won(u.labProfit)} | ${won(pl.profit)} | ${won(pe.profit)} |\n`;
md += `| 이익률 | ${pct(u.labMargin)} | ${pct(pl.margin)} | ${pct(pe.margin)} |\n`;
md += `\nLAB은 ${u.year}년 4실 계산의 학생 1명·달 평균(고정비까지 나눔) × 평균 재원 개월이고, PATH는 계약 1건이 끝까지 가져오는 돈이다(입학 지원은 계약·합격·비자 세 번에 나눠 받고 비자 실패 ${pct(base.path.visaFailRate)}는 마지막 몫을 못 받음, 협약 대학 비중 ${pct(base.scenarios['기본'].partnerUnivShare)} × 1명 ${won(base.path.prices.univCommissionKRW)}, 어학연수생 ${pct(base.path.transfer.d4Share)} 가운데 ${pct(base.path.transfer.uptake['기본'])}가 대학 진학 지원을 다시 삼). 상담 1시간 값 ${fmt(u.hourKRW)}원.\n\n`;
md += `LAB 학생 1명이 가져오는 이익 = LAB ${won(u.labProfit)} + 한국에 가는 몫 ${pct(u.toKorea)} × PATH ${won(pl.profit)} = **${won(u.perLabStudent)}**(그중 PATH ${pct(u.pathShareOfStudent)}). 가정별: ${scenarioNames.map((s) => `${s} ${won(units[s].perLabStudent)}(PATH ${pct(units[s].pathShareOfStudent)}, 한국 가는 몫 ${pct(units[s].toKorea)})`).join(' · ')}.\n\n`;
md += `### PATH 줄별(4실 직영)\n\n| 가정 | 연도 | 계약 LAB / 밖 | 입학 지원 | 대학 수수료 | 정착 | 진학 지원 | 취업 준비 | 대상 국가 온라인 | 그 밖(계획·단품·연수·대학 홍보·여행) | 매출 | 비용 | 이익 | 이익률 | 연말 상담 인원 |\n|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n`;
for (const s of scenarioNames) for (const y of [2028, 2029]) {
  const v = pathRows[s][y];
  md += `| ${s} | ${y} | ${fmt(v.admLab)} / ${fmt(v.admExt)} | ${won(v.admission)} | ${won(v.commission)} | ${won(v.settlement)} | ${won(v.transfer)} | ${won(v.career)} | ${won(v.online)} | ${won(v.other)} | ${won(v.revenue)} | ${won(v.cost)} | ${won(v.profit)} | ${v.revenue ? pct(v.profit / v.revenue) : '—'} | ${n1(v.fteEnd)}명${v.leadEnd ? '(팀장 포함)' : ''} |\n`;
}
md += `\n상담 인원은 일 시간 ÷ ${base.path.counselor.monthHours}시간을 반일 단위로 올린 값이고, 세 명이 넘으면 여덟 명마다 팀장 웃돈을 더했다. 비용에는 상담 임금·사회보험·성과 몫(입학 지원의 10%)·자리값·LAB 밖 계약 광고·한국 대학 방문이 들어 있다.\n\n`;
md += `## 1. 연도별 매출과 영업이익(EBITDA) — 4실 직영(시장 몫 방식)\n\n| 가정 | 연도 | 매출 | 영업이익 | LAB 교실 | PATH | LAB 온라인 | PULSE 광고 | WORLD | SHIFT | 회사 공통비 | 연말 학생 | 연말 현금 |\n|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n`;
for (const s of scenarioNames) for (const y of [2026, 2027, 2028, 2029]) {
  const v = summaries[s].years[y];
  md += `| ${s} | ${y}${y === 2026 ? '(10~12월)' : ''} | ${won(v.revenue)} | ${won(v.ebitda)} | ${won(v.lab.revenue)} / ${won(v.lab.profit)} | ${won(v.path.revenue)} / ${won(v.path.profit)} | ${won(v.online.revenue)} / ${won(v.online.profit)} | ${won(v.pulseAds.revenue)} / ${won(v.pulseAds.profit)} | ${won(v.world.revenue)} / ${won(v.world.profit)} | ${won(v.shift.revenue)} / ${won(v.shift.profit)} | −${won(v.company.cost)} | ${Math.round(v.endStudents)}명 | ${won(v.endCash)} |\n`;
}
md += `\n사업 칸은 「매출 / 이익」이다. 이익은 그 사업의 직접 비용만 뺀 값이고, 회사 공통비(대표 생활비 포함)는 따로 뺐다. 영업이익은 예비비 3%까지 뺀 값이다. PULSE·SHIFT는 계획 고객 수에 보수 25% · 기본 50% · 상방 100%를 곱했다.\n\n`;
md += `### 메인(LAB 교실 + PATH)만 따로 — PULSE·SHIFT·WORLD가 0원이어도 회사가 서는가\n\n| 가정 | 2027 | 2028 | 2029 |\n|---|---:|---:|---:|\n`;
for (const s of scenarioNames) {
  const ys = summaries[s].years;
  md += `| ${s} | ${[2027, 2028, 2029].map((y) => won(ys[y].lab.profit + ys[y].path.profit - ys[y].company.cost)).join(' | ')} |\n`;
}
md += `\nLAB 교실 이익 + PATH 이익 − 회사 공통비(예비비 제외). 4실 직영 기준.\n\n`;
md += `### 2028년 직접 이익에서 서브가 차지하는 몫\n\n| 가정 | LAB 교실 | PATH | LAB 온라인 | PULSE 광고 | WORLD | SHIFT | PULSE 광고·SHIFT 몫 | 온라인·WORLD까지 더한 몫 |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|\n`;
for (const s of scenarioNames) { const v = subShare[s]; md += `| ${s} | ${won(v.lab)} | ${won(v.path)} | ${won(v.online)} | ${won(v.pulse)} | ${won(v.world)} | ${won(v.shift)} | ${pct(v.subShare)} | ${pct(v.subOnlineShare)} |\n`; }
md += `\n## 2. 현금과 손익분기 — 4실 직영\n\n| 가정 | 가장 낮은 현금 | 그 달 | 필요 자금(투자·차입) | 계속 흑자가 되는 첫 달 | LAB 교실 첫 흑자 달 | 3실을 연 달 | 4실을 연 달 | 한국 담당자 채용 |\n|---|---:|---|---:|---|---|---|---|---|\n`;
for (const s of scenarioNames) {
  const sm = summaries[s]; const r = results[s];
  md += `| ${s} | ${won(sm.minCash)} | ${sm.minCashMonth} | ${won(needFunding(sm))} | ${sm.firstPositive || '기간 안에 없음'} | ${sm.labFirstProfit || '기간 안에 없음'} | ${r.v23AddMonths[0] || '기간 안에 없음'} | ${r.v23AddMonths[1] || '기간 안에 없음'} | ${r.leadFrom || '기간 안에 없음'} |\n`;
}
md += `\n필요 자금은 가장 낮은 가용 현금이 0 아래로 내려간 만큼에 여유 ${won(base.funding.expansionBuffer.safetyKRW)}을 더한 값이다. 공사·비품 ${mnt(base.lab.stages.v23.capexMNT)}(옛 81평 4실안 조사 기준 계획) · 77평 보증금 ${base.lab.stages.v23.depositMonths}달 · 임대 월 ${mnt(base.lab.stages.v23.rentFixedMNT)}(08-01 기록) · 몽골 법인 출자 ${won(base.funding.mongoliaFdiUSD * base.fx.krwPerUsd)}(10만 100달러) 기준.\n`;
md += `\nLAB 손익분기(기본 가정, 학생 수): 4실 직영 ${n1(bepDetail.v23.students)}명(반 평균 ${n1(bepDetail.v23.classSize)}명에서, 학생 1명 월 매출 ${mnt(bepDetail.v23.revPer)}, 학생당 변동비 ${mnt(bepDetail.v23.varPer)}). 정원(실용): 2실 ${n1(capDetail.v23r2)}명 · 3실 ${n1(capDetail.v23r3)}명 · 4실 ${n1(capDetail.v23r4)}명(설계 384석, 학생이 적을 때 반이 덜 차는 것을 반영).\n`;
md += `\n### 2-2. 비교: D안(첫해 기존 기관 안 SYNK반)\n\n| 가정 | 2027 영업이익 | 2028 | 2029 | 가장 낮은 현금(달) | SYNK반 교실 3개 | 직영 이전 | 교실 4개 |\n|---|---:|---:|---:|---:|---|---|---|\n`;
for (const s of scenarioNames) { const d = dPlan[s]; md += `| ${s} | ${won(d.sum.years[2027].ebitda)} | ${won(d.sum.years[2028].ebitda)} | ${won(d.sum.years[2029].ebitda)} | ${won(d.sum.minCash)} (${d.sum.minCashMonth}) | ${d.res.hostAddFrom || '없음'} | ${moveText(d.res.fdi)} | ${d.res.s2Start || '기간 안에 없음'} |\n`; }
const gateCheck = Object.fromEntries(scenarioNames.map((s) => { const g = summarize(run(base, s, DPLAN)); const n = summarize(run(base, s, { ...DPLAN, noGate: true })); const z = summarize(run(base, s, { labMode: 'hosted' })); const pick = (x) => ({ minCash: x.minCash, minCashMonth: x.minCashMonth, ebitda2029: x.years[2029].ebitda, endCash2029: x.years[2029].endCash }); const cf = summarize(run(base, s, { labMode: null, partnerMode: true, royaltyRate: 0.1, stopRule: false, freezePay: true, noMove: true })); return [s, { gate: pick(g), stopOnly: pick(n), none: pick(z), cFrozen: pick(cf) }]; }));
const juneOf = (r) => { const rs = r.rows; const jun = rs.find((x) => x.m === '2027-06'); const h1 = rs.filter((x) => x.m >= '2027-01' && x.m <= '2027-06'); const q2 = rs.filter((x) => x.m >= '2027-04' && x.m <= '2027-06'); return { cash: jun.cash.free, krH1: h1.reduce((a, x) => a + x.online.revenue + x.pulse.revenue + x.shift.revenue, 0), pusAvg: q2.reduce((a, x) => a + x.pulse.revenue + x.shift.revenue, 0) / q2.length }; };
const noDigitalInp = clone(base); noDigitalInp.shift.digital.sales = 0;
const juneCheck = { base: juneOf(dPlan['기본'].res), noDigital: juneOf(run(noDigitalInp, '기본', DPLAN)) }; // 6월 점검은 D안의 개원 관문
const noStop = Object.fromEntries(scenarioNames.map((s) => { const r = run(base, s, { labMode: 'hosted' }); return [s, summarize(r)]; }));
md += `\nD안 개원 관문(2027-06 점검에서 수요 증거가 모자라면 처음부터 C안): ${scenarioNames.map((s) => `${s} ${gateCheck[s].gate.minCash === gateCheck[s].stopOnly.minCash ? '통과' : `걸림 → 가장 낮은 현금 ${won(gateCheck[s].stopOnly.minCash)}(관문 없이) → ${won(gateCheck[s].gate.minCash)}(관문)`}`).join(' · ')}.\n`;
md += `\nD안을 멈춤 규칙 없이 그대로 갔다면 가장 낮은 현금: ${scenarioNames.map((s) => `${s} ${won(noStop[s].minCash)}(${noStop[s].minCashMonth})`).join(' · ')}.\n`;
const movedS = scenarioNames.filter((s) => dPlan[s].res.fdi && dPlan[s].res.fdi.moved);
md += `\nD안의 직영 이전 기준: 교실 3개가 차고(정원 85% 두 달), 가용 현금 ≥ 「출자 ${won(base.funding.mongoliaFdiUSD * base.fx.krwPerUsd)}(10만 100달러)과 공사·보증금·첫 석 달 고정비 가운데 큰 쪽」 + 한국 고정비 ${base.funding.expansionBuffer.krMonths}달 치 + 여유 ${won(base.funding.expansionBuffer.safetyKRW)}. ${movedS.length ? movedS.map((s) => `${s} 가정은 ${dPlan[s].res.fdi.month}에 ${won(dPlan[s].res.fdi.needKRW)}이 필요했다`).join(', ') + '.' : ''} ${scenarioNames.filter((s) => !movedS.includes(s)).join('·')} 가정은 기간 안에 이 기준에 닿지 않는다.\n\n`;
md += `D안 쪽 LAB 손익분기(기본 가정, 학생 수): SYNK반 ${n1(bepDetail.host.students)}명 · 직영 1단계 ${n1(bepDetail.s1.students)}명 · 2단계 ${n1(bepDetail.s2.students)}명(반 평균 ${n1(bepDetail.host.classSize)} · ${n1(bepDetail.s1.classSize)} · ${n1(bepDetail.s2.classSize)}명에서). 학생 1명 월 매출 ${mnt(bepDetail.s1.revPer)}, 학생당 변동비 ${mnt(bepDetail.s1.varPer)}(SYNK반은 공간 사용료를 더해 ${mnt(bepDetail.host.varPer)}), 월 고정비(원장 2반 반영) SYNK반 ${mnt(bepDetail.host.fixedAdj)} · 1단계 ${mnt(bepDetail.s1.fixedAdj)} · 2단계 ${mnt(bepDetail.s2.fixedAdj)}. 가격·비용은 2027년 값, 기간권 비중은 자리 잡은 뒤 값.\n\n`;
md += `D안 쪽 정원(실용): SYNK반 교실 2개 ${n1(capDetail.host2)}명 · 3개 ${n1(capDetail.host3)}명 · 직영 1단계 ${n1(capDetail.s1)}명 · 2단계 ${n1(capDetail.s2)}명(학생이 적을 때 반이 덜 차는 것을 반영).\n\n`;
md += `학생 1명당 경제(LAB·PATH)는 0절 끝 표에 있다.\n\n`;
md += `### 2-3. 비교: A안(처음부터 직영 교실 2개)\n\n| 가정 | 2027 영업이익 | 2028 | 2029 | 가장 낮은 현금(달) | 2027-07 출자 시점 |\n|---|---:|---:|---:|---:|---|\n`;
for (const s of scenarioNames) { const a = aPlan[s]; md += `| ${s} | ${won(a.sum.years[2027].ebitda)} | ${won(a.sum.years[2028].ebitda)} | ${won(a.sum.years[2029].ebitda)} | ${won(a.sum.minCash)} (${a.sum.minCashMonth}) | ${moveText(a.res.fdi)} |\n`; }
md += `\nA안은 2027-07에 출자 + 한국 고정비 석 달 + 여유를 한 번에 갖춰야 한다. 모자란 돈은 투자·차입으로 채워야 하고, 이 표는 그 돈이 들어왔다고 보고 계산을 이어 간 값이다.\n\n`;
md += `## 2-4. D안을 고를 때: 기관과의 거래 모양(세 가정)\n\n같은 D안에서 기관에 주는 돈의 모양만 바꿨다. 「기관이 받는 돈」은 기본 가정 2028년의 수강료 몫 + PATH 몫이고, 「교실 시간당」은 그 돈을 정규 세 시간대에 쓴 교실 시간으로 나눈 값이다.\n\n| 거래 모양 | 손익분기(기본, 명) | 기본 2029 영업이익 | 기본 가장 낮은 현금(달) | 보수 가장 낮은 현금(달, 관문 없이) · 멈춤 | 상방 2027~28 누적 영업이익 | 상방 직영 이전 | 기관이 받는 돈 2028(기본, 수강료 + PATH 몫) | 교실 시간당 |\n|---|---:|---:|---:|---:|---:|---|---:|---:|\n`;
for (const d of dealCompare) { const b = d.bySc['기본']; const lo = d.bySc['보수']; const hi = d.bySc['상방']; md += `| ${d.label} | ${d.bep === null ? '—' : n1(d.bep)} | ${won(b.ebitda2029)} | ${won(b.minCash)} (${b.minCashMonth}) | ${won(lo.minCash)} (${lo.minCashMonth})${lo.stopFrom ? ` · ${lo.stopFrom} C안` : ''} | ${won(hi.cum2728)} | ${moveText(hi.fdi)} | ${b.hostHours2028 ? won(b.hostIncome2028MNT / base.fx.mntPerKrw) : '—'} | ${b.hostHours2028 ? `${Math.round(b.hostIncome2028MNT / b.hostHours2028).toLocaleString('ko-KR')}₮` : '—'} |\n`; }
md += `\n`;
md += `학생 수별로 기관이 받는 돈(₮/월, 학생 1명 수강료 + 회화 추가 평균 ${Math.round(hostIncomeTable[0].perStudent).toLocaleString('ko-KR')}₮, 2027년 값):\n\n| 학생 | 교실 | 계단형 30·25·20% | 단일 30% | 단일 35% | 단일 40% | 고정 임대 교실당 300만₮ | 계단형의 교실 시간당 |\n|---:|---:|---:|---:|---:|---:|---:|---:|\n`;
for (const h of hostIncomeTable) md += `| ${h.students}명 | ${h.rooms} | ${mnt(h.tiers)} | ${mnt(h.flat30)} | ${mnt(h.flat35)} | ${mnt(h.flat40)} | ${mnt(h.fixed300)} | ${Math.round(h.tiers / h.hours).toLocaleString('ko-KR')}₮ |\n`;
md += `\n`;
md += `## 3. 민감도(4실 직영 기본 가정에서 하나만 바꿈 · D안·A·B·C안 줄은 그 판으로)\n\n| 바꾼 것 | 2028 영업이익 | 2029 영업이익 | 2027~29 누적 | 가장 낮은 현금(달) | 필요 자금 | 2029 연말 현금 | 직영 이전·실 늘리기 |\n|---|---:|---:|---:|---:|---:|---:|---|\n`;
for (const r of sensRows) md += `| ${r.label} | ${won(r.ebitda2028)} | ${won(r.ebitda2029)} | ${won(r.cum)} | ${won(r.minCash)} (${r.minCashMonth}) | ${won(r.need)} | ${won(r.endCash2029)} | ${r.roomsFull ? `4실 ${r.roomsFull}` : (r.s2Start ? `교실 4개 ${r.s2Start}` : moveText(r.fdi))} |\n`;
md += `\n## 4. 4실 직영 기본 가정의 달별 흐름(주요 달)\n\n| 달 | 단계 | 교실 | 학생 | 반(평균) | LAB 매출 | LAB 이익 | PATH 매출 | LAB 온라인 | PULSE·WORLD | SHIFT | 영업이익 | 현금 | 대표 시간 |\n|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n`;
for (const r of results['기본'].rows) {
  if (!['01', '04', '07', '09', '12'].includes(r.m.slice(5)) && r.m !== '2026-10') continue;
  md += `| ${r.m} | ${r.lab.stage || '-'} | ${r.lab.rooms || '-'} | ${Math.round(r.lab.students)} | ${r.lab.classes}${r.lab.classes ? ` (${n1(r.lab.classSize)})` : ''} | ${won(r.labKRW.revenue)} | ${won(r.labKRW.profit)} | ${won(r.pathKRW.revenue)} | ${won(r.online.revenue)} | ${won(r.pulse.revenue)} | ${won(r.shift.revenue)} | ${won(r.ebitdaKRW)} | ${won(r.cash.free)} | ${Math.round(r.hours.total)}h |\n`;
}
md += `\n단계: pre 준비(77평 공사·채용) · v23 4실 24반 직영(교실 칸은 연 실 수). 반(평균)은 평일 + 토요일 반 수와 반 평균 인원.\n`;
md += `\n### 사람을 데려오는 마케팅(4실 직영 기본)\n\n그달 LAB에 오려는 사람 = 울란바토르 준비 인원 ÷ 12 × LAB이 잡는 몫 × 계절. 그 가운데 ${pct(base.market.paidShare)}가 광고로 온다고 보고 광고비 = 그 수 × 광고로 학생 1명을 데려오는 값(기본 ${base.lab.acquisition.cacMNT['기본'].toLocaleString('ko-KR')}₮)으로 붙였다. 문의 가운데 ${n1(base.lab.acquisition.leadToStudent['기본'] * 100)}%(체험 40% × 등록 25%)가 등록한다고 보고 필요한 문의 수를 같이 적었다. 정원이 차면 그 달에 받지 못한 사람은 놓친 것으로 세고(다음 달로 넘기지 않음) 광고를 그만큼 쓰지 않는다.\n\n| 달 | 오려는 사람 | 받은 등록 | 놓친 사람 | 그중 광고 | 광고비 | 필요한 문의(전체) |\n|---|---:|---:|---:|---:|---:|---:|\n`;
for (const r of results['기본'].rows) {
  if (!['2027-09', '2027-12', '2028-03', '2028-07', '2028-09', '2029-03', '2029-09'].includes(r.m)) continue;
  md += `| ${r.m} | ${n1(r.lab.marketNew)} | ${n1(r.lab.newStudents)} | ${n1(r.lab.waitlist)} | ${n1(r.lab.paidNew)} | ${mnt(r.lab.adBudget)} | ${Math.round(r.lab.leadsNeeded)} |\n`;
}
md += `\n**LAB이 잡는 몫을 손잡이로 보면(4실 직영):**\n\n| 경우 | 2028 영업이익 | 2029 영업이익 | 2028 연말 학생 | 가장 낮은 현금(달) | 필요 자금 | 3실 · 4실을 연 달 |\n|---|---:|---:|---:|---:|---:|---|\n`;
for (const a of adRows) md += `| ${a.label} | ${won(a.ebitda2028)} | ${won(a.ebitda2029)} | ${Math.round(a.students2028)}명 | ${won(a.minCash)} (${a.minCashMonth}) | ${won(a.need)} | ${a.rooms3 || '없음'} · ${a.rooms4 || '없음'} |\n`;
md += `\n## 5. 직원 한 사람이 받는 돈(4실 직영 기본 가정, ₮)\n\n강사 기본급은 반 하나에 ${n1(base.lab.staff.hoursPerClass)}시간 × 시급 ${base.lab.staff.teacherHourly.toLocaleString('ko-KR')}₮ = ${Math.round(base.lab.staff.hoursPerClass * base.lab.staff.teacherHourly).toLocaleString('ko-KR')}₮이고(2028-09부터 해마다 8% 오름), 두 반을 맡으면 ${Math.round(2 * base.lab.staff.hoursPerClass * base.lab.staff.teacherHourly).toLocaleString('ko-KR')}₮이다. 아래 성과급은 그달 인원(강사·운영·댄스)으로 똑같이 나눈 평균이다.\n\n| 달 | 단계 | 학생 | 손익분기 대비 | 인원(반일은 0.5) | 기본 성과급(1인) | 현장 보너스(1인 평균) | 이익 나눔(1인 평균) | 이익 나눔 비율 | 두 반 강사 합계 |\n|---|---|---:|---:|---:|---:|---:|---:|---:|---:|\n`;
for (const r of results['기본'].rows) {
  if (!['2027-12', '2028-06', '2028-12', '2029-06', '2029-11'].includes(r.m)) continue;
  const d = r.lab.incentiveDetail; const hc = d.headcount || 1;
  const wm = r.m >= '2029-09' ? 1.08 * 1.08 : (r.m >= '2028-09' ? 1.08 : 1);
  const teacher = 2 * base.lab.staff.hoursPerClass * base.lab.staff.teacherHourly * wm + d.baseEach + d.fieldBonus / hc + d.pool / hc;
  md += `| ${r.m} | ${r.lab.stage} | ${Math.round(r.lab.students)} | ${n1(d.ratio)}배 | ${hc} | ${Math.round(d.baseEach).toLocaleString('ko-KR')} | ${Math.round(d.fieldBonus / hc).toLocaleString('ko-KR')} | ${Math.round(d.pool / hc).toLocaleString('ko-KR')} | ${Math.round(d.rate * 100)}% | ${Math.round(teacher).toLocaleString('ko-KR')} |\n`;
}
md += `\n## 6. 대표 시간(4실 직영)\n\n대표 고정 일(경영·WORLD·콘텐츠·회화·LAB·PATH)이 월 ${base.company.founderHoursCap}시간을 넘는 달에는 넘친 시간을 사람에게 맡기고 그 값을 회사 공통비에 넣었다(울란바토르 제작팀 시급, 이주 전에는 한국 프리랜서).\n\n`;
for (const s of scenarioNames) {
  const over = results[s].rows.filter((r) => r.hours.fixedOver > 1e-6);
  const cost = over.reduce((a, r) => a + r.company.overflow, 0);
  md += `- ${s}: ${over.length ? `${over.length}달, 넘친 시간 합 ${Math.round(over.reduce((a, r) => a + r.hours.fixedOver, 0))}시간, 맡긴 값 ${won(cost)}` : '없음'}\n`;
}

const leadCheck = Object.fromEntries(scenarioNames.map((s) => { const rs = results[s].rows.filter((r) => r.m >= '2027-04' && r.m <= '2027-06'); return [s, rs.reduce((a, r) => a + r.pulse.ads + r.shift.revenue, 0) / (rs.length || 1)]; }));
const out = { asOf: base.asOf, main: '4실 직영', checks,
  planUnits, countryFacts, widest, planChecks, planHorizon: planHz, opPlan: base.opPlan || null,
  opPlans: opPlans && Object.fromEntries(planNames.map((p) => [p, { countries: base.plans[p].countries, years: opPlans[p].years, minCash: opPlans[p].minCash, minCashMonth: opPlans[p].minCashMonth, need: opPlans[p].need, needMonth: opPlans[p].needMonth }])),
  plans: Object.fromEntries(planNames.map((p) => [p, { countries: base.plans[p].countries, years: plans[p].years, minCash: plans[p].minCash, minCashMonth: plans[p].minCashMonth, need: plans[p].need, needFloor: plans[p].needFloor, needAtOpen: plans[p].needAtOpen, needMonth: plans[p].needMonth, monthly: plans[p].rows.map((r) => ({ m: r.m, revenue: r.revenue, ebitda: r.ebitda, cash: r.cash, byC: Object.fromEntries(r.parts.map((q) => [q.c, { students: q.r.lab.students, labProfit: q.r.labKRW.profit, pathProfit: q.r.pathKRW.profit, contracts: q.r.path.admissions }])) })) }])),
  dPlan: Object.fromEntries(scenarioNames.map((s) => [s, { summary: dPlan[s].sum, fdi: dPlan[s].res.fdi, s2Start: dPlan[s].res.s2Start, hostAddFrom: dPlan[s].res.hostAddFrom, hostAddMonths: dPlan[s].res.hostAddMonths, directSwitch: dPlan[s].res.directSwitch, leadFrom: dPlan[s].res.leadFrom, ...(s === '기본' ? { rows: dPlan[s].res.rows } : {}) }])),
  funding: Object.fromEntries(scenarioNames.map((s) => [s, { need: needFor(results[s], summaries[s]), needCashFloor: needFunding(summaries[s]), needAtOpen: results[s].fdi && results[s].fdi.gap, needMonth: results[s].fdi && results[s].fdi.month, minCash: summaries[s].minCash, minCashMonth: summaries[s].minCashMonth, v23AddMonths: results[s].v23AddMonths }])), leadCheck, noStop: Object.fromEntries(scenarioNames.map((s) => [s, { minCash: noStop[s].minCash, minCashMonth: noStop[s].minCashMonth, endCash2029: noStop[s].years[2029].endCash }])), bep: bepDetail, capacity: capDetail, ltv: ltvBase, units, market: marketRows, pathYears: pathRows, subShare, summaries, sensitivity: sensRows, adLever: adRows, dealCompare, gateCheck, hostIncomeTable, juneCheck, opGate,
  aPlan: Object.fromEntries(scenarioNames.map((s) => [s, { summary: aPlan[s].sum, fdi: aPlan[s].res.fdi, s2Start: aPlan[s].res.s2Start }])),
  scenarios: Object.fromEntries(scenarioNames.map((s) => [s, { s2Start: results[s].s2Start, leadFrom: results[s].leadFrom, fdi: results[s].fdi, hostAddFrom: results[s].hostAddFrom, directSwitch: results[s].directSwitch, rows: results[s].rows }])) };
writeFileSync(path.join(here, 'results.json'), JSON.stringify(out, null, 1));
writeFileSync(path.join(here, 'results.md'), md);
console.log(md);
if (checks.length) { console.error('검산 실패:', checks.length); process.exitCode = 1; }
