// PATH 「물어보기」의 근거 묶음. 앱이 이미 보이는 공개 자료(study-data · docs-data · channel-data)와 앱 도움말(ask-help)을
// 근거 항목 배열로 옮긴다. 앱과 SYNK-talk 서버 번들이 같은 바이트로 쓰므로 순수 ESM만 쓴다(창 · DOM · 저장소 · node: 내장 모듈 없음).
// lines는 원 자료의 사실을 바꾸지 않고 문장으로 옮긴다. 금액 · 날짜 · 급수는 원 자료의 숫자를 그대로 쓴다(서버가 답의 숫자를 lines와 대조한다).
//
// 항목: { id, kind: 'rule'|'program'|'doc'|'channel'|'help', title: {ko,en}, lines: {ko:[], en:[]}, source: https URL|null,
//         checked: 'YYYY-MM-DD'|null, program: 과정 id|null, dates: [{ date, label: {ko,en} }], screen: 앱 안 자리|null,
//         ask: {ko,en}|null, unclear: boolean }
//
// screen: 앱에는 주소(해시 · 경로) 이동이 없다. app.mjs는 S.page와 id(S.univId · S.postId)로 화면을 연다.
// 그래서 screen은 「S.page 이름」 또는 「S.page 이름/id」로 적는다. 앱은 이것을 기존 동작으로 연다.
//   univDetail/<과정 id>  → univOpen(data-id)        post/<글 id>   → postOpen(data-id)
//   path/<과정 id>        → 그 과정을 고른 「내 길」(pathPick 뒤 nav path)
//   path                  → 지금 고른 과정의 「내 길」(비자 서류 묶음은 고른 과정의 비자를 따른다)
//   profile · help        → nav(data-page)
import { RULES, PROGRAMS, programsFor, daysUntil } from './study-data.mjs';
import { PROGRAM_DOCS, VISA_DOCS } from './docs-data.mjs';
import { POSTS } from './channel-data.mjs';
import { ASK_HELP } from './ask-help.mjs';

export const DATE_KINDS = Object.freeze(['open', 'close', 'due', 'event']);
export const ASK_KINDS = Object.freeze(['rule', 'program', 'doc', 'channel', 'help']);
export const ASK_STALE_DAYS = 90;

const L = (ko, en) => ({ ko, en });

/* ── 금액 · 날짜 글 ── */
const comma = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
/** 한국어 금액: 「16,000,000원(1,600만 원)」. 앱 화면은 만 단위로 읽으므로 같은 금액을 두 꼴로 적는다(숫자 대조가 어느 꼴이든 맞게). */
function wonKo(n) {
  if (n < 10000) return `${comma(n)}원`;
  const man = Math.floor(n / 10000), rest = n % 10000;
  return `${comma(n)}원(${comma(man)}만 ${rest ? `${comma(rest)}원` : '원'})`;
}
const wonEn = (n) => `₩${comma(n)}`;
const VISA_NAME = { 'D-2': L('유학(D-2)', 'student (D-2)'), 'D-4': L('어학연수(D-4)', 'language training (D-4)') };
const REGION = { local: L('지방(비수도권)', 'outside the Seoul area'), metro: L('수도권', 'in the Seoul area') };
const STAGE = {
  apply: L('원서와 함께 대학에 내요.', 'Submitted to the university with the application.'),
  admitted: L('합격 뒤 대학에 내요.', 'Submitted to the university after admission.'),
  visa: L('비자를 신청할 때 비자신청센터(KVAC)에 내요.', 'Submitted to the visa center (KVAC) when applying for the visa.')
};

/* ── 항목 짓기 ── */
function entry(o) {
  return {
    id: o.id, kind: o.kind, title: L(o.title.ko, o.title.en),
    lines: { ko: o.ko.filter(Boolean), en: o.en.filter(Boolean) },
    source: o.source ?? null, checked: o.checked ?? null, program: o.program ?? null,
    // kind: open(접수 시작) · close(접수 마감) · due(서류 기한) · event(그 밖의 날). 넘김 요약의 기한은 close · due만 쓴다.
    dates: (o.dates || []).map((d) => ({ date: d.date, kind: DATE_KINDS.includes(d.kind) ? d.kind : 'event', label: L(d.label.ko, d.label.en) })),
    screen: o.screen ?? null, ask: o.ask ? L(o.ask.ko, o.ask.en) : null, unclear: o.unclear === true
  };
}
/** 말 짝 여럿을 ko · en 배열 둘로. null은 뺀다. */
const split = (pairs) => ({ ko: pairs.filter(Boolean).map((p) => p.ko), en: pairs.filter(Boolean).map((p) => p.en) });

function ruleItems(rules) {
  return rules.map((r) => {
    let ko, en, title;
    if (r.kind === 'finance') {
      const v = VISA_NAME[r.visa], g = REGION[r.region];
      title = L(`잔고 증명 금액 · ${v.ko} · ${g.ko} 대학`, `Proof of funds · ${v.en} visa · university ${g.en}`);
      ko = [`${v.ko} 비자를 ${g.ko} 대학으로 신청하면 은행 잔고 증명 금액은 ${wonKo(r.won)} 이상이에요.`, `이 금액은 ${r.basis}부터 시행됐어요.`,
        r.inCurrentGuide ? null : '지금 공식 안내에서 같은 금액을 직접 읽지 못해 다시 확인하고 있어요.'];
      en = [`For a ${v.en} visa at a university ${g.en}, the bank balance proof must be ${wonEn(r.won)} or more.`, `This amount has applied since ${r.basis}.`,
        r.inCurrentGuide ? null : 'The same amount could not be read directly in the current official guide, so it is being checked again.'];
    } else if (r.kind === 'finance-proof') {
      const v = VISA_NAME[r.visa];
      title = L(`잔고 증명서 발급과 유지 · ${v.ko}`, `Balance certificate timing · ${v.en} visa`);
      ko = [`몽골에서 ${v.ko} 비자를 신청할 때는 본인이나 부모의 몽골 은행 잔고 증명서를 비자 신청일 기준 ${r.issuedWithinDays}일 안에 발급받아 내고, 그 금액을 ${r.heldDays}일 이상 유지해야 해요.`];
      en = [`When applying for a ${v.en} visa in Mongolia, submit a balance certificate from your own or a parent’s Mongolian bank account issued within ${r.issuedWithinDays} days of the visa application, and keep the amount for at least ${r.heldDays} days.`];
    } else if (r.kind === 'finance-waiver') {
      title = L(`TOPIK ${r.topik}급 잔고 증명 면제 계획`, `Plan to waive proof of funds for TOPIK level ${r.topik}`);
      ko = [`법무부가 ${r.basis}에 TOPIK ${r.topik}급이 있으면 잔고 증명을 면제하는 계획을 발표했어요.`, '시행일은 정해지지 않았어요. 지금은 잔고 증명이 필요해요.'];
      en = [`On ${r.basis} the Ministry of Justice announced a plan to waive the proof of funds for TOPIK level ${r.topik}.`, 'No start date has been set. For now the proof is required.'];
    } else throw new TypeError('Unknown rule kind ' + r.kind);
    // 재정 규칙의 금액 · 기간 · 계획은 「비자와 서류」 채널의 잔고 증명 글이 함께 보인다(channel-ui forYou: 'finance').
    return entry({ id: 'rule-' + r.id, kind: 'rule', title, ko, en, source: r.source.url, checked: r.checkedAt, screen: 'post/visa-funds-proof' });
  });
}

const fullName = (p) => L(`${p.name.ko}${p.level !== 'language' ? ' 학부' : ''}`, `${p.name.en}${p.level !== 'language' ? ' (undergraduate)' : ''}`);

function programItems(p) {
  const n = fullName(p), docs = PROGRAM_DOCS[p.id] || null, ask = docs && docs.ask ? docs.ask : null;
  const base = { kind: 'program', program: p.id, source: p.source.url, checked: p.checkedAt, screen: 'univDetail/' + p.id, ask };
  const q = p.requires, v = VISA_NAME[p.visa], g = REGION[p.region];
  const lang = p.level === 'language';
  const overview = entry({
    ...base, id: 'prog-' + p.id, title: L(`${n.ko} · 과정과 지원 조건`, `${n.en}: program and requirements`),
    ...split([
      L(`학교: ${n.ko}, ${p.place.ko}.`, `School: ${n.en}, ${p.place.en}.`),
      L(`과정: ${p.majors.ko}${p.term ? `, ${p.term.ko}` : ''}.`, `Program: ${p.majors.en}${p.term ? `, ${p.term.en}` : ''}.`),
      L(`비자는 ${v.ko}이고, ${g.ko} 대학이에요.`, `The visa is ${v.en}; the university is ${g.en}.`),
      L('학력 조건: 고등학교 졸업.', 'Education: high school graduation.'),
      q.topik ? L(`필요한 한국어: TOPIK ${q.topik}급 이상.`, `Korean needed: TOPIK level ${q.topik} or higher.`) : L('한국어 성적이 없어도 지원할 수 있어요.', 'You can apply without a Korean test score.'),
      q.gradePct ? L(`고교 성적: 평균 ${q.gradePct}% 이상.`, `School grades: average of ${q.gradePct}% or higher.`) : null,
      p.requiresNote || null,
      p.partner ? null : L('SYNK와 협약한 대학은 아니에요. 대학이 공개한 모집 요강에서 옮겼어요.', 'Not a SYNK partner university. Taken from the university’s published admissions guide.')
    ])
  });
  const c = p.costs;
  const costs = entry({
    ...base, id: 'prog-' + p.id + '-costs', title: L(`${n.ko} · 비용`, `${n.en}: costs`),
    ...split([
      L(`${lang ? '한 해 수업료' : '한 해 등록금'}: ${wonKo(c.tuition)}.`, `Tuition per year: ${wonEn(c.tuition)}.`),
      c.dorm === null ? L('한 해 기숙사비: 요강으로는 알 수 없어 합계에 넣지 않았어요.', 'Dormitory per year: not known from the guide, so not included in the total.')
        : L(`한 해 기숙사비: ${wonKo(c.dorm)}${p.dormLabel ? `(${p.dormLabel.ko})` : ''}.`, `Dormitory per year: ${wonEn(c.dorm)}${p.dormLabel ? ` (${p.dormLabel.en})` : ''}.`),
      c.living === null ? L('생활비: 대학이 안내하지 않아 적지 않았어요.', 'Living costs: not given by the university, so not listed.')
        : L(`한 해 생활비: ${wonKo(c.living)}.`, `Living costs per year: ${wonEn(c.living)}.`),
      p.costsNote || null
    ])
  });
  const steps = p.scholarship.map((s) => {
    const amt = Number.isInteger(s.won) ? [wonKo(s.won), wonEn(s.won)] : [`등록금의 ${Math.round(s.tuitionRate * 100)}%`, `${Math.round(s.tuitionRate * 100)}% of tuition`];
    return s.topik === 0 ? L(`모든 신입생: 장학금 ${amt[0]}.`, `Every freshman: scholarship of ${amt[1]}.`)
      : L(`TOPIK ${s.topik}급부터: 장학금 ${amt[0]}.`, `From TOPIK level ${s.topik}: scholarship of ${amt[1]}.`);
  });
  const scholarship = entry({
    ...base, id: 'prog-' + p.id + '-scholarship', title: L(`${n.ko} · 장학금`, `${n.en}: scholarships`),
    ...split([...steps, steps.length ? null : L('이 과정은 한국어 급수 장학금이 없어요.', 'This program has no Korean-level scholarship.'), p.scholarshipNote || null])
  });
  const rounds = Array.isArray(p.applyRounds) ? p.applyRounds : [[p.applyOpens ?? null, p.applyCloses ?? null]];
  const many = rounds.length > 1;
  const roundLines = [], dates = [];
  rounds.forEach(([opens, closes], i) => {
    const k = many ? L(`${i + 1}차 원서 접수`, `Round ${i + 1} applications`) : L('원서 접수', 'Applications');
    if (opens && closes) roundLines.push(L(`${k.ko}: ${opens}부터 ${closes}까지.`, `${k.en}: ${opens} to ${closes}.`));
    else if (opens) roundLines.push(L(`${k.ko} 시작: ${opens}.`, `${k.en} open: ${opens}.`));
    else if (closes) roundLines.push(L(`${k.ko} 마감: ${closes}.`, `${k.en} close: ${closes}.`));
    if (opens) dates.push({ date: opens, kind: 'open', label: L(`${k.ko} 시작`, `${k.en} open`) });
    if (closes) dates.push({ date: closes, kind: 'close', label: L(`${k.ko} 마감`, `${k.en} close`) });
  });
  const apply = entry({
    ...base, id: 'prog-' + p.id + '-apply', title: L(`${n.ko} · 원서 접수 일정`, `${n.en}: application dates`),
    ...split([...(roundLines.length ? roundLines : [L('원서 접수 날짜는 아직 확인하지 못했어요.', 'Application dates have not been confirmed yet.')]), p.applyNote || null]),
    dates
  });
  return [overview, costs, scholarship, apply];
}

/** 서류 한 줄의 사실 문장. 화면(path-ui)의 「해당자 · 구하는 곳 · 날짜 조건」 이름을 그대로 쓴다. */
function docLines(d) {
  return split([
    L(`서류: ${d.name.ko}.`, `Document: ${d.name.en}.`),
    STAGE[d.stage],
    d.only ? L(`해당자: ${d.only.cond.ko}.`, `Who: ${d.only.cond.en}.`) : null,
    d.from ? L(`구하는 곳: ${d.from.ko}`, `Where to get it: ${d.from.en}`) : null,
    d.when ? L(`날짜 조건: ${d.when.ko}`, `Date rule: ${d.when.en}`) : null,
    d.note || null,
    // 화면(path-ui)과 같은 머리: 비자 서류는 「KVAC에 확인할 것」, 대학 서류는 「요강에서 두 가지로 읽혀요」와 「대학에 먼저 물어보세요」.
    !d.unclear ? null : d.stage === 'visa' ? L(`KVAC에 확인할 것: ${d.unclear.ko}`, `Check with KVAC: ${d.unclear.en}`)
      : L(`요강에서 두 가지로 읽혀요: ${d.unclear.ko} 대학에 먼저 물어보세요.`, `The guide can be read two ways: ${d.unclear.en} Ask the university first.`)
  ]);
}

function programDocItems(p) {
  const pd = PROGRAM_DOCS[p.id];
  if (!pd) return [];
  const n = fullName(p), ask = pd.ask || null;
  const base = { kind: 'doc', program: p.id, source: pd.source.url, checked: pd.checkedAt, screen: 'path/' + p.id, ask };
  const set = entry({
    ...base, id: pd.id, title: L(`${n.ko} · 서류 내는 법`, `${n.en}: how to submit documents`), unclear: (pd.unclear || []).length > 0,
    ...split([
      L(`${pd.term.ko}.`, `${pd.term.en}.`),
      pd.status || null,
      pd.how,
      ...(pd.rules || []),
      ...(pd.unclear || []).map((u) => L(`요강에서 두 가지로 읽혀요: ${u.ko}`, `The guide can be read two ways: ${u.en}`)),
      ...pd.deadlines.map((x) => L(`${x.label.ko}: ${x.start}.`, `${x.label.en}: ${x.start}.`)),
      ask ? L(`요강 문의처: ${ask.ko}.`, `Contact in the guide: ${ask.en}.`) : null
    ]),
    dates: pd.deadlines.map((x) => ({ date: x.start, kind: 'due', label: x.label }))
  });
  const rows = pd.docs.map((d) => entry({
    ...base, id: 'doc-' + d.id, title: L(`${n.ko} · ${d.name.ko}`, `${n.en}: ${d.name.en}`), unclear: !!d.unclear, ...docLines(d)
  }));
  return [set, ...rows];
}

function visaDocItems(visas) {
  return visas.flatMap((key) => {
    const vd = VISA_DOCS[key];
    // 비자 서류의 물을 곳은 KVAC 몽골이다(서류 목록을 읽은 그 누리집). 전화 · 메일은 누리집에서 확인하게 한다.
    const base = { kind: 'doc', program: null, source: vd.source.url, checked: vd.checkedAt, screen: 'path',
      ask: L(`KVAC 몽골(한국 비자 신청 센터) — ${vd.source.url}`, `KVAC Mongolia (Korea Visa Application Center) — ${vd.source.url}`) };
    const set = entry({
      ...base, id: vd.id, title: L(`${vd.name.ko} 비자 서류 · KVAC 몽골`, `${vd.name.en} visa documents · KVAC Mongolia`),
      ...split([L(`${vd.name.ko} 비자 서류는 KVAC 몽골 서류 목록에서 읽었어요.`, `The ${vd.name.en} visa documents are from the KVAC Mongolia list.`), ...(vd.rules || [])])
    });
    const rows = vd.docs.map((d) => entry({
      ...base, id: 'doc-' + d.id, title: L(`${vd.name.ko} 비자 · ${d.name.ko}`, `${vd.name.en} visa: ${d.name.en}`), unclear: !!d.unclear, ...docLines(d)
    }));
    return [set, ...rows];
  });
}

function postItems(posts) {
  return posts.map((p) => {
    const c = p.criteria;
    return entry({
      id: 'post-' + p.id, kind: 'channel', title: p.title, source: p.source.url, checked: p.checkedAt, screen: 'post/' + p.id,
      ...split([
        p.title,
        ...p.points,
        p.note || null,
        // 장학금 성적 기준은 채널 화면의 「내게 해당되나요?」와 같은 말로 적는다.
        c ? L(`기준: ${c.of ? `${c.of.ko} ` : ''}평균 ${c.gradePct}% 이상${c.other ? ` (${c.other.ko})` : ''}.`, `Requirement: ${c.of ? `${c.of.en}, ` : ''}average of ${c.gradePct}% or higher${c.other ? ` (${c.other.en})` : ''}.`) : null,
        ...p.dates.map((d) => L(`${d.label.ko}: ${d.start}${d.kind === 'apply' && d.end ? `부터 ${d.end}까지` : ''}.`, `${d.label.en}: ${d.start}${d.kind === 'apply' && d.end ? ` to ${d.end}` : ''}.`))
      ]),
      dates: p.dates.flatMap((d) => (d.kind === 'apply' && d.end ? [{ date: d.start, kind: 'open', label: d.label }, { date: d.end, kind: 'close', label: d.label }] : [{ date: d.start, kind: 'event', label: d.label }]))
    });
  });
}

function helpItems(help) {
  // 도움말의 source는 앱 안 자리다. 근거 항목에서는 screen으로 옮기고 공식 출처는 비운다.
  return help.map((h) => entry({ id: h.id, kind: 'help', title: h.title, ko: [...h.lines.ko], en: [...h.lines.en], checked: h.checked, screen: h.source }));
}

/** 모든 근거 항목(신선도와 상관없이). 공개판 규칙(programsFor(…, true))으로 예시 과정은 싣지 않는다. */
export function allAskSources() {
  const programs = programsFor(PROGRAMS, true);
  const visas = [...new Set(programs.map((p) => (p.level === 'language' ? 'D-4-1' : 'D-2')))].sort();
  return [
    ...ruleItems(RULES),
    ...programs.flatMap(programItems),
    ...programs.flatMap(programDocItems),
    ...visaDocItems(visas),
    ...postItems(POSTS),
    ...helpItems(ASK_HELP),
    programListItem(programs)
  ];
}

/** PATH가 다루는 과정 목록. 근거에 없는 대학을 물으면 AI가 이 항목을 근거로 「PATH에는 이 과정들만 있어요」라고 답한다. */
function programListItem(programs) {
  const names = programs.map(fullName);
  return entry({
    id: 'help-programs', kind: 'help', title: L('PATH가 다루는 과정', 'Programs PATH covers'),
    // 과정 자료와 함께 낡는다: 가장 이른 확인한 날을 단다.
    checked: programs.map((p) => p.checkedAt).filter(Boolean).sort()[0] ?? null, screen: 'univDetail/' + programs[0].id,
    ko: [`PATH 앱이 지금 자료를 갖춘 과정은 ${names.map((n) => n.ko).join(', ')}이에요.`, '이 밖의 대학 · 과정은 아직 PATH 자료에 없어요. 그 대학의 공식 모집 요강을 보거나 대학에 물어보세요.'],
    en: [`The programs PATH has data for right now are: ${names.map((n) => n.en).join(', ')}.`, 'Other universities and programs are not in PATH yet. Check that university’s official admissions guide or ask the university.']
  });
}

/* ── 해시 ── FNV-1a 32비트, UTF-8 바이트 위. */
function fnv1a(text) {
  const bytes = new TextEncoder().encode(text);
  let h = 0x811c9dc5;
  for (const b of bytes) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

const deepFreeze = (o) => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v); } return o; };
const toTime = (now) => (now instanceof Date ? now.getTime() : new Date(now).getTime());

/**
 * 지금 쓸 근거 묶음. 확인한 날이 days보다 오래된 항목은 빼서 stale에 id로 둔다(checked가 null인 도움말은 늘 싣는다).
 * version은 싣는 항목 배열 JSON의 FNV-1a 32비트 hex다(같은 항목이면 같은 값).
 */
export function buildAskSources(now = new Date(), { days = ASK_STALE_DAYS } = {}) {
  const t = toTime(now);
  const old = (d) => d !== null && (t - Date.parse(d + 'T00:00:00Z')) / 86400000 > days;
  const items = [], stale = [];
  for (const it of allAskSources()) (old(it.checked) ? stale.push(it.id) : items.push(it));
  return deepFreeze({ items, stale, version: fnv1a(JSON.stringify(items)) });
}

/** 프롬프트에 싣는 글. 항목마다 [id], 사실 줄, (있으면) 물을 곳. 한 언어만 싣는다(토큰을 절반으로): 'en'이면 영어(없으면 한국어), 그 밖(ko · mn)은 한국어(없으면 영어). */
export function askSourceText(items, lang) {
  const en = lang === 'en';
  return items.map((it) => {
    const out = ['[' + it.id + ']'];
    const ko = it.lines.ko || [], eng = it.lines.en || [];
    for (const l of (en ? (eng.length ? eng : ko) : (ko.length ? ko : eng))) out.push(l);
    if (it.ask) out.push('ask: ' + (en ? it.ask.en : it.ask.ko));
    return out.join('\n');
  }).join('\n\n');
}

/** id → 항목. */
export function askSourceIndex(items) {
  return new Map(items.map((it) => [it.id, it]));
}

/** 그 과정 항목들에 달린 날 가운데 오늘(한국 날짜) 이후의 날. 오름차순, 중복 없음. kinds를 주면 그 종류의 날만(넘김 요약의 기한은 ['close', 'due']). */
export function programDates(items, programId, now = new Date(), kinds = null) {
  const out = new Set();
  for (const it of items) if (it.program === programId) for (const d of it.dates) if ((!kinds || kinds.includes(d.kind)) && daysUntil(d.date, now) !== null) out.add(d.date);
  return [...out].sort();
}
/** 넘김 요약의 기한으로 쓰는 날 종류. */
export const DEADLINE_KINDS = Object.freeze(['close', 'due']);
