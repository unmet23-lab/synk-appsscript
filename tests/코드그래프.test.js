/**
 * 코드 지식 그래프(code-review-graph) 배선 회귀 — 「비ASCII 경로 방어가 사라지면 조용히 69%가 빠진다」
 *
 * 왜 있나 (2026-08-05 실측):
 *   code-review-graph 는 파일 목록을 `git ls-files` 로 받는데(incremental.py:701) `core.quotepath`
 *   방어 없이 부른다. git 기본값은 비ASCII 경로를 "\352\265\220..." 로 이스케이프해 내보내고,
 *   그 문자열을 그대로 경로로 쓰니 파일이 없어 **오류 한 줄 없이 스킵**된다.
 *     방어 전: 49/160 파일 — 한글 파일명 110개 중 **0개**(상담AI.js·엔진_두뇌.js·엔진_수집.js…)
 *     방어 후: 158/160
 *   즉 SYNK 코드베이스의 핵심이 통째로 지도에서 빠진 채, 그래프는 「없다」고 자신 있게 답한다.
 *   새는 방향은 언제나 「통과」다(F044·F053 계열).
 *
 * 재발 조건이 명확하다 — `code-review-graph install` 을 다시 돌리면 이 저장소에 자기 훅·MCP 설정을
 *   **방어 없는 판으로** 다시 깐다(2026-08-05 에 실제로 그랬다). 그래서 프로즈가 아니라 여기서 막는다.
 *
 * 검사 방식 (가드 3맹점 회피):
 *   ①실제 표기로 본다 — 설정 파일 원문에서 찾는다.
 *   ②탐지력은 **픽스처**로 못박는다 — 실저장소에 버그가 있기를 요구하지 않는다.
 *   ③등록층까지 본다 — 훅 파일만 있고 settings.json 에 등록이 없으면 안 돈다.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.resolve(__dirname, '..');
const HOOK = path.join(ROOT, '.claude', 'hooks', 'graph-update.js');
const MCP = path.join(ROOT, '.mcp.json');
const SETTINGS = path.join(ROOT, '.claude', 'settings.json');

/**
 * 비ASCII 경로 방어가 갖춰졌는지 판정한다 — 실저장소와 픽스처가 **같은 함수**를 통과한다.
 * (검사 함수를 따로 두면 탐지력을 픽스처로 잴 수 있다 · 맹점②)
 */
function 방어됨(원문) {
  return /GIT_CONFIG_KEY_0/.test(원문)
    && /core\.quotepath/.test(원문)
    && /GIT_CONFIG_VALUE_0/.test(원문)
    && /['"]?false['"]?/.test(원문);
}

test('탐지력 — 방어가 빠진 설정을 빨간불로 잡는다 (양방향)', () => {
  // 실제로 code-review-graph 가 까는 판(= 방어 없음). 이걸 초록으로 보면 이 테스트는 무의미하다.
  const 설치기본판 = 'code-review-graph update --skip-flows --repo "$(git rev-parse --show-toplevel)"';
  assert.equal(방어됨(설치기본판), false, '방어 없는 설정을 통과시켰다 — 탐지력 0');

  const 방어판 = "GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'core.quotepath', GIT_CONFIG_VALUE_0: 'false'";
  assert.equal(방어됨(방어판), true, '방어된 설정을 거짓양성으로 잡았다');

  // 값이 true 로 뒤집히면(= 방어 무력화) 잡아야 한다.
  assert.equal(
    방어됨("GIT_CONFIG_KEY_0: 'core.quotepath', GIT_CONFIG_VALUE_0: 'true'"),
    false,
    'quotepath=true 를 방어로 오인했다',
  );
});

test('갱신 훅이 비ASCII 경로 방어를 들고 있다', () => {
  assert.ok(fs.existsSync(HOOK), `갱신 훅이 없다: ${HOOK}`);
  assert.ok(방어됨(fs.readFileSync(HOOK, 'utf8')),
    'graph-update.js 에서 core.quotepath 방어가 사라졌다 — 한글 파일명 110개가 조용히 그래프에서 빠진다');
});

test('MCP 서버 등록도 같은 방어를 들고 있다', () => {
  assert.ok(fs.existsSync(MCP), `.mcp.json 이 없다: ${MCP}`);
  const raw = fs.readFileSync(MCP, 'utf8');
  const conf = JSON.parse(raw);
  const server = conf.mcpServers && conf.mcpServers['code-review-graph'];
  assert.ok(server, '.mcp.json 에 code-review-graph 서버 등록이 없다');
  assert.ok(방어됨(JSON.stringify(server.env || {})),
    'MCP 서버 env 에서 core.quotepath 방어가 사라졌다 — 서버가 보는 그래프만 반쪽이 된다');

  // cwd 는 절대경로여야 한다 — 없거나 틀리면 서버가 **엉뚱한 곳에 빈 DB를 새로 만들고**
  // 「결과 0건」을 조용히 돌려준다(2026-08-05 실측). 드러나는 실패가 조용한 오답보다 낫다.
  assert.ok(server.cwd && path.isAbsolute(server.cwd),
    'MCP 서버에 절대경로 cwd 가 없다 — repo 밖에서 뜨면 빈 그래프를 새로 만든다');
});

test('등록층 — settings.json 이 갱신 훅을 실제로 부른다', () => {
  const s = JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));
  const post = (s.hooks && s.hooks.PostToolUse) || [];
  const 등록 = post.flatMap((b) => (b.hooks || []).map((h) => ({ matcher: b.matcher || '', cmd: h.command || '' })))
    .filter((h) => /graph-update\.js/.test(h.cmd));

  assert.equal(등록.length, 1, 'PostToolUse 에 graph-update 훅 등록이 정확히 1개가 아니다(0=안 돔 · 2+=중복 실행)');
  // 훅이 잡아야 하는 것은 「파일이 바뀌는 통로」다. 라우팅이 훅보다 좁으면 그 자체가 구멍이다.
  assert.match(등록[0].matcher, /Edit/, 'matcher 가 Edit 을 안 잡는다 — 편집해도 그래프가 안 돈다');
  assert.match(등록[0].matcher, /Write/, 'matcher 가 Write 를 안 잡는다 — 새 파일이 지도에 안 실린다');
});

test('그래프 커버리지 — 한글 파일명이 실제로 담겨 있다', (t) => {
  // 그래프 DB 는 .gitignore 라 CI 에는 없다. **통과와 미실행이 같은 모양이면 안 되므로** skip 으로 드러낸다.
  const DB = path.join(ROOT, '.code-review-graph', 'graph.db');
  if (!fs.existsSync(DB)) {
    t.skip('그래프 DB 없음(CI·미빌드) — 로컬에서 `uvx code-review-graph build` 후 검사된다');
    return;
  }
  let sqlite;
  try { sqlite = require('node:sqlite'); } catch (_) {
    t.skip('node:sqlite 없음(구 node) — 커버리지는 tools 로 잰다');
    return;
  }
  const db = new sqlite.DatabaseSync(DB, { readOnly: true });
  const rows = db.prepare('SELECT DISTINCT file_path AS f FROM nodes WHERE file_path IS NOT NULL').all();
  db.close();
  const 한글담김 = rows.filter((r) => /[가-힣]/.test(String(r.f))).length;
  assert.ok(한글담김 > 50,
    `그래프에 한글 파일명이 ${한글담김}개뿐이다 — quotepath 방어가 풀린 채 빌드됐다(정상: 100+)`);
});
