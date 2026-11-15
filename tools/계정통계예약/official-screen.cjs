'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const exec=promisify(execFile);

// Executed by the designated Ego profile. The live "Me" link must identify the registered owner before reading manager data.
async function readRednote(p, account, profile) {
  const id=profile.expectedExternalId;
  if(!/^[a-f0-9]{24}$/.test(id)||!profile.observedName)return {reason:'need_owner'};
  await p.goto('https://www.rednote.com/user/profile/'+id,{waitUntil:'domcontentloaded',timeout:28000});
  await p.snapshot();
  await p.waitForFunction(()=>[...document.querySelectorAll('a[href*="/user/profile/"]')].some(a=>/^(我|我的|Me|나)$/.test(a.innerText.trim())),undefined,{timeout:12000}).catch(()=>{});
  const owner=await p.evaluate(()=>[...document.querySelectorAll('a[href*="/user/profile/"]')].find(a=>/^(我|我的|Me|나)$/.test(a.innerText.trim()))?.pathname.split('/').pop());
  if(owner!==id)return {reason:'need_owner'};
  await p.goto('https://creator.rednote.com/new/note-manager',{waitUntil:'domcontentloaded',timeout:28000});
  await p.snapshot();
  await p.waitForFunction(()=>document.querySelector('.note-card')||/暂无笔记|还没有发布笔记/.test(document.body.innerText),undefined,{timeout:18000}).catch(()=>{});
  const meta=await p.evaluate(()=>({name:document.body.innerText.match(/小红薯[A-F0-9]+/)?.[0],total:document.body.innerText.match(/全部\s*(\d+)/)?.[1]}));
  if(meta.name!==profile.observedName)return {reason:'need_owner'};
  const total=Number(meta.total);
  if(total===0)return {reason:await p.evaluate(()=>/暂无笔记|还没有发布笔记/.test(document.body.innerText))?'no_posts':'retry'};
  if(!Number.isSafeInteger(total)||total>200)return {reason:'format',at:'total',total:meta.total};
  for(let i=0;i<15;i++){
    const count=await p.evaluate(()=>document.querySelectorAll('.note-card').length);
    if(count===total)break;
    await p.evaluate(()=>{const last=[...document.querySelectorAll('.note-card')].at(-1);last?.scrollIntoView({block:'end'});let c=last?.parentElement;while(c&&c!==document.body){if(c.scrollHeight>c.clientHeight+20&&/auto|scroll/.test(getComputedStyle(c).overflowY)){c.scrollTo(0,c.scrollHeight);break;}c=c.parentElement;}});
    const point=await p.evaluate(()=>{const box=document.querySelector('.content')?.getBoundingClientRect();return box&&{x:box.x+box.width*.7,y:box.y+box.height*.76};});
    if(point){
      await p.mouse.move(point.x,point.y,{label:'게시물 목록 확인'});
      await p.mouse.wheel(0,-720,{label:'이전 게시물 구간 확인'});
      await p.mouse.wheel(0,1600,{label:'다음 게시물 불러오기'});
    }
    await p.waitForFunction(n=>document.querySelectorAll('.note-card').length>n,count,{timeout:5000}).catch(()=>{});
    if(await p.evaluate(()=>document.querySelectorAll('.note-card').length)<=count)return {reason:'format',at:'pagination',count,total};
  }
  const x=await p.evaluate(()=>({observedAt:new Date().toISOString(),sourceUrl:location.origin+location.pathname,accountName:document.body.innerText.match(/小红薯[A-F0-9]+/)?.[0],expectedCount:Number(document.body.innerText.match(/全部\s*(\d+)/)?.[1]),
    rows:[...document.querySelectorAll('.note-card')].map(n=>({noteId:JSON.parse(n.getAttribute('data-impression')||'{}')?.noteTarget?.value?.noteId,title:n.querySelector('.note-card__title')?.textContent,text:n.innerText,metrics:[...n.querySelectorAll('.note-card__stat')].map(m=>m.textContent.trim())}))}));
  if(x.rows.length!==total||x.accountName!==meta.name)return {reason:'format',at:'end',count:x.rows.length,total};
  return {evidence:{...x,paginationComplete:true,profileId:owner}};
}

async function exportScreen(p,account,profile,file) {
  // Keep the download tied to this specific page event and this request's private directory.
  let range,observedHandle,sourceUrl,selector,format;
  const isDouyin=account.platform==='douyin';
  if(isDouyin){
    await p.goto('https://creator.douyin.com/creator-micro/home',{waitUntil:'domcontentloaded',timeout:28000});await p.snapshot();
    await p.waitForFunction(v=>document.body.innerText.includes(v),account.handle,{timeout:14000}).catch(()=>{});
    observedHandle=await p.evaluate(()=>document.body.innerText.match(/(?:抖音号|账号)\s*[:：]?\s*(\d{6,})/)?.[1]||null);
    if(observedHandle!==account.handle)return {reason:'need_owner'};
    sourceUrl='https://creator.douyin.com/creator-micro/data-center/operation';
    await p.goto(sourceUrl,{waitUntil:'domcontentloaded',timeout:28000});await p.snapshot();
    await p.waitForFunction(()=>document.body.innerText.includes('总播放量'),undefined,{timeout:14000}).catch(()=>{});
    const data=await p.evaluate(()=>{
      const block=document.body.innerText.split('作品数据').at(-1).split('粉丝数据')[0];
      const range=block.match(/统计周期[：:]\s*(\d{4}-\d\d-\d\d)\s*至\s*(\d{4}-\d\d-\d\d)/);
      const buttons=[...document.querySelectorAll('button')].filter(e=>e.getClientRects().length&&e.innerText.trim()==='导出数据');
      const candidate=buttons.find(b=>{for(let e=b;e&&e!==document.body;e=e.parentElement){if(e.innerText.includes('总播放量'))return !e.innerText.includes('吸粉量')&&e.querySelectorAll('button').length<25;}return false;});
      if(!candidate||!range)return null;
      const index=[...document.querySelectorAll('button')].indexOf(candidate);
      return {range:range.slice(1),index};
    });
    if(!data)return {reason:'format'};
    range=data.range;selector='loc=css:button >> nth='+data.index;format='douyin-posts';
  } else {
    if(!/^[a-z0-9-]+\.substack\.com$/.test(account.handle))return {reason:'need_owner'};
    sourceUrl='https://'+account.handle+'/publish/stats/traffic';
    await p.goto(sourceUrl,{waitUntil:'domcontentloaded',timeout:28000});await p.snapshot();
    await p.waitForFunction(()=>document.querySelector('input[type=date]')&&document.querySelector('[aria-label=Ellipsis]'),undefined,{timeout:14000}).catch(()=>{});
    const data=await p.evaluate(()=>{
      const chart=/선택한 기간 동안 이메일을 포함해 Substack이 조회된 횟수|[Vv]iews.*including email|including email.*[Vv]iews/;
      const buttons=[...document.querySelectorAll('button[aria-label=Ellipsis]')];
      const owned=buttons.filter(b=>{for(let e=b;e&&e!==document.body;e=e.parentElement){if(chart.test(e.innerText))return e.querySelectorAll('[aria-label=Ellipsis]').length===1;}return false;});
      return {range:[...document.querySelectorAll('input[type=date]')].map(e=>e.value),url:location.origin+location.pathname,owner:location.hostname,index:buttons.indexOf(owned[0]),count:owned.length};
    });
    if(data.url!==sourceUrl)return {reason:'need_owner'};
    if(data.count!==1||data.range.length!==2)return {reason:'format',at:'chart',data};
    observedHandle=data.owner;range=data.range;format='substack-traffic';
    await p.click('loc=css:button[aria-label=Ellipsis] >> nth='+data.index,{label:'트래픽 차트 메뉴 열기'});
    const downloadLabels=['CSV 다운로드','Download CSV','Download as CSV','Export CSV'];
    await p.waitForFunction(labels=>[...document.querySelectorAll('[role=menuitem]')].some(e=>e.getClientRects().length && labels.includes(e.innerText.trim())),
      downloadLabels,{timeout:8000}).catch(()=>{});
    const labels=await p.evaluate(()=>[...document.querySelectorAll('[role=menuitem]')].filter(e=>e.getClientRects().length).map(e=>e.innerText.trim()));
    const matches=labels.filter(label=>downloadLabels.includes(label));
    if(matches.length!==1)return {reason:'format',at:'download-menu',labels};
    selector='loc=role:menuitem[name="'+matches[0]+'"]';
  }
  if(range.some(x=>!/^\d{4}-\d\d-\d\d$/.test(x)))return {reason:'format'};
  const download=p.waitForEvent('download',{timeout:20000}).then(value=>({value}),()=>({}));
  if(isDouyin){
    const index=Number(selector.split('=').at(-1));
    await p.evaluate(i=>{const b=document.querySelectorAll('button')[i];if(!b||b.disabled||b.innerText.trim()!=='导出数据')throw Error('Export control changed');b.click();},index);
  }else await p.click(selector,{label:'공식 통계 파일 받기'});
  const {value}=await download;
  if(!value)return {reason:'retry'};
  const filename=value.suggestedFilename();
  if(isDouyin?!/短视频全量指标\.xlsx$/.test(filename):!/traffic.*\.csv$/i.test(filename))return {reason:'format'};
  await value.saveAs(file);
  const observedAt=new Date().toISOString();
  const yesterday=new Date(Date.parse(observedAt)-86400_000).toISOString().slice(0,10);
  return {meta:{format,accountId:account.id,observedHandle,sourceUrl,observedAt,start:range[0],end:range[1],completeThrough:range[1]<yesterday?range[1]:yesterday}};
}

async function officialScreen(ctx,id,{egoRound,storeBatch,parseXhs}) {
  const {account,profile,dir,signal}=ctx;
  const xhs=account.platform==='xiaohongshu';
  await ctx.setStage('creator-screen');
  const out=path.join(dir,'owner-result.json'),file=path.join(dir,'official-data.'+(account.platform==='substack'?'csv':'xlsx'));
  const call='const fs=await import("node:fs/promises");const p=(await taskSpace('+JSON.stringify(id)+')).page("p1");const result=await ('+(xhs?readRednote:exportScreen).toString()+')(p,'+JSON.stringify({platform:account.platform,id:account.id,handle:account.handle})+','+JSON.stringify({observedName:profile.observedName,expectedExternalId:profile.expectedExternalId})+','+JSON.stringify(file)+');await fs.writeFile('+JSON.stringify(out)+',JSON.stringify(result),{flag:"wx"});';
  if(!xhs)await ctx.setStage('official-export');
  await egoRound(dir,'read-official',call,signal);
  const result=JSON.parse(fs.readFileSync(out,'utf8'));
  if(result.reason)return {more:false,reason:result.reason};
  if(xhs){
    const parsed=parseXhs(result.evidence,{accountId:account.id,expectedAccountName:profile.observedName,externalId:profile.expectedExternalId});
    if(parsed.envelope.observations.length)await storeBatch(ctx,'rednote-creator',result.evidence,parsed.envelope);
  }else{
    const meta=path.join(dir,'export-metadata.json');
    const digest=createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    fs.writeFileSync(meta,JSON.stringify({...result.meta,evidenceFile:path.basename(file),evidenceSha256:digest}),{flag:'wx'});
    const python=process.platform==='win32'?path.join(process.env.LOCALAPPDATA,'Python','pythoncore-3.14-64','python.exe'):'python3';
    const {stdout}=await exec(python,['-X','utf8','-B',path.join(__dirname,'공식일별파일.py'),meta],{windowsHide:true,signal,timeout:30000,maxBuffer:1024*1024});
    const manifest=path.join(dir,'official.manifest.json');
    fs.writeFileSync(manifest,stdout,{flag:'wx'});await ctx.submit(manifest);
  }
  return {more:false,reason:'limited'};
}
module.exports={officialScreen,readRednote,exportScreen};

