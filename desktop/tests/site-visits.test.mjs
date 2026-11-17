// 솔리오 「방문자 분석」(2026-11-17): 요약 파일 읽기(site-visits.cjs)와 화면 글(site-visits-model.mjs). 요약은 합성이다.
// 화면 글의 꼴은 검정 구 시안(docs/디자인/플랫폼_클라이언트_검정구_20261116/검정구.html의 VIS)과 같다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { siteVisitsView, rowSpeech, SITE_VISITS_NAME, monthDay } from '../renderer/site-visits-model.mjs';

const require = createRequire(import.meta.url);
const { createSiteVisits, defaultFile, shapeProblem } = require('../src/site-visits.cjs');

const NOW = new Date(2026, 10, 24, 12, 0).getTime();
const iso = t => new Date(t).toISOString();
const summary = (patch = {}) => ({
  판: 1, 만든때: iso(NOW - 3600e3), 기간날수: 7, 세는쪽: Array.from({ length: 15 }, (_, i) => `/p${i}/`), 안세는쪽: ['/a/', '/b/', '/c/', '/d/', '/e/'],
  방문: { 상태: '됨', 까닭: null, 받은때: iso(NOW), 켠날: '2026-11-17', 마지막기록: iso(NOW - 2 * 3600e3), 사람: 12, 앞사람: 9, 본쪽: 20, 다시연쪽: 0, 버림: 0, 급증: null,
    갈래: [{ 이름: '검색', 수: 3 }, { 이름: 'SNS', 수: 6 }, { 이름: 'AI 답변', 수: 1 }, { 이름: '직접', 수: 2 }, { 이름: '다른 사이트', 수: 0 }],
    들어온곳: [{ 이름: '인스타그램', 수: 6 }, { 이름: '구글', 수: 3 }], 첫쪽: [{ 쪽: '/', 이름: '홈', 수: 8 }], 날마다: [1, 2, 0, 3, 2, 2, 2].map((수, i) => ({ 날: `2026-11-${18 + i}`, 수 })), AI방문: 1 },
  쪽: { 상태: '됨', 까닭: null, 쪽들: [{ 쪽: '/', 이름: '홈', 본수: 14, 떠남수: 9, 머문시간: '30초~1분', 끝까지: 0.333, 떠남비율: 0.5 }, { 쪽: '/pulse/', 이름: 'PULSE', 본수: 4, 떠남수: 2, 머문시간: null, 끝까지: null, 떠남비율: null }] },
  행동: { 상태: '됨', 까닭: null, 문의: { 합: 1, 나눔: [{ 이름: '문의 메일', 수: 1 }, { 이름: '문의 양식', 수: 0 }] }, 앱받기: { 합: 2, 나눔: [{ 이름: '앱 받기(Windows)', 수: 2 }, { 이름: '앱 받기(Mac)', 수: 0 }] },
    문의비율: null, 앱받기비율: null, 처음들어온곳별: [{ 갈래: 'SNS', 문의: 1, 앱받기: 2 }] },
  목적: { 상태: '됨', 까닭: null, 방문: 5, 고른방문: 2, 고른칸: [{ 이름: 'PULSE · 광고·영상', 수: 2 }] },
  검색: { 구글: { 상태: '됨', 까닭: null, 시작: '2026-10-25', 끝: '2026-11-21', 노출: 1140, 클릭: 8, 평균순위: 9.5, 앞: { 노출: 900, 클릭: 5, 평균순위: 11 }, 검색어: [{ 말: 'synk', 노출: 681, 클릭: 2 }], 쪽: [{ 쪽: '/', 노출: 317, 클릭: 3 }] },
    네이버: { 상태: '등록 전', 까닭: '네이버 서치어드바이저에 아직 등록하지 않았습니다.' } },
  AI: { 상태: '됨', 까닭: null, 회차날: '2026-11-23', 서비스: [
    { 이름: 'Claude', 설명: '웹 검색을 켠 답', 일반질문: 24, 답받음: 24, 언급: 0, 인용: 0, 브랜드질문: 6, 브랜드답받음: 6, 브랜드인용: 5 },
    { 이름: 'Gemini', 설명: '검색 없이 기억으로 답한 값', 일반질문: 24, 답받음: 22, 언급: 1, 인용: 0, 브랜드질문: 6, 브랜드답받음: 6, 브랜드인용: 1 }],
    앞회차: { 날: '2026-11-16', 서비스: [{ 이름: 'Claude', 언급: 0, 답받음: 24 }] }, 멈춤: {}, AI방문: 1 },
  ...patch,
});
const ok = s => ({ ok: true, available: true, summary: s });
const texts = v => [v.say, v.then, v.when, v.scope, ...v.rows.flatMap(r => [r.nm, r.mid, r.val, r.when, ...r.more.flatMap(m => m.flat())])].filter(x => typeof x === 'string');

test('the program name is the word Yuho used', () => {
  assert.equal(SITE_VISITS_NAME, '방문자 분석');
});

test('no summary file means the program is not shown at all', () => {
  assert.deepEqual(siteVisitsView({ ok: true, available: false }, NOW), { visible: false });
  assert.deepEqual(siteVisitsView(null, NOW), { visible: false });
});

test('the view has the design shape: a conclusion in two parts, five rows of four cells, when and scope', () => {
  const v = siteVisitsView(ok(summary()), NOW);
  assert.equal(v.say, '지난 7일 동안 사람이 12번 들어왔고, 문의를 1번, 앱 받기를 2번 눌렀습니다.');
  assert.equal(v.then, '인스타그램에서 가장 많이 왔습니다.');
  assert.match(v.when, /^11월 24일 11:00에 모았습니다\. 하루에 한 번 모읍니다\.$/);
  assert.equal(v.scope, '세는 쪽 15 · 아직 세지 않는 쪽 5');
  assert.deepEqual(v.rows.map(r => [r.key, r.nm]), [['from', '어디서 왔나'], ['pages', '어디를 봤나'], ['acts', '문의와 앱 받기'], ['search', '검색에 나오나'], ['ai', 'AI에게 물으면']]);
  for (const r of v.rows) for (const k of ['nm', 'mid', 'val', 'when']) assert.equal(typeof r[k], 'string', `${r.key}.${k}`);
  const [from, pages, acts, search, ai] = v.rows;
  assert.equal(from.now, 1, 'the first row with numbers is the lit one');
  assert.equal(from.mid, 'SNS 6 · 검색 3 · 직접 2 · AI 답변 1 · 다른 사이트 0');
  assert.equal(from.val, '12번');
  assert.equal(from.when, '그 앞 7일 9번');
  assert.deepEqual(from.more.find(m => m[0] === 'week'), ['week', '날마다', [1, 2, 0, 3, 2, 2, 2], '하루 평균 1.7번']);
  assert.ok(from.more.some(m => m[0] === 'row' && m[1] === '홈에서 고른 사업' && m[2] === 'PULSE 2' && m[3] === '2번'));
  assert.equal(pages.mid, '홈 14 · PULSE 4');
  assert.equal(pages.val, '20쪽');
  assert.equal(pages.when, '사람 한 번에 1.7쪽');
  assert.deepEqual(pages.more.find(m => m[1] === '홈'), ['row', '홈', '머문 시간 30초~1분 · 끝까지 내림 33%', '14쪽', '여기서 나감 50%']);
  assert.deepEqual(pages.more.find(m => m[1] === 'PULSE'), ['row', 'PULSE', '떠날 때의 기록이 적어 아직 비율을 셈하지 않습니다', '4쪽', '']);
  assert.equal(acts.mid, '문의 1 · 앱 받기 2');
  assert.equal(acts.val, '3번');
  assert.equal(acts.when, '', 'no ratio under 30 visits');
  assert.deepEqual(acts.more.find(m => m[1] === '문의'), ['row', '문의', '메일 1 · 주소 복사 0 · 양식 0 · 광고 의뢰 0', '1번', 'SNS에서 1']);
  assert.equal(search.mid, '구글 지난 28일 · 1,140번 보임 · 평균 10번째');
  assert.equal(search.val, '8번 눌림');
  assert.equal(search.when, '그 앞 28일 5번');
  assert.ok(search.more.some(m => m[1] === '많이 보인 쪽' && m[2] === '홈 317'));
  assert.equal(ai.val, '0번 나옴', 'the headline is Claude with web search only');
  assert.equal(ai.mid, '일반 질문 24개 가운데 Claude 0 · Gemini(기억) 1');
  assert.equal(ai.when, '지난 회차 0번');
  assert.ok(ai.more.some(m => m[1] === 'Gemini' && /검색 없이 기억으로 답한 값/.test(m[2])));
  assert.equal(rowSpeech(from), '어디서 왔나, 12번, SNS 6 · 검색 3 · 직접 2 · AI 답변 1 · 다른 사이트 0, 그 앞 7일 9번');
  assert.equal(v.stale, false);
});

test('no screen word says GEO or SEO, and the counting limits are said', () => {
  const v = siteVisitsView(ok(summary()), NOW);
  const all = texts(v).join('\n');
  assert.doesNotMatch(all, /GEO|SEO/);
  for (const word of ['4초 안에 떠난 방문', '개인정보 신호(GPC)', '아직 세지 않는 쪽', '「직접」에는', '처음 가려질 때', '공식 API로 물은 값', '실제로 접수된 문의의 수']) assert.ok(all.includes(word), word);
});

test('ratios appear only with enough visits', () => {
  const s = summary();
  s.방문.사람 = 40; s.행동.문의비율 = 0.025; s.행동.앱받기비율 = 0.05;
  assert.equal(siteVisitsView(ok(s), NOW).rows[2].when, '사람 방문의 8%');
});

test('rows not measured yet are kept, with 측정 전 and the reason in the middle', () => {
  const s = summary({
    방문: { 상태: '측정 전', 까닭: '사이트 전체 방문 기록을 아직 켜지 않았습니다.' },
    쪽: { 상태: '측정 전', 까닭: '사이트 전체 방문 기록을 아직 켜지 않았습니다.' },
    행동: { 상태: '측정 전', 까닭: '사이트 전체 방문 기록을 아직 켜지 않았습니다.' },
    목적: { 상태: '권한 기다림', 까닭: '홈 방문 목적 시트를 읽을 권한을 기다립니다.' },
    AI: { 상태: '측정 전', 까닭: '첫 회차를 아직 재지 않았습니다.', AI방문: null },
  });
  const v = siteVisitsView(ok(s), NOW);
  assert.equal(v.say, '사이트 방문은 아직 세기 전입니다.');
  assert.equal(v.then, '구글 검색에는 최근 28일 동안 1,140번 보였고 8번 눌렸습니다.');
  assert.deepEqual(v.rows.map(r => r.val), ['측정 전', '측정 전', '측정 전', '8번 눌림', '측정 전']);
  assert.deepEqual(v.rows.map(r => !!r.unread), [true, true, true, false, true]);
  assert.equal(v.rows[0].mid, '사이트 전체 방문 기록을 아직 켜지 않았습니다.');
  assert.equal(v.rows[3].now, 1);
  const wait = siteVisitsView(ok(summary({ ...s, 검색: { 구글: { 상태: '권한 기다림', 까닭: '구글 서치콘솔을 읽을 권한을 기다립니다.' }, 네이버: { 상태: '등록 전', 까닭: 'x' } } })), NOW);
  assert.equal(wait.rows[3].val, '측정 전', 'waiting for permission is not a failure');
  assert.equal(wait.rows[3].mid, '구글 서치콘솔을 읽을 권한을 기다립니다.');
  assert.equal(wait.then, '아래 줄마다 까닭을 적었습니다.');
  const broken = siteVisitsView(ok(summary({ ...s, 검색: { 구글: { 상태: '못 읽음', 까닭: '서치콘솔이 500을 돌려주었습니다.' }, 네이버: { 상태: '등록 전', 까닭: 'x' } } })), NOW);
  assert.equal(broken.rows[3].val, '못 읽음');
  const full = summary();
  const aiOnly = siteVisitsView(ok(summary({ ...s, 검색: { 구글: { 상태: '권한 기다림', 까닭: 'x' }, 네이버: { 상태: '등록 전', 까닭: 'x' } }, AI: full.AI })), NOW);
  assert.equal(aiOnly.then, '웹 검색을 켠 Claude에게 일반 질문 24개를 물었더니 SYNK를 말한 답은 0개였습니다.');
});

test('the first day after switching on says it is collecting', () => {
  const s = summary();
  s.방문 = { ...s.방문, 켠날: '2026-11-24', 사람: 0, 마지막기록: null };
  const v = siteVisitsView(ok(s), NOW);
  assert.equal(v.say, '방문 기록을 11월 24일부터 모으기 시작했습니다.');
  assert.equal(v.then, '숫자는 하루가 지나면 이 자리에 보입니다.');
});

test('a spike, a stopped counter, and an old summary are said first', () => {
  const spike = summary();
  spike.방문 = { ...spike.방문, 급증: { 날: '2026-11-24', 줄: 502, 앞평균: 2.1 } };
  assert.match(siteVisitsView(ok(spike), NOW).say, /^11월 24일 방문 기록이 502줄로 평소\(하루 2\.1줄\)보다 크게 늘었습니다\.$/);
  const stopped = summary();
  stopped.방문 = { ...stopped.방문, 마지막기록: iso(NOW - 5 * 864e5) };
  assert.match(siteVisitsView(ok(stopped), NOW).say, /^방문 기록이 11월 19일 뒤로 끊겼습니다\.$/);
  const old = summary({ 만든때: iso(NOW - 3 * 864e5) });
  const v = siteVisitsView(ok(old), NOW);
  assert.equal(v.stale, true);
  assert.equal(v.say, '11월 21일 뒤로 숫자를 새로 모으지 못했습니다.');
  const zero = summary();
  zero.방문 = { ...zero.방문, 사람: 0 };
  assert.equal(siteVisitsView(ok(zero), NOW).say, '지난 7일 동안 사이트에 들어온 사람이 없습니다.');
});

// 11-17 Fable 설계 검토 P2-6: 덜 찬 요약에서 모델이 예외를 던지고, 판이 어긋날 때의 문장이 사실과 달랐던 것
test('a half-filled summary never throws: only the broken row says it could not read', () => {
  const s = summary();
  s.방문 = { 상태: '됨' }; s.쪽 = { 상태: '됨', 쪽들: 'x' }; s.행동 = { 상태: '됨' }; s.AI = { 상태: '됨', 서비스: [{}] };
  const v = siteVisitsView(ok(s), NOW);
  assert.equal(v.rows.length, 5);
  for (const r of v.rows) assert.equal(typeof r.val, 'string');
  assert.ok(v.rows.some(r => r.val === '못 읽음'));
  assert.equal(typeof v.say, 'string');
});

test('a version mismatch says which side needs updating', () => {
  const newer = siteVisitsView({ ok: false, available: true, code: 'VERSION', version: 2, supported: 1 }, NOW);
  assert.equal(newer.then, '모으기 도구가 새 꼴로 썼습니다. 앱을 업데이트하면 보입니다.');
  const older = siteVisitsView({ ok: false, available: true, code: 'VERSION', version: 0, supported: 1 }, NOW);
  assert.match(older.then, /옛 꼴/);
  const broken = siteVisitsView({ ok: false, available: true, code: 'SHAPE' }, NOW);
  assert.equal(broken.say, '모은 숫자를 읽지 못했습니다.');
  assert.deepEqual(broken.rows, []);
});

// 11-17 Fable 설계 검토 P2-5: 요약에서 온 글은 글자로만 — 모델은 HTML을 만들지 않고, 보이지 않는 글자와 긴 글을 걸러 둔다
test('words from the summary stay plain text: no markup is built, control characters and long words are trimmed', () => {
  const s = summary();
  s.검색.구글.검색어 = [{ 말: '<img src=x onerror=alert(1)>\u0007' + 'x'.repeat(200), 노출: 3, 클릭: 0 }];
  const v = siteVisitsView(ok(s), NOW);
  const row = v.rows[3].more.find(m => m[1] === '많이 보인 검색어');
  assert.ok(row[2].startsWith('<img src=x onerror=alert(1)>'), 'kept as plain characters for textContent');
  assert.ok(!row[2].includes('\u0007'));
  assert.ok(row[2].length < 60);
  for (const t of texts(v)) assert.doesNotMatch(t, /&lt;|&gt;/, 'the model does not escape; the screen sets textContent');
});

test('a service stopped mid-round is said in one plain sentence', () => {
  const s = summary();
  s.AI = { ...s.AI, 멈춤: { Gemini: 'HTTP 429' } };
  const note = siteVisitsView(ok(s), NOW).rows[4].more.find(m => m[0] === 'note');
  assert.ok(note[1].includes('Gemini는 이번 회차 중간에 막혀 일부 질문만 물었습니다.'));
  assert.equal(monthDay('2026-11-16T00:00:00'), '11월 16일');
});

// 11-17 Fable 설계 검토 P1-2: 이 PC에서 로그인한 다른 계정에도 보이던 것 — viewers.json의 계정에게만
test('the reader shows the summary only to an account listed in viewers.json, and notes who asked when none is listed', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'site-visits-'));
  const file = path.join(dir, 'summary.json');
  const yuho = { synk_user_id: 'owner-1234567890', display_name: '유호' };
  const other = { synk_user_id: 'tester-1234567890', display_name: '시험 계정' };
  const reader = createSiteVisits({ file, now: () => new Date(NOW) });
  assert.deepEqual(reader.snapshot(yuho), { ok: true, available: false }, 'no summary file');
  fs.writeFileSync(file, JSON.stringify(summary()));
  assert.deepEqual(reader.snapshot(null), { ok: true, available: false }, 'not signed in');
  assert.deepEqual(reader.snapshot(yuho), { ok: true, available: false }, 'no viewers file: nobody sees it');
  const pending = JSON.parse(fs.readFileSync(path.join(dir, 'viewer-pending.json'), 'utf8'));
  assert.deepEqual(pending, { synk_user_id: 'owner-1234567890', display_name: '유호', asked_at: iso(NOW) });
  fs.writeFileSync(path.join(dir, 'viewers.json'), JSON.stringify({ synk_user_ids: [yuho.synk_user_id] }));
  assert.deepEqual(reader.snapshot(other), { ok: true, available: false }, 'another account on the same PC');
  const good = reader.snapshot(yuho);
  assert.equal(good.ok, true);
  assert.equal(good.summary.방문.사람, 12);
  assert.equal(reader.snapshot(yuho), good, 'same mtime and size reads from the cache');
  fs.writeFileSync(path.join(dir, 'viewers.json'), '{ broken');
  assert.deepEqual(reader.snapshot(yuho), { ok: true, available: false }, 'a broken viewers file shows nothing');
});

test('the reader: a broken file, another version, a too large file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'site-visits-'));
  const file = path.join(dir, 'summary.json');
  const yuho = { synk_user_id: 'owner-1234567890', display_name: '유호' };
  fs.writeFileSync(path.join(dir, 'viewers.json'), JSON.stringify({ synk_user_ids: [yuho.synk_user_id] }));
  const reader = createSiteVisits({ file });
  fs.writeFileSync(file, '{ broken');
  assert.deepEqual(reader.snapshot(yuho), { ok: false, available: true, code: 'UNREADABLE' });
  fs.writeFileSync(file, JSON.stringify({ ...summary(), 판: 2 }));
  assert.deepEqual(reader.snapshot(yuho), { ok: false, available: true, code: 'VERSION', version: 2, supported: 1 });
  fs.writeFileSync(file, JSON.stringify({ ...summary(), 행동: null }));
  assert.deepEqual(reader.snapshot(yuho), { ok: false, available: true, code: 'SHAPE' });
  fs.writeFileSync(file, 'x'.repeat(600 * 1024));
  assert.deepEqual(reader.snapshot(yuho), { ok: false, available: true, code: 'TOO_LARGE' });
  fs.rmSync(file);
  assert.deepEqual(reader.snapshot(yuho), { ok: true, available: false });
  assert.equal(shapeProblem(summary()), null);
});

test('the default place is LOCALAPPDATA on Windows only', () => {
  assert.equal(defaultFile({ LOCALAPPDATA: 'C:\\Users\\a\\AppData\\Local' }, 'win32'), path.join('C:\\Users\\a\\AppData\\Local', 'synk', 'site-visits', 'summary.json'));
  assert.equal(defaultFile({}, 'darwin'), null);
  assert.equal(defaultFile({ SYNK_SITE_VISITS_SUMMARY: '/tmp/x.json' }, 'darwin'), '/tmp/x.json');
  assert.equal(createSiteVisits({ file: null }).snapshot({ synk_user_id: 'owner-1234567890' }).available, false);
});
