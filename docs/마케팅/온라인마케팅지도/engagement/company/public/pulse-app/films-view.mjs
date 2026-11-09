import {esc} from './api.mjs';
import {t,k} from './i18n.mjs';

// 완성 광고(2026-10-22 결정): 모델별 참고 영상을 거두고, SYNK가 처음부터 끝까지 만든 광고만 모델과 따로 이 공간에 모은다.
// 아직 완성되지 않은 작품은 칸을 두지 않는다(「곧 공개」 없음). 새 작품을 더할 때:
//   ① 포스터 webp와 영상 mp4를 public/pulse-app/assets/films/에 둔다(mp4는 .gitignore라 git 밖 — 운영 원문은 회사 릴리스 후보).
//      1분 안쪽 작품은 발췌 없이 본편(full)만 두고 카드에서 바로 튼다. 긴 작품은 발췌를 카드에서 틀고 본편은 새 탭으로 연다.
//   ② server.mjs 공개 파일 목록에 그 파일들을 더한다. ③ 아래 FINISHED_FILMS에 한 칸을 더한다(주소는 아래 규칙만 받는다).
// 霜の肌理(11-06 옛 이름 유리결에서 바꿈) · 매진 임박(11-04 더함, 소개글 1절의 완성작 둘 — 첫 화면에도 featured로 보인다): 霜の肌理는 대표작 5.1판 웹판 그대로(결정 11-01, 11-06 일본어 라벨 판으로 바이트만 바꿈 — 회사 판은 부모 파일을 못 지워 id · 파일 이름은 옛 로마자 그대로), 매진 임박은 11-04 최종 16:9에서 720p로 만들었다. 두 파일 모두 만든 도구 표시(메타데이터)는 뺐다.
// 화성 세 편(10-22 더함)은 「2026 별별화성 Awards」 제출본의 720p 웹판이다. 공모 요건으로 끝에 붙인 출처 카드(제작 도구 이름)는
// 앞 로고 장면을 그 길이만큼 이어 보여 대신했고 소리는 제출본 그대로다(CF 1224장째·숏폼 854장째부터, CM송은 소리가 끝난 1229장째에서 끊음).
// 공공누리·통계 출처는 카드 글(credits)로 옮겼다 — 사이트에는 제작 도구 이름을 쓰지 않는다(2026-10-02).
// 갱스터 뮤직비디오는 10-17 모델 칸에 먼저 붙였던 주소(assets/casting/video/) 그대로 둔다 — 2026-10-13 승인 2K 원본(198.333초)에서
// 포스터 1995장째, 발췌 4602~5205장째를 잘랐다.
// 2026-11-09 최신화(docs/마케팅/PULSE_포트폴리오_제작준비_20261012/진열 — 완성본 판정 표 · 작품.json · 굽기.cjs app):
// 확정 · 맹검 통과 판만 싣고(기각 · 다시 만드는 편 · 판정 전인 편은 뺌) 잘 나온 차례로 둔다.
// featured 넷은 첫 화면 쇼릴(film-home.mjs REEL)에 나오는 편과 같다. 새 영상 · 포스터는 굽기.cjs가 최종본에서 720p로 만들고 메타데이터를 비운다.
// 매진 임박은 11-05에 다시 구운 1분 15초 판으로 바이트를 바꿨다(이름 그대로). 霜の肌理의 「대표작」 꼬리표는 차례를 바꾸며 뗐다.
// 다국어 판 2: 손님 길(첫 화면 · 완성 광고 목록 · 방향 화면의 비슷한 작품)에 보이는 이름 · 한 줄 · 길이 · 구분은 원문을 k로 표시하고
// 보일 때 filmTitle · filmLine · filmNote가 그 언어로 옮긴다. 설명 · 출품 · 출처 · 완성 달 · 출연은 옛 탭 카드(filmCard)에만 보여 한국어로 둔다.
const HWASEONG_ENTRY='2026 별별화성 Awards(화성특례시 공모전)',HWASEONG_MARK='로고·슬로건 화성특례시 「화성의 상징」(공공누리 제4유형)'; // i18n-skip
const SELF_MADE=k('가상 브랜드로 만든 자체 작품');
export const FINISHED_FILMS=Object.freeze([
  {
    id:'dodam-heavy',kind:'film',title:k('이 아이를 보냅니다'),featured:true,line:k('도담중공업 · 1분 1초'),
    poster:'./assets/films/dodam-heavy-poster-v1.webp',
    full:{src:'./assets/films/dodam-heavy-v1.mp4',duration:k('1분 1초')},
    description:'발전용 가스터빈 한 대가 공장을 떠나는 날을, 아이를 떠나보내는 마음으로 따라간 기업 홍보영상이에요. 가상 제조사 「도담중공업」의 규모와 신뢰를 한 사람의 시선으로 보여 줘요.', // i18n-skip
    cast:'준호',origin:SELF_MADE,finished:'2026년 11월', // i18n-skip
  },
  {
    id:'omitok-court',kind:'ad',title:k('치익이 톡이 될 때까지'),orientation:'portrait',featured:true,line:k('오미톡 · 15초'),
    poster:'./assets/films/omitok-court-poster-v1.webp',
    full:{src:'./assets/films/omitok-court-v1.mp4',duration:k('15초')},
    description:'농구 코트에 뻗은 청년이 오미자 탄산 한 캔에 살아나는 15초 세로 광고예요. 한 모금마다 바뀌는 얼굴로 다섯 가지 맛을 보여 줘요.', // i18n-skip
    cast:'한결',origin:SELF_MADE,finished:'2026년 11월', // i18n-skip
  },
  {
    id:'maejin-imbak',kind:'ad',title:k('매진 임박'),featured:true,line:k('홈쇼핑 × 공포 코미디'),
    poster:'./assets/films/maejin-imbak-poster-v1.webp',
    full:{src:'./assets/films/maejin-imbak-v1.mp4',duration:k('1분 15초')},
    description:'공포 영화 같은 밤에 홈쇼핑 방송이 끼어드는 코미디 광고예요. 이야기로 끝까지 보게 만들었어요.', // i18n-skip
    origin:SELF_MADE,finished:'2026년 11월', // i18n-skip
  },
  {
    id:'modu-course',kind:'ad',title:k('가는 데마다 또 그 사람'),orientation:'portrait',featured:true,line:k('모두의코스 · 39초'),
    poster:'./assets/films/modu-course-poster-v1.webp',
    full:{src:'./assets/films/modu-course-v1.mp4',duration:k('39초')},
    description:'제주 2박 3일, 가는 데마다 같은 사람이 나타나는 세로 광고예요. 마지막 한 장면에서 그 까닭이 가상 여행 코스 앱 「모두의코스」로 풀려요.', // i18n-skip
    cast:'유호',origin:SELF_MADE,finished:'2026년 11월', // i18n-skip
  },
  {
    id:'somchae-room',kind:'ad',title:k('연말 빈방'),line:k('솜채 · 1분'),
    poster:'./assets/films/somchae-room-poster-v1.webp',
    full:{src:'./assets/films/somchae-room-v1.mp4',duration:k('1분')},
    description:'딸의 방문 앞에서 보낸 엄마의 한 해를 같은 자리에서 지켜본 연말 광고예요. 가상 침구 브랜드 「솜채」의 이야기예요.', // i18n-skip
    cast:'은정 · 지유',origin:SELF_MADE,finished:'2026년 11월', // i18n-skip
  },
  {
    id:'cheombeong-dang',kind:'ad',title:k('첨벙댕'),orientation:'portrait',line:k('반려견 구명조끼 · 26초'),
    poster:'./assets/films/cheombeong-dang-poster-v1.webp',
    full:{src:'./assets/films/cheombeong-dang-v1.mp4',duration:k('26초')},
    description:'외계인을 닮은 개가 반려견 구명조끼 「첨벙댕」을 입고 우주까지 가는, 말이 안 되게 밀어붙인 B급 광고예요.', // i18n-skip
    origin:SELF_MADE,finished:'2026년 11월', // i18n-skip
  },
  {
    id:'yurigyeol-holiday',kind:'ad',title:'霜の肌理',orientation:'portrait',line:k('홀리데이 기프트 · 15초'),
    poster:'./assets/films/yurigyeol-holiday-poster-v1.webp',
    full:{src:'./assets/films/yurigyeol-holiday-v1.mp4',duration:k('15초')},
    description:'가상 스킨케어 브랜드 「霜の肌理」의 홀리데이 세트를 서리 결정이 자라는 장면으로 보여 주는 15초 광고예요. 한 장면의 임팩트로 기억에 남게 만들었어요.', // i18n-skip
    origin:SELF_MADE,finished:'2026년 11월', // i18n-skip
  },
  {
    id:'neujimak-sniper',kind:'ad',title:k('블프 스나이퍼'),line:k('느지막 · 33초'),
    poster:'./assets/films/neujimak-sniper-poster-v1.webp',
    full:{src:'./assets/films/neujimak-sniper-v1.mp4',duration:k('33초')},
    description:'자정 세일을 특수작전처럼 준비한 아빠가 정작 그 시각에 잠드는 블랙프라이데이 광고예요. 가상 쇼핑 앱 「느지막」은 선착순이 없다는 한 줄로 닫아요.', // i18n-skip
    cast:'준호',origin:SELF_MADE,finished:'2026년 11월', // i18n-skip
  },
  {
    id:'himkkeot-sale',kind:'ad',title:k('오늘 자정까지 70%'),orientation:'portrait',line:k('힘껏 · 15초'),
    poster:'./assets/films/himkkeot-sale-poster-v1.webp',
    full:{src:'./assets/films/himkkeot-sale-v1.mp4',duration:k('15초')},
    description:'첫 1초에 「오늘 자정까지 전 품목 70%」를 약속하고, 빛 터널을 달리며 가격이 떨어지는 블랙프라이데이 세일 광고예요. 가상 운동복 브랜드 「힘껏」이에요.', // i18n-skip
    cast:'채원',origin:SELF_MADE,finished:'2026년 11월', // i18n-skip
  },
  {
    id:'castingbook-intro',kind:'ad',title:k('손님을 부르는 모델'),line:k('캐스팅북 · 30초'),
    poster:'./assets/films/castingbook-intro-poster-v1.webp',
    full:{src:'./assets/films/castingbook-intro-v1.mp4',duration:k('30초')},
    description:'손님 없는 카페 사장이 캐스팅북에서 모델을 골라 포스터를 붙이고, 그 포스터를 보고 손님이 찾아오기까지를 담은 영상이에요.', // i18n-skip
    origin:k('SYNK PULSE 캐스팅북 소개 영상'),finished:'2026년 11월', // i18n-skip
  },
  {
    id:'omitok-pour',kind:'ad',title:k('오미톡'),orientation:'portrait',line:k('제품 광고 · 13초'),
    poster:'./assets/films/omitok-pour-poster-v1.webp',
    full:{src:'./assets/films/omitok-pour-v1.mp4',duration:k('13초')},
    description:'얼음 상자에서 꺼낸 캔이 잔으로 쏟아지고 얼음이 튀어 오르기까지, 사람 없이 제품과 물성만으로 끌고 가는 광고예요.', // i18n-skip
    origin:SELF_MADE,finished:'2026년 11월', // i18n-skip
  },
  {
    id:'hwaseong-light',kind:'ad',title:k('1억 년의 빛'),line:k('화성 CF · 55초'),
    poster:'./assets/films/hwaseong-cf-light-poster-v1.webp',
    full:{src:'./assets/films/hwaseong-cf-light-v1.mp4',duration:k('55초')},
    description:'1억 년 전 공룡알에서 오늘 107만 시민의 불빛까지, 화성의 시간과 사람을 둥근 빛 하나로 이은 도시 광고예요.', // i18n-skip
    entry:HWASEONG_ENTRY,finished:'2026년 10월',credits:[HWASEONG_MARK], // i18n-skip
  },
  {
    id:'hwaseong-first',kind:'short',title:k('화성에서 처음'),orientation:'portrait',
    poster:'./assets/films/hwaseong-short-first-poster-v1.webp',
    full:{src:'./assets/films/hwaseong-short-first-v1.mp4',duration:k('40초')},
    description:'바다가 내준 길을 처음 걸어 본 곳, 포도를 처음 밟아 본 곳. 화성에서 「처음」을 만든 이웃들의 이야기예요. 화성 시민 15명 중 1명은 다른 나라에서 왔어요.', // i18n-skip
    entry:HWASEONG_ENTRY,finished:'2026년 10월',credits:[HWASEONG_MARK,'통계 화성시 인구현황(2026년 9월, 외국인 포함)'], // i18n-skip
  },
  {
    id:'hwaseong-koriyo',kind:'song',title:k('코리요와 화성 한 바퀴'),
    poster:'./assets/films/hwaseong-cm-song-poster-v1.webp',
    full:{src:'./assets/films/hwaseong-cm-song-v1.mp4',duration:k('51초')},
    description:'1억 년 잠에서 깬 코리요와 케이블카를 타고 바닷길, 궁평항 노을, 정조의 솔숲, 송산 포도, 동탄 호수를 한 바퀴 도는 CM송이에요.', // i18n-skip
    entry:HWASEONG_ENTRY,finished:'2026년 10월',credits:['캐릭터 코리요 · 화성특례시(공공누리 제1유형)',HWASEONG_MARK], // i18n-skip
  },
  {
    id:'happy-happy-gangster',kind:'music-video',title:'Happy, Happy Gangster',
    poster:'./assets/casting/video/M03-mv-happy-gangster-poster-v1.webp',
    excerpt:{src:'./assets/casting/video/M03-mv-happy-gangster-excerpt-20s-v1.mp4',duration:k('20초')},
    full:{src:'./assets/casting/video/M03-mv-happy-gangster-full-v1.mp4',duration:k('3분 18초')},
    description:'SYNK가 처음부터 끝까지 만든 뮤직비디오예요. 장면과 옷이 계속 바뀌어도 3분 18초 내내 같은 모델로 이어져요. 여기서는 20초를 먼저 보여 드려요.', // i18n-skip
    cast:'유호 · M03',finished:'2026년 10월', // i18n-skip
  },
]);
// 시사실 판(2026-11-05)의 크레딧 한 줄. 자료에 없으면 길이만 쓴다. 이름 · 한 줄 · 구분은 지금 언어로(한국어는 원문 그대로).
export const filmTitle=film=>t(film?.title||'');
export const filmLine=film=>t(film?.line||film?.full?.duration||'');
export const filmNote=film=>film?.origin?t(film.origin):film?.entry?t('공모전 출품작'):'';
// i18n-skip-start
// 여기부터 옛 탭(완성 광고 카드)과 옛 첫 화면 칸 — 한국어로 둔다(손님 길 판 2 범위 밖).
const KINDS={'music-video':'뮤직비디오',ad:'광고',short:'숏폼',song:'CM송',film:'브랜드 필름'};
const media=(value,extension)=>typeof value==='string'&&new RegExp(`^\\./assets/(?:films|casting/video)/[A-Za-z0-9_-]+\\.${extension}$`).test(value)?value:'';
function filmCard(film){
  const poster=media(film?.poster,'webp'),excerpt=media(film?.excerpt?.src,'mp4'),full=media(film?.full?.src,'mp4');
  if(!excerpt&&!full)return '';
  const title=esc(film.title),heading='film-'+esc(String(film.id||'').replace(/[^a-z0-9-]/g,'')),portrait=film.orientation==='portrait';
  const facts=[[excerpt?'본편':'길이',full?film.full.duration:''],['출연',film.cast],['구분',film.origin],['출품',film.entry],['완성',film.finished]].filter(([,value])=>value);
  const credits=(Array.isArray(film.credits)?film.credits:[]).filter(value=>typeof value==='string'&&value);
  const label=excerpt?`${title} · ${esc(film.excerpt.duration||'')} 발췌`:`${title}${film.full.duration?' · '+esc(film.full.duration):''}`;
  // 재생 중인 영상은 실시간 갱신이 화면을 다시 그리지 않게 data-film-player로 표시한다(app.mjs canApplyRemote).
  return `<article class="film-card${portrait?' film-card--portrait':''}" aria-labelledby="${heading}"><div class="film-media"><video controls playsinline preload="none" data-film-player${poster?` poster="${esc(poster)}"`:''} src="${esc(excerpt||full)}" aria-label="${label}"></video></div><div class="film-copy"><span class="eyebrow ko">${esc(KINDS[film.kind]||'광고')}</span><h2 id="${heading}">${title}</h2>${film.description?`<p>${esc(film.description)}</p>`:''}${facts.length?`<dl class="film-facts">${facts.map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>`:''}${credits.length?`<div class="film-credits"><span>출처</span><ul>${credits.map(value=>`<li>${esc(value)}</li>`).join('')}</ul></div>`:''}${excerpt&&full?`<a class="film-full" href="${esc(full)}" target="_blank" rel="noopener noreferrer">본편 보기${film.full.duration?' · '+esc(film.full.duration):''} <span aria-hidden="true">↗</span><span class="sr-only"> (새 탭)</span></a>`:''}</div></article>`;
}
// 보일 작품이 하나도 없으면 레일 항목도 두지 않는다(views.mjs).
export const hasFinishedFilms=(films=FINISHED_FILMS)=>films.some(film=>filmCard(film));
export function filmsView(films=FINISHED_FILMS){return `<div class="film-list">${films.map(filmCard).join('')}</div>`;}
// 첫 화면의 완성작 칸: 같은 영상을 더 작은 칸으로 — 세로 작품은 좁은 칸, 가로 작품은 넓은 칸에 놓는다.
function featuredFilm(film){
  const poster=media(film?.poster,'webp'),full=media(film?.full?.src,'mp4');if(!full)return '';
  return `<article class="welcome-work${film.orientation==='portrait'?' welcome-work--portrait':''}"><video controls playsinline preload="none" data-film-player${poster?` poster="${esc(poster)}"`:''} src="${esc(full)}" aria-label="${esc(film.title)}${film.full.duration?' · '+esc(film.full.duration):''}"></video><h3>${esc(film.title)}</h3>${film.description?`<p>${esc(film.description)}</p>`:''}</article>`;
}
export function featuredFilmsView(films=FINISHED_FILMS){return `<div class="welcome-work-grid">${films.filter(film=>film.featured).map(featuredFilm).join('')}</div>`;}
// i18n-skip-end
