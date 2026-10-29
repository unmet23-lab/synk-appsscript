// 나레이션 자리: 줄마다 시작 초를 한 곳에서 정한다(장면 시작 S는 src/Film.tsx와 같은 값).
//   node scripts/place.mjs   → src/vo-place.json(영상이 읽음, 프레임) · public/vo/place.json(초 — 올리기 전 검사 ⑯이 끝 줄을 읽는다)
// 줄 길이는 public/vo/<id>.json(tools/나레이션굽기.mjs). 줄끼리 4프레임보다 붙으면 멈춘다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FPS = 30;
const S = { hook: 0, ask: 1.2, one: 5.5, cheese: 9.9, note: 12.1, c1: 14.1, c2: 16.9, c3: 18.85, more: 20.3, breath: 22.9, end: 27.2 };
// [줄, 시작 초] — 손님 줄 c01은 해설 v01이 끝난 뒤(2.17초), c02는 새 메뉴판이 드러난 뒤 손님이 묻지 않고 바로 주문(26.4초), 끝 줄 v08은 그 뒤
const PLAN = [['v01', S.hook], ['c01', 2.1 + 2 / FPS], ['v02', S.one + 0.1], ['v03', S.note + 0.05], ['v04', S.c1 + 0.1], ['v05', S.c2 + 0.05],
  ['v06', S.c3 + 0.05], ['v07', S.more + 0.1], ['c02', 26.4], ['v08', 28.3]];
const clips = PLAN.map(([id, t]) => {
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/vo', id + '.json'), 'utf8'));
  const speech = j.words?.length ? j.words[j.words.length - 1].end : j.dur;
  const at = Math.round(t * FPS);
  return { id, at, speechEnd: at + Math.ceil(speech * FPS), end: at + Math.ceil(j.dur * FPS) };
});
clips.forEach((c, i) => {
  const next = clips[i + 1];
  if (next && next.at - c.speechEnd < 4) throw Error(`${c.id} → ${next.id} 사이 ${next.at - c.speechEnd}프레임(4프레임보다 붙음)`);
});
fs.writeFileSync(path.join(ROOT, 'src/vo-place.json'), JSON.stringify(clips, null, 1) + '\n');
const sec = (f) => +(f / FPS).toFixed(3);
fs.writeFileSync(path.join(ROOT, 'public/vo/place.json'), JSON.stringify({ A: clips.map((c) => ({ id: c.id, start: sec(c.at), end: sec(c.speechEnd) })) }, null, 1) + '\n');
for (const c of clips) console.log(c.id.padEnd(4), `${sec(c.at).toFixed(2)}~${sec(c.speechEnd).toFixed(2)}초`);
