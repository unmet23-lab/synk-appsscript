'use strict';
/* 「도는 동안 바뀐 파일」 — 스냅샷 한 벌 + **두 갈래 가르기** (F616).
 *
 * 왜 갈랐나 (F616 · 2026-08-18 실측 2회):
 *   옛 판은 스냅샷을 `mtimeMs:size` 로만 찍고, 앞뒤가 다르면 전부 한 목록(`moved`)에 담아
 *   「**옆 세션이 편집 중**」이라 단정했다. 그런데 이 스위트에는 **산출물을 제자리에서 다시
 *   굽고 바이트를 원래대로 되돌리는 검사**가 있다(`tests/이해대장.test.js:495` 가 대표 —
 *   화면 회귀는 다시 그려야 생성기를 지킨다는 설계 의도다). 바이트는 같아도 mtime 은 바뀌므로
 *   옛 판은 그것을 「밖에서 바뀌었다」로 읽었다. 격리 컨테이너(다른 세션 0 · git status 전후
 *   빈 출력)에서 그 경고가 떴고, 처방문(「누구 파일인지는 작업본소유자.js」)은 아무도 없는
 *   목록을 가리켰다 — **따를 수 없는 처방**(F103).
 *
 * 🔑 새는 방향이 통과가 아니라 **「빨간 것을 안 믿게 만든다」**였다. 그 두 검사가 거의 모든
 *   전체 런에 끼므로 사실상 항상 「이 적색은 못 믿는다」가 따라붙었고, 「재실행하라」는 매번
 *   참이라 진짜 적색을 무한히 미룰 수 있었다. 초록의 분모(F207)의 거울상이다.
 *
 * 가르는 눈금 — stat 말고 **내용 지문**을 함께 찍는다:
 *   · 지문이 다르다        → 「밖에서」  = 도는 동안 내용이 실제로 달라졌다(사라진 것 포함).
 *   · 지문 같고 stat 만 다르다 → 「제자리」 = 다시 굽고 되돌아왔다. 창은 있었으나 **닫혔다.**
 *
 * ⚠ 대가(이 장치가 «틀릴 때의 모습»):
 *   ① 밖에서 진짜로 바뀌었다가 실행 끝에 **정확히 같은 바이트로** 돌아온 파일은 「제자리」 칸에
 *      앉는다. 그 판에서 「밖에서 0」은 틀린 문장이다. 그래서 「밖에서 0」일 때도 제자리 벌수를
 *      **같이** 낸다 — 칸을 지우지 않는 것이 이 설계의 값이다(단순 내용해시 판은 그 칸이 통째로
 *      사라져 창이 있었다는 사실 자체를 못 본다 · F598 ㉡ 방향).
 *   ② 지문은 sha1 이라 충돌은 이론상 가능하다. 여기 쓰임은 보안이 아니라 동일성 확인이다.
 *   ③ 읽기 비용이 는다 — 실측 2026-08-18: 대상 1,354벌 44.1MB, 스냅샷 1회 385ms(런당 ×2).
 *      스위트 전체가 수십 초라 몫이 작다.
 *   닫는 것 1개: 옛 단일 목록 `moved` 와 「옆 세션이 편집 중」 **단정**. 이제 단정하지 않는다.
 *
 * 회귀: tests/CI모사.test.js (픽스처로 탐지력, 실저장소로 거짓양성).
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

/* 테스트가 읽는 확장자만 본다 — 넓히면 스위트 자신의 임시물이 섞여 경고가 죽는다. */
const 확장자 = /\.(js|json|md|html|txt)$/i;
/* `.claude/state` 는 훅이 매 턴 갱신하는 런타임 상태라 늘 바뀐다 — 세면 경고에 노이즈만 는다. */
const 건너뛸이름 = new Set(['node_modules', '.git', 'state']);
/* 실측된 거짓 적색 2회의 진원지가 **Code.js(루트)** 와 **docs/ 아래 HTML** 이었다. */
const 대상방 = ['tests', 'tools', 'docs', '.claude'];
const 깊이 = 2;

function 지문(p) {
  return crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex');
}

/** 루트 아래 대상 파일들의 `{ stat, 지문 }` 스냅샷. 못 읽는 파일은 조용히 빠진다(사라진 파일). */
function 스냅샷(루트) {
  const out = new Map();
  const walk = (dir, depth) => {
    let ents;
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
    for (const e of ents) {
      if (건너뛸이름.has(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (depth > 0) walk(p, depth - 1); continue; }
      if (!확장자.test(e.name)) continue;
      try {
        const s = fs.statSync(p);
        out.set(path.relative(루트, p), { stat: `${s.mtimeMs}:${s.size}`, 지문: 지문(p) });
      } catch (_) { /* 사라진 파일 · 읽기 권한 없음 */ }
    }
  };
  walk(루트, 0);
  for (const d of 대상방) walk(path.join(루트, d), 깊이);
  return out;
}

/**
 * 전후 스냅샷 → 두 갈래.
 *   밖에서: 내용이 달라졌거나 사라진 것 — 「이 적색은 못 믿는다」의 근거.
 *   제자리: 바이트는 같은데 stat 만 달라진 것 — 창은 있었으나 닫혔다(분모).
 * 새로 **생긴** 파일은 어느 칸에도 안 센다 — 테스트가 읽던 대상이 아니었다.
 */
function 가르기(before, after) {
  const 밖에서 = [];
  const 제자리 = [];
  for (const [p, v] of after) {
    const b = before.get(p);
    if (!b) continue;
    if (b.지문 !== v.지문) 밖에서.push(p);
    else if (b.stat !== v.stat) 제자리.push(p);
  }
  for (const p of before.keys()) if (!after.has(p)) 밖에서.push(`${p} (삭제됨)`);
  return { 밖에서, 제자리 };
}

module.exports = { 스냅샷, 가르기, 확장자, 대상방 };
