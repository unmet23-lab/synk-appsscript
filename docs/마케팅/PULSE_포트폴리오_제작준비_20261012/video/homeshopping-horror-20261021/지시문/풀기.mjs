// 정지컷.json을 컷별 작업(지시문 글 · 참조 그림 절대 경로 · 받을 자리)으로 푼다(2026-10-21).
//   node 풀기.mjs            → synk-vendor/homeshopping-horror-20261021/ego/jobs.json (ego 실행기가 읽는다)
//   node 풀기.mjs --보기 C03  → 그 컷의 지시문과 참조만 찍는다
//   node 풀기.mjs --파일 정지컷_v2.json → ego/jobs_정지컷_v2.json(10-22 새 배역판, --보기와 같이 써도 된다)
// 참조: F02x4 · F04x4 = 명세서 참조 4장, 통2x4 · 리4x4 = 배역 참조 4장(배역/참조/<배역>/), 유호x5 = 확정 얼굴 세트 5장(장부 S24 —
// B · C 크롭 + 실제 사진 셋), C01 같은 컷 이름 = 고른 정지컷. 모두 긴 변 1,400px JPEG로 줄인 사본을 올린다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const V = path.join(os.homedir(), 'Documents', 'synk-vendor', 'homeshopping-horror-20261021');
const REFS = path.join(V, 'ego', 'refs');
const STILLS = path.join(V, '정지컷');   // 고른 판: <컷>.png(받은 원본을 고른 뒤 이 이름으로 둔다)
const FILE = process.argv.includes('--파일') ? process.argv[process.argv.indexOf('--파일') + 1] : '정지컷.json';
const spec = JSON.parse(fs.readFileSync(path.join(HERE, FILE), 'utf8'));
const REF_NAMES = ['01_hero', '02_left90', '03_right45', '04_fullbody'];
const MODELS = {
  F02x4: REF_NAMES.map((n) => `C:/SYNK-LoRA/validation/F02_harin/refs/${n}.jpg`),
  F04x4: REF_NAMES.map((n) => `C:/SYNK-LoRA/validation/F04_jiyu/refs/${n}.jpg`),
  통2x4: REF_NAMES.map((n) => path.join(V, '배역', '참조', '통2', `${n}.jpg`)),
  리4x4: REF_NAMES.map((n) => path.join(V, '배역', '참조', '리4', `${n}.jpg`)),
  유호x5: ['1_B정면.jpg', '2_C정면.jpg', '3_실제_pro02.jpg', '4_실제_V181.jpg', '5_실제_V204.jpg']
    .map((n) => `C:/Users/q1212/Videos/한강2126_새판_20261009/재촬영_v40/기준그림/얼굴세트/_올림/${n}`),
};
// v4: 셋이 한 화면에 드는 컷은 한 사람에 참조 한두 장씩(정면 · 오른쪽 45° 또는 전신)
const REF_DIR = { F04: 'C:/SYNK-LoRA/validation/F04_jiyu/refs', 통2: path.join(V, '배역', '참조', '통2'), 리4: path.join(V, '배역', '참조', '리4') };
for (const [who, dir] of Object.entries(REF_DIR)) {
  MODELS[`${who}x2`] = ['01_hero', '03_right45'].map((n) => `${dir}/${n}.jpg`);
  MODELS[`${who}정면`] = [`${dir}/01_hero.jpg`];
  MODELS[`${who}전신`] = [`${dir}/04_fullbody.jpg`];
}

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
    if (r.startsWith('배치:')) {   // v4: 사람을 지운 배치도 · 실루엣(synk-vendor/…/콘티/v4/배치/<이름>.png — 원본 프레임은 넣지 않는다)
      const src = path.join(V, '콘티', 'v4', '배치', `${r.slice(3)}.png`);
      out.push(fs.existsSync(src) ? small(src, path.join(REFS, 'v4배치', `${r.slice(3)}.jpg`)) : `(아직 없음) ${src}`);
    } else if (MODELS[r]) {
      for (const src of MODELS[r]) {
        if (!fs.existsSync(src)) { out.push(`(아직 없음) ${src}`); continue; }
        out.push(small(src, path.join(REFS, `${r.replace(/x\d$/, '')}_${path.basename(src).replace(/\.\w+$/, '')}.jpg`)));
      }
    } else {
      const src = path.join(STILLS, `${r}.png`);
      out.push(fs.existsSync(src) ? small(src, path.join(REFS, `${r}.jpg`)) : `(아직 없음) ${src}`);
    }
  }
  return out;
}

function textOf(cut) {
  // 칸 안에 칸을 넣을 수 있다(v4 셋_전신 안의 옷 칸) — 세 번까지 풀어 준다
  let t = cut.text;
  for (let i = 0; i < 3 && /\{[^}:\s]+(?::\d+)?\}/.test(t); i++) {
    t = t.replace(/\{([^}:\s]+)(?::(\d+))?\}/g, (_, k, n) => {
      const v = spec.공통[k];
      if (v === undefined) throw Error(`${cut.id}: 모르는 칸 ${k}`);
      return n ? v.replaceAll('{n}', n) : v;
    });
  }
  return t.replace(/\s+/g, ' ').trim();
}

const only = process.argv.includes('--보기') ? process.argv[process.argv.indexOf('--보기') + 1] : null;
const jobs = {};
for (const cut of spec.컷) {
  if (only && cut.id !== only) continue;
  const prompt = textOf(cut);
  if (prompt.length > 4300) throw Error(`${cut.id}: 지시문 ${prompt.length}자 — 4,300자 안으로(현장 노트)`);
  if (/video/i.test(prompt)) throw Error(`${cut.id}: 지시문에 video — Gemini가 영상을 만들기 시작한다(현장 노트 10-23)`);
  jobs[cut.id] = { id: cut.id, who: cut.who, ratio: cut.ratio || '16:9', prompt, refs: refsOf(cut) };
}
if (only) {
  console.log(JSON.stringify(jobs[only], null, 1));
} else {
  const out = path.join(V, 'ego', FILE === '정지컷.json' ? 'jobs.json' : `jobs_${FILE.replace(/\.json$/, '')}.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(jobs, null, 1));
  for (const j of Object.values(jobs)) console.log(j.id, j.prompt.length + '자', '참조 ' + j.refs.length, j.refs.some((r) => r.startsWith('(')) ? '— 참조 기다림' : '');
  console.log('→', out);
}
