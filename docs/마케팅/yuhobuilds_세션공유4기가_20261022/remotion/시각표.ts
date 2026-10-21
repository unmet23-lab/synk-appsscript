// 목소리 줄 시각표(배경음 자리 맞추기용): npx tsx 시각표.ts  (remotion 폴더에서)
import { ORDER, S, TOTAL, VO, lineEnd } from './src/p3/time';
const BEAT = 60 / 122.863;
const beatOf = (sec: number) => ((sec - 0.054) / BEAT).toFixed(1);
for (const id of ORDER) console.log(id.padEnd(4), (VO[id] / 30).toFixed(2), '→', (lineEnd(id) / 30).toFixed(2), `박 ${beatOf(VO[id] / 30)}`);
console.log('끝 카드', (S.end / 30).toFixed(2), `박 ${beatOf(S.end / 30)}`, '· 전체', (TOTAL / 30).toFixed(2));
