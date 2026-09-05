/* 공방 펠트 요소 — 영상에서 «이름으로» 꺼내 쓴다 (2026-09-05 · 유호 확정 「영상에도 삽입해서 쓸수있게」).
 *
 * 🔑 **목록은 파생물이다.** 정본은 `docs/공방/계획.json` 과 `docs/Loom_자산/구움/` 이고,
 *   `영상/자산모으기.js` ④ 가 그것을 읽어 `public/공방/목록.json` 을 만든다.
 *   그래서 자산이 늘어도 이 파일을 안 고친다(폰트벌.json 과 같은 규율).
 *   ⚠ 굽기 전에 «항상» `node 영상/자산모으기.js` 를 먼저 돌린다 — 안 돌리면 옛 목록을 문다.
 *
 * 쓰기:
 *   import { 요소, 요소들, 묶음들 } from "../킷/공방";
 *   <Img src={staticFile(요소("별 배지"))} />
 *   요소들("배지·도장").map(x => <Img key={x.이름} src={staticFile(x.파일)} />)
 */
import 목록 from "../../public/공방/목록.json";

export type 공방요소 = { 이름: string; 묶음: string; 파일: string };

export const 벌: 공방요소[] = (목록 as { 벌: 공방요소[] }).벌 ?? [];

/** 이름으로 하나 꺼낸다. 없으면 던진다 — 조용한 폴백은 영상에서 «빈 자리»로 나가 안 보인다. */
export function 요소(이름: string): string {
  const it = 벌.find((x) => x.이름 === 이름);
  if (!it) {
    throw new Error(
      `공방에 「${이름}」 이 없다. 있는 것 ${벌.length}종 — 목록은 public/공방/목록.json.\n` +
        `   자산을 새로 구웠다면 먼저: node 영상/자산모으기.js`,
    );
  }
  return it.파일;
}

/** 묶음 하나를 통째로. 「배지·도장」·「숫자」처럼 벌로 쓰는 자리에. */
export function 요소들(묶음: string): 공방요소[] {
  return 벌.filter((x) => x.묶음 === 묶음);
}

/** 지금 있는 묶음 이름들 — 무엇이 있는지 볼 때. */
export function 묶음들(): string[] {
  return [...new Set(벌.map((x) => x.묶음))];
}

/** 숫자 하나를 펠트로. 0~9 는 미리 구워 뒀다(묶음 「숫자」). */
export function 숫자(n: number | string): string {
  return 요소(`숫자 ${n}`);
}
