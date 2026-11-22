// i18n-skip-start
// 직원 「채널 명단」(인플루언서 광고 창 조각 ①, 2026-11-21): 대표(관리자)가 손님 방 「인플루언서 광고」 창의 채널을 넣고 고치고 빼고, 창을 손님에게 보일지 켠다.
// 직원 화면이라 한국어다. 저장은 고칠 때마다 명단 전체를 판 번호와 함께 보낸다(다른 탭이 먼저 저장했으면 서버가 409 — 새로 불러온다). app.mjs가 듣고 부른다.
// 설계 docs/디자인/PULSE고객경험_20261120/인플루언서_의뢰창_설계.md 9절. 서버 규칙은 pulse-people.mjs다(실제 채널은 https 주소 필수 · 캐스팅북 그림 금지).
// 그림 올리기(조각 ③, 11-23): 고치기 칸의 「그림 올리기」로 PNG · JPEG 한 장(2MB)을 올리면 서버가 media:<id>를 돌려주고, 대표 · 장면 그림 칸에서 고를 수 있다(app.mjs가 올린다).
import {esc} from './api.mjs';
import {peopleScreen,PEOPLE_TOPIC_LABEL} from './people-view.mjs';

const PLATFORM_LABEL={instagram:'인스타그램',youtube:'유튜브',tiktok:'틱톡',blog:'블로그'};
const blank=()=>({id:'',name:'',platform:'instagram',handle:'',url:'',topics:[],audience:'',followers:null,avgViews:null,prices:{post:null,review:null},image:'',samples:[],virtual:false,example:false,active:true});
const num=value=>value==null?'':String(value);
const tagsOf=item=>[item.example?'예시 칸 · 손님에게 안 보임':'',item.virtual?'가상 인물':'',item.active?'':'꺼 둠'].filter(Boolean);
// 올린 그림(media:<id>)은 직원 그림 경로로 그린다. 캐스팅북 그림은 정적 파일 그대로.
const MEDIA=/^media:([a-f0-9-]{36})$/;
export const rosterSrc=src=>{const id=MEDIA.exec(src||'')?.[1];return id?`/api/pulse-people/media/${id}`:src;};
const face=item=>item.image?`<img src="${esc(rosterSrc(item.image))}" alt="" loading="lazy" decoding="async">`:`<span class="ppl-initial" aria-hidden="true">${esc([...item.name][0]||'?')}</span>`;

function switchBlock(r){
  const state=!r.enabled?'꺼져 있어요. 손님 방에 「인플루언서 광고」가 보이지 않아요.':r.visible?'켜져 있어요. 결제를 마친 손님 방에 「인플루언서 광고」가 보여요.':'켜져 있지만 손님에게 보일 채널(예시가 아니고 켜 둔 칸)이 없어 손님 방에는 아직 보이지 않아요.';
  return `<section class="ppl-switch" aria-label="손님에게 보이기"><div><h2>손님에게 이 창 보이기</h2><p class="ppl-note">${esc(state)}</p></div><button type="button" class="button${r.enabled?'':' primary'}" data-action="people-switch" data-on="${r.enabled?'0':'1'}" data-mutate>${r.enabled?'끄기':'켜기'}</button></section>`;
}
// 주소가 글자 그대로 같은 칸은 막지 않고 「같은 채널일 수 있어요」만 단다(서버는 칸 id로만 같은 채널을 본다 — 설계 검토 P3-6).
function rowOf(item,i,count,editing,twins=new Set()){
  const topics=item.topics.map(id=>PEOPLE_TOPIC_LABEL[id]).join(' · ');
  return `<li class="ppl-row${editing?' is-editing':''}" data-ppl-id="${esc(item.id)}"><figure class="ppl-face">${face(item)}</figure>
    <div class="ppl-row-main"><h3>${esc(item.name)}</h3><p class="ppl-note">${esc([PLATFORM_LABEL[item.platform],item.handle,topics].filter(Boolean).join(' · '))}</p>${[...tagsOf(item),...(twins.has(item.id)?['같은 채널일 수 있어요 · 주소가 같은 칸이 있어요']:[])].length?`<p class="ppl-tags">${[...tagsOf(item),...(twins.has(item.id)?['같은 채널일 수 있어요 · 주소가 같은 칸이 있어요']:[])].map(tag=>`<span class="tag">${esc(tag)}</span>`).join('')}</p>`:''}</div>
    <div class="ppl-row-act"><button type="button" class="button quiet" data-action="people-move" data-at="${i}" data-step="-1" ${i===0?'disabled':''} aria-label="${esc(item.name)} 위로">위로</button><button type="button" class="button quiet" data-action="people-move" data-at="${i}" data-step="1" ${i===count-1?'disabled':''} aria-label="${esc(item.name)} 아래로">아래로</button><button type="button" class="button" data-action="people-edit" data-at="${i}">고치기</button><button type="button" class="button quiet" data-action="people-remove" data-at="${i}">지우기</button></div>
  </li>`;
}
// 고치기 칸: 목록 안에서 그 줄 아래 펼친다(대화상자를 쓰지 않는다 — 실시간 다시 그리기에도 쓰던 글이 남게 form 값은 app.mjs가 기억한다).
function editForm(r,item,at){
  const pick=(name,value,options)=>`<select name="${name}">${options.map(([v,label])=>`<option value="${esc(v)}" ${v===value?'selected':''}>${esc(label)}</option>`).join('')}</select>`;
  const uploads=(r.uploads||[]).map((item,i)=>[item.ref,`올린 그림 ${(r.uploads||[]).length-i}${item.at?` · ${new Date(item.at).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}`:''}`]);
  const images=[['','그림 없음 · 이름 첫 글자'],...uploads,...r.casting.flatMap(model=>model.images.map((src,i)=>[src,`${model.name} (${model.model}) · ${i===0?'대표 사진':`사진 ${i}`}`]))];
  const shown=[item.image,...item.samples].filter(Boolean);
  const sample=n=>`<label class="field">장면 그림 ${n+1}${pick('sample'+n,item.samples[n]||'',images)}</label>`;
  return `<form class="ppl-edit form-panel" data-form="people-entry" data-id="${esc(item.id||'new')}" data-at="${at}" aria-label="${esc(item.name||'새 채널')} 고치기">
    <h3>${item.id?'채널 고치기':'새 채널'}</h3>
    <div class="ppl-edit-grid">
      <label class="field">이름<input name="name" value="${esc(item.name)}" maxlength="40" required></label>
      <label class="field">플랫폼${pick('platform',item.platform,r.platforms.map(id=>[id,PLATFORM_LABEL[id]||id]))}</label>
      <label class="field">계정 이름<input name="handle" value="${esc(item.handle)}" maxlength="60" placeholder="@이름"></label>
      <label class="field">채널 주소<input name="url" type="url" value="${esc(item.url)}" maxlength="2000" placeholder="https://"><small>예시가 아닌 칸은 꼭 있어야 해요. 손님이 「채널 보기」로 열어요. 의뢰가 있는 칸은 다른 채널로 고쳐 쓰지 말고 새 칸으로 넣어 주세요.</small></label>
      <fieldset class="field ppl-topics"><legend>주제 · 셋까지</legend>${r.topics.map(id=>`<label class="ppl-check"><input type="checkbox" name="topics" value="${esc(id)}" ${item.topics.includes(id)?'checked':''}>${esc(PEOPLE_TOPIC_LABEL[id]||id)}</label>`).join('')}</fieldset>
      <label class="field">누가 보는지 한 줄<input name="audience" value="${esc(item.audience)}" maxlength="80"></label>
      <label class="field">팔로워 수<input name="followers" inputmode="numeric" value="${esc(num(item.followers))}" placeholder="비우면 손님에게 숫자를 쓰지 않아요"></label>
      <label class="field">평균 조회 수<input name="avgViews" inputmode="numeric" value="${esc(num(item.avgViews))}"></label>
      <label class="field">게시 한 번 값(원)<input name="pricePost" inputmode="numeric" value="${esc(num(item.prices.post))}" placeholder="비우면 「담당자가 확인한 뒤 알려 드려요」"></label>
      <label class="field">직접 찍은 후기 함께 값(원)<input name="priceReview" inputmode="numeric" value="${esc(num(item.prices.review))}"></label>
      <label class="ppl-check"><input type="checkbox" name="active" ${item.active?'checked':''}>켜 둠 · 손님에게 보일 수 있음</label>
      <label class="ppl-check"><input type="checkbox" name="example" ${item.example?'checked':''}>예시 칸 · 손님에게 안 보임</label>
      <label class="ppl-check"><input type="checkbox" name="virtual" ${item.virtual?'checked':''}>가상 인물 채널 · 손님 화면에 「가상 인물」 이름표</label>
      <label class="field">대표 그림${pick('image',item.image,images)}<small>캐스팅북 그림은 가상 인물 칸에만 쓸 수 있어요. 실제 채널은 올린 그림을 쓰거나, 비워 두면 이름 첫 글자가 보여요.</small></label>
      ${[0,1,2].map(sample).join('')}
      ${r.mediaOpen?`<label class="field ppl-upload">그림 올리기<input type="file" name="upload" accept="image/png,image/jpeg" data-ppl-upload data-at="${at}"><small>PNG · JPEG 한 장 2MB까지예요. 올리면 빈 그림 칸에 바로 들어가요. 실제 채널 사진은 그 채널이 허락한 것만 올려 주세요.</small></label>`:''}
      ${shown.length?`<div class="ppl-shots-now" aria-label="고른 그림">${shown.map(src=>`<img src="${esc(rosterSrc(src))}" alt="" loading="lazy" decoding="async">`).join('')}</div>`:''}
    </div>
    <div class="ppl-edit-act"><button type="submit" class="button primary" data-mutate>저장</button><button type="button" class="button quiet" data-action="people-cancel">닫기</button></div>
  </form>`;
}
// 화면 한 장. r: 서버 GET /api/pulse-people 그대로(+ editing · preview), top: 오류 띠.
export function rosterDesk(r,{top=''}={}){
  if(!r?.version&&r?.version!==0)return `<section class="staff-home ppl-desk" aria-label="채널 명단">${top}${top?'<p><button type="button" class="button" data-action="people-roster">다시 불러오기</button></p>':'<div class="loading" role="status"><span class="loading-mark"></span>채널 명단을 불러오고 있어요.</div>'}</section>`;
  const editing=r.editing??null,list=r.entries,draft=editing==='new'?blank():null;
  const byUrl=new Map();for(const item of list)if(item.url){const key=item.url.split('#')[0];byUrl.set(key,[...(byUrl.get(key)||[]),item.id]);}
  const twins=new Set([...byUrl.values()].filter(ids=>ids.length>1).flat());
  return `<section class="staff-home ppl-desk" aria-label="채널 명단">${top}
    <header class="ppl-head"><h1>채널 명단</h1><p class="ppl-note">손님 방 「인플루언서 광고」 창에 보이는 채널이에요. 예시 칸은 손님에게 보이지 않아요. 실제 채널로 바꾸고 「예시 칸」을 끄면 그 칸부터 손님에게 보여요. 고칠 때마다 바로 저장돼요.</p>${r.broken?'<p class="sx-alert" role="alert">저장된 명단 문서를 읽지 못했어요. 그동안 손님에게는 이 창이 보이지 않고 저장도 멈춰요. 개발 담당에게 알려 주세요.</p>':''}</header>
    ${switchBlock(r)}
    <ol class="ppl-list">${list.map((item,i)=>rowOf(item,i,list.length,editing===i,twins)+(editing===i?`<li class="ppl-edit-item">${editForm(r,item,i)}</li>`:'')).join('')}</ol>
    ${draft?editForm(r,draft,'new'):`<p class="ppl-add"><button type="button" class="button" data-action="people-edit" data-at="new" ${list.length>=r.limits.entries?'disabled':''}>새 채널 더하기</button></p>`}
    <section class="ppl-preview" aria-label="손님 화면 미리 보기"><h2>손님 화면 미리 보기</h2><p class="ppl-note">음료 · 식품 의뢰 손님에게 보이는 모습이에요. 예시 칸도 「예시 채널」로 함께 그리고, 묻기 단추는 막아 둬요.</p>
      ${r.preview?`<div class="ppl-preview-box sx">${peopleScreen({entries:list.filter(item=>item.active).map(item=>({...item,image:rosterSrc(item.image),samples:item.samples.map(rosterSrc)})),kind:'food',filter:r.previewFilter||'all',preview:true})}</div><button type="button" class="button quiet" data-action="people-preview" data-on="0">미리 보기 닫기</button>`:'<button type="button" class="button quiet" data-action="people-preview" data-on="1">미리 보기 열기</button>'}</section>
    <p class="ppl-note ppl-foot">${r.updatedAt?`마지막 저장 ${esc(new Date(r.updatedAt).toLocaleString('ko-KR'))} · 판 ${esc(r.version)}`:'아직 저장하지 않은 처음 명단(캐스팅북 예시 여섯)이에요.'}</p>
  </section>`;
}
// 고치기 칸의 값을 서버 칸 꼴로(app.mjs가 저장 전에 부른다). 숫자 칸은 쉼표 · 칸 · 끝의 「원」을 빼고 「천 · 만 · 억」을 읽는다(30만 → 300000, 1.2만 → 12000). 비우면 null.
// 못 읽는 값은 비우지 않고 그 칸 이름과 함께 던진다 — app.mjs가 알리고 그 칸으로 간다(카본 A2).
const UNIT={'':1,'천':1e3,'만':1e4,'억':1e8};
const NUMBER_LABEL={followers:'팔로워 수',avgViews:'평균 조회 수',pricePost:'게시 한 번 값',priceReview:'직접 찍은 후기 함께 값'};
export function entryFrom(form,base){
  const v=name=>String(form.elements[name]?.value??'').trim();
  const n=name=>{const raw=v(name).replace(/[,\s]/g,'').replace(/원$/,'');if(raw==='')return null;const m=/^(\d+(?:\.\d+)?)(천|만|억)?$/.exec(raw),value=m?Math.round(Number(m[1])*UNIT[m[2]||'']):NaN;if(!Number.isSafeInteger(value))throw Object.assign(new Error(`「${NUMBER_LABEL[name]}」 칸은 숫자로 적어 주세요(예: 120000 · 12만).`),{field:name});return value;};
  const virtual=!!form.elements.virtual?.checked;
  const samples=[0,1,2].map(i=>v('sample'+i)).filter(Boolean);
  return {...base,name:v('name'),platform:v('platform'),handle:v('handle'),url:v('url'),topics:[...form.querySelectorAll('input[name="topics"]:checked')].map(input=>input.value),audience:v('audience'),
    followers:n('followers'),avgViews:n('avgViews'),prices:{post:n('pricePost'),review:n('priceReview')},
    // 실제 채널은 캐스팅북 그림을 빼고 올린 그림만 남긴다(서버도 같은 규칙으로 막는다).
    image:virtual||MEDIA.test(v('image'))?v('image'):'',samples:[...new Set(samples)].filter(src=>virtual||MEDIA.test(src)),virtual,example:!!form.elements.example?.checked,active:!!form.elements.active?.checked};
}
export const blankEntry=blank;
// i18n-skip-end
