import {esc} from './api.mjs';
import {t,k,locale} from './i18n.mjs';
import {localeMenu} from './locale-menu.mjs';
import {FINISHED_FILMS,filmLine,filmNote,filmTitle} from './films-view.mjs';
import {CASTING_BOOK_URL} from './casting-view.mjs';
import {modelCard} from './room-view.mjs';
import {reduced} from './motion.mjs';

// 첫 화면(2026-11-05): 들어오자마자 작품이 화면 전부다. 쇼릴 위에 제목, 다음 쪽은 작품 이름, 그다음 세 번 확인 · 약속 · 진행 · 사람 · 끝.
// 글은 승인 원고(docs/마케팅/PULSE_소개글_20261103/README.md 1절 · 5절)이고 낱말을 바꾸지 않는다. 짜임의 근거는 docs/마케팅/PULSE_프론트재구성_20261104/README.md.
// CSP(style-src 'self') 안에서 돌도록 style 속성 글자를 쓰지 않고 CSSOM만 쓴다.
const A='./assets/request/';
const pad=value=>String(value).padStart(2,'0');
export const arrow='<svg class="sx-arw" viewBox="0 0 40 16" aria-hidden="true"><path d="M0 8h38M31 1l7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
// 글은 승인 원고의 한국어를 그대로 두고(k — 번역 표시만) 그리는 자리에서 그 언어로 옮긴다(다국어 판 2).
const lines=list=>list.map(text=>`<span class="sx-ln"><span>${esc(t(text))}</span></span>`).join('');

// 첫 줄 판(2026-11-05, 결정 표 「PULSE 첫 화면 제목」): 제목과 소개 줄은 자연스러움 · 연출이고,
// 「모든 컷을 장면 이미지로 먼저」는 진행 설명 칸(이렇게 만들어요)이 맡는다. 옛 제목 「모든 컷을 먼저 보여 드리는 AI 광고」는 첫 화면에 쓰지 않는다.
// 11-07 제목(결정 표 「… PULSE 제목 …」 — 배우 · 현장 경력을 앞에): synk.im/pulse와 같은 말 · 같은 세 줄이고, 소개 줄은 제목의 「10년」과 겹치지 않게 사이트처럼 공개 이력이다.
// 두 줄로 두면 둘째 줄이 가장 길어 넓은 화면에서 쇼릴의 세로 작품 화면(제품을 든 손)까지 닿고, 휴대폰에서는 어차피 세 줄로 접힌다.
// 끝 쪽 그림 칸은 제목 세 줄(3.42 × 제목 크기)을 비우고 잰다(film.css).
const HERO_TITLE=[k('카메라 앞에서 10년,'),k('배우가 AI 모델을'),k('연출합니다')];
const HERO_LEAD=k('넷플릭스 · tvN에 출연하고 웹드라마 주연(페이스북 1,000만 회)을 맡은 대표가 시선, 제품을 쥔 손, 웃음이 나오는 타이밍까지 직접 연출해요.');
const CHECK_LEAD=k('영상에 들어갈 모든 컷을 장면 이미지로 먼저 보여 드려요. AI 모델 21명 캐스팅, 제품·로고는 실제 파일로 합성해요.');
const HERO_NOTE=k('상담은 제품 사진 한 장과 올릴 곳만으로 시작해요.');
// 1/3은 11-07부터 「방향과 모델」 — 제작사가 방향 두 안과 모델을 함께 내밀고 손님이 고른다(docs/마케팅/PULSE_의뢰흐름_20261104/판1_설계.md).
// 세 줄은 시험(pulse-direction-client)이 이 줄의 원문을 그대로 대조해 k로 감싸지 않았다 — 그리는 자리에서 t(text)로 옮긴다(사전 키는 있다).
const CHECK_THREE=['방향과 모델 고르기','광고가 남길 한 문장과 글 콘티','컷마다 장면 이미지']; // i18n-skip
const CHECK_WORD={one:k('서리꽃이 피는 순간을 담은 홀리데이 세트'),rows:[['0:00',k('깜깜한 유리 위에서 눈 결정 하나가 자라요. 얼음에 금이 가는 작은 소리로 시작해요.')],['0:03',k('카메라가 물러나면 결정은 유리구슬 겉에 붙어 있어요. 서리가 번지고 구슬 안에 앰플과 크림이 보여요.')],['0:06',k('구슬이 깨지는 순간 소리가 사라지고 조각과 두 제품이 허공에 멈춰요. 카메라만 그 사이를 지나가요.')],['0:11',k('시간이 다시 흐르고 두 제품이 내려앉아요. 떨어진 결정이 뚜껑에 앉아 피어나고 이름이 떠요.')]]};
// 세 번 확인의 모델 판: 얼굴을 늘어놓지 않고 한 사람씩 크게. 이름과 맡은 역할이 함께 간다.
// 이름 · 역할은 카탈로그(고객 방 모델 카드와 같은 modelCard)에서 — 원문 낱말은 같고(유나 · 도시의 뮤즈 …) 번역도 한 곳이다.
const CHECK_CAST=['F01','M02','F09','M01'];
// PULSE 소개글(2026-11-04): 사실과 낱말은 그대로 옮겼다. 처음 들어온 사람이 읽는 첫 화면에만 두고, 작업 중인 손님의 고객 방에는 넣지 않는다. 모델 수가 늘면 시험(pulse-client-review-fixes)이 알린다.
// 캐스팅북 링크(둘째 약속 끝)는 글이 지금 언어를 따라야 해서 그릴 때 만든다.
const castingLink=()=>`<a class="sx-link sx-promise-link" href="${CASTING_BOOK_URL}" target="_blank" rel="noopener noreferrer">${esc(t('캐스팅북 보기'))} <span aria-hidden="true">↗</span><span class="sr"> ${esc(t('(새 탭)'))}</span></a>`;
const INTRO_PROMISES=[
  [k('컷마다 장면 먼저'),k('대표 그림 한두 장이 아니라 들어갈 모든 컷을 완성 화질로 먼저 보여 드려요. 장면 이미지는 그 컷의 첫 화면이라 움직이는 동안 작은 부분은 달라질 수 있고, 제품·로고·글자는 합성이라 달라지지 않아요.')],
  [k('출연자는 캐스팅'),k('이름과 얼굴이 정해진 AI 모델 21명 가운데 골라요. 다음 편도 같은 모델과 같은 자막 규격으로 이어요.'),castingLink],
  [k('제품·로고·화면 위 글자는 진짜로'),k('다시 그리지 않고 보내 주신 사진과 파일로 합성해, 글자가 뭉개지거나 로고가 바뀌지 않아요.')],
  [k('무엇으로 남길지 먼저'),k('이야기로 여운을 남길지, 한 장면의 임팩트로 남길지 기획 첫 줄에 정해요.')],
  [k('소리부터'),k('목소리와 음악을 먼저 만들고 그 박자에 컷을 맞춰요. 못 나온 컷은 보정으로 덮지 않고 다시 만들어요.')],
];
const STAGES=[
  [k('의뢰서를 써요'),k('제품 이름, 올릴 곳, 사진 몇 장이면 돼요. 쓰는 동안 화면에서 어떻게 보일지 바로 보여 드려요.')],
  [k('저희가 먼저 확인해요'),k('빠진 게 있으면 그 칸만 다시 여쭤요. 같은 말을 두 번 묻지 않아요. 방향 두 안과 값 · 받으실 날을 함께 보내 드리고, 결제는 글 콘티를 보신 뒤 크몽에서 해요.')],
  [k('1차안을 받아요'),k('모델, 광고가 남길 한 문장과 글 콘티, 모든 컷의 장면 이미지를 영상 전에 차례로 보여 드려요. 컷마다 의견을 남기세요. 장면 이미지는 그 컷의 첫 화면이라 움직이는 동안 작은 부분은 달라질 수 있고, 제품·로고·글자는 합성이라 달라지지 않아요.')],
  [k('확인하신 컷으로 만들어요'),k('목소리와 음악을 먼저 만들고 그 박자에 컷을 맞춰요. 제품 · 로고 · 글자는 실제 파일을 그대로 얹어요.')],
  [k('파일을 받아요'),k('올릴 곳에 맞는 파일로 받아요. 다음 편도 같은 모델과 같은 자막 규격으로 이어요.')],
];
// 이력은 synk.im/pulse 「만드는 사람」과 같은 줄 · 같은 차례다 — 서울로 당선이 맨 앞(2026-11-07 공개, 11-10 앱에도).
const MAKER_CREDITS=[k('2026 서울로미디어캔버스 단편 애니메이션 공모 당선 「다리가 기억하는 것」(2026년 12월~2027년 2월 서울로미디어캔버스 전시)'),k('넷플릭스 공개 「보라! 데보라」 1화 오프닝 시퀀스 출연'),k('tvN 「코미디빅리그」 코너 출연'),k('웹드라마 「알바왕 98과 99사이」 주연(페이스북 조회수 1,000만 회)'),k('부활 「너의 모습」 뮤직비디오 주연')];
// 값은 첫 화면에 두지 않고 의뢰서(길이 · 구성 칸, 의뢰서 줄, 보내기 전 확인)에만 정가의 「부터」로 둔다
// (2026-11-05, 결정 표 「PULSE 첫 화면 값 줄」 — 맹검 심사마다 첫 화면의 값 세 줄을 「메뉴판」 · 저가 신호로 읽었다).
const FOOT_NOTE=k('앱을 설치하지 않아도 휴대폰과 컴퓨터에서 열려요. 영상 속 사람과 목소리는 모두 AI로 만들어요. 실존 인물을 닮게 만드는 요청은 받지 않아요.');
// 체험(?demo=film)은 한국어로 만든 예시라 다른 언어 화면에서는 그 링크를 그리지 않는다(체험은 번역하지 않는다 — 링크 글도 한국어 화면에서만 보인다).
const demoOn=()=>locale()==='ko';
const DEMO_LABEL={top:'예시 프로젝트',after:'예시 프로젝트 체험하기 →'}; // i18n-skip

// 쇼릴: 작품 여럿의 자막 없는 구간을 이은 소리 없는 반복 영상. 2026-11-09 3판은 synk.im과 같은 영상이고(docs/마케팅/PULSE_포트폴리오_제작준비_20261012/진열/굽기.cjs reel),
// 시간표는 그 도구가 구운 영상의 24fps 컷 경계(reel.json)다. 도담중공업으로 열고 오미톡 · 매진 임박 · 모두의코스가 이어진 뒤 도담 · 매진 · 모두의코스가 한 번 더 나온다. 화면 글이 얼굴을 덮지 않는 컷만 쓴다. 화면 비율이 맞는 작품만 꽉 채우고 안 맞는 작품은 자르지 않고 검은 바탕의 스크린으로 영상 안에 구워 두었다(11-09).
const REEL_TOTAL=12.33;
const REEL=[[0,'dodam-heavy'],[2,'omitok-court'],[3.13,'maejin-imbak'],[4.96,'modu-course'],[6.79,'dodam-heavy'],[8.58,'maejin-imbak'],[10.42,'modu-course']].map(([at,work])=>({at,work}));
const filmOf=id=>FINISHED_FILMS.find(film=>film.id===id);
// 11-09: 「완성 광고」 쪽 목록은 쇼릴에 나오는 네 편(featured)이다 — 이름에 손을 올리면 쇼릴이 그 작품 컷만 돈다. 쇼릴에 없는 공모전 출품작 한 줄은 뺐고
// (손을 올려도 그 작품 컷이 없어 이름과 화면이 어긋난다), 화성 세 편은 「완성 광고」 공간에 그대로 있다.
const OWN=FINISHED_FILMS.filter(film=>film.featured),CONTEST=null;
const isTall=()=>typeof matchMedia==='function'&&matchMedia('(max-aspect-ratio: 1/1)').matches;
const reelSrc=()=>`${A}reel-${isTall()?'tall':'wide'}.mp4`;
const reelPoster=()=>`${A}reel-${isTall()?'tall':'wide'}-poster.webp`;
// 첫 방문 무게(11-11): 문서가 다 불러졌는지(그 전에 받으면 화면 모듈 · 글꼴과 대역을 나눈다), 데이터를 아껴야 하는 연결인지.
// navigator.connection이 없는 브라우저(사파리 · 파이어폭스)는 아끼지 않는 쪽 — 저절로 받는 것은 load 뒤라 첫 그리기와 겹치지 않는다.
export const pageLoaded=()=>typeof document!=='object'||document.readyState==='complete';
const connection=()=>typeof navigator==='object'?navigator.connection:null;
export const leanData=()=>{const c=connection();return !!c&&(c.saveData===true||/(^|-)2g$/.test(String(c.effectiveType||'')));};
export const slowData=()=>leanData()||String(connection()?.effectiveType||'')==='3g';

// 쇼릴 하나를 video에 잇는다. focus(id)를 부르면 그 작품의 컷만 돌고, focus(null)이면 전체가 돈다.
// held면 파일을 바로 받지 않고 처음 play()에서 붙인다(예시 · 의뢰서가 첫 화면 위에 곧바로 열릴 때). 붙잡힌 동안은 포스터도 받지 않는다(덮개 뒤라 안 보인다).
// 첫 방문 무게(11-11): 쇼릴 파일(세로 6.9MB · 가로 7.4MB)은 문서가 다 불러진 뒤(load)에 붙인다. 그동안은 같은 첫 장면인 포스터가 보이고,
// 느린 연결에서 화면 모듈 · 글꼴 · 보이는 그림과 대역을 나누지 않는다(판 6 점검 E — 쇼릴이 먼저 받으면 첫 화면 글이 늦게 그려진다).
// 데이터 절약(saveData) · 2G 연결이면 저절로 받지 않고 포스터로 둔다 — 작품 이름에 손을 올리면(focus(id,{ask:true})) 그때 받는다.
export function mountReel(video,{onCut,held=false}={}){
  video.muted=true;video.playsInline=true;video.loop=true;video.preload='auto';video.setAttribute('aria-hidden','true');
  if(!held)video.poster=reelPoster();
  let only=null,index=0,wanted=!held,want=!held,asked=false,raf=0,frame=0,attached=false,keep=0,onMeta=null,waiting=null;
  const dropMeta=()=>{if(onMeta)video.removeEventListener('loadedmetadata',onMeta);onMeta=null;};
  // 파일이 안 붙은 동안 화면에 보이는 것은 포스터(쇼릴 첫 장면)다 — 작품 이름 줄과 「지금 작품」도 그 작품을 가리킨다.
  // 데이터 절약 · 2G에서 6쪽 「만드는 사람」(그 작품 컷만 돌리는 쪽)을 다녀오면 컷 번호만 옮겨 가 1쪽 이름이 포스터와 어긋났다.
  const shown=()=>attached?index:0;
  const report=()=>onCut?.(filmOf(REEL[shown()].work));
  // 붙이는 순간부터 영상이 컷 번호를 따르므로 이름도 그때 다시 알린다.
  const attach=()=>{if(attached)return;attached=true;video.src=reelSrc();if(keep>0){const at=keep;onMeta=()=>{onMeta=null;try{video.currentTime=at;}catch{}};video.addEventListener('loadedmetadata',onMeta,{once:true});}report();};
  const dropWait=()=>{if(waiting)removeEventListener('load',waiting);waiting=null;};
  // 파일을 붙일 때가 됐으면 붙이고, 재생을 바라면 튼다. 아직 문서를 불러오는 중이면 load에서 다시 본다.
  const sync=()=>{
    if(!want||(leanData()&&!asked))return;
    if(!pageLoaded()){if(!waiting){waiting=()=>{waiting=null;sync();};addEventListener('load',waiting,{once:true});}return;}
    attach();if(wanted&&!reduced())video.play().catch(()=>{});
  };
  const cutAt=time=>{let at=0;for(let i=0;i<REEL.length;i++)if(time>=REEL[i].at)at=i;return at;};
  const endOf=at=>at+1<REEL.length?REEL[at+1].at:REEL_TOTAL;
  const cutsOf=id=>REEL.map((cut,i)=>[cut,i]).filter(([cut])=>cut.work===id).map(([,i])=>i);
  const go=at=>{index=at;video.currentTime=REEL[at].at+.02;report();};
  // 고른 작품만 돌 때는 다음 컷이 한 프레임도 비치지 않도록 매 프레임 본다.
  const watch=()=>{raf=requestAnimationFrame(watch);if(!only||video.seeking)return;const time=video.currentTime;if(time>=endOf(index)-.07||time<REEL[index].at){const list=cutsOf(only);go(list[(list.indexOf(index)+1)%list.length]);}};
  // 보통 재생도 화면에 나간 프레임의 시간으로 컷을 본다. timeupdate(약 0.25초마다)만 보면 작품 이름이 장면보다 늦게 바뀐다(운영 11-05, 최대 0.24초).
  const frames=typeof video.requestVideoFrameCallback==='function';
  const onFrame=(_,meta)=>{frame=video.requestVideoFrameCallback(onFrame);if(only)return;const at=cutAt(meta?.mediaTime??video.currentTime);if(at!==index){index=at;report();}};
  if(frames)frame=video.requestVideoFrameCallback(onFrame);
  const onTime=()=>{if(only||frames)return;const at=cutAt(video.currentTime);if(at!==index){index=at;report();}};
  video.addEventListener('timeupdate',onTime);
  const play=()=>{wanted=true;want=true;if(!video.poster)video.poster=reelPoster();sync();if(only&&!raf)raf=requestAnimationFrame(watch);};
  const pause=()=>{wanted=false;video.pause();cancelAnimationFrame(raf);raf=0;};
  // 예시 · 의뢰서가 위를 덮으면 멈추고, 다 받지 못한 쇼릴은 내려받기도 놓는다. 다시 play()하면 그 자리에서 잇는다.
  const whole=()=>{const got=video.buffered;return got.length===1&&got.start(0)<=.1&&got.end(0)>=(video.duration||Infinity)-.15;};
  // 다시 붙인 뒤 메타데이터가 오기 전(readyState 0)이면 currentTime은 아직 0이라 떼던 자리(keep)를 그대로 둔다(검수 A1).
  // 아직 붙이지 않았으면(load를 기다리는 중) 기다림도 거둔다.
  const suspend=()=>{pause();if(!attached){want=false;dropWait();return;}if(whole())return;want=false;if(video.readyState>=1)keep=video.currentTime||0;dropMeta();attached=false;video.removeAttribute('src');video.load?.();};
  sync();report();
  return {play,pause,suspend,video,
    // ask: 손님이 작품 이름을 골랐다(데이터 절약이어도 이때는 받는다).
    focus(id,{ask=false}={}){if(ask&&id)asked=true;if(id===only){if(wanted)play();return;}only=id;cancelAnimationFrame(raf);raf=0;if(id&&cutsOf(id).length){go(cutsOf(id)[0]);raf=requestAnimationFrame(watch);}else{only=null;report();}if(wanted)play();},
    current:()=>filmOf(REEL[shown()].work),
    stop(){pause();want=false;dropWait();if(frame)video.cancelVideoFrameCallback?.(frame);frame=0;dropMeta();video.removeEventListener('timeupdate',onTime);attached=false;video.removeAttribute('src');video.load?.();}};
}

// 열린 창 안에서만 Tab이 돈다.
export function trapTab(box){
  box.addEventListener('keydown',event=>{
    if(event.key!=='Tab')return;
    const list=[...box.querySelectorAll('a[href],button:not([disabled]),input,textarea,select,[tabindex="0"]')].filter(el=>el.offsetParent!==null);
    if(!list.length){event.preventDefault();return;}
    const first=list[0],last=list.at(-1),now=document.activeElement;
    if(event.shiftKey&&(now===first||now===box)){event.preventDefault();last.focus();}else if(!event.shiftKey&&now===last){event.preventDefault();first.focus();}
  });
}
const fmtShort=value=>`${Math.floor(value/60)}:${pad(Math.floor(value%60))}`;
// 소리와 함께 보는 어두운 방. 작품 하나를 온 화면으로 튼다. 손을 놓으면 글자가 물러난다.
export function openScreening(film,{onClose}={}){
  if(!film?.full?.src)return null;
  const opener=document.activeElement,box=document.createElement('div');
  box.className='sx-screening';box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-label',t('{title} 상영',{title:filmTitle(film)}));box.dataset.ratio=film.orientation==='portrait'?'9:16':'16:9';
  box.innerHTML=`<video class="sx-screening-film" playsinline src="${esc(film.full.src)}"></video><div class="sx-screening-ui"><button type="button" class="sx-small sx-screening-close" data-close>${esc(t('닫기'))}</button><p class="sx-screening-title"><b>${esc(filmTitle(film))}</b> <span>${esc(filmLine(film))}</span><em>${esc(filmNote(film))}</em></p><div class="sx-screening-time"><span class="sx-no" data-t>0:00</span><div class="sx-screening-line" data-line><i data-fill></i></div></div></div>`;
  document.body.append(box);
  requestAnimationFrame(()=>box.classList.add('is-on'));
  const video=box.querySelector('video'),fill=box.querySelector('[data-fill]'),tc=box.querySelector('[data-t]');
  video.muted=false;video.play().catch(()=>{video.muted=true;video.play().catch(()=>{});});
  let idle=0;
  const wake=()=>{box.classList.remove('is-idle');clearTimeout(idle);idle=setTimeout(()=>{if(!video.paused)box.classList.add('is-idle');},2000);};
  const key=event=>{wake();if(event.key==='Escape')close();if(event.key===' '&&document.activeElement?.tagName!=='BUTTON'){event.preventDefault();if(video.paused)video.play();else video.pause();}};
  // 휴대폰 뒤로 가기는 앱을 나가지 않고 상영만 닫는다.
  let pushed=false;try{history.pushState({sxScreening:true},'');pushed=true;}catch{}
  const onPop=()=>{pushed=false;close();};
  let closed=false;
  function close(){if(closed)return;closed=true;video.pause();clearTimeout(idle);box.classList.remove('is-on');setTimeout(()=>box.remove(),reduced()?0:420);removeEventListener('keydown',key);removeEventListener('popstate',onPop);if(pushed){pushed=false;if(history.state?.sxScreening)history.back();}opener?.focus?.();onClose?.();}
  addEventListener('keydown',key);addEventListener('popstate',onPop);
  box.querySelector('[data-close]').addEventListener('click',close);
  box.addEventListener('pointermove',wake);box.addEventListener('pointerdown',wake);wake();
  video.addEventListener('timeupdate',()=>{fill.style.setProperty('--p',String(video.currentTime/(video.duration||1)));tc.textContent=fmtShort(video.currentTime);});
  video.addEventListener('ended',wake);
  video.addEventListener('click',()=>{if(video.paused)video.play();else video.pause();wake();});
  box.querySelector('[data-line]').addEventListener('pointerdown',event=>{const rect=event.currentTarget.getBoundingClientRect();video.currentTime=(event.clientX-rect.left)/rect.width*(video.duration||0);});
  // 닫기 단추가 아니라 창에 초점을 둬야 스페이스가 재생 · 멈춤이 된다.
  box.tabIndex=-1;box.focus();trapTab(box);
  return {close,box,video};
}

const workRow=film=>`<li data-in><button type="button" class="sx-work" data-work="${esc(film.id)}"><span class="sx-work-name sx-serif">${esc(filmTitle(film))}</span><span class="sx-work-line sx-small"><span>${esc(filmLine(film))}${film.tag?` · ${esc(t(film.tag))}`:''}</span></span></button></li>`;
// 내 프로젝트 다시 열기(판 4): 위는 메일로 코드 받기(의뢰서에 적은 메일 → 여섯 자리 → 열림, 둘 이상이면 고르기 — 앱이 서버를 보고 켤 때만 보인다),
// 아래는 접수증 · 담당자에게 받은 링크 붙여 넣기. 메일에는 방 열쇠를 넣지 않는다 — 코드는 10분 동안 한 번만 쓴다.
const inviteForm=entryError=>`<div class="sx-invite" data-entry-invite ${entryError?'':'hidden'}>${entryError?`<div class="sx-invite-alert" role="alert"><strong>${esc(entryError.title)}</strong><p>${esc(entryError.text)}</p></div>`:''}<form class="sx-invite-form sx-invite-mail" data-form="mail-open" data-entry-mail data-step="email" novalidate hidden><p class="sx-body sx-invite-head">${esc(t('메일로 다시 열기'))}</p><label data-mail-step="email"><span class="sx-small">${esc(t('의뢰서에 적은 메일'))}</span><input name="email" type="email" maxlength="254" autocomplete="email" autocapitalize="off" spellcheck="false"></label><label data-mail-step="code" hidden><span class="sx-small">${esc(t('진행 중인 의뢰가 있으면 이 주소로 코드를 보냈어요. 메일의 여섯 자리를 넣어 주세요.'))}</span><input name="code" type="text" maxlength="7" autocomplete="one-time-code" inputmode="numeric"></label><div class="sx-mail-pick" data-mail-step="pick" hidden></div><input class="sx-hp" name="website" type="text" tabindex="-1" autocomplete="off" aria-hidden="true"><button type="submit" class="sx-go" data-mutate><span data-mail-go>${esc(t('코드 받기'))}</span>${arrow}</button><p class="sx-small" data-mail-help hidden>${esc(t('몇 분 안에 오지 않으면 스팸함을 보시고, 그래도 없으면 hello@synk.im으로 접수 번호를 보내 주세요.'))} <button type="button" class="sx-link" data-action="mail-again">${esc(t('다른 주소로 다시 받기'))}</button></p></form><form class="sx-invite-form" data-form="invite"><label><span class="sx-small">${esc(t('접수증이나 담당자에게 받은 링크'))}</span><input name="invite" type="text" maxlength="3000" required placeholder="https://workspace.synk.im/pulse-app/#invite=…" autocomplete="off" autocapitalize="off" spellcheck="false" inputmode="url"></label><button type="submit" class="sx-go" data-mutate><span>${esc(t('열기',null,'open'))}</span>${arrow}</button></form><p class="sx-small">${esc(t('가입이나 비밀번호 없이 열려요. 연결하면 이 프로젝트의 자료와 대화만 볼 수 있어요.'))}</p><button type="button" class="sx-small sx-link" data-action="retry">${esc(t('이 기기에서 다시 확인'))}</button><button type="button" class="sx-small sx-invite-close" data-entry="close">${esc(t('닫기'))}</button></div>`;

const pages=({start,demoHref})=>[
  {layer:'reel',html:`<div class="sx-hero-copy"><p class="sx-kicker" data-in>${esc(t('SYNK PULSE · AI 광고 제작'))}</p><h1 class="sx-display">${lines(HERO_TITLE)}</h1><p class="sx-body sx-hero-lead" data-in>${esc(t(HERO_LEAD))}</p></div>
    <div class="sx-hero-act"><button type="button" class="sx-credit" data-watch-now data-in><b data-cr-name></b> <span data-cr-line></span><em data-cr-note></em></button><button type="button" class="sx-go is-solid" data-entry="start" data-in><span data-start-label>${esc(start)}</span>${arrow}</button><button type="button" class="sx-open-m sx-small" data-entry="open" data-in>${esc(t('내 프로젝트 다시 열기'))}</button></div>`},
  {layer:'reel',cls:'is-works',veil:true,html:`<header class="sx-works-head"><p class="sx-kicker" data-in>${esc(t('완성 광고'))}</p><h2 class="sx-body" data-in>${esc(t('SYNK가 끝까지 만든 광고예요. 가상 브랜드로 만든 자체 작품이에요. 새 작품은 완성되는 대로 더해요.'))}</h2></header>
    <div class="sx-works-wrap"><ol class="sx-works">${OWN.map(workRow).join('')}</ol>${CONTEST?`<button type="button" class="sx-work is-contest" data-work="${esc(CONTEST.id)}" data-in><span class="sx-small">${esc(t('공모전 출품작'))}</span><span class="sx-work-name sx-serif">${esc(filmTitle(CONTEST))}</span><span class="sx-work-line sx-small">${esc(filmLine(CONTEST))}</span></button>`:''}</div>`},
  {layer:'none',cls:'is-check',html:`<div class="sx-check"><p class="sx-kicker" data-in>${esc(t('이렇게 만들어요'))}</p><h2 class="sx-display">${lines([k('영상 전에 세 번 확인해요')])}</h2><p class="sx-body sx-check-lead" data-in>${esc(t(CHECK_LEAD))}</p>
    <ol class="sx-check-list">${CHECK_THREE.map((text,i)=>`<li data-in><button type="button" data-check="${i}"><span class="sx-no">${i+1}/3</span><span class="sx-serif">${esc(t(text))}</span></button></li>`).join('')}</ol>
    <p class="sx-small" data-in>${esc(t('장면 이미지는 그 컷의 첫 화면이라 움직이는 동안 작은 부분은 달라질 수 있고, 제품·로고·글자는 합성이라 달라지지 않아요.'))}</p></div>
    <div class="sx-check-stage" aria-hidden="true">
      <div class="sx-pane sx-pane-cast is-on">${CHECK_CAST.map(modelCard).filter(Boolean).map(m=>`<figure><img data-src="${A}model-scene-${m.id.toLowerCase()}.webp" alt="" loading="lazy" decoding="async" width="960" height="1285"><figcaption class="sx-small"><b>${esc(t(m.name,null,'model'))}</b> ${esc(t(m.line))}</figcaption></figure>`).join('')}</div>
      <div class="sx-pane sx-pane-word"><p class="sx-serif sx-pane-one">${esc(t(CHECK_WORD.one))}</p><ol>${CHECK_WORD.rows.map(([at,text])=>`<li><span class="sx-no">${at}</span><span class="sx-small">${esc(t(text))}</span></li>`).join('')}</ol></div>
      <div class="sx-pane sx-pane-cuts">${Array.from({length:12},(_,i)=>`<img data-src="${A}sheet-gift-${pad(i+1)}.webp" alt="" loading="lazy" decoding="async" width="360" height="640">`).join('')}</div>
    </div>`},
  {layer:'none',cls:'is-paper',html:`<ol class="sx-promises">${INTRO_PROMISES.map(([title,text,link],i)=>`<li data-in><span class="sx-no">${pad(i+1)}</span><h3 class="sx-serif">${esc(t(title))}</h3><p class="sx-body">${esc(t(text))}${link?` ${link()}`:''}</p></li>`).join('')}</ol>`},
  {layer:'shard',cls:'is-stages',html:`<h2 class="sx-display">${lines([k('맡기면 이렇게 진행돼요')])}</h2><ol class="sx-stages">${STAGES.map(([title,text],i)=>`<li data-in><span class="sx-no">${pad(i+1)}</span><h3 class="sx-serif">${esc(t(title))}</h3><p class="sx-body">${esc(t(text))}</p></li>`).join('')}</ol>
    <p class="sx-after" data-in><span class="sx-body">${esc(t('맡기신 뒤에는 한 방에서 시안을 보고 의견을 남기고, 최종 파일까지 받아요.'))}</span>${demoOn()?` <a class="sx-link" href="${esc(demoHref)}" data-entry-demo>${DEMO_LABEL.after}</a>`:''}</p>`},
  {layer:'reel',cls:'is-maker',focus:'maejin-imbak',html:`<div class="sx-maker"><p class="sx-kicker" data-in>${esc(t('만드는 사람'))}</p><h2 class="sx-display">${lines([k('카메라 앞에 서 본 사람이 AI 모델의 연기를 연출해요')])}</h2><p class="sx-body" data-in>${esc(t('AI 광고가 어색해지는 곳은 대개 표정과 호흡, 말이 끝나는 타이밍이에요. SYNK PULSE는 엔터테인먼트·광고 업계에서 10년 일한 대표 유호가 연출해요.'))}</p><ul class="sx-maker-credits">${MAKER_CREDITS.map(line=>`<li class="sx-small" data-in>${esc(t(line))}</li>`).join('')}</ul></div>`},
  {layer:'end',cls:'is-end',html:`<div class="sx-end"><p class="sx-display">${lines(HERO_TITLE)}</p><button type="button" class="sx-go is-solid is-large" data-entry="start" data-in><span data-start-label>${esc(start)}</span>${arrow}</button><p class="sx-small" data-in>${esc(t(HERO_NOTE))}</p>
    <footer class="sx-foot" data-in><p class="sx-small">${esc(t(FOOT_NOTE))}</p><a class="sx-small sx-link" href="?mode=staff">${esc(t('제작자 공간'))}</a></footer></div>`},
];
const LAYERS=[{id:'reel'},{id:'none'},{id:'shard',image:`${A}shard.webp`},{id:'end',image:`${A}end.webp`}];
const startLabel=resume=>resume?t('쓰던 의뢰서 이어 쓰기'):t('광고 의뢰하기');

export function entryView({demoHref='?demo=film',entryError=null,resume=false}={}){
  const list=pages({start:startLabel(resume),demoHref});
  return `<div class="sx-home${entryError?' has-entry-error':''}">
    <div class="sx-stage" aria-hidden="true">${LAYERS.map(layer=>`<div class="sx-layer sx-layer-${layer.id}" data-layer="${layer.id}">${layer.image?`<img data-src="${layer.image}" alt="" decoding="async">`:''}${layer.id==='reel'?'<video data-reel></video>':''}</div>`).join('')}<div class="sx-shade"></div><div class="sx-veil" data-veil></div></div>
    <header class="sx-top"><a class="sx-logo" href="./" aria-label="${esc(t('SYNK PULSE 처음으로'))}"><img src="./assets/request/logo-paper.webp" alt="SYNK PULSE" width="164" height="44"></a><nav class="sx-top-nav" aria-label="${esc(t('바로 가기'))}"><button type="button" data-entry="open">${esc(t('내 프로젝트 다시 열기'))}</button>${demoOn()?`<a href="${esc(demoHref)}" data-entry-demo>${DEMO_LABEL.top}</a>`:''}${localeMenu()}</nav></header>
    <div class="sx-reel" tabindex="-1">${list.map((page,i)=>`<section class="sx-p ${page.cls||''}" data-i="${i}" data-layer="${page.layer}">${page.html}</section>`).join('')}</div>
    <nav class="sx-nums" aria-label="${esc(t('쪽'))}">${list.map((_,i)=>`<button type="button" data-go="${i}" aria-label="${esc(t('{n}쪽',{n:i+1}))}"><span>${i+1}</span></button>`).join('')}<i class="sx-nums-bar" aria-hidden="true"></i></nav>
    ${inviteForm(entryError)}
  </div>`;
}

// 듣개는 화면과 함께 사라지는 래퍼에 걸고, 창에 건 것은 unmount에서 뗀다. 앱은 첫 화면을 다시 그리지 않고 update로 글만 바꾼다(쇼릴이 처음으로 돌아가지 않게).
// onModels(판 4): 「내 모델」 입구. 단추는 앱이 스위치 myModels를 확인한 뒤 showModels()로 붙인다(꺼져 있으면 첫 화면이 판 4 전과 같다).
export function mountEntry(root,{onStart,onInvite,onDemo,onModels,animate=true,demoHref='?demo=film',held=false}={}){
  const host=root.querySelector('.sx-home');if(!host)return {unmount(){},update(){}};
  const list=pages({start:'',demoHref});
  const $=selector=>host.querySelector(selector),$$=selector=>[...host.querySelectorAll(selector)];
  if(!animate)host.classList.add('no-enter');
  document.documentElement.classList.add('view-entry');
  let hold=held;
  const reelApi=mountReel($('[data-reel]'),{held,onCut:film=>{const name=$('[data-cr-name]');if(!name||!film)return;name.textContent=filmTitle(film);$('[data-cr-line]').textContent=filmLine(film);$('[data-cr-note]').textContent=filmNote(film);}});
  const layers=new Map($$('.sx-layer').map(el=>[el.dataset.layer,el]));
  const numbers=$$('.sx-nums button'),sections=$$('.sx-p'),reel=$('.sx-reel');
  let current=-1,cursor=null,screening=null;
  const smooth=()=>reduced()?'auto':'smooth';
  // 첫 방문 무게(11-11): 뒤쪽 무대 그림(shard 449KB · end)과 「세 번 확인」 창 그림 16장(약 1MB)은 data-src로 그려 두고 가까이 왔을 때 붙인다 —
  // 지금 쪽부터 두 쪽 앞까지의 무대 그림, 지금 쪽과 다음 쪽 안의 그림. 덮개(의뢰서 · 예시) 뒤에서는 붙이지 않는다(판 6 점검 E에서
  // 의뢰서 밑 첫 화면 그림 1.4MB가 의뢰서 그림과 같이 받아졌다). 느리지 않은 연결이면 문서 load 뒤 쉴 때 남은 그림을 다 붙여 둔다
  // (쪽 번호로 건너뛰어도 비지 않게 — 빠른 연결에서 보이는 것은 그대로다).
  let gone=false,idleTimer=0,onLoad=null;
  const hydrate=node=>{if(!node||gone)return;for(const img of node.querySelectorAll('img[data-src]')){img.src=img.dataset.src;img.removeAttribute('data-src');}};
  const warm=i=>{if(hold||i<0)return;for(let k=i;k<=i+2&&k<list.length;k++)hydrate(layers.get(list[k].layer));hydrate(sections[i]);hydrate(sections[i+1]);};
  const warmAll=()=>{if(!hold&&!slowData())hydrate(host);};
  const later=()=>{clearTimeout(idleTimer);idleTimer=setTimeout(()=>{if(typeof requestIdleCallback==='function')requestIdleCallback(warmAll,{timeout:4000});else warmAll();},1200);};
  if(pageLoaded())later();else{onLoad=()=>{onLoad=null;later();};addEventListener('load',onLoad,{once:true});}
  // 세 번 확인: 줄마다 오른쪽 화면이 바뀐다. 쪽에 머무는 동안 천천히 저절로 넘어가고, 손을 대면 멈춘다.
  const panes=$$('.sx-pane'),rows=$$('[data-check]');
  let checkAt=0,checkTimer=0;
  const setCheck=at=>{checkAt=at;panes.forEach((pane,i)=>pane.classList.toggle('is-on',i===at));rows.forEach((row,i)=>{row.classList.toggle('is-now',i===at);row.setAttribute('aria-pressed',i===at?'true':'false');});};
  const autoCheck=on=>{clearInterval(checkTimer);if(on&&!reduced())checkTimer=setInterval(()=>setCheck((checkAt+1)%panes.length),3400);};
  rows.forEach(row=>{const pick=()=>{autoCheck(false);setCheck(Number(row.dataset.check));};row.addEventListener('pointerenter',pick);row.addEventListener('focus',pick);row.addEventListener('click',pick);});
  setCheck(0);
  const clearWork=()=>{host.classList.remove('has-work');$$('.sx-work').forEach(item=>item.classList.remove('is-on'));};
  function activate(i){
    if(i===current)return;current=i;
    warm(i);
    const page=list[i],id=page.layer;
    layers.forEach((el,key)=>el.classList.toggle('is-on',key===id));
    if(i!==1){reelApi.focus(page.focus??null);clearWork();}
    if(id==='reel'&&!screening&&!hold)reelApi.play();else reelApi.pause();
    autoCheck(page.cls==='is-check');
    $('[data-veil]').classList.toggle('is-on',!!page.veil);
    numbers.forEach((button,k)=>{button.classList.toggle('is-now',k===i);if(k===i)button.setAttribute('aria-current','true');else button.removeAttribute('aria-current');});
    $('.sx-nums-bar').style.setProperty('--x',String(i));
    host.dataset.page=String(i);
    host.classList.toggle('on-paper',page.cls==='is-paper');
    host.classList.toggle('on-maker',page.cls==='is-maker');
    host.classList.toggle('on-end',page.cls==='is-end');
    cursor?.classList.remove('is-on');
  }
  // 화면 가운데 줄에 걸린 쪽을 켠다. 창보다 긴 쪽도 놓치지 않는다.
  const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){entry.target.classList.add('is-in');activate(Number(entry.target.dataset.i));}},{root:reel,rootMargin:'-50% 0px -50% 0px',threshold:0}):null;
  sections.forEach(section=>{observer?.observe(section);section.querySelectorAll('[data-in]').forEach((node,k)=>node.style.setProperty('--d',`${k*60+160}ms`));section.querySelectorAll('.sx-ln > span').forEach((node,k)=>node.style.setProperty('--d',`${k*90+40}ms`));});
  numbers.forEach(button=>button.addEventListener('click',()=>sections[Number(button.dataset.go)].scrollIntoView({behavior:smooth()})));
  const typing=()=>{const overlay=document.querySelector('#request-root');return /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||'')||!!document.querySelector('dialog[open],.sx-q')||!!(overlay&&!overlay.hidden);};
  const onKey=event=>{
    if(screening||typing()||event.altKey||event.ctrlKey||event.metaKey)return;
    if(['ArrowDown','PageDown'].includes(event.key)){event.preventDefault();sections[Math.min(current+1,sections.length-1)].scrollIntoView({behavior:smooth()});}
    if(['ArrowUp','PageUp'].includes(event.key)){event.preventDefault();sections[Math.max(current-1,0)].scrollIntoView({behavior:smooth()});}
  };
  addEventListener('keydown',onKey);
  // 마우스 휠 한 번(트랙패드 손짓 한 번)에 한 쪽씩. 쪽 넘김 맞물림은 작은 휠 눈금을 제자리로 되돌려 버리기 때문이다.
  let wheelLock=0,armed=true,prevAbs=0,wheelIdle=0;
  reel.addEventListener('wheel',event=>{
    // Ctrl + 휠과 두 손가락 벌리기는 브라우저 확대다.
    if(screening||event.ctrlKey)return;
    const page=sections[current],rect=page.getBoundingClientRect(),dir=Math.sign(event.deltaY);
    // 화면보다 긴 쪽(낮은 창)은 그 쪽 끝까지 평소처럼 내린다.
    if(rect.height>innerHeight+4&&!((dir>0&&rect.bottom<=innerHeight+2)||(dir<0&&rect.top>=-2)))return;
    const to=Math.max(0,Math.min(sections.length-1,current+dir));
    if(to===current)return;
    event.preventDefault();
    // Firefox의 마우스 휠은 줄 단위(deltaMode 1)로 온다. 픽셀로 환산한다.
    const now=performance.now(),abs=Math.abs(event.deltaY)*(event.deltaMode===1?16:event.deltaMode===2?innerHeight:1);
    clearTimeout(wheelIdle);wheelIdle=setTimeout(()=>{armed=true;prevAbs=0;},150);
    const notch=event.wheelDeltaY&&event.wheelDeltaY%120===0;
    if(!armed&&now>wheelLock&&(notch||(abs>40&&abs>prevAbs*1.6)))armed=true;
    prevAbs=abs;
    if(!armed||now<wheelLock||abs<4)return;
    armed=false;wheelLock=now+780;
    sections[to].scrollIntoView({behavior:smooth()});
  },{passive:false});
  // 작품 이름에 손을 올리면 뒤 화면이 그 작품으로.
  $$('.sx-work').forEach(button=>{const on=()=>{host.classList.add('has-work');$$('.sx-work').forEach(item=>item.classList.toggle('is-on',item===button));reelApi.focus(button.dataset.work,{ask:true});};button.addEventListener('pointerenter',on);button.addEventListener('focus',on);});
  $('.sx-works-wrap')?.addEventListener('pointerleave',()=>{clearWork();reelApi.focus(null);});
  const watch=film=>{reelApi.pause();screening=openScreening(film,{onClose:()=>{screening=null;if(list[current]?.layer==='reel'&&!hold)reelApi.play();}});};
  // 받은 링크 폼: 여는 단추 둘(넓은 화면 머리 · 휴대폰 1쪽)이 같은 상태를 따르고, 닫으면 연 단추(없으면 보이는 단추)로 초점이 돌아간다.
  // 휴대폰은 폼을 연 채 다른 쪽으로 넘길 수 있다 — 연 단추가 화면 밖이면 첫 화면을 그 쪽으로 되감지 않는다(검수 F1).
  const invite=$('[data-entry-invite]');let inviteFrom=null;
  const markInvite=open=>{invite.hidden=!open;$$('[data-entry="open"]').forEach(button=>button.setAttribute('aria-expanded',open?'true':'false'));};
  const setInvite=(open,from)=>{markInvite(open);if(open){if(from)inviteFrom=from;invite.querySelector('form:not([hidden]) input:not(.sx-hp)')?.focus();return;}const back=[inviteFrom,...$$('[data-entry="open"]')].find(button=>button?.isConnected&&button.offsetParent!==null);if(!back)return;const box=back.getBoundingClientRect();back.focus({preventScroll:box.bottom<=0||box.top>=innerHeight});};
  markInvite(!invite.hidden);
  host.addEventListener('click',event=>{
    if(onDemo&&event.target.closest('[data-entry-demo]')){event.preventDefault();onDemo();return;}
    const work=event.target.closest('[data-work]');if(work){watch(filmOf(work.dataset.work));return;}
    if(event.target.closest('[data-watch-now]')){watch(reelApi.current());return;}
    const what=event.target.closest('[data-entry]')?.dataset.entry;
    if(what==='start'){onStart?.();return;}
    if(what==='models'){onModels?.();return;}
    if(what==='open'){setInvite(invite.hidden,event.target.closest('[data-entry]'));return;}
    if(what==='close'){setInvite(false);return;}
    // 쇼릴 위 빈 곳을 누르면 그 작품을 소리와 함께.
    if(current===0&&cursor&&!event.target.closest('button,a,input,form,.sx-hero-copy'))watch(reelApi.current());
  });
  invite.addEventListener('keydown',event=>{if(event.key==='Escape')setInvite(false);});
  if(onInvite)$('[data-entry-invite]').addEventListener('submit',event=>{if(event.target.dataset.form!=='invite')return;event.preventDefault();onInvite(event.target.invite.value);});
  // 쇼릴 위에서는 커서가 곧 재생 안내다(마우스일 때만).
  let cursorRaf=0,onPointer=null;
  if(typeof matchMedia==='function'&&matchMedia('(hover:hover) and (pointer:fine)').matches&&!reduced()){
    cursor=document.createElement('div');cursor.className='sx-cursor';cursor.setAttribute('aria-hidden','true');cursor.innerHTML=`<span>${esc(t('소리와 함께 보기'))}</span>`;host.append(cursor);
    let x=innerWidth/2,y=innerHeight/2,tx=x,ty=y;
    onPointer=event=>{tx=event.clientX;ty=event.clientY;cursor.classList.toggle('is-on',current===0&&!screening&&!event.target.closest?.('button,a,input,form,.sx-hero-copy,.sx-nums,.sx-top'));};
    addEventListener('pointermove',onPointer);
    const tick=()=>{x+=(tx-x)*.16;y+=(ty-y)*.16;cursor.style.setProperty('--tx',`${x}px`);cursor.style.setProperty('--ty',`${y}px`);cursorRaf=requestAnimationFrame(tick);};
    tick();
  }
  activate(0);sections[0].classList.add('is-in');
  return {
    // 메일의 「?open=mail」로 왔을 때 앱이 다시 열기 판을 열어 둔다(판 4).
    openInvite(){if(invite.hidden)setInvite(true);},
    // 「내 모델」 입구(PULSE 인물 판 4): 넓은 화면 머리(다시 열기 옆)와 휴대폰 1쪽(다시 열기 아래)에 한 번만 붙인다.
    showModels(){
      if($('[data-entry="models"]'))return;
      const top=document.createElement('button');top.type='button';top.dataset.entry='models';top.textContent=t('내 모델');
      $('.sx-top-nav [data-entry="open"]')?.after(top);
      const phone=document.createElement('button');phone.type='button';phone.className='sx-open-m sx-small sx-models-m';phone.dataset.entry='models';phone.textContent=t('내 모델');
      $('.sx-hero-act .sx-open-m')?.after(phone);
    },
    // 받은 링크 오류 · 이어 쓰기는 쇼릴을 끊지 않고 글만 바꾼다.
    // 예시 · 의뢰서 덮개가 열리고 닫힐 때(app.mjs overlayState).
    pause(){hold=true;reelApi.suspend();},
    resume(){hold=false;warm(current);later();if(list[current]?.layer==='reel'&&!screening)reelApi.play();},
    update({resume,entryError,busy}={}){
      if(busy!==undefined){const send=$('[data-form="invite"] button[type=submit]');if(send){send.disabled=!!busy;send.querySelector('span').textContent=busy?t('확인하고 있어요'):t('열기',null,'open');}}
      if(resume!==undefined)$$('[data-start-label]').forEach(node=>{node.textContent=startLabel(resume);});
      if(entryError!==undefined){
        host.classList.toggle('has-entry-error',!!entryError);
        const form=$('[data-entry-invite]');form.querySelector('.sx-invite-alert')?.remove();
        if(entryError){const box=document.createElement('div');box.className='sx-invite-alert';box.setAttribute('role','alert');const title=document.createElement('strong');title.textContent=entryError.title;const text=document.createElement('p');text.textContent=entryError.text;box.append(title,text);form.prepend(box);markInvite(true);}
      }
    },
    unmount(){
      document.documentElement.classList.remove('view-entry');
      gone=true;clearTimeout(idleTimer);if(onLoad)removeEventListener('load',onLoad);
      observer?.disconnect();clearInterval(checkTimer);clearTimeout(wheelIdle);cancelAnimationFrame(cursorRaf);
      removeEventListener('keydown',onKey);if(onPointer)removeEventListener('pointermove',onPointer);
      screening?.close();reelApi.stop();
    },
  };
}

// 완성 광고 칸: 이름에 손을 올리면 오른쪽 스크린이 그 작품으로, 누르면 소리와 함께 상영한다.
// 앱은 화면을 그릴 때마다 부른다. 목록이 사라진 화면(다른 곳으로 옮김)에서는 그 목록에서 연 상영을 닫는다.
let listScreening=null;
export function mountFilmList(root){
  const host=root.querySelector('.sx-films');if(!host){listScreening?.close();return;}
  const poster=host.querySelector('[data-film-poster]');
  const show=row=>{const film=filmOf(row.dataset.filmOpen);if(poster&&film?.poster&&poster.getAttribute('src')!==film.poster)poster.src=film.poster;host.querySelectorAll('.sx-film-row').forEach(item=>item.classList.toggle('is-on',item===row));};
  host.querySelectorAll('.sx-film-row').forEach(row=>{row.addEventListener('pointerenter',()=>show(row));row.addEventListener('focus',()=>show(row));row.addEventListener('click',()=>{listScreening?.close();listScreening=openScreening(filmOf(row.dataset.filmOpen),{onClose:()=>{listScreening=null;}});});});
}
