import {MODELS, PORTFOLIO} from './pulse-data.mjs';
import {mountPulseWorkflow} from './pulse-workflow.mjs';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fields={brand:'브랜드·제품',goal:'만들고 싶은 내용',channel:'사용할 곳·규격',deadline:'희망 일정',notes:'기타·메모'};
const empty=()=>({models:[],works:[],brief:Object.fromEntries(Object.keys(fields).map(key=>[key,'']))});
const keyFor=owner=>'synk.pulse.brief.v1:'+encodeURIComponent(owner);
export function sanitizePulseDraft(value={}){
  return {models:[...new Set(Array.isArray(value.models)?value.models:[])].filter(id=>MODELS.some(m=>m.id===id)),
    works:[...new Set(Array.isArray(value.works)?value.works:[])].filter(id=>PORTFOLIO.some(w=>w.id===id)),
    brief:Object.fromEntries(Object.keys(fields).map(key=>[key,typeof value.brief?.[key]==='string'?value.brief[key].slice(0,key==='notes'?3000:400):'']))};
}
export function pulseRequestText(value){
  const draft=sanitizePulseDraft(value);
  return ['SYNK PULSE · 제작 상담 요청','',
    '모델 후보',...(draft.models.length?draft.models.map(id=>{const m=MODELS.find(m=>m.id===id);return '- '+m.name+' ('+m.id+') · '+m.kind;}):['- 아직 선택하지 않았어요.']),'',
    '참고 작업',...(draft.works.length?draft.works.map(id=>{const w=PORTFOLIO.find(w=>w.id===id);return '- '+w.title+' · '+w.kind+(w.sourceUrl?'\n  '+w.sourceUrl:'');}):['- 아직 선택하지 않았어요.']),'',
    ...Object.entries(fields).flatMap(([key,label])=>[label+': '+(draft.brief[key].trim()||'미정')]),'',
    '모델·작업은 상담을 위한 후보입니다. 제작 범위·일정·사용 조건은 상담 후 확정합니다.'].join('\n');
}
export function mountPulseClient(root,{storage,getContext,getFavorite=()=>false,onFavorite=()=>{},onToast=()=>{},request}={}){
  let owner, draft=empty(),saved='',tab='models',gender='all',query='',onlyPicked=false,message='';
  let dialogReturn=null;
  const workflow=mountPulseWorkflow(root,{request,getContext,onToast,onRender:()=>{if(tab==='progress')render();}});
  function context(){
    const current=getContext?.()||{};
    return current.status==='ready'&&current.owner&&current.owner!=='anonymous-local'?current.owner:
      current.status==='guest'?'anonymous-local':null;
  }
  function syncContext(){
    workflow.syncContext();
    const next=context();if(next===owner)return;
    root.querySelector?.('dialog[open]')?.close();root.innerHTML='';
    owner=next;draft=empty();saved='';query='';onlyPicked=false;message='';
    if(owner)try{const raw=storage?.getItem(keyFor(owner));if(raw){draft=sanitizePulseDraft(JSON.parse(raw));saved=JSON.stringify(draft);message='이 기기에 저장한 요청 초안을 불러왔어요.';}}catch{message='저장된 초안을 읽지 못했어요. 새로 작성할 수 있어요.';}
  }
  const chosen=()=>draft.models.length+draft.works.length;
  const selected=(id,type)=>draft[type].includes(id);
  function modelCard(m){
    const picked=selected(m.id,'models');
    return '<article class="pulse-model-card"><button class="pulse-photo" data-pulse-model="'+esc(m.id)+'" aria-label="'+esc(m.name)+' 사진 크게 보기"><img src="'+esc(m.image)+'" alt="'+esc(m.name)+' 대표 모델 이미지" loading="lazy"><span class="pulse-photo-hint">크게 보기 ↗</span></button><div class="pulse-model-copy"><span class="pulse-meta">'+esc(m.id)+' · '+esc(m.kind)+'</span><h3>'+esc(m.name)+'</h3><p>'+esc(m.summary)+'</p><div class="pulse-tags">'+m.tags.map(t=>'<span>'+esc(t)+'</span>').join('')+'</div><button class="pulse-pick '+(picked?'is-picked':'')+'" data-pulse-pick-model="'+esc(m.id)+'" aria-pressed="'+picked+'">'+(picked?'✓ 후보에 담았어요':'+ 모델 후보 담기')+'</button></div></article>';
  }
  function workCard(w){
    const picked=selected(w.id,'works'),gallery=w.gallery||[{image:w.image,caption:w.title}];
    return '<article class="pulse-work-card"><button class="pulse-work-art" data-pulse-work="'+esc(w.id)+'" aria-label="'+esc(w.title)+' 작업 보기">'+gallery.slice(0,3).map(g=>'<img src="'+esc(g.image)+'" alt="'+esc(g.caption)+'" loading="lazy">').join('')+'<span class="pulse-photo-hint">작업 전체 보기 ↗</span></button><div class="pulse-work-copy"><span class="pulse-meta">'+esc(w.kind)+' / '+esc(w.category)+'</span><h3>'+esc(w.title)+'</h3><p>'+esc(w.description)+'</p><div class="pulse-work-actions"><button class="pulse-button" data-pulse-work="'+esc(w.id)+'">이미지 둘러보기 ↗</button><button class="pulse-pick '+(picked?'is-picked':'')+'" data-pulse-pick-work="'+esc(w.id)+'" aria-pressed="'+picked+'">'+(picked?'✓ 참고 작업에 담았어요':'+ 참고 작업 담기')+'</button></div></div></article>';
  }
  function results(){
    const q=query.trim().toLowerCase();
    const list=tab==='models'?MODELS.filter(m=>(gender==='all'||m.gender===gender)&&(!onlyPicked||selected(m.id,'models'))&&[m.name,m.id,m.summary,...m.tags].join(' ').toLowerCase().includes(q)):
      PORTFOLIO.filter(w=>(!onlyPicked||selected(w.id,'works'))&&[w.title,w.description,...w.tags].join(' ').toLowerCase().includes(q));
    return list.length?list.map(tab==='models'?modelCard:workCard).join(''):'<div class="pulse-empty"><h3>조건에 맞는 '+(tab==='models'?'모델':'작업')+'이 없어요.</h3><p>검색어나 필터를 바꾸거나 전체를 살펴보세요.</p><button class="pulse-button" data-pulse-reset>전체 보기</button></div>';
  }
  function briefContent(){
    return '<div class="pulse-brief"><div class="pulse-brief-form"><span class="pulse-meta">YOUR CREATIVE BRIEF</span><h2>고른 장면에서<br>제작 이야기를 시작해요.</h2><p class="pulse-muted">선택한 모델과 참고 작업이 요청문에 함께 들어갑니다. 작성한 내용을 복사해 기존 상담 채널로 보내 주세요.</p>'+
      Object.entries(fields).map(([key,label])=>'<label class="pulse-field">'+label+'<'+(key==='notes'||key==='goal'?'textarea':'input')+' data-pulse-field="'+key+'" maxlength="'+(key==='notes'?3000:400)+'" '+(key==='notes'||key==='goal'?'rows="3"':'type="text"')+' placeholder="'+({brand:'브랜드 이름이나 광고할 제품',goal:'예: 신제품을 소개하는 세로 광고 영상',channel:'예: 인스타그램 릴스 · 9:16',deadline:'예: 11월 첫째 주',notes:'원하는 분위기·꼭 들어갈 문구·기타 요청'})[key]+'"'+(key==='notes'||key==='goal'?('>'+esc(draft.brief[key])+'</textarea>'):(' value="'+esc(draft.brief[key])+'">'))+'</label>').join('')+
      '<div class="pulse-form-actions"><button class="pulse-button pulse-primary" data-pulse-copy>요청 내용 복사</button><button class="pulse-button" data-pulse-save '+(!owner?'disabled':'')+'>이 기기에 임시 저장</button></div><p class="pulse-small">아직 전송되지 않습니다. 임시 저장은 현재 기기·현재 계정에만 적용되며 다른 기기와 동기화되지 않습니다.</p><p class="pulse-live" id="pulse-message" role="status">'+esc(message)+'</p><details class="pulse-request-preview"><summary>보낼 요청문 미리 보기</summary><textarea id="pulse-request-text" readonly aria-label="보낼 요청문">'+esc(pulseRequestText(draft))+'</textarea></details></div><aside class="pulse-shortlist"><span class="pulse-meta">YOUR SELECTION</span><h3>선택한 모델 '+draft.models.length+'</h3>'+draft.models.map(id=>{const m=MODELS.find(m=>m.id===id);return '<div class="pulse-selected-row"><img src="'+esc(m.image)+'" alt=""><span><strong>'+esc(m.name)+'</strong><small>'+esc(m.id)+' · '+esc(m.kind)+'</small></span><button data-pulse-pick-model="'+esc(id)+'" aria-label="'+esc(m.name)+' 후보에서 빼기">×</button></div>';}).join('')+(!draft.models.length?'<p class="pulse-muted">아직 고른 모델이 없어요.</p>':'')+'<button class="pulse-text" data-pulse-tab="models">모델 더 살펴보기 →</button><h3>참고 작업 '+draft.works.length+'</h3>'+draft.works.map(id=>{const w=PORTFOLIO.find(w=>w.id===id);return '<div class="pulse-selected-row"><img src="'+esc(w.image)+'" alt=""><span><strong>'+esc(w.title)+'</strong><small>'+esc(w.kind)+'</small></span><button data-pulse-pick-work="'+esc(id)+'" aria-label="'+esc(w.title)+' 참고 작업에서 빼기">×</button></div>';}).join('')+(!draft.works.length?'<p class="pulse-muted">참고할 작업을 담아 보세요.</p>':'')+'<button class="pulse-text" data-pulse-tab="portfolio">포트폴리오 더 살펴보기 →</button><p class="pulse-small">모델 선택은 상담을 위한 후보입니다. 제작 범위와 사용 조건은 상담 후 확정합니다.</p><button class="pulse-text" data-pulse-clear>이 초안과 선택 비우기</button></aside></div>';
  }
  function render(){
    syncContext();
    const focused=globalThis.document?.activeElement;const focusKey=focused?.getAttribute?.('data-pulse-pick-model')||focused?.getAttribute?.('data-pulse-pick-work');
    root.innerHTML='<header class="pulse-heading '+(tab==='progress'?'pulse-heading-project':'')+'"><div><span class="pulse-meta">SYNK PULSE / CLIENT STUDIO</span><h1 tabindex="-1" id="pulse-title">'+(tab==='progress'?'제작의 다음 단계,<em> 함께 확인해요.</em>':'브랜드의 다음 장면,<br><em>여기서 시작해요.</em>')+'</h1>'+(tab==='progress'?'':'<p>사진에서 분위기를 고르고, 원하는 작업을 담아 보세요.</p>')+'</div><div class="pulse-heading-note"><button class="pulse-favorite" data-pulse-favorite aria-label="PULSE 즐겨찾기" aria-pressed="'+getFavorite()+'">'+(getFavorite()?'★':'☆')+'</button>'+(tab==='progress'?'':'<strong>'+String(MODELS.length).padStart(2,'0')+'</strong><span>모델 프로필<br>공개된 대표 이미지</span>')+'</div></header>'+
      '<nav class="pulse-tabs" aria-label="PULSE 둘러보기">'+[['models','모델 캐스팅'],['portfolio','포트폴리오'],['brief','제작 요청 정리'],['progress','제작 진행·승인']].map(([id,label])=>'<button data-pulse-tab="'+id+'" aria-current="'+(tab===id?'page':'false')+'">'+label+(id==='brief'&&chosen()?'<span>'+chosen()+'</span>':'')+'</button>').join('')+'</nav>'+
      (tab==='progress'?workflow.html():tab==='brief'?briefContent():'<div class="pulse-toolbar"><label class="pulse-search"><span class="sr-only">모델·작업 검색</span><input id="pulse-search" type="search" maxlength="100" placeholder="'+(tab==='models'?'이름이나 분위기로 찾아보기':'작업 검색')+'" value="'+esc(query)+'"></label>'+(tab==='models'?'<div class="pulse-filters" aria-label="모델 필터">'+[['all','전체'],['여','여성'],['남','남성']].map(([id,label])=>'<button data-pulse-gender="'+id+'" aria-pressed="'+(gender===id)+'">'+label+'</button>').join('')+'</div>':'')+'<button class="pulse-only" data-pulse-only aria-pressed="'+onlyPicked+'">✓ 담은 '+(tab==='models'?'모델':'작업')+'만</button></div><div class="pulse-results '+(tab==='models'?'pulse-models':'pulse-works')+'" id="pulse-results">'+results()+'</div>'+
      '<div class="pulse-next-bar"><p><strong>모델 '+draft.models.length+' · 참고 작업 '+draft.works.length+'</strong><span>고른 내용을 요청문으로 한 번에 정리하세요.</span></p><button class="pulse-button pulse-primary" data-pulse-tab="brief">선택한 내용으로 요청 준비 →</button></div>'+
      (tab==='portfolio'?'<p class="pulse-small pulse-portfolio-note">현재는 공개된 모델 이미지 작업을 소개합니다. 뮤직비디오와 기업 영상은 완성 후 추가됩니다.</p>':''))+
      '<dialog class="pulse-dialog" aria-label="모델·작업 상세"><button class="pulse-dialog-close" data-pulse-close aria-label="상세 닫기">×</button><div id="pulse-dialog-content"></div></dialog>';
    if(focusKey)root.querySelector('[data-pulse-pick-model="'+focusKey+'"],[data-pulse-pick-work="'+focusKey+'"]')?.focus({preventScroll:true});
  }
  function updateResults(){const list=root.querySelector('#pulse-results');if(list)list.innerHTML=results();}
  function setMessage(text){message=text;const el=root.querySelector('#pulse-message');if(el)el.textContent=text;onToast(text);}
  function openDialog(id,type,trigger){
    const item=(type==='model'?MODELS:PORTFOLIO).find(row=>row.id===id);if(!item)return;
    dialogReturn=trigger;
    const dialog=root.querySelector('dialog'),body=root.querySelector('#pulse-dialog-content');
    body.innerHTML=type==='model'?'<div class="pulse-profile"><img class="pulse-profile-image" src="'+esc(item.image)+'" alt="'+esc(item.name)+' 대표 이미지"><div><span class="pulse-meta">'+esc(item.id)+' / '+esc(item.kind)+'</span><h2>'+esc(item.name)+'</h2><p>'+esc(item.summary)+'</p><div class="pulse-tags">'+item.tags.map(t=>'<span>'+esc(t)+'</span>').join('')+'</div><p class="pulse-small">공개된 대표 이미지입니다. 원하는 표정·착장·연출은 제작 상담에서 함께 정합니다.</p><button class="pulse-button pulse-primary" data-pulse-pick-model="'+esc(item.id)+'">'+(selected(item.id,'models')?'후보에서 빼기':'모델 후보에 담기')+'</button></div></div>':
      '<div class="pulse-work-detail"><span class="pulse-meta">'+esc(item.kind)+'</span><h2>'+esc(item.title)+'</h2><p>'+esc(item.description)+'</p><div class="pulse-gallery">'+(item.gallery||[{image:item.image,caption:item.title}]).map(g=>'<figure><img src="'+esc(g.image)+'" alt="'+esc(g.caption)+'" loading="lazy"><figcaption>'+esc(g.caption)+'</figcaption></figure>').join('')+'</div><button class="pulse-button pulse-primary" data-pulse-pick-work="'+esc(item.id)+'">'+(selected(item.id,'works')?'참고 작업에서 빼기':'참고 작업에 담기')+'</button></div>';
    dialog.showModal();dialog.scrollTop=0;root.querySelector('[data-pulse-close]').focus();
  }
  root.addEventListener('input',event=>{
    const field=event.target.dataset?.pulseField;
    if(Object.hasOwn(fields,field)){draft.brief[field]=event.target.value;const preview=root.querySelector('#pulse-request-text');if(preview)preview.value=pulseRequestText(draft);}
    else if(event.target.id==='pulse-search'){query=event.target.value;updateResults();}
  });
  root.addEventListener('click',async event=>{
    const button=event.target.closest?.('button');if(!button||!root.contains(button))return;
    const data=button.dataset;
    if('pulseFavorite' in data){onFavorite();render();}
    else if(data.pulseTab){tab=data.pulseTab;query='';onlyPicked=false;render();if(tab==='progress')void workflow.enter();}
    else if(data.pulseGender){gender=data.pulseGender;render();}
    else if('pulseOnly' in data){onlyPicked=!onlyPicked;render();}
    else if('pulseReset' in data){query='';gender='all';onlyPicked=false;render();}
    else if(data.pulseModel)openDialog(data.pulseModel,'model',button);
    else if(data.pulseWork)openDialog(data.pulseWork,'work',button);
    else if('pulseClose' in data){root.querySelector('dialog').close();dialogReturn?.focus();}
    else if(data.pulsePickModel||data.pulsePickWork){
      const type=data.pulsePickModel?'models':'works',id=data.pulsePickModel||data.pulsePickWork;
      if(!(type==='models'?MODELS:PORTFOLIO).some(item=>item.id===id))return;
      draft[type]=selected(id,type)?draft[type].filter(value=>value!==id):[...draft[type],id];
      render();
    }else if('pulseSave' in data){
      if(!owner)return;
      try{storage.setItem(keyFor(owner),JSON.stringify(sanitizePulseDraft(draft)));saved=JSON.stringify(draft);setMessage('이 기기에 요청 초안을 저장했어요.');}
      catch{setMessage('저장하지 못했어요. 요청 내용을 복사해 보관해 주세요.');}
    }else if('pulseCopy' in data){
      const text=pulseRequestText(draft),activeOwner=owner;
      try{await navigator.clipboard.writeText(text);if(owner===activeOwner)setMessage('요청문을 복사했어요. 기존 상담 채널에 붙여 넣어 보내 주세요.');}
      catch{if(owner!==activeOwner)return;if(tab!=='brief'){setMessage('자동 복사가 제한됐어요. 제작 요청 정리에서 요청문을 직접 복사해 주세요.');return;}const details=root.querySelector('.pulse-request-preview');if(!details)return;details.open=true;const area=root.querySelector('#pulse-request-text');area.value=text;area.focus();area.select();setMessage('자동 복사가 제한됐어요. 선택된 요청문을 Ctrl+C로 복사해 주세요.');}
    }else if('pulseClear' in data){
      try{if(owner)storage.removeItem(keyFor(owner));}catch{setMessage('저장된 초안을 지우지 못했어요. 다시 시도해 주세요.');return;}
      draft=empty();saved='';message='초안과 선택을 비웠어요.';render();
    }
  });
  return {render,syncContext,openBrief(){tab=workflow.hasUnsavedChanges()?'progress':'brief';render();if(tab==='progress')workflow.focus();else root.querySelector('[data-pulse-field]')?.focus();},hasUnsavedChanges:()=>workflow.hasUnsavedChanges()||JSON.stringify(draft)!==(saved||JSON.stringify(empty())),discard(){workflow.discard();draft=empty();saved='';}};
}

