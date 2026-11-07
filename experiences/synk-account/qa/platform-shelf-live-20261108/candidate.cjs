// A 진열대(2026-11-08) 공개 후보 파일을 한 폴더에 모은다(공개는 하지 않는다 — 부모 세션이 tools/공개.js로).
// 쓰기: node candidate.cjs <공개본 account 폴더(받은 그대로)> <patch-live.cjs가 만든 platform.js> <출력 폴더>
// 출력: <출력>/account/… (공개 경로 그대로) + files.json(공개 경로 → 파일, 바이트, sha256)
//  - platform.html: 작업본 원천 + 공개본에만 있는 두 가지(가입 추적 /social-conversion.js 줄, 글 · 묶음의 ?v= 토큰). 토큰이 없던
//    platform.css · theme.js도 이번에 뼈대가 통째로 바뀌므로 ?v=를 단다(캐시 10분 동안 새 HTML과 옛 CSS가 섞이지 않게).
//  - member-insight.css: 내 성향 화면 A 문법(공용 원천 desktop/renderer/member-insight.css).
//  - platform.webmanifest: 공개본 그대로에 색 두 칸만 흰 종이(#FFFFFF)로 — master 판의 다른 차이(start_url · 줄 모양)는 싣지 않는다.
'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const [liveDir, platformJs, outDir] = process.argv.slice(2);
if (!outDir) { console.error('쓰기: node candidate.cjs <공개본 account 폴더> <후보 platform.js> <출력 폴더>'); process.exit(2); }
const src = path.resolve(__dirname, '../..');
const fail = message => { console.error('멈춤: ' + message); process.exit(1); };
const sha = buf => crypto.createHash('sha256').update(buf).digest('hex');
const lf = buf => Buffer.from(buf.toString('utf8').replace(/\r\n/g, '\n'));
const files = new Map();
const put = (rel, buf) => { const target = path.join(outDir, 'account', rel); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, buf); files.set('account/' + rel, target); return buf; };

const js = put('dist/platform.js', fs.readFileSync(platformJs));
const css = put('platform.css', lf(fs.readFileSync(path.join(src, 'platform.css'))));
const benefits = put('benefits.css', lf(fs.readFileSync(path.join(src, 'benefits.css'))));
const theme = put('theme.js', lf(fs.readFileSync(path.join(src, 'theme.js'))));
// 내 성향 화면 모양(PC와 함께 쓰는 desktop/renderer/member-insight.css의 빌드 사본) — 이번 판에서 A 문법으로 바꿨다.
const insightCss = put('member-insight.css', lf(fs.readFileSync(path.join(src, 'member-insight.css'))));
for (const rel of ['assets/world-annyeong.webp', 'assets/laptop.webp', 'assets/scene-train.webp', 'assets/scene-gate.webp', 'assets/scene-idol.webp', 'assets/InterTight-SemiBold.woff2', 'assets/SYNKSans-ui.woff2', 'assets/SYNKSans-rest.woff2', 'assets/member/benefit-subscriptions.webp'])
  put(rel, fs.readFileSync(path.join(src, rel)));

// 페이지: 공개본의 토큰 값 · 가입 추적 줄을 그대로 옮긴다.
const liveHtml = fs.readFileSync(path.join(liveDir, 'platform.html'), 'utf8').replace(/\r\n/g, '\n');
const social = liveHtml.match(/<script type="module" src="\/social-conversion\.js\?v=[0-9a-f]+"><\/script>/)?.[0];
if (!social) fail('공개본 페이지에서 가입 추적 줄을 못 찾았다');
const token = buf => sha(buf).slice(0, 12);
let html = fs.readFileSync(path.join(src, 'platform.html'), 'utf8').replace(/\r\n/g, '\n');
const swaps = [
  ['<link rel="stylesheet" href="./platform.css">', `<link rel="stylesheet" href="./platform.css?v=${token(css)}">`],
  ['<link rel="stylesheet" href="./benefits.css">', `<link rel="stylesheet" href="./benefits.css?v=${token(benefits)}">`],
  ['<link rel="stylesheet" href="./member-insight.css">', `<link rel="stylesheet" href="./member-insight.css?v=${token(insightCss)}">`],
  ['<script src="./theme.js"></script></head>', `<script src="./theme.js?v=${token(theme)}"></script>${social}\n</head>`],
  ['<script type="module" src="./dist/platform.js"></script>', `<script type="module" src="./dist/platform.js?v=${token(js)}"></script>`],
];
for (const [a, b] of swaps) { if (html.split(a).length !== 2) fail('작업본 페이지에서 한 번만 맞지 않는다: ' + a); html = html.replace(a, b); }
put('platform.html', Buffer.from(html));

const manifest = fs.readFileSync(path.join(liveDir, 'platform.webmanifest'), 'utf8');
const nextManifest = manifest.replace('"background_color": "#08090C"', '"background_color": "#FFFFFF"').replace('"theme_color": "#08090C"', '"theme_color": "#FFFFFF"');
if (nextManifest === manifest || /#08090C/.test(nextManifest)) fail('공개본 매니페스트 색 두 칸을 못 바꿨다');
put('platform.webmanifest', Buffer.from(nextManifest));

const list = [...files].map(([pub, file]) => { const b = fs.readFileSync(file), live = path.join(liveDir, pub.slice('account/'.length)); return { 공개경로: pub, 파일: file, bytes: b.length, sha256: sha(b), 공개본: fs.existsSync(live) ? (sha(fs.readFileSync(live)) === sha(b) ? '같음' : '바뀜') : '새 파일' }; });
fs.writeFileSync(path.join(outDir, 'files.json'), JSON.stringify(list, null, 1) + '\n');
console.log(JSON.stringify(list.map(({ 공개경로, bytes, 공개본 }) => `${공개경로} ${bytes} ${공개본}`), null, 1));
console.log('공개.js 인자: ' + list.filter(f => f.공개본 !== '같음').map(f => `${f.공개경로}=${f.파일.replace(/\\/g, '/')}`).join(' '));
