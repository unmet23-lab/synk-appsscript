// 솔리오 「방문자 분석」(2026-11-17): 요약 파일 읽기(site-visits.cjs)와 화면 글(site-visits-model.mjs). 요약은 합성이다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { siteVisitsView, lineSpeech, SITE_VISITS_NAME, monthDay } from '../renderer/site-visits-model.mjs';

const require = createRequire(import.meta.url);
const { createSiteVisits, defaultFile, shapeProblem } = require('../src/site-visits.cjs');

const NOW = new Date(2026, 10, 17, 12, 0).getTime();
const iso = t => new Date(t).toISOString();
const summary = (patch = {}) => ({
  판: 1, 만든때: iso(NOW - 3600e3), 기간날수: 7, 세는쪽: ['/'],
  방문: { 상태: '됨', 까닭: null, 받은때: iso(NOW), 마지막기록: iso(NOW - 2 * 3600e3), 사람: 12, 앞사람: 9, 본쪽: 20,
    갈래: [{ 이름: '검색', 수: 3 }, { 이름: 'SNS', 수: 6 }, { 이름: 'AI 답변', 수: 1 }, { 이름: '직접', 수: 2 }, { 이름: '다른 사이트', 수: 0 }],
    들어온곳: [{ 이름: '인스타그램', 수: 6 }, { 이름: '구글', 수: 3 }], 첫쪽: [{ 쪽: '/', 이름: '홈', 수: 8 }], 날마다: [1, 2, 0, 3, 2, 2, 2].map((수, i) => ({ 날: `2026-11-${11 + i}`, 수 })), AI방문: 1 },
  쪽: { 상태: '됨', 까닭: null, 쪽들: [{ 쪽: '/', 이름: '홈', 본수: 14, 떠남수: 9, 머문시간: '30초~1분', 끝까지: 0.333, 떠남비율: 0.5 }, { 쪽: '/pulse/', 이름: 'PULSE', 본수: 4, 떠남수: 2, 머문시간: null, 끝까지: null, 떠남비율: null }] },
  행동: { 상태: '됨', 까닭: null, 문의: { 합: 1, 나눔: [{ 이름: '문의 메일', 수: 1 }, { 이름: '문의 양식', 수: 0 }] }, 앱받기: { 합: 2, 나눔: [{ 이름: '앱 받기(Windows)', 수: 2 }, { 이름: '앱 받기(Mac)', 수: 0 }] }, 문의비율: 0.083, 앱받기비율: 0.167, 처음들어온곳별: [{ 갈래: 'SNS', 문의: 1, 앱받기: 2 }] },
  목적: { 상태: '됨', 까닭: null, 방문: 5, 고른방문: 2, 고른칸: [{ 이름: 'PULSE · 광고·영상', 수: 2 }] },
  검색: { 구글: { 상태: '됨', 까닭: null, 시작: '2026-10-18', 끝: '2026-11-14', 노출: 1140, 클릭: 8, 평균순위: 9.5, 앞: { 노출: 900, 클릭: 5, 평균순위: 11 }, 검색어: [{ 말: 'synk', 노출: 681, 클릭: 2 }], 쪽: [{ 쪽: '/en/', 노출: 697, 클릭: 0 }] },
    네이버: { 상태: '등록 전', 까닭: '네이버 서치어드바이저에 아직 등록하지 않았습니다.' } },
  AI: { 상태: '됨', 까닭: null, 회차날: '2026-11-17', 서비스: [
    { 이름: 'Claude', 설명: '웹 검색을 켠 답', 일반질문: 24, 답받음: 24, 언급: 0, 인용: 0, 브랜드질문: 6, 브랜드답받음: 6, 브랜드인용: 5 },
    { 이름: 'Gemini', 설명: '검색 없이 기억으로 답한 값', 일반질문: 24, 답받음: 22, 언급: 1, 인용: 0, 브랜드질문: 6, 브랜드답받음: 6, 브랜드인용: 1 }],
    앞회차: { 날: '2026-11-10', 서비스: [{ 이름: 'Claude', 언급: 0 }] }, 멈춤: {}, AI방문: 1 },
  ...patch,
});
const ok = s => ({ ok: true, available: true, summary: s });

test('the program name is the word Yuho used', () => {
  assert.equal(SITE_VISITS_NAME, '방문자 분석');
});

test('no summary file means the program is not shown at all', () => {
  assert.deepEqual(siteVisitsView({ ok: true, available: false }, NOW), { visible: false });
  assert.deepEqual(siteVisitsView(null, NOW), { visible: false });
});

test('an unreadable summary is said plainly, without numbers', () => {
  const v = siteVisitsView({ ok: false, available: true, code: 'SHAPE' }, NOW);
  assert.equal(v.visible, true);
  assert.equal(v.lines.length, 0);
  assert.equal(v.problem, 'SHAPE');
  assert.match(v.conclusion, /읽지 못했습니다/);
});

test('the conclusion says visits and clicks of the last 7 days, and five lines follow in order', () => {
  const v = siteVisitsView(ok(summary()), NOW);
  assert.equal(v.conclusion, '지난 7일 동안 사람이 12번 들어왔고, 문의를 1번, 앱 받기를 2번 눌렀습니다.');
  assert.deepEqual(v.lines.map(l => l.key), ['from', 'pages', 'actions', 'search', 'ai']);
  const [from, pages, actions, search, ai] = v.lines;
  assert.equal(from.value, '사람 방문 12번');
  assert.equal(from.note, '지난주보다 3번 늘었습니다');
  assert.deepEqual(from.daily, [1, 2, 0, 3, 2, 2, 2]);
  assert.ok(from.detail.includes('들어온 곳 갈래: 검색 3 · SNS 6 · AI 답변 1 · 직접 2 · 다른 사이트 0'));
  assert.ok(from.detail.includes('홈에서 고른 사업: PULSE · 광고·영상 2'));
  assert.equal(pages.value, '홈 · PULSE');
  assert.equal(pages.detail[0], '홈: 14번 봄, 머문 시간은 대개 30초~1분, 끝까지 내린 비율 33%, 여기서 사이트를 떠난 비율 50%');
  assert.match(pages.detail[1], /떠난 기록이 적어 비율은 아직 셈하지 않습니다/);
  assert.equal(actions.value, '문의 1번 · 앱 받기 2번');
  assert.ok(actions.detail.includes('문의: 문의 메일 1'));
  assert.ok(actions.detail.includes('앱 받기: Windows 2'));
  assert.ok(actions.detail.includes('SNS로 들어온 방문에서 문의 1번, 앱 받기 2번'));
  assert.equal(search.value, '구글 노출 1,140번 · 클릭 8번');
  assert.equal(search.note, '그 앞 28일보다 3번 늘었습니다');
  assert.ok(search.detail.includes('네이버: 네이버 서치어드바이저에 아직 등록하지 않았습니다.'));
  assert.equal(ai.value, 'SYNK가 나온 답 Claude 0/24 · Gemini 1/22', 'web search and memory answers stay apart');
  assert.match(ai.detail[0], /^Claude\(웹 검색을 켠 답\): 일반 질문 24개 가운데 0개에서 SYNK를 말했고, synk\.im을 출처로 단 답은 0개입니다\. 지난 회차에는 0개였습니다\.$/);
  assert.ok(ai.detail.includes('SYNK를 직접 물은 질문에서 synk.im을 출처로 단 답: Claude 5/6, Gemini 1/6'));
  assert.ok(ai.detail.includes('지난 7일 AI 답변에서 온 사람 방문 1번'));
  assert.equal(lineSpeech(from), '어디서 왔나, 사람 방문 12번, 지난주보다 3번 늘었습니다');
  assert.equal(v.stale, false);
});

test('no screen word says GEO or SEO', () => {
  const v = siteVisitsView(ok(summary()), NOW);
  const all = [v.conclusion, ...v.lines.flatMap(l => [l.title, l.value, l.note, ...l.detail])].join('\n');
  assert.doesNotMatch(all, /GEO|SEO/);
});

test('sections that are not measured yet show their reason, and the conclusion falls back to search', () => {
  const s = summary({
    방문: { 상태: '측정 전', 까닭: '사이트 전체 방문 기록을 아직 켜지 않았습니다.' },
    쪽: { 상태: '측정 전', 까닭: '사이트 전체 방문 기록을 아직 켜지 않았습니다.' },
    행동: { 상태: '측정 전', 까닭: '사이트 전체 방문 기록을 아직 켜지 않았습니다.' },
    목적: { 상태: '권한 기다림', 까닭: '홈 방문 목적 시트를 읽을 권한을 기다립니다.' },
    AI: { 상태: '측정 전', 까닭: '첫 회차를 아직 재지 않았습니다.', AI방문: null },
  });
  const v = siteVisitsView(ok(s), NOW);
  assert.equal(v.conclusion, '사이트 방문은 아직 재기 전입니다. 구글 검색에는 최근 28일 동안 1,140번 보였고 8번 눌렸습니다.');
  assert.deepEqual(v.lines.map(l => l.state), ['before', 'before', 'before', 'ok', 'before']);
  assert.equal(v.lines[0].value, '측정 전');
  assert.equal(v.lines[0].note, '사이트 전체 방문 기록을 아직 켜지 않았습니다.');
  assert.equal(v.lines[4].note, '첫 회차를 아직 재지 않았습니다.');
  const none = siteVisitsView(ok(summary({ ...s, 검색: { 구글: { 상태: '권한 기다림', 까닭: '구글 서치콘솔을 읽을 권한을 기다립니다.' }, 네이버: { 상태: '등록 전', 까닭: 'x' } } })), NOW);
  assert.equal(none.conclusion, '아직 모은 숫자가 없습니다. 아래 줄마다 까닭을 적었습니다.');
  assert.equal(none.lines[3].state, 'before', 'waiting for permission is not a failure');
  assert.equal(none.lines[3].value, '권한 기다림');
  const broken = siteVisitsView(ok(summary({ ...s, 검색: { 구글: { 상태: '못 읽음', 까닭: '서치콘솔이 500을 돌려주었습니다.' }, 네이버: { 상태: '등록 전', 까닭: 'x' } } })), NOW);
  assert.equal(broken.lines[3].state, 'unread');
  // 방문과 검색이 없어도 AI 회차가 있으면 결론이 그 숫자를 말한다
  const full = summary();
  const aiOnly = siteVisitsView(ok(summary({ ...s, 검색: { 구글: { 상태: '권한 기다림', 까닭: 'x' }, 네이버: { 상태: '등록 전', 까닭: 'x' } }, AI: full.AI })), NOW);
  assert.equal(aiOnly.conclusion, '사이트 방문 숫자는 아직 없습니다. 웹 검색을 켠 Claude에게 일반 질문 24개를 물었더니 SYNK를 말한 답은 0개였습니다.');
});

test('a stopped visit counter is said first; an old summary is said before everything', () => {
  const stopped = summary();
  stopped.방문 = { ...stopped.방문, 마지막기록: iso(NOW - 5 * 864e5) };
  assert.match(siteVisitsView(ok(stopped), NOW).conclusion, /^방문 기록이 11월 12일 뒤로 끊겼습니다/);
  const old = summary({ 만든때: iso(NOW - 3 * 864e5) });
  const v = siteVisitsView(ok(old), NOW);
  assert.equal(v.stale, true);
  assert.match(v.conclusion, /^11월 14일 뒤로 숫자를 새로 모으지 못했습니다\. /);
  const zero = summary();
  zero.방문 = { ...zero.방문, 사람: 0 };
  assert.equal(siteVisitsView(ok(zero), NOW).conclusion, '지난 7일 동안 사이트에 들어온 사람이 없습니다.');
});

test('a service stopped mid-round is said in one plain sentence', () => {
  const s = summary();
  s.AI = { ...s.AI, 멈춤: { Gemini: 'HTTP 429' } };
  assert.ok(siteVisitsView(ok(s), NOW).lines[4].detail.includes('Gemini는 이번 회차 중간에 막혀 일부 질문만 물었습니다.'));
});

test('a carried-over value is marked stale on its line', () => {
  const s = summary();
  s.검색.구글 = { ...s.검색.구글, 낡음: true, 까닭: '오늘은 읽지 못해 11월 16일 값을 보입니다.' };
  const line = siteVisitsView(ok(s), NOW).lines[3];
  assert.equal(line.state, 'stale');
  assert.ok(line.detail.includes('오늘은 읽지 못해 11월 16일 값을 보입니다.'));
  assert.equal(monthDay('2026-11-16T00:00:00'), '11월 16일');
});

test('the reader: no file, a good file, a broken file, another version, a too large file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'site-visits-'));
  const file = path.join(dir, 'summary.json');
  const reader = createSiteVisits({ file });
  assert.deepEqual(reader.snapshot(), { ok: true, available: false });
  fs.writeFileSync(file, JSON.stringify(summary()));
  const good = reader.snapshot();
  assert.equal(good.ok, true);
  assert.equal(good.summary.방문.사람, 12);
  assert.equal(reader.snapshot(), good, 'same mtime and size reads from the cache');
  fs.writeFileSync(file, '{ broken');
  assert.deepEqual(reader.snapshot(), { ok: false, available: true, code: 'UNREADABLE' });
  fs.writeFileSync(file, JSON.stringify({ ...summary(), 판: 2 }));
  assert.deepEqual(reader.snapshot(), { ok: false, available: true, code: 'VERSION' });
  fs.writeFileSync(file, JSON.stringify({ ...summary(), 행동: null }));
  assert.deepEqual(reader.snapshot(), { ok: false, available: true, code: 'SHAPE' });
  fs.writeFileSync(file, 'x'.repeat(600 * 1024));
  assert.deepEqual(reader.snapshot(), { ok: false, available: true, code: 'TOO_LARGE' });
  fs.rmSync(file);
  assert.deepEqual(reader.snapshot(), { ok: true, available: false });
  assert.equal(shapeProblem(summary()), null);
});

test('the default place is LOCALAPPDATA on Windows only', () => {
  assert.equal(defaultFile({ LOCALAPPDATA: 'C:\\Users\\a\\AppData\\Local' }, 'win32'), path.join('C:\\Users\\a\\AppData\\Local', 'synk', 'site-visits', 'summary.json'));
  assert.equal(defaultFile({}, 'darwin'), null);
  assert.equal(defaultFile({ SYNK_SITE_VISITS_SUMMARY: '/tmp/x.json' }, 'darwin'), '/tmp/x.json');
  assert.equal(createSiteVisits({ file: null }).snapshot().available, false);
});
