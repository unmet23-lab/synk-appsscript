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
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

/* 문턱 10분의 근거: 이 저장소의 실제 경합은 1초 미만이다(auto-commit 이 스스로 잡은 예산이
 * 300ms×3 = 0.9초). 10분은 그 600배라, 정상 경합이 여기 닿을 길이 없다. 반대쪽 오진
 * (진짜 긴 git 작업)은 지우지 않으므로 대가가 한 줄의 잔소리로 끝난다. */
const 기본문턱분 = Number(process.env.SYNK_GIT_LOCK_MIN || 10);

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
function 고아잠금줄(뿌리, { 문턱분 = 기본문턱분, 실패문 = '', 지금 = Date.now() } = {}) {
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
  return `   🔴 \`index.lock\` 이 **${표기}째**다 — 경합(1초 미만)이 아니라 **고아**일 수 있다. `
    + `이 상태면 재시도는 영영 안 통한다(실측 F493: 9시간 8분 · 그 창의 커밋 0건).\n`
    + `      ① 도는 git 이 없는지 본다 — \`node tools/lib/git잠금.js\` · PowerShell \`Get-Process git\`\n`
    + `      ② 없으면 치운다 — \`Remove-Item "${s.경로}"\` (**확인 뒤에만** · 이 도구는 지우지 않는다)`;
}

module.exports = { 잠금상태, 고아잠금줄, 기본문턱분 };

/* 읽기 전용 CLI — 처방 ①이 실제로 실행 가능해야 한다(F103: 따를 수 없는 처방은 우회를 정상 통로로 만든다). */
if (require.main === module) {
  const 뿌리 = process.env.SYNK_OWNER_ROOT || path.resolve(__dirname, '..', '..');
  const s = 잠금상태(뿌리);
  if (s.상태 === '없음') { process.stdout.write('[git잠금] index.lock 없음 — 인덱스는 열려 있다\n'); process.exit(0); }
  if (s.상태 === '못쟀다') { process.stdout.write(`[git잠금] 못 쟀다(${s.왜}) — 0건이 아니라 판정 불가다\n`); process.exit(0); }
  const 분 = Math.round(s.나이분);
  process.stdout.write(`[git잠금] index.lock ${분}분째 — ${분 >= 기본문턱분 ? '🔴 고아 의심' : '경합 범위'} (문턱 ${기본문턱분}분)\n`);
  process.stdout.write(`   ${s.경로}\n`);
  const ps = spawnSync('git', ['--version'], { encoding: 'utf8', timeout: 5000, windowsHide: true });
  if (!ps.error) process.stdout.write('   도는 git 이 있는지는 이 도구가 못 본다 — `Get-Process git` 로 직접 본다(지우기 전 필수)\n');
  process.exit(0);
}
