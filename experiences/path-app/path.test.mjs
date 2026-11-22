import test from 'node:test';
import assert from 'node:assert/strict';
import { PROGRAM_DOCS, VISA_DOCS, DOC_STAGES, docsFor, visaFor, validateDocsData, deadlineDates } from './docs-data.mjs';
import { renderPath, renderPathCard, renderPathPick, pathTarget, stageCounts } from './path-ui.mjs';
import { allPosts } from './channel-data.mjs';
import { PROGRAMS, programsFor, programById } from './study-data.mjs';
import { createProfile, normalizeProfile, setTarget, toggleDoc, hasDoc, createProfileStore, MAX_DOCS, STUDY_KEY } from './study-profile.mjs';

const REAL = programsFor(PROGRAMS, true);
const ALL = allPosts(REAL);
const NOW = new Date('2026-11-22T12:00:00+09:00');
const textOf = (html) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
const view = (profile, extra = {}) => ({ lang: 'ko', profile: normalizeProfile(profile), posts: ALL, programs: REAL, now: NOW, ...extra });
const memory = () => ({ data: {}, getItem(k) { return Object.hasOwn(this.data, k) ? this.data[k] : null; }, setItem(k, v) { this.data[k] = String(v); }, removeItem(k) { delete this.data[k]; } });
const withTarget = (id, fields = {}) => ({ ...createProfile(), target: id, ...fields });

test('서류 자료: 실제 과정마다 출처와 확인한 날이 있고, 학부는 D-2 · 어학은 D-4-1 비자 묶음을 쓴다', () => {
  assert.equal(validateDocsData(PROGRAM_DOCS, VISA_DOCS, REAL.map((p) => p.id)), true);
  for (const p of REAL) {
    const set = docsFor(p, createProfile());
    assert.ok(set, `${p.id} has docs`);
    assert.equal(set.visa, VISA_DOCS[visaFor(p)]);
    assert.ok(set.all.every((d) => DOC_STAGES.includes(d.stage)));
    assert.ok(set.program.docs.every((d) => d.id.startsWith(p.id + '-')), '과정 서류 id는 과정 id로 시작');
  }
  assert.equal(visaFor(programById(REAL, 'jbnu-lang')), 'D-4-1');
  assert.equal(visaFor(programById(REAL, 'jj-ug')), 'D-2');
  assert.equal(docsFor(PROGRAMS.find((p) => p.example), createProfile()), null, '예시 과정은 서류가 없다');
});

test('접는 것은 출처가 「해당자만」 · 「가진 사람만」이라고 적은 서류뿐: 필수 어학 증빙은 급수 0이어도 보인다', () => {
  const zero = { ...createProfile(), topik: 0 };
  const jbnu = docsFor(programById(REAL, 'jbnu-ug'), zero);
  assert.ok(jbnu.mine.some((d) => d.id === 'jbnu-ug-language'), '전북대 학부 어학 증빙은 모두에게 필수');
  assert.ok(docsFor(programById(REAL, 'jj-ug'), zero).mine.some((d) => d.id === 'jj-ug-language'));
  for (const p of [zero, createProfile(), { ...createProfile(), topik: 4 }]) {
    assert.ok(docsFor(programById(REAL, 'wku-ug'), p).notMine.some((d) => d.id === 'wku-ug-language'), '원광대 학부 어학 증빙은 가진 사람만 내는 선택 서류라 늘 접힌다');
  }
  assert.deepEqual(jbnu.notMine.map((d) => d.id), ['jbnu-ug-arc', 'jbnu-ug-portfolio', 'visa-d2-crime', 'visa-d2-language']);
  assert.ok(jbnu.notMine.every((d) => d.only && d.only.cond.ko));
});

test('서류 기한의 날 id는 차수의 시작 날에 매달리고, 검사는 틀린 기한을 막는다', () => {
  assert.deepEqual(deadlineDates('jbnu-ug').map((d) => d.id), ['univ-jbnu-ug-2026-11-09-docs', 'univ-jbnu-ug-2026-11-09-originals']);
  assert.ok(deadlineDates('jj-ug').every((d) => d.kind === 'deadline' && d.docsDue === true));
  assert.deepEqual(deadlineDates('no-such'), []);
  const ug = PROGRAM_DOCS['jj-ug'];
  const bad = (deadlines) => ({ ...PROGRAM_DOCS, 'jj-ug': { ...ug, deadlines } });
  assert.throws(() => validateDocsData(bad([{ ...ug.deadlines[0], start: '2026-11-01' }]), VISA_DOCS), /deadline/, '차수 시작보다 앞선 기한');
  assert.throws(() => validateDocsData(bad([ug.deadlines[0], ug.deadlines[0]]), VISA_DOCS), /deadline/, '같은 차수 · 같은 종류가 둘');
  const noCond = { ...ug, docs: [{ ...ug.docs[0], only: {} }, ...ug.docs.slice(1)] };
  assert.throws(() => validateDocsData({ ...PROGRAM_DOCS, 'jj-ug': noCond }, VISA_DOCS), /only/, '접는 서류에는 원문 조건이 있어야 한다');
  assert.throws(() => validateDocsData({ ...PROGRAM_DOCS, 'jj-ug': { ...ug, id: 'docs-jbnu-ug' } }, VISA_DOCS), /source jj-ug/, '묶음 id는 만료 알림이 읽는 꼴');
  assert.deepEqual(Object.values(VISA_DOCS).map((v) => v.id), ['docs-visa-d2', 'docs-visa-d4-1']);
});

test('탭 저장: 과정 고르기 · 그만하기 · 바꾸기와 표시, 예순 개 한도, 옛 저장값', () => {
  let p = createProfile();
  p = setTarget(p, 'jbnu-ug').profile;
  assert.equal(p.target, 'jbnu-ug');
  let r = toggleDoc(p, 'jbnu-ug-passport', NOW);
  assert.equal(r.on, true);
  assert.equal(r.profile.docs[0].doneAt, NOW.toISOString());
  p = toggleDoc(r.profile, 'visa-d2-photo', NOW).profile;
  assert.equal(hasDoc(p, 'jbnu-ug-passport'), true);
  assert.equal(toggleDoc(p, 'jbnu-ug-passport', NOW).on, false, '다시 누르면 뺀다');
  const stop = setTarget(p, null);
  assert.equal(stop.profile.target, null);
  assert.equal(stop.profile.docs.length, 2, '그만해도 표시는 남는다');
  const keep = docsFor(programById(REAL, 'jj-ug'), p).all.map((d) => d.id);
  const sw = setTarget(p, 'jj-ug', keep);
  assert.equal(sw.dropped, 1, '새 과정에 없는 전북대 표시만 지운다');
  assert.deepEqual(sw.profile.docs.map((d) => d.id), ['visa-d2-photo'], '같은 비자 서류 표시는 이어진다');
  let full = createProfile();
  for (let i = 0; i < MAX_DOCS; i++) full = toggleDoc(full, `doc-${i}`, NOW).profile;
  assert.equal(toggleDoc(full, 'doc-x', NOW).full, true);
  assert.deepEqual(normalizeProfile({ v: 1, topik: 3 }).docs, [], '칸이 없던 옛 저장값');
  assert.equal(normalizeProfile({ v: 1, target: 'BAD ID', docs: [{ id: 'ok', doneAt: 'nope' }] }).target, null);
  assert.deepEqual(normalizeProfile({ v: 1, docs: [{ id: 'ok', doneAt: 'nope' }] }).docs, []);
  assert.throws(() => setTarget(createProfile(), 'BAD ID'), RangeError);
});

test('주인 규칙 그대로: 고른 과정만 있는 손님도 로그인하면 이어받고, 다른 계정이면 지운다', () => {
  const s = memory(), store = createProfileStore(s);
  store.set(setTarget(createProfile(), 'wku-ug').profile);
  store.setOwner('acct-1');
  assert.equal(JSON.parse(s.getItem(STUDY_KEY)).owner, 'acct-1');
  assert.equal(store.get().target, 'wku-ug');
  store.clear();
  assert.equal(s.getItem(STUDY_KEY), null);
});

test('내 길 화면: 고른 과정이 없으면 대학 탭으로, 있으면 세 묶음과 묶음마다의 진행 줄', () => {
  assert.match(textOf(renderPath(view(createProfile()))), /준비할 과정을 골라 주세요/);
  assert.match(renderPath(view(createProfile())), /data-action="nav" data-page="univ"/);
  const html = renderPath(view(withTarget('wku-ug', { docs: [{ id: 'wku-ug-forms', doneAt: NOW.toISOString() }] }))), text = textOf(html);
  assert.match(text, /준비 중인 과정/);
  assert.match(text, /원광대학교 학부/);
  for (const s of ['apply', 'admitted', 'visa']) assert.match(html, new RegExp(`id="sx-stage-${s}"`));
  assert.match(html, /<progress class="sx-prog" value="1" max="7"/, '원서 묶음 1/7(접힌 서류 3개는 세지 않는다)');
  assert.match(html, /aria-pressed="true" data-action="docToggle" data-id="wku-ug-forms"><span class="sx-on">[\s\S]*?<\/span>준비했어요<span class="sr-only"> 입학원서 · 개인정보 수집 및 이용 동의서\(대학 서식\)<\/span>/);
  assert.match(text, /요강에서 두 가지로 읽혀요/);
  assert.match(text, /요강 파일 이름에 「\(안\)」이 붙어 있어/);
  assert.match(text, /원광대 국제교류과\(063-850-5843/);
  const section = (s) => html.match(new RegExp(`<section class="sx-stage" aria-labelledby="sx-stage-${s}">[\\s\\S]*?</section>`))[0];
  assert.match(section('apply'), /<details class="sx-past sx-folded" data-fold="docs-apply"><summary>해당하는 사람만 내는 서류 3개<\/summary>[\s\S]*data-id="wku-ug-translator"/, '접힌 서류는 그 서류를 내는 묶음 안에 있다');
  assert.match(renderPath(view(withTarget('wku-ug', { docs: [{ id: 'wku-ug-arc', doneAt: NOW.toISOString() }] }))), /해당하는 사람만 내는 서류 3개 · 1개 표시<\/summary>/, '접힌 채로도 표시한 수가 보인다');
  assert.match(section('visa'), /해당하는 사람만 내는 서류 2개[\s\S]*data-id="visa-d2-crime"/);
  assert.doesNotMatch(section('apply'), /visa-d2-crime/);
  assert.match(section('visa'), /<b>KVAC에 확인할 것<\/b> KVAC 누리집에/, '비자 서류의 확인 상자는 요강 이야기가 아니다');
  assert.doesNotMatch(section('visa'), /요강에서 두 가지로 읽혀요|대학에 먼저 물어보세요/);
  assert.match(section('apply'), /<b>요강에서 두 가지로 읽혀요<\/b>[^<]*<\/p><p>대학에 먼저 물어보세요\.<\/p>/);
  assert.match(text, /날짜 조건 여권이 6개월 이상 남아 있어야 해요/);
  assert.match(text, /비자신청센터\(KVAC\)에 내요/);
  assert.match(text, /내가 표시한 것이에요\. 대학이나 비자신청센터\(KVAC\)가 확인한 것이 아니에요/);
  assert.match(text, /표시는 이 탭에만 있어요/);
  assert.match(html, /id="sx-dates-h"/, '과정의 날짜(원서 차수 · 서류 기한)를 함께 보인다');
  assert.match(textOf(renderPath(view(withTarget('wku-ug'), { persisted: false }))), /표시를 지금 화면에서만 기억해요/);
  assert.match(textOf(renderPath(view(withTarget('wku-ug'), { docFull: true }))), /표시가 예순 개라/);
});

test('원서 접수가 끝난 과정은 끝났다고 먼저 말하고, 접수 전 · 중의 날은 시작 · 마감을 가른다', () => {
  const closed = textOf(renderPath(view(withTarget('jbnu-ug'))));
  assert.match(closed, /이번 원서 접수 끝남/);
  assert.match(closed, /이번 원서 접수는 끝났어요\. 이미 원서를 냈다면 남은 기한은 2차 서류 제출 마감\(2차 원서를 낸 사람만\) 11월 27일이에요/);
  assert.match(textOf(renderPathCard(view(withTarget('jbnu-ug')))), /이번 원서 접수는 끝났어요 · 이미 냈다면 2차 서류 제출 마감/);
  assert.match(textOf(renderPathCard(view(withTarget('jj-ug')))), /다음: 2차 원서 접수 · 12월 1일 시작/);
  assert.match(textOf(renderPathCard(view(withTarget('jj-ug'), { now: new Date('2026-12-05T12:00:00+09:00') }))), /다음: 2차 원서 접수 · 12월 11일 마감/);
  assert.doesNotMatch(textOf(renderPath(view(withTarget('jj-ug')))), /이번 원서 접수는 끝났어요/);
});

test('원서 묶음을 다 표시하면 접힌 서류와 둘로 읽히는 곳의 수를 함께 적는다', () => {
  const set = docsFor(programById(REAL, 'jbnu-ug'), createProfile());
  const docs = set.mine.filter((d) => d.stage === 'apply').map((d) => ({ id: d.id, doneAt: NOW.toISOString() }));
  const prof = withTarget('jbnu-ug', { docs });
  assert.deepEqual(stageCounts(set, prof).apply, { n: docs.length, total: docs.length });
  const text = textOf(renderPath(view(prof)));
  assert.match(text, /원서 서류를 다 표시했어요\. 해당하는 사람만 내는 서류 2개, 요강이 두 가지로 읽히는 곳 3개는 따로 확인하세요/);
});

test('영어 화면에는 요강의 한국어 서류 이름을 함께 보이고, 오늘 카드와 고르기 상자', () => {
  const en = renderPath(view(withTarget('jj-ug'), { lang: 'en' }));
  assert.match(en, /<small class="sx-doc-ko" lang="ko">면접 동영상<\/small>/);
  assert.match(textOf(en), /Application documents|With the application/);
  const card = textOf(renderPathCard(view(withTarget('jj-ug', { docs: [{ id: 'jj-ug-form', doneAt: NOW.toISOString() }] }))));
  assert.match(card, /내 길/);
  assert.match(card, /원서 서류 1\/7 표시/);
  assert.equal(renderPathCard(view(createProfile())), '');
  assert.equal(pathTarget(view(withTarget('example-a-ug'))), null, '예시나 없는 과정은 내 길이 없다');
  const pick = renderPathPick(view(withTarget('jj-ug')), programById(REAL, 'jj-ug'));
  assert.match(pick, /aria-pressed="true" data-action="pathPick" data-id="jj-ug"/);
  assert.match(pick, /data-page="path"/);
  assert.match(renderPathPick(view(createProfile()), programById(REAL, 'jbnu-lang')), /어학연수\(D-4-1\)/);
  assert.equal(renderPathPick(view(createProfile()), PROGRAMS.find((p) => p.example)), '');
});
