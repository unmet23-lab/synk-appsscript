'use strict';

// X 실시간 반응(tools/수요스캔/엑스.js)과 그록 통로(tools/lib/그록호출.js) — 그록을 부르지 않고 본다. 글 번호 · 숫자는 모두 합성이다.
const test = require('node:test');
const assert = require('node:assert/strict');
const 엑스 = require('../tools/수요스캔/엑스.js');
const 그록 = require('../tools/lib/그록호출.js');

const X시작 = 1288834974657n;
const 번호 = iso => ((BigInt(Date.parse(iso)) - X시작) << 22n).toString();
const 지금 = Date.parse('2026-11-07T12:00:00Z');

test('글 번호에 박힌 시각을 읽는다 · 꼴이 아니면 null', () => {
  assert.equal(new Date(엑스.번호시각(번호('2026-11-06T10:00:00Z'))).toISOString(), '2026-11-06T10:00:00.000Z');
  assert.equal(엑스.번호시각('123'), null);
  assert.equal(엑스.번호시각('abc'), null);
});

test('거르기: 주소 꼴 · 창 밖 · 미래 · 겹침을 버리고 작성자 아이디를 뺀 주소로 바꾼다', () => {
  const 안 = 번호('2026-11-06T10:00:00Z');
  const r = 엑스.거르기({
    글: [
      { 주소: `https://x.com/someone/status/${안}?s=20`, 올린때: '2026-11-06T10:05:00Z', 좋아요: 1200, 리포스트: 30, 답글: -1, 조회: 1.5, 형식: '영상', 요지: ' 줄\n바꿈 ' },
      { 주소: `https://twitter.com/other/status/${안}` },
      { 주소: 'https://x.com/i/status/123' },
      { 주소: 'https://example.com/a/status/2118644558853046272' },
      { 주소: `https://x.com/a/status/${번호('2026-10-01T00:00:00Z')}` },
      { 주소: `https://x.com/a/status/${번호('2026-11-09T00:00:00Z')}` },
    ],
    흐름: ['하나', '', '둘', '셋', '넷'],
  }, { 시간: 72, 개수: 8, 지금 });
  assert.equal(r.받음.length, 1);
  const g = r.받음[0];
  assert.equal(g.주소, `https://x.com/i/status/${안}`);
  assert.equal(g.올린때, '2026-11-06T10:00:00.000Z');
  assert.equal(g.날짜어긋남, false);
  assert.deepEqual([g.좋아요, g.리포스트, g.답글, g.조회], [1200, 30, null, null]);
  assert.equal(g.요지, '줄 바꿈');
  assert.deepEqual(r.버림.map(b => b.까닭.split('(')[0]), ['같은 글 두 번', '주소 꼴 아님', '주소 꼴 아님', '창 밖', '번호 시각이 미래 · 꼴 아님']);
  assert.deepEqual(r.흐름, ['하나', '둘', '셋']);
});

test('거르기: 그록이 적은 날짜가 번호 시각과 하루 반 넘게 다르면 표시한다 · 개수에서 멈춘다', () => {
  const 글 = Array.from({ length: 5 }, (_, k) => ({ 주소: `https://x.com/a/status/${번호(`2026-11-06T0${k}:00:00Z`)}`, 올린때: '2026-11-01T00:00:00Z' }));
  const r = 엑스.거르기({ 글 }, { 시간: 72, 개수: 3, 지금 });
  assert.equal(r.받음.length, 3);
  assert.ok(r.받음.every(g => g.날짜어긋남));
});

test('JSON꺼내기: 울타리 안 · 앞뒤 말이 붙은 답 · 깨진 답', () => {
  assert.deepEqual(엑스.JSON꺼내기('설명\n```json\n{"글":[]}\n```\n끝'), { 글: [] });
  assert.deepEqual(엑스.JSON꺼내기('앞 {"흐름":["a"]} 뒤'), { 흐름: ['a'] });
  assert.equal(엑스.JSON꺼내기('{"글":['), null);
});

test('고른어: 날짜마다 돌려 가며 열 개, 적으면 그대로', () => {
  const 어 = Array.from({ length: 25 }, (_, k) => `w${k}`);
  const a = 엑스.고른어(어, '2026-11-07'), b = 엑스.고른어(어, '2026-11-08');
  assert.equal(a.length, 10);
  assert.notDeepEqual(a, b);
  assert.deepEqual(엑스.고른어(['a', 'b'], '2026-11-07'), ['a', 'b']);
});

test('인자: 전부 · 고른 브랜드 · 모르는 인자', () => {
  assert.deepEqual(엑스.인자(['전부']).브랜드, ['lab-en', 'lab-mn', 'synkbrief', 'yuhobuilds']);
  assert.deepEqual(엑스.인자(['synkbrief', '--시간', '48']).브랜드, ['synkbrief']);
  assert.equal(엑스.인자(['--개수', '99']).개수, 20);
  assert.throws(() => 엑스.인자(['lab-xx']));
});

test('그록 통로: 파일 · 셸 · 고치기 · MCP 도구는 늘 막고, 웹 검색은 웹일 때만 연다', () => {
  const 막은 = a => a.flatMap((v, i) => (v === '--deny' ? [a[i + 1]] : []));
  const 기본 = 그록.인자목록({ 프롬프트파일: 'p.md', 작업폴더: 'w', 웹: false, 턴: 8 });
  for (const t of ['Bash', 'Read', 'Edit', 'Write', 'Grep', 'Glob', 'MCPTool', 'WebFetch', 'WebSearch']) assert.ok(막은(기본).includes(t), t);
  assert.ok(기본.includes('--no-auto-update'));
  assert.ok(기본.includes('--no-subagents') && 기본.includes('--disable-web-search'), '하위 에이전트는 늘, 웹은 안 쓸 때 끈다');
  const 꼴 = 그록.인자목록({ 프롬프트파일: 'p.md', 작업폴더: 'w', 웹: false, 턴: 4, 스키마: { type: 'object' } });
  assert.equal(꼴[꼴.indexOf('--json-schema') + 1], '{"type":"object"}');
  assert.equal(기본[기본.indexOf('--permission-mode') + 1], 'dontAsk');
  const 웹 = 그록.인자목록({ 프롬프트파일: 'p.md', 작업폴더: 'w', 웹: true, 턴: 8, 모델: 'm', 노력: 'high' });
  assert.ok(!막은(웹).includes('WebSearch') && !웹.includes('--disable-web-search'));
  assert.ok(막은(웹).includes('Read'));
  assert.equal(웹[웹.indexOf('--model') + 1], 'm');
});

test('그록 통로: 답읽기는 text가 있는 JSON만', () => {
  assert.deepEqual(그록.답읽기('로그\n{"text":"답","stopReason":"end","sessionId":"s","total_cost_usd":0.12,"num_turns":3}'), { 글: '답', 구조답: null, 멈춘까닭: 'end', 세션: 's', 쓴양: null, 비용USD: 0.12, 턴수: 3 });
  assert.deepEqual(그록.답읽기('{"text":"{}","structuredOutput":{"findings":[]}}').구조답, { findings: [] }, '꼴을 강제하면 structuredOutput을 받는다');
  assert.equal(그록.답읽기('{"result":"x"}'), null);
  assert.equal(그록.답읽기(''), null);
});
