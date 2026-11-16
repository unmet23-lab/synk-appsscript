// 엔진 상태 → 화면 모델. 화면은 이 모델만 그리고, 엔진의 글(단계 · 오류 · 경고)은 그대로 옮기지 않는다.
// 문구의 근거는 시안 A의 원고(ui-mockups/_src/copy.mjs · a.mjs)와 설계 2.2 · 4.2 · 4.4 · 4.6 · 4.7 · 4.12다.
// 보이는 법(A 확인서 · 검정)과 상관없이 같다: 둘 다 「상태 한 줄 · 큰 문장 · 뜻 한 줄 · 할 일 · 그 증거」를 그린다.
//
// 상태 값은 워커의 state()(worker/handlers.cjs) 그대로다. 아직 엔진에 없는 값은 이름만 정해 두고(아래 FUTURE),
// 있으면 쓰고 없으면 그 줄을 그리지 않는다. 없는 값으로 그린 화면은 engine-fixtures.js의 예시 상태로만 볼 수 있다.

import { aroundKo, agoKo, count, dayKo, dayParen, daysLeft, josa, ms, placesKo, size, timeKo, undoDeadline, whenKo, baseName } from './ko-format.js';

/** 엔진에 아직 없는 상태 칸 — 엔진 담당(조율 세션)과 이름을 맞출 목록. QA에 「가짜 상태」로 적는다. */
export const FUTURE = Object.freeze({
  device: '이 PC의 이름(설정 서랍 · 확인서 머리). 없으면 「이 PC」',
  'lastBackup.folders': '폴더마다 담은 파일 수 · 크기([{path, files, bytes}])',
  'lastProbe.v2': '되살리기 증명 v2 — 폴더마다 무작위 파일 합 64MiB 안(files · bytes · nextAt)',
  massHold: '한꺼번에 지워짐 멈춤(설계 4.4) — {at, folder, removed, left, totalNow, bytesNow, before}',
  movedTo: '쓰는 기기를 넘겨줌(설계 4.6 N2) — {device, at}',
  'lastPartial.program': '쓰는 중이라 못 읽은 파일을 쥔 프로그램 이름과 파일 목록',
  admin: '관리자 계정인지(쓰는 중이라 못 읽은 파일을 따로 읽어 채우는지)',
});

const MINUTE = 60000;

/** 작업 종류 → 화면 말(엔진 단계 글에는 「저장소」 같은 말이 있어 옮기지 않는다) */
function jobName(job) {
  if (!job) return '';
  if (job.scheduled) return '예약 백업';
  return ({ protect: '첫 백업', backup: '지금 백업', restore: '파일 되살리기', check: '백업 점검', probe: '되살려 보기', setup: '보호 준비', sources: '폴더 바꾸기', credentials: '다시 연결', import: '복구 코드 읽기', key: '복구 정보 맡기기' })[job.kind] || '작업';
}

/** 진행 퍼센트(0~100, 모르면 null) */
function pct(job) {
  const p = Number(job?.percent);
  return Number.isFinite(p) ? Math.max(0, Math.min(100, Math.round(p))) : null;
}

/** 단계 말 — 엔진 단계 글에서 손님에게 뜻이 있는 것만 골라 바꾼다 */
function stageWord(job) {
  const s = String(job?.stage || '');
  if (/정리/.test(s)) return '지난 판 정리 중';
  if (/점검|확인 중|구조/.test(s) && !/복구 확인/.test(s)) return '확인하는 중';
  if (/내려받|해독|복구 확인/.test(s)) return '되살려 보는 중';
  if (/복구/.test(s)) return '되살리는 중';
  if (/읽지 못/.test(s)) return '쓰는 중이던 파일 다시 읽는 중';
  if (/백업 중|올리/.test(s)) return '올리는 중';
  if (/연결|준비/.test(s)) return '준비 중';
  return '진행 중';
}

/** 지키는 폴더의 이름(알려진 폴더는 한국어 이름) */
const KNOWN = { documents: '문서', desktop: '바탕화면', pictures: '사진', music: '음악', videos: '동영상', downloads: '다운로드' };
export function folderName(p) {
  const b = baseName(p);
  return KNOWN[b.toLowerCase()] || b;
}

function samePath(a, b) { return String(a || '').replace(/[\\/]+$/, '').toLowerCase() === String(b || '').replace(/[\\/]+$/, '').toLowerCase(); }

/** 되살려 본 날 줄 */
function proofOf(s, now) {
  const p = s.lastProbe;
  if (!p || !ms(p.at)) return { k: '되살려 본 날', day: '아직 없음', result: '', short: '첫 백업 뒤 일주일 안에', text: '첫 백업 뒤 일주일 안에 파일을 실제로 되살려 원본과 견줍니다.' };
  const files = Number(p.files) || 0;
  const next = ms(p.nextAt) ?? ms(p.at) + 7 * 86400000;
  if (p.result === 'passed') {
    return { k: '되살려 본 날', day: dayKo(p.at), result: '모두 같음', short: `${files > 1 ? '무작위 ' : ''}${count(files)}개 모두 원본과 같음`,
      text: `${files > 1 ? '폴더마다 무작위로 고른' : '무작위로 고른'} 파일 ${count(files)}개(${size(Number(p.bytes) || 0)})를 실제로 되살려 원본과 견줬습니다. 다음은 ${dayParen(Math.max(next, now))}입니다.` };
  }
  if (p.result === 'failed') return { k: '되살려 본 날', day: dayKo(p.at), result: '다름', short: '원본과 다른 파일이 나옴', bad: true, text: '되살린 파일이 원본과 달랐습니다. 확인하기 전까지 이전 판을 지우지 않습니다.' };
  return { k: '되살려 본 날', day: dayKo(p.at), result: '다시 해 봄', short: '다음 확인 때 다시 해 봄', text: '이번에는 끝까지 되살려 보지 못해 다음 확인 때 다시 해 봅니다.' };
}

/** 확인서(증거) — 마지막 확인 · 다음 확인 · 지키는 폴더 · 합계 · 되살려 본 날 */
function evidence(s, now, { state = 'ok' } = {}) {
  const sources = Array.isArray(s.sources) ? s.sources : [];
  const missing = Array.isArray(s.missingSources) ? s.missingSources : [];
  const per = Array.isArray(s.lastBackup?.folders) ? s.lastBackup.folders : [];
  const present = sources.filter((p) => !missing.some((m) => samePath(m, p)));
  const head = [
    { k: '마지막 확인', v: s.lastBackup?.at ? `${whenKo(s.lastBackup.at, now)}${missing.length ? ` · ${placesKo(present.length).replace(' ', '')}` : ''}` : '아직 없음' },
  ];
  if (s.nextBackupAt && state !== 'moved') head.push({ k: '다음 확인', v: aroundKo(s.nextBackupAt, now) });
  const rows = sources.map((p) => {
    const gone = missing.some((m) => samePath(m, p));
    const f = per.find((x) => samePath(x.path, p));
    const mass = s.massHold && samePath(s.massHold.path, p);
    return { k: folderName(p), v: gone ? '찾을 수 없음' : mass ? `${count(s.massHold.left)}개 · −${count(s.massHold.removed)}` : f ? `${count(f.files)}개` : '', x: gone || mass };
  });
  const files = s.massHold ? s.massHold.totalNow : s.lastBackup?.files;
  const bytes = s.massHold ? s.massHold.bytesNow : s.lastBackup?.bytes;
  const total = s.lastBackup ? `${count(files)}개 · ${size(bytes)}` : '';
  const extra = [];
  if (s.lastPartial && state === 'partial') extra.push({ k: '쓰는 중이라 앞 판으로', v: `${count(s.lastPartial.unreadable)}개 · ${timeKo(s.lastBackup?.at)}` });
  if (missing.length && state === 'missing') extra.push({ k: '붙들어 둔 판', v: whenKo(s.lastBackup?.at, now) });
  if (s.massHold && state === 'mass') extra.push({ k: '지우기 전 판', v: `${count(s.massHold.before)}개 · 붙들어 둠` });
  return {
    head,
    folders: { k: '지키는 폴더', v: `${count(present.length)}곳`, rows },
    total: { k: missing.length ? `${placesKo(present.length).replace(' ', '')} 합계` : `${placesKo(sources.length).replace(' ', '')} 합계`, v: total },
    extra,
    proof: proofOf(s, now),
    end: state === 'moved' ? '이 PC의 마지막 확인서' : '매시간 새로 찍힙니다',
  };
}

const RESTORE = { id: 'restore', label: '파일 되살리기', kind: 'main', to: 'restore' };
const MOVE = { id: 'move', label: '새 PC로 옮겨 오기', kind: 'link', to: 'move-0' };

/**
 * 기본 화면 모델. state는 워커 state(), now는 밀리초, device는 이 PC 이름.
 * id는 시안 A의 화면 이름(home · home-run · home-partial · home-missing · home-mass · home-moved)과 그 밖의 주의 상태다.
 */
export function homeModel(state, { now = Date.now() } = {}) {
  const s = state && typeof state === 'object' ? state : {};
  const device = typeof s.device === 'string' && s.device.trim() ? s.device.trim() : '이 PC';
  const p = s.protection || {};
  const base = { device, stamp: null, notes: [], box: null, link: null, hint: null, sub: '' };

  if (!s.configured && !s.job) return { ...base, id: 'start', tone: 'setup', kick: '설정할 것이 없습니다', title: '업무 자료를 매시간 저절로 지킵니다.', actions: [{ id: 'start', label: '보호 시작', kind: 'main', to: 'start-1' }], evidence: null };

  // 쓰는 기기를 다른 PC에 넘겨준 옛 PC(설계 4.6 N2) — 엔진에 아직 없다(FUTURE.movedTo)
  if (s.movedTo) {
    const to = String(s.movedTo.device || '새 PC');
    return { ...base, id: 'home-moved', tone: 'moved', stamp: '옮김', kick: `${device} · 백업을 쉬는 중`, title: `백업이 「${to}」${josa(to, '으로/로').slice(to.length)} 옮겨졌습니다.`,
      sub: `여기서 고친 파일은 백업되지 않습니다. ${whenKo(s.lastBackup?.at, now)}까지의 판은 그대로라 파일 되살리기는 계속 쓸 수 있습니다.`,
      actions: [RESTORE, { id: 'reclaim', label: '이 PC로 다시 백업', kind: 'line' }],
      hint: `다시 백업하면 「${to}」${josa(to, '은/는').slice(to.length)} 백업을 멈추고, 그 PC와 메일로 알립니다.`,
      evidence: evidence(s, now, { state: 'moved' }) };
  }

  if (s.job) {
    const name = jobName(s.job), percent = pct(s.job);
    const restoring = s.job.kind === 'restore';
    return { ...base, id: 'home-run', tone: 'run', kick: `${device} · ${name} 도는 중`,
      title: restoring ? '파일을 되살리고 있습니다.' : s.job.kind === 'protect' ? '첫 백업 중입니다.' : '지금 백업하고 있습니다.',
      sub: restoring ? '끝나면 되살린 폴더를 엽니다.' : s.lastBackup?.at ? `창을 닫아도 계속됩니다. 끝나기 전까지 가장 최근 판은 ${whenKo(s.lastBackup.at, now)} 판입니다.` : '창을 닫아도 계속됩니다. 끝나면 알림으로 알려 드립니다.',
      actions: restoring ? [] : [RESTORE, MOVE],
      hint: s.job.scheduled ? `파일 되살리기는 지금 누르면 ${josa(name, '이/가')} 끝나는 대로 이어서 엽니다.` : null,
      progress: { label: name, stage: stageWord(s.job), percent },
      evidence: { ...evidence(s, now), run: { label: `${name} · ${stageWord(s.job)}`, percent } } };
  }

  // 한꺼번에 지워짐(설계 4.4) — 엔진에 아직 없다(FUTURE.massHold)
  if (s.massHold) {
    const m = s.massHold, folder = folderName(m.path);
    return { ...base, id: 'home-mass', tone: 'bad', stamp: '경고', kick: `${device} · 확인이 필요합니다`, title: '많은 파일이 한꺼번에 지워졌습니다.',
      sub: `${aroundKo(m.at, now)} 「${folder}」에서 ${count(m.removed)}개가 사라졌습니다. 확인하기 전까지 이전 판을 지우지 않습니다.`,
      notes: ['직접 지웠거나, 폴더를 옮기거나 이름을 바꿨다면 「내가 한 일이 맞음」을 누르세요.', '모르는 일이면 지워지기 전 판으로 되살리세요. 원래 파일은 건드리지 않고 새 폴더에 놓습니다.'],
      link: { label: `지워진 ${count(m.removed)}개 보기`, to: 'mass-list' },
      actions: [{ id: 'mass-restore', label: '지워지기 전으로 되살리기', kind: 'main', to: 'restore' }, { id: 'mass-ok', label: '내가 한 일이 맞음', kind: 'line' }],
      evidence: evidence(s, now, { state: 'mass' }) };
  }

  // 되살려 보기에서 다름(설계 4.7) — 손상은 그날 알린다
  if (s.probeHold || s.lastProbe?.result === 'failed') {
    return { ...base, id: 'home-probe', tone: 'bad', stamp: '경고', kick: `${device} · 확인이 필요합니다`, title: '되살려 본 파일이 원본과 달랐습니다.',
      sub: '확인하기 전까지 이전 판을 지우지 않습니다. 같은 파일을 다시 되살려 보면 원인이 이 PC인지 백업인지 가립니다.',
      actions: [{ id: 'probe', label: '다시 되살려 보기', kind: 'main', call: 'probeRestore' }, { ...RESTORE, kind: 'line' }], evidence: evidence(s, now) };
  }

  const missing = Array.isArray(s.missingSources) ? s.missingSources : [];
  if (missing.length) {
    const m = missing[0], name = folderName(m), rest = (s.sources || []).length - missing.length;
    return { ...base, id: 'home-missing', tone: 'warn', stamp: '주의', kick: `${device} · 확인이 필요합니다`,
      title: missing.length > 1 ? `폴더 ${count(missing.length)}개를 찾을 수 없습니다.` : '폴더 하나를 찾을 수 없습니다.',
      sub: `「${name}」(${m})${josa(name, '이/가').slice(name.length)} 없어 그 폴더만 빼고 백업했습니다.${rest > 0 && s.lastBackup?.at ? ` 나머지 ${placesKo(rest).replace(' ', '')}은 ${whenKo(s.lastBackup.at, now)}에 지켰습니다.` : ''}`,
      box: { title: '마지막 판은 붙들어 둡니다', text: '그 폴더가 든 마지막 판은 지워지지 않게 붙들어 둡니다. 폴더가 다시 보이면 저절로 이어서 지킵니다.' },
      actions: [{ id: 'reselect', label: '다시 고르기', kind: 'main', call: 'addSources' }, { id: 'drop', label: '목록에서 빼기', kind: 'line', call: 'removeSource', arg: m }],
      hint: '빼면 그 폴더의 백업은 30일 뒤 지워집니다.', evidence: evidence(s, now, { state: 'missing' }) };
  }

  // 그 밖의 주의 상태(엔진 protection.level · reason)
  const attention = {
    credential: { title: '다시 로그인해야 이어서 지킵니다.', sub: '이 PC의 백업 연결이 끊겼습니다. 다시 로그인하면 바로 이어서 합니다.', act: { id: 'relogin', label: '다시 로그인', kind: 'main', to: 'start-1' } },
    recovery: { title: '복구 정보를 아직 맡기지 않았습니다.', sub: '이 PC를 잃어버렸을 때 백업을 열 열쇠입니다. Google 계정에 한 번 맡기면 끝납니다.', act: { id: 'recovery', label: '복구 정보 맡기기', kind: 'main', call: 'syncRecovery' } },
    clock: { title: '이 PC의 시계가 맞지 않습니다.', sub: '시계가 맞지 않으면 언제 백업했는지 셀 수 없어 쉬고 있습니다. Windows 시계를 맞추면 이어서 합니다.', act: null },
    health: { title: '백업 점검을 마치지 못했습니다.', sub: '확인하기 전까지 이전 판을 지우지 않습니다. 다시 점검하면 무엇이 문제인지 가립니다.', act: { id: 'check', label: '다시 점검', kind: 'main', call: 'checkRepository' } },
    error: { title: '지난 백업을 마치지 못했습니다.', sub: s.lastBackup?.at ? `가장 최근 판은 ${whenKo(s.lastBackup.at, now)} 판입니다. 다음 확인 때 다시 해 봅니다.` : '다음 확인 때 다시 해 봅니다.', act: { id: 'backup', label: '지금 백업', kind: 'main', call: 'backupNow' } },
    empty: { title: '아직 첫 백업이 없습니다.', sub: '첫 백업이 끝나야 파일을 되살릴 수 있습니다.', act: { id: 'backup', label: '지금 백업', kind: 'main', call: 'backupNow' } },
    overdue: { title: `${agoKo(s.lastBackup?.at, now)} 동안 백업하지 못했습니다.`, sub: `가장 최근 판은 ${whenKo(s.lastBackup?.at, now)} 판입니다. PC가 켜져 있고 인터넷에 이어져 있으면 저절로 이어서 합니다.`, act: { id: 'backup', label: '지금 백업', kind: 'main', call: 'backupNow' } },
    startup: { title: '매시간 예약이 걸려 있지 않습니다.', sub: '창을 닫으면 백업이 멈춥니다. 다시 걸면 창을 닫아도 매시간 뒤에서 조용히 돕니다.', act: { id: 'schedule', label: '예약 다시 걸기', kind: 'main', call: 'setAutomatic', arg: true } },
  }[p.reason];
  if (attention) {
    return { ...base, id: `home-${p.reason}`, tone: p.reason === 'health' ? 'bad' : 'warn', stamp: p.reason === 'health' ? '경고' : '주의', kick: `${device} · 확인이 필요합니다`,
      title: attention.title, sub: attention.sub, actions: [...(attention.act ? [attention.act] : []), ...(s.lastBackup ? [{ ...RESTORE, kind: attention.act ? 'line' : 'main' }] : [])], evidence: evidence(s, now) };
  }
  if (p.level === 'paused') {
    return { ...base, id: 'home-paused', tone: 'warn', stamp: '주의', kick: `${device} · 잠시 쉬는 중`, title: '백업을 잠시 쉬고 있습니다.',
      sub: `${aroundKo(s.pausedUntil, now).replace(' 무렵', '')}에 다시 시작합니다. 그동안 고친 파일은 다시 시작할 때 담깁니다.`,
      actions: [{ id: 'resume', label: '지금 다시 시작', kind: 'main', call: 'resumeAutomatic' }, { ...RESTORE, kind: 'line' }], evidence: evidence(s, now) };
  }
  if (p.level === 'off') {
    return { ...base, id: 'home-off', tone: 'warn', stamp: '주의', kick: `${device} · 자동 백업 꺼짐`, title: '자동 백업이 꺼져 있습니다.',
      sub: '켜 두면 창을 닫아도 매시간 뒤에서 조용히 돕니다.', actions: [{ id: 'on', label: '자동 백업 켜기', kind: 'main', call: 'setAutomatic', arg: true }, { ...RESTORE, kind: 'line' }], evidence: evidence(s, now) };
  }
  if (p.level === 'restoreOnly') {
    return { ...base, id: 'home-restore-only', tone: 'moved', stamp: '옮김', kick: `${device} · 되살리기만 하는 연결`, title: '이 PC는 파일을 되살리기만 합니다.',
      sub: '이 연결로는 백업을 바꾸거나 지우지 않습니다.', actions: [RESTORE], evidence: evidence(s, now, { state: 'moved' }) };
  }

  // 안전함 — 쓰는 중인 파일 몇 개만 앞 판(부분 판)이면 그 사실을 한 줄로
  const partial = s.lastPartial && ms(s.lastPartial.at) && (!s.lastBackup || ms(s.lastPartial.at) >= ms(s.lastBackup.at) - MINUTE) ? s.lastPartial : null;
  if (partial) {
    const n = count(partial.unreadable) + (partial.cut ? '개 넘게' : '개');
    const who = typeof partial.program === 'string' && partial.program ? partial.program : null;
    return { ...base, id: 'home-partial', tone: 'ok', stamp: '안전', kick: `${device} · 매시간 저절로 지키는 중`, title: '안전합니다.',
      sub: `${who ? `${josa(who, '이/가')} 쓰는 중인` : '다른 프로그램이 쓰는 중인'} 파일 ${n}만 앞 판으로 지키고, 나머지는 모두 최신 판입니다.`,
      link: { label: '어떤 파일인지 보기', to: s.admin === false ? 'partial-std' : 'partial' },
      actions: [RESTORE, MOVE], evidence: evidence(s, now, { state: 'partial' }) };
  }
  return { ...base, id: 'home', tone: 'ok', stamp: '안전', kick: `${device} · 매시간 저절로 지키는 중`, title: '안전합니다.',
    sub: '매시간 저절로 확인하고, 일주일에 한 번은 파일을 실제로 되살려 원본과 같은지 봅니다.',
    actions: [RESTORE, MOVE], evidence: evidence(s, now) };
}

/** 사고 되돌리기 마감 — 화면이 직접 셈한다(T + 29일) */
export function undoWindow(hiddenAt, now = Date.now()) {
  const until = undoDeadline(hiddenAt);
  return until === null ? null : { until, untilKo: `${dayKo(until).replace(/ [일월화수목금토]$/, '')} ${timeKo(until)}`, daysLeft: daysLeft(until, now) };
}
