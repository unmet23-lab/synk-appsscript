// 묶음 압축 용량 상한을 잰다(설계 §9 · §14-3). 빌드의 manifest와 budget.json을 받아 넘은 것을 돌려준다 — 의존 없는 순수 계산이다.
// 상한은 설계값이다. 넘으면 줄이거나, 줄일 수 없는 까닭을 결정 표에 적고 budget.json을 고친다(실제 값에 맞춰 올리기만 하지 않는다).
export function checkBudget(manifest, budget) {
  const rows = [
    ['engine', manifest.files?.[budget.engine?.file], budget.engine],
    ['entry', manifest.entry?.[budget.entry?.file], budget.entry],
  ];
  const report = rows.map(([part, measured, limit]) => {
    if (!limit || !Number.isInteger(limit.gzipBytes) || limit.gzipBytes <= 0) {
      throw new TypeError(`Atlas budget: ${part} 상한이 없다`);
    }
    if (!measured) throw new TypeError(`Atlas budget: ${part} 묶음(${limit.file})이 빌드에 없다`);
    return {
      part,
      file: limit.file,
      gzipBytes: measured.gzipBytes,
      limit: limit.gzipBytes,
      headroom: limit.gzipBytes - measured.gzipBytes,
    };
  });
  return { ok: report.every(row => row.headroom >= 0), report };
}
