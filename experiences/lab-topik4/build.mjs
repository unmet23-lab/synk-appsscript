#!/usr/bin/env node
// SYNK LAB · TOPIK 4급 온라인 반 관심 등록 — 원고(src/)를 synk.im/lab/topik4/에 올릴 폴더(dist/lab/topik4/)로 조립한다.
// 사용: node experiences/lab-topik4/build.mjs
// 하는 일: app.css = 시그널(docs/마케팅/맞춤도구/core/signal.css) + page.css → 쓰인 한글만 남긴 SUIT ·
//          라틴 + 키릴(몽골어)을 남긴 Inter Tight · 라틴 DM Mono → 그림(펠트 물건·로고) → 링크 미리보기 og.png(Chrome) → 지문.
// 공개: node tools/공개.js 올리기 --원본 experiences/lab-topik4/dist lab/topik4 (README 「공개」).
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const SRC = path.join(HERE, 'src');
const OUT = path.join(HERE, 'dist/lab/topik4');
const ASSETS = path.join(OUT, 'assets');
const FONTS = path.join(REPO, 'docs/브랜드_폰트');
const SIGNAL = path.join(REPO, 'docs/마케팅/맞춤도구/core/signal.css');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));

// 그림: 원본 → 올릴 이름. 펠트 물건은 GPT 이미지 2.5로 코랄 판 한 장에 구워 바탕색 오리기로 오렸다(README 「그림」).
const ART = [
  ['src/art/topik4-art-cap.webp', 'topik4-art-cap.webp'],
  ['src/art/topik4-art-grid.webp', 'topik4-art-grid.webp'],
  ['src/art/topik4-art-list.webp', 'topik4-art-list.webp'],
  ['src/art/topik4-sample-class-poster.jpg', 'topik4-sample-class-poster.jpg'],
];
// 맛보기 수업 영상(10-23 최종본, 4분 · 약 20MB). 영상은 저장소 정책상 git에 넣지 않는다(tools/git-storage-policy.json) —
// 완성본 자리에서 dist로 복사하고, dist의 mp4는 .gitignore로 뺀다. 깨끗한 사본에서 빌드할 때는 SYNK_T4_VIDEO로 그 파일을 준다.
const VIDEO = process.env.SYNK_T4_VIDEO || path.join(REPO, 'docs/마케팅/LAB_TOPIK4맛보기수업_20261023/remotion/out/final/lesson-web.mp4');
const VIDEO_OUT = 'topik4-sample-class-20261023.mp4';
const COPIED = [
  [path.join(REPO, 'docs/마케팅/맞춤도구/assets/favicon-32.png'), 'favicon-32.png'],
];
const LOGO = path.join(REPO, 'docs/디자인/SNS키트/assets/logo-lab.webp');

const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
  if (r.status !== 0) throw new Error(`${path.basename(cmd)} 실패(${r.status}): ${(r.stderr || r.stdout || '').slice(0, 800)}`);
  return r;
};
const subset = (font, text, out) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-t4-'));
  const list = path.join(tmp, 'chars.txt');
  fs.writeFileSync(list, text, 'utf8');
  run('python', ['-m', 'fontTools.subset', font, `--text-file=${list}`, `--output-file=${out}`, '--flavor=woff2', '--layout-features=*', '--no-hinting']);
  fs.rmSync(tmp, { recursive: true, force: true });
};
const ascii = () => { let s = ''; for (let c = 0x20; c <= 0x7e; c += 1) s += String.fromCharCode(c); return s; };
const LATIN_EXTRA = '‘’“”·…→←↗×✓%₩°•–—«»№';
let CYRILLIC = '';
for (let c = 0x0400; c <= 0x04ff; c += 1) CYRILLIC += String.fromCharCode(c);

fs.rmSync(path.join(HERE, 'dist'), { recursive: true, force: true });
fs.mkdirSync(ASSETS, { recursive: true });

// 1) 글·코드·양식
for (const f of ['index.html', 'copy.js', 'app.js']) fs.copyFileSync(path.join(SRC, f), path.join(OUT, f));
fs.writeFileSync(path.join(OUT, 'app.css'), `${fs.readFileSync(SIGNAL, 'utf8')}\n${fs.readFileSync(path.join(SRC, 'page.css'), 'utf8')}`, 'utf8');

// 1-1) 캐시 토큰: 고친 판이 바로 보이게 css·js를 ?v=<내용 지문 12자>로 부른다(공개 도구가 다음 공개 때 이 토큰을 이어서 갈아 준다).
{
  const html = path.join(OUT, 'index.html');
  let s = fs.readFileSync(html, 'utf8');
  for (const f of ['app.css', 'copy.js', 'app.js']) {
    const v = sha(path.join(OUT, f)).slice(0, 12);
    const before = s;
    s = s.replace(new RegExp(`(["'])${f.replace('.', '\\.')}\\1`), `$1${f}?v=${v}$1`);
    if (s === before) throw new Error(`index.html에서 ${f} 참조를 찾지 못했어요`);
  }
  fs.writeFileSync(html, s, 'utf8');
}

// 2) 글꼴. 한글은 화면에 실제로 쓰인 글자만(빠지면 멈춤), Inter Tight는 라틴 + 키릴 전체(몽골어 Ө·Ү 포함).
const pageText = ['index.html', 'copy.js', 'app.js', 'og.html'].map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('');
const chars = new Set([...ascii(), ...LATIN_EXTRA, ...'「」']);
// \ud0a4\ub9b4\uc740 Inter Tight\uac00 \ub9e1\uace0(SUIT\uc5d0 \uc5c6\uc74c), \ub098\uba38\uc9c0 \uc544\uc2a4\ud0a4 \ubc16 \uae00\uc790(\ud55c\uae00\u00b7\u2460\u2461\u00b7\u300c\u300d \ub4f1)\ub294 \ubaa8\ub450 SUIT \uc11c\ube0c\uc14b\uc5d0 \ub123\ub294\ub2e4(Fable 10-21 \u2460\u2461 \ube60\uc9d0).
for (const ch of pageText) if (ch.codePointAt(0) > 0x7e && !/[\u0400-\u04ff]/.test(ch)) chars.add(ch);
const suitOut = path.join(ASSETS, 'SUIT-subset.woff2');
subset(path.join(FONTS, 'SUIT/SUIT-Variable.woff2'), [...chars].join(''), suitOut);
const miss = run('python', ['-c', 'import sys\nfrom fontTools.ttLib import TTFont\ncm=TTFont(sys.argv[1]).getBestCmap()\nt=open(sys.argv[2],encoding="utf-8").read()\nprint("".join(sorted({c for c in t if "\\uac00"<=c<="\\ud7a3" and ord(c) not in cm})))', suitOut, path.join(SRC, 'copy.js')]).stdout.trim();
if (miss) throw new Error(`SUIT 서브셋에 한글이 빠졌어요: ${miss}`);
const latinCyr = ascii() + LATIN_EXTRA + CYRILLIC;
for (const [src, out] of [['InterTight/InterTight-Regular.ttf', 'InterTight-400.woff2'], ['InterTight/InterTight-Medium.ttf', 'InterTight-500.woff2'], ['InterTight/InterTight-Bold.ttf', 'InterTight-700.woff2']]) subset(path.join(FONTS, src), latinCyr, path.join(ASSETS, out));
for (const [src, out] of [['DM_Mono/DMMono-Regular.ttf', 'DMMono-400.woff2'], ['DM_Mono/DMMono-Medium.ttf', 'DMMono-500.woff2']]) subset(path.join(FONTS, src), ascii() + LATIN_EXTRA, path.join(ASSETS, out));

// 3) 그림. 로고는 표시 크기의 2배(156×48)로 줄인다.
for (const [src, out] of ART) fs.copyFileSync(path.join(HERE, src), path.join(ASSETS, out));
for (const [src, out] of COPIED) fs.copyFileSync(src, path.join(ASSETS, out));
if (!fs.existsSync(VIDEO)) throw new Error(`맛보기 수업 영상이 없어요: ${VIDEO} — 만들기는 docs/마케팅/LAB_TOPIK4맛보기수업_20261023/remotion/본편.sh, 다른 자리면 SYNK_T4_VIDEO`);
fs.copyFileSync(VIDEO, path.join(ASSETS, VIDEO_OUT));
run('python', ['-I', '-c', 'import sys\nfrom PIL import Image\nim=Image.open(sys.argv[1]).convert("RGBA")\nim.thumbnail((156,48),Image.LANCZOS)\nim.save(sys.argv[2],"WEBP",lossless=True)', LOGO, path.join(ASSETS, 'logo-lab.webp')]);

// 4) 링크 미리보기: og.html을 dist에 잠깐 놓고 찍은 뒤 지운다(공개하지 않는다).
const og = path.join(OUT, 'og.html');
fs.copyFileSync(path.join(SRC, 'og.html'), og);
if (CHROME) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-chrome-'));
  try { run(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`, '--hide-scrollbars', '--virtual-time-budget=4000', '--window-size=1200,630', `--screenshot=${path.join(OUT, 'og.png')}`, pathToFileURL(og).href]); }
  finally { fs.rmSync(profile, { recursive: true, force: true }); }
} else console.warn('Chrome을 찾지 못해 og.png는 건너뜀');
fs.rmSync(og);

// 5) 지문 — 공개 뒤 라이브 바이트와 대조할 때 쓴다(공개하지 않는 폴더 밖 파일).
const files = [];
const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else files.push(p); } };
walk(OUT);
const manifest = Object.fromEntries(files.sort().map(f => [path.relative(OUT, f).replace(/\\/g, '/'), { bytes: fs.statSync(f).size, sha256: sha(f) }]));
fs.writeFileSync(path.join(HERE, 'dist/manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`lab/topik4: ${files.length}개 파일, 한글 ${[...chars].filter(c => /[\uac00-\ud7a3]/.test(c)).length}자, 합계 ${files.reduce((n, f) => n + fs.statSync(f).size, 0).toLocaleString()} 바이트`);
