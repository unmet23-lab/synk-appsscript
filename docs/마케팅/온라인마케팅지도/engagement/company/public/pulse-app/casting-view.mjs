import {esc} from './api.mjs';
import {CASTING_MODELS} from './casting-catalog.mjs';
import {PRODUCTION_PLANS,PRODUCTION_LIBRARY_URL} from './production-catalog.mjs';

export const CASTING_OPTIONS={
  hair:{label:'헤어',values:{original:'대표 사진 그대로',short:'숏 헤어',bob:'단발', 'long-straight':'긴 생머리',wave:'웨이브',updo:'묶은 머리',custom:'직접 설명'}},
  makeup:{label:'메이크업',values:{natural:'내추럴',clean:'깔끔하고 단정하게',glow:'화사한 윤광',smoky:'스모키',custom:'직접 설명'}},
  jacket:{label:'자켓',values:{none:'없음',blazer:'블레이저',casual:'캐주얼 자켓',leather:'레더 자켓',custom:'직접 설명'}},
  top:{label:'상의',values:{tshirt:'티셔츠',shirt:'셔츠',knit:'니트',blouse:'블라우스',custom:'직접 설명'}},
  bottom:{label:'하의',values:{trousers:'슬랙스',denim:'데님',skirt:'스커트',custom:'직접 설명'}},
  earrings:{label:'귀걸이',values:{none:'없음',stud:'작은 스터드',hoop:'링 귀걸이',drop:'드롭 귀걸이',custom:'직접 설명'}},
  ring:{label:'반지',values:{none:'없음',simple:'심플한 반지',layered:'레이어드',custom:'직접 설명'}}
};
export const CASTING_KEYS=['modelId','hair','makeup','jacket','top','bottom','voice','earrings','ring','notes'];
export const emptyCastingSelection=()=>Object.fromEntries(CASTING_KEYS.map(key=>[key,'']));
export function normalizeDemoCasting(value){
  if(value===undefined)return emptyCastingSelection();
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!CASTING_KEYS.includes(key)))throw new Error('모델·스타일 선택 항목을 확인해 주세요.');
  const clean=emptyCastingSelection();
  for(const key of CASTING_KEYS){const v=value[key]??'';if(typeof v!=='string'||v.length>1000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))throw new Error('모델·스타일 입력을 확인해 주세요.');const allowed=key==='modelId'?CASTING_MODELS.map(m=>m.id):key==='voice'?['A','B','C']:key==='notes'?null:Object.keys(CASTING_OPTIONS[key].values);if(allowed&&v!==''&&!allowed.includes(v))throw new Error('모델·스타일 선택을 확인해 주세요.');clean[key]=v.trim();}
  if(clean.voice&&!clean.modelId)throw new Error('목소리를 고르기 전에 모델을 선택해 주세요.');
  return clean;
}
export function castingFromForm(form){return Object.fromEntries(CASTING_KEYS.map(key=>{const fields=Array.from(form.elements).filter(field=>field.name==='cast_'+key);const field=fields.find(field=>field.type!=='radio'||field.checked);return [key,field?.value||''];}));}
export function takeCastingValues(values){const selection=Object.fromEntries(CASTING_KEYS.map(key=>[key,values['cast_'+key]||'']));for(const key of CASTING_KEYS)delete values['cast_'+key];return selection;}
const modelOf=selection=>CASTING_MODELS.find(m=>m.id===selection?.modelId);
export function castingSummary(selection={}){
  const model=modelOf(selection),rows=[['모델',model?`${model.name} · ${model.id}`:'미정'],...Object.entries(CASTING_OPTIONS).map(([key,option])=>[option.label,option.values[selection[key]]||'미정'])];
  rows.splice(6,0,['목소리',selection.voice?`${selection.voice} · ${model?.voices.find(v=>v.id===selection.voice)?.label||'샘플 준비 중'}`:'미정']);
  return `<dl class="casting-summary-list">${rows.map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}${selection.notes?`<div class="casting-note-row"><dt>기타·메모</dt><dd>${esc(selection.notes)}</dd></div>`:''}</dl>`;
}
function choices(selection,key){const o=CASTING_OPTIONS[key];return `<fieldset class="casting-options"><legend>${o.label}</legend><div class="casting-chips">${Object.entries({'':'미정',...o.values}).map(([id,label])=>`<label><input type="radio" name="cast_${key}" value="${id}" ${(selection[key]||'')===id?'checked':''}><span>${esc(label)}</span></label>`).join('')}</div></fieldset>`;}
function mediaCard(video){
  const motionSample=video.sampleType==='motion',portrait=video.aspectRatio==='9:16';
  return `<article class="casting-video"><span class="eyebrow">${motionSample?'MOTION SAMPLE':video.kind==='ad'?'CAMPAIGN FILM':'RUNWAY'}</span><h5>${esc(video.label)}</h5>${video.src?`<video controls playsinline preload="none"${portrait?' data-aspect-ratio="9:16"':''} src="${esc(video.src)}" aria-label="${esc(video.label)}"></video>${video.description?`<p class="casting-motion-note">${esc(video.description)}</p>`:''}${motionSample?'<p class="casting-motion-note">움직임 확인용 샘플입니다. 광고·런웨이 본편은 별도 제작 예정입니다.</p>':''}`:'<div class="casting-media-pending"><span aria-hidden="true">▷</span><p>영상 준비 중</p></div>'}</article>`;
}
export function castingProductionPlan(modelId,plans=PRODUCTION_PLANS){
  const model=CASTING_MODELS.find(item=>item.id===modelId),plan=Array.isArray(plans)?plans.find(item=>item?.modelId===modelId):null;
  if(!model||!plan)return '';
  const url=PRODUCTION_LIBRARY_URL+'?model='+encodeURIComponent(model.id);
  const board=typeof plan.board==='string'&&/^\.\/assets\/production\/[A-Za-z0-9_-]+\.webp$/.test(plan.board)?plan.board:'';
  const values=Array.isArray(plan.values)?plan.values:[];
  return `<article class="casting-production-card${board?' has-board':''}" aria-label="${esc(model.name)} 광고 기획"><div class="casting-production-heading"><span class="eyebrow ko">제작 예시 · 기획안</span><span class="casting-production-state">${esc(plan.status||'기획 준비')}</span></div>${board?`<a class="casting-production-board" href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(model.name)}의 이미지 콘티 크게 보기 (새 탭)"><img src="${esc(board)}" alt="${esc(model.name+' · '+plan.title)} 이미지 콘티" loading="lazy" decoding="async"></a>`:''}<div class="casting-production-copy"><h5>${esc(plan.title)}</h5>${plan.product?`<p class="casting-production-product">${esc(plan.product)}</p>`:''}${values.length?`<ul class="casting-production-values" aria-label="핵심 가치">${values.map(value=>`<li>${esc(value)}</li>`).join('')}</ul>`:''}${plan.memory?`<p class="casting-production-memory"><strong>기억에 남길 장치</strong>${esc(plan.memory)}</p>`:''}<a class="casting-production-open" href="${esc(url)}" target="_blank" rel="noopener noreferrer">광고 기획·콘티 보기 <span aria-hidden="true">↗</span><span class="sr-only"> (새 탭)</span></a></div></article>`;
}
export function castingPortfolio(selection={}){const model=modelOf(selection);return `<div class="casting-portfolio-head"><div><span class="eyebrow">MODEL PORTFOLIO</span><h4>${model?esc(model.name)+'의 광고와 런웨이':'모델을 고르면 포트폴리오를 볼 수 있어요.'}</h4><p class="small">모델의 표현을 살펴보는 예시예요. 지금 고른 의상·헤어가 합성된 미리보기는 아니에요.</p></div>${model?`<span class="tag">${esc(model.id)}</span>`:''}</div>${model?`<div class="casting-video-grid">${model.videos.map(mediaCard).join('')}</div>${castingProductionPlan(model.id)}`:''}<a class="casting-production-library-link" href="${esc(PRODUCTION_LIBRARY_URL)}" target="_blank" rel="noopener noreferrer">7개 광고 기획 전체 보기 <span aria-hidden="true">↗</span><span class="sr-only"> (새 탭)</span></a>`;}
export function castingVoices(selection={}){const model=modelOf(selection);return `<fieldset class="casting-voice-options" ${model?'':'disabled'}><legend>목소리 A · B · C</legend><p class="small">${model?`${esc(model.name)}의 ${model.voices.some(v=>v.src)?'샘플을 듣고 원하는 목소리를 골라 주세요.':'목소리 중 원하는 방향을 골라 주세요. 샘플 음원은 연결을 준비하고 있어요.'}`:'먼저 모델을 골라 주세요. 모델을 바꾸면 목소리는 다시 고를 수 있도록 미정으로 돌아갑니다.'}</p>${model?.voiceNote?`<p class="small">${esc(model.voiceNote)}</p>`:''}<div class="casting-voices">${(model?.voices||['A','B','C'].map(id=>({id,label:'목소리 '+id,src:''}))).map(v=>`<article><label><input type="radio" name="cast_voice" value="${v.id}" ${selection.voice===v.id?'checked':''}><span><strong>${v.id}</strong>${esc(v.label)}</span></label>${v.src?`<audio controls preload="none" src="${esc(v.src)}" aria-label="${esc(model.name+' 목소리 '+v.id)}"></audio>`:'<span class="casting-sample-state">음성 샘플 준비 중</span>'}</article>`).join('')}</div><label class="casting-undecided"><input type="radio" name="cast_voice" value="" ${selection.voice?'':'checked'}> 목소리는 나중에 정할게요</label></fieldset>`;}
export function castingView(selection={}, {editable=true}={}){return `<section class="casting-configurator" aria-label="모델과 스타일 선택">
  <div class="casting-intro"><span class="eyebrow">CASTING & STYLING</span><h3>우리 광고에 어울리는 한 사람.</h3><p>모델과 스타일을 골라 원하는 장면을 구체화해 보세요. 정하지 않은 항목은 비워 두어도 괜찮아요.</p><p class="small">사진은 고른 인물의 기준 이미지예요. 스타일은 제작 희망 방향으로 기록하고, 실제 표현은 제작자와 함께 확인해요.</p></div>
  <fieldset class="casting-models"><legend><span>01</span> 모델 선택 <small>7명</small></legend><div class="casting-model-grid">${CASTING_MODELS.map(m=>`<label class="casting-model-card"><input type="radio" name="cast_modelId" value="${m.id}" ${selection.modelId===m.id?'checked':''}><span class="casting-model-photo">${m.image?`<img src="${esc(m.image)}" alt="${esc(m.name)} 대표 사진" loading="lazy" width="240" height="320"><span class="casting-image-error" hidden>사진을 불러오지 못했어요.</span>`:`<span class="casting-photo-pending"><b>${esc(m.id)}</b>대표 사진 준비 중</span>`}<span class="casting-selected-mark" aria-hidden="true">✓</span></span><span class="casting-model-text"><strong>${esc(m.name)} <small>${esc(m.id)}</small></strong><span>${esc(m.description)}</span></span></label>`).join('')}</div><label class="casting-undecided"><input type="radio" name="cast_modelId" value="" ${selection.modelId?'':'checked'}> 모델은 나중에 정할게요</label></fieldset>
  <div data-casting-portfolio class="casting-portfolio">${castingPortfolio(selection)}</div>
  <section class="casting-step"><h4><span>02</span> 헤어 · 메이크업</h4>${choices(selection,'hair')}${choices(selection,'makeup')}</section>
  <section class="casting-step"><h4><span>03</span> 의상</h4><p class="small">브랜드의 실제 의류를 쓰려면 ‘직접 설명’을 고르고 참고자료를 취향 보드에 추가해 주세요.</p>${choices(selection,'jacket')}${choices(selection,'top')}${choices(selection,'bottom')}</section>
  <section class="casting-step"><h4><span>04</span> 목소리</h4><div data-casting-voices>${castingVoices(selection)}</div><p class="small">모델을 바꿔도 다른 스타일 선택은 그대로예요. 목소리만 새 모델 기준으로 다시 골라 주세요.</p></section>
  <section class="casting-step"><h4><span>05</span> 액세서리</h4>${choices(selection,'earrings')}${choices(selection,'ring')}<label class="field casting-notes">기타·메모<textarea name="cast_notes" rows="3" maxlength="1000" placeholder="예: 검정 블레이저에 브랜드 셔츠. 귀걸이는 작은 은색 스터드로 부탁드려요.">${esc(selection.notes||'')}</textarea><small>직접 설명을 고른 항목, 색상·제품명·피하고 싶은 표현을 적어 주세요.</small></label></section>
  <section class="casting-current" aria-label="현재 모델과 스타일 선택"><h4>지금 고른 조합 <span class="tag">${editable?'선택 미리보기':'저장한 선택'}</span></h4><div data-casting-summary>${castingSummary(selection)}</div>${editable?'<p class="small">아래 ‘제작 설계 저장’을 눌러야 프로젝트에 반영돼요.</p><button type="submit" class="button primary" data-mutate>제작 설계 저장</button>':'<p class="small">이 프로젝트에 저장된 모델과 스타일이에요.</p>'}</section>
</section>`;}

export function refreshCasting(form,{modelChanged=false}={}){
  const root=form?.querySelector('.casting-configurator');if(!root)return;
  let selection=castingFromForm(form);
  if(modelChanged){selection.voice='';root.querySelector('[data-casting-voices]').innerHTML=castingVoices(selection);const voice=form.querySelector('[name=cast_voice][value=""]');voice?.dispatchEvent(new Event('change',{bubbles:true}));}
  root.querySelector('[data-casting-summary]').innerHTML=castingSummary(selection);
  const portfolio=root.querySelector('[data-casting-portfolio]');if(portfolio.dataset.model!==(selection.modelId||'')){portfolio.innerHTML=castingPortfolio(selection);portfolio.dataset.model=selection.modelId||'';}
  const voices=root.querySelector('[data-casting-voices]');if(voices.dataset.model!==(selection.modelId||'')){voices.innerHTML=castingVoices(selection);voices.dataset.model=selection.modelId||'';}
  for(const img of root.querySelectorAll('.casting-model-photo img'))img.onerror=()=>{img.hidden=true;img.nextElementSibling.hidden=false;};
}
