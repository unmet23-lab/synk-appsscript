#!/usr/bin/env node
'use strict';
/* 네이버 블로그 붙여넣기 판 (2026-10-21). 원고.md를 크롬에서 열어 「복사」 단추로 옮겨 붙일 HTML로 바꾼다.
 *
 * 크롬 확장(10-20)과 앱 안 브라우저(10-21) 둘 다 blog.naver.com을 안전 제한으로 막아 Claude가 올릴 수 없다.
 * 유호님이 직접 올릴 때 소제목·굵게·인용·목록을 다시 잡지 않도록, 원고 옆에 붙여넣기.html을 만든다.
 *
 *   node tools/블로그붙여넣기.js <원고.md> [--출력 <html 경로>]
 *
 * 원고 틀: 「**제목**」 다음 줄이 제목, 「**본문**」부터 「**태그**」 앞까지가 본문(출처 포함), 「**태그**」 아래 줄이 쉼표로 나눈 태그.
 * 본문의 「〔그림 N〕 *설명*」은 같은 폴더에서 이름이 0N_ 또는 N_로 시작하는 그림을 끌어다 놓을 자리로 바꾼다.
 */
const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
const OUT_ARG = args.indexOf('--출력');
const src = args.find((a, i) => !a.startsWith('--') && (OUT_ARG < 0 || i !== OUT_ARG + 1));
if (!src) {
  console.error('쓰는 법: node tools/블로그붙여넣기.js <원고.md> [--출력 <html 경로>]');
  process.exit(2);
}
const SRC = path.resolve(src);
const DIR = path.dirname(SRC);
const OUT = OUT_ARG > -1 ? path.resolve(args[OUT_ARG + 1]) : path.join(DIR, '붙여넣기.html');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>')
    .replace(/(https?:\/\/[^\s<)]+)/g, '<a href="$1">$1</a>');
}

function imageFor(n) {
  const re = new RegExp(`^0?${n}_.*\\.(jpe?g|png|webp|gif)$`, 'i');
  return fs.readdirSync(DIR).find((f) => re.test(f)) || null;
}

function parse(md) {
  const lines = md.replace(/^﻿/, '').replace(/\r\n/g, '\n').split('\n');
  const at = (label) => lines.findIndex((l) => l.trim() === `**${label}**`);
  const iTitle = at('제목');
  const iBody = at('본문');
  const iTags = at('태그');
  if (iTitle < 0 || iBody < 0) throw new Error('원고에 「**제목**」·「**본문**」 줄이 없습니다');
  const title = lines.slice(iTitle + 1).find((l) => l.trim()) || '';
  let body = lines.slice(iBody + 1, iTags > -1 ? iTags : lines.length);
  while (body.length && /^\s*(---)?\s*$/.test(body[body.length - 1])) body.pop();
  const tags = iTags > -1
    ? lines.slice(iTags + 1).filter((l) => l.trim() && !/^\*\*/.test(l.trim())).join(',').split(',').map((t) => t.trim()).filter(Boolean)
    : [];
  return { title: title.trim(), body, tags };
}

function bodyHtml(body) {
  const out = [];
  const images = [];
  let para = [];
  let list = null;
  let quote = null;
  let code = null;
  const flushPara = () => { if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`); para = []; };
  const flushList = () => { if (list) out.push(`<ul>${list.map((t) => `<li>${inline(t)}</li>`).join('')}</ul>`); list = null; };
  const flushQuote = () => { if (quote) out.push(`<blockquote><p>${quote.map(inline).join('<br>')}</p></blockquote>`); quote = null; };
  const flushAll = () => { flushPara(); flushList(); flushQuote(); };
  for (const raw of body) {
    const line = raw.trimEnd();
    if (code) {
      if (/^```/.test(line.trim())) { out.push(`<blockquote><p>${code.map(esc).join('<br>')}</p></blockquote>`); code = null; } else code.push(line);
      continue;
    }
    if (/^```/.test(line.trim())) { flushAll(); code = []; continue; }
    const fig = line.match(/^〔그림\s*(\d+)〕\s*(.*)$/);
    if (fig) {
      flushAll();
      const file = imageFor(fig[1]);
      images.push({ n: fig[1], file });
      out.push(`<p class="mark">▶ 그림 ${fig[1]} 자리 — ${esc(file || '그림 파일 없음')}을 여기에 끌어다 놓고 이 줄은 지우세요</p>`);
      const cap = fig[2].replace(/^\*(.*)\*$/, '$1').trim();
      if (cap) out.push(`<p class="cap"><i>${inline(cap)}</i></p>`);
      continue;
    }
    if (!line.trim()) { flushAll(); continue; }
    if (/^---+$/.test(line.trim())) { flushAll(); out.push('<hr>'); continue; }
    const h = line.match(/^#{2,4}\s+(.*)$/);
    if (h) { flushAll(); out.push(`<h3>${inline(h[1])}</h3>`); continue; }
    const q = line.match(/^>\s?(.*)$/);
    if (q) { flushPara(); flushList(); (quote = quote || []).push(q[1]); continue; }
    const li = line.match(/^\s*[-*]\s+(.*)$/);
    if (li) { flushPara(); flushQuote(); (list = list || []).push(li[1]); continue; }
    flushList(); flushQuote();
    para.push(line.trim());
  }
  flushAll();
  return { html: out.join('\n'), images };
}

function page({ title, tags }, { html, images }) {
  const imgs = images.map(({ n, file }) => file
    ? `<figure><img src="${encodeURI(file)}" alt=""><figcaption>그림 ${n} · ${esc(file)}</figcaption></figure>`
    : `<figure><figcaption>그림 ${n} · 같은 폴더에 0${n}_ 로 시작하는 그림이 없습니다</figcaption></figure>`).join('\n');
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>네이버 블로그 붙여넣기 — ${esc(title)}</title>
<style>
:root{--ink:#1a1a1a;--soft:#666;--line:#e3e3e3;--accent:#d9534f;--bg:#fff}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.7 "Malgun Gothic",system-ui,sans-serif}
main{max-width:760px;margin:0 auto;padding:24px 16px 80px}
ol{padding-left:20px;color:var(--soft)} h1{font-size:20px;margin:24px 0 8px}
.bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0}
button{font:inherit;padding:6px 14px;border:1px solid var(--ink);background:var(--ink);color:#fff;border-radius:6px;cursor:pointer}
button.done{background:#2e7d32;border-color:#2e7d32}
.box{border:1px solid var(--line);border-radius:8px;padding:16px;margin:8px 0 24px}
#body .mark{color:var(--accent);font-weight:bold} #body .cap{text-align:center;color:var(--soft)}
blockquote{margin:12px 0;padding:8px 14px;border-left:3px solid var(--line);background:#fafafa}
.imgs{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}
.imgs img{width:100%;border-radius:6px;border:1px solid var(--line)} figure{margin:0} figcaption{font-size:13px;color:var(--soft)}
</style></head><body><main>
<ol>
<li>크롬에서 synkshift 블로그 글쓰기를 엽니다.</li>
<li>「제목 복사」 → 제목 칸에, 「본문 복사」 → 본문에 붙여 넣습니다.</li>
<li>빨간 「▶ 그림 N 자리」 줄마다 아래 그림 파일을 탐색기에서 끌어다 놓고, 그 줄을 지웁니다.</li>
<li>발행 → 카테고리 · 태그(「태그 복사」) · 전체 공개를 확인하고 발행합니다.</li>
</ol>
<h1>제목</h1>
<div class="bar"><button data-copy="title">제목 복사</button></div>
<div class="box" id="title">${esc(title)}</div>
<h1>본문</h1>
<div class="bar"><button data-copy="body">본문 복사</button></div>
<div class="box" id="body">
${html}
</div>
<h1>태그</h1>
<div class="bar"><button data-copy="tags">태그 복사</button></div>
<div class="box" id="tags">${esc(tags.join(', '))}</div>
<h1>그림</h1>
<div class="imgs">
${imgs}
</div>
</main>
<script>
document.querySelectorAll('button[data-copy]').forEach(function (b) {
  b.addEventListener('click', function () {
    var el = document.getElementById(b.dataset.copy);
    var html = el.innerHTML, text = el.innerText;
    function onCopy(e) { e.clipboardData.setData('text/html', html); e.clipboardData.setData('text/plain', text); e.preventDefault(); }
    document.addEventListener('copy', onCopy);
    var ok = document.execCommand('copy');
    document.removeEventListener('copy', onCopy);
    b.textContent = ok ? '복사했어요' : '복사 안 됨 — 직접 선택해 주세요';
    if (ok) b.classList.add('done');
  });
});
</script>
</body></html>
`;
}

const doc = parse(fs.readFileSync(SRC, 'utf8'));
const body = bodyHtml(doc.body);
fs.writeFileSync(OUT, page(doc, body));
const missing = body.images.filter((i) => !i.file).map((i) => i.n);
console.log(`${path.relative(process.cwd(), OUT)} · 제목 ${doc.title.length}자 · 그림 자리 ${body.images.length}개${missing.length ? ` (파일 없음: ${missing.join(', ')})` : ''} · 태그 ${doc.tags.length}개`);
