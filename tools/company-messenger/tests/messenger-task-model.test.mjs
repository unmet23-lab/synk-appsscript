import test from 'node:test';
import assert from 'node:assert/strict';
import { taskDetailActions, taskNextSteps, taskReviewerId, taskStage } from '../public/messenger-task-model.js';

// Same role/stage matrix as task-detail-actions-client, against the pure rules.
const base = { id: 't1', title: '가을 캠페인 썸네일 3안', stage: 'requested', status: 'todo', assignee: { id: 'u1', name: '담당' }, reviewer: null, reviewerId: null, createdBy: { id: 'u3', name: '하윤' }, allowedStages: ['accepted'], canManage: true };
const labels = (task, userId, canPost = true) => taskDetailActions({ ...base, ...task }, { userId, canPost }).map(item => (item.primary ? '*' : '') + item.label);

test('legacy status maps to a stage and the reviewer id may come from either field', () => {
  assert.equal(taskStage({ status: 'todo' }), 'requested'); assert.equal(taskStage({ status: 'doing' }), 'doing'); assert.equal(taskStage({ status: 'done' }), 'done');
  assert.equal(taskStage({ stage: 'review', status: 'todo' }), 'review'); assert.equal(taskStage(null), 'requested');
  assert.equal(taskReviewerId({ reviewer: { id: 'u2' } }), 'u2'); assert.equal(taskReviewerId({ reviewerId: 'u4', reviewer: { id: 'u2' } }), 'u4'); assert.equal(taskReviewerId({}), null);
});

test('each stage and role offers at most one primary action that the server would accept', () => {
  const cases = [
    [{ stage: 'requested', allowedStages: ['accepted'] }, 'u1', ['*수락하기']],
    [{ stage: 'requested', allowedStages: [] }, 'u3', []],
    [{ stage: 'requested', allowedStages: ['accepted'] }, 'u3', [], 'only the assignee accepts, even when the stage is allowed'],
    [{ stage: 'accepted', reviewer: { id: 'u2' }, reviewerId: 'u2', allowedStages: ['doing'] }, 'u1', ['*시작하기']],
    [{ stage: 'accepted', allowedStages: ['doing', 'done'] }, 'u1', ['*시작하기', '완료']],
    [{ stage: 'doing', reviewer: { id: 'u2' }, reviewerId: 'u2', allowedStages: ['review'] }, 'u1', ['*검토 맡기기']],
    [{ stage: 'changes', allowedStages: ['review', 'done'] }, 'u1', ['*완료', '검토 맡기기']],
    [{ stage: 'review', assignee: { id: 'u3' }, reviewer: { id: 'u1' }, reviewerId: 'u1', allowedStages: ['changes', 'done'] }, 'u1', ['*완료', '수정 요청']],
    [{ stage: 'review', reviewer: { id: 'u2' }, reviewerId: 'u2', allowedStages: [] }, 'u1', []],
    [{ stage: 'done', allowedStages: ['doing'] }, 'u1', ['다시 열기']],
    [{ stage: 'doing', reviewer: null, reviewerId: 'former', reviewerUnavailable: true, canReassignReviewer: true, assignee: { id: 'u2' }, allowedStages: [] }, 'u3', ['*검토자 다시 정하기']],
    [{ stage: 'doing', reviewer: null, reviewerId: 'former', reviewerUnavailable: true, allowedStages: [] }, 'u1', []],
    [{ stage: 'requested', canManage: false, allowedStages: [] }, 'u2', []],
    [{ stage: 'doing', assigneeUnavailable: true, allowedStages: ['done'] }, 'u1', []],
  ];
  for (const [task, userId, expected] of cases) {
    const actual = labels(task, userId);
    assert.deepEqual(actual, expected, JSON.stringify(task));
    assert.ok(actual.filter(label => label.startsWith('*')).length <= 1);
  }
  assert.deepEqual(labels({ stage: 'requested', allowedStages: ['accepted'] }, 'u1', false), [], 'a view-only room gets no action');
  assert.deepEqual(taskDetailActions(undefined, { userId: 'u1', canPost: true }), []);
});

test('next steps follow the viewer role and never invite a change the viewer cannot make', () => {
  const steps = (task, userId, canPost) => taskNextSteps({ ...base, ...task }, { userId, canPost });
  assert.match(steps({}, 'u1')[2], /수락하기/);
  assert.match(steps({}, 'u2')[0], /^담당의 차례예요\. 요청을 보고 수락하기를 기다리는 중이에요\.$/);
  assert.match(steps({ stage: 'doing' }, 'u2')[0], /요청대로 일하기를/);
  assert.match(steps({}, 'u1', false)[0], /이 계정으로는 상태를 바꿀 수 없어요/);
  assert.match(steps({ canManage: false }, 'u1')[0], /이 계정으로는 상태를 바꿀 수 없어요/);
  assert.match(steps({ assignee: null }, 'u1')[0], /담당 크루를 찾을 수 없어요/);
  assert.match(steps({ stage: 'done', reviewerUnavailable: true }, 'u1')[0], /끝난 기록과 결과물은 그대로/);
  assert.match(steps({ stage: 'done' }, 'u3')[1], /다시 열기/, 'the requester may reopen');
  assert.match(steps({ stage: 'done' }, 'u2')[1], /담당이나 요청한 사람이 다시 열 수 있어요/);
  assert.match(steps({ stage: 'review', reviewerId: 'u2' }, 'u2')[2], /‘완료’를 눌러/);
  assert.match(steps({ stage: 'review', reviewerId: 'u2' }, 'u1')[0], /검토자의 답을 기다려/);
  assert.match(steps({ stage: 'review', reviewerUnavailable: true, canReassignReviewer: true }, 'u1')[1], /올린 결과물 그대로/);
  assert.match(steps({ stage: 'doing', reviewerUnavailable: true }, 'u1')[1], /바꾸지 마세요/);
  assert.deepEqual(steps({ stage: 'changes', reviewerId: 'u2' }, 'u1'), ['답글로 온 수정 의견대로 결과물을 고쳐 주세요.', '다 만들면 파일이나 링크를 이 대화방에 올려 주세요.', '‘검토 맡기기’를 누르고 올린 결과물을 골라 저장하면 검토자가 봐요.']);
  assert.match(steps({ stage: 'doing' }, 'u1').at(-1), /검토 없이 끝내려면/);
  assert.match(taskNextSteps({ ...base, stage: 'accepted' }, { userId: 'u1' })[0], /시작하기/, 'without a message the viewer may write');
});
