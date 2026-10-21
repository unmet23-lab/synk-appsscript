// 나레이션 줄 파일(tools/나레이션굽기.mjs가 public/vo/*.json에 둔 낱말 시각)을 영상이 읽는 표 src/full/vo.ts로 옮긴다.
//   node scripts/vo-ts.mjs   → 다음은 node scripts/vo-place.mjs
// dur: 다듬은 wav 길이(초), speech: 마지막 낱말 끝(초), t/e: 낱말 시작·끝(초, 줄 파일 기준).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(ROOT, 'public/vo');
const ids = fs.readdirSync(dir).filter((f) => /^[abv]\d\d\.json$/.test(f)).map((f) => f.slice(0, -5)).sort();
const rows = ids.map((id) => {
  const j = JSON.parse(fs.readFileSync(path.join(dir, id + '.json'), 'utf8'));
  const words = (j.words || []).map((w) => `{ w: ${JSON.stringify(w.text)}, t: ${w.start.toFixed(3)}, e: ${w.end.toFixed(3)} }`);
  const speech = j.words?.length ? j.words[j.words.length - 1].end : j.dur;
  return `  ${id}: { dur: ${j.dur}, speech: ${speech}, words: [${words.join(', ')}] },`;
});
const out = `// 나레이션(Typecast 범수 · 1.12배) 길이와 낱말 시각 — scripts/vo-ts.mjs가 public/vo/*.json(tools/나레이션굽기.mjs)에서 만든 표. 다시 구우면 이 파일도 다시 만든다.
// dur: 다듬은 wav 길이(초), speech: 마지막 말소리 끝(초), t/e: 낱말 시작·끝(초, 줄 파일 기준).
export type Word = { w: string; t: number; e: number };
export const VO: Record<string, { dur: number; speech: number; words: Word[] }> = {
${rows.join('\n')}
};
`;
fs.writeFileSync(path.join(ROOT, 'src/full/vo.ts'), out);
console.log('vo.ts', ids.join(' '));
