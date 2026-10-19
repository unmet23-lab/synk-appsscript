#!/usr/bin/env node
'use strict';
/**
 * 라디오 DJ 장면 한 판 굽기 (2026-10-19).
 *
 * GPT 이미지 2.5(ChatGPT 구독 · Codex CLI)를 `node tools/codex계정.js exec`로 부른다 — 지시문은 표준입력,
 * 참고 그림은 -i, 굽기 계정 고르기·한도 넘기기는 codex계정.js가 맡는다(AI 운영 원칙 · 비용과 권한).
 * 구운 그림은 그 계정의 generated_images/<thread>/ 에 생기므로 --json 사건에서 thread_id를 읽어
 * `구운판/<이름>_<시각>.png` 로 옮겨 적는다(원본 PNG는 git 밖 · 원본 창고 SYNK-appsscript 묶음이 올린다).
 *
 *   node docs/라디오/DJ장면_20261019/굽기.cjs <지시문.txt> <이름> [참고 그림…]
 *
 * 참고 그림 첫 장이 고칠 장면이면(표정 판) 지시문이 그렇게 말한다 — 이 도구는 순서를 그대로 넘긴다.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const 여기 = __dirname;
const 뿌리 = path.resolve(여기, '..', '..', '..');
const [지시문, 이름, ...참고] = process.argv.slice(2);
if (!지시문 || !이름) {
  console.error('사용: node 굽기.cjs <지시문.txt> <이름> [참고 그림…]');
  process.exit(2);
}
const 구운판 = path.join(여기, '구운판');
const 기록 = path.join(구운판, '_기록');
fs.mkdirSync(기록, { recursive: true });
const 때 = new Date();
const 시각 = [때.getHours(), 때.getMinutes(), 때.getSeconds()].map((n) => String(n).padStart(2, '0')).join('');
const 일터 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-radio-dj-'));
const 답 = path.join(기록, `${이름}_${시각}_답.txt`);
const 사건 = path.join(기록, `${이름}_${시각}_사건.jsonl`);

const 인자 = ['tools/codex계정.js', 'exec', '--json', '--skip-git-repo-check', '-C', 일터, '-s', 'read-only'];
for (const p of 참고) inArgs(path.resolve(p));
function inArgs(p) {
  if (!fs.existsSync(p)) { console.error('참고 그림이 없다: ' + p); process.exit(2); }
  인자.push('-i', p);
}
인자.push('-o', 답, '-');

const 시작 = Date.now();
const 자식 = spawn(process.execPath, 인자, { cwd: 뿌리, stdio: ['pipe', 'pipe', 'inherit'] });
fs.createReadStream(path.resolve(지시문)).pipe(자식.stdin);
const 사건줄 = fs.createWriteStream(사건);
let 남은 = '';
let 실 = null;
자식.stdout.on('data', (d) => {
  사건줄.write(d);
  남은 += d.toString('utf8');
  const 줄들 = 남은.split('\n');
  남은 = 줄들.pop();
  for (const 줄 of 줄들) {
    const m = /"thread_id"\s*:\s*"([^"]+)"/.exec(줄);
    if (m && !실) 실 = m[1];
  }
});
자식.on('close', (code) => {
  사건줄.end();
  const 초 = Math.round((Date.now() - 시작) / 1000);
  if (code !== 0) { console.error(`[굽기] ${이름} 실패 — 종료 ${code} · ${초}초 (사건 ${사건})`); process.exit(code || 1); }
  if (!실) { console.error(`[굽기] ${이름} thread_id를 못 읽었다 — ${사건}`); process.exit(1); }
  const 집들 = [path.join(os.homedir(), '.codex')];
  const 굽기뿌리 = path.join(os.homedir(), '.codex-bake');
  if (fs.existsSync(굽기뿌리)) for (const d of fs.readdirSync(굽기뿌리)) 집들.push(path.join(굽기뿌리, d));
  const 그림들 = [];
  for (const 집 of 집들) {
    const 폴더 = path.join(집, 'generated_images', 실);
    if (fs.existsSync(폴더)) for (const f of fs.readdirSync(폴더)) if (/\.(png|jpe?g|webp)$/i.test(f)) 그림들.push({ 집: path.basename(집), 파일: path.join(폴더, f) });
  }
  if (!그림들.length) { console.error(`[굽기] ${이름} 그림을 못 찾았다(thread ${실})`); process.exit(1); }
  그림들.forEach((g, i) => {
    const 낼 = path.join(구운판, `${이름}_${시각}${그림들.length > 1 ? '_' + (i + 1) : ''}${path.extname(g.파일)}`);
    fs.copyFileSync(g.파일, 낼);
    console.log(`[굽기] ${이름} → ${path.relative(뿌리, 낼)} · 계정 ${g.집} · thread ${실} · ${초}초`);
  });
});
