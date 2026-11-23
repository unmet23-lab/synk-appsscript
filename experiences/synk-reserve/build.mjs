// SYNK 사전예약 빌드 → dist/reserve/ · dist/lab/topik4/index.html
//   node experiences/synk-reserve/build.mjs
// 그림은 공개본에 이미 있는 synk.im 새 홈 그림(/assets/v11/town-road.webp)을 쓴다. 링크 미리보기(og.jpg)는 그 그림을
// 공개본 git(SYNK_PUBLISH_GIT, 기본 ~/Documents/synk-vendor/synk-policy-publish.git의 origin/main)에서 꺼내 굽는다.
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
const PUBLISH_GIT = process.env.SYNK_PUBLISH_GIT || path.join(os.homedir(), 'Documents/synk-vendor/synk-policy-publish.git');
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
const EXTRA = '‘’“”·…→←×—–「」';
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

// 2) 글꼴. 키릴 밖 글자는 SUIT(빠진 한글이 있으면 멈춤), 몽골어 화면의 라틴 · 숫자 · 키릴은 Inter Tight 둘(500 · 700).
const pageText = ['index.html', 'copy.js', 'app.js', 'og.html'].map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('');
const chars = new Set([...ascii(), ...EXTRA]);
for (const ch of pageText) if (ch.codePointAt(0) > 0x7e && !/[\u0400-\u04ff]/.test(ch)) chars.add(ch);
const sans = path.join(ASSETS, 'reserve-sans.woff2');
subset(path.join(FONTS, 'SUIT/SUIT-Variable.woff2'), [...chars].join(''), sans);
const miss = run('python', ['-c', 'import sys\nfrom fontTools.ttLib import TTFont\ncm=TTFont(sys.argv[1]).getBestCmap()\nt=open(sys.argv[2],encoding="utf-8").read()\nprint("".join(sorted({c for c in t if "\\uac00"<=c<="\\ud7a3" and ord(c) not in cm})))', sans, path.join(SRC, 'copy.js')]).stdout.trim();
if (miss) throw new Error(`SUIT 서브셋에 한글이 빠졌어요: ${miss}`);
subset(path.join(FONTS, 'InterTight/InterTight-Medium.ttf'), ascii() + EXTRA + CYRILLIC, path.join(ASSETS, 'reserve-inter-500.woff2'));
subset(path.join(FONTS, 'InterTight/InterTight-Bold.ttf'), ascii() + EXTRA + CYRILLIC, path.join(ASSETS, 'reserve-inter-700.woff2'));

// 3) 철수한 TOPIK 4급 반 주소 → 사전예약으로 넘기는 쪽.
fs.mkdirSync(path.join(DIST, 'lab/topik4'), { recursive: true });
fs.writeFileSync(path.join(DIST, 'lab/topik4/index.html'), fs.readFileSync(path.join(SRC, 'lab-topik4.html'), 'utf8').replace(/\r\n/g, '\n'), 'utf8');

// 4) 링크 미리보기 og.jpg(1200×630). 공개본의 town-road.webp를 꺼내 og.html 옆에 두고 찍는다.
if (CHROME) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-rsv-og-'));
  try {
    const img = run('git', ['--git-dir', PUBLISH_GIT, 'show', 'origin/main:assets/v11/town-road.webp'], { encoding: 'buffer', maxBuffer: 1 << 24 }).stdout;
    fs.writeFileSync(path.join(tmp, 'town-road.webp'), img);
    fs.mkdirSync(path.join(tmp, 'reserve/assets'), { recursive: true });
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
