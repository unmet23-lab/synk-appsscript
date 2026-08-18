/**
 * 세션식별 회귀 — 「나는 어느 세션인가」의 **공용 통로** (마찰 F633).
 *
 * 왜 있나 (2026-08-18 실측 · 클라우드 컨테이너):
 *   쓰는 층(`handoff-store.trackSessionId` · `track-collision`)은 이미 `HOST || input.session_id`
 *   폴백을 가졌는데, **읽는 층 십수 곳은 `process.env.CLAUDE_CODE_HOST_SESSION_ID` 하나만** 읽었다.
 *   클라우드엔 그 변수가 없어서 전부 `''` 로 떨어졌고 — 새는 방향은 전부 「통과」였다:
 *   `board-guard` 의 생사 판정이 영구 false(상한이 통째로 풀린다) · `작업본소유자` 의 자기면제
 *   절이 꺼짐(F264 재장전) · `대기열 --집기` 가 **따를 수 없는 처방**을 냄(F103) ·
 *   락 주인이 전 세션 공통 `unknown/<pid>`.
 *
 * 이 파일이 지는 것 셋:
 *   ㉠ **동작** — 층별 폴백 순서와 「연락 id 는 내부 UUID 로 안 내려간다」는 계약(픽스처 env).
 *   ㉡ **소비자 계약** — 지문은 `board-id.파일지문()` 이 받아들이는 모양(hex 8자)이어야 한다.
 *      이게 이 수리의 급소다: `cse_…`(REMOTE)를 지문으로 쓰면 문자열은 나오는데 **소비자가 거부**한다.
 *   ㉢ **옛 통로 금지** — 이 통로 밖에서 그 환경변수를 직접 읽으면 fail. 탐지력은 **픽스처**가 지고
 *      (버그가 아직 있을 것을 요구하지 않는다 · CLAUDE.md 가드 맹점 ②), 실저장소에는 **거짓양성 0**만
 *      단언하며 **분모(훑은 파일 수)를 함께 낸다**(F207). 못 읽으면 fail 이 아니라 skip 이다(F296).
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const ROOT = path.resolve(__dirname, '..');
const 모듈 = path.join(ROOT, '.claude', 'hooks', 'lib', '세션식별.js');
const 세션식별 = require(모듈);
const 보드id = require(path.join(ROOT, '.claude', 'hooks', 'lib', 'board-id.js'));

/* 픽스처 env — `process.env` 를 흔들지 않는다(병렬 테스트가 서로를 깨뜨린다). */
const UUID = 'e54f1033-32fd-52a2-ace7-a9c62fddee36';
const CSE = 'cse_014P5Hsr7yE5p9pdLqwj6X9x';
const HOST = 'local_ad0673f3-1111-2222-3333-444444444444';

/* ─────────────────────────── ㉠ 동작 ─────────────────────────── */

test('로컬(HOST 있음) — 옛 동작 그대로: 연락·자리 둘 다 HOST', () => {
  const env = { CLAUDE_CODE_HOST_SESSION_ID: HOST, CLAUDE_CODE_REMOTE_SESSION_ID: CSE, CLAUDE_CODE_SESSION_ID: UUID };
  assert.equal(세션식별.연락id(env), HOST);
  assert.equal(세션식별.자리id(env), HOST);
  assert.equal(세션식별.지문(env), 'ad0673f3');
  assert.equal(세션식별.진단(env).층, 'HOST');
  assert.equal(세션식별.진단(env).연락층, 'HOST');
});

test('클라우드(HOST 없음) — 연락은 REMOTE, 자리는 세션 UUID. 두 값이 «다르다»', () => {
  const env = { CLAUDE_CODE_REMOTE_SESSION_ID: CSE, CLAUDE_CODE_SESSION_ID: UUID };
  assert.equal(세션식별.연락id(env), CSE);
  assert.equal(세션식별.자리id(env), UUID);
  assert.notEqual(세션식별.연락id(env), 세션식별.자리id(env));   // 이 «다름» 이 F633 의 재료다
  assert.equal(세션식별.진단(env).층, 'CLAUDE_CODE_SESSION_ID');
  assert.equal(세션식별.진단(env).연락층, 'REMOTE');
});

test('연락 id 는 세션 UUID 로 **안 내려간다** — 연락 불가능한 값을 연락용으로 쓰면 뜻이 무너진다', () => {
  const env = { CLAUDE_CODE_SESSION_ID: UUID };          // REMOTE 도 HOST 도 없다
  assert.equal(세션식별.연락id(env), '');                 // 「모름」이지 UUID 가 아니다
  assert.equal(세션식별.자리id(env), UUID);               // 자리는 그래도 선다
  assert.equal(세션식별.진단(env).연락층, '없음');
});

test('자리 id 는 훅 stdin(session_id) 이 env 세션 UUID 보다 앞이다 — 쓰는 층의 옛 순서를 물려받는다', () => {
  const env = { CLAUDE_CODE_SESSION_ID: UUID };
  assert.equal(세션식별.자리id(env, { session_id: '훅이-준-id' }), '훅이-준-id');
  /* 그러나 HOST 는 그 둘보다 앞이다(로컬에서 옛 동작이 안 바뀐다는 뜻). */
  assert.equal(세션식별.자리id({ ...env, CLAUDE_CODE_HOST_SESSION_ID: HOST }, { session_id: '훅이-준-id' }), HOST);
});

test('아무것도 없으면 전부 빈 문자열 — 「모름」이지 「내 것」이 아니다', () => {
  const env = {};
  assert.equal(세션식별.연락id(env), '');
  assert.equal(세션식별.자리id(env), '');
  assert.equal(세션식별.지문(env), '');
  assert.equal(세션식별.진단(env).층, '없음');
  assert.equal(세션식별.진단(env).지문사유, '자리 id 가 없다');
});

test('표기id — 연락이 되면 연락 id, 아니면 자리 id (락·기록이 세션마다 갈리게)', () => {
  assert.equal(세션식별.표기id({ CLAUDE_CODE_REMOTE_SESSION_ID: CSE, CLAUDE_CODE_SESSION_ID: UUID }), CSE);
  assert.equal(세션식별.표기id({ CLAUDE_CODE_SESSION_ID: UUID }), UUID);
  assert.equal(세션식별.표기id({}), '');
});

/* ─────────────────────── ㉡ 소비자 계약(급소) ─────────────────────── */

test('지문은 `board-id.파일지문()` 이 **실제로 받아들이는** 모양이어야 한다', () => {
  const f = 세션식별.지문({ CLAUDE_CODE_SESSION_ID: UUID });
  assert.equal(f, 'e54f1033');
  /* 소비자에게 직접 물어본다 — 「hex 8자」를 여기 다시 적으면 판정이 두 곳에서 갈라진다. */
  assert.equal(보드id.파일지문(`${f}.md`), f);
});

test('REMOTE(`cse_…`) 를 지문으로 쓰면 소비자가 거부한다 — 그래서 자리 폴백이 REMOTE 가 아니다', () => {
  const 날것 = 보드id.지문(CSE);
  assert.equal(날것, '014p5hsr');                     // 문자열은 나온다 …
  assert.equal(보드id.파일지문(`${날것}.md`), '');      // … 그런데 소비자가 「주인 없음」으로 읽는다
  assert.equal(보드id.줄의지문(`선언 (\`${CSE}\`)`).length, 0);
  /* 그래서 `세션식별.지문()` 은 그 값을 내주지 않고 「모름」으로 떨어뜨린다 — 사유까지 남긴다. */
  const env = { CLAUDE_CODE_HOST_SESSION_ID: CSE };
  assert.equal(세션식별.지문(env), '');
  assert.match(세션식별.진단(env).지문사유, /hex 가 아니다/);
});

test('쓰는 층과 읽는 층이 **같은 값**을 준다 — 이 어긋남이 F633 그 자체였다', () => {
  const store = require(path.join(ROOT, '.claude', 'hooks', 'lib', 'handoff-store.js'));
  for (const input of [null, { session_id: '훅이-준-id' }]) {
    assert.equal(store.trackSessionId(input), 세션식별.자리id(process.env, input));
  }
});

/* ─────────────────────── ㉢ 옛 통로 금지(래칫) ─────────────────────── */

/** 주석만 지운다 — 주석 속 언급은 위반이 아니고(설명은 필요하다), 문자열은 **안** 지운다
 *  (`process.env['CLAUDE_CODE_HOST_SESSION_ID']` 의 대괄호 표기가 문자열을 끼고 있어서다). */
function 주석지우기(src) {
  return String(src)
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))   // 길이 보존 — 행 번호가 안 밀린다
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));
}

/** 한 파일의 위반 행들. 「사람이 실제로 쓰는 표기」 셋을 전부 본다(점·홑따옴표·쌍따옴표). */
const 위반RE = /process\s*\.\s*env\s*(?:\.\s*CLAUDE_CODE_HOST_SESSION_ID\b|\[\s*['"]CLAUDE_CODE_HOST_SESSION_ID['"]\s*\])/;

function 위반행들(src) {
  return 주석지우기(src).split('\n')
    .map((줄, i) => ({ 행: i + 1, 줄 }))
    .filter(({ 줄 }) => 위반RE.test(줄));
}

/** 검사에서 빼는 자리 — **정본 하나**뿐이다. 늘리려면 여기서 이유를 적는다. */
const 면제 = new Set([path.join('.claude', 'hooks', 'lib', '세션식별.js')]);

function js파일들(뿌리) {
  const 결과 = [];
  const 훑기 = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') 훑기(p); continue; }
      if (e.isFile() && e.name.endsWith('.js')) 결과.push(p);
    }
  };
  훑기(뿌리);
  return 결과;
}

test('탐지력 — 픽스처가 진다(실저장소가 깨끗해도 이 검사는 계속 눈이 있다)', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-f633-'));
  try {
    const 사례 = [
      ['점표기.js', "const a = process.env.CLAUDE_CODE_HOST_SESSION_ID || '';", 1],
      ['대괄호홑.js', "const a = process.env['CLAUDE_CODE_HOST_SESSION_ID'];", 1],
      ['대괄호쌍.js', 'const a = process.env["CLAUDE_CODE_HOST_SESSION_ID"];', 1],
      ['공백.js', "const a = process . env . CLAUDE_CODE_HOST_SESSION_ID;", 1],
      ['줄주석.js', "// process.env.CLAUDE_CODE_HOST_SESSION_ID 는 클라우드에 없다\nconst a = 1;", 0],
      ['블록주석.js', "/* 옛 통로: process.env.CLAUDE_CODE_HOST_SESSION_ID */\nconst a = 1;", 0],
      ['환경쓰기.js', "spawn(c, { env: { ...process.env, CLAUDE_CODE_HOST_SESSION_ID: sid } });", 0],
      ['처방.js', "const a = require('./세션식별.js').자리id();", 0],
    ];
    for (const [이름, 글, 기대] of 사례) {
      fs.writeFileSync(path.join(방, 이름), 글, 'utf8');
      assert.equal(위반행들(글).length, 기대, `${이름} — ${기대}건이어야 한다`);
    }
    /* 훑기 자체도 잰다 — 스캐너가 파일을 0개 열면 「위반 0」과 모양이 같다(F207). */
    assert.equal(js파일들(방).length, 사례.length);
  } finally {
    fs.rmSync(방, { recursive: true, force: true });
  }
});

test('자기 처방이 그 가드를 통과한다 — 따를 수 없는 처방은 우회를 정상 통로로 만든다(F103)', () => {
  /* 위반 파일이 받게 되는 처방문을 **그대로** 되먹인다. */
  const 처방 = "const 세션식별 = require(path.join(__dirname, 'lib', '세션식별.js'));\nconst sid = 세션식별.자리id(process.env, input);";
  assert.equal(위반행들(처방).length, 0);
});

test('실저장소 — 옛 통로 0건(분모와 함께 읽는다)', (t) => {
  const 뿌리들 = [path.join(ROOT, 'tools'), path.join(ROOT, '.claude', 'hooks')];
  let 파일들;
  try {
    파일들 = 뿌리들.flatMap(js파일들);
  } catch (e) {
    /* repo 밖 환경(권한·부분 클론)에서 못 읽으면 **fail 이 아니라 skip** 이다 — F296. */
    t.skip(`실저장소를 못 훑었다(${e.code || e.message}) — 탐지력은 위 픽스처가 이미 쟀다`);
    return;
  }
  assert.ok(파일들.length > 20, `훑은 파일이 ${파일들.length}개뿐이다 — 분모가 이상하면 「0건」을 못 믿는다`);

  const 위반 = [];
  for (const p of 파일들) {
    const 상대 = path.relative(ROOT, p);
    if (면제.has(상대)) continue;
    let 글;
    try { 글 = fs.readFileSync(p, 'utf8'); } catch (_) { continue; }
    for (const { 행, 줄 } of 위반행들(글)) 위반.push(`${상대}:${행}  ${줄.trim().slice(0, 90)}`);
  }
  assert.deepEqual(위반, [],
    `옛 통로를 직접 읽는 자리 ${위반.length}건 (훑은 파일 ${파일들.length}개 · 면제 ${면제.size}개)\n`
    + `${위반.join('\n')}\n`
    + '→ 대신 `.claude/hooks/lib/세션식별.js` 를 부른다:\n'
    + "     const 세션식별 = require(path.join(__dirname, 'lib', '세션식별.js'));\n"
    + '     자리(상태 파일 키·보드 파일명) = 세션식별.자리id(process.env, input)\n'
    + '     연락(트레일러·메시지)         = 세션식별.연락id()\n'
    + '     보드 지문 8자리               = 세션식별.지문()\n'
    + '     기록·락 주인                  = 세션식별.표기id()');
});
