#!/usr/bin/env node
/**
 * 앱 로고 굽기 — 정본 SVG 를 SYNK-talk 의 자산 PNG 로 (유호 08-25 「탈크 앱에 syn< 배선」)
 *
 * 왜 자산으로 굽나: talk 은 **react-native-svg 를 안 들인다**(기호.js 규율 — 기호 하나 때문에
 *   네이티브 모듈을 들이면 빌드·EAS 표면이 넓어진다). 그리고 `syn` 글자를 텍스트로 그릴 수도
 *   없다 — talk 에 실린 폰트는 SUIT·DM Mono 뿐이고 **Inter Tight 가 없다**(테마.js 실측).
 *   ⇒ 워드마크는 굽는다. 기호.js 주석이 예고한 그 길이고, 마스코트와 같은 문법이다.
 *
 * 🔑 **정본에서만 굽는다** — 이 파일은 좌표를 하나도 안 갖는다(사본 금지). 로고정본.js 가 고쳐지면
 *   이 명령을 다시 돌리는 것이 갱신 절차다.
 *
 * 사용: node tools/앱로고굽기.js            (굽고 talk/assets 에 쓴다)
 *      node tools/앱로고굽기.js --확인      (쓰지 않고 크기만 보고)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const 로고 = require('./lib/로고정본.js');

const 크롬 = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const talk = path.resolve(__dirname, '..', '..', 'SYNK-talk');
const 확인만 = process.argv.includes('--확인');

/* 구울 것 — 앱이 로고를 «보이는» 자리는 스플래시 하나다(로딩 화면은 기호 단독이 정본 자리).
 * 배경 투명 · 3배 해상도(고밀도 기기) · 정사각 캔버스는 Expo 관례라 PNG 합성 단계에서 맞춘다. */
const 굽기 = [
  { 이름: 'splash-icon.png', svg: 로고.워드마크({ 판: '다크', 신호: '꺾쇠' }), 폭: 1024, 정사각: true },
];

const 임시 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-로고-'));
let 쓴것 = 0;
for (const g of 굽기) {
  /* viewBox 비율 그대로 굽는다 — 락업은 가로가 길다(194:128) */
  const vb = g.svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
  const 비 = vb[3] / vb[2];
  const 높이 = Math.round(g.폭 * 비);
  const html = `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;background:transparent}svg{width:${g.폭}px;height:${높이}px;display:block}</style>
${g.svg}`;
  const hp = path.join(임시, g.이름.replace('.png', '.html'));
  const pp = path.join(임시, g.이름);
  fs.writeFileSync(hp, html);
  execFileSync(크롬, ['--headless=new', '--disable-gpu', '--hide-scrollbars',
    '--default-background-color=00000000', `--screenshot=${pp}`,
    `--window-size=${g.폭},${높이}`, `file:///${hp.replace(/\\/g, '/')}`], { stdio: 'pipe' });

  const 목표 = path.join(talk, 'assets', g.이름);
  console.log(`  ${g.이름} — ${g.폭}×${높이}${g.정사각 ? ' → 정사각 합성 필요' : ''}`);
  if (!확인만) {
    if (g.정사각) {
      /* Expo 관례상 정사각 캔버스 — 파이썬(PIL)로 중앙 합성. talk 에 파이썬 의존을 안 남기려고
         굽는 쪽(이 저장소)에서 끝낸다. */
      const py = `
import io
from PIL import Image
src = Image.open(r"${pp}").convert("RGBA")
n = max(src.size)
canvas = Image.new("RGBA", (n, n), (0, 0, 0, 0))
canvas.paste(src, ((n - src.width) // 2, (n - src.height) // 2), src)
canvas.save(r"${목표}")
print("saved", canvas.size)`;
      const pyf = path.join(임시, 'sq.py');
      fs.writeFileSync(pyf, py);
      console.log('   ', execFileSync('python', [pyf], { encoding: 'utf8' }).trim());
    } else {
      fs.copyFileSync(pp, 목표);
    }
    쓴것++;
  }
}
console.log(확인만 ? '[앱로고굽기] --확인 — 쓰지 않았다' : `[앱로고굽기] ${쓴것}개 → SYNK-talk/assets`);
