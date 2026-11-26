// 워크스페이스 바탕 색 고르기(2026-11-27 유호님 「색깔 변경기능도 넣어줄수있어? 계속 노란색을 보고있으면 눈이 아프니까」).
// 노랑(기본) · 종이 · 밤 셋. 고른 값은 이 기기의 브라우저에만 남는다(localStorage, 읽고 쓰기 실패는 조용히 기본으로).
// <head>에서 먼저 읽혀 첫 화면이 그려지기 전에 <html data-lobby-theme>를 붙인다. 고르는 단추는 workspace.js가 SynkLobbyTheme.html()로 그린다.
(function(){
  'use strict';
  var KEY='synk.workspace.lobby-theme';
  var THEMES=[['yellow','노랑'],['paper','종이'],['night','밤']];
  var known=function(v){for(var i=0;i<THEMES.length;i++)if(THEMES[i][0]===v)return true;return false;};
  function read(){try{var v=window.localStorage.getItem(KEY);return known(v)?v:'yellow';}catch(e){return 'yellow';}}
  function apply(v){var root=document.documentElement;if(root.getAttribute('data-lobby-theme')!==v)root.setAttribute('data-lobby-theme',v);}
  var current=read();apply(current);
  function sync(){
    var picks=document.querySelectorAll('[data-lobby-theme-pick]');
    for(var i=0;i<picks.length;i++){var on=picks[i].getAttribute('data-lobby-theme-pick')===current;picks[i].setAttribute('aria-checked',on?'true':'false');picks[i].tabIndex=on?0:-1;}
  }
  function set(v,focus){
    if(!known(v))return;current=v;apply(v);
    try{window.localStorage.setItem(KEY,v);}catch(e){}
    sync();
    if(focus){var el=focus.closest&&focus.closest('[role="radiogroup"]');var next=el&&el.querySelector('[data-lobby-theme-pick="'+v+'"]');if(next)next.focus();}
  }
  // 고르는 자리 하나: 라디오 단추 셋(동그란 색 견본). 이름은 낭독기와 툴팁으로 읽힌다
  function html(where){
    var items='';
    for(var i=0;i<THEMES.length;i++){var id=THEMES[i][0],label=THEMES[i][1],on=id===current;
      items+='<button type="button" class="ws-theme-pick" role="radio" data-lobby-theme-pick="'+id+'" aria-checked="'+(on?'true':'false')+'" tabindex="'+(on?'0':'-1')+'" aria-label="'+label+'" title="'+label+'"><i aria-hidden="true"></i></button>';}
    var at=where==='drawer'?'drawer':'side';
    return '<div class="ws-theme" data-theme-where="'+at+'"><span class="ws-theme-k" id="ws-theme-k-'+at+'">'+(at==='drawer'?'바탕 색':'바탕')+'</span><div class="ws-theme-picks" role="radiogroup" aria-labelledby="ws-theme-k-'+at+'">'+items+'</div></div>';
  }
  document.addEventListener('click',function(event){var b=event.target&&event.target.closest?event.target.closest('[data-lobby-theme-pick]'):null;if(b)set(b.getAttribute('data-lobby-theme-pick'));});
  // 라디오 묶음 안에서는 화살표로 옮기며 바로 고른다
  document.addEventListener('keydown',function(event){
    if(event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return; // 뒤로 · 앞으로 가기 같은 브라우저 단축키는 그대로 둔다(카본 A3)
    var b=event.target&&event.target.closest?event.target.closest('[data-lobby-theme-pick]'):null;if(!b)return;
    var dir=event.key==='ArrowRight'||event.key==='ArrowDown'?1:event.key==='ArrowLeft'||event.key==='ArrowUp'?-1:0;if(!dir)return;
    event.preventDefault();
    var at=0;for(var i=0;i<THEMES.length;i++)if(THEMES[i][0]===b.getAttribute('data-lobby-theme-pick'))at=i;
    set(THEMES[(at+dir+THEMES.length)%THEMES.length][0],b);
  });
  // 다른 탭에서 바꾸면 이 탭도 따라간다
  window.addEventListener('storage',function(event){if(event.key===KEY){current=read();apply(current);sync();}});
  window.SynkLobbyTheme={get:function(){return current;},set:set,html:html,sync:sync,themes:THEMES.map(function(t){return t[0];})};
})();
