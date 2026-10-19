// SYNK BM 설계안 보고 페이지 — 진출 나라 세 지표 판(10-19 v7: 운영 계획 새 나라 1.5% · 투자 자료 성공 시나리오 10%). 숫자는 모두 results.json·inputs.mjs에서 읽는다
// 사용: node docs/유지비_BM/BM_통합설계_20261018/보고페이지/build_page.mjs <저장소 경로> <출력 html> docs/유지비_BM/BM_통합설계_20261018/보고페이지/검수요약.json
//   출력 html(글꼴을 넣어 약 0.9MB)은 저장소에 넣지 않는다. claude.ai 보고 페이지로 올릴 때만 만든다
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const [repo, outFile, reviewFile] = process.argv.slice(2);
const dir = path.join(repo, 'docs', '유지비_BM', 'BM_통합설계_20261018');
const I = (await import(pathToFileURL(path.join(dir, 'inputs.mjs')).href + `?t=${Date.now()}`)).default;
const R = JSON.parse(readFileSync(path.join(dir, 'results.json'), 'utf8'));
const review = reviewFile && existsSync(reviewFile) ? JSON.parse(readFileSync(reviewFile, 'utf8')) : null;
const require = createRequire(import.meta.url);
const font = require(path.join(repo, 'tools', 'lib', '브랜드폰트.js'));
const css = readFileSync(path.join(here, 'page_css.txt'), 'utf8').replace('${font.면()}', font.면())
  .replace('</style>', `.chart .legend i.p1{border-top:6px solid var(--p1)}.chart .legend i.p2{border-top:6px solid var(--p2)}.chart .legend i.p3{border-top:6px solid var(--p3)}
svg .gb rect{transition:opacity .15s}svg .gb:hover rect,svg .gb:focus rect{opacity:.82}svg .gb:focus{outline:none}
td.nw{white-space:nowrap}
:root{--p1:#7C8794;--p2:#2F7A50;--p3:#3D5FC9}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--p1:#9AA4B0;--p2:#3E9A69;--p3:#6F8BEA}}
:root[data-theme="dark"]{--p1:#9AA4B0;--p2:#3E9A69;--p3:#6F8BEA}
</style>`);

// ── 숫자 표기
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const sign = (x) => (x < 0 ? '−' : '');
const man = (x) => `${sign(x)}${Math.round(Math.abs(x) / 1e4).toLocaleString('ko-KR')}만원`;
const eok = (x) => { if (Math.abs(x) < 1e8) return man(x); const s = (Math.abs(x) / 1e8).toFixed(2).replace(/0$/, '').replace(/\.$/, ''); return `${sign(x)}${s}억원`; };
const eokShort = (x) => eok(x).replace('원', '');
const mnt = (x) => `${sign(x)}${Math.round(Math.abs(x) / 1e4).toLocaleString('ko-KR')}만₮`;
const n0 = (x) => Math.round(x).toLocaleString('ko-KR');
const n1 = (x) => (Math.round(x * 10) / 10).toLocaleString('ko-KR');
const pct = (x) => `${Math.round(x * 100)}%`;
const pct1 = (x) => `${(Math.round(x * 1000) / 10).toLocaleString('ko-KR')}%`;
const pct2 = (x) => `${(Math.round(x * 10000) / 100).toLocaleString('ko-KR')}%`;
// 조사 붙이기(render.mjs와 같은 규칙): jo('베트남', '은', '는') · jo('16.07억원', '이다', '다')
const jo = (w, a, b) => {
  const str = String(w); const t = str.replace(/[^가-힣0-9a-zA-Z]+$/, ''); const ch = t[t.length - 1] || '';
  let bat = false; let rieul = false; const code = ch.charCodeAt(0) - 0xac00;
  if (code >= 0 && code <= 11171) { const jong = code % 28; bat = jong !== 0; rieul = jong === 8; } else if (/[0-9]/.test(ch)) { bat = '013678'.includes(ch); rieul = '178'.includes(ch); }
  if (a === '으로') return str + (bat && !rieul ? '으로' : '로');
  return str + (bat ? a : b);
};
const PC = (prefix, p) => { const c = (R.planChecks || []).find((x) => x.label.startsWith(prefix)); if (!c) throw new Error(`no planCheck ${prefix}`); return c.byPlan[p]; };
const num = (s) => `<span class="num">${s}</span>`;
const yrs = (R.planHorizon && R.planHorizon.years) || [2027, 2028, 2029]; const LY = yrs[yrs.length - 1]; // 세 지표의 해(2027~2030)
const PLANS = Object.keys(R.plans);
const OP = (p, y) => R.opPlans[p].years[y]; const ON = (p) => R.opPlans[p]; // [10-19 확정] 운영 계획(새 나라 유학 1.5%)
const PL = (p, y) => R.plans[p].years[y];
const PN = (p) => R.plans[p];
const CF = (c) => R.countryFacts[c];
const PU = (c) => R.planUnits[c];
const cname = (c) => I.countries[c].name;
const DY = (s, y) => R.summaries[s].years[y];
const Dm = (s) => R.summaries[s];
const FN = (s) => R.funding[s];
const MK = (s, y) => R.market[s][y];
const sens = (p) => { const r = R.sensitivity.find((x) => x.label.startsWith(p)); if (!r) throw new Error('sens ' + p); return r; };
const pcol = (i) => `var(--p${i + 1})`;
const widest = R.widest;
const allC = R.plans[widest].countries;

// ── 표 도우미
const table = (head, rows, right = [], nw = []) => `<div class="tbl"><table><thead><tr>${head.map((h, i) => `<th${right.includes(i) ? ' class="r"' : ''}>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => { const cells = r.cells || r; return `<tr${r.cls ? ` class="${r.cls}"` : ''}>${cells.map((c, i) => `<td${right.includes(i) ? ' class="r num"' : (nw.includes(i) ? ' class="nw"' : '')}>${c}</td>`).join('')}</tr>`; }).join('')}</tbody></table></div>`;
const stat = (k, v, n) => `<div class="stat"><div class="k">${k}</div><div class="v num">${v}</div><div class="n">${n}</div></div>`;

// ── 그래프: 해마다 세 지표의 영업이익(묶음 막대)
function groupedBars(getV, aria) {
  const W = 760; const H = 280; const L0 = 64; const R0 = 12; const T0 = 22; const B0 = 34;
  const vals = yrs.flatMap((y) => PLANS.map((p) => getV(p, y)));
  let vMax = Math.max(0, ...vals); let vMin = Math.min(0, ...vals); const span = (vMax - vMin) || 1; vMax += span * 0.1; vMin -= span * 0.03;
  const sy = (v) => T0 + (1 - (v - vMin) / (vMax - vMin)) * (H - T0 - B0);
  const raw = (vMax - vMin) / 5; const p10 = Math.pow(10, Math.floor(Math.log10(raw))); let step = 10 * p10; for (const k of [1, 2, 2.5, 5, 10]) if (k * p10 >= raw) { step = k * p10; break; }
  const ticks = []; for (let v = Math.ceil(vMin / step) * step; v <= vMax; v += step) ticks.push(v);
  const gw = (W - L0 - R0) / yrs.length; const bw = Math.min(56, gw / (PLANS.length + 1.2));
  const bars = yrs.map((y, gi) => PLANS.map((p, k) => {
    const v = getV(p, y); const x = L0 + gi * gw + (gw - bw * PLANS.length) / 2 + k * bw; const y0 = sy(0); const y1 = sy(v);
    const top = Math.min(y0, y1); const h = Math.max(1, Math.abs(y1 - y0));
    return `<g class="gb" tabindex="0" data-tip="${esc(`${y} · ${p} · ${eok(v)}`)}"><rect x="${(x + 2).toFixed(1)}" y="${top.toFixed(1)}" width="${(bw - 4).toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${pcol(k)}"/><text x="${(x + bw / 2).toFixed(1)}" y="${(v >= 0 ? top - 5 : y0 - 5).toFixed(1)}" text-anchor="middle" class="lbl">${esc(Math.abs(v) < 1e8 ? `${v < 0 ? '−' : ''}${(Math.abs(v) / 1e8).toFixed(2)}억` : eokShort(v))}</text></g>`;
  }).join('') + `<text x="${(L0 + gi * gw + gw / 2).toFixed(1)}" y="${H - B0 + 18}" text-anchor="middle" class="yr">${y}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(aria)}">${ticks.map((v) => `<line x1="${L0}" x2="${W - R0}" y1="${sy(v).toFixed(1)}" y2="${sy(v).toFixed(1)}" class="grid${Math.abs(v) < 1 ? ' zero' : ''}"/><text x="${L0 - 8}" y="${(sy(v) + 4).toFixed(1)}" text-anchor="end" class="tick">${Math.abs(v) < 1 ? '0' : esc(eokShort(v))}</text>`).join('')}${bars}</svg>`;
}
const ebitdaChart = groupedBars((p, y) => OP(p, y).ebitda, `운영 계획의 해마다 영업이익. ${PLANS.map((p) => `${p} ${LY}년 ${eok(OP(p, LY).ebitda)}`).join(', ')}.`);
const ebitdaChartInv = groupedBars((p, y) => PL(p, y).ebitda, `투자 자료 성공 시나리오의 해마다 영업이익. ${PLANS.map((p) => `${p} ${LY}년 ${eok(PL(p, LY).ebitda)}`).join(', ')}.`);

// ── 본문 조각
const p0 = PLANS[0]; const pL = PLANS[PLANS.length - 1];
const mnBase = R.summaries['기본'];
const realism = [
  ['몽골 학원 학생(연말)', `${n0(CF('mn').students80)}명(4실 정원 ${n0(CF('mn').cap4)}명의 ${pct(I.targets.labFill)})`, `2028 ${n0(DY('기본', 2028).endStudents)}명 · 2029 ${n0(DY('기본', 2029).endStudents)}명`],
  ['몽골 유학 계약(한 해)', `2028 ${n0(PL(p0, 2028).byC.mn.contracts)}건 · 2029 ${n0(PL(p0, 2029).byC.mn.contracts)}건(새 유학생의 ${pct(I.targets.pathShare)})`, `2028 ${n0(R.pathYears['기본'][2028].admissions)}건 · 2029 ${n0(R.pathYears['기본'][2029].admissions)}건`],
  ['몽골 판 2029 영업이익', eok(PL(p0, 2029).ebitda), eok(DY('기본', 2029).ebitda)],
  ['필요 자금', `${eok(PN(p0).need)}(${PN(p0).needMonth} 전)`, `${eok(FN('기본').need)}(${FN('기본').needMonth} 전)`],
];

const reviewHtml = review ? review.html : '<div class="rv"><h3>검수</h3><p>계산 모델은 페이블 4차와 새 눈 검수를 받아 고쳤다. 나라 값은 조사 뒤 다시 본다.</p></div>';

// ── 가장 중요한 것 · 정할 것(운영 계획 새 나라 1.5% · 투자 자료 10%, 10-19 확정)
const vn10 = CF('vn').demandBy[LY] * I.targets.pathShare;
const findings = [
  ['유학 몫은 두 판이다(10-19 확정).', `나라마다 유학 ${pct(I.targets.pathShare)}는 투자 자료의 성공 시나리오로만 쓰고, 운영 계획은 새 나라(${cname('vn')}·${cname('uz')}) 유학 몫 ${pct1(I.opPlan.newPathShare)}(베트남에서 가장 큰 유학원 수준)에서 시작한다. ${LY}년 영업이익은 운영 계획 ${PLANS.map((p) => `${p} ${eok(OP(p, LY).ebitda)}`).join(' · ')}, 성공 시나리오 ${PLANS.map((p) => `${p} ${eok(PL(p, LY).ebitda)}`).join(' · ')}이다.`],
  ['PATH가 LAB보다 훨씬 크다.', `보수적(몽골만) ${LY}년 PATH 이익 ${eok(PL(p0, LY).path.profit)}은 LAB ${eok(PL(p0, LY).lab.profit)}의 ${n1(PL(p0, LY).path.profit / PL(p0, LY).lab.profit)}배다. 몽골 새 유학생의 ${pct(I.targets.pathShare)}(약 ${n0(PL(p0, LY).byC.mn.contracts)}건)를 맡으면 계약 한 건이 ${jo(man(PU('mn').pathExt.profit), '을', '를')} 남긴다(이익률 ${pct(PU('mn').pathExt.margin)}).`],
  ['베트남 10%는 투자 자료에만 쓴다.', `${cname('vn')} 한 해 새 한국 유학생 약 ${n0(CF('vn').demandBy[LY])}명(${LY} 어림)의 ${pct(I.targets.pathShare)}(약 ${n0(vn10)}건)는 지금 가장 큰 유학원(한 해 약 440건)의 ${n0(vn10 / 440)}배쯤이다. 운영 계획의 ${pct1(I.opPlan.newPathShare)}는 ${LY}년 ${cname('vn')} 약 ${n0(OP('평균적', LY).byC.vn.contracts)}건(상담 담당 약 ${n0(OP('평균적', LY).byC.vn.fteEnd)}명) · ${cname('uz')} 약 ${n0(OP(pL, LY).byC.uz.contracts)}건이다. 올리는 때는 사증 결과와 상담 인원을 뽑는 속도를 보고 정하자고 제안한다(새 나라 3%면 ${LY}년 평균적 ${eok(PC('운영 계획에서 새 나라 몫을 3%', '평균적').ebitda[LY])} · 성공적 ${eok(PC('운영 계획에서 새 나라 몫을 3%', '성공적').ebitda[LY])}).`],
  ['새 나라 학원은 시세로 받으면 적자다.', `베트남·우즈베키스탄은 주 5회 한 달 학원비를 시세대로 ${jo(man(CF('vn').m1KRW), '으로')} 잡았는데(몽골 ${man(CF('mn').m1KRW)}), 반 하나의 강사비는 ${man(CF('vn').teacherClassKRW)} · ${jo(man(CF('uz').teacherClassKRW), '으로')} 몽골(${man(CF('mn').teacherClassKRW)})보다 높다. 정원의 ${pct(I.targets.labFill)}를 채워도 ${LY}년 학원 이익이 베트남 ${eok(OP(pL, LY).byC.vn.labProfit)} · 우즈베키스탄 ${jo(eok(OP(pL, LY).byC.uz.labProfit), '이다', '다')}. 4실 편제 그대로면 학원만으로 손익분기가 되는 학생이 베트남 약 ${n0(CF('vn').bepStudents)}명 · 우즈베키스탄 약 ${n0(CF('uz').bepStudents)}명으로 4실 정원(약 ${n0(CF('mn').cap4)}명)보다 많다(몽골 약 ${n0(CF('mn').bepStudents)}명). 운영 계획처럼 유학 몫이 작으면 이 적자가 그 나라 이익에서 차지하는 몫이 커진다. 10-19 확정대로 새 나라도 몽골 4실 편제(위성 강사 포함)를 그대로 두고, 학원 적자는 유학으로 가는 길의 값으로 본다.`],
  [`${jo(cname('uz'), '은', '는')} ${LY}년에 한 해를 다 돈다.`, `${I.countries.uz.open}에 열어 2029년은 여는 넉 달이다(운영 계획 ${eok(OP(pL, 2029).byC.uz.ebitda)} · 성공 시나리오 ${eok(PL(pL, 2029).byC.uz.ebitda)}). ${LY}년 우즈베키스탄 몫은 운영 계획 ${eok(OP(pL, LY).byC.uz.ebitda)}(계약 약 ${n0(OP(pL, LY).byC.uz.contracts)}건) · 성공 시나리오 ${eok(PL(pL, LY).byC.uz.ebitda)}(약 ${n0(PL(pL, LY).byC.uz.contracts)}건)이다. 계약 한 건이 ${jo(man(PU('uz').pathExt.profit), '을', '를')} 남긴다(이익률 ${pct(PU('uz').pathExt.margin)}).`],
  ['WORLD는 전 세계 학습자에서 작게 셌다.', `전 세계 한국어 학습자 약 ${n0(I.world.globalLearners / 1e4)}만 명(범위 500만~1,500만)에서 셌더니 ${LY}년 WORLD 매출(앱 구독 + 몽골 기업 좌석)이 ${PLANS.map((p) => `${p} ${eok(PL(p, LY).world.revenue)}`).join(' · ')}이다(연말 유료 ${PLANS.map((p) => n0(PL(p, LY).world.paidEnd)).join(' · ')}명, 두 판 같음). 유료 이용자 대부분이 싼 가격대 나라에 있고 연간권이 섞여 1명 순매출이 ${I.world.countries.mn.netKRW.toLocaleString('ko-KR')}~${I.world.netKRWGlobal.toLocaleString('ko-KR')}원이다.`],
  [`필요 자금은 몽골 4실 공사 전 약 ${jo(eok(ON(p0).need), '이다', '다')}.`, `공사·비품과 보증금이 ${ON(p0).needMonth}에 한 번에 나간다. ${cname('vn')}·${cname('uz')}의 공사비는 앞 나라가 번 돈으로 낸다고 셌다(두 판 같음).`],
];
const decisions = [
  `<b>몽골 4실을 열 돈</b> — ${ON(p0).needMonth} 공사 전까지 투자·차입 약 ${eok(ON(p0).need)}(못 하면 D안 → 차면 직영).`,
];

// ── 진출 나라
const cards = [
  ['mn', '울란바토르', [`한 해 새 한국 유학생 ${n0(CF('mn').newStudents2025)} → ${n0(CF('mn').demandBy[LY])}명(2025 → ${LY})`, '한국 체류 유학생 19,751명(2026-08) · TOPIK 지원 12,272건(국외 5위)', '학생이 내는 유학원 수수료 150만₮(약 56만원)', `LAB 1개월권 ${man(CF('mn').m1KRW)}(주 5회)`], '증거를 만드는 나라 — 첫 학원·첫 비자 사례·첫 WORLD 이용자'],
  ['vn', '하노이', [`한 해 새 한국 유학생 ${n0(CF('vn').newStudents2025)} → ${n0(CF('vn').demandBy[LY])}명`, '한국 체류 유학생 126,018명(2026-08, 2025-12에는 전체 유학생의 약 38%) · TOPIK 85,896건(국외 1위)', '유학원 패키지 5,200만~8,300만 동(약 268만~429만원, 항공·한국어반 포함)', `학원 시세 주 5회 한 달 150만~200만 동 → ${jo(man(CF('vn').m1KRW), '으로')} 셈 · 법인세 ${pct(CF('vn').taxRate)}`], '크기 — 그 대신 유학원이 2,800곳 넘고 한국 사증 규제가 가장 센 나라'],
  ['uz', '타슈켄트', [`한 해 새 한국 유학생 ${n0(CF('uz').newStudents2025)}(추정) → ${n0(CF('uz').demandBy[LY])}명`, '한국 체류 유학생 20,185명(1년 +31%, 대부분 학위) · TOPIK 43,572건(국외 4위)', '유학원 수수료 1,200~1,500달러(약 160만~200만원, 몽골의 약 3배)', `학원 월 49만~69만 숨(주 3회 안팎) → ${jo(man(CF('uz').m1KRW), '으로')} 셈 · 법인세 ${pct(CF('uz').taxRate)}`], '빨리 크는 TOPIK 시장·학위 중심·높은 수수료 — 강사 월급은 몽골보다 높다'],
];
const cardsHtml = `<div class="cards">${cards.map(([c, city, facts, why], k) => `<div class="card"><div class="label">${k + 1} · ${I.countries[c].open} 개원</div><h3>${cname(c)} · ${city}</h3><ul>${facts.map((f) => `<li>${f}</li>`).join('')}</ul><div class="n">${why}</div></div>`).join('')}</div>`;
const cands = [
  ['<b>우즈베키스탄</b>', '22,900 → 41,844', '15,352 → 20,185(+31%)', '<b>고름</b> — 크고 빨리 크며 학위 중심, 수수료 1,200~1,500달러'],
  ['네팔', '794 → 2,264', '9,229 → 16,608(+80%)', '뺌 — 2026-07 규정이 교육 상담·어학 교육의 외국인 소유를 막음(보도)'],
  ['미얀마', '3,293 → 7,062', '7,525 → 10,129(+35%)', '뺌 — 내전·징병·출국 제한, 공식과 실거래 환율 차이 70~80%'],
  ['방글라데시', '1,575 → 1,452', '2,977 → 4,381(+47%)', '작음 — TOPIK 지원 1,452건, 2024~2026 정권 교체'],
  ['키르기스스탄', '1,512 → 1,742', '1,787 → 2,616(+46%)', '작음 — 타슈켄트에서 함께 맡을 옆 나라 후보'],
  ['인도네시아', '2,716 → 3,860', '2,680 → 2,576', '유학보다 고용허가(E-9 42,064명) 쪽 나라'],
  ['일본', '41,059 → 49,290', '4,203 → 4,157', '유학 깔때기가 작음 — 취미 학습자는 WORLD(온라인)로'],
];
const scaleRows = Object.keys(I.countries).map((c) => { const f = CF(c); const sc = I.countries[c].scale || {}; const P0 = (I.countries[c].overrides || {}).path || {}; const cac = (P0.extCacMNT ?? I.path.extCacMNT) / I.fx.mntPerKrw; return [cname(c), num([sc.price, sc.wage, sc.rent, sc.capex].map((x) => (x ?? 1).toFixed(2)).join(' · ')), num(man(f.teacherClassKRW)), num(man(f.rentKRW)), num(man(f.counselorKRW)), num(pct1(f.socialInsurance)), num(f.overheadKRW ? man(f.overheadKRW) : '대표 상주'), num(man(cac))]; });
const checkRows = [[`<b>운영 계획 · 새 나라 ${pct1(I.opPlan.newPathShare)} · 몽골 ${pct(I.targets.pathShare)}(확정)</b>`, ...PLANS.map((p) => num(yrs.map((y) => eokShort(OP(p, y).ebitda)).join(' · '))), num(n0(OP(pL, LY).path.contracts))], [`모든 나라 ${pct(I.targets.pathShare)}(투자 자료 · 성공 시나리오)`, ...PLANS.map((p) => num(yrs.map((y) => eokShort(PL(p, y).ebitda)).join(' · '))), num(n0(PL(pL, LY).path.contracts))],
  ...(R.planChecks || []).map((c) => [esc(c.label), ...PLANS.map((p) => num(yrs.map((y) => eokShort(c.byPlan[p].ebitda[y])).join(' · '))), num(n0(c.byPlan[pL].contracts[LY]))])];

const html = `<title>SYNK BM 설계안</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400..700&family=IBM+Plex+Mono:wght@500&display=swap">
${css}
<div class="wrap">
<header>
  <div class="label">SYNK · Business model · 2026-10-19 · 진출 나라 세 지표</div>
  <h1>SYNK BM 설계안</h1>
  <div class="chips"><span class="chip"><i style="background:var(--lab)"></i>LAB 메인</span><span class="chip"><i style="background:var(--path)"></i>PATH 메인</span><span class="chip"><i style="background:var(--pulse)"></i>PULSE·WORLD 서브</span><span class="chip"><i style="background:var(--shift)"></i>SHIFT 서브</span><span class="chip warn">가정은 확정 전</span>${(review?.chips || ['검수 반영']).map((c) => `<span class="chip ok">${esc(c)}</span>`).join('')}</div>
  <p class="lead">1년에 한 나라씩 열어 2027~2030년을 해마다 셌다. 보수적은 ${cname('mn')}, 평균적은 ${cname('mn')}과 ${cname('vn')}, 성공적은 여기에 ${cname('uz')}까지다. 학원은 4실 정원의 ${pct(I.targets.labFill)}, WORLD 앱은 전 세계 한국어 학습자에서 셌다. 유학은 두 판이다 — <b>운영 계획</b>은 새 나라 유학 몫 ${pct1(I.opPlan.newPathShare)}부터, <b>투자 자료의 성공 시나리오</b>는 나라마다 ${pct(I.targets.pathShare)}(10-19 유호님 확정).</p>
  <div class="stats">
    ${PLANS.map((p) => stat(`${LY} 영업이익 · ${p} · 운영 계획`, eok(OP(p, LY).ebitda), `성공 시나리오 ${eok(PL(p, LY).ebitda)} · ${R.plans[p].countries.map(cname).join(' + ')}${p === p0 ? ' · 몽골은 두 판이 같다(80%·10%, 확정)' : ''}`)).join('')}
    ${stat('필요 자금', eok(Math.max(...PLANS.map((p) => PN(p).need))), `${PN(p0).needMonth} 몽골 4실 공사 전 · 다음 나라는 번 돈으로`)}
  </div>
</header>

<section id="key">
  <div class="head"><div class="label">What matters</div><h2>이번 계산에서 가장 중요한 것</h2></div>
  <ol class="find">${findings.map(([h, t]) => `<li><b>${h}</b> ${t}</li>`).join('')}</ol>
  <h3>유호님이 먼저 정할 한 가지 <span class="muted">(10-19 확정: 셋째 나라 ${cname('uz')} · 유학 10%는 투자 자료에만, 운영 계획은 새 나라 ${pct1(I.opPlan.newPathShare)}부터 · 몽골 운영 계획도 80%·10% · 새 나라 학원도 몽골 4실 편제)</span></h3>
  <ol class="steps">${decisions.map((d) => `<li>${d}</li>`).join('')}</ol>
</section>

<section id="basis">
  <div class="head"><div class="label">Three yardsticks</div><h2>세 지표</h2></div>
  ${table(['지표', '나라(개원)', '학원', '유학', 'WORLD 앱'], PLANS.map((p, k) => ({ cls: '', cells: [`<span class="dot" style="background:${pcol(k)}"></span><b>${p}</b>`, R.plans[p].countries.map((c) => `${cname(c)} ${I.countries[c].open}`).join(' · '), `나라마다 4실 정원의 ${pct(I.targets.labFill)}`, `나라마다 한 해 새 한국 유학생의 ${pct(I.targets.pathShare)}`, '전 세계 학습자 + 진출한 나라는 더 닿음'] })), [], [0])}
  <ul class="plain">
    <li><b>학원(4실 24반):</b> 평일 코어 11·14·15:30·18시 × 4실 = 16반, 토요일 11·14시 × 4실 = 8반을 모두 연다. 4실 정원(반 16석에 맞춘 사람 수 약 ${n0(CF('mn').cap4)}명, 라이트 과정은 0.5석)의 ${pct(I.targets.labFill)}인 약 ${n0(CF('mn').students80)}명을 개원 달부터 셌다(좌석은 평일 ${pct(CF('mn').wkdFill80)} · 토요일 ${pct(CF('mn').satFill80)}가 참).</li>
    <li><b>유학(PATH, 성공 시나리오):</b> 그 나라에서 한 해 새로 한국에 가는 유학생(D-2·D-4)의 ${pct(I.targets.pathShare)}를 개원 다음 달부터 맡는다. LAB을 마치고 가는 학생을 먼저 세고 나머지는 LAB 밖 학생이다. 입학 지원(계약·합격·비자에 나눠 받음) + 협약 대학 수수료 + 정착 + 진학 + 취업 준비. 상담 담당은 상담을 여는 달부터 일 시간 ÷ ${I.path.counselor.monthHours}시간만큼 두고, 여덟 명마다 팀장 한 명.</li>
    <li><b>운영 계획(10-19 확정):</b> 새 나라(${cname('vn')}·${cname('uz')})의 유학 몫만 ${pct1(I.opPlan.newPathShare)}로 두고 2030년까지 그대로 셌다. 유학 ${pct(I.targets.pathShare)}는 투자 자료의 성공 시나리오로만 쓴다. 몽골은 운영 계획도 학원 ${pct(I.targets.labFill)}·유학 ${pct(I.targets.pathShare)}다(10-19 확정).</li>
    <li><b>2030년:</b> 2029년과 같은 규칙으로 한 해 더 셌다. 시장은 나라별 성장률로 크고, 학원 ${pct(I.targets.labFill)}와 두 판의 유학 몫(성공 시나리오 ${pct(I.targets.pathShare)} · 운영 계획 새 나라 ${pct1(I.opPlan.newPathShare)})을 지키며, 9월에 임금·임대·값이 한 계단 오른다. PULSE 광고·SHIFT·LAB 온라인은 2029년 고객 수 그대로이고 AI바우처는 2030년에 넣지 않았다(가정 — 그래서 2030 SHIFT·PULSE 광고 이익이 조금 준다). 베트남 법인세는 2030년부터 20%. 현실성 점검의 시장 몫 방식은 2029년까지만 셌다.</li>
    <li><b>WORLD:</b> 유료 이용자 = 학습자 × 닿는 비율 × 유료 비율. 진출한 나라는 개원 뒤 학원·현장 마케팅으로 더 닿고, 나머지 나라는 온라인만이다.</li>
    <li><b>같은 값:</b> PULSE 광고·SHIFT는 세 지표 모두 기본 계획의 절반, LAB 온라인은 기본 그대로다. 회사 공통비(대표 생활비·도구·회계)와 한국 법인은 몽골 판에서 한 번 센다. 몽골 밖 나라 판에는 대표 시간을 세지 않았다(현지 책임자 비용으로 대신).</li>
  </ul>
</section>

<section id="numbers">
  <div class="head"><div class="label">${yrs.join(' · ')}</div><h2>세 지표의 ${yrs.length}년</h2></div>
  <h3>운영 계획 — 새 나라 유학 ${pct1(I.opPlan.newPathShare)}부터</h3>
  <div class="chart"><div class="legend">${PLANS.map((p, k) => `<span><i class="p${k + 1}"></i>${p}</span>`).join('')}</div>${ebitdaChart}</div>
  ${table(['지표', '연도', '매출', '영업이익', 'LAB 이익', 'PATH 이익', '유학 계약', 'WORLD 이익', 'PULSE 광고', 'SHIFT', '회사 공통비', '연말 현금'],
    PLANS.flatMap((p) => yrs.map((y) => { const v = OP(p, y); return [p, y, num(eok(v.revenue)), num(`<b>${eok(v.ebitda)}</b>`), num(eok(v.lab.profit)), num(eok(v.path.profit)), num(n0(v.path.contracts)), num(eok(v.world.profit)), num(eok(v.pulseAds.profit)), num(eok(v.shift.profit)), num(eok(-v.company)), num(eok(v.endCash))]; })),
    [2, 3, 4, 5, 6, 7, 8, 9, 10, 11], [0, 1])}
  <h3>투자 자료 · 성공 시나리오 — 나라마다 유학 ${pct(I.targets.pathShare)}</h3>
  <div class="chart"><div class="legend">${PLANS.map((p, k) => `<span><i class="p${k + 1}"></i>${p}</span>`).join('')}</div>${ebitdaChartInv}</div>
  ${table(['지표', '연도', '매출', '영업이익', 'LAB 이익', 'PATH 이익', 'WORLD 이익', 'PULSE 광고', 'SHIFT', '회사 공통비', '연말 현금'],
    PLANS.flatMap((p) => yrs.map((y) => { const v = PL(p, y); return [p, y, num(eok(v.revenue)), num(`<b>${eok(v.ebitda)}</b>`), num(eok(v.lab.profit)), num(eok(v.path.profit)), num(eok(v.world.profit)), num(eok(v.pulseAds.profit)), num(eok(v.shift.profit)), num(eok(-v.company)), num(eok(v.endCash))]; })),
    [2, 3, 4, 5, 6, 7, 8, 9, 10], [0, 1])}
  ${table(['지표', '가장 낮은 현금(달)', '현금 바닥 기준', '출자·공사 시점에 모자라는 돈', '필요 자금', '투입 시점'], PLANS.map((p) => [p, num(`${eok(PN(p).minCash)} (${PN(p).minCashMonth})`), num(eok(PN(p).needFloor)), num(eok(PN(p).needAtOpen)), num(`<b>${eok(PN(p).need)}</b>`), `${PN(p).needMonth} 전`]), [1, 2, 3, 4], [0])}
  <p class="muted">그 나라 영업이익에는 그 나라 학원·유학의 직접 비용과 현지 책임자·출장·회계가 들어 있다. 둘째·셋째 나라의 공사·보증금은 앞 나라가 번 돈으로 낸다고 셌다(그룹 현금 기준).</p>
</section>

<section id="entry">
  <div class="head"><div class="label">Where next</div><h2>진출 나라 — ${cname('mn')} → ${cname('vn')} → ${cname('uz')}</h2></div>
  <p>순서는 유호님 생각(몽골 → 베트남 → 하나 더)을 그대로 두고, 셋째 나라는 <b>${cname('uz')}</b>${jo(cname('uz'), '으로').slice(cname('uz').length)} 정했다(10-19 유호님 확정). 한 해에 한 나라씩, 모두 9월에 연다. 우즈베키스탄을 베트남보다 먼저 여는 길도 있지만(경쟁·사증 위험이 덜하고 수수료가 높다), 같은 몫이면 베트남 한 해 계약이 우즈베키스탄의 ${n1(CF('vn').demandBy[LY] / CF('uz').demandBy[LY])}배(${LY})라 순서를 그대로 두었다.</p>
  ${cardsHtml}
  <details><summary>셋째 나라 후보 비교(TOPIK 지원 · 한국 체류 유학생)</summary>
  ${table(['나라', 'TOPIK 지원 2023 → 2025', '체류 유학생 2024-12 → 2025-12', '판단'], cands, [1, 2], [0])}
  </details>
  <details><summary>나라별로 넣은 값(몽골 값에 곱한 배수와 그 나라 값)</summary>
  ${table(['나라', '값 · 임금 · 임대 · 공사 배수', '반 하나 강사비(월)', '4실 임대(월)', '상담 담당 1명(월)', '사회보험(고용주)', '현지 책임자 등(월)', 'LAB 밖 계약 1건 광고'], scaleRows, [1, 2, 3, 4, 5, 6, 7], [0])}
  <p class="muted">베트남: 값 0.45 = 주 5회 한 달 시세 가운데 180만 동 ÷ LAB 1개월권, 임금 1.1 = 교사 월 1,000만~1,800만 동·상담 2,000만 동, 임대 1.15 = 하노이 B급 ㎡당 14.8달러 + 관리비·부가세, 입학 지원 외부 200만원 = 패키지에서 항공·한국어반·비자 수수료를 뺀 값. 우즈베키스탄: 값 0.45 = 시간당 시세 가운데, 임금 1.4 = 한국어 강사 중간값 월 1,250만 숨과 사무 510만~650만 숨을 섞음, 임대 1.4 = B급 23~31달러·교육 건물 18달러, 입학 지원 외부 173만원 = 1,300달러. 자세한 근거는 <code>사업방안/08_진출나라.md</code>.</p>
  </details>
</section>

<section id="countries">
  <div class="head"><div class="label">By country</div><h2>나라별</h2></div>
  <h3>운영 계획 — 성공적 지표의 세 나라(학원 줄은 성공 시나리오와 같다)</h3>
  ${table(['연도', '나라', '유학 계약', 'PATH 매출 / 이익', '연말 상담 담당', '그 나라 영업이익'], yrs.flatMap((y) => R.opPlans[pL].countries.map((c) => { const v = OP(pL, y).byC[c]; return [y, cname(c), num(`${n0(v.contracts)}건`), num(`${eok(v.pathRev)} / ${eok(v.pathProfit)}`), num(`${n1(v.fteEnd)}명`), num(eok(v.ebitda))]; })), [2, 3, 4, 5], [0, 1])}
  <h3>투자 자료 · 성공 시나리오</h3>
  ${table(['지표', '연도', '나라', '연말 학생', 'LAB 매출 / 이익', '유학 계약', 'PATH 매출 / 이익', '그 나라 영업이익'],
    PLANS.flatMap((p) => yrs.flatMap((y) => R.plans[p].countries.map((c) => { const v = PL(p, y).byC[c]; return [p, y, cname(c), num(n0(v.endStudents)), num(`${eok(v.labRev)} / ${eok(v.labProfit)}`), num(n0(v.contracts)), num(`${eok(v.pathRev)} / ${eok(v.pathProfit)}`), num(eok(v.ebitda))]; }))),
    [3, 4, 5, 6, 7], [0, 1, 2])}
  <h3>나라 가정</h3>
  ${table(['나라', '개원', '학원 학생', '정규 1개월권', `한 해 새 한국 유학생(${LY})`, `10%면 한 해 유학 계약(${LY})`, '입학 지원(재원생 · 외부)', '4실 공사·비품', '현지 책임자 등(월)', '법인세'],
    allC.map((c) => { const f = CF(c); return [f.name, f.open, num(`${n0(f.students80)}명`), num(man(f.m1KRW)), num(`${n0(f.demandBy[LY])}명 · 성장 ${pct(f.growth)}`), num(`${n0(f.demandBy[LY] * I.targets.pathShare)}건`), num(`${man(f.admLabKRW)} · ${man(f.admExtKRW)}`), num(eok(f.capexKRW)), num(f.overheadKRW ? man(f.overheadKRW) : '— (대표 상주)'), num(f.taxRate == null ? '몽골 세법' : pct(f.taxRate) + (f.taxByYear ? Object.entries(f.taxByYear).map(([y, v]) => ` → ${y} ${pct(v)}`).join('') : ''))]; }),
    [2, 3, 4, 5, 6, 7, 8, 9], [0, 1])}
  <p class="muted">${allC.map((c) => `${cname(c)}: ${esc(I.countries[c].note || '')}`).join(' · ')}</p>
</section>

<section id="unit">
  <div class="head"><div class="label">Per student</div><h2>나라별 학생 1명당 경제(${LY}년 값)</h2></div>
  ${table(['나라', 'LAB 학생 1명 매출 / 이익(재원 개월)', 'PATH 1건 · LAB 학생 매출 / 이익', 'PATH 1건 · LAB 밖 매출 / 이익', 'PATH 이익률'],
    allC.map((c) => { const u = PU(c); return [cname(c), num(`${man(u.labRev)} / ${man(u.labProfit)} (${n1(u.tenure)}개월)`), num(`${man(u.pathLab.revenue)} / ${man(u.pathLab.profit)}`), num(`${man(u.pathExt.revenue)} / ${man(u.pathExt.profit)}`), num(pct(u.pathExt.margin))]; }),
    [1, 2, 3, 4], [0])}
  <p class="muted">LAB은 그해 학생 1명·달 평균(강사·임대·운영·성과급 전부 나눔, 외부 수강생 매출 뺌) × 그해 실제 재원 개월이다. PATH는 계약 1건이 끝까지 가져오는 돈이다(입학 지원 + 협약 대학 수수료(학위 ${man(I.path.prices.univCommissionKRW)} · 어학연수 ${man(I.path.prices.univCommissionD4KRW)}) + 정착 + 진학 지원 − 상담 시간 · 성과 몫 · 계약 광고). ${LY}년은 세 나라 모두 한 해를 다 돈 값이다.</p>
</section>

<section id="world">
  <div class="head"><div class="label">SYNK WORLD</div><h2>WORLD 앱 — 전 세계 학습자에서</h2></div>
  ${table(['지표', ...yrs.map((y, i) => (i === 0 ? `${y} 유료(연말) · 매출` : String(y)))], PLANS.map((p) => [p, ...yrs.map((y) => num(`${n0(PL(p, y).world.paidEnd)}명 · ${eok(PL(p, y).world.revenue)}`))]), yrs.map((_, i) => i + 1), [0])}
  <p class="muted">유료 이용자 = 학습자 × 닿는 비율 × 유료 비율 ${pct1(I.world.paidRate)}. 전 세계 한국어 학습자 약 ${n0(I.world.globalLearners / 1e4)}만 명(범위 500만~1,500만, 해마다 ${pct(I.world.growth)}) — 몽골 ${n0(I.world.countries.mn.learners / 1e4)}만 · 베트남 ${n0(I.world.countries.vn.learners / 1e4)}만 · 우즈베키스탄 ${n0(I.world.countries.uz.learners / 1e4)}만 명. 진출한 나라는 개원 뒤 해마다 ${I.world.reachActive.map((x) => pct1(x.v)).join(' → ')}(베트남·우즈베키스탄은 그 ${I.world.countries.vn.reachScale}배), 나머지는 유료를 연 뒤 해마다 ${I.world.reachOnline.map((x) => pct2(x.v)).join(' → ')}에 닿는다. 1명 순매출은 진출 나라 ${I.world.countries.mn.netKRW.toLocaleString('ko-KR')}원(싼 가격대 · 기간 섞음), 나머지 ${I.world.netKRWGlobal.toLocaleString('ko-KR')}원(가격대 섞음), 원가율 ${pct(I.world.costRate)}. 학습자 수는 공식 집계가 없어 확인된 숫자(TOPIK·세종학당·학교·앱)로 어림했다.</p>
</section>

<section id="realism">
  <div class="head"><div class="label">Reality check</div><h2>현실성 점검 — 몽골 시장 몫 방식과 견주기</h2></div>
  ${table(['', '세 지표(보수적 · 몽골)', '시장 몫 방식(기본)'], realism)}
  <h3>유학 몫에 따라(같은 세 지표에서 유학 몫만 바꿈)</h3>
  ${table(['유학 몫', ...PLANS.map((p) => `${p} ${yrs.join(' · ')} 영업이익`), `${LY} 유학 계약(${pL})`], checkRows, [1, 2, 3, 4], [0])}
  <p class="muted">${cname('vn')} 10%는 한 해 약 ${n0(vn10)}건(${LY})으로 ${LY}년 말 상담 담당이 약 ${n0(PL('평균적', LY).byC.vn.fteEnd)}명 필요하다. 베트남 유학원은 2,800곳이 넘어 한 곳이 평균 열 명 남짓이고 이름난 곳도 한 해 150~440건(시장의 0.5~1.5%)이다. 몽골의 큰 유학원 한 곳(Setsoyu)은 한 해 약 400명이다. 10-19 확정대로 운영 계획은 새 나라 1.5%(베트남에서 가장 큰 유학원 수준)에서 시작하고 2030년까지 그대로 셌다. 올리는 때는 사증 결과와 상담 인원을 뽑는 속도를 보고 정하자고 제안한다. 2027년은 몫이 작을수록 오히려 낫다 — 상담·광고 비용은 그달 나가고 입학 지원 값은 넉 달에 걸쳐 들어온다.</p>
  <p class="muted">영업이익 차이에는 WORLD 셈법 차이도 섞여 있다(세 지표는 전 세계 학습자에서 센 새 식, 시장 몫 방식은 BM 목록 곡선). 시장 몫 방식은 울란바토르 한국행 준비 인원(TOPIK 지원 × ${pct(I.market.mongolia.topikDedup)} + EPS 접수 + 어학연수 직행, 울란바토르 ${pct(I.market.mongolia.ubShare)}, 해마다 ${pct(I.market.growth)})의 ${I.market.labCapture['기본'].map((x) => pct1(x.v)).join(' → ')}를 학원이 잡고, PATH는 LAB을 마치는 학생의 ${pct(I.path.labToKorea['기본'])}와 LAB 밖 새 유학생의 ${I.path.extShare['기본'].map((x) => pct1(x.v)).join(' → ')}를 맡는다고 본 값이다(검수 두 건 반영). 세 지표는 학원·유학이 「성공했을 때」의 값이라, 그 차이만큼을 개원 전 대기자 명단과 첫 석 달 등록으로 재야 한다.</p>
</section>

<section id="review">
  <div class="head"><div class="label">Review</div><h2>검수 기록</h2></div>
  ${reviewHtml}
</section>

<footer>
  <p>계산: <code>docs/유지비_BM/BM_통합설계_20261018/model.mjs</code>(입력 <code>inputs.mjs</code>) → <code>results.md</code>. 조사: <code>조사/</code>(시장 깔때기 · 울란바토르 · 베트남 · 셋째 나라 · WORLD 학습자).</p>
  <p>환율 1원 = ${I.fx.mntPerKrw}₮, 1달러 = ${I.fx.krwPerUsd.toLocaleString('ko-KR')}원. 다른 나라 값은 원화 기준 물가 배수로 몽골 값을 바꿔 셌다. 가격·인원·일정·몫은 모두 제안이나 가정이며 확정이 아니다(10-19 확정: 셋째 나라 우즈베키스탄, 유학 10%는 투자 자료의 성공 시나리오로만 · 운영 계획은 새 나라 1.5%부터 · 몽골 운영 계획도 80%·10% · 새 나라 학원도 몽골 4실 편제).</p>
</footer>
</div>
<div id="tip" role="tooltip"></div>
<script>
(function(){
  var tip=document.getElementById('tip');
  function place(x,y){var w=tip.offsetWidth||200;tip.style.left=Math.max(8,Math.min(window.innerWidth-w-8,x+12))+'px';tip.style.top=Math.max(8,y-48)+'px'}
  function show(text,x,y){tip.textContent=text;tip.style.opacity=1;place(x,y)}
  function hide(){tip.style.opacity=0}
  document.querySelectorAll('.gb').forEach(function(el){
    el.addEventListener('mousemove',function(e){show(el.getAttribute('data-tip'),e.clientX,e.clientY)});
    el.addEventListener('mouseleave',hide);
    el.addEventListener('focus',function(){var r=el.getBoundingClientRect();show(el.getAttribute('data-tip'),r.left+r.width/2,r.top)});
    el.addEventListener('blur',hide);
    el.addEventListener('touchstart',function(e){var t=e.touches[0];show(el.getAttribute('data-tip'),t.clientX,t.clientY)},{passive:true});
  });
})();
</script>
`;
writeFileSync(outFile, html, 'utf8');
console.log('wrote', outFile, Buffer.byteLength(html, 'utf8'));
