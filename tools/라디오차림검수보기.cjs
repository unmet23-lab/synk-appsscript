'use strict';
// 검수용 화면: 기존 Loom 지면을 사용하며 원본 그림/송출 서버는 변경하지 않는다.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'docs/_ops/의상라디오검수_20260909');
const loom = require('./lib/loom.js');
const fonts = require('./lib/브랜드폰트.js');
const catalog = require('./lib/옷목록.js');
const data = Object.fromEntries(['까몽','몽글','마린'].map(DJ => [DJ, {
  의상: catalog.목록(DJ).filter(x => x.갈래 === '의상').map(x => x.이름),
  악세: catalog.목록(DJ).filter(x => x.갈래 === '악세').map(x => x.이름)
}]));
const expressions = ['기본','깜빡','눈웃음','궁금함','집중','안도','응원','놀람','인사'];
const script = `
const data=${JSON.stringify(data)};
let DJ='까몽',turn=0;
const $=id=>document.getElementById(id),frame=$('runtime');
const runtime=()=>frame.contentWindow;
function options(){for(const key of ['의상','악세']){const el=$(key);el.replaceChildren(...data[DJ][key].map(x=>new Option(x,x)));}if(DJ==='까몽'){$('의상').value='여름 델';$('악세').value='전설의 팻말';}}
async function selectDJ(name){++turn;DJ=name;options();for(const b of document.querySelectorAll('[data-dj]'))b.setAttribute('aria-pressed',String(b.dataset.dj===DJ));
 frame.src='../../../bots/오버레이/마스코트.html?검수=1&무대=1&밤=0&자리=중하&크기=.32&DJ='+encodeURIComponent(DJ);
 $('notice').textContent=DJ+' 기존 라디오 컷 확인 중. 의상·악세를 고르고 입히기를 누르세요.';
}
for(const b of document.querySelectorAll('[data-dj]'))b.onclick=()=>selectDJ(b.dataset.dj);
for(const b of document.querySelectorAll('[data-expression]'))b.onclick=()=>{try{const api=runtime().마스코트검수표정;if(api)api(b.dataset.expression||null);}catch(e){$('notice').textContent=e.message;}};
for(const b of document.querySelectorAll('[data-event]'))b.onclick=()=>{runtime().마스코트검수표정?.(null);runtime().마스코트반응?.(b.dataset.event);};
$('apply').onclick=async()=>{const seq=++turn;$('notice').textContent='선택한 세트의 그림을 확인하고 있습니다…';
 try{if(!runtime().마스코트차림)throw Error('라디오 선택 기능이 준비되지 않았습니다.');
 const result=await runtime().마스코트차림({DJ,의상:$('의상').value,악세:$('악세').value});
 if(seq===turn)$('notice').textContent=result?.ok===false?(result.오류||result.error||JSON.stringify(result)):'선택 처리 완료. 아래 실제 상태를 확인하세요. 검수후보는 방송 채택이 아닙니다.';
 }catch(e){if(seq===turn)$('notice').textContent='적용하지 않았습니다: '+e.message;}
};
$('genre').onclick=()=>runtime().마스코트반응?.({종류:'결',결:'전자밤도시'});
setInterval(()=>{const state=runtime().마스코트상태?.();if(state)$('state').textContent=JSON.stringify(state,null,2);},500);
options();
`;
const button = (attr,name) => `<button type="button" ${attr}>${name}</button>`;
const gallery = (title,files) => `<details class="entry"><summary>${title}</summary>${files.map(([file,caption])=>`<figure><a href="${file}"><img src="${file}" width="1120" loading="lazy" style="width:100%;height:auto" alt="${caption}"></a><figcaption>${caption}</figcaption></figure>`).join('')}</details>`;
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>세 캐릭터 · 라디오 착용 검수</title><style>${fonts.면()}${loom.계정컬렉션()}</style></head>
<body class="account-collection"><main class="collection-shell">
<header class="entry"><span class="kicker">SYNK · RADIO · 2026.09.09 · LOCAL QA</span><h1>라디오 착용·표정 검수</h1><p>원본을 보존한 로컬 검수 화면입니다. 그림 재고와 실제 구현을 구분합니다.</p></header>
<section><h2>라디오의 실제 표시 코드</h2><div class="filters">${['까몽','몽글','마린'].map(x=>button(`data-dj="${x}" aria-pressed="${x==='까몽'}"`,x)).join('')}</div>
<div class="filters"><label>의상 1벌 <select id="의상" class="download" aria-label="의상 1벌"></select></label><label>악세 1개 <select id="악세" class="download" aria-label="악세 1개"></select></label>${button('id="apply"','입히기')}</div>
<p id="notice" role="status">통합 세트가 없는 선택은 거절하며, 다른 옷이나 맨몸으로 몰래 바꾸지 않습니다.</p>
<iframe id="runtime" class="film" width="1280" height="480" title="실제 라디오 마스코트 코드 검수" src="../../../bots/오버레이/마스코트.html?검수=1&무대=1&밤=0&자리=중하&크기=.32&DJ=까몽"></iframe>
<div class="filters">${button('data-expression=""','자연 표정')}${expressions.map(x=>button(`data-expression="${x}"`,x)).join('')}</div>
<div class="filters">${['인사','정답','체크인','투표'].map(x=>button(`data-event="${x}"`,x+' 동작')).join('')}${button('id="genre"','장르 변경 후 착용 유지 확인')}</div>
<details><summary>실제로 표시 중인 상태</summary><pre id="state" class="caption-preview">불러오는 중</pre></details></section>
<section class="collection-intro"><h2>아직 전부 완료로 셀 수 없는 이유</h2><p>까몽은 108짝(의상 9 × 악세 12)과 단품 21차림의 통합 표정 원본이 있습니다. 새 라디오 파생판은 원본을 보존한 검수후보입니다.</p><p>몽글 120짝, 마린 108짝은 통합 표정 세트가 없습니다. 기존 옷 조각은 있지만, 머리 자세가 바뀌는 동안 자연스럽게 유지된다는 뜻은 아닙니다. 그래서 미완성 조합을 방송 가능으로 표시하지 않습니다.</p><p>기쁨은 현재 눈웃음과 같은 컷을 사용하는 이름입니다. 고개를 실제로 돌리는 3D 애니메이션이 아니라, 기존 그림의 표정 교체와 짧은 전체 이동을 검수합니다.</p><p>방송은 코드 기준 1280 × 720으로 재압축됩니다. 4K 원본 보존과 4K 무손실 방송은 다릅니다.</p><div class="actions"><a class="download" href="검수보고.md">검수 결과와 남은 일</a><a class="download" href="자산/재고감사.json">전수 재고 기록</a></div></section>
<section><h2>실제 검수한 그림</h2><p>펼쳐서 비교하고, 그림을 누르면 원본 크기로 볼 수 있습니다. 번호는 각 검수 기록과 같습니다. 정적 모음의 통과를 모든 동작의 합격으로 세지 않았습니다.</p>
${gallery('까몽 129차림 — 기본 표정 9장 모음',Array.from({length:9},(_,i)=>[`실물/까몽_129차림_${String(i+1).padStart(2,'0')}.png`,`까몽 기본 표정 모음 ${i+1}/9 · 검수후보`]))}
${gallery('몽글·마린 — 얼굴 가림과 인사 자세 확인',[['기존층/몽글_표정.png','몽글: 후드가 오른쪽 눈을 가리는 기존 조합'],['기존층/마린_표정.png','마린: 인사 때 머리와 헤드폰 위치가 맞지 않는 기존 조합']])}
${gallery('실제 라디오 동작 — 0.1초 간격 12컷', ['인사','정답','체크인','투표'].map(x=>[`브라우저/동작_${x}.png`,`${x} 동작 · 여름 델 + 전설의 팻말 · 실제 브라우저 연속 장면`]))}
${gallery('투명도 계산 수정 — 기존 왼쪽 / 수정 오른쪽',[['자산/알파보존후보/안경+여름델_기존왼쪽_수정오른쪽_400px.png','반투명 털 보존 수정 · 흰 외곽 잔색은 별도 미해결']])}
${gallery('새싹 색 복원 — 눈·몸·알파는 그대로',[['자산/새싹보존후보/새싹_전후확대.png','앞치마+새싹: 원본 / 수정 전 / 수정 후 · 새싹은 눈이 아닌 악세'],['자산/새싹보존후보/까몽_전체전후.png','승인된 눈·몸을 다시 계산하지 않은 보존형 수정 후보']])}
</section>
</main><script>${script}</script></body></html>`;
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'검수보기.html'),html);
console.log(path.join(out,'검수보기.html'));
