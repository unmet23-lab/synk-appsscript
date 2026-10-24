// Workflow policy is independent of storage, serialization and event delivery.
export function validateTaskTransition({ prior, next, actor, recovery, legacyStatus, allowedStages }, assert) {
  const { assigneeId, reviewerId, title, dueDate, stage, result } = next;
  const { userId, owner } = actor;
  if (prior) {
    if (recovery) {
      assert(typeof reviewerId === 'string' && reviewerId !== prior.reviewer_id, 400, '지금 검토자 말고 새 검토자를 골라 주세요.');
      assert(prior.assignee_id === assigneeId && prior.title === title && prior.due_date === dueDate && prior.stage === stage && (prior.result_message_id ?? null) === (result?.id ?? null), 409, '검토자만 바꿔 주세요. 담당·결과물·기한·상태는 그대로 둬야 해요.');
    }
    const metadataChanged = prior.assignee_id !== assigneeId || prior.reviewer_id !== reviewerId || prior.title !== title || prior.due_date !== dueDate;
    assert(!metadataChanged || [prior.creator_id, prior.assignee_id].includes(userId) || owner, 403, '검토자는 검토 결과만 바꿀 수 있어요.');
    // Reviewers cannot be removed by the assignee to bypass required approval.
    assert(prior.reviewer_id === reviewerId || !prior.reviewer_id || ((prior.creator_id === userId || owner) && prior.assignee_id !== userId), 403, '검토자는 담당이 아닌 요청한 사람이나 관리자만 바꿀 수 있어요.');
    const resultChanged = (prior.result_message_id ?? null) !== (result?.id ?? null);
    assert(!resultChanged || prior.assignee_id === userId, 403, '결과물은 담당만 올릴 수 있어요.');
    assert(prior.stage !== 'done' || stage !== 'done' || (!resultChanged && prior.reviewer_id === reviewerId && prior.assignee_id === assigneeId), 409, '끝난 일의 담당·검토자·결과물은 ‘진행 중’으로 다시 연 뒤 바꿔 주세요.');
    assert(prior.stage !== 'review' || recovery || (prior.assignee_id === assigneeId && prior.reviewer_id === reviewerId && (prior.result_message_id ?? null) === (result?.id ?? null)), 409, '검토 중에는 담당과 결과물을 바꿀 수 없어요. ‘수정 요청’ 상태가 되면 바꿔 주세요.');
    if (stage !== prior.stage) {
      const legacy = legacyStatus && !prior.reviewer_id && !reviewerId;
      assert(allowedStages.includes(stage) || (legacy && [prior.creator_id, prior.assignee_id].includes(userId)) || (legacy && owner), 403, '지금 상태에서는 이렇게 바꿀 수 없어요.');
    }
  }
  if (stage === 'review') assert(reviewerId && result, 400, '‘검토 중’으로 바꾸려면 검토자와 결과물 메시지를 모두 골라 주세요.');
  if (prior?.stage === 'review' && stage === 'done') assert(result, 400, '결과물 메시지가 지워졌어요. ‘수정 요청’으로 바꾼 뒤 결과물을 다시 골라 주세요.');
}
