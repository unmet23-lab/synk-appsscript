'use strict';
/* `tools/릴대사밀도.js` 회귀 — 이 자가 실제로 «무는지» 잰다.
 *
 * 🔴 이 시험이 지키는 것은 결과 숫자가 아니라 **자가 눈이 머는 두 자리**다. 지을 때 둘 다 밟았다:
 *   ① 편 제목 꼴이 셋인데 하나만 보면 네 벌이 조용히 0 이 되고, 그 0 이 「굵은 화 없음」과
 *      똑같은 얼굴을 한다. → 못 찾으면 종료코드 2(«못 쟀다»)여야 하고 0(통과)이면 안 된다.
 *   ② 클로징까지 같이 세면 자가 거짓 빨강을 낸다. → 클로징만 긴 화는 통과해야 한다.
 * 실물 대본을 안 건드린다 — mkdtempSync 로 임시 뿌리를 만들고 끝나면 지운다. */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { 검사, 대본재기, 편번호 } = require('../tools/릴대사밀도.js');

function 픽스처(t) {
  const 뿌리 = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'synk-밀도-'));
  t.after(() => { try { fs.rmSync(뿌리, { recursive: true, force: true }); } catch (_) { /* 청소 실패는 판정이 아니다 */ } });
  return { 뿌리, 쓰기: (이름, 글) => fs.writeFileSync(path.join(뿌리, 이름), 글, 'utf8') };
}

/** 한국어 음절 n개짜리 대사 줄. 「가」를 n번 쓴다. */
const 대사 = (n, 클로징 = false) => `- ${클로징 ? '(클로징) ' : ''}"${'가'.repeat(n)}"\n`;

test('편 제목 꼴 셋을 모두 찾는다', () => {
  assert.equal(편번호('## 3편 — "저는 ~예요"'), '3');
  assert.equal(편번호('## 클립 3 — 짱'), '3');
  assert.equal(편번호('## 3. ㅇㅈ — 두 글자로 맞장구'), '3');
  assert.equal(편번호('## 머리말'), null);
  assert.equal(편번호('### 3편'), null, '세 겹 제목은 편이 아니다');
});

test('교육 대사와 클로징을 갈라 센다', () => {
  const 편들 = 대본재기(`## 1편 — 가\n${대사(60)}${대사(30, true)}`);
  assert.equal(편들.length, 1);
  assert.equal(편들[0].교육, 60);
  assert.equal(편들[0].클로징, 30);
  // 남는 초 = 18 − 30/6 = 13 → 60/13 = 4.615…
  assert.ok(Math.abs(편들[0].밀도 - 60 / 13) < 1e-9);
});

test('표 줄·메모 줄은 안 센다 — 대사 줄만 센다', () => {
  const 편들 = 대본재기('## 1편 — 가\n| 상황 | "가가가가가" |\n> "가가가가가"\n**표현**: "가가가가가"\n' + 대사(10));
  assert.equal(편들[0].교육, 10, '따옴표가 있어도 「- 」로 시작하지 않으면 대사가 아니다');
});

test('굵은 화가 있으면 종료코드 1 이고 그 화를 이름 대어 낸다', (t) => {
  const f = 픽스처(t);
  f.쓰기('01_견본.md', `## 1편 — 가\n${대사(150)}`);
  const r = 검사({ 뿌리: f.뿌리 });
  assert.equal(r.종료코드, 1);
  assert.ok(r.출력.some((줄) => 줄.includes('01편 1화')), '굵은 화의 이름이 나와야 한다');
  assert.equal(r.셈.굵은화수, 1);
});

test('클로징만 긴 화는 통과한다 — 클로징까지 세면 거짓 빨강이 난다', (t) => {
  const f = 픽스처(t);
  // 교육 80 + 클로징 60 = 140음절. 합쳐 세면 140/18 = 7.78 로 빨개진다.
  // 갈라 세면 남는 초 = 18 − 10 = 8 → 80/8 = 10.0 … 이것도 빨갛다. 그래서 교육을 줄여 잡는다.
  f.쓰기('01_견본.md', `## 1편 — 가\n${대사(50)}${대사(60, true)}`);
  const r = 검사({ 뿌리: f.뿌리 });
  // 갈라 센 판: 남는 초 8 → 50/8 = 6.25 (통과) · 합쳐 센 판: 110/18 = 6.11 도 통과라 구별이 안 된다.
  assert.equal(r.종료코드, 0);
  assert.equal(r.셈.굵은화수, 0);
});

test('🔴 편을 하나도 못 찾으면 종료코드 2 다 — 0(통과)이 아니다', (t) => {
  const f = 픽스처(t);
  f.쓰기('01_견본.md', '# 제목만 있고 편이 없다\n- "가가가가가"\n');
  const r = 검사({ 뿌리: f.뿌리 });
  assert.equal(r.종료코드, 2, '못 찾은 것을 통과로 내면 네 벌이 조용히 샌다');
  assert.equal(r.셈, null, '못 쟀을 때 셈은 null 이지 0 이 아니다');
  assert.ok(r.출력.some((줄) => 줄.includes('안 재봤다')));
});

test('🔴 못 잰 파일이 하나라도 있으면 나머지가 다 통과여도 종료코드 2 다', (t) => {
  const f = 픽스처(t);
  f.쓰기('01_성한것.md', `## 1편 — 가\n${대사(80)}`);
  f.쓰기('02_깨진것.md', '편 제목이 없다\n');
  const r = 검사({ 뿌리: f.뿌리 });
  assert.equal(r.종료코드, 2);
});

test('대본 폴더가 없거나 비면 확인 불가다', (t) => {
  const f = 픽스처(t);
  assert.equal(검사({ 뿌리: path.join(f.뿌리, '없는폴더') }).종료코드, 2);
  assert.equal(검사({ 뿌리: f.뿌리 }).종료코드, 2, '대본 0벌은 「굵은 화 0」이 아니다');
});

test('저장소 실물 대본 아홉 벌이 상한 아래다', () => {
  const r = 검사({});
  assert.equal(r.종료코드, 0, `굵은 화가 있다:\n${r.출력.join('\n')}`);
  assert.equal(r.셈.대본수, 9);
  assert.equal(r.셈.화수, 45);
});
