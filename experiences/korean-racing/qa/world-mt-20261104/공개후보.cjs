'use strict';
// MT 바닷가 레이스 공개 후보를 만든다(2026-11-04). 커밋 둘(바탕 · 새 판)을 git archive로 꺼내 각각 tools/build-world-app-public.mjs로 빌드하고 world/ 차이를 센다.
// 공용 작업본에서 빌드하면 남의 미커밋이 실리므로 커밋 사본에서 빌드한다(현장 노트 배포 · 공개). git 밖 자산(구운 마을 · 옷감 · 메뉴 영상)은 공용 작업본에서 두 사본에 똑같이 넣는다.
//   node experiences/korean-racing/qa/world-mt-20261104/공개후보.cjs <바탕 커밋> <새 커밋> --설정 <world-config.json> [--밖 <폴더>]
//   --새판만이면 있는 base를 그대로 쓴다. 나가는 것: <밖>/base · <밖>/new (각각 world/ · manifest.json) + 차이.json. 그 뒤: node tools/공개.js 올리기 --원본 <밖>/new --공개폴더 ... --기준폴더 <밖>/base (미리 보기)
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { 공용작업본 } = require('../../../../tools/lib/공용작업본.js');
const ROOT = path.resolve(__dirname, '../../../..');
const args = process.argv.slice(2), opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const [baseRef, newRef] = args;
if (!baseRef || !newRef || !opt('--설정')) throw Error('사용법은 파일 머리글');
const OUT = path.resolve(opt('--밖') || path.join(공용작업본(ROOT), '.tmp', 'world-mt-20261104', '공개'));
const SHARED = 공용작업본(ROOT), CONFIG = path.resolve(opt('--설정'));
const PATHS = ['experiences/brand-opening', 'experiences/synk-world-app', 'experiences/hangul-stage', 'experiences/korean-runner', 'experiences/korean-rhythm', 'experiences/synk-world-home', 'experiences/synk-account', 'experiences/synk-town', 'experiences/play-common', 'experiences/korean-racing', 'experiences/order-rush', 'experiences/drama', 'experiences/topik-items', 'experiences/social-conversion.mjs', 'atlas', 'strata', 'tools', 'package.json'];
const OUTSIDE = ['experiences/synk-town/assets/district', 'experiences/synk-world-home/assets/avatar-textiles-v1', 'experiences/drama/pilot/media'];
const OUTSIDE_FILES = ['experiences/korean-racing/assets/coastal-rocks-v6.glb'];
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function build(name, ref) {
  const src = path.join(OUT, '_src_' + name), out = path.join(OUT, name);
  fs.rmSync(src, { recursive: true, force: true }); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(src, { recursive: true });
  const have = PATHS.filter((p) => { try { execFileSync('git', ['-C', ROOT, 'cat-file', '-e', `${ref}:${p}`], { stdio: 'ignore' }); return true; } catch { return false; } });
  const tar = path.join(OUT, `_${name}.tar`);
  execFileSync('git', ['-C', ROOT, '-c', 'core.autocrlf=false', 'archive', '--format=tar', '-o', tar, ref, ...have]);
  execFileSync('tar', ['-xf', path.relative(src, tar).replace(/\\/g, '/')], { cwd: src, stdio: 'inherit' });   // 절대 경로를 넘기면 GNU tar가 「C:」를 원격 주소로 읽는다
  fs.rmSync(tar);
  for (const to of OUTSIDE) { fs.mkdirSync(path.join(src, to), { recursive: true }); fs.cpSync(path.join(SHARED, to), path.join(src, to), { recursive: true, force: false }); }
  for (const f of fs.readdirSync(path.join(SHARED, 'experiences/brand-opening/assets')).filter((n) => /^world-menu-.*\.mp4$/.test(n))) if (!fs.existsSync(path.join(src, 'experiences/brand-opening/assets', f))) fs.copyFileSync(path.join(SHARED, 'experiences/brand-opening/assets', f), path.join(src, 'experiences/brand-opening/assets', f));
  for (const f of OUTSIDE_FILES) fs.copyFileSync(path.join(SHARED, f), path.join(src, f));
  fs.symlinkSync(path.join(SHARED, 'node_modules'), path.join(src, 'node_modules'), 'junction');
  // 남의 파일 주석의 도구 이름은 공개 빌드가 멈춘다 — 내 후보에 안 드는 파일이면 두 사본에 같은 고침만 넣고 원본은 그 세션 몫으로 남긴다(현장 노트 배포 · 공개).
  { const strings = path.join(src, 'experiences/drama/pilot/strings.mjs'), text = fs.readFileSync(strings, 'utf8'); fs.writeFileSync(strings, text.replace('역번역 → Fable → 아르곤 세 겹 확인', '세 겹 확인')); }
  const r = spawnSync(process.execPath, ['tools/build-world-app-public.mjs', '--config', CONFIG, '--out', '.tmp/out'], { cwd: src, encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) throw Error(`빌드 ${name} 실패: ${(r.stderr || r.stdout).slice(-1500)}`);
  { const j = JSON.parse(r.stdout.slice(r.stdout.indexOf('{'))); if (!j.ok) throw Error(`빌드 ${name} ok:false — 빠진 참조 ${JSON.stringify(j.missing).slice(0, 600)} · 도구 이름 ${JSON.stringify(j.publicToolNames).slice(0, 400)}`); console.log(name, ref, '파일', j.files, '크기', j.totalBytes); }
  fs.renameSync(path.join(src, '.tmp/out'), out);
  fs.unlinkSync(path.join(src, 'node_modules'));
  fs.rmSync(src, { recursive: true, force: true });
  return out;
}

fs.mkdirSync(OUT, { recursive: true });
const a = args.includes('--새판만') ? path.join(OUT, 'base') : build('base', baseRef), b = build('new', newRef);
const list = (root) => new Map(walk(path.join(root, 'world')).map((f) => [path.relative(path.join(root, 'world'), f).replace(/\\/g, '/'), f]));
const A = list(a), B = list(b), added = [], changed = [], removed = [];
for (const [rel, f] of B) { if (!A.has(rel)) added.push(rel); else if (sha(A.get(rel)) !== sha(f)) changed.push(rel); }
for (const rel of A.keys()) if (!B.has(rel)) removed.push(rel);
const report = { baseRef, newRef, files: B.size, added: added.length, changed, removed, bytesAdded: added.reduce((n, rel) => n + fs.statSync(B.get(rel)).size, 0), addedOutsideRacing: added.filter((rel) => !rel.startsWith('korean-racing/')) };
fs.writeFileSync(path.join(OUT, '차이.json'), JSON.stringify({ ...report, addedList: added }, null, 1) + '\n');
console.log(JSON.stringify(report, null, 1));
