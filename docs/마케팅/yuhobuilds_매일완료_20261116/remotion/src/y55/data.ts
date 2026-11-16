// 화면 숫자 · 날짜는 모두 기록 값이다(기획.md 「실화」).
// - 마지막 새 자료: 10-21 11:08 KST(회사 DB latestCreatedAt 2026-10-21T02:08Z, 11-14 17:31 읽음) → 10-22 ~ 11-14 24일 동안 새로 들어온 양식 0.
// - 회차 영수증(회사 앱이 보고서를 받은 시각 KST · 새 자료 · 고친 자료): 회사 DB recentReports(.tmp/workspace-research-20261114/company-before.json ·
//   .tmp/workspace-05-20261115/company-before.json · company-after.json, importedAt은 UTC).
// - 같은 전체 조사 문서의 조사 시각: 11-13 05:19 → 11-14 05:08(보고서 ID의 시각).
const pad = (n: number) => String(n).padStart(2, '0');
export const DAYS: string[] = (() => {
  const out: string[] = [];
  const d = new Date(Date.UTC(2026, 9, 22));
  const end = Date.UTC(2026, 10, 14);
  while (d.getTime() <= end) {
    out.push(`${d.getUTCMonth() + 1}.${pad(d.getUTCDate())}`);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
})();

export type Receipt = { when: string; fresh: number; fixed: number };
/** 고치기 전 마지막 여섯 회차(11-12 20:11 ~ 11-14 05:16) — 모두 새 자료 0. */
export const BEFORE: Receipt[] = [
  { when: '11월 12일 밤 8:11', fresh: 0, fixed: 9 },
  { when: '11월 12일 밤 11:12', fresh: 0, fixed: 8 },
  { when: '11월 13일 새벽 5:28', fresh: 0, fixed: 9 },
  { when: '11월 13일 밤 8:17', fresh: 0, fixed: 9 },
  { when: '11월 13일 밤 11:31', fresh: 0, fixed: 8 },
  { when: '11월 14일 새벽 5:16', fresh: 0, fixed: 9 },
];
/** 고친 뒤 — 11-14 18:31 새 10(89 → 99) · 11-15 05:28 새 10(99 → 109). */
export const AFTER: Receipt[] = [
  { when: '11월 14일 저녁 6:31', fresh: 10, fixed: 0 },
  { when: '11월 15일 새벽 5:28', fresh: 10, fixed: 0 },
];
export const TIMES = ['11. 13. 오전 5:19', '11. 14. 오전 5:08'];
