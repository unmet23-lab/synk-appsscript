'use strict';
// Atlas 재설계 단계 0의 관문 — 「공개본 동작이 한 글자도 안 바뀐다」를 공개 빌드 산출물로 대조한다(2026-11-10).
// 커밋을 git archive로 꺼내 같은 설정으로 WORLD 공개 빌드(tools/build-world-app-public.mjs)를 돌리고, 내보낸 파일 목록 · 파일마다
// sha256 · 빠진 참조 · 도구 이름 판정을 적어 둔다. 두 커밋의 기록을 견주면 무엇이 달라졌는지가 파일 단위로 나온다.
// git 밖 자산(구운 마을 · 옷감 · 드라마 재생 사본 · 랠리 영상 · 바위 모델 · 메뉴 영상)은 공용 작업본에서 복사한다 — 링크하지 않는다.
//   빌드:  node docs/_ops/qa/atlas-redesign-20261110/단계0/공개대조.cjs 빌드 <커밋> --설정 <world-config.json> --밖 <폴더>
//   견줌:  node docs/_ops/qa/atlas-redesign-20261110/단계0/공개대조.cjs 견줌 <앞.json> <뒤.json>
// 빌드는 <밖>/<커밋 앞 12자>.json에 기록을 남기고 꺼낸 소스는 지운다. 견줌은 다른 것이 있으면 끝 코드 1이다.
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { 공용작업본 } = require('../../../../../tools/lib/공용작업본.js');

const ROOT = path.resolve(__dirname, '../../../../..');
const SHARED = 공용작업본(ROOT);
// 말 랠리 · 환승 공개 후보(experiences/talk-rally/qa/world-campus-20261104/공개후보.cjs)와 같은 꺼낼 목록 · git 밖 자산.
const PATHS = ['experiences/brand-opening', 'experiences/synk-world-app', 'experiences/hangul-stage', 'experiences/korean-runner',
  'experiences/korean-rhythm', 'experiences/synk-world-home', 'experiences/synk-account', 'experiences/synk-town', 'experiences/play-common',
  'experiences/korean-racing', 'experiences/order-rush', 'experiences/blank-slice', 'experiences/snap-words', 'experiences/talk-rally',
  'experiences/drama', 'experiences/topik-items', 'experiences/social-conversion.mjs', 'atlas', 'strata', 'tools', 'package.json'];
const OUTSIDE_DIRS = ['experiences/synk-town/assets/district', 'experiences/synk-world-home/assets/avatar-textiles-v1',
  'experiences/drama/pilot/media', 'experiences/talk-rally/assets/world/cast/taeo/clips'];
const OUTSIDE_FILES = ['experiences/korean-racing/assets/coastal-rocks-v6.glb'];
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const git = (...args) => execFileSync('git', ['-C', ROOT, ...args], { maxBuffer: 1 << 28 });

function build(ref, config, outDir) {
  const commit = git('rev-parse', `${ref}^{commit}`).toString().trim();
  const work = path.join(outDir, `src-${commit.slice(0, 12)}`);
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });
  const tool = git('show', `${commit}:tools/build-world-app-public.mjs`).toString('utf8');
  const used = [...tool.matchAll(/experiences(?:'\s*,\s*'|\/)([a-z0-9-]+)/g)].map(m => `experiences/${m[1]}`);
  const exists = p => spawnSync('git', ['-C', ROOT, 'cat-file', '-e', `${commit}:${p}`]).status === 0;
  const have = [...new Set([...PATHS, ...used])].filter(exists);
  const tar = path.join(work, '_src.tar');
  git('-c', 'core.autocrlf=false', 'archive', '--format=tar', '-o', tar, commit, ...have);
  // 절대 경로를 넘기면 GNU tar가 「C:」를 원격 주소로 읽는다 — 꺼낼 폴더 안에서 상대 이름으로 푼다.
  execFileSync('tar', ['-xf', '_src.tar'], { cwd: work, stdio: 'inherit' });
  fs.rmSync(tar);
  for (const dir of OUTSIDE_DIRS) {
    fs.mkdirSync(path.join(work, dir), { recursive: true });
    fs.cpSync(path.join(SHARED, dir), path.join(work, dir), { recursive: true, force: false });
  }
  for (const file of OUTSIDE_FILES) fs.copyFileSync(path.join(SHARED, file), path.join(work, file));
  const menu = 'experiences/brand-opening/assets';
  for (const name of fs.readdirSync(path.join(SHARED, menu)).filter(n => /^world-menu-.*\.mp4$/.test(n))) {
    if (!fs.existsSync(path.join(work, menu, name))) fs.copyFileSync(path.join(SHARED, menu, name), path.join(work, menu, name));
  }
  const run = spawnSync(process.execPath, ['tools/build-world-app-public.mjs', '--config', path.resolve(config), '--out', '.tmp/out'],
    { cwd: work, encoding: 'utf8', maxBuffer: 1 << 28 });
  const manifestPath = path.join(work, '.tmp/out/manifest.json');
  if (!fs.existsSync(manifestPath)) throw Error(`빌드 실패(${commit.slice(0, 12)}): ${(run.stderr || run.stdout).slice(-1500)}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const payload = path.join(work, '.tmp/out/world');
  // 기록은 산출물(파일과 바이트)과 판정만 남긴다. 만든 시각 · 꺼낸 폴더 같은 실행마다 다른 값은 뺀다.
  const files = manifest.files.map(f => ({ path: f.path, bytes: f.bytes, sha256: sha(path.join(payload, f.path)) }));
  const record = { commit, config: path.basename(config), ok: manifest.ok, fileCount: files.length,
    totalBytes: manifest.totalBytes, referenceCount: manifest.referenceCount, missing: manifest.missing,
    publicToolNames: manifest.publicToolNames, sourceChanges: manifest.sourceChanges, files };
  const file = path.join(outDir, `${commit.slice(0, 12)}.json`);
  fs.writeFileSync(file, JSON.stringify(record, null, 1) + '\n');
  fs.rmSync(work, { recursive: true, force: true });
  console.log(JSON.stringify({ commit, ok: record.ok, files: record.fileCount, totalBytes: record.totalBytes,
    missing: record.missing.length, publicToolNames: record.publicToolNames.length, record: file }));
}

function compare(beforeFile, afterFile) {
  const [a, b] = [beforeFile, afterFile].map(f => JSON.parse(fs.readFileSync(f, 'utf8')));
  const byPath = list => new Map(list.map(f => [f.path, f]));
  const fa = byPath(a.files), fb = byPath(b.files);
  const added = [...fb.keys()].filter(p => !fa.has(p));
  const removed = [...fa.keys()].filter(p => !fb.has(p));
  const changed = [...fb.keys()].filter(p => fa.has(p) && fa.get(p).sha256 !== fb.get(p).sha256);
  const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
  const verdict = { before: a.commit, after: b.commit, files: [a.fileCount, b.fileCount], added, removed, changed,
    missingSame: same(a.missing, b.missing), publicToolNamesSame: same(a.publicToolNames, b.publicToolNames),
    sourceChangesSame: same(a.sourceChanges, b.sourceChanges), okSame: a.ok === b.ok,
    referenceCount: [a.referenceCount, b.referenceCount], referenceCountSame: a.referenceCount === b.referenceCount };
  // 같다는 것은 산출물(파일 · 바이트)과 판정(빠진 참조 · 도구 이름 · 원천 변경 · ok · 참조 수) 모두가 같다는 뜻이다.
  verdict.identical = !added.length && !removed.length && !changed.length && a.fileCount === b.fileCount
    && verdict.missingSame && verdict.publicToolNamesSame && verdict.sourceChangesSame && verdict.okSame && verdict.referenceCountSame;
  console.log(JSON.stringify(verdict, null, 1));
  if (!verdict.identical) process.exitCode = 1;
}

const [mode, ...rest] = process.argv.slice(2);
const opt = name => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : null; };
if (mode === '빌드' && rest[0] && opt('--설정') && opt('--밖')) build(rest[0], opt('--설정'), path.resolve(opt('--밖')));
else if (mode === '견줌' && rest.length === 2) compare(rest[0], rest[1]);
else throw Error('사용법은 파일 머리글');
