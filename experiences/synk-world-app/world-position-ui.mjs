// WORLD 「내 위치」 판의 그림(HTML). 판단은 하지 않는다 — 칸·근거·진단 목록은 world-position.mjs가 Core 상태에서 읽어
// 넘긴 것을 그대로 그린다. 화면 글은 화면 언어 1판의 표(world-strings.mjs의 position.*)에 있고, 학습 내용(문항·보기·안내문)은
// 늘 한국어 원문이다(lang="ko").
// 이 모듈은 계정 묶음(world-account.bundle.mjs)에도 실리므로 world-lang.mjs를 직접 부르지 않는다 — 묶음 안에 언어 상태가
// 한 벌 더 생겨 설정에서 바꾼 언어를 못 따라간다. 화면 쪽(world-learning-ui.mjs)이 넘긴 t·has·formatDate로 쓴다
// (device-records.mjs가 app-shell에서 text를 받는 것과 같은 방식).

const posEscape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const POS_LED={independent:'ok',practicing:'check',notyet:''},POS_CELLS=Object.freeze(['independent','practicing','notyet']);
const posLed=tone=>`<i class="w-led${tone?` ${tone}`:''}" aria-hidden="true"></i>`;
// 넓이 막대(0~1). 진행·만난 글자 막대가 같이 쓴다.
const posFill=(value,max)=>(Math.max(0,Math.min(1,max?value/max:0))*100).toFixed(1);

// t(키, 값) · has(키) · formatDate(ms, Intl 옵션): world-lang.mjs의 같은 이름 함수.
export function createPositionView({t,has=()=>true,formatDate=null}={}){
 if(typeof t!=='function')throw TypeError('WORLD position view needs the screen-language t()');
 const day=value=>{const at=Date.parse(value);if(!Number.isFinite(at))return '';return formatDate?formatDate(at,{month:'short',day:'numeric'}):new Date(at).toISOString().slice(5,10);};
 // 항목 이름: 표에 있으면 화면 언어로, 없으면 Strata의 한국어 이름 그대로.
 const skillName=skill=>skill?.id&&has(`position.skill.${skill.id}`)?t(`position.skill.${skill.id}`):String(skill?.label||skill?.id||'');
 // 어느 연습에서 낸 답인지: 짧은 진단(코치 'world-home')이면 진단, 아니면 문항 열쇠의 앞 이름(바람길은 '.', 리듬은 ':'로 나뉜다).
 function itemSource(itemKey,experienceId=null){
  if(experienceId==='world-home')return t('position.source.diagnostic');
  const prefix=String(itemKey||'').split(/[.:]/)[0];
  return prefix&&has(`position.source.${prefix}`)?t(`position.source.${prefix}`):t('position.source.other');
 }
 function evidenceRows(skill,catalog){
  if(!skill.evidence.length&&!skill.folded)return `<p class="wpos-empty">${posEscape(t('position.evidence.none'))}</p>`;
  const rows=skill.evidence.map(row=>{
   const excerpt=catalog?.(row.itemKey)||'',ok=row.verdict==='correct';
   return `<li class="wpos-evidence" data-verdict="${posEscape(row.verdict)}" data-assisted="${row.assisted?'true':'false'}">${posLed(ok?'ok':'alert')}<span class="wpos-evidence-main"><strong>${posEscape(t(ok?'position.evidence.correct':'position.evidence.incorrect'))} · ${posEscape(t(row.assisted?'position.evidence.assisted':'position.evidence.alone'))}</strong><small>${posEscape(itemSource(row.itemKey,row.experienceId))}${excerpt?` · <span lang="ko">${posEscape(excerpt)}</span>`:''}${row.difficulty?` · ${posEscape(t('position.evidence.level',{n:row.difficulty}))}`:''}</small></span><time datetime="${posEscape(row.at)}">${posEscape(day(row.at))}</time></li>`;
  }).join('');
  return `${rows?`<ul class="wpos-evidence-list">${rows}</ul>`:''}${skill.folded?`<p class="wpos-note">${posEscape(t('position.evidence.folded',{n:skill.folded}))}</p>`:''}`;
 }
 function skillRow(skill,catalog){
  return `<details class="wpos-skill" data-skill="${posEscape(skill.id)}" data-cell="${posEscape(skill.cell)}" data-status="${posEscape(skill.status)}"><summary><span class="wpos-skill-name">${posEscape(skillName(skill))}</span><span class="wpos-chip" data-tone="${POS_LED[skill.cell]||'idle'}">${posLed(POS_LED[skill.cell])}${posEscape(t(`position.cell.${skill.cell}`))}</span></summary><div class="wpos-skill-body"><p class="wpos-status">${posEscape(t(`position.status.${skill.status}`))}</p><p class="wpos-evidence-title">${posEscape(t('position.evidence.title'))}</p>${evidenceRows(skill,catalog)}${skill.unassessed?`<p class="wpos-note">${posEscape(t('position.evidence.unassessed',{n:skill.unassessed}))}</p>`:''}</div></details>`;
 }
 const skillNames=(map,ids)=>ids.map(id=>skillName(map.skills.find(skill=>skill.id===id)||{id})).join(' · ');
 function diagnosticBlock(map,plan,{done=false}={}){
  if(!plan)return '';
  const notes=[],by=reason=>plan.missing.filter(row=>row.reason===reason).map(row=>row.skillId);
  if(plan.reason==='history.incomplete')notes.push(t('position.diagnostic.history'));
  else{
   const none=by('no-item'),audio=by('audio'),unknown=by('unknown'),seen=by('all-seen');
   if(none.length)notes.push(t('position.diagnostic.missing',{n:none.length,skills:skillNames(map,none)}));
   if(audio.length)notes.push(t('position.diagnostic.audioOff',{n:audio.length}));
   if(unknown.length)notes.push(t('position.diagnostic.unknown',{n:unknown.length}));
   if(seen.length&&!plan.items.length)notes.push(t('position.diagnostic.allSeen'));
  }
  const ready=plan.status==='ready'&&plan.items.length>0;
  return `<section class="wpos-diagnostic" data-diagnostic="${ready?'ready':'unavailable'}"><p class="life-section-label">QUICK CHECK</p><h3>${posEscape(t('position.diagnostic.title'))}</h3>${ready?`<p>${posEscape(t('position.diagnostic.intro',{n:plan.items.length}))}</p>`:''}${notes.map(note=>`<p class="wpos-note">${posEscape(note)}</p>`).join('')}${ready?`<button class="felt-button" type="button" data-position-diagnostic>${posEscape(t(done?'position.diagnostic.again':'position.diagnostic.start'))} <span aria-hidden="true">→</span></button>`:''}</section>`;
 }
 // 예상 급수: 문턱(estimateGate) 전에는 급수·범위를 보이지 않고 「아직 판단하기 일러요」와 근거 수만(학습기준 §7-3).
 function estimateBlock(gate){
  if(!gate)return '';
  const waiting=gate.status==='no-estimator';
  return `<section class="wpos-estimate" data-estimate="${posEscape(gate.status)}"><p class="life-section-label">ESTIMATE</p><h3>${posEscape(t('position.estimate.title'))}</h3><p class="wpos-estimate-state">${posLed('')}<strong>${posEscape(t(waiting?'position.estimate.waiting':'position.estimate.early'))}</strong></p><p class="wpos-note">${posEscape(t('position.estimate.note',{needed:gate.needed,each:gate.neededPerDomain}))}</p><p class="wpos-estimate-count"><span>${posEscape(t('position.estimate.count',{n:gate.evidence,needed:gate.needed}))}</span><span class="wpos-bar" aria-hidden="true"><i style="width:${posFill(gate.evidence,gate.needed)}%"></i></span></p></section>`;
 }
 const poster=(word,sub,{print='position'}={})=>`<div class="life-poster wpos-poster"><span class="w-print wpos-print" data-print="${print}" aria-hidden="true"><i></i></span><small class="life-poster-label">MY POSITION</small><strong class="life-poster-word">${posEscape(word)}</strong><p class="life-poster-sub">${posEscape(sub)}</p></div>`;

 // map: buildPositionMap 결과 · plan: selectDiagnostic 결과(없으면 진단 칸 없음) · gate: estimateGate 결과(없으면 예상 급수 칸 없음)
 // catalog(itemKey): 문항 첫머리(없으면 연습 이름만) · scope: 'account'|'device'(어디 기록인지 한 줄)
 function renderPositionBoard({map,plan=null,gate=null,catalog=null,diagnosed=false,scope=null}={}){
  const summary=t('position.summary',map.counts);
  const groups=['listening','reading'].map(domain=>{
   const skills=map.skills.filter(skill=>skill.domain===domain);
   return `<section class="wpos-group" data-domain="${domain}"><h3>${posEscape(t(`position.domain.${domain}`))} <span>${skills.length}</span></h3><div class="wpos-skills">${skills.map(skill=>skillRow(skill,catalog)).join('')}</div></section>`;
  }).join('');
  const counts=POS_CELLS.map(cell=>`<li data-cell="${cell}">${posLed(POS_LED[cell])}<strong>${map.counts[cell]}</strong><span>${posEscape(t(`position.cell.${cell}`))}</span></li>`).join('');
  return `<div class="wpos life-heading" data-position-board tabindex="-1">${poster(t('position.title'),summary)}<ul class="wpos-counts" aria-label="${posEscape(summary)}">${counts}</ul><p class="wpos-intro">${posEscape(t('position.intro'))}</p>${map.evidenceComplete?'':`<p class="wpos-note" data-position-incomplete>${posEscape(t('position.incomplete'))}</p>`}${diagnosticBlock(map,plan,{done:diagnosed})}${groups}${estimateBlock(gate)}${scope?`<p class="wpos-scope">${posEscape(t(scope==='account'?'position.scope.account':'position.scope.device'))}</p>`:''}</div>`;
 }

 // 한글 만나기 졸업 전: 항목 지도 대신 한글 진도. stage: hangulStageProgress 결과(모르면 null)
 function renderHangulBoard({stage=null}={}){
  const known=!!stage&&Number.isInteger(stage.met)&&Number.isInteger(stage.total)&&stage.total>0;
  const bar=(value,max,label)=>`<span class="wpos-bar" role="progressbar" aria-label="${posEscape(label)}" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${value}"><i style="width:${posFill(value,max)}%"></i></span>`;
  const body=!known?`<p class="wpos-note">${posEscape(t('position.hangul.unknown'))}</p>`:!stage.started?`<p class="wpos-note">${posEscape(t('position.hangul.notStarted'))}</p>`
   :`<div class="wpos-hangul"><p>${posEscape(t('position.hangul.letters',stage))}</p>${bar(stage.met,stage.total,t('position.hangul.letters',stage))}<p>${posEscape(t('position.hangul.units',stage))}</p>${bar(stage.unitsDone,stage.units,t('position.hangul.units',stage))}</div>`;
  return `<div class="wpos life-heading" data-position-board="hangul" tabindex="-1">${poster(t('position.hangul.title'),t('position.hangul.intro'),{print:'hangul'})}${body}<button class="felt-button" type="button" data-position-hangul>${posEscape(t(known&&stage.started?'position.hangul.continue':'position.hangul.start'))} <span aria-hidden="true">→</span></button></div>`;
 }

 // 입장 검사처럼 안내문을 읽고 손님에게 적용하는 문항: 안내문 · 시각 · 손님의 표 · 짐 · 손님의 말을 글로 보인다.
 function entryCard(card){
  const rows=card.doc.rows.map(([name,value])=>`<div><dt>${posEscape(name)}</dt><dd>${posEscape(value)}</dd></div>`).join('');
  return `<div class="wpos-card"><section class="wpos-notice" lang="ko"><p class="wpos-notice-title">${posEscape(card.notice.title)}</p><ul>${card.notice.rules.map(rule=>`<li>${posEscape(rule)}</li>`).join('')}</ul></section><section class="wpos-guest"><p class="wpos-guest-time">${posEscape(t('position.diagnostic.time',{at:card.at}))}</p><p class="wpos-notice-title" lang="ko">${posEscape(card.doc.title)}</p><dl lang="ko">${rows}</dl>${card.bag.length?`<p class="wpos-bag">${posEscape(t('position.diagnostic.bag'))}: <span lang="ko">${posEscape(card.bag.join(', '))}</span></p>`:''}<p class="wpos-line" lang="ko"><span>${posEscape(card.who)}</span>「${posEscape(card.line)}」</p></section></div>`;
 }
 // 진단 한 문항. view: createDiagnosticSession().current · skill: 그 항목(이름) · notice: 상태 한 줄 · playing: 소리가 나는 중
 function renderDiagnosticItem({view,skill=null,notice='',playing=false}={}){
  const item=view.item,listening=item.audioRequired??item.modality==='listening',ready=view.heard&&!view.answered;
  const choices=item.choices.map(choice=>`<button class="wpos-choice" type="button" data-position-choice="${posEscape(choice.id)}"${ready?'':' disabled'}>${posEscape(choice.label)}</button>`).join('');
  const listenNote=playing?'position.diagnostic.playing':view.audio==='failed'&&!view.heard?'position.diagnostic.audioFailed':view.heard?'position.diagnostic.replayNote':'position.diagnostic.listenFirst';
  return `<div class="wpos wpos-run" data-position-run="${posEscape(item.id)}"><div class="wpos-run-head"><span class="wpos-bar" aria-hidden="true"><i style="width:${posFill(view.index,view.total)}%"></i></span><p class="wpos-run-count">${posEscape(t('position.diagnostic.progress',{index:view.index+1,total:view.total}))}</p></div><p class="life-section-label wpos-run-skill" tabindex="-1">${posEscape(t(`position.domain.${item.modality}`))} · ${posEscape(skillName(skill||{id:item.skillId}))}</p>${item.prompt?`<p class="wpos-prompt" lang="ko">${posEscape(item.prompt)}</p>`:''}${item.card?entryCard(item.card):''}${listening?`<div class="wpos-listen"><button class="quiet-button" type="button" data-position-listen${playing?' aria-busy="true"':''}>${posEscape(t(view.heard?'position.diagnostic.listenAgain':'position.diagnostic.listen'))}</button><p class="wpos-note">${posEscape(t(listenNote))}</p></div>`:''}${item.question?item.ask&&has(`position.diagnostic.ask.${item.ask}`)?`<p class="wpos-question">${posEscape(t(`position.diagnostic.ask.${item.ask}`))}</p>`:`<p class="wpos-question" lang="ko">${posEscape(item.question)}</p>`:''}<div class="wpos-choices" lang="ko">${choices}</div><p class="wpos-run-status" role="status">${posEscape(notice)}</p><div class="wpos-run-actions"><button class="quiet-button" type="button" data-position-skip>${posEscape(t('position.diagnostic.skip'))}</button><button class="quiet-button" type="button" data-position-stop>${posEscape(t('position.diagnostic.stop'))}</button></div></div>`;
 }

 // 진단 끝 한 장: 이번에 푼 것과 바뀐 지도. results: createDiagnosticSession().results()
 function renderDiagnosticDone({map,results=[]}={}){
  const answered=results.filter(row=>!row.skipped).length,skipped=results.length-answered;
  const rows=results.filter(row=>!row.skipped).map(row=>{const skill=map.skills.find(s=>s.id===row.skillId)||{id:row.skillId},ok=row.verdict==='correct';
   return `<li data-verdict="${posEscape(row.verdict)}">${posLed(ok?'ok':'alert')}<strong>${posEscape(skillName(skill))}</strong><span>${posEscape(t(ok?'position.evidence.correct':'position.evidence.incorrect'))}${row.assisted?` · ${posEscape(t('position.evidence.assisted'))}`:''}</span></li>`;}).join('');
  return `<div class="wpos life-heading" data-position-done tabindex="-1">${poster(t('position.diagnostic.doneTitle'),t('position.diagnostic.doneSummary',{answered,skipped}))}${rows?`<ul class="wpos-done-list">${rows}</ul>`:''}<p class="wpos-intro">${posEscape(t('position.diagnostic.doneNote'))}</p><p class="wpos-summary-line">${posEscape(t('position.summary',map.counts))}</p><button class="felt-button" type="button" data-position-back>${posEscape(t('position.diagnostic.back'))} <span aria-hidden="true">→</span></button></div>`;
 }
 return Object.freeze({skillName,itemSource,renderPositionBoard,renderHangulBoard,renderDiagnosticItem,renderDiagnosticDone});
}
