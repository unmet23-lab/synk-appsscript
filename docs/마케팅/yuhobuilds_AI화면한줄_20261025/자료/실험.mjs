// Y5 실험 — 같은 요청에 한 줄을 붙이면 AI가 만든 첫 화면이 달라지는지 본다.
// node 실험.mjs <판이름> <모델> <반복> [요청키…]
//   판이름: 기준 | 한줄A | 한줄B … (아래 「붙일 줄」)
//   모델: claude CLI 별칭(sonnet · opus)
//   공식 claude CLI(구독)를 저장소 밖 빈 폴더(<임시>/y5실험/<판>/<이름>/)에서 한 번씩 띄운다 — 저장소 규칙·메모가 섞이지 않게.
//   API 크레딧 키가 없는 날(10-25)이라 키 통로 대신 이렇게 했다.
//   결과: 실험/<판이름>/<이름>.html · .png(1280×800 첫 화면) · _전체.png · 기록.jsonl
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 루트 = path.resolve(여기, '../../../..');
const { chromium } = require(path.join(루트, 'node_modules/playwright'));

export const 요청 = {
  빵집: '동네 빵집 홈페이지 첫 화면을 만들어 줘. HTML 파일 하나로.',
  필라테스: '필라테스 학원 홈페이지 첫 화면을 만들어 줘. HTML 파일 하나로.',
  세무사: '1인 세무사 사무실 홈페이지 첫 화면을 만들어 줘. HTML 파일 하나로.',
};

export const 붙일줄 = {
  기준: '',
  한줄A: '보라색 그라데이션, 똑같은 카드 세 개, 이모지 아이콘은 쓰지 마.',
  한줄B: '먼저 이 가게에 어울리는 실제 물건 하나(간판, 포장지, 메뉴판 같은)를 정하고, 그 물건의 색과 글씨로 화면을 만들어 줘.',
  한줄C: '흔한 AI 디자인 말고, 이 가게만의 분위기 하나를 정해서 색과 글씨를 끝까지 그걸로 맞춰 줘.',
};

const [판, 모델 = 'sonnet', 반복 = '1', ...키들] = process.argv.slice(2);
if (!(판 in 붙일줄)) { console.error('판이름:', Object.keys(붙일줄).join(' | ')); process.exit(1); }
const 고른요청 = 키들.length ? 키들 : Object.keys(요청);
const 폴더 = path.join(여기, '실험', 판);
const 빈폴더뿌리 = path.join(process.env.SYNK_Y5_TMP || os.tmpdir(), 'y5실험', 판);
fs.mkdirSync(폴더, { recursive: true });

function claude돌리기(말, 곳) {
  fs.rmSync(곳, { recursive: true, force: true });
  fs.mkdirSync(곳, { recursive: true });
  return new Promise((resolve) => {
    const 자식 = spawn('claude', ['-p', 말, '--model', 모델, '--permission-mode', 'acceptEdits', '--output-format', 'json'],
      { cwd: 곳, shell: false, env: { ...process.env, ANTHROPIC_API_KEY: '' } });
    let 출력 = '';
    자식.stdout.on('data', (d) => { 출력 += d; });
    자식.stderr.on('data', (d) => { 출력 += d; });
    자식.on('close', (code) => resolve({ code, 출력 }));
  });
}

function html찾기(곳, 출력) {
  const 파일들 = fs.readdirSync(곳, { recursive: true }).filter((f) => /\.html?$/i.test(String(f)));
  if (파일들.length) return fs.readFileSync(path.join(곳, String(파일들[0])), 'utf8');
  let 글 = 출력;
  try { 글 = JSON.parse(출력).result || 출력; } catch { /* 그대로 */ }
  const 막 = 글.match(/```html\s*([\s\S]*?)```/i);
  return 막 ? 막[1] : null;
}

const 일 = [];
for (const 키 of 고른요청) for (let n = 1; n <= Number(반복); n++) 일.push({ 키, n });

const 브라우저 = await chromium.launch({ channel: 'chrome' });
await Promise.all(일.map(async ({ 키, n }) => {
  const 말 = 붙일줄[판] ? `${요청[키]} ${붙일줄[판]}` : 요청[키];
  const 이름 = `${키}_${모델}_${n}`;
  const 곳 = path.join(빈폴더뿌리, 이름);
  const { code, 출력 } = await claude돌리기(말, 곳);
  let 비용 = null;
  try { const j = JSON.parse(출력); 비용 = { usage: j.usage, 초: j.duration_ms / 1000 }; } catch { /* 없음 */ }
  const html = html찾기(곳, 출력);
  fs.appendFileSync(path.join(폴더, '기록.jsonl'), JSON.stringify({ 시각: new Date().toISOString(), 이름, 모델, 말, code, 비용, html있음: !!html }) + '\n');
  if (!html) { console.log(이름, 'HTML 없음', code, 출력.slice(-300)); return; }
  const 파일 = path.join(폴더, `${이름}.html`);
  fs.writeFileSync(파일, html);
  const 쪽 = await 브라우저.newPage({ viewport: { width: 1280, height: 800 } });
  await 쪽.goto('file:///' + 파일.replace(/\\/g, '/'), { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await 쪽.waitForTimeout(2000);
  await 쪽.screenshot({ path: path.join(폴더, `${이름}.png`) });
  await 쪽.screenshot({ path: path.join(폴더, `${이름}_전체.png`), fullPage: true });
  await 쪽.close();
  console.log(이름, '찍음');
}));
await 브라우저.close();
