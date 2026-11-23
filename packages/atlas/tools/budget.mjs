// 묶음 압축 용량 상한을 잰다(설계 §9 · §14-3). 빌드의 manifest와 budget.json을 받아 넘은 것을 돌려준다 — 의존 없는 순수 계산이다.
// 상한은 설계값이다. 넘으면 줄이거나, 줄일 수 없는 까닭을 결정 표에 적고 budget.json을 고친다(실제 값에 맞춰 올리기만 하지 않는다).
// 지도 줄(budget.map): 전체 색인 · 단위 · 낱말은 파일마다, 은행 조각(map/items/*)은 가장 큰 조각 하나를 잰다(설계 §9). 이름으로 짚은
// 조각(map.slices — 파일 이름 → 상한)은 그 상한으로 따로 재고 가장 큰 조각 겨룸에서 뺀다. 진단 문항만 담는 조각이 문항 거름을 잃어
// 은행 조각만큼 커져도 가장 큰 조각 상한 안이라 지나가던 틈을 막는다(단계 4 계획 §25-4).
function namedLimits(map) {
  const named = map.slices ?? {};
  if (typeof named !== 'object' || Array.isArray(named))
    throw new TypeError('Atlas budget: map.slices는 파일 이름 → 상한 표여야 한다');
  const outside = Object.keys(named).filter(file => !file.startsWith('items/'));
  if (outside.length)
    throw new TypeError(`Atlas budget: map.slices는 조각(items/)만 짚는다 — ${outside.join(', ')}`);
  return named;
}

function mapRows(manifest, map) {
  if (!map) return [];
  const files = manifest.map?.files ?? {};
  const named = namedLimits(map);
  const rows = [...Object.entries(map.files ?? {}), ...Object.entries(named)].map(
    ([file, gzip]) => ['map', files[file], { file: `map/${file}`, gzipBytes: gzip }],
  );
  const slices = Object.entries(files).filter(
    ([file]) => file.startsWith('items/') && !Object.hasOwn(named, file),
  );
  const biggest = slices.sort((a, b) => b[1].gzipBytes - a[1].gzipBytes)[0];
  rows.push([
    'map',
    biggest?.[1],
    { file: `map/${biggest?.[0] ?? 'items/*'}`, gzipBytes: map.slice },
  ]);
  return rows;
}

export function checkBudget(manifest, budget) {
  const rows = [
    ['engine', manifest.files?.[budget.engine?.file], budget.engine],
    ['entry', manifest.entry?.[budget.entry?.file], budget.entry],
    ...mapRows(manifest, budget.map),
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
