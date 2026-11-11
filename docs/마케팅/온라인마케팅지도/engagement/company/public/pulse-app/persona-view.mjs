import {esc} from './api.mjs';
import {t,k,locale} from './i18n.mjs';
import {arrow} from './film-home.mjs';

// 고객 전용 인물(판 3, 설계 docs/마케팅/PULSE_의뢰흐름_20261104/인물판3_설계_20261110.md 6절): 고객 방의 인물 카드 · 상태 줄 · 스크린 · 일지 줄.
// 자료는 서버 손님 보기 project.persona(pulse-personas.mjs customerView) 그대로다 — 인물이 없으면 키가 없고, 고객 방은 판 3 전과 바이트가 같다.
// 손님 차례 카드는 다섯(자료 보완 · 견적 · 기준 얼굴 · 동작 시안 · 이번 광고 사용)이고 승인은 카드마다 하나다. 「모두 승인」은 없다.
// 승인마다 무엇을 확인하는지 한 문장을 단추 위에 둔다. 고칠 점 칸에 글이 남아 있으면 승인 단추가 그 글을 먼저 보내라고 막는다(app.mjs personaDecide).
// 영상 전 확인(1/3 …)과 섞이지 않게 「맞춤 인물 확인 n/4」를 따로 쓴다.

// 승인 카드의 차례 번호(자료 보완은 승인이 아니라 번호가 없다).
export const PERSONA_CONFIRM_OF=Object.freeze({scope:'1/4',reference:'2/4',motion:'3/4',usage:'4/4'});
// 저희 차례 · 끝난 상태에서 보이는 한 줄(설계 1절 표). 손님 차례 상태는 카드가 대신한다.
// 판 4: 사용 중지(paused) · 삭제 진행(deleting) · 묘비(deleted)와 읽을 때 계산하는 보관 기간 끝(expired).
export const STATUS_LINE=Object.freeze({submitted:k('보내 주신 자료를 보고 있어요'),needs_materials:k('자료를 조금 더 보내 주세요'),rights_pending:k('출연하실 분의 동의를 확인하고 있어요'),reviewing:k('만들 수 있는지 검토하고 있어요'),quote_review:k('견적과 범위를 확인해 주세요'),reference_making:k('기준 얼굴을 만들고 있어요'),reference_review:k('기준 얼굴을 확인해 주세요'),building:k('인물을 준비하고 있어요'),motion_review:k('동작 시안을 확인해 주세요'),withdrawn:k('요청을 거뒀어요'),retired:k('사용을 마쳤어요'),paused:k('사용을 멈춘 인물이에요'),deleting:k('인물을 지우고 있어요'),deleted:k('지운 인물이에요'),expired:k('다시 쓰기 기한이 지났어요')});
const CARD=Object.freeze({
  materials:{title:k('인물 사진을 조금 더 보내 주세요'),text:k('만들 수 있는지 보려면 사진이 조금 더 필요해요.')},
  scope:{title:k('맞춤 인물 견적을 확인해 주세요'),text:k('만들 범위와 값 · 기간을 보시고, 맞으면 이대로 진행해 주세요. 확인하시기 전에는 비용이 생기지 않아요.'),confirm:k('승인하시면 이 값 · 기간 · 범위로 기준 얼굴을 만들기 시작해요.'),approve:k('이 견적으로 진행'),hint:k('예) 기간을 5일 안으로 줄일 수 있을까요?')},
  reference:{title:k('기준 얼굴을 확인해 주세요'),text:k('이 인물의 기준이 될 얼굴이에요. 이 얼굴로 동작 시안과 광고 장면을 만들어요.'),confirm:k('승인하시면 이 얼굴을 기준으로 인물을 만들어요. 광고 영상은 따로 확인받아요.'),approve:k('이 얼굴로 진행'),hint:k('예) 눈매를 조금 더 부드럽게, 머리는 더 짧게')},
  motion:{title:k('동작 시안을 확인해 주세요'),text:k('기준 얼굴로 만든 짧은 동작 시안이에요. 표정과 움직임이 어디까지 되는지 봐 주세요.'),confirm:k('승인하시면 이 인물로 광고 장면을 준비해요. 광고 영상은 따로 확인받아요.'),approve:k('이 인물로 진행'),hint:k('예) 웃을 때 입 모양이 어색해요')},
  usage:{title:k('이번 광고에 쓸지 확인해 주세요'),text:k('이 인물을 아래 범위로 이번 광고에 써요.'),confirm:k('승인하시면 이 범위 안에서만 이번 광고에 이 인물을 써요. 다른 광고에 쓰실 때는 다시 여쭤요.'),approve:k('이번 광고에 사용')},
});
// 승인 뒤 알림 한 줄(app.mjs personaDecide — 앱 맨 위에서 번역 표시를 부르지 않게 여기 둔다).
export const PERSONA_DONE=Object.freeze({scope:k('견적을 확인했어요. 기준 얼굴을 만들어 보여 드릴게요.'),reference:k('이 얼굴로 정했어요. 동작 시안을 만들어 보여 드릴게요.'),motion:k('이 인물로 정했어요.'),usage:k('이번 광고에 이 인물을 쓰기로 했어요.')});
// 이번 광고 사용 범위의 칸 이름(서버 USAGE_TEXT와 같은 칸, 비어 있는 칸은 그리지 않는다).
const USAGE_ROWS=Object.freeze([['brand',k('브랜드')],['product',k('제품')],['purpose',k('광고 목적')],['media',k('매체')],['regions',k('지역')],['period',k('사용 기간')],['fee',k('비용')],['schedule',k('일정')],['note',k('메모')]]);
// 사진 보내기: 실제 인물은 출연하실 분의 사진과 분위기 참고 사진, 가상 인물은 분위기 참고 사진만(의뢰서와 같은 약속 — 가상 인물에 남의 얼굴을 재현하지 않는다).
const PURPOSE=Object.freeze({identity:k('출연하실 분의 사진 보내기'),mood:k('분위기 참고 사진 보내기')});
const ACCEPT='image/jpeg,image/png,image/heic,image/heif,image/webp,.heic,.heif';
// 값: 한국어는 만 원으로 떨어지면 「30만원」, 아니면 「395,500원」. 다른 언어는 원화 그대로 「KRW 300,000」(결제 통화를 바꾸지 않는다). 한국어 꼴은 값 포맷터다.
const won=value=>!Number.isSafeInteger(value)?'':locale()!=='ko'?`KRW ${value.toLocaleString('en-US')}`:value&&value%10000===0?`${value/10000}만원`:`${value.toLocaleString('ko-KR')}원`; // i18n-skip
// 다시 쓰기 방(판 4 — 서버 mode 'reuse')의 인물은 브랜드가 보관한 「내 모델」이다.
const nameLine=m=>m.mode==='reuse'?(m.name?t('내 모델 「{name}」',{name:m.name}):t('내 모델의 모델')):m.name?t('맞춤 인물 「{name}」',{name:m.name}):t('맞춤 인물');

// 서버 손님 보기 → 화면 자료. card: 지금 손님 차례 카드(없으면 '').
export function personaModel(p){
  const v=p?.persona;if(!v||typeof v!=='object'||!v.id)return null;
  const card=v.turn==='customer'?(CARD[v.awaiting?.kind]?v.awaiting.kind:v.status==='needs_materials'?'materials':''):'';
  const sources=v.sources&&typeof v.sources==='object'?v.sources:{identity:0,mood:0,files:[]};
  // 다시 쓰기 방은 이번 광고 사용 확인 하나뿐이라 일곱 걸음 번호를 쓰지 않는다.
  const reuse=v.mode==='reuse';
  return {id:v.id,mode:reuse?'reuse':'origin',kind:v.kind==='real'?'real':'virtual',status:String(v.status||''),step:!reuse&&Number.isFinite(v.step)?v.step:null,turn:String(v.turn||''),card,name:v.name||'',why:v.why||'',
    quote:v.quote?{price:won(v.quote.price),days:v.quote.days,revisions:v.quote.revisions,scope:v.quote.scope||''}:null,
    number:v.revision?.number||null,reference:v.revision?.reference||null,motion:v.revision?.motion||null,usage:v.usage||null,awaiting:v.awaiting||null,
    canAddSources:!!v.canAddSources,sources:{identity:Number(sources.identity)||0,mood:Number(sources.mood)||0,count:Array.isArray(sources.files)?sources.files.length:0}};
}
// 왼쪽 단의 「지금 차례」 글: 인물 카드가 있고 영상 쪽이 손님 차례가 아닐 때 이 글이 방의 글을 대신한다(film-views roomView). 제목은 그리는 자리에서 옮긴다.
export function personaCopy(m){const c=CARD[m?.card];if(!c)return null;return {turn:'you',title:c.title,text:m.card==='materials'&&m.why?m.why:t(c.text),confirm:m.mode==='reuse'?'':PERSONA_CONFIRM_OF[m.card]||''};}

const sourcesLine=m=>m.sources.count?`<p class="sx-small sx-persona-got">${esc(t('보내 주신 사진 {count}장',{count:m.sources.count}))}</p>`:'';
const uploads=m=>`<div class="sx-persona-files">${(m.kind==='real'?['identity','mood']:['mood']).map(purpose=>`<label class="sx-quiet sx-persona-file"><input type="file" class="sr" multiple accept="${ACCEPT}" data-persona-file="${purpose}">${esc(t(PURPOSE[purpose]))}</label>`).join('')}</div><p class="sx-small sx-persona-use">${esc(t('사진은 PULSE 제작팀만 보고, 이 인물을 검토하고 만드는 데만 써요.'))} ${esc(t('JPG · PNG로 보내 주세요. 휴대폰 사진(HEIC · WebP)도 받아요.'))}</p>`;
const note=(label,text)=>text?`<p class="sx-small sx-persona-note"><b>${esc(label)}</b> ${esc(text)}</p>`:'';
// 기준 얼굴 그림은 누르면 새 창에서 크게 본다(같은 고객 세션의 인물 자료 주소).
const looks=(m,set)=>`<div class="sx-persona-looks" data-count="${Math.min(set.assets.length,6)}">${set.assets.filter(asset=>String(asset.mimeType).startsWith('image/')).map((asset,i)=>`<a href="${esc(asset.url)}" target="_blank" rel="noopener" aria-label="${esc(t('{number}판 기준 얼굴 {n} 크게 보기',{number:m.number||1,n:i+1}))}"><img src="${esc(asset.url)}" alt="" loading="lazy" decoding="async"></a>`).join('')}</div>`;
const clips=(m,set)=>`<div class="sx-persona-clips">${set.assets.filter(asset=>String(asset.mimeType).startsWith('video/')).map((asset,i)=>`<video src="${esc(asset.url)}" controls playsinline preload="metadata" aria-label="${esc(t('{number}판 동작 시안 {n}',{number:m.number||1,n:i+1}))}"></video>`).join('')}</div>`;
function body(m){
  if(m.card==='materials')return `${sourcesLine(m)}${uploads(m)}`;
  if(m.card==='scope'){const q=m.quote||{};const terms=[q.price&&[t('값'),q.price],Number.isFinite(q.days)&&[t('기간'),t('{count}일',{count:q.days})],Number.isFinite(q.revisions)&&[t('수정'),t('{count}회',{count:q.revisions})]].filter(Boolean);return `${terms.length?`<dl class="sx-pay-terms">${terms.map(([key,value])=>`<div><dt class="sx-small">${esc(key)}</dt><dd class="sx-serif">${esc(value)}</dd></div>`).join('')}</dl>`:''}${q.scope?`<p class="sx-body sx-persona-scope">${esc(q.scope)}</p>`:''}`;}
  if(m.card==='reference'&&m.reference)return `${looks(m,m.reference)}${note(t('담당자 설명'),m.reference.note)}`;
  if(m.card==='motion'&&m.motion)return `${clips(m,m.motion)}${note(t('되는 표현과 한계'),m.motion.note)}`;
  if(m.card==='usage'){const u=m.usage||{},rows=USAGE_ROWS.filter(([key])=>u[key]);return `${m.reference?.assets?.length?`<div class="sx-persona-who"><img src="${esc(m.reference.assets[0].url)}" alt="" loading="lazy" decoding="async"><b class="sx-serif">${esc(nameLine(m))}</b></div>`:''}${rows.length?`<dl class="sx-persona-usage sx-small">${rows.map(([key,label])=>`<div><dt>${esc(t(label))}</dt><dd>${esc(u[key])}</dd></div>`).join('')}</dl>`:''}`;}
  return '';
}
function act(m){
  const c=CARD[m.card];if(!c?.approve)return '';
  // 고칠 점은 접어 둔 칸(details)이다 — 다시 그려도 쓰던 글이 남고(app.mjs restore가 그 칸을 연다), 글이 있으면 승인이 막힌다.
  const say=m.card==='usage'?`<p class="sx-small sx-persona-ask">${esc(t('물어보실 것이 있으면'))} <button type="button" class="sx-quiet" data-room-do="journal">${esc(t('담당자에게 묻기'))}</button></p>`:`<details class="sx-persona-more"><summary class="sx-quiet">${esc(t('고칠 점 보내기'))}</summary><form class="sx-persona-say" data-form="persona-changes" data-id="${esc(m.card)}"><label class="sx-field"><span class="sx-small">${esc(t('고칠 점'))}</span><textarea name="note" rows="2" maxlength="1000" required placeholder="${esc(t(c.hint))}"></textarea></label><button type="submit" class="sx-go" data-mutate><span>${esc(t('고칠 점 보내기'))}</span>${arrow}</button></form></details>`;
  return `<p class="sx-small sx-persona-confirm">${esc(t(c.confirm))}</p><p class="sx-small sx-persona-hold" data-persona-hold role="status" hidden>${esc(t('적으신 고칠 점을 먼저 보내 주세요. 보내지 않으려면 글을 지워 주세요.'))}</p><div class="sx-persona-act"><button type="button" class="sx-go is-solid" data-room-do="persona-approve"><span>${esc(t(c.approve))}</span>${arrow}</button></div>${say}`;
}
// 손님 차례 카드. main이면 제목 · 글은 방 머리가 그리고(영상 쪽이 저희 차례), 아니면(영상 쪽도 손님 차례) 카드가 제 머리를 단다.
// 머리 줄: 이름이 있으면 「맞춤 인물 「이름」 · 맞춤 인물 확인 1/4」, 이름이 없으면 「맞춤 인물 확인 1/4」 하나(판 3 화면 검수 F1 — 「맞춤 인물」이 두 번 서지 않게). 다시 쓰기 방은 번호 없이 이름만.
function kicker(m){
  const no=m.mode==='reuse'?'':PERSONA_CONFIRM_OF[m.card];
  if(!no)return esc(nameLine(m));
  const step=`${esc(t('맞춤 인물 확인'))} <b class="sx-no">${no}</b>`;
  return m.name?`${esc(nameLine(m))} · ${step}`:step;
}
export function personaCard(m,{main=false}={}){
  const c=CARD[m?.card];if(!c)return '';
  const head=main?'':`<p class="sx-small sx-persona-kicker">${kicker(m)}</p><h2 class="sx-serif">${esc(t(c.title))}</h2><p class="sx-body">${esc(m.card==='materials'&&m.why?m.why:t(c.text))}</p>`;
  return `<section class="sx-persona" data-room-in data-persona-card="${esc(m.card)}" aria-label="${esc(nameLine(m))}">${head}${body(m)}${act(m)}</section>`;
}
// 저희 차례 · 끝난 인물의 작은 한 줄. 사진을 더 받는 동안(접수 · 검토)에는 사진 보내기를 함께 둔다(프로젝트 길 의뢰서는 사진을 여기서 처음 보낸다).
export function personaLine(m){
  if(!m)return '';
  const text=m.turn==='done'?t('이번 광고에 쓰기로 하셨어요'):m.status==='ready'?t('이번 광고에 쓸 범위를 정리하고 있어요'):t(STATUS_LINE[m.status]||STATUS_LINE.reviewing);
  return `<section class="sx-persona is-line" data-room-in aria-label="${esc(nameLine(m))}"><p class="sx-small"><b>${esc(nameLine(m))}</b> · ${esc(text)}${m.step&&m.turn!=='end'?` <span class="sx-no">${m.step}/7</span>`:''}</p>${m.turn==='end'&&m.why?`<p class="sx-small sx-persona-why">${esc(m.why)}</p>`:''}${m.canAddSources?`${sourcesLine(m)}${uploads(m)}`:''}</section>`;
}
// 「내 모델로 모아 두기」(판 4, 설계 4-3 · 5-1): 이 방에서 만드는 인물(원 프로젝트)일 때만, 앱이 회원 상태를 읽어 넘긴 keep이 있을 때만 그린다(스위치가 꺼져 있으면 keep이 없다 — 판 4 전과 바이트가 같다).
// keep.state: login(SYNK ID 로그인 전) · ask(연결 · 합류 요청 전) · busy · pending(담당자 확인 중) · member(이 프로젝트의 브랜드 회원 — keep.name).
// 누가 보게 되는지를 먼저 한 줄로 말한다 — 보관은 브랜드 관리자가 내 모델에서 정하고, 정하면 그 브랜드 회원들이 다음 광고에 쓸 수 있다.
// 다시 쓰기 방(keep.state 'reuse')은 그 모델이 온 「내 모델」로 가는 한 줄만 둔다 — 기억한 기기는 첫 화면 대신 방이 열려 입구가 없기 때문이다.
// 내 모델로 맡긴 의뢰인데 서버가 인물을 싣지 않은 다시 쓰기 방(켜기 전 후속 11-11): 직원이 연결을 확인하기 전이거나, 사용 중지 · 기한이 지나 그 모델을 지금 쓸 수 없을 때다.
// 인물 그림 · 확인은 서버 판단대로 보이지 않는다(초대 링크는 브랜드 회원 확인이 아니고, 쓸 수 없는 모델은 새 사용을 막는다). 기억한 기기는 첫 화면 대신 이 방이 열려 입구가 없으므로
// 내 모델로 가는 한 줄은 남긴다 — 까닭(회색 카드)과 기한 연장은 내 모델에서 본다.
// 보통 프로젝트 방(인물 없음)의 「내 모델」 입구(판 4 운영 시험 P3, 11-11): 이 브라우저에 프로젝트 방이 열려 있으면 첫 화면 입구가 붙지 않아
// 같은 브랜드 회원이 다른 광고 방을 쓰는 중이면 내 모델에 닿을 길이 없었다. 방 아래 띠에 한 줄 — 스위치 myModels가 꺼지면 앱이 그리지 않는다.
export const personaModelsLine=()=>`<p class="sx-small sx-room-models">${esc(t('브랜드에 모델을 보관해 두면 다음 광고에 다시 쓸 수 있어요.'))} <button type="button" class="sx-quiet" data-room-do="my-models">${esc(t('내 모델 열기'))}</button></p>`;
export const personaReuseLine=()=>`<div class="sx-persona-keep" data-room-in><p class="sx-small sx-persona-kept">${esc(t('내 모델로 맡긴 의뢰인데, 지금은 이 방에서 그 모델을 보여 드릴 수 없어요. 모델 상태는 내 모델에서 확인해 주세요.'))} <button type="button" class="sx-quiet" data-room-do="my-models">${esc(t('내 모델 열기'))}</button></p></div>`;
export function personaKeep(m,keep){
  if(!m||!keep?.state||m.turn==='end')return '';
  if(m.mode==='reuse')return keep.state==='reuse'?`<div class="sx-persona-keep" data-room-in><p class="sx-small sx-persona-kept">${esc(t('브랜드의 내 모델에 보관한 모델이에요.'))} <button type="button" class="sx-quiet" data-room-do="my-models">${esc(t('내 모델 열기'))}</button></p></div>`:'';
  if(keep.state==='reuse')return '';
  // 실제 인물은 출연하실 분의 동의가 다시 쓰기를 허락할 때만 보관할 수 있다(서버 consentAllowsReuse).
  const line=`<p class="sx-small">${esc(t('이 인물은 브랜드 관리자가 내 모델에서 보관을 정할 수 있고, 정하면 그 브랜드 회원들이 다음 광고에 쓸 수 있어요.'))}${m.kind==='real'?` ${esc(t('이 인물은 실제 인물이라, 출연하실 분이 다시 쓰기에 동의한 경우에만 보관할 수 있어요.'))}`:''}</p>`;
  const now=keep.state==='member'?`<p class="sx-small sx-persona-kept"><i class="sx-led is-ok" aria-hidden="true"></i>${esc(t('이 프로젝트는 브랜드 「{name}」에 연결돼 있어요.',{name:keep.name||''}))} <button type="button" class="sx-quiet" data-room-do="my-models">${esc(t('내 모델 열기'))}</button></p>`
    :keep.state==='pending'?`<p class="sx-small sx-persona-kept"><i class="sx-led is-wait" aria-hidden="true"></i>${esc(t('모아 두기를 요청했어요. 담당자가 확인하면 내 모델에서 브랜드를 보실 수 있어요.'))}</p>`
    :`<p class="sx-small sx-persona-kept"><button type="button" class="sx-quiet" data-room-do="keep" ${keep.state==='busy'?'disabled':''}>${esc(t('내 모델로 모아 두기'))}</button>${keep.state==='login'?` <span>${esc(t('SYNK ID로 로그인한 뒤 담당자가 확인해요.'))}</span>`:''}</p>`;
  return `<div class="sx-persona-keep" data-room-in>${line}${now}</div>`;
}
// 오른쪽 스크린(인물이 「지금 차례」일 때): 기준 얼굴 · 동작 시안 · 사용 확인의 기준 얼굴. 그릴 것이 없으면 ''(방의 스크린을 그대로 쓴다).
export function personaScreen(m){
  if(m?.card==='reference'&&m.reference?.assets?.[0])return `<img class="sx-q-fill" src="${esc(m.reference.assets[0].url)}" alt="" decoding="async"><p class="sx-small sx-room-cap">${esc(t('{number}판 기준 얼굴',{number:m.number||1}))}</p>`;
  if(m?.card==='motion'){const clip=m.motion?.assets?.find(asset=>String(asset.mimeType).startsWith('video/'));if(clip)return `<video class="sx-q-fill" src="${esc(clip.url)}" muted loop playsinline preload="metadata" data-room-film aria-hidden="true"></video><p class="sx-small sx-room-cap">${esc(t('{number}판 동작 시안',{number:m.number||1}))}</p>`;}
  if(m?.card==='usage'&&m.reference?.assets?.[0])return `<img class="sx-q-fill" src="${esc(m.reference.assets[0].url)}" alt="" decoding="async"><p class="sx-small sx-room-cap">${esc(nameLine(m))}</p>`;
  return '';
}
// 일지 줄(판 3b 줄기에 인물 일을 한 줄씩). 서버가 내려 주는 code만 쓴다 — 손님 글 · 직원 메모 · 판 파일은 싣지 않는다. 지금 손님 차례를 연 줄에만 「열기」(고객 방)를 단다.
const EVENT_TEXT=Object.freeze({sent:k('맞춤 인물을 요청했어요'),files:k('인물 사진을 보냈어요'),materials:k('인물 사진을 더 부탁드렸어요'),rights:k('출연하실 분의 동의 확인을 시작했어요'),review:k('맞춤 인물 검토를 시작했어요'),quote:k('맞춤 인물 견적을 보냈어요'),reference:k('기준 얼굴을 보냈어요'),motion:k('동작 시안을 보냈어요'),usage:k('이번 광고에 쓸 범위를 보냈어요'),withdrawn:k('맞춤 인물 요청을 거뒀어요'),retired:k('맞춤 인물 사용을 마쳤어요'),scope_ok:k('맞춤 인물 견적을 확인했어요'),scope_changes:k('견적에 고칠 점을 보냈어요'),reference_ok:k('기준 얼굴을 확인했어요'),reference_changes:k('기준 얼굴에 고칠 점을 보냈어요'),motion_ok:k('동작 시안을 확인했어요'),motion_changes:k('동작 시안에 고칠 점을 보냈어요'),usage_ok:k('이번 광고 사용을 확인했어요')});
const OPENS=Object.freeze({materials:'materials',quote:'scope',reference:'reference',motion:'motion',usage:'usage'});
export function personaJournal(p,{me,owner}){
  const m=personaModel(p),events=Array.isArray(p?.persona?.events)?p.persona.events:[];if(!m)return [];
  const opener=m.card?[...events].reverse().find(event=>event.who==='staff'&&OPENS[event.code]===m.card)?.id:'';
  return events.filter(event=>EVENT_TEXT[event.code]).map(event=>({id:'p:'+event.id,at:event.at,who:event.who==='me'?'me':'staff',name:event.who==='me'?me:owner,kind:'event',what:t(EVENT_TEXT[event.code]),go:opener&&event.id===opener?{tab:'overview'}:null}));
}
// 1차안 화면의 인물 칸: 제작 설계에 붙은 인물 판이 손님 보기의 지금 판과 같을 때 그 기준 얼굴.
export function personaFace(p,ref){
  const v=p?.persona;if(!v||!ref||v.revision?.id!==ref.revisionId)return null;
  return {name:v.name||(v.mode==='reuse'?t('내 모델의 모델'):t('맞춤 인물')),image:v.revision.reference?.assets?.[0]?.url||''};
}
