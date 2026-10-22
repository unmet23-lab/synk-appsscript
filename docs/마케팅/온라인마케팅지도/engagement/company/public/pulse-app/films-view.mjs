import {esc} from './api.mjs';

// 완성 광고(2026-10-22 유호님 결정): 모델별 참고 영상을 거두고, SYNK가 처음부터 끝까지 만든 광고만 모델과 따로 이 공간에 모은다.
// 아직 완성되지 않은 작품은 칸을 두지 않는다(「곧 공개」 없음). 새 작품을 더할 때:
//   ① 포스터 webp · 발췌 mp4 · 본편 mp4를 public/pulse-app/assets/films/에 둔다(mp4는 .gitignore라 git 밖 — 운영 원문은 회사 릴리스 후보).
//   ② server.mjs 공개 파일 목록에 그 세 파일을 더한다. ③ 아래 FINISHED_FILMS에 한 칸을 더한다(주소는 아래 규칙만 받는다).
// 갱스터 뮤직비디오는 10-17 모델 칸에 먼저 붙였던 주소(assets/casting/video/) 그대로 둔다 — 2026-10-13 승인 2K 원본(198.333초)에서
// 포스터 1995장째, 발췌 4602~5205장째를 잘랐다.
export const FINISHED_FILMS=Object.freeze([
  {
    id:'happy-happy-gangster',kind:'music-video',title:'Happy, Happy Gangster',
    poster:'./assets/casting/video/M03-mv-happy-gangster-poster-v1.webp',
    excerpt:{src:'./assets/casting/video/M03-mv-happy-gangster-excerpt-20s-v1.mp4',duration:'20초'},
    full:{src:'./assets/casting/video/M03-mv-happy-gangster-full-v1.mp4',duration:'3분 18초'},
    description:'SYNK가 처음부터 끝까지 만든 뮤직비디오예요. 장면과 옷이 계속 바뀌어도 3분 18초 내내 같은 얼굴로 이어져요. 여기서는 20초를 먼저 보여 드려요.',
    cast:'유호 · M03',finished:'2026년 10월',
  },
]);
const KINDS={'music-video':'뮤직비디오',ad:'광고',film:'브랜드 필름'};
const media=(value,extension)=>typeof value==='string'&&new RegExp(`^\\./assets/(?:films|casting/video)/[A-Za-z0-9_-]+\\.${extension}$`).test(value)?value:'';
function filmCard(film){
  const poster=media(film?.poster,'webp'),excerpt=media(film?.excerpt?.src,'mp4'),full=media(film?.full?.src,'mp4');
  if(!excerpt&&!full)return '';
  const title=esc(film.title),heading='film-'+esc(String(film.id||'').replace(/[^a-z0-9-]/g,'')),facts=[['본편',full?film.full.duration:''],['출연',film.cast],['완성',film.finished]].filter(([,value])=>value);
  // 재생 중인 발췌는 실시간 갱신이 화면을 다시 그리지 않게 data-film-player로 표시한다(app.mjs canApplyRemote).
  return `<article class="film-card" aria-labelledby="${heading}">${excerpt?`<div class="film-media"><video controls playsinline preload="none" data-film-player${poster?` poster="${esc(poster)}"`:''} src="${esc(excerpt)}" aria-label="${title} · ${esc(film.excerpt.duration||'')} 발췌"></video></div>`:''}<div class="film-copy"><span class="eyebrow ko">${esc(KINDS[film.kind]||'광고')}</span><h2 id="${heading}">${title}</h2>${film.description?`<p>${esc(film.description)}</p>`:''}${facts.length?`<dl class="film-facts">${facts.map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>`:''}${full?`<a class="film-full" href="${esc(full)}" target="_blank" rel="noopener noreferrer">본편 보기${film.full.duration?' · '+esc(film.full.duration):''} <span aria-hidden="true">↗</span><span class="sr-only"> (새 탭)</span></a>`:''}</div></article>`;
}
// 보일 작품이 하나도 없으면 레일 항목도 두지 않는다(views.mjs).
export const hasFinishedFilms=(films=FINISHED_FILMS)=>films.some(film=>filmCard(film));
export function filmsView(films=FINISHED_FILMS){return `<div class="film-list">${films.map(filmCard).join('')}</div>`;}
