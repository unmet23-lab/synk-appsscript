// 시안 HTML 한 장의 틀 — 화면 전환(#화면이름), 화면 목록(검토용, ?cap이면 숨김), 공통 바탕
import { SCREENS } from './copy.mjs';

export const ICON = {
  arrow: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  back: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
  close: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  set: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
  check: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg>',
  cloud: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 18h9.2a4 4 0 0 0 .6-7.96A5.5 5.5 0 0 0 6.6 9.4 4.3 4.3 0 0 0 7.5 18Z"/></svg>',
  print: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2"/><path d="M7 14h10v6H7z"/></svg>',
  usb: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6v6H9zM7 9h10v7a5 5 0 0 1-10 0V9Z"/><path d="M12 13v3"/></svg>',
  search: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg>',
  copy: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="1.5"/><path d="M5 15V6a1 1 0 0 1 1-1h9"/></svg>',
  ext: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5M19 5l-8 8M17 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h4"/></svg>',
  pause: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6v12M15 6v12"/></svg>',
  // 긴 화살표(위 막대의 뒤로 · 건반 · 글 링크) — 둥근 단추 속 짧은 화살표 대신
  larr: '<svg class="la" viewBox="0 0 44 16" aria-hidden="true"><path d="M43 8H2M9 1 2 8l7 7"/></svg>',
  rarr: '<svg class="la" viewBox="0 0 44 16" aria-hidden="true"><path d="M1 8h41M35 1l7 7-7 7"/></svg>',
  laptop: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="10" rx="1"/><path d="M3 18h18"/></svg>',
  google: '<svg class="g" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5Z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7Z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A11.9 11.9 0 0 1 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44Z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5Z"/></svg>',
};

// 싱ㅋ 글자표(플랫폼 3차와 같은 모양)
export const MARK = '<svg class="mark" viewBox="0 0 560 328" role="img" aria-label="싱ㅋ"><path d="M87 8h58v30c0 46 23 76 61 103l-34 43c-29-19-52-45-66-70-15 30-36 54-64 72L8 143c49-32 79-64 79-112Z"/><path d="M222 8h58v172h-58Z"/><path fill-rule="evenodd" d="M157 192c-76 0-124 24-124 65s48 65 124 65 124-24 124-65-48-65-124-65Zm0 45c42 0 67 8 67 20s-25 20-67 20-67-8-67-20 25-20 67-20Z"/><path d="M326 8h226L464 312h-61l40-138H322v-54h137l16-55H326Z"/></svg>';

const BASE = `
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;font-family:var(--sans);font-size:15px;line-height:1.6;word-break:keep-all;overflow-wrap:break-word;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
h1,h2,h3,p,ul,ol,dl,dd,dt,figure{margin:0;padding:0}
ul,ol{list-style:none}
button{font:inherit;color:inherit;cursor:pointer;background:none;border:0;padding:0;text-align:inherit}
a{color:inherit;text-decoration:none}
input{font:inherit;color:inherit}
.num{font-family:var(--num);font-variant-numeric:tabular-nums;letter-spacing:0}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.ic{width:20px;height:20px;flex:none;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.g{width:20px;height:20px;flex:none}
.la{width:30px;height:12px;flex:none;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
.mark{display:block;height:18px;width:auto;fill:currentColor}
.scr{display:none}
.scr.on{display:block}
[hidden]{display:none!important}
.keep{white-space:nowrap}
/* 검토용 화면 목록 — 앱의 일부가 아니다 */
.idx-btn{position:fixed;right:16px;bottom:16px;z-index:90;height:36px;padding:0 14px;border-radius:999px;background:#1d1d1f;color:#fff;font-size:13px;font-weight:600;box-shadow:0 6px 20px rgba(0,0,0,.25)}
.idx{position:fixed;right:16px;bottom:60px;z-index:90;width:280px;max-height:70vh;overflow:auto;background:#1d1d1f;color:#e9e9ec;border-radius:14px;padding:8px;font-size:13px;box-shadow:0 12px 40px rgba(0,0,0,.35)}
.idx a{display:flex;gap:10px;padding:7px 10px;border-radius:8px;line-height:1.35}
.idx a:hover,.idx a.on{background:#333338}
.idx a b{font-family:var(--num);font-weight:500;color:#9a9aa1;min-width:20px}
body.is-cap .idx-btn,body.is-cap .idx{display:none!important}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}
`;

const SCRIPT = `
(function(){
  var cap=/[?&]cap\\b/.test(location.search);
  if(cap)document.body.classList.add('is-cap');
  var scr=[].slice.call(document.querySelectorAll('.scr'));
  var idx=document.querySelector('.idx'),btn=document.querySelector('.idx-btn');
  function show(){
    var id=(location.hash||'#home').slice(1);
    if(!document.getElementById('s-'+id))id='home';
    scr.forEach(function(s){s.classList.toggle('on',s.id==='s-'+id)});
    [].forEach.call(document.querySelectorAll('.idx a'),function(a){a.classList.toggle('on',a.getAttribute('href')==='#'+id)});
    document.title=document.body.dataset.name+' — '+(document.getElementById('s-'+id).dataset.title||'');
    window.scrollTo(0,0);
  }
  window.addEventListener('hashchange',show);
  if(btn)btn.addEventListener('click',function(){idx.hidden=!idx.hidden});
  show();
})();
`;

export function page({ name, lang = 'ko', css, screens, bodyClass = '' }) {
  // 목록은 그 시안이 실제로 가진 화면만(시안마다 화면 수가 다를 수 있다)
  const list = screens.map((s, i) => {
    const meta = SCREENS.find(([id]) => id === s.id);
    return `<a href="#${s.id}"><b>${String(i + 1).padStart(2, '0')}</b>${meta ? meta[1] : s.id}</a>`;
  }).join('');
  const body = screens.map((s) => {
    const meta = SCREENS.find(([id]) => id === s.id);
    return `<section class="scr ${s.cls || ''}" id="s-${s.id}" data-title="${meta ? meta[1] : s.id}">${s.html}</section>`;
  }).join('\n');
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name}</title>
<style>/*FONTS*/</style>
<style>${BASE}${css}</style>
</head>
<body class="${bodyClass}" data-name="${name}">
${body}
<button class="idx-btn" type="button">화면 ${screens.length}</button>
<nav class="idx" hidden aria-label="시안 화면 목록">${list}</nav>
<script>${SCRIPT}</script>
</body>
</html>
`;
}
