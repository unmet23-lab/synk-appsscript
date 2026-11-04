// 시안 묶음 만들기: 고객 앱의 실제 모듈 · 스타일 · 그림을 한 폴더에 복사해 서버 없이 띄운다(고객 앱과 같은 상대 경로).
// node docs/마케팅/PULSE_의뢰흐름_20261104/시안/build.cjs <나갈 폴더>
const fs = require('fs'), path = require('path');
const here = __dirname, app = path.join(here, '..', '..', '온라인마케팅지도', 'engagement', 'company', 'public', 'pulse-app');
const out = process.argv[2]; if (!out) { console.error('나갈 폴더를 주세요'); process.exit(2); }
fs.rmSync(path.join(out, 'pulse-app'), { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'assets', 'request'), { recursive: true });
fs.mkdirSync(path.join(out, 'assets', 'casting'), { recursive: true });
const copy = (from, to) => fs.copyFileSync(from, to);
for (const name of ['index.html', 'proto.mjs', 'proto.css']) copy(path.join(here, name), path.join(out, name));
for (const name of ['motion.mjs', 'request-data.mjs', 'request-flow.mjs', 'film-views.mjs', 'room-view.mjs', 'desk-view.mjs', 'demo-film.mjs', 'api.mjs', 'casting-catalog.mjs', 'slate.css', 'slate-screens.css']) copy(path.join(app, name), path.join(out, name));
for (const name of ['SUIT.woff2', 'SYNKLatin-Regular.woff2', 'SYNKLatin-SemiBold.woff2', 'SYNKLatin-Bold.woff2', 'InterTight.woff2', 'DMMono.ttf', 'brand-pulse.webp']) copy(path.join(app, 'assets', name), path.join(out, 'assets', name));
for (const name of fs.readdirSync(path.join(app, 'assets', 'request'))) copy(path.join(app, 'assets', 'request', name), path.join(out, 'assets', 'request', name));
for (const name of fs.readdirSync(path.join(app, 'assets', 'casting'))) if (name.endsWith('.webp')) copy(path.join(app, 'assets', 'casting', name), path.join(out, 'assets', 'casting', name));
fs.mkdirSync(path.join(out, 'assets', 'casting', 'photos'), { recursive: true });
for (const name of fs.readdirSync(path.join(app, 'assets', 'casting', 'photos'))) if (name.endsWith('-context.webp')) copy(path.join(app, 'assets', 'casting', 'photos', name), path.join(out, 'assets', 'casting', 'photos', name));
const css = fs.readFileSync(path.join(app, 'app.css'), 'utf8').split('\n').filter(line => line.startsWith('@font-face')).join('\n');
fs.writeFileSync(path.join(out, 'fonts.css'), css + '\n');
// 바뀐 점의 전후 비교: 지금 화면 캡처(git 밖 synk-vendor)와 새 판 캡처(scratchpad shots)를 함께 싣는다. 없으면 그 칸만 빈다.
const vendor = process.env.PULSE_BEFORE_DIR || 'C:/Users/q1212/Documents/synk-vendor/pulse-platform-20261104/research/shots-now';
fs.mkdirSync(path.join(out, 'before'), { recursive: true });
for (const name of ['d-app-entry.jpg', 'd-demo-strategy.jpg', 'd-demo-storyboard.jpg']) if (fs.existsSync(path.join(vendor, name))) copy(path.join(vendor, name), path.join(out, 'before', name));
console.log('시안 묶음', out, fs.readdirSync(out).length);
