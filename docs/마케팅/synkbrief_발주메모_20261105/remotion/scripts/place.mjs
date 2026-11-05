// 대사 자리: 줄마다 시작 초를 한 곳에서 정한다(장면 시작 S는 src/Film.tsx와 같은 값).
//   node scripts/place.mjs   → src/vo-place.json(영상이 읽음, 프레임) · public/vo/place.json(초 — 올리기 전 검사 ⑯이 읽음)
// 줄 길이는 public/vo/<id>.json(tools/나레이션굽기.mjs). 줄끼리 겹치면 멈춘다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FPS = 30;
const PLAN = [['n01', 2.2], ['n02', 5.85], ['n03', 9.8], ['n10', 13.3], ['n04', 17.95], ['n05', 21.55], ['n08', 24.57], ['n06', 27.1], ['n07', 32.1], ['n09', 34.5]];
const clips = PLAN.map(([id, t]) => {
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/vo', id + '.json'), 'utf8'));
  const speech = j.words?.length ? j.words[j.words.length - 1].end : j.dur;
  const at = Math.round(t * FPS);
  return { id, at, speechEnd: at + Math.ceil(speech * FPS), end: at + Math.ceil(j.dur * FPS) };
});
clips.forEach((c, i) => {
  const next = clips[i + 1];
  if (next && next.at - c.speechEnd < 0) throw Error(`${c.id} → ${next.id} 겹침 ${next.at - c.speechEnd}프레임`);
});
fs.writeFileSync(path.join(ROOT, 'src/vo-place.json'), JSON.stringify(clips, null, 1) + '\n');
const sec = (f) => +(f / FPS).toFixed(3);
fs.writeFileSync(path.join(ROOT, 'public/vo/place.json'), JSON.stringify({ A: clips.map((c) => ({ id: c.id, start: sec(c.at), end: sec(c.speechEnd) })) }, null, 1) + '\n');
for (const c of clips) console.log(c.id.padEnd(4), `${sec(c.at).toFixed(2)}~${sec(c.speechEnd).toFixed(2)}초`);
