#!/usr/bin/env node
// 철학 문서를 바탕화면 열람용 HTML로 내보낸다 (유호님 요청 2026-08-09).
// 사용: node tools/철학열람빌드.js   → 바탕화면 「SYNK 운영자료\SYNK 철학\*.html」(자리 이동 08-13 · 아래 빌드() 주석)
// ⚠열람 편의용이다 — 대외 발행 조판(킷 정식·몽골어 검수)은 확정 후 별도 게이트를 거친다.
const fs = require('fs');
const path = require('path');
const { 칸나누기 } = require('./lib/표.js');   // 표를 칸으로 가르는 **단 하나의 통로**(날 split 금지)
// 🔴 바탕화면 경로는 추정하지 않고 「실제로 화면에 보이는 곳」을 찾는다 — 그 판정은 아래 통로 **한 곳**에만 산다.
// 여기 사본을 되살리면 `tests/바탕화면통로.test.js` 가 문다(같은 탐지가 세 벌로 갈렸던 자리 · 2026-08-10).
const { 경로: 바탕화면 } = require('./lib/바탕화면.js');
// 폴더 이름은 **운영자료가 정본**이다 — 여기 글자로 베끼면 한쪽만 바뀌는 날 두 자리로 갈린다(아래 08-13 사고).
// 폴더 자리는 운영자료가 정본이다 — 갈래 이름을 글자로 베끼면 한쪽만 바뀌는 날 두 자리로 갈린다.
const { 폴더명: 운영자료폴더, 갈래폴더 } = require('./운영자료.js');   // ⚠require 부작용 0(main 은 require.main 일 때만 돈다)

const ROOT = path.join(__dirname, '..');

const DOCS = [
  ['docs/SYNK_철학.md', '01_SYNK_철학_3벌'],
  /* 02(구술 원문·판정기록)는 뺐다(유호 판정 기준 08-10 · ②안) — LAB철학.md 는 docs/_archive/ 로
   * 이관됐고, §0 구술 원문은 SYNK_철학 부록 C 충실 복원으로 01 안에 실려 나간다(7항 전문 동일 실측).
   * 나머지 층(§1~7 v1 초안·§6 판정 9건)은 철학 3벌 확정 + 유호 「다 유지」(08-09)로 역할이 끝나,
   * 아카이브 경로로 되살리면 [제안]·판정 대기 라벨이 붙은 구판이 정본 옆에서 현행의 얼굴을 한다.
   * ⚠항목을 뺄 땐 바탕화면 사본도 같이 걷는다 — 빌드는 그 폴더에서 아무것도 지우지 않는다(02는 08-10 수거). */
  ['docs/기업철학_홈페이지_v1.md', '03_기업철학_현행(홈페이지본)'],
];

// 킷 요약(DESIGN.md) 준수: Paper 바탕·Ink 본문·순백/순검정 금지·신호는 Coral 1점(라이트에선 면/괘선만)
const CSS = `
  body{background:#FBF7EE;color:#171820;font-family:'SUIT','Inter Tight','Apple SD Gothic Neo','Malgun Gothic',sans-serif;
       line-height:1.75;max-width:820px;margin:0 auto;padding:48px 28px;word-break:keep-all;}
  header.band{background:#0F1730;color:#F6F1E8;margin:-48px -28px 40px;padding:34px 28px 26px;}
  header.band h1{margin:0;font-size:1.5em;color:#F6F1E8;}
  header.band .cap{color:#8A93AD;font-size:.85em;margin-top:6px;}
  h1{font-size:1.45em;margin:1.6em 0 .5em;}
  h2{font-size:1.22em;margin:2em 0 .6em;padding-bottom:.25em;border-bottom:3px solid #FF6B5C;}
  h3{font-size:1.05em;margin:1.5em 0 .4em;}
  blockquote{margin:1em 0;padding:.7em 1em;background:#FFE9E4;border-left:4px solid #FF6B5C;font-size:.92em;}
  table{border-collapse:collapse;width:100%;margin:1em 0;font-size:.9em;}
  th,td{border:1px solid #2A3358;padding:.45em .6em;text-align:left;vertical-align:top;}
  th{background:#0F1730;color:#F6F1E8;}
  hr{border:none;border-top:1px solid #2A3358;margin:2.2em 0;}
  .cap,small{color:#5F657D;}
  strong{font-weight:800;}
  footer{margin-top:3em;color:#5F657D;font-size:.8em;}
`;

function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function inline(s){
  s = esc(s);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1'); // 링크는 텍스트만(열람용)
  return s;
}
function mdToHtml(md){
  const out = [];
  const lines = md.replace(/\r/g,'').split('\n');
  let i = 0, para = [];
  const flush = () => { if (para.length){ out.push('<p>'+inline(para.join(' '))+'</p>'); para = []; } };
  while (i < lines.length){
    const L = lines[i];
    if (/^\s*$/.test(L)) { flush(); i++; continue; }
    if (/^<!--/.test(L)) { while (i < lines.length && !/-->\s*$/.test(lines[i])) i++; i++; continue; }
    if (/^---+\s*$/.test(L)) { flush(); out.push('<hr>'); i++; continue; }
    const h = L.match(/^(#{1,4})\s+(.*)$/);
    if (h) { flush(); const n = h[1].length; out.push(`<h${n}>${inline(h[2])}</h${n}>`); i++; continue; }
    if (/^>\s?/.test(L)) { flush(); const q = []; while (i < lines.length && /^>\s?/.test(lines[i])) { q.push(inline(lines[i].replace(/^>\s?/,''))); i++; } out.push('<blockquote>'+q.join('<br>')+'</blockquote>'); continue; }
    if (/^\|/.test(L)) { flush(); const rows = []; while (i < lines.length && /^\|/.test(lines[i])) { rows.push(lines[i]); i++; }
      /* 🔴 날 split 으로 가르지 않는다 — 이 저장소의 표는 백틱 인용이 빽빽해서(`local_xxx`·`git commit -a`)
       *   백틱 **안**의 파이프를 칸막이로 세면 그 뒤 칸이 통째로 밀린다. 밀려도 오류는 안 나고
       *   모양은 정상이라, 새는 방향은 언제나 「통과」다(tools/lib/표.js 머리말 · 실측 4곳). */
      const cells = r => 칸나누기(r).map(c=>inline(c));
      let html = '<table>'; rows.forEach((r, ri) => { if (/^\|[\s:-]+\|/.test(r) && /^[\s|:-]+$/.test(r)) return;
        const tag = ri === 0 ? 'th' : 'td'; html += '<tr>'+cells(r).map(c=>`<${tag}>${c}</${tag}>`).join('')+'</tr>'; });
      out.push(html+'</table>'); continue; }
    if (/^\s*[-·]\s+/.test(L)) { flush(); const items = []; while (i < lines.length && /^\s*[-·]\s+/.test(lines[i])) { items.push('<li>'+inline(lines[i].replace(/^\s*[-·]\s+/,''))+'</li>'); i++; } out.push('<ul>'+items.join('')+'</ul>'); continue; }
    const n = L.match(/^\s*(\d+)\.\s+(.*)$/);
    if (n) { flush(); const items=[]; while (i < lines.length){ const m = lines[i].match(/^\s*\d+\.\s+(.*)$/); if(!m) break; items.push('<li>'+inline(m[1])+'</li>'); i++; } out.push('<ol>'+items.join('')+'</ol>'); continue; }
    para.push(L.trim()); i++;
  }
  flush();
  return out.join('\n');
}

function 빌드(opts = {}){
  // 바탕화면 탐지는 out 미지정일 때만 — require 는 부작용 0 이고, 회귀는 out·docs 를 넘겨 repo 밖(레지스트리·진짜 바탕화면)을 안 만진다
  const docs = opts.docs || DOCS;
  /* 🔴 굽는 자리는 바탕화면 최상위가 아니라 **운영자료 폴더 안**이다(유호 승인 2026-08-13).
   * 08-10 실사고: 최상위에만 굽는데 오전 판이 운영자료 쪽에도 복사돼 있어, 같은 날 오후 재빌드가
   * 최상위만 새로 만들고 **두 자리가 조용히 갈렸다**(00·01 내용 상이 · 04 는 한쪽에 아예 없음).
   * 유호님이 "폴더가 2개인데 일부러 그런 거냐"로 발견. 「만든 자료는 전부 SYNK 운영자료로」(유호 상시 08-09)와도
   * 어긋나 있었다 — 자리를 하나로 못 박아 다음 빌드가 다시 갈라질 수 없게 한다. */
  const OUT = opts.out || 갈래폴더(path.join(바탕화면(), 운영자료폴더), '철학');
  fs.mkdirSync(OUT, { recursive: true });
  const built = [];
  const 없음 = [];
  for (const [rel, name] of docs){
    const src = path.join(ROOT, rel);
    if (!fs.existsSync(src)) { console.error('없음: ' + rel); 없음.push(rel); continue; }
    const md = fs.readFileSync(src, 'utf8');
    const title = (md.match(/^#\s+(.*)$/m) || [,name])[1].replace(/\*/g,'');
    const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${CSS}</style></head>
<body><header class="band"><h1>${esc(title)}</h1><div class="cap">SYNK · 열람용 ${new Date().toISOString().slice(0,10)} — 원본: ${rel}</div></header>
${mdToHtml(md)}
<footer>이 파일은 열람용 사본입니다. 정본은 저장소 ${rel} — 고친 뒤 node tools/철학열람빌드.js 로 다시 내보냅니다.</footer></body></html>`;
    const dest = path.join(OUT, name + '.html');
    fs.writeFileSync(dest, html, 'utf8');
    built.push(dest);
  }
  console.log('내보냄 ' + built.length + '건 → ' + OUT);
  built.forEach(f => console.log('  · ' + path.basename(f)));
  /* 원본 없는 항목을 조용히 건너뛰지 않는다 — 그 항목의 옛 사본이 바탕화면에 「갱신된 척」 남는다
   * (2026-08-10 실측: LAB철학.md 이관 후 02 가 하루 넘게 낡은 채 남아 유호님이 발견).
   * exitCode 가 아니라 throw — exitCode 는 프로세스 전역이라 회귀가 빌드()를 부르는 날 fail 0 스위트를 적색으로 만든다. */
  if (없음.length) {
    throw new Error('원본 없는 항목 ' + 없음.length + '건(' + 없음.join(' · ') + ') — 매니페스트를 고치기 전까지 이 빌드는 실패다.');
  }
  return built;
}

// require 하는 순간 바탕화면에 파일이 나가면 회귀에서 이 모듈을 부를 수 없다(47093f7d 지적 08-09).
// 실행은 CLI 로 직접 부를 때만 — require 는 부작용 0(바탕화면 탐지 포함).
module.exports = { DOCS, mdToHtml, 빌드 }; // export 는 이 한 곳뿐 — 늘릴 땐 여기에 더한다(export 문이 둘이면 뒤가 앞을 조용히 덮는다)
if (require.main === module) {
  try { 빌드(); }
  catch (e) { console.error(String((e && e.message) || e)); process.exit(1); }
}
