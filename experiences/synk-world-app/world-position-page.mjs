// WORLD 「내 위치」 판 2판(2026-11-16) — 뼈대부터 다시 짠 판(qa/내위치2판-20261116/설계.md).
// 판을 연 학생이 위에서부터 세 가지를 차례로 알게 한다.
//  ① 어디서 자꾸 놓치나: 놓친 곳 이야기 한 장(놓친 항목 → 그 안내문 한 장 → 놓침 · 그 자리 · 나중에 다시 · 다음 차례를 잇는 줄)
//  ② 다음에 무엇을 누르나: 흰 알약 단추 하나(그 항목에 지금 낼 새 문항이 있을 때 — 옛 판의 「이 항목 연습하기」와 같은 단추)
//  ③ 나는 어디쯤인가: 항목 지도(칸 하나가 항목 하나 — 빈 칸 · 반 칸 · 찬 칸이 아직 · 연습 중 · 혼자 해냄)
// 나머지(항목별 근거, 짧은 진단, 시간을 두고 다시 확인, 예상 급수, 기록 범위)는 그 아래에 두거나 접는다.
//
// 판단은 하지 않는다. 값은 셋에서만 온다: world-position.mjs의 지도(map), world-missed-spot.mjs의 놓친 곳 카드(card),
// 옛 판 그림(계정 묶음의 world-position-ui.mjs renderPositionBoard — 이하 legacy)의 묶음 HTML(항목별 근거 · 짧은 진단 · 예상 급수 · 시험 고르기 ·
// 먼저 볼 항목 · 기록 범위). 옛 묶음은 글자 그대로 옮겨 담고 겉만 이 판의 CSS가 바꾼다 — 근거 줄 · 세지 않은 답 · 도움 받은 답처럼 앞 검수가
// 판에 남기라고 한 사실이 빠지지 않게 하려는 것이다. 계정 묶음 밖 모듈이다(공개본 계정 묶음은 원천 빌드와 짜임이 달라 덧대지 않는다 —
// world-missed-spot.mjs와 같은 까닭). 화면 글은 world-strings.mjs의 position.*에 있다. 학습 내용(안내문 줄 · 근무지 이름)은 한국어 원문이다(lang="ko").
// 급수 판정 · 합격 예측 · 점수 환산을 하지 않는다(학습기준 §7-3). 「약점」이 아니라 「놓친 곳」이다.
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const CELLS=Object.freeze(['independent','practicing','notyet']);
const STEPS=Object.freeze(['spot','again','practice','homework','delayed']);

// 옛 판 HTML에서 묶음 하나(여는 꼴 → 그 묶음을 닫는 꼴)를 꺼낸다. 옛 묶음은 같은 태그를 안에 품지 않는다(section 안에 section 없음).
function pick(html,open,close){
 const at=html.indexOf(open);if(at<0)return '';
 const end=html.indexOf(close,at);return end<0?'':html.slice(at,end+close.length);
}
function pickAll(html,open,close){
 const out=[];let from=0;
 for(;;){const at=html.indexOf(open,from);if(at<0)break;const end=html.indexOf(close,at);if(end<0)break;out.push(html.slice(at,end+close.length));from=end+close.length;}
 return out;
}
// 옛 묶음 머리의 영문 모노 라벨(LOOK FIRST · QUICK CHECK · ESTIMATE)은 이 판에서 뺀다 — 한국어 제목이 바로 아래에 있다.
const unlabel=html=>html.replace(/<p class="life-section-label">[A-Z][A-Z ]*<\/p>/g,'');

/**
 * 옛 판 HTML(legacy)에서 이 판이 옮겨 담을 묶음을 꺼낸다. 못 찾은 것은 빈 글이다.
 */
export function legacyParts(legacy){
 const html=typeof legacy==='string'?legacy:'';
 return {
  exam:pick(html,'<div class="wpos-exam"','</div>'),
  incomplete:pick(html,'<p class="wpos-note" data-position-incomplete','</p>'),
  attention:pick(html,'<section class="wpos-attention" data-position-attention','</section>'),
  diagnostic:pick(html,'<section class="wpos-diagnostic"','</section>'),
  groups:pickAll(html,'<section class="wpos-group"','</section>'),
  estimate:pick(html,'<section class="wpos-estimate"','</section>'),
  scope:pick(html,'<p class="wpos-scope"','</p>'),
 };
}

// 「먼저 볼 항목」에서 놓친 곳이 짚은 항목을 뺀다(같은 줄을 되풀이하지 않음 — 그 항목뿐이면 묶음째 뺀다, 놓친 곳 설계 P2 ⑨와 같다).
function withoutSkill(section,skillId){
 if(!section||!skillId)return section;
 const item=`<li data-skill="${esc(skillId)}">`,at=section.indexOf(item);if(at<0)return section;
 const end=section.indexOf('</li>',at);if(end<0)return section;
 const trimmed=section.slice(0,at)+section.slice(end+'</li>'.length);
 return /<li data-skill="/.test(trimmed)?trimmed:'';
}

/**
 * 판 한 장(HTML). 옛 판과 같은 data-* 자리(data-position-board · -exam · -diagnostic · -practice · -mock · -writing · -incomplete)를 지켜
 * world-learning-ui.mjs의 단추 잇기가 그대로 붙는다. 「시간을 두고 다시 확인」은 화면 쪽이 [data-position-followups] 자리에 넣는다.
 * map: buildPositionMap 결과 · legacy: 옛 판 HTML(view.renderPositionBoard) · card: buildMissedSpot 결과(없으면 null) ·
 * practice(skillId): 그 항목에 지금 낼 새 문항이 있는 연습({route:'practice'} · {route:'game',gameId}) ·
 * t(키, 값) · has(키) · formatDate(ms, Intl 옵션): world-lang.mjs의 같은 이름 함수.
 * 차례는 이야기 → 지도다(시안 둘을 미학 맹검에 견줘 「놓친 문장과 복습 흐름이 맨 위」인 판이 두 쌍 모두 골렸다, 11-16).
 */
export function renderPositionPage({map,legacy='',card=null,practice=null,t,has=()=>true,formatDate=null}={}){
 if(typeof t!=='function')throw TypeError('WORLD position page needs the screen-language t()');
 const parts=legacyParts(legacy);
 const exam=map?.exam==='topik2'?'topik2':'topik1';
 const skillName=skill=>skill?.id&&has(`position.skill.${skill.id}`)?t(`position.skill.${skill.id}`):String(skill?.label||skill?.id||'');
 const story=card&&card.kind==='topik'?renderStory(card,{t,has,formatDate,practice,skillName,skill:map?.skills?.find?.(row=>row.id===card.target.skillId)||null}):'';
 const mapHtml=renderMap(map,{t,exam,skillName,missedId:story?card.target.skillId:null});
 // 놓친 곳이 없으면 맨 위 자리는 할 일 하나가 차지한다: 기록이 하나도 없으면 짧은 진단, 아니면 먼저 볼 항목.
 const attention=story?withoutSkill(parts.attention,card.target.skillId):parts.attention;
 const empty=!map?.skills?.some?.(skill=>skill.cell!=='notyet');
 const lead=story||(empty&&parts.diagnostic?`<div class="wpv-lead">${unlabel(parts.diagnostic)}</div>`:attention?`<div class="wpv-lead">${unlabel(attention)}</div>`:'');
 const usedDiagnostic=!story&&empty&&!!parts.diagnostic,usedAttention=!story&&!usedDiagnostic&&!!attention;
 const groups=parts.groups.filter(group=>!/data-domain="writing"/.test(group)),writingBlock=parts.groups.find(group=>/data-domain="writing"/.test(group))||'';
 const list=groups.length?`<details class="wpv-fold" data-position-list><summary><span>${esc(t('position.list.title'))}</span><small>${esc(t('position.list.count',{n:map?.total??0}))}</small></summary><div class="wpv-fold-body">${groups.join('')}</div></details>`:'';
 const rest=[
  usedAttention||!attention?'':unlabel(attention),
  usedDiagnostic||!parts.diagnostic?'':unlabel(parts.diagnostic),
  '<div data-position-followups></div>',
  writingBlock,list,
  estimateFold(parts.estimate),
 ].filter(Boolean).join('');
 return `<div class="wpos wpv life-heading" data-position-board data-exam="${exam}" tabindex="-1">${parts.exam}${parts.incomplete}${lead}${mapHtml}${rest}${parts.scope}</div>`;
}

// 예상 급수: 지금은 늘 「아직 판단하기 일러요」 같은 한 줄이 답이라, 그 줄을 접힘의 머리에 두고 근거 설명과 시험 형식 연습 단추는 펼치면 보인다.
// 옛 묶음(world-position-ui.mjs estimateBlock)의 제목과 상태 글을 그대로 머리로 옮긴다. 못 찾으면 묶음을 그대로 둔다.
function estimateFold(section){
 if(!section)return '';
 const title=section.match(/<h3>([^<]*)<\/h3>/)?.[1],state=section.match(/<p class="wpos-estimate-state">[\s\S]*?<strong>([^<]*)<\/strong>/)?.[1];
 if(!title||!state)return unlabel(section);
 const body=unlabel(section).replace(/<h3>[^<]*<\/h3>/,'').replace(/<p class="wpos-estimate-state">[\s\S]*?<\/p>/,'');
 return `<details class="wpv-fold wpv-estimate"><summary><span>${title}</span><small>${state}</small></summary><div class="wpv-fold-body">${body}</div></details>`;
}

// ── 놓친 곳 이야기 ──
// 머리: 놓친 항목(시험 · 영역 · 이름)과 큰 한 줄. 안내문 줄로 좁혀졌으면 그 안내문을 종이 한 장으로 보이고 「이 안내문에서 n번 놓쳤어요」,
// 아니면 「손님 n명 중 m명 놓침」을 큰 한 줄로. 줄: 놓침(놓친 방향 · 몇 번) → 다시 만난 일(●) → 다음 차례(○). 단추 하나.
// 줄의 글은 놓친 곳 카드(world-missed-spot.mjs renderMissedSpot)와 같은 열쇠를 쓴다 — 두 화면이 같은 사실을 다르게 말하지 않게.
// 「나중에 다시」에서 혼자 맞히거나 막았으면 그 칸만 따뜻한 색으로 짚는다(이 판의 강조색 한 곳).
function renderStory(card,{t,has,formatDate,practice,skillName,skill=null}){
 const head=card.narrow.find(row=>row.layer==='skill');if(!head)return '';
 const line=card.narrow.find(row=>row.layer==='line'),way=card.narrow.find(row=>row.layer==='direction');
 const id=card.target.skillId,name=skillName({id,label:card.target.label});
 const exam=t(card.target.exam==='topik2'?'goal.exam.type.topik2':'goal.exam.type.topik1'),domain=t(card.target.domain==='listening'?'position.domain.listening':'position.domain.reading');
 const count=head.count===1&&head.of===1?t('position.story.count.once'):t(head.unit==='guest'?'position.story.count.guest':'position.story.count.try',{n:head.of,wrong:head.count});
 const headline=line?t(line.count===line.of?'position.story.lineAll':'position.story.lineSome',{n:line.count,of:line.of}):count;
 const day=value=>{const at=Date.parse(value);if(!Number.isFinite(at))return '';return formatDate?formatDate(at,{month:'short',day:'numeric'}):new Date(at+9*3600000).toISOString().slice(5,10);};
 const notice=line?`<figure class="wpv-notice"><figcaption>${esc(t('position.source.entry-check'))} · <span lang="ko">${esc(line.venue)}</span></figcaption><blockquote lang="ko">${esc(line.text)}</blockquote></figure>`:'';
 // 놓침 칸: 놓친 방향이 좁혀졌으면 그 방향을 몇 번(놓친 수의 일부면 「놓친 n번 중 m번」을 덧붙임), 아니면 머리 수(안내문 줄이 큰 한 줄을 차지했을 때만 —
 // 아니면 큰 한 줄이 이미 그 수다).
 // 「그 자리」 줄이 또 놓친 손님을 말하면(바로 뒤 손님 가운데 놓친 근거가 있으면) 놓침 줄은 첫 놓침만 말한다 — 줄을 차례로 읽으면 ✗ → ✗✓ → ✓로
 // 머리 수와 셈이 맞는다(최종 검수 2). 놓친 방향이 놓친 수의 일부뿐이면 수를 그대로 둔다.
 const evidenceIds=new Set(Array.isArray(card.evidence)?card.evidence:[]),spotRow=card.again.find(row=>row.step==='spot');
 // 놓침 전부가 한 줄로 이어진 때(머리의 놓친 수 = 바로 뒤에서 또 놓친 수 + 1)만이다 — 놓침이 두 자리로 나뉘면 따로 놓친 손님이 줄에서 빠진다(다시 검수 A1).
 const again=spotRow?(Array.isArray(spotRow.eventIds)?spotRow.eventIds:[]).filter(id=>evidenceIds.has(id)).length:0;
 const chained=!!spotRow&&spotRow.right>0&&again>0&&head.count===again+1;
 const wayKey=way?(way.direction==='turned-away'?'turned-away':way.direction==='wrong-rule'?'wrong-rule':'let-in'):null;
 const missText=way&&chained&&way.count===way.of?t(`position.story.first.${wayKey}`):way?`${t(`position.story.way.${way.direction==='turned-away'?'turned-away':way.direction==='wrong-rule'?'wrong-rule':'let-in'}`,{n:way.count})}${way.count===way.of?'':` (${t('position.missed.share.some',{n:way.count,of:way.of})})`}`:line?count:'';
 const missRow=missText?`<li data-step="miss" data-state="done"><i class="wpv-dot" aria-hidden="true"></i><span class="wpv-step">${esc(t('position.story.step.miss'))}</span><span class="wpv-what">${esc(missText)}</span></li>`:'';
 const stepName=row=>t(`position.missed.step.${row.step}`);
 const stepText=row=>{
  // 바로 다음 손님을 다 혼자 맞혔으면(한 명뿐인 때 포함) 「모두」 꼴 — 「1명이 왔고, 1명은」 · 「1 guests」 · 몽골어 복수 대명사를 피한다(검수 A1).
  // 바로 뒤 손님 가운데 이미 놓침으로 센 손님(놓친 근거와 같은 기록 — 또 놓친 손님)이 있으면 그 수를 갈라 말한다. 안 가르면 「2번 들여보냈어요」
  // 바로 아래에서 놓친 손님 위에 손님이 더 온 것처럼 읽혀 머리 수(「손님 4명」)와 셈이 어긋난다(최종 검수 2).
  if(row.step==='spot'){
   if(chained)return t(`position.story.spot.${row.sameRule?'sameRule':'sameKind'}Mixed`,{n:row.guests,again,right:row.right});
   // 놓침이 서로 떨어진 자리에서 나왔으면 놓침 줄이 놓친 수 전부를 말하므로, 그 자리 줄은 또 놓친 손님을 빼고 센다.
   // 빼지 않으면 「3번 들여보냈어요」 아래 「손님 3명이 왔고」가 겹쳐 3+3으로 읽힌다(최종 검수 F1). 빼고 0명이면 그 줄을 두지 않는다.
   const fresh=row.guests-again;if(fresh<=0)return '';
   return t(`position.story.spot.${row.sameRule?'sameRule':'sameKind'}${!row.right?'':row.right>=fresh?'All':'Right'}`,{n:fresh,right:row.right});
  }
  if(row.step==='again'){
   if(row.state==='planned')return t('position.story.again.left',{n:row.left});
   return t(`position.story.again.${row.result==='correct'?row.answer==='reject'?'reject':'correct':row.result==='assisted'?'assisted':row.result==='incorrect'?'incorrect':'other'}`);
  }
  if(row.step==='practice')return t('position.story.practice.done',{n:row.n,right:row.right});
  if(row.step==='homework')return t('position.story.homework.planned');
  if(row.step==='delayed'){
   const next=row.due?t(row.open?'position.story.delayed.due':'position.story.delayed.dueCheck'):row.dueAt?t('position.story.delayed.next',{date:day(row.dueAt)}):'';
   const done=row.observed?t('position.story.delayed.observed',{n:row.observed}):'';
   return [done,next].filter(Boolean).join(' ')||t('position.story.delayed.planned');
  }
  return '';
 };
 const rows=card.again.filter(row=>STEPS.includes(row.step)).map(row=>{
  const what=stepText(row);if(!what)return '';
  const state=row.state==='done'?'done':'planned',win=row.step==='again'&&row.state==='done'&&row.result==='correct';
  const tag=state==='planned'?`<span class="wpv-next">${esc(t('position.missed.legend.planned'))}</span>`:'';
  return `<li data-step="${row.step}" data-state="${state}"${win?' data-win':''}>${state==='done'?`<i class="wpv-dot" role="img" aria-label="${esc(t('position.missed.legend.done'))}"></i>`:'<i class="wpv-dot" aria-hidden="true"></i>'}<span class="wpv-step">${esc(stepName(row))}${tag}</span><span class="wpv-what">${esc(what)}</span></li>`;
 }).join('');
 // 그 항목의 손님(문항) 줄: 지도가 그 항목의 근거로 센 첫 답을 시각 차례로 — ✗ 놓침 · ✓ 맞힘. 머리 수(「손님 4명 가운데 2명」)를 그림으로 보인 것이다.
 // 근거 일부가 접혀 로그에 없으면 그 수만 「+n」으로 붙인다. 열 개를 넘으면 최근 열 개만.
 // 열 개를 넘겨 잘라 낸 수도 「+n」에 더한다(검수 A3). 화면 읽기는 바로 곁의 머리 수 문장(작은 줄 또는 큰 한 줄)이 같은 사실을 말하므로 표식은 숨긴다(검수 A6).
 const all=(Array.isArray(skill?.evidence)?skill.evidence:[]).filter(row=>row&&['correct','incorrect'].includes(row.verdict)).slice().sort((a,b)=>(Date.parse(a.at)||0)-(Date.parse(b.at)||0));
 const marks=all.slice(-10),more=(Number.isInteger(skill?.folded)&&skill.folded>0?skill.folded:0)+(all.length-marks.length);
 const tokens=marks.length?`<span class="wpv-marks" aria-hidden="true">${more?`<b>+${more}</b>`:''}${marks.map(row=>`<i data-verdict="${row.verdict}"></i>`).join('')}</span>`:'';
 let route=null;try{route=practice?.(id)||null;}catch{route=null;}
 const button=route?`<button class="wpv-go" type="button" data-position-practice="${esc(id)}">${esc(route.route==='game'&&route.gameId&&has(`plan.game.${route.gameId}`)?t(`plan.game.${route.gameId}`):t('position.practice.start'))} <span aria-hidden="true">→</span></button>`:'';
 return `<section class="wpv-story" data-position-missed="${esc(id)}" aria-labelledby="wpv-story-title">`
  +`<p class="wpv-kicker"><span>${esc(t('position.missed.title'))}</span><span>${esc(exam)} · ${esc(domain)}</span></p>`
  +`<p class="wpv-skill"><strong>${esc(name)}</strong>${tokens}${line?`<small>${esc(count)}</small>`:''}</p>`
  +`<h3 class="wpv-headline" id="wpv-story-title"${headline.length>24?' data-long':''}>${esc(headline)}</h3>${notice}`
  +`${missRow||rows?`<ol class="wmis-again wpv-steps" aria-label="${esc(t('position.missed.again'))}">${missRow}${rows}</ol>`:''}${button}</section>`;
}

// ── 항목 지도 ──
// 칸 하나가 항목 하나다. 줄은 영역(듣기 · 읽기), 칸의 차오름은 상태: 빈 칸 아직 · 반 칸 연습 중 · 찬 칸 혼자 해냄. 놓친 곳이 짚은 항목에는 테가 둘린다.
// 칸 이름은 화면 읽기 프로그램이 읽는다(칸마다 「이름: 상태」). 수와 이름은 범례에, 항목별 근거는 아래 접힌 목록에 있다.
function renderMap(map,{t,exam,skillName,missedId}){
 if(!map||!Array.isArray(map.skills))return '';
 const counts=map.counts||{};
 const legend=CELLS.map(cell=>`<li data-cell="${cell}"><i aria-hidden="true"></i><b>${Number(counts[cell])||0}</b><span>${esc(t(`position.cell.${cell}`))}</span></li>`).join('')
  +(missedId&&map.skills.some(skill=>skill.id===missedId)?`<li data-missed><i aria-hidden="true"></i><span>${esc(t('position.missed.title'))}</span></li>`:'');
 const rows=['listening','reading'].map(domain=>{
  const skills=map.skills.filter(skill=>skill.domain===domain);if(!skills.length)return '';
  // 칸은 목록 항목 그대로 두고 이름 · 상태(놓친 곳이면 그것까지)를 숨김 글로 읽힌다 — role=img로 덮으면 목록 구조가 깨진다(검수 A5).
 const cells=skills.map(skill=>`<li data-skill="${esc(skill.id)}" data-cell="${esc(skill.cell)}"${skill.id===missedId?' data-missed':''}><span class="wpv-sr">${esc([skillName(skill),t(`position.cell.${skill.cell}`),skill.id===missedId?t('position.missed.title'):''].filter(Boolean).join(' · '))}</span></li>`).join('');
  return `<div class="wpv-row" data-domain="${domain}"><span>${esc(t(`position.domain.${domain}`))}</span><ol style="--n:${skills.length}">${cells}</ol></div>`;
 }).join('');
 const title=t('position.map.title',{exam:t(exam==='topik2'?'goal.exam.type.topik2':'goal.exam.type.topik1'),total:map.total});
 return `<section class="wpv-map" aria-labelledby="wpv-map-title"><h3 id="wpv-map-title">${esc(title)}</h3><ul class="wpv-legend" aria-label="${esc(t(exam==='topik2'?'position.summary.topik2':'position.summary',{...counts,total:map.total}))}">${legend}</ul><div class="wpv-grid">${rows}</div><p class="wpv-note">${esc(t('position.intro'))}</p></section>`;
}
