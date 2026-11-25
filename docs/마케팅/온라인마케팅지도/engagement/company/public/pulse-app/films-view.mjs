import {esc} from './api.mjs';
import {t,k} from './i18n.mjs';

// 완성 광고(2026-10-22 결정): 모델별 참고 영상을 거두고, SYNK가 처음부터 끝까지 만든 광고만 모델과 따로 이 공간에 모은다.
// 아직 완성되지 않은 작품은 칸을 두지 않는다(「곧 공개」 없음). 새 작품을 더할 때:
//   ① 포스터 webp와 영상 mp4를 public/pulse-app/assets/films/에 둔다(mp4는 .gitignore라 git 밖 — 운영 원문은 회사 릴리스 후보).
//      1분 안쪽 작품은 발췌 없이 본편(full)만 두고 카드에서 바로 튼다. 긴 작품은 발췌를 카드에서 틀고 본편은 새 탭으로 연다.
//   ② server.mjs 공개 파일 목록에 그 파일들을 더한다. ③ 아래 FINISHED_FILMS에 한 칸을 더한다(주소는 아래 규칙만 받는다).
// 2026-11-26 남길 작품만 둔다(차례는 synk.im 홈 앨범과 같다): 「다리가 기억하는 것」(서울로미디어캔버스 단편 애니메이션 공모 당선작) · 오팔린 「시스루」(AI 아이돌 뮤직비디오) · 도담중공업.
// 내린 작품은 docs/마케팅/PULSE_포트폴리오_제작준비_20261012/진열/작품.json의 down에 있다(파일은 그대로 두고 서버 공개 목록에서만 뺐다).
// featured는 첫 화면 쇼릴(film-home.mjs REEL)에 나오는 편과 같다. 새 영상 · 포스터는 굽기.cjs가 최종본에서 만들고 메타데이터를 비운다.
// 「다리가 기억하는 것」은 2000 × 550 아주 넓은 작품(orientation 'pano')이라 어느 칸에서도 자르지 않는다 — 본편은 소리 있는 자막 판을 원본 크기 그대로 구웠다(굽기.cjs app).
// 다국어 판 2: 손님 길(첫 화면 · 완성 광고 목록 · 방향 화면의 비슷한 작품)에 보이는 이름 · 한 줄 · 길이 · 구분은 원문을 k로 표시하고
// 보일 때 filmTitle · filmLine · filmNote가 그 언어로 옮긴다. 설명 · 출품 · 출처 · 완성 달 · 출연은 옛 탭 카드(filmCard)에만 보여 한국어로 둔다.
const SELF_MADE=k('가상 브랜드로 만든 자체 작품');
export const FINISHED_FILMS=Object.freeze([
  {
    id:'seoullo-bridge',kind:'animation',title:k('다리가 기억하는 것'),orientation:'pano',featured:true,line:k('단편 애니메이션 · 2분 58초'),
    poster:'./assets/films/seoullo-bridge-poster-v1.webp',
    full:{src:'./assets/films/seoullo-bridge-v1.mp4',duration:k('2분 58초')},
    description:'1970년에 서울에 온 할머니가 손주와 서울로7017을 걸으며, 찻길이던 서울역 고가도로가 걷는 길로 다시 태어나기까지를 들려주는 단편 애니메이션이에요. 모든 장면을 털실과 펠트로 만든 작은 인형 마을처럼 지었어요. 2026년 12월부터 2027년 2월까지 서울로미디어캔버스에서 전시돼요.', // i18n-skip
    entry:'2026 서울로미디어캔버스 단편 애니메이션 공모',origin:k('공모전 당선작'),finished:'2026년 11월', // i18n-skip
  },
  {
    id:'opalin-seethrough',kind:'music-video',title:k('시스루'),featured:true,line:k('오팔린 · 3분 27초'),
    poster:'./assets/films/opalin-seethrough-poster-v1.webp',
    full:{src:'./assets/films/opalin-seethrough-v1.mp4',duration:k('3분 27초')},
    description:'AI 아이돌 오팔린의 뮤직비디오예요. 들판에 선 문 하나에서 시작해, AI라는 사실을 감추지 않겠다는 약속을 노래해요.', // i18n-skip
    cast:'윤슬 · 로하 · 새봄 · 해인',origin:k('AI 아이돌 뮤직비디오'),finished:'2026년 11월', // i18n-skip
  },
  {
    id:'dodam-heavy',kind:'film',title:k('이 아이를 보냅니다'),featured:true,line:k('도담중공업 · 1분 1초'),
    poster:'./assets/films/dodam-heavy-poster-v1.webp',
    full:{src:'./assets/films/dodam-heavy-v1.mp4',duration:k('1분 1초')},
    description:'발전용 가스터빈 한 대가 공장을 떠나는 날을, 아이를 떠나보내는 마음으로 따라간 기업 홍보영상이에요. 가상 제조사 「도담중공업」의 규모와 신뢰를 한 사람의 시선으로 보여 줘요.', // i18n-skip
    cast:'준호',origin:SELF_MADE,finished:'2026년 11월', // i18n-skip
  },
]);
// 시사실 판(2026-11-05)의 크레딧 한 줄. 자료에 없으면 길이만 쓴다. 이름 · 한 줄 · 구분은 지금 언어로(한국어는 원문 그대로).
export const filmTitle=film=>t(film?.title||'');
export const filmLine=film=>t(film?.line||film?.full?.duration||'');
export const filmNote=film=>film?.origin?t(film.origin):film?.entry?t('공모전 출품작'):'';
// i18n-skip-start
// 여기부터 옛 탭(완성 광고 카드)과 옛 첫 화면 칸 — 한국어로 둔다(손님 길 판 2 범위 밖).
const KINDS={'music-video':'뮤직비디오',ad:'광고',short:'숏폼',song:'CM송',film:'브랜드 필름',animation:'단편 애니메이션'};
const media=(value,extension)=>typeof value==='string'&&new RegExp(`^\\./assets/(?:films|casting/video)/[A-Za-z0-9_-]+\\.${extension}$`).test(value)?value:'';
function filmCard(film){
  const poster=media(film?.poster,'webp'),excerpt=media(film?.excerpt?.src,'mp4'),full=media(film?.full?.src,'mp4');
  if(!excerpt&&!full)return '';
  const title=esc(film.title),heading='film-'+esc(String(film.id||'').replace(/[^a-z0-9-]/g,'')),portrait=film.orientation==='portrait',pano=film.orientation==='pano';
  const facts=[[excerpt?'본편':'길이',full?film.full.duration:''],['출연',film.cast],['구분',film.origin],['출품',film.entry],['완성',film.finished]].filter(([,value])=>value);
  const credits=(Array.isArray(film.credits)?film.credits:[]).filter(value=>typeof value==='string'&&value);
  const label=excerpt?`${title} · ${esc(film.excerpt.duration||'')} 발췌`:`${title}${film.full.duration?' · '+esc(film.full.duration):''}`;
  // 재생 중인 영상은 실시간 갱신이 화면을 다시 그리지 않게 data-film-player로 표시한다(app.mjs canApplyRemote).
  return `<article class="film-card${portrait?' film-card--portrait':''}${pano?' film-card--pano':''}" aria-labelledby="${heading}"><div class="film-media"><video controls playsinline preload="none" data-film-player${poster?` poster="${esc(poster)}"`:''} src="${esc(excerpt||full)}" aria-label="${label}"></video></div><div class="film-copy"><span class="eyebrow ko">${esc(KINDS[film.kind]||'광고')}</span><h2 id="${heading}">${title}</h2>${film.description?`<p>${esc(film.description)}</p>`:''}${facts.length?`<dl class="film-facts">${facts.map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>`:''}${credits.length?`<div class="film-credits"><span>출처</span><ul>${credits.map(value=>`<li>${esc(value)}</li>`).join('')}</ul></div>`:''}${excerpt&&full?`<a class="film-full" href="${esc(full)}" target="_blank" rel="noopener noreferrer">본편 보기${film.full.duration?' · '+esc(film.full.duration):''} <span aria-hidden="true">↗</span><span class="sr-only"> (새 탭)</span></a>`:''}</div></article>`;
}
// 보일 작품이 하나도 없으면 레일 항목도 두지 않는다(views.mjs).
export const hasFinishedFilms=(films=FINISHED_FILMS)=>films.some(film=>filmCard(film));
export function filmsView(films=FINISHED_FILMS){return `<div class="film-list">${films.map(filmCard).join('')}</div>`;}
// 첫 화면의 완성작 칸: 같은 영상을 더 작은 칸으로 — 세로 작품은 좁은 칸, 가로 작품은 넓은 칸에 놓는다.
function featuredFilm(film){
  const poster=media(film?.poster,'webp'),full=media(film?.full?.src,'mp4');if(!full)return '';
  return `<article class="welcome-work${film.orientation==='portrait'?' welcome-work--portrait':''}${film.orientation==='pano'?' welcome-work--pano':''}"><video controls playsinline preload="none" data-film-player${poster?` poster="${esc(poster)}"`:''} src="${esc(full)}" aria-label="${esc(film.title)}${film.full.duration?' · '+esc(film.full.duration):''}"></video><h3>${esc(film.title)}</h3>${film.description?`<p>${esc(film.description)}</p>`:''}</article>`;
}
export function featuredFilmsView(films=FINISHED_FILMS){return `<div class="welcome-work-grid">${films.filter(film=>film.featured).map(featuredFilm).join('')}</div>`;}
// i18n-skip-end
