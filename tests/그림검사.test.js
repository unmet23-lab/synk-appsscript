'use strict';

// 그림 검사(tools/그림검사.js) — 그림을 굽자마자 다섯 실수(떠 있음 · 손 없는 움직임 · 실사 섞임 · 그림 속 글자 · 정본과 다름) + 나라 금기를 본다
// (11-10 LAB 하루 두 편 설계 15). 그리고 그림눈.GPT묻기(구독 Codex 통로) — 가짜 codex계정(SYNK_CODEX_ROTATE)만 부른다. AI · ffmpeg는 부르지 않는다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const 검사 = require('../tools/그림검사.js');
const 그림눈 = require('../tools/lib/그림눈.js');

const 임시 = (t, 이름) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 이름)); t.after(() => fs.rmSync(d, { recursive: true, force: true })); return d; };
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const 읽기 = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const 답칸 = (번호, 걸린 = {}, 금기 = false) => ({ 그림: 번호, 몽글있음: true, 다섯: Object.fromEntries(검사.다섯.map(([k]) => [k, { 걸림: !!걸린[k], 어디: 걸린[k] || '' }])), 금기: { 걸림: 금기, 어디: 금기 ? '접시 위 돼지고기' : '', 까닭: 금기 ? '이슬람권' : '' }, 의도한엉뚱함: '발이 커다란 그림', 한줄: '' });

test('인자: 장면 의도는 늘 준다(글자 그대로 그린 엉뚱함을 실수로 안 읽게) · 눈 gpt | haiku · 종류 그림 | 합성', () => {
  const o = 검사.인자(['a.png::발이 넓다를 글자 그대로', 'b.png', '--의도', 'LAB 관용구 퀴즈 그림', '--나라', 'id,my', '--금기', '돼지 · 술']);
  assert.deepEqual(o.그림, [{ 파일: 'a.png', 의도: '발이 넓다를 글자 그대로' }, { 파일: 'b.png', 의도: '' }]);
  assert.deepEqual(o.나라, ['id', 'my']);
  assert.deepEqual(o.금기, ['돼지 · 술']);
  assert.equal(o.눈, 'gpt');
  assert.equal(o.마스코트, '몽글', '정본 시트는 늘 붙인다');
  assert.throws(() => 검사.인자(['a.png']), /장면 의도/);
  assert.doesNotThrow(() => 검사.인자(['a.png::그림마다 의도']));
  assert.throws(() => 검사.인자(['a.png', '--의도', 'x', '--눈', 'fable']), /gpt · haiku/);
  assert.throws(() => 검사.인자(['--의도', 'x']), /그림이 없다/);
  assert.equal(검사.인자(['--받기', 'd']).받기, 'd');
});

test('질문: 다섯 칸 · 의도 · 정본 시트 · 나라 금기 목록 · 합성 시트 설명 · 답 꼴', () => {
  const 글 = 검사.질문({ 의도: '관용구 「간이 크다」를 글자 그대로', 마스코트: '몽글', 종류: '그림' }, { 그림의도: '간이 커다란 그림', 금기: ['id: 돼지고기 — 이슬람권'] });
  for (const [, 이름] of 검사.다섯) assert.ok(글.includes(이름), 이름);
  assert.match(글, /장면 의도: 관용구 「간이 크다」를 글자 그대로 \/ 간이 커다란 그림/);
  assert.match(글, /글자 그대로 그린 개그.*일부러다/);
  assert.match(글, /첫 그림은 몽글 정본 시트/);
  assert.match(글, /id: 돼지고기 — 이슬람권/);
  assert.match(글, /"다섯":\{"떠있음":\{"걸림":false/);
  const 합성 = 검사.질문({ 의도: 'x', 마스코트: '없음', 종류: '합성' }, { 여럿: true });
  assert.match(합성, /첫 · 가운데 · 끝 프레임/);
  assert.match(합성, /\{"그림들":\[/);
  assert.ok(!/첫 그림은 몽글 정본 시트/.test(합성));
  assert.match(합성, /목록이 없다/);
});

test('판정하기: 걸림이 하나라도 있으면 다시 굽기, 답 꼴이 아니면 답 없음', () => {
  assert.equal(검사.판정하기(답칸('01'), '01').판정, '통과');
  const 연필 = 검사.판정하기(답칸('01', { 손없는움직임: '오른쪽 위 칸 — 손 없이 종이에 닿은 연필' }), '01');
  assert.equal(연필.판정, '다시 굽기');
  assert.deepEqual(연필.걸림, ['손 없는 움직임: 오른쪽 위 칸 — 손 없이 종이에 닿은 연필']);
  assert.match(검사.판정하기(답칸('02', {}, true), '02').걸림[0], /나라 금기: 접시 위 돼지고기 — 이슬람권/);
  assert.equal(검사.판정하기(null, '03').판정, '답 없음');
  assert.equal(검사.판정하기({ 한줄: '모르겠다' }, '03').판정, '답 없음');
  assert.equal(검사.판정하기({ 다섯: { 글자: { 걸림: 'true', 어디: '간판' } } }, '04').판정, '다시 굽기', '문자열 true도 걸림');
  assert.equal(검사.끝코드([{ 판정: '통과' }, { 판정: '다시 굽기' }]), 1);
  assert.equal(검사.끝코드([{ 판정: '통과' }, { 판정: '답 없음' }]), 2);
});

test('나라금기: C 묶음 모듈(나라금기 · 나라) · 프로필 JSON 꼴 몇 가지를 읽고, 없으면 빈 목록', (t) => {
  const d = 임시(t, '나라금기-');
  assert.deepEqual(검사.나라금기(['id'], { 모듈: { 나라금기: (c) => (c === 'id' ? ['돼지고기', { 무엇: '술병', 까닭: '종교' }] : []) } }), ['id: 돼지고기', 'id: 술병 — 종교']);
  assert.deepEqual(검사.나라금기(['in'], { 모듈: { 나라: () => ({ 금기: { 음식: ['소고기'], 손짓: ['왼손으로 건넴'] } }) } }), ['in: 소고기', 'in: 왼손으로 건넴']);
  const 파일 = path.join(d, '나라프로필.json');
  fs.writeFileSync(파일, JSON.stringify({ 나라: [{ 코드: 'mm', 금기: ['머리를 쓰다듬는 손'] }] }));
  assert.deepEqual(검사.나라금기(['mm'], { 모듈: {}, 파일 }), ['mm: 머리를 쓰다듬는 손']);
  fs.writeFileSync(파일, JSON.stringify({ cn: { 금기: ['대만을 뺀 지도'] } }));
  assert.deepEqual(검사.나라금기(['cn'], { 모듈: {}, 파일 }), ['cn: 대만을 뺀 지도']);
  assert.deepEqual(검사.나라금기(['xx'], { 모듈: {}, 파일: path.join(d, '없음.json') }), []);
  // C 묶음 tools/lib/현지화프로필.js의 피할것(나라들) — 공통 + 나라마다 그림에 보이는 소품 · 장면(그림 지시문이 피하는 목록과 같다)
  const 피할것 = (cc) => ({ 소품: [{ ko: '국기', en: 'national flag', 나라: [] }, { ko: '돼지 · 돼지고기', en: 'pig', 나라: cc }], 장면: [{ ko: '개가 사람을 핥는 장면', 나라: cc }] });
  assert.deepEqual(검사.나라금기(['id'], { 모듈: { 피할것, 나라: () => ({ 금기: ['안 읽힘'] }) } }), ['공통: 소품 — 국기', 'id: 소품 — 돼지 · 돼지고기', 'id: 장면 — 개가 사람을 핥는 장면']);
  assert.deepEqual(검사.나라금기(['id'], { 모듈: { 나라: () => ({ 금기: [{ 갈래: '음식', 내용: '돼지 · 술', 근거: '할랄', 확실: '확실' }] }) } }), ['id: [음식] 돼지 · 술'], '금기 칸 꼴({갈래, 내용})은 한 줄로');
  assert.deepEqual(검사.나라금기([], { 모듈: { 피할것 } }), [], '나라를 안 주면 묻지 않는다');
  let 진짜 = {}; try { 진짜 = require('../tools/lib/현지화프로필.js'); } catch { /* C 묶음이 아직 안 올라온 작업본 */ }
  if (typeof 진짜.피할것 === 'function') assert.ok(검사.나라금기(['id']).some((t) => /^id: /i.test(t)), '실제 프로필 — 인도네시아 줄이 나온다');
});

test('흐름(가짜 GPT): 그림마다 정본 시트 + 그 그림 두 장을 한 번씩 묻고, 다시 굽기면 끝 코드 1 · 편 기록은 저장소 상대 경로만', async (t) => {
  const d = 임시(t, '그림검사흐름-');
  const 그림 = ['개그.png', '뜻.png'].map((n) => { const f = path.join(d, n); fs.writeFileSync(f, n); return f; });
  const 편 = path.join(d, 'LAB_퀴즈_20261113'); fs.mkdirSync(편);
  const 묻은 = [];
  const 손 = {
    정본시트: (밖) => { fs.writeFileSync(밖, 'ref'); return 밖; },
    나라금기: () => ['id: 돼지고기'],
    GPT묻기: async ({ 그림들, 글, 답파일 }) => {
      묻은.push({ 그림들: 그림들.map((f) => path.basename(f)), 글 });
      const 답 = JSON.stringify(그림들[1].endsWith('뜻.png') ? 답칸('01', { 떠있음: '그릇 탑 가운데 그릇이 떠 있다' }) : 답칸('01'));
      fs.writeFileSync(답파일, 답); return { 결과: '받음', 답, 초: 1 };
    },
  };
  t.mock.method(console, 'log', () => {});
  const 코드 = await 검사.main([`${그림[0]}::발이 넓다를 글자 그대로`, 그림[1], '--의도', 'LAB 관용구 퀴즈', '--나라', 'id', '--밖', path.join(d, '밖'), '--편', 편], 손);
  assert.equal(코드, 1);
  assert.deepEqual(묻은.map((x) => x.그림들), [['정본시트.jpg', '개그.png'], ['정본시트.jpg', '뜻.png']]);
  assert.match(묻은[0].글, /장면 의도: LAB 관용구 퀴즈 \/ 발이 넓다를 글자 그대로/);
  assert.match(묻은[0].글, /id: 돼지고기/);
  const 결과 = JSON.parse(fs.readFileSync(path.join(d, '밖', '그림검사.json'), 'utf8'));
  assert.deepEqual(결과.그림.map((g) => g.판정), ['통과', '다시 굽기']);
  assert.equal(결과.다시굽기, 1);
  const 편기록 = fs.readFileSync(path.join(편, '게시', '그림검사.json'), 'utf8');
  assert.ok(!편기록.includes(path.basename(d)), '공개 기록에 이 PC 임시 경로를 남기지 않는다');
  assert.match(편기록, /"파일": "뜻\.png"/);
});

test('흐름(haiku): 재료(질문.md + 그림 경로)만 만들고 끝 코드 4, 답을 받으면 판정', async (t) => {
  const d = 임시(t, '그림검사하이쿠-');
  const 그림 = ['a.png', 'b.png'].map((n) => { const f = path.join(d, n); fs.writeFileSync(f, n); return f; });
  const 밖 = path.join(d, '밖');
  t.mock.method(console, 'log', () => {});
  const 코드 = await 검사.main([...그림, '--의도', '펠트 카페 장면', '--눈', 'haiku', '--밖', 밖, '--마스코트', '없음'], { 나라금기: () => [] });
  assert.equal(코드, 4);
  const 질문 = fs.readFileSync(path.join(밖, '질문.md'), 'utf8');
  assert.match(질문, /Read 도구로 순서대로/);
  assert.ok(질문.includes(그림[0]) && 질문.includes(그림[1]));
  assert.ok(질문.includes(path.join(밖, '답_haiku.json')));
  fs.writeFileSync(path.join(밖, '답_haiku.json'), JSON.stringify({ 그림들: [답칸('01'), 답칸('02', { 실사섞임: '실사 생수병' })] }));
  assert.equal(검사.받기({ 받기: 밖 }), 1);
  const 결과 = JSON.parse(fs.readFileSync(path.join(밖, '그림검사.json'), 'utf8'));
  assert.equal(결과.눈, 'haiku');
  assert.deepEqual(결과.그림.map((g) => g.판정), ['통과', '다시 굽기']);
});

// ── 11-11 끝 판 검수 P2-11: 기록을 본 그림과 묶고(지문) · 빠진 칸은 통과가 아니고 · 다시 굽기를 그대로 쓰는 판단을 남기고 · 상태()로 읽는다 ──

test('판정하기(P2-11): 답이 빠진 칸이 있으면 「통과」가 아니라 「답 빠짐」 · 「예」 · 1도 걸림 · 금기 목록이 없으면 금기 칸은 안 센다', () => {
  const 빈 = 검사.판정하기({ 다섯: {} }, '01');
  assert.equal(빈.판정, '답 빠짐');
  assert.deepEqual(빈.빠진칸, [...검사.다섯.map(([, 이름]) => 이름), '나라 금기']);
  assert.equal(검사.판정하기({ 다섯: { 글자: { 걸림: false }, 정본다름: { 걸림: false } } }, '01').판정, '답 빠짐', '칸 둘만 온 답');
  assert.equal(검사.판정하기({ 다섯: { 떠있음: { 걸림: '예', 어디: '그릇' } } }, '01').판정, '다시 굽기');
  assert.equal(검사.판정하기({ 다섯: { 떠있음: { 걸림: 1 } } }, '01').판정, '다시 굽기');
  const 모름 = 답칸('01'); 모름.다섯.글자.걸림 = '모르겠다';
  assert.deepEqual([검사.판정하기(모름, '01').판정, 검사.판정하기(모름, '01').빠진칸], ['답 빠짐', ['그림 속 글자']], '알 수 없는 값도 안 걸림으로 안 읽는다');
  const 맨값 = 답칸('01'); 맨값.다섯.떠있음 = false;
  assert.equal(검사.판정하기(맨값, '01').판정, '통과', '칸을 true · false 값만으로 적어도 받는다');
  const 금기없음 = 답칸('01'); delete 금기없음.금기;
  assert.equal(검사.판정하기(금기없음, '01', { 금기있음: false }).판정, '통과', '금기 목록이 없으면(「false로 둔다」) 금기 칸이 빠져도 통과');
  assert.equal(검사.판정하기(금기없음, '01').판정, '답 빠짐', '금기 목록을 물었으면 금기 칸도 답해야 한다');
  const 섞 = 검사.판정하기({ 다섯: { 실사섞임: { 걸림: true, 어디: '생수병' } } }, '01', { 금기있음: false });
  assert.equal(섞.판정, '다시 굽기', '걸린 칸이 있으면 빠진 칸이 있어도 다시 굽기');
  assert.equal(섞.빠진칸.length, 4, '빠진 칸은 남긴다');
  assert.equal(검사.끝코드([{ 판정: '통과' }, { 판정: '답 빠짐' }]), 2, '답 빠짐은 다시 묻는다(2)');
  assert.equal(검사.끝코드([{ 판정: '다시 굽기', 판단: { 글: '화면 밖으로 나감', 때: 'x' } }]), 0, '판단을 단 다시 굽기는 그대로 쓴다');
  assert.equal(검사.끝코드([{ 판정: '다시 굽기', 판단: { 글: ' ' } }]), 1, '빈 판단은 판단이 아니다');
  assert.ok(검사.질문({ 의도: 'x', 마스코트: '몽글', 종류: '그림' }).includes('모두 「걸림」을 true · false로 꼭 적는다'));
});

/** 가짜 GPT — 그림 파일 이름마다 답(없으면 다 통과). '막힘'이면 답 없음. */
const 가짜눈 = (답들 = {}) => ({
  정본시트: (밖) => { fs.writeFileSync(밖, 'ref'); return 밖; },
  나라금기: () => [],
  GPT묻기: async ({ 그림들, 답파일 }) => {
    const 이름 = path.basename(그림들[그림들.length - 1]);
    const 답 = 답들[이름] ?? 답칸('01');
    if (답 === '막힘') return { 결과: '막힘', 꼴: '답 없음', 첫줄: '시간 넘김', 초: 1 };
    const 글 = JSON.stringify(답); fs.writeFileSync(답파일, 글); return { 결과: '받음', 답: 글, 초: 1 };
  },
});

test('흐름(P2-11): 본 그림마다 SHA-256 지문 · 크기를 작업 · 편 기록에 남기고, 빠진 칸이 있는 답은 「답 빠짐」 → 끝 코드 2', async (t) => {
  const d = 임시(t, '그림검사지문-');
  const 그림 = ['장면.png', '빠짐.png'].map((n) => { const f = path.join(d, n); fs.writeFileSync(f, `내용-${n}`); return f; });
  const 편 = path.join(d, 'LAB_지문_20261113'); fs.mkdirSync(편);
  const 빠진답 = 답칸('01'); delete 빠진답.다섯.글자;
  t.mock.method(console, 'log', () => {});
  const 코드 = await 검사.main([...그림, '--의도', '펠트 카페', '--밖', path.join(d, '밖'), '--편', 편], 가짜눈({ '빠짐.png': 빠진답 }));
  assert.equal(코드, 2);
  for (const 기록 of [읽기(path.join(d, '밖', '그림검사.json')), 읽기(path.join(편, '게시', '그림검사.json'))]) {
    assert.equal(기록.지문꼴, 'sha256');
    assert.deepEqual(기록.그림.map((g) => [g.판정, g.지문, g.크기]), [['통과', sha('내용-장면.png'), Buffer.byteLength('내용-장면.png')], ['답 빠짐', sha('내용-빠짐.png'), Buffer.byteLength('내용-빠짐.png')]]);
    assert.deepEqual(기록.그림[1].빠진칸, ['그림 속 글자']);
    assert.equal(기록.답빠짐, 1);
  }
});

test('--판단(P2-11): 다시 굽기 그림에 까닭 · 때를 달고, 결과를 보기 전 · 기록에 없는 이름 · 다시 굽기가 아닌 그림 · 검사 뒤 바뀐 그림은 아무것도 안 쓰고 막는다', async (t) => {
  assert.deepEqual(검사.판단풀기('저녁앉음=문 손잡이 = 카메라가 당기면 화면 밖'), { 키: '저녁앉음', 글: '문 손잡이 = 카메라가 당기면 화면 밖' });
  for (const 틀림 of ['저녁앉음', '저녁앉음=', '=까닭', undefined]) assert.throws(() => 검사.판단풀기(틀림), /그림 이름 또는 번호/);
  assert.throws(() => 검사.인자(['a.png', '--의도', 'x', '--판단', '01=y']), /결과를 본 뒤/, '검사와 같이 주면 아직 못 본 걸림까지 덮는다');
  assert.throws(() => 검사.인자(['--받기', 'd', '--판단', '01=y']), /결과를 본 뒤/);
  assert.throws(() => 검사.인자(['--판단', '01=y']), /--편/);
  assert.deepEqual(검사.인자(['--편', 'p', '--판단', '01=y', '--판단', '뜻=z']).판단, [{ 키: '01', 글: 'y' }, { 키: '뜻', 글: 'z' }]);

  const d = 임시(t, '그림검사판단-');
  const 그림 = ['개그.png', '뜻.png'].map((n) => { const f = path.join(d, n); fs.writeFileSync(f, n); return f; });
  const 편 = path.join(d, 'LAB_판단_20261113'); fs.mkdirSync(편);
  const 밖 = path.join(d, '밖');
  const 로그 = t.mock.method(console, 'log', () => {});
  assert.equal(await 검사.main([...그림, '--의도', '관용구 퀴즈', '--밖', 밖, '--편', 편], 가짜눈({ '뜻.png': 답칸('01', { 실사섞임: '문 손잡이 금속 광택' }) })), 1);
  const 편기록 = path.join(편, '게시', '그림검사.json');
  const 전 = fs.readFileSync(편기록, 'utf8');
  const 손 = { 바탕들: [d] };
  await assert.rejects(검사.main(['--편', 편, '--판단', '뜻=화면 밖', '--판단', '없는그림=x'], 손), /없는그림.*있는 그림: 01 개그\.png\(통과\), 02 뜻\.png\(다시 굽기\)/);
  await assert.rejects(검사.main(['--편', 편, '--판단', '01=x'], 손), /「통과」이다 — 판단은 「다시 굽기」/);
  assert.equal(fs.readFileSync(편기록, 'utf8'), 전, '하나라도 틀리면 아무것도 안 쓴다');
  assert.equal(검사.상태(편, 손).문제.filter((m) => /판단 없음/.test(m)).length, 1);

  assert.equal(await 검사.main(['--편', 편, '--밖', 밖, '--판단', '뜻=문 손잡이는 카메라가 당기면 화면 밖으로 나간다'], 손), 0);
  for (const f of [편기록, path.join(밖, '그림검사.json')]) {
    const g = 읽기(f).그림[1];
    assert.equal(g.판정, '다시 굽기', '판정은 그대로 — 판단은 따로');
    assert.equal(g.판단.글, '문 손잡이는 카메라가 당기면 화면 밖으로 나간다');
    assert.ok(!Number.isNaN(Date.parse(g.판단.때)));
  }
  assert.equal(검사.끝코드(읽기(편기록).그림), 0);
  const s = 검사.상태(편, 손);
  assert.deepEqual(s.문제, [], '판단을 단 다시 굽기는 문제가 아니다');
  assert.equal(s.그림[1].판단.글, '문 손잡이는 카메라가 당기면 화면 밖으로 나간다');
  assert.ok(로그.mock.calls.some((c) => /남은 문제 없음/.test(c.arguments.join(' '))));
  assert.equal(await 검사.main(['--편', 편, '--판단', '02=둘째 판단'], 손), 0, '번호로도, 다시 주면 바꾼다');
  assert.equal(읽기(편기록).그림[1].판단.글, '둘째 판단');

  fs.writeFileSync(그림[1], '다시 구운 뜻');
  await assert.rejects(검사.main(['--편', 편, '--판단', '뜻.png=x'], 손), /검사 뒤 바뀌었다/);
  assert.deepEqual(검사.상태(편, 손).문제, ['그림 검사 02 뜻.png: 검사 뒤 그림이 바뀜 — 바뀐 그림을 다시 검사한다']);

  // 같은 편을 다른 그림으로 다시 검사하면 편 기록을 갈아 쓴다 — 앞 기록에서 빠지는 그림을 알린다
  로그.mock.resetCalls();
  await 검사.main([그림[0], '--의도', '관용구 퀴즈', '--밖', path.join(d, '밖2'), '--편', 편], 가짜눈());
  assert.ok(로그.mock.calls.some((c) => /앞 기록의 뜻\.png\(다시 굽기\)는 기록에서 빠진다/.test(c.arguments.join(' '))));
});

test('상태(편 폴더, P2-11): 읽기만 — 다시 굽기인데 판단 없음 · 답 빠짐 · 답 없음 · 검사 뒤 바뀜 · 파일 없음 · 옛 기록(지문 없음)을 던지지 않고 알린다', async (t) => {
  const d = 임시(t, '그림검사상태-');
  assert.deepEqual(검사.상태(path.join(d, '없는편')).그림, []);
  assert.equal(검사.상태(path.join(d, '없는편')).있음, false);
  const 그림 = ['a.png', 'b.png', 'c.png', 'd.png'].map((n) => { const f = path.join(d, n); fs.writeFileSync(f, n); return f; });
  const 편 = path.join(d, 'LAB_상태_20261113'); fs.mkdirSync(편);
  const 빠진답 = 답칸('01'); delete 빠진답.다섯.떠있음;
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'error', () => {});
  await 검사.main([...그림, '--의도', '펠트', '--밖', path.join(d, '밖'), '--편', 편], 가짜눈({ 'b.png': 답칸('01', { 손없는움직임: '혼자 쓰는 연필' }), 'c.png': 빠진답, 'd.png': '막힘' }));
  const 손 = { 바탕들: [d] };
  const 전 = fs.readFileSync(path.join(편, '게시', '그림검사.json'), 'utf8');
  let s = 검사.상태(편, 손);
  assert.equal(s.있음, true);
  assert.deepEqual(s.그림.map((g) => [g.이름, g.판정, g.판단, g.지문맞음]), [['a.png', '통과', null, true], ['b.png', '다시 굽기', null, true], ['c.png', '답 빠짐', null, true], ['d.png', '답 없음', null, true]]);
  assert.deepEqual(s.문제, [
    '그림 검사 02 b.png: 다시 굽기인데 판단 없음 — 손 없는 움직임: 혼자 쓰는 연필',
    '그림 검사 03 c.png: 답 빠짐(떠 있는 물건) — 다시 검사한다',
    '그림 검사 04 d.png: 답 없음 — 검사가 안 됐다, 다시 검사한다',
  ]);
  fs.writeFileSync(그림[0], '고친 a'); fs.rmSync(그림[2]);
  s = 검사.상태(편, 손);
  assert.deepEqual(s.그림.map((g) => g.지문맞음), [false, true, null, true], '파일이 없으면 null');
  assert.ok(s.문제.includes('그림 검사 01 a.png: 검사 뒤 그림이 바뀜 — 바뀐 그림을 다시 검사한다'));
  assert.ok(s.문제.some((m) => /03 c\.png: 그림 파일을 못 찾음/.test(m)));
  assert.equal(fs.readFileSync(path.join(편, '게시', '그림검사.json'), 'utf8'), 전, '상태()는 기록을 안 고친다');

  // 옛 기록(11-10 지마 꼴 — 판 1, 지문 칸 없음)
  const 옛편 = path.join(d, 'LAB_옛_20261031'); fs.mkdirSync(path.join(옛편, '게시'), { recursive: true });
  fs.writeFileSync(path.join(옛편, '게시', '그림검사.json'), JSON.stringify({ 판: 1, 만든때: '2026-11-10T09:10:48.998Z', 눈: 'gpt', 종류: '그림', 그림: [{ 번호: '01', 판정: '다시 굽기', 걸림: ['실사 섞임: 문 손잡이 금속 광택'], 파일: 'b.png' }], 다시굽기: 1, 답없음: 0 }));
  let 옛;
  assert.doesNotThrow(() => { 옛 = 검사.상태(옛편, 손); });
  assert.deepEqual(옛.그림.map((g) => [g.판정, g.지문맞음]), [['다시 굽기', null]]);
  assert.deepEqual(옛.문제, ['그림 검사 01 b.png: 다시 굽기인데 판단 없음 — 실사 섞임: 문 손잡이 금속 광택', '그림 검사 01 b.png: 지문 없음(옛 기록) — 검사한 그림과 지금 그림이 같은지 모른다, 다시 검사하면 묶인다']);
  assert.equal(await 검사.main(['--편', 옛편, '--판단', '01=문 손잡이는 화면 밖으로 나간다'], 손), 0, '옛 기록에도 판단은 단다(지문 없음은 남는다)');
  assert.deepEqual(검사.상태(옛편, 손).문제, ['그림 검사 01 b.png: 지문 없음(옛 기록) — 검사한 그림과 지금 그림이 같은지 모른다, 다시 검사하면 묶인다']);

  fs.writeFileSync(path.join(옛편, '게시', '그림검사.json'), '{ 깨진');
  assert.match(검사.상태(옛편, 손).문제[0], /기록을 못 읽음/);
});

test('상태(P2-11): 기록의 저장소 상대 경로는 편이 든 작업본에서 먼저 푼다 — 운영 사본에서 돌아도 그 사본의 같은 경로(옛 판)와 견주지 않는다', (t) => {
  const d = 임시(t, '그림검사뿌리-');
  const [메인, 운영] = ['메인', '운영'].map((n) => path.join(d, n));
  for (const r of [메인, 운영]) { fs.mkdirSync(path.join(r, '.git'), { recursive: true }); for (const 아래 of ['판', '게시']) fs.mkdirSync(path.join(r, 'docs', '편', 아래), { recursive: true }); }
  fs.writeFileSync(path.join(메인, 'docs', '편', '판', 'a.png'), '새 판');
  fs.writeFileSync(path.join(운영, 'docs', '편', '판', 'a.png'), '옛 판');
  fs.writeFileSync(path.join(메인, 'docs', '편', '게시', '그림검사.json'), JSON.stringify({ 판: 2, 그림: [{ 번호: '01', 판정: '통과', 걸림: [], 파일: 'docs/편/판/a.png', 지문: sha('새 판'), 크기: 5 }] }));
  const s = 검사.상태(path.join(메인, 'docs', '편'), { 바탕들: [운영] });
  assert.deepEqual([s.그림[0].지문맞음, s.문제], [true, []]);
});

test('흐름(haiku, P2-11): 재료를 만들 때 잰 지문을 기록에 — 재료 뒤 바뀐 그림은 옛 지문 그대로라 상태()가 짚고, 빠진 칸 답은 답 빠짐', async (t) => {
  const d = 임시(t, '그림검사하이쿠지문-');
  const 그림 = ['a.png', 'b.png'].map((n) => { const f = path.join(d, n); fs.writeFileSync(f, n); return f; });
  const 편 = path.join(d, 'LAB_하이쿠_20261113'); fs.mkdirSync(편);
  const 밖 = path.join(d, '밖');
  t.mock.method(console, 'log', () => {});
  assert.equal(await 검사.main([...그림, '--의도', '펠트', '--눈', 'haiku', '--밖', 밖, '--편', 편, '--마스코트', '없음'], { 나라금기: () => [] }), 4);
  assert.deepEqual(읽기(path.join(밖, '그림목록.json')).그림.map((g) => g.지문), [sha('a.png'), sha('b.png')]);
  fs.writeFileSync(그림[1], 'haiku가 본 뒤 바뀜');
  const 빠진답 = 답칸('02'); delete 빠진답.다섯.정본다름;
  fs.writeFileSync(path.join(밖, '답_haiku.json'), JSON.stringify({ 그림들: [답칸('01'), 빠진답] }));
  assert.equal(검사.받기({ 받기: 밖 }), 2);
  const 기록 = 읽기(path.join(편, '게시', '그림검사.json'));
  assert.deepEqual(기록.그림.map((g) => [g.판정, g.지문]), [['통과', sha('a.png')], ['답 빠짐', sha('b.png')]]);
  const s = 검사.상태(편, { 바탕들: [d] });
  assert.deepEqual(s.그림.map((g) => g.지문맞음), [true, false]);
});

// 가짜 codex계정 — FAKE_CODEX=ok면 -o 파일에 글을 쓴다, limit면 종료 3. 받은 인자 · 표준입력은 FAKE_CODEX_LOG에.
function 가짜codex(t) {
  const d = 임시(t, '가짜codex-');
  const f = path.join(d, 'codex계정.js');
  fs.writeFileSync(f, `
const fs = require('fs');
const a = process.argv.slice(2); const 값 = (k) => a[a.indexOf(k) + 1];
let 입력 = ''; process.stdin.on('data', (d) => { 입력 += d; });
process.stdin.on('end', () => {
  if (process.env.FAKE_CODEX_LOG) fs.writeFileSync(process.env.FAKE_CODEX_LOG, JSON.stringify({ 인자: a, 입력 }));
  if (process.env.FAKE_CODEX === 'limit') { process.stderr.write('[codex계정] 쓸 수 있는 굽기 계정이 없다\\n'); process.exit(3); }
  if (process.env.FAKE_CODEX === 'fail') { process.stderr.write('ERROR: stream disconnected\\n'); process.exit(1); }
  fs.writeFileSync(값('-o'), '{"낱장":[]}');
});
`);
  return { f, 로그: path.join(d, '로그.json') };
}

test('그림눈.GPT묻기: 구독 통로를 빈 폴더 · 읽기 전용 · 「도구 쓰지 말 것」으로 부르고 그림을 -i 순서대로 — 계정 없음(종료 3)은 막힘', async (t) => {
  const 가짜 = 가짜codex(t);
  const d = 임시(t, 'GPT묻기-');
  const 그림 = path.join(d, '화면01.jpg'); fs.writeFileSync(그림, 'x');
  const 옛 = { ...process.env };
  t.after(() => { for (const k of ['SYNK_CODEX_ROTATE', 'FAKE_CODEX', 'FAKE_CODEX_LOG']) if (옛[k] === undefined) delete process.env[k]; else process.env[k] = 옛[k]; });
  process.env.SYNK_CODEX_ROTATE = 가짜.f; process.env.FAKE_CODEX_LOG = 가짜.로그;
  process.env.FAKE_CODEX = 'ok';
  const r = await 그림눈.GPT묻기({ 그림들: [그림], 글: '판정해라', 답파일: path.join(d, '답.md') });
  assert.equal(r.결과, '받음');
  assert.equal(r.답, '{"낱장":[]}');
  const 받은 = JSON.parse(fs.readFileSync(가짜.로그, 'utf8'));
  assert.deepEqual(받은.인자.slice(0, 2), ['exec', '--skip-git-repo-check']);
  assert.equal(받은.인자[받은.인자.indexOf('-s') + 1], 'read-only');
  assert.equal(받은.인자[받은.인자.indexOf('-i') + 1], path.resolve(그림));
  assert.notEqual(받은.인자[받은.인자.indexOf('-C') + 1], process.cwd(), '빈 임시 폴더에서 — 저장소를 못 읽게');
  assert.match(받은.입력, /^Do not run any shell commands/);
  assert.match(받은.입력, /첨부 그림은 이 순서로 붙였다: 화면01\.jpg/);
  process.env.FAKE_CODEX = 'limit';
  const 막 = await 그림눈.GPT묻기({ 그림들: [그림], 글: 'x', 답파일: path.join(d, '답2.md') });
  assert.deepEqual([막.결과, 막.꼴], ['막힘', '계정 없음']);
  assert.match(막.첫줄, /굽기 계정이 없다/);
  process.env.FAKE_CODEX = 'fail';
  const 실패 = await 그림눈.GPT묻기({ 그림들: [], 글: 'x', 답파일: path.join(d, '답3.md') });
  assert.deepEqual([실패.결과, 실패.꼴], ['막힘', '부르기 실패']);
  assert.match(실패.첫줄, /stream disconnected/);
});

test('그림눈.정본시트: 몽글 정본 셋을 흰 바탕 한 장으로 — 정본 경로가 없으면 멈춘다(가짜 ffmpeg)', (t) => {
  const d = 임시(t, '정본시트-');
  const 받은 = [];
  const 실행 = (args) => { 받은.push(args); fs.writeFileSync(args[args.length - 1], 'jpg'); return ''; };
  const 그림 = ['a', 'b', 'c'].map((n) => { const f = path.join(d, `${n}.png`); fs.writeFileSync(f, n); return f; });
  const 밖 = 그림눈.정본시트(path.join(d, '정본.jpg'), { 실행, 경로: (이름) => 그림[['본체', '우34', '좌34'].indexOf(이름)], 칸: 540 });
  assert.equal(fs.readFileSync(밖, 'utf8'), 'jpg');
  const 필터 = 받은[0][받은[0].indexOf('-filter_complex') + 1];
  assert.match(받은[0].join(' '), /color=c=white:s=1620x540/);
  assert.match(필터, /\[t1\]\[m2\]overlay=x=1080\+\(540-w\)\/2:y=\(540-h\)\/2\[out\]$/);
  assert.throws(() => 그림눈.정본시트(path.join(d, 'x.jpg'), { 실행, 경로: () => path.join(d, '없음.png') }), /정본 그림이 없다/);
  assert.match(require('../tools/lib/마스코트자산.js').경로('본체'), /몽글_본체\.png$/, '정본 경로의 주인은 마스코트자산');
});

test('그림눈.프레임뽑기: 프레임 번호를 select로 한 번에 정확히(-ss는 한두 프레임 밀린다) — 같은 번호는 한 번만', (t) => {
  const d = 임시(t, '프레임뽑기-');
  let 받은 = null;
  const m = 그림눈.프레임뽑기('v.mp4', [30, 8, 30, 0], d, { 폭: 432, 실행: (args) => { 받은 = args; } });
  assert.deepEqual([...m.keys()], [0, 8, 30]);
  assert.equal(path.basename(m.get(30)), 'f_002.png');
  assert.equal(받은[받은.indexOf('-vf') + 1], "select='eq(n\\,0)+eq(n\\,8)+eq(n\\,30)',scale=432:-2:flags=lanczos");
  assert.ok(받은.includes('passthrough'));
});
