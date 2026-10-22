// 배역후보.json을 후보별 작업(지시문 글 · 3:4 · 참조 없음)으로 푼다(2026-10-22).
//   node 후보풀기.mjs           → synk-vendor/homeshopping-horror-20261021/ego/jobs_배역후보.json (ego 실행기 gen.mjs가 JOB.jobsFile로 읽는다)
//   node 후보풀기.mjs --보기 통1 → 그 후보의 지시문만 찍는다
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const V = path.join(os.homedir(), 'Documents', 'synk-vendor', 'homeshopping-horror-20261021');
const spec = JSON.parse(fs.readFileSync(path.join(HERE, '배역후보.json'), 'utf8'));

const textOf = (c) => c.text.replace(/\{([^}]+)\}/g, (_, k) => {
  const v = spec.공통[k];
  if (v === undefined) throw Error(`${c.id}: 모르는 칸 ${k}`);
  return v;
}).replace(/\s+/g, ' ').trim();

const only = process.argv.includes('--보기') ? process.argv[process.argv.indexOf('--보기') + 1] : null;
const jobs = {};
for (const c of spec.후보) {
  if (only && c.id !== only) continue;
  const prompt = textOf(c);
  if (prompt.length > 4300) throw Error(`${c.id}: 지시문 ${prompt.length}자 — 4,300자 안으로(현장 노트)`);
  jobs[c.id] = { id: c.id, who: c.who, ratio: '3:4', prompt, refs: [] };
}
if (only) {
  console.log(JSON.stringify(jobs[only], null, 1));
} else {
  const out = path.join(V, 'ego', 'jobs_배역후보.json');
  fs.writeFileSync(out, JSON.stringify(jobs, null, 1));
  for (const j of Object.values(jobs)) console.log(j.id, j.who, j.prompt.length + '자');
  console.log('→', out);
}
