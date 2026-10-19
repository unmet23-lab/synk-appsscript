// PATH 다음 판 공개 후보 = 공개본(synk-policy origin/main의 try/travel) + 내 PATH 변경만. push는 하지 않는다.
// 글 파일은 3방향(공개본 · 지난 공개 소스 a379aaf35 · 새 소스 origin/master), 그림은 새 소스 그대로.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const src = 'C:/Users/q1212/Documents/SYNK-appsscript', pub = 'C:/Users/q1212/Documents/synk-policy';
const out = path.join(__dirname, 'candidate');
const sh = (cwd, args) => execFileSync('git', ['-c', 'core.autocrlf=false', ...args], { cwd, maxBuffer: 1 << 28 });
const lf = b => b.toString('utf8').replace(/\r\n/g, '\n');
const oldRev = 'a379aaf35', newRev = sh(src, ['rev-parse', 'origin/master']).toString().trim();
const P = sh(pub, ['rev-parse', 'origin/main']).toString().trim();
const text = ['index.html', 'planner.html', 'planner.css', 'planner-ui.mjs', 'planner.mjs', 'planner-storage.mjs', 'real-conditions.mjs', 'legacy.html', 'real-ui.mjs', 'real-guide.mjs', 'real-course.mjs', 'real-course-ui.mjs'];
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(path.join(out, 'assets/felt'), { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'path-pub-'));
const report = { publicBase: P, oldRev, newRev, files: {}, assets: [] };
const bad = /claude|anthropic|\bgpt\b|openai|codex|fable|gemini|127\.0\.0\.1|localhost/i;
for (const f of text) {
  // 공개본의 공백만 있는 줄은 빈 줄로 보고 합친다(빌드 흔적, 지난 공개와 같다)
  const liveRaw = lf(sh(pub, ['show', `${P}:try/travel/${f}`]));
  const live = liveRaw.split('\n').map(l => (/^[ \t]+$/.test(l) ? '' : l)).join('\n');
  const base = lf(sh(src, ['show', `${oldRev}:experiences/path-travel/${f}`])), mine = lf(sh(src, ['show', `${newRev}:experiences/path-travel/${f}`]));
  // 공개 트리는 평평해서 상위 경로를 같은 폴더로 고쳐 쓴다. 공개본이 「지난 소스 + 이 고쳐 쓰기」와 똑같은 파일은
  // 새 소스에 같은 고쳐 쓰기를 적용해 후보로 쓴다(되돌리면 공개본 = 지난 소스 고쳐 쓰기로 확인됨).
  const rewrite = s => [['../synk-account/', './synk-account/'], ['../../atlas/', './atlas/'], ['../../tools/lib/', './tools/lib/']].reduce((t, [from, to]) => t.split(from).join(to), s);
  let merged, how;
  if (rewrite(base) === live) { merged = rewrite(mine); how = '경로 고쳐 쓰기'; }
  else {
    // 공개 전용 줄(보안 정책 meta 등)이 더 있으면, 양쪽 소스에 같은 경로 고쳐 쓰기를 먼저 한 뒤 3방향으로 합친다.
    const [a, b, c] = ['live', 'base', 'mine'].map(n => path.join(tmp, `${f}.${n}`));
    fs.writeFileSync(a, live); fs.writeFileSync(b, rewrite(base)); fs.writeFileSync(c, rewrite(mine));
    try { merged = execFileSync('git', ['merge-file', '-p', a, b, c], { maxBuffer: 1 << 28 }).toString('utf8'); }
    catch (e) { throw new Error(`${f}: 3방향 충돌 ${e.status}개 — 멈춤`); }
    const m = path.join(tmp, `${f}.merged`); fs.writeFileSync(m, merged);
    let back;
    try { back = execFileSync('git', ['merge-file', '-p', m, c, b], { maxBuffer: 1 << 28 }).toString('utf8'); }
    catch (e) { throw new Error(`${f}: 거꾸로 빼기 충돌 — 멈춤`); }
    if (back !== live) throw new Error(`${f}: 내 변경을 빼면 공개본과 달라짐 — 멈춤`);
    how = '3방향';
  }
  const added = merged.split('\n').filter(l => !liveRaw.split('\n').includes(l) && bad.test(l));
  if (added.length) throw new Error(`${f}: 새 줄에 도구 이름·로컬 주소 — ${added[0].slice(0, 120)}`);
  fs.writeFileSync(path.join(out, f), merged);
  report.files[f] = { how, liveBytes: Buffer.byteLength(liveRaw), candidateBytes: Buffer.byteLength(merged), changed: merged !== liveRaw, publicOnlyLinesKept: merged !== mine };
}
// 새 그림: 펠트 18개(공개본에 없어야 한다)
const names = sh(src, ['ls-tree', '--name-only', `${newRev}:experiences/path-travel/assets/felt`]).toString().trim().split('\n');
for (const name of names) {
  const exists = (() => { try { sh(pub, ['cat-file', '-e', `${P}:try/travel/assets/felt/${name}`]); return true; } catch { return false; } })();
  if (exists) throw new Error(`공개본에 이미 있는 그림: ${name}`);
  fs.writeFileSync(path.join(out, 'assets/felt', name), sh(src, ['show', `${newRev}:experiences/path-travel/assets/felt/${name}`]));
  report.assets.push(name);
}
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 1));
console.log(JSON.stringify({ ...report, assets: report.assets.length }, null, 1));
