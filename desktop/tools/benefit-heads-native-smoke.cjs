'use strict';
// 회원 혜택 소개 머리 넷(성향·구독·플레저·운세)을 숨은 Electron 창에서 여러 폭으로 열어,
// 물건(실제 그림 점)이 위 번호 라벨·스티커, 큰 한글, 한 줄 제목과 겹치지 않는지 잰다. 합성 계정만 쓰고 바깥 요청은 막는다.
// 사용: node desktop/tools/benefit-heads-native-smoke.cjs  (출력 SYNK_BENEFIT_HEADS_OUT, 기본 desktop/artifacts/benefit-heads)
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'..'),out=process.env.SYNK_BENEFIT_HEADS_OUT||path.join(root,'artifacts','benefit-heads'),prefix='SYNK_BENEFIT_HEADS ';
if(!path.isAbsolute(out))throw Error('Output path must be absolute');
const IDS=['insight','subscriptions','care','fortune'];
// [폭, 높이] — 1100~761은 본문이 좁아지는 구간, 760 아래는 물건이 흐름 안으로 들어오는 휴대폰 틀.
const SIZES=[[1440,900],[1366,768],[1280,720],[1180,800],[1100,800],[1020,800],[960,800],[900,800],[860,800],[820,800],[780,800],[761,800],[760,800],[600,800],[390,844],[320,700]];
const SHOT_WIDTHS=new Set([1440,1020,900,820,390]);

function measure(){
  const heads=[['detail','.benefit-detail-hero','img.benefit-object','.benefit-detail-top>*','.benefit-detail-title .poster-word','#benefit-title'],
    ['insight','.member-insight .mi-hero.has-art','.mi-object','.mi-hero-top>*','h1','.mi-hero-title>p'],
    ['subscriptions','.member-subs .ms-hero.has-art','.ms-object','.ms-hero-top>*','h1','.ms-hero-title>p']];
  const ctx=document.createElement('canvas').getContext('2d');
  const points=img=>{const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(img,0,0);const d=g.getImageData(0,0,c.width,c.height).data,list=[];for(let y=0;y<c.height;y+=6)for(let x=0;x<c.width;x+=6)if(d[(y*c.width+x)*4+3]>40)list.push([x/c.width,y/c.height]);return list;};
  const cloud=img=>{ // 회전 전 상자 → contain + object-position → 실제 그림 점 → 화면 좌표(회전 포함)
    const saved=img.style.transform;img.style.transform='none';const r=img.getBoundingClientRect(),cs=getComputedStyle(img);img.style.transform=saved;
    const s=Math.min(r.width/img.naturalWidth,r.height/img.naturalHeight),dw=img.naturalWidth*s,dh=img.naturalHeight*s,[px,py]=cs.objectPosition.split(' ').map(v=>parseFloat(v)/100);
    const x=r.left+(r.width-dw)*px,y=r.top+(r.height-dh)*py,m=new DOMMatrix(cs.transform==='none'?undefined:cs.transform),[ox,oy]=cs.transformOrigin.split(' ').map(parseFloat);
    return points(img).map(([u,v])=>{const p=m.transformPoint(new DOMPoint(x+u*dw-r.left-ox,y+v*dh-r.top-oy));return [p.x+r.left+ox,p.y+r.top+oy];});
  };
  const glyph=el=>{ // 큰 한글은 줄 높이 .82라 글리프가 줄 상자 밖으로 나온다 — 실제 글자 윗선·아랫선
    const cs=getComputedStyle(el),r=el.getBoundingClientRect(),fs=parseFloat(cs.fontSize),lh=parseFloat(cs.lineHeight)||fs;ctx.font=cs.fontWeight+' '+cs.fontSize+' '+cs.fontFamily;ctx.letterSpacing=cs.letterSpacing;const t=ctx.measureText(el.textContent.trim());
    const base=r.top+(lh-(t.fontBoundingBoxAscent+t.fontBoundingBoxDescent))/2+t.fontBoundingBoxAscent;return {l:r.left,r:r.left+t.width,t:base-t.actualBoundingBoxAscent,b:base+t.actualBoundingBoxDescent};
  };
  const below=(pts,box)=>{const ys=pts.filter(([X])=>X>=box.l-2&&X<=box.r+2).map(p=>p[1]);return ys.length?Math.round(Math.min(...ys)-box.b):null;};
  const above=(pts,box)=>{const ys=pts.filter(([X])=>X>=box.l-2&&X<=box.r+2).map(p=>p[1]);return ys.length?Math.round(box.t-Math.max(...ys)):null;};
  const rect=el=>{const r=el.getBoundingClientRect();return {l:r.left,r:r.right,t:r.top,b:r.bottom};};
  for(const [kind,headSel,objSel,topSel,wordSel,titleSel] of heads){
    const head=document.querySelector(headSel);if(!head||!head.getClientRects().length)continue;const img=head.querySelector(objSel);if(!img||!img.naturalWidth)return {error:'object not loaded'};
    const pts=cloud(img),tops=[...head.querySelectorAll(topSel)].map(rect),word=head.querySelector(wordSel),title=head.querySelector(titleSel);
    const gaps=tops.map(b=>below(pts,b)).filter(v=>v!==null),hb=head.getBoundingClientRect();
    return {kind,headWidth:Math.round(hb.width),headHeight:Math.round(hb.height),top:gaps.length?Math.min(...gaps):null,word:word?above(pts,glyph(word)):null,title:title?above(pts,rect(title)):null,clash:(()=>{if(!word||!title)return null;const w=glyph(word),t=rect(title),dx=Math.max(t.l-w.r,w.l-t.r),dy=Math.max(t.t-w.b,w.t-t.b);return Math.round(Math.max(dx,dy));})(),wrapped:word?word.getBoundingClientRect().height>parseFloat(getComputedStyle(word).lineHeight)*1.5:false,
      object:(()=>{const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);return [Math.round(Math.min(...xs)-hb.left),Math.round(Math.min(...ys)-hb.top),Math.round(Math.max(...xs)-hb.left),Math.round(Math.max(...ys)-hb.top)];})(),
      wordOut:(()=>{if(!word)return null;const w=glyph(word),cs=getComputedStyle(head);return Math.round(w.r-(hb.right-parseFloat(cs.paddingRight)));})(),
      overflow:(()=>{const m=document.getElementById('main');return Math.max(0,document.documentElement.scrollWidth-innerWidth,m?m.scrollWidth-m.clientWidth:0);})()};
  }
  return {error:'no detail head'};
}

if(!process.versions.electron){
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'synk-benefit-heads-'));
  try{
    const result=require('node:child_process').spawnSync(require('electron'),[__filename,'--profile='+profile],{cwd:root,windowsHide:true,encoding:'utf8',timeout:240000,maxBuffer:64*1024*1024});
    const line=result.stdout?.split(/\r?\n/).find(value=>value.startsWith(prefix));
    const report=line?JSON.parse(line.slice(prefix.length)):{ok:false,error:result.error?.message||'NO_RESULT',stderr:result.stderr?.slice(-1500)};
    fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'benefit-heads.json'),JSON.stringify(report,null,1)+'\n');
    const rows=report.rows||[],min=key=>rows.filter(r=>r[key]!==null&&r[key]!==undefined).sort((a,b)=>a[key]-b[key])[0];
    process.stdout.write(JSON.stringify({ok:report.ok,rows:rows.length,failed:report.failed,closestTop:min('top'),closestWord:min('word'),closestTitle:min('title'),error:report.error,consoleErrors:report.consoleErrors,requests:report.requests},null,1)+'\n');if(!report.ok)process.exitCode=1;
  }finally{
    if(path.dirname(path.resolve(profile))!==path.resolve(os.tmpdir())||!path.basename(profile).startsWith('synk-benefit-heads-'))throw Error('Unsafe temporary profile');
    fs.rmSync(profile,{recursive:true,force:true,maxRetries:20,retryDelay:300});
  }
}else{
  const {app,BrowserWindow,protocol,session,Menu}=require('electron'),{createNativeContent}=require('../src/native-content.cjs'),{preferences}=require('../src/security.cjs');
  const profile=process.argv.find(value=>value.startsWith('--profile='))?.slice(10);
  if(!profile||path.dirname(profile)!==os.tmpdir()||!path.basename(profile).startsWith('synk-benefit-heads-'))throw Error('Isolated profile required');
  app.enableSandbox();app.setPath('userData',profile);app.commandLine.appendSwitch('force-device-scale-factor','1');protocol.registerSchemesAsPrivileged([{scheme:'synk-desktop',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
  app.whenReady().then(async()=>{
    let window;const rows=[],failed=[],errors=[],requests=[];
    try{
      Menu.setApplicationMenu(null);const isolated=session.fromPartition('benefit-heads-synthetic');isolated.protocol.handle('synk-desktop',createNativeContent({appRoot:root}));
      isolated.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(details,callback)=>{requests.push(details.url);callback({cancel:true});});
      window=new BrowserWindow({width:1440,height:900,useContentSize:true,show:false,frame:false,webPreferences:{...preferences(path.join(__dirname,'renderer-account-fixture.cjs')),session:isolated,backgroundThrottling:false}});
      window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('console-message',event=>{if(event.level==='error')errors.push(event.message);});
      const run=script=>window.webContents.executeJavaScript(script);
      const settle=async()=>{await run("document.fonts.ready.then(()=>Promise.all([...document.images].filter(i=>i.getAttribute('src')).map(i=>i.decode().catch(()=>{}))))");window.webContents.invalidate();await new Promise(resolve=>setTimeout(resolve,160));};
      await window.loadURL('synk-desktop://platform/index.html');
      for(let attempt=0;attempt<150;attempt++){const state=await run("document.documentElement.dataset.ready");if(state==='true')break;if(state==='error'||attempt===149)throw Error('Renderer not ready');await new Promise(resolve=>setTimeout(resolve,30));}
      for(const theme of ['night','day'])for(const [width,height] of SIZES){
        if(theme==='day'&&!SHOT_WIDTHS.has(width))continue;
        window.setContentSize(width,height);await run("document.documentElement.dataset.theme='"+theme+"';document.documentElement.dataset.motion='reduced'");
        for(const id of IDS){
          await run("document.querySelector('.nav-links [data-view=benefits]').click()");await settle();
          await run("document.querySelector('[data-benefit=\""+id+"\"]').click();document.getElementById('main')?.scrollTo(0,0);scrollTo(0,0)");await settle();
          const row={theme,width,height,id,...await run('('+measure.toString()+')()')};rows.push(row);
          // 물건과 위 줄은 2px, 큰 한글·한 줄 제목과는 8px 넘게 떨어져야 하고(가로로 겹치는 점만 잰다), 큰 한글은 한 줄이고 한 줄 제목에 닿지 않아야 한다(휴대폰 틀은 위아래로 7~9px).
          if(row.error||row.overflow||row.wrapped||(row.wordOut!==null&&row.wordOut>0)||(row.clash!==null&&row.clash<4)||(row.top!==null&&row.top<2)||(row.word!==null&&row.word<8)||(row.title!==null&&row.title<8))failed.push(row);
          // 숨은 창은 첫 capturePage가 앞 프레임을 돌려줄 수 있어 한 번 버리고 다시 찍는다(benefits-native-smoke와 같은 방식).
          if(SHOT_WIDTHS.has(width)){await window.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});await new Promise(resolve=>setTimeout(resolve,130));fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,theme+'-'+width+'-'+id+'.png'),(await window.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());}
        }
      }
      const report={ok:!failed.length&&!errors.length&&!requests.length,checkedOn:new Date().toISOString(),scope:'Hidden Electron launcher, six benefit detail heads at '+SIZES.map(s=>s.join('x')).join(', ')+' (night; day at shot widths). Synthetic account, outside requests blocked.',rows,failed,consoleErrors:errors,requests};
      process.stdout.write(prefix+JSON.stringify(report)+'\n');window.destroy();app.exit(report.ok?0:1);
    }catch(error){process.stdout.write(prefix+JSON.stringify({ok:false,error:error.message,rows,failed,consoleErrors:errors,requests})+'\n');window?.destroy();app.exit(1);}
  });
}
