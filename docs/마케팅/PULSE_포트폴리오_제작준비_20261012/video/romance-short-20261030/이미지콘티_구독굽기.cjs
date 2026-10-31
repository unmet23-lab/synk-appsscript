#!/usr/bin/env node
'use strict';
// 로맨스 단편 콘티 — API 굽기가 멈춘 동안 Codex 구독 경로로 한 장(현장 노트 「API 굽기가 멈춘 동안 … Codex 구독 경로로 이어 굽는다」, .tmp/drama-art-20261030/굽기.cjs와 같은 길)
//   node 이미지콘티_구독굽기.cjs <저장소 뿌리> <작업.json> <컷> <낼 png> <기록 폴더> — 이미지콘티_태준.py 굽기가 부른다
const fs = require('fs'), os = require('os'), path = require('path');
const { spawn } = require('child_process');
const [뿌리, 작업, 컷, 낼, 기록] = process.argv.slice(2);
const j = JSON.parse(fs.readFileSync(작업, 'utf8'))[컷];
const 머리 = 'Use your image generation tool to create exactly ONE image. Do not write code, do not edit files, do not run shell commands. After the image is generated, reply with one short line describing it.\n\n';
fs.mkdirSync(기록, { recursive: true });
const 지시 = path.join(기록, `${컷}_지시문.txt`);
fs.writeFileSync(지시, 머리 + j.prompt, 'utf8');
const 일터 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-romance-'));
const 답 = path.join(기록, `${컷}_답.txt`), 사건 = path.join(기록, `${컷}_사건.jsonl`);
const 인자 = ['tools/codex계정.js', 'exec', '--json', '--skip-git-repo-check', '-C', 일터, '-s', 'read-only'];
for (const r of j.refs) { if (!fs.existsSync(r)) { console.error('참고 없음 ' + r); process.exit(2); } 인자.push('-i', r); }
인자.push('-o', 답, '-');
const 시작 = Date.now();
const 자식 = spawn(process.execPath, 인자, { cwd: 뿌리, stdio: ['pipe', 'pipe', 'inherit'] });
fs.createReadStream(지시).pipe(자식.stdin);
const 줄쓰기 = fs.createWriteStream(사건);
let 남은 = '', 실 = null;
자식.stdout.on('data', (d) => {
  줄쓰기.write(d); 남은 += d.toString('utf8');
  const 줄들 = 남은.split('\n'); 남은 = 줄들.pop();
  for (const 줄 of 줄들) { const m = /"thread_id"\s*:\s*"([^"]+)"/.exec(줄); if (m) 실 = m[1]; }
});
자식.on('close', (code) => {
  줄쓰기.end();
  const 초 = Math.round((Date.now() - 시작) / 1000);
  if (code !== 0) { console.error(`[codex] ${컷} 실패 — 종료 ${code} · ${초}초`); process.exit(code || 1); }
  const 집들 = [path.join(os.homedir(), '.codex')];
  const 굽기뿌리 = path.join(os.homedir(), '.codex-bake');
  if (fs.existsSync(굽기뿌리)) for (const d of fs.readdirSync(굽기뿌리)) 집들.push(path.join(굽기뿌리, d));
  const 그림들 = [];
  for (const 집 of 집들) {
    const 폴더 = path.join(집, 'generated_images', 실 || '-');
    if (fs.existsSync(폴더)) for (const f of fs.readdirSync(폴더)) if (/\.(png|jpe?g|webp)$/i.test(f)) 그림들.push({ 집: path.basename(집), 파일: path.join(폴더, f) });
  }
  if (!그림들.length) { console.error(`[codex] ${컷} 그림을 못 찾았다(thread ${실})`); process.exit(1); }
  fs.copyFileSync(그림들[그림들.length - 1].파일, 낼);
  console.log(`[codex] ${컷} → ${낼} · 계정 ${그림들[그림들.length - 1].집} · ${초}초`);
});
