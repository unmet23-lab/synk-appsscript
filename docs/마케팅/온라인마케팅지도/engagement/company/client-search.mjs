import {createHash,createHmac,timingSafeEqual} from 'node:crypto';

const KINDS=['project','note','message','scene','material','delivery'];
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const rows=value=>Array.isArray(value)?value:[];
const visible=value=>object(value)&&!value.deleted&&!value.deletedAt&&!value.hidden&&!['private','hidden','deleted'].includes(value.visibility);
const display=value=>typeof value==='string'?value.normalize('NFKC').replace(/\s+/gu,' ').trim():'';
const folded=value=>display(value).toLowerCase();
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const compare=(a,b)=>a.rank-b.rank||(a.id<b.id?-1:a.id>b.id?1:0);
const stamp=(value,fallback='')=>typeof value==='string'&&Number.isFinite(Date.parse(value))?value:fallback;
const workroom=(id,extra={})=>'/?'+new URLSearchParams({tab:'workroom',section:'clients',project:id,...extra});
const pulse=(id,tab,extra={})=>'/pulse-app/?'+new URLSearchParams({mode:'staff',project:id,tab,...extra});
function inputFor(input){
  if(!object(input)||Object.keys(input).some(key=>!['query','kinds','projectId','limit','cursor'].includes(key)))throw fail('검색 조건을 확인해 주세요.');
  if(typeof input.query!=='string'||input.query.length>160||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(input.query))throw fail('검색어는 2~160자로 입력해 주세요.');
  const query=display(input.query);if(query.length<2||query.length>160)throw fail('검색어는 2~160자로 입력해 주세요.');
  const kinds=input.kinds===undefined?KINDS:input.kinds;if(!Array.isArray(kinds)||!kinds.length||new Set(kinds).size!==kinds.length||kinds.some(kind=>!KINDS.includes(kind)))throw fail('검색할 종류를 확인해 주세요.');
  const projectId=input.projectId??null;if(projectId!==null&&(typeof projectId!=='string'||!UUID.test(projectId)))throw fail('검색할 프로젝트를 확인해 주세요.');
  const limit=input.limit??20;if(!Number.isSafeInteger(limit)||limit<1||limit>50)throw fail('검색 결과는 한 번에 1~50개까지 확인할 수 있습니다.');
  const cursor=input.cursor??null;if(cursor!==null&&(typeof cursor!=='string'||cursor.length>1200||!cursor))throw fail('검색 결과의 다음 페이지를 확인해 주세요.');
  return {query,terms:[...new Set(query.toLowerCase().split(' '))],kinds:KINDS.filter(kind=>kinds.includes(kind)),projectId,limit,cursor};
}
function excerpt(fields,terms){
  const options=fields.map(display).filter(Boolean);if(!options.length)return '';
  options.sort((a,b)=>terms.filter(term=>folded(b).includes(term)).length-terms.filter(term=>folded(a).includes(term)).length);
  const text=options[0],lower=text.toLowerCase(),positions=terms.map(term=>lower.indexOf(term)).filter(index=>index>=0),at=positions.length?Math.min(...positions):0,start=Math.max(0,at-65),end=Math.min(text.length,start+220);
  return (start?'…':'')+text.slice(start,end)+(end<text.length?'…':'');
}

// Search only saved, current source fields. Histories, encrypted drafts, contact
// credentials, file bytes and deleted target records are deliberately not sources.
function* sources(project){
  const id=project.id,updatedAt=stamp(project.updatedAt),versions=rows(project.versions).filter(value=>visible(value)&&UUID.test(value.id||'')),versionIds=new Set(versions.map(value=>value.id)),studio=object(project.studio)?project.studio:{};
  const source=(type,key,kind,title,fields,href,at=updatedAt,primary=[title])=>({id:id+':'+type+':'+key,kind,projectId:id,projectTitle:display(project.title),projectStage:project.stage,title:display(title),fields:fields.map(display).filter(Boolean),primary:primary.map(display).filter(Boolean),href,updatedAt:stamp(at,updatedAt)});
  yield source('project',id,'project',project.title,[project.title,project.customerName,project.receiptId,project.summary,project.terms,project.nextStep],workroom(id,{record:'1'}),updatedAt,[project.title,project.customerName,project.receiptId]);
  if(display(project.internalNotes))yield source('note',id,'note','프로젝트 내부 메모',[project.internalNotes],workroom(id,{note:'1'}));
  for(const message of rows(project.messages)){
    if(!visible(message)||!UUID.test(message.id||'')||!['internal','customer'].includes(message.visibility)||message.versionId&&!versionIds.has(message.versionId))continue;
    const extra={message:message.id};if(message.versionId)extra.version=message.versionId;if(message.versionId&&Number.isFinite(message.seconds)&&message.seconds>=0&&message.seconds<=86400)extra.seconds=String(message.seconds);
    const kind=message.visibility==='internal'?'note':'message',title=message.visibility==='internal'?'내부 메모':message.author==='customer'?'고객 문의·의견':'담당자 답변';
    yield source('message',message.id,kind,title,[message.text],workroom(id,extra),message.at,[]);
  }
  const scenes=rows(studio.scenes).filter(value=>visible(value)&&UUID.test(value.id||'')),concepts=rows(studio.concepts).filter(value=>visible(value)&&UUID.test(value.id||'')),sceneMap=new Map(scenes.map(value=>[value.id,value])),conceptMap=new Map(concepts.map(value=>[value.id,value]));
  for(const review of rows(studio.sceneReviews)){
    const scene=sceneMap.get(review.sceneId);if(!visible(review)||!UUID.test(review.id||'')||!scene||!display(review.text))continue;
    yield source('scene-review',review.id,'scene',scene.title||'장면 의견',[review.text,scene.title],pulse(id,'history',{review:review.id}),review.at,[scene.title]);
  }
  for(const comment of rows(studio.comments)){
    if(!visible(comment)||!UUID.test(comment.id||'')||!['internal','customer'].includes(comment.visibility))continue;
    const target=comment.targetType==='scene'?sceneMap.get(comment.targetId):comment.targetType==='concept'?conceptMap.get(comment.targetId):comment.targetType==='project'?project:null;if(!target)continue;
    const scene=comment.targetType==='scene';yield source('studio-comment',comment.id,scene?'scene':'message',target.title||'프로젝트 의견',[comment.text,target.title],pulse(id,'history',{comment:comment.id}),comment.at,[target.title]);
  }
  function material(type,key,title,fields,at,href=workroom(id,{materials:'1',materialId:type+':'+key})) {return source('material-'+type,key,'material',title,fields,href,at,[title]);}
  for(const file of rows(project.intake?.files))if(visible(file)&&file.kind==='attachment'&&UUID.test(file.id||''))yield material('intake',file.id,file.fileName,[file.fileName],project.intake?.receivedAt);
  for(const asset of rows(studio.assets))if(visible(asset)&&UUID.test(asset.id||''))yield material('asset',asset.id,asset.fileName,[asset.fileName],asset.at);
  const materialUrls=new Map();
  for(const [cards,type]of [[rows(studio.references),'reference'],[concepts,'concept'],[scenes,'scene']])for(const card of cards){
    if(!visible(card)||!UUID.test(card.id||''))continue;const title=card.label||card.title,asset=rows(studio.assets).find(asset=>visible(asset)&&asset.id===card.assetId);let url='';try{const parsed=new URL(type==='reference'?card.url:card.imageUrl);if(parsed.protocol==='https:'&&!parsed.username&&!parsed.password)url=parsed.href;}catch{}
    if(!asset&&!url)continue;if(url&&!materialUrls.has(url))materialUrls.set(url,type+':'+card.id);
    const materialId=asset?'asset:'+asset.id:materialUrls.get(url);yield material(type,card.id,title,[title,asset?.fileName],card.updatedAt||card.at,workroom(id,{materials:'1',materialId}));
  }
  for(const version of versions){
    yield material('version',version.id,version.label,[version.label,version.media?.fileName],version.createdAt,workroom(id,{version:version.id}));
    if(version.kind==='final'&&display(version.guide))yield source('delivery',version.id,'delivery',version.label||'납품 안내',[version.guide,version.label],workroom(id,{version:version.id}),version.createdAt,[version.label]);
  }
}

export function createClientSearchService({store,clientProjects}){
  const mac=body=>createHmac('sha256',store.key).update('client-search-cursor-v1\0'+body).digest();
  function encodeCursor(value){const body=Buffer.from(JSON.stringify(value)).toString('base64url');return body+'.'+mac(body).toString('base64url');}
  function decodeCursor(value){if(!value)return null;try{const [body,signature,...extra]=value.split('.'),bytes=Buffer.from(signature||'','base64url');if(extra.length||bytes.length!==32||!timingSafeEqual(bytes,mac(body)))throw new Error();const parsed=JSON.parse(Buffer.from(body,'base64url').toString());if(parsed.v!==1||typeof parsed.fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(parsed.fingerprint)||!object(parsed.after)||!Number.isSafeInteger(parsed.after.rank)||typeof parsed.after.id!=='string')throw new Error();return parsed;}catch{throw fail('검색 결과가 변경됐거나 페이지 정보가 만료됐습니다. 처음부터 다시 검색해 주세요.',409);}}
  function search(user,input){
    const options=inputFor(input),live=typeof user?.id==='string'&&store.get('users',user.id);if(!live?.active||!['admin','manager','member','viewer'].includes(live.role))throw fail('먼저 로그인해 주세요.',401);
    const all=clientProjects.searchSources(live);if(!Array.isArray(all))throw fail('프로젝트 원문을 불러오지 못했습니다.',503);
    const projects=all.filter(project=>visible(project)).sort((a,b)=>a.id.localeCompare(b.id));
    if(options.projectId&&!projects.some(project=>project.id===options.projectId))throw fail('현재 열람할 수 있는 프로젝트를 찾을 수 없습니다.',404);
    const cursor=decodeCursor(options.cursor),fingerprint=createHash('sha256').update(JSON.stringify({userId:live.id,role:live.role,teamId:live.teamId,query:folded(options.query),kinds:options.kinds,projectId:options.projectId,limit:options.limit})),best=[],facets=new Map();let total=0;
    for(const project of projects){
      fingerprint.update(JSON.stringify([project.id,project.revision,project.stage]));
      for(const source of sources(project)){
        if(!options.kinds.includes(source.kind))continue;fingerprint.update(JSON.stringify(source));
        const text=folded(source.fields.join(' '));if(!options.terms.every(term=>text.includes(term)))continue;
        if(!facets.has(project.id))facets.set(project.id,{id:project.id,title:display(project.title),count:0});facets.get(project.id).count++;
        if(options.projectId&&project.id!==options.projectId)continue;total++;
        const primary=folded(source.primary.join(' ')),quality=source.fields.some(field=>folded(field)===folded(options.query))?0:options.terms.every(term=>primary.includes(term))?1:2,rank=(source.kind==='project'?0:100)+quality*10+KINDS.indexOf(source.kind);
        const candidate={...source,rank};if(cursor&&compare(candidate,cursor.after)<=0)continue;
        let index=best.findIndex(item=>compare(candidate,item)<0);if(index<0)index=best.length;if(index<=options.limit){best.splice(index,0,candidate);if(best.length>options.limit+1)best.pop();}
      }
    }
    const currentFingerprint=fingerprint.digest('hex');if(cursor&&cursor.fingerprint!==currentFingerprint)throw fail('프로젝트 내용이나 열람 권한이 변경됐습니다. 처음부터 다시 검색해 주세요.',409);
    const hasMore=best.length>options.limit,selected=best.slice(0,options.limit),items=selected.map(({fields,primary,rank,...item})=>({...item,snippet:excerpt(fields,options.terms)})),last=selected.at(-1);
    const matchingProjectCount=facets.size;if(options.projectId&&!facets.has(options.projectId)){const project=projects.find(value=>value.id===options.projectId);facets.set(project.id,{id:project.id,title:display(project.title),count:0});}
    const projectOptions=[...facets.values()].sort((a,b)=>a.title.localeCompare(b.title,'ko')||a.id.localeCompare(b.id)),selectedOptions=projectOptions.slice(0,200);if(options.projectId&&!selectedOptions.some(project=>project.id===options.projectId)){selectedOptions[selectedOptions.length-1]=facets.get(options.projectId);}
    return {query:options.query,items,total,hasMore,nextCursor:hasMore?encodeCursor({v:1,fingerprint:currentFingerprint,after:{rank:last.rank,id:last.id}}):null,projects:selectedOptions,matchingProjectCount,projectsTruncated:projectOptions.length>200};
  }
  return {search};
}
