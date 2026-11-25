/* 세 시안이 함께 쓰는 질문 연결. 답 글은 synk.im 공개 안내에서 추린 data.json이다.
   시안에서는 작은 검색기로 가장 가까운 답을 고른다. 공개본에서는 지금의 질문 엔진(knowledge-engine.js)이 이 자리를 맡는다. */
const BRANDS = ['lab', 'shift', 'pulse', 'path'];
/* 답이 나온 안내 묶음의 이름. 사업 이름만 쓰면 처음 온 사람이 모르니 하는 일을 붙인다 */
export const BOOK = { company: 'SYNK 회사 소개', path: 'PATH · 한국 유학 지원', lab: 'LAB · 한국어 상황극', shift: 'SHIFT · AI 강의', pulse: 'PULSE · AI 광고 제작', vision: 'SYNK 비전', philosophy: 'SYNK가 일하는 방식', guide: 'SYNK 공개 안내' };
let data = null, records = null, docs = null, loading = null;

export const STARTERS = [
  { q: 'SYNK는 어떤 회사인가요?', id: 'synk-intro' },
  { q: '한국 유학은 어디까지 도와주나요?', id: 'path-support' },
  { q: 'AI 강의를 맡기고 싶어요', id: 'shift-services' },
  { q: '광고 영상을 맡길 수 있나요?', id: 'pulse-studio' },
  { q: '솔리오와 PC 앱은 무엇인가요?', id: 'synk-platform' },
  { q: '어디로 문의하나요?', id: 'guide-contact' },
];

export function load() {
  loading ??= fetch('data.json').then(r => r.json()).then(j => {
    data = j;
    records = new Map(j.records.map(r => [r.id, r]));
    docs = new Map(j.docs.map(d => [d.id, d]));
    for (const r of j.records) { r.kw = r.k.map(norm).filter(k => k.length > 1); r.qt = new Set([r.t, ...r.q].flatMap(toks)); r.gs = [r.t, ...r.q].map(grams); }
  });
  return loading;
}

/* 작은 검색기: 낱말 끝의 조사를 떼어 견주고, 자료의 열쇠말 · 질문 낱말 · 두 글자 조각이 겹치는 만큼 점수를 준다.
   돈 · 자리 · 문의처럼 뜻이 분명한 낱말은 그 답에 점수를 더 준다. 점수가 낮으면 찾지 못했다고 말한다. */
const END = /(인가요|이에요|예요|해요|하나요|할까요|되나요|있나요|없나요|주세요|싶어요|은요|는요|나요|까요|에서|으로|부터|까지|은|는|이|가|을|를|에|로|도|와|과|의|요|랑)$/;
const norm = s => String(s).toLowerCase().replace(/[^0-9a-z가-힣]/g, '');
const toks = s => String(s).toLowerCase().split(/[^0-9a-z가-힣]+/).filter(Boolean).map(w => { let x = w; for (let i = 0; i < 2; i++) { const y = x.replace(END, ''); if (y && y !== x) x = y; } return x; });
function grams(s) { const t = norm(s), g = new Set(); for (let i = 0; i < t.length - 1; i++) g.add(t.slice(i, i + 2)); return g; }
function dice(a, b) { if (!a.size || !b.size) return 0; let n = 0; for (const x of a) if (b.has(x)) n++; return 2 * n / (a.size + b.size); }
const RULES = [[/비용|가격|요금|단가|얼마|할인|수강료/, 'guide-availability'], [/주소|위치|사무실|지사|어디에있/, 'lab-location'], [/대표|창업자|만든사람|누가만들/, 'synk-planner'], [/다운로드|설치|pc앱|윈도우|맥용/, 'synk-platform'], [/채용|입사|인턴|강사모집/, 'guide-careers'], [/아틀라스|atlas/, 'synk-atlas'], [/topik|토픽/, 'lab-topik'], [/한국어.*(시작|처음)|처음.*한국어/, 'lab-start'], [/비자|입학|대학지원|유학상담|유학준비/, 'path-support'], [/(강의|교육|자동화).*(요청|의뢰|맡기|신청|문의)|기업강의|기업교육/, 'shift-services'], [/광고|cf|영상제작|뮤직비디오|브랜드필름/, 'pulse-studio'], [/솔리오|solio/, 'shift-solio'], [/영어|몽골어|english|다른언어/, 'guide-language'], [/개인정보|저장되|기록남/, 'guide-privacy'], [/문의|연락|메일|상담/, 'guide-contact']];
const GREET = /^(안녕|안녕하세요|hi|hello|처음왔어요|반가워요)$/;
let df = null;

function search(question) {
  const flat = norm(question), qt = toks(question), qg = grams(question);
  if (GREET.test(flat)) return { id: 'synk-choose', score: 99 };
  if (!df) { df = new Map(); for (const r of records.values()) for (const t of r.qt) df.set(t, (df.get(t) || 0) + 1); }
  const bonus = new Map(); for (const [re, id] of RULES) if (re.test(flat) && !bonus.size) bonus.set(id, 5);
  let best = null;
  for (const r of records.values()) {
    let s = bonus.get(r.id) || 0;
    for (const k of r.kw) if (flat.includes(k)) s += 3 * Math.min(1, k.length / 3);
    for (const t of qt) if (r.qt.has(t)) s += 1.2 * Math.log(1 + records.size / (df.get(t) || 1)) / 3;
    s += 3 * Math.max(...r.gs.map(g => dice(qg, g)));
    if (!best || s > best.score) best = { id: r.id, score: s };
  }
  return best;
}

/* 첫눈에는 답의 첫 문장(짧으면 두 문장)만 보이고, 나머지는 이어지는 문단으로 넘긴다 */
function split(t) {
  const ss = String(t).split(/(?<=[.?!])\s+/).filter(Boolean);
  const n = ss[0].length < 45 && ss.length > 2 ? 2 : 1;
  return [ss.slice(0, n).join(' '), ss.slice(n).join(' ')];
}

const outward = href => href.startsWith('/#') ? href : 'https://synk.im' + href;

function shape(question, r, missed) {
  const src = docs.get(r.s);
  const [head, tail] = split(r.a[0]);
  return {
    question, found: !missed,
    lead: missed ? '공개한 안내에서 이 질문에 맞는 답을 찾지 못했어요.' : head,
    body: missed ? ['한국 유학, AI 강의, 광고, 회사 소개 가운데 궁금한 쪽을 골라 다시 물어보시거나, hello@synk.im으로 메일을 보내 주세요.'] : [tail, ...r.a.slice(1)].filter(Boolean),
    action: missed ? { label: '문의하기', href: '/#contact' } : r.go?.href && r.go.label ? { label: r.go.label, href: outward(r.go.href) } : null,
    related: (missed ? ['synk-choose', 'guide-contact'] : r.rel.slice(0, 2)).map(id => records.get(id)).filter(Boolean).map(x => ({ q: x.q[0] || x.t, id: x.id })),
    topic: BRANDS.includes(r.b) && !missed ? r.b : 'synk',
    source: BOOK[missed ? 'guide' : r.s] || (src ? src.t.split(' — ')[0] : 'SYNK 공개 안내'), sourceId: missed ? 'guide' : r.s,
    checked: r.on ? r.on.replace(/-/g, '.') : '',
  };
}

export async function ask(question) {
  await load();
  const hit = search(question);
  return shape(question, records.get(hit.id), hit.score < 1.6);
}

export async function askRecord(id, question) {
  await load();
  const r = records.get(id);
  return shape(question || r.q[0] || r.t, r, false);
}

/* 책장 판: 공개 안내 묶음(책)마다 답 수와 앞의 질문 몇 개 */
export async function shelf() {
  await load();
  const out = new Map(data.docs.map(d => [d.id, { id: d.id, title: d.t, count: 0, first: [] }]));
  for (const r of records.values()) { const b = out.get(r.s); if (!b) continue; b.count++; if (b.first.length < 3) b.first.push({ id: r.id, q: r.q[0] || r.t }); }
  return out;
}
