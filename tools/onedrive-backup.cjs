#!/usr/bin/env node
'use strict';
// 문서·소스만 갱신하며 기존 사본/원본을 삭제하지 않는다. 네트워크 인증을 직접 다루지 않는다.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const policy = require('./이어하기꾸러미.js');
const readCache = require('./onedrive-read-cache.cjs');
const { preserveSafeMarkdown } = require('./onedrive-safe-markdown.cjs');
const { replaceFile } = require('./GitHub백업.cjs');
const ROOT = path.resolve(__dirname, '..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const readJson = (file, fallback = null) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
};
// 감시 도구·백신이 영수증을 여는 순간 Windows는 이름 바꾸기를 EPERM·EACCES·EBUSY로 잠깐 거절한다.
// 영수증·색인 교체는 GitHub백업.cjs의 replaceFile(그 세 오류만 최대 20번, 약 9.5초 기다리며 다시)을 같이 쓴다(10-19).
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = file + '.' + process.pid + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(value));
  replaceFile(temp, file);
}
const statOrNull = file => {
  try { return fs.lstatSync(file, { bigint: true }); }
  catch (error) { if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null; throw error; }
};
// 읽기 전후 내용이 그대로였는지(크기·수정 시각) 본다. bigint stat끼리 비교한다.
const sameContentStat = (a, b) => a.size === b.size && a.mtimeNs === b.mtimeNs;
// 내가 쓴 색인 파일이 그대로면(stat가 읽기 기록과 같으면) 다시 읽지 않고 내용 지문만 비교한다(10-19).
// 다르거나 기록이 없으면 예전처럼 읽어 비교하고, 바뀐 것만 쓴다. tags는 그 파일에 덧붙여 둘 파생 지문이다.
function writeChangedIndex(file, content, { cache = null, tags = {} } = {}) {
  const contentHash = hash(JSON.stringify(content));
  const before = cache ? statOrNull(file) : null;
  if (before && cache.tagged(file, before, 'content') === contentHash &&
    Object.entries(tags).every(([name, value]) => cache.tagged(file, before, name) === value)) return false;
  let raw = null;
  try { raw = fs.readFileSync(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const { changedAt: ignored, ...oldContent } = raw ? JSON.parse(raw.toString('utf8').replace(/^\uFEFF/, '')) : {};
  let changed = false;
  if (JSON.stringify(oldContent) !== JSON.stringify(content)) {
    raw = Buffer.from(JSON.stringify({ ...content, changedAt: new Date().toISOString() }));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temp = file + '.' + process.pid + '.tmp';
    fs.writeFileSync(temp, raw); replaceFile(temp, file);
    changed = true;
  }
  if (cache) {
    const after = statOrNull(file);
    if (after && (changed || (before && sameContentStat(before, after))))
      cache.remember(file, after, after, hash(raw), raw.length, undefined, undefined, { tags: { content: contentHash, ...tags } });
  }
  return changed;
}
function worktrees(root) {
  const found = [];
  for (const scope of policy.systemScopes(root).filter(scope => scope.mode === 'repository')) {
    if (!fs.existsSync(scope.root)) continue;
    const data = execFileSync('git', ['--no-optional-locks', 'worktree', 'list', '--porcelain', '-z'],
      { cwd: scope.root, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 8 << 20 });
    for (const field of data.split('\0').filter(value => value.startsWith('worktree '))) {
      const directory = path.resolve(field.slice(9));
      if (directory.toLowerCase() !== path.resolve(scope.root).toLowerCase() && fs.existsSync(directory))
        found.push({ repository: scope.name, primary: scope.root, root: directory });
    }
  }
  return found;
}
// 본진과 다를 수 있는 작업트리 소스. 「본진 HEAD↔작업트리 HEAD」 트리 비교(파일을 걷지 않는다)와 git status 한 번
// (수정·추적 안 된 파일을 한 번 걸으며 내용까지 확인)을 합친다. 본진 HEAD와 내용이 다른 경로는 둘 중 한쪽에 반드시 든다.
// 예전 `diff --name-only 본진HEAD`+`ls-files --others`는 작업트리를 두 번 걸었고, 내용은 같고 stat만 다른 파일도 섞였다
// (10-19 전체 63개 작업트리 대조: 예전에만 있던 57개는 모두 내용 같음). mainHead를 주면 본진 HEAD를 다시 묻지 않는다.
const gitArgs = tree => ({ cwd: tree.root, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 << 20 });
// 본진 HEAD와 작업트리 HEAD 사이에 바뀐 경로(커밋 트리끼리 비교라 작업트리 파일을 걷지 않는다).
const committedPaths = (tree, mainHead) =>
  execFileSync('git', ['--no-optional-locks', 'diff', '--name-only', '-z', mainHead, 'HEAD', '--'], gitArgs(tree)).split('\0').filter(Boolean);
// 작업트리의 수정·추적 안 된 파일(작업트리를 한 번 걸으며 내용까지 확인한다).
const statusPaths = tree =>
  execFileSync('git', ['--no-optional-locks', 'status', '--porcelain=v1', '-z', '--no-renames', '--untracked-files=all', '--ignore-submodules=all'], gitArgs(tree))
    .split('\0').filter(Boolean).map(entry => entry.slice(3));
const keepSources = (tree, list) => [...new Set(list)].filter(relative => relative && !/\.md$/i.test(relative) &&
  policy.문서인가(relative) && !policy.금지인가(relative) && !policy.excludedPath(relative) &&
  fs.existsSync(path.join(tree.root, relative)));
function changedWorktreeSources(tree, { mainHead } = {}) {
  mainHead ||= execFileSync('git', ['--no-optional-locks', 'rev-parse', 'HEAD'], { ...gitArgs(tree), cwd: tree.primary }).trim();
  return keepSources(tree, [...committedPaths(tree, mainHead), ...statusPaths(tree)]);
}
// 작업트리·본진 문서의 SHA와 분류. 읽기 기록(stat 동일)이 있으면 읽지 않는다.
function primaryHashOf(row, linked, cache) {
  if (linked(row.primaryPath)) return null;
  const stat = statOrNull(row.primaryPath);
  if (!stat || !stat.isFile() || stat.size > BigInt(policy.MAX_TEXT_BYTES)) return null;
  const known = cache && cache.lookup(row.primaryPath, stat, row.relativePath);
  if (known) return known.reason ? null : known.sha256;
  const data = fs.readFileSync(row.primaryPath), info = {};
  const reason = policy.textPolicy(row.relativePath, data, info), sha256 = hash(data), after = statOrNull(row.primaryPath);
  if (cache && after) cache.remember(row.primaryPath, stat, after, sha256, data.length, row.relativePath, reason, info);
  return reason ? null : sha256;
}
// 이 실행에서 원문을 읽지 않은(기록으로 넘긴) 문서를 새로 보존해야 할 때 읽는다. 기록과 다르면 이번 실행은 실패로 두고 기록만 고친다.
function readRemembered(row, stat, sha256, cache) {
  const data = fs.readFileSync(row.source), after = statOrNull(row.source), digest = hash(data), info = {};
  if (cache && after) cache.remember(row.source, stat, after, digest, data.length, row.relativePath, policy.textPolicy(row.relativePath, data, info), info);
  if (!after || !sameContentStat(stat, after) || digest !== sha256) throw new Error('worktree-source-changed-during-read');
  return data;
}
// 보존 사본 SHA 접두사별 원래 경로 묶음. 이번에 확인할 경로들이 지난번에 확인한 그대로이고 파일도 그대로면 열지 않는다.
function ensureIdentities(file, group, cache) {
  const wanted = hash(JSON.stringify(group.map(entry => [entry.preservedFile, entry.repository, entry.relativePath]).sort()));
  const stat = cache ? statOrNull(file) : null;
  if (stat && cache.tagged(file, stat, 'ensured') === wanted) return false;
  const identities = readJson(file, { files: {} }).files;
  for (const entry of group) {
    const paths = identities[entry.preservedFile] || (identities[entry.preservedFile] = []);
    if (!paths.some(row => row.repository === entry.repository && row.relativePath === entry.relativePath))
      paths.push({ repository: entry.repository, relativePath: entry.relativePath });
  }
  return writeChangedIndex(file, { files: identities }, { cache, tags: { ensured: wanted } });
}
// 모든 작업트리를 pwsh 한 번으로 나열한다(파일을 열지 않음). 실패하면 null을 돌려 예전처럼 작업트리마다 걷고 git을 돌린다.
function scanWorktrees(trees) {
  if (process.platform !== 'win32' || !trees.length) return null;
  try {
    const output = execFileSync('pwsh.exe', ['-NoProfile', '-NonInteractive', '-File', path.join(__dirname, 'onedrive-worktree-scan.ps1')],
      { input: JSON.stringify({ roots: trees.map(tree => tree.root), skip: policy.GENERATED_DIRECTORY.source }), encoding: 'utf8', windowsHide: true, maxBuffer: 256 << 20 });
    return new Map(JSON.parse(output.replace(/^\uFEFF/, '')).filter(scan => !scan.error && /^[a-f0-9]{64}$/.test(scan.fingerprint) && Array.isArray(scan.md))
      .map(scan => [scan.root, scan]));
  } catch { return null; }
}
// 나열의 MD 중 workTextFiles가 들어가지 않는 폴더('worktrees', 자격증명 이름 폴더) 아래 것은 뺀다. 생성물 폴더는 나열이 이미 건너뛴다.
function markdownFromScan(list) {
  return list.filter(relative => {
    const parts = relative.split('/');
    parts.pop();
    let prefix = '';
    for (const part of parts) {
      prefix = prefix ? prefix + '/' + part : part;
      if (part === 'worktrees' || policy.금지인가(prefix + '/문서.md')) return false;
    }
    return true;
  });
}
// 작업트리 git 결과를 다시 쓸 수 있는지 가르는 입력. status는 git이 보는 작업트리 상태(파일 크기·수정 시각, HEAD 커밋, 색인,
// 제외 규칙·설정)만, committed는 본진 HEAD와 작업트리 HEAD 쌍, sources는 둘과 분류 규칙 지문을 묶는다.
// 본진 master는 몇 분마다 움직이므로(10-19 두 시간에 38번) 그때는 싼 트리 비교만 다시 하고 작업트리를 걷는 status는 다시 쓴다.
// 읽을 수 없는 것이 있으면 null(그 작업트리는 git을 모두 돌린다).
function worktreeKeys(tree, scan, mainHead, memo) {
  const status = worktreeStatusKey(tree, scan, memo);
  if (!status) return null;
  const committed = mainHead + ' ' + status.commit;
  return { status: status.key, committed, sources: hash(JSON.stringify([status.key, committed, policy.POLICY_FINGERPRINT])) };
}
function worktreeStatusKey(tree, scan, memo) {
  try {
    const dotGit = path.join(tree.root, '.git');
    const pointer = fs.readFileSync(dotGit, 'utf8').match(/^gitdir:\s*(.+?)\s*$/m);
    if (!pointer) return null;
    const gitDir = path.resolve(tree.root, pointer[1]);
    const commonDir = path.resolve(gitDir, fs.readFileSync(path.join(gitDir, 'commondir'), 'utf8').trim());
    const head = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim(), ref = head.match(/^ref:\s*(refs\/\S+)$/);
    let commit = ref ? null : head;
    if (ref) {
      try { commit = fs.readFileSync(path.join(commonDir, ref[1]), 'utf8').trim(); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (!commit) {
        if (!memo.has(commonDir)) {
          let packed = '';
          try { packed = fs.readFileSync(path.join(commonDir, 'packed-refs'), 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
          memo.set(commonDir, new Map(packed.split(/\r?\n/).map(line => line.match(/^([0-9a-f]{40,64}) (refs\/\S+)$/)).filter(Boolean).map(m => [m[2], m[1]])));
        }
        commit = memo.get(commonDir).get(ref[1]) || null;
      }
    }
    if (!commit || !/^[0-9a-f]{40,64}$/.test(commit)) return null;
    const home = require('node:os').homedir();
    const stats = [path.join(gitDir, 'index'), path.join(gitDir, 'config.worktree'), path.join(commonDir, 'config'), path.join(commonDir, 'info', 'exclude'),
      path.join(home, '.gitconfig'), path.join(home, '.config', 'git', 'ignore')].map(file => {
      const stat = statOrNull(file);
      return stat ? [String(stat.size), String(stat.mtimeNs)] : null;
    });
    return { commit, key: hash(JSON.stringify([scan.fingerprint, scan.files, commit, stats])) };
  } catch { return null; }
}
const WORKTREE_ENTRIES = Symbol('worktree-entries');
// onProgress: 오래 걸리는 단계 안에서도 실행 영수증의 heartbeat를 남기게 한다(통합 감시는 15분 넘게 멈춘 heartbeat를 실행 중단으로 본다, 10-19).
// cache: 읽기 기록(onedrive-read-cache.cjs). 없으면 예전처럼 모든 문서를 읽는다.
function preserveWorktreeDocuments(root, vault, { dryRun = false, trees = worktrees(root), onProgress = () => {}, cache = null } = {}) {
  const destination = path.join(vault, '작업문서_미통합_자동');
  // 단계 안 세부 시간(ms). 부하 속에서 어디가 밀리는지 영수증으로 본다(10-19).
  const timings = { walkMs: 0, gitMs: 0 }, mainHeads = new Map(), gitState = new Map();
  let mark = Date.now(), gitTrees = 0, reusedTrees = 0, statusRuns = 0, diffRuns = 0;
  const lap = name => { const now = Date.now(); timings[name] = (timings[name] || 0) + now - mark; mark = now; };
  const scans = cache ? scanWorktrees(trees) : null;
  lap('scanMs');
  const candidates = trees.flatMap(tree => {
    const scan = scans?.get(tree.root);
    const md = scan ? markdownFromScan(scan.md) : policy.workTextFiles(tree.root);
    lap('walkMs');
    let sources = tree.changedSources;
    if (!sources) {
      if (!mainHeads.has(tree.primary)) mainHeads.set(tree.primary,
        execFileSync('git', ['--no-optional-locks', 'rev-parse', 'HEAD'], { cwd: tree.primary, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim());
      const mainHead = mainHeads.get(tree.primary);
      // 작업트리 전체 지문·HEAD·색인·설정과 본진 HEAD·분류 규칙이 지난번과 같으면 지난번 결과를 쓴다. 작업트리가 그대로이고
      // 본진 HEAD만 움직였으면 트리 비교만 다시 한다. 하루 한 바퀴(1/48)는 git을 모두 다시 돌린다.
      const keys = scan ? worktreeKeys(tree, scan, mainHead, gitState) : null, trusted = keys && !cache.inSlot(tree.root);
      sources = trusted ? cache.memo('worktree-sources:' + tree.root, keys.sources) : null;
      if (sources) reusedTrees++;
      else {
        gitTrees++;
        let status = trusted ? cache.memo('worktree-status:' + tree.root, keys.status) : null;
        if (!status) { status = statusPaths(tree); statusRuns++; }
        let committed = trusted ? cache.memo('worktree-committed:' + tree.root, keys.committed) : null;
        if (!committed) { committed = committedPaths(tree, mainHead); diffRuns++; }
        sources = keepSources(tree, [...committed, ...status]);
        if (keys) {
          cache.setMemo('worktree-status:' + tree.root, keys.status, status);
          cache.setMemo('worktree-committed:' + tree.root, keys.committed, committed);
          cache.setMemo('worktree-sources:' + tree.root, keys.sources, sources);
        }
      }
    }
    lap('gitMs');
    const rows = [...new Set([...md, ...sources])].map(relativePath =>
      ({ ...tree, relativePath, source: path.join(tree.root, relativePath), primaryPath: path.join(tree.primary, relativePath) }));
    onProgress();
    return rows;
  });
  const linked = policy.linkPaths(candidates.flatMap(row => [row.source, row.primaryPath]));
  const filesDirectory = path.join(destination, 'files');
  if (policy.linkPaths([filesDirectory])(filesDirectory)) throw new Error('worktree preservation destination is linked');
  lap('linkMs');
  const entries = [], rejected = [], primaryHashes = new Map(), unique = new Set(), checkedPreserved = new Set();
  let written = 0, sameAsPrimary = 0, preservedBytes = 0, sourceFiles = 0, readFiles = 0;
  const reject = (row, reason) => rejected.push({ repository: row.repository, worktree: row.root, relativePath: row.relativePath, reason });
  for (const row of candidates) {
    onProgress();
    let reason = linked(row.source) ? 'link-or-reparse-point' : null;
    try {
      const stat = fs.statSync(row.source, { bigint: true });
      if (!stat.isFile()) reason = 'not-regular-file';
      else if (stat.size > BigInt(policy.MAX_TEXT_BYTES)) reason = 'over-10MiB';
      if (reason) { reject(row, reason); continue; }
      // 지난 실행에서 읽어 확인한 그대로면(stat 동일) 다시 읽지 않는다. 아니면 예전처럼 읽고 분류한다.
      const known = cache && cache.lookup(row.source, stat, row.relativePath);
      let data = null, sha256, bytes;
      if (known) ({ reason, sha256, bytes } = known);
      else {
        data = fs.readFileSync(row.source); readFiles++;
        const info = {};
        reason = policy.textPolicy(row.relativePath, data, info);
        const after = fs.statSync(row.source, { bigint: true });
        sha256 = hash(data); bytes = data.length;
        if (cache) cache.remember(row.source, stat, after, sha256, bytes, row.relativePath, reason, info);
        if (!reason && !sameContentStat(stat, after)) throw new Error('worktree-source-changed-during-read');
      }
      if (reason) { reject(row, reason); continue; }
      if (!primaryHashes.has(row.primaryPath)) primaryHashes.set(row.primaryPath, primaryHashOf(row, linked, cache));
      const matchesPrimary = primaryHashes.get(row.primaryPath) === sha256;
      const extension = path.extname(row.relativePath).toLowerCase() || '.txt';
      const preservedFile = matchesPrimary ? null : 'files/' + sha256 + extension;
      if (!/\.md$/i.test(row.relativePath)) sourceFiles++;
      if (matchesPrimary) sameAsPrimary++;
      else {
        if (!unique.has(preservedFile)) preservedBytes += bytes;
        unique.add(preservedFile);
        // 같은 보존 사본은 한 실행에서 한 번만 확인한다. 사본의 stat가 확인 기록과 같으면 다시 읽지 않는다.
        if (!dryRun && !checkedPreserved.has(preservedFile)) {
          const target = path.join(destination, preservedFile), targetStat = statOrNull(target);
          if (targetStat) {
            if (targetStat.isSymbolicLink()) throw new Error('preserved-worktree-is-link');
            let targetSha = cache && cache.lookup(target, targetStat)?.sha256;
            if (!targetSha) {
              const targetData = fs.readFileSync(target);
              targetSha = hash(targetData);
              const targetAfter = statOrNull(target);
              if (cache && targetAfter) cache.remember(target, targetStat, targetAfter, targetSha, targetData.length);
            }
            if (targetSha !== sha256) throw new Error('preserved-worktree-hash-mismatch');
          } else {
            data ||= readRemembered(row, stat, sha256, cache);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, data, { flag: 'wx' });
            const check = fs.readFileSync(target);
            if (hash(check) !== sha256) throw new Error('preserved-worktree-write-mismatch');
            const writtenStat = statOrNull(target);
            if (cache && writtenStat) cache.remember(target, writtenStat, writtenStat, sha256, check.length);
            written++;
          }
          checkedPreserved.add(preservedFile);
        }
      }
      entries.push({ repository: row.repository, worktree: row.root, relativePath: row.relativePath,
        sha256, bytes, sameAsPrimary: matchesPrimary, preservedFile });
    } catch (error) {
      if (error.code === 'ENOENT') reject(row, 'source-disappeared');
      else throw error;
    }
  }
  const report = { schemaVersion: 1, checkedAt: new Date().toISOString(), worktrees: trees.length,
    documents: entries.filter(row => /\.md$/i.test(row.relativePath)).length, sourceFiles,
    sameAsPrimary, uniquePreserved: unique.size, preservedBytes, written, rejected: rejected.length, readFiles, gitTrees, reusedTrees, statusRuns, diffRuns, timings };
  Object.defineProperty(report, WORKTREE_ENTRIES, { value: entries });
  lap('filesMs');
  if (!dryRun) {
    // 현재 index가 다른 버전으로 바뀌어도 이미 보존한 SHA의 원래 경로를 잃지 않는다.
    // 작은 SHA 접두사별 파일로 나눠 전체 목록의 매회 재쓰기와 10MiB 초과를 피한다.
    const identityGroups = new Map();
    for (const entry of entries.filter(row => row.preservedFile)) {
      const prefix = entry.sha256.slice(0, 2);
      if (!identityGroups.has(prefix)) identityGroups.set(prefix, []);
      identityGroups.get(prefix).push(entry);
    }
    for (const [prefix, group] of identityGroups) ensureIdentities(path.join(destination, 'sources', prefix + '.json'), group, cache);
    // 전체 작업트리 목록이 10MiB를 넘어서도 복원 경로가 필터에서 빠지지 않게 나눈다.
    const manifests = [];
    for (const tree of trees) {
      const treeEntries = entries.filter(entry => entry.worktree === tree.root);
      for (let offset = 0; offset < treeEntries.length; offset += 500) {
        const file = 'manifests/' + hash(tree.root).slice(0, 20) + '-' + (offset / 500) + '.json';
        writeChangedIndex(path.join(destination, file), { repository: tree.repository, worktree: tree.root, entries: treeEntries.slice(offset, offset + 500) }, { cache });
        manifests.push({ file, repository: tree.repository, worktree: tree.root, documents: Math.min(500, treeEntries.length - offset) });
      }
    }
    writeChangedIndex(path.join(destination, 'index.json'), { schemaVersion: 1, worktrees: trees.length,
      documents: report.documents, sourceFiles, sameAsPrimary, uniquePreserved: unique.size, manifests,
      restore: 'sameAsPrimary이면 OneDrive 시스템/저장소/relativePath의 SHA를 확인한다. 아니면 preservedFile을 새 작업트리의 relativePath로 복사한다. 기존 원문은 덮지 않는다.' }, { cache });
    writeChangedIndex(path.join(destination, 'excluded-protected-manifest.json'), { rejected }, { cache });
    lap('indexMs');
  }
  return report;
}
function runProviderScript(manifest, output) {
  execFileSync('pwsh.exe', ['-NoProfile', '-NonInteractive', '-File', path.join(__dirname, 'onedrive-provider-status.ps1'),
    '-ManifestPath', manifest, '-OutputPath', output], { encoding: 'utf8', windowsHide: true, timeout: 15 * 60 * 1000, maxBuffer: 1 << 20 });
  return readJson(output);
}
// 공급자 상태(Windows 셸 속성)는 사본마다 수 ms~수십 ms라 2만6천 개를 매번 보면 부하 속에서 11분이 걸렸다(10-19).
// 새로 보는 것: 바뀐 사본(크기·수정 시각이 직전 관찰과 다름), 직전에 IN_SYNC·크기 일치가 아니던 사본, 감시만 하는 사본,
// 6.5시간보다 오래된 관찰, 그리고 30분마다 돌아가는 1/12 묶음(6시간에 전체 한 바퀴). 나머지는 직전 관찰을 관찰 시각과 함께 옮긴다.
const PROVIDER_SLOTS = 12, PROVIDER_MAX_CARRY_MS = 6.5 * 60 * 60 * 1000;
const targetKey = target => path.resolve(target).toLowerCase();
function providerFocus(manifest, previous, now = Date.now()) {
  const slot = Math.floor(now / readCache.SLOT_MS) % PROVIDER_SLOTS, reportStarted = Date.parse(previous?.startedAt);
  const prior = new Map((Array.isArray(previous?.files) ? previous.files : []).filter(row => row && typeof row.target === 'string')
    .map(row => [targetKey(row.target), row]));
  const inspect = new Set(), carried = new Map();
  for (const file of manifest.files) {
    const key = targetKey(file.target), row = prior.get(key);
    if (inspect.has(key) || carried.has(key)) { inspect.add(key); carried.delete(key); continue; }
    const observed = Date.parse(row?.observedAt) || reportStarted;
    const sameModified = row && Number.isFinite(file.targetModifiedMs) && (Number.isFinite(row.modifiedMs)
      ? row.modifiedMs === file.targetModifiedMs : Math.abs(Date.parse(row.modifiedAt) - file.targetModifiedMs) < 1);
    const carry = row && !file.monitorOnly && !file.protectedSource && row.stateName === 'IN_SYNC' && row.exists === true && !row.error &&
      row.sizeMatches === true && row.bytes === file.expectedBytes && row.expectedBytes === file.expectedBytes && sameModified &&
      Number.isFinite(observed) && now - observed > -5 * 60 * 1000 && now - observed < PROVIDER_MAX_CARRY_MS &&
      readCache.slotOf(key, PROVIDER_SLOTS) !== slot;
    if (carry) carried.set(key, { ...row, target: file.target, observedAt: new Date(observed).toISOString(), modifiedMs: file.targetModifiedMs, carried: true });
    else inspect.add(key);
  }
  return { slot, inspect: manifest.files.filter(file => inspect.has(targetKey(file.target))), carried: [...carried.values()] };
}
function mergeProviderReport(manifestFile, manifest, focus, fresh, now = Date.now()) {
  const modified = new Map(manifest.files.map(file => [targetKey(file.target), file.targetModifiedMs]));
  const freshRows = (fresh?.files || []).map(row => {
    const recorded = modified.get(targetKey(row.target));
    return { ...row, observedAt: row.observedAt || fresh.startedAt, ...(Number.isFinite(recorded) && Math.abs(Date.parse(row.modifiedAt) - recorded) < 1 ? { modifiedMs: recorded } : {}) };
  });
  const files = [...freshRows, ...focus.carried], stateCounts = {};
  for (const row of files) stateCounts[row.stateName] = (stateCounts[row.stateName] || 0) + 1;
  const observed = files.map(row => Date.parse(row.observedAt)).filter(Number.isFinite);
  const seen = new Set(), duplicateTargets = [];
  for (const file of manifest.files) { const key = targetKey(file.target); if (seen.has(key)) duplicateTargets.push(file.target); seen.add(key); }
  return { schemaVersion: 1, startedAt: fresh?.startedAt || new Date(now).toISOString(), finishedAt: new Date().toISOString(),
    manifest: manifestFile, oneDriveRoot: fresh?.oneDriveRoot || manifest.oneDriveRoot, inputTargets: manifest.files.length,
    uniqueTargets: seen.size, duplicateTargets, inspected: files.length, freshlyInspected: freshRows.length, carriedOver: focus.carried.length,
    settleRounds: fresh?.settleRounds || 0,
    oldestObservedAt: observed.length ? new Date(Math.min(...observed)).toISOString() : null,
    rotation: { slots: PROVIDER_SLOTS, slot: focus.slot, maxCarryHours: PROVIDER_MAX_CARRY_MS / 3600000 },
    existingFiles: files.filter(row => row.exists).length, missingFiles: files.filter(row => row.stateName === 'MISSING').length,
    sizeMismatches: files.filter(row => row.sizeMatches === false).length, readErrors: files.filter(row => row.error).length, stateCounts,
    allTargetsStateInSync: files.length > 0 && files.every(row => row.stateName === 'IN_SYNC' && !row.error && row.sizeMatches !== false),
    cloudCompletionClaim: false, targetContentsRead: false, hydrationRequested: false, recursiveEnumeration: false,
    note: 'Local Windows provider metadata only. Rows with carried=true keep an earlier IN_SYNC observation (observedAt) for unchanged copies; the rest were read in this run. IN_SYNC is a provider report, not an independent remote checksum proof. PINNED is reported separately.',
    files };
}
// 방금 쓴 사본은 OneDrive가 올리는 동안 대기로 보인다(10-19: 쓰고 20초 뒤 보니 1,039개 중 1,017개가 PENDING_UPLOAD).
// 예전에는 전체 확인이 느려 그동안 올라갔다. 이제는 대기류 상태인 사본만 settleUntil까지 20초 간격으로 다시 본다.
// 오류·경고·제외·없음은 기다리지 않는다. 기한까지 남으면 그대로 pending으로 남긴다.
const SETTLING_STATES = new Set(['PENDING_UPLOAD', 'PENDING_UNSPECIFIED', 'TRANSFERRING']);
const sleepSync = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
function providerStatus(manifestFile, output, { previous = null, now = Date.now(), runScript = runProviderScript,
  settleUntil = 0, settleEveryMs = 20 * 1000, sleep = sleepSync, clock = Date.now } = {}) {
  const manifest = readJson(manifestFile), focus = providerFocus(manifest, previous, now);
  let fresh = null;
  if (focus.inspect.length) {
    const input = output.replace(/\.json$/, '') + '.input.json', raw = output.replace(/\.json$/, '') + '.fresh.json';
    const inspect = files => {
      writeJson(input, { oneDriveRoot: manifest.oneDriveRoot, files: files.map(file => ({ target: file.target, expectedBytes: file.expectedBytes })) });
      try {
        const report = runScript(input, raw);
        return { ...report, files: (report?.files || []).map(row => ({ ...row, observedAt: row.observedAt || report.startedAt })) };
      } finally { for (const file of [input, raw]) try { fs.unlinkSync(file); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
    };
    fresh = { ...inspect(focus.inspect), settleRounds: 0 };
    for (;;) {
      const waiting = new Set(fresh.files.filter(row => SETTLING_STATES.has(row.stateName)).map(row => targetKey(row.target)));
      if (!waiting.size || clock() + settleEveryMs > settleUntil) break;
      sleep(settleEveryMs);
      const again = new Map(inspect(focus.inspect.filter(file => waiting.has(targetKey(file.target)))).files.map(row => [targetKey(row.target), row]));
      fresh = { ...fresh, settleRounds: fresh.settleRounds + 1, files: fresh.files.map(row => again.get(targetKey(row.target)) || row) };
    }
  }
  const report = mergeProviderReport(manifestFile, manifest, focus, fresh, now);
  writeJson(output, report);
  return report;
}
function classifyProvider(report) {
  if (!report || !report.inspected || report.missingFiles || report.sizeMismatches || report.readErrors) return 'failed';
  if (report.allTargetsStateInSync) return 'healthy';
  const hard = ['ERROR', 'WARNING', 'EXCLUDED', 'MISSING', 'UNAVAILABLE', 'UNKNOWN', 'NONE'];
  return Object.keys(report.stateCounts || {}).some(state => hard.includes(state) || state.startsWith('UNKNOWN_')) ? 'failed' : 'pending';
}
function protectedPriorSources(root, scopes, rejected, previousFiles) {
  const contentReasons = new Set(['secret-literal', 'secret-signature', 'embedded-media-or-base64', 'over-10MiB', 'not-utf8-text', 'binary-control-bytes']);
  const roots = new Map(scopes.map(scope => [scope.name, scope.root]));
  roots.set('SYNK-appsscript', root);
  const protectedByPath = new Map(rejected.filter(row => contentReasons.has(row.reason) && roots.has(row.sourceScope))
    .map(row => [path.resolve(roots.get(row.sourceScope), row.source).toLowerCase(), row.reason]));
  return previousFiles.filter(row => row.source && fs.existsSync(row.source) && protectedByPath.has(path.resolve(row.source).toLowerCase()))
    .map(row => ({ ...row, protectedSource: protectedByPath.get(path.resolve(row.source).toLowerCase()) }));
}
function protectedSourceInventory(root, vault, scopes, rejected, protectedPrior = [], { cache = null } = {}) {
  const roots = new Map(scopes.map(scope => [scope.name, scope.root])); roots.set('SYNK-appsscript', root);
  const secretReason = reason => ['secret-literal', 'secret-signature'].includes(reason);
  const priorMedia = new Map(protectedPrior.filter(row => row.protectedSource === 'embedded-media-or-base64' && row.source && row.target && /^[a-f0-9]{64}$/.test(row.sha256) && Number.isSafeInteger(row.expectedBytes))
    .map(row => [path.resolve(row.source).toLowerCase(), { target: row.target, bytes: row.expectedBytes, sha256: row.sha256 }]));
  const accepted = (reason, file) => secretReason(reason) || (reason === 'embedded-media-or-base64' && priorMedia.has(path.resolve(file).toLowerCase()));
  const candidates = rejected.filter(row => roots.has(row.sourceScope) && policy.문서인가(row.source))
    .map(row => ({ ...row, sourceRoot: roots.get(row.sourceScope), sourcePath: path.resolve(roots.get(row.sourceScope), row.source) }))
    .filter(row => accepted(row.reason, row.sourcePath));
  const worktreeExcluded = readJson(path.join(vault, '작업문서_미통합_자동/excluded-protected-manifest.json'), { rejected: [] });
  for (const row of worktreeExcluded.rejected.filter(row => secretReason(row.reason)))
    candidates.push({ sourceScope: row.repository, source: row.relativePath, sourceRoot: row.worktree,
      sourcePath: path.resolve(row.worktree, row.relativePath), reason: row.reason, worktree: true });
  const safeCopies = [...readJson(path.join(vault, '문서_안전사본_자동/index.json'), { files: [] }).files,
    ...readJson(path.join(vault, '문서_안전사본_20261018/변환manifest.json'), { files: [] }).files];
  const linked = policy.linkPaths(candidates.map(row => row.sourcePath));
  const files = [];
  for (const row of [...new Map(candidates.map(row => [row.sourcePath.toLowerCase(), row])).values()]) {
    const rel = path.relative(row.sourceRoot, row.sourcePath);
    if (path.isAbsolute(rel) || rel === '..' || rel.startsWith('..' + path.sep) || linked(row.sourcePath)) throw new Error('protected-source-path-changed');
    let before, content = null, after, known = null;
    try {
      before = fs.statSync(row.sourcePath, { bigint: true });
      if (!before.isFile() || before.size > BigInt(policy.MAX_TEXT_BYTES)) throw new Error('protected-source-type-changed');
      // 목록 단계에서 읽어 분류한 그대로면(stat 동일) 다시 읽지 않는다(10-19).
      known = cache && cache.lookup(row.sourcePath, before, row.source);
      if (!known) { content = fs.readFileSync(row.sourcePath); after = fs.statSync(row.sourcePath, { bigint: true }); }
    } catch (error) {
      if (error.code === 'ENOENT') continue; // 목록 뒤에 지워진 원본은 보관할 현재 판이 없다(10-19).
      throw error;
    }
    let reason, digest, bytes;
    if (known) ({ reason, sha256: digest, bytes } = known);
    else {
      const info = {};
      reason = policy.textPolicy(row.source, content, info); digest = hash(content); bytes = content.length;
      if (cache) cache.remember(row.sourcePath, before, after, digest, bytes, row.source, reason, info);
      if (!sameContentStat(before, after)) throw new Error('protected-source-changed-during-read');
    }
    if (!accepted(reason, row.sourcePath)) continue;
    const safe = safeCopies.find(item => path.resolve(item.sourcePath || item.source).toLowerCase() === row.sourcePath.toLowerCase() &&
      item.originalSha256 === digest && fs.existsSync(item.safeCopyPath || item.safeCopy) && hash(fs.readFileSync(item.safeCopyPath || item.safeCopy)) === item.safeCopySha256);
    files.push({ sourceScope: row.sourceScope, sourceRoot: path.resolve(row.sourceRoot), sourcePath: row.sourcePath,
      source: row.source, bytes, sha256: digest, reason, ...(row.worktree ? { worktree: true } : {}),
      ...(reason === 'embedded-media-or-base64' ? { priorOneDriveCopy: priorMedia.get(row.sourcePath.toLowerCase()) } : {}),
      ...(safe ? { safeCopyPath: safe.safeCopyPath || safe.safeCopy, safeCopySha256: safe.safeCopySha256 } : {}) });
  }
  return { schemaVersion: 1, checkedAt: new Date().toISOString(), status: 'success', files };
}
function encryptedProtectionCoverage(vault, files) {
  const protectedFiles = [...new Map(files.filter(row => row.protectedSource && row.source && fs.existsSync(row.source))
    .map(row => [path.resolve(row.source).toLowerCase(), row])).values()];
  if (!protectedFiles.length) return [];
  const proof = readJson(path.join(vault, 'protected-source-backup-status.json'), { files: [] });
  const linked = policy.linkPaths(protectedFiles.map(row => row.source));
  return protectedFiles.map(row => {
    const result = { source: row.source, reason: row.protectedSource, preservedBy: 'unconfirmed' };
    if (linked(row.source)) return { ...result, error: 'source-link' };
    const before = fs.statSync(row.source);
    if (!before.isFile() || before.size > policy.MAX_TEXT_BYTES) return { ...result, error: 'source-type-changed' };
    const current = fs.readFileSync(row.source), after = fs.statSync(row.source);
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) return { ...result, error: 'source-changed-during-read' };
    result.sha256 = hash(current); result.bytes = current.length;
    const matching = (proof.files || []).find(file => file.sourcePath && path.resolve(file.sourcePath).toLowerCase() === path.resolve(row.source).toLowerCase() &&
      file.sha256 === result.sha256 && file.bytes === result.bytes && file.status === 'encrypted-drive-verified' &&
      file.coverage?.ok === true && file.coverage.account === '77yuhbs@gmail.com' &&
      Date.now() - Date.parse(file.coverage.checkedAt) >= -5 * 60 * 1000 && Date.now() - Date.parse(file.coverage.checkedAt) < 36 * 60 * 60 * 1000 &&
      file.coverage.files?.length && file.coverage.files.every(remote => typeof remote.id === 'string' && remote.id.length && remote.bytes > 0 && /^[a-f0-9]{64}$/i.test(remote.sha256)));
    if (matching) { result.preservedBy = 'encrypted-drive'; result.coverageCheckedAt = matching.coverage.checkedAt; }
    return result;
  });
}
// entries: 이번 실행의 작업트리 수집이 방금 쓴 목록(메모리). 없으면(확인 전용 실행 등) 창고의 색인과 목록 파일을 읽는다.
function worktreePrimaryDrift(root, vault, files, entries = null) {
  const directory = path.join(vault, '작업문서_미통합_자동');
  const roots = new Map(policy.systemScopes(root).map(scope => [scope.name, scope.root]));
  const copied = new Map();
  for (const row of files) if (row.source) {
    const key = path.resolve(row.source).toLowerCase();
    if (!copied.has(key)) copied.set(key, new Set());
    copied.get(key).add(row.sha256);
  }
  const mismatches = [];
  const shards = entries ? [{ entries }] : readJson(path.join(directory, 'index.json'), { manifests: [] }).manifests.map(shard => {
    if (!/^manifests\/[a-f0-9]+-\d+\.json$/.test(shard.file)) throw new Error('invalid-worktree-manifest-path');
    return readJson(path.join(directory, shard.file));
  });
  for (const content of shards) {
    for (const entry of content.entries.filter(row => row.sameAsPrimary)) {
      const source = roots.has(entry.repository) ? path.resolve(roots.get(entry.repository), entry.relativePath).toLowerCase() : '';
      if (!copied.get(source)?.has(entry.sha256)) mismatches.push({ repository: entry.repository,
        worktree: entry.worktree, relativePath: entry.relativePath, expectedSha256: entry.sha256 });
    }
  }
  return mismatches;
}
function run({ root = ROOT, destination = process.env.OneDrive, stateDir, dryRun = false,
  checkOnly = false, collectWorktrees = preserveWorktreeDocuments, getRows = policy.목록, checkProvider = providerStatus,
  heartbeatEveryMs = 60 * 1000, clock = Date.now } = {}) {
  const vault = path.resolve(root, '../SYNK_원본창고');
  stateDir ||= path.join(vault, '상태/OneDrive');
  const latestFile = path.join(stateDir, 'latest.json'), manifestFile = path.join(stateDir, 'copy-manifest.json');
  const previous = readJson(latestFile, {}), previousManifest = readJson(manifestFile, { files: [] });
  const runId = new Date().toISOString().replace(/[:.]/g, '-') + '-' + process.pid;
  const state = { schemaVersion: 1, runId, pid: process.pid, startedAt: new Date().toISOString(), checkedAt: null,
    heartbeatAt: new Date().toISOString(), status: 'running',
    lastSuccessAt: previous.lastSuccessAt || null, copySucceededAt: previous.copySucceededAt || null,
    providerVerifiedAt: previous.providerVerifiedAt || null, destination, deletes: 0, directCloudCalls: 0,
    remoteChecksumVerified: false, note: 'Local SHA checks and Windows provider metadata; no independent remote checksum claim.' };
  // 작업트리 수집·복사처럼 긴 단계 안에서도 1분마다 영수증 heartbeat를 남긴다.
  // 통합 감시는 실행 중 heartbeat가 15분 넘게 멈추면 실행 중단으로 본다(10-19, 부하 속 작업트리 수집 17분).
  let lastBeat = clock();
  const beat = (force = false) => {
    const at = clock();
    if (dryRun || (!force && at - lastBeat < heartbeatEveryMs)) return;
    lastBeat = at; state.heartbeatAt = new Date(at).toISOString();
    // 감시가 읽는 순간 Windows가 교체를 거절하면 다음 박동에 다시 쓴다. 박동 하나가 빠졌다고 백업 실패로 세지 않는다.
    try { writeJson(latestFile, state); } catch (error) { if (!['EPERM', 'EBUSY', 'EACCES'].includes(error.code)) throw error; }
  };
  // 단계별 걸린 시간(ms)을 영수증에 남긴다. 부하에 따라 어느 단계가 밀리는지 다음 실행과 비교하려는 것이다.
  const runStarted = clock();
  let stageStarted = runStarted;
  const stage = name => { const at = clock(); (state.timings ||= {})[name] = at - stageStarted; stageStarted = at; };
  // 읽기 기록은 실패한 실행에서도 저장한다(읽어서 확인한 사실은 실행 결과와 무관하다). 저장 실패는 백업 실패로 세지 않는다.
  // 새로 읽은 것이 많으면 단계가 끝날 때마다 저장해, 처음 실행이 시간 제한에 끊겨도 다음 실행은 덜 읽는다.
  let cache = null, savedAtRemembered = 0;
  const persistCache = (final = true) => {
    if (!cache || dryRun || state.readCache?.final) return;
    if (!final && cache.counts.remembered - savedAtRemembered < 500) return;
    savedAtRemembered = cache.counts.remembered;
    try { state.readCache = { ...cache.summary(), ...cache.save(policy.policyFingerprint()), final }; }
    catch (error) { state.readCache = { ...cache.summary(), saved: false, error: error.code || error.message, final }; }
  };
  let lock;
  try {
    if (dryRun && checkOnly) throw new Error('dry-run-and-check-only-are-mutually-exclusive');
    if (!destination || !fs.existsSync(destination)) throw new Error('configured-onedrive-root-missing');
    if (!dryRun) {
      fs.mkdirSync(stateDir, { recursive: true });
      const lockFile = path.join(stateDir, 'run.lock');
      try { lock = fs.openSync(lockFile, 'wx'); }
      catch (error) {
        if (error.code !== 'EEXIST') throw error;
        const owner = readJson(lockFile, {});
        try { process.kill(owner.pid, 0); return { ...state, status: 'already-running', exitCode: 0 }; }
        catch (e) { if (e.code !== 'ESRCH') throw new Error('backup-lock-owner-unconfirmed'); }
        fs.unlinkSync(lockFile); lock = fs.openSync(lockFile, 'wx');
      }
      fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, runId }));
      writeJson(latestFile, state);
    }
    let manifest;
    if (checkOnly) {
      manifest = previousManifest;
      if (!manifest.files.length) throw new Error('copy-manifest-missing');
      state.protectedSources = [...new Map(manifest.files.filter(row => row.protectedSource).map(row =>
        [row.source, { source: row.source, reason: row.protectedSource }])).values()];
      state.worktreePrimaryDrift = worktreePrimaryDrift(root, vault, manifest.files);
    } else {
      // 지난 실행이 읽어 확인한 파일의 stat·SHA·분류(onedrive-read-cache.cjs). 깨졌거나 규칙이 바뀌었으면 비어 있고 전부 읽는다.
      cache = readCache.open(path.join(stateDir, 'read-cache.json'), { fingerprint: policy.POLICY_FINGERPRINT, now: clock() });
      state.worktrees = collectWorktrees(root, vault, { dryRun, onProgress: beat, cache });
      if (!dryRun) state.safeMarkdown = preserveSafeMarkdown(root, vault);
      if (!dryRun) state.recoveryIndex = policy.writeSafeRecoveryIndex(vault);
      stage('worktrees');
      persistCache(false);
      beat(true);
      const rows = getRows(root);
      stage('listRows');
      const plan = policy.oneDrivePlan(root, rows, { cache });
      stage('plan');
      state.scopes = rows.scopes || [];
      if (state.scopes.some(scope => scope.status !== 'available')) throw new Error('required-source-scope-missing');
      const protectedFiles = protectedPriorSources(root, state.scopes, plan.rejected, previousManifest.files);
      state.protectedSources = [...new Map(protectedFiles.map(row => [row.source, { source: row.source, reason: row.protectedSource }])).values()];
      if (!plan.selected.length && !protectedFiles.length) throw new Error('empty-copy-plan');
      state.excluded = Object.fromEntries([...new Set(plan.rejected.map(row => row.reason))].map(reason => [reason, plan.rejected.filter(row => row.reason === reason).length]));
      if (dryRun) return { ...state, status: 'planned', files: plan.selected.length, bytes: plan.selected.reduce((n, row) => n + row.bytes, 0), exitCode: 0 };
      const protectedInventory = protectedSourceInventory(root, vault, state.scopes, plan.rejected, protectedFiles, { cache });
      writeJson(path.join(stateDir, 'protected-sources.json'), protectedInventory);
      state.protectedInventory = { checkedAt: protectedInventory.checkedAt, files: protectedInventory.files.length };
      stage('protectedInventory');
      persistCache(false);
      beat(true);
      // 방금 만든 목록을 복사 안에서 다시 만들지 않는다. 복사 직전 다시 보는 것(링크·stat·바뀐 원본의 재분류)은 그대로다.
      const result = policy.copy(root, destination, plan.selected, { recordFiles: true, previousFiles: previousManifest.files, onProgress: beat, cache, prePlanned: true });
      stage('copy');
      if (result.sourceDrift.length) {
        state.sourceDrift = result.sourceDrift.map(({ source, reason }) => ({ source, reason }));
        throw new Error('source-changed-during-copy');
      }
      const { files, rejected, sourceDrift, ...summary } = result;
      // 이미 별도로 검증한 잠긴 복구열쇠·안전 HTML은 바꾸지 않고 존재/동기화만 감시한다.
      const extras = readJson(path.join(stateDir, 'monitored-extra-targets.json'), { files: [] });
      const selectedTargets = new Set(files.map(file => path.resolve(file.target).toLowerCase()));
      // 새 내용이 민감해져 제외된 기존 파일은 옛 안전 사본을 유지하되 최신 백업 성공으로 세지 않는다.
      for (const file of protectedFiles) if (!selectedTargets.has(path.resolve(file.target).toLowerCase())) files.push(file);
      for (const extra of extras.files) {
        if (!selectedTargets.has(path.resolve(extra.target).toLowerCase())) files.push({ ...extra, monitorOnly: true });
      }
      state.monitorOnlyFiles = extras.files.length;
      manifest = { schemaVersion: 1, copiedAt: new Date().toISOString(), oneDriveRoot: destination, files };
      writeJson(manifestFile, manifest);
      state.copy = summary; state.copySucceededAt = manifest.copiedAt;
      state.worktreePrimaryDrift = worktreePrimaryDrift(root, vault, files, state.worktrees?.[WORKTREE_ENTRIES]);
      state.heartbeatAt = manifest.copiedAt;
      writeJson(path.join(stateDir, 'excluded-latest.json'), { checkedAt: manifest.copiedAt, rejected: plan.rejected });
      persistCache();
      writeJson(latestFile, state);
      if (result.skipped) throw new Error('source-classification-changed-during-copy');
    }
    const providerFile = path.join(stateDir, 'provider-' + runId + '.json');
    const providerLatest = path.join(stateDir, 'provider-latest.json');
    // 방금 쓴 사본이 올라가기를 실행 시작 뒤 8분까지 기다릴 수 있다(예약 실행이 10분 안에 끝나게).
    const provider = checkProvider(manifestFile, providerFile, { previous: readJson(providerLatest, null), now: clock(), settleUntil: runStarted + 8 * 60 * 1000 });
    if (fs.existsSync(providerFile)) replaceFile(providerFile, providerLatest);
    stage('provider');
    state.status = classifyProvider(provider);
    state.provider = { path: providerLatest, inspected: provider.inspected, missingFiles: provider.missingFiles,
      sizeMismatches: provider.sizeMismatches, readErrors: provider.readErrors, stateCounts: provider.stateCounts,
      ...(provider.freshlyInspected !== undefined ? { freshlyInspected: provider.freshlyInspected, carriedOver: provider.carriedOver,
        oldestObservedAt: provider.oldestObservedAt, settleRounds: provider.settleRounds } : {}) };
    state.checkedAt = new Date().toISOString();
    state.heartbeatAt = state.checkedAt;
    state.protectedSources = encryptedProtectionCoverage(vault, manifest.files);
    if (state.protectedSources.some(row => row.preservedBy !== 'encrypted-drive')) throw new Error('previously-backed-source-now-protected');
    if (state.worktreePrimaryDrift?.length) throw new Error('worktree-primary-source-changed-during-copy');
    if (state.status === 'healthy') { state.lastSuccessAt = state.checkedAt; state.providerVerifiedAt = state.checkedAt; }
    state.exitCode = state.status === 'healthy' ? 0 : state.status === 'pending' ? 2 : 1;
    writeJson(latestFile, state);
    return state;
  } catch (error) {
    state.status = 'failed'; state.checkedAt = new Date().toISOString(); state.heartbeatAt = state.checkedAt; state.error = error.code || error.message;
    state.exitCode = 1;
    persistCache();
    if (!dryRun) writeJson(latestFile, state);
    return state;
  } finally {
    if (lock !== undefined) { fs.closeSync(lock); fs.unlinkSync(path.join(stateDir, 'run.lock')); }
  }
}
if (require.main === module) {
  const args = process.argv.slice(2), options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') options.dryRun = true;
    else if (args[i] === '--check-only') options.checkOnly = true;
    else if (['--state-dir', '--destination'].includes(args[i]) && args[i + 1]) options[args[i] === '--state-dir' ? 'stateDir' : 'destination'] = path.resolve(args[++i]);
    else if (['--help', '-h'].includes(args[i])) {
      console.log('node tools/onedrive-backup.cjs [--dry-run|--check-only] [--state-dir PATH] [--destination ONEDRIVE]\nExit: 0 provider IN_SYNC, 2 pending, 1 failed. No deletions.'); process.exit(0);
    } else { console.error('Unknown argument'); process.exit(1); }
  }
  const result = run(options); console.log(JSON.stringify(result)); process.exitCode = result.exitCode;
}
module.exports = { worktrees, changedWorktreeSources, preserveWorktreeDocuments, classifyProvider, protectedPriorSources, protectedSourceInventory, encryptedProtectionCoverage, worktreePrimaryDrift, providerFocus, mergeProviderReport, providerStatus, run, readJson, writeJson };
