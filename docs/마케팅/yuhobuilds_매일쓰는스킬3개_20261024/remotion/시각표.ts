// 목소리 줄 시각표(배경음 자리 맞추기용): npx tsx 시각표.ts  (remotion 폴더에서)
import { lineEnd, TIMING } from './src/p3/time';
for (const t of Object.values(TIMING)) {
  console.log(`[${t.cut}]`, t.order.map((id) => `${id} ${(t.vo[id] / 30).toFixed(2)}→${(lineEnd(id, t) / 30).toFixed(2)}`).join(' · '));
  console.log(`  끝 카드 ${(t.end / 30).toFixed(2)} · 전체 ${(t.total / 30).toFixed(2)}초`);
}
import { at } from './src/p3/time';
console.log('「틀려」', (at('h1', '틀려') / 30).toFixed(2), '「새」', (at('d1', '새') / 30).toFixed(2), '「다음엔」', (at('n1', '다음엔') / 30).toFixed(2), '「장으로」', (at('k1', '장으로') / 30).toFixed(2));
