'use strict';

const failure=code=>Object.assign(new Error(code),{updateCode:code});
function launchWindowsUpdate({spawn,file,pid,automatic=false,nonce,timeoutMs=30000}={}){
  if(typeof file!=='string'||!Number.isSafeInteger(pid)||pid<=0||automatic&&!/^[a-f0-9]{64}$/.test(nonce||''))return Promise.reject(failure('UPDATE_HANDOFF_INVALID'));
  const args=automatic?['--auto-update','--wait-pid='+pid,'--handoff-token='+nonce]:['--wait-pid='+pid];
  return new Promise((resolve,reject)=>{
    let child,timer,finished=false,buffer='';
    const done=error=>{if(finished)return;finished=true;clearTimeout(timer);child?.stdout?.removeListener('data',data);child?.stdout?.destroy();child?.removeListener('exit',exit);child?.unref();if(error)reject(error);else resolve();};
    const exit=()=>done(failure('UPDATE_HANDOFF_FAILED'));
    const data=chunk=>{
      buffer+=chunk.toString('utf8');
      if(buffer.length>256){done(failure('UPDATE_HANDOFF_INVALID'));return;}
      const newline=buffer.indexOf('\n');if(newline<0)return;
      const line=buffer.slice(0,newline).replace(/\r$/,'');
      done(line==='SYNK_UPDATE_READY '+nonce?null:failure('UPDATE_HANDOFF_INVALID'));
    };
    try{child=spawn(file,args,{detached:true,stdio:automatic?['ignore','pipe','ignore']:'ignore',windowsHide:true});}
    catch{done(failure('UPDATE_HANDOFF_FAILED'));return;}
    child.once('error',()=>done(failure('UPDATE_HANDOFF_FAILED')));
    child.once('spawn',()=>{if(!automatic)done();});
    if(automatic){child.once('exit',exit);child.stdout?.on('data',data);timer=setTimeout(()=>done(failure('UPDATE_HANDOFF_TIMEOUT')),timeoutMs);timer.unref?.();}
  });
}
module.exports={launchWindowsUpdate};
