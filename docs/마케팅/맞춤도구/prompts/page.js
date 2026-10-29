'use strict';
/* synk.im/prompts — 프롬프트 모음 한 쪽(2026-10-22). 항목 검사, 편 기록(준비.json·게시결과.json) 읽기, 페이지 그리기.
 * 그리기는 순수 함수이고, 빌드(../build.mjs prompts)가 프롬프트.json과 편 기록을 읽어 넘긴다. 꼴과 규칙은 README.md.
 */
const fs = require('node:fs');
const path = require('node:path');
const 규칙 = require('../../../../tools/lib/게시글규칙.js');

const KINDS = ['프롬프트', '명령', '체크리스트'];
const ITEM_KEYS = ['id', '편', '제목', '설명', '왜', '블록', '빈칸', '확인', '영상제목', '도구'];
const BLOCK_KEYS = ['종류', '넣는 곳', '본문', '메모'];
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// 빈칸: 【이름】 또는 기본값이 있는 【이름=기본값】. 기본값이 있으면 화면에 기본값이 보이고, 안 채우고 복사해도 그대로 쓸 수 있다.
const BLANK = /【([^【】=\n]+?)(?:=([^【】\n]+))?】/g;
const SITE = 'https://synk.im/prompts/';
// 이 페이지는 AI 이름 대신 쓰임새로 적는다(README 「표기」). 게시글 규칙의 AI·제작 도구 목록에 맨 이름 몇 개를 더 막는다.
// 뒤에는 라틴 글자만 막는다 — 「gpt로」처럼 조사가 붙어도 잡는다.
const MORE_NAMES = /(?<![\p{L}\p{N}])(gpt|openai|codex|anthropic|오픈ai|코덱스|앤트로픽)(?![a-z])/giu;
// 게시결과.json의 계정 → 화면 이름. 순서대로 보인다.
const SOURCES = [['yuhobuilds-youtube', '유튜브 쇼츠'], ['yuhobuilds-instagram', '인스타 릴스'], ['shift-tistory', '블로그 글']];
const CHANNELS = [['https://www.youtube.com/@yuhobuilds', '유튜브 @yuhobuilds'], ['https://www.instagram.com/yuhobuilds/', '인스타 @yuhobuilds']];

const blanksOf = (text) => [...String(text || '').matchAll(BLANK)].map((m) => ({ name: m[1].trim(), value: m[2] ? m[2].trim() : '' }));

// 보이는 글(본문 포함)에 AI·제작 도구 이름, 내부 번호를 쓰지 않는다. 상대 날짜는 설명 글만 본다 —
// 프롬프트 본문의 「이번 달」은 붙여 넣는 사람의 때라 맞는 말이다.
function textProblems(text, where, { body = false } = {}) {
  const codes = body ? ['ai-name', 'maker-tool'] : ['ai-name', 'maker-tool', 'relative-date', 'internal-code'];
  const out = 규칙.checkText(text, { where, brand: 'LAB', language: 'ko', platform: 'web' })
    .filter((f) => f.level === 규칙.FIX && codes.includes(f.code))
    .map((f) => `${where}: ${f.message}`);
  const more = [...new Set([...String(text || '').matchAll(MORE_NAMES)].map((m) => m[0]))];
  if (more.length) out.push(`${where}: AI 이름 「${more.join('·')}」 — 이 페이지는 쓰임새로 적는다(채팅 AI·코딩 AI)`);
  return out;
}

// 편 폴더의 준비.json에서 영상 공개일(슬롯)과 영상 제목(「 — 」 앞)을 읽는다. 슬롯은 자주 밀려서 항목에 따로 적지 않는다.
function episodeOf(repo, episode) {
  try {
    const prep = JSON.parse(fs.readFileSync(path.join(repo, 'docs', '마케팅', episode, '게시', '준비.json'), 'utf8'));
    return { 날짜: /^\d{4}-\d{2}-\d{2}$/.test(prep.슬롯 || '') ? prep.슬롯 : null, 제목: String(prep.제목 || '').split(' — ')[0].trim() || null };
  } catch { return { 날짜: null, 제목: null }; }
}

// 빌드가 쓰는 항목: 프롬프트.json 항목에 편의 날짜·영상 제목을 붙인다.
function withEpisodes(data, repo) {
  return { ...data, 항목: data.항목.map((it) => { const ep = episodeOf(repo, it.편); return { ...it, 날짜: ep.날짜, 영상제목: it.영상제목 || ep.제목 }; }) };
}

function checkPrompts(data, { repo } = {}) {
  const out = [];
  const items = data && Array.isArray(data.항목) ? data.항목 : null;
  if (!items || !items.length) return ['「항목」이 비었다'];
  const ids = new Set();
  items.forEach((it, i) => {
    const at = `항목 ${i + 1}(${it.id || '아이디 없음'})`;
    for (const key of Object.keys(it)) if (!ITEM_KEYS.includes(key) && !(key === '날짜' && !repo)) out.push(`${at}: 모르는 칸 「${key}」(README 「항목 꼴」)`);
    if (!ID.test(it.id || '')) out.push(`${at}: id는 영문 소문자·숫자·하이픈`);
    else if (ids.has(it.id)) out.push(`${at}: id가 겹친다`);
    ids.add(it.id);
    if (!it.편) out.push(`${at}: 「편」(docs/마케팅 아래 편 폴더)이 없다`);
    else if (repo) {
      const ep = episodeOf(repo, it.편);
      if (!ep.날짜) out.push(`${at}: 편 docs/마케팅/${it.편}/게시/준비.json에서 「슬롯」(영상 공개일)을 읽지 못했다`);
      const title = it.영상제목 || ep.제목;
      if (!title) out.push(`${at}: 영상 제목이 없다(편 준비.json 「제목」 또는 항목 「영상제목」)`);
      else out.push(...textProblems(title, `${at} 영상 제목`));
    }
    for (const key of ['제목', '설명']) {
      if (!String(it[key] || '').trim()) out.push(`${at}: 「${key}」가 없다`);
      else out.push(...textProblems(it[key], `${at} ${key}`));
    }
    if (it.왜) out.push(...textProblems(it.왜, `${at} 왜`));
    // 도구(선택): 같은 문제를 코딩 없이 푸는 synk.im 맞춤 프로그램 — {주소: '/builds/…/', 글: '한 줄'}
    if (it.도구 !== undefined) {
      const t = it.도구 || {};
      for (const key of Object.keys(t)) if (!['주소', '글'].includes(key)) out.push(`${at} 도구: 모르는 칸 「${key}」`);
      if (!/^\/builds\/[a-z0-9-]+\/$/.test(t.주소 || '')) out.push(`${at} 도구: 주소는 /builds/<이름>/ 꼴`);
      if (!String(t.글 || '').trim()) out.push(`${at} 도구: 「글」이 없다`);
      else out.push(...textProblems(t.글, `${at} 도구`));
    }
    if (!String(it.확인 || '').trim()) out.push(`${at}: 「확인」(직접 붙여 넣어 돌려 본 결과)이 없다 — 돌려 본 것만 올린다`);
    else out.push(...textProblems(it.확인, `${at} 확인`));
    const blocks = Array.isArray(it.블록) ? it.블록 : [];
    if (!blocks.length) out.push(`${at}: 「블록」이 없다`);
    const used = new Map();
    blocks.forEach((b, j) => {
      const where = `${at} 블록 ${j + 1}`;
      for (const key of Object.keys(b)) if (!BLOCK_KEYS.includes(key)) out.push(`${where}: 모르는 칸 「${key}」`);
      if (!KINDS.includes(b.종류)) out.push(`${where}: 종류는 ${KINDS.join('·')} 가운데 하나`);
      if (!String(b['넣는 곳'] || '').trim()) out.push(`${where}: 「넣는 곳」이 없다`);
      else out.push(...textProblems(b['넣는 곳'], `${where} 넣는 곳`));
      if (!String(b.본문 || '').trim()) out.push(`${where}: 「본문」이 없다`);
      else out.push(...textProblems(b.본문, `${where} 본문`, { body: true }));
      if (b.메모) out.push(...textProblems(b.메모, `${where} 메모`));
      for (const { name, value } of blanksOf(b.본문)) {
        if (used.has(name) && used.get(name) !== value) out.push(`${where}: 빈칸 【${name}】의 기본값이 블록마다 다르다`);
        used.set(name, value);
        if (!it.빈칸 || !String(it.빈칸[name] || '').trim()) out.push(`${where}: 빈칸 【${name}】의 설명이 「빈칸」에 없다`);
      }
    });
    for (const [name, note] of Object.entries(it.빈칸 || {})) {
      if (!used.has(name)) out.push(`${at}: 「빈칸」의 【${name}】을 쓰는 본문이 없다`);
      out.push(...textProblems(note, `${at} 빈칸 【${name}】`));
    }
  });
  return out;
}

// 편 폴더 게시/게시결과.json의 영상·글 주소. 「게시됨」은 그대로 쓰고, 「예약됨」이면서 시각이 지난 것은 열어 봐야 하는
// 후보(check: true)로 돌려준다 — 예약이 풀리거나 놓칠 수 있다(트렌디 편 블로그 글처럼). 인스타는 열어 봐도 모르니 「게시됨」만.
function linksOf(repo, episode, now = Date.now()) {
  let rows = [];
  try { rows = JSON.parse(fs.readFileSync(path.join(repo, 'docs', '마케팅', episode, '게시', '게시결과.json'), 'utf8')).판 || []; } catch { return []; }
  const out = [];
  for (const [account, label] of SOURCES) {
    // 같은 계정 줄이 여럿이면(다시 건 예약 등) 「게시됨」 줄, 없으면 마지막 줄.
    const mine = rows.filter((r) => r.계정 === account && /^https:\/\//.test(r.주소 || ''));
    const row = mine.find((r) => r.상태 === '게시됨') || mine[mine.length - 1];
    if (!row) continue;
    const at = Date.parse(row.시각 || '');
    if (row.상태 === '게시됨') out.push({ href: row.주소, label });
    else if (row.상태 === '예약됨' && Number.isFinite(at) && at <= now && account !== 'yuhobuilds-instagram') out.push({ href: row.주소, label, check: true });
  }
  return out;
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const dotDate = (d) => d.replace(/-/g, '.');
const koDate = (d) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일`;
const kstDay = (ms) => new Date(ms + 9 * 3600 * 1000).toISOString().slice(0, 10);
// 본문 안 빈칸을 표시로: 기본값이 있으면 기본값을, 없으면 【이름】을 보인다.
const withBlanks = (text) => esc(text).replace(BLANK, (m, name, value) => {
  const v = value ? value.trim() : '';
  return `<mark class="blank${v ? ' default' : ''}" data-blank="${name.trim()}" data-default="${v}">${v || `【${name.trim()}】`}</mark>`;
});
const kindLabel = (it) => [...new Set(it.블록.map((b) => b.종류))].join(' + ');
const whereShort = (it) => it.블록.find((b) => b.종류 !== '체크리스트')?.['넣는 곳'].split(' — ')[0] || '직접';

function renderBlock(it, b, j) {
  const id = `${it.id}-${j + 1}`;
  const head = `<div class="block-head"><div><h3 id="${id}-h">${esc(b.종류)}</h3><p class="where">넣는 곳 · ${esc(b['넣는 곳'])}</p></div>`;
  const memo = b.메모 ? `<p class="memo">${esc(b.메모)}</p>` : '';
  // 블록은 영역(landmark)이 아니다 — 이름 붙은 section으로 두면 「프롬프트」 영역이 여럿 겹친다(배포 점검 axe landmark-unique, 10-22).
  if (b.종류 === '체크리스트') {
    const steps = String(b.본문).split('\n').filter((l) => l.trim()).map((l) => `<li>${withBlanks(l.trim())}</li>`).join('');
    return `<div class="block list">${head}</div><ol class="steps">${steps}</ol>${memo}</div>`;
  }
  const copy = `<button class="copy" type="button" data-for="${id}" aria-label="${esc(it.제목)} — ${esc(b.종류)} 복사"><span>복사</span></button>`;
  return `<div class="block">${head}${copy}</div>`
    + `<pre class="text${b.종류 === '명령' ? ' cmd' : ''}" id="${id}" tabindex="0">${withBlanks(b.본문)}</pre>${memo}</div>`;
}

function renderItem(it, links, soon) {
  const defaults = new Map(it.블록.flatMap((b) => blanksOf(b.본문)).map((x) => [x.name, x.value]));
  const fields = Object.entries(it.빈칸 || {}).map(([name, note], k) => {
    const value = defaults.get(name) || '';
    return `<label class="field" for="${it.id}-f${k + 1}"><span class="name">${esc(name)}</span><span class="note">${esc(note)}${value ? ` 비워 두면 「${esc(value)}」` : ''}</span>`
      + `<input id="${it.id}-f${k + 1}" type="text" data-blank="${esc(name)}" placeholder="${esc(value || name)}" autocomplete="off" autocapitalize="off" spellcheck="false"></label>`;
  }).join('');
  const fill = fields ? `<div class="fill"><p class="fill-title">빈칸 채우기 <span>선택 · 채운 대로 복사돼요. 이 화면 밖으로 보내거나 저장하지 않아요</span></p>${fields}</div>` : '';
  // 영상 주소가 없으면(블로그 글만 먼저 공개된 때도) 공개일과 채널을 보이고, 블로그 글은 뒤에 따로 붙인다.
  const a = (l) => `<a href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.label)}</a>`;
  const videos = links.filter((l) => l.label !== '블로그 글');
  const blog = links.filter((l) => l.label === '블로그 글');
  const src = (videos.length
    ? `영상 · ${videos.map(a).join(' · ')}`
    : `영상 ${koDate(it.날짜)} 공개 · ${CHANNELS.map(([href, label]) => `<a href="${href}" target="_blank" rel="noopener">${label}</a>`).join(' · ')}`)
    + blog.map((l) => ` · ${a(l)}`).join('');
  return `<article class="item" id="${it.id}" data-date="${it.날짜}" aria-labelledby="${it.id}-t">`
    + `<header class="item-head"><p class="meta"><span>${dotDate(it.날짜)}</span><span class="tag">${esc(kindLabel(it))}</span><span class="tag soon"${soon ? '' : ' hidden'}>곧 나올 영상</span></p>`
    + `<h2 id="${it.id}-t"><a href="#${it.id}">${esc(it.제목)}</a></h2><p class="video">영상 「${esc(it.영상제목)}」</p>`
    + `<p class="desc">${esc(it.설명)}</p>${it.왜 ? `<p class="why"><b>왜 되나</b> ${esc(it.왜)}</p>` : ''}`
    + (it.도구 ? `<a class="tool" href="${esc(it.도구.주소)}"><b>코딩 없이 쓰려면</b><span>${esc(it.도구.글)}</span><i aria-hidden="true">→</i></a>` : '') + '</header>'
    + fill + it.블록.map((b, j) => renderBlock(it, b, j)).join('')
    + `<p class="tried"><b>직접 돌려 봤어요</b> ${esc(it.확인)}</p><p class="src">${src}</p></article>`;
}

function tocItem(it, soon) {
  return `<li data-date="${it.날짜}"><a href="#${it.id}"><span class="t">${esc(it.제목)}</span><span class="v">영상 「${esc(it.영상제목)}」</span>`
    + `<span class="d">${dotDate(it.날짜)} · ${esc(whereShort(it))}<span class="soon-d"${soon ? '' : ' hidden'}> · 곧 나올 영상</span></span></a></li>`;
}

const STYLE = `
@font-face{font-family:'SYNK Bracket';src:local('Malgun Gothic'),local('Apple SD Gothic Neo'),local('Noto Sans KR'),local('Noto Sans CJK KR');unicode-range:U+300C-300D}
@font-face{font-family:'SUIT Variable';font-weight:100 900;font-display:swap;src:url(/prompts/assets/SUIT-subset.woff2) format('woff2')}
@font-face{font-family:'SYNK Latin';font-weight:100 450;font-display:swap;src:url(/prompts/assets/InterTight-400.woff2) format('woff2');unicode-range:U+0021-007E,U+00A0-00B6,U+00B8-00FF,U+2013-2014,U+2018-201D,U+2026}
@font-face{font-family:'SYNK Latin';font-weight:451 620;font-display:swap;src:url(/prompts/assets/InterTight-500.woff2) format('woff2');unicode-range:U+0021-007E,U+00A0-00B6,U+00B8-00FF,U+2013-2014,U+2018-201D,U+2026}
@font-face{font-family:'SYNK Latin';font-weight:621 900;font-display:swap;src:url(/prompts/assets/InterTight-700.woff2) format('woff2');unicode-range:U+0021-007E,U+00A0-00B6,U+00B8-00FF,U+2013-2014,U+2018-201D,U+2026}
@font-face{font-family:'SYNK Arrow';font-weight:100 900;font-display:swap;src:url(/prompts/assets/InterTight-400.woff2) format('woff2');unicode-range:U+2190-2193;size-adjust:130%}
@font-face{font-family:'DM Mono';font-weight:400;font-display:swap;src:url(/prompts/assets/DMMono-400.woff2) format('woff2');unicode-range:U+0021-007E}
@font-face{font-family:'DM Mono';font-weight:500;font-display:swap;src:url(/prompts/assets/DMMono-500.woff2) format('woff2');unicode-range:U+0021-007E}
:root{--sans:'SYNK Bracket','SYNK Arrow','SYNK Latin','SUIT Variable',system-ui,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;--mono:'DM Mono','SUIT Variable',ui-monospace,monospace;
  --bg:#060709;--panel:#0C0D10;--surface-1:#121317;--surface-2:#191A1F;--line:rgba(255,255,255,.075);--line-2:rgba(255,255,255,.14);
  --ink:#FAFAF9;--ink-2:rgba(250,250,249,.76);--ink-3:rgba(250,250,249,.62);--ink-4:rgba(250,250,249,.22);--on-ink:#08090C;
  --blank-bg:rgba(255,224,138,.14);--blank-ink:#FFE08A;--ok:#3F7A22;--focus:#C5D6F5;
  --glass:rgba(26,27,32,.58);--glass-edge:inset 0 1px 0 rgba(255,255,255,.13),inset 0 0 0 1px rgba(255,255,255,.075),0 12px 32px rgba(0,0,0,.36);
  --studio:radial-gradient(120% 85% at 28% -10%,rgba(255,255,255,.16),transparent 58%),linear-gradient(180deg,transparent 55%,rgba(0,0,0,.1));color-scheme:dark}
:root[data-theme=day]{--bg:#ECECEA;--panel:#FFFFFF;--surface-1:#F5F5F4;--surface-2:#EDEDEB;--line:rgba(8,9,12,.08);--line-2:rgba(8,9,12,.15);--ink:#08090C;--ink-2:rgba(8,9,12,.72);--ink-3:rgba(8,9,12,.6);--ink-4:rgba(8,9,12,.2);--on-ink:#FFFFFF;--blank-bg:rgba(61,107,201,.12);--blank-ink:#24448C;--ok:#3F7A22;--focus:#24448C;--glass:rgba(255,255,255,.74);--glass-edge:inset 0 1px 0 #FFFFFF,inset 0 0 0 1px rgba(8,9,12,.1),0 12px 30px rgba(8,9,12,.12);color-scheme:light}
@media (prefers-color-scheme:light){:root[data-theme=system]{--bg:#ECECEA;--panel:#FFFFFF;--surface-1:#F5F5F4;--surface-2:#EDEDEB;--line:rgba(8,9,12,.08);--line-2:rgba(8,9,12,.15);--ink:#08090C;--ink-2:rgba(8,9,12,.72);--ink-3:rgba(8,9,12,.6);--ink-4:rgba(8,9,12,.2);--on-ink:#FFFFFF;--blank-bg:rgba(61,107,201,.12);--blank-ink:#24448C;--ok:#3F7A22;--focus:#24448C;--glass:rgba(255,255,255,.74);--glass-edge:inset 0 1px 0 #FFFFFF,inset 0 0 0 1px rgba(8,9,12,.1),0 12px 30px rgba(8,9,12,.12);color-scheme:light}}
*,*::before,*::after{box-sizing:border-box}
[hidden]{display:none!important}
html{background:var(--bg);scroll-padding-top:84px}
body{margin:0;min-height:100vh;background:var(--bg);color:var(--ink);font:450 16px/1.62 var(--sans);word-break:keep-all;overflow-wrap:anywhere;-webkit-font-smoothing:antialiased}
a{color:var(--ink)}
:focus-visible{outline:2px solid var(--focus);outline-offset:3px}
.sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.wrap{max-width:1180px;margin:0 auto;padding:0 16px 40px}
.bar{position:sticky;top:12px;z-index:5;display:flex;align-items:center;gap:14px;height:58px;margin:12px 0 14px;padding:0 9px;border-radius:999px;background:var(--glass);box-shadow:var(--glass-edge);-webkit-backdrop-filter:blur(22px) saturate(1.7);backdrop-filter:blur(22px) saturate(1.7)}
.bead{display:grid;place-items:center;height:40px;padding:0 16px;border-radius:999px;background:#FAFAF9}
.bead img{display:block;height:24px;width:auto}
.crumb{font:500 11.5px/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3)}
.bar .to{display:inline-flex;align-items:center;min-height:40px;margin-left:auto;padding:0 16px;border-radius:999px;color:var(--ink);font-size:14.5px;font-weight:600;text-decoration:none;box-shadow:inset 0 0 0 1px var(--line-2)}
main{padding:clamp(22px,4.2vw,52px);border-radius:28px;background:var(--panel);box-shadow:inset 0 0 0 1px var(--line)}
.eyebrow{display:inline-flex;align-items:center;gap:9px;margin:0;font:500 11.5px/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3)}
.eyebrow::after{content:"";width:28px;height:1px;background:currentColor;opacity:.6}
.top{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,.7fr);gap:28px;align-items:stretch}
h1{margin:16px 0 14px;font-size:clamp(32px,4.4vw,60px);font-weight:680;line-height:1.1;letter-spacing:-.035em;text-wrap:balance}
h1 span{color:var(--ink-3)}
.lead{margin:0;max-width:38em;font-size:17px;line-height:1.65;color:var(--ink-2)}
.poster{position:relative;isolation:isolate;overflow:hidden;min-height:240px;border-radius:22px;background:var(--studio),#3D6BC9;color:#fff;container-type:inline-size}
.poster .label{position:absolute;left:20px;top:18px;font:500 11.5px/1 var(--mono);letter-spacing:.08em;opacity:.85}
.poster .card{position:absolute;z-index:2;left:20px;right:20px;top:46px;padding:14px 16px 18px;border-radius:16px;background:rgba(8,9,12,.62);font-size:14px;line-height:1.55;transform:rotate(-1.5deg)}
.poster .card b{color:#FFE08A;font-weight:600}
.poster .card i{position:absolute;right:12px;bottom:-14px;padding:6px 14px;border-radius:999px;background:#FAFAF9;color:#08090C;font-style:normal;font-size:13px;font-weight:650}
.poster .word{position:absolute;z-index:1;left:16px;bottom:10px;font-size:min(7rem,22cqw);font-weight:900;line-height:.84;letter-spacing:-.06em}
.toc{margin:30px 0 0}
.toc ol{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:12px 0 0;padding:0;list-style:none}
.toc a{display:flex;flex-direction:column;gap:3px;height:100%;padding:14px 16px;border-radius:16px;background:var(--surface-1);box-shadow:inset 0 0 0 1px var(--line);text-decoration:none}
.toc .t{font-size:16px;font-weight:620;line-height:1.4}
.toc .v{font-size:13.5px;line-height:1.45;color:var(--ink-2)}
.toc .d{font-size:13px;color:var(--ink-3)}
.how{display:flex;flex-wrap:wrap;gap:6px 18px;margin:22px 0 4px;padding:0;list-style:none;font-size:15px;line-height:1.5;color:var(--ink-2);counter-reset:how}
.how li::before{counter-increment:how;content:"0" counter(how) " ";font:500 12px/1 var(--mono);letter-spacing:.06em;color:var(--ink-3)}
.how b{color:var(--ink);font-weight:650}
.terms{margin:0 0 30px;font-size:14px;line-height:1.6;color:var(--ink-3)}
.terms b{color:var(--ink-2);font-weight:600}
.items,.later{display:grid;gap:16px}
.later{margin-top:34px}
.sec{margin:0 0 2px;font-size:22px;font-weight:650;letter-spacing:-.02em}
.item{padding:clamp(18px,3vw,30px);border-radius:24px;background:var(--surface-1);box-shadow:inset 0 0 0 1px var(--line)}
.item:target{box-shadow:inset 0 0 0 2px var(--focus)}
.meta{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0;font:500 12px/1 var(--mono);letter-spacing:.06em;color:var(--ink-3)}
.tag{display:inline-flex;align-items:center;height:24px;padding:0 10px;border-radius:999px;box-shadow:inset 0 0 0 1px var(--line-2);font:600 12.5px/1 var(--sans);letter-spacing:0;color:var(--ink-2)}
.tag.soon{background:var(--blank-bg);box-shadow:none;color:var(--blank-ink)}
.item h2{margin:12px 0 4px;font-size:clamp(22px,2.6vw,30px);font-weight:670;line-height:1.28;letter-spacing:-.025em;text-wrap:balance}
.item h2 a{text-decoration:none}
.video{margin:0 0 10px;font-size:14px;line-height:1.5;color:var(--ink-3)}
.desc{margin:0;max-width:46em;font-size:16px;line-height:1.65;color:var(--ink-2)}
.why{margin:10px 0 0;max-width:46em;font-size:15px;line-height:1.6;color:var(--ink-2)}
.why b,.tried b{margin-right:6px;font-weight:650;color:var(--ink)}
.tool{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 10px;max-width:46em;margin:14px 0 0;padding:13px 16px;border-radius:16px;background:var(--surface-2);box-shadow:inset 0 0 0 1px var(--line-2);text-decoration:none;color:var(--ink)}
.tool b{font-size:15px;font-weight:650}
.tool span{flex:1 1 16em;font-size:15px;line-height:1.55;color:var(--ink-2)}
.tool i{font-style:normal;font-weight:600}
.fill{display:grid;gap:10px;margin:20px 0 0;padding:16px;border-radius:18px;background:var(--surface-2)}
.fill-title{margin:0;font-size:15px;font-weight:650}
.fill-title span{display:block;margin-top:2px;font-size:13px;font-weight:450;color:var(--ink-3)}
.field{display:grid;gap:4px}
.field .name{font-size:14px;font-weight:650;color:var(--blank-ink)}
.field .note{font-size:13.5px;line-height:1.5;color:var(--ink-3)}
.field input{width:100%;min-height:46px;padding:0 14px;border:0;border-radius:12px;background:var(--panel);box-shadow:inset 0 0 0 1px var(--line-2);color:var(--ink);font:500 16px/1.4 var(--sans)}
.field input::placeholder{color:var(--ink-4)}
.block{margin:16px 0 0;padding:16px;border-radius:18px;background:var(--panel);box-shadow:inset 0 0 0 1px var(--line)}
.block-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.block h3{margin:0;font:500 12px/1.3 var(--mono);letter-spacing:.08em;color:var(--ink-3)}
.where{margin:4px 0 0;font-size:14.5px;font-weight:550;line-height:1.5;color:var(--ink)}
.copy{flex:none;display:inline-flex;align-items:center;justify-content:center;min-width:88px;min-height:44px;padding:0 18px;border:0;border-radius:999px;background:var(--ink);color:var(--on-ink);font:650 15px/1 var(--sans);cursor:pointer}
.copy.done{background:var(--ok);color:#fff}
.text{margin:12px 0 0;padding:14px 16px;border-radius:14px;background:var(--surface-2);font:450 15px/1.75 var(--sans);white-space:pre-wrap;overflow-wrap:anywhere;word-break:keep-all;color:var(--ink)}
.text.cmd{font:400 13.5px/1.7 var(--mono);word-break:break-all}
.blank{padding:1px 3px;border-radius:5px;background:var(--blank-bg);color:var(--blank-ink);font-weight:600}
.blank.filled{background:transparent;color:inherit;text-decoration:underline 2px var(--blank-ink);text-underline-offset:3px}
.steps{margin:12px 0 0;padding-left:1.4em;font-size:15.5px;line-height:1.65;color:var(--ink)}
.steps li+li{margin-top:6px}
.memo{margin:10px 2px 0;font-size:14px;line-height:1.6;color:var(--ink-3)}
.copy-note{margin:8px 2px 0;font-size:14px;line-height:1.5;color:var(--blank-ink)}
.tried{margin:18px 0 0;max-width:46em;font-size:15px;line-height:1.6;color:var(--ink-2)}
.src{margin:10px 0 0;font-size:14px;line-height:1.7;color:var(--ink-3)}
.src a{color:var(--ink-2)}
.next{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:34px}
.next a{display:flex;flex-direction:column;gap:6px;padding:20px 22px;border-radius:22px;background:var(--surface-1);box-shadow:inset 0 0 0 1px var(--line);text-decoration:none}
.next .k{font:500 11.5px/1 var(--mono);letter-spacing:.08em;color:var(--ink-3)}
.next .h{font-size:20px;font-weight:650;line-height:1.35;letter-spacing:-.015em}
.next .p{font-size:15px;line-height:1.55;color:var(--ink-2)}
.foot{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px 22px;margin:18px 6px 0;font-size:13px;color:var(--ink-3)}
.foot a{color:var(--ink-2)}
@media(hover:hover){.toc a:hover,.next a:hover,.tool:hover{box-shadow:inset 0 0 0 1px var(--ink-4)}.copy:hover{opacity:.9}}
@media(max-width:860px){.top{grid-template-columns:minmax(0,1fr)}.poster{display:none}}
@media(max-width:700px){.toc ol,.next{grid-template-columns:minmax(0,1fr)}.how{flex-direction:column}}
@media(max-width:560px){.wrap{padding:0 8px 28px}main{padding:22px 16px 26px;border-radius:22px}.bar{height:52px;top:8px;margin:8px 0 10px}.bar .to{padding:0 14px;font-size:14px}.crumb{display:none}h1{margin-top:12px}.lead{font-size:16px}.item{padding:18px 14px;border-radius:20px}.block{padding:14px 12px}.text{padding:12px}.fill{padding:14px 12px}}
@media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
`;

// 복사·빈칸 채우기, 빌드 뒤 날짜가 지난 「곧 나올 영상」 항목 올리기. 보내는 곳도 저장도 없다.
const SCRIPT = `
(function(){
  var live=document.getElementById('live');
  function say(t){live.textContent='';setTimeout(function(){live.textContent=t},30)}
  var d=new Date(Date.now()+9*36e5).toISOString().slice(0,10),moved=false;
  var items=document.querySelector('.items'),later=document.querySelector('.later'),toc=document.querySelector('.toc ol');
  later.querySelectorAll('.item').forEach(function(a){
    if(a.getAttribute('data-date')<=d){
      var before=null;items.querySelectorAll('.item').forEach(function(x){if(!before&&x.getAttribute('data-date')<=a.getAttribute('data-date'))before=x});
      items.insertBefore(a,before);a.querySelector('.tag.soon').hidden=true;moved=true;
      /* 목차도 같은 자리로: 날짜가 이 항목 이하인 첫 줄 앞 */
      var link=toc.querySelector('a[href="#'+a.id+'"]');if(link){var li=link.parentNode,at=null;link.querySelector('.soon-d').hidden=true;
        toc.querySelectorAll('li').forEach(function(x){if(!at&&x!==li&&x.getAttribute('data-date')<=a.getAttribute('data-date'))at=x});toc.insertBefore(li,at)}
    }
  });
  if(!later.querySelector('.item'))later.hidden=true;
  if(moved&&location.hash){var t=document.getElementById(location.hash.slice(1));if(t)t.scrollIntoView()}
  document.querySelectorAll('.item').forEach(function(item){
    var marks=item.querySelectorAll('mark.blank');
    item.querySelectorAll('input[data-blank]').forEach(function(input){
      input.addEventListener('input',function(){
        var name=input.getAttribute('data-blank'),v=input.value.trim();
        marks.forEach(function(m){if(m.getAttribute('data-blank')===name){
          var def=m.getAttribute('data-default'),cmd=m.closest('.cmd'),w=v;
          if(w&&cmd&&/\\s/.test(w)&&!/^".*"$/.test(w))w='"'+w+'"';/* 명령 칸: 띄어쓰기 있는 값은 따옴표로 */
          m.textContent=w||def||'【'+name+'】';m.classList.toggle('filled',!!v)}});
      });
    });
  });
  function selectText(el){var r=document.createRange();r.selectNodeContents(el);var s=getSelection();s.removeAllRanges();s.addRange(r)}
  function note(btn,text){var box=btn.closest('.block'),n=box.querySelector('.copy-note');if(!n){n=document.createElement('p');n.className='copy-note';box.appendChild(n)}n.textContent=text;n.hidden=!text}
  document.querySelectorAll('.copy').forEach(function(btn){
    btn.addEventListener('click',function(){
      var pre=document.getElementById(btn.getAttribute('data-for')),text=pre.textContent,left=[];
      pre.querySelectorAll('mark.blank:not(.filled)').forEach(function(m){if(!m.getAttribute('data-default')&&left.indexOf(m.textContent)<0)left.push(m.textContent)});
      var rest=left.length?left.join(' ')+' 칸은 붙여 넣은 뒤 바꿔 주세요.':'';
      function ok(){var s=btn.querySelector('span');btn.classList.add('done');s.textContent='복사했어요';note(btn,rest);say('복사했어요. '+rest);clearTimeout(btn._t);btn._t=setTimeout(function(){btn.classList.remove('done');s.textContent='복사'},2200)}
      /* 클립보드가 막힌 곳(앱 안 브라우저 등)은 글을 골라 옛 복사 명령을 한 번 더 쓰고, 그것도 안 되면 골라 둔 채로 안내한다. */
      function fail(){selectText(pre);var done=false;try{done=document.execCommand('copy')}catch(e){}if(done){ok();return}note(btn,'복사가 막혔어요. 글을 골라 두었으니 길게 눌러(또는 Ctrl+C로) 복사해 주세요.');say('복사가 막혀 글을 골라 두었어요. 길게 눌러 복사해 주세요.')}
      try{if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(text).then(ok,fail)}else{fail()}}catch(e){fail()}
    });
  });
})();
`;

// data.항목에는 날짜·영상제목이 붙어 있어야 한다(빌드는 withEpisodes로 붙인다). now = 빌드 시각 — 그날(KST)보다 뒤인 항목은 「곧 나올 영상」.
function renderPage(data, { links = {}, now = Date.now() } = {}) {
  const today = kstDay(now);
  const byDate = (a, b) => (a.날짜 < b.날짜 ? 1 : a.날짜 > b.날짜 ? -1 : 0);
  const current = data.항목.filter((it) => it.날짜 <= today).sort(byDate);
  const upcoming = data.항목.filter((it) => it.날짜 > today).sort((a, b) => -byDate(a, b));
  const all = [...current, ...upcoming];
  const description = 'yuhobuilds 쇼츠에서 실제로 막혔다가 푼 문제를 프롬프트로 모았어요. 빈칸만 바꿔 적힌 AI에 붙여 넣으면 돼요. 모두 직접 돌려 본 것이고, 가입 없이 바로 복사해요.';
  const lead = all[0];
  const sample = lead.블록.find((b) => b.종류 === '프롬프트') || lead.블록[0];
  const sampleLine = withBlanks(String(sample.본문).split('\n')[0]).replace(/<mark class="blank[^"]*"[^>]*>([^<]*)<\/mark>/g, '<b>$1</b>');
  return `<!doctype html>
<html lang="ko" data-theme="night">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<!-- synk.im/prompts = yuhobuilds 쇼츠에서 푼 문제의 프롬프트 모음. 원고: SYNK-appsscript docs/마케팅/맞춤도구/prompts(프롬프트.json · page.js) → build.mjs prompts. -->
<title>프롬프트 모음 · 영상에서 푼 문제를 그대로 | SYNK</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#060709">
<script>
/* 화면 테마: SYNK 플랫폼(웹)에서 고른 밤·낮·기기 설정을 따른다(기본 밤). */
(function(){var v='night';try{v=localStorage.getItem('synk.platform.theme')||'night'}catch(e){}if(['night','day','system'].indexOf(v)<0)v='night';document.documentElement.setAttribute('data-theme',v);var day=v==='day'||(v==='system'&&window.matchMedia&&matchMedia('(prefers-color-scheme: light)').matches);document.querySelector('meta[name="theme-color"]').setAttribute('content',day?'#ECECEA':'#060709')})();
</script>
<link rel="canonical" href="${SITE}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="SYNK">
<meta property="og:title" content="프롬프트 모음 · 영상에서 푼 문제를 그대로">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${SITE}">
<meta property="og:image" content="${SITE}og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" href="/prompts/assets/favicon-32.png">
<link rel="preload" href="/prompts/assets/SUIT-subset.woff2" as="font" type="font/woff2" crossorigin>
<style>${STYLE}</style>
</head>
<body>
<div class="wrap">
  <header class="bar"><a class="bead" href="https://synk.im/" aria-label="SYNK 홈"><img src="/prompts/assets/logo-synk.webp" alt="synk" width="50" height="24"></a><span class="crumb">synk / prompts</span><a class="to" href="/builds/">맞춤 프로그램</a></header>
  <main>
    <div class="top">
      <div>
        <p class="eyebrow">SYNK · PROMPTS</p>
        <h1>영상에서 푼 문제,<br><span>그대로 가져가세요</span></h1>
        <p class="lead">yuhobuilds 쇼츠에서 실제로 막혔다가 풀어 낸 방법을 프롬프트로 모았어요. 모두 우리가 직접 붙여 넣어 같은 결과가 나오는지 돌려 본 것이에요. 가입 없이 바로 복사해요.</p>
      </div>
      <div class="poster" aria-hidden="true"><span class="label">PROMPTS / ${all.length}</span><div class="card">${sampleLine}<i>복사</i></div><span class="word">프롬프트</span></div>
    </div>
    <nav class="toc" aria-labelledby="toc-h"><h2 class="eyebrow" id="toc-h">프롬프트 ${all.length}개 · 본 영상 제목으로 찾기</h2><ol>${current.map((it) => tocItem(it, false)).join('')}${upcoming.map((it) => tocItem(it, true)).join('')}</ol></nav>
    <ol class="how">
      <li><b>복사</b>를 눌러요</li>
      <li><b>빈칸</b>을 내 것으로 — 위 칸에 적으면 바뀐 채로 복사돼요</li>
      <li><b>넣는 곳</b>에 적힌 AI에 붙여 넣어요</li>
    </ol>
    <p class="terms"><b>채팅 AI</b> 대화창에 글을 붙여 넣는 AI 서비스 어디든 · <b>코딩 AI</b> 내 컴퓨터의 파일을 열고 명령을 돌릴 수 있는 AI 도구</p>
    <div class="items">
${current.map((it) => renderItem(it, links[it.id] || [], false)).join('\n')}
    </div>
    <section class="later" aria-labelledby="later-h"${upcoming.length ? '' : ' hidden'}><h2 class="sec" id="later-h">곧 나올 영상의 프롬프트</h2>
${upcoming.map((it) => renderItem(it, links[it.id] || [], true)).join('\n')}
    </section>
    <nav class="next" aria-label="더 보기">
      <a href="/builds/"><span class="k">BUILDS</span><span class="h">내 경우에 맞춘 결과가 필요하면 → 맞춤 프로그램</span><span class="p">질문 몇 개에 답하면 내 조건에 맞춘 결과가 나와요. 로그인 없음.</span></a>
      <a href="https://synk.im/"><span class="k">SYNK</span><span class="h">이 프롬프트를 만든 회사 → synk.im</span><span class="p">한 사람에게 맞춘 배움과 일을 만드는 SYNK가 하는 일.</span></a>
    </nav>
  </main>
  <footer class="foot"><span>yuhobuilds · 유호 · AI와 회사 만들기</span><span><a href="https://www.instagram.com/yuhobuilds/" target="_blank" rel="noopener">Instagram</a> · <a href="https://www.youtube.com/@yuhobuilds" target="_blank" rel="noopener">YouTube</a> · <a href="https://yuhobuilds.tistory.com/" target="_blank" rel="noopener">블로그</a></span></footer>
</div>
<p class="sr" id="live" role="status" aria-live="polite"></p>
<script>${SCRIPT}</script>
</body>
</html>
`;
}

module.exports = { checkPrompts, linksOf, episodeOf, withEpisodes, renderPage, blanksOf, SITE };
