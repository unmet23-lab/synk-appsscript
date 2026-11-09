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

test('줄꺼짐: 공용 차례의 gemini-a.off가 있으면 끈 때 · 끝 줄을 막힘으로(미학맹검은 a 줄만 선다)', (t) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), '줄꺼짐-')); t.after(() => fs.rmSync(d, { recursive: true, force: true }));
  const 차례 = path.join(d, '차례.py');
  assert.equal(맹검.줄꺼짐(차례), null);
  fs.writeFileSync(path.join(d, 'gemini-a.off'), '11-08 07:41 공모전 관리 세션: a 줄 끔\n');
  const m = 맹검.줄꺼짐(차례);
  assert.equal(m.꼴, '줄 꺼짐');
  assert.match(m.첫줄, /a 줄 끔/);
  assert.equal(관문.막힘됨(m), true);
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

function aestheticFindingsOf(편) {
  let prep = {};
  try { prep = JSON.parse(fs.readFileSync(path.join(편, '게시', '준비.json'), 'utf8')); } catch { /* 없다 */ }
  return 관문.aestheticFindings({ dir: 편, prep }, []);
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
  fs.writeFileSync(답파일, JSON.stringify({ 낱장: [{ 번호: '01', 판정: '기각', 점수: 3, 약점: ['떠 있는 잎'] }], 쌍: [] }));
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
