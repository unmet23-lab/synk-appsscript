// 유호님께 보이는 움직이는 시안. 서버 없이 도는 예시 자료만 쓴다(고객 앱의 실제 모듈 그대로).
// 내부 확인 · 바뀐 점은 시안에서만 보인다. 손님 예시(?demo=film)에는 싣지 않는다.
import {mountFilmDemo,DEMO_FILES,DEMO_BRIEF} from './demo-film.mjs';
import {entryView,mountEntry} from './film-views.mjs';
import {deskView} from './desk-view.mjs';
import {revealWords,riseAll} from './motion.mjs';

const DESK={number:'P-1104-7F3A',at:'11월 4일 오전 5:12',title:'오미톡 오미자 스파클링 15초',contact:'김합성 · 합성 음료',brief:DEMO_BRIEF,files:DEMO_FILES,
  queue:[{title:'오미톡 15초',meta:'음료 · 릴스 · 오늘 05:12',state:'새 의뢰',tone:'is-new'},{title:'더밸런스 필라테스 30초',meta:'공간 · 인스타 · 어제',state:'답을 기다려요'},{title:'유리결 홀리데이 세트 15초',meta:'뷰티 · 인스타 · 11월 2일',state:'1차안 준비 중'}],
  checks:[{ok:true,label:'제품 정면 · 옆면 사진을 받았어요',note:'3024 × 4032, 가까이 찍는 컷에도 충분해요.'},{ok:false,label:'로고 파일이 없어요',note:'끝 화면 때문에 다시 여쭤요.'},{ok:false,label:'화면 글자에 사실 확인이 필요해요',note:'「11월 편의점 출시」가 확정인지 물어봐요.'},{ok:true,label:'피할 말과 화면 글자가 부딪치지 않아요'}],
  note:{by:'Claude',at:'05:16',summary:'음료 15초 세로, 이기는 쪽은 임팩트. 한결이 잘 맞아요. 로고만 받으면 바로 글 콘티에 들어갈 수 있어요.',lines:['운동 끝 첫 모금, 다섯 가지 맛이 톡.','한 캔에 다섯 번, 맛이 바뀐다.','땀 끝에 톡, 오미톡.'],model:'한결 — 「청량한 운동부 후배」, 음료 · 러닝 쪽 쓰임이 명세서와 같아요.',ref:'반응이 좋았던 음료 15초 셋을 재어 뼈대 후보를 골랐어요. 고르는 것은 유호님 몫이에요.',risks:['캔을 따는 손가락 동작은 피하고 따는 소리와 딴 직후 그림으로 가요.','라벨 글자가 읽히는 컷은 멈춘 컷에만 둬요.']}};

const FLOW=[
  ['클라이언트가 의뢰','첫 화면에서 바로 「광고 의뢰하기」','담당자에게 받은 링크를 넣는 칸뿐이었어요','entry'],
  ['준비할 것 · 필요한 것 작성','아홉 화면, 꼭 받는 칸 약 12개. 쓰는 동안 오른쪽 화면이 바로 바뀌어요','다섯 군데에서 50칸 넘게 물었어요','request'],
  ['너와 내가 내용 확인','자동 점검 → Claude 1차 확인 → 유호님 판단. 빠진 칸만 다시 물어요','확인하는 자리가 없었어요','desk'],
  ['1차 전달 후 수정','모델 → 글 콘티 → 컷마다 장면 이미지. 컷마다 의견을 모아 보내요','작은 카드 속 그림에 의견을 남겼어요','model'],
  ['제작','확인한 컷으로만 만들어요. 영상 확인 · 납품은 지금 화면에 새 옷을 입혀요','기능은 그대로예요',''],
];
const COMPARE=[
  ['첫 화면','d-app-entry.jpg','after-entry.jpg'],
  ['맡길 내용 쓰기','d-demo-strategy.jpg','after-request.jpg'],
  ['1차안 보기','d-demo-storyboard.jpg','after-draft.jpg'],
];
const KEEP=[
  ['올릴 곳 → 화면 비율','용도가 어긋나면 통째로 다시 만들어요'],
  ['제품 원본 사진 · 로고 파일','글자와 로고가 틀리는 사고를 막아요. 올리는 자리에서 해상도를 바로 봐요'],
  ['쓰는 모습 한 줄 · 크기','손 동작을 잘못 그려 다시 뽑는 일을 줄여요'],
  ['화면에 나올 정확한 글자','문구가 바뀌면 다시 편집해야 해요. 쓰는 대로 화면에 얹어 보여요'],
  ['피할 말','업종별 후보를 꺼내 드려요. 효능 표현 재작업을 막아요'],
  ['무엇으로 이길지','이야기냐 임팩트냐가 콘티 방식까지 정해요. 실제 작품으로 고르게 해요'],
  ['참고 광고 + 어디가 좋았나','링크만 받으면 제작자가 추측해요. 좋았던 부분까지 고르게 해요'],
  ['최종 확인자','새로 넣었어요. 완성 뒤에 다른 사람이 뒤집는 일을 막아요'],
];
const DROP=[
  ['성과 지표 · 목표 · 기간 · 기준 · 출처','제작에 쓰이지 않아요'],
  ['보조 가치 · 근거 3쌍','15~30초에 들어가지 않아요. 「자랑할 사실」 한 칸으로 줄였어요'],
  ['예산 3칸 · 상담 구성','값이 정해져 있어 필요 없어요'],
  ['색감 · 구도 · 의상 · 목소리 글','글로 쓰기 어려워요. 참고 광고와 모델로 대신해요'],
  ['납품 규격표 10칸','올릴 곳을 보고 저희가 채우고, 손님은 확인만 해요'],
];
function whyView(){
  return `<div class="why"><header class="why-head"><p class="mono">WHAT CHANGED</p><h1 data-why-title>지금과 무엇이
달라지나요</h1></header>
    <section class="why-part" data-why-in><h2>말씀하신 흐름 그대로예요</h2><div class="why-flow">${FLOW.map(([step,after,before,scene],i)=>`<article><span class="mono">${String(i+1).padStart(2,'0')}</span><h3>${step}</h3><p class="why-after">${after}</p><p class="why-before">지금: ${before}</p>${scene?`<a class="btn-text" href="#${scene}">화면 보기</a>`:''}</article>`).join('')}</div></section>
    <section class="why-part" data-why-in><h2>지금 화면과 나란히</h2><div class="why-compare">${COMPARE.map(([label,before,after])=>`<figure><figcaption>${label}</figcaption><div><span><img src="./before/${before}" alt="지금 화면: ${label}" loading="lazy"><small>지금</small></span><span><img src="./before/${after}" alt="새 화면: ${label}" loading="lazy"><small>새 판</small></span></div></figure>`).join('')}</div></section>
    <section class="why-part" data-why-in><h2>받는 정보 — 작업에 실제로 쓰이는 것만</h2><p class="why-note">기준은 제작 규칙의 브리프 한 장, 오미톡 리허설에서 시간이 샌 자리, 제작자 · 손님 후기예요. 실제 주문이 없어서 시간이 얼마나 줄지는 아직 가설이고, 첫 주문부터 재요.</p><div class="why-cols"><div><h3>받아요 <span class="mono">KEEP</span></h3><dl>${KEEP.map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl></div><div><h3>뺐어요 <span class="mono">DROP</span></h3><dl>${DROP.map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl></div></div></section>
  </div>`;
}
mountFilmDemo(document.getElementById('app'),{internal:true,start:location.hash.slice(1)||'entry',extra:[
  {id:'entry',label:'첫 화면',render(root,go){root.innerHTML=entryView({demoHref:'#room'});mountEntry(root,{onStart:()=>go('request'),onInvite:()=>go('room')});}},
  {id:'desk',label:'내부 확인',render(root){root.innerHTML=deskView({...DESK,links:false,confirmed:false});}},
  {id:'why',label:'바뀐 점',render(root){root.innerHTML=whyView();revealWords(root.querySelector('[data-why-title]'),{delay:80});riseAll(root.querySelectorAll('[data-why-in]'),{start:200,gap:80});}},
]});
