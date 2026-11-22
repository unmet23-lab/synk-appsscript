// 고객 방의 「인플루언서 광고」 창. 설계 docs/디자인/PULSE고객경험_20261120/인플루언서_의뢰창_설계.md 9절(조각 ① 명단 · 조각 ② 의뢰).
// 맨 위 「내 의뢰」: 보낸 의뢰마다 진행 줄(보냄 · 값 안내 · 동의 · 결제 확인 · 게시 · 결과)과 지금 할 일. 값 안내가 오면 「이 값으로 진행」 · 「진행하지 않기」,
// 결제 전(보냄 · 동의)에는 「의뢰 거두기」. 끝나거나 닫힌 의뢰는 「지난 의뢰」로 접는다.
// 명단: 채널마다 「이 채널에 의뢰하기」가 그 줄 아래에 의뢰 시트를 편다(값 한 줄 · 진행 순서 셋 · 한마디 · 보내기). 「먼저 물어보기」는 나눈 말의 묻기 칸에 채널 이름을 채운다.
// 명단은 서버(/pulse/api/people)가 켜짐 · 예시 아닌 칸만 준다. 스위치가 꺼져 명단이 없어도 보낸 의뢰는 보인다(rosterOn false).
// 직원 「채널 명단」의 미리 보기는 예시 칸까지 그리되 의뢰 · 묻기를 막는다(preview).
// 값은 칸에 있을 때만 숫자로 쓴다. 없으면 담당자가 채널과 확인한다고 쓴다 — 값을 지어내지 않는다. 최종 값은 담당자의 값 안내다.
// 「광고」 표시는 저희가 지키는 약속으로만 쓰고(담당자가 게시물을 올릴 때 확인한다), 규정을 단정하는 글은 쓰지 않는다. 가상 인물 칸에는 「가상 인물」 이름표만 단다.
import {esc,safeUrl,day,stamp} from './api.mjs';
import {t,k,locale,intlLocale} from './i18n.mjs';
import {arrow} from './film-home.mjs';
import {PEOPLE_STEPS,PEOPLE_OPEN_MAX,PEOPLE_TOTAL_MAX,openRequest} from './room-view.mjs';

export const PEOPLE_TOPIC_LABEL=Object.freeze({food:k('푸드 · 카페'),beauty:k('뷰티'),fitness:k('운동'),home:k('살림 · 요리'),daily:k('일상'),outdoor:k('캠핑 · 여행'),fashion:k('패션'),tech:k('테크'),pet:k('반려동물'),kids:k('육아')});
const PLATFORM={instagram:'Instagram',youtube:'YouTube',tiktok:'TikTok',blog:k('블로그')}; // 플랫폼 이름은 고유 이름이라 그대로(블로그만 옮긴다)
// 의뢰서 업종 → 먼저 보일 주제. 기업 전체(brand)와 업종을 모르면 나누지 않는다.
export const PEOPLE_MATCH=Object.freeze({food:['food','daily'],beauty:['beauty','daily'],fashion:['fashion'],living:['home','daily'],app:['tech','daily'],place:['daily','food','outdoor']});
// 의뢰의 진행 단계 · 상한 · 고르기는 room-view.mjs 하나에 둔다(고객 방 입구 · 일지 · 제작 보드가 같은 값을 쓴다).
const STEP_LABEL={sent:k('보냄'),quoted:k('값 안내'),agreed:k('동의'),paid:k('결제 확인'),posted:k('게시'),done:k('결과')};

const compact=n=>new Intl.NumberFormat(intlLocale(locale()),{notation:'compact',maximumFractionDigits:1}).format(n);
const won=n=>locale()==='en'?`KRW ${n.toLocaleString('en-US')}`:`${n.toLocaleString('ko-KR')}원`; // i18n-skip
const amountOk=n=>Number.isSafeInteger(n)&&n>0;
const platformName=id=>{const name=PLATFORM[id]||'';return id==='blog'?t(name):name;};
const face=item=>item.image?`<img src="${esc(item.image)}" alt="" loading="lazy" decoding="async">`:`<span class="sx-ppl-initial" aria-hidden="true">${esc([...item.name][0]||'')}</span>`;
function priceLine(item){
  const {post,review}=item.prices||{};
  if(post==null)return t('값은 담당자가 채널과 확인한 뒤 알려 드려요');
  return review==null?t('게시 한 번 {price}',{price:won(post)}):t('게시 한 번 {price} · 직접 찍은 후기 함께 {review}',{price:won(post),review:won(review)});
}
// 이 채널에 지금 의뢰할 수 없는 까닭(없으면 빈 글자). 서버도 같은 조건으로 막는다 — 화면은 미리 알려 줄 뿐이다.
function blockedWhy(item,{requests,hasVideo}){
  const open=requests.filter(openRequest);
  // 열린 의뢰는 한 건이라 어느 줄이든 같은 까닭이다(그 줄의 채널을 짚지 않는다 — 명단 칸이 그사이 다른 채널로 고쳐졌을 수 있다).
  if(open.length>=PEOPLE_OPEN_MAX)return t('진행 중인 의뢰가 끝난 뒤에 다른 채널에 의뢰할 수 있어요. 위 「내 의뢰」에서 볼 수 있어요.');
  if(!hasVideo)return t('영상 시안이 나온 뒤에 의뢰할 수 있어요. 채널은 영상을 보고 맡을지 정해요.');
  if(requests.length>=PEOPLE_TOTAL_MAX)return t('이 프로젝트에서 보낼 수 있는 의뢰를 다 썼어요. 더 필요하면 담당자에게 물어봐 주세요.');
  return '';
}
// 채널 줄 아래에 펴는 의뢰 시트. 보내기는 app.mjs(people-request 폼)가 판 번호와 명단 판을 실어 보낸다.
function sheet(item){
  return `<form class="sx-ppl-sheet" data-form="people-request" data-id="${esc(item.id)}" aria-label="${esc(t('「{name}」 채널에 의뢰하기',{name:item.name}))}">
    <h4 class="sx-serif">${esc(t('「{name}」 채널에 의뢰하기',{name:item.name}))}</h4>
    <p class="sx-small sx-ppl-sheet-price">${esc(priceLine(item))}</p>
    <ol class="sx-ppl-how sx-small"><li>${esc(t('담당자가 채널과 값 · 일정을 확인해 알려 드려요'))}</li><li>${esc(t('값에 동의하시면 크몽에서 결제해요'))}</li><li>${esc(t('채널에 올라가면 게시물 링크를 보내 드려요'))}</li></ol>
    <label class="sx-field"><span class="sx-small">${esc(t('담당자에게 남길 말(비워 두셔도 돼요)'))}</span><textarea name="note" rows="3" maxlength="500" placeholder="${esc(t('예) 주말 오전에 올려 주시면 좋겠어요.'))}"></textarea></label>
    <p class="sx-small sx-ppl-hint">${esc(t('채널이 직접 찍는 후기나 채널 이름을 붙여 우리 광고에 다시 쓰기를 원하시면 적어 주세요. 담당자가 채널과 확인해 값에 넣어 드려요.'))}</p>
    <p class="sx-small sx-ppl-hint">${esc(t('채널 게시물에는 「광고」 표시를 붙여요.'))}</p>
    <div class="sx-ppl-sheet-act"><button type="submit" class="sx-go is-solid"><span>${esc(t('의뢰 보내기'))}</span>${arrow}</button><button type="button" class="sx-quiet" data-ppl-do="close" data-id="${esc(item.id)}">${esc(t('닫기'))}</button></div>
  </form>`;
}
function row(item,{preview,requests,hasVideo,open:sheetOpen}){
  const topics=item.topics.map(id=>t(PEOPLE_TOPIC_LABEL[id]||'')).filter(Boolean).join(' · ');
  const meta=[platformName(item.platform),item.handle,topics].filter(Boolean).join(' · ');
  const nums=[item.followers!=null?[t('팔로워'),compact(item.followers)]:null,item.avgViews!=null?[t('평균 조회'),compact(item.avgViews)]:null].filter(Boolean);
  const tags=`${item.virtual?`<span class="sx-ppl-tag">${esc(t('가상 인물'))}</span>`:''}${preview&&item.example?`<span class="sx-ppl-tag is-example">${esc(t('예시 채널'))}</span>`:''}`;
  const url=safeUrl(item.url);
  const say=t('「{name}」 채널에 이 영상으로 광고를 의뢰하고 싶어요. 값과 일정을 알려 주세요.',{name:item.name});
  const why=preview?'':blockedWhy(item,{requests,hasVideo}),shown=!preview&&!why&&sheetOpen;
  const ask=preview?'':`<button type="button" class="sx-quiet sx-small" data-room-do="journal" data-journal-say="${esc(say)}">${esc(t('먼저 물어보기'))}</button>`;
  const go=`<button type="button" class="sx-go" ${preview||why?'disabled aria-disabled="true"':`data-ppl-do="open" data-id="${esc(item.id)}" aria-expanded="${shown}"`}><span>${esc(t('이 채널에 의뢰하기'))}</span>${arrow}</button>`;
  return `<li class="sx-ppl-row${shown?' is-open':''}" data-ppl-id="${esc(item.id)}">
    <figure class="sx-ppl-face">${face(item)}</figure>
    <div class="sx-ppl-main"><h3 class="sx-serif">${esc(item.name)}${tags}</h3>${meta?`<p class="sx-small sx-ppl-meta">${esc(meta)}</p>`:''}${item.audience?`<p class="sx-body sx-ppl-who">${esc(item.audience)}</p>`:''}
      ${nums.length?`<dl class="sx-ppl-nums sx-small">${nums.map(([key,value])=>`<div><dt>${esc(key)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>`:''}
      <p class="sx-small sx-ppl-price">${esc(priceLine(item))}</p>${why?`<p class="sx-small sx-ppl-why">${esc(why)}</p>`:''}</div>
    ${item.samples?.length?`<div class="sx-ppl-shots" aria-hidden="true">${item.samples.map(src=>`<img src="${esc(src)}" alt="" loading="lazy" decoding="async">`).join('')}</div>`:''}
    <div class="sx-ppl-act">${url?`<a class="sx-link sx-small" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(t('채널 보기'))}</a>`:''}${go}${ask}</div>
    ${shown?sheet(item):''}
  </li>`;
}
// 의뢰 하나의 지금 할 일 한 줄.
function nowLine(r){
  if(r.status==='sent')return t('담당자가 채널과 값 · 일정을 확인하고 있어요. 확인되면 이 자리에 값이 올라와요.');
  if(r.status==='quoted')return t('값이 나왔어요. 보시고 진행할지 정해 주세요.');
  if(r.status==='agreed')return t('동의해 주셨어요. 크몽 메시지로 결제 요청을 보내 드려요. 결제가 확인되면 채널에 넘겨요. 진행을 멈추려면 담당자에게 알려 주세요.');
  if(r.status==='paid')return r.quote?.postBy&&day(r.quote.postBy)?t('결제를 확인했어요. 채널이 {date}쯤 올릴 예정이에요.',{date:day(r.quote.postBy)}):t('결제를 확인했어요. 채널이 게시를 준비하고 있어요.');
  if(r.status==='posted')return t('채널에 올라갔어요. 게시물을 확인해 주세요. 결과는 담당자가 정리해 알려 드려요.');
  if(r.status==='done')return t('광고를 마쳤어요.');
  return r.closed?.by==='customer'?t('의뢰를 거두셨어요.'):t('담당자가 의뢰를 닫았어요.');
}
function track(r){
  if(r.status==='closed')return '';
  const at=PEOPLE_STEPS.indexOf(r.status);
  return `<ol class="sx-ppl-track sx-small" aria-label="${esc(t('진행 단계'))}">${PEOPLE_STEPS.map((id,i)=>`<li class="${i<at||r.status==='done'?'is-done':i===at?'is-now':''}"${i===at&&r.status!=='done'?' aria-current="step"':''}>${esc(t(STEP_LABEL[id]))}</li>`).join('')}</ol>`;
}
function quoteBox(r){
  const q=r.quote;if(!q||!amountOk(q.amount))return '';
  const rows=[[t('값'),won(q.amount)],q.includes?[t('포함된 것'),q.includes]:null,q.postBy&&day(q.postBy)?[t('게시 예정일'),day(q.postBy)]:null].filter(Boolean);
  return `<dl class="sx-ppl-quote">${rows.map(([key,value])=>`<div><dt class="sx-small">${esc(key)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>${r.status==='quoted'?`<p class="sx-small sx-ppl-hint">${esc(t('크몽 결제 때 크몽 구매 수수료가 더해지고, 부가세는 따로 받지 않아요.'))}</p>`:''}`;
}
function requestCard(r,{preview}){
  const ch=r.channel||{},meta=[platformName(ch.platform),ch.handle].filter(Boolean).join(' · ');
  const posts=(Array.isArray(r.posts)?r.posts:[]).map(safeUrl).filter(Boolean);
  const acts=preview?'':r.status==='quoted'&&amountOk(r.quote?.amount)?`<button type="button" class="sx-go is-solid" data-ppl-do="agree" data-id="${esc(r.id)}" data-amount="${r.quote.amount}"><span>${esc(t('이 값으로 진행'))}</span>${arrow}</button><button type="button" class="sx-quiet" data-ppl-do="decline" data-id="${esc(r.id)}">${esc(t('진행하지 않기'))}</button>`
    :r.status==='sent'?`<button type="button" class="sx-quiet" data-ppl-do="cancel" data-id="${esc(r.id)}">${esc(t('의뢰 거두기'))}</button>`:'';
  return `<li class="sx-ppl-req is-${esc(r.status)}" data-ppl-request="${esc(r.id)}" tabindex="-1">
    <header class="sx-ppl-req-head"><h3 class="sx-serif">${esc(ch.name||'')}${ch.virtual?`<span class="sx-ppl-tag">${esc(t('가상 인물'))}</span>`:''}</h3><p class="sx-small sx-ppl-meta">${esc([meta,r.at&&stamp(r.at)?t('보낸 때 {when}',{when:stamp(r.at)}):''].filter(Boolean).join(' · '))}</p></header>
    ${track(r)}
    <p class="sx-body sx-ppl-req-now">${esc(nowLine(r))}</p>
    ${quoteBox(r)}
    ${posts.length?`<ul class="sx-ppl-posts">${posts.map((href,i)=>`<li><a class="sx-link" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(posts.length>1?t('게시물 {n} 보기',{n:i+1}):t('게시물 보기'))}</a></li>`).join('')}</ul>`:''}
    ${r.status==='done'&&r.result?`<p class="sx-body sx-ppl-result">${esc(r.result)}</p>`:''}
    ${r.status==='closed'&&r.closed?.why?`<p class="sx-small sx-ppl-why">${esc(t('까닭: {why}',{why:r.closed.why}))}</p>`:''}
    ${r.note?`<p class="sx-small sx-ppl-note">${esc(t('남기신 말: {note}',{note:r.note}))}</p>`:''}
    ${acts?`<div class="sx-ppl-req-act">${acts}</div>`:''}
  </li>`;
}
function mine(requests,{past,preview}){
  if(!requests.length)return '';
  const order=list=>[...list].sort((a,b)=>String(b.at||'').localeCompare(String(a.at||'')));
  const open=order(requests.filter(openRequest)),gone=order(requests.filter(r=>!openRequest(r)));
  const pastBlock=gone.length?`<div class="sx-ppl-past"><button type="button" class="sx-quiet sx-small" data-ppl-do="past" aria-expanded="${!!past}">${esc(past?t('지난 의뢰 접기'):t('지난 의뢰 {count}건',{count:gone.length}))}</button>${past?`<ol class="sx-ppl-reqs is-past">${gone.map(r=>requestCard(r,{preview})).join('')}</ol>`:''}</div>`:'';
  return `<section class="sx-ppl-mine" aria-labelledby="ppl-mine-h"><h2 class="sx-small sx-ppl-group-head" id="ppl-mine-h">${esc(t('내 의뢰'))}</h2>${open.length?`<ol class="sx-ppl-reqs">${open.map(r=>requestCard(r,{preview})).join('')}</ol>`:`<p class="sx-small sx-ppl-quiet">${esc(t('진행 중인 의뢰는 없어요.'))}</p>`}${pastBlock}</section>`;
}
// 화면 한 장. entries: 서버가 준 칸(미리 보기는 예시 칸 포함), kind: 의뢰서 업종, filter: 고른 주제(all이면 전체),
// requests: 이 프로젝트의 의뢰(손님 보기), hasVideo: 시안이 한 편 이상, sheet: 의뢰 시트를 편 채널 id, past: 지난 의뢰를 편 채로, rosterOn: 명단이 열려 있음.
export function peopleScreen({status='ready',entries=[],kind='',filter='all',preview=false,requests=[],hasVideo=false,sheet:sheetId='',past=false,rosterOn=true}={}){
  const kicker=`<p class="sx-kicker sx-ppl-kicker">${esc(t('인플루언서 광고'))}</p>`;
  const page=inner=>`<div class="sx-ppl-page">${inner}</div>`;
  const list=Array.isArray(requests)?requests:[],mineBlock=mine(list,{past,preview});
  if(rosterOn&&status==='loading'&&!list.length)return page(`${kicker}<p class="sx-small" role="status">${esc(t('채널을 불러오고 있어요.'))}</p>`);
  if(rosterOn&&status==='error'&&!list.length)return page(`${kicker}<h1 class="sx-display" data-room-title>${esc(t('채널을 불러오지 못했어요'))}</h1><p class="sx-body">${esc(t('인터넷 연결을 확인한 뒤 다시 불러와 주세요.'))}</p><button type="button" class="sx-go is-solid" data-ppl-do="retry"><span>${esc(t('다시 불러오기'))}</span>${arrow}</button>`);
  const topics=Object.keys(PEOPLE_TOPIC_LABEL).filter(id=>entries.some(item=>item.topics.includes(id)));
  const pick=topics.includes(filter)?filter:'all',shown=pick==='all'?entries:entries.filter(item=>item.topics.includes(pick));
  const match=PEOPLE_MATCH[kind]||null,fits=item=>!!match&&item.topics.some(id=>match.includes(id));
  const first=shown.filter(fits),rest=shown.filter(item=>!fits(item));
  const rowOf=item=>row(item,{preview,requests:list,hasVideo,open:item.id===sheetId});
  const group=(title,items)=>items.length?`<section class="sx-ppl-group">${title?`<h2 class="sx-small sx-ppl-group-head">${esc(title)}</h2>`:''}<ol class="sx-ppl-list">${items.map(rowOf).join('')}</ol></section>`:'';
  const chips=rosterOn&&status==='ready'&&topics.length>1?`<div class="sx-chips sx-ppl-filter" role="group" aria-label="${esc(t('주제로 거르기'))}">${[['all',k('전체')],...topics.map(id=>[id,PEOPLE_TOPIC_LABEL[id]])].map(([id,label])=>`<button type="button" class="sx-chip is-small${id===pick?' is-on':''}" aria-pressed="${id===pick}" data-ppl-filter="${esc(id)}">${esc(t(label))}</button>`).join('')}</div>`:'';
  const roster=!rosterOn?`<p class="sx-small sx-ppl-quiet">${esc(t('지금은 새 채널을 열어 두지 않았어요. 보낸 의뢰는 여기에서 계속 보실 수 있어요.'))}</p>`
    :status==='loading'?`<p class="sx-small" role="status">${esc(t('채널을 불러오고 있어요.'))}</p>`
    :status==='error'?`<p class="sx-small">${esc(t('채널을 불러오지 못했어요'))} · <button type="button" class="sx-quiet sx-small" data-ppl-do="retry">${esc(t('다시 불러오기'))}</button></p>`
    :!entries.length?`<p class="sx-body">${esc(t('지금은 보여 드릴 채널이 없어요.'))}</p>`:first.length?group(t('이 제품에 맞는 채널'),first)+group(t('다른 채널'),rest):group(list.length?t('채널 목록'):'',rest);
  const lead=rosterOn?t('마음에 드는 채널을 골라 의뢰하세요. 값과 일정은 담당자가 채널과 확인해 알려 드리고, 동의하신 뒤에 결제해요.'):t('보내신 의뢰가 어디까지 왔는지 여기에서 보세요.');
  return page(`<header class="sx-ppl-top">${kicker}<h1 class="sx-display" data-room-title>${esc(t('이 영상, 누구 채널에 실을까요?'))}</h1>
    <p class="sx-body sx-ppl-lead">${esc(lead)}</p>${list.length?'':chips}</header>
    ${mineBlock}
    ${list.length?chips:''}${roster}
    <footer class="sx-ppl-end">${preview?'':`<button type="button" class="sx-go" data-room-go="room"><span>${esc(t('고객 방으로'))}</span>${arrow}</button>`}</footer>`);
}
