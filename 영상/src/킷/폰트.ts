/**
 * 브랜드 폰트를 Remotion 에 «정직하게» 등록한다.
 *
 * 🔴 왜 이 파일이 따로 있나 — 실측 셋이 여기서 겹친다.
 *   ① Remotion 은 폰트를 못 받아도 «렌더가 실패하지 않는다». 경고만 뜨고 종료코드 0 으로
 *      폴백 서체 그림이 나온다. 사람이 눈으로 안 보면 못 잡는다. → 아래 delayRender 로 막는다.
 *   ② 헤드리스 크롬이 «윈도우 시스템 폰트를 읽는다». 이 노트북엔 폰트가 299벌 깔려 있어
 *      로더를 통째로 빠뜨려도 한글이 멀쩡히 나온다 — 여기서만 되고 다른 PC·CI 에선 조용히
 *      다른 서체가 되는 「내 화면에선 되는데」의 교과서적 통로다.
 *   ③ 🔴 토큰 `서체.본문스택` 이 부르는 `'SUIT Variable'` 은 **실존하지 않는 이름이다.**
 *      fontTools 로 `docs/브랜드_폰트/SUIT/*.otf` 를 읽으면 family(name ID 1)가 `SUIT` 이고
 *      typographic family(ID 16)도 전부 `SUIT` 다. 그 이름을 그대로 @font-face 에 적으면
 *      조용히 폴백해 한글이 시스템 폰트로 뜬다. 이 파일이 그 어긋남을 «한 곳에서» 흡수한다
 *      — 순서의 정본은 여전히 토큰이고, 여기는 실물 파일 이름만 안다.
 *      ⚠ 정본 표기(DESIGN.md 121줄 · 토큰 서체.본문스택)를 고칠지는 유호님 판정 대기 중이다.
 *
 * 🔴 한 폰트로는 한·몽 병기가 «원리상» 안 된다 — fontTools 실측:
 *      SUIT-Regular      글리프 11,460 · 한글 O · 키릴 Б ө ү Ө Ү я Ж **0/7**
 *      InterTight-Regular 글리프  2,547 · 키릴 **7/7**(몽골 전용 ө·ү 포함) · 한글 **0/4**
 *    리드크루 클립 자막은 한 줄 안에 한국어+키릴이 섞이므로 둘을 반드시 함께 문다.
 *    순서(라틴·키릴이 먼저, 한글이 뒤)는 토큰이 이미 쥐고 있다 — 폴백이 글리프 단위라 자동 분기된다.
 */
import { loadFont } from "@remotion/fonts";
import { continueRender, delayRender, staticFile } from "remotion";
import 토큰 from "../../../docs/디자인_토큰.json";

/** 실물 파일에 박힌 family 이름. 지어내지 않는다 — fontTools 로 읽은 값이다. */
export const 한글체 = "SUIT";
export const 라틴체 = "Inter Tight";

/** 토큰이 정한 스택 순서를 그대로 쓰되, 실존하지 않는 `SUIT Variable` 만 실물 이름으로 바꾼다. */
export const 본문스택: string = ((토큰 as any)["서체"]["본문스택"] as string).replace(
  /'SUIT Variable'/g,
  `'${한글체}'`,
);

/** 웨이트 이름 — 토큰 `서체.웨이트`(태그라인_한글 900 · 헤드 800 · 강조_라벨 600 · 본문_UI 500 · 캡션_보조 400). */
export const 웨이트: Record<string, number> = (토큰 as any)["서체"]["웨이트"];

/** 자간 — 토큰 `서체.트래킹`. */
export const 트래킹: Record<string, string> = (토큰 as any)["서체"]["트래킹"];

/**
 * 몽골어 보정 — 토큰 `서체.몽골어보정` = 1.04.
 * 키릴이 같은 크기에서 한글보다 작아 보여, 병기 줄의 몽골어에만 곱한다.
 */
export const 몽골어보정: number = (토큰 as any)["서체"]["몽골어보정"];

const 벌: { family: string; 파일: string; weight: string }[] = [
  { family: 한글체, 파일: "SUIT-Regular.otf", weight: "400" },
  { family: 한글체, 파일: "SUIT-Medium.otf", weight: "500" },
  { family: 한글체, 파일: "SUIT-SemiBold.otf", weight: "600" },
  { family: 한글체, 파일: "SUIT-ExtraBold.otf", weight: "800" },
  { family: 한글체, 파일: "SUIT-Heavy.otf", weight: "900" },
  { family: 라틴체, 파일: "InterTight-Regular.ttf", weight: "400" },
  { family: 라틴체, 파일: "InterTight-Medium.ttf", weight: "500" },
  { family: 라틴체, 파일: "InterTight-SemiBold.ttf", weight: "600" },
  { family: 라틴체, 파일: "InterTight-Bold.ttf", weight: "700" },
];

/**
 * 🔑 `delayRender` 로 «기다리게» 만든다. 최상위 await 로 두면 Remotion 이 그걸 안 기다려서
 * 첫 프레임이 폴백 서체로 찍힐 수 있다. 로딩이 실패하면 여기서 렌더가 **죽는다** —
 * 조용히 다른 서체로 나오는 것보다 죽는 편이 낫다(같은 판단이 마스코트자산.js 에 서 있다).
 */
const 핸들 = delayRender("브랜드 폰트(SUIT · Inter Tight) 등록");

export const 폰트준비 = Promise.all(
  벌.map((v) =>
    loadFont({
      family: v.family,
      url: staticFile(`폰트/${v.파일}`),
      weight: v.weight,
      display: "block",
    }),
  ),
)
  .then(() => {
    continueRender(핸들);
  })
  .catch((e) => {
    throw new Error(
      `브랜드 폰트 등록 실패 — 영상/public/폰트/ 에 9벌이 다 있는지 본다. 원인: ${String(e)}`,
    );
  });
