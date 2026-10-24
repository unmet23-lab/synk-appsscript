// Task workflow rules shown in the task detail: which stage a task is in, the
// one primary action each role may take and the next-step guidance. Pure: the
// viewer and whether they may write in the room are passed in.

export function taskStage(task) { return task?.stage || ({ todo: 'requested', doing: 'doing', done: 'done' }[task?.status]) || 'requested'; }
export function taskReviewerId(task) { return task?.reviewerId || task?.reviewer?.id || null; }

export function taskDetailActions(task, { userId, canPost }) {
  if (!task || task.canManage === false || !canPost) return [];
  const stage = taskStage(task), assignee = task.assignee?.id === userId, reviewer = taskReviewerId(task) === userId, hasReviewer = Boolean(taskReviewerId(task)), allowed = new Set(task.allowedStages || []);
  if (task.canReassignReviewer && task.reviewerUnavailable && stage !== 'done') return [{ action: 'recovery', label: '검토자 다시 정하기', primary: true }];
  if (task.assigneeUnavailable || !task.assignee?.id || task.reviewerUnavailable && stage !== 'done') return [];
  if (stage === 'requested') return assignee && allowed.has('accepted') ? [{ action: 'stage', stage: 'accepted', label: '수락하기', primary: true }] : [];
  if (stage === 'accepted') return assignee && allowed.has('doing') ? [{ action: 'stage', stage: 'doing', label: '시작하기', primary: true }, ...(allowed.has('done') ? [{ action: 'stage', stage: 'done', label: '완료' }] : [])] : [];
  if (['doing', 'changes'].includes(stage)) {
    if (!assignee) return [];
    if (hasReviewer) return allowed.has('review') ? [{ action: 'submit', label: '검토 맡기기', primary: true }] : [];
    return [...(allowed.has('done') ? [{ action: 'stage', stage: 'done', label: '완료', primary: true }] : []), ...(allowed.has('review') ? [{ action: 'submit', label: '검토 맡기기' }] : [])];
  }
  if (stage === 'review') return reviewer ? [...(allowed.has('done') ? [{ action: 'stage', stage: 'done', label: '완료', primary: true }] : []), ...(allowed.has('changes') ? [{ action: 'changes', label: '수정 요청' }] : [])] : [];
  return stage === 'done' && allowed.has('doing') ? [{ action: 'reopen', label: '다시 열기' }] : [];
}

export function taskNextSteps(task, { userId, canPost = true }) {
  if (taskStage(task) === 'done' && (task.assigneeUnavailable || task.reviewerUnavailable)) return ['끝난 기록과 결과물은 그대로 남아요.', '더 할 일이 있으면 새 할 일로 요청해 주세요.'];
  if (task.assigneeUnavailable || !task.assignee?.id) return ['담당 크루를 찾을 수 없어요. 요청한 사람에게 담당을 다시 정해 달라고 해 주세요.', '담당이 정해질 때까지는 상태를 그대로 두세요.'];
  if (task.canManage === false || !canPost) return ['이 계정으로는 상태를 바꿀 수 없어요. 요청과 결과물만 볼 수 있어요.', '상태나 담당을 바꿔야 하면 요청한 사람에게 말해 주세요.'];
  const current = taskStage(task), assignee = task.assignee?.id === userId, reviewer = taskReviewerId(task) === userId, hasReviewer = Boolean(taskReviewerId(task));
  if (task.reviewerUnavailable && current !== 'done') {
    if (task.canReassignReviewer) return ['검토자가 검토할 수 없게 됐어요. ‘검토자 다시 정하기’를 눌러 새 검토자를 정해 주세요.', current === 'review' ? '올린 결과물 그대로 새 검토자에게 다시 맡겨요.' : '요청·담당·기한·상태와 결과물은 그대로예요.'];
    return ['검토자가 검토할 수 없게 됐어요. 요청한 사람이나 관리자에게 새 검토자를 정해 달라고 해 주세요.', '새 검토자가 정해질 때까지 ‘검토 중’이나 ‘완료’로 바꾸지 마세요.'];
  }
  if (current === 'done') return ['끝난 일이에요. 결과물과 원래 대화를 열어 볼 수 있어요.', assignee || task.createdBy?.id === userId ? '더 할 게 생기면 ‘다시 열기’를 눌러 다시 시작해요.' : '더 할 게 생기면 담당이나 요청한 사람이 다시 열 수 있어요.'];
  if (current === 'review') return reviewer ? ['결과물을 열어 요청대로 됐는지 봐 주세요.', '고칠 게 있으면 ‘수정 요청’을 눌러 원래 대화에 의견을 남겨 주세요.', '요청대로 됐으면 ‘완료’를 눌러 주세요.'] : ['검토를 맡긴 상태예요. 검토자의 답을 기다려 주세요.', '검토 의견은 원래 대화의 답글로 와요.'];
  if (!assignee) return [`${task.assignee?.name || '담당 크루'}의 차례예요. ${current === 'requested' ? '요청을 보고 수락하기를' : '요청대로 일하기를'} 기다리는 중이에요.`, '더할 조건이나 바뀐 점은 원래 대화에 답글로 남겨 주세요.'];
  if (current === 'requested') return ['요청과 기한, 참고 자료를 봐 주세요.', '범위나 결과물이 애매하면 원래 대화에 답글로 물어봐 주세요.', '할 수 있으면 ‘수락하기’를 눌러 주세요.'];
  if (current === 'accepted') return ['일을 시작하면 ‘시작하기’를 눌러 주세요.', '다 만들면 파일이나 링크를 이 대화방에 올려 주세요.'];
  const steps = current === 'changes' ? ['답글로 온 수정 의견대로 결과물을 고쳐 주세요.'] : ['요청에 맞춰 결과물을 만들어 주세요.'];
  steps.push('다 만들면 파일이나 링크를 이 대화방에 올려 주세요.');
  steps.push(hasReviewer ? '‘검토 맡기기’를 누르고 올린 결과물을 골라 저장하면 검토자가 봐요.' : '검토 없이 끝내려면 ‘완료’를 눌러 주세요. 검토가 필요하면 ‘검토 맡기기’에서 검토자를 정해 주세요.');
  return steps;
}

export const SynkMessengerTasks = Object.freeze({ taskStage, taskReviewerId, taskDetailActions, taskNextSteps });
// Exposed for app.js, which tests also evaluate as a classic script.
if (typeof window !== 'undefined') window.SynkMessengerTasks = SynkMessengerTasks;
