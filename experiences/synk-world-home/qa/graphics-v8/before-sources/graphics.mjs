const $=s=>document.querySelector(s);
let version=['1','2','3'].includes(new URLSearchParams(location.search).get('graphics'))?new URLSearchParams(location.search).get('graphics'):'3',scene=null,generation=0;
$('#reduced').checked=matchMedia('(prefers-reduced-motion: reduce)').matches;
async function mount(){
 const token=++generation;scene?.dispose();scene=null;$('#study-loading').hidden=false;
 $('#study-loading').textContent='몽글의 작은 정원을 준비하고 있어요.';
 document.querySelectorAll('[data-version]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.version===version)));
 $('#version-label').textContent={'1':'첫 홈','2':'정원과 빛','3':'촉감과 빛'}[version];$('#quality').disabled=version!=='3';$('#view').disabled=version!=='3';
 try{
  const {mountHomeScene}=await import(version==='3'?'./scene-v3.mjs':version==='2'?'./scene-v2.mjs':'./scene.mjs');
  if(token!==generation)return;
  const next=await mountHomeScene($('#study-scene'),{reducedMotion:$('#reduced').checked,quality:$('#quality').value,onError:()=>{if(token!==generation)return;$('#study-loading').hidden=false;$('#study-loading').textContent='3D 화면을 준비하지 못했어요. 새로고침해 주세요.';}});
  if(token!==generation){next.dispose();return;}scene=next;scene.setTime($('#time').value);scene.setOutfit($('#outfit').value);scene.setView?.($('#view').value);$('#study-loading').hidden=true;
 }catch(error){if(token!==generation)return;$('#study-loading').textContent='3D 화면을 준비하지 못했어요. 새로고침해 주세요.';console.error('Graphics study:',error);}
}
document.querySelectorAll('[data-version]').forEach(b=>b.addEventListener('click',()=>{version=b.dataset.version;mount();}));
$('#time').addEventListener('change',()=>scene?.setTime($('#time').value));$('#outfit').addEventListener('change',()=>scene?.setOutfit($('#outfit').value));$('#greet').addEventListener('click',()=>scene?.greet());$('#reduced').addEventListener('change',()=>scene?.setReducedMotion?scene.setReducedMotion($('#reduced').checked):mount());$('#quality').addEventListener('change',()=>scene?.setQuality?.($('#quality').value));
window.addEventListener('pagehide',()=>{++generation;scene?.dispose();scene=null;});window.addEventListener('pageshow',event=>{if(event.persisted)mount();});
$('#view').addEventListener('change',()=>scene?.setView?.($('#view').value));
window.__graphicsStudy={metrics:()=>scene?.metrics(),version:()=>version,ready:()=>!!scene};
await mount();
