// tests/폼안전.test.js — [v9.94] 폼 생성 함수 공통 불변식
// 실행: node --test tests/폼안전.test.js  (CI: syntax-check.yml이 tests/*.test.js 전체 구동)
//
// 2026-08-01 실사고에서 나온 규칙이다. createLessonCloseForm이 응답 시트 연결(setDestination)에서
// 8분을 끌다 DEADLINE_EXCEEDED로 죽었는데, 그 시점에 폼은 이미 만들어져 있었다. 그런데 폼 ID를
// app_state에 박는 코드가 함수 맨 뒤에 있어서 앱은 그 폼의 존재를 몰랐다.
//
// 그대로 재실행했다면 폼이 하나 더 생기고, 먼저 만든 폼은 드라이브에 고아로 남는다.
// 강사·학생에게 링크를 이미 배포한 뒤였다면 그 링크가 죽는다(v9.60 레벨테스트와 같은 계급).
//
// 이 파일은 특정 함수를 지목하지 않는다. FormApp.create를 쓰는 함수를 소스에서 전부 찾아
// 같은 불변식을 건다 — 앞으로 새 폼을 추가해도 자동으로 검사 대상이 된다.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const FILES = ['Code.js', '만족도팩.js'];

// 소스에서 FormApp.create를 쓰는 최상위 함수를 전부 수집한다.
function formFactories() {
  const out = [];
  FILES.forEach((f) => {
    const lines = fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n');
    let fn = null, start = 0;
    const flush = (end) => {
      if (!fn) return;
      const body = lines.slice(start, end).join('\n');
      if (body.indexOf('FormApp.create(') > -1) out.push({ file: f, fn, body });
    };
    lines.forEach((l, n) => {
      const m = /^function ([A-Za-z0-9_]+)/.exec(l);
      if (m) { flush(n); fn = m[1]; start = n; }
    });
    flush(lines.length);
  });
  return out;
}

const FACTORIES = formFactories();

test('폼 생성 함수를 실제로 찾아냈다 (수집이 비면 아래 검사가 전부 무의미해진다)', () => {
  assert.ok(FACTORIES.length >= 10,
    `FormApp.create를 쓰는 함수가 ${FACTORIES.length}개만 잡혔다 — 수집 로직이 깨졌을 수 있다`);
});

test('모든 폼 생성 함수가 폼 식별자를 app_state에 남긴다', () => {
  const bad = FACTORIES.filter((c) => !/setState\(.*?(폼ID|폼URL|레벨테스트URL)/.test(c.body));
  assert.deepEqual(bad.map((c) => `${c.file}::${c.fn}`), [],
    '폼을 만들고도 식별자를 기록하지 않는다 — 다음 실행이 그 폼을 못 찾아 중복 생성한다');
});

test('폼 식별자 기록이 응답 시트 연결(setDestination)보다 앞에 온다', () => {
  const bad = [];
  FACTORIES.forEach((c) => {
    const dest = c.body.indexOf('setDestination(');
    if (dest < 0) return;                       // 응답 시트를 안 쓰는 폼은 해당 없음
    const idAt = c.body.search(/setState\(.*?(폼ID|폼URL|레벨테스트URL)/);
    if (idAt < 0 || idAt > dest) bad.push(`${c.file}::${c.fn}`);
  });
  assert.deepEqual(bad, [],
    'setDestination이 식별자 기록보다 앞이다 — 응답 시트 연결은 스프레드시트가 커질수록 느려지고, ' +
    '그 구간에서 타임아웃되면 앱이 모르는 고아 폼이 남는다(2026-08-01 실사고)');
});

test('폼 식별자 기록이 폼 생성 직후에 온다 (사이에 무거운 호출을 끼우지 않는다)', () => {
  const HEAVY = ['setDestination(', 'MailApp.sendEmail(', 'adminMail(', 'SpreadsheetApp.flush()'];
  const bad = [];
  FACTORIES.forEach((c) => {
    const create = c.body.indexOf('FormApp.create(');
    const idAt = c.body.search(/setState\(.*?(폼ID|폼URL|레벨테스트URL)/);
    if (idAt < 0) return;                       // 앞 테스트가 이미 잡는다
    const between = c.body.slice(create, idAt);
    const hit = HEAVY.filter((h) => between.indexOf(h) > -1);
    if (hit.length) bad.push(`${c.file}::${c.fn} (사이에 ${hit.join(', ')})`);
  });
  assert.deepEqual(bad, [],
    '폼 생성과 식별자 기록 사이에 실패·지연 가능한 호출이 있다 — 그 사이에 죽으면 고아 폼이 남는다');
});
