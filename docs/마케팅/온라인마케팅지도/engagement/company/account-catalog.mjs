import {readFileSync} from 'node:fs';
import {PLATFORM_CAPABILITIES} from './collectors.mjs';

export const accountCatalog=JSON.parse(readFileSync(new URL('./account-catalog.json',import.meta.url),'utf8'));
export const MANAGED_ACCOUNT_STATUSES=Object.freeze(['operating','operating-contact','confirmed-expansion']);
const managed=new Set(MANAGED_ACCOUNT_STATUSES);
// 원장 플랫폼 별칭(11-14): naverblog와 naver-blog는 같은 네이버 블로그다. 비교만 이 열쇠로 하고 원장 값은 바꾸지 않는다.
const PLATFORM_ALIASES=Object.freeze({naverblog:'naver-blog'});
export const platformKey=value=>{const key=String(value||'').trim().toLowerCase();return PLATFORM_ALIASES[key]||key;};
const handle=value=>String(value||'').trim().toLowerCase().replace(/^@/,'');
const url=value=>{try{const u=new URL(value);return u.hostname.toLowerCase().replace(/^www\./,'')+decodeURIComponent(u.pathname).replace(/\/+$/,'').toLowerCase()+(u.pathname==='/profile.php'?'?id='+u.searchParams.get('id'):'');}catch{return null;}};
export const accountAddressKey=value=>url(value);

// Facebook 공개 프로필 번호(11-15): 주소로 등록한 옛 Facebook 채널은 등록 주소 profile.php?id=<번호>의 공개 프로필 번호를 externalId로 저장했다. 원장 externalId는 Business Suite(Graph) 페이지 번호라서 이 둘이 다를 수 있다.
// 이 차이는 원장 계정 하나씩 따로 본다. 채널 저장 번호가 채널 등록 주소의 공개 프로필 번호와 같고 그 원장 행의 공개 주소도 같은 번호를 가리킬 때만 충돌로 보지 않는다(https 공식 호스트의 /profile.php, 숫자 id). legacyId나 handle만으로는 넘기지 않고, 두 번호가 같으면 보통의 번호 일치다.
export function facebookLegacyPublicId(channel,account){
  if(platformKey(channel?.platform)!=='facebook'||platformKey(account?.platform)!=='facebook'||typeof channel.externalId!=='string'||!channel.externalId||typeof account.externalId!=='string'||!account.externalId||channel.externalId===account.externalId)return null;
  const profile=value=>{try{const u=new URL(value),id=u.searchParams.get('id');return u.protocol==='https:'&&['facebook.com','www.facebook.com','m.facebook.com'].includes(u.hostname.toLowerCase())&&u.pathname==='/profile.php'&&/^\d{1,30}$/.test(id||'')?id:null;}catch{return null;}};return profile(channel.canonicalUrl||channel.publicUrl)===channel.externalId&&profile(account.publicUrl)===channel.externalId?channel.externalId:null;
}
export function matchAccount(channel,catalog=accountCatalog){
  const conflict=a=>!!(a.externalId&&channel.externalId&&a.externalId!==channel.externalId)&&!facebookLegacyPublicId(channel,a);
  const rows=catalog.accounts.filter(a=>managed.has(a.accountStatus)&&platformKey(a.platform)===platformKey(channel.platform)&&!conflict(a));
  const unique=matches=>matches.length===1?matches[0]:null;
  const exact=channel.externalId&&unique(rows.filter(a=>a.externalId&&a.externalId===channel.externalId));
  if(exact)return exact;
  const legacy=channel.legacyId&&rows.find(a=>a.id===channel.legacyId&&!conflict(a));
  if(legacy)return legacy;
  const address=url(channel.canonicalUrl||channel.publicUrl);
  if(address){const matched=unique(rows.filter(a=>url(a.publicUrl)===address));if(matched)return matched;}
  // 주소로도 못 찾으면 handle로 찾는다. 번호가 어긋난 원장 계정은 위 rows에서 이미 빠졌다.
  const name=handle(channel.handle);
  return name?unique(rows.filter(a=>handle(a.handle)===name)):null;
}

export function classifiedChannel(channel,catalog=accountCatalog){
  const a=matchAccount(channel,catalog);
  return {...channel,accountId:a?.id||null,business:a?.business||'UNASSIGNED',secondaryBusinesses:a?.secondaryBusinesses||[],contentTrack:a?.contentTrack||null,
    country:a?.countryCode||channel.country||'',purpose:a?.purpose||null};
}

export function buildAccountMap({channels=[],jobs=[],collection={},digest=null,now=new Date().toISOString(),catalog=accountCatalog}={}){
  const stamp=Date.parse(now), matched=new Map();
  for(const c of channels){const a=matchAccount(c,catalog);if(a&&!matched.has(a.id))matched.set(a.id,c);}
  const health=new Map((collection.items||[]).map(i=>[i.channelId,i]));
  const repo=new Map((digest?.accountMap?.accounts||[]).map(a=>[a.id,a]));
  const jobsById=new Map(jobs.map(j=>[j.id,j]));
  const accounts=catalog.accounts.map(a=>{
    const c=matched.get(a.id),observed=repo.get(a.id),cap=PLATFORM_CAPABILITIES.find(p=>p.id===a.platform);
    const records=new Map();
    for(const r of observed?.operations?.publication?.receipts||[]){
      if(r.jobId&&jobsById.has(r.jobId))continue; // Server cancellation/publication wins.
      records.set(r.jobId||r.url||r.episode+'|'+r.at,{...r});
    }
    for(const j of jobs.filter(j=>j.channelId===c?.id)){
      if(!['published','scheduled','unknown','manual','missed'].includes(j.status))continue;
      records.set(j.id,{state:j.status==='published'?'게시됨':j.status==='scheduled'?'예약됨':'확인 필요',at:j.publishedAt||j.scheduledAt,url:j.publicationUrl||null});
    }
    const seen=new Set(),receipts=[...records.values()].filter(r=>{if(!r.url)return true;if(seen.has(r.url))return false;seen.add(r.url);return true;});
    const published=receipts.filter(r=>r.state==='게시됨');
    const scheduled=receipts.filter(r=>['예약됨','승인 대기'].includes(r.state)&&Date.parse(r.at)>stamp);
    const pending=receipts.filter(r=>r.state==='확인 필요'||['예약됨','승인 대기'].includes(r.state)&&!(Date.parse(r.at)>stamp));
    let login=observed?.operations?.login||{state:'unknown',observedAt:null,scope:'현재 로그인 관측 없음'};
    if(['verified','login-required'].includes(login.state)&&stamp-Date.parse(login.observedAt)>72*3600000)login={...login,state:'historical'};
    const item=c?health.get(c.id):null;
    return {...a,channelId:c?.id||null,operations:{login,externalCollection:c?.externalCollection||null,
      publication:{publishedCount:published.length,scheduledCount:scheduled.length,pendingConfirmationCount:pending.length,
        lastPublishedAt:published.map(r=>r.at).filter(Boolean).sort().at(-1)||null,nextScheduledAt:scheduled.map(r=>r.at).sort()[0]||null,
        checkedAt:now,basis:'확인한 서버 작업과 최근 게시장부 근거 · 플랫폼 전체 게시물 수 아님',omittedPublishedCount:observed?.operations?.publication?.omittedPublishedCount||0,screenObservation:observed?.operations?.publication?.screenObservation||null},
      collection:{state:!managed.has(a.accountStatus)?'not-managed':!c?'not-registered':item?.status||'unknown',checkedAt:c?.lastCollectedAt||null,
        method:cap&&cap.mode!=='manual'?'official-api':'creator-export-or-manual',metrics:(cap?.metrics||[]).filter(key=>!(c?.coverage?.unavailableMetrics||[]).includes(key)&&!(a.platform==='youtube'&&key==='shares'&&c?.coverage?.ownerAuthorized!==true)),connected:c?.connected===true,
        scope:c?.coverage?.status||null,limitations:c?.coverage?.limitations||[],requirements:cap?.requirements||'관리자 통계·공식 내보내기를 확인해 직접 기록할 수 있습니다. 자동 수집기는 연결되지 않았습니다.'}}};
  });
  const active=accounts.filter(a=>managed.has(a.accountStatus));
  return {generatedAt:now,sourceAt:digest?.accountMap?.generatedAt||catalog.sourceAt,accounts,
    coverage:{managed:active.length,registered:active.filter(a=>a.channelId).length,connected:active.filter(a=>a.operations.collection.connected).length,externallyObserved:active.filter(a=>a.operations.externalCollection).length,
      collected:active.filter(a=>a.operations.collection.checkedAt).length,unregistered:active.filter(a=>!a.channelId).length},
    plans:catalog.plans};
}
