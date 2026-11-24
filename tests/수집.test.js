'use strict';

// 수집 한 장(tools/수집/) — 목록 · 때 판정 · 공모 보고서 바꾸기 · 찾은 AI 합치기. AI를 부르지 않는다. 공고 · 주소는 모두 지어낸 값이다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const 돌 = require('../tools/수집/돌리기.js');
const 찾기 = require('../tools/수집/공모찾기.js');
const 상태 = require('../tools/수집/상태.js');
const 그록 = require('../tools/lib/grok-contests.cjs');

const 뿌리 = path.resolve(__dirname, '..');
const 종류들 = ['수집 예약', 'Windows 예약', 'Claude 예약', '그록봇'];

test('목록: 일마다 이름 · 누가 · 돌리는 곳 · 주기 · 결과 · 읽는 곳이 있고, 수집 예약은 있는 명령과 시각을 가진다', () => {
  const 목록 = 돌.목록읽기();
  const id들 = new Set();
  for (const 일 of 목록) {
    assert.ok(/^[^\s]+$/.test(일.id) && !id들.has(일.id), `id ${일.id}`);
    id들.add(일.id);
    for (const k of ['이름', '누가', '결과', '읽는곳']) assert.ok(String(일[k] || '').trim(), `${일.id}.${k}`);
    assert.ok(종류들.includes(일.돌리는곳?.종류), `${일.id} 돌리는곳`);
    if (일.돌리는곳.종류 === '수집 예약') {
      assert.ok(fs.existsSync(path.join(뿌리, 일.명령[0])), `${일.id} 명령 파일`);
      assert.ok(돌.오늘회차(일, Date.now()), `${일.id} 주기 시각`);
    } else assert.ok(일.돌리는곳.이름 && 일.주기?.글, `${일.id} 예약 이름 · 주기 글`);
  }
  for (const id of ['공모-opus', '공모-sol', '공모-gemini', '공모-그록']) assert.ok(id들.has(id), `공모전 찾기 넷: ${id}`);
});

const 일 = { id: 't', 이름: '시험', 돌리는곳: { 종류: '수집 예약' }, 주기: { 매일: '08:30' }, 명령: ['x.js'] };
const 때 = (s) => Date.parse(`2026-11-25T${s}:00+09:00`);
const 줄 = (회차, 결과, 시작) => ({ id: 't', 회차, 결과, 시작: new Date(시작).toISOString(), 끝: new Date(시작 + 60e3).toISOString() });

test('때인가: 시각 전 · 첫 회차 · 받은 뒤 · 실패 다시 · 두 번 실패 · 못 부름 · 많이 늦음', () => {
  assert.equal(돌.때인가(일, [], 때('08:00')).돌림, false);
  const 첫 = 돌.때인가(일, [], 때('08:31'));
  assert.equal(첫.돌림, true);
  assert.equal(첫.회차.열쇠, '2026-11-25 08:30');
  assert.equal(돌.때인가(일, [줄('2026-11-25 08:30', '받음', 때('08:31'))], 때('09:30')).돌림, false);
  const 실패 = [줄('2026-11-25 08:30', '실패', 때('08:31'))];
  assert.equal(돌.때인가(일, 실패, 때('08:45')).돌림, false, '실패 뒤 30분은 기다린다');
  assert.equal(돌.때인가(일, 실패, 때('09:10')).돌림, true, '30분 뒤 한 번 더');
  assert.equal(돌.때인가(일, [...실패, 줄('2026-11-25 08:30', '실패', 때('09:10'))], 때('10:00')).돌림, false, '두 번 실패면 다음 회차');
  assert.equal(돌.때인가(일, [줄('2026-11-25 08:30', '못 부름', 때('08:31'))], 때('10:00')).돌림, false, '한도 · 로그인은 다음 회차');
  assert.equal(돌.때인가(일, [], 때('21:00')).돌림, false, '12시간 넘게 늦으면 건너뛴다');
  assert.equal(돌.때인가({ ...일, 켜짐: false }, [], 때('08:31')).돌림, false);
  assert.equal(돌.때인가({ ...일, 돌리는곳: { 종류: '그록봇' } }, [], 때('08:31')).돌림, false);
});

test('때인가: 간격일 2는 마지막 받은 회차가 이틀(− 6시간) 지나야 돈다', () => {
  const 이틀 = { ...일, 주기: { 간격일: 2, 시각: '08:30' } };
  const 어제 = Date.parse('2026-11-24T08:31:00+09:00');
  const 그제 = Date.parse('2026-11-23T08:31:00+09:00');
  assert.equal(돌.때인가(이틀, [{ ...줄('2026-11-24 08:30', '받음', 어제) }], 때('08:31')).돌림, false);
  assert.equal(돌.때인가(이틀, [{ ...줄('2026-11-23 08:30', '받음', 그제) }], 때('08:31')).돌림, true);
});

test('알릴까: 두 번째 실패와 로그인 · 설치 막힘만, 한도는 알리지 않는다', () => {
  assert.equal(돌.알릴까({ 결과: '실패' }, 1), false);
  assert.equal(돌.알릴까({ 결과: '실패' }, 2), true);
  assert.equal(돌.알릴까({ 결과: '꼴 아님' }, 2), true);
  assert.equal(돌.알릴까({ 결과: '못 부름', 요약: { 막힘: '한도' } }, 1), false);
  assert.equal(돌.알릴까({ 결과: '못 부름', 요약: { 막힘: '로그인' } }, 1), true);
  assert.match(돌.알림문({ 이름: '공모전 찾기 · Sol' }, { 회차: '2026-11-25 14:30', 결과: '못 부름', 요약: { 막힘: '로그인', 까닭: 'login required' } }), /공모전 찾기 · Sol 2026-11-25 14:30 회차: 못 부름\(로그인\)/);
});

test('공모찾기: 답에서 JSON을 꺼내 그록 보고서 꼴로 바꾸고, 제목이나 주소가 없는 줄은 버린다', () => {
  const 답 = '찾았어요.\n```json\n' + JSON.stringify({
    reports: ['콘테스트코리아 영상 분야'],
    unavailable: ['어느 게시판 — 403'],
    items: [
      { title: '  제1회 시험 AI 영상 공모전 ', organizer: '시험재단', video: true, discoveryUrl: 'https://www.contestkorea.com/x?id=1', officialUrl: 'https://example.org/notice/1',
        ai: { status: 'allowed', url: 'https://example.org/notice/1', quote: '생성형 AI 활용 가능' },
        deadline: { date: '2026-12-10', kst: '2026-12-10T18:00+09:00', url: 'https://example.org/notice/1', quote: '12월 10일 18시까지' },
        deliverables: { items: ['영상 파일', '기획서'], url: 'https://example.org/notice/1', quote: '영상과 기획서 제출' }, rights: '' },
      { title: '', officialUrl: 'https://example.org/2' },
      { title: '주소 없는 공고' },
      { title: '시각이 날짜와 다른 공고', officialUrl: 'https://example.org/3', ai: { status: 'maybe' }, deadline: { date: '2026-12-01', kst: '2026-12-02T10:00+09:00' } },
    ],
  }) + '\n```';
  const j = 찾기.JSON꺼내기(답);
  const r = 찾기.보고서로(j, 'opus', Date.parse('2026-11-25T08:41:00+09:00'));
  assert.equal(r.보고서.schema, 'synk-grok-contests-v1');
  assert.equal(r.보고서.reportId, '2026-11-25_0841-opus');
  assert.equal(r.보고서.finder, 'opus');
  assert.deepEqual(r.보고서.reports, ['콘테스트코리아 영상 분야']);
  assert.equal(r.버림, 2);
  assert.equal(r.못연곳.length, 1);
  assert.equal(r.보고서.items[0].title, '제1회 시험 AI 영상 공모전');
  assert.equal(r.보고서.items[0].deadline.kst, '2026-12-10T18:00+09:00');
  assert.equal(r.보고서.items[1].ai.status, 'unconfirmed', '모르는 판정은 확인 필요');
  assert.equal(r.보고서.items[1].deadline.kst, '', '날짜와 다른 시각은 버린다');
  assert.equal(r.보고서.items[1].discoveryUrl, 'https://example.org/3', '찾은 주소가 없으면 공식 주소');
  assert.equal(찾기.JSON꺼내기('답 없음'), null);
  assert.equal(찾기.보고서로({ items: 'x' }, 'sol'), null);
  assert.equal(그록.회차시각(r.보고서), Date.parse('2026-11-25T08:41+09:00'), '회차 시각이 AI 꼬리를 달아도 읽힌다');
});

test('공모찾기: 요청문에 오늘 날짜와 이미 아는 공고를 붙인다', () => {
  const p = 찾기.프롬프트(['시험 공모전 하나', '시험 공모전 둘'], Date.parse('2026-11-25T08:30:00+09:00'));
  assert.match(p, /# SYNK 공모전 찾기/);
  assert.match(p, /오늘은 한국 시각 2026-11-25 08:30이다/);
  assert.match(p, /## 이미 아는 공고\n\n- 시험 공모전 하나\n- 시험 공모전 둘/);
  assert.match(찾기.프롬프트([], 0), /- \(없음\)/);
  assert.throws(() => 찾기.인자(['claude']));
  assert.equal(찾기.인자(['gemini', '--시간분', '10']).시간분, 10);
});

test('합치기: 같은 공고를 여러 AI가 찾으면 찾은 곳을 모으고, finder가 없는 옛 보고서는 그록이다', () => {
  const 행 = (t, url) => ({ title: t, organizer: '시험재단', edition: '', noticeId: '', video: true, discoveryUrl: url, officialUrl: url,
    ai: { status: 'allowed' }, deadline: { date: '2026-12-10', kst: '' }, deliverables: { items: [] } });
  const 보고 = [
    { schema: 'synk-grok-contests-v1', reportId: '2026-11-24_0830', reports: ['x'], importedAt: '2026-11-24T00:00:00Z', items: [행('제1회 시험 영상 공모전', 'https://example.org/a')] },
    { schema: 'synk-grok-contests-v1', reportId: '2026-11-25_0841-opus', finder: 'opus', reports: ['x'], importedAt: '2026-11-25T00:00:00Z', items: [행('제1회 시험 영상 공모전', 'https://example.org/a'), 행('다른 시험 공모', 'https://example.org/b')] },
    { schema: 'synk-grok-contests-v1', reportId: '2026-11-25_2005-gemini', finder: 'gemini', reports: ['x'], importedAt: '2026-11-25T12:00:00Z', items: [행('다른 시험 공모', 'https://example.org/b')] },
  ];
  const 합 = 그록.합치기({ items: [] }, 보고);
  const a = 합.items.find((o) => o.title === '제1회 시험 영상 공모전');
  const b = 합.items.find((o) => o.title === '다른 시험 공모');
  assert.deepEqual(a.grok_contest.foundBy, ['grok', 'opus']);
  assert.deepEqual(b.grok_contest.foundBy, ['opus', 'gemini']);
  assert.equal(그록.찾은곳('Opus'), '', '소문자 영문만');
  assert.equal(그록.찾은곳('mail'), 'mail');
});

test('관문 한 장의 수집 표는 목록에서 만든 것과 같다(손으로 고치면 걸린다)', () => {
  const 문서 = fs.readFileSync(path.join(뿌리, 'docs', '_ops', '관문_자동화.md'), 'utf8').replace(/\r\n/g, '\n');
  const i = 문서.indexOf(상태.표시작), j = 문서.indexOf(상태.표끝);
  assert.ok(i >= 0 && j > i, '관문 문서에 수집목록 표 자리가 있다');
  assert.equal(문서.slice(i + 상태.표시작.length, j).trim(), 상태.관문표(돌.목록읽기()).trim(), '`node tools/수집/상태.js --표 --쓰기`로 다시 만든다');
});
