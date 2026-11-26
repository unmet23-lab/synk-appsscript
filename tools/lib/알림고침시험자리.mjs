// 알림 고침(무인)의 node:test 보고기 — 시험마다 정의한 자리(파일 · 줄 · 칸)와 결과를 한 줄 JSON으로 낸다.
// tools/lib/알림고침관문.js 시험돌리기가 TAP과 함께 붙인다(--test-reporter). 모델이 쓴 새 시험이 고치기 전 판 · 고친 판 · 올릴 판에서
// 같은 자리들을 꼭 한 번씩 돌았는지 견주는 데 쓴다 — 이름은 같아도 자리가 다르면 다른 시험이다(GPT alert-fix-20261126-r4 GA8, 설계 v4.2).
// 실패종류: 몸통이 돌다 실패했는지(testCodeFailure · subtestsFailed), 훅 실패 · 시간 넘김 · 부모 끝남으로 몸통이 안 돌았는지(그 밖)를 가른다(r8 GA4).
export default async function* 시험자리(source) {
  for await (const e of source) {
    if (e.type !== 'test:pass' && e.type !== 'test:fail') continue;
    const d = e.data || {};
    yield `${JSON.stringify({ 결과: e.type === 'test:pass' ? '통과' : '실패', 이름: String(d.name ?? ''), 깊이: d.nesting ?? null, 파일: d.file ?? null,
      줄: d.line ?? null, 칸: d.column ?? null, 종류: d.details?.type ?? null, 건너뜀: Boolean(d.skip), 할일: Boolean(d.todo),
      실패종류: d.details?.error?.failureType ?? null })}\n`;
  }
}
