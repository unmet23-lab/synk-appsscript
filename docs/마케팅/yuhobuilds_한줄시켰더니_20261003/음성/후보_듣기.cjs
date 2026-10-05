// 성우 후보 듣기 페이지: 같은 대본을 한 번에 읽힌 후보들(다듬은 take.wav)을 mp3로 줄여 한 장짜리 html에 넣는다.
// 실행(폴더 안에서): node 음성/후보_듣기.cjs 음성/후보/듣기_목록.json [--copy <바탕화면 폴더>]
// 목록: { "title", "lead", "items": [{ "no", "name", "desc", "file", "meta" }] } — file은 폴더 기준 경로.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const dir = path.join(__dirname, '..');
const listPath = path.resolve(dir, process.argv[2]);
const list = JSON.parse(fs.readFileSync(listPath, 'utf8'));
const copyTo = (() => { const i = process.argv.indexOf('--copy'); return i > 0 ? process.argv[i + 1] : null; })();
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const cards = list.items.map((it) => {
  const src = path.resolve(dir, it.file);
  const mp3 = execFileSync('ffmpeg', ['-v', 'error', '-i', src, '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '96k', '-f', 'mp3', 'pipe:1'], { maxBuffer: 64 << 20 });
  const sec = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', src], { encoding: 'utf8' }).trim());
  return `<article class="card${it.ref ? ' ref' : ''}">
  <div class="no">${esc(it.no)}</div>
  <div class="body">
    <h2>${esc(it.name)}</h2>
    <p class="desc">${esc(it.desc)}</p>
    <audio controls preload="metadata" src="data:audio/mpeg;base64,${mp3.toString('base64')}"></audio>
    <p class="meta">${sec.toFixed(1)}초${it.meta ? ' · ' + esc(it.meta) : ''}</p>
  </div>
</article>`;
});

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>성우 후보 듣기</title>
<style>
  :root { --bg: #f6f4ef; --card: #ffffff; --ink: #1d1d1f; --sub: #5b5f66; --line: #e3dfd6; --acc: #c99412; --ref: #eef0f3; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #141416; --card: #1f1f23; --ink: #f2f2f4; --sub: #a3a7ae; --line: #2e2e34; --acc: #f5c445; --ref: #26262c; } }
  :root[data-theme="dark"] { --bg: #141416; --card: #1f1f23; --ink: #f2f2f4; --sub: #a3a7ae; --line: #2e2e34; --acc: #f5c445; --ref: #26262c; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.6 "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif; }
  main { max-width: 760px; margin: 0 auto; padding: 32px 16px 56px; }
  h1 { font-size: 26px; line-height: 1.3; margin: 0 0 10px; }
  .lead { color: var(--sub); margin: 0 0 8px; }
  .script { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; color: var(--sub); font-size: 14px; white-space: pre-line; margin: 16px 0 24px; }
  .card { display: flex; gap: 14px; background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 16px; margin: 0 0 12px; }
  .card.ref { background: var(--ref); }
  .no { flex: 0 0 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; font-weight: 800; font-size: 18px; background: var(--acc); color: #1d1d1f; }
  .card.ref .no { background: var(--line); color: var(--ink); font-size: 13px; }
  .body { flex: 1; min-width: 0; }
  h2 { font-size: 18px; margin: 0 0 2px; }
  .desc { margin: 0 0 10px; color: var(--sub); font-size: 15px; }
  audio { width: 100%; }
  .meta { margin: 6px 0 0; color: var(--sub); font-size: 13px; }
  .foot { color: var(--sub); font-size: 14px; margin-top: 20px; }
</style>
</head>
<body>
<main>
  <h1>${esc(list.title)}</h1>
  <p class="lead">${esc(list.lead)}</p>
  <div class="script">${esc(list.script)}</div>
  ${cards.join('\n  ')}
  <p class="foot">${esc(list.foot || '')}</p>
</main>
</body>
</html>
`;
const out = path.join(path.dirname(listPath), '듣기.html');
fs.writeFileSync(out, html);
console.log(out, Math.round(html.length / 1024) + 'KB');
if (copyTo) { fs.mkdirSync(copyTo, { recursive: true }); fs.copyFileSync(out, path.join(copyTo, '성우_후보_듣기.html')); console.log('사본', path.join(copyTo, '성우_후보_듣기.html')); }
