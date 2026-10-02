#!/usr/bin/env node
// SYNK 맞춤 도구 빌드 — 원고(core/, <도구>/)를 synk.im에 올릴 폴더(dist/)로 조립한다.
// 사용: node docs/마케팅/맞춤도구/build.mjs [도구이름...]   (기본: 모든 도구)
// 하는 일: 공통 파일·Atlas 엔진 복사(app.css = 공통 양식 scrapbook.css + core/wizard.css) → 쓰인 글자만 남긴 SUIT 폰트
//          → 설명서 PDF·링크 미리보기 이미지(Chrome) → 지문 기록.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const FONT = path.join(REPO, 'docs/브랜드_폰트/SUIT/SUIT-Variable.woff2');
const ATLAS = path.join(REPO, 'atlas/engine.js');
// 공통 디자인 양식(펠트 스크랩북, 2026-09-29 사용자 확정). app.css 맨 앞에 붙인다.
const KIT_CSS = path.join(REPO, 'docs/디자인/펠트스크랩북/scrapbook.css');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));

// 도구 = 원고 폴더 이름 → 올릴 경로. assets는 공통 assets/에서 그 도구가 쓰는 것만,
// keep은 <도구>/keep/의 파일을 바이트 그대로 싣는다(이미 공개된 PDF·ZIP처럼 다른 작업이 만든 자료).
const STICKERS = ['sticker-check.webp', 'sticker-envelope.webp', 'sticker-person.webp', 'sticker-search.webp', 'sticker-time.webp', 'sticker-book.webp', 'sticker-adapt.webp'];
const SHARED_ASSETS = ['brand-shift.webp', 'thread-shift.webp', 'felt-paper.webp', 'favicon-32.png', ...STICKERS];
const TOOLS = {
  computer: { out: 'brief/computer', files: ['content.js', 'rules.js', 'view.js', 'index.html'], assets: [...SHARED_ASSETS, 'laptop-felt.webp'] },
  meeting: { out: 'brief/meeting', files: ['content.js', 'rules.js', 'view.js', 'index.html'], assets: [...SHARED_ASSETS, 'meeting-hero.webp'], keep: ['meeting-guide.pdf', 'meeting-kit.zip'] },
};

const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, ...opts });
  if (r.status !== 0) throw new Error(`${path.basename(cmd)} 실패(${r.status}): ${(r.stderr || r.stdout || '').slice(0, 800)}`);
  return r;
};

function subsetFont(textFiles, outFile) {
  const chars = new Set();
  for (let c = 0x20; c <= 0x7e; c += 1) chars.add(String.fromCharCode(c));
  for (const ch of '‘’“”·…→←–—×✓✔△✕₩%「」') chars.add(ch);
  for (const f of textFiles) for (const ch of fs.readFileSync(f, 'utf8')) if (ch.codePointAt(0) >= 0x20) chars.add(ch);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-font-'));
  const list = path.join(tmp, 'chars.txt');
  fs.writeFileSync(list, [...chars].join(''), 'utf8');
  run('python', ['-m', 'fontTools.subset', FONT, `--text-file=${list}`, `--output-file=${outFile}`, '--flavor=woff2', '--layout-features=*', '--no-hinting']);
  // 폰트에 원래 없는 글자(기호 몇 개)는 시스템 글꼴로 대체된다. 한글이 빠지면 빌드를 멈춘다.
  const check = run('python', ['-c', `import sys\nfrom fontTools.ttLib import TTFont\ncmap=TTFont(sys.argv[1]).getBestCmap()\ntext=open(sys.argv[2],encoding='utf-8').read()\nmiss=sorted({c for c in text if ord(c) not in cmap and not c.isspace()})\nprint(''.join(miss))`, outFile, list]);
  const missing = check.stdout.trim();
  const hangul = [...missing].filter(ch => /[\uac00-\ud7a3]/.test(ch));
  if (hangul.length) throw new Error(`서브셋 폰트에 한글이 빠졌어요: ${hangul.join('')}`);
  fs.rmSync(tmp, { recursive: true, force: true });
  return { chars: chars.size, missing };
}

// 브랜드 서체 규칙(DESIGN §3): 한글은 SUIT, 라틴은 Inter Tight, 숫자·코드는 DM Mono. 라틴 글자만 남긴 작은 파일을 만든다.
const BRAND_FONT_DIR = path.join(REPO, 'docs/브랜드_폰트');
const LATIN_FONTS = [
  ['InterTight/InterTight-Medium.ttf', 'InterTight-500.woff2'],
  ['InterTight/InterTight-Bold.ttf', 'InterTight-700.woff2'],
  ['DM_Mono/DMMono-Regular.ttf', 'DMMono-400.woff2'],
  ['DM_Mono/DMMono-Medium.ttf', 'DMMono-500.woff2'],
];
function subsetLatin(outDir) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-latin-'));
  const list = path.join(tmp, 'latin.txt');
  let text = '';
  for (let c = 0x20; c <= 0x7e; c += 1) text += String.fromCharCode(c);
  text += '‘’“”·…→←↗×✓%₩°•–—';
  fs.writeFileSync(list, text, 'utf8');
  for (const [src, out] of LATIN_FONTS) run('python', ['-m', 'fontTools.subset', path.join(BRAND_FONT_DIR, src), `--text-file=${list}`, `--output-file=${path.join(outDir, out)}`, '--flavor=woff2', '--layout-features=*', '--no-hinting']);
  fs.rmSync(tmp, { recursive: true, force: true });
}

function chrome(args) {
  if (!CHROME) { console.warn('  Chrome을 찾지 못해 PDF·이미지는 건너뜀'); return false; }
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-chrome-'));
  try { run(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`, '--hide-scrollbars', '--virtual-time-budget=4000', ...args]); }
  finally { fs.rmSync(profile, { recursive: true, force: true }); }
  return true;
}

const pick = process.argv.slice(2).filter(a => !a.startsWith('-'));
const names = pick.length ? pick : Object.keys(TOOLS);
for (const name of names) {
  const tool = TOOLS[name];
  if (!tool) throw new Error(`모르는 도구: ${name}`);
  const src = path.join(HERE, name);
  const out = path.join(HERE, 'dist', tool.out);
  // 제작 절차(제작절차.md): 탐색노트·추천기준이 있고, 질문·팁 은행이 검사를 통과해야 빌드한다.
  const require = createRequire(import.meta.url);
  const { checkContent } = require('./core/content-check.js');
  for (const doc of ['탐색노트.md', '추천기준.md']) if (!fs.existsSync(path.join(src, doc))) throw new Error(`${name}: ${doc}가 없어요. 제작절차.md의 사전 탐색부터 하세요.`);
  const problems = checkContent(require(path.join(src, 'content.js')));
  if (problems.length) throw new Error(`${name}: 제작 절차 검사에서 ${problems.length}곳이 빠졌어요.\n- ${problems.join('\n- ')}`);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(path.join(out, 'assets'), { recursive: true });
  for (const f of tool.files) fs.copyFileSync(path.join(src, f), path.join(out, f));
  fs.copyFileSync(path.join(HERE, 'core/wizard.js'), path.join(out, 'wizard.js'));
  // SYNK 계정에서 고른 설정 불러오기(누를 때만, 등록한 synk.im 주소에서만).
  fs.copyFileSync(path.join(HERE, 'core/account.js'), path.join(out, 'account.js'));
  // 화면 스타일 = 공통 양식 + 도구 틀. 양식이 앞에 와야 도구 틀이 필요한 곳만 덮는다.
  fs.writeFileSync(path.join(out, 'app.css'), `${fs.readFileSync(KIT_CSS, 'utf8')}\n${fs.readFileSync(path.join(HERE, 'core/wizard.css'), 'utf8')}`);
  fs.copyFileSync(ATLAS, path.join(out, 'atlas-engine.js'));
  for (const f of tool.assets || fs.readdirSync(path.join(HERE, 'assets'))) fs.copyFileSync(path.join(HERE, 'assets', f), path.join(out, 'assets', f));
  for (const f of tool.keep || []) fs.copyFileSync(path.join(src, 'keep', f), path.join(out, f));
  const font = subsetFont([...tool.files.map(f => path.join(src, f)), path.join(HERE, 'core/wizard.js'), path.join(HERE, 'core/account.js')], path.join(out, 'assets/SUIT-subset.woff2'));
  console.log(`${name}: 글자 ${font.chars}개로 폰트를 줄임${font.missing ? ` (폰트에 없어 시스템 글꼴로 보일 기호: ${font.missing})` : ''}`);
  subsetLatin(path.join(out, 'assets'));

  const guide = path.join(src, 'guide/guide.html');
  if (fs.existsSync(guide) && chrome(['--no-pdf-header-footer', `--print-to-pdf=${path.join(out, 'guide.pdf')}`, pathToFileURL(guide).href])) console.log(`${name}: 설명서 PDF 생성`);
  const og = path.join(src, 'guide/og.html');
  if (fs.existsSync(og) && chrome(['--window-size=1200,630', `--screenshot=${path.join(out, 'og.png')}`, pathToFileURL(og).href])) console.log(`${name}: 링크 미리보기 이미지 생성`);

  const manifest = {};
  const walk = dir => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else manifest[path.relative(out, p).replace(/\\/g, '/')] = { bytes: fs.statSync(p).size, sha256: sha(p) }; } };
  walk(out);
  fs.writeFileSync(path.join(HERE, 'dist', `${name}.manifest.json`), JSON.stringify({ tool: name, path: `/${tool.out}/`, builtAt: new Date().toISOString(), atlasEngineSha256: sha(ATLAS), files: manifest }, null, 1) + '\n');
  console.log(`${name}: ${Object.keys(manifest).length}개 파일 → dist/${tool.out}/`);
}
