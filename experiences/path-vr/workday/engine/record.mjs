/** 체험 기록 한 장 — what happened in the experience, written from the session data.
 * It lists events only. There is no score, grade, recommendation or fit judgement anywhere:
 * nobody has measured this record against real work, and before a job-placement registration
 * SYNK may not recommend a person to an employer (design 4-4, 4-10). It states only what the
 * page can confirm: which option was pressed and how the turn was answered — never what was
 * said. The learner types every free-text field and hands the sheet to an employer themselves. */
import { sceneSayIds } from './session.mjs';

export const RECORD_NOTICE = Object.freeze([
  '이 기록은 체험에서 일어난 일을 적은 것입니다. 한국어 실력이나 일하는 기술을 재지 않았고, 채용 여부를 판단하는 자료가 아닙니다.',
  '본인이 자기 기기에서 만들었습니다. SYNK는 이 기록을 받거나 보관하지 않고, 고용주에게 보내지 않습니다.',
]);
export const RECORD_LIMITS = Object.freeze({ name: 40, reason: 80, hard: 300, ladder: 60 });
const VIEW = Object.freeze({ screen: '화면', quest: 'Quest' });
const SPEAK = Object.freeze({ voice: '음성', text: '글', mixed: '음성과 글' });
const PRODUCED = Object.freeze({ voice: '말로 답함', text: '글로 답함', example: '예시 문장을 고름' });
const trim = (value, limit) => Array.from(String(value ?? '').replace(/\s+/gu, ' ').trim()).slice(0, limit).join('');
const ymd = (date, separator) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join(separator);

/** PW-YYYYMMDD-XXXXXX. Made on the device from the date and random bytes; it is a label for the
 * learner's own copy, not a lookup key on any server. */
export function recordSerial(date, randomBytes) {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = Array.from(randomBytes || []).slice(0, 6);
  if (bytes.length !== 6 || bytes.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) throw new RangeError('기록 번호에는 무작위 바이트 6개가 필요해요.');
  return `PW-${ymd(date, '')}-${bytes.map((value) => alphabet[value % alphabet.length]).join('')}`;
}

/** films: whether this run could play any film. Without films nothing was heard, so the sheet does not count replays. */
export function buildRecord(job, data, { name = '', reasons = {}, hard = '', decision = '', ladder = {}, view = 'screen', date = new Date(), serial, films = true } = {}) {
  if (!serial) throw new TypeError('기록 번호가 필요해요.');
  const done = job.scenes.filter((scene) => data.scenes?.[scene.id]?.done === true);
  const asked = done.flatMap((scene) => sceneSayIds(scene));
  const entries = asked.map((id) => ({ id, entry: data.says?.[id] })).filter(({ entry }) => entry);
  const count = (mode) => entries.filter(({ entry }) => entry.produced === mode).length;
  const direct = entries.filter(({ entry }) => entry.produced === 'voice' || entry.produced === 'text');
  const modes = new Set(direct.map(({ entry }) => entry.produced));
  const activeMs = done.reduce((sum, scene) => sum + (data.scenes[scene.id].activeMs || 0), 0);
  const steps = new Map();
  for (const scene of job.scenes) for (const step of scene.steps) if (step.type === 'say' || step.type === 'report') steps.set(step.id, step);
  const how = (id) => PRODUCED[data.says?.[id]?.produced] || '';
  const choices = job.closing.forks.flatMap((fork) => {
    const chosen = data.forks?.[fork.id], step = steps.get(fork.id);
    if (!chosen || !step || data.scenes?.[data.forkScene?.[fork.id]]?.done !== true) return [];
    // The option's own words, as pressed. A report states only whether the key event was in it.
    const text = step.type === 'report' ? step.record[chosen] : step.options.find((option) => option.id === chosen)?.label;
    return text ? [{ scene: fork.scene, text, how: how(fork.id), reason: trim(reasons[fork.id], RECORD_LIMITS.reason) }] : [];
  });
  const turns = entries.filter(({ id, entry }) => steps.get(id)?.type === 'say' && !steps.get(id).options && PRODUCED[entry.produced]).map(({ id }) => `${steps.get(id).record} · ${how(id)}`);
  const decisionLabel = job.closing.reflection.decisions.find((item) => item.id === decision)?.label || '';
  return {
    job: { id: job.id, title: job.title, role: job.role, edition: job.edition },
    serial, issuedAt: ymd(date, '-'),
    name: trim(name, RECORD_LIMITS.name),
    view: VIEW[view] || VIEW.screen,
    speak: modes.size === 2 ? SPEAK.mixed : modes.has('voice') ? SPEAK.voice : modes.has('text') ? SPEAK.text : '',
    completed: { scenes: done.length, of: job.scenes.length, minutes: activeMs > 0 ? Math.max(1, Math.round(activeMs / 60000)) : 0, replayedScenes: done.filter((scene) => (data.scenes[scene.id].finishes ?? 1) > 1).length },
    korean: { voice: count('voice'), text: count('text'), example: count('example'), unaided: direct.filter(({ entry }) => !entry.helped).length, replays: films ? data.counts?.replays || 0 : null, hints: data.counts?.hints || 0, turns },
    choices,
    reflection: { hard: trim(hard, RECORD_LIMITS.hard), decision: decisionLabel },
    ladder: job.closing.ladder.items.map((item) => ({ label: item.label, value: trim(ladder[item.id], RECORD_LIMITS.ladder) })).filter((item) => item.value),
    notice: [...RECORD_NOTICE, ...(job.reviewNote ? [job.reviewNote] : [])],
  };
}

/** The sheet as plain rows, shared by the on-screen paper and the PDF canvas so both say the same.
 * Counts are plain tallies of what happened — never "N out of M". */
export function recordLines(record) {
  const { completed, korean } = record;
  const answered = [korean.voice ? `말로 답한 것 ${korean.voice}번` : '', korean.text ? `글로 답한 것 ${korean.text}번` : '', korean.example ? `예시 문장으로 답한 것 ${korean.example}번` : ''].filter(Boolean);
  const sections = [
    { title: '끝까지 했는가', rows: [[
      `마친 장면 ${completed.scenes}개(모두 ${completed.of}개)`,
      completed.minutes ? `걸린 시간 ${completed.minutes}분` : '',
      completed.replayedScenes ? `다시 한 장면 ${completed.replayedScenes}개` : '',
    ].filter(Boolean).join(' · ')] },
    { title: '한국어로 한 일', rows: [
      // A turn the device could not make out is left off on purpose (it must not read as the learner's Korean),
      // so the empty line says only what this sheet holds, not that the learner never answered.
      answered.length ? answered.join(' · ') : '이 기록에 적힌 답이 없습니다.',
      korean.voice + korean.text ? `힌트나 예시를 열지 않고 답한 것 ${korean.unaided}번` : '',
      korean.replays === null ? `힌트 ${korean.hints}번` : `다시 듣기 ${korean.replays}번 · 힌트 ${korean.hints}번`,
      ...korean.turns,
    ].filter(Boolean) },
    { title: '일터에서 고른 것', rows: record.choices.length ? record.choices.map((choice) => `${choice.scene}: ${choice.text}${choice.how ? ` · ${choice.how}` : ''}${choice.reason ? ` — 까닭: ${choice.reason}` : ''}`) : ['고른 갈림길이 아직 없습니다.'] },
    { title: '체험 뒤 본인의 답', rows: [
      record.reflection.decision ? `오늘 해 보니: ${record.reflection.decision}` : '',
      record.reflection.hard ? `이 일에서 힘들 것 같은 점: ${record.reflection.hard}` : '',
    ].filter(Boolean) },
    { title: '준비 사다리(본인이 적음, 증빙은 본인이 따로 냄)', rows: record.ladder.map((item) => `${item.label}: ${item.value}`) },
  ].filter((section) => section.rows.length);
  return {
    heading: `체험 기록 — ${record.job.title}`,
    edition: `${record.job.role} · ${record.job.edition}`,
    meta: [record.name ? `이름 ${record.name}` : '', `체험한 날 ${record.issuedAt}`, `본 방식 ${record.view}`, record.speak ? `답한 방식 ${record.speak}` : ''].filter(Boolean),
    sections: sections.map((section, index) => ({ ...section, title: `${index + 1}. ${section.title}` })),
    notice: record.notice,
    serial: `기록 번호(본인 기기에서 만듦) ${record.serial}`,
  };
}
