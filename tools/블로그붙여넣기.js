#!/usr/bin/env node
'use strict';
/* SYNK SHIFT 블로그 원고를 올릴 모양으로 바꾼다 (2026-10-21).
 *
 * 네이버: 크롬 확장(10-20)과 앱 안 브라우저(10-21) 둘 다 blog.naver.com을 안전 제한으로 막아 Claude가 올릴 수 없다.
 *   유호님이 직접 올릴 때 소제목·굵게·인용·목록을 다시 잡지 않도록, 원고 옆에 붙여넣기.html을 만든다.
 * 티스토리(--티스토리): 같은 내용을 다른 느낌으로 쓴 티스토리판을 편집기(TinyMCE)에 넣을 본문 HTML과 제목·카테고리·태그·그림 목록으로
 *   묶어 원고 옆 티스토리_편집기.json에 쓴다. 게시 세션은 이 값을 `tinymce.get('editor-tistory').setContent`로 넣고,
 *   〔그림 N〕 문단마다 그림을 올린다([현장 노트 · 티스토리](../docs/현장노트/브라우저_게시.md#티스토리)).
 *
 *   node tools/블로그붙여넣기.js <원고.md> [--티스토리] [--영상 <유튜브 쇼츠 ID 또는 주소>] [--출력 <경로>]
 *
 * 원고 틀: 「**제목**」 다음 줄이 제목, 「**카테고리**」 다음 줄이 카테고리(없어도 됨), 「**본문**」부터 「**태그**」 앞까지가 본문(출처 포함),
 * 「**태그**」 아래 줄이 쉼표로 나눈 태그. 본문의 「〔그림 N〕 *설명*」은 같은 폴더에서 이름이 0N_ 또는 N_로 시작하는 그림 자리,
 * 「〔유튜브 영상ID〕」는 세로 쇼츠 영상 자리다. 제작 때는 「〔유튜브 쇼츠〕」로 두고 게시 때 --영상으로 채운다(자리가 없는 원고는
 * 첫 문단 뒤에 넣고, ID가 끝내 없으면 그 줄은 뺀다).
 */
const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
const OUT_ARG = args.indexOf('--출력');
const VIDEO_ARG = args.indexOf('--영상');
const TISTORY = args.includes('--티스토리');
const VIDEO = VIDEO_ARG > -1 ? String(args[VIDEO_ARG + 1] || '').replace(/^.*(?:shorts\/|youtu\.be\/|v=)/, '').replace(/[?&#].*$/, '') : null;
const src = args.find((a, i) => !a.startsWith('--') && (OUT_ARG < 0 || i !== OUT_ARG + 1) && (VIDEO_ARG < 0 || i !== VIDEO_ARG + 1));
if (!src || (VIDEO_ARG > -1 && !/^[\w-]{6,}$/.test(VIDEO))) {
  console.error('쓰는 법: node tools/블로그붙여넣기.js <원고.md> [--티스토리] [--영상 <유튜브 쇼츠 ID 또는 주소>] [--출력 <경로>]');
  process.exit(2);
}
const SRC = path.resolve(src);
const DIR = path.dirname(SRC);
const OUT = OUT_ARG > -1 ? path.resolve(args[OUT_ARG + 1]) : path.join(DIR, TISTORY ? '티스토리_편집기.json' : '붙여넣기.html');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inline(s, linkAttrs = '') {
  return esc(s)
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>')
    .replace(/(https?:\/\/[^\s<)]+)/g, `<a href="$1"${linkAttrs}>$1</a>`);
}

function imageFor(n) {
  const re = new RegExp(`^0?${n}_.*\\.(jpe?g|png|webp|gif)$`, 'i');
  return fs.readdirSync(DIR).find((f) => re.test(f)) || null;
}

// 칸 머리는 「**제목**」·「**카테고리**」·「**본문**」·「**태그**」 줄이고 순서는 원고마다 다르다(태그가 본문 앞에 올 수도 있다).
// 칸 값은 다음 칸 머리나 「---」까지이며 ``` 울타리 안에 있어도 된다. 「**제목:** …」 한 줄 꼴도 받는다.
// yuhobuilds 적용기는 끝 줄 「- 길이: … 태그: a, b.」에 태그를 둔다.
function parse(md) {
  const lines = md.replace(/^﻿/, '').replace(/\r\n/g, '\n').split('\n');
  const HEADS = ['제목', '카테고리', '본문', '태그'];
  const isHead = (l) => HEADS.some((h) => l.trim() === `**${h}**`);
  const at = (label) => lines.findIndex((l) => l.trim() === `**${label}**`);
  const values = (i) => {
    const out = [];
    for (let k = i + 1; k < lines.length && !isHead(lines[k]) && !/^---+$/.test(lines[k].trim()); k++) {
      if (lines[k].trim() && !/^```/.test(lines[k].trim())) out.push(lines[k].trim());
    }
    return out;
  };
  const field = (label) => {
    const i = at(label);
    if (i > -1) return values(i)[0] || '';
    const one = lines.map((l) => l.trim().match(new RegExp(`^\\*\\*${label}\\s*:?\\*\\*\\s*:?\\s*(.+)$`))).find(Boolean);
    return one ? one[1].trim() : '';
  };
  const iBody = at('본문');
  const iTags = at('태그');
  const title = field('제목');
  if (!title || iBody < 0) throw new Error('원고에 제목(「**제목**」 또는 「**제목:** …」)·「**본문**」 줄이 없습니다');
  const next = lines.findIndex((l, k) => k > iBody && isHead(l));
  let body = lines.slice(iBody + 1, next > -1 ? next : lines.length);
  let tags = [];
  if (iTags > -1) {
    tags = values(iTags).join(',').split(',');
  } else {
    const meta = body.findIndex((l) => /^\s*-\s*길이:.*태그:/.test(l));
    if (meta > -1) { tags = body[meta].replace(/^.*태그:\s*/, '').split(/[.。](?:\s|$)/)[0].split(','); body = body.slice(0, meta); }
  }
  while (body.length && /^\s*(---)?\s*$/.test(body[body.length - 1])) body.pop();
  return { title, category: field('카테고리'), body, tags: tags.map((t) => t.trim()).filter(Boolean) };
}

// 본문 줄을 덩어리(문단·소제목·인용·요청문·목록·번호 목록·표·구분선·그림 자리·영상 자리)로 나눈다.
// 그림 자리는 「〔그림 N〕 *설명*」과 「(그림 N — `파일`: 설명)」 꼴을 둘 다 받는다.
function blocks(body) {
  const out = [];
  let para = [];
  let list = null;
  let olist = null;
  let table = null;
  let quote = null;
  let code = null;
  const flushPara = () => { if (para.length) out.push({ t: 'p', text: para.join(' ') }); para = []; };
  const flushList = () => {
    if (list) out.push({ t: 'ul', items: list });
    if (olist) out.push({ t: 'ol', items: olist });
    if (table) out.push({ t: 'table', rows: table });
    list = null; olist = null; table = null;
  };
  const flushQuote = () => { if (quote) out.push({ t: 'quote', lines: quote }); quote = null; };
  const flushAll = () => { flushPara(); flushList(); flushQuote(); };
  for (const raw of body) {
    const line = raw.trimEnd();
    if (code) {
      if (/^```/.test(line.trim())) { out.push({ t: 'code', lines: code }); code = null; } else code.push(line);
      continue;
    }
    if (/^```/.test(line.trim())) { flushAll(); code = []; continue; }
    const fig = line.match(/^〔그림\s*(\d+)〕\s*(.*)$/);
    if (fig) {
      flushAll();
      out.push({ t: 'img', n: fig[1], file: imageFor(fig[1]), caption: fig[2].replace(/^\*(.*)\*$/, '$1').trim() });
      continue;
    }
    const fig2 = line.trim().match(/^\(그림\s*(\d+)(?:\s*[—–-]\s*`([^`]+)`)?\s*(?::\s*(.*))?\)$/);
    if (fig2) {
      flushAll();
      const named = fig2[2] && fs.existsSync(path.join(DIR, fig2[2])) ? fig2[2] : null;
      out.push({ t: 'img', n: fig2[1], file: named || imageFor(fig2[1]), caption: (fig2[3] || '').trim() });
      continue;
    }
    if (/^\|.*\|$/.test(line.trim())) {
      flushPara(); flushQuote();
      if (list || olist) flushList();
      if (!/^\|[\s:|-]+\|$/.test(line.trim())) (table = table || []).push(line.trim().slice(1, -1).split('|').map((c) => c.trim()));
      continue;
    }
    const oli = line.match(/^\s*\d+\.\s+(.*)$/);
    if (oli) { flushPara(); flushQuote(); if (list || table) flushList(); (olist = olist || []).push(oli[1]); continue; }
    const yt = line.match(/^〔유튜브\s*([^〕]*)〕\s*$/);
    if (yt) { flushAll(); out.push({ t: 'video', id: /^[\w-]{6,}$/.test(yt[1].trim()) ? yt[1].trim() : null }); continue; }
    if (!line.trim()) { flushAll(); continue; }
    if (/^---+$/.test(line.trim())) { flushAll(); out.push({ t: 'hr' }); continue; }
    const h = line.match(/^#{2,4}\s+(.*)$/);
    if (h) { flushAll(); out.push({ t: 'h', text: h[1] }); continue; }
    const q = line.match(/^>\s?(.*)$/);
    if (q) { flushPara(); flushList(); (quote = quote || []).push(q[1]); continue; }
    const li = line.match(/^\s*[-*]\s+(.*)$/);
    if (li) { flushPara(); flushQuote(); if (olist || table) flushList(); (list = list || []).push(li[1]); continue; }
    flushList(); flushQuote();
    para.push(line.trim());
  }
  flushAll();
  return out;
}

function naverHtml(bs) {
  return bs.map((b) => {
    switch (b.t) {
      case 'p': return `<p>${inline(b.text)}</p>`;
      case 'h': return `<h3>${inline(b.text)}</h3>`;
      case 'quote': return `<blockquote><p>${b.lines.map((l) => inline(l)).join('<br>')}</p></blockquote>`;
      case 'code': return `<blockquote><p>${b.lines.map(esc).join('<br>')}</p></blockquote>`;
      case 'ul': return `<ul>${b.items.map((t) => `<li>${inline(t)}</li>`).join('')}</ul>`;
      case 'ol': return `<ol>${b.items.map((t) => `<li>${inline(t)}</li>`).join('')}</ol>`;
      case 'table': return `<table border="1" cellpadding="6" style="border-collapse:collapse"><thead><tr>${b.rows[0].map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${b.rows.slice(1).map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      case 'hr': return '<hr>';
      case 'video': return b.id ? `<p class="mark">▶ 영상 자리 — https://youtu.be/${esc(b.id)} 를 붙여 넣고 이 줄은 지우세요</p>` : '';
      case 'img': return `<p class="mark">▶ 그림 ${b.n} 자리 — ${esc(b.file || '그림 파일 없음')}을 여기에 끌어다 놓고 이 줄은 지우세요</p>`
        + (b.caption ? `\n<p class="cap"><i>${inline(b.caption)}</i></p>` : '');
      default: return '';
    }
  }).join('\n');
}

// 티스토리 편집기 틀: 문단 p[data-ke-size=size16], 소제목 h3[data-ke-size=size23], 빈 줄 문단으로 띄우고 소제목 바로 뒤만 붙인다.
function tistoryHtml(bs) {
  const A = ' target="_blank" rel="noopener"';
  const P = (html) => `<p data-ke-size="size16">${html}</p>`;
  const parts = bs.map((b) => {
    switch (b.t) {
      case 'p': return P(inline(b.text, A));
      case 'h': return `<h3 data-ke-size="size23">${inline(b.text, A)}</h3>`;
      case 'quote': return `<blockquote data-ke-style="style2">${b.lines.map((l) => inline(l, A)).join('<br>')}</blockquote>`;
      case 'code': return `<blockquote data-ke-style="style3">${b.lines.map(esc).join('<br>')}</blockquote>`;
      case 'ul': return `<ul style="list-style-type: disc;" data-ke-list-type="disc">${b.items.map((t) => `<li>${inline(t, A)}</li>`).join('')}</ul>`;
      case 'ol': return `<ol style="list-style-type: decimal;" data-ke-list-type="decimal">${b.items.map((t) => `<li>${inline(t, A)}</li>`).join('')}</ol>`;
      case 'table': return `<table style="border-collapse: collapse; width: 100%;" border="1" data-ke-align="alignLeft"><tbody>${b.rows.map((r, i) => `<tr>${r.map((c) => `<td>${i ? inline(c, A) : `<b>${inline(c, A)}</b>`}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      case 'hr': return '<hr>';
      case 'video': return !b.id ? '' : `<figure data-ke-type="video" data-ke-style="alignCenter" data-video-host="youtube" data-video-url="https://www.youtube.com/shorts/${esc(b.id)}" data-video-width="360" data-video-height="640" data-video-origin-width="360" data-video-origin-height="640" data-ke-mobilestyle="widthContent"><iframe src="https://www.youtube.com/embed/${esc(b.id)}" width="360" height="640" frameborder="" allowfullscreen="true"></iframe><figcaption style="display: none;"></figcaption></figure>`;
      case 'img': return P(`〔그림 ${b.n}〕`) + (b.caption ? P(`<i>${inline(b.caption, A)}</i>`) : '');
      default: return '';
    }
  });
  const BL = P('&nbsp;');
  return parts.map((h, i) => (i && bs[i - 1].t !== 'h' ? BL : '') + h).join('');
}

function page({ title, tags }, bs) {
  const imgs = bs.filter((b) => b.t === 'img').map(({ n, file }) => file
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
${naverHtml(bs)}
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
let bs = blocks(doc.body);
// --영상: 빈 영상 자리를 그 ID로 채우고, 자리가 없으면 첫 문단 뒤에 넣는다.
if (VIDEO) {
  const holes = bs.filter((b) => b.t === 'video' && !b.id);
  if (holes.length) holes.forEach((b) => { b.id = VIDEO; });
  else if (!bs.some((b) => b.t === 'video')) { const i = bs.findIndex((b) => b.t === 'p'); bs.splice(i + 1, 0, { t: 'video', id: VIDEO }); }
}
bs = bs.filter((b) => b.t !== 'video' || b.id || (console.warn('영상 자리에 유튜브 ID가 없어 뺐습니다 — 게시 때 --영상 <그 편 쇼츠 ID>로 채운다'), false));
const imgs = bs.filter((b) => b.t === 'img');
const missing = imgs.filter((b) => !b.file).map((b) => b.n);
if (TISTORY) {
  fs.writeFileSync(OUT, JSON.stringify({
    제목: doc.title,
    카테고리: doc.category || null,
    태그: doc.tags,
    본문HTML: tistoryHtml(bs),
    그림: imgs.map((b) => ({ 번호: b.n, 파일: b.file, 경로: b.file ? path.join(DIR, b.file) : null })),
    영상: bs.filter((b) => b.t === 'video').map((b) => b.id),
  }, null, 2) + '\n');
} else {
  fs.writeFileSync(OUT, page(doc, bs));
}
console.log(`${path.relative(process.cwd(), OUT)} · 제목 ${doc.title.length}자 · 그림 자리 ${imgs.length}개${missing.length ? ` (파일 없음: ${missing.join(', ')})` : ''} · 태그 ${doc.tags.length}개${doc.category ? ` · 카테고리 ${doc.category}` : ''}`);
if (missing.length) process.exitCode = 1;
