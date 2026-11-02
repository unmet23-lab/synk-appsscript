// 나레이션 자리: 줄마다 시작 초를 한 곳에서 정한다(장면 시작 S는 src/Film.tsx와 같은 값).
//   node scripts/place.mjs   → src/vo-place.json(영상이 읽음, 프레임) · public/vo/place.json(초 — 올리기 전 검사 ⑯이 끝 줄을 읽는다)
// 줄 길이는 public/vo/<id>.json(tools/나레이션굽기.mjs). 줄끼리 4프레임보다 붙으면 멈춘다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FPS = 30;
// n01 0초 요약 · n02 빨간 줄 · n03 여덟 번 · n04 확인 한 줄(치는 화면) · n08 바꿔 넣을 낱말 카드 · n05 두 줄 맞대기 뒤 · n09 원문 종이 · 돈 카드(같은 6개월인데 뜻은 정반대) · n06 요약 줄(27.3~29.4초 사장님 중얼거림 뒤) · n10 키오스크를 돌아보는 사장님 · n07 끝
const PLAN = [['n01', 0.05], ['n02', 3.5], ['n03', 5.3], ['n04', 10.55], ['n08', 14.55], ['n05', 20.5], ['n09', 24.3], ['n06', 29.65], ['n10', 35.0], ['n07', 38.8]];
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
