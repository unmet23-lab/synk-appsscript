#!/usr/bin/env node
/**
 * 홈페이지 시안 빌드 — 템플릿 + 마스코트 두 판 → 자립형 HTML 1개.
 *
 *   node docs/홈페이지_시안/빌드.js [출력경로]
 *
 * 출력은 외부 의존이 폰트 CDN 2곳뿐이라 파일 하나만 보내도 열린다
 * (그래서 친구·검수자 전달이 첨부 1개로 끝난다).
 *
 * 🔑 마스코트는 **손으로 갈아끼우지 않는다**(08-28). 이 폴더에 08-07 에 복사해 둔 퇴역 레진 webp
 *    세 장이 3주를 살았고, 그동안 시안 머리말에 「마스코트 교체 전 재작업 금지」 동결이 걸려 있었다.
 *    이제 `마스코트굽기.py` 가 정본(`tools/lib/마스코트자산.js` 가 주인)에서 굽고, 이 빌드가
 *    **정본이 더 새것이면 알아서 다시 굽는다.** 다음 교체 때 이 동결은 다시 안 선다.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const 여기 = __dirname;
const 루트 = path.resolve(여기, '..', '..');
const 템플릿 = path.join(여기, '시안.tpl.html');
const 굽는이 = path.join(여기, '마스코트굽기.py');
const 좌표길 = path.join(여기, '마스코트좌표.json');
const 그림 = {
  __DOT__: '마스코트_점눈.webp',
  __SMILE__: '마스코트_웃음.webp',
};
const 출력 = process.argv[2] || path.join(여기, '시안.html');

/** 정본 파일들의 «가장 새 시각». 정본을 다시 구우면 이 수가 올라간다. */
function 정본시각() {
  const 좌표 = fs.existsSync(좌표길) ? JSON.parse(fs.readFileSync(좌표길, 'utf8')) : null;
  if (!좌표 || !Array.isArray(좌표.판)) return Infinity;   // 장부가 없으면 «모른다» → 다시 굽는다
  let 최신 = 0;
  for (const p of 좌표.판) {
    const 원 = path.join(루트, p.원본);
    if (!fs.existsSync(원)) return Infinity;               // 정본이 옮겨 갔다 → 다시 물어본다
    최신 = Math.max(최신, fs.statSync(원).mtimeMs);
  }
  return 최신;
}

/** 굽기가 필요한가 — 산출이 없거나, 정본보다 낡았거나, 좌표 장부가 없을 때.
 *  🔴 판정은 «종료코드»가 아니라 «파일 시각»으로 한다. 이 저장소의 굽기 도구는 죽어도 exit 0 을
 *     내는 실측이 여러 번 있었다(오늘도 NumPy 2.0 에서 `.ptp()` 가 사라져 그렇게 죽었다). */
function 구워야하나() {
  const 산출 = Object.values(그림).map((f) => path.join(여기, f));
  if (산출.some((p) => !fs.existsSync(p)) || !fs.existsSync(좌표길)) return '산출이 없다';
  const 가장낡은 = Math.min(...산출.concat([좌표길]).map((p) => fs.statSync(p).mtimeMs));
  return 가장낡은 < 정본시각() ? '정본이 산출보다 새것이다' : null;
}

function 굽기(까닭) {
  console.log(`  마스코트 다시 굽기 — ${까닭}`);
  const 전 = fs.existsSync(좌표길) ? fs.statSync(좌표길).mtimeMs : 0;
  const r = spawnSync('python', [굽는이], {
    cwd: 루트, encoding: 'utf8', stdio: 'inherit',
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  });
  // 종료코드는 보조로만 본다 — 위 주석의 까닭.
  if (!fs.existsSync(좌표길) || fs.statSync(좌표길).mtimeMs <= 전) {
    throw new Error(`마스코트가 안 구워졌다(종료코드 ${r.status}) — 손으로 webp 를 채우지 마라. `
      + `python 과 Pillow 가 있는지 본다: python ${path.relative(루트, 굽는이)}`);
  }
}

const 까닭 = 구워야하나();
if (까닭) 굽기(까닭);

let html = fs.readFileSync(템플릿, 'utf8');
for (const [자리, 파일] of Object.entries(그림)) {
  const b64 = fs.readFileSync(path.join(여기, 파일)).toString('base64');
  html = html.replace(자리, 'data:image/webp;base64,' + b64);
}

// 눈 좌표 — 틀에 손으로 안 적는다(마스코트가 바뀌면 눈도 옮겨 가는데 손값은 안 따라온다).
const 좌표 = JSON.parse(fs.readFileSync(좌표길, 'utf8'));
for (const [자리, 값] of [['__EYE_LX__', 좌표.눈왼.x], ['__EYE_LY__', 좌표.눈왼.y],
  ['__EYE_RX__', 좌표.눈오.x], ['__EYE_RY__', 좌표.눈오.y]]) {
  if (!Number.isFinite(값)) throw new Error(`좌표 장부에 ${자리} 가 수가 아니다: ${값}`);
  html = html.split(자리).join(String(값));
}

// 자리표시자가 남아 있으면 그림이 안 박힌 판이 나간다 — 조용히 지나가지 않게 막는다
const 남은 = [...Object.keys(그림), '__EYE_LX__', '__EYE_LY__', '__EYE_RX__', '__EYE_RY__']
  .filter((자리) => html.includes(자리));
if (남은.length) throw new Error('자리표시자 미치환: ' + 남은.join(', '));

fs.writeFileSync(출력, html);
console.log(`${출력} · ${(html.length / 1024).toFixed(0)}KB`
  + ` · 마스코트 ${좌표.판.map((p) => p.표현).join('·')} · 눈 ${좌표.눈왼.x}%,${좌표.눈오.x}%`);
