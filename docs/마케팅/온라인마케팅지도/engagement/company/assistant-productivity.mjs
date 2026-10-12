const stageNames = { requested: '요청 확인', accepted: '수락', doing: '작업 중', review: '검토 대기', changes: '수정 요청', done: '완료' };
const eventNames = { task_reviewer_reassigned: '검토자 다시 지정', task_created: '새 요청', task_stage: '진행 변경', task_due: '기한 변경', task_assignment: '담당 변경', task_updated: '업무 변경', decision: '결정 기록', decision_replaced: '결정 변경' };
const panel = (label, name) => ({ type: 'messenger', label, panel: name });
const source = (label, row) => ({ type: 'messenger', label: label.slice(0, 100), channelId: row.channelId, messageId: String(row.messageId || row.id) });
const response = (intent, text, actions, data) => ({ mode: 'workspace-guide', intent, text, actions: actions.slice(0, 5), suggestions: [], generative: false, externalCalls: false, data });

// Summaries are composed from authorized records, not inferred from arbitrary chat.
// Asking never confirms a request, completes work, or advances the catch-up cursor.
export function answerProductivity({ message, request, user, productivity, clientWorkday, publicationWorkday }) {
  if (!productivity) return null;
  if (/바뀐\s*(?:것|점|내용)|변경\s*(?:요약|사항|내용)|놓친\s*(?:내용|대화|업무)|자리\s*비운|따라잡기/.test(message)) {
    const data = productivity(request, 'catchUp'), events = data.events || [];
    const counts = { decisions: 0, requests: 0, schedule: 0, review: 0 };
    for (const event of events) counts[event.kind.startsWith('decision') ? 'decisions' : event.kind === 'task_created' ? 'requests' : ['task_due', 'task_assignment'].includes(event.kind) ? 'schedule' : 'review']++;
    const recent = new Map();
    for (const event of [...events].reverse()) { const key = `${event.kind}:${event.task?.id || event.decision?.id || event.message.id}`; if (!recent.has(key)) recent.set(key, event); }
    const unique = [...recent.values()].slice(0, 3);
    const lines = unique.map(event => {
      const title = event.decision?.summary || event.task?.title || event.message.body || '업무 기록';
      const detail = event.kind === 'task_due' ? ` · ${event.changes?.from || '기한 없음'} → ${event.changes?.to || '기한 없음'}` : event.kind === 'task_stage' ? ` · ${stageNames[event.changes?.from] || event.changes?.from || ''} → ${stageNames[event.changes?.to] || event.changes?.to || ''}` : '';
      return `· ${eventNames[event.kind] || '변경'}: ${title.slice(0, 180)}${detail}`;
    });
    return response('catchup', events.length ? `마지막 확인 이후${data.hasMore ? ' 이번 묶음에서' : ''} 결정 ${counts.decisions}건, 새 요청 ${counts.requests}건, 기한·담당 ${counts.schedule}건, 진행·검토 ${counts.review}건이 바뀌었어요.\n${lines.join('\n')}\n원문에서 현재 상태를 확인하고, 바뀐 것 화면에서 확인한 범위를 표시할 수 있어요.${data.hasMore ? ' 이어 볼 변경이 더 있어요.' : ''}` : '마지막 확인 이후 새로 기록된 업무·결정 변경이 없어요. 일반 대화의 읽음 상태와는 별도로 확인합니다.',
      [panel('바뀐 것과 할 행동 보기', 'catchup'), ...unique.map(event => source((event.decision?.summary || event.task?.title || '원문 보기'), { channelId: event.message.channelId, messageId: event.message.id }))],
      { counts, through: data.through, hasMore: data.hasMore, source: 'recorded-workflow-events' });
  }
  if (/확정(?:된|한|한\s*내용)?\s*(?:결정|내용|사항)|결정\s*(?:사항|기록)|최종\s*(?:본|파일)|.*확정.*(?:찾|뭐|무엇)/.test(message)) {
    const query = message.replace(/어디(?:에)?\s*(?:있(?:어(?:요)?|지|나요|을까|습니까))?/g, ' ').replace(/확정(?:된|한)?|결정\s*(?:사항|기록)?|최종\s*(?:본|파일)|지난번|최근|현재|찾아\s*주세요|찾아\s*줘|보여\s*주세요|보여\s*줘|알려\s*주세요|알려\s*줘|뭐였지|무엇|내용|사항|[?"'“”]/g, ' ').trim().replace(/\s+/g, ' ').slice(0, 200);
    const data = productivity(request, 'decisions', { q: query, current: '1', limit: 5, ...(/최종\s*(?:본|파일)/.test(message) ? { kind: 'final' } : {}) });
    const rows = data.decisions || [];
    return response('decisions', rows.length ? `현재 열람할 수 있는 확정 기록 ${rows.length}건${data.hasMore ? '을 먼저' : '을'} 찾았어요.\n${rows.slice(0, 3).map(row => `· ${row.summary.slice(0, 180)} · 적용 ${row.effectiveDate} · ${row.confirmedBy?.name || '이전 크루'} 확인`).join('\n')}\n원래 논의와 연결된 최종본은 결정 화면에서 함께 볼 수 있어요.` : '현재 열람 가능한 확정 기록에서 일치하는 내용을 찾지 못했어요. 결정 화면에서 검색어를 바꾸거나 원문 메시지를 결정으로 기록해 주세요.',
      [panel('결정과 최종본 보기', 'decisions'), ...rows.slice(0, 4).map(row => source(row.summary, row))], { query, count: rows.length, hasMore: data.hasMore });
  }
  if (/오늘.*(?:처리|할\s*일|업무)|(?:내가|내).*(?:기다리|대기|검토할|답할)|검토.*차례/.test(message)) {
    const data = productivity(request, 'workday');
    const classified = data?.today?.groups && data?.remaining?.groups && ['reply','due','review','recovery'].every(key => Array.isArray(data.today.groups[key])) && ['upcoming','undated','waiting'].every(key => Array.isArray(data.remaining.groups[key]));
    let customers=[], customerError=false;
    try { const result=clientWorkday?.(user); if(clientWorkday&&!Array.isArray(result?.items))customerError=true;else customers=result?.items||[]; } catch { customerError=true; }
    let publications=[],publicationError=false;
    try { const result=publicationWorkday?.(user); if(publicationWorkday&&!Array.isArray(result?.items))publicationError=true;else publications=result?.items||[]; } catch { publicationError=true; }
    const actions=[panel('오늘 처리할 일 열기','workday')], group=/기다리|대기/.test(message)?'waiting':/검토/.test(message)?'review':/답할/.test(message)?'reply':null;
    if(!classified)return response('workday','오늘 할 일을 정확히 확인하지 못했습니다. 할 일이 없다는 뜻은 아니에요. 오늘 할 일 화면에서 다시 확인해 주세요.',actions,{date:data?.date,group,verified:false});
    const unique=rows=>[...new Map(rows.map(row=>[row.id,row])).values()];
    const todayGroups=data.today.groups,remaining=data.remaining.groups,todayRows=unique(['reply','due','review','recovery'].flatMap(key=>todayGroups[key])),pending=unique([...remaining.upcoming,...remaining.undated]),waiting=unique(remaining.waiting);
    customers=unique(customers);const activeCustomers=customers.filter(row=>['reply','review','next'].includes(row.group)),waitingCustomers=customers.filter(row=>row.group==='waiting');
    publications=unique(publications);const activePublications=publications.filter(row=>['reply','review','next'].includes(row.group)),selectedPublications=group?publications.filter(row=>row.group===group):activePublications;
    const incomplete=customerError||publicationError,count=todayRows.length+activeCustomers.length+activePublications.length, selectedCustomers=group?customers.filter(row=>row.group===group):customers;
    const rowLine=row=>`· ${String(row.title).slice(0,180)} · ${row.canManage===false?'상태 변경 권한 확인':row.assigneeUnavailable?'담당 크루 확인 필요':row.reviewerUnavailable?'검토 크루 지정 필요':stageNames[row.stage]||'업무'}${row.dueDate?` · ${row.dueDate}까지`:' · 기한 미정'}`;
    let rows,lines;
    if(group){
      rows=group==='waiting'?waiting:todayGroups[group];const label={waiting:'답변·진행 대기',review:'내가 검토할 결과',reply:'답할 요청'}[group];
      lines=[`${label} ${rows.length}건${selectedCustomers.length?`, 관련 고객 업무 ${selectedCustomers.length}건`:''}${selectedPublications.length?`, 게시 업무 ${selectedPublications.length}건`:''}이에요.`,...rows.slice(0,3).map(rowLine)];
      if(!rows.length&&!selectedCustomers.length&&!selectedPublications.length&&!incomplete)lines.push(`현재 등록된 ${label} 항목은 없습니다.`);
    }else{
      rows=count?todayRows:pending;
      const heading=incomplete?(count?`확인된 오늘 할 일 ${count}개`:'오늘 할 일 확인이 완료되지 않았습니다'):count?`오늘 처리할 일 ${count}개`:pending.length?`남아 있는 내 업무 ${pending.length}개`:'오늘 처리할 일이 없습니다';
      lines=[heading,...rows.slice(0,3).map(rowLine)];
      if(pending.length)lines.push(`이후 마감 ${remaining.upcoming.length}개 · 기한 미정 ${remaining.undated.length}개가 남아 있어요.${!count?' 남은 업무의 기한과 오늘 진행할 내용을 확인해 주세요.':''}`);
      if(waiting.length||waitingCustomers.length)lines.push(`대기 중 ${waiting.length+waitingCustomers.length}개는 다른 사람의 작업이나 답변을 기다리는 업무예요.`);
      if(!count&&!pending.length&&!waiting.length&&!waitingCustomers.length&&!incomplete)lines.push('내게 배정된 미완료 업무와 내가 처리할 고객·게시 업무도 없습니다.');
    }
    lines.push(...(group?selectedCustomers:activeCustomers).slice(0,Math.max(0,3-rows.length)).map(row=>`· ${row.projectTitle||'고객 업무'} · ${row.title} · ${row.statusLabel||'확인 필요'}`));
    lines.push(...selectedPublications.slice(0,Math.max(0,3-rows.length-(group?selectedCustomers:activeCustomers).length)).map(row=>`· ${String(row.title||'게시 업무').slice(0,180)} · ${row.actionLabel||row.statusLabel||'게시 준비에서 확인'}`));
    if(customerError)lines.push('고객 업무를 확인하지 못했습니다. 전체 할 일이 없다고 판단할 수 없습니다.');
    if(publicationError)lines.push('게시 업무를 확인하지 못했습니다. 전체 할 일이 없다고 판단할 수 없습니다.');
    return response('workday',lines.join('\n'),[...actions,...rows.slice(0,4).map(row=>source(row.title,row))],{date:data.date,counts:data.counts,todayCount:count,pendingCount:pending.length,waitingCount:waiting.length+waitingCustomers.length,customerCount:selectedCustomers.length,actionableCustomerCount:activeCustomers.length,publicationCount:selectedPublications.length,actionablePublicationCount:activePublications.length,group,verified:!incomplete});
  }
  return null;
}
