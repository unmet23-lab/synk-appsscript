#!/usr/bin/env node
'use strict';
/**
 * 전북 협력 제안 문서 굽기 — 원고 HTML → 글꼴을 심은 PDF.
 *
 * 하는 일: 이 폴더의 `<이름>_원고.html` 마다 SUIT Variable(tools/lib/브랜드폰트.js)을 얹은 임시 원고를 만들고,
 * docs/tools/브랜드폰트_임베드.py 로 나머지 글꼴(Inter Tight·DM Mono·낫표)을 심어 `<이름>.pdf` 를 뽑는다.
 * 원고에 `<!--@공통CSS@-->` 가 있으면 같은 폴더의 `제안_공통.css` 를, `<!--@로고@-->` 가 있으면 `synk-로고.svg` 를 그 자리에 넣는다.
 *
 * 왜 SUIT Variable을 따로 얹나(2026-10-22 실측): 임베드 도구가 싣는 정적 SUIT 서브셋에 공백 글리프가 빠져,
 * PDF의 공백 약 700개가 맑은 고딕으로 찍혔다(docs/발표물 PDF도 같은 모양). 가변 SUIT를 앞에 두면 공백까지 SUIT다.
 * 원고에는 가변 폰트(약 610KB)를 박지 않는다 — 굽기 때만 임시 원고에 얹는다(브랜드폰트.js 머리말과 같은 원칙).
 *
 * 쓰기: node docs/PATH_정착관리/제안/굽기.cjs [이름…] [--html]
 *   이름 없이 부르면 이 폴더의 원고를 모두 굽는다. 이름은 `_원고.html` 앞부분(예: 전북_광역형비자_정착과제_협력제안서).
 *   --html 을 주면 글꼴을 심은 HTML도 같은 폴더에 남긴다(저장소에는 올리지 않는다 — 원고에서 다시 만든다).
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const 폰트 = require(path.join(ROOT, 'tools', 'lib', '브랜드폰트.js'));
const 꼬리 = '_원고.html';
const html남김 = process.argv.includes('--html');
const 고른 = process.argv.slice(2).filter((a) => !a.startsWith('--'));
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
  const pdf = path.join(__dirname, `${이름}.pdf`);
  let 글 = fs.readFileSync(원고, 'utf8');
  for (const [표, 읽기] of Object.entries(붙일것)) if (글.includes(표)) 글 = 글.split(표).join(읽기());
  if (!글.includes("'SUIT Variable'")) throw new Error(`${이름}: 글꼴 목록에 'SUIT Variable'이 없다 — 가변 SUIT가 쓰이지 않는다`);
  if (!글.includes('<!--@PAGED@-->')) throw new Error(`${이름}: 쪽번호 마커가 없다`);
  글 = 글.replace('<!--@PAGED@-->', `${폰트.블록()}\n<!--@PAGED@-->`);

  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-제안서-'));
  const 임시원고 = path.join(방, `${이름}${꼬리}`);
  const 출력html = html남김 ? path.join(__dirname, `${이름}.html`) : path.join(방, `${이름}.html`);
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
