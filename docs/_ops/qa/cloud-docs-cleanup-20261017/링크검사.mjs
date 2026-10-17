// 저장소의 추적된 .md 전부에서 상대 링크(파일·#앵커)를 검사한다.
// 사용: node docs/_ops/qa/cloud-docs-cleanup-20261017/링크검사.mjs [--json 출력.json]
// 외부 주소(http·mailto 등)와 형제 저장소(저장소 밖) 경로는 검사하지 않고 따로 센다.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const tracked = execFileSync('git', ['-C', ROOT, 'ls-files', '-z'], { encoding: 'utf8', maxBuffer: 1 << 28 })
  .split('\0').filter(Boolean);
const trackedSet = new Set(tracked);
const trackedDirs = new Set();
for (const f of tracked) {
  let d = path.posix.dirname(f);
  while (d !== '.' && !trackedDirs.has(d)) { trackedDirs.add(d); d = path.posix.dirname(d); }
}
const mdFiles = tracked.filter((f) => f.toLowerCase().endsWith('.md'));

// 지난 커밋에 있던 경로(얕은 복제면 일부만 보인다)와 2026-10-17 Release 보관 목록
const historyPaths = new Set();
const historyDirs = new Set();
try {
  const out = execFileSync('git', ['-C', ROOT, '-c', 'core.quotepath=off', 'log', '--all', '--name-only', '--format=', '--no-renames', '-z'],
    { encoding: 'utf8', maxBuffer: 1 << 30 });
  for (const f of out.split(/[\0\n]/)) {
    if (!f) continue;
    historyPaths.add(f);
    let d = path.posix.dirname(f);
    while (d !== '.' && !historyDirs.has(d)) { historyDirs.add(d); d = path.posix.dirname(d); }
  }
} catch {}
const shallow = execFileSync('git', ['-C', ROOT, 'rev-parse', '--is-shallow-repository'], { encoding: 'utf8' }).trim() === 'true';
const archived = new Set();
const archiveDirs = new Set();
try {
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/_ops/github-storage/archive-20261017.json'), 'utf8'));
  for (const f of j.files || []) {
    archived.add(f.path);
    let d = path.posix.dirname(f.path);
    while (d !== '.' && !archiveDirs.has(d)) { archiveDirs.add(d); d = path.posix.dirname(d); }
  }
} catch {}

// GitHub 방식 제목 앵커
function slug(text) {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, '')
    .replace(/ /g, '-');
}

const anchorCache = new Map();
function anchorsOf(rel) {
  if (anchorCache.has(rel)) return anchorCache.get(rel);
  const set = new Set();
  const counts = new Map();
  const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  let fence = null;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '');
    const f = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (f) { if (!fence) fence = f[1][0]; else if (f[1][0] === fence) fence = null; continue; }
    if (fence) continue;
    for (const m of line.matchAll(/<a\s+[^>]*(?:id|name)\s*=\s*["']([^"']+)["']/gi)) set.add(m[1]);
    for (const m of line.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)) set.add(m[1]);
    const h = line.match(/^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/);
    if (h) {
      const base = slug(h[1]);
      const n = counts.get(base) || 0;
      counts.set(base, n + 1);
      set.add(n ? `${base}-${n}` : base);
    }
  }
  anchorCache.set(rel, set);
  return set;
}

function isIgnored(rel) {
  try { execFileSync('git', ['-C', ROOT, 'check-ignore', '-q', '--no-index', '--', rel]); return true; } catch { return false; }
}

// 비슷한 이름의 실제 파일
const byBase = new Map();
for (const f of tracked) {
  const b = path.posix.basename(f);
  if (!byBase.has(b)) byBase.set(b, []);
  byBase.get(b).push(f);
}
function lev(a, b) {
  if (Math.abs(a.length - b.length) > 8) return 99;
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]; dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}
const GENERIC = new Set(['README.md', 'report.json', 'index.html', 'RESULTS.md', 'summary.json', 'manifest.json']);
function candidatesFor(target) {
  const out = [];
  const add = (f) => { if (f && !out.includes(f)) out.push(f); };
  const segs = target.split('/');
  const base = segs[segs.length - 1];
  // ① 부모 폴더 이름까지 같은 파일(폴더째 옮겨진 경우)
  if (segs.length >= 2) {
    const tail = segs.slice(-2).join('/');
    for (const f of tracked) if (f.endsWith('/' + tail)) add(f);
    for (const d of trackedDirs) if (d.endsWith('/' + tail) || d === tail) add(d + '/');
  }
  // ② 흔하지 않은 파일 이름이 같은 파일
  if (!GENERIC.has(base)) for (const f of byBase.get(base) || []) add(f);
  // ③ 처음 끊긴 단계에서 비슷한 이름의 형제를 고르고 나머지가 있는지 본다
  let i = 0;
  while (i < segs.length && (trackedDirs.has(segs.slice(0, i + 1).join('/')) || trackedSet.has(segs.slice(0, i + 1).join('/')))) i++;
  if (i < segs.length) {
    const parent = segs.slice(0, i).join('/');
    const miss = segs[i];
    const sibs = new Set();
    const prefix = parent ? parent + '/' : '';
    for (const f of tracked) {
      if (!f.startsWith(prefix)) continue;
      const name = f.slice(prefix.length).split('/')[0];
      sibs.add(name);
    }
    const stem = miss.replace(/\.[^.]+$/, '');
    const scored = [];
    for (const s2 of sibs) {
      const t2 = s2.replace(/\.[^.]+$/, '');
      const d = lev(stem, t2);
      const lim = Math.max(2, Math.floor(stem.length / 4));
      if (d <= lim || (stem.length >= 4 && t2.length >= 4 && (t2.includes(stem) || stem.includes(t2)))) scored.push([d, s2]);
    }
    scored.sort((a, b) => a[0] - b[0]);
    for (const [, s2] of scored.slice(0, 3)) {
      const rest = segs.slice(i + 1);
      const cand = [parent, s2, ...rest].filter(Boolean).join('/');
      if (trackedSet.has(cand)) add(cand);
      else if (trackedDirs.has(cand)) add(cand + '/');
      else if (!rest.length) add(trackedDirs.has([parent, s2].filter(Boolean).join('/')) ? [parent, s2].filter(Boolean).join('/') + '/' : [parent, s2].filter(Boolean).join('/'));
    }
    // ④ 끊긴 폴더 이름이 저장소 다른 곳에 있다
    if (i < segs.length - 1) for (const d of trackedDirs) if (path.posix.basename(d) === miss) {
      const cand = [d, ...segs.slice(i + 1)].join('/');
      if (trackedSet.has(cand)) add(cand); else if (trackedDirs.has(cand)) add(cand + '/');
    }
  }
  return out.slice(0, 3);
}
function anchorCandidates(rel, anchor) {
  const all = [...anchorsOf(rel)];
  return all
    .map((a) => [lev(anchor, a), a])
    .filter(([d, a]) => d <= Math.max(2, Math.floor(anchor.length / 3)) || a.includes(anchor) || anchor.includes(a))
    .sort((a, b) => a[0] - b[0])
    .slice(0, 3)
    .map((x) => '#' + x[1]);
}

const LINK_RE = /(!?)\[((?:[^\[\]]|\[[^\]]*\])*)\]\(\s*(<[^>]*>|[^\s)]*(?:\([^)]*\)[^\s)]*)*)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g;
const REF_RE = /^\s{0,3}\[[^\]]+\]:\s*(<[^>]*>|\S+)/;

const broken = [];
const stats = { files: mdFiles.length, links: 0, external: 0, outside: 0, ok: 0 };
const outsideTargets = new Map();

for (const md of mdFiles) {
  const abs = path.join(ROOT, md);
  if (!fs.existsSync(abs)) continue;
  const lines = fs.readFileSync(abs, 'utf8').split('\n');
  let fence = null;
  lines.forEach((raw, i) => {
    const line = raw.replace(/\r$/, '');
    const f = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (f) { if (!fence) fence = f[1][0]; else if (f[1][0] === fence) fence = null; return; }
    if (fence) return;
    const scan = line.replace(/`[^`]*`/g, (m) => ' '.repeat(m.length));
    const targets = [];
    for (const m of scan.matchAll(LINK_RE)) targets.push(m[3]);
    const r = scan.match(REF_RE);
    if (r) targets.push(r[1]);
    for (let t of targets) {
      if (t.startsWith('<') && t.endsWith('>')) t = t.slice(1, -1);
      if (!t) continue;
      stats.links++;
      if (/^[a-z][a-z0-9+.-]*:/i.test(t) || t.startsWith('//')) { stats.external++; continue; }
      let [p, anchor] = [t, null];
      const hi = t.indexOf('#');
      if (hi >= 0) { p = t.slice(0, hi); anchor = t.slice(hi + 1); }
      p = p.replace(/\?.*$/, '');
      try { p = decodeURIComponent(p); } catch {}
      try { if (anchor != null) anchor = decodeURIComponent(anchor); } catch {}
      let rel;
      if (p === '') rel = md;
      else if (p.startsWith('/')) rel = path.posix.normalize(p.slice(1));
      else rel = path.posix.normalize(path.posix.join(path.posix.dirname(md), p));
      rel = rel.replace(/\/$/, '');
      if (rel.startsWith('..')) {
        stats.outside++;
        const top = rel.split('/').slice(0, 2).join('/');
        outsideTargets.set(top, (outsideTargets.get(top) || 0) + 1);
        continue;
      }
      const item = { file: md, line: i + 1, link: t };
      const exists = rel === '' || trackedSet.has(rel) || trackedDirs.has(rel);
      if (!exists) {
        let kind;
        if (archived.has(rel) || archiveDirs.has(rel)) kind = 'archived';
        else if (isIgnored(rel)) kind = 'ignored';
        else if (historyPaths.has(rel) || historyDirs.has(rel)) kind = 'history';
        else kind = 'never';
        const reasons = {
          archived: '파일 없음 — 2026-10-17 Release 보관본에 있음(tools/git-storage-restore.py로 복원)',
          ignored: '파일 없음 — .gitignore 대상(로컬 PC에만 있을 수 있음)',
          history: '파일 없음 — 예전 커밋에는 있었음(지워지거나 옮겨짐)',
          never: shallow ? '파일 없음(얕은 복제라 이력 미확인)' : '파일 없음 — 커밋된 적 없음(로컬 전용·오타)',
        };
        broken.push({ ...item, target: rel, reason: reasons[kind], kind, candidates: candidatesFor(rel) });
        continue;
      }
      if (anchor && rel.toLowerCase().endsWith('.md') && trackedSet.has(rel)) {
        const set = anchorsOf(rel);
        const a = anchor.toLowerCase();
        if (!set.has(anchor) && !set.has(a)) {
          broken.push({ ...item, target: rel, reason: '앵커 없음', kind: 'anchor', candidates: anchorCandidates(rel, anchor).map((x) => (p === '' ? x : p + x)) });
          continue;
        }
      }
      stats.ok++;
    }
  });
}

const jsonOut = process.argv.indexOf('--json');
if (jsonOut >= 0) fs.writeFileSync(process.argv[jsonOut + 1], JSON.stringify({ stats, outside: Object.fromEntries(outsideTargets), broken }, null, 2));
console.log(JSON.stringify(stats), '깨짐', broken.length,
  Object.entries(broken.reduce((a, b) => ((a[b.kind] = (a[b.kind] || 0) + 1), a), {})));
