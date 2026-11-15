'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {parseNaverDaily}=require('../lib/외부통계파싱.cjs');

function sameRoute(actual,expected){
  try {
    const u=new URL(actual), e=new URL(expected);
    return u.protocol==='https:'&&u.host===e.host&&u.pathname.replace(/\/$/,'')===e.pathname.replace(/\/$/,'')
      && [...e.searchParams].every(([k,v])=>u.searchParams.get(k)===v);
  }catch{return false;}
}

function readOwner(){
  const u=new URL(location.href);
  const source=new URL(u.pathname,u.origin);
  for(const k of ['asset_id','business_id','platform'])if(u.searchParams.has(k))source.searchParams.set(k,u.searchParams.get(k));
  const main=document.querySelector('main,[role=main]')||document.body;
  if(!main)return null;
  return {source:source.href,at:new Date().toISOString(),text:main.innerText.slice(0,24000),
    tables:[...main.querySelectorAll('table')].slice(0,4).map(t=>[...t.rows].slice(0,182).map(r=>[...r.cells].map(c=>c.innerText.trim())))};
}

function numbers(s){return /^\d{1,3}(,\d{3})*$|^\d+$/.test(s)&&Number.isSafeInteger(Number(s.replaceAll(',','')))?Number(s.replaceAll(',','')):null;}
function metaRows(snapshot,platform){
  const lines=snapshot.text.split('\n').map(x=>x.trim()).filter(Boolean);
  if(!lines.slice(0,14).includes(platform))return [];
  const picked=lines.find(s=>/^최근 \d+일:/.test(s));
  const r=picked?.match(/^최근 (\d+)일:\s*(\d{4})\.\s*(\d+)\.\s*(\d+)\.~\s*(\d{4})\.\s*(\d+)\.\s*(\d+)\./);
  if(!r)return [];
  const iso=(y,m,d)=>[y,m.padStart(2,'0'),d.padStart(2,'0')].join('-');
  const from=iso(...r.slice(2,5)),to=iso(...r.slice(5)),count=+r[1],out=new Map();
  if(!count||count>180)return [];
  const fmt=new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'America/Los_Angeles'});
  for(const [name,key] of platform==='Instagram'?[['조회수','views'],['도달','reach']]:[['조회수','views']]){
    const headings=lines.map((s,i)=>s==='내보내기'&&lines.slice(Math.max(0,i-2),i).includes(name)?i:-1).filter(i=>i>=0);
    if(headings.length!==1)continue;
    const start=headings[0],next=lines.indexOf('내보내기',start+1),slice=lines.slice(start,next<0?lines.length:next),ix=slice.findIndex(s=>s.startsWith('Primary\t'));
    if(ix<2)continue;
    const dates=slice[ix-1].split('\t').map(x=>/^\d{10}$/.test(x)?fmt.format(new Date(+x*1000)):null),vals=slice[ix].split('\t').slice(1).map(numbers);
    if(dates.length!==count||new Set(dates).size!==count||vals.length!==count||dates[0]!==from||dates.at(-1)!==to||dates.some((x,i)=>!x||(i&&Date.parse(x)-Date.parse(dates[i-1])!==86400000))||vals.includes(null))continue;
    if(key==='views'&&vals.reduce((a,b)=>a+b,0)!==numbers(slice[1]))continue;
    dates.forEach((day,i)=>{
      const row=out.get(day)||{kind:'account-period',period:{start:day,end:day},metrics:{},labels:{screenTitle:'Meta Business Suite '+platform+' 인사이트',timeZone:'America/Los_Angeles',metricLabels:{}}};
      row.metrics[key]=vals[i];row.labels.metricLabels[key]=name;out.set(day,row);
    });
  }
  return [...out.values()];
}
function kakaoRows(snapshot){
  const table=(snapshot.tables||[]).find(t=>t[0]?.join('|')==='날짜|방문자수|조회수');
  if(!table?.length)return [];
  const seen=new Set(),out=[];
  for(const [date,visitors,views] of table.slice(1)){
    if(!/^\d{4}\.\d{2}\.\d{2}$/.test(date)||numbers(visitors)===null||numbers(views)===null)return [];
    const day=date.replaceAll('.','-');
    if(seen.has(day)||day>=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(snapshot.at)))continue;
    seen.add(day);out.push({kind:'account-period',period:{start:day,end:day},metrics:{views:numbers(views),visitors:numbers(visitors)}});
  }
  return out;
}

async function naverExport(ctx,helpers){
  const {account:a,profile,dir}=ctx;
  if(profile.browser!=='aside'||!profile.account)return 'need_owner';
  const handle=String(a.handle||'').replace(/^@/,'');
  if(!/^[a-z0-9_-]+$/.test(handle))return 'need_owner';
  const url='https://admin.blog.naver.com/'+handle+'/stat/download',target=path.join(dir,'daily.xlsx');
  await ctx.setStage('official-export');
  const source=[
    'const began=Date.now();const mark=s=>console.log("SYNK_STEP "+s+" "+(Date.now()-began));mark("open");const page=await openTab('+JSON.stringify(url)+');try{await page.waitForLoadState("domcontentloaded");mark("owner");',
    'const atUrl=await page.evaluate(()=>location.origin+location.pathname);if(atUrl!=='+JSON.stringify(url)+')throw Error("SYNK_OWNER");',
    'mark("controls");let ref;for(let i=0;i<8&&!ref;i++){const s=(await snapshot(page,{interactive:true})).tree;const links=s.split("\\n").filter(l=>/link "지표 다운로드"/.test(l)&&/ref=f\\d+e\\d+/.test(l));if(links.length===1&&/radio "조회수".*\\[checked\\]/.test(s))ref=links[0].match(/ref=(f\\d+e\\d+)/)[1];else await page.waitForTimeout(500);}',
    'if(!ref)throw Error("SYNK_FORMAT");mark("click");const dl=page.waitForEvent("download",{timeout:20000}).then(f=>({f}),()=>({}));await page.locator(ref).click();const {f}=await dl;if(!f)throw Error("DOWNLOAD_TIMEOUT");mark("download");if(!f.suggestedFilename().endsWith(".xlsx"))throw Error("SYNK_FORMAT");',
    'console.log("SYNK_METRICS "+JSON.stringify({observedAt:new Date().toISOString(),sourceUrl:atUrl,downloadedFile:await f.path()}));}finally{await page.close();}'
  ].join('\n');
  const meta=await getNaverDownload(ctx,helpers.aside,source,url,target);
  const raw=fs.readFileSync(target);
  const python=process.platform==='win32'?path.join(process.env.LOCALAPPDATA,'Python','pythoncore-3.14-64','python.exe'):'python3';
  const {stdout}=await helpers.external(python,['-X','utf8','-B',path.join(__dirname,'공식일별파일.py'),'--naver-sheet',target],ctx.signal,25000);
  const {envelope}=parseNaverDaily(JSON.parse(stdout),{accountId:a.id,handle},meta.observedAt);
  envelope.evidenceSha256=createHash('sha256').update(raw).digest('hex');
  const manifest=path.join(dir,'naver.manifest.json');
  fs.writeFileSync(manifest,JSON.stringify({version:1,batches:[{accountId:a.id,evidenceFile:path.basename(target),envelope}]}),{flag:'wx'});
  await ctx.submit(manifest);
  return 'limited';
}
async function getNaverDownload(ctx,runAside,source,url,target){
  for(let attempt=1;attempt<=2;attempt++){
    const started=Date.now();
    try{
      const meta=await runAside(ctx,'naver-export-'+attempt,source);
      if(!meta||!meta.downloadedFile)throw Object.assign(Error('Missing download event'),{code:'NO_DOWNLOAD'});
      if(!sameRoute(meta.sourceUrl,url))throw Error('SYNK_OWNER');
      const saved=fs.lstatSync(meta.downloadedFile);
      if(!saved.isFile()||saved.isSymbolicLink()||saved.size<1||saved.size>10*1024*1024)throw Error('SYNK_FORMAT');
      fs.copyFileSync(meta.downloadedFile,target,fs.constants.COPYFILE_EXCL);
      return meta;
    }catch(error){
      const why=String(error.message),permanent=/SYNK_OWNER|SYNK_FORMAT|user control|handed.off|requires human/i.test(why);
      const code=permanent?(why.includes('SYNK_OWNER')?'owner':why.includes('SYNK_FORMAT')?'format':'user_control'):
        String(error.code||'ASIDE_TRANSPORT').replace(/[^A-Za-z0-9_-]/g,'').slice(0,40);
      const timing={elapsedMs:Date.now()-started};
      if(error.phase)timing.phase=error.phase;
      if(error.events?.length)timing.events=error.events;
      fs.writeFileSync(path.join(ctx.dir,'naver-attempt-'+attempt+'.json'),JSON.stringify({attempt,code,at:new Date().toISOString(),timing}),{flag:'wx'});
      if(permanent||ctx.signal.aborted||attempt===2||fs.existsSync(target))throw error;
    }
  }
}

async function ownerCapture(ctx,helpers){
  const {account:a,profile}=ctx;
  if(['naver-blog','naverblog'].includes(a.platform))return naverExport(ctx,helpers);
  if(['vk','threads','rutube'].includes(a.platform))return require('./platform-exports.cjs').otherOwner(ctx,helpers);
  if(a.platform==='linkedin')return require('./verified-owner.cjs').verifiedOwner(ctx,helpers);
  const isMeta=['facebook','instagram'].includes(a.platform);
  if(!isMeta&&a.platform!=='kakao-channel')return null;
  const url=profile.analyticsUrl||profile.creatorUrl;
  if(!url)return null;
  const u=new URL(url);
  if(isMeta){
    if(u.origin!=='https://business.facebook.com'||u.pathname!=='/latest/insights/results')return null;
    const asset=a.platform==='facebook'?a.externalId:profile.businessAssetId;
    if(!asset||u.searchParams.get('asset_id')!==String(asset)||(u.searchParams.get('platform')||'Facebook')!==(a.platform==='facebook'?'Facebook':'Instagram'))return 'need_owner';
  }else{
    const slug=new URL(a.publicUrl).pathname.split('/').filter(Boolean).at(-1);
    if(u.origin!=='https://business.kakao.com'||!/^\/space\/\d+\/channel\/[^/]+\/statistics\/post$/.test(u.pathname)||u.pathname.split('/')[4]!==slug)return 'need_owner';
  }
  await ctx.setStage('creator-screen');
  const snapshot=await helpers.read(ctx,url,readOwner,'owner-charts',isMeta?'Primary':'방문자수');
  if(!snapshot||!sameRoute(snapshot.source,url))return 'need_owner';
  const observations=isMeta?metaRows(snapshot,a.platform==='instagram'?'Instagram':'Facebook'):kakaoRows(snapshot);
  if(!observations.length)return 'format';
  const identity=a.externalId?{accountId:a.id,externalId:a.externalId}:{accountId:a.id,handle:a.handle};
  await helpers.storeBatch(ctx,'owner-verified',snapshot,{sourceType:'creator-screen',sourceUrl:snapshot.source,identity,observedAt:snapshot.at,observations});
  return 'limited';
}
module.exports={ownerCapture,metaRows,kakaoRows,sameRoute,getNaverDownload};

