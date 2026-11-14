// QA owns this BrowserServer and its ChildProcess. Never search for or stop another browser.
// https://playwright.dev/docs/api/class-browserserver
const owners=new WeakMap();
async function deadline(operation,ms){
  let timer;
  try{return await Promise.race([Promise.resolve().then(operation).then(()=>true),new Promise(resolve=>{timer=setTimeout(()=>resolve(false),ms);})]);}
  finally{clearTimeout(timer);}
}
export async function launchOwnedBrowser(chromium,options){
  const server=await chromium.launchServer({...options,host:'127.0.0.1'});
  try{
    const browser=await chromium.connect(server.wsEndpoint(),{timeout:30000});
    owners.set(browser,{server,child:server.process()});
    return browser;
  }catch(error){await server.kill();throw error;}
}
export async function closeOwnedBrowser(browser,{graceMs=20000,killMs=30000}={}){
  const owned=owners.get(browser);
  if(!owned)throw Error('QA does not own this browser');
  const {server,child}=owned,started=Date.now();
  const result={pid:child.pid,graceful:false,forced:false,exited:false};
  try{result.graceful=await deadline(()=>server.close(),graceMs);}
  catch(error){result.closeError=String(error.message);}
  result.exited=child.exitCode!==null||child.signalCode!==null;
  if(!result.exited){
    result.forced=true;
    const killed=await deadline(()=>server.kill(),killMs);
    result.exited=child.exitCode!==null||child.signalCode!==null;
    if(!killed||!result.exited)throw Error('Owned QA browser did not exit after bounded kill: '+JSON.stringify(result));
  }
  result.exitCode=child.exitCode;result.signal=child.signalCode;result.elapsedMs=Date.now()-started;
  owners.delete(browser);
  return result;
}
