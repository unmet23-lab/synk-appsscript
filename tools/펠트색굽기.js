/* 펠트 마스코트를 «킷 코랄»로 다시 굽는다 — 유호 지시 08-15 (「펠트로 바뀌었어 · 색상은 코랄색으로」).
 *
 * 왜 다시 굽나(실측 08-15): `펠트코랄_0815/재염색_본체.png` 는 프롬프트에 "coral-red wool" 이라
 * 적고 구웠는데 코어가 `#C55143` 로 착지했다 — 킷 Coral `#FF6B5C` 과 ΔE2000 13.4,
 * 그리고 유호님이 08-02 에 「강렬하나 칙칙」으로 **기각한 V9 레드 `#C74A3A` 와 ΔE 1.9**.
 * 라벨은 코랄인데 픽셀은 벽돌이었다.
 *
 * 🔑 통로 = **색을 낱말로 주지 않고 «참조»로 준다.**
 *   `파생굽기.js` 머리말의 실측이 근거다 — 문장으로 「the same orb」라고 못박아도 호출이 갈리면
 *   색이 갈렸고(ΔH 16), 참조에 물리자 붙었다(ΔH 1.8). `펠트_색_체리핑크` 가 목표 `#FB7A87` 에서
 *   ΔE 7.9 벗어난 것도 같은 원인이다(프롬프트에 hex 를 적어 참조와 싸웠다).
 *   그래서 참조 2장을 넣는다:
 *     ①`재염색_본체.png` — 형태·재질·«정확한 목표색»을 동시에 진다.
 *        (`tools/펠트색갈이.py` 가 선형광 게인으로 결정론적으로 만든 것 · 코어 ΔE 3.45)
 *     ②`코랄견본.png` — 킷 코랄 램프 4단 색표. 명암이 어느 색으로 가야 하는지의 지시.
 *
 * ⚠검수는 이 파일이 하지 않는다 — 굽는 쪽이 스스로 합격을 선언하면 그 초록은 아무것도 증명하지 못한다.
 *   측정은 `python tools/펠트색갈이.py` 와 같은 정의로 따로 돌린다.
 * ⚠산출물은 정본 이름을 덮지 않는다 — 유호님이 눈으로 고른 뒤에 사람이 바꿔 넣는다.
 * ⚠돈이 든다(1컷 ≈ 190원).
 *
 * 사용법:
 *   node tools/펠트색굽기.js            # 전부
 *   node tools/펠트색굽기.js 코랄_본체   # 하나만
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { 키, 한컷, 배치게이트 } = require('./lib/이미지굽기');

const REPO = path.resolve(__dirname, '..');
/* 정본 폴더는 손으로 안 든다(2026-08-20) — 주인은 `docs/디자인_토큰.json` 이고
 * `lib/마스코트자산.js` 가 창구다. 정본이 갈리면 이 도구가 저절로 따라간다. */
const 폴더 = path.join(REPO, require('./lib/마스코트자산.js').정본폴더);
/* 🔴 2026-09-05 저녁 — **이 도구는 지금 못 돈다.** 참조 두 장이 옛 세트(`펠트코랄_0815`)에만
 *   있었고 그 폴더를 그날 지웠다(유호 지시 「옛날것들은 과감히 지워줘」).
 *   ⚠ 폴더는 위처럼 정본에서 «묻고» 있어서 저절로 정본_4K 를 가리키는데, **파일 이름 둘이
 *     옛 세트의 것**이라 그 폴더엔 없다. 그래서 아래 존재 검사가 곧바로 멈춰 세운다 —
 *     조용히 지나가지 않는 것이 이 자리의 유일한 옳은 동작이다.
 *   🔑 다시 돌리려면 먼저 **정본_4K 에서 코랄 견본을 새로 떠야 한다.** 옛 그림은 git 이 쥔다
 *     (`git log --all -- docs/캐릭터/펠트코랄_0815`). 재염색 자체가 09-05 에 내려갔으므로
 *     (「색 표현이 싸구려 같아」) 견본을 «재염색 산출물»에서 뜨는 옛 전제부터 다시 정한다. */
const 참조 = {
  재염색: path.join(폴더, '재염색_본체.png'),
  견본: path.join(폴더, '코랄견본.png'),
};

const 스튜디오 = `Studio product photography lighting from upper left, floating object with no ground
shadow, centered on a plain light gray background (#E6E4E2), ultra high resolution, clean minimal
luxury aesthetic. No text, no letters, no numbers, no logo, no watermark.`;

/* 「색은 참조가 진다」를 매번 같은 문장으로 못박는다 — 이 문장이 흔들리면 색이 다시 갈린다.
 * hex 를 «적지 않는다»: 적으면 모델이 참조와 낱말 사이에서 타협해 중간값으로 착지한다. */
const 색규약 = `CRITICAL — the wool color must match the reference images exactly: the bright warm
coral of the first reference image, and the color chart in the last reference image. Do not shift the
hue toward brick, terracotta, rust, brown or deep red. Do not darken or desaturate it. The wool is a
bright, warm, slightly pink-leaning coral.`;

const 유지규약 = `Keep everything else identical to the first reference image: the exact same
silhouette (rounded dome head, wavy flowing bottom edge), the same proportions, the same camera angle,
the same centered composition, the same total height in frame, the same delicate cream hand-stitched
accents along the bottom edge, and the same lighting direction.`;

const 작업들 = [
  {
    이름: '코랄_본체',
    비율: '1:1',
    참조: [참조.재염색, 참조.견본],
    지시: `Re-render the needle-felted wool mascot from the first reference image as a premium
handcrafted needle-felted wool figurine. Premium handcrafted needle-felted wool material, soft dense
wool with visible fuzzy fiber texture and fine loose fibers catching the light along the silhouette,
warm artisanal craft quality. Two small round glossy black bead eyes exactly where the reference has
them. No mouth, no other facial features. ${색규약} ${유지규약} ${스튜디오}`,
  },
  {
    이름: '코랄_눈웃음',
    비율: '1:1',
    참조: [],
    런타임참조: ['코랄_본체'],
    대체참조: [참조.재염색],
    지시: `Take the felted mascot in the reference image and change ONLY the eyes: replace the two
round black bead eyes with happy smiling eyes — two upward-curved arcs (^ ^) in dark stitched thread,
the classic warm eye-smile. Everything else must be pixel-identical to the reference: same silhouette,
same wool fiber texture, same wool color, same cream hand-stitching, same lighting, same size, same
position, same background. Absolutely no mouth. ${스튜디오}`,
  },
  /* ── 전 세트 재파생 — 유호 픽 08-15 「1.ㄴ」=㉡네이티브 판 확정 ──
   * ㉡ 본체가 ㉠보다 +3.8% 커서 표정·¾ 를 그 판에서 다시 파생시켜야 교대 때 안 튄다.
   * 좌¾ 는 굽지 않는다 — 「VIEWER'S LEFT」 지시도 우향으로 구워지는 실측이 있어(memory/
   * mascot-felt-liveness ①) `python tools/컷미러.py 코랄_우34 → 코랄_좌34` 가 정본 통로다. */
  {
    이름: '코랄_눈감음',
    비율: '1:1',
    참조: [],
    런타임참조: ['코랄_본체'],
    대체참조: [참조.재염색],
    지시: `Take the felted mascot in the reference image and change ONLY the eyes: replace the two
round black bead eyes with closed eyes — two short, gentle downward-curved stitched lines in dark
thread, as if peacefully blinking. Everything else must be pixel-identical to the reference: same
silhouette, same wool fiber texture, same wool color, same cream hand-stitching, same lighting, same
size, same position, same background. No mouth, no other change. ${스튜디오}`,
  },
  {
    이름: '코랄_우34',
    비율: '1:1',
    참조: [참조.견본],
    런타임참조: ['코랄_본체'],
    대체참조: [참조.재염색, 참조.견본],
    지시: `Rotate the felted mascot from the first reference image into a three-quarter view: the
character is turned about 35 degrees so it now faces toward the VIEWER'S RIGHT. Both round glossy
black bead eyes remain visible, the far eye slightly foreshortened near the edge of the face. Keep
everything else identical to the first reference image: same needle-felted wool material, same cream
hand-stitched accents, same lighting from upper left, same total height in frame, same centered
composition, same plain light gray background. This is the same character, same proportions —
rounded dome head, wavy flowing bottom edge. No mouth. ${색규약} ${스튜디오}`,
  },
];

(async () => {
  for (const p of Object.values(참조)) {
    if (!fs.existsSync(p)) {
      console.error(`🔴 참조가 없다 — ${p}\n`
        + `   까닭(09-05): 이 참조 둘은 옛 세트 「펠트코랄_0815」에만 있었고 그 폴더는 지워졌다.\n`
        + `   되찾기: git log --all -- docs/캐릭터/펠트코랄_0815 로 커밋을 찾아\n`
        + `           git show <커밋>:docs/캐릭터/펠트코랄_0815/코랄견본.png > <어딘가>\n`
        + `   ⚠ 다만 재염색은 09-05 에 내려갔다 — 옛 견본을 되살리기 전에 «정본_4K 에서 새로 뜰지»부터 정한다.`);
      process.exit(1);
    }
  }
  const k = 키();
  const 결과 = {};
  const 대상 = process.argv[2] ? 작업들.filter((z) => z.이름 === process.argv[2]) : 작업들;
  /* 돈 게이트 — 굽기 «전»에 얼마인지 말하고, 크레딧이 죽었으면 0원에 선다(09-03 · 유호 확정).
   * 게이트가 없던 09-03 이전엔 크레딧이 마른 것을 «첫 장을 던져 보고» 알았다. */
  if (!(await 배치게이트(대상.length, '1K'))) process.exit(3);
  let 실패 = 0;
  for (const z of 대상) {
    // 런타임참조는 같은 실행의 산출물이 1순위 → 디스크에 이미 구운 것 → 대체참조.
    const 앞선것 = (n) => 결과[n] || path.join(폴더, `${n}.png`);
    let refs = [...z.참조, ...(z.런타임참조 || []).map(앞선것)];
    if (refs.some((r) => !fs.existsSync(r)) && z.대체참조) {
      console.log(`   ↳ ${z.이름}: 선행 컷이 없어 대체참조로 간다(색이 갈릴 수 있다 — 검수에서 본다).`);
      refs = z.대체참조;
    }
    try {
      결과[z.이름] = await 한컷({ ...z, 참조: refs, k, 저장경로: path.join(폴더, `${z.이름}.png`) });
    } catch (e) {
      실패++;
      console.error(`🔴 ${e.message}`);
      /* 돈 벽은 «이 장»의 실패가 아니라 «남은 전부»의 실패다 — 계속 돌면 남은 장이 모두
       * 거절당하는 요청이 된다(09-03 에 글 쪽에서 밟은 그 무늬). 여기서 통째로 선다. */
      if (e.돈벽) { console.error('   ⛔ 남은 장은 안 던진다 — 돈 벽이다.'); break; }
    }
  }
  console.log(`\n합계 = 시도 ${대상.length} = 성공 ${대상.length - 실패} + 실패 ${실패}`
    + `  · 대략 ${대상.length * 190}원`);
  process.exit(실패 ? 1 : 0);
})();
