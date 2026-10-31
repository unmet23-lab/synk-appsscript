#!/usr/bin/env node
'use strict';
/**
 * 싱크타운 카페 0단계 시험(T2 축소판) 그림 굽기 (2026-10-31, 드라마 실사 칸 굽기 `.tmp/drama-art-20261030/굽기.cjs`를 옮김).
 *
 * GPT 이미지 2.5(ChatGPT 구독 · Codex CLI)를 `node tools/codex계정.js exec`로 부른다 — 현금 0, 크레딧 경로 아님.
 * 지시문은 표준입력, 참고 그림은 -i(5장까지 — 현장노트 그림 굽기), 계정 고르기 · 한도 넘기기는 codex계정.js가 맡는다.
 * 구운 그림은 그 계정의 generated_images/<thread>/ 에 생기므로 --json 사건의 마지막 thread_id로 찾아
 * 공용 작업본 `.tmp/town-cafe-0-20261031/판/<이름>_<시각>.png` 로 옮긴다(그림은 git 밖).
 *
 *   node experiences/synk-town/qa/카페0단계시험-20261031/굽기.cjs <지시문.txt> <이름> [참고 그림…]
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { 공용작업본 } = require('../../../../tools/lib/공용작업본.js');

const 뿌리 = path.resolve(__dirname, '..', '..', '..', '..');
const 밖 = process.env.TOWN_CAFE_OUT || path.join(공용작업본(뿌리), '.tmp', 'town-cafe-0-20261031');
const [지시문, 이름, ...참고] = process.argv.slice(2);
if (!지시문 || !이름) {
  console.error('사용: node 굽기.cjs <지시문.txt> <이름> [참고 그림…]');
  process.exit(2);
}
if (참고.length > 5) {
  console.error('참고 그림은 5장까지 — Codex 그림 도구가 넘치는 장을 제멋대로 뺀다(현장노트 그림 굽기)');
  process.exit(2);
}
const 구운판 = path.join(밖, '판');
const 기록 = path.join(구운판, '_기록');
fs.mkdirSync(기록, { recursive: true });
const 때 = new Date();
const 시각 = [때.getHours(), 때.getMinutes(), 때.getSeconds()].map((n) => String(n).padStart(2, '0')).join('');
const 일터 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-town-cafe-'));
const 답 = path.join(기록, `${이름}_${시각}_답.txt`);
const 사건 = path.join(기록, `${이름}_${시각}_사건.jsonl`);

const 인자 = ['tools/codex계정.js', 'exec', '--json', '--skip-git-repo-check', '-C', 일터, '-s', 'read-only'];
for (const p of 참고) {
  const 절대 = path.resolve(p);
  if (!fs.existsSync(절대)) { console.error('참고 그림이 없다: ' + 절대); process.exit(2); }
  인자.push('-i', 절대);
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
    // 한도에 걸리면 codex계정.js가 다른 계정으로 다시 부르며 thread가 새로 열린다 — 그림은 마지막 thread에 있다
    const m = /"thread_id"\s*:\s*"([^"]+)"/.exec(줄);
    if (m) 실 = m[1];
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
    console.log(`[굽기] ${이름} → ${낼} · 계정 ${g.집} · thread ${실} · ${초}초`);
  });
});
