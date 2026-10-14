'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const HELPER='src/mac-application-location.cjs';
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
function overlayChildMain(source){
  if(source.includes('appLocationReady')||source.includes('mac-application-location.cjs'))throw Error('Child location overlay already applied');
  function replace(before,after){if(source.split(before).length!==2)throw Error('Child location overlay anchor mismatch: '+before);source=source.replace(before,after);}
  replace("app.enableSandbox();", "const {createMacApplicationLocationGate}=require('./mac-application-location.cjs');\napp.enableSandbox();");
  replace("const suiteBindingKey=", "let appLocationReady=process.platform!=='darwin'||!packaged||smoke,appLocationQuitting=false;\nconst appLocation=createMacApplicationLocationGate({app,dialog,platform:process.platform,packaged,smoke,productName:current.productName});\napp.on('before-quit',()=>{appLocationQuitting=true;});\nconst suiteBindingKey=");
  replace("app.on('second-instance',(_event,argv)=>{", "app.on('second-instance',(_event,argv)=>{if(!appLocationReady)return;");
  replace("app.on('activate',()=>{", "app.on('activate',()=>{if(!appLocationReady)return;");
  replace("app.whenReady().then(()=>{", "app.whenReady().then(async()=>{\n    const location=await appLocation.run();\n    if(!location.continueStartup||appLocationQuitting)return;\n    appLocationReady=true;");
  replace("function createWindow(){", "function createWindow(){\n  if(!appLocationReady)return;");
  return source;
}
function inventory(root,prefix=''){
  const rows=[];
  for(const name of fs.readdirSync(path.join(root,prefix)).sort()){
    const relative=prefix?prefix+'/'+name:name,file=path.join(root,relative),stat=fs.lstatSync(file);
    if(stat.isSymbolicLink())throw Error('Child overlay cannot traverse symbolic links');
    if(stat.isDirectory())rows.push(...inventory(root,relative));
    else if(stat.isFile())rows.push({path:relative,sha256:digest(fs.readFileSync(file)),bytes:stat.size});
    else throw Error('Child overlay encountered unsupported file');
  }
  return rows;
}
function applyChildLocationOverlay(stage,commonSource){
  stage=path.resolve(stage);commonSource=path.resolve(commonSource);
  if(stage===commonSource)throw Error('Child overlay requires a separate reviewed stage');
  const runtime=JSON.parse(fs.readFileSync(path.join(stage,'runtime.json'),'utf8'));
  if(!['world','messenger'].includes(runtime.clientId))throw Error('Child location overlay is only for WORLD and Workspace');
  const before=inventory(stage),mainFile=path.join(stage,'src/main.cjs'),main=overlayChildMain(fs.readFileSync(mainFile,'utf8')),helper=fs.readFileSync(path.join(commonSource,HELPER));
  if(fs.existsSync(path.join(stage,HELPER)))throw Error('Child helper already exists');
  fs.writeFileSync(mainFile,main);fs.writeFileSync(path.join(stage,HELPER),helper);
  const after=inventory(stage),previous=new Map(before.map(row=>[row.path,row])),allowed=new Set(['src/main.cjs',HELPER]),changed=[];
  for(const row of after){const old=previous.get(row.path);previous.delete(row.path);if(!old||old.sha256!==row.sha256){if(!allowed.has(row.path))throw Error('Unexpected child overlay change: '+row.path);changed.push({...row,beforeSHA256:old?.sha256||null});}}
  if(previous.size||changed.length!==2)throw Error('Child overlay must change exactly the entry point and new helper');
  return {ok:true,clientId:runtime.clientId,changed,unchangedFiles:before.length-1,userDataOperations:0};
}
module.exports={applyChildLocationOverlay,overlayChildMain};
