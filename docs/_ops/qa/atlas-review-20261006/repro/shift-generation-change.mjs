// 검수 재현 스크립트(2026-10-06). 세대가 바뀐 뒤(동의 철회 후 재동의·설정 잊기) 완료·복원·평가가 예외로 끝나는 것.
// 저장소·네트워크·유료 호출을 건드리지 않는다. 실행: node <이 파일>
// R1: re-consent / forgotten setting -> profile generation changes while 20-entry history remains.
import { M, engine, temper, practice, answer, iso, T0, attempt } from './shift-lib.mjs';
const settings = { task: 'planning', goal: 'work', minutes: 10, support: 'step' };
function scenario(name, changeProfile) {
  console.log('=== ' + name + ' ===');
  let s = M.newState(); s.save = true;
  s = practice(s, 'meeting', ['missing'], T0);                 // generation 1, one completed practice with a miss
  console.log('before: generation', s.profile.generation, 'events', s.events.length, 'history', s.history.length, 'evaluation decisions', s.evaluation.decisions.length);
  s = { ...s, run: null, profile: changeProfile(s.profile, iso(T0 + 120000)) };
  console.log('after profile change: generation', s.profile.generation, 'consent', s.profile.consent, 'status', s.profile.status);
  attempt('practiceObservations right after change', () => M.practiceObservations(s).length);
  attempt('practiceEvaluation right after change', () => M.practiceEvaluation(s, temper, iso(T0 + 130000)).byPolicy[0].counts);
  attempt('restore(saved state) right after change', () => M.restore(JSON.stringify(s), engine, M.SCOPE, temper).history.length);
  let started = attempt('startRun after change', () => { const n = M.startRun(s, settings, engine, iso(T0 + 180000)); return n; });
  if (!started) return;
  started = M.startRun(s, settings, engine, iso(T0 + 180000));
  console.log('  new generation', started.profile.generation, 'events kept', started.events.length, 'history kept', started.history.length, 'evaluation decisions', started.evaluation.decisions.length, 'checkIds', started.run.checkIds.join(','), '| reason:', started.run.reason);
  started = M.recordPracticeExposure(started, iso(T0 + 180005));
  attempt('practiceBasis on new run', () => M.practiceBasis(started));
  attempt('persist+restore of in-progress run', () => M.restore(JSON.stringify(started), engine, M.SCOPE, temper).run.checkIds.join(','));
  answer(started, []);
  attempt('completeRun after change', () => M.completeRun(started, engine, iso(T0 + 240000)).run.step);
}
scenario('A. consent withdrawn (clearProfile disable) then practice again', (profile, at) => engine.clearProfile(profile, { mode: 'disable', at }));
scenario('B. one setting forgotten (updateProfile support:null)', (profile, at) => engine.updateProfile(profile, { values: { support: null } }, at));
