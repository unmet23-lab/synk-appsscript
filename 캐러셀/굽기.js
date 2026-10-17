#!/usr/bin/env node
/**
 * 캐러셀 굽기 — 원고 md 한 벌을 SNS 키트 판(3:4 1080×1440 장별 PNG + 4:5 판 + 확인 시트)으로 굽는다.
 *
 * 2026-10-01 사용자 확정 「니가 바꿔준게 정말 훨씬 나아. 전에 쓰던 양식 이걸로 전부 다 교체해줄래?」
 * — 옛 검은 정사각형 카드(Loom 캐러셀 CSS + 크롬 한 방 찍기 + PIL 자르기)를 SNS 키트로 바꿨다.
 *   판·계정 색·부품·검사는 docs/디자인/SNS키트(README·kit.css)가 원문이고, 굽기와 검사는
 *   tools/SNS키트굽기.js가 한다. 옛 판은 git 기록에만 남는다.
 *
 * 쓰는 법:
 *   node 캐러셀/굽기.js 캐러셀/원고/001_이름.md [--pdf] [--webp]
 *   node 캐러셀/굽기.js --전부                  원고 폴더의 원고 전부
 *   → 캐러셀/_빌드/<편>.kit.html (키트 원고 HTML, 손으로 고치지 않는다)
 *   → 캐러셀/out/<편>/01_feed34_cover.png … (올릴 파일) · *_4x5.png(예약 도구·API용) · _시트.png · 검사.json
 *
 * 원고 형식(장 구분 = `---` 단독 줄)은 예전 그대로다. 머리에 더 쓸 수 있는 줄:
 *   계정: lab|brief|builds|synk|pulse|path   없으면 LAB으로 시작하는 원고는 lab, 나머지는 builds
 *   시리즈: 머리줄 왼쪽 이름                  없으면 계정 이름
 *   끝말: / 끝잔:                              끝 장 문구(없으면 언어별 기본 문구)
 *   제목·장 제목의 **굵게** 한 곳 = 형광펜(k-mark). 본문의 **굵게** = 굵은 글자.
 *
 * 검사(장식·유행 장치·형광펜·글자 크기·안전영역·넘침·서체·깨진 그림)에 걸리면 종료 코드 1이다.
 * 통과는 규칙을 지켰다는 뜻일 뿐이다. 굽고 나면 _시트.png를 눈으로 본다.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const 키트 = path.join(ROOT, 'docs', '디자인', 'SNS키트');
const 빌드폴더 = path.join(__dirname, '_빌드');
const args = process.argv.slice(2);
const 넘길 = ['--pdf', '--webp', '--force'].filter((f) => args.includes(f));

// 말 — 자동으로 붙는 문구. LAB 몽골 계정은 몽골어·학생·학부모, 개인 계정은 한국어·업계(영상_공개선 ㉠ 표).
const 말표 = {
  ko: { 넘김: '밀어서 보기 →', 배지: '내 판정', 끝말: 'AI로 교육 회사를 짓고 있습니다.', 끝잔: '저장해 두세요 — 다음 판정과 함께 돌아옵니다.' },
  mn: { 넘김: 'Гүйлгэж үзнэ үү →', 배지: 'Гол нь', 끝말: 'Улаанбаатарт солонгос хэлний сургалтын төв бэлтгэж байна.', 끝잔: 'Хадгалж аваарай — дараагийн бичлэгээр уулзъя.' },
  en: { 넘김: 'Swipe →', 배지: 'The point', 끝말: 'We are building a Korean-language school in Ulaanbaatar.', 끝잔: 'Save this — we will be back with the next one.' },
};
// LAB 한국어 짝 원고는 몽골어판의 검토용 번역이라 끝말도 몽골어판의 뜻을 옮긴다.
const LAB한국어끝말 = '울란바토르에 한국어 학원을 준비하고 있습니다.';
const LAB한국어끝잔 = '저장해 두세요 — 다음 글에서 만나요.';

// 계정 — 키트 README §4의 테마. 그림은 키트 assets/의 승인 원본 사본만 쓴다.
const 계정표 = {
  lab: { 이름: 'SYNK LAB', 로고: 'logo-lab.webp', 로고글: 'synk LAB', 핸들: { mn: '@synk.mn', ko: '@synk.mn', en: '@synkkorean' },
    표지: { 종류: 'object', src: 'mascot-몽글_눈웃음.webp', diecut: true, s: 380 }, 끝: { 종류: 'object', src: 'mascot-몽글_응원.webp', diecut: true, s: 340 } },
  brief: { 이름: 'synkbrief', 로고: 'logo-shift.webp', 로고글: 'synk SHIFT', 핸들: '@synkbrief',
    표지: { 종류: 'object', src: 'hero-shift.webp', s: 520 }, 끝: { 종류: 'object', src: 'felt-laptop.webp', s: 420 } },
  builds: { 이름: 'yuhobuilds', 로고: 'logo-synk-paper.webp', 로고글: 'synk', 검은면: true, 핸들: '@yuhobuilds',
    표지: { 종류: 'arch', src: 'photo-yuho-interview-front.webp' }, 끝: { 종류: 'object', src: 'felt-laptop.webp', s: 400 } },
  synk: { 이름: 'SYNK', 로고: 'logo-synk-paper.webp', 로고글: 'synk', 검은면: true, 핸들: '@synk.hq',
    표지: { 종류: 'object', src: 'felt-laptop.webp', s: 460 }, 끝: { 종류: 'object', src: 'felt-laptop.webp', s: 400 } },
  pulse: { 이름: 'SYNK PULSE', 로고: 'logo-pulse.webp', 로고글: 'synk PULSE', 핸들: '',
    표지: { 종류: 'object', src: 'hero-pulse.webp', s: 520 }, 끝: { 종류: 'object', src: 'hero-pulse.webp', s: 420 } },
  path: { 이름: 'SYNK PATH', 로고: 'logo-path.webp', 로고글: 'synk PATH', 핸들: '',
    표지: { 종류: 'object', src: 'hero-path.webp', s: 520 }, 끝: { 종류: 'object', src: 'hero-path.webp', s: 420 } },
};

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** 제목: **굵게** 첫 한 곳만 형광펜, 나머지 별표는 지운다(형광펜은 제목 하나에 한 곳). */
const 제목HTML = (s) => { let 한번 = false; return esc(s).replace(/\*\*([^*]+)\*\*/g, (_, t) => { if (한번) return t; 한번 = true; return `<span class="k-mark">${t}</span>`; }); };
const 본문HTML = (s) => esc(s).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
  .split(/\n\s*\n/).map((p) => `<p class="k-body">${p.trim().replace(/\n/g, '<br>')}</p>`).join('\n      ');
const 글자수 = (s) => s.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim().length;
const 한글인가 = (언어) => 언어 === 'ko';

/** 제목 크기 — 판 폭 912px에 줄 수가 넷을 넘지 않게. 넘침은 굽기 검사가 다시 잰다. */
function 표지크기(제목, 언어) {
  const n = 글자수(제목);
  if (한글인가(언어)) return n <= 10 ? 'xl' : n <= 24 ? 'l' : 'm';
  return n <= 36 ? 'l' : n <= 60 ? 'm' : 's';
}
function 장제목크기(제목, 언어) {
  const n = 글자수(제목);
  if (한글인가(언어)) return n <= 13 ? 'l' : n <= 24 ? 'm' : 's';
  return n <= 14 ? 'l' : n <= 30 ? 'm' : 's';
}
/** 본문 글자 크기 — 짧을수록 키워 흰 종이가 허전하지 않게(두 단계 규칙 안: 제목·본문). */
function 본문글자(본문, 언어) {
  const n = 글자수(본문) * (한글인가(언어) ? 1 : 0.6);
  return n < 90 ? 54 : n < 160 ? 50 : n < 240 ? 44 : 40;
}

function 원고읽기(원고경로) {
  const md = fs.readFileSync(원고경로, 'utf8').replace(/\r\n/g, '\n');
  const 편이름 = path.basename(원고경로, '.md');
  const 덩어리들 = md.split(/\n---\n/).map((s) => s.trim()).filter(Boolean);
  const 머리 = 덩어리들.shift() || '';
  const 머리값 = (k) => ((머리.match(new RegExp(`^${k}:\\s*(.+)$`, 'm')) || [])[1] || '').trim();
  const 언어 = (머리값('언어').match(/^(ko|mn|en)/) || [, 'ko'])[1];
  const 계정 = 머리값('계정') || (편이름.startsWith('LAB') ? 'lab' : 'builds');
  if (!계정표[계정]) throw new Error(`${편이름}: 모르는 계정 '${계정}' (lab|brief|builds|synk|pulse|path)`);
  const 장들 = 덩어리들.map((덩) => {
    const 줄들 = 덩.split('\n').filter((l) => !/^<!--.*-->$/.test(l.trim()));
    const 첫줄 = (줄들[0] || '').trim();
    return { 판정: 첫줄.startsWith('🔑'), 장제목: 첫줄.replace(/^##\s*/, '').replace(/^🔑\s*/, '').trim(), 본문: 줄들.slice(1).join('\n').trim() };
  });
  return {
    편이름, 언어, 계정, 장들,
    제목: ((머리.match(/^#\s+(.+)$/m) || [])[1] || 편이름).trim(),
    훅: 머리값('훅'), 시리즈: 머리값('시리즈'), 끝말: 머리값('끝말'), 끝잔: 머리값('끝잔'),
    마무리끄기: /^마무리:\s*끄기/m.test(머리),
  };
}

function 키트HTML(원) {
  const 말 = 말표[원.언어];
  const 계 = 계정표[원.계정];
  const 그림 = (f) => `../../docs/디자인/SNS키트/assets/${f}`;
  const 핸들 = typeof 계.핸들 === 'string' ? 계.핸들 : (계.핸들[원.언어] || '');
  const 시리즈 = esc(원.시리즈 || 계.이름);
  const 라틴 = 원.언어 === 'ko' ? '' : ' k-latin';
  const 총 = 원.장들.length + 1 + (원.마무리끄기 ? 0 : 1);
  const 쪽 = (i) => `<span class="k-count">${String(i).padStart(2, '0')} / ${String(총).padStart(2, '0')}</span>`;
  const 색면로고 = 계.검은면
    ? `<img class="k-logo" src="${그림(계.로고)}" alt="${계.로고글}">`
    : `<span class="k-logo-tag"><img class="k-logo" src="${그림(계.로고)}" alt="${계.로고글}"></span>`;
  const 큰그림 = (g, 자리) => {
    if (g.종류 === 'arch') return `<figure class="k-arch" data-trend="mask" style="position:absolute;right:96px;bottom:200px;width:400px;height:520px;--pos:50% 18%"><img src="${그림(g.src)}" alt=""></figure>`;
    return `<img class="k-object${g.diecut ? ' diecut' : ''}" src="${그림(g.src)}" alt="" style="--s:${g.s}px;right:${자리 === '끝' ? 100 : 84}px;bottom:${자리 === '끝' ? 200 : 190}px">`;
  };
  const 장 = [];

  // 1 표지 — 사업 색 면 + 큰 제목 + 주인공 하나 + 실땀 네 모서리
  장.push(`<section class="k-slide k-field k-corners" data-fmt="feed34" data-acc="${원.계정}" data-name="cover">
  <div class="k-head"><b>${시리즈}</b>${쪽(1)}</div>
  <div class="k-in">
    <h1 class="k-title ${표지크기(원.제목, 원.언어)}${라틴}">${제목HTML(원.제목)}</h1>
    ${원.훅 ? `<p class="k-sub${라틴}" style="margin-top:36px;max-width:${계.표지.종류 === 'arch' ? 520 : 820}px">${esc(원.훅)}</p>` : ''}
  </div>
  ${큰그림(계.표지, '표지')}
  <div class="k-foot">${색면로고}<span>${esc(말.넘김)}</span></div>
</section>`);

  // 본문·판정 장 — 흰 종이, 장식 없음. 유호 09-08 「모든 장에 들어가니까 좀 별론데」: 장식은 표지에, 마스코트는 처음과 끝에만.
  // 빈 자리는 장식 대신 여백과 글자 크기로 가른다(본문 묶음을 눈높이 가운데에).
  원.장들.forEach((s0, k) => {
    const i = k + 2;
    const s = { ...s0 };
    // 판정 장: 본문 첫 문단이 통째로 굵으면 그 문장이 큰 제목이 되고, 장 제목은 칩으로 내려간다(「제 판정」 + 「내 판정」 겹침 방지)
    let 칩 = 말.배지;
    if (s.판정) {
      const 첫 = s.본문.split(/\n\s*\n/)[0].trim();
      if (/^\*\*[^*]+\*\*$/.test(첫)) { 칩 = s.장제목 || 말.배지; s.장제목 = 첫.slice(2, -2); s.본문 = s.본문.slice(s.본문.indexOf(첫) + 첫.length).trim(); }
    }
    const 본문크기 = 본문글자(s.본문, 원.언어);
    const 제목크기 = 장제목크기(s.장제목, 원.언어);
    const 본문 = s.본문 ? 본문HTML(s.본문).replace(/class="k-body"/g, `class="k-body${라틴}" style="font-size:${본문크기}px;margin:0 0 ${Math.round(본문크기 * 0.6)}px"`) : '';
    const 발 = `<div class="k-foot">${핸들 ? `<span class="k-handle" style="font-size:26px">${핸들}</span>` : '<span></span>'}<span>${시리즈}</span></div>`;
    if (s.판정) {
      // 판정 장은 장식 없이 가운데에 모은다
      장.push(`<section class="k-slide k-paper" data-fmt="feed34" data-acc="${원.계정}" data-name="judgment">
  <div class="k-head"><b>${시리즈}</b>${쪽(i)}</div>
  <div class="k-in" style="justify-content:center;padding-bottom:60px">
    <span class="k-chip acc" style="align-self:flex-start">${esc(칩.replace(/\*\*/g, ''))}</span>
    <h2 class="k-title ${제목크기}${라틴}" style="margin-top:36px">${제목HTML(s.장제목)}</h2>${본문 ? `
    <div class="k-corners" style="position:relative;margin-top:52px;padding:52px 56px ${Math.round(52 - 본문크기 * 0.6)}px;border-radius:20px;background:var(--acc-wash)">
      ${본문}
    </div>` : ''}
  </div>
  ${발}
</section>`);
    } else {
      장.push(`<section class="k-slide k-paper" data-fmt="feed34" data-acc="${원.계정}" data-name="p${String(i).padStart(2, '0')}">
  <div class="k-head"><b>${시리즈}</b>${쪽(i)}</div>
  <div class="k-in" style="justify-content:center;padding-bottom:60px">
    <h2 class="k-title ${제목크기}${라틴}">${제목HTML(s.장제목)}</h2>
    <div style="margin-top:56px">
      ${본문}
    </div>
  </div>
  ${발}
</section>`);
    }
  });

  // 끝 장 — 다시 사업 색 면. 행동은 하나(저장)
  if (!원.마무리끄기) {
    const 끝말 = 원.끝말 || (원.계정 === 'lab' && 원.언어 === 'ko' ? LAB한국어끝말 : 말.끝말);
    장.push(`<section class="k-slide k-field k-corners" data-fmt="feed34" data-acc="${원.계정}" data-name="end">
  <div class="k-head"><b>${시리즈}</b>${쪽(총)}</div>
  <div class="k-in" style="justify-content:center;padding-bottom:300px">
    <h2 class="k-title s${라틴}" style="max-width:860px">${esc(끝말)}</h2>
    <p class="k-sub${라틴}" style="margin-top:32px;max-width:620px">${esc(원.끝잔 || (원.계정 === 'lab' && 원.언어 === 'ko' ? LAB한국어끝잔 : 말.끝잔))}</p>
  </div>
  ${큰그림(계.끝, '끝')}
  <div class="k-foot">${색면로고}<span class="k-handle">${핸들}</span></div>
</section>`);
  }

  return `<!doctype html>
<html lang="${원.언어}">
<head>
<meta charset="utf-8">
<title>${esc(원.제목.replace(/\*\*/g, ''))} · ${계.이름}</title>
<!-- 캐러셀/굽기.js가 ${path.basename(원.편이름)}.md에서 만든 키트 원고. 손으로 고치지 말고 원고 md를 고친다 -->
<link rel="stylesheet" href="../../docs/디자인/SNS키트/kit.css">
<style>body{margin:0;background:#d9dbe0;display:flex;flex-direction:column;gap:40px;padding:40px;align-items:flex-start}</style>
</head>
<body data-acc="${원.계정}">
${장.join('\n\n')}
</body>
</html>
`;
}

function 굽기(원고경로) {
  if (/^상태:\s*보관\s*$/m.test(fs.readFileSync(원고경로, 'utf8')) && !args.includes('--기록재현')) {
    console.error(`${path.basename(원고경로)}: 과거 보관 원고입니다. 새 게시에 사용하지 않습니다. 당시 출력을 확인할 때만 --기록재현을 지정하세요.`);
    return false;
  }
  const 원 = 원고읽기(원고경로);
  fs.mkdirSync(빌드폴더, { recursive: true });
  const html = path.join(빌드폴더, `${원.편이름}.kit.html`);
  fs.writeFileSync(html, 키트HTML(원));
  const 출력 = path.join(__dirname, 'out', 원.편이름);
  // 옛 판(01.png …)과 지난 굽기 결과를 비운다. 원고 md가 원본이라 언제든 다시 굽는다.
  if (fs.existsSync(출력)) for (const f of fs.readdirSync(출력)) if (/\.(png|webp|pdf|json)$/i.test(f)) fs.rmSync(path.join(출력, f));
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'SNS키트굽기.js'), html, '--out', 출력, '--45', '--sheet', ...넘길], { encoding: 'utf8' });
  process.stdout.write(r.stdout || '');
  process.stderr.write(r.stderr || '');
  console.log(r.status === 0 ? `✅ ${원.편이름} (${원.계정}·${원.언어}) → ${path.relative(ROOT, 출력)}` : `✗ ${원.편이름}: 검사에 걸렸다(위 ✗ 줄)`);
  return r.status === 0;
}

const 원고들 = args.includes('--전부')
  ? fs.readdirSync(path.join(__dirname, '원고')).filter((f) => f.endsWith('.md')).sort().map((f) => path.join(__dirname, '원고', f))
    .filter((f) => args.includes('--기록재현') || !/^상태:\s*보관\s*$/m.test(fs.readFileSync(f, 'utf8')))
  : args.filter((a) => !a.startsWith('--')).map((a) => path.resolve(ROOT, a));
if (!원고들.length) { console.error(args.includes('--전부') ? '새로 굽는 대상이 없습니다. 보관 원고는 일괄 제작에서 제외합니다.' : '쓰는 법: node 캐러셀/굽기.js 캐러셀/원고/001_이름.md [--pdf] [--webp]  |  --전부'); process.exit(2); }
if (!fs.existsSync(path.join(키트, 'kit.css'))) { console.error('SNS 키트를 못 찾았다: ' + 키트); process.exit(2); }
let 실패 = 0;
for (const f of 원고들) if (!굽기(f)) 실패++;
if (원고들.length > 1) console.log(`\n${원고들.length}편 중 ${원고들.length - 실패}편 통과`);
process.exit(실패 ? 1 : 0);
