'use strict';
// 학생 관리의 「그리기」(겉) — 지금은 워크스페이스 로비 노란 판 결(students.css)이다.
// 유호님 11-27: 시안 셋 가운데 고르시면 그 겉으로, 마음에 드는 것이 없으면 이 노란 화면으로 간다. 그래서 자료와 동작(students.js)과 겉을 나눴다.
// 겉을 바꿀 때는 이 파일과 students.css만 바꾼다. students.js가 넘기는 보기 자료(vm)를 받아 HTML만 돌려주고, 상태를 고치거나 서버를 부르지 않는다.
// 지켜야 할 약속(students.js가 읽는 것): 뿌리 #students-root, 대화 상자 안 [data-st-form]과 name 붙은 칸, 단추의 data-st-action
//   (branch[data-branch] · stage[data-stage] · reload · sign-in · card[data-class][data-learner] · stay-close · stay-save(폼의 제출 단추) · stay-delete), 지점 고르기 select[data-st-branch-for],
//   막대 너비 [data-st-w](회사 CSP가 인라인 style을 막아 students.js가 CSSOM으로 넣는다), LAB 반 화면 링크 a[data-action="tab"][data-tab="teaching"].
const StudentsView=(()=>{
  // 전역 escape는 브라우저 내장(퍼센트 인코딩)과 이름이 같아 믿지 않는다. 이 파일의 HTML 이스케이프만 쓴다(카본 A8).
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const day=value=>{if(!value)return '';const [,m,d]=value.split('-').map(Number);return `${m}월 ${d}일`;};
  // 「만료」를 한 번만 쓴다: 만료 D-30 · 오늘 만료 · 만료 3일 지남(카본 A9).
  const until=n=>n<0?`만료 ${-n}일 지남`:n===0?'오늘 만료':`만료 D-${n}`;
  const head=`<header class="st-head"><div><p class="st-kicker">SYNK · 학원과 유학생</p><h1 id="st-title">학생 관리</h1><p class="st-lede">해외 지점과 한국 담당이 같은 화면에서 오늘 출결, 학생 한 명의 길, 체류와 TOPIK 만료를 챙겨요.</p></div></header>`;
  const notice=n=>n?`<p class="st-notice${n.error?' st-error':''}" role="${n.error?'alert':'status'}">${esc(n.text)}</p>`:'';
  function tag(k){
    if(k.kind==='stay')return `<span class="st-tag${k.state==='within120'?'':' st-tag-urgent'}">체류${k.visaKind?' '+esc(k.visaKind):''} ${until(k.daysLeft)}</span>`;
    if(k.kind==='topik')return `<span class="st-tag${k.state==='within90'?'':' st-tag-urgent'}">TOPIK ${esc(k.level)}급 ${until(k.daysLeft)}</span>`;
    if(k.kind==='attendance')return `<span class="st-tag st-tag-urgent">${k.source==='university'?'대학 ':''}출석 ${esc(k.percent)}%</span>`;
    return `<span class="st-tag st-tag-urgent">${esc(k.count)}회 연속 결석</span>`;
  }
  function person(p){
    if(!p.shared)return `<li class="st-person st-person-off"><span class="st-person-t"><b>${esc(p.name)}</b><small>공유 꺼짐 · 기록 안 함</small></span></li>`;
    const tags=p.alerted?p.kinds.map(tag).join('')+(p.mentorName?`<span class="st-tag st-tag-quiet">멘토 ${esc(p.mentorName)}</span>`:'')
      :(p.attendancePercent!=null?`<span class="st-tag st-tag-quiet">출석 ${esc(p.attendancePercent)}%</span>`:'')+(p.stayDaysLeft!=null?`<span class="st-tag st-tag-quiet">체류 ${until(p.stayDaysLeft)}</span>`:'');
    return `<li><button type="button" class="st-person${p.alerted?'':' st-person-quiet'}" data-st-action="card" data-class="${esc(p.classId)}" data-learner="${esc(p.learnerId)}"><span class="st-person-t"><b>${esc(p.name)}</b><small>${esc(p.sub)}</small></span><span class="st-tags">${tags}</span></button></li>`;
  }
  function classRow(c,branchOptions,locked){
    // 지점이 정해진 반도 고르기를 둔다. 바꿀 때는 students.js가 한 번 묻는다.
    // 반이 닫힌 지점에 매달려 있으면 그 지점을 「닫힌 지점」으로 골라 둔 채 보인다. 켜진 지점 목록에 없다고 다른 지점처럼 보이지 않게 한다(Fable 다시 검수 FA1).
    const current=c.branchId&&!branchOptions.some(b=>b.id===c.branchId)?`<option value="${esc(c.branchId)}" selected>${esc(c.branchName)} (닫힌 지점)</option>`:'';
    const options=(c.branchId?'':'<option value="">고르기</option>')+current+branchOptions.map(b=>`<option value="${esc(b.id)}" ${b.id===c.branchId?'selected':''}>${esc(b.name)}</option>`).join('');
    const pick=`<label class="st-inline"><span class="st-sr">${esc(c.name)} 지점</span><select data-st-branch-for="${esc(c.id)}" ${locked?'disabled':''}>${options}</select></label>`;
    const where=c.branchName?`${pick} · ${day(c.sessionDate)}`:`지점 ${pick}`;
    const k=c.counts;
    return `<li class="st-class"><div class="st-class-t"><b>${esc(c.name)}</b><span>${where}</span></div><div class="st-bar" role="img" aria-label="공유 켠 학생 ${c.total}명 가운데 출석 ${c.done}명"><i data-st-w="${c.width}"></i></div><p class="st-class-n">${c.done}<small>/${c.total}</small></p><p class="st-class-k">${k.absent?`<span class="st-urgent">결석 ${k.absent}</span>`:'결석 0'} · 지각 ${k.late} · 아직 ${k.unrecorded}</p><a class="st-link" href="/?tab=teaching" data-action="tab" data-tab="teaching">반에서 출결 찍기</a></li>`;
  }
  function inner(vm){
    if(vm.phase==='loading')return head+notice(vm.notice)+'<p class="st-empty" role="status">학생 관리를 여는 중이에요.</p>';
    if(vm.phase==='signin')return head+notice(vm.notice)+`<div class="st-panel st-signin"><h2>SYNK ID로 로그인해 주세요</h2><p>학생 기록은 「LAB 한국어 수업」과 같은 로그인으로 열어요. 반에 배정된 선생님과 원장만, 계정을 잇고 공유를 켠 학생만 볼 수 있어요.</p>${vm.signin.message?`<p class="st-muted">${esc(vm.signin.message)}</p>`:''}<button type="button" class="st-primary" data-st-action="sign-in" ${vm.signin.restoring?'disabled':''}>${vm.signin.restoring?'로그인을 확인하는 중이에요':'SYNK ID로 로그인'}</button>${vm.signin.restoring?' <button type="button" class="st-secondary" data-st-action="reload">다시 확인</button>':''}</div>`;
    if(vm.phase==='empty')return head+notice(vm.notice)+(vm.canReload?'<button type="button" class="st-secondary" data-st-action="reload">다시 불러오기</button>':'');
    // 다시 불러오는 동안 단추가 그렇다고 보인다(Fable 다시 검수 FA3).
    const reloadButton=vm.phase==='closed'?`<button type="button" class="st-secondary" data-st-action="reload" ${vm.closed.loading?'disabled':''}>${vm.closed.loading?'다시 확인하는 중이에요':'다시 불러오기'}</button>`:'';
    if(vm.phase==='closed')return head+notice(vm.notice)+(vm.closed.unavailable
      ?`<div class="st-panel st-closed"><h2>학생 기록을 지금 불러오지 못했어요</h2><p>수업 서버가 이번에는 학생 기록을 붙이지 못했어요. 담당 반 ${vm.closed.classCount}개는 그대로예요. 잠시 뒤 다시 불러와 주세요.</p>${reloadButton}</div>`
      :`<div class="st-panel st-closed"><h2>학생 관리 기록은 아직 열리지 않았어요</h2><p>개인정보 처리방침에 출결 · TOPIK · 재학 기록 항목을 공개한 뒤 켜요. 지금은 담당 반 ${vm.closed.classCount}개가 보여요.</p>${reloadButton}</div>`);
    const r=vm.ready,s=r.stats,rules=r.rules;
    const chips=`<div class="st-chips" role="group" aria-label="지점">${r.chips.map(c=>`<button type="button" class="st-chip" data-st-action="branch" data-branch="${esc(c.id)}" aria-pressed="${c.pressed}">${esc(c.label)}</button>`).join('')}</div>`;
    const card=(label,value,unit,sub,urgent=false)=>`<div class="st-stat"><p class="st-stat-k">${esc(label)}</p><p class="st-stat-v${urgent?' st-urgent':''}">${value}<small>${unit}</small></p><p class="st-stat-s">${esc(sub)}</p></div>`;
    const stats=`<div class="st-stats">${card('오늘 출석',s.rate===null?'–':s.rate,s.rate===null?'':'%',s.recorded?`기록 ${s.recorded}명 · 아직 ${s.unrecorded}명`:`아직 기록 없음 · ${s.unrecorded}명`)}${card('연속 결석',s.streak,'명',`${rules.streakMinimum}회 이상 이어 결석`,s.streak>0)}${card('체류 만료 알림',s.stay,'명',`만료 ${rules.staySoonDays}일 전부터`,s.stay>0)}${card('TOPIK 만료 알림',s.topik,'명',`만료 ${rules.topikSoonDays}일 전부터`,s.topik>0)}</div>`;
    const journey=r.journey.map((j,i)=>`<li><button type="button" class="st-step" data-st-action="stage" data-stage="${esc(j.id)}" aria-pressed="${j.pressed}"><span class="st-step-no">${i+1}</span><span class="st-step-t"><b>${esc(j.label)}</b><small>${esc(j.sub)}</small></span><span class="st-step-n">${j.count}<small>명</small></span></button></li>`).join('');
    const rows=r.classes.map(c=>classRow(c,r.branchOptions,r.desktopOld)).join('')||'<li class="st-empty">이 지점에 배정된 반이 없어요.</li>';
    const people=r.people.map(person).join('');
    return head+notice(vm.notice)+`<div class="st-bar-top">${chips}<p class="st-basis">배정된 반 ${r.assignedClassCount}개 기준 · 서울 ${day(r.basisDate)}${r.loading?' · 새로 읽는 중':''} <button type="button" class="st-link" data-st-action="reload">새로 고침</button></p></div>${stats}
  <div class="st-grid"><section class="st-panel st-journey" aria-labelledby="st-journey-t"><h2 id="st-journey-t">학생 한 명의 길</h2><ol>${journey}</ol>${r.stageFilter?'<button type="button" class="st-link" data-st-action="stage" data-stage="">모든 단계 보기</button>':''}<p class="st-muted">반을 옮기면 새 반에서 공유를 켠 뒤 재학 기록을 다시 넣어요.</p></section>
  <section class="st-panel st-today" aria-labelledby="st-today-t"><h2 id="st-today-t">오늘 출결</h2><p class="st-muted">지점 시간대의 오늘이에요. 출결은 LAB 수업의 반 화면에서 찍어요.</p><ul>${rows}</ul></section>
  <section class="st-panel st-alerts" aria-labelledby="st-alerts-t"><h2 id="st-alerts-t">${esc(r.listTitle)}</h2><p class="st-muted">체류 만료는 ${rules.staySoonDays}일, TOPIK 성적은 ${rules.topikSoonDays}일 전부터 알려요. 출석은 ${rules.attendanceMinimum}% 아래면 알려요(대학 출석률은 어학연수 D-4만).</p><ul class="st-people">${people}</ul>${people?'':'<p class="st-empty">이 조건의 학생이 없어요.</p>'}</section></div>`;
  }
  function page(innerHtml){return `<section class="st-page" aria-labelledby="st-title"><div id="students-root">${innerHtml}</div></section>`;}
  function card(c){
    const opt=(list,value,blank)=>(blank?`<option value="">${blank}</option>`:'')+list.map(o=>`<option value="${esc(o.id)}" ${o.id===value?'selected':''}>${esc(o.label)}</option>`).join('');
    const f=c.fields;
    // 저장이 폼의 하나뿐인 제출 단추다. 칸에서 Enter를 누르면 닫히지 않고 저장된다. 저장하는 동안에는 닫기도 막는다(카본 A2).
    return `<form method="dialog" class="st-card-form" data-st-form tabindex="-1">
    <header><div><h2 id="st-card-t">${esc(c.name)}</h2><p>${esc(c.className)}${c.branchName?` · ${esc(c.branchName)}`:''}</p></div><button type="button" class="st-close" data-st-action="stay-close" ${c.saving?'disabled':''}>닫기</button></header>
    <ol class="st-path">${c.steps.map(s=>`<li class="${s.state}">${esc(s.label)}</li>`).join('')}</ol>
    <p class="st-muted">TOPIK ${c.topik?`${esc(c.topik.kind)} ${esc(c.topik.level)}급 · ${until(c.topik.daysLeft)}(${day(c.topik.expiresOn)})`:'성적 없음'} · 출석 ${c.attendance?`${esc(c.attendance.percent)}%(최근 ${esc(c.attendance.recorded)}회)`:'기록 없음'}. 성적 넣기는 LAB 수업의 반 화면에서 해요.</p>
    <div class="st-fields">
      <label>단계<select name="stage">${opt(c.options.stages,f.stage)}</select></label>
      <label>비자<select name="visaKind">${opt(c.options.visas,f.visaKind,'없음')}</select></label>
      <label>대학<input name="university" maxlength="80" value="${esc(f.university)}"></label>
      <label>과정<input name="program" maxlength="80" value="${esc(f.program)}" placeholder="학부 1학년, 어학당"></label>
      <label>체류 만료일<input type="date" name="stayExpiresOn" value="${esc(f.stayExpiresOn)}"></label>
      <label>입국일<input type="date" name="enteredOn" value="${esc(f.enteredOn)}"></label>
      <label>멘토<select name="mentorStaffId">${opt(c.options.staff,f.mentorStaffId,'정하지 않음')}</select></label>
      <label>대학 출석률(%)<input type="number" name="universityAttendance" min="0" max="100" step="1" inputmode="numeric" value="${esc(f.universityAttendance)}"></label>
      <label>대학 출석률 기준일<input type="date" name="universityAttendanceOn" value="${esc(f.universityAttendanceOn)}"></label>
      <label class="st-wide">메모<textarea name="note" maxlength="200" rows="2">${esc(f.note)}</textarea></label>
    </div>
    ${c.error?`<p class="st-notice st-error" role="alert">${esc(c.error)}</p>`:''}${c.done&&!c.error?`<p class="st-notice st-done" role="status">${esc(c.done)}</p>`:''}${c.desktopOld&&!c.error?`<p class="st-notice st-error" role="alert">이 PC 앱은 아직 학생 기록 저장을 몰라요. PC 앱을 새 판으로 업데이트하거나 브라우저의 워크스페이스에서 저장해 주세요.</p>`:''}
    <footer>${c.hasRecord?`<button type="button" class="st-secondary" data-st-action="stay-delete" ${c.saving||c.desktopOld?'disabled':''}>재학 기록 지우기</button>`:'<span></span>'}<button type="submit" class="st-primary" data-st-action="stay-save" ${c.saving||c.desktopOld?'disabled':''}>${c.saving?'저장하는 중이에요':'저장'}</button></footer>
  </form>`;
  }
  return Object.freeze({page,inner,card});
})();
