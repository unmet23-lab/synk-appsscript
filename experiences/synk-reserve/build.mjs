// SYNK 사전예약 빌드 → dist/reserve/ · dist/lab/topik4/index.html
//   node experiences/synk-reserve/build.mjs
// 그림은 SYNK WORLD 서울행의 실제 화면 캡처(src/shots/<언어>/<장면>.webp, 11-24)다. 링크 미리보기(og.jpg)도 그 캡처로 굽는다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const SRC = path.join(HERE, 'src');
const DIST = path.join(HERE, 'dist');
const OUT = path.join(DIST, 'reserve');
const ASSETS = path.join(OUT, 'assets');
const FONTS = path.join(REPO, 'docs/브랜드_폰트');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));

const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, ...opts });
  if (r.status !== 0) throw new Error(`${path.basename(cmd)} 실패(${r.status}): ${(r.stderr || r.stdout || '').slice(0, 800)}`);
  return r;
};
const subset = (font, text, out) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-rsv-'));
  const list = path.join(tmp, 'chars.txt');
  fs.writeFileSync(list, text, 'utf8');
  run('python', ['-m', 'fontTools.subset', font, `--text-file=${list}`, `--output-file=${out}`, '--flavor=woff2', '--layout-features=*', '--no-hinting']);
  fs.rmSync(tmp, { recursive: true, force: true });
};
const ascii = () => { let s = ''; for (let c = 0x20; c <= 0x7e; c += 1) s += String.fromCharCode(c); return s; };
const EXTRA = '‘’“”«»·…→←×—–「」';
let CYRILLIC = '';
for (let c = 0x0400; c <= 0x04ff; c += 1) CYRILLIC += String.fromCharCode(c);

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(ASSETS, { recursive: true });

// 1) 글 · 코드 · 꼴. css · js는 ?v=<내용 지문 12자>로 부른다.
// 공용 작업본은 core.autocrlf라 원고가 CRLF일 수 있다 — 공개본과 같은 LF로 쓴다.
for (const f of ['index.html', 'copy.js', 'app.js', 'reserve.css']) fs.writeFileSync(path.join(OUT, f), fs.readFileSync(path.join(SRC, f), 'utf8').replace(/\r\n/g, '\n'), 'utf8');
{
  const html = path.join(OUT, 'index.html');
  let s = fs.readFileSync(html, 'utf8');
  for (const f of ['reserve.css', 'copy.js', 'app.js']) {
    const before = s;
    s = s.replace(new RegExp(`(["'])${f.replace('.', '\\.')}\\1`), `$1${f}?v=${sha(path.join(OUT, f)).slice(0, 12)}$1`);
    if (s === before) throw new Error(`index.html에서 ${f} 참조를 찾지 못했어요`);
  }
  fs.writeFileSync(html, s, 'utf8');
}
// 서울행 화면 캡처(언어마다 같은 장면 이름). copy.js의 SCENES와 타이틀이 모두 있어야 한다.
{
  const C = (await import(pathToFileURL(path.join(SRC, 'copy.js')).href)).default;
  const need = ['title', ...C.SCENES.map(s => s.id)];
  for (const lang of C.LANGS) {
    fs.mkdirSync(path.join(OUT, 'shots', lang), { recursive: true });
    for (const id of need) {
      const from = path.join(SRC, 'shots', lang, `${id}.webp`);
      if (!fs.existsSync(from)) throw new Error(`화면 캡처가 없어요: shots/${lang}/${id}.webp`);
      fs.copyFileSync(from, path.join(OUT, 'shots', lang, `${id}.webp`));
    }
  }
  // 첫 화면 바탕: SYNK WORLD 타이틀 무대 그림(experiences/brand-opening/assets의 world-title-concert-*-v2를 webp로 다시 저장한 판).
  fs.mkdirSync(path.join(OUT, 'art'), { recursive: true });
  for (const f of ['stage-land.webp', 'stage-port.webp']) fs.copyFileSync(path.join(SRC, 'art', f), path.join(OUT, 'art', f));
}

// 2) 글꼴. 키릴 밖 글자는 SUIT(빠진 한글이 있으면 멈춤), 몽골어 화면의 라틴 · 숫자 · 키릴은 Inter Tight 둘(500 · 700).
const pageText = ['index.html', 'copy.js', 'app.js', 'og.html'].map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('');
const chars = new Set([...ascii(), ...EXTRA]);
for (const ch of pageText) if (ch.codePointAt(0) > 0x7e && !/[\u0400-\u04ff]/.test(ch)) chars.add(ch);
const sans = path.join(ASSETS, 'reserve-sans.woff2');
subset(path.join(FONTS, 'SUIT/SUIT-Variable.woff2'), [...chars].join(''), sans);
const miss = run('python', ['-c', 'import sys\nfrom fontTools.ttLib import TTFont\ncm=TTFont(sys.argv[1]).getBestCmap()\nt=open(sys.argv[2],encoding="utf-8").read()\nprint("".join(sorted({c for c in t if "\\uac00"<=c<="\\ud7a3" and ord(c) not in cm})))', sans, path.join(SRC, 'copy.js')]).stdout.trim();
if (miss) throw new Error(`SUIT 서브셋에 한글이 빠졌어요: ${miss}`);
subset(path.join(FONTS, 'InterTight/InterTight-Regular.ttf'), ascii() + EXTRA + CYRILLIC, path.join(ASSETS, 'reserve-inter-400.woff2'));
subset(path.join(FONTS, 'InterTight/InterTight-Medium.ttf'), ascii() + EXTRA + CYRILLIC, path.join(ASSETS, 'reserve-inter-500.woff2'));
subset(path.join(FONTS, 'InterTight/InterTight-Bold.ttf'), ascii() + EXTRA + CYRILLIC, path.join(ASSETS, 'reserve-inter-700.woff2'));
// 장면 번호(01~06)만 DM Mono로 쓴다.
subset(path.join(FONTS, 'DM_Mono/DMMono-Medium.ttf'), '0123456789', path.join(ASSETS, 'reserve-mono.woff2'));

// 3) 철수한 TOPIK 4급 반 주소 → 사전예약으로 넘기는 쪽.
fs.mkdirSync(path.join(DIST, 'lab/topik4'), { recursive: true });
fs.writeFileSync(path.join(DIST, 'lab/topik4/index.html'), fs.readFileSync(path.join(SRC, 'lab-topik4.html'), 'utf8').replace(/\r\n/g, '\n'), 'utf8');

// 4) 링크 미리보기 og.jpg(1200×630). 한국어 타이틀 · 입국심사 캡처를 og.html 옆에 두고 찍는다.
if (CHROME) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-rsv-og-'));
  try {
    fs.mkdirSync(path.join(tmp, 'reserve/assets'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'reserve/shots/ko'), { recursive: true });
    for (const id of ['title', 'immigration']) fs.copyFileSync(path.join(SRC, 'shots/ko', `${id}.webp`), path.join(tmp, 'reserve/shots/ko', `${id}.webp`));
    fs.copyFileSync(sans, path.join(tmp, 'reserve/assets/reserve-sans.woff2'));
    fs.copyFileSync(path.join(SRC, 'og.html'), path.join(tmp, 'og.html'));
    const png = path.join(tmp, 'og.png');
    run(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${path.join(tmp, 'profile')}`, '--hide-scrollbars', '--virtual-time-budget=4000', '--window-size=1200,630', `--screenshot=${png}`, pathToFileURL(path.join(tmp, 'og.html')).href]);
    run('python', ['-I', '-c', 'import sys\nfrom PIL import Image\nim=Image.open(sys.argv[1]).convert("RGB")\nassert im.size==(1200,630),im.size\nim.save(sys.argv[2],"JPEG",quality=86,optimize=True,progressive=True)', png, path.join(OUT, 'og.jpg')]);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
} else throw new Error('Chrome을 찾지 못해 og.jpg를 굽지 못했어요');

// 5) 지문 — 공개 뒤 라이브 바이트와 대조할 때 쓴다.
const files = [];
const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else files.push(p); } };
walk(DIST);
const manifest = Object.fromEntries(files.sort().map(f => [path.relative(DIST, f).replace(/\\/g, '/'), { bytes: fs.statSync(f).size, sha256: sha(f) }]));
fs.writeFileSync(path.join(DIST, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`synk-reserve: ${files.length}개 파일, 한글 ${[...chars].filter(c => /[\uac00-\ud7a3]/.test(c)).length}자, 합계 ${files.reduce((n, f) => n + fs.statSync(f).size, 0).toLocaleString()} 바이트`);
