#!/usr/bin/env node
/**
 * 요소부품굽기 — 요소를 «지면·앱에 꽂을 부품»으로 굽는다 (투명 배경 두 층: 몸 + 접지).
 *
 * 세트굽기와 무엇이 다른가:
 *   · `세트굽기`  = **판정용 그림**. 밤천 판 위에 놓고 검은 무대에서 찍는다 — 사람이 보고 고르는 것.
 *   · `요소부품굽기`(이것) = **쓸 물건**. 판을 걷고 알파로 뽑아, 어느 배경에도 얹힌다.
 *   같은 레시피(`요소굽기.py`)에서 나오므로 둘이 갈릴 일이 없다 — 다른 것은 «판과 알파»뿐이다.
 *
 * 🔑 **기존 Loom 통로에 합류한다.** 새 저장소를 만들지 않는다:
 *     여기(구움/*.png) → `tools/룸자산화.py`(알파 잘라 webp+base64) → `docs/Loom_자산/구운재질.json`
 *     → `tools/lib/loom.js` 의 「구움표」가 부품↔자산↔CSS 를 잇는다.
 *   그 표가 이미 «자산이 있고 CSS 가 나갔을 때만 구움으로 센다»는 분모를 지니고 있다.
 *
 * 🔑 왜 두 층인가(룸장면 §3-4 의 배움 그대로): 그림자가 몸에 구워져 있으면 **배경이 바뀔 때마다
 *   다시 구워야 한다.** 몸과 접지를 가르면 지면이 그림자를 따로 얹어 배경마다 다시 안 굽는다.
 *
 * 사용:  node tools/요소부품굽기.js [--부품 체크,별] [--샘플 160] [--너비 1100] [--다시]
 */
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const 루트 = path.resolve(__dirname, '..');
const { 블렌더 } = require('./세트굽기.js');
const 밖 = path.join(루트, 'docs', 'Loom_자산', '구움');

const 인자 = (() => {
  const a = {}; const v = process.argv.slice(2);
  for (let i = 0; i < v.length; i += 1) {
    if (!v[i].startsWith('--')) continue;
    a[v[i].slice(2)] = (v[i + 1] && !v[i + 1].startsWith('--')) ? v[i += 1] : '1';
  }
  return a;
})();

/* ── 부품표 — «무엇을 부품으로 뽑는가»의 정본 ────────────────────────────────────
 * 음식·숫자·자모는 여기 없다. 까닭이 서로 다르다:
 *   · 음식(귤·도넛·만두·김밥·붕어빵·넘버쿠키) = 접시째가 한 장면이라 «부품»이 아니라 «그림»이다.
 *   · 숫자·자모·요일 = 글자마다 한 장이라 CSS counter 로 못 고른다(지면은 활자가 낸다 · 타이포 불가침).
 *     교보재 카드·인쇄물에서는 그림 그대로 쓴다 — 그건 배선이 아니라 편집이다.
 * 이름은 「요소_」로 시작한다 — 룸굽기가 내는 자산(원판·레진구…)과 한 폴더에 살기 때문이다. */
const 부품표 = [
  { 이름: '체크', 형태: '기호', 옵션: { 기호: '체크' }, 쓰임: '완료·정답 체크 (지면·앱 · 수십 개)' },
  { 이름: '별', 형태: '기호', 옵션: { 기호: '별' }, 쓰임: '보상·별점' },
  { 이름: '하트', 형태: '기호', 옵션: { 기호: '하트' }, 쓰임: '좋아요·응원' },
  { 이름: '말풍선', 형태: '기호', 옵션: { 기호: '말풍선' }, 쓰임: '힌트·몽글의 말' },
  { 이름: '탭집', 형태: '기호', 옵션: { 기호: '집' }, 쓰임: '앱 탭 — 홈' },
  { 이름: '탭책', 형태: '기호', 옵션: { 기호: '책' }, 쓰임: '앱 탭 — 학습' },
  { 이름: '탭차트', 형태: '기호', 옵션: { 기호: '차트' }, 쓰임: '앱 탭 — 성장' },
  { 이름: '탭사람', 형태: '기호', 옵션: { 기호: '사람' }, 쓰임: '앱 탭 — 프로필' },
  { 이름: '도장', 형태: '도장', 옵션: { 본문: '참' }, 쓰임: '출석·칭찬 도장 (지면당 1점)' },
  { 이름: '게이지', 형태: '게이지고리', 옵션: { 진행: '0.68' }, 쓰임: '원형 진행 — 레벨 링' },
];

function main() {
  const BL = 블렌더();
  if (!BL) { console.error('🔴 blender.exe 를 못 찾았다 — BLENDER_EXE 로 경로를 준다.'); process.exit(1); }
  fs.mkdirSync(밖, { recursive: true });

  const 견본 = 인자['샘플'] || '160';   // 부품은 지면에서 줄여 쓰니 «슈퍼샘플링»이 값을 한다(룸자산화 주석)
  const 너비 = 인자['너비'] || '1100';
  const 다시 = !!인자['다시'];
  const 고른 = 인자['부품'] ? 인자['부품'].split(',').map((s) => s.trim()) : null;
  const 목록 = 고른 ? 부품표.filter((p) => 고른.includes(p.이름)) : 부품표;
  if (!목록.length) {
    console.error(`🔴 모르는 부품 — 아는 것은 ${부품표.map((p) => p.이름).join('·')}`);
    process.exit(1);
  }

  console.log(`■ 요소 부품 굽기 — ${목록.length}종 · 샘플 ${견본} · ${너비}px · 두 층(몸+접지)`);
  console.log(`  → ${path.relative(루트, 밖)}  (다음: python tools/룸자산화.py)`);
  const 시작 = Date.now();
  const 실패 = [];
  let 건너 = 0;

  목록.forEach((p, i) => {
    const 이름 = '요소_' + p.이름;
    const 몸길 = path.join(밖, 이름 + '_몸.png');
    const 접길 = path.join(밖, 이름 + '_접지.png');
    const 머리 = `  [${String(i + 1).padStart(2)}/${목록.length}] ${이름}`.padEnd(28);
    const 둘다 = (f) => fs.existsSync(f) && fs.statSync(f).size > 2048;
    if (!다시 && 둘다(몸길) && 둘다(접길)) { 건너 += 1; console.log(`${머리} ⏭  있음`); return; }
    const 옵션 = Object.entries(p.옵션).map(([k, v]) => `${k}=${v}`);
    const 하나 = Date.now();
    const r = spawnSync(BL, [
      '-b', '-P', path.join(루트, 'tools', '요소굽기.py'), '--',
      `형태=${p.형태}`, ...옵션, '투명=1', '비율=1',
      `샘플=${견본}`, `너비=${너비}`, '장치=GPU', `출력=${path.join(밖, 이름)}.png`,
    ], { cwd: 루트, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const 초 = Math.round((Date.now() - 하나) / 1000);
    // ⚠**두 장을 다 본다.** `_몸` 하나만 세면 접지가 빠진 부품이 «있다»로 세어진다(룸굽기 주석의 실사고).
    if (둘다(몸길) && 둘다(접길)) {
      console.log(`${머리} ✅ ${String(초).padStart(3)}초 · 몸 ${Math.round(fs.statSync(몸길).size / 1024)}KB` +
        ` + 접지 ${Math.round(fs.statSync(접길).size / 1024)}KB`);
    } else {
      실패.push(이름);
      console.log(`${머리} 🔴 ${초}초 · 몸 ${둘다(몸길) ? '✅' : '없음'} · 접지 ${둘다(접길) ? '✅' : '없음'}\n` +
        '       ' + String(r.stderr || r.stdout || '').trim().split('\n').slice(-2).join(' / ').slice(0, 260));
    }
  });

  const 초 = Math.round((Date.now() - 시작) / 1000);
  console.log(`■ 끝 — 구움 ${목록.length - 건너 - 실패.length} · 건너뜀 ${건너} · 실패 ${실패.length}` +
    ` / 전체 ${목록.length} · ${Math.floor(초 / 60)}분 ${초 % 60}초`);
  if (실패.length) console.log(`  실패한 것: ${실패.join(' · ')}`);
  else console.log('  ▶ 다음: python tools/룸자산화.py  → docs/Loom_자산/구운재질.json');
  process.exit(실패.length ? 1 : 0);
}

if (require.main === module) main();
module.exports = { 부품표 };
