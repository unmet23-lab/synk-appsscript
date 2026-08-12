#!/usr/bin/env node
'use strict';
/* review-runs — 세션 밖에서 도는 검수·심문을 **세션을 열 때마다** 눈앞에 세운다 (SessionStart).
 *
 * 왜 있나 (2026-08-12 · 유호님 「도전안으로 했는데 혹시나 니가 까먹고 처리가 잘 안될까봐 걱정되」):
 *   `--던지기` 는 30분짜리 판단 패스를 세션 수명에서 떼어낸다(F334 의 처방). 그 대가로
 *   **새 위험이 하나 생긴다 — 던져 놓고 잊는 것.** 유호님이 정확히 그것을 짚었다.
 *   기다리는 쪽이 사람이면 그건 도전안이 아니라 새 구멍이다.
 *
 * 🔑 그래서 줍는 쪽을 **기계로** 옮긴다. CLAUDE.md 신뢰성 조항: 「장치와 그 발동 조건은 같은
 *   커밋에서 정한다 — 스스로 발화하지 않는 장치는 안 돈다.」 이 훅이 그 발동 조건이다.
 *   세션이 바뀌어도, 심지어 던진 세션이 죽어도, 다음에 열리는 아무 세션에서나 울린다.
 *
 * 🔑 왜 SessionStart 인가: 던진 런의 수명(20~60분)이 세션 수명과 비슷하다. 그래서 「결과가
 *   나왔을 그때」와 「세션을 새로 여는 그때」가 실질적으로 겹친다. 편집 시점(PreToolUse)에
 *   걸면 이미 다른 일을 시작한 뒤라 늦고, 종료 시점에 걸면 그 세션은 이미 못 줍는다.
 *
 * ⚠ **가드가 아니라 알림이다.** 아무것도 막지 않는다 — 던진 런이 있다는 게 작업을 세울 이유는
 *   없다. 다만 안 보이면 안 줍게 되므로 보이게만 한다.
 *
 * ⚠ 침묵 조건은 **0건** 하나다. 던진 게 없으면 한 글자도 안 쓴다 — 상시 한 줄짜리 소음은
 *   사람이 훅 출력을 통째로 흘려보게 만들고, 그러면 진짜 울릴 때 안 보인다.
 *
 * ⚠ 탐지력은 픽스처 회귀(`tests/검수런.test.js`)가 진다 — 실저장소엔 대개 런이 0건이라
 *   여기서 초록은 「던진 게 없다」와 「훅이 죽었다」를 못 가른다(초록은 분모와 함께 읽는다).
 */

const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

/* ⚠ repo 밖 환경(git)에 기대는 조회다 — 못 돌면 **대조를 안 할 뿐** 알림 자체는 낸다.
 * 여기서 죽으면 던진 런이 통째로 안 보이게 되고, 그건 이 훅이 막으려던 바로 그것이다. */
function 현재HEAD() {
  try {
    return require('child_process')
      .execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .trim();
  } catch (_) { return ''; }
}

function main() {
  let 런;
  try {
    런 = require(path.join(ROOT, 'tools', 'lib', '검수런.js'));
  } catch (e) {
    /* 못 읽으면 **그 사실을 말한다** — 조용히 통과하면 「던진 게 없다」와 같은 모양이 된다. */
    console.error(`[review-runs] 검수런 모듈을 못 읽었다(${e.message}) — 던진 런이 있어도 안 보인다.`);
    process.exit(1);
  }

  let s;
  try { s = 런.요약(); } catch (e) {
    console.error(`[review-runs] 런 상태를 못 읽었다(${e.message})`);
    process.exit(1);
  }

  const 총 = s.완주미처분.length + s.멈춤.length + s.진행.length;
  if (!총) process.exit(0);   // 던진 게 없다 — 한 글자도 안 쓴다

  const 줄 = [];
  줄.push(`⏱ 세션 밖에서 도는 검수·심문 ${총}건 — 던져 놓고 **잊지 않기 위한** 알림이다.`);

  if (s.완주미처분.length) {
    줄.push('');
    줄.push(`✅ **완주했는데 아직 안 주운 것 ${s.완주미처분.length}건** — 결과가 이미 나와 있다. 지금 읽어라:`);
    for (const x of s.완주미처분) {
      줄.push(`   · ${x.런.런ID} (${x.런.종류} · ${x.판.분}분 전 시작 · 종료코드 ${x.런.종료코드 == null ? '?' : x.런.종료코드})`);
      줄.push(`     대상: ${x.런.대상}`);
      줄.push(`     로그: ${x.런.로그}`);
    }
    줄.push('   읽고 처분했으면 도장을 찍는다(찍기 전까진 세션마다 계속 뜬다):');
    줄.push('     node tools/codex-review.js --런처분 <런ID> --사유 "무엇을 했나"');
  }

  if (s.멈춤.length) {
    줄.push('');
    줄.push(`🔴 **멈춘 것 ${s.멈춤.length}건 — 통과가 아니다**(죽었거나 매달렸다):`);
    for (const x of s.멈춤) {
      줄.push(`   · ${x.런.런ID} (${x.런.종류} · ${x.판.분}분 경과 · ${x.판.사유 || ''})`);
      줄.push(`     로그 끝을 먼저 본다: ${x.런.로그}`);
      줄.push(`     이어받기: node tools/codex-review.js ${(x.런.인자 || []).join(' ')}`);
    }
    줄.push('   ↩ 이어받기는 **처음부터 다시가 아니다** — 끝난 회차는 체크포인트에서 그대로 돌아온다.');
  }

  if (s.진행.length) {
    const head = 현재HEAD();
    줄.push('');
    줄.push(`⏳ 도는 중 ${s.진행.length}건 — 기다리지 말고 다른 일을 해라:`);
    for (const x of s.진행) {
      줄.push(`   · ${x.런.런ID} (${x.런.종류} · ${x.판.분}분째) ${x.런.대상}`);
      /* F334 의 정면 — 「도는 사이 커밋이 나서 대상이 낡았는데 아무도 안 알려 계속 기다렸다」.
       * 낡음을 **판정하지 않는다**(대상 종류마다 조건이 다르다). 사실만 전하고 끄는 명령을 준다. */
      if (런.HEAD움직였나(x.런, head)) {
        줄.push(`     ⚠ **던진 뒤 HEAD 가 움직였다**(${String(x.런.HEAD).slice(0, 8)} → ${head.slice(0, 8)}) — 이 런의 대상이 낡았을 수 있다.`);
        줄.push('        ⚠ `--commit <sha>` 로 던진 것은 sha 가 고정이라 그 검수 자체는 유효하다 — 끄기 전에 대상을 본다.');
        줄.push(`        낡았으면 **그 자리에서 끈다**(안 끄면 쿼터를 계속 태운다):`);
        줄.push(`          node tools/codex-review.js --런중단 ${x.런.런ID} --사유 "왜"`);
      }
    }
  }

  줄.push('');
  줄.push('전체 조회: node tools/codex-review.js --런목록');
  console.log(줄.join('\n'));
  process.exit(0);
}

if (require.main === module) main();
module.exports = { main };
