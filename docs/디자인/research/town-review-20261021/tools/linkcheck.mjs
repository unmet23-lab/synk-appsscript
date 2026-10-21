// Read-only link/anchor checker for a set of markdown files.
import fs from 'node:fs';
import path from 'node:path';
const root = process.argv[2];
const files = process.argv.slice(3);
const cache = new Map();
function anchorsOf(file) {
  if (cache.has(file)) return cache.get(file);
  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch { cache.set(file, null); return null; }
  const set = new Set();
  for (const m of text.matchAll(/<a id="([^"]+)"><\/a>/g)) set.add(m[1]);
  // GitHub-style heading slugs
  for (const line of text.split(/\r?\n/)) {
    const h = line.match(/^#{1,6}\s+(.*)$/);
    if (!h) continue;
    let s = h[1].trim().toLowerCase();
    s = s.replace(/<[^>]+>/g, '');
    s = s.replace(/[^\p{L}\p{N}\s\-_]/gu, '');
    s = s.replace(/\s/g, '-');
    set.add(s);
  }
  cache.set(file, set);
  return set;
}
let total = 0, bad = [];
for (const f of files) {
  const abs = path.resolve(root, f);
  const text = fs.readFileSync(abs, 'utf8');
  const dir = path.dirname(abs);
  for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    const href = m[1];
    if (/^(https?:|mailto:)/.test(href)) continue;
    total++;
    let [p, a] = href.split('#');
    const target = p ? path.resolve(dir, decodeURIComponent(p)) : abs;
    if (!fs.existsSync(target)) { bad.push(`${f}: missing file ${href}`); continue; }
    if (a && target.endsWith('.md')) {
      const set = anchorsOf(target);
      const anchor = decodeURIComponent(a);
      if (set && !set.has(anchor)) bad.push(`${f}: missing anchor ${href}`);
    }
  }
}
console.log(JSON.stringify({ total, badCount: bad.length, bad }, null, 1));
