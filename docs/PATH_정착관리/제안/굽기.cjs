#!/usr/bin/env node
'use strict';
/**
 * 전북 협력 제안 문서 굽기 — 원고 HTML → 글꼴을 심은 PDF.
 *
 * 하는 일: 이 폴더의 `<이름>_원고.html` 마다 SUIT Variable(tools/lib/브랜드폰트.js)을 얹은 임시 원고를 만들고,
 * docs/tools/브랜드폰트_임베드.py 로 나머지 글꼴(Inter Tight·DM Mono·낫표)을 심어 `<이름>.pdf` 를 뽑는다.
 * 원고에 `<!--@공통CSS@-->` 가 있으면 같은 폴더의 `제안_공통.css` 를, `<!--@로고@-->` 가 있으면 `synk-로고.svg` 를 그 자리에 넣는다.
 * `src="그림/…"` 은 같은 폴더 그림/ 의 파일을 데이터 주소로 심는다(참고 자료의 앱 화면 시안 펠트 물건).
 *
 * 왜 SUIT Variable을 따로 얹나(2026-10-22 실측): 임베드 도구가 싣는 정적 SUIT 서브셋에 공백 글리프가 빠져,
 * PDF의 공백 약 700개가 맑은 고딕으로 찍혔다(docs/발표물 PDF도 같은 모양). 가변 SUIT를 앞에 두면 공백까지 SUIT다.
 * 원고에는 가변 폰트(약 610KB)를 박지 않는다 — 굽기 때만 임시 원고에 얹는다(브랜드폰트.js 머리말과 같은 원칙).
 *
 * 쓰기: node docs/PATH_정착관리/제안/굽기.cjs [이름…] [--html] [--채울값 <json> --출력 <폴더>]
 *   이름 없이 부르면 이 폴더의 원고를 모두 굽는다. 이름은 `_원고.html` 앞부분(예: 전북_광역형비자_정착과제_협력제안서).
 *   --html 을 주면 글꼴을 심은 HTML도 PDF 옆에 남긴다(저장소에는 올리지 않는다 — 원고에서 다시 만든다).
 *   --채울값 은 「보내는 판」이다: json의 키마다 원고의 자리표 `<span class="hold">[키]</span>`를 값으로 바꿔 굽고,
 *   PDF(와 --html)는 --출력 폴더에만 쓴다. 이름·전화 같은 값이 공개 저장소에 들어가지 않게 값 파일과 --출력은 저장소 밖이어야 한다.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const 폰트 = require(path.join(ROOT, 'tools', 'lib', '브랜드폰트.js'));
const 꼬리 = '_원고.html';
const html남김 = process.argv.includes('--html');
const 값뒤 = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const 채울값경로 = 값뒤('--채울값');
const 출력폴더 = 값뒤('--출력');
// 다른 드라이브면 path.relative가 절대 경로를 돌려준다 — 그것도 저장소 밖이다.
const 저장소밖 = (p) => { const rel = path.relative(ROOT, path.resolve(p)); return rel.startsWith('..') || path.isAbsolute(rel); };
if (채울값경로 && !출력폴더) throw new Error('--채울값 에는 --출력(저장소 밖 폴더)이 필요하다');
if (채울값경로 && !저장소밖(채울값경로)) throw new Error('--채울값 파일은 저장소 밖에 두어야 한다 — 이름·전화가 든다');
if (출력폴더 && !저장소밖(출력폴더)) throw new Error('--출력 은 저장소 밖이어야 한다 — 보내는 판에는 이름·전화가 든다');
const 채울값 = 채울값경로 ? JSON.parse(fs.readFileSync(채울값경로, 'utf8')) : null;
const 글로 = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const 둘곳 = 출력폴더 || __dirname;
const 고른 = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && !['--채울값', '--출력'].includes(all[i - 1]));
const 이름들 = 고른.length ? 고른 : fs.readdirSync(__dirname).filter((f) => f.endsWith(꼬리)).map((f) => f.slice(0, -꼬리.length)).sort();
if (!이름들.length) throw new Error('구울 원고가 없다');

const 붙일것 = {
  '<!--@공통CSS@-->': () => `<style>\n${fs.readFileSync(path.join(__dirname, '제안_공통.css'), 'utf8')}</style>`,
  '<!--@로고@-->': () => fs.readFileSync(path.join(__dirname, 'synk-로고.svg'), 'utf8').trim(),
};

const py = process.platform === 'win32' ? 'python' : 'python3';
let 실패 = 0;
for (const 이름 of 이름들) {
  const 원고 = path.join(__dirname, `${이름}${꼬리}`);
  const pdf = path.join(둘곳, `${이름}.pdf`);
  let 글 = fs.readFileSync(원고, 'utf8');
  for (const [표, 읽기] of Object.entries(붙일것)) if (글.includes(표)) 글 = 글.split(표).join(읽기());
  // 원고의 그림(이 폴더의 그림/)은 데이터 주소로 심는다 — 임시 원고는 저장소 밖에서 구워져 상대 경로가 끊긴다.
  글 = 글.replace(/src="(그림\/[^"]+)"/g, (_, 상대) => {
    const 파일 = path.join(__dirname, 상대);
    const 꼴 = { '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg' }[path.extname(파일).toLowerCase()];
    if (!꼴 || !fs.existsSync(파일)) throw new Error(`${이름}: 심을 그림이 없다 — ${상대}`);
    return `src="data:${꼴};base64,${fs.readFileSync(파일).toString('base64')}"`;
  });
  if (채울값) {
    for (const [키, 값] of Object.entries(채울값)) 글 = 글.split(`<span class="hold">[${키}]</span>`).join(글로(값));
    const 남은 = [...글.matchAll(/<span class="hold">\[([^\]]+)\]<\/span>/g)].map((m) => m[1]);
    if (남은.length) console.log(`  ${이름}: 채우지 않은 자리표 ${[...new Set(남은)].join(', ')}`);
  }
  if (!글.includes("'SUIT Variable'")) throw new Error(`${이름}: 글꼴 목록에 'SUIT Variable'이 없다 — 가변 SUIT가 쓰이지 않는다`);
  if (!글.includes('<!--@PAGED@-->')) throw new Error(`${이름}: 쪽번호 마커가 없다`);
  글 = 글.replace('<!--@PAGED@-->', `${폰트.블록()}\n<!--@PAGED@-->`);

  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-제안서-'));
  const 임시원고 = path.join(방, `${이름}${꼬리}`);
  const 출력html = path.join(html남김 ? 둘곳 : 방, `${이름}.html`);
  fs.writeFileSync(임시원고, 글, 'utf8');
  const r = spawnSync(py, [path.join(ROOT, 'docs', 'tools', '브랜드폰트_임베드.py'), 임시원고, 출력html, '--pdf', pdf],
    { encoding: 'utf8', timeout: 600000 });
  try { fs.rmSync(방, { recursive: true, force: true }); } catch { /* 청소 실패는 결과와 무관 */ }
  if (r.status !== 0) {
    if (r.stdout) process.stdout.write(r.stdout);
    if (r.stderr) process.stderr.write(r.stderr);
    console.error(`굽기 실패(rc=${r.status}): ${이름}`);
    실패++;
    continue;
  }
  console.log(`PDF → ${path.relative(ROOT, pdf)}${html남김 ? ` · HTML → ${path.relative(ROOT, 출력html)}` : ''}`);
}
if (실패) process.exit(1);
