'use strict';

// 미학 맹검(tools/미학맹검.js) — 아르곤을 부르지 않고 본다: 점검표 읽기 · 기준 글 · 4장 묶음 · 지시문 · 답 모으기 · 끝 코드.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const 맹검 = require('../tools/미학맹검.js');

const 표 = [
  '## 점검표', '',
  '| # | 자리 | 유호님 말씀 | 이렇게 본다 | 대신 |', '|---|---|---|---|---|',
  '| 1 | 끝 화면 | 11-04 「밑에 써있는게 슬롭같은데?」 | 납작한 색 판에 큰 글자를 얹었나. [끝판검사.py](../x/끝판검사.py)가 잰다 | 판을 쓰지 않는다 |',
  '| 24 | 제품 옆 강조 글 | 11-06 「이거 좀 짜친다」 | **기본 굵은 고딕**을 친 글자인가 | 직접 그린 타이포 |',
  '| 표 | 아님 | x | y | z |',
].join('\n');

test('점검표 번호 줄만 읽고 링크 · 굵게를 걷는다', () => {
  const 줄들 = 맹검.기준읽기(표);
  assert.deepEqual(줄들.map(r => r.번호), [1, 24]);
  assert.equal(줄들[0].본다, '납작한 색 판에 큰 글자를 얹었나. 끝판검사.py가 잰다');
  assert.equal(줄들[1].본다, '기본 굵은 고딕을 친 글자인가');
  const 글 = 맹검.기준글(줄들);
  assert.match(글, /^K1 \[영상 · 끝 화면\] 납작한 색 판/m, '매체를 안 적은 옛 줄은 영상');
  assert.match(글, /K24 \[영상 · 제품 옆 강조 글\].*말씀: 11-06 「이거 좀 짜친다」/);
  assert.match(글, /재료나 기법.*넓혀 읽지 않는다/, '11-08 첫 실측 — 영상 속 펠트 CG 지적이 고르신 펠트 정물 기각으로 번졌다');
  assert.match(글, /통과한 판[\s\S]*\(아직 없음\)/);
});

test('통과한 판(G줄)과 매체 표시를 읽어 기준 글에 함께 싣는다', () => {
  const 글 = [표, '', '## 통과한 판', '', '| # | 자리 | 유호님 말씀 | 무엇이 좋았나 |', '|---|---|---|---|',
    '| G1 | 그림 · 링크드인 커버 | 11-05 「이걸로」 | 펠트 실물 한 장 · 빛 하나 · 글 없음 |',
    '| 2 | SNS · 카드 글자 | 11-03 「최악」 | 흰 굵은 글자에 검은 테인가 | 색 하나 |'].join('\n');
  const 지적 = 맹검.기준읽기(글), 통과 = 맹검.통과읽기(글);
  assert.deepEqual(지적.map(r => `${r.번호}:${r.매체}`), ['1:영상', '24:영상', '2:SNS']);
  assert.deepEqual(통과.map(r => `G${r.번호}:${r.매체}:${r.자리}`), ['G1:그림:링크드인 커버']);
  const 기준 = 맹검.기준글(지적, 통과);
  assert.match(기준, /^K2 \[SNS · 카드 글자\]/m);
  assert.match(기준, /^G1 \[그림 · 링크드인 커버\] 펠트 실물 한 장/m);
  assert.deepEqual(맹검.매체가르기('화면 · 첫 화면'), { 매체: '화면', 자리: '첫 화면' });
});

test('실제 점검표를 읽으면 기준 줄이 20줄 넘게 나온다', () => {
  const 글 = fs.readFileSync(path.join(__dirname, '..', 'docs', '마케팅', '제작양식', '광고영상_슬롭점검표.md'), 'utf8');
  assert.ok(맹검.기준읽기(글).length >= 20);
});

test('한 대화 4장 — 쌍은 같은 대화에, 나머지는 빈자리부터', () => {
  const 번호 = ['01', '02', '03', '04', '05', '06', '07', '08', '09'];
  const 묶음 = 맹검.묶음나누기(번호, [['01', '09'], ['02', '08']]);
  assert.ok(묶음.every(b => b.length <= 맹검.한대화));
  assert.deepEqual(묶음.flat().sort(), 번호);
  const 같이 = (a, b) => 묶음.some(x => x.includes(a) && x.includes(b));
  assert.ok(같이('01', '09') && 같이('02', '08'));
  assert.equal(묶음.length, 3);
});

test('지시문은 아르곤 웹 한도(4,300자) 안이고 판정이 드러나는 낱말이 없다', () => {
  const 화면 = Array.from({ length: 4 }, (_, i) => ({ 번호: `0${i + 1}`, 설명: '가상 러닝화 광고의 끝 화면(9:16)' }));
  const 글 = 맹검.지시문(화면, [['01', '02']]);
  assert.ok(글.length < 4300, `${글.length}자`);
  assert.match(글, /유호님_기준/);
  assert.match(글, /쌍: \(01, 02\)/);
  assert.ok(!/새 판|옛 판|고친 판/.test(글));
});

test('답 모으기: 꼴이 아닌 판정 · 모르는 번호는 버리고, 빠진 화면은 끝 코드 2', () => {
  const 모음 = 맹검.답모으기([
    { 낱장: [{ 번호: '01', 판정: '기각', 점수: 3, 약점: ['[K24] 강조 글'], 강점: '빛' }, { 번호: '9', 판정: '그대로 냄' }, { 번호: '02', 판정: '좋음' }], 쌍: [{ 쌍: '01-02', 고름: '02', 까닭: '…' }] },
    null,
  ], ['01', '02']);
  assert.deepEqual(모음.낱장.map(x => x.번호), ['01']);
  assert.deepEqual(모음.빠짐, ['02']);
  assert.equal(맹검.끝코드(모음), 2);
  assert.equal(맹검.끝코드({ 낱장: [{ 판정: '기각' }], 빠짐: [] }), 1);
  assert.equal(맹검.끝코드({ 낱장: [{ 판정: '고쳐서 냄' }], 빠짐: [] }), 0);
});

test('모음 JSON: 매체로 고르고, 점검표 줄이 있거나 질문이 빈 항목은 빼며, 범위 주의를 달아 싣는다', () => {
  const 글 = JSON.stringify({
    지적: [
      { id: 'C001', 매체: '영상', 자리: '끝 화면', 질문: '판을 덮었나', 말씀: '「슬롭」', 점검표행: 1 },
      { id: 'C002', 매체: 'SNS', 자리: '카드 글자', 질문: '흰 굵은 글자에 검은 테인가', 말씀: '「최악」', '범위 주의': '영상 자막에는 넓히지 않는다' },
      { id: 'C003', 매체: '소리', 자리: '목소리', 질문: 'AI 같나', 말씀: '「AI 같아」' },
      { id: 'C004', 매체: '화면', 자리: '첫 화면', 질문: '', 말씀: 'x' },
    ],
    통과: [{ id: 'P001', 매체: '그림', 자리: '커버', 질문: '펠트 실물 한 장인가', 말씀: '「훨씬 낫다」' }],
  });
  const 기본 = 맹검.모음읽기(글);
  assert.deepEqual(기본.지적.map(x => x.id), ['C002'], '점검표행이 있는 C001 · 소리 C003 · 질문 빈 C004는 뺀다');
  assert.deepEqual(기본.통과.map(x => x.id), ['P001']);
  assert.deepEqual(맹검.모음읽기(글, ['영상']).지적, [], '영상만 고르면 SNS 지적은 안 붙는다');
  assert.deepEqual(맹검.모음읽기('{깨진'), { 지적: [], 통과: [] });
  const 기준 = 맹검.기준글([], [], 기본);
  assert.match(기준, /^C002 \[SNS · 카드 글자\] 흰 굵은 글자에 검은 테인가 \/ 말씀: 「최악」 \(범위 주의: 영상 자막에는 넓히지 않는다\)$/m);
  assert.match(기준, /^P001 \[그림 · 커버\] 펠트 실물 한 장인가/m);
  assert.ok(!/\(아직 없음\)/.test(기준), '모음에 통과가 있으면 「아직 없음」을 쓰지 않는다');
});

test('실제 모음 JSON은 매체마다 지적이 있고, 넷을 합친 기본이 가장 많다', () => {
  const 글 = fs.readFileSync(path.join(__dirname, '..', 'docs', '마케팅', '제작양식', '슬롭점검_모음.json'), 'utf8');
  const 넷 = 맹검.모음읽기(글);
  for (const 매 of ['영상', 'SNS', '화면', '그림']) {
    const r = 맹검.모음읽기(글, [매]);
    assert.ok(r.지적.length > 0, `${매} 지적`);
    assert.ok(r.지적.length < 넷.지적.length, `${매}만 고르면 줄어든다`);
    assert.ok(r.지적.every(x => x.매체 === 매));
  }
  assert.ok(넷.지적.every(x => /^C\d+$/.test(x.id)) && 넷.통과.every(x => /^P\d+$/.test(x.id)));
});

test('인자 --매체: 기본은 소리를 뺀 넷, 쉼표로 여럿, 모르는 매체는 거른다', () => {
  assert.deepEqual(맹검.인자(['a.png']).매체, ['영상', 'SNS', '화면', '그림']);
  assert.deepEqual(맹검.인자(['a.png', '--매체', 'SNS, 화면']).매체, ['SNS', '화면']);
  assert.throws(() => 맹검.인자(['a.png', '--매체', '영화']), /--매체는/);
  assert.throws(() => 맹검.인자(['a.png', '--매체']), /--매체는/);
});

test('저장소경로: 편 폴더 기록에는 저장소 안 상대 경로 · 밖이면 파일 이름만(이 PC 사용자 폴더 경로를 올리지 않는다)', () => {
  const 바탕 = path.resolve(__dirname, '..');
  assert.equal(맹검.저장소경로(path.join(바탕, '.tmp', '미학맹검', '가', '결과.md'), [바탕]), '.tmp/미학맹검/가/결과.md');
  assert.equal(맹검.저장소경로(path.join(require('node:os').tmpdir(), 'scratch', '첫장.jpg'), [바탕]), '첫장.jpg');
  assert.ok(!/[A-Za-z]:[\\/]|Users[\\/]/.test(맹검.저장소경로('C:/Users/someone/AppData/Local/Temp/x/끝.jpg', [바탕])));
});

test('인자: 그림::설명 · --쌍 · 모르는 인자', () => {
  const o = 맹검.인자(['a.png::끝 화면', 'b.png', '--무엇', '썸네일', '--쌍', 'a.png,b.png']);
  assert.deepEqual(o.그림, [{ 파일: 'a.png', 설명: '끝 화면' }, { 파일: 'b.png', 설명: '' }]);
  assert.equal(o.무엇, '썸네일');
  assert.deepEqual(o.쌍, [['a.png', 'b.png']]);
  assert.throws(() => 맹검.인자(['--모름']));
  assert.throws(() => 맹검.인자([]));
});

// ── 11-10 LAB 하루 두 편 설계 17 · 18: 띠 · 의도 · 지문 이어받기 · 막힌 증거 · 대체 눈(가짜 ffmpeg · 가짜 아르곤 · 가짜 GPT — AI도 ffmpeg도 부르지 않는다) ──
const os = require('node:os');
const 그림눈 = require('../tools/lib/그림눈.js');
const 관문 = require('../tools/lib/미학관문.js');

test('인자: --영상 · --순간 · --의도 · --눈(Fable · 그록은 시각 대체에서 뺌) · --받기 · --적중시험', () => {
  const o = 맹검.인자(['--영상', 'a.mp4', '--순간', '6.5::연필', '--순간', '9', '--의도', '글자 그대로 그린 개그', '--편', '편', '--눈', 'gpt']);
  assert.deepEqual(o.순간, [{ 초: 6.5, 설명: '연필' }, { 초: 9, 설명: '' }]);
  assert.equal(o.눈, 'gpt');
  assert.throws(() => 맹검.인자(['--순간', '3']), /--영상과 함께/);
  assert.throws(() => 맹검.인자(['a.png', '--눈', 'fable']), /언어 교정 몫/);
  assert.throws(() => 맹검.인자(['a.png', '--눈', '그록']), /무르다/);
  assert.throws(() => 맹검.인자(['--받기', 'x', '--편', 'y']), /--눈 opus와 함께/);
  assert.throws(() => 맹검.인자(['--눈', 'opus', '--받기', 'x']), /--편/);
  assert.equal(맹검.인자(['--적중시험', 'd']).눈, 'gpt', '적중시험은 도구가 부르는 GPT');
  assert.ok(맹검.인자(['a.png', '--의도', 'x'.repeat(300)]).의도.length <= 200);
  assert.throws(() => 맹검.인자(['--영상', 'a.mp4', '--순간', '-1']), /0 이상/);
});

test('띠: 핵심 순간 앞뒤 1초를 0.25초 간격 8칸(0이 그 순간) — 영상 밖은 처음 · 끝 프레임으로, 칸 이름은 실제 초 차이', () => {
  assert.deepEqual(맹검.띠프레임(6.5, 30, 18.6), [165, 173, 180, 188, 195, 203, 210, 218]);
  assert.deepEqual(맹검.띠프레임(0.3, 30, 10).slice(0, 4), [0, 0, 0, 2]);
  assert.deepEqual(맹검.띠프레임(18.4, 30, 18.6).slice(-3), [557, 557, 557]);
  const 이름 = 맹검.띠이름(6.5, 맹검.띠프레임(6.5, 30, 18.6), 30);
  assert.equal(이름[4], '6.50s');
  assert.equal(이름[0], '-1.00');
  assert.equal(이름[5], '+0.27');
  assert.equal(맹검.띠간격.length, 8);
});

test('그림눈 띠필터 · 대조필터: 칸마다 이름표 · 강조 칸 빨간 테 · xstack 자리', () => {
  const f = 그림눈.띠필터(8, { 열: 4, 이름들: ['-1.00', 'a', 'b', 'c', '6.50s'], 강조: 4, 글꼴파일: 'C:/Windows/Fonts/arial.ttf' });
  assert.match(f, /\[4:v\]format=rgb24,drawtext=fontfile='C\\:\/Windows\/Fonts\/arial\.ttf':text='6\.50s'.*color=0xFF3B30\[c4\]/);
  assert.match(f, /xstack=inputs=8:layout=0_0\|w0_0\|w0\+w1_0\|w0\+w1\+w2_0\|0_h0\|w0_h0\|w0\+w1_h0\|w0\+w1\+w2_h0:fill=white\[out\]$/);
  assert.match(그림눈.띠필터(1, { 글꼴파일: null }), /^\[0:v\]format=rgb24,pad=.*\[out\]$/);
  assert.match(맹검.대조필터(3, ['S1 1.20s', 'S2', 'S3'], null), /\[r\]\[s0\]\[s1\]\[s2\]xstack=inputs=4:layout=0_0\|0_h0\|w1_h0\|w1\+w2_h0/);
});

test('격자같음: 같은 렌더는 같고, 글자 몇 px 옮김(최대 30)은 다르다', () => {
  const a = Buffer.alloc(4096, 100);
  const 잡음 = Buffer.from(a); 잡음[10] = 102; 잡음[500] = 98;
  const 옮김 = Buffer.from(a); for (let i = 0; i < 60; i += 1) 옮김[2000 + i] = 130;
  assert.equal(그림눈.격자같음(a.toString('base64'), a.toString('base64')), true);
  assert.equal(그림눈.격자같음(a.toString('base64'), 잡음.toString('base64')), true);
  assert.equal(그림눈.격자같음(a.toString('base64'), 옮김.toString('base64')), false);
  assert.equal(그림눈.격자같음(null, a.toString('base64')), false);
});

test('이어받기: 같은 컷 이름 · 같은 지문이면 지난 판정을 새 번호로, 쌍 · --다시모두 · 바뀐 컷은 다시 본다', () => {
  const 격 = (v) => Buffer.alloc(4096, v).toString('base64');
  const 지난 = { 기록: { 만든때: '2026-11-10T01:00:00Z', 이름: 'v1', 화면: [{ 번호: '01', 컷: '순간@1.20' }, { 번호: '02', 컷: '순간@4.29' }, { 번호: '03', 컷: '마스코트' }],
    낱장: [{ 번호: '01', 판정: '그대로 냄', 점수: 8 }, { 번호: '02', 판정: '기각', 점수: 3 }, { 번호: '03', 판정: '고쳐서 냄' }] },
  격자: new Map([['순간@1.20', 격(100)], ['순간@4.29', 격(100)], ['마스코트', 격(90)]]) };
  const 새 = [{ 번호: '01', 컷: '순간@4.29', 격자: 격(100) }, { 번호: '02', 컷: '순간@1.20', 격자: 격(140) }, { 번호: '03', 컷: '마스코트', 격자: 격(90) }, { 번호: '04', 컷: '새컷', 격자: 격(1) }];
  const 옮김 = 맹검.이어받기(새, 지난);
  assert.deepEqual([...옮김.keys()], ['01', '03'], '순간@1.20은 바뀌어(고친 컷) 다시 본다');
  assert.equal(옮김.get('01').판정, '기각');
  assert.deepEqual(옮김.get('01').이어받음, { 만든때: '2026-11-10T01:00:00Z', 이름: 'v1', 눈: '아르곤' });
  assert.equal(맹검.이어받기(새, 지난, { 쌍번호: new Set(['01']) }).has('01'), false);
  assert.equal(맹검.이어받기(새, 지난, { 다시모두: true }).size, 0);
  assert.equal(맹검.이어받기(새, null).size, 0);
});

test('막힘읽기: 거절 한 줄 · 보낸 글 사라짐 · 안 보내짐 · 아르곤웹 실패 줄을 꼴과 증거로 — JSON 답이면 막힘 아님', (t) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), '막힘읽기-')); t.after(() => fs.rmSync(d, { recursive: true, force: true }));
  const 답 = (n) => path.join(d, `답_${n}.md`);
  fs.writeFileSync(답(1), '# 아르곤 답 — 2026-11-09 17:36:24\n\n대화: https://gemini.google.com/u/1/app/x\n올린 것: 화면01.jpg\n\nGemini의 응답\n\n저는 그런 것을 하도록 프로그램되지 않았습니다.\n');
  assert.deepEqual(맹검.막힘읽기(답(1)), { 꼴: '거절', 보낸때: '2026-11-09 17:36:24', 첫줄: '저는 그런 것을 하도록 프로그램되지 않았습니다.' });
  fs.writeFileSync(답(2), '# 아르곤 답\n\n```json\n{"낱장":[{"번호":"01","판정":"기각"}]}\n```');
  assert.equal(맹검.막힘읽기(답(2)), null);
  fs.writeFileSync(`${답(3)}.보냄.json`, JSON.stringify({ 시각: '2026-11-09 15:47:00', 대화: null }));
  assert.deepEqual(맹검.막힘읽기(답(3)), { 꼴: '답 없음', 보낸때: '2026-11-09 15:47:00', 첫줄: '보낸 글이 사라짐(대화 없음)' });
  fs.writeFileSync(`${답(4)}.안보내짐.json`, JSON.stringify([{ 시각: '2026-11-08 16:39:45', 까닭: '사이드바 최근 대화 15개에 없다 · 보낸 지 146분' }]));
  assert.equal(맹검.막힘읽기(답(4)).꼴, '안 보내짐');
  assert.match(맹검.막힘읽기(답(4)).첫줄, /사이드바/);
  const 실패 = 맹검.막힘읽기(답(5), '아르곤웹 · 1건\n  안 함  작업_5_ab — 보내기 전 실패가 두 번 이어짐 — 업로드 창 안 열림', '작업_5_ab');
  assert.equal(실패.꼴, '보내기 실패');
  assert.match(실패.첫줄, /업로드 창 안 열림/);
  for (const m of [맹검.막힘읽기(답(1)), 맹검.막힘읽기(답(3)), 맹검.막힘읽기(답(4)), 실패]) assert.equal(관문.막힘됨(m), true, '관문이 받는 증거 꼴');
});

test('줄꺼짐(11-12 여러 줄): 메인 ego 줄이 하나라도 켜져 있으면 막힘이 아니고, 다 꺼졌으면 끈 까닭을(같으면 한 번) 막힘으로 · 이름 붙은 ego 줄만 남으면 그 ego를 본다', async (t) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), '줄꺼짐-')); t.after(() => fs.rmSync(d, { recursive: true, force: true }));
  const 차례 = path.join(d, '차례.py');
  let 부름 = 0;
  const 됨 = async () => { 부름 += 1; return { 됨: true, 까닭: 'ego 서버 gemini-x에 붙음' }; };
  const 안됨 = async () => { 부름 += 1; return { 됨: false, 까닭: 'ego 서버 gemini-x를 띄웠는데 30초 안에 통로가 안 생겼다' }; };
  const 다섯 = ['a', 'b', 'c', 'd', 'e'].map((k) => ({ 줄: `gemini-${k}`, 키: k, ego: '' }));
  assert.equal(await 맹검.줄꺼짐(차례, 됨, 다섯), null);
  fs.writeFileSync(path.join(d, 'gemini-a.off'), '11-08 07:41 공모전 관리 세션: a 줄 끔\n');
  assert.equal(await 맹검.줄꺼짐(차례, 됨, 다섯), null, 'a가 꺼져도 b · c · d · e로 간다');
  for (const k of 'bcde') fs.writeFileSync(path.join(d, `gemini-${k}.off`), '2026-11-12 22:00:00 아르곤웹 · 로봇 확인(sorry)\n');
  const m = await 맹검.줄꺼짐(차례, 됨, 다섯);
  assert.equal(m.꼴, '줄 꺼짐');
  assert.match(m.첫줄, /^a 줄: 11-08 07:41 공모전 관리 세션: a 줄 끔 · b,c,d,e 줄: 2026-11-12 22:00:00 아르곤웹 · 로봇 확인\(sorry\)$/);
  assert.equal(부름, 0, '메인 ego 줄만 있으면 ego 서버를 건드리지 않는다');
  assert.equal(관문.막힘됨(m), true);
  fs.writeFileSync(path.join(d, 'gemini-a.off'), '2026-11-12 22:00:00 아르곤웹 · 로봇 확인(sorry)\n');
  assert.equal((await 맹검.줄꺼짐(차례, 됨, 다섯)).첫줄, '모든 줄: 2026-11-12 22:00:00 아르곤웹 · 로봇 확인(sorry)', '까닭이 같으면 한 번');
  assert.equal((await 맹검.줄꺼짐(차례, 됨, 다섯.map((l) => ({ ...l, 꺼짐: true, 꺼진까닭: '차례가 알려 준 까닭' })))).꼴, '줄 꺼짐', '차례 줄들의 꺼짐도 본다');
  const 섞임 = [...다섯, { 줄: 'gemini-f', 키: 'f', ego: 'gemini-x' }];
  assert.equal(await 맹검.줄꺼짐(차례, 됨, 섞임), null, '켜진 줄이 이름 붙은 ego 줄뿐이어도 그 ego가 되면 간다');
  assert.equal(부름, 1);
  const 못씀 = await 맹검.줄꺼짐(차례, 안됨, 섞임);
  assert.match(못씀.첫줄, /f 줄은 ego 서버 gemini-x를 못 씀: ego 서버 gemini-x를 띄웠는데/);
  for (const k of 'bcde') fs.rmSync(path.join(d, `gemini-${k}.off`));
  assert.equal(await 맹검.줄꺼짐(차례, 됨), null, '줄 목록을 못 읽으면(옛 차례.py) 끔 파일 a · b만 — b가 켜져 있으면 간다');
});

test('아르곤부르기(11-12) — 보내기 · 읽기 모두 --여러줄로 부른다(먼저 비는 줄 — b 줄이 4일 넘게 놀던 까닭)', () => {
  const 글 = fs.readFileSync(path.join(__dirname, '..', 'tools', '미학맹검.js'), 'utf8');
  assert.match(글, /spawn\(process\.execPath, \[아르곤, 명령, \.\.\.남은, '--여러줄'\]/);
});

test('아르곤부르기(11-13) — 답이 있나는 아르곤웹과 같은 잣대(답있음): 앞 판이 Gemini 오류 · 거절 문구를 써 둔 묶음도 다시 보낸다', () => {
  const 글 = fs.readFileSync(path.join(__dirname, '..', 'tools', '미학맹검.js'), 'utf8');
  const 덩이 = 글.slice(글.indexOf('async function 아르곤부르기('), 글.indexOf('function 적중읽기('));
  assert.match(덩이, /const \{ 답있음 \} = require\('\.\/아르곤웹\.js'\);/);
  assert.match(덩이, /작업들\.filter\(w => !답있음\(w\.답\)\)/);
  assert.match(덩이, /작업들\.some\(w => !답있음\(w\.답\)\)/);
  assert.doesNotMatch(덩이, /fs\.existsSync\(w\.답\)/);
  const { 답있음 } = require('../tools/아르곤웹.js');
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mh-'));
  const 오류답 = path.join(d, '답_1.md');
  fs.writeFileSync(오류답, '# 아르곤 답 — 2026-11-13 01:49:48\n\n대화: https://gemini.google.com/u/8/app/1\n올린 것: 화면01.jpg\n\nGemini의 응답\n오류가 발생했습니다.\n다시 시도\n');
  const 진짜 = path.join(d, '답_2.md');
  fs.writeFileSync(진짜, '# 아르곤 답 — 2026-11-13 01:49:48\n\n대화: https://gemini.google.com/u/8/app/2\n올린 것: 화면01.jpg\n\nGemini의 응답\n{"낱장":[]}\n');
  assert.deepEqual([답있음(오류답), 답있음(진짜), 답있음(path.join(d, '없음.md'))], [false, true, false]);
});

test('지시문: 띠 · 마스코트 대조 · 대본 의도 줄 — 긴 설명 넷 + 의도 200자도 아르곤 한도 안, 기준 없음(11-08 적중시험 꼴)', () => {
  const 화면 = [1, 2, 3].map((k) => ({ 번호: `0${k}`, 종류: '띠', 설명: 'ㄱ'.repeat(220) })).concat([{ 번호: '04', 종류: '마스코트', 설명: 'ㄴ'.repeat(220) }]);
  const 글 = 맹검.지시문(화면, [], { 의도: '배우는 사람이 ㅈ을 일본어 ス로 착각해 지우는 개그'.padEnd(200, '.') });
  assert.ok(글.length < 맹검.지시문한도, `${글.length}자`);
  assert.match(글, /대본 의도 — 결함이 아니다\): 배우는 사람이/);
  assert.match(글, /0\.25초 간격으로 찍은 8칸/);
  assert.match(글, /REF 줄은 정본/);
  assert.ok(!/새 판|옛 판|고친 판/.test(글));
  const 맨 = 맹검.지시문([{ 번호: '01', 설명: '링크드인 커버' }], [], { 기준: false });
  assert.ok(!/유호님_기준|띠|REF/.test(맨), '11-08 눈가림과 같은 맨 지시문');
});

test('채점: 11-08 눈가림 셈(기각 8 · 채택 4 · 쌍)', () => {
  const 답안 = { 답안: [{ 번호: '01', 판정: '기각' }, { 번호: '02', 판정: '기각' }, { 번호: '03', 판정: '채택' }, { 번호: '04', 판정: '기각' }], 쌍들: [{ A: '03', B: '04', 채택: '03' }] };
  const r = 맹검.채점(답안, { 낱장: [{ 번호: '01', 판정: '기각', 점수: 3 }, { 번호: '02', 판정: '고쳐서 냄', 점수: 5 }, { 번호: '03', 판정: '그대로 냄', 점수: 8 }], 쌍: [{ 쌍: '03-04', 고름: '3' }], 빠짐: ['04'] });
  assert.deepEqual({ 잡음: r.기각잡음, 반: r.기각반, 놓침: r.기각놓침, 채택: r.채택맞음, 쌍: r.쌍맞음, 없음: r.답없음 }, { 잡음: 1, 반: 1, 놓침: 0, 채택: 1, 쌍: 1, 없음: 1 });
  assert.deepEqual(r.평균점수, { 기각: 4, 채택: 8 });
});

// 이 파일의 ⑱ 단언은 도구가 남긴 기록을 옛 막음 판정으로 읽는다 — 11-12부터 기본은 권고라 부를 때만 SYNK_미학관문=막음을 켜고 원래 값으로 되돌린다
function aestheticFindingsOf(편) {
  let prep = {};
  try { prep = JSON.parse(fs.readFileSync(path.join(편, '게시', '준비.json'), 'utf8')); } catch { /* 없다 */ }
  const 앞 = process.env.SYNK_미학관문;
  process.env.SYNK_미학관문 = '막음';
  try { return 관문.aestheticFindings({ dir: 편, prep }, []); } finally { if (앞 === undefined) delete process.env.SYNK_미학관문; else process.env.SYNK_미학관문 = 앞; }
}

test('흐름(가짜 눈): 아르곤 줄 꺼짐 → 막힘 기록 → ⑱ 고칠 것 → GPT 대체 → ⑱ 확인할 것 → 다시 부르면 이어받아 안 보낸다 → opus 재료 · 받기', async (t) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), '맹검흐름-')); t.after(() => fs.rmSync(d, { recursive: true, force: true }));
  const 편 = path.join(d, 'LAB_시험_20261113'); fs.mkdirSync(편);
  const 그림 = ['첫화면.jpg', '번짐.jpg', '끝.jpg'].map((n, i) => { const f = path.join(d, n); fs.writeFileSync(f, `그림${i}`); return f; });
  const 적중파일 = path.join(d, '적중.json');
  fs.writeFileSync(적중파일, JSON.stringify({ 시험: { 기각: 8, 채택: 4, 쌍: 4, 이름: '11-08' }, 눈: { 아르곤: { 기각잡음: 7, 채택맞음: 1, 쌍맞음: 3 }, gpt: { 잰날: '2026-11-10', 기각잡음: 5, 채택맞음: 2, 쌍맞음: 3 } } }));
  const 묻은 = [];
  const 손 = { 작업뿌리: path.join(d, 'tmp'), 적중파일, 격자: () => Buffer.alloc(4096, 7).toString('base64'),
    줄꺼짐: () => ({ 꼴: '줄 꺼짐', 끈때: '2026-11-10 03:00:00', 첫줄: 'a 줄 끔(시험)' }),
    GPT묻기: async ({ 그림들, 글, 답파일 }) => {
      묻은.push({ 그림들, 글 });
      const 번호 = [...글.matchAll(/^- (\d\d): /gm)].map((m) => m[1]);
      const 답 = JSON.stringify({ 낱장: 번호.map((n) => ({ 번호: n, 판정: n === '02' ? '고쳐서 냄' : '그대로 냄', 점수: 7 })), 쌍: [] });
      fs.writeFileSync(답파일, 답);
      return { 결과: '받음', 답, 초: 1 };
    } };
  const 그림인자 = 그림.map((f, i) => `${f}::장면 ${i + 1}`);
  t.mock.method(console, 'log', () => {});
  assert.equal(await 맹검.main([...그림인자, '--편', 편, '--이름', 'a1'], 손), 2, '답 못 받음');
  const P = JSON.parse(fs.readFileSync(path.join(편, '게시', 관문.기록이름), 'utf8'));
  assert.equal(P.눈, '아르곤');
  assert.deepEqual(P.빠짐, ['01', '02', '03']);
  assert.deepEqual(P.막힘.map((m) => [m.꼴, m.첫줄]), [['줄 꺼짐', 'a 줄 끔(시험)']]);
  assert.deepEqual(P.화면.map((h) => h.컷), ['첫화면', '번짐', '끝']);
  assert.ok(!JSON.stringify(P).includes(d.replace(/\\/g, '\\\\')) && !JSON.stringify(P).includes(path.basename(d)), '공개 기록에 이 PC 임시 경로를 남기지 않는다');
  const 판정 = () => aestheticFindingsOf(편).map((f) => `${f.level}:${f.code}`);
  assert.deepEqual(판정(), ['고칠 것:aesthetic-unverified']);

  assert.equal(await 맹검.main([...그림인자, '--편', 편, '--이름', 'g1', '--눈', 'gpt'], 손), 0);
  assert.equal(묻은.length, 1, '한 대화 4장 안 — 한 번');
  assert.match(묻은[0].글, /붙인 글 파일 「유호님_기준」 — 아래가 그 전문/);
  const S = JSON.parse(fs.readFileSync(path.join(편, '게시', 관문.대체이름), 'utf8'));
  assert.equal(S.눈, 'gpt');
  assert.deepEqual(S.적중, { 잰날: '2026-11-10', 기각: '5/8', 채택: '2/4', 쌍: '3/4', 시험: '11-08', 아르곤: '7/8' });
  assert.deepEqual(S.앞눈.막힘.map((m) => m.꼴), ['줄 꺼짐']);
  assert.deepEqual(판정(), ['확인할 것:aesthetic-substitute', '확인할 것:aesthetic-fix']);

  // 다시 렌더 없이 다시 부르면 — 같은 컷 · 같은 지문은 이어받고 GPT를 다시 안 부른다
  assert.equal(await 맹검.main([...그림인자, '--편', 편, '--이름', 'g2', '--눈', 'gpt'], 손), 0);
  assert.equal(묻은.length, 1);
  const S2 = JSON.parse(fs.readFileSync(path.join(편, '게시', 관문.대체이름), 'utf8'));
  assert.ok(S2.낱장.every((x) => x.이어받음 && x.이어받음.이름 === 'g1'));

  // opus: 재료만(4) → 답 → 받기
  assert.equal(await 맹검.main([그림인자[0], '--편', 편, '--이름', 'o1', '--눈', 'opus', '--다시모두'], 손), 4);
  const 폴더 = path.join(손.작업뿌리, 'o1');
  const 질문 = fs.readdirSync(폴더).find((f) => f.startsWith('opus_질문_'));
  const 질문글 = fs.readFileSync(path.join(폴더, 질문), 'utf8');
  assert.match(질문글, /Read 도구로 순서대로/);
  const 답파일 = /Write 도구로 (.+?)에 그대로/.exec(질문글)[1];
  const 표식 = /"재료": "([^"]+)"을 그대로 넣는다/.exec(질문글)[1];
  fs.writeFileSync(답파일, JSON.stringify({ 재료: 표식, 낱장: [{ 번호: '01', 판정: '기각', 점수: 3, 약점: ['떠 있는 잎'] }], 쌍: [] }));
  assert.equal(await 맹검.main(['--눈', 'opus', '--받기', 폴더, '--편', 편], 손), 1);
  const S3 = JSON.parse(fs.readFileSync(path.join(편, '게시', 관문.대체이름), 'utf8'));
  assert.equal(S3.눈, 'opus');
  assert.equal(S3.낱장[0].판정, '기각');
});

test('흐름(가짜 눈): GPT도 막히고 Opus도 막히면 ⑱이 예비편(고칠 것)을 가리킨다', async (t) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), '맹검셋막힘-')); t.after(() => fs.rmSync(d, { recursive: true, force: true }));
  const 편 = path.join(d, 'LAB_막힘_20261113'); fs.mkdirSync(편);
  const f = path.join(d, '첫.jpg'); fs.writeFileSync(f, 'x');
  const 적중파일 = path.join(d, '적중.json'); fs.writeFileSync(적중파일, JSON.stringify({ 시험: {}, 눈: { gpt: { 기각잡음: 5, 채택맞음: 1, 쌍맞음: 2 } } }));
  const 손 = { 작업뿌리: path.join(d, 'tmp'), 적중파일, 격자: () => null, 줄꺼짐: () => ({ 꼴: '줄 꺼짐', 끈때: '2026-11-10 03:00:00', 첫줄: 'a 줄 끔' }),
    GPT묻기: async () => ({ 결과: '막힘', 꼴: '계정 없음', 첫줄: '[codex계정] 쓸 수 있는 굽기 계정이 없다', 초: 1 }) };
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'error', () => {});
  await 맹검.main([f, '--편', 편, '--이름', 'a'], 손);
  assert.equal(await 맹검.main([f, '--편', 편, '--이름', 'g', '--눈', 'gpt'], 손), 2);
  assert.deepEqual(aestheticFindingsOf(편).map((x) => x.code), ['aesthetic-unverified']);
  assert.match(aestheticFindingsOf(편)[0].message, /다음 눈 Claude Opus/);
  assert.equal(await 맹검.main(['--눈', 'opus', '--막힘', '하위 에이전트 한도', '--편', 편], 손), 2);
  assert.deepEqual(aestheticFindingsOf(편).map((x) => `${x.level}:${x.code}`), ['고칠 것:aesthetic-swap']);
});

test('GPT 적중 기록이 없으면 --눈 gpt를 안 받는다(지난 기각 사례로 먼저 잰다)', async (t) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), '맹검적중없음-')); t.after(() => fs.rmSync(d, { recursive: true, force: true }));
  const f = path.join(d, 'a.jpg'); fs.writeFileSync(f, 'x');
  const 적중파일 = path.join(d, '적중.json'); fs.writeFileSync(적중파일, JSON.stringify({ 눈: { 아르곤: { 기각잡음: 7 } } }));
  await assert.rejects(맹검.main([f, '--눈', 'gpt'], { 작업뿌리: path.join(d, 'tmp'), 적중파일 }), /--적중시험/);
});

// ── 11-11 Fable 5.2 끝 판 검수 P1-4: 맹검 기록이 실제로 본 것과 다르게 적히던 길 ⓐ~ⓖ(가짜 눈 · 가짜 ffmpeg — 모델 · 영상 도구를 부르지 않는다) ──
const crypto = require('node:crypto');
function 시험판(t, 이름) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `맹검P14-${이름}-`)); t.after(() => fs.rmSync(d, { recursive: true, force: true }));
  const 편 = path.join(d, `편_${이름}`); fs.mkdirSync(편, { recursive: true });
  const 적중파일 = path.join(d, '적중.json');
  fs.writeFileSync(적중파일, JSON.stringify({ 시험: { 기각: 8, 채택: 4, 쌍: 4, 이름: '11-08' }, 눈: { 아르곤: { 기각잡음: 7, 채택맞음: 1, 쌍맞음: 3 }, gpt: { 잰날: '2026-11-10', 기각잡음: 5, 채택맞음: 2, 쌍맞음: 3 } } }));
  const 상태 = { 영상내용: 'V1', 띠훅: null };
  const 손 = { 작업뿌리: path.join(d, 'tmp'), 적중파일, 줄꺼짐: () => null,
    // 가짜 격자 — 파일 바이트의 sha256을 4,096칸에 펼친다(같은 바이트 = 같은 격자, 다른 바이트 = 아주 다른 격자)
    격자: (f) => { const h = crypto.createHash('sha256').update(fs.readFileSync(f)).digest(); const g = Buffer.alloc(4096); for (let i = 0; i < 4096; i += 1) g[i] = h[i % 32]; return g.toString('base64'); },
    영상정보: () => ({ fps: 30, 길이: 20, 너비: 1080, 높이: 1920 }),
    // 가짜 ffmpeg — 띠 그림 내용은 영상 내용 + 칸 이름표(순간 초)로 정해진다(같은 영상 · 같은 순간 = 같은 바이트)
    ffmpeg: (args) => { const 밖 = args[args.length - 1]; if (/\.(jpg|png)$/.test(밖) && !/%/.test(밖)) { fs.writeFileSync(밖, `띠:${상태.영상내용}:${(String(args[args.indexOf('-filter_complex') + 1]).match(/text='[^']*'/g) || []).join(',')}`); if (상태.띠훅) 상태.띠훅(밖); } return ''; } };
  const 그림 = (n, 내용 = `그림-${n}`) => { const f = path.join(d, n); fs.writeFileSync(f, 내용); return f; };
  const 영상 = (내용 = 'V1') => { const v = path.join(편, 'video.mp4'); fs.writeFileSync(v, 내용.repeat(100)); 상태.영상내용 = 내용; return v; };
  const 기록 = (파일 = 관문.기록이름) => JSON.parse(fs.readFileSync(path.join(편, '게시', 파일), 'utf8'));
  const 있나 = (파일 = 관문.기록이름) => fs.existsSync(path.join(편, '게시', 파일));
  const 판정 = () => aestheticFindingsOf(편).map((f) => `${f.level}:${f.code}`);
  return { d, 편, 손, 상태, 그림, 영상, 기록, 있나, 판정 };
}
// 가짜 아르곤 — 화면마다 정하기(h)로 판정을 정해 답 파일을 쓴다. 부른 묶음을 적어 둔다
const 가짜아르곤 = (정하기, 부름 = []) => async (작업들) => {
  부름.push(작업들.map((w) => w.번호들));
  for (const w of 작업들) fs.writeFileSync(w.답, JSON.stringify({ 낱장: w.이.map((h) => ({ 번호: h.번호, 판정: 정하기(h), 점수: 5, 약점: [`${h.번호} 약점`] })), 쌍: [] }));
  return '';
};

test('P1-4 ⓐ 기각 컷을 빼고 다시 맹검해도 옛 기각은 「이번에 안 봄」으로 남는다 — --뺌 까닭이 있어야 빠지고, 뺀 컷 · 옛 판정 · 까닭이 기록에 남는다', async (t) => {
  t.mock.method(console, 'log', () => {});
  const 판 = 시험판(t, 'a1');
  const [첫, 가운데, 끝] = ['첫.png', '가운데.png', '끝.png'].map((n) => 판.그림(n));
  const 손 = { ...판.손, 아르곤부르기: 가짜아르곤((h) => (/나쁨/.test(h.설명) ? '기각' : '그대로 냄')) };
  assert.equal(await 맹검.main([`${첫}::첫 장면`, `${가운데}::가운데 나쁨`, `${끝}::끝 장면`, '--편', 판.편, '--이름', 'c1'], 손), 1);
  // 설계 17 「고친 컷만 다시 본다」를 글자 그대로 — 기각 컷을 빼고 나머지만 다시 넣는다(탐침 p2 C: 전에는 끝 코드 0 · ⑱ 지적 없음)
  assert.equal(await 맹검.main([`${첫}::첫 장면`, `${끝}::끝 장면`, '--편', 판.편, '--이름', 'c2'], 손), 1, '이번 목록에 없는 기각도 기록에 남아 끝 코드 1');
  const P = 판.기록();
  assert.deepEqual(P.화면.map((h) => `${h.번호}:${h.컷}${h.안봄 ? '(안봄)' : ''}`), ['01:첫', '02:끝', '03:가운데(안봄)']);
  const 옛 = P.낱장.find((x) => x.번호 === '03');
  assert.deepEqual([옛.판정, 옛.눈, 옛.안봄.이름], ['기각', '아르곤', 'c1'], '어디서 마지막으로 봤는지 함께');
  assert.deepEqual(판.판정(), ['고칠 것:aesthetic-reject']);
  assert.match(aestheticFindingsOf(판.편)[0].message, /03\(5점 · 이번에 안 봄\)/);
  // 한 번 더 빼도 안 봄 출처는 처음 그대로
  await 맹검.main([`${첫}::첫 장면`, `${끝}::끝 장면`, '--편', 판.편, '--이름', 'c3'], 손);
  assert.equal(판.기록().낱장.find((x) => x.안봄).안봄.이름, 'c1');
  // 정말 뺀다 — 까닭과 함께
  assert.equal(await 맹검.main([`${첫}::첫 장면`, `${끝}::끝 장면`, '--편', 판.편, '--이름', 'c4', '--뺌', '가운데=가운데 장면을 렌더에서 뺐다(편집 판 2)'], 손), 0);
  const P2 = 판.기록();
  assert.deepEqual(P2.화면.map((h) => h.컷), ['첫', '끝']);
  assert.deepEqual(P2.뺌.map((x) => [x.컷, x.판정, x.눈, x.까닭]), [['가운데', '기각', '아르곤', '가운데 장면을 렌더에서 뺐다(편집 판 2)']]);
  assert.deepEqual(판.판정(), ['확인할 것:aesthetic-history'], '뺀 기각은 ⑱이 내력으로 보인다');
  assert.match(aestheticFindingsOf(판.편)[0].message, /뺀 컷 1 — 가운데\(옛 기각\) 「가운데 장면을 렌더에서 뺐다/);
  assert.throws(() => 맹검.인자(['a.png', '--편', 'x', '--뺌', '가운데']), /--뺌은 "<옛 번호 또는 컷>=<까닭>"/);
  assert.throws(() => 맹검.인자(['a.png', '--뺌', '가운데=까닭']), /--편/);
});

test('P1-4 ⓐ 같은 그림을 이름만 바꿔 넣으면 지난 판정(기각)을 이어받고 다시 묻지 않는다 — 옛 컷은 「안 봄」으로 겹쳐 남지 않는다', async (t) => {
  t.mock.method(console, 'log', () => {});
  const 판 = 시험판(t, 'a2');
  const p = 판.그림('끝.png', 'same-bytes'), q = 판.그림('끝_v2.png', 'same-bytes');
  const 부름 = [];
  const 손 = { ...판.손, 아르곤부르기: 가짜아르곤(() => (부름.length === 1 ? '기각' : '그대로 냄'), 부름) };
  assert.equal(await 맹검.main([`${p}::끝 장면`, '--편', 판.편, '--이름', 'd1'], 손), 1);
  assert.equal(await 맹검.main([`${q}::끝 장면`, '--편', 판.편, '--이름', 'd2'], 손), 1, '탐침 p2 D: 전에는 새로 물어 「그대로 냄」이 옛 기각을 덮었다');
  assert.equal(부름.length, 1, '다시 부르지 않는다');
  const P = 판.기록();
  assert.deepEqual(P.화면.map((h) => h.컷), ['끝_v2']);
  assert.deepEqual([P.낱장[0].판정, P.낱장[0].이어받음.이름, P.낱장[0].이어받음.컷], ['기각', 'd1', '끝']);
  assert.deepEqual(판.판정(), ['고칠 것:aesthetic-reject']);
});

test('P1-4 ⓐ 다시 물어 지난 판정을 덮으면 「앞판정」이 남는다 — 같은 그림의 기각이 바뀌면 ⑱ 확인할 것, 고친 그림은 조용', async (t) => {
  t.mock.method(console, 'log', () => {});
  const 판 = 시험판(t, 'a3');
  const p = 판.그림('끝.png', '처음 그림');
  const 부름 = [];
  const 손 = { ...판.손, 아르곤부르기: 가짜아르곤(() => (부름.length === 1 ? '기각' : '그대로 냄'), 부름) };
  await 맹검.main([`${p}::끝 장면`, '--편', 판.편, '--이름', 'r1'], 손);
  assert.equal(await 맹검.main([`${p}::끝 장면`, '--편', 판.편, '--이름', 'r2', '--다시모두'], 손), 0);
  const x = 판.기록().낱장[0];
  assert.deepEqual([x.판정, x.눈, x.앞판정.판정, x.앞판정.이름, x.앞판정.같은그림], ['그대로 냄', '아르곤', '기각', 'r1', true]);
  assert.deepEqual(판.판정(), ['확인할 것:aesthetic-history']);
  assert.match(aestheticFindingsOf(판.편)[0].message, /같은 그림을 다시 물어 「기각」이 바뀐 컷 1 — 끝\(카본 기각 → 그대로 냄\)/);
  // 고친 그림(같은 컷 이름 · 다른 그림)이면 앞판정은 남되 같은그림 false — ⑱은 조용
  fs.writeFileSync(p, '고친 그림');
  await 맹검.main([`${p}::끝 장면`, '--편', 판.편, '--이름', 'r3'], 손);
  assert.equal(판.기록().낱장[0].앞판정.같은그림, false);
  assert.deepEqual(판.판정(), []);
});

test('P1-4 ⓐ 아르곤이 답 못 준 화면을 목록에서 빼도 「답 없음」과 막힌 증거가 「이번에 안 봄」으로 남는다', async (t) => {
  t.mock.method(console, 'log', () => {});
  const 판 = 시험판(t, 'a4');
  const f = ['첫.png', '가운데.png', '끝.png'].map((n) => 판.그림(n));
  const 인자 = f.map((x, i) => `${x}::장면 ${i + 1}`);
  await 맹검.main([...인자, '--편', 판.편, '--이름', 'm1'], { ...판.손, 줄꺼짐: () => ({ 꼴: '줄 꺼짐', 끈때: '2026-11-11 03:00:00', 첫줄: 'a 줄 끔(시험)' }) });
  assert.equal(await 맹검.main([인자[0], 인자[2], '--편', 판.편, '--이름', 'm2'], { ...판.손, 아르곤부르기: 가짜아르곤(() => '그대로 냄') }), 2, '지난 답 없음이 남아 끝 코드 2');
  const P = 판.기록();
  assert.deepEqual(P.빠짐, ['03']);
  assert.equal(P.화면[2].컷, '가운데');
  assert.deepEqual(P.막힘.map((m) => [m.화면, m.꼴, m.안봄]), [[['03'], '줄 꺼짐', true]]);
  assert.deepEqual(판.판정(), ['고칠 것:aesthetic-unverified'], '못 본 화면은 대체 눈이 덮어야 한다 — 빼서 통과하지 않는다');
});

test('P1-4 ⓐ ⓔ 지난정리: 다른 눈의 판정은 옮기지 않고, 대체 기록은 지금 아르곤 기록에 같은 컷이 다른 그림이면 옮기지 않으며, 못 찾은 --뺌은 무시(더 엄하다)', () => {
  const 지난 = { 기록: { 눈: 'gpt', 이름: 's1', 만든때: '2026-11-11T00:00:00Z', 화면: [{ 번호: '01', 컷: 'A', 지문: 'a' }, { 번호: '02', 컷: 'B', 지문: 'b' }, { 번호: '03', 컷: 'X', 지문: 'x1' }, { 번호: '04', 컷: 'Y', 지문: 'y' }],
    낱장: [{ 번호: '01', 판정: '그대로 냄' }, { 번호: '02', 판정: '기각', 눈: 'opus' }, { 번호: '03', 판정: '그대로 냄' }, { 번호: '04', 판정: '기각' }], 빠짐: [] }, 격자: new Map() };
  const 새 = [{ 번호: '01', 컷: 'A', 지문: 'a' }];
  const 아르곤 = { 기록: { 화면: [{ 번호: '01', 컷: 'X', 지문: 'x2' }, { 번호: '02', 컷: 'Y', 지문: 'y' }] }, 격자: new Map() };
  const r = 맹검.지난정리(새, 지난, { 눈: 'gpt', 뺌: [{ 대상: '없는컷', 까닭: '오타' }], 아르곤 });
  assert.deepEqual(r.남김화면.map((h) => [h.번호, h.컷]), [['02', 'Y']], 'B는 Opus 판정 — 안 옮김, X는 아르곤 기록에서 다시 그린 컷 — 안 옮김, Y는 같은 그림이라 옮김');
  assert.deepEqual(r.남김낱장.map((x) => [x.번호, x.판정, x.눈]), [['02', '기각', 'gpt']]);
  assert.deepEqual(r.안옮김, ['X']);
  assert.deepEqual(r.뺌못찾음, ['없는컷']);
  assert.equal(r.앞판정.get('01').판정, '그대로 냄');
  assert.deepEqual(맹검.지난정리(새, 지난, { 눈: 'gpt' }).남김화면.map((h) => h.컷), ['X', 'Y'], '아르곤 기록을 안 주면(아르곤 기록 파일) 대조 없이 옮긴다');
  assert.deepEqual(맹검.지난정리(새, 지난, { 눈: 'gpt', 뺌: [{ 대상: '04', 까닭: '옛 번호로도 뺀다' }] }).뺌.map((x) => [x.컷, x.번호, x.판정]), [['Y', '04', '기각']]);
  // 11-10 전 기록(판 없음 — 컷 이름 · 지문 없음)은 새 화면과 맞출 수 없어 모두 남긴다 — 옛 번호로 까닭과 함께 뺀다
  const 옛판 = { 기록: { 만든때: '2026-11-08T00:00:00Z', 이름: 'v1', 화면: [{ 번호: '01', 파일: 'LAB_x_1.jpg' }, { 번호: '02', 파일: 'LAB_x_2.jpg' }], 낱장: [{ 번호: '01', 판정: '기각' }, { 번호: '02', 판정: '그대로 냄' }], 빠짐: [] }, 격자: new Map() };
  const 옛r = 맹검.지난정리([{ 번호: '01', 컷: '순간@1.00', 지문: 'n1' }], 옛판, { 눈: '아르곤', 뺌: [{ 대상: '1', 까닭: '11-08 대표 프레임 판 — 띠 맹검으로 대신' }] });
  assert.deepEqual(옛r.뺌.map((x) => [x.번호, x.판정]), [['01', '기각']]);
  assert.deepEqual(옛r.남김화면.map((h) => [h.번호, h.옛번호, h.파일]), [['02', '02', 'LAB_x_2.jpg']]);
});

test('P1-4 ⓑ --영상 맹검은 순간 셋 · 첫 장면(앞 3초) · 끝 장면(끝 4초) — 못 채우면 멈추고, --순간예외 까닭은 기록에 남는다', async (t) => {
  t.mock.method(console, 'log', () => {});
  const 판 = 시험판(t, 'b');
  const v = 판.영상();
  const 손 = { ...판.손, 아르곤부르기: 가짜아르곤(() => '그대로 냄') };
  const 기본 = ['--영상', v, '--마스코트', '없음', '--편', 판.편];
  await assert.rejects(맹검.main([...기본, '--순간', '1', '--순간', '18'], 손), /순간 2개\(3개 이상\)/);
  await assert.rejects(맹검.main([...기본, '--순간', '5', '--순간', '10', '--순간', '18'], 손), /첫 장면 순간 없음/);
  await assert.rejects(맹검.main([...기본, '--순간', '1', '--순간', '10', '--순간', '15.9'], 손), /끝 장면 순간 없음\(끝 4초 안 — 16\.00초 뒤\)/, '실물 「화날때」 24.50초(28.6초 편)가 이 꼴');
  await assert.rejects(맹검.main([...기본, '--순간', '1', '--순간', '10', '--순간', '9999', '--순간예외', '까닭'], 손), /영상 길이 20\.00초 밖/, '영상 밖 순간은 까닭으로도 못 넘는다(끝 장면처럼 보이게)');
  assert.equal(판.있나(), false, '멈춘 실행은 기록을 쓰지 않는다');
  assert.equal(await 맹검.main([...기본, '--순간', '1', '--순간', '10', '--순간', '16', '--이름', 'b1'], 손), 0);
  assert.equal(판.기록().순간예외, undefined);
  assert.equal(await 맹검.main([...기본, '--순간', '0.5', '--순간', '10', '--순간예외', '끝 4초는 검은 화면뿐이다', '--이름', 'b2'], 손), 0);
  assert.deepEqual(판.기록().순간예외, { 까닭: '끝 4초는 검은 화면뿐이다', 모자람: ['순간 2개(3개 이상)', '끝 장면 순간 없음(끝 4초 안 — 16.00초 뒤)'] });
  assert.throws(() => 맹검.인자(['--영상', 'a.mp4', '--순간', '1', '--순간', '1.001']), /--순간이 겹친다/);
  assert.throws(() => 맹검.인자(['a.png', '--순간예외', 'x']), /--영상과 함께/);
  assert.deepEqual(맹검.순간모자람([{ 초: 1 }, { 초: 9 }, { 초: 17 }], 20.6), []);
  assert.throws(() => 맹검.순간모자람([{ 초: 1 }], 0), /길이를 못 읽었다/);
});

test('P1-4 ⓒ --영상을 줘도 그 영상의 띠를 다루지 않은 실행은 「영상」을 적지 않고, 띠를 본 실행은 띠를 뽑을 때 잰 크기 · 해시를 적는다', async (t) => {
  t.mock.method(console, 'log', () => {});
  const 판 = 시험판(t, 'c');
  const v = 판.영상('V1');
  const 표지 = 판.그림('표지.png');
  const 손 = { ...판.손, 아르곤부르기: 가짜아르곤(() => '그대로 냄') };
  assert.equal(await 맹검.main(['--영상', v, `${표지}::표지 한 장`, '--순간예외', '표지만 본다', '--편', 판.편, '--이름', 'c1'], 손), 0);
  assert.equal(판.기록().영상, undefined, '탐침 p2 A: 전에는 띠 없이도 「영상」이 적혀 ⑱이 그 영상만 봤다');
  assert.equal(await 맹검.main(['--영상', v, '--순간', '1', '--순간', '10', '--순간', '17', '--마스코트', '없음', '--편', 판.편, '--이름', 'c2'], 손), 0);
  const 영상칸 = 판.기록().영상;
  assert.deepEqual(영상칸.map((x) => [x.이름, x.크기, x.해시]), [['video.mp4', 200, crypto.createHash('sha256').update(fs.readFileSync(v)).digest('hex')]]);
  assert.ok(!JSON.stringify(영상칸).includes(판.d.replace(/\\/g, '\\\\')), '공개 기록에 이 PC 경로가 없다');
});

test('P1-4 ⓓ 띠를 뽑은 뒤(눈을 기다리는 사이) 영상이 다시 렌더되면 기록하지 않고 멈춘다 — 띠를 뽑는 사이 바뀌어도 멈춘다', async (t) => {
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'error', () => {});
  const 판 = 시험판(t, 'd');
  const v = 판.영상('OLD');
  const 순간 = ['--영상', v, '--순간', '1', '--순간', '10', '--순간', '17', '--마스코트', '없음', '--편', 판.편];
  const 다시렌더 = () => { fs.writeFileSync(v, 'NEWRENDER'.repeat(100)); 판.상태.영상내용 = 'NEW'; };
  const 손 = { ...판.손, 아르곤부르기: async (작업들) => { 다시렌더(); return 가짜아르곤(() => '그대로 냄')(작업들); } };
  assert.equal(await 맹검.main([...순간, '--이름', 'd1'], 손), 2, '탐침 p2 B: 전에는 새 판 크기를 적고 끝 코드 0 · ⑱ 통과');
  assert.equal(판.있나(), false, '편 기록을 쓰지 않는다');
  // 띠를 뽑는 사이에 바뀜
  판.영상('OLD');
  판.상태.띠훅 = (밖) => { if (/띠_2\.jpg$/.test(밖)) 다시렌더(); };
  await assert.rejects(맹검.main([...순간, '--이름', 'd2'], { ...판.손, 아르곤부르기: 가짜아르곤(() => '그대로 냄') }), /띠를 뽑는 사이 영상이 바뀌었다/);
  판.상태.띠훅 = null;
  // 안 바뀌면 띠를 뽑을 때 잰 값으로 기록
  판.영상('OLD');
  assert.equal(await 맹검.main([...순간, '--이름', 'd3'], { ...판.손, 아르곤부르기: 가짜아르곤(() => '그대로 냄') }), 0);
  assert.equal(판.기록().영상[0].크기, 300);
});

test('P1-4 ⓔ 대체 눈끼리 판정을 이어받지 않는다 — Opus 판정 뒤 --눈 gpt는 GPT를 실제로 부르고, 낱장마다 판정한 눈 · 실제 부른 시도만 적는다', async (t) => {
  t.mock.method(console, 'log', () => {});
  const 판 = 시험판(t, 'e');
  const f = ['첫.png', '끝.png'].map((n) => 판.그림(n));
  const 인자 = [`${f[0]}::첫 장면`, `${f[1]}::끝 장면`, '--편', 판.편];
  let gpt부름 = 0;
  const 손 = { ...판.손, 줄꺼짐: () => ({ 꼴: '줄 꺼짐', 끈때: '2026-11-11 03:00:00', 첫줄: 'a 줄 끔(시험)' }),
    GPT묻기: async ({ 글, 답파일 }) => { gpt부름 += 1; const 번호 = [...글.matchAll(/^- (\d\d): /gm)].map((m) => m[1]); const 답 = JSON.stringify({ 낱장: 번호.map((n) => ({ 번호: n, 판정: '기각', 점수: 3 })), 쌍: [] }); fs.writeFileSync(답파일, 답); return { 결과: '받음', 답, 초: 1 }; } };
  await 맹검.main([...인자, '--이름', 'p'], 손);
  assert.equal(await 맹검.main([...인자, '--이름', 'o', '--눈', 'opus'], 손), 4);
  const 폴더 = path.join(손.작업뿌리, 'o');
  const 묶음 = JSON.parse(fs.readFileSync(path.join(폴더, '묶음.json'), 'utf8'));
  for (const w of 묶음.묶음) fs.writeFileSync(path.join(폴더, w.답), JSON.stringify({ 재료: w.꼬리, 낱장: w.번호들.map((n) => ({ 번호: n, 판정: '그대로 냄', 점수: 9 })), 쌍: [] }));
  assert.equal(await 맹검.main(['--눈', 'opus', '--받기', 폴더, '--편', 판.편], 손), 0);
  assert.deepEqual(판.기록(관문.대체이름).낱장.map((x) => x.눈), ['opus', 'opus']);
  assert.equal(await 맹검.main([...인자, '--이름', 'g', '--눈', 'gpt'], 손), 1);
  assert.equal(gpt부름, 1, '탐침 p4 X1: 전에는 Opus 판정을 이어받아 GPT를 한 번도 안 부르고 「눈 gpt · 적중 5/8」로 적었다');
  const S = 판.기록(관문.대체이름);
  assert.equal(S.눈, 'gpt');
  assert.deepEqual(S.낱장.map((x) => [x.판정, x.눈, x.이어받음, x.앞판정?.눈]), [['기각', 'gpt', undefined, 'opus'], ['기각', 'gpt', undefined, 'opus']], 'Opus 판정은 흔적(앞판정)으로만');
  assert.deepEqual(S.시도.map((x) => [x.눈, x.결과]), [['opus', '받음'], ['gpt', '받음']]);
  // 같은 눈으로 다시 — 다 이어받으면 부르지 않고, 지어낸 시도도 없다
  assert.equal(await 맹검.main([...인자, '--이름', 'g2', '--눈', 'gpt'], 손), 1);
  assert.equal(gpt부름, 1);
  const S2 = 판.기록(관문.대체이름);
  assert.deepEqual(S2.시도.map((x) => [x.눈, x.결과]), [['opus', '받음'], ['gpt', '받음']], '부르지 않은 실행은 시도를 덧붙이지 않는다');
  assert.ok(S2.낱장.every((x) => x.눈 === 'gpt' && x.이어받음?.눈 === 'gpt'));
  // 탐침 p4 X2: 판정이 든 대체 기록 위에 --눈 opus --막힘 — 판정의 눈 · 만든때는 그대로, 시도만 덧붙는다
  t.mock.method(console, 'error', () => {});
  assert.equal(await 맹검.main(['--눈', 'opus', '--막힘', '하위 에이전트 한도', '--편', 판.편], 손), 2);
  const S3 = 판.기록(관문.대체이름);
  assert.deepEqual([S3.눈, S3.만든때, S3.낱장.length, S3.시도.at(-1).눈, S3.시도.at(-1).결과], ['gpt', S2.만든때, 2, 'opus', '막힘']);
});

test('P1-4 ⓔ GPT가 막힌 대체 기록에 Opus 막힘을 적으면 눈은 opus, GPT 적중은 남기지 않는다', async (t) => {
  t.mock.method(console, 'log', () => {});
  const 판 = 시험판(t, 'e2');
  const f = 판.그림('첫.png');
  const 손 = { ...판.손, 줄꺼짐: () => ({ 꼴: '줄 꺼짐', 끈때: '2026-11-11 03:00:00', 첫줄: 'a 줄 끔' }), GPT묻기: async () => ({ 결과: '막힘', 꼴: '계정 없음', 첫줄: '쓸 수 있는 굽기 계정이 없다', 초: 1 }) };
  await 맹검.main([f, '--편', 판.편, '--이름', 'a'], 손);
  await 맹검.main([f, '--편', 판.편, '--이름', 'g', '--눈', 'gpt'], 손);
  assert.ok(판.기록(관문.대체이름).적중);
  await 맹검.main(['--눈', 'opus', '--막힘', '하위 에이전트 한도', '--편', 판.편], 손);
  const S = 판.기록(관문.대체이름);
  assert.deepEqual([S.눈, S.적중], ['opus', undefined]);
  assert.deepEqual(판.판정(), ['고칠 것:aesthetic-swap']);
});

test('P1-4 ⓕ --눈 opus --받기는 재료의 편 · 화면 지문 · 답의 재료 표식을 대조하고 어긋나면 기록하지 않는다 — 답 파일 지문을 남긴다', async (t) => {
  t.mock.method(console, 'log', () => {});
  const 판 = 시험판(t, 'f');
  const 편2 = path.join(판.d, '편_다른'); fs.mkdirSync(편2);
  const f = ['첫.png', '끝.png'].map((n) => 판.그림(n));
  const 손 = { ...판.손, 줄꺼짐: () => ({ 꼴: '줄 꺼짐', 끈때: '2026-11-11 03:00:00', 첫줄: 'a 줄 끔' }) };
  const 인자 = [`${f[0]}::첫 장면`, `${f[1]}::끝 장면`];
  for (const e of [판.편, 편2]) await 맹검.main([...인자, '--편', e, '--이름', `p-${path.basename(e)}`], 손);
  assert.equal(await 맹검.main([...인자, '--편', 판.편, '--이름', 'o1', '--눈', 'opus'], 손), 4);
  const 폴더 = path.join(손.작업뿌리, 'o1');
  const 묶음 = JSON.parse(fs.readFileSync(path.join(폴더, '묶음.json'), 'utf8'));
  const 답쓰기 = (재료) => { for (const w of 묶음.묶음) fs.writeFileSync(path.join(폴더, w.답), JSON.stringify({ ...(재료 === undefined ? {} : { 재료 }), 낱장: w.번호들.map((n) => ({ 번호: n, 판정: '그대로 냄', 점수: 9 })), 쌍: [] })); };
  답쓰기(묶음.묶음[0].꼬리);
  await assert.rejects(맹검.main(['--눈', 'opus', '--받기', 폴더, '--편', 편2], 손), /다른 편/, '탐침 p2 E2: 전에는 다른 편 재료를 받아 그 편 ⑱이 확인할 것이 됐다');
  assert.equal(fs.existsSync(path.join(편2, '게시', 관문.대체이름)), false);
  답쓰기('엉뚱한표식');
  await assert.rejects(맹검.main(['--눈', 'opus', '--받기', 폴더, '--편', 판.편], 손), /재료」 엉뚱한표식/);
  답쓰기(undefined);
  await assert.rejects(맹검.main(['--눈', 'opus', '--받기', 폴더, '--편', 판.편], 손), /「재료」 없음/);
  const 화면01 = path.join(폴더, '화면01.png'), 원래 = fs.readFileSync(화면01);
  fs.writeFileSync(화면01, '바꿔치기');
  답쓰기(묶음.묶음[0].꼬리);
  await assert.rejects(맹검.main(['--눈', 'opus', '--받기', 폴더, '--편', 판.편], 손), /재료 그림이 만든 뒤 바뀌었거나 없다\(화면 01\)/);
  fs.writeFileSync(화면01, 원래);
  assert.equal(판.있나(관문.대체이름), false, '어긋난 받기는 하나도 기록하지 않았다');
  assert.equal(await 맹검.main(['--눈', 'opus', '--받기', 폴더, '--편', 판.편], 손), 0);
  const S = 판.기록(관문.대체이름);
  const 답파일 = path.join(폴더, 묶음.묶음[0].답);
  assert.deepEqual(S.답파일, [{ 묶음: 1, 파일: path.basename(답파일), 지문: crypto.createHash('sha1').update(fs.readFileSync(답파일)).digest('hex') }]);
  // 재료를 만든 뒤 아르곤 기록이 다른 그림으로 다시 적히면(다시 렌더 · 다시 맹검) 옛 재료의 답은 받지 않는다
  fs.writeFileSync(f[0], '다시 그린 첫 장면');
  await 맹검.main([...인자, '--편', 판.편, '--이름', 'p-다시'], 손);
  await assert.rejects(맹검.main(['--눈', 'opus', '--받기', 폴더, '--편', 판.편], 손), /지금 아르곤 기록의 같은 컷과 다른 그림이다\(첫\)/);
});

test('P1-4 ⓖ 답모으기는 묶음(한 대화 4장) 경계를 본다 — 묶음 밖 번호 · 다시 매긴 번호 · 묶음을 건넌 쌍은 버린다', async (t) => {
  const 번호들 = ['01', '02', '03', '04', '05', '06'], 묶음 = [['01', '02', '03', '04'], ['05', '06']];
  const 다 = (판정, ns) => ({ 낱장: ns.map((n) => ({ 번호: n, 판정, 점수: 5 })) });
  const g1 = 맹검.답모으기([다('그대로 냄', 번호들), null], 번호들, 묶음);
  assert.deepEqual([g1.낱장.map((x) => x.번호), g1.빠짐], [['01', '02', '03', '04'], ['05', '06']], '탐침 p3 G1: 묶음 1 답에 낀 05 · 06은 묶음 2 답이 아니다');
  assert.deepEqual(g1.묶음밖, [{ 묶음: 1, 번호: '05' }, { 묶음: 1, 번호: '06' }]);
  const g2 = 맹검.답모으기([다('기각', ['01', '02', '03', '04']), 다('그대로 냄', ['1', '2'])], 번호들, 묶음);
  assert.deepEqual(g2.낱장.map((x) => `${x.번호}:${x.판정}`), ['01:기각', '02:기각', '03:기각', '04:기각'], '탐침 p3 G2: 묶음 2가 01부터 다시 매긴 번호가 묶음 1 기각을 덮지 않는다');
  assert.deepEqual(g2.빠짐, ['05', '06']);
  const g3 = 맹검.답모으기([{ ...다('그대로 냄', ['01', '02', '03', '04']), 쌍: [{ 쌍: '04-05', 고름: '04' }, { 쌍: '01-02', 고름: '02' }] }, 다('그대로 냄', ['05', '06'])], 번호들, 묶음);
  assert.deepEqual(g3.쌍.map((p) => p.쌍), ['01-02']);
  assert.deepEqual(맹검.답모으기([다('그대로 냄', 번호들)], 번호들).빠짐, [], '묶음을 안 주면 예전처럼(적중시험 밖 옛 부름)');
  // 실행 흐름 — 다섯 장(대화 둘): 묶음 1 답이 05를 적고 묶음 2 눈이 번호를 01로 매기면 05는 답 못 받음(끝 코드 2)
  t.mock.method(console, 'log', () => {});
  const 판 = 시험판(t, 'g');
  const f = ['가', '나', '다', '라', '마'].map((n) => 판.그림(`${n}.png`));
  const 엉킨눈 = async (작업들) => {
    for (const w of 작업들) {
      const 낱장 = w.k === 1 ? ['01', '02', '03', '04', '05'].map((n) => ({ 번호: n, 판정: '그대로 냄', 점수: 8 })) : [{ 번호: '01', 판정: '기각', 점수: 2 }];
      fs.writeFileSync(w.답, JSON.stringify({ 낱장, 쌍: [] }));
    }
    return '';
  };
  assert.equal(await 맹검.main([...f, '--편', 판.편, '--이름', 'g1'], { ...판.손, 아르곤부르기: 엉킨눈 }), 2);
  const P = 판.기록();
  assert.deepEqual([P.낱장.map((x) => `${x.번호}:${x.판정}`), P.빠짐], [['01:그대로 냄', '02:그대로 냄', '03:그대로 냄', '04:그대로 냄'], ['05']]);
});

// ── 11-11 밤 Fable 5.2 다시 검수 P1-미1 · 미2 ──
// 작업 폴더를 저장소 .tmp/미학맹검 아래에 둔다 — 편 기록의 「결과」가 저장소 안 경로가 되어, 지난 격자를 작업 폴더에서 읽는 길(실제 쓰임)을 그대로 탄다.
// 임시 폴더에 두면 「결과」에 파일 이름만 남아 고치기 전 도구는 격자를 못 찾는다 — 격자 길이 시험 밖이던 까닭이고, 그 길에 P1-미1이 있었다.
function 저장소작업뿌리(t) {
  const 뿌리 = path.join(__dirname, '..', '.tmp', '미학맹검', `_시험-${process.pid}-${crypto.randomBytes(4).toString('hex')}`);
  fs.mkdirSync(뿌리, { recursive: true });
  t.after(() => fs.rmSync(뿌리, { recursive: true, force: true }));
  return 뿌리;
}
// 띠 그림을 「띠 파일 이름 : 영상 내용」으로 만드는 가짜 ffmpeg와, 바뀌지 않은 컷(안바뀐 — 다시 렌더해도 같은 장면)은 영상 내용을 빼고 재는 가짜 격자
const 띠손 = (판, 안바뀐 = []) => ({
  ffmpeg: (args) => { const 밖 = args[args.length - 1]; if (/\.(jpg|png)$/.test(밖) && !/%/.test(밖)) fs.writeFileSync(밖, `${path.basename(밖)}:${판.상태.영상내용}`); return ''; },
  격자: (f) => {
    const 글 = fs.readFileSync(f, 'utf8');
    const 열쇠 = 안바뀐.some((n) => 글.startsWith(`${n}:`)) ? 글.split(':')[0] : 글;
    const h = crypto.createHash('sha256').update(열쇠).digest(); const g = Buffer.alloc(4096); for (let i = 0; i < 4096; i += 1) g[i] = h[i % 32]; return g.toString('base64');
  },
});
const 막힌줄 = () => ({ 꼴: '줄 꺼짐', 끈때: '2026-11-11 03:00:00', 첫줄: 'a 줄 끔(시험)' });

test('P1-미1 두 눈이 같은 --이름을 써도, 다시 렌더한 뒤 대체 눈은 새 영상의 바뀐 컷을 실제로 본다 — 카본이 덮은 새 격자로 옛 판정을 이어받지 않는다', async (t) => {
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'error', () => {});
  const 판 = 시험판(t, '미1');
  const 작업뿌리 = 저장소작업뿌리(t);
  const 본 = []; // GPT에게 보낸 화면 번호들
  const 손 = { ...판.손, ...띠손(판, ['띠_1.jpg']), 작업뿌리, 줄꺼짐: 막힌줄,
    GPT묻기: async ({ 글, 답파일 }) => { const 번호 = [...글.matchAll(/^- (\d\d): /gm)].map((m) => m[1]); 본.push(번호); const 답 = JSON.stringify({ 낱장: 번호.map((n) => ({ 번호: n, 판정: 본.length === 1 ? '그대로 냄' : '기각', 점수: 5 })), 쌍: [] }); fs.writeFileSync(답파일, 답); return { 결과: '받음', 답, 초: 1 }; } };
  const v = 판.영상('V1');
  const 인자 = ['--영상', v, '--순간', '1', '--순간', '10', '--순간', '17', '--마스코트', '없음', '--편', 판.편, '--이름', '같은이름'];
  // 옛 영상: 카본 막힘 → GPT 대체(같은 이름)
  assert.equal(await 맹검.main(인자, 손), 2);
  assert.equal(await 맹검.main([...인자, '--눈', 'gpt'], 손), 0);
  assert.deepEqual(본, [['01', '02', '03']]);
  // 다시 렌더(첫 장면 띠는 그대로, 뒤 두 장면이 바뀜) → 카본 또 막힘(같은 이름 — 그 폴더의 카본 결과를 새 영상의 격자로 덮는다) → GPT 대체(같은 이름)
  판.영상('V2');
  assert.equal(await 맹검.main(인자, 손), 2);
  assert.equal(await 맹검.main([...인자, '--눈', 'gpt'], 손), 1, '바뀐 두 컷을 GPT가 실제로 봤다(이번 가짜 답은 기각)');
  assert.deepEqual(본, [['01', '02', '03'], ['02', '03']], '고치기 전: 카본이 덮은 새 격자를 제 옛 격자로 읽어 세 컷을 다 같은 컷으로 보고 GPT를 부르지 않았다 — 옛 판정이 새 영상 기록으로 적혔다');
  const S = 판.기록(관문.대체이름);
  assert.equal(S.영상[0].해시, crypto.createHash('sha256').update(fs.readFileSync(v)).digest('hex'), '기록의 영상은 새 영상');
  assert.deepEqual(S.낱장.map((x) => [x.번호, x.판정, Boolean(x.이어받음)]), [['01', '그대로 냄', true], ['02', '기각', false], ['03', '기각', false]], '안 바뀐 컷만 제 옛 판정을 이어받는다(제 기록이 본 그림의 격자로)');
  assert.deepEqual(판.판정(), ['확인할 것:aesthetic-substitute', '고칠 것:aesthetic-reject']);
  // 눈마다 결과 파일이 따로다 — 카본의 결과.json · GPT의 결과_gpt.json, 편 기록의 「결과」도 제 눈의 글을 가리킨다
  const 폴더 = path.join(작업뿌리, '같은이름');
  assert.deepEqual([JSON.parse(fs.readFileSync(path.join(폴더, '결과.json'), 'utf8')).눈, JSON.parse(fs.readFileSync(path.join(폴더, '결과_gpt.json'), 'utf8')).눈], ['아르곤', 'gpt']);
  assert.match(S.결과, /같은이름\/결과_gpt\.md$/);
  assert.match(판.기록().결과, /같은이름\/결과\.md$/);
});

test('P1-미1 격자는 그 기록이 판정한 바로 그 그림의 것일 때만 쓴다 — 작업 폴더의 결과가 다른 그림으로 덮였으면 버리고 다시 묻는다', async (t) => {
  t.mock.method(console, 'log', () => {});
  const 판 = 시험판(t, '미1b');
  const 작업뿌리 = 저장소작업뿌리(t);
  const 부름 = [];
  const 손 = { ...판.손, ...띠손(판, ['띠_1.jpg', '띠_2.jpg', '띠_3.jpg']), 작업뿌리, 아르곤부르기: 가짜아르곤(() => '그대로 냄', 부름) };
  const v = 판.영상('V1');
  const 인자 = ['--영상', v, '--순간', '1', '--순간', '10', '--순간', '17', '--마스코트', '없음', '--편', 판.편, '--이름', '한이름'];
  assert.equal(await 맹검.main(인자, 손), 0);
  assert.equal(부름.length, 1);
  // 다시 렌더해도 장면이 그대로면(격자 같음) 지난 판정을 이어받는다 — 격자 길이 살아 있다
  판.영상('V2');
  assert.equal(await 맹검.main(인자, 손), 0);
  assert.equal(부름.length, 1, '세 컷 다 격자가 같아 다시 묻지 않는다');
  const 지난 = 맹검.지난기록읽기(판.편, 관문.기록이름, { 작업: 작업뿌리 });
  assert.equal(지난.격자.size, 3, '기록의 화면과 컷 이름 · 파일 해시가 같은 격자');
  // 그 폴더의 결과 JSON이 다른 그림의 것으로 덮였다(다른 편 · 다른 실행이 같은 이름을 씀) — 컷 이름은 같아도 파일 해시가 달라 격자를 버린다
  const 결과파일 = path.join(작업뿌리, '한이름', '결과.json');
  const j = JSON.parse(fs.readFileSync(결과파일, 'utf8'));
  fs.writeFileSync(결과파일, JSON.stringify({ ...j, 화면: j.화면.map((h) => ({ ...h, 지문: 'f'.repeat(40) })) }));
  assert.equal(맹검.지난기록읽기(판.편, 관문.기록이름, { 작업: 작업뿌리 }).격자.size, 0);
  판.영상('V3');
  assert.equal(await 맹검.main(인자, 손), 0);
  assert.equal(부름.length, 2, '격자를 못 믿으면 파일 해시가 같을 때만 이어받는다 — 다시 렌더한 띠는 다시 묻는다');
});

test('P1-미2 대체 눈이 카본 기록과 다른 영상을 보면 부르지 않고 기록하지 않는다 — 컷 이름(순간@초)만 같은 다른 판 영상, 기다리는 사이 카본 기록이 바뀐 때도', async (t) => {
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'error', () => {});
  const 판 = 시험판(t, '미2');
  let gpt부름 = 0, 사이 = null;
  const 손 = { ...판.손, ...띠손(판), 줄꺼짐: 막힌줄,
    GPT묻기: async ({ 글, 답파일 }) => { gpt부름 += 1; if (사이) 사이(); const 번호 = [...글.matchAll(/^- (\d\d): /gm)].map((m) => m[1]); const 답 = JSON.stringify({ 낱장: 번호.map((n) => ({ 번호: n, 판정: '그대로 냄', 점수: 8 })), 쌍: [] }); fs.writeFileSync(답파일, 답); return { 결과: '받음', 답, 초: 1 }; } };
  const v = 판.영상('V1'); // 카본에게 보인 영상(판본 영상)
  const 다른 = path.join(판.편, '게시', '01-ig', 'video.mp4'); // 같은 편의 다른 판 영상 — 한 편에 video.mp4가 판마다 있다
  fs.mkdirSync(path.dirname(다른), { recursive: true }); fs.writeFileSync(다른, 'OTHER'.repeat(100));
  const 순간 = ['--순간', '1', '--순간', '10', '--순간', '17', '--마스코트', '없음', '--편', 판.편];
  assert.equal(await 맹검.main(['--영상', v, ...순간, '--이름', 'p'], 손), 2, '카본 막힘');
  // GPT에게 다른 영상을 — 컷 이름은 셋 다 같다
  판.상태.영상내용 = 'OTHER';
  await assert.rejects(맹검.main(['--영상', 다른, ...순간, '--이름', 'g', '--눈', 'gpt'], 손), /대체 눈에게 보일 화면이 지금 카본 기록의 같은 컷과 다른 그림이다\(순간@1\.00, 순간@10\.00, 순간@17\.00\)/);
  assert.equal(gpt부름, 0, '고치기 전: GPT를 부르고 그 판정을 대체 기록으로 적어 ⑱이 「확인할 것」으로 받았다');
  assert.equal(판.있나(관문.대체이름), false);
  assert.deepEqual(판.판정(), ['고칠 것:aesthetic-unverified']);
  // Opus 재료도 만들 때 멈춘다(받을 때까지 가지 않는다)
  await assert.rejects(맹검.main(['--영상', 다른, ...순간, '--이름', 'o', '--눈', 'opus'], 손), /같은 컷과 다른 그림이다/);
  // 대체 눈의 답을 기다리는 사이 카본 기록이 다른 그림으로 다시 적혔다 — 답은 받았어도 기록하지 않는다
  판.상태.영상내용 = 'V1';
  사이 = () => { const f = path.join(판.편, '게시', 관문.기록이름); const P = JSON.parse(fs.readFileSync(f, 'utf8')); P.화면[0].지문 = '0'.repeat(40); fs.writeFileSync(f, JSON.stringify(P)); };
  assert.equal(await 맹검.main(['--영상', v, ...순간, '--이름', 'g2', '--눈', 'gpt'], 손), 2);
  assert.equal(gpt부름, 1);
  assert.equal(판.있나(관문.대체이름), false, '지금 카본 기록의 화면 것이 아닌 답은 적지 않는다');
  // 카본이 본 영상 그대로면 받는다
  사이 = null;
  assert.equal(await 맹검.main(['--영상', v, ...순간, '--이름', 'p2'], 손), 2, '카본 다시(막힘)');
  assert.equal(await 맹검.main(['--영상', v, ...순간, '--이름', 'g3', '--눈', 'gpt'], 손), 0);
  assert.deepEqual(판.판정(), ['확인할 것:aesthetic-substitute']);
});
