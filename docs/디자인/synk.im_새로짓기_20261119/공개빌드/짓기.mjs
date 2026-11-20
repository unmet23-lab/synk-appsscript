#!/usr/bin/env node
// synk.im 새 홈 공개 꼴 빌드(v11, 2026-11-20). 설계는 같은 폴더 설계.md.
// 승인된 시안 넷(시안/index.html · detail.html · en/index.html · en/detail.html)과 공개본 사본(도구 전용 bare 사본의 origin/main)을 읽어
// 공개 경로 그대로 쓴다. 시안의 화면 · 글 · 그림은 바꾸지 않고, 공개에 필요한 것만 고친다(글꼴 파일, 그림 자리, 상세 쪽 나누기, 머리, 홈의 고리).
//
//   node 짓기.mjs [--out <폴더>] [--live <bare 사본>] [--ref origin/main] [--og]
//     --out   기본 <저장소>/.tmp/synk-home-v11/out (공개 경로 그대로: index.html, en/index.html, korean/index.html, assets/v11/…)
//     --og    공유 그림(og/*.jpg)이 아직 없어도 멈추지 않는다(그림은 `node 살펴보기.mjs og`로 찍는다). 평소에는 이 폴더 og/의 그림을 그대로 쓴다 — 찍은 그림은 바이트가 매번 달라서다.
// 입력이 같으면 출력 바이트가 같다. 끝에 단언을 돌려 하나라도 어긋나면 멈춘다.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 시안 = path.join(여기, '..', '시안');
const 저장소 = path.resolve(여기, '..', '..', '..', '..');
const 인자 = process.argv.slice(2);
const 옵션 = (k, d) => { const i = 인자.indexOf(k); return i >= 0 ? 인자[i + 1] : d; };
const 출력 = path.resolve(옵션('--out', path.join(저장소, '.tmp', 'synk-home-v11', 'out')));
const 사본 = 옵션('--live', path.join(os.homedir(), 'Documents', 'synk-vendor', 'synk-policy-publish.git'));
const 기준 = 옵션('--ref', 'origin/main');
const 새로찍기 = 인자.includes('--og');
const 그림 = '/assets/v11/';

const 멈춤 = m => { console.error('[멈춤] ' + m); process.exit(1); };
const 단언 = (ok, m) => { if (!ok) 멈춤(m); };
const sha12 = b => crypto.createHash('sha256').update(b).digest('hex').slice(0, 12);
/** 글에서 a를 b로 정확히 n번(기본 1번) 바꾼다 */
function 바꿈(글, a, b, n = 1, 이름 = '') {
  const 수 = 글.split(a).length - 1;
  단언(n === '*' ? 수 >= 1 : 수 === n, `${이름 || '바꿈'}: 「${String(a).slice(0, 70)}」이 ${수}번(기대 ${n})`);
  return 글.split(a).join(b);
}
function 정규바꿈(글, re, f, n, 이름) {
  let 수 = 0; const 결과 = 글.replace(re, (...m) => { 수++; return typeof f === 'function' ? f(...m) : f; });
  단언(n === undefined || (n === '*' ? 수 >= 1 : 수 === n), `${이름}: ${수}번(기대 ${n})`);
  return 결과;
}

// ── 공개본 사본 ───────────────────────────────────────────────────────
const git = (a, opts = {}) => execFileSync('git', ['--git-dir', 사본, ...a], { env: { ...process.env, GIT_NO_LAZY_FETCH: '1' }, maxBuffer: 1 << 29, ...opts });
const 머리 = git(['rev-parse', 기준]).toString().trim();
function 공개본(p) {
  const 줄 = git(['ls-tree', 머리, '--', p]).toString().trim();
  if (!줄) return null;
  const oid = 줄.split(/\s+/)[2];
  try { return git(['cat-file', 'blob', oid], { stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch { execFileSync('git', ['--git-dir', 사본, 'fetch', '-q', '--no-tags', '--filter=blob:none', 'origin', oid]); return git(['cat-file', 'blob', oid]); }
}
const 공개글 = p => { const b = 공개본(p); 단언(b, `공개본에 ${p}가 없다`); return b.toString('utf8'); };
const 공개에있나 = p => !!git(['ls-tree', 머리, '--', p]).toString().trim();

// ── 쪽 표 ────────────────────────────────────────────────────────────
// 시안 article id → 공개 주소(앞뒤 / 없이). 아틀라스는 공개본 /atlas/를 그대로 두고 링크만 그쪽으로 보낸다(설계.md 「주소」).
const 상세 = { korean: 'korean', classroom: 'classroom', study: 'study-abroad', job: 'job', community: 'community', ai: 'ai', ad: 'studio' }; // 광고는 /ad/가 아니라 /studio/ — 광고 차단기가 /ad/를 가릴 수 있다(설계 검토 D16)
const 쪽주소 = (lang, id) => (lang === 'en' ? '/en' : '') + (id === 'home' ? '/' : id === 'atlas' ? '/atlas/' : '/' + 상세[id] + '/');
const 사이트 = 'https://synk.im';
const 홈머리 = {
  ko: { title: 'SYNK — 한 사람에게 맞추는 AI를 만듭니다', desc: 'SYNK가 하는 일은 셋입니다. 한국어와 유학, AI 강의, 광고. 셋 모두 한 사람에게 맞추는 AI에서 나왔습니다.', alt: '낮 하늘 아래 한옥 처마와 큰 글자 「싱ㅋ」, 그 아래 「사람마다 막히는 곳이 다릅니다 · 그 한 곳부터 풀어 주는 AI를 만듭니다」 — SYNK 홈페이지 첫 화면' },
  en: { title: 'SYNK — We build AI that fits one person', desc: 'SYNK does three things: Korean and study in Korea, AI lectures, and ads. All three grew out of AI that fits one person.', alt: 'Hanok eaves under a daytime sky and the large letters “싱ㅋ”, with “Everyone gets stuck somewhere different · We build AI that starts there” — the first screen of the SYNK homepage' },
};

// ── 공개본에서 이어받는 값 ─────────────────────────────────────────────
const 공개홈 = { ko: 공개글('index.html'), en: 공개글('en/index.html') };
function 토큰(글, 앞) { const m = 글.match(new RegExp(앞.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '\\?v=([a-f0-9]+)')); 단언(m, `공개본 홈에서 ${앞}?v= 를 못 찾음`); return 앞 + '?v=' + m[1]; }
const 이어받기 = {};
for (const lang of ['ko', 'en']) {
  const s = 공개홈[lang], 앞 = lang === 'en' ? '/en' : '';
  const 다운 = [...s.matchAll(/https:\/\/github\.com\/unmet23-lab\/synk-policy\/releases\/download\/platform-preview-[^"\s<>]+?\.(?:exe|dmg)/g)].map(m => m[0]);
  const 판 = s.match(/id="platform" data-platform-version="(\d+\.\d+\.\d+)"/)?.[1];
  단언(판, `${lang} 공개본 홈의 data-platform-version`);
  const 받기 = { win: 다운.find(u => u.endsWith('-win-x64.exe')), arm: 다운.find(u => u.endsWith('-mac-arm64.dmg')), x64: 다운.find(u => u.endsWith('-mac-x64.dmg')) };
  단언(받기.win && 받기.arm && 받기.x64 && Object.values(받기).every(u => u.includes('-' + 판 + '-')), `${lang} 공개본 홈의 설치 파일 주소 셋`);
  const 릴리스 = s.match(/https:\/\/github\.com\/unmet23-lab\/synk-policy\/releases\/tag\/platform-preview-[\d.]+/)?.[0];
  const 기준일 = s.match(/<div class="foot-bottom">(?:(?!<\/div>)[\s\S])*?<time class="mono" datetime="(\d{4}-\d{2}-\d{2})">/)?.[1];
  단언(릴리스 && 기준일, `${lang} 릴리스 쪽 · 바닥 기준일`);
  이어받기[lang] = {
    판, 받기, 릴리스, 기준일,
    엔진: 토큰(s, 앞 + '/knowledge-engine.js'), 자료: 토큰(s, 앞 + '/knowledge.json'), site: 토큰(s, '/assets/v10/site.js'),
    방문: 토큰(s, '/assets/v10/visit-count.js'), 가입: 토큰(s, '/social-conversion.js'), client: 토큰(s, '/desktop/releases/client.js'),
    확인: s.match(/<meta name="google-site-verification" content="[^"]+">/)?.[0],
    소식: 소식읽기(s, lang),
  };
}
/** 공개본 홈 #now의 소식 두 묶음(펼친 것 · 지난 소식)을 [{href, hreflang, d, label, who, title}]로 */
function 소식읽기(s, lang) {
  const i = s.indexOf('id="now"'), j = s.indexOf('</section>', i);
  단언(i > 0 && j > i, `${lang} 공개본 홈의 #now`);
  const 원묶음 = [...s.slice(i, j).matchAll(/<ol class="news">([\s\S]*?)<\/ol>/g)].map(m => m[1]);
  let 묶음 = 원묶음.map(m1 => [...m1.matchAll(/<li><a href="([^"]+)"( hreflang="\w+")?><time datetime="(\d{4}-\d{2}-\d{2})">([^<]+)<\/time><span class="news-who"><i class="dot dot-(\w+)" aria-hidden="true"><\/i>([^<]+)<\/span><span class="news-what"><span class="news-title">([^<]+)<\/span><\/span><span class="news-go[^"]*" aria-hidden="true">[^<]*<\/span><\/a><\/li>/g)].map(x => ({ href: x[1], hreflang: x[2] || '', d: x[3], label: x[4], dot: x[5], who: x[6], title: x[7] })));
  // 이번 공개 뒤 공개본 홈은 이 빌드의 v11 꼴이다(<span class="who">보이는 갈래</span><b>제목</b>) — 그때는 보이는 갈래 이름을 그대로 잇는다(Opus 대체 최종 검수 F2)
  const 다맞음 = 묶 => 묶.length === 2 && 묶[0].length && 묶.every((g, k) => g.length === (원묶음[k].match(/<li>/g) || []).length);
  const v11 = 원묶음.map(m1 => [...m1.matchAll(/<li><a href="([^"]+)"( hreflang="\w+")?><time datetime="(\d{4}-\d{2}-\d{2})">([^<]+)<\/time><span class="who">([^<]+)<\/span><b>([^<]+)<\/b><span class="arr" aria-hidden="true">→<\/span><\/a><\/li>/g)].map(x => ({ href: x[1], hreflang: x[2] || '', d: x[3], label: x[4], 보임: x[5], title: x[6] })));
  if (!다맞음(묶음) && 다맞음(v11)) 묶음 = v11;
  단언(다맞음(묶음), `${lang} 공개본 소식 꼴이 바뀌었다`);
  단언(묶음.flat().some(x => x.href === '#platform-get'), `${lang} 공개본 소식에 PC 앱 줄이 없다`);
  return 묶음;
}

// ── 시안 읽기와 공통 고침 ─────────────────────────────────────────────
const LF = s => s.replace(/\r\n/g, '\n'); // 작업본은 CRLF로 꺼내질 수 있다 — 출력은 LF
// 영어판은 짓는 도구가 빈 불 속성을 hidden=""로 적었다 — 한국어판과 같은 꼴로 맞춘다
const 읽기 = f => LF(fs.readFileSync(path.join(시안, f), 'utf8')).replace(/(\s(?:hidden|open|disabled|muted|loop|playsinline|controls))=""/g, '$1');
const css파일 = new Map(); // 이름 → 글
function css로(글, 이름) {
  const 고친 = 고친css(글);
  if (css파일.has(이름)) 단언(css파일.get(이름) === 고친, `${이름}.css가 쪽마다 다르다`);
  css파일.set(이름, 고친);
  return `<link rel="stylesheet" href="${그림}${이름}.css?v=${sha12(고친)}">`;
}
function 고친css(글) {
  글 = 글.replace(/\/\*[\s\S]*?\*\//g, '');
  글 = 글.split("'SUIT Variable'").join("'SYNK Sans'");
  단언(!/SUIT Variable/.test(글), 'CSS에 줄이기 전 글꼴 이름이 남았다'); // 뒤따르는 'SUIT'는 방문자 컴퓨터에 깔린 원본을 부르는 대체 이름이라 둔다
  글 = 그림자리(글);
  return 글.split('\n').map(l => l.replace(/\s+$/, '')).filter(l => l.trim()).join('\n') + '\n';
}
/** 시안의 assets/ · ../assets/ 를 /assets/v11/ 로(공개본 주소 https://synk.im/assets/v10/ 처럼 앞에 / 가 붙은 것은 건드리지 않는다) */
const 그림자리 = 글 => 글.replace(/(?<![\w/.-])(?:\.\.\/)?assets\//g, 그림);

// 쪽 안 스크립트의 덩어리 주석과 줄 끝 // 주석(앞이 빈칸이고 뒤가 빈칸인 것)을 뺀다. 문자열 속 https:// 같은 것은 // 뒤가 빈칸이 아니라 남는다
function 스크립트주석빼기(js) {
  js = js.replace(/\/\*[\s\S]*?\*\//g, '');
  js = js.replace(/(^|[ \t])\/\/ [^\n]*/gm, '$1');
  return js.split('\n').map(l => l.replace(/\s+$/, '')).filter(l => l.trim()).join('\n') + '\n';
}
function 공통고침(글, lang) {
  글 = 정규바꿈(글, /<style data-synk-폰트="SUIT">[\s\S]*?<\/style>/, '', 1, '심은 글꼴');
  글 = 정규바꿈(글, /<meta name="robots" content="noindex">\n?/, '', 1, 'noindex');
  글 = 정규바꿈(글, /<div class="proto" aria-hidden="true">[^<]*<\/div>\n?/, '', 1, '시안 표시');
  글 = 글.replace(/<!--[\s\S]*?-->\n?/g, '');
  글 = 정규바꿈(글, /\n?\s*if \((?:new URLSearchParams\(location\.search\)|q)\.has\('clean'\)\) (?:document\.querySelector\('\.proto'\)|\$\('\.proto'\))\.hidden = true;/, '', 1, '시안 표시 줄');
  글 = 글.replace(/<script>([\s\S]*?)<\/script>/g, (m, js) => '<script>' + 스크립트주석빼기(js) + '</script>');
  글 = 정규바꿈(글, /\n\s*window\.__home = \{[^\n]*\n/, '\n', '*' === '*' && 글.includes('window.__home') ? 1 : 0, '확인용 손잡이');
  // 글 단위 고침: 영어 광고 쪽의 「made with AI」는 공개 도구가 /pulse/ 밖에서 막는 표현이다(뜻은 같다)
  if (lang === 'en') 글 = 글.replace('are made with AI.', 'are created with AI.');
  return 글;
}

/** 사이트 안 링크를 공개 주소로. 시안의 상대 주소(index.html · detail.html?p= · ?p=)와 https://synk.im/… 를 고친다 */
function 링크고침(글, lang, 이쪽) {
  const en = lang === 'en', 앞 = en ? '/en' : '';
  const 영어도 = p => (en && 공개에있나('en' + p + 'index.html') ? '/en' : '') + p;
  글 = 글.replace(/href="https:\/\/synk\.im(\/[^"]*)"/g, (m, p) => {
    if (p === '/shift/') return `href="${앞}/shift/#ask"`;
    if (p === '/pulse/') return 'href="https://workspace.synk.im/pulse-app/?start=request"';
    if (p === '/account/' ) return 'href="/account/platform.html#home"';
    const [경로, 꼬리 = ''] = p.split('#');
    if (/^\/(founder|lab|path|atlas)\/$/.test(경로)) return `href="${영어도(경로)}${꼬리 ? '#' + 꼬리 : ''}"`;
    return `href="${p}"`;
  });
  글 = 글.replace(/href="(?:detail\.html)?\?p=(\w+)"/g, (m, id) => { 단언(id === 'atlas' || 상세[id], `모르는 쪽 ${id}`); return `href="${쪽주소(lang, id)}"`; });
  글 = 글.replace(/href="index\.html(#[\w-]+)?"/g, (m, h = '') => `href="${앞}/${h}"`);
  글 = 글.replace(/href="en\/index\.html"/g, 'href="/en/"').replace(/href="\.\.\/index\.html"/g, 'href="/"');
  글 = 글.replace(/href="en\/detail\.html"/g, `href="${쪽주소('en', 이쪽)}"`).replace(/href="\.\.\/detail\.html"/g, `href="${쪽주소('ko', 이쪽)}"`);
  return 글;
}

function 머리글({ lang, title, desc, 주소, 대안, og, ogAlt, 더 = '' }) {
  const e = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const 줄 = [
    `<title>${e(title)}</title>`,
    `<meta name="description" content="${e(desc)}">`,
    `<link rel="canonical" href="${사이트}${주소}">`,
    Object.entries(대안).map(([h, p]) => `<link rel="alternate" hreflang="${h}" href="${사이트}${p}">`).join(''),
    `<meta property="og:type" content="website"><meta property="og:url" content="${사이트}${주소}"><meta property="og:title" content="${e(title)}"><meta property="og:description" content="${e(desc)}">`,
    `<meta property="og:image" content="${사이트}${og}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${e(ogAlt)}"><meta name="twitter:card" content="summary_large_image">`,
    '<link rel="icon" type="image/png" sizes="16x16" href="/assets/favicon-synk-20260919-16.png"><link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-synk-20260919-32.png"><link rel="icon" type="image/png" sizes="48x48" href="/assets/favicon-synk-20260919-48.png">',
    `<link rel="preload" href="${그림}synk-sans-v11.woff2" as="font" type="font/woff2" crossorigin>`,
    `<style>@font-face{font-family:'SYNK Sans';src:url(${그림}synk-sans-v11.woff2) format('woff2');font-weight:100 900;font-display:swap}</style>`,
    `<script type="module" src="${이어받기[lang].방문}"></script>`,
    `<script type="module" src="${이어받기[lang].가입}"></script>`,
    더,
  ];
  return 줄.filter(Boolean).join('\n');
}
/** 시안 머리의 <title>을 공개 머리로, <style> 덩어리를 파일 링크로 */
function 머리바꿈(글, 머리, css이름들) {
  let k = 0;
  글 = 글.replace(/<style>([\s\S]*?)<\/style>/g, (m, c) => { 단언(k < css이름들.length, 'CSS 덩어리가 더 있다'); return css로(c + (k === 0 && css이름들.덧 ? css이름들.덧 : ''), css이름들[k++]); });
  단언(k === css이름들.length, `CSS 덩어리 ${k}개(기대 ${css이름들.length})`);
  // 제목 자리에 공개 머리(그 안의 글꼴 <style>은 위에서 파일로 빼지 않는다)
  return 정규바꿈(글, /<title>[^<]*<\/title>/, () => 머리, 1, '제목');
}

const og = {}; // 'home-ko' → 공개 주소(?v=)
function og주소(이름) { const f = path.join(여기, 'og', 이름 + '.jpg'); if (!fs.existsSync(f)) return `${그림}og/${이름}.jpg?v=000000000000`; return `${그림}og/${이름}.jpg?v=${sha12(fs.readFileSync(f))}`; }

// ── 홈 ──────────────────────────────────────────────────────────────
const 덧css = LF(fs.readFileSync(path.join(여기, '덧.css'), 'utf8'));
const 홈글 = {
  ko: { who: { 플랫폼: '플랫폼', LAB: '한국어', PULSE: '광고', SHIFT: 'AI 강의', PATH: '유학', SYNK: 'SYNK' }, more: '지난 소식', copy: '문의 메일 주소 복사', q: '질문 입력', ph: '다른 질문을 입력해 보세요', ask: '묻기',
    pf: { tag: 'SYNK 플랫폼', h: 'SYNK ID 하나로 전부 씁니다', p: '한국어 연습과 솔리오를 계정 하나로 씁니다. 미리보기판입니다(Windows 64비트 · macOS 13 이상).', win: 'Windows용 다운로드', arm: 'Mac용 · Apple Silicon', x64: 'Mac용 · Intel', web: '웹에서 열기', sha: '파일 확인값(SHA-256)', help: '설치 안내',
      steps: ['<b>Windows</b> 받은 SYNK-Platform-Preview 파일을 엽니다. 「Windows의 PC 보호」가 나오면 「추가 정보」를 누르고 「실행」을 누릅니다. 미리보기판이라 아직 정식 코드 서명 전이어서 나오는 화면입니다.', '<b>Mac</b> 왼쪽 위 Apple 메뉴 → 이 Mac에 관하여에서 칩을 확인합니다. 받은 DMG를 열고 SYNKPlatformPreview를 Applications 폴더로 끌어 놓은 뒤 응용 프로그램에서 엽니다. 처음 열 때 확인 창이 나오면 시스템 설정 → 개인정보 보호 및 보안에서 「그래도 열기」를 누릅니다. 아직 Apple 공증 전이어서 나오는 화면입니다.'] },
    legal: '<a href="/terms/">이용약관</a><a href="/data-deletion/">데이터 삭제</a>', biz: '사업자 정보', bizQ: '사업자등록번호를 알려주세요.', visit: '방문 목적과 경로를 익명으로 집계합니다.', visitMore: '자세히', visitHref: '/privacy/#visitor-stats', asOf: '회사·사업 안내 기준일', close: '닫기' },
  en: { who: { Platform: 'Platform', LAB: 'Korean', PULSE: 'Ads', SHIFT: 'AI lectures', PATH: 'Study', SYNK: 'SYNK' }, more: 'Earlier news', copy: '문의 메일 주소 복사', q: 'Your question', ph: 'Type another question', ask: 'Ask',
    pf: { tag: 'SYNK Platform', h: 'One SYNK ID for everything', p: 'Korean practice and SOLIO on one account. This is a preview (Windows 64-bit · macOS 13 or later).', win: 'Download for Windows', arm: 'Mac · Apple Silicon', x64: 'Mac · Intel', web: 'Open on the web', sha: 'File checksums (SHA-256)', help: 'How to install',
      steps: ['<b>Windows</b> Open the SYNK-Platform-Preview file you downloaded. If “Windows protected your PC” appears, choose “More info”, then “Run anyway”. It appears because this preview is not code-signed yet.', '<b>Mac</b> Check your chip under Apple menu → About This Mac. Open the DMG, drag SYNKPlatformPreview into Applications, and open it from there. If a warning appears the first time, go to System Settings → Privacy &amp; Security and choose “Open Anyway”. It appears because the preview is not notarized by Apple yet.'] },
    legal: '<a href="/terms/">Terms</a><a href="/data-deletion/">Data deletion</a>', biz: 'Business information', bizQ: 'What is your business registration number?', visit: 'We anonymously count why and how people visit.', visitMore: 'Details', visitHref: '/privacy/#visitor-stats-en', asOf: 'Company information as of', close: 'Close' },
};
const FAQ기록 = ['synk-intro', 'lab-drama', 'synk-atlas', 'synk-platform', 'shift-services', 'pulse-studio'];

function 홈짓기(lang) {
  const src = lang === 'en' ? 'en/index.html' : 'index.html', T = 홈글[lang], I = 이어받기[lang], 앞 = lang === 'en' ? '/en' : '';
  let 글 = 공통고침(읽기(src), lang);
  // 소식: 공개본 #now에서 다시 짓는다(날짜 · 제목 · 링크는 공개본, 갈래 이름은 시안). PC 공개 도구가 찾는 꼴을 지킨다.
  const 줄 = x => `<li><a href="${x.href}"${x.hreflang}><time datetime="${x.d}">${x.label}</time><span class="who">${x.보임 || T.who[x.who] || 단언(false, `${lang} 소식 갈래 ${x.who}`)}</span><b>${x.title}</b><span class="arr" aria-hidden="true">→</span></a></li>`;
  const [펼침, 지난] = I.소식;
  글 = 정규바꿈(글, /<div class="news">[\s\S]*?<\/details>\n\s*<\/div>/, `<div class="news" id="now">\n      <ol class="news">${펼침.map(줄).join('')}</ol>\n      <details>\n        <summary>${T.more} <span>${지난.length}</span></summary>\n        <ol class="news">${지난.map(줄).join('')}</ol>\n      </details>\n    </div>`, 1, '소식');
  // 묻기: 공개본 site.js가 찾는 꼴로(질문 여섯은 공개본과 같은 기록, 답은 엔진이 그린다)
  const 질문들 = [...글.matchAll(/<li><button type="button" aria-expanded="false" aria-controls="faq-a-(\d)"><span class="no" aria-hidden="true">(\d+)<\/span><span>([^<]+)<\/span><i aria-hidden="true">\+<\/i><\/button><div class="faq-a" id="faq-a-\d" hidden>[\s\S]*?<\/div><\/li>/g)];
  단언(질문들.length === 6, `${lang} 자주 묻는 질문 ${질문들.length}개`);
  const 묻기목록 = '<ul class="faq">\n' + 질문들.map((m, i) => `        <li><button class="faq-q" type="button" aria-expanded="false" aria-controls="faq-a-${m[1]}" data-faq="${m[3]}" data-record="${FAQ기록[i]}"><span class="no" aria-hidden="true">${m[2]}</span><span>${m[3]}</span><i aria-hidden="true">+</i></button><div class="faq-a" id="faq-a-${m[1]}" hidden></div></li>`).join('\n') + '\n      </ul>';
  글 = 정규바꿈(글, /<ul class="faq">[\s\S]*?<\/ul>/, 묻기목록, 1, '자주 묻는 질문');
  글 = 정규바꿈(글, /<div class="ask-main">/, `<div class="ask-main" id="questions" data-ask data-lang="${lang}" data-site="synk" data-engine="${I.엔진}" data-knowledge="${I.자료}">`, 1, '질문창 뿌리');
  글 = 정규바꿈(글, /<form class="ask-form" id="ask-form" autocomplete="off"><label class="sr" for="ask-q">([^<]+)<\/label><textarea id="ask-q" name="question" rows="1" maxlength="500" placeholder="([^"]+)"><\/textarea><button type="submit">([^<]+)<span class="arr" aria-hidden="true">→<\/span><\/button><\/form>/,
    (m, l, ph, b) => `<div id="messages" aria-live="polite"></div>\n      <form class="ask-form" id="question-form" autocomplete="off"><label class="sr" for="question">${l}</label><textarea id="question" name="question" rows="1" maxlength="500" placeholder="${ph}"></textarea><button id="send" type="submit" disabled>${b}<span class="arr" aria-hidden="true">→</span></button></form>`, 1, '질문 칸');
  글 = 바꿈(글, '<button type="button" id="ask-copy">', `<button type="button" id="ask-copy" data-measure="${T.copy}">`, 1, '주소 복사');
  // 묻기 구역의 시안 스크립트: 자주 묻는 질문 여닫기와 「답하지 않습니다」 자리는 site.js가 맡으므로 뺀다
  글 = 정규바꿈(글, /\n  const qs = \[\.\.\.document\.querySelectorAll\('\.faq button'\)\];\n  qs\.forEach\([^\n]*\n/, '\n', 1, '시안 질문 여닫기');
  글 = 정규바꿈(글, /\n  \$\('#ask-form'\)\.addEventListener\('submit'[^\n]*\n/, '\n', 1, '시안 질문 자리');
  // 주소 복사 안내는 홈의 다른 글처럼 합쇼체로(카본 H2)
  if (lang === 'ko') {
    글 = 바꿈(글, "say('이메일 주소를 복사했어요.')", "say('이메일 주소를 복사했습니다.')", 1, '복사 안내');
    글 = 바꿈(글, "say('복사를 쓸 수 없어요. 주소는 hello@synk.im입니다.')", "say('복사하지 못했습니다. 주소는 hello@synk.im입니다.')", 1, '복사 실패 안내');
  }
  // 동작 줄이기를 켠 사람은 늘 flat 쪽을 탄다 — 그쪽 스크롤도 부드럽게 굴리지 않는다(카본 F1 · H3)
  글 = 바꿈(글, "scrollIntoView({ behavior: 'smooth' }); else goto(", "scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); else goto(", 2, '동작 줄이기 스크롤');
  // PC 앱 받기
  const P = T.pf;
  const 받기 = `<section class="pf" id="platform" data-platform-version="${I.판}" aria-labelledby="pf-t"><span id="platform-get" class="anchor" aria-hidden="true"></span>
    <div class="pf-say"><p class="tag">${P.tag}</p><h2 id="pf-t">${P.h}</h2><p>${P.p}</p></div>
    <div class="pf-get" data-platform-downloads><a href="${I.받기.win}"><span>${P.win}</span><small>Preview ${I.판}</small><span class="arr" aria-hidden="true">↓</span></a><a href="${I.받기.arm}"><span>${P.arm}</span><small>Preview ${I.판}</small><span class="arr" aria-hidden="true">↓</span></a><a href="${I.받기.x64}"><span>${P.x64}</span><small>Preview ${I.판}</small><span class="arr" aria-hidden="true">↓</span></a></div>
    <p class="pf-more"><a href="/account/platform.html#home">${P.web} <span class="arr" aria-hidden="true">→</span></a><a href="${I.릴리스}" target="_blank" rel="noopener">${P.sha} <span class="arr" aria-hidden="true">↗</span></a></p>
    <details class="pf-help"><summary>${P.help}</summary><ul>${P.steps.map(s => `<li>${s}</li>`).join('')}</ul></details>
  </section>`;
  글 = 정규바꿈(글, /(<\/div>\n  <\/div>\n  <footer class="foot">)/, (m) => `</div>\n  </div>\n  ${받기}\n  <footer class="foot">`, 1, 'PC 앱 받기 자리');
  // 「PC 앱 받기」 링크 둘(솔리오 · 시작하기)은 홈 안의 받기 자리로
  글 = 바꿈(글, 'href="https://synk.im/account/platform.html"', 'href="#platform"', 2, 'PC 앱 받기 링크');
  // 바닥: 방문 기록 안내와 기준일(PC 공개 도구가 이 날을 판을 낸 날로 올린다)
  글 = 정규바꿈(글, /(\n\s*)<div class="wm" aria-hidden="true">synk<\/div>/, (m, sp) => `${sp}<div class="foot-bottom"><span>${T.visit} <a href="${T.visitHref}">${T.visitMore}</a></span><span>${T.asOf} <time class="mono" datetime="${I.기준일}">${I.기준일.replace(/-/g, '.')}</time></span></div>${sp}<div class="wm" aria-hidden="true">synk</div>`, 1, '바닥');
  // 들어오는 홈 주소: 같은 뜻의 구역에 크기 없는 표지를 둔다
  const 표지 = ids => ids.map(id => `<span id="${id}" class="anchor" aria-hidden="true"></span>`).join('');
  글 = 바꿈(글, '<main>', '<main id="main">' + 표지(['top']), 1, '첫 화면 표지');
  글 = 정규바꿈(글, /(<section class="doors" id="glance"[^>]*>)/, (m, a) => a + 표지(['business', 'products']), 1, '하는 일 표지');
  글 = 정규바꿈(글, /(<section class="why" id="why"[^>]*>)/, (m, a) => a + 표지(['lab', 'path', 'worlds', 'learner', 'try']), 1, '한국어와 유학 표지');
  글 = 정규바꿈(글, /(<section class="pulse" id="pulse"[^>]*>)/, (m, a) => a + 표지(['showroom']), 1, '광고 표지');
  글 = 정규바꿈(글, /(<section class="more ask" id="ask"[^>]*>)/, (m, a) => a + 표지(['contact', 'contact-web']), 1, '묻기 표지');
  // 시안의 「내 홈」은 #start였다 — 공개본과 같은 내 홈으로
  글 = 바꿈(글, '<a class="me" href="#start">', '<a class="me" href="/account/platform.html#home">', 1, '내 홈');
  글 = 바꿈(글, '<a href="https://synk.im/privacy/">', '<a href="https://synk.im/privacy/">', 1, '홈 바닥 개인정보');
  글 = 정규바꿈(글, /(<a href="https:\/\/synk\.im\/privacy\/">[^<]*<\/a>)/, (m, a) => a + T.legal + `<button type="button" data-ask-q="${T.bizQ}">${T.biz}</button>`, 1, '홈 바닥 링크');
  글 = 정규바꿈(글, /(<a class="lang" href="[^"]+" hreflang="(?:en|ko)">[A-Z]{2}<\/a>)/, (m, a) => a + '<a class="lang" href="/mn/" hreflang="mn" lang="mn">MN</a>', 1, 'MN 링크');
  글 = 링크고침(글, lang, 'home');
  // 광고 앨범의 영상은 공개본 파일 그대로(사이트 안 주소로)
  글 = 바꿈(글, "const V = 'https://synk.im/assets/v10/';", "const V = '/assets/v10/';", 1, '영상 자리');
  글 = 그림자리(글);
  // 머리
  const 대안 = { ko: '/', en: '/en/', mn: '/mn/', 'x-default': '/' };
  // 하늘(낮 · 노을 · 밤)은 첫 그림 전에 머리에서 정한다 — 쪽 끝의 시안 스크립트가 같은 식으로 다시 정한다(카본 H8)
  const 하늘 = `<script>(()=>{const h=new Date().getHours()+new Date().getMinutes()/60;document.documentElement.dataset.sky=new URLSearchParams(location.search).get('sky')||(h>=6&&h<17?'day':(h>=17&&h<19.5)||(h>=5&&h<6)?'sunset':'night')})()</script>`;
  const 넘김 = `<script>(()=>{const a=document.documentElement.lang==='en'?'/en':'',m={'#atlas':a+'/atlas/','#principles':a+'/atlas/','#philosophy':a+'/atlas/','#drama':a+'/lab/#drama','#founder':a+'/founder/','#founder-quote':a+'/founder/'},go=()=>{const t=m[location.hash];if(t)location.replace(t)};go();addEventListener('hashchange',go);let moved=0;for(const e of ['wheel','touchstart','keydown','pointerdown'])addEventListener(e,()=>{moved=1},{passive:true,once:true});const settle=()=>{if(moved||!location.hash)return;const el=document.getElementById(decodeURIComponent(location.hash.slice(1)));if(el)el.scrollIntoView({block:'start',behavior:'instant'})};addEventListener('load',()=>{for(const ms of [0,400,1000,1800,2800])setTimeout(settle,ms)})})()</script>`;
  const 머리 = 머리글({ lang, title: 홈머리[lang].title, desc: 홈머리[lang].desc, 주소: 앞 + '/', 대안, og: og주소('home-' + lang), ogAlt: 홈머리[lang].alt,
    더: [하늘, 넘김, `<script type="module" src="${I.site}"></script>`].join('\n') });
  글 = 머리바꿈(글, 머리, Object.assign(lang === 'en' ? ['home-en', 'en-fix'] : ['home'], { 덧: 덧css }));
  if (I.확인) 글 = 바꿈(글, '<meta charset="utf-8">', I.확인 + '\n<meta charset="utf-8">', 1, '검색 확인 줄');
  // 질문창의 안내 자료 창과 알림(site.js가 쓴다), 쪽 끝의 PC 판 자료 줄
  const 닫기 = T.close;
  글 = 바꿈(글, '</body>', `<dialog class="doc-dialog" id="doc-dialog" aria-labelledby="doc-title"><div class="doc-head"><div><p class="mono" id="doc-brand"></p><h2 id="doc-title"></h2></div><button class="doc-close" type="button" data-close aria-label="${닫기}">×</button></div><div class="doc-body" id="doc-body"></div></dialog>\n<div class="toast" id="toast" role="status" hidden></div>\n<script defer src="${I.client}"></script>\n</body>`, 1, '쪽 끝');
  return 글;
}

// ── 상세 쪽 ──────────────────────────────────────────────────────────
function 상세짓기(lang) {
  const src = lang === 'en' ? 'en/detail.html' : 'detail.html', T = 홈글[lang];
  const 원 = 공통고침(읽기(src), lang);
  const 글들 = {};
  const arts = [...원.matchAll(/<article id="(\w+)" data-title="([^"]*)" hidden>[\s\S]*?<\/article>\n/g)];
  단언(arts.length === 8, `${lang} 상세 article ${arts.length}개`);
  const 앞부분 = 원.slice(0, arts[0].index), 뒷부분 = 원.slice(arts.at(-1).index + arts.at(-1)[0].length);
  for (const a of arts) {
    const id = a[1];
    if (id === 'atlas') continue;
    let 글 = 앞부분 + a[0].replace(' hidden>', '>') + 뒷부분;
    // 다섯 곳 줄의 지금 쪽: 시안은 ?p=와 견줬다 — 공개 주소와 견준다
    글 = 바꿈(글, "if (a.getAttribute('href') === '?p=' + art.id)", "if (a.getAttribute('href') === location.pathname)", 1, '다섯 곳 줄');
    글 = 정규바꿈(글, /const art = document\.getElementById\(q\.get\('p'\)\) \|\| \$\('#korean'\);/, "const art = $('main > article');", 1, '쪽 고르기');
    글 = 정규바꿈(글, /\n\s*\$\('\.lang'\)\.href \+= location\.search;/, '', 1, '언어 링크 꼬리');
    글 = 정규바꿈(글, /\s*document\.title = art\.dataset\.title \+ ' · SYNK[^']*';/, '', 1, '쪽 제목 줄');
    // 무대가 보이기 전에 사람이 먼저 고른 줄은 첫 줄로 덮지 않는다(카본 D1)
    글 = 바꿈(글, 'if (e.isIntersecting) { show(first); o.disconnect(); }', 'if (e.isIntersecting) { if (cur < 0) show(first); o.disconnect(); }', 1, '첫 줄 열기');
    // 바닥: 방문 기록 안내
    글 = 정규바꿈(글, /(<footer class="foot"><nav[^>]*>[\s\S]*?<\/nav>)(<span>© 2026 SYNK<\/span><\/footer>)/, (m, n, c) => `${n}<span class="foot-note">${T.visit} <a href="${T.visitHref}">${T.visitMore}</a></span>${c}`, 1, '상세 바닥');
    글 = 정규바꿈(글, /(<a href="https:\/\/synk\.im\/privacy\/">[^<]*<\/a>)/, (m, a) => a + T.legal, 1, '상세 바닥 링크');
    // 「PC 앱 받기」는 홈과 같이 설치 파일이 있는 홈의 받기 자리로(Opus 대체 최종 검수 F3)
    if (id === 'ai') 글 = 바꿈(글, '<a class="pill" href="https://synk.im/account/platform.html">', `<a class="pill" href="${lang === 'en' ? '/en' : ''}/#platform">`, 1, 'PC 앱 받기 단추');
    if (id === 'study') 글 = 바꿈(글, '<div class="shots" style="--n:2">', `<div class="shots" style="--n:2" tabindex="0" role="region" aria-label="${lang === 'en' ? 'App screens' : '앱 화면'}">`, 1, '유학 화면 줄');
    글 = 링크고침(글, lang, id);
    글 = 그림자리(글);
    // 머리
    const h1 = a[0].match(/<h1>([\s\S]*?)<\/h1>/)[1].replace(/<br>/g, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
    const lead = (a[0].match(/<p class="hero-lead">([\s\S]*?)<\/p>/)?.[1] || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
    단언(lead, `${lang} ${id} 첫 화면 설명`);
    const 첫문장 = lead.split(/(?<=[.?!])\s+/)[0].replace(/\.$/, '');
    // 첫 줄이 긴 문장인 쪽(AI 강의 · 광고)만 첫 줄 그대로, 나머지는 첫 줄 — 첫 문장(카본 A1: 길이로 가르면 영어 유학 · 취업이 설명 없이 남았다)
    const title = (id === 'ai' || id === 'ad' ? h1 : `${h1} — ${첫문장}`) + ' · SYNK';
    const 대안 = { ko: 쪽주소('ko', id), en: 쪽주소('en', id), 'x-default': 쪽주소('ko', id) };
    const heroAlt = a[0].match(/<img class="hero-bg" src="[^"]+" alt="([^"]*)"/)?.[1] || '';
    const ogAlt = (lang === 'en' ? `First screen of the SYNK “${h1}” page` : `SYNK 「${h1}」 쪽 첫 화면`) + (heroAlt ? ' — ' + heroAlt : '');
    const 머리 = 머리글({ lang, title, desc: lead, 주소: 쪽주소(lang, id), 대안, og: og주소(상세[id] + '-' + lang), ogAlt });
    글 = 머리바꿈(글, 머리, Object.assign(lang === 'en' ? ['detail', 'en-fix'] : ['detail'], { 덧: 덧css }));
    글들[id] = 글;
  }
  return 글들;
}

// ── 질문창 자료 · sitemap · llms ───────────────────────────────────────
function 자료고침(lang) {
  let s = 공개글(lang === 'en' ? 'en/knowledge.json' : 'knowledge.json');
  const 표 = lang === 'en' ? [
    ['With it we run four businesses: Korean education, AI lectures and work automation, ad videos, and preparing to study in Korea.', 'Three lines of work grew out of it: Korean and study in Korea, AI lectures, and ads.', 2],
    ['Today SYNK works in four areas: Korean education, AI classes for companies, ad production, and preparing to study in Korea.', 'Today SYNK does three things: Korean and study in Korea, AI lectures, and ads.', 3],
    ['"See the four businesses"', '"See the three things we do"', 6],
  ] : [
    ['이 엔진으로 한국어 교육, AI 강의와 업무 자동화, 광고 영상, 한국 유학 준비까지 네 가지 일을 합니다.', '이 엔진에서 나온 일은 셋입니다. 한국어와 유학, AI 강의, 광고입니다.', 2],
    ['SYNK는 지금 한국어 교육, 회사의 AI 수업, 광고 제작, 한국 유학 준비 네 곳에서 일합니다.', 'SYNK가 지금 하는 일은 셋입니다. 한국어와 유학, AI 강의, 광고입니다.', 3],
    ['"네 사업 보기"', '"하는 일 셋 보기"', 6],
  ];
  for (const [a, b, n] of 표) s = 바꿈(s, a, b, n, `${lang} 질문창 자료`);
  // 고친 두 기록의 확인 날짜
  for (const id of ['synk-intro', 'synk-vision']) {
    const i = s.indexOf(`"id": "${id}"`); 단언(i > 0, `${lang} ${id} 기록`);
    const j = s.indexOf('"reviewedAt": "', i); 단언(j > i && j - i < 6000 && !s.slice(i + 5, j).includes('"id": "'), `${lang} ${id} 확인 날짜 자리`);
    s = s.slice(0, j) + '"reviewedAt": "2026-11-20' + s.slice(j + '"reviewedAt": "2026-11-05'.length);
    단언(s.slice(j - 1, j + 30).includes('"reviewedAt": "2026-11-20"'), `${lang} ${id} 확인 날짜`);
  }
  // site.js loadEngine과 같은 검사: 중복 id · 답 문단 ⊂ 근거 문서 문단 · relatedIds
  const k = JSON.parse(s), docs = new Map(k.docs.map(d => [d.id, d])), recs = new Map(k.records.map(r => [r.id, r]));
  단언(docs.size === k.docs.length && recs.size === k.records.length, `${lang} 질문창 자료 id 겹침`);
  for (const r of k.records) {
    단언(docs.has(r.sourceId) && typeof r.answer === 'string' && r.answer.trim() && Array.isArray(r.questionExamples) && r.questionExamples.length && Array.isArray(r.keywords), `${lang} ${r.id} 기록 꼴`);
    단언(!(r.relatedIds || []).some(x => !recs.has(x)), `${lang} ${r.id} relatedIds`);
    for (const p of r.answer.split('\n\n')) 단언(docs.get(r.sourceId).paragraphs.includes(p), `${lang} ${r.id} 답 문단이 근거 문서에 없다`);
  }
  return s;
}
function 사이트맵() {
  let s = 공개글('sitemap.xml');
  const 새 = [];
  for (const lang of ['ko', 'en']) for (const id of Object.keys(상세)) 새.push(`  <url><loc>${사이트}${쪽주소(lang, id)}</loc></url>`);
  return 바꿈(s, '  <url><loc>https://synk.im/mn/</loc></url>', 새.join('\n') + '\n  <url><loc>https://synk.im/mn/</loc></url>', 1, 'sitemap');
}
function llms() {
  let s = 공개글('llms.txt');
  s = 바꿈(s, 'SYNK는 지금 한국어 교육, 회사의 AI 수업, 광고 제작, 한국 유학 준비 네 곳에서 일합니다.', 'SYNK가 지금 하는 일은 셋입니다. 한국어와 유학, AI 강의, 광고입니다.', 1, 'llms 한국어');
  s = 바꿈(s, 'Today SYNK works in four areas: Korean education, AI classes for companies, ad production, and preparing to study in Korea.', 'Today SYNK does three things: Korean and study in Korea, AI lectures, and ads.', 1, 'llms 영어');
  const 이름 = { korean: ['한국어', 'Korean'], classroom: ['교실', 'Classroom'], study: ['유학', 'Study in Korea'], job: ['취업', 'Jobs'], community: ['모임', 'Community'], ai: ['AI 강의', 'AI lectures'], ad: ['광고', 'Ads'] };
  const 줄 = Object.keys(상세).map(id => `- [${이름[id][0]} · ${이름[id][1]}](${사이트}${쪽주소('ko', id)}) · [English](${사이트}${쪽주소('en', id)})`).join('\n');
  return 바꿈(s, '- [SYNK LAB](https://synk.im/lab/)', 줄 + '\n- [SYNK LAB](https://synk.im/lab/)', 1, 'llms 쪽 목록');
}

// ── 쓰기 ────────────────────────────────────────────────────────────
// 폴더 자체는 두고 안만 비운다(다른 셸이 그 폴더를 현재 폴더로 쥐고 있으면 Windows가 폴더 지우기를 막는다)
fs.mkdirSync(출력, { recursive: true });
for (const n of fs.readdirSync(출력)) fs.rmSync(path.join(출력, n), { recursive: true, force: true });
const 씀 = new Map(); // 공개 경로 → Buffer
const 쓰기 = (p, b) => { 씀.set(p, Buffer.isBuffer(b) ? b : Buffer.from(b)); };

쓰기('index.html', 홈짓기('ko'));
쓰기('en/index.html', 홈짓기('en'));
for (const lang of ['ko', 'en']) for (const [id, 글] of Object.entries(상세짓기(lang))) 쓰기(쪽주소(lang, id).slice(1) + 'index.html', 글);
for (const [이름, 글] of css파일) 쓰기(`assets/v11/${이름}.css`, 글);
쓰기('knowledge.json', 자료고침('ko'));
쓰기('en/knowledge.json', 자료고침('en'));
쓰기('sitemap.xml', 사이트맵());
쓰기('llms.txt', llms());

// 그림: 새 쪽이 부르는 /assets/v11/ 파일만(스크립트가 이름을 짓는 앨범 표지 포함)
const 부름 = new Set();
for (const [p, b] of 씀) {
  if (!/\.(html|css)$/.test(p)) continue;
  const 글 = b.toString('utf8');
  for (const m of 글.matchAll(/\/assets\/v11\/([A-Za-z0-9_./-]+\.(?:webp|jpg|png|svg|avif|mp4|webm))/g)) 부름.add(m[1]);
  for (const m of 글.matchAll(/\{ k: '([a-z0-9]+)', v: 'pulse-film-/g)) 부름.add(`pulse-film-${m[1]}.webp`);
  for (const m of 글.matchAll(/\/assets\/v11\/([A-Za-z0-9_./-]*\$\{[^}]+\}[A-Za-z0-9_.${}-]*\.(?:webp|jpg|png))/g)) {
    const 꼴 = new RegExp('^' + m[1].split(/\$\{[^}]+\}/).map(x => x.replace(/[.*+?^()|[\]\\]/g, '\\$&')).join('[A-Za-z0-9_-]+') + '$');
    const 폴더 = path.posix.dirname(m[1].replace(/\$\{[^}]+\}.*$/, 'x'));
    const 맞음 = fs.readdirSync(path.join(시안, 'assets', 폴더)).map(n => (폴더 === '.' ? '' : 폴더 + '/') + n).filter(n => 꼴.test(n));
    단언(맞음.length, `스크립트가 짓는 그림 꼴 ${m[1]}에 맞는 시안 그림이 없다`);
    for (const n of 맞음) 부름.add(n);
  }
}
for (const f of [...부름].sort()) {
  if (f.startsWith('og/')) continue;
  const from = path.join(시안, 'assets', f);
  단언(fs.existsSync(from), `시안에 없는 그림 ${f}`);
  쓰기('assets/v11/' + f, fs.readFileSync(from));
}
// 공유 그림
for (const 이름 of ['home-ko', 'home-en', ...Object.values(상세).flatMap(p => [p + '-ko', p + '-en'])]) {
  const f = path.join(여기, 'og', 이름 + '.jpg');
  if (fs.existsSync(f)) 쓰기(`assets/v11/og/${이름}.jpg`, fs.readFileSync(f));
  else if (!새로찍기) console.warn(`[알림] 공유 그림 og/${이름}.jpg가 없다 — --og로 찍는다`);
}

// 글꼴: 쓴 글 전부 + 질문창 자료의 글자
const 글자 = new Set();
for (const [p, b] of 씀) if (/\.(html|css|json|txt)$/.test(p)) for (const c of b.toString('utf8')) 글자.add(c);
for (const p of ['assets/v10/site.js', 'knowledge-engine.js', 'en/knowledge-engine.js']) for (const c of 공개글(p)) 글자.add(c);
const 임시 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-v11-font-'));
fs.writeFileSync(path.join(임시, 'chars.txt'), [...글자].sort().join(''));
const 글꼴결과 = JSON.parse(execFileSync('python', [path.join(여기, '글꼴줄이기.py'), path.join(저장소, 'docs', '브랜드_폰트', 'SUIT', 'SUIT-Variable.woff2'), path.join(임시, 'chars.txt'), path.join(임시, 'font.woff2')], { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }).trim().split('\n').at(-1));
단언(!글꼴결과.missing.length, `줄인 글꼴에서 빠진 글자: ${글꼴결과.missing.join('')}`);
단언(!글꼴결과.leftNames.length, `이름 표에 SUIT가 남았다: ${글꼴결과.leftNames.join(' | ')}`);
단언(JSON.stringify(글꼴결과.wght) === '[[100,900]]', `굵기 축 ${JSON.stringify(글꼴결과.wght)}`);
쓰기('assets/v11/synk-sans-v11.woff2', fs.readFileSync(path.join(임시, 'font.woff2')));
쓰기('assets/v11/synk-sans-v11-OFL.txt', fs.readFileSync(path.join(저장소, 'docs', '브랜드_폰트', 'SUIT', 'LICENSE_OFL.txt'), 'utf8').replace(/\r\n/g, '\n').replace(/^Copyright \(c\) 2022, SUNN \(http:\/\/sun\.fo\/suit\),\nwith Reserved Font Name SUIT\./m, m => m + '\n\nsynk-sans-v11.woff2 is a modified version of SUIT Variable (subset to the characters used on synk.im) and is renamed SYNK Sans v11 as the license requires.'));
fs.rmSync(임시, { recursive: true, force: true });

for (const [p, b] of 씀) { const f = path.join(출력, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, b); }

// ── 단언 ────────────────────────────────────────────────────────────
const 쪽들 = [...씀.keys()].filter(p => p.endsWith('index.html'));
단언(쪽들.length === 16, `쪽 ${쪽들.length}장(기대 16)`);
const 금지 = [/SYNK 시안/, /시안 \d판/, /공개본 아님/, /공개본이 아니다/, /SYNK draft/i, /Not the public version/i, /This draft/i, /class="proto"/, /유호님/, /noindex/, /\?p=/, /detail\.html/, /localhost/, /SYNK-보관함/, /Documents\//, /\.tmp\//, /SUIT Variable/, /assets\/v11\/assets/, /window\.__home/, /\.has\('clean'\)/];
const 깨짐 = [];
for (const p of 쪽들) {
  const 글 = 씀.get(p).toString('utf8');
  for (const re of 금지) { const m = 글.match(re); if (m) 깨짐.push(`${p}: 「${글.slice(Math.max(0, m.index - 40), m.index + 40).replace(/\s+/g, ' ')}」`); }
  for (const m of 글.matchAll(/(?:href|src)="([^"]*)"/g)) if (m[1] && !/^(\/|#|https:\/\/|mailto:|data:|\$\{)/.test(m[1]) || m[1].startsWith('//')) 깨짐.push(`${p}: 사이트 안 주소가 /로 시작하지 않는다 「${m[1]}」`);
  for (const m of 글.matchAll(/(?:href|src)="(\/[^"#?$]*)"/g)) {
    let u = m[1]; if (u.endsWith('/')) u += 'index.html';
    const rel = decodeURIComponent(u.slice(1));
    if (!씀.has(rel) && !공개에있나(rel)) 깨짐.push(`${p}: 없는 주소 ${m[1]}`);
  }
  for (const m of 글.matchAll(/[?&]v=([0-9a-f]+)/g)) if (m[1] === '000000000000' && !새로찍기) 깨짐.push(`${p}: 공유 그림 토큰이 비었다`);
}
for (const [p, b] of 씀) if (p.endsWith('.css')) for (const m of b.toString('utf8').matchAll(/url\((\/assets\/v11\/[^)]+)\)/g)) if (!씀.has(m[1].slice(1))) 깨짐.push(`${p}: 없는 그림 ${m[1]}`);
// 도구 이름 · AI 표현 · AI 이름(배포 점검과 공개 도구의 목록을 공개본 사본에서 그대로 읽는다)
const 점검 = 공개글('.github/site-check/check.mjs');
const 이름표 = new RegExp(Buffer.from(점검.match(/const words = listOf\('([^']+)'\)/)[1], 'base64').toString('utf8'), 'i');
const 공개도구 = fs.readFileSync(path.join(저장소, 'tools', '공개.js'), 'utf8');
const AI표현 = new RegExp(공개도구.match(/const AI표현 = \/(.+)\/i;/)[1], 'i');
const AI이름 = new RegExp(공개도구.match(/const AI이름 = \/(.+)\/i;/)[1], 'i');
for (const [p, b] of 씀) {
  if (!/\.(html|css|js|json|txt|xml)$/.test(p) || /knowledge\.json$|llms\.txt$/.test(p)) continue;
  const 글 = b.toString('utf8').replace(/data:[^"')\s]+/g, '');
  for (const [이름, re] of [['도구 이름', 이름표], ['AI 표현', AI표현], ['AI 이름', AI이름]]) { const m = 글.match(re); if (m) 깨짐.push(`${p}: ${이름} 「${글.slice(Math.max(0, m.index - 30), m.index + 30)}」`); }
}
// PC 판 공개 도구가 찾는 고리(홈 둘)
for (const p of ['index.html', 'en/index.html']) {
  const 글 = 씀.get(p).toString('utf8'), lang = p.startsWith('en') ? 'en' : 'ko', I = 이어받기[lang];
  for (const u of Object.values(I.받기)) if (!글.includes(u)) 깨짐.push(`${p}: 설치 파일 주소 ${u}`);
  if (!/<section[^>]*\bid="platform" data-platform-version="\d+\.\d+\.\d+"/.test(글)) 깨짐.push(`${p}: platform 구역`);
  if (!글.includes(`<script defer src="${I.client}"></script>\n</body>`)) 깨짐.push(`${p}: client.js 줄`);
  if (!/(<div class="foot-bottom">(?:(?!<\/div>)[\s\S])*?<time class="mono" datetime=")(\d{4}-\d{2}-\d{2})(">)[^<]*(<\/time>)/.test(글)) 깨짐.push(`${p}: 바닥 기준일`);
  if (!/data-knowledge="\/(?:en\/)?knowledge\.json\?v=[a-f0-9]+"/.test(글)) 깨짐.push(`${p}: 질문창 자료 토큰`);
  const i = 글.indexOf('id="now"'), j = 글.indexOf('</section>', i), 구역 = 글.slice(i, j);
  const 목록 = [...구역.matchAll(/<ol class="news">([\s\S]*?)<\/ol>/g)];
  if (목록.length !== 2 || 목록.some(m => (m[1].match(/<li>[\s\S]*?<\/li>/g) || []).join('') !== m[1])) 깨짐.push(`${p}: 소식 꼴`);
  if (!목록.some(m => m[1].includes('<li><a href="#platform-get"><time datetime="'))) 깨짐.push(`${p}: 소식 PC 앱 줄`);
  if (/class="btn|data-download-picker|windows-download-guide/.test(글)) 깨짐.push(`${p}: site.js 내려받기 창 표지가 있다`);
  if ((글.match(/id="now"/g) || []).length !== 1 || 글.indexOf('id="now"') > 글.indexOf('<ol class="news">')) 깨짐.push(`${p}: id="now" 자리`);
  for (const id of ['top', 'business', 'products', 'lab', 'worlds', 'now', 'platform', 'platform-get', 'contact', 'questions', 'messages', 'question-form', 'question', 'send', 'doc-dialog', 'toast']) if (!글.includes(`id="${id}"`)) 깨짐.push(`${p}: id ${id}`);
}
// 쪽 안 스크립트가 주석을 빼고도 문법이 맞는가
for (const p of 쪽들) for (const m of 씀.get(p).toString('utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)) { try { new vm.Script(m[1]); } catch (e) { 깨짐.push(`${p}: 쪽 안 스크립트 문법 ${e.message}`); } }
// 글이 겹치지 않게: id가 쪽 안에서 하나씩
for (const p of 쪽들) { const ids = [...씀.get(p).toString('utf8').matchAll(/\sid="([^"]+)"/g)].map(m => m[1]); const 겹 = ids.filter((x, i) => ids.indexOf(x) !== i); if (겹.length) 깨짐.push(`${p}: 겹친 id ${[...new Set(겹)].join(', ')}`); }
if (깨짐.length) { console.error(깨짐.slice(0, 40).join('\n')); 멈춤(`단언 ${깨짐.length}건`); }

const 곁 = path.dirname(출력);
fs.writeFileSync(path.join(곁, '빌드.json'), JSON.stringify({ 공개본: 머리, 시각: new Date().toISOString(), 판: { ko: 이어받기.ko.판, en: 이어받기.en.판 } }, null, 1) + '\n');
const 표줄 = ['| 쪽 | title | description |', '|---|---|---|'];
for (const p of 쪽들.sort()) { const g = 씀.get(p).toString('utf8'); 표줄.push(`| /${p.replace(/index\.html$/, '')} | ${g.match(/<title>([^<]*)<\/title>/)[1]} | ${g.match(/<meta name="description" content="([^"]*)">/)[1]} |`); }
fs.writeFileSync(path.join(곁, '머리글.md'), 표줄.join('\n') + '\n');
const 합 = [...씀.values()].reduce((n, b) => n + b.length, 0);
console.log(JSON.stringify({ 출력, 공개본: 머리.slice(0, 8), 파일: 씀.size, 바이트: 합, 쪽: 쪽들.length, 그림: 부름.size, 글꼴: { 글자: 글꼴결과.glyphs, 바이트: 글꼴결과.bytes, 글꼴에없음: 글꼴결과.notInFont } }, null, 1));
if (새로찍기) console.log('공유 그림은 살펴보기.mjs og로 찍은 뒤 다시 짓는다');
