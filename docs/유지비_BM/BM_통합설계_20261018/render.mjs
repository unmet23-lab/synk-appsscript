// 틀(틀/ 아래 .md)의 {{식}} 자리를 계산 결과(results.json)로 채워 문서를 만든다 — 문서의 숫자는 손으로 고치지 않는다
// 사용: node docs/유지비_BM/BM_통합설계_20261018/model.mjs && node docs/유지비_BM/BM_통합설계_20261018/render.mjs
//   틀/README.md → README.md, 틀/사업방안/*.md → 사업방안/*.md. 식 하나라도 틀리면 아무 파일도 쓰지 않는다
import { readFileSync, writeFileSync, renameSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const R = JSON.parse(readFileSync(path.join(here, 'results.json'), 'utf8'));
const I = (await import(pathToFileURL(path.join(here, 'inputs.mjs')).href + `?t=${Date.now()}`)).default;

const sign = (x) => (x < 0 ? '−' : '');
const man = (x) => `${sign(x)}${Math.round(Math.abs(x) / 1e4).toLocaleString('ko-KR')}만원`;
const eok = (x) => {
  if (Math.abs(x) < 1e8) return man(x);
  let s = (Math.abs(x) / 1e8).toFixed(2);
  s = s.replace(/0$/, '').replace(/\.$/, '');
  return `${sign(x)}${s}억원`;
};
const mnt = (x) => `${sign(x)}${Math.round(Math.abs(x) / 1e4).toLocaleString('ko-KR')}만₮`;
const n0 = (x) => Math.round(x).toLocaleString('ko-KR');
const n1 = (x) => (Math.round(x * 10) / 10).toLocaleString('ko-KR');
const pct = (x) => `${Math.round(x * 100)}%`;
const DY = (s, y) => R.summaries[s].years[y];
const AY = (s, y) => R.aPlan[s].summary.years[y];
const core = (s, y) => { const v = DY(s, y); return v.lab.profit + v.path.profit - v.company.cost; };
const Dm = (s) => R.summaries[s];
const Am = (s) => R.aPlan[s];
const SC = (s) => R.scenarios[s];
const row = (s, m) => { const r = R.scenarios[s].rows.find((x) => x.m === m); if (!r) throw new Error(`no row ${s} ${m}`); return r; };
const find = (list, prefix, what) => { const r = list.find((x) => x.label.startsWith(prefix)); if (!r) throw new Error(`no ${what} ${prefix}`); return r; };
const sens = (prefix) => find(R.sensitivity, prefix, 'sens');
const ad = (prefix) => find(R.adLever, prefix, 'ad');
const deal = (prefix) => find(R.dealCompare, prefix, 'deal'); // 기관과의 거래 모양(2-3절)
const dl = (prefix, s) => deal(prefix).bySc[s];
const gate = (s) => R.gateCheck[s]; // 개원 관문: gate(관문) · stopOnly(멈춤 규칙만) · none(둘 다 없음)
const hit = (n) => { const r = R.hostIncomeTable.find((x) => x.students === n); if (!r) throw new Error(`no hostIncome ${n}`); return r; };
const move = (f) => {
  if (!f || (f.moved === null && f.month === null && !f.stopFrom)) return '해당 없음';
  if (f.gate) return '개원 관문에서 처음부터 C안';
  if (f.stopFrom) return `멈춤 규칙 → ${f.stopFrom}부터 C안`;
  if (f.moved === false) return '기간 안에 옮기지 않음(SYNK반 유지)';
  if (f.moved) return `${f.month} 준비 → ${f.moved} 이전(교실 ${f.directStage === 's2' ? 4 : 2}개)`;
  return f.gap > 0 ? `${f.month}에 ${eok(f.gap)} 모자람` : `${f.month}에 채움`;
};
const B = R.bep; const CAP = R.capacity; const LTV = R.ltv; const SUB = R.subShare;
// [10-19] 본 결과는 4실 직영. D안은 비교안이라 따로 읽는다
const PY = (s, y) => R.dPlan[s].summary.years[y]; // D안 연도 값
const Pm = (s) => R.dPlan[s].summary; // D안 요약(가장 낮은 현금 등)
const DP = (s) => R.dPlan[s]; // D안 직영 이전·교실 늘리기
const FN = (s) => R.funding[s]; // 4실 직영 필요 자금·실을 연 달
const rooms = (s) => R.funding[s].v23AddMonths || [];
const U = (s) => R.units[s]; // 학생 1명당 경제
const MK = (s, y) => R.market[s][y]; // 시장 깔때기 한 해 합계
const PT = (s, y) => R.pathYears[s][y]; // PATH 줄별 한 해 합계
const pct1 = (x) => `${(Math.round(x * 1000) / 10).toLocaleString('ko-KR')}%`;
const pct2 = (x) => `${(Math.round(x * 10000) / 100).toLocaleString('ko-KR')}%`; // 0.02%처럼 작은 몫
// D안 기본 가정의 달별 값(사업방안/01): prow('기본','2028-04') · pysum('기본',2028,(r) => …) · pcore('기본',2029)
const prow = (s, m) => { const rs = R.dPlan[s].rows; if (!rs) throw new Error(`D안 ${s} 달별 줄 없음`); const r = rs.find((x) => x.m === m); if (!r) throw new Error(`no D안 row ${s} ${m}`); return r; };
const pysum = (s, y, f) => { const rs = R.dPlan[s].rows; if (!rs) throw new Error(`D안 ${s} 달별 줄 없음`); return rs.filter((r) => r.m.startsWith(String(y))).reduce((a, r) => a + (f(r) || 0), 0); };
const pcore = (s, y) => { const v = PY(s, y); return v.lab.profit + v.path.profit - v.company.cost; };
// [10-19 세 지표] 보수적·평균적·성공적: PL('평균적',2029).ebitda · PN('성공적').need · CF('vn').students80 · PU('vn').pathExt.profit · cname('x3')
const PL = (p, y) => R.plans[p].years[y];
const PN = (p) => R.plans[p];
const CF = (c) => R.countryFacts[c];
const PU = (c) => R.planUnits[c];
const cname = (c) => I.countries[c].name;
const PLANS = Object.keys(R.plans);
// [10-19 유호님 확정] 운영 계획(새 나라 유학 1.5%): OP('평균적',2030).ebitda · ON('성공적').need
const OP = (p, y) => R.opPlans[p].years[y];
const ON = (p) => R.opPlans[p];
const HY = (R.planHorizon && R.planHorizon.years) || [2027, 2028, 2029]; const LY = HY[HY.length - 1]; // 세 지표의 해(2027~2030)와 마지막 해
// 유학 몫 견주기: PC('운영 계획에서 새 나라 몫을 3%', '평균적').ebitda[2030] · PC('모든 나라', '성공적').contracts[2030]
const PC = (prefix, p) => { const c = (R.planChecks || []).find((x) => x.label.startsWith(prefix)); if (!c) throw new Error(`no planCheck ${prefix}`); return c.byPlan[p]; };
const PCL = (prefix) => { const c = (R.planChecks || []).find((x) => x.label.startsWith(prefix)); if (!c) throw new Error(`no planCheck ${prefix}`); return c.label; };
// 운영 계획용 개원 전 관문 [제안 · 10-19]: OG = R.opGate, OGc('2027-04') = 그달 점검 줄
const OG = R.opGate; const OGc = (m) => { const c = (R.opGate && R.opGate.checks || []).find((x) => x.month === m); if (!c) throw new Error(`no opGate check ${m}`); return c; };
// 조사 붙이기: jo('베트남', '은', '는') → 베트남은 · jo('52만원', '을', '를') → 52만원을 · jo('몽골', '으로') → 몽골로
const jo = (w, a, b) => {
  const str = String(w); const t = str.replace(/[^가-힣0-9a-zA-Z]+$/, ''); const ch = t[t.length - 1] || '';
  let bat = false; let rieul = false; const code = ch.charCodeAt(0) - 0xac00;
  if (code >= 0 && code <= 11171) { const jong = code % 28; bat = jong !== 0; rieul = jong === 8; } else if (/[0-9]/.test(ch)) { bat = '013678'.includes(ch); rieul = '178'.includes(ch); }
  if (a === '으로') return str + (bat && !rieul ? '으로' : '로');
  return str + (bat ? a : b);
};
// 두 반 맡은 강사가 그달 받는 돈(₮): 기본급(물가 계단 포함) + 기본 성과급 + 현장 보너스·이익 나눔의 1인 평균
const pay = (s, m) => {
  const r = row(s, m); const d = r.lab.incentiveDetail; const hc = d.headcount || 1;
  let k = 0; for (const st of I.lab.inflation.steps) if (m >= st) k += 1;
  const wm = Math.pow(1 + I.lab.inflation.wage, k);
  return 2 * I.lab.staff.hoursPerClass * I.lab.staff.teacherHourly * wm + d.baseEach + d.fieldBonus / hc + d.pool / hc;
};
// 한 해 동안의 달별 값 합: ysum('기본', 2028, (r) => r.lab.hostFee)
const ysum = (s, y, f) => R.scenarios[s].rows.filter((r) => r.m.startsWith(String(y))).reduce((a, r) => a + (f(r) || 0), 0);
const toKRW = (mntv) => mntv / I.fx.mntPerKrw;
const hrs = (s, m) => Math.round(row(s, m).hours.total); // 그달 대표 시간
const names = { R, I, man, eok, mnt, n0, n1, pct, pct1, DY, AY, core, Dm, Am, SC, row, sens, ad, deal, dl, gate, hit, move, B, CAP, LTV, SUB, pay, ysum, toKRW, hrs, PY, Pm, DP, FN, rooms, U, MK, PT, prow, pysum, pcore, PL, PN, CF, PU, cname, PLANS, jo, PC, PCL, pct2, HY, LY, OP, ON, OG, OGc };
const keys = Object.keys(names); const vals = Object.values(names);

const tplRoot = path.join(here, '틀');
const walk = (dir) => readdirSync(dir).flatMap((f) => { const p = path.join(dir, f); return statSync(p).isDirectory() ? walk(p) : (f.endsWith('.md') ? [p] : []); });
let bad = 0; const outs = [];
for (const tp of walk(tplRoot)) {
  const rel = path.relative(tplRoot, tp);
  const tpl = readFileSync(tp, 'utf8');
  const out = tpl.replace(/\{\{([\s\S]+?)\}\}/g, (_, expr) => {
    try { return String(new Function(...keys, `return (${expr});`)(...vals)); }
    catch (e) { bad += 1; console.error(`식 오류(${rel}):`, expr.slice(0, 120), '→', e.message); return `⟦${expr}⟧`; }
  });
  const relUnix = rel.split(path.sep).join('/');
  outs.push([path.join(here, rel), `<!-- 이 문서는 틀/${relUnix}에서 render.mjs가 만든다. 고칠 때는 틀을 고치고 다시 만든다 — 숫자는 results.json에서 -->\n` + out]);
}
if (bad) { console.error(`오류 ${bad}개 — 아무 파일도 쓰지 않음`); process.exit(1); }
for (const [p, text] of outs) { mkdirSync(path.dirname(p), { recursive: true }); writeFileSync(p + '.tmp', text, 'utf8'); renameSync(p + '.tmp', p); console.log('wrote', path.relative(here, p), Buffer.byteLength(text, 'utf8')); }
