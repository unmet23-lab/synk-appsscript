/* 숙제 뱅크 불변식 회귀 — v9.225 적대 리뷰가 손으로 확인한 기계층을 기계로 굳힌다.
 *
 * 왜 있나: 08-13 리뷰(3f96d1c5 대상)가 「6칸·ID·F열·210/420·1:1 짝은 못 뚫었다」고 보고했다 —
 *   그 확인은 리뷰어의 손이었다. 같은 확인을 다음 편집마다 사람이 반복하면 세 번째부터 샌다.
 *   여기서 기계로 못박는 것: ①210행·요일당 30·요일↔유형 1:1 ②ID 유일·F열=ID 숫자부 ③뱅크 ID ↔ MN 문항·
 *   MN 체크포인트 1:1 — 단 **고아만 잡는다**: 키가 멀쩡한 채 뜻만 갈라지는 「내용 드리프트」는 기계가 못 보므로
 *   D·E·MN 짝의 «내용» 대조는 여전히 편집자·리뷰어의 손이다(같은 커밋 규칙 = 뱅크 머리 주석) ④E열 학생 노출
 *   규칙(빈칸·사역문 금지 — 머리 주석 v9.70 규칙의 기계판) ⑤MN 체크포인트 의문문 금지(종결 조사·물음표·
 *   매듭 없는 의문사 조각 — 조사만 떼고 명사화를 안 붙인 반쪽 수리도 빨갛다 · 08-13 리뷰 P1-2 실측).
 *
 * ⚠ 행 파싱은 「6칸 리터럴 한 줄」 모양에 묶여 있다 — 칸 안에 이스케이프 따옴표(\')를 넣으면
 *   그 행이 조용히 빠지는 대신 210 카운트가 깨져 **시끄럽게** 죽는다(새는 방향이 「통과」가 아니게). */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.env.SYNK_TEST_SRC_ROOT || path.resolve(__dirname, '..');
const 소스 = fs.readFileSync(path.join(ROOT, '엔진_콘텐츠AI.js'), 'utf8');

/** setupHomework 의 homework 블록만 자른다 — 다른 콘텐츠 타입(QZ 등)의 행은 섞지 않는다. */
function 뱅크행() {
  const 시작 = 소스.indexOf("replaceContentType(ss, 'homework', [");
  assert.notEqual(시작, -1, 'setupHomework 의 homework 블록을 못 찾았다 — 표식이 바뀌었으면 이 테스트를 같이 고친다');
  const 끝 = 소스.indexOf(']);', 시작);
  assert.notEqual(끝, -1, 'homework 블록의 닫힘(]);)을 못 찾았다');
  const 구간 = 소스.slice(시작, 끝);
  const rows = [];
  const re = /\['(HW\d{3})',\s*'homework',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*(\d+)\]/g;
  let m;
  while ((m = re.exec(구간))) rows.push({ id: m[1], cat: m[2], d: m[3], e: m[4], f: Number(m[5]) });
  return rows;
}

/** MN 맵 블록에서 HW 키(와 값)를 꺼낸다. */
function mn맵(이름) {
  const 시작 = 소스.indexOf('const ' + 이름 + ' = {');
  assert.notEqual(시작, -1, 이름 + ' 선언을 못 찾았다');
  const 끝 = 소스.indexOf('\n};', 시작);
  assert.notEqual(끝, -1, 이름 + ' 의 닫힘을 못 찾았다');
  const 구간 = 소스.slice(시작, 끝);
  const 값 = new Map();
  const re = /"(HW\d{3})":\s*"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = re.exec(구간))) 값.set(m[1], m[2]);
  return 값;
}

test('숙제 뱅크 — 210행 · 요일당 30 · ID 유일 · F열=ID 숫자부', () => {
  const rows = 뱅크행();
  assert.equal(rows.length, 210, `homework 행이 ${rows.length}건 — 210 이어야 한다(행을 지웠거나, 칸에 이스케이프 따옴표(\\')·한 줄 6칸이 아닌 표기가 들어와 파싱이 깨졌다)`);
  const ids = new Set();
  const 요일수 = {};
  // 요일↔유형 1:1 은 210행 전수 실측 불변식(08-13 리뷰 P2) — 깨지면 라이브 카드 칩이 틀린 이름을 단다.
  const 요일유형 = { 1: '어휘', 2: '문법·문장', 3: '말하기', 4: '쓰기', 5: '복습', 6: 'K-컬처', 7: '리셋' };
  for (const r of rows) {
    assert.ok(!ids.has(r.id), `${r.id} 가 두 번 있다`);
    ids.add(r.id);
    assert.equal(r.f, Number(r.id.slice(2)), `${r.id} 의 F열(${r.f})이 ID 숫자부와 다르다 — 무반복 로테이션 키가 갈라진다`);
    const wd = Math.floor(r.f / 100), seq = r.f % 100;
    assert.ok(wd >= 1 && wd <= 7, `${r.id} 요일코드 ${wd} — 1~7 이어야 한다`);
    assert.ok(seq >= 1 && seq <= 30, `${r.id} 순번 ${seq} — 1~30 이어야 한다`);
    assert.equal(r.cat, 요일유형[wd], `${r.id} 유형 「${r.cat}」 — 요일 ${wd} 는 「${요일유형[wd]}」 이어야 한다`);
    요일수[wd] = (요일수[wd] || 0) + 1;
  }
  for (let wd = 1; wd <= 7; wd++) assert.equal(요일수[wd] || 0, 30, `요일 ${wd} 가 ${요일수[wd] || 0}건 — 30 이어야 한다(30주 무반복이 깨진다)`);
});

test('숙제 뱅크 — D·E 비어 있지 않고, E열(학생 노출 「숙제팁」)에 강사 사역문 금지', () => {
  for (const r of 뱅크행()) {
    assert.ok(r.d.trim(), `${r.id} 의 D열(문항)이 비었다`);
    assert.ok(r.e.trim(), `${r.id} 의 E열(검사 포인트)이 비었다 — v9.70부터 학생 화면에도 나간다`);
    assert.ok(!/시키/.test(r.e), `${r.id} E열에 「~시키기」류 사역문 — 학생이 그 문장을 그대로 읽는다(머리 주석 규칙)`);
  }
});

test('숙제 뱅크 ↔ MN 문항·체크포인트 — 1:1 짝(고아 금지 · 한·몽 딴말 카드의 뿌리)', () => {
  const ids = new Set(뱅크행().map((r) => r.id));
  for (const 이름 of ['MN_CONTENTS_G', 'MN_HOMEWORK_CHECKPOINT']) {
    const 맵 = mn맵(이름);
    for (const id of ids) {
      assert.ok(맵.has(id), `${id} 가 ${이름} 에 없다 — 초급 병기가 그 칸만 빈다`);
      assert.ok(String(맵.get(id)).trim(), `${id} 의 ${이름} 값이 빈 문자열 — 있는 척하는 빈 병기다`);
    }
    for (const id of 맵.keys()) assert.ok(ids.has(id), `${이름} 의 ${id} 가 뱅크에 없다 — 지운 문항의 몽골어 유령(다음 개편 때 엉뚱한 카드에 붙는다)`);
  }
});

test('MN 체크포인트 — 의문문 금지(종결 조사·물음표·매듭 없는 의문사 조각)', () => {
  /* ⚠ JS 의 \b 는 키릴에서 안 선다(\w=ASCII) — 경계는 [^а-яёөү] 로 직접 긋는다. */
  for (const [id, v] of mn맵('MN_HOMEWORK_CHECKPOINT')) {
    const t = v.trim();
    assert.ok(!/(^|[^а-яёөү])(бэ|вэ|уу|үү|юу|юү)\s*[.?!]?\s*$/i.test(t),
      `${id} 체크포인트가 의문 조사로 끝난다(«${v}») — 명사구·간접형으로 쓴다`);
    assert.ok(!t.includes('?'), `${id} 체크포인트에 물음표(«${v}») — 명사구·간접형으로 쓴다`);
    /* 조사만 떼면 「хэр … болсон」 같은 잘린 관형절이 남는다(08-13 리뷰 P1-2 — 이 세션이 실제로 낸 반쪽 수리).
     * 의문사가 들어 있으면 매듭(эсэх · -ыг/-ийг 명사화 · -х 동명사 종결) 중 하나를 요구한다. */
    if (/(^|[^а-яёөү])(хэр|хэд|ямар|юу)([^а-яёөү]|$)/i.test(t)) {
      const 매듭 = /(^|[^а-яёөү])эсэх([^а-яёөү]|$)/i.test(t) || /(ийг|ыг)([^а-яёөү]|$)/i.test(t) || /[а-яёөү]х\s*$/i.test(t);
      assert.ok(매듭, `${id} 체크포인트에 의문사만 있고 매듭이 없다(«${v}») — 조사를 뗀 반쪽 수리다(эсэх·명사화·동명사로 닫는다)`);
    }
  }
});
