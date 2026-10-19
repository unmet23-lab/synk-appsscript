// WORLD 「내 위치」 판의 그림(HTML)과 화면 글. 판단은 하지 않는다 — 칸·근거·진단 목록은 world-position.mjs가
// Core 상태에서 읽어 넘긴 것을 그대로 그린다. 화면 글은 아래 한곳에 모은다(화면 언어 1판의 world-strings.mjs 표가
// 들어오면 같은 키로 옮긴다). 학습 내용(문항·보기)은 늘 한국어 원문이다.

export const POSITION_TEXT=Object.freeze({
 'position.title':'내 위치',
 'position.eyebrow':'MY POSITION',
 'position.open':'내 위치 보기',
 'position.summary':'TOPIK I 15개 항목: 혼자 해냄 {independent} · 연습 중 {practicing} · 아직 {notyet}',
 'position.intro':'처음 보는 문제를 도움 없이 푼 첫 답으로 칸을 정해요. 게임 점수로 급수를 매기거나 합격을 판정하지 않아요.',
 'position.incomplete':'학습 기록을 다 불러오지 못했어요. 지금 칸은 실제보다 비어 보일 수 있고, 짧은 진단도 기록이 돌아온 뒤에 열려요.',
 'position.cell.independent':'혼자 해냄',
 'position.cell.practicing':'연습 중',
 'position.cell.notyet':'아직',
 'position.domain.listening':'듣기',
 'position.domain.reading':'읽기',
 'position.status.recent-independent':'최근 처음 보는 문제를 혼자 풀었어요.',
 'position.status.practice':'혼자 푼 새 문제에서 여러 번 틀렸어요. 다시 연습할 부분이에요.',
 'position.status.checking':'새 문제로 확인하는 중이에요. 몇 번 더 혼자 풀면 칸이 정해져요.',
 'position.status.supported':'도움을 받아 해냈어요. 다음에는 도움을 줄여 확인해요.',
 'position.status.review':'혼자 푼 지 오래됐어요. 새 문제로 다시 확인할 때예요.',
 'position.status.unseen':'아직 혼자 푼 새 문제가 없어요. 약하다는 뜻이 아니에요.',
 'position.evidence.title':'이렇게 본 근거',
 'position.evidence.correct':'맞음',
 'position.evidence.incorrect':'틀림',
 'position.evidence.alone':'혼자',
 'position.evidence.assisted':'도움 받음',
 'position.evidence.level':'난도 {n}',
 'position.evidence.folded':'예전 기록 {n}개는 요약으로만 남아 있어요.',
 'position.evidence.unassessed':'소리가 안 났거나 건너뛴 답 {n}개는 세지 않았어요.',
 'position.evidence.none':'아직 근거가 된 답이 없어요.',
 'position.source.korean-runner':'바람길 듣기 확인',
 'position.source.korean-rhythm':'말의 리듬',
 'position.source.blank-slice':'빈칸 베기',
 'position.source.entry-check':'입장 검사',
 'position.source.talk-rally':'말 랠리',
 'position.source.story-classroom':'선생님이 돌아왔다',
 'position.source.order-rush':'주문 폭주',
 'position.source.korean-racing':'한국어 레이싱',
 'position.source.other':'다른 연습',
 'position.diagnostic.title':'짧은 진단',
 'position.diagnostic.intro':'처음 보는 문항 {n}개로 시작점을 정해요. 문항마다 건너뛸 수 있고, 다음에 다른 문항으로 다시 할 수 있어요.',
 'position.diagnostic.start':'짧은 진단 시작하기',
 'position.diagnostic.again':'다른 문항으로 다시 하기',
 'position.diagnostic.missing':'진단 문항이 아직 없는 항목 {n}개: {skills}',
 'position.diagnostic.audioOff':'오늘은 소리를 끈 날이라 듣기 항목 {n}개는 빼요.',
 'position.diagnostic.allSeen':'준비된 진단 문항을 모두 풀었어요. 새 문항이 생기면 다시 열려요.',
 'position.diagnostic.unknown':'전에 본 문항인지 확인하지 못한 항목 {n}개는 빼요.',
 'position.diagnostic.history':'학습 기록을 다 불러오면 짧은 진단을 할 수 있어요.',
 'position.diagnostic.progress':'{index} / {total}',
 'position.diagnostic.listen':'듣기',
 'position.diagnostic.listenAgain':'다시 듣기',
 'position.diagnostic.listenFirst':'끝까지 들은 뒤에 고를 수 있어요.',
 'position.diagnostic.audioFailed':'소리가 나지 않았어요. 「듣기」를 다시 눌러 주세요.',
 'position.diagnostic.replayNote':'다 들은 뒤 다시 들으면 도움을 받은 답으로 기록해요.',
 'position.diagnostic.time':'지금 {at}',
 'position.diagnostic.bag':'짐: {items}',
 'position.diagnostic.skip':'이 문항 건너뛰기',
 'position.diagnostic.stop':'진단 그만하기',
 'position.diagnostic.saved':'답을 기록했어요.',
 'position.diagnostic.doneTitle':'짧은 진단, 끝!',
 'position.diagnostic.doneSummary':'푼 문항 {answered}개 · 건너뛴 문항 {skipped}개',
 'position.diagnostic.doneNote':'한 문항만으로는 「혼자 해냄」이 되지 않아요. 맞힌 항목은 새 문제로 몇 번 더 확인하고, 틀린 항목부터 연습을 골라요.',
 'position.diagnostic.back':'내 위치로 돌아가기',
 'position.hangul.title':'한글부터',
 'position.hangul.intro':'TOPIK I 항목 지도는 한글 만나기를 마치면 열려요. 지금은 한글을 어디까지 만났는지 보여 드려요.',
 'position.hangul.progress':'한글 만나기 {done} / {total}',
 'position.hangul.continue':'한글 만나기 이어 하기',
 'position.hangul.unknown':'한글 진도를 아직 읽지 못했어요.',
});

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// world-lang.mjs의 t()와 같은 꼴({name} 채우기). 표가 들어오면 이 함수만 t로 바꾼다.
export function say(key,vars){
 const text=Object.prototype.hasOwnProperty.call(POSITION_TEXT,key)?POSITION_TEXT[key]:key;
 return String(text).replace(/\{(\w+)\}/g,(_,name)=>vars&&vars[name]!=null?String(vars[name]):'');
}
const LED={independent:'ok',practicing:'check',notyet:'idle'},POSITION_COUNTS=Object.freeze(['independent','practicing','notyet']);
const day=value=>{const at=Date.parse(value);if(!Number.isFinite(at))return '';const d=new Date(at+9*3600000);return `${d.getUTCMonth()+1}월 ${d.getUTCDate()}일`;};
// 문항 열쇠의 앞 이름으로 어느 연습의 문항인지 말한다. 모르는 앞 이름은 「다른 연습」.
export function itemSource(itemKey){
 const prefix=String(itemKey||'').split('.')[0];
 return Object.prototype.hasOwnProperty.call(POSITION_TEXT,`position.source.${prefix}`)?say(`position.source.${prefix}`):say('position.source.other');
}

function evidenceRows(skill,catalog){
 if(!skill.evidence.length&&!skill.folded)return `<p class="wpos-empty">${escape(say('position.evidence.none'))}</p>`;
 const rows=skill.evidence.map(row=>{
  const label=catalog?.(row.itemKey)||itemSource(row.itemKey),tone=row.verdict==='correct'?'ok':'alert';
  return `<li class="wpos-evidence" data-verdict="${escape(row.verdict)}" data-assisted="${row.assisted?'true':'false'}"><span class="wpos-led" data-tone="${tone}" aria-hidden="true"></span><span class="wpos-evidence-main"><strong>${escape(say(`position.evidence.${row.verdict==='correct'?'correct':'incorrect'}`))} · ${escape(say(row.assisted?'position.evidence.assisted':'position.evidence.alone'))}</strong><small>${escape(label)}${row.difficulty?` · ${escape(say('position.evidence.level',{n:row.difficulty}))}`:''}</small></span><time datetime="${escape(row.at)}">${escape(day(row.at))}</time></li>`;
 }).join('');
 return `${rows?`<ul class="wpos-evidence-list">${rows}</ul>`:''}${skill.folded?`<p class="wpos-note">${escape(say('position.evidence.folded',{n:skill.folded}))}</p>`:''}`;
}
function skillRow(skill,catalog){
 return `<details class="wpos-skill" data-skill="${escape(skill.id)}" data-cell="${escape(skill.cell)}" data-status="${escape(skill.status)}"><summary><span class="wpos-skill-name">${escape(skill.label)}</span><span class="wpos-chip" data-tone="${LED[skill.cell]}"><span class="wpos-led" data-tone="${LED[skill.cell]}" aria-hidden="true"></span>${escape(say(`position.cell.${skill.cell}`))}</span></summary><div class="wpos-skill-body"><p class="wpos-status">${escape(say(`position.status.${skill.status}`))}</p><p class="wpos-evidence-title">${escape(say('position.evidence.title'))}</p>${evidenceRows(skill,catalog)}${skill.unassessed?`<p class="wpos-note">${escape(say('position.evidence.unassessed',{n:skill.unassessed}))}</p>`:''}</div></details>`;
}
const skillNames=(map,ids)=>ids.map(id=>map.skills.find(skill=>skill.id===id)?.label||id).join(' · ');
function diagnosticBlock(map,plan,{done=false}={}){
 if(!plan)return '';
 const notes=[],by=reason=>plan.missing.filter(row=>row.reason===reason).map(row=>row.skillId);
 if(plan.reason==='history.incomplete')notes.push(say('position.diagnostic.history'));
 else{
  const none=by('no-item'),audio=by('audio'),unknown=by('unknown'),seen=by('all-seen');
  if(none.length)notes.push(say('position.diagnostic.missing',{n:none.length,skills:skillNames(map,none)}));
  if(audio.length)notes.push(say('position.diagnostic.audioOff',{n:audio.length}));
  if(unknown.length)notes.push(say('position.diagnostic.unknown',{n:unknown.length}));
  if(seen.length&&!plan.items.length)notes.push(say('position.diagnostic.allSeen'));
 }
 const ready=plan.status==='ready'&&plan.items.length>0;
 return `<section class="wpos-diagnostic" data-diagnostic="${ready?'ready':'unavailable'}"><p class="life-section-label">DIAGNOSTIC</p><h3>${escape(say('position.diagnostic.title'))}</h3>${ready?`<p>${escape(say('position.diagnostic.intro',{n:plan.items.length}))}</p>`:''}${notes.map(note=>`<p class="wpos-note">${escape(note)}</p>`).join('')}${ready?`<button class="felt-button" type="button" data-position-diagnostic>${escape(say(done?'position.diagnostic.again':'position.diagnostic.start'))} <span aria-hidden="true">→</span></button>`:''}</section>`;
}

// map: buildPositionMap 결과 · plan: selectDiagnostic 결과(없으면 진단 칸 없음) · catalog(itemKey): 문항 이름(없으면 연습 이름)
export function renderPositionBoard({map,plan=null,catalog=null,diagnosed=false}={}){
 const groups=['listening','reading'].map(domain=>{
  const skills=map.skills.filter(skill=>skill.domain===domain);
  return `<section class="wpos-group" data-domain="${domain}"><h3>${escape(say(`position.domain.${domain}`))} <span>${skills.length}</span></h3><div class="wpos-skills">${skills.map(skill=>skillRow(skill,catalog)).join('')}</div></section>`;
 }).join('');
 const counts=POSITION_COUNTS.map(cell=>`<li data-cell="${cell}"><span class="wpos-led" data-tone="${LED[cell]}" aria-hidden="true"></span><strong>${map.counts[cell]}</strong><span>${escape(say(`position.cell.${cell}`))}</span></li>`).join('');
 return `<div class="wpos" data-position-board><div class="life-poster wpos-poster"><small class="life-poster-label">${escape(say('position.eyebrow'))}</small><strong class="life-poster-word">${escape(say('position.title'))}</strong><p class="life-poster-sub wpos-summary">${escape(say('position.summary',map.counts))}</p></div><ul class="wpos-counts" aria-label="${escape(say('position.summary',map.counts))}">${counts}</ul><p class="wpos-intro">${escape(say('position.intro'))}</p>${map.evidenceComplete?'':`<p class="wpos-note" data-position-incomplete>${escape(say('position.incomplete'))}</p>`}${diagnosticBlock(map,plan,{done:diagnosed})}${groups}</div>`;
}

// 한글 만나기 졸업 전: 항목 지도 대신 한글 진도. progress: {done,total}(모르면 null)
export function renderHangulBoard({progress=null}={}){
 const known=progress&&Number.isInteger(progress.done)&&Number.isInteger(progress.total)&&progress.total>0;
 const ratio=known?Math.max(0,Math.min(1,progress.done/progress.total)):0;
 return `<div class="wpos" data-position-board="hangul"><div class="life-poster wpos-poster"><small class="life-poster-label">${escape(say('position.eyebrow'))}</small><strong class="life-poster-word">${escape(say('position.hangul.title'))}</strong><p class="life-poster-sub">${escape(say('position.hangul.intro'))}</p></div>${known?`<div class="wpos-hangul"><p>${escape(say('position.hangul.progress',progress))}</p><span class="wpos-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${progress.total}" aria-valuenow="${progress.done}"><i style="width:${(ratio*100).toFixed(1)}%"></i></span></div>`:`<p class="wpos-note">${escape(say('position.hangul.unknown'))}</p>`}<button class="felt-button" type="button" data-position-hangul>${escape(say('position.hangul.continue'))} <span aria-hidden="true">→</span></button></div>`;
}

// 입장 검사처럼 안내문을 읽고 손님에게 적용하는 문항: 안내문 · 시각 · 손님의 표 · 짐 · 손님의 말을 글로 보인다.
function entryCard(card){
 const rows=card.doc.rows.map(([name,value])=>`<div><dt>${escape(name)}</dt><dd>${escape(value)}</dd></div>`).join('');
 return `<div class="wpos-card" lang="ko"><section class="wpos-notice"><p class="wpos-notice-title">${escape(card.notice.title)}</p><ul>${card.notice.rules.map(rule=>`<li>${escape(rule)}</li>`).join('')}</ul></section><section class="wpos-guest"><p class="wpos-guest-time">${escape(say('position.diagnostic.time',{at:card.at}))}</p><p class="wpos-notice-title">${escape(card.doc.title)}</p><dl>${rows}</dl>${card.bag.length?`<p class="wpos-bag">${escape(say('position.diagnostic.bag',{items:card.bag.join(', ')}))}</p>`:''}<p class="wpos-line"><span>${escape(card.who)}</span>「${escape(card.line)}」</p></section></div>`;
}
// 진단 한 문항. view: createDiagnosticSession().current · notice: 들려줄 안내 한 줄(없으면 비움)
export function renderDiagnosticItem({view,skillLabel='',notice=''}={}){
 const item=view.item,listening=item.audioRequired??item.modality==='listening',ready=view.heard&&!view.answered;
 const choices=item.choices.map(choice=>`<button class="wpos-choice" type="button" data-position-choice="${escape(choice.id)}"${ready?'':' disabled'}>${escape(choice.label)}</button>`).join('');
 return `<div class="wpos wpos-run" data-position-run="${escape(item.id)}"><div class="wpos-run-head"><span class="wpos-progress" aria-hidden="true"><i style="width:${(((view.index)/view.total)*100).toFixed(1)}%"></i></span><p class="wpos-run-count">${escape(say('position.diagnostic.progress',{index:view.index+1,total:view.total}))}</p></div><p class="life-section-label">${escape(say(`position.domain.${item.modality}`))} · ${escape(skillLabel)}</p>${item.prompt?`<p class="wpos-prompt" lang="ko">${escape(item.prompt)}</p>`:''}${item.card?entryCard(item.card):''}${listening?`<div class="wpos-listen"><button class="quiet-button" type="button" data-position-listen>${escape(say(view.heard?'position.diagnostic.listenAgain':'position.diagnostic.listen'))}</button><p class="wpos-note">${escape(say(view.heard?'position.diagnostic.replayNote':'position.diagnostic.listenFirst'))}</p></div>`:''}${item.question?`<p class="wpos-question" lang="ko">${escape(item.question)}</p>`:''}<div class="wpos-choices" lang="ko">${choices}</div><p class="wpos-run-status" role="status">${escape(notice)}</p><div class="wpos-run-actions"><button class="quiet-button" type="button" data-position-skip>${escape(say('position.diagnostic.skip'))}</button><button class="quiet-button" type="button" data-position-stop>${escape(say('position.diagnostic.stop'))}</button></div></div>`;
}

// 진단 끝 한 장: 이번에 푼 것과 바뀐 지도. results: createDiagnosticSession().results()
export function renderDiagnosticDone({map,results=[]}={}){
 const answered=results.filter(row=>!row.skipped).length,skipped=results.length-answered;
 const rows=results.filter(row=>!row.skipped).map(row=>{const skill=map.skills.find(s=>s.id===row.skillId);const tone=row.verdict==='correct'?'ok':'alert';
  return `<li data-verdict="${escape(row.verdict)}"><span class="wpos-led" data-tone="${tone}" aria-hidden="true"></span><strong>${escape(skill?.label||row.skillId)}</strong><span>${escape(say(`position.evidence.${row.verdict==='correct'?'correct':'incorrect'}`))}${row.assisted?` · ${escape(say('position.evidence.assisted'))}`:''}</span></li>`;}).join('');
 return `<div class="wpos" data-position-done><div class="life-poster wpos-poster"><small class="life-poster-label">${escape(say('position.eyebrow'))}</small><strong class="life-poster-word">${escape(say('position.diagnostic.doneTitle'))}</strong><p class="life-poster-sub">${escape(say('position.diagnostic.doneSummary',{answered,skipped}))}</p></div>${rows?`<ul class="wpos-done-list">${rows}</ul>`:''}<p class="wpos-intro">${escape(say('position.diagnostic.doneNote'))}</p><p class="wpos-summary-line">${escape(say('position.summary',map.counts))}</p><button class="felt-button" type="button" data-position-back>${escape(say('position.diagnostic.back'))} <span aria-hidden="true">→</span></button></div>`;
}
