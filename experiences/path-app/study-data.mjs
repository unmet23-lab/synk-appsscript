// PATH 유학 자료. 순수 자료와 검사만 둔다(창, DOM, 저장소를 쓰지 않는다).
// RULES는 공식 조건이다. 출처 · 기준일 · 확인한 날이 없으면 모듈을 읽을 때 던진다.
// inCurrentGuide는 「지금 쓰는 공식 안내에서 같은 값을 직접 읽었는가」다. false이면 대조를 「확인 필요」에 두고 기준일만 알린다.
// PROGRAMS는 과정이다. 협약 전에는 모두 예시(example: true)이고 실제 대학 이름을 쓰지 않는다.

export const RULE_STATUS = Object.freeze(['in-force', 'announced']);
export const LEVELS = Object.freeze(['language', 'undergraduate']);
export const REGIONS = Object.freeze(['local', 'metro']);
export const VISAS = Object.freeze(['D-2', 'D-4']);
export const IMAGE_IDS = Object.freeze(['univ-a', 'univ-b', 'univ-c']);
export const MAX_TOPIK = 6;

// 출처는 금액을 지금 직접 읽은 문서다(2026-11-21). 금액은 2023-07-03에 시행됐다(법무부 2023-06-23 보도자료).
// 학위 과정: 법무부 2026-10-07 보도자료 별첨의 「현행」 칸. 어학연수: 주몽골대사관 비자신청센터(KVAC) 안내(한국어 · 몽골어 쪽).
const MOJ_2026 = Object.freeze({
  title: Object.freeze({ ko: '법무부 2026-10-07 보도자료', en: 'Ministry of Justice press release, 2026-10-07' }),
  url: 'https://www.moj.go.kr/bbs/moj/182/611170/artclView.do'
});
const KVAC_D2 = Object.freeze({
  title: Object.freeze({ ko: '주몽골대사관 비자신청센터 유학(D-2) 안내', en: 'Korea Visa Application Center in Mongolia, Study (D-2) guide' }),
  url: 'https://www.visaforkorea.mn/ko/study-visa-d-2-1d-2-4'
});
const KVAC_D4 = Object.freeze({
  title: Object.freeze({ ko: '주몽골대사관 비자신청센터 어학연수(D-4-1) 안내', en: 'Korea Visa Application Center in Mongolia, Language trainee (D-4-1) guide' }),
  url: 'https://www.visaforkorea.mn/ko/korean-language-trainee-d-4-1'
});

export const RULES = Object.freeze([
  { id: 'finance-d2-local', kind: 'finance', visa: 'D-2', region: 'local', won: 16000000, status: 'in-force', basis: '2023-07-03', inCurrentGuide: true, source: MOJ_2026, checkedAt: '2026-11-21' },
  { id: 'finance-d2-metro', kind: 'finance', visa: 'D-2', region: 'metro', won: 20000000, status: 'in-force', basis: '2023-07-03', inCurrentGuide: true, source: MOJ_2026, checkedAt: '2026-11-21' },
  { id: 'finance-d4-local', kind: 'finance', visa: 'D-4', region: 'local', won: 8000000, status: 'in-force', basis: '2023-07-03', inCurrentGuide: true, source: KVAC_D4, checkedAt: '2026-11-21' },
  { id: 'finance-d4-metro', kind: 'finance', visa: 'D-4', region: 'metro', won: 10000000, status: 'in-force', basis: '2023-07-03', inCurrentGuide: true, source: KVAC_D4, checkedAt: '2026-11-21' },
  // 몽골에서 신청할 때 잔고 증명서를 내는 방법. 대조에는 쓰지 않고 재정 칸 아래 안내로 보인다.
  { id: 'finance-proof-mn', kind: 'finance-proof', issuedWithinDays: 14, heldDays: 30, status: 'in-force', basis: '2026-11-21', source: KVAC_D2, checkedAt: '2026-11-21' },
  // 계획 발표: 대조에는 쓰지 않고 안내 글로만 보인다. 시행일이 정해지면 in-force 규칙으로 바꾼다.
  { id: 'finance-topik4-waiver', kind: 'finance-waiver', topik: 4, status: 'announced', basis: '2026-10-07', source: MOJ_2026, checkedAt: '2026-11-21' }
].map(Object.freeze));

const L = (ko, en) => Object.freeze({ ko, en });

export const PROGRAMS = Object.freeze([
  {
    id: 'example-a-ug', example: true, name: L('예시대학 A', 'Example University A'), place: L('전북 전주', 'Jeonju, Jeonbuk'),
    region: 'local', level: 'undergraduate', visa: 'D-2', majors: L('경영 · 컴퓨터 · 간호', 'Business · Computing · Nursing'), image: 'univ-a',
    requires: { education: 'highschool', gradePct: 70, topik: 3 },
    costs: { tuition: 6400000, dorm: 1800000, living: 6000000 },
    scholarship: [{ topik: 3, tuitionRate: 0.3 }, { topik: 4, tuitionRate: 0.5 }],
    applyOpens: '2027-01-21', certified: false, source: null, checkedAt: null
  },
  {
    id: 'example-b-lang', example: true, name: L('예시대학 B 한국어교육원', 'Example University B Korean Language Institute'), place: L('전북 익산', 'Iksan, Jeonbuk'),
    region: 'local', level: 'language', visa: 'D-4', majors: L('한국어 과정 1년', 'One-year Korean language program'), image: 'univ-b',
    requires: { education: 'highschool', gradePct: 60, topik: 0 },
    costs: { tuition: 5200000, dorm: 1600000, living: 5400000 },
    scholarship: [],
    applyOpens: '2026-12-31', certified: false, source: null, checkedAt: null
  },
  {
    id: 'example-c-ug', example: true, name: L('예시대학 C', 'Example University C'), place: L('충남 천안', 'Cheonan, Chungnam'),
    region: 'local', level: 'undergraduate', visa: 'D-2', majors: L('기계 · 호텔 · 디자인', 'Mechanical · Hospitality · Design'), image: 'univ-c',
    requires: { education: 'highschool', gradePct: 75, topik: 4 },
    costs: { tuition: 6800000, dorm: 2000000, living: 6600000 },
    scholarship: [{ topik: 4, tuitionRate: 0.4 }, { topik: 5, tuitionRate: 0.6 }],
    applyOpens: '2027-02-04', certified: false, source: null, checkedAt: null
  }
].map((p) => Object.freeze({ ...p, requires: Object.freeze(p.requires), costs: Object.freeze(p.costs), scholarship: Object.freeze(p.scholarship.map(Object.freeze)) })));

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + 'T00:00:00Z'));
const isText = (v) => typeof v === 'string' && v.trim().length > 0 && v.length <= 200;
const isPair = (v) => isObj(v) && isText(v.ko) && isText(v.en);
const isWon = (v) => Number.isSafeInteger(v) && v >= 0 && v <= 1000000000;
const isLevel = (v) => Number.isInteger(v) && v >= 0 && v <= MAX_TOPIK;
const isHttps = (v) => { try { const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; } };
const isSource = (v) => isObj(v) && isPair(v.title) && isHttps(v.url);
const fail = (m) => { throw new TypeError('Invalid study data: ' + m); };

export function financeRule(rules, visa, region) {
  return rules.find((r) => r.kind === 'finance' && r.status === 'in-force' && r.visa === visa && r.region === region) || null;
}
export function announcedRules(rules, kind) {
  return rules.filter((r) => r.status === 'announced' && r.kind === kind);
}
export function proofRule(rules) {
  return rules.find((r) => r.kind === 'finance-proof' && r.status === 'in-force' && !r.stale) || null;
}
export function programById(programs, id) {
  return programs.find((p) => p.id === id) || null;
}

/** 자료의 약속을 검사한다. 어기면 던진다(틀린 자료로 화면을 그리지 않는다). */
export function validateStudyData(rules, programs) {
  if (!Array.isArray(rules) || !Array.isArray(programs)) fail('lists');
  const ruleIds = new Set();
  for (const r of rules) {
    if (!isObj(r) || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(r.id) || ruleIds.has(r.id)) fail('rule id');
    ruleIds.add(r.id);
    if (!RULE_STATUS.includes(r.status) || !isDate(r.basis) || !isDate(r.checkedAt) || !isSource(r.source)) fail('rule source ' + r.id);
    if (r.kind === 'finance') { if (!VISAS.includes(r.visa) || !REGIONS.includes(r.region) || !isWon(r.won) || typeof r.inCurrentGuide !== 'boolean') fail('finance rule ' + r.id); }
    else if (r.kind === 'finance-waiver') { if (!isLevel(r.topik)) fail('waiver rule ' + r.id); }
    else if (r.kind === 'finance-proof') { if (![r.issuedWithinDays, r.heldDays].every((d) => Number.isInteger(d) && d > 0 && d <= 366)) fail('proof rule ' + r.id); }
    else fail('rule kind ' + r.id);
  }
  const seenFinance = new Set();
  for (const r of rules) if (r.kind === 'finance' && r.status === 'in-force') {
    const key = r.visa + '/' + r.region;
    if (seenFinance.has(key)) fail('duplicate finance rule ' + key);
    seenFinance.add(key);
  }
  const ids = new Set();
  for (const p of programs) {
    if (!isObj(p) || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(p.id) || ids.has(p.id)) fail('program id');
    ids.add(p.id);
    if (typeof p.example !== 'boolean' || !isPair(p.name) || !isPair(p.place) || !isPair(p.majors)) fail('program text ' + p.id);
    if (!REGIONS.includes(p.region) || !LEVELS.includes(p.level) || !VISAS.includes(p.visa) || !IMAGE_IDS.includes(p.image)) fail('program kind ' + p.id);
    if ((p.level === 'language') !== (p.visa === 'D-4')) fail('program visa ' + p.id);
    const q = p.requires;
    if (!isObj(q) || q.education !== 'highschool' || !Number.isInteger(q.gradePct) || q.gradePct < 0 || q.gradePct > 100 || !isLevel(q.topik)) fail('program requires ' + p.id);
    const c = p.costs;
    if (!isObj(c) || !isWon(c.tuition) || !isWon(c.dorm) || !isWon(c.living)) fail('program costs ' + p.id);
    if (!Array.isArray(p.scholarship)) fail('program scholarship ' + p.id);
    let last = 0, lastRate = 0;
    for (const s of p.scholarship) {
      if (!isObj(s) || !isLevel(s.topik) || s.topik <= last || s.topik < q.topik || typeof s.tuitionRate !== 'number' || !(s.tuitionRate > lastRate) || s.tuitionRate > 1) fail('scholarship steps ' + p.id);
      last = s.topik; lastRate = s.tuitionRate;
    }
    if (!(p.applyOpens === null || isDate(p.applyOpens)) || typeof p.certified !== 'boolean') fail('program dates ' + p.id);
    if (p.example) { if (p.certified) fail('example cannot be certified ' + p.id); }
    else if (!isSource(p.source) || !isDate(p.checkedAt)) fail('real program needs a source ' + p.id);
    if (!seenFinance.has(p.visa + '/' + p.region)) fail('no finance rule for ' + p.id);
  }
  return true;
}

/** 확인한 날이 days보다 오래된 규칙과 실제 과정. 예시 과정은 세지 않는다. */
export function staleItems(rules, programs, now = new Date(), days = 90) {
  const t = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const old = (d) => (t - Date.parse(d + 'T00:00:00Z')) / 86400000 > days;
  return [
    ...rules.filter((r) => old(r.checkedAt)).map((r) => ({ type: 'rule', id: r.id, checkedAt: r.checkedAt })),
    ...programs.filter((p) => !p.example && old(p.checkedAt)).map((p) => ({ type: 'program', id: p.id, checkedAt: p.checkedAt }))
  ];
}

/** 지금 쓸 규칙 목록. 확인한 날이 days보다 오래된 규칙에는 stale 표시를 붙인다(대조는 「확인 필요」로 내려간다). */
export function rulesAt(rules, now = new Date(), days = 90) {
  const old = new Set(staleItems(rules, [], now, days).map((x) => x.id));
  return rules.map((r) => (old.has(r.id) ? { ...r, stale: true } : r));
}

/** 화면에 낼 과정. 공개판에는 예시 과정을 싣지 않는다(예시의 금액 · 일정은 만든 값이다). */
export function programsFor(programs, publicWeb) {
  return publicWeb ? programs.filter((p) => !p.example) : [...programs];
}

/** 접수 시작까지 남은 날. 날짜가 없거나 지났으면 null(화면은 「일정 확인 필요」로 쓴다). */
export function daysUntil(dateText, now = new Date()) {
  if (!isDate(dateText)) return null;
  const n = now instanceof Date ? now : new Date(now);
  const today = Date.UTC(n.getFullYear(), n.getMonth(), n.getDate());
  const d = Math.round((Date.parse(dateText + 'T00:00:00Z') - today) / 86400000);
  return d >= 0 ? d : null;
}

validateStudyData(RULES, PROGRAMS);
