const stageNames = { requested: '요청 확인', accepted: '수락', doing: '작업 중', review: '검토 대기', changes: '수정 요청', done: '완료' };
const eventNames = { task_reviewer_reassigned: '검토자 다시 지정', task_created: '새 요청', task_stage: '진행 변경', task_due: '기한 변경', task_assignment: '담당 변경', task_updated: '업무 변경', decision: '결정 기록', decision_replaced: '결정 변경' };
const panel = (label, name) => ({ type: 'messenger', label, panel: name });
const source = (label, row) => ({ type: 'messenger', label: label.slice(0, 100), channelId: row.channelId, messageId: String(row.messageId || row.id) });
const response = (intent, text, actions, data) => ({ mode: 'workspace-guide', intent, text, actions: actions.slice(0, 5), suggestions: [], generative: false, externalCalls: false, data });

// Summaries are composed from authorized records, not inferred from arbitrary chat.
// Asking never confirms a request, completes work, or advances the catch-up cursor.
export function answerProductivity({ message, request, user, productivity, clientWorkday }) {
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
    const data = productivity(request, 'workday'), groups = data.groups || {}, customers = clientWorkday?.(user)?.items || [];
    const group = /기다리|대기/.test(message) ? 'waiting' : /검토/.test(message) ? 'review' : /답할/.test(message) ? 'reply' : null;
    const rows = group ? groups[group] || [] : [...new Map(['reply', 'due', 'review', 'waiting'].flatMap(key => groups[key] || []).map(row => [row.id, row])).values()];
    const selectedCustomers = group ? customers.filter(row => row.group === group) : customers;
    const labels = { reply: '답할 요청', due: '오늘·기한 지난 일', review: '검토할 결과물', waiting: '기다리는 일' };
    const lines = group ? [`${labels[group]} ${rows.length}건${selectedCustomers.length ? `, 고객 업무 ${selectedCustomers.length}건` : ''}이에요.`] : [Object.entries(labels).map(([key, label]) => `${label} ${(groups[key] || []).length}건`).join(' · ') + `${customers.length ? `\n고객 요청·검토·납품 업무 ${customers.length}건도 함께 확인할 수 있어요.` : ''}`];
    lines.push(...rows.slice(0, 3).map(row => `· ${row.title} · ${stageNames[row.stage] || '업무'}${row.dueDate ? ` · ${row.dueDate}까지` : ''}`));
    lines.push(...selectedCustomers.slice(0, Math.max(0, 3 - rows.length)).map(row => `· ${row.projectTitle} · ${row.title} · ${row.statusLabel}`));
    if (!rows.length && !selectedCustomers.length) lines.push('지금 이 범위에서 처리할 항목은 없어요.');
    return response('workday', lines.join('\n'), [panel('오늘 처리할 일 열기', 'workday'), ...rows.slice(0, 4).map(row => source(row.title, row))], { date: data.date, counts: data.counts, customerCount: selectedCustomers.length, group });
  }
  return null;
}
