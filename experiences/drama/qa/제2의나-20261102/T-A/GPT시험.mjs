#!/usr/bin/env node
/**
 * 제2의 나 · T-A GPT 시험관 (2026-11-02) — 판.mjs가 만든 판을 같은 질문으로 GPT에게 보인다.
 * 구독 경로만 쓴다: `tools/codex계정.js exec`(굽기 계정 장부 — 막힌 계정은 건너뛰고, 보조가 모두 막히면 예비) · 현금 0.
 * 질문은 표준입력, 그림은 붙인 순서대로 -i, 답은 마지막 메시지를 -o로 <폴더>/답.md에 받는다(현장노트 AI_CLI 「GPT 시험관이 API 크레딧 바닥…」).
 * 사람 손으로 돌릴 시험관 폴더와 섞이지 않게 GPT 몫은 따로 둔다 — 1회차 <밖>/GPT/<이름>/(판 다섯 장),
 * v2 <밖>/GPT_v2/<이름>/(두 벌 열 장, 첫째 · 둘째 순서는 시험관_v2와 같은 순서v2). 답이 든 폴더는 덮지 않는다.
 *
 *   node experiences/drama/qa/제2의나-20261102/T-A/GPT시험.mjs [--v2] [이름…]   (기본: 몽골남_게임 한국인_게임기획자)
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { 밖, 시험관들, 시험관폴더, 시험관폴더v2, 질문글, 질문글v2 } from './판.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.resolve(여기, '..', '..', '..', '..', '..');
const v2 = process.argv.includes('--v2');
const 고른 = process.argv.slice(2).filter((a) => a !== '--v2');
const 이름들 = 고른.length ? 고른 : ['몽골남_게임', '한국인_게임기획자'];

function 부르기(폴더, 그림들, 질문) {
  return new Promise((resolve) => {
    const args = [path.join(뿌리, 'tools', 'codex계정.js'), 'exec', '--ephemeral', '--skip-git-repo-check', '-C', 폴더, '-s', 'read-only', '-o', path.join(폴더, '답.md')];
    for (const f of 그림들) args.push('-i', f);
    const 기록 = fs.createWriteStream(path.join(폴더, '_실행.log'));
    const 시작 = Date.now();
    const c = spawn(process.execPath, args, { cwd: 폴더, stdio: ['pipe', 'pipe', 'pipe'] });
    c.stdout.pipe(기록, { end: false });
    c.stderr.on('data', (d) => { 기록.write(d); process.stderr.write(d); });
    c.stdin.end(질문);
    c.on('close', (code) => { 기록.end(`\n[GPT시험] 종료 ${code} · ${Math.round((Date.now() - 시작) / 1000)}초\n`); resolve(code); });
  });
}

for (const 이름 of 이름들) {
  if (!시험관들[이름]) throw new Error('모르는 시험관: ' + 이름);
  let 폴더;
  let 그림들;
  let 질문;
  if (v2) {
    // 시험관_v2 폴더의 첫째 · 둘째 판을 A/B 벌로 되돌려 같은 순서로 GPT_v2에 넣는다
    const 원 = path.join(밖, '시험관_v2', 이름);
    const 짝 = JSON.parse(fs.readFileSync(path.join(밖, '시험관_v2', '짝표.json'), 'utf8')).시험관[이름];
    const 벌 = { [짝.첫째]: [], [짝.둘째]: [] };
    for (const 자리 of ['첫째', '둘째']) for (let n = 1; n <= 5; n++) {
      const f = path.join(원, `${자리}_판_0${n}.png`);
      if (!fs.existsSync(f)) throw new Error('판.mjs --v2를 먼저 돌린다 — 없음: ' + f);
      벌[짝[자리]].push(f);
    }
    const r = 시험관폴더v2('GPT_v2', 이름, 벌, { 마지막메시지: true });
    ({ 폴더, 그림들 } = r);
    질문 = 질문글v2(이름, { 마지막메시지: true });
    console.log(`[GPT시험] ${이름} v2 첫째 ${r.첫째} · 둘째 ${r.둘째} → ${폴더}`);
  } else {
    const 원판 = [1, 2, 3, 4, 5].map((n) => path.join(밖, '시험관', 이름, `판_0${n}.png`));
    for (const f of 원판) if (!fs.existsSync(f)) throw new Error('판.mjs를 먼저 돌린다 — 없음: ' + f);
    폴더 = 시험관폴더('GPT', 이름, 원판, { 마지막메시지: true });
    그림들 = [1, 2, 3, 4, 5].map((n) => path.join(폴더, `판_0${n}.png`));
    질문 = 질문글(이름, { 마지막메시지: true });
    console.log(`[GPT시험] ${이름} → ${폴더}`);
  }
  const code = await 부르기(폴더, 그림들, 질문);
  const 답 = path.join(폴더, '답.md');
  console.log(`[GPT시험] ${이름} 종료 ${code} · 답 ${fs.existsSync(답) ? fs.statSync(답).size + '바이트' : '없음'}`);
  if (code !== 0) process.exitCode = code;
}
