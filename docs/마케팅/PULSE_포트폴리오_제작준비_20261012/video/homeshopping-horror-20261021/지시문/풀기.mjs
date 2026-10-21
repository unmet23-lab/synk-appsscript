// 정지컷.json을 컷별 작업(지시문 글 · 참조 그림 절대 경로 · 받을 자리)으로 푼다(2026-10-21).
//   node 풀기.mjs            → synk-vendor/homeshopping-horror-20261021/ego/jobs.json (ego 실행기가 읽는다)
//   node 풀기.mjs --보기 C03  → 그 컷의 지시문과 참조만 찍는다
// 참조: F02x4 · F04x4 = 명세서 참조 4장(긴 변 1,400px JPEG로 줄인 사본), C01 같은 컷 이름 = 고른 정지컷(같은 크기로 줄인 사본).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const V = path.join(os.homedir(), 'Documents', 'synk-vendor', 'homeshopping-horror-20261021');
const REFS = path.join(V, 'ego', 'refs');
const STILLS = path.join(V, '정지컷');   // 고른 판: <컷>.png(받은 원본을 고른 뒤 이 이름으로 둔다)
const spec = JSON.parse(fs.readFileSync(path.join(HERE, '정지컷.json'), 'utf8'));
const MODELS = { F02x4: 'F02_harin', F04x4: 'F04_jiyu' };
const REF_NAMES = ['01_hero', '02_left90', '03_right45', '04_fullbody'];

function small(src, dst) {   // 긴 변 1,400px JPEG(올리기가 빠르고 Gemini가 받는 크기로 충분 — 현장 노트 S24)
  if (fs.existsSync(dst) && fs.statSync(dst).mtimeMs >= fs.statSync(src).mtimeMs) return dst;
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  execFileSync('python', ['-X', 'utf8', '-c',
    'import sys; from PIL import Image; im=Image.open(sys.argv[1]).convert("RGB"); im.thumbnail((1400,1400)); im.save(sys.argv[2], quality=92)', src, dst]);
  return dst;
}

function refsOf(cut) {
  const out = [];
  for (const r of cut.refs) {
    if (MODELS[r]) {
      for (const n of REF_NAMES) out.push(small(`C:/SYNK-LoRA/validation/${MODELS[r]}/refs/${n}.jpg`, path.join(REFS, `${r.slice(0, 3)}_${n}.jpg`)));
    } else {
      const src = path.join(STILLS, `${r}.png`);
      out.push(fs.existsSync(src) ? small(src, path.join(REFS, `${r}.jpg`)) : `(아직 없음) ${src}`);
    }
  }
  return out;
}

function textOf(cut) {
  return cut.text.replace(/\{([^}:]+)(?::(\d+))?\}/g, (_, k, n) => {
    const v = spec.공통[k];
    if (v === undefined) throw Error(`${cut.id}: 모르는 칸 ${k}`);
    return n ? v.replace('{n}', n) : v;
  }).replace(/\s+/g, ' ').trim();
}

const only = process.argv.includes('--보기') ? process.argv[process.argv.indexOf('--보기') + 1] : null;
const jobs = {};
for (const cut of spec.컷) {
  if (only && cut.id !== only) continue;
  const prompt = textOf(cut);
  if (prompt.length > 4300) throw Error(`${cut.id}: 지시문 ${prompt.length}자 — 4,300자 안으로(현장 노트)`);
  jobs[cut.id] = { id: cut.id, who: cut.who, ratio: '16:9', prompt, refs: refsOf(cut) };
}
if (only) {
  console.log(JSON.stringify(jobs[only], null, 1));
} else {
  const out = path.join(V, 'ego', 'jobs.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(jobs, null, 1));
  for (const j of Object.values(jobs)) console.log(j.id, j.prompt.length + '자', '참조 ' + j.refs.length, j.refs.some((r) => r.startsWith('(')) ? '— 참조 기다림' : '');
  console.log('→', out);
}
