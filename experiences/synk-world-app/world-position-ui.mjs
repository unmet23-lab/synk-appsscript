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

// t(키, 값) · has(키) · formatDate(ms, Intl 옵션) · lang(): world-lang.mjs의 같은 이름 함수(lang은 currentLang — 해설 언어를 고른다).
export function createPositionView({t,has=()=>true,formatDate=null,lang=()=>'ko'}={}){
 if(typeof t!=='function')throw TypeError('WORLD position view needs the screen-language t()');
 const screenLang=()=>{try{return lang()||'ko';}catch{return 'ko';}};
 const day=value=>{const at=Date.parse(value);if(!Number.isFinite(at))return '';return formatDate?formatDate(at,{month:'short',day:'numeric'}):new Date(at+9*3600000).toISOString().slice(5,10);};
 // 항목 이름: 표에 있으면 화면 언어로, 없으면 Strata의 한국어 이름 그대로.
 const skillName=skill=>skill?.id&&has(`position.skill.${skill.id}`)?t(`position.skill.${skill.id}`):String(skill?.label||skill?.id||'');
 // 어느 연습에서 낸 답인지: 짧은 진단(코치 'world-home')이면 진단, 짧은 연습(코치 'world-practice')이면 그 연습,
 // 시험 형식 연습(코치 'world-mock')이면 그 연습, 아니면 문항 열쇠의 앞 이름(바람길은 '.', 리듬은 ':'로 나뉜다).
 function itemSource(itemKey,experienceId=null){
  if(experienceId==='world-home')return t('position.source.diagnostic');
  if(experienceId==='world-practice')return t('position.source.practice');
  if(experienceId==='world-mock')return t('position.source.mock');
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
  // 이 시험의 검수 통과 진단 문항이 아직 하나도 없으면(TOPIK II 문항을 검수하는 동안) 항목을 줄줄이 늘어놓지 않고 한 줄로.
  else if(!plan.items.length&&plan.missing.length&&plan.missing.every(row=>row.reason==='no-item'))notes.push(t(map.exam==='topik2'?'position.diagnostic.noneYet2':'position.diagnostic.noneYet'));
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
 // 예상 급수: 급수·범위를 보이지 않는다(학습기준 §7-3 · 3차 검수 — 범위를 읽는 방법이 검증되기 전까지). 근거는 시험 형식 연습
 // (미니 모의)에서 처음 본 문항에 혼자 낸 첫 답이고, 모은 수는 문턱(30) 없이 그대로 보인다 — 수를 채우면 곧 급수가 나온다는 인상을
 // 주지 않게(10-20 검수 #4 · 3차). 일정은 약속하지 않는다. 학생이 IBT로 본다고 했으면 PBT 연습의 답으로 IBT 범위를 읽지 않는다고 쓴다.
 // mock: selectMock 결과 — 열 수 있으면 「시험 형식 연습」 단추.
 function estimateBlock(gate,mock=null){
  if(!gate)return '';
  const state=gate.status==='mode-unsupported'?'position.estimate.ibt':gate.status==='no-estimator'?'position.estimate.waiting':'position.estimate.early';
  const ready=mock?.status==='ready';
  return `<section class="wpos-estimate" data-estimate="${posEscape(gate.status)}"><p class="life-section-label">ESTIMATE</p><h3>${posEscape(t('position.estimate.title'))}</h3><p class="wpos-estimate-state">${posLed('')}<strong>${posEscape(t(state))}</strong></p><p class="wpos-note">${posEscape(t('position.estimate.basis'))}</p>${gate.evidence>0&&gate.status!=='mode-unsupported'?`<p class="wpos-estimate-count"><span>${posEscape(t('position.estimate.collected',{n:gate.evidence,listening:gate.perDomain?.listening??0,reading:gate.perDomain?.reading??0}))}</span></p>`:''}${ready?`<button class="quiet-button wpos-practice" type="button" data-position-mock>${posEscape(t('mock.open',{minutes:mock.minutes}))} <span aria-hidden="true">→</span></button>`:''}</section>`;
 }
 // 판이 읽는 시험 고르기(TOPIK I · TOPIK II). 두 시험을 다 낼 수 있을 때만.
 const examSwitch=(exam,exams)=>Array.isArray(exams)&&exams.length>1?`<div class="wpos-exam" role="group" aria-label="${posEscape(t('position.exam.label'))}">${exams.map(id=>`<button class="wpos-exam-pill" type="button" data-position-exam="${posEscape(id)}" aria-pressed="${id===exam?'true':'false'}">${posEscape(t(`goal.exam.type.${id}`))}</button>`).join('')}</div>`:'';
 // 영역별 진행(10-21 ④): 「확인한 학습 항목 수」만 — 기록으로 칸이 정해진 항목 / 그 영역의 항목. 점수·합격 준비도로 읽히지 않게 칸 이름 없이 수만.
 const progressLine=row=>row?`<p class="wpos-progress"><span>${posEscape(t('position.progress',{checked:row.checked,total:row.total}))}</span><span class="wpos-bar" aria-hidden="true"><i style="width:${posFill(row.checked,row.total)}%"></i></span></p>`:'';
 // ── 연습 한 판에 남기는 응답(WORLD 학습자 응답 설계 §3) ──
 // 결과 아래 조용한 줄 하나: 「이번 연습 어땠어요?」와 응답 넷. 창을 띄우지 않고 고르지 않아도 다음으로 간다.
 // response: {kind:'short'|'diagnostic'|'mock', value: 고른 값(없으면 null), failed: 남기지 못했으면 참}. 없으면(손님·기능 꺼짐) 그리지 않는다.
 // 고른 뒤에는 「내 계정」에서 보고 뺄 수 있다고 알리고, 짧은 연습에서 길이를 바꾸는 둘(많았어요·더 하고 싶어요)만 그 효과를 한 줄 더 말한다.
 const RESPONSE_VALUES=Object.freeze(['helpful','not_fit','too_much','want_more']);
 // 줄의 글 둘(묻기·상태)과 고른 값. 고른 뒤에는 화면 쪽이 이 글만 바꿔 넣는다 — role=status 문단을 새로 넣으면 보조기기가 바뀐 글을 읽지 않는다.
 function setResponseText(response){
  const chosen=RESPONSE_VALUES.includes(response?.value)?response.value:null;
  const effect=response?.kind!=='short'||response?.failed?null:chosen==='too_much'?'response.shorter':chosen==='want_more'?'response.longer':null;
  return {chosen,ask:t(chosen&&!response?.failed?'response.thanks':'response.ask'),status:response?.failed?t('response.failed'):effect?t(effect):''};
 }
 function renderSetResponse(response){
  if(!response||!['short','diagnostic','mock'].includes(response.kind))return '';
  const {chosen,ask,status}=setResponseText(response);
  const pills=RESPONSE_VALUES.map(value=>`<button class="wpos-response-choice" type="button" data-set-response="${value}" aria-pressed="${value===chosen?'true':'false'}">${posEscape(t(`response.value.${value}`))}</button>`).join('');
  return `<section class="wpos-response" data-set-response-box data-kind="${posEscape(response.kind)}"><p class="wpos-response-ask" id="wpos-response-ask" role="status">${posEscape(ask)}</p><div class="wpos-response-choices" role="group" aria-labelledby="wpos-response-ask">${pills}</div><p class="wpos-note" data-set-response-status role="status">${posEscape(status)}</p></section>`;
 }
 const poster=(word,sub,{print='position',label='MY POSITION'}={})=>`<div class="life-poster wpos-poster"><span class="w-print wpos-print" data-print="${print}" aria-hidden="true"><i></i></span><small class="life-poster-label">${label}</small><strong class="life-poster-word">${posEscape(word)}</strong><p class="life-poster-sub">${posEscape(sub)}</p></div>`;

 // map: buildPositionMap 결과 · plan: selectDiagnostic 결과(없으면 진단 칸 없음) · gate: estimateGate 결과(없으면 예상 급수 칸 없음)
 // catalog(itemKey): 문항 첫머리(없으면 연습 이름만) · scope: 'account'|'device'(어디 기록인지 한 줄)
 // practice(skillId): 「이 항목 연습하기」를 달 수 있는 항목인지(world-learning-ui.mjs가 넘긴다, 없으면 단추 없음).
 // exams: 판에서 고를 수 있는 시험(['topik1','topik2'] — 둘 이상일 때 위에 고르기) · mock: selectMock 결과 · writing: TOPIK II 판의 쓰기 연습 줄을 둘지.
 // bridged: TOPIK II 문항이 아직 없어 이번 주 계획이 TOPIK I 항목으로 세는 영역(world-exam-plan progress[영역].basis와 같은 판단) — TOPIK II 판에서
 // 그 영역에 한 줄로 알려, 판(TOPIK II 항목)과 계획(TOPIK I 항목)의 수가 왜 다른지 보이게 한다.
 function renderPositionBoard({map,plan=null,gate=null,mock=null,catalog=null,diagnosed=false,scope=null,practice=null,exams=null,writing=false,bridged=[]}={}){
  const exam=map.exam==='topik2'?'topik2':'topik1';
  const summary=t(exam==='topik2'?'position.summary.topik2':'position.summary',{...map.counts,total:map.total});
  const groups=['listening','reading'].map(domain=>{
   const skills=map.skills.filter(skill=>skill.domain===domain);
   const bridge=exam==='topik2'&&Array.isArray(bridged)&&bridged.includes(domain)?`<p class="wpos-note" data-position-bridge="${domain}">${posEscape(t(domain==='listening'?'position.bridge.listening':'position.bridge.reading'))}</p>`:'';
   return `<section class="wpos-group" data-domain="${domain}"><h3>${posEscape(t(`position.domain.${domain}`))} <span>${skills.length}</span></h3>${progressLine(map.domains?.[domain])}${bridge}<div class="wpos-skills">${skills.map(skill=>skillRow(skill,catalog,practice)).join('')}</div></section>`;
  }).join('');
  // TOPIK II 쓰기: 자동으로 맞음·틀림을 매기지 않아 항목 칸에 넣지 않고, 쓰기 연습(③)으로 가는 줄만 둔다.
  const writingBlock=exam==='topik2'?`<section class="wpos-group" data-domain="writing"><h3>${posEscape(t('plan.area.writing'))}</h3><p class="wpos-note">${posEscape(t('position.writing.note'))}</p>${writing?`<button class="quiet-button wpos-practice" type="button" data-position-writing>${posEscape(t('writing.title'))} <span aria-hidden="true">→</span></button>`:''}</section>`:'';
  const counts=POS_CELLS.map(cell=>`<li data-cell="${cell}">${posLed(POS_LED[cell])}<strong>${map.counts[cell]}</strong><span>${posEscape(t(`position.cell.${cell}`))}</span></li>`).join('');
  return `<div class="wpos life-heading" data-position-board data-exam="${exam}" tabindex="-1">${poster(t('position.title'),summary)}${examSwitch(exam,exams)}<ul class="wpos-counts" aria-label="${posEscape(summary)}">${counts}</ul><p class="wpos-intro">${posEscape(t('position.intro'))}</p>${map.evidenceComplete?'':`<p class="wpos-note" data-position-incomplete>${posEscape(t('position.incomplete'))}</p>`}${attentionBlock(map,practice)}${diagnosticBlock(map,plan,{done:diagnosed})}${groups}${writingBlock}${estimateBlock(gate,mock)}${scope?`<p class="wpos-scope">${posEscape(t(scope==='account'?'position.scope.account':'position.scope.device'))}</p>`:''}</div>`;
 }

 // 한글 만나기 졸업 전: 항목 지도 대신 한글 진도. stage: hangulStageProgress 결과(모르면 null)
 function renderHangulBoard({stage=null}={}){
  const known=!!stage&&Number.isInteger(stage.met)&&Number.isInteger(stage.total)&&stage.total>0;
  const bar=(value,max,label)=>`<span class="wpos-bar" role="progressbar" aria-label="${posEscape(label)}" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${value}"><i style="width:${posFill(value,max)}%"></i></span>`;
  const body=!known?`<p class="wpos-note">${posEscape(t('position.hangul.unknown'))}</p>`:!stage.started?`<p class="wpos-note">${posEscape(t('position.hangul.notStarted'))}</p>`
   :`<div class="wpos-hangul"><p>${posEscape(t('position.hangul.letters',stage))}</p>${bar(stage.met,stage.total,t('position.hangul.letters',stage))}<p>${posEscape(t('position.hangul.units',stage))}</p>${bar(stage.unitsDone,stage.units,t('position.hangul.units',stage))}</div>`;
  return `<div class="wpos life-heading" data-position-board="hangul" tabindex="-1">${poster(t('position.hangul.title'),t('position.hangul.intro'),{print:'hangul'})}${body}<button class="felt-button" type="button" data-position-hangul>${posEscape(t(known&&stage.started?'position.hangul.continue':'position.hangul.start'))} <span aria-hidden="true">→</span></button></div>`;
 }

 // 입장 검사처럼 안내문을 읽고 손님에게 적용하는 문항: 안내문 · 날짜와 시각 · 손님의 표 · 짐 · 손님의 말을 글로 보인다.
 // 날짜는 게임 화면처럼 그날의 한국어 날짜(읽을 글)다 — 음악회 안내문은 날짜가 바뀐 날이 오늘인지가 판단 근거다(10-21 문항 검수).
 // 짐이 없으면 「짐: 없음」 — 게임의 「보여 준 짐이 없어요.」처럼 없다는 것을 글로 보여야 카메라·음식 규칙을 글로 가를 수 있다(10-21 재검수).
 // 시각도 게임 시계·해설과 같은 「오후 4시 29분」 꼴의 한국어 글이다(card.time, 10-22 화면 검수) — 「지금」 같은 틀 글만 화면 언어를 따른다.
 function entryCard(card){
  const rows=card.doc.rows.map(([name,value])=>`<div><dt>${posEscape(name)}</dt><dd>${posEscape(value)}</dd></div>`).join('');
  return `<div class="wpos-card"><section class="wpos-notice" lang="ko"><p class="wpos-notice-title">${posEscape(card.notice.title)}</p><ul>${card.notice.rules.map(rule=>`<li>${posEscape(rule)}</li>`).join('')}</ul></section><section class="wpos-guest"><p class="wpos-guest-time">${card.date?`<span lang="ko">${posEscape(card.date)}</span> · `:''}${posEscape(t('position.diagnostic.time',{at:'\u0000'})).replace('\u0000',`<span lang="ko">${posEscape(card.time||card.at)}</span>`)}</p><p class="wpos-notice-title" lang="ko">${posEscape(card.doc.title)}</p><dl lang="ko">${rows}</dl><p class="wpos-bag">${posEscape(t('position.diagnostic.bag'))}: <span lang="ko">${posEscape(card.bag.length?card.bag.join(', '):'없음')}</span></p><p class="wpos-line" lang="ko"><span>${posEscape(card.who)}</span>「${posEscape(card.line)}」</p></section></div>`;
 }
 // 듣기 칸 한 줄: 재생 중 · 재생 실패 · 시험형(허용 횟수까지 혼자 — 「두 번까지 들을 수 있어요 · 들은 횟수 1」, 넘기면 도움) ·
 // 게임 원고 문항(다 들은 뒤 다시 듣기는 도움). view.plays: {allowed, completed, extra} · view.next: 다음 재생의 성격.
 function listenNote(view,playing){
  if(playing)return t('position.diagnostic.playing');
  if(view.audio==='failed'&&!view.heard)return t('position.diagnostic.audioFailed');
  const allowed=view.plays?.allowed;
  if(Number.isInteger(allowed)){
   if(!view.heard)return `${t(allowed===1?'position.plays.once':'position.plays.twice')} ${t('position.diagnostic.listenFirst')}`;
   return view.next==='allowed'?t('position.plays.left',{heard:view.plays.completed,allowed}):t('position.plays.extra');
  }
  return t(view.heard?'position.diagnostic.replayNote':'position.diagnostic.listenFirst');
 }
 const listenLabel=view=>t(!view.heard?'position.diagnostic.listen':Number.isInteger(view.plays?.allowed)&&view.next==='allowed'?'position.plays.again':'position.diagnostic.listenAgain');
 // 진단 한 문항. view: createDiagnosticSession().current · skill: 그 항목(이름) · notice: 상태 한 줄 · playing: 소리가 나는 중
 // stopLabel: 그만두기 단추 글(마을 준비 확인은 「확인 그만하기」 — 타운 화면 글은 2판까지 한국어). 없으면 진단 글.
 function renderDiagnosticItem({view,skill=null,notice='',playing=false,stopLabel=null}={}){
  const item=view.item,listening=item.audioRequired??item.modality==='listening',ready=view.heard&&!view.answered;
  const choices=item.choices.map(choice=>`<button class="wpos-choice" type="button" data-position-choice="${posEscape(choice.id)}"${ready?'':' disabled'}>${posEscape(choice.label)}</button>`).join('');
  return `<div class="wpos wpos-run" data-position-run="${posEscape(item.id)}"><div class="wpos-run-head"><span class="wpos-bar" aria-hidden="true"><i style="width:${posFill(view.index,view.total)}%"></i></span><p class="wpos-run-count">${posEscape(t('position.diagnostic.progress',{index:view.index+1,total:view.total}))}</p></div><p class="life-section-label wpos-run-skill" tabindex="-1">${posEscape(t(`position.domain.${item.modality}`))} · ${posEscape(skillName(skill||{id:item.skillId}))}</p>${item.prompt?`<p class="wpos-prompt" lang="ko">${posEscape(item.prompt)}</p>`:''}${item.card?entryCard(item.card):''}${listening?`<div class="wpos-listen"><button class="quiet-button" type="button" data-position-listen${playing?' aria-busy="true"':''}>${posEscape(listenLabel(view))}</button><p class="wpos-note">${posEscape(listenNote(view,playing))}</p></div>`:''}${item.question?item.ask&&has(`position.diagnostic.ask.${item.ask}`)?`<p class="wpos-question">${posEscape(t(`position.diagnostic.ask.${item.ask}`))}</p>`:`<p class="wpos-question" lang="ko">${posEscape(item.question)}</p>`:''}<div class="wpos-choices${item.ask==='picture'?' wpos-pictures':''}" lang="ko">${choices}</div><p class="wpos-run-status" role="status">${posEscape(notice)}</p><div class="wpos-run-actions"><button class="quiet-button" type="button" data-position-skip>${posEscape(t('position.diagnostic.skip'))}</button><button class="quiet-button" type="button" data-position-stop>${posEscape(stopLabel||t('position.diagnostic.stop'))}</button></div></div>`;
 }

 // 해설: 게임 원고 문항은 한국어 원문 한 줄, 문항 묶음 문항은 화면 언어별 해설({ko,en,mn})에서 화면 언어 하나(한 자리 한 언어 —
 // 없으면 한국어). 듣기 문항은 들은 대화(대본, 학습 내용이라 한국어)를 함께 둔다.
 function explainText(item){
  const value=item?.explanation;
  if(typeof value==='string'&&value)return {text:value,lang:'ko'};
  if(value&&typeof value==='object'){const want=screenLang(),text=typeof value[want]==='string'&&value[want]?value[want]:value.ko;if(typeof text==='string'&&text)return {text,lang:text===value[want]?want:'ko'};}
  return null;
 }
 const scriptBlock=item=>Array.isArray(item?.script)&&item.script.length?`<div class="wpos-script"><p class="wpos-evidence-title">${posEscape(t('practice.script'))}</p><p lang="ko">${item.script.map(line=>`<span>${posEscape(line.speaker?`${line.speaker}: `:'')}${posEscape(line.text)}</span>`).join('')}</p></div>`:'';
 const explainParagraph=item=>{const found=explainText(item);return found?`<p lang="${posEscape(found.lang)}">${posEscape(found.text)}</p>`:'';};
 // 틀린 문항에만 접어서 둔다.
 const explainBlock=item=>{const body=explainParagraph(item)+scriptBlock(item);return body?`<details class="wpos-explain"><summary>${posEscape(t('position.diagnostic.explain'))}</summary>${body}</details>`:'';};
 // 진단 끝 한 장: 이번에 푼 것과 바뀐 지도. results: createDiagnosticSession().results()
 // items: 문항 id → 문항(해설), practice(skillId): 「이 항목 연습하기」를 달 수 있는지(10-20 검수 #2·#7). 한 문항이라 칸은 모두 「확인 중」이다.
 // 이번에 푼 문항 줄(맞음·틀림 · 틀린 문항은 해설을 접어서) — 진단 끝 화면과 마을 준비 확인 끝 화면이 함께 쓴다.
 // checking: 줄 끝의 「확인 중」(내 위치 판의 칸 상태) — 그 판이 없는 마을 준비 확인 끝 화면은 뺀다.
 function doneRows({map,results=[],items=null,practice=null,checking=true}={}){
  const itemOf=id=>items?.get?.(id)||null;
  return results.filter(row=>!row.skipped).map(row=>{const skill=map?.skills?.find(s=>s.id===row.skillId)||{id:row.skillId},ok=row.verdict==='correct';
   return `<li data-verdict="${posEscape(row.verdict)}" data-skill="${posEscape(row.skillId)}">${posLed(ok?'ok':'alert')}<span class="wpos-done-copy"><strong>${posEscape(skillName(skill))}</strong><small>${posEscape(t(ok?'position.evidence.correct':'position.evidence.incorrect'))}${row.assisted?` · ${posEscape(t('position.evidence.assisted'))}`:''}${checking?` · ${posEscape(t('position.diagnostic.checking'))}`:''}</small>${ok?'':explainBlock(itemOf(row.itemId))}</span>${practiceButton(row.skillId,practice)}</li>`;}).join('');
 }
 // response: 결과 아래 응답 줄(renderSetResponse — 없으면 없음).
 function renderDiagnosticDone({map,results=[],items=null,practice=null,response=null}={}){
  const answered=results.filter(row=>!row.skipped).length,skipped=results.length-answered;
  const rows=doneRows({map,results,items,practice});
  const wrong=results.some(row=>!row.skipped&&row.verdict==='incorrect');
  return `<div class="wpos life-heading" data-position-done tabindex="-1">${poster(t('position.diagnostic.doneTitle'),t('position.diagnostic.doneSummary',{answered,skipped}))}${rows?`<ul class="wpos-done-list">${rows}</ul>`:''}${wrong?`<p class="wpos-note">${posEscape(t('position.diagnostic.wrongNote'))}</p>`:''}<p class="wpos-intro">${posEscape(t('position.diagnostic.doneNote'))}</p><p class="wpos-summary-line">${posEscape(t(map.exam==='topik2'?'position.summary.topik2':'position.summary',{...map.counts,total:map.total}))}</p><button class="felt-button" type="button" data-position-back>${posEscape(t('position.diagnostic.back'))} <span aria-hidden="true">→</span></button>${renderSetResponse(response)}</div>`;
 }

 // ── 마을 준비 확인(싱크타운 학습·개인화 다리 §4-2) ──
 // 싱크타운 화면 글은 2판까지 한국어다(app-shell의 타운 시트와 같다). 문항 판은 진단과 같은 판(renderDiagnosticItem)이라 화면 언어 그대로다.
 // 급수·점수·맞힌 수를 보이지 않는다 — 「마을이 열렸어요」 또는 「조금 더 연습한 뒤에…」와 연습 추천 하나. 이번에 푼 문항의 맞음·틀림과
 // 해설은 진단 끝 화면과 같은 줄로 보인다(WORLD가 원래 보이는 결과).
 const TOWN_POSTER={print:'position',label:'TOWN CHECK'};
 // 머리(패널 제목)가 이미 「마을 준비 확인」이라 본문은 기다림만 말한다. after: 확인 문항을 다 푼 뒤.
 function renderTownCheckWait({after=false}={}){
  return `<div class="wpos life-heading" data-town-wait tabindex="-1" aria-busy="true">${poster('잠시만 기다려 주세요',after?'방금 푼 답까지 모아 확인하고 있어요.':'이미 푼 TOPIK 연습 답으로 먼저 확인하고 있어요.',TOWN_POSTER)}</div>`;
 }
 // outcome: 'passed' · 'access'(확인은 마쳤고 체험·이용권이 없음 — 학습 미통과로 보이지 않는다) · 'held'(통과했지만 입장이 열리지 않음 —
 // 같은 확인을 다시 권하지 않는다) · 'deferred'(확인 문제 판을 맞추는 중) · 'not-yet' · 'short'(낼 새 문항이 모자람) · 'later'(지금은 확인을 마치지 못함).
 // recommend: {skillId}(연습 추천 하나) 또는 null. 학습자는 싱크타운 시트에서 왔으니 끝 화면에서 시트로 돌아가는 길을 늘 둔다.
 function renderTownCheckDone({outcome='not-yet',results=[],map=null,items=null,recommend=null,practice=null}={}){
  const rows=doneRows({map,results,items,checking:false});
  const head=outcome==='passed'?poster('마을이 열렸어요','싱크타운에서 첫 이야기가 기다려요.',TOWN_POSTER)
   :outcome==='access'?poster('마을 준비 확인은 마쳤어요','체험이나 이용권으로 열리는 곳이에요. 이용권 안내는 준비하고 있어요.',TOWN_POSTER)
   :outcome==='held'?poster('확인은 마쳤지만 지금은 마을이 닫혀 있어요','다시 확인하지 않아도 돼요. 다시 열리면 싱크타운에서 들어갈 수 있어요.',TOWN_POSTER)
   :outcome==='deferred'?poster('확인 문제를 새 판으로 맞추고 있어요','준비가 끝나면 다시 확인할 수 있어요. 지금까지 푼 답은 그대로 남아요.',TOWN_POSTER)
   :outcome==='later'?poster('지금은 확인을 마치지 못했어요','잠시 뒤 다시 확인해 주세요. 지금까지 푼 답은 그대로 남아요.',TOWN_POSTER)
   :poster('조금 더 연습한 뒤에 다시 열어 볼 수 있어요',outcome==='short'?'지금은 낼 새 확인 문제가 모자라요. 연습을 조금 더 한 뒤에 다시 열어 주세요.':'다시 확인하는 횟수에는 제한이 없어요. 다음 확인은 새 문제로 나와요.',TOWN_POSTER);
  const skill=recommend&&(map?.skills?.find(s=>s.id===recommend.skillId)||{id:recommend.skillId});
  const back=`<button class="quiet-button" type="button" data-town-open>싱크타운으로 돌아가기</button><button class="quiet-button" type="button" data-town-position>내 위치 보기</button>`;
  const next=outcome==='passed'?`<button class="felt-button" type="button" data-town-open>동네 열기 <span aria-hidden="true">→</span></button>`
   :['access','held'].includes(outcome)?back
   :`${skill&&practice?.(skill.id)?`<section class="wpos-attention" data-town-recommend><p class="life-section-label">NEXT</p><h3>${posEscape(skillName(skill))}</h3><p class="wpos-note">이 항목을 조금 더 연습하면 다음 확인에 도움이 돼요.</p>${practiceButton(skill.id,practice)}</section>`:''}<button class="felt-button" type="button" data-town-recheck>다시 확인하기 <span aria-hidden="true">→</span></button>${back}`;
  return `<div class="wpos life-heading" data-town-done="${posEscape(outcome)}" tabindex="-1" role="status">${head}${next}${rows?`<p class="wpos-evidence-title">이번에 푼 문제</p><ul class="wpos-done-list">${rows}</ul>`:''}</div>`;
 }

 // ── 짧은 연습(world-reading-practice.mjs, 10-20 검수 #1 읽기 · 10-21 ④ 듣기) ──
 // 한 문항: 진단과 같은 문항 그림에, 답한 뒤에는 맞음·틀림과 정답·해설을 바로 보인다(답은 이미 혼자 낸 첫 답으로 남았다).
 // 듣기는 끝까지 들은 뒤에 고르고(시험형은 허용 횟수까지 혼자), 답한 뒤 해설 아래에 들은 대화(대본)를 둔다.
 // feedback: {verdict, choiceId, correctId} 또는 null(아직 답 전). playing: 소리가 나는 중.
 function renderPracticeItem({view,skill=null,notice='',feedback=null,playing=false}={}){
  const item=view.item,done=!!feedback,listening=item.audioRequired??item.modality==='listening',ready=!done&&(view.heard??true);
  const choices=item.choices.map(choice=>{const state=!done?'':choice.id===feedback.correctId?'answer':choice.id===feedback.choiceId?'wrong':'';
   return `<button class="wpos-choice" type="button" data-practice-choice="${posEscape(choice.id)}"${state?` data-state="${state}"`:''}${ready?'':' disabled'}>${posEscape(choice.label)}</button>`;}).join('');
  const ok=feedback?.verdict==='correct';
  const result=done?`<div class="wpos-feedback" data-practice-feedback tabindex="-1" data-verdict="${posEscape(feedback.verdict)}" role="status">${posLed(ok?'ok':'alert')}<strong>${posEscape(t(ok?'practice.right':'practice.wrong'))}</strong>${explainParagraph(item)}${scriptBlock(item)}</div><button class="felt-button" type="button" data-practice-next>${posEscape(t(view.index+1<view.total?'practice.next':'practice.finish'))} <span aria-hidden="true">→</span></button>`:'';
  const listen=listening&&!done?`<div class="wpos-listen"><button class="quiet-button" type="button" data-practice-listen${playing?' aria-busy="true"':''}>${posEscape(listenLabel(view))}</button><p class="wpos-note">${posEscape(listenNote(view,playing))}</p></div>`:'';
  return `<div class="wpos wpos-run" data-practice-run="${posEscape(item.id)}"><div class="wpos-run-head"><span class="wpos-bar" aria-hidden="true"><i style="width:${posFill(view.index,view.total)}%"></i></span><p class="wpos-run-count">${posEscape(t('position.diagnostic.progress',{index:view.index+1,total:view.total}))}</p></div><p class="life-section-label wpos-run-skill" tabindex="-1">${posEscape(t(`position.domain.${item.modality}`))} · ${posEscape(skillName(skill||{id:item.skillId}))}</p>${item.prompt?`<p class="wpos-prompt" lang="ko">${posEscape(item.prompt)}</p>`:''}${item.card?entryCard(item.card):''}${listen}${item.question?item.ask&&has(`position.diagnostic.ask.${item.ask}`)?`<p class="wpos-question">${posEscape(t(`position.diagnostic.ask.${item.ask}`))}</p>`:`<p class="wpos-question" lang="ko">${posEscape(item.question)}</p>`:''}<div class="wpos-choices" lang="ko">${choices}</div>${result}<p class="wpos-run-status" role="status">${posEscape(done?'':notice)}</p>${done?'':`<div class="wpos-run-actions"><button class="quiet-button" type="button" data-practice-skip>${posEscape(t('position.diagnostic.skip'))}</button><button class="quiet-button" type="button" data-practice-stop>${posEscape(t('practice.stop'))}</button></div>`}</div>`;
 }
 // 끝 한 장: 이번 답(혼자 맞힘·틀림·건너뜀) → 그 항목에 실제로 달라진 관측 한 줄 → 틀린 문항 해설 → 다음 한 걸음.
 // before·after: 연습 전후의 그 항목(buildPositionMap의 skills 한 줄). more: 같은 항목에 남은 새 문항 수.
 // count: 다음 짧은 연습의 문항 수(학습자 응답이 3·5·7로 정한다 — 「새 문항 n개 더 하기」의 n). response: 결과 아래 응답 줄.
 // 「한 칸 올라왔어요」처럼 보장되지 않는 단계 말은 쓰지 않고, 칸이 실제로 바뀐 때만 바뀐 칸을 말한다(최종 제안 §3).
 function renderPracticeDone({skill,before=null,after=null,results=[],items=null,more=0,listening=false,count=5,response=null,followup=false}={}){
  const answered=results.filter(row=>!row.skipped),right=answered.filter(row=>row.verdict==='correct'&&row.independent).length;
  const wrong=answered.filter(row=>row.verdict==='incorrect').length,skipped=results.length-answered.length;
  const changed=before&&after&&before.cell!==after.cell?t('practice.changed.cell',{from:t(`position.cell.${before.cell}`),to:t(`position.cell.${after.cell}`)})
   :after&&before&&after.n>before.n?t('practice.changed.more',{n:after.n-before.n}):t('practice.changed.none');
  const now=after?noteText(after.note):'';
  const itemOf=id=>items?.get?.(id)||null;
  const misses=answered.filter(row=>row.verdict==='incorrect').map(row=>{const item=itemOf(row.itemId);return item?`<li><span lang="ko">${posEscape(item.label||item.question||'')}</span>${explainBlock(item)}</li>`:'';}).join('');
  const next=followup?`<p class="wpos-note">${posEscape(t('followup.finished'))}</p>`:more>0?`<button class="felt-button" type="button" data-practice-again>${posEscape(t('practice.again',{n:Math.min(more,Number.isInteger(count)&&count>0?count:5)}))} <span aria-hidden="true">→</span></button>`
   :`<p class="wpos-note" data-practice-shortage>${posEscape(t('practice.shortage'))}</p>`;
  return `<div class="wpos life-heading" data-practice-done tabindex="-1">${poster(t(listening?'practice.doneTitle.listening':'practice.doneTitle'),t('practice.doneSummary',{right,wrong,skipped}))}<section class="wpos-change"><p class="life-section-label">${posEscape(skillName(skill||{}))}</p><p class="wpos-intro">${posEscape(changed)}</p>${now?`<p class="wpos-note">${posEscape(now)}</p>`:''}</section>${misses?`<section class="wpos-misses"><p class="wpos-evidence-title">${posEscape(t('practice.misses'))}</p><ul>${misses}</ul></section>`:''}${next}${renderSetResponse(response)}<div class="wpos-run-actions"><button class="quiet-button" type="button" data-practice-position>${posEscape(t('position.open'))}</button><button class="quiet-button" type="button" data-practice-home>${posEscape(t('practice.home'))}</button></div></div>`;
 }
 // ── 시험 형식 연습(미니 모의 · world-exam-form.mjs, 10-21 ④) ──
 // 안내(줄인 판의 구성·시간·규칙) → 문항(남은 시간·번호판·듣기 허용 횟수) → 영역 사이 → 끝 한 장(영역별 맞힘·틀림·답하지 않음과 틀린 문항
 // 해설, 다음 연습). 점수·급수·합격 가능성은 어디에도 쓰지 않는다. 문항·보기·대본은 한국어 원문(lang="ko").
 const mockClock=ms=>{const total=Math.max(0,Math.ceil((Number(ms)||0)/1000));return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;};
 const sectionName=section=>t(`position.domain.${section}`);
 const examName=exam=>{const id=exam==='topik2'?'topik2':'topik1';return t(`goal.exam.type.${id}`);};
 // 줄인 판에서 빠진 자리: 홑 유형은 번호(「15~16번」), 세트는 수.
 const typeLabel=(from,to)=>Number.isInteger(from)?t(to&&to!==from?'mock.type':'mock.type.one',{from,to}):'';
 const missingText=rows=>rows.map(row=>row.type==='set'?t('mock.missing.set',{n:row.count}):typeLabel(row.from,row.to)).filter(Boolean).join(' · ');
 function renderMockIntro({plan,exam='topik1',mode=null}={}){
  const ready=plan.sections.filter(row=>row.status==='ready'),listening=ready.some(row=>row.section==='listening');
  const parts=ready.map(row=>`<li><span class="wplan-area-name">${posEscape(sectionName(row.section))}</span><span class="wplan-area-count">${posEscape(t('mock.part',{n:row.items.length,minutes:row.minutes}))}</span></li>`).join('');
  const official=ready.map(row=>t('mock.official.part',{section:sectionName(row.section),n:row.official.items,minutes:row.official.minutes})).join(' · ');
  const missing=missingText(ready.flatMap(row=>row.missing||[]));
  const notes=[plan.sections.some(row=>row.status==='audio-off')?t('mock.audioOff'):'',plan.sections.some(row=>['short','none'].includes(row.status))?t('mock.sectionShort'):'',missing?t('mock.missing',{list:missing}):'',mode==='ibt'?t('mock.ibtNote'):''].filter(Boolean);
  const rules=['mock.rules.fresh','mock.rules.time',...(listening?[exam==='topik2'?'mock.rules.plays2':'mock.rules.plays1']:[]),'mock.rules.lock','mock.rules.review','mock.rules.noGrade'];
  return `<div class="wpos life-heading" data-mock-intro tabindex="-1">${poster(t('mock.title'),t('mock.sub',{exam:examName(exam)}),{print:'plan',label:'EXAM FORM'})}`
   +`<section class="wplan-week"><p class="life-section-label">PBT</p><h3>${posEscape(t('mock.form',{exam:examName(exam)}))}</h3><ul class="wplan-areas">${parts}</ul><p class="wpos-note">${posEscape(t('mock.official',{list:official}))}</p>${notes.map(note=>`<p class="wpos-note">${posEscape(note)}</p>`).join('')}</section>`
   +`<section class="wplan-checks"><p class="life-section-label">RULES</p><h3>${posEscape(t('mock.rules.title'))}</h3><ul>${rules.map(key=>`<li><span>${posEscape(t(key))}</span></li>`).join('')}</ul></section>`
   +`<button class="felt-button" type="button" data-mock-start>${posEscape(t('mock.start',{minutes:plan.minutes}))} <span aria-hidden="true">→</span></button><button class="quiet-button" type="button" data-mock-later>${posEscape(t('mock.later'))}</button></div>`;
 }
 // 문항 한 장. view: createMockSession().current · confirm: 답하지 않은 문항이 남았는데 영역을 마치려 할 때 한 번 묻기.
 function renderMockItem({view,playing=false,notice='',confirm=false,parts=[]}={}){
  const item=view.item,listening=item.modality==='listening',last=view.partIndex+1>=view.parts;
  const choices=item.choices.map(choice=>`<button class="wpos-choice" type="button" data-mock-choice="${posEscape(choice.id)}"${choice.id===view.choiceId?' data-state="chosen" aria-pressed="true"':' aria-pressed="false"'}${view.heard&&!view.answered?'':' disabled'}>${posEscape(choice.label)}</button>`).join('');
  const palette=view.marks.map((mark,index)=>`<button type="button" class="wmock-number" data-mock-go="${index}" data-mark="${mark}"${index===view.index?' aria-current="step"':''} aria-label="${posEscape(t(`mock.mark.${mark}`,{n:index+1}))}">${index+1}</button>`).join('');
  const allowed=view.plays?.allowed,heard=view.plays?.completed||0;
  // 소리는 한 번에 하나: 다른 문항의 소리가 나는 중이면 그 번호로 알리고 이 문항의 듣기는 그 소리가 끝날 때까지 막는다.
  const elsewhere=playing&&Number.isInteger(view.sounding)&&view.sounding!==view.index;
  const playNote=elsewhere?t('mock.playingOther',{n:view.sounding+1}):playing?t('position.diagnostic.playing'):view.audio==='failed'&&!view.heard?t('position.diagnostic.audioFailed'):Number.isInteger(allowed)?(heard>=allowed?t('mock.plays.done'):t('mock.plays.left',{heard,allowed})):'';
  const listen=listening?`<div class="wpos-listen"><button class="quiet-button" type="button" data-mock-listen${playing&&!elsewhere?' aria-busy="true"':''}${view.answered||elsewhere||Number.isInteger(allowed)&&heard>=allowed?' disabled':''}>${posEscape(t(view.heard?'position.diagnostic.listenAgain':'position.diagnostic.listen'))}</button><p class="wpos-note">${posEscape(playNote)}</p></div>`:'';
  const left=view.marks.filter(mark=>mark!=='answered').length;
  const submit=confirm&&left>0?`<div class="wmock-confirm" data-mock-confirm tabindex="-1" role="alert"><p>${posEscape(t('mock.confirm',{n:left}))}</p><button class="felt-button" type="button" data-mock-submit>${posEscape(t(last?'mock.submitLast':'mock.submit'))}</button><button class="quiet-button" type="button" data-mock-keep>${posEscape(t('mock.keep'))}</button></div>`
   :`<button class="felt-button" type="button" data-mock-submit>${posEscape(t(last?'mock.submitLast':'mock.submit'))} <span aria-hidden="true">→</span></button>`;
  return `<div class="wpos wpos-run wmock" data-mock-run="${posEscape(item.id)}"><div class="wmock-head"><p class="life-section-label wpos-run-skill" tabindex="-1">${posEscape(sectionName(view.section))} · ${posEscape(t('position.diagnostic.progress',{index:view.index+1,total:view.total}))}</p><p class="wmock-clock"><span class="wmock-clock-label">${posEscape(t('mock.timeLeft'))}</span><span data-mock-clock>${posEscape(mockClock(view.remainingMs))}</span></p></div>`
   +`<nav class="wmock-palette" aria-label="${posEscape(t('mock.palette'))}">${palette}</nav>`
   // 세트 문항: 시험지의 「※ [25~26]」처럼 같은 내용으로 푸는 번호를 알린다(듣기는 재생 셈도 하나 — world-exam-form.mjs).
   +(view.set?`<p class="wpos-note" data-mock-set>${posEscape(t(listening?'mock.set.listening':'mock.set.reading',{first:view.set.first,last:view.set.last}))}</p>`:'')
   +`${item.prompt?`<p class="wpos-prompt" lang="ko">${posEscape(item.prompt)}</p>`:''}${listen}${item.question?item.ask&&has(`position.diagnostic.ask.${item.ask}`)?`<p class="wpos-question">${posEscape(t(`position.diagnostic.ask.${item.ask}`))}</p>`:`<p class="wpos-question" lang="ko">${posEscape(item.question)}</p>`:''}<div class="wpos-choices" lang="ko">${choices}</div>`
   +`<p class="wpos-run-status" role="status" data-mock-status tabindex="-1">${posEscape(notice)}</p>`
   +`<div class="wpos-run-actions"><button class="quiet-button" type="button" data-mock-go="${Math.max(0,view.index-1)}"${view.index===0?' disabled':''}>${posEscape(t('mock.prev'))}</button><button class="quiet-button" type="button" data-mock-go="${Math.min(view.total-1,view.index+1)}"${view.index+1>=view.total?' disabled':''}>${posEscape(t('mock.next'))}</button></div>`
   +`${submit}<button class="quiet-button" type="button" data-mock-stop>${posEscape(t('practice.stop'))}</button></div>`;
 }
 // 영역 사이: 시간이 다 돼 닫힌 영역이면 그 사실을, 다음 영역이 있으면 그 영역의 문항 수·시간을.
 function renderMockBetween({view,parts=[]}={}){
  const next=view.started?parts[view.partIndex+1]:parts[view.partIndex];
  const head=view.started&&view.ended==='time'?t('mock.timeUp',{section:sectionName(view.section)}):t('mock.partDone');
  const sub=next?t('mock.nextPart',{section:sectionName(next.section),n:next.total,minutes:next.minutes}):t('mock.allDone');
  return `<div class="wpos life-heading" data-mock-between tabindex="-1">${poster(head,sub,{print:'plan',label:'EXAM FORM'})}<button class="felt-button" type="button" data-mock-next-section>${posEscape(next?t('mock.startPart',{section:sectionName(next.section)}):t('practice.finish'))} <span aria-hidden="true">→</span></button><button class="quiet-button" type="button" data-mock-stop>${posEscape(t('practice.stop'))}</button></div>`;
 }
 // 끝 한 장. results: createMockSession().results() · items: 문항 id → 문항 · numbers: 공식 유형 id → [첫 번호, 끝 번호]
 // practice(skillId): 틀린 항목의 「이 항목 연습하기」(짧은 연습·게임). 점수·급수로 바꾸지 않는다. response: 결과 아래 응답 줄.
 function renderMockDone({results=[],items=null,plan=null,exam='topik1',mode=null,practice=null,response=null}={}){
  const itemOf=id=>items?.get?.(id)||null,numbers=plan?.numbers||{};
  const rows=results.flatMap(part=>part.items);
  const answered=rows.filter(row=>['correct','incorrect'].includes(row.verdict)).length,total=rows.length;
  const sections=results.map(part=>{
   const right=part.items.filter(row=>row.verdict==='correct').length,wrong=part.items.filter(row=>row.verdict==='incorrect').length;
   const open=part.items.filter(row=>row.opened&&!['correct','incorrect'].includes(row.verdict)).length,unopened=part.items.filter(row=>!row.opened).length;
   const list=part.items.map(row=>{const item=itemOf(row.itemId),range=numbers[row.officialType],ok=row.verdict==='correct',miss=row.verdict==='incorrect';
    const where=range?typeLabel(range[0],range[1]):'';
    return `<li data-verdict="${posEscape(row.verdict||'none')}">${posLed(ok?'ok':miss?'alert':'')}<span class="wpos-done-copy"><strong>${posEscape([where,skillName({id:row.skillId})].filter(Boolean).join(' · '))}</strong><small>${posEscape(t(ok?'position.evidence.correct':miss?'position.evidence.incorrect':row.opened?'mock.unanswered':'mock.unopened'))}</small>${miss?explainBlock(item):''}</span>${miss?practiceButton(row.skillId,practice):''}</li>`;}).join('');
   return `<section class="wplan-checks" data-mock-section="${posEscape(part.section)}"><p class="life-section-label">${posEscape(part.section.toUpperCase())}</p><h3>${posEscape(sectionName(part.section))}</h3><p class="wpos-intro">${posEscape(t('mock.partSummary',{right,wrong,open,unopened}))}</p>${part.ended==='time'?`<p class="wpos-note">${posEscape(t('mock.endedByTime'))}</p>`:''}<ul class="wpos-done-list">${list}</ul></section>`;
  }).join('');
  return `<div class="wpos life-heading" data-mock-done tabindex="-1">${poster(t('mock.doneTitle'),t('mock.doneSummary',{answered,total,exam:examName(exam)}),{print:'plan',label:'EXAM FORM'})}${sections}<p class="wpos-note">${posEscape(t(mode==='ibt'?'mock.noGradeNote.ibt':'mock.noGradeNote'))}</p>${renderSetResponse(response)}<div class="wpos-run-actions"><button class="quiet-button" type="button" data-mock-position>${posEscape(t('position.open'))}</button><button class="quiet-button" type="button" data-mock-home>${posEscape(t('practice.home'))}</button></div></div>`;
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
 // 말하기 연습(10-21): 「말하기 연습 · 유형 이름」(유형 번호를 모르면 말하기 연습만).
 const speakingName=routeId=>{const key=`speaking.type.${String(routeId||'').split(':')[1]}`;return has(key)?`${t('speaking.title')} · ${t(key)}`:t('speaking.title');};
 function planTitle(next){
  const label=String(next.label||next.title||''),strip=suffix=>label.endsWith(suffix)?label.slice(0,-suffix.length):null;
  if(next.route==='practice'&&next.skillId)return posEscape(t(String(next.skillId).split('.')[1]==='listening'?'plan.practice.listening':'plan.practice',{skill:skillName({id:next.skillId})}));
  if(next.route==='position')return posEscape(t('position.diagnostic.title'));
  if(next.route==='mock')return posEscape(t('mock.title'));
  if(next.route==='game'&&next.gameId&&has(`plan.game.${next.gameId}`))return posEscape(t(`plan.game.${next.gameId}`));
  if(next.route==='writing'&&writingName(next.routeId))return posEscape(writingName(next.routeId));
  if(next.route==='speaking')return posEscape(speakingName(next.routeId));
  if(next.id==='world.resume.review'&&has('plan.resumeReview'))return posEscape(t('plan.resumeReview'));
  const resumed=strip(' · 이어 하기'),reviewed=strip(' · 새 상황 복습');
  if(resumed!==null)return withKo('plan.resume',resumed);
  if(reviewed!==null)return withKo('plan.review',reviewed);
  return koSpan(label);
 }
 // count: 짧은 연습 한 판의 문항 수(숙제 단추 「새 문항 n개」의 n — 연습 끝 화면과 같은 값).
 function renderExamPlan({plan,next=null,reason='',count=5}={}){
  const practiceCount=Number.isInteger(count)&&count>0?count:5;
  const exam=plan.exam||{},parts=[exam.type?t(`goal.exam.type.${exam.type}`):'',exam.grade?t('plan.week.grade',{n:exam.grade}):'',exam.date?t('plan.week.date',{date:examDay(exam.date)}):'',exam.mode&&exam.mode!=='unknown'?t(`goal.exam.mode.${exam.mode}`):''].filter(Boolean);
  const head=parts.length?parts.join(' · '):t('plan.week.noExam');
  const notes=new Set(plan.notes||[]);
  // 쓰기 칸(10-22): TOPIK II 쓰기 연습(51~54) 목록을 그 칸에서 바로 연다 — 쓰기는 숙제·다시 확인으로 이어지지 않아(자동 판정이 없다) 여기 말고는 여는 곳이 없다.
  // 쓰기 연습이 열려 있을 때만(문항을 못 읽어 닫힌 주에는 「한 것」만 남은 칸일 수 있다).
  const writingOpen=exam.type==='topik2'&&!notes.has('writing-unavailable');
  const area=row=>`<li data-area="${posEscape(row.area)}"><span class="wplan-area-name">${posEscape(t(`plan.area.${row.area}`))}</span>${dots(row.planned,row.done)}<span class="wplan-area-count">${posEscape(t('plan.area.count',{done:row.done,planned:row.planned}))}</span>${row.classwork?.length?`<small class="wplan-classwork">${row.classwork.map(task=>posEscape(t(task.done?'plan.classwork.done':'plan.classwork.todo',{kind:t(`plan.area.${task.kind}`)}))).join(' · ')}</small>`:''}${row.area==='writing'&&writingOpen?`<button class="quiet-button wplan-area-open" type="button" data-plan-writing="writing">${posEscape(t('writing.row.title'))} <span aria-hidden="true">→</span></button>`:''}</li>`;
  // NOW 제목: 홈(home.mjs planLabel)과 같은 이름. 화면 언어로 바꿀 수 있는 것은 바꾸고, 레슨 제목처럼 한국어 학습 내용은 lang="ko" 칸에 둔다.
  const nextTitle=next?planTitle(next):'';
  const gameOf=id=>String(id||'').split('.').pop();
  // TOPIK II 학생의 계획에서 TOPIK I 항목으로 세는 영역(다리)의 항목은 「TOPIK I · 」을 붙인다 — 이름이 같은 TOPIK II 항목(내 위치 TOPIK II 판)과 갈라 보이게.
  const bridgeName=id=>exam.type==='topik2'&&/^ko\.(listening|reading)\./.test(String(id||''))?`${t('goal.exam.type.topik1')} · `:'';
  const homework=(plan.homework||[]).map(row=>{
   const name=bridgeName(row.skillId)+skillName({id:row.skillId}),games=row.activities||[];
   // 짧은 연습 새 문항이 있으면 그 연습(읽기·듣기), 쓰기는 그 항목을 겨누는 쓰기 과제, 듣기에 연습 문항이 없으면 그 항목 문항이 남은 게임.
   const action=row.shortage?`<small class="wplan-shortage">${posEscape(t(row.blocked==='audio'?'practice.audioOff':'plan.homework.shortage'))}</small>`
    :row.domain!=='writing'&&row.fresh>0?`<button class="quiet-button" type="button" data-plan-practice="${posEscape(row.skillId)}">${posEscape(t('plan.homework.reading',{n:Math.min(row.fresh,practiceCount)}))} <span aria-hidden="true">→</span></button>`
    :row.domain==='writing'?`<button class="quiet-button" type="button" data-plan-writing="${posEscape(games[0])}">${posEscape(writingName(games[0])||t('writing.title'))} <span aria-hidden="true">→</span></button>`
    :`<button class="quiet-button" type="button" data-plan-game="${posEscape(gameOf(games[0]))}">${posEscape(has(`plan.game.${gameOf(games[0])}`)?t(`plan.game.${gameOf(games[0])}`):gameOf(games[0]))} <span aria-hidden="true">→</span></button>`;
   return `<li data-skill="${posEscape(row.skillId)}"><span class="wpos-attention-copy"><strong>${posEscape(name)}</strong><small>${posEscape(t(`position.level.${row.status}`))}</small></span>${action}</li>`;
  }).join('');
  const thisWeek=(plan.checks||[])[0]?.weekStart===plan.week?.start?(plan.checks||[])[0]:null;
  const checks=(plan.checks||[]).map(row=>`<li${row.done?' data-done':''}><span>${posEscape(row.weekStart===plan.week?.start?t('plan.checks.thisWeek'):t('plan.checks.week',{date:day(new Date(row.weekStart).toISOString())}))}</span>${row.done?`<small>${posEscape(t('plan.checks.done'))}</small>`:''}</li>`).join('');
  const reach=plan.reach||{confirmed:0,total:0,evidence:0};
  // TOPIK II 학생: 검수 통과 TOPIK II 문항이 아직 없는 영역만 TOPIK I 항목으로 센다(progress[영역].basis) — 그 영역만 말한다.
  const bridged=exam.type!=='topik2'?[]:plan.progress?['listening','reading'].filter(area=>plan.progress[area]?.basis==='topik1'):reach.basis==='topik1'?['listening','reading']:[];
  return `<div class="wpos wplan life-heading" data-plan-board tabindex="-1">${poster(t('plan.week.title'),head,{print:'plan',label:'MY PLAN'})}`
   +(notes.has('past')?`<section class="wpos-diagnostic" data-plan-past><p class="wpos-intro">${posEscape(t('goal.exam.past'))}</p><button class="quiet-button" type="button" data-view="study">${posEscape(t('plan.week.setGoal'))}</button></section>`:'')
   +`<section class="wplan-week"><p class="life-section-label">THIS WEEK</p><h3>${posEscape(t('plan.week.sessions',{n:plan.sessions?.total||0,minutes:plan.sessions?.minutes||0}))}</h3><ul class="wplan-areas">${(plan.areas||[]).map(area).join('')}</ul><p class="wpos-note">${posEscape(t('plan.week.rest'))}</p>${notes.has('audio-off')?`<p class="wpos-note">${posEscape(t('plan.week.audioOff'))}</p>`:''}${notes.has('reading-unavailable')?`<p class="wpos-note" data-plan-reading-later>${posEscape(t('plan.week.readingLater'))}</p>`:''}${notes.has('writing-unavailable')?`<p class="wpos-note">${posEscape(t('plan.week.writingLater'))}</p>`:''}${notes.has('speaking-audio-off')?`<p class="wpos-note" data-plan-speaking-later>${posEscape(t('plan.week.speakingAudioOff'))}</p>`:''}${notes.has('speaking-unavailable')?`<p class="wpos-note" data-plan-speaking-later>${posEscape(t('plan.week.speakingLater'))}</p>`:''}${notes.has('no-date')?`<p class="wpos-note">${posEscape(t('plan.week.noDate'))}</p>`:''}</section>`
   +(next?`<section class="wplan-next"><p class="life-section-label">NOW</p><h3>${nextTitle}</h3>${reason?`<p class="wpos-note">${posEscape(reason)}</p>`:''}<button class="felt-button" type="button" data-plan-next>${posEscape(t('plan.week.start'))} <span aria-hidden="true">→</span></button></section>`:'')
   +(homework?`<section class="wpos-attention wplan-homework"><p class="life-section-label">HOMEWORK</p><h3>${posEscape(t('plan.homework.title'))}</h3><p class="wpos-note">${posEscape(t('plan.homework.note'))}</p><ul>${homework}</ul></section>`:'')
   +(checks?`<section class="wplan-checks"><p class="life-section-label">CHECK</p><h3>${posEscape(t('plan.checks.title'))}</h3><ul>${checks}</ul><p class="wpos-note">${posEscape(t('plan.checks.note'))}</p>${thisWeek&&!thisWeek.done&&next?.route!=='position'?`<button class="quiet-button" type="button" data-plan-recheck>${posEscape(t('position.diagnostic.start'))} <span aria-hidden="true">→</span></button>`:''}</section>`:'')
   // 말하기 연습(10-21, 시험 정보에서 고른 학생 · 말하기가 열렸을 때만): 이번 주에 아직 안 해 본 유형 수와 연습 열기. 채점·숙제·진행은 없다.
   +(plan.speaking?`<section class="wplan-next" data-plan-speaking-section><p class="life-section-label">SPEAKING</p><h3>${posEscape(t('speaking.title'))}</h3><p class="wpos-note">${posEscape(plan.speaking.untried>0?t('plan.speaking.note',{n:plan.speaking.untried}):t('plan.speaking.noteAll'))}</p><button class="quiet-button" type="button" data-plan-speaking>${posEscape(t('plan.speaking.open'))} <span aria-hidden="true">→</span></button></section>`:'')
   // 시험 형식 연습(미니 모의): 열 수 있을 때만. 실제 구성을 줄인 판 · 시간 · 처음 보는 문항. 급수로 바꾸지 않는다.
   +(plan.mock?.status==='ready'?`<section class="wplan-next" data-plan-mock-section><p class="life-section-label">EXAM FORM</p><h3>${posEscape(t('mock.title'))}</h3><p class="wpos-note">${posEscape(t('mock.planNote',{minutes:plan.mock.minutes,n:plan.mock.total}))}</p><button class="quiet-button" type="button" data-plan-mock>${posEscape(t('mock.open',{minutes:plan.mock.minutes}))} <span aria-hidden="true">→</span></button></section>`:'')
   // 영역별 진행: 「확인한 학습 항목 수」만(점수·합격 준비도가 아니다).
   +`<section class="wplan-reach"><p class="life-section-label">SO FAR</p>${['listening','reading'].filter(area=>plan.progress?.[area]).map(area=>`<p class="wpos-progress" data-plan-progress="${area}"><span>${posEscape(t(`plan.area.${area}`))}${bridged.includes(area)?` · ${posEscape(t('goal.exam.type.topik1'))}`:''} · ${posEscape(t('position.progress',{checked:plan.progress[area].checked,total:plan.progress[area].total}))}</span><span class="wpos-bar" aria-hidden="true"><i style="width:${posFill(plan.progress[area].checked,plan.progress[area].total)}%"></i></span></p>`).join('')}<p class="wpos-intro">${posEscape(t('plan.reach.line',{confirmed:reach.confirmed,total:reach.total,evidence:reach.evidence}))}</p><p class="wpos-note">${posEscape(t('plan.reach.note'))}</p>${bridged.length?`<p class="wpos-note" data-plan-reach-basis>${posEscape(t(bridged.length>1?'plan.reach.topik1Basis':bridged[0]==='listening'?'plan.reach.topik1Basis.listening':'plan.reach.topik1Basis.reading'))}</p>`:''}</section>`
   +`<button class="quiet-button" type="button" data-view="study">${posEscape(t('plan.week.change'))}</button></div>`;
 }
 return Object.freeze({skillName,itemSource,noteText,explainText,renderPositionBoard,renderHangulBoard,renderDiagnosticItem,renderDiagnosticDone,renderTownCheckWait,renderTownCheckDone,renderPracticeItem,renderPracticeDone,renderSetResponse,setResponseText,
  renderMockIntro,renderMockItem,renderMockBetween,renderMockDone,mockClock,renderExamPlan});
}
