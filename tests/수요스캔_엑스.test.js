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
  assert.deepEqual(엑스.인자(['전부']).브랜드, ['lab-en', 'synkbrief', 'yuhobuilds', 'pulse'], 'lab-mn은 설정의 엑스.전부에서뺌으로 빠진다(11-25)');
  assert.deepEqual(엑스.인자(['lab-mn']).브랜드, ['lab-mn'], '따로 부르면 돈다');
  assert.equal(엑스.인자(['전부', '--사이', '72']).사이, 72);
  assert.equal(엑스.인자([]).사이, null);
  assert.deepEqual(엑스.인자(['pulse']).브랜드, ['pulse']);
  assert.deepEqual(엑스.인자(['synkbrief', '--시간', '48']).브랜드, ['synkbrief']);
  assert.equal(엑스.인자(['--개수', '99']).개수, 20);
  assert.throws(() => 엑스.인자(['lab-xx']));
});

test('설정: 브랜드마다 실제 설정을 읽고, 지켜볼 계정 · 우리 계정은 있는 곳에만 있다(11-24 그록봇 X 루틴 둘을 옮김)', () => {
  for (const b of 엑스.브랜드들) {
    const s = 엑스.설정(b);
    assert.ok(s.이름 && Array.isArray(s.어) && s.어.length, b);
  }
  const p = 엑스.설정('pulse');
  assert.equal(p.우리, 'synk_pulse');
  assert.equal(p.계정.length, 6);
  const l = 엑스.설정('lab-en');
  assert.equal(l.우리, null);
  assert.equal(l.계정.length, 6);
  for (const b of ['lab-mn', 'synkbrief', 'yuhobuilds']) assert.deepEqual([엑스.설정(b).계정, 엑스.설정(b).우리], [[], null], b);
});

test('설정: 아이디 꼴이 아닌 계정은 버리고 @를 뗀다', () => {
  const os = require('node:os'), fs = require('node:fs'), path = require('node:path');
  const 파일 = path.join(fs.mkdtempSync(path.join(os.tmpdir(), '엑스설정-')), 's.json');
  fs.writeFileSync(파일, JSON.stringify({ 이름: '시험', 검색: { 어: ['a'] }, 엑스: { 우리계정: '@ours_1', 지켜볼계정: ['@good', { 아이디: 'bad name' }, { 아이디: 'x'.repeat(16) }, { 아이디: 'ok_2', 소개: '  한\n줄 ' }] } }));
  const s = 엑스.설정('시험', 파일);
  assert.equal(s.우리, 'ours_1');
  assert.deepEqual(s.계정, [{ 아이디: 'good', 소개: '' }, { 아이디: 'ok_2', 소개: '한 줄' }]);
});

test('프롬프트: 지켜볼 계정 · 우리 계정이 없는 브랜드는 예전 답 꼴 그대로, 있으면 칸을 더한다', () => {
  const o = { 시간: 72, 개수: 8 };
  const 맨 = 엑스.프롬프트('synkbrief', { 이름: 'n', 어: ['a'], 계정: [], 우리: null }, o, '2026-11-24');
  assert.ok(!맨.includes('계정글') && !맨.includes('우리반응') && !맨.includes('지켜볼 계정'));
  assert.ok(맨.includes('{"글":[{'));
  const 더 = 엑스.프롬프트('pulse', { 이름: 'n', 어: ['a'], 계정: [{ 아이디: 'comp', 소개: '경쟁' }], 우리: 'ours' }, o, '2026-11-24');
  assert.ok(더.includes('@comp(경쟁)') && 더.includes('- 우리 계정: @ours'));
  assert.ok(더.includes('4. 「지켜볼 계정」') && 더.includes('5. 같은 기간에 @ours를 부른 글'));
  const 꼴 = 더.slice(더.indexOf('```json') + 7, 더.lastIndexOf('```')).trim();
  assert.deepEqual(Object.keys(JSON.parse(꼴)), ['글', '계정글', '우리반응', '흐름', '못찾음'], '답 꼴 보기 자체가 JSON이다');
});

test('거르기: 계정글은 지켜볼 계정 것만, 우리반응은 우리 글을 빼고 일 문의를 앞에', () => {
  const 안 = k => 번호(`2026-11-06T1${k}:00:00Z`);
  const r = 엑스.거르기({
    글: [{ 주소: `https://x.com/comp/status/${안(0)}` }],
    계정글: [
      { 주소: `https://x.com/Comp/status/${안(0)}`, 좋아요: 10, 요지: '새 광고' },
      { 주소: `https://x.com/i/status/${안(1)}`, 계정: '@comp' },
      { 주소: `https://x.com/stranger/status/${안(2)}` },
      { 주소: `https://x.com/i/status/${안(3)}` },
    ],
    우리반응: [
      { 주소: `https://x.com/fan/status/${안(4)}`, 갈래: '칭찬', 요지: '멋져요' },
      { 주소: `https://x.com/OURS/status/${안(5)}`, 갈래: '질문' },
      { 주소: `https://x.com/brand/status/${안(6)}`, 갈래: '일 문의', 요지: '견적 문의' },
      { 주소: `https://x.com/who/status/${안(7)}`, 갈래: '모름' },
    ],
  }, { 시간: 72, 개수: 8, 지금, 계정: [{ 아이디: 'comp' }], 우리: 'ours' });
  assert.equal(r.받음.length, 1);
  assert.deepEqual(r.계정글.map(g => [g.계정, g.주소]), [['comp', `https://x.com/i/status/${안(0)}`], ['comp', `https://x.com/i/status/${안(1)}`]], '글 칸과 겹쳐도 계정글에는 따로 남는다');
  assert.equal(r.계정글[0].좋아요, 10);
  assert.deepEqual(r.우리반응.map(g => g.갈래), ['일 문의', '칭찬', '확인 필요']);
  assert.ok(r.우리반응.every(g => /^https:\/\/x\.com\/i\/status\/\d+$/.test(g.주소)));
  assert.deepEqual(r.버림.map(b => b.까닭), ['지켜볼 계정 밖', '지켜볼 계정 밖', '우리 계정이 쓴 글']);
  const 없음 = 엑스.거르기({ 계정글: [{ 주소: `https://x.com/comp/status/${안(0)}` }], 우리반응: [{ 주소: `https://x.com/a/status/${안(1)}` }] }, { 시간: 72, 개수: 8, 지금 });
  assert.deepEqual([없음.계정글, 없음.우리반응], [[], []], '설정에 없으면 칸을 읽지 않는다');
});

test('새표시: 앞 회차에 본 번호는 새가 아니고, 장부는 처음 본 날을 지킨다', () => {
  const 반응 = [{ 번호: '1' }, { 번호: '2' }];
  const 장부 = 엑스.새표시(반응, { 1: '2026-11-23' }, '2026-11-24');
  assert.deepEqual(반응.map(g => g.새), [false, true]);
  assert.deepEqual(장부, { 1: '2026-11-23', 2: '2026-11-24' });
  assert.deepEqual(엑스.새표시([{ 번호: '3' }], null, '2026-11-24'), { 3: '2026-11-24' });
});

test('마크다운: 지켜볼 계정 · 우리 계정 반응 절과 새 일 문의 수', () => {
  const r = {
    브랜드: 'pulse', 이름: 'P', 계정수: 2, 우리: 'ours', 받음: [], 버림: [], 흐름: [], 못찾음: '', 걸린ms: 1000, 비용USD: null,
    계정글: [{ 계정: 'comp', 올린때: '2026-11-24T01:00:00.000Z', 좋아요: 5, 리포스트: null, 조회: null, 형식: '영상', 요지: 'a|b', 가져갈점: 'c', 주소: 'https://x.com/i/status/9' }],
    우리반응: [{ 갈래: '일 문의', 새: true, 올린때: '2026-11-24T02:00:00.000Z', 요지: '견적', 주소: 'https://x.com/i/status/8' }, { 갈래: '일 문의', 새: false, 올린때: '2026-11-23T02:00:00.000Z', 요지: '전', 주소: 'https://x.com/i/status/7' }],
  };
  const md = 엑스.마크다운('2026-11-24', { 시간: 72 }, [r]);
  assert.ok(md.includes('### 지켜볼 계정의 새 글 (2곳)') && md.includes('| @comp |') && md.includes('a/b'));
  assert.ok(md.includes('**새 일 문의 1건**') && md.includes('앞 회차에 봄'));
  const 빈 = 엑스.마크다운('2026-11-24', { 시간: 72 }, [{ ...r, 계정글: [], 우리반응: [] }]);
  assert.ok(빈.includes('새 글 없음') && 빈.includes('반응 없음'));
  const 맨 = 엑스.마크다운('2026-11-24', { 시간: 72 }, [{ ...r, 계정수: 0, 우리: null }]);
  assert.ok(!맨.includes('지켜볼 계정') && !맨.includes('우리 계정 반응'));
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

test('사흘에 한 번: 마지막 실제 회차가 (사이 − 6)시간 안이면 이어 쓰고, 이어 쓴 우리반응은 새를 뗀다(11-25)', () => {
  const os = require('node:os'), fs = require('node:fs'), path = require('node:path');
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'x-cadence-'));
  const 쓰기 = (d, 기록, 결과) => {
    fs.mkdirSync(path.join(뿌리, d), { recursive: true });
    fs.writeFileSync(path.join(뿌리, d, '기록.jsonl'), 기록.map(j => JSON.stringify(j)).join('\n') + '\n');
    if (결과) fs.writeFileSync(path.join(뿌리, d, '엑스.json'), JSON.stringify({ 결과 }));
  };
  const 글 = { 올린때: '2026-11-22T09:00:00Z', 갈래: '일 문의', 요지: '견적 문의', 주소: 'x.com/i/status/9', 번호: '9', 새: true };
  const 본 = { 브랜드: 'pulse', 이름: 'P', 우리: 'synk_pulse', 받음: [], 계정글: [], 우리반응: [글], 버림: [], 흐름: [], 못잼: null };
  쓰기('2026-11-22', [{ 도구: '엑스', 브랜드: 'pulse', 때: '2026-11-22T10:50:00Z', 못잼: null }], [본]);
  쓰기('2026-11-23', [{ 도구: '엑스', 브랜드: 'pulse', 때: '2026-11-23T10:50:00Z', 이어씀: '2026-11-22' }], [{ ...본, 이어씀: '2026-11-22' }]);
  쓰기('2026-11-24', [{ 도구: '엑스', 브랜드: 'pulse', 때: '2026-11-24T10:50:00Z', 못잼: 'LIMIT — 한도' }], [{ 브랜드: 'pulse', 못잼: 'LIMIT' }]);
  fs.mkdirSync(path.join(뿌리, '메모')); // 날짜가 아닌 폴더는 건너뛴다
  const 지난 = 엑스.지난회차('pulse', 뿌리);
  assert.equal(지난.날짜, '2026-11-22', '이어 쓴 날과 못 잰 날은 실제 회차가 아니다');
  assert.equal(지난.때, Date.parse('2026-11-22T10:50:00Z'));
  assert.equal(엑스.지난회차('lab-en', 뿌리), null);
  assert.equal(엑스.이어쓸까(지난, 72, Date.parse('2026-11-24T11:00:00Z')), true, '이틀 뒤는 이어 쓴다');
  assert.equal(엑스.이어쓸까(지난, 72, Date.parse('2026-11-25T10:40:00Z')), false, '사흘째 19:30 회차가 조금 일찍 시작해도 부른다');
  assert.equal(엑스.이어쓸까(지난, null, Date.parse('2026-11-23T11:00:00Z')), false, '--사이가 없으면 늘 부른다');
  assert.equal(엑스.이어쓸까(null, 72), false, '앞 회차가 없으면 부른다');
  const r = 엑스.이어쓴결과(지난);
  assert.equal(r.이어씀, '2026-11-22');
  assert.equal(r.우리반응[0].새, false, '같은 일 문의를 두 번 알리지 않는다');
  assert.equal(지난.결과.우리반응[0].새, true, '원본은 그대로');
  const md = 엑스.마크다운('2026-11-24', { 시간: 72 }, [r]);
  assert.match(md, /그록을 부르지 않았다 — 2026-11-22 회차 결과/);
  assert.match(md, /새 일 문의 없음/);
});
