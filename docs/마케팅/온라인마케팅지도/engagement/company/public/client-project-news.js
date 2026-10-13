'use strict';
const clientProjectNews={epoch:0,identity:null,selected:null,records:new Map()};
function clientProjectNewsReset(){clientProjectNews.epoch++;clientProjectNews.identity=null;clientProjectNews.selected=null;clientProjectNews.records.clear();}
function cnewsIdentity(){const identity=JSON.stringify([state.user?.id,state.user?.role,state.user?.teamId,clientDesk.session]);if(clientProjectNews.identity!==null&&clientProjectNews.identity!==identity)clientProjectNewsReset();clientProjectNews.identity=identity;return identity;}
function cnewsProject(id){return clientDesk.data?.projects?.find(project=>project.id===id);}
function cnewsVisible(id){return !!state.user&&clientDesk.userId===state.user.id&&state.tab==='workroom'&&wr.view==='clients'&&clientDesk.id===id&&!!cnewsProject(id);}
function cnewsRecord(id){let row=clientProjectNews.records.get(id);if(!row){row={source:null,loading:false,reading:null,request:0,stale:false,error:'',notice:'',expanded:false,denied:false};clientProjectNews.records.set(id,row);}return row;}
function cnewsSelect(id){if(clientProjectNews.selected===id)return;const previous=clientProjectNews.records.get(clientProjectNews.selected);if(previous){previous.request++;previous.loading=false;previous.reading=null;previous.stale=true;}clientProjectNews.selected=id;const row=clientProjectNews.records.get(id);if(row)row.stale=true;}
function cnewsStamp(){return {identity:cnewsIdentity(),epoch:clientProjectNews.epoch};}
function cnewsRequestCurrent(id,row,stamp,request){return stamp.identity===JSON.stringify([state.user?.id,state.user?.role,state.user?.teamId,clientDesk.session])&&stamp.epoch===clientProjectNews.epoch&&clientProjectNews.records.get(id)===row&&row.request===request;}
function cnewsCurrent(id,row,stamp,request){return cnewsRequestCurrent(id,row,stamp,request)&&cnewsVisible(id)&&clientProjectNews.selected===id;}
function clientProjectNewsProjectsLoaded(){cnewsIdentity();for(const [id,row]of clientProjectNews.records){if(!cnewsProject(id)){clientProjectNews.records.delete(id);continue;}row.stale=true;if(row.reading)continue;row.request++;row.loading=false;row.error='';row.denied=false;}}
function cnewsUrl(value,id){
  if(typeof value!=='string'||!value||/[\\\u0000-\u0020\u007f]/.test(value))return '';
  try{const url=new URL(value,location.origin),keys=[...url.searchParams.keys()],uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if(url.origin!==location.origin||url.username||url.password||url.hash||new Set(keys).size!==keys.length||url.searchParams.get('project')!==id||!uuid.test(id))return '';
    if(url.pathname==='/'&&url.searchParams.get('tab')==='workroom'&&url.searchParams.get('section')==='clients'&&keys.every(key=>['tab','section','project','version','message','seconds','closeout','kickoff','changes','requests','schedule','delivery','followUp','materials','intake'].includes(key))&&cdReadTarget(url.href))return url.href;
    if(url.pathname==='/pulse-app/'&&url.searchParams.get('mode')==='staff'&&['direction','strategy','concepts','storyboard','review','history'].includes(url.searchParams.get('tab'))&&keys.every(key=>['mode','project','tab','scene'].includes(key))&&(!url.searchParams.has('scene')||uuid.test(url.searchParams.get('scene'))))return url.href;
  }catch{}
  return '';
}
function cnewsValid(value,id){return value?.projectId===id&&Number.isSafeInteger(value.revision)&&value.revision>=0&&Number.isSafeInteger(value.unreadCount)&&Array.isArray(value.items)&&value.unreadCount===value.items.length&&value.items.length<=10000&&new Set(value.items.map(item=>item?.id)).size===value.items.length&&value.items.every(item=>typeof item.id==='string'&&item.id.length>0&&item.id.length<=1000&&item.projectId===id&&typeof item.title==='string'&&typeof (item.body??item.text)==='string'&&typeof item.createdAt==='string'&&Number.isFinite(Date.parse(item.createdAt))&&item.unread===true&&typeof item.href==='string');}
const cnewsButton=(label,action,id,extra='')=>`<button type="button" class="cd-button" data-project-news="${action}" data-project-id="${escape(id)}" ${extra}>${label}</button>`;
function cnewsDate(value){return new Intl.DateTimeFormat('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Seoul'}).format(new Date(value));}
function cnewsContents(project){
  const row=cnewsRecord(project.id),busy=row.loading||!!row.reading,disabled=busy||row.stale||row.denied||clientDesk.loading,source=row.denied?null:row.source;
  const heading=source&&!row.stale?'새 소식 '+source.unreadCount+'건':'새 소식';
  let html=`<div class="cnews-heading"><div><h3>${heading}</h3><p>「봤어요」는 내 계정에만 남아요. 봤다고 해서 일이 끝난 건 아니에요.</p></div>${cnewsButton('다시 불러오기','refresh',project.id,busy||clientDesk.loading?'disabled':'')}</div>`;
  if(row.error)html+=`<p class="cd-error" role="alert">${escape(row.error)}</p>`;
  if(row.notice)html+=`<p class="cnews-notice" role="status">${escape(row.notice)}</p>`;
  if(row.loading)html+='<p class="cnews-status" role="status">새 소식을 읽고 있어요.</p>';
  else if(row.stale&&!row.denied)html+='<p class="cnews-status" role="status">지금 보이는 건 전에 불러온 거예요. 「다시 불러오기」를 눌러 주세요.</p>';
  else if(!source&&!row.error)html+='<p class="cnews-status" role="status">새 소식을 불러오고 있어요.</p>';
  if(!source)return html;
  if(!source.items.length)return html+(!row.stale?'<p class="cnews-empty">새 소식이 없어요.</p>':'');
  const items=row.expanded?source.items:source.items.slice(0,3);
  html+=`<ul class="cnews-list">${items.map(item=>{
    const href=cnewsUrl(item.href,project.id),pulse=href&&new URL(href).pathname==='/pulse-app/',body=item.body??item.text,reading=row.reading===item.id;
    return `<li data-project-news-item="${escape(item.id)}"><div class="cnews-item-text"><strong>${escape(item.title)}</strong><time datetime="${escape(item.createdAt)}">${escape(cnewsDate(item.createdAt))}</time>${body?`<p>${escape(body)}</p>`:''}</div><div class="cnews-item-actions">${href?pulse?`<a class="cd-button" data-project-news="pulse" data-project-id="${escape(project.id)}" data-news-id="${escape(item.id)}" ${disabled?'aria-disabled="true"':`href="${escape(href)}" target="_blank" rel="noopener noreferrer"`}>기획 원문 ↗</a>`:cnewsButton('원문 보기','source',project.id,`data-news-id="${escape(item.id)}" ${disabled?'disabled':''}`):'<span class="cnews-status">원문이 어디 있는지 찾지 못했어요.</span>'}${cnewsButton(reading?'저장하는 중…':'봤어요','read',project.id,`data-news-id="${escape(item.id)}" aria-label="${escape(item.title)} · 봤어요" ${disabled?'disabled':''}`)}</div></li>`;
  }).join('')}</ul>`;
  if(source.items.length>3)html+=cnewsButton(row.expanded?'접기':`새 소식 ${source.items.length-3}건 더 보기`,'more',project.id,busy?'disabled':'');
  return html;
}
function clientProjectNewsPanel(project){cnewsIdentity();cnewsSelect(project.id);const row=cnewsRecord(project.id);if(row.source&&(project.revision>row.source.revision||!document.getElementById('client-project-news-'+project.id)))row.stale=true;if((!row.source||row.stale)&&!row.loading&&!row.reading&&!row.error&&!row.denied)queueMicrotask(()=>{if(cnewsVisible(project.id)&&!clientDesk.loading)void cnewsLoad(project.id);});return `<section id="client-project-news-${escape(project.id)}" class="cnews" tabindex="-1" aria-label="새 소식">${cnewsContents(project)}</section>`;}
function cnewsPaint(id){
  if(!cnewsVisible(id))return;const element=document.getElementById('client-project-news-'+id),project=cnewsProject(id);if(!element||!project)return;
  const active=element.contains(document.activeElement)?document.activeElement:null,action=active?.dataset?.projectNews,newsId=active?.dataset?.newsId,scrolls=[],x=window.scrollX,y=window.scrollY;
  for(let node=element.parentElement;node;node=node.parentElement)if(node.scrollHeight>node.clientHeight)scrolls.push([node,node.scrollTop,node.scrollLeft]);
  element.innerHTML=cnewsContents(project);
  if(active){const buttons=[...element.querySelectorAll('[data-project-news]')],field=buttons.find(button=>button.dataset.projectNews===action&&button.dataset.newsId===newsId&&!button.disabled)||buttons.find(button=>button.dataset.projectNews==='read'&&!button.disabled)||element;field.focus?.({preventScroll:true});}
  for(const [node,top,left]of scrolls){node.scrollTop=top;node.scrollLeft=left;}window.scrollTo(x,y);if(typeof clientProjectTargetRefresh==='function')clientProjectTargetRefresh();
}
function cnewsApply(row,result){row.source=result;row.stale=false;row.error='';row.denied=false;}
function cnewsFailure(row,error){row.error=error.message||'새 소식을 읽지 못했어요. 다시 해 주세요.';row.stale=!!row.source;if([401,403,404].includes(error.status)){row.source=null;row.denied=true;}}
async function cnewsLoad(id){
  cnewsIdentity();if(!cnewsVisible(id))return false;cnewsSelect(id);const row=cnewsRecord(id);if(row.loading||row.reading||clientDesk.loading)return false;
  const stamp=cnewsStamp(),request=++row.request,revision=cnewsProject(id).revision;row.loading=true;row.error='';row.notice='';cnewsPaint(id);
  try{const result=await api('/api/client-projects/'+encodeURIComponent(id)+'/news');if(!cnewsCurrent(id,row,stamp,request))return false;if(cnewsProject(id).revision!==revision)throw new Error('그사이 프로젝트가 바뀌었어요. 다시 불러와 주세요.');if(!cnewsValid(result,id)||result.revision<revision)throw new Error('그사이 프로젝트가 바뀌었어요. 위 「새로 불러오기」를 누른 뒤 봐 주세요.');cnewsApply(row,result);return true;}
  catch(error){if(cnewsCurrent(id,row,stamp,request))cnewsFailure(row,error);return false;}
  finally{if(cnewsRequestCurrent(id,row,stamp,request)){row.loading=false;if(!cnewsVisible(id))row.stale=true;cnewsPaint(id);}}
}
async function cnewsRead(id,newsId){
  cnewsIdentity();if(!cnewsVisible(id))return false;const row=cnewsRecord(id);if(row.loading||row.reading||row.stale||row.denied||clientDesk.loading||!row.source?.items.some(item=>item.id===newsId))return false;
  const stamp=cnewsStamp(),request=++row.request,revision=cnewsProject(id).revision;row.reading=newsId;row.error='';row.notice='';cnewsPaint(id);
  try{const result=await api('/api/client-projects/'+encodeURIComponent(id)+'/news/read',{id:newsId});if(!cnewsCurrent(id,row,stamp,request))return false;if(cnewsProject(id).revision!==revision||!cnewsValid(result,id)||result.revision<revision)throw new Error('소식 목록을 읽지 못했어요. 「다시 불러오기」를 눌러 주세요.');cnewsApply(row,result);row.notice='봤다고 표시했어요. 일 처리 상태는 그대로예요.';return true;}
  catch(error){if(cnewsCurrent(id,row,stamp,request))cnewsFailure(row,error);return false;}
  finally{if(cnewsRequestCurrent(id,row,stamp,request)){row.reading=null;if(!cnewsVisible(id))row.stale=true;cnewsPaint(id);}}
}
function cnewsSource(id,newsId){
  if(!cnewsVisible(id))return false;const row=cnewsRecord(id);if(row.loading||row.reading||row.stale||row.denied||clientDesk.loading)return false;const item=row.source?.items.find(item=>item.id===newsId),href=item&&cnewsUrl(item.href,id);if(!href||new URL(href).pathname!=='/')return false;
  const target=cdReadTarget(href),element=target?.messageId&&document.getElementById('client-message-'+target.messageId);
  if(element&&!target.versionId){clientProjectReveal(element);element.scrollIntoView({block:'center',behavior:'auto'});element.focus?.({preventScroll:true});return true;}
  return openClientWorkflowLink(href);
}
function clientProjectNewsResume(){const id=clientDesk.id;if(document.visibilityState==='hidden'||!cnewsVisible(id)||clientDesk.loading)return;const row=cnewsRecord(id);if(row.loading||row.reading)return;row.stale=true;void cnewsLoad(id);}
document.addEventListener('visibilitychange',clientProjectNewsResume);
window.addEventListener?.('focus',clientProjectNewsResume);
document.addEventListener('click',event=>{const button=event.target.closest?.('[data-project-news]');if(!button||button.disabled)return;cnewsIdentity();const id=button.dataset.projectId;if(!cnewsVisible(id))return;const row=cnewsRecord(id),action=button.dataset.projectNews;if(row.loading||row.reading||clientDesk.loading)return;if(action==='refresh')void cnewsLoad(id);else if(action==='read')void cnewsRead(id,button.dataset.newsId);else if(action==='source')cnewsSource(id,button.dataset.newsId);else if(action==='more'){row.expanded=!row.expanded;cnewsPaint(id);}});
