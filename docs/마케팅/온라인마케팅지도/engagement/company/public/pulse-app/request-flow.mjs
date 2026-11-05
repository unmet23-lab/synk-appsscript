import {esc} from './api.mjs';
import {CASTING_MODELS} from './casting-catalog.mjs';
import {KINDS,CHANNELS,PACKAGES,slotsFor,WATCH_WORDS,ACTIONS,WIN,REFERENCE_POINTS,MODEL_LINES,MODEL_PICKS,STEPS,emptyAnswers,photoAdvice,price,DRAFT_FILES_GONE,pkgOf,kindOf,channelText,modelOf,modelList,filesOf,slotCount,briefRows,ratioOf} from './request-data.mjs';
import {rise,riseAll,sink,revealWords,roll,typeIn,play,ease,reduced} from './motion.mjs';

// 고객이 초대 없이 직접 시작하는 의뢰서(2026-11-04 유호님 「클라이언트가 의뢰 > 준비할 것들 작성 > 너와 내가 확인 > 1차 전달 후 수정 > 제작」).
// 시사실 판(2026-11-05): 왼쪽은 묻는 말 하나, 오른쪽은 온 화면 스크린이다. 고른 답이 스크린에서 바로 어떻게 되는지 보이고, 답은 크레딧처럼 스크린 아래에 쌓인다. 어떤 칸도 보내기를 막지 않고, 없으면 무엇이 달라지는지만 말한다.
const ASSET='./assets/request/';
const still=name=>`${ASSET}${name}.webp`;
const RATIO_STILL={'9:16':'shard','16:9':'w-maejin','1:1':'shard'};
const arrow='<svg class="sx-arw" viewBox="0 0 40 16" aria-hidden="true"><path d="M0 8h38M31 1l7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
// 손님이 올린 첫 사진. 있으면 스크린에 남의 작품 대신 이 사진을 놓는다.
const ownPhoto=a=>Object.values(a.slots).flatMap(slot=>slot.files||[]).find(file=>file.preview&&!file.error)?.preview||'';
const sceneOf=item=>item.photos?.find(photo=>photo.kind==='scene')?.src||item.image;
const bigScene=item=>`${ASSET}model-scene-${String(item.id).toLowerCase()}.webp`;

const part=(step,index,total)=>`<p class="sx-q-part"><span class="sx-no">${String(index+1).padStart(2,'0')} / ${String(total).padStart(2,'0')}</span><b>${esc(step.part)}</b></p>`;
const ask=(step,index,total,title,lead,body)=>`${part(step,index,total)}<h1 class="sx-q-title sx-serif" tabindex="-1" data-title>${esc(title)}</h1>${lead?`<p class="sx-body sx-q-lead" data-in>${esc(lead)}</p>`:''}${body}`;
const row=({i,label,note,on,attr,meta=''})=>`<button type="button" class="sx-row ${on?'is-on':''}" role="radio" aria-checked="${on?'true':'false'}" ${attr} data-in><span class="sx-no">${String(i+1).padStart(2,'0')}</span><span class="sx-row-main"><b class="sx-serif">${esc(label)}</b>${note?`<small class="sx-small">${esc(note)}</small>`:''}</span>${meta?`<span class="sx-row-meta">${meta}</span>`:''}<span class="sx-row-mark" aria-hidden="true"></span></button>`;
const field=({bind,label,value,placeholder='',help='',type='text',rows=0,max=400,auto=''})=>`<label class="sx-field" data-in><span class="sx-small">${esc(label)}</span>${rows?`<textarea data-bind="${bind}" rows="${rows}" maxlength="${max}" placeholder="${esc(placeholder)}">${esc(value)}</textarea>`:`<input data-bind="${bind}" type="${type}" value="${esc(value)}" maxlength="${max}" placeholder="${esc(placeholder)}" ${auto?`autocomplete="${auto}"`:''}>`}${help?`<small class="sx-small">${esc(help)}</small>`:''}</label>`;
const chip=(label,on,attr)=>`<button type="button" class="sx-chip ${on?'is-on':''}" aria-pressed="${on?'true':'false'}" ${attr}>${esc(label)}</button>`;
// 모델 고르기: 제작사가 이 광고에 고른 넷을 크게 보여 준다. 고른 모델이 넷 밖이면 앞에 세우고, 손을 올리거나 고른 한 명이 크게 선다. 21명은 손님이 열 때만 펼친다.
const castLine=item=>MODEL_LINES[item.id]?.line||item.description;
const castTile=(a,item,fit)=>`<button type="button" class="sx-cast ${a.models.includes(item.id)?'is-on':''}" aria-pressed="${a.models.includes(item.id)?'true':'false'}" aria-label="${esc(item.name)} · ${esc(castLine(item))}${fit?' · 이 업종에 잘 맞아요':''}" data-do="model" data-id="${item.id}"><img src="${esc(sceneOf(item))}" alt="" loading="lazy" decoding="async" width="538" height="720"><span class="sx-cast-name sx-small">${esc(item.name)}</span><i class="sx-cast-mark sx-no" aria-hidden="true">${a.models.indexOf(item.id)+1||''}</i></button>`;
const picksOf=a=>(MODEL_PICKS[a.kind]||MODEL_PICKS.brand).map(modelOf).filter(Boolean);
const wall=a=>{
  const chosen=a.models.map(modelOf).filter(Boolean),picks=[...new Set([...chosen,...picksOf(a)])].slice(0,4),lead=chosen[0]||picks[0];
  return `<div class="sx-casting" role="group" aria-label="이 광고에 어울리는 모델"><figure class="sx-casting-lead" aria-hidden="true"><img data-portrait src="${esc(bigScene(lead))}" alt="" decoding="async"><figcaption class="sx-small" data-portrait-name>${esc(lead.name)} · ${esc(castLine(lead))}</figcaption></figure>${picks.map(item=>castTile(a,item,!!MODEL_LINES[item.id]?.fits.includes(a.kind))).join('')}<button type="button" class="sx-small sx-link sx-casting-all" data-do="allmodels">21명 모두 보기</button></div>`;
};
const allWall=a=>{
  const fit=item=>!!MODEL_LINES[item.id]?.fits.includes(a.kind);
  return `<div class="sx-wall" role="group" aria-label="모델 21명">${[...CASTING_MODELS.filter(fit),...CASTING_MODELS.filter(item=>!fit(item))].map(item=>castTile(a,item,fit(item))).join('')}<button type="button" class="sx-small sx-link sx-wall-close" data-do="allmodels">넷만 보기</button></div>`;
};

const views={
  what(a,step,i,n){
    return ask(step,i,n,'무엇을 광고할까요?','종류에 따라 준비하실 것이 달라져요. 맞는 것 하나만 골라 주세요.',
      field({bind:'name',label:'제품이나 브랜드 이름',value:a.name,placeholder:'예) 오미톡 오미자 스파클링',max:120})+
      `<div class="sx-rows" role="radiogroup" aria-label="광고할 것의 종류">${KINDS.map((item,index)=>row({i:index,label:item.label,note:item.note,on:a.kind===item.id,attr:`data-do="kind" data-id="${item.id}"`})).join('')}</div>`);
  },
  where(a,step,i,n){
    return ask(step,i,n,'어디에 올리고, 얼마나 길게 할까요?','올릴 곳에 따라 화면 비율이 정해져요. 모르면 비워 두셔도 저희가 제안해요.',
      `<div class="sx-chips" data-in role="group" aria-label="올릴 곳">${CHANNELS.map(item=>chip(item.label,a.channels.includes(item.id),`data-do="channel" data-id="${item.id}"`)).join('')}</div>`+
      `<div class="sx-rows is-tight" role="radiogroup" aria-label="길이와 구성">${PACKAGES.map((item,index)=>row({i:index,label:item.label,note:item.note?`${item.title} · ${item.note}`:item.title,on:a.package===item.id,attr:`data-do="package" data-id="${item.id}"`,meta:`<span class="sx-small">${price(item.price)}부터</span>`})).join('')}${row({i:PACKAGES.length,label:'추천해 주세요',note:'올릴 곳을 보고 맞는 구성을 말씀드려요',on:a.package==='ask',attr:'data-do="package" data-id="ask"'})}</div>`+
      `<label class="sx-tick" data-in><input type="checkbox" data-bind="paid" ${a.paid?'checked':''}><span>광고비를 써서 돌릴 거예요</span><small class="sx-small">심사에 필요한 표시와 규격까지 함께 챙겨 드려요.</small></label>`);
  },
  files(a,step,i,n){
    const slots=slotsFor(a.kind);
    return ask(step,i,n,'이것만 보내 주세요','제품 · 로고 · 글자는 AI로 다시 그리지 않고 보내 주신 파일을 그대로 얹어요. 그래서 원본이 중요해요. 지금 없는 건 나중에 보내도 돼요.',
      `<div class="sx-slots">${slots.map(slotView.bind(null,a)).join('')}</div>`+
      field({bind:'pageUrl',label:'제품 · 서비스 페이지 주소',value:a.pageUrl,placeholder:'https://',help:'여기 적힌 내용은 다시 적지 않으셔도 돼요.',type:'url',max:1000})+
      (slots===slotsFor('food')?field({bind:'size',label:'손에 들면 어느 정도 크기인가요?',value:a.size,placeholder:'예) 355ml 캔, 손바닥 안에 들어와요',max:120}):'')+
      field({bind:'driveUrl',label:'파일이 크면 드라이브 링크로',value:a.driveUrl,placeholder:'https://',type:'url',max:1000}));
  },
  message(a,step,i,n){
    return ask(step,i,n,'보는 사람에게 무엇을 남길까요?','광고 문장이 아니어도 돼요. 평소 하시는 말로 적어 주시면 저희가 한 문장으로 다듬어 1차안에 보여 드려요.',
      field({bind:'audience',label:'이 제품은 누가, 언제 찾나요?',value:a.audience,placeholder:'예) 운동 끝나고 목마른 20대, 출근 전 시간이 없는 직장인',rows:2,max:300})+
      field({bind:'oneThing',label:'딱 하나만 남긴다면요?',value:a.oneThing,placeholder:'예) 한 캔에 맛이 다섯 번 바뀐다',rows:2,max:300})+
      `<div class="sx-sub" data-in><span class="sx-small">보고 나서 무엇을 하면 좋을까요?</span><div class="sx-chips">${ACTIONS.map(item=>chip(item.label,a.action===item.id,`data-do="action" data-id="${item.id}"`)).join('')}</div></div>`);
  },
  words(a,step,i,n){
    const watch=WATCH_WORDS[a.kind]||WATCH_WORDS.brand;
    return ask(step,i,n,'화면에 정확히 나와야 할 글자가 있나요?','제품명 표기, 가격, 기간, 꼭 넣어야 할 안내처럼 한 글자도 바뀌면 안 되는 말이에요. 화면에 바로 얹어 볼게요.',
      field({bind:'screenText',label:'화면에 나올 글자',value:a.screenText,placeholder:'예) 다섯 가지 맛, 톡.\n11월 편의점 출시',rows:3,max:300})+
      `<div class="sx-sub" data-in><span class="sx-small">쓰면 안 되는 말 · 업종마다 자주 걸리는 말이에요. 빼야 하는 말을 눌러 주세요.</span><div class="sx-chips">${watch.map(word=>chip(word,a.avoid.includes(word),`data-do="avoid" data-id="${esc(word)}"`)).join('')}</div></div>`+
      field({bind:'avoidNote',label:'그 밖에 피할 말이나 표현',value:a.avoidNote,placeholder:'예) 경쟁사 이름, 과한 표정',max:300})+
      field({bind:'facts',label:'자랑해도 되는 사실 · 선택',value:a.facts,placeholder:'예) 누적 판매 12만 개, ○○ 인증',help:'자료가 있는 것만 적어 주세요. 그 자료도 준비물에 함께 넣어 주시면 좋아요.',max:300}));
  },
  feel(a,step,i,n){
    const ref=a.refs[0]||{url:'',points:[],why:''};
    return ask(step,i,n,'무엇으로 오래 남을까요?','광고는 보통 둘 중 하나로 이겨요. 기획 첫 줄에 이것부터 정해요.',
      `<div class="sx-rows" role="radiogroup" aria-label="무엇으로 남길지">${WIN.map((item,index)=>row({i:index,label:item.label,note:item.note,on:a.win===item.id,attr:`data-do="win" data-id="${item.id}"`})).join('')}${row({i:WIN.length,label:'맡길게요',note:'제품에 맞는 쪽을 1차안에서 제안해요',on:a.win==='ask',attr:'data-do="win" data-id="ask"'})}</div>`+
      field({bind:'refUrl',label:'이런 광고면 좋겠어요 · 링크',value:ref.url,placeholder:'https://',type:'url',max:1000,help:'반응이 좋았던 광고의 짜임을 재서 뼈대로 쓰기 때문에, 참고 영상 하나가 말 열 줄보다 큰 힘이 돼요.'})+
      `<div class="sx-sub" data-in><span class="sx-small">그 광고의 어디가 좋았나요?</span><div class="sx-chips">${REFERENCE_POINTS.map(point=>chip(point,ref.points.includes(point),`data-do="refpoint" data-id="${esc(point)}"`)).join('')}</div></div>`+
      field({bind:'avoidFeel',label:'이런 느낌은 피해 주세요 · 선택',value:a.avoidFeel,placeholder:'예) 홈쇼핑 같은 느낌',max:200}));
  },
  model(a,step,i,n){
    const first=modelOf(a.models[0])||picksOf(a)[0]||CASTING_MODELS[2];
    return ask(step,i,n,'누가 나올까요?','이름과 얼굴이 정해진 AI 모델 21명이에요. 다음 편도 같은 모델로 이어 가요. 두 명까지 고르실 수 있어요.',
      `<div class="sx-chips" data-in role="group" aria-label="모델을 어떻게 정할지">${chip('추천해 주세요',a.modelChoice==='ask','data-do="modelchoice" data-id="ask"')}${chip('사람 없이 제품만',a.modelChoice==='none','data-do="modelchoice" data-id="none"')}</div>`+
      `<div class="sx-q-who" data-in><b class="sx-serif" data-cast-name>${esc(first.name)}</b><span class="sx-body" data-cast-line>${esc(MODEL_LINES[first.id]?.line||'')}</span><small class="sx-small" data-cast-desc>${esc(first.description)}</small></div>`);
  },
  contact(a,step,i,n){
    return ask(step,i,n,'언제까지, 누구에게 연락드릴까요?','',
      `<div class="sx-duo">${field({bind:'date',label:'받고 싶은 날',value:a.date,type:'date'})}<div class="sx-sub is-end" data-in>${chip('정해진 날짜는 없어요',a.dateFree,'data-do="datefree"')}</div></div><p class="sx-small sx-q-advice" data-date-advice hidden></p>`+
      `<div class="sx-sub" data-in><span class="sx-small">최종 확인은 누가 하나요?</span><div class="sx-chips">${chip('제가 정해요',a.approver==='one','data-do="approver" data-id="one"')}${chip('여러 명이 봐요',a.approver==='many','data-do="approver" data-id="many"')}</div><div data-approver-more>${approverMore(a)}</div></div>`+
      `<div class="sx-duo">${field({bind:'contactName',label:'성함',value:a.contactName,auto:'name',max:80})}${field({bind:'company',label:'회사 · 브랜드 · 선택',value:a.company,auto:'organization',max:120})}</div>`+
      `<div class="sx-duo">${field({bind:'email',label:'이메일',value:a.email,type:'email',auto:'email',max:254})}${field({bind:'phone',label:'휴대폰 · 선택',value:a.phone,type:'tel',auto:'tel',max:30})}</div>`);
  },
  review(a,step,i,n){
    return ask(step,i,n,'이대로 보낼까요?','보내 주시면 저희가 내용을 확인하고 진행과 값을 안내해 드려요. 영상을 만들기 전에 한 문장 · 글 콘티 · 컷마다 장면 이미지를 먼저 보여 드리고, 확인하시기 전에는 영상을 만들지 않아요.',
      `<div class="sx-brief" data-in>${briefRows(a).map(item=>`<div class="sx-brief-row ${item.missing?'is-missing':''}"><span class="sx-small">${esc(item.key)}</span><span class="sx-brief-val">${item.missing?`<em>${esc(item.missing)}</em>`:esc(item.value)}</span><button type="button" class="sx-small sx-brief-edit" data-do="goto" data-id="${item.step}" aria-label="${esc(item.key)} 고치기">고치기</button></div>`).join('')}</div>`+
      `<label class="sx-tick" data-in><input type="checkbox" data-bind="consent" ${a.consent?'checked':''}><span>이 내용과 연락처를 의뢰 확인과 제작에 쓰는 데 동의해요</span><small class="sx-small">제작으로 이어지지 않으면 90일 뒤 지워요.</small></label>`+
      `<label class="sx-tick" data-in><input type="checkbox" data-bind="rights" ${a.rights?'checked':''}><span>보내는 사진 · 로고 · 문구를 쓸 권리가 있어요</span><small class="sx-small">영상 속 사람과 목소리는 모두 AI로 만들어요. 실존 인물을 닮게 만드는 요청은 받지 않아요.</small></label>`);
  },
};
const approverMore=a=>a.approver==='many'?`<small class="sx-small sx-q-hint">의견을 모아 한 번에 보내 주시면 수정이 크게 줄어요. 컷마다 의견을 모아 보낼 수 있어요.</small>${field({bind:'approverName',label:'최종 결정하시는 분 · 선택',value:a.approverName,max:80})}`:'';
function slotView(a,slot){
  const files=filesOf(a,slot.id),none=a.slots[slot.id]?.none;
  return `<article class="sx-slot ${files.length?'has-file':''} ${none?'is-none':''}" data-slot="${slot.id}" data-in>
    <label class="sx-slot-frame"><input type="file" class="sr" data-file="${slot.id}" accept="${esc(slot.accept)}" aria-label="${esc(slot.label)} 파일 고르기" ${slot.multiple?'multiple':''}>${files.length?files.slice(0,3).map(fileThumb).join(''):'<span class="sx-slot-plus" aria-hidden="true">+</span>'}</label>
    <div class="sx-slot-text"><h3>${esc(slot.label)}<span class="sx-small">${slot.need?'꼭':'있으면'}</span></h3><p class="sx-small">${esc(slot.why)}</p>
      <div class="sx-small sx-slot-status" data-status="${slot.id}">${slotStatus(a,slot)}</div>
      ${files.length?`<ul class="sx-slot-files">${files.map((file,i)=>`<li class="sx-small"><span>${esc(file.fileName)}</span>${file.uploading?'':`<button type="button" class="sx-link" data-do="removefile" data-slot-id="${slot.id}" data-at="${i}" aria-label="${esc(file.fileName)} 지우기">지우기</button>`}</li>`).join('')}</ul>`:''}
      ${slot.note?`<input class="sx-slot-note" data-bind="useNote" value="${esc(a.useNote)}" maxlength="200" placeholder="${esc(slot.note)}" aria-label="${esc(slot.label)} 한 줄로 적기">`:''}
      ${slot.need?`<button type="button" class="sx-chip is-small ${none?'is-on':''}" data-do="none" data-id="${slot.id}" aria-pressed="${none?'true':'false'}">지금 없어요</button>`:''}
    </div></article>`;
}
const fileThumb=file=>file.preview?`<img src="${esc(file.preview)}" alt="${esc(file.fileName)}">`:`<span class="sx-slot-doc sx-no">${esc((file.fileName.split('.').pop()||'FILE').toUpperCase().slice(0,4))}</span>`;
function slotStatus(a,slot){
  const files=filesOf(a,slot.id);
  if(a.slots[slot.id]?.none)return '<i class="sx-led is-wait"></i>나중에 보내 주세요. 1차안에는 자리만 잡아 둘게요.';
  if(!files.length)return '';
  const last=files[files.length-1];
  if(last.uploading)return `<i class="sx-led is-busy"></i>올리는 중 ${Math.round((last.progress||0)*100)}%`;
  if(last.error)return `<i class="sx-led is-wait"></i>${esc(last.error)}`;
  return `<i class="sx-led ${last.advice?.state==='note'?'is-wait':'is-ok'}"></i>${esc(last.advice?.text||`${files.length}개 받았어요`)}`;
}
// 스크린 아래 크레딧: 고른 것이 한 줄씩 쌓인다.
function slateRows(a){
  const pkg=pkgOf(a),rows=[];
  if(a.name)rows.push(['광고할 것',a.name]);
  if(a.kind)rows.push(['종류',kindOf(a)?.label]);
  if(a.channels.length)rows.push(['올릴 곳',channelText(a)]);
  if(a.package)rows.push(['길이',pkg?`${pkg.label} · ${price(pkg.price)}부터`:'추천해 주세요']);
  if(slotCount(a))rows.push(['받은 자료',`${slotCount(a)}개`]);
  if(a.oneThing)rows.push(['남길 것',a.oneThing]);
  if(a.screenText)rows.push(['화면 글자',a.screenText.split('\n')[0]]);
  if(a.win)rows.push(['무엇으로',WIN.find(item=>item.id===a.win)?.label||'맡길게요']);
  if(a.models.length||a.modelChoice)rows.push(['모델',a.modelChoice==='none'?'사람 없이 제품만':a.modelChoice==='ask'?'추천해 주세요':modelList(a)]);
  if(a.date||a.dateFree)rows.push(['받고 싶은 날',a.dateFree?'미정':a.date]);
  return rows;
}

export function mountRequestFlow(root,{backend,onRoom,onExit}){
  const a=backend.answers||emptyAnswers();if(!a.refs?.length)a.refs=[{url:'',points:[],why:''}];
  let index=Math.max(0,STEPS.findIndex(step=>step.id===backend.step));
  let busy=false,saveTimer=0,saving=null,saveAgain=false,sent=null,closed=false;
  root.innerHTML=`<div class="sx-q" data-step="">
    <header class="sx-q-top"><a class="sx-logo" href="./" data-do="exit" aria-label="SYNK PULSE 처음으로"><img src="./assets/request/logo-paper.webp" alt="SYNK PULSE" width="164" height="44"></a>
      <ol class="sx-q-parts sx-small" aria-hidden="true">${[...new Set(STEPS.map(step=>step.part))].map(name=>`<li data-part="${name}">${name}</li>`).join('')}</ol>
      <div class="sx-q-top-right sx-small"><span class="sx-q-saved" data-saved></span><button type="button" class="sx-q-open-credits" data-do="sheet">의뢰서 <b class="sx-no" data-slate-count>0</b></button><button type="button" data-do="later">나중에 이어서</button></div>
      <i class="sx-q-progress" aria-hidden="true"><i data-progress></i></i></header>
    <div class="sx-q-stage">
      <section class="sx-q-ask"><form class="sx-q-form" data-ask novalidate></form></section>
      <aside class="sx-q-screen" aria-label="미리 보기"><div class="sx-q-view" data-mon></div>
        <div class="sx-q-credits" data-slate><button type="button" class="sx-small sx-q-credits-head" data-do="sheet">의뢰서</button><div class="sx-q-lines" data-lines></div></div>
      </aside>
      <!-- 이전 · 다음은 화면 칸 뒤에 둔다: 모델 단계는 고르는 칸이 화면 칸에 있어 Tab · 읽는 차례가 「고르기 → 다음」이어야 한다. 보이는 자리는 CSS가 정한다. -->
      <footer class="sx-q-foot"><button type="button" class="sx-small sx-q-back" data-do="back">이전</button><p class="sx-small sx-q-error" role="alert" data-error hidden></p><button type="button" class="sx-go is-solid" data-do="next"><span data-next-label>다음</span>${arrow}</button></footer>
    </div>
    <p class="sr" role="status" aria-live="polite" data-live></p>
  </div>`;
  // 듣개는 이 화면과 함께 사라지는 래퍼에 건다. root는 앱 전체가 다시 쓰는 칸이라 여기에 걸면 다시 그릴 때마다 겹친다.
  const host=root.querySelector('.sx-q'),$=selector=>host.querySelector(selector),form=$('[data-ask]'),mon=$('[data-mon]'),lines=$('[data-lines]');
  const blobs=new Set();
  const step=()=>STEPS[index];
  const say=text=>{$('[data-live]').textContent=text;};
  // 휴대폰 의뢰서 시트: 닫힌 시트는 초점 밖(CSS visibility)이라, 열면 시트 머리로 초점을 넣고 닫으면 시트 안에 있던 초점을 여는 단추로 돌린다.
  const setSheet=open=>{host.classList.toggle('sheet-open',open);const sheet=$('[data-slate]');if(open)sheet.querySelector('[data-do="sheet"]')?.focus({preventScroll:true});else if(sheet.contains(document.activeElement))$('.sx-q-open-credits')?.focus({preventScroll:true});};

  // 초안이 기한으로 사라졌을 때: 글은 그대로 두고, 함께 지워진 파일만 칸에서 빼고 알린다. 올리는 중인 파일은 새 초안으로 간다.
  backend.onExpired=()=>{
    let gone=0;
    for(const slot of Object.values(a.slots)){const files=slot.files||[],kept=files.filter(file=>!file.id);gone+=files.length-kept.length;slot.files=kept;}
    if(!gone)return 0;
    if(['files','review'].includes(step().id))render(1);else renderSlate();
    showError(DRAFT_FILES_GONE);
    return gone;
  };
  // 저장은 한 번에 하나씩, 도는 동안 바뀐 것은 끝난 뒤 한 번 더. 실패는 화면에 보이고 저절로 다시 한다.
  function writeNow(){
    clearTimeout(saveTimer);saveTimer=0;if(sent)return Promise.resolve(true);
    if(saving){saveAgain=true;return saving;}
    saving=(async()=>{
      const mark=$('[data-saved]');let ok=true;
      try{await backend.save?.(a,step().id);mark.classList.remove('is-error');mark.textContent='저장됨';mark.getAnimations?.().forEach(item=>item.cancel());play(mark,[{opacity:0},{opacity:1,offset:.2},{opacity:1,offset:.8},{opacity:0}],{duration:1600});}
      catch{ok=false;mark.getAnimations?.().forEach(item=>item.cancel());mark.classList.add('is-error');mark.textContent='저장하지 못했어요. 다시 시도할게요';if(!closed)saveTimer=setTimeout(writeNow,8000);}
      saving=null;
      if(saveAgain){saveAgain=false;return writeNow();}
      return ok;
    })();
    return saving;
  }
  function saved(){clearTimeout(saveTimer);saveTimer=setTimeout(writeNow,500);}

  function render(direction=1){
    const s=step();
    host.dataset.step=s.id;
    $('.sx-q-screen').setAttribute('aria-label',s.id==='model'?'모델 고르기':'미리 보기');
    showError('');
    form.innerHTML=views[s.id](a,s,index,STEPS.length);
    // 휴대폰은 질문 칸이 아니라 바깥 칸(.sx-q-stage)이 스크롤된다 — 단계를 바꾸면 그것도 처음으로(모델 단계에서 내린 채 「이전」을 누르면 제목이 위 막대 밑에 있었다).
    form.scrollTop=0;$('.sx-q-ask').scrollTop=0;$('.sx-q-stage').scrollTop=0;
    const title=form.querySelector('[data-title]');
    revealWords(title,{delay:40});
    riseAll(form.querySelectorAll('[data-in]'),{start:120,gap:34,y:14*direction});
    title.focus({preventScroll:true});
    const parts=[...new Set(STEPS.map(item=>item.part))];
    host.querySelectorAll('[data-part]').forEach(li=>{const at=parts.indexOf(li.dataset.part),now=parts.indexOf(s.part);li.classList.toggle('is-now',at===now);li.classList.toggle('is-done',at<now);});
    const bar=$('[data-progress]'),to=(index+1)/STEPS.length;
    bar.animate?.([{transform:`scaleX(${bar.dataset.at||0})`},{transform:`scaleX(${to})`}],{duration:620,easing:ease.move,fill:'forwards'});bar.dataset.at=to;
    $('[data-do="back"]').hidden=index===0;
    renderMonitor(s.id);renderSlate();updateDateAdvice();updateNext();
    say(`${index+1}번째 질문 · ${form.querySelector('[data-title]').getAttribute('aria-label')}`);
  }
  function go(to,direction,after){
    if(busy||to<0||to>=STEPS.length)return;busy=true;
    Promise.all([...form.children].map(el=>sink(el,{duration:150}))).then(()=>{index=to;render(direction);busy=false;saved();after?.();});
  }
  // 보내기 단추는 막지 않는다. 빠진 게 있으면 단추에 무엇인지 쓰고, 누르면 그 칸으로 데려간다.
  const missing=()=>!a.name?{step:'what',bind:'name',text:'광고할 것의 이름을 알려 주세요'}:!(a.contactName&&(a.email||a.phone))?{step:'contact',bind:a.contactName?'email':'contactName',text:'성함과 연락받을 곳을 알려 주세요'}:!(a.consent&&a.rights)?{step:'review',bind:a.consent?'rights':'consent',text:'동의 칸을 확인해 주세요'}:null;
  function updateNext(){
    const gap=step().id==='review'?missing():null;
    $('[data-next-label]').textContent=step().id==='review'?gap?.text||'의뢰서 보내기':'다음';
    $('[data-do="next"]').classList.toggle('is-gap',!!gap);
  }
  function showError(text){const box=$('[data-error]');box.textContent=text;box.hidden=!text;}
  let toastTimer=0;
  function toast(text){let box=host.querySelector('.sx-q-toast');if(!box){box=document.createElement('p');box.className='sx-q-toast sx-small';box.setAttribute('role','status');host.append(box);}box.textContent=text;box.classList.add('is-on');clearTimeout(toastTimer);toastTimer=setTimeout(()=>box.classList.remove('is-on'),4200);}
  // ── 모니터: 지금 답이 화면에서 어떻게 되는지 ──
  function frame(a2,inner=''){return `<div class="sx-q-frame" data-frame data-ratio="${ratioOf(a2)}">${inner}</div>`;}
  function monSwap(html){
    const old=mon.firstElementChild;mon.innerHTML=html;
    [...mon.children].forEach(child=>play(child,[{opacity:0},{opacity:1}],{duration:520}));
    return old;
  }
  const VIRTUAL='가상 브랜드로 만든 자체 작품';
  let allModels=false;
  function renderMonitor(id){
    if(id!=='model')allModels=false;
    if(id==='what'){const kind=kindOf(a);monSwap(`<img class="sx-q-fill" data-still src="${esc(kind?.shot||still('w-gift-sphere'))}" alt=""><p class="sx-small sx-q-cap" data-still-cap>${esc(kind?.who||`「유리결」 홀리데이 기프트 · ${VIRTUAL}`)}</p>`);return;}
    if(id==='where'){const pkg=pkgOf(a);monSwap(`<div class="sx-q-where"><img class="sx-q-fill" src="${still(RATIO_STILL[ratioOf(a)])}" data-ratio-still alt=""><div class="sx-q-finder" data-frame data-ratio="${ratioOf(a)}"><span class="sx-no" data-ratio-label>${ratioOf(a)}</span></div><div class="sx-q-price"><b class="sx-serif"><span data-price>${pkg?price(pkg.price):'—'}</span><small data-price-from ${pkg?'':'hidden'}>부터</small></b><span class="sx-small"><span data-cuts-label>${pkg?.photo?'받으실 사진':'영상 전에 먼저 보여 드리는 컷'}</span> <b class="sx-no" data-cuts>${pkg?pkg.cuts:0}</b></span><div class="sx-q-ticks" data-strip aria-hidden="true"></div></div></div>`);fillStrip(pkg?.cuts||0);return;}
    if(id==='files'){const own=ownPhoto(a);monSwap(`<div class="sx-q-how"><figure><img src="${esc(own||still('file-gift-set'))}" alt=""><figcaption class="sx-small"><span class="sx-no">01</span> ${own?'보내 주신 사진':'이런 사진이면 돼요'}</figcaption></figure>${[['02','장면 이미지 · 확인','sheet-gift-05'],['03','완성 영상','w-gift']].map(([no,label,name])=>`<figure><img src="${still(name)}" alt=""><figcaption class="sx-small"><span class="sx-no">${no}</span> ${label}</figcaption></figure>`).join('')}<p class="sx-small sx-q-how-note">제품 · 로고 · 글자는 AI로 그리지 않고 실제 파일을 얹어요. 영상을 만들기 전에 02에서 모든 컷을 먼저 보여 드려요. 장면 이미지는 그 컷의 첫 화면이라 움직이는 동안 작은 부분은 달라질 수 있어요.</p></div>`);return;}
    if(id==='message'||id==='words'){const own=ownPhoto(a);monSwap(`${frame({channels:a.channels.length?a.channels:['shorts']},`<img class="sx-q-fill" src="${esc(own||still(id==='words'?'w-gift':'w-gift-snow'))}" alt=""><div class="sx-q-copy${id==='words'?' is-top':''}" data-copy></div>`)}<p class="sx-small sx-q-cap">${id==='words'?'적으신 글자는 이 자리에 그대로 얹어요':'1차안에서 이 말을 한 문장으로 다듬어요'}</p>`);updateCopy();return;}
    if(id==='feel'){const pick=WIN.find(item=>item.id===a.win)||WIN[1];monSwap(`${frame({channels:[pick.ratio==='16:9'?'youtube':'shorts']},`<video class="sx-q-fill" data-win-film src="${esc(pick.film)}" poster="${esc(pick.poster)}" muted loop playsinline preload="metadata" ${reduced()?'':'autoplay'}></video>`)}<p class="sx-small sx-q-cap"><span data-win-kind>${esc(pick.kind)}</span> · <span data-win-cap>「${esc(pick.work)}」 · ${esc(pick.label)} · ${VIRTUAL}</span></p>`);return;}
    if(id==='model'){monSwap(allModels?allWall(a):wall(a));return;}
    if(id==='contact'||id==='review'){monSwap(`${frame({channels:['shorts']},`<img class="sx-q-fill" src="${still(id==='contact'?'still-shards':'still-lid')}" alt="">`)}<p class="sx-small sx-q-cap">1차안의 장면 이미지는 이런 모습이에요. 장면 이미지는 그 컷의 첫 화면이라 움직이는 동안 작은 부분은 달라질 수 있어요</p>`);return;}
    monSwap('');
  }
  function fillStrip(count){const strip=$('[data-strip]');if(!strip)return;strip.innerHTML=Array.from({length:count},(_,i)=>`<i data-c="${i}"></i>`).join('');[...strip.children].forEach((tick,i)=>play(tick,[{opacity:0},{opacity:1}],{delay:i*18,duration:300}));}
  function updateCopy(){const box=$('[data-copy]');if(!box)return;const text=step().id==='words'?(a.screenText||a.name||''):(a.oneThing||a.name||'');box.textContent='';text.split('\n').slice(0,3).forEach((line,i)=>{const p=document.createElement('p');p.textContent=line;box.append(p);});}
  function updateDateAdvice(){
    const note=$('[data-date-advice]');if(!note)return;
    if(!a.date||a.dateFree){note.hidden=true;return;}
    const today=new Date(Date.now()+9*3600000).toISOString().slice(0,10),days=Math.round((Date.parse(a.date)-Date.parse(today))/86400000);
    note.hidden=days>=10;note.textContent=days<0?'지난 날짜예요. 다시 골라 주세요.':'이 날짜는 빠듯해요. 맞출 수 있는지 먼저 말씀드릴게요.';
  }
  function renderSlate(){
    const rows=slateRows(a);
    $('[data-slate-count]').textContent=rows.length;
    const known=new Map([...lines.querySelectorAll('[data-k]')].map(el=>[el.dataset.k,el]));
    rows.forEach(([key,value],i)=>{
      let el=known.get(key);
      if(!el){el=document.createElement('div');el.className='sx-q-line sx-small';el.dataset.k=key;el.innerHTML=`<span class="k">${esc(key)}</span><span class="v"></span>`;lines.append(el);el.querySelector('.v').textContent=value;typeIn(el.querySelector('.v'),value);play(el,[{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],{duration:320});}
      else if(el.querySelector('.v').dataset.v!==value){typeIn(el.querySelector('.v'),value);}
      el.querySelector('.v').dataset.v=value;known.delete(key);
    });
    known.forEach(el=>el.remove());
    const box=lines;box.scrollTop=box.scrollHeight;
  }
  function toggleIn(list,value,max=99){const at=list.indexOf(value);if(at>=0)list.splice(at,1);else{if(list.length>=max)list.shift();list.push(value);}}
  function setRows(group,id){form.querySelectorAll(`[data-do="${group}"]`).forEach(el=>{const on=el.dataset.id===id;el.classList.toggle('is-on',on);el.setAttribute('aria-checked',on?'true':'false');if(on)play(el.querySelector('.sx-row-mark'),[{transform:'scale(0)'},{transform:'scale(1)'}],{duration:320});});}
  function setChip(el,on){el.classList.toggle('is-on',on);el.setAttribute('aria-pressed',on?'true':'false');play(el,[{transform:'scale(.96)'},{transform:'scale(1)'}],{duration:220});}
  function crossfade(img,src){if(!img||img.getAttribute('src')===src)return;play(img,[{opacity:1},{opacity:.25}],{duration:120}).finished.then(()=>{img.src=src;play(img,[{opacity:.25,transform:'scale(1.035)'},{opacity:1,transform:'scale(1)'}],{duration:620});});}

  const actions={
    exit(event){event.preventDefault();onExit?.();},
    next(){
      if(step().id==='review'){
        const gap=missing();if(!gap)return submit();
        const focusGap=()=>form.querySelector(`[data-bind="${gap.bind}"]`)?.focus();
        if(gap.step==='review')return focusGap();
        const to=STEPS.findIndex(item=>item.id===gap.step);go(to,-1,focusGap);return;
      }
      go(index+1,1);
    },
    back(){go(index-1,-1);},
    goto(el){const to=STEPS.findIndex(item=>item.id===el.dataset.id);if(to>=0)go(to,-1);},
    async later(){if(await writeNow()){backend.later?.(a,step().id);toast('저장했어요. 이 기기에서 다시 열면 여기부터 이어서 쓸 수 있어요.');}else toast('지금은 저장하지 못했어요. 인터넷 연결을 확인해 주세요.');},
    sheet(){setSheet(!host.classList.contains('sheet-open'));},
    kind(el){a.kind=el.dataset.id;setRows('kind',a.kind);crossfade($('[data-still]'),kindOf(a).shot);const cap=$('[data-still-cap]');if(cap)cap.textContent=kindOf(a).who;renderSlate();saved();},
    channel(el){toggleIn(a.channels,el.dataset.id);setChip(el,a.channels.includes(el.dataset.id));const f=$('[data-frame]'),ratio=ratioOf(a);if(f&&f.dataset.ratio!==ratio){f.dataset.ratio=ratio;const label=$('[data-ratio-label]');if(label)label.textContent=ratio;crossfade($('[data-ratio-still]'),still(RATIO_STILL[ratio]));}renderSlate();saved();},
    package(el){a.package=el.dataset.id;setRows('package',a.package);const pkg=pkgOf(a),p=$('[data-price]');if(p){if(pkg)roll(p,pkg.price,{format:price});else{delete p.dataset.value;p.textContent='상담';}$('[data-price-from]').hidden=!pkg;}const cuts=$('[data-cuts]');if(cuts){roll(cuts,pkg?.cuts||0);fillStrip(pkg?.cuts||0);const label=$('[data-cuts-label]');if(label)label.textContent=pkg?.photo?'받으실 사진':'영상 전에 먼저 보여 드리는 컷';}renderSlate();saved();},
    action(el){a.action=a.action===el.dataset.id?'':el.dataset.id;form.querySelectorAll('[data-do="action"]').forEach(item=>setChip(item,item.dataset.id===a.action));renderSlate();saved();},
    avoid(el){toggleIn(a.avoid,el.dataset.id);setChip(el,a.avoid.includes(el.dataset.id));saved();},
    win(el){a.win=el.dataset.id;setRows('win',a.win);const pick=WIN.find(item=>item.id===a.win);if(pick){const film=$('[data-win-film]');if(film&&film.getAttribute('src')!==pick.film){film.poster=pick.poster;film.src=pick.film;film.closest('[data-frame]').dataset.ratio=pick.ratio;if(!reduced())film.play().catch(()=>{});play(film,[{opacity:.3},{opacity:1}],{duration:320});}$('[data-win-cap]').textContent=`「${pick.work}」 · ${pick.label} · 가상 브랜드로 만든 자체 작품`;$('[data-win-kind]').textContent=pick.kind;}renderSlate();saved();},
    refpoint(el){const ref=a.refs[0];toggleIn(ref.points,el.dataset.id);setChip(el,ref.points.includes(el.dataset.id));saved();},
    allmodels(){allModels=!allModels;renderMonitor('model');$('.sx-cast')?.focus({preventScroll:true});},
    model(el){toggleIn(a.models,el.dataset.id,2);a.modelChoice='';host.querySelectorAll('[data-do="model"]').forEach(item=>{const on=a.models.includes(item.dataset.id);item.classList.toggle('is-on',on);item.setAttribute('aria-pressed',on?'true':'false');const mark=item.querySelector('.sx-cast-mark');if(mark)mark.textContent=on?String(a.models.indexOf(item.dataset.id)+1):'';});form.querySelectorAll('[data-do="modelchoice"]').forEach(item=>setChip(item,false));showModel(el.dataset.id);renderSlate();saved();},
    modelchoice(el){a.modelChoice=a.modelChoice===el.dataset.id?'':el.dataset.id;a.models=[];host.querySelectorAll('[data-do="model"]').forEach(item=>{item.classList.remove('is-on');item.setAttribute('aria-pressed','false');item.querySelector('.sx-cast-mark').textContent='';});form.querySelectorAll('[data-do="modelchoice"]').forEach(item=>setChip(item,item.dataset.id===a.modelChoice));renderSlate();saved();},
    datefree(el){a.dateFree=!a.dateFree;if(a.dateFree){a.date='';const input=form.querySelector('[data-bind="date"]');if(input)input.value='';}setChip(el,a.dateFree);updateDateAdvice();renderSlate();saved();},
    approver(el){a.approver=el.dataset.id;form.querySelectorAll('[data-do="approver"]').forEach(item=>setChip(item,item.dataset.id===a.approver));const sub=el.closest('.sx-sub');const more=sub.querySelector('[data-approver-more]');more.innerHTML=approverMore(a);if(more.firstElementChild)rise(more,{y:6});saved();},
    none(el){const id=el.dataset.id,slot=a.slots[id]||(a.slots[id]={files:[]});slot.none=!slot.none;setChip(el,slot.none);el.closest('.sx-slot').classList.toggle('is-none',slot.none);updateSlotStatus(id);saved();},
    async removefile(el){
      const id=el.dataset.slotId,state=a.slots[id],file=state?.files?.[Number(el.dataset.at)],slot=slotsFor(a.kind).find(item=>item.id===id);if(!file||!slot)return;
      el.disabled=true;
      try{if(file.id&&!file.error)await backend.remove?.(file.id);}
      catch(error){el.disabled=false;showError(error.message||'지우지 못했어요. 다시 시도해 주세요.');return;}
      const at=state.files.indexOf(file);if(at>=0)state.files.splice(at,1);if(file.preview?.startsWith('blob:')){URL.revokeObjectURL(file.preview);blobs.delete(file.preview);}
      redrawSlot(slot);renderSlate();saved();if(step().id==='files')renderMonitor('files');
    },
  };
  function showModel(id){const item=modelOf(id);if(!item)return;crossfade($('[data-portrait]'),bigScene(item));const lead=$('[data-portrait-name]');if(lead)lead.textContent=`${item.name} · ${castLine(item)}`;const name=$('[data-cast-name]');if(name){name.textContent=item.name;$('[data-cast-line]').textContent=MODEL_LINES[id]?.line||'';$('[data-cast-desc]').textContent=item.description;}}
  function updateSlotStatus(id){const box=form.querySelector(`[data-status="${id}"]`),slot=slotsFor(a.kind).find(item=>item.id===id);if(box&&slot)box.innerHTML=slotStatus(a,slot);}
  async function addFiles(id,list){
    const slot=slotsFor(a.kind).find(item=>item.id===id),state=a.slots[id]||(a.slots[id]={files:[]});state.none=false;
    for(const file of list){
      const entry={fileName:file.name,byteSize:file.size,mimeType:file.type,uploading:true,progress:0};
      if(file.type.startsWith('image/')&&file.type!=='image/heic'&&file.type!=='image/heif'){try{const url=URL.createObjectURL(file),image=await loadImage(url);blobs.add(url);entry.preview=url;entry.width=image.naturalWidth;entry.height=image.naturalHeight;entry.advice=photoAdvice(entry.width,entry.height,slot.kind);}catch{}}
      state.files.push(entry);redrawSlot(slot);
      try{const {preview,...stored}=await backend.upload(id,file,progress=>{entry.progress=progress;updateSlotStatus(id);});Object.assign(entry,stored,{uploading:false});if(preview&&!entry.preview)entry.preview=preview;}
      catch(error){entry.uploading=false;entry.error=error.message||'올리지 못했어요. 다시 시도해 주세요.';}
      updateSlotStatus(id);redrawSlot(slot);renderSlate();saved();
    }
    if(step().id==='files')renderMonitor('files');
  }
  function redrawSlot(slot){
    const old=form.querySelector(`[data-slot="${slot.id}"]`);if(!old)return;
    const box=document.createElement('div');box.innerHTML=slotView(a,slot);const next=box.firstElementChild;old.replaceWith(next);
    const last=next.querySelector('.sx-slot-frame img:last-of-type');if(last)play(last,[{opacity:0,transform:'scale(1.06)'},{opacity:1,transform:'scale(1)'}],{duration:560});
  }
  const loadImage=url=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=url;});
  async function submit(){
    const button=$('[data-do="next"]');button.disabled=true;$('[data-next-label]').textContent='보내는 중';showError('');clearTimeout(saveTimer);saveTimer=0;
    try{const receipt=await backend.submit(a);sent=receipt;showReceipt(receipt);}
    catch(error){$('[data-next-label]').textContent='다시 보내기';button.disabled=false;showError(error.message||'보내지 못했어요. 다시 시도해 주세요.');}
  }
  function showReceipt(receipt){
    const pkg=pkgOf(a),when=new Date(receipt.at||Date.now());
    const stamp=`${when.getFullYear()}.${String(when.getMonth()+1).padStart(2,'0')}.${String(when.getDate()).padStart(2,'0')} ${String(when.getHours()).padStart(2,'0')}:${String(when.getMinutes()).padStart(2,'0')}`;
    const rows=[['광고할 것',a.name],['길이',pkg?`${pkg.label} · ${price(pkg.price)}부터`:'추천해 주세요'],['올릴 곳',channelText(a)||'제안해 주세요'],['모델',a.modelChoice==='none'?'사람 없이 제품만':modelList(a)||'추천해 주세요'],['받은 자료',`${slotCount(a)}개`]].filter(([,value])=>value);
    host.classList.add('is-sent');$('[data-next-label]').textContent='보냈어요';
    host.querySelectorAll('.sx-q-top,.sx-q-stage,[data-live]').forEach(node=>{node.inert=true;});
    const overlay=document.createElement('div');overlay.className='sx-rc';
    overlay.innerHTML=`<div class="sx-rc-wrap"><article class="sx-rc-paper" tabindex="-1" aria-label="의뢰 접수증"><header><img src="./assets/request/logo-paper.webp" alt="SYNK PULSE" width="120" height="32"><h2 class="sx-serif">의뢰 접수증</h2></header><dl class="sx-rc-rows"><div><dt>접수 번호</dt><dd class="sx-no">${esc(receipt.number)}</dd></div><div><dt>접수 시각</dt><dd class="sx-no">${esc(stamp)}</dd></div>${rows.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl><ol class="sx-rc-next"><li><b>저희가 내용을 확인해요</b><span>평일 10~19시에 보고, 빠진 게 있으면 그 칸만 다시 여쭤요. 진행과 값도 이때 안내해 드려요.</span></li><li><b>1차안을 보내 드려요</b><span>한 문장, 글 콘티, 컷마다 장면 이미지예요. 장면 이미지는 그 컷의 첫 화면이라 움직이는 동안 작은 부분은 달라질 수 있어요.</span></li><li><b>의견을 반영한 뒤 제작해요</b><span>확인하시기 전에는 영상을 만들지 않아요.</span></li></ol></article></div><div class="sx-rc-actions"><button type="button" class="sx-go is-solid" data-rc="room"><span>내 의뢰 보기</span>${arrow}</button>${receipt.link?'<button type="button" class="sx-small sx-link" data-rc="copy">이 의뢰로 돌아올 링크 복사</button><p class="sx-small" data-rc-note>이 링크로 30일 안에 어느 기기에서든 돌아올 수 있어요.</p>':''}</div>`;
    host.append(overlay);
    play(overlay,[{opacity:0},{opacity:1}],{duration:360});
    const paper=overlay.querySelector('.sx-rc-paper');
    play(paper,[{transform:'translateY(-101%)'},{transform:'translateY(0)'}],{duration:1100,delay:320,easing:ease.move}).finished.then(()=>{paper.focus({preventScroll:true});overlay.classList.add('is-done');});
    overlay.addEventListener('click',async event=>{const what=event.target.closest('[data-rc]')?.dataset.rc;if(what==='room')onRoom?.(receipt,a);if(what==='copy'){try{await navigator.clipboard.writeText(receipt.link||location.href);overlay.querySelector('[data-rc-note]').textContent='링크를 복사했어요. 메모나 메신저에 넣어 두세요.';}catch{overlay.querySelector('[data-rc-note]').textContent=receipt.link||'';}}});
  }
  host.addEventListener('click',event=>{
    const el=event.target.closest('[data-do]');if(!el)return;
    const what=el.dataset.do;if(actions[what]){if(what==='exit')return actions.exit(event);actions[what](el);}
  });
  host.addEventListener('input',event=>{
    const el=event.target;const bind=el.dataset?.bind;if(!bind)return;
    if(bind==='refUrl')a.refs[0].url=el.value;
    else if(el.type==='checkbox')a[bind]=el.checked;
    else a[bind]=el.value;
    if(bind==='date'){a.dateFree=false;const free=form.querySelector('[data-do="datefree"]');free?.classList.remove('is-on');free?.setAttribute('aria-pressed','false');updateDateAdvice();}
    if(bind==='screenText'||bind==='oneThing'||bind==='name')updateCopy();
    if(step().id==='review')updateNext();
    if(!['consent','rights'].includes(bind))renderSlateSoon();
    saved();
  });
  let slateTimer=0;const renderSlateSoon=()=>{clearTimeout(slateTimer);slateTimer=setTimeout(renderSlate,260);};
  host.addEventListener('change',event=>{const id=event.target.dataset?.file;if(id&&event.target.files?.length){addFiles(id,[...event.target.files]);event.target.value='';}});
  host.addEventListener('dragover',event=>{const slot=event.target.closest?.('.sx-slot');if(slot){event.preventDefault();slot.classList.add('is-over');}});
  host.addEventListener('dragleave',event=>{event.target.closest?.('.sx-slot')?.classList.remove('is-over');});
  host.addEventListener('drop',event=>{const slot=event.target.closest?.('.sx-slot');if(slot&&event.dataTransfer?.files?.length){event.preventDefault();slot.classList.remove('is-over');addFiles(slot.dataset.slot,[...event.dataTransfer.files]);}});
  const previewCast=event=>{const cast=event.target.closest?.('.sx-cast');if(cast)showModel(cast.dataset.id);};
  host.addEventListener('mouseover',previewCast);host.addEventListener('focusin',previewCast);
  form.addEventListener('submit',event=>event.preventDefault());
  host.addEventListener('keydown',event=>{
    if(!['ArrowDown','ArrowUp'].includes(event.key)||event.target.getAttribute?.('role')!=='radio')return;
    const items=[...event.target.closest('[role=radiogroup]').querySelectorAll('[role=radio]')],next=items[(items.indexOf(event.target)+(event.key==='ArrowDown'?1:-1)+items.length)%items.length];
    event.preventDefault();next.focus();next.click();
  });
  host.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing&&!['TEXTAREA','BUTTON','A'].includes(event.target.tagName)&&!['file','checkbox'].includes(event.target.type)&&step().id!=='review'){event.preventDefault();actions.next();}});
  // 휴대폰 뒤로 가기는 앞 질문으로 간다. 기록에는 한 칸만 더 쌓아 두고 누를 때마다 다시 채운다.
  const trap=()=>{try{history.pushState({requestFlow:true},'');}catch{}};
  const onPop=()=>{
    if(sent){onRoom?.(sent,a);return;}
    if(host.classList.contains('sheet-open')){setSheet(false);trap();return;}
    if(index>0){trap();go(index-1,-1);return;}
    writeNow();onExit?.();
  };
  trap();addEventListener('popstate',onPop);
  render(1);
  return {answers:a,goto:id=>{const to=STEPS.findIndex(item=>item.id===id);if(to>=0){index=to;render(1);}},receipt:showReceipt,
    unmount(){closed=true;removeEventListener('popstate',onPop);if(saveTimer)writeNow();clearTimeout(slateTimer);clearTimeout(toastTimer);blobs.forEach(url=>URL.revokeObjectURL(url));blobs.clear();}};
}
