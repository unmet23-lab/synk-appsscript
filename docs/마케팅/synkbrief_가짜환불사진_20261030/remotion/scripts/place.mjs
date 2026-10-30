// 나레이션 자리: 줄마다 시작 초를 한 곳에서 정한다(장면 시작 S는 src/Film.tsx와 같은 값).
//   node scripts/place.mjs   → src/vo-place.json(영상이 읽음, 프레임) · public/vo/place.json(초 — 올리기 전 검사 ⑯이 끝 줄을 읽는다)
// 줄 길이는 public/vo/<id>.json(tools/나레이션굽기.mjs). 줄끼리 4프레임보다 붙으면 멈춘다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FPS = 30;
// v01 훅(리뷰 사진), v02 사장님 억울(V1), v03 다시 저장한 사진 → 「판별할 수 없습니다」, v04 원본 파일 요청, v05 파일 그대로 → 기록, v06 리뷰 사진 다시, v07 반전 뒤 끝 한마디
const PLAN = [['v01', 0.2], ['v02', 2.5], ['v03', 8.75], ['v09', 12.3], ['v04', 16.35], ['v05', 18.5], ['v06', 22.45], ['v07', 26.2], ['v08', 29.0]];
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
