// SYNK BM — 10-28 시간표안 비교
// 실행: node docs/유지비_BM/BM_통합설계_20261018/비교_시간표안.mjs
// 결과: 같은 폴더의 시간표안_비교.md
// 10-28 유호님 「16명으로 바꿔」로 본 계산(inputs.mjs 기본)이 10-28 시간표가 됐다. 이 파일은 그 기본을 08-01 구조(4실 24반 · 토요일반 포함)와
// 같은 계산 규칙(run)으로 견준다. 08-01 구조는 아래 as0801()이 기본을 복사해 되돌려 만든다.

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import base, { space0801, studioSpace } from './inputs.mjs';
import { run, summarize, labBep, labCapacityV23 } from './model.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const clone = (o) => JSON.parse(JSON.stringify(o));
const MAIN = { labMode: 'full4', stopRule: false }; // model.mjs 본 결과와 같은 방식(4실 직영, 멈춤 규칙 없음)

// 스튜디오 크기(공간 설계 문서 기준 — 학생 1명당 4㎡ · 앞 강사 자리 2m · 뒤 1.2m · 양옆 0.5m, 거울은 앞벽 폭 × 2.4m)
//   16명: 11.2m × 9m = 100.8㎡ · 25명: 13.2m × 11m = 145.2㎡(10-02 열린 A+B와 같은 크기). 넓이·월세·공사비 식은 inputs.mjs의 studioSpace 하나다
const STUDIO = { 16: { m2: 100.8, mirrorM2: 9 * 2.4 }, 25: { m2: 145.2, mirrorM2: 11 * 2.4 } };
const V0801 = { weekendShare: 1 / 3, satSlotsPerRoom: 2, beauty: 1_260_000, vocal: 1_260_000, satelliteHeads: 3 }; // 08-01 반편성 v2.3 · 급여 인센티브 정본 v3

// ───────── 바꾼 판 만들기 ─────────
function as0801(inp) { // 08-01 4실 24반: 토요일 정규(정규 학생의 1/3, 평일과 같은 값) · 위성 강사 셋(댄스·뷰티·보컬) · 77평(A실 25평 큰 방에서 댄스)
  const L = inp.lab; const V = L.stages.v23;
  L.weekendShare = V0801.weekendShare; V.satSlotsPerRoom = V0801.satSlotsPerRoom; V.slotsPerRoom = V.weekdaySlotsPerRoom + V0801.satSlotsPerRoom;
  Object.assign(L.staff.v23, { beauty: V0801.beauty, vocal: V0801.vocal, satelliteHeads: V0801.satelliteHeads });
  Object.assign(V, { areaM2: space0801.areaM2, rentFixedMNT: space0801.rentFixedMNT, capexMNT: space0801.capexMNT }); delete V.studioM2;
  return inp;
}
function noSaturday(inp) { // 토요일 정규(토 90분 + 평일 녹화) 없음
  const L = inp.lab; const V = L.stages.v23;
  L.weekendShare = 0; V.satSlotsPerRoom = 0; V.slotsPerRoom = V.weekdaySlotsPerRoom;
  return inp;
}
function withStudio(inp, size) { // 스튜디오 크기만 바꾼다(A실은 보통 교실)
  const S = STUDIO[size]; const sp = studioSpace(S.m2, S.mirrorM2);
  Object.assign(inp.lab.stages.v23, { areaM2: sp.areaM2, rentFixedMNT: sp.rentFixedMNT, capexMNT: sp.capexMNT, studioM2: sp.studioM2 });
  return inp;
}
function withFifthClass(inp) { // 참고: 4실이 다 차면 스튜디오 빈 시간(코어 시간)에 접이 책상을 펴서 다섯째 반을 연다
  inp.lab.stages.v23.rooms = 5; // 넓히는 규칙은 같다(연 실의 정원 85%를 두 달 넘기면 한 실 더). 접이 책상 16세트 값은 넣지 않았다
  return inp;
}

// 지금 기본이 10-28 구조인지 확인 — 아니면 문서 머리에 알린다
const B0 = base.lab; const S16 = studioSpace(STUDIO[16].m2, STUDIO[16].mirrorM2);
const baseIs1028 = B0.weekendShare === 0 && B0.stages.v23.satSlotsPerRoom === 0 && B0.staff.v23.beauty === 0 && B0.staff.v23.vocal === 0 && B0.stages.v23.areaM2 === S16.areaM2;

const plans = [
  { key: 'v0', label: '08-01 구조 (4실 24반 · 토요일반 포함)', inp: as0801(clone(base)) },
  { key: 'v1', label: '08-01 구조에서 토요일반만 뺌', inp: noSaturday(as0801(clone(base))) },
  { key: 'v2', label: '**지금 기본** (10-28 · 16명 스튜디오)', inp: clone(base) },
  { key: 'v3', label: '참고 · 25명 스튜디오', inp: withStudio(clone(base), 25) },
  { key: 'v4', label: '참고 · 스튜디오 다섯째 반', inp: withFifthClass(clone(base)) },
];

// ───────── 돌리기 ─────────
const safety = base.funding.expansionBuffer.safetyKRW;
const needFunding = (sm) => Math.max(0, -sm.minCash) + (sm.minCash < 0 ? safety : 0); // model.mjs와 같은 규칙
const needFor = (res, sm) => Math.max(needFunding(sm), res && res.fdi && res.fdi.gap > 0 && !res.fdi.moved ? res.fdi.gap : 0);
const scenarioNames = Object.keys(base.scenarios);
for (const p of plans) {
  const V = p.inp.lab.stages.v23;
  p.capPractical = labCapacityV23(p.inp, V.rooms * V.weekdaySlotsPerRoom, V.rooms * V.satSlotsPerRoom);
  p.capDesign = labCapacityV23(p.inp, V.rooms * V.weekdaySlotsPerRoom, V.rooms * V.satSlotsPerRoom, V.seatsPerClass);
  p.bep = labBep(p.inp, p.inp.scenarios['기본'], 'v23').students;
  p.by = {};
  for (const s of scenarioNames) {
    const res = run(p.inp, s, MAIN); const sm = summarize(res);
    p.by[s] = { res, sm, need: needFor(res, sm) };
  }
}

// ───────── 표 ─────────
const fx = base.fx.mntPerKrw;
const krw = (x) => { const a = Math.abs(x); const sg = x < 0 ? '−' : ''; return a >= 1e8 ? `${sg}${(a / 1e8).toFixed(2)}억원` : `${sg}${Math.round(a / 1e4).toLocaleString('ko-KR')}만원`; };
const mnt2krw = (x) => krw(x / fx);
const n0 = (x) => Math.round(x).toLocaleString('ko-KR');
const n1 = (x) => (Math.round(x * 10) / 10).toLocaleString('ko-KR');
const rooms = (r) => (r.v23AddMonths.length ? r.v23AddMonths.map((m, i) => `${i + 3}실 ${m}`).join(' · ') : '2실 그대로');
const B = (p) => p.by['기본'];
const [v0, v1, v2, v3, v4] = plans;
const V = (p) => p.inp.lab.stages.v23;
const d = (a, b) => b - a;
const sgnKrw = (x) => `${x >= 0 ? '+' : ''}${krw(x)}`;
const waitlist = (p, y) => B(p).res.rows.filter((r) => r.m.startsWith(`${y}-`)).reduce((a, r) => a + (r.lab.waitlist || 0), 0);
const satCost = base.lab.staff.v23.satClassCost; const wkdCost = base.lab.staff.hoursPerClass * base.lab.staff.teacherHourly;

let md = '';
md += `<!-- 이 문서는 비교_시간표안.mjs가 만든다. 고칠 때는 그 파일을 고치고 다시 돌린다(node docs/유지비_BM/BM_통합설계_20261018/비교_시간표안.mjs) -->\n`;
md += `# LAB 시간표안 비교 — 2026-10-28\n\n`;
md += `> **상태: 10-28 유호님 「16명으로 바꿔」로 본 계산(지금 기본)이 이 시간표가 됐다.** 토요일 정규 없음 · 위성은 댄스(16명 전용 스튜디오)·한국어 회화·글로벌 영어 · 뷰티·보컬 없음. 이 문서는 지금 기본을 08-01 구조(4실 24반 · 토요일반 포함)와 같은 계산 규칙으로 견준다. 시장·가격·재원율·광고비 같은 나머지 가정은 모두 같다. 넓이·월세·공사비는 매물이 없어 어림한 값이다.\n\n`;
if (!baseIs1028) md += `> ⚠ inputs.mjs의 기본이 10-28 구조(토요일 정규 없음 · 뷰티·보컬 없음 · 16명 스튜디오)와 다르다. 「지금 기본」 열은 inputs.mjs 그대로다.\n\n`;

md += `## 1. 무엇이 바뀌었나\n\n`;
md += `| | 08-01 구조 | 지금 기본(10-28) |\n|---|---|---|\n`;
md += `| 평일 정규 | 11:00 · 14:00 · 15:30 · 18:00 × 4실 = 16반 | 11:00 · 13:45 · 15:30 · 18:15 × 4실 = 16반(사이 15분) |\n`;
md += `| 토요일 정규 | 11:00 · 14:00 × 4실 = 8반, 정규 학생의 3분의 1, 평일과 같은 값 | 없음 |\n`;
md += `| 라이트(주 2~3회) | 학생의 20%, 평일 좌석 반 개 | 같음(저녁 C·D실 월수금반·화목토반) |\n`;
md += `| 위성 | 10:00 · 13:00 · 17:00 — 댄스(A실) · 뷰티 · 보컬 · 회화 · 영어 | 10:00 · 12:45 · 17:15 — 댄스(스튜디오) · 한국어 회화 · 글로벌 영어 |\n`;
md += `| 위성 강사 | 댄스 315만₮ · 뷰티 126만₮ · 보컬 126만₮ | 댄스 315만₮만(한국어 회화는 유호님 몫, 영어는 두 판 모두 계산 밖) |\n`;
md += `| 공간 | ${n1(V(v0).areaM2)}㎡(77평), A실 25평 큰 방에서 댄스 | A실을 13평 보통 교실로 줄이고 16명 스튜디오 ${n1(STUDIO[16].m2)}㎡를 더함 → ${n1(V(v2).areaM2)}㎡(${n1(V(v2).areaM2 / 3.3058)}평, +${n1(V(v2).areaM2 - V(v0).areaM2)}㎡) |\n`;
md += `| 월세 | ${mnt2krw(V(v0).rentFixedMNT)} (1,500만₮, 08-01 기록) | ${mnt2krw(V(v2).rentFixedMNT)} (같은 ㎡당 값, +${mnt2krw(V(v2).rentFixedMNT - V(v0).rentFixedMNT)}) |\n`;
md += `| 공사·비품 | ${mnt2krw(V(v0).capexMNT)} | ${mnt2krw(V(v2).capexMNT)} (+${mnt2krw(V(v2).capexMNT - V(v0).capexMNT)} — 늘어난 넓이 × 옛 6안 ㎡당 실내공사비 + 넓어진 댄스 바닥·거울, 견적 아님) |\n\n`;

md += `## 2. 결과(기본 가정)\n\n`;
md += `| | ${plans.map((p) => p.label).join(' | ')} |\n|---|${plans.map(() => '---:').join('|')}|\n`;
const row = (name, f) => { md += `| ${name} | ${plans.map(f).join(' | ')} |\n`; };
row('정원(설계 16석, 실을 다 열었을 때)', (p) => `${n0(p.capDesign)}명`);
row('정원(실용, 반 평균 13명까지)', (p) => `${n0(p.capPractical)}명`);
row('LAB 손익분기', (p) => `${n1(p.bep)}명`);
row('실을 더 여는 달', (p) => rooms(B(p).res));
for (const y of [2027, 2028, 2029]) row(`${y} 연말 학생`, (p) => `${n0(B(p).sm.years[y].endStudents)}명`);
row('2029 정원이 차서 못 받은 등록', (p) => `${n0(waitlist(p, 2029))}명`);
for (const y of [2028, 2029]) row(`${y} LAB 매출`, (p) => krw(B(p).sm.years[y].lab.revenue));
for (const y of [2028, 2029]) row(`${y} LAB 이익`, (p) => krw(B(p).sm.years[y].lab.profit));
for (const y of [2027, 2028, 2029]) row(`${y} 회사 영업이익`, (p) => krw(B(p).sm.years[y].ebitda));
row('가장 낮은 현금', (p) => `${krw(B(p).sm.minCash)} (${B(p).sm.minCashMonth})`);
row('필요 자금(투자·차입)', (p) => krw(B(p).need));
md += `\n`;

md += `### 보수 · 상방 가정에서\n\n`;
md += `| | 가정 | 2029 회사 영업이익 | 가장 낮은 현금 | 필요 자금 |\n|---|---|---:|---:|---:|\n`;
for (const p of [v0, v1, v2]) for (const s of scenarioNames) { const b = p.by[s]; md += `| ${p.label} | ${s} | ${krw(b.sm.years[2029].ebitda)} | ${krw(b.sm.minCash)} (${b.sm.minCashMonth}) | ${krw(b.need)} |\n`; }
md += `\n`;

// 차이 나눠 보기(기본, 2029)
const e = (p, y = 2029) => B(p).sm.years[y].ebitda;
md += `## 3. 차이는 어디서 나나(기본 가정 · 2029년 회사 영업이익)\n\n`;
md += `| 단계 | 2029 영업이익 | 바로 앞과 차이 |\n|---|---:|---:|\n`;
md += `| 08-01 구조 | ${krw(e(v0))} | |\n`;
md += `| 토요일반을 뺌 | ${krw(e(v1))} | ${sgnKrw(d(e(v0), e(v1)))} |\n`;
md += `| + 뷰티·보컬을 빼고 16명 스튜디오(A실은 보통 교실) = **지금 기본** | ${krw(e(v2))} | ${sgnKrw(d(e(v1), e(v2)))} |\n`;
md += `| (참고) + 4실이 차면 스튜디오에서 다섯째 반 | ${krw(e(v4))} | ${sgnKrw(d(e(v2), e(v4)))} |\n\n`;

md += `## 4. 읽는 법\n\n`;
md += `- **토요일반을 뺀 것이 가장 크다.** 4실의 실용 정원이 ${n0(v0.capPractical)}명에서 ${n0(v1.capPractical)}명으로 준다. 시장 수요로는 2029년 말 학생이 ${n0(B(v0).sm.years[2029].endStudents)}명이라 08-01 정원은 다 차지 않지만, 토요일반이 없으면 4실이 ${B(v1).res.v23AddMonths[1] || '—'}에 다 열리고 2029년에 꽉 차서 그해 ${n0(waitlist(v1, 2029))}명을 받지 못한다. 또 토요일반 강사비는 반당 약 ${mnt2krw(satCost)}이고 평일반은 약 ${mnt2krw(wkdCost)}이라 절반인데 값은 같아서, 08-01 구조에서 가장 남는 학생이었다. 그 학생이 평일반으로 오면 같은 매출에 강사비가 더 든다.\n`;
md += `- **그런데 토요일반이 그만큼 팔릴지는 확인된 적이 없다.** 토요일 90분 한 번에 평일과 같은 값(1개월권 55만₮)을 내면 대면 수업 시간당 약 8.5만₮로, 시세(1.7만~2만₮)의 네다섯 배다. 유호님도 10-28에 많이 팔리지 않을 가능성이 크다고 봤다. 그렇다면 08-01 구조의 숫자가 처음부터 높게 잡힌 것이고, 지금 기본과 견줄 출발점은 「토요일반만 뺌」 열이다.\n`;
md += `- **지금 기본이 그 출발점과 다른 값은 작다.** 토요일반을 뺀 판에서 뷰티·보컬(월 252만₮)을 빼고 16명 스튜디오의 월세·공사비를 더하면 2029 영업이익이 ${sgnKrw(d(e(v1), e(v2)))} 달라지고, 처음에 필요한 돈은 ${sgnKrw(B(v2).need - B(v1).need)}(스튜디오 공사비·보증금·개원 전 월세) 늘어난다.\n`;
md += `- **2030년부터는 차이가 커질 수 있다.** 시장 수요가 해마다 늘어 학생이 정원을 넘으면, 08-01 구조는 토요일 좌석으로 더 받고 지금 기본은 못 받는다. 이 비교는 2029년까지다.\n`;
md += `- **25명 스튜디오**는 16명보다 넓이가 ${n1(V(v3).areaM2 - V(v2).areaM2)}㎡ 더 들어 2029 영업이익이 ${sgnKrw(d(e(v2), e(v3)))} 달라지고, 공사·비품이 ${mnt2krw(V(v3).capexMNT - V(v2).capexMNT)} 더 든다.\n`;
md += `- **스튜디오 다섯째 반**은 4실이 다 찬 뒤에만 쓰는 손잡이다. 코어 시간에 비는 스튜디오에 접이 책상을 펴서 반을 하나 더 열면 정원이 ${n0(v2.capPractical)}명에서 ${n0(v4.capPractical)}명이 된다(시장 수요가 정원보다 클 때만 효과가 있고, 하루 몇 번 책상을 펴고 접는 수고가 다시 생긴다).\n\n`;

md += `## 5. 넣지 않은 것\n\n`;
md += `- 토요일반을 없앴을 때 아예 오지 않는 사람. 시장 수요를 두 판 모두 같게 두었으니, 토요일반에 오던 사람도 정원이 남는 한 평일반으로 온다고 본 셈이다.\n`;
md += `- 「교실 3 + 스튜디오」로 작게 시작해 4실이 필요할 때 넓히는 길.\n`;
md += `- 토요일 집중반(90분 두 번 · 녹화 없음 · 월 20만₮대)이나 토요일 TOPIK 특강 같은 새 토요일 상품.\n`;
md += `- 댄스가 학생을 데려오거나 오래 다니게 하는 효과(광고비 절감·재원율). 08-01 구조에도 넣지 않았다.\n`;
md += `- 스튜디오 다섯째 반의 접이 책상 16세트 값.\n`;
md += `- 실제 매물의 넓이·월세·공사 견적. 넓이·월세는 08-01 77평 값에 비례로, 공사비는 옛 6안 ㎡당 값으로 어림했다(inputs.mjs 맨 위 space0801 · studioSpace).\n`;

writeFileSync(path.join(here, '시간표안_비교.md'), md);
console.log(md);
