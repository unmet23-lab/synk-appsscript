import {esc} from './api.mjs';

// 완성 광고(2026-10-22 유호님 결정): 모델별 참고 영상을 거두고, SYNK가 처음부터 끝까지 만든 광고만 모델과 따로 이 공간에 모은다.
// 아직 완성되지 않은 작품은 칸을 두지 않는다(「곧 공개」 없음). 새 작품을 더할 때:
//   ① 포스터 webp와 영상 mp4를 public/pulse-app/assets/films/에 둔다(mp4는 .gitignore라 git 밖 — 운영 원문은 회사 릴리스 후보).
//      1분 안쪽 작품은 발췌 없이 본편(full)만 두고 카드에서 바로 튼다. 긴 작품은 발췌를 카드에서 틀고 본편은 새 탭으로 연다.
//   ② server.mjs 공개 파일 목록에 그 파일들을 더한다. ③ 아래 FINISHED_FILMS에 한 칸을 더한다(주소는 아래 규칙만 받는다).
// 화성 세 편(10-22 더함)은 「2026 별별화성 Awards」 제출본의 720p 웹판이다. 공모 요건으로 끝에 붙인 출처 카드(제작 도구 이름)는
// 앞 로고 장면을 그 길이만큼 이어 보여 대신했고 소리는 제출본 그대로다(CF 1224장째·숏폼 854장째부터, CM송은 소리가 끝난 1229장째에서 끊음).
// 공공누리·통계 출처는 카드 글(credits)로 옮겼다 — 사이트에는 제작 도구 이름을 쓰지 않는다(2026-10-02).
// 갱스터 뮤직비디오는 10-17 모델 칸에 먼저 붙였던 주소(assets/casting/video/) 그대로 둔다 — 2026-10-13 승인 2K 원본(198.333초)에서
// 포스터 1995장째, 발췌 4602~5205장째를 잘랐다.
const HWASEONG_ENTRY='2026 별별화성 Awards(화성특례시 공모전)',HWASEONG_MARK='로고·슬로건 화성특례시 「화성의 상징」(공공누리 제4유형)';
export const FINISHED_FILMS=Object.freeze([
  {
    id:'hwaseong-light',kind:'ad',title:'1억 년의 빛',
    poster:'./assets/films/hwaseong-cf-light-poster-v1.webp',
    full:{src:'./assets/films/hwaseong-cf-light-v1.mp4',duration:'55초'},
    description:'1억 년 전 공룡알에서 오늘 107만 시민의 불빛까지, 화성의 시간과 사람을 둥근 빛 하나로 이은 도시 광고예요.',
    entry:HWASEONG_ENTRY,finished:'2026년 10월',credits:[HWASEONG_MARK],
  },
  {
    id:'hwaseong-first',kind:'short',title:'화성에서 처음',orientation:'portrait',
    poster:'./assets/films/hwaseong-short-first-poster-v1.webp',
    full:{src:'./assets/films/hwaseong-short-first-v1.mp4',duration:'40초'},
    description:'바다가 내준 길을 처음 걸어 본 곳, 포도를 처음 밟아 본 곳. 화성에서 「처음」을 만든 이웃들의 이야기예요. 화성 시민 15명 중 1명은 다른 나라에서 왔어요.',
    entry:HWASEONG_ENTRY,finished:'2026년 10월',credits:[HWASEONG_MARK,'통계 화성시 인구현황(2026년 9월, 외국인 포함)'],
  },
  {
    id:'hwaseong-koriyo',kind:'song',title:'코리요와 화성 한 바퀴',
    poster:'./assets/films/hwaseong-cm-song-poster-v1.webp',
    full:{src:'./assets/films/hwaseong-cm-song-v1.mp4',duration:'51초'},
    description:'1억 년 잠에서 깬 코리요와 케이블카를 타고 바닷길, 궁평항 노을, 정조의 솔숲, 송산 포도, 동탄 호수를 한 바퀴 도는 CM송이에요.',
    entry:HWASEONG_ENTRY,finished:'2026년 10월',credits:['캐릭터 코리요 · 화성특례시(공공누리 제1유형)',HWASEONG_MARK],
  },
  {
    id:'happy-happy-gangster',kind:'music-video',title:'Happy, Happy Gangster',
    poster:'./assets/casting/video/M03-mv-happy-gangster-poster-v1.webp',
    excerpt:{src:'./assets/casting/video/M03-mv-happy-gangster-excerpt-20s-v1.mp4',duration:'20초'},
    full:{src:'./assets/casting/video/M03-mv-happy-gangster-full-v1.mp4',duration:'3분 18초'},
    description:'SYNK가 처음부터 끝까지 만든 뮤직비디오예요. 장면과 옷이 계속 바뀌어도 3분 18초 내내 같은 얼굴로 이어져요. 여기서는 20초를 먼저 보여 드려요.',
    cast:'유호 · M03',finished:'2026년 10월',
  },
]);
const KINDS={'music-video':'뮤직비디오',ad:'광고',short:'숏폼',song:'CM송',film:'브랜드 필름'};
const media=(value,extension)=>typeof value==='string'&&new RegExp(`^\\./assets/(?:films|casting/video)/[A-Za-z0-9_-]+\\.${extension}$`).test(value)?value:'';
function filmCard(film){
  const poster=media(film?.poster,'webp'),excerpt=media(film?.excerpt?.src,'mp4'),full=media(film?.full?.src,'mp4');
  if(!excerpt&&!full)return '';
  const title=esc(film.title),heading='film-'+esc(String(film.id||'').replace(/[^a-z0-9-]/g,'')),portrait=film.orientation==='portrait';
  const facts=[[excerpt?'본편':'길이',full?film.full.duration:''],['출연',film.cast],['출품',film.entry],['완성',film.finished]].filter(([,value])=>value);
  const credits=(Array.isArray(film.credits)?film.credits:[]).filter(value=>typeof value==='string'&&value);
  const label=excerpt?`${title} · ${esc(film.excerpt.duration||'')} 발췌`:`${title}${film.full.duration?' · '+esc(film.full.duration):''}`;
  // 재생 중인 영상은 실시간 갱신이 화면을 다시 그리지 않게 data-film-player로 표시한다(app.mjs canApplyRemote).
  return `<article class="film-card${portrait?' film-card--portrait':''}" aria-labelledby="${heading}"><div class="film-media"><video controls playsinline preload="none" data-film-player${poster?` poster="${esc(poster)}"`:''} src="${esc(excerpt||full)}" aria-label="${label}"></video></div><div class="film-copy"><span class="eyebrow ko">${esc(KINDS[film.kind]||'광고')}</span><h2 id="${heading}">${title}</h2>${film.description?`<p>${esc(film.description)}</p>`:''}${facts.length?`<dl class="film-facts">${facts.map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>`:''}${credits.length?`<div class="film-credits"><span>출처</span><ul>${credits.map(value=>`<li>${esc(value)}</li>`).join('')}</ul></div>`:''}${excerpt&&full?`<a class="film-full" href="${esc(full)}" target="_blank" rel="noopener noreferrer">본편 보기${film.full.duration?' · '+esc(film.full.duration):''} <span aria-hidden="true">↗</span><span class="sr-only"> (새 탭)</span></a>`:''}</div></article>`;
}
// 보일 작품이 하나도 없으면 레일 항목도 두지 않는다(views.mjs).
export const hasFinishedFilms=(films=FINISHED_FILMS)=>films.some(film=>filmCard(film));
export function filmsView(films=FINISHED_FILMS){return `<div class="film-list">${films.map(filmCard).join('')}</div>`;}
