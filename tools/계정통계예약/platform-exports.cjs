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
  const read=()=>p.evaluate(()=>{
    const visible=e=>e.getClientRects().length>0;
    const card=[...document.querySelectorAll('article')].find(a=>visible(a)&&
      a.querySelector('[class*="headerTitleText__analytics-chart-header"]')?.textContent.trim()==='Просмотры');
    const dates=[...document.querySelectorAll('h3')].filter(visible).map(h=>h.textContent.trim()).filter(t=>/^\d{1,2}\s.*\d{4}$/.test(t));
    return {at:new Date().toISOString(),source:location.origin+location.pathname,
      periodText:dates.length===1?dates[0]:null,
      metric:card?{label:'Просмотры',value:card.querySelector('h2')?.innerText.trim()}:null,
      links:[...document.querySelectorAll('a[href*="/channel/"]')].filter(visible).map(a=>a.pathname)};
  });
  // Studio renders chart widgets individually. The popular-videos and lifetime panels also contain a views label.
  await p.waitForFunction(()=>[...document.querySelectorAll('article')].some(a=>a.getClientRects().length&&
    a.querySelector('[class*="headerTitleText__analytics-chart-header"]')?.textContent.trim()==='Просмотры'&&
    a.querySelector('h2')?.innerText.trim()),undefined,{timeout:18000}).catch(()=>{});
  let state=await read();
  if(state.source!==args.entry)return {reason:'need_owner'};
  const owner='/channel/'+args.channelId+'/';
  if(!state.links.includes(owner)){
    const snap=await p.snapshot({scope:'full_page'}),ls=snap.split('\n');
    const ix=ls.findIndex(l=>l.includes('image "'+args.name+'"'));const button=ix>0?ls[ix-1].match(/button.*ref=(\d+)/)?.[1]:null;
    if(!button)return {reason:'need_owner'};
    await p.click('@'+button,{label:'현재 통계 채널 번호 확인'});
    await p.waitForFunction(path=>[...document.querySelectorAll('a[href*="/channel/"]')].some(a=>a.getClientRects().length&&a.pathname===path),owner,{timeout:3500}).catch(()=>{});
    state=await read();
  }
  return state.source===args.entry&&state.links.includes(owner)?state:{reason:'need_owner'};
}
function rutubeRows(data){
  const months=[/^янв/,/^фев/,/^мар/,/^апр/,/^ма[йя]$/, /^июн/,/^июл/,/^авг/,/^сен/,/^окт/,/^ноя/,/^дек/];
  const span=/^(\d{1,2})(?:\s+([а-яё]+)\.?(?:\s+(\d{4}))?)?\s*[−–—-]\s*(\d{1,2})\s+([а-яё]+)\.?\s+(\d{4})$/i.exec(data.periodText||'');
  const value=data.metric?.value;
  if(!span||data.metric?.label!=='Просмотры'||typeof value!=='string'||!/^(?:\d+|\d{1,3}(?:[ \u00a0\u202f]\d{3})+)$/.test(value))return [];
  const views=Number(value.replace(/\s/g,''));
  const monthOf=name=>months.findIndex(m=>m.test(name.toLowerCase()))+1;
  const monthEnd=monthOf(span[5]),monthStart=span[2]?monthOf(span[2]):monthEnd;
  const yearEnd=Number(span[6]),yearStart=span[3]?Number(span[3]):yearEnd-Number(monthStart>monthEnd);
  const iso=(year,month,day)=>{
    const date=new Date(Date.UTC(year,month-1,Number(day)));
    if(date.getUTCMonth()!==month-1||date.getUTCDate()!==Number(day))return null;
    return date.toISOString().slice(0,10);
  };
  if(!monthStart||!monthEnd||!Number.isSafeInteger(views))return [];
  const start=iso(yearStart,monthStart,span[1]),end=iso(yearEnd,monthEnd,span[4]);
  if(!start||!end||start>end)return [];
  return [{kind:'account-period',period:{start,end},metrics:{views},labels:{screenTitle:'Студия RUTUBE',metricLabels:{views:'Просмотры'},periodLabel:data.periodText,timeZone:'Europe/Moscow'}}];
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

