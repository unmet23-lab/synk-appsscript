import {esc} from './api.mjs';
import {CASTING_MODELS} from './casting-catalog.mjs';
import {PRODUCTION_PLANS,PRODUCTION_LIBRARY_URL} from './production-catalog.mjs';

export const CASTING_OPTIONS={
  hair:{label:'헤어',values:{original:'대표 사진 그대로','look-2':'모델 헤어 2','look-3':'모델 헤어 3',short:'숏 헤어',bob:'단발', 'long-straight':'긴 생머리',wave:'웨이브',updo:'묶은 머리',custom:'직접 설명'}},
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
  const model=modelOf(selection),rows=[['모델',model?`${model.name} · ${model.id}`:'미정'],...Object.entries(CASTING_OPTIONS).map(([key,option])=>[option.label,(key==='hair'&&model&&MODEL_HAIR[selection.hair]!==undefined&&model.hairLabels?.[MODEL_HAIR[selection.hair]])||option.values[selection[key]]||'미정'])];
  rows.splice(6,0,['목소리',selection.voice?`${selection.voice} · ${model?.voices.find(v=>v.id===selection.voice)?.label||'샘플 준비 중'}`:'미정']);
  return `<dl class="casting-summary-list">${rows.map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}${selection.notes?`<div class="casting-note-row"><dt>기타·메모</dt><dd>${esc(selection.notes)}</dd></div>`:''}</dl>`;
}
// 헤어는 고른 모델의 헤어 셋(hairLabels)만, 남자 모델에게는 블라우스·스커트를 빼고 보인다. 이미 저장한 값은 「이전 선택」으로 남겨 잃지 않는다(10-19 검수).
const MODEL_HAIR={original:0,'look-2':1,'look-3':2},MALE_MODELS=new Set(['M01','M02','M03']);
function optionsFor(selection,key){
  const o=CASTING_OPTIONS[key],model=modelOf(selection),current=selection[key]||'';let entries=Object.entries(o.values);
  if(key==='hair')entries=model?.hairLabels?.length?[...model.hairLabels.slice(0,3).map((label,index)=>[['original','look-2','look-3'][index],label]),['custom',o.values.custom]]:entries.filter(([id])=>!['look-2','look-3'].includes(id));
  if((key==='top'||key==='bottom')&&model&&MALE_MODELS.has(model.id))entries=entries.filter(([id])=>!['blouse','skirt'].includes(id));
  if(current&&!entries.some(([id])=>id===current))entries.push([current,(o.values[current]||current)+' · 이전 선택']);
  return [['','미정'],...entries];
}
function choices(selection,key){const o=CASTING_OPTIONS[key];return `<fieldset class="casting-options" data-casting-choice="${key}"><legend>${o.label}</legend><div class="casting-chips">${optionsFor(selection,key).map(([id,label])=>`<label><input type="radio" name="cast_${key}" value="${esc(id)}" ${(selection[key]||'')===id?'checked':''}><span>${esc(label)}</span></label>`).join('')}</div></fieldset>`;}
function mediaCard(video){
  // 아직 만들지 않은 영상은 빈 칸으로 두지 않는다(10-19 검수: 「영상 준비 중」 두 칸이 미완성처럼 보였다).
  if(!video.src)return '';
  // 표정 참고용(expression): 완성 광고지만 유호님 뜻대로 「표정 참고용 시안」으로 보인다(10-20 하린 아이스커피). 포스터는 작품 칸과 같은 규칙으로만 받는다.
  const motionSample=video.sampleType==='motion',expression=video.sampleType==='expression',portrait=video.aspectRatio==='9:16',poster=workMedia(video.poster,'webp');
  return `<article class="casting-video"><span class="eyebrow ko">${motionSample?'움직임 샘플':expression?'표정 참고용':video.kind==='ad'?'광고':'런웨이'}</span><h5>${esc(video.label)}</h5><video controls playsinline preload="none"${portrait?' data-aspect-ratio="9:16"':''}${poster?` poster="${esc(poster)}"`:''} src="${esc(video.src)}" aria-label="${esc(video.label)}"></video>${video.description?`<p class="casting-motion-note">${esc(video.description)}</p>`:''}${motionSample?'<p class="casting-motion-note">움직임을 보는 샘플이에요. 광고·런웨이 본편은 따로 만들 예정이에요.</p>':''}</article>`;
}
const WORK_LABELS={'music-video':'뮤직비디오'};
const workMedia=(value,extension)=>typeof value==='string'&&new RegExp(`^\\./assets/casting/video/[A-Za-z0-9_-]+\\.${extension}$`).test(value)?value:'';
function workCard(work){
  const poster=workMedia(work?.poster,'webp'),excerpt=workMedia(work?.excerpt?.src,'mp4'),full=workMedia(work?.full?.src,'mp4');
  if(!excerpt&&!full)return '';
  const title=esc(work.title),excerptTime=esc(work.excerpt?.duration||''),fullTime=esc(work.full?.duration||'');
  return `<article class="casting-video casting-work" aria-label="${title}"><span class="eyebrow ko">${WORK_LABELS[work.kind]||'작품'}</span><h5>${title}</h5>${excerpt?`<video controls playsinline preload="none"${poster?` poster="${esc(poster)}"`:''} src="${esc(excerpt)}" aria-label="${title} · ${excerptTime} 발췌"></video>`:''}${work.description?`<p class="casting-motion-note">${esc(work.description)}</p>`:''}${full?`<a class="casting-work-full" href="${esc(full)}" target="_blank" rel="noopener noreferrer">본편 보기${fullTime?' · '+fullTime:''} <span aria-hidden="true">↗</span><span class="sr-only"> (새 탭)</span></a>`:''}</article>`;
}
export function castingProductionPlan(modelId,plans=PRODUCTION_PLANS){
  const model=CASTING_MODELS.find(item=>item.id===modelId),plan=Array.isArray(plans)?plans.find(item=>item?.modelId===modelId):null;
  if(!model||!plan)return '';
  const url=PRODUCTION_LIBRARY_URL+'?model='+encodeURIComponent(model.id);
  const board=typeof plan.board==='string'&&/^\.\/assets\/production\/[A-Za-z0-9_-]+\.webp$/.test(plan.board)?plan.board:'';
  const values=Array.isArray(plan.values)?plan.values:[];
  return `<article class="casting-production-card${board?' has-board':''}" aria-label="${esc(model.name)} 광고 기획"><div class="casting-production-heading"><span class="eyebrow ko">제작 예시 · 기획안</span><span class="casting-production-state">${esc(plan.status||'기획 준비')}</span></div>${board?`<a class="casting-production-board" href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(model.name)}의 이미지 콘티 크게 보기 (새 탭)"><img src="${esc(board)}" alt="${esc(model.name+' · '+plan.title)} 이미지 콘티" loading="lazy" decoding="async"></a>`:''}<div class="casting-production-copy"><h5>${esc(plan.title)}</h5>${plan.product?`<p class="casting-production-product">${esc(plan.product)}</p>`:''}${values.length?`<ul class="casting-production-values" aria-label="핵심 가치">${values.map(value=>`<li>${esc(value)}</li>`).join('')}</ul>`:''}${plan.memory?`<p class="casting-production-memory"><strong>기억에 남길 장치</strong>${esc(plan.memory)}</p>`:''}<a class="casting-production-open" href="${esc(url)}" target="_blank" rel="noopener noreferrer">광고 기획·콘티 보기 <span aria-hidden="true">↗</span><span class="sr-only"> (새 탭)</span></a></div></article>`;
}
export function castingPortfolio(selection={}){const model=modelOf(selection),works=Array.isArray(model?.works)?model.works.map(workCard).join(''):'',films=model?model.videos.map(mediaCard).join(''):'';return `<div class="casting-portfolio-head"><div><span class="eyebrow ko">포트폴리오</span><h4>${model?esc(model.name)+'의 포트폴리오':'모델을 고르면 포트폴리오를 볼 수 있어요.'}</h4><p class="small">모델의 표현을 살펴보는 예시예요. 지금 고른 의상·헤어가 합성된 미리보기는 아니에요.</p></div>${model?`<span class="tag">${esc(model.id)}</span>`:''}</div>${model?`${works}${films?`<div class="casting-video-grid">${films}</div>`:works?'':'<p class="small casting-media-note">이 모델의 광고·런웨이 영상은 만들고 있어요. 아래 기획안과 이미지 콘티로 표현을 먼저 볼 수 있어요.</p>'}${castingProductionPlan(model.id)}`:''}<a class="casting-production-library-link" href="${esc(PRODUCTION_LIBRARY_URL)}" target="_blank" rel="noopener noreferrer">7개 광고 기획 전체 보기 <span aria-hidden="true">↗</span><span class="sr-only"> (새 탭)</span></a>`;}
export function castingVoices(selection={}){const model=modelOf(selection);return `<fieldset class="casting-voice-options" ${model?'':'disabled'}><legend>목소리 A · B · C</legend><p class="small">${model?`${esc(model.name)}의 ${model.voices.some(v=>v.src)?'샘플을 듣고 원하는 목소리를 골라 주세요.':'목소리 중 원하는 방향을 골라 주세요. 샘플 음원은 연결을 준비하고 있어요.'}`:'먼저 모델을 골라 주세요. 모델을 바꾸면 목소리는 다시 고르도록 비워져요.'}</p>${model?.voiceNote?`<p class="small">${esc(model.voiceNote)}</p>`:''}<div class="casting-voices">${(model?.voices||['A','B','C'].map(id=>({id,label:'목소리 '+id,src:''}))).map(v=>`<article><label><input type="radio" name="cast_voice" value="${v.id}" ${selection.voice===v.id?'checked':''}><span><strong>${v.id}</strong>${esc(v.label)}</span></label>${v.src?`<button type="button" class="voice-play" data-action="voice-play" aria-label="${esc(model.name+' 목소리 '+v.id+' 듣기')}">듣기</button><audio preload="none" src="${esc(v.src)}" hidden></audio>`:'<span class="casting-sample-state">음성 샘플 준비 중</span>'}</article>`).join('')}</div><label class="casting-undecided"><input type="radio" name="cast_voice" value="" ${selection.voice?'':'checked'}> 목소리는 나중에 정할게요</label></fieldset>`;}
export function castingView(selection={}, {editable=true}={}){return `<section class="casting-configurator" aria-label="모델과 스타일 선택" data-choices-model="${esc(selection.modelId||'')}">
  <div class="casting-intro"><span class="eyebrow ko">모델 · 스타일</span><h3>우리 광고에 어울리는 한 사람.</h3><p>모델과 스타일을 골라 원하는 장면을 그려 보세요. 정하지 않은 항목은 비워 둬도 괜찮아요.</p><p class="small">사진은 그 모델의 기준 이미지예요. 고른 스타일은 바라는 방향으로 남기고, 실제 모습은 담당자와 확인해요.</p></div>
  <fieldset class="casting-models"><legend><span>01</span> 모델 선택 <small>7명</small></legend><div class="casting-model-grid">${CASTING_MODELS.map(m=>`<label class="casting-model-card"><input type="radio" name="cast_modelId" value="${m.id}" ${selection.modelId===m.id?'checked':''}><span class="casting-model-photo">${m.image?`<img src="${esc(m.image)}" alt="${esc(m.name)} 대표 사진" loading="lazy" width="240" height="320"><span class="casting-image-error" hidden>사진을 불러오지 못했어요.</span>`:`<span class="casting-photo-pending"><b>${esc(m.id)}</b>대표 사진 준비 중</span>`}<span class="casting-selected-mark" aria-hidden="true">✓</span></span><span class="casting-model-text"><strong>${esc(m.name)} <small>${esc(m.id)}</small></strong><span>${esc(m.description)}</span></span></label>`).join('')}</div><label class="casting-undecided"><input type="radio" name="cast_modelId" value="" ${selection.modelId?'':'checked'}> 모델은 나중에 정할게요</label></fieldset>
  <div data-casting-portfolio class="casting-portfolio">${castingPortfolio(selection)}</div>
  <section class="casting-step"><h4><span>02</span> 헤어 · 메이크업</h4><p class="small">헤어는 고른 모델에게 맞는 셋 중에서 고를 수 있어요.</p>${choices(selection,'hair')}${choices(selection,'makeup')}</section>
  <section class="casting-step"><h4><span>03</span> 의상</h4><p class="small">브랜드의 실제 의류를 쓰려면 ‘직접 설명’을 고르고 참고자료를 취향 보드에 추가해 주세요.</p>${choices(selection,'jacket')}${choices(selection,'top')}${choices(selection,'bottom')}</section>
  <section class="casting-step"><h4><span>04</span> 목소리</h4><div data-casting-voices>${castingVoices(selection)}</div><p class="small">모델을 바꿔도 다른 스타일 선택은 그대로예요. 목소리만 새 모델 기준으로 다시 골라 주세요.</p></section>
  <section class="casting-step"><h4><span>05</span> 액세서리</h4>${choices(selection,'earrings')}${choices(selection,'ring')}<label class="field casting-notes">기타·메모<textarea name="cast_notes" rows="3" maxlength="1000" placeholder="예: 검정 블레이저에 브랜드 셔츠. 귀걸이는 작은 은색 스터드로 부탁드려요.">${esc(selection.notes||'')}</textarea><small>직접 설명을 고른 항목, 색상·제품명·피하고 싶은 표현을 적어 주세요.</small></label></section>
  <section class="casting-current" aria-label="현재 모델과 스타일 선택"><h4>지금 고른 조합 <span class="tag">${editable?'선택 미리보기':'저장한 선택'}</span></h4><div data-casting-summary>${castingSummary(selection)}</div>${editable?'<p class="small">저장하면 이 선택이 제작 설계에 함께 남아요. 모델·스타일만 바꾸면 이미 확인한 제작 설계는 그대로예요.</p><button type="submit" class="button primary" data-mutate>모델·스타일 저장</button>':'<p class="small">이 프로젝트에 저장된 모델과 스타일이에요.</p>'}</section>
</section>`;}

export function refreshCasting(form,{modelChanged=false}={}){
  const root=form?.querySelector('.casting-configurator');if(!root)return;
  let selection=castingFromForm(form);
  if(modelChanged){for(const key of ['hair','top','bottom']){const box=root.querySelector(`[data-casting-choice="${key}"]`);if(box)box.outerHTML=choices(selection,key);}if(root.dataset)root.dataset.choicesModel=selection.modelId||'';selection.voice='';root.querySelector('[data-casting-voices]').innerHTML=castingVoices(selection);const voice=form.querySelector('[name=cast_voice][value=""]');voice?.dispatchEvent(new Event('change',{bubbles:true}));}
  root.querySelector('[data-casting-summary]').innerHTML=castingSummary(selection);
  const portfolio=root.querySelector('[data-casting-portfolio]');if(portfolio.dataset.model!==(selection.modelId||'')){portfolio.innerHTML=castingPortfolio(selection);portfolio.dataset.model=selection.modelId||'';}
  const voices=root.querySelector('[data-casting-voices]');if(voices.dataset.model!==(selection.modelId||'')){voices.innerHTML=castingVoices(selection);voices.dataset.model=selection.modelId||'';}
  for(const img of root.querySelectorAll('.casting-model-photo img'))img.onerror=()=>{img.hidden=true;img.nextElementSibling.hidden=false;};
}
// 저장 전에 다른 모델을 고른 채로 화면을 다시 그리면(실시간 갱신·탭 이동) 헤어·상의·하의·목소리 칸이 저장한 모델 기준으로 그려져,
// 그 칸에 없는 값(모델 없이 저장한 설계의 「헤어 2」 등)이 되살아나지 못하고 빠졌다. 초안 값으로 그 모델의 칸을 다시 만든다(10-19).
export function syncCastingChoices(form,values={}){
  const root=form?.querySelector('.casting-configurator');if(!root)return false;
  const selection=castingFromForm(form);for(const key of CASTING_KEYS)if(typeof values?.['cast_'+key]==='string')selection[key]=values['cast_'+key];
  if(!root.dataset||(root.dataset.choicesModel||'')===(selection.modelId||''))return false;
  for(const key of ['hair','top','bottom']){const box=root.querySelector(`[data-casting-choice="${key}"]`);if(box)box.outerHTML=choices(selection,key);}
  const voices=root.querySelector('[data-casting-voices]');if(voices){voices.innerHTML=castingVoices(selection);voices.dataset.model=selection.modelId||'';}
  root.dataset.choicesModel=selection.modelId||'';return true;
}

// ── 캐스팅북 문의 → 제작 설계(2026-10-19) ──
// 손님은 캐스팅북 문의 글을 보내기만 한다. 담당자는 그 글을 통째로 붙여 넣으면 된다. 캐스팅북이 쓰는 사람 글 줄을 읽는다:
//   크몽 「[진행하고 싶은 모델]」·「[함께 고민 중인 모델]」·「[고른 모델]」 아래 「1. F02 하린 (…)」 + 「   헤어 2번 … / 목소리 1번 …」,
//   발주서 메모 「[진행할 모델] F02 …」·「[함께 고민 중인 모델] F04 …」·「[모델 1] F02 …」 + 「헤어: 2번 …」·「목소리: 1번 …」(번호는 1부터).
// 사람 글 줄이 없을 때만 코드 「모델 코드.헤어 번호.목소리 번호」(번호는 0부터, 캐스팅북 공유 주소 #p- 뒤·예전 문의 글 끝 줄·손으로 친 코드)를 읽는다.
// 문의 글에 공유 주소가 함께 붙어 와도 손님이 고른 순서(「진행하고 싶은 모델」)가 담긴 사람 글 줄이 이긴다.
// 이 앱에 아직 없는 모델(캐스팅북에 먼저 들어온 새 모델)은 unknown으로 돌려준다. 헤어 번호는 고른 모델의 헤어 1·2·3(original·look-2·look-3),
// 목소리 번호는 A·B·C다. 범위 밖이거나 글에 없는 번호는 그 칸만 미정으로 둔다(코드에는 9로 적어 다시 읽어도 미정).
const CODE_HAIR=['original','look-2','look-3'];
// 앞 경계는 뒤보기((?<!…)) 대신 잡는 묶음으로 본다: 뒤보기는 Safari 16.4부터라 그 전 iPhone에서 이 모듈(앱 전체)이 열리지 않는다.
const CODE_TOKEN=/(^|[^A-Za-z0-9.])([A-Za-z]\d\d)\.(\d)\.(\d)(?![A-Za-z0-9]|\.\d)/g;
const LINE_MODEL=/^\s*(?:\d+\.|\[(?:모델\s*\d+|진행할 모델|함께 고민 중인 모델)\])\s*([A-Za-z]\d\d)(?![A-Za-z0-9.])/;
const LINE_HEADER=/^\s*\[([^\]]+)\]\s*$/;
// 메모·대사·들어 보고 싶은 문장 줄은 손님이 쓴 말이라 그 안의 「헤어 3번」·「목소리 2번」을 고른 번호로 읽지 않는다.
const LINE_ASIDE=/^\s*(?:메모|대사|이 목소리로 들어 보고 싶은 문장)\s*[:：]/;
function readCastingLines(text){
  const picks=[];let current=null,section='',leadTaken=false;
  for(const line of text.split(/\r?\n/)){
    const header=LINE_HEADER.exec(line);
    if(header){section=header[1].trim();current=null;continue;}
    const model=LINE_MODEL.exec(line);
    // 진행하고 싶은 모델은 한 명이다. 손님이 머리줄을 지워 한 묶음에 여럿이 들어와도 첫 모델만 고른 모델로 본다.
    if(model){const lead=!leadTaken&&(/^\s*\[진행할 모델\]/.test(line)||section==='진행하고 싶은 모델');if(lead)leadTaken=true;current={id:model[1],hair:null,voice:null,lead};picks.push(current);continue;}
    if(!current)continue;
    if(!line.trim()||/^\s*\[/.test(line)){current=null;continue;}
    if(LINE_ASIDE.test(line))continue;
    const hair=/헤어\s*:?\s*(\d+)\s*번/.exec(line),voice=/목소리\s*:?\s*(\d+)\s*번/.exec(line);
    if(hair&&current.hair===null)current.hair=Number(hair[1])-1;
    if(voice&&current.voice===null)current.voice=Number(voice[1])-1;
  }
  return picks;
}
export function readCastingCode(text){
  const source=String(text??'').slice(0,200000),items=[],unknown=[],codes=[],seen=new Set();
  const digit=n=>Number.isInteger(n)&&n>=0&&n<=8?n:9;
  const add=(raw,hair,voice,lead=false)=>{
    const id=raw.toUpperCase();if(seen.has(id)||items.length===9)return;seen.add(id);
    const code=`${id}.${digit(hair)}.${digit(voice)}`;codes.push(code);
    const model=CASTING_MODELS.find(m=>m.id===id);
    if(!model){unknown.push(id);return;}
    items.push({modelId:id,hair:model.hairLabels?.[hair]&&CODE_HAIR[hair]||'',voice:model.voices[voice]?.id||'',code,lead});
  };
  for(const pick of readCastingLines(source))add(pick.id,pick.hair,pick.voice,pick.lead);
  if(!seen.size)for(const [,,id,hair,voice] of source.matchAll(CODE_TOKEN))add(id,Number(hair),Number(voice));
  items.sort((a,b)=>Number(b.lead)-Number(a.lead));
  return {items,unknown,codes};
}
// 발주서로 들어온 접수 글(가져온 프로젝트의 intake)에서 찾은 조합을 담당자 칸에 미리 넣을 글로 돌려준다(읽은 그대로의 짧은 사람 글).
export function intakeCastingText(intake){
  const {items,unknown}=readCastingCode([intake?.reportText,intake?.notes].filter(value=>typeof value==='string').join('\n'));
  if(!items.length&&!unknown.length)return '';
  const line=(item,index)=>{const model=codeModel(item),hair=CODE_HAIR.indexOf(item.hair),voice=model.voices.find(v=>v.id===item.voice);return `${index+1}. ${item.modelId} ${model.name}\n   ${[hair>=0?`헤어 ${hair+1}번 ${model.hairLabels[hair]}`:'',voice?`목소리 ${['A','B','C'].indexOf(voice.id)+1}번 ${voice.label}`:''].filter(Boolean).join(' / ')}`.trimEnd();};
  const lead=items.filter(item=>item.lead),rest=[...items.filter(item=>!item.lead).map((item,index)=>line(item,index+lead.length)),...unknown.map((id,index)=>`${items.length+index+1}. ${id}`)];
  return [lead.length?`[진행하고 싶은 모델]\n${lead.map(line).join('\n')}`:'',rest.length?`${lead.length?'[함께 고민 중인 모델]':'[고른 모델]'}\n${rest.join('\n')}`:''].filter(Boolean).join('\n\n');
}
// 담당자가 고른 조합을 양식에 넣는다. 사람이 모델 → 헤어 → 목소리 순서로 누른 것과 같은 change 이벤트를 내서
// 초안·요약·헤어 칸·목소리 칸이 함께 따라온다. 메이크업·의상·액세서리·메모는 그대로 둔다.
export function applyCastingItem(form,item){
  const pick=(name,value)=>{const field=Array.from(form?.elements||[]).find(el=>el.name===name&&el.value===value);if(!field)return false;field.checked=true;field.dispatchEvent(new Event('change',{bubbles:true}));return true;};
  return !!item&&pick('cast_modelId',item.modelId)&&pick('cast_hair',item.hair)&&pick('cast_voice',item.voice);
}
const codeModel=item=>CASTING_MODELS.find(m=>m.id===item?.modelId);
export function castingCodeLabel(item){
  const model=codeModel(item);if(!model)return '';const hair=CODE_HAIR.indexOf(item.hair),voice=model.voices.find(v=>v.id===item.voice);
  return `${model.name} · ${hair>=0?`헤어 ${hair+1} ${model.hairLabels[hair]}`:'헤어 미정'} · ${voice?`목소리 ${voice.id} ${voice.label}`:'목소리 미정'}`;
}
// review: 'confirmed'(고객이 확인한 설계) · 'requested'(확인 요청 중) · ''. 담당자가 모델을 바꾸면 확인과 요청은 이어지지 않는다(pulse-strategy).
export function castingCodeResult({text='',saved={},review='',fromIntake=false}={}){
  if(!String(text).trim())return '<p class="small">고객이 캐스팅북에서 보낸 문의 글을 통째로 붙여 넣어 주세요. 고른 모델·헤어·목소리를 읽어요.</p>';
  const {items,unknown}=readCastingCode(text);
  if(!items.length&&!unknown.length)return '<p class="small casting-code-miss">캐스팅북 조합을 찾지 못했어요. 캐스팅북 문의 글의 「1. F02 하린」과 「헤어 2번 / 목소리 1번」 줄이 들어 있어야 해요.</p>';
  const same=item=>saved?.modelId===item.modelId&&(saved.hair||'')===item.hair&&(saved.voice||'')===item.voice;
  const rows=items.map(item=>{const model=codeModel(item),hair=CODE_HAIR.indexOf(item.hair),voice=model.voices.find(v=>v.id===item.voice);
    return `<li class="casting-code-item${item.lead?' is-lead':''}">${model.image?`<img src="${esc(model.image)}" alt="" width="44" height="58" loading="lazy">`:''}<div class="casting-code-who"><strong>${esc(model.name)} <small>${esc(model.id)}</small>${item.lead?' <span class="tag berry">고객이 고른 모델</span>':''}</strong><dl><div><dt>헤어</dt><dd>${hair>=0?`${hair+1} · ${esc(model.hairLabels[hair])}`:'미정'}</dd></div><div><dt>목소리</dt><dd>${voice?`${esc(voice.id)} · ${esc(voice.label)}`:'미정'}</dd></div></dl></div>${same(item)?'<span class="tag green">지금 저장된 조합</span>':`<button type="button" class="button primary" data-action="casting-code-save" data-code="${esc(item.code)}" aria-label="${esc(model.name)} 조합으로 저장">이 조합으로 저장</button>`}</li>`;}).join('');
  const lead=items.find(item=>item.lead);
  const notes=[fromIntake&&items.length?'발주서 접수 글에서 찾은 조합이에요.':'',lead&&items.length>1?`고객은 ${codeModel(lead).name}${josa(codeModel(lead).name)} 진행하고 싶어 해요. 나머지는 함께 고민 중인 모델이에요.`:'',!lead&&items.length>1?`${items.length}명이 담겨 있어요. 고객과 정한 모델을 저장해 주세요.`:'',unknown.length?`작업 공간에 아직 없는 모델(${unknown.join(' · ')})은 빼고 읽었어요. 고객과 상담해 정해 주세요.`:'',items.length&&review==='confirmed'?'고객이 확인한 제작 설계예요. 모델을 바꿔 저장하면 고객이 새 버전을 다시 확인해요.':items.length&&review==='requested'?'고객에게 확인을 요청한 제작 설계예요. 모델을 바꿔 저장하면 요청이 취소되니 저장한 뒤 다시 요청해 주세요.':''].filter(Boolean);
  return `${rows?`<ul class="casting-code-list">${rows}</ul>`:''}${notes.map(note=>`<p class="small">${esc(note)}</p>`).join('')}`;
}
// 받침이 있으면 「으로」, 없으면 「로」(ㄹ 받침도 「로」).
const josa=word=>{const code=String(word||'').trim().slice(-1).charCodeAt(0)-0xac00;if(code<0||code>11171)return '(으)로';const last=code%28;return last===0||last===8?'로':'으로';};
// open: 담당자가 접거나 편 상태(null이면 글이 있을 때 편다). 접어 둔 칸이 화면을 다시 그릴 때마다 열리지 않게 한다(Fable 10-19).
export function castingCodeBox({text='',saved={},review='',fromIntake=false,open=null}={}){
  return `<details class="casting-code"${(open??!!String(text).trim())?' open':''}><summary><span><strong>캐스팅북 문의로 채우기</strong><small>고객이 캐스팅북에서 고른 모델·헤어·목소리를 그대로 저장해요</small></span></summary><div class="casting-code-body"><label class="field">고객이 보낸 캐스팅북 문의 글<textarea data-casting-code rows="3" maxlength="20000" spellcheck="false" autocomplete="off" placeholder="예: [진행하고 싶은 모델] 1. F02 하린 … 헤어 2번 하이 포니테일 / 목소리 1번 밝고 상큼한">${esc(text)}</textarea></label><div class="casting-code-result" data-casting-code-result aria-live="polite">${castingCodeResult({text,saved,review,fromIntake})}</div></div></details>`;
}
