#!/usr/bin/env node
'use strict';
// Optional renderer: only the two published LAB sections. Never publishes the
// internal preface or operational notes of the canonical Markdown document.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const md = fs.readFileSync(path.join(root, 'docs/개인정보처리방침_초안_v1.md'), 'utf8').replace(/\r\n/g, '\n');
const koMark = '# SYNK LAB 개인정보처리방침\n';
const enMark = '# Privacy Policy (English)\n';
const endMark = '\n<!-- PUBLIC-POLICY-END -->';
const koAt = md.indexOf(koMark), enAt = md.indexOf(enMark), endAt = md.indexOf(endMark);
if (koAt < 0 || enAt <= koAt || endAt <= enAt) throw new Error('Missing or reordered publication boundaries');
const escape = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function inline(s) {
  return escape(s).replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}
function render(text, numberClass, locale) {
  const lines = text.trim().split('\n'), blocks = [];
  for (let i = 0; i < lines.length;) {
    const line = lines[i].trim();
    if (!line || line === '---') { i++; continue; }
    if (line.startsWith('# ')) { blocks.push('<h2 class="doc-title">' + inline(line.slice(2)) + '</h2>'); i++; continue; }
    const heading = /^## (\d+)\. (.+)$/.exec(line);
    if (heading) {
      const id = locale === 'ko' && heading[1] === '11' ? ' id="privacy-contact"' : '';
      blocks.push('<h3' + id + '><span class="' + numberClass + '">' + heading[1] + '</span> ' + inline(heading[2]) + '</h3>'); i++; continue;
    }
    if (line.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(lines[i++].trim().slice(1, -1).split('|').map(x => x.trim()));
      if (rows.length < 2 || !rows[1].every(x => /^:?-+:?$/.test(x))) throw new Error('Invalid table');
      blocks.push('<div class="tbl-scroll" tabindex="0" role="region" aria-label="' + (locale === 'ko' ? '개인정보 안내 표' : 'Privacy information table') + '"><table><thead><tr>' + rows[0].map(x => '<th scope="col">' + inline(x) + '</th>').join('') + '</tr></thead><tbody>' + rows.slice(2).map(row => '<tr>' + row.map(x => '<td>' + inline(x) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>'); continue;
    }
    if (line.startsWith('- ')) {
      const items=[];
      while (i < lines.length && lines[i].startsWith('- ')) items.push('<li>' + inline(lines[i++].slice(2)) + '</li>');
      blocks.push('<ul>' + items.join('') + '</ul>'); continue;
    }
    if (line.startsWith('> ')) { blocks.push('<blockquote><p>' + inline(line.slice(2)) + '</p></blockquote>'); i++; continue; }
    const paragraph=[];
    while (i < lines.length && lines[i].trim() && !/^(#|\||- |>|---)/.test(lines[i])) paragraph.push(lines[i++]);
    if (!paragraph.length) throw new Error('Unsupported Markdown block: ' + line.slice(0, 40));
    blocks.push('<p>' + inline(paragraph.join(' ')) + '</p>');
  }
  return blocks.join('\n    ');
}
const destinations = [path.join(root, 'docs/개인정보처리방침_게시용.html')];
if (process.argv[2]) destinations.push(path.resolve(process.argv[2]));
for (const file of destinations) {
  let html = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  if (file === destinations[0]) {
    const fontSpecs = [
      ['Inter Tight', 400, 'InterTight/InterTight-Regular.ttf'],
      ['Inter Tight', 700, 'InterTight/InterTight-Bold.ttf'],
      ['DM Mono', 400, 'DM_Mono/DMMono-Regular.ttf']
    ];
    const faces = fontSpecs.map(([family, weight, relative]) => {
      const data = fs.readFileSync(path.join(root, 'docs/브랜드_폰트', relative)).toString('base64');
      return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;src:url(data:font/ttf;base64,${data}) format('truetype');}`;
    }).join('\n');
    const fonts = '<style id="privacy-local-fonts">\n' + faces + '\n</style>';
    const oldFonts = /<style id="privacy-local-fonts">[\s\S]*?<\/style>/;
    html = oldFonts.test(html) ? html.replace(oldFonts, fonts) : html.replace('</head>', fonts + '\n</head>');
  }
  const cls = html.includes('class="번호"') ? '번호' : 'num';
  for (const [id, body] of [['ko', md.slice(koAt, enAt)], ['en', md.slice(enAt, endAt)]]) {
    const re = new RegExp('<section class="doc" id="' + id + '"[^>]*>[\\s\\S]*?<\\/section>');
    if (!re.test(html)) throw new Error('Missing section ' + id + ' in ' + file);
    html = html.replace(re, '<section class="doc" id="' + id + '" lang="' + id + '">\n    ' + render(body, cls, id) + '\n  </section>');
  }
  fs.writeFileSync(file, html, 'utf8');
  console.log('Rendered LAB notice: ' + file);
}
