/* 시안 안의 「참고」 창: 무엇을 어느 제품에서 가져왔는지 보인다.
   남의 화면 그림은 공개 저장소에 넣지 않는다. 캡처와 잰 값은 보관함
   조사/디자인참고_20261106/출결TOPIK_20261127/ 에 있다. */
(function(){
  window.mountRefs=function(rows,{title='이 시안이 가져온 것',tone='light'}={}){
    const btn=document.createElement('button');
    btn.type='button';btn.className='refs-btn';btn.textContent='참고';btn.setAttribute('aria-expanded','false');
    const box=document.createElement('aside');
    box.className='refs '+tone;box.hidden=true;box.setAttribute('aria-label',title);
    box.innerHTML='<header><h2>'+title+'</h2><button type="button" class="refs-x" aria-label="닫기">닫기</button></header><ol>'
      +rows.map(([what,from,how])=>'<li><b>'+what+'</b><span class="from">'+from+'</span><p>'+how+'</p></li>').join('')+'</ol>'
      +'<p class="refs-foot">캡처와 잰 값: 보관함 조사/디자인참고_20261106/출결TOPIK_20261127/</p>';
    const set=open=>{box.hidden=!open;btn.setAttribute('aria-expanded',String(open));};
    btn.addEventListener('click',()=>set(box.hidden));
    box.querySelector('.refs-x').addEventListener('click',()=>set(false));
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!box.hidden){set(false);e.stopPropagation();}},true);
    document.body.append(btn,box);
    const st=document.createElement('style');
    st.textContent=`
.refs-btn{position:fixed;right:18px;bottom:18px;z-index:60;height:34px;padding:0 14px;border-radius:999px;font:600 13px/1 SUIT,sans-serif;letter-spacing:0;background:rgba(20,20,20,.86);color:#fff;box-shadow:0 6px 18px -8px rgba(0,0,0,.5)}
.refs{position:fixed;right:18px;bottom:62px;z-index:61;width:min(440px,calc(100vw - 36px));max-height:min(640px,calc(100vh - 90px));overflow:auto;border-radius:18px;padding:18px 20px 16px;font:400 13px/1.55 SUIT,sans-serif;box-shadow:0 0 0 .5px rgba(0,0,0,.08),0 24px 60px -24px rgba(0,0,0,.45)}
.refs.light{background:#fff;color:#141414}.refs.dark{background:#16171a;color:#ECECEC;box-shadow:0 0 0 .5px rgba(255,255,255,.1),0 24px 60px -24px rgba(0,0,0,.8)}
.refs header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.refs h2{margin:0;font:600 15px/1.3 SUIT,sans-serif}
.refs-x{font:500 12px/1 SUIT,sans-serif;opacity:.7}
.refs ol{list-style:none;margin:0;padding:0;display:grid;gap:12px}
.refs li{display:grid;gap:2px;padding-top:12px;border-top:.5px solid rgba(127,127,127,.25)}
.refs li b{font-weight:650}
.refs .from{font:500 12px/1.4 'Inter Tight',SUIT,sans-serif;opacity:.72}
.refs p{margin:0}
.refs .refs-foot{margin-top:14px;font-size:11.5px;opacity:.6}
@media (max-width:760px){.refs-btn{bottom:auto;top:12px;right:12px;height:30px;padding:0 12px;font-size:12px}.refs{bottom:auto;top:50px}}`;
    document.head.append(st);
  };
})();
