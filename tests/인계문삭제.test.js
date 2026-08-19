/* 인계문 삭제 게이트 회귀 — 목차 재생성이 무엇을 지워도 되는가 (F641).
 *
 * 왜 있나 (2026-08-18 실사고 · 커밋 `74f3655`):
 *   클라우드 세션이 `/close` 한 번에 인계문 **42개**를 지웠다. 그때는 전부 추적본이라 이력에서
 *   복원했지만, 같은 삭제가 **미추적** 파일에 닿으면 이력·stash·reflog 어디에도 없어 영영
 *   유실이다(F025). 하필 그 파일은 인계가 **유일한 통로인** 자리(클라우드 세션)의 유일한 사본이다.
 *
 * 🔑 처방을 「클라우드만 막기」로 좁히지 않은 근거 — 실측으로 조건을 하나씩 갈랐다:
 *   지문이 **있는** 세션도 똑같이 4/4 를 지웠다. 지문은 원인이 아니었다. 그래서 게이트가 둘이고,
 *   이 파일은 그 둘을 **각각** 못박는다.
 *
 * ⚠ 이 회귀의 급소는 「안 지운다」쪽이 아니라 **「지운다」쪽**이다. 삭제를 통째로 죽여도 보존
 *   검사는 전부 초록이라(가드 맹점 ④ — 맞는 얼굴로 틀린 값), 「추적된 만료본은 실제로 걷힌다」를
 *   같은 무게로 둔다. 실제로 그 칸이 `ls-tree` 의 `-r` 누락을 잡는다: `-r` 이 없으면 HEAD 목록이
 *   디렉터리 한 줄뿐이라 이름이 하나도 안 잡혀 **조용히 삭제 0** 이 된다.
 *
 * 검사 방식 — 픽스처 저장소만 쓴다. 실저장소의 인계문 상태는 세션마다 달라 불안정 테스트가 된다.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const report = require(path.resolve(__dirname, '..', '.claude', 'hooks', 'lib', 'session-report.js'));

const git있나 = (() => {
  const r = spawnSync('git', ['--version'], { encoding: 'utf8' });
  return !r.error && r.status === 0;
})();

const 폴더rel = path.join('docs', '_ops', '인계문');
const TTL_MS = 12 * 60 * 60 * 1000;
const 만료 = () => Date.now() - 20 * 60 * 60 * 1000;   // TTL(12h) 넘김
const 생생 = () => Date.now() - 1 * 60 * 60 * 1000;    // TTL 안쪽

const 임시들 = [];
test.after(() => { for (const d of 임시들) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} } });

/** 픽스처 저장소. `git초기화:false` 면 git 이 없는 자리(= 못 물어보는 자리)를 흉내낸다. */
function 픽스처({ git초기화 = true } = {}) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-인계삭제-'));
  임시들.push(repo);
  const g = (...a) => spawnSync('git', ['-c', 'core.quotepath=false', ...a], { cwd: repo, encoding: 'utf8' });
  if (git초기화) {
    g('init', '-q');
    g('config', 'user.name', 't'); g('config', 'user.email', 't@t'); g('config', 'commit.gpgsign', 'false');
  }
  fs.mkdirSync(path.join(repo, 폴더rel), { recursive: true });
  return { repo, g, 폴더: path.join(repo, 폴더rel) };
}

/** 사람이 실제로 쓰는 표기 그대로 인계문 하나를 놓는다(머리 `<!-- at: -->` + `## ` 블록). */
function 인계문두기(폴더, 이름, at) {
  const p = path.join(폴더, `${이름}.md`);
  fs.writeFileSync(p, `<!-- at:${at} -->\n## 2026-08-18 10:00 · 세션 ${이름} · 세션 정리\n\n`
    + `\`\`\`\n${이름} 의 인계문 — 유실되면 안 되는 본문\n\`\`\`\n`);
  return p;
}

/** 커밋해서 추적본으로 만든다 — 「커밋이 곧 보호」가 이 회귀의 축이다. */
function 커밋(g, ...이름들) {
  g('add', '--', ...이름들.map((n) => `${폴더rel}/${n}.md`.replace(/\\/g, '/')));
  g('commit', '-qm', 'seed');
}

const 남은것 = (폴더) => fs.readdirSync(폴더).filter((f) => f.endsWith('.md')).sort();
/** 목차 재생성을 실제 통로로 부른다 — 삭제는 이 함수 ② 안에서만 산다. */
const 돌린다 = (repo, sessionId) => report.writeHandoffFile(repo, '## 새 세션\n\n본문', { sessionId, reason: '세션 정리' });

/* ── 게이트 ㉠ 지문 — 제 이름도 못 대는 세션은 남의 유물을 못 거둔다 (F641 본안) ───────────── */

test('🔴 지문이 빈 값이면(클라우드 세션) 만료본을 하나도 안 지운다 — 추적본이어도', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, g, 폴더 } = 픽스처();
  for (const n of ['aaaaaaa1', 'bbbbbbb2', 'ccccccc3']) 인계문두기(폴더, n, 만료());
  커밋(g, 'aaaaaaa1', 'bbbbbbb2', 'ccccccc3');

  돌린다(repo, '');

  for (const n of ['aaaaaaa1', 'bbbbbbb2', 'ccccccc3']) {
    assert.ok(fs.existsSync(path.join(폴더, `${n}.md`)), `${n} 이 지워졌다 — F641 이 그대로 살아 있다`);
  }
});

test('지문이 공백뿐인 값도 「모름」으로 본다 — 트림 전 문자열로 통과시키면 게이트가 샌다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, g, 폴더 } = 픽스처();
  인계문두기(폴더, 'aaaaaaa1', 만료());
  커밋(g, 'aaaaaaa1');

  돌린다(repo, '   ');

  assert.ok(fs.existsSync(path.join(폴더, 'aaaaaaa1.md')), '공백 지문이 「이름을 안다」로 읽혔다');
});

/* ── 게이트 ㉡ 추적 — 지워도 되는 건 git 이 되돌려 줄 수 있는 것뿐이다 (F025) ───────────── */

test('🔴 지문이 있어도 미추적 만료본은 안 지운다 — 유일본이라 지우면 영영 유실이다(F025)', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, g, 폴더 } = 픽스처();
  인계문두기(폴더, 'tracked1', 만료());
  인계문두기(폴더, 'untrack1', 만료());
  커밋(g, 'tracked1');                       // untrack1 은 일부러 미추적

  돌린다(repo, 'abcd1234');

  assert.ok(fs.existsSync(path.join(폴더, 'untrack1.md')), '미추적 만료본이 지워졌다 — 이력에도 없어 복원 통로가 0이다');
});

test('🔴 추적된 만료본은 **실제로** 걷힌다 — 장치가 「전부 보존」으로 죽으면 이 칸이 잡는다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, g, 폴더 } = 픽스처();
  인계문두기(폴더, 'tracked1', 만료());
  인계문두기(폴더, 'tracked2', 만료());
  커밋(g, 'tracked1', 'tracked2');

  돌린다(repo, 'abcd1234');

  // `ls-tree` 에서 `-r` 이 빠지면 HEAD 목록이 디렉터리 한 줄뿐이라 여기서만 빨개진다.
  assert.strictEqual(fs.existsSync(path.join(폴더, 'tracked1.md')), false, '추적된 만료본이 안 걷혔다');
  assert.strictEqual(fs.existsSync(path.join(폴더, 'tracked2.md')), false, '추적된 만료본이 안 걷혔다');
});

test('git 을 못 부르는 자리에선 삭제 0 — 못 물어본 것을 「없다」로 번역하지 않는다(F207·F348)', () => {
  const { repo, 폴더 } = 픽스처({ git초기화: false });
  인계문두기(폴더, 'aaaaaaa1', 만료());

  돌린다(repo, 'abcd1234');

  assert.ok(fs.existsSync(path.join(폴더, 'aaaaaaa1.md')), 'git 침묵이 「HEAD 에 없다」= 삭제 가능으로 접혔다');
});

/* ── 안 건드리는 쪽 — 통과 목록도 차단 목록과 같은 무게 ─────────────────────────────── */

test('TTL 안쪽(살아있는) 파일은 지문·추적 여부와 무관하게 남는다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, g, 폴더 } = 픽스처();
  인계문두기(폴더, 'fresh001', 생생());
  인계문두기(폴더, 'fresh002', 생생());
  커밋(g, 'fresh001');

  돌린다(repo, 'abcd1234');

  assert.deepStrictEqual(
    남은것(폴더).filter((f) => f.startsWith('fresh')),
    ['fresh001.md', 'fresh002.md'],
    '수명이 남은 인계문을 걷었다 — 살아있는 세션의 다음 걸음이 사라진다',
  );
});

test('내 세션 파일은 언제나 새로 써진다 — 게이트가 쓰기 통로까지 막으면 인계 자체가 죽는다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, 폴더 } = 픽스처();

  돌린다(repo, 'abcd1234');
  assert.ok(fs.existsSync(path.join(폴더, 'abcd1234.md')), '지문 있는 세션의 인계문이 안 써졌다');

  돌린다(repo, '');
  assert.strictEqual(남은것(폴더).length, 2, '지문 없는 세션의 인계문이 안 써졌다(익명 파일 1개가 늘어야 한다)');
});

/* ── 목차 — 안 지운 것은 「열 수 있어야」 보존이다 ──────────────────────────────────── */

test('안 지운 만료본은 목차에 링크로 남는다 — 머리말의 「지워지지 않는다」가 참이 된다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, 폴더 } = 픽스처();
  // 목차_펼침(3)을 넘겨 「그 밖의 세션」 칸으로 밀리게 만든다 — 링크로 남는지가 이 칸의 과녁이다.
  // ⚠ 시각은 **한 기준에서 벌려** 박는다. 호출마다 `Date.now()` 를 다시 읽으면 파일들의 `at` 이
  //   같은 ms 에 몰렸다 갈렸다 하며 정렬이 뒤집혀, 어느 파일이 펼침이고 어느 것이 링크인지가
  //   회차마다 바뀐다(실측: 같은 코드로 9/9 → 8/9). 대조하는 회귀는 그 사이 입력을 얼린다(F281).
  const 기준 = 만료();
  ['old00001', 'old00002', 'old00003', 'old00004']
    .forEach((n, i) => 인계문두기(폴더, n, 기준 - i * 60000));   // 뒤로 갈수록 오래된 것

  const 목차 = 돌린다(repo, '');
  const 본문 = fs.readFileSync(목차, 'utf8');

  assert.match(본문, /그 밖의 세션/, '넘친 만료본이 목차에서 통째로 사라졌다 — 디스크에 있어도 못 찾으면 보존이 아니다');
  // 펼침 3칸은 내 새 블록 + 최신 만료본 둘이 가져간다 — 링크로 밀리는 것은 가장 오래된 쪽이다.
  assert.match(본문, /인계문\/old00004\.md/, '펼침에서 밀린 만료본의 링크가 목차에 없다 — 그러면 열 통로가 0이다');
  for (const n of ['old00001', 'old00002', 'old00003', 'old00004']) {
    assert.ok(본문.includes(n), `${n} 이 목차 어디에도(펼침·링크 둘 다) 없다`);
  }
});

/* ── 상수 — TTL 을 두 곳에 적으면 갈라진다 ─────────────────────────────────────────── */

test('TTL 은 바통과 같은 12h 하나다 — 이 회귀의 만료/생생 픽스처가 그 값에 기댄다', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '..', '.claude', 'hooks', 'lib', 'session-report.js'), 'utf8');
  const m = src.match(/인계_TTL_MS\s*=\s*(\d+)\s*\*\s*(\d+)\s*\*\s*(\d+)\s*\*\s*(\d+)/);
  assert.ok(m, '인계_TTL_MS 를 못 찾았다 — 이름이 바뀌었으면 이 회귀의 픽스처 시각도 다시 본다');
  assert.strictEqual(Number(m[1]) * Number(m[2]) * Number(m[3]) * Number(m[4]), TTL_MS);
});
