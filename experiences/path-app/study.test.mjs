import test from 'node:test';
import assert from 'node:assert/strict';
import { RULES, PROGRAMS, validateStudyData, staleItems, financeRule, announcedRules, daysUntil, programById, proofRule, rulesAt, programsFor } from './study-data.mjs';
import { matchProgram, programCost, countFit, readyToCount, routes, MATCH_KEYS } from './match.mjs';
import { STUDY_KEY, GUEST_OWNER, createProfile, normalizeProfile, setField, toggleCompare, isEmptyProfile, parseWhole, createProfileStore, MAX_FUNDS_WON } from './study-profile.mjs';
import { renderUniv, renderUnivDetail, renderUnivCompare, renderCond, renderCondResult, renderStudyEntry, filterPrograms, condHint } from './study-ui.mjs';

const A = programById(PROGRAMS, 'example-a-ug'), B = programById(PROGRAMS, 'example-b-lang'), C = programById(PROGRAMS, 'example-c-ug');
const clone = (v) => JSON.parse(JSON.stringify(v));
// 재정 금액을 지금 쓰는 안내에서 확인한 것으로 친 규칙. 실제 RULES의 표시는 자료가 정하므로 시험은 둘 다 본다.
const FIRM = RULES.map((r) => (r.kind === 'finance' ? { ...r, inCurrentGuide: true } : r));
const LOOSE = RULES.map((r) => (r.kind === 'finance' ? { ...r, inCurrentGuide: false } : r));
const status = (profile, program, rules = FIRM) => Object.fromEntries(matchProgram(profile, program, rules).items.map((i) => [i.key, i.status]));

test('공식 규칙마다 https 출처 · 기준일 · 확인한 날이 있고, 과정마다 맞는 재정 규칙이 있다', () => {
  assert.equal(validateStudyData(RULES, PROGRAMS), true);
  for (const r of RULES) {
    assert.match(r.source.url, /^https:\/\//);
    assert.match(r.basis, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(r.checkedAt, /^\d{4}-\d{2}-\d{2}$/);
  }
  for (const p of PROGRAMS) assert.ok(financeRule(RULES, p.visa, p.region), p.id);
  assert.equal(financeRule(RULES, 'D-2', 'local').won, 16000000);
  assert.equal(financeRule(RULES, 'D-2', 'metro').won, 20000000);
  assert.equal(financeRule(RULES, 'D-4', 'local').won, 8000000);
  assert.equal(financeRule(RULES, 'D-4', 'metro').won, 10000000);
});

test('협약 전 과정은 모두 예시이고 인증 표시가 없다', () => {
  for (const p of PROGRAMS) { assert.equal(p.example, true); assert.equal(p.certified, false); assert.match(p.name.ko, /^예시/); }
});

test('검사는 출처 없는 규칙 · 출처 없는 실제 과정 · 인증 붙은 예시 · 재정 규칙 없는 과정을 거절한다', () => {
  const rules = clone(RULES), programs = clone(PROGRAMS);
  const bad = (mutate) => { const r = clone(rules), p = clone(programs); mutate(r, p); assert.throws(() => validateStudyData(r, p), /Invalid study data/); };
  bad((r) => { delete r[0].source; });
  bad((r) => { r[0].source.url = 'http://example.com/a'; });
  bad((r) => { r[0].checkedAt = '2026-13-40'; });
  bad((r) => { r[1].id = r[0].id; });
  bad((r) => { r.push({ ...r[0], id: 'finance-d2-local-again' }); });
  bad((r, p) => { p[0].example = false; });
  bad((r, p) => { p[0].certified = true; });
  bad((r, p) => { p[0].region = 'metro'; r.splice(1, 1); });
  bad((r, p) => { p[1].visa = 'D-2'; });
  bad((r, p) => { p[0].scholarship = [{ topik: 4, tuitionRate: 0.5 }, { topik: 3, tuitionRate: 0.6 }]; });
  bad((r, p) => { p[0].scholarship = [{ topik: 3, tuitionRate: 0.5 }, { topik: 4, tuitionRate: 0.3 }]; });
  bad((r, p) => { p[0].image = '../secret'; });
  bad((r) => { delete r[0].inCurrentGuide; });
  bad((r, p) => { p[0].scholarship = [{ topik: 2, tuitionRate: 0.2 }, { topik: 3, tuitionRate: 0.3 }]; });
  const real = clone(programs);
  real[0].example = false; real[0].source = { title: { ko: '모집 요강', en: 'Admissions guide' }, url: 'https://example.ac.kr/guide' }; real[0].checkedAt = '2026-11-20';
  assert.equal(validateStudyData(rules, real), true);
});

test('계획 발표 규칙은 대조에 쓰이지 않고 따로 꺼낸다', () => {
  assert.equal(RULES.filter((r) => r.status === 'announced').length, 1);
  assert.deepEqual([proofRule(RULES).issuedWithinDays, proofRule(RULES).heldDays], [14, 30]);
  assert.equal(financeRule(RULES.filter((r) => r.kind !== 'finance'), 'D-2', 'local'), null, '안내 규칙은 금액 대조에 쓰이지 않는다');
  assert.equal(announcedRules(RULES, 'finance-waiver')[0].topik, 4);
  assert.equal(financeRule(RULES, 'D-2', 'local').status, 'in-force');
  const p = setField(setField(createProfile(), 'topik', 6), 'fundsWon', 0);
  assert.equal(status(p, A).finance, 'lack', '4급이 넘어도 시행 전에는 면제로 세지 않는다');
});

test('오래된 확인 날짜만 골라내고 예시 과정은 세지 않는다', () => {
  assert.deepEqual(staleItems(RULES, PROGRAMS, new Date('2026-12-01T00:00:00Z')), []);
  assert.ok(RULES.filter((r) => r.kind === 'finance').every((r) => r.inCurrentGuide === true), '네 금액 모두 2026-11-21에 현행 안내에서 직접 읽었다');
  const late = staleItems(RULES, PROGRAMS, new Date('2027-03-01T00:00:00Z'));
  assert.equal(late.length, RULES.length);
  assert.ok(late.every((x) => x.type === 'rule'));
});

test('남은 날은 그날 0, 지난 날과 없는 날은 null', () => {
  const now = new Date(2026, 10, 21, 23, 30);
  assert.equal(daysUntil('2026-11-21', now), 0);
  assert.equal(daysUntil('2026-11-22', now), 1);
  assert.equal(daysUntil('2027-01-21', now), 61);
  assert.equal(daysUntil('2026-11-20', now), null);
  assert.equal(daysUntil(null, now), null);
  assert.equal(daysUntil('soon', now), null);
});

test('아무것도 안 넣으면 필요 급수 0인 한국어만 맞고 나머지는 확인 필요', () => {
  const empty = createProfile();
  assert.deepEqual(matchProgram(empty, A, RULES).items.map((i) => i.key), [...MATCH_KEYS]);
  assert.deepEqual(status(empty, A), { education: 'check', grade: 'check', topik: 'check', finance: 'check' });
  assert.deepEqual(status(empty, B), { education: 'check', grade: 'check', topik: 'ok', finance: 'check' });
  assert.equal(matchProgram(empty, B, RULES).canApplyAcademically, false);
  assert.equal(matchProgram(null, A, RULES).okCount, 0);
});

test('조건 넷의 경계: 같은 값은 맞음, 하나 모자라면 부족', () => {
  let p = createProfile();
  p = setField(p, 'gradePct', 70); assert.equal(status(p, A).grade, 'ok');
  p = setField(p, 'gradePct', 69); assert.equal(status(p, A).grade, 'lack');
  assert.equal(matchProgram(p, A, FIRM).items[1].gap, 1);
  p = setField(p, 'topik', 3); assert.equal(status(p, A).topik, 'ok');
  p = setField(p, 'topik', 2); assert.equal(status(p, A).topik, 'lack');
  assert.equal(matchProgram(p, A, FIRM).items[2].gap, 1);
  p = setField(p, 'topik', 0); assert.equal(status(p, A).topik, 'lack'); assert.equal(status(p, B).topik, 'ok');
  p = setField(p, 'fundsWon', 16000000); assert.equal(status(p, A).finance, 'ok');
  p = setField(p, 'fundsWon', 15999999); assert.equal(status(p, A).finance, 'lack');
  assert.equal(matchProgram(p, A, FIRM).items[3].gap, 1);
  assert.equal(status(p, B).finance, 'ok', '어학 과정은 800만 원 규칙');
  p = setField(p, 'fundsWon', 0); assert.equal(status(p, B).finance, 'lack');
  for (const [value, want] of [['graduated', 'ok'], ['expected', 'ok'], ['none', 'lack'], [null, 'check']]) {
    assert.equal(status(setField(p, 'education', value), A).education, want);
  }
  assert.equal(matchProgram(p, A, []).items[3].status, 'check', '맞는 규칙이 없으면 확인 필요');
  assert.equal(matchProgram(p, A, []).items[3].rule, null);
});

test('「맞는 곳」은 성적과 한국어를 둘 다 넣어야 세고, 넣은 조건이 부족하면 빼고, 안 넣은 조건은 봐준다', () => {
  assert.equal(countFit(createProfile(), PROGRAMS, FIRM), null, '안 넣어서 0으로 보이지 않는다');
  assert.equal(countFit(setField(createProfile(), 'topik', 4), PROGRAMS, FIRM), null, '성적이 비면 세지 않는다');
  assert.equal(countFit(setField(createProfile(), 'gradePct', 80), PROGRAMS, FIRM), null, '한국어가 비면 세지 않는다');
  assert.equal(readyToCount(setField(setField(createProfile(), 'gradePct', 0), 'topik', 0)), true, '0도 넣은 값이다');
  let p = setField(setField(createProfile(), 'gradePct', 80), 'topik', 2);
  assert.equal(countFit(p, PROGRAMS, FIRM), 1);
  assert.equal(countFit(p, PROGRAMS, FIRM, 4), 3);
  assert.equal(countFit(setField(p, 'gradePct', 70), PROGRAMS, FIRM, 4), 2);
  assert.equal(countFit(setField(p, 'gradePct', 50), PROGRAMS, FIRM, 6), 0);
  p = setField(p, 'topik', 4);
  assert.equal(countFit(setField(p, 'education', 'none'), PROGRAMS, FIRM), 0, '학력이 부족하면 세지 않는다');
  assert.equal(countFit(setField(p, 'education', 'expected'), PROGRAMS, FIRM), 3);
  assert.equal(countFit(setField(p, 'fundsWon', 9000000), PROGRAMS, FIRM), 1, '돈이 모자란 학부 둘은 빠지고 어학 과정만 남는다');
  assert.equal(countFit(setField(p, 'fundsWon', 9000000), PROGRAMS, LOOSE), 3, '확인하지 못한 금액으로는 빼지 않는다');
  // 머리 숫자와 「조건이 맞는 곳」 거르기는 같은 기준이다
  for (const q of [p, setField(p, 'education', 'none'), setField(p, 'fundsWon', 9000000), setField(p, 'topik', 2)]) {
    assert.equal(filterPrograms(q, 'fit', PROGRAMS, FIRM).length, countFit(q, PROGRAMS, FIRM));
  }
  assert.deepEqual(filterPrograms(createProfile(), 'fit', PROGRAMS, FIRM), []);
  assert.equal(filterPrograms(createProfile(), 'language', PROGRAMS, FIRM).length, 1);
});

test('재정 금액은 지금 쓰는 안내에서 확인했고 오래되지 않았을 때만 판정한다', () => {
  const p = setField(createProfile(), 'fundsWon', 0);
  assert.equal(status(p, A, FIRM).finance, 'lack');
  assert.equal(status(p, A, LOOSE).finance, 'check');
  const loose = matchProgram(p, A, LOOSE).items[3];
  assert.deepEqual([loose.firm, loose.need, loose.gap], [false, 16000000, 16000000], '기준 금액과 차이는 알려 준다');
  const fresh = rulesAt(FIRM, new Date('2026-12-01T00:00:00Z')), old = rulesAt(FIRM, new Date('2027-03-01T00:00:00Z'));
  assert.equal(status(p, A, fresh).finance, 'lack');
  assert.equal(status(p, A, old).finance, 'check', '확인한 지 90일이 넘으면 판정하지 않는다');
  assert.ok(old.every((r) => r.stale === true));
  assert.equal(FIRM.some((r) => r.stale), false, '원래 목록은 바꾸지 않는다');
});

test('성적 조건 0은 「조건 없음」이라 성적을 안 넣어도 맞다', () => {
  const open = { ...B, requires: { ...B.requires, gradePct: 0 } };
  assert.equal(matchProgram(createProfile(), open, FIRM).items[1].status, 'ok');
});

test('공개판에는 예시 과정을 싣지 않는다', () => {
  assert.deepEqual(programsFor(PROGRAMS, true), []);
  assert.equal(programsFor(PROGRAMS, false).length, PROGRAMS.length);
  const real = { ...A, id: 'real-a', example: false };
  assert.deepEqual(programsFor([A, real], true).map((x) => x.id), ['real-a']);
});

test('장학금은 내 급수 이하의 가장 높은 단계, 다음 단계는 더 높은 가장 가까운 단계', () => {
  const at = (t) => programCost(setField(createProfile(), 'topik', t), A);
  assert.equal(at(2).scholarship, 0); assert.equal(at(2).total, 14200000); assert.deepEqual(at(2).nextLevel, { topik: 3, total: 12280000 });
  assert.equal(at(3).scholarship, 1920000); assert.equal(at(3).total, 12280000); assert.deepEqual(at(3).nextLevel, { topik: 4, total: 11000000 });
  assert.equal(at(4).total, 11000000); assert.equal(at(4).nextLevel, null);
  assert.equal(at(6).total, 11000000);
  const none = programCost(createProfile(), A);
  assert.equal(none.scholarship, 0); assert.deepEqual(none.nextLevel, { topik: 3, total: 12280000 });
  const lang = programCost(setField(createProfile(), 'topik', 5), B);
  assert.equal(lang.total, 12200000); assert.equal(lang.nextLevel, null);
  assert.equal(programCost(setField(createProfile(), 'topik', 5), C).total, 15400000 - 4080000);
});

test('갈 수 있는 길: 어학 먼저와 바로 학부', () => {
  let p = setField(setField(createProfile(), 'gradePct', 80), 'topik', 2);
  let r = routes(p, PROGRAMS, RULES);
  assert.deepEqual([r.languageFirst.status, r.languageFirst.count], ['ok', 1]);
  assert.deepEqual([r.direct.status, r.direct.count, r.direct.lowestTopik, r.direct.topikGap], ['lack', 0, 3, 1]);
  r = routes(setField(p, 'topik', 3), PROGRAMS, RULES);
  assert.deepEqual([r.direct.status, r.direct.count, r.direct.topikGap], ['ok', 1, 0]);
  r = routes(createProfile(), PROGRAMS, RULES);
  assert.equal(r.languageFirst.status, 'check'); assert.equal(r.direct.status, 'check'); assert.equal(r.direct.topikGap, null);
  r = routes(p, PROGRAMS.filter((x) => x.level === 'language'), RULES);
  assert.equal(r.direct.status, 'none');
});

test('내 조건: 깨진 저장값은 빈 조건, 틀린 칸만 비움, 범위 밖은 던짐', () => {
  assert.deepEqual(normalizeProfile(null), createProfile());
  assert.deepEqual(normalizeProfile({ v: 2, topik: 3 }), createProfile());
  assert.deepEqual(normalizeProfile('{}'), createProfile());
  assert.deepEqual(normalizeProfile({ v: 1, topik: 7, gradePct: 80.5, fundsWon: -1, education: 'phd', compare: ['example-a-ug', 'example-a-ug', '../x', 'b', 'c', 'd'] }),
    { v: 1, topik: null, gradePct: null, fundsWon: null, education: null, compare: ['example-a-ug', 'b', 'c'] });
  const p = setField(createProfile(), 'topik', 0);
  assert.equal(p.topik, 0); assert.equal(isEmptyProfile(p), false); assert.equal(isEmptyProfile(createProfile()), true);
  assert.equal(setField(p, 'topik', null).topik, null);
  for (const [k, v] of [['topik', 7], ['topik', 2.5], ['gradePct', 101], ['gradePct', -1], ['fundsWon', MAX_FUNDS_WON + 1], ['education', 'phd'], ['compare', []], ['topik', '3']]) {
    assert.throws(() => setField(p, k, v), RangeError, `${k}=${v}`);
  }
});

test('비교는 셋까지, 모르는 과정은 담지 않는다', () => {
  const ids = PROGRAMS.map((x) => x.id);
  let p = createProfile();
  for (const id of ids) p = toggleCompare(p, id, ids);
  assert.deepEqual(p.compare, ids);
  assert.deepEqual(toggleCompare(p, 'example-d', [...ids, 'example-d']).compare, ids, '넷째는 담기지 않는다');
  assert.deepEqual(toggleCompare(p, ids[1], ids).compare, [ids[0], ids[2]]);
  assert.deepEqual(toggleCompare(createProfile(), 'nope', ids).compare, []);
  assert.deepEqual(toggleCompare(createProfile(), '../x', null).compare, []);
});

test('숫자 칸 읽기: 빈 글은 null, 숫자가 아니면 바꾸지 않음', () => {
  assert.equal(parseWhole('', 0, 100), null);
  assert.equal(parseWhole('  ', 0, 100), null);
  assert.equal(parseWhole('80', 0, 100), 80);
  assert.equal(parseWhole('1,600', 0, 20000), 1600);
  assert.equal(parseWhole('101', 0, 100), undefined);
  assert.equal(parseWhole('8e1', 0, 100), undefined);
  assert.equal(parseWhole('-5', 0, 100), undefined);
  assert.equal(parseWhole('80.5', 0, 100), undefined);
});

function memoryStorage({ failWrite = false, failRead = false } = {}) {
  const map = new Map();
  return {
    map,
    getItem(k) { if (failRead) throw new Error('blocked'); return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { if (failWrite) throw new Error('quota'); map.set(k, String(v)); },
    removeItem(k) { if (failWrite) throw new Error('blocked'); map.delete(k); }
  };
}

test('저장: 이 탭의 열쇠 하나에만 쓰고, 지우면 사라진다', () => {
  const storage = memoryStorage();
  const store = createProfileStore(storage);
  assert.deepEqual(store.get(), createProfile());
  store.set(setField(store.get(), 'gradePct', 82));
  assert.deepEqual([...storage.map.keys()], [STUDY_KEY]);
  assert.equal(createProfileStore(storage).get().gradePct, 82);
  assert.equal(store.persisted(), true);
  assert.equal(store.clear(), true);
  assert.equal(storage.map.size, 0);
  assert.deepEqual(store.get(), createProfile());
  storage.map.set(STUDY_KEY, '{not json');
  const broken = createProfileStore(storage);
  assert.deepEqual(broken.get(), createProfile());
});

test('저장이 막히면 메모리로만 기억하고 저장됐다고 하지 않는다', () => {
  const store = createProfileStore(memoryStorage({ failWrite: true }));
  store.set(setField(store.get(), 'topik', 4));
  assert.equal(store.get().topik, 4);
  assert.equal(store.persisted(), false);
  const blind = createProfileStore(memoryStorage({ failRead: true }));
  assert.equal(blind.persisted(), false);
  assert.deepEqual(blind.get(), createProfile());
  const got = store.get(); got.topik = 1;
  assert.equal(store.get().topik, 4, '꺼낸 값을 고쳐도 저장된 값은 안 바뀐다');
});

const NOW = new Date(2026, 10, 21, 12, 0);
const view = (profile, extra = {}) => ({ lang: 'ko', profile, programs: PROGRAMS, rules: FIRM, now: NOW, ...extra });
const textOf = (html) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

test('화면: 예시만 있는 동안 「대학 N곳」이라고 세지 않고 예시라고 적는다', () => {
  const p = setField(setField(createProfile(), 'gradePct', 80), 'topik', 2);
  for (const lang of ['ko', 'en']) {
    for (const html of [renderStudyEntry(view(p, { lang })), renderUniv(view(p, { lang })), renderCond(view(p, { lang })), renderUnivDetail(view(p, { lang, programId: A.id }))]) {
      assert.match(textOf(html), lang === 'ko' ? /예시/ : /[Ee]xample/);
      assert.doesNotMatch(html, /\sstyle=|undefined|NaN|\[object/);
    }
  }
  assert.doesNotMatch(textOf(renderStudyEntry(view(p))), /\d+곳/);
  assert.match(textOf(renderUniv(view(p))), /1 개의 예시 과정이 지금 조건에 맞아요 \(예시 3개 중\)/);
  assert.match(textOf(renderUniv(view(createProfile()))), /성적과 한국어를 넣으면 맞는 곳을 알려 줘요/);
  assert.match(textOf(renderCondResult(view(p))), /4급이면 예시 과정 3개가 맞아요/);
  const real = PROGRAMS.map((x) => ({ ...x, example: false }));
  assert.match(textOf(renderStudyEntry(view(p, { programs: real }))), /지금 조건에 맞는 곳 1곳/);
  assert.match(textOf(renderUniv(view(p, { programs: [] }))), /협력 대학을 준비하고 있어요/);
});

test('화면: 대학 자세히는 조건 넷, 출처, 계획 발표, 장학금 뺀 값을 보인다', () => {
  const p = setField(setField(setField(setField(createProfile(), 'gradePct', 80), 'topik', 3), 'fundsWon', 10000000), 'education', 'graduated');
  const html = renderUnivDetail(view(p, { programId: A.id })), text = textOf(html);
  for (const want of ['학력', '성적', '한국어', '재정', '은행 잔고 1,600만 원', '600만 원이 더 필요해요', '법무부 2026-10-07 보도자료', '2023-07-03 시행 · 확인 2026-11-21', '14일 안에 발급', '30일 넘게 유지', '계획 발표', '1,228만 원', '4급이면 내가 낼 돈이 1,100만 원으로 줄어요', 'D-61']) assert.ok(text.includes(want), want);
  assert.match(html, /href="https:\/\/www\.moj\.go\.kr\/[^"]+" target="_blank" rel="noopener noreferrer"/);
  assert.match(textOf(renderUnivDetail(view(p, { programId: B.id }))), /주몽골대사관 비자신청센터 어학연수\(D-4-1\) 안내/);
  const loose = textOf(renderUnivDetail(view(p, { programId: A.id, rules: LOOSE })));
  assert.match(loose, /지금 쓰는 안내에서도 같은지 확인하고 있어서 맞는지 판정하지 않았어요\. 이 기준으로는 600만 원이 더 필요해요/);
  assert.match(textOf(renderUnivDetail(view(p, { programId: 'nope' }))), /과정을 찾지 못했어요/);
  assert.match(textOf(renderUnivDetail(view(p, { programId: A.id, now: new Date(2027, 5, 1) }))), /일정 확인 필요/, '지난 접수일은 남은 날로 쓰지 않는다');
});

test('화면: 나란히 보기는 두 곳부터, 없어진 과정은 빼고 그린다', () => {
  const two = { ...createProfile(), compare: [A.id, 'gone', B.id] };
  const html = renderUnivCompare(view(two));
  assert.match(html, /data-cols="2"/);
  assert.equal((html.match(/data-action="studyCompare"/g) || []).length, 2);
  assert.match(textOf(renderUnivCompare(view({ ...createProfile(), compare: [A.id] }))), /두 곳 넘게 담으면/);
});

test('화면: 숫자 칸은 글 입력이고 틀린 값은 칸 아래 글로 알린다', () => {
  const html = renderCond(view(createProfile(), { text: { gradePct: '850' }, errors: { gradePct: true } }));
  assert.match(html, /<input id="sx-grade" type="text" inputmode="numeric"[^>]*value="850"[^>]*aria-invalid="true"/);
  assert.match(html, /class="sx-hint is-error" id="sx-grade-hint"/);
  assert.doesNotMatch(html, /type="number"/);
  assert.match(condHint('ko', 'fundsWon', true), /20,000/);
  assert.match(textOf(renderCond(view(createProfile(), { persisted: false }))), /새로 고치면 사라져요/);
});

test('조건의 주인: 손님 것을 계정이 이어받고, 주인 표시가 깨진 저장값은 버린다', () => {
  const storage = memoryStorage();
  const store = createProfileStore(storage);
  assert.equal(store.owner(), GUEST_OWNER);
  store.setOwner('account-1');
  assert.equal(storage.map.size, 0, '넣은 것이 없으면 저장소를 건드리지 않는다');
  store.set(setField(store.get(), 'gradePct', 82));
  assert.equal(JSON.parse(storage.map.get(STUDY_KEY)).owner, 'account-1');
  const again = createProfileStore(storage);
  assert.deepEqual([again.owner(), again.get().gradePct], ['account-1', 82]);
  again.clear();
  assert.equal(again.owner(), GUEST_OWNER);
  storage.map.set(STUDY_KEY, JSON.stringify({ ...setField(createProfile(), 'topik', 4), owner: '<x>' }));
  const broken = createProfileStore(storage);
  assert.deepEqual([broken.owner(), broken.get().topik], [GUEST_OWNER, null]);
  storage.map.set(STUDY_KEY, JSON.stringify(setField(createProfile(), 'topik', 4)));
  assert.equal(createProfileStore(storage).get().topik, null, '주인이 없는 저장값도 버린다');
});

