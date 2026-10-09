'use strict';
// Run only the explicit offside candidate in isolated AppData. HTTPS is served
// from a synthetic in-memory protocol; no provider/login/API request is allowed.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process'),asar=require('@electron/asar');
const args=Object.fromEntries(process.argv.slice(2).map(value=>{const m=/^--(client|candidate|out|reuse-native)=(.+)$/.exec(value);if(!m)throw Error('Expected --client=platform|messenger --candidate=dir --out=dir');return [m[1],m[2]];}));
if(!['world'].includes(args.client)||!args.candidate||!args.out)throw Error('Explicit candidate and output are required');
const root=path.resolve(__dirname,'../..'),candidate=path.resolve(args.candidate),out=path.resolve(args.out),client=args.client;
for(const value of [candidate,out])if(!path.relative(root,value).startsWith('.tmp'+path.sep))throw Error('Candidate and output must remain within workspace .tmp');
const basename='SYNKWorldPreview',installed=path.join(process.env.LOCALAPPDATA,'Programs',basename),native=path.join(out,client+'-native');
if(args['reuse-native']!=='true'&&fs.existsSync(native)&&fs.readdirSync(native).length)throw Error('Refusing to overwrite a smoke package');fs.mkdirSync(native,{recursive:true});
function copyRuntime(source,destination){for(const item of fs.readdirSync(source,{withFileTypes:true})){if(item.name==='clients'||item.name==='app.asar'||item.name==='synk-install.json')continue;const from=path.join(source,item.name),to=path.join(destination,item.name);if(item.isDirectory()){fs.mkdirSync(to,{recursive:true});copyRuntime(from,to);}else if(item.isFile())fs.copyFileSync(from,to);}}
if(args['reuse-native']!=='true')copyRuntime(installed,native);for(const file of ['app.asar','synk-install.json'])if(args['reuse-native']!=='true')fs.copyFileSync(path.join(candidate,'resources',file),path.join(native,'resources',file));
const archive=path.join(native,'resources/app.asar'),runtime=JSON.parse(asar.extractFile(archive,'runtime.json')),sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),before=sha(archive);
const isolation=path.join(out,client+'-isolated');for(const name of ['Roaming','Local','Temp'])fs.mkdirSync(path.join(isolation,name),{recursive:true});
const configuration={appData:path.join(isolation,'Roaming'),entry:runtime.entry,archive,client,prefix:'SYNK_WORKSPACE_CONNECT '};
function observe(config){
 const {app,shell}=require('electron');const opened=[],permitted=[];const security=require(app.getAppPath()+'/src/security.cjs'),originalDestination=security.externalDestination;security.externalDestination=(...args)=>{const destination=originalDestination(...args);if(args[0]==='https://synk.im/world/')permitted.push(destination);return destination;};shell.openExternal=async url=>{opened.push(url);};app.setPath('appData',config.appData);const attempted=[];let result,finished=false;
 // Empty isolated vaults should never fetch. Fail closed if startup regresses.
 globalThis.fetch=async(...args)=>{attempted.push(String(args[0]));throw Error('QA_NETWORK_BLOCKED');};
 app.on('browser-window-created',(_event,window)=>{
  window.show=()=>{};window.showInactive=()=>{};
  const contents=window.webContents;
  if(config.client==='world')contents.session.protocol.handle('http',request=>{
   if(request.url!==config.entry&&!request.url.endsWith('/korean-racing/')){attempted.push(request.url);return new Response('blocked',{status:403});}
   return new Response('<!doctype html><html><head><title>SYNK Workspace native fixture</title></head><body><h1>Native WORLD bridge fixture</h1><a id="world-home" href="https://synk.im/world/">WORLD</a></body></html>',{headers:{'Content-Type':'text/html','Content-Security-Policy':"default-src 'none'; style-src 'none'; object-src 'none'; frame-ancestors 'none'"}});
  });
  contents.once('did-finish-load',async()=>{
   try{
    result=await contents.executeJavaScript(`(async()=>{const desktop=window.synkDesktop;const base={url:location.href,node:typeof require,environment:await desktop.getEnvironment(),teacherMethods:Object.keys(desktop.teacher||{}),unsafeLaunch:await desktop.launch('../cmd')};if(${JSON.stringify(config.client)}==='messenger'){base.teacherEnvironment=await desktop.teacher.getEnvironment();base.teacherStatus=await desktop.teacher.authStatus();base.denied=await desktop.teacher.accountRequest('classroom',{operation:'townCommand'});base.emptyClasses=await desktop.teacher.accountRequest('classroom',{operation:'classes'});}return base;})()`);
    await contents.executeJavaScript("document.getElementById('world-home').click()");await new Promise(r=>setTimeout(r,80));result.externalOpened=opened;result.permittedDestinations=permitted;result.browserOpenSuppressedBySmoke=true;
    const ok=permitted.includes('https://synk.im/world/')&&opened.length===0&&result.node==='undefined'&&result.environment.clientId===config.client&&result.unsafeLaunch.code==='UNKNOWN_CLIENT'&&app.isPackaged&&app.getAppPath()===config.archive&&app.getPath('userData').startsWith(config.appData+require('node:path').sep)&&!window.isVisible()&&attempted.length===0&&(config.client!=='messenger'||result.teacherEnvironment.clientId==='teacher'&&result.teacherEnvironment.hostClientId==='messenger'&&result.teacherStatus.configured===true&&result.teacherStatus.signedIn===false&&result.denied.error?.code==='INVALID_REQUEST'&&result.emptyClasses.error?.code==='AUTH_REQUIRED');
    process.stdout.write(config.prefix+JSON.stringify({ok,client:config.client,packaged:app.isPackaged,visible:window.isVisible(),profileIsolated:app.getPath('userData').startsWith(config.appData+require('node:path').sep),providerRequests:attempted,...result})+'\n');finished=true;setTimeout(()=>app.exit(ok?0:1),200);
   }catch(error){process.stdout.write(config.prefix+JSON.stringify({ok:false,error:error.message,providerRequests:attempted})+'\n');finished=true;}
  });
 });
 return {appData:app.getPath('appData'),archive:app.getAppPath()};
}
const child=spawn(path.join(native,basename+'.exe'),['--synk-smoke','--inspect-brk=127.0.0.1:0'],{cwd:native,windowsHide:true,env:{...process.env,APPDATA:configuration.appData,LOCALAPPDATA:path.join(isolation,'Local'),TEMP:path.join(isolation,'Temp'),TMP:path.join(isolation,'Temp')},stdio:['ignore','pipe','pipe']});
let stdout='',stderr='',ws,connected=false,sequence=0,injected=false,error=null;const pending=new Map();
const rpc=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
function connect(url){ws=new WebSocket(url);ws.addEventListener('open',async()=>{await rpc('Debugger.enable');await rpc('Runtime.runIfWaitingForDebugger');});ws.addEventListener('message',async event=>{const message=JSON.parse(event.data);if(message.id){const p=pending.get(message.id);if(p){pending.delete(message.id);message.error?p.reject(Error(message.error.message)):p.resolve(message.result);}return;}if(message.method==='Debugger.paused'&&!injected){injected=true;try{const result=await rpc('Debugger.evaluateOnCallFrame',{callFrameId:message.params.callFrames[0].callFrameId,expression:'('+observe.toString()+')('+JSON.stringify(configuration)+')',returnByValue:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));await rpc('Debugger.resume');}catch(e){error=e.message;child.kill('SIGKILL');}}});}
const timer=setTimeout(()=>{error='native smoke timeout';child.kill('SIGKILL');},35000);
child.stdout.on('data',data=>{stdout+=data;if(stdout.includes(configuration.prefix))ws?.close();});child.stderr.on('data',data=>{stderr+=data;const match=stderr.match(/Debugger listening on (ws:\/\/127\.0\.0\.1:\d+\/[^\s]+)/);if(match&&!connected){connected=true;connect(match[1]);}});child.on('error',e=>{error=e.message;});
child.on('close',code=>{clearTimeout(timer);ws?.close();let result;try{result=JSON.parse(stdout.split(/\r?\n/).find(line=>line.startsWith(configuration.prefix)).slice(configuration.prefix.length));}catch{}
 const report={createdAt:new Date().toISOString(),ok:code===0&&result?.ok===true&&!error&&sha(archive)===before,client,candidate,archive,asarSha256:before,packageBytesUnchanged:sha(archive)===before,code,error,result,realAuthenticationPerformed:false,realProfileTouched:false,installed:false,smokeSource:__filename,...(!result?.ok?{stderr:stderr.slice(-2000),stdout:stdout.slice(-1000)}:{})};
 fs.writeFileSync(path.join(out,client+'-smoke.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(!report.ok)process.exitCode=1;
});
