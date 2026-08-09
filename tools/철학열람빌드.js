#!/usr/bin/env node
// 철학 문서를 바탕화면 열람용 HTML로 내보낸다 (유호님 요청 2026-08-09).
// 사용: node tools/철학열람빌드.js   → C:\Users\q1212\Desktop\SYNK 철학\*.html
// ⚠열람 편의용이다 — 대외 발행 조판(킷 정식·몽골어 검수)은 확정 후 별도 게이트를 거친다.
const fs = require('fs');
const path = require('path');
const { 칸나누기 } = require('./lib/표.js');   // 표를 칸으로 가르는 **단 하나의 통로**(날 split 금지)

const ROOT = path.join(__dirname, '..');

// 🔴 바탕화면 경로는 추정하지 않고 「실제로 화면에 보이는 곳」을 찾는다.
// OneDrive 백업이 켜져 있으면 진짜 바탕화면은 OneDrive\Desktop 이고,
// USERPROFILE\Desktop 은 화면에 안 뜨는 껍데기로 남는다(2026-08-09 실측 — 여기로 내보내 「없다」가 됐다).
function 바탕화면() {
  const 후보 = [];
  try { // 정본: 레지스트리(Explorer 가 실제로 읽는 값)
    const { execFileSync } = require('child_process');
    const out = execFileSync('reg', ['query',
      'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders', '/v', 'Desktop'],
      { encoding: 'utf8' });
    const m = out.match(/Desktop\s+REG_(?:EXPAND_)?SZ\s+(.+)/);
    if (m) 후보.push(m[1].trim().replace(/%([^%]+)%/g, (_, v) => process.env[v] || ''));
  } catch { /* reg 없으면 폴백 */ }
  if (process.env.OneDrive) 후보.push(path.join(process.env.OneDrive, 'Desktop'));
  if (process.env.USERPROFILE) 후보.push(path.join(process.env.USERPROFILE, 'Desktop'));
  for (const c of 후보) if (c && fs.existsSync(c)) return c;
  throw new Error('바탕화면을 못 찾았다: ' + 후보.join(' | '));
}

const OUT = path.join(바탕화면(), 'SYNK 철학');
const DOCS = [
  ['docs/SYNK_철학.md', '01_SYNK_철학_3벌'],
  ['docs/LAB철학.md', '02_유호님_구술_원문과_판정기록'],
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

function 빌드(){
  fs.mkdirSync(OUT, { recursive: true });
  const built = [];
  for (const [rel, name] of DOCS){
    const src = path.join(ROOT, rel);
    if (!fs.existsSync(src)) { console.error('없음: ' + rel); continue; }
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
  return built;
}

// require 하는 순간 바탕화면에 파일이 나가면 회귀에서 이 모듈을 부를 수 없다(47093f7d 지적 08-09).
// 실행은 CLI 로 직접 부를 때만 — require 는 부작용 0.
if (require.main === module) 빌드();
module.exports = { mdToHtml, 빌드 };
