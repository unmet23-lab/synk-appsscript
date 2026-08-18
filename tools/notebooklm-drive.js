#!/usr/bin/env node
/**
 * 노트북LM **자동 갱신** 묶음 — 구글 드라이브 폴더로 굽는다.
 *
 * 왜 PDF인가 (실측 08-04):
 *   노트북LM의 Drive 소스 피커가 받는 형식은 **문서·프레젠테이션·스프레드시트·PDF·폴더**뿐이다.
 *   `.md`는 목록에 **없다** — 드라이브에 올려둬도 소스로 고를 수 없다.
 *   PDF는 로컬에서 자격증명 없이 구울 수 있는 유일한 허용 형식이라 이걸 쓴다.
 *
 * 왜 「폴더」인가:
 *   피커에 **폴더**가 있다. 폴더를 소스로 걸면 그 안이 바뀔 때 따라온다 —
 *   파일을 199개 낱개로 걸면 새 판정이 생길 때마다 유호님이 다시 골라야 한다.
 *   즉 **자동을 만드는 것은 PDF가 아니라 폴더다.**
 *
 * 왜 묶는가:
 *   같은 이유의 연장 — 파일 이름이 **매번 같아야** 드라이브가 「새 파일」이 아니라
 *   「같은 파일의 새 판」으로 본다. 낱개 199개는 판정이 하나 늘 때마다 목록이 바뀐다.
 *   묶음은 개수가 고정이라 새 판정이 **기존 파일 안으로** 들어간다.
 *
 * 사용:
 *   node tools/notebooklm-drive.js --out "G:\\내 드라이브\\SYNK_노트북LM"
 *   node tools/notebooklm-drive.js --dry
 *
 * ⛔ 개인정보 게이트는 notebooklm-export.js의 것을 **그대로 쓴다**(사본 금지 —
 *    게이트가 둘이 되면 한쪽만 고쳐지고, 새는 방향은 언제나 「통과」다).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const E = require('./notebooklm-export.js');   // 게이트·수집 규칙을 공유한다
const { 인자게이트 } = require(path.join(__dirname, 'lib', '인자게이트.js'));
const REPO = path.resolve(__dirname, '..');

/* 드라이브 데스크톱 마운트를 **여기서** 찾는다 — .cmd 래퍼에 한글 경로를 두면 안 되기 때문이다.
 * cmd.exe는 배치 파일을 OEM 코드페이지(CP949)로 파싱해서 실행 줄의 한글이 깨진다
 * (`tools/memory-push.cmd` 머리말의 실사고 — cd가 조용히 실패해 남의 저장소에서 git이 돌 뻔했다).
 * 그래서 래퍼는 순수 ASCII로 두고, 「내 드라이브」를 찾는 일은 Node가 한다. */
function findDriveRoot() {
  const 후보 = [];
  for (const 문자 of ['G', 'H', 'I', 'J', 'K']) {
    후보.push(path.join(`${문자}:`, '내 드라이브'), path.join(`${문자}:`, 'My Drive'));
  }
  return 후보.find((p) => { try { return fs.statSync(p).isDirectory(); } catch (e) { return false; } }) || null;
}
const DRIVE_ROOT = findDriveRoot();
const DEFAULT_OUT = DRIVE_ROOT ? path.join(DRIVE_ROOT, 'SYNK_노트북LM')
                               : path.join('G:', '내 드라이브', 'SYNK_노트북LM'); // 안내 메시지용
const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].find((p) => fs.existsSync(p));

const CHUNK_CHARS = 300000;   // PDF 한 권의 본문 상한(글자). 너무 잘게 쪼개면 소스가 늘고, 너무 크면 굽기가 느리다

/** 한 묶음을 인쇄용 HTML로 — 파일마다 머리말을 남겨 출처를 되짚을 수 있게 한다 */
function toHtml(제목, 만든날, 항목들) {
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const 본문 = 항목들.map(({ 원본, 내용 }) => `
<section>
  <h2>${esc(원본)}</h2>
  <pre>${esc(내용)}</pre>
</section>`).join('\n');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(제목)}</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  body { font-family: "Malgun Gothic", "맑은 고딕", sans-serif; font-size: 9.5pt; line-height: 1.5; color: #111; }
  h1 { font-size: 15pt; border-bottom: 2px solid #111; padding-bottom: 6px; }
  h2 { font-size: 11pt; margin: 18px 0 6px; padding: 5px 8px; background: #eef; border-left: 4px solid #3D5AFE;
       page-break-before: always; page-break-after: avoid; }
  section:first-of-type h2 { page-break-before: avoid; }
  pre { white-space: pre-wrap; word-break: break-word; font-family: inherit; margin: 0; }
  .머리 { background: #fffbe6; border: 1px solid #e6d17a; padding: 10px 12px; margin-bottom: 14px; font-size: 9pt; }
</style></head><body>
<h1>${esc(제목)}</h1>
<div class="머리">
  <b>사본이다 — 정본이 아니다.</b> 만든 날 <b>${esc(만든날)}</b> ·
  원본 = SYNK-appsscript 저장소.<br>
  <b>여기서 결정하지 않는다</b> — 이 묶음의 답은 재료지 판정이 아니다.
  확정은 저장소의 정본과 대조한 뒤에만.<br>
  다시 만들기: <code>node tools/notebooklm-drive.js</code> (아래 각 절의 제목이 원본 파일 경로다)
</div>
${본문}
</body></html>`;
}

function main() {
  const args = process.argv.slice(2);
  /* 🔑 목록은 눈으로 정하지 않았다 — `CLI도구들()` 이 재고, 회귀 ④ 가 매번 다시 센다. */
  const 아는플래그 = ['--dry', '--out'];
  const 플래그오류 = 인자게이트('notebooklm-drive', args, 아는플래그);
  if (플래그오류) { console.error(`\n🔴 ${플래그오류}\n`); process.exit(1); }
  const DRY = args.includes('--dry');
  const i = args.indexOf('--out');
  const OUT = i >= 0 && args[i + 1] ? path.resolve(args[i + 1]) : DEFAULT_OUT;
  const 만든날 = new Date().toISOString().slice(0, 10);
  const log = (s) => console.log(s);

  log(`노트북LM 드라이브 묶음 — 만든 날 ${만든날}`);
  log(`대상: ${OUT}${DRY ? '  [DRY RUN]' : ''}`);
  /* 마운트를 못 찾았으면 위 경로는 **찾은 자리가 아니라 안내용 기본값**이다(DEFAULT_OUT).
   * 드라이런은 상위 폴더 검사에 닿기 전에 return 하므로(아래 DRY 분기), 이 한 줄이 없으면
   * 드라이브가 꺼져 있어도 `--dry` 는 멀쩡한 대상 경로만 찍고 정상 종료한다.
   * 08-10 실측: 그 출력을 「마운트가 살아있다」는 증거로 읽고 실사 실행에 들어갔다가 그제야
   * 막혔다. 드라이런이 실사와 다른 판정을 내면 그건 예행연습이 아니라 오도 장치다. */
  if (!DRIVE_ROOT && i < 0) {
    log('⚠ 드라이브 마운트 미검출 — 위 경로는 안내용 기본값이다(찾은 자리가 아니다). 실사 실행은 여기서 멈춘다.');
  }
  log('');

  if (!CHROME) {
    console.error('⛔ 크롬을 못 찾았다 — PDF를 구울 수 없다. 경로를 확인하라.');
    process.exit(1);
  }

  // ── 수집 + 게이트 (export와 같은 규칙·같은 코드) ──────────────────────
  const 그룹 = new Map([['기억', []], ['문서', []]]);
  const blocked = [];
  for (const { prefix, root } of E.SOURCE_ROOTS) {
    for (const abs of E.walk(root)) {
      const rel = path.relative(root, abs).replace(/\\/g, '/');
      const 내용 = fs.readFileSync(abs, 'utf8');
      const hits = E.scanPII(내용);
      if (hits.length) { blocked.push({ prefix, rel, hits }); continue; }
      그룹.get(prefix).push({ 원본: `${prefix === '기억' ? 'memory' : 'docs'}/${rel}`, 내용 });
    }
  }

  // ── 묶기: 이름이 매번 같아야 드라이브가 「같은 파일의 새 판」으로 본다 ──
  const 권 = [];
  for (const [prefix, 항목들] of 그룹) {
    항목들.sort((a, b) => a.원본.localeCompare(b.원본, 'ko'));
    let 통 = [], 글자 = 0;
    const 밀기 = () => { if (통.length) { 권.push({ prefix, 항목들: 통 }); 통 = []; 글자 = 0; } };
    for (const it of 항목들) {
      if (글자 + it.내용.length > CHUNK_CHARS && 통.length) 밀기();
      통.push(it); 글자 += it.내용.length;
    }
    밀기();
  }
  // 그룹별 일련번호 (기억_01, 기억_02 … 문서_01 …)
  const 번호 = {};
  for (const 한권 of 권) {
    번호[한권.prefix] = (번호[한권.prefix] || 0) + 1;
    한권.이름 = `SYNK_${한권.prefix}_${String(번호[한권.prefix]).padStart(2, '0')}.pdf`;
    한권.제목 = `SYNK ${한권.prefix} ${String(번호[한권.prefix]).padStart(2, '0')} / ${''}`;
  }
  for (const 한권 of 권) {
    const 총 = 권.filter((x) => x.prefix === 한권.prefix).length;
    한권.제목 = 한권.제목.replace(/\/ $/, `— 전 ${총}권 중`);
  }

  log(`묶음 ${권.length}권 (기억 ${권.filter(x=>x.prefix==='기억').length} · 문서 ${권.filter(x=>x.prefix==='문서').length})`);
  for (const 한권 of 권) log(`  ${한권.이름} — 원본 ${한권.항목들.length}개`);

  if (DRY) {
    if (blocked.length) log(`\n⛔ 제외 ${blocked.length}개: ${blocked.map((b) => b.rel).join(', ')}`);
    return;
  }

  // ── 대상 폴더 확인 — 없으면 **조용히 딴 데 쓰지 않는다** ───────────────
  const 상위 = path.dirname(OUT);
  if (!fs.existsSync(상위)) {
    console.error(`⛔ 대상 상위 폴더가 없다: ${상위}`);
    console.error('   구글 드라이브 데스크톱이 꺼져 있으면 마운트가 안 보인다(G:·H:… 전부 훑었다).');
    console.error('   → 드라이브를 켜거나, --out 으로 다른 경로를 준다.');
    console.error('   ⚠ 여기서 딴 폴더에 쓰면 「올라간 줄 알았는데 안 올라간」 상태가 된다 —');
    console.error('      그래서 폴백하지 않고 멈춘다(실패는 통과가 아니라 정지로 드러낸다).');
    process.exit(2);
  }
  fs.mkdirSync(OUT, { recursive: true });

  const 임시 = fs.mkdtempSync(path.join(os.tmpdir(), 'nblm-pdf-'));
  let 구움 = 0;
  for (const 한권 of 권) {
    const html = path.join(임시, 한권.이름.replace(/\.pdf$/, '.html'));
    fs.writeFileSync(html, toHtml(한권.제목, 만든날, 한권.항목들), 'utf8');
    const pdf = path.join(OUT, 한권.이름);
    execFileSync(CHROME, [
      '--headless', '--disable-gpu', '--no-sandbox', '--no-pdf-header-footer',
      `--print-to-pdf=${pdf}`, 'file:///' + html.replace(/\\/g, '/'),
    ], { stdio: 'ignore', timeout: 180000 });
    if (!fs.existsSync(pdf)) throw new Error(`PDF가 안 만들어졌다: ${한권.이름}`);
    구움++;
    log(`  ✅ ${한권.이름} (${(fs.statSync(pdf).size / 1048576).toFixed(2)}MB)`);
  }
  fs.rmSync(임시, { recursive: true, force: true });

  // 빠진 것도 폴더 안에 남긴다 — 「자료가 없어 못 답한 것」과 「일부러 뺀 것」을 가르려고
  fs.writeFileSync(path.join(OUT, '_빠진_파일.txt'),
    `만든 날 ${만든날}\n개인정보·자격증명이 본문에 있어 제외한 원본 ${blocked.length}개\n\n` +
    (blocked.map((b) => `- ${b.prefix}/${b.rel} [${[...new Set(b.hits.map((h) => h.kind))].join('·')}]`).join('\n') || '(없음)') +
    '\n\n안전한 값이면 tools/notebooklm-export.js 의 ALLOW 에 값 단위로 추가하고 다시 돌린다.\n', 'utf8');

  log(`\n✅ ${구움}권 구움 → ${OUT}`);
  if (blocked.length) log(`⛔ 제외 ${blocked.length}개 (_빠진_파일.txt 참고)`);
}

if (require.main === module) main();

// findDriveRoot 를 내보내는 이유: rot-check 가 「지금 마운트가 있나」를 **호출 시점에** 재야
// 하는데, 그 판정을 저쪽에 베끼면 드라이브 문자 목록이 두 곳으로 갈라진다(한쪽만 고쳐진다).
module.exports = { toHtml, DEFAULT_OUT, CHUNK_CHARS, findDriveRoot };
