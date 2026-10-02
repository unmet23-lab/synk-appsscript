'use strict';
// Isolated synthetic company session. Never reads operational company data.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'..');
if(!process.versions.electron){
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'synk-workroom-download-'));
  try{
    const run=require('node:child_process').spawnSync(require('electron'),[__filename,'--profile='+profile],{cwd:root,windowsHide:true,encoding:'utf8',timeout:30000});
    const line=run.stdout?.split(/\r?\n/).find(value=>value.startsWith('SYNK_WORKROOM_DOWNLOAD '));
    const report=line?JSON.parse(line.slice('SYNK_WORKROOM_DOWNLOAD '.length)):{ok:false,error:run.error?.message||'NO_RESULT',stderr:run.stderr?.slice(-1000)};
    fs.mkdirSync(path.join(root,'artifacts'),{recursive:true});fs.writeFileSync(path.join(root,'artifacts','workroom-download-smoke-20261002.json'),JSON.stringify(report,null,2)+'\n');
    process.stdout.write(JSON.stringify(report,null,2)+'\n');if(!report.ok)process.exitCode=1;
  }finally{
    if(path.dirname(path.resolve(profile))!==path.resolve(os.tmpdir())||!path.basename(profile).startsWith('synk-workroom-download-'))throw Error('Unsafe test profile');
    fs.rmSync(profile,{recursive:true,force:true,maxRetries:20,retryDelay:300});
  }
}else{
  const {app,BrowserWindow,session}=require('electron'),{createServer}=require('node:http');
  const {preferences,contentSecurityPolicy}=require('../src/security.cjs'),{createDownloadHandler}=require('../src/downloads.cjs');
  const profile=process.argv.find(value=>value.startsWith('--profile='))?.slice(10);
  if(!profile||path.dirname(profile)!==os.tmpdir()||!path.basename(profile).startsWith('synk-workroom-download-'))throw Error('Isolated profile required');
  app.enableSandbox();app.setPath('userData',profile);
  app.whenReady().then(async()=>{
    const errors=[],checks=[],denied=[];let window,server,loggedIn=true,complete;
    try{
      server=createServer((req,res)=>{
        res.setHeader('Content-Security-Policy',contentSecurityPolicy('mainFrame'));
        if(req.url==='/api/me'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({user:loggedIn&&req.headers.cookie==='synthetic=member'?{id:'synthetic-member',active:true}:null}));return;}
        if(req.url==='/workroom-practice.mjs'){res.setHeader('Content-Type','text/javascript');res.end("import {label} from './practice-model.mjs';document.body.dataset.ready=label;");return;}
        if(req.url==='/practice-model.mjs'){res.setHeader('Content-Type','text/javascript');res.end("export const label='practice-module-loaded';");return;}
        res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="ko"><body>합성 작업실 검사<script type="module" src="/workroom-practice.mjs"></script></body></html>');
      });
      await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port,entry=origin+'/?tab=messenger';
      const ownSession=session.fromPartition('synthetic-workroom-download');await ownSession.cookies.set({url:origin,name:'synthetic',value:'member',httpOnly:true,sameSite:'lax'});
      ownSession.setPermissionRequestHandler((_c,_p,callback)=>callback(false));ownSession.setPermissionCheckHandler(()=>false);
      ownSession.on('will-download',createDownloadHandler({getWindow:()=>window,session:ownSession,entry,clientId:'messenger',configureSave(item){const target=path.join(profile,'synthetic-export.txt');item.setSavePath(target);item.once('done',(_event,state)=>complete?.({state,bytes:item.getReceivedBytes(),text:fs.existsSync(target)?fs.readFileSync(target,'utf8'):null}));},onDenied:reason=>denied.push(reason)}));
      window=new BrowserWindow({show:false,webPreferences:{...preferences(undefined,undefined),session:ownSession}});
      window.webContents.on('console-message',details=>{if(details.level==='error')errors.push(details.message.slice(0,200));});
      await window.loadURL(origin+'/?tab=workroom&section=practice');
      checks.push({name:'native-csp-module-import',ok:await window.webContents.executeJavaScript("document.body.dataset.ready==='practice-module-loaded'&&typeof require==='undefined'")});
      const download=async()=>{
        const result=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('DOWNLOAD_TIMEOUT')),6000);complete=value=>{clearTimeout(timer);resolve(value);};});
        await window.webContents.executeJavaScript("(()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['SYNK 내 작업실 · 합성 내보내기'],{type:'text/plain;charset=utf-8'}));a.download='synk-shift-practice.txt';a.click();})()");
        return result;
      };
      const saved=await download();checks.push({name:'authenticated-txt-completes-with-exact-bytes',ok:saved.state==='completed'&&saved.text==='SYNK 내 작업실 · 합성 내보내기',state:saved.state,bytes:saved.bytes});
      loggedIn=false;const cancelled=await download();checks.push({name:'revoked-company-session-cancels',ok:cancelled.state==='cancelled'&&denied.includes('session'),state:cancelled.state});
      checks.push({name:'hidden-window',ok:!window.isVisible()});
      const report={ok:checks.every(check=>check.ok)&&errors.length===0,checkedOn:'2026-10-02',scope:'Real hidden Electron DownloadItem using production handler with isolated synthetic company cookie session',checks,consoleErrors:errors};
      process.stdout.write('SYNK_WORKROOM_DOWNLOAD '+JSON.stringify(report)+'\n');window.destroy();server.close();app.exit(report.ok?0:1);
    }catch(error){process.stdout.write('SYNK_WORKROOM_DOWNLOAD '+JSON.stringify({ok:false,error:error.message,checks,consoleErrors:errors})+'\n');window?.destroy();server?.close();app.exit(1);}
  });
}
