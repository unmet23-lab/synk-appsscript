// theme.ts — 🔴 SYNK 판. **색과 폰트는 여기 없다.**
//
// 원본(haidrrrry/claude-remotion-skill · MIT)에는 `colors` 7개와 `fonts` 3개가 들어 있었다.
// 반입한 «같은 커밋»에서 그 두 블록을 지웠다. 근거 셋:
//   · SYNK 는 색·폰트 정본이 하나다 — `docs/디자인_토큰.json` 과 `docs/브랜드_폰트/`.
//     유호 확정 2026-08-26: 「색·폰트 정본은 디자인 킷 하나」.
//   · 남겨두면 반드시 다시 참조된다. 마스코트 실물 실측(08-19)에서 유호님 확정판이 6회
//     참조될 때 옛판이 20회였다 — 「나중에 지운다」가 실제로 진 자리다.
//   · 특히 원본 팔레트의 「Warm editorial hero」는 SYNK 코랄과 **눈으로 구분이 안 된다.**
//     킷 밖 색인데 비슷해서 더 위험하다. (두 값의 대조는 `출처.md` 에 적어 뒀다 —
//     여기 hex 를 적으면 「남의 색이 남았나」 검사가 매번 이 주석을 잡아 무뎌진다.)
//
// 👉 색   = `영상/src/킷/색.ts`   (킷에서 파생 · ⏳퇴역 대기색과 Part 6 전용색은 «던진다»)
// 👉 폰트 = `영상/src/킷/폰트.ts` (SUIT + Inter Tight — 한·몽 병기는 둘 다 있어야 한다.
//                                  SUIT 는 키릴이 0/7, Inter Tight 는 한글이 0/4다)
//
// 아래 ease·spring 은 «영상 연출값»이라 남긴다 — 킷의 `감각.가안`(UI 모션: 눌림·시트·툴팁)과
// 축이 다르고, 그 블록은 아직 「가안」이라 DESIGN.md §8 이 새 산출물의 인용을 막아 두었다.
import { Easing } from "remotion";

export const theme = {
  // THE easing curves. Linear is forbidden.
  ease: {
    out: Easing.bezier(0.16, 1, 0.3, 1), // easeOutExpo — entrances
    inOut: Easing.bezier(0.83, 0, 0.17, 1), // easeInOutQuint — moves, Ken Burns
    in: Easing.bezier(0.7, 0, 0.84, 0), // exits only
  },
  spring: {
    snappy: { damping: 14, stiffness: 160, mass: 0.6 }, // UI pops, words
    smooth: { damping: 20, stiffness: 90, mass: 1 }, // big elements
    bouncy: { damping: 11, stiffness: 170, mass: 0.7 }, // playful accents, logos
  },
} as const;
