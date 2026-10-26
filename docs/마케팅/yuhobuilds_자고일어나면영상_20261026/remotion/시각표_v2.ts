// v2 목소리 줄 시각표(배경음 자리 맞추기용): npx tsx 시각표_v2.ts  (remotion 폴더에서)
import { lineEnd, TIMING } from './src/y9v2/time';
for (const t of Object.values(TIMING)) {
  console.log(`[${t.cut}]`, t.order.map((id) => `${id} ${(t.vo[id] / 30).toFixed(2)}→${(lineEnd(id, t) / 30).toFixed(2)}`).join(' · '));
  console.log(`  끝 카드 ${(t.end / 30).toFixed(2)} · 전체 ${(t.total / 30).toFixed(2)}초`);
}
