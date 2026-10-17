'use strict';
/* Apps Script 안전 점검 — 2026-10-02 학원 운영 시스템을 지운 뒤 남은 프로젝트(@synkbrief 자료 DM)를 본다.
 *
 * 옛 safety 시험 157개는 지운 학원 기능을 검사했다. 그 기록은 git 이력에 있다.
 * 여기에는 남은 코드에도 그대로 필요한 검사만 다시 적었다.
 *   - 라이브에 올라가는 파일(.claspignore 허용목록)과 구문, 올리는 순서
 *   - 설정 파일(실행 API는 본인만)
 *   - 파일 사이의 톱레벨 참조 금지와 전역 이름 충돌(Apps Script는 파일 순서대로 한 전역을 초기화한다)
 *   - 웹 입구: doGet·doPost에서 닿는 함수는 HtmlService를 쓰지 않고, synkbrief가 아닌 요청은 아무 일도 하지 않는다
 *   - 메뉴·트리거·대화상자가 이름으로 부르는 함수
 *   - 버전 표기
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const { ROOT, liveFiles } = require('./_engine-source');

const 읽기 = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const 라이브원문 = () => liveFiles().map((file) => ({ file, src: 읽기(file) }));

// 라이브에 올리지 않고 저장소에만 두는 루트 Apps Script 파일. 이유가 있는 것만 적는다.
const 올리지않는파일 = {
  '엔진_콘텐츠AI.js': 'Strata 지도(strata/maps/ko.json)가 이 파일의 문법 뱅크를 원천으로 읽고 파일 해시를 고정한다',
};

test('라이브에 올라가는 파일은 Code.js와 엔진_synkbrief.js 둘이고 구문이 정상이다', () => {
  const 전수 = liveFiles();
  assert.deepEqual([...전수].sort(), ['Code.js', '엔진_synkbrief.js'].sort());
  전수.forEach((f) => execFileSync(process.execPath, ['--check', path.join(ROOT, f)], { stdio: 'pipe' }));
});

test('.claspignore는 전부 막은 뒤 허용목록만 연다', () => {
  const 규칙 = 읽기('.claspignore').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  // liveFiles()는 `!` 줄만 읽는다. 첫 규칙이 전부 막기가 아니면 clasp는 tools·tests까지 올리는데 위 시험은 그대로 통과한다.
  assert.equal(규칙[0], '**/*');
  assert.deepEqual(규칙.slice(1).filter((l) => !l.startsWith('!')), [], '허용목록 뒤의 막기 규칙은 liveFiles()가 보지 못한다');
});

test('루트의 Apps Script 파일은 라이브에 올리거나, 올리지 않는 이유가 적혀 있다', () => {
  const 전수 = new Set(liveFiles());
  fs.readdirSync(ROOT).filter((f) => /\.(js|gs)$/.test(f)).forEach((f) => {
    assert.ok(전수.has(f) || 올리지않는파일[f], f + ' 가 .claspignore 허용목록에도, 올리지 않는 이유 목록에도 없다');
  });
});

test('설정 파일이 정상이고 실행 API는 본인만 허용한다', () => {
  const manifest = JSON.parse(읽기('appsscript.json'));
  assert.equal(manifest.runtimeVersion, 'V8');
  assert.equal(manifest.executionApi && manifest.executionApi.access, 'MYSELF');
});

test('clasp 올리는 순서는 Code.js가 맨 앞이고 라이브 파일과 같다', () => {
  const clasp = JSON.parse(읽기('.clasp.json'));
  assert.equal(clasp.filePushOrder[0], 'Code.js');
  assert.deepEqual([...clasp.filePushOrder].sort(), [...liveFiles()].sort());
});

test('각 라이브 파일은 혼자 읽어도 초기화에서 죽지 않는다(파일 사이 톱레벨 참조 없음)', () => {
  liveFiles().forEach((f) => {
    assert.doesNotThrow(() => vm.runInContext(읽기(f), vm.createContext({ console })), f);
  });
});

// Apps Script(V8)는 라이브 파일을 올리는 순서대로 한 전역에 읽는다. 같은 이름의 function·var는 뒤 파일이
// 말없이 덮어쓰고, const·let·class가 겹치면 프로젝트 전체가 읽히지 않는다.
function 전역이름충돌(파일들) {
  const 주인 = new Map();
  const 충돌 = [];
  파일들.forEach(({ file, src }) => {
    const ctx = vm.createContext({ console });
    const 처음 = new Set(Object.keys(ctx));
    vm.runInContext(src, ctx, { filename: file });
    Object.keys(ctx).filter((k) => !처음.has(k)).forEach((k) => {
      if (주인.has(k)) 충돌.push(k + ' — ' + 주인.get(k) + '의 것을 ' + file + '가 덮는다');
      else 주인.set(k, file);
    });
  });
  const 한전역 = vm.createContext({ console });
  파일들.forEach(({ file, src }) => {
    try { vm.runInContext(src, 한전역, { filename: file }); } catch (e) { 충돌.push(file + ' — ' + e.message); }
  });
  return 충돌;
}

test('라이브 파일을 올리는 순서대로 한 전역에 읽어도 전역 이름이 겹치지 않는다', () => {
  const 순서 = JSON.parse(읽기('.clasp.json')).filePushOrder;
  assert.deepEqual(전역이름충돌(순서.map((file) => ({ file, src: 읽기(file) }))), []);
});

test('전역 이름 충돌 검사는 덮어쓰는 함수와 겹치는 선언을 잡는다', () => {
  const 두파일 = (a, b) => 전역이름충돌([{ file: 'a.js', src: a }, { file: 'b.js', src: b }]);
  assert.deepEqual(두파일('function 정리() {}', 'function 정리() {}'), ['정리 — a.js의 것을 b.js가 덮는다']);
  assert.match(두파일('const 설정 = 1;', 'const 설정 = 2;').join('\n'), /^b\.js — .*설정/);
  assert.match(두파일('function 설정() {}', 'let 설정 = 2;').join('\n'), /^b\.js — .*설정/);
  assert.deepEqual(두파일('function 하나() {}', 'var 둘 = 1;'), []);
});

test('웹 입구 함수는 Code.js에만 있다', () => {
  liveFiles().forEach((f) => {
    const n = (읽기(f).match(/^function\s+do(?:Get|Post)\s*\(/gm) || []).length;
    assert.equal(n, f === 'Code.js' ? 2 : 0, f);
  });
});

// 파일들을 한 전역에 읽고 전역 함수 이름 → 원문을 낸다. typeof로 묻기 때문에 const로 둔 함수도 잡는다.
function 전역함수원문(파일들) {
  const ctx = vm.createContext({ console });
  파일들.forEach(({ file, src }) => vm.runInContext(src, ctx, { filename: file }));
  const 빈전역 = vm.createContext({ console });
  const 종류 = (c, 이름) => { try { return vm.runInContext('typeof ' + 이름, c); } catch (_) { return ''; } };
  const 후보 = new Set(파일들.flatMap(({ src }) => src.match(/[\p{ID_Start}$_][\p{ID_Continue}$]*/gu) || []));
  return new Map([...후보].filter((n) => 종류(ctx, n) === 'function' && 종류(빈전역, n) !== 'function')
    .map((n) => [n, vm.runInContext('String(' + n + ')', ctx)]));
}

// 원문에 다른 전역 함수 이름이 낱말로 나오면 부른 것으로 센다. 한글 이름이라 \b 대신 유니코드 식별자 경계를 쓴다.
// 문자열·주석 속 이름도 세므로 실제보다 넓게 닿는다. 이 검사에서는 넓은 쪽이 안전하다.
function 닿는함수(원문, 시작) {
  const 낱말 = (이름) => new RegExp('(?<![\\p{ID_Continue}$])' + 이름.replace(/\$/g, '\\$') + '(?![\\p{ID_Continue}$])', 'u');
  const 닿음 = new Set(시작);
  const 할일 = [...시작];
  while (할일.length) {
    const 본문 = 원문.get(할일.pop()) || '';
    for (const 이름 of 원문.keys()) {
      if (!닿음.has(이름) && 낱말(이름).test(본문)) { 닿음.add(이름); 할일.push(이름); }
    }
  }
  return 닿음;
}

// HTML을 한 번이라도 돌려주면 받은 사람이 google.script.run으로 밑줄 없는 전역 함수를 소유자 권한으로 부른다(Code.js 머리말).
function 웹입구HTML(파일들) {
  const 원문 = 전역함수원문(파일들);
  return [...닿는함수(원문, ['doGet', 'doPost'])].filter((이름) => /HtmlService|google\.script\.run/.test(원문.get(이름) || ''));
}

test('웹 입구(doGet·doPost)에서 닿는 함수 어디에도 HtmlService가 없다', () => {
  const 닿음 = 닿는함수(전역함수원문(라이브원문()), ['doGet', 'doPost']);
  // 실제 경로를 따라가지 못하면 아래 검사는 아무것도 보지 않고 통과한다.
  ['synkbrief_웹훅_', 'synkbrief_자료발송_', '웹응답_'].forEach((n) => assert.ok(닿음.has(n), n + '까지 따라가지 못했다'));
  assert.deepEqual(웹입구HTML(라이브원문()), []);
});

test('웹 입구 HtmlService 검사는 한 단계 건너 HTML을 돌려주는 경로를 잡는다', () => {
  const src = 'function doGet(e) { return 화면_(e); }\nconst 화면_ = () => HtmlService.createHtmlOutput("x");\nfunction doPost() {}';
  assert.deepEqual(웹입구HTML([{ file: 'a.js', src }]), ['화면_']);
  assert.deepEqual(웹입구HTML([{ file: 'a.js', src: src.replace('return 화면_(e);', "return '';") }]), [],
    '웹 입구에서 닿지 않는 함수(시트 대화상자)의 HtmlService는 잡지 않는다');
});

// 메뉴·트리거·대화상자는 함수를 문자열 이름으로 부른다. 그 함수를 지우면 구문 검사도 위 시험도 통과하고 라이브에서만 실패한다.
function 이름으로부르는함수(src) {
  const 이름 = '([\\p{ID_Start}$_][\\p{ID_Continue}$]*)';
  const 찾기 = (글, 꼴) => [...글.matchAll(new RegExp(꼴, 'gu'))].map((m) => m[1]);
  return {
    메뉴: 찾기(src, "\\.addItem\\('[^']*',\\s*'" + 이름 + "'\\)"),
    트리거: 찾기(src, "newTrigger\\('" + 이름 + "'\\)"),
    // google.script.run.withSuccessHandler(…).withFailureHandler(…).함수(…) — 체인에서 with로 시작하지 않는 호출이 서버 함수다.
    대화상자: src.split('google.script.run').slice(1).filter((뒤) => 뒤.includes('</script>'))
      .flatMap((뒤) => 찾기(뒤.slice(0, 뒤.indexOf('</script>')), '\\)\\.' + 이름 + '\\(')).filter((n) => !/^with/.test(n)),
  };
}

test('메뉴·트리거·대화상자가 이름으로 부르는 함수는 모두 있다', () => {
  const 원문 = 전역함수원문(라이브원문());
  const 부름 = { 메뉴: [], 트리거: [], 대화상자: [] };
  라이브원문().forEach(({ src }) => Object.entries(이름으로부르는함수(src)).forEach(([갈래, 이름들]) => 부름[갈래].push(...이름들)));
  Object.entries(부름).forEach(([갈래, 이름들]) => {
    assert.ok(이름들.length > 0, 갈래 + '에서 부르는 이름을 하나도 찾지 못했다');
    이름들.forEach((n) => assert.ok(원문.has(n), 갈래 + '가 부르는 ' + n + ' 함수가 없다'));
  });
});

// Apps Script 전역을 흉내 낸 실행 환경
function 환경(props = {}) {
  const 속성 = new Map(Object.entries(props));
  const 웹훅 = [];
  const ctx = vm.createContext({
    console,
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (속성.has(k) ? 속성.get(k) : null) }) },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (text) => ({ text, setMimeType(m) { this.mime = m; return this; } }),
    },
  });
  vm.runInContext(읽기('Code.js'), ctx);
  ctx.synkbrief_웹훅_ = (e, body) => { 웹훅.push(body); return body && body.object === 'instagram' ? { ok: true, channel: 'synkbrief' } : null; };
  return { ctx, 웹훅 };
}

test('doPost는 synkbrief 알림만 처리하고, 나머지는 아무 일도 하지 않고 돌려보낸다', () => {
  const { ctx, 웹훅 } = 환경();
  const 응답 = (body) => JSON.parse(ctx.doPost({ parameter: {}, postData: { contents: JSON.stringify(body) } }).text);
  assert.deepEqual(응답({ object: 'instagram', entry: [] }), { ok: true, channel: 'synkbrief' });
  assert.deepEqual(응답({ object: 'page', entry: [] }), { ok: true, skip: 'unhandled' });
  assert.equal(웹훅.length, 2);
});

test('doPost는 깨진 요청에 내부 오류 내용을 내보내지 않는다', () => {
  const { ctx } = 환경();
  const r = JSON.parse(ctx.doPost({ parameter: {}, postData: { contents: '{깨짐' } }).text);
  assert.deepEqual(r, { ok: false, error: 'internal' });
});

test('doGet은 검증 토큰이 맞을 때만 Meta 확인 값을 돌려준다', () => {
  const { ctx } = 환경({ 상담AI_검증토큰: 'verify' });
  const 확인 = (token) => ctx.doGet({ parameter: { 'hub.mode': 'subscribe', 'hub.verify_token': token, 'hub.challenge': '42' } }).text;
  assert.equal(확인('verify'), '42');
  assert.equal(확인('wrong'), 'SYNK');
  assert.equal(ctx.doGet({ parameter: {} }).text, 'SYNK');
  assert.equal(환경().ctx.doGet({ parameter: { 'hub.mode': 'subscribe', 'hub.verify_token': '', 'hub.challenge': '42' } }).text, 'SYNK',
    '검증 토큰 속성이 없으면 빈 토큰으로도 통과하지 않는다');
});

test('SYNK_VERSION은 라이브 파일의 가장 높은 버전 태그와 같고, 버전 이력에 그 버전이 있다', () => {
  const 태그 = liveFiles().flatMap((f) => [...읽기(f).matchAll(/\[v9\.(\d+)\]/g)].map((m) => Number(m[1])));
  const 상수 = 읽기('Code.js').match(/const SYNK_VERSION = 'v9\.(\d+)'/);
  assert.ok(상수, 'SYNK_VERSION 선언이 없다');
  assert.equal(Number(상수[1]), Math.max(...태그));
  assert.match(읽기('docs/버전_이력.md'), new RegExp('\\[v9\\.' + 상수[1] + '\\]'));
});
