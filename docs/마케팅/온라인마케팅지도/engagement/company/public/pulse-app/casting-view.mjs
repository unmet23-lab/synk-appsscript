import {esc} from './api.mjs';
import {CASTING_MODELS} from './casting-catalog.mjs';
import {hasFinishedFilms} from './films-view.mjs';

export const CASTING_OPTIONS={
  hair:{label:'헤어',values:{original:'대표 사진 그대로','look-2':'모델 헤어 2','look-3':'모델 헤어 3',short:'숏 헤어',bob:'단발', 'long-straight':'긴 생머리',wave:'웨이브',updo:'묶은 머리',custom:'직접 설명'}},
  makeup:{label:'메이크업',values:{natural:'내추럴',clean:'깔끔하고 단정하게',glow:'화사한 윤광',smoky:'스모키',custom:'직접 설명'}},
  jacket:{label:'자켓',values:{none:'없음',blazer:'블레이저',casual:'캐주얼 자켓',leather:'레더 자켓',custom:'직접 설명'}},
  top:{label:'상의',values:{tshirt:'티셔츠',shirt:'셔츠',knit:'니트',blouse:'블라우스',custom:'직접 설명'}},
  bottom:{label:'하의',values:{trousers:'슬랙스',denim:'데님',skirt:'스커트',custom:'직접 설명'}},
  earrings:{label:'귀걸이',values:{none:'없음',stud:'작은 스터드',hoop:'링 귀걸이',drop:'드롭 귀걸이',custom:'직접 설명'}},
  ring:{label:'반지',values:{none:'없음',simple:'심플한 반지',layered:'레이어드',custom:'직접 설명'}}
};
// voice는 11-03에 뺀 목소리 칸이다(유호님 「둘 다 전부 빼기」). 저장 모양을 그대로 두려고 키는 남기고, 옛 화면·저장본이 보내는
// A·B·C는 받되 늘 빈 값으로 둔다 — 서버(pulse-strategy의 normalizeCastingSelection)와 같은 규칙이다.
export const CASTING_KEYS=['modelId','hair','makeup','jacket','top','bottom','voice','earrings','ring','notes'];
export const emptyCastingSelection=()=>Object.fromEntries(CASTING_KEYS.map(key=>[key,'']));
export function normalizeDemoCasting(value){
  if(value===undefined)return emptyCastingSelection();
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!CASTING_KEYS.includes(key)))throw new Error('모델·스타일 선택 항목을 확인해 주세요.');
  const clean=emptyCastingSelection();
  for(const key of CASTING_KEYS){const v=value[key]??'';if(typeof v!=='string'||v.length>1000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))throw new Error('모델·스타일 입력을 확인해 주세요.');const allowed=key==='modelId'?CASTING_MODELS.map(m=>m.id):key==='voice'?['A','B','C']:key==='notes'?null:Object.keys(CASTING_OPTIONS[key].values);if(allowed&&v!==''&&!allowed.includes(v))throw new Error('모델·스타일 선택을 확인해 주세요.');clean[key]=v.trim();}
  clean.voice='';
  return clean;
}
export function castingFromForm(form){return Object.fromEntries(CASTING_KEYS.map(key=>{const fields=Array.from(form.elements).filter(field=>field.name==='cast_'+key);const field=fields.find(field=>field.type!=='radio'||field.checked);return [key,field?.value||''];}));}
export function takeCastingValues(values){const selection=Object.fromEntries(CASTING_KEYS.map(key=>[key,values['cast_'+key]||'']));for(const key of CASTING_KEYS)delete values['cast_'+key];return selection;}
const modelOf=selection=>CASTING_MODELS.find(m=>m.id===selection?.modelId);
export function castingSummary(selection={}){
  const model=modelOf(selection),rows=[['모델',model?`${model.name} · ${model.id}`:'미정'],...Object.entries(CASTING_OPTIONS).map(([key,option])=>[option.label,(key==='hair'&&model&&MODEL_HAIR[selection.hair]!==undefined&&model.hairLabels?.[MODEL_HAIR[selection.hair]])||option.values[selection[key]]||'미정'])];
  return `<dl class="casting-summary-list">${rows.map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}${selection.notes?`<div class="casting-note-row"><dt>기타·메모</dt><dd>${esc(selection.notes)}</dd></div>`:''}</dl>`;
}
// 헤어는 고른 모델의 헤어 셋(hairLabels)만, 남자 모델에게는 블라우스·스커트를 빼고 보인다. 이미 저장한 값은 「이전 선택」으로 남겨 잃지 않는다(10-19 검수).
const MODEL_HAIR={original:0,'look-2':1,'look-3':2},MALE_MODELS=new Set(CASTING_MODELS.filter(model=>model.gender==='남').map(model=>model.id));
function optionsFor(selection,key){
  const o=CASTING_OPTIONS[key],model=modelOf(selection),current=selection[key]||'';let entries=Object.entries(o.values);
  if(key==='hair')entries=model?.hairLabels?.length?[...model.hairLabels.slice(0,3).map((label,index)=>[['original','look-2','look-3'][index],label]),['custom',o.values.custom]]:entries.filter(([id])=>!['look-2','look-3'].includes(id));
  if((key==='top'||key==='bottom')&&model&&MALE_MODELS.has(model.id))entries=entries.filter(([id])=>!['blouse','skirt'].includes(id));
  if(current&&!entries.some(([id])=>id===current))entries.push([current,(o.values[current]||current)+' · 이전 선택']);
  return [['','미정'],...entries];
}
function choices(selection,key){const o=CASTING_OPTIONS[key];return `<fieldset class="casting-options" data-casting-choice="${key}"><legend>${o.label}</legend><div class="casting-chips">${optionsFor(selection,key).map(([id,label])=>`<label><input type="radio" name="cast_${key}" value="${esc(id)}" ${(selection[key]||'')===id?'checked':''}><span>${esc(label)}</span></label>`).join('')}</div></fieldset>`;}
// 모델은 사진만(2026-10-22 유호님 결정): 영상 칸·작품·광고 기획안을 거두고 그 모델의 사진 넉 장(전신·룩 둘·장면)만 보인다.
// 누르면 앱의 이미지 대화상자로 크게 본다. 사진을 더 보려면 공개 캐스팅북의 그 모델 쪽(북·디지털·장면·프로필)으로 간다.
export const CASTING_BOOK_URL='https://synk.im/pulse/casting/';
const photoSource=value=>typeof value==='string'&&/^\.\/assets\/casting\/photos\/[a-z]\d\d-[a-z0-9-]+\.webp$/.test(value)?value:'';
export function castingPhotos(selection={}){
  const model=modelOf(selection);if(!model)return '<p class="small casting-photos-empty">모델을 고르면 그 모델의 사진을 볼 수 있어요.</p>';
  const name=esc(model.name),photos=(Array.isArray(model.photos)?model.photos:[]).filter(photo=>photoSource(photo?.src));
  return `<div class="casting-photos-head"><div><span class="eyebrow ko">사진</span><h4>${name}의 사진</h4></div><span class="tag">${esc(model.id)}</span></div>${photos.length?`<ul class="casting-photo-grid">${photos.map(photo=>{const label=esc(model.name+' · '+photo.label);return `<li><button type="button" class="casting-photo" data-action="image" data-src="${esc(photo.src)}" data-label="${label}" aria-label="${label} 크게 보기"><img src="${esc(photo.src)}" alt="${label}" width="540" height="720" loading="lazy" decoding="async"></button><span>${esc(photo.label)}</span></li>`;}).join('')}</ul>`:''}<a class="casting-photos-more" href="${CASTING_BOOK_URL}#m-${esc(model.id)}" target="_blank" rel="noopener noreferrer">캐스팅북에서 ${name} 사진 더 보기 <span aria-hidden="true">↗</span><span class="sr-only"> (새 탭)</span></a>`;
}
// 목소리는 고르지 않는다(11-03 유호님 「둘 다 전부 빼기」): 모델마다 미리 만든 목소리 A·B·C와 듣기 단추를 거두고, 그 자리에 이 한 줄만 둔다.
export const CASTING_VOICE_NOTE='목소리는 광고 장면에 맞춰 연기로 만들고, 시안 단계에서 들려 드려요.';
export function castingView(selection={}, {editable=true}={}){return `<section class="casting-configurator" aria-label="모델과 스타일 선택" data-choices-model="${esc(selection.modelId||'')}">
  <div class="casting-intro"><span class="eyebrow ko">모델 · 스타일</span><h3>우리 광고에 어울리는 한 사람.</h3><p>모델과 스타일을 골라 원하는 장면을 그려 보세요. 정하지 않은 항목은 비워 둬도 괜찮아요.</p><p class="small">사진은 그 모델의 기준 이미지예요. 고른 스타일은 바라는 방향으로 남기고, 실제 모습은 담당자와 확인해요.</p>${hasFinishedFilms()?'<p class="small casting-films-link">SYNK가 처음부터 끝까지 만든 광고는 「완성 광고」에서 볼 수 있어요. <button type="button" class="casting-films-button" data-action="tab" data-tab="films">완성 광고 보기 <span aria-hidden="true">→</span></button></p>':''}</div>
  <fieldset class="casting-models"><legend><span>01</span> 모델 선택 <small>${CASTING_MODELS.length}명</small></legend><div class="casting-model-grid">${CASTING_MODELS.map(m=>`<label class="casting-model-card"><input type="radio" name="cast_modelId" value="${m.id}" ${selection.modelId===m.id?'checked':''}><span class="casting-model-photo">${m.image?`<img src="${esc(m.image)}" alt="${esc(m.name)} 대표 사진" loading="lazy" width="240" height="320"><span class="casting-image-error" hidden>사진을 불러오지 못했어요.</span>`:`<span class="casting-photo-pending"><b>${esc(m.id)}</b>대표 사진 준비 중</span>`}<span class="casting-selected-mark" aria-hidden="true">✓</span></span><span class="casting-model-text"><strong>${esc(m.name)} <small>${esc(m.id)}</small></strong><span>${esc(m.description)}</span></span></label>`).join('')}</div><label class="casting-undecided"><input type="radio" name="cast_modelId" value="" ${selection.modelId?'':'checked'}> 모델은 나중에 정할게요</label></fieldset>
  <div data-casting-photos class="casting-photos">${castingPhotos(selection)}</div>
  <section class="casting-step"><h4><span>02</span> 헤어 · 메이크업</h4><p class="small">헤어는 고른 모델에게 맞는 셋 중에서 고를 수 있어요.</p>${choices(selection,'hair')}${choices(selection,'makeup')}</section>
  <section class="casting-step"><h4><span>03</span> 의상</h4><p class="small">브랜드의 실제 의류를 쓰려면 ‘직접 설명’을 고르고 참고자료를 취향 보드에 추가해 주세요.</p>${choices(selection,'jacket')}${choices(selection,'top')}${choices(selection,'bottom')}</section>
  <p class="small casting-voice-note">${esc(CASTING_VOICE_NOTE)}</p>
  <section class="casting-step"><h4><span>04</span> 액세서리</h4>${choices(selection,'earrings')}${choices(selection,'ring')}<label class="field casting-notes">기타·메모<textarea name="cast_notes" rows="3" maxlength="1000" placeholder="예: 검정 블레이저에 브랜드 셔츠. 귀걸이는 작은 은색 스터드로 부탁드려요.">${esc(selection.notes||'')}</textarea><small>직접 설명을 고른 항목, 색상·제품명·피하고 싶은 표현을 적어 주세요.</small></label></section>
  <section class="casting-current" aria-label="현재 모델과 스타일 선택"><h4>지금 고른 조합 <span class="tag">${editable?'선택 미리보기':'저장한 선택'}</span></h4><div data-casting-summary>${castingSummary(selection)}</div>${editable?'<p class="small">저장하면 이 선택이 제작 설계에 함께 남아요. 모델·스타일만 바꾸면 이미 확인한 제작 설계는 그대로예요.</p><button type="submit" class="button primary" data-mutate>모델·스타일 저장</button>':'<p class="small">이 프로젝트에 저장된 모델과 스타일이에요.</p>'}</section>
</section>`;}

export function refreshCasting(form,{modelChanged=false}={}){
  const root=form?.querySelector('.casting-configurator');if(!root)return;
  let selection=castingFromForm(form);
  if(modelChanged){for(const key of ['hair','top','bottom']){const box=root.querySelector(`[data-casting-choice="${key}"]`);if(box)box.outerHTML=choices(selection,key);}if(root.dataset)root.dataset.choicesModel=selection.modelId||'';}
  root.querySelector('[data-casting-summary]').innerHTML=castingSummary(selection);
  const photos=root.querySelector('[data-casting-photos]');if(photos.dataset.model!==(selection.modelId||'')){photos.innerHTML=castingPhotos(selection);photos.dataset.model=selection.modelId||'';}
  for(const img of root.querySelectorAll('.casting-model-photo img'))img.onerror=()=>{img.hidden=true;img.nextElementSibling.hidden=false;};
  // 못 불러온 사진은 깨진 그림 대신 그 칸째 숨긴다.
  for(const img of root.querySelectorAll('.casting-photo img'))img.onerror=()=>{const cell=img.closest('li');if(cell)cell.hidden=true;};
}
// 저장 전에 다른 모델을 고른 채로 화면을 다시 그리면(실시간 갱신·탭 이동) 헤어·상의·하의 칸이 저장한 모델 기준으로 그려져,
// 그 칸에 없는 값(모델 없이 저장한 설계의 「헤어 2」 등)이 되살아나지 못하고 빠졌다. 초안 값으로 그 모델의 칸을 다시 만든다(10-19).
export function syncCastingChoices(form,values={}){
  const root=form?.querySelector('.casting-configurator');if(!root)return false;
  const selection=castingFromForm(form);for(const key of CASTING_KEYS)if(typeof values?.['cast_'+key]==='string')selection[key]=values['cast_'+key];
  if(!root.dataset||(root.dataset.choicesModel||'')===(selection.modelId||''))return false;
  for(const key of ['hair','top','bottom']){const box=root.querySelector(`[data-casting-choice="${key}"]`);if(box)box.outerHTML=choices(selection,key);}
  root.dataset.choicesModel=selection.modelId||'';return true;
}

// ── 캐스팅북 문의 → 제작 설계(2026-10-19) ──
// 손님은 캐스팅북 문의 글을 보내기만 한다. 담당자는 그 글을 통째로 붙여 넣으면 된다. 캐스팅북이 쓰는 사람 글 줄을 읽는다:
//   크몽 「[진행하고 싶은 모델]」·「[함께 고민 중인 모델]」·「[고른 모델]」 아래 「1. F02 하린 (…)」 + 「   헤어 2번 …」,
//   발주서 메모 「[진행할 모델] F02 …」·「[함께 고민 중인 모델] F04 …」·「[모델 1] F02 …」 + 「헤어: 2번 …」(번호는 1부터).
// 사람 글 줄이 없을 때만 코드 「모델 코드.헤어 번호」(번호는 0부터, 캐스팅북 공유 주소 #p- 뒤·예전 문의 글 끝 줄·손으로 친 코드)를 읽는다.
// 문의 글에 공유 주소가 함께 붙어 와도 손님이 고른 순서(「진행하고 싶은 모델」)가 담긴 사람 글 줄이 이긴다.
// 이 앱에 아직 없는 모델(캐스팅북에 먼저 들어온 새 모델)은 unknown으로 돌려준다. 헤어 번호는 고른 모델의 헤어 1·2·3(original·look-2·look-3)이다.
// 범위 밖이거나 글에 없는 번호는 그 칸만 미정으로 둔다(코드에는 9로 적어 다시 읽어도 미정).
// 11-03 목소리를 뺐다: 예전에 나간 글의 「목소리 1번」 줄과 세 자리 코드 「F02.1.0」의 끝 번호(목소리)는 읽되 버린다.
const CODE_HAIR=['original','look-2','look-3'];
// 앞 경계는 뒤보기((?<!…)) 대신 잡는 묶음으로 본다: 뒤보기는 Safari 16.4부터라 그 전 iPhone에서 이 모듈(앱 전체)이 열리지 않는다.
const CODE_TOKEN=/(^|[^A-Za-z0-9.])([A-Za-z]\d\d)\.(\d)(?:\.\d)?(?![A-Za-z0-9]|\.\d)/g;
const LINE_MODEL=/^\s*(?:\d+\.|\[(?:모델\s*\d+|진행할 모델|함께 고민 중인 모델)\])\s*([A-Za-z]\d\d)(?![A-Za-z0-9.])/;
const LINE_HEADER=/^\s*\[([^\]]+)\]\s*$/;
// 메모·대사·들어 보고 싶은 문장 줄은 손님이 쓴 말이라 그 안의 「헤어 3번」을 고른 번호로 읽지 않는다.
const LINE_ASIDE=/^\s*(?:메모|대사|이 목소리로 들어 보고 싶은 문장)\s*[:：]/;
function readCastingLines(text){
  const picks=[];let current=null,section='',leadTaken=false;
  for(const line of text.split(/\r?\n/)){
    const header=LINE_HEADER.exec(line);
    if(header){section=header[1].trim();current=null;continue;}
    const model=LINE_MODEL.exec(line);
    // 진행하고 싶은 모델은 한 명이다. 손님이 머리줄을 지워 한 묶음에 여럿이 들어와도 첫 모델만 고른 모델로 본다.
    if(model){const lead=!leadTaken&&(/^\s*\[진행할 모델\]/.test(line)||section==='진행하고 싶은 모델');if(lead)leadTaken=true;current={id:model[1],hair:null,lead};picks.push(current);continue;}
    if(!current)continue;
    if(!line.trim()||/^\s*\[/.test(line)){current=null;continue;}
    if(LINE_ASIDE.test(line))continue;
    const hair=/헤어\s*:?\s*(\d+)\s*번/.exec(line);
    if(hair&&current.hair===null)current.hair=Number(hair[1])-1;
  }
  return picks;
}
export function readCastingCode(text){
  const source=String(text??'').slice(0,200000),items=[],unknown=[],codes=[],seen=new Set();
  const digit=n=>Number.isInteger(n)&&n>=0&&n<=8?n:9;
  const add=(raw,hair,lead=false)=>{
    // 같은 모델은 한 번만 세므로 명단(11-02 열세 명)보다 많아질 수 없다 — 패키지에 열 명 넘게 담아도 버리지 않는다.
    const id=raw.toUpperCase();if(seen.has(id))return;seen.add(id);
    const code=`${id}.${digit(hair)}`;codes.push(code);
    const model=CASTING_MODELS.find(m=>m.id===id);
    if(!model){unknown.push(id);return;}
    items.push({modelId:id,hair:model.hairLabels?.[hair]&&CODE_HAIR[hair]||'',code,lead});
  };
  for(const pick of readCastingLines(source))add(pick.id,pick.hair,pick.lead);
  if(!seen.size)for(const [,,id,hair] of source.matchAll(CODE_TOKEN))add(id,Number(hair));
  items.sort((a,b)=>Number(b.lead)-Number(a.lead));
  return {items,unknown,codes};
}
// 발주서로 들어온 접수 글(가져온 프로젝트의 intake)에서 찾은 조합을 담당자 칸에 미리 넣을 글로 돌려준다(읽은 그대로의 짧은 사람 글).
export function intakeCastingText(intake){
  const {items,unknown}=readCastingCode([intake?.reportText,intake?.notes].filter(value=>typeof value==='string').join('\n'));
  if(!items.length&&!unknown.length)return '';
  const line=(item,index)=>{const model=codeModel(item),hair=CODE_HAIR.indexOf(item.hair);return `${index+1}. ${item.modelId} ${model.name}${hair>=0?`\n   헤어 ${hair+1}번 ${model.hairLabels[hair]}`:''}`;};
  const lead=items.filter(item=>item.lead),rest=[...items.filter(item=>!item.lead).map((item,index)=>line(item,index+lead.length)),...unknown.map((id,index)=>`${items.length+index+1}. ${id}`)];
  return [lead.length?`[진행하고 싶은 모델]\n${lead.map(line).join('\n')}`:'',rest.length?`${lead.length?'[함께 고민 중인 모델]':'[고른 모델]'}\n${rest.join('\n')}`:''].filter(Boolean).join('\n\n');
}
// 담당자가 고른 조합을 양식에 넣는다. 사람이 모델 → 헤어 순서로 누른 것과 같은 change 이벤트를 내서
// 초안·요약·헤어 칸이 함께 따라온다. 메이크업·의상·액세서리·메모는 그대로 둔다.
export function applyCastingItem(form,item){
  const pick=(name,value)=>{const field=Array.from(form?.elements||[]).find(el=>el.name===name&&el.value===value);if(!field)return false;field.checked=true;field.dispatchEvent(new Event('change',{bubbles:true}));return true;};
  return !!item&&pick('cast_modelId',item.modelId)&&pick('cast_hair',item.hair);
}
const codeModel=item=>CASTING_MODELS.find(m=>m.id===item?.modelId);
export function castingCodeLabel(item){
  const model=codeModel(item);if(!model)return '';const hair=CODE_HAIR.indexOf(item.hair);
  return `${model.name} · ${hair>=0?`헤어 ${hair+1} ${model.hairLabels[hair]}`:'헤어 미정'}`;
}
// review: 'confirmed'(고객이 확인한 설계) · 'requested'(확인 요청 중) · ''. 담당자가 모델을 바꾸면 확인과 요청은 이어지지 않는다(pulse-strategy).
export function castingCodeResult({text='',saved={},review='',fromIntake=false}={}){
  if(!String(text).trim())return '<p class="small">고객이 캐스팅북에서 보낸 문의 글을 통째로 붙여 넣어 주세요. 고른 모델·헤어를 읽어요.</p>';
  const {items,unknown}=readCastingCode(text);
  if(!items.length&&!unknown.length)return '<p class="small casting-code-miss">캐스팅북 조합을 찾지 못했어요. 캐스팅북 문의 글의 「1. F02 하린」과 「헤어 2번」 줄이 들어 있어야 해요.</p>';
  const same=item=>saved?.modelId===item.modelId&&(saved.hair||'')===item.hair;
  const rows=items.map(item=>{const model=codeModel(item),hair=CODE_HAIR.indexOf(item.hair);
    return `<li class="casting-code-item${item.lead?' is-lead':''}">${model.image?`<img src="${esc(model.image)}" alt="" width="44" height="58" loading="lazy">`:''}<div class="casting-code-who"><strong>${esc(model.name)} <small>${esc(model.id)}</small>${item.lead?' <span class="tag berry">고객이 고른 모델</span>':''}</strong><dl><div><dt>헤어</dt><dd>${hair>=0?`${hair+1} · ${esc(model.hairLabels[hair])}`:'미정'}</dd></div></dl></div>${same(item)?'<span class="tag green">지금 저장된 조합</span>':`<button type="button" class="button primary" data-action="casting-code-save" data-code="${esc(item.code)}" aria-label="${esc(model.name)} 조합으로 저장">이 조합으로 저장</button>`}</li>`;}).join('');
  const lead=items.find(item=>item.lead);
  const notes=[fromIntake&&items.length?'발주서 접수 글에서 찾은 조합이에요.':'',lead&&items.length>1?`고객은 ${codeModel(lead).name}${josa(codeModel(lead).name)} 진행하고 싶어 해요. 나머지는 함께 고민 중인 모델이에요.`:'',!lead&&items.length>1?`${items.length}명이 담겨 있어요. 고객과 정한 모델을 저장해 주세요.`:'',unknown.length?`작업 공간에 아직 없는 모델(${unknown.join(' · ')})은 빼고 읽었어요. 고객과 상담해 정해 주세요.`:'',items.length&&review==='confirmed'?'고객이 확인한 제작 설계예요. 모델을 바꿔 저장하면 고객이 새 버전을 다시 확인해요.':items.length&&review==='requested'?'고객에게 확인을 요청한 제작 설계예요. 모델을 바꿔 저장하면 요청이 취소되니 저장한 뒤 다시 요청해 주세요.':''].filter(Boolean);
  return `${rows?`<ul class="casting-code-list">${rows}</ul>`:''}${notes.map(note=>`<p class="small">${esc(note)}</p>`).join('')}`;
}
// 받침이 있으면 「으로」, 없으면 「로」(ㄹ 받침도 「로」).
const josa=word=>{const code=String(word||'').trim().slice(-1).charCodeAt(0)-0xac00;if(code<0||code>11171)return '(으)로';const last=code%28;return last===0||last===8?'로':'으로';};
// open: 담당자가 접거나 편 상태(null이면 글이 있을 때 편다). 접어 둔 칸이 화면을 다시 그릴 때마다 열리지 않게 한다(검수 10-19).
export function castingCodeBox({text='',saved={},review='',fromIntake=false,open=null}={}){
  return `<details class="casting-code"${(open??!!String(text).trim())?' open':''}><summary><span><strong>캐스팅북 문의로 채우기</strong><small>고객이 캐스팅북에서 고른 모델·헤어를 그대로 저장해요</small></span></summary><div class="casting-code-body"><label class="field">고객이 보낸 캐스팅북 문의 글<textarea data-casting-code rows="3" maxlength="20000" spellcheck="false" autocomplete="off" placeholder="예: [진행하고 싶은 모델] 1. F02 하린 … 헤어 2번 하이 포니테일">${esc(text)}</textarea></label><div class="casting-code-result" data-casting-code-result aria-live="polite">${castingCodeResult({text,saved,review,fromIntake})}</div></div></details>`;
}
