'use strict';

// 승인 제작 자료 — 시그널 13판 「도구 한 장」(2026-10-20, 12판 계정 관리 카드 격자). 서버가 정한 승인 파일만 보여 주고 받게 한다.
// 머리·포스터·번호 구역은 maker-tools.js 앞 절반 도우미(mtHead · mtBlock · mtBadge · mtIcon …)를 그대로 쓴다.
const creatorSources={userId:null,request:0,data:null,loading:false,error:'',attempted:false,category:'all',query:''};
const creatorSourceCategories={logo:'로고',mascot:'마스코트',felt:'펠트 부품',font:'서체'};
const creatorSourceShort={logo:'로고',mascot:'마스코트',felt:'펠트',font:'서체'};
function creatorSourcesReset(){Object.assign(creatorSources,{userId:null,request:creatorSources.request+1,data:null,loading:false,error:'',attempted:false,category:'all',query:''});}
function creatorSourcesActive(){return state.user&&state.tab==='workroom'&&typeof wr!=='undefined'&&wr.view==='tools';}
async function creatorSourcesEnsure(force=false){
  if(!creatorSourcesActive())return;
  if(creatorSources.userId!==state.user.id){creatorSourcesReset();creatorSources.userId=state.user.id;}
  if(creatorSources.loading||creatorSources.attempted&&!force)return;
  const userId=state.user.id,request=++creatorSources.request;
  creatorSources.loading=true;creatorSources.attempted=true;creatorSources.error='';
  if(force&&typeof render==='function')render();
  try{
    const result=await api('/api/creator-sources');
    if(state.user?.id!==userId||creatorSources.userId!==userId||request!==creatorSources.request)return;
    creatorSources.data=result;
  }catch(error){if(state.user?.id===userId&&request===creatorSources.request)creatorSources.error=error.message||'승인 자료를 불러오지 못했어요.';}
  finally{if(state.user?.id===userId&&request===creatorSources.request){creatorSources.loading=false;if(creatorSourcesActive())render();}}
}
function creatorSourceBytes(value){if(!Number.isFinite(value))return '크기 미확인';return value<1024*1024?Math.max(1,Math.round(value/1024))+' KB':(value/(1024*1024)).toFixed(1)+' MB';}
function creatorSourceLocalUrl(value){return typeof value==='string'&&/^\/api\/creator-sources\/assets\/[a-z0-9-]+(?:\?download=1)?$/.test(value)?value:'#';}
function creatorSourceExternalUrl(value){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:'#';}catch{return '#';}}
function creatorSourcesFiltered(){
  const query=creatorSources.query.trim().toLocaleLowerCase();
  return (creatorSources.data?.assets||[]).filter(row=>(creatorSources.category==='all'||row.category===creatorSources.category)&&(!query||[row.title,row.variant,row.usage,row.fileName].join(' ').toLocaleLowerCase().includes(query)));
}
// 종류 분할 캡슐: 서버가 준 자료에 실제로 있는 종류만, 정해 둔 순서대로.
function creatorSourceKinds(assets=creatorSources.data?.assets||[]){return Object.keys(creatorSourceCategories).map(id=>[id,creatorSourceShort[id],assets.filter(row=>row.category===id).length]).filter(([,,count])=>count);}
function creatorSourcePreview(row){
  if(!row.available)return '<span class="src-missing">원본 파일을 찾지 못했어요</span>';
  const src=creatorSourceLocalUrl(row.previewUrl);
  if(row.preview==='image'&&src!=='#')return `<img src="${escape(src)}" alt="" loading="lazy" decoding="async">`;
  if(row.preview==='font')return `<span class="src-sample src-font-${escape(['hangul','latin','mono'].includes(row.sampleRole)?row.sampleRole:'hangul')}">${escape(row.sample||row.title)}</span>`;
  return '';
}
function creatorSourceDate(value){const time=Date.parse(value||'');return Number.isFinite(time)?new Date(time).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'';}
// 카드: 1:1 그림 · 이름 · 종류 · 파일 한 줄 · 「받기」. 설명과 사용 기준은 카드를 누르면 그 자리에서 펼친다(details, id로 다시 그려도 열림 유지).
function creatorSourceCard(row){
  const id=String(row.id??'').replace(/[^a-z0-9-]/gi,''),download=row.available?creatorSourceLocalUrl(row.downloadUrl):'#';
  const kind=[creatorSourceCategories[row.category]||'제작 자료',row.variant].filter(Boolean).join(' · ');
  const facts=[['사용 기준',row.sourcePath],['원본',row.originPath],['파일 위치',row.assetPath],['고친 날',creatorSourceDate(row.updatedAt)]].filter(([,value])=>value);
  const license=row.license?`<div class="src-license"><strong>${escape(row.license.label)}</strong><p>${escape(row.license.notice)}</p><div class="mt-actions"><a class="mt-link" href="${escape(creatorSourceLocalUrl(row.license.url))}" target="_blank" rel="noopener noreferrer">라이선스 전문</a><a class="mt-link" href="${escape(creatorSourceLocalUrl(row.license.downloadUrl))}" download>라이선스 받기</a></div></div>`:'';
  const more=`<div class="src-card-more">${row.usage?`<p>${escape(row.usage)}</p>`:''}${facts.length?`<dl class="src-facts">${facts.map(([label,value])=>`<div><dt>${label}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl>`:''}${license}<button type="button" class="mt-link" data-creator-source-action="copy-asset" data-id="${escape(row.id)}">파일·사용 기준 복사</button></div>`;
  return `<article class="src-card"><details class="src-card-fold" id="creator-source-${id}" data-creator-source-card="${id}"><summary><span class="src-art${row.background==='dark'?' is-dark':''}">${creatorSourcePreview(row)}</span><h3>${escape(row.title)}</h3><span class="src-kind">${escape(kind)}</span><span class="src-meta"><span class="src-file"><span>${escape(row.fileName||'')}</span> · ${creatorSourceBytes(row.byteSize)}</span><span class="src-more-label" aria-hidden="true">사용 기준</span></span></summary>${more}</details><div class="src-card-foot">${download!=='#'?`<a class="btn small" href="${escape(download)}" download>${mtIcon('download')}받기</a>`:mtBadge('파일 없음','alert')}</div></article>`;
}
function creatorSourcesResults(){
  const rows=creatorSourcesFiltered(),filtered=creatorSources.category!=='all'||Boolean(creatorSources.query.trim());
  const body=`<p class="sr-only" aria-live="polite">${rows.length}개 자료</p>${rows.length?`<div class="src-grid">${rows.map(creatorSourceCard).join('')}</div>`:mtEmpty('찾는 자료가 없어요',filtered?'다른 낱말로 찾거나 「전체」를 눌러요.':'')}`;
  return mtBlock({num:'01',title:'자료',count:rows.length,body});
}
function creatorSourcesGuides(data){
  const guides=data.guides||[];
  const rows=guides.map(row=>`<div class="src-guide"><div><strong>${escape(row.title)}</strong><p>${escape(row.note)}</p></div><div class="mt-actions"><a class="mt-link" href="${escape(creatorSourceExternalUrl(row.url))}" target="_blank" rel="noopener noreferrer">자료 찾기</a><a class="mt-link" href="${escape(creatorSourceExternalUrl(row.licenseUrl))}" target="_blank" rel="noopener noreferrer">사용 조건</a></div></div>`).join('');
  const rights=`<div class="src-rights"><p>외부 자료를 쓰면 자료 주소·작성자·라이선스·확인한 날·꼭 넣을 크레딧을 경험·소재 메모에 같이 남겨요. 다음 사람이 조건을 다시 찾지 않아도 돼요.</p><button type="button" class="btn small" data-creator-source-action="copy-rights">사용권 기록 양식 복사</button></div>`;
  return mtBlock({num:'02',title:'외부 사진·영상·음악',count:guides.length||null,desc:'무료 자료도 초상·상표·음악, 쓰는 목적에 따라 조건이 달라요. 실제로 쓴 자료의 라이선스 전문을 직접 읽어요.',body:`${rows?`<div class="src-guides">${rows}</div>`:''}${rights}`});
}
function creatorSourcesPanel(){
  const mine=creatorSources.userId===state.user?.id,data=mine?creatorSources.data:null,loading=!mine||creatorSources.loading;
  const assets=data?.assets||[],kinds=creatorSourceKinds(assets);
  if(creatorSources.category!=='all'&&!kinds.some(([id])=>id===creatorSources.category))creatorSources.category='all';
  const actions=`<button type="button" class="btn icon" data-creator-source-action="reload" aria-label="새로 읽기" title="새로 읽기" ${loading?'disabled aria-busy="true"':''}>${mtIcon('refresh')}</button>${loading&&data?'<span class="mt-note">새로 읽는 중</span>':''}`;
  const head=mtHead({tool:'sources',title:'승인 제작 자료',desc:'로고·마스코트·펠트 부품·서체 원본을 받고, 외부 사진·영상·음악의 사용 조건을 봐요.',actions,poster:{label:'SYNK MAKER · SOURCES',stats:data?[{label:'자료',value:assets.length},{label:'종류',value:kinds.length}]:[],word:'자료'}});
  const error=mine&&creatorSources.error?mtError(data?`${creatorSources.error} 지난번에 읽은 자료를 보여 줘요.`:`${creatorSources.error} 새로 읽기를 눌러 주세요.`):'';
  if(!data)return `<div class="src" data-creator-sources>${head}${error||'<p class="mt-loading">승인 자료를 불러오고 있어요.</p>'}</div>`;
  const tools=`<div class="src-tools"><label class="mt-search">${mtIcon('search')}<span class="sr-only">자료 찾기</span><input type="search" data-creator-source-query maxlength="80" value="${escape(creatorSources.query)}" placeholder="자료 찾기 · 예: LAB, 마린, 서체" autocomplete="off"></label><div class="mt-seg is-inline src-kinds" role="group" aria-label="종류">${[['all','전체',assets.length],...kinds].map(([id,label,count])=>`<button type="button" data-creator-source-category="${id}" aria-pressed="${creatorSources.category===id}">${label}<b>${count}</b></button>`).join('')}</div></div>`;
  return `<div class="src" data-creator-sources>${head}${error}${tools}<div data-creator-source-results>${creatorSourcesResults()}</div>${creatorSourcesGuides(data)}</div>`;
}
// 찾기·종류 바꾸기는 결과 칸만 다시 그려 입력 칸과 누른 단추의 초점이 그대로 남게 한다. 펼쳐 둔 카드는 다시 그린 뒤에도 펼친다.
function creatorSourcesRefreshResults(){
  if(typeof document==='undefined')return;
  const results=document.querySelector('[data-creator-source-results]');
  if(results){
    const open=[...(results.querySelectorAll?.('details[data-creator-source-card][open]')||[])].map(node=>node.id);
    results.innerHTML=creatorSourcesResults();
    for(const id of open){const node=document.getElementById?.(id);if(node)node.open=true;}
  }
  for(const button of document.querySelectorAll?.('[data-creator-source-category]')||[])button.setAttribute('aria-pressed',String(button.dataset.creatorSourceCategory===creatorSources.category));
}
globalThis.document?.addEventListener('input',event=>{
  if(!creatorSourcesActive()||!event.target.matches('[data-creator-source-query]'))return;
  creatorSources.query=event.target.value.slice(0,80);creatorSourcesRefreshResults();
});
globalThis.document?.addEventListener('click',async event=>{
  const kind=event.target.closest?.('[data-creator-source-category]');
  if(kind){
    if(!creatorSourcesActive()||creatorSources.userId!==state.user.id)return;
    const id=kind.dataset.creatorSourceCategory;creatorSources.category=id!=='all'&&Object.hasOwn(creatorSourceCategories,id)?id:'all';creatorSourcesRefreshResults();return;
  }
  const target=event.target.closest?.('[data-creator-source-action]');if(!target||!creatorSourcesActive()||creatorSources.userId!==state.user.id)return;
  const userId=state.user.id;
  try{
    const action=target.dataset.creatorSourceAction;
    if(action==='reload'){await creatorSourcesEnsure(true);return;}
    let text='';
    if(action==='copy-rights')text=creatorSources.data?.rightsTemplate||'';
    if(action==='copy-asset'){
      const row=creatorSources.data?.assets.find(asset=>asset.id===target.dataset.id);if(!row)return;
      text=[row.title,'파일 위치: '+row.assetPath,'사용 기준: '+row.sourcePath,row.originPath?'원본: '+row.originPath:'','쓰는 법: '+row.usage,row.license?'라이선스: '+row.license.label+'\n'+row.license.notice:''].filter(Boolean).join('\n');
    }
    if(text){await navigator.clipboard.writeText(text);if(state.user?.id===userId&&typeof notify==='function')notify('기록할 내용을 복사했어요.');}
  }catch{if(state.user?.id===userId&&typeof notify==='function')notify('복사하지 못했어요. 브라우저가 클립보드를 막았는지 봐 주세요.');}
});
