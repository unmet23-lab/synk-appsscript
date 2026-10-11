'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
if(!process.versions.electron){
 const cp=require('node:child_process'),result=cp.spawnSync(require('electron'),[__filename],{encoding:'utf8',timeout:45000,maxBuffer:1000000});
 process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');if(result.error)process.stderr.write(result.error.message+'\n');process.exit(result.status===0?0:1);
}
const {app,BrowserWindow}=require('electron');
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'synk-gpu-probe-')));
const timer=setTimeout(()=>app.exit(1),30000);
app.whenReady().then(async()=>{try{
 const window=new BrowserWindow({show:false,width:100,height:100,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
 await window.loadURL('data:text/html,<canvas width="8" height="8"></canvas>');
 const result=await window.webContents.executeJavaScript(`(()=>{const gl=document.querySelector('canvas').getContext('webgl2');if(!gl)return {ok:false};gl.clearColor(1,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);const pixels=new Uint8Array(4);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixels);const ext=gl.getExtension('WEBGL_debug_renderer_info');return {ok:pixels[0]===255&&pixels[1]===0&&pixels[2]===0&&pixels[3]===255,pixels:Array.from(pixels),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};})()`);
 const expectedArch=process.env.SYNK_QA_EXPECTED_ARCH;result.ok=result.ok&&process.arch===expectedArch;const report={...result,expectedArch,processArch:process.arch,runnerArch:process.env.RUNNER_ARCH||null,translated:app.runningUnderARM64Translation===true,sandbox:true,electron:process.versions.electron,gpu:app.getGPUFeatureStatus()};
 fs.writeFileSync(path.join(__dirname,'gpu-preflight.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));clearTimeout(timer);app.exit(result.ok?0:1);
}catch(error){console.error(error.stack);clearTimeout(timer);app.exit(1);}});
