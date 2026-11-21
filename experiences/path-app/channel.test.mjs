import test from 'node:test';
import assert from 'node:assert/strict';
import { CHANNELS, POSTS, COLLECTING, allPosts, univPosts, validateChannelData, dateStatus, upcomingDates, featuredPost, latestPosts, isStalePost, isNewPost, findDate, endDay, monthDay } from './channel-data.mjs';
import { renderChannels, renderPost, renderUpcoming, renderNews, forYouLines, icsText, leftText } from './channel-ui.mjs';
import { PROGRAMS, RULES, programsFor, programById } from './study-data.mjs';
import { createProfile, normalizeProfile, setField, addDate, removeDate, confirmDate, keepDates, toggleChannel, hasDate, isEmptyProfile, createProfileStore, MAX_DATES, STUDY_KEY, GUEST_OWNER } from './study-profile.mjs';

const REAL = programsFor(PROGRAMS, true);
const IDS = PROGRAMS.map((p) => p.id);
const ALL = allPosts(REAL);
const NOW = new Date('2026-11-21T12:00:00+09:00');
const textOf = (html) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
const view = (profile, extra = {}) => ({ lang: 'ko', profile, posts: ALL, programs: REAL, rules: RULES, now: NOW, ...extra });
const saved = (id) => { const h = findDate(ALL, id); return { id, start: h.date.start, end: endDay(h.date) }; };
const memory = () => ({ data: {}, getItem(k) { return Object.hasOwn(this.data, k) ? this.data[k] : null; }, setItem(k, v) { this.data[k] = String(v); }, removeItem(k) { delete this.data[k]; } });

test('채널 자료: 모든 글에 출처 · 확인한 날 · 상태 · 요점 셋이 있고 날 id는 하나뿐이다', () => {
  assert.equal(validateChannelData(CHANNELS, ALL, IDS), true);
  assert.ok(POSTS.length >= 1, '손으로 쓴 글이 있어야 채널 탭이 열린다');
  for (const p of ALL) {
    assert.ok(/^https:\/\//.test(p.source.url), p.id);
    assert.ok(p.points.every((x) => x.ko.length <= 300 && x.en.length <= 300), p.id);
    for (const d of p.dates) if (d.url) assert.ok(/^https:\/\//.test(d.url), d.id);
    if (p.action) assert.ok(/^https:\/\//.test(p.action.url), p.id);
  }
  const dateIds = ALL.flatMap((p) => p.dates.map((d) => d.id));
  assert.equal(new Set(dateIds).size, dateIds.length);
  assert.ok(ALL.filter((p) => p.forYou === 'topikExam').every((p) => p.dates.some((d) => d.kind === 'result')), '시험 글에는 성적 발표 날이 있다');
  assert.equal(COLLECTING.length, 4);
});

test('채널 자료 검사는 빠진 출처, 셋이 아닌 요점, 겹친 id, 모르는 규칙, 근거 없는 규칙을 막는다', () => {
  const p = POSTS[0];
  const bad = (x) => assert.throws(() => validateChannelData(CHANNELS, [x], IDS), /Invalid channel data/);
  bad({ ...p, source: { ...p.source, url: 'http://example.com/' } });
  bad({ ...p, points: p.points.slice(0, 2) });
  bad({ ...p, status: 'rumor' });
  bad({ ...p, forYou: 'guess' });
  bad({ ...p, dates: p.dates.filter((d) => d.kind !== 'result') });
  bad({ ...p, dates: [{ ...p.dates[0], url: 'javascript:alert(1)' }] });
  bad({ ...p, dates: [{ id: 'x-apply', kind: 'apply', start: '2026-12-10', end: '2026-12-01', label: p.title }] });
  assert.throws(() => validateChannelData(CHANNELS, [p, p], IDS), /Invalid channel data/);
  const gks = POSTS.find((x) => x.forYou === 'gksGrade');
  bad({ ...gks, criteria: undefined });
  const u = univPosts(REAL)[0];
  assert.throws(() => validateChannelData(CHANNELS, [u], []), /Invalid channel data/, '없는 과정을 가리키는 대학 소식');
});

test('대학 소식: 실제 과정마다 한 편, 날은 접수 차수와 같고 id는 차수의 시작 날이라 차수를 끼워도 그대로다', () => {
  const posts = univPosts(REAL);
  assert.equal(posts.length, REAL.filter((p) => p.applyRounds && p.applyRounds.length).length);
  for (const post of posts) {
    const prog = programById(REAL, post.programId);
    assert.deepEqual(post.dates.map((d) => [d.start, d.end]), prog.applyRounds.map((r) => [r[0], r[1]]));
    assert.equal(post.action, null, '요강 주소를 접수처 단추로 걸지 않는다');
    assert.match(post.points[2].ko, /협약한 대학은 아니에요/);
  }
  assert.equal(univPosts(PROGRAMS.filter((p) => p.example)).length, 0, '예시 과정은 글을 만들지 않는다');
  const jj = programById(REAL, 'jj-ug');
  const before = univPosts([jj])[0].dates.map((d) => d.id);
  const added = univPosts([{ ...jj, applyRounds: [['2026-09-01', '2026-09-05'], ...jj.applyRounds] }])[0].dates.map((d) => d.id);
  const dropped = univPosts([{ ...jj, applyRounds: jj.applyRounds.slice(1) }])[0].dates.map((d) => d.id);
  assert.deepEqual(added.slice(1), before);
  assert.deepEqual(dropped, before.slice(1));
  assert.match(univPosts([jj])[0].points[0].ko, /3차 2027년 1월 4일 – 2027년 1월 13일/, '해가 바뀌는 차수에는 해를 붙인다');
});

test('날 상태: 접수 기간은 시작 전 · 접수 중 · 지남, 하루짜리는 남은 날, 한국 날짜로 센다', () => {
  const apply = { kind: 'apply', start: '2026-12-01', end: '2026-12-11' };
  assert.deepEqual(dateStatus(apply, NOW), { state: 'before', days: 10 });
  assert.deepEqual(dateStatus(apply, new Date('2026-12-05T12:00:00+09:00')), { state: 'open', days: 6 });
  assert.deepEqual(dateStatus(apply, new Date('2026-12-11T23:00:00+09:00')), { state: 'open', days: 0 });
  assert.deepEqual(dateStatus(apply, new Date('2026-12-12T00:10:00+09:00')), { state: 'past', days: null });
  const exam = { kind: 'exam', start: '2026-11-28' };
  assert.deepEqual(dateStatus(exam, new Date('2026-11-27T23:30:00+08:00')), { state: 'soon', days: 0 }, '몽골 밤 11시 반은 한국으로 이미 그날이다');
  assert.equal(dateStatus({ ...exam, cancelled: true }, NOW).state, 'cancelled');
});

test('넣은 날 저장: 넣기 · 빼기 · 확인 · 정리, 서른 개 한도, 옛 저장값과 틀린 값', () => {
  let p = createProfile();
  assert.deepEqual([p.dates, p.channelsOff], [[], []]);
  let r = addDate(p, saved('topik-pbt109-result'));
  assert.equal(r.added, true); p = r.profile;
  assert.equal(addDate(p, saved('topik-pbt109-result')).added, false, '같은 날은 한 번만');
  assert.equal(hasDate(p, 'topik-pbt109-result'), true);
  assert.equal(isEmptyProfile(p), true, '넣은 날은 조건이 아니다(오늘 입구는 그대로)');
  p = confirmDate(p, { id: 'topik-pbt109-result', start: '2026-12-23', end: '2026-12-23' });
  assert.equal(p.dates[0].start, '2026-12-23');
  p = removeDate(p, 'topik-pbt109-result');
  assert.deepEqual(p.dates, []);
  let full = createProfile();
  for (let i = 0; i < MAX_DATES; i++) full = addDate(full, { id: `d-${i}`, start: '2026-12-01', end: '2026-12-01' }).profile;
  const over = addDate(full, { id: 'd-over', start: '2026-12-01', end: '2026-12-01' });
  assert.deepEqual([over.added, over.full], [false, true]);
  assert.equal(keepDates(full, ['d-1', 'd-2']).dates.length, 2);
  assert.throws(() => addDate(createProfile(), { id: 'x', start: '2026-13-40', end: '2026-12-01' }), RangeError);
  assert.deepEqual(normalizeProfile({ v: 1, topik: 3 }).dates, [], '이 칸이 없던 옛 저장값');
  assert.deepEqual(normalizeProfile({ v: 1, dates: [{ id: '../x', start: '2026-12-01', end: '2026-12-01' }, { id: 'ok', start: '2026-12-02', end: '2026-12-01' }, 'x'] }).dates, []);
  let c = toggleChannel(createProfile(), 'scam');
  assert.deepEqual(c.channelsOff, ['scam']);
  c = toggleChannel(c, 'scam');
  assert.deepEqual(c.channelsOff, []);
});

test('날만 넣은 손님이 로그인하면 그 계정이 이어받는다', () => {
  const storage = memory();
  const store = createProfileStore(storage);
  store.set(addDate(store.get(), saved('topik-pbt109-result')).profile);
  store.setOwner('qa-account');
  const back = JSON.parse(storage.getItem(STUDY_KEY));
  assert.equal(back.owner, 'qa-account');
  assert.equal(back.dates.length, 1);
  store.clear();
  assert.equal(storage.getItem(STUDY_KEY), null);
  assert.equal(store.owner(), GUEST_OWNER);
});

test('다가오는 날: 가까운 순, 시작 전 접수는 시작 날로, 바뀐 날 · 사라진 날 · 지난 날을 나눈다', () => {
  const list = [saved('topik-pbt109-result'), saved('univ-wku-ug-2026-11-23'), saved('univ-jbnu-ug-2026-11-09'), { id: 'gone-date', start: '2026-12-01', end: '2026-12-01' }, { ...saved('topik-pbt108-result'), start: '2026-12-09', end: '2026-12-09' }];
  const u = upcomingDates(ALL, list, NOW);
  assert.deepEqual(u.upcoming.map((r) => r.date.id), ['univ-wku-ug-2026-11-23', 'topik-pbt108-result', 'topik-pbt109-result']);
  assert.deepEqual(u.past.map((r) => r.date.id), ['univ-jbnu-ug-2026-11-09']);
  assert.equal(u.missing, 1);
  assert.deepEqual(u.upcoming[1].changed, { start: '2026-12-09', end: '2026-12-09' });
  assert.equal(u.upcoming[0].changed, null);
  const html = renderUpcoming(view({ ...createProfile(), dates: list })), text = textOf(html);
  assert.match(text, /넣은 날은 이 탭에만 있어요/);
  assert.match(text, /11월 23일~27일/);
  assert.match(text, /시작 D-2/);
  assert.match(text, /2일 뒤 접수 시작/, '화면 읽기 글');
  assert.match(text, /날짜가 바뀌었어요\(전에 본 날 12월 9일\)/);
  assert.match(html, /data-action="dateConfirm" data-id="topik-pbt108-result">확인했어요<span class="sr-only"> PBT 제108회 성적 발표<.span>/, '확인 단추에도 날 이름');
  assert.match(html, /data-date="topik-pbt108-result"/, '줄 단추는 날 id를 갖는다(확인 뒤 초점)');
  assert.match(html, /id="sx-up-h" tabindex="-1"/);
  assert.match(text, /글에서 빠지거나 바뀐 날이 1개 있어요/);
  assert.match(html, /<details class="sx-past"><summary>지난 날 1개/);
  assert.equal(renderUpcoming(view(createProfile())), '', '넣은 날이 없으면 칸을 두지 않는다');
  const order = upcomingDates(ALL, [saved('topik-pbt108-result'), saved('univ-jbnu-lang-2026-11-30'), saved('topik-ibt16-exam-mn')], NOW).upcoming.map((r) => r.date.id);
  assert.deepEqual(order, ['topik-ibt16-exam-mn', 'univ-jbnu-lang-2026-11-30', 'topik-pbt108-result'], '시작 전 접수(11-30 시작 · 12-11 마감)는 날짜 칸에 보이는 시작 날로 센다');
  const en = textOf(renderUpcoming(view({ ...createProfile(), dates: [saved('topik-pbt109-result')] }, { lang: 'en' })));
  assert.match(en, /31 days left/);
  assert.doesNotMatch(en, /D-31/);
});

test('채널 글: 넣기 단추는 aria-pressed와 날 이름을 갖고, 지난 날은 넣을 수 없고, 90일이 지나면 다시 확인하라고 한다', () => {
  const post = ALL.find((p) => p.id === 'topik-mn-2026-results');
  const html = renderPost(view({ ...createProfile(), dates: [saved('topik-pbt109-result')] }, { postId: post.id }));
  assert.match(html, /aria-pressed="true" data-action="dateToggle" data-id="topik-pbt109-result"><span class="sx-on">.*?<\/span>내 길에 넣기<span class="sr-only"> PBT 제109회 성적 발표<\/span>/);
  assert.match(html, /aria-pressed="false" data-action="dateToggle" data-id="topik-pbt108-result">/);
  const after = renderPost(view(createProfile(), { postId: post.id, now: new Date('2026-12-20T12:00:00+09:00') }));
  assert.doesNotMatch(after, /data-action="dateToggle" data-id="topik-pbt108-result"/, '지난 날에는 넣기 단추가 없다');
  assert.match(after, /data-action="dateToggle" data-id="topik-pbt109-result"/);
  assert.doesNotMatch(textOf(renderPost(view(createProfile(), { postId: post.id, now: new Date('2027-02-19T12:00:00+09:00') }))), /90일이 지났어요/);
  assert.match(textOf(renderPost(view(createProfile(), { postId: post.id, now: new Date('2027-02-20T12:00:00+09:00') }))), /확인한 지 90일이 지났어요/);
  assert.equal(isStalePost(post, new Date('2026-11-21T00:00:00+09:00').getTime() + 400 * 86400000), true);
  assert.equal(validateChannelData(CHANNELS, ALL, IDS), true, '검사는 날짜가 지나도 깨지지 않는다');
  assert.match(textOf(renderPost(view(createProfile(), { postId: 'scam-agency-registration' }))), /계획 발표 · 시행일 미정/);
  const action = renderPost(view(createProfile(), { postId: 'scam-check-university' }));
  assert.match(action, /class="sx-cta" href="https:\/\/www\.studyinkorea\.go\.kr\/ko\/plan\/certifiedUniversity\.do" target="_blank" rel="noopener noreferrer">/);
  const uni = renderPost(view(createProfile(), { postId: 'univ-wku-ug' }));
  assert.doesNotMatch(uni, /class="sx-cta"/);
  assert.match(uni, /data-action="univOpen" data-id="wku-ug"/);
  assert.match(uni, /id="sx-dates-h" tabindex="-1"/, '지난 날을 빼서 단추가 사라지면 초점이 갈 제목');
  assert.match(textOf(uni), /넣은 날은 이 탭에만 있어요/);
  // 날이 모두 지난 글에는 넣을 단추가 없으므로 저장 안내를 띄우지 않는다. 요점은 지나도 맞는 말이고 해를 밝힌다.
  assert.match(textOf(uni), /탭을 닫거나 로그아웃하면 사라지니/, '로그아웃해도 지워진다고 알린다(페이블 F1)');
  // 저장이 막힌 브라우저와 넣기 · 달력 실패는 눈으로도 보인다(페이블 F3).
  const blocked = renderPost(view(createProfile(), { postId: 'univ-wku-ug', persisted: false }));
  assert.match(blocked, /class="sx-store is-warn sx-store-line">이 브라우저에서는 저장할 수 없어서 넣은 날을 지금 화면에서만 기억해요/);
  assert.match(renderUpcoming(view({ ...createProfile(), dates: [saved('topik-pbt109-result')] }, { persisted: false })), /sx-store is-warn/);
  assert.match(renderPost(view(createProfile(), { postId: 'univ-wku-ug', note: '다가오는 날이 서른 개라 더 넣을 수 없어요.' })), /<p class="sx-store is-warn sx-date-note">다가오는 날이 서른 개라 더 넣을 수 없어요\.<\/p>/);
  assert.doesNotMatch(uni, /sx-date-note/);
  const shut = textOf(renderPost(view(createProfile(), { postId: 'univ-jbnu-ug' })));
  assert.doesNotMatch(shut, /이 탭에만 있어요/);
  assert.match(shut, /접수 기간\(2026년\): 1차 9월 21일 – 10월 2일, 2차 11월 9일 – 11월 20일\./);
  // 조건 화면이 없는 판(과정 0)에서는 「내 조건 넣기」를 걸지 않는다.
  const noCond = renderPost(view(createProfile(), { postId: 'visa-funds-proof', condOn: false }));
  assert.doesNotMatch(noCond, /data-page="cond"/);
  assert.doesNotMatch(textOf(noCond), /넣으면 나란히/);
  const funds = renderPost(view(createProfile(), { postId: 'visa-funds-proof' }));
  assert.match(funds, /data-page="cond"/);
  assert.match(textOf(funds), /KVAC 몽골 유학\(D-2\) 서류 목록 7번 칸\(2026-11-22 확인\)/, 'KVAC에서 읽은 사실은 날짜와 함께(페이블 FA2)');
  assert.match(funds, /class="sx-cta" href="https:\/\/www\.visaforkorea\.mn\/ko\/study-visa-d-2-1d-2-4"/);
  assert.match(textOf(renderPost(view(createProfile(), { postId: 'gks-2027-u' }))), /지방 대학에만 지원하는 R-GKS 전형 2명/);
  assert.match(textOf(renderPost(view(createProfile(), { postId: 'no-such' }))), /글을 찾지 못했어요/);
});

test('「내게 해당되나요?」: 판정 말 대신 기준과 내 값, 지방 · 수도권 금액, 확인 중인 금액은 비교하지 않음', () => {
  const fin = ALL.find((p) => p.forYou === 'finance');
  const lines = (profile, rules = RULES, lang = 'ko') => forYouLines(fin, { lang, profile, posts: ALL, programs: REAL, rules, now: NOW }).map((l) => l.text).join(' / ');
  const ko = lines(setField(createProfile(), 'fundsWon', 12000000));
  assert.match(ko, /어학연수\(D-4\): 지방 대학 800만 원, 수도권 대학 1,000만 원/);
  assert.match(ko, /유학\(D-2\): 지방 대학 1,600만 원, 수도권 대학 2,000만 원/);
  assert.match(ko, /내 값: 1,200만 원/);
  assert.match(ko, /14일 안에 발급받고, 그 금액을 30일 이상/);
  assert.match(ko, /계획 발표: TOPIK 4급/);
  assert.doesNotMatch(ko, /맞아요|모자라요|넘고/);
  assert.match(lines(createProfile()), /준비한 돈을 넣으면 나란히 보여 줘요/);
  const loose = RULES.map((r) => (r.kind === 'finance' && r.region === 'metro' ? { ...r, inCurrentGuide: false } : r));
  assert.match(lines(createProfile(), loose), /수도권 대학 금액 확인 중\(비교하지 않음\)/);
  const stale = RULES.map((r) => (r.kind === 'finance' && r.visa === 'D-4' && r.region === 'local' ? { ...r, stale: true } : r));
  assert.match(lines(createProfile(), stale), /지방 대학 금액 확인 중/);
  assert.match(lines(createProfile(), RULES, 'en'), /Study \(D-2\): outside Seoul area ₩16,000,000, Seoul area ₩20,000,000/);
  const gks = ALL.find((p) => p.forYou === 'gksGrade');
  const g = forYouLines(gks, view(setField(createProfile(), 'gradePct', 78))).map((l) => l.text).join(' / ');
  assert.match(g, /기준: 고등학교 전 학년 성적 평균 80% 이상 \(또는 석차 상위 20% 안/);
  assert.match(g, /내 값: 평균 78%/);
  const t = forYouLines(ALL.find((p) => p.id === 'topik-mn-2026-results'), view(createProfile())).map((l) => l.text).join(' / ');
  assert.match(t, /마감 전에 성적이 나오는 곳이에요\. \/ 전북대학교 한국어학당 1차\(12월 11일 마감\): PBT 제108회 \/ /);
  assert.match(t, /원광대학교 한국문화교육센터\(12월 24일 마감\): PBT 제108회, IBT 제16회, PBT 제109회 \/ 전북대학교 한국어학당 2차\(12월 25일 마감\)/);
  assert.match(t, /전주대학교 학부 3차\(2027년 1월 13일 마감\): PBT 제108회, IBT 제16회, PBT 제109회 \/ 성적표를/);
  assert.match(t, /성적표를 언제까지 내야 하는지는 과정마다 달라요/);
  const prog = forYouLines(ALL.find((p) => p.id === 'univ-wku-ug'), view(setField(createProfile(), 'topik', 3))).map((l) => l.text).join(' / ');
  assert.match(prog, /내 조건 4개 중 \d개 맞음/);
  assert.match(textOf(renderPost(view(createProfile(), { postId: fin.id }))), /약속하지 않아요/);
});

test('채널 화면: 맨 위 글은 가장 가까운 날, 채널마다 「오늘 화면에 보이기」, 글이 없는 채널은 한 줄로', () => {
  assert.equal(featuredPost(ALL, NOW).id, 'univ-wku-ug', '11-23에 열리는 원광대 1차가 가장 가깝다');
  const html = renderChannels(view(createProfile())), text = textOf(html);
  assert.match(html, /aria-pressed="true" data-action="channelShow" data-id="scam"><span class="sx-on">[\s\S]*?<\/span>오늘 화면에 보이기<span class="sr-only"> 사기 주의<\/span>/);
  assert.match(text, /글을 모으는 중: 한국 생활, 취업, 선배 이야기, 부모님 방/);
  assert.doesNotMatch(html, /<button[^>]*class="sx-ch"[^>]*>(?:(?!<\/button>).)*<button/s, '줄 단추 안에 다른 단추를 넣지 않는다');
  const off = renderChannels(view({ ...createProfile(), channelsOff: ['scam'] }));
  assert.match(off, /aria-pressed="false" data-action="channelShow" data-id="scam"/);
  const one = textOf(renderChannels(view(createProfile(), { channelId: 'scam' })));
  assert.match(one, /사기 주의/);
  assert.match(one, /「비자를 받아 준다」는 말은 믿지 마세요/);
  assert.match(one, /계획 발표 해외 유학원 등록제는 아직 계획이에요/);
  assert.equal(isNewPost(POSTS[0], NOW), true);
  assert.equal(isNewPost(POSTS[0], new Date('2026-12-06T12:00:00+09:00')), false);
  assert.deepEqual(latestPosts(ALL, CHANNELS.map((c) => c.id).filter((id) => id !== 'scam'), 5).map((p) => p.channel), ['scam', 'scam', 'scam']);
  assert.match(textOf(renderNews(view(createProfile()))), /새 소식/);
  assert.match(renderNews(view(createProfile())), /<h2 class="sx-h" id="sx-news-h">새 소식<\/h2><button/, '제목 안에 단추를 넣지 않는다(구역 이름이 「새 소식」으로만 읽힌다)');
  assert.equal(renderNews(view({ ...createProfile(), channelsOff: CHANNELS.map((c) => c.id) })), '');
  assert.match(textOf(renderChannels(view(createProfile(), { lang: 'en' }))), /Show on Today/);
});

test('달력 파일: 줄끝은 CRLF, 한 줄 75바이트 안, 접수 기간은 마감 날 종일 일정', () => {
  const hit = findDate(ALL, 'univ-wku-ug-2026-12-28');
  const ics = icsText(hit.post, hit.date, 'ko', new Date('2026-11-21T03:00:00Z'));
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'));
  assert.match(ics, /DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101/);
  assert.match(ics, /UID:univ-wku-ug-2026-12-28@path\.synk\.im/);
  assert.match(ics, /SUMMARY:원광대학교 학부 2차 원서 접수 마감/, '달력 목록에서 어느 대학인지 보인다');
  for (const line of ics.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75, line);
  assert.doesNotMatch(ics.replace(/\r\n /g, ''), /[^\\],(?=[^\r\n]*\r\nURL)/, '설명의 쉼표는 이스케이프한다');
  const one = icsText(findDate(ALL, 'topik-pbt109-result').post, findDate(ALL, 'topik-pbt109-result').date, 'en');
  assert.match(one, /DTSTART;VALUE=DATE:20261222/);
  assert.match(one, /SUMMARY:PBT round 109 results/);
});

test('남은 날 글과 날짜 글', () => {
  const T = { L: (ko) => ko };
  assert.deepEqual(leftText({ state: 'open', days: 0 }, T), { shown: '오늘 마감', said: '오늘 마감' });
  assert.deepEqual(leftText({ state: 'soon', days: 3 }, T).said, '3일 남음');
  assert.equal(monthDay('2027-01-13', false, 2026), '2027년 1월 13일');
  assert.equal(monthDay('2026-12-11', true, 2026), 'Dec 11');
});
