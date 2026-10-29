// 나레이션 줄 파일(tools/나레이션굽기.mjs가 public/vo/*.json에 둔 낱말 시각)을 영상이 읽는 표 src/film/vo.ts로 옮긴다.
//   node scripts/vo-ts.mjs
// v = 사장님(범수), g = Gemini 답 읽기(문정), c = ChatGPT 답 읽기(은하). show는 ../소리/나레이션.json의 화면 글(낱말 수가 같을 때만 그 글로 자막).
// dur: 다듬은 wav 길이(초), t/e: 낱말 시작·끝(초, 줄 파일 기준).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(ROOT, 'public/vo');
const plan = JSON.parse(fs.readFileSync(path.join(ROOT, '..', '소리', '나레이션.json'), 'utf8'));
const show = Object.fromEntries(plan.lines.map((l) => [l.id, l.show || l.text]));
const ids = fs.readdirSync(dir).filter((f) => /^[vgc]\d\d\.json$/.test(f)).map((f) => f.slice(0, -5)).sort();
const rows = ids.map((id) => {
  const j = JSON.parse(fs.readFileSync(path.join(dir, id + '.json'), 'utf8'));
  // 숫자를 소리로 읽은 자리(「1시간이」 → 「한 시간이」)는 소리 낱말 둘을 하나로 묶어 화면 글과 낱말 수를 맞춘다
  const said = (j.words || []).reduce((a, w) => {
    const p = a[a.length - 1];
    if (p && p.text === '한' && /^시간/.test(w.text)) a[a.length - 1] = { ...p, text: p.text + w.text, end: w.end };
    else a.push(w);
    return a;
  }, []);
  const shown = String(show[id] || '').split(/\s+/).filter(Boolean);
  if (shown.length !== said.length) console.warn(`${id}: 화면 글 낱말 ${shown.length} · 소리 낱말 ${said.length} — 소리 낱말로 자막`);
  const words = said.map((w, i) => `{ w: ${JSON.stringify(shown.length === said.length ? shown[i] : w.text)}, t: ${w.start.toFixed(3)}, e: ${w.end.toFixed(3)} }`);
  return `  ${id}: { dur: ${j.dur}, words: [${words.join(', ')}] },`;
});
const out = `// 줄 길이와 낱말 시각 — scripts/vo-ts.mjs가 public/vo/*.json(tools/나레이션굽기.mjs)과 ../소리/나레이션.json 화면 글에서 만든 표. 다시 구우면 이 파일도 다시 만든다.
export type Word = { w: string; t: number; e: number };
export const VO: Record<string, { dur: number; words: Word[] }> = {
${rows.join('\n')}
};
`;
fs.writeFileSync(path.join(ROOT, 'src/film/vo.ts'), out);
console.log('vo.ts', ids.join(' '));
