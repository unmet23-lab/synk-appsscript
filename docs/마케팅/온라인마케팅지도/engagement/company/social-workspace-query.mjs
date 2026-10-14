import {createHash} from 'node:crypto';

const fail=()=>Object.assign(new Error('게시물 목록 조건이 바뀌었어요. 새로고침한 뒤 다시 조회해 주세요.'),{status:400});
const attention=new Set(['failed','unknown','manual','missed']),inactive=new Set(['cancelled','skipped','expired']);
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,32);
const field=(alias,key)=>`json_extract(${alias}.body,'$.${key}')`;
const object=(alias,keys)=>`json_object(${keys.flatMap(key=>[`'${key}'`,field(alias,key)]).join(',')})`;
const day=value=>{const at=Date.parse(value);return Number.isFinite(at)?new Date(at+9*3600000).toISOString().slice(0,10):'';};
const shift=(value,n)=>new Date(Date.parse(value+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
const postKeys=['id','title','status','brandId','campaignId','category','language','ownerId','createdBy','assigneeId','createdAt','updatedAt','contentVersion'];
const jobKeys=['id','postId','channelId','status','publisherId','createdAt','updatedAt','scheduledAt','publishedAt','publicationUrl','publicVerifiedAt','performanceEntryId','message','contentVersion','selectedCopyId','selectedCopyIndex'];

// Counts and permissions use small SQL projections. Saved bodies, edit history and approved
// media snapshots enter JS only for the requested page, through a keyset query with LIMIT.
// This derived cache is invalidated by every relevant write and by other SQLite connections.
// It never contains credentials and never substitutes for current channel authorization.
export function createSocialWorkspaceQuery(store){
  let cached=null;
  const statements=new Map(),sql=text=>{if(!statements.has(text))statements.set(text,store.db.prepare(text));return statements.get(text);};
  store.db.function('synk_social_lower',{deterministic:true},value=>String(value||'').toLocaleLowerCase());
  function metadata(){
    const version=[store.generation('socialPosts'),store.generation('socialPublishJobs'),store.db.prepare('PRAGMA data_version').get().data_version,store.db.prepare('SELECT total_changes() AS n').get().n].join(':');
    const cacheable=store.db.isTransaction===false;
    if(cacheable&&cached?.version===version)return cached;
    const posts=sql(`SELECT ${object('p',postKeys)} AS body, (SELECT json_group_array(json_object('channelId',json_extract(value,'$.channelId'))) FROM json_each(p.body,'$.variants')) AS variants FROM documents p WHERE p.kind='socialPosts'`).all().map(row=>({...JSON.parse(row.body),variants:JSON.parse(row.variants)}));
    const summaryKeys=['title','brandId','campaignId','category','purpose','language','topikArea','contentVersion'];
    const summary=`json_object(${summaryKeys.flatMap(key=>[`'${key}'`,key==='title'?`COALESCE(NULLIF(${field('j','snapshot.variant.title')},''),${field('j','snapshot.post.title')},'')`:field('j','snapshot.post.'+key)]).join(',')},'format',${field('j','snapshot.variant.format')},'publicationFormat',${field('j','snapshot.variant.publicationFormat')},'selectedCopyId',${field('j','snapshot.variant.selectedCopyId')},'selectedCopyIndex',${field('j','snapshot.variant.selectedCopyIndex')})`;
    const jobs=sql(`SELECT ${object('j',jobKeys)} AS body, ${summary} AS summary, json_type(j.body,'$.snapshot.post') IS NOT NULL AS known FROM documents j WHERE j.kind='socialPublishJobs'`).all().map(row=>({...JSON.parse(row.body),...(row.known?{contentSummary:JSON.parse(row.summary)}:{})}));
    const data={version,posts,jobs};if(cacheable)cached=data;return data;
  }
  function visible(user,channels){const data=metadata(),allowed=new Set(channels.map(c=>c.id));const posts=data.posts.filter(p=>p.variants.length?p.variants.every(v=>allowed.has(v.channelId)):p.ownerId===user.id).map(p=>({...p,variants:p.variants.map(v=>({...v}))})),ids=new Set(posts.map(p=>p.id));return {posts,jobs:data.jobs.filter(j=>ids.has(j.postId)&&allowed.has(j.channelId)).map(j=>({...j,...(j.contentSummary?{contentSummary:{...j.contentSummary}}:{})}))};}
  function matching(data,filters){
    let posts=data.posts;
    for(const key of ['brandId','campaignId','category','language'])if(filters[key])posts=posts.filter(p=>p[key]===filters[key]);
    if(filters.ownerId)posts=posts.filter(p=>[p.ownerId,p.createdBy,p.assigneeId].includes(filters.ownerId));
    if(filters.channelId)posts=posts.filter(p=>p.variants.some(v=>v.channelId===filters.channelId));
    if(filters.status){const statuses=new Set(data.jobs.filter(j=>j.status===filters.status).map(j=>j.postId));posts=posts.filter(p=>p.status===filters.status||statuses.has(p.id));}
    if(filters.search){const q=String(filters.search).trim().toLocaleLowerCase();if(q.length>1000)throw fail();if(q){const ids=new Set(sql(`SELECT id FROM documents WHERE kind='socialPosts' AND instr(synk_social_lower(COALESCE(json_extract(body,'$.title'),'')||' '||COALESCE(json_extract(body,'$.body'),'')||' '||COALESCE(json_extract(body,'$.category'),'')||' '||COALESCE(json_extract(body,'$.purpose'),'')),?)>0`).all(q).map(r=>r.id));posts=posts.filter(p=>ids.has(p.id));}}
    const ids=new Set(posts.map(p=>p.id));return {posts,jobs:data.jobs.filter(j=>ids.has(j.postId))};
  }
  function scheduled(user,channels){
    const allowed=new Set(channels.map(c=>c.id)),jobs=[],posts=new Map();
    const keys=['id','postId','channelId','status','updatedAt','scheduledAt','scheduleRevision','attempts','approvalHash','contentVersion','mode'];
    const query=`SELECT ${object('j',keys)} AS job,${object('p',['id','title','ownerId','contentVersion'])} AS post,${field('p','approval.hash')} AS approvalHash,(SELECT json_group_array(json_object('channelId',json_extract(value,'$.channelId'))) FROM json_each(p.body,'$.variants')) AS variants,${field('j','snapshot.post.title')} AS title,json_array_length(j.body,'$.snapshot.variant.media') AS mediaCount,${field('j','snapshot.variant.options.notifyOnly')} AS notifyOnly,${field('j','snapshot.variant.options.coverUrl')} AS coverUrl FROM documents j JOIN documents p ON p.kind='socialPosts' AND p.id=${field('j','postId')} WHERE j.kind='socialPublishJobs' AND ${field('j','status')}='scheduled' ORDER BY j.rowid`;
    for(const row of sql(query).all()){
      const job=JSON.parse(row.job),post={...JSON.parse(row.post),variants:JSON.parse(row.variants),approval:{hash:row.approvalHash}};
      if(!allowed.has(job.channelId)||!(post.variants.length?post.variants.every(v=>allowed.has(v.channelId)):post.ownerId===user.id))continue;
      jobs.push({...job,snapshot:{post:{title:row.title},variant:{mediaCount:row.mediaCount||0,options:{notifyOnly:row.notifyOnly===1,coverUrl:row.coverUrl}}}});posts.set(post.id,post);
    }
    return {jobs,posts:[...posts.values()]};
  }
  function range(filters,now){const date=filters.date||day(now);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||day(date+'T12:00:00+09:00')!==date)throw fail();const first=date.slice(0,8)+'01',base=filters.view==='month'?first:date,weekday=new Date(base+'T12:00:00Z').getUTCDay(),start=filters.view==='day'?date:shift(base,-((weekday+6)%7)),length=filters.view==='month'?42:filters.view==='week'?7:1;return {date,from:start,to:shift(start,length),month:first,nextMonth:new Date(Date.UTC(Number(first.slice(0,4)),Number(first.slice(5,7)),1)).toISOString().slice(0,10)};}
  function page(kind,rows,{limit,cursor,binding,overview=false}){
    let after=null;if(cursor){if(typeof cursor!=='string'||cursor.length>1200||!/^[\w-]+$/.test(cursor))throw fail();try{after=JSON.parse(Buffer.from(cursor,'base64url').toString());}catch{throw fail();}if(!after||typeof after!=='object'||Array.isArray(after)||after.v!==1||after.binding!==binding||!Array.isArray(after.key)||after.key.length!==(kind==='socialPosts'?2:3)||after.key.some(v=>!['string','number'].includes(typeof v)))throw fail();}
    const isPost=kind==='socialPosts',candidates=rows.map(row=>({id:row.id,at:row[isPost?'updatedAt':'scheduledAt']||'',rank:overview&&!attention.has(row.status)?1:0})),columns=isPost?['at','id']:['rank','at','id'],direction=isPost?'DESC':'ASC',tuple='('+columns.join(',')+')';
    // Sort only the projected keys. Joining the LIMITed IDs back through (kind,id)
    // avoids scanning or sorting the large approved snapshots again on every page.
    const query=`WITH candidates AS (SELECT json_extract(value,'$.id') AS id,json_extract(value,'$.at') AS at,json_extract(value,'$.rank') AS rank FROM json_each(?)), page AS MATERIALIZED (SELECT * FROM candidates${after?` WHERE ${tuple} ${isPost?'<':'>'} (${after.key.map(()=>'?').join(',')})`:''} ORDER BY ${columns.map(c=>c+' '+direction).join(',')} LIMIT ?) SELECT d.body FROM page JOIN documents d ON d.kind=? AND d.id=page.id ORDER BY ${columns.map(c=>'page.'+c+' '+direction).join(',')}`;
    const found=sql(query).all(JSON.stringify(candidates),...(after?.key||[]),limit+1,kind).map(row=>JSON.parse(row.body)),hasMore=found.length>limit,items=found.slice(0,limit),last=items.at(-1),key=last&&(isPost?[last.updatedAt||'',last.id]:[overview&&attention.has(last.status)?0:overview?1:0,last.scheduledAt||'',last.id]);
    return {items,pagination:{total:rows.length,limit,hasMore,nextCursor:hasMore?Buffer.from(JSON.stringify({v:1,binding,key})).toString('base64url'):null}};
  }
  function workspace(user,channels,filters,now){
    const size=Number(filters.pageSize??50);if(!Number.isInteger(size)||size<1||size>100)throw fail();
    const all=visible(user,channels),matched=matching(all,filters),dates=range(filters,now),section=filters.section||'overview',grid=section==='calendar'&&filters.view!=='list',active=new Set(all.jobs.filter(j=>!inactive.has(j.status)).map(j=>j.postId));
    let posts=matched.posts,jobs=matched.jobs;
    if(grid){posts=posts.filter(p=>!active.has(p.id));jobs=jobs.filter(j=>day(j.scheduledAt)>=dates.from&&day(j.scheduledAt)<dates.to);}
    if(section==='queue')jobs=jobs.filter(j=>j.status!=='published'&&!inactive.has(j.status));
    const keys=['section','view','date','search','brandId','channelId','status','campaignId','category','language','ownerId'],binding=hash([user.id,channels.map(c=>c.id).sort(),Object.fromEntries(keys.map(k=>[k,filters[k]||'']))]);
    const postPage=page('socialPosts',posts,{limit:size,cursor:filters.postCursor,binding:hash([binding,'posts'])}),jobPage=page('socialPublishJobs',jobs,{limit:size,cursor:filters.jobCursor,binding:hash([binding,'jobs']),overview:section==='overview'}),overview={};
    if(section==='overview'){
      const latest=(a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||''))||b.id.localeCompare(a.id);
      overview.review=all.posts.filter(p=>p.status==='review').sort(latest).slice(0,5).map(p=>store.get('socialPosts',p.id));
      overview.drafts=all.posts.filter(p=>p.status==='draft').sort(latest).slice(0,4).map(p=>store.get('socialPosts',p.id));
      overview.attention=all.jobs.filter(j=>attention.has(j.status)).sort((a,b)=>String(b.scheduledAt||'').localeCompare(String(a.scheduledAt||''))||b.id.localeCompare(a.id)).slice(0,5).map(j=>store.get('socialPublishJobs',j.id));
      const groups=new Map();for(const job of all.jobs.filter(j=>j.status==='scheduled').sort((a,b)=>String(a.scheduledAt||'').localeCompare(String(b.scheduledAt||''))||a.id.localeCompare(b.id))){const key=JSON.stringify([job.postId,job.scheduledAt]);if(!groups.has(key)){if(groups.size>=8)continue;groups.set(key,[]);}if(groups.get(key).length<40)groups.get(key).push(job);else overview.upcomingTruncated=true;}
      overview.upcoming=[...groups.values()].flat().map(j=>store.get('socialPublishJobs',j.id));
    }
    const shown=new Set(postPage.items.map(p=>p.id)),linkedIds=[...new Set([...jobPage.items,...(overview.attention||[]),...(overview.upcoming||[])].map(j=>j.postId))].filter(id=>!shown.has(id)),linkedPosts=linkedIds.map(id=>store.get('socialPosts',id)),statuses=new Map();for(const job of all.jobs){if(!statuses.has(job.postId))statuses.set(job.postId,new Set());statuses.get(job.postId).add(job.status);}const decorate=p=>({...p,hasActiveJobs:active.has(p.id),jobStatuses:[...(statuses.get(p.id)||[])]});
    const month=value=>{const d=day(value);return d>=dates.month&&d<dates.nextMonth;},weekAgo=Date.parse(now)-7*86400000,days=new Map();
    for(const j of jobs){const d=day(j.scheduledAt);if(!days.has(d))days.set(d,{day:d,total:0,attention:0});const bucket=days.get(d);bucket.total++;if(attention.has(j.status))bucket.attention++;}
    const occupationFrom=section==='calendar'?dates.from:day(now),occupationTo=section==='calendar'?dates.to:shift(day(now),8);
    return {posts:postPage.items.map(decorate),jobs:jobPage.items,linkedPosts:linkedPosts.map(decorate),...(section==='overview'?{overview:{...overview,review:overview.review.map(decorate),drafts:overview.drafts.map(decorate)}}:{}),pagination:{posts:postPage.pagination,jobs:jobPage.pagination},counts:{posts:matched.posts.length,scheduled:matched.jobs.filter(j=>j.status==='scheduled').length,review:matched.posts.filter(p=>p.status==='review').length,published:matched.jobs.filter(j=>j.status==='published').length,attention:matched.jobs.filter(j=>attention.has(j.status)).length},summary:{posts:{draft:all.posts.filter(p=>p.status==='draft').length,review:all.posts.filter(p=>p.status==='review').length},jobs:{scheduled:all.jobs.filter(j=>j.status==='scheduled').length,attention:all.jobs.filter(j=>attention.has(j.status)).length,queue:all.jobs.filter(j=>j.status!=='published'&&!inactive.has(j.status)).length,published7d:all.jobs.filter(j=>j.status==='published'&&Date.parse(j.publishedAt||j.scheduledAt)>=weekAgo).length,monthScheduled:all.jobs.filter(j=>j.status==='scheduled'&&month(j.scheduledAt)).length,monthPublished:all.jobs.filter(j=>j.status==='published'&&month(j.publishedAt||j.scheduledAt)).length},days:[...days.values()],brands:[...new Set(all.posts.map(p=>p.brandId).filter(Boolean))]},occupiedSlots:[...new Map(all.jobs.filter(j=>!inactive.has(j.status)&&day(j.scheduledAt)>=occupationFrom&&day(j.scheduledAt)<occupationTo).map(({channelId,scheduledAt})=>[JSON.stringify([channelId,scheduledAt]),{channelId,scheduledAt}])).values()],context:matched,all};
  }
  return {visible,matching,scheduled,workspace};
}
