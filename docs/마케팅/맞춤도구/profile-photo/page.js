'use strict';
/* synk.im/brief/profile-photo — synkbrief 「셀카 한 장으로 프로필 사진」 나눔 자료(2026-11-22).
 * 편의 자료 원고(자료_프로필사진.md)를 글 그대로 읽어 한 쪽(index.html)으로 그린다. 쪽의 글은 이 파일에 적지 않는다.
 * 이 파일이 더하는 것은 명령어마다 「복사」 단추, 실험 사진 일곱 장과 그 설명(블로그 원고의 그림 설명), 머리의 큰 제목 줄바꿈이다.
 * 검사 · 그리기는 순수 함수이고, 빌드(../build.mjs profile-photo)가 파일을 쓴다. 가입 · 추적 · 서버 전송 없음, 바깥 자원 없음.
 */
const fs = require('node:fs');
const path = require('node:path');
const 규칙 = require('../../../../tools/lib/게시글규칙.js');

const SOURCE = path.join(__dirname, '../../synkbrief_프로필사진_20261121/게시/자료_프로필사진.md');
const URL = 'https://synk.im/brief/profile-photo/';
// 머리 큰 제목: 원고 첫 줄(# …)을 세 줄로 끊는다. 마지막 줄만 버터(영상 표지와 같은 결).
const TITLE_LINES = ['셀카 한 장을', '프로필 사진으로', '바꾸는 법'];
// 영상 표지의 작은 글 둘을 그대로 쓴다.
const EYEBROW = 'SYNK 브리핑 · ChatGPT 앱';
const AI_NOTE = '예시 셀카는 AI로 만든 가상 인물이에요';

// 원고의 절(## …) → 주소 조각. 머리 목록의 세 단계가 여기로 건너뛴다.
const SECTION_IDS = [[/^1단계/, 'step1'], [/^2단계/, 'step2'], [/^3단계/, 'step3'], [/^하나씩만/, 'one-change'], [/^이렇게 쓰면 안 돼요/, 'dont']];
const STEP_IDS = ['step1', 'step2', 'step3'];
// 머리 글 가운데 「여섯 개는 뒤에」를 그 절로 잇는다.
const LINKS = [{ text: '배경만, 옷만 바꾸는 명령어 여섯 개는 뒤에 있어요.', href: '#one-change' }];
// 이 절의 인용(>)은 「보내면 안 되는 말」이라 복사 단추를 달지 않는다.
const BAD_SECTION = '이렇게 쓰면 안 돼요';
const ONE_CHANGE_HEAD = ['바꿀 것', '붙여 넣는 명령어', '저희가 받은 결과'];

// 실험 사진 일곱 장(편 게시/blog/01~07을 1200px webp로, 메타데이터 없음). before = 그 앞에 놓을 원고 덩어리의 글,
// lead = 큰 제목과 AI 표시 바로 아래(결과 먼저 — 영상 표지와 같은 자리).
// cap은 블로그 원고의 그림 설명 그대로, alt는 화면 낭독기용 그림 설명.
const SHOTS = [
  { file: '01-first-selfie.webp', w: 1200, h: 717, before: null, cap: '왼쪽은 보낸 셀카, 오른쪽은 명령어를 한 번 보내고 받은 사진이에요.', alt: '왼쪽은 빨래가 널린 방에서 회색 티셔츠를 입고 찍은 셀카, 오른쪽은 밝은 회색 배경에 네이비 재킷과 흰 셔츠를 입은 프로필 사진', lead: true },
  { file: '02-second-selfie.webp', w: 1200, h: 792, before: '제미나이 앱으로 할 때', cap: '둘째 셀카(왼쪽)와 같은 명령어로 받은 사진(오른쪽).', alt: '왼쪽은 스탠드 불빛 아래 책상 앞에서 안경을 쓰고 아래에서 올려 찍은 셀카, 오른쪽은 회색 배경에 네이비 재킷을 입은 정면 프로필 사진' },
  { file: '03-chatgpt-gemini.webp', w: 1200, h: 718, before: '회색 배경, 네이비 재킷과 흰 셔츠, 정면 사진이 왔어요.', cap: '같은 명령어로 받은 사진 — 왼쪽 ChatGPT, 오른쪽 제미나이.', alt: '같은 셀카로 받은 프로필 사진 두 장. 왼쪽은 잔머리가 남았고, 오른쪽은 머리가 단정하고 주근깨가 거의 없다' },
  { file: '04-face-check.webp', w: 1200, h: 595, before: '휴대폰 사진첩에서 보낸 셀카와 받은 사진을 번갈아 넘겨 봐요.', cap: '보낸 셀카(왼쪽)와 받은 사진(오른쪽)의 얼굴을 같은 크기로 놓은 모습.', alt: '셀카의 얼굴과 받은 사진의 얼굴을 같은 크기로 나란히 놓은 사진. 볼의 점과 홑꺼풀이 같은 자리에 있다' },
  { file: '05-flyaway-hair.webp', w: 1200, h: 655, before: '하나씩만 바꾸는 명령어 여섯 개', cap: '한 줄 더 보내기 전(왼쪽)과 보낸 뒤(오른쪽).', alt: '잔머리가 삐져나온 프로필 사진과, 잔머리가 귀 뒤로 정리된 같은 사진' },
  { file: '06-one-change.webp', w: 1200, h: 992, before: '바꿀 것', cap: '윗줄은 배경만 · 조명만 · 옷만, 아랫줄은 구도만 · 흑백으로 · 다른 장소로.', alt: '같은 셀카에서 한 가지씩만 바꾼 사진 여섯 장. 회색 벽 배경, 부드러운 조명, 네이비 재킷, 정면 구도, 흑백 재킷 차림, 햇빛 드는 카페' },
  { file: '07-dont.webp', w: 1200, h: 474, before: '1. 「프로필 사진 만들어 줘」라고만 보내기', cap: '왼쪽부터 「프로필 사진 만들어 줘」 · 「예쁘게 보정해서」 · 「활짝 웃는」으로 받은 사진.', alt: '동그랗게 잘린 셀카, 잡티가 지워진 재킷 차림 사진, 이를 드러내고 활짝 웃는 사진' },
];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
const plain = (s) => String(s).replace(/\*\*(.+?)\*\*/g, '$1');

function read(file = SOURCE) {
  return { md: fs.readFileSync(file, 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n'), source: file };
}

// ── 원고 읽기: 이 원고가 쓰는 마크다운만(# ## 문단 **이름표** - · 1. 목록과 그 안의 - · > 인용 · 표 · ---) ──
function parse(md) {
  const lines = md.split('\n');
  const blocks = [];
  let para = null;
  const flush = () => { if (para) { blocks.push({ type: 'p', text: para.join(' ') }); para = null; } };
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) { flush(); continue; }
    let m;
    if ((m = /^# (.+)$/.exec(line))) { flush(); blocks.push({ type: 'h1', text: m[1] }); continue; }
    if ((m = /^## (.+)$/.exec(line))) { flush(); blocks.push({ type: 'h2', text: m[1] }); continue; }
    if (/^---+$/.test(line)) { flush(); blocks.push({ type: 'hr' }); continue; }
    if ((m = /^> ?(.*)$/.exec(line))) { flush(); blocks.push({ type: 'quote', text: m[1] }); continue; }
    if (line.startsWith('|')) {
      flush();
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(lines[i].trim()); i += 1; }
      i -= 1;
      const cells = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      blocks.push({ type: 'table', head: cells(rows[0]), rows: rows.slice(2).map(cells) });
      continue;
    }
    if ((m = /^\*\*(.+?)\*\*(.*)$/.exec(line)) && !para) { flush(); blocks.push({ type: 'label', text: m[1], note: m[2].trim() }); continue; }
    if ((m = /^(\s*)- (.+)$/.exec(raw))) {
      flush();
      const nested = m[1].length > 0;
      const last = blocks[blocks.length - 1];
      if (nested && last && last.type === 'ol') { const item = last.items[last.items.length - 1]; (item.sub = item.sub || []).push(m[2]); continue; }
      if (last && last.type === 'ul' && !nested) { last.items.push({ text: m[2] }); continue; }
      blocks.push({ type: 'ul', items: [{ text: m[2] }] });
      continue;
    }
    if ((m = /^\d+\. (.+)$/.exec(line))) {
      flush();
      const last = blocks[blocks.length - 1];
      if (last && last.type === 'ol') last.items.push({ text: m[1] }); else blocks.push({ type: 'ol', items: [{ text: m[1] }] });
      continue;
    }
    (para = para || []).push(line);
  }
  flush();
  return blocks;
}

// 덩어리의 열쇠 글(그림 자리 찾기용): 제목 · 이름표 · 문단은 그 글, 목록은 첫 항목, 표는 첫 머리 칸.
function keyOf(b) {
  if (b.type === 'ul' || b.type === 'ol') return plain(b.items[0].text);
  if (b.type === 'table') return b.head[0];
  return plain(b.text || '');
}

// 절로 묶는다. h1과 그 뒤 머리 글은 intro, 마지막 --- 뒤 절 없는 글은 끝 줄(colophon).
function sections(blocks) {
  const out = [{ kind: 'intro', title: null, blocks: [] }];
  let afterHr = false;
  for (const b of blocks) {
    if (b.type === 'h1') { out[0].title = b.text; continue; }
    if (b.type === 'hr') { afterHr = true; continue; }
    if (b.type === 'h2') { out.push({ kind: 'section', title: b.text, blocks: [] }); afterHr = false; continue; }
    if (afterHr && out.length > 1) { out.push({ kind: 'colophon', title: null, blocks: [] }); afterHr = false; }
    out[out.length - 1].blocks.push(b);
  }
  return out;
}

const sectionId = (title, n) => { const hit = SECTION_IDS.find(([re]) => re.test(title)); return hit ? hit[1] : `s${n}`; };

// 원고에서 보이는 글 조각 전부 — 쪽에 하나도 빠지지 않았는지 검사에 쓴다.
function sourceTexts(md) {
  const out = [];
  for (const b of parse(md)) {
    if (b.type === 'hr') continue;
    if (b.type === 'table') { out.push(...b.head, ...b.rows.flat()); continue; }
    if (b.type === 'ul' || b.type === 'ol') { for (const it of b.items) out.push(plain(it.text), ...(it.sub || []).map(plain)); continue; }
    if (b.type === 'label') { out.push(plain(b.text)); if (b.note) out.push(plain(b.note)); continue; }
    out.push(plain(b.text));
  }
  return out.filter(Boolean);
}

// ── 쪽 ──
let cmdNo = 0;
function cmdBox(text, label) {
  cmdNo += 1;
  const id = `cmd-${cmdNo}`;
  return `<div class="cmd"><p class="cmd-text" id="${id}">${inline(text)}</p><button type="button" class="copy" data-copy="${id}" aria-describedby="${id}"${label ? ` aria-label="${esc(`${label} 명령어 복사`)}"` : ''}>복사</button></div>`;
}

function figure(s) {
  const lazy = s.lead ? ' fetchpriority="high"' : ' loading="lazy"';
  return `<figure class="shot"><img src="shots/${s.file}" width="${s.w}" height="${s.h}" alt="${esc(s.alt)}" decoding="async"${lazy}><figcaption>${esc(s.cap)}</figcaption></figure>`;
}

function listHtml(b, { stepLinks = false } = {}) {
  const tag = b.type;
  const items = b.items.map((it, i) => {
    let html = inline(it.text);
    if (stepLinks && STEP_IDS[i]) {
      const cut = it.text.indexOf(':');
      if (cut > 0) html = `<a href="#${STEP_IDS[i]}">${inline(it.text.slice(0, cut))}</a>${inline(it.text.slice(cut))}`;
    }
    const sub = it.sub ? `<ul>${it.sub.map((s) => `<li>${inline(s)}</li>`).join('')}</ul>` : '';
    return `<li>${html}${sub}</li>`;
  }).join('');
  return `<${tag}${tag === 'ol' ? ' class="steps"' : ''}>${items}</${tag}>`;
}

function blockHtml(b, ctx) {
  switch (b.type) {
    case 'p': {
      let html = inline(b.text);
      for (const l of LINKS) { const t = inline(l.text); if (html.includes(t)) html = html.replace(t, `<a href="${l.href}">${t}</a>`); }
      return `<p>${html}</p>`;
    }
    case 'label': return `<h3>${inline(b.text)}${b.note ? ` <span class="note">${inline(b.note)}</span>` : ''}</h3>`;
    case 'quote': return ctx.bad ? `<blockquote class="bad"><p>${inline(b.text)}</p></blockquote>` : cmdBox(b.text);
    case 'ul': case 'ol': return listHtml(b, { stepLinks: ctx.intro && b.type === 'ol' });
    case 'table': {
      const [h0, h1, h2] = b.head;
      return `<div class="cards">${b.rows.map(([what, cmd, got]) => `<article class="card"><h3><span class="sr">${esc(h0)}: </span>${inline(what)}</h3><p class="cap">${esc(h1)}</p>${cmdBox(cmd, plain(what))}<p class="cap">${esc(h2)}</p><p>${inline(got)}</p></article>`).join('')}</div>`;
    }
    default: return '';
  }
}

function withShots(blocks) {
  const out = [];
  for (const b of blocks) {
    for (const s of SHOTS) if (s.before && (keyOf(b) === s.before || (b.type !== 'h2' && b.type !== 'label' && keyOf(b).startsWith(s.before) && s.before.length > 12))) out.push({ type: 'shot', shot: s });
    out.push(b);
  }
  return out;
}

const CSS = `@font-face{font-family:'SUIT Variable';font-weight:100 900;font-display:swap;src:url(assets/SUIT-subset.woff2) format('woff2')}
@font-face{font-family:'SYNK Latin';font-weight:100 450;font-display:swap;src:url(assets/InterTight-400.woff2) format('woff2');unicode-range:U+0021-007E,U+00A0-00B6,U+00B8-00FF,U+2013-2014,U+2018-201D,U+2026}
@font-face{font-family:'SYNK Latin';font-weight:451 620;font-display:swap;src:url(assets/InterTight-500.woff2) format('woff2');unicode-range:U+0021-007E,U+00A0-00B6,U+00B8-00FF,U+2013-2014,U+2018-201D,U+2026}
@font-face{font-family:'SYNK Latin';font-weight:621 900;font-display:swap;src:url(assets/InterTight-700.woff2) format('woff2');unicode-range:U+0021-007E,U+00A0-00B6,U+00B8-00FF,U+2013-2014,U+2018-201D,U+2026}
@font-face{font-family:'DM Mono';font-weight:500;font-display:swap;src:url(assets/DMMono-500.woff2) format('woff2');unicode-range:U+0021-007E}
:root{--bg:#060709;--panel:#0C0D10;--s1:#14151A;--s2:#1C1D23;--line:rgba(255,255,255,.08);--line-2:rgba(255,255,255,.16);--ink:#FAFAF9;--ink-2:rgba(250,250,249,.8);--ink-3:rgba(250,250,249,.6);--butter:#F5C445;--sans:'SYNK Latin','SUIT Variable',system-ui,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color-scheme:dark}
*,*::before,*::after{box-sizing:border-box}
html{background:var(--bg);-webkit-text-size-adjust:100%;text-size-adjust:100%;scroll-behavior:smooth;scroll-padding-top:16px}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
body{margin:0;background:var(--bg);color:var(--ink);font:450 16.5px/1.72 var(--sans);word-break:keep-all;overflow-wrap:anywhere;-webkit-font-smoothing:antialiased}
a{color:var(--ink);text-decoration:underline;text-decoration-color:var(--ink-3);text-underline-offset:4px}
img{display:block;max-width:100%;height:auto}
b{font-weight:650}
:focus-visible{outline:2px solid var(--ink);outline-offset:3px}
.sr{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.page{max-width:760px;margin:0 auto;padding:12px 12px 32px}
.bar{display:flex;align-items:center;gap:14px;height:56px;margin:0 0 12px;padding:0 8px;border-radius:999px;background:var(--s1);box-shadow:inset 0 0 0 1px var(--line)}
.brand{display:flex;align-items:center;gap:12px;min-width:0;min-height:44px;text-decoration:none}
.bead{display:grid;place-items:center;flex:none;height:40px;padding:0 14px;border-radius:999px;background:#FAFAF9}
.bead img{height:24px;width:auto}
.crumb{font:500 11.5px/1 'DM Mono',var(--sans);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
main{padding:30px 22px 34px;border-radius:28px;background:var(--panel);box-shadow:inset 0 0 0 1px var(--line)}
.eyebrow{margin:0 0 14px;font-size:14px;font-weight:600;color:var(--ink-2)}
h1{margin:0 0 14px;font-size:clamp(36px,9.6vw,58px);font-weight:800;line-height:1.14;letter-spacing:-.035em}
h1 span{display:block}
h1 .hl{color:var(--butter)}
.ai-note{margin:0 0 22px;font-size:14px;color:var(--ink-3)}
section{padding:30px 0 0;margin:30px 0 0;border-top:1px solid var(--line)}
h2{margin:0 0 14px;font-size:24px;font-weight:750;line-height:1.35;letter-spacing:-.02em}
h3{margin:22px 0 8px;font-size:17px;font-weight:700;line-height:1.45}
h3 .note{font-size:14px;font-weight:450;color:var(--ink-3)}
p{margin:0 0 12px}
ul,ol{margin:0 0 14px;padding:0;list-style:none}
li{position:relative;margin:0 0 8px}
ul>li{padding-left:18px}
ul>li::before{content:"";position:absolute;left:3px;top:.72em;width:6px;height:6px;border-radius:50%;background:var(--ink-2)}
ol{counter-reset:n}
ol>li{counter-increment:n;padding-left:30px}
ol>li::before{content:counter(n);position:absolute;left:0;top:0;font-weight:700;color:var(--ink)}
li ul{margin:8px 0 0}
.steps a{font-weight:650}
.cmd{margin:10px 0 16px;padding:16px 16px 14px;border-radius:18px;background:var(--s2);box-shadow:inset 0 0 0 1px var(--line-2)}
.cmd-text{margin:0 0 12px;font-size:17px;font-weight:550;line-height:1.66;-webkit-user-select:all;user-select:all}
.copy{display:flex;align-items:center;justify-content:center;width:100%;min-height:48px;padding:0 20px;border:0;border-radius:999px;background:var(--ink);color:#08090C;font:650 16px/1 var(--sans);cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.copy:active{transform:scale(.98)}
.copy.ok{background:transparent;color:var(--ink);box-shadow:inset 0 0 0 1px var(--line-2)}
blockquote.bad{margin:10px 0 14px;padding:14px 16px;border-radius:18px;box-shadow:inset 0 0 0 1px var(--line-2)}
blockquote.bad p{margin:0;font-size:16.5px;color:var(--ink-2)}
.shot{margin:16px 0 18px}
.shot img{width:100%;border-radius:14px;background:var(--s1)}
.shot figcaption{margin:8px 2px 0;font-size:14px;line-height:1.55;color:var(--ink-3)}
.cards{display:grid;gap:12px;margin:6px 0 14px}
.card{padding:16px 16px 6px;border-radius:20px;background:var(--s1);box-shadow:inset 0 0 0 1px var(--line)}
.card h3{margin:0 0 6px;font-size:18px}
.card .cap{margin:0 0 2px;font-size:13px;font-weight:600;color:var(--ink-3)}
.card .cmd{margin-top:6px}
.colophon{margin:30px 0 0;padding:18px 0 0;border-top:1px solid var(--line);font-size:14px;color:var(--ink-3)}
.colophon p{margin:0}
footer{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px 16px;padding:18px 10px 0;font-size:14px;color:var(--ink-3)}
footer a{color:var(--ink-2)}
@media(min-width:640px){main{padding:44px 48px 46px}.copy{width:auto;min-width:120px}.cmd{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;align-items:end}.cmd-text{margin:0}}
@media(max-width:380px){main{padding:26px 16px 30px}.page{padding:8px 8px 28px}}
@media print{.bar,.copy,footer{display:none}main{box-shadow:none}}`;

const SCRIPT = `(function(){
var live=document.getElementById('live');
function show(btn,ok){btn.textContent=ok?'복사했어요':'길게 눌러 복사';btn.classList.toggle('ok',ok);live.textContent=ok?'명령어를 복사했어요':'복사가 막혀 있어요. 명령어를 길게 눌러 복사해 주세요';clearTimeout(btn._t);btn._t=setTimeout(function(){btn.textContent='복사';btn.classList.remove('ok')},2400)}
function fallback(btn,el){var r=document.createRange();r.selectNodeContents(el);var s=window.getSelection();s.removeAllRanges();s.addRange(r);var ok=false;try{ok=document.execCommand('copy')}catch(e){ok=false}if(ok)s.removeAllRanges();show(btn,ok)}
document.addEventListener('click',function(e){var btn=e.target.closest&&e.target.closest('[data-copy]');if(!btn)return;var el=document.getElementById(btn.getAttribute('data-copy'));var text=el.textContent;
if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(text).then(function(){show(btn,true)},function(){fallback(btn,el)});else fallback(btn,el)});
})();`;

function renderPage(data) {
  cmdNo = 0;
  const parts = sections(parse(data.md));
  const intro = parts[0];
  const desc = intro.blocks.filter((b) => b.type === 'p').map((b) => plain(b.text)).join(' ');
  let n = 0;
  const body = parts.map((sec) => {
    if (sec.kind === 'intro') return withShots(sec.blocks).map((b) => (b.type === 'shot' ? '' : blockHtml(b, { intro: true }))).join('\n');
    if (sec.kind === 'colophon') return `<div class="colophon">${sec.blocks.map((b) => blockHtml(b, {})).join('')}</div>`;
    n += 1;
    const id = sectionId(sec.title, n);
    const ctx = { bad: sec.title === BAD_SECTION };
    return `<section id="${id}" aria-labelledby="h-${id}">\n<h2 id="h-${id}">${inline(sec.title)}</h2>\n${withShots(sec.blocks).map((b) => (b.type === 'shot' ? figure(b.shot) : blockHtml(b, ctx))).join('\n')}\n</section>`;
  });
  // 섹션 첫머리에 놓을 그림(before가 절 제목)은 그 절 바로 앞, 머리 글 끝에 놓는다.
  const lead = SHOTS.filter((s) => parts.some((p) => p.kind === 'section' && p.title === s.before));
  const leadHtml = (title) => lead.filter((s) => s.before === title).map(figure).join('\n');
  const html = parts.map((sec, i) => (sec.kind === 'section' ? leadHtml(sec.title) + '\n' : '') + body[i]).join('\n');
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(intro.title)} · SYNK 브리핑</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#060709">
<link rel="canonical" href="${URL}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="SYNK 브리핑">
<meta property="og:title" content="${esc(intro.title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${URL}">
<meta property="og:image" content="${URL}og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" href="assets/favicon-32.png">
<link rel="preload" href="assets/SUIT-subset.woff2" as="font" type="font/woff2" crossorigin>
<style>
${CSS}
</style>
</head>
<body>
<div class="page">
<header class="bar">
<a class="brand" href="https://synk.im/shift/" aria-label="SYNK SHIFT 홈 · SYNK 브리핑"><span class="bead"><img src="brand-shift-sm.webp" alt="synk SHIFT" width="88" height="24"></span><span class="crumb" aria-hidden="true">synkbrief / profile photo</span></a>
</header>
<main>
<p class="eyebrow">${esc(EYEBROW)}</p>
<h1><span class="sr">${esc(intro.title)}</span>${TITLE_LINES.map((l, i) => `<span aria-hidden="true"${i === TITLE_LINES.length - 1 ? ' class="hl"' : ''}>${esc(l)}</span>`).join('')}</h1>
<p class="ai-note">${esc(AI_NOTE)}</p>
${SHOTS.filter((s) => s.lead).map(figure).join('')}
${html}
</main>
<footer><span>SYNK 브리핑</span><span><a href="https://www.instagram.com/synkbrief/" rel="noopener">Instagram</a> · <a href="https://www.youtube.com/@synkbrief" rel="noopener">YouTube</a></span></footer>
</div>
<div id="live" class="sr" aria-live="polite"></div>
<script>
${SCRIPT}
</script>
</body>
</html>
`;
}

// 쪽 글(태그 뺀 글)
function pageText(html) {
  return html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<head[\s\S]*?<\/head>/g, ' ').replace(/<\/?(?:a|b)(?:\s[^>]*)?>/g, '').replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

// 검수 · 제작 AI 이름(주제인 ChatGPT · 제미나이 · OpenAI · 구글은 둔다)
const MAKER_AI = /(claude|클로드|fable|페이블|아르곤|argon|카본|carbon|codex|코덱스|\bopus\b|sonnet|gpt[\s-]?image|grok|그록)/i;

function check(data) {
  const out = [];
  const blocks = parse(data.md);
  const parts = sections(blocks);
  if (parts[0].title !== TITLE_LINES.join(' ')) out.push(`큰 제목 줄 「${TITLE_LINES.join(' ')}」이 원고 첫 줄 「${parts[0].title}」과 다르다`);
  const titles = parts.filter((p) => p.kind === 'section').map((p) => p.title);
  for (const id of STEP_IDS) if (!titles.some((t, i) => sectionId(t, i + 1) === id)) out.push(`건너뛸 절 ${id}가 원고에 없다`);
  if (!titles.includes(BAD_SECTION)) out.push(`「${BAD_SECTION}」 절이 원고에 없다`);
  const tables = blocks.filter((b) => b.type === 'table');
  if (tables.length !== 1 || ONE_CHANGE_HEAD.some((h, i) => tables[0].head[i] !== h)) out.push(`표는 하나이고 머리가 ${ONE_CHANGE_HEAD.join(' | ')}여야 한다`);
  for (const s of SHOTS.filter((x) => !x.lead)) {
    const hits = blocks.filter((b) => b.type !== 'hr' && (keyOf(b) === s.before || (b.type !== 'h2' && b.type !== 'label' && keyOf(b).startsWith(s.before) && s.before.length > 12)));
    if (hits.length !== 1) out.push(`그림 ${s.file}의 자리 「${s.before}」가 원고에서 ${hits.length}곳이다(한 곳이어야 한다)`);
  }
  const html = renderPage(data);
  const text = pageText(html);
  for (const t of sourceTexts(data.md)) if (!text.includes(t.replace(/\s+/g, ' '))) out.push(`원고 글이 쪽에 없다: ${t}`);
  for (const l of LINKS) if (!html.includes(`<a href="${l.href}">`)) out.push(`이음 「${l.text}」가 쪽에 없다`);
  const cmds = (html.match(/class="cmd-text"/g) || []).length;
  const want = blocks.filter((b) => b.type === 'quote').length - parts.filter((p) => p.title === BAD_SECTION).flatMap((p) => p.blocks).filter((b) => b.type === 'quote').length + tables[0].rows.length;
  if (cmds !== want) out.push(`복사 단추 달린 명령어가 ${cmds}개다(${want}개여야 한다)`);
  if (!text.includes(AI_NOTE)) out.push('AI로 만든 가상 인물 표시가 없다');
  const visible = `${text} ${SHOTS.map((s) => `${s.cap} ${s.alt}`).join(' ')}`;
  if (MAKER_AI.test(visible)) out.push(`보이는 글에 제작 · 검수 AI 이름: ${MAKER_AI.exec(visible)[0]}`);
  for (const f of 규칙.checkText(visible, { where: '쪽 글', brand: 'synkbrief', language: 'ko', platform: 'web' })) {
    if (f.level === 규칙.FIX && ['maker-tool', 'relative-date', 'internal-code'].includes(f.code)) out.push(f.message);
  }
  if (/https?:\/\/(?!synk\.im\/|www\.instagram\.com\/synkbrief\/|www\.youtube\.com\/@synkbrief)/.test(html.replace(/<meta[^>]*>|<link rel="canonical"[^>]*>/g, ''))) out.push('바깥 주소를 부른다');
  return out;
}

function missingShots(data, here = __dirname) {
  return SHOTS.map((s) => `shots/${s.file}`).filter((f) => !fs.existsSync(path.join(here, f)));
}

module.exports = { read, parse, sections, sourceTexts, pageText, check, missingShots, renderPage, SHOTS, TITLE_LINES, EYEBROW, AI_NOTE, URL, SOURCE };
