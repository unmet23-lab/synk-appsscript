#!/usr/bin/env node
'use strict';
/* 판본 영상 들이기(2026-11-13 — LAB 나라 판본 예약 작업 `synk-daily-lab-versions`가 회차 사본에서 판본을 만들 때).
 * 판본 영상 · 표지(게시/판본/<KEY>/video.mp4 · cover.png)는 git 밖이라 회차 사본(워크트리)에는 없고 공용 작업본에만 있다.
 * 돌림표는 공용 작업본까지 찾지만(tools/lib/공용작업본.js 미디어경로), 글자 검사의 「판본」 명령과 판본 사슬 확인(tools/판본글잇기.js 확인)은
 * 사본 안만 본다 — 그대로 돌리면 이미 구운 판본은 「영상이 없다」가 되고, 새로 구운 판본은 견줄 기준 판이 하나도 없이 글자 검사를 받는다.
 * 그래서 그 편의 판본 영상 · 표지를 공용 작업본에서 이 사본의 같은 자리로 복사해 둔다.
 *
 *   node tools/판본영상들이기.js <편 폴더…> [--json]
 *   시험용: --저장소 <이 사본 뿌리> · --공용 <공용 작업본 뿌리>
 *
 * 지키는 것: 사본에 이미 있는 파일은 덮지 않는다(이 회차가 방금 구운 판일 수 있다). 지우지 않는다. 공용 작업본에는 쓰지 않는다.
 *   수정 시각은 원본대로 둔다(끝의 `예약사본.js 넘기기`가 같은 내용 · 같은 시각으로 본다). 공용 작업본에서 부르면 들일 것이 없다(종료 0).
 * 종료 코드: 0 = 함 · 2 = 사용법 · 실행 오류.  시험: node --test tests/판본영상들이기.test.js
 */
const fs = require('node:fs');
const path = require('node:path');
const { 공용작업본 } = require('./lib/공용작업본.js');

const 들일파일 = ['video.mp4', 'cover.png'];
const 같은곳 = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();

/** @returns {{ 편: string, 들임: string[], 있음: number, 바이트: number, 까닭?: string }} */
function 들이기(저장소, 공용, 편폴더) {
  const abs = path.resolve(저장소, 편폴더);
  const rel = path.relative(path.resolve(저장소), abs);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`이 사본 안의 편 폴더가 아니다: ${편폴더}`);
  const out = { 편: rel.split(path.sep).join('/'), 들임: [], 있음: 0, 바이트: 0 };
  if (같은곳(저장소, 공용)) return { ...out, 까닭: '공용 작업본이라 들일 것이 없다' };
  const from = path.join(공용, rel, '게시', '판본');
  if (!fs.existsSync(from)) return { ...out, 까닭: '공용 작업본에 그 편의 판본 폴더가 없다' };
  for (const key of fs.readdirSync(from).filter((k) => /^[A-Z]{2}$/.test(k)).sort()) {
    for (const name of 들일파일) {
      const src = path.join(from, key, name);
      if (!fs.existsSync(src)) continue;
      const dst = path.join(abs, '게시', '판본', key, name);
      if (fs.existsSync(dst)) { out.있음 += 1; continue; }
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      const part = `${dst}.들이는중`;
      fs.copyFileSync(src, part);
      const st = fs.statSync(src);
      fs.utimesSync(part, st.atime, st.mtime);
      fs.renameSync(part, dst);
      out.들임.push(`${key}/${name}`);
      out.바이트 += st.size;
    }
  }
  return out;
}

function main(argv) {
  const value = (name) => { const i = argv.indexOf(name); return i > -1 ? argv[i + 1] : null; };
  const flags = new Set(['--저장소', '--공용']);
  const pieces = argv.filter((a, i) => !a.startsWith('--') && !flags.has(argv[i - 1]));
  if (!pieces.length) { console.error('쓰는 법: node tools/판본영상들이기.js <편 폴더…> [--json]'); return 2; }
  const 저장소 = path.resolve(value('--저장소') || path.join(__dirname, '..'));
  const 공용 = path.resolve(value('--공용') || 공용작업본(저장소));
  const results = [];
  try {
    for (const p of pieces) results.push(들이기(저장소, 공용, p));
  } catch (e) {
    console.error(`판본 영상을 들이지 못했다 — ${e.message}`);
    return 2;
  }
  if (argv.includes('--json')) { console.log(JSON.stringify({ 저장소, 공용, 편: results }, null, 2)); return 0; }
  for (const r of results) {
    const mb = (r.바이트 / 1048576).toFixed(1);
    console.log(r.까닭 ? `${r.편}: ${r.까닭}` : `${r.편}: 들임 ${r.들임.length}(${mb}MB) · 이미 있음 ${r.있음}${r.들임.length ? ` — ${[...new Set(r.들임.map((x) => x.split('/')[0]))].join(' ')}` : ''}`);
  }
  return 0;
}

module.exports = { 들이기 };
if (require.main === module) process.exit(main(process.argv.slice(2)));
