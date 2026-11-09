'use strict';
// 원본 ../solo-backup/ui 화면 파일을 dist/로 그대로 복사합니다.
// index.html은 CSP meta 교체와 app.js 앞 bridge.js 한 줄 추가만 합니다.
// 삭제는 하지 않으며 outputs 목록의 파일 이름만 씁니다.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const APP_ROOT = path.resolve(__dirname, '..');
const ORIGINAL_ROOT = path.resolve(APP_ROOT, '..', 'solo-backup');
const UI = path.join(ORIGINAL_ROOT, 'ui');
const BRIDGE = path.join(APP_ROOT, 'bridge', 'bridge.js');
const DIST = path.join(APP_ROOT, 'dist');
const TRAY_CANDIDATES = [path.join(UI, 'tray.png'), path.join(ORIGINAL_ROOT, 'assets', 'tray.png')];
const ORIGINAL_CSP = `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; base-uri 'none'; form-action 'none'`;
const STAGED_CSP = `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' ipc: http://ipc.localhost; base-uri 'none'; form-action 'none'`;
const meta = p => `<meta http-equiv="Content-Security-Policy" content="${p}">`;
const APP_TAG = `<script src='app.js' defer></script>`;
const BRIDGE_TAG = `<script src='bridge.js'></script>`;
const PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const FORBIDDEN = ['http:', 'https:', 'fetch(', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'eval(', 'new Function', 'import(', '<script'];

class Refusal extends Error {}
const refuse = m => { throw new Refusal(m); };
const count = (t, n) => t.split(n).length - 1;
const expect = (t, n, k, label) => { const c = count(t, n); if (c !== k) refuse(`${label}: 기대 ${k}회, 실제 ${c}회`); };
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const statOrNull = p => { try { return fs.lstatSync(p); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } };
const inside = (child, parent) => { const r = path.relative(parent, child); return r === '' || (!r.startsWith('..') && !path.isAbsolute(r)); };

function readFile(p) {
  const s = statOrNull(p);
  if (!s || s.isSymbolicLink() || !s.isFile()) refuse(`일반 파일이 아님: ${p}`);
  return fs.readFileSync(p);
}

function utf8(b, label) {
  const t = b.toString('utf8');
  if (!Buffer.from(t, 'utf8').equals(b)) refuse(`${label}: 올바른 UTF-8 아님`);
  return t;
}

function readTray() {
  const found = TRAY_CANDIDATES.filter(p => statOrNull(p));
  if (found.length === 0) refuse('원본 tray.png 없음');
  const bufs = found.map(readFile);
  if (bufs.some(b => !b.equals(bufs[0]))) refuse('내용이 다른 tray.png가 여러 개 있음');
  if (!bufs[0].subarray(0, 8).equals(PNG)) refuse('tray.png가 PNG 아님');
  return { source: found[0], data: bufs[0] };
}

function stageHtml(buf) {
  const text = utf8(buf, 'index.html');
  expect(text, meta(ORIGINAL_CSP), 1, '원본 CSP meta');
  expect(text, 'Content-Security-Policy', 1, 'CSP 선언');
  expect(text, APP_TAG, 1, '원본 app.js script');
  expect(text.toLowerCase(), '<script', 1, 'script 태그');
  expect(text, 'bridge.js', 0, '기존 bridge.js 참조');
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const out = text.replace(meta(ORIGINAL_CSP), () => meta(STAGED_CSP)).replace(APP_TAG, () => BRIDGE_TAG + eol + APP_TAG);
  expect(out, meta(STAGED_CSP), 1, '새 CSP meta');
  expect(out, 'Content-Security-Policy', 1, '새 CSP 선언');
  expect(out, BRIDGE_TAG, 1, 'bridge.js script');
  expect(out.toLowerCase(), '<script', 2, '스테이징 script 태그');
  const b = out.indexOf(BRIDGE_TAG);
  const a = out.indexOf(APP_TAG);
  const h = out.indexOf('</head>');
  if (!(b < a && a < h)) refuse('bridge.js는 head 안에서 app.js보다 먼저여야 함');
  const back = out.replace(BRIDGE_TAG + eol, () => '').replace(meta(STAGED_CSP), () => meta(ORIGINAL_CSP));
  if (back !== text) refuse('index.html에 의도하지 않은 변경이 생김');
  return Buffer.from(out, 'utf8');
}

function checkBridge(buf) {
  const t = utf8(buf, 'bridge.js');
  for (const s of [`'backup_call'`, `'backup:state'`, 'Object.freeze']) if (!t.includes(s)) refuse(`bridge.js 필수 항목 없음: ${s}`);
  for (const s of FORBIDDEN) if (t.includes(s)) refuse(`bridge.js 금지 항목: ${s}`);
}

function main() {
  if (path.basename(APP_ROOT) !== 'solo-backup-rust') refuse('앱 폴더 이름이 solo-backup-rust가 아님');
  if (inside(DIST, ORIGINAL_ROOT) || inside(ORIGINAL_ROOT, APP_ROOT)) refuse('원본 폴더와 출력 폴더가 겹침');
  const htmlPath = path.join(UI, 'index.html');
  const cssPath = path.join(UI, 'style.css');
  const appPath = path.join(UI, 'app.js');
  const html = readFile(htmlPath);
  const css = readFile(cssPath);
  const app = readFile(appPath);
  const tray = readTray();
  const bridge = readFile(BRIDGE);
  checkBridge(bridge);
  const originals = [[htmlPath, html], [cssPath, css], [appPath, app], [tray.source, tray.data]];
  const outputs = [
    ['index.html', stageHtml(html)],
    ['style.css', css],
    ['bridge.js', bridge],
    ['app.js', app],
    ['tray.png', tray.data],
    ['csp.txt', Buffer.from(STAGED_CSP + '\n', 'utf8')]
  ];
  const d = statOrNull(DIST);
  if (d && (d.isSymbolicLink() || !d.isDirectory())) refuse('dist가 일반 폴더가 아님');
  for (const [name] of outputs) {
    const s = statOrNull(path.join(DIST, name));
    if (s && (s.isSymbolicLink() || !s.isFile())) refuse(`출력이 일반 파일이 아님: ${name}`);
  }
  fs.mkdirSync(DIST, { recursive: true });
  for (const [name, data] of outputs) fs.writeFileSync(path.join(DIST, name), data);
  for (const [name, data] of outputs) if (!fs.readFileSync(path.join(DIST, name)).equals(data)) refuse(`기록 확인 실패: ${name}`);
  for (const [p, data] of originals) if (!fs.readFileSync(p).equals(data)) refuse(`원본이 바뀜: ${p}`);
  for (const [name, data] of outputs) console.log(`${hash(data)}  dist/${name}`);
}

try {
  main();
} catch (e) {
  console.error(e instanceof Refusal ? `stage-ui 거부: ${e.message}` : `stage-ui 실패: ${e && e.message}`);
  process.exitCode = 1;
}
