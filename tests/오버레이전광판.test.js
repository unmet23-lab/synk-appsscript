#!/usr/bin/env node
/* 라디오24 전광판 회귀 — `bots/오버레이/전광판판정.js` + `전광판.html`
 *
 * 무엇을 지키나: 전광판은 **공개 방송 화면**이라 한 번 오른 것은 되돌릴 수 없다.
 *   설계 §3(신원 철칙)·§8(개인 순위·성적 영구 금지)·정답 유출 금지는 지금까지 **산문으로만** 있었고
 *   기계 실체가 0이었다(08-13 분리 반박 ② — 「공개 표면 코드 0 · 게이트는 P3 렌더러 몫」).
 *   그 몫을 이 스위트가 진다.
 *
 * 어디서 재나: 판정은 순수 모듈에서(값으로), 화면은 파일 검사로(그리는 통로가 textContent 인가).
 *   화면 자체(DOM·모션)는 회귀가 원리상 못 닿는 층이라 **거기 판정을 두지 않은 것**이 규격이다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const 뿌리 = path.resolve(__dirname, '..');
const 판정 = require(path.join(뿌리, 'bots', '오버레이', '전광판판정.js'));
const 화면경로 = path.join(뿌리, 'bots', '오버레이', '전광판.html');
const 마스코트경로 = path.join(뿌리, 'bots', '오버레이', '마스코트.html');
const 화면 = fs.readFileSync(화면경로, 'utf8');

const 라운드 = (덧붙임) => Object.assign({
  종류: '라운드',
  지시문: '빈칸에 알맞은 것',
  보기들: [{ option_id: 'A', label: '을' }, { option_id: 'B', label: '에' }],
}, 덧붙임 || {});

/* ── §3 신원 철칙 · §8 개인 성적 — 사건 «전체»를 버린다 ───────────────── */

test('🔴 금지칸이 실리면 사건 전체를 버린다 — 그 칸만 지우고 그리면 보낸 쪽 결함이 화면에선 정상으로 보인다', () => {
  for (const 칸 of ['student_code', '실명', '급수', '순위', '점수', '정답률']) {
    const r = 판정.정규화({ 종류: '체크인', 닉네임: '별', [칸]: '무엇이든' });
    assert.strictEqual(r.ok, false, `${칸} 이 통과했다 — 공개 화면에 오른다`);
    assert.ok(r.사유.includes(칸), '사유가 어느 칸인지 말해야 보낸 쪽을 고친다');
  }
});

test('🔴 금지칸은 중첩돼 있어도 찾는다 — 봉투 한 겹만 보면 새는 방향이 「통과」다', () => {
  const r = 판정.정규화({ 종류: '정답', 정답: 'A', 메타: { 원본: { 학생코드: 'S-1' } } });
  assert.strictEqual(r.ok, false);
  assert.ok(r.사유.includes('학생코드'));
});

test('거짓양성 0 — 집단 합산 칸(진화레벨합·응답수)은 금지칸에 안 걸린다', () => {
  const a = 판정.정규화({ 종류: '합산', 맞힌문제: 12, 진화레벨합: 400, 체크인주간: 9 });
  assert.strictEqual(a.ok, true, '「레벨」·「수」가 든 이름을 부분일치로 물면 전광판이 통째로 죽는다');
  const b = 판정.정규화({ 종류: '정답', 정답: 'B', 응답수: 29, 분포: { A: 4, B: 21 } });
  assert.strictEqual(b.ok, true);
  assert.strictEqual(b.값.응답수, 29);
});

/* ── 허용 목록 — 슬럼프는 화면에 되쏘지 않는다(§2 I-2) ─────────────────── */

test('🔴 슬럼프는 허용 목록에 없다 — 공개 화면 되쏘기 금지', () => {
  assert.ok(!판정.허용사건.includes('슬럼프'));
  assert.strictEqual(판정.정규화({ 종류: '슬럼프', 닉네임: '별' }).ok, false);
});

test('모르는 종류는 조용히 버린다(사유는 남긴다)', () => {
  const r = 판정.정규화({ 종류: '무엇인가' });
  assert.strictEqual(r.ok, false);
  assert.ok(r.사유.includes('무엇인가'));
});

/* ── 정답 유출 — 라운드 «열림» 에 정답이 실려 오면 떼고 «드러낸다» ─────── */

test('🔴 라운드 열림에 실린 정답은 값에서 사라진다 — 그리고 경고가 남는다(침묵 금지)', () => {
  const r = 판정.정규화(라운드({ 정답: 'B', 해설: '조사 「에」' }));
  assert.strictEqual(r.ok, true, '버리면 방송이 빈다 — 살리되 떼는 것이 규격이다');
  assert.strictEqual(r.값.정답, undefined);
  assert.strictEqual(r.값.해설, undefined);
  assert.strictEqual(r.경고.length, 2, '떼기만 하고 조용하면 보낸 쪽이 영영 안 고쳐진다');
});

test('정답 공개는 정답 칸이 있어야 그린다 — 빈 공개는 안 그린다', () => {
  assert.strictEqual(판정.정규화({ 종류: '정답', 분포: { A: 1 } }).ok, false);
  assert.strictEqual(판정.정규화({ 종류: '정답', 정답: 'A' }).ok, true);
});

/* ── 채팅 원문이 그대로 오는 자리 — 길이·제어문자 ────────────────────── */

test('🔴 흔드는 문자(제어·제로폭·양방향)는 공백으로 바뀐다 — 한 글자가 방송 한 줄을 뒤집는다', () => {
  const 더러운 = 'ㄱ' + String.fromCharCode(0x0007) + 'ㄴ'
    + String.fromCharCode(0x200B) + 'ㄷ' + String.fromCharCode(0x202E) + 'ㄹ';
  const s = 판정.닉네임(더러운);
  for (const 글자 of s) assert.ok(!판정.흔드나(글자.codePointAt(0)), '흔드는 문자가 남았다: ' + s);
});

test('닉네임 24자 상한 — 전광판 한 줄을 넘기면 잘라 표시한다', () => {
  const s = 판정.닉네임('가'.repeat(80));
  assert.strictEqual(s.length, 24);
  assert.ok(s.endsWith('…'), '잘린 것을 잘렸다고 보여야 한다');
});

test('닉네임이 비면 그 사건은 안 그린다 — §3 이 허용한 표기는 닉네임 하나뿐이다', () => {
  assert.strictEqual(판정.정규화({ 종류: '연동', 닉네임: '   ' }).ok, false);
});

test('보기는 6개까지 · 빈 보기는 버리고 · 보기가 0이면 카드를 안 올린다', () => {
  const 많이 = Array.from({ length: 9 }, (_, i) => ({ option_id: 'O' + i, label: '보기' + i }));
  assert.strictEqual(판정.정규화(라운드({ 보기들: 많이 })).값.보기들.length, 6);
  assert.strictEqual(판정.정규화(라운드({ 보기들: [{ option_id: 'A' }] })).ok, false);
});

/* ── 「모름」과 「0」을 가른다 (F207) ─────────────────────────────────── */

test('🔴 합산은 못 읽으면 null 이다 — 0 으로 접으면 «안 잰 것»이 «실적 0» 으로 둔갑한다', () => {
  const r = 판정.정규화({ 종류: '합산', 맞힌문제: 'x', 진화레벨합: -5, 체크인주간: 0 });
  assert.strictEqual(r.값.맞힌문제, null);
  assert.strictEqual(r.값.진화레벨합, null, '음수는 합산일 수 없다');
  assert.strictEqual(r.값.체크인주간, 0, '진짜 0 은 0 으로 남아야 한다');
});

test('마감초는 1~600 밖이면 v1 기본 60초로 — 방송이 멈추거나 영원히 열려 있지 않게', () => {
  assert.strictEqual(판정.정규화(라운드({ 마감초: 0 })).값.마감초, 60);
  assert.strictEqual(판정.정규화(라운드({ 마감초: 99999 })).값.마감초, 60);
  assert.strictEqual(판정.정규화(라운드({ 마감초: 45 })).값.마감초, 45);
});

/* ── 화면 파일 — 그리는 통로가 안전한가 ─────────────────────────────── */

test('🔴 전광판.html 은 innerHTML 통로를 안 쓴다 — 채팅 원문이 그대로 오는 자리다', () => {
  for (const 통로 of ['.innerHTML', '.outerHTML', 'insertAdjacentHTML', 'document.write', 'eval(']) {
    assert.ok(!화면.includes(통로), `위험한 통로가 있다: ${통로}`);
  }
  assert.ok(화면.includes('textContent'), '그리는 통로가 textContent 여야 한다');
});

test('전광판.html 이 판정 모듈을 실제로 싣는다 — 안 실으면 화면이 판정 없이 그린다', () => {
  assert.ok(화면.includes('src="전광판판정.js"'));
  assert.ok(화면.includes('window.전광판판정'));
});

test('🔴 노출 확인을 내보낸다 — shown_at 은 「화면에 나간 시각」이라 화면만이 그 값을 안다', () => {
  assert.ok(화면.includes("종류: '노출'"), '노출 확인이 없으면 적는 쪽이 shown_at 을 지어내게 된다');
  assert.ok(화면.includes("종류: '마감확인'"));
  assert.ok(화면.includes("BroadcastChannel('라디오전광판')"), '확인은 입력과 «다른» 문으로 나간다(되먹임 금지)');
});

test('🔴 몽골어를 지어내지 않는다 — 판정·화면 어디에도 키릴이 없다', () => {
  const 키릴 = /[Ѐ-ӿ]/;
  const 판정원문 = fs.readFileSync(path.join(뿌리, 'bots', '오버레이', '전광판판정.js'), 'utf8');
  assert.ok(!키릴.test(판정원문), '몽골어 문안은 검수를 거쳐 들어온다(자막카드 팩과 같은 규칙)');
  assert.ok(!키릴.test(화면));
  assert.ok(판정.몽골어대기().length > 0, '검수 대기 목록이 비면 이 규칙이 조용히 사라진 것이다');
});

test('병기 — 몽골어 칸이 비면 한국어만 낸다(빈 구분자·괄호를 남기지 않는다)', () => {
  const s = 판정.병기('합산제목');
  assert.strictEqual(s, 판정.문안.합산제목.ko);
  assert.ok(!s.includes('·'), '몽골어가 없는데 구분자만 남으면 화면에 부스러기가 뜬다');
});

/* ── 두 오버레이가 같은 문을 쓴다 — 어휘가 갈리면 조용히 안 반응한다 ──── */

test('🔴 마스코트로 보내는 사건 이름은 마스코트.html 이 아는 것뿐이다 (두 파일 대조)', () => {
  const 마스코트 = fs.readFileSync(마스코트경로, 'utf8');
  const m = /const 최대지속 = \{([^}]*)\}/.exec(마스코트);
  assert.ok(m, '마스코트.html 의 허용목록(최대지속)을 못 찾았다 — 대조가 무효다');
  const 마스코트허용 = new Set(m[1].split(',').map((조각) => 조각.split(':')[0].trim()).filter(Boolean));
  assert.ok(마스코트허용.size >= 3, '허용목록 파싱이 비었다 — 0건 초록을 통과로 읽지 않는다');
  for (const [사건, 반응] of Object.entries(판정.마스코트표)) {
    assert.ok(마스코트허용.has(반응), `전광판이 «${사건}» 을 «${반응}» 로 보내는데 마스코트는 그 이름을 모른다`);
    assert.ok(판정.허용사건.includes(사건), `마스코트표에 전광판이 모르는 사건이 있다: ${사건}`);
  }
});

test('마스코트가 모르는 사건(합산·마감)은 매핑에 없다 — 없는 반응을 부르지 않는다', () => {
  assert.strictEqual(판정.마스코트표.합산, undefined);
  assert.strictEqual(판정.마스코트표.마감, undefined);
});
