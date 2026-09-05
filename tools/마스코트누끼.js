#!/usr/bin/env node
/* 마스코트 배경 제거 — 확정 렌더의 밝은 회색 배경을 지워 투명 PNG 사본을 만든다.
 *
 * ⚠ 유래 정직화(08-23 전수조사): 아래 실측은 **08-13 체리 렌더에서 잰 것**이고, 08-19 정본 교체
 * 커밋(01d11ca8 · 참조 57자리 일괄 재배선)이 경로만 펠트코랄_0815 로 치환해 「코랄 폴더를 08-13에
 * 쟀다」는 거짓 문장이 돼 있었다. 원리(무채 배경 × 유채 몸)는 코랄에도 그대로 유효하다 —
 * 코랄 코어(#F96859)도 고채도라 같은 축으로 갈린다. 펠트코랄 누끼 4벌이 이 도구의 실제 산출이고
 * 그 검증은 누끼/README.md 가 진다(알파 수리·놀람 합성 대장).
 *
 * 왜 필요한가 (원 실측 2026-08-13 · 체리판): 확정 렌더 PNG 는 README 표기가 「RGBA PNG」지만
 * 알파가 전부 255 — **투명 픽셀 0.0%** 다. 배경은 rgb~230 의 밝은 회색이라, 카드·화면에 그대로 얹으면
 * 마스코트마다 회색 사각형이 딸려 나온다(드롭섀도까지 사각형에 걸린다).
 *
 * 원본은 유호님이 배치한 자산이라 **건드리지 않는다** — 사본은 `누끼/` 하위로 쓴다(--출력).
 *
 * 가르는 기준은 «채도»다. 배경은 무채색(sat≈0.02)이고 마스코트 몸은 유채(체리판 실측 코어 sat 0.51 ·
 * 코랄도 같은 급)라 안전하게 갈린다. 밝기만으로 가르면 마스코트의 하이라이트가 같이 지워진다.
 *
 * 이미지 라이브러리가 없는 저장소라 크롬 canvas 를 계산기로 쓴다(브랜드렌더린트가 쓰는 그 크롬).
 *
 * 쓰기:
 *   node tools/마스코트누끼.js                 # 현행 정본 폴더 전체(정본_4K · 주인 = lib/마스코트자산.js)
 *   node tools/마스코트누끼.js 본체.png 본체놀람.png
 *   node tools/마스코트누끼.js --입력 docs/캐릭터/정본_4K --출력 docs/캐릭터/정본_4K/누끼 재염색_본체.png
 * 나가는 값: 0=전부 성공 · 1=일부 실패 · 2=크롬 없음(안 돌렸다 — 통과 아님)
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO = path.resolve(__dirname, '..');
/* 기본 대상 = **현행 정본 세트**. 폴더 이름을 여기 손으로 적지 않는다(2026-08-20) —
 * 정본이 갈리면 이 도구가 옛 세트를 계속 깎게 되고, 그게 마스코트 10벌 공존을 만든 병이다.
 * 주인은 `docs/디자인_토큰.json` 이고 `lib/마스코트자산.js` 가 그 창구다.
 * `--입력`·`--출력` 으로 다른 세트에도 같은 통로를 쓴다. */
const 자산 = require('./lib/마스코트자산.js');
let SRC_DIR = path.join(REPO, 자산.정본폴더);
let OUT_DIR = path.join(REPO, 자산.정본폴더);
const SIZE = 1024;              // 캐러셀 최대 사용폭 ~540px → 2배수로 충분(원본 2048 은 과하다)
const SAT_배경 = 0.055;         // 이 아래 + 밝으면 배경
const SAT_경계 = 0.13;          // 이 사이는 가장자리 → 알파를 비례로 (계단 방지)
const 밝기_배경 = 195;

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
const findChrome = () =>
  CHROME_CANDIDATES.find((p) => { try { return fs.existsSync(p); } catch { return false; } }) || null;

const fileUrl = (abs) =>
  'file:///' + abs.replace(/\\/g, '/').split('/').map((s, i) => (i === 0 ? s : encodeURIComponent(s))).join('/');

function 누끼(chrome, 이름, tmpDir) {
  // ⚠ textarea.value 는 --dump-dom 에 안 찍힌다(프로퍼티라 DOM 텍스트가 아니다) — div.textContent 로 낸다.
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>대기</title></head><body>
<div id="o"></div><script>
const img=new Image();
img.onload=()=>{
  const S=${SIZE};
  const c=document.createElement('canvas'); c.width=S; c.height=S;
  const x=c.getContext('2d',{willReadFrequently:true});
  x.imageSmoothingQuality='high';
  x.drawImage(img,0,0,S,S);
  const im=x.getImageData(0,0,S,S), d=im.data;
  for(let i=0;i<d.length;i+=4){
    const r=d[i],g=d[i+1],b=d[i+2];
    const mx=Math.max(r,g,b), mn=Math.min(r,g,b);
    const sat = mx===0 ? 0 : (mx-mn)/mx;
    if (sat < ${SAT_배경} && mx > ${밝기_배경}) { d[i+3]=0; }
    else if (sat < ${SAT_경계} && mx > ${밝기_배경 - 10}) {
      d[i+3] = Math.round(255 * ((sat-${SAT_배경})/(${SAT_경계}-${SAT_배경})));
    }
  }
  x.putImageData(im,0,0);
  document.getElementById('o').textContent = c.toDataURL('image/png');
  document.title='완료';
};
img.onerror=()=>{ document.getElementById('o').textContent='ERR'; document.title='완료'; };
img.src=${JSON.stringify(fileUrl(path.join(SRC_DIR, 이름)))};
</scr` + `ipt></body></html>`;

  const htmlPath = path.join(tmpDir, '_누끼작업.html');
  fs.writeFileSync(htmlPath, html, 'utf8');

  let dom;
  try {
    dom = execFileSync(chrome, ['--headless=new', '--disable-gpu', '--no-sandbox',
      '--allow-file-access-from-files', '--virtual-time-budget=25000', '--dump-dom', fileUrl(htmlPath)],
      { encoding: 'utf8', maxBuffer: 200 * 1024 * 1024, timeout: 120000 });
  } catch (e) {
    console.log(`  ❌ ${이름} — 크롬 실패: ${String(e.message).slice(0, 80)}`);
    return false;
  }

  const m = dom.match(/<div id="o">([^<]*)<\/div>/);
  const PREFIX = 'data:image/png;base64,';
  if (!m || !m[1].startsWith(PREFIX)) { console.log(`  ❌ ${이름} — 산출 없음`); return false; }

  const buf = Buffer.from(m[1].slice(PREFIX.length), 'base64');
  fs.writeFileSync(path.join(OUT_DIR, 이름), buf);
  const 원본 = fs.statSync(path.join(SRC_DIR, 이름)).size;
  console.log(`  ✅ ${이름} — ${(원본 / 1024 / 1024).toFixed(1)}MB → ${(buf.length / 1024).toFixed(0)}KB`);
  return true;
}

function main() {
  const chrome = findChrome();
  if (!chrome) {
    console.error('SKIP: 크롬을 못 찾았다 — 배경 제거를 **안 돌렸다**(통과 아님). CHROME_PATH 로 지정할 수 있다.');
    process.exit(2);
  }
  const 인자 = process.argv.slice(2);
  const 옵션빼기 = (이름) => {
    const i = 인자.indexOf(이름);
    if (i < 0) return null;
    const v = 인자[i + 1];
    if (!v) { console.error(`${이름} 뒤에 폴더가 없다`); process.exit(2); }
    인자.splice(i, 2);
    return v;
  };
  const 입력옵션 = 옵션빼기('--입력');
  const 출력옵션 = 옵션빼기('--출력');
  if (입력옵션) SRC_DIR = path.resolve(REPO, 입력옵션);
  if (출력옵션) OUT_DIR = path.resolve(REPO, 출력옵션);

  if (!fs.existsSync(SRC_DIR)) { console.error(`원본 폴더가 없다: ${SRC_DIR}`); process.exit(2); }
  /* 「원본은 안 건드린다」를 프로즈가 아니라 기계로 지킨다 — 같은 폴더면 이름이 같아 덮어쓴다. */
  if (path.resolve(SRC_DIR) === path.resolve(OUT_DIR)) {
    console.error('입력과 출력이 같은 폴더다 — 원본을 덮어쓴다. 하위 폴더를 지정한다(예: --출력 docs/캐릭터/정본_4K/누끼)');
    process.exit(2);
  }

  const 컷 = 인자.length
    ? 인자
    : fs.readdirSync(SRC_DIR).filter((f) => f.toLowerCase().endsWith('.png'));
  if (!컷.length) { console.error('처리할 PNG 가 없다'); process.exit(2); }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-누끼-'));

  console.log(`배경 제거 ${컷.length}컷 → ${path.relative(REPO, OUT_DIR).replace(/\\/g, '/')}/  (원본 무변경 · ${SIZE}px)`);
  let ok = 0;
  try {
    for (const c of 컷) {
      if (!fs.existsSync(path.join(SRC_DIR, c))) { console.log(`  ❌ ${c} — 원본 없음`); continue; }
      if (누끼(chrome, c, tmpDir)) ok++;
    }
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
  console.log(`\n완료 ${ok}/${컷.length}`);
  process.exit(ok === 컷.length ? 0 : 1);
}

main();
