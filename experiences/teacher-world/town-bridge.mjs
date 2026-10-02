// The linked server authenticates actors and durably commits its enclosing state.
// Town life facts stay here; only separate reading questions create learning evidence.
import { initialState, restoreState, reduceCommand, snapshot, TownError, SCOPE } from '../synk-town/core.mjs';
const requireValue = (ok, code, message, status = 403) => { if (!ok) throw new TownError(code, message, status); };
function owner(state, actor) {
  requireValue(['local-linked','account-linked'].includes(state?.mode) && state.synthetic === false && actor?.mode === state.mode
    && actor.role === 'learner', 'FORBIDDEN', 'WORLD 연결을 확인해 주세요.');
  const learner = state.learners.find(row => row.id === actor.id);
  requireValue(learner && !learner.revoked && learner.connectedAt && learner.sharing?.enabled
    && state.classes.some(row => row.id === learner.classId && row.learnerIds.includes(learner.id)),
  'LEARNING_DISABLED', '학생 연결과 기록 동의를 다시 확인해 주세요.');
  requireValue(/^[a-zA-Z0-9_-]{1,100}$/.test(learner.id), 'INVALID_OWNER', '체험의 주인을 확인할 수 없어요.');
  return learner;
}
function read(learner) {
  const scope = { ...SCOPE, subject: `linked-${learner.id}` };
  if (!learner.town) return initialState({ scope });
  requireValue(learner.town.ownerId === learner.id && learner.town.state?.scope?.domain === scope.domain
    && learner.town.state?.scope?.workspace === scope.workspace && learner.town.state?.scope?.subject === scope.subject,
    'INVALID_OWNER', '다른 학생의 체험 기록을 열 수 없어요.', 503);
  return restoreState(learner.town.state);
}
function result(learner, value, mode) {
  const data = snapshot(value);
  data.view.scopeLabel = 'WORLD 연결 · 내 생활 체험';
  return { ...data, mode, sharingRevision: learner.sharing.revision };
}
export function townWorkspace(state, actor) { const learner = owner(state, actor); return result(learner, read(learner), state.mode); }
export function townCommand(state, actor, command) {
  const learner = owner(state, actor);
  requireValue(command?.sharingRevision === learner.sharing.revision, 'REVISION_CONFLICT', '연결 상태가 바뀌었어요. 다시 불러와 주세요.', 409);
  const next = reduceCommand(read(learner), { id: command.id, type: command.type, payload: command.payload, expectedRevision: command.expectedRevision });
  learner.town = { ownerId: learner.id, state: next.state };
  return { ...result(learner, next.state, state.mode), duplicate: next.duplicate };
}
