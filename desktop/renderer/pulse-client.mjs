import {MODELS,PORTFOLIO,RETIRED_WORKS,TEAMS} from './pulse-data.mjs';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fields={brand:'브랜드·제품',goal:'만들고 싶은 내용',channel:'올릴 곳·화면 비율',deadline:'희망 일정',notes:'기타·메모'};
const empty=()=>({models:[],works:[],brief:Object.fromEntries(Object.keys(fields).map(key=>[key,'']))});
const keyFor=owner=>'synk.pulse.brief.v1:'+encodeURIComponent(owner);
const WORKS=[...PORTFOLIO,...RETIRED_WORKS];
const modelKind=m=>m.kind+(m.team?' · '+m.team:'');
export function sanitizePulseDraft(value={}){
  return {models:[...new Set(Array.isArray(value.models)?value.models:[])].filter(id=>MODELS.some(m=>m.id===id)),
    works:[...new Set(Array.isArray(value.works)?value.works:[])].filter(id=>WORKS.some(w=>w.id===id)),
    brief:Object.fromEntries(Object.keys(fields).map(key=>[key,typeof value.brief?.[key]==='string'?value.brief[key].slice(0,key==='notes'?3000:400):'']))};
}
export function pulseRequestText(value){
  const draft=sanitizePulseDraft(value);
  return ['SYNK PULSE · 제작 상담 요청','',
    '모델 후보',...(draft.models.length?draft.models.map(id=>{const m=MODELS.find(m=>m.id===id);return '- '+m.name+' ('+m.id+') · '+modelKind(m);}):['- 아직 선택하지 않았어요.']),'',
    '참고 작품',...(draft.works.length?draft.works.map(id=>{const w=WORKS.find(w=>w.id===id);return '- '+w.title+' · '+w.kind+(w.sourceUrl?'\n  '+w.sourceUrl:'');}):['- 아직 선택하지 않았어요.']),'',
    ...Object.entries(fields).flatMap(([key,label])=>[label+': '+(draft.brief[key].trim()||'미정')]),'',
    '고른 모델과 작품은 상담할 때 쓰는 후보예요. 제작 범위·일정·사용 조건은 상담하면서 정해요.'].join('\n');
}
// Project progress and approval live in the PULSE window (onOpenApp); this
// view keeps only the brief drafts saved on this PC before that window existed.
export function mountPulseClient(root,{storage,getContext,getFavorite=()=>false,onFavorite=()=>{},onToast=()=>{},onOpenApp=()=>{}}={}){
  let owner, draft=empty(),saved='',tab='models',gender='all',query='',onlyPicked=false,message='';
  let dialogReturn=null;
  function context(){
    const current=getContext?.()||{};
    return current.status==='ready'&&current.owner&&current.owner!=='anonymous-local'?current.owner:
      current.status==='guest'?'anonymous-local':null;
  }
  function syncContext(){
    const next=context();if(next===owner)return;
    root.querySelector?.('dialog[open]')?.close();root.innerHTML='';
    owner=next;draft=empty();saved='';tab='models';query='';onlyPicked=false;message='';
    // The entries into this view promise the saved draft, so a saved draft opens on its own tab.
    if(owner)try{const raw=storage?.getItem(keyFor(owner));if(raw){draft=sanitizePulseDraft(JSON.parse(raw));saved=JSON.stringify(draft);tab='brief';message='이 기기에 저장한 요청 초안을 불러왔어요.';}}catch{message='저장된 초안을 읽지 못했어요. 새로 작성할 수 있어요.';}
  }
  const chosen=()=>draft.models.length+draft.works.length;
  const selected=(id,type)=>draft[type].includes(id);
  function modelCard(m){
    const picked=selected(m.id,'models');
    return '<article class="pulse-model-card"><button class="pulse-photo" data-pulse-model="'+esc(m.id)+'" aria-label="'+esc(m.name)+' 사진 크게 보기"><img src="'+esc(m.image)+'" alt="'+esc(m.name)+' 대표 모델 이미지" loading="lazy"><span class="pulse-photo-hint">크게 보기 ↗</span></button><div class="pulse-model-copy"><span class="pulse-meta">'+esc(m.id)+' · '+esc(modelKind(m))+'</span><h3>'+esc(m.name)+'</h3><p>'+esc(m.summary)+'</p><div class="pulse-tags">'+m.tags.map(t=>'<span>'+esc(t)+'</span>').join('')+'</div><button class="pulse-pick '+(picked?'is-picked':'')+'" data-pulse-pick-model="'+esc(m.id)+'" aria-pressed="'+picked+'">'+(picked?'✓ 후보에 담았어요':'+ 모델 후보 담기')+'</button></div></article>';
  }
  function teamSection(team,members){
    return '<section class="pulse-team" aria-labelledby="pulse-team-'+esc(team.id)+'"><header class="pulse-team-head"><h2 id="pulse-team-'+esc(team.id)+'">'+esc(team.id)+' <span>'+esc(team.ko)+'</span></h2><p><strong>'+esc(team.kind)+'</strong></p><p>'+esc(team.line)+'</p></header><div class="pulse-team-members">'+members.map(modelCard).join('')+'</div></section>';
  }
  function workCard(w){
    const picked=selected(w.id,'works'),gallery=w.gallery||[{image:w.image,caption:w.title}],many=gallery.length>1;
    return '<article class="pulse-work-card'+(many?'':' is-single')+'"><button class="pulse-work-art" data-pulse-work="'+esc(w.id)+'" aria-label="'+esc(w.title)+' 작품 크게 보기">'+gallery.slice(0,3).map(g=>'<img src="'+esc(g.image)+'" alt="'+esc(g.caption)+'" loading="lazy">').join('')+'<span class="pulse-photo-hint">'+(many?'작품 전체 보기':'크게 보기')+' ↗</span></button><div class="pulse-work-copy"><span class="pulse-meta">'+esc(w.kind)+' / '+esc(w.category)+'</span><h3>'+esc(w.title)+'</h3><p>'+esc(w.description)+'</p><div class="pulse-work-actions"><button class="pulse-button" data-pulse-work="'+esc(w.id)+'">'+(many?'이미지 둘러보기':'크게 보기')+' ↗</button><button class="pulse-pick '+(picked?'is-picked':'')+'" data-pulse-pick-work="'+esc(w.id)+'" aria-pressed="'+picked+'">'+(picked?'✓ 참고 작품에 담았어요':'+ 참고 작품 담기')+'</button></div></div></article>';
  }
  function results(){
    const q=query.trim().toLowerCase();
    const list=tab==='models'?MODELS.filter(m=>(gender==='all'||m.gender===gender)&&(!onlyPicked||selected(m.id,'models'))&&[m.name,m.id,m.summary,m.team,TEAMS.find(t=>t.id===m.team)?.ko,...m.tags].join(' ').toLowerCase().includes(q)):
      [...PORTFOLIO,...RETIRED_WORKS.filter(w=>selected(w.id,'works'))].filter(w=>(!onlyPicked||selected(w.id,'works'))&&[w.title,w.description,...w.tags].join(' ').toLowerCase().includes(q));
    if(!list.length)return '<div class="pulse-empty"><h3>조건에 맞는 '+(tab==='models'?'모델':'작품')+'이 없어요.</h3><p>다른 낱말로 찾거나 전체를 보세요.</p><button class="pulse-button" data-pulse-reset>전체 보기</button></div>';
    if(tab!=='models')return list.map(workCard).join('');
    return list.filter(m=>!m.team).map(modelCard).join('')+TEAMS.map(team=>{const members=list.filter(m=>m.team===team.id);return members.length?teamSection(team,members):'';}).join('');
  }
  function briefContent(){
    return '<div class="pulse-brief"><div class="pulse-brief-form"><span class="pulse-meta">YOUR CREATIVE BRIEF</span><h2>고른 모델과 작품으로<br>제작 요청을 써요.</h2><p class="pulse-muted">고른 모델과 참고 작품이 요청문에 함께 들어가요. 아는 것만 적어 주셔도 돼요. 다 쓰면 복사해서 상담하던 곳이나 hello@synk.im으로 보내 주세요.</p><ul class="pulse-brief-facts"><li><strong>영상 전에 세 번 확인해요</strong> 모델 고르기, 광고가 남길 한 문장과 글 콘티, 컷마다 장면 이미지.</li><li><strong>값</strong> 15초 광고 39만원부터 · 30초 광고와 편집본 89만원부터 · 기업 캠페인 250만원부터</li></ul>'+
      Object.entries(fields).map(([key,label])=>'<label class="pulse-field">'+label+'<'+(key==='notes'||key==='goal'?'textarea':'input')+' data-pulse-field="'+key+'" maxlength="'+(key==='notes'?3000:400)+'" '+(key==='notes'||key==='goal'?'rows="3"':'type="text"')+' placeholder="'+({brand:'브랜드 이름이나 광고할 제품',goal:'예: 신제품을 소개하는 세로 광고 영상',channel:'예: 인스타그램 릴스 · 9:16',deadline:'예: 다음 달 중순까지',notes:'원하는 분위기나 참고 영상 · 꼭 들어갈 말 한두 줄'})[key]+'"'+(key==='notes'||key==='goal'?('>'+esc(draft.brief[key])+'</textarea>'):(' value="'+esc(draft.brief[key])+'">'))+'</label>').join('')+
      '<div class="pulse-form-actions"><button class="pulse-button pulse-primary" data-pulse-copy>요청 내용 복사</button><button class="pulse-button" data-pulse-save '+(!owner?'disabled':'')+'>이 기기에 임시 저장</button></div><p class="pulse-small">아직 보내지 않았어요. 임시 저장은 이 PC의 지금 계정에만 남고 다른 기기에는 없어요.</p><p class="pulse-live" id="pulse-message" role="status">'+esc(message)+'</p><details class="pulse-request-preview"><summary>보낼 요청문 미리 보기</summary><textarea id="pulse-request-text" readonly aria-label="보낼 요청문">'+esc(pulseRequestText(draft))+'</textarea></details></div><aside class="pulse-shortlist"><span class="pulse-meta">YOUR SELECTION</span><h3>선택한 모델 '+draft.models.length+'</h3>'+draft.models.map(id=>{const m=MODELS.find(m=>m.id===id);return '<div class="pulse-selected-row"><img src="'+esc(m.image)+'" alt=""><span><strong>'+esc(m.name)+'</strong><small>'+esc(m.id)+' · '+esc(modelKind(m))+'</small></span><button data-pulse-pick-model="'+esc(id)+'" aria-label="'+esc(m.name)+' 후보에서 빼기">×</button></div>';}).join('')+(!draft.models.length?'<p class="pulse-muted">아직 고른 모델이 없어요.</p>':'')+'<button class="pulse-text" data-pulse-tab="models">모델 더 살펴보기 →</button><h3>참고 작품 '+draft.works.length+'</h3>'+draft.works.map(id=>{const w=WORKS.find(w=>w.id===id);return '<div class="pulse-selected-row"><img src="'+esc(w.image)+'" alt=""><span><strong>'+esc(w.title)+'</strong><small>'+esc(w.kind)+'</small></span><button data-pulse-pick-work="'+esc(id)+'" aria-label="'+esc(w.title)+' 참고 작품에서 빼기">×</button></div>';}).join('')+(!draft.works.length?'<p class="pulse-muted">참고할 작품을 담아 보세요.</p>':'')+'<button class="pulse-text" data-pulse-tab="portfolio">포트폴리오 더 살펴보기 →</button><p class="pulse-small">고른 모델은 상담할 때 쓰는 후보예요. 제작 범위와 사용 조건은 상담하면서 정해요.</p><button class="pulse-text" data-pulse-clear>이 초안과 선택 비우기</button></aside></div>';
  }
  function render(){
    syncContext();
    const focused=globalThis.document?.activeElement;const focusKey=focused?.getAttribute?.('data-pulse-pick-model')||focused?.getAttribute?.('data-pulse-pick-work');
    root.innerHTML='<header class="pulse-heading"><div><span class="pulse-meta">SYNK PULSE / AI 광고 제작</span><h1 tabindex="-1" id="pulse-title">모든 컷을 먼저 보여 드리는<br><em>AI 광고</em></h1><p>영상에 들어갈 모든 컷을, 만들기 전에 장면 이미지로 먼저 보여 드려요. 확인하신 컷으로만 만들고, 제품·로고·화면 위 글자는 실제 파일로 합성해요. 상담은 제품 사진 한 장과 올릴 곳만으로 시작해요.</p><p class="pulse-heading-fine">장면 이미지는 영상의 첫 장면이라 움직이는 동안 작은 부분은 달라질 수 있고, 제품·로고·글자는 합성이라 달라지지 않아요.</p></div><div class="pulse-heading-note"><button class="pulse-favorite" data-pulse-favorite aria-label="PULSE 즐겨찾기" aria-pressed="'+getFavorite()+'">'+(getFavorite()?'★':'☆')+'</button><strong>'+String(MODELS.length).padStart(2,'0')+'</strong><span>모델 프로필<br>공개된 대표 이미지</span></div></header>'+
      '<nav class="pulse-tabs" aria-label="PULSE 둘러보기">'+[['models','모델 캐스팅'],['portfolio','포트폴리오'],['brief','제작 요청 정리']].map(([id,label])=>'<button data-pulse-tab="'+id+'" aria-current="'+(tab===id?'page':'false')+'">'+label+(id==='brief'&&chosen()?'<span>'+chosen()+'</span>':'')+'</button>').join('')+'<button data-pulse-open-app>제작 진행·승인 <span>PULSE 창 ↗</span></button></nav>'+
      (tab==='brief'?briefContent():'<p class="pulse-lead">'+(tab==='models'?'이름과 얼굴이 정해진 AI 모델 '+MODELS.length+'명 가운데 골라요. 다음 편도 같은 모델과 같은 자막 규격으로 이어요. 목소리는 광고 장면에 맞춰 연기로 만들고 시안 단계에서 들려 드려요.':'가상 브랜드로 만든 자체 광고와 공모전 출품작이에요. 새 작품은 완성되는 대로 더해요.')+'</p><div class="pulse-toolbar"><label class="pulse-search"><span class="sr-only">모델·작품 검색</span><input id="pulse-search" type="search" maxlength="100" placeholder="'+(tab==='models'?'이름·팀·분위기로 찾아보기':'작품 검색')+'" value="'+esc(query)+'"></label>'+(tab==='models'?'<div class="pulse-filters" aria-label="모델 필터">'+[['all','전체'],['여','여성'],['남','남성']].map(([id,label])=>'<button data-pulse-gender="'+id+'" aria-pressed="'+(gender===id)+'">'+label+'</button>').join('')+'</div>':'')+'<button class="pulse-only" data-pulse-only aria-pressed="'+onlyPicked+'">✓ 담은 '+(tab==='models'?'모델':'작품')+'만</button></div><div class="pulse-results '+(tab==='models'?'pulse-models':'pulse-works')+'" id="pulse-results">'+results()+'</div>'+
      (tab==='models'?'<p class="pulse-small">AI로 만든 모델이에요. 유호는 SYNK 창업자 양유호 본인을 바탕으로 만들었고, 나머지 '+(MODELS.length-1)+'명은 실제 인물이 아닌 가상 모델이에요. 영상 속 사람과 목소리는 모두 AI로 만들어요. 실존 인물을 닮게 만드는 요청은 받지 않아요.</p>':'<section class="pulse-maker" aria-labelledby="pulse-maker-title"><span class="pulse-meta">만드는 사람</span><h2 id="pulse-maker-title">카메라 앞에 서 본 사람이 AI 모델의 연기를 연출해요</h2><p>AI 광고가 어색해지는 곳은 대개 표정과 호흡, 말이 끝나는 타이밍이에요. SYNK PULSE는 배우로 활동한 대표 유호가 연출해요.</p><p class="pulse-maker-credits">넷플릭스 공개 「보라! 데보라」 1화 오프닝 시퀀스 출연 · tvN 「코미디빅리그」 코너 출연 · 부활 「너의 모습」 뮤직비디오 주연</p></section>')+
      '<div class="pulse-next-bar"><p><strong>모델 '+draft.models.length+' · 참고 작품 '+draft.works.length+'</strong><span>고른 내용을 요청문 하나로 정리해요.</span></p><button class="pulse-button pulse-primary" data-pulse-tab="brief">선택한 내용으로 요청 준비 →</button></div>')+
      '<dialog class="pulse-dialog" aria-label="모델·작품 상세"><button class="pulse-dialog-close" data-pulse-close aria-label="상세 닫기">×</button><div id="pulse-dialog-content"></div></dialog>';
    if(focusKey)root.querySelector('[data-pulse-pick-model="'+focusKey+'"],[data-pulse-pick-work="'+focusKey+'"]')?.focus({preventScroll:true});
  }
  function updateResults(){const list=root.querySelector('#pulse-results');if(list)list.innerHTML=results();}
  function setMessage(text){message=text;const el=root.querySelector('#pulse-message');if(el)el.textContent=text;onToast(text);}
  function openDialog(id,type,trigger){
    const item=(type==='model'?MODELS:WORKS).find(row=>row.id===id);if(!item)return;
    dialogReturn=trigger;
    const dialog=root.querySelector('dialog'),body=root.querySelector('#pulse-dialog-content'),gallery=item.gallery||[{image:item.image,caption:item.title}];
    body.innerHTML=type==='model'?'<div class="pulse-profile"><img class="pulse-profile-image" src="'+esc(item.image)+'" alt="'+esc(item.name)+' 대표 이미지"><div><span class="pulse-meta">'+esc(item.id)+' / '+esc(modelKind(item))+'</span><h2>'+esc(item.name)+'</h2><p>'+esc(item.summary)+'</p><div class="pulse-tags">'+item.tags.map(t=>'<span>'+esc(t)+'</span>').join('')+'</div><p class="pulse-small">공개된 대표 이미지예요. 원하는 표정·옷·연출은 제작 상담에서 같이 정해요.</p><button class="pulse-button pulse-primary" data-pulse-pick-model="'+esc(item.id)+'">'+(selected(item.id,'models')?'후보에서 빼기':'모델 후보에 담기')+'</button></div></div>':
      '<div class="pulse-work-detail"><span class="pulse-meta">'+esc(item.kind)+'</span><h2>'+esc(item.title)+'</h2><p>'+esc(item.description)+'</p><div class="pulse-gallery'+(gallery.length>1?'':' is-single')+'">'+gallery.map(g=>'<figure><img src="'+esc(g.image)+'" alt="'+esc(g.caption)+'" loading="lazy"><figcaption>'+esc(g.caption)+'</figcaption></figure>').join('')+'</div><button class="pulse-button pulse-primary" data-pulse-pick-work="'+esc(item.id)+'">'+(selected(item.id,'works')?'참고 작품에서 빼기':'참고 작품에 담기')+'</button></div>';
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
    else if(data.pulseTab){tab=data.pulseTab;query='';onlyPicked=false;render();}
    else if('pulseOpenApp' in data)onOpenApp();
    else if(data.pulseGender){gender=data.pulseGender;render();}
    else if('pulseOnly' in data){onlyPicked=!onlyPicked;render();}
    else if('pulseReset' in data){query='';gender='all';onlyPicked=false;render();}
    else if(data.pulseModel)openDialog(data.pulseModel,'model',button);
    else if(data.pulseWork)openDialog(data.pulseWork,'work',button);
    else if('pulseClose' in data){root.querySelector('dialog').close();dialogReturn?.focus();}
    else if(data.pulsePickModel||data.pulsePickWork){
      const type=data.pulsePickModel?'models':'works',id=data.pulsePickModel||data.pulsePickWork;
      if(!(type==='models'?MODELS:WORKS).some(item=>item.id===id))return;
      draft[type]=selected(id,type)?draft[type].filter(value=>value!==id):[...draft[type],id];
      render();
    }else if('pulseSave' in data){
      if(!owner)return;
      try{storage.setItem(keyFor(owner),JSON.stringify(sanitizePulseDraft(draft)));saved=JSON.stringify(draft);setMessage('이 기기에 요청 초안을 저장했어요.');}
      catch{setMessage('저장하지 못했어요. 요청 내용을 복사해 보관해 주세요.');}
    }else if('pulseCopy' in data){
      const text=pulseRequestText(draft),activeOwner=owner;
      try{await navigator.clipboard.writeText(text);if(owner===activeOwner)setMessage('요청문을 복사했어요. 상담하던 곳이나 hello@synk.im으로 보내 주세요.');}
      catch{if(owner!==activeOwner)return;if(tab!=='brief'){setMessage('자동 복사가 제한됐어요. 제작 요청 정리에서 요청문을 직접 복사해 주세요.');return;}const details=root.querySelector('.pulse-request-preview');if(!details)return;details.open=true;const area=root.querySelector('#pulse-request-text');area.value=text;area.focus();area.select();setMessage('자동 복사가 제한됐어요. 선택된 요청문을 Ctrl+C로 복사해 주세요.');}
    }else if('pulseClear' in data){
      try{if(owner)storage.removeItem(keyFor(owner));}catch{setMessage('저장된 초안을 지우지 못했어요. 다시 시도해 주세요.');return;}
      draft=empty();saved='';message='초안과 선택을 비웠어요.';render();
    }
  });
  return {render,syncContext,openBrief(){tab='brief';render();root.querySelector('[data-pulse-field]')?.focus();},hasUnsavedChanges:()=>JSON.stringify(draft)!==(saved||JSON.stringify(empty())),discard(){draft=empty();saved='';}};
}

