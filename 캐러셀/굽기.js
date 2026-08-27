#!/usr/bin/env node
/**
 * 캐러셀 굽기 — 원고 md 한 벌을 SNS 캐러셀 PNG(1080×1080, 장별)로 굽는다.
 *
 * 쓰는 법:
 *   node 캐러셀/굽기.js 캐러셀/원고/001_이름.md
 *   → 캐러셀/out/001_이름/01.png … NN.png
 *
 * 왜 이 통로인가 (유호님 확정 2026-08-27 두 벌):
 *   ① 「만들어질 컨텐츠는 모두 Loom 엔진을 사용 — 색·글씨체 전부 우리 것」
 *      ⇒ CSS 는 손으로 안 쓴다. `node tools/lib/loom.js --css 캐러셀` 이 색·율·부품을 주고,
 *        이 파일의 보충 CSS 는 Loom 이 침묵하는 «카드 프레임»만 정의한다(변수만 소비).
 *   ② 개인 계정 축 셋 중 «코너 B: AI 뉴스 + 내 회사 판정» 의 생산 통로.
 *      원고의 규율은 공개선 12칸(docs/SHIFT/영상_공개선.md §2 · 유호 확정 08-27)이 진다 —
 *      특히 ✗⑩ 돈(매출·수익·수강료) · ✗⑥⑨ 학생 데이터·얼굴 · ✗⑫ 날짜 약속(시제 = 「짓고 있습니다」).
 *
 * 원고 형식 (md · 장 구분 = `---` 단독 줄):
 *   # 편 제목            ← 표지 큰 글씨
 *   훅: 한 줄            ← 표지 아래 문장 (선택)
 *   마무리: 끄기          ← 자동 마무리 장 생략 (선택)
 *   ---
 *   ## 장 제목
 *   본문 줄들 (빈 줄 = 문단 구분 · **굵게** 지원)
 *   ---
 *   🔑 판정 제목          ← 🔑 로 시작하면 «내 판정» 장 (코랄 신호)
 *   본문
 *
 * 함정 셋 (겪고 적음):
 *   · 헤드리스 크롬 --screenshot 은 «뷰포트만» 찍는다 — 창을 1080×(1080×N) 으로 열고 한 방에
 *     찍은 뒤 파이썬(PIL)이 N 등분한다. 굽고 나서 픽셀 크기를 «기계로» 검증한다(어긋나면 즉사 —
 *     08-27 실측: --window-size=390 이 뷰포트 511px 로 잡힌 적이 있다. 1080 은 정상이지만 안 믿는다).
 *   · 폰트는 이름만 부르면 폴백이 «조용히» 그린다 — `docs/tools/브랜드폰트_임베드.py` 가
 *     서브셋을 임베드하고, 없는 글자는 빌드가 잡는다(스타일 첫 줄의 @FONTS@ 마커).
 *   · PNG 는 브랜드렌더린트가 원리상 못 잰다(크롬 computed style 만 읽는다) — 영상과 같은
 *     «사람 눈» 지면이다. 굽고 나면 눈으로 본다.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const W = 1080, H = 1080; // 발행 규격 — 카드 한 장 1080px 정사각 (브랜드렌더린트 §제외목록 실측과 같은 값)

// ── 입력 ──────────────────────────────────────────────────────────────
const 원고경로 = process.argv[2];
if (!원고경로) { console.error('쓰는 법: node 캐러셀/굽기.js 캐러셀/원고/001_이름.md'); process.exit(1); }
const 원고절대 = path.resolve(ROOT, 원고경로);
const md = fs.readFileSync(원고절대, 'utf8').replace(/\r\n/g, '\n');
const 편이름 = path.basename(원고절대, '.md');

// ── 원고 파싱 ─────────────────────────────────────────────────────────
const 덩어리들 = md.split(/\n---\n/).map(s => s.trim()).filter(Boolean);
const 머리 = 덩어리들.shift() || '';
const 제목 = (머리.match(/^#\s+(.+)$/m) || [, 편이름])[1].trim();
const 훅 = (머리.match(/^훅:\s*(.+)$/m) || [, ''])[1].trim();
const 마무리끄기 = /^마무리:\s*끄기/m.test(머리);

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const 본문HTML = s => esc(s).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
  .split(/\n\s*\n/).map(p => '<p>' + p.replace(/\n/g, '<br>') + '</p>').join('\n');

const 장들 = 덩어리들.map(덩 => {
  const 줄들 = 덩.split('\n');
  const 첫줄 = 줄들[0].trim();
  const 판정 = 첫줄.startsWith('🔑');
  const 장제목 = 첫줄.replace(/^##\s*/, '').replace(/^🔑\s*/, '').trim();
  return { 판정, 장제목, 본문: 줄들.slice(1).join('\n').trim() };
});

// ── 킷 재료 — 전부 통로에서 온다 (손 색·손 CSS 없음) ────────────────────
const loom = spawnSync('node', [path.join(ROOT, 'tools/lib/loom.js'), '--css', '캐러셀'], { encoding: 'utf8' });
if (loom.status !== 0 || !loom.stdout.includes('loom부품')) { console.error('🔴 Loom 캐러셀 CSS 통로 실패'); process.exit(1); }
const 로고결과 = spawnSync('node', [path.join(ROOT, 'tools/lib/로고정본.js'), '--json'], { encoding: 'utf8' });
const 로고 = JSON.parse(로고결과.stdout)['단색다크'];
if (!로고 || !로고.startsWith('<svg')) { console.error('🔴 로고정본 통로 실패'); process.exit(1); }

// ── 카드 마크업 ───────────────────────────────────────────────────────
const 총장수 = 장들.length + 1 + (마무리끄기 ? 0 : 1);
const 진행점 = i => '<div class="진행">' +
  Array.from({ length: 총장수 }, (_, k) => `<span class="점${k === i ? ' 여기' : ''}"></span>`).join('') + '</div>';

let 카드들 = [];
// 표지
카드들.push(`<section class="카드 표지">
  <div class="카드로고">${로고}</div>
  <h1>${esc(제목)}</h1>
  ${훅 ? `<p class="훅">${esc(훅)}</p>` : ''}
  <div class="넘김">밀어서 보기 →</div>
</section>`);
// 본문·판정 장
장들.forEach((장, i) => {
  카드들.push(`<section class="카드${장.판정 ? ' 판정' : ''}">
  <div class="카드머리"><span class="잔글">${esc(제목)}</span>${장.판정 ? '<span class="판정배지">내 판정</span>' : ''}</div>
  <h2>${esc(장.장제목)}</h2>
  <div class="본문">${본문HTML(장.본문)}</div>
  ${진행점(i + 1)}
  <div class="물표">${로고}</div>
</section>`);
});
// 마무리
if (!마무리끄기) 카드들.push(`<section class="카드 마무리">
  <div class="카드로고 큰">${로고}</div>
  <p class="끝말">AI로 교육 회사를 짓고 있습니다.</p>
  <p class="끝잔">저장해 두세요 — 다음 판정과 함께 돌아옵니다.</p>
</section>`);

// ── 보충 CSS — Loom 이 침묵하는 «카드 프레임»만. 값은 Loom 변수 소비 ──────
const 보충 = `
/* 캐러셀 카드 프레임 — 굽기.js 조립 산출물(손 편집 금지) */
html,body{background:var(--graphite);}
body{display:block;min-height:0;}
.카드{width:${W}px;height:${H}px;overflow:hidden;position:relative;
  display:flex;flex-direction:column;justify-content:center;gap:var(--단);
  padding:96px;
  background:
    radial-gradient(105% 62% at 50% -14%, rgba(55,55,55,0.55) 0%, rgba(55,55,55,0) 58%),
    linear-gradient(180deg, rgba(0,0,0,.30), rgba(0,0,0,.52)),
    var(--graphite);}
.카드로고 svg{width:190px;height:auto;display:block;}
.카드로고.큰 svg{width:300px;}
.카드 h1{margin:0;font-size:84px;line-height:1.16;font-weight:800;letter-spacing:-.035em;
  color:var(--chalk);text-wrap:balance;}
.카드 h2{margin:0;font-size:58px;line-height:1.24;font-weight:800;letter-spacing:-.03em;
  color:var(--chalk);text-wrap:balance;}
.훅{margin:0;font-size:40px;line-height:1.5;color:var(--chalk);opacity:.82;max-width:22em;}
.본문{font-size:42px;line-height:1.62;color:var(--chalk);}
.본문 p{margin:0 0 .7em;color:var(--chalk);}
.본문 b{color:var(--coral2);}
.카드머리{display:flex;align-items:center;gap:var(--칸);}
.잔글{font-size:27px;font-weight:700;color:var(--ash);letter-spacing:.01em;}
.판정배지{font-size:27px;font-weight:800;color:var(--coral2);
  padding:.28em .95em;border-radius:999px;background:rgba(249,104,89,.15);
  box-shadow:inset 0 0 0 2px rgba(249,104,89,.55);}
.카드.판정{box-shadow:inset 0 0 0 3px rgba(249,104,89,.4);}
.넘김{position:absolute;right:96px;bottom:88px;font-size:30px;font-weight:750;color:var(--coral2);}
.진행{position:absolute;left:96px;bottom:96px;display:flex;gap:14px;}
.점{width:14px;height:14px;border-radius:50%;background:rgba(228,228,231,.28);}
.점.여기{background:var(--coral);}
.물표{position:absolute;right:96px;bottom:76px;opacity:.5;}
.물표 svg{width:96px;height:auto;}
.카드.마무리{align-items:center;text-align:center;justify-content:center;}
.끝말{margin:0;font-size:52px;font-weight:800;color:var(--chalk);letter-spacing:-.02em;}
.끝잔{margin:0;font-size:33px;color:var(--ash);}
`;

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(제목)}</title>
<style>
/*@FONTS@*/
${loom.stdout}
${보충}
</style></head><body>
${카드들.join('\n')}
</body></html>`;

// ── 조립 → 폰트 임베드 → 렌더 → 분할 ─────────────────────────────────
const 빌드폴더 = path.join(__dirname, '_빌드');
const 출력폴더 = path.join(__dirname, 'out', 편이름);
fs.mkdirSync(빌드폴더, { recursive: true });
fs.mkdirSync(출력폴더, { recursive: true });
const src = path.join(빌드폴더, 편이름 + '.src.html');
const 임베드본 = path.join(빌드폴더, 편이름 + '.html');
fs.writeFileSync(src, html);

const py = spawnSync('python', [path.join(ROOT, 'docs/tools/브랜드폰트_임베드.py'), src, 임베드본], { encoding: 'utf8' });
if (py.status !== 0) { console.error('🔴 폰트 임베드 실패:\n' + (py.stderr || py.stdout)); process.exit(1); }

const N = 카드들.length;
const 크롬후보 = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].filter(fs.existsSync);
if (!크롬후보.length) { console.error('🔴 크롬을 못 찾았다'); process.exit(1); }
const 판사진 = path.join(빌드폴더, 편이름 + '.전체.png');
const cr = spawnSync(크롬후보[0], ['--headless', '--disable-gpu', '--force-device-scale-factor=1',
  '--hide-scrollbars', `--window-size=${W},${H * N}`, `--screenshot=${판사진}`,
  'file:///' + 임베드본.replace(/\\/g, '/')], { encoding: 'utf8' });
if (!fs.existsSync(판사진)) { console.error('🔴 크롬 렌더 실패:\n' + (cr.stderr || '')); process.exit(1); }

// 분할 + 픽셀 검증 — 「조용한 성공」 금지: 크기가 어긋나면 여기서 죽는다
const 분할py = `# -*- coding: utf-8 -*-
import sys
from PIL import Image
img = Image.open(r'''${판사진}''')
w, h = img.size
assert (w, h) == (${W}, ${H * N}), f'렌더 크기 어긋남: {w}x{h} != ${W}x${H * N} (뷰포트 함정 — force-device-scale-factor 확인)'
for i in range(${N}):
    img.crop((0, i * ${H}, w, (i + 1) * ${H})).save(r'''${출력폴더}''' + '/%02d.png' % (i + 1))
print('OK', ${N})
`;
const 분할스크립트 = path.join(빌드폴더, 편이름 + '.분할.py');
fs.writeFileSync(분할스크립트, 분할py);
const cut = spawnSync('python', [분할스크립트], { encoding: 'utf8' });
if (cut.status !== 0) { console.error('🔴 분할·검증 실패:\n' + (cut.stderr || cut.stdout)); process.exit(1); }

console.log(`✅ ${편이름} — ${N}장 구움 → ${path.relative(ROOT, 출력폴더)}/01~${String(N).padStart(2, '0')}.png`);
console.log('   (판정은 사람 눈이 한다 — PNG 는 렌더린트가 원리상 못 잰다)');
