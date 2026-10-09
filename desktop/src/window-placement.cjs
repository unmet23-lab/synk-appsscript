'use strict';
const fs=require('node:fs'),path=require('node:path');
const finite=value=>Number.isFinite(value)&&Math.abs(value)<100000;
function fitPlacement(saved,displays,primary){
  const areas=displays.map(display=>display.workArea).filter(area=>area&&[area.x,area.y,area.width,area.height].every(finite)&&area.width>0&&area.height>0);
  const fallback=primary?.workArea||areas[0]||{x:0,y:0,width:1440,height:940};
  const valid=saved&&[saved.x,saved.y,saved.width,saved.height].every(finite)&&saved.width>0&&saved.height>0;
  let area=fallback,overlap=0;
  if(valid)for(const candidate of areas){const size=Math.max(0,Math.min(saved.x+saved.width,candidate.x+candidate.width)-Math.max(saved.x,candidate.x))*Math.max(0,Math.min(saved.y+saved.height,candidate.y+candidate.height)-Math.max(saved.y,candidate.y));if(size>overlap){area=candidate;overlap=size;}}
  const minWidth=Math.min(960,area.width),minHeight=Math.min(680,area.height);
  const width=Math.round(Math.max(minWidth,Math.min(valid?saved.width:1440,area.width))),height=Math.round(Math.max(minHeight,Math.min(valid?saved.height:940,area.height)));
  const x=Math.round(valid&&overlap?Math.max(area.x,Math.min(saved.x,area.x+area.width-width)):area.x+(area.width-width)/2);
  const y=Math.round(valid&&overlap?Math.max(area.y,Math.min(saved.y,area.y+area.height-height)):area.y+(area.height-height)/2);
  return {x,y,width,height,minWidth,minHeight,maximized:!!valid&&saved.maximized===true};
}
function createWindowPlacement({directory,screen,enabled=true}){
  const file=path.join(directory,'window-placement.json');let current=null;
  if(enabled)try{const text=fs.readFileSync(file,'utf8');if(text.length<2048)current=JSON.parse(text);}catch{}
  function restore(){return fitPlacement(current,screen.getAllDisplays(),screen.getPrimaryDisplay());}
  function attach(window,{maximized=false}={}){
    if(!enabled)return ()=>{};let timer=null,displayTimer=null,disposed=false,pendingMaximized=maximized,lastMaximized=maximized||window.isMaximized?.()===true;
    const minimized=()=>window.isMinimized?.()===true;
    const actualMaximized=()=>window.isMaximized?.()===true;
    function save(){clearTimeout(timer);timer=null;if(disposed||window.isDestroyed())return;const bounds=window.getNormalBounds();if(!bounds.width||!bounds.height)return;current={...bounds,maximized:pendingMaximized||(minimized()?lastMaximized:actualMaximized())};try{fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(current),{mode:0o600});fs.renameSync(file+'.tmp',file);}catch{}}
    function schedule(){clearTimeout(timer);timer=setTimeout(save,180);timer.unref?.();}
    function reconcile(){
      if(disposed||window.isDestroyed()||!window.getNormalBounds)return;
      const bounds=window.getNormalBounds(),fit=fitPlacement(bounds,screen.getAllDisplays(),screen.getPrimaryDisplay()),minimum=window.getMinimumSize?.();
      if(window.setMinimumSize&&(!minimum||minimum[0]!==fit.minWidth||minimum[1]!==fit.minHeight))window.setMinimumSize(fit.minWidth,fit.minHeight);
      // setBounds can leave native maximized/minimized mode. Keep that mode and
      // fit its normal bounds when the user restores the ordinary window.
      if(minimized()||actualMaximized())return;
      // Windows can round the requested DIP bounds by one pixel at fractional
      // scaling. Reapplying that same rectangle on every show cannot improve it.
      if(window.setBounds&&['x','y','width','height'].some(key=>Math.abs(bounds[key]-fit[key])>1))window.setBounds({x:fit.x,y:fit.y,width:fit.width,height:fit.height});
    }
    function displayChanged(){clearTimeout(displayTimer);displayTimer=setTimeout(()=>{displayTimer=null;reconcile();},120);displayTimer.unref?.();}
    function metricsChanged(_event,_display,metrics){if(!Array.isArray(metrics)||metrics.some(value=>['bounds','workArea','scaleFactor','rotation'].includes(value)))displayChanged();}
    // Electron maximize() shows a hidden window. Defer it until an intentional
    // show so a maximized last session still respects hidden Windows startup.
    function shown(){reconcile();if(pendingMaximized&&!window.isDestroyed()){pendingMaximized=false;lastMaximized=true;window.maximize();}}
    function maximizedNow(){pendingMaximized=false;lastMaximized=true;schedule();}
    function unmaximizedNow(){if(!minimized())lastMaximized=false;reconcile();schedule();}
    function restored(){reconcile();schedule();}
    const listeners={resize:schedule,move:schedule,maximize:maximizedNow,unmaximize:unmaximizedNow,restore:restored,close:save,show:shown};
    for(const [event,listener]of Object.entries(listeners))window.on(event,listener);
    const displayListeners={'display-added':displayChanged,'display-removed':displayChanged,'display-metrics-changed':metricsChanged};
    for(const [event,listener]of Object.entries(displayListeners))screen.on?.(event,listener);
    function dispose(){disposed=true;clearTimeout(timer);clearTimeout(displayTimer);for(const [event,listener]of Object.entries(listeners))window.removeListener(event,listener);for(const [event,listener]of Object.entries(displayListeners))screen.removeListener?.(event,listener);window.removeListener('closed',dispose);}
    window.once('closed',dispose);return dispose;
  }
  return {restore,attach};
}
module.exports={fitPlacement,createWindowPlacement};
