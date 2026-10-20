// 목소리 줄 시각표(배경음 자리 맞추기용): npx tsx 시각표.ts  (remotion 폴더에서)
import { at, lineEnd, ORDER, S, TOTAL, VO } from './src/p1/time';
for (const id of ORDER) console.log(id.padEnd(4), (VO[id] / 30).toFixed(2), '→', (lineEnd(id) / 30).toFixed(2));
console.log('끝 카드', (S.end / 30).toFixed(2), '· 전체', (TOTAL / 30).toFixed(2));
console.log('「효과」', (at('b1', '효과') / 30).toFixed(2), '「반대」', (at('b3', '반대') / 30).toFixed(2), '「빼기」', (at('b5', '빼기') / 30).toFixed(2));

// --srt: 받아쓰기 대조용 기대 자막(out/expected-ko.srt). 글은 계획.json의 말 그대로.
if (process.argv.includes('--srt')) {
  const fs = require('node:fs');
  const plan = JSON.parse(fs.readFileSync('../음성/계획.json', 'utf8'));
  const ts = (f: number) => { const s = f / 30; const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const r = (s % 60).toFixed(3).padStart(6, '0').replace('.', ','); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${r}`; };
  const out = ORDER.map((id, i) => `${i + 1}\n${ts(VO[id])} --> ${ts(lineEnd(id))}\n${plan.lines.find((l: { id: string }) => l.id === id).text}\n`).join('\n');
  fs.writeFileSync('out/expected-ko.srt', out);
  console.log('out/expected-ko.srt');
}
