'use strict';
// 학생 관리의 「그리기」(겉) — 시안 3 「한 장」(유호님 11-27 「오케이 시안 3으로 가자」, 시안 docs/디자인/워크스페이스_출결TOPIK_20261127/3-한장.html #students).
// 흰 종이 한 장 위 왼쪽은 날짜 · 문장 요약 · 오늘 반, 오른쪽은 「챙길 차례」를 달별로 둔다. 학생 카드는 그 목록 안에서 펼쳐진다.
// 겉을 바꿀 때는 이 파일과 students.css만 바꾼다. students.js가 넘기는 보기 자료(vm)를 받아 HTML만 돌려주고, 상태를 고치거나 서버를 부르지 않는다.
// 지켜야 할 약속(students.js가 읽는 것): 뿌리 #students-root, 펼친 카드 안 [data-st-form][data-key]와 name 붙은 칸, 단추의 data-st-action
//   (branch[data-branch] · stage[data-stage] · reload · sign-in · others · card[data-class][data-learner][data-anchor] · stay-close · stay-save(폼의 제출 단추) · stay-delete),
//   초점을 되돌릴 자리 [data-st-focus], 젤리 알약 묶음 [data-st-jelly], 지점 고르기 select[data-st-branch-for],
//   막대 너비 [data-st-w](회사 CSP가 인라인 style을 막아 students.js가 CSSOM으로 넣는다), LAB 반 화면 링크 a[data-action="tab"][data-tab="teaching"].
const StudentsView=(()=>{
  // 전역 escape는 브라우저 내장(퍼센트 인코딩)과 이름이 같아 믿지 않는다. 이 파일의 HTML 이스케이프만 쓴다(카본 A8).
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const parts=value=>String(value||'').split('-').map(Number);
  const day=value=>{if(!value)return '';const [,m,d]=parts(value);return `${m}월 ${d}일`;};
  const ymd=value=>{if(!value)return '';const [y,m,d]=parts(value);return `${y}.${String(m).padStart(2,'0')}.${String(d).padStart(2,'0')}`;};
  // 「만료」를 한 번만 쓴다: 만료 D-30 · 오늘 만료 · 만료 3일 지남(카본 A9).
  const until=n=>n<0?`만료 ${-n}일 지남`:n===0?'오늘 만료':`만료 D-${n}`;
  const notice=n=>n?`<p class="st-notice${n.error?' st-error':''}" role="${n.error?'alert':'status'}">${esc(n.text)}</p>`:'';
  const head=(title,lede='')=>`<header class="st-head"><p class="st-kicker">학생 관리</p><h1 id="st-title">${esc(title)}</h1>${lede?`<p class="st-lede">${esc(lede)}</p>`:''}</header>`;
  const n=(value,tone='')=>`<b class="st-n${tone?' st-'+tone:''}">${esc(value)}</b>`;

  // 왼쪽 문장 요약: 알약은 이름 하나에만 둔다. 수는 글 속 굵은 숫자다.
  function say(s){
    let h=esc(s.scope)+' ';
    if(!s.classCount)h+='배정된 반이 없어요.';
    else if(!s.recorded)h+='아직 출결을 찍은 반이 없어요.';
    else h+=s.rate===null?'찍은 학생은 모두 공결이에요.':`찍은 반에서 ${n(s.came)}명이 왔어요. 찍은 학생의 ${n(s.rate+'%')}예요.`;
    const among=s.stageLabel?`${esc(s.stageLabel)} 학생 가운데 `:'';
    h+=s.who?` ${among}챙길 학생은 ${n(s.who)}명이에요.`:` ${among}챙길 학생은 없어요.`;
    const t=s.top;
    if(t)h+=` 가장 급한 일은 <button type="button" class="st-name${t.tone?' st-'+t.tone:''}" data-st-action="card" data-class="${esc(t.classId)}" data-learner="${esc(t.learnerId)}" data-anchor="${esc(t.anchor)}" data-st-focus="say-name">${esc(t.name)}</button>의 ${esc(t.what)}${esc(t.ending)}.`;
    return `<p class="st-say">${h}</p>`;
  }
  function classRow(c,branchOptions,locked){
    // 지점이 정해진 반도 고르기를 둔다. 바꿀 때는 students.js가 한 번 묻는다.
    // 반이 닫힌 지점에 매달려 있으면 그 지점을 「닫힌 지점」으로 골라 둔 채 보인다. 켜진 지점 목록에 없다고 다른 지점처럼 보이지 않게 한다(Fable 다시 검수 FA1).
    const current=c.branchId&&!branchOptions.some(b=>b.id===c.branchId)?`<option value="${esc(c.branchId)}" selected>${esc(c.branchName)} (닫힌 지점)</option>`:'';
    const options=(c.branchId?'':'<option value="">지점 고르기</option>')+current+branchOptions.map(b=>`<option value="${esc(b.id)}" ${b.id===c.branchId?'selected':''}>${esc(b.name)}</option>`).join('');
    const pick=`<label class="st-pick"><span class="st-sr">${esc(c.name)} 지점</span><select data-st-branch-for="${esc(c.id)}" data-st-focus="branch-for:${esc(c.id)}" ${locked?'disabled':''}>${options}</select></label>`;
    const meter=!c.total?'<span class="st-q">공유를 켠 학생이 없어요</span>'
      :`<span class="st-meter" role="img" aria-label="공유 켠 학생 ${c.total}명 가운데 출석 ${c.done}명${c.recorded?'':', 아직 찍지 않음'}"><i><span data-st-w="${c.recorded?c.width:0}"></span></i></span><span class="st-count">${c.recorded?`${c.done} / ${c.total}`:`아직 · ${c.total}명`}</span>`;
    const k=c.counts,marks=[k.absent?`<span class="st-bad">결석 ${k.absent}</span>`:'',k.late?`<span class="st-warn">지각 ${k.late}</span>`:'',k.excused?`공결 ${k.excused}`:''].filter(Boolean);
    const go=`href="/?tab=teaching" data-action="tab" data-tab="teaching" data-st-focus="go:${esc(c.id)}"`;
    const act=!c.total?'':k.unrecorded?(c.primary?`<a class="st-go" ${go}>반에서 출결 찍기</a>`:`<a class="st-go-quiet" ${go}>반에서 찍기</a>`)
      :`<span class="st-t">${marks.length?marks.join(' · '):'모두 출석'}</span>`;
    return `<li class="st-cl"><div class="st-cl-t"><b class="st-cl-name">${esc(c.name)}</b><small>${c.branchName?`${pick}<span>${esc(day(c.sessionDate))}</span>`:pick}</small></div><div class="st-cl-m">${meter}</div><div class="st-cl-a">${act}</div></li>`;
  }
  function jellyGroup(key,label,buttons){return `<div class="st-jg" role="group" aria-label="${esc(label)}" data-st-jelly="${esc(key)}">${buttons}</div>`;}
  function agendaRow(i,cardHtml){
    const open=Boolean(i.open);
    const row=`<button type="button" class="st-ag" data-st-action="card" data-class="${esc(i.classId)}" data-learner="${esc(i.learnerId)}" data-anchor="${esc(i.anchor)}" data-st-focus="ag:${esc(i.classId)}:${esc(i.learnerId)}:${esc(i.anchor)}" aria-expanded="${open}"${open?' aria-controls="st-card"':''}>`
      +`<span class="st-ag-d">${esc(i.date)}</span><span class="st-ag-w"><b>${esc(i.name)}</b> ${esc(i.what)}<small>${esc(i.where)}</small></span>`
      +`<em class="${i.tone?'st-'+esc(i.tone):''}">${esc(i.tail)}</em>${i.spoken?`<span class="st-sr">${esc(i.spoken)}</span>`:''}</button>`;
    return row+(open?cardHtml:'');
  }
  function inner(vm){
    if(vm.phase==='loading')return head('학생 관리')+notice(vm.notice)+'<p class="st-empty" role="status">학생 관리를 여는 중이에요.</p>';
    if(vm.phase==='signin')return head('SYNK ID로 로그인해 주세요','학생 기록은 「LAB 한국어 수업」과 같은 로그인으로 열어요. 반에 배정된 선생님과 원장만, 계정을 잇고 공유를 켠 학생만 볼 수 있어요.')+notice(vm.notice)
      +`<div class="st-signin">${vm.signin.message?`<p class="st-muted">${esc(vm.signin.message)}</p>`:''}<button type="button" class="st-primary" data-st-action="sign-in" data-st-focus="sign-in" ${vm.signin.restoring?'disabled':''}>${vm.signin.restoring?'로그인을 확인하는 중이에요':'SYNK ID로 로그인'}</button>${vm.signin.restoring?' <button type="button" class="st-secondary" data-st-action="reload" data-st-focus="reload">다시 확인</button>':''}</div>`;
    if(vm.phase==='empty')return head('학생 관리')+notice(vm.notice)+(vm.canReload?'<button type="button" class="st-secondary" data-st-action="reload" data-st-focus="reload">다시 불러오기</button>':'');
    // 다시 불러오는 동안 단추가 그렇다고 보인다(Fable 다시 검수 FA3).
    const reloadButton=vm.phase==='closed'?`<button type="button" class="st-secondary" data-st-action="reload" data-st-focus="reload" ${vm.closed.loading?'disabled':''}>${vm.closed.loading?'다시 확인하는 중이에요':'다시 불러오기'}</button>`:'';
    if(vm.phase==='closed')return (vm.closed.unavailable
      ?head('학생 기록을 지금 불러오지 못했어요',`수업 서버가 이번에는 학생 기록을 붙이지 못했어요. 담당 반 ${vm.closed.classCount}개는 그대로예요. 잠시 뒤 다시 불러와 주세요.`)
      :head('학생 관리 기록은 아직 열리지 않았어요',`개인정보 처리방침에 출결 · TOPIK · 재학 기록 항목을 공개한 뒤 켜요. 지금은 담당 반 ${vm.closed.classCount}개가 보여요.`))+notice(vm.notice)+`<div class="st-signin">${reloadButton}</div>`;
    const r=vm.ready,rules=r.rules;
    const chips=jellyGroup('branch','지점',r.chips.map(c=>`<button type="button" data-st-action="branch" data-branch="${esc(c.id)}" data-st-focus="branch:${esc(c.id)}" aria-pressed="${c.pressed}">${esc(c.label)}</button>`).join(''));
    const rows=r.classes.map(c=>classRow(c,r.branchOptions,r.desktopOld)).join('')||'<li class="st-empty">이 지점에 배정된 반이 없어요.</li>';
    const main=`<section class="st-main" aria-labelledby="st-title"><h1 class="st-sr" id="st-title">학생 관리</h1>${chips}
      <div class="st-day"><p class="st-date">${esc(r.dateLabel)}</p><p class="st-basis">배정된 반 ${r.assignedClassCount}개 기준 · 반마다 그 지점의 날짜로 봐요${r.loading?' · 새로 읽는 중':''} <button type="button" class="st-link" data-st-action="reload" data-st-focus="reload">새로 고침</button></p></div>
      ${say(r.say)}
      <h2 class="st-h2">오늘 반<em><b>${r.classes.length}</b>개 반</em></h2><ul class="st-cls">${rows}</ul>
      <p class="st-foot">출결과 TOPIK 성적은 LAB 수업의 반 화면에서 넣어요. 이 화면에서는 반의 지점과 학생의 재학 기록을 고쳐요.</p></section>`;
    const stages=jellyGroup('stage','학생 한 명의 길',`<button type="button" data-st-action="stage" data-stage="" data-st-focus="stage:" aria-pressed="${!r.stageFilter}">모두<em>${r.sharedCount}</em></button>`
      +r.stages.map(s=>`<button type="button" data-st-action="stage" data-stage="${esc(s.id)}" data-st-focus="stage:${esc(s.id)}" aria-pressed="${s.pressed}">${esc(s.label)}<em>${s.count}</em></button>`).join(''));
    const cardHtml=r.card?card(r.card):'';
    let agenda='';
    for(const g of r.agenda)agenda+=`<h3 class="st-ag-h">${esc(g.label)}</h3>`+g.items.map(i=>agendaRow(i,cardHtml)).join('');
    if(!r.agenda.length)agenda=`<p class="st-empty">${esc(r.emptyText)}</p>`;
    const o=r.others;
    const others=o.items.length?`<div class="st-others"><button type="button" class="st-others-t" data-st-action="others" data-st-focus="others" aria-expanded="${o.open}">알림 없는 학생 <b>${o.items.length}</b>명${o.open?' 접기':' 보기'}</button>${o.open?o.items.map(i=>agendaRow(i,cardHtml)).join(''):''}</div>`:'';
    const off=o.off.length?`<p class="st-off">공유를 끈 학생 ${o.off.length}명(${esc(o.off.join(', '))})은 기록하지 않아요.</p>`:'';
    const side=`<aside class="st-side" aria-labelledby="st-side-t"><h2 id="st-side-t">챙길 차례</h2>
      <p class="st-lead">연속 결석, 낮은 출석, 이미 지난 만료를 먼저 두고 체류와 TOPIK은 끝나는 날 차례로 둬요. 체류는 ${rules.staySoonDays}일, TOPIK은 ${rules.topikSoonDays}일 전부터 알려요. 출석은 ${rules.attendanceMinimum}% 아래면 알려요(대학 출석률은 어학연수 D-4만).</p>
      ${stages}${r.cardLoose?cardHtml:''}<div class="st-agenda">${agenda}</div>${others}${off}</aside>`;
    return notice(vm.notice)+`<div class="st-wrap">${main}${side}</div>`;
  }
  function page(innerHtml){return `<section class="st-page"><div id="students-root">${innerHtml}</div></section>`;}
  function card(c){
    const opt=(list,value,blank)=>(blank?`<option value="">${blank}</option>`:'')+list.map(o=>`<option value="${esc(o.id)}" ${o.id===value?'selected':''}>${esc(o.label)}</option>`).join('');
    const f=c.fields,field=(label,control,wide=false)=>`<label class="st-f${wide?' st-wide':''}"><span>${label}</span>${control}</label>`;
    const topik=c.topik?`TOPIK ${esc(c.topik.kind)} ${esc(c.topik.level)}급 · ${c.topik.daysLeft>0?`${ymd(c.topik.expiresOn)}까지(D-${c.topik.daysLeft})`:`${ymd(c.topik.expiresOn)} 만료`}`:'유효한 성적 없음';
    // 저장이 폼의 하나뿐인 제출 단추다. 칸에서 Enter를 누르면 닫히지 않고 저장된다. 저장하는 동안에는 닫기도 막는다(카본 A2).
    return `<div class="st-card" id="st-card" role="group" aria-labelledby="st-card-t"><form class="st-card-form" data-st-form data-key="${esc(c.key)}" tabindex="-1">
    <header><p id="st-card-t"><b>${esc(c.name)}</b> ${esc(c.className)}${c.branchName?` · ${esc(c.branchName)}`:''}</p><button type="button" class="st-close" data-st-action="stay-close" data-st-focus="card-close" ${c.saving?'disabled':''}>닫기</button></header>
    <ol class="st-path">${c.steps.map((s,i)=>`<li class="${s.state}"><i>${i+1}</i>${esc(s.label)}</li>`).join('')}</ol>
    <dl class="st-kv"><dt>대표 TOPIK</dt><dd>${topik}</dd><dt>반 출석</dt><dd>${c.attendance?`${esc(c.attendance.percent)}% · 최근 ${esc(c.attendance.recorded)}회`:'기록 없음'}</dd>${c.stay?`<dt>체류</dt><dd class="${c.stay.tone?'st-'+c.stay.tone:''}">${ymd(c.stay.expiresOn)} · ${esc(until(c.stay.daysLeft))}</dd>`:''}</dl>
    <div class="st-fields">
      ${field('단계',`<select name="stage">${opt(c.options.stages,f.stage)}</select>`)}
      ${field('비자',`<select name="visaKind">${opt(c.options.visas,f.visaKind,'없음')}</select>`)}
      ${field('체류 만료일',`<input type="date" name="stayExpiresOn" value="${esc(f.stayExpiresOn)}">`)}
      ${field('대학',`<input name="university" maxlength="80" value="${esc(f.university)}">`)}
      ${field('과정',`<input name="program" maxlength="80" value="${esc(f.program)}" placeholder="학부 1학년, 어학당">`)}
      ${field('입국일',`<input type="date" name="enteredOn" value="${esc(f.enteredOn)}">`)}
      ${field('멘토',`<select name="mentorStaffId">${opt(c.options.staff,f.mentorStaffId,'정하지 않음')}</select>`)}
      ${field('대학 출석률(%)',`<input type="number" name="universityAttendance" min="0" max="100" step="1" inputmode="numeric" value="${esc(f.universityAttendance)}">`)}
      ${field('출석률 기준일',`<input type="date" name="universityAttendanceOn" value="${esc(f.universityAttendanceOn)}">`)}
      ${field('메모',`<textarea name="note" maxlength="200" rows="2">${esc(f.note)}</textarea>`,true)}
    </div>
    ${c.mentorGone?`<p class="st-notice">지금 멘토(${esc(c.mentorGone)})는 이 반 담당이 아니에요. 저장하려면 이 반 선생님 가운데서 멘토를 다시 골라 주세요.</p>`:''}
    ${c.error?`<p class="st-notice st-error" role="alert">${esc(c.error)}</p>`:''}${c.done&&!c.error?`<p class="st-notice st-done" role="status">${esc(c.done)}</p>`:''}${c.desktopOld&&!c.error?`<p class="st-notice st-error" role="alert">이 PC 앱은 아직 학생 기록 저장을 몰라요. PC 앱을 새 판으로 업데이트하거나 브라우저의 워크스페이스에서 저장해 주세요.</p>`:''}
    <footer>${c.hasRecord?`<button type="button" class="st-delete" data-st-action="stay-delete" data-st-focus="card-delete" ${c.saving||c.desktopOld?'disabled':''}>재학 기록 지우기</button>`:'<span></span>'}<button type="submit" class="st-save" data-st-action="stay-save" data-st-focus="card-save" ${c.saving||c.desktopOld?'disabled':''}>${c.saving?'저장하는 중이에요':'재학 기록 저장'}</button></footer>
  </form></div>`;
  }
  return Object.freeze({page,inner,card});
})();
