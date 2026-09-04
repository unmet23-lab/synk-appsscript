#!/usr/bin/env node
/*
 * 공방 원본을 구글 드라이브로 옮긴다 (유호 지시 2026-09-05 「구글 드라이브에 업로드해버리는건 어때?
 *   그리고 확인도 구글 드라이브로 하는거지」).
 *
 * ■ 왜 나누나 — 한 자산이 «두 몸»을 갖는다
 *   원본 4K PNG 한 장이 18.6MB 다. 102장이면 1.9GB 이고, 이 저장소의 `.git` 은 이미 4.6GB 다.
 *   git 은 큰 이진 파일을 지우지 않는다(이력에 영원히 남는다) — 한 번 넣으면 못 뺀다.
 *   그래서 갈랐다:
 *     · **원본 PNG** → 드라이브. 보관이자 «유호님이 크게 보시는 곳»이다.
 *     · **AVIF(원본 크기 그대로 · 한 장 0.7MB)** → 저장소. 지면·앱·인쇄가 실제로 부르는 것.
 *   AVIF 는 원본의 3.8% 인데 눈으로 구분되지 않는다(09-05 실측 PSNR 48.1dB · `공방뒤처리.py` 머리말).
 *
 * ■ 통로
 *   구글 드라이브 «데스크톱 앱»이 `G:` 로 붙어 있으면 그냥 복사하면 된다(앱이 알아서 올린다).
 *   🔑 앱이 꺼져 있으면 이 도구가 **켠다** — 09-05 실측으로 로그인이 남아 있어 손이 안 들었다.
 *   ⚠ 그래도 안 붙으면 유호님이 한 번 로그인하셔야 한다(자격증명은 유호님 손이다).
 *
 * 쓰기:
 *   node tools/공방드라이브.js              # 아직 안 올린 원본만 복사
 *   node tools/공방드라이브.js --치움        # 복사한 뒤 로컬 원본을 지운다(디스크 1.9GB 를 비운다)
 *   node tools/공방드라이브.js --재본다      # 무엇을 몇 MB 옮길지만 본다
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const 루트 = path.resolve(__dirname, '..');
const 저장방 = path.join(루트, 'docs/Loom_자산/구움');
const 드라이브방 = 'G:/내 드라이브/SYNK_이미지/공방_원본';
const 앱 = 'C:/Program Files/Google/Drive File Stream';

const 인자 = process.argv.slice(2);
const 치움 = 인자.includes('--치움');
const 재본다 = 인자.includes('--재본다');

/** 드라이브가 붙어 있나. 없으면 앱을 켜고 최대 40초 기다린다. */
function 드라이브붙었나() {
  if (fs.existsSync('G:/내 드라이브')) return true;
  if (!fs.existsSync(앱)) return false;
  const 판 = fs.readdirSync(앱).filter((d) => /^\d+\./.test(d)).sort().pop();
  const exe = 판 && path.join(앱, 판, 'GoogleDriveFS.exe');
  if (!exe || !fs.existsSync(exe)) return false;
  console.log('■ 드라이브가 꺼져 있다 — 켠다.');
  try {
    execFileSync('powershell', ['-NoProfile', '-Command',
      `Start-Process '${exe}' -WindowStyle Minimized`], { stdio: 'ignore' });
  } catch { /* 켜기 실패해도 아래 대기에서 걸러진다 */ }
  const 끝 = Date.now() + 40000;
  while (Date.now() < 끝) {
    if (fs.existsSync('G:/내 드라이브')) { console.log('  ✅ 붙었다.'); return true; }
    execFileSync('powershell', ['-NoProfile', '-Command', 'Start-Sleep -Seconds 2'], { stdio: 'ignore' });
  }
  return false;
}

const 원본들 = fs.readdirSync(저장방)
  .filter((f) => /^(공방|시험)_.*\.png$/.test(f) && !f.endsWith('_누끼.png'))
  .map((f) => ({ 이름: f, 바이트: fs.statSync(path.join(저장방, f)).size }));

if (원본들.length === 0) { console.log('■ 옮길 원본이 없다(0장).'); process.exit(0); }
const 합MB = (원본들.reduce((a, x) => a + x.바이트, 0) / 1024 / 1024).toFixed(0);
console.log(`■ 원본 ${원본들.length}장 · 합계 ${합MB}MB → ${드라이브방}`);

if (재본다) { console.log('■ 재보기만 했다 — 한 장도 안 옮겼다.'); process.exit(0); }
if (!드라이브붙었나()) {
  console.log('🔴 드라이브가 안 붙었다. 유호님이 한 번 로그인하셔야 한다:');
  console.log('   시작 메뉴 → 「Google Drive」 실행 → 브라우저가 열리면 계정 고르고 허용.');
  console.log('   그 뒤 이 명령을 다시 부르면 된다(다음부터는 자동이다).');
  process.exit(1);
}

fs.mkdirSync(드라이브방, { recursive: true });
let 옮김 = 0; let 건너뜀 = 0; let 지움 = 0;
for (const { 이름, 바이트 } of 원본들) {
  const 여기 = path.join(저장방, 이름);
  const 저기 = path.join(드라이브방, 이름);
  try {
    if (fs.existsSync(저기) && fs.statSync(저기).size === 바이트) {
      건너뜀++;
    } else {
      fs.copyFileSync(여기, 저기);
      옮김++;
      console.log(`   ✅ ${이름} ${(바이트 / 1024 / 1024).toFixed(1)}MB`);
    }
    if (치움) { fs.unlinkSync(여기); 지움++; }
  } catch (e) {
    console.log(`   🔴 ${이름} — ${String(e.message).slice(0, 120)}`);
  }
}
console.log(`■ 합계 ${원본들.length}장 = 새로 옮김 ${옮김} + 이미 있음 ${건너뜀}`
  + (치움 ? ` · 로컬 원본 ${지움}장을 지웠다` : ''));
console.log('   드라이브 앱이 뒤에서 올린다 — 폰·태블릿에서도 같은 폴더로 보신다.');
