// 공개 후보 = 공개본(synk-policy origin/main의 try/travel) + 지난 공개 소스 → 새 소스의 변경만. push는 하지 않는다.
// 바꾼 글 파일은 3방향(공개본 · 지난 공개 소스 · 새 소스), 새 파일은 새 소스 그대로.
// 방식은 지난 공개의 ../publish/pub-candidate.cjs와 같다(공개 트리는 평평해 상위 경로를 같은 폴더로 고쳐 쓴다).
// 사용: node pub-candidate.cjs [지난 공개 소스] [새 소스] [바꾼 글 파일,…] [새 파일,…]  — 후보는 candidate/, 기록은 candidate/report.json
//   인자 없이 돌리면 확인 질문 워커 공개(10-19 밤: 8c8ef19e2 → a7b8ba9ff, planner-ui.mjs 수정 · question-worker.mjs 추가)와 같다.
//   미리보기 질문 공개(10-19 밤): node pub-candidate.cjs a7b8ba9ff d141520fb planner-ui.mjs ""
//   다른 안 도보 차이 공개(10-19 밤): node pub-candidate.cjs d141520fb aee827113 planner-ui.mjs "" — 이때부터 올리기는 policy-commit.cjs 대신
//     node tools/공개.js 올리기 try/travel/planner-ui.mjs=<이 폴더>/candidate/planner-ui.mjs(미리 보기 → -m … --실행 --계획 <해시>)로 했다.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const src = 'C:/Users/q1212/Documents/SYNK-appsscript', pub = 'C:/Users/q1212/Documents/synk-policy';
const out = path.join(__dirname, 'candidate');
const sh = (cwd, args) => execFileSync('git', ['-c', 'core.autocrlf=false', ...args], { cwd, maxBuffer: 1 << 28 });
const lf = b => b.toString('utf8').replace(/\r\n/g, '\n');
const [oldRev = '8c8ef19e2', newRev = 'a7b8ba9ff', changedArg = 'planner-ui.mjs', addedArg = 'question-worker.mjs'] = process.argv.slice(2);
const list = arg => arg.split(',').map(name => name.trim()).filter(Boolean);
sh(pub, ['fetch', '-q', 'origin', 'main']);
const P = sh(pub, ['rev-parse', 'origin/main']).toString().trim();
const bad = /claude|anthropic|\bgpt\b|openai|codex|fable|gemini|127\.0\.0\.1|localhost/i;
const rewrite = s => [['../synk-account/', './synk-account/'], ['../../atlas/', './atlas/'], ['../../tools/lib/', './tools/lib/']].reduce((t, [from, to]) => t.split(from).join(to), s);
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'path-worker-pub-'));
const report = { publicBase: P, oldRev, newRev, files: {} };
const exists = rev => { try { sh(pub, ['cat-file', '-e', `${P}:try/travel/${rev}`]); return true; } catch { return false; } };
// 바꾼 글 파일: 공개본이 「지난 소스 + 고쳐 쓰기」와 같으면 새 소스에 고쳐 쓰기만, 아니면 3방향 후 거꾸로 빼서 공개본과 같은지 본다.
for (const f of list(changedArg)) {
  const liveRaw = lf(sh(pub, ['show', `${P}:try/travel/${f}`])), live = liveRaw.split('\n').map(l => (/^[ \t]+$/.test(l) ? '' : l)).join('\n');
  const base = lf(sh(src, ['show', `${oldRev}:experiences/path-travel/${f}`])), mine = lf(sh(src, ['show', `${newRev}:experiences/path-travel/${f}`]));
  let merged, how;
  if (rewrite(base) === live) { merged = rewrite(mine); how = '경로 고쳐 쓰기'; }
  else {
    const [a, b, c] = ['live', 'base', 'mine'].map(n => path.join(tmp, `${f}.${n}`));
    fs.writeFileSync(a, live); fs.writeFileSync(b, rewrite(base)); fs.writeFileSync(c, rewrite(mine));
    try { merged = execFileSync('git', ['merge-file', '-p', a, b, c], { maxBuffer: 1 << 28 }).toString('utf8'); }
    catch (e) { throw new Error(`${f}: 3방향 충돌 ${e.status}개 — 멈춤`); }
    const m = path.join(tmp, `${f}.merged`); fs.writeFileSync(m, merged);
    const back = execFileSync('git', ['merge-file', '-p', m, c, b], { maxBuffer: 1 << 28 }).toString('utf8');
    if (back !== live) throw new Error(`${f}: 내 변경을 빼면 공개본과 달라짐 — 멈춤`);
    how = '3방향';
  }
  const added = merged.split('\n').filter(l => !liveRaw.split('\n').includes(l) && bad.test(l));
  if (added.length) throw new Error(`${f}: 새 줄에 도구 이름·로컬 주소 — ${added[0].slice(0, 120)}`);
  fs.writeFileSync(path.join(out, f), merged);
  report.files[f] = { how, liveBytes: Buffer.byteLength(liveRaw), candidateBytes: Buffer.byteLength(merged), changed: merged !== liveRaw };
}
// 새 파일: 공개본에 없어야 하고, 같은 폴더 모듈만 가져온다.
for (const f of list(addedArg)) {
  if (exists(f)) throw new Error(`공개본에 이미 있는 파일: ${f}`);
  const text = rewrite(lf(sh(src, ['show', `${newRev}:experiences/path-travel/${f}`])));
  if (/from\s*['"]\.\.\//.test(text)) throw new Error(`${f}: 상위 폴더 모듈을 가져온다 — 공개 트리에서 고쳐 써야 함`);
  const flagged = text.split('\n').filter(l => bad.test(l));
  if (flagged.length) throw new Error(`${f}: 도구 이름·로컬 주소 — ${flagged[0].slice(0, 120)}`);
  fs.writeFileSync(path.join(out, f), text);
  report.files[f] = { how: '새 파일', candidateBytes: Buffer.byteLength(text) };
}
fs.rmSync(tmp, { recursive: true, force: true });
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
