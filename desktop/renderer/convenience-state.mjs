export const VIEWS=['home','library','benefits','downloads','settings'];
export function normalizeRoute(value={},appIds=[]){
  const view=VIEWS.includes(value?.view)?value.view:'home';
  return {view,appId:appIds.includes(value?.appId)?value.appId:null,detail:['overview','content','info'].includes(value?.detail)?value.detail:'overview',benefitId:['insight','care','fortune','rehearsal','family-album'].includes(value?.benefitId)?value.benefitId:null,scroll:Math.max(0,Math.min(Number(value?.scroll)||0,100000)),pageScroll:Math.max(0,Math.min(Number(value?.pageScroll)||0,100000))};
}
const routeIdentity=route=>JSON.stringify([route.view,route.appId,route.detail,route.benefitId]);
export function createNavigation({storage,getAppIds=()=>[],read,apply,onChange=()=>{}}){
  let owner=null,entries=[],index=-1;
  const clean=value=>normalizeRoute(value,getAppIds());
  const key=()=>owner?'synk-platform-route-v1:'+encodeURIComponent(owner):null;
  const save=()=>{if(!key()||index<0)return;try{storage.setItem(key(),JSON.stringify(entries[index]));}catch{}};
  function capture(){if(index>=0)entries[index]=clean(read());save();}
  function changed(){onChange({canBack:index>0,canForward:index<entries.length-1});}
  return {
    owner(next){if(owner===next)return false;owner=next;entries=[];index=-1;let route={view:'home'};if(key())try{route=JSON.parse(storage.getItem(key()))||route;}catch{}entries=[clean(route)];index=0;apply(entries[0]);changed();return true;},
    navigate(route){capture();const next=clean(route);if(index>=0&&routeIdentity(entries[index])===routeIdentity(next)){entries[index]={...next,scroll:entries[index].scroll,pageScroll:entries[index].pageScroll};}else{entries=entries.slice(0,index+1);entries.push(next);if(entries.length>40)entries.shift();index=entries.length-1;}apply(entries[index]);save();changed();},
    move(delta){const next=index+delta;if(next<0||next>=entries.length)return false;capture();index=next;entries[index]=clean(entries[index]);apply(entries[index]);save();changed();return true;},
    capture,
    snapshot:()=>({owner,entries:entries.map(row=>({...row})),index})
  };
}
export function searchCommands(entries,query,limit=30){
  const tokens=String(query||'').trim().toLocaleLowerCase('ko').split(/\s+/).filter(Boolean);
  return entries.map((entry,index)=>({entry,index,text:[entry.title,entry.subtitle,entry.keywords].join(' ').toLocaleLowerCase('ko')})).filter(row=>tokens.every(token=>row.text.includes(token))).sort((a,b)=>{
    if(!tokens.length)return a.index-b.index;const score=row=>{const title=row.entry.title.toLocaleLowerCase('ko');return (title.startsWith(tokens.join(' '))?2:0)+(tokens.every(token=>title.includes(token))?1:0);};return score(b)-score(a)||a.index-b.index;
  }).slice(0,limit).map(row=>row.entry);
}
export function trayShortcuts(prefs,allowed){
  const favorite=Array.isArray(prefs?.favorites)?prefs.favorites:[],recent=Object.entries(prefs?.lastLaunch||{}).filter(([,at])=>Number.isFinite(at)&&at>0).sort((a,b)=>b[1]-a[1]).map(([id])=>id),seen=new Set();
  return [...favorite.map(id=>({id,kind:'favorite'})),...recent.map(id=>({id,kind:'recent'}))].filter(row=>allowed.includes(row.id)&&!seen.has(row.id)&&seen.add(row.id)).slice(0,5);
}
export function notificationPreferences(value={}){return {banners:value?.banners!==false,mutedUntil:Math.max(0,Number(value?.mutedUntil)||0),schedule:value?.schedule===true,start:/^([01]\d|2[0-3]):[0-5]\d$/.test(value?.start)?value.start:'22:00',end:/^([01]\d|2[0-3]):[0-5]\d$/.test(value?.end)?value.end:'08:00',weekdays:value?.weekdays===true};}
export function isQuiet(prefs,now=new Date()){
  const value=notificationPreferences(prefs);if(value.mutedUntil>now.getTime())return true;if(!value.schedule||value.weekdays&&[0,6].includes(now.getDay()))return false;
  const minutes=time=>Number(time.slice(0,2))*60+Number(time.slice(3)),start=minutes(value.start),end=minutes(value.end),current=now.getHours()*60+now.getMinutes();if(start===end)return true;return start<end?current>=start&&current<end:current>=start||current<end;
}
export function installationEvents(previous,next,allowed){
  const old=new Map(previous.map(row=>[row.id,row]));return next.filter(row=>allowed.includes(row.id)&&old.has(row.id)).flatMap(row=>{const before=old.get(row.id),status=row.installer?.status,prior=before.installer?.status;if(status===prior)return [];if(status==='ready'&&prior==='preparing')return [{appId:row.id,type:'ready'}];if(status==='error'&&prior==='preparing')return [{appId:row.id,type:'error'}];return [];});
}
export function safeDiagnostics({environment={},auth={},clients=[],view='home',online=true}={}){
  const label=(value,allowed,fallback='unknown')=>allowed.includes(value)?value:fallback;
  return {format:'SYNK platform diagnostics v1',platform:label(environment?.platform,['win32','darwin','linux'],'browser'),arch:label(environment?.arch,['x64','arm64','ia32']),version:/^\d+\.\d+\.\d+(?:[-.][a-zA-Z0-9.-]+)?$/.test(environment?.version)?environment.version:'unknown',mode:label(environment?.mode,['development','release']),signedIn:auth?.signedIn===true,accountConfigured:auth?.configured===true,online:online===true,view:label(view,VIEWS,'home'),clients:clients.map(row=>({id:label(row.id,['world','messenger','teacher','path','pulse','care','fortune','rehearsal','family-album']),status:label(row.status,['installed','not-installed','preview','planned','unavailable']),canLaunch:row.canLaunch===true,preparation:label(row.installer?.status,['idle','preparing','ready','error','installer-opened'])})).filter(row=>row.id!=='unknown')};
}
