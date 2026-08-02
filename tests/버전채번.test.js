const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const bump = require(path.join(ROOT, 'tools', 'bump-version.js'));
const src = fs.readFileSync(path.join(ROOT, 'tools', 'bump-version.js'), 'utf8');

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

/* [2026-08-01 감사] 위 '유일성 보장 경로' 케이스는 전부 src.includes(...) — **소스에 그 문장이 쓰여 있다**만
 * 보증하고 **실행하면 그렇게 동작한다**는 보증하지 못한다. 문구가 살짝 바뀌면 죽고, 문구가 남아 있어도
 * 도달 불가 코드면 통과한다(board-guard·clasp-guard가 같은 이유로 실사용 경로에서 죽어 있었다 —
 * memory `guard-must-check-result`). 그래서 아래 한 겹은 **실제로 돌려서 결과**를 본다.
 * --dry는 정의상 부작용이 없어야 하므로 테스트에서 안전하게 실행할 수 있다(그 무부작용 자체가 검사 대상이다). */
test('[감사] --dry를 실제로 돌리면: 다음 번호를 내놓고, 번호도 작업본도 소모하지 않는다', () => {
  const { spawnSync } = require('node:child_process');
  const git = (args) =>
    spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' }).stdout || '';

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

test('[F017] 파싱 보조 — 체인 조각과 버전 추출', () => {
  const c = bump.chainEntries('// 안내 · 최신 [v9.5] 다섯 · [v9.4] 넷 · [v9.3] 셋');
  // 「최신」 도막도 항목이다 — head에 남기면 상대의 가장 새 항목이 비교에서 빠진다(F017의 정체).
  assert.equal(c.items.length, 3, '「최신」 도막이 items에 없다: ' + JSON.stringify(c));
  assert.equal(c.head, '// 안내');
  assert.equal(bump.entryVer(c.items[0]), 'v9.5', '「최신 [vN]」에서 버전을 못 읽는다');
  assert.equal(bump.entryVer('[v9.4] 넷'), 'v9.4');
  assert.equal(bump.entryVer('안내 문구'), null);
});
