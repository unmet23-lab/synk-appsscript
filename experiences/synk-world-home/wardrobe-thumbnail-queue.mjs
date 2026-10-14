// At most one GPU readback per idle turn. Replaced/hidden cards must never keep
// building garments in the background while the learner is using the controls.
export function createWardrobeThumbnailQueue({
  now=()=>performance.now(),
  setTimer=(fn,delay)=>setTimeout(fn,delay),clearTimer=id=>clearTimeout(id),
  requestIdle=globalThis.requestIdleCallback?.bind(globalThis),
  cancelIdle=globalThis.cancelIdleCallback?.bind(globalThis),
  canRun=()=>!document.hidden,
}={}){
  const jobs=new Map();let disposed=false,timer=null,idle=null,quietUntil=0,completed=0;
  function cancel(){if(timer!==null)clearTimer(timer);if(idle!==null)cancelIdle?.(idle);timer=idle=null;}
  function schedule(){
    if(disposed||timer!==null||idle!==null||!jobs.size||!canRun())return;
    const delay=Math.max(0,quietUntil-now());
    if(delay>0){timer=setTimer(()=>{timer=null;schedule();},delay);return;}
    if(requestIdle)idle=requestIdle(run,{timeout:1000});
    else timer=setTimer(()=>{timer=null;run();},32);
  }
  function run(deadline){
    idle=null;
    if(disposed||!canRun())return;
    if(now()<quietUntil){schedule();return;}
    if(deadline&&!deadline.didTimeout&&deadline.timeRemaining()<6){schedule();return;}
    const first=jobs.entries().next();if(first.done)return;
    const [key,job]=first.value;jobs.delete(key);
    try{job();completed++;}finally{schedule();}
  }
  return {
    set(key,job){if(disposed)return;jobs.set(key,job);schedule();},
    delete(key){jobs.delete(key);if(!jobs.size)cancel();},
    clear(){jobs.clear();cancel();},
    postpone(){quietUntil=now()+250;cancel();schedule();},
    resume:schedule,
    dispose(){disposed=true;jobs.clear();cancel();},
    metrics:()=>({pending:jobs.size,completed,disposed}),
  };
}
