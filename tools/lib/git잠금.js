/* git잠금 — `.git/index.lock` 이 «경합»인지 «고아»인지 나이로 가른다 (F493).
 *
 * 왜 있나: 이 저장소는 index.lock 을 **경합으로만** 다뤄 왔다 — auto-commit 은 300ms 3회,
 *   friction 은 「짧게만」, 인계문수거는 「전과 같이 전체를 접는다」, F226 도 경합판이었다.
 *   전부 「곧 풀린다」를 전제하고, 그 전제 위에서 「다음 실행이 다시 시도한다」고 말한다.
 *   2026-08-16 실측에서 그 전제가 깨졌다: 잠금이 **9시간 8분** 살아 커밋이 0건이었고
 *   (`639ee650` 08-15 23:15:12 → `9f4c80bb` 08-16 08:24:24), 그동안 장치들이 낸 말은
 *   경합일 때 참이고 고아일 때 거짓인 그 한 문장뿐이었다. 지침 v9.2 맹점 ④ —
 *   장치는 안 도는 쪽보다 **맞는 얼굴로 틀린 값**을 내는 쪽으로 더 자주 샌다.
 *
 * 무엇을 하고 무엇을 안 하나:
 *   · 한다  = 나이를 재서 문턱을 넘으면 **한 줄 말한다**.
 *   · 안 한다 = **지우지 않는다.** 이 저장소는 세션 10개가 동시에 도는 판이라 「지금 아무도
 *     안 쓴다」를 기계가 확신할 수 없다 — 진짜 도는 git(대형 checkout·gc)을 죽이면 비가역이다.
 *     그래서 오진의 대가가 「사람이 한 번 확인한다」로 끝나게 설계했다.
 *   · 안 한다 = **막지 않는다.** 재시도·접기 동작은 바이트 그대로다. 이 통로는 오직 덧붙인다.
 *
 * ⚠ 나이는 mtime 으로 잰다 — 잠금을 쥔 채 인덱스를 계속 쓰는 프로세스는 mtime 이 갱신돼
 *   **어려 보인다** ⇒ 경합으로 읽혀 침묵한다. 새는 방향이 「조용함」이라 오경보를 안 만든다.
 *   (반대 방향으로 새면 매 세션 거짓 경보가 되고, 그건 곧 안 읽히는 장치가 된다.)
 *
 * ⚠ 「모름」을 「없음」으로 접지 않는다 — 상태는 셋이다(없음 · 있음 · 못쟀다). 부르는 쪽이
 *   실패문에 `index.lock` 이 있다고 알려주면, 못 쟀을 때도 그 사실을 말한다(F207 축).
 *
 * ── F562(2026-08-17) 이후 · 나이를 잰 «다음»이 막혀 있었다 ────────────────────────────
 * 나이 게이트는 제 일을 했는데 처방이 도달 불가였다. 옛 처방은 ①`Get-Process git` 으로 도는
 *   git 이 없나 보고 ②**없으면** 치우라고 했다. 그런데 잠금을 만드는 주체가 `git commit` 이고
 *   그 pre-commit 훅이 자식 git 을 띄운다 — 부모가 죽으면 그 자식이 죽은 파이프에 막혀
 *   **CPU 0으로 영원히 산다.** 실측: 잠금 26분 · `Get-Process git` 은 PID 24364 를 돌려줬고,
 *   그건 `git diff --cached …`(훅 22행의 자식)에 부모 30384 는 이미 죽어 있었다. 즉 고아 잠금
 *   사건에서는 「도는 git」이 거의 언제나 하나 이상 남아 ②의 조건이 **영영 안 켜진다** — F103
 *   그 자리다. 89행이 스스로 「처방 ①이 실행 가능해야 한다」고 적어 뒀는데, ①을 *실행* 가능하게만
 *   만들고 *판정* 가능하게는 안 만든 것이 급소였다.
 *
 * 그래서 여기서 자동화하는 것은 **지우기가 아니라 가르기**다. 도는 git 을 열어 셋으로 답한다:
 *   고아다(치워도 된다) · 살아있다(무엇을 하는 중인지 이름을 대고 기다려라) · 못 가렸다.
 *   · 여전히 **안 지운다.** 🚫자동 삭제는 그대로다 — 명령줄을 사람이 읽고 결정한다.
 *   · 새는 방향이 안전하다: 두 재료가 **둘 다** 고아를 가리킬 때만 「치워도 된다」로 내려간다.
 *     하나라도 어긋나면 「기다려라」 — 그건 이 장치가 생기기 전의 기본값 그대로다. 그래서 이
 *     장치는 오늘보다 나쁜 상태를 새로 만들 수 없다(대가는 아래 ⚠).
 * ⚠ 틀릴 때의 모습: **느린 네트워크에 막힌 진짜 git**(예: 먹통 원격을 기다리는 `fetch`)이
 *   detach 돼 부모까지 죽어 있으면 CPU 도 0이라 「고아」로 읽힌다. 그래서 판정문에 **명령줄을
 *   그대로 싣는다** — `fetch`·`clone`·`gc` 가 보이면 사람이 멈춘다. 그리고 도구는 안 죽인다.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

/* 문턱 10분의 근거: 이 저장소의 실제 경합은 1초 미만이다(auto-commit 이 스스로 잡은 예산이
 * 300ms×3 = 0.9초). 10분은 그 600배라, 정상 경합이 여기 닿을 길이 없다. 반대쪽 오진
 * (진짜 긴 git 작업)은 지우지 않으므로 대가가 한 줄의 잔소리로 끝난다. */
const 기본문턱분 = Number(process.env.SYNK_GIT_LOCK_MIN || 10);

/* CPU 표본 간격. 진짜 일하는 git 은 이 창에서 CPU 를 태우고, 죽은 파이프에 막힌 고아는 정확히 0이다.
 * ⚠ 이 비용은 **나이 게이트를 이미 넘은 회차에서만** 든다 — 그때 저장소는 이미 멈춰 있으므로
 *   1초 남짓은 원인을 이름 대는 값으로 싸다. 평소 회차(잠금 없음·어린 잠금)는 여기 닿지 않는다. */
const 기본표본간격ms = Number(process.env.SYNK_GIT_LOCK_SAMPLE_MS || 1200);

/* 「멎었다」의 문턱. 0으로 두면 스케줄러 잡음 한 틱에 「살아있다」로 뒤집히고, 그러면 새는 방향이
 * 「영영 기다려라」(=옛 병)가 된다. 10ms/1.2초 = 0.8% — 막힌 프로세스는 0이고 일하는 git 은 훨씬 크다. */
const 정지문턱ms = 10;

/* ── 도는 git 을 여는 층 ──────────────────────────────────────────────────────────
 * 낼 것은 **표본 «쌍»**이다 — `{첫, 둘}`, 각 칸이 `{git:[{pid,부모pid,명령줄,cpums}], 산pid:Set}`.
 * 왜 한 번에 둘이냐: CPU 는 «증가분»으로만 뜻이 있는데, 표본을 두 번 따로 뜨면 그 비용(윈도에선
 *   PowerShell 기동 ~2초)을 두 번 문다. 실측 5.7초였고, 이 줄은 Stop 훅이 매 턴 지나는 자리라
 *   그대로 두면 「원인을 아는 대가」가 「매 턴 5.7초」가 된다. 그래서 대기까지 플랫폼 쪽으로 내린다.
 * ⚠ 못 재는 플랫폼이 있다는 사실 자체를 접지 않는다 — 못 재면 판정은 「못가렸다」로 내려가지
 *   「고아 아님」이 되지 않는다(F207 축). */

/** 한 표본의 날 JSON → 정규화. 어느 플랫폼이 재든 여기 한 곳에서만 모양을 정한다. */
function 표본정규화(j) {
  const 산pid = new Set([].concat((j && j.pids) || []).map(Number));
  const git = [].concat((j && j.git) || []).filter(Boolean).map((g) => ({
    pid: Number(g.pid), 부모pid: Number(g.ppid),
    명령줄: String(g.cmd || '').trim(),
    cpums: Number(g.cpu || 0),
  }));
  return { git, 산pid };
}

/** Windows — PowerShell **한 번**에 두 표본을 뜬다(대기도 그 안에서). CPU 는 100ns 틱이라 ÷10000. */
function 윈도우쌍(표본간격ms) {
  const PS = [
    "$ErrorActionPreference='Stop'",
    'function Snap {',
    '  $g=@(Get-CimInstance Win32_Process -Filter "Name=\'git.exe\'" | ForEach-Object {',
    '    [pscustomobject]@{ pid=[int]$_.ProcessId; ppid=[int]$_.ParentProcessId;',
    '      cmd=[string]$_.CommandLine; cpu=[double](($_.KernelModeTime + $_.UserModeTime) / 10000) } })',
    '  $p=@(Get-Process | Select-Object -ExpandProperty Id)',
    '  [pscustomobject]@{ git=$g; pids=$p }',
    '}',
    '$a=Snap',
    `Start-Sleep -Milliseconds ${Math.max(0, Math.round(표본간격ms))}`,
    '$b=Snap',
    'ConvertTo-Json -Compress -Depth 4 -InputObject @{ a=$a; b=$b }',
  ].join('\n');

  let 마지막 = 'powershell 을 못 띄웠다';
  for (const exe of ['powershell', 'pwsh']) {
    const r = spawnSync(exe, ['-NoProfile', '-NonInteractive', '-Command', PS],
      { encoding: 'utf8', timeout: 20000 + 표본간격ms, windowsHide: true });
    if (r.error || r.status !== 0) {
      마지막 = String((r.error && r.error.message) || r.stderr || '').trim().split('\n')[0] || `${exe} 실패`;
      continue;
    }
    let j;
    try { j = JSON.parse(String(r.stdout || '')); } catch (e) { 마지막 = `출력을 못 읽었다(${exe})`; continue; }
    return { 첫: 표본정규화(j && j.a), 둘: 표본정규화(j && j.b) };
  }
  throw new Error(마지막);
}

/** Linux — `/proc` 직접 읽기(자식 0 · 틱 해상도). 대기는 여기서 동기로 판다. */
function 리눅스한판() {
  const 틱 = 100;                                  // USER_HZ — 리눅스 기본값
  const pids = []; const git = [];
  for (const 이름 of fs.readdirSync('/proc')) {
    if (!/^\d+$/.test(이름)) continue;
    pids.push(Number(이름));
    let stat;
    try { stat = fs.readFileSync(`/proc/${이름}/stat`, 'utf8'); } catch (e) { continue; }
    // comm 은 괄호 안이고 공백·괄호를 품을 수 있다 — **마지막** ')' 로 가른다.
    const 닫 = stat.lastIndexOf(')');
    if (닫 < 0) continue;
    if (stat.slice(stat.indexOf('(') + 1, 닫) !== 'git') continue;
    const 뒤 = stat.slice(닫 + 2).split(' ');       // 뒤[0]=state · 뒤[1]=ppid · utime=뒤[11] · stime=뒤[12]
    let cmd = '';
    try { cmd = fs.readFileSync(`/proc/${이름}/cmdline`, 'utf8').replace(/\0/g, ' ').trim(); } catch (e) { /* 사라졌다 */ }
    git.push({ pid: Number(이름), ppid: Number(뒤[1]), cmd,
      cpu: ((Number(뒤[11]) || 0) + (Number(뒤[12]) || 0)) * (1000 / 틱) });
  }
  if (!pids.length) throw new Error('/proc 가 비었다');
  return { git, pids };
}

function 리눅스쌍(표본간격ms) {
  const 첫 = 표본정규화(리눅스한판());
  // ⚠ 바쁜 기다림(스핀)으로 때우지 않는다 — 그 자체가 CPU 를 태워 재려는 값을 흔든다.
  if (표본간격ms > 0) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 표본간격ms);
  return { 첫, 둘: 표본정규화(리눅스한판()) };
}

/* 회귀는 **픽스처가 진다** — 실기계의 프로세스 상태는 회차마다 다르고(세션 10개 동시), repo 밖
 * 환경에 기댄 검사는 CI 에서 깨진다(F296). 그래서 표본을 통째로 갈아끼우는 구멍을 하나만 둔다.
 * `{a,b,pids}` 로 두 표본을 따로 주거나, `{git,pids}` 하나만 주면 «둘 다 그대로»(=전부 멎음)다. */
function 기본쌍내기(표본간격ms) {
  const 주입 = process.env.SYNK_GIT_LOCK_PROC;
  if (주입) {
    const j = JSON.parse(주입);                     // 못 읽으면 던진다 = 「못가렸다」 (조용히 넘기지 않는다)
    if (j && (j.a || j.b)) {
      return { 첫: 표본정규화({ ...j.a, pids: (j.a && j.a.pids) || j.pids }),
        둘: 표본정규화({ ...j.b, pids: (j.b && j.b.pids) || j.pids }) };
    }
    return { 첫: 표본정규화(j), 둘: 표본정규화(j) };
  }
  if (process.platform === 'win32') return 윈도우쌍(표본간격ms);
  if (process.platform === 'linux') return 리눅스쌍(표본간격ms);
  throw new Error(`${process.platform} 에서는 프로세스를 여는 통로가 없다`);
}

/**
 * 도는 git 을 열어 잠금이 «고아»인지 가른다 — 지우지 않고, 죽이지도 않는다.
 *
 * 재료 둘을 **함께** 본다(하나만 보면 둘 다 틀린다):
 *   ㉠ 부모 생사 — 고아 자식은 부모가 목록에 없다. 살아있는 세션의 git 은 부모가 있다.
 *   ㉡ CPU 증가분 — 진짜 일하는 git(checkout·gc)은 태우고, 막힌 것은 정확히 0이다.
 * 둘 다 고아를 가리켜야 「고아」다. 어긋나면 「살아있다」 = 기다려라(옛 기본값).
 *
 * @returns {{상태:'못가렸다',왜:string}
 *          |{상태:'없음'}
 *          |{상태:'고아',고아:object[]}
 *          |{상태:'살아있다',산것:object[],고아:object[]}}
 */
function 프로세스판정({ 쌍내기 = 기본쌍내기, 표본간격ms = 기본표본간격ms } = {}) {
  let 쌍;
  try { 쌍 = 쌍내기(표본간격ms); } catch (e) { return { 상태: '못가렸다', 왜: String((e && e.message) || e) }; }
  const 첫 = 쌍 && 쌍.첫; const 둘 = 쌍 && 쌍.둘;
  if (!첫 || !둘 || !Array.isArray(첫.git) || !Array.isArray(둘.git)) {
    return { 상태: '못가렸다', 왜: '표본 쌍의 모양이 아니다' };
  }
  /* 🔴 새는 방향이 가장 나쁜 자리 — pid 목록이 비면 «모든» 부모가 죽은 것으로 읽혀 전건이 고아가 되고,
   *   그 판정문은 「치워도 된다」다. 판정을 플랫폼 구현에 두면 통로마다 갈리므로 여기 한 곳에서 막는다. */
  if (!첫.산pid.size || !둘.산pid.size) return { 상태: '못가렸다', 왜: 'pid 목록이 비었다 — 부모 생사를 못 가른다' };

  const 첫pid = new Set(첫.git.map((g) => g.pid));
  const 나중 = new Map(둘.git.map((g) => [g.pid, g]));
  const 고아 = []; const 산것 = [];
  for (const g of 첫.git) {
    const n = 나중.get(g.pid);
    if (!n) continue;                               // 그 사이 스스로 끝났다 = 문제가 아니다
    const 증가ms = Math.max(0, (n.cpums || 0) - (g.cpums || 0));
    const 부모죽음 = !둘.산pid.has(g.부모pid) && !첫.산pid.has(g.부모pid);
    const 칸 = { ...g, 증가ms, 부모죽음, 멎음: 증가ms <= 정지문턱ms };
    if (부모죽음 && 칸.멎음) 고아.push(칸); else 산것.push(칸);
  }
  /* 🔴 **둘째 표본에만 있는 git 은 「없음」이 아니다.** 첫 표본이 비었다고 곧장 `없음` 을 내던 자리가
   *   이 판정의 급소였다(①배포 검수 P1 · 2026-08-17): 표본 사이에 git 이 «새로 뜨면» 그 사실이
   *   어느 갈래에도 안 잡히고, 부르는 쪽은 그 침묵을 「도는 git 이 없다 = 잠금은 고아다 = 치워도 된다」로
   *   번역한다 — 실제로 일하고 있는 git 의 잠금을 지우라고 권하는 모양이다.
   *   범위는 지적보다 한 칸 넓다: 위 루프는 **첫 표본만** 훑으므로 첫이 비지 않았어도 새로 뜬 git 은
   *   전 구간에서 안 보였고, 첫 것들이 다 끝나면 아래 `없음` 으로 같은 거짓이 났다.
   * 🔑 CPU 증가분을 잴 «앞판»이 없어 멎음을 원리상 못 가른다. 그래서 고아 후보로 올리지 않고
   *   **산 것**으로 센다 — 이 판정에서 틀릴 때의 방향은 언제나 「기다려라」여야 한다(치워라 쪽으로
   *   새면 되돌릴 수 없다). `새로뜸` 을 박아 판정문이 「왜 못 쟀는지」를 말할 수 있게 남긴다. */
  for (const g of 둘.git) {
    if (첫pid.has(g.pid)) continue;
    산것.push({ ...g, 증가ms: 0, 부모죽음: !둘.산pid.has(g.부모pid), 멎음: false, 새로뜸: true });
  }
  if (!고아.length && !산것.length) return { 상태: '없음' };   // 두 표본 다 비었거나 그 사이 다 끝났다
  if (산것.length) return { 상태: '살아있다', 산것, 고아 };
  return { 상태: '고아', 고아 };
}

/** 판정문에 실을 한 줄 — 명령줄이 곧 사람의 판단 재료다(⚠ 오진의 유일한 안전장치). */
function 프로세스줄(g) {
  /* ⚠ `새로뜸` 에 `CPU +0.000초` 를 찍으면 **멎은 것과 같은 모양**이 된다(맹점 ④ — 맞는 얼굴로 틀린 값).
   *   못 잰 것이니 못 쟀다고 적는다: 「0 은 분모와 함께」의 이 함수판이다. */
  const 왜 = [g.부모죽음 ? `부모 ${g.부모pid} 죽음` : `부모 ${g.부모pid} 살아있음`,
    g.새로뜸 ? 'CPU 증가분 못 쟀다(표본 사이에 새로 떴다 — 앞판이 없다)'
      : `CPU +${(g.증가ms / 1000).toFixed(3)}초`].join(' · ');
  const 명 = g.명령줄 ? g.명령줄.replace(/\s+/g, ' ').slice(0, 160) : '(명령줄을 못 읽었다)';
  return `        · PID ${g.pid}  ${왜}\n          ${명}`;
}

/** 이 작업본의 git 디렉터리. 워크트리면 `.git/worktrees/<이름>` 이라 손으로 조립하면 틀린다. */
function git디렉터리(뿌리) {
  const r = spawnSync('git', ['rev-parse', '--git-dir'], {
    cwd: 뿌리, encoding: 'utf8', timeout: 5000, windowsHide: true,
  });
  if (r.error || r.status !== 0) return null;
  const 값 = String(r.stdout || '').trim();
  return 값 ? path.resolve(뿌리, 값) : null;
}

/** 잠금의 지금 상태. `{상태:'없음'}` · `{상태:'있음', 나이분, 경로}` · `{상태:'못쟀다', 왜}`. */
function 잠금상태(뿌리, 지금 = Date.now()) {
  const g = git디렉터리(뿌리);
  if (!g) return { 상태: '못쟀다', 왜: 'git-dir 를 못 읽었다' };
  const 경로 = path.join(g, 'index.lock');
  let st;
  try {
    st = fs.statSync(경로);
  } catch (e) {
    // ENOENT 는 「없다」가 맞다 — 그 밖(권한 등)은 「못 쟀다」로 남긴다.
    if (e && e.code === 'ENOENT') return { 상태: '없음' };
    return { 상태: '못쟀다', 왜: String((e && e.code) || e) };
  }
  return { 상태: '있음', 경로, 나이분: Math.max(0, (지금 - st.mtimeMs) / 60000) };
}

/** 실패문에 붙일 한 줄(끝에 개행 없음). 붙일 말이 없으면 `''`.
 *  @param 실패문 부르는 쪽이 쥔 git 실패 메시지 — 잠금이 «걸렸다»는 사실의 유일한 증거라
 *         나이를 못 쟀을 때 「못 가른다」를 말할 수 있게 한다. */
function 고아잠금줄(뿌리, { 문턱분 = 기본문턱분, 실패문 = '', 지금 = Date.now(), ...가름옵션 } = {}) {
  const 잠금언급 = /index\.lock/i.test(String(실패문 || ''));
  const s = 잠금상태(뿌리, 지금);

  if (s.상태 === '못쟀다') {
    if (!잠금언급) return '';
    return `   ⚠ 잠금 나이를 못 쟀다(${s.왜}) — 경합인지 고아인지 **안 가려졌다**(둘 중 하나로 단정하지 않는다).`;
  }
  if (s.상태 === '없음') {
    // 실패문은 잠금을 말하는데 지금은 없다 = 그 사이 풀렸다. 재시도가 실제로 통하는 판이라 조용히 둔다.
    return '';
  }
  if (s.나이분 < 문턱분) return '';   // 경합 — 「다음 실행이 다시 시도한다」가 참이다.

  const 분 = Math.round(s.나이분);
  const 표기 = 분 >= 120 ? `${Math.floor(분 / 60)}시간 ${분 % 60}분` : `${분}분`;
  /* ⚠ 머리글은 **나이만** 말한다. 옛 판은 여기서 「재시도는 영영 안 통한다」를 무조건 달았는데,
   *   진짜 도는 git 이 쥔 회차에서는 그게 거짓이다(기다리면 풀린다) — 이 트랙이 잡으려는 바로 그
   *   모양(맞는 얼굴로 틀린 값)이라, 그 단정은 참인 갈래(고아·없음)로 내렸다. */
  const 머리 = `   🔴 \`index.lock\` 이 **${표기}째**다 — 경합(1초 미만)이 아니라 **고아**를 의심하는 나이다`
    + `(실측 F493: 9시간 8분 · 그 창의 커밋 0건).`;
  return `${머리}\n${가름문(프로세스판정(가름옵션), s.경로)}`;
}

/** 가름 결과 → 처방. **어느 갈래에서도 이 도구는 지우지도 죽이지도 않는다**(🚫자동 삭제). */
function 가름문(판정, 경로) {
  const 치우기 = `\`Remove-Item "${경로}"\``;

  if (판정.상태 === '못가렸다') {
    // 못 가른 회차를 「고아 아님」으로도 「고아」로도 접지 않는다 — 셋째 칸이 여기서도 산다(F207).
    return `      ❔ **가르지 못했다**(${판정.왜}) — 「고아가 아니다」가 아니라 **안 가려졌다**.\n`
      + `      → 손으로 가른다 — 도는 git 마다 **부모가 살아있나**와 **CPU 가 오르나**를 «둘 다» 본다(둘 다 아니면 고아):\n`
      + `          Get-CimInstance Win32_Process -Filter "Name='git.exe'" | Select ProcessId,ParentProcessId,CommandLine\n`
      + `      → 치우는 건 그 뒤다 — ${치우기} (이 도구는 지우지 않는다)`;
  }

  if (판정.상태 === '없음') {
    return `      ✅ **가름 = 고아다** — 도는 git 이 **0개**다(방금 셌다). 이 잠금을 쥔 프로세스는 없으니 `
      + `**재시도는 영영 안 통한다**.\n`
      + `      → 치운다 — ${치우기} (이 도구는 지우지 않는다)`;
  }

  if (판정.상태 === '고아') {
    const 목록 = 판정.고아.map(프로세스줄).join('\n');
    const 죽이기 = 판정.고아.map((g) => g.pid).join(',');
    return `      ✅ **가름 = 고아다** — 도는 git ${판정.고아.length}개가 **전부** 부모가 죽었고 CPU 가 멎었다`
      + ` — 저 혼자로는 안 끝나니 **재시도는 영영 안 통한다**:\n${목록}\n`
      + `      ⚠ 명령줄을 **먼저 읽는다** — \`fetch\`·\`clone\`·\`gc\` 면 느린 네트워크에 막힌 «진짜» git 일 수 있다(그땐 기다린다).\n`
      + `      → 읽고 나서 끝낸 뒤 치운다 — \`Stop-Process -Id ${죽이기} -Force\` · ${치우기}\n`
      + `        (이 도구는 죽이지도 지우지도 않는다 — 명령줄을 읽고 사람이 정한다)`;
  }

  // 살아있다 — 옛 기본값(기다려라)이 여기서만 참이다. 이 갈래는 «치우지 마라»가 결론이다.
  const 목록 = 판정.산것.map(프로세스줄).join('\n');
  const 곁 = 판정.고아.length ? `\n      ⚠ 그 옆에 멎은 git 이 ${판정.고아.length}개 더 있지만, 산 놈이 하나라도 있으면 **치우지 않는다**.` : '';
  return `      ⛔ **가름 = 살아있다** — 치우지 마라(도는 git 을 죽이면 비가역이다). 지금 일하는 git ${판정.산것.length}개:\n${목록}${곁}\n`
    + `      → 끝날 때까지 기다린다. 몇십 분째 그대로면 **그 작업 자체가 원인**이니 그쪽을 본다.`;
}

/** 커밋해도 되는 상태인가 — rebase·merge·bisect 중이거나 HEAD 가 분리돼 있으면 거른다.
 *  그때의 커밋은 남의 진행 중 작업에 끼어들거나(F035·F038) 붙을 가지가 없다.
 *
 *  🔑 2026-08-20 이사: 이 판정은 `tools/인계문수거.js(⚠삭제됨 8780e5f3 2026-08-20 — 지금 없다)` 에 살았고 `보드수거.js` 가 빌려 썼다.
 *     인계문 층을 하네스에 위임하며 그 파일을 걷었는데, 이 함수는 인계문과 무관한
 *     «git 상태» 판정이라 같은 식구인 여기로 옮긴다(두 곳에 적으면 두 수거기가 서로 다른
 *     「지금 커밋해도 되나」를 보게 된다 — 옮기는 이유가 그것이다). 바이트 동일.
 *  @returns {string|null} 못 하는 이유, 또는 null(=해도 된다) */
function 커밋못하는이유(뿌리) {
  const R = 뿌리 || path.resolve(__dirname, '..', '..');
  const d = spawnSync('git', ['rev-parse', '--git-dir'], { cwd: R, encoding: 'utf8' });
  if (d.status !== 0) return 'git 을 못 불렀다';
  const g = path.resolve(R, String(d.stdout || '').trim());
  for (const m of ['rebase-merge', 'rebase-apply', 'MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'BISECT_LOG']) {
    if (fs.existsSync(path.join(g, m))) return `${m} — 진행 중인 git 작업이 있다`;
  }
  if (spawnSync('git', ['symbolic-ref', '-q', 'HEAD'], { cwd: R, encoding: 'utf8' }).status !== 0) {
    return 'HEAD 분리 상태 — 커밋이 가지 없이 떠돈다';
  }
  return null;
}

module.exports = { 잠금상태, 고아잠금줄, 프로세스판정, 커밋못하는이유, 기본문턱분, 기본표본간격ms, 정지문턱ms };

/* 읽기 전용 CLI — 처방 ①은 **실행 가능**할 뿐 아니라 **판정 가능**해야 한다.
 * F562 전에는 여기서 「도는 git 이 있는지는 이 도구가 못 본다」로 끝나, 사람이 `Get-Process git` 을
 * 쳐도 「git 이 하나 있다」밖에 못 얻었다 — 그 하나가 고아인지 산 놈인지가 정확히 유일한 질문인데.
 * 이제 이 CLI 가 그 질문에 답한다(그래도 지우지는 않는다 · 🚫자동 삭제). */
if (require.main === module) {
  const 뿌리 = process.env.SYNK_OWNER_ROOT || path.resolve(__dirname, '..', '..');
  const s = 잠금상태(뿌리);
  if (s.상태 === '없음') { process.stdout.write('[git잠금] index.lock 없음 — 인덱스는 열려 있다\n'); process.exit(0); }
  if (s.상태 === '못쟀다') { process.stdout.write(`[git잠금] 못 쟀다(${s.왜}) — 0건이 아니라 판정 불가다\n`); process.exit(0); }
  const 분 = Math.round(s.나이분);
  process.stdout.write(`[git잠금] index.lock ${분}분째 — ${분 >= 기본문턱분 ? '🔴 고아 의심 나이' : '경합 범위'} (문턱 ${기본문턱분}분)\n`);
  process.stdout.write(`   ${s.경로}\n`);
  /* 나이와 무관하게 «가른다» — 사람이 이 도구를 직접 부른 회차는 이미 「무슨 일이냐」를 묻는 자리다. */
  process.stdout.write(`${가름문(프로세스판정(), s.경로)}\n`);
  process.exit(0);
}
