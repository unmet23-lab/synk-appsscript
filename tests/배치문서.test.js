'use strict';
/* 배치표 ↔ 사람이 읽는 문서 — 2026-09-05
 *
 * 무엇을 지키나: **적어 둔 것과 실제로 도는 것이 갈라지면 운다.**
 *
 * 왜 이 자가 생겼나. 09-04 저녁에 배치표(`tools/모델정책.js`)와 문서(`docs/AI배치_판정_v2.md`)가
 * 갈라졌고, **갈라졌는지 재는 자가 하나도 없어서** 하루가 지나도록 아무도 몰랐다:
 *   · 유호님이 09-04 에 「과제·퀴즈는 클로드로」 확정하신 것이 문서에만 적혔다.
 *     그동안 기계에 물으면 「제미나이」가 나왔다.
 *   · 문서가 새 자리를 표 «중간»에 끼워 넣어 뒤 번호가 통째로 밀렸다.
 *
 * 이름표(키)와 자리 목록은 `모델정책.test.js` 가 지킨다. **이 파일은 그 다음 층**을 지킨다 —
 * 「사람이 읽는 판이 기계에서 나온 그대로인가」와 「공짜로 도나를 계산이 답하는가」.
 *
 * 🔑 문서 비교는 «글자»가 아니라 «지금 뽑아낸 것»과 한다. 글자를 비교하면 서식만 바꿔도 빨개지고,
 *   그러면 이 자는 곧 꺼진다.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const ROOT = path.resolve(__dirname, '..');
const 정책 = require(path.join(ROOT, 'tools', '모델정책.js'));
const 문서경로 = path.join(ROOT, 'docs', 'AI배치_판정_v2.md');

// ───────────────────────────────── ① 문서 — 코드에서 나온 그대로인가

test('🔴 문서의 배치표 구역이 «지금 코드»와 같다 — 갈라지면 여기서 운다(09-04 는 이 자가 없어 하루를 갔다)', () => {
  assert.ok(fs.existsSync(문서경로), `${문서경로} 가 없다 — 정본 문서가 사라졌다`);
  const 결과 = 정책.문서대조(문서경로);
  assert.ok(결과.같나,
    `${결과.왜}\n        고치는 법: node tools/모델정책.js --문서심기 docs/AI배치_판정_v2.md`);
});

test('🔑 다시 쓰기는 멱등이다 — 안 바뀌었는데 파일을 건드리면 diff 가 매번 더러워진다', () => {
  const 임시 = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'synk-배치문서-')), '판정.md');
  fs.writeFileSync(임시, `앞글\n\n${정책.배치문서마커.시작} -->\n${정책.배치문서마커.끝}\n\n뒷글\n`);
  assert.strictEqual(정책.문서심기(임시).바뀜, true, '첫 심기가 아무것도 안 썼다');
  assert.strictEqual(정책.문서심기(임시).바뀜, false, '두 번째 심기가 또 썼다 — 멱등이 아니다');
  const 글 = fs.readFileSync(임시, 'utf8');
  assert.ok(글.startsWith('앞글') && 글.trimEnd().endsWith('뒷글'), '마커 «밖»의 글을 건드렸다');
  fs.rmSync(path.dirname(임시), { recursive: true, force: true });
});

test('🔴 줄끝(CRLF)이 달라도 «같다»고 답한다 — 09-05 에 이 자가 거짓 빨강을 냈다', () => {
  /* 실측: 합치기 직후 문서 구역은 CRLF 인데(git 이 윈도에서 그렇게 체크아웃한다) 뽑는 쪽은 LF 라,
   * **내용이 한 글자도 안 다른데** 「갈라졌다」가 떴다. 거짓 빨강은 자를 죽인다 —
   * 몇 번 겪으면 사람이 그 자를 안 믿고, 그때부터 진짜 갈라짐도 안 보인다. */
  const 임시 = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'synk-배치문서-')), 'crlf.md');
  fs.writeFileSync(임시, `앞글\n\n${정책.배치문서마커.시작} -->\n${정책.배치문서마커.끝}\n`);
  정책.문서심기(임시);
  const LF판 = fs.readFileSync(임시, 'utf8');
  fs.writeFileSync(임시, LF판.replace(/\n/g, '\r\n'));            // 줄끝만 바꾼다 — 내용은 그대로
  assert.ok(정책.문서대조(임시).같나, '줄끝만 다른데 갈라졌다고 답했다 — 거짓 빨강이다');
  assert.strictEqual(정책.문서심기(임시).바뀜, false, '줄끝만 다른 파일을 다시 썼다 — diff 가 매번 더러워진다');
  assert.ok(fs.readFileSync(임시, 'utf8').includes('\r\n'), '그 파일이 쓰던 줄끝을 안 지켰다');
  fs.rmSync(path.dirname(임시), { recursive: true, force: true });
});

test('🔴 마커가 없는 파일은 거절한다 — 조용히 끝에 붙이면 어느 문서에 붙었는지 아무도 모른다', () => {
  const 임시 = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'synk-배치문서-')), '마커없음.md');
  fs.writeFileSync(임시, '마커가 없는 글\n');
  assert.throws(() => 정책.문서심기(임시), /마커가 없다/);
  assert.strictEqual(fs.readFileSync(임시, 'utf8'), '마커가 없는 글\n', '거절했는데 파일을 건드렸다');
  fs.rmSync(path.dirname(임시), { recursive: true, force: true });
});

test('🔴 갈래를 새로 만들고 제목을 안 적으면 거절한다 — 조용히 빠지면 그 자리가 문서에서 사라진다', () => {
  /* 「0건이 성공 얼굴」 무늬를 막는다: 갈래 이름을 새로 쓰면 그 갈래의 자리들이 표에서 통째로
   * 빠지는데, 표는 여전히 그럴싸하게 렌더된다. 그래서 뽑는 쪽이 «먼저» 멈춘다. */
  const 원래 = 정책.배치표[0].갈래;
  정책.배치표[0].갈래 = '없는갈래';
  try {
    assert.throws(() => 정책.배치문서(), /갈래제목 에 없는 갈래/);
  } finally {
    정책.배치표[0].갈래 = 원래;
  }
  assert.ok(정책.배치문서().includes('가 · 설계와 판단'), '되돌린 뒤에도 표가 안 나온다');
});

// ───────────────────────────────── ② 「공짜로 도나」는 계산이 답한다

test('🔴 돈 열쇠 판정은 «한 판의 크기»로 계산한다 — 손으로 적으면 같은 크기를 다르게 적는다(09-04 사고)', () => {
  const 하루 = 정책.제미나이공짜몫.하루;
  assert.strictEqual(정책.돈열쇠판정({ 한판요청수: 하루 + 1 }).필요, true, '하루 몫을 넘는데 공짜로 열려 있다');
  assert.strictEqual(정책.돈열쇠판정({ 한판요청수: 하루 }).필요, false, '하루 몫 안인데 돈을 요구한다');
  assert.strictEqual(정책.돈열쇠판정({ 공짜몫없음: true }).필요, true, '무료 등급이 없는 모델을 공짜로 열었다');
  assert.strictEqual(정책.돈열쇠판정({ 돈문픽: '무겁고 드물다' }).필요, true, '골라서 돈 문으로 보내는 자리를 공짜로 열었다');
  /* ⚠ 안 잰 것은 «공짜» 쪽으로 둔다 — 잊었을 때 실패 방향이 「돈이 샌다」가 되면 안 된다
   *   (tools/몽골어대조.js 의 같은 규율). */
  const 안잰것 = 정책.돈열쇠판정({});
  assert.strictEqual(안잰것.필요, false, '안 잰 역할이 돈 문으로 갔다 — 실패 방향이 「돈이 샌다」가 됐다');
  assert.match(안잰것.왜, /안 쟀다/, '안 쟀다는 사실이 까닭에 안 드러난다');
});

test('🔴 몽골어 검문과 대조·채점은 «같은 크기»니 같은 답을 받는다 — 09-04 엔 이 둘이 반대였다', () => {
  /* 09-04 판: 초벌(80요청)=돈 · 몽골어 검문(같은 80요청)=공짜. 그래서 검문이 09-02 저녁부터
   * 조용히 멈춰 있었고, 모델정책.js 는 「여유가 크다」고 적고 있었다(몽골어대조.js 는 반대를 알았다). */
  const 검문 = 정책.제미나이역할.find((r) => r.키 === '몽골어검문');
  const 채점 = 정책.제미나이역할.find((r) => r.키 === '채점분류');
  assert.ok(검문 && 채점, '몽골어 검문이나 대조·채점 자리가 제미나이 역할에서 사라졌다');
  assert.strictEqual(검문.돈열쇠필요, true, `몽골어 검문이 공짜 문에 있다 — 한 판 ${검문.한판요청수}요청이다`);
  assert.strictEqual(채점.돈열쇠필요, true, `대조·채점이 공짜 문에 있다 — 한 판 ${채점.한판요청수}요청이다`);
  for (const r of [검문, 채점]) {
    assert.ok(r.잰법, `«${r.이름}» 에 「한 판을 어떻게 쟀나」가 없다 — 숫자는 자와 함께 적는다`);
  }
});

test('🔑 제미나이 역할은 배치표에서 «뽑아낸다» — 이름을 두 곳에 적으면 한쪽만 낡는다', () => {
  /* 09-05 실측: 배치표에서 `과제글` 이 클로드로 옮겨진 뒤에도 역할 표에는 「콘텐츠 초벌」이
   * 그대로 남아 있었다. 한 확정이 한 파일 안에서 두 번 적히면 한쪽만 고쳐진다. */
  const 표의제미나이 = 정책.배치표.filter((r) => [].concat(r.손).includes('gemini')).map((r) => r.키);
  const 역할의키 = new Set(정책.제미나이역할.map((r) => r.키));
  assert.ok(표의제미나이.length, '배치표에 제미나이가 맡는 자리가 하나도 없다 — 자가 눈이 멀었다');
  for (const 키 of 표의제미나이) {
    assert.ok(역할의키.has(키), `배치표에서 제미나이가 맡는 «${키}» 가 역할 표에 없다 — 두 표가 갈렸다`);
  }
  for (const r of 정책.제미나이역할) {
    if (String(r.키).includes('#')) continue;   // 배치표에 «자리»로 안 서는 갈래(검수 둘째 벤더)
    assert.ok(표의제미나이.includes(r.키),
      `역할 표의 «${r.이름}» 이 배치표에서는 제미나이 자리가 아니다 — 손이 옮겨졌는데 여기만 남았다`);
  }
});

test('🔑 한 판의 크기를 적어 둔 이름표는 전부 배치표에 있다 — 자리를 지우면 짝 잃은 값이 남는다', () => {
  const 있는키 = new Set(정책.배치표.map((r) => r.키));
  for (const 키 of Object.keys(정책.제미나이한판)) {
    assert.ok(있는키.has(키), `제미나이한판 의 «${키}» 가 배치표에 없다 — 자리가 사라졌거나 이름표가 바뀌었다`);
  }
});
