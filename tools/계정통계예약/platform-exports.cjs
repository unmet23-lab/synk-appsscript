'use strict';
const path=require('node:path'),fs=require('node:fs'),crypto=require('node:crypto');
const {vkChartPage,vkChartRows}=require('./vk-chart.cjs');

async function threadsPage(p,args,driver){
  if(driver==='aside')await p.waitForLoadState('domcontentloaded');
  await p.waitForFunction(()=>document.body.innerText.includes('PDF로 내보내기'),null,{timeout:12000}).catch(()=>{});
  const info=await p.evaluate(handle=>({
    sourceUrl:location.origin+location.pathname,
    showsRange:document.body.innerText.includes('최근 30일'),
    owner:[...document.querySelectorAll('a[href]')].some(a=>a.pathname==='/@'+handle && (a.innerText||a.getAttribute('aria-label')||a.textContent).trim()==='프로필')
  }),args.handle);
  if(!info.owner||new URL(info.sourceUrl).origin!=='https://www.threads.com'||!/^\/insights\/?$/.test(new URL(info.sourceUrl).pathname))return {reason:'need_owner'};
  if(!info.showsRange)return {reason:'format'};
  const dl=p.waitForEvent('download',{timeout:20000}).then(value=>value,()=>null);
  if(driver==='ego')await p.click('text="PDF로 내보내기"',{label:'공식 통계 PDF 받기'});
  else await p.getByText('PDF로 내보내기',{exact:true}).click();
  const file=await dl;
  if(!file)return {reason:'retry'};
  const filename=file.suggestedFilename(),prefix='threads-insights-'+args.handle+'-';
  if(!filename.startsWith(prefix)||!/^\d{4}-\d\d-\d\d-\d{4}-\d\d-\d\d\.pdf$/.test(filename.slice(prefix.length)))return {reason:'format'};
  if(driver==='ego')await file.saveAs(args.file);
  return {...info,filename,downloadedFile:driver==='aside'?await file.path():null,observedAt:new Date().toISOString()};
}

async function vkPage(p,args){
  const ownerPath='/groups/dashboard/@'+args.handle;
  await p.waitForFunction(q=>[...document.querySelectorAll('a[href]')].some(a=>a.pathname===q),ownerPath,{timeout:10000}).catch(()=>{});
  const owner=await p.evaluate(q=>[...document.querySelectorAll('a[href]')].some(a=>a.pathname===q&&a.getClientRects().length),ownerPath);
  if(!owner)return {reason:'need_owner'};
  await p.click('loc=href:'+ownerPath,{label:'등록 커뮤니티 통계 열기'});
  const btn='button[aria-label="sboard_authors_cabinet_export_stats"]';
  await p.waitForFunction(s=>document.querySelector(s),btn,{timeout:12000}).catch(()=>{});
  const valid=await p.evaluate(({q,b})=>location.pathname===q&&Boolean(document.querySelector(b)),{q:ownerPath,b:btn});
  if(!valid)return {reason:'need_owner'};
  await p.click('loc=css:'+btn,{label:'공식 내보내기 열기'});
  const snap=await p.snapshot({scope:'full_page'}),ls=snap.split('\n'),i=ls.findIndex(l=>l.includes('dialog "Export statistics'));
  const ref=i>=0?ls.slice(i).find(l=>/combobox.*ref=/.test(l))?.match(/ref=(\d+)/)?.[1]:null;
  if(!ref)return {reason:'format'};
  await p.click('@'+ref,{label:'통계 파일 형식 고르기'});await p.snapshot();await p.click('loc=css:[role=option][value=csv]',{label:'CSV 형식 선택'});
  const exportState=({index,uncheck})=>{
    const node=[...document.querySelectorAll('[role=dialog]')].find(d=>d.getClientRects().length&&d.innerText.includes('Export statistics'));
    if(!node||!node.innerText.includes('Data types')||!Array.from(node.querySelectorAll('input')).some(e=>e.value==='CSV (.csv)'))return false;
    const checks=[...node.querySelectorAll('input[type=checkbox]')];
    if(checks.length!==3||!checks[0].checked)return false;
    if(index===0)return true;
    if(uncheck&&checks[index].checked)checks[index].click();
    return !checks[index].checked;
  };
  try{
    await p.waitForFunction(exportState,{index:0},{timeout:12000});
    for(const index of [1,2]){
      await p.evaluate(exportState,{index,uncheck:true});
      await p.waitForFunction(exportState,{index},{timeout:8000});
    }
  }catch{return {reason:'format'};}
  const selected=await p.evaluate(()=>{
    const node=[...document.querySelectorAll('[role=dialog]')].find(d=>d.getClientRects().length&&d.innerText.includes('Export statistics'));
    if(!node||!node.innerText.includes('Data types')||!node.innerText.includes('CSV (.csv)'))return null;
    const checks=[...node.querySelectorAll('input[type=checkbox]')];
    if(checks.length!==3||!checks[0].checked||checks.slice(1).some(b=>b.checked))return null;
    return [...node.querySelectorAll('input')].map(e=>e.value).filter(x=>/^\d\d\.\d\d\.\d{4}$/.test(x));
  });
  if(!selected||selected.length!==2)return {reason:'format'};
  const exportButton='[role="dialog"] button[type="button"][aria-busy="false"]';
  const ready=await p.evaluate(s=>{
    const buttons=[...document.querySelectorAll(s)].filter(b=>b.getClientRects().length);
    return buttons.length===1 && buttons[0].innerText.trim()==='Export' && !buttons[0].disabled;
  },exportButton);
  if(!ready)return {reason:'format'};
  const dl=p.waitForEvent('download',{timeout:60000}).then(f=>f,()=>null);
  await p.click('loc=css:'+exportButton,{label:'해당 커뮤니티의 공식 데이터 받기'});const f=await dl;
  if(!f)return {reason:'retry'};
  const filename=f.suggestedFilename(),m=filename.match(/^(\d+)_community_common_(\d{4}-\d\d-\d\d)_(\d{4}-\d\d-\d\d)\.csv$/);
  const dates=selected.map(x=>x.split('.').reverse().join('-'));
  if(!m||m[1]!==args.communityId||m[2]!==dates[0]||m[3]!==dates[1])return {reason:'format'};
  await f.saveAs(args.file);
  return {observedAt:new Date().toISOString(),sourceUrl:'https://vk.ru'+ownerPath,filename,range:dates};
}

async function rutubePage(p,args){
  await p.waitForFunction(()=>document.body.innerText.includes('Просмотры'),undefined,{timeout:13000}).catch(()=>{});
  const state=await p.evaluate(()=>({at:new Date().toISOString(),source:location.origin+location.pathname,
    lines:document.body.innerText.split('\n').map(x=>x.trim()).filter(Boolean),links:[...document.querySelectorAll('a[href*="/channel/"]')].filter(a=>a.getClientRects().length).map(a=>a.pathname)
  }));
  if(state.source!==args.entry)return {reason:'need_owner'};
  if(!state.links.includes('/channel/'+args.channelId+'/')){
    const snap=await p.snapshot({scope:'full_page'}),ls=snap.split('\n');
    const ix=ls.findIndex(l=>l.includes('image "'+args.name+'"'));const button=ix>0?ls[ix-1].match(/button.*ref=(\d+)/)?.[1]:null;
    if(!button)return {reason:'need_owner'};
    await p.click('@'+button,{label:'현재 통계 채널 번호 확인'});await p.snapshot();
    state.links=await p.evaluate(()=>[...document.querySelectorAll('a[href*="/channel/"]')].filter(a=>a.getClientRects().length).map(a=>a.pathname));
  }
  return state.links.includes('/channel/'+args.channelId+'/')?state:{reason:'need_owner'};
}
function rutubeRows(data){
  const months=['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
  const span=data.lines.find(s=>/\d+\s*[−–-]\s*\d+\s+[а-яё]+\.?\s+\d{4}/i.test(s));
  const m=span?.match(/^(\d{1,2})\s*[−–-]\s*(\d{1,2})\s+([а-яё]+)\.?\s+(\d{4})$/i),index=data.lines.indexOf('Просмотры');
  if(!m||index<0||!/^\d+$/.test(data.lines[index+1]))return [];
  const month=months.findIndex(q=>m[3].startsWith(q)),iso=day=>[m[4],String(month+1).padStart(2,'0'),day.padStart(2,'0')].join('-');
  if(month<0||+m[1]<1||+m[2]>31||+m[2]<+m[1]||!Number.isSafeInteger(Number(data.lines[index+1])))return [];
  return [{kind:'account-period',period:{start:iso(m[1]),end:iso(m[2])},metrics:{views:Number(data.lines[index+1])},labels:{screenTitle:'Студия RUTUBE',metricLabels:{views:'Просмотры'}}}];
}

async function otherOwner(ctx,helpers){
  const {account:a,profile,dir}=ctx,handle=String(a.handle||'').replace(/^@/,'');
  if(a.platform==='rutube'){
    const collectToDisk=helpers.collectPublic||require('./rutube-public.cjs').collectToDisk;
    // The endpoint only covers ordinary public videos. Studio supplies separately labeled whole-channel statistics.
    await collectToDisk(a.id,{directory:path.join(dir,'official-api')}).catch(()=>null);
    if(!profile.profileId||!profile.expectedName||!a.externalId)return 'need_owner';
    await ctx.setStage('creator-screen');
    const data=await helpers.pageJob(ctx,'rutube-studio',rutubePage,{entry:'https://studio.rutube.ru/analytics',channelId:String(a.externalId),name:profile.expectedName});
    if(!data||data.reason)return data?.reason||'retry';
    const rows=rutubeRows(data);if(!rows.length)return 'format';
    await helpers.storeBatch(ctx,'rutube-studio-verified',data,{identity:{accountId:a.id,externalId:a.externalId},sourceType:'creator-screen',sourceUrl:data.source,observedAt:data.at,observations:rows});
    return 'limited';
  }
  if(!['threads','vk'].includes(a.platform))return null;
  if(!(profile.browser==='aside'?profile.account:profile.profileId))return 'need_owner';
  if(!/^[\w.-]+$/.test(handle))return 'need_owner';
  const vk=a.platform==='vk';
  if(vk&&(!/^\d+$/.test(profile.communityId)||profile.browser!=='ego'||a.publicUrl!=='https://vk.ru/'+handle))return 'need_owner';
  if(vk){
    await ctx.setStage('creator-screen');
    const data=await helpers.pageJob(ctx,'vk-chart',vkChartPage,{entry:a.publicUrl,handle});
    if(data?.reason==='user_control'||data?.reason==='need_owner')return data.reason;
    const observations=vkChartRows(data,handle);
    if(observations.length){
      await helpers.storeBatch(ctx,'vk-daily-chart',data,{sourceType:'creator-screen',sourceUrl:data.source,observedAt:data.observedAt,identity:{accountId:a.id,handle},observations});
      return 'limited';
    }
  }
  await ctx.setStage('official-export');
  const f=vk?'vk.csv':'threads.pdf',target=path.join(dir,f);
  const result=await helpers.pageJob(ctx,'verified-export',vk?vkPage:threadsPage,{entry:vk?a.publicUrl:'https://www.threads.com/insights/',handle,file:target,communityId:profile.communityId});
  if(!result||result.reason)return result?.reason||'retry';
  if(result.downloadedFile){
    const stat=fs.lstatSync(result.downloadedFile);
    if(!stat.isFile()||stat.isSymbolicLink()||stat.size>10*1024*1024)return 'format';
    fs.copyFileSync(result.downloadedFile,target,fs.constants.COPYFILE_EXCL);
  }
  const raw=fs.readFileSync(target);if(!raw.length||raw.length>10*1024*1024)return 'format';
  const info={...result,accountId:a.id,handle,sourceType:'official-export',evidenceFile:f,evidenceSha256:crypto.createHash('sha256').update(raw).digest('hex')};
  delete info.downloadedFile;
  const meta=path.join(dir,'export-verified.json');fs.writeFileSync(meta,JSON.stringify(info),{flag:'wx'});
  const python=process.platform==='win32'?path.join(process.env.LOCALAPPDATA,'Python','pythoncore-3.14-64','python.exe'):'python3';
  const {stdout}=await helpers.external(python,['-X','utf8','-B',path.join(__dirname,'공식일별파일.py'),vk?'--vk-rows':'--threads-rows',meta],ctx.signal,25000);
  const envelope={sourceType:'official-export',sourceUrl:result.sourceUrl,observedAt:result.observedAt,evidenceSha256:info.evidenceSha256,identity:{accountId:a.id,handle},exportFormat:vk?'csv':'pdf',observations:JSON.parse(stdout)};
  if(!envelope.observations.length)return 'no_metrics';
  const manifest=path.join(dir,'export-verified.manifest.json');
  fs.writeFileSync(manifest,JSON.stringify({version:1,batches:[{accountId:a.id,evidenceFile:f,envelope}]}),{flag:'wx'});
  await ctx.submit(manifest);return 'limited';
}
module.exports={otherOwner,rutubeRows};

