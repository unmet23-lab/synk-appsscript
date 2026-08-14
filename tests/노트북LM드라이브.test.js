/**
 * 노트북LM 드라이브 자동 갱신 회귀 (tools/notebooklm-drive.js · tools/*.cmd)
 *
 * 배경 실측(08-04) — 노트북LM은 API가 없다(불변). 자동으로 최신화하는 **유일한** 경로가
 * 드라이브 소스다. 그런데 Drive 소스 피커가 받는 형식은 **문서·프레젠테이션·스프레드시트·
 * PDF·폴더**뿐이고 `.md`는 목록에 **없다** → 묶음을 PDF로 굽고 **폴더**를 소스로 건다.
 * 「폴더」가 자동의 핵심이다 — 낱개 파일로 걸면 판정이 하나 늘 때마다 사람이 다시 골라야 한다.
 *
 * 이 파일이 지키는 것:
 *  ① tools/*.cmd 는 **순수 ASCII**다 (F069 · 2번째 재발이라 프로즈에서 기계로 옮긴 규칙)
 *  ② 개인정보 게이트를 **사본으로 만들지 않는다** — export의 것을 그대로 쓴다
 *  ③ 마운트가 없으면 **폴백하지 않고 멈춘다**(「올라간 줄 알았는데 안 올라간」이 최악이다)
 *  ④ 묶음 이름이 **매번 같다**(드라이브가 「새 파일」이 아니라 「같은 파일의 새 판」으로 보게)
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const TOOLS = path.join(REPO, 'tools');
const SRC = fs.readFileSync(path.join(TOOLS, 'notebooklm-drive.js'), 'utf8');
/* 부정 단언(「~가 없어야 한다」)의 주어만 이걸로 감싼다 — 주석이 금지 패턴을 «설명»하면 그 검사가
 * 설명을 위반으로 읽는다. 긍정 단언(`assert.match(SRC, …)`)은 원문 그대로 둔다. (대기열 #Q72) */
const { 코드만 } = require('./lib/소스검사.js');
const SRC코드 = 코드만(SRC);

// ── ① .cmd 순수 ASCII (F069) ────────────────────────────────────────────
test('tools/*.cmd 는 비ASCII 바이트가 0이다 (cmd.exe는 CP949로 파싱한다)', () => {
  const cmds = fs.readdirSync(TOOLS).filter((f) => f.toLowerCase().endsWith('.cmd'));
  assert.ok(cmds.length >= 1, 'tools에 .cmd가 하나도 없다 — 검사가 헛돈다');
  for (const f of cmds) {
    const buf = fs.readFileSync(path.join(TOOLS, f));
    const bad = [];
    for (let i = 0; i < buf.length; i++) if (buf[i] > 127) bad.push(i);
    assert.equal(bad.length, 0,
      `${f} 에 비ASCII 바이트 ${bad.length}개(첫 위치 ${bad[0]}) — ` +
      '한글이 든 줄은 rem 주석이어도 파싱이 깨져 cmd가 조각을 명령으로 실행한다(F069 실측). ' +
      '한글이 필요하면 .cmd가 아니라 Node 쪽에 둔다.');
  }
});

// ── ② 게이트 사본 금지 ──────────────────────────────────────────────────
test('개인정보 게이트를 사본으로 만들지 않고 export의 것을 그대로 쓴다', () => {
  assert.match(SRC, /require\('\.\/notebooklm-export\.js'\)/,
    'export 모듈을 안 쓴다 — 게이트가 둘이 되면 한쪽만 고쳐지고, 새는 방향은 언제나 「통과」다');
  assert.ok(!/const PII\s*=|scanPII\s*\(text\)\s*\{/.test(SRC코드),
    '게이트 로직을 여기에 복제했다 — 정의는 한 곳이어야 한다');
  const E = require(path.join(TOOLS, 'notebooklm-export.js'));
  const D = require(path.join(TOOLS, 'notebooklm-drive.js'));
  assert.ok(typeof E.scanPII === 'function' && typeof D.toHtml === 'function',
    '모듈 표면이 바뀌었다 — 이 테스트도 함께 옮겨라');
});

// ── ③ 폴백 금지 (실패는 정지로 드러난다) ────────────────────────────────
test('마운트가 없으면 딴 폴더로 폴백하지 않고 멈춘다', () => {
  const i = SRC.indexOf('if (!fs.existsSync(상위))');
  assert.notEqual(i, -1, '대상 폴더 존재 확인이 없다 — 없는 곳에 쓰려다 조용히 실패한다');
  const 블록 = SRC.slice(i, i + 700);
  assert.match(블록, /process\.exit\(\s*2\s*\)/,
    '멈추지 않는다 — 「올라간 줄 알았는데 안 올라간」 상태가 최악이다');
  // 폴백 경로를 몰래 두지 않았는지: 대상 결정이 --out 과 DEFAULT_OUT 둘뿐이어야 한다
  /* ⚠ 정제본으로 잰다 — 주석이 「바탕화면으로 폴백하지 않는다」를 설명하면 그 설명이 위반이 된다.
   *   거리 단언(`[\s\S]{0,120}`)이라 주석이 빠지면 거리가 «줄어든다» = 더 잘 잡는 쪽이라 안전하다. */
  assert.ok(!/catch[\s\S]{0,120}mkdirSync\([\s\S]{0,60}Desktop/.test(SRC코드),
    '실패 시 바탕화면 등으로 새는 경로가 있다');
});

test('마운트 탐지는 Node 쪽에 있다 (.cmd에 한글 경로를 두지 않으려고)', () => {
  assert.match(SRC, /function findDriveRoot\(\)/, '마운트 탐지 함수가 없다');
  assert.match(SRC, /'내 드라이브'|"내 드라이브"/, '한국어 마운트 이름을 안 본다 — 유호님 환경이 한국어다');
  assert.match(SRC, /'My Drive'|"My Drive"/, '영문 마운트 이름을 안 본다 — 계정 언어가 바뀌면 못 찾는다');
  /* ⚠ `cmd` 는 **배치 스크립트**지 JS 가 아니다 — `코드만()` 으로 감싸지 않는다(갈래 ⓒ 비JS · #Q72).
   *   배치의 주석은 `REM`·`::` 이고, JS 렉서를 대면 경로의 `//` 를 주석으로 읽어 뒤를 지운다. */
  const cmd = fs.readFileSync(path.join(TOOLS, 'notebooklm-drive.cmd'), 'utf8');
  assert.ok(!/내 드라이브|My Drive/.test(cmd), '.cmd가 마운트 경로를 직접 들고 있다 — 탐지는 Node 몫이다');
});

// ── ④ 이름 안정성 ───────────────────────────────────────────────────────
test('묶음 파일 이름이 내용과 무관하게 고정 패턴이다 (드라이브가 같은 파일로 보게)', () => {
  assert.match(SRC, /SYNK_\$\{[^}]*prefix[^}]*\}_\$\{String\(/,
    '이름이 그룹+일련번호 형태가 아니다 — 이름이 매번 바뀌면 드라이브가 새 파일로 보고 소스가 끊긴다');
  assert.ok(!/만든날[^\n]*\.pdf|\$\{만든날\}[^\n]*pdf/.test(SRC코드),
    '파일 이름에 날짜를 박았다 — 매일 새 파일이 생겨 폴더 소스가 무한히 늘어난다(날짜는 본문 머리말에 둔다)');
});

test('사본임을 본문 머리말이 스스로 말한다 (만든 날·읽기 전용·원본 경로)', () => {
  const D = require(path.join(TOOLS, 'notebooklm-drive.js'));
  const html = D.toHtml('제목', '2026-08-04', [{ 원본: 'memory/x.md', 내용: '내용' }]);
  assert.match(html, /사본이다 — 정본이 아니다/, '사본 표시가 없다');
  assert.match(html, /만든 날 <b>2026-08-04<\/b>/, '만든 날짜가 없다(정본 분열 잠금 위반)');
  assert.match(html, /여기서 결정하지 않는다/, '읽기 전용 문구가 없다');
  assert.match(html, /memory\/x\.md/, '원본 경로가 없다 — 출처를 못 되짚는다');
});

// ── ⑤ 자동 배선의 감시 (장치를 만들었으면 발동 조건도 만든다 · F026) ──────
test('주간 부패 점검이 예약 작업 로그를 읽는다 (안 도는 것이 조용하면 안 된다)', () => {
  const rot = fs.readFileSync(path.join(TOOLS, 'rot-check.js'), 'utf8');
  assert.match(rot, /notebooklm-drive\.log/,
    'rot-check가 실행 로그를 안 본다 — 드라이브가 꺼지면 생성기는 멈추는데 아무도 그 로그를 안 연다');
  assert.match(rot, /noteboo?klmDriveSection|nblmDriveSection/,
    '감시 섹션이 없다');
  assert.match(rot, /'노트북LM 자동 갱신 실패'/, '실패를 🔴로 올리지 않는다');
  /* 수집 배열에 실제로 끼워졌는가 — 함수만 있고 안 불리면 「장치는 있는데 발화 없음」이다.
   * ⚠ 앵커에 닫는 대괄호를 넣지 않는다: 초판은 `[mem, doc, fri, har, nbl, nbd]` 전체를 요구해서
   *   **섹션이 하나 늘자 곧바로 깨졌다**(2026-08-04 손일 장부 추가). 이 검사가 지키려는 성질은
   *   「nbd가 목록에 있다」이지 「목록의 길이가 6이다」가 아니다 — 문구 앵커가 문구 변화에 죽는
   *   형태(F068)라, 지키려는 성질만 남기고 뒤는 열어 둔다. */
  assert.match(rot, /\[mem, doc, fri, har, nbl, nbd\b/,
    '감시 섹션이 검사기 목록에 안 들어갔다 — 만들어만 두고 안 부르는 형태(F026)');
  assert.match(rot, /for \(const s of \[[^\]]*\bnbd\b[^\]]*\]\)/,
    '검사기 고장 감시 루프에서 nbd가 빠졌다 — 섹션이 터져도 조용해진다');
});

test('로그가 없으면 부패가 아니다 (아직 안 쓰는 것과 낡은 것을 가른다)', () => {
  const rot = fs.readFileSync(path.join(TOOLS, 'rot-check.js'), 'utf8');
  const i = rot.indexOf('function nblmDriveSection()');
  assert.notEqual(i, -1);
  const 본문 = rot.slice(i, rot.indexOf('\n}\n', i));
  assert.match(본문, /if \(!fs\.existsSync\(log\)\) return \{ present: false \}/,
    '로그 부재를 부패로 센다 — 다른 기계·첫 실행 전에 헛경보가 나고, 헛경보를 내는 가드는 곧 꺼진다');
});

test('HTML 이스케이프 — 본문의 꺾쇠가 태그로 새지 않는다', () => {
  const D = require(path.join(TOOLS, 'notebooklm-drive.js'));
  const html = D.toHtml('T', '2026-08-04', [{ 원본: 'a.md', 내용: '<script>alert(1)</script> & <b>' }]);
  assert.ok(!/<script>alert/.test(html), '본문의 스크립트 태그가 그대로 들어갔다 — 렌더가 깨지거나 내용이 사라진다');
  assert.match(html, /&lt;script&gt;/, '이스케이프가 안 됐다');
});
