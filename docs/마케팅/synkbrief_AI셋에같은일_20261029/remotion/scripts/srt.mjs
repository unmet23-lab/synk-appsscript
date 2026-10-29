// 영상에 들어간 줄 자리(src/film/time.ts CLIPS)와 화면 글(../소리/나레이션.json show)로 말 자막(srt)을 만든다 — 이해 시험(tools/낯선이시험.js --말) · 올리기 전 검사용.
//   node --experimental-strip-types scripts/srt.mjs [출력=../소리/말.srt]
// time.ts는 vo.ts를 읽으므로 둘 다 타입만 벗겨 임시 폴더에서 읽는다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'brief-srt-'));
for (const f of ['time.ts', 'vo.ts']) {
  const src = fs.readFileSync(path.join(ROOT, 'src/film', f), 'utf8').replace(/from '\.\/vo'/, "from './vo.ts'");
  fs.writeFileSync(path.join(tmp, f), src);
}
const { CLIPS, clipEnd } = await import(pathToFileURL(path.join(tmp, 'time.ts')).href);
const { VO } = await import(pathToFileURL(path.join(tmp, 'vo.ts')).href);
const plan = JSON.parse(fs.readFileSync(path.join(ROOT, '..', '소리', '나레이션.json'), 'utf8'));
const show = Object.fromEntries(plan.lines.map((l) => [l.id, l.show || l.text]));
const ts = (s) => { const ms = Math.round(s * 1000); const h = String(Math.floor(ms / 3600000)).padStart(2, '0'); const m = String(Math.floor(ms / 60000) % 60).padStart(2, '0'); const sec = String(Math.floor(ms / 1000) % 60).padStart(2, '0'); return `${h}:${m}:${sec},${String(ms % 1000).padStart(3, '0')}`; };
const who = (id) => (id.startsWith('g') ? 'Gemini 답 읽기: ' : id.startsWith('c') ? 'ChatGPT 답 읽기: ' : '');
const rows = CLIPS.map((c, i) => {
  // 잘라 쓴 줄(cutFrom · cutTo)은 그 구간에 든 낱말만 — 영상에 실제로 들리는 말
  const text = c.cutFrom || c.cutTo
    ? VO[c.id].words.filter((w) => w.t >= (c.cutFrom || 0) - 0.01 && w.t < (c.cutTo ?? 999)).map((w) => w.w).join(' ')
    : show[c.id];
  return `${i + 1}\n${ts(c.at)} --> ${ts(clipEnd(c))}\n${who(c.id)}${text}\n`;
});
const out = path.resolve(process.argv[2] || path.join(ROOT, '..', '소리', '말.srt'));
fs.writeFileSync(out, rows.join('\n'));
fs.rmSync(tmp, { recursive: true, force: true });
console.log(out, rows.length + '줄');
