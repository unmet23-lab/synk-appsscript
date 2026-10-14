/* Optional first-party site connector. Records no names, emails, page text or full URLs. */
(()=>{'use strict';
  const script=document.currentScript;if(!script?.src)return;
  const collector=new URL(script.src).origin,storageKey='synk-social-attribution:'+collector;
  let clickId=new URL(location.href).searchParams.get('synk_ref'),record=null;
  try{record=JSON.parse(sessionStorage.getItem(storageKey)||'null');}catch{}
  if(clickId&&/^[a-zA-Z0-9_-]{20,100}$/.test(clickId)){record={clickId,until:Date.now()+30*86400000};try{sessionStorage.setItem(storageKey,JSON.stringify(record));}catch{}}
  else clickId=record?.until>Date.now()?record.clickId:null;
  const allowed=new Set(['visit','trial_start','signup','inquiry']);
  async function track(event,{eventId}={}){if(!clickId||!allowed.has(event))return {ok:false,reason:'no-attribution'};const id=eventId||crypto.randomUUID();const response=await fetch(collector+'/social-track/event',{method:'POST',mode:'cors',credentials:'omit',referrerPolicy:'no-referrer',headers:{'Content-Type':'application/json'},body:JSON.stringify({clickId,eventId:id,event}),keepalive:true});if(!response.ok)return {ok:false,status:response.status};return response.json();}
  window.SynkSocialTracking=Object.freeze({track,clear(){clickId=null;try{sessionStorage.removeItem(storageKey);}catch{}},getClickId(){return clickId;}});
  if(clickId)track('visit').catch(()=>{});
})();
