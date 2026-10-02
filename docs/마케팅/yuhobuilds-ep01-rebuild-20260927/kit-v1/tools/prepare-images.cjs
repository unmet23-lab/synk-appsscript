#!/usr/bin/env node
/**
 * EP01 키트판에 쓰는 실제 그림 셋을 만든다(한 번 만들면 assets/images/에 남는다).
 *
 *   node tools/prepare-images.cjs
 *
 * 1. interview-think.webp  창업자 인터뷰 v9 4K 승인본 0:27.0의 정면 프레임(위를 보며 생각하는 얼굴).
 *                          아래쪽 구운 자막 띠(4K y≥1880)는 잘라 낸다. 합성 얼굴이 아니라 실제 촬영 프레임이다.
 * 2. claude-invoice-20260602.webp  사용자가 준 Claude 청구서 캡처에서 '작업' 열을 잘라 내고 금액 열만 흐리게 했다.
 *                          날짜·결제 완료 상태는 원본 그대로다. 원본은 근거 폴더에 손대지 않고 둔다.
 * 3. practice-1/2/3.webp   이번 편의 실습 페이지(revision-v2/practice.html)의 '출석 기록' 카드를 크롬으로 실제 실행해 찍었다.
 *                          1 처음(학생 A 선택) · 2 '출석 저장'을 누른 뒤 · 3 다시 열었을 때. 페이지 코드는 바꾸지 않고
 *                          다른 부분만 숨겨 카드 하나를 찍는다. 클릭은 스크립트가 대신 누른다.
 *
 * 필요한 것: ffmpeg(libwebp 포함), 크롬(CHROME_PATH 또는 기본 설치 경로).
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'images');
const V2 = path.resolve(ROOT, '..', 'revision-v2');
const FILM = process.env.EP01_FILM || 'C:/Users/q1212/Videos/SYNK_Premium_Interview_20260925/revision9/render/SYNK_Founder_Film_4K60_v9.mp4';
const INVOICE = path.resolve(ROOT, '..', '..', 'yuhobuilds_제작여정_202607-20260922', '근거', '결제내역', 'claude-first-payment-20260602.png');
fs.mkdirSync(OUT, { recursive: true });

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', windowsHide: true, maxBuffer: 32e6 });
  if (r.status !== 0) throw new Error(`${cmd} 실패: ${r.stderr || r.stdout}`);
  return r;
};

// 1 인터뷰 실제 얼굴
if (fs.existsSync(FILM)) {
  run('ffmpeg', ['-v', 'error', '-y', '-ss', '27.0', '-i', FILM, '-frames:v', '1',
    '-vf', 'crop=1400:1660:1220:100,scale=900:-1', '-c:v', 'libwebp', '-quality', '92', path.join(OUT, 'interview-think.webp')]);
  console.log('만듦 interview-think.webp');
} else console.warn('인터뷰 원본이 없어 건너뜀:', FILM);

// 2 Claude 청구서: 1240×562로 자르고(‘보기’ 링크 열 제외) 금액 열(x 600~800, y 200~562)만 흐리게
run('ffmpeg', ['-v', 'error', '-y', '-i', INVOICE, '-filter_complex',
  '[0]crop=1240:562:0:0,split[a][b];[b]crop=200:362:600:200,boxblur=16:3[bl];[a][bl]overlay=600:200',
  '-frames:v', '1', '-c:v', 'libwebp', '-quality', '94', path.join(OUT, 'claude-invoice-20260602.webp')]);
console.log('만듦 claude-invoice-20260602.webp');

// 3 실습 페이지 세 상태
function chrome() {
  const c = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].filter((p) => p && fs.existsSync(p));
  if (!c[0]) throw new Error('크롬을 못 찾았다. CHROME_PATH로 지정한다.');
  return c[0];
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ep01-practice-'));
fs.mkdirSync(path.join(tmp, 'assets'), { recursive: true });
fs.copyFileSync(path.join(V2, 'assets', 'SUIT-Variable.woff2'), path.join(tmp, 'assets', 'SUIT-Variable.woff2'));
fs.copyFileSync(path.join(V2, 'practice.js'), path.join(tmp, 'practice.js'));
const page = fs.readFileSync(path.join(V2, 'practice.html'), 'utf8');
// 카드 하나만 보이게(나머지 숨김). 카드 자체의 모양·글은 그대로
const only = '<style>header,h1,.lead,.grid>section:nth-child(2),.prompt,footer{display:none!important}body{background:#fff!important}main{padding:16px!important;max-width:none!important}.grid{margin:0!important;grid-template-columns:1fr!important}.card{box-shadow:none!important}</style>';
const key = 'yuhobuilds-ep01-practice-v1';
const states = {
  1: { before: `<script>try{localStorage.removeItem('${key}')}catch(e){}</script>`, after: '' },
  2: { before: `<script>try{localStorage.removeItem('${key}')}catch(e){}</script>`, after: "<script>document.getElementById('save').click()</script>" },
  3: { before: `<script>try{localStorage.setItem('${key}',JSON.stringify({student:'A',date:'06.02',attendance:true}))}catch(e){}</script>`, after: '' },
};
for (const [n, s] of Object.entries(states)) {
  const html = page.replace('</head>', `${only}</head>`).replace('<script src="practice.js"></script>', `${s.before}<script src="practice.js"></script>${s.after}`);
  const file = path.join(tmp, `p${n}.html`);
  fs.writeFileSync(file, html);
  const png = path.join(tmp, `p${n}.png`);
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'ep01-chrome-'));
  run(chrome(), ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2', `--user-data-dir=${prof}`,
    '--allow-file-access-from-files', '--window-size=520,640', '--virtual-time-budget=1500', `--screenshot=${png}`, pathToFileURL(file).href]);
  // 위아래 여백만 잘라 카드만 남긴다(16px 여백 × 2배)
  run('ffmpeg', ['-v', 'error', '-y', '-i', png, '-vf', 'crop=iw-40:ih-40:20:20', '-c:v', 'libwebp', '-quality', '94', path.join(OUT, `practice-${n}.webp`)]);
  console.log(`만듦 practice-${n}.webp`);
}
