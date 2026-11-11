'use strict';
// 첫 기다림 글의 언어(PULSE 켜기 전 후속 · 판 6 E, 2026-11-11). index.html의 고정 글(확인 중 · 건너뛰기 · 끊김 알림 · 처음으로 · 창 제목)은
// 화면 모듈이 다 받아지기 전부터 보인다 — 느린 연결의 첫 방문에서는 수십 초다. 이 작은 스크립트가 그 글만 이 기기의 언어로 먼저 바꾼다.
// 회사 서버 CSP가 script-src 'self'라 인라인이 아니라 같은 곳의 파일 하나이고, 모듈이 아닌 고전 스크립트라 다른 파일을 기다리지 않는다.
// 고르는 차례는 app.mjs applyLocale과 같다: 고른 것(pulse-locale) → 마지막으로 정한 언어(pulse-locale-last, 그때의 허락 목록 안에서) → 링크 ?lang → 브라우저(한국어가 없으면 영어) → 한국어.
// 적어 둔 것이 없는 첫 방문은 허락 목록을 모르므로 사전이 있는 언어(ko · en)를 허락으로 본다. 서버 답을 받으면 app.mjs가 다시 고르고 글을 다시 쓴다(허락 밖이면 한국어로).
// 한국어면 아무것도 하지 않는다 — 한국어 화면은 index.html 글 그대로다. 아래 글은 i18n/en.mjs와 같은 문장이어야 한다(pulse-boot-locale 시험이 대조한다).
(function(){
  var TEXT={en:{loading:'Checking your project…',skip:'Skip to content',banner:'You’re offline. Anything you’ve written stays on this screen.',brand:'PULSE home',title:'SYNK PULSE — AI models can look real. We make them act.'}};
  var DICTIONARY=['ko','en'];
  function read(key){try{return window.localStorage.getItem(key)||'';}catch(error){return '';}}
  function allowedOf(list){var out=['ko'];for(var i=0;list&&i<list.length;i++)if(DICTIONARY.indexOf(list[i])!==-1&&out.indexOf(list[i])===-1)out.push(list[i]);return out;}
  function last(){try{var value=JSON.parse(read('pulse-locale-last')||'null'),allowed=allowedOf(value&&Array.isArray(value.allowed)?value.allowed:[]);return value&&allowed.indexOf(value.locale)!==-1?{locale:value.locale,allowed:allowed}:null;}catch(error){return null;}}
  function pick(){
    var before=last(),allowed=before?before.allowed:DICTIONARY.slice(),link='',tags=[],list,i,value;
    try{link=String(new URLSearchParams(location.search).get('lang')||'').toLowerCase().slice(0,8);}catch(error){}
    list=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language||''];
    for(i=0;i<list.length;i++){value=String(list[i]||'').toLowerCase().split('-')[0];if(value)tags.push(value);}
    var order=[read('pulse-locale'),before?before.locale:'',link].concat(tags);
    for(i=0;i<order.length;i++)if(order[i]&&allowed.indexOf(order[i])!==-1)return order[i];
    if(tags.length&&tags.indexOf('ko')===-1&&allowed.indexOf('en')!==-1)return 'en';
    return 'ko';
  }
  // 고객 화면만(직원 화면 ?mode=staff · 옛 체험 ?demo=gift · coffee는 한국어로만 돈다 — app.mjs와 같다).
  try{var query=new URLSearchParams(location.search);if(query.get('mode')==='staff'||['gift','coffee'].indexOf(query.get('demo'))!==-1)return;}catch(error){}
  var text=TEXT[pick()];if(!text)return;
  document.documentElement.lang='en';
  var loading=document.querySelector('#main .loading'),skip=document.querySelector('.skip-link'),banner=document.querySelector('#connection-banner'),brand=document.querySelector('.app-header .brand');
  if(loading){var node=loading.lastChild;if(node&&node.nodeType===3)node.nodeValue=text.loading;}
  if(skip)skip.textContent=text.skip;
  if(banner)banner.textContent=text.banner;
  if(brand)brand.setAttribute('aria-label',text.brand);
  document.title=text.title;
})();
