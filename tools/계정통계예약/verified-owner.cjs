'use strict';

// The page is opened in the account's assigned profile by pageJob.
async function readLinkedIn(page, {entry, analytics, personal}) {
  const route = url => decodeURI(new URL(url).pathname).replace(/\/$/, '');
  if (personal) {
    await page.waitForFunction(() => {
      const paths = Array.from(document.links, a => a.pathname);
      return paths.some(path => path.endsWith('/edit/intro/')) && paths.includes('/analytics/creator/content/');
    }, undefined, {timeout:15000}).catch(() => {});
    const ownerLinks = await page.evaluate(() => [...document.links].map(a => a.pathname));
    if (route(await page.url()) !== route(entry) || !ownerLinks.some(link => decodeURI(link) === route(entry) + '/edit/intro/')) throw Error('SYNK_OWNER');
    if (!ownerLinks.includes('/analytics/creator/content/')) throw Error('SYNK_OWNER');
    await page.goto(analytics);
  }
  await page.waitForFunction(isPersonal => {
    const text = (document.querySelector('[aria-label="주요 콘텐츠"]') || document.querySelector('main'))?.innerText || '';
    if (!isPersonal) return /하이라이트/.test(text) && /댓글/.test(text) && /통계/.test(text);
    return text.includes('UTC') && text.includes('저장수') &&
      Array.from(document.querySelectorAll('[aria-label]'), node => [node.getAttribute('aria-label'), node.textContent].join(' '))
        .some(label => label.includes('X axis displaying Time') && label.includes('Data ranges from'));
  }, personal, {timeout:18000}).catch(() => {});
  const data = await page.evaluate(() => ({
    at:new Date().toISOString(), url:location.origin + location.pathname,
    text:(document.querySelector('[aria-label="주요 콘텐츠"]') || document.querySelector('main'))?.innerText || '',
    chartText:[...document.querySelectorAll('[aria-label]')].map(n => [n.getAttribute('aria-label'), n.textContent].join(' ')).find(v => v.includes('X axis displaying Time') && v.includes('Data ranges from')) || ''
  }));
  if (new URL(data.url).origin !== 'https://www.linkedin.com' || route(data.url) !== route(analytics)) throw Error('SYNK_OWNER');
  return data;
}

function linkedinPeriod(snapshot, personal) {
  const lines=snapshot.text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const number=s=>/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(s || '') && Number.isSafeInteger(Number(s.replaceAll(',',''))) ? Number(s.replaceAll(',','')) : null;
  const metrics={}, metricLabels={};
  function add(key,label,text) {
    const value=number(text);
    if(value!==null){metrics[key]=value;metricLabels[key]=label;}
  }
  let start,end;
  if(personal){
    const dates=/Data ranges from (\d{4}-\d{2}-\d{2}) [\d:]+ to (\d{4}-\d{2}-\d{2})/.exec(snapshot.chartText);
    if(!dates || !lines.some(l=>l.includes('UTC')))return null;
    [,start,end]=dates;
    const cumulative=lines.indexOf('누적');
    if(cumulative>=0 && lines[cumulative+2]==='노출수')add('impressions','노출수',lines[cumulative+1]);
    const section=lines.slice(lines.indexOf('참여')+1);
    for(const [key,label] of [['comments','댓글'],['saves','저장수']]){
      const index=section.indexOf(label);
      if(index>=0) add(key,label,section[index+1]);
    }
  }else{
    const dates=lines.map(s=>/^(\d{4})년 (\d{1,2})월 (\d{1,2})일\s*[-–~]\s*(\d{4})년 (\d{1,2})월 (\d{1,2})일$/.exec(s)).find(Boolean);
    if(!dates)return null;
    const date=i=>[dates[i],dates[i+1].padStart(2,'0'),dates[i+2].padStart(2,'0')].join('-');
    start=date(1);end=date(4);
    const from=lines.indexOf('하이라이트'),to=lines.indexOf('통계',from+1);
    if(from<0 || to<0)return null;
    const highlights=lines.slice(from+1,to);
    for(const [key,label] of [['impressions','노출'],['comments','댓글']]){
      const i=highlights.indexOf(label);
      if(i>0)add(key,label,highlights[i-1]);
    }
  }
  if(!Object.keys(metrics).length || end<start)return null;
  return {kind:'account-period',period:{start,end},metrics,labels:{metricLabels,...(personal?{timeZone:'UTC'}:{})}};
}

async function verifiedOwner(ctx, {pageJob,storeBatch}) {
  const a=ctx.account;
  if(a.platform!=='linkedin' || !a.publicUrl || !ctx.profile.profileId && !ctx.profile.account)return null;
  const publicUrl=new URL(a.publicUrl),personal=publicUrl.pathname.startsWith('/in/');
  if(publicUrl.origin!=='https://www.linkedin.com' || !personal && !/^\d+$/.test(a.externalId || ''))return null;
  const analytics=personal?'https://www.linkedin.com/analytics/creator/content/':'https://www.linkedin.com/company/'+a.externalId+'/admin/analytics/updates/';
  await ctx.setStage('creator-screen');
  const source=await pageJob(ctx,'linkedin-owner',readLinkedIn,{entry:personal?publicUrl.href:analytics,analytics,personal});
  const row=source && linkedinPeriod(source,personal);
  if(!row)return 'format';
  const identity=personal?{accountId:a.id,handle:a.handle}:{accountId:a.id,externalId:a.externalId};
  const evidence={observedAt:source.at,sourceUrl:source.url,identity,
    text:source.text.split(personal?'주요 이용자통계':'콘텐츠 참여')[0],chartText:source.chartText.slice(0,1600)};
  await storeBatch(ctx,'linkedin-verified',evidence,{sourceType:'creator-screen',sourceUrl:source.url,observedAt:source.at,identity,observations:[row]});
  return 'limited';
}
module.exports={verifiedOwner,linkedinPeriod};

