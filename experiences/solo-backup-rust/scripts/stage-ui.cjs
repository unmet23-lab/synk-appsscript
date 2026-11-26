'use strict';
// 화면 원천 ui/를 dist/로 옮긴다(Tauri frontendDist). 1단계부터 화면은 이 패키지의 ui/이고, 0.5.0 화면(../solo-backup/ui)은 트레이 그림만 빌린다.
// - 옮기는 파일은 아래 목록뿐이다. 시험용 예시 상태(engine-fixtures.js)와 ui/package.json은 옮기지 않는다.
// - index.html의 CSP meta와 스크립트 두 줄(bridge.js 고전 스크립트 → app.js 모듈)이 정확히 그 꼴인지 본다.
// - 화면 스크립트에 바깥 연결 · 동적 실행 · 인라인 style이 없는지 본다(CSP style-src 'self'가 막는 것을 빌드 때 먼저 잡는다).
// - SUIT 글꼴은 저장소 정본(tools/lib/브랜드폰트.js)의 지문과 같은 바이트만 싣고 OFL 고지를 함께 둔다.
// 지우는 일은 하지 않고, 목록의 이름만 덮어쓴다(dist/에 남은 옛 파일은 Tauri가 싣지 않도록 목록 밖이면 알린다).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const APP_ROOT = path.resolve(__dirname, '..');
const UI = path.join(APP_ROOT, 'ui');
const BRIDGE = path.join(APP_ROOT, 'bridge', 'bridge.js');
const DIST = path.join(APP_ROOT, 'dist');
const REPO = path.resolve(APP_ROOT, '..', '..');
const ORIGINAL_ROOT = path.resolve(APP_ROOT, '..', 'solo-backup');
const TRAY_CANDIDATES = [path.join(ORIGINAL_ROOT, 'ui', 'tray.png'), path.join(ORIGINAL_ROOT, 'assets', 'tray.png')];
const CSP = `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self' ipc: http://ipc.localhost; base-uri 'none'; form-action 'none'`;
const MODULES = ['app.js', 'state-store.js', 'screen-model.js', 'ko-format.js', 'banned-words.js', 'screen-view.js', 'orb.js', 'fake-screens.js'];
// What dist/ gets, in this order (main). stage-resources.cjs puts the same files in resources/ui/ for SYNK 솔리오's engine
// screen (SOLIO_ONE_CLIENT.md 2.2).
const FILES = ['index.html', 'style.css', 'bridge.js', ...MODULES, 'fonts/SUIT-Variable.woff2', 'fonts/LICENSE_OFL.txt', 'tray.png', 'csp.txt'];
const PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const FORBIDDEN_JS = ['fetch(', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'eval(', 'new Function', 'import(', 'http://', 'https://', 'style="', "style='", 'document.write', 'setAttribute(\'style\''];
const FORBIDDEN_BRIDGE = ['http:', 'https:', 'fetch(', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'eval(', 'new Function', 'import(', '<script'];

class Refusal extends Error {}
const refuse = (m) => { throw new Refusal(m); };
const count = (t, n) => t.split(n).length - 1;
const expect = (t, n, k, label) => { const c = count(t, n); if (c !== k) refuse(`${label}: 기대 ${k}회, 실제 ${c}회`); };
const hash = (b) => crypto.createHash('sha256').update(b).digest('hex');
const statOrNull = (p) => { try { return fs.lstatSync(p); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } };

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

function checkHtml(buf) {
  const t = utf8(buf, 'index.html');
  expect(t, `<meta http-equiv="Content-Security-Policy" content="${CSP}">`, 1, 'CSP meta');
  expect(t, 'Content-Security-Policy', 1, 'CSP 선언');
  expect(t.toLowerCase(), '<script', 2, 'script 태그');
  expect(t, '<script src="bridge.js"></script>', 1, 'bridge.js script');
  expect(t, '<script type="module" src="app.js"></script>', 1, 'app.js 모듈');
  if (t.indexOf('bridge.js') > t.indexOf('app.js')) refuse('bridge.js가 app.js보다 먼저여야 함');
  if (/\sstyle=/.test(t)) refuse('index.html에 인라인 style');
  if (/<style/i.test(t)) refuse('index.html에 style 태그');
  if (/https?:\/\//.test(t.replace(CSP, ''))) refuse('index.html에 바깥 주소');
}

function checkModule(name, buf) {
  const t = utf8(buf, name);
  for (const s of FORBIDDEN_JS) if (t.includes(s)) refuse(`${name} 금지 항목: ${s}`);
  // 모듈끼리만 가져온다(./이름.js) — 목록 밖 파일을 부르면 dist에 없어 화면이 멈춘다
  for (const m of t.matchAll(/^\s*import\s[^'"]*['"]([^'"]+)['"]/gm)) {
    const target = m[1].replace(/^\.\//, '');
    if (!m[1].startsWith('./') || !MODULES.includes(target)) refuse(`${name}: 목록 밖 모듈 ${m[1]}`);
  }
}

function checkBridge(buf) {
  const t = utf8(buf, 'bridge.js');
  for (const s of [`'backup_call'`, `'backup:state'`, 'Object.freeze']) if (!t.includes(s)) refuse(`bridge.js 필수 항목 없음: ${s}`);
  for (const s of FORBIDDEN_BRIDGE) if (t.includes(s)) refuse(`bridge.js 금지 항목: ${s}`);
}

function readTray() {
  const found = TRAY_CANDIDATES.filter((p) => statOrNull(p));
  if (found.length === 0) refuse('원본 tray.png 없음');
  const bufs = found.map(readFile);
  if (bufs.some((b) => !b.equals(bufs[0]))) refuse('내용이 다른 tray.png가 여러 개 있음');
  if (!bufs[0].subarray(0, 8).equals(PNG)) refuse('tray.png가 PNG 아님');
  return bufs[0];
}

function readFont() {
  const 폰트 = require(path.join(REPO, 'tools/lib/브랜드폰트.js'));
  const font = readFile(폰트.경로);
  if (font.length !== 폰트.바이트 || hash(font) !== 폰트.지문) refuse('SUIT 글꼴이 정본 지문과 다름');
  const license = readFile(path.join(path.dirname(폰트.경로), 'LICENSE_OFL.txt'));
  return { font, license };
}

function main() {
  if (path.basename(APP_ROOT) !== 'solo-backup-rust') refuse('앱 폴더 이름이 solo-backup-rust가 아님');
  const html = readFile(path.join(UI, 'index.html'));
  checkHtml(html);
  const css = readFile(path.join(UI, 'style.css'));
  if (/@import|url\((?!fonts\/SUIT-Variable\.woff2\))/.test(utf8(css, 'style.css'))) refuse('style.css가 목록 밖 자원을 부름');
  const modules = MODULES.map((name) => { const b = readFile(path.join(UI, name)); checkModule(name, b); return [name, b]; });
  const bridge = readFile(BRIDGE);
  checkBridge(bridge);
  const { font, license } = readFont();
  const outputs = [
    ['index.html', html], ['style.css', css], ['bridge.js', bridge], ...modules,
    ['fonts/SUIT-Variable.woff2', font], ['fonts/LICENSE_OFL.txt', license],
    ['tray.png', readTray()], ['csp.txt', Buffer.from(CSP + '\n', 'utf8')],
  ];
  if (outputs.map(([n]) => n).join('\n') !== FILES.join('\n')) refuse('출력 목록이 FILES와 다름');
  const d = statOrNull(DIST);
  if (d && (d.isSymbolicLink() || !d.isDirectory())) refuse('dist가 일반 폴더가 아님');
  for (const [name] of outputs) {
    const s = statOrNull(path.join(DIST, name));
    if (s && (s.isSymbolicLink() || !s.isFile())) refuse(`출력이 일반 파일이 아님: ${name}`);
  }
  fs.mkdirSync(path.join(DIST, 'fonts'), { recursive: true });
  for (const [name, data] of outputs) fs.writeFileSync(path.join(DIST, name), data);
  for (const [name, data] of outputs) if (!fs.readFileSync(path.join(DIST, name)).equals(data)) refuse(`기록 확인 실패: ${name}`);
  const listed = new Set(outputs.map(([n]) => n.replace(/\\/g, '/')));
  const walk = (dir, pre = '') => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name), `${pre}${e.name}/`) : [`${pre}${e.name}`]));
  const stray = walk(DIST).filter((n) => !listed.has(n));
  if (stray.length) console.warn(`stage-ui 알림: dist에 목록 밖 파일이 남아 있습니다(지우지 않음) — ${stray.join(', ')}`);
  for (const [name, data] of outputs) console.log(`${hash(data)}  dist/${name}`);
}

module.exports = { CSP, MODULES, FILES, DIST };
if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error(e instanceof Refusal ? `stage-ui 거부: ${e.message}` : `stage-ui 실패: ${e && e.message}`);
    process.exitCode = 1;
  }
}
