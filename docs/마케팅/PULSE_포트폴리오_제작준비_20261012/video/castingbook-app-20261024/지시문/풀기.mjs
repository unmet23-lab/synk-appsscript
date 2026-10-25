// 이미지콘티.json을 컷별 작업(지시문 글 · 참조 그림 절대 경로)으로 푼다(2026-10-25, 「매진 임박」 지시문/풀기.mjs와 같은 꼴).
//   node 풀기.mjs            → synk-vendor/pulse-portfolio12-20261024/콘티/p8/ego/jobs.json (ego 실행기가 읽는다)
//   node 풀기.mjs --보기 C03  → 그 컷의 지시문과 참조만 찍는다
// 참조: 소연x4 = 명세서 참조 4장(C:/SYNK-LoRA/validation/F05_soyeon/refs), 배치:S03 = 배치도(git 밖 콘티/p8/배치 — 원본 프레임은 넣지 않는다),
// R1 · C01 같은 이름 = 고른 판(콘티/p8/정지컷/<이름>.png). 모두 긴 변 1,400px JPEG로 줄인 사본을 올린다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const P8 = path.join(os.homedir(), 'Documents', 'synk-vendor', 'pulse-portfolio12-20261024', '콘티', 'p8');
const REFS = path.join(P8, 'ego', 'refs');
const STILLS = path.join(P8, '정지컷');
const spec = JSON.parse(fs.readFileSync(path.join(HERE, '이미지콘티.json'), 'utf8'));
const MODELS = {
  소연x4: ['01_hero', '02_left90', '03_right90', '04_fullbody'].map((n) => `C:/SYNK-LoRA/validation/F05_soyeon/refs/${n}.jpg`),
  // 10-26: 거꾸로 얼굴(1 · 4번) 닮음을 올리려고 소연 참조를 180° 돌린 사본(git 밖 콘티/p8/참조)
  소연거꾸로x3: ['01_hero', '02_left90', '03_right90'].map((n) => path.join(P8, '참조', `소연거꾸로_${n}.jpg`)),
};

function small(src, dst) {   // 긴 변 1,400px JPEG(올리기가 빠르고 Gemini가 받는 크기로 충분 — 현장 노트 S24). 새 파일이라 hard link 거절도 없다.
  if (fs.existsSync(dst) && fs.statSync(dst).mtimeMs >= fs.statSync(src).mtimeMs) return dst;
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  execFileSync('python', ['-X', 'utf8', '-c',
    'import sys; from PIL import Image; im=Image.open(sys.argv[1]).convert("RGB"); im.thumbnail((1400,1400)); im.save(sys.argv[2], quality=92)', src, dst]);
  return dst;
}

function refsOf(cut) {
  const out = [];
  for (const r of cut.refs) {
    if (r.startsWith('배치:')) {
      const src = path.join(P8, '배치', `${r.slice(3)}.png`);
      out.push(fs.existsSync(src) ? small(src, path.join(REFS, '배치', `${r.slice(3)}.jpg`)) : `(아직 없음) ${src}`);
    } else if (r.startsWith('참조:')) {   // 10-26: 돌린 배치도 · 카페 같은 손본 참조(git 밖 콘티/p8/참조)
      const src = path.join(P8, '참조', r.slice(3));
      out.push(fs.existsSync(src) ? small(src, path.join(REFS, '참조_' + r.slice(3).replace(/\.\w+$/, '') + '.jpg')) : `(아직 없음) ${src}`);
    } else if (MODELS[r]) {
      for (const src of MODELS[r]) {
        if (!fs.existsSync(src)) { out.push(`(아직 없음) ${src}`); continue; }
        out.push(small(src, path.join(REFS, `소연_${path.basename(src).replace(/\.\w+$/, '')}.jpg`)));
      }
    } else {
      const src = path.join(STILLS, `${r}.png`);
      out.push(fs.existsSync(src) ? small(src, path.join(REFS, `${r}.jpg`)) : `(아직 없음) ${src}`);
    }
  }
  return out;
}

function textOf(cut) {
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
  const out = path.join(P8, 'ego', 'jobs.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(jobs, null, 1));
  for (const j of Object.values(jobs)) console.log(j.id, j.prompt.length + '자', '참조 ' + j.refs.length, j.refs.some((r) => r.startsWith('(')) ? '— 참조 기다림' : '');
  console.log('→', out);
}
