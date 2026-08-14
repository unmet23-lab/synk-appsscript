const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const bump = require(path.join(ROOT, 'tools', 'bump-version.js'));
const src = fs.readFileSync(path.join(ROOT, 'tools', 'bump-version.js'), 'utf8');
/* 부정 단언(「~가 없어야 한다」)의 주어만 이걸로 감싼다 — 주석이 금지 패턴을 «설명»하면 그 검사가
 * 설명을 위반으로 읽는다. ⚠ **자리표(`[vNEXT]`) 검사에는 쓰지 않는다** — 버전 태그는 «주석에 사는
 * 것»이 정상이라 정제하면 과녁이 통째로 사라져 늘 초록이 된다(아래 두 자리 · 대기열 #Q72). */
const { 코드만 } = require('./lib/소스검사.js');

/* [v9.116] 버전 자동 채번 — 2026-08-01 하루에 6번 겹친 동시 발번(v9.80·81·87·100·107·112)의 근본 대책.
 * 이 테스트가 지키는 것은 채번기의 "유일성 보장 경로"다. 여기가 뚫리면 충돌이 조용히 돌아온다. */

test('[v9.116] 버전 비교는 숫자다 — v9.9 < v9.100 (문자열 비교면 정반대가 된다)', () => {
  // 실제 위험: 문자열 비교면 '9' > '1'이라 v9.9가 v9.100보다 크다고 판정되어,
  // 채번기가 이미 쓴 번호를 "아직 안 쓴 번호"로 착각해 되돌려 준다.
  assert.deepEqual(bump.parseVer('v9.113'), [9, 113]);
  assert.deepEqual(bump.parseVer('9.113'), [9, 113], "'v' 없는 형태도 읽어야 한다(태그에서 잘라낸 값)");
  assert.equal(bump.parseVer('v9'), null, '형식 아닌 값은 null이어야 비교에서 빠진다');
  assert.equal(bump.parseVer(''), null);
  assert.equal(bump.parseVer(null), null);

  assert.ok(bump.cmpVer('v9.9', 'v9.100') < 0, 'v9.9가 v9.100보다 크다고 판정됨 — 문자열 비교 회귀');
  assert.ok(bump.cmpVer('v9.100', 'v9.99') > 0);
  assert.equal(bump.cmpVer('v9.100', 'v9.100'), 0);
  assert.ok(bump.cmpVer('v10.0', 'v9.999') > 0, 'major 비교가 minor에 가려지면 안 된다');
  assert.ok(bump.cmpVer(null, 'v9.1') < 0, '미상(null)은 항상 작아야 최댓값 계산에서 안전하다');
});

test('[v9.116] 최댓값·다음 번호 — 자릿수 경계와 null 혼입에서 무너지지 않는다', () => {
  assert.equal(bump.maxVer(['v9.99', 'v9.113', 'v9.9']), 'v9.113');
  assert.equal(bump.maxVer(['v9.9', null, 'v9.100', undefined]), 'v9.100', 'null 섞이면 최댓값이 틀어진다');
  assert.equal(bump.maxVer([]), null);
  assert.equal(bump.nextVer('v9.99'), 'v9.100', '99 다음이 v9.10 같은 값이 되면 번호가 역행한다');
  assert.equal(bump.nextVer('v9.113'), 'v9.114');
  // major 자동 승격 금지 — safety.test.js의 /\[v9\.(\d+)/ 태그 검사가 통째로 무력해진다
  assert.equal(bump.nextVer('v9.999'), 'v9.1000');
  assert.throws(() => bump.nextVer('v9'), /버전 형식/);
});

test('[v9.116] SYNK_VERSION 기입은 그 한 줄만 바꾼다 — 파일 파괴 금지', () => {
  const before = [
    '// 머리말',
    "const ADMIN_EMAIL = 'x@y.z';",
    "const SYNK_VERSION = 'v9.113'; // 전체 이력 = docs/버전_이력.md · 최신 [v9.113] 옛 설명",
    "const OTHER = 'v9.113'; // 같은 문자열이 있는 다른 줄 — 건드리면 안 된다",
    '/* 끝 */'
  ].join('\n');

  const after = bump.replaceVersionLine(before, 'v9.114', '새 설명');
  const L = after.split('\n');
  assert.equal(L.length, 5, '줄 수가 바뀌었다 — 파일 구조 파괴');
  assert.equal(L[0], '// 머리말');
  assert.equal(L[1], "const ADMIN_EMAIL = 'x@y.z';");
  assert.ok(L[2].startsWith("const SYNK_VERSION = 'v9.114';"), 'SYNK_VERSION이 안 바뀌었다');
  assert.ok(L[2].includes('최신 [v9.114] 새 설명'), '설명 꼬리가 새 버전으로 갱신되지 않았다');
  // ⚠ 앞선 세션들의 이력 항목을 덮어쓰면 안 된다 — 초판이 실제로 날렸고 라이브 대조에서 발각됐다
  assert.ok(L[2].includes('[v9.113] 옛 설명'), '기존 이력 체인이 사라졌다 — 다른 세션의 기록이 조용히 지워진다');
  assert.equal((L[2].match(/최신 \[/g) || []).length, 1, "'최신' 표기는 하나여야 한다(옛 항목은 강등)");
  assert.ok(L[2].indexOf('[v9.114]') < L[2].indexOf('[v9.113]'), '최신 항목이 앞에 와야 한다');
  assert.equal(L[3], "const OTHER = 'v9.113'; // 같은 문자열이 있는 다른 줄 — 건드리면 안 된다",
    '다른 줄의 같은 버전 문자열까지 바꿨다 — 전역 치환 회귀');
  assert.equal(L[4], '/* 끝 */');

  // desc 없이 부르면 기존 설명을 보존한다(설명을 지우면 이력 추적이 끊긴다)
  const keep = bump.replaceVersionLine(before, 'v9.114');
  assert.ok(keep.includes('최신 [v9.113] 옛 설명'), 'desc 미지정인데 기존 설명이 지워졌다');
  assert.ok(keep.includes("const SYNK_VERSION = 'v9.114'"));

  // CRLF 파일에서 줄바꿈이 LF로 뭉개지면 diff 전체가 바뀐 것처럼 보인다
  const crlf = before.replace(/\n/g, '\r\n');
  assert.ok(bump.replaceVersionLine(crlf, 'v9.114').includes('\r\n'), 'CRLF가 LF로 바뀌었다');

  assert.throws(() => bump.replaceVersionLine('const A = 1;', 'v9.114'), /SYNK_VERSION/);
});

test('[v9.116] 유일성 보장 경로 — 예약은 원격 push로만 확정된다', () => {
  // 이 체계의 전부: 후보 번호로 태그를 만들어 origin에 push해서 성공해야 내 번호다.
  // 로컬 태그만 만들고 끝내면 두 세션이 같은 번호를 각자 "확보"했다고 믿는다.
  assert.ok(src.includes("git(['push', 'origin', tag]"), '원격 push 예약이 없다 — 로컬 태그만으론 원자성이 없다');
  assert.ok(/catch \(e\) \{[\s\S]{0,200}gitQuiet\(\['tag', '-d', tag\]\)/.test(src),
    'push 실패 시 로컬 태그를 지우지 않으면 다음 시도가 "로컬에 이미 있음"으로 막힌다');
  assert.ok(src.includes('cand = nextVer(cand)'), 'push 거절 후 다음 후보로 넘어가는 재시도가 없다');
  assert.ok(src.includes('MAX_TRIES'), '무한 재시도 방지 상한이 없다');

  // 번호를 이미 쓴 곳 4종을 모두 훑어야 한다 — 하나라도 빠지면 그 경로로 충돌이 샌다
  const collect = src.slice(src.indexOf('function collectUsedVersions'), src.indexOf('/* ── CLI'));
  assert.ok(collect.includes('origin/master:Code.js'), 'origin/master를 안 본다');
  assert.ok(collect.includes("'for-each-ref'"), '로컬 브랜치를 안 본다 — 커밋만 하고 push 안 한 번호를 놓친다(실사고 경로)');
  assert.ok(collect.includes("'tag', '-l'"), '예약 태그를 안 본다 — 방금 가져간 번호를 놓친다');
  assert.ok(collect.includes('작업본 Code.js'), '내 작업본을 안 본다');

  // --dry는 절대 예약하면 안 된다(조회만 하러 왔다가 번호를 소모하면 신뢰를 잃는다)
  const main = src.slice(src.indexOf('function main('));
  const dryIdx = main.indexOf('if (dry)');
  const pushIdx = main.indexOf("git(['push', 'origin', tag]");
  assert.ok(dryIdx > -1 && pushIdx > dryIdx, '--dry 조기 반환이 push보다 뒤에 있다 — 조회가 번호를 소모한다');
});

/* [2026-08-07] F196 — 태그 push 거절을 「선점」 하나로 읽으면 클라우드(폰) 세션에서 25회 헛돌고
 * 「origin 접근을 확인하세요」라는 **틀린 진단**으로 죽는다. 프록시가 지정 `claude/*` 밖 push 를
 * 거부하는 것이지 접근이 없는 게 아니다. friction.js 가 같은 자리에서 실제로 죽어 신고문을 잃었다.
 *
 * 갈래는 friction 과 **반대**다: 신고문은 유실이 더 나쁘니 미예약으로 진행하지만, 버전은 예약 없이
 * 확정하면 남의 배포 게이트까지 막는다(F078). 그래서 여기서는 빨리, **맞는 사유로** 멈춰야 한다.
 *
 * 아래 두 겹 — ①판정 자체는 **실제로 돌려서** 잰다(그래서 조회를 인자로 받게 뽑았다) ②그 판정이 catch
 * 안에서 어느 자리에 놓였는지는 소스로 잰다. */
test('🔴 [F196] 거절 사유 판별 — 원격이 갖고 있으면 선점, 없으면 「막힌 환경」, 못 재면 모름', () => {
  assert.equal(bump.선점인가('synk-v9.200', () => 'a1b2\trefs/tags/synk-v9.200\n'), true,
    '원격이 갖고 있는데 선점이 아니라고 했다 — 이러면 옆 세션과 같은 번호를 쓴다');
  assert.equal(bump.선점인가('synk-v9.200', () => ''), false,
    '원격에 없는데 선점이라고 했다 — 폰에서 25회 헛돌다 틀린 진단으로 죽는 자리다');
  assert.equal(bump.선점인가('synk-v9.200', () => null), null,
    '조회도 실패했는데 「없다」로 단정했다 — 모름을 단정으로 바꾸면 안 된다');

  // 무엇을 묻는지도 잰다 — 다른 태그를 물으면 언제나 「없다」가 나와 전부 「막힘」으로 읽힌다
  let 받은;
  bump.선점인가('synk-v9.201', (a) => { 받은 = a; return ''; });
  assert.deepEqual(받은, ['ls-remote', '--tags', 'origin', 'refs/tags/synk-v9.201'],
    '조회 인자가 그 태그를 안 묻는다: ' + JSON.stringify(받은));
});

test('🔴 [F196] 「막힌 환경」이면 **멈춘다** — 버전은 예약 없이 확정하면 남의 배포까지 막는다', () => {
  const catchBlock = src.slice(src.indexOf("git(['push', 'origin', tag]"), src.indexOf('const src = fs.readFileSync(CODE'));
  const 판정 = catchBlock.indexOf('선점인가(tag');
  const 멈춤 = catchBlock.indexOf('throw new Error(');
  const 재시도 = catchBlock.indexOf('cand = nextVer(cand)');

  assert.ok(판정 > -1, '거절 뒤 사유를 안 가른다 — 못 가르면 폰에서 채번이 통째로 죽는다');
  assert.ok(멈춤 > 판정, '판정보다 먼저 멈춘다 — 선점까지 오류로 접는다');
  /* ⚠ 이 순서 검사가 이 층의 전부다. 소스 검사는 「문구가 남아 있어도 도달 불가면 통과」한다 —
   * 실제로 변이 하나(멈춤 앞에 재시도를 끼워 넣기)가 문구만 보는 판에서 빠져나갔다. */
  assert.ok(재시도 > 멈춤,
    '「막힌 환경」 갈래보다 먼저 다음 후보로 넘어간다 — 예약 없이 번호를 확정하게 된다(F078)');
  assert.ok(/F196/.test(catchBlock), '판정 근거의 출처(F196)를 안 적었다 — 다음 사람이 이 갈래를 못 되짚는다');
  // 따를 수 없는 처방은 우회를 정상 통로로 만든다(F103) — 폰이 무엇을 해야 하는지 그 자리에 있어야 한다
  assert.ok(/vNEXT/.test(catchBlock), '멈추기만 하고 폰 세션이 뭘 해야 하는지 안 알려준다');
});

/* [2026-08-01 감사] 위 '유일성 보장 경로' 케이스는 전부 src.includes(...) — **소스에 그 문장이 쓰여 있다**만
 * 보증하고 **실행하면 그렇게 동작한다**는 보증하지 못한다. 문구가 살짝 바뀌면 죽고, 문구가 남아 있어도
 * 도달 불가 코드면 통과한다(board-guard·clasp-guard가 같은 이유로 실사용 경로에서 죽어 있었다 —
 * memory `guard-must-check-result`). 그래서 아래 한 겹은 **실제로 돌려서 결과**를 본다.
 * --dry는 정의상 부작용이 없어야 하므로 테스트에서 안전하게 실행할 수 있다(그 무부작용 자체가 검사 대상이다). */
test('[감사] --dry를 실제로 돌리면: 다음 번호를 내놓고, 번호도 작업본도 소모하지 않는다', () => {
  const { spawnSync } = require('node:child_process');
  const git = (args) =>
    spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' }).stdout || '';

  // --dry 내부의 fetch --tags를 스냅샷 전에 똑같이 돌려 기준선을 맞춘다 — 신선 클론(CI)에선
  // fetch가 끌어온 origin 태그를 「--dry가 만든 태그」로 오판한다(12연속 CI 실패의 실원인).
  git(['fetch', 'origin', '--tags', '--quiet']);
  const tagsBefore = git(['tag', '-l', 'synk-v9.*']).trim();
  const codeBefore = fs.readFileSync(path.join(ROOT, 'Code.js'));

  const r = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'bump-version.js'), '--dry'], {
    cwd: ROOT, encoding: 'utf8', timeout: 60000,
  });
  const out = (r.stdout || '') + (r.stderr || '');

  assert.equal(r.status, 0, `--dry가 실패했다:\n${out}`);
  const cur = out.match(/현재 최고 버전:\s*(v9\.\d+)/);
  const next = out.match(/다음 번호[^:]*:\s*(v9\.\d+)/);
  assert.ok(cur && next, `--dry 출력에서 현재/다음 번호를 못 읽었다:\n${out}`);
  assert.ok(bump.cmpVer(next[1], cur[1]) > 0,
    `다음 번호(${next[1]})가 현재 최고(${cur[1]})보다 크지 않다 — 채번기가 남의 번호를 되돌려 준다`);

  // 조회하러 왔다가 번호를 소모하면 아무도 --dry를 못 쓴다
  assert.equal(git(['tag', '-l', 'synk-v9.*']).trim(), tagsBefore, '--dry가 태그를 만들었다(번호 소모)');
  assert.deepEqual(fs.readFileSync(path.join(ROOT, 'Code.js')), codeBefore, '--dry가 Code.js를 건드렸다');
});

test('[v9.116] 채번기는 라이브로 배포되지 않는다 (.claspignore 허용목록 밖)', () => {
  // tools/가 라이브에 올라가면 Apps Script가 require/process를 만나 프로젝트 전체가 죽는다.
  const ig = fs.readFileSync(path.join(ROOT, '.claspignore'), 'utf8');
  const allows = ig.split(/\r?\n/).filter((l) => l.startsWith('!')).map((l) => l.slice(1).trim());
  const ok = allows.some((p) => {
    const re = new RegExp('^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
    return re.test('tools/bump-version.js');
  });
  assert.equal(ok, false, 'tools/bump-version.js가 clasp push 대상에 들어갔다 — Node 전용 코드가 라이브에서 크래시한다');
});

/* ═══════ [F017] 이력 체인 병합 — 옆 세션 항목이 조용히 사라지던 자리 ═══════
 * 08-03 실측: v9.141(옆)과 v9.142(내)가 겹쳤을 때 내 작업본 체인엔 [v9.141]이 애초에 없었고,
 * 그대로 써서 그 항목이 빠진 줄이 만들어졌다. 마침 충돌이 나서 손으로 복원했다 —
 * **충돌이 안 났으면 아무도 몰랐을 자리다.** 그래서 회귀는 「충돌 없는 경로」를 검사한다. */

const LINE = (ver, chain) => "const SYNK_VERSION = '" + ver + "'; // 전체 이력 = docs/버전_이력.md " + chain;

test('[F017] origin에만 있는 항목을 되살린다 — 옆 세션 기록이 사라지지 않는다', () => {
  const mine = LINE('v9.140', '· 최신 [v9.140] 내 직전 · [v9.139] 수집층');
  const theirs = LINE('v9.141', '· 최신 [v9.141] 옆 세션 작업 · [v9.140] 내 직전 · [v9.139] 수집층');
  const out = bump.replaceVersionLine(mine, 'v9.142', '내 새 작업', theirs);
  assert.ok(out.includes('[v9.142] 내 새 작업'), '새 항목이 없다');
  assert.ok(out.includes('[v9.141] 옆 세션 작업'), '옆 세션 항목이 사라졌다 — F017 재발');
  assert.ok(out.includes('[v9.140] 내 직전'), '내 기존 항목이 사라졌다');
  assert.ok(out.includes('[v9.139] 수집층'), '더 오래된 항목이 사라졌다');
});

test('[F017] 되살린 항목은 버전 내림차순 자리에 들어간다', () => {
  const mine = LINE('v9.140', '· 최신 [v9.140] 내 직전 · [v9.139] 수집층');
  const theirs = LINE('v9.141', '· 최신 [v9.141] 옆 · [v9.140] 내 직전 · [v9.139] 수집층');
  const out = bump.replaceVersionLine(mine, 'v9.142', '내 새 작업', theirs);
  const order = (out.match(/\[v9\.\d+\]/g) || []);
  assert.deepEqual(order, ['[v9.142]', '[v9.141]', '[v9.140]', '[v9.139]'],
    '순서가 섞였다 — 사람이 최신부터 읽는 줄이다: ' + order.join(' '));
});

test('[F017] 새 항목은 여전히 「최신」 표식을 가지고, 옛 최신은 강등된다', () => {
  const mine = LINE('v9.140', '· 최신 [v9.140] 내 직전');
  const theirs = LINE('v9.141', '· 최신 [v9.141] 옆');
  const out = bump.replaceVersionLine(mine, 'v9.142', '새것', theirs);
  assert.equal((out.match(/· 최신 \[/g) || []).length, 1, '「최신」이 둘 이상이거나 없다');
  assert.ok(/· 최신 \[v9\.142\]/.test(out), '최신 표식이 새 번호에 안 붙었다');
});

test('[F017] 중복 삽입하지 않는다 — 이미 가진 항목은 한 번만', () => {
  const mine = LINE('v9.141', '· 최신 [v9.141] 옆 · [v9.140] 내 직전');
  const theirs = LINE('v9.141', '· 최신 [v9.141] 옆 · [v9.140] 내 직전');
  const out = bump.replaceVersionLine(mine, 'v9.142', '새것', theirs);
  assert.equal((out.match(/\[v9\.141\]/g) || []).length, 1, '같은 항목이 두 번 들어갔다');
  assert.equal((out.match(/\[v9\.140\]/g) || []).length, 1);
});

test('[F017] 병합은 더하기만 한다 — origin에 없는 내 항목을 지우지 않는다', () => {
  // 내가 origin보다 앞서 있는 흔한 경우(내 앞선 커밋이 아직 push 전)
  const mine = LINE('v9.142', '· 최신 [v9.142] 내 미push · [v9.140] 공통');
  const theirs = LINE('v9.140', '· 최신 [v9.140] 공통');
  const out = bump.replaceVersionLine(mine, 'v9.143', '새것', theirs);
  assert.ok(out.includes('[v9.142] 내 미push'), 'origin에 없다고 내 항목을 지웠다');
  assert.ok(out.includes('[v9.140] 공통'));
});

test('[F017] originSrc가 없으면 기존 동작 그대로 — 오프라인에서도 채번은 돈다', () => {
  const mine = LINE('v9.140', '· 최신 [v9.140] 내 직전 · [v9.139] 이전');
  const out = bump.replaceVersionLine(mine, 'v9.141', '새것');
  assert.ok(out.includes('[v9.141] 새것') && out.includes('[v9.140] 내 직전') && out.includes('[v9.139] 이전'));
});

test('[F017] 실저장소 줄을 자기 자신과 병합해도 항목 수가 늘지 않는다(멱등)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'Code.js'), 'utf8');
  const before = (src.match(/\[v9\.\d+\]/g) || []).length;
  const out = bump.replaceVersionLine(src, 'v9.999', '시험', src);
  const after = (out.match(/\[v9\.\d+\]/g) || []).length;
  assert.equal(after, before + 1, `항목이 ${before} → ${after}로 변했다(새 항목 1개만 늘어야 한다)`);
});

/* ── 상수와 헤더 태그를 한 동작으로 (2026-08-04 · 하루 두 번 빨개졌다) ──────────
 *
 * safety [v9.55] 는 **엔진 7파일을 이어붙인 문자열**의 최고 `[v9.N]` 과 `Code.js` 의 SYNK_VERSION 을
 * 대조한다. 그 둘이 두 번에 나뉘어 쓰이던 것이 v9.180·v9.181 두 번의 CI 적색이었고,
 * 그 적색은 **남의 배포 게이트까지 막았다**(자기 트랙 안에서 안 끝나는 결함).
 */
const os = require('node:os');
const 임시들 = [];
function 픽스처(파일들) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-bump-'));
  임시들.push(d);
  for (const [f, s] of Object.entries(파일들)) {
    const p = path.join(d, f);
    fs.mkdirSync(path.dirname(p), { recursive: true }); // 'docs/버전_이력.md' 같은 하위 경로도 받는다
    fs.writeFileSync(p, s);
  }
  return d;
}
function 그루트에서(d, fn) {
  const 원래 = process.env.SYNK_BUMP_ROOT;
  process.env.SYNK_BUMP_ROOT = d;
  try { return fn(); } finally {
    if (원래 === undefined) delete process.env.SYNK_BUMP_ROOT; else process.env.SYNK_BUMP_ROOT = 원래;
  }
}
test.after(() => { for (const d of 임시들) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} } });

test('🔑 [vNEXT] 자리표는 CI 검사 패턴에 안 걸린다 — 그게 존재 이유다', () => {
  // safety [v9.55] 가 쓰는 패턴 그대로. 자리표가 여기 걸리면 「짜는 동안 안 빨개진다」가 무너진다.
  assert.equal('[vNEXT] 궤적 레일'.match(/\[v9\.(\d+)\]/g), null,
    '자리표가 버전 태그로 읽힌다 — 이러면 자리표를 쓰는 순간 CI 가 빨개져 아무도 안 쓴다');
  assert.ok('[v9.181] 궤적 레일'.match(/\[v9\.(\d+)\]/g), '진짜 태그는 여전히 걸려야 한다(탐지력)');
});

test('🔴 --desc 없이는 **채번 전에** 막는다 — 뒤에서 막으면 번호만 태운다', () => {
  assert.throws(() => bump.main([]), /--desc/,
    'desc 없이 통과시켰다 — 상수만 오르고 체인 항목이 안 붙어 CI 가 즉시 빨개진다');
  // 🔑 순서가 핵심이다. origin 에 태그를 push 한 뒤에 throw 하면 그 번호는 영영 못 쓴다.
  const g = src.indexOf('--desc "한 줄 요약" 이 필요합니다');
  /* 앵커를 정규식으로 둔다 — 옛 앵커는 `git(['tag', tag]` 문자열이라 태그 생성에 `-a` 를 붙인
   * 순간 죽었다(F201 수리). 못 찾으면 통과가 아니라 실패로 떨어지는 방향은 그대로 지킨다. */
  const m = /git\(\['tag',[^)]*tag[,\]]/.exec(src);
  const t = m ? m.index : -1;
  assert.ok(g > 0 && t > 0 && g < t,
    `--desc 게이트가 채번(git tag)보다 뒤에 있다 — 번호를 태우고 나서 막는 꼴이다 (게이트 ${g}, 채번 ${t})`);
});

test('🔑 자리표를 엔진 전체에서 **한 번에** 확정한다', () => {
  const d = 픽스처({
    'Code.js': "const SYNK_VERSION = 'v9.5'; // 안내 · 최신 [v9.5] 다섯\n",
    '엔진_궤적.js': '/* [vNEXT] 궤적 레일 */\nfunction a(){}\n// [vNEXT] 두 번째 자리\n',
    '엔진_수집.js': '/* 손 안 댄 파일 */\n',
  });
  const 바뀐 = 그루트에서(d, () => bump.stampPlaceholders('v9.6'));
  const 궤적 = fs.readFileSync(path.join(d, '엔진_궤적.js'), 'utf8');
  /* ⚠ 여기 `궤적` 은 `코드만()` 대상이 «아니다» — 자리표 `[vNEXT]` 는 **일부러 주석 안에 산다**
   *   (이 파일 아래 F339 절이 그 규약을 적는다). 정제하면 과녁이 사라져 늘 초록이다(갈래 ⓓ · #Q72). */
  assert.ok(!/\[vNEXT\]/.test(궤적), `자리표가 남았다:\n${궤적}`);
  assert.equal((궤적.match(/\[v9\.6\]/g) || []).length, 2, '한 파일 안의 자리표를 전부 바꾸지 않았다');
  assert.ok(바뀐.some((x) => x.startsWith('엔진_궤적.js')), `바뀐 파일을 보고하지 않았다: ${JSON.stringify(바뀐)}`);
  assert.equal(fs.readFileSync(path.join(d, '엔진_수집.js'), 'utf8'), '/* 손 안 댄 파일 */\n',
    '자리표가 없는 파일을 건드렸다');
});

/* [2026-08-12 · F339] 라벨을 붙인 자리표(`[vNEXT·E²]`)를 통째로 놓쳤다 — 정확히 `[vNEXT]` 만 봤다.
 * 치환도 `--check` 도 조용히 지나갔고, 실측 08-12 에 `엔진_운영배치.js` 의 `[vNEXT·E²]` 하나가
 * `--check` 초록 아래 살아남았다(잡은 것은 사람 눈). 가드가 로직이 아니라 **표기층**에서 샜고,
 * 새는 방향은 여기서도 「통과」다 — 자리표가 그대로 라이브로 나간다.
 * 🔑 라벨은 지우지 않는다: 사람이 손으로 확정할 때 `[vNEXT·E²]` → `[v9.215·E²]` 로 했다. */
test('🔴 [vNEXT·라벨] 도 자리표다 — 번호만 갈아 끼우고 라벨은 산다 (F339)', () => {
  const d = 픽스처({
    'Code.js': "const SYNK_VERSION = 'v9.5'; // 안내 · 최신 [v9.5] 다섯\n",
    '엔진_궤적.js': '/* [vNEXT·E²] 라벨 · [vNEXT] 민자리 · [vNEXT·검수 31584c315c30] 해시 */\n',
  });
  const 바뀐 = 그루트에서(d, () => bump.stampPlaceholders('v9.6'));
  const 궤적 = fs.readFileSync(path.join(d, '엔진_궤적.js'), 'utf8');
  assert.ok(!/\[vNEXT/.test(궤적), `라벨 붙은 자리표가 살아남았다 — 이게 F339 그 모양이다:\n${궤적}`);
  assert.match(궤적, /\[v9\.6·E²\]/, '라벨을 지웠다 — 라벨은 뜻을 진다(어느 절·어느 검수의 몫인가)');
  assert.match(궤적, /\[v9\.6·검수 31584c315c30\]/, '공백이 든 라벨을 못 살렸다');
  assert.deepStrictEqual(바뀐, ['엔진_궤적.js×3'], `자리표 3개를 다 세지 않았다: ${JSON.stringify(바뀐)}`);
});

test('🔑 자리표 판정은 남의 낱말·확정 태그를 안 건드린다(거짓양성 0)', () => {
  const d = 픽스처({
    'Code.js': "const SYNK_VERSION = 'v9.5'; // [v9.5]\n",
    '엔진_궤적.js': '/* [vNEXTGEN] 남의 낱말 · [v9.5] 확정 태그 · [vNEXT9] 붙은 숫자 */\n',
  });
  assert.deepStrictEqual(그루트에서(d, () => bump.pendingPlaceholders()), [],
    '자리표가 아닌 것을 자리표로 셌다 — 넓힌 패턴이 멀쩡한 코드를 빨갛게 만든다(F287 축)');
  assert.deepStrictEqual(그루트에서(d, () => bump.stampPlaceholders('v9.6')), [], '안 건드려야 할 파일을 고쳤다');
});

/* `/g` 정규식을 상수로 들고 있으면 `lastIndex` 가 호출 사이에 남아 **두 번째 호출이 거짓을 낸다.**
 * 옛 코드는 그 자리에서 `lastIndex = 0` 을 손으로 껐다 — 끄는 것을 한 번 잊으면 자리표가 「없다」로
 * 읽히고, 새는 방향은 또 「통과」다. 매번 새 정규식을 만들어 그 자리를 없앴는지 여기서 잰다. */
test('🔑 자리표 검사를 두 번 연달아 불러도 같은 답이다(lastIndex 잔존 없음)', () => {
  const d = 픽스처({
    'Code.js': "const SYNK_VERSION = 'v9.5'; // [v9.5]\n",
    '엔진_궤적.js': '/* [vNEXT·E²] */\n',
  });
  assert.deepStrictEqual(그루트에서(d, () => bump.pendingPlaceholders()), ['엔진_궤적.js']);
  assert.deepStrictEqual(그루트에서(d, () => bump.pendingPlaceholders()), ['엔진_궤적.js'],
    '두 번째 호출이 빈 배열을 냈다 — 정규식 lastIndex 가 호출 사이에 남았다');
});

/* ═══ [2026-08-12 · F390] 자리표 범위는 「엔진 파일」이 아니라 「배포 집합」이다 ═══
 *
 * 치환도 검사도 `ENGINE_FILES`(7개)를 범위로 썼다. 그 목록은 「테스트가 엔진을 한 문자열로 본다」는
 * 다른 계약의 것인데, 채번기가 치환 범위로 재사용하면서 「엔진 파일 = 배포 파일」 전제가 조용히
 * 들어왔다. 실측 2026-08-12: 배포 집합 15 ∖ ENGINE_FILES 7 = **8개**(`상담AI.js`·`엔진_두뇌.js`
 * ·`교재연동.js`·`만족도팩.js`·`contents_*.js` 3·`appsscript.json`). v9.223 배선 중 `상담AI.js`×3 과
 * `엔진_두뇌.js`×2 가 실제로 자리표를 안은 채 남았다.
 *
 * 🔴 그물이 있다고 믿었는데 없었다 — 실저장소를 재는 자리표 검사는 아래 「실저장소에 [vNEXT] …」
 *   하나뿐이고 그것이 부르는 것이 `pendingPlaceholders()` 다. 검사 층도 같은 7파일만 봤다.
 *   이 계열은 이미 라이브까지 갔다(F309·F310). 새는 방향은 여기서도 「통과」다.
 * 🔑 탐지력은 픽스처가 진다 — 실저장소에 자리표를 심어 재는 순간 그게 사고다. */
const 클래스프무시 =
  '# 픽스처 — 실저장소 .claspignore 와 같은 허용목록 방식(전부 제외 후 !로 되살린다)\n'
  + ['**/*', '!appsscript.json', '!Code.js', '!엔진_*.js', '!contents_*.js', '!상담AI.js'].join('\n') + '\n';

test('🔴 배포 파일인데 엔진 목록 밖이면 자리표를 통째로 놓친다 (F390)', () => {
  const d = 픽스처({
    '.claspignore': 클래스프무시,
    'Code.js': "const SYNK_VERSION = 'v9.5'; // 안내 · 최신 [v9.5] 다섯\n",
    '상담AI.js': '/* [vNEXT] 상담 엔진 — clasp 가 미는데 ENGINE_FILES 엔 없다 */\n',
    '엔진_두뇌.js': '/* [vNEXT·E²] 라벨 자리표 */\n',
  });
  assert.deepStrictEqual(그루트에서(d, () => bump.pendingPlaceholders()).sort(), ['상담AI.js', '엔진_두뇌.js'],
    '배포 파일의 자리표가 검사 밖이다 — 치환도 검사도 없이 clasp push 에 실린다(F309·F310 실사고)');

  const 바뀐 = 그루트에서(d, () => bump.stampPlaceholders('v9.6'));
  assert.deepStrictEqual(바뀐.sort(), ['상담AI.js×1', '엔진_두뇌.js×1'], `치환 범위가 안 넓어졌다: ${JSON.stringify(바뀐)}`);
  assert.match(fs.readFileSync(path.join(d, '상담AI.js'), 'utf8'), /\[v9\.6\]/, '배포 파일의 자리표가 안 확정됐다');
  assert.match(fs.readFileSync(path.join(d, '엔진_두뇌.js'), 'utf8'), /\[v9\.6·E²\]/,
    '라벨을 지웠거나 확정을 안 했다 — 라벨은 뜻을 진다(F339)');
  assert.deepStrictEqual(그루트에서(d, () => bump.pendingPlaceholders()), [], '확정 뒤에도 자리표가 남았다');
});

test('🔑 배포 집합 밖 파일은 안 건드린다 — .claspignore 가 유일 정본 (F390 거짓양성 0)', () => {
  const d = 픽스처({
    '.claspignore': 클래스프무시,
    'Code.js': "const SYNK_VERSION = 'v9.5'; // [v9.5]\n",
    '_보류_실험.js': '/* [vNEXT] 허용목록에 없다 = 라이브에 안 올라간다 */\n',
    'tools/도구.js': '/* [vNEXT] 하위 디렉터리도 배포 대상이 아니다 */\n',
  });
  assert.deepStrictEqual(그루트에서(d, () => bump.pendingPlaceholders()), [],
    '배포 안 되는 파일을 자리표 검사에 넣었다 — 넓힌 범위가 멀쩡한 작업 파일을 빨갛게 만든다');
  assert.deepStrictEqual(그루트에서(d, () => bump.stampPlaceholders('v9.6')), [], '배포 대상이 아닌 파일을 고쳤다');
  assert.match(fs.readFileSync(path.join(d, '_보류_실험.js'), 'utf8'), /\[vNEXT\]/, '보류 파일의 자리표를 갈아 끼웠다');
});

test('🔒 배포 집합은 엔진 목록을 반드시 품는다 — 바닥이 무너지면 엔진이 검사 밖으로 나간다 (F390)', () => {
  const 배포 = bump.배포파일들();
  for (const f of bump.engineFiles()) {
    assert.ok(배포.includes(f), `${f} 가 배포 집합에서 빠졌다 — .claspignore 를 못 읽어도 엔진은 반드시 봐야 한다`);
  }
  assert.ok(배포.length > bump.engineFiles().length,
    `실저장소 배포 집합(${배포.length})이 엔진 목록(${bump.engineFiles().length})을 안 넘는다`
    + ' — 「엔진 파일 = 배포 파일」 전제가 되돌아왔다(F390)');
});

test('🔴 정본 통로를 못 읽는 날에도 엔진은 본다 — 빈 목록은 「자리표 0건」과 같은 모양이다 (F390 · F207)', () => {
  const d = 픽스처({
    '.claspignore': 클래스프무시,
    'Code.js': "const SYNK_VERSION = 'v9.5'; // [v9.5]\n",
    '엔진_궤적.js': '/* [vNEXT] 엔진 파일 */\n',
    '상담AI.js': '/* [vNEXT] 배포 파일 */\n',
  });
  const 원래 = process.env.SYNK_CLASP_LIB;
  process.env.SYNK_CLASP_LIB = path.join(d, '없는-통로.js');
  let 남은;
  try { 남은 = 그루트에서(d, () => bump.pendingPlaceholders()); }
  finally { if (원래 === undefined) delete process.env.SYNK_CLASP_LIB; else process.env.SYNK_CLASP_LIB = 원래; }
  assert.deepStrictEqual(남은, ['엔진_궤적.js'],
    '정본을 못 읽자 목록이 통째로 비었다 — 그러면 「훑을 게 없었다」가 「자리표가 없다」로 읽힌다(F207)');
});

test('🔑 --check 초록이 분모를 밝힌다 — 분모 없는 초록은 미실행과 같은 모양이다 (F390 ② · F207)', () => {
  const d = 픽스처({
    '.claspignore': 클래스프무시,
    'Code.js': "const SYNK_VERSION = 'v9.5'; // 안내 · 최신 [v9.5] 다섯\n",
    '상담AI.js': '/* 자리표 없음 */\n',
  });
  const 말한것 = [];
  const 원래 = console.log;
  console.log = (s) => 말한것.push(String(s));
  let r;
  try { r = 그루트에서(d, () => bump.check()); } finally { console.log = 원래; }
  assert.equal(r, 0, `깨끗한 픽스처가 빨갛다: ${말한것.join('\n')}`);
  assert.match(말한것.join('\n'), /배포 집합 2개/,
    '「[vNEXT] 잔존 0」만 말하고 몇 개를 봤는지는 안 말한다 — 0개를 본 것과 구별되지 않는다');
});

test('🔴 --check 가 라벨 붙은 자리표를 잡는다 — 초록 아래로 라이브에 나가던 자리 (F339)', () => {
  const 라벨자리표 = 픽스처({
    'Code.js': "const SYNK_VERSION = 'v9.5'; // 안내 · 최신 [v9.5] 다섯\n",
    '엔진_궤적.js': '/* [vNEXT·E²] 아직 채번 안 한 자리표 */\n',
  });
  assert.equal(그루트에서(라벨자리표, () => bump.check()), 1,
    '`--check` 가 초록을 냈다 — 08-12 실측이 정확히 이 모양이었고 잡은 것은 사람 눈이었다');
});

test('🔴 --check 가 **양쪽 방향** 다 잡는다 — 태그가 앞서도, 상수가 앞서도', () => {
  // ⓑ 태그를 먼저 박은 경우(엔진 파일 헤더에 손으로 씀) — v9.180 때 이 모양이었다
  const 앞선태그 = 픽스처({
    'Code.js': "const SYNK_VERSION = 'v9.5'; // 안내 · 최신 [v9.5] 다섯\n",
    '엔진_궤적.js': '/* [v9.6] 아직 채번 안 한 태그 */\n',
  });
  assert.equal(그루트에서(앞선태그, () => bump.check()), 1, '태그가 상수보다 앞선 상태를 통과시켰다');

  // ⓐ 상수만 오른 경우(--desc 없이 돌림) — v9.181 때 이 모양이었다
  const 앞선상수 = 픽스처({
    'Code.js': "const SYNK_VERSION = 'v9.7'; // 안내 · 최신 [v9.5] 다섯\n",
  });
  assert.equal(그루트에서(앞선상수, () => bump.check()), 1, '상수만 오른 상태를 통과시켰다');

  // 자리표가 남은 채 커밋되려는 경우
  const 자리표잔존 = 픽스처({
    'Code.js': "const SYNK_VERSION = 'v9.5'; // 안내 · 최신 [v9.5] 다섯\n",
    '엔진_궤적.js': '/* [vNEXT] 아직 안 굳었다 */\n',
  });
  assert.equal(그루트에서(자리표잔존, () => bump.check()), 1, '자리표가 남았는데 통과시켰다 — 그대로 배포된다');

  // 맞는 상태는 통과한다(거짓양성 0)
  const 정상 = 픽스처({
    'Code.js': "const SYNK_VERSION = 'v9.5'; // 안내 · 최신 [v9.5] 다섯\n",
    '엔진_궤적.js': '/* [v9.4] 옛 항목은 있어도 된다 */\n',
  });
  assert.equal(그루트에서(정상, () => bump.check()), 0, '정상 상태를 빨갛게 만들었다');
});

/* ── 세 번째 다리 — docs/버전_이력.md (F082) ────────────────────────────────
 *
 * 버전 표기는 **세 곳**에 있다: ①SYNK_VERSION 상수 ②엔진 헤더 태그 ③이력 문서.
 * `--check` 는 ①②만 봤는데, ③이 어긋나도 CI 는 똑같이 빨개진다(safety [2026-08-03]).
 * 즉 「✅ 일치」라고 답한 **직후에** CI 가 터지는 상태가 존재했다.
 * 🔑 틀리는 preflight 는 없느니만 못하다 — 사람이 그 답을 믿고 커밋하기 때문에,
 *    검사가 없을 때보다 **더 확신을 갖고** 빨간 상태를 밀어 넣는다.
 * F078 을 닫으며 "--check 로 잡는다"고 적어 놓고 이 다리를 안 넣은 것이 F082 다.
 */
test('🔴 --check 가 docs/버전_이력.md 도 본다 — 여기가 어긋나도 CI 는 똑같이 빨개진다 (F082)', () => {
  const 이력뒤처짐 = 픽스처({
    'Code.js': "const SYNK_VERSION = 'v9.9'; // 안내 · 최신 [v9.9] 아홉\n",
    'docs/버전_이력.md': '# 버전 이력\n\n- [v9.8] 여덟\n',
  });
  assert.equal(그루트에서(이력뒤처짐, () => bump.check()), 1,
    '채번만 하고 이력 줄을 안 쓴 상태를 통과시켰다 — 커밋 직후 safety [2026-08-03] 이 빨개진다');

  const 이력앞섬 = 픽스처({
    'Code.js': "const SYNK_VERSION = 'v9.9'; // 안내 · 최신 [v9.9] 아홉\n",
    'docs/버전_이력.md': '# 버전 이력\n\n- [v9.9] 아홉\n- [v9.10] 열 — 상수엔 없는 번호\n',
  });
  assert.equal(그루트에서(이력앞섬, () => bump.check()), 1,
    '이력에만 있는 번호를 통과시켰다 — 양방향으로 틀린다(가드는 한쪽만 보면 반대편이 통째로 샌다)');

  const 정상 = 픽스처({
    'Code.js': "const SYNK_VERSION = 'v9.9'; // 안내 · 최신 [v9.9] 아홉\n",
    'docs/버전_이력.md': '# 버전 이력\n\n- [v9.7] 일곱\n- [v9.9] 아홉\n',
  });
  assert.equal(그루트에서(정상, () => bump.check()), 0, '맞는 상태를 빨갛게 만들었다(거짓양성)');
});

test('🔴 머리말에 박힌 「현재 버전 = v9.NNN」 도 --check 가 잡는다 (36개 버전 뒤처진 채 이틀)', () => {
  const 박힘 = 픽스처({
    'Code.js': "const SYNK_VERSION = 'v9.9'; // 안내 · 최신 [v9.9] 아홉\n",
    // 태그 최고값은 9로 **맞다** — 머리말 하나만 틀린 상태를 격리해서 잰다
    'docs/버전_이력.md': '> 현재 버전 = **v9.107**\n\n---\n\n- [v9.9] 아홉\n',
  });
  assert.equal(그루트에서(박힘, () => bump.check()), 1,
    '머리말 하드코딩을 통과시켰다 — 값이 두 곳에 있으면 갈리고, 아무도 안 고치는 쪽이 반드시 낡는다');
});

test('🔑 이력 문서가 없으면 「검사 안 함」이라고 말한다 — 통과와 미실행이 같은 문장이면 초록이 거짓말을 한다', () => {
  const 문서없음 = 픽스처({ 'Code.js': "const SYNK_VERSION = 'v9.9'; // 안내 · 최신 [v9.9] 아홉\n" });
  const 말한것 = [];
  const 원래 = console.log;
  console.log = (s) => 말한것.push(String(s));
  let r;
  try { r = 그루트에서(문서없음, () => bump.check()); } finally { console.log = 원래; }
  assert.equal(r, 0, '문서가 없다고 빨갛게 만들면 픽스처·서브 프로젝트가 통째로 막힌다');
  assert.match(말한것.join('\n'), /검사하지 않았다/,
    '이력 다리를 건너뛰고도 통과와 똑같은 문장을 냈다 — 「없음」이 「맞음」으로 읽힌다(F047 과 같은 형태)');
});

test('🔒 safety 가 CI 를 빨갛게 만드는 파일을 --check 도 본다 — 둘이 갈라지면 preflight 가 거짓말을 한다', () => {
  /* 위 픽스처들은 **지금** 동작을 재고, 이 줄은 **앞으로 갈라지는 것**을 막는다.
   * safety 쪽이 검사를 옮기거나 --check 에서 이 다리를 빼면 여기서 먼저 죽는다. */
  const safety = fs.readFileSync(path.join(ROOT, 'tests', 'safety.test.js'), 'utf8');
  assert.ok(safety.includes('버전_이력.md'),
    '전제가 사라졌다 — safety 가 이력 문서를 더는 안 본다면 이 결합 검사도 다시 정해야 한다');
  assert.ok(src.includes('버전_이력.md'),
    'safety 는 이력 문서로 CI 를 빨갛게 만드는데 --check 는 그 파일을 아예 안 본다 (F082 재발)');
});

test('실저장소에 [vNEXT] 자리표가 남아 있지 않다 (거짓양성 0)', () => {
  /* ⚠ 여기서 `check()` 전체를 부르지 않는다. 상수↔태그 일치는 safety [v9.55] 가 이미 판정하는데,
   *   같은 것을 두 곳에서 판정하면 ①남이 채번하는 중일 때 둘이 같이 빨개져 원인이 흐려지고
   *   ②둘이 갈라지는 날 어느 쪽이 옳은지 알 수 없다(CLAUDE.md — 같은 판정을 두 층에 두지 않는다).
   *   이 테스트가 지키는 것은 v9.55 가 **볼 수 없는** 것 하나다: 자리표가 확정 안 된 채 실려 나가는 것.
   *   자리표는 `[v9.N]` 패턴에 안 걸리므로 v9.55 는 영원히 침묵한다. 탐지력은 위 픽스처가 진다. */
  assert.deepEqual(bump.pendingPlaceholders(), [],
    '[vNEXT] 가 남은 채로 있다 — 채번(`--desc`)을 돌리면 확정된다. 이대로 커밋하면 자리표가 라이브로 나간다');
});

test('🔑 엔진 파일 목록은 손으로 적지 않고 _engine-source 에서 파생된다', () => {
  const 정본 = require(path.join(ROOT, 'tests', '_engine-source.js')).ENGINE_FILES;
  const 도구 = bump.engineFiles();
  for (const f of 정본) assert.ok(도구.includes(f), `${f} 를 안 본다 — 목록이 갈라지면 그 파일의 태그가 검사에서 빠진다`);
  assert.ok(!/const ENGINE_FILES\s*=\s*\[/.test(코드만(src)), 'bump-version 이 목록을 다시 적었다 — 분할할 때 조용히 갈라진다');
});

test('[F017] 파싱 보조 — 체인 조각과 버전 추출', () => {
  const c = bump.chainEntries('// 안내 · 최신 [v9.5] 다섯 · [v9.4] 넷 · [v9.3] 셋');
  // 「최신」 도막도 항목이다 — head에 남기면 상대의 가장 새 항목이 비교에서 빠진다(F017의 정체).
  assert.equal(c.items.length, 3, '「최신」 도막이 items에 없다: ' + JSON.stringify(c));
  assert.equal(c.head, '// 안내');
  assert.equal(bump.entryVer(c.items[0]), 'v9.5', '「최신 [vN]」에서 버전을 못 읽는다');
  assert.equal(bump.entryVer('[v9.4] 넷'), 'v9.4');
  assert.equal(bump.entryVer('안내 문구'), null);
});
