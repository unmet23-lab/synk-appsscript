#!/usr/bin/env node
// 퀴즈 한 편 폴더에 렌더 사본을 세운다(2026-11-10 · LAB 하루 두 편 설계 9).
//   node docs/마케팅/LAB_퀴즈은행/틀/새편.mjs <편 폴더> [--갱신]
// 만드는 것: <편>/remotion/ — 틀의 src · public(글꼴 · 효과음 · bgm.wav · 로고) · 설정 파일 사본과 node_modules 연결(틀의 것을 junction).
//   편마다 바뀌는 파일(src/episode.json · src/vo.generated.ts · public/img/편 그림 · public/vo)은 편 폴더 것이 정본이라 덮지 않는다.
//   --갱신: 틀 src · 곡(public/bgm.wav) · 효과음을 고친 뒤 편 사본에 다시 옮길 때(편 파일은 그대로). 동결(설계 20)한 편에는 쓰지 않는다 — 렌더가 바뀐다.
//     박자표(src/beats.json)를 고쳤으면 이어서 목소리계획.mjs → 나레이션굽기 --다듬기 → 판본글.mjs.
// 왜 편마다 사본인가: tools/음악층.js · 올리기전검사 ⑭가 <편>/remotion(src/Root.tsx · public/bgm.* · public/vo)을 읽는다.
// 언어 프로필: C 묶음의 docs/마케팅/현지화/언어프로필.json이 있으면 src/langProfile.json으로 옮긴다(없으면 빈 {} — lang.ts 기본값).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 틀 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.resolve(틀, '..', '..', '..', '..');
const 편 = process.argv[2] ? path.resolve(process.argv[2]) : null;
const 갱신 = process.argv.includes('--갱신');
if (!편) {
  console.error('사용: node 새편.mjs <편 폴더> [--갱신]');
  process.exit(2);
}
const 사본 = path.join(편, 'remotion');
const 편파일 = new Set(['episode.json', 'vo.generated.ts', 'langProfile.json']);

function 복사(src, dst, 건너뛸 = () => false) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const a = path.join(src, e.name), b = path.join(dst, e.name);
    if (건너뛸(e.name, a)) continue;
    if (e.isDirectory()) 복사(a, b, 건너뛸); else fs.copyFileSync(a, b);
  }
}

fs.mkdirSync(사본, { recursive: true });
for (const f of ['package.json', 'package-lock.json', 'tsconfig.json', 'remotion.config.ts', '.gitignore']) fs.copyFileSync(path.join(틀, f), path.join(사본, f));
// src: 편 파일은 처음에만(없을 때만) 틀 것을 놓는다
복사(path.join(틀, 'src'), path.join(사본, 'src'), (name) => 편파일.has(name) && fs.existsSync(path.join(사본, 'src', name)));
for (const f of 편파일) if (!fs.existsSync(path.join(사본, 'src', f))) fs.copyFileSync(path.join(틀, 'src', f), path.join(사본, 'src', f));
// public: 글꼴 · 효과음 · 음악 · 로고는 틀 것이라 늘 틀에서 다시 옮긴다(편 그림 · 목소리는 편 것 — 손대지 않는다).
// v6: --갱신이 bgm.wav를 건너뛰어, 박자표 · 곡을 고친 틀(틀/음악.mjs)이 편에 안 닿았다.
for (const d of ['fonts', 'sfx']) 복사(path.join(틀, 'public', d), path.join(사본, 'public', d));
fs.copyFileSync(path.join(틀, 'public', 'bgm.wav'), path.join(사본, 'public', 'bgm.wav'));
fs.mkdirSync(path.join(사본, 'public', 'img'), { recursive: true });
fs.copyFileSync(path.join(틀, 'public', 'img', 'logo-lab.webp'), path.join(사본, 'public', 'img', 'logo-lab.webp'));
// 언어 프로필(C 묶음)
const 프로필 = path.join(뿌리, 'docs', '마케팅', '현지화', '언어프로필.json');
if (fs.existsSync(프로필)) {
  fs.copyFileSync(프로필, path.join(사본, 'src', 'langProfile.json'));
  console.log('언어 프로필: docs/마케팅/현지화/언어프로필.json → src/langProfile.json');
} else console.log('언어 프로필: 정본 파일이 아직 없다 — src/lang.ts 기본값으로 렌더한다');
// node_modules: 틀의 것을 잇는다(편마다 365개 패키지를 다시 받지 않게). 틀에 없으면 먼저 틀에서 npm ci.
const 모듈 = path.join(사본, 'node_modules');
if (!fs.existsSync(모듈)) {
  const 틀모듈 = path.join(틀, 'node_modules');
  if (!fs.existsSync(틀모듈)) {
    console.error(`틀에 node_modules가 없다 — 먼저: cd ${path.relative(process.cwd(), 틀)} && npm ci --prefer-offline`);
    process.exit(1);
  }
  fs.symlinkSync(틀모듈, 모듈, 'junction');
}
console.log(`${갱신 ? '갱신' : '세움'}: ${path.relative(뿌리, 사본)}`);
