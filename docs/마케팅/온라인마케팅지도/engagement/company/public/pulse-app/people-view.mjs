// 고객 방의 「인플루언서 광고」 창(조각 ①, 2026-11-21). 설계 docs/디자인/PULSE고객경험_20261120/인플루언서_의뢰창_설계.md 9절.
// 읽기만 한다. 채널마다 「이 채널로 물어보기」가 나눈 말의 묻기 칸에 채널 이름을 채운 글을 넣고(보내기는 손님이 누른다), 지금의 문의 길로 담당자에게 간다.
// 명단은 서버(/pulse/api/people)가 켜짐 · 예시 아닌 칸만 준다. 직원 「채널 명단」의 미리 보기는 예시 칸까지 그리되 묻기를 막는다(preview).
// 값은 칸에 있을 때만 숫자로 쓴다. 없으면 담당자가 채널과 확인한다고 쓴다 — 값을 지어내지 않는다(마케팅 서비스 값은 아직 정하지 않았다).
// 「광고」 · 「가상인물」 표시 규정은 원문을 확인하지 않아 규정을 단정하는 글은 쓰지 않는다. 가상 인물 칸에는 「가상 인물」 이름표만 단다.
import {esc,safeUrl} from './api.mjs';
import {t,k,locale,intlLocale} from './i18n.mjs';
import {arrow} from './film-home.mjs';

export const PEOPLE_TOPIC_LABEL=Object.freeze({food:k('푸드 · 카페'),beauty:k('뷰티'),fitness:k('운동'),home:k('살림 · 요리'),daily:k('일상'),outdoor:k('캠핑 · 여행'),fashion:k('패션'),tech:k('테크'),pet:k('반려동물'),kids:k('육아')});
const PLATFORM={instagram:'Instagram',youtube:'YouTube',tiktok:'TikTok',blog:k('블로그')}; // 플랫폼 이름은 고유 이름이라 그대로(블로그만 옮긴다)
// 의뢰서 업종 → 먼저 보일 주제. 기업 전체(brand)와 업종을 모르면 나누지 않는다.
export const PEOPLE_MATCH=Object.freeze({food:['food','daily'],beauty:['beauty','daily'],fashion:['fashion'],living:['home','daily'],app:['tech','daily'],place:['daily','food','outdoor']});

const compact=n=>new Intl.NumberFormat(intlLocale(locale()),{notation:'compact',maximumFractionDigits:1}).format(n);
const won=n=>locale()==='en'?`KRW ${n.toLocaleString('en-US')}`:`${n.toLocaleString('ko-KR')}원`; // i18n-skip
const platformName=id=>{const name=PLATFORM[id]||'';return id==='blog'?t(name):name;};
const face=item=>item.image?`<img src="${esc(item.image)}" alt="" loading="lazy" decoding="async">`:`<span class="sx-ppl-initial" aria-hidden="true">${esc([...item.name][0]||'')}</span>`;
function priceLine(item){
  const {post,review}=item.prices||{};
  if(post==null)return t('값은 담당자가 채널과 확인한 뒤 알려 드려요');
  return review==null?t('게시 한 번 {price}',{price:won(post)}):t('게시 한 번 {price} · 직접 찍은 후기 함께 {review}',{price:won(post),review:won(review)});
}
function row(item,{preview}){
  const topics=item.topics.map(id=>t(PEOPLE_TOPIC_LABEL[id]||'')).filter(Boolean).join(' · ');
  const meta=[platformName(item.platform),item.handle,topics].filter(Boolean).join(' · ');
  const nums=[item.followers!=null?[t('팔로워'),compact(item.followers)]:null,item.avgViews!=null?[t('평균 조회'),compact(item.avgViews)]:null].filter(Boolean);
  const tags=`${item.virtual?`<span class="sx-ppl-tag">${esc(t('가상 인물'))}</span>`:''}${preview&&item.example?`<span class="sx-ppl-tag is-example">${esc(t('예시 채널'))}</span>`:''}`;
  const url=safeUrl(item.url);
  const say=t('「{name}」 채널에 이 영상으로 광고를 의뢰하고 싶어요. 값과 일정을 알려 주세요.',{name:item.name});
  const askButton=`<button type="button" class="sx-go" ${preview?'disabled aria-disabled="true"':`data-room-do="journal" data-journal-say="${esc(say)}"`}><span>${esc(t('이 채널로 물어보기'))}</span>${arrow}</button>`;
  return `<li class="sx-ppl-row" data-ppl-id="${esc(item.id)}">
    <figure class="sx-ppl-face">${face(item)}</figure>
    <div class="sx-ppl-main"><h3 class="sx-serif">${esc(item.name)}${tags}</h3>${meta?`<p class="sx-small sx-ppl-meta">${esc(meta)}</p>`:''}${item.audience?`<p class="sx-body sx-ppl-who">${esc(item.audience)}</p>`:''}
      ${nums.length?`<dl class="sx-ppl-nums sx-small">${nums.map(([key,value])=>`<div><dt>${esc(key)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>`:''}
      <p class="sx-small sx-ppl-price">${esc(priceLine(item))}</p></div>
    ${item.samples?.length?`<div class="sx-ppl-shots" aria-hidden="true">${item.samples.map(src=>`<img src="${esc(src)}" alt="" loading="lazy" decoding="async">`).join('')}</div>`:''}
    <div class="sx-ppl-act">${url?`<a class="sx-link sx-small" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(t('채널 보기'))}</a>`:''}${askButton}</div>
  </li>`;
}
// 화면 한 장. entries: 서버가 준 칸(미리 보기는 예시 칸 포함), kind: 의뢰서 업종, filter: 고른 주제(all이면 전체).
export function peopleScreen({status='ready',entries=[],kind='',filter='all',preview=false}={}){
  const kicker=`<p class="sx-kicker sx-ppl-kicker">${esc(t('인플루언서 광고'))}</p>`;
  const page=inner=>`<div class="sx-ppl-page">${inner}</div>`;
  if(status==='loading')return page(`${kicker}<p class="sx-small" role="status">${esc(t('채널을 불러오고 있어요.'))}</p>`);
  if(status==='error')return page(`${kicker}<h1 class="sx-display" data-room-title>${esc(t('채널을 불러오지 못했어요'))}</h1><p class="sx-body">${esc(t('인터넷 연결을 확인한 뒤 다시 불러와 주세요.'))}</p><button type="button" class="sx-go is-solid" data-ppl-do="retry"><span>${esc(t('다시 불러오기'))}</span>${arrow}</button>`);
  const topics=PEOPLE_TOPIC_LABEL?Object.keys(PEOPLE_TOPIC_LABEL).filter(id=>entries.some(item=>item.topics.includes(id))):[];
  const pick=topics.includes(filter)?filter:'all',shown=pick==='all'?entries:entries.filter(item=>item.topics.includes(pick));
  const match=PEOPLE_MATCH[kind]||null,fits=item=>!!match&&item.topics.some(id=>match.includes(id));
  const first=shown.filter(fits),rest=shown.filter(item=>!fits(item));
  const list=(title,items)=>items.length?`<section class="sx-ppl-group">${title?`<h2 class="sx-small sx-ppl-group-head">${esc(title)}</h2>`:''}<ol class="sx-ppl-list">${items.map(item=>row(item,{preview})).join('')}</ol></section>`:'';
  const chips=topics.length>1?`<div class="sx-chips sx-ppl-filter" role="group" aria-label="${esc(t('주제로 거르기'))}">${[['all',k('전체')],...topics.map(id=>[id,PEOPLE_TOPIC_LABEL[id]])].map(([id,label])=>`<button type="button" class="sx-chip is-small${id===pick?' is-on':''}" aria-pressed="${id===pick}" data-ppl-filter="${esc(id)}">${esc(t(label))}</button>`).join('')}</div>`:'';
  const body=!entries.length?`<p class="sx-body">${esc(t('지금은 보여 드릴 채널이 없어요.'))}</p>`:first.length?list(t('이 제품에 맞는 채널'),first)+list(t('다른 채널'),rest):list('',rest);
  return page(`<header class="sx-ppl-top">${kicker}<h1 class="sx-display" data-room-title>${esc(t('이 영상, 누구 채널에 실을까요?'))}</h1>
    <p class="sx-body sx-ppl-lead">${esc(t('마음에 드는 채널을 담당자에게 물어보세요. 값과 일정은 담당자가 채널과 확인한 뒤 알려 드려요.'))}</p>${chips}</header>
    ${body}
    <footer class="sx-ppl-end">${preview?'':`<button type="button" class="sx-go" data-room-go="room"><span>${esc(t('고객 방으로'))}</span>${arrow}</button>`}</footer>`);
}
