import { randomUUID } from 'node:crypto';
import { canReadChannel, canWriteChannel } from './organization.mjs';
import { getContentCatalog, generateContentIdeas, renderBriefMarkdown } from './content-engine.mjs';
import { createBenchmarkService } from './benchmarks.mjs';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const fields=['views','likes','comments','shares','saves','reach'];
const statuses=new Set(['draft','review','ready','archived']);
const keyId='content-search:exa';
const emptyMetrics=()=>Object.fromEntries(fields.map(key=>[key,null]));
const markdownText=value=>String(value).replace(/[\r\n]/g,' ').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/([\\`*_{}\[\]()#+.!|])/g,'\\$1');
function object(value){if(!value||typeof value!=='object'||Array.isArray(value))throw fail('입력 형식을 확인해 주세요.');return value;}
function string(value,max,label,required=false){if(value==null&&!required)return '';if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw fail(`${label} 입력을 확인해 주세요. (최대 ${max}자)`);const clean=value.trim();if(required&&!clean)throw fail(`${label}을 입력해 주세요.`);return clean;}
function date(value,label){if(value==null||value==='')return null;const s=string(value,40,label),n=Date.parse(s),parts=/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(s);if(!parts||!Number.isFinite(n)||Number(parts[2])<1||Number(parts[2])>12||Number(parts[3])<1||Number(parts[3])>new Date(Date.UTC(Number(parts[1]),Number(parts[2]),0)).getUTCDate())throw fail(`${label}을 확인해 주세요.`);return new Date(n).toISOString();}
export function normalizeReelUrl(value){
  const input=string(value,1000,'릴스 주소',true);let url;try{url=new URL(input);}catch{throw fail('Instagram 릴스 주소를 입력해 주세요.');}
  if(url.protocol!=='https:'||url.username||url.password||url.port||!['instagram.com','www.instagram.com'].includes(url.hostname.toLowerCase())||!/^\/reel\/[A-Za-z0-9_-]{1,100}\/?$/.test(url.pathname))throw fail('https://www.instagram.com/reel/… 형식의 릴스 주소만 저장할 수 있습니다.');
  return `https://www.instagram.com${url.pathname.replace(/\/$/,'')}/`;
}
function safeUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}}
function metrics(input={}){object(input);return Object.fromEntries(fields.map(key=>{const value=input[key];if(value!=null&&(!Number.isSafeInteger(value)||value<0))throw fail('반응 수는 0 이상의 정수로 입력해 주세요.');return[key,value??null];}));}
const recent=(value,since,until)=>Number.isFinite(Date.parse(value))&&Date.parse(value)>=since&&Date.parse(value)<=until;

export function createContentService({store,clock=()=>new Date().toISOString(),fetchImpl=globalThis.fetch,isConnected=()=>false}){
  const searchCalls=new Map();
  const benchmarks=createBenchmarkService({store,clock,seriesIds:getContentCatalog().series.map(series=>series.id)});
  function current(user){const active=user?.id&&store.get('users',user.id);if(!active?.active)throw fail('로그인 상태를 다시 확인해 주세요.',401);return active;}
  function writable(user){user=current(user);if(user.role==='viewer')throw fail('열람 계정은 기획안을 변경하거나 검색을 실행할 수 없습니다.',403);return user;}
  function canRead(user,row){if(row.ownerId===user.id||user.role==='admin')return true;if(!row.channelId||!['manager','viewer'].includes(user.role)||!user.teamId)return false;const channel=store.get('channels',row.channelId);return !!channel&&channel.teamId===user.teamId&&canReadChannel(user,channel);}
  function getRow(kind,id,user){const row=store.get(kind,string(id,100,'기록 ID',true));if(!row||!canRead(user,row))throw fail('기획 자료를 찾을 수 없습니다.',404);return row;}
  function channelFor(user,id){if(!id)return null;const channel=store.get('channels',string(id,100,'채널 ID',true));if(!channel||channel.active===false||!canWriteChannel(user,channel))throw fail('담당 채널을 찾을 수 없습니다.',404);return channel;}
  function ownerName(row){return {...row,ownerName:store.get('users',row.ownerId)?.name||'이전 담당자'};}
  function searchSettings(){const configured=!!store.secret(keyId)?.apiKey;return {provider:configured?'exa':'manual',configured,notice:configured?'검색 API가 연결되었습니다. 검색할 때 주제와 기간이 Exa에 전달되며 이용 요금이 발생할 수 있습니다. 검색 결과는 인기 여부가 검증된 자료가 아닙니다.':'저장한 참고 자료와 담당 채널 게시물을 찾습니다. 최신 릴스는 외부 검색 링크에서 직접 확인할 수 있습니다.'};}
  function workspace(user){
    user=current(user);
    // Project in SQLite so opening the list does not parse every large plan into server memory.
    const summaries=store.db.prepare(`SELECT id,
      json_extract(body,'$.title') AS title, json_extract(body,'$.ownerId') AS ownerId,
      json_extract(body,'$.channelId') AS channelId, json_extract(body,'$.status') AS status,
      json_extract(body,'$.createdAt') AS createdAt, json_extract(body,'$.updatedAt') AS updatedAt,
      json_extract(body,'$.selectedIdeaId') AS selectedIdeaId,
      COALESCE(json_extract(body,'$.plan.seriesId'),json_extract(body,'$.input.seriesId')) AS seriesId
      FROM documents WHERE kind='contentDrafts'`).all();
    return {catalog:getContentCatalog(),drafts:summaries.filter(row=>canRead(user,row)).map(ownerName).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)),references:store.all('contentReferences').filter(row=>canRead(user,row)).map(ownerName).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),search:searchSettings(),benchmark:benchmarks.workspace(user)};
  }
  function readDraft(user,id){user=current(user);return {draft:ownerName(getRow('contentDrafts',id,user))};}
  function reviewShare(user,id,recipientIds=[]){
    return reviewAudience(writable(user),id,recipientIds);
  }
  function reviewRestore(user,id,recipientIds=[]){
    return reviewAudience(current(user),id,recipientIds);
  }
  function reviewAudience(user,id,recipientIds){
    const draft=getRow('contentDrafts',id,user);
    if(!Array.isArray(recipientIds))throw fail('검토 대상을 확인해 주세요.');
    const readers=store.all('users').filter(person=>person.active&&canRead(person,draft));
    const readable=new Set(readers.map(person=>person.id));
    if(recipientIds.some(id=>!readable.has(id)))throw fail('이 대화의 모든 크루가 기획을 볼 수 있는 것은 아니에요. 검토 가능한 관리자나 팀장과의 개인 대화를 선택해 주세요.',403);
    return{workspaceLink:{title:draft.title.slice(0,160),url:'/#'+new URLSearchParams({view:'content',section:'plan',draftId:draft.id}).toString(),kind:'content-review'},readerIds:[...readable]};
  }
  function generate(user,input){
    user=writable(user);object(input);
    const data={seriesId:string(input.seriesId,100,'시리즈',true),topic:string(input.topic,300,'주제',true)};
    for(const key of ['audience','experience','proof','takeaway','entertainment'])data[key]=string(input[key],3000,key);
    if(input.authenticity!==undefined){object(input.authenticity);data.authenticity=Object.fromEntries(['basis','ownPerspective','limits','disclosure'].map(key=>[key,string(input.authenticity[key],2000,key)]));}
    if(input.personalization!==undefined){object(input.personalization);data.personalization=Object.fromEntries(['situation','choice','nextStep'].map(key=>[key,string(input.personalization[key],2000,key)]));}
    const benchmarkId=string(input.benchmarkId,100,'보고서 ID'),benchmarkItemId=string(input.benchmarkItemId,100,'선정 콘텐츠 ID');
    if(!!benchmarkId!==!!benchmarkItemId)throw fail('벤치마크 보고서와 콘텐츠를 함께 선택해 주세요.');
    if(benchmarkId&&input.referenceId)throw fail('회사 벤치마크와 개인 참고 자료 중 하나를 선택해 주세요.');
    const channel=channelFor(user,input.channelId);
    const reference=input.referenceId?getRow('contentReferences',input.referenceId,user):null;
    if(reference)data.reference={url:reference.url,title:reference.title,publishedAt:reference.publishedAt,checkedAt:reference.checkedAt,reactions:reference.metrics,structure:reference.formatNotes};
    if(benchmarkId){
      const {issue,item}=benchmarks.resolve(user,benchmarkId,benchmarkItemId);
      data.reference={url:item.url,title:item.title,publishedAt:item.publishedAt,checkedAt:item.checkedAt,reactions:item.metrics,hook:item.hook,structure:item.structure,payoff:item.payoff,brandFit:item.brandFit,adaptation:item.adaptation};
      data.benchmark={id:issue.id,itemId:item.id,title:issue.title,scope:issue.scope,periodStart:issue.periodStart,periodEnd:issue.periodEnd,researchedAt:issue.researchedAt,selectionBasis:issue.selectionBasis,rank:item.rank,stale:issue.stale,hook:item.hook,structure:item.structure,payoff:item.payoff,brandFit:item.brandFit,adaptation:item.adaptation,seriesIds:item.seriesIds};
    }
    if(channel)data.channelContext={id:channel.id,displayName:channel.displayName,platform:channel.platform};
    let plan;try{plan=generateContentIdeas(data);}catch(error){if(error instanceof TypeError)throw fail(error.message);throw error;}
    if(store.db.prepare("SELECT COUNT(*) AS count FROM documents WHERE kind='contentDrafts' AND json_extract(body,'$.ownerId')=?").get(user.id).count>=500)throw fail('개인 기획안은 최대 500개까지 저장할 수 있습니다.',409);
    const at=clock(),draft={id:randomUUID(),title:data.topic,ownerId:user.id,channelId:channel?.id||null,referenceId:reference?.id||null,benchmarkId:benchmarkId||null,benchmarkItemId:benchmarkItemId||null,status:'draft',createdAt:at,updatedAt:at,selectedIdeaId:null,input:{...data,referenceId:reference?.id||null,channelId:channel?.id||null,benchmarkId:benchmarkId||null,benchmarkItemId:benchmarkItemId||null},plan};
    store.put('contentDrafts',draft.id,draft);return {draft:ownerName(draft)};
  }
  function update(user,id,input){
    user=writable(user);object(input);const draft=getRow('contentDrafts',id,user),updated={...draft,updatedAt:clock()};
    if(input.title!==undefined)updated.title=string(input.title,300,'제목',true);
    if(input.status!==undefined){if(!statuses.has(input.status))throw fail('기획안 상태를 확인해 주세요.');updated.status=input.status;}
    if(input.selectedIdeaId!==undefined){if(input.selectedIdeaId!==null&&!draft.plan.ideas.some(idea=>idea.id===input.selectedIdeaId))throw fail('이 기획안의 아이디어를 선택해 주세요.');updated.selectedIdeaId=input.selectedIdeaId;}
    store.put('contentDrafts',id,updated);return {draft:ownerName(updated)};
  }
  function exportDraft(user,id){user=current(user);const draft=getRow('contentDrafts',id,user);const selection=draft.plan.ideas.find(idea=>idea.id===draft.selectedIdeaId);return {id:draft.id,markdown:`# ${markdownText(draft.title)}\n\n상태: ${draft.status} (기획 검토 상태이며 게시 상태가 아닙니다.)\n${selection?`\n선택한 아이디어: ${markdownText(selection.title||selection.id)}\n`:''}\n${renderBriefMarkdown(draft.plan)}`};}
  function addReference(user,input){
    user=writable(user);object(input);const channel=channelFor(user,input.channelId),url=normalizeReelUrl(input.url),at=clock();
    const reference={id:randomUUID(),ownerId:user.id,channelId:channel?.id||null,url,title:string(input.title,300,'참고 제목',true),creator:string(input.creator,100,'작성자'),publishedAt:date(input.publishedAt,'게시일'),checkedAt:date(input.checkedAt,'확인일')||at,metrics:metrics(input.metrics),formatNotes:string(input.formatNotes,3000,'형식 메모'),evidenceStatus:'user-submitted',source:'manual',createdAt:at};
    if(Date.parse(reference.checkedAt)>Date.parse(at)||reference.publishedAt&&Date.parse(reference.publishedAt)>Date.parse(at))throw fail('게시일과 확인일은 미래로 지정할 수 없습니다.');
    if(store.all('contentReferences').filter(row=>row.ownerId===user.id).length>=500)throw fail('개인 참고 자료는 최대 500개까지 저장할 수 있습니다.',409);
    store.put('contentReferences',reference.id,reference);return {reference:ownerName(reference)};
  }
  function configureSearch(user,input){user=writable(user);if(user.role!=='admin')throw fail('관리자만 검색 API를 설정할 수 있습니다.',403);object(input);if(typeof input.apiKey!=='string')throw fail('API 키를 입력하거나 빈 값으로 연결을 해제해 주세요.');const apiKey=string(input.apiKey,512,'API 키');if(/\s/.test(apiKey))throw fail('API 키에는 공백을 넣지 마세요.');if(apiKey)store.setSecret(keyId,{apiKey,configuredBy:user.id,configuredAt:clock()});else store.deleteSecret(keyId);return {search:searchSettings()};}
  function localResults(user,query,since,until){
    const tokens=query.toLocaleLowerCase().split(/\s+/).filter(Boolean),matches=(...parts)=>tokens.every(token=>parts.join(' ').toLocaleLowerCase().includes(token));
    const results=store.all('contentReferences').filter(row=>canRead(user,row)&&matches(row.title,row.creator,row.formatNotes)&&(!row.publishedAt||recent(row.publishedAt,since,until))).map(row=>({...ownerName(row),referenceId:row.id,source:'saved-reference',dateStatus:row.publishedAt?'user-submitted':'unknown'}));
    const channels=new Map(store.all('channels').filter(c=>c.active!==false&&canReadChannel(user,c)&&isConnected(c)).map(c=>[c.id,c]));
    const observations=[...store.all('snapshots'),...store.all('hypeObservations')].filter(row=>row.source?.startsWith('api:')&&(!row.expiresAt||Date.parse(row.expiresAt)>until));
    for(const post of store.all('posts')){
      const channel=channels.get(post.channelId);if(!channel||!post.source?.startsWith('api:')||post.expiresAt&&Date.parse(post.expiresAt)<=until||!recent(post.publishedAt,since,until)||!matches(post.title,channel.displayName))continue;
      const url=safeUrl(post.url);if(!url)continue;
      const rows=observations.filter(row=>row.postId===post.id).sort((a,b)=>(b.checkedAt||b.date||'').localeCompare(a.checkedAt||a.date||''));
      const observed=rows[0];
      results.push({id:'post:'+post.id,postId:post.id,channelId:channel.id,title:post.title||'수집한 게시물',url,creator:channel.displayName,publishedAt:post.publishedAt,checkedAt:observed?.checkedAt||null,metrics:metrics(Object.fromEntries(fields.map(key=>[key,observed?.[key]??null]))),source:'company-post',evidenceStatus:'collected',dateStatus:'collected',formatNotes:'연결한 담당 채널에서 수집한 게시물입니다. 반응 수는 마지막 관측 시점의 누적 수치입니다.'});
    }
    return results.sort((a,b)=>(b.publishedAt||'').localeCompare(a.publishedAt||'')).slice(0,40);
  }
  function throttle(user){
    const at=Date.parse(clock());for(const [key,times] of searchCalls){const kept=times.filter(time=>at-time<60000);if(kept.length)searchCalls.set(key,kept);else searchCalls.delete(key);}
    const personal=searchCalls.get(user.id)||[],global=searchCalls.get('*')||[];
    if(personal.length>=5||global.length>=30)throw fail('외부 검색 요청이 많습니다. 1분 후 다시 시도해 주세요.',429);
    searchCalls.set(user.id,[...personal,at]);searchCalls.set('*',[...global,at]);
  }
  async function search(user,input){
    user=writable(user);object(input);const query=string(input.query,200,'검색어',true),days=input.days??30;
    if(!Number.isSafeInteger(days)||days<1||days>30)throw fail('검색 기간은 1~30일로 입력해 주세요.');
    if(input.localOnly!==undefined&&typeof input.localOnly!=='boolean')throw fail('로컬 검색 옵션을 확인해 주세요.');
    const at=clock(),until=Date.parse(at),since=until-days*86400000;
    const searchQuery=`site:instagram.com/reel/ ${query}`;
    const links=[{label:`Google에서 최근 ${days}일 릴스 찾기`,url:`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&tbs=qdr:d${days}`},{label:'Instagram에서 검색하기',url:`https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(query)}`}];
    const config=input.localOnly===true?null:store.secret(keyId);let external=[],mode='local',notice='저장한 참고 자료와 연결된 담당 채널 게시물을 검색했습니다. 외부 검색 링크의 날짜와 반응은 원문에서 직접 확인해 주세요.';
    if(config?.apiKey){
      throttle(user);const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
      try{
        // The fixed endpoint receives only a topic query and public-search filters, never draft context.
        const response=await fetchImpl('https://api.exa.ai/search',{method:'POST',redirect:'error',headers:{'Content-Type':'application/json','x-api-key':config.apiKey},signal:controller.signal,body:JSON.stringify({query,type:'auto',numResults:8,includeDomains:['instagram.com'],startPublishedDate:new Date(since).toISOString(),endPublishedDate:at,contents:{highlights:true}})});
        if(!response.ok)throw new Error('provider');
        if(Number(response.headers.get('content-length'))>524288)throw new Error('size');
        const reader=response.body.getReader();let size=0;const chunks=[];
        while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>524288){await reader.cancel();throw new Error('size');}chunks.push(Buffer.from(value));}
        const result=JSON.parse(Buffer.concat(chunks).toString('utf8'));
        for(const row of Array.isArray(result.results)?result.results.slice(0,8):[]){
          let url,publishedAt;try{url=normalizeReelUrl(row.url);publishedAt=date(row.publishedDate,'검색 게시일');}catch{continue;}
          if(publishedAt&&!recent(publishedAt,since,until))continue;
          external.push({id:'exa:'+url,title:typeof row.title==='string'?row.title.slice(0,300):'릴스 참고 후보',url,creator:typeof row.author==='string'?row.author.slice(0,100):'',publishedAt,checkedAt:at,metrics:emptyMetrics(),source:'exa',evidenceStatus:'search-candidate',dateStatus:publishedAt?'provider-reported':'unknown',formatNotes:Array.isArray(row.highlights)?row.highlights.filter(x=>typeof x==='string').join('\n').slice(0,2000):''});
        }
        mode='exa';notice='외부 검색에서 찾은 참고 후보입니다. 검색 제공자의 날짜는 실제 게시일과 다를 수 있으며 조회수·인기 여부는 확인되지 않았습니다. 원문을 확인한 뒤 참고 자료로 저장해 주세요.';
      }catch{mode='local-fallback';notice='외부 검색을 완료하지 못했습니다. 저장 자료와 검색 링크를 표시합니다. 관리자는 검색 키와 이용 한도를 확인해 주세요.';}
      finally{clearTimeout(timer);}
    }
    // Re-evaluate access after network awaits, including channel handovers during a search.
    user=writable(user);const results=localResults(user,query,since,until),seen=new Set(results.map(row=>row.url));
    for(const row of external)if(!seen.has(row.url)){seen.add(row.url);results.push(row);}
    return {results,links,notice,mode,checkedAt:at,days};
  }
  return {workspace,readDraft,reviewShare,reviewRestore,generate,update,exportDraft,addReference,configureSearch,search,benchmarkPreview:benchmarks.preview,benchmarkPublish:benchmarks.publish,benchmarkDetail:benchmarks.detail};
}
