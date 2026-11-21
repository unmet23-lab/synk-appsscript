import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { RULES, PROGRAMS, validateStudyData, staleItems, financeRule, announcedRules, daysUntil, programById, proofRule, rulesAt, programsFor, applyWindow } from './study-data.mjs';
import { matchProgram, programCost, countFit, countNeeds, readyToCount, routes, MATCH_KEYS } from './match.mjs';
import { STUDY_KEY, GUEST_OWNER, createProfile, normalizeProfile, setField, toggleCompare, isEmptyProfile, parseWhole, createProfileStore, MAX_FUNDS_WON } from './study-profile.mjs';
import { renderUniv, renderUnivDetail, renderUnivCompare, renderCond, renderCondResult, renderStudyEntry, filterPrograms, condHint } from './study-ui.mjs';

const EX = PROGRAMS.filter((p) => p.example), REAL = PROGRAMS.filter((p) => !p.example);
const A = programById(EX, 'example-a-ug'), B = programById(EX, 'example-b-lang'), C = programById(EX, 'example-c-ug');
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

test('예시 과정은 인증 표시가 없고 이름이 「예시」로 시작한다', () => {
  assert.equal(EX.length, 3);
  for (const p of EX) { assert.equal(p.example, true); assert.equal(p.certified, false); assert.match(p.name.ko, /^예시/); }
});

test('검사는 출처 없는 규칙 · 출처 없는 실제 과정 · 인증 붙은 예시 · 재정 규칙 없는 과정을 거절한다', () => {
  const rules = clone(RULES), programs = clone(EX);
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
  assert.deepEqual([proofRule(RULES, 'D-2').issuedWithinDays, proofRule(RULES, 'D-4').heldDays], [14, 30]);
  assert.notEqual(proofRule(RULES, 'D-2').source.url, proofRule(RULES, 'D-4').source.url, '비자마다 그 비자의 안내로 잇는다');
  assert.equal(financeRule(RULES.filter((r) => r.kind !== 'finance'), 'D-2', 'local'), null, '안내 규칙은 금액 대조에 쓰이지 않는다');
  assert.equal(announcedRules(RULES, 'finance-waiver')[0].topik, 4);
  assert.equal(financeRule(RULES, 'D-2', 'local').status, 'in-force');
  const p = setField(setField(createProfile(), 'topik', 6), 'fundsWon', 0);
  assert.equal(status(p, A).finance, 'lack', '4급이 넘어도 시행 전에는 면제로 세지 않는다');
});

test('오래된 확인 날짜만 골라내고 예시 과정은 세지 않는다', () => {
  assert.deepEqual(staleItems(RULES, EX, new Date('2026-12-01T00:00:00Z')), []);
  assert.ok(RULES.filter((r) => r.kind === 'finance').every((r) => r.inCurrentGuide === true), '네 금액 모두 2026-11-21에 현행 안내에서 직접 읽었다');
  const late = staleItems(RULES, EX, new Date('2027-03-01T00:00:00Z'));
  assert.equal(late.length, RULES.length);
  assert.ok(late.every((x) => x.type === 'rule'));
});

test('남은 날은 그날 0, 지난 날과 없는 날은 null', () => {
  const now = new Date('2026-11-21T23:30:00+09:00');
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
  assert.equal(countFit(createProfile(), EX, FIRM), null, '안 넣어서 0으로 보이지 않는다');
  assert.equal(countFit(setField(createProfile(), 'topik', 4), EX, FIRM), null, '성적이 비면 세지 않는다');
  assert.equal(countFit(setField(createProfile(), 'gradePct', 80), EX, FIRM), null, '한국어가 비면 세지 않는다');
  assert.equal(readyToCount(setField(setField(createProfile(), 'gradePct', 0), 'topik', 0)), true, '0도 넣은 값이다');
  let p = setField(setField(createProfile(), 'gradePct', 80), 'topik', 2);
  assert.equal(countFit(p, EX, FIRM), 1);
  assert.equal(countFit(p, EX, FIRM, 4), 3);
  assert.equal(countFit(setField(p, 'gradePct', 70), EX, FIRM, 4), 2);
  assert.equal(countFit(setField(p, 'gradePct', 50), EX, FIRM, 6), 0);
  p = setField(p, 'topik', 4);
  assert.equal(countFit(setField(p, 'education', 'none'), EX, FIRM), 0, '학력이 부족하면 세지 않는다');
  assert.equal(countFit(setField(p, 'education', 'expected'), EX, FIRM), 3);
  assert.equal(countFit(setField(p, 'fundsWon', 9000000), EX, FIRM), 1, '돈이 모자란 학부 둘은 빠지고 어학 과정만 남는다');
  assert.equal(countFit(setField(p, 'fundsWon', 9000000), EX, LOOSE), 3, '확인하지 못한 금액으로는 빼지 않는다');
  // 머리 숫자와 「조건이 맞는 곳」 거르기는 같은 기준이다
  for (const q of [p, setField(p, 'education', 'none'), setField(p, 'fundsWon', 9000000), setField(p, 'topik', 2)]) {
    assert.equal(filterPrograms(q, 'fit', EX, FIRM).length, countFit(q, EX, FIRM));
  }
  assert.deepEqual(filterPrograms(createProfile(), 'fit', EX, FIRM), []);
  assert.equal(filterPrograms(createProfile(), 'language', EX, FIRM).length, 1);
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
  assert.deepEqual(programsFor(EX, true), []);
  assert.equal(programsFor(EX, false).length, EX.length);
  assert.deepEqual(programsFor(PROGRAMS, true), programsFor(PROGRAMS, false).filter((x) => !x.example), '실제 과정이 있으면 미리보기와 공개판이 같다');
  const real = { ...A, id: 'real-a', example: false };
  assert.deepEqual(programsFor([A, real], true).map((x) => x.id), ['real-a']);
  assert.deepEqual(programsFor([A, real], false).map((x) => x.id), ['real-a'], '실제 과정이 하나라도 있으면 미리보기에서도 예시를 뺀다');
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
  let r = routes(p, EX, RULES);
  assert.deepEqual([r.languageFirst.status, r.languageFirst.count], ['ok', 1]);
  assert.deepEqual([r.direct.status, r.direct.count, r.direct.lowestTopik, r.direct.topikGap], ['lack', 0, 3, 1]);
  r = routes(setField(p, 'topik', 3), EX, RULES);
  assert.deepEqual([r.direct.status, r.direct.count, r.direct.topikGap], ['ok', 1, 0]);
  r = routes(createProfile(), EX, RULES);
  assert.equal(r.languageFirst.status, 'check'); assert.equal(r.direct.status, 'check'); assert.equal(r.direct.topikGap, null);
  r = routes(p, EX.filter((x) => x.level === 'language'), RULES);
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
  const ids = EX.map((x) => x.id);
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

const NOW = new Date('2026-11-21T12:00:00+09:00');
const view = (profile, extra = {}) => ({ lang: 'ko', profile, programs: EX, rules: FIRM, now: NOW, ...extra });
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
  assert.match(textOf(renderUniv(view(createProfile()))), /성적과 한국어를 넣으면 맞는 과정을 세어 줘요/);
  assert.match(textOf(renderCondResult(view(p))), /3급이면 예시 과정 2개가 맞아요/, '4급으로 고정하지 않고 늘어나는 가장 낮은 급수를 보인다');
  const real = EX.map((x) => ({ ...x, example: false }));
  assert.match(textOf(renderStudyEntry(view(p, { programs: real }))), /지금 조건에 맞는 과정 1개/);
  assert.match(textOf(renderUniv(view(p, { programs: [] }))), /협력 대학을 준비하고 있어요/);
});

test('화면: 대학 자세히는 조건 넷, 출처, 계획 발표, 장학금 뺀 값을 보인다', () => {
  const p = setField(setField(setField(setField(createProfile(), 'gradePct', 80), 'topik', 3), 'fundsWon', 10000000), 'education', 'graduated');
  const html = renderUnivDetail(view(p, { programId: A.id })), text = textOf(html);
  for (const want of ['학력', '성적', '한국어', '재정', '은행 잔고 1,600만 원', '600만 원이 더 필요해요', '법무부 2026-10-07 보도자료', '2023-07-03 시행 · 확인 2026-11-21', '14일 안에 발급', '30일 이상 유지', '계획 발표', '1,228만 원', '4급이면 내가 낼 돈이 1,100만 원으로 줄어요', 'D-61']) assert.ok(text.includes(want), want);
  assert.match(html, /href="https:\/\/www\.moj\.go\.kr\/[^"]+" target="_blank" rel="noopener noreferrer"/);
  assert.match(textOf(renderUnivDetail(view(p, { programId: B.id }))), /주몽골대사관 비자신청센터 어학연수\(D-4-1\) 안내/);
  const loose = textOf(renderUnivDetail(view(p, { programId: A.id, rules: LOOSE })));
  assert.match(loose, /지금 쓰는 안내에서도 같은지 확인하고 있어서 맞는지 판정하지 않았어요\. 이 기준으로는 600만 원이 더 필요해요/);
  assert.match(textOf(renderUnivDetail(view(p, { programId: 'nope' }))), /과정을 찾지 못했어요/);
  assert.match(textOf(renderUnivDetail(view(p, { programId: A.id, now: new Date('2027-06-01T12:00:00+09:00') }))), /일정 확인 필요/, '지난 접수일은 남은 날로 쓰지 않는다');
});

test('화면: 나란히 보기는 두 곳부터, 없어진 과정은 빼고 그린다', () => {
  const two = { ...createProfile(), compare: [A.id, 'gone', B.id] };
  const html = renderUnivCompare(view(two));
  assert.match(html, /data-cols="2"/);
  assert.equal((html.match(/data-action="studyCompare"/g) || []).length, 2);
  assert.match(textOf(renderUnivCompare(view({ ...createProfile(), compare: [A.id] }))), /두 곳 이상 담으면/);
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


// ── 실제 대학 과정(공개 모집 요강) ──
const SRC = { title: { ko: '시험대학교 2027학년도 외국인 모집 요강', en: 'Test University 2027 international admissions guide' }, url: 'https://example.ac.kr/guide.pdf' };
const realUg = { ...A, id: 'test-ug', example: false, partner: false, name: { ko: '시험대학교', en: 'Test University' }, image: null, tone: 'meadow',
  term: { ko: '2027학년도 3월 입학', en: 'March 2027 intake' }, requires: { education: 'highschool', gradePct: 0, topik: 3 },
  requiresNote: { ko: 'TOPIK이 없으면 대학 한국어 시험으로도 지원할 수 있어요.', en: 'Without TOPIK you can apply through the university’s own Korean test.' },
  costs: { tuition: 4000000, dorm: null, living: null }, costsNote: { ko: '인문 · 사회 계열 두 학기 기준이에요.', en: 'Two semesters, humanities and social sciences.' },
  scholarship: [{ topik: 3, tuitionRate: 0.3 }, { topik: 4, tuitionRate: 0.5 }], scholarshipTerms: 1,
  scholarshipNote: { ko: '입학한 첫 학기에만 줘요.', en: 'First semester only.' },
  applyOpens: '2026-11-02', applyCloses: '2026-12-11', source: SRC, checkedAt: '2026-11-21' };

test('실제 과정: 출처와 확인한 날이 있고, 지어낸 그림을 쓰지 않으며, 모르는 비용은 비워 둔다', () => {
  assert.equal(validateStudyData(RULES, [realUg]), true);
  const bad = (change) => assert.throws(() => validateStudyData(RULES, [{ ...realUg, ...change }]), /Invalid study data/);
  bad({ source: null }); bad({ checkedAt: null }); bad({ image: 'campus-photo' }); bad({ tone: 'pink' });
  bad({ applyCloses: '2026-10-01' }); bad({ scholarshipTerms: 3 }); bad({ term: { ko: '봄' } }); bad({ partner: 'yes' });
  assert.throws(() => validateStudyData(RULES, [{ ...A, costs: { ...A.costs, dorm: null } }]), /Invalid study data/, '예시는 비용을 비울 수 없다');
  assert.throws(() => validateStudyData(RULES, [{ ...A, partner: true }]), /Invalid study data/, '예시는 협력 대학이 될 수 없다');
  for (const p of REAL) {
    assert.equal(p.image, null, p.id + ': 실제 대학에 지어낸 건물 그림을 쓰지 않는다');
    assert.match(p.source.url, /^https:\/\//); assert.match(p.checkedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(p.certified, false, p.id + ': 인증 대학 명단과 대조하기 전에는 인증 표시를 하지 않는다');
    assert.notEqual(p.partner, true, p.id + ': 협약 전에는 협력 대학이 아니다');
    assert.doesNotMatch(p.name.ko, /예시/);
  }
});

test('실제 과정의 비용: 안내 없는 비용은 합계에서 빼고, 첫 학기만 주는 장학금은 절반만 뺀다', () => {
  const at = (t) => programCost(setField(createProfile(), 'topik', t), realUg);
  assert.deepEqual(at(2).missing, ['dorm', 'living']);
  assert.equal(at(2).total, 4000000);
  assert.equal(at(3).scholarship, 600000, '한 해 400만 원의 30%를 한 학기 몫만');
  assert.equal(at(3).total, 3400000);
  assert.deepEqual(at(3).nextLevel, { topik: 4, total: 3000000 });
  assert.deepEqual(programCost(createProfile(), A).missing, []);
  // 금액으로 적힌 장학금(수업료 일부만 깎는 경우)
  const fixed = { ...realUg, scholarship: [{ topik: 5, won: 820500 }, { topik: 6, won: 2000000 }], scholarshipTerms: undefined };
  assert.equal(validateStudyData(RULES, [fixed]), true);
  const f = (t) => programCost(setField(createProfile(), 'topik', t), fixed);
  assert.deepEqual([f(4).scholarship, f(4).rate, f(4).nextLevel.topik, f(4).nextLevel.total], [0, 0, 5, 3179500]);
  assert.deepEqual([f(5).scholarship, f(5).rate, f(5).total, f(5).nextLevel.total], [820500, null, 3179500, 2000000]);
  assert.equal(f(6).nextLevel, null);
  assert.match(textOf(renderUnivDetail(view(setField(createProfile(), 'topik', 5), { programs: [fixed], programId: 'test-ug' }))), /한국어 5급 장학금 82만 500원을 뺀 값이에요/);
  for (const steps of [[{ topik: 5, won: 900000 }, { topik: 6, won: 800000 }], [{ topik: 5, won: 100, tuitionRate: 0.1 }], [{ topik: 5, won: 99999999 }], [{ topik: 5 }]]) {
    assert.throws(() => validateStudyData(RULES, [{ ...fixed, scholarship: steps }]), /Invalid study data/);
  }
});

test('원서 접수: 시작 전, 접수 중, 지난 일정을 구분한다', () => {
  const w = (opens, closes, now) => applyWindow({ applyOpens: opens, applyCloses: closes }, now);
  assert.deepEqual(w('2026-12-01', '2026-12-20', new Date('2026-11-21T12:00:00+09:00')), { state: 'before', days: 10 });
  assert.deepEqual(w('2026-11-02', '2026-12-11', new Date('2026-11-21T12:00:00+09:00')), { state: 'open', days: 20 });
  assert.deepEqual(w('2026-11-21', undefined, new Date('2026-11-21T12:00:00+09:00')), { state: 'open', days: null });
  assert.deepEqual(w('2026-11-02', '2026-11-20', new Date('2026-11-21T12:00:00+09:00')), { state: 'closed', days: null });
  assert.deepEqual(w(null, null, new Date('2026-11-21T12:00:00+09:00')), { state: 'unknown', days: null });
});

test('화면: 공개 요강을 옮긴 대학은 「협력」이라고 하지 않고 출처와 비어 있는 비용을 그대로 보인다', () => {
  const p = setField(setField(createProfile(), 'gradePct', 80), 'topik', 3);
  const list = textOf(renderUniv(view(p, { programs: [realUg] })));
  assert.match(list, /대학 공개 모집 요강/); assert.match(list, /협력 대학 준비 중/); assert.match(list, /SYNK와 협약한 대학은 아직 없어요/);
  assert.match(list, /1\s*개 과정이 지금 조건에 맞아요/); assert.match(list, /마감 D-20/);
  assert.match(textOf(renderUniv(view(p, { programs: [{ ...realUg, applyCloses: '2026-11-20' }] }))), /접수 끝남/);
  assert.match(textOf(renderUnivDetail(view(p, { programs: [{ ...realUg, applyNote: { ko: '9월 입학 요강은 아직 나오지 않았어요.', en: 'The September guide is not out yet.' } }], programId: 'test-ug' }))), /원서 접수 9월 입학 요강은 아직 나오지 않았어요/); assert.doesNotMatch(list, /예시/);
  const html = renderUnivDetail(view(p, { programs: [realUg], programId: 'test-ug' })), text = textOf(html);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /class="sx-cover is-meadow"/);
  for (const want of ['시험대학교', '2027학년도 3월 입학', 'SYNK와 협약한 대학은 아니에요', '시험대학교 2027학년도 외국인 모집 요강', '확인 2026-11-21', '확인된 비용의 합', '340만 원',
    '합계에 없음 · 아래 안내', '대학이 안내하지 않음', '합계에는 기숙사비와 생활비가 빠져 있어요', '인문 · 사회 계열 두 학기 기준이에요', '입학한 첫 학기에만 줘요',
    'TOPIK이 없으면 대학 한국어 시험으로도', '조건 없음', '4급이면 확인된 비용의 합이 300만 원으로 줄어요']) assert.ok(text.includes(want), want);
  assert.doesNotMatch(text, /undefined|NaN|null/);
  const partner = textOf(renderUniv(view(p, { programs: [{ ...realUg, partner: true }] })));
  assert.match(partner, /협력 대학/); assert.doesNotMatch(partner, /준비 중|공개 모집 요강/);
  const cmp = renderUnivCompare(view({ ...p, compare: ['test-ug', B.id] }, { programs: [realUg, B] }));
  assert.match(textOf(cmp), /확인된 비용의 합/); assert.match(cmp, /class="sx-cover is-meadow"/);
  for (const lang of ['ko', 'en']) assert.doesNotMatch(renderUnivDetail(view(p, { lang, programs: [realUg], programId: 'test-ug' })), /\sstyle=|undefined|NaN/);
});

// ── 카본 검수(path-study-univ-20261121) 지적 반영 ──
const real = (id) => programById(PROGRAMS, id);

test('남은 날은 한국 날짜로 센다: 몽골 밤 11시 반은 한국으로 이미 다음 날이다', () => {
  const mongoliaLate = new Date('2026-11-20T23:30:00+08:00');   // 한국 2026-11-21 00:30
  assert.equal(daysUntil('2026-11-20', mongoliaLate), null, '한국 자정이 지나면 그날 마감은 끝났다');
  assert.equal(daysUntil('2026-11-21', mongoliaLate), 0);
  assert.equal(daysUntil('2026-11-21', new Date('2026-11-21T14:59:00Z')), 0);
  assert.equal(daysUntil('2026-11-21', new Date('2026-11-21T15:00:00Z')), null, 'UTC 15시는 한국 자정이다');
});

test('급수 0 장학금(신입생 모두)은 급수를 안 넣어도 빼고, 그 밖의 단계는 필요 급수보다 낮을 수 없다', () => {
  const jj = real('jj-ug');
  const none = programCost(createProfile(), jj);
  assert.deepEqual([none.scholarship, none.stepTopik, none.nextLevel.topik], [1466000, 0, 3]);
  for (const t of [0, 1, 2]) assert.equal(programCost(setField(createProfile(), 'topik', t), jj).scholarship, 1466000, t + '급도 신입생 장학금');
  assert.equal(programCost(setField(createProfile(), 'topik', 4), jj).scholarship, 2565500);
  assert.equal(validateStudyData(RULES, [jj]), true);
  assert.throws(() => validateStudyData(RULES, [{ ...jj, scholarship: [{ topik: 1, won: 100000 }] }]), /Invalid study data/, '필요 급수(2)보다 낮은 1급 단계');
  assert.match(textOf(renderUnivDetail(view(createProfile(), { programs: [jj], programId: 'jj-ug' }))), /신입생 모두에게 주는 장학금 146만 6,000원을 뺀 값이에요/);
  const jb = real('jbnu-ug');
  assert.match(textOf(renderUnivDetail(view(setField(createProfile(), 'topik', 3), { programs: [jb], programId: 'jbnu-ug' }))), /지금 급수로 정해진 장학금은 없어요. 아래 장학금 안내를 확인하세요/);
});

test('갈 수 있는 길은 머리 숫자와 같은 기준이고, 「조건 맞음」과 지금 접수할 수 있는 수를 나눠 적는다', () => {
  const now = new Date('2026-11-21T12:00:00+09:00');
  const progs = programsFor(PROGRAMS, true);
  const empty = routes(createProfile(), progs, RULES, now);
  assert.deepEqual([empty.languageFirst.status, empty.direct.status], ['check', 'check'], '아무것도 넣지 않으면 「지금 시작 가능」이 아니다');
  let p = setField(setField(createProfile(), 'gradePct', 82), 'topik', 3);
  let r = routes(p, progs, RULES, now);
  assert.deepEqual([r.direct.status, r.direct.count, r.direct.open], ['ok', 3, 2], '전북대 학부는 접수가 끝나 지금 갈 수 있는 수에서 빠진다');
  p = setField(p, 'fundsWon', 12000000);
  r = routes(p, progs, RULES, now);
  assert.deepEqual([r.direct.status, r.direct.count, r.direct.academic], ['lack', 0, 3], '준비한 돈이 모자라면 학부 길은 맞지 않는다');
  assert.deepEqual([r.languageFirst.status, r.languageFirst.count], ['ok', 2]);
  const text = textOf(renderCondResult(view(p, { programs: progs, now })));
  assert.match(text, /성적과 한국어가 맞는 과정은 있지만 학력이나 준비한 돈이 모자라요/);
  assert.match(text, /조건이 맞는 어학 과정이 2개 있어요/);
  assert.doesNotMatch(text, /과정이 과정|곳이 과정/);
  assert.doesNotMatch(text, /지금 시작 가능|Open now/);
  const en = textOf(renderCondResult(view(setField(setField(createProfile(), 'gradePct', 82), 'topik', 0), { lang: 'en', programs: progs, now })));
  assert.match(en, /1 program for undergraduate study fits your conditions/, '단수일 때 fits');
});

test('나란히 보기는 기숙사 · 장학금을 칸마다 보이고, 빠진 비용을 칸에 적는다', () => {
  const p = { ...setField(createProfile(), 'topik', 3), compare: ['jbnu-lang', 'wku-lang', 'wku-ug'] };
  const html = renderUnivCompare(view(p, { programs: programsFor(PROGRAMS, true) })), text = textOf(html);
  for (const want of ['한 해 등록금 · 수업료', '한 해 기숙사', '합계에 없음', '두 학기 · 2인실 · 식비 별도', '지금 급수 장학금', '− 162만 4,000원', '기숙사 · 생활비 빠짐', '생활비 빠짐', '칸마다 견주어 보세요']) assert.ok(text.includes(want), want);
  assert.doesNotMatch(text, /한 해 수업료 /);
});

test('목록: 아무것도 넣지 않으면 「4개 중 N개 맞음」 대신 안내하고, 비교 단추는 과정 이름을 읽어 준다', () => {
  const progs = programsFor(PROGRAMS, true);
  const html = renderUniv(view(createProfile(), { programs: progs }));
  assert.doesNotMatch(textOf(html), /4개 중/);
  assert.match(textOf(html), /내 조건을 넣으면 맞춰 봐요/);
  assert.doesNotMatch(html, /sx-meter/);
  assert.match(html, /data-action="studyCompare" data-id="wku-ug">비교<span class="sr-only"> 원광대학교<\/span>/);
  assert.match(textOf(renderUniv(view(setField(createProfile(), 'topik', 3), { programs: progs }))), /내 조건 4개 중 \d개 맞음/);
});

test('접수 배지: 상세는 상태를 스스로 말하고, 전북대 한국어학당은 1차 마감까지 센다', () => {
  const now = new Date('2026-12-05T12:00:00+09:00');
  const lang = real('jbnu-lang');
  assert.deepEqual(applyWindow(lang, now), { state: 'open', days: 6, round: 1, nextOpens: '2026-12-12' });
  assert.deepEqual(applyWindow(lang, new Date('2026-12-15T12:00:00+09:00')), { state: 'open', days: 10, round: 2, nextOpens: null });
  const detail = textOf(renderUnivDetail(view(createProfile(), { programs: [real('jbnu-ug')], programId: 'jbnu-ug', now })));
  assert.match(detail, /이번 접수 끝남/);
  assert.doesNotMatch(detail, /원서 접수 접수/);
  const wku = textOf(renderUnivDetail(view(createProfile(), { programs: [lang], programId: 'jbnu-lang', now })));
  assert.match(wku, /주몽골대사관 비자신청센터 어학연수\(D-4-1\) 안내/);
  assert.doesNotMatch(wku, /유학\(D-2\) 안내/);
});

// ── 최종 검수(Opus 5.5 대체, path-study-univ-20261121 F1~F5) 반영 ──
test('세기에 필요한 칸은 보이는 과정이 쓰는 조건만이다: 실제 과정은 성적 기준이 없어 한국어만 넣어도 센다', () => {
  const progs = programsFor(PROGRAMS, true);
  assert.deepEqual(countNeeds(progs), ['topik']);
  assert.deepEqual(countNeeds(PROGRAMS.filter((p) => p.example)), ['gradePct', 'topik']);
  assert.deepEqual(countNeeds(), ['gradePct', 'topik'], '목록을 안 주면 둘 다');
  const p = setField(createProfile(), 'topik', 3);
  assert.equal(readyToCount(p, progs), true);
  assert.equal(readyToCount(p), false);
  assert.equal(countFit(p, progs, RULES), 5);
  assert.equal(countFit(setField(p, 'gradePct', 0), progs, RULES), countFit(setField(p, 'gradePct', 100), progs, RULES), '성적은 결과를 바꾸지 않는다');
  const empty = textOf(renderCondResult(view(createProfile(), { programs: progs })));
  assert.match(empty, /한국어 급수를 넣으면 맞는 과정을 세어 줘요/);
  assert.doesNotMatch(empty, /성적과 한국어|둘 중 하나라도/);
  assert.match(textOf(renderUniv(view(createProfile(), { programs: progs }))), /한국어 급수를 넣으면 맞는 과정을 세어 줘요/);
});

test('학력이나 준비한 돈을 안 넣고 셌으면 그렇다고 이름으로 적는다(머리 카드 · 목록 · 오늘 입구)', () => {
  const progs = programsFor(PROGRAMS, true), now = new Date('2026-11-21T12:00:00+09:00');
  const p = setField(setField(createProfile(), 'topik', 1), 'gradePct', 82);
  const note = /학력과 준비한 돈은 아직 넣지 않아서 빼지 않고 셌어요/;
  assert.match(textOf(renderCondResult(view(p, { programs: progs, now }))), note);
  assert.match(textOf(renderUniv(view(p, { programs: progs, now }))), note);
  assert.match(textOf(renderStudyEntry(view(p, { programs: progs, now }))), note);
  assert.match(textOf(renderCondResult(view(p, { lang: 'en', programs: progs, now }))), /Your education and funds are not entered yet, so no program was ruled out by them/);
  const edu = setField(p, 'education', 'graduated');
  assert.match(textOf(renderCondResult(view(edu, { programs: progs, now }))), /준비한 돈은 아직 넣지 않아서 빼지 않고 셌어요/);
  assert.match(textOf(renderCondResult(view(edu, { lang: 'en', programs: progs, now }))), /Your funds are not entered yet, so no program was ruled out by them/);
  const all = setField(edu, 'fundsWon', 20000000);
  assert.doesNotMatch(textOf(renderCondResult(view(all, { programs: progs, now }))), /빼지 않고 셌어요/);
  assert.match(textOf(renderStudyEntry(view(all, { programs: progs, now }))), /조건을 바꾸면 바로 다시 계산해요/);
});

test('접수 차수가 여럿이면 배지에 차수를, 상세에는 다음 차수가 열리는 날을 적는다', () => {
  const lang = real('jbnu-lang'), last = new Date('2026-12-11T12:00:00+09:00');
  const p = { ...createProfile(), compare: ['jbnu-lang', 'wku-lang'] };
  const detail = textOf(renderUnivDetail(view(p, { programs: [lang], programId: 'jbnu-lang', now: last })));
  assert.match(detail, /1차 오늘 접수 마감 · 2차 12월 12일부터/);
  assert.match(textOf(renderUnivDetail(view(p, { lang: 'en', programs: [lang], programId: 'jbnu-lang', now: last }))), /Round 1 closes today · round 2 from Dec 12/);
  const list = textOf(renderUniv(view(p, { programs: programsFor(PROGRAMS, true), now: last })));
  assert.match(list, /1차 오늘 마감/);
  assert.match(list, /마감 D-13/, '차수가 하나인 원광대 한국문화교육센터는 차수를 붙이지 않는다');
  assert.doesNotMatch(list, /1차 마감 D-13/);
  assert.match(textOf(renderUnivDetail(view(p, { programs: [lang], programId: 'jbnu-lang', now: new Date('2026-12-15T12:00:00+09:00') }))), /2차 접수 마감 D-10/);
  assert.doesNotMatch(textOf(renderUnivDetail(view(p, { programs: [lang], programId: 'jbnu-lang', now: new Date('2026-12-15T12:00:00+09:00') }))), /3차/);
  assert.match(textOf(renderUnivDetail(view(p, { programs: [real('jj-ug')], programId: 'jj-ug', now: new Date('2026-11-21T12:00:00+09:00') }))), /2차 접수 시작 D-10/);
});

test('나란히 보기 머리의 표지 글자는 표지 색을 지키고, 상세 머리 글은 같은 말을 되풀이하지 않는다', () => {
  const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.sx-cmp-head>span:not\(\.sx-cover\)\{/);
  assert.doesNotMatch(css, /\.sx-cmp-head span\{/, '자손 선택자는 표지 안 도시 이름까지 먹색으로 칠한다');
  for (const id of ['jbnu-ug', 'jbnu-lang']) {
    for (const lang of ['ko', 'en']) {
      const html = renderUnivDetail(view(createProfile(), { lang, programs: [real(id)], programId: id }));
      const small = textOf(html.match(/<span class="sx-photo-body"><small>(.*?)<\/small>/)[1]);
      assert.doesNotMatch(small, /학부 · 학부|어학 과정 · 한국어 연수|Undergraduate · Undergraduate|Language program · Korean language program/, small);
    }
  }
});
