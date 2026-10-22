// 배역참조.json을 장별 작업(지시문 · 비율 · 고른 후보 사진 한 장을 참조로)으로 푼다(2026-10-22).
//   node 참조풀기.mjs            → synk-vendor/homeshopping-horror-20261021/ego/jobs_배역참조.json (gen.mjs가 JOB.jobsFile로 읽는다)
//   node 참조풀기.mjs --보기 통2_01_hero
// 참조: 배역/후보/<후보>_*.jpg 가운데 마지막 판을 긴 변 1,400px JPEG로 줄여 ego/refs/에 둔다(풀기.mjs와 같은 크기).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const V = path.join(os.homedir(), 'Documents', 'synk-vendor', 'homeshopping-horror-20261021');
const spec = JSON.parse(fs.readFileSync(path.join(HERE, '배역참조.json'), 'utf8'));

function pick(who) {
  const dir = path.join(V, '배역', '후보');
  const f = fs.readdirSync(dir).filter((n) => n.startsWith(`${who}_`)).sort().pop();
  if (!f) throw Error(`후보 사진 없음: ${who}`);
  const dst = path.join(V, 'ego', 'refs', `후보_${who}.jpg`);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  execFileSync('python', ['-X', 'utf8', '-c',
    'import sys; from PIL import Image; im=Image.open(sys.argv[1]).convert("RGB"); im.thumbnail((1400,1400)); im.save(sys.argv[2], quality=92)', path.join(dir, f), dst]);
  return dst;
}

const textOf = (c) => c.text.replace(/\{([^}]+)\}/g, (_, k) => {
  const v = spec.공통[k];
  if (v === undefined) throw Error(`${c.id}: 모르는 칸 ${k}`);
  return v;
}).replace(/\s+/g, ' ').trim();

const only = process.argv.includes('--보기') ? process.argv[process.argv.indexOf('--보기') + 1] : null;
const refs = {};
const jobs = {};
for (const c of spec.참조) {
  if (only && c.id !== only) continue;
  refs[c.who] ??= pick(c.who);
  const prompt = textOf(c);
  if (prompt.length > 4300) throw Error(`${c.id}: 지시문 ${prompt.length}자 — 4,300자 안으로(현장 노트)`);
  jobs[c.id] = { id: c.id, who: c.who, ratio: c.ratio, prompt, refs: [refs[c.who]] };
}
if (only) {
  console.log(JSON.stringify(jobs[only], null, 1));
} else {
  const out = path.join(V, 'ego', 'jobs_배역참조.json');
  fs.writeFileSync(out, JSON.stringify(jobs, null, 1));
  for (const j of Object.values(jobs)) console.log(j.id, j.ratio, j.prompt.length + '자', path.basename(j.refs[0]));
  console.log('→', out);
}
