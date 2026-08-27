/**
 * 킷 → Remotion 다리. **색 값의 정본은 `docs/디자인_토큰.json` 하나다.**
 *
 * 이 파일이 있는 이유는 편의가 아니라 «집행»이다 — 영상은 색이 가장 새기 쉬운 지면이고,
 * 이번에 들인 바깥 스킬 둘이 각자 팔레트를 들고 왔다(모션 스킬 theme.ts · uupm charts.csv).
 * 특히 모션 스킬의 「Warm editorial hero #D97757」은 SYNK 코랄 #F96859 과 «눈으로 구분이 안 된다».
 * 값을 여기서만 꺼내게 하면 그 색들은 쓰고 싶어도 못 쓰는 상태가 된다.
 *
 * 🚫 합성물 코드 어디에도 hex 리터럴을 쓰지 않는다. 검사:
 *    grep -rn "#[0-9A-Fa-f]\{6\}" 영상/src/ | grep -v "킷/색.ts"   → 0건이어야 한다
 */
import 토큰 from "../../../docs/디자인_토큰.json";

type 킷색 = { 이름: string; hex: string; 팔레트: string; 직책: string };

const 킷: 킷색[] = (토큰 as any)["색"]["킷"];
const 지도 = new Map<string, 킷색>(킷.map((c) => [c.이름, c]));

/** ⏳퇴역 대기 — DESIGN.md §2 「새 산출물에 쓰지 않는다」. 직책 문구가 스스로 표시한다. */
const 퇴역대기 = new Set(킷.filter((c) => c.직책.includes("⏳")).map((c) => c.이름));

/** K-Culture 4색 — Part 6 전용. 그 밖으로 반입 금지(조항 ⓙ). */
const 파트6전용 = new Set(킷.filter((c) => c.팔레트.includes("K-Culture")).map((c) => c.이름));

/**
 * 킷 색 이름 하나를 hex 로 바꾼다. 없는 이름·못 쓰는 색은 **던진다** —
 * 조용한 폴백은 「화면은 나오는데 브랜드가 아닌」 가장 안 잡히는 실패를 만든다
 * (같은 판단이 `tools/lib/마스코트자산.js` 에 이미 서 있다).
 */
export function 색(이름: string): string {
  const c = 지도.get(이름);
  if (!c) {
    throw new Error(
      `킷에 없는 색: 「${이름}」 — 색 정본은 docs/디자인_토큰.json 이다. 여기에 새 hex 를 적지 말고 킷에 먼저 세운다.`,
    );
  }
  if (퇴역대기.has(이름)) {
    throw new Error(
      `퇴역 대기 색: 「${이름}」 — DESIGN.md §2 가 「새 산출물에 쓰지 않는다」로 못 박았다. 양모 계열로 바꾼다.`,
    );
  }
  if (파트6전용.has(이름)) {
    throw new Error(`Part 6 전용 색: 「${이름}」 — K-Culture 4색은 Part 6 밖 반입 금지다(조항 ⓙ).`);
  }
  return c.hex;
}

/**
 * 라이트 모드 시맨틱 역할 → hex. 역할 이름은 토큰 `색.시맨틱.라이트` 가 쥔다
 * (바탕·잉크·보조잉크·신호_면·신호_글자_대형·실땀·정답_면 …).
 */
export function 시맨틱(역할: string): string {
  const 표: Record<string, string> = (토큰 as any)["색"]["시맨틱"]["라이트"];
  const 색이름 = 표[역할];
  if (!색이름) {
    throw new Error(
      `시맨틱 역할에 없는 이름: 「${역할}」 — 쓸 수 있는 역할: ${Object.keys(표).join(" · ")}`,
    );
  }
  return 색(색이름);
}

/**
 * 자주 쓰는 자리를 이름으로 고정한다. 영상 자막에 직접 걸리는 킷 철칙 셋이 여기 박혀 있다:
 *  ① 순백·순검정 금지 — 라이트 하한이 Paper·Ink 다.
 *  ② Coral·Meadow 는 «면»이다. 종이 위 «글자» 로 쓰지 않는다(Coral 은 Paper 위 대비 2.75) —
 *     큰 글자가 필요하면 그 실의 Deep(Coral 3)을 쓴다.
 *  ③ 한 화면의 유채 실은 «주연 1 + 조연 1» 둘까지.
 */
export const 지면 = {
  바탕: 시맨틱("바탕"),
  글자: 시맨틱("잉크"),
  보조글자: 시맨틱("보조잉크"),
  캡션글자: 시맨틱("보조잉크2"),
  신호면: 시맨틱("신호_면"),
  /* 「코랄 램프 1(보풀 빛) — 알약·여린 면」. 릴의 «장면 워시»가 이걸 쓴다:
     신호바닥(Coral Wash #FEF0E9)은 바탕(Paper #FBF7F0)과 거의 같은 값이라 배경으로 깔면
     **화면에서 안 보인다**(장면형 첫 판 실측 — 워시를 0~1 로 흔들었는데 띠에서 구별이 안 됐다). */
  여린면: 시맨틱("알약"),
  신호글자: 시맨틱("신호_글자_대형"),
  신호바닥: 시맨틱("신호_바닥"),
  실땀: 시맨틱("실땀"),
  정답면: 시맨틱("정답_면"),
  정답글자: 시맨틱("정답_글자"),
} as const;

/** 간격 — 토큰 `율.단계` 의 이름 있는 관계를 그대로 쓴다(「모든 여백에는 이유가 있어야 한다」). */
export const 율: Record<string, number> = Object.fromEntries(
  Object.entries((토큰 as any)["율"]["단계"] as Record<string, { px: number }>).map(([이름, v]) => [
    이름,
    v.px,
  ]),
);
