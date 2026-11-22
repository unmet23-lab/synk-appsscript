import test from 'node:test';
import assert from 'node:assert/strict';
import { validateStudyDocument, createStudyDocument, emptyStudyDocument, STUDY_SCHEMA, STUDY_DOCUMENT_VERSION, CONSENT_VERSION, MAX_DOCS, MAX_DATES, MAX_TOPIK } from './study-shape.mjs';
import { createProfile, normalizeProfile } from './study-profile.mjs';
import { MAX_TOPIK as DATA_MAX_TOPIK } from './study-data.mjs';

const AT = '2026-11-22T10:00:00.000Z';
const consent = { v: CONSENT_VERSION, at: AT, minor: true, guardian: true, lang: 'mn' };
const full = () => ({
  schema: STUDY_SCHEMA, version: STUDY_DOCUMENT_VERSION, consent: { ...consent },
  profile: { topik: 3, gradePct: 80, fundsWon: 16000000, education: 'expected', compare: ['jbnu-ug', 'jj-ug'],
    dates: [{ id: 'univ-jj-ug-2026-12-01', start: '2026-12-01', end: '2026-12-11' }], channelsOff: ['scam'], target: 'jj-ug',
    docs: [{ id: 'jj-ug-form', doneAt: AT }] }
});
const fails = (doc, why) => assert.throws(() => validateStudyDocument(doc), (e) => e.code === 'INVALID_PATH_STUDY', why);

test('유학 준비 문서: 맞는 문서는 정한 키 순서로 새로 지어 돌려주고, 같은 바이트를 다시 통과한다', () => {
  const shuffled = full();
  shuffled.profile = Object.fromEntries(Object.entries(shuffled.profile).reverse());
  const out = validateStudyDocument(shuffled);
  assert.deepEqual(Object.keys(out), ['schema', 'version', 'consent', 'profile']);
  assert.deepEqual(Object.keys(out.profile), ['topik', 'gradePct', 'fundsWon', 'education', 'compare', 'dates', 'channelsOff', 'target', 'docs']);
  assert.equal(JSON.stringify(validateStudyDocument(JSON.parse(JSON.stringify(out)))), JSON.stringify(out));
  assert.equal(MAX_TOPIK, DATA_MAX_TOPIK, '과정 자료와 같은 급수 한도');
});

test('유학 준비 문서: 모르는 칸 · 범위 밖 · 중복 · 한도 초과 · 틀린 동의는 고쳐 읽지 않고 거부한다', () => {
  fails({ ...full(), extra: 1 }, '모르는 칸');
  fails({ ...full(), schema: 'synk.path-app' });
  fails({ ...full(), version: 2 }, '미래 판');
  const bad = (patch) => { const d = full(); d.profile = { ...d.profile, ...patch }; return d; };
  fails(bad({ topik: 7 })); fails(bad({ gradePct: 101 })); fails(bad({ fundsWon: -1 })); fails(bad({ education: 'phd' }));
  fails(bad({ target: 'BAD ID' })); fails(bad({ compare: ['a', 'a'] })); fails(bad({ compare: ['a', 'b', 'c', 'd'] }));
  fails(bad({ docs: [{ id: 'a', doneAt: AT }, { id: 'a', doneAt: AT }] }), '같은 서류 둘');
  fails(bad({ docs: Array.from({ length: MAX_DOCS + 1 }, (_, i) => ({ id: `d-${i}`, doneAt: AT })) }));
  fails(bad({ dates: Array.from({ length: MAX_DATES + 1 }, (_, i) => ({ id: `x-${i}`, start: '2026-12-01', end: '2026-12-01' })) }));
  fails(bad({ dates: [{ id: 'x', start: '2026-12-02', end: '2026-12-01' }] }), '끝이 시작보다 앞');
  fails(bad({ docs: [{ id: 'a', doneAt: 'nope' }] }));
  const noPKey = full(); delete noPKey.profile.channelsOff; fails(noPKey, '빠진 칸');
  const adult = { v: CONSENT_VERSION, at: AT, minor: false, guardian: false, lang: 'ko' };
  validateStudyDocument({ ...full(), consent: adult });
  fails({ ...full(), consent: { ...adult, v: 0 } }, '동의 판 0');
  fails({ ...full(), consent: { ...adult, v: CONSENT_VERSION + 1 } }, '아직 없는 동의 판');
  fails({ ...full(), consent: { ...adult, at: '2026-11-22' } }, '동의 시각 꼴');
  fails({ ...full(), consent: { ...adult, minor: 'no' } });
  fails({ ...full(), consent: { ...adult, minor: true } }, '18세 미만인데 보호자 확인이 없다');
  fails({ ...full(), consent: { ...adult, guardian: true } }, '18세 이상인데 보호자 칸이 켜져 있다');
  fails({ ...full(), consent: { ...adult, lang: 'ru' } });
  fails({ ...full(), consent: null }, '서버 검사(기본)는 동의 없는 문서를 받지 않는다');
});

test('빈 상태는 앱 검사에서만: 동의가 없으면 profile도 비어 있어야 하고, 64KB를 넘으면 거부한다', () => {
  assert.deepEqual(validateStudyDocument(emptyStudyDocument(), { allowEmpty: true }), emptyStudyDocument());
  assert.throws(() => validateStudyDocument(emptyStudyDocument()), (e) => e.code === 'INVALID_PATH_STUDY');
  const leaked = emptyStudyDocument(); leaked.profile.topik = 3;
  assert.throws(() => validateStudyDocument(leaked, { allowEmpty: true }), (e) => e.code === 'INVALID_PATH_STUDY', '동의 없이 값이 든 문서');
  const big = full(); big.profile.target = 'a'; big.extra = 'x'.repeat(70 * 1024);
  assert.throws(() => validateStudyDocument(big), (e) => e.code === 'PATH_STUDY_TOO_LARGE');
});

test('탭 저장의 조건으로 문서를 짓는다(빈 조건도 된다)', () => {
  const empty = createStudyDocument(createProfile(), consent);
  assert.equal(empty.profile.topik, null);
  assert.deepEqual(empty.profile.docs, []);
  const p = normalizeProfile({ ...createProfile(), topik: 4, target: 'wku-ug', docs: [{ id: 'wku-ug-forms', doneAt: AT }] });
  const d = createStudyDocument(p, { v: CONSENT_VERSION, at: AT, minor: false, guardian: false, lang: 'en' });
  assert.equal(d.profile.topik, 4);
  assert.equal(d.profile.target, 'wku-ug');
  assert.equal(d.consent.minor, false);
  assert.throws(() => createStudyDocument(p, { v: CONSENT_VERSION, at: AT, lang: 'ko' }), '18세 미만 여부가 없으면 짓지 않는다');
});
