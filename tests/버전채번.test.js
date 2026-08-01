const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const bump = require(path.join(ROOT, 'tools', 'bump-version.js'));
const src = fs.readFileSync(path.join(ROOT, 'tools', 'bump-version.js'), 'utf8');

/* [v9.115] 버전 자동 채번 — 2026-08-01 하루에 6번 겹친 동시 발번(v9.80·81·87·100·107·112)의 근본 대책.
 * 이 테스트가 지키는 것은 채번기의 "유일성 보장 경로"다. 여기가 뚫리면 충돌이 조용히 돌아온다. */

test('[v9.115] 버전 비교는 숫자다 — v9.9 < v9.100 (문자열 비교면 정반대가 된다)', () => {
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

test('[v9.115] 최댓값·다음 번호 — 자릿수 경계와 null 혼입에서 무너지지 않는다', () => {
  assert.equal(bump.maxVer(['v9.99', 'v9.113', 'v9.9']), 'v9.113');
  assert.equal(bump.maxVer(['v9.9', null, 'v9.100', undefined]), 'v9.100', 'null 섞이면 최댓값이 틀어진다');
  assert.equal(bump.maxVer([]), null);
  assert.equal(bump.nextVer('v9.99'), 'v9.100', '99 다음이 v9.10 같은 값이 되면 번호가 역행한다');
  assert.equal(bump.nextVer('v9.113'), 'v9.114');
  // major 자동 승격 금지 — safety.test.js의 /\[v9\.(\d+)/ 태그 검사가 통째로 무력해진다
  assert.equal(bump.nextVer('v9.999'), 'v9.1000');
  assert.throws(() => bump.nextVer('v9'), /버전 형식/);
});

test('[v9.115] SYNK_VERSION 기입은 그 한 줄만 바꾼다 — 파일 파괴 금지', () => {
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

test('[v9.115] 유일성 보장 경로 — 예약은 원격 push로만 확정된다', () => {
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

test('[v9.115] 채번기는 라이브로 배포되지 않는다 (.claspignore 허용목록 밖)', () => {
  // tools/가 라이브에 올라가면 Apps Script가 require/process를 만나 프로젝트 전체가 죽는다.
  const ig = fs.readFileSync(path.join(ROOT, '.claspignore'), 'utf8');
  const allows = ig.split(/\r?\n/).filter((l) => l.startsWith('!')).map((l) => l.slice(1).trim());
  const ok = allows.some((p) => {
    const re = new RegExp('^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
    return re.test('tools/bump-version.js');
  });
  assert.equal(ok, false, 'tools/bump-version.js가 clasp push 대상에 들어갔다 — Node 전용 코드가 라이브에서 크래시한다');
});
