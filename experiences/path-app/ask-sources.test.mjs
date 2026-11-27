import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildAskSources, allAskSources, askSourceText, askSourceIndex, programDates, ASK_KINDS } from './ask-sources.mjs';
import { ASK_HELP, HELP_CONTACT } from './ask-help.mjs';
import { RULES, PROGRAMS, programsFor } from './study-data.mjs';
import { PROGRAM_DOCS, VISA_DOCS } from './docs-data.mjs';
import { POSTS } from './channel-data.mjs';

const NOW = new Date('2026-11-27T12:00:00+09:00');
const built = buildAskSources(NOW);
const items = built.items;
const byId = askSourceIndex(items);
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + 'T00:00:00Z'));
const isPair = (v) => v && typeof v === 'object' && typeof v.ko === 'string' && v.ko.trim() && typeof v.en === 'string' && v.en.trim();
const KEYS = ['id', 'kind', 'title', 'lines', 'source', 'checked', 'program', 'dates', 'screen', 'ask', 'unclear'];
const SCREEN_RE = /^(univDetail|post|path)\/[a-z0-9][a-z0-9-]*$|^(path|profile|help)$/;
const allText = (it, lang) => it.lines[lang].join('\n');

test('항목 id는 겹치지 않고 원 자료의 id를 살린다', () => {
  const all = allAskSources();
  assert.equal(new Set(all.map((i) => i.id)).size, all.length);
  for (const r of RULES) assert.ok(byId.has('rule-' + r.id), r.id);
  for (const p of programsFor(PROGRAMS, true)) for (const s of ['', '-costs', '-scholarship', '-apply']) assert.ok(byId.has('prog-' + p.id + s), p.id + s);
  for (const pd of Object.values(PROGRAM_DOCS)) { assert.ok(byId.has(pd.id)); for (const d of pd.docs) assert.ok(byId.has('doc-' + d.id), d.id); }
  for (const vd of Object.values(VISA_DOCS)) { assert.ok(byId.has(vd.id)); for (const d of vd.docs) assert.ok(byId.has('doc-' + d.id), d.id); }
  for (const p of POSTS) assert.ok(byId.has('post-' + p.id), p.id);
  for (const h of ASK_HELP) assert.ok(byId.has(h.id), h.id);
});

test('모든 항목이 정한 꼴을 지킨다', () => {
  const programIds = new Set(programsFor(PROGRAMS, true).map((p) => p.id));
  for (const it of allAskSources()) {
    assert.deepEqual(Object.keys(it), KEYS, it.id);
    assert.ok(typeof it.id === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(it.id), it.id);
    assert.ok(ASK_KINDS.includes(it.kind), it.id);
    assert.ok(isPair(it.title), it.id);
    assert.ok(Array.isArray(it.lines.ko) && it.lines.ko.length > 0 && it.lines.ko.every((l) => typeof l === 'string' && l.trim()), it.id);
    assert.ok(Array.isArray(it.lines.en) && it.lines.en.length === it.lines.ko.length && it.lines.en.every((l) => typeof l === 'string' && l.trim()), it.id);
    assert.ok(it.source === null || new URL(it.source).protocol === 'https:', it.id);
    assert.ok(it.checked === null || isDate(it.checked), it.id);
    assert.ok(it.program === null || programIds.has(it.program), it.id);
    assert.ok(Array.isArray(it.dates) && it.dates.every((d) => isDate(d.date) && isPair(d.label)), it.id);
    assert.ok(it.screen === null || SCREEN_RE.test(it.screen), it.id + ' ' + it.screen);
    assert.ok(it.ask === null || isPair(it.ask), it.id);
    assert.equal(typeof it.unclear, 'boolean', it.id);
    // 도움말 말고는 공식 출처와 확인한 날이 있다.
    if (it.kind !== 'help') { assert.ok(it.source, it.id); assert.ok(it.checked, it.id); } else assert.equal(it.source, null);
  }
});

test('화면 자리는 실제로 있는 과정 · 글을 가리킨다', () => {
  const postIds = new Set(POSTS.map((p) => p.id)), programIds = new Set(programsFor(PROGRAMS, true).map((p) => p.id));
  for (const it of items) {
    const [page, id] = (it.screen || '').split('/');
    if (page === 'post') assert.ok(postIds.has(id), it.id);
    if (page === 'univDetail' || (page === 'path' && id)) assert.ok(programIds.has(id), it.id);
  }
  assert.equal(byId.get('rule-finance-d2-local').screen, 'post/visa-funds-proof');
  assert.equal(byId.get('help-delete-study-data').screen, 'profile');
});

test('예시 과정은 싣지 않는다', () => {
  const examples = PROGRAMS.filter((p) => p.example).map((p) => p.id);
  assert.ok(examples.length > 0);
  for (const it of allAskSources()) {
    assert.ok(!examples.includes(it.program), it.id);
    for (const ex of examples) assert.ok(!it.id.includes(ex), it.id);
  }
  assert.ok(!askSourceText(items, 'ko').includes('예시대학'));
});

test('확인한 지 90일이 지나면 빼서 stale에 둔다. 도움말은 늘 싣는다', () => {
  assert.deepEqual(built.stale, []);
  assert.equal(items.length, allAskSources().length);
  // 지금 자료는 2026-11-21 · 22에 확인했다. 2027-02-20 00:00(UTC)에는 11-21 항목만 90일을 넘는다(study-data staleItems와 같은 셈).
  const later = buildAskSources(new Date('2027-02-20T00:00:00Z'));
  assert.ok(later.stale.includes('rule-finance-d2-local'));
  assert.ok(later.stale.includes('prog-jbnu-ug'));
  assert.ok(!later.stale.includes('docs-jbnu-ug'), '11-22 확인 항목은 아직 남는다');
  const far = buildAskSources(new Date('2027-06-01T00:00:00Z'));
  assert.deepEqual(far.items.map((i) => i.kind), ASK_HELP.map(() => 'help'));
  assert.equal(far.stale.length + far.items.length, allAskSources().length);
  assert.notEqual(far.version, built.version);
  // days를 바꿀 수 있다.
  assert.ok(buildAskSources(NOW, { days: 3 }).stale.includes('rule-finance-d2-local'));
});

test('askSourceText와 version은 같은 입력에 같은 값이다', () => {
  const again = buildAskSources(NOW);
  assert.equal(again.version, built.version);
  assert.match(built.version, /^[0-9a-f]{8}$/);
  assert.equal(askSourceText(items, 'ko'), askSourceText(again.items, 'ko'));
  assert.equal(askSourceText(items, 'en'), askSourceText(again.items, 'en'));
  const one = [byId.get('rule-finance-d2-local')];
  const ko = askSourceText(one, 'mn'), en = askSourceText(one, 'en');
  assert.ok(ko.startsWith('[rule-finance-d2-local]\n'));
  // 한 언어만 싣는다: 한국어 · 몽골어 질문은 한국어 줄, 영어 질문은 영어 줄.
  assert.ok(/[가-힣]/.test(ko) && !/[A-Za-z]{6,} [A-Za-z]{4,} [A-Za-z]{4,}/.test(ko.replace(/https?:\S+/g, '')));
  assert.ok(!/[가-힣]/.test(en));
  // ask가 있으면 물을 곳을 싣는다.
  assert.ok(askSourceText([byId.get('docs-wku-ug')], 'ko').includes('ask: 원광대 국제교류과'));
  assert.throws(() => { items[0].lines.ko.push('x'); });
});

test('programDates: 그 과정의 오늘 이후 날, 오름차순, 중복 없음', () => {
  assert.deepEqual(programDates(items, 'jj-ug', NOW), ['2026-12-01', '2026-12-11', '2026-12-18', '2027-01-04', '2027-01-13', '2027-01-15']);
  // 전북대 학부: 원서는 끝났고, 오늘(11-27) 마감인 2차 서류와 원본 제출이 남는다.
  assert.deepEqual(programDates(items, 'jbnu-ug', NOW), ['2026-11-27', '2027-02-19']);
  assert.deepEqual(programDates(items, 'jbnu-ug', new Date('2026-11-28T00:00:00+09:00')), ['2027-02-19']);
  assert.deepEqual(programDates(items, 'example-a-ug', NOW), []);
  for (const p of programsFor(PROGRAMS, true)) {
    const d = programDates(items, p.id, new Date('2026-01-01T00:00:00Z'));
    assert.deepEqual(d, [...new Set(d)].sort(), p.id);
  }
});

test('원 자료의 숫자가 lines에 그대로 있다', () => {
  // 재정 금액
  assert.ok(allText(byId.get('rule-finance-d2-local'), 'ko').includes('16,000,000원'));
  assert.ok(allText(byId.get('rule-finance-d2-local'), 'en').includes('₩16,000,000'));
  assert.ok(allText(byId.get('rule-finance-d4-metro'), 'ko').includes('10,000,000원(1,000만 원)'));
  const proof = byId.get('rule-finance-proof-mn-d2');
  assert.ok(allText(proof, 'ko').includes('14일') && allText(proof, 'ko').includes('30일'));
  // TOPIK 조건
  assert.ok(allText(byId.get('prog-jbnu-ug'), 'ko').includes('TOPIK 2급 이상'));
  assert.ok(allText(byId.get('prog-jbnu-ug'), 'en').includes('TOPIK level 2 or higher'));
  assert.ok(allText(byId.get('prog-wku-ug'), 'ko').includes('한국어 성적이 없어도 지원할 수 있어요'));
  assert.ok(allText(byId.get('rule-finance-topik4-waiver'), 'ko').includes('TOPIK 4급'));
  // 장학금 · 비용
  assert.ok(allText(byId.get('prog-jbnu-ug-scholarship'), 'ko').includes('820,500원'));
  assert.ok(allText(byId.get('prog-jj-ug-costs'), 'ko').includes('7,330,000원'));
  // 원서 날짜와 서류 기한
  const jbnu = PROGRAMS.find((p) => p.id === 'jbnu-ug');
  for (const [a, b] of jbnu.applyRounds) { assert.ok(allText(byId.get('prog-jbnu-ug-apply'), 'ko').includes(`${a}부터 ${b}까지`)); assert.ok(allText(byId.get('prog-jbnu-ug-apply'), 'en').includes(`${a} to ${b}`)); }
  assert.ok(allText(byId.get('docs-jbnu-ug'), 'ko').includes('2026-11-27'));
  // 채널 글의 점은 원문 그대로 실린다.
  for (const p of POSTS) for (const pt of p.points) { assert.ok(byId.get('post-' + p.id).lines.ko.includes(pt.ko)); assert.ok(byId.get('post-' + p.id).lines.en.includes(pt.en)); }
  // 서류 원문(note)도 그대로 실린다.
  for (const set of [...Object.values(PROGRAM_DOCS), ...Object.values(VISA_DOCS)]) for (const d of set.docs) if (d.note) assert.ok(byId.get('doc-' + d.id).lines.ko.includes(d.note.ko), d.id);
});

test('요강이 두 가지로 읽히는 항목은 unclear다', () => {
  assert.equal(byId.get('doc-jbnu-ug-grad').unclear, true);
  assert.equal(byId.get('doc-jbnu-ug-passport').unclear, false);
  assert.equal(byId.get('docs-jbnu-ug').unclear, true);
  assert.equal(byId.get('doc-visa-d2-deposit').unclear, true);
  assert.ok(allText(byId.get('doc-visa-d2-deposit'), 'ko').startsWith('서류: '));
  assert.ok(allText(byId.get('doc-visa-d2-deposit'), 'ko').includes('KVAC에 확인할 것'));
  for (const it of items) if (it.unclear) assert.ok(/두 가지로 읽혀요|KVAC에 확인할 것/.test(allText(it, 'ko')), it.id);
});

test('도움말이 가리키는 단추 이름과 문의처가 화면 글에 있다', () => {
  const src = ['app.mjs', 'consent-ui.mjs', 'account-ui.mjs', 'study-ui.mjs', 'path-ui.mjs'].map((f) => readFileSync(new URL('./' + f, import.meta.url), 'utf8')).join('\n');
  for (const label of ['계정의 유학 준비 자료 지우기', 'Delete study data from account', '이 탭의 PATH 데이터 지우기', 'Clear PATH data in this tab', '이 탭에만 두기', '조건 모두 지우기', '이 과정으로 준비하기', '서류 점검', '몽골어 서류의 번역 초안 만들기', '다시 로그인해야 합니다', 'SYNK ID 중앙 로그인 화면', '이 화면에서는 계정을 삭제할 수 없습니다', HELP_CONTACT]) assert.ok(src.includes(label), label);
  const help = askSourceText(items.filter((i) => i.kind === 'help'), 'ko');
  assert.ok(help.includes(HELP_CONTACT));
  assert.ok(help.includes('AI의 안내예요. 대학이나 KVAC의 확인이 아니에요.'));
  assert.ok(help.includes('입학이나 비자'));
});

test('근거 묶음은 node: 내장 모듈을 가져오지 않는다', () => {
  for (const f of ['ask-sources.mjs', 'ask-help.mjs']) {
    const s = readFileSync(new URL('./' + f, import.meta.url), 'utf8');
    assert.ok(!/from\s+['"]node:|require\(/.test(s), f);
  }
});

test('날 종류: 접수 시작 · 마감 · 서류 기한을 가르고, 넘김 요약 기한은 마감과 서류 기한만', async () => {
  const { DEADLINE_KINDS, DATE_KINDS } = await import('./ask-sources.mjs');
  for (const it of items) for (const d of it.dates) assert.ok(DATE_KINDS.includes(d.kind), it.id + ' ' + d.date);
  const withOpen = items.find((it) => it.dates.some((d) => d.kind === 'open'));
  assert.ok(withOpen, '접수 시작 날이 있는 항목');
  const pid = withOpen.program;
  const all = programDates(items, pid, NOW), deadlines = programDates(items, pid, NOW, DEADLINE_KINDS);
  const opens = new Set(items.filter((it) => it.program === pid).flatMap((it) => it.dates.filter((d) => d.kind === 'open').map((d) => d.date)));
  assert.ok(deadlines.every((d) => all.includes(d)));
  assert.ok(deadlines.every((d) => !opens.has(d) || items.some((it) => it.program === pid && it.dates.some((x) => x.date === d && DEADLINE_KINDS.includes(x.kind)))));
});

test('비자 서류의 물을 곳은 KVAC 몽골이다', () => {
  const visa = items.filter((it) => it.kind === 'doc' && it.program === null);
  assert.ok(visa.length > 0);
  for (const it of visa) assert.match(it.ask.ko, /KVAC/, it.id);
});

test('과정 목록 도움말: 근거 묶음의 실제 과정 이름이 모두 들어 있다', () => {
  const it = byId.get('help-programs');
  assert.equal(it.kind, 'help');
  const progs = items.filter((x) => x.kind === 'program' && x.id.endsWith('-apply'));
  assert.ok(progs.length > 0);
  for (const pr of progs) assert.ok(it.lines.ko[0].includes(pr.title.ko.split(' · ')[0]), pr.id);
});
