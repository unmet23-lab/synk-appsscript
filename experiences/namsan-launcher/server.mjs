import http from 'node:http';
import {existsSync, createReadStream, statSync, readFileSync} from 'node:fs';
import {fileURLToPath, pathToFileURL} from 'node:url';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const EXPERIENCES=path.dirname(ROOT);
const HOME=process.env.USERPROFILE || 'C:/Users/q1212';
const PROGRAMS=process.env.ProgramFiles || 'C:/Program Files';
const firstExisting=paths=>paths.find(p=>existsSync(p)) || null;
const quotePS=value=>"'"+value.replaceAll("'","''")+"'";
// The object particle follows a Korean name's last syllable (Unity 게임을, Unity 프로젝트를). The one
// English name, Epic Games Launcher, is read as 런처 like the page copy ("Launcher가"), so it takes 를.
const objectParticle=name=>{const c=name.charCodeAt(name.length-1)-0xac00;return c>=0&&c<=11171&&c%28?'을':'를';};
const RENDER_VIEWS=[['01-garden','정원 산책길'],['02-mongle','몽글의 가까운 재질'],['03-terrace','전망대의 먼 풍경']];

// Report contents can attest to a frame, but can never choose a served path.
// Only these three filenames under the fixed engine QA directories are exposed.
export function resolveRenders(engine,{experiences=EXPERIENCES}={}) {
  const candidates=engine==='unity'
    ?[path.join(experiences,'namsan-urp/QA/Unity')]
    :engine==='unreal'
      ?[path.join(experiences,'namsan-unreal/QA/Unreal'),path.join(experiences,'namsan-unreal-art/QA/Unreal')]:[];
  const available=[];
  for(const directory of candidates) {
    try {
      const reportPath=path.join(directory,engine==='unity'?'render-validation.json':'render-report.json');
      const reportStat=statSync(reportPath);
      const report=JSON.parse(readFileSync(reportPath,'utf8').replace(/^\uFEFF/,''));
      if(!Array.isArray(report.frames)||report.frames.length!==3||report.error)continue;
      if(engine==='unity'&&(!report.savedSceneReloaded||!report.materialBindingsVerified||report.frames.some(frame=>frame.settled!==true)))continue;
      if(engine==='unreal'&&(!report.engine||report.resolution?.[0]!==1600||report.resolution?.[1]!==1000))continue;
      const frames=RENDER_VIEWS.map(([id,label])=>{
        const name=id+'.png',file=path.join(directory,name),stats=statSync(file);
        const declared=report.frames.find(frame=>path.win32.basename(String(frame.image||frame.path||''))===name);
        // Suppress partially overwritten capture sets until their new report exists.
        if(!declared||!stats.isFile()||stats.size<33||stats.mtimeMs>reportStat.mtimeMs+1000)throw new Error('Incomplete render set');
        const bytes=readFileSync(file);
        if(!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes.readUInt32BE(16)!==1600||bytes.readUInt32BE(20)!==1000||!bytes.subarray(-8).equals(Buffer.from([73,69,78,68,174,66,96,130])))throw new Error('Not a complete comparison PNG');
        return {id,label,file,url:`/renders/${engine}/${name}?v=${Math.round(stats.mtimeMs)}`,modifiedAt:new Date(stats.mtimeMs).toISOString()};
      });
      available.push({available:true,updatedAt:new Date(reportStat.mtimeMs).toISOString(),artOnly:engine==='unreal'&&report.art_only===true,frames});
    } catch { /* No complete actual render report: show the pending state. */ }
  }
  return available.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0]||{available:false,frames:[]};
}

function publicRenders(engine) {
  const result=resolveRenders(engine);
  return {...result,frames:result.frames.map(({file,...frame})=>frame)};
}

export function resolveEngine(engine) {
  if(engine==='unity') {
    const project=path.join(EXPERIENCES,'namsan-urp');
    const game=firstExisting([path.join(project,'Builds/Windows/Namsan.exe')]);
    const editor=firstExisting([
      path.join(PROGRAMS,'Unity 6000.3.24f1/Editor/Unity.exe'),
      path.join(HOME,'UnityEditors/6000.3.24f1/Editor/Unity.exe'),
      path.join(PROGRAMS,'Unity/Hub/Editor/6000.3.24f1/Editor/Unity.exe')]);
    const setup=firstExisting([path.join(HOME,'AppData/Local/Packages/UnityTechnologies.UnityCLI_2vrhnee42bhxm/LocalCache/Roaming/UnityHub/downloads/UnitySetup64-6000.3.24f1.exe')]);
    return {editorInstalled:!!editor,gameBuilt:!!game,
      phase:game?'ready-game':editor?'ready-project':'needs-install',
      canLaunch:!!(game||editor||setup),
      message:game?'게임 실행 파일이 있어요. 버튼을 누르면 별도 창으로 열립니다.':editor
        ?'Unity 설치를 확인했어요. 라이선스 활성화 후 프로젝트를 열고 컴파일과 장면 생성을 진행합니다.'
        :'Unity 엔진 설치가 아직 끝나지 않았어요. 설치 창을 열고 Windows 확인에 응답해 주세요.',
      executable:game||editor||setup,args:game?[]:editor?['-projectPath',project]:[],
      opened:game?'Unity 게임':editor?'Unity 프로젝트':'Unity 설치 창'};
  }
  if(engine==='unreal') {
    const project=path.join(EXPERIENCES,'namsan-unreal');
    const game=firstExisting([
      path.join(project,'Builds/Win64/Windows/NamsanUnreal.exe'),
      path.join(project,'Builds/Win64/Windows/NamsanUnreal/Binaries/Win64/NamsanUnreal.exe')]);
    const editor=firstExisting([path.join(PROGRAMS,'Epic Games/UE_5.8/Engine/Binaries/Win64/UnrealEditor.exe')]);
    const launcher=firstExisting([
      path.join(PROGRAMS,'Epic Games/Launcher/Portal/Binaries/Win64/EpicGamesLauncher.exe'),
      'C:/Program Files (x86)/Epic Games/Launcher/Portal/Binaries/Win64/EpicGamesLauncher.exe']);
    return {editorInstalled:!!editor,gameBuilt:!!game,
      phase:game?'ready-game':editor?'ready-project':'needs-install',
      canLaunch:!!(game||editor||launcher),
      message:game?'게임 실행 파일이 있어요. 버튼을 누르면 별도 창으로 열립니다.':editor
        ?'Unreal 프로젝트를 열 수 있어요. C++ 컴파일과 장면 생성은 별도 확인이 필요합니다.'
        :'Epic 런처에서 로그인한 뒤 Unreal Engine 설치가 필요해요. 아직 게임은 실행할 수 없어요.',
      executable:game||editor||launcher,args:game?[]:editor?[path.join(project,'NamsanUnreal.uproject')]:[],
      opened:game?'Unreal 게임':editor?'Unreal 프로젝트':'Epic Games Launcher'};
  }
  throw new Error('Unknown engine');
}

export function openNative({executable,args}) {
  if(process.platform!=='win32')return Promise.reject(new Error('이 실행 버튼은 현재 Windows 컴퓨터용이에요.'));
  // Fixed local allowlisted paths and arguments only; the request never supplies a command or path.
  let command='$ErrorActionPreference="Stop"; [Console]::OutputEncoding=[System.Text.UTF8Encoding]::new(); try { Start-Process -FilePath '+quotePS(executable);
  if(args.length) command+=' -ArgumentList '+quotePS(args.map(arg=>'"'+arg+'"').join(' '));
  command+=' -PassThru | Out-Null; Write-Output "OPENED" } catch { Write-Output "LAUNCH_CANCELLED_OR_FAILED"; exit 1 }';
  const encoded=Buffer.from(command,'utf16le').toString('base64');
  return new Promise((resolve,reject)=>{
    const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',encoded],{windowsHide:true,stdio:['ignore','pipe','pipe']});
    let output='';child.stdout.on('data',b=>{output+=b.toString('utf8')});child.stderr.resume();
    child.on('error',()=>reject(new Error('Windows 실행 창을 열지 못했어요. 실행 도구를 확인해 주세요.')));
    child.on('close',code=>code===0&&output.includes('OPENED')?resolve():reject(new Error('Windows에서 실행이 취소되었거나 실패했어요. 버튼을 다시 누른 뒤 권한 창을 확인해 주세요.')));
  });
}

export function createLauncher({port=5195,resolve=resolveEngine,open=openNative}={}) {
  const token=randomBytes(32).toString('hex');
  const busy={unity:false,unreal:false};
  const allowedHosts=new Set([`127.0.0.1:${port}`,`localhost:${port}`]);
  const origins=new Set([...allowedHosts].map(host=>'http://'+host));
  const files=new Map([
    ['/',[path.join(ROOT,'public/index.html'),'text/html; charset=utf-8']],
    ['/unity',[path.join(ROOT,'public/index.html'),'text/html; charset=utf-8']],
    ['/unreal',[path.join(ROOT,'public/index.html'),'text/html; charset=utf-8']],
    ['/style.css',[path.join(ROOT,'public/style.css'),'text/css; charset=utf-8']],
    ['/app.js',[path.join(ROOT,'public/app.js'),'text/javascript; charset=utf-8']],
    ['/assets/concept.png',[path.join(EXPERIENCES,'namsan-urp/QA/ConceptReference.png'),'image/png']],
    ['/assets/SUIT-Variable.woff2',[path.join(EXPERIENCES,'dokkaebi-express/public/assets/SUIT-Variable.woff2'),'font/woff2']]
  ]);
  function send(res,status,body) {
    res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
    res.end(JSON.stringify(body));
  }
  function status(engine) {
    const {executable,args,opened,...publicState}=resolve(engine);
    return {...publicState,busy:busy[engine]};
  }
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self'; font-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    if(!allowedHosts.has(req.headers.host))return send(res,403,{ok:false,message:'허용되지 않은 호스트입니다.'});
    const route=new URL(req.url,'http://127.0.0.1').pathname;
    if(req.method==='GET'&&route==='/api/status') {
      res.setHeader('x-namsan-token',token);res.setHeader('x-namsan-launcher','1');
      return send(res,200,{checkedAt:new Date().toISOString(),unity:status('unity'),unreal:status('unreal'),webUrl:'http://127.0.0.1:5194/namsan.html'});
    }
    if(req.method==='GET'&&route==='/api/renders')
      return send(res,200,{unity:publicRenders('unity'),unreal:publicRenders('unreal')});
    if(req.method==='POST'&&route==='/api/launch') {
      if(!origins.has(req.headers.origin)||req.headers['x-namsan-token']!==token)
        return send(res,403,{ok:false,message:'이 페이지에서 실행 버튼을 눌러 주세요.'});
      if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))return send(res,415,{ok:false,message:'잘못된 요청 형식입니다.'});
      let body='';
      try {
        for await(const chunk of req) {body+=chunk;if(Buffer.byteLength(body)>512)return send(res,413,{ok:false,message:'요청이 너무 큽니다.'});}
        let data;try{data=JSON.parse(body)}catch{return send(res,400,{ok:false,message:'잘못된 요청입니다.'});}
        const engine=data?.engine;
        if(!['unity','unreal'].includes(engine)||Object.keys(data).some(key=>key!=='engine'))return send(res,400,{ok:false,message:'Unity 또는 Unreal만 열 수 있어요.'});
        if(busy.unity||busy.unreal)return send(res,409,{ok:false,message:'다른 실행 창을 여는 중이에요. Windows 확인창에 먼저 응답해 주세요.'});
        const target=resolve(engine);
        if(!target.executable)return send(res,409,{ok:false,message:'설치 프로그램을 찾지 못했어요. 현재 설치 상태를 다시 확인해야 해요.'});
        busy[engine]=true;
        try {
          await open(target);
          return send(res,200,{ok:true,message:`${target.opened}${objectParticle(target.opened)} 열었어요. Windows의 새 창을 확인해 주세요. 게임 실행 완료를 뜻하지는 않아요.`});
        } catch(error) {return send(res,409,{ok:false,message:error.message});}
        finally {busy[engine]=false;}
      } catch {return send(res,400,{ok:false,message:'요청을 읽지 못했어요. 다시 눌러 주세요.'});}
    }
    if(req.method!=='GET'&&req.method!=='HEAD')return send(res,405,{ok:false,message:'허용되지 않은 요청입니다.'});
    const renderRoute=/^\/renders\/(unity|unreal)\/(01-garden|02-mongle|03-terrace)\.png$/.exec(route);
    const frame=renderRoute?resolveRenders(renderRoute[1]).frames.find(item=>item.id===renderRoute[2]):null;
    const file=frame?[frame.file,'image/png']:files.get(route);
    if(!file||!existsSync(file[0]))return send(res,404,{ok:false,message:'페이지를 찾지 못했어요.'});
    res.writeHead(200,{'Content-Type':file[1],'Content-Length':statSync(file[0]).size,'Cache-Control':route.startsWith('/assets/')||frame?'public, max-age=3600':'no-store'});
    if(req.method==='HEAD')return res.end();
    createReadStream(file[0]).on('error',()=>res.destroy()).pipe(res);
  });
  server.requestTimeout=150000;
  return server;
}

if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url) {
  const server=createLauncher();
  server.listen(5195,'127.0.0.1',()=>console.log('Namsan launcher: http://127.0.0.1:5195'));
}
