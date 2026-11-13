import {esc,dropSrcset} from './api.mjs';
import {t,k,locale,intlLocale,htmlLang} from './i18n.mjs';
import {localeMenu,offeredLocales,LOCALE_EVENT} from './locale-menu.mjs';
import {CASTING_MODELS} from './casting-catalog.mjs';
import {KINDS,CHANNELS,PACKAGES,slotsFor,WATCH_WORDS,claimText,ACTIONS,WIN,BOLD,NOTICE_KINDS,noticeLabel,noticeOn,VOICES,REFERENCE_POINTS,MODEL_LINES,MODEL_PICKS,STEPS,emptyAnswers,photoAdvice,price,DRAFT_FILES_GONE,pkgOf,kindOf,channelText,modelOf,modelList,filesOf,slotCount,briefRows,ratioOf,termsOf,dueDay,revisionNote,PERSONA_SLOTS,isPersonaSlot,PERSONA_KINDS,PERSONA_KEEPS,PERSONA_RELATIONS,PERSONA_CONSENTS,personaKindLabel,sceneSet} from './request-data.mjs';
import {rise,riseAll,sink,revealWords,roll,typeIn,play,ease,reduced} from './motion.mjs';

// 고객이 초대 없이 직접 시작하는 의뢰서(2026-11-04 — 의뢰 → 준비할 것 작성 → 함께 확인 → 1차 전달 뒤 수정 → 제작).
// 시사실 판(2026-11-05): 왼쪽은 묻는 말 하나, 오른쪽은 온 화면 스크린이다. 고른 답이 스크린에서 바로 어떻게 되는지 보이고, 답은 크레딧처럼 스크린 아래에 쌓인다. 어떤 칸도 보내기를 막지 않고, 없으면 무엇이 달라지는지만 말한다.
// 다국어 판 2(11-09): 글은 모두 t()를 지난다(한국어 화면은 글자 그대로다). 의뢰서가 열려 있는 동안 언어를 바꾸면(LOCALE_EVENT) 지금 단계를 그 자리에서 다시 그린다 — 답 · 단계 · 고른 모델 · 사진은 그대로다.
// 올리기에 실패한 파일 줄 → 그 파일(켜기 전 후속 · 판 6 D, 11-11). 연결이 끊김 · 서버 오류 · 시간 초과처럼 같은 파일을 다시 보내면 될 수 있는 실패만 담는다 —
// 형식 · 크기가 맞지 않는 파일(415 · 413 · 400)은 「지우기」 뒤 다른 파일을 고른다. 항목 객체에는 칸을 더하지 않는다(답은 서버 허용 목록 그대로 저장된다).
const retryable=new WeakMap();
// 진행 중인 그림 바꾸기(img → {src}) — 늦게 끝난 앞 바꾸기가 나중에 고른 그림을 덮지 않게(crossfade).
const swaps=new WeakMap();
// 파일 줄마다 바뀌지 않는 표(data-key) — 다시 그린 뒤 초점을 줄 번호가 아니라 그 파일로 되찾는다(최종 검수 -c P1: 위 줄이 지워져 번호가 당겨지면 초점이 다른 파일의 「지우기」로 옮겨져 이어 누른 Enter가 고르지 않은 파일을 지우던 길).
const fileKeys=new WeakMap();let fileSeq=0;
const fileKey=file=>{if(!fileKeys.has(file))fileKeys.set(file,'f'+(++fileSeq));return fileKeys.get(file);};
const canRetry=error=>{const status=Number(error?.status)||0;return !status||status>=500||status===408||status===429;};
const ASSET='./assets/request/';
const still=name=>`${ASSET}${name}.webp`;
const RATIO_STILL={'9:16':'shard','16:9':'w-maejin','1:1':'shard'};
const arrow='<svg class="sx-arw" viewBox="0 0 40 16" aria-hidden="true"><path d="M0 8h38M31 1l7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
// 개발자가 읽는 HTML 주석(손님 화면에 보이지 않는 글이라 번역하지 않는다).
const ORDER_NOTE='<!-- 이전 · 다음은 화면 칸 뒤에 둔다: 모델 단계는 고르는 칸이 화면 칸에 있어 Tab · 읽는 차례가 「고르기 → 다음」이어야 한다. 보이는 자리는 CSS가 정한다. -->'; // i18n-skip
// 언어 이름은 그 언어로 쓴다(언어 메뉴와 같다 — 어느 화면에서든 자기 언어를 찾게 번역하지 않는다).
const LANG_NAMES=Object.freeze({ko:'한국어',en:'English',ja:'日本語'}); // i18n-skip
// 문장 안 한 자리만 굵게(받으실 날): 그 자리에 표시를 넣어 번역하고 → 문장을 이스케이프 → 표시 자리에 굵은 값(값도 이스케이프).
const MARK='\u0001';
const boldAt=(text,value)=>esc(text).replace(MARK,()=>`<b>${esc(value)}</b>`);
// 값 칸의 「부터」: 한국어는 값 뒤(39만원 부터), 영어는 값 앞(from KRW 390,000).
const fromBefore=()=>locale()==='en';
// 손님이 올린 첫 사진. 있으면 스크린에 남의 작품 대신 이 사진을 놓는다.
// 맞춤 인물 사진 칸(판 3)은 제품 자료가 아니라 이 자리에 쓰지 않는다.
const ownPhoto=a=>Object.entries(a.slots).filter(([id])=>!isPersonaSlot(id)).flatMap(([,slot])=>slot.files||[]).find(file=>file.preview&&!file.error)?.preview||'';
// 맞춤 인물 칸에 올린 첫 사진: 출연하실 분의 사진이 먼저, 없으면 분위기 참고 사진. 어느 칸 사진인지도 돌려준다(스크린 밑줄이 다르다).
const personaPhoto=a=>{for(const slot of PERSONA_SLOTS){const file=(a.slots[slot.id]?.files||[]).find(item=>item.preview&&!item.error);if(file)return {src:file.preview,identity:slot.id==='persona-identity'};}return null;};
const sceneOf=item=>item.photos?.find(photo=>photo.kind==='scene')?.src||item.image;
const bigScene=item=>`${ASSET}model-scene-${String(item.id).toLowerCase()}.webp`;
// 큰 칸의 장면 사진(폭 960)을 실제 화소의 1.5배 넘게 늘릴 화면(화소비가 높은 큰 화면)만 큰 판(폭 1600)을 받는다.
// sizes = cover로 그려지는 폭 ÷ 1.47 — 브라우저는 작은 판으로 1.47배를 넘을 때 큰 판을 고른다. 넓은 창은 칸 폭((창 − min(46%,680px)) × 3/5)과
// 창 높이 × 0.805(사진 비율) 가운데 큰 쪽, 세로 창(820px 이하 · 정사각보다 좁음)은 창 폭과 62vh × 0.805 가운데 큰 쪽.
export const SCENE_SIZES='(max-width:820px) max(68.1vw,34vh), (max-aspect-ratio:1/1) max(68.1vw,34vh), max(22.1vw,calc(40.8vw - 277px),54.8vh)';
export {sceneSet}; // 두 판 고르기는 request-data.mjs에 있다(첫 화면 3쪽 · 고객 방과 같이 쓴다).
// 업종 작품 그림(KINDS shotShape — 세로 9:16 · 가로 16:9)은 큰 판이 없다(작품 원본 720p). 큰 칸은 늘리지 않고 그 꼴(data-shot)대로 놓는다(film.css):
// 세로 작품은 4초 영상과 같은 규칙, 가로 작품은 자르지 않고 어두운 방의 스크린처럼 폭에 맞춘다. 큰 판(srcset)이 있는 모델 장면 사진은 큰 칸에서 꼴 없이 채우던 그대로, 크기를 모르는 손님 사진 · 내 모델 그림은 채우되 실제 화소의 1.47배까지만 칸을 쓴다(data-cap — api.mjs capPixels · film.css, 11-13).
export const shotShape=src=>KINDS.find(kind=>kind.shot===src)?.shotShape||'';
const portraitImg=src=>{const set=sceneSet(src),shape=set?'':shotShape(src);return `<img data-portrait src="${esc(src)}"${set?` srcset="${esc(set)}" sizes="${SCENE_SIZES}"`:''}${shape?` data-shot="${shape}"`:''}${set||shape?'':' data-cap'} alt="" decoding="async">`;};
// 모델이 움직이는 4초(11-10): 캐스팅북(synk.im/pulse/casting) 모델 벽의 사람별 한 컷(장소 · 옷 · 동작이 사람마다 다르다)을 그 주소에서 그대로 받는다.
// 영상을 회사 서버에 두 벌 두지 않는다 — 캐스팅북 빌드가 정본이고(pulse-model-films 시험이 대조한다), 고객 앱 보안 정책(media-src · img-src https:)이 받는다.
// 세로 9:16 · 720p라 세로로 긴 칸(큰 칸 · 21명 벽 칸)에서만 돌리고, 큰 칸에서도 실제 화소의 1.5배 넘게 키우지 않는다(film.css).
// 가로로 넓은 넷 칸에는 잘라 넣지 않는다. 영상이 없는 모델(M03) · 움직임 줄이기 · 데이터 절약은 사진 그대로. 계속 도는 영상이라 큰 칸에 멈춤 단추를 둔다.
export const MODEL_FILM_BASE='https://synk.im/pulse/casting/';
export const MOVING_MODELS=Object.freeze(['M01','F01','F02','F03','M02','F04','F05','M04','F06','F07','M05','M06','F08','F09','F10','F11','M07','M08','M09','M10']);
export const modelFilm=item=>item&&MOVING_MODELS.includes(item.id)?{src:`${MODEL_FILM_BASE}video/${item.id}-wall.mp4`,poster:`${MODEL_FILM_BASE}img/${item.id}/wall.webp`}:null;
const stillOnly=()=>reduced()||!!globalThis.navigator?.connection?.saveData;
const canHover=()=>typeof matchMedia==='function'&&matchMedia('(hover:hover)').matches;
// 계속 도는 영상(큰 칸 lead · 예시 작품 win)의 멈춤 · 재생 단추. 보이는 글은 「멈춤」 · 「재생」, 읽는 이름에는 무엇을 멈추는지까지 담는다.
const holdName=(kind,paused)=>kind==='lead'?(paused?t('모델 영상 재생'):t('모델 영상 멈춤')):(paused?t('예시 작품 영상 재생'):t('예시 작품 영상 멈춤'));
const holdButton=(kind,paused)=>`<button type="button" class="sx-film-hold sx-small" data-do="filmhold" data-hold="${kind}"${paused?' data-paused':''} aria-label="${esc(holdName(kind,paused))}">${esc(paused?t('재생'):t('멈춤'))}</button>`;
// 예시 작품 한 줄: 「작품」 · 무엇으로 이기는지 · 출처.
const winCap=pick=>t('「{work}」 · {label} · 가상 브랜드로 만든 자체 작품',{work:t(pick.work),label:t(pick.label)});

const part=(step,index,total)=>`<p class="sx-q-part"><span class="sx-no">${String(index+1).padStart(2,'0')} / ${String(total).padStart(2,'0')}</span><b>${esc(t(step.part))}</b></p>`;
const ask=(step,index,total,title,lead,body)=>`${part(step,index,total)}<h1 class="sx-q-title sx-serif" tabindex="-1" data-title>${esc(title)}</h1>${lead?`<p class="sx-body sx-q-lead" data-in>${esc(lead)}</p>`:''}${body}`;
// 보내기 전 확인의 받으실 날 · 수정 한 줄(결정 11-07). 날은 달력 기준이고 자료가 다 모인 날부터 센다.
const dueLine=a=>{const pkg=pkgOf(a);if(!pkg)return '';return `<p class="sx-small sx-q-due" data-in>${pkg.days?`${esc(t('받으실 날은 사진 · 로고 · 꼭 넣을 말이 다 모인 날부터 {days}일이에요(주말 · 공휴일 포함).',{days:pkg.days}))} ${boldAt(t('오늘 다 모이면 {day}이에요.',{day:MARK}),dueDay(pkg))} ${esc(t('수정은 {note}.',{note:revisionNote(pkg)}))}`:esc(t('받으실 날과 수정 횟수는 구성에 맞춰 함께 정해요.'))}</p>`;};
const row=({i,label,note,on,attr,meta=''})=>`<button type="button" class="sx-row ${on?'is-on':''}" role="radio" aria-checked="${on?'true':'false'}" ${attr} data-in><span class="sx-no">${String(i+1).padStart(2,'0')}</span><span class="sx-row-main"><b class="sx-serif">${esc(label)}</b>${note?`<small class="sx-small">${esc(note)}</small>`:''}</span>${meta?`<span class="sx-row-meta">${meta}</span>`:''}<span class="sx-row-mark" aria-hidden="true"></span></button>`;
const field=({bind,label,value,placeholder='',help='',type='text',rows=0,max=400,auto=''})=>`<label class="sx-field" data-in><span class="sx-small">${esc(label)}</span>${rows?`<textarea data-bind="${bind}" rows="${rows}" maxlength="${max}" placeholder="${esc(placeholder)}">${esc(value)}</textarea>`:`<input data-bind="${bind}" type="${type}" value="${esc(value)}" maxlength="${max}" placeholder="${esc(placeholder)}" ${auto?`autocomplete="${auto}"`:''}>`}${help?`<small class="sx-small">${esc(help)}</small>`:''}</label>`;
// 칩 글은 부르는 자리에서 번역해 넘긴다(저장값 칩은 data-id에 한국어 값 그대로).
const chip=(label,on,attr)=>`<button type="button" class="sx-chip ${on?'is-on':''}" aria-pressed="${on?'true':'false'}" ${attr}>${esc(label)}</button>`;
// 모델 고르기: 제작사가 이 광고에 고른 넷을 크게 보여 준다. 고른 모델이 넷 밖이면 앞에 세우고, 손을 올리거나 고른 한 명이 크게 선다. 21명은 손님이 열 때만 펼친다.
// 이름 · 한 줄은 카탈로그의 한국어를 그리는 자리에서 번역한다(이름은 문맥 model).
const nameOf=item=>t(item.name,null,'model');
const castLine=item=>t(MODEL_LINES[item.id]?.line||item.description);
const castLabel=(item,fit)=>[nameOf(item),castLine(item),fit&&t('이 업종에 잘 맞아요')].filter(Boolean).join(' · ');
// 후보 넷 칸의 사진(11-13): 넓은 창의 큰 칸 옆 칸(큰 칸 자리의 2/5 폭 × 창 높이의 1/4)에서 캐스팅 context 사진(높이 720)이 화소비가 높은 큰 화면에서
// 2.6 ~ 2.8배로 늘었다. context는 그 모델의 장면 사진(960 · 1600)과 같은 그림이라(11-13 화소 대조 — F09만 다른 장이라 빼고 칸 줄이기만) 장면 사진 두 판을 srcset에 더한다.
// context 폭은 장면 사진 비율로 정해진다(960×1192 무리 580 · 960×1285 무리 538). 휴대폰 · 기준 화면은 context 그대로 받는다(받는 무게 그대로).
// sizes = cover 폭 ÷ 1.47 — 넓은 창은 칸 폭((창 − min(46%,680px)) × 2/5)과 창 높이 ÷ 4 × 0.805 가운데 큰 쪽, 세로 창은 넷이 한 줄(창 폭 ÷ 4, 3:4 칸 → 창 폭 × 0.269).
// 21명 벽(7 × 3 · 5 × 4)은 칸이 작아 context 그대로도 1.5배 안이다.
const CONTEXT_WIDE=new Set(['F01','F02','F03','F04','M01','M02','M03']),OWN_CONTEXT=new Set(['F09']);
export const CAST_SIZES='(max-width:820px) 18.3vw, (max-aspect-ratio:1/1) 18.3vw, max(14.7vw,calc(27.2vw - 185px),13.7vh)';
export const castSet=item=>{const src=sceneOf(item),scene=sceneSet(bigScene(item));return !OWN_CONTEXT.has(item.id)&&/-context\.webp$/.test(src)&&scene?`${src} ${CONTEXT_WIDE.has(item.id)?580:538}w, ${scene}`:'';};
const castImg=(item,lead)=>{const set=lead?castSet(item):'';return `<img src="${esc(sceneOf(item))}"${set?` srcset="${esc(set)}" sizes="${CAST_SIZES}"`:''}${lead?' data-cap':''} alt="" loading="lazy" decoding="async" width="538" height="720">`;};
const castTile=(a,item,fit,lead=false)=>`<button type="button" class="sx-cast ${a.models.includes(item.id)?'is-on':''}" aria-pressed="${a.models.includes(item.id)?'true':'false'}" aria-label="${esc(castLabel(item,fit))}" data-do="model" data-id="${item.id}">${castImg(item,lead)}<span class="sx-cast-name sx-small">${esc(nameOf(item))}</span><i class="sx-cast-mark sx-no" aria-hidden="true">${a.models.indexOf(item.id)+1||''}</i></button>`;
const picksOf=a=>(MODEL_PICKS[a.kind]||MODEL_PICKS.brand).map(modelOf).filter(Boolean);
// 모델 칸에서 「추천해 주세요」 · 「사람 없이 제품만」을 골랐을 때 이름 칸 · 큰 사진 밑줄에 쓰는 말(판 4 B6).
// 「맞춤 인물 요청하기」(판 3)는 인물 칸 사진이 있으면 그 사진을, 없으면 업종 작품 그림을 크게 둔다 — 밑줄은 어떤 사진인지에 맞춘다.
const personaCaption=a=>{const photo=personaPhoto(a);return photo?.identity?t('보내 주신 사진 · 이 분의 기준 얼굴을 먼저 만들어 보여 드려요'):photo?t('보내 주신 참고 사진 · 이 분위기로 새 얼굴을 만들어 보여 드려요'):t('맞춤 인물 · 기준 얼굴과 동작 시안을 먼저 보여 드려요');};
// 「내 모델」(PULSE 인물 판 4)에서 고른 인물: 이름 · 그림은 내 모델 화면이 넘긴 a.personaPick(화면에만 — 서버로 보내지 않는다). 이어 쓰는 초안이면 이름이 없을 수 있다.
const pickedName=a=>a.personaPick?.name||'';
// 칩 · 큰 사진 밑줄 · 적은 내용 · 접수증 한 줄: 이름을 알면 「내 모델 · 이름」, 모르면(화면 메모리가 없는 이어 쓰는 초안) 「내 모델」 — 「내 모델 · 내 모델」로 겹치지 않게.
const pickedLabel=a=>pickedName(a)?t('내 모델 · {name}',{name:pickedName(a)}):t('내 모델');
const choiceText=a=>a.modelChoice==='ask'?{name:t('추천해 주세요'),line:t('방향 두 안과 함께 어울리는 모델을 골라 보내 드려요.'),caption:t('어울리는 모델 후보 · 담당자가 방향과 함께 추천해요')}:a.modelChoice==='none'?{name:t('사람 없이 제품만'),line:t('제품 · 손 · 공간만으로 만들어요.'),caption:t('모델 없이 만드는 광고예요')}:a.modelChoice==='custom'?{name:t('맞춤 인물'),line:t('이 광고에 맞는 인물을 새로 만들어요.'),caption:personaCaption(a)}:a.modelChoice==='persona'?{name:pickedName(a)||t('내 모델의 모델'),line:t('내 모델에서 고른 모델로 만들어요. 사진을 다시 보내지 않아도 돼요.'),caption:pickedLabel(a)}:null;
// 그때 큰 사진 자리에는 한 사람 대신 고른 업종의 작품 그림을 둔다(B7과 같은 그림, 판 4 화면 검수 F4). 내 모델은 그 인물의 기준 얼굴.
const choiceShot=a=>a.modelChoice==='custom'&&personaPhoto(a)?.src||a.modelChoice==='persona'&&a.personaPick?.image||kindOf(a)?.shot||still('w-gift-sphere');
const wall=a=>{
  const chosen=a.models.map(modelOf).filter(Boolean),picks=[...new Set([...chosen,...picksOf(a)])].slice(0,4),lead=chosen[0]||picks[0];
  return `<div class="sx-casting" role="group" aria-label="${esc(t('이 광고에 어울리는 모델'))}"><figure class="sx-casting-lead" role="presentation">${portraitImg(choiceText(a)?choiceShot(a):bigScene(lead))}<video data-portrait-film muted loop playsinline preload="none" disablepictureinpicture disableremoteplayback aria-hidden="true"></video><figcaption class="sx-small" data-portrait-name aria-hidden="true">${esc(choiceText(a)?choiceText(a).caption:`${nameOf(lead)} · ${castLine(lead)}`)}</figcaption>${holdButton('lead',false)}</figure>${picks.map(item=>castTile(a,item,!!MODEL_LINES[item.id]?.fits.includes(a.kind),true)).join('')}<button type="button" class="sx-small sx-link sx-casting-all" data-do="allmodels">${esc(t('{count}명 모두 보기',{count:CASTING_MODELS.length}))}</button></div>`;
};
const allWall=a=>{
  const fit=item=>!!MODEL_LINES[item.id]?.fits.includes(a.kind);
  return `<div class="sx-wall" role="group" aria-label="${esc(t('모델 {count}명',{count:CASTING_MODELS.length}))}">${[...CASTING_MODELS.filter(fit),...CASTING_MODELS.filter(item=>!fit(item))].map(item=>castTile(a,item,fit(item))).join('')}<button type="button" class="sx-small sx-link sx-wall-close" data-do="allmodels">${esc(t('넷만 보기'))}</button></div>`;
};
// 안내 · 메일 언어(허락 언어가 둘 이상일 때만 — 하나면 칸도 값도 없다). 언어 이름은 그 언어로 쓴다. 고르기 전의 값(지금 화면 언어)은 mount가 채운다.
const contactLocaleView=a=>{
  const list=offeredLocales();if(list.length<2)return '';
  return `<div class="sx-sub" data-in><span class="sx-small">${esc(t('안내 · 메일 언어'))}</span><div class="sx-chips" role="group" aria-label="${esc(t('안내 · 메일 언어'))}">${list.map(value=>`<button type="button" class="sx-chip ${a.contactLocale===value?'is-on':''}" aria-pressed="${a.contactLocale===value?'true':'false'}" lang="${htmlLang(value)}" data-do="contactlocale" data-id="${value}">${esc(LANG_NAMES[value]||value)}</button>`).join('')}</div></div>`;
};
// 확인 단계 요약의 한 줄(허락 언어가 둘 이상일 때만).
const contactLocaleRow=a=>offeredLocales().length>1&&LANG_NAMES[a.contactLocale]?[{key:k('안내 · 메일 언어'),step:'contact',value:LANG_NAMES[a.contactLocale],missing:'',lang:htmlLang(a.contactLocale)}]:[];

// ── 의뢰서 탭(11-13): 과감함 · 꼭 붙일 표시 · 목소리. 모두 눌러 고르고, 고르지 않아도 넘어간다. ──
const boldNote=a=>{const item=BOLD.find(item=>item.id===a.bold),note=pkgOf(a)?.photo&&item?.photoNote||item?.note;return note?t(note):'';};
const boldBlock=a=>`<div class="sx-sub" data-in><span class="sx-small">${esc(t('얼마나 과감하게 갈까요? · 선택'))}</span><div class="sx-chips" role="group" aria-label="${esc(t('얼마나 과감하게'))}">${BOLD.map(item=>chip(t(item.label),a.bold===item.id,`data-do="bold" data-id="${item.id}"`)).join('')}</div><small class="sx-small sx-q-hint" data-bold-note${boldNote(a)?'':' hidden'}>${esc(boldNote(a))}</small></div>`;
const noticeMore=a=>a.notice==='unsure'?`<small class="sx-small sx-q-hint">${esc(t('괜찮아요. 저희가 확인해 보고, 필요하면 그때 여쭤볼게요.'))}</small>`:!noticeOn(a)?'':`<small class="sx-small sx-q-hint">${esc(t('표시나 심의가 따로 정해진 업종이에요. 들어갈 문구와 자리를 1차안에 함께 넣어 보여 드리고, 최종 문구는 확인을 받아요.'))}</small>${field({bind:'noticeText',label:t('이미 쓰시는 고지 문구 · 심의 번호 · 선택'),value:a.noticeText,placeholder:t('예) 늘 넣으시는 안내 문구, 받아 두신 심의 번호'),max:300})}`;
// 광고할 것의 종류에 맞는 갈래만 보인다. 종류를 바꾸기 전에 고른 갈래는 맨 앞에 그대로 둔다(고른 것이 안 보이면 풀 수도 없다).
const noticeIds=a=>{const ids=NOTICE_KINDS[a.kind]||NOTICE_KINDS.brand;return noticeOn(a)&&!ids.includes(a.notice)?[a.notice,...ids]:ids;};
const noticeBlock=a=>`<div class="sx-sub" data-in><span class="sx-small">${esc(t('광고에 꼭 붙여야 하는 표시가 있는 업종인가요?'))}</span><div class="sx-chips" role="group" aria-label="${esc(t('꼭 붙일 표시'))}">${[...noticeIds(a).map(id=>[id,t(noticeLabel(id))]),['none',t('해당 없어요')],['unsure',t('잘 모르겠어요')]].map(([id,label])=>chip(label,a.notice===id,`data-do="notice" data-id="${esc(id)}"`)).join('')}</div><div data-notice-more>${noticeMore(a)}</div></div>`;
const voiceNote=a=>{const note=VOICES.find(item=>item.id===a.voice)?.note;return note?t(note):'';};
const voiceBlock=a=>pkgOf(a)?.photo?'':`<div class="sx-sub" data-in data-voice-block><span class="sx-small">${esc(t('목소리는 어떻게 할까요? · 선택'))}</span><div class="sx-chips" role="group" aria-label="${esc(t('목소리'))}">${VOICES.filter(item=>item.id!=='model'||a.modelChoice!=='none').map(item=>chip(t(item.label),a.voice===item.id,`data-do="voice" data-id="${item.id}"`)).join('')}</div><small class="sx-small sx-q-hint" data-voice-note${voiceNote(a)?'':' hidden'}>${esc(voiceNote(a))}</small></div>`;

const views={
  what(a,step,i,n){
    return ask(step,i,n,t('무엇을 광고할까요?'),t('종류에 따라 준비하실 것이 달라져요. 맞는 것 하나만 골라 주세요.'),
      field({bind:'name',label:t('제품이나 브랜드 이름'),value:a.name,placeholder:t('예) 오미톡 오미자 스파클링'),max:120})+
      `<div class="sx-rows is-kinds" role="radiogroup" aria-label="${esc(t('광고할 것의 종류'))}">${KINDS.map((item,index)=>row({i:index,label:t(item.label),note:t(item.note),on:a.kind===item.id,attr:`data-do="kind" data-id="${item.id}"`})).join('')}</div>`);
  },
  where(a,step,i,n){
    return ask(step,i,n,t('어디에 올리고, 얼마나 길게 할까요?'),t('올릴 곳에 따라 화면 비율이 정해져요. 모르면 비워 두셔도 저희가 제안해요.'),
      `<div class="sx-chips" data-in role="group" aria-label="${esc(t('올릴 곳'))}">${CHANNELS.map(item=>chip(t(item.label),a.channels.includes(item.id),`data-do="channel" data-id="${item.id}"`)).join('')}</div>`+
      `<div class="sx-rows is-tight" role="radiogroup" aria-label="${esc(t('길이와 구성'))}">${PACKAGES.map((item,index)=>row({i:index,label:t(item.label),note:item.note?`${t(item.title)} · ${t(item.note)}`:t(item.title),on:a.package===item.id,attr:`data-do="package" data-id="${item.id}"`,meta:`<span class="sx-small">${esc(t('{price}부터',{price:price(item.price)}))}</span><span class="sx-small sx-row-terms">${esc(termsOf(item))}</span>`})).join('')}${row({i:PACKAGES.length,label:t('추천해 주세요'),note:t('올릴 곳을 보고 맞는 구성을 말씀드려요'),on:a.package==='ask',attr:'data-do="package" data-id="ask"'})}</div>`+
      `<label class="sx-tick" data-in><input type="checkbox" data-bind="paid" ${a.paid?'checked':''}><span>${esc(t('광고비를 써서 돌릴 거예요'))}</span><small class="sx-small">${esc(t('심사에 필요한 표시와 규격까지 함께 챙겨 드려요.'))}</small></label>`);
  },
  files(a,step,i,n){
    // 사진 상품에는 소리 파일 칸을 두지 않는다 — 이미 올린 소리 파일이 있으면 볼 수 있고 지울 수 있게 남긴다. 크기 칸은 거르기 전 묶음으로 정한다(걸러 낸 배열은 늘 새 배열이다).
    const group=slotsFor(a.kind),slots=group.filter(slot=>slot.id!=='sound'||!pkgOf(a)?.photo||filesOf(a,slot.id).length);
    return ask(step,i,n,t('이것만 보내 주세요'),t('제품 · 로고 · 글자는 AI로 다시 그리지 않고 보내 주신 파일을 그대로 얹어요. 그래서 원본이 중요해요. 지금 없는 건 나중에 보내도 돼요.'),
      `<div class="sx-slots">${slots.map(slotView.bind(null,a)).join('')}</div>`+
      field({bind:'pageUrl',label:t('제품 · 서비스 페이지 주소'),value:a.pageUrl,placeholder:'https://',help:t('여기 적힌 내용은 다시 적지 않으셔도 돼요.'),type:'url',max:1000})+
      (group===slotsFor('food')?field({bind:'size',label:t('손에 들면 어느 정도 크기인가요?'),value:a.size,placeholder:t('예) 355ml 캔, 손바닥 안에 들어와요'),max:120}):'')+
      field({bind:'driveUrl',label:t('파일이 크면 드라이브 링크로'),value:a.driveUrl,placeholder:'https://',type:'url',max:1000}));
  },
  message(a,step,i,n){
    return ask(step,i,n,t('보는 사람에게 무엇을 남길까요?'),t('광고 문장이 아니어도 돼요. 평소 하시는 말로 적어 주시면 저희가 한 문장으로 다듬어 1차안에 보여 드려요.'),
      field({bind:'audience',label:t('이 제품은 누가, 언제 찾나요?'),value:a.audience,placeholder:t('예) 운동 끝나고 목마른 20대, 출근 전 시간이 없는 직장인'),rows:2,max:300})+
      field({bind:'oneThing',label:t('딱 하나만 남긴다면요?'),value:a.oneThing,placeholder:t('예) 한 캔에 맛이 다섯 번 바뀐다'),rows:2,max:300})+
      `<div class="sx-sub" data-in><span class="sx-small">${esc(t('보고 나서 무엇을 하면 좋을까요?'))}</span><div class="sx-chips">${ACTIONS.map(item=>chip(t(item.label),a.action===item.id,`data-do="action" data-id="${item.id}"`)).join('')}</div></div>`);
  },
  words(a,step,i,n){
    const watch=WATCH_WORDS[a.kind]||WATCH_WORDS.brand;
    return ask(step,i,n,t('화면에 정확히 나와야 할 글자가 있나요?'),t('제품명 표기, 가격, 기간, 꼭 넣어야 할 안내처럼 한 글자도 바뀌면 안 되는 말이에요. 화면에 바로 얹어 볼게요.'),
      field({bind:'screenText',label:t('화면에 나올 글자'),value:a.screenText,placeholder:t('예) 다섯 가지 맛, 톡.\n11월 편의점 출시'),rows:3,max:300})+
      `<div class="sx-sub" data-in><span class="sx-small">${esc(t('쓰면 안 되는 말 · 업종마다 자주 걸리는 말이에요. 빼야 하는 말을 눌러 주세요.'))}</span><div class="sx-chips">${watch.map(word=>chip(claimText(word),a.avoid.includes(word),`data-do="avoid" data-id="${esc(word)}"`)).join('')}</div></div>`+
      field({bind:'avoidNote',label:t('그 밖에 피할 말이나 표현'),value:a.avoidNote,placeholder:t('예) 경쟁사 이름, 과한 표정'),max:300})+
      noticeBlock(a)+
      field({bind:'facts',label:t('자랑해도 되는 사실 · 선택'),value:a.facts,placeholder:t('예) 누적 판매 12만 개, ○○ 인증'),help:t('자료가 있는 것만 적어 주세요. 그 자료도 준비물에 함께 넣어 주시면 좋아요.'),max:300}));
  },
  feel(a,step,i,n){
    const ref=a.refs[0]||{url:'',points:[],why:''};
    return ask(step,i,n,t('무엇으로 오래 남을까요?'),t('광고는 보통 셋 중 하나로 이겨요. 기획 첫 줄에 이것부터 정해요.'),
      `<div class="sx-rows" role="radiogroup" aria-label="${esc(t('무엇으로 남길지'))}">${WIN.map((item,index)=>row({i:index,label:t(item.label),note:t(item.note),on:a.win===item.id,attr:`data-do="win" data-id="${item.id}"`})).join('')}${row({i:WIN.length,label:t('맡길게요'),note:t('제품에 맞는 쪽을 1차안에서 제안해요'),on:a.win==='ask',attr:'data-do="win" data-id="ask"'})}</div>`+
      boldBlock(a)+
      field({bind:'refUrl',label:t('이런 광고면 좋겠어요 · 링크'),value:ref.url,placeholder:'https://',type:'url',max:1000,help:t('반응이 좋았던 광고의 짜임을 재서 뼈대로 쓰기 때문에, 참고 영상 하나가 말 열 줄보다 큰 힘이 돼요.')})+
      `<div class="sx-sub" data-in><span class="sx-small">${esc(t('그 광고의 어디가 좋았나요?'))}</span><div class="sx-chips">${REFERENCE_POINTS.map(point=>chip(t(point),ref.points.includes(point),`data-do="refpoint" data-id="${esc(point)}"`)).join('')}</div></div>`+
      field({bind:'avoidFeel',label:t('이런 느낌은 피해 주세요 · 선택'),value:a.avoidFeel,placeholder:t('예) 홈쇼핑 같은 느낌'),max:200}));
  },
  // ctx(판 3): {flags:{request,real} — 서버가 허락한 맞춤 인물 스위치, photos — 인물 사진을 받는 길(공개 의뢰서)}. 스위치가 꺼져 있으면 판 3 전과 같은 화면이다.
  model(a,step,i,n,ctx={}){
    return ask(step,i,n,t('누가 나올까요?'),t('이름과 얼굴이 정해진 AI 모델 {count}명이에요. 다음 편도 같은 모델로 이어 가요. 두 명까지 고르실 수 있어요.',{count:CASTING_MODELS.length}),
      `<div class="sx-chips" data-in role="group" aria-label="${esc(t('모델을 어떻게 정할지'))}">${a.modelChoice==='persona'?chip(pickedLabel(a),true,'data-do="modelchoice" data-id="persona"'):''}${chip(t('추천해 주세요'),a.modelChoice==='ask','data-do="modelchoice" data-id="ask"')}${chip(t('사람 없이 제품만'),a.modelChoice==='none','data-do="modelchoice" data-id="none"')}${ctx.flags?.request?chip(t('맞춤 인물 요청하기'),a.modelChoice==='custom','data-do="modelchoice" data-id="custom"'):''}</div>`+
      modelDetail(a,ctx)+voiceBlock(a));
  },
  contact(a,step,i,n){
    return ask(step,i,n,t('언제까지, 누구에게 연락드릴까요?'),'',
      `<div class="sx-duo">${field({bind:'date',label:t('받고 싶은 날'),value:a.date,type:'date'})}<div class="sx-sub is-end" data-in>${chip(t('정해진 날짜는 없어요'),a.dateFree,'data-do="datefree"')}</div></div><p class="sx-small sx-q-advice" data-date-advice hidden></p>`+
      `<div class="sx-sub" data-in><span class="sx-small">${esc(t('최종 확인은 누가 하나요?'))}</span><div class="sx-chips">${chip(t('제가 정해요'),a.approver==='one','data-do="approver" data-id="one"')}${chip(t('여러 명이 봐요'),a.approver==='many','data-do="approver" data-id="many"')}</div><div data-approver-more>${approverMore(a)}</div></div>`+
      `<div class="sx-duo">${field({bind:'contactName',label:t('성함'),value:a.contactName,auto:'name',max:80})}${field({bind:'company',label:t('회사 · 브랜드 · 선택'),value:a.company,auto:'organization',max:120})}</div>`+
      `<div class="sx-duo">${field({bind:'email',label:t('이메일'),value:a.email,type:'email',auto:'email',max:254})}${field({bind:'phone',label:t('휴대폰 · 선택'),value:a.phone,type:'tel',auto:'tel',max:30})}</div>`+
      contactLocaleView(a));
  },
  review(a,step,i,n,ctx={}){
    const rows=withPersonaRow(a,[...briefRows(a),...contactLocaleRow(a)],ctx);
    return ask(step,i,n,t('이대로 보낼까요?'),pkgOf(a)?.photo?t('보내 주시면 저희가 내용을 확인하고 첫 장을 먼저 보내 드려요. 첫 장으로 방향을 맞춘 뒤 나머지 사진을 만들어요.'):t('보내 주시면 저희가 내용을 확인하고 방향 두 안과 값 · 받으실 날을 보내 드려요. 영상을 만들기 전에 방향 · 글 콘티 · 컷마다 장면 이미지를 먼저 보여 드리고, 확인하시기 전에는 영상을 만들지 않아요.'),
      `<div class="sx-brief" data-in>${rows.map(item=>`<div class="sx-brief-row ${item.missing?'is-missing':''}"><span class="sx-small">${esc(t(item.key))}</span><span class="sx-brief-val"${item.lang?` lang="${item.lang}"`:''}>${item.missing?`<em>${esc(t(item.missing))}</em>`:esc(item.value)}</span><button type="button" class="sx-small sx-brief-edit" data-do="goto" data-id="${item.step}" aria-label="${esc(t('{label} 고치기',{label:t(item.key)}))}">${esc(t('고치기'))}</button></div>`).join('')}</div>`+
      `${dueLine(a)}${a.modelChoice==='custom'?`<p class="sx-small sx-q-due" data-in>${esc(t('맞춤 인물 값은 검토한 뒤 따로 견적을 보내 드려요. 견적을 확인하시기 전에는 비용이 생기지 않아요.'))}</p>`:a.modelChoice==='persona'?`<p class="sx-small sx-q-due" data-in>${esc(t('내 모델로 의뢰하면 사진을 다시 보내지 않아도 돼요. 이번 광고에 쓸 범위는 담당자가 정리해 따로 확인받아요.'))}</p>`:''}`+
      `<label class="sx-tick" data-in><input type="checkbox" data-bind="consent" ${a.consent?'checked':''}><span>${esc(t('이 내용과 연락처를 의뢰 확인과 제작에 쓰는 데 동의해요'))}</span><small class="sx-small">${esc(t('제작으로 이어지지 않으면 90일 뒤 지워요.'))}</small></label>`+
      `<label class="sx-tick" data-in><input type="checkbox" data-bind="rights" ${a.rights?'checked':''}><span>${esc(t('보내는 사진 · 로고 · 문구를 쓸 권리가 있어요'))}</span><small class="sx-small">${esc(ctx.flags?.real?t('영상 속 사람과 목소리는 모두 AI로 만들어요. 실제 인물은 출연하실 분의 동의를 확인한 뒤에만 만들어요.'):t('영상 속 사람과 목소리는 모두 AI로 만들어요. 실존 인물을 닮게 만드는 요청은 받지 않아요.'))}</small></label><p class="sx-small sx-q-terms" data-in>${esc(t('결제는 글 콘티를 보신 뒤 크몽에서 해요. 결제 뒤 장면 이미지를 확정하시기 전에 그만두시면 전액 돌려드리고, 제작을 시작한 뒤에는 맞춤 제작이라 환불 대신 수정 횟수 안에서 고쳐 드려요. 완성한 광고는 공개하신 뒤에 SYNK PULSE 작품으로 소개할 수 있어요 — 원하지 않으시면 담당자에게 알려 주세요.'))}</p>`);
  },
};
// 모델 칸 아래: 고른 사람 · 고른 길(추천 · 사람 없이)의 설명. 맞춤 인물을 고르면 그 자리가 요청 칸으로 바뀐다(판 3).
function modelDetail(a,ctx={}){
  if(a.modelChoice==='custom'&&ctx.flags?.request)return personaBlock(a,ctx);
  const first=modelOf(a.models[0])||picksOf(a)[0]||CASTING_MODELS[2];
  return choiceText(a)?`<div class="sx-q-who" data-in><b class="sx-serif" data-cast-name>${esc(choiceText(a).name)}</b><span class="sx-body" data-cast-line>${esc(choiceText(a).line)}</span><small class="sx-small" data-cast-desc></small></div>`:`<div class="sx-q-who" data-in><b class="sx-serif" data-cast-name>${esc(nameOf(first))}</b><span class="sx-body" data-cast-line>${esc(MODEL_LINES[first.id]?.line?t(MODEL_LINES[first.id].line):'')}</span><small class="sx-small" data-cast-desc>${esc(t(first.description))}</small></div>`;
}
// 맞춤 인물 요청(판 3): 인물 종류(실제 인물은 personaReal일 때만) · 원하는 인상 · 쓰임 · 이번만/다음에도 · 사진 칸(공개 의뢰서만) · 사진 쓰임 · 비용이 생기는 때.
// 국적 · 신체 치수 · 학습 설정은 묻지 않는다(기획 4절). 사진 몇 장으로 같은 얼굴을 약속하지 않는다(칸 설명). 출연하실 분의 사진 칸은 실제 인물일 때만(또는 이미 올린 사진이 있을 때 — 지울 수 있게) 연다.
function personaBlock(a,ctx){
  const p=a.personaRequest,real=p.kind==='real'&&!!ctx.flags.real;
  const group=(label,name,list,value)=>`<div class="sx-sub" data-in><span class="sx-small">${esc(label)}</span><div class="sx-chips" role="group" aria-label="${esc(label)}">${list.map(item=>chip(t(item.label),value===item.id,`data-do="${name}" data-id="${item.id}"`)).join('')}</div></div>`;
  const slots=PERSONA_SLOTS.filter(slot=>slot.id!=='persona-identity'||real||filesOf(a,slot.id).length);
  return `<div class="sx-q-persona">`+
    (ctx.flags.real?group(t('어떤 인물인가요?'),'personakind',PERSONA_KINDS,real?'real':'virtual'):'')+
    field({bind:'persona.look',label:real?t('출연하실 분과 참고할 점'):t('원하는 인상 · 나이대 · 헤어'),value:p.look,placeholder:real?t('예) 대표님 본인, 매장에서 일하시는 모습 그대로'):t('예) 20대 후반, 단정한 단발, 웃으면 눈이 접히는 인상'),rows:2,max:600})+
    (real?group(t('출연하실 분과는 어떤 사이인가요?'),'personarelation',PERSONA_RELATIONS,p.relation)+group(t('출연하실 분의 동의는 어떻게 확인할까요?'),'personaconsent',PERSONA_CONSENTS,p.consentWay)+`<p class="sx-small sx-q-hint" data-in>${esc(t('출연하실 분께 따로 확인을 받아요. 여기서 고르시는 것만으로 동의가 끝나지는 않아요.'))}</p>`:'')+
    field({bind:'persona.use',label:t('어디에 쓰고 싶으세요?'),value:p.use,placeholder:t('예) 이번 광고와 매장 화면'),max:300})+
    group(t('다음 광고에도 쓰실 건가요?'),'personakeep',PERSONA_KEEPS,p.keep)+
    (ctx.photos?`<div class="sx-slots">${slots.map(slotView.bind(null,a)).join('')}</div>`:`<p class="sx-small sx-q-hint" data-in>${esc(t('사진은 의뢰서를 보내신 뒤 고객 방에서 올려 주세요.'))}</p>`)+
    `<p class="sx-small sx-q-hint" data-in>${esc(t('사진은 PULSE 제작팀만 보고, 이 인물을 검토하고 만드는 데만 써요.'))} ${esc(t('견적을 확인하시기 전에는 비용이 생기지 않아요.'))}</p>`+
    // 보관(11-11 결정 표 ① · ④ · ⑤ · ⑥, 판 4 설계 11-4): 이 의뢰에만 · 의뢰 기록과 함께 둠(지우기는 담당자에게) · 다시 쓰기는 브랜드 관리자의 12개월 동의 · 백업 최대 13개월 · 금고 제외.
    // 90일 시계(11-12, 판 4 설계 11-6): 공개 의뢰서 · 방 안 의뢰서 모두 같은 문장 — 원 프로젝트가 제작으로 이어지지 않은 채 90일 움직이지 않으면
    // 사진과 인물을 지운다(서버 pulse-workspaces sweepRetention의 origin_stopped · 공개 의뢰서 정리의 origin_retired). 의뢰 기록 자체의 정리는 이 문장이 약속하지 않는다.
    `<p class="sx-small sx-q-hint" data-in>${esc(t('사진과 만들어 드린 인물은 이 의뢰에만 쓰고, 이 의뢰의 기록과 함께 둬요. 지우기를 원하시면 담당자에게 알려 주세요.'))} ${esc(t('제작으로 이어지지 않고 90일 동안 진행이 없으면 사진과 인물을 지워요.'))} ${esc(t('다음 광고에도 쓰려면 브랜드 관리자가 12개월 보관에 따로 동의해야 해요. 지운 뒤에도 서버 백업 사본에는 최대 13개월 남았다가 지워지고, 오래 두는 별도 보관 사본에는 넣지 않아요.'))}</p>`+
  `</div>`;
}
// 확인 단계: 맞춤 인물이면 「모델」 줄 다음에 인물 사진 줄(공개 의뢰서는 올린 장수, 프로젝트 길은 고객 방에서 올린다는 말).
function withPersonaRow(a,rows,ctx){
  if(a.modelChoice!=='custom')return rows;
  const count=PERSONA_SLOTS.reduce((sum,slot)=>sum+filesOf(a,slot.id).length,0),at=rows.findIndex(row=>row.key===k('모델'))+1||rows.length;
  const row={key:k('인물 사진'),step:'model',value:count?t('{count}장',{count}):'',missing:count?'':ctx.photos?k('보내신 뒤 고객 방에서도 보내실 수 있어요'):k('보내신 뒤 고객 방에서 올려 주세요')};
  return [...rows.slice(0,at),row,...rows.slice(at)];
}
const approverMore=a=>a.approver==='many'?`<small class="sx-small sx-q-hint">${esc(t('의견을 모아 한 번에 보내 주시면 수정이 크게 줄어요. 컷마다 의견을 모아 보낼 수 있어요.'))}</small>${field({bind:'approverName',label:t('최종 결정하시는 분 · 선택'),value:a.approverName,max:80})}`:'';
function slotView(a,slot){
  const files=filesOf(a,slot.id),none=a.slots[slot.id]?.none,label=t(slot.label);
  return `<article class="sx-slot ${files.length?'has-file':''} ${none?'is-none':''}" data-slot="${slot.id}" data-in>
    <label class="sx-slot-frame"><input type="file" class="sr" data-file="${slot.id}" accept="${esc(slot.accept)}" aria-label="${esc(t('{label} 파일 고르기',{label}))}" ${slot.multiple?'multiple':''}>${files.length?files.slice(0,3).map(fileThumb).join(''):'<span class="sx-slot-plus" aria-hidden="true">+</span>'}</label>
    <div class="sx-slot-text"><h3>${esc(label)}<span class="sx-small">${esc(slot.need?t('꼭'):t('있으면'))}</span></h3><p class="sx-small">${esc(t(slot.why))}</p>
      <div class="sx-small sx-slot-status" data-status="${slot.id}">${slotStatus(a,slot)}</div>
      ${files.length?`<ul class="sx-slot-files">${files.map((file,i)=>`<li class="sx-small"><span>${esc(file.fileName)}</span>${file.uploading?'':retryable.has(file)?`<span class="sx-slot-file-act"><button type="button" class="sx-link" data-do="retryfile" data-slot-id="${slot.id}" data-at="${i}" data-key="${fileKey(file)}" aria-label="${esc(t('{name} 다시 올리기',{name:file.fileName}))}">${esc(t('다시 올리기'))}</button>${`<button type="button" class="sx-link" data-do="removefile" data-slot-id="${slot.id}" data-at="${i}" data-key="${fileKey(file)}" aria-label="${esc(t('{name} 지우기',{name:file.fileName}))}">${esc(t('지우기',null,'file'))}</button>`}</span>`:`<button type="button" class="sx-link" data-do="removefile" data-slot-id="${slot.id}" data-at="${i}" data-key="${fileKey(file)}" aria-label="${esc(t('{name} 지우기',{name:file.fileName}))}">${esc(t('지우기',null,'file'))}</button>`}</li>`).join('')}</ul>`:''}
      ${slot.note?`<input class="sx-slot-note" data-bind="useNote" value="${esc(a.useNote)}" maxlength="200" placeholder="${esc(t(slot.note))}" aria-label="${esc(t('{label} 한 줄로 적기',{label}))}">`:''}
      ${slot.need?`<button type="button" class="sx-chip is-small ${none?'is-on':''}" data-do="none" data-id="${slot.id}" aria-pressed="${none?'true':'false'}">${esc(t('지금 없어요'))}</button>`:''}
    </div></article>`;
}
const fileThumb=file=>file.preview?`<img src="${esc(file.preview)}" alt="${esc(file.fileName)}">`:`<span class="sx-slot-doc sx-no">${esc((file.fileName.split('.').pop()||'FILE').toUpperCase().slice(0,4))}</span>`;
function slotStatus(a,slot){
  const files=filesOf(a,slot.id);
  if(a.slots[slot.id]?.none)return `<i class="sx-led is-wait"></i>${esc(t('나중에 보내 주세요. 1차안에는 자리만 잡아 둘게요.'))}`;
  if(!files.length)return '';
  // 올리는 중인 줄 → 실패한 줄 → 마지막 줄 차례로 말한다(최종 검수 F5 — 실패한 앞 줄을 다시 올릴 때도 진행 · 실패 까닭이 보이게).
  const last=files.find(file=>file.uploading)||[...files].reverse().find(file=>file.error)||files[files.length-1];
  if(last.uploading)return `<i class="sx-led is-busy"></i>${esc(t('올리는 중 {percent}%',{percent:Math.round((last.progress||0)*100)}))}`;
  if(last.error)return `<i class="sx-led is-wait"></i>${esc(last.error)}`;
  // 사진 점검 글은 그릴 때마다 지금 언어로 다시 만든다(크기는 올릴 때 잰 값).
  const advice=last.advice&&Number.isFinite(last.width)&&Number.isFinite(last.height)?photoAdvice(last.width,last.height,slot.kind):last.advice;
  return `<i class="sx-led ${advice?.state==='note'?'is-wait':'is-ok'}"></i>${esc(advice?.text||t('{count}개 받았어요',{count:files.length}))}`;
}
// 스크린 아래 크레딧: 고른 것이 한 줄씩 쌓인다.
function slateRows(a){
  const pkg=pkgOf(a),rows=[];
  // 줄 이름은 한국어 키로 두고(줄을 알아보는 이름이기도 하다 — 그리는 자리에서 번역) 값의 고정 낱말만 여기서 번역한다. 손님이 쓴 글은 그대로.
  if(a.name)rows.push([k('광고할 것'),a.name]);
  if(a.kind)rows.push([k('종류'),kindOf(a)?t(kindOf(a).label):undefined]);
  if(a.channels.length)rows.push([k('올릴 곳'),a.channels.map(id=>CHANNELS.find(item=>item.id===id)?.label).filter(Boolean).map(label=>t(label)).join(', ')]);
  if(a.package)rows.push([k('길이'),pkg?t('{label} · {price}부터 · {terms}',{label:t(pkg.label),price:price(pkg.price),terms:termsOf(pkg)}):t('추천해 주세요')]);
  if(slotCount(a))rows.push([k('받은 자료'),t('{count}개',{count:slotCount(a)})]);
  if(a.oneThing)rows.push([k('남길 것'),a.oneThing]);
  if(a.screenText)rows.push([k('화면 글자'),a.screenText.split('\n')[0]]);
  if(a.win)rows.push([k('무엇으로'),t(WIN.find(item=>item.id===a.win)?.label||k('맡길게요'))]);
  if(BOLD.find(item=>item.id===a.bold))rows.push([k('과감함'),t(BOLD.find(item=>item.id===a.bold).label)]);
  if(a.models.length||a.modelChoice)rows.push([k('모델'),a.modelChoice==='none'?t('사람 없이 제품만'):a.modelChoice==='ask'?t('추천해 주세요'):a.modelChoice==='custom'?t('맞춤 인물'):a.modelChoice==='persona'?pickedLabel(a):a.models.map(modelOf).filter(Boolean).map(nameOf).join(', ')]);
  if(!pkg?.photo&&VOICES.find(item=>item.id===a.voice))rows.push([k('목소리'),t(VOICES.find(item=>item.id===a.voice).label)]);
  if(a.date||a.dateFree)rows.push([k('받고 싶은 날'),a.dateFree?t('미정'):a.date]);
  return rows;
}

export function mountRequestFlow(root,{backend,onRoom,onExit}){
  const a=backend.answers||emptyAnswers();if(!a.refs?.length)a.refs=[{url:'',points:[],why:''}];
  // 맞춤 인물 스위치(판 3, 서버가 허락한 값 — request-backend). 꺼져 있으면 저장돼 있던 「맞춤 인물」 고름은 비운다(서버가 보내기를 409로 막는다).
  // 실제 인물 출연은 그 스위치가 켜져 있을 때만 — 꺼져 있으면 새 가상 인물로 돌린다. photos: 인물 사진을 받는 길(공개 의뢰서)인가.
  const ctx={flags:backend.personaFlags?.()||{request:false,real:false,models:false},photos:!!backend.personaPhotos};
  if(!a.personaRequest||typeof a.personaRequest!=='object')a.personaRequest=emptyAnswers().personaRequest;
  // 꺼진 스위치로 비우는 것은 공개 초안 길(photos)뿐이다 — 프로젝트 길 의뢰서는 진행 중인 인물 요청 · 내 모델 다시 쓰기를 그대로 둔다(판 3 화면 검수 F3, 판 4 D8).
  if(ctx.photos&&a.modelChoice==='custom'&&!ctx.flags.request)a.modelChoice='';
  if(ctx.photos&&a.modelChoice==='persona'&&!ctx.flags.models)a.modelChoice='';
  // 내 모델에서 붙인 인물의 이름 · 그림(화면에만). 붙임이 없으면 비운다.
  a.personaPick=a.modelChoice==='persona'?backend.personaPick||null:null;
  if(ctx.flags.request&&a.personaRequest.kind==='real'&&!ctx.flags.real)a.personaRequest.kind='virtual';
  let index=Math.max(0,STEPS.findIndex(step=>step.id===backend.step));
  let busy=false,saveTimer=0,saving=null,saveAgain=false,sent=null,closed=false;
  root.innerHTML=`<div class="sx-q" data-step="">
    <header class="sx-q-top"><a class="sx-logo" href="./" data-do="exit" aria-label="${esc(t('SYNK PULSE 처음으로'))}"><img src="./assets/request/logo-paper.webp" alt="SYNK PULSE" width="164" height="44"></a>
      <ol class="sx-q-parts sx-small" aria-hidden="true">${[...new Set(STEPS.map(step=>step.part))].map(name=>`<li data-part="${name}">${esc(t(name))}</li>`).join('')}</ol>
      <div class="sx-q-top-right sx-small">${localeMenu()}<span class="sx-q-saved" data-saved></span><button type="button" class="sx-q-open-credits" data-do="sheet">${esc(t('적은 내용'))} <b class="sx-no" data-slate-count>0</b></button><button type="button" data-do="later">${esc(t('나중에 이어서'))}</button></div>
      <i class="sx-q-progress" aria-hidden="true"><i data-progress></i></i></header>
    <div class="sx-q-stage">
      <section class="sx-q-ask"><form class="sx-q-form" data-ask novalidate></form></section>
      <aside class="sx-q-screen" aria-label="${esc(t('미리 보기'))}"><div class="sx-q-view" data-mon></div>
        <div class="sx-q-credits" data-slate><button type="button" class="sx-small sx-q-credits-head" data-do="sheet">${esc(t('의뢰서'))}</button><div class="sx-q-lines" data-lines></div></div>
      </aside>
      ${ORDER_NOTE}
      <footer class="sx-q-foot"><button type="button" class="sx-small sx-q-back" data-do="back">${esc(t('이전'))}</button><p class="sx-small sx-q-error" role="alert" data-error hidden></p><button type="button" class="sx-go is-solid" data-do="next"><span data-next-label>${esc(t('다음',null,'step'))}</span>${arrow}</button></footer>
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
  // 안내 · 메일 언어: 허락 언어가 둘 이상일 때만 정한다. 손님이 고르기 전에는 지금 화면 언어를 따르고, 고르면 그 값을 지킨다. 하나뿐이면 손대지 않아 보내지도 않는다(지금 운영 그대로).
  let contactPicked=!!a.contactLocale;
  const defaultContactLocale=()=>{const list=offeredLocales();if(list.length<2||contactPicked&&list.includes(a.contactLocale)||a.contactLocale===locale())return false;a.contactLocale=locale();return true;};

  // 초안이 기한으로 사라졌을 때: 글은 그대로 두고, 함께 지워진 파일만 칸에서 빼고 알린다. 올리는 중인 파일은 새 초안으로 간다.
  backend.onExpired=()=>{
    let gone=0;
    for(const slot of Object.values(a.slots)){const files=slot.files||[],kept=files.filter(file=>!file.id);gone+=files.length-kept.length;slot.files=kept;}
    if(!gone)return 0;
    if(['files','review'].includes(step().id)||step().id==='model'&&a.modelChoice==='custom')render(1);else renderSlate();
    showError(t(DRAFT_FILES_GONE));
    return gone;
  };
  // 저장은 한 번에 하나씩, 도는 동안 바뀐 것은 끝난 뒤 한 번 더. 실패는 화면에 보이고 저절로 다시 한다.
  function writeNow(){
    clearTimeout(saveTimer);saveTimer=0;if(sent)return Promise.resolve(true);
    if(saving){saveAgain=true;return saving;}
    saving=(async()=>{
      const mark=$('[data-saved]');let ok=true;
      try{await backend.save?.(a,step().id);mark.classList.remove('is-error');mark.textContent=t('저장됨');mark.getAnimations?.().forEach(item=>item.cancel());play(mark,[{opacity:0},{opacity:1,offset:.2},{opacity:1,offset:.8},{opacity:0}],{duration:1600});}
      catch{ok=false;mark.getAnimations?.().forEach(item=>item.cancel());mark.classList.add('is-error');mark.textContent=t('저장하지 못했어요. 다시 시도할게요');if(!closed)saveTimer=setTimeout(writeNow,8000);}
      saving=null;
      if(saveAgain){saveAgain=false;return writeNow();}
      return ok;
    })();
    return saving;
  }
  function saved(){clearTimeout(saveTimer);saveTimer=setTimeout(writeNow,500);}

  // focus:false는 언어를 바꿔 다시 그릴 때 — 초점을 언어 메뉴에 둔다.
  function render(direction=1,{focus=true}={}){
    const s=step();
    host.dataset.step=s.id;
    $('.sx-q-screen').setAttribute('aria-label',s.id==='model'?t('모델 고르기'):t('미리 보기'));
    showError('');
    if(s.id==='contact'||s.id==='review')defaultContactLocale();
    form.innerHTML=views[s.id](a,s,index,STEPS.length,ctx);
    // 휴대폰은 질문 칸이 아니라 바깥 칸(.sx-q-stage)이 스크롤된다 — 단계를 바꾸면 그것도 처음으로(모델 단계에서 내린 채 「이전」을 누르면 제목이 위 막대 밑에 있었다).
    form.scrollTop=0;$('.sx-q-ask').scrollTop=0;$('.sx-q-stage').scrollTop=0;
    const title=form.querySelector('[data-title]');
    revealWords(title,{delay:40});
    riseAll(form.querySelectorAll('[data-in]'),{start:120,gap:34,y:14*direction});
    if(focus)title.focus({preventScroll:true});
    const parts=[...new Set(STEPS.map(item=>item.part))];
    host.querySelectorAll('[data-part]').forEach(li=>{const at=parts.indexOf(li.dataset.part),now=parts.indexOf(s.part);li.classList.toggle('is-now',at===now);li.classList.toggle('is-done',at<now);});
    const bar=$('[data-progress]'),to=(index+1)/STEPS.length;
    bar.animate?.([{transform:`scaleX(${bar.dataset.at||0})`},{transform:`scaleX(${to})`}],{duration:620,easing:ease.move,fill:'forwards'});bar.dataset.at=to;
    $('[data-do="back"]').hidden=index===0;
    renderMonitor(s.id);renderSlate();updateDateAdvice();updateNext();
    say(t('{n}번째 질문 · {title}',{n:index+1,title:form.querySelector('[data-title]').getAttribute('aria-label')}));
  }
  function go(to,direction,after){
    if(busy||to<0||to>=STEPS.length)return;busy=true;
    Promise.all([...form.children].map(el=>sink(el,{duration:150}))).then(()=>{index=to;render(direction);busy=false;saved();after?.();});
  }
  // 보내기 단추는 막지 않는다. 빠진 게 있으면 단추에 무엇인지 쓰고, 누르면 그 칸으로 데려간다.
  const missing=()=>!a.name?{step:'what',bind:'name',text:k('광고할 것의 이름을 알려 주세요')}:!(a.contactName&&(a.email||a.phone))?{step:'contact',bind:a.contactName?'email':'contactName',text:k('성함과 연락받을 곳을 알려 주세요')}:!(a.consent&&a.rights)?{step:'review',bind:a.consent?'rights':'consent',text:k('동의 칸을 확인해 주세요')}:null;
  function updateNext(){
    const gap=step().id==='review'?missing():null;
    $('[data-next-label]').textContent=step().id==='review'?(gap?t(gap.text):t('의뢰서 보내기')):t('다음',null,'step');
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
  let allModels=false;
  function renderMonitor(id){
    if(id!=='model')allModels=false;
    // 업종 그림(작품 그림 — 큰 판 없음)은 첫 단계 스크린에서도 꼴(data-shot)대로 늘리지 않고 놓는다(film.css). 업종을 바꾸면 crossfade가 꼴도 바꾼다.
    if(id==='what'){const kind=kindOf(a),src=kind?.shot||still('w-gift-sphere'),shape=shotShape(src);monSwap(`<img class="sx-q-fill" data-still src="${esc(src)}"${shape?` data-shot="${shape}"`:''} alt=""><p class="sx-small sx-q-cap" data-still-cap>${esc(kind?t(kind.who):t('「霜の肌理」 홀리데이 기프트 · 가상 브랜드로 만든 자체 작품'))}</p>`);return;}
    if(id==='where'){const pkg=pkgOf(a),from=`<small data-price-from ${pkg?'':'hidden'}>${esc(t('부터'))}</small>`,value=`<span data-price>${pkg?price(pkg.price):'—'}</span>`;monSwap(`<div class="sx-q-where"><img class="sx-q-fill" src="${still(RATIO_STILL[ratioOf(a)])}" data-ratio-still alt=""><div class="sx-q-finder" data-frame data-ratio="${ratioOf(a)}"><span class="sx-no" data-ratio-label>${ratioOf(a)}</span></div><div class="sx-q-price"><b class="sx-serif">${fromBefore()?from+value:value+from}</b><span class="sx-small" data-cuts-line ${pkg?'':'hidden'}><span data-cuts-label>${esc(pkg?.photo?t('받으실 사진'):t('영상 전에 먼저 보여 드리는 컷'))}</span> <b class="sx-no" data-cuts>${pkg?pkg.cuts:0}</b></span><span class="sx-small" data-terms ${pkg?'':'hidden'}>${esc(termsOf(pkg))}</span><div class="sx-q-ticks" data-strip aria-hidden="true"></div></div></div>`);fillStrip(pkg?.cuts||0);return;}
    if(id==='files'){const own=ownPhoto(a);monSwap(`<div class="sx-q-how"><figure><img src="${esc(own||still('file-gift-set'))}" data-cap alt=""><figcaption class="sx-small"><span class="sx-no">01</span> ${esc(own?t('보내 주신 사진'):t('이런 사진이면 돼요'))}</figcaption></figure>${[['02',k('장면 이미지 · 확인'),'sheet-gift-05'],['03',k('완성 영상'),'w-gift']].map(([no,label,name])=>`<figure><img src="${still(name)}" data-cap alt=""><figcaption class="sx-small"><span class="sx-no">${no}</span> ${esc(t(label))}</figcaption></figure>`).join('')}<p class="sx-small sx-q-how-note">${esc(t('제품 · 로고 · 글자는 AI로 그리지 않고 실제 파일을 얹어요. 영상을 만들기 전에 02에서 모든 컷을 먼저 보여 드려요. 장면 이미지는 그 컷의 첫 화면이라 움직이는 동안 작은 부분은 달라질 수 있어요.'))}</p></div>`);return;}
    if(id==='message'||id==='words'){const own=ownPhoto(a),shot=kindOf(a)?.shot,shape=own?'':shotShape(shot);/* 판 4 B7: 사진 전에는 고른 업종의 작품 그림 위에 손님 말을 얹는다(음료 손님의 말이 눈 결정 · 화장품 병 위에 얹히던 것). 작품 그림은 광고 틀의 비율이 달라도 자르지 않고 틀 안에 맞춘다(data-shot — 가로 작품은 세로 틀의 위아래가, 세로 작품은 가로 틀의 양옆이 검정). */monSwap(`${frame({channels:a.channels.length?a.channels:['shorts']},`<img class="sx-q-fill" src="${esc(own||shot||still(id==='words'?'w-gift':'w-gift-snow'))}"${shape?` data-shot="${shape}"`:' data-cap'} alt=""><div class="sx-q-copy${id==='words'?' is-top':''}" data-copy></div>${id==='words'?'<p class="sx-q-notice sx-small" data-notice-line hidden></p>':''}`)}<p class="sx-small sx-q-cap">${esc(id==='words'?t('적으신 글자는 이 자리에 그대로 얹어요'):t('1차안에서 이 말을 한 문장으로 다듬어요'))}</p>`);updateCopy();updateNoticeLine();return;}
    if(id==='feel'){const pick=WIN.find(item=>item.id===a.win)||WIN[1];monSwap(`${frame({channels:[pick.ratio==='16:9'?'youtube':'shorts']},`<video class="sx-q-fill" data-win-film src="${esc(pick.film)}" poster="${esc(pick.poster)}" muted loop playsinline preload="metadata" ${reduced()?'':'autoplay'}></video>`)}${holdButton('win',reduced())}<p class="sx-small sx-q-cap"><span data-win-kind>${esc(t(pick.kind))}</span> · <span data-win-cap>${esc(winCap(pick))}</span></p>`);const film=$('[data-win-film]');if(film&&!reduced())film.play().catch(()=>{}).finally(()=>syncHold(film));return;}
    if(id==='model'){monSwap(allModels?allWall(a):wall(a));if(!allModels&&!choiceText(a))leadFilm(modelOf(a.models[0])||picksOf(a)[0]);return;}
    if(id==='contact'||id==='review'){monSwap(`${frame({channels:['shorts']},`<img class="sx-q-fill" src="${still(id==='contact'?'still-shards':'still-lid')}" alt="">`)}<p class="sx-small sx-q-cap">${esc(t('1차안의 장면 이미지는 이런 모습이에요. 장면 이미지는 그 컷의 첫 화면이라 움직이는 동안 작은 부분은 달라질 수 있어요'))}</p>`);return;}
    monSwap('');
  }
  function fillStrip(count){const strip=$('[data-strip]');if(!strip)return;strip.innerHTML=Array.from({length:count},(_,i)=>`<i data-c="${i}"></i>`).join('');[...strip.children].forEach((tick,i)=>play(tick,[{opacity:0},{opacity:1}],{delay:i*18,duration:300}));}
  function updateCopy(){const box=$('[data-copy]');if(!box)return;const text=step().id==='words'?(a.screenText||a.name||''):(a.oneThing||a.name||'');box.textContent='';text.split('\n').slice(0,3).forEach((line,i)=>{const p=document.createElement('p');p.textContent=line;box.append(p);});}
  // 의뢰서 탭(11-13): 글자 화면 광고 틀 아래쪽의 고지 문구 자리 · 모델 화면의 목소리 칩 다시 그리기(「사람 없이」면 「모델이 직접」이 빠진다).
  function updateNoticeLine(){const line=$('[data-notice-line]');if(!line)return;const on=noticeOn(a);line.hidden=!on;line.textContent=on?(a.noticeText||t('고지 문구가 들어갈 자리')):'';}
  function redrawVoice(){const old=form.querySelector('[data-voice-block]');if(!old)return;const box=document.createElement('div');box.innerHTML=voiceBlock(a);old.replaceWith(box.firstElementChild);}
  function updateDateAdvice(){
    const note=$('[data-date-advice]');if(!note)return;
    if(!a.date||a.dateFree){note.hidden=true;return;}
    const today=new Date(Date.now()+9*3600000).toISOString().slice(0,10),days=Math.round((Date.parse(a.date)-Date.parse(today))/86400000);
    note.hidden=days>=(pkgOf(a)?.days||10);note.textContent=days<0?t('지난 날짜예요. 다시 골라 주세요.'):t('이 날짜는 빠듯해요. 맞출 수 있는지 먼저 말씀드릴게요.');
  }
  function renderSlate(){
    const rows=slateRows(a);
    $('[data-slate-count]').textContent=rows.length;
    const known=new Map([...lines.querySelectorAll('[data-k]')].map(el=>[el.dataset.k,el]));
    rows.forEach(([key,value],i)=>{
      let el=known.get(key);
      if(!el){el=document.createElement('div');el.className='sx-q-line sx-small';el.dataset.k=key;el.innerHTML=`<span class="k">${esc(t(key))}</span><span class="v"></span>`;lines.append(el);el.querySelector('.v').textContent=value;typeIn(el.querySelector('.v'),value);play(el,[{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],{duration:320});}
      else{const label=el.querySelector('.k'),name=t(key);if(label.textContent!==name)label.textContent=name;if(el.querySelector('.v').dataset.v!==value){typeIn(el.querySelector('.v'),value);}}
      el.querySelector('.v').dataset.v=value;known.delete(key);
    });
    known.forEach(el=>el.remove());
    const box=lines;box.scrollTop=box.scrollHeight;
  }
  function toggleIn(list,value,max=99){const at=list.indexOf(value);if(at>=0)list.splice(at,1);else{if(list.length>=max)list.shift();list.push(value);}}
  function setRows(group,id){form.querySelectorAll(`[data-do="${group}"]`).forEach(el=>{const on=el.dataset.id===id;el.classList.toggle('is-on',on);el.setAttribute('aria-checked',on?'true':'false');if(on)play(el.querySelector('.sx-row-mark'),[{transform:'scale(0)'},{transform:'scale(1)'}],{duration:320});});}
  function setChip(el,on){el.classList.toggle('is-on',on);el.setAttribute('aria-pressed',on?'true':'false');play(el,[{transform:'scale(.96)'},{transform:'scale(1)'}],{duration:220});}
  // 그림 바꾸기(사람 · 업종 그림): 새 그림을 다 받은 뒤 srcset · 꼴(data-shot) · src를 한 번에 바꾼다 — 브라우저는 새 그림이 올 때까지 옛 그림을 그리므로,
  // 먼저 바꾸면 옛 사람 사진이 작품 그림의 꼴(검정 여백)로 줄어 보인다. 받는 사이 다른 그림을 고르면 앞 바꾸기는 버리고, 지금 그림으로 되돌아오면 흐림만 걷는다.
  function crossfade(img,src,set=''){if(!img)return;const pending=swaps.get(img);if(img.getAttribute('src')===src){if(pending){swaps.delete(img);play(img,[{opacity:.25},{opacity:1}],{duration:300});}return;}if(pending?.src===src)return;const token={src};swaps.set(img,token);const next=new Image();if(set){next.sizes=SCENE_SIZES;next.srcset=set;}next.src=src;Promise.all([play(img,[{opacity:1},{opacity:.25}],{duration:120}).finished,next.decode?next.decode().catch(()=>{}):null]).then(()=>{if(swaps.get(img)!==token)return;swaps.delete(img);if(set){img.sizes=SCENE_SIZES;img.srcset=set;}else dropSrcset(img);const shape=set?'':shotShape(src);if(shape)img.dataset.shot=shape;else delete img.dataset.shot;img.toggleAttribute('data-cap',!set&&!shape);img.src=src;play(img,[{opacity:.25,transform:'scale(1.035)'},{opacity:1,transform:'scale(1)'}],{duration:620});});}

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
    async later(){if(await writeNow()){backend.later?.(a,step().id);toast(t('저장했어요. 이 기기에서 다시 열면 여기부터 이어서 쓸 수 있어요.'));}else toast(t('지금은 저장하지 못했어요. 인터넷 연결을 확인해 주세요.'));},
    sheet(){setSheet(!host.classList.contains('sheet-open'));},
    kind(el){a.kind=el.dataset.id;setRows('kind',a.kind);crossfade($('[data-still]'),kindOf(a).shot);const cap=$('[data-still-cap]');if(cap)cap.textContent=t(kindOf(a).who);renderSlate();saved();},
    channel(el){toggleIn(a.channels,el.dataset.id);setChip(el,a.channels.includes(el.dataset.id));const f=$('[data-frame]'),ratio=ratioOf(a);if(f&&f.dataset.ratio!==ratio){f.dataset.ratio=ratio;const label=$('[data-ratio-label]');if(label)label.textContent=ratio;crossfade($('[data-ratio-still]'),still(RATIO_STILL[ratio]));}renderSlate();saved();},
    package(el){a.package=el.dataset.id;setRows('package',a.package);const pkg=pkgOf(a),p=$('[data-price]');if(p){if(pkg)roll(p,pkg.price,{format:price});else{delete p.dataset.value;p.textContent=t('상담');}$('[data-price-from]').hidden=!pkg;}const cuts=$('[data-cuts]');if(cuts){roll(cuts,pkg?.cuts||0);fillStrip(pkg?.cuts||0);const label=$('[data-cuts-label]');if(label)label.textContent=pkg?.photo?t('받으실 사진'):t('영상 전에 먼저 보여 드리는 컷');const line=$('[data-cuts-line]');if(line)line.hidden=!pkg;const terms=$('[data-terms]');if(terms){terms.hidden=!pkg;terms.textContent=termsOf(pkg);}}renderSlate();saved();},
    action(el){a.action=a.action===el.dataset.id?'':el.dataset.id;form.querySelectorAll('[data-do="action"]').forEach(item=>setChip(item,item.dataset.id===a.action));renderSlate();saved();},
    avoid(el){toggleIn(a.avoid,el.dataset.id);setChip(el,a.avoid.includes(el.dataset.id));saved();},
    // 계속 도는 영상(모델의 4초 · 예시 작품)의 멈춤 · 재생. 큰 칸에서 멈춰 두면 사람을 바꿔도 첫 장면에 선다. 글은 play · pause 사건이 맞춘다.
    filmhold(el){const lead=el.dataset.hold==='lead',film=$(lead?'[data-portrait-film]':'[data-win-film]');if(!film)return;if(lead)filmHeld=!film.paused;if(film.paused)film.play().catch(()=>{});else film.pause();},
    win(el){a.win=el.dataset.id;setRows('win',a.win);const pick=WIN.find(item=>item.id===a.win);if(pick){const film=$('[data-win-film]');if(film&&film.getAttribute('src')!==pick.film){film.poster=pick.poster;film.src=pick.film;film.closest('[data-frame]').dataset.ratio=pick.ratio;if(!reduced())film.play().catch(()=>{}).finally(()=>syncHold(film));else syncHold(film);play(film,[{opacity:.3},{opacity:1}],{duration:320});}$('[data-win-cap]').textContent=winCap(pick);$('[data-win-kind]').textContent=t(pick.kind);}renderSlate();saved();},
    bold(el){a.bold=a.bold===el.dataset.id?'':el.dataset.id;form.querySelectorAll('[data-do="bold"]').forEach(item=>setChip(item,item.dataset.id===a.bold));const note=$('[data-bold-note]');if(note){note.textContent=boldNote(a);note.hidden=!boldNote(a);}renderSlate();saved();},
    notice(el){a.notice=a.notice===el.dataset.id?'':el.dataset.id;form.querySelectorAll('[data-do="notice"]').forEach(item=>setChip(item,item.dataset.id===a.notice));const more=$('[data-notice-more]');if(more){more.innerHTML=noticeMore(a);if(more.firstElementChild)rise(more,{y:6});}updateNoticeLine();saved();},
    voice(el){a.voice=a.voice===el.dataset.id?'':el.dataset.id;form.querySelectorAll('[data-do="voice"]').forEach(item=>setChip(item,item.dataset.id===a.voice));const note=$('[data-voice-note]');if(note){note.textContent=voiceNote(a);note.hidden=!voiceNote(a);}renderSlate();saved();},
    refpoint(el){const ref=a.refs[0];toggleIn(ref.points,el.dataset.id);setChip(el,ref.points.includes(el.dataset.id));saved();},
    allmodels(){allModels=!allModels;renderMonitor('model');$('.sx-cast')?.focus({preventScroll:true});},
    model(el){toggleIn(a.models,el.dataset.id,2);a.modelChoice='';dropPick();swapDetail();redrawVoice();host.querySelectorAll('[data-do="model"]').forEach(item=>{const on=a.models.includes(item.dataset.id);item.classList.toggle('is-on',on);item.setAttribute('aria-pressed',on?'true':'false');const mark=item.querySelector('.sx-cast-mark');if(mark)mark.textContent=on?String(a.models.indexOf(item.dataset.id)+1):'';});form.querySelectorAll('[data-do="modelchoice"]').forEach(item=>setChip(item,false));showModel(el.dataset.id);renderSlate();saved();},
    // 붙인 「내 모델」 칩은 다시 눌러도 꺼지지 않는다 — 끄면 붙임이 풀려 의뢰서 안에서는 되돌릴 길이 없다(판 4 화면 최종 검수 F1). 다른 칩 · 모델을 고를 때만 푼다.
    modelchoice(el){if(el.dataset.id==='persona'&&a.modelChoice==='persona')return;a.modelChoice=a.modelChoice===el.dataset.id?'':el.dataset.id;a.models=[];if(a.modelChoice!=='persona')dropPick();if(a.modelChoice==='none'&&a.voice==='model')a.voice='';host.querySelectorAll('[data-do="model"]').forEach(item=>{item.classList.remove('is-on');item.setAttribute('aria-pressed','false');item.querySelector('.sx-cast-mark').textContent='';});form.querySelectorAll('[data-do="modelchoice"]').forEach(item=>setChip(item,item.dataset.id===a.modelChoice));swapDetail();redrawVoice();showChoice();renderSlate();saved();},
    // 맞춤 인물 요청 칸(판 3). 종류를 바꾸면 묻는 칸이 달라져 그 칸만 다시 그리고 누른 단추에 초점을 둔다.
    personakind(el){a.personaRequest.kind=el.dataset.id;redrawPersona(`[data-do="personakind"][data-id="${el.dataset.id}"]`);showChoice();saved();},
    personarelation(el){pickPersona('relation','personarelation',el);},
    personaconsent(el){pickPersona('consentWay','personaconsent',el);},
    personakeep(el){pickPersona('keep','personakeep',el);},
    datefree(el){a.dateFree=!a.dateFree;if(a.dateFree){a.date='';const input=form.querySelector('[data-bind="date"]');if(input)input.value='';}setChip(el,a.dateFree);updateDateAdvice();renderSlate();saved();},
    approver(el){a.approver=el.dataset.id;form.querySelectorAll('[data-do="approver"]').forEach(item=>setChip(item,item.dataset.id===a.approver));const sub=el.closest('.sx-sub');const more=sub.querySelector('[data-approver-more]');more.innerHTML=approverMore(a);if(more.firstElementChild)rise(more,{y:6});saved();},
    contactlocale(el){a.contactLocale=el.dataset.id;contactPicked=true;form.querySelectorAll('[data-do="contactlocale"]').forEach(item=>setChip(item,item.dataset.id===a.contactLocale));saved();},
    none(el){const id=el.dataset.id,slot=a.slots[id]||(a.slots[id]={files:[]});slot.none=!slot.none;setChip(el,slot.none);el.closest('.sx-slot').classList.toggle('is-none',slot.none);updateSlotStatus(id);saved();},
    async retryfile(el){
      const id=el.dataset.slotId,state=a.slots[id],file=state?.files?.[Number(el.dataset.at)],slot=slotOf(id),held=file&&retryable.get(file);if(!held||!slot||file.uploading)return;
      delete file.error;file.uploading=true;file.progress=0;redrawSlot(slot);updateSlotStatus(id);
      await uploadEntry(id,file,held);
      if(!state.files.includes(file))return;
      updateSlotStatus(id);redrawSlot(slot);renderSlate();saved();if(step().id==='files')renderMonitor('files');if(slot.persona)showChoice();
      // 초점은 잃었을 때만(누른 단추가 다시 그려져 사라진 경우 — body) 되돌린다. 손님이 둔 자리는 redrawSlot이 지킨다(최종 검수 F1 · Q1).
      // 올리기에 성공했으면 상태 줄로 — 지우는 단추로 저절로 옮기지 않는다(반응이 없어 다시 누른 Enter · Space가 「지우기」가 되어 방금 올린 파일이 지워지던 키보드 길). 실패해 다시 올리기가 남았을 때만 그 단추로.
      // 코드가 둔 자리(body, 또는 누른 단추가 사라질 때 redrawSlot이 옮긴 그 칸의 상태 줄)에 그대로 있으면 잃은 것으로 본다 — 또 실패했을 때 「다시 올리기」로 돌아오게(최종 검수 -d P2).
      const box=host.querySelector(`[data-slot="${slot.id}"]`),now=document.activeElement,lost=!now||now===document.body||!!box&&box.contains(now)&&now.dataset?.status===slot.id;
      if(lost&&box){if(retryable.has(file))box.querySelector(`[data-do="retryfile"][data-key="${fileKey(file)}"]`)?.focus({preventScroll:true});else{const status=box.querySelector(`[data-status="${slot.id}"]`);if(status){status.setAttribute('tabindex','-1');status.focus({preventScroll:true});}}}
    },
    async removefile(el){
      const id=el.dataset.slotId,state=a.slots[id],file=state?.files?.[Number(el.dataset.at)],slot=slotOf(id);if(!file||!slot)return;
      el.disabled=true;
      try{if(file.id&&!file.error)await backend.remove?.(file.id);}
      catch(error){el.disabled=false;showError(error.message||t('지우지 못했어요. 다시 시도해 주세요.'));return;}
      const at=state.files.indexOf(file);if(at>=0)state.files.splice(at,1);if(file.preview?.startsWith('blob:')){URL.revokeObjectURL(file.preview);blobs.delete(file.preview);}
      redrawSlot(slot);renderSlate();saved();if(step().id==='files')renderMonitor('files');if(slot.persona)showChoice();
    },
  };
  // 칸 찾기: 업종 준비물 칸, 또는 맞춤 인물 사진 칸(판 3).
  const slotOf=id=>slotsFor(a.kind).find(item=>item.id===id)||PERSONA_SLOTS.find(item=>item.id===id);
  // 내 모델 인물을 풀면(다른 모델 · 다른 길을 고르면) 그 칩을 뺀다 — 저장하면 서버가 붙임을 지우므로 이 화면에서 다시 고를 수 없다. 다시 쓰려면 내 모델에서 다시 고른다(설계 5-4).
  function dropPick(){if(!a.personaPick&&!form.querySelector('[data-do="modelchoice"][data-id="persona"]'))return;a.personaPick=null;form.querySelector('[data-do="modelchoice"][data-id="persona"]')?.remove();}
  // 모델 칸 아래 설명 ↔ 맞춤 인물 요청 칸을 그 자리에서 바꾼다(단계를 다시 그리지 않아 읽던 자리 · 초점이 그대로다). 같은 종류면 그대로 둔다.
  function swapDetail(){
    const old=form.querySelector('.sx-q-who,.sx-q-persona');if(!old)return;
    if((a.modelChoice==='custom'&&ctx.flags.request)===old.classList.contains('sx-q-persona'))return;
    const box=document.createElement('div');box.innerHTML=modelDetail(a,ctx);const next=box.firstElementChild;old.replaceWith(next);rise(next,{y:6});
  }
  function redrawPersona(focus=''){
    const old=form.querySelector('.sx-q-persona');if(!old)return;
    const box=document.createElement('div');box.innerHTML=modelDetail(a,ctx);const next=box.firstElementChild;old.replaceWith(next);
    if(focus)next.querySelector(focus)?.focus({preventScroll:true});
  }
  function pickPersona(key,group,el){const p=a.personaRequest;p[key]=p[key]===el.dataset.id?'':el.dataset.id;form.querySelectorAll(`[data-do="${group}"]`).forEach(item=>setChip(item,item.dataset.id===p[key]));saved();}
  // 판 4 B6: 「추천해 주세요」 · 「사람 없이」를 고르면 하린 같은 한 사람의 이름 · 큰 사진을 남기지 않는다. 고른 것을 풀면 첫 후보로 돌아간다.
  function showChoice(){const text=choiceText(a);if(!text){const first=a.models[0]||picksOf(a)[0]?.id;if(first)showModel(first);return;}leadFilm(null);const name=$('[data-cast-name]');if(name){name.textContent=text.name;$('[data-cast-line]').textContent=text.line;$('[data-cast-desc]').textContent='';}const lead=$('[data-portrait-name]');if(lead)lead.textContent=text.caption;crossfade($('[data-portrait]'),choiceShot(a),sceneSet(choiceShot(a)));}
  function showModel(id){const item=modelOf(id);if(!item)return;crossfade($('[data-portrait]'),bigScene(item),sceneSet(bigScene(item)));leadFilm(item);const lead=$('[data-portrait-name]');if(lead)lead.textContent=`${nameOf(item)} · ${castLine(item)}`;const name=$('[data-cast-name]');if(name){name.textContent=nameOf(item);$('[data-cast-line]').textContent=MODEL_LINES[id]?.line?t(MODEL_LINES[id].line):'';$('[data-cast-desc]').textContent=t(item.description);}}
  // 큰 칸의 4초. 첫 장면 포스터를 받은 뒤에 영상 칸이 사진(장면)을 덮는다(has-film) — 그 전에 덮으면 검정 칸이 먼저 보인다.
  // 못 받으면(error) 사진으로 돌아가고, 자동 재생이 막히거나 손님이 멈춰 두었으면(filmHeld) 첫 장면에 선다.
  // 사람을 바꿀 때는 지금 영상을 먼저 걷고(0.32초) 새 것을 건다. 넷을 빠르게 훑으면 마지막 사람 것만 받는다.
  let filmTimer=0,filmHeld=false;
  function leadFilm(item){
    const film=$('[data-portrait-film]');if(!film)return;
    const next=stillOnly()?null:modelFilm(item),src=next?.src||'',box=film.parentElement;
    if(src&&film.dataset.src===src)return;
    clearTimeout(filmTimer);box.classList.remove('has-film');film.dataset.src=src;
    filmTimer=setTimeout(()=>{
      if(!film.isConnected||film.dataset.src!==src)return;
      film.pause();
      if(!next){if(film.hasAttribute('src')){film.removeAttribute('src');film.removeAttribute('poster');film.load();}return;}
      const show=()=>{if(film.isConnected&&film.dataset.src===src&&!film.error)box.classList.add('has-film');};
      const still=new Image();still.src=next.poster;(still.decode?still.decode():Promise.reject()).then(show,()=>{if(film.readyState>=2)show();else film.addEventListener('loadeddata',show,{once:true});});
      film.preload=filmHeld?'auto':'none';film.poster=next.poster;film.src=src;if(!filmHeld)film.play().catch(()=>{}).finally(()=>syncHold(film));else syncHold(film);
    },film.hasAttribute('src')?320:0);
  }
  // 21명 벽: 마우스를 올린 칸만 그 사람의 4초를 돌린다(올려 둔 동안만 받는다). 터치 화면 · 움직임 줄이기 · 데이터 절약은 사진 그대로.
  let tileTimer=0;
  function stopTile(film){film.pause();film.removeAttribute('src');film.load();film.remove();}
  function startTile(tile){
    const next=tile.isConnected&&!tile.querySelector('video')&&!stillOnly()&&canHover()?modelFilm(modelOf(tile.dataset.id)):null;if(!next)return;
    mon.querySelectorAll('.sx-wall video').forEach(stopTile);
    const film=document.createElement('video');film.defaultMuted=film.muted=true;film.loop=film.playsInline=true;film.preload='auto';film.poster=next.poster;film.dataset.film='';film.setAttribute('aria-hidden','true');film.src=next.src;
    const name=tile.querySelector('.sx-cast-name');if(name)name.before(film);else tile.append(film);
    film.play().catch(()=>{});
  }
  function updateSlotStatus(id){const box=form.querySelector(`[data-status="${id}"]`),slot=slotOf(id);if(box&&slot)box.innerHTML=slotStatus(a,slot);}
  async function addFiles(id,list){
    const slot=slotOf(id);if(!slot)return;const state=a.slots[id]||(a.slots[id]={files:[]});state.none=false;
    for(const file of list){
      const entry={fileName:file.name,byteSize:file.size,mimeType:file.type,uploading:true,progress:0};
      if(file.type.startsWith('image/')&&file.type!=='image/heic'&&file.type!=='image/heif'){try{const url=URL.createObjectURL(file),image=await loadImage(url);blobs.add(url);entry.preview=url;entry.width=image.naturalWidth;entry.height=image.naturalHeight;if(!slot.persona)entry.advice=photoAdvice(entry.width,entry.height,slot.kind);}catch{}}
      state.files.push(entry);redrawSlot(slot);
      await uploadEntry(id,entry,file);
      updateSlotStatus(id);redrawSlot(slot);renderSlate();saved();
    }
    if(step().id==='files')renderMonitor('files');
    if(slot.persona)showChoice();
  }
  async function uploadEntry(id,entry,file){
    retryable.delete(entry);
    try{const {preview,...stored}=await backend.upload(id,file,progress=>{entry.progress=progress;updateSlotStatus(id);});Object.assign(entry,stored,{uploading:false});if(preview&&!entry.preview)entry.preview=preview;}
    catch(error){entry.uploading=false;entry.error=error.message||t('올리지 못했어요. 다시 시도해 주세요.');if(canRetry(error))retryable.set(entry,file);}
  }
  function redrawSlot(slot){
    const old=form.querySelector(`[data-slot="${slot.id}"]`);if(!old)return;
    // 그 칸 안에서 손님 초점이 있던 자리(글 칸 data-bind · 파일 고르기 data-file · 칩 · 줄 단추 data-do)는 새 칸의 같은 자리로 옮긴다 — 글 칸은 커서까지(최종 검수 F1 · Q1, 다시 그리기가 손님 초점을 없애지 않게).
    const active=old.contains(document.activeElement)?document.activeElement:null,ds=active?.dataset||{},caret=ds.bind&&typeof active.selectionStart==='number'?[active.selectionStart,active.selectionEnd]:null;
    // 줄 단추는 줄 번호가 아니라 그 파일의 표(data-key)로 찾는다 — 그 파일이 없어졌으면(지움) 지우는 단추가 아니라 상태 줄로 둔다. 상태 줄에 있던 초점도 새 상태 줄로(최종 검수 -c P1 · P3).
    const spot=ds.bind?`[data-bind="${ds.bind}"]`:ds.file?`[data-file="${ds.file}"]`:ds.key?`[data-do="${ds.do}"][data-key="${ds.key}"]`:ds.status!==undefined?`[data-status="${ds.status}"]`:ds.do?`[data-do="${ds.do}"]${ds.id?`[data-id="${ds.id}"]`:''}`:'';
    const box=document.createElement('div');box.innerHTML=slotView(a,slot);const next=box.firstElementChild;old.replaceWith(next);
    if(active){const again=spot?next.querySelector(spot):null,target=again||next.querySelector(`[data-status="${slot.id}"]`);if(target){if(target.dataset.status!==undefined)target.setAttribute('tabindex','-1');target.focus({preventScroll:true});if(again&&caret)try{again.setSelectionRange(caret[0],caret[1]);}catch{}}}
    const last=next.querySelector('.sx-slot-frame img:last-of-type');if(last)play(last,[{opacity:0,transform:'scale(1.06)'},{opacity:1,transform:'scale(1)'}],{duration:560});
  }
  const loadImage=url=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=url;});
  async function submit(){
    const button=$('[data-do="next"]');button.disabled=true;$('[data-next-label]').textContent=t('보내는 중');showError('');clearTimeout(saveTimer);saveTimer=0;
    defaultContactLocale();
    try{const receipt=await backend.submit(a);sent=receipt;showReceipt(receipt);}
    catch(error){$('[data-next-label]').textContent=t('다시 보내기');button.disabled=false;showError(error.message||t('보내지 못했어요. 다시 시도해 주세요.'));}
  }
  // 접수증(언어를 바꾸면 같은 틀로 다시 그린다 — 접수 시각은 처음 연 때 값).
  let sentAt=null;
  function receiptHtml(receipt){
    const pkg=pkgOf(a),when=sentAt||new Date(receipt.at||Date.now());
    const stamp=locale()==='ko'?`${when.getFullYear()}.${String(when.getMonth()+1).padStart(2,'0')}.${String(when.getDate()).padStart(2,'0')} ${String(when.getHours()).padStart(2,'0')}:${String(when.getMinutes()).padStart(2,'0')}`:Number.isFinite(when.getTime())?new Intl.DateTimeFormat(intlLocale(locale()),{year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(when):'';
    // 맞춤 인물이면 「모델」 다음에 보낸 인물 사진 장수(판 3 화면 검수 F2 — 확인 단계 요약과 같은 줄).
    const personaCount=a.modelChoice==='custom'?PERSONA_SLOTS.reduce((sum,slot)=>sum+filesOf(a,slot.id).length,0):0;
    const rows=[[k('광고할 것'),a.name],[k('길이'),pkg?t('{label} · {price}부터',{label:t(pkg.label),price:price(pkg.price)}):t('추천해 주세요')],[k('받으실 날'),pkg?.days?t('자료가 다 모인 날부터 {days}일',{days:pkg.days}):pkg?t('구성에 맞춰 함께 정해요'):''],[k('수정'),pkg&&!pkg.days?t('구성에 맞춰 함께 정해요'):revisionNote(pkg)],[k('올릴 곳'),channelText(a)||t('제안해 주세요')],[k('모델'),a.modelChoice==='none'?t('사람 없이 제품만'):a.modelChoice==='custom'?t('맞춤 인물 요청 · {kind}',{kind:personaKindLabel(a)}):a.modelChoice==='persona'?pickedLabel(a):modelList(a)||t('추천해 주세요')],[k('인물 사진'),personaCount?t('{count}장',{count:personaCount}):''],[k('받은 자료'),t('{count}개',{count:slotCount(a)})],[k('연락받을 곳'),a.email||a.phone||'']].filter(([,value])=>value);
    // 다음에 일어날 일: 사진 상품은 첫 장 → 나머지, 영상은 방향 두 안 → 제작.
    // 맞춤 인물(판 3)은 확인 다음에 인물 검토 한 걸음 — 견적 전에는 비용이 생기지 않고, 기준 얼굴 · 동작 시안을 확인받은 인물만 광고에 쓴다.
    const next=[[k('저희가 내용을 확인해요'),k('평일 10~19시에 보고, 빠진 게 있으면 그 칸만 다시 여쭤요.')],...(a.modelChoice==='custom'?[[k('맞춤 인물을 검토해요'),k('보내 주신 글과 사진으로 만들 수 있는지 보고 견적을 보내 드려요. 기준 얼굴과 동작 시안을 확인하신 인물만 광고에 써요.')]]:a.modelChoice==='persona'?[[k('내 모델 연결을 확인해요'),k('브랜드와 고르신 모델을 확인하고, 이번 광고에 쓸 범위를 정리해 보내 드려요. 그 범위를 확인하신 뒤에 만들어요.')]]:[]),...(pkg?.photo?[[k('첫 장을 먼저 보내 드려요'),a.modelChoice==='none'?k('제품만 담은 첫 장으로 방향을 맞춰요. 의견을 주시면 그 결로 나머지를 만들어요.'):k('모델이 제품을 든 첫 장으로 방향을 맞춰요. 의견을 주시면 그 결로 나머지를 만들어요.')],[k('나머지 사진을 보내 드려요'),k('사진이 나온 뒤에도 정해진 횟수만큼 고칠 수 있어요.')]]:[[k('방향 두 안을 보내 드려요'),k('무엇으로 기억에 남길지 두 방향과 모델, 값 · 받으실 날 · 수정 횟수예요. 고르시면 한 문장과 글 콘티, 컷마다 장면 이미지를 차례로 보내 드려요. 장면 이미지는 그 컷의 첫 화면이라 움직이는 동안 작은 부분은 달라질 수 있어요.')],[k('의견을 반영한 뒤 제작해요'),k('확인하시기 전에는 영상을 만들지 않아요.')]])];
    return `<div class="sx-rc-wrap"><article class="sx-rc-paper" tabindex="-1" aria-label="${esc(t('의뢰 접수증'))}"><header><img src="./assets/request/logo-paper.webp" alt="SYNK PULSE" width="120" height="32"><h2 class="sx-serif">${esc(t('의뢰 접수증'))}</h2></header><dl class="sx-rc-rows"><div><dt>${esc(t('접수 번호'))}</dt><dd class="sx-no">${esc(receipt.number)}</dd></div><div><dt>${esc(t('접수 시각'))}</dt><dd class="sx-no">${esc(stamp)}</dd></div>${rows.map(([key,value])=>`<div><dt>${esc(t(key))}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl><ol class="sx-rc-next">${next.map(([title,text])=>`<li><b>${esc(t(title))}</b><span>${esc(t(text))}</span></li>`).join('')}</ol></article></div><div class="sx-rc-actions"><button type="button" class="sx-go is-solid" data-rc="room"><span>${esc(t('내 의뢰 보기'))}</span>${arrow}</button>${receipt.link?`<button type="button" class="sx-small sx-link" data-rc="copy">${esc(t('이 의뢰로 돌아올 링크 복사'))}</button><p class="sx-small" data-rc-note>${esc(t('이 링크로 30일 안에 어느 기기에서든 돌아올 수 있어요. 메일을 적으셨다면 첫 화면 「메일로 다시 열기」로도 여실 수 있어요.'))}</p>`:''}</div>`;
  }
  function showReceipt(receipt){
    sentAt=new Date(receipt.at||Date.now());
    host.classList.add('is-sent');$('[data-next-label]').textContent=t('보냈어요');
    host.querySelectorAll('.sx-q-top,.sx-q-stage,[data-live]').forEach(node=>{node.inert=true;});
    const overlay=document.createElement('div');overlay.className='sx-rc';
    overlay.innerHTML=receiptHtml(receipt);
    host.append(overlay);
    play(overlay,[{opacity:0},{opacity:1}],{duration:360});
    const paper=overlay.querySelector('.sx-rc-paper');
    play(paper,[{transform:'translateY(-101%)'},{transform:'translateY(0)'}],{duration:1100,delay:320,easing:ease.move}).finished.then(()=>{paper.focus({preventScroll:true});overlay.classList.add('is-done');});
    overlay.addEventListener('click',async event=>{const what=event.target.closest('[data-rc]')?.dataset.rc;if(what==='room')onRoom?.(receipt,a);if(what==='copy'){try{await navigator.clipboard.writeText(receipt.link||location.href);overlay.querySelector('[data-rc-note]').textContent=t('링크를 복사했어요. 메모나 메신저에 넣어 두세요.');}catch{overlay.querySelector('[data-rc-note]').textContent=receipt.link||'';}}});
  }
  // 머리 · 발의 고정 글: 처음에는 위 틀이 그리고, 언어를 바꾸면 이 함수가 그 자리에서 고쳐 쓴다(저장 표시 · 진행 막대 같은 상태는 그대로).
  function paintChrome(){
    $('.sx-logo')?.setAttribute('aria-label',t('SYNK PULSE 처음으로'));
    host.querySelectorAll('[data-part]').forEach(li=>{li.textContent=t(li.dataset.part);});
    const open=$('.sx-q-open-credits');if(open?.firstChild)open.firstChild.nodeValue=t('적은 내용')+' ';
    $('[data-do="later"]').textContent=t('나중에 이어서');
    $('.sx-q-credits-head').textContent=t('의뢰서');
    $('[data-do="back"]').textContent=t('이전');
    const mark=$('[data-saved]');if(mark?.textContent)mark.textContent=mark.classList.contains('is-error')?t('저장하지 못했어요. 다시 시도할게요'):t('저장됨');
    const menu=$('.locale-menu');if(menu)menu.outerHTML=localeMenu();
  }
  // 언어를 바꾸면(언어 메뉴 → LOCALE_EVENT) 지금 단계를 그 자리에서 다시 그린다. 답 · 단계 · 고른 모델 · 사진은 그대로이고, 메뉴에서 골랐으면 초점을 고른 언어 단추에 둔다.
  // 메뉴 클릭은 앱이 문서 전체에서 받는다(data-set-locale) — 이 화면은 그 클릭을 막지 않는다.
  const onLocale=()=>{
    if(closed)return;
    const fromMenu=!!document.activeElement?.closest?.('.locale-menu');
    paintChrome();
    if(sent){$('[data-next-label]').textContent=t('보냈어요');const overlay=host.querySelector('.sx-rc');if(overlay){overlay.innerHTML=receiptHtml(sent);overlay.classList.add('is-done');}return;}
    if(defaultContactLocale())saved();
    if(!busy)render(0,{focus:!fromMenu});
    if(fromMenu)host.querySelector(`.locale-menu [data-set-locale="${locale()}"]`)?.focus({preventScroll:true});
  };
  addEventListener(LOCALE_EVENT,onLocale);
  host.addEventListener('click',event=>{
    const el=event.target.closest('[data-do]');if(!el)return;
    const what=el.dataset.do;if(actions[what]){if(what==='exit')return actions.exit(event);actions[what](el);}
  });
  host.addEventListener('input',event=>{
    const el=event.target;const bind=el.dataset?.bind;if(!bind)return;
    if(bind==='refUrl')a.refs[0].url=el.value;
    else if(bind.startsWith('persona.'))a.personaRequest[bind.slice(8)]=el.value;
    else if(el.type==='checkbox')a[bind]=el.checked;
    else a[bind]=el.value;
    if(bind==='date'){a.dateFree=false;const free=form.querySelector('[data-do="datefree"]');free?.classList.remove('is-on');free?.setAttribute('aria-pressed','false');updateDateAdvice();}
    if(bind==='screenText'||bind==='oneThing'||bind==='name')updateCopy();
    if(bind==='noticeText')updateNoticeLine();
    if(step().id==='review')updateNext();
    if(!['consent','rights'].includes(bind))renderSlateSoon();
    saved();
  });
  let slateTimer=0;const renderSlateSoon=()=>{clearTimeout(slateTimer);slateTimer=setTimeout(renderSlate,260);};
  host.addEventListener('change',event=>{const id=event.target.dataset?.file;if(id&&event.target.files?.length){addFiles(id,[...event.target.files]);event.target.value='';}});
  host.addEventListener('dragover',event=>{const slot=event.target.closest?.('.sx-slot');if(slot){event.preventDefault();slot.classList.add('is-over');}});
  host.addEventListener('dragleave',event=>{event.target.closest?.('.sx-slot')?.classList.remove('is-over');});
  host.addEventListener('drop',event=>{const slot=event.target.closest?.('.sx-slot');if(slot&&event.dataTransfer?.files?.length){event.preventDefault();slot.classList.remove('is-over');addFiles(slot.dataset.slot,[...event.dataTransfer.files]);}});
  // 후보를 가리키면 큰 칸에 그 사람을 미리 보인다. 고른 것(추천 · 사람 없이 · 맞춤 인물 · 내 모델 · 고른 모델)이 있으면 후보 밖으로 나갈 때 큰 칸을 고른 것으로 되돌린다
  // (11-13 — 「추천해 주세요」를 고른 채 가리켰다 떼면 큰 칸이 그 사람 이름 · 사진으로 남았다). 아무것도 안 골랐으면 마지막에 본 사람 그대로(둘러보기).
  // 후보 사이 틈을 지날 때 깜빡이지 않게 잠깐 기다렸다가, 그사이 다른 후보를 가리키면 되돌리지 않는다.
  let castBack=0;
  const previewCast=event=>{const cast=event.target.closest?.('.sx-cast');if(cast){clearTimeout(castBack);showModel(cast.dataset.id);}};
  const leaveCast=event=>{if(!event.target.closest?.('.sx-cast')||event.relatedTarget?.closest?.('.sx-cast'))return;clearTimeout(castBack);if(!choiceText(a)&&!a.models.length)return;castBack=setTimeout(()=>{if(host.isConnected)showChoice();},160);};
  host.addEventListener('mouseover',previewCast);host.addEventListener('focusin',previewCast);
  host.addEventListener('mouseout',leaveCast);host.addEventListener('focusout',leaveCast);
  host.addEventListener('mouseover',event=>{const tile=event.target.closest?.('.sx-wall .sx-cast');if(!tile||tile.contains(event.relatedTarget))return;clearTimeout(tileTimer);tileTimer=setTimeout(()=>startTile(tile),150);});
  host.addEventListener('mouseout',event=>{const tile=event.target.closest?.('.sx-wall .sx-cast');if(!tile||tile.contains(event.relatedTarget))return;clearTimeout(tileTimer);tile.querySelectorAll('video').forEach(stopTile);});
  // 영상을 못 받으면 사진으로 돌아간다. 미디어 이벤트는 거품이 없어 붙잡기 단계로 듣는다.
  mon.addEventListener('error',event=>{const film=event.target;if(film.matches?.('[data-portrait-film]')&&film.dataset.src&&film.dataset.src===film.getAttribute('src'))film.parentElement.classList.remove('has-film');else if(film.matches?.('video[data-film]'))stopTile(film);},true);
  // 단추 글은 영상 상태에서 읽는다 — play · pause 사건만으로는 자동 재생이 막힌 기기 · 재생 중 src 교체(사건 없이 멈춤)에서 글이 거꾸로 선다.
  function syncHold(film){const kind=film?.matches?.('[data-portrait-film]')?'lead':film?.matches?.('[data-win-film]')?'win':'',hold=kind&&$(`[data-hold="${kind}"]`);if(!hold)return;hold.textContent=film.paused?t('재생'):t('멈춤');hold.toggleAttribute('data-paused',film.paused);hold.setAttribute('aria-label',holdName(kind,film.paused));}
  const holdLabel=event=>{if(event.target.tagName==='VIDEO')syncHold(event.target);};
  mon.addEventListener('play',holdLabel,true);mon.addEventListener('pause',holdLabel,true);
  form.addEventListener('submit',event=>event.preventDefault());
  host.addEventListener('keydown',event=>{
    if(!['ArrowDown','ArrowUp'].includes(event.key)||event.target.getAttribute?.('role')!=='radio')return;
    const items=[...event.target.closest('[role=radiogroup]').querySelectorAll('[role=radio]')],next=items[(items.indexOf(event.target)+(event.key==='ArrowDown'?1:-1)+items.length)%items.length];
    event.preventDefault();next.focus();next.click();
  });
  // 다시 올리기가 끝나 초점을 둔 상태 줄(data-status)에서 누른 Enter는 다음 단계로 넘기지 않는다 — 반응을 기다리다 다시 누른 키보드 손님이 단계를 건너뛰지 않게(최종 검수 Q1).
  host.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing&&!['TEXTAREA','BUTTON','A'].includes(event.target.tagName)&&!['file','checkbox'].includes(event.target.type)&&event.target.dataset?.status===undefined&&step().id!=='review'){event.preventDefault();actions.next();}});
  // 휴대폰 뒤로 가기는 앞 질문으로 간다. 기록에는 한 칸만 더 쌓아 두고 누를 때마다 다시 채운다.
  // 이미 그 칸 위면 더 쌓지 않는다 — 의뢰서를 다시 열어도 덫이 두 겹이 되지 않게(예시에서 의뢰서 장면을 거듭 누를 때).
  const trap=()=>{try{if(!history.state?.requestFlow)history.pushState({requestFlow:true},'');}catch{}};
  const onPop=()=>{
    if(sent){onRoom?.(sent,a);return;}
    if(host.classList.contains('sheet-open')){setSheet(false);trap();return;}
    if(index>0){trap();go(index-1,-1);return;}
    writeNow();onExit?.();
  };
  trap();addEventListener('popstate',onPop);
  render(1);
  return {answers:a,goto:id=>{const to=STEPS.findIndex(item=>item.id===id);if(to>=0){index=to;render(1);}},receipt:showReceipt,
    unmount(){closed=true;removeEventListener('popstate',onPop);removeEventListener(LOCALE_EVENT,onLocale);if(saveTimer)writeNow();clearTimeout(slateTimer);clearTimeout(toastTimer);blobs.forEach(url=>URL.revokeObjectURL(url));blobs.clear();}};
}
