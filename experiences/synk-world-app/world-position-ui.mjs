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
 const day=value=>{const at=Date.parse(value);if(!Number.isFinite(at))return '';return formatDate?formatDate(at,{month:'short',day:'numeric'}):new Date(at+9*3600000).toISOString().slice(5,10);};
 // 항목 이름: 표에 있으면 화면 언어로, 없으면 Strata의 한국어 이름 그대로.
 const skillName=skill=>skill?.id&&has(`position.skill.${skill.id}`)?t(`position.skill.${skill.id}`):String(skill?.label||skill?.id||'');
 // 어느 연습에서 낸 답인지: 짧은 진단(코치 'world-home')이면 진단, 읽기 짧은 연습(코치 'world-practice')이면 그 연습,
 // 아니면 문항 열쇠의 앞 이름(바람길은 '.', 리듬은 ':'로 나뉜다).
 function itemSource(itemKey,experienceId=null){
  if(experienceId==='world-home')return t('position.source.diagnostic');
  if(experienceId==='world-practice')return t('position.source.practice');
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
 // 칸 아래 한 줄(world-position.mjs posNote): 같은 칸에 접힌 사실 — 정·오, 도움과 함께 한 시도, 난도별 이력, 지난 성취 날짜.
 function noteText(note){
  if(!note)return '';
  const main=note.kind==='practice'?t('position.note.practice',{n:note.n,wrong:note.wrong})
   :note.kind==='checking'?note.n===1?t(note.wrong?'position.note.checkingWrong':'position.note.checkingRight'):t('position.note.checkingMany',{n:note.n,right:note.right})
   :note.kind==='supported'?(note.at?t('position.note.supported',{date:day(note.at)}):t('position.cell.practicing'))
   :note.kind==='review'?(note.at?t(note.done?'position.note.reviewDone':'position.note.review',{date:day(note.at)}):'')
   :note.kind==='independent'?(note.at?t('position.note.independent',{date:day(note.at)}):'')
   :note.kind==='helped'?t('position.note.helped',{date:day(note.at)})
   :note.kind==='unassessed'?t('position.note.unassessed'):'';
  const levels=Array.isArray(note.levels)?note.levels.map(level=>t('position.note.level',{n:level.difficulty,state:t(`position.level.${level.status}`)})).join(' · '):'';
  return [main,levels].filter(Boolean).join(' · ');
 }
 // 도움과 함께 낸 첫 답(N1): 근거는 아니지만 시도한 사실은 남는다.
 function helpedRows(skill,catalog){
  if(!skill.helped?.length)return '';
  const rows=skill.helped.slice(0,6).map(row=>{const excerpt=catalog?.(row.itemKey)||'',ok=row.verdict==='correct';
   return `<li class="wpos-evidence" data-verdict="${posEscape(row.verdict)}" data-assisted="true">${posLed(ok?'ok':'alert')}<span class="wpos-evidence-main"><strong>${posEscape(t(ok?'position.evidence.correct':'position.evidence.incorrect'))} · ${posEscape(t('position.evidence.assisted'))}</strong><small>${posEscape(itemSource(row.itemKey,row.experienceId))}${excerpt?` · <span lang="ko">${posEscape(excerpt)}</span>`:''}${row.difficulty?` · ${posEscape(t('position.evidence.level',{n:row.difficulty}))}`:''}</small></span><time datetime="${posEscape(row.at)}">${posEscape(day(row.at))}</time></li>`;}).join('');
  return `<p class="wpos-evidence-title">${posEscape(t('position.helped.title'))}</p><ul class="wpos-evidence-list" data-helped>${rows}</ul><p class="wpos-note">${posEscape(t('position.helped.note'))}</p>`;
 }
 // practice(skillId): 그 항목에 지금 낼 새 문항이 있는 연습 — {route:'practice'}(읽기 짧은 연습, 그 항목의 새 문항) 또는 {route:'game',gameId}(듣기 게임).
 // 읽기는 「이 항목 연습하기」, 게임은 그 항목 문항이 먼저 나온다고 약속할 수 없어 계획 판처럼 게임 이름으로 단다(10-21 검수). 참만 오면 읽기와 같다.
 const practiceButton=(skillId,practice)=>{const route=practice?.(skillId);if(!route)return '';
  const label=route.route==='game'&&route.gameId&&has(`plan.game.${route.gameId}`)?t(`plan.game.${route.gameId}`):t('position.practice.start');
  return `<button class="quiet-button wpos-practice" type="button" data-position-practice="${posEscape(skillId)}">${posEscape(label)} <span aria-hidden="true">→</span></button>`;};
 function skillRow(skill,catalog,practice){
  const note=noteText(skill.note);
  return `<details class="wpos-skill" data-skill="${posEscape(skill.id)}" data-cell="${posEscape(skill.cell)}" data-status="${posEscape(skill.status)}"><summary><span class="wpos-skill-name">${posEscape(skillName(skill))}${note?`<small class="wpos-skill-note" data-note="${posEscape(skill.note.kind)}">${posEscape(note)}</small>`:''}</span><span class="wpos-chip" data-tone="${POS_LED[skill.cell]||'idle'}">${posLed(POS_LED[skill.cell])}${posEscape(t(`position.cell.${skill.cell}`))}</span></summary><div class="wpos-skill-body"><p class="wpos-status">${posEscape(t(`position.status.${skill.status}`))}</p><p class="wpos-evidence-title">${posEscape(t('position.evidence.title'))}</p>${evidenceRows(skill,catalog)}${skill.unassessed?`<p class="wpos-note">${posEscape(t('position.evidence.unassessed',{n:skill.unassessed}))}</p>`:''}${helpedRows(skill,catalog)}${practiceButton(skill.id,practice)}</div></details>`;
 }
 // 「먼저 볼 항목」(최대 3, world-position.mjs posAttention): 틀린 답이 있거나 다시 볼 때가 된 항목. 약점 낙인이 아니다.
 function attentionBlock(map,practice){
  const rows=(map.attention||[]).map(id=>map.skills.find(skill=>skill.id===id)).filter(Boolean);
  if(!rows.length)return '';
  return `<section class="wpos-attention" data-position-attention><p class="life-section-label">LOOK FIRST</p><h3>${posEscape(t('position.attention.title'))}</h3><p class="wpos-note">${posEscape(t('position.attention.note'))}</p><ul>${rows.map(skill=>`<li data-skill="${posEscape(skill.id)}"><span class="wpos-attention-copy"><strong>${posEscape(skillName(skill))}</strong><small>${posEscape(noteText(skill.note))}</small></span>${practiceButton(skill.id,practice)}</li>`).join('')}</ul></section>`;
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
 // 예상 급수: 문턱(estimateGate) 전에는 급수·범위를 보이지 않는다(학습기준 §7-3). 지금 WORLD에는 TOPIK 형식 연습이 없어
 // 근거가 쌓일 길이 없으므로, 「0 / 30」 막대로 쌓이면 열린다고 약속하지 않고 지금 할 수 있는 것만 쓴다(10-20 검수 #4).
 // 형식 연습이 생겨 근거가 하나라도 오면(gate.evidence) 그때 개수를 보인다. 일정은 약속하지 않는다.
 function estimateBlock(gate){
  if(!gate)return '';
  const waiting=gate.status==='no-estimator';
  return `<section class="wpos-estimate" data-estimate="${posEscape(gate.status)}"><p class="life-section-label">ESTIMATE</p><h3>${posEscape(t('position.estimate.title'))}</h3><p class="wpos-estimate-state">${posLed('')}<strong>${posEscape(t(waiting?'position.estimate.waiting':'position.estimate.early'))}</strong></p><p class="wpos-note">${posEscape(t('position.estimate.honest'))}</p>${gate.evidence>0?`<p class="wpos-estimate-count"><span>${posEscape(t('position.estimate.count',{n:gate.evidence,needed:gate.needed}))}</span></p>`:''}</section>`;
 }
 const poster=(word,sub,{print='position',label='MY POSITION'}={})=>`<div class="life-poster wpos-poster"><span class="w-print wpos-print" data-print="${print}" aria-hidden="true"><i></i></span><small class="life-poster-label">${label}</small><strong class="life-poster-word">${posEscape(word)}</strong><p class="life-poster-sub">${posEscape(sub)}</p></div>`;

 // map: buildPositionMap 결과 · plan: selectDiagnostic 결과(없으면 진단 칸 없음) · gate: estimateGate 결과(없으면 예상 급수 칸 없음)
 // catalog(itemKey): 문항 첫머리(없으면 연습 이름만) · scope: 'account'|'device'(어디 기록인지 한 줄)
 // practice(skillId): 「이 항목 연습하기」를 달 수 있는 항목인지(world-learning-ui.mjs가 넘긴다, 없으면 단추 없음).
 function renderPositionBoard({map,plan=null,gate=null,catalog=null,diagnosed=false,scope=null,practice=null}={}){
  const summary=t('position.summary',{...map.counts,total:map.total});
  const groups=['listening','reading'].map(domain=>{
   const skills=map.skills.filter(skill=>skill.domain===domain);
   return `<section class="wpos-group" data-domain="${domain}"><h3>${posEscape(t(`position.domain.${domain}`))} <span>${skills.length}</span></h3><div class="wpos-skills">${skills.map(skill=>skillRow(skill,catalog,practice)).join('')}</div></section>`;
  }).join('');
  const counts=POS_CELLS.map(cell=>`<li data-cell="${cell}">${posLed(POS_LED[cell])}<strong>${map.counts[cell]}</strong><span>${posEscape(t(`position.cell.${cell}`))}</span></li>`).join('');
  return `<div class="wpos life-heading" data-position-board tabindex="-1">${poster(t('position.title'),summary)}<ul class="wpos-counts" aria-label="${posEscape(summary)}">${counts}</ul><p class="wpos-intro">${posEscape(t('position.intro'))}</p>${map.evidenceComplete?'':`<p class="wpos-note" data-position-incomplete>${posEscape(t('position.incomplete'))}</p>`}${attentionBlock(map,practice)}${diagnosticBlock(map,plan,{done:diagnosed})}${groups}${estimateBlock(gate)}${scope?`<p class="wpos-scope">${posEscape(t(scope==='account'?'position.scope.account':'position.scope.device'))}</p>`:''}</div>`;
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
  return `<div class="wpos wpos-run" data-position-run="${posEscape(item.id)}"><div class="wpos-run-head"><span class="wpos-bar" aria-hidden="true"><i style="width:${posFill(view.index,view.total)}%"></i></span><p class="wpos-run-count">${posEscape(t('position.diagnostic.progress',{index:view.index+1,total:view.total}))}</p></div><p class="life-section-label wpos-run-skill" tabindex="-1">${posEscape(t(`position.domain.${item.modality}`))} · ${posEscape(skillName(skill||{id:item.skillId}))}</p>${item.prompt?`<p class="wpos-prompt" lang="ko">${posEscape(item.prompt)}</p>`:''}${item.card?entryCard(item.card):''}${listening?`<div class="wpos-listen"><button class="quiet-button" type="button" data-position-listen${playing?' aria-busy="true"':''}>${posEscape(t(view.heard?'position.diagnostic.listenAgain':'position.diagnostic.listen'))}</button><p class="wpos-note">${posEscape(t(listenNote))}</p></div>`:''}${item.question?item.ask&&has(`position.diagnostic.ask.${item.ask}`)?`<p class="wpos-question">${posEscape(t(`position.diagnostic.ask.${item.ask}`))}</p>`:`<p class="wpos-question" lang="ko">${posEscape(item.question)}</p>`:''}<div class="wpos-choices${item.ask==='picture'?' wpos-pictures':''}" lang="ko">${choices}</div><p class="wpos-run-status" role="status">${posEscape(notice)}</p><div class="wpos-run-actions"><button class="quiet-button" type="button" data-position-skip>${posEscape(t('position.diagnostic.skip'))}</button><button class="quiet-button" type="button" data-position-stop>${posEscape(t('position.diagnostic.stop'))}</button></div></div>`;
 }

 // 해설(학습 내용이라 한국어 원문): 틀린 문항에만 접어서 둔다.
 const explainBlock=item=>item?.explanation?`<details class="wpos-explain"><summary>${posEscape(t('position.diagnostic.explain'))}</summary><p lang="ko">${posEscape(item.explanation)}</p></details>`:'';
 // 진단 끝 한 장: 이번에 푼 것과 바뀐 지도. results: createDiagnosticSession().results()
 // items: 문항 id → 문항(해설), practice(skillId): 「이 항목 연습하기」를 달 수 있는지(10-20 검수 #2·#7). 한 문항이라 칸은 모두 「확인 중」이다.
 function renderDiagnosticDone({map,results=[],items=null,practice=null}={}){
  const answered=results.filter(row=>!row.skipped).length,skipped=results.length-answered;
  const itemOf=id=>items?.get?.(id)||null;
  const rows=results.filter(row=>!row.skipped).map(row=>{const skill=map.skills.find(s=>s.id===row.skillId)||{id:row.skillId},ok=row.verdict==='correct';
   return `<li data-verdict="${posEscape(row.verdict)}" data-skill="${posEscape(row.skillId)}">${posLed(ok?'ok':'alert')}<span class="wpos-done-copy"><strong>${posEscape(skillName(skill))}</strong><small>${posEscape(t(ok?'position.evidence.correct':'position.evidence.incorrect'))}${row.assisted?` · ${posEscape(t('position.evidence.assisted'))}`:''} · ${posEscape(t('position.diagnostic.checking'))}</small>${ok?'':explainBlock(itemOf(row.itemId))}</span>${practiceButton(row.skillId,practice)}</li>`;}).join('');
  const wrong=results.some(row=>!row.skipped&&row.verdict==='incorrect');
  return `<div class="wpos life-heading" data-position-done tabindex="-1">${poster(t('position.diagnostic.doneTitle'),t('position.diagnostic.doneSummary',{answered,skipped}))}${rows?`<ul class="wpos-done-list">${rows}</ul>`:''}${wrong?`<p class="wpos-note">${posEscape(t('position.diagnostic.wrongNote'))}</p>`:''}<p class="wpos-intro">${posEscape(t('position.diagnostic.doneNote'))}</p><p class="wpos-summary-line">${posEscape(t('position.summary',{...map.counts,total:map.total}))}</p><button class="felt-button" type="button" data-position-back>${posEscape(t('position.diagnostic.back'))} <span aria-hidden="true">→</span></button></div>`;
 }

 // ── 읽기 짧은 연습(world-reading-practice.mjs, 10-20 검수 #1) ──
 // 한 문항: 진단과 같은 문항 그림에, 답한 뒤에는 맞음·틀림과 정답·해설을 바로 보인다(답은 이미 혼자 낸 첫 답으로 남았다).
 // feedback: {verdict, choiceId, correctId} 또는 null(아직 답 전).
 function renderPracticeItem({view,skill=null,notice='',feedback=null}={}){
  const item=view.item,done=!!feedback;
  const choices=item.choices.map(choice=>{const state=!done?'':choice.id===feedback.correctId?'answer':choice.id===feedback.choiceId?'wrong':'';
   return `<button class="wpos-choice" type="button" data-practice-choice="${posEscape(choice.id)}"${state?` data-state="${state}"`:''}${done?' disabled':''}>${posEscape(choice.label)}</button>`;}).join('');
  const ok=feedback?.verdict==='correct';
  const result=done?`<div class="wpos-feedback" data-practice-feedback tabindex="-1" data-verdict="${posEscape(feedback.verdict)}" role="status">${posLed(ok?'ok':'alert')}<strong>${posEscape(t(ok?'practice.right':'practice.wrong'))}</strong>${item.explanation?`<p lang="ko">${posEscape(item.explanation)}</p>`:''}</div><button class="felt-button" type="button" data-practice-next>${posEscape(t(view.index+1<view.total?'practice.next':'practice.finish'))} <span aria-hidden="true">→</span></button>`:'';
  return `<div class="wpos wpos-run" data-practice-run="${posEscape(item.id)}"><div class="wpos-run-head"><span class="wpos-bar" aria-hidden="true"><i style="width:${posFill(view.index,view.total)}%"></i></span><p class="wpos-run-count">${posEscape(t('position.diagnostic.progress',{index:view.index+1,total:view.total}))}</p></div><p class="life-section-label wpos-run-skill" tabindex="-1">${posEscape(t(`position.domain.${item.modality}`))} · ${posEscape(skillName(skill||{id:item.skillId}))}</p>${item.prompt?`<p class="wpos-prompt" lang="ko">${posEscape(item.prompt)}</p>`:''}${item.card?entryCard(item.card):''}${item.question?item.ask&&has(`position.diagnostic.ask.${item.ask}`)?`<p class="wpos-question">${posEscape(t(`position.diagnostic.ask.${item.ask}`))}</p>`:`<p class="wpos-question" lang="ko">${posEscape(item.question)}</p>`:''}<div class="wpos-choices" lang="ko">${choices}</div>${result}<p class="wpos-run-status" role="status">${posEscape(done?'':notice)}</p>${done?'':`<div class="wpos-run-actions"><button class="quiet-button" type="button" data-practice-skip>${posEscape(t('position.diagnostic.skip'))}</button><button class="quiet-button" type="button" data-practice-stop>${posEscape(t('practice.stop'))}</button></div>`}</div>`;
 }
 // 끝 한 장: 이번 답(혼자 맞힘·틀림·건너뜀) → 그 항목에 실제로 달라진 관측 한 줄 → 틀린 문항 해설 → 다음 한 걸음.
 // before·after: 연습 전후의 그 항목(buildPositionMap의 skills 한 줄). more: 같은 항목에 남은 새 문항 수.
 // 「한 칸 올라왔어요」처럼 보장되지 않는 단계 말은 쓰지 않고, 칸이 실제로 바뀐 때만 바뀐 칸을 말한다(최종 제안 §3).
 function renderPracticeDone({skill,before=null,after=null,results=[],items=null,more=0}={}){
  const answered=results.filter(row=>!row.skipped),right=answered.filter(row=>row.verdict==='correct'&&row.independent).length;
  const wrong=answered.filter(row=>row.verdict==='incorrect').length,skipped=results.length-answered.length;
  const changed=before&&after&&before.cell!==after.cell?t('practice.changed.cell',{from:t(`position.cell.${before.cell}`),to:t(`position.cell.${after.cell}`)})
   :after&&before&&after.n>before.n?t('practice.changed.more',{n:after.n-before.n}):t('practice.changed.none');
  const now=after?noteText(after.note):'';
  const itemOf=id=>items?.get?.(id)||null;
  const misses=answered.filter(row=>row.verdict==='incorrect').map(row=>{const item=itemOf(row.itemId);return item?`<li><span lang="ko">${posEscape(item.label||item.question||'')}</span>${explainBlock(item)}</li>`:'';}).join('');
  const next=more>0?`<button class="felt-button" type="button" data-practice-again>${posEscape(t('practice.again',{n:Math.min(more,5)}))} <span aria-hidden="true">→</span></button>`
   :`<p class="wpos-note" data-practice-shortage>${posEscape(t('practice.shortage'))}</p>`;
  return `<div class="wpos life-heading" data-practice-done tabindex="-1">${poster(t('practice.doneTitle'),t('practice.doneSummary',{right,wrong,skipped}))}<section class="wpos-change"><p class="life-section-label">${posEscape(skillName(skill||{}))}</p><p class="wpos-intro">${posEscape(changed)}</p>${now?`<p class="wpos-note">${posEscape(now)}</p>`:''}</section>${misses?`<section class="wpos-misses"><p class="wpos-evidence-title">${posEscape(t('practice.misses'))}</p><ul>${misses}</ul></section>`:''}${next}<div class="wpos-run-actions"><button class="quiet-button" type="button" data-practice-position>${posEscape(t('position.open'))}</button><button class="quiet-button" type="button" data-practice-home>${posEscape(t('practice.home'))}</button></div></div>`;
 }
 // ── 이번 주 계획(world-exam-plan.mjs buildExamPlan) ──
 // 시험 이름·목표 급·시험일은 학생이 밝힌 그대로 한 줄로(D-n·남은 날 세기 없음). 영역마다 이번 주 횟수와 한 것(빈 칸은 빨갛지 않다),
 // 지금 할 것(Core가 고른 추천), 약한 항목의 숙제(새 문항이 없으면 모자람), 다시 확인 일정, 지금까지 혼자 해낸 항목·근거 수.
 // 지금 할 것이 짧은 진단이면 다시 확인 칸에 같은 단추를 또 두지 않는다.
 const examDay=value=>{
  const match=typeof value==='string'&&/^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(value);if(!match)return '';
  const at=Date.UTC(Number(match[1]),Number(match[2])-1,match[3]?Number(match[3]):15)-9*3600000;
  return formatDate?formatDate(at,match[3]?{year:'numeric',month:'long',day:'numeric'}:{year:'numeric',month:'long'}):value;
 };
 const DOTS_MAX=8,dots=(planned,done)=>`<span class="wplan-dots" aria-hidden="true">${Array.from({length:Math.min(DOTS_MAX,Math.max(planned,done))},(_,i)=>`<i${i<done?' data-done':''}></i>`).join('')}</span>`;
 const koSpan=text=>`<span lang="ko">${posEscape(text)}</span>`;
 const withKo=(key,title)=>{const mark='\u0000';return posEscape(t(key,{title:mark})).replace(mark,koSpan(title));};
 const writingName=routeId=>{const type=String(routeId||'').split(':')[1],key=type==='mock'?'writing.mock.title':`writing.type.${type}`;return type&&has(key)?`${t('writing.title')} · ${t(key)}`:'';};
 function planTitle(next){
  const label=String(next.label||next.title||''),strip=suffix=>label.endsWith(suffix)?label.slice(0,-suffix.length):null;
  if(next.route==='practice'&&next.skillId)return posEscape(t('plan.practice',{skill:skillName({id:next.skillId})}));
  if(next.route==='position')return posEscape(t('position.diagnostic.title'));
  if(next.route==='game'&&next.gameId&&has(`plan.game.${next.gameId}`))return posEscape(t(`plan.game.${next.gameId}`));
  if(next.route==='writing'&&writingName(next.routeId))return posEscape(writingName(next.routeId));
  if(next.id==='world.resume.review'&&has('plan.resumeReview'))return posEscape(t('plan.resumeReview'));
  const resumed=strip(' · 이어 하기'),reviewed=strip(' · 새 상황 복습');
  if(resumed!==null)return withKo('plan.resume',resumed);
  if(reviewed!==null)return withKo('plan.review',reviewed);
  return koSpan(label);
 }
 function renderExamPlan({plan,next=null,reason=''}={}){
  const exam=plan.exam||{},parts=[exam.type?t(`goal.exam.type.${exam.type}`):'',exam.grade?t('plan.week.grade',{n:exam.grade}):'',exam.date?t('plan.week.date',{date:examDay(exam.date)}):'',exam.mode&&exam.mode!=='unknown'?t(`goal.exam.mode.${exam.mode}`):''].filter(Boolean);
  const head=parts.length?parts.join(' · '):t('plan.week.noExam');
  const notes=new Set(plan.notes||[]);
  const area=row=>`<li data-area="${posEscape(row.area)}"><span class="wplan-area-name">${posEscape(t(`plan.area.${row.area}`))}</span>${dots(row.planned,row.done)}<span class="wplan-area-count">${posEscape(t('plan.area.count',{done:row.done,planned:row.planned}))}</span>${row.classwork?.length?`<small class="wplan-classwork">${row.classwork.map(task=>posEscape(t(task.done?'plan.classwork.done':'plan.classwork.todo',{kind:t(`plan.area.${task.kind}`)}))).join(' · ')}</small>`:''}</li>`;
  // NOW 제목: 홈(home.mjs planLabel)과 같은 이름. 화면 언어로 바꿀 수 있는 것은 바꾸고, 레슨 제목처럼 한국어 학습 내용은 lang="ko" 칸에 둔다.
  const nextTitle=next?planTitle(next):'';
  const gameOf=id=>String(id||'').split('.').pop();
  const homework=(plan.homework||[]).map(row=>{
   const name=skillName({id:row.skillId}),games=row.activities||[];
   const action=row.shortage?`<small class="wplan-shortage">${posEscape(t('plan.homework.shortage'))}</small>`
    :row.domain==='reading'?`<button class="quiet-button" type="button" data-plan-practice="${posEscape(row.skillId)}">${posEscape(t('plan.homework.reading',{n:Math.min(row.fresh,5)}))} <span aria-hidden="true">→</span></button>`
    :row.domain==='writing'?`<button class="quiet-button" type="button" data-plan-writing="${posEscape(games[0])}">${posEscape(writingName(games[0])||t('writing.title'))} <span aria-hidden="true">→</span></button>`
    :`<button class="quiet-button" type="button" data-plan-game="${posEscape(gameOf(games[0]))}">${posEscape(has(`plan.game.${gameOf(games[0])}`)?t(`plan.game.${gameOf(games[0])}`):gameOf(games[0]))} <span aria-hidden="true">→</span></button>`;
   return `<li data-skill="${posEscape(row.skillId)}"><span class="wpos-attention-copy"><strong>${posEscape(name)}</strong><small>${posEscape(t(`position.level.${row.status}`))}</small></span>${action}</li>`;
  }).join('');
  const thisWeek=(plan.checks||[])[0]?.weekStart===plan.week?.start?(plan.checks||[])[0]:null;
  const checks=(plan.checks||[]).map(row=>`<li${row.done?' data-done':''}><span>${posEscape(row.weekStart===plan.week?.start?t('plan.checks.thisWeek'):t('plan.checks.week',{date:day(new Date(row.weekStart).toISOString())}))}</span>${row.done?`<small>${posEscape(t('plan.checks.done'))}</small>`:''}</li>`).join('');
  const reach=plan.reach||{confirmed:0,total:0,evidence:0};
  return `<div class="wpos wplan life-heading" data-plan-board tabindex="-1">${poster(t('plan.week.title'),head,{print:'plan',label:'MY PLAN'})}`
   +(notes.has('past')?`<section class="wpos-diagnostic" data-plan-past><p class="wpos-intro">${posEscape(t('goal.exam.past'))}</p><button class="quiet-button" type="button" data-view="study">${posEscape(t('plan.week.setGoal'))}</button></section>`:'')
   +`<section class="wplan-week"><p class="life-section-label">THIS WEEK</p><h3>${posEscape(t('plan.week.sessions',{n:plan.sessions?.total||0,minutes:plan.sessions?.minutes||0}))}</h3><ul class="wplan-areas">${(plan.areas||[]).map(area).join('')}</ul><p class="wpos-note">${posEscape(t('plan.week.rest'))}</p>${notes.has('audio-off')?`<p class="wpos-note">${posEscape(t('plan.week.audioOff'))}</p>`:''}${notes.has('reading-unavailable')?`<p class="wpos-note" data-plan-reading-later>${posEscape(t('plan.week.readingLater'))}</p>`:''}${notes.has('writing-unavailable')?`<p class="wpos-note">${posEscape(t('plan.week.writingLater'))}</p>`:''}${notes.has('no-date')?`<p class="wpos-note">${posEscape(t('plan.week.noDate'))}</p>`:''}</section>`
   +(next?`<section class="wplan-next"><p class="life-section-label">NOW</p><h3>${nextTitle}</h3>${reason?`<p class="wpos-note">${posEscape(reason)}</p>`:''}<button class="felt-button" type="button" data-plan-next>${posEscape(t('plan.week.start'))} <span aria-hidden="true">→</span></button></section>`:'')
   +(homework?`<section class="wpos-attention wplan-homework"><p class="life-section-label">HOMEWORK</p><h3>${posEscape(t('plan.homework.title'))}</h3><p class="wpos-note">${posEscape(t('plan.homework.note'))}</p><ul>${homework}</ul></section>`:'')
   +(checks?`<section class="wplan-checks"><p class="life-section-label">CHECK</p><h3>${posEscape(t('plan.checks.title'))}</h3><ul>${checks}</ul><p class="wpos-note">${posEscape(t('plan.checks.note'))}</p>${thisWeek&&!thisWeek.done&&next?.route!=='position'?`<button class="quiet-button" type="button" data-plan-recheck>${posEscape(t('position.diagnostic.start'))} <span aria-hidden="true">→</span></button>`:''}</section>`:'')
   +`<section class="wplan-reach"><p class="life-section-label">SO FAR</p><p class="wpos-intro">${posEscape(t('plan.reach.line',{confirmed:reach.confirmed,total:reach.total,evidence:reach.evidence}))}</p><p class="wpos-note">${posEscape(t('plan.reach.note'))}</p>${reach.basis==='topik1'&&exam.type==='topik2'?`<p class="wpos-note" data-plan-reach-basis>${posEscape(t('plan.reach.topik1Basis'))}</p>`:''}</section>`
   +`<button class="quiet-button" type="button" data-view="study">${posEscape(t('plan.week.change'))}</button></div>`;
 }
 return Object.freeze({skillName,itemSource,noteText,renderPositionBoard,renderHangulBoard,renderDiagnosticItem,renderDiagnosticDone,renderPracticeItem,renderPracticeDone,renderExamPlan});
}
