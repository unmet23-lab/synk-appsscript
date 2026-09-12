'use strict';
const data=JSON.parse(document.getElementById('viewer-data').textContent);
const tabs=[...document.querySelectorAll('[data-lang]')];
tabs.forEach(button=>button.addEventListener('click',()=>{
  tabs.forEach(t=>t.setAttribute('aria-pressed',String(t===button)));
  document.querySelectorAll('[data-abstract]').forEach(el=>el.hidden=el.dataset.abstract!==button.dataset.lang);
  document.getElementById('copy-status').textContent='';
}));
document.getElementById('copy-abstract').addEventListener('click',async()=>{
  const text=document.querySelector('[data-abstract]:not([hidden])').textContent;
  try{await navigator.clipboard.writeText(text);document.getElementById('copy-status').textContent='요약을 복사했습니다.';}
  catch{const selection=window.getSelection(),range=document.createRange();range.selectNodeContents(document.querySelector('[data-abstract]:not([hidden])'));selection.removeAllRanges();selection.addRange(range);document.getElementById('copy-status').textContent='요약을 선택했습니다. 복사 단축키를 눌러 주세요.';}
});
const gallery=document.getElementById('gallery');
document.querySelectorAll('[data-shift]').forEach(b=>b.addEventListener('click',()=>gallery.scrollBy({left:Number(b.dataset.shift)*242,behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'})));
const modal=document.getElementById('figure-dialog'),modalImage=document.getElementById('dialog-image'),modalTitle=document.getElementById('dialog-title'),modalCaption=document.getElementById('dialog-caption'),modalDownload=document.getElementById('diagram-download');
let activeFigure=0,opener=null;
function showFigure(index){
  activeFigure=(index+data.figures.length)%data.figures.length;
  const f=data.figures[activeFigure];
  modalImage.src=f.src;modalImage.alt=`도 ${f.number}. ${f.title}`;
  modalTitle.textContent=`도 ${f.number} · ${f.title}`;modalCaption.textContent=f.caption;
  modalDownload.href='figures/'+f.file;modalDownload.download=f.file;
  document.getElementById('figure-count').textContent=`${activeFigure+1} / ${data.figures.length}`;
}
document.querySelectorAll('[data-figure]').forEach(b=>b.addEventListener('click',()=>{opener=b;showFigure(Number(b.dataset.figure));modal.showModal();}));
document.getElementById('close-figure').addEventListener('click',()=>modal.close());
document.getElementById('previous-figure').addEventListener('click',()=>showFigure(activeFigure-1));
document.getElementById('next-figure').addEventListener('click',()=>showFigure(activeFigure+1));
modal.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'){event.preventDefault();showFigure(activeFigure-1);}if(event.key==='ArrowRight'){event.preventDefault();showFigure(activeFigure+1);}});
modal.addEventListener('close',()=>{if(opener)opener.focus();});
modal.addEventListener('click',event=>{if(event.target===modal){const r=modal.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)modal.close();}});
